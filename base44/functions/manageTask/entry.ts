import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { validateBrowserUrl, domainsFor } from '../../shared/destinations.ts';

// Admin task management with granular permissions. Each action maps to a specific
// permission. Creating/updating a task on a Disallowed destination requires explicit
// confirmDisallowed:true — the destination status itself is never changed here.
const ACTION_PERMS = {
  create: 'tasks.create',
  update: 'tasks.edit',
  publish: 'tasks.publish',
  archive: 'tasks.archive',
  duplicate: 'tasks.create',
  delete: 'tasks.edit'
};

const SYSTEM_FIELDS = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample'];

function clean(data) {
  const out = {};
  Object.keys(data || {}).forEach((k) => {
    if (SYSTEM_FIELDS.includes(k)) return;
    if (data[k] !== undefined) out[k] = data[k];
  });
  return out;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, taskId, data, confirmDisallowed } = body;
    const perm = ACTION_PERMS[action];
    if (!perm) return Response.json({ error: 'Unknown action' }, { status: 400 });

    const auth = await authorize(base44, perm);
    if (auth.error) return auth.error;
    const { user } = auth;
    const admin = base44.asServiceRole;

    // Disallowed destination guard for create/update
    if ((action === 'create' || action === 'update') && data && data.destination_id && data.destination_type) {
      const dest = data.destination_type === 'website'
        ? await admin.entities.Website.get(data.destination_id).catch(() => null)
        : await admin.entities.TrackedAccount.get(data.destination_id).catch(() => null);
      if (dest && dest.eligibility === 'disallowed' && !confirmDisallowed) {
        return Response.json({
          error: 'disallowed_destination',
          destination_name: dest.site_name || dest.account_name || 'this destination',
          message: 'This destination is classified as Disallowed. Confirm to proceed anyway.'
        }, { status: 400 });
      }
    }

    // Trusted-automatic task destination validation (server-side, independent of the wizard).
    if ((action === 'create' || action === 'update') && data && data.verification_mode === 'trusted_automatic') {
      if (!data.destination_id || !data.destination_type) {
        return Response.json({ error: 'Trusted automatic tasks require a destination.' }, { status: 400 });
      }
      const dest = data.destination_type === 'website'
        ? await admin.entities.Website.get(data.destination_id).catch(() => null)
        : await admin.entities.TrackedAccount.get(data.destination_id).catch(() => null);
      if (!dest) {
        return Response.json({ error: 'Destination not found for trusted automatic task.' }, { status: 400 });
      }
      const destEnabled = data.destination_type === 'website'
        ? (dest.status !== 'inactive' && dest.tracking_enabled !== false)
        : (dest.active !== false && dest.tracking_enabled !== false);
      if (!destEnabled) {
        return Response.json({ error: 'Trusted automatic tasks require an enabled destination.' }, { status: 400 });
      }
      if ((dest.eligibility || 'neutral') !== 'allowed') {
        return Response.json({ error: 'Trusted automatic tasks require an Allowed destination.' }, { status: 400 });
      }
      if (data.content_url) {
        const urlCheck = validateBrowserUrl(data.content_url);
        if (!urlCheck.ok) {
          return Response.json({ error: 'Trusted automatic tasks require a valid HTTPS content URL.' }, { status: 400 });
        }
        const destDomains = domainsFor(data.destination_type === 'website' ? dest.domain : dest.profile_url);
        if (!destDomains.includes(urlCheck.hostname)) {
          return Response.json({ error: 'Content URL hostname does not match the destination.' }, { status: 400 });
        }
      }
    }

    if (action === 'create' || action === 'duplicate') {
      let payload;
      if (action === 'duplicate') {
        if (!taskId) return Response.json({ error: 'Missing taskId to duplicate' }, { status: 400 });
        const src = await admin.entities.Task.get(taskId);
        payload = clean(src);
        payload.name = (src.name || 'Task') + ' (Copy)';
        payload.active = false;
        payload.featured = false;
        payload.archived = false;
      } else {
        payload = clean(data);
      }
      if (!payload.name || !payload.task_type) return Response.json({ error: 'Name and task_type are required' }, { status: 400 });
      const record = await admin.entities.Task.create(payload);
      await writeAudit(admin, { adminId: user.id, action: 'task_created', entityType: 'Task', entityId: record.id, next: { name: record.name, task_type: record.task_type } });
      return Response.json({ ok: true, record });
    }

    if (!taskId) return Response.json({ error: 'Missing taskId' }, { status: 400 });

    if (action === 'update') {
      const before = await admin.entities.Task.get(taskId);
      const payload = clean(data);
      const record = await admin.entities.Task.update(taskId, payload);
      await writeAudit(admin, {
        adminId: user.id, action: 'task_updated', entityType: 'Task', entityId: taskId,
        previous: { name: before.name, points_reward: before.points_reward, xp_reward: before.xp_reward, required_seconds: before.required_seconds, active: before.active, archived: before.archived },
        next: payload
      });
      return Response.json({ ok: true, record });
    }

    if (action === 'publish') {
      const before = await admin.entities.Task.get(taskId);
      const record = await admin.entities.Task.update(taskId, { active: true, archived: false });
      await writeAudit(admin, { adminId: user.id, action: 'task_published', entityType: 'Task', entityId: taskId, previous: { active: before.active, archived: before.archived }, next: { active: true, archived: false } });
      return Response.json({ ok: true, record });
    }

    if (action === 'archive') {
      const before = await admin.entities.Task.get(taskId);
      const record = await admin.entities.Task.update(taskId, { archived: true, active: false, featured: false });
      await writeAudit(admin, { adminId: user.id, action: 'task_archived', entityType: 'Task', entityId: taskId, previous: { archived: before.archived, active: before.active }, next: { archived: true, active: false } });
      return Response.json({ ok: true, record });
    }

    if (action === 'delete') {
      await admin.entities.Task.delete(taskId);
      await writeAudit(admin, { adminId: user.id, action: 'task_deleted', entityType: 'Task', entityId: taskId });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}