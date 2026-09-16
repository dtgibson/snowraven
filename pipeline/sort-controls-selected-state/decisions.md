# Decisions — sort-controls-selected-state

## 1. The attributes are applied IN PLACE at all four sites; `SortSeg` is NOT extracted

**Decision.** Each of the four wrappers gains `role="group" aria-label="Sort order"` and each
option gains `aria-pressed`, written at the site. No shared component is created, and
`SortSeg` stays private to `Checklists.tsx`.

**Why, given that in-place duplication is what let the four drift.** The four are not four
copies of one control; they are three distinct visual variants, and a shared component would
have to be parameterised past the point where it prevents anything:

| Site | wrapper `display` | option height | font size | active weight | `whiteSpace` | labels |
|---|---|---|---|---|---|---|
| `Checklists.tsx` `SortSeg` (reference) | `inline-flex` | 32 | 0.75rem | **600** | — | Newest / Oldest |
| `MediaCommentsSection.tsx` | `inline-flex` | 32 | 0.75rem | **500** | — | Newest / Oldest |
| `SpeciesDetail.tsx` | `inline-flex` | 32 | 0.75rem | **500** | — | Newest / Oldest |
| `ChecklistComparer.tsx` | `flex` | 34 | 0.8125rem | 500 | `nowrap` | Taxonomic / A–Z |
| `ResultsView.tsx` | `flex` | 34 | 0.8125rem | 500 | `nowrap` | Taxonomic / A–Z |

The active font weight is the decisive row. `SortSeg` bolds its selected option to 600; the two
comment sorts do not. Extraction therefore had exactly two outcomes, and the brief forbids the
first: change pixels at two of four sites, or carry a `boldActive` prop that preserves an
inconsistency nobody has asked to keep. Add the height, font-size, `whiteSpace`, wrapper
`display` and label-pair props needed for the other two variants and the shared component is a
style bag whose only genuinely shared content is the three ARIA attributes this fix is adding —
while every visual detail stays per-site and free to drift exactly as before. Fix-lane
discipline (minimal change, maximum precision) then settles it: the shipped diff is the same
three ARIA attributes on each of the four controls and nothing else -- no new module, no changed
render output. (An earlier draft said "eight added attributes"; the count is twelve, and stating
the property rather than a count is the repair, per this repo's docs rule. Corrected at the
security review.)

**What the drift argument gets instead.** The drift was possible because nothing enumerated
these controls. The repair for that is the roster, not the component:
`frontend/src/components/sortControlsSelectedState.test.tsx` holds one row per control and
drives one template over all four, so the path list is an artifact and a fifth control with no
row reads as a gap rather than as nothing at all (`.claude/rules/testing.md`, "symmetry in the
code is not symmetry in the evidence" — reach for the roster at the FIRST instance).

**What would reverse it.** A fifth segmented sort control, or any change that makes the five
variants converge on one shape (most likely: a decision that the selected option should bold
everywhere). Either makes extraction cheap and this decision wrong; the exact move is then to
lift `SortSeg` out of `Checklists.tsx` into `components/ui/`, take `options`, `value`,
`onChange` and a size variant, and have every site render through it.

## 2. No IDREF is introduced anywhere

`aria-labelledby` / `aria-describedby` / `aria-controls` are all absent by design. The reference
pattern needs none, and CLAUDE.md's v1.0.21 rule is that a DOM identifier keyed on user file
content can carry whitespace, which cannot resolve as an IDREF and silently switches off the
announcement it exists for. The group's name is a literal `aria-label`, which has no id at all.

## 3. The group name is the reference's literal, "Sort order"

All four reuse `SortSeg`'s exact `aria-label`. One control per surface carries it, so there is
no same-name collision to disambiguate, and copying the literal is what keeps the five from
drifting on wording the way they drifted on state.

## 4. Deliberate non-action: the two `SortSeg` call sites are NOT given roster rows

`Checklists.tsx:204` and `:755` are the working reference and were never broken, but nothing in
the suite asserts their `aria-pressed` either — that is a pre-existing gap, measured here and
left alone rather than silently absorbed into this fix.

- **Evidence.** `Checklists.test.tsx` is not among the test files that assert `aria-pressed`.
  Stated as the property rather than as a count: an earlier draft of this entry said "twenty",
  which was wrong, and the count is not what the decision rests on (this repo's docs rule —
  state the property, never a count).
- **Why not now.** Adding rows means mounting the Checklists tab with its own fixtures, which is
  scope this fix does not own, and the reference is the one shape the four were repaired *to*,
  so it is the least likely of the six to regress unnoticed.
- **What reverses it.** The first change that touches `SortSeg`, or a fifth control joining the
  roster. The exact fix is two more rows in
  `frontend/src/components/sortControlsSelectedState.test.tsx`'s `ROSTER`, each mounting the
  Checklists tab and resolving its group from an option's parent, as the four rows already do.
  The file header states this so the omission reads as a decision rather than an oversight.

## 5. Deliberate non-action: no repo-wide source-scanning guard

A `tabOrderCoverage`-style AST scan could assert that every JSX element carrying the selected-state
signature (`'var(--sr-accent-bg)' : 'transparent'`) also carries `aria-pressed`. It is not written.
The Evaluator's sweep found 17 sites with that signature and 13 already correct by **three different
patterns** (`aria-pressed`, `aria-selected` on `role="option"`, `role="img"` plus a state-bearing
`aria-label`), so the guard would need an allowlist of correct answers on day one, and a legitimate
fourth pattern would turn it red under a test name pointing at the wrong thing. The roster carries the
enumeration instead, at four rows the reader can see. **Reversal:** a sixth or seventh site, at which
point the enumeration stops being readable and the scan earns its false-positive cost.

## 6. `ACCESSIBILITY.md` gains one sentence, and it states the property rather than a roster

The published statement was not false before this fix (it named filter pills, switches and
sortable columns, never these). It is now the natural home for the repaired behaviour, so the
Screen Reader Support paragraph gains one sentence. Two things it deliberately does not say:
it does not count the controls, and it does not claim every row of sort choices is a named
group. The group half is scoped to "where those choices are drawn as one segmented control",
which is true of every one of those: `SortSeg`'s two call sites, `MediaStatsSections`,
`BreedingCodeList`, `LifeList`, and the four repaired here.

**Correction (QA, this build).** An earlier draft of this entry justified that scoping by saying
`NamedBirdsTable.tsx:141` is a row of pills with `aria-pressed` and **no** `role="group"`. That is
false: `NamedBirdsTable.tsx:130` is `<div role="group" aria-label="Sort named birds">` enclosing
the pills, and the role-less `sr-wrap-flex` div at `:136` is what was misread. The bug brief had
it right, listing that site among those already matching the reference. The scoping of the
published sentence stands and is worth keeping, but it is now **conservative rather than
necessary**: those pills are deliberately drawn as separate self-bordered pills instead of one
segmented shell (the reason is in a code comment at `NamedBirdsTable.tsx:132-135`), so the
sentence understates rather than excludes. Recorded here because a decision justified by a false
fact is the kind of thing that gets promoted into `DECISIONS.md` and then believed.
