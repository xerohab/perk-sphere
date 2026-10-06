import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { authorize, writeAudit, loadStaff } from '../../shared/permissions.ts';

const STATUSES = ['active', 'restricted', 'suspended', 'banned'];

// Changes a member's account status. Server-authorised + audit-logged. The
// account_status field is also write-locked for app users (field-level security),
// so this function is the only path.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await authorize(base44, 'users.status');
    if (auth.error) return auth.error;
    const { user, staff } = auth;

    const { userId, status } = await req.json().catch(() => ({}));
    if (!userId || !STATUSES.includes(status)) return Response.json({ error: 'Invalid user or status' }, { status: 400 });
    if (userId === user.id) return Response.json({ error: 'You cannot change your own account status.' }, { status: 400 });

    const admin = base44.asServiceRole;
    const target = await admin.entities.User.get(userId);
    if (target.role === 'admin') {
      const targetStaff = await loadStaff(admin, target);
      if (targetStaff && staff.role !== 'super_admin') {
        return Response.json({ error: 'Only a Super Admin can change the status of a staff account.' }, { status: 403 });
      }
    }

    await admin.entities.User.update(userId, { account_status: status });
    await writeAudit(admin, {
      adminId: user.id, action: 'user_status_change', entityType: 'User', entityId: userId,
      previous: { status: target.account_status || 'active' }, next: { status }
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}