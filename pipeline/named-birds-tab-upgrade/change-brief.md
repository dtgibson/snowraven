# Change Brief — Named Birds Polish

## What is changing
Five scoped polish fixes to the Named Birds tab — all aesthetic/clarity or a
sort option, no new surface or data model:
1. Raise overall contrast of the tab content.
2. Fix the card-header baseline misalignment between the individual name and
   the species name.
3. Give each sighting's comment a distinct, token-based background so it reads
   as separate from the card.
4. Rework the sort control to exactly four options to match other pages:
   **Name (Individual)**, **Alphabetical**, **Taxonomic**, **Last Seen**.
5. Show each report's location text between the date and the checklist link.

A sixth item — a per-individual sightings map mirroring Species Detail — was
requested after the brief was drafted. It is **flagged and recommended for a
separate New Feature session**, NOT bundled into these five. See item 6 below
and the feature-check at the bottom.

## Why now
Direct user request after using the shipped 0.5.23 feature: the tab is "a bit
hard to see," the header is visibly misaligned, comments blend into the card,
the sort set is inconsistent with the rest of the app (no Taxonomic), and the
location every other tab shows is missing here.

## User-facing impact
Aesthetic shifts (contrast, comment background, header alignment) and two
visible-but-not-new additions: a Taxonomic sort pill (same capability already
on other tabs) and the per-report location string (already in the user's
export, already shown on Species Detail / Stats / Media Comments). No new data
is modeled, no new flow, no new copy authored from scratch. See feature-check.

## Decisions touched
**None.** No `DECISIONS.md` entry is reversed or modified. This builds on the
v0.5.23 "Named Birds" entry (lines 1270+) and the v0.5.24 taxonomic-sort
plumbing without changing either's recorded decision. The Chronicler will log
this as a polish follow-up, not a reversal.

## What done looks like
- The four sort pills read exactly **Name (Individual) · Alphabetical ·
  Taxonomic · Last Seen**; Taxonomic orders by eBird taxonomy; all four sorts
  stable; `namedBirds.test.ts` + `NamedBirdsTable.test.tsx` updated and green.
- Header name/species share a baseline; comments sit on a distinct token
  background; location renders between date and checklist link on every report.
- All colors are `var(--sr-*)` tokens (any new token added to both themes).

---

## Per-item detail

### 1. Visibility / contrast — `NamedBirdsTable.tsx` (+ maybe `globals.css`)
**Now:** Several elements lean on the lowest-contrast tokens. The header
date-range and the checklist link both use `0.6875rem` (11px) text; the
date-range, the expand-row date, and the species fallback use `--sr-text-muted`
(dark `#A1A1AA`), and the "N named birds" count uses `--sr-text-disabled`
(dark `#52525B`, barely visible on `--sr-bg #09090B`). The comment uses
`--sr-text` but sits on a near-invisible panel (see item 3). Net effect reads
as low-contrast, especially in dark mode.
**Fix:** Lift the weakest offenders — promote the per-sighting date and the
date-range from `--sr-text-muted` toward `--sr-text` where it reads as primary
data, and avoid `--sr-text-disabled` for anything that's real content (it's
fine for the passive count). Nudge the smallest `0.6875rem` text up a step
(`0.75rem`) where legibility is the complaint. Prefer reusing existing tokens
over inventing new ones; only add a token if a genuinely new shade is needed
(and then add it to BOTH `:root` and `[data-theme="dark"]`). The Engineer
should eyeball both themes — this is a judgment-light contrast pass, not a
redesign.
**Files/symbols:** `frontend/src/components/NamedBirdsTable.tsx` (inline styles
on the header row, expand-row, and sort group); `frontend/src/globals.css`
only if a new token is justified.

### 2. Name/species baseline alignment — `NamedBirdsTable.tsx` + `BirdName`
**Now:** In the header `<button>` (line ~68), the individual name is a plain
`<span>` at `0.875rem / weight 600` with `alignItems: 'center'` on the flex
row; the species is `<BirdName size="sm">`, whose root `.sr-birdname` is
`display: inline-flex; flex-direction: column; vertical-align: top` and whose
text runs at `0.78125rem`. Two different font sizes centered in a flex row read
as baseline-misaligned (the screenshot's "Grosbeak" vs "American Crow"). The
favicons (`SpeciesLinks`) inside `.sr-birdname-row` add further vertical noise.
**Fix:** Align the two on a shared baseline. Cleanest in-component options
without touching the shared `BirdName`: keep `alignItems: 'center'` but match
the visual weight/optical baseline, OR switch the name+species wrapper to
`alignItems: 'baseline'`. Because `.sr-birdname` is a column flex container, a
row-level `baseline` aligns to its first line — verify in jsdom/visually. If a
clean fix needs a `BirdName` tweak, prefer adding/using the `sr-birdname-inline`
path (already `flex-direction: row; align-items: center`) rather than changing
global `BirdName` behavior other tabs depend on.
**Files/symbols:** `frontend/src/components/NamedBirdsTable.tsx` (the name
`<span>` + the `renderSpecies` wrapper `<span>` and their flex parent, ~lines
80–87). Touch `BirdName.tsx` / `globals.css` `.sr-birdname*` only if
unavoidable, and only additively.

### 3. Comment background — `NamedBirdsTable.tsx`
**Now:** The expanded panel is `background: var(--sr-surface-faint)` (light
`#FAFAFA` vs card `#FFFFFF`; dark `#1C1C1F` vs card `#18181B`) — a 4-LSB
difference that is effectively invisible, so the comment text appears to sit on
the card with no separation.
**Fix:** Give the comment its own `<div>` a distinct token background — e.g.
`--sr-surface-subtle` (light `#F4F4F5`, dark `#27272A`, clearly separated from
both surface and faint), with a small radius/padding so it reads as a quoted
block. Keep the surrounding panel as-is or also bump it; the requirement is the
comment block visibly separates. Token-only per the colors convention — no
hardcoded hex.
**Files/symbols:** `frontend/src/components/NamedBirdsTable.tsx` — the
`s.comment` block (~lines 118–120) gets its own background/padding/radius.

### 4. Sort options → four, matching other pages — `namedBirds.ts` + `NamedBirdsTable.tsx`
**Now:** `NamedBirdSort = 'name' | 'species' | 'lastSeen'`; labels render as
`Name | Species | Last seen`; `sortNamedBirds` has three cases. The non-species
caller (Species Detail section) shows only Name + Last seen.
**Fix (the mapping the user specified):**
- `'name'` → label **Name (Individual)** (sorts by `bird.name`, unchanged).
- `'species'` SPLITS into two: **Alphabetical** (new key, sorts by
  `bird.commonName` A–Z — this is today's `'species'` behavior, renamed) and
  **Taxonomic** (new key, sorts by eBird taxonomic order).
- `'lastSeen'` → label **Last Seen** (unchanged behavior).
  Final enum becomes e.g.
  `'name' | 'alphabetical' | 'taxonomic' | 'lastSeen'`.
**Taxonomic wiring (see finding below):** `sortNamedBirds` must take an
order-lookup arg. Reuse the `orders` map already available from
`/taxonomy/codes` — `NamedBirds.tsx` already POSTs that endpoint for favicon
codes (`fetchTaxonCodes`, line 32) but currently DISCARDS `orders`. Capture
`data.orders` into a second state map, pass an `orderFor(commonName)` resolver
(falling back to `normalizeSpeciesName`, mirroring `BirdingStats.tsx`'s
`orderFor` at line 294) down through `NamedBirdsTable` into `sortNamedBirds`.
Unknown species sort to `Infinity` (stable tail), tie-break by name. No new
fetch needed.
**Four-vs-two by surface:** the user's four-option set is for the Named Birds
tab (`showSpecies`). The Species-Detail section (`showSpecies={false}`,
single species) should keep its reduced set — Taxonomic/Alphabetical are
meaningless within one species — so it stays Name (Individual) + Last Seen.
Confirm this is the intended scope (flagged).
**Files/symbols:** `frontend/src/lib/namedBirds.ts` (`NamedBirdSort` type,
`sortNamedBirds` signature + cases); `frontend/src/components/NamedBirdsTable.tsx`
(`sortOptions` labels, default sort, thread `orderFor`);
`frontend/src/components/NamedBirds.tsx` (`fetchTaxonCodes` keep `orders`, new
state, pass resolver down).
**Tests that WILL break and must be updated:** `namedBirds.test.ts` lines
100–106 assert `sortNamedBirds(birds, 'species'|'name'|'lastSeen')`;
`NamedBirdsTable.test.tsx` lines 32/37 assert a button named exactly
`'Species'` (and Name). These are intentional updates, not regressions.

### 5. Location next to the date — `namedBirds.ts` + `NamedBirdsTable.tsx`
**Now:** The expand-row shows date then the checklist link; no location. The
`NamedSighting` type (date, submissionId, comment) doesn't carry location.
**Fix:** Add `location: string` to `NamedSighting`; populate it in
`computeNamedBirds` from `obs.location` (already on `ObservationEntry`, see
finding). Render it in the expand-row between the date and the checklist link:
`date · location · S… ↗`. Match the existing pattern (e.g. Media Comments uses
`· {row.location}` in `--sr-text-muted`; Species Detail shows `o.location`).
Ellipsis/truncate long location strings so the row stays single-line.
**Files/symbols:** `frontend/src/lib/namedBirds.ts` (`NamedSighting` interface +
the two `sighting` object literals in `computeNamedBirds`, ~lines 13–17, 67–71);
`frontend/src/components/NamedBirdsTable.tsx` (expand-row, ~lines 105–117).

### 6. Per-individual sightings map — FLAGGED, recommend SPLIT to a New Feature session
**Request:** For each named individual, show a small map of where that bird's
sightings occurred — "just like the Species page has for species."

**Feature-check verdict: this is the one item that tips the lane.** A map inside
each individual's card is a *new user-facing surface a user couldn't reach
before*. Today the Named Birds tab has no map at all; the Species-Detail map is
a different surface for a different object (a species, not a named individual).
Per the maintain-lane branch rules, "a user can see, hear, or interact with
something they couldn't before" promotes to the New Feature lane. Items 1–5 are
genuine polish; item 6 is a new capability. The fact that it *reuses* an existing
pattern does not keep it in the Improve lane — reuse is an implementation detail,
not a lane test.

**Recommendation: (b) — ship the five polish items as this Improve session, then
do the map as its own New Feature session afterward.** Rationale: the five are
ready to build now and shouldn't wait on a larger piece; the map carries a real
data-threading change (below), per-card map lifecycle, and an interaction-design
call (always-on vs. a toggle, pins vs. heatmap, height in a collapsible card)
that wants New-Feature discipline, not a polish pass. Option (a) bundle-in is
not recommended (it silently grows the Improve scope past its rules); option (c)
defer is only if the user doesn't want the map at all.

**Data-availability finding (verified in code).** The named-bird sightings do
NOT currently carry coordinates. `ObservationEntry` (`frontend/src/types.ts:64`)
already has `latitude: number | null` and `longitude: number | null`, populated
by the eBird backup parser from the export's `Latitude`/`Longitude` columns — so
the source data exists. But `NamedSighting` (`frontend/src/lib/namedBirds.ts:13`)
only carries `date`, `submissionId`, `comment`; `computeNamedBirds` drops lat/lng
when it builds each `sighting` literal (lines 67–71). So the map needs a real
(small) data-threading change: add `latitude`/`longitude` (nullable) to
`NamedSighting`, populate them in `computeNamedBirds`, and skip null-coord
sightings when building markers. No parser change, no new CSV column. If item 5's
`location` lands first, this is the same shape of change, one field-set wider.

**Reuse path (verified in code).** Species Detail's map is highly reusable:
- Wrapper: `<SnowMap switcher scrollZoom={false}>` (`frontend/src/components/SnowMap.tsx`) — shared, drop-in.
- Pins: DOM `<Marker anchor="bottom">` per unique coordinate with `SP_PIN_HTML`
  (`SpeciesDetail.tsx:57`, `:1265`). A named individual has a tiny set of
  sightings, so DOM markers are exactly right — CLAUDE.md reserves the GL pin
  layers for hundreds+ instances; bounded DOM markers are the sanctioned choice
  here.
- Per-coordinate aggregation: the `coordMarkers` `useMemo` (`SpeciesDetail.tsx:354`)
  groups sightings by `"lat,lng"` — copy the shape, fed from `bird.sightings`.
- Popup: one state-driven `<Popup>` (`SpeciesDetail.tsx:1271`) listing checklist
  dates — same pattern.
- Fit: `<MapBoundsFitter coordinates={uniqueCoords} />`
  (`frontend/src/components/speciesDetail/MapBoundsFitter.tsx`) is generic and
  drops in unchanged (single coord → `flyTo` zoom 12; many → `fitBounds`).
- Height: `.sr-map-container` (`globals.css:392`, 300px on mobile) gives the
  contract; a per-card map likely wants a shorter fixed height.
**Where it lives:** inside each individual's expanded card in
`NamedBirdsTable.tsx` (the `open && (...)` block, ~lines 98–124), above or below
the sightings list. It renders only while the card is expanded, which naturally
bounds map lifecycle to one (or a few) at a time.

**Effort + risk delta vs items 1–5.** Meaningfully larger, not a free reuse.
Items 1–5 are inline-style/sort/one-field changes confined to two files. The map
adds: (1) the `NamedSighting` coordinate threading + tests; (2) a map subtree per
expanded card with its own MapLibre instance — performance/teardown to watch if a
user expands several cards at once (each `SnowMap` mounts a WebGL context; many
simultaneous maps is the real risk, mitigated by render-only-when-expanded and
possibly capping concurrent maps); (3) the same heatmap/pins/intensity surface
Species Detail has, which is its own small design call in a card context; (4)
map height tokens/CSS for the card. Genuinely New-Feature-sized, hence the split.

---

## Location-data finding (item 5)
**Already available — no parser change needed.** `ObservationEntry`
(`frontend/src/types.ts:62`) already carries `location: string` (plus
`locationId`, `latitude`, `longitude`, `county`), all populated by the eBird
backup parser from the export's `Location` column. `computeNamedBirds` receives
full `ObservationEntry` objects and currently just drops the field. The only
work is threading `obs.location` onto `NamedSighting` and rendering it. No new
CSV column, no `parseMLExport`/eBird-parser change.

## Taxonomic-sort wiring finding (item 4)
**Reuse the existing fetch — no new request.** `/taxonomy/codes` returns
`{ codes, orders }` in BOTH runtimes (TS `taxonomyService.ts:144/158` in Tauri
mode; Python `routers/taxonomy.py:107` in web/Pi mode). `NamedBirds.tsx`
already calls it for favicons but only keeps `codes`. Capture `orders`, build an
`orderFor` resolver identical in spirit to `BirdingStats.tsx:294`, and pass it
into the sort. This matches the v0.5.24 DECISIONS pattern and the CLAUDE.md note
that a favicon-bearing tab already resolves codes via batched `/taxonomy/codes`.

## Conventions / risks / regression surfaces
- **BirdName:** the header species already renders via `<BirdName … size="sm"
  hasEntry onOpenSpecies>` per the Bird-names convention — keep it; don't
  hand-roll a name. Alignment fix should stay in `NamedBirdsTable` if possible,
  not mutate shared `BirdName` behavior other tabs rely on.
- **Color tokens:** every color stays `var(--sr-*)`; any new shade goes in BOTH
  `:root` and `[data-theme="dark"]` in `globals.css` before use. Verify contrast
  in light AND dark.
- **Sort stability:** add deterministic tie-breakers (name) to the two new keys,
  matching the existing pattern, so equal-order/equal-name rows don't jitter.
- **Async-load ordering:** taxon codes/orders arrive AFTER first render
  (`fetchTaxonCodes` is fired post-`setPhase`). Until `orders` resolves the
  Taxonomic sort must degrade gracefully (all `Infinity` → falls back to the
  name tie-break) rather than throwing or showing an empty list.
- **Tests:** `namedBirds.test.ts` and `NamedBirdsTable.test.tsx` both assert the
  old sort keys/labels and must be updated alongside the change; add coverage
  for the new Taxonomic sort and for `location` on `NamedSighting`. Component
  tests need the `// @vitest-environment jsdom` docblock (already present in
  `NamedBirdsTable.test.tsx`).
- **Version + docs:** per CLAUDE.md this is a shippable change — bump
  `frontend/package.json` + `src-tauri/tauri.conf.json` (patch), update
  `CHANGELOG.md`, and review `docs/HELP.md` / `README.md` / `website/` if the
  Named Birds description mentions sort options or fields shown. (Engineer/later
  stages, noted here so it isn't forgotten.)

## Feature-check verdict
**Items 1–5 stay in the Improve (maintain) lane. Item 6 (the map) does not —
recommend splitting it into its own New Feature session.**

Items 1–3 are pure aesthetics. Item 4 adds a sort option that is an existing
capability elsewhere in the app — no new surface or data. Item 5 surfaces a field
already in the user's export and already displayed on three other tabs (Species
Detail, Statistics, Media Comments), placed on an existing row — no new data
modeled, no new flow, no design call. None of the New-Feature triggers fire for
these five; they are clearly maintenance polish and are the scope of THIS session.

Item 6 (per-individual sightings map) trips the first branch rule: a user can see
and interact with a map on this tab that they couldn't before. It is a new
user-facing surface, it needs a small data-model thread (coordinates onto
`NamedSighting`), and it carries an interaction-design call (always-on vs toggle,
pins vs heatmap, card height, concurrent-map performance). Reusing the Species
Detail pattern is an implementation convenience, not a lane test. Recommended
path: build 1–5 here, then open a separate New Feature session for the map (full
detail under item 6 above). Deferring the map entirely is the alternative if the
user doesn't want it.
