export const RESET_RUN = 'perksphere-zero-launch-20261011';
export const FREEZE_KEY = 'perk_sphere_balance_reset_freeze';

export async function assertLegacyWritesAllowed(admin) {
  const rows = await admin.entities.Setting.filter({ key: FREEZE_KEY });
  if (rows.some(row => row.value === 'true')) throw new Error('launch_balance_reset_frozen');
}

export async function resetMember(admin, user, adminId, rank) {
  const rows = await admin.entities.LaunchBalanceSnapshot.filter({ run_reference: RESET_RUN, user_reference: user.id });
  if (rows.length > 1) throw new Error('duplicate_reset_snapshot_review_required');
  let snapshot = rows[0];
  if (!snapshot) {
    snapshot = await admin.entities.LaunchBalanceSnapshot.create({
      run_reference: RESET_RUN, user_reference: user.id,
      previous_points: user.points_balance ?? 0, previous_xp: user.loyalty_xp ?? 0,
      previous_rank: user.loyalty_rank || 'Bronze', admin_reference: adminId,
      state: 'backed_up'
    });
  }
  if (snapshot.state === 'verified') {
    const current = await admin.entities.User.get(user.id);
    if ((current.points_balance ?? 0) !== 0 || (current.loyalty_xp ?? 0) !== 0) throw new Error('balance_changed_after_reset');
    return;
  }
  await admin.entities.User.update(user.id, { points_balance: 0, loyalty_xp: 0, loyalty_rank: rank });
  const current = await admin.entities.User.get(user.id);
  if (current.points_balance !== 0 || current.loyalty_xp !== 0 || current.loyalty_rank !== rank) throw new Error('reset_verification_failed');
  await admin.entities.LaunchBalanceSnapshot.update(snapshot.id, { state: 'verified', verified_at: new Date().toISOString() });
}
