import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Records an activity event. Designed for the future Linux tracking API and
// admin entry. Rejects duplicate event_ids so replayed events are not double counted.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { userId, platform, activity_type, target, target_account, target_url, external_content_id, detection_source, metadata, related_campaign_id, event_id, device_id, client_timestamp } = body;
    if (!userId || !platform || !activity_type) return Response.json({ error: 'Missing required activity fields' }, { status: 400 });

    const admin = base44.asServiceRole;

    if (event_id) {
      const existing = await admin.entities.Activity.filter({ event_id });
      if (existing && existing.length > 0) {
        return Response.json({ ok: true, duplicate: true, id: existing[0].id });
      }
    }

    const activity = await admin.entities.Activity.create({
      user_id: userId,
      platform,
      activity_type,
      target: target || null,
      target_account: target_account || null,
      target_url: target_url || null,
      external_content_id: external_content_id || null,
      detection_source: detection_source || 'admin_entered',
      verification_status: detection_source || 'admin_entered',
      metadata: metadata || {},
      related_campaign_id: related_campaign_id || null,
      event_id: event_id || null,
      device_id: device_id || null,
      client_timestamp: client_timestamp || null,
      processing_state: 'processed'
    });

    await admin.entities.AuditLog.create({
      admin_id: user.id,
      action: 'activity_recorded',
      entity_type: 'Activity',
      entity_id: activity.id,
      new_values: { platform, activity_type, target_account }
    });

    return Response.json({ ok: true, activity });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}