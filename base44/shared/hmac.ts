// HMAC-SHA256 service-to-service authentication for the trusted Perk Sphere Linux API.
// Verifies X-PS-Key-ID / X-PS-Timestamp / X-PS-Nonce / X-PS-Signature headers against
// the PERKSPHERE_LINUX_KEY_ID / PERKSPHERE_LINUX_HMAC_SECRET secrets, with persistent
// nonce replay protection via the TrustedApiNonce entity.
//
// Canonical request format (newline-joined):
//   HTTP_METHOD\nREQUEST_PATH\nTIMESTAMP\nNONCE\nSHA256_HEX(raw_body)
//
// Signature: HMAC-SHA256(secret, canonical_request), lowercase hexadecimal.
// The secret is never returned, logged, or exposed to the frontend.

import { secrets } from "base44:runtime";

const CLOCK_SKEW_SECONDS = 300;
const NONCE_TTL_SECONDS = 600;

// Constant-time comparison for equal-length hex strings.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret, text) {
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verifies a trusted server-to-server request. Returns { ok, requestId, rawBody } on
// success, or { ok: false, status, code, error, requestId } on failure. On success the
// nonce has been persisted (so a replay is rejected next time) and rawBody holds the
// request body text (the body stream is consumed).
export async function verifyTrustedRequest(req, admin, expectedPath) {
  const keyId = req.headers.get("X-PS-Key-ID");
  const timestamp = req.headers.get("X-PS-Timestamp");
  const nonce = req.headers.get("X-PS-Nonce");
  const signature = req.headers.get("X-PS-Signature");
  const requestId = req.headers.get("X-Request-ID") || crypto.randomUUID();

  if (!keyId || !timestamp || !nonce || !signature) {
    return { ok: false, status: 401, code: "missing_auth_headers", error: "Missing authentication headers.", requestId };
  }

  const expectedKeyId = secrets.get("PERKSPHERE_LINUX_KEY_ID");
  const hmacSecret = secrets.get("PERKSPHERE_LINUX_HMAC_SECRET");
  if (!expectedKeyId || !hmacSecret) {
    return { ok: false, status: 500, code: "server_misconfigured", error: "Trusted bridge is not configured.", requestId };
  }

  if (!timingSafeEqual(keyId, expectedKeyId)) {
    return { ok: false, status: 401, code: "unknown_key_id", error: "Unknown key id.", requestId };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, status: 401, code: "invalid_timestamp", error: "Invalid timestamp.", requestId };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > CLOCK_SKEW_SECONDS) {
    return { ok: false, status: 401, code: "stale_timestamp", error: "Timestamp outside allowed clock skew.", requestId };
  }

  if (typeof nonce !== "string" || nonce.length < 8 || nonce.length > 128 || !/^[A-Za-z0-9._-]+$/.test(nonce)) {
    return { ok: false, status: 401, code: "invalid_nonce", error: "Invalid nonce.", requestId };
  }

  const rawBody = await req.text();

  const method = (req.method || "POST").toUpperCase();
  // The Base44 function runtime exposes an internal path (/run/<id>) on req.url, not
  // the public /functions/<name> path. Both sides agree on the public path as the
  // canonical identifier so the signature is stable and reproducible from Linux.
  const path = expectedPath || "/functions/trustedActivityBridge";
  const bodyHash = await sha256Hex(rawBody || "");
  const canonical = [method, path, timestamp, nonce, bodyHash].join("\n");

  const expectedSig = await hmacSha256Hex(hmacSecret, canonical);
  if (!timingSafeEqual(String(signature).toLowerCase(), expectedSig)) {
    return { ok: false, status: 401, code: "invalid_signature", error: "Invalid signature.", requestId };
  }

  // Persistent replay protection — survives restarts.
  const existing = await admin.entities.TrustedApiNonce.filter({ key_id: keyId, nonce });
  if ((existing || []).length > 0) {
    return { ok: false, status: 401, code: "replay_detected", error: "Nonce already used.", requestId };
  }
  await admin.entities.TrustedApiNonce.create({
    key_id: keyId,
    nonce,
    created_at: new Date().toISOString(),
    expires_at: new Date((nowSec + NONCE_TTL_SECONDS) * 1000).toISOString()
  });

  return { ok: true, requestId, rawBody };
}

// Removes expired nonces. Call opportunistically (not on every request) to bound growth.
export async function pruneExpiredNonces(admin) {
  const nowIso = new Date().toISOString();
  await admin.entities.TrustedApiNonce.deleteMany({ expires_at: { $lt: nowIso } });
}