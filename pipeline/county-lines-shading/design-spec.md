# Design Spec — County Lines & Shading

**Feature:** county-lines-shading
**Stage:** 4 — The Designer (approved)
**Approved mockup:** `pipeline/county-lines-shading/design.html`
**Design system:** extends SnowRaven's established system (`pipeline/design-system.md`,
values in `frontend/src/globals.css`). One deliberate, logged extension — the
green `--sr-county-1..4` choropleth ramp (see `decisions.md`). No new libraries,
no new patterns; every surface mirrors the shipped Breeding-Atlas overlay.

---

## Visual Direction

Quiet utility, exactly as the rest of SnowRaven. The county overlay is the
structural twin of the California Breeding Bird Atlas overlay — same two-level
toggle group, same maplibre popup chrome, same "in view" keyboard panel, same
theme handling — so it feels native on arrival rather than novel. The one new
visual element is a **single-hue green sequential choropleth ramp** that reads as
"more of my own coverage here": light mint for thin county lists deepening to
clover green for deep ones. Green is chosen deliberately so the county shading
stays instantly distinct from the **purple** breeding-atlas ramp and the two
overlays can be on at once without confusion. Restraint holds: no on-map labels,
no decorative color, the green carries the one meaning. Legible in both themes;
the map canvas itself stays light (anchored to the always-light Positron basemap,
matching the existing pins), while the sidebar, popup, and panels follow the
app theme.

---

## Screens / Views

All surfaces live on the **Map Explorer** (only — Species Detail / Statistics
maps are out of scope for v1).

### Map Explorer sidebar — "Map Overlays" control group
Mirrors the atlas toggle group exactly, added to the same shared "Map Overlays"
block so it appears across all view modes (My Sightings, Hotspots, Nearby Lifers,
Media Targets).

- `SidebarLabel` "Map Overlays" (uppercase, 0.6875rem/700, letter-spacing 0.07em,
  muted), top border separator.
- **County lines** — a row: label (0.8125rem/500, `--sr-text`) + a 44×24 toggle
  switch (`role="switch"`, `aria-checked`); sub-note (0.6875rem muted, line-height
  1.4): "US county boundaries, shown for the current map area." Default OFF.
- **Shade by species seen** — appears only when County lines is ON. Same 44×24
  switch; sub-note "Tints each county by your own count there — drawn only from
  your loaded backup." Default OFF. **Disabled** (opacity 0.55, `aria-disabled`,
  `not-allowed` cursor) when no backup is ready, with the note "Load your eBird
  backup in Settings to use this."
- **Metric `SegControl`** — appears only when shading is ON. Two segments
  *Species* / *Records* (the shared `SegControl`: `--sr-surface-subtle` track,
  active = `--sr-surface` + 1px `--sr-border` + 600 weight, `aria-pressed`).
  Default *Species*.
- **Legend** (below the SegControl) — see Choropleth legend.

Key decisions: no "Use Textures" sub-toggle (hatch is out of scope for the
county ramp — the sequential green is used as-is, simpler than the atlas);
the whole group (shade toggle, metric, legend, popup, in-view panel) collapses
when County lines is turned off.

### Map canvas — the choropleth
- County polygons filled by tier from the green ramp at `fill-opacity ~0.85`;
  unrecorded counties (tier 0) are `fill-opacity 0` (plain outline) but remain
  hit-tested so their popup still opens.
- Boundary lines: `line-color rgba(71,85,105,0.85)`, `line-width 1.3` (the atlas
  line value), `line-join round`.
- Viewport-capped, recomputed on `moveend`; over-cap / far-zoom draws nothing
  and shows the "Zoom in to see counties" chip. No on-map name labels (v1).

### Choropleth legend
- Section title (0.6875rem/700 uppercase muted): "Distinct species per county"
  (Species) / "Total checklists per county" (Records).
- Up to 4 rows, each: a 26×15 swatch (the tier's `--sr-county-N`, 1px
  `--sr-border-medium`, radius 3) + a range label (0.75rem `--sr-text`), the
  first row carrying the unit (e.g. "1–57 species"). Realistic example breaks —
  Species: 1–57 / 58–119 / 120–223 / 224+; Records: 1–120 / 121–430 / 431–985 /
  986+.
- A trailing "No records — outline only" row with a dashed empty swatch.
- Foot note (0.6875rem muted): "Ranges are quantiles of *your* non-zero counties,
  so the breaks shift with your data."
- Data-driven: quantile breaks over the user's own non-zero county values for
  the active metric, mapped onto tiers 1–4. Collapses to fewer classes on ties /
  small datasets; on zero non-zero counties it is replaced by an honest note
  (see Empty states), no fills drawn.

### County popup
Single state-driven popup, atlas-popup structure/spacing (surface bg, 1px border,
radius 10, `--sr-card-shadow`, padding 12/14, 0.8125rem, bottom anchor tip).
Top to bottom:
- **County name** — `--sr-accent` 0.8125rem/600, with the lucide `ExternalLink`
  glyph, linking to `ebird.org/region/US-{ST}-{FIPS}` **only** when a valid
  region code is derivable (shape-guarded); plain `--sr-text` text otherwise
  (non-US / malformed code), never a styled 404 link.
- **State/Province** subtitle (0.6875rem muted).
- **Two headline counts** side by side: species count and checklist (records)
  count (number 1.0625rem/700; label 0.625rem uppercase muted). The *active*
  metric's number is accented; both are always shown regardless of the metric.
- **Contextual top-3** (separated by a top border) that **swaps with the active
  metric**:
  - *Species mode* → title "Most recorded here", the county's **top 3 species**
    by record count (e.g. California Scrub-Jay 941, Anna's Hummingbird 907,
    Spotted Towhee 833). Each: rank + name + count. Render names through
    `<BirdName>` semantics (common name; link gated on `hasEntry`; favicons via
    taxon code).
  - *Records mode* → title "Top locations", the county's **top 3 locations** by
    checklist/record count (e.g. Point Pinos 412, Carmel River State Beach 286,
    Andrew Molera SP 213). Location names may route through
    `HotspotLink`/`isPublicHotspot` when a public hotspot id resolves (plain
    text otherwise — same guard posture as the region link).
  - Unrecorded county → honest empty line "No species recorded here yet."
- Works on any county in view, including 0-record counties (popup shows 0/0).
- A click landing on a marker layer above the fill (sighting circle / hotspot
  teardrop) does not open the county popup (marker-layer arbitration).

### "Counties in view" keyboard disclosure panel
AA parity with the atlas "Atlas blocks in view" panel — the keyboard route to a
county popup (the on-map fill is a pointer-only canvas hit-test).
- Absolute, bottom-left of the map, surface bg, 1px border, radius 8, width
  `min(232px, 62%)`, max-height ~62%.
- Disclosure header (0.71875rem/700 uppercase, letter-spacing 0.06em, muted,
  `aria-expanded`) "Counties in view (N)" with a rotating chevron.
- Rows (focusable `<button>`, `aria-pressed` for the selected county): a tier
  swatch dot (dashed when tier 0) + county name (0.78125rem, ellipsis) + the
  active metric's count (tabular, 700; muted/600 when zero). Hover →
  `--sr-surface-subtle`; selected → `--sr-accent-bg` + `--sr-accent-border`.
  Activating a row opens that county's popup and centers it.
- Capped with an over-cap "Showing the first N … — zoom in to narrow the list"
  foot note.

### Empty / edge states
- **No backup loaded** — County lines works (boundaries only); the Shade toggle
  is disabled with "Load your eBird backup in Settings to use this."
- **Zero non-zero counties** — shading on but nothing to shade: no fills, an
  honest note "No recorded counties to shade. Add records or load a backup with
  county data to see the choropleth." County lines still draw.
- **Over-cap / zoomed too far out** — no geometry drawn; a non-blocking chip
  (surface bg, 1px border, radius 6, 0.71875rem muted, lucide zoom-in icon):
  "Zoom in to see counties."
- **First enable — geometry loading** — the control shows a spinning line
  "Loading county boundaries…" while the on-demand geometry chunk fetches, then
  clears.

---

## Component Usage

- **Toggle switch** — the shipped 44×24 / 20px-knob switch from `MapExplorer`'s
  atlas group (`role="switch"`, `aria-checked`, `--sr-accent` on / `--sr-border-
  medium` off). Used for County lines and Shade-by-species. (No textures toggle.)
- **`SegControl`** (`components/map/MapSidebarUI.tsx`) — the metric Species/Records
  toggle, `aria-pressed` exposed.
- **`SidebarLabel`** — the "Map Overlays" header.
- **Legend swatches** — small bordered color chips (not the atlas
  `TierHatchSwatch`; the county ramp is flat color, no hatch).
- **maplibre `<Popup>`** — single state-driven popup, themed via the existing
  `.maplibregl-popup-content` rules in `globals.css`.
- **`<BirdName>`** — top-3 species names in the popup (common name; link gated
  on `hasEntry`; favicons via taxon code).
- **`HotspotLink` / `isPublicHotspot`** — optional linking of top-3 location
  names; `OutboundLink` + the region-code shape guard for the county name link.
- **Lucide icons** — `ExternalLink` (region/location links), chevron (panel
  disclosure), zoom-in / info / loader (chips and notes). 11–15px, purposeful.
- **Maps** — rendered inside the existing `<SnowMap>` / Map Explorer map; the
  county overlay is the new `CountyLayer.tsx` (atlas-twin), not a new map wrapper.

---

## Design Tokens Applied

All existing values come from `frontend/src/globals.css` unchanged. The one
addition is the county ramp.

### New token family — `--sr-county-1..4` (the green choropleth ramp)
Map-anchored to the always-light Positron basemap, so the fill values are
**identical in both themes** (same posture as `--sr-map-pin-*`). On-map fills use
the solid color at `fill-opacity ~0.85`; legend swatches use the solid color with
a `--sr-border-medium` border. Legend label text uses `--sr-text` /
`--sr-text-muted` (theme-flipping, AA in both themes). There is no on-fill text on
the map, so no on-fill contrast pair is introduced.

| Token | Value | RGB triplet |
|---|---|---|
| `--sr-county-1` (lightest / thinnest list) | `#C3E8D1` | `195,232,209` |
| `--sr-county-2` | `#7FCB9E` | `127,203,158` |
| `--sr-county-3` | `#3E9C66` | `62,156,102` |
| `--sr-county-4` (darkest / deepest list) | `#1A5C38` | `26,92,56` (= `--sr-accent-strong` light) |

Declared identically in both `:root` and `[data-theme="dark"]`. Add the `-rgb`
triplets alongside (rgba-with-alpha pattern, per the token rules). AA must be
re-verified with the project's luminance math before shipping, per NFR-07 — the
mockup values were chosen to pass.

### Existing tokens reused
- `--sr-accent` / `--sr-accent-bg` / `--sr-accent-border` / `--sr-on-accent` —
  toggles on-state, selected in-view row, popup region link, metric active.
- `--sr-tier-1..4` — **only** referenced in the design rationale (the purple
  ramp the county ramp is deliberately distinct from); not used to shade counties.
- `--sr-surface` / `-subtle` / `-faint`, `--sr-text` / `-muted` / `-disabled`,
  `--sr-border` / `-medium`, `--sr-warning-*` — sidebar, popup, panel, chips,
  notes.
- County boundary line: `rgba(71,85,105,0.85)` @ 1.3px (the atlas line value).

---

## Interaction Notes

- **Two-level toggle**, session-scoped, shared across view modes, not persisted
  across relaunch (mirrors `atlasEnabled`/`shadeByBreeding`): County lines →
  Shade by species → metric. Turning County lines off collapses the whole group
  and closes any open popup.
- **Metric switch (Species ⇄ Records) re-tiers everything in lockstep:** recompute
  quantile breaks over the chosen metric's non-zero values, redraw fills, relabel
  the legend, swap the in-view counts, **and swap the popup's bottom top-3**
  (top species ↔ top locations). The popup's two headline counts always show both.
- **Popup open** from a pointer click on the fill (with marker-layer arbitration)
  or from a "Counties in view" row (which also centers the county). Single popup
  per map.
- **Theme change** re-resolves fill colors from the tokens at runtime via a
  `data-theme` MutationObserver (the atlas pattern). The county ramp values are
  the same in both themes (basemap-anchored); the surrounding chrome flips.
- **Viewport / cap / loading:** geometry recomputed on `moveend`; over-cap shows
  the zoom-in chip; first enable shows the loading line while the on-demand chunk
  fetches; once loaded, **zero network calls**.
- **Data-model note for the Engineer — `CountyAggregate` carries the top-3.** The
  per-county aggregate must now carry, in addition to the species/records totals:
  **top-3 species by record count** and **top-3 locations by checklist/record
  count**. Both are derivable from the already-parsed backup with **zero new
  network calls** — the rows carry `county`, `stateProvince`, the species
  (name + taxon), and the location name/id. `buildCountyAggregates` extends its
  existing per-`countyKey` pass to also accumulate a species→record-count map and
  a location→checklist-count map per county and emit the bounded top-3 of each
  (top-k, not a full sort). No geometry / no point-in-polygon (consistent with
  FR-09). Fold this into the planned `computeGeo` re-key (schema §2.3) and its
  tests; memoize with the existing aggregate so it is not recomputed during
  render (NFR-01 / `react-hooks/purity`).

---

## Content Notes

- **Tone:** informative, plain, never promotional — quiet-utility voice. Notes
  state what's true and the next step ("Load your eBird backup in Settings to use
  this", "No recorded counties to shade.").
- **Realistic content only** (the mockup uses believable California data):
  counties Sonoma / Napa / Yolo / Sacramento / Alameda / Monterey / San Joaquin /
  Stanislaus / San Mateo / Santa Cruz / Mendocino / Merced with plausible
  per-county species and checklist counts; popup example Monterey County,
  California — 264 species / 1,148 checklists; top species California Scrub-Jay /
  Anna's Hummingbird / Spotted Towhee; top locations Point Pinos / Carmel River
  State Beach / Andrew Molera SP. Verify any hardcoded bird names against the live
  eBird taxonomy before shipping (the project's standing rule); the build's real
  data is the user's own, so these are mockup placeholders only.
- **No on-map county name labels** in v1 — names appear in the popup and the
  "Counties in view" panel.
- **County name link wording** follows the shared eBird-link accessible-name
  formula ("Open {name} on eBird (opens in a new tab)").
- **US-only v1** — the popup's plain-text-name (no region link) case is the
  honest treatment for non-US / malformed-code counties.
