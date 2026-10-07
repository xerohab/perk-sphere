// Shared OAuth 2.0 helpers for Connected Services.
// Used by oauthStart, oauthCallback, disconnectService, oauthConfig.
// Tokens are encrypted at rest with AES-GCM using OAUTH_TOKEN_ENCRYPTION_KEY.
// No function in this module reads secrets directly — callers pass the secrets object.

const PROVIDERS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: 'openid email profile',
    secretNames: { clientId: 'GOOGLE_CLIENT_ID', clientSecret: 'GOOGLE_CLIENT_SECRET', redirectUri: 'GOOGLE_REDIRECT_URI' }
  },
  x: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me?user.fields=id,name,username',
    revokeUrl: 'https://api.twitter.com/2/oauth2/revoke',
    scopes: 'users.read',
    secretNames: { clientId: 'X_CLIENT_ID', clientSecret: 'X_CLIENT_SECRET', redirectUri: 'X_REDIRECT_URI' }
  }
};

export const STATE_TTL_MINUTES = 10;
export const ALLOWED_PROVIDERS = ['google', 'x'];

// --- Byte helpers ---

export function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr;
}

export function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hash));
}

// --- State & PKCE ---

export function generateState() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function generateCodeVerifier() {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function computeCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

// --- Token encryption (AES-GCM 256) ---

export async function encryptToken(plaintext, keyHex) {
  if (!plaintext) return { ciphertext: '', iv: '' };
  const key = await crypto.subtle.importKey('raw', hexToBytes(keyHex), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: bytesToHex(new Uint8Array(ct)), iv: bytesToHex(iv) };
}

export async function decryptToken(ciphertextHex, ivHex, keyHex) {
  if (!ciphertextHex || !ivHex) return '';
  const key = await crypto.subtle.importKey('raw', hexToBytes(keyHex), { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(ivHex) }, key, hexToBytes(ciphertextHex));
  return new TextDecoder().decode(pt);
}

// --- Provider config ---

export function getProviderSecrets(secrets, provider) {
  const config = PROVIDERS[provider];
  if (!config) return null;
  const clientId = secrets.get(config.secretNames.clientId);
  const clientSecret = secrets.get(config.secretNames.clientSecret);
  const redirectUri = secrets.get(config.secretNames.redirectUri);
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri, scopes: config.scopes };
}

export function isProviderConfigured(secrets, provider) {
  return !!getProviderSecrets(secrets, provider);
}

export function appBaseUrl(redirectUri) {
  try { return new URL(redirectUri).origin; } catch { return 'https://perksphere.org'; }
}

// --- Auth URL builders ---

export function buildGoogleAuthUrl(clientId, redirectUri, state, codeChallenge, scopes) {
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: scopes, state, code_challenge: codeChallenge, code_challenge_method: 'S256',
    access_type: 'offline', prompt: 'consent'
  });
  return `${PROVIDERS.google.authUrl}?${params}`;
}

export function buildXAuthUrl(clientId, redirectUri, state, codeChallenge, scopes) {
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: scopes, state, code_challenge: codeChallenge, code_challenge_method: 'S256'
  });
  return `${PROVIDERS.x.authUrl}?${params}`;
}

// --- Token exchange ---

export async function exchangeGoogleCode(code, redirectUri, codeVerifier, clientId, clientSecret) {
  const body = new URLSearchParams({
    code, client_id: clientId, client_secret: clientSecret,
    redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: codeVerifier
  });
  const res = await fetch(PROVIDERS.google.tokenUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Google token exchange failed');
  return data;
}

export async function exchangeXCode(code, redirectUri, codeVerifier, clientId, clientSecret) {
  // Confidential-client authentication stays server-side; client_id also remains in the body.
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: redirectUri,
    code_verifier: codeVerifier, client_id: clientId
  });
  const res = await fetch(PROVIDERS.x.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body,
    signal: AbortSignal.timeout(10000)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    // Provider text can echo request credentials: log only status and known OAuth error codes.
    const safeErrors = ['invalid_request', 'invalid_client', 'invalid_grant', 'unauthorized_client',
      'unsupported_grant_type', 'invalid_scope', 'access_denied', 'server_error', 'temporarily_unavailable'];
    const oauthError = safeErrors.includes(data?.error) ? data.error : 'unknown_oauth_error';
    throw new Error(`X token exchange failed: HTTP ${res.status}; OAuth error=${oauthError}`);
  }
  return data;
}

// --- User info ---

export async function getGoogleUserInfo(accessToken) {
  const res = await fetch(PROVIDERS.google.userInfoUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error('Failed to get Google user info');
  return {
    provider_user_id: data.sub,
    provider_email: data.email || null,
    provider_display_name: data.name || null,
    provider_username: null
  };
}

export async function getXUserInfo(accessToken) {
  const res = await fetch(PROVIDERS.x.userInfoUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error('Failed to get X user info');
  const u = data.data || {};
  return {
    provider_user_id: u.id,
    provider_email: null,
    provider_display_name: u.name || null,
    provider_username: u.username || null
  };
}

// --- Token revocation (best-effort, failures are non-fatal) ---

export async function revokeGoogleToken(token) {
  try {
    await fetch(PROVIDERS.google.revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token })
    });
  } catch (_e) { /* non-fatal */ }
}

export async function revokeXToken(token, clientId, clientSecret) {
  try {
    // Revocation uses token + client_id, not authorization-code or PKCE parameters.
    await fetch(PROVIDERS.x.revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({ token, client_id: clientId }),
      signal: AbortSignal.timeout(10000)
    });
  } catch (_e) { /* non-fatal */ }
}