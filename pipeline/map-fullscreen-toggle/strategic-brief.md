# Strategic Brief — Map Fullscreen Toggle (embedded maps)

## What We're Building

A fullscreen toggle on the app's three *embedded* maps — Species Detail's Sighting Locations, the Named Birds per-individual card map, and Statistics' Geographic Stats map — so a map that lives in a 220px to 380px box on a scrolling page can be expanded to fill the window and collapsed back again. It is the **same map instance**, enlarged: same pins, same base layer, same viewport, same open popup and dropped share pin, in and out.

The Map Explorer already has exactly this control and is untouched by this feature. What we are doing is bringing the shipped affordance to the maps that never got it.

## Why Now

The saved idea is one line and it is right: *"On any page with a small map, like named birds or species detail, add a button to make the map fullscreen."* Three reasons it earns a slot now.

**The mechanism already exists and is proven.** `.claude/rules/maps.md` records fullscreen as a standing decision: a CSS overlay (`.sr-map-fullscreen-panel`: `position: fixed; inset: 0; height: 100dvh; z-index: 1200`), never the browser Fullscreen API. The FAB family (`.sr-map-fab` plus `--std` / `--compact`), the Escape-and-restore-focus handler, the body scroll lock, and the iOS safe-area inset for a fixed full-viewport panel are all shipped and measured. This feature reuses them rather than inventing anything.

**The small maps have been getting steadily richer while staying small.** Species Detail's map now carries a county overlay with ten shading tiers, a textures mode, a heatmap with an intensity slider, and a share pin. The Named Birds card map is 220px tall and often half the page wide. Statistics' geographic map is a fixed 320px box carrying ranked location pins plus the same county overlay. Every one of those additions made the box more worth looking at and none of them made the box bigger. The v1.0.5 county-popup work is the tell: a popup had to be redesigned into a pinned sheet because the container it anchors in is too narrow to hold it. Giving the user the window is the cheaper answer to the same pressure.

**It is a pure view change over data already on the device.** No new data, no new provider, no network call, no backend route, no persisted setting. That makes it unusually low-risk for the amount of daily value it returns.

## The User Problem

A birder opens Species Detail for a species they have recorded in forty places across two states, and gets a 380px window (300px on a phone) to read a continental spread of pins in. They can pan and zoom, but they are reading a map through a letterbox: pins overlap, the county shading tiers are hard to compare, and a popup covers a meaningful fraction of what is behind it.

It is worse on the two smaller surfaces. The Named Birds card map — the one the idea names first — is 220px tall in an accordion row, and it is the map answering the most spatial question the app asks: *where has this individual bird been seen*. Statistics' Geographic Stats map is a 320px box holding ten ranked checklist locations and ten ranked species locations at once.

The workaround today is to leave. Go to Map Explorer, re-derive the filters, and hope the view is comparable. It usually is not: Map Explorer draws on live eBird lookups and the whole export, not on this species' coordinates, this named bird's sightings, or this tab's ranked pins. There is no route from the small map to a big version of *that same map*, and that is the gap.

## Success Criteria

- From the Named Birds card map, one press fills the window with the same map: same pins, same base layer, same centre and zoom, a popup that was open still open, a share pin that was dropped still dropped.
- Pressing again returns the map to its card at the size it was, keeping whatever the user did while expanded (pan, zoom, base switch, popup).
- The map is never re-created. No reframe to the initial view, no flash of the "Loading map…" placeholder, no second fetch of the county geometry, no new WebGL context.
- Escape exits fullscreen and focus lands on the button that opened it. Tab while fullscreen never reaches the page behind.
- The control looks and reads the same on all three surfaces and the same as Map Explorer's: bottom-right of the map, `Maximize2` / `Minimize2`, named "Enter fullscreen" / "Exit fullscreen", reporting `aria-pressed`.
- Behaves identically in the macOS desktop app, the iOS app, and a browser. On an iPhone the base-map switcher clears the status bar and Dynamic Island in both rotations.
- At 320px width and 200% in-app text scale the overlay produces no horizontal scroll and every control in it is reachable.
- `ACCESSIBILITY.md`'s existing sentence — "Escape also exits map fullscreen and returns focus to the fullscreen toggle" — is still true of every map in the app, unqualified.
- The maplibre vendor chunk stays off the entry chunk (`entryChunk.test.ts` stays green without amendment).

## Scope

**Three surfaces, established by finding every `<SnowMap>` and `SightingsMap` call site rather than working from the idea's examples:**

1. **Species Detail → Sighting Locations** (`SpeciesDetail.tsx`, inside `.sr-map-container`, 380px desktop / 300px phone). This is **two** map mounts, not one: the Pins branch renders the shared `SightingsMap`, the Heatmap branch renders its own inline `SnowMap`. Both get the toggle, or a user switching modes silently loses the feature. That is the exact trap the share-pin build hit and fixed on this same pair of branches.
2. **Named Birds → the per-individual card map** (`NamedBirdRow.tsx`, `.sr-named-map`, 220px, via the shared `SightingsMap` with `switcher={false} compact`). The smallest map in the app and the one the idea names.
3. **Statistics → Geographic Stats** (`BirdingStats.tsx`, a 320px inline box) with its ranked checklist and species pins and its optional county overlay.

**Also in scope:**

- The shared `SightingsMap` gains the capability once and both of its callers get it, rather than each re-inlining a toggle.
- Escape to exit, focus returned to the toggle, focus trapped in the overlay while it is up, and a body scroll lock that self-clears on unmount or navigation.
- iOS safe-area insets on the overlay, matching `.sr-ios-app .sr-map-fullscreen-panel`.
- Docs in the same change, per the standing rule: `docs/HELP.md` (whose fullscreen paragraphs at ~322-324 sit inside the Map Explorer section and open with "Every map shows the same row of three round buttons" — that sentence needs care now that three more maps carry a fullscreen button in a *different* row), `README.md`, and `website/`. `ACCESSIBILITY.md` gets whatever sentence keeps it exactly true.

## Out of Scope

- **The Map Explorer.** It already has fullscreen and this feature changes none of it. Its FAB cluster in particular is not to be touched: three discs plus two gaps measure 284.00px against a 288.00px cap at 320px and 200% text scale, and that 4.00px of slack is not this feature's to spend.
- **The Weather tab's Predict picker map** (`PredictMap.tsx`). It is a location *input*, not a data view — you place a pin, you do not explore. Its `clamp(180px, 28vw, 280px)` height is a form field's height on purpose. The share-pin feature excluded this same map by name for the same reason (PRODUCT_CONTEXT, v0.5.81); this brief keeps that line where it is.
- **The browser Fullscreen API, OS-level fullscreen, and Tauri native window fullscreen.** See Key Decisions.
- **Carrying page-adjacent controls into the overlay.** Species Detail's Heatmap Intensity slider sits above the map and its County Shading panel below it; Statistics' Counties switch is in its section header. None of them travel. The overlay holds the map plus the controls that are already *inside* it: base switcher, zoom, share-pin drop button, attribution. Setting those before expanding and adjusting after collapsing is the v1 workflow. Carrying them means designing a fullscreen control chrome, which is a second feature with its own layout budget.
- **Persistence.** Fullscreen is session-scoped and per-map, like Map Explorer's. Nothing is written to the storage seam.
- **Deep-linking or URL state** for a fullscreen map.
- **Any new tile provider, network call, backend route, or data.** Consequently no `PRIVACY_POLICY.md` change — and if that ceases to be true, the maps rule says that is a privacy disclosure, not an implementation detail.

## Key Decisions

**1. Fullscreen is an in-app CSS overlay, not the browser Fullscreen API and not a trip to Map Explorer.**

The Fullscreen API is out because the app ships on WKWebView twice over — the macOS Tauri app and the iOS app — plus a web/Pi build. `.claude/rules/maps.md` already records it as unreliable in iOS Safari and WKWebView, which is why Map Explorer's shipped fullscreen is a CSS overlay. Choosing it here would ship a feature that works in one of three targets.

Navigating to Map Explorer with state carried over is out on both intent and feasibility. Map Explorer's content is built from live eBird lookups and the whole export; a species' own coordinate markers, a named bird's sighting pins, and Statistics' ranked top-location pins do not exist there and cannot be reconstructed from a viewport. There is nothing to carry that would reproduce what the user is looking at, and it would discard the heatmap, the county overlay state, and the share pin on the way. The user's intent is plainly "see *this* map bigger," and the only mechanism that honours that is expanding this map.

So: the same overlay shape Map Explorer uses, `position: fixed; inset: 0; height: 100dvh; z-index: 1200`, on the map's own container.

**2. The map instance must not remount. This is the load-bearing constraint of the whole feature.**

Expanding means changing the *container's* CSS from its in-flow box to the fixed full-viewport form while the `<SnowMap>` stays in the same position in the React tree. A remount gives a new WebGL context, resets the viewport to `initialViewState`, re-runs `MapBoundsFitter`, drops the open popup and the share pin, and refetches the county geometry — which is to say it gives the user a *different* map, failing the one thing they asked for.

Three consequences follow and each is a real constraint on the implementation:

- **No React portal.** Portaling moves the DOM node, which remounts the map. The overlay is `position: fixed` from wherever the map already sits, which means any ancestor carrying `transform`, `filter`, `contain`, or `will-change` would make `fixed` resolve against that ancestor instead of the viewport. That has to be verified on each of the three surfaces (Species Detail's `SectionCard`, the Named Birds accordion row, the Statistics `SectionCard`), not assumed.
- **The map needs a resize when its container changes size.** `SnowMap`'s header comment claims auto-resize but nothing in the file implements one; whether react-map-gl's own observer covers this is to be confirmed by measurement, not by reading the comment.
- **`cooperativeGestures` and `scrollZoom` should change with the mode.** All three embedded maps ship `cooperativeGestures` with `scrollZoom={false}` because they sit mid-flow in a scrolling page and a one-finger drag must scroll the page. In fullscreen there is no page to scroll and the map is the primary interaction, so the two-finger requirement becomes an obstacle with nothing behind it. Release both on entry and restore on exit — but **never by remounting the map**. If those props turn out not to apply reactively, drive the map instance's own handlers, or accept the shipped gesture behaviour for v1 and say so plainly in the docs. Reframing the map to fix a gesture is not an acceptable trade.

**3. Fullscreen state stays local to each map's own subtree — it is not lifted to `App.tsx`.**

Map Explorer's `mapFullscreen` lives in `App.tsx` because that overlay *is* the tab panel, and App has to mark its own header, nav, and footer `inert` behind it. An embedded map does not need App's cooperation: the overlay covers the chrome visually at `z-index: 1200`, and the keyboard problem is solved by a focus trap *inside* the overlay rather than by inerting everything outside it. Keeping the state local avoids three new booleans in App and, more importantly, keeps every map-touching import off App's static graph, so `entryChunk.test.ts` stays green without amendment.

**4. Focus behaviour is the published statement, not a nicety.**

`ACCESSIBILITY.md` says, without naming a map: *"Escape also exits map fullscreen and returns focus to the fullscreen toggle, so a keyboard user is never dropped to the page body."* Adding fullscreen to three more maps without that behaviour would make a published statement false. So Escape-to-exit and focus restore are requirements, in the exact shape already shipped at `MapExplorer.tsx:613-622`.

The trap is where these surfaces genuinely differ from Map Explorer. There, the sibling tab panels are `display: none` and therefore unfocusable, so `inert` on the chrome was enough. Here the overlay has a whole live page behind it inside the same panel. The app already owns a focus trap that re-queries its focusables per Tab keydown, closes on Escape, and restores focus to a trigger getter (`components/ui/ModalDialog.tsx`); whether to extract that trap or apply `inert` to the page content behind is the Planner's and Engineer's call. The **behaviour** is required; the mechanism is not specified here.

**5. Reuse the shipped control vocabulary exactly; do not invent a second fullscreen idiom.**

`.sr-map-fab` plus a size modifier, bottom-right of the map, `Maximize2` / `Minimize2`, `aria-label` "Enter fullscreen" / "Exit fullscreen", `aria-pressed`. Same place, same glyph, same words as Map Explorer, so a user learns it once. The Named Birds card map takes `--compact`, matching the density it already passes to its share popup. On these three surfaces the corner currently holds one control (the share-pin drop button), so this makes a two-disc row, comfortably inside the measured budget that three discs nearly fill.

The FAB rules that ride along: the glyph is sized in rem through `--sr-fab-glyph` declared on the size modifier, never a px `size=` attribute, or the disc empties out at 200% text scale; and no interactive control may take the map's top-centre anchor.

**6. Alignment with the founding brief: clean, with one thing worth stating.**

This serves the same birder `product-brief.md` describes, sharpens "explore your birding life in ways eBird doesn't offer" on the app's smallest surfaces, and sits inside every founding decision: local-first, zero-network, nothing collected, no change to the device-to-provider disclosure. Nothing in the brief's Out of Scope is approached. **No tension to surface.**

The one thing to state honestly: `ROADMAP.md`'s Up Next currently holds three other items, and this is none of them. It is a saved idea taken ahead of the queue as a deliberate Spool choice, not a drift in strategy. Worth a roadmap line when it ships, not a reconsideration now.

**7. Verification obligations carried into QA.**

- The no-remount promise is verified by observation, not by inspection: the viewport, an open popup, and a dropped share pin all survive a round trip, and the county geometry is fetched once.
- The 320px / 200%-text-scale sweep is confirmed in **both** engines. The app ships on WebKit for macOS and iOS, and this repo's standing rule is that a layout claim is confirmed in both.
- The iOS safe-area behaviour is checked in both rotations, since the base-map switcher sits at `top: 8px` inside the overlay and that is precisely the collision the shipped panel rule exists to prevent.
