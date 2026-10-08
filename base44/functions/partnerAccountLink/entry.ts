import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { sha256Hex } from '../../shared/oauth.ts';
import { generateAccountLinkChallenge } from '../../shared/partners.ts';

// Partner account linking — lets a Perk Sphere user connect a partner account
// to their profile using a signed, single-use challenge.
//
// Flow:
//   1. User requests a link → this function creates a PartnerAccountLink with a
//      challenge token (single-use, expiring in 10 minutes).
//   2. The user provides the challenge token to the partner (or the partner site
//      reads it from a redirect/URL parameter).
//   3. The partner sends an ACCOUNT_LINKED event (via partnerEventIngest) with
//      the challenge token + the user's partner account reference.
//   4. partnerEventIngest verifies the challenge hash, links the accounts, and
//      creates a ConnectedService record.
//
// Security:
//   - Challenge is single-use (status flips to 'linked' on first use).
//   - Challenge expires after 10 minutes.
//   - Challenge hash is stored, not the token itself (token is returned once).
//   - The partner must be active and the user must be authenticated.
//   - Prevents linking someone else's partner account (challenge is user-specific).
//   - Prevents challenge replay (single-use).
//   - Prevents expired challenge reuse (expiry checked).
//   - Prevents cross-partner confusion (challenge is partner-specific).
//   - Prevents duplicate ownership (existing link check).

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

    if (action === 'createChallenge') {
      // User wants to link a partner account. Generate a challenge.
      if (!partnerId) return Response.json({ error: 'Missing partnerId' }, { status: 400 });

      // Verify the partner exists and is active (or at least setup_required —
      // allow linking during setup so test events can flow).
      const partner = await admin.entities.PartnerIntegration.get(partnerId).catch(() => null);
      if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });
      if (partner.integration_status === 'disabled' || partner.integration_status === 'archived') {
        return Response.json({ error: 'Partner is not available for linking' }, { status: 400 });
      }

      // Check for an existing active link — prevent duplicate ownership.
      const existing = await admin.entities.ConnectedService.filter({
        user_id: user.id,
        service: 'partner_' + partner.id
      });
      if ((existing || []).some((c) => c.status === 'connected')) {
        return Response.json({ error: 'You already have a linked account with this partner' }, { status: 400 });
      }

      // Generate the challenge.
      const challenge = generateAccountLinkChallenge();
      const challengeHash = await sha256Hex(challenge);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MINUTES * 60 * 1000);

      const link = await admin.entities.PartnerAccountLink.create({
        user_id: user.id,
        partner_integration_id: partner.id,
        partner_name: partner.name,
        challenge_hash: challengeHash,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      });

      return Response.json({
        ok: true,
        challenge_token: challenge,
        link_id: link.id,
        partner_name: partner.name,
        expires_at: expiresAt.toISOString(),
        instructions: `Send an ACCOUNT_LINKED event with this challenge_token and your account reference. The challenge expires in ${CHALLENGE_TTL_MINUTES} minutes.`
      });
    }

    if (action === 'listLinks') {
      // List the user's partner account links.
      const links = await admin.entities.PartnerAccountLink.filter({ user_id: user.id });
      const connected = await admin.entities.ConnectedService.filter({ user_id: user.id });
      const partnerLinks = (connected || []).filter((c) => c.service?.startsWith('partner_'));
      return Response.json({ ok: true, links: links || [], connected: partnerLinks || [] });
    }

    if (action === 'unlink') {
      // User wants to unlink a partner account.
      const { connectedServiceId } = body;
      if (!connectedServiceId) return Response.json({ error: 'Missing connectedServiceId' }, { status: 400 });

      const conn = await admin.entities.ConnectedService.get(connectedServiceId).catch(() => null);
      if (!conn || conn.user_id !== user.id) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      await admin.entities.ConnectedService.update(connectedServiceId, {
        status: 'disconnected',
        revoked_at: new Date().toISOString()
      });
      // Mark any pending link challenges as unlinked
      if (conn.service?.startsWith('partner_')) {
        const partnerId = conn.service.replace('partner_', '');
        const pendingLinks = await admin.entities.PartnerAccountLink.filter({
          user_id: user.id,
          partner_integration_id: partnerId,
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

    if (action === 'listPartners') {
      // List partners available for account linking (active or setup_required).
      const partners = await admin.entities.PartnerIntegration.list('-created_date', 200);
      const available = (partners || []).filter((p) =>
        p.integration_status === 'active' || p.integration_status === 'setup_required'
      );
      return Response.json({ ok: true, partners: available });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}