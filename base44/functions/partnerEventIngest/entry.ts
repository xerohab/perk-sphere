import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { waitUntil } from "base44:runtime";
import {
  verifyPartnerRequest, validateEventPayload,
  REFUND_EVENT_TYPES, TASK_PROGRESS_EVENT_TYPES, WATCH_EVENT_TYPES
} from '../../shared/partners.ts';
import { writeAudit } from '../../shared/permissions.ts';

// MIGRATION-ONLY event-ingestion endpoint for partner integrations.
//
// Production partners MUST submit signed events to the Linux API endpoint
// (api.perksphere.org/events). This Base44 endpoint is a controlled migration
// path for setup_required partners only. Active production partners are rejected
// with a clear "use_linux_endpoint" error.
//
// Partners send HMAC-signed events with headers:
//   X-PS-Partner-Key, X-PS-Timestamp, X-PS-Nonce, X-PS-Signature
//
// Security layers (fail-closed, in order):
//   1. HMAC authentication (key lookup → setup_required check → credential decrypt →
//      timestamp skew → nonce format → signature → nonce replay protection)
//   2. Event type validation (supported + per-partner permitted types)
//   3. Content evidence for watch events (self-reported duration is NOT sufficient)
//   4. Idempotent storage (external_event_id deduplication)
//   5. Refund/chargeback invalidation (marks original completions for review)
//
// Events NEVER issue Points/XP directly. This endpoint does NOT establish a
// second authoritative event ledger. Verified activity feeds task progress;
// completion and reward issuance flow exclusively through the trusted completion
// path (finalizeCompletion), called only by trustedActivityBridge or completeTask.
// Unsigned client-provided evidence is NEVER forwarded as trusted verified activity.

function err(code, message, status = 400) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

async function perkSphereHandler(req) {
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
      original_event_id,
      source_timestamp,
      metadata,
      is_test
    } = body;

    // 2. Validate event type, required fields, and per-partner permitted types.
    //    Watch events require content evidence; refund events require original_event_id.
    const validation = validateEventPayload(body, partner);
    if (!validation.ok) {
      waitUntil(writeAudit(admin, {
        adminId: 'partner_ingest',
        action: 'partner_event_rejected',
        entityType: 'PartnerIntegration',
        entityId: partner.id,
        next: { code: validation.code, event_type, external_event_id }
      }).catch(() => {}));
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

    // 4. Determine event category.
    const isRefund = REFUND_EVENT_TYPES.includes(event_type);
    const isTest = !!is_test;
    const isWatchEvent = WATCH_EVENT_TYPES.includes(event_type);
    const isTaskProgress = TASK_PROGRESS_EVENT_TYPES.includes(event_type);

    // 5. Store the event.
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
      is_test_event: isTest,
      is_refund: isRefund,
      original_event_id: original_event_id || null,
      request_id: requestId
    });

    // 6. Update partner connection health (fire-and-forget).
    if (!isTest) {
      waitUntil(admin.entities.PartnerIntegration.update(partner.id, {
        last_event_at: now.toISOString(),
        connection_health: 'healthy',
        total_events_received: (partner.total_events_received || 0) + 1
      }).catch(() => {}));
    }

    // 7. Process the event.
    //    Test events are stored but never enter reward processing.
    //    Partner events NEVER issue Points/XP directly.
    let resolvedUserId = null;
    let taskValid = false;
    let refundInvalidated = false;

    if (isTest) {
      // Test events just need to be stored and marked processed.
      await admin.entities.PartnerEvent.update(eventRecord.id, {
        processing_status: 'processed',
        processed_at: now.toISOString(),
        completion_triggered: false
      });
      return Response.json({
        ok: true,
        data: {
          external_event_id, accepted: true, duplicate: false, processed: true,
          is_test: true, completion_triggered: false,
          note: 'Test event stored. Test events do not enter reward processing.'
        },
        request_id: requestId
      });
    }

    // 7a. Refund/chargeback handling — find and flag the original purchase event's
    //     completions for review. This does NOT silently delete ledger transactions;
    //     it creates a fraud flag for admin review and audit.
    if (isRefund && original_event_id) {
      const originalEvents = await admin.entities.PartnerEvent.filter({
        partner_integration_id: partner.id,
        external_event_id: original_event_id
      });
      const originalEvt = (originalEvents || [])[0];
      if (originalEvt && originalEvt.completion_id) {
        // Flag the completion for review — do NOT reverse rewards silently.
        waitUntil(admin.entities.FraudFlag.create({
          user_id: originalEvt.user_id || 'unknown',
          flag_type: 'partner_refund',
          risk_score: 50,
          risk_flags: ['partner_refund', event_type.toLowerCase()],
          review_status: 'pending',
          details: `Partner ${partner.name} reported ${event_type} for original event ${original_event_id}. Completion ${originalEvt.completion_id} may need reversal.`,
          admin_id: 'partner_ingest'
        }).catch(() => {}));
        refundInvalidated = true;
      }
    }

    // 7b. Task progress — resolve user and validate task ownership.
    //     Watch events: eligible_seconds from the partner is recorded but does NOT
    //     prove genuine viewing. Completion requires the trusted verification path.
    if (isTaskProgress && task_id && user_reference) {
      try {
        const user = await admin.entities.User.get(user_reference);
        resolvedUserId = user.id;
      } catch (_e) { resolvedUserId = null; }

      if (resolvedUserId) {
        const task = await admin.entities.Task.get(task_id).catch(() => null);
        if (task && task.partner_integration_id === partner.id) {
          taskValid = true;
        }
      }
    }

    // 7c. Account linking is NOT handled here. Partners must confirm links through
    //     the Linux API's /v1/partner-links/confirm endpoint (partner-authenticated).
    //     Linux verifies the challenge and notifies Base44 via the trusted bridge
    //     (PARTNER_LINK_CONFIRMED event). This endpoint does not accept an arbitrary
    //     account reference supplied by a partner event — only Linux's trusted
    //     confirmation creates a ConnectedService record.

    // 8. Mark event processed.
    await admin.entities.PartnerEvent.update(eventRecord.id, {
      user_id: resolvedUserId,
      processing_status: 'processed',
      processed_at: now.toISOString(),
      completion_triggered: false,
      invalidated_completion_id: refundInvalidated ? (priorRec?.completion_id || null) : null
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
        is_refund: isRefund,
        refund_invalidated: refundInvalidated,
        note: 'Migration endpoint: event stored and validated. Production partners must use the Linux API. Completion requires trusted verification — partner events do not issue rewards directly.'
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

// Inline sha256 for the account-link challenge comparison.
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
