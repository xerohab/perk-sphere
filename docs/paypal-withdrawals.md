# PayPal withdrawal replacement — 15 November 2026

Gift cards are deferred at the owner's request. Member voucher URLs redirect to the Wallet. Historical provider modules and staff recovery pages are retained for audit; this change does not delete records or rotate credentials. Current source and recovery screens remain paused, and are not launch requirements for the new payout method.

The owner approved a £20 minimum and a rate of 200 Points = £1 (200 Points for 100 GBP pence). The rate remains disabled until a funded payout budget is confirmed. The manual request workflow below is implemented and database-tested. Actual Points-to-GBP conversion still requires an explicitly configured, enabled rate and approved funding budget. No conversion rate or funding amount is supplied automatically.

## Manual workflow requirements

- Authenticate and recheck current member eligibility and approved conversion policy. Use exact GBP pence, not floating point. Verify approved funding capacity.
- Submit an immutable amount and PayPal destination using one durable request UUID. In one database transaction reserve the available GBP balance and create the payout request, deadline and audit. Enforce £20 per request. A retry cannot create a second hold or change the original destination.
- Member sees pending review, processing, sent, rejected or cancelled. Pending is never described as paid. Store destinations privately and exclude them from general logs, analytics and public responses.
- Staff use an authorized, audited queue with optimistic versions and an exclusive processing claim. Show the exact recipient and amount for manual PayPal sending. The target is to send approved requests within 24 hours, with overdue requests visible. PayPal receipt timing is separate.
- Staff record the real, unique PayPal transaction ID and payment evidence after sending. Settlement debits the cash liability and releases its reserve exactly once; marking sent must not merely release a hold and leave the money spendable. A failed/uncertain send stays in processing for reconciliation, not automatic refund or resend.
- Reject/cancel only before dispatch, releasing the original reserve once with a recorded reason. Preserve original request, state transitions and history. Resolve an uncertain external payment before permitting cancellation or replacement.
- Verify concurrent requests, duplicate submissions, stale staff edits, account switching, cancellations, insufficient balance, lost replies and settlement reconciliation using isolated database tests before enabling requests.

## Automation

PayPal Payouts can replace the manual send step after business account approval, adequate PayPal balance, credentials and sandbox/live acceptance. Use a persisted sender batch/item identity, strict recipient/currency/amount binding, authenticated status/webhook evidence and recovery of uncertain responses. A successful HTTP submission is not proof the recipient was paid. Automatic sending remains disabled and no credentials or financial gates were changed in this release.

Official reference: https://www.paypal.com/uk/cshelp/article/what-is-the-payouts-api-formerly-known-as-mass-pay-and-how-to-apply-for-it-help250

## Implemented request workflow

The member Wallet now mounts `PaypalPayoutPanel`; staff with `payouts.manage` have `/admin/paypal-payouts`. The new permission belongs to Super Admin only. Gateway entries are `paypalPayouts` and `managePaypalPayouts`; SDK identity and permission are rechecked before and after dispatch. The signed source callback separately revalidates the staff account and permission for the requested action/payout. Member bodies cannot choose ownership.

The Linux `/v1/perk-sphere/paypal-payouts/member` and `/admin` routes use service HMAC and nonce authentication, rate limits, strict commands and redacted failures. Requests reserve an existing GBP cash balance atomically. Each original request ID binds its amount and PayPal email. A £20 minimum applies to every request. Member cancellation and staff rejection release an unpaid hold exactly once. The generic hold-release endpoint refuses payout-managed holds.

Staff claim transitions `requested` to `processing`; only the claiming staff account can record the completed PayPal transaction. Processing cannot be cancelled or rejected. A unique completed PayPal transaction ID, original email/amount and staff evidence note are required to record `sent`. Settlement reduces both GBP balance and reserved balance once, with cash journal, hold, payout state and immutable audit in one transaction. Cumulative budget allocation remains consumed after payment. This records staff attestation of a manual payment; the app does not independently verify or send it through PayPal.

The queue prioritizes processing and requested items; pagination and overdue indicators are available. Client commands survive uncertain replies in per-member tab session storage, freeze original terms and retry the same identity. Corrupt recovery data blocks replacement requests. Account changes suppress late output. Full PayPal email destinations are visible only in authenticated member-owned responses or the authorized staff queue; they must not enter analytics or generic logs.

## Deployment and activation

Apply the five existing `20261031_cash_*` migrations and then `20261115_paypal_payout_requests.sql`. Install the cash modules and three payout modules together, preserving live server overlays. Existing tables receive additive paid-status support; no member cash, conversion rate, budget or PayPal credential is seeded.

Linux requires `PERKSPHERE_CASH_ACCOUNTING_ENABLED` and `PERKSPHERE_PAYPAL_PAYOUT_REQUESTS_ENABLED`; member conversion, cash reads and policy/budget administration retain their existing independent gates. Base44 requires `PERKSPHERE_PAYPAL_PAYOUT_REQUESTS_ENABLED`, `PERKSPHERE_CASH_SOURCE_ENABLED`, `PERKSPHERE_CASH_WALLET_READ_ENABLED` and `PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE`; conversion also needs `PERKSPHERE_CASH_MEMBER_ENABLED`. Set admin policy and budget gates for configuration, create explicit disabled rules first, then approve the real rate and funding ceiling. No money can be created from a missing rule or empty budget.

Automatic PayPal Payouts remains outside this manual-send release. No automated payment credentials are required for staff sending in PayPal. Production activation must not invent a rate or claim an unverified funding reserve.


Release verification: API commit `9d300443885ec7432dab4a41cdf268e7984a7502` passed the PayPal, ledger and gift GitHub checks, including real isolated MariaDB tests. The six cash/payout migrations and selected modules were installed on the live API with its existing source overlays preserved. Source and database backups were created before installation. The API and database health checks passed; unsigned payout requests return 401. No real member conversion, payout request or PayPal transfer was created as a test. Browser member acceptance remains separate from this server verification.

The £20 withdrawal minimum corresponds to 4,000 Points at the approved rate. Rates are configured through the audited policy service; existing Points and XP balances are not reset or revalued.

Withdrawals must be whole £20 blocks (2,000 pence): £20, £40, £60, etc. The member form, command contract, server submission and database constraint enforce the increment. At the approved rate, each block requires 4,000 Points. Funding and request gates remain unchanged.
