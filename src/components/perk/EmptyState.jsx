import React from "react";
import { Inbox } from "lucide-react";

export default function EmptyState({ title, description = undefined }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="rounded-full bg-secondary p-3 text-muted-foreground">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
