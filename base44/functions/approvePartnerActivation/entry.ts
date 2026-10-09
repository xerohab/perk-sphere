import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { linuxTrustedPost, LINUX_PARTNER_ENDPOINTS, computePartnerActivationApproval } from '../../shared/linuxClient.ts';
import { ONBOARDING_STEPS, sanitizePartnerRecord } from '../../shared/partners.ts';

// Independent administrator approval workflow for partner activation.
//
// This function is SEPARATE from managePartner and the public client. It is the
// ONLY path that accesses PERKSPHERE_PARTNER_APPROVAL_SECRET and generates the
// activation approval signature. It does not accept client-provided admin IDs,
// approval signatures, verification results, or activation status as authority.
//
// Security model:
//   - Requires authenticated, authorised administrator access (partners.manage).
//   - Server-side permission checks via authorize().
//   - Records every approval/rejection decision with a timestamp in the immutable
//     AuditLog BEFORE calling Linux.
//   - Only this server-side workflow may generate the activation signature.
//   - Uses the confirmed PS-PARTNER-ACTIVATE five-field Linux contract.
//   - Does not enable activation automatically — the admin must explicitly call
//     this function with decision: 'approve'.
//   - If Linux returns 503 (gate disabled), the partner stays inactive.
//
// The approval signature is generated server-side from PERKSPHERE_PARTNER_APPROVAL_SECRET.
// The admin's identity is recorded in the audit trail but is NOT used as the
// signing key — the secret is independent of any admin account.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { partnerId, decision, reason } = body;

    if (!partnerId) return Response.json({ error: 'Missing partnerId' }, { status: 400 });
    if (!decision || !['approve', 'reject'].includes(decision)) {
      return Response.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
    }

    // Admin auth + permission check — server-side, not client-provided.
    const auth = await authorize(base44, 'partners.manage');
    if (auth.error) return auth.error;
    const { user } = auth;
    const admin = base44.asServiceRole;

    const partner = await admin.entities.PartnerIntegration.get(partnerId);

    // ── Reject ────────────────────────────────────────────────────────────
    if (decision === 'reject') {
      const cl = partner.setup_checklist || {};
      cl.admin_reviewed = false;
      await admin.entities.PartnerIntegration.update(partnerId, {
        setup_checklist: cl,
        integration_status: 'suspended',
        active: false
      });
      await writeAudit(admin, {
        adminId: user.id,
        action: 'partner_activation_rejected',
        entityType: 'PartnerIntegration',
        entityId: partnerId,
        next: { reason: reason || 'Activation rejected by administrator', admin_email: user.email }
      });
      return Response.json({ ok: true, decision: 'rejected', partner_id: partnerId });
    }

    // ── Approve ───────────────────────────────────────────────────────────
    // Verify ALL onboarding steps are complete (except 'activated' itself).
    const cl = partner.setup_checklist || {};
    const requiredSteps = ONBOARDING_STEPS.filter((s) => s.key !== 'activated');
    const missingSteps = requiredSteps.filter((s) => !cl[s.key]);

    if (missingSteps.length > 0) {
      return Response.json({
        error: 'Cannot approve activation: onboarding incomplete',
        missing_steps: missingSteps.map((s) => s.key),
        missing_labels: missingSteps.map((s) => s.label)
      }, { status: 400 });
    }

    // Additional hard guards — these MUST be true before we generate the signature.
    if (!partner.linux_api_partner_id) {
      return Response.json({ error: 'Cannot activate: partner has not been provisioned by Linux (no Linux partner UUID).' }, { status: 400 });
    }
    if (!partner.partner_key_id) {
      return Response.json({ error: 'Cannot activate: partner has no partner_key_id.' }, { status: 400 });
    }
    if (!partner.domain_verified_at) {
      return Response.json({ error: 'Cannot activate: domain ownership has not been verified by Linux.' }, { status: 400 });
    }
    if (!partner.proof_of_possession_verified) {
      return Response.json({ error: 'Cannot activate: credential proof-of-possession has not been verified by Linux.' }, { status: 400 });
    }

    // Generate the activation approval signature using the INDEPENDENT secret.
    // The signature is generated server-side — never accepted from the client.
    const approvalReference = crypto.randomUUID();
    const approvalTimestamp = String(Math.floor(Date.now() / 1000));
    const approvalSignature = await computePartnerActivationApproval(
      partner.linux_api_partner_id,
      partner.partner_key_id,
      approvalReference,
      approvalTimestamp
    );

    // Record the approval decision in the immutable audit trail BEFORE calling Linux.
    // This ensures the decision is logged even if Linux is unavailable.
    await writeAudit(admin, {
      adminId: user.id,
      action: 'partner_activation_approved',
      entityType: 'PartnerIntegration',
      entityId: partnerId,
      next: {
        approval_reference: approvalReference,
        approval_timestamp: approvalTimestamp,
        partner_uuid: partner.linux_api_partner_id,
        partner_key_id: partner.partner_key_id,
        admin_email: user.email
      }
    });

    // Call Linux with the confirmed v2 five-field contract.
    const activateResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.ACTIVATE, {
      partner_uuid: partner.linux_api_partner_id,
      partner_key_id: partner.partner_key_id,
      approval_reference: approvalReference,
      approval_timestamp: approvalTimestamp,
      approval_signature: approvalSignature
    });

    if (!activateResult.ok) {
      // Linux rejected — do NOT mark partner as active. Record the failure.
      await writeAudit(admin, {
        adminId: user.id,
        action: 'partner_activation_failed',
        entityType: 'PartnerIntegration',
        entityId: partnerId,
        next: {
          code: activateResult.code,
          error: activateResult.error,
          approval_reference: approvalReference,
          http_status: activateResult.status
        }
      });
      return Response.json({
        ok: false,
        error: 'Linux activation ' + (activateResult.code === 'activation_not_configured' ? 'gate is disabled' : 'failed') + ': ' + (activateResult.error || activateResult.code),
        code: activateResult.code,
        approval_reference: approvalReference,
        http_status: activateResult.status
      }, { status: activateResult.status || 503 });
    }

    // Linux confirmed activation — update partner status.
    cl.activated = true;
    const updated = await admin.entities.PartnerIntegration.update(partnerId, {
      setup_checklist: cl,
      integration_status: 'active',
      active: true
    });

    await writeAudit(admin, {
      adminId: user.id,
      action: 'partner_activated',
      entityType: 'PartnerIntegration',
      entityId: partnerId,
      next: {
        approval_reference: approvalReference,
        linux_response: activateResult.data,
        admin_email: user.email
      }
    });

    return Response.json({
      ok: true,
      record: sanitizePartnerRecord(updated),
      approval_reference: approvalReference,
      activated: true
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}