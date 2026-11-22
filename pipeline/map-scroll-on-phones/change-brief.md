# Change Brief: Map Scroll on Phones

Lane: Improve, with a design pass. Saved idea `42b9772c`, confirmed by the user as an Improve. Written hands-off by The Evaluator on 2026-11-21 from this worktree's code; no browser measurement was taken at this stage.

## What is changing

On a phone, no map that sits in a scrolling page competes with the page for a swipe, and no on-map button is cut off or covered while the map can be used. Every map tab gets the same answer the Family Tree build settles for its tree (its D-17): the map is wholly in view whenever it can be panned or zoomed, or it opens full screen on the existing map full-screen pattern (the class swap in `lib/useMapFullscreen.ts`, and the Map Explorer's own `.sr-map-fullscreen-panel`). The Map Explorer is the tab-sized case: on a phone its page does not scroll under a live map. Which form each map takes is The Designer's call, made once as a pattern and applied to all six surfaces below, matching the Family Tree's settled form.

## Why now

The user's report: on phones the page scrolls and the map area scrolls too, so with the page partway down a swipe lands on a half-visible map, and some on-map buttons end up partly off screen and blocked; the maximize button only partly solved it. The same report on the Family Tree mockup produced that run's D-17 (no scroll box that can be scrolled while half off screen on a phone) and D-18 (this build, one combined release).

A suspected shipped defect sits inside the report and is in scope. On a phone the fixed bottom bar (`.sr-navbar`, `z-index: 1200`, rendered after `.sr-shell`) stays rendered while an embedded map is expanded. `App.tsx` drops it only for the Map Explorer's own full screen (`isPhone && !chromeInert`), and `.sr-map-fs-panel` is also at 1200 and earlier in the DOM, so by paint order the bar should sit over the expanded map's bottom edge, where the corner row's exit and share buttons are (`bottom: 20px` / `12px` plus the inset). This is the v1.0.17 "inert does not stop paint" finding in a second place. It is read from the stylesheet and `App.tsx`, not yet measured: confirm it by pixel sampling (not `elementFromPoint`) in WebKit and Chromium at 390x844 before the design is drawn.

## Per-tab inventory (phones, read from the code)

"Phone" here is the established 640px tier (`useIsPhone`, the CSS tier) on the iPhone app (`.sr-ios-app`), the Android app (`.sr-android-app`) and phone browsers on web/Pi. The bottom bar is a nav density TabNav measures, not a width rule. A phone in landscape is wider than 640px and leaves the tier (see flags).

| Tab | Map | In-page size on a phone | One-finger swipe on it | On-map controls at risk | Full screen today |
|---|---|---|---|---|---|
| Map Explorer | the tab's map | `100dvh` less the measured chrome (bar included), floor 340px, 300px in the apps | pans the map (no cooperative gestures) | FAB cluster bottom right, base switcher top, zoom top left; the cluster sits under the bar while the page is scrolled | yes, App-level `mapFullscreen`; bar removed, header and footer inert |
| Species Detail | Sighting Locations, Pins and Heatmap | `.sr-map-container` 300px (380px above the tier) | scrolls the page (cooperative); two fingers still pan and pinch a half-visible map | corner row (share, full screen) bottom right, switcher, zoom | yes, `.sr-map-fs-panel` |
| Statistics | Geographic Stats | `.sr-geo-map` 320px, no phone rule | pans the map (cooperative off, measured at v1.0.15) | corner row, switcher, zoom, county popups | yes, `.sr-map-fs-panel` |
| Named Birds | the open card's map (one at a time) | `.sr-named-map` 220px | scrolls the page (cooperative) | compact corner row, zoom | yes, `.sr-map-fs-panel` |
| Weather | Predict location picker | inline `clamp(180px, 28vw, 280px)`, 180px | pans the map (no cooperative); a tap places the pin, the pin drags | zoom, attribution | no; its size is inline, so a class could not expand it (maps.md trap c) |
| Hotspot Reports | the report's map | `.sr-hsr-map` 200px (232px above the tier) | scrolls the page (cooperative) | zoom only | no, a plain map by design-review decision |

The page scrolls around every map but the Map Explorer's. The Map Explorer's page scrolls only where its floor binds: short and landscape viewports, and small phones at large text (320px at 200% overflows by 24px by design, v0.5.91).

## What will change and what will not

Likely to change: `frontend/src/globals.css` (inside the established 640px tier, each phone height override scoped `:not(.sr-map-fs-panel)`, each `.sr-ios-app` rule with its `.sr-android-app` twin); `lib/useMapFullscreen.ts` (still importing only `react` and `./useFocusTrap`); `components/map/MapCornerControls.tsx`; the hosts `SightingsMap.tsx`, `SpeciesDetail.tsx`, `BirdingStats.tsx`, `NamedBirdRow.tsx`; `PredictMap.tsx` and `WeatherForecastPanel.tsx` (inline size lifted to a class) and `hotspotReports/HotspotReportMap.tsx`, as far as the pattern reaches them; `App.tsx` (the bar while an embedded map is expanded, and any new host wrapped in `MapTabShowingProvider`); possibly `MapExplorer.tsx` and `lib/mapPanelChrome.ts`; `docs/HELP.md` in the same change; `ACCESSIBILITY.md` where a claim changes; tests; `.claude/rules/maps.md` `paths` if a governed file is added.

Will not change: MapLibre, `react-map-gl` and the tile providers (no `PRIVACY_POLICY.md` change), the CSP, `http:allow-fetch`, the backend, the `storage` seam (no new setting or stored state), the tab list and order, and the Family Tree's own files. Full screen stays a class swap, never a portal, a remount or the browser Fullscreen API, and the expanded panel never animates or takes a transform. The page stays the scrollport for every tab (v0.5.91). Layouts above the phone tier stay as they are unless The Designer extends a rule to landscape phones with a recorded reason. No version bump, changelog entry, tag or ship of this build's own (see Coordination). Website, README, App Store and F-Droid copy are untouched unless a held patch is shown to the user.

Out of scope, noted as adjacent: ROADMAP's "a tab switch keeps part of the previous tab's scroll offset" (every tab, one way the page arrives partway down; its own fix); the Map Explorer filter sheet at 320px/200% on short viewports; the full-screen disc over the setup card's Go to Settings button on My Sightings with no backup.

## User-facing impact

On phones only: how the in-page maps answer touch changes on the six surfaces above, and the expanded maps show their exit and share buttons whole. Depending on the form chosen, a pin tapped on an in-page map may first open the map full screen, and a labelled open control may appear beside a map. Desktop, tablet and web above 640px are unchanged. No data, network or settings change.

## Design pass

Needed. The surfaces: the Map Explorer tab, Species Detail's Sighting Locations map in both views, Statistics' Geographic Stats map, the Named Birds card map, the Weather tab's location picker and the Hotspot Reports map, each at the phone tier, collapsed and expanded, on both apps and a phone browser. What should feel better: a swipe on the page always moves the page; a map is live only when all of it is on screen; every on-map button is whole and uncovered whenever it can be pressed; and the maps and the Family Tree read as one pattern. Built to a live look at the built app before the deploy gate (CLAUDE.md, v1.0.29).

## Decisions touched

- **v0.5.4**, Map Explorer full screen is a CSS overlay, not the Fullscreen API: kept and built on.
- **v0.5.84 and v0.5.91**, the map FAB row's fit (4px of slack at 320px/200%) and "withhold a control rather than cram it": any control added to a corner row or the cluster meets them.
- **v0.5.91**, the Map Explorer panel measured by `lib/mapPanelChrome.ts`, the app-shell flex column rejected, the page as every tab's scrollport, and the 340px/300px floor kept deliberately: the floor is modified if the Map Explorer's page must never scroll under a live map on a phone; the scrollport decision is kept.
- **v1.0.15** (map-fullscreen-toggle), one full-screen geometry, a class swap per host, the in-page gesture posture captured on expand and restored on collapse, the Map Explorer and the Weather picker left out of that scope: extended. Statistics' in-page posture (cooperative off) changes if the pattern needs it, and the capture keeps the restore right.
- **v1.0.17**, the phone bar is not rendered over the Map Explorer's full screen because `inert` does not stop paint: extended to the embedded panel if the suspected defect is confirmed.
- **v1.0.20**, `containOutsideFocus` is armed on the condition that makes a surface modal: kept, and it governs any full screen a phone opens by a tap.
- **v1.0.73** (E-09), an expanded map is tied to its tab showing: kept; any new host is wrapped in `App.tsx`.
- **hotspot-reports D-01**, accepted at its D-03 design review, a plain map with no corner controls: touched only if that map gains a full-screen control.
- The Family Tree run's **D-17 and D-18** (its own record, not DECISIONS.md): the shared answer and the combined release.

## Guards likely to pin this

`lib/useMapFullscreen.test.tsx`, `components/mapFullscreenWiring.test.tsx`, `lib/mapFullscreenPanelCss.test.ts`, `lib/mapFullscreenEntrySafe.test.ts`, `lib/entryChunk.test.ts` (maplibre and `MapCornerControls` off the entry chunk, the hook and `useFocusTrap` on it), `lib/paletteLocationsRoute.test.ts` (names the three `useMapFullscreen` callers exactly and fails an unwrapped one, so a new host edits it), `components/map/MapCornerControls.test.tsx`, `components/mapCornerTabStops.test.tsx`, `lib/tabOrderCoverage.test.ts`, `lib/controlRegisters.test.ts`, `lib/mapFabCascade.test.ts`, `lib/mapFabClusterCss.test.ts`, `lib/mapIosFullscreen.test.ts`, `lib/mapPanelChrome.test.ts`, `lib/mapPanelChromeCss.test.ts`, `lib/androidInsetsCss.test.ts`, `lib/safeAreaPerSide.test.ts`, `lib/bottomSurfaceSideInsets.test.ts`, `lib/navCss.test.ts`, `components/TabNav.test.tsx`, `lib/scrollLeakCss.test.ts`, `lib/filterControlSizeCss.test.ts` (reads the first 640px block as the phone tier), `lib/useFocusTrap.test.tsx`, `components/SightingsMap.test.tsx`, `lib/hotspotReportsCss.test.ts`, and the two `WeatherForecastPanel` suites.

## Coordination and release

This build and the Family Tree build go out together in one release, with no rush. Versioning, the changelog, the six-file bump, tags and every platform leg are settled jointly at the combined release, and this run stops at its deploy sign-off. If the in-page maps change visibly on a phone, the combined release retakes any App Store or F-Droid phone picture that draws a map tab (CLAUDE.md, v1.0.74). Device checks are the user's to perform at that release; agents verify in local engines, the iOS simulator and the Android emulator, and Android stays Partial on emulator evidence by standing decision.

## Addendum, 2026-11-21: measured, and one scope addition

`baseline-measurements.md` (Chromium 151 and WebKit 26.5 at 390x844 and 320x568, pictures in `baseline/`) replaces the code reading above wherever the two differ.

- **The suspected defect is confirmed in both engines at both sizes.** The bottom bar is painted over the expanded embedded map on all four mounts (Species Detail Pins and Heatmap, Statistics, Named Birds) and covers the exit and share buttons: 36.5 to 44 px of each 40 to 44 px button. A real tap at the exit button's centre opened the More sheet in 24 of 24 pairs; by touch the only ways out are switching tab or a 7.5 px strip on Statistics at 390. The Map Explorer's own full screen, with the bar removed, exits by tap in 6 of 6.
- **Corrections to the inventory.** The bar is triggered by the `(max-width:640px)` media query (`useIsPhone` in `App.tsx`), not by TabNav's measured density. Its height is 56.5 px, or 68 px when a label wraps. The Map Explorer's button cluster was not found under the bar at either size at 100% text (it clears it by 41 px or more), and its page scrolls only at 320x568, by 35 px. The Hotspot Reports map draws the attribution as well as zoom.
- **The phone form is settled** (Family Tree D-20, this run's D-03): an in-page map is a non-scrolling, inert still with an open control, and it is used full screen.
- **Scope addition, from the user's question on other scroll-within-scroll surfaces (this run's D-06): the in-page dropdown lists.** Hotspot Reports' hotspot picker, Life Lists' region picker, Targets' county picker and its "Measure distances from" popover, and the shared species picker open a list that scrolls inside the scrolling page. At 390x844 with no keyboard none is cut off; at 320x568, 32% to 55% of each list falls below the viewport or under the bar, and the Targets popover (465.5 px tall) runs under the bar even with its trigger at the top of the screen. The on-screen keyboard was not measured and four of the five lists belong to text fields. On the phone tier each list is kept within the space actually visible below (or above) its field and clear of the bar, and the two lists without `overscroll-behavior: contain` get it. The sweep found no other in-page element with its own vertical scroll range (0 across 80 states).

## Addendum, 2026-11-21: what the design changed in this brief

The Designer's pass (`design-refinement.md`, decisions D-07 to D-19) changes the brief in five places. Each replaces the body above where they differ.

- **The Map Explorer's floor moves.** The brief said the 340 px floor is modified "if" needed; it is. On the phone tier the floor is 300 px on every platform (it was 340 px outside the iPhone app), which removes the measured 35 px of page scroll at 320x568, and where the panel still cannot fit the window the map takes the still (D-14). v0.5.91's floor decision is modified to that extent.
- **Two new `useMapFullscreen` hosts.** The Weather location picker and the Hotspot Reports map gain the still, the opener and a full screen on the phone tier (D-12, D-13), so each tab panel is wrapped in `MapTabShowingProvider` in `App.tsx` and `lib/paletteLocationsRoute.test.ts` names both. hotspot-reports D-01 (a plain map) holds above the tier and is narrowed on it.
- **The list work adds a small measuring helper** that listens on `visualViewport` while a list is open (D-15). It adds no setting, no stored state and no request.
- **Two design-system clauses are narrowed to the phone tier** (D-10: the expanded exit carries its word and the Named Birds discs are 44 px while expanded; D-12: the Weather picker's inline size becomes a class with the same values). `pipeline/design-system.md` is extended at the end of the run.
- **The bar answer is settled** (D-07, accepted by the Family Tree session): while any panel is expanded the hook sets one attribute on the root element and one stylesheet rule hides the bar; no script tests a width, and the panel stays at 1200.

## What done looks like

For the dropdown lists: with the on-screen keyboard up, each list stays within the visible area and shows at least one whole row. For the Map Explorer: on the phone tier its page scroll range is 0, or its map is a still.

At 390x844 and 320x568, in WebKit and Chromium, and in the iOS simulator and Android emulator, for each of the six surfaces: a swipe on a partly visible map moves the page, the map pans and zooms only while all of it is on screen or in full screen, and every on-map button reads whole and uncovered by pixel sampling, expanded maps included. Above 640px the build matches HEAD. The full vitest suite and `npm run build` are green, and the user has had a live look at the built app.
