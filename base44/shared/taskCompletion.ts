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
import { deriveRewardType } from "./tasks.ts";

export async function finalizeCompletion(admin, { userId, task, progress, completedCount, now, source, verificationStatus, actorId }) {
  // Idempotency re-check — narrows the race window for concurrent completion attempts.
  if (progress.reward_issued) {
    return { already_completed: true, completion_number: progress.completion_number };
  }

  const rewardType = deriveRewardType(task);
  const pointsToIssue = (rewardType === "points" || rewardType === "points_xp") ? (task.points_reward || 0) : 0;
  const xpToIssue = (rewardType === "xp" || rewardType === "points_xp") ? (task.xp_reward || 0) : 0;

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