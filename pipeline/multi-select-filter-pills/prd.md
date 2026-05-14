# PRD — Multi-Select Filter Pills
**Feature:** multi-select-filter-pills
**Session:** 001
**Date:** 2026-05-14
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Filter pills on the Media List and Breeding Codes tabs become multi-selectable, with all active filters applied simultaneously using AND logic. On the Media List, selecting the opposite pill for the same media type (e.g. "Has photo" while "No photo" is active) automatically replaces the conflicting selection rather than requiring the user to deselect first.

---

## User Stories

**US-01** — As a birder using the Media List, I want to activate both "No photo" and "No audio" simultaneously, so I can see the species I'm missing coverage for on both fronts without doing two separate lookups.

**US-02** — As a birder using the Media List, I want clicking "Has photo" to automatically clear "No photo" (if active), so I can switch between opposite states without having to manually deselect first.

**US-03** — As a birder using the Media List, I want to click an active pill to deselect it, so I can remove one filter condition without clearing all of them.

**US-04** — As a birder using the Breeding Codes tab, I want to select two or more code pills simultaneously, so I can see species for which I've recorded all of those codes.

**US-05** — As a birder on either tab, I want to click "All" to instantly clear every active filter, so I can reset to the full list when I'm done exploring a combination.

**US-06** — As a birder on either tab, I want the species count label to stay accurate under any combination of active filters, so I always know how many species match my current criteria.

---

## Functional Requirements

### Shared behaviour

**FR-01** — The "All" pill shall clear all active filters when clicked, regardless of how many are currently active.

**FR-02** — The "All" pill shall appear visually active when no specific filters are active, and visually inactive when any filter is active.

**FR-03** — Clicking an already-active filter pill shall deselect it (toggle off), reducing the active filter set by one.

**FR-04** — The filtered species list shall show only species that satisfy every active filter condition simultaneously (AND logic).

**FR-05** — The species count label shall always reflect the number of species matching all currently active filters.

### Media List

**FR-06** — The filter state shall track each media dimension (photo, audio, video) independently. Each dimension may be in one of three states: "has", "no", or unset (not filtering on that dimension).

**FR-07** — Clicking a "Has [type]" pill while "No [type]" is active for the same dimension shall automatically deselect "No [type]" and activate "Has [type]".

**FR-08** — Clicking a "No [type]" pill while "Has [type]" is active for the same dimension shall automatically deselect "Has [type]" and activate "No [type]".

**FR-09** — Filter pills for different dimensions (e.g. "No photo" and "No audio") shall be freely combinable — selecting one shall not affect the other.

**FR-10** — Active "Has [type]" pills shall use the positive active pill style (green). Active "No [type]" pills shall use the negative active pill style (red). Multiple pills may be active simultaneously, each showing its appropriate style.

### Breeding Codes

**FR-11** — The filter state shall be a set of active breeding code identifiers. The empty set corresponds to "All" (no filtering).

**FR-12** — Clicking an inactive code pill shall add it to the active set.

**FR-13** — All code pills are mutually compatible — selecting one code pill shall not affect any other code pill's active state.

**FR-14** — The filtered table shall show only species that have at least one recorded observation for every code in the active set.

**FR-15** — Each active code pill shall display using the existing active pill style.

---

## Non-Functional Requirements

**NFR-01 — Accessibility:** Each active pill shall retain a visible border and color change distinct from its inactive state. The multi-select interaction shall not reduce the existing visual distinction between active and inactive pills.

**NFR-02 — Performance:** Filter recalculation on pill click shall be synchronous and cause no perceptible delay for lists up to 1,000 species.

---

## Out of Scope

- Life List Comparer tab — its controls are sort toggles, not inclusion/exclusion filters
- Saving or bookmarking filter combinations
- Filter presets (e.g. "All confirmed codes")
- Any new filter types not already present on either tab

---

## Open Questions

None — all decisions are resolved in the strategic brief and this document.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Media List AND logic | Selecting "No photo" + "No audio" shows only species missing both; species missing only one do not appear |
| QA-02 | Incompatible pill auto-replacement | With "No photo" active, clicking "Has photo" deselects "No photo" and activates "Has photo" in a single click |
| QA-03 | Pill toggle-off | Clicking an active pill deselects it; the species list updates to reflect the reduced filter set |
| QA-04 | "All" reset | With multiple pills active, clicking "All" returns the list to fully unfiltered |
| QA-05 | "All" pill state | "All" shows as active when no filters are selected; inactive when any filter is active |
| QA-06 | Media List count label | Species count reflects the AND result of all active media filters at all times |
| QA-07 | Breeding Codes AND logic | Selecting NY + CF shows only species where both codes appear; species with only NY or only CF are excluded |
| QA-08 | Breeding Codes deselect | Clicking an active code pill removes it; species only excluded by that code may reappear |
| QA-09 | Breeding Codes count label | Species count reflects the AND result of all active code filters at all times |
| QA-10 | Multi-pill visual state | All active pills simultaneously display their correct active visual style |
| QA-11 | No regression | All 69 existing vitest tests pass without modification |
