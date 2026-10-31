import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Globe, Share2, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";

export default function Earn() {
  const [sites, setSites] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await base44.functions.invoke("publicDestinations", {});
      const data = res.data || res;
      if (!Array.isArray(data.destinations)) throw Error("Invalid directory response");
      const dests = data.destinations.filter(d => d.eligibility === "allowed");
      setSites(dests.filter(d => d.kind === "website"));
      setAccounts(dests.filter(d => d.kind === "account"));
    } catch { setSites([]); setAccounts([]); setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Earn Points" description="Choose an activity and check its reward and completion rules." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {to:"/dashboard",title:"Daily check-in",text:"Claim 1 Point per UTC day on the dashboard. Each full UTC day without a signed-in site visit deducts 1 Point when you return, down to zero. Tracking starts at your first visit under this policy; earlier absences are not charged."},
          {to:"/partner-accounts",title:"Link partner accounts",text:"Connect your account and claim an available one-time link reward."},
          {to:"/connected-services",title:"Connect X or YouTube",text:"Manage your account connection. Social linking reward claims are currently paused."},
          {to:"/tasks",title:"Complete partner tasks",text:"Choose a supported task and complete it on the partner site."},
          {to:"/games",title:"Play Perk Sphere games",text:"Earn from eligible game sessions, subject to each game's daily limit."}
        ].map(item=><Link key={item.to} to={item.to} className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:bg-secondary/50"><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.text}</p></Link>)}
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl border p-4">The destination directory is temporarily unavailable. <button type="button" className="underline" onClick={load}>Retry</button></p>}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-300">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>Rewards require a supported, enabled activity and verified completion. An allowed listing or a page visit alone does not guarantee Points or XP. Partner tasks use the partner’s own verification; the browser extension is only needed for activities that explicitly require it. YouTube viewing, likes and follows do not currently earn rewards.</p>
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

      <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold"><Share2 className="h-4 w-4" /> Participating Social Accounts</h3>
      {accounts.length === 0 ? (
        <EmptyState title="No participating social accounts" description="Eligible social listings will appear here. A listing does not verify engagement or guarantee rewards." />
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