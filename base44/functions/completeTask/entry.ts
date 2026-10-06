import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { adjustPoints, adjustXp } from '../../shared/rewards.ts';
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { isTaskAvailable, isViewingTask, isEventWindowOpen, canCompleteAgain, isInCooldown, deriveRewardType } from '../../shared/tasks.ts';

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

    // Issue rewards through the authoritative ledger
    const rewardType = deriveRewardType(task);
    const pointsToIssue = (rewardType === 'points' || rewardType === 'points_xp') ? (task.points_reward || 0) : 0;
    const xpToIssue = (rewardType === 'xp' || rewardType === 'points_xp') ? (task.xp_reward || 0) : 0;
    let pointsResult = null;
    let xpResult = null;

    if (pointsToIssue > 0) {
      pointsResult = await adjustPoints(admin, {
        userId: targetUserId, amount: pointsToIssue,
        type: 'earned',
        reason: 'Task Completion — ' + task.name,
        source: 'task',
        relatedActivityId: taskId
      });
    }
    if (xpToIssue > 0) {
      xpResult = await adjustXp(admin, {
        userId: targetUserId, amount: xpToIssue,
        reason: 'Task Completion — ' + task.name,
        source: 'task',
        relatedActivityId: taskId
      });
    }
    if (rewardType === 'achievement' && task.achievement_id) {
      await admin.entities.UserAchievement.create({
        user_id: targetUserId,
        achievement_id: task.achievement_id,
        achievement_name: task.name,
        awarded_by: manual ? adminUser.id : 'task_system'
      });
    }

    const completionNumber = completed.length + 1;
    await admin.entities.TaskProgress.update(progress.id, {
      status: 'completed',
      completed_at: now.toISOString(),
      reward_issued: true,
      points_issued: pointsToIssue,
      xp_issued: xpToIssue,
      completion_number: completionNumber,
      verification_status: manual ? 'manual' : 'verified',
      source: manual ? 'admin_manual' : 'server_verified'
    });

    const parts = [];
    if (pointsToIssue > 0) parts.push(pointsToIssue + ' points');
    if (xpToIssue > 0) parts.push(xpToIssue + ' XP');
    await admin.entities.Notification.create({
      user_id: targetUserId,
      type: 'task_completed',
      title: 'Task completed!',
      message: 'You completed "' + task.name + '"' + (parts.length ? ' and earned ' + parts.join(' and ') + '.' : '.')
    });

    await writeAudit(admin, {
      adminId: manual ? adminUser.id : user.id,
      action: manual ? 'task_manual_complete' : 'task_completed',
      entityType: 'Task',
      entityId: taskId,
      next: { user_id: targetUserId, points: pointsToIssue, xp: xpToIssue, completion_number: completionNumber }
    });

    return Response.json({
      ok: true,
      points_balance: pointsResult ? pointsResult.balance_after : undefined,
      xp_balance: xpResult ? xpResult.xp_after : undefined,
      rank: xpResult ? xpResult.rank : undefined,
      points_issued: pointsToIssue,
      xp_issued: xpToIssue,
      completion_number: completionNumber
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}