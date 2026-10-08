// Shared task logic used by startTask, recordTaskEvent, completeTask, manageTask.
// Pure functions (no I/O) so they can be reasoned about and unit-tested.

export function isViewingTask(task) {
  if (!task) return false;
  return ['watch_video', 'live_stream', 'spend_time'].includes(task.task_type);
}

export function isLiveStreamTask(task) {
  return task && task.task_type === 'live_stream';
}

export function isTaskAvailable(task, now = new Date()) {
  if (!task || task.active === false || task.archived) return false;
  if (task.available_from && new Date(task.available_from) > now) return false;
  if (task.available_until && new Date(task.available_until) < now) return false;
  return true;
}

export function isEventWindowOpen(task, now = new Date()) {
  if (!isLiveStreamTask(task)) return true;
  if (task.event_start && new Date(task.event_start) > now) return false;
  if (task.event_end && new Date(task.event_end) < now) return false;
  return true;
}

export function requiredSecondsFor(task) {
  return (task && task.required_seconds) || 0;
}

// Effective required seconds, capped by max_credited_seconds for live streams.
// Reaching the cap does NOT prove the broadcast ended — it only limits credited time.
export function effectiveRequiredSeconds(task) {
  const req = requiredSecondsFor(task);
  if (isLiveStreamTask(task) && task.max_credited_seconds > 0) {
    return Math.min(req, task.max_credited_seconds);
  }
  return req;
}

// Whether a live stream task requires a broadcast-end event for completion.
export function requiresBroadcastEnd(task) {
  if (!isLiveStreamTask(task)) return false;
  const mode = task.completion_mode || 'fixed_duration';
  return mode === 'until_broadcast_end' || mode === 'duration_plus_end';
}

// Whether a live stream task requires a minimum verified duration for completion.
export function requiresMinDuration(task) {
  if (!isLiveStreamTask(task)) return false;
  const mode = task.completion_mode || 'fixed_duration';
  return mode === 'fixed_duration' || mode === 'duration_plus_end';
}

// Check if the live stream completion criteria are met given eligible seconds
// and whether a verified broadcast-end event has been received.
export function isLiveStreamCompletionReady(task, aggregateEligible, broadcastEnded) {
  if (!isLiveStreamTask(task)) return true; // non-live-stream tasks don't use this
  const mode = task.completion_mode || 'fixed_duration';
  const req = effectiveRequiredSeconds(task);
  const durationMet = req > 0 ? aggregateEligible >= req : true;
  if (mode === 'fixed_duration') return durationMet;
  if (mode === 'until_broadcast_end') return broadcastEnded && durationMet;
  if (mode === 'duration_plus_end') return durationMet && broadcastEnded;
  return false;
}

export function deriveRewardType(task) {
  if (!task) return 'none';
  if (task.reward_type && task.reward_type !== 'none') return task.reward_type;
  const hasP = (task.points_reward || 0) > 0;
  const hasX = (task.xp_reward || 0) > 0;
  const hasA = !!task.achievement_id;
  if (hasP && hasX) return 'points_xp';
  if (hasP) return 'points';
  if (hasX) return 'xp';
  if (hasA) return 'achievement';
  return 'none';
}

// Start of the current completion period for repeatable tasks.
export function periodStart(limitType, now = new Date()) {
  if (limitType === 'once_daily') {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
  }
  if (limitType === 'once_weekly') {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - (day - 1)); // Monday start
    return d;
  }
  return null;
}

// Given existing completed progress records for this user+task, can they complete again?
export function canCompleteAgain(task, completedRecords, now = new Date()) {
  const limit = (task && task.completion_limit_type) || 'once_ever';
  if (limit === 'unlimited') return { ok: true };
  if (limit === 'once_ever') {
    if (completedRecords.length > 0) return { ok: false, reason: 'This task can only be completed once.' };
    return { ok: true };
  }
  if (limit === 'custom_max') {
    if ((task.max_completions || 0) > 0 && completedRecords.length >= task.max_completions) {
      return { ok: false, reason: 'You have reached the maximum completions for this task.' };
    }
    return { ok: true };
  }
  if (limit === 'once_daily' || limit === 'once_weekly') {
    const ps = periodStart(limit, now);
    const inPeriod = completedRecords.filter((r) => r.completed_at && new Date(r.completed_at) >= ps);
    if (inPeriod.length > 0) return { ok: false, reason: limit === 'once_daily' ? 'Already completed today.' : 'Already completed this week.' };
    return { ok: true };
  }
  if (limit === 'once_campaign') {
    if (completedRecords.length > 0) return { ok: false, reason: 'Already completed for this campaign.' };
    return { ok: true };
  }
  return { ok: true };
}

export function isInCooldown(lastCompletedAt, cooldownSeconds, now = new Date()) {
  if (!lastCompletedAt || !cooldownSeconds) return false;
  const elapsed = (now - new Date(lastCompletedAt)) / 1000;
  return elapsed < cooldownSeconds;
}

export function progressPercentage(progress, task) {
  const req = requiredSecondsFor(task);
  if (req <= 0) {
    return progress && progress.status === 'completed' ? 100 : 0;
  }
  return Math.min(100, Math.round(((progress && progress.eligible_seconds) || 0) / req * 100));
}

export function timeRemaining(task, now = new Date()) {
  if (task.available_until) {
    const ms = new Date(task.available_until) - now;
    if (ms <= 0) return null;
    return ms;
  }
  if (isLiveStreamTask(task) && task.event_end) {
    const ms = new Date(task.event_end) - now;
    if (ms <= 0) return null;
    return ms;
  }
  return null;
}

export function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatSeconds(s) {
  if (!s || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}