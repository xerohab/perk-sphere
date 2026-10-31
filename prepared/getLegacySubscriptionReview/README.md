# Subscription guard review — staged, 31 October 2026

This is a read-only inspection path, not recovery or payment acceptance. Neither API router is mounted in production. No production subscription schema, credentials, payment, native entitlement, Points or XP were changed by this batch.

## Contract
Candidate API mount: /v1/perk-sphere/legacy-subscription-review. POST /queue requires existing service HMAC authentication plus a server-derived administrator actor. Default-off gate: PERKSPHERE_LEGACY_SUBSCRIPTION_REVIEW_ENABLED=true. The Base44 candidate uses authorize(..., 'partners.view') before deriving that actor. Members and inactive staff cannot supply their own actor.

Request: actor {user_reference, role:'admin'}, explicit environment 'sandbox' or 'live', integer limit 1–100, offset 0–10000. The fixed partner is The Front Row. Both queries use one repeatable-read, read-only consistent snapshot. Queue order is creation time followed by unique event hash.

Response includes processing/review counts and bounded events: reference/type/status, age in seconds, opaque subscription scope hash, guard status, and scope_consistent. No claim token, payload digest, raw payload, member identity, email or provider credential is returned. Missing mappings are visible as inconsistent; this report is not a complete orphan-guard integrity audit. Completed claims are excluded. has_more refers to this snapshot; concurrent callbacks can change pagination between requests. No automatic bulk export beyond the bounded offset exists.

## Installation prerequisites
Complete the coordinated writer cutover in legacy-subscription-guard-cutover.md first. Apply and verify its tables using a fresh restore-tested backup. Mount the API candidate deliberately, with the review flag initially off. Do not expose it through partner authentication or public entity reads.

The Base44 source is prepared/getLegacySubscriptionReview/entry.ts. It has no Deno.serve and is not a deployed backend function. To install later, move into base44/functions/getLegacySubscriptionReview/entry.ts, change ../../base44/shared/ imports to ../../shared/, add the normal Deno.serve entry, compile, test and publish. Its Linux path is already within the existing /v1/perk-sphere/ allowlist; no broad path permission is needed. No administrator screen is installed by this batch.

## Handling an uncertain event
A processing or review record is not proof that a payment failed or that a native write did not occur. Preserve the guard and provider event. Privately compare independent provider evidence with the current native entitlement and bound account/creator/plan/currency/amount/environment. Stop the old writer before considering any correction. Record evidence and the reviewed decision in an audited recovery design.

There is intentionally no release, force-complete, lease-expiry takeover, payment replay, entitlement grant or retry button. The existing external Base44 write has no transactional fencing with this database; releasing a guard could let a late old writer and a new writer both apply access. A safe recovery protocol and genuine provider lifecycle acceptance remain unfinished. Do not edit guard status directly as routine recovery.

## Validation
7 API unit/HTTP regressions pass; isolated MariaDB test confirms environment/partner isolation, completed-event exclusion, missing-scope visibility, stable ordering and pagination, and unchanged quarantined status. Main app adds 4 mocked gateway tests covering staff authorization, server-derived identity, strict scope/bounds, private-field projection and malformed-response failure. No real provider operation or production member mutation is used.
