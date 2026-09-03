# PRD — Map Fullscreen Toggle (embedded maps)
**Feature:** map-fullscreen-toggle
**Date:** 2026-09-02
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A fullscreen toggle on the app's three embedded maps (Species Detail's Sighting Locations, the Named Birds per-individual card map, and Statistics' Geographic Stats map), expanding the map from its in-flow box to fill the window and collapsing it back. It is the same live map instance enlarged by a CSS change to its container, never a second map: pins, base layer, viewport, open popup, county overlay and dropped share pin all carry across in both directions.

### The four map mounts in scope

The three surfaces are four `<SnowMap>` mounts. Every requirement below that says "each in-scope map" means all four.

| Mount | Surface | Component | Container | FAB size |
|---|---|---|---|---|
| M1 | Species Detail → Sighting Locations, Pins branch | shared `SightingsMap` | `.sr-map-container` (380px, 300px ≤640) | `--std` |
| M2 | Species Detail → Sighting Locations, Heatmap branch | inline `SnowMap` in `SpeciesDetail.tsx` | the same `.sr-map-container` | `--std` |
| M3 | Named Birds → per-individual card map | shared `SightingsMap` (`switcher={false} compact`) | `.sr-named-map` (220px) | `--compact` |
| M4 | Statistics → Geographic Stats | inline `SnowMap` in `BirdingStats.tsx` | inline 320px box | `--std` |

M1 and M2 are two branches inside one container, so they share one fullscreen state (FR-12). The Map Explorer's shipped fullscreen is out of scope and unchanged.

---

## User Stories

> **US-01** — As a birder reading a Named Birds card, I want to press one button on the 220px card map, so that the map answering "where has this individual been seen" fills my window instead of a strip.

> **US-02** — As a birder on Species Detail with a continental spread of pins, I want to expand the Sighting Locations map with a popup already open and a share pin already dropped, so that I keep everything I had set up and just get more room to read it.

> **US-03** — As a birder on the Statistics geographic map, I want to expand the 320px box holding twenty ranked pins, so that I can tell overlapping locations apart without leaving the tab.

> **US-04** — As a birder who switches Species Detail between Pins and Heatmap, I want the fullscreen button in both modes, so that the feature does not silently vanish when I change how the map draws.

> **US-05** — As a keyboard user, I want Escape to exit fullscreen and put focus back on the button I pressed, and Tab to stay inside the expanded map while it is open, so that I am never dropped onto a page I cannot see.

> **US-06** — As someone on an iPhone at 200% text size, I want the expanded map's controls clear of the status bar and Dynamic Island in both rotations and every control still reachable at 320px, so that the largest view of the map is also the most usable one.

---

## Functional Requirements

### A. The control

> **FR-01** — Each in-scope map (M1, M2, M3, M4) shall render a fullscreen toggle button on the map surface.

> **FR-02** — The toggle shall use the shipped Map Explorer control vocabulary exactly: a `<button type="button">` carrying `.sr-map-fab` plus a size modifier and the `.sr-map-fullscreen-btn` state hook, a lucide `Maximize2` glyph when collapsed and `Minimize2` when expanded, `aria-label` "Enter fullscreen" when collapsed and "Exit fullscreen" when expanded, and `aria-pressed` reflecting the expanded state.

> **FR-03** — The toggle shall sit in the map's bottom-right corner in a single row with the share-pin drop button, in DOM order share button first then fullscreen toggle, matching Map Explorer's left-to-right order. The row's visual order shall equal its DOM order: a slot wrapper, if one is used, is `display: contents`, and the CSS `order` property shall not be used to arrange the row.

> **FR-04** — The toggle's glyph shall be sized in rem through the `--sr-fab-glyph` custom property declared on the size modifier, following the shipped pattern (a lucide `size=` prop may remain only as the no-CSS fallback the class rule overrides). M1, M2 and M4 take `.sr-map-fab--std`; M3 takes `.sr-map-fab--compact`, matching the density its share popup and drop button already use. The size modifier shall not change when the map expands.

> **FR-05** — The toggle shall exist only where a map exists: it shall not render on Species Detail when the species has no usable coordinates, on a Named Birds card whose individual has no coordinates, or on Statistics before `mapReady` flips (the loading placeholder) or when there are no ranked pins.

> **FR-06** — No two controls on the same map shall carry the same accessible name in any state.

> **FR-07** — The capability shall be added to the shared `SightingsMap` once, so both of its callers (M1 and M3) receive it, and the two inline `SnowMap` mounts (M2, M4) shall consume the same shared control and overlay mechanism rather than each re-inlining a toggle, an overlay class, an Escape handler or a focus trap.

### B. Expanding and collapsing

> **FR-08** — Expanding shall change only the map container's CSS, to the shipped overlay geometry: `position: fixed; inset: 0; height: 100dvh; z-index: 1200`, applied through a class in `globals.css` (never an inline style, which is specificity 1,0,0 and would put the iOS safe-area inset out of reach). Collapsing shall restore the container to exactly the in-flow box it had before, including its height, border, radius and clipping.

> **FR-09** — The map shall not remount when entering or leaving fullscreen. The `<SnowMap>` element shall keep its position in the React tree, the MapLibre instance and its WebGL context shall be the same object before and after, and all of the following shall survive a round trip unchanged: map centre and zoom, the open popup and which feature it belongs to, the dropped share pin and its position and popup state, the selected base map and the Trails overlay, county overlay shading and textures state, heatmap intensity, and Statistics' ranked pin selection.

> **FR-10** — No data shall be refetched as a result of a mode change. In particular the on-demand county geometry shall be requested at most once per host mount, however many times the user expands and collapses.

> **FR-11** — The overlay shall not use a React portal, and the map's DOM node shall not be moved in the document.

> **FR-12** — Species Detail's fullscreen state shall belong to the `.sr-map-container` that wraps both branches, so switching between Pins and Heatmap while expanded stays expanded, and the toggle is present in whichever branch is rendering.

### C. Map viewport and gestures

> **FR-13** — The map shall be resized explicitly on every mode change, after the new container geometry is committed to layout, so the canvas fills the container in both directions. A resize claimed by `SnowMap`'s header comment shall not be relied on; whether react-map-gl's own observer covers this is to be confirmed by measurement, and an explicit resize shall be implemented regardless.

> **FR-14** — A mode change shall not re-frame the map. `MapBoundsFitter` (M1, M2) and `fitToPins` (M4) shall not run as a result of expanding or collapsing, and the reported centre and zoom shall be identical before and after.

> **FR-15** — While expanded, scroll-wheel zoom shall be enabled and MapLibre's cooperative-gestures mode disabled; both shall be restored to their in-flow values on collapse. This shall be driven on the live map instance (its `scrollZoom` and `cooperativeGestures` handlers), never by remounting, re-keying or re-creating the map. If neither the props nor the instance handlers can be changed without a remount, the shipped gesture behaviour shall be kept unchanged in both modes and said plainly in `docs/HELP.md`; re-creating the map to change a gesture is not an acceptable trade.

### D. Keyboard and focus

> **FR-16** — Escape shall exit fullscreen and return focus to the fullscreen toggle, on every in-scope map.

> **FR-17** — The Escape handler shall be a `document` listener in the bubble phase, armed only while that map is expanded, so an in-map overlay that owns Escape in the capture phase with `stopPropagation` (the share popup) stays the innermost dismiss layer: one Escape closes that popup, a second exits fullscreen.

> **FR-18** — While expanded, keyboard focus shall be trapped inside the overlay: Tab from the last focusable moves to the first and Shift+Tab from the first moves to the last, the focusable set is re-queried on each Tab keydown rather than cached, and no control on the page behind the overlay is reachable by Tab. Unlike the Map Explorer, the surface behind is a live page in the same panel, so the trap shall not depend on the page behind being `display: none`.

> **FR-19** — Focus restore shall survive the toggle element being replaced. Where the button that opened fullscreen has unmounted or moved (a Pins to Heatmap switch replaces the button element), focus shall land on the toggle now rendering for that map, and never on `document.body`.

> **FR-20** — `document.body` scrolling shall be locked while a map is expanded, and the lock shall be released on collapse, on unmount, and on the exits described in FR-24. The previous `overflow` value shall be restored rather than assumed.

### E. Placement, platform and teardown

> **FR-21** — `position: fixed` on the expanded container shall resolve against the viewport on all three surfaces. This shall be verified per surface (Species Detail's `SectionCard`, the Named Birds accordion row and its table, the Statistics `SectionCard`) rather than assumed: no ancestor may carry `transform`, `filter`, `backdrop-filter`, `perspective`, `contain` or `will-change` in a form that creates a containing block, including during an entrance animation.

> **FR-22** — The expanded container shall carry iOS safe-area insets matching the shipped `.sr-ios-app .sr-map-fullscreen-panel` rule: gated on `.sr-ios-app` and never a bare `env()` (the web build ships `viewport-fit=cover` too), padding rather than a smaller box, and top, left and right only.

> **FR-23** — Fullscreen state shall be session-scoped and local to each map's own subtree. Nothing shall be written to the storage seam, nothing shall be added to `App.tsx`, and no map-touching import shall become reachable from `App.tsx`'s static import graph.

> **FR-24** — Fullscreen shall exit, and its scroll lock and key handlers release, whenever the map it belongs to stops being the thing on screen: an in-map action that navigates to another tab (the Statistics county popup's open-species link), a change of the entity behind the map (a species change on Species Detail), and the host unmounting (a Named Birds accordion row collapsing).

> **FR-25** — The expanded container shall paint an opaque background from a `--sr-*` token so the page behind is never visible through the map's gutters or while the style is loading.

### F. Documentation and published statements

> **FR-26** — `docs/HELP.md` shall be updated in the same change. Its Map Explorer sentence "Every map shows the same row of three round buttons" shall be corrected so it describes the Map Explorer's row rather than every map in the app, and the three embedded maps shall get their own short description of the fullscreen button, using the house phrasing "per-session, resetting on relaunch" for its lifetime.

> **FR-27** — `README.md` and `website/` shall be updated in the same change, per the standing rule that every hand-maintained restatement of shipped behaviour moves together.

> **FR-28** — `ACCESSIBILITY.md` shall be updated so its existing sentence, "Escape also exits map fullscreen and returns focus to the fullscreen toggle, so a keyboard user is never dropped to the page body", is true of every map in the app without qualification, and so the focus trap on the embedded maps is described where the Map Explorer's is.

> **FR-29** — All user-facing copy added or changed by this feature, and every published prose surface it touches, shall contain no em dashes (U+2014).

> **FR-30** — `frontend/package.json` and `src-tauri/tauri.conf.json` shall be bumped to the same new patch version and `CHANGELOG.md` updated, per the standing versioning rule.

---

## Non-Functional Requirements

> **NFR-01 — Accessibility:** WCAG 2.1 AA holds in the expanded state at 320px width and 200% in-app text scale, in both light and dark themes. No horizontal page scroll is introduced, every control in the overlay is reachable and operable, each control's box and its rendered ink stay inside its container, and every interactive target stays at least 24x24 CSS pixels.

> **NFR-02 — Theming and layout:** every colour comes from a `var(--sr-*)` token declared in both `:root` and `[data-theme="dark"]`; no hardcoded hex or RGB in components. Layout that must respond is lifted to a class in `globals.css`, never an inline style, and any new phone-tier declaration goes inside the established `@media (max-width: 640px)` block rather than a new one ahead of it.

> **NFR-03 — Bundle:** `frontend/src/lib/entryChunk.test.ts` stays green without amendment, and the built `dist/index.html` modulepreload set gains no maplibre or county entry. Any module newly shared with a component on `App.tsx`'s static graph (for example a focus-trap helper extracted from `ModalDialog.tsx`) stays free of map imports. No new runtime dependency is added.

> **NFR-04 — Platform parity:** identical behaviour in the macOS desktop app (WKWebView), the iOS app, the Windows build, and a browser. The iOS safe-area behaviour is checked in both rotations, since the base switcher sits at `top: 8px` inside the overlay on M1, M2 and M4.

> **NFR-05 — Privacy:** no new network call, tile provider, backend route, or stored data, and therefore no `PRIVACY_POLICY.md` change. If that ceases to be true, the maps rule makes it a privacy disclosure rather than an implementation detail.

> **NFR-06 — Motion:** any transition added is CSS and is collapsed by the app's global `prefers-reduced-motion` rule. No MapLibre GL paint transition is added (GL transitions do not inherit that rule).

> **NFR-07 — No regression to the Map Explorer:** its fullscreen path, its `App.tsx` state, and its FAB cluster are untouched. The cluster's measured 4.00px of slack at 320px and 200% text scale is not spent, and its existing tests pass unchanged.

> **NFR-08 — Verification posture:** every geometric or layout claim in this PRD is settled by measuring the element against its container's content box in a real browser against the built stylesheets, in Chromium and WebKit, using the synthetic demo dataset via `SR_DATA_DIR`. Page `scrollWidth` alone is not admissible evidence.

---

## Out of Scope

- **The Map Explorer.** It already has fullscreen; this feature changes none of it, and its FAB cluster in particular is not to be touched.
- **The Weather tab's Predict picker map** (`PredictMap.tsx`). It is a location input, not a data view, and was excluded by name from the share-pin feature for the same reason.
- **The browser Fullscreen API, OS-level fullscreen, and Tauri native window fullscreen.** The overlay is CSS, for the reasons in the brief's Key Decisions.
- **Navigating to the Map Explorer with state carried over.** A species' coordinate markers, a named bird's pins and Statistics' ranked pins do not exist there and cannot be reconstructed from a viewport.
- **Carrying page-adjacent controls into the overlay.** Species Detail's Heatmap Intensity slider and County Shading panel, and Statistics' Counties switch, stay on the page. The overlay holds the map plus the controls already inside it: base switcher, zoom, share-pin drop button, attribution.
- **Persistence.** Fullscreen is session-scoped and per-map; nothing is written to the storage seam.
- **Deep-linking or URL state** for a fullscreen map.
- **Any new tile provider, network call, backend route, or data**, and consequently no `PRIVACY_POLICY.md` change.
- **A fullscreen affordance on any other map or surface**, now or as a side effect.
- **Changing gesture behaviour outside fullscreen.** The in-flow maps keep `cooperativeGestures` with `scrollZoom={false}` exactly as shipped.
- **Orientation lock, print styling, or a fullscreen-specific control chrome.** Designing controls that only exist in the overlay is a second feature with its own layout budget.

---

## Open Questions

Each is stated with the default that governs if nobody answers before the build.

**OQ-01 — Does react-map-gl already resize the map when its container changes size, or is an explicit call needed?**
*Default:* implement an explicit resize on every mode change regardless, after layout commit, and verify by measuring the canvas box against the container's content box. `SnowMap`'s header comment claiming auto-resize is not evidence.

**OQ-02 — Do `cooperativeGestures` and `scrollZoom` apply reactively as props, and does changing either force react-map-gl to re-create the map?**
*Default:* do not rely on prop reactivity. Drive the live instance's `scrollZoom` and `cooperativeGestures` handlers (both expose `enable()`/`disable()` in maplibre-gl 5) from an effect on the mode. If a prop change turns out to remount the map, keep the props constant and drive the instance only. If neither route works, FR-15's fallback applies: shipped gesture behaviour unchanged, said plainly in the docs.

**OQ-03 — Extract `ModalDialog.tsx`'s focus trap into a shared hook, or apply `inert` to the page content behind the overlay?**
*Default:* extract the trap. `ModalDialog` already re-queries its focusables per Tab keydown and restores focus to a trigger getter, which is exactly FR-18 and FR-19; the extracted helper must stay dependency-free because `ModalDialog` sits on `App.tsx`'s static graph. `inert` on the page behind is rejected as the default because it needs a host-specific ancestor on three different surfaces and would put the map's own subtree at risk of being inerted with it.

**OQ-04 — How is the two-control corner row assembled, given `SharePin` currently renders its own `.sr-share-corner` wrapper?**
*Default:* the host renders the corner row and passes a `display: contents` slot element to `SharePin`'s existing `buttonHost` prop, which is the same mechanism the Map Explorer already uses, so the share button keeps its position and DOM order equals reading order.

**OQ-05 — Should the expanded container carry `role="dialog"` and `aria-modal="true"`?**
*Default:* no. It is the same map enlarged, not a dialog with its own content; the toggle's `aria-pressed` carries the state and the focus trap carries the containment. Revisit only if a screen-reader pass shows the trap reads as a bug without it.

**OQ-06 — Does a Named Birds row unmount its card map when the accordion collapses, or keep it mounted?**
*Default:* assume it can unmount. The overlay's teardown (scroll lock release, handler removal, state reset) must be correct on unmount as well as on an explicit collapse, so the behaviour is safe either way.

**OQ-07 — Does the expanded container keep its border, radius and `overflow: hidden`?**
*Default:* drop the border and radius while expanded (a full-window map with rounded corners and a hairline border reads as a bug) and restore them exactly on collapse. Clipping stays.

**OQ-08 — Should the Named Birds card map show the base-map switcher while expanded, given it passes `switcher={false}`?**
*Default:* no. Keep `switcher={false}` in both states so the toggle changes size and nothing else, and so no new persisted base-map write path appears from the card. The Designer may raise it.

**OQ-09 — Does the Named Birds toggle stay `--compact` when the map fills the window?**
*Default:* yes. Nothing about a control should change size as a side effect of the toggle, and one vocabulary per map is the simpler rule. Flagged for The Designer, who may prefer `--std` while expanded.

---

## Success Metrics

The Tester verifies against this table at Stage 6. Layout and geometry rows are measured in a real browser (Chromium and WebKit) against the built stylesheets with the synthetic demo dataset, per NFR-08.

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | The toggle exists on every in-scope mount (FR-01) | A fullscreen toggle button is present on M1, M2, M3 and M4, verified one mount at a time |
| QA-02 | Control vocabulary (FR-02) | Each toggle is a `<button type="button">` whose accessible name is exactly "Enter fullscreen" collapsed and "Exit fullscreen" expanded, with `aria-pressed` false then true |
| QA-03 | Glyph swap (FR-02) | The rendered glyph is lucide `Maximize2` collapsed and `Minimize2` expanded, on all four mounts |
| QA-04 | FAB classes and glyph scale (FR-02, FR-04) | Each toggle carries `.sr-map-fab` plus `--std` (M1, M2, M4) or `--compact` (M3) plus `.sr-map-fullscreen-btn`; the computed glyph-to-disc ratio is constant at 1x and 200% text scale, and the size modifier is the same string in both modes |
| QA-05 | Row order equals reading order (FR-03) | On each mount the share drop button precedes the fullscreen toggle in DOM order, a browser tab-order enumeration visits them in that same order, and no rule in `globals.css` sets `order` on the row's children |
| QA-06 | No map, no toggle (FR-05) | No toggle renders for a species with no coordinates, a named bird with no coordinates, or the Statistics section before `mapReady` and when there are no ranked pins |
| QA-07 | Unique accessible names (FR-06) | On each expanded map, the set of accessible names of all focusable controls has no duplicates, checked collapsed and expanded |
| QA-08 | Shared implementation (FR-07) | The toggle, the overlay class, the Escape handler and the focus trap each exist in exactly one module; `SightingsMap` gains the capability once and both of its callers receive it, asserted per caller |
| QA-09 | Expanded geometry (FR-08) | While expanded, the container's computed style is `position: fixed`, `inset: 0`, `height: 100dvh`, `z-index: 1200`, applied by a class and not an inline style; on collapse its box measures identical to its pre-expand box |
| QA-10 | **No remount** (FR-09) | Across an expand-collapse round trip the map component mounts exactly once (mount counter on the mocked map in the component suite) and, in a browser, the `canvas.maplibregl-canvas` element is the same node object before and after |
| QA-11 | Viewport preserved (FR-09, FR-14) | `map.getCenter()` and `map.getZoom()` read identical values before expanding, while expanded, and after collapsing |
| QA-12 | Open popup survives (FR-09) | A popup open before expanding is still open, on the same feature, with the same content, after expanding and again after collapsing |
| QA-13 | Share pin survives (FR-09) | A dropped share pin is still present at the same coordinate with the same drop-button `aria-pressed` state after a round trip, on M1, M2, M3 and M4 |
| QA-14 | Base layer survives (FR-09) | A non-default base map plus the Trails overlay selected before expanding are still selected after a round trip, and no `setStyle` swap occurs |
| QA-15 | County geometry fetched once (FR-10) | With the county overlay on, the on-demand geometry request count is exactly 1 after five expand-collapse round trips, on Species Detail and on Statistics |
| QA-16 | No loading placeholder (FR-09) | No frame during a round trip renders `Loading map…` or the map-load error state; asserted by watching for the placeholder node across the transition |
| QA-17 | No portal (FR-11) | The map's DOM node has the same parent element before and after a round trip, and no `createPortal` is introduced for the overlay |
| QA-18 | Pins and Heatmap both carry it (FR-12) | Expanding in Pins mode then switching to Heatmap leaves the map expanded with a working "Exit fullscreen" toggle, and the reverse switch does the same |
| QA-19 | Resize on mode change (FR-13) | Within one animation frame of each toggle, in both directions, the canvas's box equals the container's content box within 1px, at 320px and at desktop width |
| QA-20 | No re-frame (FR-14) | Neither `MapBoundsFitter` nor `fitToPins` runs as a result of a toggle, asserted on the call, not only on the resulting centre |
| QA-21 | Gestures release and restore (FR-15) | While expanded, the live map reports scroll zoom enabled and cooperative gestures disabled; on collapse both report their in-flow values. If FR-15's fallback is taken instead, `docs/HELP.md` states the shipped behaviour and this row verifies that sentence |
| QA-22 | Escape exits and restores focus (FR-16) | On each of the four mounts, Escape while expanded collapses the map and `document.activeElement` is that map's fullscreen toggle |
| QA-23 | Escape ordering (FR-17) | With the share popup open on an expanded map, one Escape closes the popup and leaves the map expanded; a second Escape exits fullscreen |
| QA-24 | Focus trap (FR-18) | In a browser tab-order enumeration (candidates filtered by `getClientRects().length > 0`, `document.activeElement` verified before each keypress), Tab from the last focusable in the overlay reaches the first, Shift+Tab from the first reaches the last, and no control outside the overlay is ever reached |
| QA-25 | Focus restore across a branch swap (FR-19) | Expanding in Pins mode, switching to Heatmap, then pressing Escape lands focus on the Heatmap branch's toggle, never on `document.body` |
| QA-26 | Scroll lock (FR-20) | `document.body` `overflow` is `hidden` while expanded and restored to its previous value on collapse, on unmount, and on each FR-24 exit |
| QA-27 | Fixed resolves against the viewport (FR-21) | On all three surfaces, the expanded container's bounding rect equals the viewport rect; separately, no ancestor of any of the three containers has a computed `transform`, `filter`, `backdrop-filter`, `perspective`, `contain` or `will-change` that creates a containing block, checked while any entrance animation is running |
| QA-28 | iOS safe area (FR-22) | The gated rule exists at top level, the ungated base rule contains no `env(`, only top, left and right are padded, and on an iPhone in both rotations the base switcher and the corner row clear the status bar, the Dynamic Island and the sensor housing |
| QA-29 | Nothing persisted, nothing in App (FR-23) | `settings.json` is byte-identical after a round trip on each surface; `App.tsx` gains no fullscreen state; `git diff` shows no storage-seam write from this feature |
| QA-30 | Exits on navigation away (FR-24) | Opening a species from the Statistics county popup while expanded exits fullscreen, releases the scroll lock and disarms the Escape handler; a species change on Species Detail and a Named Birds row collapse do the same |
| QA-31 | Opaque overlay (FR-25) | Nothing of the page behind is visible inside the expanded container in either theme, including while the map style is still loading |
| QA-32 | Accessibility floor (NFR-01) | At 320px and 200% in-app text scale, in both themes and in both engines: page `scrollWidth` unchanged from the collapsed state, every overlay control's box and rendered text ink inside its container's content box, and every interactive target at least 24x24 |
| QA-33 | Tokens and classes (NFR-02) | No hardcoded hex or RGB in any file this feature adds or changes; every new token defined in both `:root` and `[data-theme="dark"]`; new phone-tier declarations sit inside the established `@media (max-width: 640px)` block |
| QA-34 | Entry chunk (NFR-03) | `entryChunk.test.ts` passes unamended, and a fresh `npm run build` shows no maplibre or county entry in `dist/index.html`'s modulepreload and no bare maplibre import in the entry chunk |
| QA-35 | No new network (NFR-05) | The request log across a full expand-collapse round trip on each surface contains no request that the same interaction without the toggle would not make |
| QA-36 | Map Explorer untouched (NFR-07) | The Map Explorer's fullscreen behaviour is unchanged, its FAB cluster measures the same three discs and two gaps at 320px and 200% text scale as before this change, and `mapFabClusterCss.test.ts`, `mapIosFullscreen.test.ts`, `MapExplorerLocateFab.test.tsx` and `MapExplorerCenterShareFab.test.tsx` pass unchanged |
| QA-37 | Help content (FR-26) | `docs/HELP.md`'s "row of three round buttons" sentence is scoped to the Map Explorer, the three embedded maps have their own fullscreen paragraph, the lifetime is described as per-session and resetting on relaunch, and `helpToc.test.ts` stays green |
| QA-38 | Docs and site parity (FR-27) | `README.md` and `website/` describe the feature in the same change, and the website version pill and footer match `frontend/package.json` |
| QA-39 | Accessibility statement true (FR-28) | `ACCESSIBILITY.md`'s Escape sentence is true of all four in-scope mounts and the Map Explorer without qualification, and each claim in the new or changed sentences is confirmed against the shipped code |
| QA-40 | No em dashes (FR-29) | `grep -rn '—'` over the changed `.tsx`/`.ts` user-facing strings, `docs/HELP.md`, `README.md`, `ACCESSIBILITY.md`, `website/index.html` and `website/privacy.html` returns nothing new |
| QA-41 | Version and changelog (FR-30) | `frontend/package.json` and `src-tauri/tauri.conf.json` carry the same new patch version and `CHANGELOG.md` has its entry |
| QA-42 | Gate before push (NFR-03) | `npm run build` succeeds and the full `vitest` suite plus `eslint` are green; the backend suite is unchanged and green |
