# Partner onboarding and reward readiness

Use one standard connector per partner app. Creating a directory listing is not
the same as provisioning a Linux integration, verifying a credential, activating
it or linking a member. Those are separate steps.

## Existing and new partners

DKO Wrestling and Xero Streams already have verified Linux integrations and one
verified member link each. Preserve their identities, credentials and links.
The Front Row and DKO Entertainment have connector source only; neither has
been newly provisioned or activated by this development work.

Each additional partner needs a distinct UUID, key ID and HMAC secret, plus its
real HTTPS site URL and domain. Store secrets in the partner app's backend secret
settings. Never put signing secrets in browser code, GitHub, screenshots or chat.
Use the standard backend functions and protected link/event entities documented
in each partner repository's `docs/perksphere-integration.md`.

## Sequence

1. Register the partner's correct site/domain in Perk Sphere admin, disabled.
2. Provision a separate pending Linux credential using the existing onboarding
   tooling; do not recycle another partner's key.
3. Configure the existing partner app's connector secrets. Keep its local feature
   flag off while publication and verification are pending.
4. Review and publish connector functions, entities and frontend in that app.
   No new Base44 app is required. Publishing is a production action requiring
   owner approval.
5. Verify domain ownership and credential possession. Enable the Linux partner
   and local connector only after explicit owner approval. A local enabled flag
   alone never proves verification or activates the Linux integration.
6. A signed-in Perk Sphere member obtains a short-lived linking challenge in
   Partner Accounts and pastes it into the partner site's connection panel.
   Linux checks both authenticated identities and records the verified link.

The current consent flow uses this manual challenge. Automated redirects and
fully self-service onboarding are not yet complete. Unlinking must revoke the
authoritative Linux link before removing a local display record.

## Reward adapters

Account linking uses the common connector. Each reward activity additionally
needs independent verification and a server-owned points/XP policy. A signed
partner assertion alone cannot approve a reward.

The three central challenge games share the same daily reward identity across
Perk Sphere and The Front Row. The server measures accepted round intervals;
clients cannot select elapsed time, member identity or reward amounts. Existing
Front Row iframe games and its own gaming currency are not connected to Perk
Sphere points. They need separate verified gameplay adapters.

Registration, video, live-stream and purchase rewards still need their complete
verification/processing pipeline. Games require an active authoritative ledger,
trusted account eligibility, migrations, delivery/read integration and explicit
feature activation. Do not advertise all partner activities as earning points
until their end-to-end checks pass.
