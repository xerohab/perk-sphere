import { secrets } from "base44:runtime";
import { assertLegacyWritesAllowed } from "./launchBalanceReset.ts";
async function requireLegacyWritesAllowed(base44) {
  if (secrets.get("PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE") === "true") throw new Error("legacy_base44_ledger_writes_disabled");
  await assertLegacyWritesAllowed(base44);
}
import { checkedBalance, rewardEligibility, assertAccountEligible } from './rewardPolicy.ts';

// Core server-side ledger logic for Perk Sphere.
// All points/XP balance changes flow through here so balances are authoritative
// server-side and every change produces a ledger transaction.

export async function recalcRank(base44, userId) {
  await requireLegacyWritesAllowed(base44);
  const levels = await base44.entities.LoyaltyLevel.list('-minimum_xp', 100);
  const user = await base44.entities.User.get(userId);
  const xp = user.loyalty_xp || 0;
  const active = levels.filter((l) => l.active !== false).sort((a, b) => b.minimum_xp - a.minimum_xp);
  const achieved = active.find((l) => xp >= (l.minimum_xp || 0));
  const rank = achieved ? achieved.name : (active[active.length - 1] ? active[active.length - 1].name : 'Bronze');
  if (user.loyalty_rank !== rank) {
    await requireLegacyWritesAllowed(base44);
    await requireLegacyWritesAllowed(base44);
  await base44.entities.User.update(userId, { loyalty_rank: rank });
  }
  return rank;
}

export async function adjustPoints(base44, { userId, amount, type, reason, source, adminId, adminNote, relatedActivityId, relatedRedemptionId }) {
  await requireLegacyWritesAllowed(base44);
  const user = await base44.entities.User.get(userId);
  if (amount === 0) throw new Error('Amount must be non-zero.');
  const before = user.points_balance ?? 0;
  const after = checkedBalance(before, amount, 'points');
  const txn = await base44.entities.PointsTransaction.create({
    user_id: userId,
    amount,
    balance_before: before,
    balance_after: after,
    transaction_type: type,
    reason: reason || null,
    source: source || null,
    related_activity_id: relatedActivityId || null,
    related_redemption_id: relatedRedemptionId || null,
    admin_id: adminId || null,
    admin_note: adminNote || null
  });
  await requireLegacyWritesAllowed(base44);
  await base44.entities.User.update(userId, { points_balance: after });
  return { transaction: txn, balance_before: before, balance_after: after };
}

export async function adjustXp(base44, { userId, amount, reason, source, adminId, adminNote, relatedActivityId }) {
  await requireLegacyWritesAllowed(base44);
  const user = await base44.entities.User.get(userId);
  if (amount === 0) throw new Error('Amount must be non-zero.');
  const before = user.loyalty_xp ?? 0;
  const after = checkedBalance(before, amount, 'XP');
  const txn = await base44.entities.XpTransaction.create({
    user_id: userId,
    xp_amount: amount,
    xp_before: before,
    xp_after: after,
    reason: reason || null,
    source: source || null,
    related_activity_id: relatedActivityId || null,
    admin_id: adminId || null,
    admin_note: adminNote || null
  });
  await requireLegacyWritesAllowed(base44);
  await base44.entities.User.update(userId, { loyalty_xp: after });
  const rank = await recalcRank(base44, userId);
  return { transaction: txn, xp_before: before, xp_after: after, rank };
}

export async function redeemReward(base44, { userId, rewardId }) {
  await requireLegacyWritesAllowed(base44);
  const user = await base44.entities.User.get(userId);
  const reward = await base44.entities.Reward.get(rewardId);

  const now = new Date();
  const restrictions = await base44.entities.Restriction.filter({ user_id: userId });
  assertAccountEligible(user, restrictions, 'redeem rewards', now);
  const eligibility = rewardEligibility(user, reward, now);
  if (!eligibility.ok) throw new Error(eligibility.reason);

  if (reward.max_redemptions_per_user && reward.max_redemptions_per_user > 0) {
    const prior = await base44.entities.Redemption.filter({ user_id: userId, reward_id: rewardId });
    if (prior.length >= reward.max_redemptions_per_user) throw new Error('You have reached the redemption limit for this reward.');
  }

  const status = reward.manual_approval_required ? 'pending' : 'approved';
  const redemption = await base44.entities.Redemption.create({
    user_id: userId,
    reward_id: rewardId,
    reward_name: reward.name,
    points_spent: reward.points_cost,
    status
  });

  const result = reward.points_cost === 0 ? { balance_after: user.points_balance ?? 0 } : await adjustPoints(base44, {
    userId,
    amount: -reward.points_cost,
    type: 'redemption',
    reason: 'Redemption: ' + reward.name,
    source: 'rewards_store',
    relatedRedemptionId: redemption.id
  });

  if (!reward.unlimited_stock) {
    await base44.entities.Reward.update(rewardId, { stock_available: Math.max(0, (reward.stock_available || 1) - 1) });
  }

  await base44.entities.Notification.create({
    user_id: userId,
    type: 'reward_redeemed',
    title: 'Reward redeemed',
    message: 'You redeemed ' + reward.name + ' for ' + reward.points_cost + ' points.'
  });

  return { redemption, balance_after: result.balance_after };
}