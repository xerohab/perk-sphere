# FIRST-PARTY PARTNER INTEGRATION SPEC

**Version:** 1.0.0
**Date:** 2026-10-09

This document specifies the implementation required in the **Xero Streams** and **DKO Wrestling** Base44 applications to integrate with Perk Sphere as first-party partners. Perk Sphere is the central rewards platform; the partner apps authenticate their own users, present a consent screen, confirm Linux-issued challenges, and submit signed activity events.

## 1. ARCHITECTURE

```
Perk Sphere user  →  Perk Sphere (partnerAccountLink)  →  Linux API (challenge)
                                                              ↓
User logs in to partner app  →  Partner consent screen  →  Linux API (confirm)
                                                              ↓
Linux API  →  Perk Sphere (trustedActivityBridge / PARTNER_LINK_CONFIRMED)
                                                              ↓
Partner app  →  Linux API (/events, HMAC-signed)  →  Perk Sphere (rewards)
```

**Authority separation:**
- **Perk Sphere** — user accounts, reward ledger, task definitions, partner registration, activation approval.
- **Linux API** — partner credentials, domain verification, proof-of-possession, account-link challenges, event ingestion/translation.
- **Partner app** — local user authentication, consent screen, challenge confirmation, signed event submission.

## 2. REQUIRED ENVIRONMENT SECRETS (per partner app)

Each partner app stores its own credentials as Base44 secrets (never in frontend code):

| Secret name | Purpose |
|-------------|---------|
| `PERKSPHERE_PARTNER_KEY_ID` | The partner key ID issued by Linux during provisioning |
| `PERKSPHERE_PARTNER_HMAC_SECRET` | The partner HMAC secret issued by Linux (AES-GCM encrypted at rest by Perk Sphere; the partner app stores it in plaintext in secrets) |

These are obtained from the Perk Sphere admin panel after the partner is registered and provisioned. The admin delivers them out-of-band to the partner app operator.

## 3. REQUIRED BACKEND FUNCTIONS (per partner app)

### 3.1 `partnerLinkConsent` — Consent screen data

Returns the consent screen information for the authenticated local user.

**Auth:** Requires the local app user to be authenticated.

**Response:**
```json
{
  "ok": true,
  "perk_sphere_name": "Perk Sphere",
  "perk_sphere_url": "https://perksphere.org",
  "partner_name": "Xero Streams",
  "partner_account_reference": "<local user ID or handle>",
  "information_shared": [
    "Your Xero Streams account identifier",
    "Your viewing activity (stream watched, duration)"
  ],
  "challenge_token": "<from URL query parameter>"
}
```

### 3.2 `partnerLinkConfirm` — Confirm the account link

Confirms the Linux-issued challenge on behalf of the authenticated local user. Calls the Linux API `/v1/partner-links/confirm` endpoint with partner HMAC authentication.

**Auth:** Requires the local app user to be authenticated. The link is bound to the authenticated local account, NOT a client-supplied user ID.

**Request:**
```json
{
  "challenge_token": "<from Perk Sphere user>"
}
```

**Server-side logic:**
1. Verify the local user is authenticated.
2. Extract the `challenge_token` from the request body (never from a URL parameter that could be manipulated).
3. Use the authenticated local user's account reference (ID or handle) as `partner_account_reference`. Never accept a client-supplied user ID.
4. Sign the request with the partner HMAC secret (server-side only).
5. Call Linux API: `POST https://api.perksphere.org/v1/partner-links/confirm`
   - Headers: `X-PS-Partner-Key`, `X-PS-Timestamp`, `X-PS-Nonce`, `X-PS-Signature`
   - Body: `{ "challenge_token": "...", "partner_account_reference": "<local user ID>" }`
6. If Linux confirms (200), the link is complete. Linux will notify Perk Sphere via the trusted bridge.
7. If Linux rejects (400/403), return the error to the user.

**Canonical request for HMAC signature:**
```
POST\n/v1/partner-links/confirm\n<timestamp>\n<nonce>\n<sha256_hex(raw_body)>
```

### 3.3 `partnerUnlink` — Unlink from Perk Sphere

Unlinks the local user's account from Perk Sphere.

**Auth:** Requires the local app user to be authenticated.

**Server-side logic:**
1. Verify the local user is authenticated.
2. Call Linux API: `POST https://api.perksphere.org/partners/account-link/unlink`
   - Body: `{ "partner_uuid": "<Linux partner UUID>", "user_reference": "<Perk Sphere user ID>" }`
   - Note: The `user_reference` is the Perk Sphere user ID, not the local user ID. The partner app may not know the Perk Sphere user ID. In this case, the partner app can skip the Linux unlink call and let the Perk Sphere user unlink from their side.
3. Mark the local link record as unlinked.

### 3.4 `partnerSubmitEvent` — Submit a signed activity event

Submits a signed activity event to the Linux API for reward processing.

**Auth:** Requires the local app user to be authenticated (the event is attributed to the local user).

**Server-side logic:**
1. Verify the local user is authenticated.
2. Build the event payload with the local user's Perk Sphere user reference (from the link record).
3. Sign the request with the partner HMAC secret (server-side only).
4. Call Linux API: `POST https://api.perksphere.org/events`
   - Headers: `X-PS-Partner-Key`, `X-PS-Timestamp`, `X-PS-Nonce`, `X-PS-Signature`
   - Body: see event payload below
5. Include replay protection (unique nonce per request), idempotency (unique `external_event_id`), and error handling.

**Event payload:**
```json
{
  "external_event_id": "<unique-idempotent-id>",
  "event_type": "STREAM_VIEW_PROGRESS",
  "user_reference": "<Perk Sphere user ID>",
  "task_id": "<Perk Sphere Task ID>",
  "content_id": "<content identifier>",
  "content_url": "<content URL>",
  "eligible_seconds": 120,
  "source_timestamp": "<ISO-8601>",
  "metadata": {}
}
```

## 4. CONSENT SCREEN REQUIREMENTS

The consent screen must:
1. Identify Perk Sphere by name and URL (https://perksphere.org).
2. Identify the partner app by name.
3. Show the local account that will be linked (account handle/ID).
4. List the information that will be shared with Perk Sphere.
5. Require explicit user approval (button click).
6. Never transmit passwords or login tokens to Perk Sphere.
7. Never trust arbitrary return URLs — the confirmation stays on the partner app's domain.

## 5. ACCOUNT-LINK CONFIRMATION FLOW

1. Perk Sphere user requests a link → Perk Sphere calls Linux to create a challenge.
2. Perk Sphere shows the challenge token to the user.
3. The user copies the token and goes to the partner app.
4. The partner app shows a consent screen with the challenge token (from URL query or user paste).
5. The user approves the connection on the partner app.
6. The partner app calls `partnerLinkConfirm` (server-side) which calls Linux `/v1/partner-links/confirm`.
7. Linux verifies the challenge, links the accounts, and notifies Perk Sphere via the trusted bridge (`PARTNER_LINK_CONFIRMED`).
8. Perk Sphere creates the `ConnectedService` record — the link is now confirmed.

## 6. SIGNED EVENT SUBMISSION

Events are submitted to `POST https://api.perksphere.org/events` with partner HMAC authentication:

**Headers:**
| Header | Description |
|--------|-------------|
| `X-PS-Partner-Key` | Partner key ID |
| `X-PS-Timestamp` | Unix epoch seconds (±300s clock skew) |
| `X-PS-Nonce` | Unique per-request nonce (8–128 chars, `[A-Za-z0-9._-]`) |
| `X-PS-Signature` | HMAC-SHA256 hex of canonical request |

**Canonical request:**
```
POST\n/events\n<timestamp>\n<nonce>\n<sha256_hex(raw_body)>
```

**Replay protection:** Each nonce must be unique. The Linux API rejects reused nonces.
**Idempotency:** Each `external_event_id` must be unique. Duplicate events return the stored result.
**Expiry:** Challenges expire after 10 minutes. Events have no expiry but must have a valid `source_timestamp`.

## 7. SECURITY REQUIREMENTS

1. **Separate credentials per partner.** Xero Streams and DKO Wrestling each have their own key ID and HMAC secret.
2. **Never put partner secrets in frontend JavaScript.** All HMAC signing is server-side.
3. **Verify the intended Perk Sphere user, partner identity, challenge, and expiry.** The partner app confirms the challenge with the authenticated local user's account reference.
4. **Never trust arbitrary return URLs.** The confirmation stays on the partner app's domain.
5. **Do not automatically award rewards for visits, logins, or video playback.** Rewards are only issued through the Perk Sphere trusted lifecycle (task progress → completion → finalizeCompletion).
6. **YouTube activity must remain 0 Points and 0 XP.** This is enforced at the Perk Sphere bridge, classification, and completion layers.
7. **Never transmit passwords or login tokens to Perk Sphere.** Only the partner account reference and activity data are shared.

## 8. TESTING CHECKLIST

- [ ] Successful linking: Perk Sphere user requests link → partner app confirms → Perk Sphere shows "Connected".
- [ ] Rejected linking: Invalid challenge token → partner app returns error → Perk Sphere stays "Pending" then "Expired".
- [ ] Cross-account attack: User A's challenge used by User B → rejected by Linux (challenge is user-specific).
- [ ] Replay attack: Same challenge token used twice → rejected by Linux (single-use).
- [ ] Unlinking: Perk Sphere user unlinks → Linux confirms → Perk Sphere shows "Disconnected".
- [ ] Signed test event: Partner submits `is_test: true` event → Linux accepts → no rewards issued.
- [ ] Real Points/XP: Only after the complete trusted lifecycle (active partner + verified event → task progress → completion → finalizeCompletion).

## 9. LINUX API ENDPOINTS (partner-authenticated)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/v1/partner-links/confirm` | POST | Partner HMAC | Confirm account link |
| `/partners/account-link/unlink` | POST | Base44 HMAC | Unlink account (called by Perk Sphere) |
| `/events` | POST | Partner HMAC | Submit activity event |

## 10. REMAINING MANUAL STEPS

1. **Perk Sphere admin** registers both partners (Xero Streams, DKO Wrestling) via the admin panel.
2. **Linux API** provisions credentials for each partner.
3. **Partner app operators** publish DNS TXT records for domain verification.
4. **Perk Sphere admin** verifies domains, proof-of-possession, and test events.
5. **Perk Sphere admin** approves activation via `approvePartnerActivation` (independent approval workflow).
6. **Partner app operators** implement the backend functions specified in this document.
7. **Partner app operators** configure the partner secrets (`PERKSPHERE_PARTNER_KEY_ID`, `PERKSPHERE_PARTNER_HMAC_SECRET`) in their app's Base44 secrets.
8. **End-to-end testing** of the full lifecycle across all three applications.

**End of specification.**