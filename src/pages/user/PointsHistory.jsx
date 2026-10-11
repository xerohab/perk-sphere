import React from "react";
import {useMemberWallet,formatWalletInteger} from "@/hooks/useMemberWallet";
import PageHeader from "@/components/perk/PageHeader";
import ResponsiveTable from "@/components/perk/ResponsiveTable";

const TYPE_LABEL = {
  earned: "Earned", manual_credit: "Admin Credit", manual_deduction: "Admin Deduction",
  redemption: "Redemption", refund: "Refund", promotion: "Promotion",
  correction: "Correction", expired: "Expired", other: "Other"
};

export default function PointsHistory() {
  const {wallet,error,loading,refresh}=useMemberWallet();
  const txns=wallet?.points || [];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const cols = [
    { key: "created_date", label: "Date", render: (t) => new Date(t.created_date).toLocaleString() },
    { key: "transaction_type", label: "Type", render: (t) => <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{TYPE_LABEL[t.transaction_type] || t.transaction_type}</span> },
    { key: "reason", label: "Reason", render: (t) => t.reason || "—" },
    { key: "amount", label: "Amount", align: "right", render: (t) => <span className={t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{t.amount >= 0 ? "+" : ""}{t.amount}</span> },
    { key: "balance_after", label: "Balance", align: "right", render: (t) => t.balance_after == null ? "—" : formatWalletInteger(t.balance_after) }
  ];

  return (
    <div>
      <PageHeader title="Points History" description="Recent redeemable points operations, up to 100" />
      {error ? <p role="alert">{error} <button type="button" className="underline" onClick={refresh}>Retry</button></p> : <ResponsiveTable columns={cols} rows={txns} emptyTitle="No points transactions" emptyDescription="Points you earn and spend will be recorded here." />}
    </div>
  );
}
