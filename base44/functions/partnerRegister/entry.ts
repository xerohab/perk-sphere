import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { provisionViaLinux } from '../../shared/partnerProvisioning.ts';
import { sanitizePartnerRecord } from '../../shared/partners.ts';

// Public self-service partner registration.
//
// Any visitor can register a new partner integration. The function:
//   1. Validates all inputs (name, website, domain, type, contact, events).
//   2. Rejects duplicates (same domain or exact name).
//   3. Creates a PartnerIntegration record in linux_integration_pending state.
//   4. Attempts Linux provisioning (HMAC credentials + domain verification token).
//   5. Returns DNS setup instructions and one-time credentials on success.
//
// New partners always start inactive (setup_required or linux_integration_pending).
// No activation, no reward issuance, no credential rotation occurs here.
//
// The partner secret is returned exactly once. If lost, the partner must contact
// an administrator for a secure credential handoff or authorised reissue.

const VALID_PARTNER_TYPES = ['custom_website', 'streaming_platform', 'membership_subscription', 'wordpress_woocommerce', 'other'];
const VALID_KIT_TYPES = ['universal_api', 'wordpress_woocommerce', 'streaming_sdk', 'custom'];
const VALID_EVENT_TYPES = [
  'ACCOUNT_REGISTERED', 'ACCOUNT_LINKED', 'ACCOUNT_DISABLED',
  'VIDEO_WATCH_PROGRESS', 'STREAM_STARTED', 'STREAM_VIEW_PROGRESS', 'STREAM_ENDED',
  'PURCHASE_COMPLETED', 'PURCHASE_REFUNDED', 'CHARGEBACK_ISSUED',
  'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELLED'
];

function bad(msg, code) {
  return Response.json({ error: msg, code: code || 'validation_error' }, { status: 400 });
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const admin = base44.asServiceRole;

    const { name, website_url, partner_type, contact_email, description, integration_kit_type, supported_event_types } = body;

    // ── Validate required fields ──────────────────────────────────────────
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return bad('Business or website name is required (minimum 2 characters).');
    }
    if (name.trim().length > 100) {
      return bad('Name must be 100 characters or fewer.');
    }

    if (!website_url || typeof website_url !== 'string') {
      return bad('Website URL is required.');
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(website_url);
    } catch {
      return bad('Website URL is not a valid URL.');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return bad('Website URL must use HTTP or HTTPS.');
    }
    const domain = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
    if (!domain || domain.length < 3 || !domain.includes('.')) {
      return bad('Could not extract a valid domain from the website URL.');
    }

    if (!partner_type || !VALID_PARTNER_TYPES.includes(partner_type)) {
      return bad('Partner type is required and must be one of: ' + VALID_PARTNER_TYPES.join(', ') + '.');
    }

    if (!contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
      return bad('A valid contact email is required.');
    }

    const kitType = integration_kit_type || 'universal_api';
    if (!VALID_KIT_TYPES.includes(kitType)) {
      return bad('Invalid integration kit type.');
    }

    const eventTypes = Array.isArray(supported_event_types)
      ? supported_event_types.filter((et) => VALID_EVENT_TYPES.includes(et))
      : [];
    if (eventTypes.length === 0) {
      return bad('At least one supported event type is required.');
    }

    // ── Duplicate check (same domain or exact name) ──────────────────────
    const byDomain = await admin.entities.PartnerIntegration.filter({ verified_domains: domain }, { limit: 1, fields: ['name'] });
    if (byDomain.items && byDomain.items.length > 0) {
      return Response.json({
        error: 'A partner integration already exists for this domain. Contact the Perk Sphere team if you believe this is an error.',
        code: 'duplicate_domain'
      }, { status: 409 });
    }
    const byName = await admin.entities.PartnerIntegration.filter({ name: name.trim() }, { limit: 1, fields: ['name'] });
    if (byName.items && byName.items.length > 0) {
      return Response.json({
        error: 'A partner with this name already exists. Choose a different name.',
        code: 'duplicate_name'
      }, { status: 409 });
    }

    // ── Create partner record (inactive, pending Linux provisioning) ──────
    const payload = {
      name: name.trim(),
      partner_type,
      integration_kit_type: kitType,
      website_url,
      description: description || '',
      verified_domains: [domain],
      supported_event_types: eventTypes,
      integration_status: 'linux_integration_pending',
      active: false,
      verification_status: 'unverified',
      connection_health: 'unconfigured',
      total_events_received: 0,
      total_delivery_failures: 0,
      proof_of_possession_verified: false,
      test_event_verified: false,
      daily_points_limit: 0,
      daily_xp_limit: 0,
      points_per_event: 0,
      xp_per_event: 0,
      setup_checklist: {
        base44_registered: true,
        credentials_generated: false,
        domain_verified: false,
        admin_reviewed: false,
        linux_api_configured: false,
        partner_implemented: false,
        proof_of_possession: false,
        test_event_verified: false,
        activated: false
      }
    };

    const record = await admin.entities.PartnerIntegration.create(payload);

    // ── Attempt Linux provisioning ───────────────────────────────────────
    const provResult = await provisionViaLinux(admin, record);

    if (!provResult.ok) {
      return Response.json({
        ok: true,
        partner_id: record.id,
        record: sanitizePartnerRecord(record),
        linux_integration_pending: true,
        provisioning_error: provResult.code || 'linux_unavailable',
        dns_setup: null,
        message: 'Partner registered successfully. Linux provisioning is pending — you will receive your DNS verification token and credentials once provisioning completes. An administrator will contact you.'
      });
    }

    // ── Provisioning succeeded — return DNS setup + one-time credentials ─
    return Response.json({
      ok: true,
      partner_id: record.id,
      record: sanitizePartnerRecord(provResult.record),
      partner_key_id: provResult.partner_key_id,
      partner_secret: provResult.partner_secret,
      domain_verification_token: provResult.domain_verification_token,
      linux_api_partner_id: provResult.linux_api_partner_id,
      dns_setup: {
        record_type: 'TXT',
        hostname: `_perksphere.${domain}`,
        txt_value: provResult.domain_verification_token,
        ttl: 3600,
        domain
      },
      message: 'Partner registered successfully. Save your credentials now — the partner secret will not be shown again.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}