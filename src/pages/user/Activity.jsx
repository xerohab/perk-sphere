import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import EmptyState from "@/components/perk/EmptyState";
import PullToRefresh from "@/components/perk/PullToRefresh";

export default function Activity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const a = await base44.entities.Activity.list('-created_date', 100);
      setItems(a || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div>
        <PageHeader title="Activity History" description="All activity recorded from connected services and devices" />
        {items.length === 0 ? (
          <EmptyState title="No activity recorded" description="Activity from the browser extension and connected services will appear here." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:block">
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

            {/* Mobile card list */}
            <div className="space-y-3 sm:hidden">
              {items.map((a) => (
                <div key={a.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium capitalize">{a.platform}</p>
                      <p className="text-xs capitalize text-muted-foreground">{a.activity_type?.replace(/_/g, " ")}</p>
                    </div>
                    <StatusBadge status={a.verification_status} />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>{a.target_account || a.target || "—"}</p>
                    <p className="mt-0.5">{new Date(a.created_date).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PullToRefresh>
  );
}