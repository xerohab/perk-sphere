import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import ResponsiveTable from "@/components/perk/ResponsiveTable";

export default function AdminAuditLog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const a = await base44.entities.AuditLog.list('-created_date', 500);
        setItems(a || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cols = [
    { key: "created_date", label: "Date", render: (a) => new Date(a.created_date).toLocaleString() },
    { key: "admin_id", label: "Admin", mono: true, render: (a) => a.admin_id?.slice(0, 8) },
    { key: "action", label: "Action", render: (a) => <span className="font-medium capitalize">{a.action?.replace(/_/g, " ")}</span> },
    { key: "entity_type", label: "Entity", render: (a) => `${a.entity_type} ${a.entity_id?.slice(0, 8) || ""}` },
    { key: "previous_values", label: "Previous", render: (a) => a.previous_values ? JSON.stringify(a.previous_values).slice(0, 60) : "—" },
    { key: "new_values", label: "New", render: (a) => a.new_values ? JSON.stringify(a.new_values).slice(0, 60) : "—" }
  ];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Audit Log" description={`${items.length} recorded admin actions — immutable history`} />
      <ResponsiveTable columns={cols} rows={items} emptyTitle="No audit entries" emptyDescription="Administrative actions will be recorded here." />
    </div>
  );
}