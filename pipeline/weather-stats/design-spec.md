# Design Spec — Weather Stats

**Feature:** weather-stats
**Stage:** 4 — The Designer
**Approved:** 2026-09-07 ("Looks great, lets build it.")
**Amended:** 2026-09-07, after the user saw the build against their real export.
The per-species chart's scaling was overturned; see *The per-species chart's
scaling*. The picker moved to a full-width `panel`-size row, settled by
measurement during the build. Everything else stands as approved.
**Mockup:** `pipeline/weather-stats/design.html` (live: theme, text-size and width
controls all re-render it; the picker really filters)

This spec is written to be built from without the Designer in the room. Where it
records a decision rather than a look, the reason is with it, because the reason
is what tells you whether a change later is safe.

---

## Visual Direction

Quiet utility, extended rather than reinvented. The section is a new
`SectionCard` that must read as though it has always been on the Statistics tab:
the same card chrome, the same uppercase micro-labels over `.sr-action-row`
denominators, the same 32px two-segment ratio bar the Data Quality card one
position above already uses for its coverage claims, the same 8px rails. It
introduces no new token, no new colour, and no new component library surface.

The register is *evidential*, not analytical. Every figure states what it counts
and how many things are behind it, in text, before any bar draws. The bars are
reinforcement; the numbers are the content. Nothing in the section predicts,
ranks, or recommends, and the palette holds one accent (`--sr-accent`, for the
count bars and the single route link) against one chart neutral
(`--sr-chart-slate`, for the duration lane and the coverage remainder), so
nothing competes for the eye except the figure being read.

---

## Screens / Views

The section is **one** `SectionCard title="Weather"` placed immediately after
Data Quality, in its own file `frontend/src/components/WeatherStatsSection.tsx`
(FR-30). It has three whole-section states, decided by the single
`weatherSectionState(s)` discriminator (schema §3.1) which gates **both** the
card and the jump-nav entry so FR-16 cannot half-happen.

### State `absent` — zero found blocks

**Nothing renders.** No card, no jump-nav pill. This is the approved answer to
OQ-01 and it is a decision, not a default: it matches the shipped behaviour one
card up (Data Quality's own weather bars do not draw at zero) and the shipped
conditional `Media` nav entry, and a jump-nav pill leading to a single sentence
is a cost every user pays forever.

The stated cost of OQ-01 (a zero user gets no route to the backlog from
Statistics) is paid down a different way: **the route line renders in the `full`
state too**, not only below the floor. Everybody who has any readable block at
all gets the loop; only the true-zero user does not, and the Weather tab is
where they would create their first block anyway.

### State `below-floor` — 1 to 4 readable blocks (`< WEATHER_SECTION_MIN_READABLE`)

Card head, then two paragraphs and the route button. No chart, no average, no
picker, no distribution.

```
[CloudSun] Weather
────────────────────────────────────────
You have 3 checklists with a readable weather block. That is not
enough to chart yet.                                    (.sr-body)

Every figure here is about the checklists that carry a weather      (.sr-note)
block SnowRaven or RainCrow wrote, so filling in more blocks is
what sharpens it.

Fill in the gaps on the Weather tab  →                  (.sr-wx-route)
```

### State `full` — the section proper

Five blocks separated by the shipped `Divider`:

#### 1. Coverage, before any chart (FR-14, FR-15)

Wrapper `.sr-wx-cov` (flex column, gap 10px).

- `.sr-action-row`: `<SubLabel>Checklists with a weather block</SubLabel>` on the
  left, and on the right `.sr-denom` reading `<b>25%</b> · 301 of 1,214`.
- The 32px two-segment ratio bar, `aria-hidden`, reusing the Data Quality inline
  shape exactly: `height 32, borderRadius 4, overflow hidden, display flex`, the
  first segment `width: {readable/total}%` on `--sr-accent`, the second
  `flex: 1` on `--sr-chart-slate`. The percentage lives in the header row above
  because neither segment can carry AA-contrast in-bar text (the shipped F032
  note).
- `.sr-body` sentence, FR-14 and FR-15 verbatim.
- The route button (below).

#### 2. Your outings by weather (FR-21, FR-23)

`<SubLabel>Your outings by weather</SubLabel>`, then one `.sr-note` naming the
three-denominator situation, then four groups. Each group is
`.sr-action-row` (SubLabel + its own denominator) → `.sr-wx-rows` → a `.sr-note`
footnote.

| Group | Rows | Denominator label |
|---|---|---|
| By sky | 11, always all 11 | `<b>298</b> with a sky condition` |
| By temperature | 7, always all 7 | `<b>294</b> with a temperature` |
| By wind | 9, always all 9 | `<b>289</b> with a wind reading` |
| Day and night | 2 | `<b>298</b> with a time of day` |

Day and night are two ordinary distribution rows carrying lucide `Sun` and
`Moon` at 13px in the glyph slot, both on `--sr-accent`, scaled to the larger of
the two. Not a second two-segment bar: the sibling groups above are rows, and a
different chart form for the same kind of fact would read as a different kind of
fact.

#### 3. Species and time out, by weather (FR-24, FR-25, FR-26, FR-27)

`.sr-action-row` carrying `<SubLabel>Species and time out, by weather</SubLabel>`
and, in the right slot, the `.sr-wx-seg` axis toggle. Then the FR-27 confound
sentence, then the legend, then `.sr-wx-bands`.

**One chart with a Temperature / Sky toggle, not both stacked.** Both axes are
one press apart, and stacking them makes the section roughly 700px taller and
invites reading across two band systems that share no scale. Default axis is
`temp`. State is session-only (`useState`), matching the tab's other view
toggles; it resets on relaunch and needs no storage seam.

#### 4. One species, its weather (FR-28)

`<SubLabel>One species, its weather</SubLabel>`, then `.sr-wx-pick` — a
**full-width block** holding the `SpeciesCombobox` at the `panel` size, with the
readout **below** it, not beside it. This was a two-column grid with the picker
at `sm` until the build measured the result: at that column width the common
name and the scientific name were both being cut. Settled by measurement; not up
for revision.

**The build's default is nothing selected**, showing the rest state. The mockup
defaults to Ruby-crowned Kinglet only so the populated view is visible on open;
do not carry that default into the build.

With a species selected, below the picker: the `.sr-wx-lede` readout, then one
`.sr-note` carrying the confound sentence, then `.sr-wx-pair`
(`repeat(auto-fit, minmax(240px, 1fr))`) holding the By sky group and the By
temperature group side by side, collapsing to one column when the card narrows.

#### 5. The route line

One `<button class="sr-wx-route">`, in both the `full` and `below-floor` states.
See *Interaction Notes* for the callback and *Content Notes* for the copy rule
that governs its wording.

---

### Condition ordering — the rule, not just the result

`CONDITION_EMOJI` is the wire contract and is pinned in `conditionEmoji()`'s own
branch order. **Display order is different and is a deliberate design choice**;
rows carry `index` explicitly (schema §3.1) so the component sorts on read and
`species.byCondition[i][j]` alignment is untouched.

**Order rows by sky clarity, clearest first, foulest last, with `🌡️` pinned
last as the residual.** That is how a birder describes a day, and it makes the
chart a gradient instead of an arbitrary list. The residual pin follows the
shipped Share-breakdown rule (the "none of the above" row is pinned last so it
reads as a different kind of row without relying on colour alone).

| Display position | Glyph | `CONDITION_EMOJI` index | Label |
|---|---|---|---|
| 1 | `☀️` | 5 | Clear |
| 2 | `🌤️` | 6 | Few clouds |
| 3 | `⛅` | 7 | Scattered clouds |
| 4 | `🌥️` | 8 | Broken clouds |
| 5 | `☁️` | 9 | Overcast |
| 6 | `🌫️` | 4 | Fog |
| 7 | `🌦️` | 1 | Drizzle |
| 8 | `🌧️` | 2 | Rain |
| 9 | `❄️` | 3 | Snow |
| 10 | `⛈️` | 0 | Thunderstorm |
| 11 | `🌡️` | 10 | Other |

Build the display order as an explicit array of `CONDITION_EMOJI` indices in the
component, and derive the row order from `row.index`, never from array position.

### The `🌡️` group

`🌡️` is `conditionEmoji()`'s **fallback for an OpenWeather condition id outside
the documented ranges**. It is a real value the formatter wrote into a real
block. It is **not** a parse failure and **not** a missing field (missing is
`null`, and `null` is excluded from the axis denominator entirely).

- Its label is **`Other`**. The strings "Unknown", "Unknown weather",
  "Unrecognised", "Error" and "Could not read" are forbidden on this row.
- It carries the sky group's footnote, which explains it in the user's terms and
  states that the block's other fields still count:

  > A checklist is grouped by the sky glyph in its own block, not by the weather
  > service's wording. **Other** is the glyph SnowRaven writes when the service
  > returns a sky code it has no category for; the temperature and wind in those
  > blocks still count everywhere else on this card.

### A ZERO band and a THIN band must not look alike

This is the flag that most needs to survive into the build. Three states exist
and each has its own shape *and* its own sentence. Never reuse one treatment for
another; in particular, never render a thin band as an almost-empty rail, and
never render a zero band as a very short filled one.

**In the distribution rows (block 2):**

| State | Rail | Count column | Label |
|---|---|---|---|
| `n > 0` | `.sr-wx-track` solid, `.sr-wx-fill` at `n/max`, **`min-width: 3px`** | `<b>96</b> · 32%` | `--sr-text` |
| `n === 0` | `.sr-wx-track.is-empty`: **no fill, transparent background, `1px dashed var(--sr-border-medium)`** | `<b>0</b> · 0%`, both muted | `--sr-text-muted` (`.is-zero`) |

The `min-width: 3px` on the fill is load-bearing: without it a count of 2 in a
298-checklist axis paints sub-pixel and renders as the same nothing a zero band
renders. So is the percentage floor: a non-zero share that rounds to zero prints
**`<1%`**, never `0%` (the band below freezing really does hold one outing).
This is the shipped Share-breakdown's 0.1%-floor idea at whole-percent
resolution.

**In the band blocks (block 3):**

| State | Test | Rendering |
|---|---|---|
| Full | `n >= WEATHER_BAND_MIN_TO_SHOW` and `durationCount >= WEATHER_BAND_MIN_TO_SHOW` | Head + two `.sr-wx-lane` rows (species bar, then duration bar), each with its figure |
| Thin durations | `n >= 8`, `avgDurationMin === null` | Head + the species lane + `<p class="sr-wx-thin">Only 5 of these have a recorded time, too few to average.</p>` and **no second rail at all**. An empty rail here would be the zero-band treatment, which means something else. |
| Thin band | `0 < n < 8` | Head + `<p class="sr-wx-thin">Too few to average.</p>`. **No lanes.** The band still appears (FR-26). |
| Zero band | `n === 0` | Head (label and count muted via `.is-zero`) + `<p class="sr-wx-none">No outings in this condition.</p>` / `"…in this band."` per axis. **No lanes.** |

`.sr-wx-thin` is italic; `.sr-wx-none` is upright. That is a second, non-colour
cue separating "you have, and it is too few" from "you never have".

**In the per-species rows (block 4)** the two zeros recur one level down and are
again distinguished. See the next subsection for the scaling they sit on.

| State | Rail | Count column | Reference column |
|---|---|---|---|
| Band has outings, species found | Full-width solid track, fill at `count / maxSpeciesCount`, `min-width: 3px` | `<b>19</b> · 25%` | `outings 32%` |
| Band has outings, species never found | The same full-width solid track, **no fill element at all** | `<b>0</b> · 0%` | `outings 9%` |
| Band has no outings at all | `.sr-wx-track.is-empty`, full width, dashed, `.is-zero` on the row | `no outings` (no numeral, no share) | *(empty)* |

"0 · 0%, outings 9%" is a real and interesting fact about the bird (twenty-seven
warm outings, never this species). "no outings" is a fact about the birder. They
must never render alike.

**There is no THIN state in this chart, and that is deliberate.**
`WEATHER_BAND_MIN_TO_SHOW` gates *derived averages*, and this chart derives
nothing: a count of one is a fact, not an estimate. Do not "restore consistency"
by hiding or muting rows below the floor here. The floor applies to block 3 only.

### The per-species chart's scaling

**Superseded 2026-09-07 by the user, on live data. Do not restore the previous
treatment.** The record of what changed and why is kept because the rejected
design is the one a reader would otherwise reinvent.

Previously the rail was the outings in the band and the fill was the ones
carrying the bird, so both series sat on one axis and the fraction was legible as
geometry. The objection it was built to answer is real: a species-only
distribution partly redraws where the user birds. But real data settled it the
other way. Against a population of hundreds of outings, anything the user has not
seen dozens of times renders as a sliver on a huge rail; the user's own example
was **"1 of 395 and a tiny bar"**. A chart that carries no information at the size
a person actually reads it is not saved by being technically well-founded.

**The bar is the bird's own record, scaled to the bird's largest band in that
axis.** The largest band always fills the track and every other band is legible
against it.

- Scale to `max(count)` over the species' own counts for that axis, **not** to
  the species' total. Scaling to the total makes every bar small again the moment
  a bird is spread across eleven conditions, which is the failure this change
  exists to fix.
- Each of the two groups scales to **its own axis's** maximum. Never a maximum
  shared across the sky and temperature groups.
- This is now **the same chart form and the same scaling rule as the distribution
  chart at the top of the card**, so the two are read in identical units and the
  shapes are directly comparable. That equivalence is load-bearing; keep it.

### Solving the misreading, inside the change

The trap the old treatment was built for is still live: a species-only
distribution can be read as a claim about the bird's preference when it partly
reflects where and when the user was out. The overall distribution is on the same
card but at the top of it, which on a phone is a long scroll away, so "the
comparison is available to the eye" is not by itself enough. It is solved two
ways, both cheap, and both are required:

1. **One sentence, above the pair**, in the section's own voice. This is the same
   move FR-27 makes for the effort confound one block up, which is the precedent
   the user has already approved:

   > This is where {Species name} turned up, so it reflects when you were out as
   > well as the bird. Each row carries its share of the bird's records, then the
   > same band's share of all your outings.

2. **A per-row reference figure**, `.sr-wx-ref`, muted at 0.625rem, carrying the
   same band's share of **all** the user's outings on that axis. It is what makes
   the sentence checkable per band with no scrolling. On the reference export
   this is immediately legible and true: 45 to 54°F is 43% of Ruby-crowned
   Kinglet's records against 24% of the outings, and 65 to 74°F is 7% against
   21%.

A no-outings row carries **no** reference figure: "outings 0%" only repeats what
"no outings" already said.

The section still prints **no rate**. Two shares of two different wholes sit side
by side, each named; nothing divides one by the other.

### The three denominators, and how they are kept from reading as a disagreement

Architect flag 4 named three. The per-species rescale added a **fourth**, and it
gets the same treatment as the other three. None is ever printed bare; each is
printed **with the words that say what it counts**, and they are typographically
identical so none looks authoritative over the others.

| # | Denominator | Where | Exact label |
|---|---|---|---|
| 1 | Coverage `N` of `M` | The `.sr-action-row` above the ratio bar, and again in the FR-14 sentence | `25% · 301 of 1,214`, and "These figures cover the 301 checklists … That is 25% of your 1,214 checklists." |
| 2 | Each axis's own sum | The `.sr-denom` in each distribution group's header row | `298 with a sky condition` / `294 with a temperature` / `289 with a wind reading` / `298 with a time of day` |
| 3 | Each duration figure's own count | Inside the duration lane's own figure | `84 min out · from 103 with a time` |
| 4 | **The species' own axis total** | The `.sr-denom` in each per-species group's header row; it is the basis of every `· 25%` on those rows | `77 of its 78 have a sky condition` / `76 of its 78 have a temperature` |

Denominator 4's label deliberately says **"of its 78"**, naming the species by
the pronoun the lede one line above has already bound, so a skimmer cannot read
77 as an outing count and think it disagrees with denominator 2's 298. The row's
own reference figure is denominator 2 restated per row and is labelled
`outings 32%` in words for the same reason.

Plus one standing sentence, placed once directly under "Your outings by
weather", which is what turns the first three numbers into one explained
situation:

> Each axis counts the readable blocks that carried that field, so the three
> totals differ: a checklist can have a temperature and no wind.

And the confound sentence above the per-species pair, which is what binds
denominator 4 to denominator 2 in the reader's head.

### 320px — the eleven condition bars

This is the hardest part of the layout and the part most likely to be lost in
translation. It is verified in the mockup at 320px and at 200% in-app text
scale, with zero horizontal overflow measured (318px of content in a 318px box
at both scales).

**Desktop (`> 640px`)** — `.sr-wx-row` is a four-column grid:

```css
.sr-wx-row {
  display: grid;
  grid-template-columns: auto minmax(0, 8.5rem) minmax(0, 1fr) auto;
  align-items: center; gap: 0 0.5rem; min-height: 1.375rem; min-width: 0;
}
.sr-wx-row.no-glyph { grid-template-columns: minmax(0, 8.5rem) minmax(0, 1fr) auto; }
```

The label is **left**-aligned, not right-aligned like the shipped `BarRow`,
because a leading glyph already anchors the left edge. `.sr-wx-label` truncates
with an ellipsis at this tier.

**Phone (`@media (max-width: 640px)`)** — the row becomes two lines: identity on
line one, the full-width rail on line two. Nothing ellipsizes; "Scattered
clouds" wraps rather than becoming "Scatte…".

```css
@media (max-width: 640px) {
  .sr-wx-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    row-gap: 0.25rem; padding-bottom: 0.25rem;
  }
  .sr-wx-row > .sr-wx-glyph { grid-area: 1 / 1; }
  .sr-wx-row > .sr-wx-label { grid-area: 1 / 2; white-space: normal; overflow: visible; }
  .sr-wx-row > .sr-wx-count { grid-area: 1 / 3; }
  .sr-wx-row > .sr-wx-track { grid-area: 2 / 1 / 3 / 4; }
  .sr-wx-row.no-glyph { grid-template-columns: minmax(0, 1fr) auto; }
  .sr-wx-row.no-glyph > .sr-wx-label { grid-area: 1 / 1; }
  .sr-wx-row.no-glyph > .sr-wx-count { grid-area: 1 / 2; }
  .sr-wx-row.no-glyph > .sr-wx-track { grid-area: 2 / 1 / 3 / 3; }
  .sr-wx-rows { gap: 0.375rem; }
}
```

Four rules ride with it and each is load-bearing:

1. **Explicit `grid-area` placement, not auto-flow.** A `grid-column: 1 / -1` on
   the track alone leaves the count to be auto-placed somewhere wrong.
2. **`white-space: normal` on the label at this tier only.** The desktop
   ellipsis is right where the label column is bounded; on a phone the label owns
   a whole line and must wrap.
3. **No positive `min-width` anywhere in the section.** This is what keeps the
   section from leaking horizontal page scroll at 320px and 200% text (the
   standing rule from the Named Birds timelines). The one `min-width: 3px` is on
   the bar *fill*, inside an `overflow: hidden` track, so it can never widen the
   row.
4. **The mockup expresses these as `@container (max-width: 640px)`** only so the
   320px frame and the 900px frame can sit live on one page. **The build uses
   `@media (max-width: 640px)`**, the app's own breakpoint.

The same tier also: makes `.sr-wx-seg` full width with the 2.75rem touch
posture; collapses `.sr-wx-lane` to one column (figure under its own bar, so
each bar still sits directly above the number it draws); and lets `.sr-wx-fig`
wrap. `.sr-wx-pick` is already a full-width block at every width.

**The per-species row carries a fifth child and needs its own two grid rules.**
`.sr-wx-row--sp` adds a `.sr-wx-ref` column. On desktop it is its own trailing
column so every reference figure aligns down the group. At the phone tier it
takes a **third line** of its own:

```css
.sr-wx-row--sp          { grid-template-columns: auto minmax(0, 8.5rem) minmax(0, 1fr) auto auto; }
.sr-wx-row--sp.no-glyph { grid-template-columns: minmax(0, 8.5rem) minmax(0, 1fr) auto auto; }

@media (max-width: 640px) {
  .sr-wx-row--sp                    { grid-template-columns: auto minmax(0, 1fr) auto; }
  .sr-wx-row--sp > .sr-wx-ref       { grid-area: 3 / 1 / 4 / 4; padding-left: 0; }
  .sr-wx-row--sp.no-glyph           { grid-template-columns: minmax(0, 1fr) auto; }
  .sr-wx-row--sp.no-glyph > .sr-wx-ref { grid-area: 3 / 1 / 4 / 3; padding-left: 0; }
}
```

The third line is not cosmetic. Measured at 320px and 200% text: with all three
figures on the identity line the count column takes about 187 of 292 available
pixels and the label is left with roughly 49px, which wraps "Scattered clouds"
into four-character fragments. On its own line the reference costs one short
muted line per row and the label keeps its width. Verified rendering at that
size.

---

## Component Usage

| Component | Use |
|---|---|
| `SectionCard` (`components/statsPrimitives.tsx`) | The one card. `title="Weather"`, `icon={<CloudSun size={16} />}`. No `action` slot. |
| `SubLabel` (same file) | Every group heading, unchanged. |
| `Divider` (same file) | The four separations between blocks. |
| `SpeciesCombobox` (`components/SpeciesCombobox.tsx`) | The species picker. **`size="panel"`** (34px box, 0.8125rem, radius 6, full width), on a full-width row of its own with the readout below. `allLabel="All species"`, `placeholder="All species"`, `ariaLabel="Filter by species"`. Options limited to species on at least one readable-block checklist (FR-28), sorted upstream. Do not build a new picker, and do not put it back at `sm`: the `sm` register's 220px cap was measured cutting both the common and the scientific name. |
| `BirdName` | The selected species' name in the readout lede only. **Never inside the combobox rows** — the shipped picker renders escaped plain text there by design. |
| `.sr-action-row` (globals.css) | Every label-plus-denominator header row. |
| `.sr-truncate`, `.sr-touch-target` | As shipped. |
| Lucide | `CloudSun` 16 (the card icon, already the app's weather glyph in `WeatherTideSection.tsx`), `Sun` / `Moon` 13 (day and night rows), `ArrowRight` 13 (the route line). Nothing else. |

**`BarRow` is deliberately NOT used and `statsPrimitives.tsx` is NOT modified.**
The section owns `.sr-wx-row` instead. `BarRow` right-aligns its label, has no
glyph slot, and cannot stack at the phone tier without changing how it renders
on the six shipped surfaces that already call it. Adding a prop to a component
rendered by Data Quality, Media and Breeding Stats to serve one new section is a
worse trade than one new class. `.sr-wx-row` is visually identical to `BarRow` at
the desktop tier apart from the glyph column and the label alignment.

### New classes, all in `globals.css`, all `.sr-wx-*`

`.sr-wx-cov`, `.sr-wx-row` (+ `.no-glyph`, `.is-zero`, `--sp`), `.sr-wx-rows`,
`.sr-wx-glyph`, `.sr-wx-label`, `.sr-wx-track` (+ `.is-thin`, `.is-empty`),
`.sr-wx-fill` (+ `.is-dur`), `.sr-wx-count`, `.sr-wx-ref`, `.sr-wx-bands`,
`.sr-wx-band` (+ `.is-zero`), `.sr-wx-bandhead`, `.sr-wx-lane`, `.sr-wx-fig`,
`.sr-wx-thin`, `.sr-wx-none`, `.sr-wx-seg`, `.sr-wx-legend`, `.sr-wx-key`
(+ `.k-sp`, `.k-du`, `.k-zero`), `.sr-wx-route`, `.sr-wx-pick`, `.sr-wx-lede`,
`.sr-wx-pair`. Exact declarations are in the mockup's stylesheet and are the
source of truth for numbers.

`.sr-wx-scale` is **gone**: it existed only to hold the old proportional rail,
and under species-max scaling every track is full width again. Delete it rather
than leaving it unused.

---

## Design Tokens Applied

No new token is minted. Every value below is already declared in both `:root`
and `[data-theme="dark"]`.

| Role | Token |
|---|---|
| Card surface, border, radius, shadow | `--sr-surface`, `--sr-border`, radius 12, `--sr-card-shadow` (via `SectionCard`) |
| Section separators | `--sr-border-subtle` |
| Primary figures, band names, bold counts | `--sr-text` |
| Micro-labels, denominators, footnotes, muted counts, glyph column | `--sr-text-muted` |
| Scientific name in the readout lede | `--sr-text-gray`, italic, 0.71875rem |
| Bar track | `--sr-surface-subtle` |
| Species / distribution bar fill; the ratio bar's covered segment; the route link; the pressed segmented button's text | `--sr-accent` |
| Segmented control border, pressed background | `--sr-accent-border`, `--sr-accent-bg` |
| Duration bar fill; the ratio bar's remainder | `--sr-chart-slate` |
| Zero-band dashed rail | `--sr-border-medium` |
| Combobox chrome | `--sr-border-input`, `--sr-accent`, `--sr-accent-bg`, `--sr-accent-bg-hover` (all via the shipped component) |
| Focus ring | the global `button/a/[tabindex]:focus-visible` rule, untouched |

**One contrast note, stated rather than left to be discovered.**
`--sr-chart-slate` (`#94A3B8`) on the light-theme track (`--sr-surface-subtle`
`#F4F4F5`) measures **2.29:1**, under the 3:1 non-text floor; in dark it is
5.74:1. This is accepted, for the same reason the shipped Share-breakdown bars
are: the duration bar is **reinforcement only** and its value is present as text
on the same line (`84 min out · from 103 with a time`), so no information is
carried by the fill alone (WCAG 1.4.1 and 1.4.11 both turn on that). It is
additionally distinguished from the species bar by **thickness** (5px against
8px), so shape carries the distinction as well as hue. `--sr-chart-slate` is
also already the app's chart-neutral in exactly this "the other part" role in
Data Quality's own bars. Do not substitute a darker token to chase the ratio; it
would put a second strong value beside the accent and break the one-accent rule.

---

## Interaction Notes

- **`onGoToWeather` is a new prop and must be threaded from `App.tsx`.** The
  route button is an in-app tab move, so it is a `<button>`, never an `<a href>`.
  `BirdingStats` gains `onGoToWeather: () => void` and passes it to
  `WeatherStatsSection`; `App.tsx` supplies
  `onGoToWeather={() => setActiveTab('weather')}` at the `BirdingStats` call
  site, mirroring the shipped `onGoToSettings={() => setActiveTab('settings')}`
  exactly. This is plumbing the PRD does not mention.
- **The route line carries no number.** It says "Fill in the gaps on the Weather
  tab" and nothing else. A "N checklists have no weather block" figure here
  would be computed from FR-13's attribution gate while the Weather tab's own
  backlog uses the looser label-based `hasWeatherBlock`, so the two would sit on
  screen disagreeing by a number neither explains (FR-13, QA-08). Omitting the
  figure is what keeps the promise "if those two numbers ever appear on one
  screen, the difference is stated" from ever coming due.
- **Axis toggle.** `role="group" aria-label="Choose the axis"` around two
  `<button aria-pressed>` in `.sr-wx-seg`. Default `temp`. `useState`, session
  only, no storage seam. **It belongs to block 3 only and is unchanged by the
  per-species rescale.** Block 4 keeps both axes on screen at once in
  `.sr-wx-pair`, because those two groups are short lists that fit side by side
  and the whole point of the rescale is that both are now legible. Do not unify
  the two blocks under one toggle.
- **Species picker.** Default `null` (rest state). All keyboard behaviour is the
  shipped component's and must not be re-implemented: focus opens the listbox,
  Arrow keys move `aria-activedescendant`, Enter commits the active option or
  else the first *species* match (never the synthetic clearing row), Escape
  closes only the open listbox and then bubbles, the "All species" row is always
  present and never filtered out.
- **Every `<button>` and every `<a href>` carries a literal `tabIndex={0}`**
  (NFR-04). The section renders two to four buttons depending on state: the two
  segmented buttons, the route button, and the combobox's own toggle (which
  keeps its shipped `tabIndex={-1}`, since the input is the tab stop).
- **DOM identifiers key on an INDEX, never on a data value** (NFR-05). The
  picker's ids are the shipped `useId()`-namespaced `${uid}-option-${idx}`. The
  section creates no other id; if one becomes necessary, it is
  `${uid}-{group}-{index}` and never contains a species name, a condition emoji,
  or a band label. A band label such as `85°F and up` contains spaces and cannot
  resolve as an IDREF, which silently switches off the announcement it exists
  for.

### Why this section deliberately does not owe the `aria-activedescendant` chart shape

**Every bar in this section is `aria-hidden` reinforcement, and every value it
draws is already present as text on its own row.** The rails follow the shipped
`BarRow` groups in Data Quality, which carry no role of their own, and
explicitly **not** the shipped `Donut` in `MediaStatsSections.tsx`, which needs
`role="img"` plus an `aria-label` naming its values only because an SVG pie has
no text to read.

Two consequences the Engineer should not "fix":

- Do **not** put `role="img"` and a values-listing `aria-label` on these groups.
  It would replace readable text with a single long label and make the section
  worse for a screen reader, not better. NFR-04's "every chart shall carry
  `role="img"`" is satisfied in substance by the values being text; where it is
  read literally, raise it rather than wrapping readable rows in an image role.
- The section contains **no interactive chart**, so the v1.0.21 event-strip
  shape (a `role="listbox"` track holding the single tab stop, driven by
  `aria-activedescendant`, with a fixed readout) is deliberately not used. That
  pattern exists for marks that are positioned by data and cannot each be a
  target; here the row count is fixed by the band tables (11, 7, 9, 2) and every
  row is a line of text. Reusing it would add a tab stop and a readout that say
  what the row already says. The only `aria-activedescendant` in the section is
  `SpeciesCombobox`'s own, which is shipped and correct.

---

## Motion Spec

Every entrance is a nicety over content that is fully readable without it. The
global `@media (prefers-reduced-motion: reduce)` block in `globals.css` already
collapses `animation-duration` and `transition-duration` to `0.001ms`, so no
per-component media query is written; each row below states what that collapse
leaves behind.

| Interaction | Easing | Duration | Origin | Reduced motion | Implemented by |
|---|---|---|---|---|---|
| Distribution / species / duration bar fill grows from zero (`@keyframes sr-wx-grow`, `width: 0 → var(--w)`) | `cubic-bezier(0.2, 0, 0, 1)` (ease-out) | 300ms | left edge of the track (`width` animation, `animation-fill-mode: both`) | Renders instantly at final width; `both` guarantees the end state | CSS keyframes, no library |
| Segmented axis button background + text colour on press and hover | `ease-out` | 120ms | n/a (colour only) | Instant colour change | CSS transition |
| Route link's `ArrowRight` nudge on hover (`translateX(2px)`) | `cubic-bezier(0.2, 0, 0, 1)` | 140ms | the glyph's own box | Instant, or effectively no nudge | CSS transition |
| Species picker listbox opens (`scaleY(0.94) → 1`, opacity) | `cubic-bezier(0.2, 0, 0, 1)` | 140ms | `transform-origin: top center` — it scales from the input that opened it | Instant appear | Shipped `.sr-combobox-list` in `globals.css`. Nothing new. |
| Species picker chevron rotates 180° | `ease-out` | 150ms | the glyph's centre | Instant | Shipped `SpeciesCombobox` |
| Listbox close | n/a | instant | n/a | unchanged | Shipped: removal, no exit animation |

**Nothing else moves.** No hover-scale on rows, no staggered entrance across the
27 distribution rows, no pulsing, no blur-in, no spring.

**The bar entrance is keyed on a deterministic `resetKey`**, following the
shipped Subspecies share breakdown: it replays exactly when the data changed and
not otherwise. Block 3's key is the selected axis; block 4's key is the selected
species. In particular it must **not** replay on every keystroke in the species
filter — re-render the picker alone while the query is being typed, and
re-render the charts only when the selection commits.

**The per-species rescale changes no motion.** The bar still grows from zero
over 300ms on the same curve; only the width it grows to is computed
differently. `.sr-wx-ref` is text and never animates.

The blessed stack for this project is CSS / Web Animations (shadcn / React).
Motion (motion.dev) is not introduced: nothing here needs it, and the shipped
app animates entirely in CSS.

---

## Content Notes

**Voice.** Plain, specific, evidential. The section never tells the user what
the weather means, only what their records say. Sentences are short and state
their own denominator.

**Forbidden, and asserted by QA (FR-29):** "best conditions for", "you should
try", "expect to find", the word "correlation", and any ranked list of species
by weather. Also forbidden on the `🌡️` row: "Unknown", "Unknown weather".

**No em dash (U+2014) anywhere in user-facing copy** (`.claude/rules/docs-and-website.md`).
The mockup's card copy is clean; only its harness prose and code comments use
one.

**Surface naming.** User-facing surfaces are named from `TAB_LABELS` in
`lib/tabLayout.ts`, never from a component name. This bites here:

> **FR-17's literal string is "Fill in the gaps from the Weather Backlog." and
> this spec deviates from it, deliberately.** "Weather Backlog" is the component
> name (`components/WeatherBacklog.tsx`) and the pipeline's internal name. It is
> not a user-facing surface: the shipped section's own visible heading is "List
> checklists with no weather blocks", under the sub-line "Work down your
> missing-weather backlog, newest first", and the tab it lives on is labelled
> **Weather**. The route copy is therefore **"Fill in the gaps on the Weather
> tab"** in both states that render it. Raised rather than slipped in; if the
> Planner prefers FR-17's exact words, the rule has to be waived explicitly.

### Exact copy strings

| Where | String |
|---|---|
| Card title | `Weather` |
| Coverage label | `Checklists with a weather block` |
| Coverage denominator | `{pct}% · {readable} of {total}` |
| Coverage sentence | `These figures cover the {N} checklists that carry a weather block SnowRaven or RainCrow wrote. That is {X}% of your {M} checklists.` |
| Unreadable clause (only when `unreadableCount > 0`) | ` {K} more carry a block this app could not read.` |
| Route button | `Fill in the gaps on the Weather tab` |
| Distribution group heading | `Your outings by weather` |
| Three-denominator sentence | `Each axis counts the readable blocks that carried that field, so the three totals differ: a checklist can have a temperature and no wind.` |
| Axis headings | `By sky` / `By temperature` / `By wind` / `Day and night` |
| Axis denominators | `{n} with a sky condition` / `{n} with a temperature` / `{n} with a wind reading` / `{n} with a time of day` |
| Sky footnote | `A checklist is grouped by the sky glyph in its own block, not by the weather service's wording. Other is the glyph SnowRaven writes when the service returns a sky code it has no category for; the temperature and wind in those blocks still count everywhere else on this card.` |
| Temperature footnote (answers OQ-04) | `A block records a range, because it covers every hour of the outing. Each checklist is counted once, in the band its midpoint falls in. Half your blocks span {medianTempSpanF}°F or less.` |
| Wind footnote | `Blocks record wind as a Beaufort description, so these are the app's own bands rather than a speed.` |
| Day/night footnote | `A block written after dark carries a moon phase beside its sky glyph, which is what marks the checklist as night.` |
| Species group heading | `Species and time out, by weather` |
| Confound sentence (FR-27, verbatim) | `Weather changes how long you stay out, so a lower species count can be the weather or it can be the outing. Average time out sits beside every average so you can see both.` |
| Legend | `Species per checklist` · `Average time out` · `No outings` · `A band averages only once it has {WEATHER_BAND_MIN_TO_SHOW} checklists.` |
| Band head count | `{n} checklists` (`1 checklist` singular) |
| Species lane figure | `{avg} species per checklist` |
| Duration lane figure | `{min} min out · from {durationCount} with a time` |
| Thin durations | `Only {durationCount} of these have a recorded time, too few to average.` |
| Thin band | `Too few to average.` |
| Zero band | `No outings in this condition.` / `No outings in this band.` |
| Picker group heading | `One species, its weather` |
| Rest state | `Pick a species to see the skies and temperatures you have it on. Counts are checklists, not sightings, and they only ever cover the {N} checklists with a readable block.` |
| Selected lede | `{BirdName} {sciName}` / `is on {n} of your {N} weather-block checklists. Counts are checklists, not sightings.` |
| Species chart note (the confound) | `This is where {Species name} turned up, so it reflects when you were out as well as the bird. Each row carries its share of the bird's records, then the same band's share of all your outings.` |
| Species group denominators | `{sum} of its {total} have a sky condition` / `{sum} of its {total} have a temperature` |
| Species row count | `{count} · {share}%`, share of the species' own axis total; `no outings` when the band holds none |
| Species row reference | `outings {share}%`, share of the axis's own sum; **absent** on a no-outings row |
| Below-floor line 1 (FR-17) | `You have {N} checklists with a readable weather block. That is not enough to chart yet.` |
| Below-floor line 2 | `Every figure here is about the checklists that carry a weather block SnowRaven or RainCrow wrote, so filling in more blocks is what sharpens it.` |

`OpenWeather` is not named in user copy; the footnote says "the weather service",
which is true on both dialects and does not put a provider name on a RainCrow
block.

### Two build-time notes on rendering

- **The condition glyph is the user's own data and is rendered as-is**, with its
  shipped presentation (ten carry U+FE0F, `⛅` does not). It sits in an
  `aria-hidden` `.sr-wx-glyph` slot at 0.875rem; the label beside it is the
  accessible text, so a screen reader reads "Overcast", never "cloud emoji
  Overcast". It renders in colour on macOS, iOS and Windows; a monochrome
  fallback in some headless environments is a font matter, not a design one.
- **Type stack.** The section inherits `Inter, system-ui` from the app.
  `weft-design-lint` reports one advisory `banned-font` warning on the mockup for
  exactly this, and it is **kept on purpose**: the stack is what
  `pipeline/design-system.md` records under *Type* and what the app has shipped
  for 61 versions, and the Weft doctrine states that `design-system.md` wins on
  specifics while the doctrine wins on craft. A mockup of a shipped app in a
  different face would be a picture of a different app. Do not re-litigate this
  downstream and do not introduce a display face for this section.

---

## Verified before hand-off

Checked in a real browser (Playwright, Chromium) against the mockup rather than
asserted:

- No horizontal overflow at 320px, at 100% and at 200% in-app text scale
  (`scrollWidth === clientWidth`, 318px in a 318px box at both).
- No console errors and no page errors in any render state.
- Keyboard path through the picker end to end: focus opens, Arrow moves
  `aria-activedescendant` to an index-keyed id, Enter commits the active option,
  a typed scientific-name fragment commits the first species match rather than
  the clearing row, Escape closes without clearing the selection, the clearing
  row returns the rest state.
- Every `<button>` and every `<a href>` on the page carries an explicit
  `tabindex` (zero missing).
- Both themes rendered and read; all four "nothing here" states rendered and
  visually distinct.
- Every axis sums to its stated denominator; `found === readable + unreadable`.
- No forbidden phrase and no em dash in any card copy, in any state.
