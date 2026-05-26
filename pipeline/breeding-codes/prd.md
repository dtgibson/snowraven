# Product Requirements Document — Breeding Code List

## Overview

The Breeding Code List is a new tab in SnowRaven that parses an eBird backup CSV, extracts every row with a breeding code, and renders a species-by-code matrix. Each cell in the matrix shows a count (how many observations for that species carry that code), represented as a colored circle. Only species with at least one breeding code appear. Only codes present in the loaded data appear as columns and filter pills. The table is sortable by any column header and filterable by any individual code pill.

---

## User Stories

**US-01** — As a birder, I want to drop my eBird backup CSV onto the Breeding Codes tab and immediately see every species I've recorded breeding behavior for, so I can review my breeding season data without opening a spreadsheet.

**US-02** — As a birder, I want to click a column header (e.g. NY) to sort species by how many Nest with Young observations I have, so I can quickly see my most-confirmed breeding species.

**US-03** — As a birder, I want to click a filter pill (e.g. S — Singing Bird) to see only the species still at possible status, so I can plan follow-up visits.

**US-04** — As a birder, I want empty cells to be truly blank — no placeholder icon or dash — so the table is easy to scan and the colored circles stand out clearly.

---

## Functional Requirements

### FR-01 — Breeding Code Definitions

Create `frontend/src/lib/breedingCodes.ts` with all 23 codes, their labels, tiers, and canonical order.

```typescript
export interface BreedingCodeDef {
  code: string
  label: string
  tier: 1 | 2 | 3 | 4  // 4 = confirmed highest, 1 = possible
}

export const BREEDING_CODES: BreedingCodeDef[] = [
  // Tier 4 — Confirmed (highest)
  { code: 'NY', label: 'Nest with Young',           tier: 4 },
  { code: 'NE', label: 'Nest with Eggs',             tier: 4 },
  { code: 'FS', label: 'Carrying Fecal Sac',         tier: 4 },
  { code: 'FY', label: 'Feeding Young',              tier: 4 },
  { code: 'CF', label: 'Carrying Food',              tier: 4 },
  { code: 'FL', label: 'Recently Fledged Young',     tier: 4 },
  { code: 'ON', label: 'Occupied Nest',              tier: 4 },
  { code: 'UN', label: 'Used Nest',                  tier: 4 },
  { code: 'DD', label: 'Distraction Display',        tier: 4 },
  // Tier 3 — Confirmed (also)
  { code: 'NB', label: 'Nest Building',              tier: 3 },
  { code: 'CN', label: 'Carrying Nesting Material',  tier: 3 },
  // Tier 2 — Probable
  { code: 'PE', label: 'Physiological Evidence',     tier: 2 },
  { code: 'B',  label: 'Wren/Woodpecker Nest Bldg', tier: 2 },
  { code: 'A',  label: 'Agitated Behavior',          tier: 2 },
  { code: 'N',  label: 'Visiting Probable Nest',     tier: 2 },
  { code: 'C',  label: 'Courtship/Display/Copul.',   tier: 2 },
  { code: 'T',  label: 'Territorial Defense',        tier: 2 },
  { code: 'P',  label: 'Pair in Suitable Habitat',   tier: 2 },
  { code: 'M',  label: 'Multiple (7+) Singing',      tier: 2 },
  { code: 'S7', label: 'Singing Bird 7+ Days',       tier: 2 },
  // Tier 1 — Possible
  { code: 'S',  label: 'Singing Bird',               tier: 1 },
  { code: 'H',  label: 'In Appropriate Habitat',     tier: 1 },
  { code: 'F',  label: 'Flyover',                    tier: 1 },
]

export const BREEDING_CODE_MAP = new Map(BREEDING_CODES.map(d => [d.code, d]))
```

**Tier colors:**
- Tier 4: `#3B0764`
- Tier 3: `#6B21A8`
- Tier 2: `#9333EA`
- Tier 1: `#C084FC`

---

### FR-02 — Parser: `parseBreedingCodes.ts`

Create `frontend/src/lib/parseBreedingCodes.ts`.

```typescript
export interface BreedingEntry {
  commonName: string
  scientificName: string
  codes: Record<string, number>  // code → count of observations
}

export interface BreedingData {
  entries: BreedingEntry[]    // species with ≥1 code, sorted A–Z
  codesPresent: string[]      // codes in data, in canonical order
}
```

**Algorithm:**
1. Parse header row. Throw `'INVALID_EBIRD'` if `common name` absent or content empty.
2. Find column indices: `common name`, `scientific name`, `breeding code`.
3. For each data row: skip if breeding code cell is empty. Skip if species matches `isExcluded` (spuh/slash/hybrid). Normalize subspecies parentheticals.
4. Skip any breeding code not in `BREEDING_CODE_MAP` (deprecated codes ignored).
5. Accumulate `entry.codes[code]++` per species.
6. Return entries sorted A–Z; `codesPresent` as the subset of canonical codes that appear in the data, in canonical order.

**Error:** throw `new Error('INVALID_EBIRD')` if no `common name` column or empty input.

---

### FR-03 — Types

Add to `frontend/src/types.ts`:

```typescript
export type BreedingSortColumn = 'name' | string
export interface BreedingSortState {
  column: BreedingSortColumn
  dir: 'asc' | 'desc'
}
export type BreedingFilter = 'all' | string
```

Add `'breeding-codes'` to the `Tab` union in `App.tsx`.

---

### FR-04 — `BreedingCodeList.tsx`

Parent component at `frontend/src/components/BreedingCodeList.tsx`.

**Props:** `onExpandedChange?: (expanded: boolean) => void`

**State:** `phase` (idle | error | ready), `sort: BreedingSortState`, `filter: BreedingFilter`, `expanded: boolean`

**File handling:** drop/click pattern matching `LifeList.tsx`. Accepts `.csv` only.
- If `common name` + `breeding code` columns present → parse.
- If `common name` present but no `breeding code` column → error: *"No breeding code column found — make sure you're using an eBird backup CSV that includes breeding data."*
- Otherwise → generic invalid-file error.

**Empty result:** if parsed successfully but zero breeding code rows → non-error message: *"No breeding codes found in this file. Breeding codes are entered on individual eBird checklists using the breeding behavior field."*

**Controls row:** filter pills left, species count + Show all / Load new file right.

---

### FR-05 — `BreedingCodeTable.tsx`

Component at `frontend/src/components/BreedingCodeTable.tsx`.

**Props:** `entries`, `codesPresent`, `sort`, `onSortChange`, `filter`, `expanded`

**Filtering:** when `filter !== 'all'`, show only entries where `entry.codes[filter] > 0`.

**Sorting:**
- `name` column: alphabetical; default `asc`.
- code column: by `entry.codes[column] ?? 0` descending; ties broken alphabetically; default `desc`.

**Layout:**
- Species name column: sticky-left (`position: sticky; left: 0; background: #fff; z-index: 1`), min-width 180px.
- Code columns: 44px wide, centered. One per entry in `codesPresent`, canonical order.
- Table wrapper: `overflow-x: auto`.

**Circle cells:**
- count > 0: 28px diameter circle, tier background color, white text, 11px 600-weight font, centered via flex.
- count = 0 / absent: empty (no element rendered).

**Column headers:**
- Sticky top, `background: #F9FAFB`, matching `LifeListTable.tsx`.
- Code headers: abbreviation text + `title` attribute with full label.
- Active column: sort indicator `↑` or `↓` in `#2D8653`.
- Inactive columns: muted `#71717A`.

---

### FR-06 — Filter Pills

- "All" pill: always first, green active state matching existing pill style.
- Code pills: one per code in `codesPresent`, canonical order. Each pill: 14px tier-colored circle + code text. Active: tinted border/background. Inactive: ghost button.
- One active at a time. Clicking active pill resets to `'all'`.
- `flex-wrap: wrap; gap: 6px`.

---

### FR-07 — Tab Integration (`App.tsx`)

- Add `'breeding-codes'` to `Tab` union.
- Fourth tab button: label "Breeding", icon `Dna` from lucide-react.
- Panel: `<BreedingCodeList onExpandedChange={...} />` using display-toggle pattern.

---

### FR-08 — No Backend Changes

No new API endpoints, routes, or backend files.

---

## Acceptance Criteria

**QA-01** — Dropping an eBird backup CSV with breeding code entries renders one row per species with ≥1 breeding code, and no other rows.

**QA-02** — Columns correspond to codes present in the data, in confirmed → possible order.

**QA-03** — Non-zero cells show a filled circle with the correct count. Zero/absent cells are blank.

**QA-04** — Circle colors follow the four-tier purple gradient: tier 4 darkest, tier 1 lightest.

**QA-05** — Clicking the species name header sorts A–Z (asc default), clicking again reverses.

**QA-06** — Clicking a code column header sorts by count descending (highest first), clicking again reverses.

**QA-07** — Active sort column shows ↑ or ↓; inactive columns show none.

**QA-08** — Filter pills show one pill per code present in the data, in canonical order, plus "All".

**QA-09** — Clicking a code pill filters to only species with ≥1 entry for that code.

**QA-10** — Clicking "All" (or the active pill) resets to all species.

**QA-11** — CSV with no breeding code entries renders the empty-state message, not an error.

**QA-12** — Non-eBird CSV or missing `common name` column shows the invalid-file error.

**QA-13** — "Load new file" resets all state to the upload screen.

**QA-14** — "Show all / Collapse" toggle works and notifies parent via `onExpandedChange`.

**QA-15** — No TypeScript errors. All existing tests pass.
