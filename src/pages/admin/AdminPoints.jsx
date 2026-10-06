import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";

const TYPE_LABEL = {
  earned: "Earned", manual_credit: "Admin Credit", manual_deduction: "Admin Deduction",
  redemption: "Redemption", refund: "Refund", promotion: "Promotion",
  correction: "Correction", expired: "Expired", other: "Other"
};

export default function AdminPoints() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await base44.entities.PointsTransaction.list('-created_date', 500);
        setTxns(t || []);
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
      <PageHeader title="Points Ledger" description={`${txns.length} transactions — complete audit history of all points`} />
      {txns.length === 0 ? (
        <EmptyState title="No transactions" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Before</th>
                <th className="px-4 py-3 text-right font-medium">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {txns.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.created_date).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.user_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{TYPE_LABEL[t.transaction_type] || t.transaction_type}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{t.reason || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.source || "—"}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{t.amount >= 0 ? "+" : ""}{t.amount}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{t.balance_before}</td>
                  <td className="px-4 py-3 text-right font-medium">{t.balance_after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}