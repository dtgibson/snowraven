# Strategic Brief — Species Detail Weather

## What We're Building

A **weather card on Species Detail** that answers "what have I seen this bird
in?" on the bird's own page: the sky conditions and temperature bands the
selected species has turned up in, each row carrying the same band's share of
all the user's outings beside it, with no picker anywhere, because the user is
already on a species.

It is the v1.0.22 Weather section's per-species view, moved to where the
question is actually asked. The Weather section on Statistics keeps its
distributions and keeps its own per-species view; nothing is taken away from it.

This is a build of a **saved idea the user captured during the v1.0.22 build and
explicitly deferred**, with a real obstacle attached rather than a schedule. The
obstacle is the whole reason this brief exists, and Key Decisions is where it is
answered.

## Why Now

**The derivation is already written and already correct; what is missing is a
way to read it from the tab where the question belongs.**

`WeatherStats.species` in `lib/weatherStats.ts` already holds, for every species
on at least one readable-block checklist: the species name, the count of
readable-block checklists it appears on, its counts across all eleven sky
conditions, and its counts across all seven temperature bands. The per-row
reference figures it needs are the same object's `byCondition` and `byTempBand`
axis totals. The copy that renders it is already written and already swept
(`speciesLedeParts`, `speciesChartNote`, `speciesRowShare` in
`lib/weatherStatsCopy.ts`). The design pattern is already the named exemplar in
`pipeline/design-system.md` for comparing a subset against a population without
printing a rate, and it is the pattern the **user themselves corrected on their
own export** at the v1.0.22 live preview.

So this is not a new derivation, a new parser, a new provider, a new key, a new
network call or a new write. It is a **publication problem**: one already-shipped
data structure, computed inside a worker owned by one tab, needed by a second
tab that holds the same input and cannot see the answer.

**Why the bird's own page is the right home rather than a duplicate.** The
Statistics view needs a picker because Statistics is about the whole export; the
user arrives with no species in mind and must name one. Species Detail is the
opposite: the user arrives having already named one, has the bird's history,
map, media, co-occurring species and named individuals in front of them, and the
weather record is the one part of that history the app can read and does not
show. Answering it there costs the user zero navigations and zero decisions.

**The honest caveat on timing, stated for the second run in a row.** This is not
item 1 of `ROADMAP.md` Up Next. Item 1 is `WebStorage.readFile`'s never-settling
promise, which has a live user sighting attached. It was deliberately deferred
for the v1.0.22 feature and is being deferred again here. That is a legitimate
choice and it is the user's to make, but it has now happened twice, and this
brief says so rather than letting it pass silently a second time.

## The User Problem

A birder on Species Detail has everything about one bird in front of them except
the one thing their own checklist comments already record: what it was like
outside when they found it.

They can get the answer today. It takes leaving the bird's page, opening
Statistics, waiting for the whole tab to compute, scrolling to the Weather
section, and typing the bird's name into a picker to re-select the species they
were already looking at. That is four steps to re-state something the app
already knew, and the answer arrives on a page about everything except that
bird.

The narrower frustration underneath it: this is a **record**, not an analysis.
"I have this bird on eleven checklists with a readable block, nine of them
overcast, none below 45°F" is a fact about the user's own birding that belongs
beside the bird's other facts, in the same way its top locations and its
breeding codes do. Putting it two tabs away frames it as analytics when it is
history.

## Success Criteria

- A user on Species Detail with a species selected can see what they have
  recorded that bird in, without leaving the page, opening a picker, or
  selecting anything.
- For any given species and export, the card's numbers are **identical** to the
  Statistics Weather section's per-species view for the same species. Not
  "consistent". Identical, from one derivation.
- The card is correct on a device where the user has **never opened
  Statistics**, and stays correct if they never do.
- A user reads the bird's own count against the readable-block total before they
  read a single bar, in the same way the Statistics section states coverage
  before it charts.
- A bird with too few weather-block checklists to draw gets a plain sentence
  saying how many it has, and no chart built on three checklists.
- Switching species on Species Detail updates the card at the speed every other
  section on that tab updates. A user stepping through a dozen birds notices
  nothing.
- A user with no weather blocks at all sees no card and pays no cost for it.
- Opening Species Detail is not measurably slower than it is today, measured on
  the reference export rather than argued.
- Nobody reads the card and comes away believing SnowRaven told them what
  weather is good for finding this bird, because no such sentence exists.

## Scope

**1. The card.** One card on Species Detail for the currently selected species:
the bird's own distribution across sky conditions and across temperature bands,
scaled to the bird's own largest band, each row carrying the same band's share of
all the user's outings as a muted reference figure. Sky and temperature
**only**, because those are the only two axes the shipped derivation publishes
per species. It opens by stating the bird's own count against the readable-block
total, and it carries the confound sentence that says the bars reflect when the
user was out as well as the bird.

**2. Four states, not three.** Statistics has `absent`, `below-floor` and
`full`, all decided by the export. Species Detail needs a fourth, decided by the
bird:

| State | Condition | What renders |
|---|---|---|
| Absent | The export carries no weather block at all | No card, nothing in any section index |
| Export below floor | Blocks exist but too few to chart | The coverage line and a route to the Weather tab |
| **Bird below floor** | **Export is above the floor, this bird is not** | **The bird's own count, in words, and no bars** |
| Full | Both above their floors | The card |

The third row is new and is the whole of point 2 of the roadmap bullet.

**3. A per-species floor, as a named constant with its own stated reason.** New,
and deliberately **not** an import of `WEATHER_BAND_MIN_TO_SHOW`. The house rule
from the v1.0.22 PRD is that two independent judgments that happen to agree on a
number do not import each other; they may share a value and must not share a
constant.

**4. Whatever data path makes 1 to 3 true.** This is the substance of the run
and it is a strategy question because it decides whether the feature is worth
building at all. What the feature requires of it is in Key Decisions; the
mechanism is the Architect's.

**5. The sweep that ships with it.** `docs/HELP.md`'s Species Detail section,
`README.md`, `website/`, `CHANGELOG.md`, and the four-file version set. Any new
count-bearing string joins `lib/weatherStatsCopy.ts` so it rides the generated
corpus sweep, and nowhere else.

## Out of Scope

- **A picker of any kind.** Point 3 of the roadmap bullet, and the reason this
  is not a duplicate of the Statistics view.
- **Wind and day/night per species.** They are whole-export axes on Statistics
  and are not in the published per-species table. Adding either is a payload
  change and a follow-on run, not a ride-along.
- **Any change to the Statistics Weather section.** Its distributions, its
  per-species view and its picker all stay exactly as shipped. If the seam lets
  Statistics get simpler later, that is a separate change with its own evidence.
- **Any ranked or predictive claim about the bird.** No "best conditions for",
  no "expect to find", no leaderboard, no word "correlation". This was the
  v1.0.22 decision that mattered most and it is inherited whole.
- **Any rate.** Two shares of two different wholes sit side by side and nothing
  divides one by the other. Also inherited whole.
- **Any network call, key, backend change, provider, or write.** The card reads
  the loaded backup and nothing else, so `PRIVACY_POLICY.md` is unaffected.
- **Tide.** Same comments, same deferral, same reason: a tide state is a moment,
  not a range.
- **Weather on the Calendar or the Map Explorer.**
- **A new tab.**
- **Retiring or re-scoping roadmap Up Next item 1.** It stays first after this
  ships.

## Key Decisions

### The data path: what the feature needs from it, and what would sink it

**The mechanism is the Architect's call. These are the properties the feature
cannot do without, and each one is a real fork that a plausible design fails.**

**It must be one derivation, not two implementations.** The card and the
Statistics per-species view must both come out of `computeWeatherStats`. A
second implementation that agrees today is a pair of numbers that will disagree
later, on a screen where the user can reach both in two clicks, about their own
data. If the two can diverge, the feature is not worth building.

**The whole-export aggregate is required, so "parse only this bird's checklists"
is not an available shortcut.** Species Detail holds the observations and could
cheaply parse only the blocks on the checklists this species appears on. That
produces the bars and **cannot produce the card**: the per-row reference figure
is the same band's share of *all* outings, and the coverage line is the readable
count against *all* checklists. Both are export-wide. Whatever the seam does, it
does it for the export, not for the selection. Say this plainly to the Architect
so the cheap-looking option is recognised as not being one.

**It must not be conditional on the user having opened Statistics.** This is the
sharpest constraint and the one with the most attractive wrong answer. v1.0.18
established a real precedent: Species Detail's `Show escapees` reads the answer
Statistics already saved on this device, and "where Statistics has never run the
check nothing changes." That precedent is correct there and **wrong here**, for
a stated reason. The escapee answer requires a network call and an eBird key, so
"Statistics has not checked yet" is an honest state the app cannot resolve on
its own. The weather answer requires nothing the tab does not already hold. A
card that is silently absent because the user has not visited another tab is not
a coverage statement, it is the app failing to read a file it has open, dressed
as one. A cache is fine; a cache-only read is not.

**Switching species must be a lookup, not a recompute.** Species Detail's entire
interaction model is stepping between birds. If selecting a species costs a
parse, the card taxes the tab's primary gesture. The published derivation
already holds every species' row, so this is satisfied by construction on any
seam that publishes the aggregate, and violated by any design that computes
per-selection.

**A user with no weather blocks must not pay for it.** The absent state is a
real state, it is common on a fresh install, and the section on Statistics
already handles it by not existing. Nothing this feature adds may cost anything
on an export with no blocks, and nothing it adds may join the entry chunk
(`entryChunk.test.ts` is the guard that says so).

**The cost is measured on the reference export, not argued.** The relevant
shipped numbers: the whole Statistics chain runs 48 to 65 ms, `computeWeatherStats`
alone 9.2 ms (8.4 to 10.1, median of nine), on 21,856 rows / 3,251 checklists /
353 blocks, and the parse cost is bounded by the **block** count rather than the
checklist count. The 20 ms budget the roadmap bullet refers to rejected two
independent entry points each locating and parsing every block *inside one
chain*; it is a real precedent and it is not automatically dispositive one tab
over. So: **do not assume a second parse is affordable, and do not assume it is
not.** Measure the added main-thread cost of the chosen path on opening Species
Detail and on switching species, on the reference export, and record it at the
definition site the way `statsBundle.ts` already does.

**One property the derivation does not currently have, and it is a precondition
rather than a detail.** `computeWeatherStats(checklists, filtered)` is called
with `filterObservations(observations, includeSpuh)`, so its output **varies
with the Statistics tab's Count all forms setting** and is not a pure function
of the export. A published record is therefore a record of one variant, and a
card that reads it would silently inherit a display setting from a tab the user
may never have opened, on a page that has its own, differently-named form
switches. The card's numbers must be a function of the export and the bird.
Resolving which variant is published, or making the read variant-independent, is
part of choosing the seam and not something to discover during the build.

**What would make the feature not worth building.** Any one of these, and the
right answer is to stop and spend the run on roadmap item 1 instead, because the
question is already answered one tab away and the cost would be paid by every
user on every species including those with no weather data at all:

- the only affordable path adds a measurable stall to opening Species Detail or
  to switching species;
- the only workable path makes the card conditional on a prior Statistics visit;
- the two surfaces can produce different numbers for the same bird and the same
  export.

State the finding either way. "We measured it and the seam was not worth its
cost" is a real outcome of this run and a good one; it retires an idea that has
been sitting on the horizon with an unanswered question attached.

### The coverage precondition travels, and it grows a second floor

**Every figure on the card is about "the N checklists that carry a readable
weather block", never about "your birding", and the copy says so in those
words.** Inherited whole from v1.0.22, where it is the decision the section is
built around.

**The bird's own count comes first, before any bar.** `speciesLedeParts` already
writes exactly this sentence and it is already the first thing the Statistics
per-species readout says. On Species Detail it does more work, because the user
did not choose this bird for its weather coverage; they chose it for other
reasons and the card has to tell them, unprompted, how much of that bird's
history it can actually speak to.

**Below the per-species floor the card states the count and draws nothing.** The
failure this prevents is named in the roadmap bullet: a bird whose records mostly
predate the user's weather blocks getting a confident-looking chart built on
three checklists. Note the scale of it rather than treating it as an edge case:
on the reference export 353 of 3,251 checklists carry a block, so **a card that
is a sentence rather than a chart will be the ordinary outcome for a large share
of species**, and that is an argument for the sentence being good, honest and
quiet, not for lowering the floor.

**Which is why the card must be quiet when it has little to say.** It sits low
in the tab's order, never above the bird's own history, and it never occupies a
prominent slot with an apology. The Designer places it; the constraint is that a
below-floor card must read as a fact about coverage, not as a broken chart.

**The floor is a named constant with its reason in the code**, following
`RATINGS_MIN_TO_SHOW`, `ONLY_ADULTS_MIN_ASSETS`, `WEATHER_SECTION_MIN_READABLE`
and `WEATHER_BAND_MIN_TO_SHOW`. The Planner owes the number and the sentence
justifying it. My recommendation is that it be **higher than the export-wide
floor of 5**, because five checklists spread across eleven sky conditions is
eleven rows of ones and zeros, and a distribution that thin misleads more on a
single bird's page than the same five checklists do as a whole-export summary.

**A thin band is never dropped.** The three shapes stay separated: a band with
data draws its rail, a band with none draws the dashed empty track and says so,
and a band whose derived figure is thin keeps its primary rail and replaces only
the derived one. Dropping bands makes the distribution itself lie.

### No picker, and what follows from that

**The card is about the species already selected, and takes its selection from
the tab's existing species control.** There is no second selector, no "All
species" rest state, and no independent species state on the card. If no species
is selected, there is no card.

**The axis control may travel; the species control may not.** The Sky /
Temperature toggle is a question about the card, not about which bird, so it can
come across if the Designer wants it. Any control that names a species cannot.

**The card reports the species as the life list counts it.** The published
per-species tally dedupes on the normalized common name, so forms fold into
their parent and counts are checklists rather than sightings, which is what makes
this list match the life list. Species Detail carries its own form and escapee
switches, so where a reading could differ from the number the user sees elsewhere
on the page, the card says which basis it is on rather than leaving the two
numbers to disagree in silence.

### The section on Statistics keeps its distributions, and keeps its per-species view

The idea says so and it is right. The whole-export distributions across sky,
temperature, wind and day/night are about the user's birding, have no home on a
page about one bird, and stay where they are. The Statistics per-species view
also stays: it is reached from a different starting point (no species in mind)
and removing it would take a working feature away from users who have it. Two
views of one derivation is the correct outcome here, and it is only correct
because they are guaranteed to agree.

### The design rules travel unchanged

`pipeline/design-system.md`'s subset-against-a-population pattern is this card,
by name. **Draw the bird's own rows scaled to the bird's own largest value, and
carry the population's share of the same band as a muted trailing figure.** The
shared rail is the tempting alternative and it is the one the user rejected on
their own export at the v1.0.22 preview, in those words: "1 of 395 and a tiny
bar". It does not come back. The incompressible trailing figure takes its own
row at every width. No positive `min-width` anywhere in the pattern. A row with
no population at all carries no reference figure, since "0%" only repeats what
the row already said.

### Alignment with the product brief, checked rather than assumed

Same user: a birder with their own eBird export who wants richer ways to look at
their own records. No new audience and no new prerequisite. Same purpose: the
founding brief says official tools do not let you explore your own data in the
ways you might want, and this is data the user typed into their own checklists,
sitting in their own export, unreadable to them on the page about the bird.
Every founding decision holds without strain: local-first and privacy-first (no
network call, no provider, no telemetry, nothing leaves the device), alongside
eBird rather than replacing it (it reads what eBird gave back and writes nothing
to it), no accounts and no keys. Nothing in the brief's Out of Scope list is
touched. Species Detail is already a named feature of the product; this deepens
it rather than adding a surface. And it continues the loop v1.0.22 opened: the
analytics side reading what the weather side has been writing since the first
release, now on the page where the question gets asked.

## Open Questions for the Planner

- **OQ-01.** The per-species floor's value and its stated reason. Recommendation
  above is that it exceed the export-wide floor of 5; the number and the sentence
  are the Planner's.
- **OQ-02.** Whether the below-floor card points anywhere. On Statistics the
  below-floor state routes to the Weather tab, which is actionable there because
  the user is looking at their whole export. For one bird whose records predate
  their blocks, filling in the backlog may not change this card at all, so a
  route could be a promise the app cannot keep. Decide, and if it routes, say
  what it will and will not fix.
- **OQ-03.** Whether the card appears in whatever section index or jump
  affordance Species Detail carries, and whether it disappears from it in the
  absent state the way the Statistics nav entry does.
- **OQ-04.** Which variant of the derivation is published, given the
  `includeSpuh` dependency named above, and whether the card states its basis.
