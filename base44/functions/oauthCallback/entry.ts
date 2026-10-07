import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {
  sha256Hex, getProviderSecrets, appBaseUrl,
  exchangeGoogleCode, exchangeXCode, getGoogleUserInfo, getXUserInfo,
  encryptToken, ALLOWED_PROVIDERS
} from '../../shared/oauth.ts';

// OAuth callback endpoint. The provider redirects the user's browser here with
// code + state (GET). Validates state against the server-side OAuthConnectionState
// (rejects unknown/expired/already-used), exchanges the code server-side, retrieves
// provider identity, encrypts tokens with AES-GCM, stores credentials in the
// service-only ConnectedServiceCredential entity, updates safe ConnectedService
// metadata, then redirects to /connected-services with a non-sensitive status.
// Tokens never appear in the redirect URL.
export default async function(req) {
  let provider = null;
  let baseUrl = 'https://perk-sphere-hub.base44.app';

  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;

    const url = new URL(req.url);
    provider = url.searchParams.get('provider') || 'google';
    if (!ALLOWED_PROVIDERS.includes(provider)) provider = 'google';

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const creds = getProviderSecrets(secrets, provider);
    if (!creds) {
      return Response.redirect(`${baseUrl}/connected-services?status=error&provider=${provider}&reason=not_configured`, 302);
    }
    baseUrl = appBaseUrl(creds.redirectUri);

    if (error) {
      return Response.redirect(`${baseUrl}/connected-services?status=error&provider=${provider}&reason=${encodeURIComponent(error)}`, 302);
    }
    if (!code || !state) {
      return Response.redirect(`${baseUrl}/connected-services?status=error&provider=${provider}&reason=missing_params`, 302);
    }

    // 1. Validate state — must exist, not expired, not already used.
    const stateHash = await sha256Hex(state);
    const states = await admin.entities.OAuthConnectionState.filter({ state_hash: stateHash, provider });
    const stateRec = (states || [])[0];
    if (!stateRec) {
      return Response.redirect(`${baseUrl}/connected-services?status=error&provider=${provider}&reason=invalid_state`, 302);
    }
    if (stateRec.used_at) {
      return Response.redirect(`${baseUrl}/connected-services?status=error&provider=${provider}&reason=state_used`, 302);
    }
    if (new Date(stateRec.expires_at) < new Date()) {
      return Response.redirect(`${baseUrl}/connected-services?status=error&provider=${provider}&reason=state_expired`, 302);
    }

    // 2. Consume state (single use).
    await admin.entities.OAuthConnectionState.update(stateRec.id, { used_at: new Date().toISOString() });

    // 3. Exchange code for tokens server-side.
    let tokenData, userInfo;
    if (provider === 'google') {
      tokenData = await exchangeGoogleCode(code, creds.redirectUri, stateRec.code_verifier, creds.clientId, creds.clientSecret);
      userInfo = await getGoogleUserInfo(tokenData.access_token);
    } else {
      tokenData = await exchangeXCode(code, creds.redirectUri, stateRec.code_verifier, creds.clientId, creds.clientSecret);
      userInfo = await getXUserInfo(tokenData.access_token);
    }

    // 4. Encrypt tokens at rest.
    const encKey = secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY');
    if (!encKey) {
      return Response.redirect(`${baseUrl}/connected-services?status=error&provider=${provider}&reason=encryption_key_missing`, 302);
    }
    const encAccess = await encryptToken(tokenData.access_token, encKey);
    const encRefresh = await encryptToken(tokenData.refresh_token || '', encKey);
    const now = new Date();
    const tokenExpiry = tokenData.expires_in
      ? new Date(now.getTime() + tokenData.expires_in * 1000).toISOString()
      : null;

    // 5. Update safe ConnectedService metadata (service-only write).
    const existingConn = await admin.entities.ConnectedService.filter({ user_id: stateRec.user_id, service: provider });
    const connData = {
      user_id: stateRec.user_id,
      service: provider,
      status: 'connected',
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
    let connectedServiceId;
    if (existingConn[0]) {
      await admin.entities.ConnectedService.update(existingConn[0].id, connData);
      connectedServiceId = existingConn[0].id;
    } else {
      const connRec = await admin.entities.ConnectedService.create(connData);
      connectedServiceId = connRec.id;
    }

    // 6. Store encrypted credentials (service-only entity).
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

    return Response.redirect(`${baseUrl}/connected-services?status=connected&provider=${provider}`, 302);
  } catch (error) {
    return Response.redirect(`${baseUrl}/connected-services?status=error&provider=${provider || 'google'}&reason=callback_failed`, 302);
  }
}