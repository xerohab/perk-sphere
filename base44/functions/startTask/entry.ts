import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isTaskAvailable, isViewingTask, isEventWindowOpen, canCompleteAgain } from '../../shared/tasks.ts';

// A logged-in user starts a task. Creates (or reuses) an in-progress TaskProgress
// record and, for viewing tasks, opens a WatchSession. Does NOT award anything.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { taskId, deviceId } = body;
    if (!taskId) return Response.json({ error: 'Missing taskId' }, { status: 400 });

    const admin = base44.asServiceRole;
    const task = await admin.entities.Task.get(taskId);
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
    const now = new Date();
    if (!isTaskAvailable(task, now)) return Response.json({ error: 'This task is not currently available.' }, { status: 400 });
    // Trusted-automatic tasks are started automatically by the trusted verification path,
    // not by user action through the UI.
    if ((task.verification_mode || 'client_assisted') === 'trusted_automatic') {
      return Response.json({ error: 'trusted_automatic_tasks_are_started_automatically' }, { status: 400 });
    }
    if (isViewingTask(task) && !isEventWindowOpen(task, now)) {
      return Response.json({ error: 'The event window for this task is not open.' }, { status: 400 });
    }

    const allProgress = await admin.entities.TaskProgress.filter({ user_id: user.id, task_id: taskId });
    const completed = (allProgress || []).filter((p) => p.status === 'completed').sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0));
    const limitCheck = canCompleteAgain(task, completed, now);
    if (!limitCheck.ok) return Response.json({ error: limitCheck.reason }, { status: 400 });

    let progress = (allProgress || []).find((p) => p.status === 'in_progress');
    if (!progress) {
      progress = await admin.entities.TaskProgress.create({
        user_id: user.id,
        task_id: taskId,
        task_name: task.name,
        status: 'in_progress',
        eligible_seconds: 0,
        required_seconds: task.required_seconds || 0,
        started_at: now.toISOString(),
        last_activity: now.toISOString(),
        completion_number: completed.length + 1,
        verification_status: 'pending',
        source: 'user_started'
      });
    } else {
      await admin.entities.TaskProgress.update(progress.id, { last_activity: now.toISOString(), status: 'in_progress' });
    }

    let session = null;
    if (isViewingTask(task)) {
      session = await admin.entities.WatchSession.create({
        session_id: crypto.randomUUID(),
        user_id: user.id,
        task_id: taskId,
        destination_id: task.destination_id || null,
        content_id: task.content_id || null,
        stream_id: task.content_id || null,
        started_at: now.toISOString(),
        last_heartbeat: now.toISOString(),
        verification_state: 'active',
        client_device: deviceId || null
      });
      const sids = progress.session_ids || [];
      sids.push(session.id);
      await admin.entities.TaskProgress.update(progress.id, { session_ids: sids });
    }

    await admin.entities.Notification.create({
      user_id: user.id,
      type: 'task_started',
      title: 'Task started',
      message: 'You started "' + task.name + '".'
    });

    return Response.json({ ok: true, progress, session });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}