import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { authorize } from '../../shared/permissions.ts';

// Aggregated numbers for the admin dashboard. Requires dashboard.view (server-checked).
async function perkSphereHandler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await authorize(base44, 'dashboard.view');
    if (auth.error) return auth.error;

    const admin = base44.asServiceRole;
    const users = await admin.entities.User.list('-created_date', 1000);
    const redemptions = await admin.entities.Redemption.list('-created_date', 1000);
    const activities = await admin.entities.Activity.list('-created_date', 1000);
    const pointsTxns = await admin.entities.PointsTransaction.list('-created_date', 1000);
    const xpTxns = await admin.entities.XpTransaction.list('-created_date', 1000);
    const campaigns = await admin.entities.Campaign.list('-created_date', 200);
    const fraud = await admin.entities.FraudFlag.list('-created_date', 200);

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => (u.account_status || 'active') === 'active').length;
    const pointsIssued = pointsTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const pointsRedeemed = redemptions.reduce((s, r) => s + (r.points_spent || 0), 0);
    const outstandingPoints = users.reduce((s, u) => s + (u.points_balance || 0), 0);
    const xpIssued = xpTxns.filter((t) => t.xp_amount > 0).reduce((s, t) => s + t.xp_amount, 0);
    const pendingRedemptions = redemptions.filter((r) => r.status === 'pending').length;
    const activeCampaigns = campaigns.filter((c) => c.active !== false).length;
    const pendingFraud = fraud.filter((f) => f.review_status === 'pending').length;

    return Response.json({
      totalUsers, activeUsers,
      pointsIssued, pointsRedeemed, outstandingPoints,
      xpIssued,
      totalRedemptions: redemptions.length,
      pendingRedemptions,
      activityVolume: activities.length,
      activeCampaigns,
      pendingFraud
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
