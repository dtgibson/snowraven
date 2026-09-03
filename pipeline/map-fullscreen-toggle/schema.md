# Schema — Map Fullscreen Toggle (embedded maps)

**Feature:** map-fullscreen-toggle
**Date:** 2026-09-02
**Stage:** 3 — The Architect
**Source:** prd.md (approved), strategic-brief.md

---

## Path

**Frontend Only — no data layer changes required.**

Nothing is created, read, updated, deleted or newly derived. There is no new
table, column, relationship, migration, backend route, storage-seam document or
persisted setting. The Engineer can proceed straight to UI work; there is no
migration to write and none to run.

### Confirmation

The classification was checked against every user story and functional
requirement, with particular attention to the one thing that would break it:
SnowRaven persists UI settings through the `storage` seam (`storage.getSetting`
/ `setSetting`, never `localStorage`), so a "remember my last fullscreen state"
requirement would make this an incremental data-layer change against
`data/settings.json`. **No such requirement exists.** The PRD rules it out in
four separate places, and the QA table asserts its absence:

- **FR-23** — "Fullscreen state shall be session-scoped and local to each map's
  own subtree. Nothing shall be written to the storage seam, nothing shall be
  added to `App.tsx`."
- **Out of Scope** — "Persistence. Fullscreen is session-scoped and per-map;
  nothing is written to the storage seam." And separately: "Deep-linking or URL
  state for a fullscreen map."
- **NFR-05** — "no new network call, tile provider, backend route, or stored
  data, and therefore no `PRIVACY_POLICY.md` change."
- **QA-29** — `settings.json` is byte-identical after a round trip on each
  surface, and `git diff` shows no storage-seam write from this feature.

Two adjacent settings **already** persist and must keep persisting exactly as
today, unchanged by this feature: the base map (`BASE_SETTING`) and the Trails
overlay (`TRAILS_SETTING`), written by `SnowMap` only when `switcher` is true.
FR-09 requires both to survive a fullscreen round trip, which they do for free
because the map does not remount. **OQ-08's default (keep `switcher={false}` on
the Named Birds card map in both states) exists precisely to avoid opening a new
persisted base-map write path from a card that has never had one.** Honour it:
turning the switcher on while expanded would make M3 write `data/settings.json`,
which turns QA-29 red and turns this assessment false.

State model for the feature itself: **one boolean per map container, in React
component state, for the lifetime of the mount.** No reducer, no store, no
context outside the subtree, no epoch module (`lib/filesChanged.ts` /
`lib/keysChanged.ts` are for stored documents that an off-screen writer can
change; nothing here is stored, so neither applies).

---

## Existing Data Used by This Feature

All of it read-only, all of it already resident in the host components. The
feature adds no query, no fetch and no field. Listed so the Engineer does not
have to re-derive what is on hand at each mount.

### `SightingMarker[]` (in-memory, from the eBird export)
- **Built by:** `lib/sightingMarkers.ts` → `buildSightingMarkers()`
- **Fields used:** `lat`, `lng`, `sightings[].submissionId`, `sightings[].date`
- **How used:** already rendered as pins and popup rows. This feature reads
  **only `markers.length`** (and `coordMarkers.length` / `cardMarkers.length` at
  the hosts) to satisfy **FR-05** — no map, no toggle.
- **Memoized at every host:** `SpeciesDetail.tsx:446` (`coordMarkers`),
  `SpeciesDetail.tsx:505` (`uniqueCoords`), `NamedBirdRow.tsx:48`
  (`cardMarkers`). Identity stability matters here; see **D-06**.

### Statistics ranked pins (in-memory, derived)
- **Built by:** `BirdingStats.tsx` from `geo.topLocations` and
  `geo.topLocationsBySpecies`
- **Fields used:** `lat`, `lng`, `rank`, `name`, `checklists` / `species`
- **How used:** framed once via `fitToPins` on the map's `onLoad`. This feature
  reads only `clPins.length + spPins.length > 0`, plus the existing `mapReady`
  flag (`BirdingStats.tsx:160`, flipped on `requestIdleCallback`), for **FR-05**.

### County geometry (on-demand, ~3.85 MB)
- **Loaded by:** `lib/countyGeometry.ts`, reached only through `import()` at
  each of the three call sites
- **How used:** not touched by this feature. **FR-10 / QA-15** require the
  request count to stay at exactly 1 per host mount across five round trips.
  That is a consequence of the no-remount rule (D-03), not of new code: the
  geometry lives in host state above the map, so a container class change cannot
  reach it.

### Persisted settings (read/write, untouched)
- **Document:** `data/settings.json` via the `storage` seam
- **Keys:** `BASE_SETTING`, `TRAILS_SETTING` (`lib/mapStyle.ts`), written by
  `SnowMap` only when `switcher` is true
- **How used:** read at mount, written on a user base/Trails change. **This
  feature must add no write and remove none.** QA-29 asserts byte-identity.

---

## Structural Decisions

No schema changes, but the feature has real structural questions. Each decision
below is binding on the Engineer, and each is tied to the PRD IDs it satisfies.

### D-01 — Where the shared fullscreen behaviour lives: a hook plus one map-side control component, split on the entry-chunk line

**Decision.** Two new modules, and the split between them is forced by the
module graph rather than by taste:

| Module | Contents | Imports | Entry-safe? |
|---|---|---|---|
| `frontend/src/lib/useMapFullscreen.ts` | the boolean, the container class composition, the `document` Escape listener, the body scroll lock, the focus trap wiring, focus restore, teardown | `react` + `./useFocusTrap` **only** | **Yes, required** |
| `frontend/src/components/map/MapCornerControls.tsx` | the bottom-right row: the SharePin slot, the fullscreen toggle button, and the live-instance resize + gesture effects | `react`, `react-map-gl/maplibre`, `lucide-react`, `./SharePin` | No, and must stay off |

**Why a hook and not props on `<SnowMap>`.** Three independent reasons, any one
of them fatal:

1. **`SnowMap` does not own the box that expands.** FR-08 changes the
   *container's* CSS. `SnowMap` renders `<MapGL style={{height:'100%',
   width:'100%'}}>` into a div the host owns (`.sr-map-container`,
   `.sr-named-map`, the Statistics inline box). A prop on `SnowMap` cannot put a
   class on an element `SnowMap` never sees.
2. **FR-12 spans two different `SnowMap` instances.** Species Detail's Pins
   branch mounts `SightingsMap` (which mounts its own `SnowMap`) and its Heatmap
   branch mounts an inline `SnowMap` — `SpeciesDetail.tsx:1358-1418`, two
   mounts, not one. State held by a `SnowMap` instance dies when the branch
   swaps. FR-12 requires it to survive.
3. **`SnowMap` short-circuits.** Its style-loading and error branches return a
   placeholder `<div>` before `<MapGL>` ever renders (`SnowMap.tsx:172-200`), so
   a `SnowMap`-owned toggle would blink out whenever the style is refetched.

**Why a hook and not a wrapper component owning the container.** A wrapper is
close to workable, but the three containers genuinely differ (380px/300px class,
220px class plus inline chrome, a 320px inline box with a matching placeholder
twin) and — more decisively — FR-03 puts the toggle in **one row with the
share-pin drop button**, which `SharePin` renders from *inside* the map. A
wrapper that owns the container sits outside the map and would have to
re-implement or portal that row anyway. The hook leaves each host's container
exactly where it is and adds one line of className composition.

**Contract.**

```ts
// lib/useMapFullscreen.ts  — react-only, no map imports, ever.
export function useMapFullscreen(opts: {
  containerRef: React.RefObject<HTMLElement | null>
  baseClass: string          // 'sr-map-container' | 'sr-named-map' | 'sr-geo-map'
  active?: boolean           // default true; false collapses AND releases
  resetKey?: string | number // a change collapses AND releases
}): {
  expanded: boolean
  toggle: () => void
  collapse: () => void
  className: string          // baseClass, plus the expanded class when expanded
  registerToggle: (el: HTMLButtonElement | null) => void
}
```

`active` and `resetKey` are not conveniences; they are how **FR-24** is met
structurally rather than by discipline at three call sites. See D-07.

The class composition mirrors the shipped `mapContentClass()` in
`lib/mapFullscreen.ts`, which is this repo's existing idiom for exactly this
("positioning lives in globals.css, NOT inline", `App.tsx:1292-1297`). Put the
pure helper beside it in `lib/mapFullscreen.ts` and the hook in its own
`lib/useMapFullscreen.ts`, matching the house convention that a `use*` hook gets
its own file (`lib/useFilesEpoch.ts`, `lib/useKeysEpoch.ts`,
`lib/useCountyCompleteness.ts`).

**How the map-side row reaches the host's state: a narrow context.** The hook
returns a value object; the host renders a provider around the container; the
`MapCornerControls` child reads it. Declared in the entry-safe module, so the
context object itself never touches maplibre.

Context rather than prop-drilling because **FR-12 makes props awkward and
context natural**: the provider wraps both Species Detail branches, so the Pins
branch and the Heatmap branch read one state with no coordination code, and
`SightingsMap` needs **no new prop at all** — which is FR-07's "added once, both
callers receive it" satisfied by construction rather than by two prop
signatures. It also keeps `SightingsMap.test.tsx` green with no provider: absent
context, `MapCornerControls` renders the share button and no toggle, which is
the correct degenerate behaviour.

This is a deliberately narrow seam and does not contradict `SightingsMap`'s
existing note rejecting a `children` prop for the county overlay. That note
rejects an *injection* seam ("would let any future caller inject arbitrary map
layers"); this context carries one typed fullscreen contract and can inject
nothing.

**Satisfies:** FR-07, FR-12, FR-23, NFR-03, QA-08, QA-18, QA-29, QA-34.

---

### D-02 — The corner row: the host-owned slot, assembled inside `<SnowMap>`

**Decision.** `MapCornerControls` renders, as a `<SnowMap>` child:

```jsx
<div className={`sr-map-corner-row${compact ? ' sr-map-corner-row--compact' : ''}`}>
  <div className="sr-map-fab-slot" ref={setSlot} />   {/* display: contents */}
  <FullscreenToggle ... />                            {/* second in DOM order */}
</div>
<SharePin compact={compact} buttonHost={slot} key={sharePinResetKey} />
```

This is **OQ-04's default, using the shipped mechanism unchanged**: `SharePin`
already accepts `buttonHost: 'corner' | HTMLElement | null` and Map Explorer
already portals its drop button into a `display: contents` slot
(`MapExplorer.tsx:3076-3078`, `.sr-map-fab-slot`, `fabSlot` held as state via
`ref={setFabSlot}` so the element exists before the portal renders). Copy that
pattern verbatim, including the `useState<HTMLDivElement | null>` ref-callback
(a plain `useRef` will not re-render `SharePin` when the slot mounts).

The slot is physically **first** in the row and `display: contents` erases its
box, so the share button becomes the first flex item: DOM order equals reading
order equals visual order, with no `order` property anywhere. That is **FR-03
and QA-05** met by construction.

The row is inside `<SnowMap>` rather than beside it (Map Explorer's cluster sits
outside) because the resize and gesture effects need `useMap()` anyway — see
D-05 — so co-locating gives one map-side module instead of two, and none of the
three containers needs a new `position: relative`.

**New CSS.** `.sr-map-corner-row` takes `.sr-share-corner`'s shipped geometry
(`position: absolute; bottom: 20px; right: 16px; z-index: 1050`, with
`--compact` at `12px/12px`) plus `display: flex; align-items: center; gap: 10px`
to match `.sr-map-fab-cluster`'s gap. `.sr-share-corner` then has no production
caller left; retiring it and the `'corner'` arm of `SharePinButtonHost` is the
tidy outcome, but check `SharePin`'s and `SightingsMap`'s test suites first and
leave both in place if anything depends on them. Two absolutely positioned
bottom-right wrappers must never render together.

Button vocabulary is FR-02/FR-04 verbatim from `MapExplorer.tsx:3180-3195`:
`<button type="button" className="sr-map-fab sr-map-fab--{std|compact}
sr-map-fullscreen-btn">`, `Maximize2` / `Minimize2` at `size={17}
strokeWidth={2.2}`, `aria-label` "Enter fullscreen" / "Exit fullscreen",
`aria-pressed`. The `size={17}` px attribute is the no-CSS fallback only;
`.sr-map-fab svg { width: var(--sr-fab-glyph) }` (globals.css:1846-1849) is what
actually sizes it and what keeps the ratio constant at 200% text scale (QA-04).
`--std` for M1/M2/M4, `--compact` for M3, **unchanged when expanded** (OQ-09's
default). `type="button"` is a small upgrade on the shipped control, which omits
it inside a non-form subtree.

**Satisfies:** FR-02, FR-03, FR-04, FR-07, QA-02, QA-03, QA-04, QA-05.

---

### D-03 — Species Detail's two branches share one state on their common container

**Decision.** `useMapFullscreen` is called **once in `SpeciesDetail`**, at the
top level, with `containerRef` on the existing `.sr-map-container` div
(`SpeciesDetail.tsx:1344`) — the element that already wraps the ternary. The
provider wraps that div's children; both branches render
`MapCornerControls` and both read the same context.

```jsx
const mapBoxRef = useRef<HTMLDivElement>(null)
const fs = useMapFullscreen({
  containerRef: mapBoxRef,
  baseClass: 'sr-map-container',
  active: coordMarkers.length > 0,      // FR-05: no map, no toggle
  resetKey: selectedSpecies,            // FR-24: a species change exits
})
...
<div ref={mapBoxRef} className={fs.className}>
  <MapFullscreenProvider value={fs}>
    {mapMode === 'pins' ? <SightingsMap .../> : <SnowMap ...>...</SnowMap>}
  </MapFullscreenProvider>
</div>
```

Because the boolean lives above the ternary, switching Pins ⇄ Heatmap while
expanded neither collapses nor re-reads anything: the container keeps its class,
the new branch mounts its own map already expanded, and its toggle renders
"Exit fullscreen" (**FR-12, QA-18**).

`registerToggle` is the answer to **FR-19**. A branch swap replaces the button
*element*, so ModalDialog's capture-the-trigger-at-open-time pattern would
restore focus to a detached node. Instead the currently mounted toggle registers
itself (`ref={fs.registerToggle}`) and unregisters on unmount; Escape focuses
whatever is registered **now**. One ordering trap the Engineer must handle:
React may invoke the outgoing element's ref cleanup after the incoming one's ref
callback, so unregister must be conditional (`if (ref.current === el) ref.current
= null`) or a swap leaves the ref null and focus lands on `document.body` — the
exact failure QA-25 tests for.

`selectedSpecies` as `resetKey` deliberately reuses the value already threaded
as `sharePinResetKey` at both branches, whose comment records why: this map
keeps its JSX position across a species change, so nothing unmounts and stale
state would otherwise survive.

**Satisfies:** FR-12, FR-19, FR-24, QA-18, QA-25, QA-30.

---

### D-04 — Module graph: the placement pulls no map code onto `App.tsx`'s static graph

**Verified against `entryChunk.test.ts`'s own walker semantics** (static, non-type,
relative/`@/` edges only; `import()` and `lazy(() => import())` are not followed).

The three hosts sit on **two different sides** of the entry line, and this is the
constraint that decides D-01's split:

| Host | On `App.tsx`'s static graph? | Evidence |
|---|---|---|
| `SpeciesDetail.tsx` | **No** | `App.tsx:62` `lazy(() => importSpeciesDetail())`; asserted absent by `entryChunk.test.ts` |
| `BirdingStats.tsx` | **No** | `App.tsx:63` `lazy(() => importBirdingStats())`; asserted absent |
| `NamedBirdRow.tsx` | **YES** | `App.tsx:29` static `NamedBirds` → `NamedBirdsTable.tsx:9` → `NamedBirdRow` |

`NamedBirdRow` is on the entry graph, which is exactly why it already reaches
`SightingsMap` only through `lazy(() => import('./SightingsMap'))`
(`NamedBirdRow.tsx:27`). It follows that:

- **`lib/useMapFullscreen.ts` and `lib/useFocusTrap.ts` must import nothing but
  `react` and each other.** `NamedBirdRow` imports the hook directly, so a single
  `react-map-gl` or `maplibre-gl` edge from either module puts the ~1 MB vendor
  chunk on first paint.
- **`components/map/MapCornerControls.tsx` must be reached only from
  `SightingsMap.tsx`, `SpeciesDetail.tsx` and `BirdingStats.tsx`** — never
  imported by `NamedBirdRow` directly, and never re-exported from an entry-graph
  module.

**No amendment to `entryChunk.test.ts` is needed, and none should be made**
(NFR-03 says it stays green unamended). Its existing assertion — *"no
statically-reachable file imports maplibre (vendor-maplibre off first paint)"* —
is already live against this exact risk, because `NamedBirdRow` is genuinely on
the walked graph and would surface the edge. If the Engineer wants belt-and-braces
proof that the two new lib modules are dependency-free, add it as a small
separate test file in the shape of that file's `closureFrom(...)` /
`registry.files.size === 1` check on `lib/clearDerived.ts`, and leave
`entryChunk.test.ts` untouched.

Nothing is added to `App.tsx`: no state, no prop, no import, no `inert`. Map
Explorer's `mapFullscreen` boolean, its scroll lock (`App.tsx:479-486`) and its
`chromeInert` (`App.tsx:712-719`) are not read, not shared and not modified —
`z-index: 1200` plus a focus trap inside the overlay is what replaces App's
cooperation here.

**Satisfies:** FR-23, NFR-03, NFR-07, QA-29, QA-34, QA-36.

---

### D-05 — The overlay needs an explicit resize on the live instance, and it belongs in `MapCornerControls`

**Decision: yes, implement it, and do not rely on `SnowMap`'s claim.**
`SnowMap.tsx`'s header comment advertises "auto-resize" and nothing in the file
implements one — no `ResizeObserver`, no `map.resize()` call, nothing. That
comment is documentation debt, not evidence, and OQ-01's default already says to
implement regardless. **The Engineer should also correct that comment in the same
change**, since it is the sentence that would talk the next person out of this.

**Where.** In `MapCornerControls`, which is inside `<SnowMap>` and therefore the
only new module with `useMap()` access to the live `MaplibreMap`:

```ts
const map = useMap().current
useLayoutEffect(() => {
  if (!map) return
  map.resize()                                        // after the class is on the DOM
  const raf = requestAnimationFrame(() => map.resize()) // dvh settles a frame later on iOS
  return () => cancelAnimationFrame(raf)
}, [map, expanded])
```

A layout effect runs after React has committed the container's new class and
before paint, and `map.resize()` reads `clientWidth`/`clientHeight`, forcing the
new geometry to be computed — which is FR-13's "after the new container geometry
is committed to layout". The second call on the next frame is for WKWebView,
where `100dvh` can settle a frame late; a redundant `resize()` is free.

**`resize()` preserves centre and zoom**, so it is not a re-frame and does not
put FR-14 at risk. QA-19 measures the canvas box against the container's content
box within 1px in both directions at 320px and desktop; QA-11 measures
`getCenter()`/`getZoom()` identical across the round trip.

**Gestures (FR-15 / OQ-02) belong in the same effect location, on the same
instance.** Drive `map.scrollZoom.enable()/disable()` and
`map.cooperativeGestures.disable()/enable()` from an effect on `expanded`, and
**leave the JSX props constant** — every in-scope mount passes literal
`scrollZoom={false} cooperativeGestures` today, react-map-gl only re-applies a
handler prop when its value changes, so constant props and imperative control do
not fight. Restore both on collapse and on unmount. If measurement shows either
handler cannot be driven without a re-create, FR-15's fallback applies: keep the
shipped gesture behaviour in both modes and say so plainly in `docs/HELP.md`.
Re-creating the map to change a gesture is not an acceptable trade.

**Satisfies:** FR-13, FR-15, OQ-01, OQ-02, QA-19, QA-21.

---

### D-06 — Load-bearing defect found: `MapBoundsFitter` re-frames on **every** `SightingsMap` re-render

**This is the finding most likely to sink the feature quietly, and it is in
shipped code.**

`SightingsMap.tsx` builds its fitter input inline:

```ts
const coords = markers.map(m => [m.lat, m.lng] as [number, number])
```

That is a **new array identity on every render**, and `MapBoundsFitter`'s effect
deps are `[map, coordinates]` (`components/speciesDetail/MapBoundsFitter.tsx`),
whose body calls `map.fitBounds(..., { duration: 0 })`. So **any** re-render of
`SightingsMap` snaps the map back to the fitted bounds.

Toggling fullscreen re-renders `SightingsMap`: the boolean is state in the
**host** (`SpeciesDetail`, `NamedBirdRow`), so a toggle re-renders the host,
which re-renders `<SightingsMap>` — it is not memoized, and the class change on
the container arrives in the same commit. (Note that context alone would not do
this; only consumers re-render on a context change. It is the host's own state
update that does it, which is why the fix is needed regardless of how the state
reaches the row.) Without a fix, **M1 and M3 re-frame on every expand and every
collapse**, which
fails FR-14, QA-20 and QA-11 — and would fail them in a way that looks like "the
overlay is broken" rather than "the fitter is unmemoized".

**Required fix, one line:**

```ts
const coords = useMemo(() => markers.map(m => [m.lat, m.lng] as [number, number]), [markers])
```

`markers` is already memoized at both call sites (`SpeciesDetail.tsx:446`,
`NamedBirdRow.tsx:48`, the latter with a comment stating that stable identity
is exactly what `MapBoundsFitter` needs), so the memo makes the fitter run when
the marker set genuinely changes and never otherwise.

**The Engineer should confirm the pre-existing symptom before fixing it** —
opening a pin popup on today's build also re-renders `SightingsMap` and should
therefore also re-frame the map. If it does, this is a shipped bug the feature
fixes on its way past, and it belongs in the `CHANGELOG.md` entry as such.

The other two mounts are already safe and need no change: M2's fitter takes the
memoized `uniqueCoords` (`SpeciesDetail.tsx:505`), and M4 frames via
`onLoad={e => fitToPins(...)}` (`BirdingStats.tsx:1142`), which fires once at map
load and cannot fire again without a remount.

**Satisfies:** FR-14, QA-11, QA-20.

---

### D-07 — Teardown is structural, not disciplinary

**Decision.** `useMapFullscreen` collapses and releases (scroll lock, `document`
keydown listener, trap, focus restore) on **all four** of: an explicit toggle,
`active` going false, `resetKey` changing, and unmount. Three of the four exist
because the FR-24 surfaces do not all unmount.

| FR-24 exit | Mechanism | Why the obvious answer is wrong |
|---|---|---|
| Species change on Species Detail | `resetKey={selectedSpecies}` | The map keeps its JSX position across a species change (recorded in `SightingsMap`'s `sharePinResetKey` comment), so **nothing unmounts** and unmount cleanup never runs |
| Named Birds row collapse | `active={open && showMap && cardMarkers.length > 0}` | `NamedBirdRow` stays mounted; only its `{open && (...)}` subtree unmounts (`NamedBirdRow.tsx:96`). A hook called at the row's top level sees no unmount |
| Statistics → open species from the county popup | `collapse()` inside the wrapped `onOpenSpecies` (`BirdingStats.tsx:128`, threaded to the popup at `:1184`) | The tab does unmount, so cleanup would cover it — but call `collapse()` explicitly so the release is deterministic and observable rather than racing a lazy tab teardown |
| Any host unmount | effect cleanup | — |

This also settles **OQ-06** ("does a Named Birds row unmount its card map?"): it
does unmount the map subtree but not the row, and `active` makes the answer
irrelevant either way, which is what OQ-06 asked for.

**Scroll lock (FR-20):** capture `document.body.style.overflow` before setting
`hidden` and restore the captured value, never `''`. Same shape as
`App.tsx:479-486`, which is the shipped precedent. The two locks can never
co-occur (different tabs), but capture-and-restore is what makes that not need
to be true.

**Satisfies:** FR-20, FR-24, OQ-06, QA-26, QA-30.

---

### D-08 — The focus trap: extract to `lib/useFocusTrap.ts`, entry-safe, behaviour-preserving for `ModalDialog`

**Decision: OQ-03's default — extract the trap. `inert` is rejected** for the
reason the PRD gives (it needs a host-specific ancestor on three surfaces and
risks inerting the map's own subtree).

**Where:** `frontend/src/lib/useFocusTrap.ts`, importing **only `react`**.

**Confirmed entry-safe, and the confirmation matters.** `ModalDialog.tsx` is on
`App.tsx`'s static graph — `App.tsx:30` imports `Settings` statically, and
`Settings.tsx:32` imports `./ui/ModalDialog`; it is the file's **only** importer.
`lib/useMapFullscreen.ts` is also on that graph (through `NamedBirdRow`, D-04).
So the extracted module is shared by two entry-graph consumers and **must stay
free of any map import forever** — which is precisely the module NFR-03 names by
example. `lib/` is the right home: it is where this repo already puts hooks
(`lib/useFilesEpoch.ts`, `lib/useKeysEpoch.ts`, `lib/useCountyCompleteness.ts`).

**What moves.** The Tab logic from `ModalDialog.tsx` verbatim, plus the
`FOCUSABLE` selector constant, which becomes the single copy:

```
'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
```

Re-query per Tab keydown (never cache), filter `[disabled]`, wrap last → first
and first → last, and the `focusables.length < 2` short-circuit. That is FR-18's
requirement and ModalDialog's shipped behaviour, identically.

**What does NOT move: Escape.** Each consumer keeps its own handler, because
their requirements differ and folding them would break one of them.
`ModalDialog`'s Escape calls `preventDefault()` then `onRequestClose()`. The map
overlay's must be a **bubble-phase `document` listener armed only while
expanded** (FR-17), so that `SharePopup`'s **capture-phase** `document` listener
with `stopPropagation()` (`components/map/SharePopup.tsx:133-142`) stays the
innermost dismiss layer: one Escape closes the share popup and the fullscreen
listener never fires; a second exits fullscreen. That is QA-23, and it works only
because the phases differ. The map's Escape lives in `lib/useMapFullscreen.ts` —
QA-08's "exactly one module" for the Escape handler.

**Trap root:** the container element the hook already holds
(`opts.containerRef`), so every control the overlay contains is inside it — base
switcher, `NavigationControl`, `AttributionControl`, marker buttons, popup links,
the share pin and its popup, and the corner row. Re-querying per keydown is what
covers the set changing as popups open and close.

**Behaviour preservation.** Extract ModalDialog's logic **unchanged**. If QA-24's
tab-order enumeration shows a hole when `document.activeElement` starts outside
the root (defensive only — the user is always on the toggle or the canvas when
expanding), add it as an **opt-in option defaulting to today's behaviour** so
`ModalDialog` stays byte-identical. Do not silently upgrade a shipped dialog while
extracting from it.

**Satisfies:** FR-16, FR-17, FR-18, FR-19, OQ-03, NFR-03, QA-08, QA-22, QA-23, QA-24.

---

### D-09 — Two containers carry inline styles a class can never override

**Not a data question, but it will stop FR-08 dead on two of three surfaces, so
it belongs here.**

FR-08 requires the expanded geometry to arrive **through a class**, explicitly
because an inline style is specificity 1,0,0 and would put the iOS safe-area
inset out of reach. Two of the three containers are inline-styled today:

| Container | Today | Required |
|---|---|---|
| `.sr-map-container` (M1, M2) | class only, `height: 380px` / `300px ≤640` | **no change** |
| `.sr-named-map` (M3) | class gives `height: 220px`; `borderRadius: 10, overflow: 'hidden', border: '1px solid var(--sr-border)'` are **inline** (`NamedBirdRow.tsx:164`) | lift all three into the `.sr-named-map` rule in `globals.css`, so the expanded class can drop border and radius per **OQ-07** and restore them exactly on collapse |
| Statistics (M4) | **no class at all**: `<div style={{ height: 320, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--sr-border) }}>` (`BirdingStats.tsx:1138`) | give it a real class (e.g. `.sr-geo-map`) in `globals.css` carrying all four declarations, and **apply the same class to the `mapReady` placeholder twin at `:1196`**, whose comment states it must keep the EXACT box so the `SnowMap` mount causes zero layout shift |

Inline `height: 320` in particular can never be beaten by `.sr-geo-map--expanded
{ height: 100dvh }`. Lifting is mandatory, not stylistic.

The expanded class itself takes the shipped panel's values verbatim
(`globals.css:1486-1491`): `position: fixed; inset: 0; height: 100dvh; z-index:
1200`, plus `background: var(--sr-bg)` for **FR-25** (App does exactly this for
the Map Explorer panel at `App.tsx:1309`), plus `border: none; border-radius: 0`
for OQ-07 while keeping `overflow: hidden`. The iOS rule mirrors
`globals.css:1513-1517` exactly: gated on `.sr-ios-app`, **never a bare `env()`**
(the web build ships `viewport-fit=cover` too), padding rather than a smaller box,
top/left/right only (**FR-22**). Because `box-sizing: border-box` is global and
`<MapGL style={{height:'100%'}}>` resolves against the container's *content* box,
that padding is what moves the base switcher's `top: 8px` clear of the status bar
and Dynamic Island in both rotations. Any phone-tier declaration goes inside the
established `@media (max-width: 640px)` block, not a new one (**NFR-02**).

`overflow: hidden` on an ancestor does **not** create a containing block for
`position: fixed`, so `SectionCard`'s `overflow: hidden`
(`components/speciesDetail/ui.tsx`) is harmless. Only `transform`, `filter`,
`backdrop-filter`, `perspective`, `contain` and `will-change` are, and FR-21 /
QA-27 require that to be **measured per surface in a browser** — including while
any entrance animation is running, since `globals.css` carries several keyframes
that animate `transform`. Do not infer it from this note.

**Satisfies:** FR-08, FR-21, FR-22, FR-25, NFR-02, OQ-07, QA-09, QA-27, QA-28, QA-31.

---

## Risks Carried Forward

1. **D-06 is the silent one.** Unmemoized `coords` in `SightingsMap` re-frames
   M1 and M3 on every toggle. Fix it first; QA-11 and QA-20 both depend on it.
2. **D-09 is the blocking one.** Statistics' map box has no class at all, and
   inline `height: 320` cannot be overridden. Lift before writing the overlay
   rule, and remember the placeholder twin.
3. **D-04 is the irreversible-looking one.** A stray static import of
   `MapCornerControls` from `NamedBirdRow` puts maplibre on first paint.
   `entryChunk.test.ts` catches it; do not amend that file to make it pass.
4. **FR-21 must be measured, not reasoned.** Nothing in this document
   substitutes for checking the three ancestor chains in a real browser during
   an entrance animation.
5. **OQ-08 is load-bearing for this assessment.** Turning `switcher` on for the
   Named Birds card map while expanded would open a `data/settings.json` write
   path from M3 and make "no data layer changes" false. Keep `switcher={false}`
   in both states unless The Designer overturns it, in which case this
   classification must be revisited.

---

## No Data Layer Work Required

The Engineer can proceed directly to UI implementation. No migration needs to be
written or run for this feature, no backend route changes, no storage-seam write
is added, and `PRIVACY_POLICY.md` is unaffected.
