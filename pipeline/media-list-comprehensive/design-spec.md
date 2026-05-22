# Design Spec — Media List: Comprehensive Species View

## Visual Direction

Quiet utility matching the existing SnowRaven aesthetic. No new visual patterns introduced — all three new toggle controls use the existing `ToggleSwitch` button component already defined in `SpeciesDetail.tsx` (28×16px track, green fill when checked, 12px label, 0.15s transition). They slot into the existing controls row between the sort toggle and the count label without changing layout or introducing any new visual weight.

The zero-count columns render identically to existing columns — `—` dash in `var(--sr-text-disabled)` — matching existing not-applicable rendering.

## Screens / Views

### Controls Row — Three New Toggles

The controls row gains three `ToggleSwitch` buttons after the sort toggle group and before the count label. In ML-only mode (no eBird backup), only the first two toggles appear; the third is hidden.

**Toggle 1 — "Show subspecies"**
- Default: OFF (merge mode)
- When OFF: subspecies parentheticals stripped, entries collapsed to parent name
- When ON: each subspecies variant is its own row
- Always visible in ready state

**Toggle 2 — "Show sp./slash"**
- Default: OFF (hidden)
- When OFF: entries ending ` sp.` or containing `/` are excluded
- When ON: spuh/slash entries appear normally
- Always visible in ready state

**Toggle 3 — "Show non-bird"**
- Default: OFF (hidden)
- When OFF: ML-only entries absent from eBird backbone are excluded
- When ON: non-bird entries appear, sorted after all bird entries in taxonomic mode
- Visible only when `hasEbirdBackbone === true`

**Visual treatment of toggles:**
- Identical `ToggleSwitch` button used in `SpeciesDetail.tsx`
- Height 30px, `border-radius: 6px`, `border: 1.5px solid var(--sr-border)`, `background: var(--sr-surface)`
- Track: 28×16px, `border-radius: 8px`; fill transitions `var(--sr-gray-400)` → `var(--sr-accent)` on check
- Thumb: 12×12px white circle, `left: 2` → `left: 14`, 0.15s transition
- Label: 12px, 500 weight, `var(--sr-text-muted)`
- Toggles are grouped at the right end of the controls row, separated from the sort group by an existing separator `div` (`1px × 20px`, `var(--sr-border)`)

### Zero-Count Entries in the Table

No visual change to column structure. Species with no ML media (zero counts in all three format columns) render identically to existing zero-count columns:
- Count cells show `—` in `var(--sr-text-disabled)`
- No ML catalog link rendered
- "Total" column shows `—`

### Non-Bird Entries

No visual badge or indicator. Non-bird entries render identically to bird entries: same columns, same count display, same ML catalog links when available. In taxonomic sort they appear after all bird entries (after `Infinity`-ranked eBird species).

### Count Label

Count label behavior extends naturally:
- No filter active, no location filter: `"N species"` (comprehensive total)
- Any filter active: `"N of M species"` (M = comprehensive pre-filter count)
- In comprehensive mode, M includes all eBird species (post-toggle filtering, pre-media-filter)

## Component Usage

- `ToggleSwitch` — copied verbatim from `SpeciesDetail.tsx` into `LifeList.tsx`; identical styling, no extraction needed (per schema OQ-01 decision)
- All other components unchanged: filter pills, sort toggle, county dropdown, date range inputs, `LifeListTable`

## Design Tokens Applied

| Token | Usage |
|---|---|
| `--sr-surface` | Toggle button background |
| `--sr-border` | Toggle button border |
| `--sr-text-muted` | Toggle label text (both on/off) |
| `--sr-accent` | Toggle track fill when checked |
| `--sr-gray-400` | Toggle track fill when unchecked |
| `--sr-text-disabled` | Zero-count `—` dash in table cells |

No new tokens needed. No new color values introduced.

## Interaction Notes

- **Toggle reactivity:** All three toggles update `displayEntries` synchronously via `useMemo`. No loading state needed.
- **County/date filter in comprehensive mode:** Filters both `rawEbirdObs` and `rawRows` independently; `buildComprehensiveEntries` is called with the filtered sets.
- **Sort interaction with non-bird:** `LifeListTable` sort comparator checks `isNonBird` before existing column sort logic; non-bird entries always after bird entries when `sort.column === 'name'`. A–Z sort treats non-bird entries alphabetically with all others (no partition).
- **Reset:** "Load different file" / "Load new file" button resets all three toggle states to defaults (OFF).
- **Non-bird toggle visibility:** Toggle is rendered conditionally — only when `phase.tag === 'ready' && phase.hasEbirdBackbone === true`.

## Content Notes

- Toggle labels match the existing pattern from Species Detail: "Show subspecies", "Show sp./slash"
- Third toggle label: "Show non-bird"
- Non-bird section separator label: "Non-Bird Media"
- New filter pill label: "Has media" (positive filter — shows only species with at least one photo, audio, or video item)
- No empty-state message changes — existing ML-only empty state is unchanged
- No new tooltips, popovers, or help text needed
