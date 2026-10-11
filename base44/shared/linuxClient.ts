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
import { isValidLinuxPath } from './linuxPath.ts';

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

// Allowed path prefixes for Linux API requests. Prevents arbitrary external
// URL construction — any path not starting with one of these is rejected.

// Signs and sends a trusted POST to the Linux API.
// Returns { ok: true, status, data } on success or
// { ok: false, status, code, error } on failure.
export async function linuxTrustedPost(path, body, extraHeaders) {
  if (!isValidLinuxPath(path)) {
    return { ok: false, status: 400, code: "invalid_path", error: "Invalid or unrecognised endpoint path." };
  }
  const keyId = (secrets.get("PERKSPHERE_LINUX_KEY_ID") || "").trim();
  // Use the stored secret verbatim as UTF-8: no trimming, hex or base64 decoding.
  const hmacSecret = secrets.get("PERKSPHERE_LINUX_HMAC_SECRET") || "";
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
        ...(extraHeaders || {}),
        "X-PS-Key-ID": keyId,
        "X-PS-Timestamp": timestamp,
        "X-PS-Nonce": nonce,
        "X-PS-Signature": signature
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
    // Handle both Linux error formats:
    //   {"ok":false,"error":"stage2_not_enabled"}           (string)
    //   {"ok":false,"error":{"code":"...","message":"..."}}  (object)
    let errCode = "linux_error";
    let errMsg = "Linux API request failed.";
    if (data && typeof data.error === "string") {
      errCode = data.error;
      errMsg = data.error === "stage2_not_enabled"
        ? "This feature is not yet enabled on the Linux API."
        : data.error;
    } else if (data && data.error && typeof data.error === "object") {
      errCode = data.error.code || "linux_error";
      errMsg = data.error.message || "Linux API request failed.";
    }
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

// Computes the partner activation approval signature using the INDEPENDENT
// PERKSPHERE_PARTNER_APPROVAL_SECRET — NOT the normal Base44/Linux service HMAC
// secret. The approval signature must come from an independently authorised
// approval process, not a client-provided admin_id or a browser-controlled request.
//
// Canonical (newline-joined):
//   PS-PARTNER-ACTIVATE
//   <partner_uuid>
//   <partner_key_id>
//   <approval_reference>
//   <approval_timestamp>
//
// Returns a 64-character lowercase hexadecimal HMAC-SHA256 digest.
export async function computePartnerActivationApproval(partnerUuid, partnerKeyId, approvalReference, approvalTimestamp) {
  const approvalSecret = secrets.get("PERKSPHERE_PARTNER_APPROVAL_SECRET") || "";
  if (!approvalSecret || approvalSecret.length < 32) {
    throw new Error("PERKSPHERE_PARTNER_APPROVAL_SECRET is not configured or is too short (minimum 32 characters).");
  }
  const canonical = ["PS-PARTNER-ACTIVATE", partnerUuid, partnerKeyId, approvalReference, approvalTimestamp].join("\n");
  return await hmacSha256Hex(approvalSecret, canonical);
}

export const LINUX_PARTNER_ENDPOINTS = {
  PROVISION: "/partners/provision",
  ROTATE_CREDENTIAL: "/partners/rotate-credential",
  REVOKE: "/partners/revoke",
  ACTIVATE: "/partners/activate",
  VERIFY_DOMAIN: "/partners/verify-domain",
  PROOF_STATUS: "/partners/proof-status",
  PROOF_CHALLENGE: "/v1/partner-credentials/challenge",
  PROOF_CONFIRM: "/v1/partner-credentials/confirm",
  ACCOUNT_LINK_CREATE: "/v1/partner-links/challenges",
  ACCOUNT_LINK_CONFIRM: "/v1/partner-links/confirm",
  ACCOUNT_LINK_UNLINK: "/partners/account-link/unlink",
  // ─── Pending Linux contract confirmation ───────────────────────────────
  // RECOVER_PARTNER is NOT yet confirmed by the Linux API team. The path below
  // is a placeholder — do NOT make live requests until the contract is
  // confirmed and the corresponding flag in LINUX_ENDPOINT_CONTRACT_CONFIRMED
  // is set to true.
  REISSUE_INITIAL_CREDENTIAL: "/partners/reissue-onboarding-credential",
  RECOVER_PARTNER: "/partners/recover"
};

// Tracks which Linux endpoint contracts have been confirmed by the Linux API
// team. Actions check this map before making live requests; unconfirmed
// endpoints return a clear "contract pending" message instead of calling Linux.
export const LINUX_ENDPOINT_CONTRACT_CONFIRMED = {
  PROVISION: true,
  ROTATE_CREDENTIAL: true,
  REVOKE: true,
  ACTIVATE: true,
  VERIFY_DOMAIN: true,
  // PROOF_STATUS is NOT yet confirmed by the Linux API team. The endpoint
  // POST /partners/proof-status returned 404 on live testing. Until the Linux
  // API team confirms the endpoint path and response schema, syncProofStatus
  // returns a clear "contract pending" message and makes NO live request.
  // Future partners use the confirmed challenge/confirm flow instead.
  PROOF_STATUS: false,
  PROOF_CHALLENGE: true,
  PROOF_CONFIRM: true,
  ACCOUNT_LINK_CREATE: true,
  ACCOUNT_LINK_CONFIRM: true,
  ACCOUNT_LINK_UNLINK: true,
  // REISSUE_INITIAL_CREDENTIAL confirmed: POST /partners/reissue-onboarding-credential
  // Request: { partner_uuid }. Response 201: { ok, partner_uuid, partner_key_id, partner_secret, status: "pending", activated: false }
  // RECOVER_PARTNER still pending — set to true once the Linux API team confirms
  // the endpoint path and request/response schema. Until then, the admin action
  // returns a clear message and makes NO live request.
  REISSUE_INITIAL_CREDENTIAL: true,
  RECOVER_PARTNER: false
};
