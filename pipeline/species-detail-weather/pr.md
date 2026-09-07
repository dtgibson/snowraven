# Species Detail Weather

### What this does

Puts the weather record on the bird's own page. A **Weather** card on Species
Detail shows the sky conditions and temperature bands the already-selected
species has turned up in, with no picker of any kind, out of the same
`computeWeatherStats` derivation the Statistics Weather section paints from, so
the two cannot disagree by implementation. It is reached through a new
module-scoped, per-export, `WeakRef`-keyed memo in `lib/weatherStatsShared.ts`,
gated by a cheap presence check and computed in a post-paint effect.

It also repairs two layout defects in the shared row primitive, confirmed
against the shipped v1.0.22 build in both engines. Because Species Detail and
Statistics now share one row implementation rather than a copy, **this changes
how the shipped Statistics Weather section renders**, and that is the decision
rather than an accident.

### How to test

`pipeline/species-detail-weather/how-to-see.md` is the step-by-step walkthrough
for a reader with no prior setup. In short: `cd frontend && npm run dev`, open
`http://localhost:5173`, go to Species Detail, pick a bird you have a lot of,
and scroll past Comments.

The real-engine verification is committed and runnable:

```
node website/tools/verify/verify-weather-species-rows.mjs frontend/dist
```

47 widths from 300 to 1440px, three in-app text scales, Chromium and WebKit,
both surfaces. Against a build with the two CSS repairs reverted it reports
48.88px of painted overlap on "Thunderstorm" over `no outings` at 320px / 200%
and rails at 0.00px, so it is known to be able to reject a revert:

```
node website/tools/verify/verify-weather-species-rows.mjs <preRepairDist> --expect-broken
```

### Notes for reviewer

**The seam, and why it is not the worker bundle.** `bundle.weather` exists only
after Statistics has been mounted and painted, so reading it would make the card
silently absent on a device where Statistics has never been opened, and a "read
the bundle if it exists, else compute" hybrid would make the same bird on the
same export print two different cards depending on browsing history AND on
another tab's `Count all forms` switch. `weatherStatsShared.ts` imports neither
`statsBundle.ts`, `statsOffThread.ts`, `useStatsBundle.ts`, `transport.ts` nor
`storage.ts`; there is no cached-answer path, so there is no missing branch to
fall into.

**The scheduling is part of the requirement.** The cold seam measures 15.67 ms
against a 20 ms budget, which is 1.28x and not the 2x this repo's rules call
margin. `useExportWeather` runs the gate and the aggregate in an effect behind a
double `requestAnimationFrame`, so the tab paints at the speed it does today and
the card arrives a frame later. A `useMemo` would meet the budget on this
machine and break it on a Pi. The measurements are recorded at the definition
site the way `statsBundle.ts` records its own chain, and the properties are
asserted by CALL COUNT rather than by timing in `useExportWeather.test.tsx`.

**One variant, and it cannot be threaded.** `weatherStatsFor` takes one
argument. There is no `includeSpuh` parameter, no options object and no default
to override; the `true` is a literal on the `filterObservations` line inside a
module that imports no React and reads no state. A caller cannot pass a control
value into it because there is no parameter that would accept one.

**The extraction, and the one place it diverges from QA-18's letter.**
`SpeciesRow`, `CONDITION_LABEL`, `CONDITION_DISPLAY_ORDER` and `inDisplayOrder`
moved out of `WeatherStatsSection.tsx` verbatim into
`components/WeatherSpeciesRow.tsx` and `lib/weatherDisplay.ts`, which the section
now imports. QA-18 says "`WeatherStatsSection.tsx` is unmodified"; the approved
schema (§2.5) and design spec both require the extraction, so that file IS
modified, by import edges and by deletion of the moved code only. Its rendered
output is unchanged and `WeatherStatsSection.test.tsx` passes untouched, which is
the property QA-18 is about. Flagged rather than silently reconciled.

**The two repairs, and what changes on Statistics.**

1. `overflow-wrap: anywhere` on the row label in the stacked tier, beside the
   `white-space: normal` that granted a wrap allowance with no break allowance.
   `break-word` renders identically and does not work: only `anywhere` lowers
   the item's intrinsic contribution.
2. The per-species row's stacked tier gains a container-query trigger on
   `.sr-wx-pair`'s own children, scoped there rather than to `.sr-wx-rows`
   because that class also serves the four distribution groups, which do not
   have *the rail* defect and which FR-27 protects. The threshold is
   `max(22em, 390px)`, written as a disjunction: the `em` term tracks the
   text-sized chrome, the px term is an absolute floor, because FR-35's 120px
   requirement is stated in px and does not scale. Measured: the inline chrome is
   254px at 100%, so 22em alone would leave a 98px rail.

**What changes on Statistics, per repair.** The two have different reach and
must not be described together, which is the correction below.

*Repair 2 leaves the distribution rows untouched at every width and every text
scale.* Its container is declared on one selector, `.sr-wx-pair > *:not(.sr-only)`,
and the four `DistGroup` call sites are structurally outside it, so the
`@container` block cannot reach them. Measured pre and post over 222
configurations: zero change anywhere between 470 and 660px, which is precisely
the band the design spec warned a wholesale scoping would move. What it does
change is the per-species rows, which now stack when their own column is narrow
in units of its own text rather than when the viewport is under 640px.

*Repair 1 also reaches the distribution rows, and repairs them there too.*
`overflow-wrap: anywhere` sits in the shared `@media (max-width: 640px)` tier on
`.sr-wx-row > .sr-wx-label`, and `DistRow` renders that same element. The shipped
distribution rows carried label-over-count readings at supported widths, worst
21.88px on "Overcast" at 320px / 200%, and carry none afterwards; the change is
confined to 300 to 355px at 200% text scale, at the cost of a taller row there.
This is inside FR-27 rather than an exception to it, because FR-34 is stated over
a row's label with no per-species restriction, so a `globals.css` rule that
satisfies it on a second set of rows is the requirement being met.

**I stated this wrongly and it was caught by measurement, not by review.** An
earlier revision of this section said "Distribution rows are untouched at every
width", which is true of repair 2 and false of repair 1. I reasoned about the
per-species row throughout and never wrote down that repair 1's selector reaches
every `.sr-wx-row`; the design spec left the same thing unsaid, so the omission
propagated rather than being caught. Both are corrected at source. It is worth
recording as the shape rather than as the instance: a repair scoped by a
SELECTOR is scoped by that selector and not by the surface you happened to be
looking at when you wrote it, and the claim to check is the selector's reach, not
the feature's.

**The two stacked blocks are locked identical** by
`lib/weatherRowTierCss.test.ts`, which parses the real `globals.css`, following
the `.sr-input-16` / `.sr-ctl-row :is(button, select, input)` precedent. Verified
red on five mutation directions including the `break-word`-for-`anywhere` swap
that renders identically.

**One copy decision worth a look.** `speciesOwnWhole(1, 1)` renders "That is the
one checklist you have it on." rather than "That is 1 of the 1 checklist you have
it on.", which is what the formula produces and which fails the corpus sweep's
determiner rule, holds a numeral against itself, and reads badly where the
sentence is meant to be an account. It is the one case where the second sentence
prints no numeral, so QA-34's numeral-equality assertion is stated for totals of
two and up and answered in words at one. Documented at the definition site.

**The corpus sweep's plural-verb rule was refined, not loosened.** FR-33 requires
"You have it on 1 checklist, and it does not carry a weather block.", and the
shipped rule flagged `carry` there because a bare infinitive after an auxiliary
looks like a finite plural verb. The rule now skips a verb preceded by an
auxiliary, and `do` joins the verb list so the auxiliary itself is still caught:
"1 checklist do not carry" stays red. Guard-the-guard asserts both directions.

**Nothing is persisted.** No `clearDerived.ts` row (there is no document to
delete, and `cacheInventory.test.ts` is unchanged), no durable cache, no worker
payload field, no `storage` write, no network call, no `PRIVACY_POLICY.md`
change. The teardown is the `WeakRef` and needs no caller discipline.

**Known limitation, recorded rather than fixed.** The tab's own "Checklists"
stat is a row count while this card's figure is a distinct-submission count, so
they can disagree for a species reported at both parent and form level on one
checklist. Measured at 4 species of 282 on the reference export. That is the
user's recorded decision: the card spends no copy explaining it, and the row-count
stat is follow-up work.

---

## Convention Flags

- A container query whose threshold must ALSO clear an absolute px floor is
  written as a disjunction of two `max-width` conditions, which is `max(em, px)`
  spelled the way a query can spell it. Same shape and same reason as
  `.sr-input-16`'s `max(16px, 0.75rem)`: the scale-tracking term governs at large
  text, the absolute term is what keeps the 100% case off the floor. Avoids
  `calc()` inside a container condition, whose support at the app's minimum iOS
  is not settled.
- Two declaration blocks that must stay identical but live under DIFFERENT
  at-rules cannot be one rule, so they are locked identical by a test that parses
  the real `globals.css` selector-for-selector and property-for-property. This
  extends the `.sr-input-16` / `.sr-ctl-row` precedent from one declaration to a
  whole block, and the mutation check must include a swap that renders
  identically (`break-word` for `anywhere`) or it is not testing the thing.
- A file-scoped ABSENCE guard (no `.indexOf(`, no `.includes(`) is satisfied by
  writing the loop, never by narrowing the guard to admit the call site you
  happen to like. The saving is nothing and the loosening is permanent.
- A copy corpus sweep's plural-verb rule exempts a bare infinitive after an
  auxiliary ("it does not carry"), and closes the hole that opens by putting the
  auxiliary itself in the verb list. Assert both directions.
- A count-bearing string whose general formula reads wrong at one takes its own
  sentence rather than being forced through the formula, and any guard asserting
  a figure appears twice is then stated over the range where both figures are
  numerals, with the singular answered in words and the exception named at the
  definition site.
- "No chart code is loaded" inside an already-lazy tab is satisfied by a SECOND
  `lazy()` within it, and the entry-chunk guard then asserts the component is
  absent from the TAB's static graph as well as from App's, with a positive leg
  proving the tab's graph really does reach the seam.
