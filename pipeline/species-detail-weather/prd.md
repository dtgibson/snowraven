# PRD — Species Detail Weather

**Feature:** species-detail-weather
**Date:** 2026-09-07
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A **Weather** card on the Species Detail tab that shows, for the species already
selected, the sky conditions and temperature bands that bird has turned up in,
each row carrying the same band's share of all the user's outings beside it. It
is the v1.0.22 Weather section's per-species view rendered on the bird's own
page, with no picker of any kind, out of the same derivation
(`computeWeatherStats`) that Statistics already paints from. No new parser, no
new provider, no network call, no key, no write, and no change to
`PRIVACY_POLICY.md`.

Two things ride with it, both decided at the Stage 4 design review. The card's
opening block states **one numerator against two wholes**: the bird's
weather-block count against the user's whole weather record, and the same count
against the bird's own record. And the shared row primitive carries **two
confirmed layout defects in the shipped v1.0.22 Statistics Weather section**,
both found at 320px and 200% in-app text scale and both repaired here, which
means this build deliberately changes how that shipped section renders.

---

## User Stories

> **US-01** — As a birder on Species Detail with a bird selected, I want to see
> the skies and temperatures I have recorded it in without leaving the page or
> selecting anything, so that the weather record sits beside the bird's other
> facts instead of two tabs away.

> **US-02** — As a birder, I want the bird's own count of weather-block
> checklists stated before any bar, so that I know how much of that bird's
> history the card can actually speak to before I read a picture of it.

> **US-03** — As a birder looking at a bird I have eleven weather blocks for, I
> want each row to carry the same band's share of all my outings, so that I can
> tell a fact about the bird from a fact about when I go birding.

> **US-04** — As a birder whose records for a bird mostly predate my weather
> blocks, I want a plain sentence saying how many it has and no chart at all, so
> that I am never shown a confident-looking distribution built on three
> checklists.

> **US-05** — As a birder who has never opened Statistics on this device, I want
> the card to be correct anyway, so that a page about my own file is not waiting
> on a visit to a different tab.

> **US-06** — As a birder with no weather blocks in my export, I want no card and
> no cost for it, so that a feature I cannot use does not slow down the tab I do.

> **US-07** — As a birder who can reach both surfaces in two clicks, I want the
> card and the Statistics per-species view to agree about my own data, so that I
> never have to work out which of two numbers is the real one.

> **US-08** — As a birder looking at a bird I have 1,307 checklists for, I want
> to know how many of *those* carry a weather block, so that I can tell how much
> of this bird's own history the card is speaking to, not just how much of my
> weather record it occupies.

> **US-09** — As a birder who reads the app at 200% text, I want the row labels
> to stay out of the counts and the bars to still be bars, so that enlarging the
> text does not take the chart away from the reader who needed it enlarged.

---

## Functional Requirements

### A. The card, its selection, and its four states

> **FR-01** — The card shall take its species from Species Detail's existing
> species selector. It shall render no selector, picker, combobox, "All species"
> rest state, or species state of its own. Where no species is selected, the card
> shall not render.

> **FR-02** — The card shall address the published per-species table by
> `normalizeSpeciesName(selection)`, because that table dedupes on the normalized
> common name and holds no form-level rows. Where the selection is a form whose
> normalized name differs from it (Show subspecies on), the card shall report the
> parent species and shall say so in one clause (FR-13).

> **FR-03** — Where the normalized name is absent from the table, the bird's
> count shall be zero. An absent name means a bird on no readable-block
> checklist. It is never an error, never a thrown load, and never a reason to
> hide the card.

> **FR-04** — The card shall have exactly FOUR states, decided by ONE exported
> discriminator in `lib/weatherStats.ts` beside the shipped
> `weatherSectionState`, taking the stats object and the bird's own count and
> returning `'absent' | 'export-below-floor' | 'bird-below-floor' | 'full'`. One
> discriminator, read by the card and by anything that ever refers to it, so
> "the card does not render and nothing else points at it" cannot half-happen.
> The tests are evaluated in this order, and the order is load-bearing: the
> export's floor is read before the bird's, so a user with four readable blocks
> is told about their export rather than about this bird.
>
> | State | Condition |
> |---|---|
> | `absent` | `foundCount === 0` |
> | `export-below-floor` | `readableCount < WEATHER_SECTION_MIN_READABLE` |
> | `bird-below-floor` | the bird's own readable-block count `< WEATHER_SPECIES_MIN_CHECKLISTS` |
> | `full` | neither floor is short |

> **FR-05** — **Absent.** The card shall render nothing at all: no card, no head,
> no placeholder, no reserved space, and no entry in anything that lists the
> tab's sections.

> **FR-06** — **Export below floor.** The card shall render the coverage line
> `belowFloorLine(readable)`, the shipped `WEATHER_COPY.belowFloorBody`, and the
> shipped route `WEATHER_COPY.route` to the Weather tab, and nothing else: no
> bars, no per-band figure, and no figure about this bird. Same words and same
> destination as the Statistics section's below-floor state, because it is the
> same state about the same export.

> **FR-07** — **Bird below floor.** The card shall render the bird's name through
> `<BirdName>`, one sentence stating the bird's own count against the
> readable-block total, and the floor note built from
> `WEATHER_SPECIES_MIN_CHECKLISTS` rather than from a re-spelled number. It shall
> render no bars, no reference figures, no group denominators, and **no route to
> anywhere** (OQ-02). A count of zero shall take its own wording rather than
> printing "is on 0 of your N". The state renders the SAME opening block as the
> full state, in the same place and at the same weight: the name, the two-wholes
> sentences (FR-30), the muted basis run, and only then the floor note. Only the
> chart is absent. This is the state four birds in five will see, so it is the
> full card with the chart not yet arrived, never an empty-state box with a
> dashed border and a centred glyph: a birder stepping through their list must
> read one continuous sentence per bird, with the opening paragraph neither
> moving nor changing register nor acquiring an apology between one bird and the
> next.

> **FR-08** — **Full.** The card shall render, in this order: the bird's own
> count against the readable-block total (FR-14), the same count against the
> bird's own record (FR-30), the basis clauses that apply (FR-13), the confound
> sentence (FR-19), then the sky group and the temperature group (FR-15 onward).

### B. The floors, and what the figures are a function of

> **FR-09** — `WEATHER_SPECIES_MIN_CHECKLISTS = 10` shall be a named constant in
> `lib/weatherStats.ts`, carrying its reason in the code, following
> `RATINGS_MIN_TO_SHOW`, `ONLY_ADULTS_MIN_ASSETS`, `WEATHER_SECTION_MIN_READABLE`
> and `WEATHER_BAND_MIN_TO_SHOW`. It shall **not** import
> `WEATHER_SECTION_MIN_READABLE`, shall not be derived from it, and shall not be
> expressed as a multiple of it: two independent judgments, one about an export
> and one about a bird, which may share a value and must not share a constant.
> The reason, which the code shall carry in these terms: the same five checklists
> are read differently in the two places. On Statistics they are the whole of a
> user's weather record and a reader discounts them as such; on a bird's own page
> a chart reads as a fact about that bird, and ten is where the bird's largest
> band can stand clear of the ones and zeros that eleven sky conditions spread
> five records into. (OQ-01)

> **FR-10** — The floor shall be measured against the bird's own readable-block
> checklist count (`species.checklists[i]`), never against a per-axis sum. A
> readable block can carry a wind and no sky and no temperature, so an axis sum
> understates by exactly the checklists it skipped, and a bird would then be
> refused a chart it had earned.

> **FR-11** — The card's figures shall be computed from
> `filterObservations(observations, true)` — every form included — with the
> checklist array derived from the same filtered observations, so the pair passed
> to `computeWeatherStats` is self-consistent. That `true` shall be a **literal
> constant at the call site**, never read from, threaded from, or defaulted from
> any control state on any tab. (OQ-04)

> **FR-12** — The card's figures shall not change when Show subspecies, Show all
> forms, Show escapees, the Statistics tab's Count all forms or Count escapees,
> or Species Detail's county and date filters change. The escapee set is not an
> input to `computeWeatherStats` today and shall not become one.

> **FR-13** — The card shall state its basis rather than leave two numbers to
> disagree in silence. Always: counts are checklists, not sightings (the shipped
> `speciesLedeParts().note`). When a county or date filter is active: one clause
> stating that these figures cover every checklist in the export and are not
> narrowed by the filter. When the selection is a form whose normalized name
> differs from it: one clause stating that every form counts as its parent
> species. Each clause shall be absent when it does not apply, following the
> shipped `unreadableClause` shape, so nobody is made to read an explanation of a
> filter they did not set. Both clauses join the muted run that follows the lede,
> after the shipped "Counts are checklists, not sightings.", in the order
> lede-note, filter, form, so the common case is exactly the shipped one
> sentence. The filter clause reads "These cover every checklist in your export,
> so this tab's filters do not narrow them." and the form clause reads "Every
> form counts as its parent species." The form clause does not name the parent:
> the lede's `<BirdName>` already shows it, and naming it twice is a second place
> for one fact. Both clauses cover FR-30's two figures without a third clause,
> because both figures are export-wide.

### C. The figures and the copy

> **FR-14** — The bird's own count shall come first, before any bar, through the
> shipped `speciesLedeParts(onCount, readable)` with the name rendered by
> `<BirdName>`. The sentence is not re-worded here.

> **FR-15** — The card shall render two groups: sky, all eleven rows, and
> temperature, all seven rows. No band shall be dropped, including a band with a
> count of zero. Dropping bands makes the distribution itself lie.

> **FR-16** — The rows shall follow `pipeline/design-system.md`'s
> subset-against-a-population pattern, which names this card as its exemplar. Each
> group's rows shall be scaled to the **bird's own largest value on that axis**,
> computed per axis and never shared between the two. Each row shall print its
> count and that count's share of the bird's own axis total
> (`speciesRowShare`), then the same band's share of all the user's outings as a
> muted trailing figure (`speciesRowReference`). Nothing shall divide one by the
> other. The shared rail, with the population as the track and the bird as the
> fill, shall not be used: it is the treatment the user rejected on their own
> export at the v1.0.22 preview, in the words "1 of 395 and a tiny bar".

> **FR-17** — A band with no outings at all shall carry the shipped `NO_OUTINGS`
> and no reference figure and no numeral. "outings 0%" only repeats what the row
> already said, and printing it would collapse the one distinction the chart most
> needs: a band the bird was never in against a band the user has never birded.

> **FR-18** — Each group shall state its own denominator through the shipped
> `speciesGroupDenominator(sum, speciesTotal, axis)`, whose "of its N" phrasing
> is what stops a skimmer reading the sum as an outing count.

> **FR-19** — The confound shall be named once, above the pair, through the
> shipped `speciesChartNote(speciesName)`, then shown continuously by the
> per-row reference figure.

> **FR-20** — The sky rows shall render in the same display order the Statistics
> section uses, addressed by the payload's explicit `index` rather than by array
> position, so the two views can be compared row for row and the species
> alignment cannot drift.

> **FR-21** — Every new count-bearing string shall be added to
> `lib/weatherStatsCopy.ts` and nowhere else, so it rides the generated corpus
> sweep in `weatherStatsCopy.test.ts`. A count-bearing string built inline in the
> component is invisible to that sweep however correct it happens to be today.
> The shipped copy functions shall be reused rather than re-worded, and
> `speciesLedeParts`, `speciesChartNote`, `speciesRowShare`,
> `speciesRowReference`, `speciesGroupDenominator`, `belowFloorLine`,
> `WEATHER_COPY.route`, `WEATHER_COPY.belowFloorBody` and `NO_OUTINGS` shall be
> unchanged by this work. Six new functions join the module and the sweep, and no
> others: `speciesFloorNote()`, `speciesZeroLedeParts()`, `speciesOwnWhole()`,
> `speciesOwnWholeZero()`, `filterBasisClause()` and `formBasisClause()`.
> `speciesFloorNote()` shall be built from `WEATHER_SPECIES_MIN_CHECKLISTS` the
> way `legendFloorNote()` is built from `WEATHER_BAND_MIN_TO_SHOW`, and shall
> name what would change rather than what is missing.

> **FR-22** — No copy on the card shall predict, recommend, or rank. The phrases
> "best conditions for", "you should try", "expect to find", "most associated"
> and the word "correlation" shall not appear, and no ranked list of anything
> shall be rendered. The new strings join the same forbidden-phrase sweep.

### D. Placement and integration

> **FR-23** — The card shall ship as its own component file,
> `frontend/src/components/SpeciesWeatherCard.tsx`, following the shipped
> heavy-section precedent. `SpeciesDetail.tsx` is 1,678 lines and shall not grow
> by more than 40 lines.

> **FR-24** — The card shall be one `SectionCard` with a `SectionHead` from
> `components/speciesDetail/ui.tsx`, titled **Weather**, matching the tab's other
> sections. It shall sit low in the tab's section order and never above the
> bird's own history: it shall not render above Top Locations. The exact slot
> below that line is The Designer's.

> **FR-25** — Species Detail carries no section index and no jump affordance
> today; its sections are cards in document order, and its only in-tab jump is
> the Subspecies Explorer's scroll into its own breakdown. This feature shall not
> add one. A section index listing one card would be a new navigation affordance
> shipped as a side effect of a weather card, on a tab whose ten existing
> sections have done without it. The absent state (FR-05) therefore requires
> nothing beyond the card not rendering. (OQ-03)

> **FR-26** — The row primitive shall have exactly ONE implementation in the
> repo. Where it is extracted from `WeatherStatsSection.tsx` so both surfaces can
> use it, a second copy of the row is not permitted: a pair that agrees today is
> a pair that will disagree later, on a screen where the user can reach both in
> two clicks, about their own data.
>
> **The byte-identical-rendering condition this requirement previously carried is
> withdrawn, deliberately.** One primitive means one set of layout rules, so the
> two repairs in FR-34 and FR-35 change how the shipped Statistics Weather
> section renders, and that is the decision rather than an accident. A narrower
> condition replaces it. A change to the shared row is correct only when all five
> hold: it repairs a defect confirmed against the SHIPPED build in a real browser
> engine, never a preference; it changes layout rules only, in `globals.css`, and
> touches no data, no copy, no markup structure and no component behaviour; it is
> verified on BOTH surfaces, in a real browser, at the configurations the defect
> actually lives in (FR-36); the shipped Statistics section is verified
> unregressed by the same means (NFR-14); and the repair is measured to REMOVE
> the defect rather than relocate it, so every failing configuration passes and
> every previously passing one still does.

> **FR-27** — The Statistics Weather section changes in exactly two ways and no
> others: the two shared-row layout repairs in FR-34 and FR-35, both of them
> rules in `globals.css`. Its data, its derivation, its copy, its picker, its
> per-species view, its distribution charts, its band blocks, its markup and its
> component file's behaviour all stay exactly as shipped, and every existing
> Statistics figure shall be unchanged on the reference export before and after
> this work. `stats.species.names` shall not be widened: it feeds the Statistics
> picker directly, so admitting species with no readable-block checklist would
> make that picker offer birds whose chart is all zeros, which is an FR-27
> regression in its own right.

### E. The bird's own whole

> **FR-30** — The opening block shall state ONE numerator against TWO wholes: the
> shipped `speciesLedeParts` (the bird's count against the user's weather-block
> checklists), then `speciesOwnWhole()` (the same count against the checklists
> the bird is on). The second sentence shall begin "That is", which is doing real
> work rather than being a stylistic tic: without it the same figure printed
> twice reads as two different counts, and with it the repeated number is
> unmistakably one number held against two wholes, which is the card's whole
> thesis stated in the lede before the chart demonstrates it. **Nothing shall
> divide one by the other.** There shall be no coverage percentage for the bird,
> on the card or anywhere, now or later.

> **FR-31** — The second figure's denominator shall be a distinct-submission
> count over Species Detail's raw unfiltered parse (`phase.observations` from
> `loadEbirdObservations()`), matched with `normalizeSpeciesName` on BOTH sides,
> so numerator and denominator fold forms into the parent on exactly the same
> basis. That count is export-wide by construction, because the county and date
> filters touch only `speciesObs`, and all-forms by construction, because
> `filterObservations(obs, true)` is a passthrough and the raw parse therefore IS
> the all-forms set. It satisfies FR-11's basis with no payload change, no new
> field on `WeatherStats.species`, and no seam change.

> **FR-32** — The name-to-count map shall be built ONCE, in the same post-paint
> effect and the same observations-identity memo the weather read already uses,
> as one pass producing the map through a transient pair set. A species change
> shall be a map read. A per-species scan breaks NFR-02 and is not permitted
> however small it looks.

> **FR-33** — The zero case shall take its own wording (`speciesOwnWholeZero()`),
> leading with the bird's own record because there is no numerator to bind:
> "You have it on 26 checklists, and none of them carry a weather block." Both
> the noun and the verb clause shall inflect at one: "You have it on 1 checklist,
> and it does not carry a weather block." The singular is the common case here
> rather than an edge, and the figure that says so shall be treated as a test row:
> on the reference export, 49 of the 114 zero-block species sit at exactly one
> checklist. The lede in the zero case shall likewise use
> `speciesZeroLedeParts()` rather than printing "is on 0 of your N".

### F. The two shared-row repairs

> **FR-34** — **A row label shall never paint over its count**, at any supported
> viewport width from 320px up, at any in-app text scale up to 200%, in every
> engine the app ships in. The defect is confirmed in the shipped v1.0.22 build,
> reproduced in Chromium and WebKit agreeing to within 0.06px: in the stacked
> tier the label is granted a wrap allowance but no break allowance, so a
> multi-word label wraps cleanly while a single-word one cannot break at all and,
> with no clipping ancestor anywhere, paints straight through the count cell.
> Worst measured case is the label "Thunderstorm" overshooting by 48.9px at 320px
> / 200%, its track 70.3px against a min-content of 135.2px. **It is not data
> dependent and it is not an edge case:** the failing pair is "Thunderstorm" over
> the string `no outings`, which is the row every birder who has never birded a
> thunderstorm sees. The repair shall lower the label's own intrinsic
> contribution, and shall not clip, mute, truncate, abbreviate or drop the label,
> and shall not change the row's markup or its column structure. The desktop tier
> needs no repair: it clips with an ellipsis by construction.

> **FR-35** — **A rendered rail shall keep a usable width** at every supported
> width and text scale: no rail shall render narrower than **120px** at any
> viewport width from 320px up and any in-app text scale up to 200%. The shipped
> section fails this at 200% on a desktop width, measured at 0.0 to 32.6px in a
> 398px column with several rows painting no rail at all while still taking its
> height; the same column measures 193 to 240px at 100%. The 120px floor is
> chosen to separate the defect from the repair with margin at both ends rather
> than to sit near either. **The stacked row shape is already correct and already
> shipped; what changes is WHEN it fires, not what it does.** Its trigger shall
> track the row's own column measured in units of its own text, so the transition
> is monotonic in the condition it is actually about, rather than keyed on a
> viewport width in px that the column count underneath it can change
> independently of. This does not contradict the v1.0.22 decision against a
> container query: that decision rejected one because "how wide is my box" cannot
> answer "how wide is my content", and it was right, which is why the reference
> figure took its own row unconditionally. That change removed the
> data-dependent half of the width, and what remains varies with the text scale
> alone, which a query in `em` tracks exactly. Taking FR-35 also dissolves
> FR-36's two disjoint bands, because keyed on the column there is nothing left
> to be non-monotonic in; the failure is removed rather than relocated.

> **FR-36** — Both repairs shall be verified at the configurations the defects
> actually live in, on **both** surfaces. Finding 1 fails in two **disjoint**
> viewport bands at 200%, roughly **300 to 365px** and **620 to 640px**. The
> second exists only because `.sr-wx-pair`'s `auto-fit` grid flips from one
> column to two at about 620px, halving each column and collapsing the label
> track while the 640px rules are still in force. A check at 320 and 900 finds
> the first band and misses the second; a check at 375, 414, 480 or 560 finds
> neither. Verification shall therefore sweep **both bands in steps of no more
> than 5px**, at 100%, 150% and 200% in-app text scale, in **both Chromium and
> WebKit**, over the new card **and** the shipped Statistics Weather section, and
> shall exercise the label-over-count case with the `no outings` string and not
> only with data-bearing rows. Each repair shall be shown to fail on the
> pre-repair build and pass after, so the assertion is known to be able to reject
> a revert.

### G. The sweep that ships with it

> **FR-28** — The documentation sweep shall land in the same commit set:
> `docs/HELP.md`'s Species Detail section list gains the Weather card (its four
> states, the floor, the two shares of two different wholes, and what the toolbar
> switches and filters do and do not change), `docs/HELP.md`'s Statistics
> Weather subsection gains the sentence stating how the two surfaces' bases
> relate, `README.md` and `website/` state the feature, and `CHANGELOG.md` gains
> its entry. `weatherStatsPublishedClaims.test.ts` shall gain rows for the new
> published claims, so a claim that goes stale goes red. Two additions ride with
> it. The Species Detail passage shall describe the second coverage figure as one
> numerator against two wholes and shall state that nothing divides them, so the
> documented claim matches FR-30. And `CHANGELOG.md` shall record the two
> shared-row repairs as repairs to the **Statistics** Weather section as well as
> to the new card, because that is where existing users will notice them: an
> entry naming only the new card would leave a shipped section's rendering
> changed with nothing saying so.

> **FR-29** — The four-file version set shall be bumped together:
> `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and
> `website/index.html`'s version pill text, its `aria-label`, and the
> `footer-version` line, with the guard
> `it('the website version pill and footer follow the app version')` green.

---

## Non-Functional Requirements

> **NFR-01 — Performance, opening the tab:** the added main-thread cost of
> opening Species Detail shall be no more than 20 ms at the reference export
> scale (21,856 rows, 3,251 checklists, 353 weather blocks), measured as the
> median of five runs on a quiet machine with nothing else compiling, and
> recorded in a comment at the definition site the way `statsBundle.ts` already
> records the 48 to 65 ms chain and the 9.2 ms weather leg. The 20 ms figure is a
> **rejection threshold, not an assumption**: exceeding it means the chosen path
> is wrong for this tab, and the run's honest outcome is either a different path
> or the brief's stated finding that the seam was not worth its cost.

> **NFR-02 — Performance, switching species:** a species change shall add no more
> than 1 ms, shall parse zero weather blocks, and shall call
> `computeWeatherStats` zero times. Species Detail's whole interaction model is
> stepping between birds; a card that taxes that gesture is not worth having.
> This shall be asserted by call count, not only by timing.

> **NFR-03 — Performance, the absent state:** on an export whose checklists carry
> no weather block, the card shall render nothing and no chart code shall be
> loaded. The added cost of reaching the absent verdict shall be measured on the
> reference export shape and recorded alongside NFR-01.

> **NFR-04 — One derivation, not two implementations:** the card and the
> Statistics per-species view shall both render from `computeWeatherStats`, and
> exactly one implementation of the weather aggregation shall exist in
> `frontend/src`. A guard test shall assert that, for the same export and the
> same species, the two surfaces produce equal figures when reading the same
> variant. If the two can diverge by implementation rather than by a stated
> basis, the feature is not worth building.

> **NFR-05 — The whole-export aggregate is required:** the per-row reference
> figure is the same band's share of *all* outings and the coverage line is the
> readable count against *all* checklists, so both are export-wide. Parsing only
> the blocks on the checklists this species appears on produces the bars and
> cannot produce the card; it is not an available implementation, however cheap
> it looks.

> **NFR-06 — Not conditional on a prior Statistics visit:** the card shall render
> its correct state on a device where the Statistics tab has never been mounted,
> and shall stay correct if it never is. A cache is permitted as an
> optimisation; a cache-only read is not. The v1.0.18 `Show escapees` precedent
> does not transfer: that answer needs a network call and an eBird key, so "not
> checked yet" is a state the app cannot resolve on its own, while this answer
> needs nothing the tab does not already hold.

> **NFR-07 — Entry chunk:** nothing this feature adds shall join App.tsx's static
> import graph. `entryChunk.test.ts` shall gain assertions covering the new
> component and shall keep `lib/weatherStats.ts`, `lib/weatherBlockParse.ts` and
> `lib/statsBundle.ts` off it.

> **NFR-08 — Accessibility:** every `<button>` and every `<a href>` the card
> renders shall carry a literal `tabIndex={0}` (WebKit's default tab mode, which
> the shipped Mac, iPhone and iPad apps run, skips both without it, and
> `lib/tabOrderCoverage.test.ts` asserts it on every build). Every colour shall
> come from a `var(--sr-*)` token in both themes, with no hardcoded hex or RGB.
> WCAG 2.1 AA shall hold at 320px width and at 200% in-app text scale. The
> incompressible trailing reference figure shall take its own row at every width,
> and no positive `min-width` shall appear anywhere in the pattern.

> **NFR-09 — DOM identifiers:** every `id` and ARIA IDREF the card creates shall
> key on an INDEX, never on a species name, a condition emoji, a band label, or
> any other value read from the user's file. An id built from a data value can
> carry whitespace, which cannot resolve as an IDREF and silently switches off
> the announcement it exists for.

> **NFR-10 — Copy conventions:** no em dash (U+2014) in any string the card
> renders or in any prose this work publishes. A published claim states the
> property, never a count. User-facing surface names come from `TAB_LABELS` in
> `lib/tabLayout.ts`, never from a component name.

> **NFR-11 — Privacy and scope:** frontend only. No network call, no new
> provider, no key, no backend change, no write to storage, no durable cache
> document, no `clearDerived.ts` row, no telemetry, and no change to
> `PRIVACY_POLICY.md`. The card reads the loaded backup and nothing else, and is
> fully functional with no network.

> **NFR-12 — Clone safety:** anything this work adds that crosses a worker
> boundary shall stay plain arrays, numbers, strings and plain objects. No Map,
> Set, function, class instance, or DOM value. Where a payload field is added, it
> joins both the interface and its `Record<keyof T, true>` field table, so
> omitting the second is a build error rather than a hole in the validator, and
> the field expresses absence inside its object rather than as `null`.

> **NFR-13 — Security, linearity over untrusted text:** this work adds no new
> scan over export text. Where one is unavoidable it shall be linear by
> construction (no `includes`, `indexOf` or `find` inside a loop over export
> values) and proved at 10k / 20k / 40k hostile inputs built to FAIL after
> consuming the run.

> **NFR-14 — Real-engine verification, because the unit suite structurally cannot
> see this:** `vitest` and `eslint` are not the gate
> (`.claude/rules/testing.md`), and this repo has two consecutive releases where
> a real browser found what the unit suite could not. The stylesheet guards are
> declaration-only and say so in their own headers, and the component tests run
> in jsdom, which has no layout engine. Every claim this work makes about
> rendered geometry shall be measured in a real browser engine against a real
> build, and **the shipped Statistics Weather section shall be verified
> unregressed by that same means**, not by unit tests alone. Each defect owes an
> assertion of its own: **label ink measured against the count cell's own edge**,
> and a **minimum rendered rail width**, both swept at 200%. Page horizontal
> scroll and overflow past the card's content box shall not stand in for either,
> because neither defect produces either symptom.

---

## Out of Scope

- **A picker, selector, combobox or species control of any kind on the card.**
  The Sky / Temperature axis toggle may travel if The Designer wants it, because
  it is a question about the card rather than about which bird. Anything that
  names a species may not.
- **Wind and day/night per species.** They are whole-export axes on Statistics
  and are not in the published per-species table. Adding either is a payload
  change and a follow-on run.
- **Any change to the Statistics Weather section beyond the two shared-row
  layout repairs** (FR-27, FR-34, FR-35). Those two are now IN scope and are
  `globals.css` rules only. Everything else about that section stays as shipped:
  its data, its derivation, its copy, its picker, its per-species view, its
  distribution charts, its band blocks and its markup. A third repair found in
  the same file during this build is a separate decision, not a ride-along.
- **The Species Detail "Checklists" stat being a row count rather than a deduped
  one.** It is `speciesObs.length`, so it can read higher than this card's
  figure where a checklist carries both a parent and a form. Measured on the
  reference export: 4 species of 282 disagree at all (Mallard +7,
  Yellow-rumped Warbler +3, Dark-eyed Junco +1, Northern Flicker +1), 12 rows in
  21,369. Captured as follow-up work; see Recorded Decisions for why the card
  spends no copy on it.
- **The Frequency stat's mixed bases.** `SpeciesDetail.tsx` divides that same row
  count by `totalFilteredChecklists`, which is a Set of submission ids, so
  numerator and denominator sit on different bases and Frequency is
  systematically overstated for those four species and can in principle exceed
  100%. It cannot on the reference export, and the correctly deduped count is
  already sitting in the component. Captured as follow-up work and explicitly not
  folded into this build.
- **Widening `verify-weather-species-rows.mjs`.** See OQ-08: that is a decision,
  not an assumption this PRD may make on the harness's behalf.
- **`--sr-card-shadow` still being on pure black** while the design system says
  shadows are tinted with the app's own ink. Noticed while checking this card,
  worth a roadmap line, not this feature's work.
- **Any ranked or predictive claim about the bird**, and any leaderboard.
- **Any rate.** Two shares of two different wholes sit side by side and nothing
  divides one by the other.
- **Respecting the county and date filters.** The card is export-wide and says so
  (FR-13). Narrowing it per filter would require a recompute per filter change,
  which NFR-02 and NFR-05 both forbid.
- **Tide.** Same comments, same deferral, same reason.
- **Weather on the Calendar or the Map Explorer.**
- **A section index or jump nav for Species Detail** (FR-25).
- **A new tab, and any change to the tab navigation.**
- **Any network call, key, backend change, provider, or write.**
- **Retiring or re-scoping ROADMAP.md Up Next item 1** (`WebStorage.readFile`'s
  never-settling promise). It stays first after this ships, and this is the
  second run in a row it has been deferred.

---

## Recorded Decisions

**The card's checklist figure is the correct one, and it spends no copy saying
so.** On the reference export, 4 species of 282 show a lower count on this card
than the tab's own "Checklists" stat two sections above it, because that stat is
a row count and this card's is a distinct-submission count: Mallard +7,
Yellow-rumped Warbler +3, Dark-eyed Junco +1, Northern Flicker +1, twelve rows in
21,369, with all five birds in the design stepper exact. The user's decision is
to leave the card as it is and spend no copy explaining the difference. This is
**recorded as a decision, not carried as a defect**, and the honest limit is
stated with it: that 0.06% is a property of one birder's subspecies-reporting
habit rather than of the code, and someone who logs Myrtle and Audubon's
routinely would see a wider gap on the same path. The row-count stat itself is
follow-up work (see Out of Scope), and closing it there is what makes the two
figures agree.

**The two shared-row repairs ship with this build.** They were found at Stage 4
while checking the new card at 320px and 200% in-app text scale, confirmed
independently against the live v1.0.22 build, and they live in the row primitive
FR-26 requires this feature to share rather than copy. Repairing them therefore
changes how the shipped Statistics Weather section renders, and that is the
decision. The alternative was to copy the row rather than share it, which FR-26
forbids for the reason the brief gives: two implementations that agree today are
two numbers that will disagree later, on a screen where the user can reach both
in two clicks, about their own data.

---

## Open Questions

### The brief's four, resolved

**OQ-01 — the per-species floor.** Resolved in **FR-09**:
`WEATHER_SPECIES_MIN_CHECKLISTS = 10`, a new named constant in
`lib/weatherStats.ts`, not an import of and not derived from
`WEATHER_SECTION_MIN_READABLE`. Ten rather than five because the same five
checklists are read differently in the two places: on Statistics they are the
whole of a user's weather record and a reader discounts them as such, while on a
bird's own page a chart reads as a fact about that bird and has to earn more.
Below ten, a bird's records spread across eleven sky conditions are ones and
zeros, and the bars are scaled to the bird's own largest band, so a band with two
paints a full-width rail and the picture is decided by which single band happened
to get a second checklist. The stated cost, which is an argument for the sentence
rather than for a lower floor: on the reference export 353 of 3,251 checklists
carry a block, so **the sentence will be the ordinary outcome for a large share
of species**, and FR-07 is written for that rather than treating it as an edge
case.

**OQ-02 — does the below-floor card route anywhere?** Resolved in **FR-06** and
**FR-07**, differently for the two below-floor states.

*Export below floor keeps the route*, in the shipped words and to the shipped
destination, because there the statement is about the whole export and filling in
the backlog is exactly the thing that changes it. Same state, same sentence, same
place to go as on Statistics.

*Bird below floor routes nowhere.* Three reasons, each sufficient. The card
cannot know whether the backlog reaches this bird: the backlog is a list of the
user's blockless checklists across the whole export, and nothing on the card
knows how many of them carry this species, so "fill in the gaps" printed beside a
sentence about one bird reads as "and then this chart will appear", which the
card cannot promise. The state is the ordinary outcome for most species (OQ-01),
so a call to action inside it would appear on most birds most of the time and
would train the reader to ignore it. And the brief's own constraint is that a
below-floor card must read as a fact about coverage rather than as a broken
chart; a fix-it button is precisely what makes it read as broken. What the card
gives instead is the thing it *can* promise: the floor, named, built from the
constant, so the reader knows exactly what would change the answer.

**OQ-03 — the section index.** Resolved in **FR-25**: Species Detail carries no
section index and no jump affordance today, so there is nothing to join, and this
feature shall not add one. Its ten sections are cards in document order, and its
only in-tab jump is the Subspecies Explorer scrolling into its own breakdown,
which is not an index. Inventing one for a single new card would ship a new
navigation affordance as a side effect of a weather card. The second half of the
question therefore answers itself: in the absent state the card simply does not
render, and nothing else has to be kept in step with it. FR-04's single
discriminator is what keeps that true if an index is ever added later.

**OQ-04 — which variant is published, and does the card state its basis?**
Resolved in **FR-11**, **FR-12** and **FR-13**. The card reads the **all-forms
variant**, `filterObservations(observations, true)`, with `true` a literal at the
call site and never threaded from any control state, so the figures are a
function of the export and the bird exactly as the brief requires. And **yes**,
the card states its basis.

Three reasons for all-forms rather than the countable-only variant that matches
the Statistics tab's default:

1. **It is the only variant in which every species the user can select has a
   row.** Species Detail's own Show all forms switch exists to reveal exactly the
   forms the countable-only variant erases from the published table, so under
   that variant the card would go silent, or state a false zero, on a bird the
   tab had just offered the user. That is the brief's third Key Decision arriving
   through a different door: the app failing to read a file it has open, dressed
   as a coverage statement.
2. **Its denominators are every checklist in the export, which is what the row's
   own sentence claims.** The reference figure is "the same band's share of all
   your outings", and a checklist recorded as a single `Gull sp.` was an outing.
   The countable-only variant deletes such a checklist from the record entirely,
   so the reference figure would be a share of a smaller and differently shaped
   population than its own words name.
3. **It costs nothing on the ordinary species.** For a species whose every record
   is under a countable name, the three arrays the card reads
   (`species.checklists`, `species.byCondition`, `species.byTempBand`) are
   identical under both variants, because a checklist carrying the species is
   never dropped by the filter and the species' own rows are never filtered.

The stated cost, which the basis sentence and QA-19 exist to close: where the
Statistics Weather section is showing its Count all forms OFF state, its
per-species view can print a slightly smaller readable-checklist total and
slightly smaller reference figures than the card, by exactly the checklists made
up entirely of non-countable forms. That difference shall be **measured on the
reference export and recorded** rather than assumed small. Neither figure is
wrong; they are two stated populations, and the card names which one it is on.

### Still open, with defaults

**OQ-05 — the exact slot in the tab's section order.** FR-24 sets the floor (not
above Top Locations) and The Designer chooses within it.
*Default if unanswered:* after Comments and before Named Individuals, so the card
sits below every section built from the bird's own records and above the two
sections that are about something else (named individuals, recent media).

**OQ-06 — one axis at a time, or both groups at once?** The Statistics
per-species view shows sky and temperature side by side; the brief permits the
axis toggle to travel.
*Default if unanswered:* both groups, no toggle, side by side at wide widths and
stacked at narrow ones, matching the Statistics per-species pair. A toggle is a
control, and the card's whole premise is that the user should not have to operate
anything to get the answer. If The Designer finds the pair does not fit the tab's
column, a toggle is permitted and inherits NFR-08 whole.

**OQ-07 — does the bird-below-floor state name the floor, or only the count?**
Resolved at the Stage 4 design review: it names both, with the floor built from
the constant the way `legendFloorNote()` already is, because it is the honest
replacement for the route OQ-02 declines to offer. Carried by FR-07 and FR-21.

**OQ-08 — is `verify-weather-species-rows.mjs` widened, or does a new assertion
sit beside it?** The harness is a good one and neither defect is in its field of
view, which is a fact about its instruments rather than a lapse. Run against the
same build and the same fixture it reports **all checks passed, worst reading
0.01px**, across 27 widths and three text scales in two engines, **including
320px at 200%, the exact configuration carrying 48.9px of painted overlap.** It
measures page horizontal scroll and overflow past *the card's* content box: a
label overrunning into its sibling grid column never leaves the card, and a
collapsed rail overflows nothing at all. So a new assertion that repeats its
method buys nothing, which is why FR-36 and NFR-14 specify different instruments
rather than more widths.
*Default if unanswered:* the two new assertions (label ink against the count
cell's edge, minimum rendered rail width) are added to that harness rather than
to a new one, because it already owns the dist-serving, the two engines and the
text-scale sweep, and a second harness would duplicate all three. Its existing
three readings stay exactly as they are. Whether the harness is widened, split,
or joined by a sibling is a decision for The Architect and it is stated here so
it is made rather than assumed.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01: no picker, selection from the tab | The card renders no combobox, listbox, select or species control of any kind; with no species selected it renders nothing; changing the tab's selector changes the card. |
| QA-02 | FR-02, FR-03: the lookup and its miss | With Show subspecies on and a form selected, the card renders the parent species' figures and the form-basis clause; a species absent from the published table renders the card with a count of zero, not an error, not a blank, and not a thrown load. |
| QA-03 | FR-04: one discriminator, four states | A single exported function in `lib/weatherStats.ts` returns all four states; a repo grep finds no second place deciding which state the card is in; a user with four readable blocks and a bird on none of them gets `export-below-floor`, not `bird-below-floor`. |
| QA-04 | FR-05: absent renders nothing | With no attribution-bearing block in the data, the card's container is absent from the DOM, no head or placeholder renders, and no space is reserved. |
| QA-05 | FR-06: export below floor | With one readable block, and again with four, the card renders the coverage line, the below-floor body and the route to the Weather tab, and renders no bar, no group denominator and no bird-specific figure; the strings are the shipped ones, byte for byte. |
| QA-06 | FR-07, OQ-02: bird below floor draws nothing and routes nowhere | With the export above its floor and a bird on nine readable-block checklists, the card renders the same opening block as the full state (name, both wholes, muted basis run) plus the floor note, and renders zero bars, zero reference figures and zero links or buttons; with the bird on zero, both sentences take their own wording and neither reads "is on 0 of your" nor "That is 0 of the"; stepping between an above-floor and a below-floor bird leaves the opening paragraph's position, register and wording pattern unchanged. |
| QA-07 | FR-09: the constant | `WEATHER_SPECIES_MIN_CHECKLISTS` exists in `lib/weatherStats.ts` at 10 with a reason comment; it does not import `WEATHER_SECTION_MIN_READABLE`; a grep finds no arithmetic deriving one from the other; the boundary is exact (nine draws nothing, ten draws the chart). |
| QA-08 | FR-10: the floor's denominator | A bird on ten readable-block checklists of which only six carry a sky condition renders the full state, not the below-floor state. |
| QA-09 | FR-11, FR-12: a function of the export and the bird | The card's rendered figures are byte-identical across every combination of Show subspecies, Show all forms, Show escapees, an active county filter and an active date filter; a grep finds the all-forms argument as a literal at the call site and not read from state. |
| QA-10 | FR-13: the basis clauses | The checklists-not-sightings note is present in every state that renders a figure; the filter clause appears only when a county or date filter is active; the form clause appears only when the normalized name differs from the selection; the clauses render in the order lede-note, filter, form in one muted run; with neither clause applicable the block is exactly the shipped one sentence; the form clause names no species. |
| QA-11 | FR-08, FR-14, FR-18, FR-19: the full state's order | The bird's own count sentence precedes every bar in DOM order; each group renders its own `speciesGroupDenominator`; the confound sentence appears exactly once. |
| QA-12 | FR-15, FR-17: no band dropped | All eleven sky rows and all seven temperature rows render; a band with a zero count renders; a band with no outings at all renders `no outings`, carries no numeral and carries no reference figure. |
| QA-13 | FR-16: subset against a population | Each group's bars scale to that group's own largest bird count and the two groups scale independently; each row prints the count, its share of the bird's axis total, and the muted share of all outings; no rendered figure is one share divided by the other; no shared-rail treatment appears. |
| QA-14 | FR-20: row order and index addressing | The card's sky rows are in the same order as the Statistics section's, and a fixture that reorders rows for display still aligns every species count to its own band. |
| QA-15 | FR-21: the copy sweep | The six named functions are exported from `lib/weatherStatsCopy.ts` and each appears in the generated corpus across the count grid; a grep finds no inline count-bearing string in the new component; the listed shipped functions are unchanged; `speciesFloorNote()` reads the constant rather than a literal, so raising `WEATHER_SPECIES_MIN_CHECKLISTS` moves the sentence. |
| QA-16 | FR-22: nothing predicted or ranked | The forbidden-phrase sweep passes over the enlarged corpus; the card renders no ranked list. |
| QA-17 | FR-23, FR-24, FR-25: placement, and no new navigation | `SpeciesWeatherCard.tsx` exists; `SpeciesDetail.tsx` grows by no more than 40 lines; the card renders as a `SectionCard` with a `SectionHead` titled Weather and below Top Locations in DOM order; the tab gains no section index, jump nav or anchor list, and the card is reached by scrolling as every other section is. |
| QA-18 | FR-26: one row implementation, and the narrowed change condition | A repo grep finds exactly one implementation of the species row; the diff to the shared row is confined to `globals.css` layout rules, with no change to its data, copy, markup structure or component behaviour; `WeatherStatsSection.tsx` is unmodified; `WeatherStatsSection.test.tsx` passes unchanged; and each of the two repairs is shown failing on the pre-repair build and passing after. |
| QA-19 | FR-27, NFR-04, OQ-04: the two surfaces agree, the section is otherwise untouched, and the divergence is measured | `stats.species.names` is unwidened and the Statistics picker offers exactly the species it did before; For the same export and the same species, the card and the Statistics per-species view produce equal figures on the same variant; every existing Statistics figure is unchanged on the reference export; and the number of checklists present under the all-forms variant and absent under the countable-only one is measured on the reference export and recorded at the definition site. |
| QA-20 | NFR-01: opening cost | Opening Species Detail on the reference export adds at most 20 ms of main-thread time, median of five quiet runs, and the figure is recorded in a comment at the definition site. |
| QA-21 | NFR-02: switching is a lookup | Selecting a different species calls `computeWeatherStats` zero times and parses zero weather blocks, asserted by call count; the added time is at most 1 ms on the reference export. |
| QA-22 | NFR-03: nothing paid with no blocks | On an export with no weather block, the card renders nothing, the chart code is not loaded, and the added cost of reaching that verdict is measured and recorded. |
| QA-23 | NFR-05: whole-export figures | The reference figures and the coverage total on the card equal the export-wide values, not values derived from the selected species' checklists, verified against a fixture where the two differ. |
| QA-24 | NFR-06: no prior Statistics visit | With the Statistics tab never mounted in the test, the card renders correct figures in all four states; a grep finds no read that returns nothing when a cached answer is missing. |
| QA-25 | NFR-07: entry chunk | `entryChunk.test.ts` passes with new assertions covering the card, and `lib/weatherStats.ts`, `lib/weatherBlockParse.ts` and `lib/statsBundle.ts` remain absent from App.tsx's static import graph. |
| QA-26 | NFR-08: accessibility | `lib/tabOrderCoverage.test.ts` passes with the new file; no hardcoded hex or RGB appears in the new component; the card reads and operates correctly at 320px width and 200% in-app text scale, with the trailing reference figure on its own row at both; a grep finds no positive `min-width` in the pattern. |
| QA-27 | NFR-09: index-keyed identifiers | Every `id` and ARIA IDREF the card creates is built from an index; a fixture species name containing spaces and a condition emoji both produce IDREFs that resolve. |
| QA-28 | NFR-10: copy conventions | No U+2014 appears in any string the card renders or in any prose this work publishes; surface names match `TAB_LABELS`. |
| QA-29 | NFR-11: scope, privacy, offline | No network call originates from the card under test; a grep finds no `storage.` write and no new durable document; `PRIVACY_POLICY.md` is unchanged; `cacheInventory.test.ts` is unchanged; every figure renders with the network disabled. |
| QA-30 | NFR-12: clone safety and field tables | Anything added to a worker payload survives a `structuredClone` round trip; adding a bundle field without its `Record<keyof T, true>` entry fails the build; a validator-rejected reply falls back to the on-thread compute rather than leaving a surface on its spinner. |
| QA-31 | NFR-13: linearity | Any new scan over export text measures roughly 2x growth per doubling at 10k / 20k / 40k hostile inputs built to fail after consuming the run; a grep finds no `includes`, `indexOf` or `find` inside a loop over export values in the new modules. |
| QA-32 | FR-28: documentation | `docs/HELP.md`'s Species Detail section documents the card, its four states, the floor and the two shares; `docs/HELP.md`'s Statistics Weather subsection states how the two surfaces' bases relate; `README.md` and `website/` name the feature; `CHANGELOG.md` has the entry; `weatherStatsPublishedClaims.test.ts` covers the new claims. |
| QA-33 | FR-29: the version set | The guard `it('the website version pill and footer follow the app version')` passes with `frontend/package.json`, `src-tauri/tauri.conf.json`, the pill text, the pill `aria-label` and the `footer-version` line all at the new version. |
| QA-34 | FR-30: one numerator, two wholes | Both sentences render in the opening block in that order; the numeral in the second is the same numeral as in the first, asserted by equality and not by fixture coincidence; the second begins "That is"; no percentage, ratio or rate derived from the two figures appears anywhere on the card, asserted by a grep over the rendered text for `%` in that block and by a check that no code divides one by the other. |
| QA-35 | FR-31: the denominator's basis | The second figure equals a distinct-submission count over the raw unfiltered parse with `normalizeSpeciesName` applied on both sides; it is unchanged by an active county filter, an active date filter, Show all forms, Show subspecies and Show escapees; a fixture where a checklist carries both the parent and a form contributes 1, not 2; `WeatherStats.species` gains no field and the transport seam is untouched. |
| QA-36 | FR-32: built once, never per species | Stepping through twenty species performs exactly one pass over the observations, asserted by call count on the pass; the map is rebuilt when the observations identity changes and not otherwise; the added time per species change stays inside NFR-02's 1 ms. |
| QA-37 | FR-33: the zero case and its singular | A bird on 26 checklists with no readable block renders "You have it on 26 checklists, and none of them carry a weather block."; a bird on exactly 1 renders "You have it on 1 checklist, and it does not carry a weather block.", with both the noun and the verb clause inflected; the lede in both uses the zero wording; the corpus sweep's number-agreement rules pass over both functions across the count grid, including at 1. |
| QA-38 | FR-34, NFR-14: the label never paints over the count | In a real browser engine, in **both Chromium and WebKit**, on **both** the new card and the shipped Statistics Weather section, with the `no outings` string present on the row: the label's ink right edge never crosses the count cell's left edge, swept in steps of no more than 5px across **300 to 365px and 620 to 640px**, at 100%, 150% and 200% in-app text scale. The same assertion run against the pre-repair build reports the overlap (48.9px worst case at 320px / 200% on "Thunderstorm"), so it is known to be able to reject a revert. |
| QA-39 | FR-35, NFR-14: the rails do not collapse | In a real browser engine, in both engines, on both surfaces: every rendered rail measures at least 120px at every viewport width from 320px up and at 100%, 150% and 200% in-app text scale, with no row painting zero rail while taking a rail's height. The same assertion against the pre-repair build reports the 0.0 to 32.6px collapse in a 398px column at 200%. |
| QA-40 | FR-35: the trigger is monotonic in the right quantity | Sweeping the width continuously across the 620px column flip, the stacked shape does not turn off and back on; the shape is decided by the group column's width in units of its own text, verified by holding the viewport fixed and changing only the text scale and observing the transition. |
| QA-41 | FR-36, NFR-14: the shipped section is verified unregressed in a real browser | The Statistics Weather section is measured before and after on the same build path, in both engines, across the harness's existing width and text-scale sweep plus the two new bands, and every existing reading is unchanged apart from the two repaired ones, which improve. Unit tests alone do not satisfy this row. |
| QA-42 | The card's instruments are not the harness's | The two new assertions measure the label's ink against the count cell's edge and the rail's rendered width, not page horizontal scroll and not overflow past the card's content box; a test asserts that the pre-existing card-scoped readings report zero at the exact configuration carrying the overlap, so the reason for the new instruments is recorded rather than remembered. |
| QA-43 | Recorded Decisions: the 4-of-282 divergence | On the reference export, the card's checklist count is a distinct-submission count and the tab's "Checklists" stat is a row count; the four disagreeing species are enumerated in a test fixture, the card's figure is asserted to be the deduped one, and the card renders no copy explaining the difference. |
