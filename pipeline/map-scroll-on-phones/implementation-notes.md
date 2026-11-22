# Implementation notes: map-scroll-on-phones

Improve lane, Stage 3 of 7 (The Engineer), built hands-off on 2026-11-21 in this worktree to `design-refinement.md`, `decisions.md` D-01 to D-19 and `change-brief.md` with both addenda. The build's own decisions are D-20 to D-28 in `decisions.md`. No version bump, changelog, tag or ship: this goes out in the combined release with the Family Tree build (D-02).

## PR description

```markdown
## Map scroll on phones

### What this does
On the phone tier (`max-width: 640px`) every map inside a page is the same live map shown as a still: it does not move, so a swipe over it scrolls the page, and a press on it, or the new **Open the map** button under it, opens it in fullscreen, where it pans and zooms. While any map is open the bottom bar is hidden, so Exit (which now carries its word) and the share pin are whole and take their taps. The Weather location picker and the Hotspot Reports map join the pattern, the Map Explorer's page no longer scrolls under its live map at 100% text, and the five dropdown lists keep to the room that is visible under their field. Above 640px the app renders as it did.

### How to test
1. Build and serve (`./start.sh`, or a scratch backend over `frontend/dist`), then open the app in a phone-sized window (390 x 844 or 320 x 568, touch emulation on).
2. Species Detail: choose a species. Swipe over the map: the page moves, the map does not. The zoom, base-map switcher and corner buttons are not drawn; the credits are.
3. Press **Open the map**. The map fills the window, the bottom bar is gone, focus is on **Exit**. Pan, zoom, open a pin's popup, drop a share pin.
4. Press **Exit** (or Escape). The page is where you left it, the map keeps its view and pin, focus is on **Open the map**.
5. Repeat on Statistics (Geographic Stats), a Named Birds card, a Hotspot Reports place and Weather > Plan (in fullscreen a tap drops the pin and the statement reads "Drag the pin to fine-tune. Exit when it is in place.").
6. Map Explorer: at 100% text it fills the window with no page scroll. At 320 x 568 and 125% text or more its map is a still with **Open the map** under it, which opens the tab's own fullscreen.
7. At 320 x 568, open the Hotspot Reports picker, the Life Lists region picker, the Targets county picker, the Targets "Measure distances from" chooser and a species picker with the field low on the page: each list ends above the bar.
8. Widen the window past 640px: no opener, no still, the corner toggle is back, exactly as before.

### Notes for reviewer
- `lib/useMapFullscreen.ts` grows by addition only (D-11): `stillTier`, `still`, `open`, `registerOpener`, `hostClassName`, `MAP_STILL_CLASS`, `FS_OPEN_ATTR`. Nothing was renamed; `className` is still exactly the base class plus the expanded class. The hook reads the tier itself through `./useIsPhone` (admitted to the entry-safe list), sets `data-sr-fs-open` on `<html>` in a layout effect while expanded (counted at module scope), moves focus to Exit on open and back to the opener on a user exit, and restores the page's scroll offset after a user exit.
- The bar is hidden by one rule, `:root[data-sr-fs-open] .sr-navbar { visibility: hidden }`; no script tests a width (D-07).
- Deviations from the spec are D-20 to D-28 in `decisions.md`; the two with the most reach are D-20 (the credits are opened through maplibre's own state, because a closed `<details>` cannot be drawn by CSS) and D-28 (the Map Explorer's floor grows by the opener row while its map is a still).
- Help and ACCESSIBILITY.md carry the spec's sentences, swept at paragraph scope; `lib/mapStillPublishedClaims.test.ts` holds them to the code.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Seeing Map Scroll on Phones locally

1. Open a terminal in the project folder.
2. Build and start the app: `./start.sh` (it builds `frontend/dist` and serves it on port 1620). For live editing instead, run `cd backend && uvicorn main:app --reload --port 1620` in one terminal and `cd frontend && npm run dev` in another.
3. Open http://localhost:1620 (or http://localhost:5173 for the dev server) in Chrome or Safari, open the developer tools and switch on the device toolbar at 390 x 844 (any phone preset). The window has to be 640 px wide or less.
4. Go to **Species Detail** and pick a species with locations. Scroll the page with a swipe that starts on the map: the page moves and the map stays put.
5. Press **Open the map**. The map fills the window and the bottom tab bar disappears. Pan and zoom it, then press **Exit** at the bottom right. You are back where you were on the page.
6. Try the same on **Statistics** (Geographic Stats), an open **Named Birds** card, a place in **Hotspot Reports**, and **Weather** > **Plan** (drop the pin in fullscreen, then Exit: the Latitude and Longitude fields show it).
7. On **Map Explorer**, set Settings > Text size to a larger size at 320 x 568: the map becomes a still with **Open the map** under it.
8. Make the window wider than 640 px: everything is as it was before this change.

## File-by-file change list

The hook, the bar and the still (commit 1):
- `frontend/src/lib/useMapFullscreen.ts`: the additive API; the bar signal (layout effect, module-scope count); focus on open and on a user exit (read back, `preventScroll`); scroll-offset restore after a user exit; the tier through `./useIsPhone`; `open` idempotent.
- `frontend/src/lib/mapStillCopy.ts` (new): every new string (opener label, the two helper lines, Exit, the picker's two statements and page line, the still names).
- `frontend/src/components/ui/FsOpenRow.tsx` (new): the opener row, entry-safe (Button, one lucide glyph); takes the hook or any object of the same three members; `inset` and `noteHidden` options.
- `frontend/src/components/map/MapCornerControls.tsx`: required `share` and `fsOnly`; the `Exit` word while expanded; renders `StillCredits`.
- `frontend/src/components/map/StillCredits.tsx` (new): opens the compact credits while the map is a still (D-20).
- `frontend/src/globals.css`: `.sr-wx-pick-map` (above the panel), `.sr-map-still-body` / `.sr-mx-still-host`, the fs-only row, the exit label, `.sr-map-note`, the opener register (with its hover gate and cancel), `.sr-hsr-map` scoped `:not(.sr-map-fs-panel)`, the lifted 260px species-list cap, the bar rule, the list-fit margin variables; in the phone block the still, the Exit pill, the lifted corner row with its iOS and Android twins, the Map Explorer floor (300px, and the still floor, D-28), the five list caps; the species list's phone rule in its own block (D-22).
- Tests: `lib/useMapFullscreen.test.tsx` (11 phone-tier and above-tier rows), `lib/mapFullscreenPanelCss.test.ts` (a resolved-cascade section, 33 rows), `components/map/MapCornerControls.test.tsx` (3 rows), `lib/mapFullscreenEntrySafe.test.ts` (the hook's new edge, FsOpenRow, the copy, useListFit), `lib/mapFabClusterCss.test.ts` and the older panel row (the one Exit-pill rule admitted), `components/mapCornerTabStops.test.tsx` (props).

The hosts (commit 2):
- `frontend/src/components/SpeciesDetail.tsx`, `BirdingStats.tsx`, `NamedBirdRow.tsx`: `hostClassName`, `role="img"` and the name while still, the press, the inert wrapper, the opener row.
- `frontend/src/components/WeatherForecastPanel.tsx` and `PredictMap.tsx`: the picker becomes a host; the inline size lifted to `.sr-wx-pick-map`; the Exit-only corner row and the top-centre statement inside the map; the page line on the tier is the opener's line.
- `frontend/src/components/hotspotReports/HotspotReport.tsx` and `HotspotReportMap.tsx`: the host owns the box and its name (D-23); the Exit-only corner row.
- `frontend/src/components/MapExplorer.tsx` and `frontend/src/lib/mapPanelChrome.ts`: `panelOnFloor` / `usePanelOnFloor`; the floor-bound still with two boxes (D-21), the opener inside the panel, focus across the round trip; `fullscreenButtonRef` attached (D-25).
- `frontend/src/App.tsx`: the Weather and Hotspot Reports panels wrapped in `MapTabShowingProvider`.
- Tests: `components/mapFullscreenWiring.test.tsx` (two new hosts, the still's wiring), `lib/paletteLocationsRoute.test.ts` (the two hosts and callers), `components/hotspotReports/HotspotReportsTab.test.tsx` (the named box is the host's), `lib/mapPanelChrome.test.ts` (2 rows).

The lists (commit 3):
- `frontend/src/lib/useListFit.ts` (new): the visible-room measurement (D-15, D-24).
- `frontend/src/components/hotspotReports/HotspotReportsPicker.tsx`, `lifeLists/LifeListsRegionPicker.tsx`, `targets/TargetsCountyPicker.tsx`, `targets/TargetsAnchorChooser.tsx`, `SpeciesCombobox.tsx`: the list node as state and one hook call each; the species list's inline `maxHeight` moved to its class.
- Tests: `lib/useListFit.test.tsx` (new, 8 rows).

Docs (commit 4):
- `docs/HELP.md`: "Maps on a phone", the Map Explorer still sentence, the Weather and Hotspot Reports phone sentences, the corner-row and "Where it works" sentences re-scoped (paragraph sweep).
- `ACCESSIBILITY.md`: the phone-tier keyboard route, Escape's landing on a phone, the corner toggle scoped to wider screens, the two phone-only hosts.
- `frontend/src/lib/mapStillPublishedClaims.test.ts` (new) and the two older guards (`hotspotReportsPublishedClaims`, `weatherTidePlanPublishedClaims`) moved to the new sentences.
- `.claude/rules/maps.md` gates `PredictMap*.tsx` and `ui/FsOpenRow*.tsx`; `.claude/rules/ui.md` gates `lib/useListFit*.ts`.
- `pipeline/map-scroll-on-phones/decisions.md` (D-20 to D-28) and this file.

## Verification record

Unit and build gates, from `frontend/`:
- Full `npx vitest run` on the committed tree (`a3603770`): 526 files passed, 5 skipped; 11,663 tests passed, 9 skipped, 0 failed. An earlier full run, at a load average near 7.7 from outside this session, failed one local-only CPU-quotient row, `lifeListsLinearity.test.ts` pass 2R, at 20.001 against a limit of 20; this build touches nothing that row times, it passed in isolation, and it passed in the final clean run above.
- `npm run build` (tsc -b and vite build): passes. `npm run lint` (eslint over the whole tree): 0 problems (one immutability error on the committed tree was fixed in `a3603770`).
- Built CSS against a HEAD build, rule by rule: 6 rules replaced and 40 added, every one of them this build's; the Tailwind utilities layer identical (82 rules in both), so no test or comment word minted a utility.
- `weft-design-lint check frontend/src`: 0 warnings; the notes in touched files are pre-existing (PredictMap's 500ms `flyTo`, recorded at D-19; the global reduced-motion block covers the CSS motion).
- Mutation checks, each restored and hash-verified: in the hook (no bar signal, an uncounted bar, focus moved on a derived collapse, no scroll restore, `open` toggling, the toggle before the opener) and in the stylesheet (the iOS lifted twin dropped, the pill rule before the compact one, `.sr-hsr-map` unscoped, a `visibility: visible` cell under the bar, the still body taking pointers): each turned its row red.

The built app, Playwright 1.62.1 (Chromium 151.0.7922.34, WebKit 26.5), served from a scratch backend (main checkout's interpreter, this worktree's backend code, a scratch copy of the synthetic demo data, no keys), every eBird- and third-party-backed path answered inside the browser. The backend's access log shows 0 requests on any `/map/` or `/checklists/` path. Scripts and output: the session scratchpad's `probe/`.

Embedded surfaces (Species Detail, Statistics, Named Birds, Hotspot Reports, Weather), Chromium and WebKit, 390 x 844 and 320 x 568, 20 of 20 pairs:
- The still: still class, `role="img"` with the spec's name, the wrapper `inert` and `pointer-events: none`, the host `touch-action: manipulation`; zoom, switcher and corner row computed `display: none`; the credits open and inked. Chromium's full accessibility tree exposes the image and the opener and no zoom button or fullscreen toggle.
- A real one-finger swipe on the still (Chromium CDP touch, 100px travel, map's lower half hidden): page moved 85px, map moved 0px, on all five at both sizes. A two-finger spread on the still: map moved 0px, zoom unchanged (the browser pinch-zooms the page, as anywhere on a page). In WebKit, where Playwright cannot synthesize a touch drag, the point under the finger is the still's host, not the canvas.
- A real tap on the opener: expanded; in the first animation frame after the click the root attribute is set, the bar's computed visibility is `hidden` and the panel is up (no frame with the bar over the panel); the bar is not hit at its centre; the bar's region is identical with the bar removed by the probe (0 differing pixels in Chromium; in WebKit the difference equals the same-state noise from tiles still drawing).
- Exit: 80.14 x 44px, inside the window, the word drawn; the share pin 44 x 44px; the corner row stands 34px clear of the open credits at both sizes (the credits read 24px tall, one line).
- A real tap at Exit's centre exits: the same MapLibre instance, the same centre and zoom, `window.scrollY` identical to before opening, focus on the opener, the attribute gone, the bar back, the body unlocked.
- Keyboard: Enter on the opener lands focus on Exit; six Tab presses stay inside the panel; Escape exits with focus on the opener. A tap on the still itself opens it too.
- Weather: in fullscreen a tap drops the pin and the statement changes to "Drag the pin to fine-tune. Exit when it is in place."; the pick made 0 API requests; after Exit the Latitude and Longitude fields show it and the still shows the pin.

Map Explorer, both engines, the four shipped text scales:
- 390 x 844: page scroll range 0 at 100%, 125%, 150% and 200%; live map; the button cluster 76 to 210px clear of the bar.
- 320 x 568: page scroll range 0 at 100% (panel 305px on the 300px floor; it was 35px of scroll at baseline). At 125%, 150% and 200% the panel is on its floor, so the map is a still with the opener inside the panel; the opener opens the tab's own fullscreen (bar not rendered, focus on Exit fullscreen) and Escape returns to the still with focus on the opener. The opener row ends exactly at the panel's bottom after D-28 (it overflowed by 14px and 75px before it).

Dropdown lists, both engines, 390 x 844 and 320 x 568, the field near the top and as low as the page allows: on all five, 0px of the list below the window or under the bar; where the room was short the field was brought to the top first; `overscroll-behavior: contain` on all five; a swipe at the end of each list moved the page 0px (Chromium). The Targets chooser is one scroller (the inner list's own scroll range is 0), 436px at 320 x 568 and 740px at 390 x 844 (it was 465.5px with a second scroller).

Above the tier and at the edge:
- 900 x 800 and 641 x 800, both engines, against a HEAD build of the same data: Species Detail, Statistics, Named Birds, Hotspot Reports and Weather pixel-identical (0 differing pixels; same-build noise 0); the Map Explorer at 900 x 800 pixel-identical too. No opener, no still class, no `inert`; the Hotspot Reports and Weather corner rows exist only as `display: none`.
- 640 vs 641 (both engines): the still, the opener and the bar are present at 640 and all gone at 641, and come back at 640.
- A map opened at 640 and widened to 844 x 390 stays open; Exit there returns focus to the corner toggle.
- Landscape (D-16, evidence only): at 844 x 390 and 667 x 375 every embedded map is HEAD's (live, corner toggle, no bar); Species Detail's 380px map is taller than a 375px window.

## Deviations

D-20 to D-28 in `decisions.md`:
- D-20 the credits opened through maplibre's own state; D-21 one selector per hidden control, two boxes for the Map Explorer still; D-22 the species list's phone rule in its own block; D-23 the Hotspot Reports box moved to its host and scoped; D-24 the list field's scroll margin set by the hook; D-25 the Map Explorer toggle's ref attached; D-26 the Statistics opener under the placeholder; D-27 the conditional credits inset not added; D-28 the Map Explorer's still floor.

## Known limitations

- Not measured here (the Tester's, per the spec): page movement under a real touch in WebKit (the iOS simulator), the on-screen keyboard and `visualViewport` for the lists, safe-area insets in the apps (D-27), the Android back gesture, 200% text and dark theme on every state.
- A pinch on a still zooms the page (the browser's own page zoom, which the app leaves enabled); the map does not move.
- A map that fails to load shows its "Map couldn't load" alert and Retry inside the inert body, so on the phone tier the Retry is reached by opening the map.
- Map Explorer: the still holds a little longer on the way out than on the way in (D-28's floor), in the safe direction.
- The list fit re-measures on `visualViewport` changes only, as designed; a list's content shrinking while open is fine, a page scroll moves it with its field as at HEAD.

## Convention Flags

- A phone-tier rule for a class whose base rule sits AFTER the established 640px block goes in its own 640px block after that base rule, or the base wins on source order (D-22); a resolved-cascade row catches it where a presence check cannot.
- A hide list over library controls is written one class selector per control, never `:is()` over pseudo-only compounds, so the FAB cascade scan can tell what it reaches (D-21).
- A `<details>`-based library control cannot be drawn open by CSS once it is closed; open it through the library's own state (D-20).
- Hosts that reach `useMapFullscreen` put `hostClassName` on the container, the one `.sr-map-still-body` wrapper (inert while still) around the map subtree, and `FsOpenRow` after the container; `mapFullscreenWiring.test.tsx` holds the shape.

## QA round 1 fixes (2026-11-21, hands-off)

The Tester's round 1 returned F-1 to F-4 plus three items for the live look (`qa-report.md`); the orchestrator routed seven. Each was reproduced in the built app on a pre-fix copy of `cb65ccaa` before it was changed, and each new or extended row was seen red on the pre-fix file (the file swapped for `git show HEAD:<path>`, the fixed copy restored and checked by hash). Decisions D-29 to D-33 are in `decisions.md`. Probe scripts and readings: the session scratchpad's `fix/` (the Tester's `qa/` scripts reused unchanged, mine in `fix/p/`).

### What changed, item by item

1. **F-1, the page's place near its end.** `frontend/src/lib/useMapFullscreen.ts`: `placeAtPress` and `recordPlace` (lines 266 to 269) read the offset in the event path, `toggle` when it turns on (line 283) and `open` when not already open (line 294), before the state update; the scroll-lock effect restores that reading (line 343) and spends it when the expansion ends (line 347), falling back to its own reading only for an expansion no press made. Only a user exit restores, as before. Before (Tester's `clamp.mjs`, 390 x 844): Named Birds came back 154px short (Chromium) and 155px (WebKit), Weather 88px; at maximum scroll every surface came back short by its container's height (300, 320, 220, 180 and 200px). After: 0px in 4 of 4 near-end runs (by tap and by Escape) and 40 of 40 maximum-scroll runs (five surfaces, Escape and a tap on Exit, both engines, both sizes); the page still clamps while open and comes back exactly. Rows: `useMapFullscreen.test.tsx`, the restore row extended so the clamp happens at LAYOUT (a layout effect after the hook call, as the engine does it) with the page at its end, Escape added; and a new row for the toggle's press above the tier. Red on the pre-fix hook (2 of 45), and each entry point's record caught by its own row (record removed from `toggle` only: 1 red; from `open` only: 1 red).
2. **F-2, one frame of the bar over the panel in WebKit with reduced motion.** `frontend/src/globals.css` line 8884: `transition-property: none` on `:root[data-sr-fs-open] .sr-navbar`. The global reduced-motion block sets only `transition-duration: 0.001ms !important` on `*`, so the hide was a `visibility` transition at the initial `all`; the new declaration (0,3,0) out-ranks the Android bar's `transition: transform` (0,2,0) and is untouched by the block. Before: 3 of 3 WebKit runs with reduced motion had frame 1 with the panel up and the bar `visible` under a `CSSTransition`. After: 0 of 6 (WebKit, reduce), 0 of 3 in each of WebKit no-preference and Chromium reduce and no-preference. Rows: `mapFullscreenPanelCss.test.ts`, a resolver for the transition longhands that reads the reduced-motion block as a tier, honours `!important`, expands the `transition` shorthand and requires an ancestor's attribute token (`[data-sr-fs-open]`): with the panel open `transition-property` resolves to `none` on the web, iOS and Android bars in both motion settings at both tiers, and two control readings show it reaches the block (`0.001ms !important` on the bar) and sees the case that bit (`all` on the web and iOS bars, `transform` on Android, with no panel open). Red on the pre-fix rule (3 of 65) and on an unkeyed selector (2). `mapStillPublishedClaims.test.ts`'s HELP row matched the rule's whole body; it now reads the `visibility: hidden` declaration it is about. The shared resolver in that file now also requires an ancestor compound's attribute selectors and refuses a pseudo-element subject (`*::before`); every older row stayed green under the stricter reading.
3. **F-3, the Map Explorer's page under a live map with the Android class.** `frontend/src/lib/mapPanelChrome.ts` lines 257 to 268: a MutationObserver on `<html>`'s `style` attribute, where MainActivity.kt writes the insets, re-measures the chrome; disconnected with the ResizeObserver. Before (model, 390 x 844): 56px at 100%, 32px at 125% to 200%; 320 x 568: 56px at 100%, live. After: 32px at every scale at 390 x 844 (the chrome now 317px when the insets land, 231px before), and at 320 x 568 the 100% panel reads as on its floor, so the map is a still. **The remaining 32px is App.tsx's root `min-height: 100dvh` inside a body padded by the top inset** (range 0 in both engines once that min-height is lowered by the inset in the page), outside the brief's mechanism and reaching every tab in both apps: recorded in D-33 with its exact fix, not changed. The web build and the iOS class are unchanged (32 of 32 configurations, both engines). Verified on a model in Chromium and WebKit, not on an Android emulator. Row: `mapPanelChrome.test.ts` (now jsdom for the file), the hook rendered over fixture rects: a style write on `<html>` republishes the chrome from the new geometry, the value is written on `<main>` and never on `<html>`, and nothing re-measures after unmount. Red on the pre-fix module (stayed `231px`) and with the disconnect dropped. `mapPanelChromeCss.test.ts` is untouched and still true: no stylesheet rule changed for F-3.
4. **F-4, the expanded credits in the inset band.** `frontend/src/globals.css` lines 7447 and 7448, in the phone block after the corner row's app twins (D-29, reversing D-27). Before (34px emulated inset, 320 x 568): credits 10px from the edge, 24px in the band. After: 44px from the edge, 0px in the band, on all five embedded hosts in both engines at 100% and 200%; the row clear by 14px (100%) and 22px to 42px (200%) with the credits forced open; no other control intersects them. The Map Explorer's own panel is unchanged, because lifted its credits run under its cluster (34px over all four controls at 100%, 74px over Filters at 200%): a finding for the user (D-30). Row: `mapFullscreenPanelCss.test.ts`, the credits group resolves to each platform's inset inside the expanded panel on the tier, the row's lift carries the same term, and the in-page map, the tier above, the Map Explorer's panel and the web all keep maplibre's `bottom: 0`. Red with the two rules removed (2) and with the Android twin unscoped from the panel (1).
5. **The Weather double tap.** `frontend/src/lib/mapOpeningTap.ts` (new; under `lib/map*.ts`, so `.claude/rules/maps.md` already gates it); `frontend/src/components/WeatherForecastPanel.tsx` lines 244 to 253 (the press recorded from both opening paths), 582 and 596 (the still and the opener go through the host's own open path), 587 (the record handed to the map); `frontend/src/components/PredictMap.tsx` line 54 (the click handler ignores a tap that continues the press). D-31 has the mechanism and the measurements: 8 of 8 configurations dropped a pin on the second tap before; 0 of 16 after, and 16 of 16 deliberate taps did; above the tier a click or double click drops the pin as at HEAD. Rows: `lib/mapOpeningTap.test.ts` (new; both sides of the 500ms window and of the 100px bound, a press before, missing or non-finite, and a keyboard activation recorded as nothing); `mapFullscreenWiring.test.tsx`, the real PredictMap's handler on the fake map (the second tap ignored, a later tap at the same point and an aimed tap elsewhere inside the window both pick, no press means every tap picks); `WeatherForecastPanel.test.tsx`, the real host and the real FsOpenRow hand the map the press from a tap on the opener and on the still and none from a keyboard activation (the PredictMap stub now keeps its last props). Red on the pre-fix `PredictMap.tsx` and, separately, on the pre-fix `WeatherForecastPanel.tsx` (1 each). No fake timers: the window compares the two events' own `timeStamp`s and reads no clock, so its two sides are tested with stamped events.
6. **The escape in `mapStillCopy.ts`.** `frontend/src/lib/mapStillCopy.ts` line 37 now holds `’`, written at byte level by a script that refused unless the literal occurred exactly once; a grep finds no non-ASCII character in the file, or in any file this errand wrote. Row: `mapStillPublishedClaims.test.ts`, the module's whole source (its header's stated contract, comments included) holds no character above U+007E, the escape is in the source, and `STILL_NAMES.named` still renders the typographic apostrophe. Red on the pre-fix file (`[ 'U+2019' ]`).
7. **The Targets chooser with the keyboard up.** Not changed: D-32 records the reading (11.38px past the keyboard's top at 320 x 568 and 200%, in both engines and both orders), why (D-15's 1.5-row floor of a 106px first row binds), what would reverse it and the two exact fix locations.

### Verification record

- Full `npx vitest run` at default parallelism, three times: each run failed one or two load-sensitive rows in modules this errand does not touch (`lifeListsLinearity.test.ts` pass 2R at 20.36 and 21.81 against 20; `exoticProvenance.test.ts`'s linearity ratio at 4.51 against 2.83; `Settings.icloud.test.tsx`'s "the failure line goes once iCloud no longer holds synced files", a `findByText` that timed out), with the load average at 7.7 to 13.4 from the suite's own workers on 8 cores; every one of those files passes alone (20 of 20, 59 of 59, 63 of 63 with the Settings file). At `--maxWorkers=4` (testing.md v1.0.49), twice, the second on the committed tree: 527 files passed, 5 skipped; 11,679 tests passed, 9 skipped, 0 failed (the Tester's round had 11,672 tests: this errand's rows are 15, in 7 files, one of them new, and the 16th is `androidInsetsCss.test.ts`'s generated row for the new `.sr-ios-app` credits rule, which finds its `.sr-android-app` twin).
- `npm run build`: exit 0; `vendor-maplibre` absent from `dist/index.html`. Built CSS against the pre-fix build, rule by rule: 1 rule replaced (the bar rule gains `transition-property: none`) and 2 added (the credits twins), the Tailwind utilities layer identical (82 rules in both), so no comment or test word minted a utility.
- `npm run lint`: exit 0, 0 problems. `weft-design-lint check src/`: no `warn`; its three notes in touched files are PredictMap's 500ms `flyTo` (pre-existing, D-19) and two lines of `mapOpeningTap.ts` naming the 500ms double-tap window, which is a gesture bound, not motion.
- Above 640px against the HEAD build (`7cf126a6`), Map Explorer, Species Detail, Statistics, Named Birds, Weather and Hotspot Reports at WebKit 641 and 1280 and Chromium 900 and 1280: 20 of 24 pixel-identical on the first pass; the other four were session variance (three re-ran at 0px against HEAD, and Species Detail at Chromium 1280 differs from ITSELF by the same 937px in two fresh sessions of the fixed build, the pin-stacking variance the Tester recorded). No opener, still or `inert`, no root attribute, the fs-only rows `display: none`. The first pass read large differences until the two scratch data folders were made identical: the fixed build's copy carried a `map-base-layer.json` of `"topo"` left by an earlier base-map probe.
- Requests: every eBird- and third-party-backed path was answered in the browser by the Tester's stubs; the scratch backends' access logs show 0 requests on `/map/`, `/checklists/`, `/weather/`, `/tide/` and `/nominatim/`. No key was written or read. All servers this errand started were stopped and no Playwright browser was left running.

### Convention Flags

- A page offset kept across a class swap that takes an element out of the flow is recorded in the event path, before the state update; a passive effect reads the offset the engine has already clamped (F-1).
- A double tap that opens a surface is recognised by a window anchored on the opening press's own point and event time, never by `MouseEvent.detail`, which WebKit reports as 1 for the second tap; a keyboard activation (`detail: 0`) opens no window (D-31).
- A measurement that depends on the Android insets also observes `<html>`'s `style` attribute, where MainActivity.kt writes them; observing `<body>`'s border box instead would re-trigger on the measurement's own result (D-33).
