import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {
  sha256Hex, getProviderSecrets,
  exchangeGoogleCode, exchangeXCode, getGoogleUserInfo, getXUserInfo, getYouTubeUserInfo,
  encryptToken, validateOAuthTokens, validateProviderIdentity, ALLOWED_PROVIDERS, privateOAuthResponse
} from '../../shared/oauth.ts';

// OAuth callback endpoint. The provider redirects the user's browser here with
// code + state (GET). Validates state against the server-side OAuthConnectionState
// (rejects unknown/expired/already-used), exchanges the code server-side, retrieves
// provider identity, encrypts tokens with AES-GCM, stores credentials in the
// service-only ConnectedServiceCredential entity, updates safe ConnectedService
// metadata, then redirects to /connected-services with a non-sensitive status.
// Tokens never appear in the redirect URL.
//
// Stage-specific error codes allow safe diagnosis without exposing secrets.
// Bundle refresh: final browser redirect uses the server-controlled production frontend origin
// (https://perksphere.org), not the Base44 function callback origin.

function redirectError(baseUrl, provider, reason) {
  return Response.redirect(`${baseUrl}/connected-services?status=error&provider=${provider}&reason=${reason}`, 302);
}

async function handleOAuthCallback(req) {
  let provider = null;
  let baseUrl = 'https://perksphere.org';

  try {
    if (req.method !== 'GET') return Response.json({error:'method_not_allowed'},{status:405,headers:{'Cache-Control':'no-store'}});
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;

    const url = new URL(req.url);
    provider = url.searchParams.get('provider') || 'google';
    if (!ALLOWED_PROVIDERS.includes(provider)) return redirectError(baseUrl, 'google', 'provider_invalid');

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const creds = getProviderSecrets(secrets, provider);
    if (!creds) {
      return redirectError(baseUrl, provider, 'provider_not_configured');
    }

    if (error) {
      console.error(`oauthCallback[${provider}] provider_error`);
      return redirectError(baseUrl, provider, 'provider_error');
    }
    if (!code || !state || !/^[a-f0-9]{64}$/.test(state)) {
      return redirectError(baseUrl, provider, 'missing_params');
    }

    // Stage 1: Validate state — must exist, not expired, not already used.
    const stateHash = await sha256Hex(state);
    const states = await admin.entities.OAuthConnectionState.filter({ state_hash: stateHash, provider });
    const stateRec = (states || [])[0];
    if (states.length !== 1 || !stateRec || typeof stateRec.user_id !== 'string' || !stateRec.user_id || typeof stateRec.code_verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(stateRec.code_verifier)) {
      return redirectError(baseUrl, provider, 'state_invalid');
    }
    if (stateRec.used_at) {
      return redirectError(baseUrl, provider, 'state_used');
    }
    if (typeof stateRec.expires_at !== 'string' || !Number.isFinite(Date.parse(stateRec.expires_at)) || Date.parse(stateRec.expires_at) <= Date.now()) {
      return redirectError(baseUrl, provider, 'state_expired');
    }

    // The account may have been disabled after OAuth was started.
    const memberIsEligible = async () => {
      const member = await admin.entities.User.get(stateRec.user_id).catch(() => null);
      return member?.id === stateRec.user_id && !['suspended','banned','disabled'].includes(member.account_status);
    };
    if (!await memberIsEligible()) return redirectError(baseUrl, provider, 'account_unavailable');

    // Stage 2: Consume state (single use, before token exchange for CSRF safety).
    await admin.entities.OAuthConnectionState.update(stateRec.id, { used_at: new Date().toISOString() });

    // Stage 3: Token exchange.
    let tokenData;
    try {
      if (provider !== 'x') {
        tokenData = await exchangeGoogleCode(code, creds.redirectUri, stateRec.code_verifier, creds.clientId, creds.clientSecret);
      } else {
        tokenData = await exchangeXCode(code, creds.redirectUri, stateRec.code_verifier, creds.clientId, creds.clientSecret);
      }
      validateOAuthTokens(tokenData);
    } catch (e) {
      console.error(`oauthCallback[${provider}] token_exchange_failed`);
      return redirectError(baseUrl, provider, 'token_exchange_failed');
    }

    // Stage 4: Identity lookup.
    let userInfo;
    try {
      if (provider === 'youtube') {
        userInfo = await getYouTubeUserInfo(tokenData.access_token);
      } else if (provider === 'google') {
        userInfo = await getGoogleUserInfo(tokenData.access_token);
      } else {
        userInfo = await getXUserInfo(tokenData.access_token);
      }
      validateProviderIdentity(provider, userInfo);
    } catch (e) {
      console.error(`oauthCallback[${provider}] provider_identity_failed`);
      return redirectError(baseUrl, provider, 'provider_identity_failed');
    }

    // Recheck after provider I/O before persisting credentials.
    if (!await memberIsEligible()) return redirectError(baseUrl, provider, 'account_unavailable');

    // Stage 5: Encrypt tokens at rest.
    const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
    if (!encKey) {
      console.error('oauthCallback: encryption_key_missing');
      return redirectError(baseUrl, provider, 'credential_encryption_failed');
    }
    let encAccess, encRefresh;
    try {
      encAccess = await encryptToken(tokenData.access_token, encKey);
      encRefresh = await encryptToken(tokenData.refresh_token || '', encKey);
    } catch (e) {
      console.error(`oauthCallback[${provider}] credential_encryption_failed`);
      return redirectError(baseUrl, provider, 'credential_encryption_failed');
    }

    const now = new Date();
    const tokenExpiry = tokenData.expires_in
      ? new Date(now.getTime() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Stage 6: Update safe ConnectedService metadata (service-only write).
    let connectedServiceId;
    try {
      const existingConn = await admin.entities.ConnectedService.filter({ user_id: stateRec.user_id, service: provider });
      const connData = {
        user_id: stateRec.user_id,
        service: provider,
        status: 'pending',
        external_account_id: userInfo.provider_user_id,
        account_handle: userInfo.provider_username || userInfo.provider_display_name || null,
        connected_at: now.toISOString(),
        provider_user_id: userInfo.provider_user_id,
        provider_username: userInfo.provider_username,
        provider_display_name: userInfo.provider_display_name,
        provider_email: userInfo.provider_email,
        token_expiry: tokenExpiry,
        scopes: tokenData.scope || creds.scopes,
        revoked_at: null
      };
      if (existingConn[0]) {
        await admin.entities.ConnectedService.update(existingConn[0].id, connData);
        connectedServiceId = existingConn[0].id;
      } else {
        const connRec = await admin.entities.ConnectedService.create(connData);
        connectedServiceId = connRec.id;
      }
    } catch (e) {
      console.error(`oauthCallback[${provider}] connection_storage_failed`);
      return redirectError(baseUrl, provider, 'connection_storage_failed');
    }

    // Stage 7: Store encrypted credentials (service-only entity).
    try {
      const existingCred = await admin.entities.ConnectedServiceCredential.filter({ user_id: stateRec.user_id, provider });
      const credData = {
        user_id: stateRec.user_id,
        provider,
        connected_service_id: connectedServiceId,
        encrypted_access_token: encAccess.ciphertext,
        access_token_iv: encAccess.iv,
        encrypted_refresh_token: encRefresh.ciphertext,
        refresh_token_iv: encRefresh.iv,
        token_expiry: tokenExpiry,
        scopes: tokenData.scope || creds.scopes,
        provider_user_id: userInfo.provider_user_id,
        revoked_at: null
      };
      if (existingCred[0]) {
        await admin.entities.ConnectedServiceCredential.update(existingCred[0].id, credData);
      } else {
        await admin.entities.ConnectedServiceCredential.create(credData);
      }
    } catch (e) {
      console.error(`oauthCallback[${provider}] credential_storage_failed`);
      return redirectError(baseUrl, provider, 'credential_storage_failed');
    }

    // Publish connected status only after credentials were stored successfully.
    try {
      await admin.entities.ConnectedService.update(connectedServiceId, {status:'connected'});
    } catch {
      return redirectError(baseUrl, provider, 'connection_storage_failed');
    }
    return Response.redirect(`${baseUrl}/connected-services?status=connected&provider=${provider}`, 302);
  } catch (error) {
    console.error(`oauthCallback[${provider || 'unknown'}] unexpected_error`);
    return redirectError(baseUrl, provider || 'google', 'callback_failed');
  }
}
async function perkSphereHandler(req) { return privateOAuthResponse(await handleOAuthCallback(req)); }
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
