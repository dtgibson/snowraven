# Change Brief — Control Style Registers (2026-09-22 re-validation)

> **The original brief stands. It is left byte-identical beside this file.**
> `change-brief.md` and `design-refinement.md` were written 2026-09-15 and
> committed in `51a2c71`; that run ended without an Engineer stage. This file
> records what changed at HEAD in the 26 commits since, and carries the **three
> corrections** the re-measurement found. Read the original first; read this for
> the deltas. Nothing here needs a redesign.

## What is changing
Unchanged from `change-brief.md`: Part 1 the `.sr-pill` / `.sr-seg-btn` registers
(~44 inline-styled sites across 15 files, retiring `ghostBtn` and `sortBtn`);
Part 2 the clamp repair (`max(16px, 0.75rem) !important` is a replacement, not a
floor — ~13 controls gain an explicit `--sr-ctl-rem`); Part 3 the derived label
floor on 22 labels. The `Button` / `Link` primitives gain no visual ownership.

**Every load-bearing number was re-measured and every one holds.** `globals.css`
has **zero commits** since the design, so every CSS line number in
`design-refinement.md` is exact. Full table in `decisions.md`.

## Why now
The drift is still frozen, now measurably so. Running one census script at
`51a2c71` and at HEAD gives **identical counts at both commits** across four
tag-set variants (Button/button/Link/a: 179 styled of 286 — my denominator, not
the brief's 181 of 253; the delta is what matters and it is exactly **zero**).
The pill-family signatures are identical too: `overflow:'hidden'` 102,
`border:'none'` 83, `'var(--sr-accent-bg)' : 'transparent'` 17, at both commits.
`sr-btn-*` still has exactly **18 call sites, all in `Settings.tsx`**, unchanged
through that file's 140 lines of churn. `sortBtn`'s drift is still exactly one
line (`LifeListTable` `gap: 4`, `BreedingCodeTable` none); `ghostBtn`'s two
copies are still byte-identical. ROADMAP Up Next item 3 is unchanged.

## User-facing impact
Unchanged from the original brief. Desktop: nothing. Phone at normal text:
pills taller and rounder, section labels beside filter controls larger, a state
fade on every pill. Phone at 200%: several controls get bigger, Calendar's
SegControl 1px smaller.

**One published claim gets truer rather than needing an edit.**
`ACCESSIBILITY.md:51` promises the Text Size control "scales all text from 100%
up to 200%"; today the clamp shrinks ~13 controls at 200% instead, so the claim
is not fully true. This build makes it true. No `ACCESSIBILITY.md` edit is
required; a sentence there is the Chronicler's call. `docs/HELP.md`, `README.md`
and `website/` are **not touched** — no behaviour, copy or capability changes,
and the website/README approval gate is not opened.

## Design pass
**Needed; satisfied by the existing `design-refinement.md` and `design.html`
from 2026-09-15, re-validated at HEAD by The Designer as a scoped pass.** The
lane runs **7 stages** with Stage 2 as a re-validation errand, not a redesign.
The design's substance is intact: the two registers, radius 15px on the
affordance argument, the resting border left at `--sr-border`, the four custom
properties and the crossover invariant, the 8 pairings and one declared factor.
Three rows need the Designer's pen and nothing else — see below.

## Decisions touched
- **v1.0.24 (2026-09-08)** — relied on, not modified: primitives own only the
  tab-stop default; this pass is the independent work it names.
- **v1.0.20 (2026-09-06)** — its condition (1), a register pass giving
  `sr-btn-quiet` / `sr-btn-accent` a component owner, is what this discharges.
- **v1.0.19 (2026-09-05)** — its bundle-risk warning, knowingly accepted.
- **v1.0.18** — move `border`, `background` AND `transition` together.
- **v0.5.81 / v0.5.82** — the `max(16px, rem)` formula and its vertical-fit
  corollary. **REVERSED in part**: `.claude/rules/ui.md:42` states the corollary
  as if the formula carried each control's own `rem`; the shipped rule hardcodes
  `0.75rem`, which is Defect 1 written down as a guarantee.
- **v0.5.86** — the Breeding Codes filter row; deviation #2 makes its
  `height: auto !important` (`globals.css:4483`) redundant. `ui.md:73` names it.
- **v1.0.32 `sort-controls-selected-state` (`4b7ddfc`) — NEW, and it supersedes
  a design finding.** See correction 1.
- **REVERSED by this build:** `pipeline/design-system.md:156` ("spans and stay
  outside it by design") and the `ui.md` passages above.

## The three corrections

**1 — design §1.10 is superseded, and in the good direction.** The design found
11 of 44 sites without `aria-pressed`, named four sort-segment groups, and said
do not fix them here; recommend a follow-up. **That follow-up shipped** at
v1.0.32 (`4b7ddfc`). `ChecklistComparer.tsx`, `ResultsView.tsx`,
`MediaCommentsSection.tsx` and `SpeciesDetail.tsx` now each carry
`role="group"` + `aria-label="Sort order"` on the shell and a literal
`aria-pressed` per option. Consequences: the count is now **7 of 44**; §1.5's
`[aria-pressed="true"]`-after-`:hover` cascade now actually **engages** on those
four, so the register can carry their selected state through the attribute
instead of the inline `style` prop; and a new guard is in the path —
`frontend/src/components/sortControlsSelectedState.test.tsx` (272 lines,
literal `"true"`/`"false"`, exactly-one-true, movement on click, `getByRole`).
The register pass must keep it green and must not strip those attributes off
the shells it rewrites. Do not re-raise §1.10's recommendation at closeout.

**2 — one closeout obligation is already discharged; acting on it would do
harm.** The original brief's last Decisions row says `PRODUCT_CONTEXT.md:1730`
still carries the superseded v1.0.19 decline text. True at `51a2c71` (verified,
verbatim at line 1730). At HEAD that entry is rewritten and correctly framed —
"Shared Button/Link primitives — DECLINED TWICE, THEN BUILT (v1.0.24) … This
entry is kept only to record the reversal". **Drop the row.**

**3 — design §1.8's inline-transition list is loose, and was loose when
written.** It names six sites; there are **five**. `SpeciesDetail.tsx` carries
exactly two `all 0.15s` (`:1157`, `:1425`) at HEAD *and at the design commit* —
the third cited line does not exist; the file's other two transitions are
`transform 0.15s` chevron rotations on disclosure buttons, not pill chrome
(Engineer's call, my reading: out of scope). The real five are
`ListComparer.tsx:194`, `:259`; `SpeciesDetail.tsx:1157`, `:1425`;
`Settings.tsx:205`. **Sweep this by `grep -n transition`, never by the design's
line numbers** — and note the design cites the *site* (the `<Button` tag or the
style-object declaration), not the property line, so `ListComparer:186/:248` and
`Settings:192` are correct as written and only look like drift.

## Rule `paths` owed — two extensions, in this same change
`.claude/rules/ui.md` gates on `frontend/src/components/**`, `globals.css`,
`index.html` and six `lib/*` globs. **Two files this build edits are not gated**
and must be added per CLAUDE.md's v1.0.32 obligation:
- `frontend/src/App.tsx` — carries one of the ~13 controls (`:1015`, the
  `0.875rem` checklist input) and one of the 22 labels (`:997`).
- `frontend/src/lib/mapExplorerFormat.ts` — `SELECT_STYLE` at `:26` is the
  shared object behind two of the ~13 controls (`MapExplorer.tsx:2076`, `:2100`).

**And the design's §2.8 replacement wording is right in substance, wrong about
where.** Only `pipeline/design-system.md:156` carries "spans and stay outside it
by design"; `ui.md` has no label-exclusion clause. `ui.md` owes **three**
passages, not one: `:41` (the `.sr-ctl-row` parenthetical), `:42` (**the one
actually false at HEAD** — it quotes `max(16px, 0.75rem)` verbatim and states
the v0.5.82 corollary as a guarantee the shipped rule does not keep), and `:73`
(the v0.5.86 `height: auto !important` the register makes redundant). The
Designer supplies wording for `:42` and `:73`; `:41` and `design-system.md:156`
are already written.

## What done looks like
Everything in the original brief's "What done looks like", plus: the four
`aria-pressed`-bearing sort controls keep `sortControlsSelectedState.test.tsx`
green with their attributes intact; `ui.md`'s `paths` covers `App.tsx` and
`lib/mapExplorerFormat.ts`; `ui.md:42` and `:73` are amended alongside `:41` and
`design-system.md:156`; and the `PRODUCT_CONTEXT.md` row is **not** actioned.

**No version bump here** — one bump at the bundle flush; the changelog line goes
in `pr-description.md`. Per v1.0.29 the bundle sign-off's live look over the
tailnet must cover: the phone tier at **100% and 200%** text scale; the **four
segmented sort controls** (List Comparer checklist mode and list mode,
Multimedia, Species Detail); the **Breeding Codes filter row at 320px** (and
`ACCESSIBILITY.md:87`'s no-horizontal-scroll claim with it); the **Checklists
filter row at 200%**, where the `width: 72` companion fix lands; the **Map
Explorer sidebar**, which renders one label register over two control sizes in
one panel; and the **command palette search at 200%**, the +8px case.
