# Design Refinement — Freezable Label Rows

> **PARTLY SUPERSEDED.** Two of this spec's verdicts were built, previewed on a
> device, and reversed by the user. Read it as the record of what was decided and
> why, not as the build instruction; `pr-description.md` describes what ships.
>
> - **The reshape under Verdict 1 is reverted.** Pinning freezes the CODE HEADER
>   ROW ONLY. The species-name column's horizontal freeze is a property of Normal
>   view (`leftFreeze` is gone; the predicate is `!wideMode`), and the pill is
>   named "Pin code labels" again, so the Verdict 3 rename is reverted too.
> - **Verdict 2 is reversed.** Multimedia DOES get the opt-in pin pill, mirroring
>   Breeding Codes'. The user asked for parity of the control, not only of the
>   mechanism. The Chromium regression this spec correctly named as the cost is
>   real, was accepted, and is recorded in the PR.
> - **Everything else still stands**, including the Half A decline, the
>   measurements, the `<th>`-level sticky and its `globals.css` block, the
>   `.sr-ios-app` gate, the focus guard, the `.sr-touch-target` parity item, and
>   the reason Multimedia gets no frozen name column.
> - The "What The Engineer should not do" list at the end is therefore wrong on
>   two lines ("Do not add a pin pill to Multimedia" and the reshape it assumes).
>   The rest of that list holds.

Improve lane, Stage 2. This spec answers the change brief's three open calls
with verdicts and the measurements behind them, so The Engineer builds to a
decision rather than re-deriving one.

**Headline: Half A is declined as written and replaced by a reshape.** The
saved idea asked to "freeze label rows." Half A does not add a freeze, it
*swaps* one for the other, and it takes away the more valuable one. The
reshape makes the existing opt-in pin freeze **both** label axes, which is
what the idea actually asked for, and leaves it opt-in.

---

## How this was verified

Every geometric claim below is a **real render**, not a parsed stylesheet and
not jsdom. A faithful static reproduction of both tables was driven in
Chromium via Playwright (already a dependency in `website/tools/`) at
**320 x 568**, at **1x and 200% in-app text scale**, with the declarations
**parsed from the real `frontend/src/globals.css`**. The only substitution is
the `@import "tailwindcss"` line, replaced by the two preflight declarations
this layout depends on (`box-sizing: border-box`, the margin reset) — the
sanctioned platform-value substitution, not a re-authored rule. Component
inline styles are transcribed from the components' own JSX style objects, at
their shipped specificity of (1,0,0), which is load-bearing for every question
here.

Elements are measured **against their container**, never page `scrollWidth`
alone (v0.5.82). Occlusion and layering claims are settled with
`elementFromPoint` inside the frozen bands, not by reasoning about `z-index`.
No real eBird export was touched; the content is hand-written realistic
species and real eBird breeding codes.

Harness: `/private/tmp/.../scratchpad/repro/{build,measure,measure2,shots}.mjs`
(throwaway; the repo working tree carries only this spec and `design.html`).

---

## Verdict 1 — Half A (pin ON by default on phones): **DECLINE**

### What it actually costs, measured

Breeding Codes at 320px with 16 codes present, page scrolled fully right and
420px down (the state a birder scanning the matrix is in):

| | **Normal** (ships today) | **Unbounded + pinned** (Half A) | **Unbounded + pinned + name freeze** (reshape) |
|---|---|---|---|
| Species name mid-list, 1x | **103px visible**, x=29 | **0px — off-screen at x=-277** | **103px visible**, x=12 |
| Species name mid-list, 200% | **215px visible**, x=29 | **0px — off-screen at x=-390** | **215px visible**, x=12 |
| Code header after scrolling down | **0px — gone** | **36.5px pinned at y=0** | **36.5px pinned at y=0** |
| Page width (horizontal leak), 1x | 320px (**0**) | 626px (**306px**) | 626px (306px) |
| Page width (horizontal leak), 200% | 320px (**0**) | 739px (**419px**) | 739px (419px) |
| Code columns visible, 1x / 200% | 158px / 46px | 192px / 80px | 192px / 80px |

At the 23-code ceiling the leak is **516px (1x) and 629px (200%)** — the page
becomes roughly three viewports wide.

### The reasoning

**Half A is a swap, not a gain.** Freezes before: one (the species name).
Freezes after: one (the code header). The user asked for more frozen labels
and would get the same number.

**It removes the freeze that does more work.** The code header is one row at
the top of a 400-row table; losing it costs a scroll back to the top. The
species name is present in *every* row; losing it makes every row an anonymous
grid of dots, continuously. The `bc-halfA` panel in `design.html` is that
screen, rendered rather than described: eleven columns of purple count dots
and no way to tell which bird any of them belongs to.

**It makes the whole page horizontally scrollable at first open.** Unbounded's
scrollport is the page, so the tab strip, the filter pills and the count row
all drift off-screen sideways with the table. Landing there unannounced is a
different thing from choosing it: nothing on the opening screen signals that
the page extends 306-629px to the right, because the pinned band and the
table both look like an ordinary table until you drag.

**The default cannot self-correct.** `mountedTabs` only ever grows and hidden
panels are `display: none`, so `useIsPhone()` would seed `pinned` exactly once,
at first open. A desktop window narrowed below 640px when the tab is first
opened stays Unbounded and pinned for the rest of the session after the window
is widened. A default that can be wrong and has no path back to correctness is
worse than no default.

**It contradicts a decision the user ratified.** v0.5.81 records the pin as
"a user-chosen mode on top of it, never something a user can land in." That is
not a scoping detail to quietly reverse inside a refinement.

### The reshape that replaces it

**In the pinned state, the species-name column keeps its horizontal freeze.**
Today `wideMode` drops `position: sticky; left: 0` from the corner and the
name cells (a deliberate 2026 choice so the table "pans as one unit"). Pinning
is the one state where that choice stops paying: the user has explicitly asked
for labels to hold still.

Measured, at both text scales and at the 23-code ceiling: the mid-list species
name holds at **x=12 with 103px (1x) / 215px (200%) of its box on screen**
while the code header holds at **y=0**, at **identical page width** — the
freeze costs nothing in layout. `elementFromPoint` confirms all three layers:
the corner paints over everything (`BUTTON` in the corner), the name column
paints over the code cells passing under it (`BUTTON.sr-birdname-link` at
y=300), and the band paints over the body rows.

Two findings worth carrying:

- **The reshape shows more of the matrix than today's Normal default**, because
  Normal's scrollport is the 286px wrapper while Unbounded's is the full 320px
  viewport: **192px vs 158px** of code columns at 1x, and **80px vs 46px** at
  200% text scale. At 200% today's Normal view is back to a roughly
  one-and-a-half-column peephole; pinned Unbounded is not.
- **Desktop is unaffected in practice.** At 1280px the page leak is **0**, so
  the left freeze never engages. Measured, not assumed.

So the pin becomes strictly additive, and the phone default stays exactly what
ships today. The user reaches both freezes with one press of a control that is
already in the row, already explained by a note, and already reversible.

**What is given up by declining Half A:** a birder who wants both freezes must
press one pill each session. That is the whole cost, and it is the cost
v0.5.81 already chose deliberately.

---

## Verdict 2 — Multimedia's pin: **repair the mechanism, leave it always-on in
Unbounded. No pill.**

**The losing side, named:** Multimedia's control row will **not** gain a "Pin
labels" pill, so the two surfaces' control rows are not symmetric. Anyone
comparing them will see a pin control on Breeding Codes and none on
Multimedia.

**Why that is right.** Breeding Codes' pill exists because pinning *changes
your view* — `pinned implies Unbounded`, so pressing it moves you somewhere
else. That coupling is what makes it a choice worth surfacing. Multimedia's
sticky header is already scoped to Unbounded, which the user has already
chosen; inside that view a pinned header costs **36.5px (1x) / 53px (200%)** of
band — **6.4% / 9.3%** of a 568px viewport — and takes nothing away, because
Multimedia has no frozen name column to lose. A toggle whose only function is
to switch off something with no downside is a control that should not exist.

**Nobody loses.** Chromium (web, Windows WebView2) keeps the header pin it has
today; WKWebView (the macOS app, iOS) gains the one it has never had. An
opt-in pill defaulted OFF would have been a visible regression for the first
group, which is the knot the brief asked to be untied rather than papered over.

**Option C was measured, not hand-waved.** Adding the pill fits: the
three-control cluster measures **276.38px in a 288px content box at 1x** and
**288px with the buttons on two lines at 200%**, with **0px** overflow and
**0px** page leak at both scales. It is declined on interaction grounds, not
on geometry, so nobody should re-open it believing it was a space problem.

**Verified working.** With the proposed rule applied, the header cells compute
`position: sticky`, `top: 0px`, `z-index: 3`, background `rgb(249,250,251)`
(`--sr-bg`, opaque so rows cannot show through), the band holds at **y=0**
after scrolling, `elementFromPoint` inside the band returns a header rather
than a body row, and the focusables in the body compute
`scroll-margin-top: 48px (1x) / 96px (200%)`. Today's `<tr>` sticky was
confirmed live in Chromium (which is exactly why removing it would be a
regression) and is the mechanism this repo already recorded WKWebView does not
honor.

**One asymmetry to record, because it will be asked.** Multimedia does **not**
get a frozen name column, and the reason is measured rather than aesthetic: its
name column is **238px at 1x and 423px at 200%** on a 320px viewport (74% and
**132%** of the screen), because `minWidth: 200` is a floor with no viewport
clamp. A frozen column wider than the viewport leaves nothing for the data.
Breeding Codes' name column is clamped (`clamp(7.5rem, 40vw, 220px)` → 128px /
240px), which is precisely why the reshape works there and cannot be ported
here. Giving Multimedia's name column a viewport clamp is a real follow-up idea
and is **out of scope** for this refinement — it would change the Normal view
too. In Unbounded, scrolled right, Multimedia's rows are anonymous today and
stay anonymous; the pin repair does not make that worse.

---

## Verdict 3 — The control cluster: **it already fits. Add the touch target,
shorten the pin label.**

The v0.5.82 `maxWidth: 100%` repair is holding. Measured at 320px, cluster
width against its row's content box:

| Cluster | 1x | 200% |
|---|---|---|
| Breeding Codes, ships today | 288px vs 288px → **0px over**, 0px page leak | 288px vs 288px → **0px over**, buttons on 2 lines |
| Breeding Codes, label shortened to "Pin labels" | 271.81px → **16.19px of slack** | 288px → 0px over |
| Multimedia, ships today (no touch target) | 179.8px → **108.2px of slack** | 288px → 0px over |
| Multimedia, with `.sr-touch-target` | 179.8px → 108.2px of slack | 288px → 0px over |
| Multimedia, rejected option C (third control) | 276.38px → 11.63px of slack | 288px → 0px over |

Nothing overflows and nothing leaks page scroll, at either scale, in any
configuration. Two changes are still warranted:

1. **Add `.sr-touch-target` to Multimedia's `↔ Unbounded` button** (the parity
   gap the brief names). Measured effect: the button goes from **98 x 15px** to
   **98 x 44px** at 1x; cluster width is unchanged at 179.8px and overflow stays
   0 at both scales. Only the cluster's height changes (18 → 44px at 1x,
   72 → 132px at 200%), absorbed by the wrapping row. Today's 15px-tall button
   is well under the ~44px phone posture.
2. **Rename Breeding Codes' pill from "Pin code labels" to "Pin labels."** It
   becomes *accurate* once the species column freezes too, it matches the saved
   idea's own words ("freeze label rows"), and it returns **29.5px at 1x /
   53.6px at 200%** to the tightest cluster in the app. The pill's state value
   is `pinned` and is already label-agnostic, so no state renames follow.

---

## Screens / Views

### Breeding Codes matrix (`BreedingCodeTable.tsx`)

Unchanged in the default (unpinned) state, in both views, at every width. Only
the `pinned && wideMode` state changes.

**Pinned state, per cell:**

- **Corner (`<th class="sr-bc-name-col">`, species header):**
  `position: sticky; left: 0; z-index: 4`. It is the one cell frozen on both
  axes, so it must out-layer both the band (3) and the body name cells (1).
  **It must set no inline `top` and no inline `box-shadow`.** `top` comes from
  `.sr-bc-matrix--pinned thead th` so the `.sr-ios-app` gate can re-point it to
  `env(safe-area-inset-top)`; an inline value at (1,0,0) is unreachable from the
  stylesheet and would pin the band into the Dynamic Island. The band shadow
  likewise comes from the class, and the corner's right-hand divider is already
  supplied by `.sr-bc-name-col`'s `border-right`, which applies at all widths.
- **Body name cells (`<th class="sr-bc-name-col">`):**
  `position: sticky; left: 0; z-index: 1`, keeping today's inline
  `box-shadow: 1px 0 0 var(--sr-border)` and its existing opaque `background`
  (the hover-aware `rowBg`). Opacity is load-bearing: code cells pass under
  this column.
- **Code header cells:** unchanged. They already inherit `sticky/top/z-index: 3`
  and the band shadow from `.sr-bc-matrix--pinned thead th`.

Implementation shape: the existing `wideMode ? {} : {sticky…}` ternaries on the
corner (`:251`) and the body name cell (`:324`) become a single derived flag,
`leftFreeze = !wideMode || pinnedNow`, so the two sites cannot drift. The
component's local `pinnedNow = pinned && wideMode` guard stays exactly as it is.

**Unpinned rendering must stay byte-identical** in both views and at all widths.
That is the regression bar for this surface.

### Multimedia table (`LifeListTable.tsx`)

- Remove the `position: sticky; top: 0` from the `<tr>` at `:234`. Keep the
  row's `background` and `boxShadow` there for the unpinned (Normal) path so
  that path renders byte-identically.
- Add `className={wideMode ? 'sr-ll-table sr-ll-table--pinned' : 'sr-ll-table'}`
  to the `<table>`. The modifier is named `--pinned` rather than `--wide` so the
  two surfaces share one CSS vocabulary if a pill is ever added here; the code
  comment should state that on this surface **pinned is Unbounded**, with no
  separate control.
- The table already carries `border-collapse: separate`, which sticky header
  cells require. No change.

**New rules in `globals.css`, immediately after the `.sr-bc-*` pinned block, in
this order** (they mirror the Breeding Codes block deliberately, so the two read
as one pattern):

```css
.sr-ll-table--pinned thead th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--sr-bg);
  box-shadow: inset 0 -1px 0 var(--sr-border-medium), var(--sr-sticky-shadow);
}
.sr-ll-table--pinned tbody th,
.sr-ll-table--pinned tbody td,
.sr-ll-table--pinned tbody th *,
.sr-ll-table--pinned tbody td * { scroll-margin-top: 3rem; }
.sr-ios-app .sr-ll-table--pinned thead th { top: env(safe-area-inset-top, 0px); }
.sr-ios-app .sr-ll-table--pinned tbody th,
.sr-ios-app .sr-ll-table--pinned tbody td,
.sr-ios-app .sr-ll-table--pinned tbody th *,
.sr-ios-app .sr-ll-table--pinned tbody td * {
  scroll-margin-top: calc(3rem + env(safe-area-inset-top, 0px));
}
```

The `background` moves onto the `<th>` because the band is now the cells, not
the row. The **descendant selectors in the focus guard are the operative half**,
not defensive noise: `BirdName` renders a `<button class="sr-birdname-link">`
inside each row-header cell, `scroll-margin` applies to the element scrolled
into view and does not inherit, so a rule on the cells alone computes `0px` on
every element that can actually take focus. The `.sr-ios-app` gate must be a
gate and never a bare `env()` — `index.html` ships `viewport-fit=cover` to
browsers too, so an ungated rule would change shipped web rendering in iOS
Safari.

### Control rows

- **Breeding Codes** (`BreedingCodeList.tsx`): pill label → `Pin labels`. No
  `aria-label` is added; the visible text remains the accessible name so the two
  cannot drift, and the consequence stays on `aria-describedby`.
- **Multimedia** (`LifeList.tsx`): add `className="sr-touch-target"` to the
  `↔ Unbounded` button. No third control.

---

## Component Usage

No new components, no new library, no new dependency. This refinement is one
derived boolean in `BreedingCodeTable`, one class swap in `LifeListTable`, one
`className` and one copy string in the two control rows, and one CSS block that
mirrors an existing one. `BirdName`, `ChecklistLink`, `OutboundLink`, and the
`.sr-wrap-flex` / `.sr-touch-target` / `.sr-ctl-row` vocabulary are all reused
unchanged. Lucide's `Pin` icon stays on the Breeding Codes pill.

## Design Tokens Applied

All existing; **no new tokens**.

- Band fill `--sr-bg` (opaque — rows must not read through a frozen band).
- Band hairline `--sr-border-medium` plus the `--sr-sticky-shadow` haze, matching
  the shipped Breeding Codes band exactly. As recorded in v0.5.81, that pair is
  visual reinforcement and is **not** claimed as a WCAG 1.4.11 pass: the header
  is identified by its text.
- Frozen name column divider `--sr-border` (body cells, existing inline) and
  `--sr-border-subtle` (the corner, via `.sr-bc-name-col`'s `border-right`).
- Row fills `--sr-surface` / `--sr-surface-faint` (hover) unchanged, and they
  must stay opaque.
- Count dots keep `--sr-tier-N` fills with `--sr-tier-N-text` on top.

## Interaction Notes

- **`pinned implies Unbounded` is unchanged.** Pressing Pin from Normal switches
  the view and pins in one press; pressing it again restores the view you came
  from; pressing `↔ Normal` while pinned clears the pin and un-presses the pill.
  The reshape adds no state and no new transition.
- **Session-only, per the standing precedent** (`wideMode`, Point Size, county
  Use Textures, Calendar view). Nothing is persisted, no storage seam, no
  Settings control. Because tabs stay mounted, the settled published phrasing is
  **"per-session, resetting on relaunch"** — reuse that exact wording in
  `docs/HELP.md`; do not write "resets when you leave the tab," which is false.
- **The pin note copy must change** with the label, since it now describes two
  freezes. Proposed, no em dashes, naming the view control by its shipped label:
  > Species names and code labels both stay in view while you scroll. Pinning
  > uses the Unbounded view, so the matrix scrolls with the page.
  The `aria-describedby` target keeps its shorter form: "Pinning uses the
  Unbounded view."
- **The live region stays keyed.** `key={pinSeq}` on the note is what makes a
  repeat announcement a real node replacement; do not remove it and do not
  "fix" it by appending an invisible character.
- **Focus must never land under either band.** Vertical is the existing
  `scroll-margin-top` on the pinned cells *and their descendants*; horizontal in
  Normal view is the wrapper's `scrollPaddingLeft`. The reshape adds a *third*
  case that must be checked on device: with the name column frozen in Unbounded,
  keyboard focus moving rightward across a row can land under the frozen column.
  In Unbounded the scrollport is the page, so the correct property is
  `scroll-margin-left` on the same four selectors, not a `scroll-padding-left` on
  the root (a root rule would leak to every other tab, since hidden tabs stay
  mounted). **Verify by reading the computed value off the focusable, not the
  cell.**
- **On-device verification is required before ship**, and two specific things are
  what the device run is for: (1) a `<th>` sticky on **both** axes at once under
  WKWebView with `table-layout: fixed` — cell-level sticky is the recorded
  WKWebView-safe form and both single axes ship today, but the combination is
  new here; (2) the band clearing the Dynamic Island via the `.sr-ios-app` gate
  on both tables.

## Motion Spec

Deliberately minimal. Most of this surface's correct answer is *no* motion, and
the reasons are worth stating so they are not "fixed" later.

- **Frozen band and frozen column: no motion, no transition, no shadow fade.**
  Sticky is continuous positioning, not a state change, so there is nothing to
  animate. A shadow that fades in when the band becomes stuck would need a
  scroll listener or an IntersectionObserver sentinel this repo does not want,
  and it is the "motion decorating a static screen" anti-pattern. Existing
  stance from v0.5.81; unchanged.
- **Pin note entrance** (`.sr-bc-pinnote--enter`, existing, unchanged):
  opacity 0 → 1 with `translateY(-2px)` → none; **160ms, `ease-out`**;
  transform-origin is the control row that triggered it (the note rises out of
  it); `@media (prefers-reduced-motion: reduce)` sets `animation: none`;
  implemented in plain CSS `@keyframes` in `globals.css` (no Motion/JS).
- **Pill press feedback:** none added. `aria-pressed` plus the accent
  border/background swap is the state change, and it is instant. A bouncy or
  elastic press on a utility toggle is explicit motion anti-slop.
- **Multimedia:** no new motion at all. It gains no note and no control.

## Content Notes

- Copy stays in the app's plain, specific voice. **No em dashes** in any
  user-facing string, per the standing rule: the new pin note above uses a
  period between independent clauses and a comma for the light aside.
- The view control is named by its shipped label, "Unbounded," never a synonym,
  so the sentence and the button agree.
- `docs/HELP.md`, `README.md`, and `website/index.html` all restate this
  behavior and must be updated in the **same** change, each checked against the
  code that implements it. In particular the pin's description must now say
  both label axes freeze, and must use "per-session, resetting on relaunch."

---

## What The Engineer should not do

- Do not seed `pinned` from `useIsPhone()`, or from any breakpoint. Half A is
  declined; the phone default is today's Normal view, unpinned.
- Do not add a pin pill to Multimedia.
- Do not reintroduce a capped-height frozen-header box on either surface
  (v0.5.69 stays not-reversed; both keep the natural full-height page-scrolling
  table).
- Do not persist either surface's pin state.
- Do not put `top` or a `box-shadow` inline on the pinned corner cell.
- Do not add a frozen name column to Multimedia (measured: 132% of a 320px
  viewport at 200% text scale).
