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
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/youtube/v3/channels',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: 'https://www.googleapis.com/auth/youtube.readonly',
    secretNames: { clientId: 'YOUTUBE_CLIENT_ID', clientSecret: 'YOUTUBE_CLIENT_SECRET', redirectUri: 'YOUTUBE_REDIRECT_URI' }
  },
  x: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me?user.fields=id,name,username',
    revokeUrl: 'https://api.twitter.com/2/oauth2/revoke',
    scopes: 'tweet.read users.read',
    secretNames: { clientId: 'X_CLIENT_ID', clientSecret: 'X_CLIENT_SECRET', redirectUri: 'X_REDIRECT_URI' }
  }
};

export const STATE_TTL_MINUTES = 10;
export const ALLOWED_PROVIDERS = ['google', 'youtube', 'x'];

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
  if (typeof keyHex !== 'string' || !/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error('invalid_token_encryption_key');
  const key = await crypto.subtle.importKey('raw', hexToBytes(keyHex), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: bytesToHex(new Uint8Array(ct)), iv: bytesToHex(iv) };
}

export async function decryptToken(ciphertextHex, ivHex, keyHex) {
  if (!ciphertextHex && !ivHex) return '';
  if (typeof keyHex !== 'string' || !/^[a-f0-9]{64}$/i.test(keyHex) || typeof ivHex !== 'string' || !/^[a-f0-9]{24}$/i.test(ivHex) || typeof ciphertextHex !== 'string' || !/^(?:[a-f0-9]{2}){16,}$/i.test(ciphertextHex)) throw new Error('invalid_encrypted_token');
  const key = await crypto.subtle.importKey('raw', hexToBytes(keyHex), { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(ivHex) }, key, hexToBytes(ciphertextHex));
  return new TextDecoder().decode(pt);
}

// Validate provider evidence before it can become connected-account metadata.
export function validateOAuthTokens(data, now = Date.now()) {
  if (!data || typeof data !== 'object' || typeof data.access_token !== 'string' ||
      !/^[\x21-\x7e]{1,16384}$/.test(data.access_token) ||
      typeof data.token_type !== 'string' || data.token_type.toLowerCase() !== 'bearer' ||
      (data.refresh_token !== undefined && typeof data.refresh_token !== 'string') ||
      (data.scope !== undefined && typeof data.scope !== 'string') ||
      (data.expires_in !== undefined && (!Number.isSafeInteger(data.expires_in) || data.expires_in <= 0 ||
        !Number.isFinite(new Date(now + data.expires_in * 1000).getTime())))) {
    throw new Error('invalid_oauth_token_response');
  }
  return data;
}

export function validateProviderIdentity(provider, identity) {
  const id = identity?.provider_user_id;
  const valid = typeof id === 'string' && (provider === 'youtube' ? /^UC[A-Za-z0-9_-]{22}$/.test(id) :
    provider === 'x' ? /^[1-9][0-9]{0,24}$/.test(id) :
    provider === 'google' ? /^[A-Za-z0-9_-]{1,255}$/.test(id) : false);
  if (!valid) throw new Error('invalid_provider_identity');
  return identity;
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
  const res = await fetch(PROVIDERS.x.userInfoUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    // Never forward raw provider text: it may echo credentials. Only known-safe diagnostics are logged.
    const safeCodes = ['invalid_request', 'invalid_token', 'insufficient_scope', 'invalid_scope',
      'unauthorized_client', 32, 89, 99, 135, 215, 220, 429, 453];
    const safeTitles = ['Bad Request', 'Unauthorized', 'Forbidden', 'Client Forbidden',
      'Unsupported Authentication', 'Not Found', 'Too Many Requests', 'UsageCapExceeded',
      'CreditsDepleted', 'Payment Required', 'Internal Server Error', 'Service Unavailable'];
    const safeMessages = ['Could not authenticate you.', 'Invalid or expired token.',
      'Bad Authentication data.', 'You are not permitted to access this resource.',
      'Your client app is not configured with the appropriate oauth1 app permissions for this endpoint.',
      'Rate limit exceeded.', 'Insufficient scope.', 'Insufficient permissions.'];
    const providerCode = data?.error ?? data?.errors?.[0]?.code;
    const providerMessage = data?.detail ?? data?.error_description ?? data?.errors?.[0]?.message;
    const code = safeCodes.includes(providerCode) ? providerCode : 'not_returned_or_unrecognized';
    const title = safeTitles.includes(data?.title) ? data.title : 'Provider error';
    const message = !data ? 'Invalid JSON response' : safeMessages.includes(providerMessage)
      ? providerMessage : 'Provider detail omitted for safety';
    throw new Error(`X identity lookup failed: HTTP ${res.status}; code=${code}; title=${title}; message=${message}`);
  }
  const u = data.data || {};
  return {
    provider_user_id: u.id,
    provider_email: null,
    provider_display_name: u.name || null,
    provider_username: u.username || null
  };
}


export async function getYouTubeUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true&maxResults=2', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error('YouTube identity lookup failed: HTTP ' + res.status);
  if (!Array.isArray(data.items) || data.items.length !== 1 || data.nextPageToken) {
    throw new Error('YouTube requires one selected channel');
  }
  const channel = data.items[0];
  if (typeof channel.id !== 'string' || !/^UC[A-Za-z0-9_-]{22}$/.test(channel.id)) {
    throw new Error('Invalid YouTube channel identity');
  }
  return {
    provider_user_id: channel.id,
    provider_email: null,
    provider_display_name: typeof channel.snippet?.title === 'string' ? channel.snippet.title : null,
    provider_username: typeof channel.snippet?.customUrl === 'string' ? channel.snippet.customUrl : null
  };
}

// --- Token revocation (best-effort, failures are non-fatal) ---

export async function revokeGoogleToken(token) {
  try {
    await fetch(PROVIDERS.google.revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10000)
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
// OAuth responses must not be cached or forward authorization URLs as referrers.
export function privateOAuthResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Referrer-Policy', 'no-referrer');
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
}
