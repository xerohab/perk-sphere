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

export async function saveLinuxProvisioning(admin, record, linuxData) {
  const partnerKeyId = linuxData.partner_key_id;
  const partnerSecret = linuxData.partner_secret;
  const linuxPartnerId = linuxData.partner_uuid;
  const domainToken = linuxData.domain_verification_token;
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

export async function provisionViaLinux(admin, record) {
  const result = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROVISION, partnerProvisionRequest(record));
  if (!result.ok) return { ok: false, code: result.code, error: result.error };
  return await saveLinuxProvisioning(admin, record, result.data || {});
}