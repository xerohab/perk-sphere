import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { validateReward } from '../../shared/rewardPolicy.ts';

// The ONLY way the admin UI creates / edits / deletes configuration records.
// The entities below are write-locked for every app user (even admins) via RLS, so a
// staff member cannot bypass this function from the browser. Each call is checked
// against the caller's staff role and written to the audit log.
const RULES = {
  Reward: { permission: 'rewards.manage', ops: ['create', 'update', 'delete'] },
  LoyaltyLevel: { permission: 'loyalty.manage', ops: ['create', 'update', 'delete'] },
  Achievement: { permission: 'achievements.manage', ops: ['create', 'update', 'delete'] },
  Website: { permission: 'destinations.manage', ops: ['create', 'update', 'delete'] },
  TrackedAccount: { permission: 'destinations.manage', ops: ['create', 'update', 'delete'] },
  Rule: { permission: 'rules.manage', ops: ['create', 'update', 'delete'] },
  Campaign: { permission: 'campaigns.manage', ops: ['create', 'update', 'delete'] },
  Setting: { permission: 'settings.manage', ops: ['create', 'update', 'delete'], mask: true },
  Restriction: { permission: 'restrictions.manage', ops: ['create', 'update'], stamp: 'admin_id' },
  FraudFlag: { permission: 'fraud.review', ops: ['update'], fields: ['review_status'], stamp: 'admin_id' },
  Notification: { permission: 'notifications.send', ops: ['create'], fields: ['user_id', 'type', 'title', 'message', 'destination'] }
};

const SYSTEM_FIELDS = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample'];

function clean(data, allowed) {
  const out = {};
  Object.keys(data || {}).forEach((k) => {
    if (SYSTEM_FIELDS.includes(k)) return;
    if (allowed && !allowed.includes(k)) return;
    if (data[k] !== undefined) out[k] = data[k];
  });
  return out;
}

function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => { if (obj && obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

async function perkSphereHandler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { entity, op, id } = body;
    const rule = RULES[entity];
    if (!rule || !rule.ops.includes(op)) return Response.json({ error: 'Operation not allowed' }, { status: 400 });

    const auth = await authorize(base44, rule.permission);
    if (auth.error) return auth.error;
    const { user } = auth;

    const admin = base44.asServiceRole;
    const store = admin.entities[entity];
    const payload = clean(body.data, rule.fields);
    if (rule.stamp) payload[rule.stamp] = user.id;
    const action = entity.toLowerCase() + '_' + op;

    if (op === 'create') {
      if (entity === 'Reward') validateReward(payload);
      const record = await store.create(payload);
      await writeAudit(admin, {
        adminId: user.id, action, entityType: entity, entityId: record.id,
        next: rule.mask ? { key: payload.key } : payload
      });
      return Response.json({ ok: true, record });
    }

    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
    const before = await store.get(id);

    if (op === 'update') {
      if (entity === 'Reward') validateReward({ ...before, ...payload });
      const record = await store.update(id, payload);
      await writeAudit(admin, {
        adminId: user.id, action, entityType: entity, entityId: id,
        previous: rule.mask ? { key: before.key } : pick(before, Object.keys(payload)),
        next: rule.mask ? { key: before.key, changed: true } : payload
      });
      return Response.json({ ok: true, record });
    }

    await store.delete(id);
    await writeAudit(admin, {
      adminId: user.id, action, entityType: entity, entityId: id,
      previous: rule.mask ? { key: before.key } : clean(before)
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
