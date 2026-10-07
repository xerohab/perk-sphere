import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { waitUntil } from "base44:runtime";
import { verifyTrustedRequest, pruneExpiredNonces } from "../../shared/hmac.ts";
import { writeAudit } from "../../shared/permissions.ts";
import {
  isTaskAvailable,
  isEventWindowOpen,
  canCompleteAgain,
  requiredSecondsFor
} from "../../shared/tasks.ts";
import { normalizeDomain } from "../../shared/destinations.ts";

// Read-only trusted server-to-server configuration feed for the Perk Sphere
// Linux API. Returns the safe destination + task configuration a paired browser
// extension needs for task discovery. The extension never calls Base44 directly.
//
// This endpoint is strictly READ ONLY: it never creates/updates Tasks, ledger
// entries, Points, XP, TaskProgress, users, destinations or rewards. All reward
// authority stays with the existing completion logic (trustedActivityBridge /
// finalizeCompletion). The browser extension can never award itself anything.
//
// Authentication reuses the exact same HMAC-SHA256 trust model as
// trustedActivityBridge (X-PS-Key-ID / X-PS-Timestamp / X-PS-Nonce /
// X-PS-Signature), validated by the shared verifyTrustedRequest helper.

const FUNCTION_PATH = "/functions/trustedBrowserConfig";

// Task types a browser extension can realistically detect and report progress for.
const BROWSER_TASK_TYPES = new Set([
  "visit_website",
  "visit_page",
  "watch_video",
  "live_stream",
  "spend_time",
  "daily_visit"
]);

const ALLOWED_CLIENT_TYPES = new Set(["browser_extension"]);

function err(code, message, status = 400) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

// Normalised domain list for browser matching. Includes the bare domain and its
// www variant so the extension can match either form the user visits.
function domainsFor(domainish) {
  const d = normalizeDomain(domainish);
  if (!d) return [];
  return [d, "www." + d];
}

// Project a Website record into the safe destination shape. No notes, no rule
// values, no internal flags — only what the extension needs for recognition.
function projectWebsite(w) {
  const domains = domainsFor(w.domain);
  if (domains.length === 0) return null;
  return {
    id: w.id,
    name: w.site_name || w.domain || "Website",
    classification: w.eligibility || "neutral",
    domains,
    enabled: w.status !== "inactive" && w.tracking_enabled !== false
  };
}

// Project a TrackedAccount record into the safe destination shape, deriving
// matchable domains from its profile URL.
function projectAccount(a) {
  const domains = domainsFor(a.profile_url);
  if (domains.length === 0) return null;
  return {
    id: a.id,
    name: a.account_name || a.username || "Account",
    classification: a.eligibility || "neutral",
    domains,
    enabled: a.active !== false && a.tracking_enabled !== false
  };
}

// Project a Task into the safe browser-discovery shape. Deliberately excludes
// points_reward, xp_reward, reward_type, achievement_id and terms — the client
// must never decide or display reward authority.
function projectTask(t) {
  return {
    id: t.id,
    name: t.name,
    task_type: t.task_type,
    verification_mode: t.verification_mode || "client_assisted",
    destination_id: t.destination_id || null,
    target: {
      url: t.content_url || null,
      domain: t.content_url ? normalizeDomain(t.content_url) : null,
      content_id: t.content_id || null
    },
    requirements: {
      required_seconds: requiredSecondsFor(t)
    }
  };
}

export default async function (req) {
  let admin = null;
  let requestId = null;

  try {
    const base44 = createClientFromRequest(req);
    admin = base44.asServiceRole;

    // 1. HMAC authentication — same trust model as trustedActivityBridge.
    const auth = await verifyTrustedRequest(req, admin, FUNCTION_PATH);
    requestId = auth.requestId;
    if (!auth.ok) {
      waitUntil(writeAudit(admin, {
        adminId: "trusted_browser_config",
        action: "trusted_auth_failed",
        entityType: "TrustedBridge",
        next: { code: auth.code }
      }).catch(() => {}));
      return Response.json({ ok: false, error: { code: auth.code, message: auth.error }, request_id: requestId }, { status: auth.status });
    }

    // Opportunistic nonce-table cleanup (fire-and-forget).
    waitUntil(pruneExpiredNonces(admin).catch(() => {}));

    // 2. Parse + validate request body.
    const body = JSON.parse(auth.rawBody || "{}");
    const { user_reference, client_type, client_version } = body;

    if (!user_reference || typeof user_reference !== "string") {
      return err("missing_user_reference", "user_reference is required.", 400);
    }
    if (!client_type || !ALLOWED_CLIENT_TYPES.has(client_type)) {
      return err("invalid_client_type", "client_type must be 'browser_extension'.", 400);
    }
    // client_version is accepted for telemetry but not enforced.

    // 3. Resolve the user (read-only). Unknown user -> safe rejection, no data leak.
    let user = null;
    try {
      user = await admin.entities.User.get(user_reference);
    } catch (_e) {
      user = null;
    }
    if (!user) {
      return err("unknown_user", "user_reference does not map to an existing user.", 404);
    }

    const now = new Date();

    // 4. Load destinations (Website + TrackedAccount) — read-only, no writes.
    const [websites, accounts] = await Promise.all([
      admin.entities.Website.list('-updated_date', 200),
      admin.entities.TrackedAccount.list('-updated_date', 200)
    ]);

    const destinations = [];
    for (const w of (websites || [])) {
      const d = projectWebsite(w);
      if (d && d.enabled) destinations.push(d);
    }
    for (const a of (accounts || [])) {
      const d = projectAccount(a);
      if (d && d.enabled) destinations.push(d);
    }

    // 5. User eligibility — active restrictions make the task feed conservative
    //    (no tasks presented). Final authority remains with completion logic.
    const restrictions = await admin.entities.Restriction.filter({ user_id: user.id });
    const hasActiveRestriction = (restrictions || []).some((r) => {
      if (r.active === false) return false;
      if (r.start_date && new Date(r.start_date) > now) return false;
      if (r.end_date && new Date(r.end_date) < now) return false;
      return true;
    });

    let tasks = [];
    if (!hasActiveRestriction) {
      const allTasks = await admin.entities.Task.list('-updated_date', 200);
      const candidate = (allTasks || []).filter((t) =>
        t.active !== false &&
        !t.archived &&
        t.publicly_visible !== false &&
        BROWSER_TASK_TYPES.has(t.task_type) &&
        isTaskAvailable(t, now) &&
        isEventWindowOpen(t, now)
      );

      // Completion-limit filtering — exclude tasks the user can't complete again
      // (once_ever done, once_daily done today, custom_max reached, etc.). Uses the
      // existing canCompleteAgain helper so there is one eligibility model.
      if (candidate.length > 0) {
        const allProgress = await admin.entities.TaskProgress.filter({ user_id: user.id });
        const completedByTask = {};
        for (const p of (allProgress || [])) {
          if (p.status === "completed") {
            if (!completedByTask[p.task_id]) completedByTask[p.task_id] = [];
            completedByTask[p.task_id].push(p);
          }
        }
        tasks = candidate
          .filter((t) => canCompleteAgain(t, completedByTask[t.id] || [], now).ok)
          .map(projectTask);
      }
    }

    // 6. Build the read-only response.
    return Response.json({
      ok: true,
      data: {
        schema_version: 1,
        generated_at: now.toISOString(),
        destinations,
        tasks
      },
      request_id: requestId
    });
  } catch (error) {
    if (requestId && admin) {
      waitUntil(writeAudit(admin, { adminId: "trusted_browser_config", action: "trusted_processing_error", entityType: "TrustedBridge", next: { message: String(error.message || error) } }).catch(() => {}));
    }
    return Response.json({ ok: false, error: { code: "internal_error", message: "Processing failed." }, request_id: requestId }, { status: 500 });
  }
}