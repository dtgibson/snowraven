## Map Fullscreen Toggle (embedded maps)

### What this does

Adds a fullscreen toggle to the app's three embedded maps, which is four `<SnowMap>`
mounts: Species Detail's Sighting Locations map in both its Pins (M1) and Heatmap (M2)
branches, the Named Birds per-individual card map (M3), and the Statistics Geographic
Stats map (M4). The control is the Map Explorer's shipped fullscreen FAB, in the Map
Explorer's corner-row vocabulary, so the gesture is learned once.

Expanding is a **class swap on the host's own container** and nothing else. The
`<SnowMap>` keeps its position in the React tree, so the MapLibre instance, its WebGL
context, the viewport, an open popup, a dropped share pin, the selected base map and the
county overlay all survive a round trip because nothing ever asked them not to. No
portal, no remount, no refetch, no re-frame.

It also fixes a **shipped defect found on the way past** (schema.md D-06, confirmed by
test): `SightingsMap` built `MapBoundsFitter`'s input inline, so every re-render handed
the fitter a new array identity and its effect re-ran `fitBounds(..., { duration: 0 })`.
Opening a pin popup sets state in that component, so on today's build clicking a pin
snaps the map back to its initial fitted bounds and discards whatever the user had
panned or zoomed to. One `useMemo` closes it. It is in the changelog as a fix.

### How to test

The full step-by-step is in `pipeline/map-fullscreen-toggle/how-to-see.md`.

### Notes for reviewer

**The module-graph split is the shape of the whole change** (D-01, D-04). `NamedBirdRow`
is on `App.tsx`'s static import graph, which is why it already reaches `SightingsMap`
only through `lazy(() => import(...))`. So the feature is split on that line:

| Module | Imports | On the entry graph |
|---|---|---|
| `lib/useFocusTrap.ts` | `react` only | **yes, and must stay map-free** |
| `lib/useMapFullscreen.ts` | `react` + `./useFocusTrap` | **yes, and must stay map-free** |
| `components/map/MapCornerControls.tsx` | `react-map-gl`, `lucide`, `./SharePin` | no, and must stay off |

`entryChunk.test.ts` is **unamended** — its existing "no statically-reachable file
imports maplibre" assertion is already live against this exact risk, and making it pass
by editing it would be the failure mode. `lib/mapFullscreenEntrySafe.test.ts` adds the
belt-and-braces closure check so a break localizes to the module that caused it rather
than to "the entry chunk grew". A fresh build's `dist/index.html` modulepreload set
carries no maplibre and no county entry.

**Things worth a second look, each of which was a real trap:**

- **`MapRef` lies about its handlers.** react-map-gl's `createRef` copies only the map's
  *functions* onto the ref object, so `mapRef.scrollZoom` is `undefined` at runtime while
  `MapRef`'s type says `Omit<MapInstance, …>`. The gesture handoff therefore goes through
  `useMap().current.getMap()`. `resize` is a method and is proxied, so that one is fine
  on the ref.
- **The in-flow gesture posture is captured, not assumed.** Three mounts pass
  `scrollZoom={false} cooperativeGestures`; the Statistics map passes **neither**. This PR
  first read "passes neither" as "maplibre's defaults" and claimed that map ships with
  scroll zoom on; QA measured it on the live instance in both engines and it is **scroll
  zoom off, cooperative gestures off**. `SnowMap` forwards both props unconditionally, so
  the map is constructed with `scrollZoom: undefined` — an own key that shadows maplibre's
  `true` default through its `Object.assign({}, defaultOptions, options)` — and
  `options.interactive && options.scrollZoom` is falsy. Capturing rather than assuming is
  precisely why the restore is correct anyway, and why the wrong premise cost nothing: the
  code never asks what the posture *should* be. A hardcoded restore would have written the
  assumed pair back and silently changed a map. There is a test row per posture, and the
  second row no longer claims to be the Statistics one.
- **The phone-tier specificity trap.** `globals.css` sets `.sr-map-container { height:
  300px }` in the `@media (max-width: 640px)` block at the very end of the file. Both it
  and `.sr-map-fs-panel` are one class deep and the media block comes last, so unscoped it
  wins and the *expanded* map is 300px tall at phone width with every other declaration
  correct. It is now `.sr-map-container:not(.sr-map-fs-panel)`, and the other two
  container rules carry a note that any future phone-tier height owes the same guard.
- **Two containers were lifted out of inline styles first** (D-09). `.sr-named-map`'s
  border/radius/clip were inline in `NamedBirdRow.tsx`, and the Statistics map box had **no
  class at all** — an inline `height: 320px` can never be beaten by `height: 100dvh` from
  a class. The new `.sr-geo-map` goes on the `mapReady` placeholder twin as well, so the
  zero-layout-shift promise is now a property of one class instead of two hand-kept copies.
- **The focus trap contains on `focusin`, not on the next Tab keydown** (QA found the
  original in WebKit; the fix is in this change). A keydown trap has to answer "is focus at
  the last focusable?" by comparing `activeElement` against a list built from
  `FOCUSABLE_SELECTOR` — that is, by *predicting* the engine's tab order. WebKit's default
  tab mode (Safari with macOS Keyboard navigation off, which is the default and what
  WKWebView follows, so it is what the shipped Mac and iOS apps get) visits a smaller and
  different set: explicit `tabindex`, native form controls and `<summary>`, but not plain
  `<button>` or `<a href>`. In the expanded overlay the trap's list held 22 entries ending
  at the fullscreen toggle while WebKit's real forward order ended five elements earlier at
  the Trails checkbox, so `activeEl === last` never became true, the end-wrap never fired,
  and Tab landed on a control the opaque panel was covering — proven by typing into that
  covered `<input>` and reading the value back. The keydown containment arm did fire, but
  on the *next* Tab: one hop too late. A `focusin` listener on `document` fires after focus
  has moved and before the user can type, and needs no prediction at all; any fix that
  keeps guessing the tab order keeps the defect open. The keydown arm stays for the two
  things `focusin` cannot do — wrapping at the ends with no visible out-and-back, and
  acting when focus is lost to `<body>`, for which engines do not reliably fire `focusin`.
- **Escape stays bubble-phase.** `SharePopup` owns Escape in the capture phase with
  `stopPropagation`, so one Escape closes the popup and a second exits fullscreen. The two
  work as layers only because the phases differ, and the test models the phase.
- **Focus restore is three cooperating mechanisms**, and mutating any one alone leaves the
  branch-swap test green because the other two still deliver the right element; mutating
  all three together (capture at open, never clear, no fallback — ModalDialog's pattern
  verbatim) turns it red, which is the defect FR-19 names. There is a separate row for the
  case the fallback alone answers. This is written up in the test file.
- **`ModalDialog` was refactored onto the extracted trap and its behaviour is preserved
  byte for byte.** It keeps the default options; the map overlay opts into
  `containOutsideFocus`, because unlike the Map Explorer the surface behind it is a live
  page in the same panel rather than a `display: none` sibling. That stayed true through
  the `focusin` fix above, which is armed **only** under `containOutsideFocus`: the dialog
  moves focus inside itself as it opens and covers nothing with an opaque full-window
  panel, so arming it for every consumer would yank focus out of anything a Settings dialog
  does not contain. There is a row pinning that the default options do not get the new arm.
  Escape deliberately did **not** move: the two consumers need different phases and
  different side effects.
- **Teardown is derived, not driven by an effect.** `active` and `resetKey` are folded
  into the state comparison, so a species change or a Named Birds row closing collapses in
  the same render rather than in a cascading one — which also avoids a painted frame with
  the map still expanded over the wrong species, and satisfies
  `react-hooks/set-state-in-effect`.
- **Why the three FR-24 exits are the complete set** is stated in the hook: the panel is
  `fixed; inset: 0; z-index: 1200` with an opaque ground, and neither `.sr-header` nor the
  tab nav is positioned or z-indexed, so the chrome is painted under it and takes no
  clicks; the trap holds Tab inside the overlay, so the tab nav and the z-index-1300 skip
  link are unreachable by keyboard. Every remaining way out is an in-map action and each
  has its exit. **This is the one assumption here that only a browser can confirm** — if
  it is ever false, the body scroll lock outlives the tab it belongs to.
- **`SnowMap`'s header comment claimed "auto-resize" and nothing in the file implemented
  one.** That was documentation debt, not evidence; it is corrected in the same change,
  because it is the sentence that would talk the next reader out of the explicit resize.

**Deliberately not done:** the Map Explorer is untouched, including its FAB cluster's
measured 4.00px of slack; nothing is added to `App.tsx`; nothing is written to the storage
seam; the Named Birds card keeps `switcher={false}` in both states (turning it on would
open a `settings.json` base-map write path from a surface that has never had one, and
would be fullscreen-specific chrome); and the toggle's size modifier does not change when
the map expands.

### What is NOT evidence here

Every geometric claim in this change is settled by the Tester in a real browser, in
Chromium **and** WebKit, per NFR-08. The stylesheet guard proves that declarations exist
at top level on the right selectors with the right values; it cannot prove that any of it
*works*, and a stylesheet test passes on an inert class. Specifically unproven by this PR
and owed to Stage 6: that the panel's rect equals the viewport rect on all three surfaces
and that no ancestor creates a containing block (QA-27, including while the corner row's
entrance animation is running); that the canvas fills the container within 1px after a
resize (QA-19); the 320px / 200%-text-scale sweep (QA-32); and the iOS safe-area behaviour
in both rotations (QA-28).

### Tests

Five files, ~100 assertions, every load-bearing guard mutation-checked (each mutation and
its verdict is recorded in the test file it belongs to):

- `lib/mapFullscreenPanelCss.test.ts` — the stylesheet invariants: top-level rules, the
  geometry compared **against the shipped Map Explorer rule** rather than four retyped
  literals, the opaque token ground, source order against the three container rules, the
  `:not()` scope, the gated iOS insets, no `order`, and the entrance keyframe ending at
  its resting state.
- `lib/useMapFullscreen.test.tsx` — the class swap, Escape and its layering against a
  capture-phase dismisser, focus restore across a branch swap, the trap (both wrap
  directions, containment from outside, re-query per event), the scroll lock's
  capture-and-restore, and all four teardown paths with a guard-the-guard on each. Five
  rows added for the QA fix, in the one form jsdom can actually observe: jsdom has no tab
  order, so a test that reproduced WebKit's would only re-assert the broken assumption.
  What it *can* observe is the property that makes the engine's order irrelevant — focus
  landing outside is pulled back **with no keydown fired at all** — plus which end an
  escape returns to after a forward and a backward Tab, that nothing is armed while
  collapsed, and that the default (ModalDialog) options do not get the arm. Both mutations
  are recorded in the file: dropping the `focusin` listener turns the first three red, and
  arming it unconditionally turns the ModalDialog row red.
- `components/map/MapCornerControls.test.tsx` — DOM order equals reading order, classes,
  glyph swap, unique accessible names, the resize on every mode change in both directions
  plus its next-frame repeat, and the gesture handoff with one row per in-flow posture.
- `components/mapFullscreenWiring.test.tsx` — driven through the **real** `SightingsMap`
  and the **real** `MapBoundsFitter`: no remount, no portal, no re-frame (asserted on the
  call, with a guard-the-guard that a genuine marker change still frames), the popup and
  the share pin surviving a round trip, plus a **host roster** with one row per surface.
- `lib/mapFullscreenEntrySafe.test.ts` — the module-graph split, with non-vacuity in both
  directions.

`sharePinReset.test.tsx`'s two source guards were updated where the share pin's mount
moved into the shared row, and both now strip comments before scanning — a plain
`toContain` is satisfied by a **commented-out** call, which is exactly the state a
half-reverted change is in, and that mutation was green until it was closed.

### QA round 1

Three findings, all fixed here; nothing else was touched.

1. **The focus trap leaked in WebKit** on all four mounts, every run. Cause, fix and the
   reason the fix has the shape it does are in the reviewer note above and, at length, in
   `lib/useFocusTrap.ts`'s header. The sentence this change had added to
   `ACCESSIBILITY.md` — "on those last three the expanded map also keeps the Tab key
   inside it" — was false on Safari and in the Mac and iOS builds while the defect stood;
   it is true once the fix is verified, and is left standing rather than rewritten. Its
   neighbouring clause moved off "re-read on each Tab press" to "re-read each time", which
   is what the code now does and does not depend on an engine's tab order.
2. **Three published summary sentences overstated the scope.** The Weather tab's Predict
   mode has a map with no corner row and no toggle (`PredictMap.tsx` is out of scope per
   the PRD), so "every map in the app" was false in `README.md`, `website/index.html` and
   `docs/HELP.md`. All three now name the three maps that do expand. `HELP.md` also names
   the Weather map as the one with no row, so the next reader does not have to re-derive
   it, and `CHANGELOG.md`'s "the three maps that live in a box on a scrolling page" became
   "three of the maps" for the same reason — the Predict map is a fourth.
3. **A stated premise about the Statistics map was wrong**, in the bullet above, in the
   `MapCornerControls.test.tsx` row and in the source comment in `MapCornerControls.tsx`.
   All three are corrected. The behaviour and the code were already right, and the unit
   test's assertions are unchanged: it proves that an opposite in-flow posture survives a
   round trip, which is the property that matters. Only the false attribution is gone.

### Convention flags

See the completion note.
