import React, { useEffect, useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/perk/PageHeader";
import TaskCard from "@/components/perk/TaskCard";
import EmptyState from "@/components/perk/EmptyState";
import PullToRefresh from "@/components/perk/PullToRefresh";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Tasks() {
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionTaskId, setActionTaskId] = useState(null);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const [t, p] = await Promise.all([
        base44.entities.Task.list('-created_date', 200),
        base44.entities.TaskProgress.filter({ user_id: user?.id })
      ]);
      setTasks((t || []).filter((x) => x.active !== false && !x.archived && x.publicly_visible !== false));
      setProgress(p || []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const progressByTask = useMemo(() => {
    const map = {};
    progress.forEach((p) => {
      if (!map[p.task_id] || new Date(p.last_activity || p.created_date) > new Date(map[p.task_id].last_activity || map[p.task_id].created_date)) {
        map[p.task_id] = p;
      }
    });
    return map;
  }, [progress]);

  const now = new Date();
  const isExpired = (task) => {
    if (task.available_until && new Date(task.available_until) < now) return true;
    if (task.task_type === "live_stream" && task.event_end && new Date(task.event_end) < now) return true;
    return false;
  };

  const available = tasks.filter((t) => !progressByTask[t.id] && !isExpired(t));
  const inProgress = tasks.filter((t) => progressByTask[t.id]?.status === "in_progress" && !isExpired(t));
  const completed = tasks.filter((t) => progressByTask[t.id]?.status === "completed");
  const expired = tasks.filter((t) => isExpired(t));

  const handleStart = async (task) => {
    setActionTaskId(task.id);
    const optimisticId = `optimistic-${task.id}`;
    setProgress((prev) => [...prev, { id: optimisticId, task_id: task.id, status: "in_progress", eligible_seconds: 0, progress_percentage: 0, last_activity: new Date().toISOString(), created_date: new Date().toISOString() }]);
    try {
      await base44.functions.invoke("startTask", { taskId: task.id });
      toast({ title: "Task started", description: `"${task.name}" is now in progress.` });
      await load(true);
    } catch (e) {
      setProgress((prev) => prev.filter((p) => p.id !== optimisticId));
      toast({ title: "Failed to start", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setActionTaskId(null);
    }
  };

  const handleComplete = async (task) => {
    setActionTaskId(task.id);
    try {
      const res = await base44.functions.invoke("completeTask", { taskId: task.id });
      const data = res.data || res;
      if (data.already_completed) {
        toast({ title: "Already completed" });
      } else {
        toast({ title: "Task completed!", description: data.points_issued || data.xp_issued ? `Earned ${data.points_issued ? data.points_issued + " pts " : ""}${data.xp_issued ? data.xp_issued + " XP" : ""}` : "Well done." });
      }
      await Promise.all([load(true), checkUserAuth?.()]);
    } catch (e) {
      toast({ title: "Cannot complete", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setActionTaskId(null);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const renderGrid = (list) => list.length === 0
    ? <EmptyState title="No tasks here" />
    : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((t) => (
        <TaskCard key={t.id} task={t} progress={progressByTask[t.id]} isAuthed
          onStart={() => handleStart(t)} onComplete={() => handleComplete(t)}
          starting={actionTaskId === t.id} completing={actionTaskId === t.id} />
      ))}</div>;

  return (
    <PullToRefresh onRefresh={() => load(true)}>
      <div>
        <PageHeader title="Tasks" description="Complete tasks to earn Points, Loyalty XP and achievements" />
        <Tabs defaultValue="available">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="available">Available ({available.length})</TabsTrigger>
            <TabsTrigger value="progress">In Progress ({inProgress.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            <TabsTrigger value="expired">Expired ({expired.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="available" className="mt-6">{renderGrid(available)}</TabsContent>
          <TabsContent value="progress" className="mt-6">{renderGrid(inProgress)}</TabsContent>
          <TabsContent value="completed" className="mt-6">{renderGrid(completed)}</TabsContent>
          <TabsContent value="expired" className="mt-6">{renderGrid(expired)}</TabsContent>
        </Tabs>
      </div>
    </PullToRefresh>
  );
}