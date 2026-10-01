# ios-alerts simulator and preview evidence (2026-09-30)

Simulators only (iOS 27.0 iPhone 18 Pro, iOS 27.0 iPad Pro 11-inch (M5)); no device was discovered, queried or used.

## How the simulator build was made

`tauri ios build --target aarch64-sim` refuses to run without the App Store signing credentials, and Xcode's "Build Rust Code" phase needs the options server only that command starts. So the simulator app was built by: `npm run build` (the real frontend), `cargo build --lib --target aarch64-apple-ios-sim --features tauri/custom-protocol` (so the frontend is embedded exactly as a `tauri ios build` embeds it), that library placed at `gen/apple/Externals/arm64/debug/libapp.a` (gitignored), then `xcodebuild -scheme snowraven_iOS -sdk iphonesimulator`, ad-hoc signed so the App Group entitlement is embedded, with the one Rust phase no-opped through a PATH shim. For screenshots 02 to 10 ONLY, the built `dist/index.html` carried an evidence-only script that scrolls Settings to the Alerts section, then the status line, then the inbox (Alerts sits far down the tab and the simulator has no scripted scrolling). That script was never in source and `dist` was rebuilt clean afterwards.

The simulator already held the synthetic demo eBird backup (149 species) from earlier work and no eBird key. The app's own settings document was seeded to open on Settings (every tab hidden, `welcomeSeen`).

## Files

| File | What it shows | Seeded vs produced |
|---|---|---|
| `01-first-launch-iphone.png` | The integrated build (alerts plugin registering its BGTask before `UIApplicationMain`, verify-item V2) launches and renders on iOS 27. A screenshot, not a process check (the scene-manifest rule). | Produced |
| `02-off-iphone.png` | OFF: two sentences and the switch, nothing below (FR-02, QA-02). No `alerts/` directory existed in the App Group after launch: nothing is written before the user acts (FR-03). | Produced |
| `03-on-top-iphone.png` | ON: the configuration from the native snapshot (Hourly, quiet hours off, Fixed place). | `alerts/settings.json` seeded `enabled: true` in the validator's exact shape; rendered through the real actor |
| `04-on-status-no-key-iphone.png` | Following the Default Location with its coordinates; the status line names the first missing precondition, "Add your eBird API key", and the launch's foreground check made no request and wrote no `state.json`. | Produced |
| `05-on-inbox-iphone.png` | The inbox: three rows newest first, the three-line layout, "Reported today / yesterday / 3 days ago", alerted times, the bound line. | `alerts/inbox.json` seeded with three rows; the Swift per-row validator admitted them |
| `06-foreground-check-status-iphone.png`, `state-after-foreground-check.json` | A REAL check on the foreground trigger (`didBecomeActive`, alerts on, a check due): one eBird request with a FAKE key the evidence stored in the app's own key document (the production path writes it into the hand-over), eBird answered 401, the actor wrote `lastCheck` = `key-rejected` and `scheduledEarliest` one hour later, and the status line reads "Last checked 3:08 PM, eBird did not accept your key". `state.json` holds no key; the `alerts/` directory holds exactly the three documents (no temp file left). | Produced |
| `07-on-quiet-dark-200pct-iphone.png`, `08-inbox-dark-200pct-iphone.png` | Dark theme at the app's 200% text size: every line wraps, nothing overflows, tokens resolve. | Quiet hours seeded on; text scale seeded 2 |
| `09-on-top-ipad.png`, `10-inbox-ipad.png` | The iPad register (sidebar navigation); with no Default Location on that simulator the place summary is absent and the coordinates empty; the no-key sentence leads. | Same seeds as 03 to 05 |
| `preview-*.png` | The browser preview (`../preview/`), WebKit: configured, quiet hours at 320px / 200%, the fixed-place fallback caption in dark, and the fresh OFF state. | Preview model |

## The inbox revision (after the live look; design-spec 7.0 to 7.5), simulator screenshots 11 to 19

Built the same way, with a different evidence-only script in `dist/index.html` (never in source; `dist` rebuilt clean afterwards): it leaves the top of Settings in view for a few seconds, then scrolls the Alerts card's Inbox row into view, then presses the header bell (iPhone) or the sidebar's Alerts inbox item (iPad) so the sheet opens. Seeds: alerts on, the three-row inbox (alerted about 1, 26 and 70 hours earlier), and the app's own `settings.json` carrying `alertsInboxViewedAt` 30 hours earlier, so two rows are new.

| File | What it shows |
|---|---|
| `11-inbox-bell-iphone.png` | The bell at the trailing edge of the compact header, badge 2, clear of the centered wordmark. |
| `12-inbox-card-row-iphone.png` | The Alerts card ends with the Inbox row: "Inbox", "3 alerts, 2 new", the chevron. No rows inside Settings any more. |
| `13-inbox-sheet-iphone-light.png`, `14-inbox-sheet-iphone-dark.png` | The sheet risen from the bottom over the scrim: handle, title with its count, Close, the two new rows with the dot and "New", the third without, the bound line and Clear above the home indicator. Both themes. |
| `15-inbox-bell-iphone-200pct.png`, `16-inbox-sheet-iphone-200pct.png` | 200% text: the wordmark wraps between its halves rather than running under the bell; the bell and its badge scale together (see the flag below); every sheet line wraps and Clear drops under the bound line. |
| `17-inbox-sidebar-ipad.png`, `18-inbox-card-row-ipad.png`, `19-inbox-panel-ipad.png` | iPad (rail density in portrait): the Alerts inbox item under Search with its count, the card row, and the centered panel register over the scrim. |

Two things these runs found and the build fixed: (1) at 200% the badge's figure overflowed a 16px pill sized in px around a rem figure, so the bell, its glyph, its badge and the count pills are now sized in rem (identical at 100%); (2) on a cold-booted iPad simulator the entry points appeared only after 14 to 24 seconds, because the controller read "last viewed" BEFORE arming the listener and reading the first snapshot; the read now runs in parallel and the first snapshot waits for it at most one second (re-measured cold: the bell is there by the first screenshot).

## Measured in real engines (the preview, both WebKit and Chromium)

40 configurations (320px at 100% and 200%; 390px and 900px at 200%; five scenarios): 0.00px of text ink past the Alerts card and 0px of page horizontal scroll in every one. Guard-the-guard: a planted 80-character unbreakable line was measured at 2,216.5px past the card in both engines, so the probe sees an overflow when there is one. One WebKit-only console notice at 900px ("ResizeObserver loop completed with undelivered notifications") comes from the app shell's existing layout observers reacting to the probe changing the text scale mid-session; the Alerts code uses no ResizeObserver. Interaction: on a fresh install the switch turns on, the configuration block loses `inert`, and the check's poke updates the status line.

## Not captured, and why (stated, not faked)

- **The debugger-triggered BACKGROUND task** (`_simulateLaunchForTaskWithIdentifier`): `lldb -p` against the simulator app hung waiting on the macOS debugger-authorization prompt, which a headless session cannot answer, and left the app stopped until the simulator was restarted. The background handler runs the SAME `runCheck` as the foreground trigger captured in 06; its background-specific rules (no location read, the expiration handler, the discard) are covered by `AlertsEngineTests` against fakes. A cold background launch (verify-item V1) cannot be produced in a simulator at all and stays the user's device check.
- **BGTaskScheduler submission** is unavailable in the simulator, so `state.backgroundRefresh` recorded `denied` from the refused submit; the snapshot reads the live Background App Refresh status instead, which is why the section did not show the "Background App Refresh is off" note there.
- **A notification banner and its tap-through**: producing hits needs a real eBird key over a place with day-old reports (or a scratch host override); neither was used. The landing is covered by `MapExplorerWidgetLink.test.tsx` (show=all centers with every lifer, show=one alone beside Show all, the not-found sentence with the alert's radius) and the Rust park path by the widget-paths parity rows. Banner, tap-through, quiet-hour delivery on a locked phone and real cadence are the user's device checks (QA-30, QA-35, QA-53 to QA-55).
