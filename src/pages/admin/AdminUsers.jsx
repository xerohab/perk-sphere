import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import StatusBadge from "@/components/perk/StatusBadge";
import RankBadge from "@/components/perk/RankBadge";
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
    return (u.email || "").toLowerCase().includes(term) ||
      (u.username || "").toLowerCase().includes(term) ||
      (u.display_name || "").toLowerCase().includes(term);
  });

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
      {filtered.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 text-right font-medium">Points</th>
                <th className="px-4 py-3 text-right font-medium">XP</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.display_name || u.username || u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={u.account_status || "active"} /></td>
                  <td className="px-4 py-3"><RankBadge rank={u.loyalty_rank || "Bronze"} /></td>
                  <td className="px-4 py-3 text-right font-semibold">{(u.points_balance || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold">{(u.loyalty_xp || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.created_date ? new Date(u.created_date).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/users/${u.id}`} className="inline-flex items-center text-indigo-600 hover:underline">
                      Manage <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}