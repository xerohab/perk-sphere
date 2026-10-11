import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardEligibility, checkedBalance, isRestrictionActive, assertAccountEligible, canTransitionRedemption, validateReward } from '../base44/shared/rewardPolicy.ts';
import { adjustPoints, adjustXp, redeemReward } from '../base44/shared/rewards.ts';
import { finalizeCompletion } from '../base44/shared/taskCompletion.ts';
import { deriveRewardType, periodStart, canCompleteAgain, isLiveStreamCompletionReady } from '../base44/shared/tasks.ts';
const now = new Date('2026-10-10T12:00:00Z');
const member = { id: 'member', points_balance: 100, loyalty_xp: 20, loyalty_rank: 'Bronze', account_status: 'active' };
const reward = { id: 'reward', name: 'Test reward', points_cost: 10, stock_available: 2 };
function fixture(overrides = {}) {
  const writes = [];
  const user = { ...member, ...overrides.user };
  const item = { ...reward, ...overrides.reward };
  const entities = {
    Setting: { filter: async () => [] },
    User: { get: async () => user, update: async (id, data) => { writes.push(['User', data]); Object.assign(user, data); return user; } },
    Reward: { get: async () => item, update: async (id, data) => { writes.push(['Reward', data]); Object.assign(item, data); } },
    Restriction: { filter: async () => overrides.restrictions || [] },
    LoyaltyLevel: { list: async () => [{ name: 'Bronze', minimum_xp: 0 }, { name: 'Silver', minimum_xp: 30 }] },
    Redemption: { filter: async () => overrides.prior || [], create: async data => { writes.push(['Redemption', data]); return { id: 'redemption', ...data }; } },
    TaskProgress: { get: async () => { if (overrides.readFailure) throw new Error('offline'); return { reward_issued: false }; }, filter: async () => [], update: async (id, data) => writes.push(['TaskProgress', data]) }
  };
  for (const name of ['PointsTransaction', 'XpTransaction', 'Notification', 'UserAchievement']) entities[name] = { create: async data => { writes.push([name, data]); return { id: name, ...data }; } };
  return { admin: { entities }, writes, user, item };
}
for (const amount of [NaN, Infinity, -Infinity, '10', 0.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`ledger rejects invalid amount ${String(amount)} before writes`, async () => {
    for (const fn of [adjustPoints, adjustXp]) {
      const f = fixture();
      await assert.rejects(fn(f.admin, { userId: 'member', amount }));
      assert.equal(f.writes.length, 0);
    }
  });
}
test('ledger rejects insufficient points, XP underflow and overflow', async () => {
  for (const [fn, amount] of [[adjustPoints, -101], [adjustXp, -21], [adjustPoints, Number.MAX_SAFE_INTEGER]]) {
    const f = fixture(); await assert.rejects(fn(f.admin, { userId: 'member', amount })); assert.equal(f.writes.length, 0);
  }
});
test('valid points and XP adjustments record actual deltas and recalculate rank', async () => {
  const f = fixture();
  assert.equal((await adjustPoints(f.admin, { userId: 'member', amount: -10 })).balance_after, 90);
  assert.equal((await adjustXp(f.admin, { userId: 'member', amount: 10 })).rank, 'Silver');
  assert.equal(f.user.loyalty_xp, 30);
});
for (const [name, changes] of [
  ['inactive', { active: false }], ['negative cost', { points_cost: -10 }], ['string cost', { points_cost: '10' }],
  ['fractional cost', { points_cost: 1.5 }], ['out of stock', { stock_available: 0 }],
  ['invalid date', { start_date: 'bad' }], ['future', { start_date: '2099-01-01T00:00:00Z' }],
  ['expired', { end_date: '2000-01-01T00:00:00Z' }], ['rank', { required_rank: 'Gold' }]
]) test(`redemption blocks ${name} before writes`, async () => {
  const f = fixture({ reward: changes });
  await assert.rejects(redeemReward(f.admin, { userId: 'member', rewardId: 'reward' })); assert.equal(f.writes.length, 0);
});
for (const type of ['redemption_disabled', 'temporary_suspension', 'account_review']) test(`redemption blocks ${type}`, async () => {
  const f = fixture({ restrictions: [{ type, active: true }] });
  await assert.rejects(redeemReward(f.admin, { userId: 'member', rewardId: 'reward' })); assert.equal(f.writes.length, 0);
});
test('expired restrictions and earning-only pauses do not block redemption', () => {
  assert.equal(isRestrictionActive({ end_date: now.toISOString() }, now), false);
  assertAccountEligible(member, [{ type: 'points_earning_paused' }], 'redeem rewards', now);
  assert.equal(isRestrictionActive({ start_date: 'bad' }, now), true);
});
test('suspended and banned members cannot redeem', async () => {
  for (const account_status of ['suspended', 'banned']) {
    const f = fixture({ user: { account_status } });
    await assert.rejects(redeemReward(f.admin, { userId: 'member', rewardId: 'reward' })); assert.equal(f.writes.length, 0);
  }
});
test('redemption limit prevents another debit', async () => {
  const f = fixture({ reward: { max_redemptions_per_user: 1 }, prior: [{ id: 'old' }] });
  await assert.rejects(redeemReward(f.admin, { userId: 'member', rewardId: 'reward' })); assert.equal(f.writes.length, 0);
});
test('valid redemption debits points, reserves stock and retains approval requirement', async () => {
  const f = fixture({ reward: { manual_approval_required: true } });
  const result = await redeemReward(f.admin, { userId: 'member', rewardId: 'reward' });
  assert.equal(result.redemption.status, 'pending'); assert.equal(f.user.points_balance, 90); assert.equal(f.item.stock_available, 1);
  assert.equal(f.writes.filter(([name]) => name === 'PointsTransaction').length, 1);
});
test('date boundaries and unlimited free rewards', () => {
  assert.equal(rewardEligibility(member, { ...reward, end_date: now.toISOString() }, now).ok, false);
  assert.equal(rewardEligibility(member, { ...reward, start_date: now.toISOString(), points_cost: 0, unlimited_stock: true }, now).ok, true);
  assert.throws(() => validateReward({ ...reward, start_date: now.toISOString(), end_date: now.toISOString() }));
  assert.throws(() => checkedBalance(-1, 1, 'points'));
});
test('redemption transitions reject reopening returned or reverting fulfilled rewards', () => {
  for (const status of ['rejected', 'cancelled', 'refunded']) {
    assert.equal(canTransitionRedemption(status, 'approved'), false);
    assert.equal(canTransitionRedemption(status, status), true);
  }
  assert.equal(canTransitionRedemption('fulfilled', 'pending'), false);
  assert.equal(canTransitionRedemption('fulfilled', 'refunded'), true);
  assert.equal(canTransitionRedemption('pending', 'approved'), true);
  assert.equal(canTransitionRedemption('unknown', 'unknown'), false);
});
const completionArgs = task => ({ userId: 'member', task: { id: 'task', name: 'Test', ...task }, progress: { id: 'progress' }, completedCount: 0, now, source: 'test', verificationStatus: 'verified' });
test('failed fresh progress read never awards rewards', async () => {
  const f = fixture({ readFailure: true });
  await assert.rejects(finalizeCompletion(f.admin, completionArgs({ points_reward: 10 })), /offline/); assert.equal(f.writes.length, 0);
});
test('invalid XP config prevents partial points award', async () => {
  const f = fixture();
  await assert.rejects(finalizeCompletion(f.admin, completionArgs({ reward_type: 'points_xp', points_reward: 10, xp_reward: 0.5 }))); assert.equal(f.writes.length, 0);
});
test('explicit no-reward and YouTube tasks never issue points or XP', async () => {
  for (const task of [{ reward_type: 'none' }, { reward_type: 'points_xp', destination_platform: 'YouTube' }]) {
    const f = fixture(); const result = await finalizeCompletion(f.admin, completionArgs({ points_reward: 10, xp_reward: 10, ...task }));
    assert.equal(result.pointsToIssue, 0); assert.equal(result.xpToIssue, 0);
    assert.equal(f.writes.some(([name]) => ['PointsTransaction', 'XpTransaction'].includes(name)), false);
  }
  assert.equal(deriveRewardType({ reward_type: 'none', points_reward: 10 }), 'none');
});
test('reward-issued progress sequential retry does not write', async () => {
  const f = fixture(); f.admin.entities.TaskProgress.get = async () => ({ reward_issued: true, completion_number: 1 });
  assert.equal((await finalizeCompletion(f.admin, completionArgs({ points_reward: 10 }))).already_completed, true); assert.equal(f.writes.length, 0);
});
test('daily and weekly periods use UTC Monday boundaries', () => {
  assert.equal(periodStart('once_daily', now).toISOString(), '2026-10-10T00:00:00.000Z');
  assert.equal(periodStart('once_weekly', now).toISOString(), '2026-10-05T00:00:00.000Z');
  assert.equal(canCompleteAgain({ completion_limit_type: 'once_daily' }, [{ completed_at: now.toISOString() }], now).ok, false);
});
test('live duration plus end requires both conditions', () => {
  const task = { task_type: 'live_stream', completion_mode: 'duration_plus_end', required_seconds: 60 };
  assert.equal(isLiveStreamCompletionReady(task, 60, false), false);
  assert.equal(isLiveStreamCompletionReady(task, 59, true), false);
  assert.equal(isLiveStreamCompletionReady(task, 60, true), true);
});