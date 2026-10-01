# Design Spec - Taxonomic Splits and Lumps

**Feature:** taxonomic-splits-lumps
**Stage:** 4 - The Designer
**Approved mockup:** `pipeline/taxonomic-splits-lumps/design.html` (approved after one round: the count-bar seam and the phone-tier connector gap closed, the kind glyph made direction-matched)
**Design system:** established (`pipeline/design-system.md`). This design extends it with zero new tokens. Two small deviations are logged in `decisions.md`: a hand-drawn direction glyph and a line-break opt-in on `<BirdName>`.
**Data contract:** `schema.md` sections 6 and 7 (`AffectedSpecies`, `EventView`, `EntryView`, `HistoryListEntry`, `coverage`, `filterActive`). Every string below that carries a count lives in `lib/taxonomyHistoryCopy.ts` (schema 7.4).

## Visual Direction

Quiet utility, exactly as the Subspecies Explorer before it: the two new pieces read as native residents of Species Detail, not as a feature bolted on. The entry control is the same chip as "Subspecies and forms" and sits beside it; the section is a house SectionCard whose body is one simple flow chart, before on the left, the change in the middle, after on the right. Green marks exactly one thing in the chart, the user's own species; everything else is ink, muted ink, and hairlines. Absence is a shape (a dashed outline) and a sentence, never a colour.

## Screens / Views

### Species Detail, merged mode, ready state (the only surface)

Two additions. Nothing else moves (FR-26); both render only when `mergeSubspecies && history !== null` (schema 7.1; FR-10, FR-24, FR-28).

#### 1. "Splits and lumps" control + list panel

**Placement.** In the same row as "Subspecies and forms", directly to its right, below the species selector and above the county/date filter row. The shipped `SubspeciesExplorerControl` wrapper becomes a wrapping flex row (`.sr-ctl-row`, `gap: 8px 10px`, `align-items: flex-start`) holding both controls; each control's panel opens below the row at full width. On the phone tier (`<=640px`) the row stacks the two controls full width, left-aligned.

**Control.** Byte-identical register to `.sr-ssx-toggle` (min-height 34, padding `0 12px 0 8px`, radius 8, 1.5px `--sr-border`, `--sr-surface`, 0.75rem/500 `--sr-text`, hover `--sr-surface-subtle`, open state `--sr-accent-bg` + `--sr-accent-border-strong` + `--sr-accent` text, tile flipping to `--sr-surface` light / `--sr-surface-subtle` dark, caret rotating 180deg). Contents: 22px accent tile with lucide `Split` at 12px stroke 2.2; label "Splits and lumps"; muted count "N species" (`speciesCountLabel`, same as the explorer); chevron-down 13px. Phone tier: the explorer's `flex-wrap: wrap; max-width: 100%; row-gap: 2px; padding 4px 0` containment applies (reuse the class, do not copy it).

**Panel (expanded).** The explorer panel register: 8px below the row, 1px `--sr-border`, radius 10, `--sr-surface-faint`, `overflow: hidden`, `transform-origin: top left`, the `sr-ssx-pop-in` entrance. Conditionally rendered, never CSS-collapsed (no `inert` owed). Panel id from `useId()`, wired through `aria-controls`.
- Head: padding `10px 14px`, 0.71875rem `--sr-text-muted`, line-height 1.5. Copy (exact): "Every species in your loaded data that eBird split or lumped in its 2023 to 2025 taxonomy updates. Pick one to see what changed, when, and where your reports went." The two years come from `coverage.earliest.year` / `coverage.latest.year`, never typed.
- List: plain `<ul>`, `--sr-border-subtle` top rules between rows. Each row is one full-width `Button`, padding `10px 14px`, flex baseline, gap 10, hover `--sr-surface-subtle`, `aria-current="true"` + `--sr-accent-bg` + accent name for the selected species.
  - Left: the species name as the backup names it, through `<BirdName>` in its non-link, favicon-less form (the whole row is one button; the explorer's comment about interactive-inside-interactive applies), 0.84375rem/600, `overflow-wrap: anywhere`.
  - Right (`margin-left: auto`, `flex-shrink: 0`): per event touching the species, most recent first (FR-11), one line: the direction glyph at 11px in `--sr-text-muted`, the kind word in 600 `--sr-text` ("Split" / "Lump"), a muted middot (`aria-hidden`), the update year. 0.6875rem, tabular numerals. A two-event species shows two such lines stacked.
- Order: `sortedSpeciesList` intersected with `index.affected` (schema 6.4), so the list follows the selector's taxonomic order.
- Zero affected (FR-13): the control stays with "0 species"; the panel shows only the head with this copy (exact): "None of the species in your loaded data was split or lumped in eBird's 2023 to 2025 taxonomy updates. A change made before 2023 is not recorded here."
- Pick: closes the panel, selects through the page's own path (`revealAndSelect`, escapee reveal included), then on the next frame `jumpTo(lineageRef, { block: 'nearest' })` and focus the section wrapper (FR-12). Escape closes the panel and returns focus to the control. Open state is component state, collapsed on every visit, never persisted.

#### 2. "Splits and Lumps" section

**Placement.** A full-width SectionCard immediately after Subspecies and Forms and before Graph Options, outside the `sightingsStats && (...)` fragment so it renders in every body state (schema 7.1, OQ-03). Wrapper `forwardRef` `div` with `tabIndex={-1}` (the focus target). SectionHead: 28px accent tile, lucide `Split` at 14px stroke 2.2, title "Splits and Lumps". Body padding `16px 18px` (`.sr-pad-x-trim` on the phone tier, 16px sides).

**Body order, top to bottom.**
1. Filter line (only while `filterActive`, FR-09, OQ-05): 0.71875rem `--sr-text-muted`, margin-bottom 12. Copy (exact): "The figures cover every checklist in your export, not the current county or date filter."
2. Per event, earliest first (FR-15), the event block below. A second and later event is separated from the one above by a 1px `--sr-border-subtle` hairline with 22px above and 18px below (`.lin-event + .lin-event`), so a chained lineage reads as one column of dated steps.
3. Coverage line (every state, FR-20): margin-top 16, padding-top 12, 1px `--sr-border-subtle` top rule, 0.71875rem `--sr-text-muted`. Copy (exact, years from `coverage`): "Covers eBird's 2023 to 2025 taxonomy updates. A change made before 2023 is not recorded here." Zero-event asset: "No eBird taxonomy updates are covered in this build."

**Not-affected empty state (FR-21):** one line, 0.8125rem `--sr-text-muted`, then the coverage line. Copy (exact): "No split or lump is recorded for this species in the covered updates."

**The event block.**

- **Stale-export note** (only when `event.predates`, FR-19; a per-backup condition, so with an older backup every event of that update shows it at once): a quiet bordered note above the chart, never an error register. Flex, gap 9, padding `9px 12px`, margin-bottom 14, 1px `--sr-border`, radius 8, `--sr-surface-faint`, 0.75rem/1.5 `--sr-text`; lucide `Info` 14px `--sr-text-muted` aligned to the first line. Copy (exact): "**Your backup predates the October 2025 update**, so your reports still carry the earlier name. A fresh backup from eBird shows where they went." (month and year from the update label formatter; the bold span is weight 600).

- **The chart** (`aria-hidden="true"`; the text equivalent below carries it): a three-column grid `minmax(0,1fr) auto minmax(0,1fr)`, `align-items: center`, no column gap. Left column = before side, middle = rail, right = after side. Every connector is a 1px `--sr-border-medium` hairline drawn by pseudo-elements, so a node's own height decides the geometry and nothing is measured in JS.
  - **Side.** Column flex, gap 10, `min-width: 0`, `position: relative`. Before side has `padding-right: 18px`, after side `padding-left: 18px` (the stub lane). A side is `single` (one node) or `multi` (two or more).
  - **Node.** `position: relative`, 1px `--sr-border`, radius 8, `--sr-surface`, padding `10px 12px`, `min-width: 0`. No shadow (these are diagram nodes on the card, not cards in a card). Three variants, each carried by shape or words as well as colour:
    - *Your species* (`entry.speciesKey === selectedSpecies`): border `--sr-accent-border-strong`, fill `--sr-accent-bg`, marker row "Your species" (lucide `Check` 11px stroke 3, then the words) in `--sr-accent` micro-caps. The only accent in the chart.
    - *No reports* (`entry.count === 0`): dashed 1px `--sr-border-medium` border, transparent fill, name in `--sr-text-muted` at weight 500, marker row "No reports under this name" in `--sr-text-muted` micro-caps, no counts. (Approved wording: chosen over "Not in your data" so a lump's retired parents read honestly.)
    - *Slash* (an entry from `event.slashes`, always `count > 0` by contract): plain node, marker row "Reports eBird could not assign" in muted micro-caps.
  - **Node internals, top to bottom.** Name: 0.84375rem/600, line-height 1.3, `--sr-text`, `overflow-wrap: anywhere`, through `<BirdName>`; an entry with `count > 0 && speciesKey !== null` that is not the selected species links through the page's own selection path (`hasEntry`, `onOpenSpecies`, `taxonCode={entry.code}`), rendered in ink with the BirdName hover (accent + underline); the selected species and every zero-count or slash entry render the bare name. Scientific name: 0.71875rem italic `--sr-text-gray`, line-height 1.3. Marker row (variants above): margin-top 6, 0.6875rem/600 uppercase 0.07em, inline-flex gap 4. Count: margin-top 6, 0.84375rem/700 `--sr-text`, tabular, `reportCountLabel` ("312 reports", "1 report"). Partition line: margin-top 1, 0.71875rem `--sr-text-muted`, flex-wrap, column gap 12: "**289** reassigned by eBird" and "**23** recorded since" (numbers 600 `--sr-text`, tabular). In the predates case the partition line is the single phrase "all dated before the update" and there is no bar (FR-19).
  - **Count bar** (`aria-hidden`, reinforcement only): margin-top 7, height 3, radius 2, `overflow: hidden`, ONE track filled `--sr-gray-400` (the reassigned share) with ONE right-aligned fill in `--sr-accent` whose width is `after / count` percent (the recorded-since share). Never two abutting fills: the approved fix for the hairline seam the first mockup showed. A node with `after === 0` is a plain gray bar.
  - **Stubs and spine.** Each node draws a stub (`::before`, 18px by 1px) toward the rail: on the before side at `right: -18px`, on the after side at `left: -18px`. On a single side the stub sits at `top: 50%`; on a multi side at `top: var(--lin-stub)` where `--lin-stub: calc(10px + 0.55rem)` (the node's padding plus half a 1.3 line of 0.84375rem text, so it tracks the text scale and lands on the name line). A multi side also draws a spine, one segment per node (`::after`, 1px wide, at the same 18px offset): `top: -10px; bottom: -10px` so adjacent segments overlap across the 10px gap; `:first-child` starts at `var(--lin-stub)`, `:last-child` ends at `calc(100% - var(--lin-stub))`, `:only-child` draws none.
  - **Rail.** Flex row, `align-items: center`, a 22px by 1px hairline before and after the badge. Because the grid centres each column and the spine spans from the first stub to the last, the rail always meets the spine.
  - **Badge.** Inline-flex, gap 6, min-height 28, padding `0 11px`, radius 14, 1px `--sr-border`, `--sr-surface-faint`, `white-space: nowrap`: the direction glyph at 13px in `--sr-text-muted`, the kind word at 700 `--sr-text`, the update label ("October 2025") in `--sr-text-muted`, 0.75rem.
  - **Direction glyph** (hand-drawn inline SVG, `viewBox 0 0 24 24`, `fill="none" stroke="currentColor" stroke-width 2.2`, round caps and joins, `aria-hidden`; the badge text carries the meaning): split = `M2 12h6` + `m8 12 7-6h7` + `m8 12 7 6h7` (one line in from the left, two out to the right); lump = `M2 6h7l7 6h6` + `M2 18h7l7-6` (two in, one out). The same glyph at 11px sits before the kind word in the list panel rows. On the phone tier the badge glyph takes `transform: rotate(90deg)` so it fans out (or converges) downward with the stacked chart. Do not substitute lucide `Split` / `Merge` here: both are vertical and read against the wide layout's left-to-right flow. Lucide `Split` stays as the feature icon on the control tile and the section header.
  - **Sentence** (FR-17, once per event): margin-top 14, 0.75rem/1.55 `--sr-text-muted`, max-width 66ch, the date at 600 `--sr-text`. Three forms, exact:
    - split: "eBird reassigned every report dated on or before **31 October 2025** to one of the new names when it made this split. Reports dated after it were recorded under the current names." plus, when a slash node is shown, " Reports it could not place went to Eastern/Western Warbling Vireo."
    - lump: "eBird reassigned every report dated on or before **22 October 2024** to Redpoll when it made this lump. Your backup no longer carries the earlier names."
    - predates: "eBird reassigned every report dated on or before **31 October 2025** when it made this split. Your backup was exported before that, so the reassignment is not in it yet."
    The published day is formatted "31 October 2025" from `published` with the fixed English month table (schema 7.4). No sentence anywhere names, ranks or proposes a daughter for an old report.

- **Phone tier (`<=640px`, the stacked chart).** Grid becomes one column with `row-gap: 8px`: before side, rail, after side. Side padding drops to 0; a multi side takes `padding-left: 42px` so its spine sits at x = 24px with stubs (18px, at `var(--lin-stub)`) into each node; a single side has no stub. The rail becomes a column, `align-items: flex-start`, `margin: -8px 0`, its two hairlines vertical (1px by 22px, `margin-left: 24px`) so each reaches across the row gap and touches the node above or below at x = 24px; the multi side's end segments meet it exactly (`:first-child` on the after side starts at `top: 0`, `:last-child` on the before side ends at `bottom: 0`), with no overlap and no gap. Badge `white-space: normal`. Names wrap; a slash name breaks after its "/" (see Component Usage). Verified in the mockup at 320px and 200% text in both themes with no page overflow.

- **Text equivalent (FR-22, NFR-04).** Rendered after the sentence, visually hidden with the `.sr-only` idiom, in reading order, one paragraph each: kind and update ("Split, October 2025."); "Before: " then every before entry; "After: " then every after entry and then every shown slash entry; the sentence in plain text. Each entry reads "Common name (Scientific name)", then ", your species" or ", the slash entry for reports eBird could not assign" where applicable, then either ": no reports under this name." or ": N reports, R reassigned by eBird, S recorded since." (predates: ": N reports, all dated before the update."). Every fact the graphic shows appears here (QA-22 parity), and the graphic is `aria-hidden`. Ids the section mints for `aria-labelledby` follow schema 7.3 (index-keyed, never a name).

**Demonstrated data states in the approved mockup (contract for the Engineer's fixtures):** a split with a your-species daughter, a second daughter and a shown slash (Warbling Vireo, 2025); a split with an unrecorded daughter and an unshown slash (Whimbrel, 2025); a split whose nominate daughter keeps the parent's common name (Cory's Shearwater, 2024; schema 6.2's stated limit, shown without the predates note); a split with no slash (Northern Goshawk, 2023); a three-parent lump (Redpoll, 2024); the stale-export state for both 2025 events; the not-affected empty state; the zero-affected panel; the filter-active line.

## Component Usage

- **SectionCard, SectionHead** (`components/speciesDetail/ui.tsx`): the section, unchanged.
- **Button** (`components/ui/Button`): the control, every list row, the BirdName link inside a node (through BirdName). No raw buttons.
- **BirdName**: every species name in the list and every entry name in the chart (FR-23). Non-link form in the list rows; link form only for a recorded, non-selected entry. **One opt-in prop is added: `breakAfterSlash?: boolean`**, which renders the common name with a `<wbr>` after each "/" (the accessible name and the text content are unchanged; `<wbr>` contributes no character). The section passes it for slash entries so "Eastern/Western Warbling Vireo" wraps after the slash at 320px and 200% text rather than mid-word. Default off, so every shipped surface is byte-identical. Logged in `decisions.md`.
- **Lucide**: `Split` (control tile 12px, section head 14px, stroke 2.2), `ChevronDown` (13px, the caret), `Check` (11px stroke 3, the your-species marker), `Info` (14px, the stale-export note). The direction glyph is not lucide (above).
- **Copy module** `lib/taxonomyHistoryCopy.ts`: every string quoted in this spec that carries a count, a year or a date, plus the kind words, markers and the three sentence forms; no U+2014 anywhere.
- No new library, no modal, no new token.

## Design Tokens Applied

All existing, both themes, no additions.
- Surfaces: `--sr-surface` (control, cards, nodes), `--sr-surface-faint` (panel, badge, stale-export note), `--sr-surface-subtle` (hover; dark open-state tile), `--sr-bg` (page).
- Text: `--sr-text` (names, counts, kind word, note body), `--sr-text-muted` (secondary text, markers, partition labels, sentence, coverage, glyphs), `--sr-text-gray` (scientific names, italic).
- Borders and lines: `--sr-border` (control, panel, nodes, badge, note), `--sr-border-subtle` (row rules, event hairline, coverage rule), `--sr-border-medium` (every connector hairline; dashed outline of a no-reports node), `--sr-accent-border-strong` (open control; your-species node).
- Accent: `--sr-accent` (icons, open-state text, selected list row name, "Your species" marker, the count bar's recorded-since fill), `--sr-accent-bg` (icon tiles, open control, selected row, your-species node fill).
- `--sr-gray-400` (the count bar track, the reassigned share; the same token the explorer's plain-report bar and the switch off-track use).
- Type: the house stack. Sizes: 0.84375rem names and counts, 0.8125rem section title and empty state, 0.75rem control label, badge, sentence and note, 0.71875rem scientific names, partition line, panel head, filter and coverage lines, 0.6875rem micro-caps markers and list-row event lines. Tabular numerals on every count.
- Contrast: every text pairing is an already-audited token pair (`--sr-text-muted` on `--sr-surface-faint` and `--sr-accent-bg`, `--sr-accent` on `--sr-accent-bg`, `--sr-text` on `--sr-accent-bg`), both themes. The hairlines and the bar carry no meaning that the text does not.

## Interaction Notes

- **Control**: `aria-expanded` + `aria-controls`; click toggles; Escape (while open) closes and returns focus to the control; keyboard operable throughout; global focus ring.
- **List rows**: whole row is the button; activation closes the panel, calls the page's `pickExplorerSpecies`-shaped handler (reveal-and-select, then `jumpTo(lineageRef, { block: 'nearest' })` on the next frame, focus to the section wrapper). `aria-current` on the selected species when reopened.
- **Section**: `tabIndex={-1}` wrapper for the programmatic focus; no interactive elements of its own except BirdName links inside recorded, non-selected nodes, which select that species through the page path (FR-23). Selecting a species by any route yields the same content (FR-25).
- **Gating**: both pieces render only in ready state with `mergeSubspecies` on and the asset loaded; `history === null` renders nothing and raises no alert (FR-28). Filters and the two reveal toggles never change list membership, counts or content; a county or date filter only adds the filter line (FR-09, FR-24).
- **Stale export**: `event.predates` is computed per event over the whole backup (schema 6.4), so an older backup shows the note and the before-side your-species node for every event of that update; no after partition is shown for it.
- **Chained lineage**: every event in `AffectedSpecies.events`, earliest first, each with its own chart and sentence, separated by the hairline; chain-only events render with their tallies (all "No reports under this name" is a legitimate reading).
- **320px and 200% text scale**: verified in the mockup in both themes: the control row stacks, the chart stacks with the connectors continuous, names wrap (slash names after the slash), no horizontal overflow anywhere.

## Motion Spec

- List panel open: opacity 0 to 1 + translateY(-4px) + scale(0.985) to rest, ease-out, 200ms, transform-origin top left (from the control above), reduced-motion: instant, CSS keyframes (reuse `sr-ssx-pop-in`). Close: instant removal.
- Control caret rotate (0 to 180deg): ease-out, 200ms, centre origin, reduced-motion: instant, CSS transition (the `.sr-ssx-caret` rule).
- Control open/hover colours: ease-out, 140ms, reduced-motion: instant, CSS transition (the `.sr-ssx-toggle` rule).
- List row hover: ease-out, 120ms, reduced-motion: instant, CSS transition.
- Section body on species change: opacity 0 to 1 + translateY(3px) to rest, ease-out, 160ms, keyed on the selected species so it plays exactly when the content changed and never on an unrelated re-render, reduced-motion: instant, CSS keyframes.
- Count bar fill: width 0 to the recorded-since share, ease-out, 240ms, right-anchored fill inside the track, keyed with the body above, reduced-motion: final width instantly, CSS keyframes (same shape as `sr-ssx-bar-in`).
- Scroll to the section after a list pick: smooth, reduced-motion: auto (instant), native `scrollIntoView` through `jumpTo`.
- Nothing else moves: no entrance on static content, no stagger, no pulsing, no transform on the chart or its connectors. All motion under 300ms, ease-out, CSS only; the app's global `prefers-reduced-motion` block collapses every one of these, so no per-component query is added.

## Content Notes

Informative, never promotional; plain statements of what eBird did and when. No em dash (U+2014) anywhere. Bird names are the full names as the backup or the asset carries them, never reworded. Approved exact copy is quoted above; the pieces that vary are the two coverage years, the update month and year, the published day, the count strings and the names, all from the copy module and the asset, never typed in a component.

- Control label: "Splits and lumps" (sentence case, matching "Subspecies and forms"). Count suffix "N species".
- Section title: "Splits and Lumps" (title case, matching "Subspecies and Forms").
- Kind words: "Split", "Lump". Update label: month and year ("October 2025"). Published day: "31 October 2025".
- Markers: "Your species"; "No reports under this name"; "Reports eBird could not assign".
- Partition labels: "N reassigned by eBird", "N recorded since"; predates: "all dated before the update".
- Count strings: "N reports" / "1 report".
- Filter line, coverage line (with its zero-update form), not-affected empty state, zero-affected panel copy, panel head, stale-export note and the three sentence forms: exact text in the sections above.
