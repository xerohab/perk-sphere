import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { adjustPoints } from '../../shared/rewards.ts';
import { authorize, writeAudit } from '../../shared/permissions.ts';

const STATUSES = ['pending', 'approved', 'fulfilled', 'rejected', 'cancelled', 'refunded'];
// Statuses that mean the points have been (or must be) returned to the member.
const RETURNED = ['rejected', 'cancelled', 'refunded'];

// Updates a redemption's status. Requires redemptions.manage (server-checked).
// Points are returned exactly once, and a returned redemption cannot be re-opened.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await authorize(base44, 'redemptions.manage');
    if (auth.error) return auth.error;
    const user = auth.user;

    const { redemptionId, status, adminNotes, fulfilmentInfo } = await req.json().catch(() => ({}));
    if (!redemptionId || !STATUSES.includes(status)) return Response.json({ error: 'Missing or invalid parameters' }, { status: 400 });

    const admin = base44.asServiceRole;
    const redemption = await admin.entities.Redemption.get(redemptionId);
    const alreadyReturned = RETURNED.includes(redemption.status);
    if (alreadyReturned && !RETURNED.includes(status)) {
      return Response.json({ error: 'This redemption was already returned to the member and cannot be re-opened.' }, { status: 400 });
    }
    const prev = { status: redemption.status };

    await admin.entities.Redemption.update(redemptionId, {
      status,
      admin_notes: adminNotes || redemption.admin_notes,
      fulfilment_info: fulfilmentInfo || redemption.fulfilment_info,
      admin_id: user.id
    });

    const name = redemption.reward_name || 'a reward';
    if (RETURNED.includes(status) && !alreadyReturned) {
      await adjustPoints(admin, {
        userId: redemption.user_id,
        amount: redemption.points_spent,
        type: 'refund',
        reason: (status === 'rejected' ? 'Rejection refund: ' : 'Refund for redemption: ') + name,
        source: 'admin_panel',
        adminId: user.id,
        relatedRedemptionId: redemption.id
      });
      await admin.entities.Notification.create({
        user_id: redemption.user_id,
        type: status === 'rejected' ? 'redemption_rejected' : 'redemption_refunded',
        title: status === 'rejected' ? 'Redemption rejected' : 'Redemption refunded',
        message: 'Your redemption of ' + name + (status === 'rejected' ? ' was rejected. ' : ' was refunded: ') + redemption.points_spent + ' points returned.'
      });
    } else if (status === 'approved' || status === 'fulfilled') {
      await admin.entities.Notification.create({
        user_id: redemption.user_id,
        type: status === 'fulfilled' ? 'redemption_fulfilled' : 'redemption_approved',
        title: status === 'fulfilled' ? 'Redemption fulfilled' : 'Redemption approved',
        message: 'Your redemption of ' + name + ' has been ' + status + '.'
      });
    }

    await writeAudit(admin, {
      adminId: user.id, action: 'redemption_status_change', entityType: 'Redemption', entityId: redemptionId,
      previous: prev, next: { status, adminNotes: adminNotes || null }
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}