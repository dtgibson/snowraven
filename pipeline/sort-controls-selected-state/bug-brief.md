# Bug Brief — sort-controls-selected-state

## What is broken
Four segmented sort controls carry their selected option **only** in inline `background` / `color`
styles. No `aria-pressed`, no `role="group"`, no `aria-label`, no `.sr-only` cue, no `title` — checked
on each, so this is a confirmed absence, not a missed alternative carrier. A screen reader reads two
identically-named buttons ("Taxonomic" / "A–Z", "Newest" / "Oldest") with no way to tell which is active.
WCAG 1.4.1 (colour alone) and 4.1.2 (state not exposed).

## The working reference — `SortSeg`, `frontend/src/components/Checklists.tsx:65-85`
Wrapper `<div role="group" aria-label="Sort order">`; each option is the canonical `Button` primitive
carrying `aria-pressed={value === dir}`. Used twice (`Checklists.tsx:204`, `:755`). That is the whole
spec — an `aria-pressed` button group, not a listbox, not a native `<select>`, no IDREFs anywhere.
Five more controls already match it (`NamedBirdsTable.tsx:141`, `MediaStatsSections.tsx:252`,
`BreedingCodeList.tsx:392`/`:404`, `LifeList.tsx:784`/`:791`); the two sortable tables are a different,
already-correct pattern (`aria-sort` on the `<th>`: `LifeListTable.tsx:263,283,300`, `BreedingCodeTable.tsx:254,275`).

## Steps to reproduce
1. Render each component below and read the option buttons' DOM.
2. `expect(btn.hasAttribute('aria-pressed')).toBe(false)` passes on every option — the defect.
3. Click the inactive option; the only DOM change is inline `background`/`color`. Nothing announceable moves.
4. The same assertion against `Checklists.tsx`'s `SortSeg` finds `aria-pressed="true"` / `"false"`.

## The four (swept, not taken on trust)
1. `frontend/src/components/ChecklistComparer.tsx:297-308` — Taxonomic / A–Z (List Comparer tab, checklist mode)
2. `frontend/src/components/ResultsView.tsx:57-78` — Taxonomic / A–Z (List Comparer tab, list mode)
3. `frontend/src/components/MediaCommentsSection.tsx:87-103` — Newest / Oldest (Multimedia tab)
4. `frontend/src/components/SpeciesDetail.tsx:1599-1616` — Newest / Oldest (Species Detail tab)

Four searches agreed on this set and found no fifth: every `role="group"`; every
`'var(--sr-accent-bg)' : 'transparent'` selected-state signature (17 hits, 13 already correct);
every sort-setting click handler (12 JSX sites); every `aria-sort`. Sibling same-shape controls were
checked and are **fine**: `SpeciesCombobox.tsx:248` (`aria-selected` on `role="option"`),
`ChecklistBadges.tsx:22-25` (`role="img"` + state-bearing `aria-label`), `MapSidebarUI.tsx:125`,
`CountyLayer.tsx:599`, `MapExplorer.tsx:2691`, `AtlasLayer.tsx:329` (all `aria-pressed`).
The idea said four and there are exactly four.

## Expected behavior
Each of the four announces its active option exactly as `SortSeg` does: one `role="group"` with an
accessible name, and every option button carrying `aria-pressed`, `"true"` on the active one.

## Blast radius
Four component files, attributes only — **no visual change**, no layout, no tokens, no state, no copy.
All four already render through the canonical `Button` primitive with no explicit `tabIndex`, so
`lib/tabOrderCoverage.test.ts`'s roster and its cardinality are untouched.
**Do not introduce any IDREF** (`aria-labelledby`, `aria-activedescendant`, generated `id`) — the
reference pattern needs none, and the v1.0.21 rule (an id keyed on user file content can carry
whitespace and silently kills the announcement) is the adjacent failure this fix must not import.
No recorded decision in `DECISIONS.md` is touched or reversed. `ACCESSIBILITY.md` states no claim that
is false today (it names filter pills, switches and sortable columns, not these), so nothing published
is a lie now; it is the natural home for a sentence once fixed. No `docs/HELP.md`, `README.md` or
`website/` change is owed — nothing user-visible changes. `ResultsView.tsx` has no test file today.

## What done looks like
Automated, attribute-level, no screen reader needed. For each of the four controls:
1. Every option button carries a **literal** `aria-pressed` whose value is exactly `"true"` or `"false"`
   (assert the string, not truthiness — an absent attribute and `aria-pressed="false"` must not both pass).
2. Exactly **one** option in the group reads `"true"` at all times.
3. After clicking the inactive option, the `"true"` has **moved** to it and the other reads `"false"`.
4. The wrapper is `role="group"` with a non-empty accessible name (`getByRole('group', { name })`).
Mutation check: deleting `aria-pressed` from one option must turn each assertion red.
