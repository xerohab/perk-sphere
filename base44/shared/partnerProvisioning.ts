import { secrets } from 'base44:runtime';
import { encryptToken, sha256Hex } from './oauth.ts';
import { linuxTrustedPost, LINUX_PARTNER_ENDPOINTS } from './linuxClient.ts';

export function normalizePartnerDomain(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('domain_required');
  const text=value.trim();
  const parsed=new URL(text.includes('://') ? text : 'https://' + text);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash || !['','/'].includes(parsed.pathname)) throw new Error('invalid_partner_domain');
  const host=parsed.hostname.toLowerCase();
  if (host.length>253 || !host.includes('.') || !host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error('invalid_partner_domain');
  return host;
}
export function partnerProvisionRequest(record) {
  return {
    base44_partner_reference: record.id,
    name: record.name,
    partner_type: record.partner_type,
    website_url: record.website_url,
    verified_domains: (record.verified_domains || []).map(normalizePartnerDomain),
    supported_event_types: record.supported_event_types || []
  };
}

// Saves a Linux provisioning response to the Base44 partner record.
// Validates that the Linux response contains all required fields before saving.
// Does NOT re-provision if the partner already has a linux_api_partner_id.
export async function saveLinuxProvisioning(admin, record, linuxData) {
  const partnerKeyId = linuxData.partner_key_id;
  const partnerSecret = linuxData.partner_secret;
  const linuxPartnerId = linuxData.partner_uuid;
  const domainToken = linuxData.domain_verification_token;

  // Validate required fields from the Linux response.
  if (!linuxPartnerId) {
    console.log('[partnerProvisioning] WARNING: Linux provisioning response missing partner_uuid');
    return { ok: false, code: 'linux_response_incomplete', error: 'Linux provisioning response is missing partner_uuid.' };
  }
  if (!partnerKeyId) {
    console.log('[partnerProvisioning] WARNING: Linux provisioning response missing partner_key_id');
    return { ok: false, code: 'linux_response_incomplete', error: 'Linux provisioning response is missing partner_key_id.' };
  }

  // Linux issues psp_ prefixed key IDs. A pk_ prefix indicates a stale
  // Base44-local identifier from an older code version — log a warning.
  if (partnerKeyId.startsWith('pk_') && !partnerKeyId.startsWith('psp_')) {
    console.log('[partnerProvisioning] WARNING: Linux returned pk_ prefixed key_id (expected psp_). partner=' + record.id);
  }

  const updateFields = {
    integration_status: 'setup_required',
    linux_api_partner_id: linuxPartnerId,
    partner_key_id: partnerKeyId,
    domain_verification_token: domainToken || null
  };

  if (partnerSecret) {
    updateFields.partner_secret_hash = await sha256Hex(partnerSecret);
    const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
    if (encKey) {
      const { ciphertext, iv } = await encryptToken(partnerSecret, encKey);
      await admin.entities.PartnerCredential.create({
        partner_integration_id: record.id,
        encrypted_hmac_secret: ciphertext,
        hmac_secret_iv: iv,
        rotated_at: new Date().toISOString()
      });
    }
  }

  const cl = record.setup_checklist || {};
  cl.credentials_generated = true;
  cl.linux_api_configured = true;
  updateFields.setup_checklist = cl;

  const updated = await admin.entities.PartnerIntegration.update(record.id, updateFields);
  return { ok: true, record: updated, partner_key_id: partnerKeyId, partner_secret: partnerSecret, domain_verification_token: domainToken, linux_api_partner_id: linuxPartnerId };
}

// Saves a NEW Linux-issued credential (from rotation, initial reissue, or
// recovery) to Base44. Revokes all old credentials, stores the new secret
// encrypted (AES-GCM), updates the key ID + hash, and resets proof-of-possession
// and test-event verification (the new credential must be re-verified).
//
// Never restores revoked credentials — always issues and stores a fresh one.
// Preserves linux_api_partner_id (immutable), domain verification, and audit
// history. Returns { ok, record, partner_key_id, partner_secret }.
export async function saveLinuxCredential(admin, partnerId, before, linuxData) {
  const newKeyId = linuxData.partner_key_id;
  const newSecret = linuxData.partner_secret;
  if (!newKeyId) {
    return { ok: false, code: 'linux_response_incomplete', error: 'Linux response is missing partner_key_id.' };
  }

  // Revoke all old credentials locally.
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

  // New credential must re-pass proof-of-possession and test-event verification.
  const cl = before.setup_checklist || {};
  cl.proof_of_possession = false;
  cl.test_event_verified = false;
  updateFields.setup_checklist = cl;
  updateFields.proof_of_possession_verified = false;
  updateFields.test_event_verified = false;
  updateFields.verification_status = computeVerificationStatusFromFields({
    ...before, proof_of_possession_verified: false, test_event_verified: false
  });

  const record = await admin.entities.PartnerIntegration.update(partnerId, updateFields);
  return { ok: true, record, partner_key_id: newKeyId, partner_secret: newSecret };
}

// Computes the verification status from individual flags (mirrors the logic in
// managePartner.computeVerificationStatus without importing the function).
function computeVerificationStatusFromFields(record) {
  const domainOk = !!(record.domain_verified_at);
  const credOk = !!(record.proof_of_possession_verified);
  const testOk = !!(record.test_event_verified);
  if (domainOk && credOk && testOk) return 'fully_verified';
  if (domainOk && credOk) return 'credential_verified';
  if (domainOk) return 'domain_verified';
  return 'unverified';
}

// Provisions a partner via Linux. Does NOT re-provision if the partner already
// has a linux_api_partner_id — returns the existing record for admin review
// instead of creating a duplicate Linux partner.
export async function provisionViaLinux(admin, record) {
  // If the partner already has a Linux UUID, do not re-provision (prevents duplicates).
  if (record.linux_api_partner_id) {
    console.log('[partnerProvisioning] Partner already has linux_api_partner_id, skipping provisioning. partner=' + record.id);
    return { ok: true, already_provisioned: true, record, linux_api_partner_id: record.linux_api_partner_id };
  }

  let request;
  try { request = partnerProvisionRequest(record); }
  catch { return {ok:false,code:'invalid_partner_domain',error:'Enter a valid HTTPS site hostname or root URL.'}; }
  const result = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROVISION, request);
  if (!result.ok) {
    // Linux returns 409 partner_already_provisioned when a partner with the same
    // base44_partner_reference already exists but the UUID was not saved in Base44.
    // The admin must obtain the UUID from the Linux API team and use setLinuxPartnerId.
    if (result.code === 'partner_already_provisioned') {
      return {
        ok: false,
        code: 'partner_already_provisioned',
        error: 'Partner was already provisioned on Linux but the UUID is not saved in Base44. Obtain the partner_uuid from the Linux API team and use the setLinuxPartnerId action to enter it manually.',
        status: result.status
      };
    }
    return { ok: false, code: result.code, error: result.error };
  }

  const saved = await saveLinuxProvisioning(admin, record, result.data || {});
  if (!saved.ok) return saved;
  return { ...saved, already_provisioned: false };
}