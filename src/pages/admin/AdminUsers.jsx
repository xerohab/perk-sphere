import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import RankBadge from "@/components/perk/RankBadge";
import ResponsiveTable from "@/components/perk/ResponsiveTable";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/perk/EmptyState";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.entities.User.list('-created_date', 500);
        setUsers(u || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = users.filter((u) => {
    if (!q) return true;
    const term = q.toLowerCase();
    return (u.email || "").toLowerCase().includes(term) || (u.username || "").toLowerCase().includes(term) || (u.display_name || "").toLowerCase().includes(term);
  });

  const cols = [
    { key: "email", label: "User", render: (u) => (<div><p className="font-medium">{u.display_name || u.username || u.email}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>) },
    { key: "account_status", label: "Status", render: (u) => <StatusBadge status={u.account_status || "active"} /> },
    { key: "loyalty_rank", label: "Rank", render: (u) => <RankBadge rank={u.loyalty_rank || "Bronze"} /> },
    { key: "points_balance", label: "Points", align: "right", render: (u) => (u.points_balance || 0).toLocaleString() },
    { key: "loyalty_xp", label: "XP", align: "right", render: (u) => (u.loyalty_xp || 0).toLocaleString() },
    { key: "created_date", label: "Joined", render: (u) => u.created_date ? new Date(u.created_date).toLocaleDateString() : "—" },
    { key: "_action", label: "", align: "right", render: (u) => <Link to={`/admin/users/${u.id}`} className="inline-flex items-center text-indigo-600 hover:underline dark:text-indigo-400">Manage <ChevronRight className="h-4 w-4" /></Link> }
  ];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Users" description={`${users.length} registered users`} />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email..." className="pl-9" />
      </div>
      {filtered.length === 0 ? <EmptyState title="No users found" /> : <ResponsiveTable columns={cols} rows={filtered} />}
    </div>
  );
}