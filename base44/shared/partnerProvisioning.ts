import { secrets } from 'base44:runtime';
import { encryptToken, sha256Hex } from './oauth.ts';
import { linuxTrustedPost, LINUX_PARTNER_ENDPOINTS } from './linuxClient.ts';

export function partnerProvisionRequest(record) {
  return {
    base44_partner_reference: record.id,
    name: record.name,
    partner_type: record.partner_type,
    website_url: record.website_url,
    verified_domains: record.verified_domains || [],
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

// Provisions a partner via Linux. Does NOT re-provision if the partner already
// has a linux_api_partner_id — returns the existing record for admin review
// instead of creating a duplicate Linux partner.
export async function provisionViaLinux(admin, record) {
  // If the partner already has a Linux UUID, do not re-provision (prevents duplicates).
  if (record.linux_api_partner_id) {
    console.log('[partnerProvisioning] Partner already has linux_api_partner_id, skipping provisioning. partner=' + record.id);
    return { ok: true, already_provisioned: true, record, linux_api_partner_id: record.linux_api_partner_id };
  }

  const result = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROVISION, partnerProvisionRequest(record));
  if (!result.ok) return { ok: false, code: result.code, error: result.error };

  const saved = await saveLinuxProvisioning(admin, record, result.data || {});
  if (!saved.ok) return saved;
  return { ...saved, already_provisioned: false };
}