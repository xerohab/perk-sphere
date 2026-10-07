import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, CheckCheck } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/perk/EmptyState";
import PullToRefresh from "@/components/perk/PullToRefresh";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const n = await base44.entities.Notification.list('-created_date', 100);
      setItems(n || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.read);
    if (unread.length === 0) return;
    const previous = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await base44.entities.Notification.bulkUpdate(unread.map((n) => ({ id: n.id, read: true })));
    } catch (e) {
      setItems(previous);
    }
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div>
        <PageHeader
          title="Notifications"
          description={`${items.filter((n) => !n.read).length} unread`}
          actions={<Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="mr-1 h-4 w-4" /> Mark all read</Button>}
        />
        {items.length === 0 ? (
          <EmptyState title="No notifications" description="Updates about your points, rewards and achievements will appear here." />
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <div key={n.id} className={`rounded-xl border p-4 ${n.read ? "border-border bg-card" : "border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20"}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-2 ${n.read ? "bg-secondary text-muted-foreground" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400"}`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.message && <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_date).toLocaleString()}</p>
                  </div>
                  {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}