import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { loadStaff, roleCatalog, ROLE_LABELS } from '../../shared/permissions.ts';

// Tells the admin UI what the signed-in account may see. The UI only uses this to
// hide navigation; every privileged function re-checks permissions server-side.
async function perkSphereHandler(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      user = null;
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ ok: true, is_staff: false, permissions: [] });

    const admin = base44.asServiceRole;
    const staff = await loadStaff(admin, user);
    const members = await admin.entities.StaffMember.list('-created_date', 500);
    const superExists = (members || []).some((m) => m.staff_role === 'super_admin' && m.active !== false);

    return Response.json({
      ok: true,
      is_staff: !!staff,
      staff_role: staff ? staff.role : null,
      staff_role_label: staff ? ROLE_LABELS[staff.role] : null,
      permissions: staff ? staff.permissions : [],
      can_claim_super_admin: !staff && !superExists,
      roles: roleCatalog()
    });
  } catch (error) {
    return Response.json({ error: 'Unable to load access' }, { status: 500 });
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
