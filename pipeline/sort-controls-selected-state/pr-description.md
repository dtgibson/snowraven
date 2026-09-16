## Sort controls announce which option is selected

### What this does
Four segmented sort controls carried their selected option only in inline `background` /
`color` styles: no `aria-pressed`, no `role="group"`, no hidden text. A screen reader read two
identically named buttons ("Taxonomic" / "A–Z", "Newest" / "Oldest") with no way to tell which
sort was in force (WCAG 1.4.1 colour alone, 4.1.2 state not exposed). Each wrapper now carries
`role="group" aria-label="Sort order"` and each option carries `aria-pressed`, which is the
shape `SortSeg` in `Checklists.tsx` already used and that five sibling controls already matched.

Attributes only. No visual, layout, token, state or copy change; the rendered output is
byte-identical apart from the three ARIA attributes per control.

| File | Control |
|---|---|
| `frontend/src/components/ChecklistComparer.tsx` | Taxonomic / A–Z (List Comparer, checklist mode) |
| `frontend/src/components/ResultsView.tsx` | Taxonomic / A–Z (List Comparer, list mode) |
| `frontend/src/components/MediaCommentsSection.tsx` | Newest / Oldest (Multimedia) |
| `frontend/src/components/SpeciesDetail.tsx` | Newest / Oldest (Species Detail comments) |

### How to test
1. `cd frontend && npm run dev`, then open http://localhost:5173.
2. **List Comparer → Compare two checklists.** Enter two eBird checklist IDs and compare.
   Inspect the Taxonomic / A–Z pair: the active one reads `aria-pressed="true"`, the other
   `"false"`, and the `"true"` moves when you click the other.
3. **List Comparer → Compare two lists.** Upload or pick two lists and check the same pair on
   the results header.
4. **Multimedia → Media Comments** (needs a Macaulay Library export carrying captions or media
   notes): the same on Newest / Oldest.
5. **Species Detail → pick a species → Comments**: the same on Newest / Oldest.
6. With VoiceOver on, each option now reads as a toggle button reporting selected or not, inside
   a group named "Sort order".

`pipeline/sort-controls-selected-state/how-to-see.md` has the same walkthrough in plain English.

### Notes for reviewer
- **In place, not extracted.** `SortSeg` was deliberately not lifted into a shared component.
  The five instances are three distinct visual variants, and the reference bolds its selected
  option to 600 where the two comment sorts use a flat 500 — so extraction either changes pixels
  at two sites (which this fix forbids itself) or carries a prop preserving an inconsistency.
  The full table and the reversal condition are in
  `pipeline/sort-controls-selected-state/decisions.md`.
- **The drift protection is a roster, not a component.**
  `frontend/src/components/sortControlsSelectedState.test.tsx` holds one row per control and
  drives one template over all four (16 tests), per `.claude/rules/testing.md`'s "symmetry in
  the code is not symmetry in the evidence" — so a fifth control with no row reads as a gap.
  Each row resolves its group structurally, from an option button's parent, never through
  `getByRole('group')`, which is what keeps the arms independent.
- **Assertions are on the literal string**, so an absent attribute cannot pass as `"false"`;
  plus exactly one `"true"` per group, that the `"true"` moves on click, and that the wrapper
  resolves through `getByRole('group', { name: 'Sort order' })`.
- **Mutation-checked, seven mutations, each isolating one arm:** dropping `aria-pressed` at each
  of the four sites reddens that surface's three state rows and nothing else; dropping
  `role="group"` (and separately the `aria-label` alone, with the role kept) reddens that
  surface's naming row alone; freezing `aria-pressed` to `true` reddens "exactly one true" and
  "the true moves"; freezing it to one option reddens "the true moves" alone; and
  `aria-pressed=""` reddens the literal-value row.
- **No IDREF anywhere** (`aria-labelledby` / `aria-describedby` / `aria-controls`). The pattern
  needs none, and CLAUDE.md's v1.0.21 rule is that an id keyed on user file content can carry
  whitespace and silently kills the announcement it exists for.
- **`lib/tabOrderCoverage.test.ts` is untouched**: all four already render through the canonical
  `Button` primitive with no explicit `tabIndex`, so the roster and its cardinality do not move.
  Verified green.
- **`ACCESSIBILITY.md`** gains one sentence in Screen Reader Support. It states the property and
  not a count, and scopes the "named group" half to controls drawn as one segmented control —
  `NamedBirdsTable`'s sort pills carry `aria-pressed` with no `role="group"`, so a blanket claim
  would have been false.
- **No version bump, changelog, or website edit** in this commit: this is build 2 of 5 in a
  bundled Spool release taking a single version bump at the end.
- Verified: `npm run build` green (tsc + vite), eslint clean on all five touched files, and 19
  test files / 389 tests green, covering the four components, everything that mounts them, the
  tab-order guard, and the published-claims suites.

### Changelog line
- Sort controls on List Comparer, Multimedia and Species Detail now announce which option is selected to screen readers

🤖 Generated with [Claude Code](https://claude.com/claude-code)
