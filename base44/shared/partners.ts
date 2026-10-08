// Partner integration event types, validation, HMAC verification, domain
// verification, proof-of-possession challenges, and account-link challenges.
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

// ─── Event Types ──────────────────────────────────────────────────────────
// The canonical event types partners may send. Each partner's supported_event_types
// is checked against this list at creation, and every incoming event must be in the
// partner's own list (per-partner event type matching).

export const SUPPORTED_EVENT_TYPES = [
  // Registration / account lifecycle
  "ACCOUNT_REGISTERED",
  "ACCOUNT_LINKED",
  "ACCOUNT_DISABLED",
  // Video / stream viewing
  "VIDEO_WATCH_PROGRESS",
  "STREAM_STARTED",
  "STREAM_VIEW_PROGRESS",
  "STREAM_ENDED",
  // Commerce
  "PURCHASE_COMPLETED",
  "PURCHASE_REFUNDED",
  "CHARGEBACK_ISSUED",
  // Subscriptions
  "SUBSCRIPTION_ACTIVATED",
  "SUBSCRIPTION_RENEWED",
  "SUBSCRIPTION_CANCELLED"
];

// Events that represent watch progress and therefore require independent
// verification evidence — self-reported duration alone is never sufficient.
export const WATCH_EVENT_TYPES = [
  "VIDEO_WATCH_PROGRESS",
  "STREAM_VIEW_PROGRESS",
  "STREAM_ENDED"
];

// Events that represent commerce lifecycle and may trigger refund invalidation.
export const REFUND_EVENT_TYPES = [
  "PURCHASE_REFUNDED",
  "CHARGEBACK_ISSUED"
];

// Events that are eligible to feed task progress (not just metadata).
export const TASK_PROGRESS_EVENT_TYPES = [
  "VIDEO_WATCH_PROGRESS",
  "STREAM_VIEW_PROGRESS",
  "STREAM_ENDED",
  "PURCHASE_COMPLETED",
  "SUBSCRIPTION_ACTIVATED",
  "SUBSCRIPTION_RENEWED"
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
  { value: "setup_required", label: "Setup Required" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "disabled", label: "Disabled" },
  { value: "archived", label: "Archived" }
];

export const VERIFICATION_STATUSES = [
  { value: "unverified", label: "Unverified" },
  { value: "domain_verified", label: "Domain Verified" },
  { value: "credential_verified", label: "Credential Verified" },
  { value: "fully_verified", label: "Fully Verified" }
];

// ─── HMAC Verification ────────────────────────────────────────────────────

const CLOCK_SKEW_SECONDS = 300;
const NONCE_TTL_SECONDS = 600;

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
//
// This performs: key lookup → active-status check → credential decryption →
// timestamp skew → nonce format → signature verification → nonce replay
// protection (persistent via TrustedApiNonce). Fail-closed: any missing or
// mismatched element returns 401/403 before the body is processed.
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
  // This is a MIGRATION-ONLY endpoint. Active production partners must submit
  // events to the Linux API endpoint (api.perksphere.org/events), not here.
  // Only setup_required partners may use this endpoint for testing/migration.
  if (partner.integration_status === "active") {
    return { ok: false, status: 400, code: "use_linux_endpoint", error: "Active production partners must submit events to the Linux API endpoint, not this migration endpoint.", requestId, partner };
  }
  if (partner.integration_status !== "setup_required") {
    return { ok: false, status: 403, code: "partner_not_setup", error: "Partner must be in setup_required state to use this migration endpoint.", requestId, partner };
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

  // Persistent replay protection — a nonce may only be used once per partner key.
  // Reuses the TrustedApiNonce entity with the partner_key_id as the key_id.
  const existing = await admin.entities.TrustedApiNonce.filter({ key_id: partnerKeyId, nonce });
  if ((existing || []).length > 0) {
    return { ok: false, status: 401, code: "replay_detected", error: "Nonce already used.", requestId, partner };
  }
  await admin.entities.TrustedApiNonce.create({
    key_id: partnerKeyId,
    nonce,
    created_at: new Date().toISOString(),
    expires_at: new Date((nowSec + NONCE_TTL_SECONDS) * 1000).toISOString()
  });

  return { ok: true, partner, requestId, rawBody, hmacSecret };
}

// ─── Proof-of-Possession ───────────────────────────────────────────────────
// A partner proves they hold the HMAC secret by signing a server-generated
// challenge. This is used during onboarding (before activation) to verify the
// partner has correctly stored their secret. It does NOT authenticate ordinary
// events — it's a one-time onboarding step.

export function generateProofChallenge() {
  return "pop_" + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify a proof-of-possession signature. The partner signs the challenge
// using the same canonical format as event submission, but with the challenge
// as the body and a fixed path of /proof-of-possession.
export async function verifyProofOfPossession(partner, admin, challenge, timestamp, nonce, signature) {
  const creds = await admin.entities.PartnerCredential.filter({ partner_integration_id: partner.id });
  const cred = (creds || []).find((c) => !c.revoked_at);
  if (!cred || !cred.encrypted_hmac_secret) {
    return { ok: false, code: "partner_not_configured", error: "Partner credentials are not configured." };
  }
  const encKey = secrets.get("OAUTH_TOKEN_ENCRYPTION_KEY");
  if (!encKey) {
    return { ok: false, code: "server_misconfigured", error: "Encryption key not configured." };
  }
  const hmacSecret = await decryptToken(cred.encrypted_hmac_secret, cred.hmac_secret_iv, encKey);
  if (!hmacSecret) {
    return { ok: false, code: "partner_not_configured", error: "Partner secret could not be decrypted." };
  }

  // Timestamp skew
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, code: "invalid_timestamp", error: "Invalid timestamp." };
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > CLOCK_SKEW_SECONDS) {
    return { ok: false, code: "stale_timestamp", error: "Timestamp outside allowed clock skew." };
  }

  // Nonce format
  if (typeof nonce !== "string" || nonce.length < 8 || nonce.length > 128 || !/^[A-Za-z0-9._-]+$/.test(nonce)) {
    return { ok: false, code: "invalid_nonce", error: "Invalid nonce." };
  }

  // Canonical: POST\n/proof-of-possession\nTIMESTAMP\nNONCE\nSHA256(challenge)
  const bodyHash = await bodyHashHex(challenge || "");
  const canonical = ["POST", "/proof-of-possession", timestamp, nonce, bodyHash].join("\n");
  const expectedSig = await hmacSha256Hex(hmacSecret, canonical);
  if (!timingSafeEqual(String(signature || "").toLowerCase(), expectedSig)) {
    return { ok: false, code: "invalid_signature", error: "Proof-of-possession signature does not match." };
  }

  return { ok: true };
}

// ─── Domain Verification ───────────────────────────────────────────────────
// The partner publishes a random token in a DNS TXT record or a well-known
// file at their domain. The admin verifies it and marks the domain verified.

export function generateDomainVerificationToken() {
  return "ps-verify-" + [...crypto.getRandomValues(new Uint8Array(20))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Event Payload Validation ──────────────────────────────────────────────
// Validates an event payload against supported types, required fields, and
// per-partner permitted event types. Watch events require content evidence —
// self-reported duration alone is never sufficient proof of genuine viewing.

export function validateEventPayload(body, partner) {
  const { external_event_id, event_type } = body;
  if (!external_event_id) return { ok: false, code: "missing_event_id", error: "external_event_id is required." };
  if (!event_type) return { ok: false, code: "missing_event_type", error: "event_type is required." };
  if (!SUPPORTED_EVENT_TYPES.includes(event_type)) {
    return { ok: false, code: "unknown_event_type", error: "Unknown event type: " + event_type };
  }
  // Per-partner event type matching — reject events the partner is not permitted to send.
  if (partner && Array.isArray(partner.supported_event_types) && partner.supported_event_types.length > 0) {
    if (!partner.supported_event_types.includes(event_type)) {
      return { ok: false, code: "event_type_not_permitted", error: "Event type " + event_type + " is not permitted for this partner." };
    }
  }
  // Watch events require content evidence — self-reported eligible_seconds alone
  // is not sufficient proof of genuine viewing. Require content_id or content_url.
  if (WATCH_EVENT_TYPES.includes(event_type)) {
    if (!body.content_id && !body.content_url) {
      return { ok: false, code: "missing_content_evidence", error: "Watch events require content_id or content_url as viewing evidence." };
    }
  }
  // Refund events must reference the original purchase event.
  if (REFUND_EVENT_TYPES.includes(event_type)) {
    if (!body.original_event_id) {
      return { ok: false, code: "missing_original_event_id", error: "Refund/chargeback events require original_event_id." };
    }
  }
  return { ok: true };
}

// ─── Credential Generation ─────────────────────────────────────────────────

export function generatePartnerKeyId() {
  return "pk_" + [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generatePartnerSecret() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Account-Link Challenge ────────────────────────────────────────────────
// Signed, single-use challenge for linking a partner account to a Perk Sphere user.
// The user requests a challenge; the partner must echo it back in an ACCOUNT_LINKED
// event, proving the user controls the partner account.

export function generateAccountLinkChallenge() {
  return "al_" + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Onboarding Checklist ─────────────────────────────────────────────────
// The 8-step onboarding flow. Steps 1-2 are auto-completed on creation.
// Steps 3-8 require external work or admin action.

export const ONBOARDING_STEPS = [
  { key: "base44_registered", label: "Partner registered in Perk Sphere", external: false, auto: true },
  { key: "credentials_generated", label: "Credentials provisioned by Linux", external: false, auto: true },
  { key: "domain_verified", label: "Domain ownership verified", external: true },
  { key: "admin_reviewed", label: "Administrator review approved", external: false },
  { key: "linux_api_configured", label: "Credentials configured on Linux API", external: true },
  { key: "partner_implemented", label: "Partner-side implementation complete", external: true },
  { key: "proof_of_possession", label: "Proof of possession verified", external: true },
  { key: "test_event_verified", label: "Test event verification passed", external: true },
  { key: "activated", label: "Integration activated by admin", external: false }
];

// ─── Response Sanitisation ─────────────────────────────────────────────────
// Partner-related responses must never expose plaintext secrets, credential
// hashes, encryption metadata, or domain verification tokens. These helpers
// enforce server-side stripping of sensitive fields before returning.

// Sanitize for admin responses — keeps operational fields but removes secrets.
export function sanitizePartnerRecord(record) {
  if (!record) return record;
  const sanitized = { ...record };
  delete sanitized.partner_secret;
  delete sanitized.partner_secret_hash;
  delete sanitized.domain_verification_token;
  return sanitized;
}

// Sanitize for user-facing responses — only public fields.
export function sanitizePartnerForUser(record) {
  if (!record) return record;
  return {
    id: record.id,
    name: record.name,
    partner_type: record.partner_type,
    website_url: record.website_url,
    logo: record.logo,
    description: record.description,
    integration_status: record.integration_status,
    verification_status: record.verification_status
  };
}