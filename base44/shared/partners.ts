// Partner integration event types, validation, and HMAC verification.
//
// Partner events are authenticated per-partner via HMAC-SHA256 using partner-specific
// credentials stored encrypted in PartnerCredential (AES-GCM with OAUTH_TOKEN_ENCRYPTION_KEY).
// No partner secrets are ever exposed to browsers or frontend components.
//
// Partner events NEVER issue Points/XP directly. They feed verified activity into the
// existing task progress system, and completion flows through finalizeCompletion —
// the same authoritative server-side path used by the Linux API and Chrome extension.

import { secrets } from "base44:runtime";
import { decryptToken, sha256Hex } from "./oauth.ts";

export const SUPPORTED_EVENT_TYPES = [
  "ACCOUNT_REGISTERED",
  "ACCOUNT_LINKED",
  "VIDEO_WATCH_PROGRESS",
  "STREAM_STARTED",
  "STREAM_VIEW_PROGRESS",
  "STREAM_ENDED",
  "SUBSCRIPTION_ACTIVATED",
  "SUBSCRIPTION_RENEWED",
  "SUBSCRIPTION_CANCELLED",
  "PAYMENT_REFUNDED",
  "ACCOUNT_DISABLED"
];

export const PARTNER_TYPES = [
  { value: "custom_website", label: "Custom Website" },
  { value: "streaming_platform", label: "Streaming Platform" },
  { value: "membership_subscription", label: "Membership / Subscription Platform" },
  { value: "wordpress_woocommerce", label: "WordPress / WooCommerce" },
  { value: "other", label: "Other" }
];

export const INTEGRATION_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "disabled", label: "Disabled" },
  { value: "archived", label: "Archived" }
];

const CLOCK_SKEW_SECONDS = 300;

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function hmacSha256Hex(secret, text) {
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function bodyHashHex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify a partner's HMAC-signed request.
// Returns { ok, partner, requestId, rawBody } on success,
// or { ok: false, status, code, error, requestId, partner? } on failure.
export async function verifyPartnerRequest(req, admin, partnerKeyId) {
  const timestamp = req.headers.get("X-PS-Timestamp");
  const nonce = req.headers.get("X-PS-Nonce");
  const signature = req.headers.get("X-PS-Signature");
  const requestId = req.headers.get("X-Request-ID") || crypto.randomUUID();

  if (!partnerKeyId || !timestamp || !nonce || !signature) {
    return { ok: false, status: 401, code: "missing_auth_headers", error: "Missing authentication headers.", requestId };
  }

  const partners = await admin.entities.PartnerIntegration.filter({ partner_key_id: partnerKeyId });
  const partner = (partners || [])[0];
  if (!partner) {
    return { ok: false, status: 401, code: "unknown_partner", error: "Unknown partner key id.", requestId };
  }
  if (partner.integration_status !== "active") {
    return { ok: false, status: 403, code: "partner_not_active", error: "Partner integration is not active.", requestId, partner };
  }

  const creds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partner.id });
  const cred = (creds || []).find((c) => !c.revoked_at);
  if (!cred || !cred.encrypted_hmac_secret) {
    return { ok: false, status: 500, code: "partner_not_configured", error: "Partner credentials are not configured.", requestId, partner };
  }

  const encKey = secrets.get("OAUTH_TOKEN_ENCRYPTION_KEY");
  if (!encKey) {
    return { ok: false, status: 500, code: "server_misconfigured", error: "Encryption key not configured.", requestId, partner };
  }
  const hmacSecret = await decryptToken(cred.encrypted_hmac_secret, cred.hmac_secret_iv, encKey);
  if (!hmacSecret) {
    return { ok: false, status: 500, code: "partner_not_configured", error: "Partner secret could not be decrypted.", requestId, partner };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, status: 401, code: "invalid_timestamp", error: "Invalid timestamp.", requestId, partner };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > CLOCK_SKEW_SECONDS) {
    return { ok: false, status: 401, code: "stale_timestamp", error: "Timestamp outside allowed clock skew.", requestId, partner };
  }

  if (typeof nonce !== "string" || nonce.length < 8 || nonce.length > 128 || !/^[A-Za-z0-9._-]+$/.test(nonce)) {
    return { ok: false, status: 401, code: "invalid_nonce", error: "Invalid nonce.", requestId, partner };
  }

  const rawBody = await req.text();
  const method = (req.method || "POST").toUpperCase();
  const path = "/functions/partnerEventIngest";
  const bodyHash = await bodyHashHex(rawBody || "");
  const canonical = [method, path, timestamp, nonce, bodyHash].join("\n");

  const expectedSig = await hmacSha256Hex(hmacSecret, canonical);
  if (!timingSafeEqual(String(signature).toLowerCase(), expectedSig)) {
    return { ok: false, status: 401, code: "invalid_signature", error: "Invalid signature.", requestId, partner };
  }

  return { ok: true, partner, requestId, rawBody };
}

// Validate an event payload against supported types and required fields.
export function validateEventPayload(body) {
  const { external_event_id, event_type } = body;
  if (!external_event_id) return { ok: false, code: "missing_event_id", error: "external_event_id is required." };
  if (!event_type) return { ok: false, code: "missing_event_type", error: "event_type is required." };
  if (!SUPPORTED_EVENT_TYPES.includes(event_type)) return { ok: false, code: "unknown_event_type", error: "Unknown event type: " + event_type };
  return { ok: true };
}

// Generate a new partner key ID (public identifier).
export function generatePartnerKeyId() {
  return "pk_" + [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate a new partner HMAC secret (shared secret for signing).
export function generatePartnerSecret() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}