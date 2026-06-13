# PRD — Named Birds Tab Upgrade
**Feature:** named-birds-tab-upgrade
**Date:** 2026-06-09
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
An upgrade to the existing Named Birds tab (shipped v0.5.23) that makes one
named bird's history legible and adds a per-individual sightings map. Five
clarity/parity fixes (contrast, header alignment, comment background, a
four-option sort, per-report location) plus one new view: a small map inside
each expanded card showing where that individual has been seen, reusing the
Species Detail map pattern.

## User Stories

> **US-01** — As a birder reviewing a named bird in dark mode, I want every part
> of the card to read at a comfortable contrast, so that I can read the dates,
> location, and comments without straining.

> **US-02** — As a birder reading a card header, I want the individual's name and
> the species name to sit on a shared baseline, so that the header looks
> deliberate rather than broken.

> **US-03** — As a birder reading a sighting's comment, I want the comment to sit
> on a visibly distinct background, so that I can tell it apart from the rest of
> the card at a glance.

> **US-04** — As a birder who uses the rest of the app, I want the Named Birds
> sort control to offer the same four options as other pages — Name
> (Individual), Alphabetical, Taxonomic, Last Seen — so that I can order
> individuals taxonomically like I can order everything else.

> **US-05** — As a birder reviewing a bird's reports, I want each report to show
> where it was seen between the date and the checklist link, so that I get the
> same location detail every other tab already shows me.

> **US-06** — As a birder following one individual across seasons, I want a small
> map of that bird's sighting locations inside its expanded card, so that I can
> see *where* this particular bird has turned up — the way Species Detail shows
> me where a species has been seen.

> **US-07** — As a birder reviewing several individuals in one session, I want the
> per-card maps to open and close without jank or crashing, so that browsing my
> named birds stays smooth.

## Functional Requirements

### Area A — Contrast (Part 1)

> **FR-01** — The app shall render the Named Birds tab's real content text
> (per-sighting date, header date-range) at a contrast that reads as primary
> data, lifting the weakest offenders away from the lowest-contrast tokens
> (`--sr-text-muted`, `--sr-text-disabled`) in both light and dark themes.

> **FR-02** — The app shall not use `--sr-text-disabled` for any element that is
> real content; the passive "N named birds" count may remain at a lower-emphasis
> token.

> **FR-03** — The app shall nudge the smallest body text (currently `0.6875rem`)
> up a legibility step where it carries content (e.g. the checklist link and
> header date-range), without redesigning the tab's layout.

> **FR-04** — The app shall express every color used in this work as a
> `var(--sr-*)` token; any genuinely new shade shall be added to both `:root` and
> `[data-theme="dark"]` in `globals.css` before use.

### Area B — Header alignment (Part 2)

> **FR-05** — The app shall align the individual name and the species name in each
> card header on a shared visual baseline, correcting the current centered-on-a-
> flex-row mismatch between the two differently sized text runs.

> **FR-06** — The app shall achieve the alignment within `NamedBirdsTable` and
> shall not change shared `BirdName` behavior that other tabs depend on; if a
> `BirdName`-side change is unavoidable it shall be additive only (e.g. using the
> existing `sr-birdname-inline` path), never a change to global `BirdName`
> defaults.

> **FR-07** — The app shall continue to render the header species through
> `<BirdName>` (no hand-rolled name + favicons).

### Area C — Comment background (Part 3)

> **FR-08** — The app shall give each per-sighting comment its own container with
> a token background that is visibly distinct from both the card surface and the
> expanded panel, in both light and dark themes.

> **FR-09** — The comment container shall read as a quoted block (small radius and
> padding) and shall use only `var(--sr-*)` tokens — no hardcoded hex or RGB.

### Area D — Sort (Part 4)

> **FR-10** — The Named Birds tab shall offer exactly four sort options labeled,
> in order: **Name (Individual)**, **Alphabetical**, **Taxonomic**, **Last
> Seen**.

> **FR-11** — The app shall sort **Name (Individual)** by the individual's display
> name, **Alphabetical** by species common name A–Z, **Taxonomic** by the
> species' eBird taxonomic order, and **Last Seen** by most-recent sighting date.

> **FR-12** — The Taxonomic sort shall obtain taxonomic order from the `orders`
> map already returned by `/taxonomy/codes` (already fetched for favicons), with
> no new network request, resolving a species to its order via a name-normalized
> lookup (`normalizeSpeciesName` fallback).

> **FR-13** — Every sort shall be stable and deterministic: each option shall
> apply a name tie-break so that rows with equal primary keys do not jitter;
> species with no known taxonomic order shall sort to a stable tail (treated as
> `Infinity`) and then by name.

> **FR-14** — Until the taxonomic `orders` map has loaded, the Taxonomic sort
> shall degrade gracefully to the name tie-break order (no error, no empty list),
> and shall reorder once `orders` resolves.

> **FR-15** — The Species Detail "Named Individuals" section (single species) shall
> keep its reduced sort set of **Name (Individual)** and **Last Seen** only;
> Taxonomic and Alphabetical shall not appear there.

### Area E — Location per report (Part 5)

> **FR-16** — The app shall carry a `location` string on each named-bird sighting,
> populated from the existing `location` field on the parsed observation
> (`ObservationEntry.location`); no parser change and no new CSV column shall be
> introduced.

> **FR-17** — The app shall render each report's location in the expand-row
> between the date and the checklist link, in the form `date · location · S… ↗`,
> matching the muted-location pattern used on other tabs.

> **FR-18** — When a report has no location text, the app shall omit the location
> segment for that row (no empty separator, no placeholder); when a location is
> present, the app shall keep the row single-line by truncating/ellipsizing long
> location strings.

### Area F — Per-individual sightings map (Part 6)

> **FR-19** — The app shall carry nullable `latitude` and `longitude` on each
> named-bird sighting, populated from the existing coordinate fields on the parsed
> observation (`ObservationEntry.latitude` / `.longitude`); no parser change and
> no new CSV column shall be introduced.

> **FR-20** — The app shall render, inside each individual's expanded card, a small
> map of that individual's sighting locations, reusing the Species Detail map
> pattern: the shared `<SnowMap>` wrapper, DOM `<Marker>` pins per unique
> coordinate, a single state-driven `<Popup>`, and `MapBoundsFitter` to frame the
> points.

> **FR-21** — The map shall render only while the card is expanded and shall be
> torn down when the card is collapsed.

> **FR-22** — The app shall pin only sightings that have usable coordinates;
> sightings with null latitude or longitude shall be silently skipped (no pin, no
> error).

> **FR-23** — When an individual has no sighting with usable coordinates, the app
> shall not render a map (no empty map and no broken map container) for that card.

> **FR-24** — The map shall aggregate sightings that share a coordinate into a
> single pin, and the pin's popup shall list that location's sighting dates,
> mirroring the Species Detail per-coordinate behavior.

> **FR-25** — The map shall reuse the existing keyless tile providers via
> `<SnowMap>`; the app shall not introduce any new tile source or any new outbound
> data egress.

## Non-Functional Requirements

> **NFR-01 — Performance / concurrency:** The per-card maps shall not cause jank or
> a crash when a user expands and collapses individuals over a browsing session.
> Each map mounts its own MapLibre/WebGL context; the render-only-while-expanded
> rule (FR-21) bounds the lifecycle. Whether to additionally cap or queue
> concurrent map instances is an Architect decision (see Open Questions); the
> shipped behavior shall be stable regardless of how many cards a user opens.

> **NFR-02 — Theming:** All contrast, comment-background, and map-container styling
> shall be theme-aware via `var(--sr-*)` tokens and shall be verified in both light
> and dark themes.

> **NFR-03 — Privacy:** The feature renders the user's own exported data to
> themselves on their own device, adds no new data collection, models no new field
> beyond threading coordinates/location that already exist in the parsed export,
> and introduces no new tile provider or outbound service. No `PRIVACY_POLICY.md`
> change is expected; the security review shall confirm no new data egress.

> **NFR-04 — Accessibility:** Lifted contrast (Part 1) shall improve, not regress,
> legibility; the comment block's text-on-background pairing shall remain legible
> in both themes.

> **NFR-05 — Reuse / consistency:** The map shall use the sanctioned bounded-DOM-
> marker path (a named bird has a small set of sightings), not GL pin layers, per
> the CLAUDE.md overlay conventions; it shall not introduce a new map pattern.

## Out of Scope

- **No change to how individuals are detected, named, or keyed.** The `[name:…]`
  comment model is settled and untouched.
- **No new data source, parser change, or new eBird/Macaulay column.** Parts 5 and
  6 only thread fields (`location`, `latitude`, `longitude`) that already exist on
  the parsed observation onto the named-bird sighting record.
- **No change to shared `BirdName`** other than (if strictly unavoidable) an
  additive use of the existing `sr-birdname-inline` path.
- **No change to the Species Detail "Named Individuals" sort set** — it keeps Name
  (Individual) + Last Seen (FR-15).
- **No new map capabilities beyond the Species Detail parity set** — this is not the
  place to invent new map interactions. (Whether the card map exposes the Species
  Detail heatmap/intensity controls or pins-only is an interaction-design call left
  to the Architect — see Open Questions — but no map interaction *new to the app* is
  in scope.)
- **No redesign of the Named Birds tab** beyond the six listed parts.

## Open Questions

These are routed to the Architect (Stage 3); the PRD does not decide them.

1. **Concurrent-map lifecycle bound.** Render-only-while-expanded (FR-21) bounds
   the common case, but a user can expand several cards at once, mounting several
   WebGL contexts. *Default if undecided:* rely on render-only-while-expanded with
   no hard cap, and verify stability under several simultaneously expanded cards
   at Stage 6. The Architect should decide whether to additionally cap/queue
   concurrent maps.
2. **Where the map sits in the expanded card.** Above or below the sightings list.
   *Default if undecided:* below the sightings list, before the card's bottom
   padding.
3. **Map height in the card.** Species Detail uses ~300px on mobile; a per-card map
   likely wants a shorter fixed height. *Default if undecided:* a single fixed,
   token-able height shorter than the Species Detail map, consistent across cards.
4. **Pin sprite reuse.** Whether to reuse the Species Detail pin sprite
   (`SP_PIN_HTML`) as-is or restyle for the card context. *Default if undecided:*
   reuse `SP_PIN_HTML` as-is.
5. **Card-map control surface.** Whether the card map exposes the Species Detail
   heatmap/intensity controls or is pins-only. *Default if undecided:* pins-only,
   to keep the card compact; no new-to-the-app interaction either way (out of
   scope above).

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Contrast — real content (FR-01, FR-03) | Per-sighting date and header date-range read clearly in both light and dark themes; the weakest offenders no longer use `--sr-text-muted`/`--sr-text-disabled`; the smallest content text is no smaller than `0.75rem` where legibility was the complaint. |
| QA-02 | No disabled token on content (FR-02) | No real-content element uses `--sr-text-disabled`; the passive "N named birds" count is the only element permitted at a lower-emphasis token. |
| QA-03 | Token-only colors (FR-04, FR-09) | No hardcoded hex/RGB in the changed `NamedBirdsTable` styling; any new shade exists in both `:root` and `[data-theme="dark"]`. |
| QA-04 | Header alignment (FR-05) | In a card header, the individual name and species name sit on a shared baseline; the header no longer reads as misaligned in light and dark. |
| QA-05 | Alignment is in-component (FR-06, FR-07) | Shared `BirdName` default behavior is unchanged (other tabs unaffected); the species still renders via `<BirdName>`; any `BirdName`/`globals.css` change is additive only. |
| QA-06 | Comment background distinct (FR-08, FR-09) | Each comment block's background is visibly distinct from the card surface and the expanded panel in both light and dark themes, and reads as a quoted block (radius + padding). |
| QA-07 | Four sort options, correct labels/order (FR-10) | The Named Birds tab shows exactly four sort controls labeled **Name (Individual) · Alphabetical · Taxonomic · Last Seen** in that order. |
| QA-08 | Sort behavior (FR-11) | Name sorts by individual name; Alphabetical by species common name A–Z; Taxonomic by eBird taxonomic order; Last Seen by most-recent date. |
| QA-09 | Taxonomic wiring, no new fetch (FR-12) | Taxonomic order comes from the existing `/taxonomy/codes` `orders` map; no additional network request is issued for sorting. |
| QA-10 | Sort stability + tie-breaks (FR-13) | Every sort is deterministic with a name tie-break; species with unknown taxonomic order land in a stable tail then sort by name; no row jitter on equal keys. |
| QA-11 | Taxonomic graceful degradation (FR-14) | Before `orders` loads, Taxonomic renders the name-order fallback without error or empty list; after `orders` resolves, the list reorders taxonomically. |
| QA-12 | Species Detail sort set unchanged (FR-15) | The Species Detail "Named Individuals" section shows only Name (Individual) + Last Seen; Taxonomic/Alphabetical are absent. |
| QA-13 | Location threaded, no parser change (FR-16) | Each named-bird sighting carries `location` populated from `ObservationEntry.location`; no parser change and no new CSV column. |
| QA-14 | Location rendered in position (FR-17) | When a location is present, the expand-row shows it between the date and the checklist link in the form `date · location · S… ↗`, in the muted-location style. |
| QA-15 | Location edge cases (FR-18) | A report with no location omits the location segment (no empty separator/placeholder); a long location is truncated so the row stays single-line. |
| QA-16 | Coordinates threaded, no parser change (FR-19) | Each named-bird sighting carries nullable `latitude`/`longitude` from `ObservationEntry`; no parser change and no new CSV column. |
| QA-17 | Map renders, reuses Species Detail pattern (FR-20) | Expanding a card with coordinate-bearing sightings shows a small map using `<SnowMap>`, DOM marker pins, a single `<Popup>`, and `MapBoundsFitter` framing the points. |
| QA-18 | Map lifecycle bound to expansion (FR-21) | The map exists only while the card is expanded; collapsing the card tears the map down. |
| QA-19 | Null-coord sightings skip (FR-22) | Sightings with null lat/long produce no pin and no error; only usable coordinates are pinned. |
| QA-20 | No-coord individual shows no map (FR-23) | An individual with no usable coordinates renders no map and no broken/empty map container. |
| QA-21 | Coordinate aggregation + popup (FR-24) | Sightings at the same coordinate collapse to one pin whose popup lists that location's sighting dates, mirroring Species Detail. |
| QA-22 | No new tile source / egress (FR-25, NFR-03) | The card map uses the existing keyless providers via `<SnowMap>`; no new tile source and no new outbound request is introduced; security review confirms no new egress. |
| QA-23 | Concurrency stability (NFR-01, US-07) | Expanding several individuals' cards and collapsing them over a session produces no jank or crash. |
| QA-24 | Tests updated and green | `namedBirds.test.ts` and `NamedBirdsTable.test.tsx` are updated for the new sort keys/labels, the `location` field, and the threaded coordinates, and the full frontend suite passes. |

## Carry-Forward Flags

- **Privacy.** The feature renders the user's own data, locally, with no new
  collection and no new tile provider; no `PRIVACY_POLICY.md` change is expected.
  The security review must confirm no new data egress (NFR-03 / QA-22).
- **Concurrent-WebGL risk.** Each expanded card mounts its own MapLibre/WebGL
  context; multiple simultaneously expanded cards is the one real engineering risk.
  Render-only-while-expanded bounds it; the Architect decides whether to also cap
  concurrent maps (Open Question 1). Stage 6 must verify stability under several
  open cards (QA-23).
- **Shippable change.** This carries the usual version bump
  (`frontend/package.json` + `src-tauri/tauri.conf.json`, patch), `CHANGELOG.md`
  entry, and a docs/website review for the Named Birds description (sort options,
  location, the new map) — noted so later stages don't forget it.
