import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { authorize } from '../../shared/permissions.ts';

// Admin task analytics. Requires tasks.viewAnalytics.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await authorize(base44, 'tasks.viewAnalytics');
    if (auth.error) return auth.error;
    const admin = base44.asServiceRole;

    const tasks = await admin.entities.Task.list('-created_date', 500);
    const activeTasks = (tasks || []).filter((t) => t.active !== false && !t.archived);
    const allProgress = await admin.entities.TaskProgress.list('-created_date', 1000);
    const sessions = await admin.entities.WatchSession.list('-created_date', 1000);

    const totalStarted = (allProgress || []).length;
    const completedRecs = (allProgress || []).filter((p) => p.status === 'completed');
    const totalCompleted = completedRecs.length;
    const completionRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;
    const totalPointsIssued = completedRecs.reduce((s, p) => s + (p.points_issued || 0), 0);
    const totalXpIssued = completedRecs.reduce((s, p) => s + (p.xp_issued || 0), 0);
    const totalViewingSeconds = (sessions || []).reduce((s, x) => s + (x.eligible_active_seconds || 0), 0);

    const timed = completedRecs.filter((p) => p.started_at && p.completed_at);
    const avgCompletionMs = timed.length > 0
      ? timed.reduce((s, p) => s + (new Date(p.completed_at) - new Date(p.started_at)), 0) / timed.length
      : 0;

    const byTask = {};
    (tasks || []).forEach((t) => {
      const prog = (allProgress || []).filter((p) => p.task_id === t.id);
      const comp = prog.filter((p) => p.status === 'completed');
      const sess = (sessions || []).filter((s) => s.task_id === t.id);
      byTask[t.id] = {
        name: t.name,
        task_type: t.task_type,
        active: t.active !== false && !t.archived,
        participants: new Set(prog.map((p) => p.user_id)).size,
        started: prog.length,
        completed: comp.length,
        completion_rate: prog.length > 0 ? Math.round((comp.length / prog.length) * 100) : 0,
        points_issued: comp.reduce((s, p) => s + (p.points_issued || 0), 0),
        xp_issued: comp.reduce((s, p) => s + (p.xp_issued || 0), 0),
        viewing_seconds: sess.reduce((s, x) => s + (x.eligible_active_seconds || 0), 0),
        verified_sessions: sess.filter((s) => s.verification_state === 'ended').length
      };
    });

    return Response.json({
      ok: true,
      summary: {
        total_tasks: (tasks || []).length,
        active_tasks: activeTasks.length,
        participants: new Set((allProgress || []).map((p) => p.user_id)).size,
        started: totalStarted,
        completed: totalCompleted,
        completion_rate: completionRate,
        avg_completion_ms: Math.round(avgCompletionMs),
        points_issued: totalPointsIssued,
        xp_issued: totalXpIssued,
        viewing_seconds: totalViewingSeconds
      },
      byTask
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}