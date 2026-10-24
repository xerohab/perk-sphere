import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { adjustPoints, adjustXp } from '../../shared/rewards.ts';
import { authorize, writeAudit } from '../../shared/permissions.ts';

// Manual Points / XP adjustment. Requires points.adjust or xp.adjust (server-checked).
async function perkSphereHandler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { userId, currency, amount, reason, adminNote } = body;
    if (currency !== 'points' && currency !== 'xp') return Response.json({ error: 'Invalid currency' }, { status: 400 });

    const auth = await authorize(base44, currency === 'xp' ? 'xp.adjust' : 'points.adjust');
    if (auth.error) return auth.error;
    const user = auth.user;

    if (!userId || !Number.isSafeInteger(amount) || amount === 0) {
      return Response.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    let result;
    let before;
    let after;
    if (currency === 'points') {
      result = await adjustPoints(admin, {
        userId, amount,
        type: amount > 0 ? 'manual_credit' : 'manual_deduction',
        reason: reason || 'Manual adjustment',
        source: 'admin_panel',
        adminId: user.id,
        adminNote: adminNote || null
      });
      before = result.balance_before;
      after = result.balance_after;
    } else {
      result = await adjustXp(admin, {
        userId, amount,
        reason: reason || 'Manual adjustment',
        source: 'admin_panel',
        adminId: user.id,
        adminNote: adminNote || null
      });
      before = result.xp_before;
      after = result.xp_after;
    }

    await admin.entities.Notification.create({
      user_id: userId,
      type: currency === 'points' ? 'points_adjusted' : 'xp_adjusted',
      title: (amount > 0 ? 'Added ' : 'Deducted ') + Math.abs(amount) + ' ' + currency,
      message: reason || 'Manual adjustment by administrator'
    });

    await writeAudit(admin, {
      adminId: user.id,
      action: currency === 'points' ? (amount > 0 ? 'points_credit' : 'points_deduction') : (amount > 0 ? 'xp_credit' : 'xp_deduction'),
      entityType: 'User',
      entityId: userId,
      previous: { [currency]: before },
      next: { [currency]: after, amount, reason: reason || null, adminNote: adminNote || null, rank: result.rank || undefined }
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    const status = /negative/i.test(error.message) ? 400 : 500;
    return Response.json({ error: error.message }, { status });
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
