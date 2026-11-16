# PerkSphere release verification — 16 November 2026

## PayPal activation update — 16 November 2026

The owner subsequently selected a £100 total funding ceiling and authorized activation. The audited GBP budget is enabled at 10,000 pence, version 2; conversion policy version 2 is enabled at 200 Points per 100 pence. Funding is owner-declared, not independently verified bank/provider evidence. Member cash and PayPal request gates are enabled on the API and app. Service and database health passed after restart. The signed member list route returned HTTP 200 with minimum 2,000 pence, target 24 hours, automatic_payments false and zero requests; no payout or cash conversion was created. Requests remain in exact £20 blocks and staff make transfers manually. No payment was sent by this activation.

The earlier paused-state checks below are retained as historical evidence. They no longer describe current withdrawal availability. Genuine member end-to-end acceptance and a real manual payout remain unverified.


Decision: automated and public-page checks pass. Official-launch acceptance is still pending a genuine signed-in member journey. PayPal withdrawals must remain paused until a funded conversion budget is approved. A £20 request increment is not a total funding ceiling.

## Release identities

- Published application/source: `8e94a6119474b12ee2737b33da5c2dc138301c05` (`xerohab/perk-sphere`, main).
- API candidate tested: `ec7000af462750328c8cb9741f4fd47983ac98a5` (`xerohab/perk-sphere-api`, `perksphere-13-events-20261011`).
- The live API retains its existing deployment overlays. The selected cash/PayPal modules and additive migrations were installed separately; the live checkout's original Git HEAD is not an accurate inventory of its deployed overlay files.
- This verification did not reset balances, enable withdrawals, change funding, send PayPal money or publish a launch announcement.

## Checks completed today

| Check | Result | Evidence / scope |
|---|---|---|
| Web unit, contract and component tests | 540 passed, 0 failed | Fresh `npm test` on the published source |
| Lint | Passed | `npm run lint` |
| Type checks | Passed | `npm run typecheck` |
| Backend/resource syntax | Passed | 176 files, `npm run check:backend` |
| Production frontend build | Passed | Existing configured app ID and published Base44 URL |
| API cash/PayPal tests | 50 passed, 0 failed | Fresh rerun of the current PayPal GitHub job |
| Isolated MariaDB accounting tests | 34 passed, 0 failed | Fresh rerun; real MariaDB 10.11, disposable test schema and synthetic members/transactions |
| API and database health | Healthy | Live `/v1/health` |
| Core configuration | All six checks passed | Live service environment plus authenticated Base44 launch-source read |
| Negative ledger balances | 0 found | Read-only aggregate of live ledger account balances |
| Public homepage | Loaded | Correct limited-launch messaging and £20-block withdrawal availability wording |
| Public destination directory | Loaded | Four configured partner destinations displayed |
| Public destination detail | Loaded | Front Row classification, link and eligibility messaging displayed |
| Registration entry | Loaded | Google and email/password signup choices displayed; no account created in this check |

The fresh database run is recorded at https://github.com/xerohab/perk-sphere-api/actions/runs/43725137956 (rerun job `133217465615`). The ledger and gift workflows for the exact API source also have successful completed runs. Local test logs are temporary; the GitHub run is the durable database-test record.

The database suite covers duplicate and competing submissions, atomic conversion/hold/release, £20 minimum and increment enforcement, exclusive staff claiming, cancellation restrictions, unique PayPal transaction references, paid settlement, audit integrity, rollback, owner isolation and signed HTTP admission. These tests do not prove that a real PayPal transfer was made or received.

## Verified live financial settings

- Approved conversion: 200 Points = GBP1.00, stored as 200 input Points / 100 output pence.
- Conversion policy is configured but disabled.
- Withdrawal requests must be £20, £40, £60, etc.; every £20 block corresponds to 4,000 Points.
- The live database constraint enforces `amount_pence >= 2000 AND MOD(amount_pence, 2000) = 0`.
- No cash funding budget is configured.
- Member cash conversion and PayPal request service flags are false. The public payout route returns 503 while paused, as expected.
- There are zero live PayPal request records. Staff configuration controls remain available; they do not themselves send payments.
- Gift cards are outside the current launch scope. Automatic PayPal sending is not enabled; the implemented flow records staff-attested manual payments.

## Acceptance session still required

A real authenticated browser session was not available during the public checks. The registration form is prepared for the owner to create a genuine test member; existing-member sign-in can validate the existing wallet but cannot prove fresh-account enrollment.

1. Register one genuine member and confirm a zero opening wallet, without resetting existing users.
2. Complete an eligible game, respecting the configured 60-second requirement; confirm the expected Points and XP in wallet/history.
3. Claim daily check-in, repeat/reload, and confirm a single credit.
4. Verify an eligible partner task using actual partner evidence and the correct linked account. Do not manufacture a watch or registration proof.
5. Switch accounts and repeat key member pages at mobile size; confirm no stale balances or personal data appear.
6. As authorized staff, open the PayPal queue and rate/budget controls. While paused, confirm that no withdrawal can be submitted.
7. After a real funding budget is approved, enable the coordinated gates, test a member-owned request, reservation, cancellation and staff processing. Any real PayPal send must be performed and verified by the owner; the site must not label a pending/uncertain transfer as paid.

## Launch preparation

The current published site describes the limited Points/XP scope and conditional withdrawal availability. Keep this description until the member acceptance session passes. Do not advertise withdrawals as open while their flags are off.

For PayPal activation, the owner must choose and confirm the total GBP funding ceiling and its reserve reference. Use the existing audited budget administration; no arbitrary value should be seeded. The owner should assign a Super Admin to review the queue and reconcile manual transfers against the displayed recipient, amount and unique PayPal transaction ID. The 24-hour sending target requires staff coverage; PayPal receipt timing is separate.

If the signed-in acceptance session passes while withdrawals remain paused, a Points/XP-only launch can be considered with that exclusion stated plainly. This report is not a completed full-platform or real-payment acceptance certificate.
