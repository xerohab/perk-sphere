import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as rewards from '../base44/shared/rewards.ts';
globalThis.__testSecrets = { get PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE() { return globalThis.__ledgerCutover; } };
function fixture({ points = 100, xp = 50, reward = {}, rank = 'Bronze' } = {}) {
  const writes = [];
  const api = { entities: {
    Setting: { filter: async () => [] },
    User: { get: async () => ({ points_balance: points, loyalty_xp: xp, loyalty_rank: rank }), update: async (...args) => { writes.push(args); } },
    PointsTransaction: { create: async (data) => { writes.push(data); return data; } },
    XpTransaction: { create: async (data) => { writes.push(data); return data; } },
    Restriction: { filter: async () => [] },
    Reward: { get: async () => ({ active: true, points_cost: 20, unlimited_stock: true, ...reward }) },
    Redemption: { create: async () => { writes.push('redemption'); return { id: 'r' }; }, filter: async () => [] },
    Notification: { create: async () => {} }, LoyaltyLevel: { list: async () => [] }
  } };
  return { api, writes };
}
test('points rejects fractional, nonfinite, zero and unsafe amounts without writes', async () => {
  for (const amount of [1.5, NaN, Infinity, 0, Number.MAX_SAFE_INTEGER + 1, '2']) {
    const { api, writes } = fixture();
    await assert.rejects(rewards.adjustPoints(api, { userId: 'u', amount }));
    assert.equal(writes.length, 0);
  }
});
test('points rejects overflow and insufficient balance without writes', async () => {
  for (const [points, amount] of [[Number.MAX_SAFE_INTEGER, 1], [10, -11]]) {
    const { api, writes } = fixture({ points });
    await assert.rejects(rewards.adjustPoints(api, { userId: 'u', amount }));
    assert.equal(writes.length, 0);
  }
});
test('XP cannot silently clamp a debit and misstate its transaction', async () => {
  const { api, writes } = fixture({ xp: 10 });
  await assert.rejects(rewards.adjustXp(api, { userId: 'u', amount: -11 }));
  assert.equal(writes.length, 0);
});
test('redemption enforces rank before creating an order or changing balance', async () => {
  const { api, writes } = fixture({ reward: { required_rank: 'Gold' } });
  await assert.rejects(rewards.redeemReward(api, { userId: 'u', rewardId: 'r' }), /rank/i);
  assert.equal(writes.length, 0);
});
test('malformed reward price and inventory fail before writes', async () => {
  for (const reward of [{ points_cost: -10 }, { points_cost: 1.5 }, { unlimited_stock: false, stock_available: 1.5 }]) {
    const { api, writes } = fixture({ reward });
    await assert.rejects(rewards.redeemReward(api, { userId: 'u', rewardId: 'r' }));
    assert.equal(writes.length, 0);
  }
});
test('cutover blocks legacy points, XP and redemption before writes', async () => {
  globalThis.__ledgerCutover = 'true';
  try {
    const { api, writes } = fixture();
    await assert.rejects(rewards.adjustPoints(api, { userId: 'u', amount: 1 }), /disabled/);
    await assert.rejects(rewards.adjustXp(api, { userId: 'u', amount: 1 }), /disabled/);
    await assert.rejects(rewards.redeemReward(api, { userId: 'u', rewardId: 'r' }), /disabled/);
    assert.equal(writes.length, 0);
  } finally { delete globalThis.__ledgerCutover; }
});