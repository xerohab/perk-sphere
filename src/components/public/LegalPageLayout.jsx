import React from "react";
import { Shield } from "lucide-react";

export default function LegalPageLayout({ title, subtitle, lastUpdated, children }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{subtitle}</p>}
        {lastUpdated && (
          <p className="mt-4 text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
        )}
      </div>
      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {children}
      </div>
    </div>
  );
}