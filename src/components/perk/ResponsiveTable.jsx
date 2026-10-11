import React from "react";
import EmptyState from "@/components/perk/EmptyState";

// Table on desktop, stacked cards on mobile. Columns: { key, label, render?, align?, mono? }.
export default function ResponsiveTable({ columns, rows, emptyTitle = undefined, emptyDescription = undefined, rowKey = "id" }) {
  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle || "No records"} description={emptyDescription} />;
  }
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row[rowKey] || row.id} className="hover:bg-secondary/30">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""} ${c.mono ? "font-mono text-xs" : ""}`}>
                    {c.render ? c.render(row) : (row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <div key={row[rowKey] || row.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            {columns.map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</span>
                <span className={`text-right text-sm ${c.mono ? "font-mono text-xs" : ""}`}>
                  {c.render ? c.render(row) : (row[c.key] ?? "—")}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
