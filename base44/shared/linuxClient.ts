// Shared server-side helper for trusted outbound requests from Base44 to the
// Perk Sphere Linux API. Signs every request with the same HMAC-SHA256
// canonical format used by the inbound trusted bridge:
//
//   POST\n<request_path>\n<timestamp>\n<nonce>\n<sha256_hex(raw_body)>
//
// Signature: HMAC-SHA256(secret, canonical_request), lowercase hexadecimal.
//
// Reuses the existing PERKSPHERE_LINUX_KEY_ID / PERKSPHERE_LINUX_HMAC_SECRET
// secrets — no second credential pair is introduced.
//
// This module is server-side only. It must never be imported from frontend code.
// It never logs secrets, signatures, pairing codes, device tokens, or token hashes.

import { secrets } from "base44:runtime";

export const LINUX_API_BASE = "https://api.perksphere.org";

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

// Signs and sends a trusted POST to the Linux API.
// Returns { ok: true, status, data } on success or
// { ok: false, status, code, error } on failure.
export async function linuxTrustedPost(path, body, extraHeaders) {
  const keyId = (secrets.get("PERKSPHERE_LINUX_KEY_ID") || "").trim();
  // Use the stored secret verbatim as UTF-8: no trimming, hex or base64 decoding.
  const hmacSecret = secrets.get("PERKSPHERE_LINUX_HMAC_SECRET") || "";
  console.log(`[linuxClient] keyId length=${keyId.length} secret length=${hmacSecret.length}`);
  if (!keyId || !hmacSecret) {
    return { ok: false, status: 500, code: "server_misconfigured", error: "Linux API credentials are not configured." };
  }

  const requestId = crypto.randomUUID();
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(rawBody);
  const canonical = ["POST", path, timestamp, nonce, bodyHash].join("\n");
  const signature = await hmacSha256Hex(hmacSecret, canonical);

  let res;
  try {
    res = await fetch(LINUX_API_BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PS-Key-ID": keyId,
        "X-PS-Timestamp": timestamp,
        "X-PS-Nonce": nonce,
        "X-PS-Signature": signature,
        ...(extraHeaders || {})
      },
      body: rawBody,
      signal: AbortSignal.timeout(10000)
    });
  } catch (_e) {
    console.log(`[linuxClient] req=${requestId} path=${path} status=0 error=unreachable`);
    return { ok: false, status: 503, code: "linux_unreachable", error: "Pairing service is temporarily unavailable." };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errCode = (data && data.error && data.error.code) || "linux_error";
    const errMsg = (data && data.error && data.error.message) || "Linux API request failed.";
    // Safe diagnostic log: request ID, path, HTTP status, Linux error code/message.
    // Never logs secrets, signatures, device tokens, or pairing codes.
    console.log(`[linuxClient] req=${requestId} path=${path} status=${res.status} code=${errCode} message=${errMsg}`);
    return {
      ok: false,
      status: res.status,
      code: errCode,
      error: errMsg
    };
  }
  console.log(`[linuxClient] req=${requestId} path=${path} status=${res.status} ok=true`);
  return { ok: true, status: res.status, data: (data && data.data) || data };
}

// ─── Partner Management Endpoints ──────────────────────────────────────────
// Linux is the authoritative system for partner HMAC credentials. Base44
// coordinates provisioning through these authenticated endpoints.
//
// If any endpoint is unavailable, the partner is left in linux_integration_pending
// state and the admin can retry provisioning later via managePartner.retryProvisioning.

// Computes a signed admin approval for partner activation using the PS-ACTIVATE
// canonical format. NOTE: This signature format is UNVERIFIED — the exact deployed
// contract for POST /partners/activate must be obtained from Linux source inspection
// before this helper is used in production. Kept here as a utility for when the
// contract is confirmed; currently unused by managePartner.
export async function computeActivationApproval(hmacSecret, partnerUuid, adminId, timestamp) {
  const canonical = ["PS-ACTIVATE", partnerUuid, adminId, timestamp].join("\n");
  return await hmacSha256Hex(hmacSecret, canonical);
}

export const LINUX_PARTNER_ENDPOINTS = {
  PROVISION: "/partners/provision",
  ROTATE_CREDENTIAL: "/partners/rotate-credential",
  REVOKE: "/partners/revoke",
  ACTIVATE: "/partners/activate",
  VERIFY_DOMAIN: "/partners/verify-domain",
  PROOF_CHALLENGE: "/v1/partner-credentials/challenge",
  PROOF_CONFIRM: "/v1/partner-credentials/confirm",
  ACCOUNT_LINK_CREATE: "/v1/partner-links/challenges",
  ACCOUNT_LINK_CONFIRM: "/v1/partner-links/confirm",
  ACCOUNT_LINK_UNLINK: "/partners/account-link/unlink"
};