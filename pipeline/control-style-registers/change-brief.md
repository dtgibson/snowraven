# Change Brief — Control Style Registers

> **Scope extended at the design stage (2026-09-15), by user decision, after
> measurement.** This brief originally scoped Part 1 only. The Designer's measurement
> found that the phone-tier text floor is applied to controls and not to their
> labels, and that the floor rule is itself defective. The Orchestrator recommended
> splitting the label work in two and was overruled: the user's reasoning was that
> they are not in a rush, want the app fixed correctly, and that leaving 11 labels
> wrong *because their foundation is wrong* preserves the defect rather than fixing
> it. That judgement was vindicated during the redesign — see *Why now*.

## What is changing

**Part 1 — pill registers.** Move the visual contract of the toggle/filter pill
family out of bespoke inline styles into shared CSS registers in `globals.css`, and
retire the two duplicated JS style helpers (`ghostBtn`, `sortBtn`). 44 inline-styled
sites across 15 files collapse to TWO registers, because the family is two shapes:
`.sr-pill` (~28 standalone) and `.sr-seg-btn` (~15 segmented, which take their edge
from a wrapping `overflow:hidden` shell and would break under a pill register). They
share height and type size and differ only at the edge. 7 heights → 30px, 6 radii →
15px, 4 font sizes → 0.75rem. 38 of 44 gain a 120ms ease-out transition; 6 carry
inline transitions that must be REMOVED, not left behind.

**Part 2 — clamp repair.** `max(16px, 0.75rem) !important` is not a floor. It is a
REPLACEMENT that overrides a control's declared size in both directions, clamping
App's `0.875rem` input from 28px DOWN to 24px at 200% text scale, with Map Explorer's
selects and the Weather forecast's inputs the same. This is the same inversion
`filterControlSizeCss.test.ts` exists to prevent, surviving in a form it does not
check. ~13 controls across 8 files gain an explicit `--sr-ctl-rem` so the rule
becomes a genuine floor.

**Part 3 — label relationship.** All 22 labels across 8 files (11 inside
`.sr-ctl-row`, 11 paired with a standalone `.sr-input-16`), spanning 8 distinct
pairings, 4 label sizes and 6 control sizes. Each label's floor is DERIVED from its
own control's repaired floor rather than set as a constant — four floors are needed,
so a pair of constants would have been the wrong count on day one.

The `Button` / `Link` primitives are NOT broadened and gain no visual ownership; the
accessibility seam is untouched. **Explicitly out:** the other ~141 inline-styled
sites; the 7 hand-rolled 44x24 switch tracks (they want the shared `ToggleSwitch` —
a different build with its own ARIA surface); the 15 icon-only controls; the 11 pill
sites lacking `aria-pressed` (an ARIA/behaviour change, recommended as a follow-up);
the cleaner "control declares only the property, shared rule supplies the size"
refactor, which rewrites ~25 components and is a refactor rather than a repair; new
surfaces, copy, behaviour or keyboard changes; the version bump and CHANGELOG.

## Why now
Re-measured at HEAD, not quoted: **181 of 253 primitive control sites carry a
bespoke inline `style`** — the same 181 recorded at v1.0.19 (of 235) and v1.0.20
(of 243). The drift is frozen rather than growing: work since has used classes
(`.sr-plan-*`, `.sr-hotspot-*`) while the legacy sites sit untouched. ROADMAP Up
Next item 3 names this work, and v1.0.24 cleared its blocker by shipping the
primitives with visual ownership deliberately excluded, calling the register pass
"independent work rather than a prerequisite". Meanwhile the shared registers have
exactly ONE consumer file — all 18 `sr-btn-*` call sites are in `Settings.tsx` —
and `sortBtn` has ALREADY drifted between its two copies (`LifeListTable` carries
`gap: 4`, `BreedingCodeTable` does not), which is precisely the failure the idea names.

**The scope extension paid for itself before it was built.** Designing Part 3 against
the UNREPAIRED clamp produced wrong label ratios — computed against a fixed
`0.75rem`, App's label came out at 18.67px when its own register gives 16px, which
would have shipped a label LARGER than the control beside it. Repairing the
foundation first is what surfaced the error. A related claim was also corrected: the
crossover invariant is not "every register crosses at 1.333x" (true only for
`0.75rem` controls) but the stronger "a label always crosses at the same scale as the
control beside it", because both terms carry the same ratio and it cancels. Across
the 8 pairings that ranges 1.14x-1.39x.

## User-facing impact
Visible, and intended. **Desktop: nothing changes, from any part of this build.**

**Phone at normal text:** pills get taller and rounder, so a filter row that fits on
one line may take two; every pill gains a state fade; section labels beside filter
controls get noticeably larger (the dominant register 11px → 14.67px, and more below
100%). **Phone at large text:** several controls get BIGGER — the command palette
gains 8px at 200%, App and Species Detail 4px, the Weather forecast 3px, Map Explorer
and Checklists 2px, while Calendar's SegControl loses 1px by returning to its own
declared size. That is the accessibility half of the build and it is invisible at
100%. The label change is invisible at 200%, because the registers already agree
there. No control changes its label, behaviour, keyboard path, tab stop or position.

## Design pass
**Needed.** This is not relocation of duplicated styling. The measurement says the
styling is genuinely divergent, so defining the register means CHOOSING one height,
one radius and one type size for a family currently rendered six ways — a visible
choice on every tab, not a refactor. The byte-identical framing was tested against
the tree and does not hold: it fits 3 of 181 sites. Even the two "same" `sortBtn`
copies differ by 4px of gap, so unifying them is itself a design decision. The
Designer sets the family's register (rest / hover / active / disabled, the phone
posture, and how the accent active state reads) against `pipeline/design-system.md`;
the Engineer builds to it. The user has asked to be brought in at this step.

Radius resolved to **15px** on the affordance argument (action buttons are radius 6
at 32px; pills are 30px, so at radius 6 two classes of control are the same shape two
pixels apart and shape carries no information), with the `design-system.md` citation
as corroboration only. Resting border left unchanged (option A).

## Decisions touched
- **v1.0.24 (2026-09-08), the two primitive declines REVERSED** — relied on, not
  modified: it holds visual ownership out of the primitives and names this pass as
  independent work. This build honours that boundary rather than widening it.
- **v1.0.20 (2026-09-06), second primitive decline** — its stated condition (1), "a
  register pass giving `sr-btn-quiet` / `sr-btn-accent` a component owner", is what
  this discharges. The decline of *primitives as visual owners* stands, unreopened.
- **v1.0.19 (2026-09-05), first decline** — its **bundle risk** warning (a large
  mechanical control refactor late in a Spool bundle, on one sign-off and one
  end-of-bundle suite run) shaped the original slice. The user deliberately widened
  past it at the design stage on the reasoning recorded above; the warning is not
  dismissed, it is knowingly accepted and belongs in the closeout record.
- **v1.0.18, move the WHOLE chrome — `border`, `background` AND `transition` —
  when a class takes over inline chrome.** The governing mechanism; `.sr-toggle` is
  the reference, and a left-behind inline `transition` silently beats the class.
- **REVERSED by this build:** both `.claude/rules/ui.md` and `pipeline/design-system.md`
  state these labels "are spans and stay outside it by design". Both must be amended
  in the SAME change, saying why the exclusion was right when written and where it
  stopped holding. Replacement wording is in `design-refinement.md`; it carries
  "this change" in three places and must be stamped with the real shipped version at
  the bundle's single bump, because a wrong version citation in a rule file outlives
  the build.
- **Stale record to correct at closeout:** `PRODUCT_CONTEXT.md:1730` still carries
  the superseded v1.0.19 decline text (181 of 235, the guard-population reasoning),
  withdrawn at v1.0.20 and reversed at v1.0.24.

## What done looks like
The pill family renders from the two shared registers at all 44 sites with no inline
chrome left on them, and `ghostBtn` / `sortBtn` are gone with their drift resolved
deliberately. The clamp is a genuine floor: no control's declared size is reduced at
any scale. All 22 labels derive their floor from their own control's repaired floor,
verified per pairing rather than against a single assumed register.

Guards: `filterControlSizeCss.test.ts`'s `/^max\(\s*16px\s*,/` assertion is the ONE
existing assertion that goes red, and is amended to resolve the variable from `:root`
while keeping the intent that the iOS floor is provably 16px; three new assertions
are added, including one that COMPUTES the derivation rather than restating literals.
Both `MapExplorerInputZoom.test.tsx` and `MapExplorerSpeciesFilter.test.tsx` are
EXTENDED (neither breaks) to assert `--sr-ctl-rem` is present and matches the asserted
`fontSize`, without which the clamp repair could silently miss those controls.
`breedingCodeFilterRowCss.test.ts` forbids `.sr-ctl-row`-selected rules carrying
`min-width`, so the Checklists companion layout fix — needed because "Where & when"
no longer fits its fixed 72px label column — must be scoped to the Checklists subtree.

`tabOrderCoverage.test.ts` passes with its roster unchanged (no control gains or loses
a tab stop), every colour resolves through `var(--sr-*)` in both themes, WCAG 2.1 AA
holds at 320px and 200% text scale, and `npm run build` passes. Confirmed against the
BUILT app over the tailnet before the deploy gate, per the live-look rule — a register
change is exactly the kind jsdom and a stylesheet scan cannot measure.
