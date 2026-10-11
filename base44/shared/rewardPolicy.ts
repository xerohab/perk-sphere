// Pure policy shared by the store UI and server. No credentials or SDK imports.
export function assertUnits(value, label, allowNegative = false) {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) {
    throw new Error(label + ' must be a safe whole number' + (allowNegative ? '.' : ' greater than or equal to zero.'));
  }
  return value;
}

export function checkedBalance(before, amount, label) {
  assertUnits(before, label + ' balance');
  assertUnits(amount, label + ' adjustment', true);
  const after = before + amount;
  if (after < 0) throw new Error('Resulting ' + label + ' balance cannot be negative.');
  assertUnits(after, label + ' balance');
  return after;
}

export function isRestrictionActive(restriction, now = new Date()) {
  if (restriction.active === false) return false;
  // Malformed configured dates fail closed rather than bypassing restrictions.
  for (const key of ['start_date', 'end_date']) {
    if (restriction[key] && !Number.isFinite(Date.parse(restriction[key]))) return true;
  }
  if (restriction.start_date && new Date(restriction.start_date) > now) return false;
  if (restriction.end_date && new Date(restriction.end_date) <= now) return false;
  return true;
}

export function assertAccountEligible(user, restrictions, operation, now = new Date()) {
  if (!user || ['suspended', 'banned'].includes(user.account_status)) {
    throw new Error('Account is not permitted to ' + operation + '.');
  }
  const blocking = operation === 'redeem rewards'
    ? ['redemption_disabled', 'account_review', 'temporary_suspension']
    : ['points_earning_paused', 'xp_earning_paused', 'account_review', 'temporary_suspension'];
  if ((restrictions || []).some(r => blocking.includes(r.type) && isRestrictionActive(r, now))) {
    throw new Error('Account has an active restriction.');
  }
}

export function validateReward(reward) {
  assertUnits(reward.points_cost, 'Reward cost');
  if (!reward.unlimited_stock) assertUnits(reward.stock_available ?? 0, 'Reward stock');
  assertUnits(reward.max_redemptions_per_user ?? 0, 'Redemption limit');
  for (const key of ['start_date', 'end_date']) {
    if (reward[key] && !Number.isFinite(Date.parse(reward[key]))) throw new Error('Invalid reward ' + key + '.');
  }
  if (reward.start_date && reward.end_date && new Date(reward.start_date) >= new Date(reward.end_date)) {
    throw new Error('Reward end date must be after its start date.');
  }
}

export function rewardEligibility(user, reward, now = new Date()) {
  try { validateReward(reward); } catch (error) { return { ok: false, reason: error.message }; }
  if (reward.active === false) return { ok: false, reason: 'This reward is not currently available.' };
  if (reward.start_date && new Date(reward.start_date) > now) return { ok: false, reason: 'This reward is not available yet.' };
  if (reward.end_date && new Date(reward.end_date) <= now) return { ok: false, reason: 'This reward has expired.' };
  // Preserve the store's existing exact-rank policy; no invented rank ordering.
  if (reward.required_rank && user?.loyalty_rank !== reward.required_rank) return { ok: false, reason: 'Rank required' };
  if (!Number.isSafeInteger(user?.points_balance ?? 0) || (user?.points_balance ?? 0) < reward.points_cost) return { ok: false, reason: 'Not enough points' };
  if (!reward.unlimited_stock && (reward.stock_available ?? 0) <= 0) return { ok: false, reason: 'Out of stock' };
  return { ok: true };
}

export const RETURNED_REDEMPTION_STATUSES = ['rejected', 'cancelled', 'refunded'];
const TRANSITIONS = {
  pending: ['approved', 'rejected', 'cancelled', 'refunded'],
  approved: ['fulfilled', 'rejected', 'cancelled', 'refunded'],
  fulfilled: ['refunded'],
  rejected: [], cancelled: [], refunded: []
};

export function canTransitionRedemption(previous, next) {
  return Object.hasOwn(TRANSITIONS, previous) && (previous === next || TRANSITIONS[previous].includes(next));
}
