import { ROLES, ROLE_PERMISSIONS, canAssignRole, canManageMemberRole, evaluateAccess } from '../../shared/permissions.ts';

// TEMPORARY: exercises the real permission rules with synthetic users so the
// escalation matrix can be tested without needing extra accounts. Deleted after testing.
export default async function(_req) {
  const matrix = {};
  const violations = [];
  for (const actor of ROLES) {
    matrix[actor] = {};
    for (const target of ROLES) {
      const allowed = canAssignRole(actor, target);
      matrix[actor][target] = allowed;
      if (allowed && actor !== 'super_admin') {
        const missing = ROLE_PERMISSIONS[target].filter((p) => !ROLE_PERMISSIONS[actor].includes(p));
        if (missing.length) violations.push({ actor, target, missing });
      }
    }
  }
  const mk = (role) => ({ role, permissions: ROLE_PERMISSIONS[role] });
  const normal = { id: 'u1', role: 'user' };
  const platformAdmin = { id: 'u2', role: 'admin' };
  const staffUser = (role) => ({ id: 'u3', role: 'admin', _s: role });
  const checks = {
    anonymous_points_adjust: evaluateAccess(null, null, 'points.adjust'),
    normal_user_points_adjust: evaluateAccess(normal, null, 'points.adjust'),
    normal_user_with_stolen_super_record: evaluateAccess(normal, mk('super_admin'), 'staff.manage'),
    platform_admin_without_staff_record: evaluateAccess(platformAdmin, null, 'points.adjust'),
    analyst_points_adjust: evaluateAccess(staffUser('analyst'), mk('analyst'), 'points.adjust'),
    analyst_audit_view: evaluateAccess(staffUser('analyst'), mk('analyst'), 'audit.view'),
    support_manage_rewards: evaluateAccess(staffUser('support'), mk('support'), 'rewards.manage'),
    support_manage_redemptions: evaluateAccess(staffUser('support'), mk('support'), 'redemptions.manage'),
    rewards_manager_manage_rewards: evaluateAccess(staffUser('rewards_manager'), mk('rewards_manager'), 'rewards.manage'),
    rewards_manager_adjust_points: evaluateAccess(staffUser('rewards_manager'), mk('rewards_manager'), 'points.adjust'),
    admin_adjust_points: evaluateAccess(staffUser('admin'), mk('admin'), 'points.adjust'),
    admin_manage_settings: evaluateAccess(staffUser('admin'), mk('admin'), 'settings.manage'),
    admin_manage_staff: evaluateAccess(staffUser('admin'), mk('admin'), 'staff.manage'),
    super_admin_manage_settings: evaluateAccess(staffUser('super_admin'), mk('super_admin'), 'settings.manage')
  };
  const manage = {
    admin_can_modify_super_admin: canManageMemberRole('admin', 'super_admin'),
    admin_can_modify_admin: canManageMemberRole('admin', 'admin'),
    admin_can_modify_analyst: canManageMemberRole('admin', 'analyst'),
    support_can_modify_analyst: canManageMemberRole('support', 'analyst'),
    super_admin_can_modify_admin: canManageMemberRole('super_admin', 'admin')
  };
  return Response.json({ matrix, violations, checks, manage });
}