# Design Spec — Calendar Tab

- **Feature:** calendar-tab
- **Date:** 2026-07-03
- **Stage:** 4 — The Designer
- **Mockup:** `pipeline/calendar-tab/design.html` (open in a browser; the in-tab
  controls, theme toggle, and day popup are all live)
- **Source of record:** `pipeline/design-system.md`, `frontend/src/globals.css`,
  `prd.md`, `schema.md`

This design extends the established SnowRaven system — it does not reinvent it.
Every color is a `var(--sr-*)` token; the layout, controls, header, and popup all
reuse patterns already shipped in tabs like Checklists and Statistics, so the
Calendar reads as a native sibling. The one net-new visual element is the
purpose-built `--sr-cal-1..5` day-shade ramp, which the Architect already
specified (schema.md §1) and which the mockup renders verbatim.

---

## Visual Direction

Calm and data-forward — a wall-calendar's twelve pages rendered in SnowRaven's
restrained voice. The green does the talking: a deep, single-hue ramp turns a
year of birding into a shape you can read at a glance (busy spring migration
darkens, quiet mid-summer thins out, a December CBC day goes near-black). Color
is the only saturated element on the page; everything else is the app's usual
neutral surfaces, muted labels, and one accent. Nothing is decorative for its
own sake. The feeling on first open should be quiet recognition — "that's my
year" — not a dashboard demanding attention.

---

## Screens / Views

The tab is one scrolling panel (`.sr-panel`, the app's 1280px centered cap) with
a house header, a control strip, a view label + legend row, and the twelve-month
grid. The alternate modes (Textures, All years, and the Year-Overview density)
share that exact chrome. In the mockup four showcase sections are shown stacked
and labeled (color, textures, all-years, Year Overview) so the reviewer sees them
at once; in the shipped tab they are one grid whose appearance is driven by the
controls (the metric, year, View-density, and Textures toggles are all live in
the mockup and actually switch the top grid).

### House header
The standard tab header: a 30px `--sr-accent-bg` rounded tile holding a Lucide
`calendar-days` icon in `--sr-accent`, an h2 "Calendar" (1.125rem / 700 /
-0.01em), and a one-line muted description — *"A year of your birding as twelve
month grids — each day shaded by how much you saw, with a click into the
checklists behind it."* Identical construction to Checklists' header.

### Control strip
A single `--sr-surface-faint` band (1px `--sr-border-subtle`, 10px radius) laid
out as **two stacked rows**: a **primary controls row** on top and a
**low-emphasis settling row** beneath it.

**Primary controls row** (`12px 16px` padding, one graceful wrapping flex row):

- **Show** — the shared `SegControl` (pill-in-tray on `--sr-surface-subtle`,
  active pill on `--sr-surface` with `--sr-border`), options **Species | Checklists**,
  Species selected by default. Each option carries `aria-pressed`.
- **Year** — a compact navigator: a ‹ prev button, the year label (0.9375rem /
  700, tabular-nums), a › next button (both 30px square, `--sr-border`,
  disabled at the ends of the data range), and an **All years** pill (15px-radius,
  the app's filter-pill shape; accent-active state via `--sr-accent-bg` +
  `--sr-accent-border-strong` when combined mode is on).
- **View** — a second `SegControl` for the **view density**: **Months | Year**
  (each option an icon + label — a grid glyph for Months, a 2×2-square glyph for
  Year — carrying `aria-pressed`). **Months is the default** (the big-month
  layout); **Year** switches the whole grid to the 3×4 mini-month Year Overview
  (see that screen above). A flex spacer pushes View + Use Textures to the right.
- **Use Textures** — the shared `ToggleSwitch` (`role="switch"`, accent track
  when on), default OFF, at the right end of the primary row.

These four keep to **one clean line** on desktop and wrap gracefully as the
viewport narrows — verified single-line at 1280px and 1024px, stacking to their
own rows on a phone, with no overflow and no orphan wrapping.

**Settling row** (its own full-width line below the primary row, a `--sr-surface-subtle`
fill, a 1px `--sr-border-subtle` top rule, `9px 16px` padding, bottom-rounded):
the **"Count spuh, slash & hybrids"** small `ToggleSwitch` followed inline by its
caption *"Spuh / slash / hybrid forms aren't countable species; off by default."*
This row reads as a low-emphasis refinement of the Species count — deliberately
separated from the primary controls so it never pushes them around. It is
de-emphasized (≈45% opacity) and made inert whenever Checklists is the active
metric (see the "Include non-countable forms" screen below).

On a phone the primary groups stack onto their own rows and the settling row
follows at the bottom of the header block (verified at 320–375px) with no
overflow.

### View label + legend row
A left-aligned label block (the active year or "All years" in 1rem / 700, plus a
muted sub-line naming the metric and days birded) and, on the right, the legend:
a **contiguous ramp bar** of the five `--sr-cal-*` tiers with the overall low and
high counts labeled beneath (`8 … fewer → more … 71`), plus two small keys — a
transparent faint-bordered swatch for **no birding** and a `--sr-surface-subtle`
"0" chip for **birded · 0 countable**. The per-tier count range is available as a
swatch tooltip so the ramp stays uncrowded. The legend's title labels its unit
for the active metric/view (never a bare number): *Species / day*,
*Checklists / day*, *Species ever recorded*, *Checklists across all years*.

### The twelve-month grid
A self-collapsing container (`.sr-grid-auto`-style `auto-fill minmax(min(230px,
100%), 1fr)`) so the twelve month cards tile 4–5 across on desktop and stack to
one column on a phone with no breakpoint math. Each month is a `SectionCard`-style
tile (`--sr-surface`, 1px `--sr-border`, 12px radius, `--sr-card-shadow`) with:

- a month name (0.8125rem / 700, -0.01em),
- a Sunday-first weekday header row (single-letter, `--sr-text-gray`, 0.5625rem
  uppercase),
- a 7-column day grid with correct leading blanks.

**Three day-cell states, all visually distinct (verified in the mockup):**

1. **Data day** — a rounded square filled with `var(--sr-cal-{tier})`, the count
   centered in **white** (`--sr-cal-fg`, 0.6875rem / 600, tabular-nums). A real
   `<button>`; hover brightens slightly; visible `--sr-accent` focus ring.
2. **No-data day** — transparent fill (shows the card surface) with a faint 1px
   `--sr-border-subtle` outline, no number, non-interactive, not a tab stop.
3. **Present-but-zero data day** (Species metric, birded but only spuh/slash/
   hybrid) — `--sr-surface-subtle` fill with a muted "0" (`--sr-text-muted`).
   Interactive — it opens its popup — and clearly not a green data tier.

### Colorblind mode (Use Textures ON)
Each data tier becomes a **45°/135° crosshatch** whose density rises with the
tier (line spacing tightens 9→3px, weight 1.0→1.8px across tiers 1–5), over a
faint 0.12-alpha tier-color underlay so a residual hue cue remains. Rendered as
two stacked `repeating-linear-gradient`s reading the `--sr-cal-N-rgb` tokens —
so it follows the theme automatically, no sprites, no observer. The day number
sits on a small solid backing chip so it stays legible over the sparse tier-1
lattice. The legend swatches switch to matching density swatches from the same
spec, so legend and cells can never drift. (Verified in the mockup: the density
progression is legible without relying on hue or brightness.)

### All years combined
Every year folded into one twelve-month grid keyed by month-and-day. **February
always carries a Feb 29 cell** (aligned to a fixed reference year for stable
weekday columns; verified rendering 29 day-cells). Species counts are a
**distinct-species union** across years ("how many different birds have I ever
recorded on this date"); checklists are a **sum**. The legend and the day popup
both label which is which so the two are never conflated.

### Include non-countable forms ("Count spuh, slash & hybrids") — NEW, additive requirement

A `ToggleSwitch` (styled exactly like "Use Textures"; a small variant) that
governs whether **non-countable forms — spuh (`… sp.`), slash (`A/B`), and
hybrids (`A x B`) — are counted as distinct species in the Species metric.** It
lives on its own **settling row at the bottom of the control strip**, below the
primary controls, as a low-emphasis refinement (see the Control strip above) —
placed there so it never pushes the primary controls around.

- **Default OFF** — non-countable forms are *not* counted as separate species.
  This is the app's canonical life-list rule (`isNonCountableSpecies`,
  `lib/speciesUtils.ts`) and matches the base FR-10 behavior. With it OFF, a day
  whose *only* extra records are spuh/slash/hybrid has Checklists ≥ 1 but
  countable Species = 0 — the **present-but-zero "0"** cell.
- **ON** — each distinct spuh/slash/hybrid name counts toward that day's Species
  number. Turning it on **raises some day counts**, so the Species grid
  **re-tiers/re-shades** relative to the new range, and a former "0" day now shows
  a real number and takes a data tier (it is no longer present-but-zero). The
  legend endpoints and ramp update accordingly.

**Species metric only.** The Checklists count is completely unaffected — a
checklist counts as one outing regardless of whether its species are countable
(base FR-11). So the toggle is **only relevant when the Species metric is
active**: when Checklists is the active metric the whole settling row is
**de-emphasized (≈45% opacity) and made non-interactive** (`aria-disabled="true"`,
`tabindex="-1"`, `pointer-events:none`, and an early-return guard so a stray
activation is ignored).

**Caption / help.** A one-line caption sits inline beside the switch (wrapping
beneath it on narrow widths) to keep the meaning clear:
*"Spuh / slash / hybrid forms aren't countable species; off by default."* When
the toggle is ON, the view sub-line appends *", spuh/slash/hybrids included"* and
the day popup's species stat is labeled *"species (incl. forms)"* with a small
qualifier line, so the number's meaning is never ambiguous.

**Popup consistency.** The day popup's **species** count reflects the toggle (the
checklist count does not). In the real tab the derivation keeps both a
countable-species set and a full-forms set per day so the toggle re-reads without
re-parsing; the mockup demonstrates the behavior with a deterministic per-day
forms count. Session-only `useState` (no persisted setting), both themes, tokens
only. (Live in the mockup: flipping it raises the visible day numbers, clears the
"0" cell, re-tiers the grid, and updates the legend/sub-line; it greys out under
the Checklists metric.)

### Year Overview (density = "Year") — NEW, additive requirement

A second **view density** for the whole grid, chosen by a "Months | Year" toggle
in the control strip (see below). Where "Months" is the big-month layout described
above, **"Year"** renders all twelve months as small heatmap thumbnails in a
**3-column × 4-row grid** — the year-at-a-glance / back-of-a-wall-calendar view.
**"Months" remains the default.** This applies to the current view (a specific
year *or* All years combined) — it is a density choice orthogonal to the metric,
year, textures, and combined selections, all of which still apply.

Each **mini-month** is a card (`--sr-surface`, 1px `--sr-border`, 12px radius,
`--sr-card-shadow`) containing:

- a small month label (0.8125rem / 700) and, on hover/focus, a muted-accent
  **"Open →"** affordance that fades in;
- a compact 7-column Sunday-first mini weekday grid (2px gaps) where each day is a
  tiny cell (~7–10px, `aspect-ratio:1/1`, 2px radius).

**Day numbers are dropped at this size — the shading is the entire signal**, so
the year's rhythm reads in a single glance (dark spring migration, thin
mid-summer, the December spike). The three cell states are preserved but
number-free:

- **Data day** — filled `var(--sr-cal-{tier})`, same 5-tier ramp as the big view.
- **No-data day** — transparent with a faint 1px `--sr-border-subtle` outline
  (kept visually distinct so gaps in the year still read).
- **Present-but-zero** — `--sr-surface-subtle` fill (a `title` tooltip carries the
  "birded, 0 countable" meaning since there's no room for a "0").

**Texture mode is honored here too.** A full 45°/135° crosshatch would clog a
~7px cell, so the mini-cell uses a **simplified single-direction (45°) hatch**
whose spacing still tightens monotonically with the tier (gap 5→2px, weight
1.0→1.2px across tiers 1–5) — the density signal survives at thumbnail scale
without the crosshatch turning to mud. This is a deliberate, logged simplification
of the big-view crosshatch for the small cell; the **monotonic density curve is
preserved** (and remains guardable by the same `density(tier)` monotonic test the
big view's `CAL_HATCH` uses — the Engineer sources the mini spec from the same
shared table so the two can't diverge). Verified in the mockup: the simplified
hatch reads clearly light→dark at 3-up desktop scale, in both themes.

**Interaction:**
- **Click a mini-month** → switch density back to "Months" and scroll/focus that
  month's big card into view (the primary click-to-expand affordance; live in the
  mockup — clicking a thumbnail flips to Months and scrolls to the month).
- **Click an individual tiny day** (nice-to-have) → open the same `DayPopup` for
  that day. In the mockup the mini-month-level click-to-expand is wired; per-day
  activation in the Year density is a small extension the Engineer can add with the
  same `openPopup` handler used by the big cells.
- The mini-month card is a real `<button>` (keyboard-reachable, visible focus ring,
  `aria-label="Open {Month} in the month view"`); its inner day cells are
  presentational (`title` tooltips) unless the per-day popup extension is built,
  in which case they become buttons like the big view.

**Legend / controls:** the metric toggle, year navigation, All years, Use Textures,
and the shade legend all apply unchanged in the Year density — the legend still
labels its unit and shows the ramp. (There is simply no per-cell number to read, so
the popup/legend carry the exact counts, keeping WCAG 1.4.1 satisfied.)

**Responsive:** the 3×4 grid collapses via the app's responsive-class approach
(`grid-template-columns` lifted to a class, not inline) — **3-wide on desktop → 
2-wide at ≤1024px → 1-wide at phone width**. Verified: no page horizontal-scroll
leak at 320px; mini-months tile 3/2/1 per row at desktop/tablet/phone.

### Day popup
Clicking a data day opens one popup at a time (`z-index: 1200`, backdrop scrim),
styled like the app's overlays (`--sr-surface`, 1px `--sr-border`, 14px radius,
`--sr-card-shadow`):

- **Header** — the formatted date (pref-aware `formatDate` in the real tab), a
  Close button (Escape / Close / backdrop all close and restore focus to the
  activating cell).
- **Both counts** — two `--sr-surface-subtle` stat tiles showing **species** and
  **checklists** regardless of the active grid metric, the number in
  `--sr-accent` (1.375rem / 700). In combined mode the labels read "species ever
  recorded" (union) and "checklists across years" (sum).
- **Checklist list** — one row per checklist rendered through the shared
  `ChecklistLink` signature: an accent checklist glyph, the hotspot name in 600,
  a muted meta line (time · submission id, or the date in combined mode), and a
  trailing external-link glyph. Combined mode adds a per-row year chip and lists
  across years, newest first.

---

## Component Usage

| Element | Reused component / pattern |
|---|---|
| Tab house header | 30px accent-bg icon tile + h2 + muted sub (Checklists.tsx) |
| Metric toggle | `SegControl` (`map/MapSidebarUI.tsx`), `aria-pressed`, `ariaLabel="Day metric"` |
| View density toggle | a second `SegControl` (Months \| Year, icon + label), `aria-pressed`, `ariaLabel="View density"` |
| Count spuh/slash/hybrids | `ToggleSwitch` (small variant) on its own settling row at the bottom of the control strip, `role="switch"`, inline caption; Species-only (disabled under Checklists) |
| Non-countable predicate | `isNonCountableSpecies` (`lib/speciesUtils.ts`) — the same life-list rule, gated by the toggle |
| Use Textures | `ToggleSwitch` (`ui/ToggleSwitch.tsx`), `role="switch"` |
| Year / All years pills | filter-pill shape (30px / 15px-radius, accent-active), Checklists precedent |
| Month cards (Months) | `SectionCard` surface treatment (radius, border, `--sr-card-shadow`) |
| Mini-month cards (Year) | same `SectionCard` treatment, `<button>`, hover "Open →"; 3×4 grid |
| Day-shade ramp | NEW `--sr-cal-1..5` + `--sr-cal-fg` tokens (schema.md §1) |
| Crosshatch (big cells) | DOM `repeating-linear-gradient` 45°+135°, density from the shared `CAL_HATCH` spec |
| Crosshatch (mini cells) | simplified single-direction 45° hatch, same monotonic density source |
| Legend | contiguous ramp bar + endpoint labels; unit-labeled title (`COUNTY_METRIC_META` precedent) |
| Day popup | app overlay pattern (scrim, focus-restore, `z-index:1200`) |
| Checklist rows | `ChecklistLink` (`components/ChecklistLink.tsx`) — never a hand-rolled anchor |
| Responsive grids | month grid: self-collapsing `auto-fill minmax(…)`; Year Overview: 3-col grid collapsing 3→2→1 by breakpoint |
| Icons | Lucide — `calendar-days`, chevrons, grid/`layout-grid`, `check-square`, `external-link`, arrow-right, close |

No new dependency, provider, or library is introduced. Maps/maplibre are not
touched (the tab is lazy-loaded and map-free, per FR-43).

---

## Design Tokens Applied

**Structural / text / border / accent** — the standard palette from
`globals.css`, both themes: `--sr-bg`, `--sr-surface`, `--sr-surface-subtle`,
`--sr-surface-faint`, `--sr-text`, `--sr-text-muted`, `--sr-text-gray`,
`--sr-border`, `--sr-border-subtle`, `--sr-border-medium`, `--sr-accent`,
`--sr-accent-bg`, `--sr-accent-border-strong`, `--sr-card-shadow`.

**Day-shade ramp (new, in both `:root` and `[data-theme="dark"]`, identical
values by design):**

| Tier | Fill | White-number contrast |
|---|---|---|
| `--sr-cal-1` | `#357E56` | 4.92:1 |
| `--sr-cal-2` | `#2A6847` | 6.63:1 |
| `--sr-cal-3` | `#205238` | 9.03:1 |
| `--sr-cal-4` | `#163D29` | 12.11:1 |
| `--sr-cal-5` | `#0C271A` | 15.90:1 |
| `--sr-cal-fg` | `#FFFFFF` (on-cell number) | — |

Each tier ships a `-rgb` triplet (the crosshatch reads these). The white number
clears 4.5:1 on **every** tier in **both** themes (min 4.92:1 at tier 1 — verified
in the rendered mockup), and adjacent tiers clear the 1.2:1 legibility floor.
This is why the design does NOT reuse the `--sr-county-*` ramp — that ramp's
light top tiers cannot carry on-fill text at AA (schema.md §1 proves the dead
zone at county tier 7). The present-but-zero pair (`--sr-text-muted` on
`--sr-surface-subtle`) and the legend text (`--sr-text` on `--sr-surface`) both
pass AA in both themes.

Typography uses the three established roles: **headline** (1.125rem / 700 /
-0.01em, the tab h2 and view label), **body** (0.8125rem / 1.5, the description
and popup rows), **label/caption** (0.75rem control labels at 600; 0.6875rem
uppercase legend/section kickers; 0.5625–0.625rem weekday and endpoint
micro-labels) — meaningful size and weight contrast between each.

---

## Interaction Notes

Beyond the static layout, the Engineer implements:

- **Metric toggle** re-labels every cell, re-tiers/re-shades the whole grid
  relative to the active view, and updates the legend title/ranges — with no
  loss of the selected year/combined view. Switching to Species re-enables the
  "Count spuh, slash & hybrids" sub-toggle; switching to Checklists disables it.
  (Live in the mockup.)
- **Count spuh, slash & hybrids toggle** (Species metric only, **default OFF**)
  re-derives the Species count with/without non-countable forms, then
  **re-tiers/re-shades the whole Species grid** and updates the legend endpoints;
  a former present-but-zero "0" day becomes a real numbered data cell when ON. The
  day popup's species count and the view sub-line reflect the state. The Checklists
  count is never affected, and the toggle is greyed + inert under the Checklists
  metric. Session-only `useState`. (Live in the mockup — flipping it visibly
  raises the day numbers, clears the "0" cell, and re-tiers.)
- **View density toggle (Months | Year)** switches the whole grid between the
  big-month layout and the 3×4 mini-month **Year Overview**, with no loss of the
  metric / year / combined / textures selections. Default **Months**. Session-only
  `useState` like the other calendar controls (no persisted setting). (Live in the
  mockup — the toggle actually switches the rendered view in the browser.)
- **Mini-month click-to-expand** — clicking a Year Overview thumbnail switches
  density back to **Months** and scrolls/focuses that month's big card into view.
  (Live in the mockup.) Clicking an individual tiny day to open the day popup is a
  small nice-to-have extension using the same `openPopup` handler.
- **Use Textures** swaps every data cell and every legend swatch to the density
  crosshatch and back, in **both** densities (the big view uses the full 45°/135°
  crosshatch; the Year Overview uses a simplified single-direction hatch tuned for
  the tiny cell, same monotonic density source), and persists across metric/year
  switches. (Live.)
- **Year prev/next** move to the previous/next year *that has data* (skipping gap
  years) and disable at the ends of the range. **All years** switches to the
  combined grid. (Buttons are present in the mockup; the skip/disable logic is
  the pure `adjacentDataYear` in the real tab.)
- **Day cells are real `<button>`s**, Tab-reachable with a visible focus ring,
  Enter/Space-activatable; no-data cells are not tab stops.
- **Day popup** opens on activate, shows both counts + the ChecklistLink rows,
  and closes via Escape / Close / backdrop through one path that restores focus
  to the activating cell. Only one popup open at a time. (Live in the mockup.)
- **Both themes** are correct — a light/dark toggle in the mockup demonstrates
  the deep ramp and white numbers hold in both (the contrast decision is
  theme-sensitive and was validated live).
- **Responsive** — at 375px/320px the control strip stacks (all four groups onto
  their own rows), the legend wraps, the big months collapse to one column, and
  the Year Overview collapses **3-wide → 2-wide (≤1024px) → 1-wide (phone)**; day
  cells grow toward comfortable touch targets, and there is no page
  horizontal-scroll leak at 320px (verified for both densities).

---

## Content Notes

Copy is informative, never promotional — the SnowRaven voice. The description
frames the tab as reading *your own* birding year. Sample content in the mockup
is realistic throughout: believable species-per-day counts that ebb and flow
with the seasons (busy April/May migration, sparse July/August, a mid-December
CBC spike), real-looking hotspot names (Presqu'ile Provincial Park, Point Pelee
NP—Tip, Long Point—Old Cut, Reifel Migratory Bird Sanctuary), and valid-shaped
eBird submission ids (`S…`). No lorem ipsum, no placeholder names. The legend and
popup wording carries the honest distinctions the PRD requires — "no birding" vs
"birded · 0 countable," and combined-mode "ever recorded" (union) vs "across all
years" (sum) — so the meaning of every number is unambiguous.
