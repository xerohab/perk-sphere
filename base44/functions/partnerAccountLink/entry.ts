import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { waitUntil } from "base44:runtime";
import { sha256Hex } from '../../shared/oauth.ts';
import { sanitizePartnerForUser } from '../../shared/partners.ts';
import { linuxTrustedPost, LINUX_PARTNER_ENDPOINTS } from '../../shared/linuxClient.ts';

// Partner account linking — lets a Perk Sphere user connect a partner account
// to their profile using a signed, single-use challenge.
//
// Linux is the authority for the single-use signed challenge process. Base44
// provides the user interface and authenticated user identity, and delegates
// challenge creation/verification to the Linux API.
//
// Flow:
//   1. User requests a link → Base44 calls Linux to create a challenge.
//   2. Linux returns the challenge token (single-use, expiring).
//   3. The user provides the challenge token to the partner.
//   4. The partner sends an ACCOUNT_LINKED event to Linux with the challenge.
//   5. Linux verifies the challenge and links the accounts.
//   6. Linux notifies Base44 (via trustedActivityBridge or a dedicated endpoint).
//
// Security:
//   - Challenge is single-use (status flips to 'linked' on first use).
//   - Challenge expires after 10 minutes.
//   - Challenge hash is stored, not the token itself (token is returned once).
//   - The partner must be active or setup_required and the user must be authenticated.
//   - Prevents linking someone else's partner account (challenge is user-specific).
//   - Prevents challenge replay (single-use).
//   - Prevents expired challenge reuse (expiry checked).
//   - Prevents cross-partner confusion (challenge is partner-specific).
//   - Prevents duplicate ownership (existing link check).
//
// Response sanitisation:
//   - listPartners and listLinks expose only public or user-authorised information.
//   - No secrets, hashes, or encryption metadata are ever returned.

const CHALLENGE_TTL_MINUTES = 10;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, partnerId } = body;
    const admin = base44.asServiceRole;

    // All actions require an authenticated user.
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Create Challenge (via Linux) ─────────────────────────────────────
    if (action === 'createChallenge') {
      if (!partnerId) return Response.json({ error: 'Missing partnerId' }, { status: 400 });

      const partner = await admin.entities.PartnerIntegration.get(partnerId).catch(() => null);
      if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });
      if (partner.integration_status === 'disabled' || partner.integration_status === 'archived') {
        return Response.json({ error: 'Partner is not available for linking' }, { status: 400 });
      }
      if (partner.integration_status === 'linux_integration_pending') {
        return Response.json({ error: 'Partner provisioning is not yet complete. Please try again later.' }, { status: 400 });
      }

      // Check for an existing active link — prevent duplicate ownership.
      const existing = await admin.entities.ConnectedService.filter({
        user_id: user.id,
        service: 'partner_' + partner.id
      });
      if ((existing || []).some((c) => c.status === 'connected')) {
        return Response.json({ error: 'You already have a linked account with this partner' }, { status: 400 });
      }

      // Delegate challenge creation to Linux (the authority).
      if (!partner.linux_api_partner_id) {
        return Response.json({ error: 'Partner is not provisioned for account linking' }, { status: 400 });
      }

      const challengeResult = await linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_CREATE, {
        partner_uuid: partner.linux_api_partner_id,
        user_reference: user.id
      });

      if (!challengeResult.ok) {
        return Response.json({
          error: 'Account linking is temporarily unavailable. Please try again later.',
          code: challengeResult.code || 'linux_unavailable'
        }, { status: 503 });
      }

      const challengeData = challengeResult.data || {};
      const challenge = challengeData.challenge_token;
      const expiresAt = challengeData.expires_at;

      if (!challenge) {
        return Response.json({ error: 'Failed to create challenge' }, { status: 500 });
      }

      // Store the challenge hash locally for reference (not the token itself).
      const challengeHash = await sha256Hex(challenge);
      const link = await admin.entities.PartnerAccountLink.create({
        user_id: user.id,
        partner_integration_id: partner.id,
        partner_name: partner.name,
        challenge_hash: challengeHash,
        status: 'pending',
        expires_at: expiresAt || new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000).toISOString()
      });

      return Response.json({
        ok: true,
        challenge_token: challenge,
        link_id: link.id,
        partner_name: partner.name,
        expires_at: expiresAt,
        instructions: `Send an ACCOUNT_LINKED event to the Linux API with this challenge_token and your account reference. The challenge expires in ${CHALLENGE_TTL_MINUTES} minutes.`
      });
    }

    // ── List Links (sanitized) ───────────────────────────────────────────
    if (action === 'listLinks') {
      const links = await admin.entities.PartnerAccountLink.filter({ user_id: user.id });
      const connected = await admin.entities.ConnectedService.filter({ user_id: user.id });
      const partnerLinks = (connected || []).filter((c) => c.service?.startsWith('partner_'));

      // Sanitize: only return user-authorised information — no challenge hashes or tokens.
      const sanitizedLinks = (links || []).map((l) => ({
        id: l.id,
        partner_name: l.partner_name,
        partner_integration_id: l.partner_integration_id,
        status: l.status,
        linked_at: l.linked_at,
        partner_account_reference: l.partner_account_reference
      }));

      const sanitizedConnected = partnerLinks.map((c) => ({
        id: c.id,
        service: c.service,
        account_handle: c.account_handle,
        status: c.status,
        connected_at: c.connected_at
      }));

      return Response.json({ ok: true, links: sanitizedLinks, connected: sanitizedConnected });
    }

    // ── Unlink (via Linux) ───────────────────────────────────────────────
    if (action === 'unlink') {
      const { connectedServiceId } = body;
      if (!connectedServiceId) return Response.json({ error: 'Missing connectedServiceId' }, { status: 400 });

      const conn = await admin.entities.ConnectedService.get(connectedServiceId).catch(() => null);
      if (!conn || conn.user_id !== user.id) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }

      // Notify Linux of the unlink (best-effort).
      if (conn.service?.startsWith('partner_')) {
        const pid = conn.service.replace('partner_', '');
        const partner = await admin.entities.PartnerIntegration.get(pid).catch(() => null);
        if (partner?.linux_api_partner_id) {
          waitUntil(linuxTrustedPost(LINUX_PARTNER_ENDPOINTS.ACCOUNT_LINK_UNLINK, {
            partner_uuid: partner.linux_api_partner_id,
            user_reference: user.id
          }).catch(() => {}));
        }
      }

      await admin.entities.ConnectedService.update(connectedServiceId, {
        status: 'disconnected',
        revoked_at: new Date().toISOString()
      });

      // Mark any linked challenges as unlinked.
      if (conn.service?.startsWith('partner_')) {
        const pid = conn.service.replace('partner_', '');
        const pendingLinks = await admin.entities.PartnerAccountLink.filter({
          user_id: user.id,
          partner_integration_id: pid,
          status: 'linked'
        });
        for (const l of (pendingLinks || [])) {
          await admin.entities.PartnerAccountLink.update(l.id, {
            status: 'unlinked',
            unlinked_at: new Date().toISOString()
          });
        }
      }
      return Response.json({ ok: true });
    }

    // ── List Partners (sanitized — public info only) ─────────────────────
    if (action === 'listPartners') {
      const partners = await admin.entities.PartnerIntegration.list('-created_date', 200);
      const available = (partners || []).filter((p) =>
        p.integration_status === 'active' || p.integration_status === 'setup_required'
      );
      // Sanitize: only return public fields — no secrets, hashes, or internal info.
      return Response.json({ ok: true, partners: available.map(sanitizePartnerForUser) });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}