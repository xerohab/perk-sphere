// Shared task-completion reward logic used by completeTask (user/admin path) and
// trustedActivityBridge (trusted Linux path). This is the SINGLE place that issues
// Points/XP/achievements for a task completion, so reward authority never duplicates.
//
// Callers MUST have already verified: user existence, task availability, completion
// limits, cooldown, and viewing requirement. This function performs the idempotency
// re-check (progress.reward_issued), issues rewards through the authoritative ledger,
// marks the progress record complete, and notifies the user. The caller writes the
// audit log with its own action/actor context.

import { adjustPoints, adjustXp } from "./rewards.ts";
import { deriveRewardType, periodStart } from "./tasks.ts";
import { normalizePlatform } from "./destinations.ts";
import { assertUnits } from "./rewardPolicy.ts";
import {fullWatchError} from "./fullWatch.ts";

export async function finalizeCompletion(admin, { userId, task, progress, completedCount, now, source, verificationStatus, actorId }) {
  if(task.reward_processing === "linux_partner") throw new Error("Partner tasks require independent transactional reward verification.");
  const invalidFullWatch = fullWatchError(task); if(invalidFullWatch) throw new Error(invalidFullWatch);
  // Idempotency re-check — narrows the race window for concurrent completion attempts.
  if (progress.reward_issued) {
    return { already_completed: true, completion_number: progress.completion_number };
  }

  // Fail closed if the fresh read fails. This check handles sequential retries;
  // it is NOT an atomic lock and does not guarantee concurrent exactly-once issuance.
  const fresh = await admin.entities.TaskProgress.get(progress.id);
  if (!fresh) throw new Error('Task progress is unavailable.');
  if (fresh.reward_issued) {
    return { already_completed: true, completion_number: fresh.completion_number };
  }

  // For once_ever / once_daily / once_weekly, re-check completed records server-side
  // to catch sequential duplicate completions. Concurrent calls still require
  // a transactional ledger and a unique completion key.
  const limitType = task.completion_limit_type || 'once_ever';
  if (limitType === 'once_ever' || limitType === 'once_daily' || limitType === 'once_weekly') {
    const allProgress = await admin.entities.TaskProgress.filter({ user_id: userId, task_id: task.id });
    const completed = (allProgress || []).filter((p) => p.status === 'completed' && p.reward_issued);
    if (limitType === 'once_ever' && completed.length > 0) {
      return { already_completed: true, completion_number: completed[0].completion_number };
    }
    if (limitType === 'once_daily' || limitType === 'once_weekly') {
      const ps = periodStart(limitType, now);
      const inPeriod = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= ps);
      if (inPeriod.length > 0) {
        return { already_completed: true, completion_number: inPeriod[0].completion_number };
      }
    }
  }

  const rewardType = deriveRewardType(task);
  // YouTube zero-reward hard enforcement — even if an admin mistakenly configures a
  // YouTube task with points_reward > 0, the reward is forced to 0 at the ledger.
  const isYouTubeTask = task.destination_platform && normalizePlatform(task.destination_platform) === "YouTube";
  const pointsToIssue = isYouTubeTask ? 0 : ((rewardType === "points" || rewardType === "points_xp") ? (task.points_reward || 0) : 0);
  const xpToIssue = isYouTubeTask ? 0 : ((rewardType === "xp" || rewardType === "points_xp") ? (task.xp_reward || 0) : 0);
  // Validate both currencies before the first write, avoiding a points credit
  // followed by an XP validation failure.
  assertUnits(pointsToIssue, 'Task points reward');
  assertUnits(xpToIssue, 'Task XP reward');

  let pointsResult = null;
  let xpResult = null;
  if (pointsToIssue > 0) {
    pointsResult = await adjustPoints(admin, {
      userId,
      amount: pointsToIssue,
      type: "earned",
      reason: "Task Completion — " + task.name,
      source: "task",
      relatedActivityId: task.id
    });
  }
  if (xpToIssue > 0) {
    xpResult = await adjustXp(admin, {
      userId,
      amount: xpToIssue,
      reason: "Task Completion — " + task.name,
      source: "task",
      relatedActivityId: task.id
    });
  }
  if (rewardType === "achievement" && task.achievement_id) {
    await admin.entities.UserAchievement.create({
      user_id: userId,
      achievement_id: task.achievement_id,
      achievement_name: task.name,
      awarded_by: actorId || "task_system"
    });
  }

  const completionNumber = completedCount + 1;
  await admin.entities.TaskProgress.update(progress.id, {
    status: "completed",
    completed_at: now.toISOString(),
    reward_issued: true,
    points_issued: pointsToIssue,
    xp_issued: xpToIssue,
    completion_number: completionNumber,
    verification_status: verificationStatus,
    source
  });

  const parts = [];
  if (pointsToIssue > 0) parts.push(pointsToIssue + " points");
  if (xpToIssue > 0) parts.push(xpToIssue + " XP");
  await admin.entities.Notification.create({
    user_id: userId,
    type: "task_completed",
    title: "Task completed!",
    message: 'You completed "' + task.name + '"' + (parts.length ? " and earned " + parts.join(" and ") + "." : ".")
  });

  return { already_completed: false, pointsResult, xpResult, pointsToIssue, xpToIssue, completionNumber };
}
