// Staff roles & permissions — the single server-side source of truth.
// Every privileged backend function calls authorize() before doing anything.
// Staff roles live in the StaffMember entity, which app users can never write
// (only backend functions using the service role can), so nobody can promote
// themselves from the browser.

export const ROLES = ['super_admin', 'admin', 'rewards_manager', 'support', 'analyst'];
export const LIMITED_ROLES = ['rewards_manager', 'support', 'analyst'];

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  rewards_manager: 'Rewards Manager',
  support: 'Support',
  analyst: 'Analyst'
};

export const ROLE_DESCRIPTIONS = {
  super_admin: 'Full control, including system settings and every staff role. Only a Super Admin can grant or revoke Super Admin or Admin.',
  admin: 'Runs the platform day to day: users, points, XP, rewards, destinations, rules and campaigns. Can grant the limited roles (Rewards Manager, Support, Analyst) but nothing above its own level.',
  rewards_manager: 'Manages the rewards catalogue and redemptions.',
  support: 'Helps members: views accounts, handles redemptions, applies restrictions and sends notifications.',
  analyst: 'Read-only access to users, ledgers, activity, destinations, rules and analytics.'
};

const VIEW = [
  'dashboard.view', 'users.view', 'ledger.view', 'rewards.view', 'redemptions.view',
  'destinations.view', 'activity.view', 'rules.view', 'campaigns.view', 'achievements.view',
  'loyalty.view', 'restrictions.view', 'fraud.view', 'analytics.view', 'audit.view',
  'settings.view', 'staff.view', 'tasks.view'
];

const MANAGE = [
  'users.status', 'points.adjust', 'xp.adjust', 'rewards.manage', 'redemptions.manage',
  'destinations.manage', 'activity.record', 'rules.manage', 'campaigns.manage',
  'achievements.manage', 'loyalty.manage', 'restrictions.manage', 'fraud.review',
  'notifications.send',
  'tasks.create', 'tasks.edit', 'tasks.publish', 'tasks.archive', 'tasks.viewParticipants', 'tasks.viewAnalytics'
];

export const ROLE_PERMISSIONS = {
  super_admin: [...VIEW, ...MANAGE, 'settings.manage', 'staff.manage', 'staff.grant_limited'],
  admin: [...VIEW, ...MANAGE, 'staff.grant_limited'],
  rewards_manager: [
    'dashboard.view', 'users.view', 'ledger.view', 'rewards.view', 'rewards.manage',
    'redemptions.view', 'redemptions.manage', 'loyalty.view', 'achievements.view',
    'campaigns.view', 'destinations.view', 'analytics.view',
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.publish', 'tasks.viewParticipants', 'tasks.viewAnalytics'
  ],
  support: [
    'dashboard.view', 'users.view', 'users.status', 'ledger.view', 'rewards.view',
    'redemptions.view', 'redemptions.manage', 'activity.view', 'destinations.view',
    'restrictions.view', 'restrictions.manage', 'fraud.view', 'notifications.send',
    'achievements.view', 'loyalty.view',
    'tasks.view', 'tasks.viewParticipants'
  ],
  analyst: [
    'dashboard.view', 'users.view', 'ledger.view', 'rewards.view', 'redemptions.view',
    'activity.view', 'destinations.view', 'rules.view', 'campaigns.view', 'achievements.view',
    'loyalty.view', 'fraud.view', 'analytics.view', 'audit.view',
    'tasks.view', 'tasks.viewAnalytics'
  ]
};

export function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || [];
}

export function roleCatalog() {
  return ROLES.map((r) => ({
    role: r,
    label: ROLE_LABELS[r],
    description: ROLE_DESCRIPTIONS[r],
    permissions: ROLE_PERMISSIONS[r]
  }));
}

// Can an actor with `actorRole` assign `targetRole` to someone?
// Super Admin: any role. Others: only if they hold staff.grant_limited, the target is a
// limited role, AND every permission of the target role is one the actor already holds.
export function canAssignRole(actorRole, targetRole) {
  if (!ROLE_PERMISSIONS[actorRole] || !ROLE_PERMISSIONS[targetRole]) return false;
  if (actorRole === 'super_admin') return true;
  const actor = ROLE_PERMISSIONS[actorRole];
  if (!actor.includes('staff.grant_limited')) return false;
  if (!LIMITED_ROLES.includes(targetRole)) return false;
  return ROLE_PERMISSIONS[targetRole].every((p) => actor.includes(p));
}

// Can the actor change or revoke a member who currently holds `memberRole`?
export function canManageMemberRole(actorRole, memberRole) {
  if (actorRole === 'super_admin') return true;
  return canAssignRole(actorRole, memberRole);
}

// Pure access decision (no I/O) so it can be unit-tested.
export function evaluateAccess(user, staff, permission) {
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' };
  if (user.role !== 'admin') return { ok: false, status: 403, error: 'Forbidden' };
  if (!staff) return { ok: false, status: 403, error: 'Forbidden: no staff role assigned to this account' };
  if (permission && !staff.permissions.includes(permission)) {
    return { ok: false, status: 403, error: 'Forbidden: your role (' + ROLE_LABELS[staff.role] + ') does not include ' + permission };
  }
  return { ok: true };
}

export async function loadStaff(admin, user) {
  if (!user || user.role !== 'admin') return null;
  const recs = await admin.entities.StaffMember.filter({ user_id: user.id });
  const rec = (recs || []).find((r) => r.active !== false && ROLE_PERMISSIONS[r.staff_role]);
  if (!rec) return null;
  return { record: rec, role: rec.staff_role, permissions: ROLE_PERMISSIONS[rec.staff_role] };
}

// Authenticates the caller from the request token and checks the permission server-side.
// Returns { user, staff } or { error: Response }.
export async function authorize(base44, permission) {
  let user = null;
  try {
    user = await base44.auth.me();
  } catch (_e) {
    user = null;
  }
  const staff = user && user.role === 'admin' ? await loadStaff(base44.asServiceRole, user) : null;
  const verdict = evaluateAccess(user, staff, permission);
  if (!verdict.ok) return { error: Response.json({ error: verdict.error }, { status: verdict.status }) };
  return { user, staff };
}

export async function writeAudit(admin, { adminId, action, entityType, entityId, previous, next }) {
  const row = { admin_id: adminId, action, entity_type: entityType };
  if (entityId) row.entity_id = entityId;
  if (previous) row.previous_values = previous;
  if (next) row.new_values = next;
  return admin.entities.AuditLog.create(row);
}