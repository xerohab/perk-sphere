// Frontend helpers for the Tasks system — mirrors the shared tasks module for display.
export function formatSeconds(s) {
  if (!s || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDuration(ms) {
  if (!ms || ms <= 0) return "0m";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const TASK_TYPES = [
  { value: "visit_website", label: "Visit Website" },
  { value: "visit_page", label: "Visit Page" },
  { value: "watch_video", label: "Watch Video" },
  { value: "live_stream", label: "Watch Live Stream" },
  { value: "spend_time", label: "Spend Time on Site" },
  { value: "daily_visit", label: "Daily Visit" },
  { value: "complete_activity", label: "Complete Activity" },
  { value: "campaign_task", label: "Campaign Task" },
  { value: "custom", label: "Custom Task" }
];

export const COMPLETION_LIMITS = [
  { value: "once_ever", label: "Once Ever" },
  { value: "once_daily", label: "Once Per Day" },
  { value: "once_weekly", label: "Once Per Week" },
  { value: "once_campaign", label: "Once Per Campaign" },
  { value: "unlimited", label: "Unlimited (with cooldown)" },
  { value: "custom_max", label: "Custom Maximum" }
];

export const REWARD_TYPES = [
  { value: "none", label: "No Reward (Informational)" },
  { value: "points", label: "Points Only" },
  { value: "xp", label: "XP Only" },
  { value: "points_xp", label: "Points + XP" },
  { value: "achievement", label: "Achievement" }
];

export const VERIFICATION_MODES = [
  { value: "client_assisted", label: "Client-Assisted (default)" },
  { value: "trusted_automatic", label: "Trusted Automatic (Linux API)" },
  { value: "manual", label: "Manual (Admin only)" }
];

export const COMPLETION_MODES = [
  { value: "fixed_duration", label: "Fixed Viewing Duration" },
  { value: "until_broadcast_end", label: "Watch Until Broadcast Ends" },
  { value: "duration_plus_end", label: "Minimum Duration + Broadcast End" }
];

export const BROADCAST_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "ended", label: "Ended" },
  { value: "cancelled", label: "Cancelled" }
];

export function isTrustedProgress(progress) {
  if (!progress) return false;
  return progress.source === "trusted_bridge" || progress.source === "trusted_automatic" || progress.verification_status === "verified" && progress.source !== "user_started";
}