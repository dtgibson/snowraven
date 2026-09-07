# Strategic Brief — Named Birds: honest durations and sighting timelines

## What We're Building

Three changes to the Named Birds tab, which are really one change. Fix the
elapsed-span figure on each named bird's card, which is currently both
arithmetically wrong and ambiguous about which two dates it measures. Give each
named bird a visual timeline of its sightings, with a switch between "first
sighting to last sighting" and "first sighting to today". And add a master
timeline at the bottom of the tab showing every named bird on the same time
axis, so the user can see at a glance which birds they were following when.

The three are one feature because the bug in part 1 and the switch in part 2 are
the same question: **which endpoint does "how long" run to?** The fix should make
the duration figure and the timeline answer that question the same way, driven by
the same control.

## Why Now

The user reported this as a defect they are living with: their bridge ravens read
roughly "2 mo." and they know that is wrong. It is wrong, in two independent
ways, and both are in shipped code that also backs a published claim on the
website. That makes part 1 a correctness repair on a user-visible figure, not a
polish item.

The timelines are the natural completion of the tab rather than a new direction.
Named Birds already holds, per individual, the full dated sighting list, a map of
where it has been, its ranked locations, and its media. The one thing it cannot
show is the shape of the sightings *in time*: whether a bird is a daily resident,
a spring visitor, or one the user has not seen in months. The tab has every
ingredient for that already loaded and computes nothing new from the network.

## The User Problem

**The duration is wrong, and the code is where it is wrong.** The figure is
rendered at `frontend/src/components/NamedBirdRow.tsx:102-106` from
`formatSightingDuration` in `frontend/src/lib/formatDate.ts:200-229`. It takes
`bird.firstSeen` and `bird.lastSeen` (set in `lib/namedBirds.ts:114-115` as the
lexical min and max of the tagged sighting dates), computes a calendar Y/M/D
difference with a **fixed 30-day month borrow** (`formatDate.ts:214-217`), then
prints only the two most significant non-zero units and discards the rest. Three
defects follow, all reproduced by running the shipped algorithm:

1. **It truncates where its own docstring claims it rounds.** The docstring at
   `formatDate.ts:183` says "a rounded, human-readable elapsed span"; the
   implementation floors. Measured: a 90-day span (2026-05-21 to 2026-08-19)
   prints `2 mos.`; 2024-01-10 to 2024-04-09, also 90 days, prints `2 mos.`; and
   364 days prints `11 mos.`. So `2 mos.` on a card covers everything from two
   months to one day short of three. **This is the most likely source of the
   bridge-ravens complaint**: a span the user counts as roughly three months
   displays as two.

2. **The 30-day borrow is arithmetically wrong for every month that is not 30
   days long.** Swept over every date pair up to 45 days apart across four years,
   the day-count branch disagrees with the true elapsed day count on **15,013 of
   67,500 pairs (22 percent)**, by up to two days. Worked example: 2026-02-27 to
   2026-03-01 is 2 days and the card prints `4 days`. February is wrong by two
   every time; the 31-day months are wrong by one in the other direction whenever
   the borrow lands mid-branch.

3. **The app already has a second, different elapsed-span formatter and they
   disagree.** `formatSpanLength` in `lib/statsFormat.ts:42-49`, used for
   Statistics' "Archive span", *rounds* on 30.44 days per month and switches to
   half-years past 24 months. Two surfaces of the same app give two different
   answers for the same elapsed span.

**And the endpoints are ambiguous, which is the half the arithmetic cannot fix.**
`website/index.html:379` publishes the claim as "how long you've followed it",
unqualified. `docs/HELP.md:545` publishes it as "how long you've followed it (the
elapsed span between the first and last sighting)". For a resident bird the user
is still seeing, "how long you've followed it" reads as first sighting to
*today*, and the code answers first sighting to *last sighting*. The bridge
ravens are exactly that case. The user asking for a "first sighting to present"
timeline in part 2 is the same complaint arriving a second time.

Reproduction note, stated honestly: the exact `2 mo.` string could not be
reproduced from any export on this machine. The repo's reference export at
`data/ebird-backup.csv` holds 9 `[name:bridge-ravens]` sightings from 2026-05-21
to 2026-07-10, which is 50 real days and renders `1 mo.`; the desktop app's
stored copy is older still and carries no bridge-ravens tag at all. The user's
live export is newer than both. The defect class above is established from the
code and holds regardless, but the Engineer should confirm the shipped figure
against the user's current export before and after.

**The timelines answer a question the tab cannot currently answer.** A named bird
is a relationship over time. The card gives dates as a list, newest first, which
is a good record and a poor picture: it does not show clustering, gaps, or how
long it has been since the last sighting. At the tab level there is no way to see
two named birds against each other in time at all.

## Success Criteria

- The bridge-ravens card shows a figure the user recognises as true, and the
  surface says which two dates it measures rather than leaving it to be inferred.
- A 90-day span no longer reads "2 mos."; 2026-02-27 to 2026-03-01 no longer
  reads "4 days".
- Expanding a named bird shows a strip whose ticks visibly cluster where the
  sightings clustered, and switching the range moves the right-hand edge only, so
  the gap since the last sighting becomes the visible difference between the two
  views.
- The bottom of the Named Birds tab answers "which birds was I following when"
  without expanding any card.
- Every figure and every mark is computed from the already-loaded eBird backup.
  No network request is added, on either transport.
- At 320px and 200% in-app text scale the tab still has no horizontal page
  scroll, and the timelines remain legible with colour removed.
- A screen-reader user reaches every fact the timelines show through text that is
  already on the page.

## Scope

**Part 1, the duration fix.**

- Correct the elapsed-span arithmetic. The 30-day borrow goes; the honest
  calculation is a true day difference, with month and year units derived from it
  rather than from a fake borrow.
- Stop discarding the remainder silently. Whatever precision the Designer settles
  on, "2 mos." must not stand for anything up to three months.
- Make the surface state which endpoints the figure uses.
- Correct `formatSightingDuration`'s docstring, which currently claims rounding
  it does not do.

**Part 2, per-bird timelines.**

- A single timeline per named bird inside the expanded card, with a range switch
  between first-to-last (default) and first-to-today. Ticks at each sighting
  date; the card's own dated report list stays exactly as it is.
- Named Birds tab only, following the shipped `showMap` gate in
  `NamedBirdsTable` / `NamedBirdRow`.
- No timeline for a bird with a single sighting.

**Part 3, master timeline.**

- One master timeline at the bottom of the Named Birds tab, below the card list,
  with the same two range options and the same default.
- Every named bird represented, identified by a visible label rather than by
  colour alone.

**Accessibility and theming are in scope and are specified here rather than left
to the Engineer.**

- **The chart is decoration; the text beside it is the accessible equivalent.**
  This is the app's shipped contract, set by `ProjectsSection.tsx:92-112`: the
  chart wrapper is `aria-hidden="true"` plus `inert`, with its caption inside the
  inert wrapper, because every figure it shows is already present as accessible
  text. It fits here without inventing anything: the per-bird timeline sits in a
  card whose report rows already list every sighting date with its location and
  checklist link, so those rows *are* the alternative. The master timeline's
  alternative is the card list directly below it, plus a visible caption naming
  the bird count and the date range in words.
- **Ticks are non-interactive in v1.** That keeps the whole apparatus decoration
  and leaves `lib/tabOrderCoverage.test.ts` untouched. The moment a tick becomes
  pressable it is a control and owes a real `<button tabIndex={0}>` with an
  accessible name, which is a larger change than this run should carry. The range
  switch itself is a control and carries the literal `tabIndex={0}`.
- **320px and 200% text scale.** No text inside the plot area. Labels sit outside
  the plot in normal flow and wrap. The axis is `width: 100%` of its container
  and never sets a min-width that forces page scroll; if the master strip must be
  wider than a phone, it scrolls inside `.sr-scroll-x`, never the page. At 320px
  a full axis is under 300px wide, so ticks must be allowed to overlap rather
  than being spaced apart. Note the trap `.claude/rules/ui.md` records with the
  Named Birds card map as its named example: a `rem` value inside a fixed-px box
  grows when the box does not, so the strip's own height is px and everything
  text-sized stays outside it.
- **Colour.** Every colour a `var(--sr-*)` token present in both `:root` and
  `[data-theme="dark"]`, no hardcoded hex. Reuse the shipped categorical order
  (`CHART_CATEGORICAL` in `ProjectsSection.tsx:77-86`) rather than minting hues.
  If a tick is painted on a filled track, the pair owes a parse-the-tokens
  contrast test in both themes, following `countyContrast.test.ts` and
  `calendarContrast.test.ts`.
- **Motion.** No per-tick entrance animation; anything animated goes through the
  global reduced-motion block in `globals.css`, never a per-component query.

**Docs are in scope and change in the same build**, per
`.claude/rules/docs-and-website.md`, swept at paragraph scope with no em dashes:
`docs/HELP.md` (the Named Birds section around line 545, and the Species Detail
Named Individuals paragraph at line 201 if the gate changes), `README.md`, and
`website/index.html` (line 379, whose "how long you've followed it" is the claim
this fix makes true). Per the v1.0.17 rule the sweep starts at the source, so
`formatDate.ts`'s docstring and `NamedBirdRow.tsx:95-97`'s comment are in the
sweep too.

## Out of Scope

- Binned or aggregate charts. Species Detail already has
  `components/speciesDetail/SightingsGraph.tsx`, a recharts line chart with
  weekly/monthly/yearly bins and a cumulative toggle, for a whole species. What is
  being asked for here is an event strip at exact dates, which is a different
  picture for a different question.
- Interactive ticks: press to open a checklist, hover tooltips, brushing,
  zooming, filtering the master timeline by species or date.
- Changing `formatSpanLength` or Statistics' "Archive span". The divergence is
  named above and is worth converging eventually, but that figure is a shipped,
  published number on another tab and moving it is a separate visible change.
- Per-bird timelines on Species Detail's Named Individuals section (see Key
  Decisions).
- Any new tab, any new dependency, any backend or transport change, any network
  request, anything that writes to disk or syncs.
- Reworking how named birds are parsed, keyed, deduped or sorted.

## Key Decisions

1. **The unit is the named bird, not the species.** The user's request says "for
   each species" in part 2, but the surface models an individual as a
   name-plus-species pair: `namedBirdKey(name, commonName)` in
   `lib/namedBirds.ts:52-54` joins a lowercased name to a normalized lowercased
   species, so "Pete" the Mallard and "Pete" the Canada Goose are two birds and
   subspecies fold to the parent. Every timeline in this feature is per named
   bird, keyed by `NamedBird.key`, using that bird's own `sightings` array, which
   is already deduped to one entry per checklist. The Planner carries this
   forward: there is no per-species timeline anywhere in this run.

2. **One timeline with a range switch, not two stacked timelines.** This is the
   user's own alternative and it is the better one. Two strips of the same events
   at two scales invite a comparison of two pictures carrying one dataset; the
   card is already deep (reports, locations, map, media) and a second axis costs
   phone height for no new information. The interesting difference between the two
   ranges is the silence at the end, and a switch that moves one edge shows that
   as motion rather than as a second picture. Default is first-to-last, as the
   user asked. The Designer settles the visual form and the control's shape.

3. **The duration figure follows the same switch.** This is the decision that
   makes the three parts one feature: the control that moves the timeline's
   right-hand edge also moves the number above it, so "how long" and "the picture
   of how long" can never disagree, and the ambiguity that caused the bug report
   is answered by construction rather than by wording. If the Designer prefers to
   keep the header figure fixed, the fallback is that the header names its
   endpoints explicitly in words.

4. **The master timeline is a lane per bird, not one axis with colour-coded
   ticks.** The user offered both; this is the position and the reason is
   measured, not aesthetic. The app's shipped categorical palette is four
   distinguishable colours plus slate for everything past the fourth, capped at
   eight charted rows (`ProjectsSection.tsx:77-86`), and the house rule stated in
   that same comment is that colour is reinforcement and never the sole carrier
   of identity (WCAG 1.4.1). So "colour-coded for each named bird" is only true
   up to four birds, and labels on a single shared axis collide as soon as two
   birds were seen near the same date, which is the normal case for a birder with
   a patch. A lane per bird gives every bird a permanent label at the left, makes
   overlap readable by vertical alignment instead of by hue, scales to any
   number, and gives the strip its accessible identity for free. Colour may still
   be used as reinforcement within the shipped order. The Designer settles
   density, ordering and what happens past a large bird count.

5. **"To present" must not put a clock read in render.** `react-hooks/purity` is
   build-blocking here, and `formatSightingDuration`'s docstring explicitly rests
   its purity claim on never reading the clock. The house pattern is a
   module-level `const SESSION_NOW_MS = Date.now()` evaluated once at import,
   used by `Calendar.tsx:53-56`, `MapExplorer.tsx:152-153` and
   `map/CountyCompletenessPopup.tsx:16-17`. The pure functions keep taking their
   endpoints as arguments; the caller supplies today's date from that session
   constant. Accepted consequence, same as the Calendar's: a session left open
   across midnight shows the previous day's "today" until reload.

6. **No chart library. `NamedBirds` is on the entry chunk.** `App.tsx:29` imports
   `NamedBirds` statically, unlike every other heavy tab, which are all `lazy`.
   recharts today is reachable only from lazily-loaded tabs (BirdingStats,
   ProjectsSection, MediaStatsSections, speciesDetail/SightingsGraph), so
   importing it here would drag a chart library onto first paint for every user
   on every platform, which is precisely the class of regression
   `lib/entryChunk.test.ts` exists to catch. At a named bird's volume, single
   digits to a few dozen ticks, a chart library buys nothing: hand-rolled inline
   SVG or positioned elements built from tokens is both smaller and more
   controllable. If the Designer's form genuinely needs a library, the answer is
   to lazy-load the timeline component, not to add a static import.

7. **Named Birds tab only for v1; Species Detail's Named Individuals section is
   unchanged.** `NamedBirdsTable` is shared by both surfaces and the Species
   Detail instance is deliberately reduced (no map, no locations, no media) via
   the `showMap` gate, because that tab has its own equivalents. The timeline
   follows the same gate. Species Detail already carries a species-wide time axis
   in `SightingsGraph`, and a second time axis nested inside an accordion inside a
   section on that tab would compete with it. Reversible, and a reasonable thing
   for the Designer to raise with the user.

8. **A single-sighting bird gets no timeline.** Its first and last dates are the
   same and the picture would be a chart of one fact, which the app has an
   existing rule against (the v1.0.3 ranked-list rule, cited in
   `ProjectsSection.tsx:60-64`; `SightingsGraph` returns `null` below two points).
   The header figure still renders.

9. **The correct arithmetic should land as one shared pure helper**, tested
   directly, so that converging Statistics' `formatSpanLength` onto it later is a
   call-site change rather than a rewrite. Doing that conversion is out of scope
   for this run; making it cheap is not.
