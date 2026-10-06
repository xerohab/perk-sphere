import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  ROLES, ROLE_LABELS, roleCatalog, canAssignRole, canManageMemberRole,
  authorize, writeAudit
} from '../../shared/permissions.ts';

// Staff & role management. Server-authorised, audit-logged and escalation-proof:
//  - Only a Super Admin can grant/revoke Super Admin or Admin.
//  - An Admin can only hand out limited roles whose permissions it already holds.
//  - Nobody can change their own role, and the last Super Admin cannot be removed.
//  - Normal users can never reach this: they fail the platform-admin + StaffMember checks.
//  - action "claim" is the one-time bootstrap: a platform admin (granted by the app owner in
//    the dashboard) can claim Super Admin ONLY while no active Super Admin exists.
function activeSupers(members) {
  return (members || []).filter((m) => m.staff_role === 'super_admin' && m.active !== false);
}

async function findUserByEmail(admin, email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return null;
  const direct = await admin.entities.User.filter({ email: em });
  if (direct && direct.length > 0) return direct[0];
  const all = await admin.entities.User.list('-created_date', 1000);
  return (all || []).find((u) => String(u.email || '').toLowerCase() === em) || null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ---- Bootstrap: claim the very first Super Admin ----
    if (action === 'claim') {
      let me = null;
      try { me = await base44.auth.me(); } catch (_e) { me = null; }
      if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (me.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

      const members = await admin.entities.StaffMember.list('-created_date', 500);
      if (activeSupers(members).length > 0) {
        return Response.json({ error: 'A Super Admin already exists. Ask them to grant you a role.' }, { status: 409 });
      }
      const mine = (members || []).find((m) => m.user_id === me.id);
      const row = { user_id: me.id, email: me.email, full_name: me.full_name || '', staff_role: 'super_admin', active: true, granted_by: 'bootstrap' };
      if (mine) await admin.entities.StaffMember.update(mine.id, row);
      else await admin.entities.StaffMember.create(row);
      await writeAudit(admin, {
        adminId: me.id, action: 'staff_bootstrap_super_admin', entityType: 'StaffMember', entityId: me.id,
        next: { staff_role: 'super_admin', email: me.email }
      });
      return Response.json({ ok: true, staff_role: 'super_admin' });
    }

    // ---- Everything else needs an authorised staff member ----
    const auth = await authorize(base44, 'staff.view');
    if (auth.error) return auth.error;
    const { user, staff } = auth;
    const members = await admin.entities.StaffMember.list('-created_date', 500);

    if (action === 'list') {
      const visible = (members || []).map((m) => ({
        id: m.id, user_id: m.user_id, email: m.email, full_name: m.full_name,
        staff_role: m.staff_role, active: m.active !== false, created_date: m.created_date,
        can_manage: m.user_id !== user.id && canManageMemberRole(staff.role, m.staff_role)
      }));
      return Response.json({
        ok: true,
        me: { user_id: user.id, staff_role: staff.role },
        members: visible,
        grantable_roles: ROLES.filter((r) => canAssignRole(staff.role, r)).map((r) => ({ role: r, label: ROLE_LABELS[r] })),
        roles: roleCatalog()
      });
    }

    if (action === 'grant') {
      const staffRole = body.staff_role;
      if (!body.email || !ROLES.includes(staffRole)) return Response.json({ error: 'Email and a valid role are required' }, { status: 400 });
      if (!canAssignRole(staff.role, staffRole)) {
        return Response.json({ error: 'Your role cannot assign ' + ROLE_LABELS[staffRole] }, { status: 403 });
      }
      const target = await findUserByEmail(admin, body.email);
      if (!target) return Response.json({ error: 'No registered user has that email. They need to create an account first.' }, { status: 404 });
      if (target.id === user.id) return Response.json({ error: 'You cannot change your own role.' }, { status: 400 });

      const current = (members || []).find((m) => m.user_id === target.id && m.active !== false) || null;
      if (current && !canManageMemberRole(staff.role, current.staff_role)) {
        return Response.json({ error: 'Your role cannot modify a ' + ROLE_LABELS[current.staff_role] }, { status: 403 });
      }
      if (current && current.staff_role === 'super_admin' && staffRole !== 'super_admin' && activeSupers(members).length <= 1) {
        return Response.json({ error: 'Cannot demote the last Super Admin.' }, { status: 400 });
      }

      if (target.role !== 'admin') await admin.entities.User.update(target.id, { role: 'admin' });
      const row = { user_id: target.id, email: target.email, full_name: target.full_name || '', staff_role: staffRole, active: true, granted_by: user.id };
      const existing = (members || []).find((m) => m.user_id === target.id);
      if (existing) await admin.entities.StaffMember.update(existing.id, row);
      else await admin.entities.StaffMember.create(row);

      await writeAudit(admin, {
        adminId: user.id, action: current ? 'staff_role_changed' : 'staff_role_granted', entityType: 'StaffMember', entityId: target.id,
        previous: { staff_role: current ? current.staff_role : null },
        next: { staff_role: staffRole, email: target.email }
      });
      return Response.json({ ok: true });
    }

    if (action === 'revoke') {
      const member = (members || []).find((m) => m.id === body.staff_id);
      if (!member) return Response.json({ error: 'Staff member not found' }, { status: 404 });
      if (member.user_id === user.id) return Response.json({ error: 'You cannot revoke your own role.' }, { status: 400 });
      if (!canManageMemberRole(staff.role, member.staff_role)) {
        return Response.json({ error: 'Your role cannot revoke a ' + ROLE_LABELS[member.staff_role] }, { status: 403 });
      }
      if (member.staff_role === 'super_admin' && member.active !== false && activeSupers(members).length <= 1) {
        return Response.json({ error: 'Cannot remove the last Super Admin.' }, { status: 400 });
      }
      await admin.entities.User.update(member.user_id, { role: 'user' });
      await admin.entities.StaffMember.update(member.id, { active: false });
      await writeAudit(admin, {
        adminId: user.id, action: 'staff_role_revoked', entityType: 'StaffMember', entityId: member.user_id,
        previous: { staff_role: member.staff_role, email: member.email }, next: { staff_role: null }
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}