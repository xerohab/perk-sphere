# Member GBP accounting history — published paused preparation

The Wallet page has a separate read-only cash-history panel through getMemberCashWallet. With its gate off, the gateway returns a disabled response without querying Linux, and the panel stays hidden; it never invents a zero cash opening. The existing Points/XP wallet and XP-conversion recovery flow are preserved.

The function derives member identity from the authenticated session, caps pagination to 25 rows, permits only a fixed wallet-read path, and checks identity/status and flags before dispatch and after return. Browser actor, currency, conversion, payout and amount fields are rejected. The panel cannot convert, reserve, release, top up, withdraw or send a payment.

The independent PERKSPHERE_CASH_WALLET_READ_ENABLED switch defaults off. The gateway/source also require the existing cash-source and authoritative-ledger gates; Linux additionally requires cash accounting and the wallet-read switch. Conversion/holds retain separate gates. Reading future history must remain possible without enabling conversion. No gate was enabled in this batch, and the Linux cash router/schema remain undeployed candidates.

Responses strip member/request/provider/funding identifiers, require exact GBP pence strings and balance/reserve arithmetic, and reject payout-enabled or malformed journal data. Formatting uses BigInt with exact pence, including values above JavaScript's safe integer range. The panel binds requests to the current member, clears values on focus/visibility changes, ignores late replies and makes no automatic retry. Each history page is a current snapshot; pagination is not a multi-page frozen snapshot.

The displayed planned threshold remains £50, but reaching it does not activate withdrawals or verify provider reserves. An accounting hold/release is never described as a paid withdrawal. All actual financial rollout prerequisites, provider/funding verification and genuine member/mobile acceptance remain mandatory.

Validation: 424 app tests, including new contract/gateway/client/source/UI cases and the preserved five XP-recovery cases; changed-file lint, Vite build and 149 backend/resource syntax checks. The exported real pure gateway also passed an isolated SQL test through actual HMAC/nonce HTTP routes with conversion paused, with no additional operation records. All money examples and provider keys in tests are synthetic. No real member cash, payment, conversion, provider operation or secret was used.

The cash-specific source rechecks its relevant gates after asynchronous member/restriction reads. A pause during those reads returns ineligible rather than issuing stale eligibility. These request-time checks do not create an atomic snapshot across services.
