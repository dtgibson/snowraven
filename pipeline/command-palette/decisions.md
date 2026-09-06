# Decisions — Command Palette

Design-stage decisions and deliberate deviations from `pipeline/design-system.md` and the
Weft design doctrine. Recorded at Stage 4 (The Designer) so a later reader inherits the
reasoning and not only the values.

---

## D-01 — The overlay is a new pattern, and neither shipped overlay's box is borrowed

**Extends the design system.** `pipeline/design-system.md` has two fixed overlays and
neither fits: `ModalDialog` (`.sr-dlg-*`) is centred and is for confirmations, and the More
sheet (`.sr-nav-sheet-*`) is a bottom navigation sheet that must read as rising from the bar
it was opened from. A search palette is top-anchored, because a list that grows downward
from a field should not push its own field around, and because a centred box moves under a
software keyboard.

**What is borrowed is behaviour, not geometry:** one close path for Escape, the backdrop
and every control; backdrop close on `mousedown` where `e.target === e.currentTarget` (a
drag that starts inside the panel and ends on the backdrop must not close it); the shared
`lib/useFocusTrap.ts`; focus returned to the opener through a getter, with a stated
fallback, in an effect after the close commits.

**New classes:** `.sr-palette-root`, `-panel`, `-head`, `-field`, `-input`, `-close`,
`-results`, `-group`, `-row`, `-row--active`, `-row-icon`, `-row-name`, `-row-sci`,
`-note`, `-status`, `-status-line`, `-foot`, `-legend`, `-kbd`. **New tokens: none.**

---

## D-02 — The entry point is a field, not a twelfth `.sr-nav-item`

**Extends the design system.** The nav's row anatomy is one component at three densities,
and reusing it for the palette control would have been the cheap answer. It is the wrong
one: a `.sr-nav-item` says "a screen lives here", and this control says "typing happens
here". `.sr-nav-search` is therefore a field — `--sr-border-input` boundary, radius 8,
`--sr-surface-faint` fill — and it is the same object the palette's own query field turns
into when it opens, which is the continuity the feature rests on.

It takes three sizes exactly the way `.sr-nav-item` does (sidebar 32px, rail 40×40, sheet
44px), so the "one control at three densities" idea the nav already proves is extended
rather than contradicted.

---

## D-03 — At rail density the box chrome goes with the label

**Applies an existing rule rather than deviating.** `pipeline/design-system.md` on
`ToggleSwitch`: *"Never leave the boxed chrome around a label-hidden switch (it reads as an
empty box)."* At rail density the search control's label is hidden, so the border and fill
go with it and only the 40×40 hit box, the radius and the `--sr-surface-subtle` hover
remain.

What then says "this is not a destination" is a `<hr class="sr-nav-sep">` **below** the
control — the nav's own structural-separator vocabulary, and structurally true for the same
reason the Settings separator is: the search control is not in the saved order and is not a
destination at all, while every destination is peer to every other.

---

## D-04 — Species rows carry no glyph

**Deviation from the shipped `SpeciesCombobox` row, deliberate.** That row reserves a 16px
leading slot for a selection check. The palette has no selection, so the slot would hold
either nothing or fifty identical book icons down the densest part of the list. The
doctrine's icon rule is explicit that an icon must clarify or create hierarchy; a repeated
identical mark does neither. The group heading already says what these rows are, and
dropping the glyph gives the two groups distinct left rhythm, which is a quieter way of
saying "two kinds of thing".

Destination rows keep their `TAB_ICONS` glyph, which is doing real identification work: it
is a different glyph per row and it is the same glyph the navigation shows.

---

## D-05 — The query field is bordered, so the shipped focus ring is not overridden

**Deviation from the usual command-palette form, deliberate.** The convention is a
borderless full-width input. The palette autofocuses its input, so the global
`input:focus-visible` ring is on screen essentially the whole time the overlay is open, and
a borderless input would have forced an override of the app's one focus treatment — a real
accessibility risk for a cosmetic gain. A real field means the shipped ring hugs a real
border and **nothing is overridden**, and it makes the entry control and the query field
visibly the same object (D-02).

Register: the shipped `SpeciesCombobox` `md` box (40px, 1.5px `--sr-border-input`, radius 8)
with the type one step up to `1rem`, because this is the overlay's hero control.
`.sr-input-16` rides onto the `<input>` as every picker call site passes it.

---

## D-06 — A close button at every density, not only on the phone

**Designer's call, beyond the PRD.** FR-42 permits a close control; nothing required one.
Two reasons it is here, and one reason it is unconditional:

- At phone width the palette is a full-height sheet, so there is no visible backdrop to
  press and Escape needs a hardware keyboard. Without a close control a touch user's only
  exit is choosing a result.
- A backdrop press is undiscoverable on any platform.

It is rendered at **every** density rather than only ≤640 so the overlay's tab-stop
population is a constant. A width-conditional control would make QA-41's assertion
width-dependent, which is exactly the kind of qualifier that later gets dropped.

Cost, stated: the overlay has two tab stops rather than one. Both are explicit
(`tabIndex={0}`), so the focus trap's prediction still matches WebKit's default tab mode
exactly, which is the property NFR-04 actually needs. Measured in both engines.

---

## D-07 — The status region IS the state line, and there is exactly one

**Designer's call on an open question.** The PRD's Out of Scope makes announcing anything a
Designer decision defaulting to "no", and the Architect's D-06 sets the default at "render
no live region at all". Rendering none would leave a screen-reader user who types `zzzq`
hearing nothing at all, because `aria-activedescendant` announces options and there are
none.

**One** `role="status"` region is rendered, and it is the same element that carries the
visible state line, so nothing is announced twice and nothing is invented for assistive
technology alone. It satisfies all four of the Architect's constraints: mounted from the
first commit and empty until it has a sentence; it holds the sentence and nothing else; the
message is a sequence-keyed child; and no rule sets a hiding value on it or any ancestor —
all padding and typography live on the child line, so the idle region computes to zero
height **without** being hidden to achieve it. It is outside every `inert`-able element,
which is free because the palette has none.

**Result counts are still not announced**, per the default. The region carries only the four
sentences that are the state.

---

## D-08 — The listbox owns options and groups only

**Correction to the mockup's own first draft, worth recording.** Group headings, the cap
line and the status region were initially children of the `role="listbox"`. A listbox may
own only `option` and `group`, so a `role="status"` child is an `aria-required-children`
violation waiting to be found in review.

Final shape: the scroller is **not** the listbox. The listbox holds two `role="group"`
wrappers, each carrying its visible heading as a `role="presentation"` child and its name as
the group's own `aria-label` (the APG grouped-listbox pattern); the cap line and the status
region are siblings below the listbox inside the same scroller. The flat row array and its
single active index are untouched, so ArrowDown still crosses the group boundary for free,
which is the property the Architect's D-08 exists to protect.

---

## D-09 — The footer key legend, suppressed with the key hint

**Designer's call, beyond the PRD.** Three legends (`↑ ↓ Move`, `↵ Open`, `Esc Close`) in
`.sr-palette-kbd` caps on a `--sr-surface-faint` strip. It teaches the keyboard model at the
one moment the user is looking at it, contains no interactive element and adds no tab stop.

It is rendered **only when the chord hint resolves to `cmd` or `ctrl`** — FR-46's rule
extended one step: a user with no keyboard is not shown a key legend either. Same helper,
same resolution, no new mechanism.

---

## D-10 — The rail control shows no key hint

**Accepted cost, stated rather than solved.** The rail shows no labels for any of its eleven
destinations, and its tooltip is a single text node rendered by the shipped `useRailTooltip`.
Adding a chord to it would mean changing a shipped surface that ten destinations also use,
to serve one control. A rail-only user discovers the chord in `docs/HELP.md` or by widening
to the sidebar, where the hint is on screen.

---

## D-11 — Scientific-name token: the shipped code, not the design-system line

**Pre-existing divergence, resolved toward the code.** `pipeline/design-system.md`'s Type
section says scientific names are `--sr-text-gray`. The two shipped surfaces that render one
beside a common name — `SpeciesCombobox`'s row and Species Detail's hero — both use
`--sr-text-muted`. The palette is explicitly borrowing that row, so it follows the code.
Both clear AA in both themes (measured). A third answer here would be the worst of the
three. **Flagged for the design system**, not fixed in this feature.

---

## D-12 — Inter stays

**Deliberate deviation from the Weft design doctrine, logged.** The doctrine bans Inter as a
display face. The doctrine's own precedence rule gives `pipeline/design-system.md` the
specifics, and SnowRaven has shipped Inter / system-ui for over a hundred versions. Changing
the app's typeface inside a command-palette build would be out of scope and wrong. The
mockup's own annotation chrome uses a distinctive serif display stack, which is the house
convention for these files (`report-as-countability`, `nav-rework`).

---

## Declined

- **Prefix-first ranking of species results.** Would be more useful for a query like `war`,
  and is not fuzzy matching. Declined because it would make the palette order results
  differently from the app's three shipped pickers, and one surface quietly ordering
  differently is how two surfaces stop feeling like one app. A candidate follow-on earned
  from a shipped plain version (PRD Open Question 2).
- **Dropping the scientific name at phone width.** It truncates hard at 320px and 200% text
  scale ("Calypte a..."). Declined for parity: the shipped picker truncates the same way at
  the same widths, and a palette that dropped it would be the fourth different species row
  in one app. The 40% cap and truncation on both spans mean the common name always keeps the
  majority, which is the guarantee that matters.
- **A sticky group heading inside the scrolling result list.** Declined as mechanism for no
  gain: there are two groups, both headings are near the top, and a sticky band inside an
  overlay brings its own focus-obscuring guard (`scroll-margin-top` on the focusables) for a
  list whose rows are not focusable in the first place.
- **A per-trigger `transform-origin`.** Declined with a reason, in the design spec's Motion
  Spec: four triggers at three screen corners plus a chord with no element, on a
  viewport-anchored modal whose own field is at the panel's top.
- **A distinct visual treatment for the two Yellow-rumped Warbler forms.** Declined: they
  are ordinary distinct names in the parse (FR-30) and the app's own reveal behaviour does
  the work when one is opened. Marking them in the palette would be a second countability
  vocabulary in a control that has none.
