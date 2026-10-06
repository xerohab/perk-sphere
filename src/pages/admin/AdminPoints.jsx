import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import ResponsiveTable from "@/components/perk/ResponsiveTable";

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

  const cols = [
    { key: "created_date", label: "Date", render: (t) => new Date(t.created_date).toLocaleString() },
    { key: "user_id", label: "User", mono: true, render: (t) => t.user_id?.slice(0, 8) },
    { key: "transaction_type", label: "Type", render: (t) => <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{TYPE_LABEL[t.transaction_type] || t.transaction_type}</span> },
    { key: "reason", label: "Reason", render: (t) => t.reason || "—" },
    { key: "source", label: "Source", render: (t) => t.source || "—" },
    { key: "amount", label: "Amount", align: "right", render: (t) => <span className={t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{t.amount >= 0 ? "+" : ""}{t.amount}</span> },
    { key: "balance_before", label: "Before", align: "right", render: (t) => t.balance_before },
    { key: "balance_after", label: "After", align: "right", render: (t) => <span className="font-medium">{t.balance_after}</span> }
  ];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Points Ledger" description={`${txns.length} transactions — complete audit history of all points`} />
      <ResponsiveTable columns={cols} rows={txns} emptyTitle="No transactions" />
    </div>
  );
}