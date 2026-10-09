import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { LINUX_API_BASE, LINUX_PARTNER_ENDPOINTS, linuxTrustedPost } from '../../shared/linuxClient.ts';
import { partnerProvisionRequest, saveLinuxProvisioning } from '../../shared/partnerProvisioning.ts';
import { encryptToken, sha256Hex } from '../../shared/oauth.ts';

// Temporary, admin-only live diagnostic. Fixed host and disposable records only.
// No activation endpoint, task events, account linking or reward operations.
export default async function(req) {
  const report = { test: 'LIVE, no mocks', started_at: new Date().toISOString(), base_url: LINUX_API_BASE, activation_attempted: false, rewards_issued: false };
  let admin;
  let record;
  let provision;
  let linuxPartnerId;
  const sensitive = [];
  function safe(value) {
    let text = String(value || '');
    for (const secret of sensitive) if (secret) text = text.split(secret).join('[REDACTED]');
    return text.replace(/\b[A-Za-z0-9+/_=-]{32,}\b/g, '[REDACTED]').slice(0, 500);
  }
  function resultSummary(result) {
    const localFailure = ['linux_unreachable', 'server_misconfigured'].includes(result.code);
    return { http_status: localFailure ? null : result.status, ok: result.ok, error_code: result.ok ? null : safe(result.code), error_message: result.ok ? null : safe(result.error), response_received: !localFailure };
  }
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const input = await req.json();
    if (input.confirm_disposable_partner_test !== true) return Response.json({ error: 'Explicit disposable test confirmation is required.' }, { status: 400 });
    admin = base44.asServiceRole;
    const keyId = secrets.get('PERKSPHERE_LINUX_KEY_ID') || '';
    const hmacSecret = secrets.get('PERKSPHERE_LINUX_HMAC_SECRET') || '';
    const encryptionKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY') || '';
    sensitive.push(keyId, keyId.trim(), hmacSecret, encryptionKey);
    report.signing = {
      outbound_key_id_configured: !!keyId.trim(), outbound_hmac_secret_configured: !!hmacSecret,
      credential_direction: 'Base44 outbound credentials, not Linux-to-Base44 inbound credentials',
      headers: ['X-PS-Key-ID', 'X-PS-Timestamp', 'X-PS-Nonce', 'X-PS-Signature'],
      algorithm: 'HMAC-SHA256, lowercase hexadecimal',
      canonical_format: 'POST\\n<path>\\n<unix_seconds>\\n<fresh_uuid_nonce>\\n<sha256_hex_exact_JSON_body>',
      secret_encoding: 'Stored UTF-8 verbatim; no trimming, hex or base64 decoding',
      matches_linux_inbound: 'Not established until Linux accepts the signed request'
    };
    const healthStart = Date.now();
    try {
      const response = await fetch(LINUX_API_BASE + '/health', { method: 'GET', signal: AbortSignal.timeout(10000) });
      await response.text();
      report.health = { http_status: response.status, elapsed_ms: Date.now() - healthStart, response_received: true, tls_certificate_validation: 'Default HTTPS verification, not bypassed', server_date: response.headers.get('date') };
    } catch (error) {
      const message = safe(error.message);
      report.health = { http_status: null, response_received: false, error_name: safe(error.name), error_message: message, category: /dns|ENOTFOUND|getaddrinfo|name.*resolv/i.test(message) ? 'DNS' : /tls|ssl|certificat/i.test(message) ? 'TLS' : 'network' };
    }
    let encryptionReady = false;
    try {
      if (encryptionKey) { await encryptToken('live-test-preflight', encryptionKey); encryptionReady = true; }
    } catch (error) { report.encryption_preflight_error = safe(error.message); }
    report.encryption_configured_and_usable = encryptionReady;
    const testName = 'DISPOSABLE LIVE CONNECTIVITY TEST ' + new Date().toISOString() + ' ' + crypto.randomUUID().slice(0, 8);
    record = await admin.entities.PartnerIntegration.create({
      name: testName, description: 'Disposable signed Linux connectivity test. Never activate. No rewards. Revoke and remove after the test.',
      partner_type: 'custom_website', integration_kit_type: 'universal_api', website_url: 'https://perksphere.org',
      verified_domains: ['perksphere.org'], supported_event_types: ['ACCOUNT_REGISTERED'],
      integration_status: 'linux_integration_pending', verification_status: 'unverified', active: false,
      connection_health: 'unconfigured', points_per_event: 0, xp_per_event: 0, daily_points_limit: 0, daily_xp_limit: 0,
      proof_of_possession_verified: false, test_event_verified: false,
      setup_checklist: { base44_registered: true, credentials_generated: false, domain_verified: false, admin_reviewed: false, linux_api_configured: false, partner_implemented: false, proof_of_possession: false, test_event_verified: false, activated: false }
    });
    report.test_partner = { name: testName, base44_partner_reference: record.id };
    provision = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.PROVISION, partnerProvisionRequest(record));
    report.provisioning = { path: LINUX_PARTNER_ENDPOINTS.PROVISION, ...resultSummary(provision) };
    if (provision.ok) {
      const data = provision.data || {};
      sensitive.push(data.partner_key_id, data.partner_secret, data.domain_verification_token);
      linuxPartnerId = typeof data.partner_uuid === 'string' ? data.partner_uuid : null;
      report.provisioning.response_fields_present = { partner_uuid: !!linuxPartnerId, partner_key_id: !!data.partner_key_id, partner_secret: !!data.partner_secret, domain_verification_token: !!data.domain_verification_token };
      report.signing.matches_linux_inbound = true;
      if (!linuxPartnerId || !data.partner_key_id || !data.partner_secret) {
        report.persistence = { verified: false, error: 'Linux success response is missing required provisioning fields.' };
      } else if (!encryptionReady) {
        report.persistence = { verified: false, error: 'Credential encryption preflight failed; no plaintext credentials stored.' };
      } else {
        await saveLinuxProvisioning(admin, record, data);
        const saved = await admin.entities.PartnerIntegration.get(record.id);
        const page = await admin.entities.PartnerCredential.filter({ partner_integration_id: record.id }, { limit: 2, fields: ['partner_integration_id', 'encrypted_hmac_secret', 'hmac_secret_iv'] });
        const credentials = page.items;
        report.persistence = {
          linux_uuid_matches_response: saved.linux_api_partner_id === data.partner_uuid,
          credential_reference_matches_response: saved.partner_key_id === data.partner_key_id,
          secret_hash_matches_response: saved.partner_secret_hash === await sha256Hex(data.partner_secret),
          encrypted_credential_linked_to_partner: credentials.length === 1 && credentials[0].partner_integration_id === record.id && !!credentials[0].encrypted_hmac_secret && !!credentials[0].hmac_secret_iv && credentials[0].encrypted_hmac_secret !== data.partner_secret,
          partner_inactive: saved.active === false, activation_checklist_false: saved.setup_checklist?.activated === false,
          points_per_event: saved.points_per_event, xp_per_event: saved.xp_per_event
        };
      }
    } else {
      report.signing.matches_linux_inbound = false;
      report.persistence = { verified: false, reason: 'Provisioning was rejected; no Linux UUID or credential reference received.' };
    }
  } catch (error) {
    report.application_error = { name: safe(error.name), message: safe(error.message) };
  } finally {
    if (record && admin) {
      try {
        let safeToDelete = false;
        if (linuxPartnerId) {
          const revoked = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.REVOKE, { partner_uuid: linuxPartnerId });
          report.revocation = { path: LINUX_PARTNER_ENDPOINTS.REVOKE, ...resultSummary(revoked) };
          safeToDelete = revoked.ok && revoked.data?.ok !== false;
        } else if (provision && !provision.ok && [400, 401, 403, 404, 422].includes(provision.status)) {
          report.revocation = { required: false, reason: 'Provisioning request rejected before credentials were issued.' };
          safeToDelete = true;
        }
        if (safeToDelete) {
          await admin.entities.PartnerCredential.deleteMany({ partner_integration_id: record.id });
          await admin.entities.PartnerIntegration.delete(record.id);
          const [remainingPartners, remainingCredentials] = await Promise.all([
            admin.entities.PartnerIntegration.count({ id: record.id }),
            admin.entities.PartnerCredential.count({ partner_integration_id: record.id })
          ]);
          report.cleanup = { local_partner_removed: remainingPartners === 0, local_credentials_removed: remainingCredentials === 0 };
        } else {
          await admin.entities.PartnerIntegration.update(record.id, { active: false, integration_status: 'disabled' });
          report.cleanup = { local_partner_removed: false, partner_retained_disabled: true, reason: 'Remote credential revocation or provisioning outcome not confirmed; record retained for safe recovery.' };
        }
      } catch (error) { report.cleanup = { complete: false, error: safe(error.message) }; }
    }
  }
  report.finished_at = new Date().toISOString();
  return Response.json(report);
}