# Points-to-GBP conversion interface — published paused preparation

The Wallet page has a member-bound conversion panel through convertMemberPoints. It is hidden when unavailable unless an existing recovery record needs attention. It quotes only an explicitly configured enabled policy, accepts whole Points in exact increments and formats integer GBP pence with BigInt. There is no default rate, USD/FX, provider payment, withdrawal, top-up or gift-card action.

## Server authorization and confirmation
The function accepts only policy or convert with a UUID request_reference, positive safe-integer points and unsigned policy_version. It derives the actual member actor, rechecks session/status and required source/member/authoritative-ledger/cash-read gates before and after dispatch, and forwards only fixed policy/convert paths. It never accepts a browser member, currency, paid amount or payout destination.

Linux conversion replies now echo the exact member, request and policy alongside the immutable operation/amounts. The gateway binds all of them, strips private fields and rejects foreign currency, wrong Points, missing operation identity or a claimed payout. Root still owns the transactional policy/budget/debit/credit decision. Read availability is a prerequisite for conversion; enabling reads alone cannot spend Points.

Only the specific 409 CASH_POLICY_CHANGED rejection is translated to a definitive no-credit response. The engine checks an existing receipt before current policy, so a committed old request retries against its original evidence even after rate/budget pause. Other failures, malformed results, lost sessions and uncertain outcomes retain the original request.

## Recovery and consent
An explicit user confirmation saves the member, exact UUID/amount/policy and quoted increment/output before transport, with a storage readback check. No request is sent when preparation cannot persist. Pending controls freeze the original terms; retries use the same command and never run automatically on page load.

The response must match the saved expected pence as well as the original request. Confirmation is saved before cleanup. Failed cleanup retains a confirmed record that blocks new conversions; clearing it sends no network money request. Corrupt or concurrently changed records require review and are not automatically deleted. A new policy identity follows only a definitive rejected old request and a fresh explicit policy review. Balance refresh failure never turns a confirmed receipt into an uncertain debit.

Recovery uses per-member sessionStorage, following the existing XP architecture. It survives reload in the same session, not deletion of browser storage or closure of its tab/session. The authoritative ledger/history remains the recovery source if local data is lost. Stored confirmation is not independently fresh provider/funding evidence. Account/focus changes clear displayed terms and invalidate late callbacks; no financial operation is automatically retried.

## Verification and deployment limits
450 app tests pass, including 17 gateway/contract/client/recovery and 9 actual component regression cases. Existing XP-recovery cases remain intact. Changed-file lint, Vite build and 152 backend/resource syntax checks pass. An export of the actual pure handler/client/recovery traverses real signed HMAC/nonce HTTP into isolated MariaDB: a committed credit followed by a lost reply and paused policy/budget confirms the original operation with one debit; a distinct stale request is rejected without credit.

All tests use synthetic member/provider configuration and the dedicated test database. No live cash module/schema, rate, budget, conversion, hold or provider transaction is deployed or enabled. Member policy/cash/source/read gates remain disabled in production; no credential or balance changes are made by publishing this paused panel.

Before any real conversion: independently verify reserves and approve terms; complete reversal/dispute/debt and payout/uncertain-settlement processes; review the Linux code/schema deployment and coordinated source/member gates; and complete genuine member/new-member/mobile/recovery acceptance. This page records an internal accounting liability, not a paid withdrawal. It cannot reverse a conversion.
