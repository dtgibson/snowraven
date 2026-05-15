# PRD — Taxonomic Sort

**Feature:** taxonomic-sort
**Session:** 001
**Date:** 2026-05-14
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A–Z and Taxonomic sort toggle buttons added to the Media Life List and Breeding Codes tabs, letting users switch between alphabetical and eBird taxonomic order. The backend's existing `POST /taxonomy/codes` endpoint is extended to return taxon order alongside species codes — no new endpoint, no additional network call.

---

## User Stories

**US-01** — As a birder reviewing my Media Life List from an ML export, I want to sort by eBird taxonomic order so that I can scan for coverage gaps in the familiar field-guide sequence.

**US-02** — As a birder reviewing my Media Life List from an eBird CSV, I want to sort by eBird taxonomic order so that I can scan for coverage gaps in the familiar field-guide sequence.

**US-03** — As a birder reviewing my Breeding Codes table, I want to sort by eBird taxonomic order so that I can review my breeding evidence in the same sequence as my field guide and eBird checklists.

**US-04** — As a birder on either tab, I want to switch back to A–Z so that I can quickly look up a specific species by name.

**US-05** — As a user of the Media Life List upload screen, I want copy that accurately describes what the app does, including any network requests it makes after file load.

---

## Functional Requirements

### Backend

**FR-01** — `POST /taxonomy/codes` shall return an `orders` object alongside the existing `codes` object. `orders` shall be a map of `{ commonName: taxonOrder }` where `taxonOrder` is a positive integer from the eBird taxonomy.

**FR-02** — The `orders` map shall be derived from the same in-memory cached taxonomy data already used for `codes`. No additional eBird API call shall be made.

**FR-03** — The full response schema shall be `{ codes: { commonName: speciesCode }, orders: { commonName: taxonOrder } }`.

### Media Life List — Sort Toggle

**FR-04** — The Media Life List shall display A–Z and Taxonomic sort toggle buttons in the controls row, visible and available for both ML export and eBird CSV source files.

**FR-05** — Clicking A–Z shall set the primary sort to alphabetical by common name (ascending) and clear any active column-header sort (Entries, Photo, Audio, Video).

**FR-06** — Clicking Taxonomic shall set the primary sort to eBird taxonomic order (ascending by taxon order integer) and clear any active column-header sort.

**FR-07** — For an eBird CSV source: taxonomic order shall be sourced from the `taxonomicOrder` field on `LifeListEntry`. For any species where that field is `Infinity` or absent, the `orders` map from the taxonomy fetch shall be used as a fallback.

**FR-08** — For an ML export source: taxonomic order shall be sourced from the `orders` map returned by `POST /taxonomy/codes`.

**FR-09** — When a column-header sort (Entries, Photo, Audio, Video) is active, the toggle shall retain its visual selection; the column-header sort is the primary sort, and the active toggle mode (A–Z or Taxonomic) determines tiebreaker order among species with equal counts.

**FR-10** — The active toggle button shall be visually distinct from the inactive button.

**FR-11** — The default sort on file load shall be A–Z (no change to existing default).

**FR-12** — Species with no resolved taxonomic order (not in the `orders` map and `taxonomicOrder` unavailable) shall sort last in Taxonomic mode, in A–Z order among themselves.

### Breeding Codes — Sort Toggle

**FR-13** — The Breeding Codes tab shall display A–Z and Taxonomic sort toggle buttons in the controls row.

**FR-14** — Clicking A–Z on Breeding Codes shall sort species by common name ascending and clear any active code-column sort.

**FR-15** — Clicking Taxonomic on Breeding Codes shall sort species by eBird taxonomic order ascending and clear any active code-column sort.

**FR-16** — When a code-column sort is active on Breeding Codes, the toggle retains its visual selection; the column-header sort is the primary sort, and the toggle mode determines the tiebreaker.

**FR-17** — Taxonomic order for the Breeding Codes tab shall be sourced from the `orders` map returned by `POST /taxonomy/codes`. The fetch shall fire after file parse completes.

**FR-18** — Species with no resolved taxonomic order shall sort last in Taxonomic mode, in A–Z order among themselves.

**FR-19** — The default sort on Breeding Codes file load shall be A–Z (no change to existing default).

### Drop Zone Copy

**FR-20** — The ML export drop zone shall remove any text claiming that processing happens entirely offline or that no network lookups are made. Copy shall accurately reflect that a taxonomy fetch fires after file load.

---

## Non-Functional Requirements

**NFR-01 — Performance:** Sorting shall use a pre-built lookup from the `orders` map — no re-fetching occurs when the user switches between A–Z and Taxonomic.

**NFR-02 — Consistency:** The A–Z / Taxonomic toggle visual design on both tabs shall match the existing toggle on the Life List Comparer.

**NFR-03 — Availability:** If `POST /taxonomy/codes` fails, the Taxonomic toggle shall still be displayed and clickable; species lacking order data shall sort last. A–Z shall work regardless of fetch status.

---

## Out of Scope

- Taxonomic sort on the Life List Comparer (already exists)
- Persisting the user's sort preference across sessions or tab switches
- Additional sort dimensions beyond A–Z and Taxonomic (scientific name, etc.)
- Changes to the "Show all / Collapse" expand behavior

---

## Open Questions

**OQ-01: Taxonomic toggle before fetch completes (ML export)**
For ML export, no taxonomic orders are available until the `POST /taxonomy/codes` fetch resolves.

**Default assumption:** The Taxonomic button is always visible and clickable. If clicked before the fetch completes, species sort in A–Z order. The table re-sorts automatically when the `orders` map becomes available. No disabled state or spinner required.

**OQ-02: Taxonomy fetch on Breeding Codes tab**
The Breeding Codes tab does not currently call `POST /taxonomy/codes`. This call must be added.

**Default assumption:** A `fetchTaxonCodes` call fires after parse completes, passing all species common names. The `orders` map is stored in component state and used for taxonomic sort.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | `POST /taxonomy/codes` returns `orders` | Response includes `orders` key; value is a non-empty `{commonName: number}` object |
| QA-02 | Taxonomic sort — ML export | Clicking Taxonomic reorders the table in eBird taxonomic sequence; unranked species appear last |
| QA-03 | Taxonomic sort — eBird CSV | Clicking Taxonomic uses parsed `taxonomicOrder`; species with `Infinity` use `orders` fallback |
| QA-04 | A–Z sort — Media List | Clicking A–Z restores alphabetical order by common name |
| QA-05 | Toggle visual state — Media List | Active toggle button is visually distinct from inactive |
| QA-06 | Column-header sort interaction | Clicking Entries/Photo/Audio/Video takes primary sort priority; toggle retains visual state; ties broken by toggle mode |
| QA-07 | Taxonomic sort — Breeding Codes | Clicking Taxonomic reorders species by eBird taxonomic sequence |
| QA-08 | A–Z sort — Breeding Codes | Clicking A–Z restores alphabetical species order |
| QA-09 | Toggle visual state — Breeding Codes | Active toggle button is visually distinct from inactive |
| QA-10 | Breeding Codes column sort interaction | Code column sort takes priority; toggle state used as tiebreaker |
| QA-11 | Drop zone copy | ML export drop zone contains no claim of offline-only processing or "no network lookups" |
| QA-12 | Default sort on load | Both tabs default to A–Z on file load |
| QA-13 | Unranked species sort last | Species not in `orders` sort after all ranked species, in A–Z order |
| QA-14 | Taxonomy fetch failure | A–Z works normally; Taxonomic produces A–Z-equivalent ordering when no `orders` data available |
