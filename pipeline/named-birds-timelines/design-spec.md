# Design Spec — Named Birds: honest durations and sighting timelines

**Feature:** named-birds-timelines
**Date:** 2026-09-06
**Stage:** 4 — The Designer (second pass — interactive marks)
**Source:** design-system.md, prd.md, schema.md, strategic-brief.md, `.claude/rules/ui.md`,
`lib/tabOrderCoverage.test.ts`, `components/SpeciesCombobox.tsx`, `components/TabNav.tsx`, `components/Settings.tsx`
**Mockup:** `pipeline/named-birds-timelines/design.html` (live: the range switch, the accordion,
the Sort control and both strips all work; every figure is produced by a working `elapsedDays` /
`formatElapsedSpan` rather than typed in)

> **Change of scope, user-directed.** Marks are now selectable and show a label. That single
> change ends the strip's life as decoration, so §"Accessibility, re-derived" replaces the
> previous pass's `aria-hidden` + `inert` story wholesale rather than amending it. **Everything
> approved in the first pass is unchanged**: the three-instance range switch,
> `50 days · first to last sighting` on every card, the monochrome master with its span line,
> `Same day`, and the timeline above the report rows. §"What this contradicts upstream" is the
> exact amendment list for the PRD.

---

## Visual Direction

Unchanged. Quiet utility, one accent, no new chrome. The timelines are built from a neutral rail
and an accent mark so the picture is legible with colour removed. The new interaction adds no
visual vocabulary: the selected mark grows and gains a halo, and one line of text under the axis
names it.

---

## Screens / Views

### 1. The tab control strip — where the range switch belongs

Unchanged from the approved pass. The Sort row is untouched; a second labelled row is added
beneath it, inside the same control block, above the card list:

```
Sort         [Name (Individual)] [Alphabetical] [Taxonomic] [Last Seen]   3 named birds
Measure to   [Last sighting] [Today]
```

This is the canonical instance of the range control and the primary answer to the tab-wide-scope
problem. Sort is already unambiguously tab-wide on this exact surface, and the duration figure
the switch governs is on every collapsed card at all times, so a control governing it has to be
reachable without expanding a card. Adding a third instance extends FR-11 (which requires one
shared value, not exactly two placements); every instance reads and writes the one `useState`.

### 2. The collapsed card header — the duration line

Unchanged from the approved pass.

```
›  Bridge-Ravens   Common Raven Corvus corax          May 21, 2026 – Jul 10, 2026   9 sightings
                                                      50 days · first to last sighting
```

The date-range line is byte-identical in both range states and keeps its `white-space: nowrap`.
The duration line becomes `{figure} · {endpoint phrase}` (600 / 400 weight, `0.6875rem`,
`--sr-text-muted`, right-aligned) and **loses its `nowrap`** so it can wrap.

### 3. The expanded panel

Unchanged in order. Two blocks at the top, before the report rows; everything below is shipped
and untouched.

```
┌ expanded panel (--sr-surface-faint) ─────────────────────────────────┐
│ Measure to  [Last sighting] [Today]                                  │  ← block A
│ Applies to every named bird on this tab.                             │
│                                                                      │
│ ▤ SIGHTINGS OVER TIME                                                │  ← block B
│ ▬▬▮▬▬▬▬▬▬▬▬▬▬▬▬▮▮▮▮▮▮▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▮▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │  ← the listbox
│ May 21, 2026                                          Jul 10, 2026   │  ← axis labels
│ Jun 15, 2026 · Pierce and Washington                                 │  ← readout, line 1
│ 8 of 9 dates                                                         │  ← readout, line 2
│                                                                      │
│ Jul 10, 2026 · Pierce and Washington · S370415516   (reports follow) │
└──────────────────────────────────────────────────────────────────────┘
```

Block A carries no section micro-label (it has a visible label of its own, and it governs the
header figure whether or not this bird has a strip). Block B is gated on
`bird.sightings.length >= 2`; a zero-day axis becomes a sentence inside the strip component.

### 4. The per-bird strip

```
.sr-nbt-track   role="listbox" tabIndex={0} aria-label aria-activedescendant
                height: 38px, padding: 0 2px   ← inset = half a mark width
  .sr-nbt-rail  position: relative, height: 100%
    ::before    full axis, 4px, radius 2, --sr-border-medium
    .sr-nbt-span  first→last sighting, 4px, radius 2, --sr-accent
    div[role=option].sr-nbt-tick  ×N   3px × 22px, radius 1.5, --sr-accent,
                                       pointer-events: none, NO tabIndex
      .is-on    5px × 28px + box-shadow 0 0 0 2px var(--sr-surface-faint)
.sr-nbt-ends    grid 1fr auto, 0.6875rem muted   ← sibling of the track
.sr-nbt-readout two lines, always rendered       ← sibling, aria-hidden
```

- One mark per **distinct** date. Marks overlap and coincide freely: no collision avoidance, no
  minimum spacing, no jitter, no binning.
- No gridlines, no tick labels, no axis subdivisions. A seven-year strip renders identically to
  a six-week one.
- Axis endpoint labels are a `1fr auto` grid, not flex `space-between`, so the right label stays
  right-aligned when it wraps at 200% text.
- **Zero-day axis:** no strip, **no listbox, no tab stop, no readout** — one sentence,
  `Every sighting on {date}.`, reusing the shipped `Every sighting at {place}.` idiom. With the
  range on `today` the same bird has a real axis and becomes selectable.

### 5. The master strip — "All named birds over time"

Rendered after the rows, inside `NamedBirdsTable`, in a container with the same chrome as a named
bird card (`--sr-surface`, 1px `--sr-border`, radius 10, `--sr-card-shadow`). A sibling of the
cards, never nested.

```
▤ ALL NAMED BIRDS OVER TIME                                    ← micro-label
3 named birds, from Jul 16, 2025 to Jul 10, 2026.              ← FR-38 sentence, outside the listbox
Measure to  [Last sighting] [Today]                            ← outside the listbox

┌ role="listbox" tabIndex={0} ──────────────────────────────────────────┐
│ 3 NAMED BIRDS · FIRST TO LAST SIGHTING            (aria-hidden)       │
│ ┌ role="group" aria-label="Bridge-Ravens, Common Raven" ────────────┐ │
│ │ Bridge-Ravens      ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮  │ │
│ │   Common Raven      (label aria-hidden; the group name carries it) │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ … one group per bird …                                                 │
│                    Jul 16, 2025                      Jul 10, 2026      │  (aria-hidden)
└────────────────────────────────────────────────────────────────────────┘
Bridge-Ravens · Jun 15, 2026 · Pierce and Washington            ← readout, line 1
8 of 9 dates                                                    ← readout, line 2
```

- Lane grid `minmax(0, 34%) minmax(0, 1fr)`, gap `0.5rem 0.75rem`.
- Lane track height **24px** desktop, **30px** at ≤640. Rail 3px, span 3px, marks 3px × 12px,
  active mark 3px × 18px with a `--sr-surface-subtle` halo.
- **Zebra banding is gone.** The token now does a better job: the lane the arrow keys are in
  takes `--sr-surface-subtle`, which says *where you are* — something a stripe cannot — and it
  keeps the halo token single-valued.
- Lane label `0.6875rem`, `overflow-wrap: anywhere`, no `nowrap`, name then muted species. It is
  `aria-hidden`, because the lane group's `aria-label` carries the same words.
- Every named bird gets a lane. No cap, no truncation.
- Lane order equals card order under whichever Sort is selected.
- The caption and the axis end dates sit inside the listbox and are `aria-hidden`; the FR-38
  sentence above carries the same facts to the accessibility tree.

### 6. Phone tier (≤640px)

- The lane grid collapses to one column: label above its own full-width track. This is what makes
  the 120-character bound safe and removes any need for a `min-width`.
- Lane track grows 24px → 30px, so the target clears 24px on touch.
- The master's endpoint-date row loses its empty label cell.
- Range pills take `.sr-touch-target` and the shared `max(16px, 0.75rem)` size.
- Nothing in this feature sets a positive `min-width`, so nothing can force page scroll.

---

## Accessibility, re-derived

> The previous pass built on `ProjectsSection.tsx:92-112` — an `aria-hidden` + `inert` wrapper
> whose accessible equivalent is adjacent text. **That contract cannot survive a selectable
> mark**, and there is no partial version of it available: a control that answers a pointer but
> is invisible to AT and unreachable by keyboard fails WCAG 2.1.1 outright. So the whole story
> is re-derived below.

### The strip's role

Each strip is a **`role="listbox"`** whose options are the marks. It is a real widget with a
name, keyboard operation and a focus indicator. Neither strip is `inert`; neither is
`aria-hidden`.

- Per-bird listbox name: `Sightings of {name} over time`
- Master listbox name: `Sightings of every named bird over time`
- Master lane group name: `{name}, {species}` (or `{name}` when `showSpecies` is false)

### Each mark's accessible name

The mark's name is **the whole payload**, so a screen-reader user never needs the visible
readout:

- Per-bird: `Jun 15, 2026, Pierce and Washington`
- Master: `Bridge-Ravens, Jun 15, 2026, Pierce and Washington`
- Two checklists on one date: `Jun 12, 2026, Buchanan Curl and Pierce and Washington`

Position in the set comes from `aria-posinset` / `aria-setsize`, **never from words in the
name** — the name must not say "2 of 7" and then have the screen reader say it again.

### What happens to "the report rows are the alternative"

**Reframed, not deleted, and the duplication is accepted deliberately.**

The card's strip lists dates and places that the report rows twelve pixels below also list — with
the checklist link and the species comment the strip does not carry. So the strip is a strict
subset of the rows: a fast overview first, the full record second, which is exactly the reading
order the approved layout already produces. **The report rows do not change** (QA-77 stays true
byte for byte); only the claim about what they are equivalent *to* is reworded. Suppressing the
strip for screen readers to avoid the duplication is the option WCAG removes.

For the master strip the equivalent argument holds one level up: the strip is the overview, the
card list below it is the record, and opening a bird's card is how you act on what you found.

### No live region, still

The readout is `aria-hidden="true"`. The focused option announces the same words, so a live
region would double-speak on every arrow press. **FR-37 survives intact**, now for two reasons
instead of one. State it in the component so a later reader does not restore one.

---

## Interaction Notes

### The scope problem, and the four things that solve it

Unchanged from the approved pass. One value governs the whole tab, so pressing the control inside
an open card also moves every collapsed card's figure and the master caption. Placement and
wording are one decision:

1. The canonical control is in the tab control strip, under Sort. Scope is read from the company
   a control keeps.
2. Every card names its endpoints in words, so a press changes the suffix on every visible card
   in the same commit.
3. The three instances are visibly one control.
4. Only the ambiguous instance — the one inside a card — carries
   `Applies to every named bird on this tab.` The explanation goes where the ambiguity is.

### Tab stops: exactly two, and the count is invariant

**The Named Birds tab gains exactly two tab stops from this change**: one for the open card's
strip (at most one card is open — `singleOpen`), and one for the master strip. That number does
not move with the number of birds or the number of sightings. Verified in the mockup: the desktop
frame reports `div[role=listbox][tabindex="0"] × 2` and `[role=option][tabindex] × 0`.

**Why `aria-activedescendant` and not roving tabindex.** The repo ships both patterns and its own
roster docstring distinguishes them:

| Pattern | Shipped at | Shape |
|---|---|---|
| Roving tabindex | `TabNav.tsx` vertical tablist; `Settings.tsx` RadioGroups | Container holds one stop; `tabIndex={active ? 0 : -1}` on **every** member; arrows move **focus** |
| `aria-activedescendant` listbox | `SpeciesCombobox.tsx` | **One** focusable owns a long, data-scaled option list; arrows move an **index**; options carry no `tabIndex` |

I took the second, and **population size is the reason**. At the fixture NFR-04 already names —
200 birds averaging 100 sightings — roving tabindex would put a `tabIndex` attribute and a focus
handler on up to 20,000 elements; if those were `<button>`s they would all join
`tabOrderCoverage.test.ts`'s counted population under one blanket roster row, which is exactly
the pardon that roster's docstring warns against. With activedescendant the marks are
`<div role="option">` with no `tabIndex`, no focus handler and no click handler, so they are
**outside that guard's population by element type** — the same reason the roster gives for
leaving `SnowMap.tsx`'s Trails `<input>` out. **`EXCLUSIONS` therefore gains no row, and QA-49
stays green** and becomes a stronger claim: it turns red if anyone later makes a mark a
`<button>`.

### The whole track is the control

Marks keep `pointer-events: none` and stay purely visual. The **track** takes the press, and a
press selects the **nearest sighting by horizontal position**. That partitions the entire width:
every sighting owns a slice, no slice is zero, and **overlap becomes irrelevant to hit testing**.

This is the answer to the hit-target problem, and the problem is not hypothetical:
Bridge-Ravens has six dates inside eight days, which at 320px is six marks inside about six
pixels. A 3px mark is not a target and cannot be made one without spacing, jitter or binning,
all of which are forbidden and would falsify the picture.

Target sizes: **38px** tall in a card, **24px** per lane on the master (**30px** at ≤640), each
the full width of its container. The 24px minimum is cleared in every tier.

**The honest residual limit, stated rather than hidden:** where several sightings sit within a
few pixels, a finger cannot land on each one individually. Three mitigations, none of them a new
control: the arrow keys reach every mark; the readout's second line says `4 of 9 dates` so
neighbours are visible rather than hidden; and the card's strip sits directly above the complete
dated report list, which is why that ordering was chosen. If Previous / Next buttons beside the
readout are wanted, that is the fix and it costs four more permanent tab stops.

### The label: a fixed readout, never a popover

A popover anchored to a 3px mark at 320px has nowhere to go: it overflows the card, it needs
collision logic, and on a dense cluster it covers the marks it describes. The readout instead
sits in one fixed place, under the axis labels, in normal flow, and wraps.

- **Always rendered, never unmounted**, so nothing shifts when it fills — the shipped `SyncLine`
  rule. Because it is text it lives **outside** every fixed-px box.
- **Line 1** is the identity: date and place in a card; the bird's name in front on the master.
- **Line 2** is the muted position, `4 of 9 dates`. Saying *dates* rather than *sightings* is
  load-bearing: it is what explains how a card reading `8 sightings` has 7 marks.
- **At rest**, line 1 is `Select a sighting to see its date and place.` — the only thing on the
  surface that announces the new affordance. Line 2 is empty.
- **It is never a link.** The app opens external links only through the shared link components,
  and a readout that became a checklist link would be a control appearing and disappearing under
  the user's finger. The checklist stays on the report row, where it already is.

### Pointer, touch, keyboard

| Input | Behaviour |
|---|---|
| Mouse hover | Previews the nearest sighting in the readout **without committing**. Scrubbing a cluster reads it with no clicks. `aria-activedescendant` does **not** follow a hover — a preview must not move the screen reader's cursor. |
| Mouse drag | Held press scrubs and commits continuously. |
| Press (mouse or touch) | Commits, and moves DOM focus to the track so the arrows carry on from there. There is no hover on iOS, which is exactly why commit is on press. |
| `ArrowLeft` / `ArrowRight` | Previous / next sighting for the current bird. Clamps at the ends, does not wrap. |
| `Home` / `End` | First / last sighting of the current bird. |
| `ArrowUp` / `ArrowDown` | Master only: previous / next bird, landing on the sighting nearest in date to the current one. The lane you land in takes `--sr-surface-subtle`. |
| `Escape` | Clears the selection, keeps focus. **Consumed only while something is selected**, so with nothing selected it still reaches an outer Escape layer — the shipped `SpeciesCombobox` rule. |
| Blur / Tab away | Clears the selection and the readout returns to its resting line. |
| `Enter` / `Space` | Deliberately unbound. There is nothing to activate; selection is the whole interaction. |
| Range flip, Sort change | The selection **survives**: it is keyed to a bird plus a date, not to a position. Only the axis moves under it. |
| Collapsing the card | Unmounts the strip and its selection with it. |

### Focus indicator

The track is the focusable, so the global `:focus-visible` ring paints on a full-width element
with a 6px radius. The selected mark's own state is carried by **two non-colour cues**: it grows
(3 → 5px wide, 22 → 28px tall in a card; 12 → 18px tall on a lane) and gains a 2px halo in the
host surface token, which punches a visible gap around it inside a cluster.

---

## Component Usage

| Element | Component / pattern |
|---|---|
| Range control | **New** `NamedBirdRangeControl` — the shipped Named Birds pill pattern verbatim: self-bordered `<button>`s in `.sr-wrap-flex`, `.sr-touch-target`, `aria-pressed`, literal `tabIndex={0}`, `role="group"` with `aria-label`. **Never** `SegControl` from `map/MapSidebarUI.tsx` |
| Selectable strip | **New** shared `NamedBirdTickList` — one `role="listbox"` + `role="option"` divs + `aria-activedescendant`, following `SpeciesCombobox.tsx`. Used by both strips so there is one hit-test, one key handler and one readout contract |
| Readout | Shipped `SyncLine` shape: rendered from the start, children replaced on change, never unmounted or `display: none`. **Not** its `role="status"` — this one is `aria-hidden` |
| Section heading in a card | Shipped uppercase micro-label idiom (`0.6875rem` / 700 / `0.04em` / uppercase / muted, 12px Lucide glyph) |
| Master container | Card chrome hand-rolled inline, matching `NamedBirdRow`. **Not** an import of either `SectionCard` — both live on lazy chunks and `NamedBirds` is a static import in `App.tsx` |
| Zero-span sentence | Shipped one-item rule from `NamedBirdLocations` |
| Icons | Lucide `ChartNoAxesGantt`, 12px in a card and 13px on the master, stroke 2.2. The only new glyph |
| Marks, rails, spans | Positioned `<div>`s built from tokens. No SVG needed at this element count, and no chart library anywhere in the graph |

---

## Design Tokens Applied

No new token is minted. Every value exists in both `:root` and `[data-theme="dark"]`.

| Role | Token | Light | Dark |
|---|---|---|---|
| Mark and span line | `--sr-accent` | `#277448` | `#34D399` |
| Rail (full shared axis) | `--sr-border-medium` | `#C4C4CE` | `#3F3F46` |
| Active mark halo (card) | `--sr-surface-faint` | `#FAFAFA` | `#1C1C1F` |
| Active mark halo + active lane (master) | `--sr-surface-subtle` | `#F4F4F5` | `#27272A` |
| Readout line 1 | `--sr-text` (`--sr-text-muted` at rest) | — | — |
| Readout line 2, axis labels, caption, scope note | `--sr-text-muted` | `#6B6B74` | `#A1A1AA` |
| Focus ring | `--sr-accent` (global `:focus-visible`) | — | — |

### Measured contrast (FR-42 / QA-53)

The guarded pair is **mark vs rail**, because a mark sits on the rail wherever a bird has a span.
Computed with WCAG luminance math from the real token values:

| Pair | Light | Dark | Floor |
|---|---|---|---|
| `--sr-accent` on `--sr-border-medium` | **3.28:1** | **5.38:1** | 3:1 ✓ |
| `--sr-accent` on `--sr-surface-faint` (card panel) | 5.47:1 | 8.94:1 | 3:1 ✓ |
| `--sr-accent` on `--sr-surface` (master card) | 5.46:1 | 9.01:1 | 3:1 ✓ |
| `--sr-accent` on `--sr-surface-subtle` (active lane) | 5.19:1 | 8.11:1 | 3:1 ✓ |
| `--sr-border-medium` on `--sr-surface-faint` | 1.67:1 | 1.66:1 | n/a — hairline guide |

The rail's ~1.66:1 in both themes is deliberate and matches the blessed `--sr-sticky-shadow`
register: it is a guide, not a state carrier, and a 3:1 rule there would read as a divider. The
3.28:1 light figure is the tight one and is exactly what the guard protects.

**No categorical token is used**, so `--sr-graph-photo`, `--sr-graph-audio`, `--sr-graph-video`
and `--sr-chart-slate` appear nowhere in this feature and QA-54's CVD validation falls away.

---

## Motion Spec

- **Range pill, selected state**: `background` and `color`, 120ms,
  `cubic-bezier(0.16, 1, 0.3, 1)` (house ease-out), no transform, no origin. Reduced motion:
  collapsed by the global block. Library: **CSS**. Matches the shipped `.sr-toggle` convention.
- **Selection**: **no animation.** The mark's size change and the halo appear instantly. A
  transition here would lag the pointer during a scrub, which is the opposite of responsive.
- **Marks, rails, span lines, lanes, captions, readout**: **no animation and no transition.**
  A range flip is a data change, not an entrance, and transitioning `left` on up to a few hundred
  absolutely positioned elements is a layout-thrashing property on exactly the phones and the Pi
  this app must stay smooth on.
- **No per-component `prefers-reduced-motion` query.** The single global block at
  `globals.css:3204-3212` covers every declaration this feature adds.

---

## Content Notes

Every user-facing string lives in one copy module (`lib/namedBirdTimelineCopy.ts`), including the
count-bearing ones, so they ride the generated-corpus copy sweep and the em-dash sweep. No
count-bearing string is built inline in a component. No em dashes anywhere.

| Key | String |
|---|---|
| `rangeLabel` | `Measure to` |
| `optLastSighting` / `optToday` | `Last sighting` / `Today` |
| `scopeNote` | `Applies to every named bird on this tab.` |
| `endpoints('last-sighting')` / `('today')` | `first to last sighting` / `first sighting to today` |
| `perBirdHead` / `masterHead` | `Sightings over time` / `All named birds over time` |
| `oneDate(d)` | `Every sighting on {date}.` |
| `birdCount(n)` | `1 named bird` / `N named birds` |
| `masterSentence(n, axis, 'last-sighting')` | `{birdCount}, from {start} to {end}.` |
| `masterSentence(n, axis, 'today')` | `{birdCount}, from {start} to today, {end}.` |
| `masterCaption(n, range)` | `{birdCount} · {endpoints(range)}` (uppercased by CSS) |
| `formatElapsedSpan(0)` | `Same day` |
| `lbPerBird(name)` | `Sightings of {name} over time` |
| `lbMaster` | `Sightings of every named bird over time` |
| `laneGroup(name, species)` | `{name}, {species}` (or `{name}`) |
| `restPerBird` | `Select a sighting to see its date and place.` |
| `restMaster` | `Select a sighting to see its bird, date and place.` |
| `places(list)` | `{a}` / `{a} and {b}` / `{a} and {n-1} more places` |
| `readLine1(bird, date, places)` | `{bird} · {date} · {places}` (each segment omitted when absent) |
| `readLine2(i, n)` | `{i} of {n} dates` (`1 date` at n = 1) |
| `optionName(bird, date, places)` | Comma-punctuated form of line 1, because it is spoken |

`places()` is the one new count-bearing helper and needs the copy-guard treatment in full: state
its property over the whole input domain, not at two sample values, and add a hypothetical extra
row when proving extensibility.

Tone: the app's own. The surface is **Named Birds** (`TAB_LABELS` is authoritative); nothing in
the copy names a component or a file, and "master timeline" is an internal name that never
reaches the screen — the visible heading is `All named birds over time`.

---

## Positions on the open questions

### OQ-02 / FR-08 — how the card names the figure's endpoints
**Taken: a short endpoint phrase after the number, on every card.** `50 days · first to last
sighting` / `3 mos. 17 days · first sighting to today`. Both name both ends. It answers "which
two dates" for a reader who never touches the control, and it is what makes the tab-wide switch
legible, because it changes on every visible card at once. **Cost:** the duration line now wraps,
so at 200% text on a phone it can take two lines in a header that already reflows.

### OQ-06 / FR-41 — colour on the master strip
**Taken: monochrome**, on two measured grounds. Four distinguishable colours plus slate means
three named birds get colour and twenty get four colours and sixteen slate lanes, implying a
grouping that does not exist. And `--sr-graph-photo` / `-audio` / `-video` mean photo, audio and
video in this app, on a tab where every expanded card carries a media section — the design
system's own rule for a new map colour applies unchanged: check it is free on every surface it
will appear on. It is not. Colour is replaced by a **span line** per lane, first sighting to
last; on `Today` the line stops where the bird stopped and the grey rail runs on to the right
edge. QA-54 falls away.

### OQ-01 — the zero-day string
**Taken: `Same day` stands.** Two words, true, and it reads as an answer rather than a
measurement. In context it lands as `Same day · first to last sighting`.

### OQ-05 / OQ-03 / OQ-07
Defaults kept: uncapped lanes, one shared range value, master inside `NamedBirdsTable`.

---

## What this contradicts upstream

The PRD lists interactive marks under Out of Scope and carries verification rows asserting
non-interactivity. This is the exact amendment list.

### Functional requirements

| Ref | Says | Now |
|---|---|---|
| **FR-33** | Every plot area is wrapped in an element carrying both `aria-hidden="true"` and `inert`; the chart caption sits inside that wrapper | **Struck.** Neither strip is inert or `aria-hidden`. The master's caption stays visible and takes `aria-hidden` on its own, because the FR-38 sentence above carries the same facts |
| **FR-34** | Marks are non-interactive: no `<button>`, no `<a>`, no `tabIndex`, no click, hover or focus handler. The roster and counted population in `tabOrderCoverage.test.ts` are unchanged except for the range control's buttons | **Partly struck.** Marks are `<div role="option">`; they still carry no `tabIndex`, no anchor and no per-mark handler — the track holds the one `tabIndex={0}` and every handler. **The roster and counted population clause survives unchanged** and should be kept |
| **FR-35** | The accessible equivalent of the per-bird timeline is the card's own report rows; no new text is required there | **Reframed.** The strip is no longer a decoration needing an alternative; it is a second, interactive view. The rows are byte-identical and remain the full record (they alone carry the checklist link and the comment) |
| **FR-36** | The accessible equivalent of the master is the card list plus the endpoint sentence; no per-lane text alternative inside the inert wrapper | **Reframed.** There is no inert wrapper. Each lane is a `role="group"` named by the bird — a per-lane accessible name arriving by role rather than by added text |
| **FR-37** | No `aria-live` anywhere | **Survives unchanged**, now for two reasons: the focused option announces itself, so a live region would double-speak |
| **FR-38** | A sentence outside the inert wrapper naming the bird count and both endpoint dates, updating with the range | **Survives**, same place, same words. Reword "outside the inert wrapper" to "outside the listbox" |
| **FR-21** | Marks may overlap and coincide; no collision avoidance, spacing, jitter or binning; each mark carries a small fixed pixel width | **Survives unchanged**, and is precisely why the track rather than the mark is the target |
| **FR-39 / FR-40 / FR-41 / FR-42 / FR-43** | Tokens, monochrome per-bird strip, categorical order, contrast guard, no per-mark entrance animation | **All survive.** FR-41 is answered "monochrome" (OQ-06), so its categorical clause is unused |
| **NFR-04** | Building the master mark set for 200 birds × 100 sightings under 50 ms | **Unchanged as written.** Flag: each mark now also carries an `id` and three ARIA attributes. That is DOM weight, not compute, and deserves a second measurement at the same fixture |
| **Out of Scope** | "Interactive marks. No press-to-open-a-checklist, no hover tooltips, no brushing, no zooming, no filtering" | **Partly struck.** Selection and a fixed readout are in. Press-to-open-a-checklist, floating tooltips, brushing, zooming and filtering all stay out, and the readout is deliberately never a link |

### Verification rows

| Ref | Says | Now |
|---|---|---|
| **QA-34** | Zero-span bird renders a sentence and no strip | **Survives**, and gains a clause: it also renders no listbox and no tab stop |
| **QA-37** | The inert plot wrapper contains no text node; every label is a sibling in normal flow | **Struck as written.** Replacement worth keeping: the plot area contains no rendered text, and both axis labels and the readout are siblings of the track in normal flow |
| **QA-47** | Every plot wrapper carries the literal `aria-hidden="true"` and `inert` attributes | **Struck.** Replace with: every plot wrapper carries `role="listbox"`, an `aria-label`, a literal `tabIndex={0}`, and an `aria-activedescendant` matching a rendered option id whenever one is committed (and absent otherwise, and never following a hover preview) |
| **QA-48** | A tab-order enumeration finds no focusable element inside either plot wrapper | **Struck.** Replace with a **count invariance** assertion: the Named Birds tab gains exactly two tab stops, and the count is identical for a fixture of 2 birds and a fixture of 40 |
| **QA-49** | The exclusion roster is unchanged, no new row, no changed count | **Survives, and is now a stronger claim worth keeping.** It holds because marks are divs; it turns red if anyone later makes a mark a `<button>`, which is the right alarm |
| **QA-51** | No `aria-live`, `role="status"` or `role="alert"` in the feature's files | **Survives unchanged** |
| **QA-60** | Both range buttons meet the ~44px minimum via `.sr-touch-target` | **Extend**, not replace: add the tracks — 38px in a card, 24px per lane and 30px at ≤640, each full container width |
| **QA-77** | The card rows remain the accessible equivalent, unchanged from HEAD | **Survives.** The rows are byte-identical; only the claim about what they are equivalent to is reworded |
| **New rows needed** | — | (a) each mark's accessible name is its full payload and contains no position words; (b) `aria-posinset` / `aria-setsize` are present and correct on every mark; (c) Escape is consumed only while a selection exists and bubbles otherwise; (d) a selection survives a range flip and a Sort change because it is keyed by bird and date; (e) the readout is `aria-hidden` and is rendered from first paint, never unmounted; (f) a pointer press anywhere on a track selects the nearest sighting, asserted at both extreme ends and inside a dense cluster |

### Published statements

| File | Now |
|---|---|
| **ACCESSIBILITY.md** | **Needs a change** (FR-50 expected it might not). Keyboard Navigation gains the two new listboxes beside the two roving groups it already publishes, and must say they are `aria-activedescendant` rather than roving — the `EXCLUSIONS` docstring explicitly checks its prose against the roster and calls a summary that conflates the two "false twice over" |
| **docs/HELP.md** (FR-44) | Add: marks are selectable, what the line beneath the strip says, and that the arrow keys step through sightings |
| **README.md** (FR-46), **website/index.html** (FR-47) | The published claim now includes selectable marks; sweep at paragraph scope and diff the three files against each other |
| **PRIVACY_POLICY.md** (FR-50) | **Still no change.** No network request, no provider, nothing written to disk. Selection is session-only React state |

---

## Flags for the Architect and the Tester

1. **Two new tab stops, and the count is the assertion.** Not "no new focusables" — the count,
   proved invariant between a 2-bird and a 40-bird fixture.
2. **`EXCLUSIONS` in `tabOrderCoverage.test.ts` gains no row**, because marks are
   `<div role="option">` with no `tabIndex` and the track is a `<div role="listbox">`. Both are
   outside that guard's population by element type, the same reason the roster gives for
   SnowMap's Trails `<input>`. If a later change makes a mark a `<button>`, the guard should and
   will go red.
3. **One shared tick-list component** (`NamedBirdTickList`) for both strips, so hit testing, key
   handling, the readout contract and the ARIA wiring exist once. The master differs only by
   having `role="group"` lanes and the Up/Down key map.
4. **`aria-activedescendant` follows the committed selection only**, never a mouse-hover preview.
   A preview that moved a screen reader's cursor would announce things the user is not pointing
   at, and on touch the distinction does not exist at all.
5. **The span line and the mouse-hover preview are Designer additions** no requirement asked for.
   The span line costs one `min` and one `max` over positions already computed. The preview is
   desktop-only by construction. Either can be cut with nothing else changing.
6. **The duration line loses `white-space: nowrap`.** The one shipped declaration this feature
   changes on the collapsed header; the date-range line above keeps its `nowrap`.
7. **Geometry, in px, for QA-58:** per-bird track **38px**; master lane track **24px** desktop,
   **30px** at ≤640; mark 3px wide, rail inset 2px each side (half a mark, so a mark at 0% and at
   100% sits fully inside the track rather than clipping); active mark 5 × 28px in a card and
   3 × 18px on a lane, plus a 2px halo. No positive `min-width` anywhere in the feature.
8. **New CSS class prefix `.sr-nbt-*`** in `globals.css` beside the other feature blocks, so
   QA-58 and QA-59 have named selectors to parse.
9. **Every figure in `design.html` is computed, not typed.** The mockup implements `elapsedDays`
   and `formatElapsedSpan` to the FR-03 band table and was checked against QA-01 to QA-12 and
   QA-21: all thirteen return the exact specified strings. It also implements the hit test, the
   key map and the readout, so the Engineer can diff behaviour against it rather than prose.
