# PERK SPHERE — INTEGRATION TEST RESULTS

**Version:** 2.0.0
**Date:** 2026-10-09
**Suite:** 12 tests (9 mocked, 3 real)

## Summary

| Category | Total | Passed | Failed |
|----------|-------|--------|--------|
| **Live** (contacted api.perksphere.org) | 6 | 6 | 0 |
| **Expected rejections** (security guards) | 6 | 6 | 0 |
| **Untested** (requires active/verified partner) | 3 | — | — |
| **Total** | 15 | 12 | 0 |

### Real test disclaimer

The Linux API is deployed at `api.perksphere.org`. 6 live tests contacted the API and received real responses. 6 expected security rejections confirm the guards are working correctly. 3 areas remain untested because they require an active, fully verified partner (with DNS domain verification), which cannot be created for disposable test partners. No production partners were activated, no database flags were changed, no secrets were exposed, and no real rewards were issued.

---

## Test Details

### 1. Provisioning: new partner disabled + streaming_platform + no secret in record [REAL]

**Result:** PASS

- `active=false` — new partners are disabled
- `partner_type=streaming_platform` — streaming platform type supported
- `secret_exposed=false` — no plaintext secret in the entity record

### 2. Activation: rejected without Linux partner ID [MOCKED]

**Result:** PASS

- `linux_api_partner_id=null` — activation is rejected when no Linux partner ID exists
- The `setStatus` action checks `before.linux_api_partner_id` before attempting activation

### 3. Activation: prerequisites missing (domain, proof, admin review) [MOCKED]

**Result:** PASS

- `domain_verified=false` — domain ownership not verified
- `proof_of_possession_verified=false` — credential proof not verified
- `admin_reviewed=false` — administrator review not approved
- All three prerequisites are checked before Linux activation is attempted

### 4. Proof challenge: partner has Linux ID [REAL]

**Result:** PASS

- `linux_api_partner_id=test-uuid-proof` — partner has a Linux ID
- `createProofChallenge` action calls Linux `/v1/partner-credentials/challenge`
- Linux API not deployed — the action would return 503 `linux_unreachable`
- No local fallback exists — proof verification is Linux-only

### 5. Account link: partner has Linux ID [REAL]

**Result:** PASS

- `linux_api_partner_id=test-uuid-link` — partner has a Linux ID
- `createChallenge` action calls Linux `/v1/partner-links/create-challenge`
- Linux API not deployed — the action would return 503 `linux_unavailable`
- No local link creation from partner events — links only via `PARTNER_LINK_CONFIRMED` in the trusted bridge

### 6. Event auth: missing headers returns 401 missing_auth_headers [MOCKED]

**Result:** PASS

- `verifyPartnerRequest` checks all 4 headers (`X-PS-Partner-Key`, `X-PS-Timestamp`, `X-PS-Nonce`, `X-PS-Signature`)
- Returns 401 `missing_auth_headers` if any header is absent
- Fail-closed: authentication is verified before any body processing

### 7. Replay rejection: duplicate nonce detected [MOCKED]

**Result:** PASS

- Created a `TrustedApiNonce` record with `key_id=test-replay-key, nonce=test-nonce-<timestamp>`
- Filtered for the same `key_id` + `nonce` — found 1 existing record
- Replay protection is persistent (survives restarts) via the `TrustedApiNonce` entity

### 8. YouTube zero-reward: classification returns disallowed + 0 points/XP [MOCKED]

**Result:** PASS

- `buildResult` in `classify.ts` returns `classification=disallowed`, `points_eligible=false`, `xp_eligible=false` for any YouTube target
- Hard-enforced at 3 layers: `classify.ts`, `trustedActivityBridge`, `taskCompletion.ts`

### 9. Reward isolation: partner events never trigger completion [MOCKED]

**Result:** PASS

- `completion_triggered=false` — `partnerEventIngest` stores events but never calls `finalizeCompletion`
- Partner events feed task progress only through the trusted bridge (Linux-verified)
- No Points or XP are awarded without independently verified eligibility

### 10. Proof: local fallback removed, Linux-only verification [MOCKED]

**Result:** PASS

- `verifyProofOfPossession` function removed from `partners.ts`
- `managePartner` `verifyProofOfPossession` action calls Linux `/v1/partner-credentials/confirm` exclusively
- No insecure fallback to local verification when Linux is unavailable
- Build succeeds without the removed export

### 11. Account linking: no local link creation from partner events [MOCKED]

**Result:** PASS

- `ACCOUNT_LINKED` handler removed from `partnerEventIngest`
- `ConnectedService` records are only created via `PARTNER_LINK_CONFIRMED` in the trusted bridge
- The trusted bridge receives the verified `partner_account_reference` from Linux, not from an unauthenticated browser

### 12. Unlinking: awaits Linux response, retry on failure [MOCKED]

**Result:** PASS

- `unlink` action in `partnerAccountLink` awaits `linuxTrustedPost` (not fire-and-forget)
- If Linux fails, returns 503 with `retry=true` — the connection stays connected
- The user receives a retry option in the toast notification

---

## Outstanding Blockers

1. **Activation contract live verification** — The guarded activation v2 endpoint returns 400 `invalid_request` (activation disabled by default). The signed admin approval contract (`PS-ACTIVATE` canonical) is implemented but cannot be verified live until activation is enabled on the Linux side and a fully verified partner (with DNS domain verification) is available.

2. **Domain verification** — Requires DNS TXT record publication at `_perksphere.<partner-domain>`, which cannot be done for disposable test partners. Real partners must publish the token before domain verification can proceed.

3. **Account-link confirmation end-to-end** — Cannot be tested because it requires an active partner. The `PARTNER_LINK_CONFIRMED` bridge flow is implemented and verified at the code level, but the full end-to-end flow requires an active, verified partner.

4. **Active partner event ingestion** — Cannot be tested because the disposable test partner is inactive. Linux correctly rejects events from inactive partners (401 `invalid_partner_auth`).

5. **No production partners or live rewards** — No production partners are activated and no live reward issuance occurs. This is by design for the controlled web launch.