# Design Spec: Life Lists Region Filter

**Feature:** life-list-region-filter
**Stage:** 4, The Designer
**Mockup:** `pipeline/life-list-region-filter/design.html` (self-contained; the review bar switches theme, viewport, text size, the saved-region relaunch, the backup state and the ML export; the core journey is live: open Region, type, pick a county, read the list and sentence, choose Everywhere)
**Design system:** `pipeline/design-system.md` applies in full; this feature extends it and mints nothing. The three recorded choices are in `decisions.md`, D-02.

## Visual Direction

The shipped Life Lists ledger, unchanged, with one more control at the head of its strip. The Region control is the Targets county picker's family (a type-to-find combobox with a search glyph, a chevron and a grouped listbox) drawn at the strip's own 30px register so it sits level with the switches and pills. Nothing new is colored: the accent still marks only the things that act or are selected (the active option's ring, the selected option's name and check, the field's focus ring). The one change to the rest of the tab is that under a region the count sentence sets the region's name in the text ink, because that is the thing that changed.

## Screens / Views

### The control strip (desktop, 641px and up)

`.sr-lfl-controls` (`--sr-surface-faint`, `padding: 12px 18px`, class `sr-ctl-row`) keeps one wrapping flex row, `gap: 6px`, now in this order:

1. **Region.** Uppercase label "Region" (`.sr-ctl-label.sr-lfl-label`, 0.6875rem/700, `--sr-text-muted`, `--sr-label-ratio: var(--sr-label-optical)`; its `id` is the input's `aria-labelledby`). Then the control, `.sr-lfl-region` (`position: relative; flex: 0 1 16rem; min-width: 11rem; z-index: 20`):
   - **Field** `.sr-lfl-region-field`: `min-height: 30px`, `padding: 0 2px 0 9px`, 1.5px `--sr-border-input`, radius 6, `--sr-surface`; lucide `Search` 13px / 2.2 in `--sr-text-muted` (class `.sr-lfl-region-glyph`, never a bare `svg` selector); the `<input type="text" role="combobox">` (`.sr-lfl-region-input.sr-input-16`, 0.75rem/600, `--sr-ctl-rem: 0.75rem`, borderless, `padding: 4px 0`, `text-overflow: ellipsis`; placeholder 500 `--sr-text-muted`); a trailing chevron `Button` (`.sr-lfl-region-chev.sr-touch-target`, 26px square, radius 4, `aria-label` "Show regions", `aria-expanded`, lucide `ChevronDown` 14px rotating 180 degrees while open); `:focus-within` takes `--sr-accent` border plus the input ring's 4px `rgba(45,134,83,0.12)` halo (120ms). Closed, the input's value is the selected label, "Everywhere" when nothing is selected; open, it is the typed query and the placeholder reads "Type a country, state, or county".
   - **Listbox** `.sr-lfl-region-list` (`role="listbox"`, `aria-label` "Regions in your backup"): absolute, `left: 0; right: 0; top: calc(100% + 4px)`, `z-index: 1200`, `padding: 4px`, `--sr-surface`, 1px `--sr-border`, radius 8, `--sr-card-shadow`, `max-height: 21rem`, `overflow: auto`, `overscroll-behavior: contain`. First row always "Everywhere" (`.sr-lfl-region-opt--all`, italic, the species picker's clearing-row convention), then up to three groups in the fixed order Countries, States and provinces, Counties, each a `role="group"` labelled by its own heading (`.sr-lfl-region-grp`, 0.625rem/700 uppercase 0.07em `--sr-text-muted`, `padding: 9px 9px 3px`; groups after the first separated by a 1px `--sr-border-subtle` rule with 3px above). A group with no shown choice is omitted. Options `.sr-lfl-region-opt`: `min-height: 32px`, `padding: 5px 9px`, radius 6, 0.8125rem `--sr-text`, label `overflow-wrap: anywhere`; the selected one (`aria-selected="true"`) at 600 in `--sr-accent` with a trailing lucide `Check` 13px / 2.5 in `--sr-accent` (a non-color cue beside the weight); the active one (`aria-activedescendant`) on `--sr-surface-subtle` with a 2px inset `--sr-accent` outline; hover `--sr-surface-subtle` inside `@media (hover: hover)`. With a query that matches nothing, the Everywhere row stays and one line "No region matches this search." (`.sr-lfl-region-empty`, 0.75rem `--sr-text-muted`) follows it.
   - **Disabled (FR-08):** the input and the chevron take native `disabled`, the field `.is-disabled` (`--sr-surface-subtle` fill, `--sr-border` edge, `--sr-text-disabled` glyph, text and chevron, `cursor: not-allowed`), the value "Everywhere". Nothing needs reading at the control, so native `disabled` rather than `aria-disabled` (ui.md).
2. `.sr-pill-sep.sr-pill-sep--spaced`.
3. `ToggleSwitch` "Include Escapees", `ToggleSwitch` "Include Exotics" (unchanged).
4. `.sr-pill-sep.sr-pill-sep--spaced`, the "Media" label and the three pills (unchanged).

At 200% text on a 1100px panel the row wraps to Region, then the switches, then Media, each on its own line; nothing else changes.

### The control strip (phone tier, 640px and under)

Inside the established tier block, scoped to the feature's classes:

- `.sr-lfl-region-row` (the `display: contents` wrapper around the label and the control on desktop) becomes `display: flex; align-items: center; flex-wrap: wrap; gap: 6px; flex: 1 1 100%; min-width: 0`, so the label and the field take the first line whole; `.sr-lfl-region` takes `flex: 1 1 12rem; max-width: none; min-width: 0`: at 100% text the field sits beside the label, and at 200%, where 12rem no longer fits beside it in 272px, it drops to its own full line under the label instead of squeezing to an ellipsis (measured in the mockup).
- `.sr-lfl-region-field { min-height: 2.75rem; padding-right: 0 }`, `.sr-lfl-region-chev { width: 2.75rem; height: 2.75rem }`, `.sr-lfl-region-opt { min-height: 2.75rem }`, `.sr-lfl-region-list { max-height: 18rem }`. The `.sr-ctl-row` floor already gives the input 16px (no iOS focus zoom) and the label its ratio.
- The switches and pills wrap beneath as they do today. Measured in Chromium in the mockup: no horizontal overflow of the frame at 320px at 100% or 200% with the list closed or open.

### The lead block under a region

`countSentenceParts` returns `{ count, before, region, after }`; the tab renders `<b>{count}</b>{before}<span className="sr-lfl-count-region">{region}</span>{after}` with the label as a text child (never markup), and omits the span when `region` is null so the unfiltered sentence is byte-identical to today's. `.sr-lfl-count-region { font-weight: 600; color: var(--sr-text) }`. The `.sr-only` live region carries the plain joined sentence in its sequence-keyed child. The status line is unchanged.

Sentences (FR-19 defaults, kept; the label is the choice's `regionLabel`):
- No format: "184 species in Marin, CA, newest first by the date of your first sighting there."
- One format: "64 species with a photo in Marin, CA, newest first by the date of your first photo there."
- Two or three: "N species with a photo and audio in Marin, CA, newest first by the date each had both there." / "... all three there."
- Empty (FR-20): "No countable species in Marin, CA yet." / "No species matches this selection in Marin, CA yet."

### The rows under a region

Unchanged columns and registers. The date, time, checklist mark and place are the in-region first's (or, under media buttons, the in-region first asset's), so the place column reads the region's own places down the list. The media presence cell stays global (FR-12). Positions renumber within the selection as today.

### Returning with a saved region

The control opens showing the saved region selected and the list already narrowed; no banner, no sentence. A saved region that is not in the loaded backup opens on Everywhere silently.

## Component Usage

- `components/lifeLists/LifeListsRegionPicker.tsx` (new, its own component as `TargetsCountyPicker` is its own): the `<input role="combobox">` is a native control; the chevron is `Button`; options are `div role="option"` with no tabIndex and no per-option handler; `useId()` prefixes every id (`${uid}-region-list`, `${uid}-region-opt-${i}` over the flattened shown list, `${uid}-region-grp-${level}`); lucide `Search`, `ChevronDown`, `Check`, each with its own class.
- `LifeListsControls` gains the Region slot first; `ToggleSwitch`, the Media `Button` pills and `.sr-pill-sep` are unchanged.
- `SectionCard` takes `style={{ overflow: 'visible' }}` on this tab and `.sr-lfl-controls` adds `border-radius: 12px 12px 0 0` (D-02).

## Design Tokens Applied

`--sr-surface`, `--sr-surface-subtle`, `--sr-surface-faint`, `--sr-text`, `--sr-text-muted`, `--sr-text-disabled` (disabled control only), `--sr-border`, `--sr-border-subtle`, `--sr-border-input`, `--sr-accent`, `--sr-card-shadow`; the focus halo is the global input ring's `rgba(45,134,83,0.12)`. Type: 0.75rem/600 field, 0.8125rem options, 0.625rem/700 uppercase group headings, 0.6875rem tag. Both themes verified in the mockup.

## Interaction Notes

- Focus or ArrowDown on the input, or the chevron, opens the list with the query cleared and the active option on the current selection (Everywhere when none), scrolled into view within the listbox only (never `scrollIntoView` on the option, which also scrolls the page when the list runs past the viewport). Typing filters by `choice.label` (case-insensitive substring, the schema's S14), keeps Everywhere, and activates the first match. ArrowUp/Down move, Home/End jump, Enter commits the active option (or the first match), Escape closes and is consumed only while open (`stopPropagation`), Tab closes, a pointer-down outside closes; an option is chosen on `mousedown` with `preventDefault` so focus never leaves the input.
- Choosing is a control press (FR-09): the tab re-derives, paging resets, the live region re-keys, added rows get the entrance, and focus stays on the input with the list closed; the next focus, ArrowDown or chevron opens it again. Choosing the already-selected region is a no-op press.
- The listbox closes on a choice before the tab re-renders, so the overlay never flashes over the new list.
- Disabled state (no choice in the backup): native `disabled` on input and chevron, value "Everywhere", the list unfiltered.
- Accessible name of the input is the visible "Region" label; `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-haspopup="listbox"`, `aria-activedescendant` only while open with an active option.

## Motion Spec

- Listbox open: scaleY 0.92 to 1 with opacity, `cubic-bezier(0.2, 0, 0, 1)`, 140ms, `transform-origin: top left` (the field's own corner); close instant; reduced motion: the global block (instant). CSS keyframe `sr-lfl-list-in`.
- Chevron: `transform: rotate(180deg)` over 140ms ease-out while open; reduced motion instant. CSS.
- Field focus: border and halo 120ms ease-out; reduced motion instant. CSS.
- Option hover and chevron hover: background 120ms ease-out inside `@media (hover: hover)`. CSS.
- Rows a region change adds: the shipped 180ms `sr-lfl-row-in` from 4px above, `transform-origin: top center`; re-sort instant; reduced motion instant. CSS.
- No motion on the count sentence or the switches beyond what ships.

## Content Notes

Plain and short, American spelling, no em dashes. Constants for `lifeListsCopy.ts`: `REGION_CONTROL_LABEL` "Region"; `EVERYWHERE_LABEL` "Everywhere"; `REGION_GROUP_LABELS` { country: "Countries", state: "States and provinces", county: "Counties" }; `REGION_LIST_LABEL` "Regions in your backup"; `REGION_CHEVRON_LABEL` "Show regions"; `REGION_NO_MATCH` "No region matches this search."; `REGION_PLACEHOLDER` "Type a country, state, or county". Labels come from the choice (FR-04): the English name for a country, `regionName` for a state, `placeOf` for a county; a Mexican state reads "MX-BCS" and has no county, as the backup has it.

**Country names (approved change, 2026-11-09):** a country is listed, shown in the field and named in the sentence by its English name ("United States", "Canada", "Mexico"), never by the backup's code, so "48 species in Canada, newest first ...". The names come from the engine's own locale data, `Intl.DisplayNames(['en'], { type: 'region' })`, resolved offline with no table shipped and no request made; where the engine has no name for a code (or `Intl.DisplayNames` is absent) the code itself is the label, which is the only case a code ever reaches the control or a sentence. The Countries group is ordered by that name. A country's row shows the name only; the code earns no secondary slot, because a birder reads "Canada", never "CA", and the code would only reintroduce the state-code confusion the name removes. `regionLabel` (schema 2.7) therefore resolves a country through this lookup once per distinct country choice at choice-build time, bounded by the two-letter shape of the code.

## Alternatives considered

(b) A level segmented control (Country / State / County) plus a picker: two controls for one choice, a second tab stop, and a mode the user has to set before typing; rejected for the single grouped combobox, whose headings name the level without a mode. A native `<select>` with three `<optgroup>`s: acceptable per the schema, rejected because a real backup holds hundreds of counties and a scroll-only select has no type-ahead on touch. A per-choice species count in the list: rejected (D-02). A code beside a country's name: rejected (see Content Notes). A "Marin, California" long form in the sentence: rejected, the label is the Checklists place form and the one the user already reads.
