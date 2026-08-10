# Schema — Map Location Buttons

**Feature:** map-location-buttons
**Date:** 2026-08-10
**Stage:** 3 — The Architect
**Path:** Incremental (existing project, settled architecture)
**Source:** prd.md (approved), strategic-brief.md

---

## 0. Path assessment and the honest headline

**This feature has no data layer.** There is nothing to design at the schema
level, and the template is not going to be padded to pretend otherwise.

| Layer | Change |
|---|---|
| Database / tables | None. The app has no database. |
| Migrations | None. |
| Persisted state (`storage` seam) | None (NFR-02). No new key, no change to map-defaults or the saved Default Location. |
| Backend route | None (NFR-01). `backend/` is untouched. |
| Transport seam / `CACHED_GET_PATHS` | Untouched. No new path. |
| npm / Rust dependency | None. Every icon used is already in the installed `lucide-react`. |
| Tauri capability / permission | None. `lib/location.ts` and `src-tauri/src/location.rs` are untouched (NFR-01). |
| Network requests | None of its own (FR-09, FR-25). Basemap tiles for the panned viewport are the only outbound consequence, and they are the existing basemap behavior. |

The location capability this feature surfaces already ships on all four
platforms. `getCurrentLocation()` (`frontend/src/lib/location.ts`) fans out to
the macOS native command, the Windows Geolocation API, `tauri-plugin-geolocation`
on iOS, and `navigator.geolocation` on web, funnelling into one `LocationError`
shape with `describeLocationError()` for the wording. `handleUseMyLocation`
(`MapExplorer.tsx:959`) already detects, fills the coordinate fields, sets
`detectedLocation`, pans via `setPanTarget`, and conditionally auto-searches.

So the architecture here is **component placement, state ownership, and a
handful of named traps**. That is what follows.

---

## 1. Component placement and ownership

### 1.1 The location button is a direct child of the cluster. No second slot, no portal.

`.sr-map-fab-slot` (`globals.css:1468`, `display: contents`) exists to solve a
problem the new button does not have. `SharePin` must be a `<SnowMap>` child
because it needs `useMap()` for the drop gesture and the marker, yet its button
must appear in `.sr-map-fab-cluster`, which lives **outside** `<SnowMap>`. The
portal plus the transparent slot is the bridge across that boundary.

The location button has no such split. `handleUseMyLocation`, `isLocating`, and
`geoError` are all in `MapExplorer`'s own scope, in the same JSX region as the
cluster (`MapExplorer.tsx:2176`). It is written inline as a cluster child.

**Do not** add a second `.sr-map-fab-slot`, and **do not** use CSS `order`
(FR-10). A direct child in DOM position 2 gives DOM order = visual order = tab
order for free, which is the whole reason `display: contents` was chosen over
`order: -1` for the share slot in the first place (WCAG 2.4.3, recorded in the
comment at `globals.css:1465`).

### 1.2 Position in the cluster

Ratifying PRD **Q2**: immediately after `.sr-map-fab-slot`, before the
fullscreen toggle.

```
.sr-map-fab-cluster
  ├─ div.sr-map-fab-slot        (display: contents; SharePin portals here — My Sightings only)
  ├─ button.sr-map-locate-btn   ← NEW
  ├─ button.sr-map-fullscreen-btn
  └─ button.sr-map-filters-btn  (mobile only, via CSS display)
```

No shipped control changes DOM position. The share slot still precedes
fullscreen, which still precedes Filters (FR-10, QA-14). On the three center
views the slot renders nothing, so the location button is simply the first
visible item — no special casing.

### 1.3 It renders whenever the cluster renders

FR-01 and FR-02 read together: no gate on `viewMode`, on `isSetupRequired`, on a
loaded backup, or on a stored API key. The only gate is the cluster's own
`!sidebarOpen` (FR-12).

**One residual, named rather than hidden.** On `sightings` **and**
`isSetupRequired`, `<SnowMap>` is replaced by `<SetupRequired>` (`:2207`) while
the cluster still renders above it. A press there detects successfully and sets
`panTarget`, but there is no `MapEffects` mounted to consume it, so nothing
visibly recenters and `handlePanDone` never fires — `panTarget` stays armed and
applies the moment a map does mount.

Accepted as-is. It is harmless (the fly-to is to the user's own detected point,
which is what they asked for), and the alternative — gating the button on the
map being mounted — reintroduces exactly the data-dependent gate FR-02 forbids
and that QA-02 checks for.

---

## 2. State design

Three pieces of state, all session-scoped `useState` in `MapExplorer`. Nothing
is lifted, nothing is persisted, nothing is added to a context.

### 2.1 `geoError` — one value, one announcer

The ratified resolution to PRD **Q1**: the on-map region is the single
announcer; the sidebar's block at `:1032` keeps its visible text and **drops
`role="alert"`**.

The hard constraint shaping this is **QA-03: `handleUseMyLocation` must not
change**. The handler calls `setGeoError('')` and
`setGeoError(describeLocationError(...))` and nothing else. FR-14 needs a
sequence number. Both are satisfied by keeping the handler's call signature and
moving the sequence behind the setter:

```ts
// replaces:  const [geoError, setGeoError] = useState('')   (MapExplorer.tsx:248)
const [geo, setGeo] = useState<{ text: string; seq: number }>({ text: '', seq: 0 })
const geoError = geo.text
const setGeoError = useCallback((text: string) => {
  setGeo(g =>
    text
      ? { text, seq: g.seq + 1 }   // every message is a new announcement
      : (g.text ? { text: '', seq: g.seq } : g)) // clear; bail if already clear
}, [])
```

Properties this buys:

- `handleUseMyLocation` is **textually unchanged**. It still calls
  `setGeoError('')` / `setGeoError(msg)`. Its dep array at `:979` does not list
  `setGeoError` today (a `useState` setter is stable); the `useCallback` with
  `[]` deps is equally stable, so the dep array does not change either. `git
  diff` shows zero lines inside the handler (QA-03).
- The seq advances on **every** message, including an identical repeat.
- The clear path does not advance the seq, so clearing cannot itself announce.
- The `g.text ? … : g` bail means the `setGeoError('')` at the top of every press
  is a no-op re-render when there was no error.

Declare the wrapper **above** `handleUseMyLocation` (before `:959`).

**Exactly one announcer, structurally.** There are only two call sites of
`setGeoError` in the file (`:960`, `:975`), and after this change there is
exactly one element in the tree carrying an aria live role for this value. The
sidebar block becomes a plain `<div>` with the same inline style. The Settings
tab has its own independent location-failure block; it is out of scope (PRD),
lives in a different component with its own state, and is inside a
`display: none` panel whenever Map Explorer is on screen, so it cannot
double-announce.

Accepted and deliberate: on a desktop center view the same sentence is visible
twice (sidebar and map). FR-15 constrains announcements, not visible copies, and
the PRD ratified keeping the sidebar's text.

### 2.2 `isLocating` — the busy guard lives on the button, not in the handler

Ratifying PRD **Q3**: `aria-disabled`, not `disabled`. Disabling a focused
button moves focus to `<body>` in most browsers, which breaks FR-06 for the
button the user just pressed.

The re-entrancy guard (FR-05) therefore cannot go in `handleUseMyLocation`
(QA-03). It goes in the new button's own `onClick`:

```tsx
onClick={() => { if (isLocating) return; void handleUseMyLocation() }}
aria-disabled={isLocating}
aria-label={isLocating ? 'Locating your position' : 'Center the map on my location'}
```

The sidebar control keeps its shipped `disabled` (out of scope, and it is not
the focused element in the FAB case).

The two accessible names above are distinct from the share pin's ("Drop a pin at
the map center" / "Move the pin to the map center") and the fullscreen toggle's
("Enter fullscreen" / "Exit fullscreen"), satisfying FR-07 / QA-10. Exact wording
is the Designer's; the **constraint** is that all six strings stay pairwise
distinct and non-empty.

### 2.3 Clearing on a view-mode change (FR-17)

`setViewMode` has exactly one call site (`:2075`, the mode-bar button's
`onClick`). Add `setGeoError('')` there. Do **not** use a `useEffect` mirror on
`viewMode` — that is a setState-in-effect, an extra render, and the repo already
rejected that shape for the shading exclusion (`nextShadingState`).

Clearing on success is already covered: the handler's leading `setGeoError('')`
runs before the await resolves, so by the time a success commits the text is
empty (QA-23).

---

## 3. The failure message region

### 3.1 Placement — outside `<SnowMap>`, inside the map-area div

The region is a plain DOM sibling of the loading chip and the FAB cluster,
inside `<div style={{ flex: 1, position: 'relative' }}>` (`:2158`). It is **not**
a `<SnowMap>` child.

This is the single most important structural choice in the feature, because it
means the message touches **none** of the maplibre machinery: no `<Source>`, no
layer, no sprite, no marker, no `useMap()`. See §5.

It also means the region survives both branches of the `isSetupRequired`
ternary and both states of `sidebarOpen`, so it is present in the DOM from first
render (FR-14, QA-20).

### 3.2 Shape

```tsx
{/* Present from first render (QA-20). The container is unstyled and invisible
    when empty; the pill styling lives on the keyed child. */}
<div className={`sr-map-geo-error${chipVisible ? ' sr-map-geo-error--below-chip' : ''}`}
     role="status" aria-live="polite">
  {geoError ? <span key={geo.seq} className="sr-map-geo-error-msg">{geoError}</span> : null}
</div>
```

- **Container carries position, not appearance.** An always-mounted region that
  carried the pill's background and border would render an empty bordered pill.
  Positioning on the container, appearance on the child, so empty is invisible
  with no `:empty` rule.
- **`key={geo.seq}`** is the repo's live-region contract: `aria-live` fires on
  DOM mutation and React bails on reconciling identical text, so the message must
  sit in a sequence-keyed child (`SharePopup.tsx:263` is the shipped reference).

**Honesty note for The Engineer and for QA-19.** In the shipped press sequence
the leading `setGeoError('')` commits before the await resolves, so the message
node genuinely unmounts and remounts between two failures — which means a naive
"press twice, count mutations" test **passes even without the key**. This is the
exact false-confidence case CLAUDE.md records. The key is still required by
FR-14 and still correct; write the test so it actually discriminates, by driving
`setGeoError(msg)` twice with no intervening clear (the state-level path), not
only through the two-press UI path.

### 3.3 Tokens (NFR-03)

Use the pair the tokens were tuned for, rather than inventing one:
background `--sr-error-bg`, border `--sr-error-border`, text `--sr-error`. The
`:root` comment at `globals.css:44` records `--sr-error` as darkened
specifically to reach 4.82:1 on `--sr-error-bg`; the dark theme pair
(`#F87171` on `#1C0505`) clears AA comfortably. No new token, and no new
parse-the-tokens contrast test is needed — this pair is already an audited pair.

### 3.4 Occlusion and pointer transparency (FR-16)

`.sr-map-loading-chip` is the precedent: `position: absolute; top: 12px;
left: 50%; transform: translateX(-50%); z-index: 1050; pointer-events: none`.
Top-center is clear of the `NavigationControl` (top-left), the layer switcher
(top-right, `SnowMap.tsx:216`), and the FAB cluster (bottom-right), given a
bounded max-width.

The two can co-occur (a search already in flight when a locate press fails), and
two elements at `top: 12px` would overlap. Resolution, without touching the
shipped chip rule: a `--below-chip` modifier that lowers `top`. The chip's
visibility boolean is already computed inline at `:2162`; extract it to a
`const chipVisible` and reuse it for both.

**Leave `.sr-map-loading-chip` alone.** Lifting both into a shared flex-column
stack is tidier on paper but rewrites a shipped rule (including its inline
`maxWidth` override) for a rare co-occurrence of two `pointer-events: none`
elements. Not worth the regression surface.

---

## 4. Shared-component blast radius: the share glyph

`SharePin` is mounted by five surfaces: Map Explorer My Sightings
(`MapExplorer.tsx:2283`), Species Detail pins mode and Named Birds card maps
(both via `SightingsMap.tsx:108`), Species Detail heatmap mode
(`SpeciesDetail.tsx:1176`), and the Statistics geographic map
(`BirdingStats.tsx:867`).

**Decision: a straight swap inside `SharePin.tsx`.** Replace the `MapPin` import
and its single use at `:137` with `FlagTriangleRight`. Not a prop, not an
exported constant.

The reasoning is the repo's own `compact` discipline, applied rather than
reinvented: *the choice belongs where the display decision is made.* The glyph's
job is to match `SharePinSprite` — a vertical staff with a right-pointing
triangular pennant and a foot circle (`:53-56`). That sprite lives inside
`SharePin` and is identical on all five surfaces. The decision is therefore made
inside `SharePin`, and there is no per-surface variation to express.

What the alternatives cost:

- **A prop.** Five call sites must answer a question they have no stake in, all
  five answer it identically, and the glyph gains the ability to drift from the
  sprite it is supposed to describe. This is precisely the "invisible choice
  relocated into a wrapper's call site" failure `compact` documents.
- **An exported constant.** Indirection with exactly one consumer. Reach for it
  only if something outside `SharePin` ever needs the same glyph.

Icon choice: `FlagTriangleRight` matches the sprite's silhouette (vertical staff,
right-pointing triangle). `Flag` is a wavy banner and does not. Both exist in the
installed `lucide-react` (verified in `node_modules`). Final call is the
Designer's; the **constraint** is FR-21 — the location and share glyphs must be
different silhouettes in grayscale.

Everything else in `SharePin` is untouched (FR-20, QA-26): both accessible
names, `aria-pressed`, `title`, `compact` sizing, the drop gesture, the drag, the
popup, `plantSeq`, and the sprite itself.

Location glyph: `Navigation`, matching the sidebar control at `:1028` (FR-18).
It is already imported in `MapExplorer.tsx:2`. An arrow against a flag is
unambiguous without color. If the Designer prefers `LocateFixed` or `Crosshair`
(both installed, `Crosshair` already imported), **change the sidebar's glyph in
the same edit** — FR-18's point is that the two controls doing the same thing
read as the same thing, and that is a two-site invariant.

---

## 5. Surface boundary: which map gets what

| Surface | Location button | Share glyph |
|---|---|---|
| Map Explorer — My Sightings | Yes | Yes |
| Map Explorer — Hotspots / Media Targets / Nearby Lifers | Yes | n/a (no share pin on center views) |
| Species Detail — pins mode (`SightingsMap`) | **No** | Yes |
| Species Detail — heatmap mode (inline `SharePin`) | **No** | Yes |
| Statistics — geographic map | **No** | Yes |
| Named Birds — card maps (`SightingsMap`) | **No** | Yes |

The three data-bounded surfaces are excluded because `MapBoundsFitter` frames
them to the user's own sighting data; a recenter would fight it and could fly the
view somewhere with no data at all.

**The boundary is structural, not a convention The Engineer has to remember.**
The location button is written inline in `MapExplorer`'s cluster JSX and closes
over `handleUseMyLocation`, `isLocating`, and `setGeoError`, all of which are
`MapExplorer`-local. It is not a component, not exported, and has no props. There
is no artifact to accidentally mount elsewhere. **Do not** extract it into
`components/map/` "for symmetry" — extraction is what would make the leak
possible.

---

## 6. Interaction with the existing map machinery

Assessed against the four traps CLAUDE.md records for this area.

**`<Source>` id changing between render branches.** *Not reachable.* This feature
adds no `<Source>`, no layer, and no branch inside `<SnowMap>`. The message region
is outside the map entirely (§3.1); the location button is outside the map; the
glyph swap changes one leaf `<svg>` inside an existing `<button>`. Nothing in the
change is near the Pins/Heatmap branch that shipped that crash.

**Sprite registration gated on `isStyleLoaded()`.** *Not reachable.* No
`addImage`, no `styleimagemissing`, no canvas sprite. Both glyphs are inline SVG
in the React tree.

**A cosmetic mode folded into a remount `key`.** *Reachable, and the thing to
watch.* NFR-05 / QA-36 require the glyph change to remount nothing. It does not,
today: `plantSeq` (`SharePin.tsx:163`) keys the pin marker on drops only,
`SightingsMap`'s `sharePinResetKey` keys on the species/entity, and
`MapBoundsFitter` runs off `markers`. The glyph is a leaf. **The one way to break
this** is to route the icon choice through any of those keys, or to add it to a
`<SharePin key=…>` at a call site. Do neither.

**Can the recenter disturb an open popup, the share pin, or a bounds fitter?**

- *Mechanism.* `setPanTarget` → `MapEffects` (`MapControls.tsx:23`) →
  `map.flyTo({ center, duration: 600 })`. Center only; zoom untouched; no
  remount; `onPanDone` nulls the target on a microtask.
- *Popups.* Map Explorer uses a single state-driven `<Popup>` per marker family,
  anchored to a `lngLat` and driven by `selected*LocId`. A `flyTo` moves the map
  beneath it. The popup stays open and stays anchored to its coordinate. Not
  dismissed. This is unchanged from what the sidebar button already does today.
- *The share pin.* Component-local state at a fixed coordinate. A `flyTo` does
  not touch it; the pin stays planted and scrolls out of view if the user is far
  from it. Identical to the shipped sidebar behavior, and accepted.
- *Bounds fitters.* Map Explorer does not mount `MapBoundsFitter` — that is
  `SightingsMap`, on the three surfaces that get no location button (§5). No
  conflict exists on Map Explorer by construction.
- *`BoundsTracker`.* Fires on `moveend` and recomputes the in-view marker lists.
  A `flyTo` is an ordinary pan; this already happens on every user drag. No new
  behavior.

Net: the recenter is the shipped pan path, reached from a second button. The only
genuinely new surface area is DOM chrome sitting above the canvas.

---

## 7. CSS additions — and the one real layout risk

All new layout in `globals.css` (NFR-06, QA-37). No new inline `display`,
`flexWrap`, `gap`, or `gridTemplateColumns`.

### 7.1 The cluster overflows at 320px / 200% once a fourth control is added

This is the finding most likely to fail QA-16 if it is not designed for, so it is
called out rather than left to be discovered.

`--sr-text-scale` multiplies the root font size, so at 200% `1rem` is `32px` and
the `2.75rem` phone-tier FAB (`globals.css:2023`) computes to **88px**, not 44px.

| | share | locate | fullscreen | Filters | gaps | total |
|---|---|---|---|---|---|---|
| today | 88 | — | 36 | ~120 | 20 | ~264 |
| with FR-04 button | 88 | 88 | 36 | ~120 | 30 | **~362** |

Available width inside a 320px viewport with the cluster's `right: 16px` is about
304px. Today it fits; with the fourth control it does not, and an absolutely
positioned overflowing cluster is exactly the shape that extends
`document.scrollWidth` (FR-11).

**Resolution:** let the cluster wrap, and give it a width cap so the wrap can
bind.

```css
.sr-map-fab-cluster {
  /* existing declarations unchanged */
  flex-wrap: wrap;
  justify-content: flex-end;
  row-gap: 10px;               /* `gap: 10px` already covers columns */
  max-width: calc(100% - 32px); /* responsive by construction, no breakpoint math */
}
```

The cap is not optional. CLAUDE.md records this exact trap from v0.5.82: a flex
container that is never narrowed has no reason to break a line, so `flex-wrap`
computes correctly and changes nothing. Adding the class is not evidence the
layout responds.

Wrapping preserves DOM order, so FR-10 and tab order are unaffected. The
containing block is the map-area div, so `100%` is the map's own width and the
desktop case (where Filters is `display: none`) is unaffected.

**Verification must be a real render, not a `scrollWidth` equality.** The repo's
v0.5.82 note applies directly: a broken build can read a clean integer
`document.scrollWidth` when the overflow is sub-pixel or absorbed by padding.
Measure each cluster child's box against the cluster's content box at 320px and
200%, in the browser.

### 7.2 New classes

```
.sr-map-locate-btn              /* 36px circle: the .sr-share-drop-btn visual
                                   declarations, incl. `flex: none` */
  @media (max-width: 640px)     /* width/height: 2.75rem (FR-04) */
.sr-map-geo-error               /* absolute, top-center, z-index 1050,
                                   pointer-events: none, bounded max-width */
.sr-map-geo-error--below-chip   /* lowered `top` when the loading chip is up */
.sr-map-geo-error-msg           /* the pill: --sr-error-bg / --sr-error-border /
                                   --sr-error, wrapping */
```

**On duplicating `.sr-share-drop-btn`'s declarations rather than extracting a
shared FAB base.** FR-04 forbids altering `.sr-map-fullscreen-btn` and
`.sr-share-drop-btn`, and `.sr-share-drop-btn` itself was written as a
deliberate duplicate of `.sr-map-fullscreen-btn` for the same reason (the comment
at `globals.css:1483` says so). The two also have different state vocabularies:
share has `aria-pressed`, locate has `aria-disabled` and a busy glyph. So this is
the house pattern, not an oversight. Record it as the third instance: **a fourth
map FAB should force the extraction of a shared base class**, in a change whose
scope permits touching the two shipped rules.

Also unchanged: `.sr-ios-app .sr-map-fab-cluster` already insets the whole
cluster, so the new button inherits safe-area handling with no new rule.

---

## 8. Files touched

| File | Change |
|---|---|
| `frontend/src/components/MapExplorer.tsx` | `geoError` state → `{text, seq}` behind a stable wrapper setter; new cluster button; new message region; `setGeoError('')` at the `setViewMode` call site; `role="alert"` removed from the sidebar block at `:1032` |
| `frontend/src/components/map/SharePin.tsx` | `MapPin` → `FlagTriangleRight` (import + one use) |
| `frontend/src/globals.css` | 4 new classes; `flex-wrap` / `justify-content` / `row-gap` / `max-width` added to `.sr-map-fab-cluster` |
| `docs/HELP.md` | FR-22 |
| `README.md`, `website/index.html`, `ROADMAP.md`, `ACCESSIBILITY.md` | FR-23 |
| `PRIVACY_POLICY.md` | FR-26 / Q4: verify, and add the cross-reference from "Your Location" to "Map Tiles" if the check shows the section reads as misleading alone |

Untouched, and verifiable by `git diff`: `lib/location.ts`,
`src-tauri/`, `backend/`, `handleUseMyLocation`'s body,
`SightingsMap.tsx`, `SpeciesDetail.tsx`, `BirdingStats.tsx`,
`.sr-map-fullscreen-btn`, `.sr-share-drop-btn`, `.sr-map-loading-chip`, the
share pin sprite, `SharePopup`.

`entryChunk.test.ts` (NFR-04) stays green by construction: no new static import
is added anywhere, and `SharePin.tsx` is already off the entry graph.

---

## 9. Handed to the Designer

1. Final glyph pair. Constraint: different silhouettes in grayscale (FR-21);
   the share glyph must read as the flag it plants; if the location glyph moves
   off `Navigation`, the sidebar control moves with it (FR-18).
2. Final accessible-name strings for the two button states. Constraint: all six
   cluster-control names pairwise distinct and non-empty (FR-07).
3. The `--below-chip` offset, and the message pill's max-width.

## 10. Handed to The Engineer as verification obligations

1. **QA-19 must actually discriminate.** Drive `setGeoError(msg)` twice with no
   intervening clear; the two-press UI path passes without the key (§3.2).
2. **QA-16 must be a browser measurement of element-vs-container**, at 320px and
   200% text scale, not a `document.scrollWidth` equality (§7.1).
3. **QA-03 is a literal diff assertion.** `handleUseMyLocation`,
   `getCurrentLocation`, and `describeLocationError` show zero changed lines.
4. **QA-15**: confirm no `order` declaration exists on `.sr-map-fab-cluster` or
   any descendant.
5. **QA-36**: confirm no marker set remounts and no bounds fitter re-runs on the
   four share-glyph-only surfaces.
