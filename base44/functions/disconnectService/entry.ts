import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {
  getProviderSecrets, decryptToken, revokeGoogleToken, revokeXToken,
  ALLOWED_PROVIDERS
} from '../../shared/oauth.ts';

// Authenticated disconnect. The Perk Sphere user is derived from the session.
// Attempts provider token revocation (best-effort, non-fatal on failure), then
// removes/invalidate private credentials and marks ConnectedService metadata
// disconnected. Never affects TrackedAccount destinations, Points/XP balances,
// or unrelated providers.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { provider } = body;
    if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
      return Response.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const now = new Date().toISOString();

    // 1. Find the private credential record.
    const creds = await admin.entities.ConnectedServiceCredential.filter({ user_id: user.id, provider });
    const cred = (creds || [])[0];

    // 2. Attempt token revocation (best-effort).
    if (cred && !cred.revoked_at) {
      const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
      const providerCreds = getProviderSecrets(secrets, provider);
      if (encKey && providerCreds) {
        try {
          const accessToken = await decryptToken(cred.encrypted_access_token, cred.access_token_iv, encKey);
          if (accessToken) {
            if (provider === 'google') await revokeGoogleToken(accessToken);
            else await revokeXToken(accessToken, providerCreds.clientId, providerCreds.clientSecret);
          }
        } catch (_e) { /* revocation failure is non-fatal */ }
      }
    }

    // 3. Remove/invalidate credentials — always, even if revocation failed.
    if (cred) {
      await admin.entities.ConnectedServiceCredential.update(cred.id, {
        encrypted_access_token: '',
        access_token_iv: '',
        encrypted_refresh_token: '',
        refresh_token_iv: '',
        revoked_at: now
      });
    }

    // 4. Mark safe ConnectedService metadata disconnected.
    const conns = await admin.entities.ConnectedService.filter({ user_id: user.id, service: provider });
    const conn = (conns || [])[0];
    if (conn) {
      await admin.entities.ConnectedService.update(conn.id, {
        status: 'disconnected',
        revoked_at: now
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}