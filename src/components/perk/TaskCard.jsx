import React from "react";
import { Link } from "react-router-dom";
import { Globe, FileText, Play, Radio, Clock, CalendarCheck, CheckSquare, Megaphone, Sparkles, Gift, TrendingUp, Award, Check, Lock, Timer, BadgeCheck, Puzzle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import ProgressBar from "@/components/perk/ProgressBar";
import { Button } from "@/components/ui/button";
import { formatSeconds, isTrustedProgress } from "@/lib/task-utils";

const TYPE_ICON = {
  visit_website: Globe, visit_page: FileText, watch_video: Play, live_stream: Radio,
  spend_time: Clock, daily_visit: CalendarCheck, complete_activity: CheckSquare,
  campaign_task: Megaphone, custom: Sparkles
};
const TYPE_LABEL = {
  visit_website: "Visit Website", visit_page: "Visit Page", watch_video: "Watch Video",
  live_stream: "Live Stream", spend_time: "Spend Time", daily_visit: "Daily Visit",
  complete_activity: "Complete Activity", campaign_task: "Campaign Task", custom: "Custom Task"
};

export default function TaskCard({ task, progress = undefined, onStart = undefined, onComplete = undefined, starting = false, completing = false, isAuthed = false, onSignIn = undefined }) {
  const Icon = TYPE_ICON[task.task_type] || Sparkles;
  const status = progress?.status || "not_started";
  const eligible = progress?.eligible_seconds || 0;
  const required = task.required_seconds || 0;
  const pct = progress?.progress_percentage || (status === "completed" ? 100 : 0);
  const isViewing = ["watch_video", "live_stream", "spend_time"].includes(task.task_type);
  const viewingReady = isViewing && required > 0 && eligible >= required;
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";
  const isVerified = isTrustedProgress(progress);
  const pointsR = task.points_reward || 0;
  const xpR = task.xp_reward || 0;
  const hasReward = pointsR > 0 || xpR > 0 || task.achievement_id;

  // Time remaining
  const now = new Date();
  let remaining = null;
  if (task.available_until) remaining = new Date(task.available_until).getTime() - now.getTime();
  else if (task.task_type === "live_stream" && task.event_end) remaining = new Date(task.event_end).getTime() - now.getTime();
  const isExpired = remaining !== null && remaining <= 0;
  const isUpcoming = (task.available_from && new Date(task.available_from) > now) || (task.task_type === "live_stream" && task.event_start && new Date(task.event_start) > now);
  const partnerVerified = task.reward_processing === "linux_partner";

  const handleStart = () => (isAuthed ? onStart?.() : onSignIn?.());

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md", isCompleted ? "border-emerald-200 dark:border-emerald-500/30" : "border-border")}>
      <div className="flex h-28 items-center justify-center bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/15 dark:to-violet-500/15">
        {task.image ? <img src={task.image} alt={task.name} className="h-full w-full object-cover" /> : <Icon className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{task.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{TYPE_LABEL[task.task_type] || task.task_type}</p>
          </div>
          {task.destination_name && (
            <span className="flex-shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{task.destination_name}</span>
          )}
        </div>
        {task.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>}

        {/* Rewards */}
        {hasReward && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pointsR > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400"><Gift className="h-3 w-3" /> {pointsR} pts</span>}
            {xpR > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><TrendingUp className="h-3 w-3" /> {xpR} XP</span>}
            {task.achievement_id && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-400"><Award className="h-3 w-3" /> Achievement</span>}
          </div>
        )}

        {/* Viewing requirement */}
        {isViewing && required > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="h-3 w-3" /> Watch {formatSeconds(required)} {task.required_percentage ? `(${task.required_percentage}%)` : ""}
          </p>
        )}

        {/* Live stream completion mode */}
        {task.task_type === "live_stream" && task.completion_mode && task.completion_mode !== "fixed_duration" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Radio className="h-3 w-3" />
            {task.completion_mode === "until_broadcast_end" ? "Watch until broadcast ends" : "Min duration + broadcast end"}
            {task.max_credited_seconds > 0 && ` · max ${formatSeconds(task.max_credited_seconds)}`}
          </p>
        )}

        {/* Progress */}
        {isInProgress && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <ProgressBar value={pct} max={100} className={cn(pct >= 75 && !isCompleted && "ring-2 ring-emerald-400/50")} />
            {isViewing && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {formatSeconds(eligible)} / {formatSeconds(required)}
              {isVerified && <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-3 w-3" /> verified</span>}
            </p>}
          </div>
        )}

        {/* Completed */}
        {isCompleted && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Check className="h-4 w-4" /> Completed
            {hasReward && <span className="text-xs">· {progress?.points_issued > 0 ? `${progress.points_issued} pts ` : ""}{progress?.xp_issued > 0 ? `${progress.xp_issued} XP` : ""}</span>}
          </div>
        )}

        {/* Time remaining */}
        {remaining !== null && !isCompleted && (
          <p className={cn("mt-3 text-xs", isExpired ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
            {isExpired ? "Expired" : `Ends in ${Math.floor(remaining / 86400000)}d ${Math.floor((remaining % 86400000) / 3600000)}h`}
          </p>
        )}

        {/* Action */}
        <div className="mt-4">
          {isCompleted ? (
            <div className="flex items-center justify-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" /> Completed</div>
          ) : isExpired ? (
            <Button variant="outline" disabled className="w-full">Expired</Button>
          ) : isUpcoming ? (
            <Button variant="outline" disabled className="w-full">Not started yet</Button>
          ) : (task.verification_mode === "trusted_automatic") ? (
            <div className="space-y-2">
              {!isInProgress && (
                <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  {partnerVerified ? <BadgeCheck className="h-3.5 w-3.5" /> : <Puzzle className="h-3.5 w-3.5" />}
                  {partnerVerified ? "Verified partner activity required" : "Browser extension required"}
                  <Link to={partnerVerified ? "/connections" : "/dashboard"} className="ml-auto font-medium underline hover:text-indigo-700 dark:hover:text-indigo-300">{partnerVerified ? "Accounts" : "Install"}</Link>
                </div>
              )}
              {isInProgress && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verification in progress
                </div>
              )}
              {task.content_url && (
                <a href={task.content_url} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                  <ExternalLink className="h-4 w-4" /> Open content
                </a>
              )}
            </div>
          ) : !isAuthed ? (
            <Button className="w-full" onClick={handleStart}>Sign in to start</Button>
          ) : (!isInProgress && typeof onStart !== "function") || (isInProgress && typeof onComplete !== "function") ? (
            <Link to="/tasks" className="flex w-full items-center justify-center rounded-md border px-3 py-2 text-sm font-medium">View task</Link>
          ) : !isInProgress ? (
            <Button className="w-full" onClick={handleStart} disabled={starting}>
              {starting ? "Starting..." : "Start Task"}
            </Button>
          ) : isViewing && !viewingReady ? (
            <Button variant="outline" className="w-full" disabled title="Tracking client required to verify viewing">
              <Lock className="mr-1 h-3.5 w-3.5" /> Tracking in progress
            </Button>
          ) : (
            <Button className="w-full" onClick={onComplete} disabled={completing}>
              {completing ? "Completing..." : "Complete Task"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
