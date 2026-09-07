# Schema — named-birds-timelines

**Feature:** named-birds-timelines
**Date:** 2026-09-06
**Stage:** 3 — The Architect
**Source:** prd.md (approved), strategic-brief.md (approved)
**Config read:** `pipeline.config.json` (existing — `react-vite-tailwind` / `python-fastapi`, tokens at `frontend/src/globals.css`, vitest). Not created, not modified.

---

## Architect assessment — Frontend Only

**Verified against the PRD, not taken on report.** All 52 functional requirements,
10 non-functional requirements and 78 verification rows were read. The feature
adds no persisted data, no backend route, no network request, and no derived
document:

- **FR-12** makes the range value session-only React state, explicitly barred
  from `localStorage` and from the `storage` seam.
- **NFR-02** requires zero new network requests on either transport and forbids
  the new modules from importing `transport` or any `lib/tauri/*Service`.
- **NFR-03** states nothing is written to disk, nothing syncs, and no entry
  joins `lib/clearDerived.ts`.
- **FR-50** records `PRIVACY_POLICY.md` as requiring no change because the
  feature adds no network request, no provider, and nothing written to disk.
- Every figure and every mark derives from `NamedBird` / `NamedSighting` records
  already produced by `computeNamedBirds` from the loaded eBird backup.

No persisted state was found anywhere in the requirements. The classification
stands.

**This app has no database.** Its "data layer" is the user's own eBird CSV
export, parsed in the frontend by `lib/parseEbirdObservations` into
`ObservationEntry[]`, cached by `lib/observationsCache`, and grouped per named
individual by `lib/namedBirds.ts`. `NamedBird` and `NamedSighting` are the
only record shapes this feature touches and **neither gains a field**. So the
value of this document is the **module and state architecture**, which is what
follows.

---

## 1. The span arithmetic

### 1.1 Where it lives, and why that is the right module

**`frontend/src/lib/formatDate.ts`.** The PRD's section A heading already names
it; three independent reasons confirm it rather than merely restate it.

1. **`parseParts` is there and is private.** FR-01 requires the new helper to
   reuse it, and it is a module-local function. Any other home means either
   exporting `parseParts` (widening a deliberately private timezone contract) or
   re-implementing the parse — which is the class of divergence this module was
   created to end.
2. **The dependency direction of Key Decision 9's future convergence only works
   this way.** `lib/statsFormat.ts` is reachable only from lazy tabs; `formatDate.ts`
   is on `App.tsx`'s static graph (`App.tsx:24`) and imports nothing. Converging
   `formatSpanLength` later means `statsFormat.ts → formatDate.ts`, which costs
   the entry chunk nothing. The reverse home (putting `formatElapsedSpan` in
   `statsFormat.ts`) would force `NamedBirdRow` to import `statsFormat.ts`,
   dragging `ML_CATALOG_BASE`, the ML link builders and `formatDuration` onto
   first paint for every user on every platform.
3. `formatDate.ts` is already dependency-free and entry-safe, so the two new
   exports add zero bytes of transitive graph.

**Standing rule for this feature: nothing in it may import `lib/statsFormat.ts`.**
The convergence is out of scope (PRD "Out of Scope") and, when it happens, runs
the other way.

### 1.2 Exact signatures

```ts
// lib/formatDate.ts — three new exports, one rewritten export, one private helper.

/**
 * Whole calendar days between two dates, from the Y/M/D parts by integer
 * civil-day arithmetic. Never constructs a Date from a YYYY-MM-DD string,
 * never reads the clock, never throws. Order-insensitive: a reversed pair
 * returns the same magnitude. null when either side is null/empty/unparseable.
 */
export function elapsedDays(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined,
): number | null

/**
 * A day count as display text. Takes a DAY COUNT, not a date pair, so that
 * converging lib/statsFormat.ts's formatSpanLength(days: number) onto it later
 * is a call-site change rather than a rewrite (Key Decision 9, FR-02).
 * '' for a non-finite or negative input. Never throws.
 */
export function formatElapsedSpan(days: number): string

/**
 * A local YYYY-MM-DD from an epoch-milliseconds ARGUMENT. Reads the local
 * getters (so "today" is the user's today, not UTC's) and zero-pads, which is
 * what keeps its output lexically comparable with eBird's own date strings.
 * Takes ms as an argument and therefore never reads the clock; the single
 * Date.now() in this feature is the caller's module constant (FR-14).
 */
export function isoDateFromMs(ms: number): string

/** The call site's entry point. Unchanged signature; new composition (FR-05). */
export function formatSightingDuration(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  const days = elapsedDays(from, to)
  return days === null ? '' : formatElapsedSpan(days)
}

/** Private. Days-from-civil (Hinnant). Pure integer arithmetic, no Date. */
function civilDay(y: number, mo: number, d: number): number
```

`formatSightingDuration` **is exactly** `formatElapsedSpan(elapsedDays(from, to))`
with the null guard, and the fixed 30-day borrow at `formatDate.ts:214-217` is
deleted. FR-06 replaces its docstring with the band table, the exactness
property, and the purity claim.

`compareParts` at `formatDate.ts:232` becomes unused by `formatSightingDuration`
(`elapsedDays` uses `Math.abs` on the civil-day difference instead). It has no
other caller. Delete it with the borrow rather than leaving a dead private.

### 1.3 The band table, and OQ-08

`formatElapsedSpan` derives months and years **from the true day count**, not
from a calendar borrow (OQ-08, taken as the PRD specifies). `DAYS_PER_MONTH`
is 30.44, `DAYS_PER_YEAR` is 365.

| Day count `n` | Output |
|---|---|
| non-finite or `n < 0` | `''` |
| `n === 0` | `Same day` |
| `1 <= n <= 60` | `N day` / `N days` |
| `61 <= n < 365` | `M mos.` where `M = floor(n / 30.44)`, then ` R days` where `R = n - round(M * 30.44)`, day part omitted only when `R === 0` |
| `n >= 365` | `Y yr.`/`Y yrs.` where `Y = floor(n / 365)`, then ` M mo.`/` M mos.` where `M = round((n - Y * 365) / 30.44)`, month part omitted only when `M === 0`; `M === 12` carries into `Y + 1` and omits the month part |

**This was executed before writing, not reasoned about.** Every QA-01 through
QA-14 date pair was run through the civil-day implementation and the band table,
and every expected string reproduced exactly. `elapsedDays` was also swept
against an independent `Date.UTC` oracle over 124,553 pairs from 2000-01-01 to
2030-12-31 at offsets 0 to 400: **zero disagreements.** 1900 (not a leap year)
and 2000 (a leap year) both come out right, so QA-14 passes on the century rule
rather than by accident.

The QA-16 property sweep over 0 to 40,000 also holds as written: the months-band
remainder never leaves 0 to 30, `1 mo.` never appears below 365 days, and
`12 mos.` is never emitted at any input.

**One correction for The Tester on QA-17.** QA-17 reads "exactly one input maps
to each remainder-free `M mos.` string." Measured over 61 to 364, the
remainder-free strings that are emitted at all are exactly:

```
2 mos. → 61    4 mos. → 122    6 mos. → 183
8 mos. → 244   9 mos. → 274   11 mos. → 335
```

`3 mos.`, `5 mos.`, `7 mos.` and `10 mos.` are **never** emitted without a day
part, because the day count that would zero their remainder falls outside the
band that produces that `M`. So the literal reading of QA-17 is vacuous for four
of the ten strings. The property that is true, provable, and carries FR-04's
intent is: **below 365 days the (M, R) pair reconstructs `n` uniquely, so no
string is ambiguous, and `2 mos.` is emitted at 61 days and at no other value.**
Assert that. This is a wording precision, not a design change.

### 1.4 One tolerance to leave alone

`parseParts` accepts any day from 1 to 31 for any month, so `'2026-02-30'`
parses. `civilDay` normalizes such a date (Feb 30 becomes Mar 2) rather than
rejecting it, so `elapsedDays` returns a finite integer for every input
`parseParts` accepts and never throws. This is a **pre-existing tolerance of the
shipped parser, deliberately left as it is**: tightening it would change
`formatDate` and `formatDateRange` output for the same inputs, which is outside
this feature and would be a silent behaviour change on five other surfaces.

### 1.5 Blast radius of the arithmetic fix

`formatSightingDuration` has exactly one caller in the app:
`components/NamedBirdRow.tsx`, which calls it **twice on adjacent lines** (once
as a truthiness gate at line 102, once for the value at line 104). The Engineer
computes it once into a local.

Because that row is shared, **Species Detail's Named Individuals figures change
too** — same endpoints (FR-09 keeps `firstSeen` to `lastSeen` there), new and
correct arithmetic. That is intended: it is the correctness repair, not a scope
leak. QA-27 asserts the Species Detail figure equals
`formatSightingDuration(firstSeen, lastSeen)`, i.e. the new value.

---

## 2. Shared range state

### 2.1 OQ-07 resolved: the master timeline lives inside `NamedBirdsTable`

**Decision: `NamedBirdsTable` — the PRD's default — and the reason is `sort`, not
convenience.**

FR-28 requires lane order to equal card order under whichever option the Sort
control has selected. `sort` is `useState` inside `NamedBirdsTable:34` and the
ordered list is the `sorted` memo at `NamedBirdsTable:40`. Lifting the master
timeline to `NamedBirds.tsx` therefore forces one of two bad outcomes:

- **Lift `sort` to `NamedBirds.tsx`** — which changes a component Species Detail
  also renders, converting `NamedBirdsTable` from self-contained to
  controlled for every caller, for a feature Species Detail must not receive.
- **Duplicate the sort in `NamedBirds.tsx`** — two `sortNamedBirds` calls that
  are required to agree, which is the "two surfaces answering the same question"
  failure this feature exists to remove.

Keeping the strip inside `NamedBirdsTable` puts the shared range value, the sort
order and both timeline consumers in one component, and satisfies the governing
constraint **by construction**: Species Detail's instance renders neither the
master timeline nor the range control because it never opens the gate.

### 2.2 The gate, and why it is one expression

The shipped gate for tab-only surfaces is `showMap={!!singleOpen}`
(`NamedBirdsTable:107`). Species Detail calls
`<NamedBirdsTable birds={…} showSpecies={false} embedAllowed={…} />`
(`SpeciesDetail.tsx:1649`) — no `singleOpen`, so `showMap` is false there today.

This feature needs **one more input the tab alone can supply**: the session's
today (FR-14). That value must be a **prop, not a module import**, and
testability is what decides it: QA-21, QA-29, QA-42 and QA-50 all require a
fixture "today" to be injected, which a module constant read at import cannot
provide without module mocking.

So `NamedBirdsTable` gains `today`, and the two must never disagree.
**Make that a build-time guarantee, not a discipline** — this repo's own
standing lesson is that the rule that travels is the registry, not the habit:

```ts
type NamedBirdsTableProps = BaseProps & (
  | { singleOpen: true;   today: string }   // the Named Birds tab
  | { singleOpen?: false; today?: never }   // Species Detail, and tests
)
```

`npm run build` runs `tsc`, and `npm run build` is half the pre-push gate
(NFR-10), so "the tab passed `singleOpen` and forgot `today`" is a compile error
rather than a silently timeline-less tab. Inside the component, one local:

```ts
// The Named-Birds-tab-only session date. Species Detail supplies neither half
// of the pair, so this is null there and every tab-only surface below is
// absent by construction (FR-09, FR-24, Key Decision 7).
const sessionToday = singleOpen ? today : null
const tabOnly = sessionToday !== null
```

`showMap={!!singleOpen}` is left **exactly as shipped**; `tabOnly` is a strict
subset of it and is what gates the range control, both timelines and the range
end. Re-basing the shipped `showMap` onto the new prop was considered and
rejected: it moves a shipped gate for no behavioural gain.

**Fallback if the union fights the existing destructuring style** (destructuring
a discriminated union loses narrowing): a plain `today?: string` plus the same
`sessionToday` local. Cost, stated: the mismatch becomes a runtime absence that
only QA-21/QA-24 catch, instead of a compile error. Prefer the union.

### 2.3 The state itself

```ts
// lib/namedBirdTimeline.ts
export type SpanRange = 'last-sighting' | 'today'
```

Label-agnostic values naming the endpoint the switch moves (FR-10); the visible
labels live only in the copy module, so a relabel touches one file.

```ts
// NamedBirdsTable — one value for the whole tab (FR-11), session-only (FR-12).
const [range, setRange] = useState<SpanRange>('last-sighting')
```

`NamedBirdsTable` is mounted once per tab and the tab is hidden with
`display: none` rather than unmounted (the app-wide pattern), so the value
survives leaving and returning to the tab and resets on relaunch — which is
exactly the "per-session, resetting on relaunch" phrasing FR-12 requires the
published prose to use. **Nothing else is needed to make that true; do not add
persistence.**

### 2.4 How it reaches every consumer

`NamedBirdRow` has exactly one caller — `NamedBirdsTable`. So the range props
and `showMap` are handed over from the *same* local, two lines apart in one
file. That is a locality, not a discipline spread across the codebase, which is
why the row can keep two props rather than owing a second union:

```ts
<NamedBirdRow
  …existing props unchanged…
  showMap={!!singleOpen}
  timeline={sessionToday ? { range, onRangeChange: setRange, today: sessionToday } : undefined}
/>
```

```ts
// NamedBirdRow's new prop. One optional object, so the gate and the data the
// gate needs cannot separate.
timeline?: {
  range: SpanRange
  onRangeChange: (r: SpanRange) => void
  today: string          // YYYY-MM-DD, the tab's session constant
}
```

Absent on Species Detail → no range control, no per-bird timeline, and the
header figure runs `firstSeen` to `lastSeen` (FR-09, QA-27) **because there is no
other value it could take**, not because a branch remembers to.

The two range controls that can be on screen at once (at most two: `singleOpen`
means one card expanded) read and write this one `useState`, so QA-24's
"pressing the control inside an expanded card changes the master timeline's
caption and a second, collapsed card's figure in the same commit" is React's
own single-render guarantee rather than a synchronisation.

---

## 3. How "today" is threaded

**`components/NamedBirds.tsx` owns the only clock read**, at module scope,
following the four shipped instances of the pattern (`Calendar.tsx:56`,
`MapExplorer.tsx:153`, `map/CountyCompletenessPopup.tsx:17`,
`lib/useHotspotActivity.ts:67`):

```ts
// components/NamedBirds.tsx, module scope — evaluated once at import.
// react-hooks/purity is build-blocking, so this is the ONLY clock read in the
// feature; every pure helper below takes its endpoints as arguments (FR-14,
// NFR-08, Key Decision 5). Accepted consequence, the same as the Calendar's: a
// session left open across midnight shows the previous day's "today" until
// reload.
const SESSION_NOW_MS = Date.now()
const SESSION_TODAY = isoDateFromMs(SESSION_NOW_MS)
```

`SESSION_TODAY` is passed as `today={SESSION_TODAY}` to `NamedBirdsTable`, which
hands it to `NamedBirdRow` inside the `timeline` object and to
`masterAxis(...)`. **No component below `NamedBirds.tsx` reads the clock and no
pure helper takes a clock reading** — QA-28's source scan finds exactly one
`Date.now()`, at module scope in the tab component, as written.

**The zero-padding in `isoDateFromMs` is load-bearing, not cosmetic.** Every
range-end comparison in this feature is a lexical string compare against eBird's
own `YYYY-MM-DD` dates — the same comparison `computeNamedBirds` already uses to
compute `firstSeen`/`lastSeen` (`namedBirds.ts:114-115`). An unpadded
`2026-9-6` would sort after `2026-10-01` and quietly break FR-15's clamp. State
it in `isoDateFromMs`'s docstring and assert it in `formatDate.test.ts`
(a single-digit month and a single-digit day).

`isoDateFromMs` uses `new Date(ms)` and the **local** getters. That is not a
violation of the module's timezone contract: the contract forbids constructing a
`Date` from a `YYYY-MM-DD` *string* (which parses as UTC and shifts a day). The
module already constructs a local `Date` from parts for the weekday
(`formatDate.ts:94`). Reading local getters is what makes "today" the user's
today.

---

## 4. Pure module: `lib/namedBirdTimeline.ts` (new)

Every geometry decision lives here so it is unit-testable without rendering
(NFR-04/QA-64 needs a pure function to time, and NFR-02/QA-63 needs the feature's
modules to be enumerable for an import-graph walk).

```ts
import { elapsedDays } from './formatDate'
import type { NamedBird, NamedSighting } from './namedBirds'   // TYPE-ONLY, erased

export type SpanRange = 'last-sighting' | 'today'

export interface TimelineAxis {
  start: string     // YYYY-MM-DD, left edge
  end: string       // YYYY-MM-DD, right edge
  spanDays: number  // elapsedDays(start, end) ?? 0; 0 means "no axis"
}

export interface TimelineLane {
  key: string          // NamedBird.key
  name: string         // display name
  commonName: string   // display species
  marks: number[]      // percent positions, ascending, one per distinct date
}

/**
 * The right-hand endpoint under the active range. FR-15's clamp lives HERE and
 * nowhere else: with range 'today' and a mis-dated export whose lastSeen is in
 * the future, the end is lastSeen, so the axis never runs backwards. Lexical
 * max on YYYY-MM-DD — the same comparison computeNamedBirds already relies on.
 */
export function rangeEnd(lastSeen: string, range: SpanRange, today: string | null): string

/**
 * One bird's axis (FR-19). `today` is ignored when range is 'last-sighting',
 * and a null `today` forces 'last-sighting' — which is the Species Detail
 * instance, which has no session date.
 */
export function birdAxis(
  bird: Pick<NamedBird, 'firstSeen' | 'lastSeen'>,
  range: SpanRange,
  today: string | null,
): TimelineAxis

/** The shared axis across every named bird (FR-26). Order-independent. */
export function masterAxis(birds: NamedBird[], range: SpanRange, today: string | null): TimelineAxis

/** Distinct sighting dates, ascending. Two sightings on one date → one entry (FR-20, FR-32). */
export function distinctDates(sightings: NamedSighting[]): string[]

/** Percent positions on an axis (FR-20). Clamped to [0, 100]; [] when spanDays is 0. */
export function markPositions(dates: string[], axis: TimelineAxis): number[]

/** Every bird's lane, in the ORDER GIVEN (FR-27, FR-28). No cap, no truncation. */
export function buildLanes(birds: NamedBird[], axis: TimelineAxis): TimelineLane[]

/** The shipped categorical order, RE-DECLARED here (FR-41) — never imported
 *  from components/ProjectsSection.tsx, which is a lazy chunk. */
export const LANE_COLORS: readonly string[]
export function laneColor(i: number): string
```

Four properties that must be built in rather than left to call sites:

1. **`markPositions` returns `[]` when `spanDays === 0`** rather than dividing by
   zero. A `NaN` in a `left:` style is a silent visual break with no error.
2. **Positions are clamped to `[0, 100]`.** FR-15's clamp already makes an
   out-of-range value unreachable, and `masterAxis`'s start is the minimum
   `firstSeen`, so the clamp never fires in practice — which is exactly why it
   should be present: it turns QA-29's "no negative or inverted mark positions"
   into a property of the module rather than a consequence of two other
   functions being right.
3. **`rangeEnd` is the single site of the clamp.** The header figure, the
   per-bird axis and the master axis all reach it through `birdAxis` /
   `masterAxis`, so Key Decision 3's "how long and the picture of how long can
   never disagree" is structural.
4. **`buildLanes` computes every lane's marks at one chokepoint**, so every lane
   is fixed-shape by one write path — the house rule for derived fields, applied
   to a render-time derivation.

The only value import is `./formatDate`; `NamedBird` / `NamedSighting` come in
as `import type` and are erased at build. **This module is therefore entry-safe
by construction**, which matters because it will ride the entry chunk (§6).

---

## 5. Component boundaries

Three new components. All three are ordinary static imports (§6 explains why
that is safe and what it forbids).

### 5.1 `components/NamedBirdRangeControl.tsx`

```ts
{ range: SpanRange; onChange: (r: SpanRange) => void; groupLabel: string }
```

Reuses the shipped pill pattern verbatim from `NamedBirdsTable:67-96`:
self-bordered `<button>`s inside `.sr-wrap-flex` with `['--sr-wrap-gap']: '6px'`,
each carrying `className="sr-touch-target"`, `aria-pressed` reflecting selection,
and a **literal `tabIndex={0}`**, inside a `role="group"` with an `aria-label`
(FR-13, QA-26, QA-60).

**It must not import `SegControl` from `components/map/MapSidebarUI.tsx`**
(FR-13). That module statically imports `lib/countyTextures` and
`lib/countyCompleteness`; pulling it here would put the county texture and
completeness band tables on first paint.

Rendered in two places, both reading and writing the one `useState`: inside the
expanded card (from `NamedBirdRow`) and above the master timeline (from
`NamedBirdsTable`). `groupLabel` is a required prop, not a default, so the two
instances get distinguishable accessible names from the copy module rather than
two identical groups on one page.

### 5.2 `components/NamedBirdTimeline.tsx` — the per-bird strip

```ts
{ axis: TimelineAxis; dates: string[] }
```

**Receives** the axis and the distinct dates; **computes** only the percent
positions and its own labels. It receives rather than computes the axis because
`NamedBirdRow` needs that same axis for the header duration figure — one
computation feeding both is what makes FR-07 and the strip incapable of
disagreeing.

Render shape, which is the part most likely to be got wrong:

```
{dates.length < 1 → null}                                    ← unreachable in practice
{axis.spanDays === 0}
  → <p>{oneDateSentence(axis.start)}</p>                     ← plain sentence, NOT inert (FR-18)
{otherwise}
  → <div aria-hidden="true" inert>   … marks only, NO TEXT NODE …  </div>   (FR-33, QA-37)
    <div>{formatDate(axis.start)}</div>  <div>{formatDate(axis.end)}</div>   ← SIBLINGS of the wrapper (FR-22, QA-37)
```

QA-37 settles the ambiguity itself: "every label is a sibling of it in normal
flow." So for the per-bird strip the `aria-hidden` + `inert` element **is** the
plot wrapper and contains no text node; the two endpoint labels are its
siblings, in normal flow, allowed to wrap, rendered through `formatDate` so they
honour the date-format preference (QA-36).

The row, not this component, owns the two render gates (FR-17): the component is
only mounted when `bird.sightings.length >= 2`.

### 5.3 `components/NamedBirdMasterTimeline.tsx` — the master strip

```ts
{ lanes: TimelineLane[]; axis: TimelineAxis; showSpecies: boolean }
```

**Receives** the lanes fully computed (percentages included) from
`NamedBirdsTable`'s memo; **computes** nothing but its copy.

```
<p>{masterEndpointSentence(lanes.length, axis, range)}</p>   ← OUTSIDE the wrapper, in the a11y tree (FR-38, QA-50)
<div aria-hidden="true" inert>                               ← the whole strip (FR-33)
  <span>{masterCaption(lanes.length, axis, range)}</span>    ← INSIDE it (FR-33 is explicit)
  {lanes.map(lane => (
    <React.Fragment key={lane.key}>
      <div class="sr-nbt-lane-label">…name (+ species)…</div>  ← outside the TRACK, wraps (FR-29, FR-30)
      <div class="sr-nbt-lane-track">…marks…</div>             ← the plot area, no text
    </React.Fragment>
  ))}
</div>
```

**The master's inert wrapper deliberately DOES contain text** (the caption and
the lane labels), and that is not in tension with QA-37 — QA-37 sits in the
per-bird timeline table and governs that strip only. FR-33 explicitly puts the
caption inside the wrapper, and FR-36 says no per-lane text alternative is added
inside it, which is only coherent if the lane labels are inside and therefore
out of the accessibility tree. FR-29's "visible text label" is a WCAG 1.4.1
colour-independence requirement for sighted users; the accessible equivalent is
the card list directly below plus the endpoint sentence.

**Lane labels are plain `<span>`s. Do not call `renderSpecies` here.**
`renderSpecies` renders `<BirdName>`, which emits anchors; anchors inside an
`inert` wrapper would join `lib/tabOrderCoverage.test.ts`'s counted `<a href>`
population and press on QA-49 for a link that can never be reached. `showSpecies`
selects between `lane.name` and `lane.name` + `lane.commonName` as text.

FR-30's 120-character bound (`NAME_TAG_RE` at `namedBirds.ts:41`) governs the
label column: it wraps, it carries **no** `white-space: nowrap`, and it must hold
120 characters plus a species name at 320px and 200% text scale (QA-57).

### 5.4 Changes to the three existing components

**`components/NamedBirds.tsx`** — adds the two module constants (§3) and
`today={SESSION_TODAY}` to its `<NamedBirdsTable>` call. Nothing else.

**`components/NamedBirdsTable.tsx`** — adds `today` to the props union, the
`range` state, the `sessionToday` / `tabOnly` locals, the two memos (§5.5), the
range control above the master strip, the master strip after the rows, and the
`timeline` prop on each `<NamedBirdRow>`. Sort control, row list, count line and
the Species Detail path are untouched.

**`components/NamedBirdRow.tsx`** — adds the `timeline` prop; computes the axis
once and uses it for both the header figure and the strip; renders the range
control and the strip inside the expanded panel; corrects the comment at lines
95-97 (FR-49).

```ts
// NamedBirdRow — one axis, two consumers. The header figure IS the axis's span,
// so the number and the picture of the number cannot disagree (Key Decision 3).
const axis = birdAxis(bird, timeline?.range ?? 'last-sighting', timeline?.today ?? null)
const duration = formatElapsedSpan(axis.spanDays)   // computed ONCE; gate and value
```

`{formatDate(bird.firstSeen)} – {formatDate(bird.lastSeen)}` at line 100 is
**byte-identical to HEAD in both range states** (FR-07, QA-22): those two dates
are facts about sightings and do not move when the range moves.

### 5.5 Memoization — what is warranted at the real data volumes

Read from `lib/namedBirds.ts`: a `NamedBird` holds `sightings: NamedSighting[]`,
already deduped to one entry per checklist. A named bird's sightings are single
digits to a few dozen. So:

- **Per-bird strip: no memo.** `distinctDates` + `markPositions` over a few
  dozen strings, computed in the row's render. A memo here would cost a
  dependency array to get wrong and save nothing measurable. The row's existing
  `cardMarkers` memo exists for a different reason (array identity stability for
  `SightingsMap` / `MapBoundsFitter`), which does not apply to a strip whose
  children are plain divs.

- **Master lane set: two memos, and this is the one place a memo earns itself.**
  `buildLanes` is O(birds x sightings) — NFR-04's target is 200 birds x 100
  sightings = 20,000 dates — and the tab re-renders on every accordion toggle
  and every range press.

```ts
// masterAxis is order-independent, so it depends on `birds` (stable across a
// Sort change) rather than `sorted` — a Sort change then moves lanes without
// recomputing the axis.
const axis = useMemo(
  () => masterAxis(birds, range, sessionToday),
  [birds, range, sessionToday],
)
const lanes = useMemo(() => buildLanes(sorted, axis), [sorted, axis])
```

**The axis is memoized specifically so it can be a dependency.** A freshly
constructed `{start, end, spanDays}` object per render would make the `lanes`
memo fire every time; depending on `axis.start` / `axis.end` instead would work
but leaves `react-hooks/exhaustive-deps` unsatisfiable. Memoizing the axis makes
both memos correct and lint-clean.

Both memo bodies are pure — no clock read, no I/O — so `react-hooks/purity`
(build-blocking, NFR-08) is satisfied.

---

## 6. The entry-chunk consequence

`App.tsx:29` imports `NamedBirds` **statically**, unlike every other heavy tab
(MapExplorer, SpeciesDetail, BirdingStats, HelpDocs, ListComparer, Checklists,
Calendar, CommandPalette are all `lazy`). **Everything this feature adds rides
the entry chunk and is paid for on first paint by every user on every platform.**

### 6.1 What may be imported

- `react`, `lucide-react` — both already on the entry graph.
- `lib/formatDate.ts` — already on it (`App.tsx:24`), dependency-free.
- `lib/namedBirds.ts` — already on it via `NamedBirds.tsx`.
- `lib/namedBirdTimeline.ts` (new) — one value import (`./formatDate`), one
  type-only import. Entry-safe by construction.
- `lib/namedBirdTimelineCopy.ts` (new) — must import **nothing**, or at most
  `formatDate`. It holds strings and count-agreement helpers.

### 6.2 What may NOT be imported, anywhere in this feature's graph

| Forbidden | Why |
|---|---|
| `recharts` or any charting package | NFR-01 / QA-61. Its four importers (`BirdingStats`, `MediaStatsSections`, `ProjectsSection`, `speciesDetail/SightingsGraph`) are all lazy-only today; a static edge here puts ~112 KB gz on first paint |
| `components/map/MapSidebarUI.tsx` (`SegControl`) | FR-13. Pulls `lib/countyTextures` and `lib/countyCompleteness` |
| `components/ProjectsSection.tsx` | FR-41. It is a lazy chunk and imports recharts. The categorical tokens are **re-declared** in `namedBirdTimeline.ts`, never imported |
| `lib/transport.ts`, any `lib/tauri/*Service` | NFR-02 / QA-63 |
| `lib/statsFormat.ts` | §1.1 — the convergence runs the other way |
| `maplibre-gl`, `react-map-gl`, `components/SnowMap`, `components/SightingsMap` | The standing entry-chunk rule. `SightingsMap` stays `lazy()` inside `NamedBirdRow` exactly as shipped |

### 6.3 Does `entryChunk.test.ts` need a new assertion?

**Yes — one, and it must be paired.** QA-61 requires an assertion that no file
reachable from `App.tsx`'s static graph imports `recharts` or any charting
package, passing at HEAD and turning red when a `recharts` import is added to
`NamedBirds.tsx`. That file has an externals-based maplibre check
(`entryChunk.test.ts:238-241`) and **no recharts equivalent**, so the assertion
is genuinely new.

That file's own stated convention is that an unpaired negative passes vacuously.
So the new test carries three parts:

```ts
it('no chart library is reachable from App.tsx (NFR-01 / QA-61)', () => {
  expect([...externals].filter(s => s === 'recharts' || s.startsWith('recharts/'))).toEqual([])
  // Guards the guard, twice over:
  expect(has('components/NamedBirds.tsx')).toBe(true)          // the static tab really is on the graph
  const stats = closureFrom(resolve(SRC, 'components/BirdingStats.tsx'))
  expect([...stats.externals]).toContain('recharts')           // a real recharts edge exists to be found
})
```

Plus a subtree walk rooted at the feature's own modules, asserting the
forbidden edges of §6.2 are absent from them:

```ts
it('the timeline modules reach no chart library, no map, no transport and no SegControl', () => {
  for (const root of [
    'lib/namedBirdTimeline.ts', 'lib/namedBirdTimelineCopy.ts',
    'components/NamedBirdTimeline.tsx', 'components/NamedBirdMasterTimeline.tsx',
    'components/NamedBirdRangeControl.tsx',
  ]) { … }
})
```

**Root the NFR-02 / QA-63 walk at the modules this feature ADDS, not at
`NamedBirdsTable`.** `NamedBirdsTable` imports `useHotspotSet`, and
`NamedBirdRow` imports `NamedBirdMedia` / `ChecklistLink` / `HotspotLink`; those
chains legitimately reach network code that this feature neither adds nor uses.
QA-63 is worded correctly ("from every module this feature adds") and the
Engineer should follow it literally — a walk rooted at the table would report a
`transport` edge that has nothing to do with these timelines. Follow the
`exoticProvenanceGraph.test.ts` pattern (`closureFrom` is not exported from
`entryChunk.test.ts`).

### 6.4 Size posture

Two small lib modules, three small components, no new dependency (QA-62), no new
asset. The strips are hand-rolled positioned elements or inline SVG built from
tokens (NFR-01). At a named bird's volume a chart library buys nothing.

**If the Designer's form genuinely needs a library**, the answer is *not* a
static import: `NamedBirdTimeline` and `NamedBirdMasterTimeline` become
`lazy(() => import(...))` at their mount sites in `NamedBirdRow` /
`NamedBirdsTable`, and `lib/namedBirdTimeline.ts` moves with them (its only
entry-side consumer would be `rangeEnd` / `birdAxis` for the header figure,
which would then need to stay entry-side and be split out). That restructure is
real work; it is flagged in §9 rather than hidden.

---

## 7. Styling and layout contracts the architecture pins

Not the Designer's job to rediscover; these follow from the requirements and
this repo's recorded traps.

- **Every strip's own height is a px value, and every text-sized element sits
  outside it** (NFR-06). `.claude/rules/ui.md` records the Named Birds card map
  as the named example of exactly this trap on exactly this surface: a `rem`
  value inside a fixed-px box grows when the box does not, and at 200% in-app
  text scale it can double. Lane labels and endpoint labels are outside every
  fixed-px track.
- **No `min-width` outside a `.sr-scroll-x` container** (NFR-07, QA-59). If the
  master strip must ever exceed a phone viewport it scrolls inside `.sr-scroll-x`
  (`globals.css:1186`, which already carries `min-width: 0` and
  `position: relative`), never the page.
- **Axis is `width: 100%` of its container and sets no `min-width`** (FR-19).
- **Marks may overlap and coincide** — no collision avoidance, no minimum
  spacing, no jitter, no binning (FR-21). At 320px a full axis is under 300px, so
  overlap is the correct behaviour, not a defect.
- **Every colour is a `var(--sr-*)` token declared in both `:root` and
  `[data-theme="dark"]`** (FR-39, QA-52). The four categorical tokens and slate
  are confirmed present in both blocks: `--sr-graph-photo` (`globals.css:198`
  / `489`), `--sr-graph-audio` (199 / 490), `--sr-graph-video` (200 / 491),
  `--sr-chart-slate` (213 / 504), `--sr-accent` (30 / 347).
- **No per-component `prefers-reduced-motion` query.** The global block at
  `globals.css:3204-3212` collapses every animation and transition this feature
  could add (FR-43, QA-55).
- **No `aria-live`, no `role="status"`, no `role="alert"`** anywhere in this
  feature (FR-37, QA-51). The state change is the range switch and its own
  `aria-pressed` announces it; a live region over a caption or a legend
  announces reference material as an event. This is the shipped v1.0.5 rule in
  `.claude/rules/ui.md`, and the component must **say so in a comment** so a
  later reader does not restore one as an oversight.
- **New CSS class prefix: `.sr-nbt-*`**, declared in `globals.css` beside the
  other feature blocks, so the px-height and no-`min-width` assertions
  (QA-58, QA-59) have named selectors to parse.

---

## 8. What does NOT change — confirmed in writing

Every item below was checked against the code, not assumed.

| Seam / surface | Status |
|---|---|
| **`lib/storage.ts` (storage seam)** | **Untouched.** No `getSetting`, no `setSetting`, no `getApiKey`, no file read or write. FR-12 forbids it |
| **`localStorage` / `sessionStorage` / IndexedDB** | **Untouched.** Not read, not written (FR-12, QA-25) |
| **`lib/transport.ts` (transport seam)** | **Untouched.** No new path, no `CACHED_GET_PATHS` entry, no `EBIRD_GATED_PATHS` entry, no `getReplayable` call (NFR-02, QA-63) |
| **Backend routes / `frontend/vite.config.ts` proxy prefixes** | **Untouched.** No new route, so no new proxy prefix |
| **Durable caches** (`countyCompletenessCache`, `hotspotActivityCache`, `checklistProjectsCache`, `replayStore`, `observationsCache`, `mlExportCache`) | **Untouched.** No new store, no new entry, no TTL, no eviction policy |
| **`lib/clearDerived.ts` / `purgeDerivedOnClear`** | **No new row**, and this is a design boundary rather than an omission. That registry holds durable **documents** and `lib/cacheInventory.test.ts` pairs every row to an exported production purge ending in a `storage.deleteSetting`; a session-only React value has nothing to delete, so adding a row would turn that guard red for a store that does not exist. This is CLAUDE.md's own v1.0.20 statement of the boundary, applied (NFR-03) |
| **Epoch signals** (`lib/filesChanged.ts` / `useFilesEpoch`, `lib/keysChanged.ts` / `useKeysEpoch`) | **Untouched.** No stored document changes, so nothing to signal. `NamedBirds.tsx` keeps its existing `filesVersion` effect dependency exactly as shipped |
| **`TauriStorage` `docChains`, `AppLocalData/data/*`, `data/replay.json`** | **Untouched.** No file is created, read or written |
| **iCloud sync scope** | **Untouched.** Sync covers the two data files only; this feature adds no file and no settings key |
| **`PRIVACY_POLICY.md`** | **No change required** (FR-50). No network request, no provider, nothing written to disk. Record the decision rather than leaving it silent (QA-78) |
| **`frontend/package.json` dependencies** | **Byte-identical apart from the version field** (QA-62). No new npm dependency |
| **`lib/tabOrderCoverage.test.ts`** | **No roster row, no changed count** (FR-34, QA-49). The two range buttons are ordinary tab stops carrying a literal `tabIndex={0}` and join the counted population and pass; marks are non-interactive with no `<button>`, no `<a>`, no `tabIndex`, no handler |
| **`components/SightingsMap.tsx` / maplibre** | **Untouched.** Stays `lazy()` inside `NamedBirdRow`; no new maplibre edge |
| **`lib/namedBirds.ts` record shapes** | **Untouched.** `NamedBird` and `NamedSighting` gain no field. Named birds are not re-parsed, re-keyed, re-deduped or re-sorted |
| **`lib/statsFormat.ts` / Statistics' "Archive span"** | **Untouched** this run (PRD "Out of Scope"). FR-02 makes the later convergence a call-site change |

**Net: this feature writes nothing, fetches nothing, and persists nothing.**

---

## 9. Flags — especially what the Designer's choices could invalidate

**Would rewrite this document:**

1. **OQ-03 answered "per-card range state" instead of shared.** §2 is built
   entirely on one value per tab. Per-card state would move the range into
   `NamedBirdRow`, delete the shared-control requirement, invalidate QA-24, and
   make two cards on screen able to answer the same question differently — which
   is the ambiguity the feature exists to remove. The PRD's default is shared and
   this document takes it.
2. **The master timeline moved OUT of the card-list component** — into
   `NamedBirds.tsx`'s own chrome, above the header, or anywhere `NamedBirdsTable`
   does not render. That forces `sort` to lift to `NamedBirds.tsx` (§2.1),
   changing a component Species Detail also renders. The Designer may freely move
   the strip **within** `NamedBirdsTable`'s output (above the rows, below them,
   inside a section card) at no architectural cost.
3. **A chart library becomes genuinely necessary** (NFR-01's escape hatch). The
   three components and `lib/namedBirdTimeline.ts` must then move to the lazy
   side, with `rangeEnd` / `birdAxis` split out to stay entry-side for the header
   figure. Real restructuring work, not a swap.

**Absorbed without redesign:**

4. **OQ-05, a cap on lanes.** `buildLanes` takes the ordered array and returns
   lanes; a cap is a slice at the call site plus a caption change in the copy
   module and a `Show all N` expander following `NamedBirdLocations`.
5. **OQ-06, a monochrome master.** `LANE_COLORS` / `laneColor` become one token
   pair; QA-54's CVD validation falls away; FR-42 / QA-53's mark-versus-track
   contrast guard still applies.
6. **OQ-01, wording for a zero-day span**, and **OQ-02, how the card names the
   figure's endpoints.** Both are single entries in
   `lib/namedBirdTimelineCopy.ts`. The only requirement the architecture pins is
   that the zero-span string is not `1 day`.
7. **Where the range control sits inside the expanded panel** — above the report
   rows, below them, or beside `NamedBirdLocations`. Free.

**Designer-facing risk worth raising with the user:**

8. **A control inside one card changes another card's number.** FR-11 plus
   `singleOpen` means the control rendered inside an expanded card also moves the
   duration figure of every **collapsed** card and the master timeline's caption
   (QA-24 asserts exactly this). That is correct and intended, but a control
   sitting inside a card reads as card-local. FR-08's endpoint-naming text on
   every card is what makes it legible; the Designer should treat the placement
   and the wording as one decision, or consider hoisting the card-level control
   to the tab header.

**For The Tester:**

9. **QA-17's wording is vacuous for four of ten strings.** See §1.3 — measured,
   with the six reachable remainder-free strings and their unique day counts
   listed. Assert the uniqueness property, not the literal universal.
10. **QA-13's oracle sweep has been run in advance** and is clean over 124,553
    pairs, including the 1900 / 2000 century-rule cases. The implementation to
    match is days-from-civil integer arithmetic, not a `Date` difference.

**For The Engineer:**

11. `parseParts` accepts day 1 to 31 for every month, so `2026-02-30` parses and
    `elapsedDays` normalizes it. Pre-existing, bounded, **deliberately not fixed
    here** (§1.4) — tightening it would change `formatDate` and `formatDateRange`
    on five other surfaces.
12. `compareParts` (`formatDate.ts:232`) has no remaining caller once the borrow
    is deleted. Remove it with the borrow.
13. `formatSightingDuration` is called twice on adjacent lines in
    `NamedBirdRow.tsx:102-104`. Compute once into a local.
14. `isoDateFromMs` **must zero-pad** (§3). Every range comparison in this
    feature is a lexical string compare against eBird's own `YYYY-MM-DD`.
15. **Do not render `<BirdName>` inside the master timeline's inert wrapper**
    (§5.3). Plain text spans only.
