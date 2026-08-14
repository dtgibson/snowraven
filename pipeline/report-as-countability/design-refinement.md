# Design Refinement — Report-As Countability

Improve lane, Stage 2. Scope: the copy and felt behavior of four shipped
controls whose governed set moves, plus the notes that explain them. No new
control, no new surface, no layout change, no new token.

---

## Visual Direction

Nothing visual changes. Every control keeps its component, geometry, position,
and tokens. This is a vocabulary refinement: four labels, three Calendar
strings, two shared sentences, and the help text behind them. The refinement
succeeds if a birder reads the new labels and understands a *broader* rule than
the old ones named, without any surface looking different.

Deliberate deviation from the Weft design doctrine, logged per its own
precedence rule (`design-system.md` wins on specifics): the doctrine asks for a
distinctive display face, and SnowRaven ships Inter / system-ui across 87
versions. The shipped system wins. No font, color, depth, or layout change is
proposed here.

---

## The real control set, confirmed from the code

The task brief's list was close but wrong in one place. `Show subspecies` is
**not** in scope: it is a separate merge control that sits immediately beside
the in-scope toggle on both Multimedia and Species Detail. Renaming near it
without noticing would have produced a collision.

| # | Surface | Site | Current label | Component | Governs today |
|---|---|---|---|---|---|
| 1 | Statistics | `BirdingStats.tsx:475` | `Count spuh, slash & hybrids` | checkbox, 14px, `.sr-count-rule` | `filterObservations` via `isNonCountableObservedName` |
| 2 | Calendar | `Calendar.tsx:1049` | `Count spuh, slash & hybrids` | `Switch small` | `includeForms` |
| 3 | Multimedia | `LifeList.tsx:750` | `Show sp./slash` | `ToggleSwitch` | `isSpuhOrSlash` only (**not** hybrids) |
| 4 | Species Detail | `SpeciesDetail.tsx:478` | `Show sp./slash` | `ToggleSwitch` | `isSpuhOrSlash` only (**not** hybrids) |

Three further strings in the same family, all Calendar:

| Site | Current |
|---|---|
| `Calendar.tsx:1051` | `Spuh / slash / hybrid forms aren't countable species; off by default.` |
| `Calendar.tsx:609` | `Spuh / slash / hybrids included in the species & individual counts` |
| `Calendar.tsx:937` | `, spuh/slash/hybrids included` |

Adjacent and **out of scope**, listed so they are not touched: `Show subspecies`
(`LifeList.tsx:747`, `SpeciesDetail.tsx:477`), `Show non-bird`
(`LifeList.tsx:755`), `Count escapees` (`exoticCopy.ts:66`).

---

## The naming problem, and why v0.5.87 already solved half of it

Under the new rule the excluded set is eBird's own non-countable set. It is not
enumerable in a label: it contains spuhs, slashes, interspecies hybrids,
undescribed forms, and unrecognized species, and it *excludes* things the old
label's three nouns would have caught (subspecies-group slashes inside a
parenthetical, intergrades).

The unifying principle is one clause a birder already understands, and the
change brief states it exactly: **ambiguity about which species does not count;
ambiguity about which subspecies counts as the parent.**

`lib/exoticCopy.ts` already carries the house answer to this problem. Its
`COUNT_RULE_SENTENCE` reads "Counts leave out forms that don't count toward a
life list, including escapees", and its own doc comment says it "names the new
class WITHOUT enumerating all four exclusion classes, so it survives a fifth".

**That sentence is already correct under the new rule and needs no change.**
The set it describes moves; the description does not. That is the strongest
available evidence that "forms that don't count toward a life list" is the right
house vocabulary, and the four labels should join it rather than invent a
parallel one.

### The chosen vocabulary: one noun, two verbs

- Noun: **forms**. Already the internal vocabulary (`includeForms`,
  `speciesCountWithForms`, `showFormsNote`, `formsSuffix`) and already in
  shipped user-facing copy (`HELP.md:279`, "non-countable forms").
- Verb **Count** where the control moves a number. Verb **Show** where it moves
  rows.

| # | Surface | New label |
|---|---|---|
| 1 | Statistics | `Count all forms` |
| 2 | Calendar | `Count all forms` |
| 3 | Multimedia | `Show all forms` |
| 4 | Species Detail | `Show all forms` |

Four properties this satisfies, each of which rejected a candidate:

1. **It does not enumerate**, so it survives the set moving. This is the whole
   v0.5.87 lesson and it kills `Count spuhs and hybrids`.
2. **It preserves the `Count <plural noun>` parallel** with its stacked
   neighbour. `exoticCopy.ts:61-66` records that `Count escapees` beat `Count
   eBird escapees` specifically for "the clean parallel with its neighbour
   Count spuh, slash & hybrids". Renaming the neighbour without preserving the
   shape would retire the reason the sibling is named as it is.
3. **It is positive, not a negation.** The control turns *on* to include more,
   and the label says what turning it on does. This kills `Count non-countable
   forms` and `Count non-species forms`, both of which pair a positive verb with
   a negated noun.
4. **It is short.** The Statistics label stacks under `Count escapees` in a
   header that wraps at every narrow width; the Multimedia label sits in a
   `flexWrap` toolbar beside three other pills. `Count all forms` is 15
   characters against the old 26.

Runner-up, presented but not recommended: **`Count uncountable forms`** /
**`Show uncountable forms`**. It is self-explaining without a helper line, which
is a real advantage on Statistics, where the header has no room for one. It is
rejected because "count the uncountable" is a small paradox the reader has to
step over, it is 23 characters, and it breaks the positive-verb property.

### The three Calendar strings

| Site | New |
|---|---|
| `1051` helper | `Forms that don't count toward a life list, like a spuh or a hybrid. Off by default.` |
| `609` popup note | `All forms included in the species and individual counts` |
| `937` suffix | `, all forms included` |

The helper line still gives examples, and that is deliberate: the constraint
that killed enumeration in the *label* is that a closed list presented as a
definition goes stale. "like a spuh or a hybrid" is open by construction, so it
teaches without claiming completeness. This is the same distinction
`COUNT_RULE_SENTENCE` draws between naming a class and listing it.

**No helper is added to Statistics.** Its header holds two stacked checkboxes
and has no room; its sibling `Count escapees` likewise carries no helper there,
stating its rule under the Species figure instead. Consistency and a clean
header both point the same way, and `HELP.md` carries the definition.

---

## Felt-behavior call: Multimedia and Species Detail widen

**Recommendation: widen both.** The toggle governs the whole non-countable set,
matching Statistics and Calendar.

Today `Show sp./slash` runs `isSpuhOrSlash`, which omits hybrids by design (it
is "the minimal display-filter primitive", `speciesUtils.ts:325`). The
consequence is visible on the same screen: a hybrid row renders while the same
tab's `X of N species` count excludes it. That is precisely the disagreement
`ROADMAP.md:175` records. Widening makes the visible rows and the headline count
agree by construction rather than by coincidence.

**The named cost, carried rather than hidden.** With the toggle off (the
default), names newly hide that are visible today: three named hybrids
(`Brewster's Warbler (hybrid)`, `Lawrence's Warbler (hybrid)`, `Bogota Sunangel
(hybrid)`) and 25 genus-level spuhs carrying a parenthetical. For a North
American birder the real cases are Brewster's and Lawrence's. Two things make
this acceptable:

- Those birds were **already excluded from the count**. Widening changes only
  whether the row agrees with the number, and it resolves in the direction of
  agreement.
- They are **one press away**, and the new label says so. `Show all forms` names
  a superset; `Show sp./slash` did not.

Widening also *reveals* in the other direction: the 88 subspecies-group slashes
in direction A become countable, so under `Show subspecies` off they fold into
their parent as a reader expects rather than disappearing.

Rejected alternative: widen Multimedia only. It would leave two identically
labelled toggles on adjacent tabs governing different sets, which is a worse
defect than the one being fixed.

**Watch item for the Engineer:** with the label changed, `Show all forms` sits
directly beside `Show subspecies` on both tabs. They are independent axes and
both remain visible, but "all forms" can be misread as including subspecies.
Mitigation is ordering, not copy: keep `Show subspecies` first, as it is today
on both tabs, so the more specific control is read first.

---

## Felt-behavior call: the Statistics asymmetry stays, and is stated

Today the Statistics header checkbox moves the species tile but not media
documentation coverage and not Frivolous Lists. **Recommendation: keep it, and
close the documentation defect that hides it.**

It is principled rather than accidental. Both of those metrics are *about* the
canonical life list, not about what was recorded. A coverage percentage whose
denominator the reader can inflate with `Gull sp.` is asking "have you
photographed a spuh", which is not a question that has an answer. v0.5.87
deliberately extended the same asymmetry to escapees, in three separate
comments, each phrased "exactly as it already ignores the include-spuh toggle"
(`BirdingStats.tsx:358`, `mediaStats.ts:324`, `FrivolousListsSections.tsx:190`).
Unifying the predicate makes the asymmetry more visible; it does not make it
wrong.

What *is* wrong is the published claim. `HELP.md:163` says the checkbox "decides
what counts as a species across every card". That is false today and false
after.

**The vehicle already exists and is already in the right place.** The shared
`.sr-count-rule-note` renders on both fixed surfaces already
(`MediaStatsSections.tsx:201`, `FrivolousListsSections.tsx:199`), gated on
`excludedNames.size > 0`. Under the new rule the form exclusion is always in
force on those two surfaces, so the note becomes unconditional there, and gains
one sentence naming the fixed scope.

Two copy changes in `lib/exoticCopy.ts`, both single-sourced beside their
siblings:

```
COUNT_RULE_SENTENCE          (unchanged, escapees in force)
  "Counts leave out forms that don't count toward a life list, including escapees."

COUNT_RULE_SENTENCE_NO_ESCAPEES     (new — same sentence, optional clause dropped)
  "Counts leave out forms that don't count toward a life list."

ALWAYS_COUNTABLE_NOTE                (new)
  "This figure always uses countable species, whichever way Count all forms is set."
```

The two rule sentences are one base plus an optional clause and must be
generated from a single source, not written twice, per the standing manifest
rule in `design-system.md`. The escapee-free variant is newly needed because the
note now renders before, or without, any escapee resolution, where the current
sentence would over-claim.

`ALWAYS_COUNTABLE_NOTE` names the control in its own words so the reader can
connect the sentence to the checkbox they just clicked without a link.

This touches copy the v0.5.87 build owns. It does not touch
`ProvenanceSnapshot`, `excludedNames`, the cache, or the Calendar's passive
reader, all of which the change brief holds untouched.

---

## Felt-behavior call: how a moved total is explained

**Recommendation: no panel. `HELP.md` plus `CHANGELOG.md`, one reassurance
clause, and the toggle itself as the interactive account.**

The v0.5.87 precedent is real and its *principle* applies: a total that quietly
falls with no account of itself is the failure this repo keeps rejecting. Its
*mechanism* does not transfer, for four reasons.

1. **`ExoticProvenanceAccount` exists because escapees are a live, stateful,
   networked check.** It carries seven status states, a definite progress count,
   a Stop button, and a retry on every partial reason. It answers "what is the
   check doing" at least as much as "which birds". This rule is deterministic,
   offline, instantaneous, and identical forever. There is no status to report,
   so most of that component would be empty scaffolding around a fixed list.

2. **A one-time shift is a release event, not a permanent fixture.** Permanent
   UI explaining a one-time change means every user from here on reads an
   account of a change they never experienced. That is the opposite of quiet
   utility, and it is the failure mode the design system's "no clutter" line
   exists to prevent.

3. **The delta runs up, not down, for a real birder.** Verified independently
   against the bundled snapshot rather than taken from the brief. Direction A is
   bread-and-butter North American: `Canada Goose (moffitti/maxima)`, `Redpoll
   (Common/Hoary)`, `Dark-eyed Junco (Slate-colored/cismontanus)`, `Iceland Gull
   (thayeri/kumlieni)`, `Red-tailed Hawk (calurus/abieticola)`, `Song Sparrow
   (melodia/atlantica)`. Direction B is 81 names of which **53** are
   `(undescribed form)` / `(unrecognized species)` and **25** are world
   genus-level spuhs; only **3** are names a birder plausibly holds, and two of
   those are famous named hybrids that a birder already knows are hybrids. The
   escapee panel was built for a number that only ever fell. This one mostly
   rises.

4. **The account already exists and is interactive.** Flipping `Count all forms`
   on shows the difference; the delta *is* the answer, computed offline and
   instantly. Flipping `Show all forms` on puts the birds back on screen.
   Nothing was deleted.

What is genuinely needed is the reassurance clause, not the panel, and v0.5.87
already proved the phrasing. `ESCAPEE_LEAD_OFF` ends "They stay on your Life
List", and `HELP.md:169` closes with "These birds stay on your Life List either
way; only the count changes." Reuse that sentence for forms.

**If the account is wanted anyway, it is a new surface and out of scope.** Say
so as a finding rather than designing it. Its natural home is beneath the
Species figure where `ExoticProvenanceAccount` already sits, and it would need
its own brief.

---

## Content Notes

`docs/HELP.md` carries most of the explanation and needs the largest edit. Every
passage below states the old rule, and several explain the
intergrade-parenthetical mechanism this build supersedes. Per the standing
single-source rule, all copies change in the same edit.

| Line | What is wrong after this change |
|---|---|
| 146 | `Show sp./slash` label; "uncertain identifications" is now too narrow |
| 163 | Label; the three-noun enumeration; **"across every card" is false** |
| 252 | "non-countable spuh/slash/hybrid forms" enumeration |
| 271 | "the spuh/slash/hybrid toggle" |
| 277 | Section heading `Counting spuh, slash & hybrids` |
| 279 | Label; enumeration; the intergrade-parenthetical explanation |
| 283 | "the spuh/slash/hybrid toggle" |
| 359 | County Completeness "spuhs, slashes and true interspecies hybrids don't count" |
| 381, 409, 467 | "True interspecies hybrids remain excluded, while an intergrade named inside a trailing parenthetical counts as its parent species" |
| 391 | `Show sp./slash` label |

Replacement framing, used consistently: **SnowRaven follows eBird's own rule for
what counts as a species. A form that leaves the species in doubt does not count
(a spuh, a slash, a hybrid, an undescribed form). A form that only leaves the
subspecies in doubt counts as its parent species.** That is one rule stated
once, it matches what the code now does, and it explains both directions of the
delta without a table.

`README.md` and `website/index.html` carry the same claim and change in the same
edit. `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` are unaffected: no new request,
no new control, no changed accessible name beyond the four labels.

Voice throughout: informative, never promotional. No em dashes anywhere in these
strings, per the standing sweep. Straight apostrophes.

---

## Component Usage

Unchanged in every case. `input[type=checkbox]` with `accentColor:
var(--sr-accent)` inside `.sr-count-rule` (Statistics); Calendar's local
`Switch small`; the shared `ToggleSwitch` boxed variant (Multimedia, Species
Detail); `.sr-count-rule-note` for both shared sentences. No component gains a
prop. No component is added.

## Design Tokens Applied

None minted, none changed. Existing only: `--sr-accent` (checkbox fill, switch
on-track), `--sr-gray-400` (switch off-track), `--sr-switch-thumb` +
`--sr-switch-thumb-shadow` (knob), `--sr-text` / `--sr-text-muted` (labels and
notes), `--sr-surface` / `--sr-surface-subtle` / `--sr-border` (control chrome).

## Interaction Notes

No interaction changes. Every control keeps its type, its `role`, its default
(off), and its session-only lifetime. Per the standing rule, published prose
describes that lifetime as "per-session, resetting on relaunch" and never as
resetting on tab change, since a tab stays mounted once opened.

Accessible names change only as the visible labels change, and each control's
accessible name remains its visible label, so WCAG 2.5.3 Label in Name holds by
construction. The two new notes are static text, not live regions.

## Motion Spec

Nothing moves that did not move before, and no new motion is introduced.

- Switch track and knob (`ToggleSwitch`, Calendar `Switch`): existing
  `background 180ms ease-out` and `transform 180ms ease-out`, transform-origin
  not applicable to a linear track. Unchanged.
- The two notes render statically with zero animation. This is deliberate and
  matches the design system's rule that a preference's consequence "must appear
  at the instant the last switch flips, in the same block and with zero
  animation".
- `prefers-reduced-motion`: already honored globally for the switch transitions;
  no new motion is added, so no new fallback is required.

---

## Verification of the mockup

Measured, not asserted.

**Geometry.** 16 configurations (320 / 390 / 768 / 1440 px x 100% / 200% text
scale x light / dark), measuring **text ink** via a `Range` over each text node
against its container's **content box**, per the v0.5.85 rule that an
element-box measurement will certify a half-fixed build. Result: 0
configurations with ink outside its container.

The probe is **not vacuous, and that was earned rather than constructed**: its
first run flagged a real 52.88px leak at 320px/200% on the string `Count spuh,
slash & hybrids`. Page `scrollWidth` read exactly **320** in both failing
configurations, which is the third time this repo has seen that proxy report a
leak as absent. Investigated rather than reported: the leak was an artifact of
my replica, which had copied `white-space: nowrap` from `ToggleSwitch` onto the
Calendar `Switch`, which does not carry it. The replica was corrected to the
real component (30x18 track, 14px knob, no `nowrap`) and the probe re-run clean.
**No shipped defect here; the finding was in the harness.** Worth noting anyway
that the proposed label is 15 characters against 26, so it has more room at
every width, not less.

**Lint.** `weft-design-lint` reports two findings, both resolved:

- `banned-font` (Inter) — **deliberate deviation, logged above.** The doctrine's
  own precedence rule gives `design-system.md` the specifics, and SnowRaven has
  shipped Inter / system-ui for 87 versions. Changing the display face in a copy
  refinement would be out of scope and wrong.
- `slow-motion` — **false positive.** It flags the `1ms` inside the
  `prefers-reduced-motion` block, which is the reduced-motion *fallback*, not UI
  motion. The only real transitions are the shipped 180ms ease-out switch
  animations.

---

## Out of scope, recorded as findings

1. **A per-user account of which of *their* names moved** is a new surface. Not
   designed. See the call above.
2. **`parseLifeList.ts:74` is a dead call site** with zero app callers (change
   brief, Correction 1). Not a design concern; flagged so it is not relabelled
   by sweep.
3. **Geographic Stats per-county species counts** remain a stated v0.5.87
   omission (`ROADMAP.md:173`) and are not pulled in here.
</content>
</invoke>
