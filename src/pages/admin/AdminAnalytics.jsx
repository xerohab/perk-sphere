import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PageHeader from "@/components/perk/PageHeader";
import StatCard from "@/components/perk/StatCard";
import { Users, Coins, Activity, Gift } from "lucide-react";

export default function AdminAnalytics() {
  const [data, setData] = useState({ users: [], points: [], activities: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [u, pt, a] = await Promise.all([
          base44.entities.User.list('-created_date', 1000),
          base44.entities.PointsTransaction.list('-created_date', 1000),
          base44.entities.Activity.list('-created_date', 1000)
        ]);
        setData({ users: u || [], points: pt || [], activities: a || [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  // Build last 7 days points earned chart
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const chartData = days.map((d) => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const earned = data.points
      .filter((t) => t.amount > 0 && new Date(t.created_date) >= d && new Date(t.created_date) < next)
      .reduce((s, t) => s + t.amount, 0);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), points: earned };
  });

  const platformCounts = {};
  data.activities.forEach((a) => {
    platformCounts[a.platform] = (platformCounts[a.platform] || 0) + 1;
  });
  const platformData = Object.entries(platformCounts).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <PageHeader title="Analytics" description="Platform activity trends" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={data.users.length} icon={Users} />
        <StatCard label="Points Earned (7d)" value={chartData.reduce((s, d) => s + d.points, 0)} icon={Coins} />
        <StatCard label="Activities" value={data.activities.length} icon={Activity} />
        <StatCard label="Avg Points/User" value={data.users.length ? Math.round(data.points.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0) / data.users.length) : 0} icon={Gift} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold">Points Earned (last 7 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="points" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold">Activity by Platform</h3>
          {platformData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}