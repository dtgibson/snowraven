# PRD — Named Birds: honest durations and sighting timelines

**Feature:** named-birds-timelines
**Date:** 2026-09-06
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)
**Amended:** 2026-09-06, after the approved second design pass
(`design-spec.md`, Stage 4) made the timeline marks selectable. Every surviving
FR, NFR, OQ and QA id keeps its number; struck items are marked **STRUCK** in
place with a pointer to what replaces them, so a reference from `schema.md` or
`design-spec.md` never lands on a missing or silently repurposed row.

---

## Feature Overview

Replace the Named Birds elapsed-span figure with arithmetic that agrees with the
true number of days between two dates and that never lets one coarse unit stand
for a month-wide range, and give the tab two new pictures of the same fact: a
per-bird sighting timeline inside each expanded card, and one master timeline at
the bottom of the tab with a lane per named bird on a shared time axis. One
range control governs all three, switching the right-hand endpoint between the
bird's last sighting and today. Following a user-directed scope change at the
design stage, the marks on both timelines are selectable: each strip is a
keyboard-operable listbox whose marks are options, and a fixed line beneath the
axis names the sighting the reader has landed on.

---

## User Stories

> **US-01** — As a birder following a resident bird, I want the "how long" figure
> on its card to match the span I count myself, so that I stop reading a number I
> know is wrong.

> **US-02** — As a birder reading a card, I want the surface to say which two
> dates the figure measures, so that I do not have to guess whether it runs to my
> last sighting or to today.

> **US-03** — As a birder who has followed one individual for a season, I want to
> see the shape of its sightings in time, so that I can tell a daily resident
> from a spring visitor from a bird I have not seen in months.

> **US-04** — As a birder deciding whether a bird is still around, I want to
> switch the right-hand end of the picture from its last sighting to today, so
> that the gap since I last saw it becomes visible rather than inferred.

> **US-05** — As a birder with several named birds, I want one strip at the
> bottom of the tab showing every individual on the same time axis, so that I can
> answer "which birds was I following when" without expanding any card.

> **US-06** — As a birder using a screen reader or a phone at large text, I want
> every fact the timelines show to be reachable as text and the tab to stay
> readable at 320px, so that the new pictures cost me nothing.

> **US-07** — As a birder looking at a cluster of marks, I want to land on one and
> be told its date and place, so that I can read the picture without counting
> pixels or scrolling to the report rows. *(Added by user direction at the design
> stage; it is what turns the strips from decoration into a second view.)*

---

## Functional Requirements

### A. The elapsed-span arithmetic (`frontend/src/lib/formatDate.ts`)

> **FR-01** — The app shall expose a pure exported helper `elapsedDays(from, to)`
> returning the exact number of whole calendar days between two dates, computed
> from the Y/M/D parts by integer civil-day arithmetic. It shall never construct
> a `Date` from a `YYYY-MM-DD` string (the module's existing timezone contract),
> never read the clock, and never throw. Order shall not matter: a reversed pair
> returns the same magnitude. It shall return `null` when either side is
> null, empty, or unparseable, using the module's existing `parseParts`.

> **FR-02** — The app shall expose a pure exported helper
> `formatElapsedSpan(days: number)` that renders a day count as display text. It
> takes a **day count**, not a date pair, so that converging Statistics'
> `formatSpanLength(days: number)` onto it later is a call-site change rather
> than a rewrite (Key Decision 9). It shall return `''` for a non-finite or
> negative input and shall never throw.

> **FR-03** — `formatElapsedSpan` shall render exactly these bands, and nothing
> else. `DAYS_PER_MONTH` is 30.44 (the constant `formatSpanLength` already uses);
> `DAYS_PER_YEAR` is 365.
>
> | Day count `n` | Output |
> |---|---|
> | `n === 0` | `Same day` |
> | `1 <= n <= 60` | `N day` / `N days` (exact) |
> | `61 <= n < 365` | `M mos.` where `M = floor(n / 30.44)`, followed by ` R days` where `R = n - round(M * 30.44)`, the day part omitted only when `R === 0` |
> | `n >= 365` | `Y yr.`/`Y yrs.` where `Y = floor(n / 365)`, followed by ` M mo.`/` M mos.` where `M = round((n - Y * 365) / 30.44)`, the month part omitted only when `M === 0`; when `M` rounds to 12 it carries into `Y + 1` and the month part is omitted |
>
> Singular and plural forms are `1 day` / `2 days`, `1 mo.` / `2 mos.`,
> `1 yr.` / `2 yrs.`

> **FR-04** — The rendered figure shall never let its smallest shown unit stand
> for a range wider than one of that unit. Below 365 days the string is an exact
> representation of the day count (the parts sum back to `n` by construction).
> At or above 365 days the figure is accurate to within half a month.
> Specifically: **`2 mos.` shall mean exactly 61 days and nothing else**, which
> is the defect this feature repairs.

> **FR-05** — `formatSightingDuration(from, to)` shall be retained as the call
> site's entry point and shall be the composition
> `formatElapsedSpan(elapsedDays(from, to))`, returning `''` when `elapsedDays`
> returns null. The fixed 30-day borrow at `formatDate.ts:214-217` is removed.

> **FR-06** — `formatSightingDuration`'s docstring shall be corrected. It
> currently claims "a rounded, human-readable elapsed span" over an
> implementation that floors, and describes the 30-day borrow as "a deliberate
> display approximation". The replacement shall state the band table (FR-03), the
> exactness property (FR-04), and the fact that the function stays pure because
> it takes both endpoints as arguments and never reads the clock.

### B. The duration figure on the card

> **FR-07** — The Named Birds card header shall render the duration figure for
> the **active range** (FR-10): from the bird's `firstSeen` to its `lastSeen`, or
> from its `firstSeen` to today. The date-range line above it
> (`formatDate(firstSeen) – formatDate(lastSeen)`) shall be unchanged in both
> ranges: those two dates are facts about sightings and do not move when the
> range moves.

> **FR-08** — The surface shall name the endpoints the figure measures in visible
> text, in both ranges, rather than leaving them to be inferred from the control's
> state. The wording is the Designer's (see OQ-02); the requirement is that a
> reader who has not touched the control can tell which two dates the number
> spans.

> **FR-09** — The `NamedBirdsTable` instance on Species Detail (the Named
> Individuals section, `showSpecies` false, `singleOpen` absent) shall render its
> duration figure from `firstSeen` to `lastSeen` always, shall render no range
> control, and shall render no timeline. That instance carries no range state
> (Key Decision 7).

### C. The range control

> **FR-10** — The Named Birds tab shall hold one range value with two states,
> stored as label-agnostic values naming the endpoint the switch moves:
> `'last-sighting'` (the default) and `'today'`. The values shall not encode the
> visible labels, so a relabel touches only the copy module.

> **FR-11** — The range value shall be **shared across the whole tab**: the
> control rendered inside an expanded card and the control rendered above the
> master timeline read and write the same value, and every duration figure, every
> per-bird timeline and the master timeline on that tab follow it together. Two
> controls answering the same question that can disagree is the ambiguity this
> feature exists to remove (Key Decision 3, applied at tab level).

> **FR-12** — The range value shall be **session-only React state**, not
> persisted, and shall not touch `localStorage` or the `storage` seam. Because a
> tab stays mounted once opened, it survives leaving and returning to the tab and
> resets on relaunch. Published prose shall use the settled house phrasing
> "per-session, resetting on relaunch".

> **FR-13** — The control shall reuse the shipped pill pattern already in
> `NamedBirdsTable` (self-bordered `<button>`s inside `.sr-wrap-flex`, each with
> `.sr-touch-target`, `aria-pressed` reflecting selection, a literal
> `tabIndex={0}`, and a `role="group"` wrapper with an `aria-label`). It shall
> **not** import `SegControl` from `components/map/MapSidebarUI.tsx`: that module
> pulls the map pin and county-texture modules and `NamedBirds` is on App.tsx's
> static import graph.

> **FR-14** — "Today" shall be derived once from a module-level session constant
> (`const SESSION_NOW_MS = Date.now()` at module top, the pattern in
> `Calendar.tsx:53-56`) and threaded downward as an explicit `YYYY-MM-DD` value.
> No component below the tab shall read the clock, and no pure helper shall take
> a clock reading. Accepted consequence, the same as the Calendar's: a session
> left open across midnight shows the previous day's "today" until reload.

> **FR-15** — When the active range is `'today'` and a bird's `lastSeen` is in the
> future relative to the session's today (a mis-dated export), the range end shall
> be clamped to `lastSeen` so the axis never runs backwards.

### D. The per-bird timeline

> **FR-16** — An expanded Named Birds card shall render one sighting timeline for
> that individual, positioned inside the expanded panel, gated on the same
> `showMap` prop the card map and media already use (`NamedBirdRow`'s
> `showMap={!!singleOpen}` from `NamedBirdsTable`).

> **FR-17** — The timeline shall render only when **both** hold: the bird has two
> or more sightings, and the active range's span is at least one day. A bird with
> exactly one sighting gets no timeline in either range (Key Decision 8); its
> header figure still renders.

> **FR-18** — When the bird has two or more sightings but the active range's span
> is zero days (every sighting on one date, with the range set to
> `'last-sighting'`), the app shall render a single sentence naming that date
> instead of a strip, following the shipped one-item rule (a chart of one fact is
> chrome around a single fact). With the range set to `'today'` that same bird has
> a real axis and renders the strip, with every mark coincident at the left edge.

> **FR-19** — The axis shall run from the bird's `firstSeen` (left) to the active
> range end (right) and shall be `width: 100%` of its container. It shall set no
> `min-width`.

> **FR-20** — The app shall draw one mark per **distinct sighting date**, at the
> horizontal position `elapsedDays(rangeStart, date) / elapsedDays(rangeStart,
> rangeEnd)` expressed as a percentage. Two sightings on the same date produce one
> mark.

> **FR-21** — Marks shall be allowed to overlap and to coincide exactly. The app
> shall apply no collision avoidance, no minimum spacing, no jitter and no
> binning. Each mark shall carry a small fixed pixel width so it is never
> sub-pixel; the value is the Designer's.

> **FR-22** — The two axis endpoint dates shall be rendered as text **outside**
> the plot area, in normal flow, allowed to wrap, through `formatDate` so they
> honour the user's date-format preference.

> **FR-23** — A timeline spanning years shall render identically to one spanning
> weeks: same container width, same mark rule, endpoints relabelled. There shall
> be no year gridlines, tick labels, or axis subdivisions in v1.

### E. The master timeline

> **FR-24** — The Named Birds tab shall render one master timeline below the card
> list, with a lane per named bird on a single shared time axis (Key Decision 4).
> It shall be Named-Birds-tab-only, gated on the same condition that drives
> `showMap`; Species Detail's instance renders nothing.

> **FR-25** — The master timeline shall render only when there are two or more
> named birds and the shared axis span is at least one day. With one named bird
> the card above it already is the picture.

> **FR-26** — The shared axis shall run from the earliest `firstSeen` across all
> named birds to: the latest `lastSeen` across all named birds (range
> `'last-sighting'`), or today (range `'today'`). Switching the range shall move
> the right-hand edge only.

> **FR-27** — Every named bird shall have a lane. There shall be **no cap and no
> truncation**: the strip grows vertically and the page scrolls, exactly as the
> unbounded card list above it already does. Omitting birds would leave "which
> birds was I following when" partly unanswered, which is the strip's whole
> question.

> **FR-28** — Lane order shall equal the card list's current order, top to
> bottom, following whichever option the tab's existing Sort control has selected
> (`Name (Individual)` / `Alphabetical` / `Taxonomic` / `Last Seen`). This is the
> shipped "bar order equals row order" contract; changing Sort reorders both
> together.

> **FR-29** — Each lane shall carry a permanent visible text label at the left
> naming the individual (and its species, matching the card list's
> `showSpecies`). Identity shall never be carried by colour alone (WCAG 1.4.1:
> the strip must still read with colour removed).

> **FR-30** — The lane label shall sit outside the plot area, in normal flow, and
> shall wrap. It shall not carry `white-space: nowrap`. A name tag's value is
> bounded at 120 characters by `NAME_TAG_RE` in `lib/namedBirds.ts:41`, so the
> label column must hold a 120-character name plus a species name without
> clipping or leaking page scroll.

> **FR-31** — A bird with a single sighting shall still get a lane with one mark.
> This is deliberately the opposite of FR-17 and the reason is stated here so it
> is not read as an inconsistency: in the master strip a one-mark lane sits in a
> comparison with other lanes and carries real information; in a card it would be
> a chart of one fact with the fact already stated above it.

> **FR-32** — The master timeline shall carry a visible caption naming the number
> of named birds and the axis range in words, per the brief. The caption and the
> endpoint sentence (FR-38) shall be count-correct at every count the tab can
> reach, including one, and shall live in a single copy module so they ride the
> generated-corpus copy sweep and the em-dash sweep with every other user-facing
> string.

### F. Accessibility, theming and motion

> **FR-33** — **STRUCK** (approved second design pass). It required every plot
> area to carry `aria-hidden="true"` and `inert`, following the decorative-chart
> contract at `ProjectsSection.tsx:92-112`. That contract cannot survive a
> selectable mark: a control that answers a pointer while being invisible to
> assistive technology and unreachable by keyboard fails WCAG 2.1.1 outright, and
> there is no partial version of it. **Neither strip is `inert` and neither is
> `aria-hidden`.** Replaced by FR-53 and FR-54. The master's caption and its
> in-listbox axis dates keep an `aria-hidden` of their own, which is FR-61.

> **FR-34** — **AMENDED** (approved second design pass). Marks are now
> `<div role="option">` (FR-54) and the strip is operable, so the "non-interactive
> in v1" clause is struck. What survives, and survives unchanged, is the element
> shape and the guard clause: **a mark shall carry no `tabIndex`, no anchor, and
> no per-mark click, hover or focus handler** (the track holds the single
> `tabIndex={0}` and every handler, FR-55), and **the exclusion roster and the
> counted population in `lib/tabOrderCoverage.test.ts` shall be unchanged by this
> feature** except for the range control's own buttons, which are ordinary tab
> stops carrying a literal `tabIndex={0}`. Marks and tracks are `<div>`s, so they
> fall outside that guard's population by element type, the same ground the
> roster already gives for `SnowMap.tsx`'s Trails `<input>`. This makes QA-49 a
> stronger claim, not a weaker one: it turns red if a later change makes a mark a
> `<button>`, which is the right alarm.

> **FR-35** — **REFRAMED** (approved second design pass). The per-bird strip is
> no longer a decoration in need of a text alternative; it is a second,
> interactive view of the same facts, and it names them itself through each
> option's accessible name (FR-54). The card's report rows **shall not change**:
> they remain the full record, and they alone carry the checklist link and the
> species comment, so the strip is a strict subset of them. The resulting
> duplication between the strip and the rows is accepted deliberately, because
> the alternative is suppressing an operable control for screen-reader users,
> which WCAG removes as an option. QA-77 stays true byte for byte.

> **FR-36** — **REFRAMED** (approved second design pass). There is no inert
> wrapper. Each lane shall be a `role="group"` named by the bird (FR-60), so a
> per-lane accessible name arrives by role rather than by added text, and no
> per-lane text alternative shall be added. The card list below the strip remains
> the full record and the endpoint sentence (FR-38) remains the strip's summary
> in the accessibility tree.

> **FR-37** — There shall be **no `aria-live` region** anywhere in this feature.
> The state change the user makes is the range switch, and its own `aria-pressed`
> announces it; a live region over a legend or a caption would announce reference
> material as an event. This follows the shipped v1.0.5 rule recorded in
> `.claude/rules/ui.md`, and shall be stated in the component so a later reader
> does not restore one as an oversight. **The second design pass adds a second,
> independent reason:** the focused option announces its own name on every arrow
> press, so a live region over the readout would double-speak. The readout is
> `aria-hidden` (FR-56) for exactly that reason.

> **FR-38** — A short sentence naming the number of named birds and the two axis
> endpoint dates shall render **outside the listbox**, in the accessibility tree,
> and shall update when the range changes. This is what makes the master strip's
> meaning reachable without a live region. Same place, same words as the approved
> first pass; only "outside the inert wrapper" is reworded, because there is no
> longer an inert wrapper to be outside of.

> **FR-39** — Every colour shall be a `var(--sr-*)` token declared in both
> `:root` and `[data-theme="dark"]` in `globals.css`. No hardcoded hex or RGB in
> any component file.

> **FR-40** — The per-bird timeline shall be monochrome (one accent-family token
> on a subtle track): it charts one individual, so a categorical palette buys
> nothing.

> **FR-41** — Where the master timeline uses colour, it shall reuse the shipped
> categorical tokens and order (`var(--sr-accent)`, `var(--sr-graph-photo)`,
> `var(--sr-graph-audio)`, `var(--sr-graph-video)`, then `var(--sr-chart-slate)`
> for every lane past the fourth). The tokens shall be re-declared in this
> feature's own entry-safe module, never imported from `ProjectsSection.tsx`
> (a lazy chunk). Because assignment order is per-chart and chosen by
> measurement, the adjacent-lane separation shall be validated under CVD
> simulation in both themes with the dataviz palette validator before ship, and
> the result recorded. Colour is reinforcement only (FR-29), so a failing pair
> moves the order, never the token values.
>
> **Position taken at the approved design pass (OQ-06): the master strip is
> monochrome, so this requirement's condition is not met and its categorical
> clause is unused.** No categorical token appears anywhere in this feature, and
> QA-54 is vacuous for the same reason. Two measured grounds: four distinguishable
> colours plus slate would give three named birds a colour each and twenty birds
> four colours and sixteen slate lanes, implying a grouping that does not exist;
> and `--sr-graph-photo` / `-audio` / `-video` already mean photo, audio and video
> on a tab where every expanded card carries a media section. Per-lane identity is
> carried by the label (FR-29) and per-lane extent by a span line (FR-65) instead.

> **FR-42** — If the design paints marks on a filled track, the mark-versus-track
> pair shall clear WCAG 1.4.11 non-text contrast (3:1) in both themes, guarded by
> a parse-the-tokens test following `countyContrast.test.ts` and
> `calendarContrast.test.ts`.

> **FR-43** — There shall be no per-mark entrance animation. Any animation or
> transition this feature adds shall be collapsed by the existing global
> reduced-motion block at `globals.css:3204-3212`; no per-component
> `prefers-reduced-motion` query shall be added unless it states the same
> guarantee explicitly beside a rule the global block already covers.

### G. Documentation, published prose, and the source sweep

> **FR-44** — `docs/HELP.md`, the single source of truth for in-app help, shall
> be updated in this same change. Its Named Birds section (around line 545) shall
> afterwards: state the corrected precision of the elapsed-span figure with a
> current example (the shipped example `"2 yrs. 3 mos." or "5 days"` is still
> valid text but the paragraph must no longer imply truncation); state which two
> dates the figure measures; describe the range control, its two states, its
> default, and that it is per-session, resetting on relaunch; describe the
> per-bird timeline including that a bird with a single sighting gets none; and
> describe the master timeline including that every named bird gets a lane, that
> lane order follows the Sort control, and what the caption says.

> **FR-45** — `docs/HELP.md`'s Species Detail paragraph at line 201 shall be
> updated: it currently says "The per-bird top-locations list and map live on the
> Named Birds tab", and must now name the timeline in that same list. The
> `showMap` gate itself does not change.

> **FR-46** — `README.md`'s Named Birds bullet (line 18) shall name the
> timelines.

> **FR-47** — `website/index.html`'s Named Birds paragraph (line 379) shall be
> updated. Its published claim "how long you've followed it" is the claim this
> fix makes true; the paragraph shall afterwards say which two dates the figure
> measures and name the timelines. Its `alt` text and the screenshot are covered
> by FR-51.

> **FR-48** — The prose repair shall be swept at **paragraph scope**, not
> sentence scope, and the files shall be compared against **each other** as well
> as against the code. No em dashes (U+2014) in any user-facing string, in
> `docs/HELP.md`, `README.md`, or `website/index.html`. Published prose shall
> state the property, never a count, and shall never name a surface from a
> component name (`TAB_LABELS` in `lib/tabLayout.ts` is authoritative; this tab
> is **Named Birds**).

> **FR-49** — Per the v1.0.17 rule the sweep starts at the source. In scope for
> the same change: `formatDate.ts`'s `formatSightingDuration` docstring (FR-06),
> `NamedBirdRow.tsx:95-97`'s comment describing the duration line, and
> `PRODUCT_CONTEXT.md`'s Named Birds entry, whose `e.g. "1 yr. 2 mos."` example
> and "elapsed span between them" wording both describe the old behaviour.

> **FR-50** — **AMENDED** (approved second design pass). `PRIVACY_POLICY.md`
> still requires no change: this feature adds no network request, no provider,
> and nothing written to disk, and the selection is session-only React state.
> That decision shall be recorded rather than left silent.
>
> `ACCESSIBILITY.md` **definitely does need a change** now, where the first pass
> only expected it might. Its Keyboard Navigation section shall gain the two new
> listboxes beside the two roving-tabindex groups it already publishes, and
> **shall state that the new groups use `aria-activedescendant`, not roving
> tabindex.** The wording is load-bearing rather than stylistic: the `EXCLUSIONS`
> docstring in `lib/tabOrderCoverage.test.ts` checks that published prose against
> the roster, and it already records an earlier summary that conflated the two
> patterns as "false twice over". A sentence calling these listboxes roving would
> fail that guard.

> **FR-51** — `website/assets/shots/named-birds.webp` shall be recaptured from
> the synthetic demo dataset (never the user's real data), because the tab now
> carries a master timeline the current shot does not show, and its `alt` text
> shall be updated to match. The App Store screenshot sets contain no Named Birds
> shot and are unaffected.

### H. Release mechanics

> **FR-52** — The change shall carry a patch version bump applied to the full
> four-file set: `frontend/package.json`, `src-tauri/tauri.conf.json`,
> `CHANGELOG.md`, and `website/index.html` (the `version-pill` visible text, its
> `aria-label`, and the `footer-version` line).

### I. Selectable marks (added at the approved second design pass)

Every requirement in this section is new. It replaces the decorative-chart story
struck at FR-33 and is the authority for what The Engineer builds; the visual and
interaction detail behind it is `design-spec.md`.

> **FR-53** — Each strip shall be a `role="listbox"` whose options are its marks.
> It shall carry an accessible name (`Sightings of {name} over time` on a card,
> `Sightings of every named bird over time` on the master), a literal
> `tabIndex={0}` on the track element, and `aria-activedescendant` naming the
> committed option's id. `aria-activedescendant` shall be absent when nothing is
> committed and shall **never** follow a mouse-hover preview: a preview must not
> move a screen reader's cursor onto something the user is not pointing at. The
> pattern follows the shipped `components/SpeciesCombobox.tsx`, not the roving
> tabindex of `TabNav.tsx` or `Settings.tsx`, because the option population is
> data-scaled (up to 20,000 at the NFR-04 fixture) and roving would put a
> `tabIndex` and a focus handler on every one.

> **FR-54** — Each mark shall be a `<div role="option">` carrying a stable unique
> `id`, `aria-posinset` and `aria-setsize`, and `pointer-events: none`. Its
> accessible name shall be **the whole payload**, so a screen-reader user never
> needs the visible readout: `{date}, {places}` on a card and
> `{bird}, {date}, {places}` on the master. The name shall carry **no position
> words**: "2 of 7" belongs to `aria-posinset`/`aria-setsize`, and putting it in
> the name too makes the screen reader say it twice.

> **FR-55** — **The track is the control, not the mark.** The track shall take the
> press and a press shall select the **nearest sighting by horizontal position**,
> which partitions the full width so every sighting owns a non-zero slice and mark
> overlap becomes irrelevant to hit testing. This is what lets FR-21 stand: at
> 320px a bird with six dates inside eight days is six marks inside about six
> pixels, and a 3px mark cannot be made a target without spacing, jitter or
> binning, all of which are forbidden and would falsify the picture. Target
> heights shall be 38px in a card and 24px per lane on the master, rising to 30px
> at 640px and below, each the full width of its container.
>
> **Stated residual limit, recorded rather than hidden:** where several sightings
> sit within a few pixels a finger cannot land on each one individually. Three
> mitigations, none of them a new control: the arrow keys reach every mark, the
> readout's second line names the position so neighbours are visible, and the
> card's strip sits directly above the complete dated report list.

> **FR-56** — The label shall be a **fixed readout**, never a popover. It shall
> render in normal flow beneath the axis labels, wrap, and be **rendered from
> first paint and never unmounted or hidden**, so nothing shifts when it fills. It
> shall carry `aria-hidden="true"` (the focused option already announces the same
> words, FR-37). Line 1 is the identity (date and place in a card, the bird's name
> in front on the master); line 2 is the muted position, phrased in **dates** not
> sightings, which is what explains a card reading `8 sightings` with 7 marks. At
> rest, line 1 invites the interaction and line 2 is empty. **The readout shall
> never be a link:** the app opens external links only through the shared link
> components, and a readout that became a checklist link would be a control
> appearing and disappearing under the user's finger.

> **FR-57** — The keyboard map shall be: `ArrowLeft`/`ArrowRight` for previous and
> next sighting, clamping at the ends and never wrapping; `Home`/`End` for first
> and last; `ArrowUp`/`ArrowDown` on the master only, moving to the previous or
> next bird and landing on the sighting nearest in date to the current one;
> `Escape` clearing the selection and keeping focus. **`Escape` shall be consumed
> only while something is selected**, so with nothing selected it still reaches an
> outer Escape layer, following the shipped `SpeciesCombobox` rule. Blur or
> tabbing away clears the selection and returns the readout to its resting line.
> `Enter` and `Space` shall be unbound.

> **FR-58** — The selection shall be keyed by **bird plus date**, never by
> position or index, so it survives a range flip and a Sort change with only the
> axis moving under it. Collapsing a card unmounts its strip and its selection
> with it.

> **FR-59** — **The Named Birds tab shall gain exactly two tab stops from this
> feature**: one for the open card's strip (at most one card is open, since the
> tab passes `singleOpen`) and one for the master strip. **The count shall be
> invariant in the number of birds and the number of sightings.** This invariance
> is the property that made the scope change acceptable, so it is a requirement in
> its own right and not a consequence to be inferred.

> **FR-60** — Each master lane shall be a `role="group"` whose `aria-label` is
> `{name}, {species}` (or `{name}` where `showSpecies` is false). The visible lane
> label shall carry `aria-hidden`, because the group name already carries the same
> words and duplicating them would read the bird's name twice.

> **FR-61** — The master's visible caption and its axis end dates sit **inside**
> the listbox and shall carry `aria-hidden`; the FR-38 sentence above the listbox
> carries the same facts to the accessibility tree. This is the one surviving
> `aria-hidden` in the feature and it is on the labels, never on a strip.

> **FR-62** — A zero-day axis shall render **no strip, no listbox, no tab stop and
> no readout**: one sentence only, per FR-18. With the range on `today` the same
> bird has a real axis and becomes selectable in the ordinary way.

> **FR-63** — Both strips shall be built from **one shared component**
> (`NamedBirdTickList`), so the hit test, the key handling, the readout contract
> and the ARIA wiring exist once; the master differs only by its `role="group"`
> lanes and the Up/Down key map. Marks, rails and span lines shall be positioned
> `<div>`s built from tokens, with no SVG and no chart library anywhere in the
> graph (NFR-01 is unchanged). The feature's CSS shall use the `.sr-nbt-*` class
> prefix in `globals.css` so QA-58 and QA-59 have named selectors to parse.
> Geometry, in px: per-bird track 38px; master lane track 24px desktop and 30px at
> 640px and below; mark 3px wide; rail inset 2px each side, being half a mark, so
> a mark at 0% and at 100% sits fully inside the track rather than clipping;
> active mark 5 by 28px in a card and 3 by 18px on a lane, plus a 2px halo. No
> positive `min-width` anywhere in the feature.

> **FR-64** — The collapsed card's duration line shall **lose its
> `white-space: nowrap`** so the endpoint phrase can wrap. This is the one shipped
> declaration this feature changes on the collapsed header. The date-range line
> above it keeps its `nowrap` and stays byte-identical in both range states
> (FR-07, unchanged).

> **FR-65** — Two elements of the approved design are **Designer additions that no
> requirement asked for**, recorded here with that status so a later cut is a
> decision rather than a regression: a per-lane **span line** on the master running
> first sighting to last, which replaces colour as the carrier of a bird's extent
> and costs one `min` and one `max` over positions already computed; and a
> **mouse-hover preview** that reads the nearest sighting into the readout without
> committing, which is desktop-only by construction. Either may be cut with
> nothing else changing.

---

## Non-Functional Requirements

> **NFR-01 — Bundle:** No new npm dependency. No chart library shall become
> reachable from `App.tsx`'s static import graph. `NamedBirds` is statically
> imported at `App.tsx:29`, so a `recharts` import anywhere in this feature would
> put a chart library on first paint for every user on every platform. The
> timelines shall be hand-rolled inline SVG or token-styled positioned elements.
> If a Designer's form genuinely needed a library, the answer is to lazy-load the
> timeline component, never to add a static import.

> **NFR-02 — Network:** Zero new network requests on either transport. Every
> figure and every mark is computed from the already-loaded eBird backup. The
> timeline modules shall not import `transport` or any `lib/tauri/*Service`
> module, guarded by an import-graph walk following the
> `exoticProvenanceGraph.test.ts` pattern.

> **NFR-03 — Storage:** Nothing is written to disk, nothing is synced, and no
> derived value is persisted. No new entry joins `lib/clearDerived.ts` (that
> registry holds durable documents only; a session-only value cannot have a row).

> **NFR-04 — Performance:** Building the complete master mark set for 200 named
> birds averaging 100 sightings each shall complete in under 50 ms. The assertion
> shall be expressed as a same-run quotient (`ceiling / best >= 10`), never as an
> absolute headroom measured on the build machine, and each timed run shall use a
> distinct input so no memo is measured.

> **NFR-11 — DOM weight:** NFR-04 is unchanged as written, but every mark now
> carries a stable `id` and **five** ARIA attributes plus its class and its
> position: `role`, `aria-label` (the accessible name), `aria-posinset`,
> `aria-setsize` and `aria-selected`. **Corrected at the QA hand-back**, which
> measured what ships: this row previously named "three ARIA attributes plus its
> accessible name" and omitted `aria-selected`, which is present and is correct
> for `role="option"` — a listbox option that never reports its selected state
> would be a defect, not a saving. The measured total is **exactly 8 attributes
> per option** (`aria-label`, `aria-posinset`, `aria-selected`, `aria-setsize`,
> `class`, `id`, `role`, `style`), uniform across all 20,000 at the fixture.
> That is DOM weight rather than compute, and NFR-04's compute budget cannot see
> it. Mounting the complete master strip at the same fixture NFR-04 names (200
> named birds averaging 100 sightings) shall therefore be measured separately and
> its cost recorded, with the attribute and node counts stated structurally
> rather than as a byte figure.

> **NFR-05 — Reflow (WCAG 1.4.10):** At a 320px viewport, at every in-app text
> scale up to 200%, in Chromium **and** WebKit, the Named Birds tab shall show no
> horizontal page scroll and no element shall place text ink outside its
> container's content box. Verification is a real-browser measurement of text ink
> against container content boxes, not page `scrollWidth` and not a hand-built
> static reproduction.

> **NFR-06 — Text scale:** Every strip's own height shall be a px value and every
> text-sized element shall sit outside it. A `rem` value inside a fixed-px box
> grows when the box does not; `.claude/rules/ui.md` records the Named Birds card
> map as the named example of exactly this trap on exactly this surface.

> **NFR-07 — Contained overflow:** If the master strip must ever be wider than a
> phone viewport, it shall scroll inside `.sr-scroll-x`, never the page. No
> element in this feature shall set a `min-width` that forces page scroll.

> **NFR-08 — Purity:** No impure call during render. `react-hooks/purity` is
> build-blocking; the only clock read is the module-level session constant of
> FR-14.

> **NFR-09 — Colour independence:** Every fact the timelines convey shall remain
> readable with colour removed (WCAG 1.4.1). Lane identity is the text label;
> mark position is geometry.

> **NFR-10 — Gate:** The pre-push gate is `npm run build` **and** `eslint`, not
> `vitest` alone and not either one alone. Neither subsumes the other.

---

## Out of Scope

Carried forward from the strategic brief, plus what surfaced writing this PRD.

- **Binned or aggregate charts.** `components/speciesDetail/SightingsGraph.tsx`
  already gives a whole species a weekly/monthly/yearly binned line chart with a
  cumulative toggle. This is an event strip at exact dates, a different picture
  for a different question.
- **Interactive marks: partly struck at the approved second design pass.**
  Selecting a mark and reading it in a fixed readout are now **in scope**
  (FR-53 through FR-59). Still out, and deliberately so: press-to-open-a-checklist
  (the readout is never a link; the checklist stays on the report row where it
  already is), floating tooltips and popovers (a popover anchored to a 3px mark at
  320px has nowhere to go), brushing, zooming, and filtering the master timeline
  by species or date. `Enter` and `Space` are deliberately unbound: there is
  nothing to activate, and selection is the whole interaction.
- **Changing `formatSpanLength` or Statistics' "Archive span"** in
  `lib/statsFormat.ts:42-49`. The divergence is real and named in the brief;
  converging it is a separate visible change to a published figure on another
  tab. This run makes that convergence cheap (FR-02) and does not perform it.
- **Per-bird timelines on Species Detail's Named Individuals section**
  (Key Decision 7). Reversible; a reasonable thing for the Designer to raise.
- **A per-species timeline anywhere.** The unit is the named bird, keyed by
  `NamedBird.key` (Key Decision 1).
- **Any new tab, dependency, backend change, transport change, network request,
  or anything that writes to disk or syncs.**
- **Reworking how named birds are parsed, keyed, deduped or sorted.**
- **Persisting the range choice.** Session-only by FR-12. Should the Designer or
  the user want it remembered, it goes through the `storage` seam, never
  `localStorage`, and becomes its own change.
- **Any change to the collapsed header's date-range line** (FR-07).
- **A year-axis, gridlines or tick labels on either strip** (FR-23).
- **Recapturing the App Store screenshot sets.** They contain no Named Birds
  shot (FR-51).

---

## Open Questions

Seven of the eight are now **RESOLVED** by the approved second design pass. They
are kept in place with their positions recorded rather than deleted, so a
reference to an OQ id still resolves and the reasoning behind each answer stays
attached to the question it answers.

**OQ-01 — Is `Same day` the right string for a zero-day span?**
Default if unanswered: yes. The shipped code prints `1 day` for a first and last
sighting on the same date, which is a lie about the elapsed span, and `0 days`
reads as broken. The Designer may prefer different wording; the requirement that
survives any wording is that the string is not `1 day`.
**RESOLVED: `Same day` stands.** Two words, true, and it reads as an answer
rather than a measurement. In context it lands as `Same day · first to last
sighting`.

**OQ-02 — How does the card name the figure's endpoints (FR-08)?**
Default if unanswered: a short suffix on the duration line naming the range, in
words. Key Decision 3's fallback is available if the Designer prefers a fixed
header figure. Either way the endpoints must be visible text.
**RESOLVED: a short endpoint phrase after the number, on every card**, naming
both ends: `50 days · first to last sighting` and `3 mos. 17 days · first
sighting to today`. It answers "which two dates" for a reader who never touches
the control, and it is what makes the tab-wide switch legible, because it changes
on every visible card at once. Stated cost: the duration line now wraps (FR-64).

**OQ-03 — Is one shared range value across the tab right, or should each card
own its own (FR-11)?**
Default if unanswered: shared. Shared is the direct application of Key Decision
3 at tab level and is cheaper; per-card state would let two cards on screen
answer the same question differently. Worth putting to the user at The Designer.
**RESOLVED: shared, and the control gains a third placement.** The canonical
instance sits in the tab control strip under Sort, where scope is read from the
company a control keeps; the card instance carries `Applies to every named bird
on this tab.` because it is the ambiguous one. FR-11 requires one shared value,
not exactly two placements, so it is extended rather than contradicted.

**OQ-04 — Should there be a week unit between days and months (FR-03)?**
**STILL OPEN**, and the default stands unless The Engineer or the user raises it;
the design pass did not touch the band table and every figure in the mockup was
computed against it.
Default if unanswered: no. `43 days` is no less readable than `6 wks. 1 day`,
the day band is exact to 60 days, and a week unit would add a magnitude
`formatSpanLength` does not have, making the eventual convergence harder.

**OQ-05 — Does the master timeline stay uncapped past a large bird count
(FR-27)?**
Default if unanswered: uncapped. If the Designer wants a cap, it must be a
`Show all N` expander following the shipped idiom in `NamedBirdLocations`, never
a silent truncation, and the caption must then say what is shown.
**RESOLVED: uncapped, as defaulted.**

**OQ-06 — Does the master timeline use colour at all (FR-41)?**
Default if unanswered: yes, as reinforcement in the shipped categorical order.
Every lane is labelled, so a monochrome master is equally correct and needs no
CVD validation; that is a legitimate Designer choice.
**RESOLVED: monochrome.** See the position recorded under FR-41. Colour is
replaced by a per-lane span line (FR-65); QA-54 becomes vacuous and QA-53's
guarded pair becomes mark versus rail.

**OQ-07 — Where does the master timeline's component live?**
Default if unanswered: inside `NamedBirdsTable`, rendered after the rows and
gated on the same `singleOpen` condition that already drives `showMap`, so the
shared range state and the sort order sit in one place and the Species Detail
instance is untouched by construction. The Architect may lift it to
`NamedBirds.tsx` instead; the constraint that governs either choice is that
Species Detail renders neither the master timeline nor the range control.
**RESOLVED: inside `NamedBirdsTable`, as defaulted**, in a sibling container
carrying the same card chrome as a named bird card, never nested inside one.

**OQ-08 — Deviation flagged rather than taken silently.** The brief's Scope
section says the honest calculation is "a true day difference, with month and
year units derived from it rather than from a fake borrow." This PRD reads that
literally: FR-01 computes the true day difference and FR-03 derives months and
years **from that day count**, not from a calendar borrow. A calendar-correct
Y/M/D decomposition was drafted and rejected on measurement: it is ambiguous for
0.6% of date pairs (405 of 67,206 pairs across four years), all of them spans
starting on the 29th, 30th or 31st, where no decomposition both round-trips and
matches the true day count. Deriving from the day count removes every such case,
makes the formatter a pure function of one integer that can be swept
exhaustively, and is what makes Key Decision 9's convergence real. Stated cost:
`2026-01-31` to `2026-03-01` reads `29 days` rather than `1 mo.`, which is the
true elapsed span and the more honest of the two.

---

## Success Metrics

Every row is a pass condition The Tester can execute. Every date pair below was
computed against both the shipped algorithm and the specified one before this
PRD was written.

### The arithmetic

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | The bridge-ravens defect class: a 90-day span no longer reads "2 mos." | `formatSightingDuration('2026-05-21', '2026-08-19')` returns exactly `2 mos. 29 days` (shipped code returns `2 mos.`) |
| QA-02 | The same span in a leap year | `formatSightingDuration('2024-01-10', '2024-04-09')` returns exactly `2 mos. 29 days` (shipped: `2 mos.`) |
| QA-03 | The February borrow defect | `formatSightingDuration('2026-02-27', '2026-03-01')` returns exactly `2 days` (shipped: `4 days`) |
| QA-04 | The one-day February case | `formatSightingDuration('2026-02-28', '2026-03-01')` returns exactly `1 day` (shipped: `3 days`) |
| QA-05 | A 364-day span is not "11 mos." | `formatSightingDuration('2026-01-01', '2026-12-31')` returns exactly `11 mos. 29 days` (shipped: `11 mos.`) |
| QA-06 | A month-end start no longer over-claims a month | `formatSightingDuration('2026-01-31', '2026-03-01')` returns exactly `29 days` (shipped: `1 mo.`) |
| QA-07 | The reference export's bridge-ravens span | `formatSightingDuration('2026-05-21', '2026-07-10')` returns exactly `50 days` (shipped: `1 mo.`) |
| QA-08 | Same-day first and last | `formatSightingDuration('2026-07-04', '2026-07-04')` returns exactly `Same day` (shipped: `1 day`) |
| QA-09 | A genuine one-day span still reads "1 day" | `formatSightingDuration('2026-07-04', '2026-07-05')` returns exactly `1 day` |
| QA-10 | A clean anniversary | `formatSightingDuration('2025-09-06', '2026-09-06')` returns exactly `1 yr.` |
| QA-11 | A multi-year span with months | `formatSightingDuration('2024-02-29', '2026-09-06')` returns exactly `2 yrs. 6 mos.` |
| QA-12 | The day/month band boundary | `formatSightingDuration('2026-01-01', '2026-03-02')` returns exactly `60 days`, and a span of 61 days returns exactly `2 mos.` |
| QA-13 | `elapsedDays` is exact | Over every date pair from 2000-01-01 to 2030-12-31 at offsets 0 to 400 days, `elapsedDays` equals an independently written civil-day oracle for every pair; zero disagreements |
| QA-14 | Leap-year correctness | `elapsedDays('2024-02-28','2024-03-01')` is 2; `elapsedDays('2026-02-28','2026-03-01')` is 1; `elapsedDays('1900-02-28','1900-03-01')` is 1; `elapsedDays('2000-02-28','2000-03-01')` is 2 |
| QA-15 | Reversed and invalid input | `formatSightingDuration('2026-08-19','2026-05-21')` equals the forward result; `null`, `''`, and `'not-a-date'` on either side all return `''` and never throw |
| QA-16 | `formatElapsedSpan` exhaustive properties | Swept over integer inputs 0 to 40,000: the months-band day remainder never leaves 0 to 30; the string `1 mo.` never appears below 365 days; the string `12 mos.` is never emitted; the output matches exactly one of the 12 documented shapes |
| QA-17 | No silent truncation at the month magnitude | Swept over integer inputs 61 to 364: exactly one input maps to each remainder-free `M mos.` string, so `2 mos.` means 61 days and no other value |
| QA-18 | Purity | `formatElapsedSpan` and `elapsedDays` contain no `Date.now()`, no `new Date()` reading the clock, and no module-level mutable state; `npm run build` passes with `react-hooks/purity` enabled |
| QA-19 | The docstring is true | `formatSightingDuration`'s docstring contains no claim of a 30-day borrow and no claim of rounding it does not perform; the band table it states matches FR-03 exactly |
| QA-20 | Against the user's own export | The bridge-ravens card is read from the user's current export before and after the change and the two figures recorded; the after value matches `formatElapsedSpan(elapsedDays(firstSeen, lastSeen))` computed independently from the same two dates |

### The card and the range control

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-21 | The figure follows the range | With the range on `last-sighting` a fixture bird first seen 2026-05-21 and last seen 2026-07-10 shows `50 days`; switching to `today` with a session today of 2026-09-06 shows `3 mos. 17 days` |
| QA-22 | The date-range line does not move | The header line `formatDate(firstSeen) – formatDate(lastSeen)` is byte-identical in both range states |
| QA-23 | Endpoints are named in text | In both range states the card renders visible text naming which two dates the figure measures; the assertion is on rendered text, not on the control's state |
| QA-24 | The control is shared across the tab | Pressing the range control inside an expanded card changes the master timeline's caption and the duration figure of a second, collapsed card in the same commit |
| QA-25 | Default and persistence | On first render the range is `last-sighting`; after switching to `today`, navigating to another tab and back, it is still `today`; the value appears in no `storage` write and no `localStorage` key |
| QA-26 | The control is a real tab stop | Both range buttons render a literal `tabIndex={0}` and `aria-pressed` reflecting selection, and are reachable by Tab in a WebKit render with macOS keyboard navigation off |
| QA-27 | Species Detail is untouched | The `NamedBirdsTable` instance rendered by Species Detail contains no range control, no per-bird timeline, no master timeline, and its duration figure equals `formatSightingDuration(firstSeen, lastSeen)` |
| QA-28 | One clock read | A source scan of every file this feature adds or changes finds exactly one `Date.now()`, at module scope in the tab component; no component below it reads the clock |
| QA-29 | Future-dated export | A bird whose `lastSeen` is after the session's today renders an axis whose right edge is `lastSeen` in both range states, with no negative or inverted mark positions |

### The per-bird timeline

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-30 | Render gate | A bird with one sighting renders no timeline in either range state, and still renders its header figure |
| QA-31 | Marks cluster where sightings cluster | For a bird with sightings on 2026-05-21, 2026-05-22, 2026-05-23 and 2026-08-19, three marks sit within the first 3% of the axis and one at 100%; positions are asserted from the rendered style values |
| QA-32 | Distinct dates only | Two sightings on the same date produce exactly one mark; the mark count equals the count of distinct sighting dates |
| QA-33 | Overlap is permitted | Two sightings one day apart on a 400-day axis render two marks whose horizontal boxes overlap, with no spacing, jitter or de-duplication applied; the rendered mark count is still 2 |
| QA-34 | All sightings on one date (FR-18, FR-62) | With the range on `last-sighting`, a bird whose sightings all fall on 2026-07-04 renders a sentence naming that date and **no strip, no `role="listbox"`, no tab stop and no readout**; with the range on `today` the same bird renders a strip with every mark at position 0% and one tab stop |
| QA-35 | Switching moves one edge only | Switching from `last-sighting` to `today` leaves every mark's relative order unchanged and moves the right-hand endpoint label only; the leftmost mark stays at 0% |
| QA-36 | Endpoint labels honour the date preference | With the date format preference set to `iso`, the axis endpoint labels render as `YYYY-MM-DD`; with `day-first`, as `21 May 2026` |
| QA-37 | **STRUCK** (second design pass) | Asserted that the *inert* plot wrapper contains no text node. There is no inert wrapper. Replaced by QA-79, which keeps the part that is still worth asserting |
| QA-75 | A span of years renders the same picture (FR-23) | A bird whose sightings run 2019-04-02 to 2026-09-06 renders one strip of the same container width and the same mark rule as a 40-day bird, with no gridlines, tick labels or axis subdivisions anywhere inside the plot wrapper |
| QA-76 | The per-bird strip is monochrome (FR-40) | The per-bird strip references exactly one mark colour token and one track token; none of the four categorical tokens appears in it |

### The master timeline

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-38 | Render gate | With one named bird no master timeline renders; with two or more and an axis span of at least one day it renders |
| QA-39 | Every bird has a lane | For a fixture of 40 named birds the rendered lane count is 40, with no cap, no truncation and no "show more" control |
| QA-40 | Lane order follows Sort | Changing the tab's Sort control from `Last Seen` to `Alphabetical` reorders the lanes into the same order as the cards above, asserted by comparing the two label sequences |
| QA-41 | Shared axis | Every lane's marks are positioned against the same axis: the earliest `firstSeen` across all birds is at 0% in some lane and the latest `lastSeen` at 100% in some lane |
| QA-42 | The range moves one edge | Switching to `today` leaves the left edge date unchanged and sets the right edge to the session's today; every mark's absolute date is unchanged |
| QA-43 | Single-sighting birds appear | A bird with one sighting has a lane with exactly one mark |
| QA-44 | Identity is not colour | Every lane renders a visible text label; rendering with all `--sr-*` colour tokens set to one value leaves every lane distinguishable by label and mark position |
| QA-45 | Caption correctness | The caption names the bird count and the axis range; at a count of one the caption is not reached (QA-38), and at every count the tab can reach no string contains a plural noun after "1" and no plural verb follows a subject counted at one |
| QA-46 | Copy lives in one module | Every user-facing string this feature adds is exported from `lib/namedBirdTimelineCopy.ts` and is covered by the generated-corpus copy sweep; no count-bearing string is built inline in a component. The new `places()` helper (`{a}` / `{a} and {b}` / `{a} and {n-1} more places`) states its property over the whole input domain rather than at two sample values, and its extensibility is proved by adding a hypothetical extra row |

### Accessibility, theming and layout

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-47 | **STRUCK** (second design pass) | Asserted that every plot wrapper carries the literal `aria-hidden="true"` and `inert` attributes. Neither strip is inert or `aria-hidden`. Replaced by QA-80 |
| QA-48 | **STRUCK** (second design pass) | Asserted that a tab-order enumeration finds no focusable element inside either plot wrapper. Each strip is now a focusable listbox. Replaced by QA-81, which asserts the count and its invariance instead |
| QA-49 | The exclusion roster is unchanged | `lib/tabOrderCoverage.test.ts` passes with no new roster row and no changed `count`; a deliberately unmarked `<button>` added to a new timeline file turns it red |
| QA-50 | The master's meaning is reachable | The endpoint sentence naming the bird count and the two dates is present in the accessibility tree **outside the listbox**, and its text changes when the range changes; verified with `ariaSnapshot` in Chromium and WebKit. The clause "with the plot wrapper inert" is struck with FR-33: the sentence must carry those facts because the in-listbox caption is `aria-hidden` (FR-61), not because the strip is hidden |
| QA-77 | The card rows remain the accessible equivalent (FR-35) | With the timeline present, the expanded card still renders one report row per sighting carrying its date, its location and its checklist link, unchanged from HEAD |
| QA-51 | No live region | A source scan of the feature's files finds no `aria-live`, no `role="status"` and no `role="alert"`; the component states why |
| QA-52 | Tokens only, both themes | No hardcoded hex or `rgb(`/`rgba(` literal appears in any component file this feature adds; every `--sr-*` token it references is declared in both the `:root` and `[data-theme="dark"]` blocks of `globals.css`, parsed from the real stylesheet |
| QA-53 | Mark contrast on the rail | The guarded pair is **mark versus rail**, since a mark sits on the rail wherever a bird has a span: `--sr-accent` on `--sr-border-medium` measures at least 3:1 in both themes by WCAG luminance math parsed from the real tokens (design pass measured 3.28:1 light, 5.38:1 dark; light is the tight one and is what the guard protects). Mutating either token below the threshold turns the guard red. The rail on the panel surface measures ~1.66:1 in both themes by design, being a hairline guide and not a state carrier, and is deliberately not guarded |
| QA-54 | Categorical separation (**vacuous as designed**) | The row's condition is not met: the approved design takes a monochrome master (FR-41), so no categorical token appears in this feature. The Tester shall verify the condition is genuinely absent rather than skip the row: `--sr-graph-photo`, `--sr-graph-audio`, `--sr-graph-video` and `--sr-chart-slate` appear in none of the feature's files. Should colour ever be reintroduced, the CVD validation returns with it |
| QA-55 | Reduced motion | With `prefers-reduced-motion: reduce`, no mark, lane or strip animates; the global block at `globals.css:3204-3212` covers every declaration this feature adds, verified by parsing the built stylesheet |
| QA-56 | 320px, every text scale, both engines | At a 320px viewport at 100%, 125%, 150% and 200% in-app text scale, in Chromium and WebKit against the production build served over the synthetic demo dataset: document `scrollWidth` equals 320, and every text ink rect and every element box inside the Named Birds tab sits within its container's content box. The text scale is set as an inline style on `documentElement`, never an injected `html {}` rule, and the probe proves the scale applied by reading back a size that must track it |
| QA-57 | The 120-character label | A fixture named bird whose `[name:…]` value is 120 characters renders its master-timeline lane label wrapped, entirely inside the label column's content box, at 320px and 200% text scale in both engines |
| QA-58 | The px-box trap | Every strip's own height is declared in px and no `rem`-sized element sits inside a fixed-px box; asserted by parsing the shipped `.sr-nbt-*` rules in `globals.css`. The expected values are per-bird track 38px, master lane track 24px with 30px at 640px and below, mark 3px wide, rail inset 2px each side, active mark 5 by 28px in a card and 3 by 18px on a lane. Every label, both axis end dates and both readout lines are outside those boxes |
| QA-59 | No page-scroll min-width | No rule this feature adds sets a `min-width` outside a `.sr-scroll-x` container. **The mutation check is the STRUCTURAL guard, not page `scrollWidth`** (corrected at the QA hand-back): re-adding a `min-width` turns the stylesheet scan red at any positive value, while page `scrollWidth` only responds from roughly 600px up — measured at 260px, the page still reads exactly 320 while the track's right edge reaches 308 against a 272px content box. That is the v0.5.83 rule in its own right: `scrollWidth` does not merely under-report here, it reports the defect as absent, because the leak is absorbed before it can extend the document. Assert the rule's absence structurally and measure the ELEMENT against its container's content box; do not route this row through page scroll width |
| QA-60 | Touch targets (extended, not replaced) | Both range buttons meet the roughly 44px minimum height in the 640px tier via `.sr-touch-target` and carry no sub-16px font size on phone. **Added at the second design pass:** every track is itself a target and clears the 24px minimum in every tier, measured as a rendered box: 38px tall in a card, 24px per lane on the master and 30px per lane at 640px and below, each the full width of its container |

### Bundle, network and release

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-61 | No chart library on the entry chunk | `lib/entryChunk.test.ts` gains an assertion that no file reachable from `App.tsx`'s static import graph imports `recharts` or any charting package. It passes at HEAD (the four recharts importers are all lazy-only) and turns red when a `recharts` import is added to `NamedBirds.tsx` |
| QA-62 | No new dependency | `frontend/package.json`'s `dependencies` and `devDependencies` are byte-identical to HEAD apart from the version field |
| QA-63 | Zero network | An import-graph walk from every module this feature adds finds no edge to `lib/transport` or any `lib/tauri/*Service`; a Playwright run that expands three cards and toggles the range twice issues no request the same interaction issues at HEAD |
| QA-64 | Performance | Building the complete master mark set for 200 birds averaging 100 sightings each satisfies `50ms / best >= 10` on the same run, measured with a distinct input per run |
| QA-65 | The gate | `npm run build` and `eslint` both pass; neither is substituted for the other |
| QA-66 | HELP.md | The Named Birds section states the corrected precision, names the two dates the figure measures, and describes the range control (including "per-session, resetting on relaunch"), the per-bird timeline (including the single-sighting exclusion) and the master timeline (including lane order and that every bird gets a lane). **Added at the second design pass:** it also says that marks are selectable, what the line beneath the strip says, and that the arrow keys step through sightings. The Species Detail paragraph at line 201 names the timeline |
| QA-67 | README and website | `README.md`'s Named Birds bullet and `website/index.html`'s Named Birds paragraph both name the timelines, state the figure's endpoints, and say the marks are selectable, using the same formulation as `docs/HELP.md`; the three files are diffed against each other, not only against the code |
| QA-68 | Em dashes | `grep -rn '—'` over the changed `.tsx`/`.ts` rendered strings, `docs/HELP.md`, `README.md`, `website/index.html`, `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` returns nothing new |
| QA-69 | Surface naming | The diff contains no user-facing prose naming this surface from a component or file name; every identifier appearing in the feature's own filenames is grepped out of the prose diff |
| QA-70 | The source sweep | `formatDate.ts`'s docstring, `NamedBirdRow.tsx:95-97`'s comment and `PRODUCT_CONTEXT.md`'s Named Birds entry contain no surviving description of the 30-day borrow, of truncation, or of the old `"1 yr. 2 mos."` example as current behaviour |
| QA-71 | Screenshot | `website/assets/shots/named-birds.webp` is recaptured from the synthetic demo dataset with the master timeline in frame, its `alt` text updated to match, and a magnified crop compared against the previous committed image so no small mark is silently missing |
| QA-72 | Version parity | `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md` and `website/index.html` (pill text, pill `aria-label`, and footer line) all carry the same new patch version; the release-parity guard in `frontend/src/lib/icloudKeysPublishedClaims.test.ts` is green and the three website occurrences are checked by eye, since that guard's `toContain` cannot see the `aria-label` form |
| QA-73 | Existing tests updated, not weakened | The eight existing `formatSightingDuration` cases in `lib/formatDate.test.ts` are rewritten to the new contract with their intent preserved; the "borrows across a month boundary (30-day approximation)" case is replaced by a case asserting the true day count, not deleted |
| QA-74 | Full suite | The full frontend suite is green on a machine with nothing else compiling and a checked load average; any failure is re-run in isolation and then re-run full before being attributed to this change |
| QA-78 | Published statements checked (FR-50) | `PRIVACY_POLICY.md` is unchanged and that decision is recorded. `ACCESSIBILITY.md` **is updated** (no longer conditional): see QA-89 for what it must say |

### Selectable marks (added at the approved second design pass)

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-79 | No text inside the plot, restated (replaces QA-37; FR-22, FR-56) | The plot area contains no rendered text: both axis end labels and both readout lines are siblings of the track in normal flow, not descendants of it. The master's in-listbox caption and axis dates are the one exception and are covered by QA-91 |
| QA-80 | The listbox contract (replaces QA-47; FR-53) | Every plot wrapper carries `role="listbox"`, a non-empty `aria-label`, and a literal `tabIndex={0}`, asserted as attributes and not as props. `aria-activedescendant` is absent with nothing committed, and whenever a selection is committed it equals the `id` of a rendered `role="option"` element in that same listbox. A mouse-hover preview changes the readout text and leaves `aria-activedescendant` byte-identical |
| QA-81 | Tab-stop count and its invariance (replaces QA-48; FR-59) | A Playwright tab-order enumeration of the Named Birds tab, filtering candidates by `getClientRects().length > 0`, counts **exactly 2** new tab stops with one card open: `div[role="listbox"][tabindex="0"]` is 2 and `[role="option"][tabindex]` is 0. The same counts hold with a 2-bird fixture and a 40-bird fixture, after a range flip, and after a Sort change. With every card collapsed the count is **1** (the master only). Verified by the Designer in the mockup at 2, 2 and 1 respectively |
| QA-82 | A mark's accessible name is the whole payload (FR-54) | Each option's accessible name is its full payload and carries no position words. Per-bird: `Jun 15, 2026, Pierce and Washington`. Master: `Bridge-Ravens, Jun 15, 2026, Pierce and Washington`. **Two checklists on one date belong to FREEWAY-TURKEY-FAM, not Bridge-Ravens** (corrected at the QA hand-back: Bridge-Ravens has 9 sightings on 9 distinct dates and therefore no multi-place date at all, while Freeway-Turkey-Fam's 8 sightings fall on 7 dates, which is also the design spec's "8 sightings with 7 marks" example): `Freeway-Turkey-Fam, Jun 12, 2026, Buchanan Curl and Pierce and Washington`. **The two places read CHRONOLOGICALLY, earliest checklist first** — Buchanan Curl at 07:00 (`S356193531`) before Pierce and Washington at 07:50 (`S356373753`) — which is a sort rather than the input order, because `computeNamedBirds` hands its sightings over newest-first with the submission id breaking ties descending. A fixture that feeds ascending order cannot reject the reversed reading and is the reason this shipped. Asserted with `getByRole('option', { name })`, and settled against a real accessibility tree in Chromium and WebKit rather than a jsdom name computation. No option name matches `/\b\d+ of \d+\b/` |
| QA-83 | Set position comes from ARIA, not words (FR-54) | Every option carries `aria-posinset` and `aria-setsize`; `aria-setsize` equals the count of distinct sighting dates for that bird on every option, and the `aria-posinset` values over a lane are exactly 1..N in left-to-right date order with no gaps and no repeats |
| QA-84 | Escape is consumed only while selected (FR-57) | With a selection committed, Escape clears it, keeps focus on the track, and does **not** reach a document-level Escape listener. With nothing selected, the same key press reaches that listener. Both directions are asserted, following the shipped `SpeciesCombobox` guard |
| QA-85 | Selection survives a range flip and a re-sort (FR-58) | With the third sighting of Bridge-Ravens committed, flipping the range to `today` and then changing Sort from `Last Seen` to `Alphabetical` leaves `aria-activedescendant` pointing at an option whose accessible name still names the same bird and the same date; only the option's horizontal position has moved. Collapsing the card unmounts the strip and the selection with it |
| QA-86 | The readout is rendered from first paint and hidden from AT (FR-56) | The readout element exists in the very first commit with the resting line 1 and an empty line 2, is never unmounted and never carries a hiding `display`/`visibility` value in any state, and carries `aria-hidden="true"`. Line 2 reads `{i} of {n} dates`, with `1 date` at n of 1. The readout contains no `<a>` and no link component in any state |
| QA-87 | A press anywhere on the track selects the nearest sighting (FR-55) | A pointer press at x = 0, at x = the track's full width, and at three points inside a dense cluster each commit the sighting nearest in horizontal position, asserted against an independently computed nearest-neighbour oracle over the same positions. No press produces no selection, and no slice of the width is unreachable |
| QA-88 | DOM weight at the NFR-04 fixture (NFR-11) | Mounting the complete master strip for 200 named birds averaging 100 sightings is measured and its cost recorded, with the option-node count and the per-option attribute count stated structurally rather than as a byte figure. Measured on the same run as NFR-04's compute figure so the two are comparable |
| QA-89 | ACCESSIBILITY.md names the right pattern (FR-50) | Keyboard Navigation lists the two new listboxes beside the two roving-tabindex groups it already publishes and states that the new groups use `aria-activedescendant`, **not** roving tabindex. A mutation replacing "aria-activedescendant" with "roving tabindex" in that sentence turns the `tabOrderCoverage.test.ts` prose check red |
| QA-90 | The keyboard map (FR-57) | On a card strip: Arrow Right and Arrow Left move one sighting and clamp at both ends without wrapping; Home and End reach the first and last. On the master: Arrow Up and Arrow Down move one bird and land on the sighting nearest in date to the current one, and the lane landed in takes `--sr-surface-subtle`. Enter and Space are bound to nothing and change neither the selection nor the readout. Blur clears the selection and returns the readout to its resting line |
| QA-91 | Master lane groups and the hidden caption (FR-60, FR-61) | Every lane is a `role="group"` whose `aria-label` is `{name}, {species}`; the visible lane label carries `aria-hidden`, so the bird's name is announced once and not twice. The master's in-listbox caption and its two axis end dates carry `aria-hidden`, and the FR-38 sentence above the listbox carries the same bird count and the same two dates in the accessibility tree |
| QA-92 | The one changed shipped declaration (FR-64) | The collapsed card's duration line no longer carries `white-space: nowrap` and wraps at 320px and 200% text scale without leaving its header column; the date-range line above it still carries `nowrap` and is byte-identical in both range states |
| QA-93 | One shared component, one class prefix, and the two Designer additions (FR-63, FR-65) | Both strips render through the one shared `NamedBirdTickList`, so the hit test, the key handler, the readout contract and the ARIA wiring exist in exactly one module; a mutation to the shared hit test turns both the card-strip and the master-strip rows red. Every rule the feature adds to `globals.css` uses the `.sr-nbt-*` prefix, so QA-58 and QA-59 have named selectors to parse. The per-lane span line renders from the same computed positions as the marks, and the mouse-hover preview is present on desktop and absent on touch; if either is cut, the cut is recorded rather than discovered
