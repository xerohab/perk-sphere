import React, { useEffect, useState } from "react";
import { Users, Coins, TrendingUp, Gift, Activity, ShieldAlert, Megaphone, ClipboardCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import StatCard from "@/components/perk/StatCard";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("adminStats", {});
        setStats(res.data);
      } catch (e) {
        // fallback: still show structure
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const s = stats || {};

  return (
    <div>
      <PageHeader title="Admin Dashboard" description="Perk Sphere platform overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={s.totalUsers ?? "—"} icon={Users} />
        <StatCard label="Active Users" value={s.activeUsers ?? "—"} icon={Users} accent="text-emerald-600" />
        <StatCard label="Points Issued" value={(s.pointsIssued || 0).toLocaleString()} icon={Coins} />
        <StatCard label="Points Redeemed" value={(s.pointsRedeemed || 0).toLocaleString()} icon={Gift} />
        <StatCard label="Outstanding Points" value={(s.outstandingPoints || 0).toLocaleString()} icon={Coins} accent="text-indigo-600" />
        <StatCard label="XP Issued" value={(s.xpIssued || 0).toLocaleString()} icon={TrendingUp} accent="text-amber-600" />
        <StatCard label="Total Redemptions" value={s.totalRedemptions ?? "—"} icon={ClipboardCheck} />
        <StatCard label="Pending Redemptions" value={s.pendingRedemptions ?? "—"} icon={ClipboardCheck} accent="text-orange-600" />
        <StatCard label="Activity Volume" value={s.activityVolume ?? "—"} icon={Activity} />
        <StatCard label="Active Campaigns" value={s.activeCampaigns ?? "—"} icon={Megaphone} />
        <StatCard label="Pending Fraud Flags" value={s.pendingFraud ?? "—"} icon={ShieldAlert} accent="text-red-600" />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold">Platform Health</h3>
        <p className="mt-2 text-sm text-muted-foreground">Use the navigation to manage users, points, rewards, sites, tracked accounts, rules, campaigns and system settings. All sensitive balance changes are processed server-side and recorded in the audit log.</p>
      </div>
    </div>
  );
}