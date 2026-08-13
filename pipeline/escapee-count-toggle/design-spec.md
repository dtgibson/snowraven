# Design Spec — Escapee Count Toggle

**Feature:** escapee-count-toggle
**Stage:** 4 — The Designer
**Approved:** 2026-08-12 ("looks great", no change requests)
**Mockup:** `pipeline/escapee-count-toggle/design.html` (approved as built)

This spec is written so the Engineer can build without opening the mockup.
Every copy string below is the shipped string, verbatim. Open `design.html`
for the live feel of the pass and the state stepper.

---

## Visual Direction

Quiet utility, extending the shipped Statistics tab rather than decorating it.
The feature adds one checkbox and one explanatory region, mints no token, paints
nothing new, and introduces no card of its own. The register is the app's
existing one: hairline borders, a single restrained accent, flat surfaces, and
copy that states a rule plainly instead of reassuring the reader about it.

The organising idea is that **the control lives with its sibling and the account
lives with the number**. The toggle sits in the page header beside "Count spuh,
slash & hybrids" because that is where count rules already live. Everything that
explains what the number is doing sits directly under the number in Life List
Totals, because a headline figure that drops by three has to answer for itself in
the place the reader is looking.

---

## Screens / Views

### View 1 — Statistics page header (existing, extended)

Layout is unchanged: a left block (h2 "Statistics" + the muted checklist/backup
line) and a right block, `flex-wrap: wrap`, `align-items: flex-start`.

The right block becomes a **vertical stack of two checkbox rows**, left-aligned
within the block:

```
[ ] Count spuh, slash & hybrids     (existing, unchanged)
[ ] Count escapees                  (new)
```

Design decisions for this view:

- The new control is a **plain checkbox identical to its neighbour**: 14px box,
  `accent-color: var(--sr-accent)`, label at `0.8125rem`, whole label clickable,
  `user-select: none`. Not a `ToggleSwitch`. FR-27 asks for matching treatment
  and the neighbour is a checkbox.
- **Stacked, not side by side.** Two "Count …" labels in a row read as two
  unrelated controls and wrap badly at any narrow width; stacked they read as one
  count rule with two clauses.
- Default **unchecked**, meaning escapees are excluded (FR-27).
- Hover tints the label `var(--sr-accent)`; no other state change.
- The label carries **no explanatory sub-line here**. The explanation is a full
  sentence and belongs in the rule line under the number, where it has room to be
  precise. Keeping the header at two clean parallel labels is deliberate.

### View 2 — Life List Totals card (existing, extended)

The stat grid is unchanged. Below it, a `Divider`, then the new **count-rule
account** region, then the existing `Divider` and the first/most-recent tiles.

The account region is **not a card**. It is a `Divider` followed by plain rows on
the card background, the same way the card already separates its own regions. A
bordered inset here would be a card inside a card.

Structure, top to bottom:

```
─────────────────────────────────────────────────────────────  (Divider)

[icon]  <status sentence>                            [ Check again ]   ← row 1
        [███████░░░░░░░░░░]  24 / 73   [ ■ Stop ]                      ← row 1b
        <standing rule sentence, muted, 2 lines>                       ← row 2
        ▾ Show the 3 escapees                                          ← row 3
          <lead sentence, muted>
          Graylag Goose  ▫▫            Exotic: Escapee · 2 checklists checked
          Swan Goose     ▫▫            Exotic: Escapee · 1 checklist checked
          Muscovy Duck   ▫▫            Exotic: Escapee · 3 checklists checked

─────────────────────────────────────────────────────────────  (Divider)
```

- **Row 1** is a wrapping flex row: the live status (`flex: 1 1 20rem;
  min-width: 0`) and its trailing action (`flex-shrink: 0`). Wrapping rather than
  shrinking, so the action keeps its touch target on a phone.
- **Row 1b** (progress) appears only while a pass is running. Capped at
  `max-width: 26rem` — 73 checklists is a small, short job and a card-width bar
  overstates it.
- **Row 2** (standing rule) is always present, `0.6875rem`,
  `var(--sr-text-muted)`, `max-width: 62ch`.
- **Row 3** (disclosure) appears only when at least one species has been found.
- The excluded list is capped at `max-width: 34rem` so a name and its evidence
  stay visually paired instead of sitting at opposite ends of a 900px card.

### The Species figure

- While a pass is running, the Species value renders in `var(--sr-text-muted)`
  instead of `var(--sr-text)`. A settling number must not read as a final one.
  This is a supporting cue only: the status line states the same thing in words,
  so it is **never colour alone** (WCAG 1.4.1).
- Full ink in every other state, including `partial` and `not-checked` — those
  figures are stable and honest, they are simply not final, and the status line
  says so.
- **No sub-line is added to the Species `StatCell`.** Adding one would force
  `reserveSub` on all six tiles to keep the grid even, permanently adding a blank
  line to five tiles to serve a ten-second state.

### View 3 — Other surfaces (secondary)

Every surface whose count reflects the exclusion carries one shared sentence
(see Content Notes). No other change to those surfaces.

---

## The seven states

Icons are Lucide at 14px, `stroke-width: 2.2`. "Number" is what the Species
figure shows on the reference export with the toggle off.

| # | State | Icon / tone | Number | Progress | Action | Disclosure |
|---|---|---|---|---|---|---|
| 1 | `not-checked` | `circle` dashed, muted | 267 | no | none | no |
| 2 | `in-progress` | `loader-2` spinning, accent | converging, muted | **yes** | **Stop** | yes, "found so far" |
| 3 | `complete` | `check`, accent | 264 | no | none | yes |
| 4a | `partial` / `cancelled` | `alert-circle`, warning | 266 | no | **Check again** | yes |
| 4b | `partial` / `failures` | `alert-circle`, warning | 265 | no | **Check again** | yes |
| 4c | `partial` / `pass-budget` | `alert-circle`, warning | 265 | no | **Check again** | yes |
| 4d | `partial` / `species-budget` | `alert-circle`, warning | 265 | no | **Check again** | yes |
| 5 | `no-key` | `key-round`, muted | 267 | no | Settings link | no |
| 6 | `offline` | `wifi-off`, muted | 264 (cached) | no | none | yes (cached) |
| 7 | `error` | `alert-circle`, **error** | 267 | no | **Try again** | no |

### Approved deviation from FR-31

> **FR-31 states that only the error state offers a retry. This design gives the
> four `partial` states a "Check again" control as well. The deviation was
> raised at the design gate and approved by the user on 2026-08-12.**
>
> Reason: a birder who presses **Stop** otherwise has no route back. The tab
> stays mounted once opened, so `partial (cancelled)` would persist for the rest
> of the session with no way to resume, which is a dead end rather than a
> conservative default.
>
> **Engineer:** implement "Check again" on all four partial reasons.
> **Tester:** this is intended behaviour, not a defect against FR-31. QA-36's
> "only error offers retry" assertion must be updated to "error offers Try
> again; the four partial reasons offer Check again; not-checked, in-progress,
> complete, no-key and offline offer neither."

`not-checked`, `complete` and `offline` still offer no control, and `no-key`
offers navigation to Settings rather than a retry, which is the app's existing
`onGoToSettings` affordance and not a retry in the FR-31 sense.

---

## Component Usage

| Element | Component / pattern |
|---|---|
| Both count-rule checkboxes | Native `<input type="checkbox">`, `accent-color: var(--sr-accent)`, wrapped in a clickable `<label>`. Matches the shipped include-spuh control exactly. Not `ToggleSwitch`. |
| Card, head, dividers | Existing `SectionCard` / `Divider` from `statsPrimitives.tsx`, unchanged |
| Species figure | Existing `StatCell`, unchanged API; only its value colour varies |
| Excluded species names | **`<BirdName>`** with `commonName`, `taxonCode`, `hasEntry`, `onOpenSpecies={navigateToSpeciesDetail}`, `size="sm"`. These species remain on the Life List, so `hasEntry` is true and the name links to Species Detail. The mockup draws two grey squares as stand-ins for BirdName's own eBird/Macaulay favicons. |
| Disclosure expander | The shipped "Show all N counties" idiom: text button, `background: none`, `border: none`, `0.75rem`, `var(--sr-accent)`, `ChevronDown` / `ChevronUp` at 12px, `padding: 8px 0` for the tap target |
| Progress bar | New, but built from `BarRow`'s existing track vocabulary: 6px track on `var(--sr-surface-subtle)`, `border-radius: 3px`, accent fill, `transition: width` |
| Stop / Check again / Try again | Quiet secondary button: `var(--sr-surface-subtle)` on `1px var(--sr-border-input)`, radius 6, `0.75rem`/500. **Deliberately not accent-filled** — the accent stays on the disclosure, which is the action that matters |
| Icons | Lucide only: `circle` (dashed via `stroke-dasharray="3 3"`), `loader-2`, `check`, `alert-circle`, `key-round`, `wifi-off`, `rotate-cw`, `chevron-down`, `chevron-up`, and a filled `rect` for Stop |
| Settings link (`no-key`) | Inline accent text link, consistent with the tab's existing "Go to Settings" affordance |

---

## Design Tokens Applied

**No new token is minted.** Every value comes from `frontend/src/globals.css`
and is defined in both themes already.

| Purpose | Token |
|---|---|
| Checkbox fill | `--sr-accent` |
| Checkbox label, status sentence | `--sr-text` |
| Species figure, settled | `--sr-text` |
| Species figure, while a pass runs | `--sr-text-muted` |
| Standing rule line, lead sentence, evidence line, progress count | `--sr-text-muted` |
| Status icon, neutral states (`not-checked`, `no-key`, `offline`) | `--sr-text-muted` |
| Status icon, `in-progress` and `complete` | `--sr-accent` |
| Status icon, the four `partial` states | `--sr-warning` |
| Status icon, `error` | `--sr-error` |
| Progress track | `--sr-surface-subtle` |
| Progress fill | `--sr-accent` |
| Disclosure label and chevron | `--sr-accent` |
| Excluded species name | `--sr-accent` (via `BirdName`) |
| Row separators in the excluded list | `--sr-border-subtle` |
| Secondary button face / border | `--sr-surface-subtle` / `--sr-border-input` |
| Secondary button hover | `--sr-surface` face, `--sr-accent` border and text |
| Focus ring | `2px solid var(--sr-accent)`, `outline-offset: 2px` |

Contrast: every text colour above is a shipped token already meeting AA on the
surface it appears on (`--sr-surface`, and `--sr-surface-subtle` for the button
face). The feature introduces no new text-on-fill pairing, so no new contrast
guard is required (NFR-07 / QA-56 is satisfied by reuse).

---

## Interaction Notes

### The pass

- **Auto-start** on Statistics open when a key is present, the app is online, and
  the cache is not already fresh (FR-18, OQ-02 default confirmed).
- The **planned checklist count is in the first rendered sentence**, before the
  first request goes out (FR-11). Never an indeterminate spinner bar.
- When follow-ups are discovered mid-pass the sentence **grows** rather than the
  denominator silently moving: the base count stays `of 73` and the follow-ups
  are added as a named clause. The progress bar's denominator is
  `planned + additional`.
- **Stop** ends the pass, keeps everything already resolved, and transitions to
  `partial` / `cancelled`.
- The figure **only ever falls**. An unresolved species counts (FR-04), so the
  total converges downward and never below the truth.

### The disclosure

- Collapsed by default in every state.
- Appears only when `found.length > 0`. Available mid-pass, where the label gains
  "found so far" so the list and the number agree at every moment.
- **Stays available with the toggle on** (FR-32, QA-37), where only the lead
  sentence changes: the same list, framed as information rather than exclusion.
- `aria-expanded` on the button, `aria-controls` pointing at the panel.

### The two toggles compose

- Both are session-only `useState`, no storage seam, resetting on relaunch.
  Published prose must use the settled phrasing **"per-session, resetting on
  relaunch"** and must account for the fact that a tab stays mounted once opened
  (FR-41).
- With "Count escapees" on, the total is byte-identical to today's (FR-28).
- The two exclusions are independent axes and compose without interaction.

### Accessibility (verified in a real browser, not reasoned about)

- The status region is **`role="status" aria-live="polite"`, rendered from first
  paint and never `display: none` while idle**. Verified: computed `display` is
  `flex` in every state including idle. This is the v0.5.83 trap — hiding a live
  region while empty makes it be *inserted* with its first message, which breaks
  announcement entirely and is invisible to both layout tests and jsdom.
- The message sits in a **sequence-keyed child** (`<span key={seq}>`), so pressing
  the same control twice announces twice while the region's `textContent` stays
  exactly the message. Do not append an invisible character to force a diff.
- **Status is carried in words, never colour alone.** The muted Species figure and
  the tinted status icon are supporting cues only; every state's meaning is in its
  sentence.
- Every `<button>` gets explicit `tabIndex={0}` (WKWebView Tab behaviour).
- Focus rings: `2px solid var(--sr-accent)`, `outline-offset: 2px`, on the
  disclosure and on all three action buttons.
- The excluded species names are `BirdName` buttons and inherit its semantics.
- Checkbox rows take `min-height: 2.75rem` in the ≤640 tier for the touch-target
  posture. The checkboxes carry no text, so `.sr-input-16` does not apply.

### Responsive constraints (measured, not estimated)

Measured in Chromium at 320px and 200% text scale, in both themes, against the
card's content box using text-ink rects over a `Range` per text node:

- **Text ink overflow: 0.00px** in all four configurations.
- **Page `scrollWidth`: exactly 320** at the 320px viewport.
- The header stacks, the stat grid goes one cell per row, the status row wraps
  its action below the sentence, and each excluded row stacks name over evidence.

**Three defects were found by that probe and fixed. Do not reintroduce them:**

1. **The evidence line ran 133.38px past the card's content box** at 320px/200%,
   because it carried `white-space: nowrap`. It must wrap: `overflow-wrap:
   break-word; min-width: 0`, and `.exrow` needs `min-width: 0` for the flex item
   to be allowed below its automatic minimum. A tidy single-line row is not
   available at this scale.
2. **A `minmax(15rem, 1fr)` grid track overflowed at 200%**, where 15rem resolves
   to 480px. Use the sanctioned self-collapsing form `minmax(min(15rem, 100%),
   1fr)` for any fixed track. (In the mockup this was the secondary-surfaces
   preview; the rule applies wherever the Engineer writes a fixed track.)
3. **`[hidden]` lost to an author `display: flex`**, so the progress row survived
   into every state that was not a running pass. In React this surfaces as
   conditional rendering rather than the `hidden` attribute, so prefer
   `{running && <Progress/>}`; if `hidden` is used on an element with an author
   `display`, it needs `[hidden] { display: none !important }`.

Also note: page `scrollWidth` alone is not a usable assertion here. It read a
clean `320` while the evidence line was 133px past its container, exactly the
under-reporting the repo has recorded three mechanisms for. Measure the element
against its container's content box.

---

## Motion Spec

One easing token throughout: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`.
Durations: `--dur-fast: 160ms`, `--dur: 200ms`, `--dur-slow: 300ms`.
Implementing library is **CSS transitions and keyframes** everywhere; no Motion
/ Framer dependency is added for this feature.

| Interaction | Easing | Duration | Origin | Reduced motion | Library |
|---|---|---|---|---|---|
| Disclosure panel opening/closing (`grid-template-rows` 0fr→1fr + opacity) | ease-out | 200ms | `transform-origin: top center` — grows downward from the control that opened it | collapses to ~0.01ms; state change is instant | CSS transition |
| Disclosure chevron rotate 0°→180° | ease-out | 200ms | element centre | instant | CSS transition |
| Status message swap (opacity 0→1, translateY 3px→0) | ease-out | 160ms | in place | instant | CSS keyframe `msgIn` |
| Species figure changing value (opacity 0.35→1, translateY −3px→0) | ease-out | 200ms | in place | instant | CSS keyframe `valueSettle` |
| Progress bar fill `width` | ease-out | 300ms | left edge (fill grows from the track's start) | instant | CSS transition |
| Pass spinner (`loader-2` rotate) | linear | 1s, infinite | element centre | **`animation: none`** — the definite "24 of 73" text carries the state instead | CSS keyframe `spin` |
| Button hover (background, border, colour) | ease-out | 160ms | in place | instant | CSS transition |
| Jump-nav link hover (colour, border) | ease-out | 160ms | in place | instant | CSS transition |

Reduced-motion implementation is a global block setting
`animation-duration: 0.01ms !important`, `animation-iteration-count: 1
!important`, `transition-duration: 0.01ms !important` under
`@media (prefers-reduced-motion: reduce)`, plus the explicit `.spin { animation:
none !important }` so the spinner does not merely spin very fast.

**Deliberately absent:** no pulsing or breathing indicator, no blur-in, no
hover-scale, no staggered entrance across the list, no bouncy spring on any
utility control, and no count-up animation on the Species figure (a count-up
would assert intermediate values the app has not resolved, which is exactly the
dishonesty this feature exists to remove). Motion appears only on things that
actually changed.

---

## Content Notes

Voice: informative, never promotional. Plain sentences that state a rule and
then stop. **No em dashes** in any string below (FR-44, QA-50). Straight
apostrophes throughout.

### Toggle label

```
Count escapees
```

Chosen over "Count eBird escapees" for the clean parallel with its neighbour
"Count spuh, slash & hybrids", which likewise names its classes without
attribution. The eBird attribution is made once, precisely, in the rule line.
The label names only the class it governs and claims no parity beyond FR-01
(FR-29, QA-34).

### The standing rule line (row 2, always present)

Toggle **off** (default):

```
Escapees do not count toward Species, following eBird. Naturalized and provisional exotics do count.
```

Toggle **on**:

```
Escapees count toward Species. eBird does not count them toward a life list, so this total will read higher than the one eBird shows you.
```

The second sentence of the "off" string is the anti-shortcut promise made
visible: a birder never has to wonder whether their Indian Peafowl or Red
Junglefowl quietly vanished. The "on" string tells the birder the consequence of
their own choice rather than letting them discover a disagreement later.

### Status sentences, all seven states

```
not-checked      Exotic status has not been checked yet. Every species counts until it is.

in-progress      Checking exotic status: {done} of {planned} checklists.
                 ...and when follow-ups have been discovered:
                 Checking exotic status: {done} of {planned} checklists, plus {additional} follow-up checks.

complete         Exotic status checked across {planned} checklists. {n} of your species are eBird escapees.
                 ...and when none were found:
                 Exotic status checked across {planned} checklists. None of your species are eBird escapees.

partial          Stopped at {done} of {planned} checklists. {planned - done} checklists were not
  (cancelled)    checked, and the species on them still count.

partial          Checked {done} of {planned} checklists. {failed} requests failed, so {n} species are
  (failures)     still unchecked and still count.

partial          Reached this pass's limit of {cap} requests. {n} species are still unchecked and
  (pass-budget)  still count.

partial          Stopped following up on {n} species after {cap} checklists each. Both still count.
  (species-      ...where n is not 2, the last clause reads: They all still count.
   budget)

no-key           No eBird key, so exotic status cannot be checked. Every species counts.
                 [inline link] Add a key in Settings

offline          Offline, so exotic status cannot be rechecked. Showing the check from {date}.
                 ...and with no cached result:
                 Offline, so exotic status cannot be checked. Every species counts.

error            eBird could not be reached. Every species counts until the check succeeds.
```

Note that **every state says what the number is doing**, not just what the
network is doing. "Every species counts until it is" and "still unchecked and
still count" are the FR-04 invariant stated in the reader's own terms.

### Progress readout

Beside the bar, tabular numerals: `{done} / {planned + additional}`.

### Action button labels

```
Stop            (in-progress; leading filled square glyph)
Check again     (all four partial reasons; leading rotate-cw glyph)
Try again       (error; leading rotate-cw glyph)
```

### Disclosure expander label

```
idle, collapsed        Show the {n} escapee(s)
idle, expanded         Hide the {n} escapee(s)
mid-pass, collapsed    Show the {n} escapee(s) found so far
mid-pass, expanded     Hide the {n} escapee(s) found so far
```

Singular "escapee" at n = 1, plural otherwise. The "found so far" clause appears
only while a pass is running.

### Disclosure lead sentence

Toggle **off**:

```
eBird tags these as Exotic: Escapee, so they are left out of Species. They stay on your Life List.
```

Toggle **on**:

```
eBird tags these as Exotic: Escapee. They are counted here because Count escapees is on.
```

The "stay on your Life List" clause matters: it tells the birder nothing was
deleted, which is the fear a dropping number creates.

### Excluded species row

Name via `BirdName`, then the evidence, right-aligned on desktop and stacked
beneath the name on a phone:

```
Exotic: Escapee · {count} checklist checked        (count = 1)
Exotic: Escapee · {count} checklists checked       (count > 1)
```

Deliberately **factual rather than explanatory**: it is per-species evidence
drawn from the cache (FR-09), not a restatement of the rule, which is already
stated once in the lead sentence above the list. Ordinary plural agreement only,
no word-form ladder.

### The reusable cross-tab sentence

One sentence, written once and reused wherever a count reflects the rule
(FR-33, QA-38). Per the repo's single-source rule, change it in every copy in the
same edit.

```
Counts leave out forms that don't count toward a life list, including escapees.
```

It names the new thing without enumerating all four exclusion classes, so it
**survives a fifth class** (FR-40) and it does not claim eBird parity beyond what
is implemented.

Applies to: Calendar species counts, Multimedia documentation coverage,
Frivolous Lists, and any other surface headlining a life-list count. On Calendar
it is plain text with no link and no fetch, preserving the zero-network guarantee
(FR-35, QA-40).

### County Completeness caption replacement

Replaces "spuhs, slashes & hybrids don't count" in **both** places in
`CountyCompletenessPopup.tsx` (currently lines 88 and 121), with the assertion in
`CountyCompletenessUI.test.tsx` (currently line 59) updated alongside (FR-40,
QA-46):

```
Your count leaves out forms that don't count toward a life list, including escapees. The eBird regional list is not filtered.
```

The second sentence makes OQ-03's numerator-only asymmetry visible to the reader
rather than leaving it as a silent approximation (FR-37).

---

## Deliberate deviations

### From the Weft design doctrine

1. **Type face.** The doctrine asks for a distinctive OFL display face and names
   Inter specifically as the thing to avoid. `weft-design-lint` flags this and it
   is the mockup's one remaining finding. **Not applied, deliberately.**
   SnowRaven's shipped face is Inter / system-ui across 61 versions, recorded in
   `pipeline/design-system.md`, which wins on specifics; the doctrine wins on
   craft. Changing an app-wide type face inside a feature that adds one checkbox
   would be a reinvention, not an extension, and would put every measured layout
   in the repo back in play. The Engineer must **not** introduce a new font.

2. **Depth and atmosphere.** The doctrine asks for layered depth over flat fill.
   Flat surfaces with hairline borders are SnowRaven's shipped register and its
   stated brand position ("restraint is the brand"). The new region deliberately
   has no card, no elevation and no shadow, because a card inside a card is what
   the doctrine itself forbids and is what this surface would otherwise become.

3. **Palette.** One dominant accent with almost nothing else coloured is
   `design-system.md`'s explicit position, not a timid palette. This feature
   mints no token.

### From the PRD

4. **FR-31 retry scope.** See "Approved deviation from FR-31" above. Raised at
   the design gate and approved by the user on 2026-08-12.

---

## What the Engineer must not do

1. Do not introduce a new font, token, or colour. Everything here is reuse.
2. Do not put the new control in a `ToggleSwitch`; it must match its neighbour.
3. Do not hide the status region while idle, and do not render it conditionally.
   It must be in the accessibility tree from first paint.
4. Do not put the message directly in the live region's text node; it needs the
   sequence-keyed child, or a repeated identical message will not announce.
5. Do not give the excluded evidence line `white-space: nowrap`. It ran 133px
   past the card at 320px/200%.
6. Do not use page `scrollWidth` to verify any of the above. It read a clean 320
   on the broken build.
7. Do not add a sub-line to the Species `StatCell`.
8. Do not animate the Species figure as a count-up. It would assert values the
   app has not resolved.
9. Do not remove "Check again" from the partial states; it is an approved
   deviation, not an oversight.
