import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({ label, value, sublabel = undefined, icon: Icon = undefined, accent = undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("mt-2 text-2xl font-semibold tracking-tight", accent)}>{value}</p>
          {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        {Icon && (
          <div className="rounded-xl bg-secondary p-2.5 text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
