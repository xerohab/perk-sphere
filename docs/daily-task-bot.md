# Daily content task bot

Initial release: XeroStreams catalog adapter; private drafts only. Other sites and social accounts are not connected. No automated money sending or new reward rate is introduced.

At 09:00 Europe/London a single runner on the API host fetches the fixed public catalog, authenticates a sanitized metadata cache refresh, then reads the saved source controls and scans recent native movies/episodes. Default: alternate partial-watch (300 seconds) and full-episode days; at most two new drafts per day; look back 14 days. Admin → Tasks contains source pause, watch rule, partial duration, daily cap and live preview. Only Super Admins can change source controls.

The catalog exposes sanitized public-page metadata, never playback URLs or member information. Coming-soon, paid, adult, non-HTTPS and YouTube content are excluded. Full-episode duration comes only from an enabled media-probe/provider record whose hash matches the current media URL. Missing duration yields a clearly blocked draft, not a guessed runtime. Source titles are data and are never executed or passed to an LLM.

Drafts have zero Points/XP, are inactive/private, and carry `bot_review_required`. Publication rejects that flag. Automated reward publication is NOT enabled: an operator still needs to verify duration, approve reward rates and destination eligibility, add the XeroStreams player task binding and register the new task with the Linux verification worker. Existing workers accept explicitly registered tasks, so creating a Task record alone does not enable rewards. Do not clear the review flag before those steps are verified.

## Durable dispatch

Run only the installed runner on the API host. Its state is `/var/lib/perksphere-task-bot`, owned by the service account, mode 0700. Each content identity is claimed with exclusive file creation and fsync before the remote create request. A generation key is source + content ID, independent of date, title edits and watch mode. Daily slots are also exclusive and durable. The runner does not automatically redispatch an uncertain request, including after a crash. A timeout therefore may leave a held item instead of a duplicate task.

Inspect held state against `Task.bot_generation_key` and the actual Task record. Never delete claim files or reset the directory to force a retry. State must be backed up and retained across upgrades. Do not install another independent runner with separate state. Existing drafts are not automatically republished, deleted or reset.

Installed units: `perksphere-task-bot.service` and `perksphere-task-bot.timer`. Use `journalctl -u perksphere-task-bot.service` for aggregate scan results; no member credentials or payment data are logged. `--preview` refreshes the metadata cache and reads the plan without writing drafts or claims. The cache expires after 26 hours; Admin previews read this cache. A failed source read leaves tasks unchanged.
