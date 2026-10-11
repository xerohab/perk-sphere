import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/perk/PageHeader";
import ResponsiveTable from "@/components/perk/ResponsiveTable";

const TYPE_LABEL = {
  earned: "Earned", manual_credit: "Admin Credit", manual_deduction: "Admin Deduction",
  redemption: "Redemption", refund: "Refund", promotion: "Promotion",
  correction: "Correction", expired: "Expired", other: "Other"
};

export default function PointsHistory() {
  const { user } = useAuth();
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await base44.entities.PointsTransaction.filter({ user_id: user?.id });
        setTxns((t || []).sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const cols = [
    { key: "created_date", label: "Date", render: (t) => new Date(t.created_date).toLocaleString() },
    { key: "transaction_type", label: "Type", render: (t) => <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{TYPE_LABEL[t.transaction_type] || t.transaction_type}</span> },
    { key: "reason", label: "Reason", render: (t) => t.reason || "—" },
    { key: "amount", label: "Amount", align: "right", render: (t) => <span className={t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{t.amount >= 0 ? "+" : ""}{t.amount}</span> },
    { key: "balance_after", label: "Balance", align: "right", render: (t) => t.balance_after?.toLocaleString() }
  ];

  return (
    <div>
      <PageHeader title="Points History" description="Your complete redeemable points ledger" />
      <ResponsiveTable columns={cols} rows={txns} emptyTitle="No points transactions" emptyDescription="Points you earn and spend will be recorded here." />
    </div>
  );
}
