# PayPal withdrawal replacement — 15 November 2026

Gift cards are deferred at the owner's request. Member voucher URLs redirect to the Wallet. Historical provider modules and staff recovery pages are retained for audit; this change does not delete records or rotate credentials. Current source and recovery screens remain paused, and are not launch requirements for the new payout method.

The owner selected the existing planned £50 minimum and the administrator-configured Points-to-GBP rate. There is no invented conversion rate. PayPal request submission remains closed until the actual accounting and payout workflow below is implemented and verified. The published copy explicitly states this; no request form accepts unsupported financial instructions.

## Required manual workflow

- Authenticate and recheck current member eligibility and approved conversion policy. Use exact GBP pence, not floating point. Verify approved funding capacity.
- Submit an immutable amount and PayPal destination using one durable request UUID. In one database transaction reserve the available GBP balance and create the payout request, deadline and audit. Enforce £50 per request. A retry cannot create a second hold or change the original destination.
- Member sees pending review, processing, sent, rejected or cancelled. Pending is never described as paid. Store destinations privately and exclude them from general logs, analytics and public responses.
- Staff use an authorized, audited queue with optimistic versions and an exclusive processing claim. Show the exact recipient and amount for manual PayPal sending. The target is to send approved requests within 24 hours, with overdue requests visible. PayPal receipt timing is separate.
- Staff record the real, unique PayPal transaction ID and payment evidence after sending. Settlement debits the cash liability and releases its reserve exactly once; marking sent must not merely release a hold and leave the money spendable. A failed/uncertain send stays in processing for reconciliation, not automatic refund or resend.
- Reject/cancel only before dispatch, releasing the original reserve once with a recorded reason. Preserve original request, state transitions and history. Resolve an uncertain external payment before permitting cancellation or replacement.
- Verify concurrent requests, duplicate submissions, stale staff edits, account switching, cancellations, insufficient balance, lost replies and settlement reconciliation using isolated database tests before enabling requests.

## Automation

PayPal Payouts can replace the manual send step after business account approval, adequate PayPal balance, credentials and sandbox/live acceptance. Use a persisted sender batch/item identity, strict recipient/currency/amount binding, authenticated status/webhook evidence and recovery of uncertain responses. A successful HTTP submission is not proof the recipient was paid. Automatic sending remains disabled and no credentials or financial gates were changed in this release.

Official reference: https://www.paypal.com/uk/cshelp/article/what-is-the-payouts-api-formerly-known-as-mass-pay-and-how-to-apply-for-it-help250
