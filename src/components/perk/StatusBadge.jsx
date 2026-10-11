import React from "react";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  restricted: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  suspended: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  banned: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  fulfilled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  refunded: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  connected: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  disconnected: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  not_configured: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  processed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  cleared: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  reviewing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  escalated: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  admin: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400"
};

export default function StatusBadge({ status, className = undefined }) {
  const style = STATUS_STYLES[status] || "bg-secondary text-secondary-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", style, className)}>
      {String(status || "").replace(/_/g, " ")}
    </span>
  );
}
