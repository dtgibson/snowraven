# Decisions — Control Style Registers

## Stage 1 (2026-09-22 re-validation)

An earlier session scoped and designed this build on 2026-09-15 and never built
it. Its three artifacts were committed in `51a2c71` with no `DECISIONS.md`,
`ROADMAP.md` or handoff record. This stage re-measured every load-bearing figure
at HEAD (branch `weft-spool/20260922-052116`, 26 commits on from `51a2c71`,
spanning releases 1.0.30 → 1.0.32) rather than re-deriving the scope.

**Verdict: the scoping and the design both stand.** Three rows are corrected;
none needs a redesign. The original `change-brief.md` is deliberately left
**byte-identical** — it is the record of what was decided on 2026-09-15, and
rewriting it would destroy the evidence that these three rows moved. The
corrections live in `change-brief-revalidation.md`.

### Re-measurement table

| Measure | Design (2026-09-15) | At HEAD (2026-09-22) | Verdict |
| --- | --- | --- | --- |
| `globals.css` commits since design | — | **0** | every CSS line number in the design is **exact** |
| the clamp | `~4441`, `~4466` | comment `4441`; rule `4465`–`4466`, verbatim `font-size: max(16px, 0.75rem) !important` | unchanged |
| `.sr-seg-btn` rule | `4718` | `.sr-seg > .sr-seg-btn` at `4718` | unchanged |
| `.sr-hotspot-mode-pill` (the faithful instance) | cited | `649`–`674`, with `[aria-pressed="true"]` (`669`) after `:hover` (`665`) | unchanged; §1.5's source-order convention confirmed |
| `ghostBtn` | 2 copies, byte-identical | `BreedingCodeList.tsx:90`, `LifeList.tsx:126` — still byte-identical | unchanged |
| `sortBtn` | 2 copies, differ by `gap: 4` | `BreedingCodeTable.tsx:152` (none), `LifeListTable.tsx:208` (`gap: 4`) | unchanged; drift still exactly one line |
| `ghostBtn`/`sortBtn` file count | 4 | 4 | unchanged |
| `sr-btn-*` consumers | 18 call sites, all `Settings.tsx` | 18 call sites, all `Settings.tsx` | unchanged, through 140 lines of churn in that file |
| inline-styled control census | 181 of 253 | 179 of 286 (my script; see note) | **delta exactly 0** — identical at `51a2c71` and HEAD |
| pill-family signatures | ~44 sites, 15 files | `overflow:'hidden'` 102 · `border:'none'` 83 · `'var(--sr-accent-bg)' : 'transparent'` 17 | identical at both commits |
| the 22 labels | 4+4+2+1+5+5+1 | Calendar 4 · Checklists 4 · HotspotModeControl 2 · NamedBirdRangeControl 1 · MapExplorer 5 · WeatherForecastPanel 5 · App 1 = **22** | unchanged |
| `Checklists` `rowLabelStyle` | `width: 72`, `flexShrink: 0` | `:300`–`302`, verbatim | unchanged; the §2.5 companion fix still applies |
| `WeatherForecastPanel` registers | control `0.84375rem`, label `0.75rem` | `textInput` `:78` = `0.84375rem`; `fieldLabel` `:75` = `0.75rem` | unchanged (pairing 6 holds) |
| guard: the one red assertion | `/^max\(\s*16px\s*,/` | `filterControlSizeCss.test.ts:246`, verbatim | unchanged |
| guard: `.sr-ctl-row` forbidden properties | `min-width` forbidden | `breedingCodeFilterRowCss.test.ts:93`–`94` | unchanged; the Checklists fix still must be subtree-scoped |
| guard: Map Explorer control count | 8 native + 1 combobox | `filterControlSizeCss.test.ts:395` "the nine Map Explorer controls" | unchanged |
| guard: Calendar switch span pin | cited (§2.7) | `filterControlSizeCss.test.ts:455` | unchanged |
| all six named guard files | 6 | all 6 present | unchanged |
| ROADMAP Up Next item 3 | the roadmap home | `ROADMAP.md:25`, no diff since `51a2c71` | unchanged |

**Census note, stated rather than glossed.** I could not reproduce the design's
absolute denominator (253) from its description, so I wrote my own JSX
opening-tag census (brace- and string-aware, `.tsx` only, tests excluded) and
ran the *same script* at both commits. Four tag-set variants
(`Button,button,Link,a` · `Button,button,Link` · `+select` · `Button,button,select`)
all give byte-identical totals and styled counts at `51a2c71` and HEAD. The
absolute figure is mine and differs from theirs; the **delta is zero** on every
variant, which is the claim the re-validation actually needs.

### Files that moved (6 of 21 checked), and why none invalidates the design

| File | Commit | What it did |
| --- | --- | --- |
| `SpeciesDetail.tsx`, `MediaCommentsSection.tsx`, `ChecklistComparer.tsx`, `ResultsView.tsx` | `4b7ddfc` sort-controls-selected-state (v1.0.32) | attributes only — `role="group"`, `aria-label`, `aria-pressed`. No style byte changed. |
| `Settings.tsx` | `4635b22` settings-section-order (v1.0.32) | pure block move; the removed and re-added lines are identical. `toggleBtnStyle` still at `:192`, its transition at `:205`. |
| `WeatherForecastPanel.tsx` | `45e98bf` tide-at-bad-request (v1.0.32) | `nowInTz` extracted to `lib/wallClock.ts`. The five `sr-input-16` inputs shifted `522/537/541/545/549` → `519/534/538/542/546`; registers unchanged. |

### Correction 1 — design §1.10 is superseded by a shipped follow-up
The design deferred `aria-pressed` on 11 of 44 sites and recommended a small
follow-up build. **That build shipped** (`4b7ddfc`, v1.0.32). The count is now
**7 of 44**. Three consequences, all of which make this build easier: §1.5's
`[aria-pressed="true"]`-after-`:hover` cascade now engages on those four, so the
register can carry their selected state through the attribute rather than the
inline `style` prop; the four shells now carry `role="group"` +
`aria-label="Sort order"` that the register pass **must not strip**; and
`components/sortControlsSelectedState.test.tsx` (272 lines) must stay green.
§1.10's recommendation is **not** re-raised at closeout.

### Correction 2 — a closeout obligation is already discharged
`change-brief.md`'s final Decisions row ("`PRODUCT_CONTEXT.md:1730` still carries
the superseded v1.0.19 decline text") was **true when written** — verified
verbatim at `git show 51a2c71:PRODUCT_CONTEXT.md`, line 1730 — and was fixed by
the v1.0.32 context update. The entry now reads "DECLINED TWICE, THEN BUILT
(v1.0.24) … kept only to record the reversal". **Do not action this row.** An
Engineer acting on it would edit a record that is now correct.

### Correction 3 — §1.8's inline-transition list was loose when written
The design names six sites; there are **five**. `SpeciesDetail.tsx` carries
exactly two `all 0.15s` (`:1157`, `:1425`) at HEAD **and at `51a2c71`** — so
this is an authoring imprecision, not drift. Its other two `transition`s are
`transform 0.15s` chevron rotations on disclosure buttons (`:1387`, `:1679`),
not pill chrome; my reading is out of scope, and the Engineer states the call.
The five: `ListComparer.tsx:194`, `:259`; `SpeciesDetail.tsx:1157`, `:1425`;
`Settings.tsx:205`. Sweep by `grep -n transition`, never by the design's line
numbers. **Convention worth knowing**: the design cites the *site* (the
`<Button` tag, or the style-object declaration), not the property line — which
is why `ListComparer:186`/`:248` and `Settings:192` are correct as written and
only look like drift.

### Rule `paths` — two extensions owed in this same change
`.claude/rules/ui.md`'s frontmatter gates on `frontend/src/components/**`,
`frontend/src/globals.css`, `frontend/index.html` and six `frontend/src/lib/*`
globs. Two files this build edits fall outside every glob:
`frontend/src/App.tsx` (control `:1015`, label `:997`) and
`frontend/src/lib/mapExplorerFormat.ts` (`SELECT_STYLE` `:26`, behind
`MapExplorer.tsx:2076` and `:2100`). Both are added, per CLAUDE.md's v1.0.32
obligation that a rule gated off the file it governs is indistinguishable from
an absent rule.

**And the design's §2.8 targets need widening.** Only `design-system.md:156`
carries "spans and stay outside it by design". `ui.md` owes three passages:
`:41` (the `.sr-ctl-row` parenthetical), `:42`, and `:73`. **`:42` is the one
actually false at HEAD** — it quotes `max(16px, 0.75rem)` verbatim and states
the v0.5.82 vertical-fit corollary ("never TIGHTENS a box whose inline size is
already that rem … above that it returns the rem") as a guarantee. That holds
for a formula carrying each control's *own* rem and fails for the shipped rule's
hardcoded `0.75rem` — Defect 1 recorded as a promise. The design supplies no
replacement for `:42` or `:73`; the Designer does, at Stage 2.

### Scope check against the saved idea
The idea says "most buttons and links". In this build that resolves to the pill
family and the phone-tier floor, **not** to most control sites, and that reading
is the ROADMAP item's own framing ("without broadening the primitives or
coupling the accessibility seam to a visual redesign") and the v1.0.24 decision's.
**In:** ~44 pill/segmented sites across 15 files; `ghostBtn` and `sortBtn`; ~13
controls gaining `--sr-ctl-rem`; 22 labels gaining `.sr-ctl-label`.
**Out:** the `Button`/`Link` primitives, which gain no visual ownership; the
other ~141 inline-styled sites; the 7 hand-rolled switch tracks; the 15
icon-only map controls; the remaining 7 sites without `aria-pressed`; and
`sr-btn-*`, which keeps its single consumer file. Say "most" is not literal at
the sign-off rather than letting the idea's wording set the expectation.

### Design-pass decision
**Needed; satisfied by the existing `design-refinement.md` and `design.html`
from 2026-09-15, re-validated at HEAD by The Designer as a scoped pass.** The
lane runs **7 stages**, Stage 2 being a re-validation errand rather than a
redesign. The Designer's three errands: fold correction 1 into §1.10 and §1.5;
correct §1.8's site list; and write replacement wording for `ui.md:42` and
`:73`. The visual decisions (radius 15px on the affordance argument, the resting
border at `--sr-border`, one declared `--sr-label-optical` factor with two uses)
are **not re-litigated**.

### Standing constraints carried into this build
No version bump here — one bump at the bundle flush, changelog line in
`pr-description.md`. `docs/HELP.md`, `README.md` and `website/` are not touched
and the approval gate is not opened; no HELP sentence is owed, since nothing
behavioural changes. `ACCESSIBILITY.md:51`'s published claim that Text Size
"scales all text from 100% up to 200%" is **not fully true today** — the clamp
shrinks ~13 controls at 200% — and this build makes it true; no edit is
required, a sentence is the Chronicler's call. Per v1.0.29 the live look over
the tailnet before the deploy gate must cover the phone tier at 100% and 200%,
the four segmented sort controls, the Breeding Codes filter row at 320px (with
`ACCESSIBILITY.md:87`'s no-horizontal-scroll claim), the Checklists filter row
at 200%, the Map Explorer sidebar, and the command palette search at 200%.

## Stage 2 (2026-09-22 re-validation)

A scoped pass over the 2026-09-15 design, not a redesign. The visual decisions
(two registers; radius 15px on the affordance argument; `min-height` 30px;
0.75rem type; the `--sr-border` resting border; the 120ms ease-out state fade;
the `--sr-ctl-rem` clamp repair; the four derived label floors with one declared
`--sr-label-optical` factor; the five logged deviations in §4, the Inter /
system-ui specimen face included) were **not re-litigated and did not change**.
`design-refinement.md` was edited in place with a dated note at the top listing
every change; `change-brief.md` stays byte-identical.

### What changed in the spec
1. **§1.10 superseded, §1.5 extended, per-site rows added** (Stage 1
   correction 1). `sort-controls-selected-state` (v1.0.32, `4b7ddfc`) put
   `role="group" aria-label="Sort order"` and a literal `aria-pressed` on the
   four sort-segment groups; the count is 7 of 44; the register's
   `[aria-pressed="true"]` rule is now the only carrier of their selected state,
   so the Engineer removes the inline `background` / `color` ternaries with the
   rest of the chrome and keeps no parallel `style` for the pressed state.
   `components/sortControlsSelectedState.test.tsx` reads no style and must stay
   green with every attribute intact.
2. **§1.8's transition list is five sites, cited by grep-able content**
   (correction 3), with the two `transform 0.15s` chevron rotations in
   `SpeciesDetail.tsx` named as not pill chrome. Two further `Settings.tsx`
   helpers carry `toggleBtnStyle`'s exact transition and shape and predate the
   design without being in its 44; whether they join the register is decided by
   §1.2's signature census and stated in the run record, not implied by grep.
3. **§2.4's five `WeatherForecastPanel.tsx` line numbers** refreshed
   (`45e98bf` shifted them by three) and marked find-by-class.
4. **§2.8 rewritten** with the replacement wording for `.claude/rules/ui.md:41`,
   `:42` and `:73` and `pipeline/design-system.md:156`, the `paths` extension
   (`frontend/src/App.tsx`, `frontend/src/lib/mapExplorerFormat.ts`), and a
   `design-system.md` entry for Register B; all in the house register, no em
   dash in any applied passage, properties rather than counts, `vX.Y.Z` where
   the bundle's single bump is stamped. The `PRODUCT_CONTEXT.md:1730` row in the
   original brief is recorded as discharged (correction 2) and is not an
   obligation.
5. **§2.6 corrected for Part 1:** `lib/breedingCodeFilterRowCss.test.ts`'s
   third assertion pins an inline `height: 30` in `BreedingCodeList.tsx` and
   forbids `minHeight: 30`; the pill register removes that inline height, so the
   assertion goes red and is amended to assert the pill carries `sr-pill` and the
   register supplies `min-height: 30px`. The 2026-09-15 "unaffected" was true of
   Part 3 only. The phone-tier `height: auto !important` and its assertion are
   retained: redundant with `min-height`, pinned, and not this build's errand.

### A finding the 2026-09-15 design did not have: Register B is renamed
The design named Register B `.sr-seg` / `.sr-seg-btn`. **Those are shipped
class names on `SegControl`** (`Calendar.tsx` renders `className="sr-wrap-flex
sr-seg"` and `className="sr-seg-btn"`) with a phone-tier rule at
`globals.css:4718` (`.sr-seg > .sr-seg-btn { flex: 1 1 auto; ... }`, v1.0.4).
Stage 1's re-measurement table listed that rule as "unchanged" without noting
that it means the name is taken. A register under those names would land on the
Calendar's control, which §1.3 puts out of scope, and would land partially
(inline `padding` / `fontSize` / `border` / `background` beating the class while
the `[aria-pressed]` and `:hover` rules did not), which is the v1.0.18
half-moved-chrome trap by another route. **Renamed to `.sr-segbar` /
`.sr-segbar-btn`**, a token that appears nowhere in `frontend/src` at HEAD, in
the spec and the mockup; every value is unchanged. Rejected alternative: keep
the name and scope the register with a parent selector; rejected because
`SegControl`'s existing rule already targets `.sr-seg > .sr-seg-btn`, so every
future rule on either register would have to be reasoned about against the
other, which is exactly the ambiguity a register exists to remove.

### v1.0.32's reversal condition, answered rather than triggered
`sort-controls-selected-state` decision 1 declined to extract a shared
`SortSeg` and named "any change that makes the five variants converge on one
shape" as what would reverse it. This register converges them, in CSS. That
discharges the drift concern extraction was meant to serve (one stylesheet
rule, not four copies) and §1.3 holds Register B to a CSS register with no
component or ARIA change, so extraction is **not** taken; the Engineer says so
in the run record so the v1.0.32 entry's condition reads as answered.

### Mockup re-validation
Driven with the repo's Playwright (`website/tools/node_modules/playwright`
1.62.1) from `file://`, never an OS browser: Chromium and WebKit, 1280px /
390px / 320px, light and dark, DSF 2. Zero console or page errors in all twelve
runs; both themes render (the accent backgrounds seen across every pressed
specimen are exactly the light and the dark token values); `.r15 .sr-pill`
computes radius 15px, min-height 30px, 12px type, 120ms transitions; every
pressed `.sr-segbar-btn` computes its panel's `--sr-accent-bg`, weight 600,
30px, 12px; rest segments are transparent at weight 500. One engine difference,
not a mockup defect: Chromium computes the family's 1.5px border as 1px (it
snaps border widths to whole CSS px), WebKit as 1.5px; the shipped app's
existing 1.5px borders behave the same way, and the shipped engines are WebKit.
**Two mockup-chrome fixes, no specimen value touched:** the page scrolled
sideways by 20px at a 320px viewport (the `.phone` frame was `width: 320px` and
the `.pair` grid items kept their automatic minimum); `.phone` is now
`width: 100%; max-width: 320px` and `.pair > * { min-width: 0 }`, measured
clean at 320 in both engines. `weft-design-lint`: one `warn`, the banned-font
finding at the single shared specimen declaration, which is deviation §4.1 and
stays.

### Mockup text changes
The Register B rename throughout; section 06 ("Only 6 of the 44" was five
declaration sites; the chip now reads "All but five"); section 09's finding row
now records the v1.0.32 follow-up and the 7 remaining sites.

## Stage 3 (2026-09-22, The Engineer)

All three parts built, plus the guards and the rule-file amendments. Full suite
green at 7,373 passing; typecheck, lint and `npm run build` clean; measured
against the BUILT stylesheet in Chromium and WebKit at 1280px, 390px and 320px,
both themes, 100% and 200% in-app text scale.

### The one contradiction in the artifacts, and how it was resolved

`change-brief.md` and `design-refinement.md` §3 both say **"Desktop: nothing
changes, from any part of this build."** That is true of Part 2 and Part 3 and
**false of Part 1**, and the same documents say so three times: §1.2 collapses
"7 heights, 6 radii, 4 font sizes" to one of each, §1.4 records the "accepted
cost: 21 controls change shape noticeably", and the brief calls the radius
change "the largest purely visual change in the build". A shared class register
applies at every width; the only way desktop could be byte-identical is to keep
every inline style, which is the build.

**Resolved in favour of the design decisions, not the summary line**, and
measured rather than asserted. The register is what the user approved (radius 15
on the affordance argument, `min-height` 30px, 0.75rem); the summary sentence is
a Part-2-and-3 claim that was over-generalised. The desktop table below is what
actually moves, and it is exactly §1.2's prediction. Parts 2 and 3 ARE
byte-identical on desktop and that is asserted below.

### Part 1, desktop (1280px, 100%): what the register changes

Read from the built stylesheet; identical in Chromium and WebKit except where
noted.

| Surface | Before (h / type / radius) | After | Moves |
| --- | --- | --- | --- |
| Multimedia filter pill (`pillStyle`) | 30 / 12px / 6 | 30 / 12px / 15 | radius |
| Pin + view toggle (`ghostBtn`, 2 files) | 28 / 11px / 6 | 30 / 12px / 15 | all three |
| Statistics interval + tier pills | 24 / 11px / 6 | 30 / 12px / 15 | all three |
| Checklists tri-state pill | 30 / 12px / 15 | 30 / 12px / 15 | **nothing** |
| Breeding Codes code + category pills | 30 / 12px / 6 | 30 / 12px / 15 | radius, gap 6 to 5 |
| Named Birds sort + range pills | 30 / 12px / 8 | 30 / 12px / 15 | radius |
| Checklists comment sort (segbar) | 32 / 12px | 30 / 12px | height |
| List Comparer + Species Detail sort | 34 / 13px | 30 / 12px | height, type |
| List Comparer mode | 36 / 13px | 30 / 12px | height, type |
| Multimedia age sort | 26 / 11px | 30 / 12px | height, type |

The segbar shell's radius goes 6/7/8 to 15 with it. One shipped site was already
exactly on register and does not move at all, which is the convergence argument
made visible.

**Phone geometry, measured:** at 390px/100% every pill reads 16px as before; the
`.sr-touch-target` sites still measure 44px (and 88px at 200%), so the register's
`min-height: 30px` does not weaken the touch posture. At 200% a pill measures
**38px (Chromium) / 39px (WebKit)** where it used to measure a fixed 30px: the
register's `min-height` lets 24px text size its own box instead of being clipped
by a fixed height. That is deviation §4.2 doing its job and is an improvement,
not drift.

### Part 2, measured against the spec's §2.4 prediction

Desktop 1280px/100%: **every control byte-identical, both engines.** The rule is
phone-tier only and the property is inert above 640px.

Phone 390px/200%, before to after:

| Control | Spec predicted | Measured | |
| --- | --- | --- | --- |
| Command palette search (`1rem`) | 24 to 32 | 24 to 32 | +8 |
| App checklist input (`0.875rem`) | 24 to 28 | 24 to 28 | +4 |
| Weather forecast inputs x5 (`0.84375rem`) | 24 to 27 | 24 to 27 | +3 |
| Map Explorer selects (`0.8125rem`) | 24 to 26 | 24 to 26 | +2 |
| Calendar SegControl (`0.71875rem`) | 24 to 23 | 24 to 23 | -1 |

At 390px/100% every one of them is 16px before and after: the entire repair is
at large text scale, as the spec says.

### Part 3, measured against §2.4's per-pairing table

Desktop 1280px/100%: **every label byte-identical, both engines.** (This sentence
was off by one declaration when first written and is now true as stated; the fix
was to move that declaration rather than to weaken the claim. See QA retry 1.)

| Pairing | @100% predicted / measured | @200% predicted / measured |
| --- | --- | --- |
| Calendar strip (UPPER, 0.71875) | 14.67 / 14.67 | 21.08 / 21.08 |
| Checklists rows (sentence, 0.75) | 16.00 / 16.00 | 24.00 / 24.00 |
| Hotspot mode (UPPER, 0.75) | 14.67 / 14.67 | 22.00 / 22.00 |
| Map Explorer over selects (UPPER, 0.8125) | 14.67 / 14.67 | 23.83 / 23.83 |
| Map Explorer over dates (UPPER, 0.75) | 14.67 / 14.67 | 22.00 / 22.00 |
| Weather forecast fields (sentence, 0.84375) | 16.00 / 16.00 | 27.00 / 27.00 |
| Named bird range (sentence, 0.75) | 16.00 / 16.00 | 24.00 / 24.00 |
| App checklist label (sentence, 0.875) | 16.00 / 16.00 | 28.00 / 28.00 |

Nine of nine rows land on the predicted value in both engines. The App pairing's
inversion is gone: it rendered a 28px label over a 24px control at 200% and now
renders 28 over 28.

### Contrast, both themes, every register state

Computed with the repo's own contrast arithmetic (`hotspotContrast`'s helpers,
re-run over the register's token pairs, tier tints alpha-composited over
`--sr-surface`). Every pairing clears WCAG AA for normal text.

| Pair | Light | Dark |
| --- | --- | --- |
| rest, `--sr-text-muted` on `--sr-surface` | 5.28 | 6.91 |
| hover, `--sr-text` on `--sr-surface-subtle` | 17.17 | 13.55 |
| pressed, `--sr-accent` on `--sr-accent-bg` | 5.09 | 7.75 |
| negative, `--sr-error` on `--sr-error-bg` | 4.82 | 7.07 |
| Is Target, `--sr-is-target-text` on `--sr-is-target-bg` | 4.88 | 8.30 |
| tier 1 pressed | 4.99 | 5.28 |
| tier 2 pressed | 5.67 | 5.94 |
| tier 3 pressed | 7.61 | 6.16 |
| tier 4 pressed | 12.76 | 7.40 |
| tier 1 tint with tier-2 text (the category cross-case) | 5.59 | 5.07 |

**One spec figure was wrong and is corrected here.** §1.5's contrast table calls
hover "the tightest at 4.80:1", computed as `--sr-text-muted` on
`--sr-surface-subtle`. The state table two rows above it, and `design.html`'s own
CSS, both put `--sr-text` on hover, which measures **17.17 / 13.55**. The
implementation follows the state table and the mockup. The real tightest pairing
is the negative leg at 4.82, which is a shipped pairing and unchanged.

### Decisions the spec left to the Engineer, with the census that settled them

**1. `Settings.tsx`'s three toggle helpers are NOT migrated, and keep their
inline transitions.** §1.8 asks for this to be decided by §1.2's signature census
and stated rather than implied. The census disqualifies all three, on four
independent counts: they render `role="radio"` with `aria-checked` through
`RadioGroup`, so the register's `[aria-pressed="true"]` carrier cannot show their
state at all; they are `flex: 1` items in a full-width row, not shrink-wrapped
pills; their rest fill is `--sr-surface-subtle` where the register's is
`--sr-surface`; and one of them is a `min-height: 48` two-line box. They are a
fourth shape, a segmented RADIO row, and adopting them would mean widening the
register to `[aria-checked]` and restyling a keyboard-managed ARIA surface, both
outside this build. Their `transition: background 0.12s, color 0.12s,
border-color 0.12s` therefore STAYS: §1.8's removal rule exists because a class
would otherwise be beaten by it, and with no class there is nothing to beat and
removing it would delete a shipped fade with no replacement.

**So the five-transition sweep is four removals in practice**, and `Settings.tsx`
is not one of the 15 Part 1 files. Its `sr-btn-*` consumers are untouched.

**2. `SpeciesDetail.tsx`'s Graph Options and Map display mode groups are NOT
register sites; their `transition: all 0.15s` is removed anyway.** §1.3's own
structural test is what decides this: a Register B site declares `border: none`
AND takes its edge from a wrapping `overflow: hidden` shell with dividers. These
two have no shell border, no clip and no dividers; they are a `--sr-surface-subtle`
tray with a raised active option carrying a `box-shadow`, which is the shipped
`SegControl` register that `design-system.md` describes and §1.3 puts out of
scope. Converting them would have moved two controls off a register the design
system names and onto a different one. Both `all 0.15s` declarations are still
removed, for the reason §1.8 gives independently: `all` animates layout
properties, and `design-system.md`'s SegControl entry requires a control that
re-lays out a chart to be "instant, never animated". `SpeciesDetail`'s two
`transform 0.15s` chevron rotations are untouched, as the spec asks.

**3. The tier tints keep their SHIPPED alphas rather than the register table's.**
§1.5's table gives every tier `0.5 / 0.15 / --sr-tier-N-fg`, which is the shipped
TIER 1 row generalised; tiers 2, 3 and 4 ship at `0.3 / 0.08`. Following the
table literally would have minted four unmeasured colour pairings in a build
whose own §1.5 says "the register introduces no new colour pairing", so the
property was kept and the literals were not. Same reasoning for the one shipped
cross-case: the Breeding Codes CATEGORY pill for "Possible" sits on the tier-1
tint and takes `--sr-tier-2-fg`, which its source comment records as deliberately
verified against that tint; it keeps it, through an explicit `data-tier-fg="2"`
so it reads as the exception it is. Both are contrast-measured above.

**4. Statistics' breeding-tier pills DID converge onto the register's tints.**
They shipped a third treatment again (`0.1` background, a solid `var(--sr-tier-N)`
border) and are the same semantic control as the Breeding Codes tab's. This is
the drift Part 1 exists to collapse, so they now render one treatment; their text
stays on the AA-passing `-fg` tokens and measures 4.99 to 12.76 in light and 5.28
to 7.40 in dark.

**5. A non-ARIA carrier for the accent state: `data-state="positive"`.** Two of
the 7 sites without `aria-pressed` are the Unbounded/Normal view toggles, which
carry a real accent state. They may not gain `aria-pressed` (an ARIA change the
brief holds fixed) and they may not keep inline accent chrome (v1.0.18, and the
new guard). `data-state="positive"` shares ONE declaration with
`[aria-pressed="true"]`, so the two carriers cannot drift; it is presentational
only, exactly like the negative and target legs. No ARIA, no tab stop and no
keyboard path changed anywhere in this build.

**6. `sortBtn` de-duplicated as a CSS class, not a shared JS helper.**
`.sr-th-sort` in `globals.css`, with `--start` and `--accent` modifiers and a
`data-active` attribute. It takes no pill geometry, as §1.9 requires, and the
drift resolves to `gap: 4px` with the stated visible consequence (4px between the
code and its caret on the Breeding Codes matrix headers). A class rather than a
module because it removes the inline chrome instead of relocating it, which is
what the rest of the pass does and what the new guard asserts.

### Guards: what changed, and the red-first record

**Amended (4 files).** Three of the four were predicted; two were not.

| Guard | Why it went red | Amendment |
| --- | --- | --- |
| `filterControlSizeCss.test.ts:246` | `/^max\(\s*16px\s*,/` against the named floor | resolves `--sr-ctl-floor` from `:root` first, then asserts the term is `16px`; intent unchanged |
| `breedingCodeFilterRowCss.test.ts` (3rd `it`) | pinned an inline `height: 30` the register removes | asserts the pill carries `sr-pill` and that the register supplies `min-height: 30px` and no `height`; the `height: auto !important` assertion is kept as the spec directs |
| `BreedingCodeList.test.tsx:124` | **not predicted**: asserted `pill.style.height === '30px'` on the mounted pill | asserts the pill is on the register; jsdom applies no stylesheet, so the height belongs in the CSS guard |
| `lifeListPinnedCss.test.ts:173` | **not predicted**: matched `className="sr-touch-target"` as a whole attribute | reads the class TOKEN set, so a class added beside it cannot redden a test about a different class |

**New: `lib/controlRegisters.test.ts`** (19 assertions). Parses the real
`globals.css` for both registers; asserts the geometry, the `min-height` choice,
the v1.0.18 three-part chrome, the gated hover, the source order of every
selected-state rule, the single declaration shared by the two selected-state
carriers, tokens-only colour (including the `rgba()` triplets), the shipped tier
alphas and the cross-case, the shell-owns-the-edge split, the shared
height/type/motion between the two registers, the leading-edge divider, the inset
focus ring, non-collision with `SegControl`, the absence of `ghostBtn`/`sortBtn`
anywhere under `frontend/src`, the absence of inline chrome on every register
call site, the `--sr-ctl-rem` declarations, the 22 label opt-ins and the
Checklists companion width. `filterControlSizeCss.test.ts` gained six more,
including the derivation check and a numeric sweep of the invariant.

**Linearity of the raw-source scans** (`.claude/rules/security.md`): each scan is
one pass over each file's opening tags with a bounded, non-backtracking body.
Each tag is visited once and tested by a fixed set of anchored property patterns;
no pattern is applied to a substring of another tag's text. Work is linear in
total source length and independent of how many call sites a file holds. The
corpus is the repo's own `frontend/src`, not user input, and the largest file in
it is under 200 KB.

**Red-first: 36 mutations, 36 red, 0 vacuous.** Each was applied to the source,
the relevant guard run, and the source restored.

| # | Mutation | Result |
| --- | --- | --- |
| A1 | `min-height` back to `height` | RED |
| A2 | radius 15 to 6 | RED |
| A3 | drop the pill transition | RED |
| A4 | transition to `all` | RED |
| A5 | ungate the hover rule | RED |
| A6 | declare pressed before `:hover` | RED |
| A7 | split the two selected-state carriers | RED |
| A8 | one hardcoded hex in the register | RED |
| A9 | flatten the tier-2 alphas to tier 1's | RED |
| A10 | drop the category cross-case rule | RED |
| B1 | radius on the segment instead of the shell | RED |
| B2 | segment height drifts from the pill's | RED |
| B3 | divider on the trailing edge | RED |
| B4 | drop the inset focus ring | RED |
| B5 | a rule matching `.sr-seg-btn` as well | RED |
| C1 | restore a `ghostBtn` helper | RED |
| C2 | inline `border` on a call site | RED |
| C3 | restore an inline `transition` | RED |
| D1 | `--sr-ctl-floor` moved off `:root` | RED |
| D2 | the floor written as a rem | RED |
| D3 | rem term hardcoded to `0.75rem` again | RED |
| D4 | the fallback changed | RED |
| D5 | a control drops its `--sr-ctl-rem` | RED |
| D6 | `--sr-ctl-rem` disagrees with its `fontSize` | RED |
| E1 | label rule loses `!important` | RED |
| E2 | the factor on ONE term only | RED |
| E3 | label rule written as literals | RED |
| E4 | label rule moved out of the phone tier | RED |
| E5 | labels reached by an element selector | RED |
| E6 | the optical factor changed | RED |
| E7 | a label opt-in dropped | RED |
| E8 | a `SidebarLabel` opt-in dropped | RED |
| F1 | companion width on the shared `.sr-ctl-row` | RED |
| F2 | companion desktop width changed | RED |
| G1 | the filter pill loses the register class | RED |
| G2 | `.sr-touch-target` dropped from the view toggle | RED |

### Two harness findings worth keeping

**The rule scanner in `filterControlSizeCss.test.ts` reads a rule's prelude as
everything since the previous closing brace, so the stylesheet's FIRST block
carries the `@import` line in its selector.** A `selector === ':root'` equality
therefore reports the app's own token block as absent, and finds the component
library's `:root` instead. Both halves matter: take the last statement of the
prelude, and search EVERY `:root` block rather than the first.

**A `320px / 200%` horizontal-scroll reading on a probe page is about the probe
until the constraints are reproduced.** The first WebKit run measured 365px
against a 320px viewport; the two overflowers were bare `<input>` elements whose
real call sites carry `flex: 1` or `width: 100%` with `min-width: 0`. With those
reproduced, 24 of 24 probe runs and 12 of 12 real-app runs show no page
horizontal scroll, in both engines, at 1280, 390 and 320 and at both scales, with
zero console or page errors.

### Verification performed

- `npx tsc --noEmit`, `npx eslint src --max-warnings=0`, `npm run build`: clean.
- Full suite: 356 files, **7,373 passing**, 3 skipped, 0 failing.
- Scoped: all six named guards, `sortControlsSelectedState`, `tabOrderCoverage`,
  `entryChunk`, all five `*Contrast*` suites, and every test file for the 15
  target components plus `Settings`, `Calendar`, `MapExplorer` and
  `WeatherForecastPanel`: 54 files, 873 passing.
- **Tailwind byte-compare of `dist` CSS against HEAD** (the standing caution in
  `filterControlSizeCss.test.ts`): a full build at HEAD and a full build here,
  diffed block for block. 26 blocks added, 3 replaced, and **0 of the added
  blocks are foreign** to this change: no stray utility was emitted from a bare
  word in a test comment.
- Built app driven with the repo's Playwright 1.62.1 (Chromium and WebKit) at
  1280 / 390 / 320 and 100% / 200% text scale, both themes: 12 real-app runs and
  24 probe runs over the real built stylesheet. Zero page or console errors, no
  page horizontal scroll anywhere.

### What the Chronicler is owed

1. **CLAUDE.md's v1.0.32 reversal condition is ANSWERED, not triggered.**
   `sort-controls-selected-state` decision 1 declined to extract a shared
   `SortSeg` and named "any change that makes the five variants converge on one
   shape" as its reversal condition. This register converges them, in CSS. The
   drift a shared component would have prevented is now prevented by one
   stylesheet rule, and §1.3 holds Register B to a CSS register with no component
   or ARIA change, so extraction is **not** taken. The condition reads as
   answered rather than unmet.
2. **`ACCESSIBILITY.md:51`'s published claim is now true.** "Scales all text from
   100% up to 200%" was not fully true: the clamp cut 13 controls DOWN at 200%.
   Measured above, every one of them now renders at or above its declared size.
   No edit is required; whether to add a sentence is the Chronicler's call.
3. **`pipeline/design-system.md` gained two amendments**, both applied here: the
   Filters clause's "spans and stay outside it by design" is replaced, and a
   Segmented toggle entry for `.sr-segbar` is added after the `SegControl` entry.
4. **`.claude/rules/ui.md` gained two `paths` entries and three replaced
   passages** (`:41`, `:42`, `:73`), per CLAUDE.md's v1.0.32 obligation.
5. **`vX.Y.Z` is live in three files and must be stamped at the bundle's single
   bump: `.claude/rules/ui.md`, `pipeline/design-system.md` and
   `frontend/src/globals.css`'s own comments. Stamp by `grep -rn 'vX\.Y\.Z'`,
   never by a count.** A wrong version citation in a rule file outlives the
   build, and so does a wrong count in a record that is promoted into
   `DECISIONS.md` and then believed. This entry carried "Five" over an
   enumeration of nine while the real figure was 18 occurrences across 13 lines,
   which is exactly the count-decay failure CLAUDE.md records. The durable fix is
   a form that cannot decay: the file list is the claim, the grep is the
   procedure, and neither goes stale when a passage is edited.
6. `PRODUCT_CONTEXT.md:1730` was **not** actioned, per correction 2.

## Stage 3, QA retry 1 (2026-09-22, The Engineer)

Five findings from `qa-report.md`, all five fixed. Full suite green at **7,374**
passing; typecheck, lint and `npm run build` clean; the Breeding Codes row
re-measured on the rebuilt `dist` against a `git archive HEAD` build in both
engines.

### Finding 1 (BLOCKING) -- `white-space: nowrap` on the register re-opened the v0.5.86 overflow

**Fixed where the measured repair lives, not on the register.** The release is
`white-space: normal` on `.sr-bc-filter-row > .sr-bc-filter-pill`, inside the
phone tier, beside the `min-width: 0` and `overflow-wrap: break-word` it exists
to enable.

**The argument for that placement, since the errand asked for it.** The
register's `white-space: nowrap` is the family's universal shipped value: every
inline pill this pass replaced declared it, and it is right for a short filter
chip, which should not go ragged. What the register could not know is that ONE
row in the app carries full breeding-code labels whose min-content exceeds a
phone panel, which is the property v0.5.86 measured and scoped three dedicated
hooks around. `overflow-wrap: break-word` cannot act while line breaking is
forbidden outright, so on that row and that row only, nowrap defeated the entire
containment block while every other declaration in it stayed correct. Releasing
it on the register's own phone tier instead would let every pill on every tab
wrap mid-row at <=640, which nobody has measured, and v0.5.86's own rule -- which
this build's applied `ui.md` passage restates -- is that other filter surfaces
and wider layouts are outside the measured repair. So the release is scoped, and
the register keeps the default that is right for the other 40 sites.

`white-space` is an inherited property, so the declaration on the pill reaches
`.sr-bc-filter-pill-label` and the label needs none of its own. Verified by
measurement rather than by reading the spec: the computed value on both the pill
and the label reads `normal` with only the pill declaring it.

**The `ui.md` passage this falsified is repaired in the same change.** The
applied §2.8 wording said the register's `min-height` means "a wrapped label
grows the pill on every surface without a per-feature override", which stopped
being true the moment the register forbade wrapping. It now says what is true:
nothing has to release a fixed height any more, and what the per-feature hook
still owns is PERMISSION TO WRAP. The measurement, the reason the release is
scoped, and the guard shape ride with it.

**Measured, rebuilt `dist`, both engines.** "no-fix" is this build with only the
`white-space: normal` declaration stripped out of the built CSS, so the reading
is discriminating rather than merely agreeing with HEAD.

| Engine | Build | Viewport / scale | row scroll/client | doc scroll/client | computed `white-space` | pill heights |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium | HEAD | 320px / 200% | 272 / 272 | 320 / 320 | normal | 74, 74, 74, 110 |
| Chromium | no-fix | 320px / 200% | **334 / 272** | **334 / 320** | nowrap | 38, 38, 38, 38 |
| Chromium | after | 320px / 200% | **272 / 272** | **320 / 320** | normal | 74, 74, 74, 110 |
| WebKit | HEAD | 320px / 200% | 272 / 272 | 320 / 320 | normal | 75, 75, 75, 111 |
| WebKit | no-fix | 320px / 200% | **335 / 272** | **335 / 320** | nowrap | 39, 39, 39, 39 |
| WebKit | after | 320px / 200% | **272 / 272** | **320 / 320** | normal | 75, 75, 75, 111 |

Spot checks, to show nothing else moved:

| Engine | Viewport / scale | HEAD | no-fix | after |
| --- | --- | --- | --- | --- |
| Chromium | 390px / 200% | row 272/272, doc 390/390 | row **334/272**, doc 390/390 | row 272/272, doc 390/390 |
| WebKit | 390px / 200% | row 272/272, doc 390/390 | row **335/272**, doc 390/390 | row 272/272, doc 390/390 |
| Chromium | 320px / 100% | row 272/272, doc 320/320 | row 272/272, doc 320/320 | row 272/272, doc 320/320 |
| WebKit | 320px / 100% | row 272/272, doc 320/320 | row 272/272, doc 320/320 | row 272/272, doc 320/320 |

**After equals HEAD exactly**, in both engines, at every reading including the
per-pill heights. Two things the readings add to the Tester's report. At 390px
the no-fix row was ALREADY 62px past its 272px panel and only the viewport being
wider than the row kept the page from scrolling, so "390 is clean" was true of
the page and not of the row; the defect's boundary is the panel, and 320px is
where the page notices. And at 100% nothing differs in any build, which confirms
the whole defect lives at large text scale, where a label stops fitting one line.

**Guard, red-first.** `breedingCodeFilterRowCss.test.ts` gains a row that
resolves the CASCADE rather than checking for a declaration: it collects every
rule whose classes are all ones this pill or its ancestors carry, in source
order, and asserts the last `white-space` among them is `normal`, is phone-tier,
and is declared at a specificity above the single-class register. It also pins
that the register still declares `nowrap`, so the pairing is the claim.

A presence check on `white-space: normal` would have passed through three of the
four mutations below, which is why it is written this way.

| # | Mutation | Result |
| --- | --- | --- |
| H1 | drop the release | RED (1 failed / 4 passed) |
| H2 | release written on the register instead | RED (2 failed / 3 passed) |
| H3 | register drops `nowrap` entirely | RED (1 failed / 4 passed) |
| H4 | release moved out of the phone tier | RED (1 failed / 4 passed) |
| H5 | a later rule re-forbids wrapping | RED (2 failed / 3 passed) |

**Why nothing went red the first time, kept as a convention flag.** The Tester's
diagnosis is right and is worth stating generally: `breedingCodeFilterRowCss`
forbids `white-space` on rules selected through `.sr-ctl-row`, because that is
where such a declaration would have arrived from when the guard was written. This
one arrived on the standalone `.sr-pill`, which that forbid-list is structurally
blind to -- the same shape as the Part 2 defect this whole build repairs, where
the guard checked the floor term and not the rem term. **When a shared register
lands on a surface that already carries a measured layout repair, pin the
PROPERTY at the surface that needs it, not the selector family it happened to
arrive through.** That is now in the applied `ui.md:73` passage as well.

### Finding 2 (BLOCKING) -- the two named guard extensions

**Made, not deviated from.** The spec names both files, and
`controlRegisters.test.ts`'s roster is a per-FILE presence check rather than the
per-CONTROL agreement the spec asked for, so it is not equivalent and was not
argued as such.

`components/MapExplorerInputZoom.test.tsx`: `expectGuarded` gains an optional
`register` argument. Passing it asserts that the element's `--sr-ctl-rem` is
declared AND equals its inline `fontSize`, on that exact element. **Omitting it
is also a claim, not a skip:** the control must then carry no inline size other
than the rule's own `0.75rem` default, so a control that later gains a larger
size without a matching property fails here. Applied per control: the species
combobox (`:2059`) and both selects (`:2076`, `:2100`) at `0.8125rem`, the two
date inputs on the default.

`components/MapExplorerSpeciesFilter.test.tsx`: the combobox assertion at the
panel register now also asserts `--sr-ctl-rem` **equals the `fontSize` asserted
on the line above**, rather than restating the literal. Two declarations of one
number compared to each other is what survives the drift; a second literal would
have stayed green through exactly the drift it exists to catch.

| # | Mutation | Result |
| --- | --- | --- |
| I1 | the combobox drops `--sr-ctl-rem` | RED (2 failed / 8 passed) |
| I2 | `SELECT_STYLE` drops `--sr-ctl-rem` | RED (1 failed / 3 passed) |
| I3 | `--sr-ctl-rem` disagrees with `fontSize` (selects) | RED (1 failed / 3 passed) |
| I4 | `--sr-ctl-rem` disagrees with `fontSize` (combobox) | RED (2 failed / 8 passed) |
| I5 | a date input gains a larger size with no property | RED (1 failed / 3 passed) |

I5 is the one that proves the omitted-argument branch is a claim rather than a
gap.

### Finding 3 -- the one declaration that was not byte-identical on desktop

**Scoped rather than re-worded.** The Tester offered either; moving the
declaration makes the record's sentence true, and amending the sentence would
only have made it weaker. `.sr-chk-row-label--auto` declared `width: auto;
min-width: 0` at all widths, where the inline value it replaced declared no
`min-width` at all, so it moved the Effort label's computed `min-width` from
`auto` to `0px` on desktop with nothing rendered changing. The base rule now
declares `width` only; the `min-width: 0` moved into the phone tier, which is
the only tier that introduces a minimum to release. Desktop is byte-identical
down to the declaration, and `controlRegisters.test.ts` pins the split.

| # | Mutation | Result |
| --- | --- | --- |
| J1 | `min-width: 0` back on the base rule | RED (1 failed / 18 passed) |
| J2 | the phone-tier release dropped | RED (1 failed / 18 passed) |

### Finding 4 -- the `vX.Y.Z` count

Replaced with the three file names and the instruction to stamp by
`grep -rn 'vX\.Y\.Z'`, in both `decisions.md` and `pr-description.md`. The record
said "Five", then enumerated nine, against a real 18 occurrences over 13 lines.
CLAUDE.md's v1.0.32 entry is explicit that a count in a pipeline record is
promoted into `DECISIONS.md` and believed, and that the durable fix is a form
that does not decay rather than more care at the keyboard, so the count is gone
rather than corrected: a file list and a grep cannot go stale when a passage is
edited, and this section added a tenth occurrence to `globals.css` while being
written.

### Finding 5 -- the stale derivation in `subspeciesExplorerCss.test.ts`

The premise comment cited `max(16px, 0.75rem)`, a formula that no longer exists.
It now states the shipped formula, and states why its 24px figure is unchanged:
`.sr-ssx-toggle` declares `0.75rem`, so it resolves through the rule's default
and 200% scale still gives 24px. The derivation is restated rather than the
number patched, because a control that later declares a larger `--sr-ctl-rem`
would move this premise and the comment now says so.

### Re-run

- `npx tsc --noEmit`, `npx eslint src --max-warnings=0`, `npm run build`: clean.
  (`tsc -b` inside the build caught one `HTMLElement.placeholder` access the
  looser `--noEmit` run did not; fixed to read the attribute.)
- Amended guards: `controlRegisters`, `filterControlSizeCss`,
  `breedingCodeFilterRowCss`, `lifeListPinnedCss`, `subspeciesExplorerCss`,
  `MapExplorerInputZoom`, `MapExplorerSpeciesFilter`, `BreedingCodeList`:
  8 files, 89 passing.
- Full suite: 356 files, **7,374 passing**, 3 skipped, 0 failing.
- Browser re-measurement: 18 readings (3 builds x 3 configurations x 2 engines)
  on the rebuilt `dist`. All servers stopped; `frontend/dist/__probe.html`
  removed; no listener left on any port this errand opened.

**Red-first this retry: 12 mutations, 12 red, 0 vacuous.** Running total across
Stage 3 and this retry: **48 mutations, 48 red.**
