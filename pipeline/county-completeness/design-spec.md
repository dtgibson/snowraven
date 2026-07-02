# Design Spec — County Completeness

**Feature:** county-completeness
**Stage:** 4 — The Designer (approved)
**Mockup:** `pipeline/county-completeness/design.html` (approved direction)
**Design system:** `pipeline/design-system.md` — designed within it; the one
deliberate deviation (the toggle rename) is ratified below and logged in
`pipeline/county-completeness/decisions.md`.

## Visual Direction

Quiet utility, unchanged: Completeness reads as a peer of the shipped Species
and Checklists metrics, not a new surface. The existing county green ramp
carries all meaning; the popup's band-colored progress bar is the single color
moment on its surface, and the mode's online/key trade-off is disclosed in
plain muted text at the point of use — honest, small, never promotional.

## Screens / Views

### Map Explorer sidebar — County Lines & Shading section

The shipped section, extended in place:

- **County lines** toggle → sub-toggle → metric switch → Use Textures →
  legend: order and pixel styling identical to the shipped v0.5.53 markup
  (44×24 `role="switch"` toggles, 0.8125rem/500 labels, 0.6875rem muted
  captions).
- **RATIFIED — "Shade counties" rename.** The sub-toggle's shipped label
  "Shade by species seen" becomes **"Shade counties"**: it now governs three
  metrics, two of which are not "species seen." This is a deliberate deviation
  from the shipped label, approved by the user at the design stage (logged in
  `decisions.md`). The toggle's caption becomes metric-aware: the shipped
  backup-only sentence for Species/Checklists; for Completeness it reads
  "Tints each county by how complete your county list is — your backup
  measured against everything reported on eBird."
- **Metric switch:** the existing `SegControl` gains a third option —
  Species · Checklists · **Completeness** — same 28px buttons, 0.71875rem,
  active = surface + border + 600 weight, `aria-pressed`.
- **RATIFIED — disclosure placement (FR-34).** The point-of-use disclosure
  renders directly **under the metric switch, only while Completeness is
  selected**: info icon (Lucide, 14px) + muted 0.6875rem text — "Unlike
  Species and Checklists, Completeness needs a network connection and your
  eBird API key. Counties you've fetched are cached for 30 days." It is not a
  modal, not a banner, and it disappears when another metric is selected.
- **Use Textures** toggle is unchanged and composes with Completeness: the ten
  hatch density steps map to the ten percentage bands exactly as they map to
  count tiers.

### Legend (in the sidebar, below Use Textures)

- **Fixed 0–100% band behavior (FR-27):** while Completeness is active the
  legend shows ten swatches labeled as fixed equal ranges — "1–10%" through
  "91–100%" — under the title "Completeness — % of the county list". Swatches
  are the existing 26×15 rounded rectangles on `--sr-county-1..10` (or the
  `CountyDensitySwatch` crosshatch when Use Textures is on).
- The unshaded row keeps the dashed swatch, relabeled **"Not birded / not
  fetched — outline only."**
- The caption swaps from the quantile explanation to: "Fixed 0–100% bands —
  the same shade always means the same completeness, in every county."
- Switching back to Species/Checklists restores the shipped quantile legend
  byte-for-byte (title, count ranges, unit on the first row, quantile caption).

### Map

No new map visuals: the existing county fill/texture machinery paints band
1–10 as tier 1–10. Un-birded and unfetched counties stay plain outlines
(band 0), preserving the "plain outline = never birded" read. The mockup's
stylized SVG counties are illustrative only — the build uses the real
`CountyLayer` geometry.

### County popup — birded county (Variant A)

Top-to-bottom (extends the shipped popup; name/state/region link unchanged):

1. **Header:** county name as the shape-guarded eBird region link (accent +
   11px ExternalLink glyph) with the state name muted beneath — exactly as
   shipped.
2. **RATIFIED — count row retained.** The existing species/checklists
   `CountStat` row **stays** in Completeness mode (continuity with the other
   metrics). Neither number takes the accent-active state in this mode.
3. **Completeness block** (border-top separated, like every popup block):
   - "COMPLETENESS" 0.625rem/600 uppercase muted title.
   - Progress bar: 8px track (`--sr-surface-subtle` fill, 1px `--sr-border`,
     4px radius), fill colored by **the county's own band token**
     (`--sr-county-{band}`), width = display percent.
     `role="progressbar"` + `aria-valuenow/min/max` in the build.
   - Text line: "**128** of **312** species · **41%**" — numbers 700,
     tabular-nums, `--sr-text` (never accent).
   - **Labeling rule (FR-20):** the caption "Countable species — spuhs,
     slashes & hybrids don't count." sits directly under the line, so the
     countable X can never be confused with the count-row Species number when
     they differ.
4. **Recently added block:** title + caption "Your newest county species —
   from your backup, works offline." Up to 5 species, newest first, each a
   `<BirdName>`-rendered row (favicons + backbone-gated Species Detail link;
   these are by definition in the backbone, so they link) with the
   first-in-county date right-aligned, 0.6875rem muted, tabular-nums,
   month-day format ("Jun 14").
5. **Top targets block:** title + caption "On eBird's county list, not yet on
   yours · taxonomic order." Up to 5 rows: rank number (0.625rem/700,
   `--sr-text-disabled`, 11px column) + `<BirdName>` — accent link **only**
   when the species is in the user's loaded backbone, otherwise plain
   `--sr-text` name + favicons, never a fake link (FR-23). A one-line muted
   footnote explains the link convention.
6. **Cache line:** clock icon + "eBird data from N days ago — cached for
   30 days", 0.625rem muted.

### County popup — never-birded county, click-to-fetch (Variant B)

Same header and (zeroed, `--sr-text-disabled`) count row, then three states in
one block position — never a blank section:

- **Idle:** "You haven't birded {county} yet — it stays a plain outline." +
  the popup's single accent action, a **"Load completeness"** button (accent
  bg, 6px radius, refresh icon, hover `--sr-accent-strong`), captioned "One
  eBird request, for this county only · cached 30 days."
- **Pending (FR-33):** spinner + "Checking eBird for {county}…" — visible,
  bounded, `role="status"`.
- **Loaded:** empty progress track, "**0** of **287** species · **0%**",
  caption "0% — the county stays a plain outline on the map.", then the Top
  targets block (taxonomic-order slice — waterfowl leading is expected v1
  behavior and stays honest), then the cache line ("fetched just now").

### Degraded states (FR-29/30/31)

Three distinct honest states in the app's standard voice, surfaced in the
popup (replacing only the Y/percent/targets area — X and Recently added always
render), the shade control, and the counties-in-view rows:

- **No eBird key:** "eBird API key not configured. Add it in Settings." — no
  fetches attempted; cached counties still shade.
- **Offline:** cached counties keep shading; Recently added still works;
  clicking an uncached county states the offline condition — no spinner, no
  blank popup.
- **eBird error:** distinct from the other two; shaded counties keep shading;
  retry on next click; errors never cached.

### Counties in view (FR-28)

Per-county value column follows the metric: Completeness shows compact
"X/Y · Z%" (tabular-nums, 600) when known, or a muted italic honest state
("not fetched" / the applicable degraded state). Swatch dots follow the band
(dashed outline square for band 0), including density mini-swatches in
textures mode.

## Component Usage

- `SegControl` (MapSidebarUI) — gains the third option; no styling change.
- The shipped `role="switch"` toggle — reused as-is for Shade counties / Use
  Textures (rename is label-only).
- `CountyDensitySwatch` — reused unchanged for textures-mode legend and
  in-view swatches (bands feed the same tier prop).
- Popup blocks reuse the shipped structure: border-top separated sections,
  0.625rem uppercase titles, `CountStat`, the `OutboundLink` region link.
- **`<BirdName>`** for every species name (recent + targets): favicons via
  resolved taxon codes, Species Detail link gated on `hasEntry` (backbone).
  The mockup's neutral "eB/BW" favicon chips are placeholders only — the
  build renders the real `<BirdName>` favicons (eBird + Birds of the World).
- Lucide icons, 11–14px, stroke ~2.2, purposeful only: info (disclosure),
  external-link (region link), clock (cache line), refresh (load button),
  loader (pending), key/wifi-off/alert-triangle (degraded states).

## Design Tokens Applied

- **RATIFIED — no new tokens.** Everything renders from existing tokens:
  - Progress fill = the band's own `--sr-county-{1..10}`; track =
    `--sr-surface-subtle` + 1px `--sr-border`.
  - Text: `--sr-text` (numbers, names), `--sr-text-muted` (captions,
    disclosures, dates), `--sr-text-disabled` (zeroed CountStat, rank
    numbers), `--sr-text-gray` where the shipped popup uses it.
  - Accent (`--sr-accent` / `--sr-accent-strong` / `--sr-accent-bg`): linked
    bird names, region link, the Load completeness button, active toggles.
  - Swatch rings `--sr-border-medium`; the county ramp stays theme-identical
    (always-light basemap); the slate boundary-line literal stays the
    documented basemap-anchored exception.
- **One accent per surface (restraint rule):** in the birded popup the accent
  appears only on links; the completeness numbers are `--sr-text` and the
  band-colored bar is the surface's single color moment. In the un-birded
  popup the accent belongs to the one action button.

## Interaction Notes

- Metric switch re-shades in place (no map reload); legend, shade-toggle
  caption, disclosure visibility, and counties-in-view values all follow the
  metric. Species/Checklists behavior stays byte-identical (FR-06).
- Completeness participates in the existing shading mutual exclusion
  (`nextShadingState`), desaturation, heatmap re-order, and pin fade —
  `sr-county-fill` layer id unchanged (FR-03/05).
- Click-to-fetch: un-birded county click → one deduped fetch → pending →
  result; a 0% county remains unshaded; failed fetches retry on next click.
- Progressive shading as eager-fetch results arrive; hover states on all
  buttons; `aria-pressed` on seg buttons; progress bar exposes value
  accessibly; counties-in-view remains the keyboard route with full parity.
- Dark mode: app chrome (sidebar, popup, panels) themes normally; the map
  canvas and county ramp stay light by design.

## Content Notes

- Voice: informative, never promotional; honest about limits at the point of
  use (the disclosure line, the "0% stays an outline" caption, the taxonomic-
  order targets note). Alongside-eBird framing throughout — the feature's
  output is more eBirding.
- Numbers: tabular-nums everywhere counts align; percent display follows
  FR-10 (never 100% while incomplete, never 0% when started).
- All copy strings in the approved mockup are the intended shipping copy
  unless the Engineer hits a factual conflict; the three degraded messages
  reuse the app's standard `NO_KEY_MESSAGE` / offline / generic-error voice
  rather than inventing new phrasing.
- Real species names verified plausible for the sample counties; the build
  renders whatever the user's data and eBird return — no hardcoded species.
