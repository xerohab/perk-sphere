import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {
  generateState, generateCodeVerifier, computeCodeChallenge, sha256Hex,
  getProviderSecrets, buildGoogleAuthUrl, buildXAuthUrl,
  STATE_TTL_MINUTES, ALLOWED_PROVIDERS
} from '../../shared/oauth.ts';

// Authenticated OAuth start. The Perk Sphere user is derived from the session —
// the frontend never supplies a user_id. Generates cryptographic state + PKCE,
// persists a short-lived OAuthConnectionState record (service-only), and returns
// only the safe authorization URL. Never returns client secrets, PKCE verifier,
// or stored credentials.
// Bundle refresh: X identity authorization requests the documented tweet.read users.read scopes.
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

    const creds = getProviderSecrets(secrets, provider);
    if (!creds) {
      return Response.json({ error: 'provider_not_configured', message: `${provider} is not configured.` }, { status: 503 });
    }

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await computeCodeChallenge(codeVerifier);
    const stateHash = await sha256Hex(state);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + STATE_TTL_MINUTES * 60 * 1000);

    const admin = base44.asServiceRole;
    await admin.entities.OAuthConnectionState.create({
      state_hash: stateHash,
      user_id: user.id,
      provider,
      code_verifier: codeVerifier,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      used_at: null
    });

    const authUrl = provider === 'google'
      ? buildGoogleAuthUrl(creds.clientId, creds.redirectUri, state, codeChallenge, creds.scopes)
      : buildXAuthUrl(creds.clientId, creds.redirectUri, state, codeChallenge, creds.scopes);

    return Response.json({ ok: true, authorization_url: authUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}