import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { requiredSecondsFor } from '../../shared/tasks.ts';

// Records a viewing/progress event from a tracking client (today: admin/manual; future:
// the Perk Sphere Linux API). Validates the session belongs to the caller, advances
// eligible time from SERVER timestamps (never trusting a client-supplied duration),
// and updates TaskProgress. Does NOT complete the task or award anything — completion
// is decided by completeTask. The client may never send AWARD_POINTS / AWARD_XP /
// TASK_COMPLETED as trusted commands; those are rejected as unknown event types.
const BLOCKED_EVENTS = ['AWARD_POINTS', 'AWARD_XP', 'TASK_COMPLETED'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { sessionId, taskId, eventType, deviceId } = body;
    if (!sessionId || !taskId) return Response.json({ error: 'Missing sessionId or taskId' }, { status: 400 });
    if (eventType && BLOCKED_EVENTS.includes(eventType)) {
      return Response.json({ error: 'Event type not accepted from clients.' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const sessions = await admin.entities.WatchSession.filter({ session_id: sessionId, user_id: user.id, task_id: taskId });
    const session = (sessions || [])[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    if (session.verification_state === 'invalidated') return Response.json({ error: 'Session invalidated' }, { status: 400 });

    const task = await admin.entities.Task.get(taskId);
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

    const now = new Date();
    const serverNow = now.toISOString();
    const lastHb = session.last_heartbeat ? new Date(session.last_heartbeat) : new Date(session.started_at);
    // Eligible delta = real elapsed seconds since last heartbeat, capped to avoid huge gaps.
    // A client cannot inflate this: it is computed from server-received timestamps only.
    let delta = Math.max(0, (now - lastHb) / 1000);
    if (delta > 90) delta = 90; // longer gaps suggest the user was away

    const newElapsed = (session.total_elapsed_seconds || 0) + delta;
    const newEligible = (session.eligible_active_seconds || 0) + delta;

    const updates = {
      last_heartbeat: serverNow,
      total_elapsed_seconds: newElapsed,
      eligible_active_seconds: newEligible
    };

    if (eventType === 'VIDEO_ENDED' || eventType === 'STREAM_ENDED') {
      updates.ended_at = serverNow;
      updates.verification_state = 'ended';
    }

    await admin.entities.WatchSession.update(session.id, updates);

    // Recompute TaskProgress eligible_seconds as the sum of all non-invalidated sessions
    const allSessions = await admin.entities.WatchSession.filter({ user_id: user.id, task_id: taskId });
    const totalEligible = (allSessions || [])
      .filter((s) => s.verification_state !== 'invalidated')
      .reduce((s, x) => s + (x.eligible_active_seconds || 0), 0);
    const reqSec = requiredSecondsFor(task);
    const pct = reqSec > 0 ? Math.min(100, Math.round((totalEligible / reqSec) * 100)) : 0;

    const progressRecs = await admin.entities.TaskProgress.filter({ user_id: user.id, task_id: taskId, status: 'in_progress' });
    const progress = (progressRecs || [])[0];
    if (progress) {
      await admin.entities.TaskProgress.update(progress.id, {
        eligible_seconds: totalEligible,
        progress_percentage: pct,
        last_activity: serverNow
      });
    }

    return Response.json({ ok: true, eligible_seconds: totalEligible, progress_percentage: pct, required_seconds: reqSec });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}