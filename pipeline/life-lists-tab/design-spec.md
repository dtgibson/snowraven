# Design Spec: Life Lists

**Feature:** life-lists-tab
**Stage:** 4, The Designer
**Mockup:** `pipeline/life-lists-tab/design.html` (self-contained; the review bar at the top switches theme, viewport, text size, the per-row media glyph treatment, and every file and provenance state)
**Revision 1 (2026-11-06):** list-position number column, `BirdName` with the scientific name and the eBird / Birds of the World marks, and a passive per-row media cell (decisions D-10 to D-13).
**Design system:** `pipeline/design-system.md` applies in full; this feature extends it and mints nothing. Deviations and choices the user may redirect are in `decisions.md`.

## Visual Direction

Quiet utility, the Checklists tab's sibling. The tab is a chronological ledger of one quiet card: a faint control strip, a one-line caption that states the count and the rule, and rows that read position, then species over its scientific name, then when, then where, with a quiet media-presence cell at the trailing edge. The only colour is the accent, spent on the three things that act (the switch and pill on-states, the species name on hover, the checklist mark; the two species-link marks ride the shared component at its own opacity step). Nothing is decorated; the list is the focal point and the newest species is the first thing the eye lands on.

## Screens / Views

### The tab, ready (desktop and tablet, list wider than 40em)

Layout, top to bottom, all inside the `.sr-panel`:

1. **House tab header.** 30px `--sr-accent-bg` tile with lucide `ListChecks` (15px, stroke 2.2), `h2` "Life Lists" (1.125rem/700), one muted description line (0.8125rem `--sr-text-muted`): "Every species you've recorded, newest first, with the checklist and place of your first sighting, or of your first photo, audio, or video."
2. **One `SectionCard`** (`--sr-surface`, 1px `--sr-border`, radius 12, `--sr-card-shadow`, `overflow: hidden`) holding everything below.
3. **Controls strip** (`.sr-lfl-controls`, `--sr-surface-faint`, `padding: 12px 18px`, 1px `--sr-border-subtle` bottom rule, class `sr-ctl-row` so the phone floor reaches every control). One wrapping flex row, `gap: 6px`:
   - `ToggleSwitch` "Include Escapees", `ToggleSwitch` "Include Exotics" (the boxed `.sr-toggle` register, labels visible, off by default).
   - `.sr-pill-sep.sr-pill-sep--spaced` (hidden on the phone tier by the existing rule).
   - Uppercase label "Media" in the section-label register (0.6875rem/700, letter-spacing 0.06em, `--sr-text-muted`), class `sr-ctl-label` with `--sr-label-ratio: var(--sr-label-optical)`, and `id` for the group's `aria-labelledby`.
   - Three `Button`s with `className="sr-pill"` and `aria-pressed`: Photo, Audio, Video, in that fixed order, each with its lucide glyph at 12px / stroke 2.2 (`Camera`, `Mic`, `Video`, the Multimedia tab's set). Wrapped in `role="group" aria-labelledby={mediaLabelId}` through a `display: contents` span (`.sr-lfl-media-group`), so the group adds no box.
   - When the ML export is absent or unreadable: the three pills take `aria-disabled="true"` (the register's inert look: `--sr-surface-subtle` fill, `--sr-text-disabled`, not-allowed cursor, no hover), each `aria-describedby` the sentence's index-keyed id, and the FR-27 sentence renders under the row as `.sr-lfl-ml-note` (0.75rem `--sr-text-muted`, `max-width: 60ch`). The buttons stay focusable (ui.md's not-operable-but-readable rule); any pressed state is cleared when the export goes away.
4. **Lead block** (`.sr-lfl-lead`, `padding: 13px 18px 11px`, bottom rule): the count sentence (FR-33) as a `<p>` at 0.8125rem `--sr-text-muted` with N in `--sr-text` 700 tabular, `tabIndex={-1}` (the paging focus anchor, schema 6.2), then an `.sr-only` `role="status" aria-live="polite"` twin carrying the same sentence in a sequence-keyed child, then the status sentence (FR-20) at 0.71875rem `--sr-text-gray`.
5. **Rows** (`ol.sr-lfl-list`, a size container; each `li.sr-lfl-row` a seven-track grid): `2.5rem minmax(0, 1fr) 5.4rem 4rem 1.5rem minmax(0, 32%) max(46px, 2.5rem)`, areas `num name date time link place media`, `column-gap: 14px`, `align-items: start`, `padding: 11px 18px 12px`, rows divided by 1px `--sr-border-subtle`, last row no rule. Every track but the name and place is a fixed width so the columns align down the list at every text scale (each row is its own grid); the grid only renders above 40em of list width, where the widest date fits its track. Every cell aligns to the row's FIRST line (the common name); the scientific name hangs beneath it alone, so a row is two lines tall on desktop.
   - **num:** the species' position on the list currently shown, counted from the oldest (1, at the bottom) to the newest (N, the count sentence's figure, at the top); the position in the WHOLE list, not the page, so page two continues from 221 downward, and a media selection renumbers for that list. `.sr-lfl-num`: 0.75rem `--sr-text-muted`, right-aligned, tabular figures, nowrap, `aria-hidden`; the accessible form is an `.sr-only` "N of M." prefix inside the name cell, so a screen reader hears the position with the name. Four digits at 200% (about 58px) fit the 2.5rem track (80px) without moving the name.
   - **name:** `<BirdName commonName scientificName taxonCode={codeFor(commonName)} hasEntry onOpenSpecies showSci size="md" />`, exactly as Checklists renders its species-comment lead: the common name (0.84375rem/500 `--sr-text`, accent and underline on hover and focus), the `SpeciesLinks` pair beside it (two 14px favicon slots, eBird then Birds of the World, each an opener at opacity 0.75 lifting to 1 on hover and focus, the lucide `Globe` / `SquareLibrary` fallback revealed in the same slot when a favicon fails), and the scientific name stacked beneath in the shared `.sr-birdname-sci` (0.71875rem italic `--sr-text-gray`). The cell overrides the shared `nowrap` on the scientific name (`white-space: normal; overflow-wrap: anywhere`) and makes the `BirdName` box full width, the phone-tier BirdName rule applied at every width, so a long name wraps instead of ellipsizing. Codes come from the same `/taxonomy/codes` batch Checklists runs (D-11).
   - **date:** `formatDate(...)`, 0.75rem/600 `--sr-text`, nowrap, tabular numerals.
   - **time:** 0.75rem `--sr-text-muted`, tabular; a blank or unparseable time is a single hyphen-minus in `--sr-text-disabled`.
   - **link:** `<ChecklistLink submissionId compact />` inside a 1.5rem square box (`.sr-lfl-cl`: radius 6, `--sr-accent`, transparent at rest, `--sr-accent-bg` fill on hover and focus-visible, 120ms ease-out; focus ring with `outline-offset: 1px; box-shadow: none`, written after the global ring block). An id that fails `isValidChecklistId` renders a hyphen-minus in the same box in `--sr-text-disabled` with an `.sr-only` "No checklist".
   - **place:** two lines, `.sr-lfl-locname` (0.75rem/500 `--sr-text-muted`, `overflow-wrap: anywhere`) over `.sr-lfl-county` (0.71875rem `--sr-text-gray`): "County, ST" for a first-sighting row, the ML county alone for a media row, the line omitted when both are empty. Plain text, never `HotspotLink`.
   - **media:** `.sr-lfl-media`, a passive cell (never a link or a button) at the trailing edge, `role="img"` with an `aria-label` naming the formats the species has ("Media: photo, audio") or "No media". The shipped form is the **Quiet** treatment (D-12): the three media glyphs in the filter's own order and set (`Camera`, `Mic`, `Video`, 12px, stroke 2.2) in three fixed slots, `gap: 5px`; a format the species has is drawn in `--sr-text`, one it lacks in `--sr-border-medium` as a faint placeholder that keeps the slot, so position carries identity and ink carries presence; no label, no accent. The mockup's review bar also shows **Count** ("N of 3" in 0.6875rem `--sr-text-muted` tabular, nothing at zero) and **Off** (the track is dropped: `[data-media="off"]` restores the six-track grid), for the user to judge; the Engineer builds only the chosen one, with no setting.
6. **Paging** (`.sr-lfl-paging`, the Weather backlog row verbatim): "Show next 100" (36px, radius 8, 1px `--sr-border-medium`, `--sr-surface`, 0.8125rem/600 `--sr-text`), "Show all (N)" (same box, transparent, `--sr-accent`, `--sr-accent-bg` on hover), and "Showing 1–N" (0.71875rem `--sr-text-muted`). Rendered only while more rows remain.
7. **Empty list:** `.sr-lfl-empty`, one centred sentence (FR-34) at 0.8125rem `--sr-text-muted`, `padding: 28px 18px`, in place of the rows and the paging row.

### The tab, phone tier (<=640px) and the stacked form (list under 40em)

Both arrive at one stacked card per row, by two routes that must agree: the established `<=640px` block for the phone, and `@container (max-width: 40em)` on `.sr-lfl-list` so a wide window at 200% text stacks too (the design system's date-place-link row rule).

- Row grid: `1.9rem minmax(0, 1fr) max(44px, 1.5rem)`, areas `"num name link" "num meta link" "num place media"` (with the media cell off: `"num place place"`), `column-gap: 8px`. The number sits at the card's leading edge, top-aligned with the common name, in a 1.9rem track (four digits at 200% fit its 61px). The date and time wrapper (`.sr-lfl-meta`, `display: contents` on desktop) becomes a centre-aligned wrapping flex line, `gap: 2px 8px`. The right rail is one column: the link box (`max(44px, 1.5rem)` square, never under the 44px touch floor, and deliberately NOT 2.75rem, which doubles to 88px at 200% and starved the name column to 113px) centred against the name and meta lines, and the media cell beneath it beside the place lines, `gap: 4px` so three 12px glyphs fit the 44px rail, right-aligned. The place lines sit below at the column's full width.
- Phone-only: panel padding `20px 12px 16px`; strip, lead, empty, paging and rows take 12px side padding; `.sr-pill-sep` hides; every control in the strip takes the `.sr-ctl-row` floor (`max(16px, own rem)`), the Media label its `.sr-ctl-label` ratio; `.sr-touch-target` raises the switches and pills to 2.75rem with the switch's inline `height: 30` released (`.sr-lfl-controls .sr-toggle { height: auto; white-space: normal }`, the Settings acknowledgments precedent) and the pills allowed to wrap; the two paging buttons take `min-height: 2.75rem`.
- Measured in Chromium and WebKit at 320px, 100% and 200% text, with the ML-absent strip and in all three media treatments: zero text-ink overflow past the frame and no horizontal scroll (the probe was shown going red at 169px against a `nowrap` mutant before its zero was believed).

### Setup, error and loading

- **No backup:** the shared `SetupRequired` with title "eBird Backup Required", body "The Life Lists tab loads automatically from your stored eBird backup. You haven't saved one yet.", `EBIRD_BACKUP_STEPS`, Go to Settings. The house tab header stays above it.
- **Unreadable backup:** the shared `TabLoadErrorAlert` (`panel` variant) with `EBIRD_BACKUP_LOAD_ERROR`, mounted at fragment index 0 of every branch so the region exists before its text.
- **Loading:** the shared spinner in `role="status" aria-label="Loading your life list"`.

## Component Usage

| Need | Component / register |
|---|---|
| Tab header | the house header (tile + h2 + p), as Checklists draws it |
| Card | `SectionCard` (`speciesDetail/ui.tsx`) |
| Switches | `ToggleSwitch` boxed (`.sr-toggle`), visible labels |
| Media buttons | `Button` + `className="sr-pill"` + `aria-pressed`; `aria-disabled` + `aria-describedby` when inert |
| Species name | `BirdName` size `md`, `showSci`, `taxonCode` from the Checklists-shaped `/taxonomy/codes` batch, so `SpeciesLinks` draws the two marks |
| Media presence | `.sr-lfl-media`, a passive `role="img"` span of three lucide glyphs (Quiet) |
| Checklist mark | `ChecklistLink compact` in the `.sr-lfl-cl` box |
| Paging | `Button` pair in the Weather backlog's inline register, plus the "Showing" span |
| Setup, error, loading | `SetupRequired`, `TabLoadErrorAlert`, the shared spinner |
| Icons | lucide `ListChecks` (tab), `Camera` / `Mic` / `Video` (pills and the media cell), `ExternalLink` (via ChecklistLink), `Globe` / `SquareLibrary` (via SpeciesLinks' fallback) |

New classes, all prefixed `.sr-lfl-` (`.sr-ll-` belongs to the Multimedia tab): `-tab`, `-head`, `-head-tile`, `-card`, `-controls`, `-ctl-row`, `-label`, `-pill`, `-media-group`, `-ml-note`, `-lead`, `-count`, `-status`, `-list`, `-row`, `-num`, `-name`, `-meta`, `-media`, `-media-count`, `-date`, `-time`, `-link`, `-cl`, `-dash`, `-place`, `-locname`, `-county`, `-empty`, `-paging`, `-next`, `-all`, `-showing`. Layout lives in these classes, never in inline styles; colours and paddings may stay inline as tokens where the sibling tabs do the same.

## Design Tokens Applied

Surfaces `--sr-surface` (card), `--sr-surface-faint` (strip), `--sr-surface-subtle` (hover and inert fills); text `--sr-text` (names, dates, N, a media glyph the species has), `--sr-text-muted` (caption, position numbers, time, location name, labels), `--sr-text-gray` (status line, scientific names, county), `--sr-text-disabled` (dashes, inert pills only); borders `--sr-border`, `--sr-border-subtle` (row rules), `--sr-border-medium` (Show next, hover outlines, a media glyph the species lacks); accent `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border` (on-states, the link mark, Show all); `--sr-gray-400` and `--sr-switch-thumb` / `--sr-switch-thumb-shadow` through `ToggleSwitch`; `--sr-card-shadow`. Type: the app's `--font-sans` stack at the design system's three roles (headline 1.125rem/700, body 0.84375rem and 0.8125rem, label 0.75rem and 0.71875rem, section label 0.6875rem/700 uppercase). No new token.

## Interaction Notes

- Switch and pill presses re-derive the list, reset paging to 100, and keep focus on the pressed control (re-render in place, never a remount that drops focus to `<body>`).
- The count sentence updates in the same commit as the rows; the live-region twin carries one sequence-keyed child so repeated identical sentences still announce; it updates once per settled selection.
- With the exotic status check unfinished (FR-20's first sentence) the switches stay operable: a partially consulted export can still confirm some species, so they are never disabled.
- "Show next 100" stays mounted and focused while more remain; when either control reveals the last row the paging row unmounts and focus moves to the count sentence (`tabIndex={-1}`), per schema 6.2.
- Audio and Video together is a selection the fixture cannot satisfy, so the second FR-34 sentence is reachable live in the mockup.
- Pressed pills and checked switches are visible without colour: weight 600 plus the accent fill on pills; the knob position on switches.
- The position number is derived at render from the sorted list (`rows.length - index`) and never stored; the media cell reads the species' first-asset record and is identical whatever the selection (it reports what the species HAS, not what the current list is dated by).
- The species-link marks are the shared `SpeciesLinks` openers: each is its own tab stop with the "View {name} on {destination} (opens in a new tab)" name; the media cell adds no tab stop.

## Motion Spec

- Switch track and knob: `background 180ms ease-out`, `left 180ms ease-out` (the shipped `ToggleSwitch` values); reduced motion collapses via the global block; CSS.
- Pills, switches, Show next, Show all, link box: colour fades `120ms ease-out` from the registers; reduced motion via the global block; CSS.
- Rows ADDED by a switch or a media press: `.is-new`, opacity 0 and `translateY(-4px)` to rest, `180ms cubic-bezier(0.2, 0, 0, 1)`, origin top centre; existing rows re-sort instantly; nothing animates on first paint or on paging; reduced motion via the global block (animation collapses to its end state); CSS keyframe.
- BirdName hover and focus: colour and underline, instant (the shared rule); SpeciesLinks marks: opacity 0.75 to 1 on hover and focus, 120ms ease-out, no transform; CSS.
- No stagger, no scale, no entrance on the card or the strip.

## Content Notes

- The eight count sentences, the two status sentences, the two ML sentences and the two empty sentences are the PRD's verbatim (FR-20, FR-27, FR-33, FR-34), generated from the format manifest in `lib/lifeListsCopy.ts`; serial comma; no U+2014 anywhere.
- The tab description is one sentence in the house register: informative, no reassurance.
- Dates through the user's date-format preference; times in the 12-hour form; a missing value is a hyphen-minus, never a word.
- Species names are the normalized common names with the backup's scientific name beneath; locations are the backup's or the ML export's own strings, unaltered.
- The media cell's accessible name lists the formats present in the fixed order ("Media: photo, video"); with none, "No media".
