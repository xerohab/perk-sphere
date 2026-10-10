# Perk Sphere launch-readiness report — 10 October 2026

**Release decision: HOLD. Development changes pass offline checks; the platform is not yet production-ready. No deployment or merge is authorized or performed.**

## Scope and preservation

Inspected the 17 repositories exposed by the connected xerohab GitHub account. Four have confirmed Perk Sphere roles: perk-sphere (Base44 member/admin app), perk-sphere-api (Linux API), dko-wrestling (partner), and xero-streams (second partner and payments). The duplicate perk-sphere link refers to the same repository. Unrelated repositories were not changed. Repository inventory alone cannot prove that an undisclosed component does not exist.

Used launch-readiness-2026-10-10 in all four repositories. Retained the existing Perk Sphere branch; created the other development branches. The API branch starts from the existing work/perksphere-ledger-integration work, preserving its advanced ledger implementation. This is not a merge into main.

No production database, Base44 account, partner link, secret, partner activation state, or running Linux service was accessed or changed. Both verified partner links were preserved by avoiding live writes; their live state has not been independently checked. Existing integration flags and credentials were left unchanged.

## Completed work

### Perk Sphere

- Added the existing Linux balance/history/redemption bridge functions to the launch branch.
- Validated safe integer Points/XP changes, overflow, insufficient balances, reward costs and stock.
- Enforced required redemption rank and active redemption restrictions on the server.
- Added an explicit legacy-writer kill switch for a future coordinated Linux-ledger cutover. It remains unconfigured.
- Fixed admin partner-domain form shape, OAuth Headers usage, report field mapping and task buttons without callbacks.
- Repaired frontend prop/ref/context types across shared UI and pages without disabling the type checker.
- Added six regression tests and CI for tests, lint, typecheck and build.
- Applied compatible dependency updates and removed an unused rich-text dependency.

### Linux API

- Retained prior atomic ledger, inventory redemption, independent-verification interfaces, deterministic reward identities, read bridges, migrations and cutover gates.
- Corrected actor validation, failed-event reward authorization and a redemption transaction test mock.
- Preserved BIGINT database values as strings to avoid silent JavaScript precision loss.
- Removed a live-environment dependency from the unauthenticated HTTP test.
- Separated offline tests from database integration tests. The supported integration runner refuses a database name outside test_ / test- and requires PERKSPHERE_TEST_DATABASE=true.
- Added standard test/start/readiness scripts and extended existing CI to the launch branch.
- The existing ledger implementation is preparation work, not a complete live migration or deployed reward processor.

### DKO Wrestling

- Corrected Base64url signing expressions and an undefined event timestamp.
- Restricted arbitrary partner evidence submissions to administrators.
- Corrected linked-account SDK filter arguments.
- Verified Linux-compatible HMAC signatures and nonce format over 512 generated nonces.
- Fixed user invitation SDK usage, clipboard typo, article author field and server-side storage/location handling.
- Fixed frontend typing/lint issues, applied compatible dependencies and added launch CI.

### XeroStreams

- Restricted arbitrary evidence submission to administrators and required stable event identities for retries.
- Restricted ViewingSession writes to service role and moved trusted handler writes accordingly.
- Validated session identifiers/times; capped heartbeat credit, prevented paused-gap credit and retried unacknowledged milestones deterministically.
- Required a dedicated workflow secret for anonymous registration automation.
- Hardened PayPal amount/currency/method/order-ID validation, callback origin, upstream timeouts and completed-capture checks.
- Corrected React Query invalidation calls, browser storage, OAuth Headers, upload metadata, navigation/card typing and several administrative form defects.
- Added nine security/payment regression tests, compatible dependency updates and launch CI.

## Verification

| Repository | Offline tests | Lint | Frontend typecheck | Build |
|---|---:|---|---|---|
| perk-sphere | 6 passed | Passed | Passed | Passed |
| perk-sphere-api | 57 passed | No configured lint script | Not a typed frontend | No compile step; offline Node tests passed |
| dko-wrestling | 1 passed, 512 signing samples | Passed | Passed | Passed |
| xero-streams | 9 passed | Passed | Passed | Passed |

Total: 73 offline tests passed. Base44 TypeScript function syntax checks passed. Frontend diff whitespace checks passed. Offline tests include mocks/static contracts and do not demonstrate live Base44 permissions or real MariaDB transaction behavior.

Builds warned that VITE_BASE44_APP_ID / app base URL are absent locally. Compilation passed; these builds are not configured runnable production artifacts. CI workflows were committed, but remote Actions results must be checked separately.

API production-dependency audit: zero advisories. Each frontend full dependency audit: nine advisories (five high, four moderate, zero critical). Remaining chains involve Tailwind 3 tooling and React Router 6. Major-version replacements require deliberate migration and regression testing. The audit is not a comprehensive security assessment.

## Blocking work remaining

1. **Independent partner activity verification and processing:** source-specific, server-credentialled DKO/Xero verifiers and trusted reward policies must be connected to a durable processing worker. Signed claims alone remain insufficient to award rewards. Implement/review retries, dead letters and outbox delivery.
2. **Real ledger schema and migration:** obtain deployed schema, confirm all required tables/indexes/account references, rehearse a non-destructive migration on an isolated copy, reconcile every Points/XP balance and historical transaction, and test concurrent credits/debits/redemptions with MariaDB. Inventory SQL alone is not a complete baseline ledger migration.
3. **Frontend cutover:** connect all balance/history/task/redemption callers to the new API, validate authenticated ownership and rank/restriction parity, and coordinate disabling every legacy writer. Current legacy Base44 redemption is still multi-write and not atomic. The kill switch only blocks writes; it does not migrate callers.
4. **Payments:** implement durable merchant order ownership, server-controlled product pricing where applicable, capture idempotency, verified webhooks, refund/chargeback handling and reconciliation. Validate sandbox success/failure/retry flows. Hardened PayPal endpoints alone are not payment launch readiness.
5. **Base44 staging tests:** verify real account/admin/entity access, both existing link flows, registration automation, viewing-session permissions and all critical member/admin journeys with the actual app configuration. Registration workflows must send the new secret header before their corresponding code is released.
6. **Dependency remediation:** migrate/test the remaining vulnerable frontend dependency chains; do not use npm audit fix --force blindly.
7. **Operations:** determine actual Linux service manager, reverse-proxy/TLS configuration, backup/restore procedure, monitoring, log retention, rate-limit behavior and rollback paths. None were verified without server access.

These include unfinished implementation as well as external validation. The full platform completion requested has not been achieved.

## Exact Linux instructions that are safe to run now

Run in an isolated checkout, never the existing production working directory. GitHub authentication must already be configured for the private API repository. Use Node 24.

```bash
mkdir -p "$HOME/perksphere-staging"
git clone --branch launch-readiness-2026-10-10 https://github.com/xerohab/perk-sphere-api.git "$HOME/perksphere-staging/api"
cd "$HOME/perksphere-staging/api"
git rev-parse HEAD
npm ci --ignore-scripts
npm test
npm audit --omit=dev
```

Compare the checkout SHA with the committed SHA listed below. If the directory already exists, inspect its status before updating; do not overwrite it.

For database checks, an administrator must first supply a dedicated MariaDB test database with reviewed schema, isolated synthetic fixtures and credentials that cannot access production. Keep staging.env private (chmod 600), never commit it or copy production secrets. Required database variables are DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD; supply other signing/encryption variables required by the existing tests using test-only values.

```bash
cd "$HOME/perksphere-staging/api"
chmod 600 staging.env
set -a
. ./staging.env
set +a
PERKSPHERE_TEST_DATABASE=true npm run test:integration
npm run readiness
```

DB_NAME must begin test_ or test-. Integration tests can create/update test records; the readiness command is read-only. Do not run individual integration files against production, and do not run SQL migrations yet. Existing initial integration checks failed locally because no MariaDB/schema/test environment was available; they were not subsequently verified.

## Exact Base44 preparation instructions

For each of Perk Sphere, DKO Wrestling and XeroStreams:
1. Create/use an isolated staging app with synthetic accounts. Confirm the repository/app mapping and whether connecting a branch immediately syncs resources before selecting the launch branch. Do not reconnect a production app to it.
2. Select launch-readiness-2026-10-10 only for the staging app and confirm the commit SHA below.
3. Configure the staging app's real VITE_BASE44_APP_ID and app URL; retain existing production credentials and partner identifiers.
4. Run npm ci --ignore-scripts, npm test, npm run lint, npm run typecheck and npm run build in the staging checkout.
5. In XeroStreams staging, configure PERKSPHERE_REGISTRATION_WORKFLOW_SECRET to a new random value of at least 32 characters, and configure the registration automation to send X-PerkSphere-Workflow-Secret with exactly that value. Use the secret manager, not frontend code. Configure PAYPAL_RETURN_ORIGIN to the staging HTTPS origin and use only PayPal sandbox credentials.
6. Test member/admin authentication, linking for both partners, viewing pause/retry/concurrent behavior and payment negative paths. Verify service-only ViewingSession schema behavior in Base44 itself.

No production Base44 Publish action is currently appropriate. No base44 deploy or live sandbox writes were performed.

## Production deployment hold and future sequence

Do not merge main, publish Base44, restart the API, enable partners, run production SQL, or change ledger flags now.

After all blockers pass and you explicitly approve a reviewed release: verify backup/restore, freeze legacy writes, take and reconcile the final account snapshot, apply the reviewed migration, activate migrated ledger accounts, start the reviewed worker/API, switch every frontend caller, then enable the coordinated ledger flags and validate smoke tests. Partner activation needs separate explicit approval.

Keep PERKSPHERE_LEDGER_READ_ENABLED and PERKSPHERE_REDEMPTIONS_ENABLED disabled until their documented gates pass. Set PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE=true only at the approved reconciled cutover.

Exact production restart/migration/rollback commands cannot responsibly be supplied without the actual deployed schema, service unit and migration plan. Provide read-only schema/service information and staging access next; no passwords or tokens should be pasted into chat.

