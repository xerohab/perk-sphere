# PERK SPHERE — LINUX INTEGRATION CONTRACT

**Version:** 1.10.0
**Date:** 2026-10-09
**Base44 App:** https://perksphere.org
**Linux API:** https://api.perksphere.org

This document is the authoritative contract between the Base44 Perk Sphere application and the Linux Node.js API. Every endpoint Base44 calls, every authentication requirement, every request/response shape, and every schema mapping is defined here.

---

## 1. ARCHITECTURE OVERVIEW

```
Partner site ──HMAC──► Linux API (api.perksphere.org) ──HMAC──► Base44 (trustedActivityBridge)
                                │
                                ├── Partner credential provisioning
                                ├── Domain verification
                                ├── Proof-of-possession verification
                                ├── Account-link challenge creation/verification
                                └── Event ingestion + translation

Base44 ──HMAC──► Linux API (partner management endpoints)
```

### Authority separation

| System | Authority |
|--------|-----------|
| **Linux API** | Partner HMAC credentials, domain verification, proof-of-possession, account-link challenges, production event ingestion, event translation |
| **Base44** | User accounts, admin dashboard, reward ledger (Points/XP), task definitions, `finalizeCompletion` — the ONLY path that issues Points/XP |

### Key principle

Partners and the browser extension **never** issue Points or XP directly. They submit evidence. Linux verifies and forwards. Base44's `finalizeCompletion` is the single reward-issuing authority.

---

## 2. AUTHENTICATION

### 2.1 Base44 → Linux (outbound, trusted service-to-service)

Base44 signs every outbound request to Linux using HMAC-SHA256 with the `PERKSPHERE_LINUX_KEY_ID` / `PERKSPHERE_LINUX_HMAC_SECRET` secret pair.

**Headers:**

| Header | Description |
|--------|-------------|
| `X-PS-Key-ID` | The key identifier (from `PERKSPHERE_LINUX_KEY_ID` secret) |
| `X-PS-Timestamp` | Unix epoch seconds (±300s clock skew allowed) |
| `X-PS-Nonce` | Unique per-request nonce (8–128 chars, `[A-Za-z0-9._-]`) |
| `X-PS-Signature` | HMAC-SHA256 hex digest of the canonical request |
| `Content-Type` | `application/json` |

**Canonical request format (newline-joined):**

```
POST\n<request_path>\n<timestamp>\n<nonce>\n<sha256_hex(raw_body)>
```

**Signature:** `HMAC-SHA256(secret, canonical_request)` → lowercase hexadecimal.

**Example:**

```
POST
/partners/provision
1728499200
a1b2c3d4-e5f6-7890-abcd-ef1234567890
9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

### 2.2 Linux → Base44 (inbound, trusted service-to-server)

Linux signs every inbound request to Base44's `trustedActivityBridge` using HMAC-SHA256 with the `PERKSPHERE_LINUX_INBOUND_KEY_ID` / `PERKSPHERE_LINUX_INBOUND_HMAC_SECRET` secret pair.

**Headers:**

| Header | Description |
|--------|-------------|
| `X-PS-Key-ID` | The inbound key identifier (from `PERKSPHERE_LINUX_INBOUND_KEY_ID` secret) |
| `X-PS-Timestamp` | Unix epoch seconds (±300s clock skew allowed) |
| `X-PS-Nonce` | Unique per-request nonce (8–128 chars, `[A-Za-z0-9._-]`) |
| `X-PS-Signature` | HMAC-SHA256 hex digest of the canonical request |

**Canonical request format:**

```
POST\n/functions/trustedActivityBridge\n<timestamp>\n<nonce>\n<sha256_hex(raw_body)>
```

**Replay protection:** Every nonce is persisted in the `TrustedApiNonce` entity and rejected on reuse. Nonces expire after 600 seconds.

### 2.3 Partner → Linux (partner's own HMAC)

Partners authenticate to the Linux event endpoint using their own per-partner HMAC credentials (provisioned by Linux).

**Headers:**

| Header | Description |
|--------|-------------|
| `X-PS-Partner-Key` | The partner's `partner_key_id` |
| `X-PS-Timestamp` | Unix epoch seconds (±300s clock skew allowed) |
| `X-PS-Nonce` | Unique per-request nonce (8–128 chars) |
| `X-PS-Signature` | HMAC-SHA256 hex digest of the canonical request |

**Canonical request format:**

```
POST\n/events\n<timestamp>\n<nonce>\n<sha256_hex(raw_body)>
```

---

## 3. ENVIRONMENT VARIABLES (Base44 side)

These secrets are stored in the Base44 dashboard Secrets page. **No secret values are included here.**

| Secret name | Purpose |
|-------------|---------|
| `PERKSPHERE_LINUX_KEY_ID` | Outbound key ID (Base44 → Linux) |
| `PERKSPHERE_LINUX_HMAC_SECRET` | Outbound HMAC secret (Base44 → Linux) |
| `PERKSPHERE_LINUX_INBOUND_KEY_ID` | Inbound key ID (Linux → Base44) |
| `PERKSPHERE_LINUX_INBOUND_HMAC_SECRET` | Inbound HMAC secret (Linux → Base44) |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | AES-GCM key for encrypting partner HMAC secrets at rest |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI |
| `X_CLIENT_ID` | X (Twitter) OAuth client ID |
| `X_CLIENT_SECRET` | X (Twitter) OAuth client secret |
| `X_REDIRECT_URI` | X (Twitter) OAuth redirect URI |

---

## 4. LINUX PARTNER MANAGEMENT ENDPOINTS

Base44 calls these endpoints to coordinate partner provisioning, verification, and lifecycle. All are authenticated with the Base44 → Linux HMAC (section 2.1).

### 4.1 POST /partners/provision

Provisions a new partner: generates HMAC credentials and a domain verification token.

**Request:**

```json
{
  "base44_partner_reference": "6ac7fd006ec73f00246fadcc",
  "name": "XeroStreams",
  "partner_type": "streaming_platform",
  "website_url": "https://xerostreams.com",
  "verified_domains": ["xerostreams.com"],
  "supported_event_types": ["STREAM_STARTED", "STREAM_VIEW_PROGRESS", "STREAM_ENDED"]
}
```

**Response (200):**

```json
{
  "data": {
    "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
    "partner_key_id": "pk_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    "partner_secret": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    "domain_verification_token": "ps-verify-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
  }
}
```

**Expected status codes:** 200 (success), 503 (unavailable), 500 (server error).

**Base44 stores:** `partner_uuid` → `PartnerIntegration.linux_api_partner_id` (immutable after confirmation). `partner_key_id` → `PartnerIntegration.partner_key_id`. `partner_secret` is encrypted (AES-GCM) and stored in `PartnerCredential`. `domain_verification_token` → `PartnerIntegration.domain_verification_token`.

### 4.2 POST /partners/rotate-credential

Rotates a partner's HMAC credentials. Old credentials are revoked; new ones are issued.

**Request:**

```json
{
  "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c"
}
```

**Response (200):**

```json
{
  "data": {
    "partner_key_id": "pk_new_key_id_here_1234567890abcdef",
    "partner_secret": "new_secret_hex_string_here_64_chars_total_aabbccdd"
  }
}
```

**Expected status codes:** 200, 503, 500.

### 4.3 POST /partners/revoke

Revokes all credentials for a partner. The partner is disabled.

**Request:**

```json
{
  "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c"
}
```

**Response (200):**

```json
{
  "data": { "ok": true }
}
```

**Expected status codes:** 200, 503, 500.

### 4.4 POST /partners/activate

Activates a partner for production event submission. Called only after all onboarding steps are complete.

**Request:**

```json
{
  "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c"
}
```

**Response (200):**

```json
{
  "data": { "ok": true }
}
```

**Expected status codes:** 200, 503, 500.

**Base44 behaviour:** This is called only after `onboardingComplete()` returns true (all 8 checklist steps pass). If Linux activation fails, the partner stays in `setup_required` and the admin sees the error.

### 4.5 POST /partners/verify-domain

Verifies domain ownership by checking the DNS TXT record or well-known file.

**Request:**

```json
{
  "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c"
}
```

**Response (200):**

```json
{
  "data": { "verified": true }
}
```

**Response (422) — verification failed:**

```json
{
  "error": { "code": "domain_verification_failed", "message": "DNS TXT record not found." }
}
```

**Expected status codes:** 200, 422 (verification failed), 503, 500.

### 4.6 POST /v1/partner-credentials/challenge

Creates a proof-of-possession challenge. Base44 requests a challenge from Linux; the admin passes it to the partner, who signs it with their HMAC secret. The signed response is submitted to `/v1/partner-credentials/confirm` (section 4.6b).

**Request:**

```json
{
  "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c"
}
```

**Response (200):**

```json
{
  "data": {
    "challenge_id": "pc_a1b2c3d4e5f6",
    "challenge": "pop_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    "expires_at": "2026-10-09T18:10:00.000Z"
  }
}
```

**Expected status codes:** 200, 503, 500.

### 4.6b POST /v1/partner-credentials/confirm

Confirms proof-of-possession. Base44 submits the partner's signed response to Linux. Linux verifies the signature and confirms. Base44 never verifies the signature locally — credentials are only marked verified after Linux confirms.

**Request:**

```json
{
  "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
  "challenge_id": "pc_a1b2c3d4e5f6",
  "timestamp": "1728499200",
  "nonce": "proof-nonce-12345678",
  "signature": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
}
```

The challenge is single-use — once confirmed, the `challenge_id` cannot be reused.

**Response (200):**

```json
{
  "data": { "ok": true }
}
```

**Response (400) — proof failed:**

```json
{
  "error": { "code": "invalid_signature", "message": "Proof-of-possession signature does not match." }
}
```

**Expected status codes:** 200, 400 (proof failed / challenge expired / challenge already used), 503, 500.

### 4.7 POST /v1/partner-links/create-challenge

Creates a single-use, signed challenge for linking a partner account to a Perk Sphere user.

**Request:**

```json
{
  "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
  "user_reference": "user_abc123_def456"
}
```

**Response (200):**

```json
{
  "data": {
    "challenge_token": "al_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    "expires_at": "2026-10-09T18:10:00.000Z"
  }
}
```

**Expected status codes:** 200, 503, 500.

**Base44 stores:** SHA-256 hash of the challenge token in `PartnerAccountLink.challenge_hash`. The token itself is returned to the user once and never stored in plaintext.

### 4.8 POST /v1/partner-links/confirm

Partner-authenticated confirmation of an account link. The partner calls this endpoint (not Base44) with the challenge token and the partner account reference. Linux verifies the challenge, links the accounts on its side, and notifies Base44 via the trusted bridge with a `PARTNER_LINK_CONFIRMED` event (see section 5.10).

Base44 does NOT call this endpoint. Base44 does NOT accept an arbitrary account reference from an unauthenticated browser or a self-reported partner event. The `ConnectedService` record is only created when Base44 receives the `PARTNER_LINK_CONFIRMED` event from Linux's trusted bridge.

**Request (partner-authenticated — partner HMAC headers):**

```json
{
  "challenge_token": "al_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  "partner_account_reference": "user123_on_partner_site"
}
```

**Response (200):**

```json
{
  "data": { "ok": true, "linked": true }
}
```

**After confirmation, Linux sends to Base44 trusted bridge:**

```json
{
  "external_event_id": "link_<unique-id>",
  "event_type": "PARTNER_LINK_CONFIRMED",
  "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
  "user_reference": "user_abc123_def456",
  "partner_account_reference": "user123_on_partner_site",
  "challenge_token": "al_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
}
```

**Expected status codes:** 200, 400 (invalid/expired challenge), 503, 500.

### 4.9 POST /partners/account-link/unlink

Unlinks a user's partner account.

**Request:**

```json
{
  "partner_uuid": "f3a2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
  "user_reference": "user_abc123_def456"
}
```

**Response (200):**

```json
{
  "data": { "ok": true }
}
```

**Expected status codes:** 200, 503, 500.

---

## 5. LINUX EVENT INGESTION ENDPOINT (Partner → Linux)

### 5.1 POST /events

Partners submit signed events to this endpoint. Linux verifies the partner HMAC, translates the event, and forwards eligible verified activity to Base44's `trustedActivityBridge`.

**Authentication:** Partner HMAC (section 2.3).

**Request body:**

```json
{
  "external_event_id": "evt_20261009_001",
  "event_type": "STREAM_VIEW_PROGRESS",
  "user_reference": "user_abc123_def456",
  "task_id": "task_xyz789",
  "content_id": "video_456",
  "content_url": "https://xerostreams.com/watch/video_456",
  "eligible_seconds": 120,
  "source_timestamp": "2026-10-09T17:30:00Z",
  "metadata": {
    "session_uuid": "sess_a1b2c3d4",
    "device_uuid": "dev_e5f6g7h8"
  }
}
```

**Required fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `external_event_id` | Yes | Idempotent event ID (partner-supplied) |
| `event_type` | Yes | One of the supported event types (section 6) |
| `user_reference` | Yes | The Perk Sphere user ID |
| `task_id` | Yes | The Base44 Task ID |
| `content_id` | Conditional | Required for watch events |
| `content_url` | Conditional | Required for watch events (alternative to content_id) |
| `eligible_seconds` | No | Verified eligible seconds (for watch events) |
| `original_event_id` | Conditional | Required for refund/chargeback events |
| `source_timestamp` | No | When the event occurred on the partner side |
| `metadata` | No | Additional partner-supplied metadata |
| `is_test` | No | If true, event is stored but never enters reward processing |

**Response (200):**

```json
{
  "data": {
    "external_event_id": "evt_20261009_001",
    "accepted": true,
    "duplicate": false
  }
}
```

**Response (401) — auth failure:**

```json
{
  "error": { "code": "invalid_signature", "message": "Invalid signature." }
}
```

**Expected status codes:** 200, 400 (validation), 401 (auth), 403 (forbidden), 500 (server error).

---

## 6. EVENT TYPE MAPPING

### 6.1 Partner event types (sent by partners to Linux)

| Event type | Category | Description |
|-----------|----------|-------------|
| `ACCOUNT_REGISTERED` | Registration | User registered on partner site |
| `ACCOUNT_LINKED` | Registration | User linked their partner account |
| `ACCOUNT_DISABLED` | Registration | User account disabled on partner site |
| `VIDEO_WATCH_PROGRESS` | Video | Video viewing progress |
| `STREAM_STARTED` | Stream | Live stream started |
| `STREAM_VIEW_PROGRESS` | Stream | Live stream viewing progress |
| `STREAM_ENDED` | Stream | Live stream ended |
| `PURCHASE_COMPLETED` | Commerce | Purchase completed |
| `PURCHASE_REFUNDED` | Commerce | Purchase refunded (requires `original_event_id`) |
| `CHARGEBACK_ISSUED` | Commerce | Chargeback issued (requires `original_event_id`) |
| `SUBSCRIPTION_ACTIVATED` | Subscription | Subscription activated |
| `SUBSCRIPTION_RENEWED` | Subscription | Subscription renewed |
| `SUBSCRIPTION_CANCELLED` | Subscription | Subscription cancelled |

### 6.2 Linux bridge event types (forwarded by Linux to Base44 trustedActivityBridge)

| Event type | Description |
|-----------|-------------|
| `SESSION_STARTED` | Viewing session started |
| `SESSION_PROGRESS` | Viewing session progress (eligible seconds) |
| `SESSION_PAUSED` | Session paused |
| `SESSION_RESUMED` | Session resumed |
| `SESSION_ENDED` | Session ended (may trigger completion) |
| `PAGE_PROGRESS` | Page visit progress |
| `TASK_PROGRESS_VERIFIED` | Non-viewing task verified (purchase, registration, subscription) |
| `SESSION_INVALIDATED` | Session invalidated (fraud, refund) |

### 6.3 Blocked event types (never accepted by trustedActivityBridge)

| Event type | Reason |
|-----------|--------|
| `AWARD_POINTS` | Partners/Linux cannot award Points directly |
| `AWARD_XP` | Partners/Linux cannot award XP directly |
| `SET_POINTS` | Cannot set balance |
| `SET_XP` | Cannot set balance |
| `TASK_COMPLETED` | Cannot force-complete a task |
| `COMPLETE_TASK` | Cannot force-complete a task |
| `GRANT_REWARD` | Cannot grant rewards |

### 6.4 Partner → Linux bridge event mapping

| Partner event | Linux bridge event | Notes |
|---------------|-------------------|-------|
| `ACCOUNT_REGISTERED` | `TASK_PROGRESS_VERIFIED` | Feeds task progress |
| `ACCOUNT_LINKED` | `TASK_PROGRESS_VERIFIED` | Feeds task progress + completes account link |
| `ACCOUNT_DISABLED` | `SESSION_INVALIDATED` | Invalidates active sessions |
| `VIDEO_WATCH_PROGRESS` | `SESSION_PROGRESS` | Eligible seconds forwarded |
| `STREAM_STARTED` | `SESSION_STARTED` | Session start |
| `STREAM_VIEW_PROGRESS` | `SESSION_PROGRESS` | Eligible seconds forwarded |
| `STREAM_ENDED` | `SESSION_ENDED` | May trigger completion |
| `PURCHASE_COMPLETED` | `TASK_PROGRESS_VERIFIED` | Feeds task progress |
| `PURCHASE_REFUNDED` | `PARTNER_REFUND` | Not forwarded to bridge; creates fraud flag |
| `CHARGEBACK_ISSUED` | `PARTNER_CHARGEBACK` | Not forwarded to bridge; creates fraud flag |
| `SUBSCRIPTION_ACTIVATED` | `TASK_PROGRESS_VERIFIED` | Feeds task progress |
| `SUBSCRIPTION_RENEWED` | `TASK_PROGRESS_VERIFIED` | Feeds task progress |
| `SUBSCRIPTION_CANCELLED` | `SESSION_INVALIDATED` | Invalidates sessions |

---

## 7. TRUSTED ACTIVITY BRIDGE (Linux → Base44)

### 7.1 POST /functions/trustedActivityBridge

Linux forwards verified session-level events to this Base44 endpoint. Base44 validates the task, destination, and user, then triggers completion if requirements are met.

**Authentication:** Linux → Base44 HMAC (section 2.2).

**Request body:**

```json
{
  "external_event_id": "bridge_evt_20261009_001",
  "user_reference": "user_abc123_def456",
  "task_id": "task_xyz789",
  "device_uuid": "dev_e5f6g7h8",
  "session_uuid": "sess_a1b2c3d4",
  "event_type": "SESSION_PROGRESS",
  "eligible_seconds": 300,
  "verification_state": "verified",
  "source_timestamp": "2026-10-09T17:35:00Z",
  "metadata": {}
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "external_event_id": "bridge_evt_20261009_001",
    "accepted": true,
    "duplicate": false,
    "progress": { "eligible_seconds": 300, "required_seconds": 600 },
    "task_completed": false,
    "completion_id": null
  },
  "request_id": "req_abc123"
}
```

**Validation checks (fail-closed):**

1. HMAC authentication (missing headers → 401, unknown key → 401, stale timestamp → 401, invalid nonce → 401, invalid signature → 401, replay → 401)
2. Blocked event types → 400
3. Unknown event types → 400
4. Missing required fields → 400
5. User must exist → 404
6. User must not have active restrictions → 403
7. Task must exist and be available → 404/400
8. Task must be `trusted_automatic` verification mode → 400
9. Task must have a destination configured → 400
10. Destination must exist and be enabled → 404/400
11. Destination must be classified as `allowed` → 400
12. **YouTube destination → 0 Points, 0 XP (hard enforcement, event stored but no completion)**
13. Task content_url hostname must match destination → 400
14. Event type must be compatible with task type → 400
15. Live stream event window must be open → 400
16. Completion limit and cooldown checks
17. Idempotency: duplicate `external_event_id` → returns stored result

---

## 8. PARTNER ONBOARDING CHECKLIST

The 8-step onboarding flow. Steps 1–2 are auto-completed on creation. Steps 3–8 require external work or admin action.

| Step | Key | Auto | External | Description |
|------|-----|------|----------|-------------|
| 1 | `base44_registered` | ✅ | | Partner registered in Perk Sphere |
| 2 | `credentials_generated` | ✅ | | Credentials provisioned by Linux |
| 3 | `domain_verified` | | ✅ | Domain ownership verified (DNS TXT or well-known file) |
| 4 | `admin_reviewed` | | | Administrator review approved |
| 5 | `linux_api_configured` | | ✅ | Credentials configured on Linux API |
| 6 | `partner_implemented` | | ✅ | Partner-side implementation complete |
| 7 | `proof_of_possession` | | ✅ | Proof of possession verified |
| 8 | `test_event_verified` | | ✅ | Test event verification passed |
| 9 | `activated` | | | Integration activated by admin (requires all above) |

**Activation requirement:** All steps 1–8 must be complete before an admin can activate. `onboardingComplete()` checks this server-side.

---

## 9. YOUTUBE ZERO-REWARD ENFORCEMENT

YouTube activity is hard-blocked from earning Points or XP, regardless of admin configuration. This is enforced at three layers:

1. **`trustedActivityBridge`** — If the task's destination platform is YouTube, the event is stored and processed (tracking continues) but `completion_triggered` is set to `false` and no rewards are issued.
2. **`classify.ts`** — The classification endpoint always returns `points_eligible: false, xp_eligible: false` for YouTube targets, so the browser extension knows not to expect rewards.
3. **`finalizeCompletion`** — As a last-resort guard, if the task's `destination_platform` is YouTube, Points and XP are forced to 0 even if the task definition has non-zero reward values.

---

## 10. SECURITY SAFEGUARDS

| Safeguard | Implementation |
|-----------|----------------|
| Signed service-to-service requests | HMAC-SHA256 on all Base44 ↔ Linux communication |
| Timestamp replay protection | ±300s clock skew; nonces expire after 600s |
| Nonce replay protection | Persistent via `TrustedApiNonce` entity; reused nonces rejected |
| Partner credential confidentiality | AES-GCM encryption at rest; never returned in responses after initial provisioning |
| User authentication | Base44 auth SDK; all admin actions require `partners.manage` permission |
| Role-based administration | StaffMember entity with 5 roles (super_admin, admin, rewards_manager, support, analyst) |
| Input validation | Server-side validation of all event payloads, task references, and destination eligibility |
| Safe error handling | No secrets, signatures, or tokens in logs or error responses |
| Idempotent operations | `external_event_id` deduplication on all event endpoints |
| Audit logs | All sensitive partner changes logged via `writeAudit()` |
| Fail-closed behaviour | Linux unavailable → `linux_integration_pending`; no partner activated without full verification |

---

## 11. LINUX ENDPOINTS REQUIRING IMPLEMENTATION

The following endpoints are referenced by Base44 but may currently return HTTP 501 on the Linux side. Base44 handles 501/503 gracefully by leaving the partner in `linux_integration_pending` state and allowing retry.

| Endpoint | Status | Notes |
|----------|--------|-------|
| `POST /partners/provision` | **Required** | Must generate `partner_key_id`, `partner_secret`, `partner_uuid`, `domain_verification_token` |
| `POST /partners/rotate-credential` | **Required** | Must issue new credentials and revoke old |
| `POST /partners/revoke` | **Required** | Must revoke all credentials |
| `POST /partners/activate` | **Required** | Must enable production event acceptance |
| `POST /partners/verify-domain` | **Required** | Must check DNS TXT or well-known file |
| `POST /v1/partner-credentials/challenge` | **Required** | Must generate proof-of-possession challenge with challenge_id |
| `POST /v1/partner-credentials/confirm` | **Required** | Must verify HMAC-signed proof response (single-use challenge_id) |
| `POST /v1/partner-links/create-challenge` | **Required** | Must generate single-use signed challenge |
| `POST /v1/partner-links/confirm` | **Required** | Partner-authenticated: verify challenge, link accounts, notify Base44 via PARTNER_LINK_CONFIRMED |
| `POST /partners/account-link/unlink` | **Required** | Must unlink accounts |
| `POST /events` | **Required** | Must verify partner HMAC, translate events, forward to bridge |

---

## 12. MIGRATIONS

No database migrations are required on the Base44 side. All entity schemas are already updated:

- `PartnerIntegration` — includes `linux_integration_pending` status, `linux_api_partner_id`, `domain_verification_token`, `proof_of_possession_verified`, `test_event_verified`, `setup_checklist`
- `PartnerEvent` — includes `is_test_event`, `is_refund`, `original_event_id`, `invalidated_completion_id`
- `PartnerAccountLink` — includes `challenge_hash`, `partner_account_reference`, `status`, `expires_at`
- `PartnerCredential` — includes `encrypted_hmac_secret`, `hmac_secret_iv`, `rotated_at`, `revoked_at`

---

## 13. IDENTITY MAPPING

| Base44 field | Linux field | Direction |
|-------------|-------------|-----------|
| `PartnerIntegration.id` | `base44_partner_reference` | Base44 → Linux |
| `PartnerIntegration.linux_api_partner_id` | `partner_uuid` | Linux → Base44 |

The `linux_api_partner_id` is **immutable** after confirmation. Only an audited admin correction may change it.

---

## 14. BASE44 FUNCTION ENDPOINTS (for Linux reference)

| Function | Path | Purpose |
|----------|------|---------|
| `trustedActivityBridge` | `/functions/trustedActivityBridge` | Receives verified activity from Linux |
| `managePartner` | `/functions/managePartner` | Admin partner management (called from frontend) |
| `partnerEventIngest` | `/functions/partnerEventIngest` | Migration-only event ingestion (setup_required partners only) |
| `partnerAccountLink` | `/functions/partnerAccountLink` | User-facing account linking (called from frontend) |
| `getBrowserExtensionRelease` | `/functions/getBrowserExtensionRelease` | Fetches extension release metadata from Linux |
| `completeTask` | `/functions/completeTask` | User/admin task completion (calls `finalizeCompletion`) |
| `recordTaskEvent` | `/functions/recordTaskEvent` | Client-assisted task progress (non-trusted) |
| `adjustBalance` | `/functions/adjustBalance` | Admin points/XP adjustments |
| `redeemReward` | `/functions/redeemReward` | Reward redemption |
| `oauthStart` | `/functions/oauthStart` | OAuth flow initiation (Google/X) |
| `oauthCallback` | `/functions/oauthCallback` | OAuth callback handler (Google/X) |
| `oauthConfig` | `/functions/oauthConfig` | OAuth configuration status |
| `disconnectService` | `/functions/disconnectService` | Disconnect Google/X service |
| `deleteAccount` | `/functions/deleteAccount` | User account deletion |
| `getMyAccess` | `/functions/getMyAccess` | User access/permissions |
| `classifyDestination` | `/functions/classifyDestination` | URL classification (extension) |
| `publicDestinations` | `/functions/publicDestinations` | Public destination directory |
| `adminStats` | `/functions/adminStats` | Admin dashboard statistics |
| `taskStats` | `/functions/taskStats` | Task analytics |
| `adminWrite` | `/functions/adminWrite` | Generic admin CRUD |
| `manageTask` | `/functions/manageTask` | Task CRUD |
| `manageStaff` | `/functions/manageStaff` | Staff member CRUD |
| `setUserStatus` | `/functions/setUserStatus` | User status management |
| `startTask` | `/functions/startTask` | Start a task session |
| `createBrowserPairingCode` | `/functions/createBrowserPairingCode` | Extension pairing |
| `listBrowserDevices` | `/functions/listBrowserDevices` | List user devices |
| `revokeBrowserDevice` | `/functions/revokeBrowserDevice` | Revoke a device |
| `trustedBrowserConfig` | `/functions/trustedBrowserConfig` | Trusted browser configuration |
| `updateRedemption` | `/functions/updateRedemption` | Update redemption status |

---

## 15. CONTACT

For questions about this contract, refer to the Base44 Perk Sphere source code or contact the Perk Sphere development team.

**End of contract.**