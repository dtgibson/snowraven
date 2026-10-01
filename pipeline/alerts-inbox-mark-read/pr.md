## Alerts inbox: Mark read (alerts-inbox-mark-read, 1.0.43)

### What this does
The iOS Alerts inbox sheet (iPhone sheet, iPad panel) gets a **Mark read** button just before **Clear** in its footer. Pressing it clears every New mark in the open sheet and sets the count on the bell, the iPad sidebar item, the Search row and the Settings Inbox row to zero, without removing any alert. It moves the existing device-local "last viewed" time (`alertsInboxViewedAt`) to the current snapshot's `now`, through the storage seam, so nothing per alert is stored and no new setting is added. It also covers the case where a check lands while the sheet is open: those alerts no longer count as new after the close.

### How to test
1. `cd frontend && npx vitest run src/components/AlertsInboxSheet.test.tsx src/lib/alerts/alertsCopy.test.ts`
2. The `Mark read (alerts-inbox-mark-read)` block covers:
   - a press with New rows: the "New. " name prefix goes from every row at once, `alertsInboxViewedAt` is written with the newer snapshot's `now`, the store's count is 0 before close, and focus is on Close;
   - after close, "last viewed" stays at the Mark read time and does not go back to the opening's time;
   - a row that arrives later shows New again and re-enables the button; a second press announces again (new keyed node);
   - a `now` that `parseViewedAt` refuses is not written, not kept, and not announced.
3. The sheet block also checks that Mark read sits just before Clear in one group, is disabled when the inbox is empty or nothing is New, and is enabled while a row is New.
4. Visual check: the browser preview below, or the iOS simulator.

### Notes for reviewer
- **Host (`lib/alerts/alertsInboxHost.ts`).** `markRead()` validates `snapshot.now` with the same `parseViewedAt` that opening uses, writes the setting through `storage.setSetting`, sets the store's `inboxViewedAt` (every count reads it), updates the open sheet's `viewedAt`, and sets `pendingRef` so the close commits the Mark read time, never the opening's. It returns `false` when it moved nothing (unsupported platform or a refused `now`), so the sheet does not announce something that did not happen. That boolean is the only API addition beyond the design.
- **Sheet (`components/AlertsInboxSheet.tsx`).** In order, a press focuses Close (the button is about to disable itself), calls the host, then sets "Marked read." in an always-mounted `.sr-only` `role="status"` region. The text is a sequence-keyed child (ui.md), cleared after 4 s and on close. The accessible names drop "New. " straight away, and only the visible dot and word (both aria-hidden) keep the pre-press `viewedAt` while they fade via `.sr-alert--read`. The fade ends on their own opacity `transitionend` or a 200 ms fallback. The write and the badge do not wait for the fade. Reduced motion: the global rule collapses the transition.
- **CSS.** `.sr-inbox-actions` (the two buttons as one wrapping, right-aligned group) and `.sr-alert--read` (opacity 160 ms ease-out). No new token.
- **Comments brought up to date** where they said "last viewed" moves only on open or close: the host header, the entry module header, and the store's `inboxViewedAt` doc comment (`alertsState.ts`, comment only).
- **Unchanged:** Swift and Rust, the App Group documents, `alertsController.ts`, `parseViewedAt`, `isNewSince` / `newSinceViewed`, the entry controls, Clear and its dialog ("Clear leaves the timestamp alone" still holds).
- **Release set:** 1.0.43 in `frontend/package.json` (and its lockfile), `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and `website/index.html`'s version pill (text and aria-label) and footer only. The iOS plist is stamped at the TestFlight build. `docs/HELP.md`'s inbox paragraph gains the Mark read sentence. The bell sentence in the same paragraph now says "since you last opened the inbox or pressed Mark read", which keeps it accurate (paragraph-scope sweep).
- **Held for the user's express yes:** the App Store "What's New" line, in `pipeline/alerts-inbox-mark-read/held-whats-new.md`. README, website copy, listing body and privacy policy are not changed.
- **Known limitation (by the model, unchanged):** a row whose `alertedAt` is after the snapshot's `now` (a clock that ran ahead) stays New after Mark read, because `isNewSince` compares against that `now`. Native writes both times from the same clock, so this is not expected in practice.

## Seeing Mark read locally

The inbox exists only in the iPhone and iPad app. The quickest look is the ios-alerts browser preview, which runs the built app as the iPhone build against a faked native layer.

1. Open a terminal in the project folder.
2. Build the frontend: `cd frontend && npm run build`
3. Start the preview server: `python3 ../pipeline/ios-alerts/preview/alerts-preview.py --port 8821`
4. Make it reachable from your own device over the tailnet: `tailscale serve --https=<a fresh port> http://127.0.0.1:8821`
5. Open `https://<this machine's tailnet name>:<that port>/?scenario=configured&bar=0`. The preview sets "last viewed" to a day ago, so the two newest alerts are New.
6. Tap the bell at the top right. The inbox sheet opens with the New rows marked by a green dot and the word New.
7. Tap **Mark read** (just before Clear, at the bottom). The dots and the word New fade out in about a sixth of a second, the bell's badge goes away at once, and Mark read greys out. No alert is removed. Focus moves to the sheet's close button.
8. Close the sheet and open it again. Nothing is marked New, and the badge stays gone.

On a simulator or the TestFlight build it is the same: Settings, Alerts, the Inbox row (or the bell on iPhone, the Alerts inbox item in the iPad sidebar), then Mark read.
