import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Search, Plus, Pencil, Copy, Power, Archive, Trash2, BarChart3, Users } from "lucide-react";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import ResponsiveTable from "@/components/perk/ResponsiveTable";
import StatusBadge from "@/components/perk/StatusBadge";
import ConfirmDialog from "@/components/perk/ConfirmDialog";
import TaskWizard from "@/components/perk/TaskWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import { TASK_TYPES } from "@/lib/task-utils";

export default function AdminTasks() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [stats, setStats] = useState(null);
  const [participants, setParticipants] = useState(null);

  const load = async (silent) => {
    if (!silent) setLoading(true);
    try {
      const t = await base44.entities.Task.list('-created_date', 500);
      setTasks(t || []);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await base44.functions.invoke("taskStats", {});
      setStats(res.data || res);
    } catch (e) {
      toast({ title: "Failed to load analytics", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => tasks.filter((t) => {
    if (typeFilter !== "all" && t.task_type !== typeFilter) return false;
    if (q) { const term = q.toLowerCase(); return (t.name || "").toLowerCase().includes(term) || (t.destination_name || "").toLowerCase().includes(term); }
    return true;
  }), [tasks, q, typeFilter]);

  const doAction = async (action, task, extra) => {
    try {
      await base44.functions.invoke("manageTask", { action, taskId: task.id, ...extra });
      toast({ title: `Task ${action}d` });
      load(true);
    } catch (e) {
      const data = e?.response?.data || {};
      toast({ title: "Failed", description: data.error === "disallowed_destination" ? data.message : (data.error || e.message), variant: "destructive" });
    }
  };

  const viewParticipants = async (task) => {
    try {
      const prog = await base44.entities.TaskProgress.filter({ task_id: task.id });
      setParticipants({ task, records: prog || [] });
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const typeLabel = (t) => TASK_TYPES.find((x) => x.value === t)?.label || t;

  const cols = [
    { key: "name", label: "Task", render: (t) => (<div><p className="font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{typeLabel(t.task_type)}{t.verification_mode === "trusted_automatic" ? " · Trusted Auto" : t.verification_mode === "manual" ? " · Manual" : ""}</p></div>) },
    { key: "destination_name", label: "Destination", render: (t) => t.destination_name || "—" },
    { key: "points_reward", label: "Reward", render: (t) => <span className="text-xs">{t.points_reward > 0 ? `${t.points_reward}pts ` : ""}{t.xp_reward > 0 ? `${t.xp_reward}XP` : ""}{!t.points_reward && !t.xp_reward ? "—" : ""}</span> },
    { key: "active", label: "Status", render: (t) => t.archived ? <StatusBadge status="archived" /> : <StatusBadge status={t.active ? "active" : "inactive"} /> },
    { key: "featured", label: "Featured", render: (t) => t.featured ? "★" : "" },
    { key: "_action", label: "", align: "right", render: (t) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" title="Edit" aria-label="Edit" onClick={() => { setEditing(t); setWizardOpen(true); }}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" title="Duplicate" aria-label="Duplicate" onClick={() => doAction("duplicate", t)}><Copy className="h-4 w-4" /></Button>
        {!t.archived && (t.active ? <Button variant="ghost" size="icon" title="Deactivate" aria-label="Deactivate" onClick={() => doAction("update", t, { data: { active: false } })}><Power className="h-4 w-4" /></Button> : <Button variant="ghost" size="icon" title="Publish" aria-label="Publish" onClick={() => doAction("publish", t)}><Power className="h-4 w-4" /></Button>)}
        <Button variant="ghost" size="icon" title="Participants" aria-label="Participants" onClick={() => viewParticipants(t)}><Users className="h-4 w-4" /></Button>
        {!t.archived && <Button variant="ghost" size="icon" title="Archive" aria-label="Archive" onClick={() => doAction("archive", t)}><Archive className="h-4 w-4" /></Button>}
        <ConfirmDialog trigger={<Button variant="ghost" size="icon" className="text-red-600" title="Delete" aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>} title={`Delete "${t.name}"?`} description="This permanently removes the task. Progress records are kept." confirmLabel="Delete" destructive onConfirm={() => doAction("delete", t)} />
      </div>
    ) }
  ];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Tasks" description={`${tasks.filter((t) => t.active && !t.archived).length} active · ${tasks.length} total`} actions={<Button size="sm" onClick={() => { setEditing(null); setWizardOpen(true); }}><Plus className="mr-1 h-4 w-4" /> Create Task</Button>} />

      <Tabs defaultValue="tasks" onValueChange={(v) => v === "analytics" && !stats && loadStats()}>
        <TabsList>
          <TabsTrigger value="tasks">All Tasks</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="mr-1 h-4 w-4" /> Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks..." className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TASK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filtered.length === 0 ? <EmptyState title="No tasks" description="Create your first task to get started." /> : <ResponsiveTable columns={cols} rows={filtered} />}
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          {!stats ? <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div> : (
            <div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-xs text-muted-foreground">Active Tasks</p><p className="mt-1 text-2xl font-bold">{stats.summary.active_tasks}</p></div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-xs text-muted-foreground">Participants</p><p className="mt-1 text-2xl font-bold">{stats.summary.participants}</p></div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-xs text-muted-foreground">Completion Rate</p><p className="mt-1 text-2xl font-bold">{stats.summary.completion_rate}%</p></div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-xs text-muted-foreground">Points / XP Issued</p><p className="mt-1 text-2xl font-bold">{stats.summary.points_issued} / {stats.summary.xp_issued}</p></div>
              </div>
              <h3 className="mb-3 mt-6 text-sm font-semibold">Per-Task Breakdown</h3>
              <ResponsiveTable
                columns={[
                  { key: "name", label: "Task", render: (r) => r.name },
                  { key: "participants", label: "Participants", align: "right", render: (r) => r.participants },
                  { key: "completed", label: "Completed", align: "right", render: (r) => `${r.completed}/${r.started}` },
                  { key: "completion_rate", label: "Rate", align: "right", render: (r) => `${r.completion_rate}%` },
                  { key: "points_issued", label: "Points", align: "right", render: (r) => r.points_issued },
                  { key: "xp_issued", label: "XP", align: "right", render: (r) => r.xp_issued },
                  { key: "viewing_seconds", label: "Viewing", align: "right", render: (r) => r.viewing_seconds > 0 ? `${Math.round(r.viewing_seconds)}s` : "—" }
                ]}
                rows={Object.entries(stats.byTask).map(([id, r]) => ({ ...r, id }))}
                emptyTitle="No task data yet"
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TaskWizard open={wizardOpen} onClose={() => { setWizardOpen(false); setEditing(null); }} editing={editing} onSaved={() => load(true)} />

      {participants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setParticipants(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Participants — {participants.task.name}</h3>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setParticipants(null)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            {participants.records.length === 0 ? <EmptyState title="No participants yet" /> : (
              <ResponsiveTable
                columns={[
                  { key: "user_id", label: "User", mono: true, render: (r) => r.user_id?.slice(0, 8) },
                  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
                  { key: "source", label: "Source", render: (r) => r.source === "trusted_bridge" || r.source === "trusted_automatic" ? "Trusted API" : r.source === "admin_manual" ? "Admin" : r.source === "server_verified" ? "Server" : "User" },
                  { key: "eligible_seconds", label: "Eligible", align: "right", render: (r) => `${Math.round(r.eligible_seconds || 0)}s` },
                  { key: "verification_status", label: "Verified", render: (r) => r.verification_status === "verified" ? "✓" : "—" },
                  { key: "completion_number", label: "#", align: "right", render: (r) => r.completion_number },
                  { key: "reward_issued", label: "Rewarded", render: (r) => r.reward_issued ? "✓" : "—" }
                ]}
                rows={participants.records}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}