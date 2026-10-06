import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Self-service account deletion. Runs server-side because app users cannot delete
// their own User record from the browser. Removes the member's own data, then the
// account. The last active Super Admin cannot delete itself.
const OWNED = ['Notification', 'Device', 'ConnectedService', 'UserAchievement', 'Activity', 'PointsTransaction', 'XpTransaction', 'Redemption'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_e) { user = null; }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) return Response.json({ error: 'Confirmation required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const members = await admin.entities.StaffMember.list('-created_date', 500);
    const mine = (members || []).filter((m) => m.user_id === user.id);
    const isSuper = mine.some((m) => m.staff_role === 'super_admin' && m.active !== false);
    if (isSuper) {
      const others = (members || []).filter((m) => m.user_id !== user.id && m.staff_role === 'super_admin' && m.active !== false);
      if (others.length === 0) {
        return Response.json({ error: 'You are the only Super Admin. Grant Super Admin to another account before deleting this one.' }, { status: 400 });
      }
    }

    for (const name of OWNED) {
      await admin.entities[name].deleteMany({ user_id: user.id });
    }
    for (const m of mine) {
      await admin.entities.StaffMember.delete(m.id);
    }
    await admin.entities.AuditLog.create({
      admin_id: user.id, action: 'account_deleted_by_owner', entity_type: 'User', entity_id: user.id
    });
    await admin.entities.User.delete(user.id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}