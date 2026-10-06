import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/perk/PageHeader";
import ProgressBar from "@/components/perk/ProgressBar";
import RankBadge from "@/components/perk/RankBadge";

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
          base44.entities.XpTransaction.list('-created_date', 50)
        ]);
        setLevels((l || []).filter((x) => x.active !== false).sort((a, b) => (a.minimum_xp || 0) - (b.minimum_xp || 0)));
        setXpTxns(x || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const xp = user?.loyalty_xp || 0;
  const currentIdx = levels.findIndex((l) => l.name === user?.loyalty_rank);

  return (
    <div>
      <PageHeader title="Loyalty Programme" description="Your Loyalty XP is separate from redeemable points and determines your rank" />
      <div className="rounded-2xl border border-border bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-violet-700">Current Rank</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-3xl font-bold text-violet-900">{user?.loyalty_rank || "Bronze"}</span>
              <RankBadge rank={user?.loyalty_rank || "Bronze"} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-violet-700">Total XP</p>
            <p className="text-3xl font-bold text-violet-900">{xp.toLocaleString()} XP</p>
          </div>
        </div>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold">Loyalty Levels</h3>
      <div className="space-y-3">
        {levels.map((l, i) => {
          const achieved = xp >= (l.minimum_xp || 0);
          const isCurrent = i === currentIdx;
          const prev = i > 0 ? levels[i - 1].minimum_xp : 0;
          return (
            <div key={l.id} className={`rounded-2xl border p-4 ${isCurrent ? "border-violet-300 bg-violet-50" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RankBadge rank={l.name} />
                  {isCurrent && <span className="text-xs font-medium text-violet-700">Current</span>}
                </div>
                <span className="text-sm font-semibold">{(l.minimum_xp || 0).toLocaleString()} XP</span>
              </div>
              {l.description && <p className="mt-2 text-xs text-muted-foreground">{l.description}</p>}
              {achieved && !isCurrent && <p className="mt-1 text-xs text-emerald-600">Achieved</p>}
            </div>
          );
        })}
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold">Recent XP Transactions</h3>
      {xpTxns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No XP earned yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 text-right font-medium">XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {xpTxns.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.created_date).toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.reason || "—"}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.xp_amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{t.xp_amount >= 0 ? "+" : ""}{t.xp_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}