import React, { useEffect, useState } from "react";
import { Globe, Share2, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";

export default function Earn() {
  const [sites, setSites] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("publicDestinations", {});
        const data = res.data || res;
        const dests = (data.destinations || []).filter((d) => d.eligibility !== "disallowed");
        setSites(dests.filter((d) => d.kind === "website"));
        setAccounts(dests.filter((d) => d.kind === "account"));
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
      <PageHeader title="Earn Points" description="Participating websites and tracked accounts where you can earn rewards" />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-300">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>Earning is handled by the Perk Sphere browser extension and verified activity API. Install the extension and visit eligible sites to earn automatically. Manual point awards are not available from this page.</p>
      </div>

      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4" /> Participating Websites</h3>
      {sites.length === 0 ? (
        <EmptyState title="No participating websites" description="Administrators can add eligible websites here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground"><Globe className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.domain}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {s.points_eligible && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">Points eligible</span>}
                {s.xp_eligible && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">XP eligible</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold"><Share2 className="h-4 w-4" /> Tracked Social Accounts</h3>
      {accounts.length === 0 ? (
        <EmptyState title="No tracked accounts" description="Social accounts tracked by Perk Sphere will appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.platform} · {a.handle || a.type_label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}