# Activation and account configuration — 16 November 2026

## Manual PayPal requests

Enabled with the owner-selected £100 cumulative cash conversion funding ceiling. The budget is an owner declaration, not independent verification of provider funds. Conversion remains 200 Points per £1; requests are £20 blocks (4,000 Points per block). The live signed member list route returned HTTP 200, minimum 2,000 pence, target 24 hours and automatic_payments=false. No live cash conversion, withdrawal submission or PayPal send was created by these checks.

## Daily task drafts

Published web source: `18cc58fda57b9a234c412ef045ab70614acabaa2`. XeroStreams published the catalog plus its platform-generated package update at `b180a4b040860f723de4ba8e0ce1e6ac497e0835`. No Base44 source editing was used.

The API host timer is enabled for 09:00 Europe/London daily. Defaults: at most two new private drafts/day; alternate 300-second partial-watch and full-episode days; 14-day lookback. The source catalog returned 27 recent items and zero verified durations. Today's full-episode rule selected five candidates; the verified live successful run created two private, zero-reward drafts: True Love and Switch. Both have `bot_review_required=true`, active=false and publicly_visible=false. Missing duration is explicitly unresolved; required_seconds=0 is a blocked draft placeholder, never a completion threshold for an active task.

The initial dispatch was rejected by an over-strict paused-tracking guard before Task.create. Two read-only record queries confirmed zero drafts. The two unused daily dispatch slots were archived with an explicit negative-dispatch reconciliation record under `/var/lib/perksphere-task-bot/reconciled-negative-dispatch-20261116`; original content claims were retained and are never automatically resent. The next run created two different drafts with held=0. Private drafting now leaves destination tracking paused. No earning policy, player binding or worker task registration was enabled.

Validation: PerkSphere 550 tests pass, lint/typecheck/backend syntax/production build pass. XeroStreams has 52 passing tests, backend syntax and build pass; existing unchanged frontend lint/type errors remain. Bot tests cover full duration, no guessed runtime, bounded fixed-host catalog fetch, cache expiry/sanitization, private zero-reward defaults, persistent daily caps, concurrent duplicate dispatch and ambiguous timeout recovery.

## Requested social directory entries

Existing X records: TwoHeadsPodcast, BobbysBreakdown, DKOXero, MrRetrospectGuy. Two Heads' stored username was corrected from a display name with spaces to TwoHeadsPodcast. All four have no canonical provider ID recorded; presence in the directory is not proof of ownership or verified social-task integration. Existing flags were inspected, not newly enabled.

Added active public directory listings:

| Platform | Name | Handle |
|---|---|---|
| YouTube | DKOXero | @DKOXero |
| YouTube | Bobbys Breakdowns | @bobbysbreakdowns |
| YouTube | Acknowledge The Dynasty | @AcknowledgetheDynasty |
| YouTube | The Music Retrospective | @TheMusicRetrospective |
| YouTube | The Wrestling Retrospective | @TheWrestlingRetrospective |
| X | Acknowledge The Dynasty | @atdpodcast23 |

The six new listings have points_eligible=false, xp_eligible=false and tracking_enabled=false. Canonical provider IDs/ownership remain unverified. No rewarded external likes, follows, reposts, subscriptions or YouTube views were configured. Original PerkSphere activities such as quizzes can be rewarded separately; external engagement remains voluntary.
