import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { waitUntil } from "base44:runtime";
import { verifyTrustedRequest, pruneExpiredNonces } from "../../shared/hmac.ts";
import { finalizeCompletion } from "../../shared/taskCompletion.ts";
import { writeAudit } from "../../shared/permissions.ts";
import {
  isTaskAvailable,
  isViewingTask,
  isLiveStreamTask,
  isEventWindowOpen,
  canCompleteAgain,
  isInCooldown,
  requiredSecondsFor
} from "../../shared/tasks.ts";
import { validateBrowserUrl, domainsFor } from "../../shared/destinations.ts";

// redeploy: refresh bundled shared hmac.ts (inbound secrets).

// Trusted server-to-server bridge for the Perk Sphere Linux API (api.perksphere.org).
// Accepts HMAC-authenticated verified activity/task progress and updates the
// authoritative TaskProgress architecture. For tasks configured as trusted_automatic,
// the bridge triggers completion server-side — the client never decides completion.
//
// Reward amounts always come from the Base44 Task definition; Linux may only report
// verified facts (eligible time, session state), never award Points/XP directly.

const ALLOWED_EVENTS = [
  "SESSION_STARTED",
  "SESSION_PROGRESS",
  "SESSION_PAUSED",
  "SESSION_RESUMED",
  "SESSION_ENDED",
  "PAGE_PROGRESS",
  "TASK_PROGRESS_VERIFIED",
  "SESSION_INVALIDATED"
];

const BLOCKED_EVENTS = [
  "AWARD_POINTS",
  "AWARD_XP",
  "SET_POINTS",
  "SET_XP",
  "TASK_COMPLETED",
  "COMPLETE_TASK",
  "GRANT_REWARD"
];

const VIEWING_EVENTS = new Set(["SESSION_STARTED", "SESSION_PROGRESS", "SESSION_PAUSED", "SESSION_RESUMED", "SESSION_ENDED", "SESSION_INVALIDATED"]);
const AUTO_COMPLETABLE_TYPES = new Set(["watch_video", "live_stream", "spend_time", "visit_website", "visit_page", "daily_visit"]);
const SESSION_EVENTS = new Set(["SESSION_STARTED", "SESSION_PROGRESS", "SESSION_PAUSED", "SESSION_RESUMED", "SESSION_ENDED", "SESSION_INVALIDATED", "PAGE_PROGRESS"]);

function err(code, message, status = 400) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

export default async function (req) {
  let admin = null;
  let requestId = null;

  try {
    const base44 = createClientFromRequest(req);
    admin = base44.asServiceRole;
    // 1. HMAC authentication (before any expensive processing).
    const auth = await verifyTrustedRequest(req, admin);
    requestId = auth.requestId;
    if (!auth.ok) {
      // Audit auth failures (no secrets/signatures in the record).
      waitUntil(writeAudit(admin, {
        adminId: "trusted_bridge",
        action: "trusted_auth_failed",
        entityType: "TrustedBridge",
        next: { code: auth.code }
      }).catch(() => {}));
      return Response.json({ ok: false, error: { code: auth.code, message: auth.error }, request_id: requestId }, { status: auth.status });
    }

    // Opportunistically prune expired nonces (fire-and-forget).
    waitUntil(pruneExpiredNonces(admin).catch(() => {}));

    const body = JSON.parse(auth.rawBody || "{}");
    const {
      external_event_id,
      user_reference,
      task_id,
      device_uuid,
      session_uuid,
      event_type,
      eligible_seconds,
      verification_state,
      source_timestamp,
      metadata
    } = body;

    if (!external_event_id) return err("missing_external_event_id", "external_event_id is required.", 400);
    if (!event_type) return err("missing_event_type", "event_type is required.", 400);
    if (BLOCKED_EVENTS.includes(event_type)) return err("blocked_event_type", "This event type is not accepted.", 400);
    if (!ALLOWED_EVENTS.includes(event_type)) return err("unknown_event_type", "Unknown event type.", 400);
    if (!user_reference) return err("missing_user_reference", "user_reference is required.", 400);
    if (!task_id) return err("missing_task_id", "task_id is required.", 400);
    if (SESSION_EVENTS.has(event_type) && !session_uuid) return err("missing_session_uuid", "session_uuid is required for this event type.", 400);

    const incomingEligible = Math.max(0, Number(eligible_seconds) || 0);
    const incomingState = ["received", "verified", "rejected", "invalidated"].includes(verification_state) ? verification_state : "received";

    // 2. Event idempotency — if we already processed this external_event_id, return the stored result.
    const prior = await admin.entities.TrustedActivityEvent.filter({ external_event_id });
    const priorRec = (prior || [])[0];
    if (priorRec && (priorRec.processing_status === "processed" || priorRec.processing_status === "duplicate")) {
      return Response.json({
        ok: true,
        data: {
          external_event_id,
          accepted: true,
          duplicate: true,
          task_completed: !!priorRec.completion_triggered,
          completion_id: priorRec.completion_id || null
        },
        request_id: requestId
      });
    }

    // Create/reuse the event record (pending).
    const eventRecord = priorRec || await admin.entities.TrustedActivityEvent.create({
      external_event_id,
      source: "linux_api",
      user_reference,
      task_id,
      device_uuid: device_uuid || null,
      session_uuid: session_uuid || null,
      event_type,
      eligible_seconds: incomingEligible,
      verification_state: incomingState,
      source_timestamp: source_timestamp || null,
      payload: metadata || null,
      received_at: new Date().toISOString(),
      processing_status: "pending",
      request_id: requestId
    });

    // 3. User mapping — must resolve to an existing Base44 user.
    let user = null;
    try {
      user = await admin.entities.User.get(user_reference);
    } catch (_e) {
      user = null;
    }
    if (!user) {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "unknown_user", error_message: "user_reference does not map to an existing user.", processed_at: new Date().toISOString() });
      waitUntil(writeAudit(admin, { adminId: "trusted_bridge", action: "trusted_unknown_user", entityType: "TrustedActivityEvent", entityId: eventRecord.id, next: { user_reference, task_id } }).catch(() => {}));
      return err("unknown_user", "user_reference does not map to an existing user.", 404);
    }

    // 3b. User eligibility — active restrictions block trusted activity processing.
    const _restrictionNow = new Date();
    const _restrictions = await admin.entities.Restriction.filter({ user_id: user.id });
    const _hasActiveRestriction = (_restrictions || []).some((r) => {
      if (r.active === false) return false;
      if (r.start_date && new Date(r.start_date) > _restrictionNow) return false;
      if (r.end_date && new Date(r.end_date) < _restrictionNow) return false;
      return true;
    });
    if (_hasActiveRestriction) {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "user_restricted", error_message: "User has an active restriction.", user_id: user.id, processed_at: new Date().toISOString() });
      return err("user_restricted", "User has an active restriction.", 403);
    }

    // 4. Task validation.
    const task = await admin.entities.Task.get(task_id).catch(() => null);
    if (!task) {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "unknown_task", error_message: "Task not found.", user_id: user.id, processed_at: new Date().toISOString() });
      return err("unknown_task", "Task not found.", 404);
    }
    const now = new Date();
    if (!isTaskAvailable(task, now)) {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "task_unavailable", error_message: "Task is not currently available.", user_id: user.id, processed_at: new Date().toISOString() });
      return err("task_unavailable", "Task is not currently available.", 400);
    }

    // 4b. Verification mode — only trusted_automatic tasks are handled by this bridge.
    if ((task.verification_mode || "client_assisted") !== "trusted_automatic") {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "not_trusted_automatic", error_message: "Task is not configured for trusted automatic verification.", user_id: user.id, processed_at: now.toISOString() });
      return err("not_trusted_automatic", "Task is not configured for trusted automatic verification.", 400);
    }

    // 4c. Destination validation — task must reference a valid Allowed+enabled destination.
    if (!task.destination_id) {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "missing_destination", error_message: "Task has no destination configured.", user_id: user.id, processed_at: now.toISOString() });
      return err("missing_destination", "Task has no destination configured.", 400);
    }

    let _destination = null;
    let _destDomains = [];
    try {
      if (task.destination_type === "tracked_account") {
        _destination = await admin.entities.TrackedAccount.get(task.destination_id);
        _destDomains = domainsFor(_destination.profile_url);
      } else {
        _destination = await admin.entities.Website.get(task.destination_id);
        _destDomains = domainsFor(_destination.domain);
      }
    } catch (_e) { _destination = null; }

    if (!_destination) {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "unknown_destination", error_message: "Destination not found.", user_id: user.id, processed_at: now.toISOString() });
      return err("unknown_destination", "Destination not found.", 404);
    }

    const _destEnabled = task.destination_type === "tracked_account"
      ? (_destination.active !== false && _destination.tracking_enabled !== false)
      : (_destination.status !== "inactive" && _destination.tracking_enabled !== false);
    if (!_destEnabled) {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "destination_disabled", error_message: "Destination is disabled.", user_id: user.id, processed_at: now.toISOString() });
      return err("destination_disabled", "Destination is disabled.", 400);
    }

    if ((_destination.eligibility || "neutral") !== "allowed") {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "destination_not_allowed", error_message: "Destination is not classified as allowed.", user_id: user.id, processed_at: now.toISOString() });
      return err("destination_not_allowed", "Destination is not classified as allowed.", 400);
    }

    // Hostname integrity — task content_url hostname must match the configured destination.
    if (task.content_url) {
      const _urlCheck = validateBrowserUrl(task.content_url);
      if (!_urlCheck.ok || !_destDomains.includes(_urlCheck.hostname)) {
        await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "hostname_mismatch", error_message: "Task target URL does not match the configured destination.", user_id: user.id, processed_at: now.toISOString() });
        return err("hostname_mismatch", "Task target URL does not match the configured destination.", 400);
      }
    }

    // Event-type / task-type compatibility.
    if (VIEWING_EVENTS.has(event_type) && !isViewingTask(task) && task.task_type !== "visit_website" && task.task_type !== "visit_page") {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "event_task_mismatch", error_message: "Event type not compatible with task type.", user_id: user.id, processed_at: new Date().toISOString() });
      return err("event_task_mismatch", "Event type not compatible with task type.", 400);
    }

    // Live-stream event window is enforced independently by Base44.
    if (isLiveStreamTask(task) && !isEventWindowOpen(task, now)) {
      await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "rejected", error_code: "event_window_closed", error_message: "Live stream event window is not open.", user_id: user.id, processed_at: new Date().toISOString() });
      return err("event_window_closed", "Live stream event window is not open.", 400);
    }

    // 5. Per-session monotonic progress (high-water mark).
    let taskCompleted = false;
    let completionId = null;
    let aggregateEligible = 0;

    if (session_uuid && event_type !== "SESSION_INVALIDATED") {
      const sessRecs = await admin.entities.TrustedSessionProgress.filter({ session_uuid, task_id, user_id: user.id });
      let sess = (sessRecs || [])[0];
      const prevHighest = sess ? (sess.highest_eligible_seconds || 0) : 0;
      const newHighest = Math.max(prevHighest, incomingEligible);
      const sessState = event_type === "SESSION_ENDED" && incomingState === "verified" ? "verified" : (sess ? sess.verification_state : incomingState);

      if (!sess) {
        sess = await admin.entities.TrustedSessionProgress.create({
          session_uuid,
          task_id,
          user_reference,
          user_id: user.id,
          device_uuid: device_uuid || null,
          highest_eligible_seconds: newHighest,
          verification_state: sessState,
          last_event_id: eventRecord.id,
          last_updated_at: now.toISOString()
        });
      } else if (newHighest !== prevHighest || sessState !== sess.verification_state) {
        await admin.entities.TrustedSessionProgress.update(sess.id, {
          highest_eligible_seconds: newHighest,
          verification_state: sessState,
          last_event_id: eventRecord.id,
          last_updated_at: now.toISOString()
        });
      }
    }

    if (event_type === "SESSION_INVALIDATED" && session_uuid) {
      const sessRecs = await admin.entities.TrustedSessionProgress.filter({ session_uuid, task_id, user_id: user.id });
      const sess = (sessRecs || [])[0];
      if (sess) {
        await admin.entities.TrustedSessionProgress.update(sess.id, {
          verification_state: "invalidated",
          last_event_id: eventRecord.id,
          last_updated_at: now.toISOString()
        });
      }
      waitUntil(writeAudit(admin, { adminId: "trusted_bridge", action: "trusted_session_invalidated", entityType: "TrustedSessionProgress", entityId: sess ? sess.id : null, next: { session_uuid, task_id, user_id: user.id } }).catch(() => {}));
    }

    // 6. Recompute TaskProgress.eligible_seconds from verified, non-invalidated trusted sessions.
    const allSessions = await admin.entities.TrustedSessionProgress.filter({ user_id: user.id, task_id });
    aggregateEligible = (allSessions || [])
      .filter((s) => s.verification_state === "verified")
      .reduce((sum, s) => sum + (s.highest_eligible_seconds || 0), 0);

    const reqSec = requiredSecondsFor(task);
    const pct = reqSec > 0 ? Math.min(100, Math.round((aggregateEligible / reqSec) * 100)) : 0;

    // Find or create the in-progress TaskProgress record.
    const allProgress = await admin.entities.TaskProgress.filter({ user_id: user.id, task_id });
    const completed = (allProgress || []).filter((p) => p.status === "completed").sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0));
    let progress = (allProgress || []).find((p) => p.status === "in_progress");
    if (!progress) {
      progress = await admin.entities.TaskProgress.create({
        user_id: user.id,
        task_id,
        task_name: task.name,
        status: "in_progress",
        eligible_seconds: aggregateEligible,
        required_seconds: reqSec,
        progress_percentage: pct,
        started_at: now.toISOString(),
        last_activity: now.toISOString(),
        completion_number: completed.length + 1,
        verification_status: "pending",
        source: "trusted_bridge"
      });
    } else {
      await admin.entities.TaskProgress.update(progress.id, {
        eligible_seconds: aggregateEligible,
        progress_percentage: pct,
        last_activity: now.toISOString()
      });
    }

    // 7. Automatic completion for trusted_automatic tasks.
    const isTrustedAuto = (task.verification_mode || "client_assisted") === "trusted_automatic";
    const isAutoCompletableType = AUTO_COMPLETABLE_TYPES.has(task.task_type);
    const requirementMet = reqSec > 0 ? aggregateEligible >= reqSec : (event_type === "SESSION_ENDED" || event_type === "TASK_PROGRESS_VERIFIED") && incomingState === "verified";

    if (isTrustedAuto && isAutoCompletableType && requirementMet && !progress.reward_issued) {
      const limitCheck = canCompleteAgain(task, completed, now);
      if (!limitCheck.ok) {
        await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "processed", user_id: user.id, processed_at: now.toISOString(), completion_triggered: false });
        return Response.json({ ok: true, data: { external_event_id, accepted: true, duplicate: false, progress: { eligible_seconds: aggregateEligible, required_seconds: reqSec }, task_completed: false, reason: limitCheck.reason }, request_id: requestId });
      }
      if (task.cooldown_seconds > 0 && completed.length > 0) {
        const lastAt = completed[completed.length - 1].completed_at;
        if (isInCooldown(lastAt, task.cooldown_seconds, now)) {
          await admin.entities.TrustedActivityEvent.update(eventRecord.id, { processing_status: "processed", user_id: user.id, processed_at: now.toISOString(), completion_triggered: false });
          return Response.json({ ok: true, data: { external_event_id, accepted: true, duplicate: false, progress: { eligible_seconds: aggregateEligible, required_seconds: reqSec }, task_completed: false, reason: "cooldown" }, request_id: requestId });
        }
      }

      // Re-read progress to narrow the concurrent-completion race, then finalize.
      const freshProgress = await admin.entities.TaskProgress.get(progress.id);
      if (freshProgress && !freshProgress.reward_issued) {
        const result = await finalizeCompletion(admin, {
          userId: user.id,
          task,
          progress: freshProgress,
          completedCount: completed.length,
          now,
          source: "trusted_automatic",
          verificationStatus: "verified",
          actorId: "trusted_bridge"
        });
        if (!result.already_completed) {
          taskCompleted = true;
          completionId = freshProgress.id;
          await writeAudit(admin, {
            adminId: "trusted_bridge",
            action: "trusted_task_auto_completed",
            entityType: "Task",
            entityId: task_id,
            next: { user_id: user.id, points: result.pointsToIssue, xp: result.xpToIssue, completion_number: result.completionNumber, external_event_id }
          });
        }
      }
    }

    // 8. Mark event processed.
    await admin.entities.TrustedActivityEvent.update(eventRecord.id, {
      processing_status: "processed",
      user_id: user.id,
      processed_at: now.toISOString(),
      completion_triggered: taskCompleted,
      completion_id: completionId
    });

    return Response.json({
      ok: true,
      data: {
        external_event_id,
        accepted: true,
        duplicate: false,
        progress: { eligible_seconds: aggregateEligible, required_seconds: reqSec },
        task_completed: taskCompleted,
        completion_id: completionId
      },
      request_id: requestId
    });
  } catch (error) {
    if (requestId && admin) {
      waitUntil(writeAudit(admin, { adminId: "trusted_bridge", action: "trusted_processing_error", entityType: "TrustedBridge", next: { message: String(error.message || error) } }).catch(() => {}));
    }
    return Response.json({ ok: false, error: { code: "internal_error", message: "Processing failed." }, request_id: requestId }, { status: 500 });
  }
}