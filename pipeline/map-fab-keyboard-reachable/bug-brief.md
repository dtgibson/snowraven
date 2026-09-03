# Bug Brief — Map FAB Keyboard Reachable

## What is broken
The map corner FABs are plain `<button>`s with no explicit `tabindex`. WebKit's default tab
mode (Safari with macOS Keyboard navigation off, which WKWebView follows) visits only
explicitly-`tabindex`ed elements, native form controls and `<summary>`, so on the shipped Mac
and iOS apps a keyboard-only user cannot Tab to them at all -- including v1.0.15's fullscreen
toggle, whose only job is to enter fullscreen. Chromium (web, Windows) is unaffected.

## Verified inventory (source-checked, working tree clean at 1.0.15)
Missing `tabIndex` -- the fix list, 4 source sites:
- `frontend/src/components/map/SharePin.tsx:132` share/drop FAB. Serves 5 surfaces (Map
  Explorer My Sightings via portal + the 4 embedded mounts).
- `frontend/src/components/map/MapCornerControls.tsx:113` fullscreen toggle. 4 embedded mounts
  (Species Detail Pins + Heatmap, Named Birds card, Statistics geographic).
- `frontend/src/components/MapExplorer.tsx:3119` centre-share FAB (`sr-map-center-share-btn`).
- `frontend/src/components/MapExplorer.tsx:3180` location FAB (`sr-map-locate-btn`).

Already carry `tabIndex={0}`, no change needed -- **this corrects the ROADMAP item**, which says
the Map Explorer's fullscreen button is "equally unreachable":
- `MapExplorer.tsx:3199` fullscreen toggle, `:3219` Filters pill, `:3053` "Search this area"
  (v0.5.91 precedent), and `SnowMap.tsx:233/265` base-map switcher + Trails.

All are real `<button type="button">` elements. `SharePin`'s `buttonHost === 'corner'` branch is
unreachable at both live call sites (both portal), so the corner wrapper is dead code today.

## Steps to reproduce
1. Open the Mac app (or iOS), macOS System Settings > Keyboard > "Keyboard navigation" OFF (default).
2. Species Detail > Sighting Locations, collapsed. Tab repeatedly from the top of the page.
3. Focus visits the map canvas, the attribution `<summary>`, the three base-map buttons and the
   Trails checkbox, then leaves the map. The share and fullscreen FABs are never reached.
4. Same on Map Explorer for the share and location FABs (its fullscreen and Filters ARE reached).

## Expected behavior
Every map corner FAB is a Tab stop on WebKit as it already is on Chromium, in DOM order --
share, then location, then fullscreen, then Filters -- which is the order `ACCESSIBILITY.md:17`
already publishes. Fullscreen becomes keyboard-operable on Mac and iOS (Escape already exits).

## ACCESSIBILITY.md is a published statement that must stay true
CLAUDE.md / `.claude/rules/ui.md` hold `ACCESSIBILITY.md` to the same liability posture as the
privacy policy. **Correcting the code does NOT make line 11 true, and this is the brief's main
finding.** Line 11 claims "Every button, link, tab, filter pill, toggle, sortable column header,
and the species selector is in the tab order". Measured against the source, on WebKit:
- 50 of 232 `<button>` tags app-wide carry no `tabIndex`; 4 of them are this fix, ~40 more are
  outside it (WeatherBacklog 8, Calendar 6, BirdingStats 5, SharePopup 3, AtlasLayer 2, ...).
- **Sortable column headers -- a category line 11 names outright -- are plain buttons with no
  `tabIndex` in both `BreedingCodeTable.tsx:263,291` and `LifeListTable.tsx:269,289,307`.**
- **Every `<a href>` is skipped too:** `OutboundLink.tsx:39`, `ChecklistLink.tsx:65` and
  `HotspotLink.tsx:67` pass no `tabIndex`, so "every link" is false on both Apple platforms.
- `AtlasLayer.tsx:274,298` -- the "Atlas blocks in view" list, which `ACCESSIBILITY.md:17`
  publishes as the keyboard substitute for pointer-only canvas markers -- is itself unreachable
  there. The Map Explorer's other in-view lists and `CountyLayer` do carry `tabIndex`.

So line 11 **does** need a wording change: it cannot honestly stay app-wide after this run.
`ACCESSIBILITY.md:87` ("No cross-cutting accessibility exceptions are outstanding at this time")
also becomes false and needs the residual WebKit gap recorded -- the Known Exceptions section is
the established home for an honest gap. The user's stated preference (fix the code rather than
qualify the prose) rested on the FABs being the only gap; they are not. Do both: ship the fix
AND make lines 11 and 87 true. Line 17's map-controls sentence becomes true for share, location,
fullscreen and Filters; its "zoom" clause rides maplibre's own injected buttons, which carry no
`tabindex` either (the canvas is a tab stop and maplibre's +/- keyboard handler still works).

## Blast radius
- **Behaviorally inert on Chromium and Gecko.** A `<button>` is already a tab stop at index 0
  and explicit `tabindex="0"` keeps document order, so web, Windows and every shipped test are
  unchanged. The change is additive on WebKit only.
- **The focus trap is unaffected and must not be simplified.** `FOCUSABLE_SELECTOR` in
  `lib/useFocusTrap.ts:55` already matches these by `button`, so its list does not change. The
  fix narrows the gap between the predicted and the real tab order but does NOT license
  reverting the `focusin` containment arm (DECISIONS.md:11 forbids prediction outright).
- **One source comment becomes false.** `lib/useFocusTrap.ts:34-37` asserts in the present tense
  that "The share drop button and the fullscreen toggle carry no explicit tabindex". Re-tense it
  to the measurement it was, without weakening the `focusin` rationale.
- **No test asserts the absence.** Cluster tests assert child `className` and order only
  (`MapExplorerLocateFab.test.tsx:206`, `MapExplorerCenterShareFab.test.tsx:198`,
  `MapExplorerSearchThisArea.test.tsx:1447`, `SharePin.test.tsx:288`) and stay green.
- User-facing fix, so CLAUDE.md's four-file version set applies: `frontend/package.json`,
  `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and `website/index.html` (pill text + `aria-label`
  + footer). Prose sweep: `docs/HELP.md` and `README.md` if either states the keyboard path.

## Decisions touched
- **DECISIONS.md:11 (v1.0.15, focus trap):** not reversed. It records the same WebKit
  measurement and names the base-map buttons' explicit `tabIndex={0}` as the only reason they
  are visited; this fix applies that remedy to the FABs. Historical record, leave as written.
- **DECISIONS.md:371 (v0.5.91, "Search this area"):** the direct precedent -- that keyboard path
  was made unconditional in both engines with an explicit `tabIndex={0}` so it does not depend
  on macOS Full Keyboard Access. Same remedy, extended to the rest of the cluster.

## What done looks like
1. The four sites carry `tabIndex={0}`, and a jsdom guard asserts the literal `tabindex="0"` on
   every corner FAB on both the Map Explorer cluster and an embedded corner row, mutation-checked.
   (Assert the attribute, never a reproduced tab order -- jsdom has none; `useFocusTrap.ts:50`.)
2. On WebKit, Tab reaches share, location and fullscreen on Map Explorer and on an embedded map,
   in the published DOM order, and Enter/Space activates each.
3. `ACCESSIBILITY.md` lines 11 and 87 read true as written against the measured source, with the
   residual non-FAB WebKit gap recorded rather than implied away.
