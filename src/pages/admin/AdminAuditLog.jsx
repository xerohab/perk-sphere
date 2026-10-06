import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";

export default function AdminAuditLog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const a = await base44.entities.AuditLog.list('-created_date', 500);
        setItems(a || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Audit Log" description={`${items.length} recorded admin actions — immutable history`} />
      {items.length === 0 ? (
        <EmptyState title="No audit entries" description="Administrative actions will be recorded here." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Previous</th>
                <th className="px-4 py-3 font-medium">New</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(a.created_date).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{a.admin_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium capitalize">{a.action?.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.entity_type} {a.entity_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.previous_values ? JSON.stringify(a.previous_values).slice(0, 60) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.new_values ? JSON.stringify(a.new_values).slice(0, 60) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}