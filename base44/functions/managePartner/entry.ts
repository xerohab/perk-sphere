import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from "base44:runtime";
import { waitUntil } from "base44:runtime";
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { encryptToken, sha256Hex } from '../../shared/oauth.ts';
import { linuxTrustedPost, LINUX_PARTNER_ENDPOINTS } from '../../shared/linuxClient.ts';
import { provisionViaLinux } from '../../shared/partnerProvisioning.ts';
import {
  ONBOARDING_STEPS,
  sanitizePartnerRecord
} from '../../shared/partners.ts';

// Admin partner integration management. Linux is the authoritative system for
// partner HMAC credentials — Base44 coordinates provisioning through authenticated
// Linux endpoints and never generates independent production credentials.
//
// If Linux endpoints are unavailable, the partner is left in linux_integration_pending
// state and the admin can retry provisioning later via the retryProvisioning action.
//
// All responses are sanitized to remove plaintext secrets, credential hashes,
// encryption metadata, and domain verification tokens. The partner secret is
// returned exactly once (from Linux) during create/rotate for the admin to deliver
// to the partner out-of-band.
//
// Identity mapping:
//   Base44 PartnerIntegration.id  →  base44_partner_reference (stored on Linux)
//   Linux partner_uuid            →  linux_api_partner_id (stored on Base44, immutable after confirmation)

const ACTION_PERMS = {
  create: 'partners.manage',
  update: 'partners.manage',
  delete: 'partners.manage',
  rotateCredential: 'partners.manage',
  revokeCredential: 'partners.manage',
  setStatus: 'partners.manage',
  updateSetup: 'partners.manage',
  verifyDomain: 'partners.manage',
  createProofChallenge: 'partners.manage',
  verifyProofOfPossession: 'partners.manage',
  verifyTestEvent: 'partners.manage',
  updateRewardPolicy: 'partners.manage',
  reviewPartner: 'partners.manage',
  retryProvisioning: 'partners.manage'
};

const SYSTEM_FIELDS = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample'];
// Immutable after Linux confirmation — only an audited admin correction may change these.
const IMMUTABLE_FIELDS = ['linux_api_partner_id', 'partner_key_id', 'partner_secret_hash', 'domain_verification_token'];

function clean(data) {
  const out = {};
  Object.keys(data || {}).forEach((k) => {
    if (SYSTEM_FIELDS.includes(k)) return;
    if (IMMUTABLE_FIELDS.includes(k)) return;
    if (data[k] !== undefined) out[k] = data[k];
  });
  return out;
}

function computeVerificationStatus(record) {
  const domainOk = !!(record.domain_verified_at);
  const credOk = !!(record.proof_of_possession_verified);
  const testOk = !!(record.test_event_verified);
  if (domainOk && credOk && testOk) return 'fully_verified';
  if (domainOk && credOk) return 'credential_verified';
  if (domainOk) return 'domain_verified';
  return 'unverified';
}

function onboardingComplete(checklist) {
  const steps = ONBOARDING_STEPS.filter((s) => s.key !== 'activated');
  return steps.every((s) => checklist[s.key]);
}


export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, partnerId, data, status } = body;
    const perm = ACTION_PERMS[action];
    if (!perm) return Response.json({ error: 'Unknown action' }, { status: 400 });

    const auth = await authorize(base44, perm);
    if (auth.error) return auth.error;
    const { user } = auth;
    const admin = base44.asServiceRole;

    // ── Create ────────────────────────────────────────────────────────────
    if (action === 'create') {
      const payload = clean(data);
      if (!payload.name) return Response.json({ error: 'Name is required' }, { status: 400 });
      if (!payload.partner_type) return Response.json({ error: 'Partner type is required' }, { status: 400 });

      // Start as linux_integration_pending — Linux must provision credentials.
      payload.integration_status = 'linux_integration_pending';
      payload.active = false;
      payload.verification_status = 'unverified';
      payload.connection_health = 'unconfigured';
      payload.total_events_received = 0;
      payload.total_delivery_failures = 0;
      payload.proof_of_possession_verified = false;
      payload.test_event_verified = false;
      if (!payload.integration_kit_type) payload.integration_kit_type = 'universal_api';
      if (!payload.daily_points_limit) payload.daily_points_limit = 0;
      if (!payload.daily_xp_limit) payload.daily_xp_limit = 0;
      if (!payload.points_per_event) payload.points_per_event = 0;
      if (!payload.xp_per_event) payload.xp_per_event = 0;
      payload.setup_checklist = {
        base44_registered: true,
        credentials_generated: false,
        domain_verified: false,
        admin_reviewed: false,
        linux_api_configured: false,
        partner_implemented: false,
        proof_of_possession: false,
        test_event_verified: false,
        activated: false
      };

      const record = await admin.entities.PartnerIntegration.create(payload);

      // Attempt Linux provisioning.
      const provResult = await provisionViaLinux(admin, record);

      if (!provResult.ok) {
        await writeAudit(admin, { adminId: user.id, action: 'partner_provisioning_pending', entityType: 'PartnerIntegration', entityId: record.id, next: { code: provResult.code } });
        return Response.json({
          ok: true,
          record: sanitizePartnerRecord(record),
          linux_integration_pending: true,
          provisioning_error: provResult.code || 'linux_unavailable',
          message: 'Partner created but Linux provisioning is pending. Retry provisioning once the Linux API is available.'
        });
      }

      await writeAudit(admin, { adminId: user.id, action: 'partner_created', entityType: 'PartnerIntegration', entityId: record.id, next: { name: record.name, linux_api_partner_id: provResult.linux_api_partner_id } });

      return Response.json({
        ok: true,
        record: sanitizePartnerRecord(provResult.record),
        partner_key_id: provResult.partner_key_id,
        partner_secret: provResult.partner_secret,
        domain_verification_token: provResult.domain_verification_token,
        linux_api_partner_id: provResult.linux_api_partner_id
      });
    }

    // ── Retry Provisioning ───────────────────────────────────────────────
    if (action === 'retryProvisioning') {
      if (!partnerId) return Response.json({ error: 'Missing partnerId' }, { status: 400 });
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      // Allow retry for linux_integration_pending, or setup_required if the Linux UUID is missing.
      const needsProvisioning = before.integration_status === 'linux_integration_pending' ||
        (before.integration_status === 'setup_required' && !before.linux_api_partner_id);
      if (!needsProvisioning) {
        return Response.json({ error: 'Partner does not need provisioning retry (already provisioned or not in a retryable state)' }, { status: 400 });
      }

      // If the partner has an old pk_ key ID (Base44-local, not Linux-issued), revoke the old credential.
      if (before.partner_key_id && before.partner_key_id.startsWith('pk_') && !before.linux_api_partner_id) {
        const oldCreds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partnerId });
        for (const c of (oldCreds || [])) {
          if (!c.revoked_at) {
            await admin.entities.PartnerCredential.update(c.id, { revoked_at: new Date().toISOString() });
          }
        }
        await writeAudit(admin, { adminId: user.id, action: 'partner_stale_credential_revoked', entityType: 'PartnerIntegration', entityId: partnerId, next: { old_key_prefix: 'pk_' } });
      }

      const provResult = await provisionViaLinux(admin, before);

      if (!provResult.ok) {
        await writeAudit(admin, { adminId: user.id, action: 'partner_provisioning_retry_failed', entityType: 'PartnerIntegration', entityId: partnerId, next: { code: provResult.code } });
        return Response.json({
          ok: false,
          linux_integration_pending: true,
          error: provResult.error || 'Linux provisioning still unavailable',
          code: provResult.code || 'linux_unavailable'
        }, { status: 503 });
      }

      if (provResult.already_provisioned) {
        return Response.json({
          ok: true,
          already_provisioned: true,
          record: sanitizePartnerRecord(provResult.record),
          linux_api_partner_id: provResult.linux_api_partner_id,
          message: 'Partner is already provisioned with Linux.'
        });
      }

      await writeAudit(admin, { adminId: user.id, action: 'partner_provisioning_completed', entityType: 'PartnerIntegration', entityId: partnerId, next: { linux_api_partner_id: provResult.linux_api_partner_id } });

      return Response.json({
        ok: true,
        record: sanitizePartnerRecord(provResult.record),
        partner_key_id: provResult.partner_key_id,
        partner_secret: provResult.partner_secret,
        domain_verification_token: provResult.domain_verification_token,
        linux_api_partner_id: provResult.linux_api_partner_id
      });
    }

    if (!partnerId) return Response.json({ error: 'Missing partnerId' }, { status: 400 });

    // ── Update ────────────────────────────────────────────────────────────
    if (action === 'update') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const payload = clean(data);
      const record = await admin.entities.PartnerIntegration.update(partnerId, payload);
      await writeAudit(admin, { adminId: user.id, action: 'partner_updated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { name: before.name }, next: payload });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record) });
    }

    // ── Set Status ───────────────────────────────────────────────────────
    if (action === 'setStatus') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const validStatuses = ['pending', 'linux_integration_pending', 'setup_required', 'active', 'suspended', 'disabled', 'archived'];
      if (!validStatuses.includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });

      if (status === 'active') {
        const cl = before.setup_checklist || {};
        // Resume from suspension: partner was already activated before, just flip the status.
        if (before.integration_status === 'suspended' && cl.activated) {
          const record = await admin.entities.PartnerIntegration.update(partnerId, { integration_status: 'active', active: true });
          await writeAudit(admin, { adminId: user.id, action: 'partner_resumed', entityType: 'PartnerIntegration', entityId: partnerId, previous: { integration_status: before.integration_status }, next: { integration_status: 'active' } });
          return Response.json({ ok: true, record: sanitizePartnerRecord(record) });
        }
        // First-time activation requires the independent approval workflow
        // (approvePartnerActivation function), which generates the PS-PARTNER-ACTIVATE
        // signature using PERKSPHERE_PARTNER_APPROVAL_SECRET. This function does NOT
        // generate the approval signature — it must come from the independent process.
        return Response.json({ error: 'First-time partner activation requires independent administrator approval. Use the approvePartnerActivation function, not setStatus.' }, { status: 503 });
      }

      const isActive = status === 'active';
      const record = await admin.entities.PartnerIntegration.update(partnerId, { integration_status: status, active: isActive });
      await writeAudit(admin, { adminId: user.id, action: 'partner_status_changed', entityType: 'PartnerIntegration', entityId: partnerId, previous: { integration_status: before.integration_status }, next: { integration_status: status } });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record) });
    }

    // ── Review Partner ───────────────────────────────────────────────────
    if (action === 'reviewPartner') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const approved = data?.approved !== false;
      const cl = before.setup_checklist || {};
      cl.admin_reviewed = approved;
      const updateFields = { setup_checklist: cl };
      if (!approved) {
        updateFields.integration_status = 'suspended';
        updateFields.active = false;
      }
      const record = await admin.entities.PartnerIntegration.update(partnerId, updateFields);
      await writeAudit(admin, { adminId: user.id, action: approved ? 'partner_review_approved' : 'partner_review_rejected', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record) });
    }

    // ── Verify Domain (delegated to Linux) ───────────────────────────────
    if (action === 'verifyDomain') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (before.linux_api_partner_id) {
        const verifyResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.VERIFY_DOMAIN, { partner_uuid: before.linux_api_partner_id });
        if (!verifyResult.ok) {
          return Response.json({ error: 'Linux domain verification failed: ' + (verifyResult.error || verifyResult.code), code: verifyResult.code }, { status: 503 });
        }
      }
      const now = new Date().toISOString();
      const cl = before.setup_checklist || {};
      cl.domain_verified = true;
      const record = await admin.entities.PartnerIntegration.update(partnerId, {
        setup_checklist: cl,
        domain_verified_at: now,
        verification_status: computeVerificationStatus({ ...before, domain_verified_at: now })
      });
      await writeAudit(admin, { adminId: user.id, action: 'partner_domain_verified', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record) });
    }

    // ── Create Proof Challenge (via Linux) ───────────────────────────────
    if (action === 'createProofChallenge') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (!before.linux_api_partner_id) {
        return Response.json({ error: 'Cannot create proof challenge: partner has not been provisioned by Linux.' }, { status: 400 });
      }
      if (!before.partner_key_id) {
        return Response.json({ error: 'Cannot create proof challenge: partner has no partner_key_id.' }, { status: 400 });
      }
      const challengeResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROOF_CHALLENGE, {
        key_id: before.partner_key_id
      });
      if (!challengeResult.ok) {
        return Response.json({ error: challengeResult.error || 'Proof challenge creation failed', code: challengeResult.code }, { status: challengeResult.status || 503 });
      }
      const challengeData = challengeResult.data || {};
      return Response.json({
        ok: true,
        challenge_id: challengeData.challenge_id,
        challenge: challengeData.challenge,
        expires_in: challengeData.expires_in,
        signing: challengeData.signing
      });
    }

    // ── Verify Proof of Possession (via Linux confirm endpoint) ─────────
    if (action === 'verifyProofOfPossession') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const { challenge_id, challenge, signature } = data || {};
      if (!challenge_id || !challenge || !signature) {
        return Response.json({ error: 'challenge_id, challenge, and signature are required' }, { status: 400 });
      }
      if (!before.partner_key_id) {
        return Response.json({ error: 'Cannot verify proof: partner has no partner_key_id.' }, { status: 400 });
      }

      // Submit the partner's signed response to Linux for confirmation.
      // The signature is HMAC-SHA256(partner_secret, "PS-POSSESSION\n<key_id>\n<challenge_id>\n<challenge>").
      // The original challenge is sent in the X-PS-Possession-Challenge header.
      // Base44 never verifies the signature locally — credentials are only
      // marked verified after Linux confirms proof-of-possession.
      const proofResult = await linuxTrustedPost(
        LINUX_PARTNER_ENDPOINTS.PROOF_CONFIRM,
        { key_id: before.partner_key_id, challenge_id, signature },
        { 'X-PS-Possession-Challenge': challenge }
      );
      if (!proofResult.ok) {
        await writeAudit(admin, { adminId: user.id, action: 'partner_proof_failed', entityType: 'PartnerIntegration', entityId: partnerId, next: { code: proofResult.code } });
        return Response.json({ error: proofResult.error || 'Proof verification failed', code: proofResult.code }, { status: proofResult.status || 400 });
      }

      const now = new Date().toISOString();
      const cl = before.setup_checklist || {};
      cl.proof_of_possession = true;
      const updateFields = {
        setup_checklist: cl,
        proof_of_possession_verified: true,
        proof_of_possession_at: now
      };
      const record = await admin.entities.PartnerIntegration.update(partnerId, updateFields);
      const updated = { ...before, ...updateFields };
      await admin.entities.PartnerIntegration.update(partnerId, { verification_status: computeVerificationStatus(updated) });
      await writeAudit(admin, { adminId: user.id, action: 'partner_proof_verified', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record) });
    }

    // ── Verify Test Event ────────────────────────────────────────────────
    if (action === 'verifyTestEvent') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const testEventId = data?.test_event_id;
      if (testEventId) {
        const events = await admin.entities.PartnerEvent.filter({ partner_integration_id: partnerId, external_event_id: testEventId });
        const evt = (events || [])[0];
        if (!evt || evt.processing_status !== 'processed') {
          return Response.json({ error: 'Test event not found or not successfully processed' }, { status: 400 });
        }
      }
      const now = new Date().toISOString();
      const cl = before.setup_checklist || {};
      cl.test_event_verified = true;
      const updateFields = {
        setup_checklist: cl,
        test_event_verified: true,
        test_event_at: now
      };
      if (testEventId) updateFields.test_event_id = testEventId;
      const record = await admin.entities.PartnerIntegration.update(partnerId, updateFields);
      const updated = { ...before, ...updateFields };
      await admin.entities.PartnerIntegration.update(partnerId, { verification_status: computeVerificationStatus(updated) });
      await writeAudit(admin, { adminId: user.id, action: 'partner_test_event_verified', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record) });
    }

    // ── Update Reward Policy ────────────────────────────────────────────
    if (action === 'updateRewardPolicy') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const policy = {
        daily_points_limit: Number(data?.daily_points_limit) || 0,
        daily_xp_limit: Number(data?.daily_xp_limit) || 0,
        points_per_event: Number(data?.points_per_event) || 0,
        xp_per_event: Number(data?.xp_per_event) || 0
      };
      const record = await admin.entities.PartnerIntegration.update(partnerId, policy);
      await writeAudit(admin, { adminId: user.id, action: 'partner_reward_policy_updated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { daily_points_limit: before.daily_points_limit }, next: policy });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record) });
    }

    // ── Rotate Credential (via Linux) ───────────────────────────────────
    if (action === 'rotateCredential') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (!before.linux_api_partner_id) {
        return Response.json({ error: 'Cannot rotate: partner has no Linux API Partner ID. Use Retry Provisioning to reconcile with Linux first.', code: 'missing_linux_partner_id' }, { status: 400 });
      }

      const rotateResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.ROTATE_CREDENTIAL, { partner_uuid: before.linux_api_partner_id });
      if (!rotateResult.ok) {
        return Response.json({ error: 'Linux credential rotation failed: ' + (rotateResult.error || rotateResult.code), code: rotateResult.code }, { status: 503 });
      }

      const linuxData = rotateResult.data || {};
      const newKeyId = linuxData.partner_key_id;
      const newSecret = linuxData.partner_secret;

      // Revoke old credentials locally.
      const oldCreds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partnerId });
      for (const c of (oldCreds || [])) {
        if (!c.revoked_at) {
          await admin.entities.PartnerCredential.update(c.id, { revoked_at: new Date().toISOString() });
        }
      }

      const updateFields = { partner_key_id: newKeyId };
      if (newSecret) {
        updateFields.partner_secret_hash = await sha256Hex(newSecret);
        const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
        if (encKey) {
          const { ciphertext, iv } = await encryptToken(newSecret, encKey);
          await admin.entities.PartnerCredential.create({
            partner_integration_id: partnerId,
            encrypted_hmac_secret: ciphertext,
            hmac_secret_iv: iv,
            rotated_at: new Date().toISOString()
          });
        }
      }

      const cl = before.setup_checklist || {};
      cl.proof_of_possession = false;
      cl.test_event_verified = false;
      updateFields.setup_checklist = cl;
      updateFields.proof_of_possession_verified = false;
      updateFields.test_event_verified = false;
      updateFields.verification_status = computeVerificationStatus({ ...before, proof_of_possession_verified: false, test_event_verified: false });

      await admin.entities.PartnerIntegration.update(partnerId, updateFields);
      await writeAudit(admin, { adminId: user.id, action: 'partner_credential_rotated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { partner_key_id: before.partner_key_id } });

      return Response.json({ ok: true, partner_key_id: newKeyId, partner_secret: newSecret });
    }

    // ── Revoke Credential (via Linux) ────────────────────────────────────
    if (action === 'revokeCredential') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);

      if (before.linux_api_partner_id) {
        const revokeResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.REVOKE, { partner_uuid: before.linux_api_partner_id });
        if (!revokeResult.ok) {
          return Response.json({ error: 'Linux credential revocation failed: ' + (revokeResult.error || revokeResult.code), code: revokeResult.code }, { status: 503 });
        }
      }

      const creds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partnerId });
      for (const c of (creds || [])) {
        if (!c.revoked_at) {
          await admin.entities.PartnerCredential.update(c.id, { revoked_at: new Date().toISOString() });
        }
      }
      await admin.entities.PartnerIntegration.update(partnerId, { integration_status: 'disabled', active: false });
      await writeAudit(admin, { adminId: user.id, action: 'partner_credential_revoked', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true });
    }

    // ── Update Setup ─────────────────────────────────────────────────────
    if (action === 'updateSetup') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const checklist = data?.setup_checklist || {};
      const linuxApiId = data?.linux_api_partner_id;
      const updateFields = { setup_checklist: checklist };
      // Only allow admin to set linux_api_partner_id if not already set (immutable after confirmation).
      if (linuxApiId !== undefined && !before.linux_api_partner_id) {
        updateFields.linux_api_partner_id = linuxApiId;
      }
      if (!onboardingComplete(checklist) && before.integration_status === 'active') {
        updateFields.integration_status = 'setup_required';
        updateFields.active = false;
      }
      const record = await admin.entities.PartnerIntegration.update(partnerId, updateFields);
      await writeAudit(admin, { adminId: user.id, action: 'partner_setup_updated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { setup_checklist: before.setup_checklist }, next: updateFields });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record) });
    }

    // ── Delete ──────────────────────────────────────────────────────────
    if (action === 'delete') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (before.linux_api_partner_id) {
        waitUntil(linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.REVOKE, { partner_uuid: before.linux_api_partner_id }).catch(() => {}));
      }
      await admin.entities.PartnerIntegration.delete(partnerId);
      await writeAudit(admin, { adminId: user.id, action: 'partner_deleted', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}