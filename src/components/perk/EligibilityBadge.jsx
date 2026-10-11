import React from "react";
import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CONFIG = {
  allowed: {
    label: "Allowed",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    Icon: Check
  },
  neutral: {
    label: "Neutral",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    Icon: Minus
  },
  disallowed: {
    label: "Disallowed",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    Icon: X
  }
};

export default function EligibilityBadge({ eligibility, className = undefined, showIcon = true }) {
  const cfg = CONFIG[eligibility] || CONFIG.neutral;
  const Icon = cfg.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.className, className)}>
      {showIcon && <Icon className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}
