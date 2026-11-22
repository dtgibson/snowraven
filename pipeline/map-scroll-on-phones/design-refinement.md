# Design Refinement: Map Scroll on Phones

Improve lane, Stage 2 of 7. Written hands-off by The Designer on 2026-11-21 from `change-brief.md` (with its addendum), `decisions.md` D-01 to D-06, `baseline-measurements.md`, and the Family Tree run's settled phone form (its D-17 to D-20). The mockup is `design.html` in this folder; the pictures of it are in `design-shots/`. Decisions made here are D-07 to D-19 in `decisions.md`. Nothing in `frontend/`, `docs/` or `pipeline/design-system.md` was edited at this stage.

The mockup takes `?view=species|statistics|named|weather|hotspot|explorer|lists|all`, `&viewport=390|320`, `&theme=light|dark`, `&scale=1|2`, `&ios=1`, and `&state=today|today-open|page|open` for one frame with no page around it (`&list=hsr|apop&kbd=1` with `view=lists`).

## Visual Direction

Designed inside `pipeline/design-system.md`: quiet utility, one accent, no new token, no new dependency. On the phone tier a map in the page is a still of the real map with one accent button under it, and the map is used in fullscreen, where the bottom bar is gone and the exit carries its word. It is the Family Tree's phone form applied to maps: same opener, same helper line, same glyphs, same "Exit".

## The phone tier, stated once

"The phone tier" in this document is the media query `(max-width: 640px)`, the one `lib/useIsPhone.ts` and the established CSS block both read. It is a width test and nothing else, so a desktop browser window zoomed until it is 640 CSS px wide or less gets the same bar, the same still and the same fullscreen as a phone. In-app Text size does not move it. A phone in landscape is wider than 640 px and leaves the tier (D-16).

Above the tier the build matches HEAD, with three recorded exceptions that are not visible there: the map hosts gain one wrapper element at 100% height, the Weather picker's inline size becomes a class with the same values, and the species picker's inline `maxHeight` becomes a class with the same value.

## Screens / Views

### The pattern (applies to every surface below)

**In the page: the still.**

- It is the same `<SnowMap>`, mounted where it always was. Nothing is remounted, portaled, replaced by a picture or animated. Pins, heatmap, shading, base map, centre, zoom, an open popup and a dropped share pin are whatever they were.
- The host wraps its map subtree in one element, `.sr-map-still-body` (`height: 100%`), and sets `inert` on it while still. The host container carries `MAP_STILL_CLASS` (`sr-map-still`) while still.
- A swipe that starts on the still moves the page. The wrapper takes no pointer (`pointer-events: none`, with `inert` as the second arm), so a touch on it is a touch on the container, whose `touch-action` is `manipulation`.
- A press anywhere on the still opens the map in fullscreen (`onClick={fs.still ? fs.open : undefined}` on the container). A press on a pin opens the map too; the pin is chosen in fullscreen (D-08).
- Not drawn on the still, because none of it can be pressed there: the zoom buttons, the base map switcher, the corner row (share pin, fullscreen disc), the cooperative-gestures hint, the picker's instruction.
- Drawn on the still: the map credits, **open** (the text, not only the "i"), whatever state the control was left in. The "i" cannot be pressed on a still, so a collapsed credit would be an unreadable one (D-17).
- The still is not a tab stop. While still, the container is `role="img"` with the surface's name (table below); the real control is the button under it.
- The still keeps the surface's shipped phone height. No height changes on the six surfaces except the Map Explorer's floor (D-14).

**Under the still: the opener row** (`.sr-fs-open-row`, one register for the maps and the Family Tree).

- A full-width accent button through the `Button` primitive, `sr-btn-accent sr-fs-open-btn sr-touch-target`: `Maximize2` glyph (15 px at 1x, sized in rem by its own class `.sr-fs-open-glyph`), then the label. Min height 2.75rem (44 px; 88 px at 200%). Radius 8 px, 0.875rem / 600, as the Family Tree's approved button.
- One helper line under it, `.sr-fs-open-note`, 0.75rem muted, wired to the button with `aria-describedby`.
- The row is a sibling **after** the container, outside the box that expands, and it is in the layout from the first frame the container is, so nothing shifts when a lazy map chunk arrives. It stays mounted while the map is expanded (it is behind the panel and outside the trap), so focus has somewhere to return to.
- Rendered only while the tier matches. Its hover look is inside `@media (hover: hover)`. The shared `.sr-btn-accent:hover` rule is not gated at HEAD and is left alone (gating it would change every accent button on a touch tablet); the opener cancels it for itself (`.sr-fs-open-btn:hover` restates the resting background and no shadow) and restates the hover inside the gate, with the cancel written after `.sr-btn-accent:hover` in source.

**Opened: fullscreen on the phone tier.**

- The class swap that exists today: `MAP_FS_PANEL_CLASS` on the host's own container. Panel geometry, level (`z-index: 1200`), opaque ground, dropped border and radius, top and side insets: unchanged.
- The bottom bar is not painted, not hit-tested, not focusable and not in the accessibility tree while any panel is expanded (D-07). Its box stays, so `--sr-navbar-h` and the page behind do not move.
- The corner row, bottom right: the share pin (where the surface has one), then **Exit**: the same button and `Minimize2` glyph as today, now a pill carrying the word "Exit" (0.875rem / 600). Accessible name unchanged, "Exit fullscreen". Both controls are 2.75rem tall, the Named Birds card's compact pair included (D-10).
- The row stands at `bottom: calc(20px + 3rem)` plus the bottom inset, so the open credits (bottom left, up to two lines at 100%) and the two buttons never share a band. Measured in the mockup: 34 px clear at 390 x 844, 18 px at 320 x 568, 2 px at 320 x 568 and 200% text.
- Zoom (top left), the base map switcher (top right, where the surface has one) and the credits (bottom left) are where they are today. One-finger pan, pinch and the scroll wheel belong to the map, as today (`MapCornerControls` already releases the in-page posture while expanded and restores what it captured).
- Exit and Escape leave it. The map keeps place, zoom, view, selection and pin. The page is where it was (the hook restores the scroll offset it recorded, D-11) and focus is on the opener.
- No scrim, no animation or transform on the panel. The corner row's 150 ms entrance is the only motion, as today.

### Per-surface table

Heights are the in-page phone heights at HEAD, unchanged. "Row" is the corner row while expanded on the phone tier. Tap targets are at 100% text; all are in rem and double at 200%.

| Surface | Container (base class) | Still height | Drawn on the still | Opener label / helper line | Row while expanded | Still `role="img"` name |
|---|---|---|---|---|---|---|
| Species Detail, Sighting Locations (Pins and Heatmap, one container, one state) | `.sr-map-container` | 300 px | pins or heatmap as last left, credits | `Open the map` / `It opens in fullscreen, where it pans and zooms.` | share pin 44 x 44, Exit 44 tall (80 wide) | `Map showing sighting locations` |
| Statistics, Geographic Stats | `.sr-geo-map` | 320 px (318 inside its border) | county shading and pins as last left, credits | same | share pin 44 x 44, Exit 44 tall | `Map showing Geographic Stats` |
| Named Birds, the open card | `.sr-named-map` | 220 px (218) | the bird's pins, credits | same | share pin 44 x 44, Exit 44 tall (the card's 40 px density does not apply while expanded) | `Map showing this bird’s sightings` |
| Weather, Plan location picker | new `.sr-wx-pick-map` (lifted from the inline style, same values: `clamp(180px, 28vw, 280px)`, radius 9, 1 px `--sr-border-input`, clip) | 180 px | the chosen place and its pin, or the opening view with no pin; credits | `Open the map` / `Open the map to drop a pin, or type coordinates below.` | Exit only | `Map showing the chosen place` |
| Hotspot Reports, the report's map | `.sr-hsr-map` | 200 px | the one pin, credits | `Open the map` / `It opens in fullscreen, where it pans and zooms.` | Exit only | `mapLabel(name)` (`Map showing {name}`, as today) |
| Map Explorer | `.sr-map-explorer-panel` (its own App-level fullscreen) | the panel on its 300 px floor, less the opener | only when the window cannot hold the panel: the map as last left, credits | `Open the map`, helper line present for assistive tech only (`.sr-only`) | unchanged: the cluster's three discs, icon-only | `Map` |

Surface notes:

- **Species Detail.** The Pins / Heatmap switch and the intensity slider sit beside the map, stay on the page, and change the still, because the still is the live map. The switch replaces the toggle element inside the map; `registerToggle` already handles that.
- **Statistics.** At HEAD this map takes a one-finger swipe from the page (cooperative gestures off). As a still it cannot. County popups open in fullscreen only. The metric switch beside the map stays on the page and redraws the still.
- **Named Birds.** One card is open at a time, so one still and one opener. The opener row sits inside the card, directly under the map, above the sightings list.
- **Weather picker (D-12).** The place search and the Latitude and Longitude fields stay on the page and complete the picker without the map, so keyboard and screen-reader users lose nothing. In fullscreen a tap drops the pin and the pin drags, exactly as today. A statement at the top centre (`.sr-map-note`, takes no pointer, anchored left and right with its child centred, plain text and not a live region) reads `Tap the map to drop a pin.` with no pin and `Drag the pin to fine-tune. Exit when it is in place.` with one. The page's helper line under the map is replaced on the phone tier by the opener's helper line; above the tier it stays `Tap the map to drop a pin, drag to fine-tune, or type coordinates below.` A pick makes the same requests it makes today.
- **Hotspot Reports (D-13).** Above the tier it is the plain map it was designed as: no corner row, no fullscreen. On the tier it is a still with the opener, and its fullscreen has Exit, zoom and the credits and nothing else (no share pin, no switcher, no popup).
- **Map Explorer (D-14).** It stays live in the page wherever its panel fits the window, which is every measured configuration at 100% text once the phone-tier floor is 300 px on every platform (it was 340 px outside the iPhone app; at 320 x 568 that removes the measured 35 px of page scroll). Where the window still cannot hold the panel (the panel is on its floor: a small phone at large text), the map is a still with the opener inside the panel, the cluster, switcher and zoom are not drawn, and opening it uses the tab's own fullscreen through `onToggleFullscreen`. Its exit stays the icon-only disc: three discs have 4 px of slack at 320 px and 200% text, so the word is withheld there (v0.5.84).

### How each surface reads with nothing to show

- Species Detail with no coordinates, a Named Bird with none, a Hotspot Reports place with none: no map is mounted (the callers already gate on it), so there is no still and no opener. Unchanged.
- Statistics before a backup is loaded: the tab's own setup state, no map. Unchanged.
- Weather with no place chosen: the still shows the opening view with no pin; the opener and its helper line are the same.
- A map still loading (the Suspense fallback or the `mapReady` placeholder twin): the container shows its loading ground and the opener is already there. Pressing it opens the panel on that ground and the map arrives there.

### The dropdown lists (D-15)

Phone tier only. Five lists: Hotspot Reports' picker (`.sr-hsr-list`), Life Lists' region picker (`.sr-lfl-region-list`), Targets' county picker (`.sr-tg-combo-list`), the shared species picker (`.sr-combobox-list`), and Targets' "Measure distances from" chooser (`.sr-tg-apop` with `.sr-tg-apop-list` inside it).

- Each list still opens under its field. Its height is the smaller of its own cap and the room actually visible under the field: down to the top of the bottom bar, or to the top of the on-screen keyboard when it is up, less 8 px.
- When that room is shorter than the list wants, opening first brings the field to the top of the visible area (an instant `scrollIntoView({ block: 'start' })` against a `scroll-margin-top` of 8 px plus the top inset), then measures.
- When there is not enough room either way, the list keeps a floor of one and a half option rows, so one whole row and the top of the next always show. The floor is measured from the first option, so it follows text size.
- The Targets chooser becomes **one scroller** on the phone tier: the chooser takes the measured room and scrolls as a whole, and its inner list is released (`max-height: none; overflow: visible`). It was 465.5 px tall with a second scroller inside it.
- `.sr-tg-combo-list` and `.sr-combobox-list` gain `overscroll-behavior: contain` on the phone tier, so a swipe that reaches the end of the list is not handed to the page. The other three have it.
- The page is not locked while a list is open, as today. A page scroll the user makes with a list open moves the list with its field, as today; the cap is re-measured when the visible area changes (keyboard up or down, rotation), not on page scroll.

## Component Usage

- `components/ui/Button.tsx` for the opener, with `sr-btn-accent`. No new visual register beyond `.sr-fs-open-*`.
- A small shared component is suggested, `components/ui/FsOpenRow.tsx`: `<FsOpenRow fs={fs} label note noteHidden? />`. It renders nothing unless `fs.stillTier`, registers its button through `fs.registerOpener`, calls `fs.open`, and owns the `aria-describedby` id (from one `useId`). It must be entry-safe (`NamedBirdRow.tsx` and `WeatherForecastPanel.tsx` are on the entry graph): `Button`, `lucide-react`'s `Maximize2`, nothing map-side.
- `components/map/MapCornerControls.tsx`: gains a required `share: boolean` (false on Weather and Hotspot Reports) and a required `fsOnly: boolean` (true on those two, adding `sr-map-corner-row--fs-only`), and renders `<span className="sr-map-exit-label">Exit</span>` after the glyph inside the toggle. The glyph keeps its rem sizing through `--sr-fab-glyph`. It stays off the entry chunk; `PredictMap.tsx` and `HotspotReportMap.tsx` (both lazy) become its fourth and fifth importers.
- `lib/useMapFullscreen.ts`: the API below. New hosts: the Weather Plan panel and the Hotspot Reports report. Each new host's tab panel is wrapped in `MapTabShowingProvider` in `App.tsx`, and `paletteLocationsRoute.test.ts` gains both.
- `MapExplorer.tsx` uses `FsOpenRow`'s markup with its own state (it does not use the hook); `lib/mapPanelChrome.ts` reports whether the panel is on its floor.

### The hook API (additive; nothing is renamed)

Unchanged, and relied on by the Family Tree: `useMapFullscreen({ containerRef, baseClass, active?, resetKey? })`, `MAP_FS_PANEL_CLASS`, `mapFullscreenClass`, `MapFullscreenProvider`, `useMapFullscreenContext`, `MapTabShowingProvider`, and on the returned object `expanded`, `toggle`, `collapse`, `className`, `registerToggle`. `className` stays exactly `baseClass` plus the expanded class. The `.sr-map-fullscreen-btn` selector in `focusToggle` stays an optional last resort, never a requirement.

Added to the returned object:

| Member | Meaning |
|---|---|
| `stillTier: boolean` | The phone-tier media query matches (the hook reads `useIsPhone()`). The opener row renders on this. |
| `still: boolean` | `stillTier && !expanded`. The page shows the still. |
| `open: () => void` | Expand, idempotent (a second press while opening does not close it). Stamps the current `resetKey` like `toggle`. |
| `registerOpener: (el: HTMLButtonElement \| null) => void` | The opener button now rendering, held as state with the same detach rule as `registerToggle`. |
| `hostClassName: string` | `className`, plus `MAP_STILL_CLASS` while `still`. Map hosts put this on the container; a consumer that draws its own still can keep using `className`. |

Added exports: `MAP_STILL_CLASS = 'sr-map-still'`.

Behaviour the hook owns, so every consumer gets it:

1. **The bar signal (D-07).** While `expanded`, `document.documentElement` carries `data-sr-fs-open`. Set and removed in a layout effect (before paint, so the bar is never drawn over the panel for a frame), counted at module scope so two consumers cannot clear each other's. The stylesheet does the rest: `:root[data-sr-fs-open] .sr-navbar { visibility: hidden; }`. The hook does not know whether a bar exists, and nothing in script tests a width for this.
2. **Focus on open.** After the expanded commit, if focus is outside the container, it goes to the registered toggle (Exit), read back from `document.activeElement`. A consumer that wants another landing focuses it in its own effect declared after the hook call; the last focus wins.
3. **Focus on exit.** After the collapsed commit (an effect, never at close time: the trap is still armed until then), for a user exit only (the toggle, Escape, `collapse()`): the opener if it is registered, connected and rendered; else the toggle; else the fallback selector. Each attempt is read back and falls through if focus is on `<body>`. A collapse caused by leaving the tab, by `active` dropping or by `resetKey` changing moves no focus, as today.
4. **The page's place.** The scroll-lock effect records `window.scrollY` when it locks and, for a user exit only, restores it after it releases. (The container leaves the flow while expanded, so a page near its end can be clamped.)
5. **The trap.** `useFocusTrap(expanded, containerRef, { containOutsideFocus: true })`, unchanged. `expanded` is the condition that makes the surface modal on every tier (a fixed, opaque, window-filling panel), so the arming expression is that condition (v1.0.20). The still and the opener arm nothing.
6. Escape (bubble phase), the body scroll lock, the collapse on leaving the tab: unchanged.

What a consumer such as the Family Tree gets for free: all six points, the panel class with its insets, and the bar. What it passes or does: `containerRef` and `baseClass`; `registerToggle` on its exit control and `registerOpener` on its opener (registering the opener through `registerToggle` also still works, with focus returning to it as today); `open` on its still and opener; its tab panel wrapped in `MapTabShowingProvider`. It needs no `z-index`, no bar handling and no phone-width test.

### The entry-chunk constraint

`lib/useMapFullscreen.ts` is on the entry chunk and may import only `react`, `./useFocusTrap` and, new, `./useIsPhone` (itself `react` only, and already on the entry chunk through `App.tsx`). `lib/mapFullscreenEntrySafe.test.ts` pins the list and is edited in the same change. The bar signal adds no import and no store: one attribute and one CSS rule. If `./useIsPhone` cannot be admitted, the host passes the tier in as an option and the hook imports nothing new; the returned API is the same.

## Design Tokens Applied

No token is added or changed. Used: `--sr-accent`, `--sr-accent-strong`, `--sr-on-accent` (opener); `--sr-text-muted` (helper line); `--sr-surface`, `--sr-border`, `--sr-text` (the Exit pill, through `.sr-map-fab`); `--sr-bg` (panel ground, unchanged); the picker's instruction takes the surface and ink of the map's existing top-centre statement chip (the loading chip), so it adds no color.

Stylesheet shape (all phone-tier rules go **inside** the established `@media (max-width: 640px)` block; each `.sr-ios-app` rule has its `.sr-android-app` twin):

```css
/* top level */
.sr-map-still-body { height: 100%; }
.sr-wx-pick-map { height: clamp(180px, 28vw, 280px); width: 100%; border-radius: 9px; overflow: hidden; border: 1px solid var(--sr-border-input); } /* above .sr-map-fs-panel in source */
.sr-fs-open-row { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; }
.sr-fs-open-btn { width: 100%; gap: 8px; padding: 8px 16px; border-radius: 8px; font-size: 0.875rem; }
.sr-fs-open-btn:hover { background: var(--sr-accent); box-shadow: none; } /* after .sr-btn-accent:hover */
@media (hover: hover) { .sr-fs-open-btn:hover { background: var(--sr-accent-strong); } }
.sr-fs-open-glyph { flex: none; width: 0.9375rem; height: 0.9375rem; }
.sr-fs-open-note { margin: 0; font-size: 0.75rem; line-height: 1.45; color: var(--sr-text-muted); }
.sr-map-exit-label { display: none; }
.sr-map-corner-row--fs-only { display: none; }
.sr-map-fs-panel .sr-map-corner-row--fs-only { display: flex; }
:root[data-sr-fs-open] .sr-navbar { visibility: hidden; }
.sr-combobox-list { max-height: 260px; } /* was inline */

/* inside the 640 px tier */
.sr-map-still { cursor: pointer; touch-action: manipulation; -webkit-touch-callout: none; user-select: none; }
.sr-map-still > .sr-map-still-body { pointer-events: none; }
.sr-map-still :is(.maplibregl-ctrl-top-left, .maplibregl-ctrl-top-right, .sr-map-corner-row, .sr-map-note, .maplibregl-cooperative-gesture-screen) { display: none; }
/* credits open on the still: must out-rank maplibre-gl.css, which loads later (maps.md v1.0.5) */
.sr-map-fs-panel .sr-map-fab--compact { --sr-fab-glyph: 1.0625rem; width: 2.75rem; height: 2.75rem; }
.sr-map-fs-panel .sr-map-fullscreen-btn { width: auto; min-width: 2.75rem; padding: 0 16px 0 13px; gap: 7px; }
.sr-map-fs-panel .sr-map-exit-label { display: inline; font-size: 0.875rem; font-weight: 600; }
.sr-map-fs-panel .sr-map-corner-row,
.sr-map-fs-panel .sr-map-corner-row--compact { bottom: calc(20px + 3rem); right: 16px; max-width: calc(100% - 32px); }
.sr-map-explorer-panel { min-height: 300px; }
.sr-hsr-list { max-height: min(20rem, var(--sr-list-fit, 20rem)); }
.sr-lfl-region-list { max-height: min(18rem, var(--sr-list-fit, 18rem)); }
.sr-tg-combo-list { max-height: min(17rem, var(--sr-list-fit, 17rem)); overscroll-behavior: contain; }
.sr-combobox-list { max-height: min(260px, var(--sr-list-fit, 260px)); overscroll-behavior: contain; }
.sr-tg-apop { max-height: var(--sr-list-fit, none); overflow-y: auto; overscroll-behavior: contain; }
.sr-tg-apop .sr-tg-apop-list { max-height: none; overflow: visible; }
```

Cascade notes for the build:

- The switcher is the app's own element, not a maplibre control: add its class to the still's hide list.
- The corner row's phone-tier offset rule and the two existing `.sr-ios-app` / `.sr-android-app` expanded-row rules set the same property; in the tier the inset twins become `calc(20px + 3rem + inset)` for both the standard and the compact row. Resolve them as a cascade in `mapFullscreenPanelCss.test.ts`, not by presence.
- The Exit pill's `width: auto` must beat `.sr-map-fab--std`'s width in the tier block (both one or two classes deep, the tier block is last): pin the resolved width, and keep `mapFabCascade.test.ts` green (no rule ends in a bare `svg`).
- Any phone-tier height rule on a map host is scoped `:not(.sr-map-fs-panel)` (maps.md trap a). The mockup hit exactly this on the Weather picker before the scope was added.
- `visibility: hidden` on the bar is undone by any descendant that sets `visibility: visible`: a stylesheet guard should assert none does.
- The dark theme's accent hover is `[data-theme="dark"] .sr-btn-accent:hover` at (0,3,0), which out-ranks a plain `.sr-fs-open-btn:hover`; the opener's cancel needs its dark twin at the same weight. Verify the resting look after a real tap in WebKit, both themes (ui.md v1.0.65).

## Interaction Notes

- **Order of focus on a page with a still:** whatever precedes the map, then the controls beside it (Pins / Heatmap), then `Open the map`, then what follows. The still and everything in it are skipped.
- **Order of focus in fullscreen:** inside the container only, in DOM order as today (switcher, zoom, credits, markers, popup, share pin, Exit). Focus arrives on Exit.
- **Leaving the tier with a map open** (a phone rotated to landscape, a window widened): the map stays open, because expanded is not a tier state. There is no bar above the tier. Exit there returns focus to the corner toggle, since the opener is not rendered.
- **Leaving the tier with the still showing:** the still becomes the live in-page map of HEAD and the opener row goes. No focus is moved; the user changed the viewport, not a control.
- **Search (Cmd-K or Ctrl-K) over an open map:** unchanged. It opens above the panel, owns focus while it is up, and a destination on another tab collapses the map through the tab-showing input, which removes the attribute and brings the bar back.
- **The More sheet (1260):** cannot be opened while a panel is expanded, because its button is in the bar. It keeps its level.
- **Safe areas:** the panel pads top, left and right as today. The corner row adds the bottom inset to its lifted offset. The credits in an expanded panel also take the bottom inset (`.sr-ios-app .sr-map-fs-panel .maplibregl-ctrl-bottom-left`, with the Android twin), **if** the simulator shows them inside the home-indicator band at HEAD; if they are already clear, omit the rule and record the reading (D-17).
- **The list fit helper** (suggested `lib/useListFit.ts`, `useListFit(open, anchorEl, listEl)`): a no-op unless the tier matches. On open, in a layout effect: visible bottom = the smaller of `visualViewport.offsetTop + visualViewport.height` and the top of `.sr-navbar` when it is rendered and visible; room = visible bottom less the list's top less 8 px; if room is under what the list wants, `anchorEl.scrollIntoView({ block: 'start' })` once, measure again; write `--sr-list-fit` in px on the list from the effect (no state); floor at 1.5 times the first option's height plus the list's padding; re-measure on `visualViewport` `resize` and `scroll` while open, one per frame; remove the property and the listeners on close. Elements are passed as state, not ref objects (ui.md v1.0.17). This is a geometry measurement while a list is open, not a breakpoint, which is why it does not fall under the no-resize-listener rule; say so at its definition.
- **Map Explorer's "cannot fit" reading:** from `lib/mapPanelChrome.ts`, as a boolean that changes state only when it flips. The reading must not be movable by what it decides: the opener row lives inside the panel's fixed height, and the panel's height comes from the window and the chrome around it, never from its content. Reading "the panel's rendered height equals its floor" is one acceptable form.

## Motion Spec

- Fullscreen panel, open and exit: none, instant, no transform, no fade (unchanged; a transform on the panel is forbidden), CSS.
- Corner row on open: `cubic-bezier(0.16, 1, 0.3, 1)`, 150 ms, translate 6 px up into place with a fade, origin its own corner, reduced motion collapses it through the global block (unchanged), CSS.
- Bottom bar while a panel is open: none, `visibility` is not transitioned (Android's 160 ms `transform` transition on the bar is untouched and not triggered), CSS.
- Opener button hover: ease-out, 120 ms, background only, inside `@media (hover: hover)`, reduced motion through the global block, CSS.
- Opener row and still appearing or leaving on a tier change: none, CSS.
- Dropdown list on open: `cubic-bezier(0.2, 0, 0, 1)`, 140 ms, scale from the field's top edge (unchanged), reduced motion through the global block, CSS.
- Field brought to the top before a list opens: none, an instant scroll (`behavior: 'auto'`), so the measurement that follows is exact and reduced motion needs no branch, DOM.
- Weather pin after a pick: the existing `flyTo`, unchanged by this design.

## Content Notes

Plain register, no em dashes, "fullscreen" as one word as the shipped names have it. Exact in-app strings:

| Where | String |
|---|---|
| Opener label, every map | `Open the map` |
| Opener helper line (Species Detail, Statistics, Named Birds, Hotspot Reports, Map Explorer) | `It opens in fullscreen, where it pans and zooms.` |
| Opener helper line, Weather picker | `Open the map to drop a pin, or type coordinates below.` |
| Exit, visible word (phone tier, embedded maps) | `Exit` |
| Exit, accessible name (unchanged) | `Exit fullscreen` |
| Weather fullscreen, no pin | `Tap the map to drop a pin.` |
| Weather fullscreen, pin placed | `Drag the pin to fine-tune. Exit when it is in place.` |
| Still names | as in the per-surface table |

The Family Tree's strings are the same family: `Open the tree` / `It opens in fullscreen, where it scrolls and zooms on its own.` / `Exit`.

Put the new strings in a copy module (for example `lib/mapStillCopy.ts`) so the em-dash and agreement sweeps reach them.

**Proposed `docs/HELP.md` text** (for the Engineer to place; in-app help needs no approval stop):

- New short section near the map tabs: "**Maps on a phone.** On a phone, a map inside a page is shown as you left it and does not move, so swiping over it scrolls the page. Press the map, or **Open the map**, to use it in fullscreen, where it pans and zooms. **Exit**, at the bottom right, brings you back; the map keeps its place, its zoom and any pin you picked. The tab bar at the bottom is hidden while a map is open."
- Weather, Plan: "On a phone, open the map to drop the pin. The place search and the coordinate fields work without opening it."
- Hotspot Reports, Map (amending the "plain map" paragraph): "On a phone the map opens in fullscreen like the other maps. On larger screens it has no fullscreen button."
- Map Explorer, the paragraph on the narrowest phones at larger text sizes: "Where the window is too short to hold the whole map, the map is shown as a still with **Open the map** under it."

**`ACCESSIBILITY.md`** must stay true. Claims that change: the sentence family on focus and maps gains "On a phone, a map inside a page is not interactive until it is opened in fullscreen; the Open the map button is the keyboard and screen-reader route, focus moves to Exit when the map opens and returns to the button when it closes"; and any sentence saying the embedded maps' fullscreen toggle is in the map corner is scoped to screens wider than a phone.

**Design system** (to be recorded at the end of the run, not edited now): the "Map fullscreen" pattern gains a phone-tier paragraph (still, opener register, Exit with its word, lifted row, bar hidden through the hook's attribute), and its clause "does not gain a label, and does not change size on expanding" is scoped to tiers where the toggle is the control that was pressed to expand (D-10). "A map that is a location input gets no row at all" becomes "no row in the page; Exit only while expanded on the phone tier".

## What the Tester measures

All in Chromium and WebKit at 390 x 844 and 320 x 568, at 100% and 200% text, light and dark, by pixel sampling and real taps where the claim is about paint or touch, not `elementFromPoint` alone. Then the iOS simulator and the Android emulator for what the desktop engines cannot show.

The pattern, on each of the six surfaces:

1. A one-finger swipe that starts on the still moves the page by the travel less the slop, with the map whole, lower half hidden and upper half hidden, and moves the map 0 px. Two fingers and a pinch on the still also leave the map unmoved.
2. **WebKit page movement under touch, unmeasured at baseline:** the same swipe in the iOS simulator (a real touch drag), since Playwright's WebKit cannot synthesize one.
3. A tap on the still, on a pin in the still and on the opener each open the panel; a second quick tap does not close it.
4. On the still: zoom, switcher, corner row and hint are not painted; the credits' text is painted and legible (contrast and ink, both themes) even after the control was collapsed in fullscreen; nothing in the still is in the tab order or the engine's accessibility tree (Chromium `Accessibility.getFullAXTree`, since `ariaSnapshot()` does not honor `inert`); the container reads as an image with its name.
5. Expanded: the bar's region matches the bar-hidden picture pixel for pixel; a real tap at the centre of Exit exits and at the centre of the share pin drops a pin, in every pair that failed at baseline (24 of 24); Exit's box is whole inside the window and at least 44 x 44 px, 88 px tall at 200%; the row's box and the open credits' box do not intersect at 100% text at both sizes (record the 200% reading; the mockup's is 2 px clear at 320 x 568); the bar takes no tap, no Tab stop and is absent from the accessibility tree while hidden, and is back, unmoved, after exit.
6. Round trip: centre, zoom, base map, Pins or Heatmap, an open popup, a dropped share pin and the Weather pin are identical before open and after exit; the MapLibre instance is the same object; `window.scrollY` is identical, including with the page at its maximum scroll.
7. Focus: on Exit after opening (after a real Tab press, both engines), on the opener after Exit and after Escape; Tab does not leave the panel in WebKit's default tab mode; after a Search route to another tab the bar is back and the scroll lock is released.
8. No frame with the bar painted over the panel on open (a screenshot taken in the same task as the click, or a `requestAnimationFrame` capture).
9. Above 640 px, at 641 px and at a desktop width: rendered output equals HEAD on all six surfaces and all five lists (pixel comparison against the baseline build), and no opener, still class or `inert` is present.
10. **Landscape, unmeasured at baseline:** at 844 x 390 and 667 x 375, record what each embedded map does (it is HEAD: live in the page, corner toggle, no bar) and whether each map can be wholly in view. This is evidence for D-16, not a pass or fail.
11. A window at 640 px and 641 px wide on desktop engines: the still, the opener and the bar appear and go together at the same pixel.
12. Rotating or widening with a map open: it stays open, Exit works, focus lands on the corner toggle.

Per surface:

13. Weather: in fullscreen a tap drops the pin and a drag moves it; the Latitude and Longitude fields show the pick after exit; the picker can be completed with the place search and the two fields alone, by keyboard, with the map never opened; the request count for one pick equals HEAD's.
14. Hotspot Reports: above the tier no corner row and no opener; on the tier, fullscreen shows Exit, zoom and credits only.
15. Map Explorer: page scroll range is 0 at 390 x 844 and at 320 x 568 at 100% text, in the web build and with each app class; at each of the four shipped text scales at both sizes, either the scroll range is 0 or the map is a still with the opener (never a live map over a scrolling page); the cluster's fit at 320 px and 200% is unchanged (4 px of slack); the FAB cluster clears the bar at 200% text (unmeasured at baseline).
16. Named Birds: expanded, both row controls are 44 px; in the card, the opener sits inside the card and the card's height grows by the row only.

Dropdown lists:

17. With the field as low as its page allows, at 320 x 568 and 390 x 844: 0 px of each list is below the window or under the bar; the Targets chooser has exactly one scrolling element; a swipe at the end of each of the five lists moves the page 0 px.
18. **The on-screen keyboard, unmeasured at baseline:** in the iOS simulator (software keyboard shown) and the Android emulator, for the four lists that belong to text fields and for the chooser's search field: with the keyboard up, the list's bottom edge is at or above the keyboard's top, at least one and a half rows show, the field itself is visible, the active option stays in view while typing and arrowing, and dismissing the keyboard re-grows the list. Record `visualViewport.height` and `offsetTop` beside each reading.
19. The species picker in its other two hosts (Calendar, the Map Explorer filter sheet) keeps its list inside the visible area and inside the sheet.
20. `document.scrollWidth` equals the window width with each list open at 320 px and 200%.

Unmeasured at baseline, to be read in the simulator and emulator: in-app safe-area insets (Exit, the share pin and the credits clear of the home indicator and the rounded corners; the panel clear of the status bar and the Dynamic Island); the Android gesture or back key with a map open (record what happens; none is designed here); dark theme on every state; 200% text on every state.
