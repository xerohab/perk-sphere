import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { waitUntil } from "base44:runtime";
import { verifyPartnerRequest, validateEventPayload } from '../../shared/partners.ts';
import { writeAudit } from '../../shared/permissions.ts';

// Authenticated event-ingestion endpoint for partner integrations.
//
// Partners send HMAC-signed events with headers:
//   X-PS-Partner-Key, X-PS-Timestamp, X-PS-Nonce, X-PS-Signature
//
// Events are validated, stored idempotently (via external_event_id), and NEVER issue
// Points/XP directly. When a partner is active and an event maps to a task, verified
// activity is recorded against the task — but completion and reward issuance always
// flow through the existing trusted completion path (finalizeCompletion), called by
// trustedActivityBridge or completeTask. This function does NOT call finalizeCompletion.
//
// Refunds and chargebacks are recorded as events for auditable reward policy enforcement;
// they do NOT silently delete ledger transactions.

function err(code, message, status = 400) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

export default async function(req) {
  let admin = null;
  let requestId = null;
  let partner = null;

  try {
    const base44 = createClientFromRequest(req);
    admin = base44.asServiceRole;
    const partnerKeyId = req.headers.get('X-PS-Partner-Key');

    // 1. HMAC authentication (before any expensive processing).
    const auth = await verifyPartnerRequest(req, admin, partnerKeyId);
    requestId = auth.requestId;
    partner = auth.partner;
    if (!auth.ok) {
      waitUntil(writeAudit(admin, {
        adminId: 'partner_ingest',
        action: 'partner_auth_failed',
        entityType: 'PartnerIntegration',
        next: { code: auth.code, partner_key_id: partnerKeyId }
      }).catch(() => {}));
      return Response.json({ ok: false, error: { code: auth.code, message: auth.error }, request_id: requestId }, { status: auth.status });
    }

    const body = JSON.parse(auth.rawBody || '{}');
    const {
      external_event_id,
      event_type,
      user_reference,
      task_id,
      content_id,
      content_url,
      eligible_seconds,
      source_timestamp,
      metadata
    } = body;

    // 2. Validate event type and required fields.
    const validation = validateEventPayload(body);
    if (!validation.ok) {
      return err(validation.code, validation.error, 400);
    }

    // 3. Idempotency — if we already processed this external_event_id, return the stored result.
    const prior = await admin.entities.PartnerEvent.filter({ partner_integration_id: partner.id, external_event_id });
    const priorRec = (prior || [])[0];
    if (priorRec && (priorRec.processing_status === 'processed' || priorRec.processing_status === 'duplicate')) {
      return Response.json({
        ok: true,
        data: { external_event_id, accepted: true, duplicate: true, completion_triggered: !!priorRec.completion_triggered },
        request_id: requestId
      });
    }

    // 4. Store the event.
    const incomingEligible = Math.max(0, Number(eligible_seconds) || 0);
    const now = new Date();
    const eventRecord = priorRec || await admin.entities.PartnerEvent.create({
      partner_integration_id: partner.id,
      partner_name: partner.name,
      external_event_id,
      event_type,
      user_reference: user_reference || null,
      task_id: task_id || null,
      content_id: content_id || null,
      content_url: content_url || null,
      eligible_seconds: incomingEligible,
      event_data: metadata || null,
      source_timestamp: source_timestamp || null,
      received_at: now.toISOString(),
      processing_status: 'pending',
      request_id: requestId
    });

    // 5. Update partner connection health (fire-and-forget).
    waitUntil(admin.entities.PartnerIntegration.update(partner.id, {
      last_event_at: now.toISOString(),
      connection_health: 'healthy',
      total_events_received: (partner.total_events_received || 0) + 1
    }).catch(() => {}));

    // 6. Process the event.
    // Partner events are recorded but do NOT directly trigger completion or issue rewards.
    // When a task_id and user_reference are provided and the partner is active, we
    // validate the task belongs to this partner and record the user linkage. Actual
    // completion requires the trusted verification path (trustedActivityBridge or
    // completeTask) to confirm the activity — partner events alone are not proof.
    let resolvedUserId = null;
    let taskValid = false;

    if (task_id && user_reference) {
      // Resolve user
      try {
        const user = await admin.entities.User.get(user_reference);
        resolvedUserId = user.id;
      } catch (_e) { resolvedUserId = null; }

      if (resolvedUserId) {
        // Validate the task belongs to this partner
        const task = await admin.entities.Task.get(task_id).catch(() => null);
        if (task && task.partner_integration_id === partner.id) {
          taskValid = true;
        }
      }
    }

    // 7. Mark event processed.
    await admin.entities.PartnerEvent.update(eventRecord.id, {
      user_id: resolvedUserId,
      processing_status: 'processed',
      processed_at: now.toISOString(),
      completion_triggered: false
    });

    return Response.json({
      ok: true,
      data: {
        external_event_id,
        accepted: true,
        duplicate: false,
        processed: true,
        completion_triggered: false,
        task_validated: taskValid,
        note: 'Event stored and validated. Completion requires trusted verification — partner events do not issue rewards directly.'
      },
      request_id: requestId
    });
  } catch (error) {
    if (requestId && admin) {
      waitUntil(writeAudit(admin, { adminId: 'partner_ingest', action: 'partner_processing_error', entityType: 'PartnerIntegration', next: { message: String(error.message || error) } }).catch(() => {}));
      if (partner) {
        waitUntil(admin.entities.PartnerIntegration.update(partner.id, {
          last_failure_at: new Date().toISOString(),
          total_delivery_failures: (partner.total_delivery_failures || 0) + 1,
          connection_health: 'degraded'
        }).catch(() => {}));
      }
    }
    return Response.json({ ok: false, error: { code: 'internal_error', message: 'Processing failed.' }, request_id: requestId }, { status: 500 });
  }
}