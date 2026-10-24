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
import { saveLinuxCredential } from '../../shared/partnerProvisioning.ts';
import { LINUX_ENDPOINT_CONTRACT_CONFIRMED } from '../../shared/linuxClient.ts';

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
  reissueInitialCredential: 'partners.manage',
  recoverPartner: 'partners.manage',
  revokeCredential: 'partners.manage',
  setStatus: 'partners.manage',
  updateSetup: 'partners.manage',
  verifyDomain: 'partners.manage',
  createProofChallenge: 'partners.manage',
  verifyProofOfPossession: 'partners.manage',
  syncProofStatus: 'partners.manage',
  verifyTestEvent: 'partners.manage',
  updateRewardPolicy: 'partners.manage',
  reviewPartner: 'partners.manage',
  retryProvisioning: 'partners.manage',
  setLinuxPartnerId: 'partners.manage'
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


async function perkSphereHandler(req) {
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
        if (provResult.code === 'partner_already_provisioned') {
          return Response.json({
            ok: false,
            code: 'partner_already_provisioned',
            error: provResult.error,
            action_required: 'setLinuxPartnerId'
          }, { status: 409 });
        }
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

    // ── Set Linux Partner ID (manual reconciliation) ──────────────────────
    if (action === 'setLinuxPartnerId') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const { linux_api_partner_id } = data || {};
      if (!linux_api_partner_id || typeof linux_api_partner_id !== 'string') {
        return Response.json({ error: 'Missing or invalid linux_api_partner_id' }, { status: 400 });
      }
      // Basic UUID format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(linux_api_partner_id)) {
        return Response.json({ error: 'linux_api_partner_id must be a valid UUID' }, { status: 400 });
      }
      const record = await admin.entities.PartnerIntegration.update(partnerId, {
        linux_api_partner_id,
        integration_status: before.integration_status === 'linux_integration_pending' ? 'setup_required' : before.integration_status
      });
      await writeAudit(admin, {
        adminId: user.id,
        action: 'partner_linux_id_manually_set',
        entityType: 'PartnerIntegration',
        entityId: partnerId,
        previous: { linux_api_partner_id: before.linux_api_partner_id },
        next: { linux_api_partner_id }
      });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record), message: 'Linux Partner ID set. You can now use Rotate Credential to issue new credentials.' });
    }

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
    // Linux checks the DNS TXT record (or well-known file) for the partner's
    // domain verification token. Base44 only marks domain_verified after Linux
    // confirms. Proof-of-possession and test-event verification are preserved
    // (never reset by this action).
    //
    // Linux response codes:
    //   200 { verified: true }              → success, mark domain_verified
    //   422 domain_verification_failed      → DNS record not found (retryable —
    //                                         likely DNS caching; do NOT retry
    //                                         automatically, allow manual retry)
    //   503/500                             → Linux server error
    if (action === 'verifyDomain') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (!before.linux_api_partner_id) {
        return Response.json({ error: 'Cannot verify domain: partner has no Linux API Partner ID.', code: 'missing_linux_partner_id' }, { status: 400 });
      }
      const verifyResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.VERIFY_DOMAIN, { partner_uuid: before.linux_api_partner_id });
      if (!verifyResult.ok) {
        const linuxStatus = verifyResult.status || 0;
        const code = verifyResult.code || 'unknown';
        const isVerificationFailed = linuxStatus === 422 || code === 'domain_verification_failed';
        await writeAudit(admin, { adminId: user.id, action: 'partner_domain_verification_failed', entityType: 'PartnerIntegration', entityId: partnerId, next: { linux_status: linuxStatus, code } });
        return Response.json({
          ok: false,
          error: verifyResult.error || 'Domain verification failed',
          code,
          linux_status: linuxStatus,
          retryable: isVerificationFailed,
          message: isVerificationFailed
            ? `Linux could not find the DNS TXT record (HTTP ${linuxStatus}, code: ${code}). This may be due to DNS caching. Wait a few minutes and retry manually. No changes were made to the partner record.`
            : `Linux domain verification endpoint error (HTTP ${linuxStatus}, code: ${code}). Try again later.`
        }, { status: isVerificationFailed ? 422 : 503 });
      }
      const now = new Date().toISOString();
      const cl = before.setup_checklist || {};
      cl.domain_verified = true;
      const record = await admin.entities.PartnerIntegration.update(partnerId, {
        setup_checklist: cl,
        domain_verified_at: now,
        verification_status: computeVerificationStatus({ ...before, domain_verified_at: now })
      });
      await writeAudit(admin, { adminId: user.id, action: 'partner_domain_verified', entityType: 'PartnerIntegration', entityId: partnerId, next: { linux_status: verifyResult.status } });
      return Response.json({ ok: true, record: sanitizePartnerRecord(record), linux_status: verifyResult.status, verified: true });
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

    // ── Sync Proof Status (query Linux, update Base44) ──────────────────
    // Queries the Linux API for the authoritative proof-of-possession status
    // of the partner's current pending credential. If Linux confirms
    // possession_verified: true, the Base44 record is updated to match.
    // Does NOT blindly mark all partners verified — only updates based on
    // authoritative Linux evidence.
    if (action === 'syncProofStatus') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (!before.linux_api_partner_id) {
        return Response.json({ error: 'Cannot sync proof status: partner has no Linux API Partner ID.', code: 'missing_linux_partner_id' }, { status: 400 });
      }
      if (!LINUX_ENDPOINT_CONTRACT_CONFIRMED.PROOF_STATUS) {
        await writeAudit(admin, { adminId: user.id, action: 'partner_proof_sync_blocked_contract_pending', entityType: 'PartnerIntegration', entityId: partnerId });
        return Response.json({
          ok: false,
          code: 'linux_contract_pending',
          error: 'The Linux proof-status query endpoint has not been confirmed yet (POST /partners/proof-status returned 404 on live testing). No live request was made. Until the Linux API team provides a confirmed proof-status endpoint, use the challenge/confirm flow (createProofChallenge + verifyProofOfPossession) to verify proof of possession for any partner.',
          partner_uuid: before.linux_api_partner_id,
          current_proof_verified: before.proof_of_possession_verified
        }, { status: 503 });
      }
      const result = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROOF_STATUS, { partner_uuid: before.linux_api_partner_id });
      if (!result.ok) {
        return Response.json({ error: result.error || 'Proof status query failed', code: result.code, linux_status: result.status }, { status: 503 });
      }
      const data = result.data || {};
      if (data.proof_of_possession_verified === true && data.partner_uuid === before.linux_api_partner_id && data.partner_key_id === before.partner_key_id && ['pending', 'active'].includes(data.credential_status)) {
        const verifiedAt = data.possession_verified_at || new Date().toISOString();
        const cl = before.setup_checklist || {};
        cl.proof_of_possession = true;
        const updateFields = {
          setup_checklist: cl,
          proof_of_possession_verified: true,
          proof_of_possession_at: verifiedAt
        };
        const record = await admin.entities.PartnerIntegration.update(partnerId, updateFields);
        const updated = { ...before, ...updateFields };
        await admin.entities.PartnerIntegration.update(partnerId, { verification_status: computeVerificationStatus(updated) });
        await writeAudit(admin, { adminId: user.id, action: 'partner_proof_status_synced', entityType: 'PartnerIntegration', entityId: partnerId, next: { possession_verified: true, verified_at: verifiedAt } });
        return Response.json({ ok: true, record: sanitizePartnerRecord(record), linux_status: result.status, possession_verified: true, possession_verified_at: verifiedAt });
      }
      await writeAudit(admin, { adminId: user.id, action: 'partner_proof_status_checked', entityType: 'PartnerIntegration', entityId: partnerId, next: { possession_verified: false } });
      return Response.json({ ok: true, record: sanitizePartnerRecord(before), linux_status: result.status, possession_verified: false, message: 'Linux has not yet confirmed proof of possession for this partner.' });
    }

    // ── Verify Test Event ────────────────────────────────────────────────
    if (action === 'verifyTestEvent') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (!before.linux_api_partner_id || !before.partner_key_id) {
        return Response.json({ ok: false, code: 'missing_linux_identity', error: 'Partner Linux identity or credential is missing.' }, { status: 400 });
      }
      if (!LINUX_ENDPOINT_CONTRACT_CONFIRMED.TEST_EVENT_STATUS) {
        return Response.json({ ok: false, code: 'linux_contract_pending', error: 'Linux test-event verification endpoint is not confirmed.' }, { status: 503 });
      }
      const result = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.TEST_EVENT_STATUS, {
        partner_uuid: before.linux_api_partner_id
      });
      if (!result.ok) {
        return Response.json({ ok: false, code: result.code || 'linux_status_failed', error: result.error || 'Linux test-event status unavailable.', linux_status: result.status }, { status: 503 });
      }
      const evidence = result.data || {};
      if (evidence.ok !== true || evidence.partner_uuid !== before.linux_api_partner_id ||
          evidence.partner_key_id !== before.partner_key_id || evidence.test_only !== true ||
          evidence.test_event_verified !== true ||
          typeof evidence.receipt_uuid !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(evidence.receipt_uuid) ||
          typeof evidence.validated_at !== 'string' ||
          !Number.isFinite(Date.parse(evidence.validated_at)) ||
          typeof evidence.event_type !== 'string' || !evidence.event_type) {
        await writeAudit(admin, { adminId: user.id, action: 'partner_test_evidence_not_confirmed', entityType: 'PartnerIntegration', entityId: partnerId });
        return Response.json({ ok: true, test_event_verified: false, message: 'Linux has not confirmed a signed test event for the current partner credential.' });
      }
      const cl = { ...(before.setup_checklist || {}), test_event_verified: true };
      const fields = { setup_checklist: cl, test_event_verified: true, verification_status: computeVerificationStatus({ ...before, test_event_verified: true }) };
      const record = await admin.entities.PartnerIntegration.update(partnerId, fields);
      await writeAudit(admin, { adminId: user.id, action: 'partner_test_event_verified_from_linux', entityType: 'PartnerIntegration', entityId: partnerId, next: { receipt_uuid: evidence.receipt_uuid, key_id: evidence.partner_key_id, validated_at: evidence.validated_at, event_type: evidence.event_type } });
      return Response.json({ ok: true, test_event_verified: true, record: sanitizePartnerRecord(record), receipt_uuid: evidence.receipt_uuid });
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

    // ── Rotate Credential (ACTIVE partners only, via Linux) ────────────
    // Rotation is for partners that are already active with a live credential.
    // setup_required partners must use reissueInitialCredential instead —
    // Linux prepareCredentialRotation requires an active, enabled, verified
    // partner with an existing active credential and no pending credential.
    if (action === 'rotateCredential') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (!before.linux_api_partner_id) {
        return Response.json({ error: 'Cannot rotate: partner has no Linux API Partner ID. Use Retry Provisioning to reconcile with Linux first.', code: 'missing_linux_partner_id' }, { status: 400 });
      }
      if (before.integration_status !== 'active') {
        return Response.json({
          error: `Credential rotation is only available for active partners. This partner is "${before.integration_status}". Use "Reissue Initial Credential" for setup_required partners or "Recover Partner" for revoked/disabled partners.`,
          code: 'rotation_requires_active_partner',
          current_status: before.integration_status
        }, { status: 400 });
      }

      const rotateResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.ROTATE_CREDENTIAL, { partner_uuid: before.linux_api_partner_id });
      if (!rotateResult.ok) {
        const code = rotateResult.code || 'unknown';
        const status = rotateResult.status || 0;
        let userMessage;
        if (code === 'partner_management_unavailable') {
          userMessage = `Linux partner management is currently unavailable (HTTP ${status}). The rotation endpoint exists but the service is not accepting requests. Try again later or contact the Linux API team to enable credential rotation.`;
        } else if (code === 'partner_unavailable') {
          userMessage = `Partner is not available on Linux (HTTP ${status}). The partner may have been revoked or disabled. Contact the Linux API team to restore the partner before rotating credentials.`;
        } else if (code === 'invalid_signature' || code === 'unknown_key_id') {
          userMessage = `Linux authentication failed (HTTP ${status}, code: ${code}). The Base44 service HMAC credentials may be misconfigured.`;
        } else {
          userMessage = `Linux credential rotation failed (HTTP ${status}, code: ${code}). ${rotateResult.error || ''}`.trim();
        }
        return Response.json({ error: userMessage, code, linux_status: status }, { status: 503 });
      }

      const saved = await saveLinuxCredential(admin, partnerId, before, rotateResult.data || {});
      if (!saved.ok) {
        return Response.json({ error: saved.error, code: saved.code }, { status: 500 });
      }
      await writeAudit(admin, { adminId: user.id, action: 'partner_credential_rotated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { partner_key_id: before.partner_key_id } });

      return Response.json({ ok: true, partner_key_id: saved.partner_key_id, partner_secret: saved.partner_secret });
    }

    // ── Reissue Initial Credential (setup_required partners) ───────────
    // For partners that have not completed onboarding (setup_required) and
    // need their initial credential reissued — e.g. the original secret was
    // lost, or provisioning partially failed. This is distinct from rotation
    // (which requires an active partner with a live credential).
    //
    // Uses a dedicated Linux endpoint whose contract is PENDING confirmation.
    // No live request is made until the Linux API team confirms the endpoint
    // path and request/response schema and LINUX_ENDPOINT_CONTRACT_CONFIRMED
    // .REISSUE_INITIAL_CREDENTIAL is set to true.
    if (action === 'reissueInitialCredential') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (!before.linux_api_partner_id) {
        return Response.json({ error: 'Cannot reissue: partner has no Linux API Partner ID. Use Retry Provisioning or Set UUID to reconcile with Linux first.', code: 'missing_linux_partner_id' }, { status: 400 });
      }
      if (before.integration_status === 'active') {
        return Response.json({ error: 'Active partners must use credential rotation, not initial reissue.', code: 'use_rotation_for_active' }, { status: 400 });
      }

      if (!LINUX_ENDPOINT_CONTRACT_CONFIRMED.REISSUE_INITIAL_CREDENTIAL) {
        await writeAudit(admin, { adminId: user.id, action: 'partner_initial_reissue_blocked_contract_pending', entityType: 'PartnerIntegration', entityId: partnerId });
        return Response.json({
          ok: false,
          code: 'linux_contract_pending',
          error: 'The Linux initial credential reissue endpoint contract has not been confirmed yet. No live request was made. Once the Linux API team provides the confirmed endpoint path and request schema, update LINUX_PARTNER_ENDPOINTS.REISSUE_INITIAL_CREDENTIAL and set LINUX_ENDPOINT_CONTRACT_CONFIRMED.REISSUE_INITIAL_CREDENTIAL to true.',
          partner_uuid: before.linux_api_partner_id,
          current_status: before.integration_status
        }, { status: 503 });
      }

      const reissueResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.REISSUE_INITIAL_CREDENTIAL, { partner_uuid: before.linux_api_partner_id });
      if (!reissueResult.ok) {
        const code = reissueResult.code || 'unknown';
        return Response.json({ error: `Linux initial credential reissue failed (HTTP ${reissueResult.status}, code: ${code}). ${reissueResult.error || ''}`.trim(), code, linux_status: reissueResult.status }, { status: 503 });
      }

      const saved = await saveLinuxCredential(admin, partnerId, before, reissueResult.data || {});
      if (!saved.ok) {
        return Response.json({ error: saved.error, code: saved.code }, { status: 500 });
      }
      await writeAudit(admin, { adminId: user.id, action: 'partner_initial_credential_reissued', entityType: 'PartnerIntegration', entityId: partnerId, previous: { partner_key_id: before.partner_key_id } });

      return Response.json({ ok: true, partner_key_id: saved.partner_key_id, partner_secret: saved.partner_secret });
    }

    // ── Recover Partner (revoked/disabled partners) ───────────────────
    // Admin-only recovery for partners that were accidentally revoked or
    // disabled. Issues NEW credentials — never restores revoked ones.
    // Preserves the Linux partner UUID (immutable), domain verification, and
    // audit history. The partner is moved back to setup_required so onboarding
    // can resume.
    //
    // Uses a dedicated Linux endpoint whose contract is PENDING confirmation.
    // No live request is made until the Linux API team confirms the endpoint
    // path and request/response schema and LINUX_ENDPOINT_CONTRACT_CONFIRMED
    // .RECOVER_PARTNER is set to true.
    if (action === 'recoverPartner') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      if (!before.linux_api_partner_id) {
        return Response.json({ error: 'Cannot recover: partner has no Linux API Partner ID.', code: 'missing_linux_partner_id' }, { status: 400 });
      }
      if (before.integration_status === 'active') {
        return Response.json({ error: 'Active partners do not need recovery. Use credential rotation instead.', code: 'use_rotation_for_active' }, { status: 400 });
      }

      if (!LINUX_ENDPOINT_CONTRACT_CONFIRMED.RECOVER_PARTNER) {
        await writeAudit(admin, { adminId: user.id, action: 'partner_recovery_blocked_contract_pending', entityType: 'PartnerIntegration', entityId: partnerId });
        return Response.json({
          ok: false,
          code: 'linux_contract_pending',
          error: 'The Linux partner recovery endpoint contract has not been confirmed yet. No live request was made. Once the Linux API team provides the confirmed endpoint path and request schema, update LINUX_PARTNER_ENDPOINTS.RECOVER_PARTNER and set LINUX_ENDPOINT_CONTRACT_CONFIRMED.RECOVER_PARTNER to true.',
          partner_uuid: before.linux_api_partner_id,
          current_status: before.integration_status
        }, { status: 503 });
      }

      const recoverResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.RECOVER_PARTNER, { partner_uuid: before.linux_api_partner_id });
      if (!recoverResult.ok) {
        const code = recoverResult.code || 'unknown';
        return Response.json({ error: `Linux partner recovery failed (HTTP ${recoverResult.status}, code: ${code}). ${recoverResult.error || ''}`.trim(), code, linux_status: recoverResult.status }, { status: 503 });
      }

      const saved = await saveLinuxCredential(admin, partnerId, before, recoverResult.data || {});
      if (!saved.ok) {
        return Response.json({ error: saved.error, code: saved.code }, { status: 500 });
      }
      // Move back to setup_required so onboarding can resume. Do NOT activate.
      const record = await admin.entities.PartnerIntegration.update(partnerId, { integration_status: 'setup_required', active: false });
      await writeAudit(admin, { adminId: user.id, action: 'partner_recovered', entityType: 'PartnerIntegration', entityId: partnerId, previous: { integration_status: before.integration_status }, next: { integration_status: 'setup_required' } });

      return Response.json({ ok: true, record: sanitizePartnerRecord(record), partner_key_id: saved.partner_key_id, partner_secret: saved.partner_secret });
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
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
