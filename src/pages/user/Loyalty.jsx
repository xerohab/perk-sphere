import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/perk/PageHeader";
import RankBadge from "@/components/perk/RankBadge";
import ResponsiveTable from "@/components/perk/ResponsiveTable";

export default function Loyalty() {
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [xpTxns, setXpTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [l, x] = await Promise.all([
          base44.entities.LoyaltyLevel.list('-minimum_xp', 50),
          base44.entities.XpTransaction.filter({ user_id: user?.id })
        ]);
        setLevels((l || []).filter((x) => x.active !== false).sort((a, b) => (a.minimum_xp || 0) - (b.minimum_xp || 0)));
        setXpTxns((x || []).sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const xp = user?.loyalty_xp || 0;
  const currentIdx = levels.findIndex((l) => l.name === user?.loyalty_rank);
  const xpCols = [
    { key: "created_date", label: "Date", render: (t) => new Date(t.created_date).toLocaleString() },
    { key: "reason", label: "Reason", render: (t) => t.reason || "—" },
    { key: "xp_amount", label: "XP", align: "right", render: (t) => <span className={t.xp_amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{t.xp_amount >= 0 ? "+" : ""}{t.xp_amount}</span> }
  ];

  return (
    <div>
      <PageHeader title="Loyalty Programme" description="Your Loyalty XP is separate from redeemable points and determines your rank" />
      <div className="rounded-2xl border border-border bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm dark:from-violet-950/20 dark:to-background">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-violet-700 dark:text-violet-400">Current Rank</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-3xl font-bold text-violet-900 dark:text-violet-300">{user?.loyalty_rank || "Bronze"}</span>
              <RankBadge rank={user?.loyalty_rank || "Bronze"} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-violet-700 dark:text-violet-400">Total XP</p>
            <p className="text-3xl font-bold text-violet-900 dark:text-violet-300">{xp.toLocaleString()} XP</p>
          </div>
        </div>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold">Loyalty Levels</h3>
      <div className="space-y-3">
        {levels.map((l, i) => {
          const achieved = xp >= (l.minimum_xp || 0);
          const isCurrent = i === currentIdx;
          return (
            <div key={l.id} className={`rounded-2xl border p-4 ${isCurrent ? "border-violet-300 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-950/20" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RankBadge rank={l.name} />
                  {isCurrent && <span className="text-xs font-medium text-violet-700 dark:text-violet-400">Current</span>}
                </div>
                <span className="text-sm font-semibold">{(l.minimum_xp || 0).toLocaleString()} XP</span>
              </div>
              {l.description && <p className="mt-2 text-xs text-muted-foreground">{l.description}</p>}
              {achieved && !isCurrent && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Achieved</p>}
            </div>
          );
        })}
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold">Recent XP Transactions</h3>
      <ResponsiveTable columns={xpCols} rows={xpTxns} emptyTitle="No XP earned yet" />
    </div>
  );
}