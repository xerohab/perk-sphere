import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Updates a redemption's status. Admin-only. Refunds points on refund/cancel.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { redemptionId, status, adminNotes, fulfilmentInfo } = body;
    if (!redemptionId || !status) return Response.json({ error: 'Missing parameters' }, { status: 400 });

    const admin = base44.asServiceRole;
    const redemption = await admin.entities.Redemption.get(redemptionId);
    const prev = { status: redemption.status };

    const update = { status, admin_notes: adminNotes || redemption.admin_notes, fulfilment_info: fulfilmentInfo || redemption.fulfilment_info, admin_id: user.id };
    await admin.entities.Redemption.update(redemptionId, update);

    if ((status === 'refunded' || status === 'cancelled') && redemption.status !== 'refunded' && redemption.status !== 'cancelled') {
      const { adjustPoints } = await import('../../shared/rewards.ts');
      await adjustPoints(admin, {
        userId: redemption.user_id,
        amount: redemption.points_spent,
        type: 'refund',
        reason: 'Refund for redemption: ' + (redemption.reward_name || ''),
        source: 'admin_panel',
        adminId: user.id,
        relatedRedemptionId: redemption.id
      });
      await admin.entities.Notification.create({
        user_id: redemption.user_id,
        type: 'redemption_refunded',
        title: 'Redemption refunded',
        message: 'Your redemption of ' + (redemption.reward_name || 'a reward') + ' was refunded: ' + redemption.points_spent + ' points returned.'
      });
    } else if (status === 'approved' || status === 'fulfilled') {
      await admin.entities.Notification.create({
        user_id: redemption.user_id,
        type: status === 'fulfilled' ? 'redemption_fulfilled' : 'redemption_approved',
        title: status === 'fulfilled' ? 'Redemption fulfilled' : 'Redemption approved',
        message: 'Your redemption of ' + (redemption.reward_name || 'a reward') + ' has been ' + status + '.'
      });
    } else if (status === 'rejected') {
      const { adjustPoints } = await import('../../shared/rewards.ts');
      await adjustPoints(admin, {
        userId: redemption.user_id,
        amount: redemption.points_spent,
        type: 'refund',
        reason: 'Rejection refund: ' + (redemption.reward_name || ''),
        source: 'admin_panel',
        adminId: user.id,
        relatedRedemptionId: redemption.id
      });
      await admin.entities.Notification.create({
        user_id: redemption.user_id,
        type: 'redemption_rejected',
        title: 'Redemption rejected',
        message: 'Your redemption of ' + (redemption.reward_name || 'a reward') + ' was rejected. ' + redemption.points_spent + ' points returned.'
      });
    }

    await admin.entities.AuditLog.create({
      admin_id: user.id,
      action: 'redemption_status_change',
      entity_type: 'Redemption',
      entity_id: redemptionId,
      previous_values: prev,
      new_values: { status, adminNotes }
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}