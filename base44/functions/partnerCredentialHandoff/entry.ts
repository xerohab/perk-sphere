import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { decryptToken, sha256Hex } from '../../shared/oauth.ts';
import { sanitizePartnerRecord } from '../../shared/partners.ts';

// Secure, one-time administrator credential handoff for partner applications.
//
// Two-step process with short expiry and single-use access:
//   1. request — admin requests handoff → server generates a one-time token,
//      stores its SHA-256 hash + 5-minute expiry on the PartnerIntegration record,
//      returns the plaintext token to the admin.
//   2. retrieve — admin (or partner operator) submits the token → server verifies
//      the hash + expiry + not-yet-used, decrypts the partner HMAC secret, returns
//      the partner_key_id and partner_secret, then clears the token (single-use).
//
// Security:
//   - Both actions require admin auth with partners.manage permission.
//   - The token hash is stored, never the plaintext token.
//   - The token expires after 5 minutes.
//   - The token is single-use — cleared immediately after retrieval.
//   - The decrypted secret is returned only in the response body, never logged.
//   - All access is recorded in the audit log.
//   - Plaintext secrets are never recovered from hashes — only decrypted from
//     the AES-GCM encrypted PartnerCredential record.

const HANDOFF_TTL_MINUTES = 5;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, partnerId, token } = body;

    if (action !== 'request' && action !== 'retrieve') {
      return Response.json({ error: 'Unknown action. Use request or retrieve.' }, { status: 400 });
    }
    if (!partnerId) return Response.json({ error: 'Missing partnerId' }, { status: 400 });

    const auth = await authorize(base44, 'partners.manage');
    if (auth.error) return auth.error;
    const { user } = auth;
    const admin = base44.asServiceRole;

    const partner = await admin.entities.PartnerIntegration.get(partnerId).catch(() => null);
    if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });

    // ── Request: generate one-time token ──────────────────────────────────
    if (action === 'request') {
      if (!partner.linux_api_partner_id) {
        return Response.json({ error: 'Partner has not been provisioned by Linux. Use Retry Provisioning first.', code: 'not_provisioned' }, { status: 400 });
      }
      // Check that a credential exists.
      const creds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partnerId });
      const activeCred = (creds || []).find((c) => !c.revoked_at);
      if (!activeCred) {
        return Response.json({ error: 'No active credential found. Rotate the credential first.', code: 'no_credential' }, { status: 400 });
      }

      // Generate a one-time token (32 random bytes hex).
      const handoffToken = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const tokenHash = await sha256Hex(handoffToken);
      const expiresAt = new Date(Date.now() + HANDOFF_TTL_MINUTES * 60 * 1000).toISOString();

      await admin.entities.PartnerIntegration.update(partnerId, {
        credential_handoff_token_hash: tokenHash,
        credential_handoff_expires_at: expiresAt
      });

      await writeAudit(admin, { adminId: user.id, action: 'partner_credential_handoff_requested', entityType: 'PartnerIntegration', entityId: partnerId });

      return Response.json({
        ok: true,
        handoff_token: handoffToken,
        expires_at: expiresAt,
        expires_in_minutes: HANDOFF_TTL_MINUTES,
        partner_name: partner.name,
        instructions: 'Use this token with the retrieve action within ' + HANDOFF_TTL_MINUTES + ' minutes. The token is single-use.'
      });
    }

    // ── Retrieve: verify token and return credentials ────────────────────
    if (action === 'retrieve') {
      if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

      // Verify the token hash.
      const tokenHash = await sha256Hex(token);
      if (!partner.credential_handoff_token_hash || partner.credential_handoff_token_hash !== tokenHash) {
        return Response.json({ error: 'Invalid or expired token', code: 'invalid_token' }, { status: 403 });
      }
      // Check expiry.
      if (partner.credential_handoff_expires_at && new Date(partner.credential_handoff_expires_at) < new Date()) {
        // Clear the expired token.
        await admin.entities.PartnerIntegration.update(partnerId, { credential_handoff_token_hash: null, credential_handoff_expires_at: null });
        return Response.json({ error: 'Token has expired. Request a new handoff.', code: 'token_expired' }, { status: 403 });
      }

      // Decrypt the partner secret.
      const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
      if (!encKey) {
        return Response.json({ error: 'Server encryption key not configured', code: 'server_misconfigured' }, { status: 500 });
      }
      const creds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partnerId });
      const activeCred = (creds || []).find((c) => !c.revoked_at);
      if (!activeCred) {
        return Response.json({ error: 'No active credential found', code: 'no_credential' }, { status: 404 });
      }

      let partnerSecret;
      try {
        partnerSecret = await decryptToken(activeCred.encrypted_hmac_secret, activeCred.hmac_secret_iv, encKey);
      } catch (_e) {
        return Response.json({ error: 'Failed to decrypt credential', code: 'decrypt_failed' }, { status: 500 });
      }

      // Clear the token (single-use).
      await admin.entities.PartnerIntegration.update(partnerId, {
        credential_handoff_token_hash: null,
        credential_handoff_expires_at: null
      });

      await writeAudit(admin, { adminId: user.id, action: 'partner_credential_handoff_retrieved', entityType: 'PartnerIntegration', entityId: partnerId });

      return Response.json({
        ok: true,
        partner_name: partner.name,
        partner_key_id: partner.partner_key_id,
        partner_secret: partnerSecret,
        linux_api_partner_id: partner.linux_api_partner_id,
        instructions: 'Configure these credentials in the partner application secrets as PERKSPHERE_PARTNER_KEY_ID and PERKSPHERE_PARTNER_HMAC_SECRET. This is the only time the secret will be shown.'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}