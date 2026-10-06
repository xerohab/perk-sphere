import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { adjustPoints, adjustXp } from '../../shared/rewards.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { userId, currency, amount, reason, adminNote } = body;
    if (!userId || !currency || typeof amount !== 'number' || amount === 0) {
      return Response.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    let result;
    if (currency === 'points') {
      result = await adjustPoints(admin, {
        userId, amount,
        type: amount > 0 ? 'manual_credit' : 'manual_deduction',
        reason: reason || 'Manual adjustment',
        source: 'admin_panel',
        adminId: user.id,
        adminNote: adminNote || null
      });
    } else if (currency === 'xp') {
      result = await adjustXp(admin, {
        userId, amount,
        reason: reason || 'Manual adjustment',
        source: 'admin_panel',
        adminId: user.id,
        adminNote: adminNote || null
      });
    } else {
      return Response.json({ error: 'Invalid currency' }, { status: 400 });
    }

    await admin.entities.Notification.create({
      user_id: userId,
      type: currency === 'points' ? 'points_adjusted' : 'xp_adjusted',
      title: (amount > 0 ? 'Added ' : 'Deducted ') + Math.abs(amount) + ' ' + currency,
      message: reason || 'Manual adjustment by administrator'
    });

    await admin.entities.AuditLog.create({
      admin_id: user.id,
      action: currency === 'points' ? (amount > 0 ? 'points_credit' : 'points_deduction') : (amount > 0 ? 'xp_credit' : 'xp_deduction'),
      entity_type: 'User',
      entity_id: userId,
      previous_values: { balance: result.balance_before || result.xp_before },
      new_values: { balance: result.balance_after || result.xp_after, reason, adminNote }
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}