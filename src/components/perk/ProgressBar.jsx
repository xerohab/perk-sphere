import React from "react";
import { cn } from "@/lib/utils";

export default function ProgressBar({ value, max, className }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
        style={{ width: pct + "%" }}
      />
    </div>
  );
}