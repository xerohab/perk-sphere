import React, { useEffect, useState, useMemo } from "react";
import { memberTaskState } from "@/lib/member-task-state";
import { useMemberTasks } from "@/hooks/useMemberTasks";
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
  const {tasks,progress,loading,actionTaskId,loadError,load,handleStart,handleComplete}=useMemberTasks(user?.id,toast,checkUserAuth);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(timer); }, []);

  const states = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, memberTaskState(t, progress, clock)])), [tasks, progress, clock]);
  const available = tasks.filter(t => states[t.id].status === "available");
  const inProgress = tasks.filter(t => states[t.id].status === "in_progress");
  const completed = tasks.filter(t => states[t.id].status === "completed");
  const upcoming = tasks.filter(t => states[t.id].status === "upcoming");
  const expired = tasks.filter(t => states[t.id].status === "expired");

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  const renderGrid = (list) => list.length === 0
    ? <EmptyState title="No tasks here" />
    : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((t) => (
        <TaskCard key={t.id} task={t} progress={states[t.id].progress} isAuthed
          onStart={() => handleStart(t)} onComplete={() => handleComplete(t)}
          starting={actionTaskId === t.id} completing={actionTaskId === t.id} />
      ))}</div>;

  return (
    <PullToRefresh onRefresh={() => load(true)}>
      <div>
        <PageHeader title="Tasks" description="Complete tasks to earn Points, Loyalty XP and achievements" />
        {loadError && <p role="alert" className="mb-4 rounded-xl border p-4">{loadError} <button type="button" className="underline" onClick={() => load()}>Retry</button></p>}
        <p className="mb-4 text-sm text-muted-foreground">Daily tasks reset at midnight UTC; weekly tasks reset on Monday UTC. Each task keeps its own completion limit and verification requirements.</p>
        <Tabs defaultValue="available">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="available">Available ({available.length})</TabsTrigger>
            <TabsTrigger value="progress">In Progress ({inProgress.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="expired">Expired ({expired.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="available" className="mt-6">{renderGrid(available)}</TabsContent>
          <TabsContent value="progress" className="mt-6">{renderGrid(inProgress)}</TabsContent>
          <TabsContent value="completed" className="mt-6">{renderGrid(completed)}</TabsContent>
          <TabsContent value="upcoming" className="mt-6">{renderGrid(upcoming)}</TabsContent>
          <TabsContent value="expired" className="mt-6">{renderGrid(expired)}</TabsContent>
        </Tabs>
      </div>
    </PullToRefresh>
  );
}