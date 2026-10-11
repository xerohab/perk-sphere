# Perk Sphere consolidated launch-readiness report — 10 October 2026

Validation finalized 11 October 2026; the existing branch and report identifiers are retained.

Release decision: **HOLD — not production-ready.** This report records development work and offline evidence. It does not authorize deployment, partner activation, migration, account imports, or a merge into main.

## Repository scope

All 17 repositories exposed by the connected xerohab account were inventoried. Four were confirmed relevant through their code and integration contracts:

| Repository | Platform responsibility | Development branch |
|---|---|---|
| xerohab/perk-sphere | Base44 member/admin frontend, authentication, tasks, legacy Points/XP, Linux bridges | launch-readiness-2026-10-10 |
| xerohab/perk-sphere-api | Linux API, HMAC authentication, events, directory, quizzes, reports, ledger/redemption preparation | launch-readiness-2026-10-10 |
| xerohab/dko-wrestling | DKO partner account linking and activity submission | launch-readiness-2026-10-10 |
| xerohab/xero-streams | XeroStreams partner linking, viewing activity, PayPal donations and purchases | launch-readiness-2026-10-10 |

The other 13 repositories were not modified: plugins, testplugins, newnew, fixedplugins, Nitro-V3, Polaris-Emulator, Octane-Renderer, atomcustom, dbbackups, changelogs, gamedata, loungebot, Project-XeroX. Root listings and available documentation identified unrelated hotel/emulator/bot assets. Unrelated backup contents were not opened. This inventory covers the connection's exposed repositories, not undisclosed infrastructure or inaccessible repositories.

Newer commits on the existing launch branches were incorporated before this batch. In particular, the API's existing work/perksphere-ledger-integration implementation, migrations, cutover gates, tests and routes were preserved. No branch was reset or force-pushed.

## Preservation

No production database or Base44 entities were written. No account was reset or deleted. No partner was activated, deactivated, rotated, or re-linked. Both verified partner associations were preserved by avoiding live mutations. Their current live status was not independently verified. Existing partner UUIDs, key identifiers, API hosts and activation settings remain intact. No secrets were retrieved or changed. No production service was restarted, deployment published, or main branch merged.

The new RLS, functions and payment receipt schema are **source changes awaiting coordinated publication**. They are not claims that production access controls have already changed.

## Completed development

### Perk Sphere frontend and Base44 functions

- Centralized safe integer, balance, stock, date, account restriction and rank eligibility checks. Negative balances, overflow, malformed costs and restricted redemption are rejected server-side.
- Preserved the legacy-writer cutover kill switch. It is not enabled by this batch.
- Blocked ordinary members from self-completing manual-verification tasks or starting hidden tasks. Explicit no-reward tasks and YouTube tasks issue zero Points/XP. Daily/weekly task periods use UTC and Monday boundaries.
- Fresh completion reads fail closed; both reward currencies are validated before issuance. Sequential completion retries do not award again. This is not concurrent exactly-once protection.
- Enforced redemption state transitions and sequential repeated-status no-ops. Returned redemptions cannot reopen.
- Added a strict outbound Linux path validator; rejected encoded traversal, URL normalization, authority changes, query/fragment injection and backslashes.
- Repaired directory/request/quiz/grading/reward-review request contracts to send the flat fields the API accepts. Normalized Linux UUIDs and response envelopes for the UI. Reward reviewers cannot override server reward deltas.
- Repaired weekly archive UUID lookup, member ownership, admin archive listing and explicit member/completed-week selection. Archives now display stored snapshots rather than recomputed current data.
- Prevented double-click redemption submissions and dismissing a pending redemption dialog. Added catalogue failure/retry feedback.
- Fixed typecheck failures through real optional props, typed UI declarations, correct Headers, form shapes and date arithmetic. Typechecking remains enabled.
- Retained existing authenticated Linux balance/history/redemption bridges. They are gated preparation; the ordinary legacy screens are not a completed ledger cutover.

### Linux API

- Preserved atomic account/ledger/outbox transactions and atomic inventory redemption from the existing development branch.
- Hardened BIGINT conversion and queries against precision loss, invalid numeric database values and overflow; retained source references and operation semantics.
- Added archive snapshot retrieval with ownership checks and bounded admin archive listing, while preserving the existing report-preview contract.
- Extended the safe offline test runner with transaction failure injection and archived-report HTTP tests using in-memory database/auth mocks.
- Preserved the test-database-only integration runner guard. Database integration tests were not run against production.
- Added a read-only configuration/schema preflight. Corrected package entrypoint and loading of .env for the existing read-only ledger readiness command.
- No reward verifier, outbox reconciler or account migration was enabled. The existing reward orchestrator requires an independent verifier and trusted policy loader supplied by the application; those are not complete production adapters.

### DKO Wrestling

- Corrected nonce Base64url signing and the event timestamp contract; validated signatures against independent Node HMAC calculation.
- Restricted arbitrary evidence submissions to administrators. Ordinary members cannot have their own claims signed as trusted activity.
- Restricted link/event record mutations to backend service writes. Corrected SDK filter arguments. Link confirmation stores only the Linux-issued association.
- Unlink now refuses to remove the local association until Perk Sphere mediates authoritative Linux revocation. Existing associations remain linked.
- Failed event deliveries can be retried with the same transport identity. Linux remains the authoritative deduplication boundary.
- Repaired existing frontend checks, admin SDK invitation usage and optional component/context/ref types.

### XeroStreams

- Validated expected partner credentials and signed endpoint allowlists. Corrected nonce generation and required both HTTP success and application acknowledgement.
- Confirmation requires Linux's actual link_uuid; it cannot fabricate a connection UUID. Local-only unlink no longer removes a verified association.
- Protected connection, consent, viewing-session and integration-log writes from browser manipulation. Generic arbitrary activity submission requires admin authorization. Unauthenticated registration-workflow calls now fail closed and need an authenticated server workflow before use.
- YouTube suppression uses URL hostname boundaries. Viewing telemetry rejects invalid numbers, excludes prior paused intervals, bounds heartbeat accumulation, retries undelivered deterministic milestones, and bounds delivery attempts per heartbeat. Client-assisted viewing still requires independent server verification before rewards.
- PayPal checkout now creates a protected server receipt with a hashed capture capability and fixed merchant return URLs. Capture checks order identity, recorded amount/currency and completed capture status, with stable PayPal-Request-Id retries. Donation success requires verified capture, not a URL parameter.
- Product checkout takes a product ID and uses server catalog prices and the authenticated purchaser. Browser storage cannot choose the entitlement to grant. Backend fulfillment uses the receipt and handles sequential retries.
- Protected purchase/subscription mutations from ordinary members and corrected member read ownership. Existing administrator grants and existing subscriptions are preserved.
- Monthly/yearly plans are refused by the one-time Orders checkout; it cannot legitimately create recurring billing. Existing lifetime plans can use the receipt flow. Recurring billing remains a release blocker.
- Removed unused rich-text packages and upgraded React Router to a patched version in all three frontend repositories. Applied compatible lockfile security updates. Fixed existing lint/typecheck failures without disabling checks.

## Validation evidence

All tests use mocks or isolated local HTTP servers. No live partner, PayPal, Base44 account or production database was exercised.

| Repository | Offline tests | Lint | Typecheck | Backend/resource syntax | Frontend build | Dependency audit |
|---|---:|---|---|---|---|---|
| perk-sphere | 53 passing | Pass | Pass | Pass | Pass | 7 findings: 5 high, 2 moderate |
| perk-sphere-api | 71 passing | No configured lint suite | JavaScript syntax checked | Pass for changed JS | Not applicable | 0 findings |
| dko-wrestling | 4 passing | Pass | Pass | Pass | Pass | 7 findings: 5 high, 2 moderate |
| xero-streams | 15 passing | Pass | Pass | Pass | Pass | 7 findings: 5 high, 2 moderate |

143 passing offline tests total, plus four isolated MariaDB checks (see the server verification update). Coverage includes independent HMAC comparison, nonce format, actor/privilege boundaries, restriction/rank/stock validation, sequential idempotency, ledger rollback/outbox failures, BIGINT handling, immutable archives and ownership, payment capability validation, server price selection, fulfillment identity and entity write policy.

Remaining audit findings are in the Tailwind 3 build chain (braces, chokidar, fast-glob, micromatch, postcss-nested, postcss-selector-parser, tailwindcss). They need a supported toolchain migration and visual regression checks. No forced major Tailwind migration was performed. A successful build is not a clean security audit.

All local frontend builds warned that VITE_BASE44_APP_ID is absent. They demonstrate compilation only. Do not upload these local dist directories as a production release. Use each existing app's own Base44 build configuration. React Router 7 navigation changes also need signed-in staging browser checks.

Backend syntax parsing does not substitute for Deno runtime or Base44 entity/RLS validation. Live end-to-end, independent verifier, real MariaDB concurrency, provider sandbox, webhook and restore-rehearsal evidence are outstanding.

## Blocking work and required access/decisions

1. **Ledger cutover:** reconcile every existing balance, stock record, pending award and redemption against the deployed database/schema and Base44 snapshot. The repository does not contain a complete base ledger schema/import procedure. Inventory SQL alone is insufficient. A source-of-truth/migration decision and staging/server/database access are required. Keep all ledger cutover flags unchanged until the gates in the API docs are satisfied.
2. **Exactly-once rewards/refunds:** legacy Base44 read-create-update operations are not transactional. Parallel completions/redemptions can race; a refund status write and credit are not atomic. A database failure can leave partial Points/XP, stock or notification state. Do not certify these paths for financial production. Connect all callers to the approved transactional ledger, add durable completion/reversal keys and reconcile outbox delivery before enabling it.
3. **Independent partner evidence:** implement credentialed source-specific verifiers and a durable issuance worker. A signed event, elapsed browser heartbeat or admin-submitted claim is not proof of eligible activity. Provision an authenticated registration automation; never restore anonymous service-role access. Partner activation requires separate explicit approval.
4. **Payments:** test approved/cancelled/pending/completed/duplicate/retry payments in PayPal sandbox with app-specific credentials. Add verified, idempotent refund/reversal/chargeback webhooks and reconcile entitlement/payment states. Decide recurring billing, expiry, partial refund and plan replacement policy. Confirm catalog currency: existing checkout defaults to GBP while some store labels use dollar symbols. Do not silently convert prices. Receipt fulfillment lacks an atomic Base44 unique insert; concurrency and recovery need durable reconciliation. Orders created before the new receipt model need a private manual reconciliation procedure; no fake success should be reported.
5. **Protected downloads:** review storage/object access and signed download delivery; catalog file URLs and existing download functions have not been proven to prevent bypass of paid entitlements. Storage/server credentials are required for realistic verification.
6. **Security/deployment:** address the remaining build-tool advisories; verify real Base44 RLS publication, authentication/recovery/OAuth, API CORS/rate limits, cookies, TLS, reverse proxy, monitored queues, backups and restore. No Linux service unit, proxy configuration or live schema was available for verification.

## Exact Base44 staging/publication procedure

These are review/staging instructions. Production publishing requires explicit approval after the blockers are closed.

1. In each existing Base44 app, verify its connected repository and selected development branch. Use the existing app IDs and secret configuration; do not create replacement apps or accounts. If GitHub synchronization would target a live resource rather than a preview, stop before applying it and arrange a staging app connection.
2. Bring the launch-readiness-2026-10-10 branch into the existing Builder preview using the app's GitHub workflow. Review the change list. Never run base44 --remote or sandbox write commands against production; resource writes may auto-sync.
3. In XeroStreams staging, ensure the new PaymentOrder entity and the updated link/challenge/viewing/log/purchase RLS schemas are applied with the backend functions and UI in the same release. Confirm backend service-role writes still succeed and ordinary member writes fail. Do not delete existing entity rows. Payment credentials retain PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET; PAYPAL_ENVIRONMENT=sandbox is for isolated staging only. Its absent value preserves the existing live default, so confirm the environment before any real transaction. For sandbox previews, set PAYPAL_SITE_ORIGIN to that exact HTTPS Base44 preview origin; it is a trusted server setting, never a browser-supplied return URL. Live checkout keeps the xerostreams.com origin.
4. Preserve each partner's existing PERKSPHERE_PARTNER_KEY_ID and PERKSPHERE_PARTNER_HMAC_SECRET. Preserve the Perk Sphere outbound/inbound HMAC secrets and API URLs. Do not rotate, print, activate or copy production partner secrets into a public preview.
5. Run the signed-in staging checklist below. Confirm existing links remain intact by reading them; do not consume production link challenges as a test.
6. Only after a separately approved release, publish through each existing Base44 app's Publish workflow. Do not use CLI deployment for the GitHub-connected app. Apply the API archive change before relying on the new archive UI. Coordinate function/RLS/UI publication so old browser fulfillment cannot remain active with the new checkout.

Local validation for each frontend checkout, using Node 24:

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run check:backend
npm run build
npm audit
```

npm audit currently exits nonzero; do not represent that as a passed gate.

## Exact Linux instructions

The previously reported server path is /home/perksphere/api and port is 3100. These were not reverified live. Do not overwrite that directory or restart a guessed service.

### Safe inventory of the existing server

Run these read-only commands on the Linux server and retain the output privately. Do not send .env contents or credential values.

```bash
cd /home/perksphere/api
pwd
node --version
npm --version
git status --short  # If this is not a Git checkout, record that; do not initialize it blindly.
systemctl list-units --type=service --all --no-pager | grep -Ei 'perk|sphere|node'
curl --fail --silent --show-error http://127.0.0.1:3100/v1/health
```

After identifying the actual unit name, inspect only non-secret service properties:

```bash
PERKSPHERE_SERVICE='the-actual-unit-name.service'
systemctl show "$PERKSPHERE_SERVICE" -p FragmentPath -p User -p WorkingDirectory
```

### Isolated staging checkout and offline checks

The private API repository requires an already authorized GitHub SSH key or credential helper. Do not embed credentials in a command or clone URL.

```bash
mkdir -p /srv/perksphere-staging
cd /srv/perksphere-staging
git clone --single-branch --branch launch-readiness-2026-10-10 git@github.com:xerohab/perk-sphere-api.git api
cd api
git status --short
git rev-parse HEAD
npm ci --ignore-scripts
npm test
node --check server.js
node --check lib/ledger-engine.js
node --check lib/perksphere-weekly-archive-routes.js
node --check scripts/preflight.js
npm audit
```

Use Node 24 for the validated test environment. If this checkout already exists, use git fetch and a reviewed fast-forward; do not run reset --hard or discard local changes.

Install a separately prepared staging environment file (not the production .env). It must reference a dedicated staging/test database and staging Base44 bridge URLs/credentials. Creating the database and applying the full existing schema require server access; the single inventory migration does not create the rest of the platform.

```bash
install -m 600 /secure/staging-api.env /srv/perksphere-staging/api/.env
cd /srv/perksphere-staging/api
npm run preflight
npm run readiness
```

Both commands are read-only. They can fail for missing tables or accounts that have not been migrated. Do not respond to a failure by activating or seeding production accounts. The readiness command checks only a subset of release conditions and cannot authorize a cutover.

Only after preparing a dedicated test database and its full schema/fixtures:

```bash
DB_NAME=test_perksphere PERKSPHERE_TEST_DATABASE=true npm run test:integration
```

The integration suite can write/delete test fixtures. Never point it at a production database. Do not run individual integration files to bypass the guarded runner.

Only with verified staging bridge configuration, start the isolated staging API:

```bash
HOST=127.0.0.1 PORT=3110 node server.js
```

In a second terminal:

```bash
curl --fail --silent --show-error http://127.0.0.1:3110/v1/health
```

The API starts background activity delivery. A production bridge URL in the staging .env would send real traffic; validate isolation before startup.

### Production release after explicit approval

No production rollout is authorized now. Before giving final executable copy/restart commands, verify the actual unit, its working directory, existing uncommitted server changes, database engine/schema, backup location and bridge configuration. Then prepare a pinned immutable release, privately back up code/configuration and database, rehearse restoration, apply only approved additive schema changes, and switch the verified unit to the approved release. Preserve .env, existing links/accounts and all data. Do not git pull over unknown server changes, use rsync --delete, recreate tables, seed balances, import zeroes or activate partners.

Once that specific release and unit are approved, the service operation is:

```bash
sudo systemctl restart "$PERKSPHERE_SERVICE"
systemctl is-active "$PERKSPHERE_SERVICE"
curl --fail --silent --show-error http://127.0.0.1:3100/v1/health
```

The release must be installed and reviewed before this restart. Rollback restores the previous application release and preserved configuration; never restore a stale financial database snapshot over newer transactions without a reviewed reconciliation plan.

## Staging acceptance checklist

- Existing accounts can sign in, recover access, sign out and use OAuth without acquiring staff privileges.
- Both existing partner links remain visible and verified. Member entity writes and arbitrary signed evidence are denied. Unlink remains pending until authoritative revocation.
- Directory CRUD/review, quizzes/questions/grading/history and archive detail work against the same API release. Members cannot view another member's archive.
- Suspended/restricted members, invalid ranks, costs, periods and stock behave consistently in UI and backend.
- Concurrent completions, debits, stock reservations, refunds and delivery retries reconcile exactly once using the chosen transactional authority.
- PayPal sandbox payment, cancellation, capture retry, spoofed capability, changed price, wrong purchaser, pending capture and reversal never grant an unauthorized entitlement or reward.
- Paid downloads remain inaccessible without entitlement; direct catalog URLs cannot bypass that check.
- Queue failures are observable/retryable; backups restore correctly; audit and error logs contain no credentials.

Release acceptance requires documented evidence for every blocker, not merely all green offline checks.

## Verified development commits

The implementation commits below were pushed only to launch-readiness-2026-10-10. This report may have a later documentation-only commit.

| Repository | Implementation commit |
|---|---|
| perk-sphere | e9a7ea98a466c79765a447b6716f3291ee46f80a |
| perk-sphere-api | 64147b379b5edf4f563a3a9a0e44661d01abe3c6 |
| dko-wrestling | 06f0ce3160a26c0eeb44526ecdf611b6f824c60c |
| xero-streams | 2b33ac27f4f29d9e98a17b51f6d62c5e51d6ec62 |

Local verification results are recorded in docs/verification-results.json in each repository. GitHub Actions results are separate evidence; do not assume they passed from local results.

Primary implementation references: [PayPal Orders API](https://developer.paypal.com/api/rest/integration/orders-api/), [PayPal idempotency](https://developer.paypal.com/api/make-api-requests/), [PayPal webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/), [React Router changelog](https://reactrouter.com/start/start/changelog).

GitHub Actions implementation-commit verification: [Perk Sphere](https://github.com/xerohab/perk-sphere/actions/runs/38124018224), [API](https://github.com/xerohab/perk-sphere-api/actions/runs/38124105438), [DKO](https://github.com/xerohab/dko-wrestling/actions/runs/38124182198), and [XeroStreams](https://github.com/xerohab/xero-streams/actions/runs/38124217834) completed successfully. CI does not include a clean full dependency audit or live deployment checks.

## Server verification update — 11 October 2026

The owner ran the API offline suite successfully on Node 22.23.3. Four isolated MariaDB 10.11.18 tests passed at eaba4d66416bd176d70a878dc32e05197634bd66: simultaneous reward replay, last-stock competition, transaction rollback, and simultaneous redemption retry. A duplicate-order gap lock was removed after the first real concurrency run exposed an unexpected rejection. API main was advanced with authorisation to 516d072cd588816650dd8d504765e7e12ef5f2db; the running Linux service still uses its original main commit.

A private production dump restored successfully into a separate, non-networked MariaDB instance with scheduled events disabled. All 29 base tables passed CHECK TABLE; the isolated server stopped. Production was not restored or restarted. This verifies restore viability, not complete financial reconciliation.

Both Linux partner integrations are already active with verification enabled, active possession-verified credentials, and one verified account link each. Base44 UUIDs and key identifiers match; its checklist booleans are stale. Do not reactivate partners, rotate keys, revoke links or equate the stale checklist with Linux state. A new authenticated read-only /partners/status endpoint and getPartnerLinuxStatus admin function display current Linux state without changing stored configuration.

The owner explicitly cancelled the 400-point Base44 redemption; its status is now cancelled, its history retained and no refund was issued. Existing Base44 Points/XP remain unchanged. Linux ledger tables remain empty, redemption tables absent in production, and rollout flags unset. Fresh-start balance reset and coordinated ledger migration have not been executed.

Current offline suites: Perk Sphere 53, Linux API 71, DKO 4, XeroStreams 15; 143 total, plus four isolated MariaDB checks. Payment changes are excluded from the requested same-day release and remain on the XeroStreams development branch. No Base44 publication or Linux production deployment has been performed. Full rewards issuance, independent verifiers, outbox consumption, migration/cutover and production frontend flows remain release gates.
