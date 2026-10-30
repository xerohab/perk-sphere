import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {
  generateState, generateCodeVerifier, computeCodeChallenge, sha256Hex,
  getProviderSecrets, buildGoogleAuthUrl, buildXAuthUrl,
  STATE_TTL_MINUTES, ALLOWED_PROVIDERS, privateOAuthResponse
} from '../../shared/oauth.ts';

// Authenticated OAuth start. The Perk Sphere user is derived from the session —
// the frontend never supplies a user_id. Generates cryptographic state + PKCE,
// persists a short-lived OAuthConnectionState record (service-only), and returns
// only the safe authorization URL. Never returns client secrets, PKCE verifier,
// or stored credentials.
// Bundle refresh: X identity authorization requests the documented tweet.read users.read scopes.
async function handleOAuthStart(req) {
  try {
    if (req.method !== 'POST') return Response.json({error:'method_not_allowed'}, {status:405,headers:{Allow:'POST'}});
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (['suspended','banned','disabled'].includes(user.account_status)) return Response.json({error:'Account is not permitted to connect services'}, {status:403});

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).join(',') !== 'provider') return Response.json({error:'invalid_request'}, {status:400});
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

    const authUrl = provider !== 'x'
      ? buildGoogleAuthUrl(creds.clientId, creds.redirectUri, state, codeChallenge, creds.scopes)
      : buildXAuthUrl(creds.clientId, creds.redirectUri, state, codeChallenge, creds.scopes);

    return Response.json({ ok: true, authorization_url: authUrl });
  } catch {
    return Response.json({ error: 'Account connection is temporarily unavailable. Please retry.' }, { status: 503 });
  }
}
async function perkSphereHandler(req) { return privateOAuthResponse(await handleOAuthStart(req)); }
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
