import React from "react";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700",
  restricted: "bg-amber-100 text-amber-700",
  suspended: "bg-orange-100 text-orange-700",
  banned: "bg-red-100 text-red-700",
  pending: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  fulfilled: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
  refunded: "bg-violet-100 text-violet-700",
  connected: "bg-emerald-100 text-emerald-700",
  disconnected: "bg-slate-100 text-slate-600",
  not_configured: "bg-slate-100 text-slate-500",
  processed: "bg-emerald-100 text-emerald-700",
  cleared: "bg-emerald-100 text-emerald-700",
  reviewing: "bg-blue-100 text-blue-700",
  escalated: "bg-red-100 text-red-700"
};

export default function StatusBadge({ status, className }) {
  const style = STATUS_STYLES[status] || "bg-secondary text-secondary-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", style, className)}>
      {String(status || "").replace(/_/g, " ")}
    </span>
  );
}