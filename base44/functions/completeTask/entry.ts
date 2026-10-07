import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { finalizeCompletion } from '../../shared/taskCompletion.ts';
import { isTaskAvailable, isViewingTask, isEventWindowOpen, canCompleteAgain, isInCooldown } from '../../shared/tasks.ts';

// Completes a task for the signed-in user and issues rewards through the authoritative
// ledger. Idempotent: a progress record already marked reward_issued returns success
// without re-issuing. Viewing tasks require server-accumulated eligible_seconds to meet
// the requirement (populated by recordTaskEvent / the future Linux API). An admin with
// tasks.edit can pass manual:true to force-complete (verification_status='manual').
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { taskId, manual, userId: overrideUserId } = body;

    let user = null;
    try { user = await base44.auth.me(); } catch (_e) { user = null; }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let adminUser = null;
    if (manual) {
      const auth = await authorize(base44, 'tasks.edit');
      if (auth.error) return auth.error;
      adminUser = auth.user;
    }

    const admin = base44.asServiceRole;
    const task = await admin.entities.Task.get(taskId);
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
    const now = new Date();
    if (!isTaskAvailable(task, now)) return Response.json({ error: 'This task is not currently available.' }, { status: 400 });

    const targetUserId = manual ? (overrideUserId || user.id) : user.id;

    // Trusted-automatic tasks must only be completed through the trusted verification path
    // (trustedActivityBridge), never through manual user completion.
    if ((task.verification_mode || 'client_assisted') === 'trusted_automatic') {
      return Response.json({ error: 'trusted_automatic_requires_verified_activity' }, { status: 400 });
    }

    // Publicly hidden tasks are not completable by ordinary users (admin manual override still allowed).
    if (!manual && task.publicly_visible === false) {
      return Response.json({ error: 'This task is not publicly available.' }, { status: 400 });
    }

    // User eligibility — active restrictions block manual completion.
    const _restrictions = await admin.entities.Restriction.filter({ user_id: targetUserId });
    const _hasActiveRestriction = (_restrictions || []).some((r) => {
      if (r.active === false) return false;
      if (r.start_date && new Date(r.start_date) > now) return false;
      if (r.end_date && new Date(r.end_date) < now) return false;
      return true;
    });
    if (_hasActiveRestriction) {
      return Response.json({ error: 'User has an active restriction.' }, { status: 403 });
    }

    const allProgress = await admin.entities.TaskProgress.filter({ user_id: targetUserId, task_id: taskId });
    const completed = (allProgress || []).filter((p) => p.status === 'completed').sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0));

    let progress = (allProgress || []).find((p) => p.status === 'in_progress');
    if (!progress) {
      // Idempotent refresh: the task was already completed and rewarded
      const lastCompleted = completed[completed.length - 1];
      if (lastCompleted && lastCompleted.reward_issued) {
        return Response.json({ ok: true, already_completed: true, progress: lastCompleted });
      }
      return Response.json({ error: 'No active task progress. Start the task first.' }, { status: 400 });
    }

    // Idempotency: already rewarded → success without re-issuing
    if (progress.reward_issued) {
      return Response.json({ ok: true, already_completed: true, progress });
    }

    const limitCheck = canCompleteAgain(task, completed, now);
    if (!limitCheck.ok) return Response.json({ error: limitCheck.reason }, { status: 400 });

    if (task.cooldown_seconds > 0 && completed.length > 0) {
      const lastCompletedAt = completed[completed.length - 1].completed_at;
      if (isInCooldown(lastCompletedAt, task.cooldown_seconds, now)) {
        const remaining = Math.ceil(task.cooldown_seconds - (now - new Date(lastCompletedAt)) / 1000);
        return Response.json({ error: 'Task is on cooldown. Try again in ' + remaining + 's.' }, { status: 400 });
      }
    }

    // Viewing requirement (server-authoritative; skipped for manual admin override)
    if (isViewingTask(task) && !manual) {
      const req = task.required_seconds || 0;
      if (req > 0 && (progress.eligible_seconds || 0) < req) {
        return Response.json({ error: 'Viewing requirement not yet met.', eligible: progress.eligible_seconds || 0, required: req }, { status: 400 });
      }
      if (task.task_type === 'live_stream' && !isEventWindowOpen(task, now)) {
        return Response.json({ error: 'The event window for this task is not open.' }, { status: 400 });
      }
    }

    // Issue rewards through the shared authoritative ledger logic (also used by the
    // trusted Linux bridge), so reward authority is never duplicated.
    const result = await finalizeCompletion(admin, {
      userId: targetUserId,
      task,
      progress,
      completedCount: completed.length,
      now,
      source: manual ? 'admin_manual' : 'server_verified',
      verificationStatus: manual ? 'manual' : 'verified',
      actorId: manual ? adminUser.id : user.id
    });

    if (result.already_completed) {
      return Response.json({ ok: true, already_completed: true, progress });
    }

    await writeAudit(admin, {
      adminId: manual ? adminUser.id : user.id,
      action: manual ? 'task_manual_complete' : 'task_completed',
      entityType: 'Task',
      entityId: taskId,
      next: { user_id: targetUserId, points: result.pointsToIssue, xp: result.xpToIssue, completion_number: result.completionNumber }
    });

    return Response.json({
      ok: true,
      points_balance: result.pointsResult ? result.pointsResult.balance_after : undefined,
      xp_balance: result.xpResult ? result.xpResult.xp_after : undefined,
      rank: result.xpResult ? result.xpResult.rank : undefined,
      points_issued: result.pointsToIssue,
      xp_issued: result.xpToIssue,
      completion_number: result.completionNumber
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}