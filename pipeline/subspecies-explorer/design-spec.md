# Design Spec - Subspecies Explorer

**Feature:** subspecies-explorer
**Stage:** 4 - The Designer
**Approved mockup:** `pipeline/subspecies-explorer/design.html` (signed off as-is, no changes requested)
**Design system:** established (`pipeline/design-system.md`); this design extends it with zero new tokens and zero deviations. All colors via existing `var(--sr-*)` tokens in both themes.

## Visual Direction

Quiet utility, exactly as the rest of Species Detail: the new pieces read as native residents of the shipped page, not as a new feature bolted on. The entry control matches the neutral weight of the toggle chips beside it and earns the accent only while active; the breakdown section uses the house SectionCard/SectionHead grammar and answers the feature's core question with one accented headline stat before any rows. Green continues to mean "actionable or active" and nothing else.

## Screens / Views

### Species Detail, merged mode, ready state (the only surface)

Two additions to the existing page. Nothing else moves (FR-21); both render only when the page is ready, data is loaded, and "Show subspecies" is off (FR-04, FR-19, FR-23).

#### 1. "Subspecies and forms" entry control + explorer list

Placed directly below the species selector combobox, above the county/date filter row (FR-04). Left-aligned inline control, not full width, matching the compact control grammar of the toolbar.

**Control (collapsed, at rest):**
- Button, min-height 34px, padding 0 12px 0 8px, radius 8px, border 1.5px `--sr-border`, background `--sr-surface`.
- Contents, left to right: a 22px accent icon tile (radius 6px, `--sr-accent-bg` background, `--sr-accent` Lucide ListTree icon at 12px, stroke 2.2), the label "Subspecies and forms" (0.75rem, weight 500, `--sr-text`), a muted count "5 species" (`--sr-text-muted`, weight 500; the count is the number of qualifying species), and a chevron-down (13px, `--sr-text-muted`).
- Hover: background `--sr-surface-subtle`.
- Open (aria-expanded true): background `--sr-accent-bg`, border `--sr-accent-border-strong`, label and count and chevron `--sr-accent`, icon tile background flips to `--sr-surface` (light) / `--sr-surface-subtle` (dark), chevron rotates 180deg. This mirrors the county select's active-filter treatment: accent only while active.

**Explorer panel (expanded):**
- 8px below the control. Border 1px `--sr-border`, radius 10px, background `--sr-surface-faint` (the design system's expanded-panel surface), overflow hidden.
- Header line: padding 10px 14px, 0.71875rem `--sr-text-muted`, bottom border `--sr-border-subtle`. Copy (exact): "Every species in your loaded data with at least one subspecies or form noted. Shares reflect your whole backup, not the current filter." This is the FR-04 "subspecies and forms" descriptive copy and the FR-08 honesty note in one line.
- List: plain `<ul>`, rows separated by 1px `--sr-border-subtle` top borders.
- Each row is one full-width button, text-left, padding 10px 14px:
  - Line 1: species name (0.84375rem, weight 600, `--sr-text`, wraps with overflow-wrap anywhere) with a right-aligned muted form count ("3 forms" / "1 form", 0.6875rem, `--sr-text-muted`, tabular numerals).
  - Line 2: the forms, wrapped inline, 0.75rem `--sr-text-muted`, line-height 1.6. Each item is the full reported form name (FR-17, via BirdName) followed by its percentage in weight 600 tabular numerals; items separated by a middot in `--sr-text-disabled`. Forms ordered by share descending, ties alphabetical (FR-05).
  - Hover: background `--sr-surface-subtle`. Currently selected species: `aria-current="true"`, background `--sr-accent-bg`, name in `--sr-accent`.
- Species ordered as the selector orders them: taxonomic when taxonomy order is available, alphabetical otherwise, restricted to qualifying species (FR-05, FR-03).
- Collapsed by default on every visit, open state never persisted (FR-06).
- Empty explorer (FR-07): the control still renders; the panel shows the honest message that the loaded data contains no subspecies or form entries, in the panel-header style (muted single line). Not demonstrated in the mockup but the treatment is the panel header alone with that copy.

#### 2. "Subspecies and Forms" breakdown section

A full-width SectionCard immediately after the Sightings/Media two-column row, before Graph Options (FR-18's "immediately after the Sightings section", resolved to full width because Sightings shares its grid row with Media; on the stacked phone tier it follows Media). SectionHead: 28px accent-bg icon tile, Lucide ListTree at 14px stroke 2.2 in `--sr-accent`, title "Subspecies and Forms" (0.8125rem, weight 600). Body padding 16px 18px (16px sides on phone tier). The section is always present for a selected species in merged mode, never silently absent (FR-15).

**Headline stats row** (flex, 28px gap, wrapping):
- "REPORTS" stat: StatLabel micro-caps (0.6875rem, 600, uppercase, 0.07em tracking, `--sr-text-muted`) over the FR-11 total in 1.25rem weight 700, -0.02em, `--sr-text`, tabular numerals.
- "FORM NOTED" stat: same label treatment over the summed form-row percentage in 1.25rem weight 700 `--sr-accent`, with micro-sub "of your reports" (0.6875rem `--sr-text-muted`). This value equals the sum of the displayed form-row percentages (66.6% for the junco demo; 100% for a form-only species), so it is always consistent with the rows below it.

**Rows list** (plain `<ul>`, 14px above, rows split by 1px `--sr-border-subtle` top borders, 9-10px vertical padding):
- One row per countable form, count descending then alphabetical. Row line: form name as the full reported name through BirdName (0.84375rem, weight 500, `--sr-text`, flex 1, min-width 0, wraps), then right-aligned count with unit ("214 reports", 0.78125rem `--sr-text-muted`, tabular) and percentage (0.84375rem, weight 700, `--sr-text`, tabular, min-width 3.2rem, right-aligned). Baseline-aligned flex with 10px gaps.
- Under each row line, a share bar: 3px tall, radius 2px, 6px top margin, track `--sr-border`, fill `--sr-accent` at the row's percentage width. Same grammar as the Sightings Frequency bar. Bars are reinforcement only; every value is present as text (NFR-03).
- "No form noted" row: pinned last, present only when species-level reports exist in the current view (FR-10). Label is display copy in `--sr-text-muted` weight 500, never a BirdName. Same count/percentage columns; its bar fill is `--sr-gray-400` so plain reports read as a different kind from forms at a glance, without relying on color alone.

**Ledger footnote (FR-13):** rendered only when the non-countable count for the current view is nonzero. 12px above margin, 0.71875rem `--sr-text-muted`, line-height 1.55, max-width 62ch. Copy pattern (exact, from the approved mockup): "3 reports use names that are not countable subspecies or forms, such as hybrids or slashes. The Sightings total of 425 includes them; this breakdown does not." The numbers are live; the sentence shape is fixed. This makes the schema.md identity (breakdown total + nonCountableCount = Sightings Checklists figure) visible instead of a silent discrepancy.

**Empty state (FR-15):** a single line in the body, 0.8125rem `--sr-text-muted`: "No subspecies or form detail is recorded for this species." No stats row, no list. The FR-14 filtered-to-zero state uses the page's existing filtered-to-nothing reading, distinct from this copy.

**Demonstrated data states and their exact math rules** (all four are in the mockup and all are contract, per FR-12):
1. Multi-form with residue absorption (Dark-eyed Junco): Oregon 214 = 50.8%, Slate-colored 58 = 13.7%, Oregon x Slate-colored intergrade 9 = 2.1%, No form noted 141 = 33.4%. Raw rounding gives 50.7 + 13.7 + 2.1 + 33.4 = 99.9; the +0.1 residue is absorbed by the largest row (Oregon shows 50.8), so displayed values sum to exactly 100.0. Total 422; non-countable ledger 3; Sightings shows 425.
2. Form-only species (Fox Sparrow, FR-16): single Sooty row, 111 reports, displayed as flat "100%" (no decimal, per FR-12's single-row rule). No "No form noted" row. Headline "Form noted 100%".
3. Single minor form (White-crowned Sparrow): Gambel's 12 = 8.2%, No form noted 134 = 91.8%. A nonzero row never displays below 0.1%.
4. Empty state (Varied Thrush): no qualifying entries anywhere in the backup; the single-line FR-15 state renders and the species is absent from the explorer list.

Percentages always display to one decimal (except a single row at 100%), computed from exact counts, summing to exactly 100.0 with residue absorbed by the largest row. Counts always sum exactly to the displayed total.

## Component Usage

- **SectionCard + SectionHead** (`components/speciesDetail/ui.tsx`): the breakdown section, unchanged (radius 12, 1px `--sr-border`, `--sr-card-shadow`; 28px accent-bg head tile).
- **StatLabel** (same module): both headline stat labels.
- **BirdName**: every species name in the explorer list and every form name in both the list and the breakdown rows (FR-17, NFR-06). The "No form noted" label and the ledger footnote are display copy, rendered as plain text per the convention's form-control exception.
- **Lucide ListTree** (12px in the control tile, 14px in the SectionHead, stroke 2.2): the one new icon; it marks both the control and the section so they read as one feature.
- **Chevron-down** (Lucide, 13px) on the control, rotating 180deg when open.
- The entry control is a new small component following the ToggleSwitch boxed-chip grammar (30-34px height, 1.5px border, radius 6-8, 0.75rem weight 500); it is not a ToggleSwitch (it is a disclosure, aria-expanded, not a switch).
- No new libraries, no new tokens, no modal anywhere.

## Design Tokens Applied

All existing, both themes, no additions:
- Surfaces: `--sr-surface` (control, cards), `--sr-surface-faint` (explorer panel), `--sr-surface-subtle` (hovers, open-state tile in dark), `--sr-bg` (page).
- Text: `--sr-text` (names, counts' percentages, labels), `--sr-text-muted` (secondary text, "No form noted", footnote, panel header), `--sr-text-disabled` (middot separators).
- Borders: `--sr-border` (control, panel, bar tracks), `--sr-border-subtle` (row separators), `--sr-accent-border-strong` (open control).
- Accent: `--sr-accent` (icons, open-state text, "Form noted" stat, form bars, selected-row name), `--sr-accent-bg` (icon tiles, open control, selected explorer row).
- `--sr-gray-400` (the "No form noted" bar fill; already used by ToggleSwitch off-track in both themes).
- Type: the house stack (`--font-sans`, Inter/system-ui). Sizes used: 1.25rem/700 stats, 0.84375rem names, 0.8125rem body/empty state, 0.78125rem counts, 0.75rem control label and form lines, 0.71875rem footnote and panel header, 0.6875rem micro-caps and row counts. Tabular numerals on every count and percentage.

## Interaction Notes

- **Control**: button with `aria-expanded` + `aria-controls`, explicit `tabIndex={0}` per house rule. Click toggles the panel. Escape closes and returns focus to the control. Open state is ephemeral component state, collapsed on every visit (FR-06), never persisted.
- **Explorer rows**: whole row is one button. Activating it calls the page's existing `selectSpecies(name)` (the same code path as the selector, FR-06), closes the panel, and brings the breakdown section into view (scrollIntoView, block nearest; smooth only when motion is allowed). Move focus to the breakdown section container (tabindex -1) so keyboard and AT users land where the answer is. The selected species row carries `aria-current="true"` when the list is reopened.
- **Breakdown**: no interactive elements of its own in v1 (no copy/export per Out of Scope). Form names render through BirdName in its non-link form.
- **Keyboard**: control and every row reachable and operable by keyboard; global focus-visible ring (2px `--sr-accent`, offset 2). Expanded/collapsed state announced via aria-expanded (NFR-03).
- **Visibility gating**: both pieces render only in ready state, merged mode (FR-19, FR-23). Neither the county/date filter nor "Show all forms" affects the explorer list (FR-08, FR-20); the breakdown follows the page filters exactly as its sibling sections do, by consuming the existing `speciesObs` memo (FR-14, schema.md Contract B).
- **320px / 200% text scale**: the two-col grid and stat grid stack; card body padding trims to 16px; names wrap (overflow-wrap anywhere) while counts and percentages stay right-aligned on the first line; no horizontal overflow anywhere. Verified in the mockup's phone preview in both themes.

## Motion Spec

- Explorer panel open: opacity 0 to 1 + translateY(-4px) + scale(0.985) to rest, ease-out, 200ms, transform-origin top left (origin-aware from the control above), reduced-motion: instant, CSS keyframes.
- Control chevron rotate (0 to 180deg): ease-out, 200ms, center origin, reduced-motion: instant, CSS transition.
- Control open/hover background and border: ease-out, 140ms, reduced-motion: instant, CSS transition.
- Explorer and combobox row hover background: ease-out, 120ms, reduced-motion: instant, CSS transition.
- Breakdown share bars: width 0 to the row's percentage on section render and on species/filter change (animate what changed), ease-out, 240ms, left origin, reduced-motion: bars render at final width instantly, CSS transition.
- Scroll to breakdown after list pick: smooth scroll, reduced-motion: auto (instant) scroll, native scrollIntoView.
- Nothing else moves. No entrance animation on static sections, no staggering, no pulsing. All motion under 300ms ease-out per the doctrine; the stack is CSS transitions/keyframes only (no Motion library needed for this feature).

## Content Notes

Tone: informative, never promotional; plain statements of what the data holds. No em dash (U+2014) anywhere (NFR-05). Exact approved copy:

- Control label: "Subspecies and forms" (sentence case, matching "Show subspecies" beside it; contains the FR-04 phrase). Count suffix: "N species".
- Panel header: "Every species in your loaded data with at least one subspecies or form noted. Shares reflect your whole backup, not the current filter."
- Section title: "Subspecies and Forms" (title case, matching "Graph Options").
- Stat labels: "Reports" and "Form noted"; stat sub: "of your reports".
- Plain-report row label: "No form noted".
- Row count units: "N reports" ("1 report" singular).
- Ledger footnote pattern: "N reports use names that are not countable subspecies or forms, such as hybrids or slashes. The Sightings total of T includes them; this breakdown does not."
- Empty state: "No subspecies or form detail is recorded for this species."
- Empty explorer (FR-07): a plain statement that the loaded data contains no subspecies or form entries.
- All bird and form names are the full reported names, never truncated or reworded (FR-17).
