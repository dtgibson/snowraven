# Strategic Brief — Breeding Code List

## Feature Overview

A new **Breeding Codes** tab that accepts an eBird backup CSV and displays every species for which at least one breeding code has been entered. Each species gets a row; each breeding code gets a column. Where a code has been recorded for that species, a colored circle appears with the count of observations. Columns run left to right from most-confirmed to least-confirmed, matching the visual and conceptual hierarchy eBird uses in its own app.

**The 23 eBird breeding codes, left to right (confirmed → possible):**

| Category | Codes |
|----------|-------|
| Confirmed (highest) | NY, NE, FS, FY, CF, FL, ON, UN, DD |
| Confirmed (also) | NB, CN |
| Probable | PE, B, A, N, C, T, P, M, S7 |
| Possible | S, H, F |

**Visual language:** Four-tier purple gradient matching the eBird app — lightest purple for Possible, stepping through two shades to near-black for highest-confidence Confirmed. Each cell is a filled circle with the count centered inside; empty cells are blank (no circle).

**Sorting:** All column headers are clickable sort controls, matching the Media Life List pattern. Clicking the species name column sorts A–Z (ascending default). Clicking any code column sorts by that code's count, highest first (descending default). Clicking the active column again reverses direction. A small sort indicator (↑/↓) marks the active column. Default sort is A–Z by species name.

**Filter pills:** A row of filter pills above the table — one for each breeding code that appears at least once in the loaded data, ordered confirmed → possible (same order as the table columns), plus an "All" pill to reset. Selecting a code pill filters the table to show only species with at least one entry for that code; all other species are hidden. One pill active at a time. Pills are styled as colored circles matching the table's visual language, with the code label beside each.

**Scope:**
- One new tab: Breeding Codes
- One new parser: extracts species + breeding codes from eBird backup CSV
- One new table component: species rows × code columns, sortable headers, filter pills
- No backend changes — entirely client-side

---

## Strategic Alignment

SnowRaven is a personal tool for a committed eBird user. Recording breeding codes is one of the more intentional acts in eBird — it takes extra effort and reflects genuine field observation. That data is currently buried across thousands of checklist rows in a CSV. This feature surfaces it as a proper breeding atlas: which species, which codes, how many times. Sorting by a code like NY (Nest with Young) immediately surfaces your best-confirmed species. Filtering by S (Singing) shows everything still at "possible" — a ready list for follow-up visits.

---

## User Value

- **See your breeding atlas at a glance** — every species you've recorded breeding behavior for, in one table.
- **Sort by confirmation strength** — click NY or NE to surface your best-confirmed species at the top.
- **Filter to a single code** — click S to see species only at singing; click CF to see species where you observed adults carrying food.
- **Spot gaps** — empty circles across confirmed columns show exactly where to focus next visit.
- **No new data entry** — the codes are already in the eBird backup CSV used by the List Comparer.

---

## Risks and Constraints

- **Column count is wide** — 23 codes means the table will be wide. The species name column should be sticky-left; code columns scroll horizontally.
- **Filter pills only show codes present in the data** — if a user has never recorded NY, that pill doesn't appear.
- **Sparse data** — most species will have codes in only 2–3 columns. Empty cells are truly blank.
- **Code parsing edge cases** — the "Breeding Code" column may be empty or contain deprecated codes. These rows are skipped.
- **Color palette** — the purple gradient is used specifically for breeding code circles (the data), not UI chrome.

---

## Out of Scope

- Filtering by category (Confirmed / Probable / Possible) — individual code pills are more precise
- Multiple simultaneous code filters
- Exporting the breeding code table
- Comparing breeding codes across two files
- Any backend changes
