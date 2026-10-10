import React from "react";
import { cn } from "@/lib/utils";

const RANK_STYLES = {
  Bronze: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
  Silver: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  Gold: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30",
  Platinum: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30",
  Diamond: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30"
};

export default function RankBadge({ rank, className = "" }) {
  const style = RANK_STYLES[rank] || "bg-secondary text-secondary-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", style, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {rank || "Bronze"}
    </span>
  );
}