# Design Spec — Species Detail Weather

**Feature:** species-detail-weather
**Date:** 2026-09-07
**Stage:** 4 — The Designer
**Source:** strategic-brief.md, prd.md, schema.md (all approved); `design.html` (approved)
**Mockup:** `pipeline/species-detail-weather/design.html`

---

## Visual Direction

The card is the v1.0.22 Weather section's per-species view rendered on the bird's own
page, in the register the rest of Species Detail already uses: quiet utility, one
accent, informative and never promotional. It introduces no new visual idea. Every
pattern it uses is already named in `pipeline/design-system.md` — the distribution
row, the zero/thin/no-outings shapes, the incompressible trailing figure on its own
row, and above all **comparing a subset against a population without printing a
rate**, whose exemplar the design system already says is this chart.

Two things decide how it reads.

**The sentence is the design, not the chart.** On the reference export **225 of 282
selectable species** land in a state that renders no chart at all. The below-floor
state is therefore the main path, and it is built as the full card with the chart not
yet arrived rather than as an empty state (see *State: bird below floor*).

**Two wholes, never a rate.** The opening block states one numerator against two
different denominators, and the rows do the same thing per band. Nothing anywhere on
this card divides one share by the other.

### Stated doctrine deviation

The Weft design doctrine requires a distinctive display face and names Inter as a
tell. **This design uses `--font-sans` (`'Inter', system-ui, …`) deliberately**,
because the doctrine's own precedence rule gives `design-system.md` the specifics, and
a mockup rendering a new card into an existing tab in a different face would be a
dishonest preview of a type system in force across 61 shipped versions.

Recorded rather than banked: `weft-design-lint` reports **clean, 0 findings**, but its
`banned-font` rule did not fire only because the family is declared behind a custom
property. The deviation is real and deliberate; the clean pass is not evidence for it.

---

## Screens / Views

### The Weather card — slot and frame

**Slot (OQ-05): after Comments, above Named Individuals.** Below Top Locations, as
FR-24 requires, and chosen within that floor for three reasons: it closes the run of
sections built from the bird's own records, so the two sections below it (Named
Individuals, Recent Media) remain a distinct group about a different subject; it does
not split the Top Locations → Sighting Locations pair, which is a list and then the
map of the same fact; and because the ordinary outcome is a quiet sentence, the card
belongs where a reader arrives at it rather than where they land on it.

The higher slot — immediately after Sighting Locations — was the considered
alternative and is rejected: it puts the card's ordinary state on the path of every
reader on every bird, which trains the eye to skip the card by the time it has
something to show.

**Frame:** one `SectionCard` with a `SectionHead` from `components/speciesDetail/ui.tsx`,
titled **Weather**, icon `<CloudSun size={14} strokeWidth={2.2} />` to match the tab's
other section heads (the Statistics section's own icon is `size={16}`; the tab's
register is 14).

**The head carries the title and nothing else.** Several Species Detail sections put a
muted figure at the end of their head row. This one does not: the count lives one line
below with its denominator and its explanation, and a bare number in the head would be
the same fact in a second place without the words that make it readable.

**No section index, no jump affordance, no anchor.** The tab has none and this feature
adds none (FR-25).

### State: absent

Renders nothing at all — no card, no head, no placeholder, no reserved height, and no
gap where one would have been. The sections above and below are adjacent. Nothing else
on the tab refers to the card, so nothing has to be kept in step with it.

### State: export below floor

The statement is about the file, not the bird, so **no bird name and no figure about
this species appear.** The card renders identically on every selection, which is
correct.

Order: the coverage line (`belowFloorLine(readable)`), then the shipped
`WEATHER_COPY.belowFloorBody` in the muted note register, then the shipped
`WEATHER_COPY.route` as a button. Same words and same destination as the Statistics
section's below-floor state, byte for byte, because it is the same state about the
same export.

This is the only state on the card that renders a control.

### State: bird below floor — the main path

**Four birds in five land here.** Build it as the main path it is, not as a fallback.

The design rule is one sentence: **this is the full card with the chart not yet
arrived.** The opening block is byte-identical in structure, position and weight to
the full state's — the name, the count sentence, the own-whole sentence, the muted
note — and only the chart is absent, replaced by one quiet line naming the floor.

A reader stepping between birds sees the first paragraph stay exactly where it is,
without changing register or acquiring an apology; the chart is a bonus that sometimes
appears. What this state must **not** be: an empty-state box, a dashed border, a
centred glyph, a muted "no data" panel, or anything else that reads as a broken chart.
On four birds in five, that framing would be the card's normal appearance.

**No route to anywhere** (OQ-02). The card cannot know whether the Weather tab's
backlog reaches this bird, so "fill in the gaps" here would read as "and then this
chart will appear", which it cannot promise. What it gives instead is the thing it can
promise: the floor, named, built from the constant.

**The floor is named** (OQ-07), because it is the honest replacement for the route this
state declines to offer.

### State: full

Order, top to bottom:

1. The opening block (below).
2. The confound, once, through the shipped `speciesChartNote(speciesName)`.
3. The sky group and the temperature group.

**Both groups, side by side, no toggle** (OQ-06). The brief permits the axis toggle to
travel, but there is nothing to travel: the Statistics **per-species** view has no
toggle — its Sky / Temperature control governs the band chart above it. Adding one here
would invent a control on the surface whose premise is that the reader operates
nothing to get the answer.

The pair is `.sr-wx-pair`'s existing `repeat(auto-fit, minmax(min(240px, 100%), 1fr))`
grid: two columns wherever two fit, one the instant they do not, with no breakpoint to
get wrong. Stated cost: eighteen rows is a tall card. That is the honest length of the
answer, no band is dropped, and the alternative is a control that hides half of it.

**Sky: all eleven rows**, in the shipped display order (clearest first, foulest last,
`🌡️` Other pinned last as the residual), addressed by the payload's `index` and never
by array position. **Temperature: all seven rows**, in ascending band order. No band is
ever dropped, including bands with a count of zero and bands the user has never birded.

Each group states its own denominator through the shipped
`speciesGroupDenominator(sum, speciesTotal, axis)`. The two denominators legitimately
differ from each other and from the bird's own count — a readable block can carry a
temperature and no sky — and the "of its N" phrasing is what stops a skimmer reading a
sum as an outing count.

### The opening block — one numerator, two wholes

Rendered in every state that shows a figure (full and bird-below-floor), identically:

```
[BirdName]  [scientific name]
is on 5 of your 353 weather-block checklists.
That is 5 of the 97 checklists you have it on.  Counts are checklists, not sightings.
```

Line 1 is `<BirdName>` **without `onOpenSpecies`**, so the common name renders as text
plus its two `SpeciesLinks` marks rather than as a button. A link to the page the
reader is already on is a control that looks pressable and does nothing.

**The name is not accent-coloured here.** The Statistics lede wraps it in
`.sr-wx-lede .sp`, which forces the accent, because there the name is the answer to
"which bird" that the user just typed into a picker. On Species Detail the page header
already names the bird, and the design system's rule is one accent per surface. The
name uses `BirdName`'s own default (`--sr-text`, weight 500); the accent on this card
belongs to the bar fills and, in the export-below-floor state, to the route.

Line 2 is the shipped `speciesLedeParts(onCount, readable).lead`, unchanged (FR-14).

Line 3 is **new** and is the addition this stage was asked for: the same numerator
against the bird's own record. It answers how much of this bird's history the card can
speak to, which the strategic brief names as the card's job, so it is part of the
opening block rather than a stat appended anywhere.

**"That is" is load-bearing and is not a stylistic tic.** Without it, the same figure
printed twice reads as two different counts. With it, the repeated number is
unmistakably one number held against two wholes — the card's whole thesis, stated in
the lede before the chart demonstrates it.

**Nothing divides them. There is no coverage percentage for the bird, and no reader of
this spec should helpfully add one.** Two shares of two different wholes sit side by
side; that is the entire pattern, and a rate is precisely what it exists to refuse.

**The zero case takes its own wording**, for the same reason the shipped lede does:

```
is on none of your 353 weather-block checklists.
You have it on 26 checklists, and none of them carry a weather block.
```

"That is 0 of the 26" would put a bare zero exactly where the sentence is meant to be
an account.

**The singular inflects, and it is the common case rather than an edge.** Across the
114 zero-block species on the reference export the median total is **two** checklists
and **49 sit at exactly one**, so this string is reached often:

```
You have it on 1 checklist, and it does not carry a weather block.
```

Both the noun and the verb clause inflect (`1 checklist … it does not carry` against
`26 checklists … none of them carry`).

**Basis clauses** follow the shipped note in the same muted run, each absent when it
does not apply: the checklists-not-sightings note always; the filter clause only while
a county or date filter is active; the form clause only when the selection's normalized
name differs from it. Both figures in the opening block are export-wide, so the single
filter clause covers both and **no new basis clause is needed for line 3**.

### The row primitive, and the two repairs it ships with

**One implementation, extracted and shared** (FR-26). The card must not carry a copy of
`SpeciesRow`, `CONDITION_LABEL` or the sky display order.

**Three row shapes, never sharing a treatment:**

| Situation | Shape |
|---|---|
| The bird was in this band | Solid track with an accent fill scaled to the bird's own largest band **on that axis**, the count, and the count's share of the bird's axis total. Trailing: the same band's share of all outings. |
| The bird was not, but outings were | Solid full-width track with **no fill**, `0 · 0%`, and the reference figure **retained** — a fact about the bird. |
| No outings in the band at all | Transparent `1px dashed` track, label and count muted, the literal `no outings`, **no numeral and no reference figure** — a fact about the birder. |

Omitting the reference on the third is deliberate: "outings 0%" would only repeat what
"no outings" already said and would collapse the one distinction the chart most needs.

Bars scale to the bird's own largest value **per axis**, computed independently for sky
and temperature and never shared between them. The shared rail — population as track,
bird as fill — is not used; it is the treatment the user rejected on their own export
at the v1.0.22 preview, in the words *"1 of 395 and a tiny bar"*. It does not come
back.

The trailing reference figure **takes its own row at every width**, never a fifth
inline column. No positive `min-width` appears anywhere in the pattern; the one
`min-width: 3px` sits on the bar fill inside an `overflow: hidden` track, where it
cannot widen a row, and is what guarantees a non-zero count always paints.

---

#### Repair 1 — the label must never overlap the count

**Approved, ships with this build.** This is a live defect in the shipped v1.0.22
build, confirmed in Chromium and WebKit agreeing to within 0.06px.

In the stacked tier the label is given `white-space: normal` and `overflow: visible`
but no wrap allowance, and its track is `minmax(0, 1fr)`. `normal` only breaks at
spaces, so multi-word labels wrap and are always clean while the single-word ones —
**Thunderstorm** and **Overcast** — cannot break at all and, with no clipping ancestor
anywhere, paint glyph-on-glyph across the count cell. Worst measured: **"Thunderstorm"
overshooting by 48.9px at 320px / 200%**, its track 70.3px against a min-content of
135.2px.

**It is not data-dependent and not an edge case.** The failing pair is "Thunderstorm"
over `no outings`, which is the row every birder who has never birded a thunderstorm
sees — i.e. most of them, on the ordinary card.

**Design intent:** at every width and every in-app text scale, a row's label must
either fit, wrap, or break — but must never paint over the figure beside it.

**Mechanism:** `overflow-wrap: anywhere` on the label, in the tier where wrapping is
enabled, beside the `white-space: normal` that grants it. `break-word` renders
identically and does **not** work — only `anywhere` lowers the item's intrinsic
contribution — and nothing reads this label's min-content, so v0.5.85's objection to
`anywhere` does not apply here. The desktop tier needs nothing: it clips with an
ellipsis by construction.

**Its blast radius is wider than this card, and that is correct rather than
tolerated.** *(Measured at Stage 6 and corrected here; this spec previously left it
unsaid, and the omission became a false "distribution rows are untouched at every
width" downstream.)* The rule lives in the shared `@media (max-width: 640px)` tier on
the selector `.sr-wx-row > .sr-wx-label`, and `DistRow` renders that same element, so
the repair reaches the Statistics **distribution** rows too. It is a repair there as
well: measured pre and post over 222 configurations, the shipped distribution rows
carried label-over-count readings at supported widths, worst 21.88px on "Overcast" at
320px / 200%, and carry none afterwards. The change is confined to **300 to 355px at
200% text scale**, and its cost there is a taller row, because the label takes a third
line box rather than paint over the figure. This is inside FR-27 rather than an
exception to it: the design intent above is stated over *a row's label*, with no
per-species restriction, so a rule in `globals.css` that satisfies it on a second set
of rows is the requirement being met rather than exceeded. Do not narrow the selector
to reclaim the older, narrower claim; the narrower claim was the thing that was wrong.

#### Repair 2 — the rail must never collapse, and the trigger is the problem

**Approved, ships with this build.**

The stacked tier opens at `@media (max-width: 640px)`, so at a desktop width the
per-species row keeps its four inline tracks and the `1fr` rail absorbs whatever the
glyph, the `8.5rem` label track and the nowrap count leave over. Measured in the same
398px column: rails of **193 to 240px at 100%** text scale, and **0.0 to 32.6px at
200%**, with several rows painting no rail at all while still taking the height of one.

It leaks no scroll and hides no value — every figure is text on the same line, so WCAG
1.4.4 is not engaged — but a chart whose bars vanish for exactly the reader who
enlarged their text is not doing the job the bars are there for.

**Why the obvious fix at 320px is not a fix.** The failure is **not monotonic in
width**. There are two disjoint failing bands at 200%:

| Band | Why it exists |
|---|---|
| **~300 to 365px** | The narrow end, where everything is tight. |
| **~620 to 640px** | `.sr-wx-pair`'s `auto-fit` grid flips from one column to two at about 620px, halving each column and collapsing the label track from ~345px back to ~69px **while the ≤640px rules are still in force**. |

A check at 320 and 900 finds the first band and misses the second entirely; a check at
375, 414, 480 or 560 finds neither. Any verification of this repair must sweep the
band, not sample it.

**Design intent:** the per-species row stacks when its own column can no longer hold
four inline tracks with a legible rail — and that is a question about the column's
width measured against the size of its own text, not about the viewport.

**Mechanism: move the trigger, not the layout.** The stacked shape is already correct
and already shipped; only *when* it fires is wrong. `em` inside a container query
resolves against the container's own font size, so the same 398px column reads
**24.9em at 100% and 12.4em at 200%** — exactly the quantity in question. The tier
opens at `@container (max-width: 22em)` on the per-species group column, measured
against 6.9–16.9em in every configuration that must stack and 24.9em in the one that
must not.

**This is not the v1.0.22 rule being contradicted.** That rule rejects a container query
because "how wide is my box" cannot answer "how wide is my content" — and it was right,
which is why the reference figure took its own row unconditionally. That change removed
the data-dependent half of the width. What remains varies with the text scale alone,
and an `em` container query tracks the text scale exactly.

**Taking both repairs together also dissolves the two bands.** They exist only because
the tier is keyed on a viewport width while the column count beneath it changes
independently; keyed on the column itself, there is nothing left to be non-monotonic
in. The failure is removed rather than relocated — the same move the reference figure
made when it took its own row.

#### Two constraints on Repair 2 that the mockup does not show

Surfaced while writing this spec; the Engineer needs both.

**The container must be scoped to the per-species groups only.** `.sr-wx-rows` appears
in **three** places in `WeatherStatsSection.tsx` — the distribution groups
(`DistGroup`, line 159, serving all four distribution axes) and the two per-species
columns (lines 623 and 645). Putting the container on `.sr-wx-rows` wholesale would
re-trigger the **distribution** rows too, and they do not have *the rail* defect this
repair is about: they run at full card width and their rails measure healthily at 200%.
It would also visibly change the shipped Statistics distribution rows between roughly
480 and 640px, which FR-27 forbids. The mockup puts the container on the group wrapper,
which is equivalent for this card and does **not** generalize; scope it to the
per-species pair.

**Name the defect, not just the rows, or the two repairs get conflated.** "They do not
have this defect" is true of the rail and false of the label: the distribution rows had
Repair 1's defect and Repair 1 fixes it for them (above). The scoping constraint here is
Repair 2's alone. Verified at Stage 6: with the container scoped as specified, the
distribution rows show **zero** change anywhere between 470 and 660px at any text scale,
which is exactly the band this constraint was written to protect.

**The stacked declarations must stay single-sourced.** The distribution rows keep their
viewport trigger and the per-species rows gain a container trigger, so two selectors
now need the same declaration list. The repo already has the pattern and the reason:
`.sr-input-16` and `.sr-ctl-row :is(button, select, input)` deliberately differ in
specificity, share one declaration, and are locked identical by a test that parses the
real `globals.css` (`lib/filterControlSizeCss.test.ts`). Follow it. Two blocks holding
declarations that agree today are two blocks that will disagree later, on a row that
FR-26 exists to keep single.

---

## Component Usage

| Component | Use |
|---|---|
| `SectionCard`, `SectionHead` (`components/speciesDetail/ui.tsx`) | The card frame and head. Title **Weather**, icon `CloudSun size={14} strokeWidth={2.2}`. |
| `BirdName` | Every rendering of the species name. No `onOpenSpecies`, so it renders as text plus its two `SpeciesLinks` marks. |
| The extracted species row (from `WeatherStatsSection.tsx`) | Every chart row. One implementation in the repo; `WeatherStatsSection.tsx`'s rendered output stays byte-identical. |
| The extracted `CONDITION_LABEL` and sky display order | Row labels and order. Extracted, never copied. |
| Shipped copy functions in `lib/weatherStatsCopy.ts` | Every count-bearing string. |
| `SpeciesCombobox` | **Not used.** The card renders no picker, selector, combobox or species control of any kind. |
| `SegControl` / `.sr-wx-seg` | **Not used.** No axis toggle on this card. |

Nothing outside the configured component library is introduced. No new dependency.

---

## Design Tokens Applied

Every colour is a `var(--sr-*)` token declared in both themes. No hardcoded hex or RGB
anywhere in the card.

| Element | Token |
|---|---|
| Card surface / border / shadow | `--sr-surface`, `--sr-border`, `--sr-card-shadow` |
| Head rule | `--sr-border-subtle` |
| Head icon tile | `--sr-accent-bg` fill, `--sr-accent` glyph |
| Lede and body text | `--sr-text` |
| Notes, denominators, muted counts, `no outings` | `--sr-text-muted` |
| Scientific name | `--sr-text-gray` |
| Bar track | `--sr-surface-subtle` |
| Bar fill | `--sr-accent` |
| Empty (no-outings) track | transparent on `1px dashed var(--sr-border-medium)` |
| Route button (export-below-floor only) | `--sr-accent` |
| Focus ring | the global `button:focus-visible` ring; no per-component override |

`--sr-text-disabled` is **not** used anywhere on this card: it is for genuinely
disabled controls, and every muted string here is content.

---

## Interaction Notes

- **The card renders no control in three of its four states.** Only export-below-floor
  renders one, the shipped route button. Full and bird-below-floor render zero buttons
  and zero links — verified across all five preview species in both engines.
- **Every `<button>` and every `<a href>` carries a literal `tabIndex={0}`.** WebKit's
  default tab mode, which the shipped Mac, iPhone and iPad apps run, skips both
  entirely without it.
- **Selection comes from the tab's existing selector.** Changing it changes the card;
  the card never changes the selection.
- **Rails are `aria-hidden` and carry no role**, following the shipped section: every
  value is present as text on the same line, and putting an image role on these groups
  would replace readable rows with one long label.
- **WCAG 2.1 AA holds at 320px and at 200% in-app text scale.** Verified in Chromium
  and WebKit across five species × three widths × two scales: zero page errors, zero
  overflow past the frame, zero label collisions, narrowest rail 192.7px.
- **Every `id` and ARIA IDREF keys on an index**, never on a species name, a condition
  glyph or a band label — a value from the user's file can carry whitespace, which
  cannot resolve as an IDREF.
- No hover state carries information; nothing on the card is hover-only.

---

## Motion Spec

Motion on this card is the bar entrance and nothing else. Nothing else on the card
changes, so nothing else animates — the doctrine's "animate what changed" applied
literally.

| Element / interaction | Easing | Duration | Origin | Reduced motion | Implemented by |
|---|---|---|---|---|---|
| Bar fill entrance, on species change | `cubic-bezier(0.2, 0, 0, 1)` (ease-out) | 300ms | Grows from `width: 0` at the track's leading edge | Final width rendered instantly | Shipped CSS `@keyframes sr-wx-grow` + `animation: … both` |
| Route button's `ArrowRight` glyph, on hover | `cubic-bezier(0.2, 0, 0, 1)` | 140ms | `translateX(2px)`, from rest | Transition collapses to ~0 | Shipped CSS transition |
| Everything else | — | — | — | — | **No motion** |

The bar entrance **replays exactly when the data changed and not otherwise** — keyed on
the selected species, the same mechanism and the same reason as the shipped section's
`key={`sp-${selected}`}`. It must not replay on an unrelated re-render, and there is no
motion on mount for static content.

Reduced motion is honoured through the global `prefers-reduced-motion` block in
`globals.css`, never a per-component media query. The app's posture is to shorten
transitions to ~0 rather than remove them; keep it.

**Explicitly not used**, per the doctrine's anti-slop list: staggered row fade-ins, a
whole-card crossfade on species change, hover-scale on rows, pulsing or "breathing"
indicators, and any overshoot or elastic easing.

---

## Content Notes

**Register: evidential, never analytical.** Every figure states what it counts and how
many things are behind it. Nothing predicts, ranks or recommends. The phrases "best
conditions for", "you should try", "expect to find", "most associated" and the word
"correlation" do not appear, and no ranked list of anything is rendered.

**Every count-bearing string lives in `lib/weatherStatsCopy.ts` and nowhere else**, so
it rides the generated corpus sweep. A count-bearing string built inline in the
component is invisible to that sweep however correct it happens to be today.

**Reused unchanged:** `speciesLedeParts`, `speciesChartNote`, `speciesRowShare`,
`speciesRowReference`, `speciesGroupDenominator`, `belowFloorLine`, `WEATHER_COPY.route`,
`WEATHER_COPY.belowFloorBody`, `NO_OUTINGS`.

**Six new strings**, all proposed for `weatherStatsCopy.ts`:

| Function | Renders | Notes |
|---|---|---|
| `speciesOwnWhole(on, total)` | `That is 308 of the 1,307 checklists you have it on.` | The bird's own whole. "That is" binds the repeated numerator. No percentage; divides nothing. "you have it on" is the section's existing vocabulary, from `pickerRestParts().lead`. |
| `speciesOwnWholeZero(total)` | `You have it on 26 checklists, and none of them carry a weather block.` / at one: `You have it on 1 checklist, and it does not carry a weather block.` | Both the noun and the verb clause inflect. The singular is common, not an edge. |
| `speciesZeroLedeParts(readable)` | `is on none of your 353 weather-block checklists.` + the shipped note | The zero case needs its own lead: `speciesLedeParts` would print "is on 0 of your 353". Same lead-plus-note shape, so the component renders one branch. |
| `speciesFloorNote()` | `The skies and temperatures appear once a bird is on 10 weather-block checklists.` | Built from `WEATHER_SPECIES_MIN_CHECKLISTS`, pluralised, never a re-spelled number. Names what would change rather than what is missing, and borrows the section's own "skies and temperatures". |
| `filterBasisClause()` | `These cover every checklist in your export, so this tab's filters do not narrow them.` | Present only while a county or date filter is active. |
| `formBasisClause()` | `Every form counts as its parent species.` | Present only when the selection's normalized name differs from it. The lede's `BirdName` already shows which parent, so the clause does not name it twice. |

**Conventions:** no em dash (U+2014) in any string the card renders — verified zero
across all five preview species. Straight apostrophes in source, matching the shipped
copy module. User-facing surface names come from `TAB_LABELS`, never a component name.
A published claim states the property, never a count.

**Realistic content standard for any fixture or preview:** the mockup uses the user's
own export throughout — 3,252 checklists, 353 readable blocks, 168 species in the
published table — with five real species and their real arrays (House Finch 308/1,307,
Steller's Jay 18/83, Western Bluebird 5/97, American White Pelican 0/26, Wood Duck
0/1). A fixture-driven suite is least likely to exercise the empty case and it is the
only one every new user meets: **the zero and singular cases are test rows, not
assumptions.**

---

## Out of scope for this spec

Captured as follow-up work, not designed here:

- Species Detail's **"Checklists" stat** is `speciesObs.length`, a row count rather than
  a distinct-submission count. Measured on the reference export it disagrees for **4
  species of 282** (Mallard +7, Yellow-rumped Warbler +3, Dark-eyed Junco +1, Northern
  Flicker +1; 12 rows in 21,369), and for none of the five preview species — so the
  card spends no copy on it. That 0.06% is a property of this birder's
  subspecies-reporting habit, not of the code.
- Species Detail's **Frequency stat** divides that same row count by
  `totalFilteredChecklists`, a Set of submission ids. Numerator and denominator on
  different bases, systematically overstated for those four species, and in principle
  able to exceed 100%. It cannot on this export. The correctly deduped count is already
  in the component.
- `--sr-card-shadow` is the one shadow token still on pure black while the design
  system says shadows are tinted with the app's own ink.
