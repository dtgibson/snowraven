# Design Refinement — Control Style Registers

**SnowRaven · Improve lane · Stage 2 design pass · `control-style-registers`**

> **Read this first if you are building from it.** This document is written to
> be **self-sufficient**. The session that produced it will not exist when the
> build runs, and nobody can be asked a follow-up question. Every measurement,
> every number, every decision and its reasoning is recorded here. Where a
> figure was measured rather than assumed, it says so. Where something was
> considered and rejected, the rejection is recorded so it is not re-derived.

**Mockup:** `design.html` beside this file — every register and every change
rendered in both themes, on the app's real tokens.

---

## 0. What this build does, in one page

Three related pieces of work, in one build:

1. **The pill/filter registers.** ~44 inline-styled control sites across 15
   files collapse onto two shared CSS registers. Visible, intended.
2. **The clamp repair.** The phone-tier rule `max(16px, 0.75rem) !important` is
   not a floor — it is a *replacement* that overrides a control's declared size
   in **both** directions, shrinking large controls for large-text users. It
   becomes a genuine floor.
3. **The label relationship.** 22 labels sitting beside floored controls were
   left unfloored, so the intended optical offset became a size gap. They gain a
   derived floor — derived from the *repaired* control floor, which is why (2)
   comes first.

**Out of scope, deliberately:** the other ~141 inline-styled control sites; the
7 hand-rolled switch tracks in `MapExplorer.tsx` / `map/HotspotModeControl.tsx`;
the 15 icon-only map controls; the `Button` / `Link` primitives, which are **not
broadened and gain no visual ownership**; new surfaces, copy, behaviour or
keyboard changes; the version bump and `CHANGELOG.md`.

**Standing constraints that apply to all of it:** every colour through
`var(--sr-*)` in both themes, no hardcoded hex or RGB; WCAG 2.1 AA holds at
320px and at 200% in-app text scale; when a class takes over inline chrome it
takes **border, background AND transition together** (v1.0.18 — a left-behind
inline `transition` is specificity 1,0,0 and silently beats the class rule).

---

# PART ONE — The pill and segmented registers

## 1.1 Visual direction

Quiet utility, unchanged. This does not introduce a look; it finishes one the
design system already declared and the code never converged on.
`pipeline/design-system.md` has specified for 61 shipped versions that filter
pills are 30px tall, 15px radius, `aria-pressed`, accent positive state,
tokenized negative tint — and `globals.css` already contains one faithful
class-based instance of it (`.sr-hotspot-mode-pill`). The family drifted away in
inline styles. **This is convergence on a stated register, not a new one.**

## 1.2 What was measured

Read directly from source at HEAD:

| Axis | Spread found | Chosen | Share |
| --- | --- | --- | --- |
| height | 7 declared: 24, 26, 28, 30, 32, 34, 36 (6 sites padding-driven) | **30px** | 21 of 38 |
| border-radius | 6 declared: 4, 5, 6, 8, 15, 20 (12 take the shell's) | **15px** | see 1.4 |
| font-size | 4 declared: 0.6875, 0.71875, 0.75, 0.8125rem | **0.75rem** | 25 of 44 |
| transition | **38 of 44 declare none at all** | 120ms ease-out | — |
| `aria-pressed` | **absent on 11 of 44** | unchanged (see 1.9) | — |

The change brief says "40 sites"; this sweep counted 44. **Same 15 files** — the
difference is only whether a `.map()` rendering several buttons from one style
object counts once or once per button. Nothing in scope moved.

## 1.3 Two registers, not one — the structural finding

15 of the sites declare `border: 'none'` and take their edge from a wrapping
`overflow: hidden` shell with `borderLeft`/`borderRight` dividers. **Those are
hand-rolled segmented controls, not standalone pills.** One register cannot
serve both: a segment has no radius and no outer border of its own, and giving
it one breaks the group it belongs to.

So there are two registers, which **share height and type size and differ only
in edge** — that is what keeps them reading as one family.

### Register A — `.sr-pill` (standalone toggle / filter pill, ~28 sites)

| Property | Value | Why this value |
| --- | --- | --- |
| `min-height` | `30px` | Modal value (21 sites); the design system's stated height; `.sr-hotspot-mode-pill`'s value. Three independent sources agree. |
| `border-radius` | `15px` | See 1.4. Exactly half the height — a true pill. |
| `padding` | `0 12px` | Modal value (14 sites). |
| `font-size` | `0.75rem` | Modal value (25 sites), and the register the phone-tier floor is built around. |
| `font-weight` | `500` rest, `600` pressed | Weight is the non-colour cue for the active state. |
| `gap` | `5px` | The family's modal gap where an icon sits beside a label. |
| `border-width` | `1.5px` | Universal in the family — zero sites use 1px or 2px. |

**`min-height`, not `height`, and this matters.** A fixed `height` is exactly
what forced the Breeding Codes pills to override it with
`height: auto !important` in the phone tier. A `min-height` lets a wrapped label
grow the control everywhere, and that existing override becomes redundant rather
than load-bearing.

### Register B — `.sr-seg` / `.sr-seg-btn` (segmented group, ~15 sites)

Same `min-height: 30px`, `padding: 0 12px`, `font-size: 0.75rem`, and the same
`500` → `600` weight shift. Differences: `border: none`, no radius (the shell
clips), `background: transparent` at rest, and a
`1.5px solid var(--sr-accent-border)` divider on the leading edge of each
sibling. The shell owns the outer border and the radius.

**Register B is a CSS register only.** Its sites are close cousins of the
existing `SegControl` component, which the change brief puts out of scope.
Converting them would be a component and ARIA change, not a styling one. Do not
convert them.

## 1.4 DECISION — radius 15px

**Decided by the user. The reason is affordance, and that is the half to keep.**

The app's action buttons are radius 6 at 32px tall (`.sr-btn-quiet`,
`.sr-btn-accent`); pills are 30px. At radius 6, a filter and a button are **the
same shape two pixels apart in height** — shape carries no information and the
two classes of control are distinguishable only by context. At radius 15 on a
30px control the pill is fully round: unmistakably a different *kind* of control
from the thing that performs an action.

"`design-system.md` specifies 15px" is the **weaker** half and is recorded as
corroboration, not the reason. A design system can be wrong, and a value
outvoted 21 sites to 3 in code is exactly where the justification must not rest
on authority. If the affordance argument ever stops holding — if action buttons
move to a round register too — revisit this on its own terms rather than
defending it by citation.

**Accepted cost:** 21 controls change shape noticeably; 3 already sit at 15px.
This is the largest purely visual change in the build.

## 1.5 States

All colour through `var(--sr-*)`, both themes. **No token is minted.**

| State | Border | Background | Text | Weight |
| --- | --- | --- | --- | --- |
| Rest | `--sr-border` | `--sr-surface` | `--sr-text-muted` | 500 |
| Hover | `--sr-border-medium` | `--sr-surface-subtle` | `--sr-text` | 500 |
| Active / positive | `--sr-accent-border` | `--sr-accent-bg` | `--sr-accent` | 600 |
| Negative (tri-state "no") | `--sr-error-overlay` | `--sr-error-bg` | `--sr-error` | 600 |
| Is Target | `--sr-is-target-border` | `--sr-is-target-bg` | `--sr-is-target-text` | 600 |
| Breeding tier N | `rgba(var(--sr-tier-N-rgb),0.5)` | `rgba(var(--sr-tier-N-rgb),0.15)` | `var(--sr-tier-N-fg)` | 600 |
| Disabled | `--sr-border` | `--sr-surface-subtle` | `--sr-text-disabled` | 500 |

The active state is the accent **tint**, never an accent **fill**. Both ship in
this app and the design system separates them: a solid accent slab on the map
canvas means a sighting pin, and the system requires a labelled action there to
take the tinted treatment so two labelled pills read as two weights.

**Two cascade rules that are easy to get wrong:**

- Hover is gated `:not(:disabled):not([aria-disabled="true"])` so an inert pill
  never lights up as operable. This is `.sr-toggle`'s rule — copy it.
- The `[aria-pressed="true"]` rule is declared **after** the `:hover` rule, so
  the selected state wins at equal specificity. This is the source-order
  convention `.sr-map-fab` and `.sr-hotspot-mode-pill` already follow.

### Contrast — measured, both themes

| Pair | Light | Dark |
| --- | --- | --- |
| rest `--sr-text-muted` on `--sr-surface` | 5.28:1 | 6.91:1 |
| hover `--sr-text-muted` on `--sr-surface-subtle` | 4.80:1 | 5.81:1 |
| active `--sr-accent` on `--sr-accent-bg` | 5.09:1 | 7.75:1 |
| negative `--sr-error` on `--sr-error-bg` | 4.82:1 | 7.07:1 |

All clear WCAG AA in both themes; hover at 4.80:1 is the tightest. Disabled
controls are WCAG-exempt and `--sr-text-disabled` is the correct token for them.
**The register introduces no new colour pairing** — every one already ships.

## 1.6 DECISION — the resting border stays `--sr-border`

**Decided by the user (option A).** It measures 1.27:1 light / 1.19:1 dark
against the surface, and that is deliberate and precedented: the control is
identified by its **label**, and its state by `aria-pressed` plus an AA-passing
text colour and a weight change — **no contrast requirement rests on the edge.**
Same reasoning `design-system.md` records for the sticky band's hairline.

The stricter reading of WCAG 1.4.11 (option B, `--sr-border-input` at 3.43:1)
was considered and **declined**: it would make 40 pills visibly heavier than the
buttons beside them, for a guarantee the label and `aria-pressed` already carry.
Do not re-derive this.

## 1.7 Focus

**No register-local focus rule for `.sr-pill`.** The global
`button:focus-visible` ring (3px `--sr-accent`, 3px offset, 6px halo) already
covers every pill; forking a shipped accessibility surface buys nothing.
`.sr-seg-btn` uses `outline-offset: -3px` so the ring stays inside the shell's
clip.

## 1.8 Motion

One transition, shared by both registers, matching the shipped
`.sr-hotspot-mode-pill` and `.sr-toggle` values rather than inventing a timing.

- **Pill / segment, rest ⇄ hover ⇄ pressed:** `ease-out`, `120ms`, no transform
  (so `transform-origin` does not apply), properties `background-color`,
  `border-color`, `color` only. Implemented in **CSS**, no library.
- **Reduced motion:** the **global** `prefers-reduced-motion` block already in
  `globals.css` collapses it to ~1µs; the end state is the resting state, so
  nothing is lost. **Add no per-component reduced-motion query** — the single
  global block is the house mechanism.

No entrance animation, no transform, no scale. These are utility controls that
toggle a filter; a state change is a colour change.

**Expect this to be felt:** 38 of 44 sites have *no* transition today and snap
instantly. All gain this fade. That is deliberate, not a side effect.

**Six sites carry an inline `transition` that must be removed**, not left
behind — an inline transition is specificity 1,0,0 and silently beats the class:
`ListComparer.tsx:186` and `:248` (`background 0.15s, color 0.15s`);
`SpeciesDetail.tsx:1152`, `:1164`, `:1394` (**`all 0.15s`** — the worst case, it
would animate layout properties too); `Settings.tsx:192`.

## 1.9 The two duplicated helpers

**`ghostBtn`** — `BreedingCodeList.tsx:90` and `LifeList.tsx:126`. The two
copies are **byte-identical**; there is no drift to resolve. It becomes the pill
register: 28px → 30px and 0.6875rem → 0.75rem.

**`sortBtn`** — `BreedingCodeTable.tsx:152` and `LifeListTable.tsx:208`.
**This is NOT a pill**: `border: none`, `padding: 0`, no height, no radius. It is
a chromeless in-`<th>` sort button. It is in scope as a de-duplication only and
takes **no pill geometry**. The two copies differ by exactly one line —
`LifeListTable`'s has `gap: 4` (because its headers render icon + label +
indicator; `BreedingCodeTable`'s render a bare code + indicator).

**Resolve to `gap: 4`.** It is correct where an icon exists and harmless where
it does not. **Accepted visible consequence:** it adds 4px between the code and
its sort caret on the Breeding Codes matrix headers.

## 1.10 Found while measuring — NOT designed in

**11 of 44 sites carry no `aria-pressed`.** Four sort-segment groups —
`SpeciesDetail.tsx:1577`, `MediaCommentsSection.tsx:89`,
`ChecklistComparer.tsx:299`, `ResultsView.tsx:59` — carry selected state as
style only, which is invisible to a screen reader, while the near-identical
`Checklists.tsx:69` control *does* carry it.

**Do not add it in this build.** It is an ARIA and behaviour change, and the
change brief holds behaviour, keyboard path and tab stops fixed. Recommend a
small follow-up build. Recorded here so it is not lost.

---

# PART TWO — The phone-tier type-scale repair

## 2.1 The two defects, and why they are one build

`globals.css` (inside `@media (max-width: 640px)`) currently has:

```css
.sr-input-16,
.sr-ctl-row :is(button, select, input) { font-size: max(16px, 0.75rem) !important; }
```

This exists as an **iOS focus-zoom guard**: iOS Safari zooms the viewport when a
form control under 16px receives focus, and 16px is an absolute px threshold
that does not scale. The guard is correct in intent and must be preserved.

It has two defects.

**Defect 1 — it is a replacement, not a floor.** It carries `!important` and
hardcodes `0.75rem` as if every control were 0.75rem. Any control declaring a
*larger* size is overridden in **both** directions:

| Control | Declared | At 200% today | Should be | Loss |
| --- | --- | --- | --- | --- |
| `CommandPalette` search (`.sr-palette-input`, `1rem`) | 32px | **24px** | 32px | **−8px** |
| `App.tsx:1015` checklist input (`0.875rem`) | 28px | **24px** | 28px | −4px |
| `SpeciesDetail.tsx:748` combobox `md` (`0.875rem`) | 28px | **24px** | 28px | −4px |
| `WeatherForecastPanel` inputs ×5 (`0.84375rem`) | 27px | **24px** | 27px | −3px |
| `MapExplorer` selects / combobox (`0.8125rem`) | 26px | **24px** | 26px | −2px |
| `Checklists.tsx:189` search (`0.8125rem`) | 26px | **24px** | 26px | −2px |
| Calendar `SegControl` (`0.71875rem`) | 23px | **24px** | 23px | +1px (raised) |

**This penalises exactly the users who asked for larger text** — it is the same
inversion `filterControlSizeCss.test.ts` was written to prevent, surviving in a
form that guard does not check. At 100% nothing is wrong; the entire defect is
at large text scale.

**Defect 2 — labels were left out of the floor.** Labels were deliberately
excluded (a `<span>` cannot trigger focus zoom, so the exclusion looked free).
But the label keeps its unfloored `rem` while its control jumps to a px floor,
so the intended optical offset becomes a size gap:

| Text scale | Control | Label today | Label as % of control |
| --- | --- | --- | --- |
| 0.75× (lowered browser default) | 16px | 8.25px | **51.6%** |
| 1.00× | 16px | 11px | **68.8%** |
| 1.25× | 16px | 13.75px | 85.9% |
| ≥1.333× | tracks rem | tracks rem | correct |

Intended is ~91.7%. **The divergence is worst below 100%**, at a browser default
the user has lowered — a case the original report did not reach. State the
guarantee as a property of the formula over the whole input domain, never at
sampled scales (`.claude/rules/ui.md`, v0.5.81).

**They are one build because the label floor derives from the control floor.**
Fixing labels against the broken clamp would bake the clamp's wrong numbers into
the label relationship. Fix the foundation, then derive.

> **DECISION — do all of it in this build, not a split.** A split (ctl-row
> labels now, `.sr-input-16` labels later) was proposed by the design pass and
> argued for by the coordinator on the grounds of bundle risk — four builds
> stacked on one branch under one sign-off. **The user rejected it**: they are
> not in a rush, they want the app fixed correctly, and leaving 11 labels wrong
> *because their foundation is wrong* preserves the defect rather than fixing
> it. The coordinator recorded that their own argument was weighting a schedule
> concern that the user had removed. Recorded on the reasoning, not as a
> preference.

## 2.2 Measured scope

| Measure | Count |
| --- | --- |
| **Label elements repaired** | **22**, across 8 files |
| …inside a `.sr-ctl-row` | 11 (Calendar ×4, Checklists ×4, HotspotModeControl ×2, NamedBirdRangeControl ×1) |
| …paired with a standalone `.sr-input-16` control | 11 (MapExplorer ×5, WeatherForecastPanel ×5, App ×1) |
| **Controls needing an explicit register** | ~13 (see 2.4) |
| Distinct label/control pairings | 8 |

**The floor reaches controls by two routes** — `.sr-ctl-row` descendants *and*
the standalone `.sr-input-16` class, which floors controls on surfaces with no
ctl-row at all. Both produce both defects.

**`<label>` is not a form control.** `:is(button, select, input)` does not match
`<label>`, so the six semantic `<label>` elements in `App.tsx` and
`WeatherForecastPanel.tsx` are unfloored despite being the most label-like
things in the app. Do not assume the selector covers them.

### The boundary — why 22 labels and not 51

The label registers total **51+ sites app-wide**; only 22 sit beside a floored
control. The `0.6875 / 700 / uppercase` register has 24 sites, 10 of them
paired; its sibling `0.6875 / 600 / uppercase` register has 27 sites, **none**
paired.

**The defect is the *pairing*, not the register.** A label with no floored
control beside it is not broken — it renders exactly as designed. Flooring the
register globally would enlarge labels across ~24 files where nothing is wrong.
**Do not apply the label class to a label that has no floored control beside
it.**

## 2.3 The mechanism — four custom properties, two formulas

```css
:root {
  /* The iOS focus-zoom threshold. ABSOLUTE px: the zoom trigger is an absolute
     value and does not scale with --sr-text-scale. Every phone-tier floor in
     the app derives from this one number. */
  --sr-ctl-floor: 16px;
}

@media (max-width: 640px) {
  /* CONTROLS. --sr-ctl-rem is the control's OWN register; the default covers
     the majority. This is a genuine floor: it raises a small control to the
     iOS threshold and NEVER lowers a large one. */
  .sr-input-16,
  .sr-ctl-row :is(button, select, input) {
    font-size: max(var(--sr-ctl-floor), var(--sr-ctl-rem, 0.75rem)) !important;
  }

  /* LABELS beside a floored control. NOT an iOS guard — a <span> cannot
     trigger focus zoom. This exists ONLY to preserve the type relationship the
     control floor would otherwise break. --sr-label-ratio takes ONE of TWO
     values, and only one of them is ever declared (see 2.4):
       var(--sr-label-optical)  an UPPERCASE label — capitals fill the cap
                                height and read larger at equal metric size
       (unset -> 1)             a sentence-case label, which needs no
                                optical compensation and matches its control
     BOTH terms carry the factor, so a label is always the same proportion of
     the control beside it at every text scale — not merely closing today's gap. */
  .sr-ctl-label {
    font-size: max(calc(var(--sr-ctl-floor)        * var(--sr-label-ratio, 1)),
                   calc(var(--sr-ctl-rem, 0.75rem) * var(--sr-label-ratio, 1))) !important;
  }
}
```

`--sr-ctl-rem` **cascades**: set it on the block (the `.sr-ctl-row` or field
wrapper) and both the controls and the label read it. Override it on an
individual control where one control in a block differs from its siblings.

### Why the derivation holds at every scale

Scaling **both** terms by the same factor makes the label/control ratio exactly
constant across the entire scale domain — verified numerically from 0.5× to 3×,
including below 1× where today's gap is worst. *Which* factor to use is decided
in 2.4: one declared number, two uses.

**THE INVARIANT — the property that prevents this whole defect class:**

> **A label always crosses from floor-governed to scale-governed at exactly the
> same text scale as the control it sits beside.**

The crossover happens when a register's `rem` term overtakes its floor. For a
control that is at `--sr-ctl-floor / --sr-ctl-rem`; for its label, both terms
carry the same `--sr-label-ratio` factor, so it cancels and the crossover is
**identical**. There is never a band where one is pinned to a floor while its
neighbour tracks `rem` — which is precisely the mechanism that produced this
defect.

Note this crossover is **per pairing, not global**: it depends on the control's
register, so it ranges from 1.143× (the `0.875rem` controls) to 1.391×
(Calendar's `0.71875rem` SegControl). An earlier draft of this spec claimed a
single global 1.333× crossover — **that was wrong**, and it was wrong because it
computed every ratio against `0.75rem` instead of against each control's own
register. Independently chosen constants would not have this property at all,
and nothing would detect its loss.

### A superseded argument, recorded so it is not revived

An earlier version of this spec argued **here** that a single constant could not
work: the measurement found eight distinct pairings across four label sizes and
six control sizes, so any fixed set of constants would be "the wrong count on
day one."

**That argument was wrong and is withdrawn.** It treated the eight inherited
ratios as facts to be preserved, when they are **drift** — nobody chose 0.8462.
The correct move is the one this build already makes for pill heights and radii:
collapse the drift to one chosen value that has a reason. See 2.4 for the three
options that were measured, and for why preserving the eight ratios is
disqualified by a **defect** (one label register rendering at two sizes inside a
single Map Explorer sidebar) rather than by preference.

## 2.4 The complete per-site table

`--sr-label-ratio` = label register ÷ **its own control's** register.

**A label's rendered size is its control's rendered size times ONE declared
factor**, chosen by whether the label is uppercase:

```css
:root {
  /* Uppercase optical compensation. Capitals fill the cap height and read
     larger than lowercase at the same metric size — this is the ONLY reason
     a label is ever set smaller than its control, and it is why the desktop
     register carries a 1px offset. Sentence-case labels need no compensation
     and take the default of 1 by simply not declaring a ratio. */
  --sr-label-optical: calc(11 / 12);   /* 0.9167 */
}
```

| # | Pairing | Label | Case | Its control | Factor | @100% | @200% | n |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Calendar `ctrlLabelStyle` | 0.6875 | UPPER | 0.71875 | optical | 14.67 | 21.08 | 4 |
| 2 | Checklists `rowLabelStyle` | 0.71875 | sentence | 0.75 | 1 | 16.00 | 24.00 | 4 |
| 3 | HotspotModeControl `SidebarLabel` | 0.6875 | UPPER | 0.75 | optical | 14.67 | 22.00 | 1 |
| 3b | HotspotModeControl "Time window" | 0.6875 | sentence | 0.75 | 1 | 16.00 | 24.00 | 1 |
| 4 | MapExplorer `SidebarLabel` over selects | 0.6875 | UPPER | 0.8125 | optical | 14.67 | 23.83 | 3 |
| 5 | MapExplorer `SidebarLabel` over dates | 0.6875 | UPPER | 0.75 | optical | 14.67 | 22.00 | 2 |
| 6 | WeatherForecastPanel `fieldLabel` | 0.75 | sentence | 0.84375 | 1 | 16.00 | 27.00 | 5 |
| 7 | NamedBirdRangeControl `rangeLabel` | 0.75 | sentence | 0.75 | 1 | 16.00 | 24.00 | 1 |
| 8 | App checklist `<label>` | 0.875 | sentence | 0.875 | 1 | 16.00 | 28.00 | 1 |
| | | | | | | | **total** | **22** |

**No label ever exceeds its control** under this model, at any scale — verified
across 0.5× to 3×.

### Why one factor and not eight — the decision, with its numbers

An earlier version of this spec preserved each pairing's **inherited** ratio
(0.8462, 0.8889, 0.9167, 0.9565, 0.9583, 1.0 …). **That was wrong and is
rejected.** Three options were measured:

| | A — inherited ratios | B — one factor everywhere | C — one factor, two uses |
| --- | --- | --- | --- |
| Each pair scales together | yes | yes | yes |
| Ratio constant across the app | **no — 84.6% to 100%** | yes — 91.7% | yes — 91.7% / 100% by case |
| Same register, one size @100% | **no — 13.54 / 14.67 / 15.30** | yes — 14.67 | yes |
| Same register, one size @200% | yes — 22px | no — tracks its control | no — tracks its control |
| Numbers to maintain | **8** | 1 | **1** |

**A is disqualified by a defect, not a preference.** Map Explorer's sidebar
renders the *same* `SidebarLabel` register over a `0.8125rem` select and over a
`0.75rem` date input **in one panel**. Under A those render at **13.54px and
14.67px side by side** — one register, two sizes, in a single sidebar. Under B
and C both are 14.67px.

**C is preferred over B** because B applies an uppercase-derived correction to
sentence-case labels that do not need it, shrinking them 8.3% for no reason. C
keeps exactly one declared number and gives each of its two uses a reason.

**The trade-off, stated plainly:** you can have a constant *ratio* or a constant
*label size*, not both — because the control registers vary six ways and those
are **designed, not drift** (`design-system.md` names the species picker's
`md` / `panel` / `sm` registers, and the command palette's `1rem` is a
deliberate hero input, so collapsing them is out of scope and probably wrong).
A label either keeps its own size and lets the ratio vary, or tracks its control
and lets its size vary. **The requirement is that a heading and its control grow
and shrink together — that is a statement about the pair, so the ratio is what
must be constant.**

### Open scope question — the unpaired labels

Under C, a section label **beside a floored control** renders 14.67px on a
phone, while the **same register** on a surface with no floored control stays at
11px. That is roughly **46 label sites across ~24 files** left at the old size,
and it means one visual register renders at two sizes app-wide.

**Recommendation: give the section-label register a phone floor everywhere** —
a flat `max(var(--sr-ctl-floor) * var(--sr-label-optical), 0.6875rem)`, with no
control to relate to. A build that unifies every control and then splits a label
register in two is not finished by this build's own standard.

**Cost, stated:** ~46 label sites get visibly larger on phones, across files this
build otherwise never touches; and it would be **the app's first non-control
phone-tier font floor** (today only two phone-tier `font-size` rules exist, both
on controls). **Not taken unilaterally — this needs a decision.**

### Controls needing an explicit `--sr-ctl-rem`

Every control matched by the rule whose register is **not** `0.75rem`. Set it
alongside the existing inline `fontSize` (React accepts a custom property in a
`style` object; it needs a TS cast).

| Control | Register to declare |
| --- | --- |
| `CommandPalette.tsx:295` `.sr-palette-input` (CSS, `globals.css:5735`) | `1rem` |
| `App.tsx:1015` checklist input | `0.875rem` |
| `SpeciesDetail.tsx:748` `SpeciesCombobox` size `md` | `0.875rem` |
| `WeatherForecastPanel.tsx:522,537,541,545,549` | `0.84375rem` |
| `WeatherStatsSection.tsx:460` combobox `panel` | `0.8125rem` |
| `MapExplorer.tsx:2059` combobox `panel` | `0.8125rem` |
| `MapExplorer.tsx:2076,2100` selects (`SELECT_STYLE`, `lib/mapExplorerFormat.ts:26`) | `0.8125rem` |
| `Checklists.tsx:189` search input | `0.8125rem` |
| Calendar `SegControl` / "All years" / "Count all forms" | `0.71875rem` |

**Everything else takes the `0.75rem` default and needs no change.**

**A drift risk to guard:** the inline `fontSize` and `--sr-ctl-rem` are two
declarations of one fact. A source-scan test should assert that any control
carrying `sr-input-16` with an inline `fontSize` declares a matching
`--sr-ctl-rem` (see 2.6). The cleaner long-term shape — the control declaring
*only* `--sr-ctl-rem` and a shared rule supplying `font-size` at all widths,
removing the need for `!important` entirely — is **noted and not taken here**:
it would rewrite ~25 components' inline styles and is a refactor, not a repair.

## 2.5 Required companion layout change

`Checklists.tsx` `rowLabelStyle` (around line 300) declares **`width: 72`** (px)
with `flexShrink: 0`. Raising its text from 11.5px to 15.33px means
"Where & when" and "Media type" no longer fit the box.

**Fix:** `width: auto` with `min-width: 72px`, in the ≤640 tier, **scoped to the
feature's own subtree** — not by widening a shared rule.
(`.claude/rules/ui.md`, v0.5.82: a phone-tier size guard that makes a row stop
fitting needs a companion layout rule, and the guard is the requirement while
the layout is what yields.) Note it is **already marginal today at 200%**, where
23px text sits in that same 72px box.

## 2.6 Guards — exactly what changes and why

### `lib/filterControlSizeCss.test.ts` — the primary guard

It collects every rule whose selector is exactly `.sr-input-16` **or whose
leading compound is `.sr-ctl-row`**, then asserts eight things.

**That collector rule decides the label class's name.** Written
`.sr-ctl-row .sr-ctl-label { … }` the label rule is swept into the *control* set
and four assertions go red. Written **`.sr-ctl-label`** as a standalone class it
is invisible to the collector — which is why the class is standalone, and why a
**new** assertion must be added or nothing guards it at all.

| Assertion | Effect | Action |
| --- | --- | --- |
| both subjects present | passes | — |
| all collected rules share ONE identical value | passes (label rule not collected) | — |
| value matches `/^max\(\s*16px\s*,/` | **RED** — becomes `max(var(--sr-ctl-floor), …)` | **Amend**: resolve `--sr-ctl-floor` from `:root` first, then assert the first term is `16px`. Keep the assertion's intent — the hard iOS floor must still be provably 16px. |
| value contains a `rem` term | passes (`0.75rem` survives as the `var()` fallback) | — |
| carries `!important` | passes | — |
| lives inside the ≤640 tier | passes | — |
| `.sr-ctl-row` sizes descendants, not the container | passes | — |
| rightmost compound names `button`+`select`+`input` | passes | — |
| MapExplorer has exactly 8 native `sr-input-16` + 1 combobox | passes — no control is added or removed | — |

**New assertions to add:**
1. `.sr-ctl-label` exists, is phone-tier only, carries `!important`, and its
   value is `max()` of two `calc()` terms both multiplied by
   `var(--sr-label-ratio, …)` — i.e. the **derivation**, not a literal.
2. **The invariant (2.3):** for each pairing, label floor ÷ control floor equals
   label rem ÷ control rem. Compute it; do not restate literals.
3. Every control carrying `sr-input-16` with an inline `fontSize` declares a
   matching `--sr-ctl-rem` (the 2.4 drift risk).

### `components/MapExplorerInputZoom.test.tsx`

Asserts each of 9 Map Explorer controls is an `<input>`/`<select>` **and**
carries `sr-input-16`, and that the manual-target checkboxes do **not**.
**Nothing here breaks** — adding a custom property changes neither tag nor
class. **Extend it**: the four controls whose register is `0.8125rem`
(`:2059, :2076, :2100`) must also declare `--sr-ctl-rem`, or the clamp repair
silently does not reach them and this test would not notice.

### `components/MapExplorerSpeciesFilter.test.tsx:162`

Asserts the combobox is an `<input>` with `sr-input-16` and inline
`height: 34px`, `fontSize: '0.8125rem'`, `borderRadius: '6px'`.
**Nothing here breaks** — the `fontSize` assertion still passes.
**Extend it**: assert `--sr-ctl-rem` is present and equals the asserted
`fontSize`, so the two cannot drift.

### Others

- `lib/breedingCodeFilterRowCss.test.ts` — unaffected (BreedingCodeList has no
  label inside its ctl-row). It forbids `.sr-ctl-row`-selected rules from
  carrying `min-width`/`max-width`/`overflow-wrap`/`word-break`/`white-space` —
  **`font-size` is not in that list**, so the label rule is clear. But note the
  Checklists companion fix (2.5) adds a `min-width`, so **scope it to the
  Checklists subtree, not to `.sr-ctl-row`**, or that guard goes red.
- `lib/subspeciesExplorerCss.test.ts` — its premise comment cites the 24px
  figure from `max(16px, 0.75rem)` at 200%. `.sr-ssx-toggle` is `0.75rem`, so
  the number is unchanged; **update the comment's derivation** to reference
  `--sr-ctl-rem`.
- `lib/namedBirdTimelineCss.test.ts` — requires every `.sr-nbt-*` text element
  to carry a `rem` font-size. `NamedBirdRangeControl`'s row is
  `.sr-nbt-ctlrow`; the label class is `.sr-ctl-label`, so there is no
  collision. Do not name the label class `.sr-nbt-*`.
- **Tailwind v4 caution** (recorded in `filterControlSizeCss.test.ts` itself):
  Tailwind's auto source detection scans test files and treats bare words in
  comments as class candidates, and an earlier comment there grew the shipped
  CSS by 219 bytes. Verify with a byte-compare of `dist` CSS against HEAD.

## 2.7 Class, not element selector — a trap

The label rule **must not** use a bare descendant selector such as
`.sr-ctl-row :is(span, label)`. `.sr-bc-filter-pill-label` is a `<span>` inside
a pill inside a `.sr-ctl-row`; an element-based rule would size it and **shrink
the pill's own text**. Four text nodes are already correctly floored *by
inheritance* from a `<button>` ancestor and must stay that way:
`ToggleSwitch`'s label span, Calendar `Switch`'s label span (line 178 —
`filterControlSizeCss.test.ts` explicitly pins the size to the button, not the
span), `.sr-ssx-count` (`globals.css:5169`, intentional), and
`.sr-bc-filter-pill-label`.

`.sr-ctl-label` is an **explicit opt-in class on the label element** — exactly
as `.sr-input-16` is an explicit opt-in on a control. Membership is declared,
never inferred.

## 2.8 Replacement wording for the two rule files

This build **reverses a documented decision**, so both files must be amended in
the same change. A rule file left describing the old behaviour is worse than no
rule. The file edits belong to the Engineer and the Chronicler; the wording is
specified here.

> **Stamp the shipped version.** Both passages below say *"this change"* where a
> version citation belongs. This bundle takes **one** version bump at the very
> end and that number is not knowable at design time, so it is deliberately not
> guessed here — substitute the real shipped version when the rule files are
> edited.

### `.claude/rules/ui.md` — replacing the `.sr-ctl-row` label-exclusion clause

> `.sr-ctl-row` is a CONTAINER hook, not an element one: it sizes interactive
> DESCENDANTS, never the container itself (which would cascade an unrequested
> size onto every unstyled span inside it). **It does not reach labels, and as
> of this change that is no longer the same thing as labels being excluded.**
> The exclusion was right when written: the 16px floor is an iOS focus-zoom
> guard, a `<span>` cannot trigger focus zoom, and flooring labels looked like
> cost with no benefit. What it missed is that the floor moves the CONTROL, so
> excluding the label does not leave the pair alone — it breaks the type
> relationship between them. Measured: a `0.6875rem` label beside a floored
> control renders at **68.8%** of it at 100% text scale and **51.6%** at a
> lowered browser default, against an intended ~91.7%, converging only above
> ~1.33×. A label that sits beside a floored control therefore takes
> **`.sr-ctl-label`** with a `--sr-label-ratio` (its register ÷ its control's
> register), which floors BOTH terms by the same factor and so holds the offset
> at every scale. **A label with no floored control beside it takes neither and
> is not broken** — the defect is the pairing, not the register. The floor
> itself is `max(var(--sr-ctl-floor), var(--sr-ctl-rem, 0.75rem))`: a genuine
> floor that raises a small control to the iOS threshold and never lowers a
> large one, which the previous hardcoded `max(16px, 0.75rem)` did — it cut the
> command palette's `1rem` input from 32px to 24px at 200% text scale, for
> exactly the users who had asked for larger text.

### `pipeline/design-system.md` — replacing the Filters-pattern clause

> **On a phone every interactive control in a filter block reads at ONE size** —
> put `.sr-ctl-row` on the block and its buttons, selects and inputs share the
> iOS-safe scale-tracking size. **Its labels are sized in relation to it, not
> left behind** (this change): a label beside a floored control carries
> `.sr-ctl-label` and a `--sr-label-ratio` of its own register to its control's,
> so the deliberate 1px optical offset survives the floor instead of becoming a
> 45% size gap at 100% and worse below it. The uppercase section labels stay
> deliberately smaller **in proportion**, which is what the earlier "stay
> outside it by design" wording was trying to protect and did not. A trailing
> count-and-view cluster is still outside it, because it is not a filter. A
> label on a surface with no floored control is unchanged.

---

## 3. What the user will notice

**Desktop: nothing at all**, from any part of this build.

**Phone, from the pill work:** filter pills get taller (24–28px → 30px, and
32–36px controls shrink to 30px) and rounder (radius 6 → 15). A filter row that
fitted on one line may take two. Every pill gains a 120ms state fade.

**Phone, from the label work:** section labels beside filter controls get
noticeably larger at normal text size — e.g. 11px → 14.67px. Below 100% the
change is larger still.

**At 200%, the pair does change — an earlier version of this document said it
did not, and that was wrong.** The claim was true of the label work *in
isolation* and false of the label-and-control pair, because the clamp repair
moves the control. Measured, with the label left untreated:

| Pairing | Label / control today | After clamp repair | Effect |
| --- | --- | --- | --- |
| Map Explorer over selects | 22 / 24 = 91.7% | 22 / **26** = 84.6% | **widens** |
| Weather forecast fields | 24 / 24 = 100% | 24 / **27** = 88.9% | **widens** |
| App checklist input | 28 / 24 = **116.7%** | 28 / 28 = 100% | corrected |
| Calendar control strip | 22 / 24 = 91.7% | 22 / **23** = 95.7% | narrows |
| The other four pairings | — | — | unchanged |

So the clamp repair, on its own, would make the mismatch *more* visible on two
surfaces — which is precisely why the label treatment is not optional and why
both halves ship together. Note also that today the App label renders **larger
than its own control** at 200% (28px against a clamped 24px); the repair ends
that.

**Phone at large text, from the clamp repair:** several controls get *bigger*
at 200% — the command palette search by 8px, App's checklist input and Species
Detail's combobox by 4px, the Weather forecast's five inputs by 3px, Map
Explorer's selects and Checklists' search by 2px. **One gets 1px smaller**:
Calendar's SegControl, which today is raised above its own declared size and is
returned to it. This is the accessibility half of the build and it is invisible
at 100%.

## 4. Deliberate deviations, logged

1. **Display face stays Inter / system-ui.** The Weft design doctrine asks for a
   distinctive non-Inter display face and `weft-design-lint` flags it.
   `design-system.md` wins on specifics; this refines shipped surfaces in a
   61-version-old product, and changing the typeface would be a product-wide
   rebrand smuggled in through a control-register pass. The mockup's own
   document chrome is set in a serif; only the *specimens* use the app's face,
   from a single shared declaration so it cannot drift.
2. **`min-height` replaces `height`** on the pill register — a strict
   relaxation, and it makes the Breeding Codes `height: auto !important`
   override redundant.
3. **A second register (`.sr-seg-btn`) is introduced.** `design-system.md`
   describes filter pills and `SegControl` but has no entry for a hand-rolled
   segmented group. Add one at closeout.
4. **`padding: 0 12px` and `gap: 5px`** are not stated in the design system;
   both are the family's own modal values rather than fresh choices.
5. **The label floor is not an iOS guard** and must not be described as one. A
   `<span>` cannot trigger focus zoom. It exists solely to preserve a type
   relationship. Say so at the declaration or it will be "cleaned up" later.
