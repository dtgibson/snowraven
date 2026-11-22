# Baseline measurements: map scroll on phones

Measured on 2026-11-21 against the built app at HEAD `7cf126a6` (the shipped 1.0.75 code, `frontend/package.json` 1.0.75), for the design step of `map-scroll-on-phones`. No source file was changed. Every number below was read in a real engine unless its sentence says it was read from the code. Each table was generated from the probe's result files, not typed.

## 1. What the measurements say

**A. The suspected defect is confirmed.** On a phone-width screen the bottom bar is painted over the bottom of every expanded embedded map, and it covers the exit and share buttons. Confirmed by pixel comparison and by rects in Chromium and WebKit, at 390x844 and 320x568, on all four mounts (Species Detail Pins and Heatmap, Statistics, Named Birds).

- The bar covers 100% of both buttons (44 of 44 px, or 40 of 40 px on the Named Birds card) in every web configuration except one. The exception is Statistics at 390x844, where the bar is one text line shorter: 36.5 of 44 px (83%) are covered and a 7.5 px strip of each button shows above the bar. With either app class modelled, that strip shrinks to 1.5 px (96.6% covered).
- A real tap at the centre of the exit button never exits. In 24 of 24 host and configuration pairs it opened the More sheet over the expanded map, because the tap lands on the bar's More cell.
- A real tap at the centre of the share button never drops a pin. In 12 of 24 pairs it landed on another tab's cell, switched tab and collapsed the map; in the other 12 (the Species Detail mounts) it landed on the active tab's own cell and nothing happened.
- The Map Explorer's own full screen does not have the defect: the bar is not in the DOM there and a real tap on its exit button collapses it (6 of 6 configurations).

**B. Baseline of the report.** The four findings that matter most:

1. **Three maps take a one-finger swipe away from the page, including when half off screen.** Statistics, the Weather picker and the Map Explorer run with cooperative gestures off and `touch-action: none` on the canvas. In Chromium, with real touch input, a one-finger vertical swipe that started on the map canvas panned the map and moved the page 0 px in 34 of 35 runs in the main pass and in 48 of 48 runs in a repeat pass; the one exception started 0.9 px from a control and is explained in section 4.4. On Statistics that is a 318 px map in a page that scrolls 21,157 px (390x844).
2. **The other three maps let the page scroll, and stay live to two fingers while half off screen.** Species Detail, the Named Birds card and Hotspot Reports run with cooperative gestures on. One finger moved the page in 36 of 36 runs (and the map 0 px, with the "two fingers" hint shown each time); two fingers panned the map in 36 of 36 runs and a pinch zoomed it in 18 of 18, at 50% visibility as well as 100%.
3. **With a map half off screen, half of its controls are gone.** Lower half hidden: the whole corner row (share and full screen) and the attribution are below the viewport or under the bar on Species Detail, Statistics and Named Birds. Upper half hidden: the zoom buttons and the base-map switcher are above the top edge. The numbers are in section 4.2.
4. **The Map Explorer's page does not scroll at 390x844 and scrolls 35 px at 320x568**, where the panel sits on its 340 px floor. Its button cluster is never under the bar at either size (it clears the bar by 41 px to 76.5 px). A one-finger swipe on its map pans the map and does not move the page, at both ends of the 35 px range.

**C. Dropdown lists.** Five in-page lists scroll inside themselves while the page also scrolls (section 5). At 390x844 the four picker lists fit on screen wherever their field can be placed. At 320x568, with the field as low as its page allows, 32% to 55% of each list is below the viewport or under the bar, and the bar is painted over the list where they meet. The Targets "Measure distances from" popover is the worst case: at 320x568 it runs under the bar even with its trigger at the top of the screen. A sweep of every tab found no other in-page element with a vertical scroll range of its own.

**Where the measurements differ from the change brief:**

- The brief says the Map Explorer's cluster "sits under the bar while the page is scrolled". Not reproduced: 0 px under the bar at both sizes, both engines, all four view modes, at scroll 0 and at max scroll, at 100% text scale. Larger text scales were not measured.
- The brief says the phone bar "is a nav density TabNav measures, not a width rule". Read from `App.tsx` and `lib/useIsPhone.ts`: the phone bar is rendered when the media query `(max-width:640px)` matches and the Map Explorer is not in full screen. The measured density is the sidebar and rail choice above that width. The probe's contexts matched the query and the bar rendered in every run.
- The bar's height is not one number. It is 56.5 px when every label fits on one line and 68 px when a label wraps to two. At 390x844 it measured 68 px on the Species Detail tab only (the active label is bold and wraps); at 320x568 it measured 68 px on every tab measured. This is why the covered share of the buttons differs between Statistics and the other mounts at 390x844.
- The brief lists zoom as the only on-map control of the Hotspot Reports map. The compact attribution is also drawn there (and on the Weather picker).
- Everything else in the brief's inventory was confirmed as written: the in-page map heights (300, 320, 220, 180 and 200 px including borders), the gesture posture of each of the six maps, the corner row's 20 px and 12 px offsets, and the Map Explorer panel being the viewport less the measured chrome with a 340 px floor.

## 2. Method and setup

- **Engines:** Playwright 1.62.1 with its bundled Chromium 151.0.7922.34 and WebKit 26.5, headless, on the developer Mac (macOS 27.2.1). No physical device, simulator, emulator, browser extension or other machine was used.
- **Sizes:** 390x844 at device scale factor 3 and 320x568 at device scale factor 2, with `hasTouch: true` and `isMobile: true` in both engines. Text scale 100%, light theme, portrait.
- **App:** `npm ci` and `npm run build` in this worktree, served by this worktree's backend through the main checkout's interpreter, on loopback ports chosen after checking they were free.
- **Data:** every number in sections 3 to 5 comes from a server pointed (`SR_DATA_DIR`) at a scratch copy of the stored data folder, so page lengths are those of a real backup. Finding A was then repeated against the synthetic demo dataset (`website/tools/gen-demo-data.mjs`, generated into scratch), where the bar and button rects were identical in 20 of 20 host and configuration pairs. **All 20 pictures in `baseline/` were taken on the demo dataset**, so no personal location is in them; their page positions therefore differ from the tables, and their bar and button geometry does not.
- **Keys:** both servers ran with no eBird and no OpenWeather key, and no `.env` was written. The app was in its no-key state, which adds two notices at the top of the Weather tab and one line to several others.
- **Requests answered inside the browser:** every backend path that would call a third party was answered by a Playwright route before it left the browser: `/map/*`, `/checklists/*`, `/weather/*`, `/tide/*`, `/nominatim/*`, `/taxonomy/codes`, `/version/check` and `/media/*`. eBird-backed paths were answered with the backend's own no-key answer (401), the others with an empty well-formed body or a 503. Only `/settings/*` and static files were let through.
- **Request count, read from the backends' own access logs:** the scratch-copy server answered 5,696 requests and the demo server 2,370. One of them was on an eBird-backed path: a single `GET /map/hotspot-region` that escaped while a browser context was being closed (a request in flight when its route was torn down). The backend answered it 401 from its own no-key check, which runs before any outbound call, so **zero requests went to eBird**. The probes then navigated to a blank page before closing, and the demo server's log shows zero such paths.
- **With-key model (section 5, one list only):** the Targets popover's list exists only in the tab's live mode. For that one leg the page was told a key exists by answering `/settings/keys` in the browser with a dummy string, and `/map/county-species` and `/map/county-day-obs` were answered in the browser with made-up species and 16 made-up places. No real key was read, and nothing went to the backend's eBird routes.
- **Reading the map:** the live MapLibre instance was reached from the page through the React tree, so the centre, zoom and handler state were read from the map itself. Runtime posture was read as `cooperativeGestures.isEnabled()` and the computed `touch-action` of the canvas, in both engines.
- **Touch in Chromium:** real touch input through the DevTools protocol (`Input.dispatchTouchEvent`), which runs the browser's own `touch-action` and scrolling. Each gesture travels 54 to 120 px in 12 steps, holds 250 ms before lifting so there is no fling, and starts on a point confirmed to be the canvas. Where the opening view is zoomed out so far that a vertical pan is clamped, the map was first set to zoom 4 and restored afterwards.
- **Touch in WebKit:** Playwright's WebKit cannot synthesize a touch drag. The WebKit columns are untrusted `TouchEvent`s dispatched on the canvas by Playwright. They show what the map does with a touch and whether it cancels the event; they cannot move the page, so **page movement under touch was not measured in WebKit**.
- **Pixel sampling (finding A and the list overlap in C):** three viewport screenshots per case: the surface collapsed, expanded as shipped, and expanded with the bar hidden by the probe (`visibility: hidden` on `.sr-navbar`, set after the as-shipped picture was taken and removed afterwards). A second as-shipped picture gives the noise floor. Pictures were compared at device pixels; a pixel "differs" when any colour channel differs by more than 12 of 255.
- **Scroll states for B:** "whole" centres the map between the top edge and the bar; "lower half hidden" puts the map's midline on the bar's top edge; "upper half hidden" puts it on the top edge; plus scroll 0 and max scroll.
- **Class models for the apps (finding A only):** the web build carries neither app class. Two extra legs added one at runtime, after boot, and asserted it at each reading. `sr-android-app` with `--sr-inset-top: 32px` and `--sr-inset-bottom: 24px` set on `<html>` (the Android rules read these variables, so the model is meaningful; the two values are assumptions, not read from a device). `sr-ios-app` in WebKit, where `env(safe-area-inset-*)` is 0, so this leg shows only what the class changes with zero insets. In both legs the app's JavaScript still believes it is on the web.

## 3. Finding A: the bottom bar over an expanded embedded map

Read from the page in all 24 pairs: the expanded container carries `.sr-map-fs-panel`, is `position: fixed`, fills the viewport and has computed `z-index: 1200`; the bar is `position: fixed` with computed `z-index: 1200`, comes later in the DOM than the panel, and is not inert; `document.body` has `overflow: hidden`.

### 3.1 Rects, overlap, pixels and taps, per button

"Overlap" is the vertical extent of the button's box that lies inside the bar's box (the bar spans the full width). The pixel column counts device pixels inside that overlap that change when the probe hides the bar: if the button were painted over the bar, hiding the bar would change nothing there. The share is below 100% because the bar's surface and the button's disc are both white; what changes is glyph ink, the disc's edge and the map behind. The next column compares the same region between the expanded picture and the collapsed picture, where the bar is drawn over the ordinary page: a match means the bar's own picture is what is drawn there.

| Engine | Size | Variant | Host | Bar rect (top, height) | Button | Button rect (top to bottom, left to right) | Overlap with the bar | Button height left above the bar | Pixels in the overlap that change when the probe hides the bar | Same region, expanded vs collapsed picture | Same-state noise | Real tap at the button centre |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Chromium | 390x844 | web | species-detail | 776, 68 | share pin | 780 to 824, 276 to 320 | 44 of 44 px (100%) | 0 px | 8157 of 17424 (46.81%) | 0 of 17424 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| Chromium | 390x844 | web | species-detail | 776, 68 | exit full screen | 780 to 824, 330 to 374 | 44 of 44 px (100%) | 0 px | 5549 of 17424 (31.85%) | 0 of 17424 differ (0%) | 0 | More sheet opened, map still expanded |
| Chromium | 390x844 | web | species-detail-heatmap | 776, 68 | share pin | 780 to 824, 276 to 320 | 44 of 44 px (100%) | 0 px | 8157 of 17424 (46.81%) | 0 of 17424 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| Chromium | 390x844 | web | species-detail-heatmap | 776, 68 | exit full screen | 780 to 824, 330 to 374 | 44 of 44 px (100%) | 0 px | 5549 of 17424 (31.85%) | 0 of 17424 differ (0%) | 0 | More sheet opened, map still expanded |
| Chromium | 390x844 | web | statistics | 787.5, 56.5 | share pin | 780 to 824, 276 to 320 | 36.5 of 44 px (83%) | 7.5 px | 4268 of 14388 (29.66%) | 40 of 14388 differ (0.28%) | 0 | tab changed to Species Detail, map collapsed |
| Chromium | 390x844 | web | statistics | 787.5, 56.5 | exit full screen | 780 to 824, 330 to 374 | 36.5 of 44 px (83%) | 7.5 px | 4138 of 14388 (28.76%) | 46 of 14388 differ (0.32%) | 0 | More sheet opened, map still expanded |
| Chromium | 390x844 | web | named-birds | 787.5, 56.5 | share pin | 792 to 832, 288 to 328 | 40 of 40 px (100%) | 0 px | 6359 of 14400 (44.16%) | 0 of 14400 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| Chromium | 390x844 | web | named-birds | 787.5, 56.5 | exit full screen | 792 to 832, 338 to 378 | 40 of 40 px (100%) | 0 px | 10673 of 14400 (74.12%) | 0 of 14400 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 390x844 | web | species-detail | 776, 68 | share pin | 780 to 824, 276 to 320 | 44 of 44 px (100%) | 0 px | 8145 of 17424 (46.75%) | 0 of 17424 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| WebKit | 390x844 | web | species-detail | 776, 68 | exit full screen | 780 to 824, 330 to 374 | 44 of 44 px (100%) | 0 px | 5550 of 17424 (31.85%) | 0 of 17424 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 390x844 | web | species-detail-heatmap | 776, 68 | share pin | 780 to 824, 276 to 320 | 44 of 44 px (100%) | 0 px | 7867 of 17424 (45.15%) | 0 of 17424 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| WebKit | 390x844 | web | species-detail-heatmap | 776, 68 | exit full screen | 780 to 824, 330 to 374 | 44 of 44 px (100%) | 0 px | 5550 of 17424 (31.85%) | 0 of 17424 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 390x844 | web | statistics | 787.5, 56.5 | share pin | 780 to 824, 276 to 320 | 36.5 of 44 px (82.9%) | 7.5 px | 3807 of 14388 (26.46%) | 0 of 14388 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| WebKit | 390x844 | web | statistics | 787.5, 56.5 | exit full screen | 780 to 824, 330 to 374 | 36.5 of 44 px (82.9%) | 7.5 px | 4052 of 14388 (28.16%) | 0 of 14388 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 390x844 | web | named-birds | 787.5, 56.5 | share pin | 792 to 832, 288 to 328 | 40 of 40 px (100%) | 0 px | 6356 of 14400 (44.14%) | 0 of 14400 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| WebKit | 390x844 | web | named-birds | 787.5, 56.5 | exit full screen | 792 to 832, 338 to 378 | 40 of 40 px (100%) | 0 px | 10682 of 14400 (74.18%) | 0 of 14400 differ (0%) | 0 | More sheet opened, map still expanded |
| Chromium | 320x568 | web | species-detail | 500, 68 | share pin | 504 to 548, 206 to 250 | 44 of 44 px (100%) | 0 px | 5604 of 7744 (72.37%) | 0 of 7744 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| Chromium | 320x568 | web | species-detail | 500, 68 | exit full screen | 504 to 548, 260 to 304 | 44 of 44 px (100%) | 0 px | 2438 of 7744 (31.48%) | 0 of 7744 differ (0%) | 0 | More sheet opened, map still expanded |
| Chromium | 320x568 | web | species-detail-heatmap | 500, 68 | share pin | 504 to 548, 206 to 250 | 44 of 44 px (100%) | 0 px | 5604 of 7744 (72.37%) | 0 of 7744 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| Chromium | 320x568 | web | species-detail-heatmap | 500, 68 | exit full screen | 504 to 548, 260 to 304 | 44 of 44 px (100%) | 0 px | 2438 of 7744 (31.48%) | 0 of 7744 differ (0%) | 0 | More sheet opened, map still expanded |
| Chromium | 320x568 | web | statistics | 500, 68 | share pin | 504 to 548, 206 to 250 | 44 of 44 px (100%) | 0 px | 3069 of 7744 (39.63%) | 0 of 7744 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| Chromium | 320x568 | web | statistics | 500, 68 | exit full screen | 504 to 548, 260 to 304 | 44 of 44 px (100%) | 0 px | 2436 of 7744 (31.46%) | 0 of 7744 differ (0%) | 0 | More sheet opened, map still expanded |
| Chromium | 320x568 | web | named-birds | 500, 68 | share pin | 516 to 556, 218 to 258 | 40 of 40 px (100%) | 0 px | 2583 of 6400 (40.36%) | 0 of 6400 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| Chromium | 320x568 | web | named-birds | 500, 68 | exit full screen | 516 to 556, 268 to 308 | 40 of 40 px (100%) | 0 px | 4602 of 6400 (71.91%) | 0 of 6400 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 320x568 | web | species-detail | 500, 68 | share pin | 504 to 548, 206 to 250 | 44 of 44 px (100%) | 0 px | 5570 of 7744 (71.93%) | 0 of 7744 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| WebKit | 320x568 | web | species-detail | 500, 68 | exit full screen | 504 to 548, 260 to 304 | 44 of 44 px (100%) | 0 px | 2396 of 7744 (30.94%) | 0 of 7744 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 320x568 | web | species-detail-heatmap | 500, 68 | share pin | 504 to 548, 206 to 250 | 44 of 44 px (100%) | 0 px | 5292 of 7744 (68.34%) | 0 of 7744 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| WebKit | 320x568 | web | species-detail-heatmap | 500, 68 | exit full screen | 504 to 548, 260 to 304 | 44 of 44 px (100%) | 0 px | 2396 of 7744 (30.94%) | 0 of 7744 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 320x568 | web | statistics | 500, 68 | share pin | 504 to 548, 206 to 250 | 44 of 44 px (100%) | 0 px | 2598 of 7744 (33.55%) | 0 of 7744 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| WebKit | 320x568 | web | statistics | 500, 68 | exit full screen | 504 to 548, 260 to 304 | 44 of 44 px (100%) | 0 px | 2396 of 7744 (30.94%) | 0 of 7744 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 320x568 | web | named-birds | 500, 68 | share pin | 516 to 556, 218 to 258 | 40 of 40 px (100%) | 0 px | 2512 of 6400 (39.25%) | 0 of 6400 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| WebKit | 320x568 | web | named-birds | 500, 68 | exit full screen | 516 to 556, 268 to 308 | 40 of 40 px (100%) | 0 px | 4596 of 6400 (71.81%) | 0 of 6400 differ (0%) | 0 | More sheet opened, map still expanded |
| Chromium | 390x844 | android-model | species-detail | 746, 98 | share pin | 756 to 800, 276 to 320 | 44 of 44 px (100%) | 0 px | 7999 of 17424 (45.91%) | 0 of 17424 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| Chromium | 390x844 | android-model | species-detail | 746, 98 | exit full screen | 756 to 800, 330 to 374 | 44 of 44 px (100%) | 0 px | 6354 of 17424 (36.47%) | 0 of 17424 differ (0%) | 0 | More sheet opened, map still expanded |
| Chromium | 390x844 | android-model | species-detail-heatmap | 746, 98 | share pin | 756 to 800, 276 to 320 | 44 of 44 px (100%) | 0 px | 7999 of 17424 (45.91%) | 0 of 17424 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| Chromium | 390x844 | android-model | species-detail-heatmap | 746, 98 | exit full screen | 756 to 800, 330 to 374 | 44 of 44 px (100%) | 0 px | 6354 of 17424 (36.47%) | 0 of 17424 differ (0%) | 0 | More sheet opened, map still expanded |
| Chromium | 390x844 | android-model | statistics | 757.5, 86.5 | share pin | 756 to 800, 276 to 320 | 42.5 of 44 px (96.6%) | 1.5 px | 5438 of 16764 (32.44%) | 96 of 16764 differ (0.57%) | 0 | tab changed to Species Detail, map collapsed |
| Chromium | 390x844 | android-model | statistics | 757.5, 86.5 | exit full screen | 756 to 800, 330 to 374 | 42.5 of 44 px (96.6%) | 1.5 px | 5208 of 16764 (31.07%) | 96 of 16764 differ (0.57%) | 0 | More sheet opened, map still expanded |
| Chromium | 390x844 | android-model | named-birds | 757.5, 86.5 | share pin | 768 to 808, 288 to 328 | 40 of 40 px (100%) | 0 px | 6769 of 14400 (47.01%) | 0 of 14400 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| Chromium | 390x844 | android-model | named-birds | 757.5, 86.5 | exit full screen | 768 to 808, 338 to 378 | 40 of 40 px (100%) | 0 px | 10195 of 14400 (70.8%) | 0 of 14400 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 390x844 | ios-class | species-detail | 770, 74 | share pin | 780 to 824, 276 to 320 | 44 of 44 px (100%) | 0 px | 7868 of 17424 (45.16%) | 0 of 17424 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| WebKit | 390x844 | ios-class | species-detail | 770, 74 | exit full screen | 780 to 824, 330 to 374 | 44 of 44 px (100%) | 0 px | 6195 of 17424 (35.55%) | 0 of 17424 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 390x844 | ios-class | species-detail-heatmap | 770, 74 | share pin | 780 to 824, 276 to 320 | 44 of 44 px (100%) | 0 px | 7595 of 17424 (43.59%) | 0 of 17424 differ (0%) | 0 | nothing changed (landed on the active tab cell) |
| WebKit | 390x844 | ios-class | species-detail-heatmap | 770, 74 | exit full screen | 780 to 824, 330 to 374 | 44 of 44 px (100%) | 0 px | 6195 of 17424 (35.55%) | 0 of 17424 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 390x844 | ios-class | statistics | 781.5, 62.5 | share pin | 780 to 824, 276 to 320 | 42.5 of 44 px (96.6%) | 1.5 px | 4841 of 16764 (28.88%) | 0 of 16764 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| WebKit | 390x844 | ios-class | statistics | 781.5, 62.5 | exit full screen | 780 to 824, 330 to 374 | 42.5 of 44 px (96.6%) | 1.5 px | 5018 of 16764 (29.93%) | 0 of 16764 differ (0%) | 0 | More sheet opened, map still expanded |
| WebKit | 390x844 | ios-class | named-birds | 781.5, 62.5 | share pin | 792 to 832, 288 to 328 | 40 of 40 px (100%) | 0 px | 6310 of 14400 (43.82%) | 0 of 14400 differ (0%) | 0 | tab changed to Species Detail, map collapsed |
| WebKit | 390x844 | ios-class | named-birds | 781.5, 62.5 | exit full screen | 792 to 832, 338 to 378 | 40 of 40 px (100%) | 0 px | 10129 of 14400 (70.34%) | 0 of 14400 differ (0%) | 0 | More sheet opened, map still expanded |

Across the 48 button readings above: the overlap region changes by 26.5% to 74.2% of its pixels when the bar is hidden, matches the collapsed picture to within 0.57%, and has a noise floor of 0 px.

### 3.2 The bar's own region, the attribution, and the ways out

| Engine | Size | Variant | Host | Bar region: expanded vs collapsed, differing px | Bar region: expanded vs bar hidden, differing px | First picture row the bar changes (CSS y) | Attribution overlap with the bar | Exit in the strip above the bar | Escape collapses |
|---|---|---|---|---|---|---|---|---|---|
| Chromium | 390x844 | web | species-detail | 0 of 238680 (0%) | 171803 of 238680 (71.98%) | 774.67 | 24 of 24 px | no strip | yes |
| Chromium | 390x844 | web | species-detail-heatmap | 0 of 238680 (0%) | 171803 of 238680 (71.98%) | 774.67 | 24 of 24 px | no strip | yes |
| Chromium | 390x844 | web | statistics | 992 of 197730 (0.5%) | 137724 of 197730 (69.65%) | 786.33 | 24 of 24 px | tap at y 783.8 collapsed the map | yes |
| Chromium | 390x844 | web | named-birds | 714 of 197730 (0.36%) | 133105 of 197730 (67.32%) | 783 | 24 of 24 px | no strip | yes |
| WebKit | 390x844 | web | species-detail | 0 of 238680 (0%) | 171655 of 238680 (71.92%) | 775 | 24 of 24 px | no strip | yes |
| WebKit | 390x844 | web | species-detail-heatmap | 0 of 238680 (0%) | 170631 of 238680 (71.49%) | 775 | 24 of 24 px | no strip | yes |
| WebKit | 390x844 | web | statistics | 0 of 197730 (0%) | 136666 of 197730 (69.12%) | 786.33 | 24 of 24 px | tap at y 783.7 collapsed the map | yes |
| WebKit | 390x844 | web | named-birds | 0 of 197730 (0%) | 132772 of 197730 (67.15%) | 782.67 | 24 of 24 px | no strip | yes |
| Chromium | 320x568 | web | species-detail | 0 of 87040 (0%) | 49813 of 87040 (57.23%) | 499 | 44 of 44 px | no strip | yes |
| Chromium | 320x568 | web | species-detail-heatmap | 0 of 87040 (0%) | 49813 of 87040 (57.23%) | 499 | 44 of 44 px | no strip | yes |
| Chromium | 320x568 | web | statistics | 0 of 87040 (0%) | 49981 of 87040 (57.42%) | 498.5 | 44 of 44 px | no strip | yes |
| Chromium | 320x568 | web | named-birds | 0 of 87040 (0%) | 48380 of 87040 (55.58%) | 495 | 44 of 44 px | no strip | yes |
| WebKit | 320x568 | web | species-detail | 0 of 87040 (0%) | 49572 of 87040 (56.95%) | 499 | 44 of 44 px | no strip | yes |
| WebKit | 320x568 | web | species-detail-heatmap | 0 of 87040 (0%) | 48715 of 87040 (55.97%) | 499 | 44 of 44 px | no strip | yes |
| WebKit | 320x568 | web | statistics | 0 of 87040 (0%) | 48728 of 87040 (55.98%) | 498.5 | 44 of 44 px | no strip | yes |
| WebKit | 320x568 | web | named-birds | 0 of 87040 (0%) | 46380 of 87040 (53.29%) | 495 | 44 of 44 px | no strip | yes |
| Chromium | 390x844 | android-model | species-detail | 0 of 343980 (0%) | 266504 of 343980 (77.48%) | 744.67 | 24 of 24 px | no strip | yes |
| Chromium | 390x844 | android-model | species-detail-heatmap | 0 of 343980 (0%) | 266504 of 343980 (77.48%) | 744.67 | 24 of 24 px | no strip | yes |
| Chromium | 390x844 | android-model | statistics | 1089 of 303030 (0.36%) | 222988 of 303030 (73.59%) | 756.67 | 24 of 24 px | no strip | yes |
| Chromium | 390x844 | android-model | named-birds | 990 of 303030 (0.33%) | 215872 of 303030 (71.24%) | 753 | 24 of 24 px | no strip | yes |
| WebKit | 390x844 | ios-class | species-detail | 0 of 259740 (0%) | 192939 of 259740 (74.28%) | 768.67 | 24 of 24 px | no strip | yes |
| WebKit | 390x844 | ios-class | species-detail-heatmap | 0 of 259740 (0%) | 191956 of 259740 (73.9%) | 768.67 | 24 of 24 px | no strip | yes |
| WebKit | 390x844 | ios-class | statistics | 0 of 218790 (0%) | 149531 of 218790 (68.34%) | 780.67 | 24 of 24 px | no strip | yes |
| WebKit | 390x844 | ios-class | named-birds | 0 of 218790 (0%) | 146493 of 218790 (66.96%) | 776.67 | 24 of 24 px | no strip | yes |

- The nonzero "expanded vs collapsed" readings (0.33% to 0.5%, Chromium only) are each about one device-pixel row of the bar's width, at the bar's top edge.
- The bar changes the picture from 0.8 to 5 px above its box (its border and shadow, which reach furthest over the Named Birds card's street-level map). Above the bar the as-shipped and bar-hidden pictures match: 0% of pixels differ in Chromium and at most 0.14% in WebKit.
- The compact attribution is also under the bar: 24 of 24 px at 390x844 and, where it is still open on two lines at 320x568, 44 of 44 px.
- Escape collapses the map in 24 of 24 pairs. A phone has no Escape key.
- A tap in the 7.5 px strip above the bar on Statistics at 390x844 does collapse the map (both engines). No other pair has a strip.
- In practice the touch ways out of an expanded map on a phone are: switching to another tab on the bar (the map collapses because its expanded state is tied to its tab showing; measured as the result of the share tap on Statistics and Named Birds), and that strip.

### 3.3 Sampled pixels at each button's centre

One point per button, read from the three pictures (the web legs; 24 rows). On 24 of 24 rows the as-shipped colour equals the collapsed colour, which is the bar's picture at that point. On 22 of 24 it differs from the bar-hidden colour, so the button's own pixel is not what is shown; the other 2 are points where the bar's surface and the button's disc are both white.

| Engine | Size | Host | Button | Sample point (CSS x, y) | Expanded, as shipped (RGB) | Expanded, bar hidden by the probe (RGB) | Collapsed, same screen point (RGB) |
|---|---|---|---|---|---|---|---|
| Chromium | 390x844 | species-detail | share pin | 298, 802 | 255, 255, 255 | 110, 111, 114 | 255, 255, 255 |
| Chromium | 390x844 | species-detail | exit full screen | 352, 802 | 107, 107, 116 | 255, 255, 255 | 107, 107, 116 |
| Chromium | 390x844 | statistics | share pin | 298, 802 | 255, 255, 255 | 110, 111, 114 | 255, 255, 255 |
| Chromium | 390x844 | statistics | exit full screen | 352, 802 | 255, 255, 255 | 255, 255, 255 | 255, 255, 255 |
| Chromium | 390x844 | named-birds | share pin | 308, 812 | 39, 116, 72 | 176, 177, 179 | 39, 116, 72 |
| Chromium | 390x844 | named-birds | exit full screen | 358, 812 | 232, 245, 238 | 255, 255, 255 | 232, 245, 238 |
| Chromium | 320x568 | species-detail | share pin | 228, 526 | 39, 116, 72 | 68, 70, 74 | 39, 116, 72 |
| Chromium | 320x568 | species-detail | exit full screen | 282, 526 | 107, 107, 116 | 255, 255, 255 | 107, 107, 116 |
| Chromium | 320x568 | statistics | share pin | 228, 526 | 107, 107, 116 | 68, 70, 74 | 107, 107, 116 |
| Chromium | 320x568 | statistics | exit full screen | 282, 526 | 107, 107, 116 | 255, 255, 255 | 107, 107, 116 |
| Chromium | 320x568 | named-birds | share pin | 238, 536 | 255, 255, 255 | 103, 104, 108 | 255, 255, 255 |
| Chromium | 320x568 | named-birds | exit full screen | 288, 536 | 232, 245, 238 | 255, 255, 255 | 232, 245, 238 |
| WebKit | 390x844 | species-detail | share pin | 298, 802 | 255, 255, 255 | 15, 17, 23 | 255, 255, 255 |
| WebKit | 390x844 | species-detail | exit full screen | 352, 802 | 107, 107, 116 | 255, 255, 255 | 107, 107, 116 |
| WebKit | 390x844 | statistics | share pin | 298, 802 | 244, 244, 245 | 15, 17, 23 | 244, 244, 245 |
| WebKit | 390x844 | statistics | exit full screen | 352, 802 | 255, 255, 255 | 255, 255, 255 | 255, 255, 255 |
| WebKit | 390x844 | named-birds | share pin | 308, 812 | 39, 116, 72 | 15, 17, 23 | 39, 116, 72 |
| WebKit | 390x844 | named-birds | exit full screen | 358, 812 | 232, 245, 238 | 255, 255, 255 | 232, 245, 238 |
| WebKit | 320x568 | species-detail | share pin | 228, 526 | 39, 116, 72 | 15, 17, 23 | 39, 116, 72 |
| WebKit | 320x568 | species-detail | exit full screen | 282, 526 | 107, 107, 116 | 255, 255, 255 | 107, 107, 116 |
| WebKit | 320x568 | statistics | share pin | 228, 526 | 107, 107, 116 | 15, 17, 23 | 107, 107, 116 |
| WebKit | 320x568 | statistics | exit full screen | 282, 526 | 107, 107, 116 | 255, 255, 255 | 107, 107, 116 |
| WebKit | 320x568 | named-birds | share pin | 238, 536 | 244, 244, 245 | 15, 17, 23 | 244, 244, 245 |
| WebKit | 320x568 | named-birds | exit full screen | 288, 536 | 232, 245, 238 | 255, 255, 255 | 232, 245, 238 |

### 3.4 The comparison: the Map Explorer's own full screen

- chromium 390x844: bar in the DOM false; panel 390 x 844; cluster buttons 780 to 824 (viewport height 844); real tap on exit: collapsed; hit at exit centre: svg.lucide.lucide-minimize2 in button.sr-map-fab.sr-map-fab--std[Exit fullscreen]
- webkit 390x844: bar in the DOM false; panel 390 x 844; cluster buttons 780 to 824 (viewport height 844); real tap on exit: collapsed; hit at exit centre: svg.lucide.lucide-minimize2 in button.sr-map-fab.sr-map-fab--std[Exit fullscreen]
- chromium 320x568: bar in the DOM false; panel 320 x 568; cluster buttons 504 to 548 (viewport height 568); real tap on exit: collapsed; hit at exit centre: svg.lucide.lucide-minimize2 in button.sr-map-fab.sr-map-fab--std[Exit fullscreen]
- webkit 320x568: bar in the DOM false; panel 320 x 568; cluster buttons 504 to 548 (viewport height 568); real tap on exit: collapsed; hit at exit centre: svg.lucide.lucide-minimize2 in button.sr-map-fab.sr-map-fab--std[Exit fullscreen]
- chromium 390x844-android-model: bar in the DOM false; panel 390 x 844; cluster buttons 756 to 800 (viewport height 844); real tap on exit: collapsed; hit at exit centre: svg.lucide.lucide-minimize2 in button.sr-map-fab.sr-map-fab--std[Exit fullscreen]
- webkit 390x844-ios-class: bar in the DOM false; panel 390 x 844; cluster buttons 780 to 824 (viewport height 844); real tap on exit: collapsed; hit at exit centre: svg.lucide.lucide-minimize2 in button.sr-map-fab.sr-map-fab--std[Exit fullscreen]

### 3.5 Pictures

- `baseline/A01-webkit-390x844-species-detail-expanded-bar-over-corner-row.png` and `A02-...-bar-hidden-by-probe.png`: the same expanded map as shipped and with the bar hidden by the probe, which is where the two buttons and the attribution are.
- `baseline/A03-chromium-390x844-statistics-expanded-bar-over-corner-row.png` and `A04-...-bar-hidden-by-probe.png`: the one case with a visible strip; the tops of the two discs show above the bar.
- `baseline/A05-webkit-390x844-named-birds-expanded-bar-over-corner-row.png`: the compact row, fully covered.
- `baseline/A06-chromium-320x568-species-detail-expanded-bar-over-corner-row.png` and `baseline/A07-webkit-320x568-statistics-expanded-bar-over-corner-row.png`: 320x568, fully covered in both.
- `baseline/A08-webkit-390x844-map-explorer-own-full-screen-bar-removed.png`: the Map Explorer's full screen, no bar, cluster whole.

## 4. Finding B: the six surfaces in the page

### 4.1 Where each map sits and how far its page scrolls

The page (the document) is the only scroller on every tab. The bar is the only fixed or sticky element on screen on all six surfaces; the header scrolls away with the page. The Weather figures are for the no-key state and the Species Detail figures for one species (Common Raven, 106 pins).

| Surface | Size | Engine | Map box (w x h) | Map top in the document | Page scroll range | Bottom bar (top, height) | Largest share of the map that fits between the top edge and the bar |
|---|---|---|---|---|---|---|---|
| Map Explorer | 390x844 | Chromium | 390 x 513 | 218 | 0 | 787.5, 56.5 | 100% at scrollY 0 |
| Map Explorer | 390x844 | WebKit | 390 x 511.7 | 219.3 | 0 | 787.5, 56.5 | 100% at scrollY 0 |
| Map Explorer | 320x568 | Chromium | 320 x 240 | 239 | 35 | 500, 68 | 100% at scrollY 35 |
| Map Explorer | 320x568 | WebKit | 320 x 238 | 241 | 35 | 500, 68 | 100% at scrollY 35 |
| Species Detail (Pins) | 390x844 | Chromium | 340 x 300 | 4609.3 | 7158 | 776, 68 | 100% at scrollY 4371 |
| Species Detail (Pins) | 390x844 | WebKit | 340 x 300 | 4612.4 | 7161 | 776, 68 | 100% at scrollY 4374 |
| Species Detail (Pins) | 320x568 | Chromium | 270 x 300 | 4792.1 | 8098 | 500, 68 | 100% at scrollY 4692 |
| Species Detail (Pins) | 320x568 | WebKit | 270 x 300 | 4796.6 | 8103 | 500, 68 | 100% at scrollY 4697 |
| Statistics, Geographic Stats | 390x844 | Chromium | 306.8 x 318 | 5702.7 | 21157 | 787.5, 56.5 | 100% at scrollY 5468 |
| Statistics, Geographic Stats | 390x844 | WebKit | 306.8 x 318 | 5708.2 | 21157 | 787.5, 56.5 | 100% at scrollY 5473 |
| Statistics, Geographic Stats | 320x568 | Chromium | 240 x 318 | 5869 | 23351 | 500, 68 | 100% at scrollY 5778 |
| Statistics, Geographic Stats | 320x568 | WebKit | 240 x 318 | 5877.3 | 23336 | 500, 68 | 100% at scrollY 5786 |
| Named Birds card | 390x844 | Chromium | 310 x 218 | 2397.6 | 2545 | 787.5, 56.5 | 100% at scrollY 2113 |
| Named Birds card | 390x844 | WebKit | 310 x 218 | 2396.6 | 2543 | 787.5, 56.5 | 100% at scrollY 2112 |
| Named Birds card | 320x568 | Chromium | 240 x 218 | 2819.2 | 3388 | 500, 68 | 100% at scrollY 2678 |
| Named Birds card | 320x568 | WebKit | 240 x 218 | 2818.2 | 3387 | 500, 68 | 100% at scrollY 2677 |
| Weather, Plan picker | 390x844 | Chromium | 274 x 180 | 918.5 | 1145 | 787.5, 56.5 | 100% at scrollY 615 |
| Weather, Plan picker | 390x844 | WebKit | 274 x 180 | 919.2 | 1147 | 787.5, 56.5 | 100% at scrollY 615 |
| Weather, Plan picker | 320x568 | Chromium | 204 x 180 | 996.5 | 1563 | 500, 68 | 100% at scrollY 837 |
| Weather, Plan picker | 320x568 | WebKit | 204 x 180 | 997.5 | 1565 | 500, 68 | 100% at scrollY 838 |
| Hotspot Reports | 390x844 | Chromium | 340 x 200 | 1539.8 | 11288 | 787.5, 56.5 | 100% at scrollY 1246 |
| Hotspot Reports | 390x844 | WebKit | 340 x 200 | 1540.5 | 11289 | 787.5, 56.5 | 100% at scrollY 1247 |
| Hotspot Reports | 320x568 | Chromium | 270 x 200 | 1799.6 | 12326 | 500, 68 | 100% at scrollY 1650 |
| Hotspot Reports | 320x568 | WebKit | 270 x 200 | 1800.3 | 12327 | 500, 68 | 100% at scrollY 1650 |

Every map fits whole between the top edge and the bar at both sizes, so "wholly in view" is reachable for all six.

### 4.2 Controls cut off or covered when the map is half off screen

"Hidden" counts the part of a control's box above the top edge, below the viewport's bottom edge, or inside the bar's box. For a group the worst member is shown. These are rects; the bar's opacity and paint order were established by pixel in section 3, not re-sampled here. At max scroll the map is wholly off screen on every surface except the Named Birds card at 390x844 (32% visible, zoom buttons above the top edge) and the Map Explorer.

| Surface | Size | Engine | State (scrollY, share of map visible) | On-map controls cut off or covered |
|---|---|---|---|---|
| Map Explorer | 390x844 | Chromium | neither half-hidden state can be reached: the page scrolls 0 px and the map stays 100% (scroll 0) and 100% (max scroll) visible | none at scroll 0; none at max scroll |
| Map Explorer | 390x844 | WebKit | neither half-hidden state can be reached: the page scrolls 0 px and the map stays 100% (scroll 0) and 100% (max scroll) visible | none at scroll 0; none at max scroll |
| Map Explorer | 320x568 | Chromium | neither half-hidden state can be reached: the page scrolls 35 px and the map stays 100% (scroll 0) and 100% (max scroll) visible | none at scroll 0; none at max scroll |
| Map Explorer | 320x568 | WebKit | neither half-hidden state can be reached: the page scrolls 35 px and the map stays 100% (scroll 0) and 100% (max scroll) visible | none at scroll 0; none at max scroll |
| Species Detail (Pins) | 390x844 | Chromium | lower half hidden: 3983, 49.9% | corner row: share pin: 44 of 44 px hidden (44 below the viewport); corner row: full screen: 44 of 44 px hidden (44 below the viewport); attribution: 44 of 44 px hidden (44 below the viewport) |
| Species Detail (Pins) | 390x844 | Chromium | upper half hidden: 4759, 50.1% | zoom (2): 29 of 29 px hidden (29 above the top edge); base-map switcher: 75 of 75 px hidden (75 above the top edge) |
| Species Detail (Pins) | 390x844 | WebKit | lower half hidden: 3986, 49.9% | corner row: share pin: 44 of 44 px hidden (44 below the viewport); corner row: full screen: 44 of 44 px hidden (44 below the viewport); attribution: 44 of 44 px hidden (44 below the viewport) |
| Species Detail (Pins) | 390x844 | WebKit | upper half hidden: 4762, 50.1% | zoom (2): 29 of 29 px hidden (29 above the top edge); base-map switcher: 75 of 75 px hidden (75 above the top edge) |
| Species Detail (Pins) | 320x568 | Chromium | lower half hidden: 4442, 50% | corner row: share pin: 44 of 44 px hidden (44 below the viewport); corner row: full screen: 44 of 44 px hidden (44 below the viewport); attribution: 44 of 44 px hidden (44 below the viewport) |
| Species Detail (Pins) | 320x568 | Chromium | upper half hidden: 4942, 50% | zoom (2): 29 of 29 px hidden (29 above the top edge); base-map switcher: 75 of 75 px hidden (75 above the top edge) |
| Species Detail (Pins) | 320x568 | WebKit | lower half hidden: 4447, 50.1% | corner row: share pin: 44 of 44 px hidden (44 below the viewport); corner row: full screen: 44 of 44 px hidden (44 below the viewport); attribution: 44 of 44 px hidden (44 below the viewport) |
| Species Detail (Pins) | 320x568 | WebKit | upper half hidden: 4947, 49.9% | zoom (2): 29 of 29 px hidden (29 above the top edge); base-map switcher: 75 of 75 px hidden (75 above the top edge) |
| Statistics, Geographic Stats | 390x844 | Chromium | lower half hidden: 5074, 49.9% | corner row: share pin: 44 of 44 px hidden (44 below the viewport); corner row: full screen: 44 of 44 px hidden (44 below the viewport); attribution: 44 of 44 px hidden (44 below the viewport) |
| Statistics, Geographic Stats | 390x844 | Chromium | upper half hidden: 5862, 49.9% | zoom (2): 29 of 29 px hidden (29 above the top edge); base-map switcher: 75 of 75 px hidden (75 above the top edge) |
| Statistics, Geographic Stats | 390x844 | WebKit | lower half hidden: 5080, 50.1% | corner row: share pin: 44 of 44 px hidden (44 below the viewport); corner row: full screen: 44 of 44 px hidden (44 below the viewport); attribution: 44 of 44 px hidden (44 below the viewport) |
| Statistics, Geographic Stats | 390x844 | WebKit | upper half hidden: 5867, 50.1% | zoom (2): 29 of 29 px hidden (29 above the top edge); base-map switcher: 75 of 75 px hidden (75 above the top edge) |
| Statistics, Geographic Stats | 320x568 | Chromium | lower half hidden: 5528, 50% | corner row: share pin: 44 of 44 px hidden (44 below the viewport); corner row: full screen: 44 of 44 px hidden (44 below the viewport); attribution: 44 of 44 px hidden (44 below the viewport) |
| Statistics, Geographic Stats | 320x568 | Chromium | upper half hidden: 6028, 50% | zoom (2): 29 of 29 px hidden (29 above the top edge); base-map switcher: 75 of 75 px hidden (75 above the top edge) |
| Statistics, Geographic Stats | 320x568 | WebKit | lower half hidden: 5536, 49.9% | corner row: share pin: 44 of 44 px hidden (44 below the viewport); corner row: full screen: 44 of 44 px hidden (44 below the viewport); attribution: 44 of 44 px hidden (44 below the viewport) |
| Statistics, Geographic Stats | 320x568 | WebKit | upper half hidden: 6036, 50.1% | zoom (2): 29 of 29 px hidden (29 above the top edge); base-map switcher: 75 of 75 px hidden (75 above the top edge) |
| Named Birds card | 390x844 | Chromium | lower half hidden: 1719, 50% | corner row: share pin: 40 of 40 px hidden (40 below the viewport); corner row: full screen: 40 of 40 px hidden (40 below the viewport); attribution: 44 of 44 px hidden (1.4 under the bar, 42.6 below the viewport) |
| Named Birds card | 390x844 | Chromium | upper half hidden: 2507, 49.8% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Named Birds card | 390x844 | WebKit | lower half hidden: 1718, 50% | corner row: share pin: 40 of 40 px hidden (40 below the viewport); corner row: full screen: 40 of 40 px hidden (40 below the viewport); attribution: 44 of 44 px hidden (1.4 under the bar, 42.6 below the viewport) |
| Named Birds card | 390x844 | WebKit | upper half hidden: 2506, 49.8% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Named Birds card | 320x568 | Chromium | lower half hidden: 2428, 49.9% | corner row: share pin: 40 of 40 px hidden (10.8 under the bar, 29.2 below the viewport); corner row: full screen: 40 of 40 px hidden (10.8 under the bar, 29.2 below the viewport); attribution: 44 of 44 px hidden (12.8 under the bar, 31.2 below the viewport) |
| Named Birds card | 320x568 | Chromium | upper half hidden: 2928, 50.1% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Named Birds card | 320x568 | WebKit | lower half hidden: 2427, 49.9% | corner row: share pin: 40 of 40 px hidden (10.8 under the bar, 29.2 below the viewport); corner row: full screen: 40 of 40 px hidden (10.8 under the bar, 29.2 below the viewport); attribution: 44 of 44 px hidden (12.8 under the bar, 31.2 below the viewport) |
| Named Birds card | 320x568 | WebKit | upper half hidden: 2927, 50.1% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Weather, Plan picker | 390x844 | Chromium | lower half hidden: 221, 50% | attribution: 44 of 44 px hidden (21.5 under the bar, 22.5 below the viewport) |
| Weather, Plan picker | 390x844 | Chromium | upper half hidden: 1009, 49.7% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Weather, Plan picker | 390x844 | WebKit | lower half hidden: 222, 50.2% | attribution: 44 of 44 px hidden (21.8 under the bar, 22.2 below the viewport) |
| Weather, Plan picker | 390x844 | WebKit | upper half hidden: 1009, 50.1% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Weather, Plan picker | 320x568 | Chromium | lower half hidden: 587, 50.3% | attribution: 64 of 64 px hidden (53.5 under the bar, 10.5 below the viewport) |
| Weather, Plan picker | 320x568 | Chromium | upper half hidden: 1087, 49.7% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Weather, Plan picker | 320x568 | WebKit | lower half hidden: 588, 50.3% | attribution: 64 of 64 px hidden (53.5 under the bar, 10.5 below the viewport) |
| Weather, Plan picker | 320x568 | WebKit | upper half hidden: 1088, 49.7% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Hotspot Reports | 390x844 | Chromium | lower half hidden: 852, 49.8% | attribution: 44 of 44 px hidden (10.2 under the bar, 33.8 below the viewport) |
| Hotspot Reports | 390x844 | Chromium | upper half hidden: 1640, 49.9% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Hotspot Reports | 390x844 | WebKit | lower half hidden: 853, 50% | attribution: 44 of 44 px hidden (10.6 under the bar, 33.5 below the viewport) |
| Hotspot Reports | 390x844 | WebKit | upper half hidden: 1640, 50.2% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Hotspot Reports | 320x568 | Chromium | lower half hidden: 1400, 50.2% | attribution: 44 of 44 px hidden (22.4 under the bar, 21.6 below the viewport) |
| Hotspot Reports | 320x568 | Chromium | upper half hidden: 1900, 49.8% | zoom (2): 29 of 29 px hidden (29 above the top edge) |
| Hotspot Reports | 320x568 | WebKit | lower half hidden: 1400, 49.9% | attribution: 44 of 44 px hidden (21.7 under the bar, 22.3 below the viewport) |
| Hotspot Reports | 320x568 | WebKit | upper half hidden: 1900, 50.1% | zoom (2): 29 of 29 px hidden (29 above the top edge) |

Partial cover by the bar happens at the positions in between: whenever the bottom 64 px of a map with a corner row (52 px on the Named Birds card) crosses the bar's top edge, the two buttons are partly under the bar. The Named Birds rows at 320x568 show one such position (10.8 px under the bar, the rest below the viewport).

Pictures: `baseline/B01-chromium-390x844-species-detail-lower-half-hidden.png`, `B02-webkit-390x844-statistics-lower-half-hidden.png`, `B03-chromium-390x844-statistics-upper-half-hidden.png`, `B04-chromium-390x844-named-birds-lower-half-hidden.png`, `B05-webkit-390x844-weather-picker-lower-half-hidden.png`, `B06-chromium-390x844-hotspot-reports-upper-half-hidden.png`, `B07-webkit-320x568-named-birds-lower-half-hidden-corner-row-under-bar.png`.

### 4.3 What a swipe does

"page" is how far the page moved (positive is down the page) and "map" is how far the map's content moved, both in CSS px, after a gesture of the stated travel. One-finger travel of 120 px moves the page 105 px because the first 15 px are the browser's touch slop. "Up / down" are the two directions of the same gesture.

| Surface | Size | Runtime posture (both engines read the same unless noted) | State | Chromium, real touch: one finger up / down | Chromium: two fingers up / down | Chromium: pinch out | WebKit, script-dispatched touch: one finger | WebKit: two fingers | WebKit: pinch out |
|---|---|---|---|---|---|---|---|---|---|
| Map Explorer | 390x844 | cooperative off, touch-action none | map whole in view (scrollY 0 of 0, 100% visible, 120 px travel) | page 0, map -120 / page 0, map 120 | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map -120 / 120, default prevented on 12 of 12 moves | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Map Explorer | 320x568 | cooperative off, touch-action none | map whole in view (scrollY 35 of 35, 100% visible, 96 px travel) | page 0, map -96 / page 0, map 96 | page 0, map -96 / page 0, map 96 | page 0, zoom +2 | map -96 / 96, default prevented on 12 of 12 moves | map -96 / 96, prevented 12 of 12 | zoom +2 |
| Map Explorer | 320x568 | cooperative off, touch-action none | half-hidden state not reachable; measured at the other end of the scroll range (scrollY 0 of 35, 100% visible, 120 px travel) | page 0, map -120 / page 0, map 120 | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map -120 / 120, default prevented on 12 of 12 moves | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Species Detail (Pins) | 390x844 | cooperative on, touch-action pan-x pan-y | map whole in view (scrollY 4371 of 7158, 100% visible, 120 px travel) | page +105, map 0, hint shown / page -105, map 0, hint shown | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Species Detail (Pins) | 390x844 | cooperative on, touch-action pan-x pan-y | lower half hidden (scrollY 3983 of 7158, 49.9% visible, 53.9 px travel) | page +39, map 0, hint shown / page -39, map 0, hint shown | page 0, map -54 / page 0, map 54 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -53.8 / 53.9, prevented 12 of 12 | zoom +2 |
| Species Detail (Pins) | 390x844 | cooperative on, touch-action pan-x pan-y | upper half hidden (scrollY 4759 of 7158, 50.1% visible, 90.2 px travel) | page +75, map 0, hint shown / page -75, map 0, hint shown | page 0, map -90 / page 0, map 90 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -90.2 / 90.3, prevented 12 of 12 | zoom +2 |
| Species Detail (Pins) | 320x568 | cooperative on, touch-action pan-x pan-y | map whole in view (scrollY 4692 of 8098, 100% visible, 120 px travel) | page +105, map 0, hint shown / page -105, map 0, hint shown | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Species Detail (Pins) | 320x568 | cooperative on, touch-action pan-x pan-y | lower half hidden (scrollY 4442 of 8098, 50% visible, 54 px travel) | page +39, map 0, hint shown / page -39, map 0, hint shown | page 0, map -54 / page 0, map 54 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -54.2 / 54.2, prevented 12 of 12 | zoom +2 |
| Species Detail (Pins) | 320x568 | cooperative on, touch-action pan-x pan-y | upper half hidden (scrollY 4942 of 8098, 50% visible, 90 px travel) | page +75, map 0, hint shown / page -75, map 0, hint shown | page 0, map -90 / page 0, map 90 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -89.7 / 89.7, prevented 12 of 12 | zoom +2 |
| Statistics, Geographic Stats | 390x844 | cooperative off, touch-action none | map whole in view (scrollY 5468 of 21157, 100% visible, 120 px travel) | page 0, map -120 / page 0, map 120 | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map -120 / 120, default prevented on 12 of 12 moves | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Statistics, Geographic Stats | 390x844 | cooperative off, touch-action none | lower half hidden (scrollY 5074 of 21157, 49.9% visible, 57.2 px travel) | page 0, map -57 / page 0, map 57 | page 0, map -57 / page 0, map 57 | page 0, zoom +2 | map -57.3 / 57.4, default prevented on 12 of 12 moves | map -57.3 / 57.4, prevented 12 of 12 | zoom +2 |
| Statistics, Geographic Stats | 390x844 | cooperative off, touch-action none | upper half hidden (scrollY 5862 of 21157, 49.9% visible, 95.2 px travel) | page +80, map 0 / page 0, map 95 | page 0, map -95 / page 0, map 95 | page 0, zoom +2 | map -95.5 / 95.5, default prevented on 12 of 12 moves | map -95.5 / 95.5, prevented 12 of 12 | zoom +2 |
| Statistics, Geographic Stats | 320x568 | cooperative off, touch-action none | map whole in view (scrollY 5778 of 23351, 100% visible, 120 px travel) | page 0, map -120 / page 0, map 120 | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map -120 / 120, default prevented on 12 of 12 moves | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Statistics, Geographic Stats | 320x568 | cooperative off, touch-action none | lower half hidden (scrollY 5528 of 23351, 50% visible, 57.3 px travel) | page 0, map -57 / page 0, map 57 | page 0, map -57 / page 0, map 57 | page 0, zoom +2 | map -57.1 / 57.2, default prevented on 12 of 12 moves | map -57.1 / 57.2, prevented 12 of 12 | zoom +2 |
| Statistics, Geographic Stats | 320x568 | cooperative off, touch-action none | upper half hidden (scrollY 6028 of 23351, 50% visible, 95.4 px travel) | page 0, map -95 / page 0, map 95 | page 0, map -95 / page 0, map 95 | page 0, zoom +2 | map -95.5 / 95.6, default prevented on 12 of 12 moves | map -95.5 / 95.6, prevented 12 of 12 | zoom +2 |
| Named Birds card | 390x844 | cooperative on, touch-action pan-x pan-y | map whole in view (scrollY 2113 of 2545, 100% visible, 120 px travel) | page +105, map 0, hint shown / page -105, map 0, hint shown | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Named Birds card | 390x844 | cooperative on, touch-action pan-x pan-y | lower half hidden (scrollY 1719 of 2545, 50% visible, 65.3 px travel) | page +51, map 0, hint shown / page -51, map 0, hint shown | page 0, map -66 / page 0, map 66 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -65.3 / 65.3, prevented 12 of 12 | zoom +2 |
| Named Birds card | 390x844 | cooperative on, touch-action pan-x pan-y | upper half hidden (scrollY 2507 of 2545, 49.8% visible, 65.2 px travel) | page +38, map 0, hint shown / page -50, map 0, hint shown | page 0, map -65 / page 0, map 65 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -65.2 / 65.2, prevented 12 of 12 | zoom +2 |
| Named Birds card | 320x568 | cooperative on, touch-action pan-x pan-y | map whole in view (scrollY 2678 of 3388, 100% visible, 120 px travel) | page +105, map 0, hint shown / page -105, map 0, hint shown | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Named Birds card | 320x568 | cooperative on, touch-action pan-x pan-y | lower half hidden (scrollY 2428 of 3388, 49.9% visible, 65.3 px travel) | page +50, map 0, hint shown / page -50, map 0, hint shown | page 0, map -65 / page 0, map 65 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -65.3 / 65.3, prevented 12 of 12 | zoom +2 |
| Named Birds card | 320x568 | cooperative on, touch-action pan-x pan-y | upper half hidden (scrollY 2928 of 3388, 50.1% visible, 65.5 px travel) | page +50, map 0, hint shown / page -50, map 0, hint shown | page 0, map -65 / page 0, map 65 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -65.5 / 65.5, prevented 12 of 12 | zoom +2 |
| Weather, Plan picker | 390x844 | cooperative off, touch-action none | map whole in view (scrollY 615 of 1145, 100% visible, 86.4 px travel) | page 0, map -86 / page 0, map 86 | page 0, map -86 / page 0, map 86 | page 0, zoom +2 | map -86.4 / 86.4, default prevented on 12 of 12 moves | map -86.4 / 86.4, prevented 12 of 12 | zoom +2 |
| Weather, Plan picker | 390x844 | cooperative off, touch-action none | lower half hidden (scrollY 221 of 1145, 50% visible, 54 px travel) | page 0, map -54 / page 0, map 54 | page 0, map -54 / page 0, map 54 | page 0, zoom +2 | map -54.2 / 54.2, default prevented on 12 of 12 moves | map -54.2 / 54.2, prevented 12 of 12 | zoom +2 |
| Weather, Plan picker | 390x844 | cooperative off, touch-action none | upper half hidden (scrollY 1009 of 1145, 49.7% visible, 53.7 px travel) | page 0, map -54 / page 0, map 54 | page 0, map -54 / page 0, map 54 | page 0, zoom +2 | map -54.1 / 54.1, default prevented on 12 of 12 moves | map -54.1 / 54.1, prevented 12 of 12 | zoom +2 |
| Weather, Plan picker | 320x568 | cooperative off, touch-action none | map whole in view (scrollY 837 of 1563, 100% visible, 108 px travel) | page +93, map 0 [started on a.] / page 0, map 108 | page 0, map -108 / page 0, map 108 | page 0, zoom +2 | map -108 / 108, default prevented on 12 of 12 moves | map -108 / 108, prevented 12 of 12 | zoom +2 |
| Weather, Plan picker | 320x568 | cooperative off, touch-action none | lower half hidden (scrollY 587 of 1563, 50.3% visible, 54.3 px travel) | page 0, map -54 / page 0, map 54 | page 0, map -54 / page 0, map 54 | page 0, zoom +2 | map -54.3 / 54.3, default prevented on 12 of 12 moves | map -54.3 / 54.3, prevented 12 of 12 | zoom +2 |
| Weather, Plan picker | 320x568 | cooperative off, touch-action none | upper half hidden (scrollY 1087 of 1563, 49.7% visible, 53.7 px travel) | page 0, map -54 / page 0, map 54 | page 0, map -54 / page 0, map 54 | page 0, zoom +2 | map -53.7 / 53.7, default prevented on 12 of 12 moves | map -53.7 / 53.7, prevented 12 of 12 | zoom +2 |
| Hotspot Reports | 390x844 | cooperative on, touch-action pan-x pan-y | map whole in view (scrollY 1246 of 11288, 100% visible, 120 px travel) | page +105, map 0, hint shown / page -105, map 0, hint shown | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Hotspot Reports | 390x844 | cooperative on, touch-action pan-x pan-y | lower half hidden (scrollY 852 of 11288, 49.8% visible, 59.8 px travel) | page +45, map 0, hint shown / page -45, map 0, hint shown | page 0, map -60 / page 0, map 60 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -60 / 60, prevented 12 of 12 | zoom +2 |
| Hotspot Reports | 390x844 | cooperative on, touch-action pan-x pan-y | upper half hidden (scrollY 1640 of 11288, 49.9% visible, 59.9 px travel) | page +45, map 0, hint shown / page -45, map 0, hint shown | page 0, map -60 / page 0, map 60 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -60.3 / 60.3, prevented 12 of 12 | zoom +2 |
| Hotspot Reports | 320x568 | cooperative on, touch-action pan-x pan-y | map whole in view (scrollY 1650 of 12326, 100% visible, 120 px travel) | page +105, map 0, hint shown / page -105, map 0, hint shown | page 0, map -120 / page 0, map 120 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -120 / 120, prevented 12 of 12 | zoom +2 |
| Hotspot Reports | 320x568 | cooperative on, touch-action pan-x pan-y | lower half hidden (scrollY 1400 of 12326, 50.2% visible, 60.3 px travel) | page +45, map 0, hint shown / page -45, map 0, hint shown | page 0, map -60 / page 0, map 60 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -59.8 / 59.8, prevented 12 of 12 | zoom +2 |
| Hotspot Reports | 320x568 | cooperative on, touch-action pan-x pan-y | upper half hidden (scrollY 1900 of 12326, 49.8% visible, 59.7 px travel) | page +45, map 0, hint shown / page -45, map 0, hint shown | page 0, map -60 / page 0, map 60 | page 0, zoom +2 | map 0 / 0, default prevented on 0 of 12 moves, hint shown | map -60.2 / 60.2, prevented 12 of 12 | zoom +2 |

Totals over these runs (the Map Explorer's rows repeat at its one or two reachable positions):

| Engine | Maps | Gesture | Runs | Page moved | Map moved | Notes |
|---|---|---|---|---|---|---|
| Chromium, real touch | cooperative off (Map Explorer, Statistics, Weather) | one finger, started on the canvas | 35 | 1 | 34 | the 1 is the edge case in 4.4; every move cancelled by the map in the other 34 |
| Chromium, real touch | cooperative off | two fingers | 36 | 0 | 36 | |
| Chromium, real touch | cooperative off | pinch out | 18 | 0 | 18 zoomed | |
| Chromium, real touch | cooperative on (Species Detail, Named Birds, Hotspot Reports) | one finger | 36 | 36 | 0 | "two fingers" hint shown in 36; no move cancelled |
| Chromium, real touch | cooperative on | two fingers | 36 | 0 | 36 | |
| Chromium, real touch | cooperative on | pinch out | 18 | 0 | 18 zoomed | |
| WebKit, script-dispatched | cooperative off | one finger | 36 | not measurable | 36 | every move cancelled by the map in 36 |
| WebKit, script-dispatched | cooperative off | two fingers | 36 | not measurable | 36 | |
| WebKit, script-dispatched | cooperative on | one finger | 36 | not measurable | 0 | hint shown in 36; no move cancelled in 36 |
| WebKit, script-dispatched | cooperative on | two fingers | 36 | not measurable | 36 | |
| WebKit, script-dispatched | both | pinch out | 36 | not measurable | 36 zoomed | |

One Chromium one-finger run on the Weather picker at 320x568 is left out of the 35 because no start point clear of the open attribution was found on the 204 px map; it started on the attribution text and moved the page 93 px.

A repeat pass in Chromium at 390x844 with nothing else running, alternating up and down, 8 runs at each of the three states: Statistics page moved in 0 of 24 and map in 24 of 24; Weather page moved in 0 of 24 and map in 24 of 24.

What the WebKit columns do and do not show: the map's handlers and the computed `touch-action` are the same as in Chromium on every surface (`none` where cooperative gestures are off, `pan-x pan-y` where they are on), and the map cancels or leaves each move exactly as it does in Chromium. Whether WebKit then scrolls the page is the engine's own step and was not observed.

### 4.4 A swipe that starts on a control scrolls the page, even on the cooperative-off maps

One run in the main pass (Statistics, Chromium, 390x844, upper half hidden) moved the page 80 px and the map 0 px although its start point tested as canvas. The start point was 0.9 px above the attribution button's top edge. A follow-up on that map, 4 runs per start point:

| Start point relative to the attribution button's top edge | Page moved | Map moved |
|---|---|---|
| 20 px above | 0 of 4 | 4 of 4 |
| 6 px above | 0 of 4 | 4 of 4 |
| 2 px above | 0 of 4 | 4 of 4 |
| 1 px above | 4 of 4 | 0 of 4 |
| on the edge, 1 px inside, 6 px inside | 12 of 12 | 0 of 12 |

So on Statistics, the Weather picker and the Map Explorer, a one-finger swipe scrolls the page when it starts on the attribution (and, in the first exploratory pass, on the base-map switcher and on the open attribution text), and pans the map when it starts anywhere else. The boundary is within 1 to 2 px of the control's edge. Chromium only; not measured in WebKit.

### 4.5 The Map Explorer

| Reading | 390x844 (Chromium, WebKit) | 320x568 (Chromium, WebKit) |
|---|---|---|
| Panel (`.sr-map-explorer-panel`) height, computed min-height | 613 px and 612.98 px, 340 px | 340 px, 340 px (on the floor) |
| Measured chrome (`--sr-map-chrome`) | 231 px | 263 px |
| Map box inside the panel | 390 x 513 and 390 x 511.7 | 320 x 240 and 320 x 238 |
| Page scroll range | 0 | 35 px |
| Header height | 118 px | 139 px |
| Bar top, height | 787.5, 56.5 | 500, 68 |
| Cluster bottom edge to bar top, scroll 0 | 76.5 px clear | 41 px clear |
| Cluster bottom edge to bar top, max scroll | same (no scroll) | 76 px clear |
| Footer at scroll 0 | 731 to 787, clear of the bar | 479 to 535, so 35 px of it is under the bar until the page is scrolled |
| One finger on the map | pans the map, page 0 | pans the map, page 0, at scroll 0 and at scroll 35 |

All four view modes (My Sightings, Hotspots, Nearby Lifers, Media Targets) gave the same scroll range and cluster position in each engine and size:

- chromium 390x844: Hotspots: scroll range 0, cluster bottom 711 at scroll 0 and 711 at max scroll, bar top 787.5, under the bar 0 px; Nearby Lifers: scroll range 0, cluster bottom 711 at scroll 0 and 711 at max scroll, bar top 787.5, under the bar 0 px; Media Targets: scroll range 0, cluster bottom 711 at scroll 0 and 711 at max scroll, bar top 787.5, under the bar 0 px; My Sightings: scroll range 0, cluster bottom 711 at scroll 0 and 711 at max scroll, bar top 787.5, under the bar 0 px
- chromium 320x568: Hotspots: scroll range 35, cluster bottom 459 at scroll 0 and 424 at max scroll, bar top 500, under the bar 0 px; Nearby Lifers: scroll range 35, cluster bottom 459 at scroll 0 and 424 at max scroll, bar top 500, under the bar 0 px; Media Targets: scroll range 35, cluster bottom 459 at scroll 0 and 424 at max scroll, bar top 500, under the bar 0 px; My Sightings: scroll range 35, cluster bottom 459 at scroll 0 and 424 at max scroll, bar top 500, under the bar 0 px
- webkit 390x844: Hotspots: scroll range 0, cluster bottom 711 at scroll 0 and 711 at max scroll, bar top 787.5, under the bar 0 px; Nearby Lifers: scroll range 0, cluster bottom 711 at scroll 0 and 711 at max scroll, bar top 787.5, under the bar 0 px; Media Targets: scroll range 0, cluster bottom 711 at scroll 0 and 711 at max scroll, bar top 787.5, under the bar 0 px; My Sightings: scroll range 0, cluster bottom 711 at scroll 0 and 711 at max scroll, bar top 787.5, under the bar 0 px
- webkit 320x568: Hotspots: scroll range 35, cluster bottom 459 at scroll 0 and 424 at max scroll, bar top 500, under the bar 0 px; Nearby Lifers: scroll range 35, cluster bottom 459 at scroll 0 and 424 at max scroll, bar top 500, under the bar 0 px; Media Targets: scroll range 35, cluster bottom 459 at scroll 0 and 424 at max scroll, bar top 500, under the bar 0 px; My Sightings: scroll range 35, cluster bottom 459 at scroll 0 and 424 at max scroll, bar top 500, under the bar 0 px

So at 320x568 the page does scroll under a live map, by 35 px, and a swipe that starts on the map cannot produce that scroll; it has to start on the header, the view pills or the footer. Pictures: `baseline/B08-chromium-320x568-map-explorer-scroll-0.png` and `baseline/B09-chromium-320x568-map-explorer-max-scroll-35.png`.

## 5. Section C: lists that scroll inside a scrolling page

Asked after the map work: are there other places where something scrolls inside the scrolling page? Five dropdown lists do. Each was opened by a real tap on its field, in both engines and at both sizes, in two positions. "Near the top": the field 16 px below the top edge, or as near as the page's scroll range allows. "Low": the field 62% of the way from the top edge to the bar, or at scroll 0 where the page cannot bring it that low.

How low a field can go: at 390x844 the four picker fields sit 262 to 327 px down their pages, so scrolling can place them anywhere from the top edge to at most 39% of the way down the screen, and the "low" position is scroll 0 for all four. At 320x568 they sit 283 to 387 px down, so three of them reached the 62% position (y about 310) and could go up to 77 px lower still; the species picker stopped at y 283. The Targets popover's trigger sits deeper in its page and reached the 62% position at both sizes.

### 5.1 The list against the viewport and the bar

All five lists are `position: absolute` under their field. The four picker lists have `z-index: 1200`, the same as the bar, and come earlier in the DOM. The last column is the pixel check from section 2 on the band the list shares with the bar: a nonzero count means the bar is painted over the list there.

| List | Size | Engine | Field position | Field top (y) | List rect (top to bottom), height | Own scroll range | overscroll-behavior-y | Bar top | Below the viewport | Under the bar | Not visible in total | Bar paints over the shared band (px that change when the probe hides the bar) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hotspot Reports picker (.sr-hsr-list) | 390x844 | Chromium | near the top (scrollY 254 of 1455) | 16 | 62 to 382, 320 | 9912 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Hotspot Reports picker (.sr-hsr-list) | 390x844 | Chromium | low (scrollY 0 of 1455) | 270 | 316 to 636, 320 | 9912 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Hotspot Reports picker (.sr-hsr-list) | 390x844 | WebKit | near the top (scrollY 254 of 1455) | 16.3 | 62.6 to 382.6, 320 | 9912 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Hotspot Reports picker (.sr-hsr-list) | 390x844 | WebKit | low (scrollY 0 of 1455) | 270.3 | 316.6 to 636.6, 320 | 9912 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Hotspot Reports picker (.sr-hsr-list) | 320x568 | Chromium | near the top (scrollY 295 of 1894) | 15.5 | 61.5 to 381.5, 320 | 10348 | contain | 500 | 0 | 0 | 0 px (0%) | no shared band |
| Hotspot Reports picker (.sr-hsr-list) | 320x568 | Chromium | low (scrollY 1 of 1894) | 309.5 | 355.5 to 675.5, 320 | 10348 | contain | 500 | 107.5 | 68 | 175.5 px (54.8%) | 13573 of 73984 (18.35%) |
| Hotspot Reports picker (.sr-hsr-list) | 320x568 | WebKit | near the top (scrollY 295 of 1894) | 16 | 62.5 to 382.5, 320 | 10348 | contain | 500 | 0 | 0 | 0 px (0%) | no shared band |
| Hotspot Reports picker (.sr-hsr-list) | 320x568 | WebKit | low (scrollY 1 of 1894) | 310 | 356.5 to 676.5, 320 | 10348 | contain | 500 | 108.5 | 68 | 176.5 px (55.2%) | 13698 of 73984 (18.51%) |
| Life Lists region picker (.sr-lfl-region-list) | 390x844 | Chromium | near the top (scrollY 246 of 12581) | 15.5 | 58.5 to 346.5, 288 | 2099 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Life Lists region picker (.sr-lfl-region-list) | 390x844 | Chromium | low (scrollY 0 of 12581) | 261.5 | 304.5 to 592.5, 288 | 2099 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Life Lists region picker (.sr-lfl-region-list) | 390x844 | WebKit | near the top (scrollY 246 of 12581) | 15.8 | 59.2 to 347.2, 288 | 2099 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Life Lists region picker (.sr-lfl-region-list) | 390x844 | WebKit | low (scrollY 0 of 12581) | 261.8 | 305.2 to 593.2, 288 | 2099 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Life Lists region picker (.sr-lfl-region-list) | 320x568 | Chromium | near the top (scrollY 314 of 13446) | 16 | 59 to 347, 288 | 2099 | contain | 500 | 0 | 0 | 0 px (0%) | no shared band |
| Life Lists region picker (.sr-lfl-region-list) | 320x568 | Chromium | low (scrollY 20 of 13446) | 310 | 353 to 641, 288 | 2099 | contain | 500 | 73 | 68 | 141 px (49%) | 8303 of 66912 (12.41%) |
| Life Lists region picker (.sr-lfl-region-list) | 320x568 | WebKit | near the top (scrollY 314 of 13468) | 16.5 | 60 to 348, 288 | 2099 | contain | 500 | 0 | 0 | 0 px (0%) | no shared band |
| Life Lists region picker (.sr-lfl-region-list) | 320x568 | WebKit | low (scrollY 20 of 13468) | 310.5 | 354 to 642, 288 | 2099 | contain | 500 | 74 | 68 | 142 px (49.3%) | 8333 of 66912 (12.45%) |
| Targets county picker (.sr-tg-combo-list) | 390x844 | Chromium | near the top (scrollY 311 of 401) | 15.5 | 48.5 to 320.5, 272 | 978 | auto | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Targets county picker (.sr-tg-combo-list) | 390x844 | Chromium | low (scrollY 0 of 401) | 326.5 | 359.5 to 631.5, 272 | 978 | auto | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Targets county picker (.sr-tg-combo-list) | 390x844 | WebKit | near the top (scrollY 310 of 402) | 16.5 | 49.5 to 321.5, 272 | 978 | auto | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Targets county picker (.sr-tg-combo-list) | 390x844 | WebKit | low (scrollY 0 of 402) | 326.5 | 359.5 to 631.5, 272 | 978 | auto | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| Targets county picker (.sr-tg-combo-list) | 320x568 | Chromium | near the top (scrollY 371 of 897) | 15.5 | 48.5 to 320.5, 272 | 978 | auto | 500 | 0 | 0 | 0 px (0%) | no shared band |
| Targets county picker (.sr-tg-combo-list) | 320x568 | Chromium | low (scrollY 77 of 897) | 309.5 | 342.5 to 614.5, 272 | 978 | auto | 500 | 46.5 | 68 | 114.5 px (42.1%) | 10860 of 66912 (16.23%) |
| Targets county picker (.sr-tg-combo-list) | 320x568 | WebKit | near the top (scrollY 370 of 898) | 16.5 | 49.5 to 321.5, 272 | 978 | auto | 500 | 0 | 0 | 0 px (0%) | no shared band |
| Targets county picker (.sr-tg-combo-list) | 320x568 | WebKit | low (scrollY 76 of 898) | 310.5 | 343.5 to 615.5, 272 | 978 | auto | 500 | 47.5 | 68 | 115.5 px (42.5%) | 10830 of 66912 (16.19%) |
| Species picker on Species Detail (.sr-combobox-list) | 390x844 | Chromium | near the top (scrollY 78 of 78) | 184 | 224 to 484, 260 | 9992 | auto | 776 | 0 | 0 | 0 px (0%) | no shared band |
| Species picker on Species Detail (.sr-combobox-list) | 390x844 | Chromium | low (scrollY 5 of 78) | 257 | 297 to 557, 260 | 9992 | auto | 776 | 0 | 0 | 0 px (0%) | no shared band |
| Species picker on Species Detail (.sr-combobox-list) | 390x844 | WebKit | near the top (scrollY 80 of 80) | 182 | 222 to 482, 260 | 9992 | auto | 776 | 0 | 0 | 0 px (0%) | no shared band |
| Species picker on Species Detail (.sr-combobox-list) | 390x844 | WebKit | low (scrollY 0 of 80) | 262 | 302 to 562, 260 | 9992 | auto | 776 | 0 | 0 | 0 px (0%) | no shared band |
| Species picker on Species Detail (.sr-combobox-list) | 320x568 | Chromium | near the top (scrollY 267 of 427) | 16 | 56 to 316, 260 | 9992 | auto | 500 | 0 | 0 | 0 px (0%) | no shared band |
| Species picker on Species Detail (.sr-combobox-list) | 320x568 | Chromium | low (scrollY 0 of 427) | 283 | 323 to 583, 260 | 9992 | auto | 500 | 15 | 68 | 83 px (31.9%) | 12484 of 73984 (16.87%) |
| Species picker on Species Detail (.sr-combobox-list) | 320x568 | WebKit | near the top (scrollY 267 of 431) | 16 | 56 to 316, 260 | 9992 | auto | 500 | 0 | 0 | 0 px (0%) | no shared band |
| Species picker on Species Detail (.sr-combobox-list) | 320x568 | WebKit | low (scrollY 0 of 431) | 283 | 323 to 583, 260 | 9992 | auto | 500 | 15 | 68 | 83 px (31.9%) | 12730 of 73984 (17.21%) |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 390x844 | Chromium | near the top (scrollY 761 of 7201) | 16.3 | 337.4 to 521.4, 184 | 360 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| the popover itself (.sr-tg-apop) | 390x844 | Chromium | same | 16.3 | 62.8 to 528.4, 465.5 | 0 | auto | 787.5 | 0 | 0 | 0 px (0%) | |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 390x844 | Chromium | low (scrollY 289 of 7201) | 488.3 | 809.4 to 993.4, 184 | 360 | contain | 787.5 | 149.4 | 34.6 | 184 px (100%) | 13665 of 94224 (14.5%) |
| the popover itself (.sr-tg-apop) | 390x844 | Chromium | same | 488.3 | 534.8 to 1000.4, 465.5 | 0 | auto | 787.5 | 156.4 | 56.5 | 212.9 px (45.7%) | |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 390x844 | WebKit | near the top (scrollY 762 of 7201) | 15.9 | 337 to 521, 184 | 360 | contain | 787.5 | 0 | 0 | 0 px (0%) | no shared band |
| the popover itself (.sr-tg-apop) | 390x844 | WebKit | same | 15.9 | 62.4 to 528, 465.5 | 0 | auto | 787.5 | 0 | 0 | 0 px (0%) | |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 390x844 | WebKit | low (scrollY 290 of 7201) | 487.9 | 809 to 993, 184 | 360 | contain | 787.5 | 149 | 35 | 184 px (100%) | 13715 of 95130 (14.42%) |
| the popover itself (.sr-tg-apop) | 390x844 | WebKit | same | 487.9 | 534.4 to 1000, 465.5 | 0 | auto | 787.5 | 156 | 56.5 | 212.5 px (45.6%) | |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 320x568 | Chromium | near the top (scrollY 932 of 7754) | 16.1 | 377.7 to 561.7, 184 | 360 | contain | 500 | 0 | 61.7 | 61.7 px (33.6%) | 8776 of 57072 (15.38%) |
| the popover itself (.sr-tg-apop) | 320x568 | Chromium | same | 16.1 | 103.2 to 568.7, 465.5 | 0 | auto | 500 | 0.7 | 68 | 68.7 px (14.8%) | |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 320x568 | Chromium | low (scrollY 638 of 7754) | 310.1 | 671.7 to 855.7, 184 | 360 | contain | 500 | 184 | 0 | 184 px (100%) | no shared band |
| the popover itself (.sr-tg-apop) | 320x568 | Chromium | same | 310.1 | 397.2 to 862.7, 465.5 | 0 | auto | 500 | 294.7 | 68 | 362.7 px (77.9%) | |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 320x568 | WebKit | near the top (scrollY 933 of 7755) | 16 | 377.7 to 561.7, 184 | 360 | contain | 500 | 0 | 61.7 | 61.7 px (33.5%) | 8846 of 57072 (15.5%) |
| the popover itself (.sr-tg-apop) | 320x568 | WebKit | same | 16 | 103.1 to 568.7, 465.5 | 0 | auto | 500 | 0.7 | 68 | 68.7 px (14.8%) | |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 320x568 | WebKit | low (scrollY 639 of 7755) | 310 | 671.7 to 855.7, 184 | 360 | contain | 500 | 184 | 0 | 184 px (100%) | no shared band |
| the popover itself (.sr-tg-apop) | 320x568 | WebKit | same | 310 | 397.1 to 862.7, 465.5 | 0 | auto | 500 | 294.7 | 68 | 362.7 px (77.9%) | |

- At 390x844, 0 px of any of the four picker lists is hidden in either position, in both engines.
- At 320x568 with the field in the low position, 83 to 176 px of each picker list (31.9% to 55.2%) is below the viewport or under the bar, and the bar is painted over the list in the shared band in 8 of 8 readings.
- The Targets popover (465.5 px tall, list 184 px) ends under the bar at 320x568 even with its trigger 16 px from the top: 61.7 px of the list and 68 px of the popover. With its trigger at mid screen the whole list is off screen at both sizes.
- The lists' own scroll ranges are large where the list is long: about 9,900 to 10,300 px for the Hotspot Reports picker (530 places in this backup) and 9,992 px for the species picker.

### 5.2 Does the page still scroll with a list open

The page is not locked while a list is open (`body` overflow stays `visible` in every reading). A programmatic scroll moved the page and left the list open in 40 of 40 readings (5 lists, 2 sizes, 2 positions, 2 engines); the list moves with the page. With real touch in Chromium:

| List | Size | Field position | Swipe up on the list from its start | Swipe up on the list at its end | Swipe down on the list at its start | Swipe up on the page above the field | Programmatic page scroll with the list open |
|---|---|---|---|---|---|---|---|
| Hotspot Reports picker (.sr-hsr-list) | 390x844 | near the top | list +85, page 0 | list 0, page 0 | list 0, page 0 | skipped: no page area above the field | moved 80, list still open: true |
| Hotspot Reports picker (.sr-hsr-list) | 390x844 | low | list +85, page 0 | list 0, page 0 | list 0, page 0 | list 0, page +85 | moved 80, list still open: true |
| Hotspot Reports picker (.sr-hsr-list) | 320x568 | near the top | list +85, page 0 | list 0, page 0 | list 0, page 0 | skipped: no page area above the field | moved 80, list still open: true |
| Hotspot Reports picker (.sr-hsr-list) | 320x568 | low | list +85, page 0 | list 0, page 0 | list 0, page 0 | list 0, page +85 | moved 80, list still open: true |
| Life Lists region picker (.sr-lfl-region-list) | 390x844 | near the top | list +85, page 0 | list 0, page 0 | list 0, page 0 | skipped: no page area above the field | moved 80, list still open: true |
| Life Lists region picker (.sr-lfl-region-list) | 390x844 | low | list +85, page 0 | list 0, page 0 | list 0, page 0 | list 0, page +85 | moved 80, list still open: true |
| Life Lists region picker (.sr-lfl-region-list) | 320x568 | near the top | list +85, page 0 | list 0, page 0 | list 0, page 0 | skipped: no page area above the field | moved 80, list still open: true |
| Life Lists region picker (.sr-lfl-region-list) | 320x568 | low | list +85, page 0 | list 0, page 0 | list 0, page 0 | list 0, page +85 | moved 80, list still open: true |
| Targets county picker (.sr-tg-combo-list) | 390x844 | near the top | list +85, page 0 | list 0, page +85 | list 0, page -85 | skipped: no page area above the field | moved 80, list still open: true |
| Targets county picker (.sr-tg-combo-list) | 390x844 | low | list +85, page 0 | list 0, page +85 | list 0, page 0 | list 0, page +85 | moved 80, list still open: true |
| Targets county picker (.sr-tg-combo-list) | 320x568 | near the top | list +85, page 0 | list 0, page +85 | list 0, page -85 | skipped: no page area above the field | moved 80, list still open: true |
| Targets county picker (.sr-tg-combo-list) | 320x568 | low | list +85, page 0 | list 0, page +85 | list 0, page -77 | list 0, page +85 | moved 80, list still open: true |
| Species picker on Species Detail (.sr-combobox-list) | 390x844 | near the top | list +85, page 0 | list 0, page 0 | list 0, page -78 | list 0, page 0 | moved -78, list still open: true |
| Species picker on Species Detail (.sr-combobox-list) | 390x844 | low | list +85, page 0 | list 0, page +73 | list 0, page -5 | list 0, page +73 | moved -5, list still open: true |
| Species picker on Species Detail (.sr-combobox-list) | 320x568 | near the top | list +85, page 0 | list 0, page +85 | list 0, page -85 | skipped: no page area above the field | moved 80, list still open: true |
| Species picker on Species Detail (.sr-combobox-list) | 320x568 | low | list +85, page 0 | list 0, page +85 | list 0, page 0 | list 0, page +85 | moved 80, list still open: true |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 390x844 | near the top | list +85, page 0 | list 0, page 0 | list 0, page 0 | skipped: no page area above the field | moved 80, list still open: true |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 390x844 | low | skipped: only -22px of the list is visible | not run | not run | list closed, page +85, list closed | moved 80, list still open: true |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 320x568 | near the top | list +68, page 0 | list 0, page 0 | list 0, page 0 | skipped: no page area above the field | moved 80, list still open: true |
| Targets "Measure distances from" list (.sr-tg-apop-list), with-key model | 320x568 | low | skipped: only -172px of the list is visible | not run | not run | list closed, page +85, list closed | moved 80, list still open: true |

- A swipe that starts on the list scrolls the list (the travel less the 15 px slop) and the page 0 px, in every case where enough of the list was on screen to swipe on. In the popover's "near the top" row at 320x568 the downward swipe began on the popover's section heading just above the list, which is why the page moved there.
- At the end of the list the next swipe is handed to the page on the two lists without `overscroll-behavior: contain` (the Targets county list and the species picker: page moved 73 to 85 px where the page had room) and is not on the three with it (page 0).
- A swipe on the page outside the list scrolls the page and leaves the four picker lists open; the Targets popover closes on a touch outside it.
- In WebKit only the programmatic scroll was measurable (it moved the page with the list open in 20 of 20 readings). Touch was not.

Pictures: `baseline/C01-chromium-320x568-hotspot-picker-list-under-bar.png`, `baseline/C02-webkit-320x568-targets-county-list-under-bar.png`, `baseline/C03-chromium-320x568-targets-distance-popover-under-bar-with-key-model.png`.

### 5.3 Sweep for anything else

On every tab, every visible element with `scrollHeight` greater than `clientHeight` and a computed `overflow-y` of `auto` or `scroll` was listed, leaving out the document scroller. Swept: the default state of 14 tabs (the 13 in `TAB_LABELS` and Settings) and the six prepared map states, in each engine and size, with every list closed.

- chromium 390x844 nokey: 20 states swept, 0 elements found, errors: none; page scroll ranges: Weather 289, Statistics 21157, Map Explorer 0, Species Detail 78, Calendar 3966, Targets 401, Multimedia 7, Breeding Codes 6948, Hotspot Reports 1455, Checklists 8553, Life Lists 12581, List Comparer 0, Named Birds 472, Settings 3217, prepared: Map Explorer 0, prepared: Species Detail, Sighting Locations (Pins) 7158, prepared: Statistics, Geographic Stats 21157, prepared: Named Birds, open card map 2545, prepared: Weather, Plan location picker 1145, prepared: Hotspot Reports, report map 11288
- webkit 390x844 nokey: 20 states swept, 0 elements found, errors: none; page scroll ranges: Weather 289, Statistics 21157, Map Explorer 0, Species Detail 80, Calendar 3966, Targets 402, Multimedia 7, Breeding Codes 6950, Hotspot Reports 1455, Checklists 8556, Life Lists 12581, List Comparer 0, Named Birds 470, Settings 3217, prepared: Map Explorer 0, prepared: Species Detail, Sighting Locations (Pins) 7161, prepared: Statistics, Geographic Stats 21157, prepared: Named Birds, open card map 2543, prepared: Weather, Plan location picker 1147, prepared: Hotspot Reports, report map 11289
- chromium 320x568 nokey: 20 states swept, 0 elements found, errors: none; page scroll ranges: Weather 690, Statistics 23351, Map Explorer 35, Species Detail 427, Calendar 4193, Targets 897, Multimedia 420, Breeding Codes 8109, Hotspot Reports 1894, Checklists 11211, Life Lists 13446, List Comparer 206, Named Birds 985, Settings 3793, prepared: Map Explorer 35, prepared: Species Detail, Sighting Locations (Pins) 8098, prepared: Statistics, Geographic Stats 23351, prepared: Named Birds, open card map 3388, prepared: Weather, Plan location picker 1563, prepared: Hotspot Reports, report map 12326
- webkit 320x568 nokey: 20 states swept, 0 elements found, errors: none; page scroll ranges: Weather 691, Statistics 23336, Map Explorer 35, Species Detail 431, Calendar 4193, Targets 898, Multimedia 420, Breeding Codes 8112, Hotspot Reports 1894, Checklists 11216, Life Lists 13468, List Comparer 207, Named Birds 984, Settings 3794, prepared: Map Explorer 35, prepared: Species Detail, Sighting Locations (Pins) 8103, prepared: Statistics, Geographic Stats 23336, prepared: Named Birds, open card map 3403, prepared: Weather, Plan location picker 1565, prepared: Hotspot Reports, report map 12327

Result: 0 elements in 80 of 80 states. Outside the five lists above, nothing in the page at the phone tier has a vertical scroll range of its own. Overlays (the More sheet, Help, Search, dialogs) were not opened and are out of this sweep; horizontal scrollers were not surveyed.

## 6. Not measured

- **Real devices, the iOS simulator and the Android emulator.** This errand was the two desktop engines only.
- **WebKit page movement under touch**, on every surface and every list. Section 4.3 says what was measured there instead.
- **The on-screen keyboard.** Four of the five lists belong to text fields, so on a phone a tap on the field also raises the keyboard, which takes a large part of the lower screen. Playwright shows none. Section 5's "nothing hidden at 390x844" is a reading without a keyboard.
- **iOS safe-area insets.** `env()` is 0 in desktop WebKit. The `sr-ios-app` leg shows only the class's effect with zero insets, and the app's own platform checks stayed on "web", so iOS-only rules that depend on them (the 300 px Map Explorer floor) were not exercised.
- **Android insets** beyond the one assumed pair (top 32 px, bottom 24 px), and only for finding A.
- **Text scales other than 100%**, the dark theme, landscape, and widths other than 390 and 320.
- **The with-key state.** Page lengths with keys saved differ (the Weather tab loses two notices above the picker), and the Statistics exotic check did not run.
- **Species Detail's Heatmap view for finding B** (it was measured for finding A; it shares the Pins view's container).
- **Flings, diagonal and horizontal swipes, double tap, long press, the Weather pin's tap and drag, map popups, the share popup, the Map Explorer's filter sheet and the More sheet.**
- **Paint order by pixel for section 4.2's partial covers.** They are rect overlaps with a bar shown to be opaque and on top in section 3.
- **Other backups.** Page lengths, the number of pins and the lists' scroll ranges depend on the data; one species was used on Species Detail.

## 7. Aside, not part of this change

On first load against the scratch copy, the cached map style document asked for its glyphs and sprite from `127.0.0.1:1621`, the origin it had been saved under in an earlier preview, and 9 requests failed (nothing listens there) before the app refreshed the style. The maps drew. It may be worth a look for web/Pi installs whose address changes; it has nothing to do with scrolling.
