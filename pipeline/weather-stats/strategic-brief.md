# Strategic Brief — SnowRaven Weather Stats

## What We're Building

A **Weather** section on the Statistics tab that reads the weather blocks
already sitting in the user's own checklist comments and reports what their
birding actually looked like across sky condition, temperature, wind, and time
of day.

SnowRaven has been writing those blocks since its first release. It has never
read one back. Every block the user pasted into eBird came home in their next
backup export, and the app currently does exactly two things with it: detects
that it is there, and hides it from view. This feature is the third thing:
read it.

Everything is derived from the eBird backup already loaded. No new network
call, no new provider, no backend change, nothing written anywhere, and no
change to `PRIVACY_POLICY.md`.

## Why Now

**The loop is already three-quarters built, and nobody has closed it.**

- `frontend/src/lib/commentBlocks.ts` already finds a block's exact span in a
  comment, already knows the SnowRaven dialect from the RainCrow one
  (`hasSnowravenWeatherBlock` / `hasRaincrowWeatherBlock`), and already carries
  the label vocabulary as a named constant taken verbatim from the formatter.
  It was hardened against real export shapes (prose sharing the block's line,
  night blocks, attribution-less blocks) and verified against the user's full
  backup at 308 block-bearing comments with zero residue.
- `frontend/src/lib/birdingStats.ts:653-694` **already computes weather-block
  coverage**, and `BirdingStats.tsx:1851-1868` already ships it as a
  "Weather & tide blocks" bar group in Data Quality, gated so it does not render
  at all when the count is zero. The honesty pattern this feature needs most is
  already shipped, one card away from where the new section goes.
- The Weather Backlog (v0.5.67) exists to fill in checklists that have no
  block, and today it offers the user no reason to bother. This gives it one,
  and turns two features into a loop: work down the backlog, watch the section
  get sharper.

**The honest caveat on timing:** this is not the first item in `ROADMAP.md`
Up Next. Item 1 is `WebStorage.readFile`'s never-settling promise, which has a
live user sighting attached (a permanent spinner during the v1.0.21 preview).
That is a defect and this is a feature, and defects normally win. This is a
deliberate choice to build the thing the user asked for; it does not retire
item 1, which should stay first in the roadmap after this ships.

## The User Problem

A birder cannot answer "what weather do I actually bird in, and does it show up
in what I record?" from any tool they have. eBird will not tell them. Their own
export will not tell them, because the answer is buried in free text inside a
comment field.

The specific frustration this addresses is narrower and more real than
"analytics": the user has pasted the same ten-line block into hundreds of their
own checklists, by hand (308 block-bearing comments in this user's own backup at
the v0.5.27 verification), and it is inert. It exists to be read by other people
looking at the checklist. It has never been read by them.

Three questions they can nearly answer and cannot:

- **When do I go out?** Not by month or hour (Statistics already covers that),
  but by conditions. Am I a fair-weather birder who thinks they are not?
- **Does the weather change what I record?** Do I log fewer species when it
  rains, and if so is that the birds or is it me going home early?
- **What have I seen this bird in?** Not a prediction, a record: every
  temperature and sky I have this species in.

## Success Criteria

- A user reads the section and can say, in one sentence, what fraction of their
  birding it describes. That number is visible before any chart is.
- A user with no weather blocks sees a plain statement and a route to the
  Weather Backlog, never an empty chart or a figure computed from nothing.
- A user with thin coverage sees which parts of the picture are thin, by
  looking at the chart rather than by reading a disclaimer.
- Every derived average carries the number of checklists behind it, in the
  figure.
- Nobody reads a sentence in this section and comes away believing SnowRaven
  told them what weather is good for birding, because no such sentence exists.
- A block that is partly unreadable still contributes the fields that did read,
  and the number of blocks that could not be read at all is shown.
- Every existing Statistics figure is byte-identical after the change.

## Scope

**1. Coverage, stated first.** The section opens with the fraction of the
user's checklists carrying a **readable** weather block, plus the count of
blocks that were found but could not be read. Below a floor of readable blocks
the section shows this line, a pointer to the Weather Backlog, and nothing
else. See Key Decisions for which of the two shipped detectors defines the
numerator; this is not a free reuse of the Data Quality counts.

**2. A block parser.** A new pure module that takes a comment, uses the
existing span finder to locate the block, and returns a partial record. Two
constraints are non-negotiable and are the reason this is not a trivial module.
eBird returns comments **HTML-entity-encoded**, so the parser decodes first
(`decodeEntities` in `lib/commentText.ts`) and never touches `innerHTML`. And
eBird's CSV export **collapses the block's pasted newlines into spaces**, so
the parser cannot be line-based; it works on the span the stripper already
knows how to find. That single fact is the documented cause of all three
shipped strip bugs, none of which was visible to formatter-fixture tests.

Fields available in the shipped block format, and all that are in scope:

| Field | Form in the block | v1 use |
|---|---|---|
| Condition | leading emoji, closed 11-value set | primary grouping |
| Night | second emoji present (moon phase) | day/night split |
| Temperature | `Temperature: 52 - 58°F` (range) | banded |
| Wind | `Wind: Light breeze - Gentle breeze` (9 Beaufort words) | banded |
| Cloud Cover | `Cloud Cover: 75 - 90%` | banded |
| Wind Direction, Humidity, Dew point, Sunrise, Sunset | labeled | parsed, not charted in v1 |

**3. Your outings by weather.** A distribution: how many of the readable
checklists fell in each condition, each temperature band, each wind band, and
day versus night. This is descriptive, not a correlation, so it is honest at
any sample size, and it is the denominator every other figure needs.

**4. Species per checklist by weather.** Average species recorded per checklist
by temperature band and by condition, with **average duration for the same
bands shown beside it**, so the effort confound is visible on the chart rather
than buried in a note.

**5. One species, its weather.** Pick a species, see the conditions and
temperature bands you have recorded it in, with counts. A record of what
happened, not a claim about the bird.

**6. One section, one component file.** The new section is one
`NAV_SECTIONS` entry plus one `SectionCard` in its own component file, which is
the shipped precedent for a heavy section (`MediaStatsSections.tsx`,
`ProjectsSection.tsx`, `FrivolousListsSections.tsx`). `BirdingStats.tsx` is
2,326 lines and should not grow by a section's worth.

**7. The sweep that ships with it.** `docs/HELP.md` Statistics section,
`README.md`, `website/`, `CHANGELOG.md`, and the four-file version set.

## Out of Scope

- **A "birds most associated with rain" leaderboard.** This is the idea's third
  example and it is deliberately deferred. See Key Decisions.
- Any predictive or recommending copy: "best conditions for", "you should try",
  "expect to find".
- Statistical inference of any kind. No p-values, no significance tests, no
  confidence intervals, and the word "correlation" does not appear in user
  copy.
- Tide blocks. They are in the same comments and this is the obvious follow-on,
  but tide doubles the parse surface and has its own honesty problem (a tide
  state is a moment, not a range), so it is its own run.
- Moon phase as an axis. It is in the block, but only on night checklists, so
  its coverage is a fraction of an already-partial fraction.
- Humidity, dew point, and wind direction as charted axes. Parsed and stored,
  not displayed, so the next run does not need a parser change.
- Cross-checklist weather lookups. If a checklist has no block, it has no
  weather. The app does not fetch one to fill a gap.
- Any write. The parser never modifies a comment and the feature never offers
  to add a block to one. Bulk backfill is not this feature.
- A new tab.
- Surfacing weather on Species Detail, the Calendar, or the Map Explorer.
- Unit conversion. Blocks are written in °F and percent, and the figures read
  in the units the blocks carry.
- Backend work. This is frontend-only, and the Python formatter is untouched.

## Key Decisions

**It is a section of the Statistics tab, not a tab of its own.** Three reasons,
in order of weight. First, **the coverage problem makes a tab dishonest**: a
tab is a permanent promise in the navigation shown to every user including the
one with zero weather blocks, and this feature is empty for a brand-new user
and thin for many. A section can be absent, the way the Data Quality weather
bars already are (they render only when a block exists). Second, Statistics is
where a user goes to look at their history, has the jump-nav and section
pattern to receive this, and since v1.0.20 owns the worker that already holds
the parsed export. Third, the navigation carries ten configurable tabs plus
Settings and was reworked into three densities at v1.0.17; an eleventh is a
real cost.

**The Weather tab was considered and rejected as the home.** The loop argument
is tempting (the backlog lives there) but the Weather tab is a lookup and
workflow surface where the user is mid-task with a checklist id, not a place
they browse their history. The resolution is a pointer, not a move: the
Statistics section points at the backlog when coverage is thin, and the backlog
points at the section.

**Coverage is a precondition, not a footnote.** Every figure in the section is
about "the N checklists with a readable weather block", never about "your
birding", and the copy says so in those words. Below the floor the section
declines to chart. This follows the shipped precedent one card up, where the
weather and tide bars do not render at all when the count is zero.

**The app already has two weather-coverage denominators and they disagree; this
feature must pick one and say which.** `hasWeatherBlock` (`commentBlocks.ts:59`)
is **label-based**: two of the eight labels, or one attribution phrase. It is
what the Weather Backlog and the Checklists filter pill use, and it deliberately
matches an uncredited block. Data Quality's "Any weather" bar
(`birdingStats.ts:653-694`) is **attribution-based**: a SnowRaven credit or a
raincrow.app credit. The recommendation is the **attribution-based** gate,
because a block with no credit is a block whose field vocabulary this feature is
guessing at, and a guessed parse produces a wrong number silently. Two
consequences must be visible rather than papered over: the section's coverage
figure will match the Data Quality bar directly above it, and it will **not** be
the exact complement of the backlog's "checklists with no weather block", which
uses the looser test. If those two numbers ever appear on one screen, the
difference is stated.

**Group conditions by the emoji, not by the description text.** The block's
first line is a single emoji from a closed 11-value set
(`conditionEmoji` in `weatherFormatter.ts:56-68`: thunderstorm, drizzle, rain,
snow, fog, clear, and four cloud tiers). The second line is OpenWeather's free
text, which has a large and drifting vocabulary. The emoji is the robust
grouping key, it is always present, and it is the same anchor the stripper
already uses.

**Day and night come free, and are worth having.** A night block appends the
moon-phase emoji to the condition emoji, unspaced. A second emoji in the run
means night. That is one of the few axes eBird's own tools genuinely cannot
give the user, and it costs one line of parsing.

**Temperature is a range, not a point, and the Planner owes a decision on it.**
A block reads `52 - 58°F` because it covers every hour of the checklist. The
options are: assign the checklist to the band containing its midpoint, or count
it in every band it overlaps. The recommendation is **midpoint**, because
overlap counting inflates every total and makes the distribution stop summing
to the number of checklists, which is the single easiest way for this section
to mislead. A long checklist spanning many bands is the honest cost of that
choice; if it matters, report the median span width once rather than fixing it
per figure.

**Wind reads back as Beaufort words, not miles per hour.** The block stores
`Light breeze`, not a number. That is already an ordinal band, so use it as
one, and do not invent a speed by inverting the threshold table.

**Parse per field, not per block.** A block that yields a temperature but not a
wind contributes to the temperature figures and to no others. The alternative,
discarding the whole block on one bad field, silently shrinks every figure at
once for reasons the user cannot see. The count of blocks found but wholly
unreadable is reported in the coverage line, so a parser that quietly stops
working shows up as a number rather than as a smaller chart.

**RainCrow blocks count, by design.** RainCrow mirrors the same format and
differs in its attribution. A user who came to SnowRaven from RainCrow keeps
their history, which is a better answer than telling them their older
checklists do not count. The two dialects are already distinguished in shipped
code, so this costs nothing.

**No leaderboard in v1, and this is the honesty decision that matters most.**
"Birds most associated with rain" is a ranked claim about birds, and a ranked
claim built on six checklists is noise presented as insight. The list would be
topped by whatever is common, which is not an insight, or by whatever is rare,
which is an artifact. The v1 answer is the per-species view instead: pick a
species and see what you recorded it in. That is a record rather than a claim,
so it is true at any sample size, and it answers the same curiosity. The
leaderboard comes back only if someone can state a defensible ranking rule and
a minimum sample, which is a data question, not a UI one.

**A band below the minimum shows its count and no derived average, and the
minimum is a named constant with its reason in the code.** This is already the
house pattern, not an invention: `RATINGS_MIN_TO_SHOW = 8` and
`ONLY_ADULTS_MIN_ASSETS = 3` in `lib/mediaStats.ts:305-309` each carry a
one-line reason for the number, and the v1.0.3 ranked-list rule in
`ProjectsSection.tsx:56-64` refuses to draw a chart of one because "a bar chart
of one is chrome around a single fact". A thin band does not disappear, because
dropping bands makes the distribution itself lie. It shows the checklists it
has and declines to average them.

**The effort confound is named once, plainly, and shown continuously.** Species
counts rise with time spent and distance covered, and weather changes how long
people stay out, so a "fewer species in the rain" chart may be measuring the
birder. The section says so once, in one sentence, and every species-per-band
chart carries the same bands' average duration beside it. This is the reason
the duration series is in v1 scope rather than deferred: without it the
headline figure is not defensible.

**"No blocks" and "could not read your backup" are different sentences.**
`lib/weatherBacklogLoad.ts` already draws exactly this distinction for the same
data on the Weather tab, and it exists because the app must not tell a user with
a plainly-loaded backup to go and load one. The new section inherits that
resolution rather than re-deriving it.

**Read-only, always.** The parser never writes and never normalizes a comment.
The comment in the user's eBird account is the source of truth and this feature
does not touch it.

**The parser becomes a third consumer of the marker vocabulary, and
`.claude/rules/weather-tide.md` should say so in the same change.** That rule
already requires the marker vocabulary to stay synced with the formatters and
requires re-verification against a real export, because all three shipped strip
bugs were invisible to formatter-fixture tests. A reader is a strictly harder
consumer than a detector, so the rule's `paths` frontmatter should gain the new
module and its warning should name the reader explicitly.

**It aligns with the product brief on every axis, and I checked rather than
assumed.** Same user: a birder with their own eBird export who wants richer ways
to look at their own records. No new audience, and no new prerequisite beyond the
backup nearly every tab already requires. Same purpose: the founding brief says
official tools do not let you explore your own data in the ways you might want,
and this is that almost literally, data the user created sitting in their own
export and unreadable to them. Every founding decision holds: local-first and
privacy-first (no network call, no provider, no telemetry, nothing leaves the
device), works alongside eBird rather than replacing it (it reads what eBird
gave back and writes nothing to it), no accounts and no keys. Nothing in the
brief's Out of Scope list is touched.

**And it closes the origin loop.** The product brief's Origin section records
that SnowRaven began as a weather block generator and grew into an analytics
companion. This is the first feature where the two halves meet: the analytics
side reads what the weather side has been writing all along.
