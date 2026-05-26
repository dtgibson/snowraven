# PRD — Breeding Code Category Filters

## Overview

Add three category filter pills — Confirmed, Probable, and Possible — to the Breeding Codes tab filter row. Each pill selects all individual codes belonging to that eBird evidence category. The existing individual code pills remain fully functional and unchanged.

---

## Functional Requirements

### FR-01 — Category definitions

Categories map to eBird's three evidence tiers, derived programmatically from `BREEDING_CODES` tier field:

| Category  | Tiers  | Codes (as of current data)                          |
|-----------|--------|-----------------------------------------------------|
| Confirmed | 3 + 4  | NY NE FS FY CF FL ON UN DD NB CN                   |
| Probable  | 2      | PE B A N C T P M S7                                |
| Possible  | 1      | S H F                                               |

The category→codes mapping must never be hardcoded. It must be derived at module level from `BREEDING_CODES` so it stays in sync if tier assignments ever change.

### FR-02 — Category filter state

A new `categoryFilter: Set<'confirmed' | 'probable' | 'possible'>` state is added to `BreedingCodeList`, separate from the existing `filter: Set<string>` (individual codes). Both states are independent; neither resets the other.

### FR-03 — Toggle behaviour

Clicking an active category pill removes it from `categoryFilter`. Clicking an inactive one adds it. Multiple categories can be active simultaneously.

### FR-04 — Filter predicate

A species row is shown if it passes all active constraints:

- For each active category: the species has ≥1 recorded observation for any code in that category (OR within category)
- For each active individual code in `filter`: the species has ≥1 recorded observation for that code
- All active constraints are ANDed together

When both `categoryFilter` and `filter` are empty, all species are shown (same as today).

### FR-05 — "All" resets both

Clicking "All" clears both `categoryFilter` and `filter`.

### FR-06 — processFile resets both

Loading a new file clears both `categoryFilter` and `filter` alongside the other resets.

### FR-07 — Pill order

Filter row order: **All → Confirmed → Probable → Possible → vertical divider → individual code pills → sort toggle**

The divider between category pills and individual code pills is the existing `<div style={{ width:1, height:20, background:'#E4E4E7' }} />`.

### FR-08 — Category pill style (inactive)

Same as existing inactive individual code pills: `border: 1.5px solid #E4E4E7`, `background: #fff`, `color: #71717A`. Height 30px, padding `0 12px`, border-radius 6px.

### FR-09 — Category pill visibility

A category pill is hidden if none of its member codes appear in `codesPresent`. If no Tier 1 codes appear in the data, the Possible pill is not rendered.

### FR-10 — Category pill style (active)

Each category uses its highest-tier color:

| Category  | Active background                  | Active border                     | Active text      |
|-----------|------------------------------------|-----------------------------------|------------------|
| Confirmed | `rgba(59,7,100,0.08)`              | `rgba(59,7,100,0.3)`              | `#3B0764`        |
| Probable  | `rgba(147,51,234,0.08)`            | `rgba(147,51,234,0.3)`            | `#7E22CE`        |
| Possible  | `rgba(192,132,252,0.15)`           | `rgba(192,132,252,0.5)`           | `#7E22CE`        |

### FR-11 — Text-only category pills

Category pills have no tier dot. They display only the label text (e.g. "Confirmed").

### FR-12 — Count label

The species count label in the toolbar reflects the combined filter predicate (category + individual codes). Behaviour is unchanged from today — it already recomputes from the filter state.

---

## Non-Functional Requirements

### NFR-01 — O(1) category lookup

At module level in `breedingCodes.ts`, export a `CATEGORY_CODES: Record<BreedingCategory, Set<string>>` derived from `BREEDING_CODES`. The filter predicate uses this map, not an inline `.filter()` over the full code list.

### NFR-02 — No backend changes

This feature is entirely frontend. No new endpoints, no server changes.

### NFR-03 — Type export

Export `BreedingCategory = 'confirmed' | 'probable' | 'possible'` from `breedingCodes.ts`. Import it in `BreedingCodeList.tsx`.

---

## Files Affected

| File | Change |
|------|--------|
| `frontend/src/lib/breedingCodes.ts` | Add `BreedingCategory` type, `CATEGORY_CODES` constant |
| `frontend/src/components/BreedingCodeList.tsx` | Add `categoryFilter` state, category pills, updated filter predicate |

---

## Out of Scope

- Any changes to `BreedingCodeTable` columns, sort, or display
- Renaming or redefining tier/category structure
- Filter state persistence
- Backend changes

---

## Acceptance Criteria / QA

1. "Confirmed" pill appears only when ≥1 of NY NE FS FY CF FL ON UN DD NB CN appears in the loaded data
2. "Probable" pill appears only when ≥1 of PE B A N C T P M S7 appears in the loaded data
3. "Possible" pill appears only when ≥1 of S H F appears in the loaded data
4. Clicking "Confirmed" shows all species with any confirmed code; count label updates
5. Clicking "Probable" shows all species with any probable code
6. Clicking "Possible" shows all species with any possible code
7. Clicking an active category pill deactivates it; species list reverts
8. Two categories active simultaneously: only species satisfying both appear
9. A category pill and an individual code pill active simultaneously: AND logic applies correctly
10. Clicking "All" clears all category and individual code filters
11. Loading a new file clears all filters including category filters
12. Category pills render before individual code pills, after "All", separated by the existing divider
13. Active category pill uses correct color per FR-10; inactive uses #E4E4E7 border
14. Category pills have no tier dot
15. Species count label matches the combined filter predicate at all times
