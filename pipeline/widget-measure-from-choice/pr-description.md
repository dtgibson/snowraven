## Widget measure-from choice

### What this does
Both iOS home-screen widgets gain a **Measure from** setting in Edit Widget:
**My location** (the default, and exactly the shipped behavior) or **Default
Location**, which measures from the Default Location saved in SnowRaven's
Settings on every refresh and never reads location. The "From your default
location" caption now shows whenever a list was measured from the Default
Location, and a tap from such a list lands on Map Explorer searched from the
saved Default Location with no location read, so the map matches the widget.

### How to test
1. Swift: `cd src-tauri/gen/apple && PATH=/tmp/xcshim:$PATH xcodebuild test -project snowraven.xcodeproj -scheme snowraven_widgetsTests -destination 'platform=iOS Simulator,name=iPhone 17' -test-timeouts-enabled YES` with `DEVELOPER_DIR` exported (140 tests; 130 before this change).
2. Vitest: `cd frontend && npx vitest run src/lib/links src/lib/widgetPaths.parity.test.ts src/lib/widgetsPublishedClaims.test.ts src/lib/widgets src/components/MapExplorerWidgetLink.test.tsx`, then the full suite, `npm run typecheck` and `npm run build`.
3. On a device or simulator with the app built: place a Nearby Lifers widget, Edit Widget, confirm Measure from is the second row (Media Targets: third) with My location selected; switch to Default Location and confirm the footer says "From your default location" and the distances are from the saved point; clear the Default Location in Settings and confirm the new sentence; tap a row and confirm Map Explorer searches from the Default Location without asking for location.
4. A widget placed on 1.0.42 should keep measuring from the device after the update (no stored value for the new parameter means its default, My location). Not driven here: it needs a Home Screen.

### Notes for reviewer
- **Two cache areas, not one.** Default Location widgets keep their own
  `widgets/cache-default-location.json` (same shape, bounds, validator and
  writer as `cache.json`). `cache.json` stays My location's, the only file
  Alerts reads, so Alerts' My location cannot take a Default Location cell
  from a chosen-Default-Location widget; that widget's cache is also marked
  `cellSource: default-location`. Request bound: one per 15 minutes per area,
  so at most two on a mixed home screen (HELP states it). A running 429 hold
  in either area stops the other (`otherAreaHold`), because the key is what is
  rate-limited. A 429 in an area with no document yet persists in a hold-only
  document (epoch `fetchedAt`, no records), which never reads as a list, a
  "Last updated" or, to Alerts, a device position (security review L1).
  Reasoning in `decisions.md`.
- **The link marker** is the fixed literal `&from=default`, always last. The
  TS parser strips it with `endsWith` after the alert form and before the cut,
  so the rest of the grammar is unchanged; misplaced or misspelled it is
  rejected whole. A link without it lands exactly as before. Pinned to the
  Swift literal by `widgetPaths.parity.test.ts`; the shared fixture gains a
  `links.fromDefault` family (33 rows) that the Swift builder reproduces byte
  for byte; a structural identity test asserts `parse(x + marker)` equals
  `parse(x)` plus the flag over the edit corpus and every fixture family.
- **Map Explorer** reads `map-defaults` through `readDefaultLocation` (the
  hand-over's shape rule) for a marked link. No usable Default Location, or a
  failed read, falls back to the shipped landing. Without the marker nothing
  new is awaited, so that path is unchanged to the tick.
- **No `project.yml` change, no new Swift file**: every edit is to an existing
  source file, so the committed pbxproj is untouched.
- **Held published copy**: `held-copy.md` (privacy policy and its website twin,
  the LISTING.md privacy-label rationale bullet, a What's New proposal). No
  guard test waits on it.
- **Known limitation:** the previous-build widget check needs a Home Screen
  and was not driven (see How to test, 4).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
