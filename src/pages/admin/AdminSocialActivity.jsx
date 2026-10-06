import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import StatusBadge from "@/components/perk/StatusBadge";
import { Info } from "lucide-react";

export default function AdminSocialActivity() {
  const [accounts, setAccounts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, act] = await Promise.all([
          base44.entities.TrackedAccount.list('-created_date', 200),
          base44.entities.Activity.list('-created_date', 1000)
        ]);
        setAccounts((a || []).filter((x) => x.active !== false));
        setActivities(act || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const aggregate = (accountName) => {
    const relevant = activities.filter((x) => x.target_account === accountName || x.target === accountName);
    const byType = {};
    const users = new Set();
    relevant.forEach((x) => {
      const t = x.activity_type || "other";
      byType[t] = (byType[t] || 0) + 1;
      if (x.user_id) users.add(x.user_id);
    });
    return { byType, participants: users.size, total: relevant.length, records: relevant };
  };

  return (
    <div>
      <PageHeader title="Social Activity" description="Aggregated activity across tracked social accounts" />
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>Activity shown here is detected by the Perk Sphere browser extension. It is not official platform analytics from X, YouTube or any third party.</p>
      </div>
      {accounts.length === 0 ? (
        <EmptyState title="No tracked accounts" description="Add tracked accounts to see aggregated activity." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {accounts.map((a) => {
              const agg = aggregate(a.account_name);
              return (
                <button key={a.id} onClick={() => setSelected(a)} className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{a.account_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.platform} · {a.category}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{agg.participants} users · {agg.total} events</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {Object.entries(agg.byType).map(([type, n]) => (
                      <span key={type} className="rounded-full bg-secondary px-2.5 py-1 capitalize">{type.replace(/_/g, " ")}: {n}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            {selected ? (
              <>
                <h3 className="text-sm font-semibold">{selected.account_name}</h3>
                <p className="text-xs text-muted-foreground">Participating users: {aggregate(selected.account_name).participants}</p>
                <div className="mt-4 space-y-2">
                  {aggregate(selected.account_name).records.slice(0, 50).map((r) => (
                    <div key={r.id} className="flex items-center justify-between border-b border-border pb-2 text-sm">
                      <div>
                        <p className="capitalize">{r.activity_type?.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleString()}</p>
                      </div>
                      <StatusBadge status={r.verification_status} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select an account to view its activity breakdown.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}