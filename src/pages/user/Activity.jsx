import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";

export default function Activity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const a = await base44.entities.Activity.list('-created_date', 100);
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
      <PageHeader title="Activity History" description="All activity recorded from connected services and devices" />
      {items.length === 0 ? (
        <EmptyState title="No activity recorded" description="Activity from the browser extension and connected services will appear here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium capitalize">{a.platform}</td>
                  <td className="px-4 py-3 capitalize">{a.activity_type?.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.target_account || a.target || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(a.created_date).toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.verification_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}