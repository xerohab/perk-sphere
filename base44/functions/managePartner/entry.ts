import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from "base44:runtime";
import { waitUntil } from "base44:runtime";
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { encryptToken, sha256Hex } from '../../shared/oauth.ts';
import {
  generatePartnerKeyId, generatePartnerSecret,
  generateDomainVerificationToken, generateProofChallenge,
  verifyProofOfPossession, ONBOARDING_STEPS
} from '../../shared/partners.ts';

// Admin partner integration management. All writes go through this permission-checked
// function — the PartnerIntegration entity is write-locked for app users via RLS.
// Partner HMAC secrets are encrypted at rest (AES-GCM) in PartnerCredential and never
// stored in plaintext or exposed to the browser. New integrations default to Setup Required.

const ACTION_PERMS = {
  create: 'partners.manage',
  update: 'partners.manage',
  delete: 'partners.manage',
  rotateCredential: 'partners.manage',
  revokeCredential: 'partners.manage',
  setStatus: 'partners.manage',
  updateSetup: 'partners.manage',
  verifyDomain: 'partners.manage',
  verifyProofOfPossession: 'partners.manage',
  verifyTestEvent: 'partners.manage',
  updateRewardPolicy: 'partners.manage',
  reviewPartner: 'partners.manage'
};

const SYSTEM_FIELDS = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample', 'partner_key_id', 'partner_secret_hash', 'partner_secret'];

function clean(data) {
  const out = {};
  Object.keys(data || {}).forEach((k) => {
    if (SYSTEM_FIELDS.includes(k)) return;
    if (data[k] !== undefined) out[k] = data[k];
  });
  return out;
}

// Compute verification_status from the individual verification flags.
function computeVerificationStatus(record) {
  const domainOk = !!(record.domain_verified_at);
  const credOk = !!(record.proof_of_possession_verified);
  const testOk = !!(record.test_event_verified);
  if (domainOk && credOk && testOk) return 'fully_verified';
  if (domainOk && credOk) return 'credential_verified';
  if (domainOk) return 'domain_verified';
  return 'unverified';
}

// Check if all onboarding steps (except 'activated') are complete.
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

    if (action === 'create') {
      const payload = clean(data);
      if (!payload.name) return Response.json({ error: 'Name is required' }, { status: 400 });
      if (!payload.partner_type) return Response.json({ error: 'Partner type is required' }, { status: 400 });
      payload.integration_status = 'setup_required';
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
      // Generate domain verification token
      payload.domain_verification_token = generateDomainVerificationToken();
      // 8-step onboarding checklist — first two auto-completed
      payload.setup_checklist = {
        base44_registered: true,
        credentials_generated: true,
        domain_verified: false,
        admin_reviewed: false,
        linux_api_configured: false,
        partner_implemented: false,
        proof_of_possession: false,
        test_event_verified: false,
        activated: false
      };
      // Generate credentials
      const keyId = generatePartnerKeyId();
      const secret = generatePartnerSecret();
      payload.partner_key_id = keyId;
      payload.partner_secret_hash = await sha256Hex(secret);
      const record = await admin.entities.PartnerIntegration.create(payload);
      // Store encrypted credential
      const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
      if (encKey) {
        const { ciphertext, iv } = await encryptToken(secret, encKey);
        await admin.entities.PartnerCredential.create({
          partner_integration_id: record.id,
          encrypted_hmac_secret: ciphertext,
          hmac_secret_iv: iv,
          rotated_at: new Date().toISOString()
        });
      }
      await writeAudit(admin, { adminId: user.id, action: 'partner_created', entityType: 'PartnerIntegration', entityId: record.id, next: { name: record.name, partner_type: record.partner_type } });
      // Return the secret ONCE — it is never retrievable again.
      return Response.json({ ok: true, record, partner_key_id: keyId, partner_secret: secret, domain_verification_token: payload.domain_verification_token });
    }

    if (!partnerId) return Response.json({ error: 'Missing partnerId' }, { status: 400 });

    if (action === 'update') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const payload = clean(data);
      const record = await admin.entities.PartnerIntegration.update(partnerId, payload);
      await writeAudit(admin, { adminId: user.id, action: 'partner_updated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { name: before.name, integration_status: before.integration_status }, next: payload });
      return Response.json({ ok: true, record });
    }

    if (action === 'setStatus') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const validStatuses = ['pending', 'setup_required', 'active', 'suspended', 'disabled', 'archived'];
      if (!validStatuses.includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
      // Prevent activation until all onboarding steps (except 'activated') are verified complete.
      if (status === 'active') {
        const cl = before.setup_checklist || {};
        if (!onboardingComplete(cl)) {
          return Response.json({ error: 'Cannot activate: onboarding is not complete. All verification steps must pass first.' }, { status: 400 });
        }
        // Update the 'activated' checklist step
        cl.activated = true;
        await admin.entities.PartnerIntegration.update(partnerId, { setup_checklist: cl });
      }
      const isActive = status === 'active';
      const record = await admin.entities.PartnerIntegration.update(partnerId, { integration_status: status, active: isActive });
      await writeAudit(admin, { adminId: user.id, action: 'partner_status_changed', entityType: 'PartnerIntegration', entityId: partnerId, previous: { integration_status: before.integration_status }, next: { integration_status: status } });
      return Response.json({ ok: true, record });
    }

    if (action === 'reviewPartner') {
      // Admin review step — approve or reject the partner application
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
      return Response.json({ ok: true, record });
    }

    if (action === 'verifyDomain') {
      // Admin confirms the domain verification token is published at the partner's domain.
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const now = new Date().toISOString();
      const cl = before.setup_checklist || {};
      cl.domain_verified = true;
      const record = await admin.entities.PartnerIntegration.update(partnerId, {
        setup_checklist: cl,
        domain_verified_at: now,
        verification_status: computeVerificationStatus({ ...before, domain_verified_at: now })
      });
      await writeAudit(admin, { adminId: user.id, action: 'partner_domain_verified', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true, record });
    }

    if (action === 'verifyProofOfPossession') {
      // The partner submits a signed challenge. We verify it server-side.
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const { challenge, timestamp, nonce, signature } = data || {};
      if (!challenge || !timestamp || !nonce || !signature) {
        return Response.json({ error: 'challenge, timestamp, nonce, and signature are required' }, { status: 400 });
      }
      const result = await verifyProofOfPossession(before, admin, challenge, timestamp, nonce, signature);
      if (!result.ok) {
        await writeAudit(admin, { adminId: user.id, action: 'partner_proof_failed', entityType: 'PartnerIntegration', entityId: partnerId, next: { code: result.code } });
        return Response.json({ error: result.error, code: result.code }, { status: 400 });
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
      // Recompute verification_status
      const updated = { ...before, ...updateFields };
      await admin.entities.PartnerIntegration.update(partnerId, { verification_status: computeVerificationStatus(updated) });
      await writeAudit(admin, { adminId: user.id, action: 'partner_proof_verified', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true, record });
    }

    if (action === 'verifyTestEvent') {
      // Admin confirms a test event was received and processed successfully.
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const testEventId = data?.test_event_id;
      // Look up the test event to confirm it was processed
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
      return Response.json({ ok: true, record });
    }

    if (action === 'updateRewardPolicy') {
      // Per-partner reward policy: daily limits and per-event rewards.
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const policy = {
        daily_points_limit: Number(data?.daily_points_limit) || 0,
        daily_xp_limit: Number(data?.daily_xp_limit) || 0,
        points_per_event: Number(data?.points_per_event) || 0,
        xp_per_event: Number(data?.xp_per_event) || 0
      };
      const record = await admin.entities.PartnerIntegration.update(partnerId, policy);
      await writeAudit(admin, { adminId: user.id, action: 'partner_reward_policy_updated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { daily_points_limit: before.daily_points_limit, daily_xp_limit: before.daily_xp_limit }, next: policy });
      return Response.json({ ok: true, record });
    }

    if (action === 'rotateCredential') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      // Revoke all existing credentials
      const oldCreds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partnerId });
      for (const c of (oldCreds || [])) {
        if (!c.revoked_at) {
          await admin.entities.PartnerCredential.update(c.id, { revoked_at: new Date().toISOString() });
        }
      }
      // Generate new credentials
      const keyId = generatePartnerKeyId();
      const secret = generatePartnerSecret();
      await admin.entities.PartnerIntegration.update(partnerId, { partner_key_id: keyId, partner_secret_hash: await sha256Hex(secret) });
      const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
      if (encKey) {
        const { ciphertext, iv } = await encryptToken(secret, encKey);
        await admin.entities.PartnerCredential.create({
          partner_integration_id: partnerId,
          encrypted_hmac_secret: ciphertext,
          hmac_secret_iv: iv,
          rotated_at: new Date().toISOString()
        });
      }
      // Reset proof-of-possession — new credentials need re-verification
      const cl = before.setup_checklist || {};
      cl.proof_of_possession = false;
      cl.test_event_verified = false;
      await admin.entities.PartnerIntegration.update(partnerId, {
        setup_checklist: cl,
        proof_of_possession_verified: false,
        test_event_verified: false,
        verification_status: computeVerificationStatus({ ...before, proof_of_possession_verified: false, test_event_verified: false })
      });
      await writeAudit(admin, { adminId: user.id, action: 'partner_credential_rotated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { partner_key_id: before.partner_key_id } });
      return Response.json({ ok: true, partner_key_id: keyId, partner_secret: secret });
    }

    if (action === 'revokeCredential') {
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

    if (action === 'updateSetup') {
      const before = await admin.entities.PartnerIntegration.get(partnerId);
      const checklist = data?.setup_checklist || {};
      const linuxApiId = data?.linux_api_partner_id;
      const updateFields = { setup_checklist: checklist };
      if (linuxApiId !== undefined) updateFields.linux_api_partner_id = linuxApiId;
      // If onboarding steps are incomplete and the partner is active, force back to setup_required.
      if (!onboardingComplete(checklist) && before.integration_status === 'active') {
        updateFields.integration_status = 'setup_required';
        updateFields.active = false;
      }
      const record = await admin.entities.PartnerIntegration.update(partnerId, updateFields);
      await writeAudit(admin, { adminId: user.id, action: 'partner_setup_updated', entityType: 'PartnerIntegration', entityId: partnerId, previous: { setup_checklist: before.setup_checklist }, next: updateFields });
      return Response.json({ ok: true, record });
    }

    if (action === 'delete') {
      await admin.entities.PartnerIntegration.delete(partnerId);
      await writeAudit(admin, { adminId: user.id, action: 'partner_deleted', entityType: 'PartnerIntegration', entityId: partnerId });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}