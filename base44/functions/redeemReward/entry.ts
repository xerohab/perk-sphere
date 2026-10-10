import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { redeemReward } from '../../shared/rewards.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { rewardId } = body;
    if (!rewardId) return Response.json({ error: 'Missing rewardId' }, { status: 400 });

    // Check account is active and not restricted from redemption
    if (user.account_status === 'suspended' || user.account_status === 'banned') {
      return Response.json({ error: 'Account is not permitted to redeem rewards' }, { status: 403 });
    }

    const restrictions = await base44.asServiceRole.entities.Restriction.filter({ user_id: user.id, active: true, type: 'redemption_disabled' });
    const now = Date.now();
    if (restrictions.some((r) => (!r.start_date || new Date(r.start_date).getTime() <= now) && (!r.end_date || new Date(r.end_date).getTime() > now))) {
      return Response.json({ error: 'Reward redemption is restricted for this account.' }, { status: 403 });
    }
    const result = await redeemReward(base44.asServiceRole, { userId: user.id, rewardId });
    return Response.json({ ok: true, redemption: result.redemption, balance_after: result.balance_after });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}