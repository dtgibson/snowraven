# Design Spec - Recorded Names in Splits and Lumps

**Feature:** recorded-names-in-splits-and-lumps
**Stage:** 4 - The Designer
**Approved mockup:** `pipeline/recorded-names-in-splits-and-lumps/design.html` (approved as drawn on 2026-11-19: "This looks good, lets build it"; no changes requested). It is the visual reference. Where this spec and the mockup differ, this spec wins, and each such place is marked **differs from the mockup**.
**Design system:** established (`pipeline/design-system.md`). This design extends the shipped section with no new token, no new typeface and no new component. Its deviations are listed in section 10 for `decisions.md`.
**Amends:** `pipeline/taxonomic-splits-lumps/design-spec.md` (cited as **TSL-D**). Anything in that spec this document does not name stays in force.
**Data contract:** `schema.md` 6.5 (`EventView.earlierState`, `EventView.residual`, `EntryView.form`, `EntryView.earlier`, `HistoryKind`), 6.6 and 7. Requirement IDs are this feature's PRD unless prefixed TSL.

Every string in section 3 lives in `frontend/src/lib/taxonomyHistoryCopy.ts` (NFR-06), so the corpus sweep in `taxonomyHistoryCopy.test.ts` covers it. No string here contains U+2014.

---

## 1. Visual Direction

The same quiet flow chart, with the left-hand boxes no longer empty. An earlier name now carries a count and one muted line saying whose name it was; where the backup cannot give a count the box stays dashed and says why in words. Green still marks exactly one thing, the user's own species. Renames join as a third kind with their own direction glyph and wording that never dates the change to the update.

---

## 2. States, and what each answers

`earlierState` is decided once per event in the fixed order FR-20, then FR-21, then FR-13 to FR-19 (schema 6.5, 7). The table is the whole set; "drawn" names the mockup frame.

| # | State | Condition (schema 6.5 / 7) | Answers | Drawn |
|---|---|---|---|---|
| S1 | Earlier name, counted | `earlierState === 'counted'`, `entry.earlier = { state: 'count', n > 0 }` | FR-13, FR-15, FR-16, FR-22 | Split (Whimbrel), Lump 1, Rename |
| S2 | Earlier name, zero | `'counted'`, `{ state: 'count', n: 0 }` | FR-19 | "nothing to count" (goshawk), Lump 2 |
| S3 | Earlier name, not traceable | `'counted'`, `{ state: 'untraceable', reason }` (lumps only) | FR-18, D-08 | Lump 3 (survivor), Lump 4 (both reasons) |
| S4 | "Earlier name not recorded" box | `'counted'`, lump, `residual > 0` | FR-17 | Lump 1, Lump 3, Longest names |
| S5 | Later-changed marker | `earlierState === 'later-changed'`, every before entry | FR-21, OQ-03 | Great Horned Owl, 2022 line |
| S6 | Backup exported before the update | `earlierState === 'pre-update'` | FR-20, TSL FR-19 | "An older backup" (unchanged from shipped) |
| S7 | Current-side name | every after entry and shown slash entry | FR-23, TSL FR-14/16/18 | every frame (shipped) |
| S8 | Rename event | `kind === 'rename'` | FR-01, FR-15, FR-23, FR-24, OQ-04 | Rename, Night Heron |
| S9 | Explanatory paragraph | `'counted'` and (some `earlier.n > 0` or `residual > 0`) | FR-25 | Split, Lump 1, Lump 3, Rename |
| S10 | Species with no covered event | `lineage === null` | FR-29 | "No change recorded" |
| S11 | No affected species (list) | `entries.length === 0` | FR-29, TSL FR-13 | "the control's list" |
| S12 | The control and its list with renames | always, merged mode | FR-28 to FR-31 | "Try it" |

**Specified here and not drawn** (each follows from the rules below; the Engineer builds a fixture for each):

- A later-changed **lump** (2 in the record) and a later-changed **rename** (6 of 515): S5 on every earlier name, sentence per section 3.6, no paragraph, no residual box.
- A **rename** in S6 (FR-09): shipped predates layout with the rename variants of the note and sentence in 3.6 and 3.7.
- The **mixed** S6 case (pre-update evidence without the shipped `predates` flag, FR-20): shipped nodes only, no note, sentence per 3.6.
- A split whose **slash entry** is shown: shipped, unchanged, including its sentence tail.
- A backup older than the **first of two renames** (schema flag 11): the first rename in S6, the second in S2. The S2 line is worded so it is true there (3.4).

---

## 3. Copy (exact strings)

`{…}` is a value. Bird names inside a string render through `<BirdName>` (section 5). "SHIPPED" means the string is unchanged from `taxonomyHistoryCopy.ts` today.

### 3.1 Names and kind words

| Constant | String | Note |
|---|---|---|
| `SECTION_TITLE` | `Splits/Lumps/Renames` | FR-28, fixed |
| `CONTROL_LABEL` | `Splits/Lumps/Renames` | FR-29, approved; the same string as the title |
| `KIND_WORD` | `Split`, `Lump`, `Rename` | NFR-06 |

### 3.2 Counts and plurals

- A report count is `reportCountLabel(n)` (SHIPPED): `1 report`, otherwise `{n} reports`. It is used for `n >= 1` only on an earlier name; an earlier-name figure of 0 never prints "0 reports" (it is S2).
- The control's count is `speciesCountLabel(n)` (SHIPPED): `{n} species`, including `0 species`.
- Partition figures on a current-side name are bare numbers, as shipped, and 0 prints as `0` (`0 reassigned by eBird`, `0 recorded since`).
- Every count-bearing builder has a singular form where its noun or pronoun changes: 3.3 (basis), 3.5 (residual line). No string puts a plural noun or `them`/`they` after a count of one.

### 3.3 Earlier name, counted (S1)

| Piece | String |
|---|---|
| Count | `{reportCountLabel(n)}` |
| Basis line, split and lump, n = 1 | `eBird's name for it until the update` |
| Basis line, split and lump, n >= 2 | `eBird's name for them until the update` (fixed basis, NFR-06) |
| Basis line, rename, n = 1 | `eBird's name for it until the update, at the latest` |
| Basis line, rename, n >= 2 | `eBird's name for them until the update, at the latest` (OQ-04, approved) |
| Form line, traced lump name only | `now the form {entry.form}` |

### 3.4 Earlier name with no figure (S2, S3, S5)

Each is a marker (the micro-caps row) and one line under it.

| State | Marker | Line |
|---|---|---|
| S2, split | `No reports until the update` | `None under the names it became is dated on or before it.` |
| S2, rename | `No reports until the update` | `None under {current name} is dated on or before it.` |
| S2, traced lump name | `No reports until the update` | `None dated on or before it carries the form {entry.form}.` |
| S3, `reason: 'no-form'` | `Not traceable in your backup` (fixed) | `eBird kept no form for this name, so its reports now read as plain {lumped name}.` |
| S3, `reason: 'survivor'` | `Not traceable in your backup` (fixed) | `This name carried on as the lumped species, so its earlier reports read the same as any report with no form.` |
| S5 | `Not counted on this line` | `A later update changed one of the names it became.` |

`{current name}` is the rename's after entry as displayed (5.3). `{lumped name}` is `after[0].com`.

### 3.5 "Earlier name not recorded" box (S4)

| Piece | String |
|---|---|
| Marker (leads the box; there is no bird name) | `Earlier name not recorded` (fixed) |
| Count | `{reportCountLabel(residual)}` |
| Line, residual = 1 | `Dated on or before the update, with no form to show the name it had.` |
| Line, residual >= 2 | `Dated on or before the update, with no form to show the name they had.` |

### 3.6 The event sentence (FR-24), by kind and state

`{D}` is `publishedDayLabel(published)` ("31 October 2025") at weight 600, as shipped. `{base}` is `eBird reassigned every report dated on or before {D} to {lumped name} when it made this lump.`

| Kind | State | Sentence |
|---|---|---|
| Split | counted, later-changed, or pre-update without `predates` | SHIPPED: `eBird reassigned every report dated on or before {D} to one of the new names when it made this split. Reports dated after it were recorded under the current names.` plus, when slash entries are shown, the SHIPPED tail ` Reports it could not place went to {slash names}.` |
| Split | `predates` | SHIPPED: `eBird reassigned every report dated on or before {D} when it made this split. Your backup was exported before that, so the reassignment is not in it yet.` |
| Lump | counted, at least one traced earlier name | `{base} Where eBird kept an earlier name as a form, reports that carry the form are counted under that name.` |
| Lump | counted, no traced earlier name | `{base} Your backup cannot show which earlier name a report had.` |
| Lump | later-changed, or pre-update without `predates` | `{base}` and nothing after it |
| Lump | `predates` | SHIPPED: `eBird reassigned every report dated on or before {D} when it made this lump. Your backup was exported before that, so the reassignment is not in it yet.` |
| Rename | counted, later-changed, or pre-update without `predates` | `eBird renamed {earlier name} to {current name}. The new name was in place by the update of {D}, the first whose record carries it.` |
| Rename | `predates` | the rename sentence above, then ` Your backup was exported before that update, so the new name is not in it yet.` |

The shipped lump tail `Your backup no longer carries the earlier names.` is removed everywhere (FR-24, FR-20). No rename string says the change was made on the published day or by that update (FR-04, QA-26): the wording is "in place by".

### 3.7 The older-backup note (S6)

- Split and lump: SHIPPED, `**Your backup predates the {Month YYYY} update**, so your reports still carry the earlier name. A fresh backup from eBird shows where they went.`
- Rename: same lead, then `, so your reports still carry the earlier name. A fresh backup from eBird carries the new one.`

### 3.8 The explanatory paragraph (S9, FR-25)

Shown once per event, under the sentence, only in S9's condition. The lead is weight 600 in `--sr-text`, like the sentence's date.

- **Split:** `**How the count is worked out.** From each report's date, not from what you typed. Your backup keeps only each report's current name, so every report dated on or before the update is counted under {earlier name}, including one entered later for an earlier date.`
- **Rename:** the split paragraph, then ` eBird may have changed the name before that update; if so, reports dated between the change and the update are counted under the earlier name too.`
- **Lump:** `**How the counts are worked out.** From the form each report carries and its date, not from what you typed. Your backup keeps only each report's current name, so a report dated on or before the update counts under an earlier name when it carries the form eBird kept for that name, including one entered later for an earlier date.` and, only when `residual > 0`, ` Reports with no form have no earlier name in your backup.`

The lump lead is plural in every case; it names the method, not a number.

### 3.9 Current-side names (S7)

SHIPPED and unchanged: `Your species`, `No reports under this name`, `Reports eBird could not assign`, `{n} reassigned by eBird`, `{n} recorded since`, `all dated before the update`. One addition (FR-23): on a **rename's** current-side name the on-or-before label is `renamed by eBird` in place of `reassigned by eBird`. "recorded since" is unchanged.

### 3.10 The badge and the list

| Where | String |
|---|---|
| Badge, split or lump | `{Kind}` then `{Month YYYY}` (SHIPPED: "Split" "October 2025") |
| Badge, rename | `Rename` then `by {Month YYYY}` ("Rename" "by September 2021"), approved |
| List row, per event | `{Kind} · {YYYY}` (SHIPPED form; a rename's year is its update's year, FR-30) |
| List head, at least one entry | `Every species in your loaded data with a split, lump, or rename recorded in eBird's {range}. Pick one to see what changed and when, with your reports under each name.` |
| List head, no entries (S11) | `No split, lump, or rename is recorded for any species in your loaded data in eBird's {range}. A change made before {earliest year} is not recorded here.` |
| Section, species with no event (S10) | `No split, lump, or rename is recorded for this species in the covered updates.` (approved) |
| Coverage line, filter line, no-coverage line | SHIPPED, unchanged |

`{range}` is the shipped `rangePhrase` ("2019 to 2026 taxonomy updates"; one covered year reads "2026 taxonomy update"). Both list heads say what "is recorded", never that a species was not renamed (FR-10, FR-29).

### 3.11 Text equivalent (FR-32)

Visually hidden (`.sr-only`), after the sentence and paragraph, one `<p>` each, in this order. Markers are the chart's markers with a lowercase first letter, the same convention the shipped `: no reports under this name.` follows.

1. Kind line. Split or lump, SHIPPED: `{Kind}, {Month YYYY}.` Rename: `Rename, in place by {Month YYYY}.`
2. `Before: ` then each before entry in record order, separated by one space, then the residual box when shown.
3. `After: ` then each after entry and each shown slash entry (SHIPPED).
4. The event sentence as plain text.
5. The explanatory paragraph as plain text, when shown.

Each before entry reads `{name} ({scientific name})` and then:

| State | Tail |
|---|---|
| S1 | `: {reportCountLabel(n)}, {basis line}.` and, for a traced lump name, `: {reportCountLabel(n)}, {basis line}, now the form {form}.` |
| S2 | `: no reports until the update. {S2 line}` |
| S3 | `: not traceable in your backup. {S3 line}` |
| S5 | `: not counted on this line. A later update changed one of the names it became.` |
| S6 | SHIPPED `altEntryTail` (`, your species: {n reports}, all dated before the update.` or `: no reports under this name.`) |

The residual box reads `Earlier name not recorded: {reportCountLabel(residual)}, dated on or before the update, with no form to show the name {it|they} had.`

Each after entry is the SHIPPED tail, with `renamed by eBird` for a rename: `{name} ({sci}), your species: 12 reports, 9 renamed by eBird, 3 recorded since.`

Worked examples, exactly as the mockup's "What a screen reader receives" section prints them:

- Split: `Split, October 2025.` / `Before: Whimbrel (Numenius phaeopus): 14 reports, eBird's name for them until the update.` / `After: Hudsonian Whimbrel (Numenius hudsonicus), your species: 25 reports, 14 reassigned by eBird, 11 recorded since. Eurasian Whimbrel (Numenius phaeopus): no reports under this name.` / sentence / paragraph.
- Lump: `Lump, October 2023.` / `Before: Pacific-slope Flycatcher (Empidonax difficilis): 44 reports, eBird's name for them until the update, now the form Western Flycatcher (Pacific-slope). Cordilleran Flycatcher (Empidonax occidentalis): 9 reports, eBird's name for them until the update, now the form Western Flycatcher (Cordilleran). Earlier name not recorded: 5 reports, dated on or before the update, with no form to show the name they had.` / `After: Western Flycatcher (Empidonax difficilis), your species: 71 reports, 58 reassigned by eBird, 13 recorded since.` / sentence / paragraph.
- Rename: `Rename, in place by September 2021.` / `Before: McCown's Longspur (Rhynchophanes mccownii): 9 reports, eBird's name for them until the update, at the latest.` / `After: Thick-billed Longspur (Rhynchophanes mccownii), your species: 12 reports, 9 renamed by eBird, 3 recorded since.` / sentence / paragraph.

Parity rule (QA-33): every name, marker, count, line and sentence drawn in an event's chart appears in that event's text equivalent, compared without regard to the first letter's case. The mockup holds this by building both from one set of functions; the app should do the same.

---

## 4. Screens / Views

One surface: Species Detail, merged mode, ready state. Placement, gating and everything not named here are as TSL-D.

### 4.1 The control and its list (S11, S12)

Unchanged register (`.sr-ssx-toggle`, `.sr-ssx-tile`, `.sr-ssx-count`, `.sr-ssx-caret`, `.sr-ssx-panel`, `.sr-ssx-panel-head`, `.sr-ssx-list`, `.sr-sl-row*`). Changes:

- The label is `CONTROL_LABEL` inside `<span className="sr-ssx-label">`, drawn with a `<wbr>` after each "/" (section 6.1). The count stays `speciesCountLabel(entries.length)`, the length of the array the list renders (FR-30).
- A list row shows, per event, the direction glyph at 11px, the kind word at 600, the muted middot, the year. A rename uses the rename glyph (section 7) and `Rename`. Events are most recent first; entries are in the selector's order (FR-30).
- A row may now wrap: when the name and the kind column do not fit on one line, the kinds drop under the name, right-aligned (section 6.2).

### 4.2 The section

`SectionHead` title is `SECTION_TITLE` with a `<wbr>` after each "/". Body order is as TSL-D: filter line, events earliest first, coverage line; S10 replaces the events.

**The event block,** top to bottom: the older-backup note (S6 with `predates` only); the chart; the sentence; the paragraph (S9); the text equivalent.

**Before side.** One node per before entry in record order, then the S4 box last when shown. The side is `sr-lin-side--multi` when it holds more than one node, counting the S4 box.

**Earlier-name nodes** (before side, `earlierState` not `'pre-update'`). All use the shipped node internals and type sizes.

| State | Node class | Rows, top to bottom |
|---|---|---|
| S1 | `sr-lin-node` (solid) | name; scientific name; count (`.sr-lin-count`); basis line (`.sr-lin-part`); form line (`.sr-lin-part`, traced lump name only); share bar (section 8) |
| S2 | `sr-lin-node is-absent` (dashed, muted name) | name; scientific name; marker (`.sr-lin-mark`); line (`.sr-lin-part`) |
| S3 | `sr-lin-node is-absent` | name; scientific name; marker with the circle-slash glyph (`.sr-lin-mark sr-lin-mark--cannot`); line |
| S5 | `sr-lin-node is-absent` | as S3, with the S5 marker and line |
| S4 | `sr-lin-node is-absent` | marker (`.sr-lin-mark sr-lin-mark--lead`); count; line; share bar |

Each `.sr-lin-part` line is ONE `<span>` child holding the whole line (text and any bird name), because `.sr-lin-part` is a wrapping flex row and a second child would wrap as a separate item.

How the no-figure states differ without color (NFR-04): S2 has a marker with no glyph; S3 and S5 carry the glyph and different words; S4 has no bird name and a count; S1 is the only solid box with a count. Dashed means "no name or no number here", as it does on the shipped "No reports under this name".

**S6** renders the shipped nodes on both sides and nothing from this spec except the rename strings in 3.6 and 3.7.

**Current-side nodes** are the shipped `LineageNode`, with `renamed by eBird` on a rename.

**Sentence and paragraph.** Both are `<p className="sr-lin-sentence" aria-hidden="true">`; the paragraph follows the sentence with 6px between them.

---

## 5. Component Usage

- **SectionCard, SectionHead, PanelSlot, Button:** as shipped. No raw `<button>` or `<a>`; no new interactive element anywhere in this design (NFR-04).
- **BirdName,** every bird name (FR-27):
  1. An earlier name the backup does not carry (S1, S2, S3, S5) and a kept form's name: `<BirdName commonName={…} breakAfterSlash />`, no `taxonCode`, no `hasEntry`, so no link and no site marks.
  2. A current-side name: as shipped (link and marks only for a recorded, non-selected entry whose `entry.current` is true; `current` on a rename's after entry follows schema 6.5).
  3. **The latest rename's current-side name is shown as the rest of the app shows that species.** Where a rename's after entry has `entry.current === true` and `entry.speciesKey !== null`, the box, the sentence, the S2 rename line and the text equivalent show the species' name as the page carries it (the `speciesKey` name) in place of `entry.com`. Otherwise they show `entry.com`. Reason: one rename's record spelling differs from today's name (section 11). The Engineer may reach the same result another way; the requirement is the displayed spelling. **Differs from FR-01's record name on display only; logged in section 10.**
- **Lucide:** `Split`, `ChevronDown`, `Check`, `Info` as shipped; `CircleSlash` is new (section 7).
- **Not bird names:** `Earlier name not recorded`, the markers and the kind words are plain text (FR-27).

---

## 6. CSS: every rule added or changed

All in `frontend/src/globals.css`, in the "Splits and lumps" block (it starts near line 8090 at `b61379f4`) unless a row says otherwise. Tokens only. Rules R1 to R8 are the "eight small rules"; R9 is the threshold.

| # | Selector | Change | Why |
|---|---|---|---|
| R1 | `.sr-ssx-label` (new) and the section title | `min-width: 0;` on each, with a `<wbr>` after each "/" in the markup (6.1) | "Splits/Lumps/Renames" is one unbreakable run; at 320px and 200% text it overran the control and the section head |
| R2 | `.sr-sl-row` (existing base rule) | add `flex-wrap: wrap; row-gap: 2px;` | "Rename" is the longest kind word; at 320px and 200% text the name column was squeezed to a few letters per line. No breakpoint: the row wraps only when the name's full width and the kinds do not fit |
| R3 | `.sr-lin-badge` inside BOTH stacked blocks | `white-space: normal;` becomes `white-space: normal; flex-wrap: wrap;` | In the stacked chart "Rename" plus "September" overran the event box at 320px and 200% text; the date now wraps under the word |
| R4 | `.sr-lin-sentence + .sr-lin-sentence` (new) | `margin-top: 6px;` | the paragraph under the sentence |
| R5 | `.sr-lin-part .sr-birdname, .sr-lin-part .sr-birdname-row` and `.sr-lin-part .sr-birdname-text` (new) | `display: inline; vertical-align: baseline;` and `font: inherit; color: inherit;` | a form name or species name quoted in a line reads as part of the line; the same treatment `.sr-lin-sentence` already gives a quoted name |
| R6 | `.sr-lin-mark--lead` (new) | `margin-top: 0;` | the S4 marker is the first row of its box |
| R7 | `.sr-lin-mark--cannot` and `.sr-lin-cannot-glyph` (new) | `align-items: flex-start;` and `width: 1em; height: 1em; margin-top: 0.12em; flex-shrink: 0;` | the marker may wrap to two lines, so the glyph sits on the first; sized in em so it grows with the text |
| R8 | `.sr-lin-bar--earlier` and `.sr-lin-bar--earlier i` (new) | `justify-content: flex-start; background: var(--sr-border);` and `background: var(--sr-gray-400);` | the share bar (section 8) |
| R9 | `@container sr-lin (…)` | `(max-width: 21em) or (max-width: 420px)` becomes `(max-width: 29em) or (max-width: 520px)` | section 6.3 |

**Differs from the mockup:** R5's first selector pair is not in the mockup, which draws names as a bare span; the real `<BirdName>` wrapper is an inline-flex column and needs it. R7's glyph is selected by its own class here; the mockup's `.sr-lin-mark--cannot svg` must not ship, because a rule whose rightmost compound is a bare `svg` competes with the map FAB glyph rule and `mapFabCascade.test.ts` rejects the shape (ui.md, v1.0.42).

### 6.1 The break after a slash

- The text content and the accessible name stay exactly `Splits/Lumps/Renames`; a `<wbr>` adds no character. `CONTROL_LABEL` and `SECTION_TITLE` stay single string constants in the copy module, and the component inserts the `<wbr>` when it renders them (split on "/", the same idea as BirdName's `breakAfterSlash`).
- `SectionHead` is shared and takes `title: string` with inline styles. Reach the break and the `min-width: 0` without changing how any other section renders (an optional prop, or a title node passed by this section). The Subspecies and forms label needs no change.

### 6.2 The list row

`.sr-sl-row-events` keeps `margin-left: auto; flex-shrink: 0`, so on a wrapped row the kinds sit right-aligned on the line under the name. A row that fits on one line is unchanged at every width.

### 6.3 The stacking threshold (R9): re-measure in the built app

- **Container:** `.sr-lin-event` (`container-name: sr-lin`), unchanged.
- **Why it moves:** at the shipped threshold, three columns clip the new content. "Not traceable in your backup" with its glyph, and "Your species" beside the wider "Rename by …" badge, overran their boxes for event widths from 430 to 480px at 100% text and from 680 to 720px at 200%.
- **Measured need** (mockup frames, Chromium and WebKit, overlay scrollbars, the query switched off, text ink against each node's and badge's content box): three columns are clean from an event 490px wide at 100% text, 550px at 125%, 610px at 150%, 730px at 200%. That is 250px + 15em. `520px` covers 100%; `29em` covers 125% and up (27.5em is the need at 125%).
- **With the new threshold** the same sweep finds no clipped ink at any of the four scales in either engine; three columns begin at 530, 590, 700 and 930px.
- **What a user could notice:** at 200% text the chart stays stacked until the event box is about 930px wide; today it goes side by side at about 670px. At 100% the change is 420px to 520px.
- **The Engineer must re-measure both terms against the real container in the built app** (ui.md, v1.0.50), including under a classic 15px scrollbar (ui.md, v1.0.56), with the widest content the record can produce: a rename badge beside a "Your species" box, and an S3 box. The mockup's numbers are a starting value, not the shipped one. If the built app needs different terms, the Engineer moves them and records the measurement.
- **`frontend/src/lib/splitsLumpsCss.test.ts` locks the container block and the trailing `<=640` block to the same `.sr-lin-*` rules,** selector for selector and declaration for declaration, and asserts the container trigger carries both an em term and a px term. R3 therefore lands in both blocks in the same change, and R9 keeps both terms. Any figure the guard pins moves with the rule.

### 6.4 Tokens used

`--sr-surface`, `--sr-surface-faint`, `--sr-surface-subtle`, `--sr-border`, `--sr-border-subtle`, `--sr-border-medium`, `--sr-text`, `--sr-text-muted`, `--sr-text-gray`, `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border-strong`, `--sr-gray-400`. All exist in `:root` and `[data-theme="dark"]`. The one new pairing is `--sr-gray-400` on a `--sr-border` track in the share bar: a non-text graphic that repeats numbers printed as text, so it carries no contrast requirement of its own. Every text pair is a pair the section already ships (`--sr-text-muted` on `--sr-surface`, and on the card through a transparent dashed box).

---

## 7. The two glyphs

Both are `aria-hidden`; the words beside them carry the meaning.

**Rename direction glyph** (hand-drawn on the lucide grid, joining the split and lump glyphs in `KindGlyph`): one line in, one out.

```html
<svg class="sr-lin-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M2 12h19"/><path d="m15 6 6 6-6 6"/>
</svg>
```

Sizes as the other two: 13px in the badge, 11px in a list row, `--sr-text-muted`. In the stacked chart it takes the shipped `transform: rotate(90deg)` with the badge's glyph, so it points down. `KindGlyph`'s `kind` widens to `HistoryKind`.

**Circle-slash** (S3 and S5 markers): lucide `CircleSlash` (`<circle cx="12" cy="12" r="10"/><path d="m9 15 6-6"/>`), `strokeWidth={2.4}`, `className="sr-lin-cannot-glyph"`, `aria-hidden="true"`, in `--sr-text-muted` through `currentColor`. It is sized by R7 in em (the `size` prop is not what governs). It precedes the marker text inside `.sr-lin-mark`, an inline-flex row, so Tailwind preflight's `display: block` on `svg` does not put it on its own line.

---

## 8. The earlier-name share bar

- **What it shows:** this box's share of the event's reports dated on or before the update.
- **Computed as** `width = figure / T`, as a percentage with two decimals (the shipped bar's form), where `T` is the sum of `onOrBefore` over every after entry and every slash entry of the event, drawn or not. `figure` is `entry.earlier.n` for an S1 box and `event.residual` for the S4 box.
  - Split: `T` equals the earlier-name figure (FR-13), so the bar is full.
  - Rename: `T` equals the figure (FR-15), so the bar is full.
  - Lump: `T` is the lumped name's reassigned figure, so the S1 and S4 bars of one lump add up to 100% (FR-17's identity, visible).
- **Drawn on** S1 and S4 only. S2, S3, S5 and S6 nodes have no earlier bar. `T > 0` wherever a bar is drawn, because the box exists only when its figure is above zero.
- **Markup:** `<div className="sr-lin-bar sr-lin-bar--earlier" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>`. One inline key (`width`), always present, value only varies. It is filled from the left in `--sr-gray-400` on a `--sr-border` track; the accent stays with "recorded since" on current names.
- **Accessible treatment:** `aria-hidden`, no text alternative and no entry in the text equivalent. It is reinforcement only: every number it reflects is printed as text in its box and in the text equivalent, and nothing is carried by the bar alone.

---

## 9. Interaction, focus and ARIA

- **Nothing new is interactive.** Tab order, the control's `aria-expanded` and `aria-controls`, the list rows' `aria-current`, Escape closing the list and returning focus to the control, and the pick (select, close, scroll the section into view, focus the section wrapper) are all as shipped (FR-31). The mockup's live frame demonstrates them and was checked in both engines.
- **Chart parts are `aria-hidden`** as shipped: every new row of an earlier-name node (name, scientific name, marker, count, lines, bar), the badge, the sentence and the paragraph. The text equivalent carries them once (3.11). An earlier name is never a link, so its name row is always `aria-hidden`.
- **No live region.** A species change replaces the section body as it does today.
- **Ids:** none added. Any id stays index-keyed (NFR-04).
- **No hover look is added** by this design.

### Behavior at 320px and at 200% text

Checked in the mockup in Chromium and WebKit, light and dark, at a 1280px and a true 320px window, at 100% and 200% text (text ink against each box; page scroll width):

- The control's label and the section title wrap after a slash; the control keeps its shipped phone wrap.
- List rows wrap the kinds under the name when needed.
- The chart is stacked (the `<=640` tier or R9); the badge wraps its date under the kind word; names break by the shipped `overflow-wrap: anywhere` and after slashes.
- No text leaves its box and the page does not scroll sideways, including the frame with the longest kept form name in the record ("North Solomons Dwarf-Kingfisher (North Solomons)").
- Not covered by the mockup, and owed in the built app (QA-41): the longest rename pair, which is not in the committed record yet, and every real-container measurement.

### Light and dark

Both themes use the tokens in 6.4 and nothing else. The dashed boxes read against `--sr-surface` in both; the share bar's track and fill are distinguishable in both.

---

## 10. Deviations and ride-alongs (for `decisions.md`)

1. **Stacking threshold moved (R9).** `@container sr-lin` goes from `(max-width: 21em) or (max-width: 420px)` to `(max-width: 29em) or (max-width: 520px)`. Evidence and the user-visible effect are in 6.3. Approved with the mockup. Reverses if the built-app measurement shows three columns fit below it.
2. **Eight small CSS rules (R1 to R8),** each with its reason in section 6. No new token, typeface or component.
3. **Share bar.** The go or no-go sketch drew an always-full gray bar on an earlier name; this design makes it the name's share of the reports dated on or before the update, so a lump shows how its reports divided (section 8). Full for a split and a rename, as the sketch showed.
4. **Hover gating: OPTIONAL ride-along, not required by this design.** The mockup puts `.sr-ssx-toggle:hover` and `.sr-sl-row:hover` inside `@media (hover: hover)`; the shipped rules (near lines 7989 and 8113) are not gated, so a touch screen keeps the hover fill on the control after a tap closes its list.
   - If taken: wrap each shipped rule where it stands in a block spelled exactly `@media (hover: hover)`. Its specificity is unchanged at (0,2,0), and it stays before `.sr-ssx-toggle[aria-expanded="true"]` and `.sr-sl-row[aria-current="true"]`, so each selected state still wins (ui.md, v1.0.65). The mockup's extra `[aria-expanded="true"]:hover` and `[aria-current="true"]:hover` rules exist only because its gated block sits after the selected-state rules; they are not needed in the app.
   - Consequence: `.sr-ssx-toggle` also serves Subspecies and forms, so that control changes too. `frontend/src/lib/controlRegisters.test.ts` covers `.sr-pill`, `.sr-segbar-btn` and `.sr-toggle` only, so these two rules would be gated with no guard unless a row is added, and a touch `:hover` claim is checked in WebKit (testing.md, v1.0.65).
   - If not taken: nothing in this design depends on it.
5. **No motion added.** See section 12.
6. **Rename glyph is hand-drawn** (section 7), for the reason TSL-D gave for the split and lump glyphs.
7. **Display spelling of the latest rename's current name** (section 5, item 3): the page's name for the species, not the update file's spelling. The record is untouched.
8. **Copy beyond the four approved items** is the Designer's and is fixed by section 3: the lump sentence variants, the three paragraphs, the S3 reasons, the S5 marker and line, the S4 line, the form line, `renamed by eBird`, both list heads, and the rename variants of the older-backup note and sentence.

---

## 11. Flag: the "Nankeen Night-Heron" remark in `schema.md`

For the Engineer and the Architect's record. `schema.md` is not edited here.

- **What the schema says:** section 14, flag 10: "Nankeen Night-Heron's rename line reads the hyphenated 2024 spelling beside a backup that says Nankeen Night Heron."
- **What the files show** (code `runher1`, read on 2026-11-18 and again on 2026-11-19 from `scripts/taxonomy-history-input/ebird-taxonomy-v{year}.csv`):

  | File | Common name |
  |---|---|
  | 2019 | Rufous Night-Heron |
  | 2021 | Nankeen Night-Heron |
  | 2022 | Nankeen Night-Heron |
  | 2023, 2024, 2025, 2026 | Nankeen Night Heron |

  The bundled snapshot (`frontend/src/assets/ebird-taxonomy.json`, version 2028) has `runher1` as "Nankeen Night Heron".
- **So:** the word-changing rename is Rufous Night-Heron to Nankeen Night-Heron and belongs to the **2021** update (published 2021-09-08), not 2024. The hyphen was dropped in the **2023** file; that is a spelling-only difference under FR-03 and yields no rename event. The substance of the flag stands (the record's new name differs in spelling from today's name); the year in it looks wrong.
- **Design consequence:** section 5, item 3. The mockup's Night Heron frame shows the intended result: `Rufous Night-Heron` on the left, `Nankeen Night Heron` on the right and in the sentence, badge `Rename by September 2021`.
- The Engineer confirms the event's year from the regenerated record.

---

## 12. Motion Spec

Nothing is added. The shipped motion applies unchanged, and the global `prefers-reduced-motion` block collapses all of it.

- List panel open: ease-out, 200ms, `transform-origin: top left` (from its control), reduced-motion near-instant, CSS (`sr-ssx-pop-in`). Unchanged.
- Control caret: ease-out, 200ms, rotates in place, reduced-motion near-instant, CSS. Unchanged.
- Section body on a species change: ease-out, 160ms, 3px rise, reduced-motion near-instant, CSS (`sr-lin-in`, keyed on the species). Unchanged; the new rows ride it.
- Current-side bar fill: ease-out, 240ms, grows from zero toward the right-aligned fill, reduced-motion at final width, CSS (`sr-lin-bar-in`). Unchanged.
- Earlier-name share bar fill: the same `sr-lin-bar-in` through `.sr-lin-bar i`, ease-out, 240ms, grows from the left edge, reduced-motion at final width, CSS. No new keyframe.

---

## 13. Fixtures the mockup demonstrates

Names, forms and dates are from the committed record and snapshot. Whimbrel's counts are the account owner's (QA-14); every other count is illustrative.

| Frame | Event | Shows |
|---|---|---|
| Split | Whimbrel, 2025 | S1 (14), S7 with 25 = 14 + 11, an unrecorded second name, S9 |
| Nothing to count | Northern Goshawk, 2023 | S2 on a split, no S9 |
| Lump 1 | Western Flycatcher, 2023 | two traced S1 (44, 9), S4 (5), sum 58, S9 with the residual sentence |
| Lump 2 | Western Flycatcher, 2023 | two S2, no S4, no S9 (the owner's expected state, QA-20) |
| Lump 3 | Collared Trogon, 2019 | traced S1 (3), S3 survivor, S4 (6), sum 9 |
| Lump 4 | American Crow, 2021 | S3 survivor and S3 no-form, no S4, no S9 |
| Rename | McCown's to Thick-billed Longspur, 2021 | S8, S1 (9) with "at the latest", "renamed by eBird", S9 |
| Rename, singular | Rufous Night-Heron to Nankeen Night Heron, 2021 | count of 1, section 5 item 3 |
| A later change | Great Horned Owl, 2022 then 2026 | S5 on the 2022 line, S1 (60) on the 2026 line, a linked current name with site marks |
| An older backup | Whimbrel, 2025 | S6, shipped |
| No change | Black Phoebe | S10 |
| The control's list | (no affected species) | S11 |
| Longest names | North Solomons Dwarf-Kingfisher, 2022 | fit at 320px and 200% text |

---

## 14. Held and out of this spec

- **No published copy is written here.** The items the PRD holds for the user's approval stay held (FR-36, QA-37): the one proposed sentence for the Species Detail paragraph shared by `README.md`, `website/index.html` and the F-Droid full description; the App Store "What's New" sentence and the three F-Droid changelog files; and the recapture of each published image that draws the control or the section, where the label now reads "Splits/Lumps/Renames". Where the section's name is used inside a sentence in published copy it is lowercased (NFR-06).
- `docs/HELP.md` and `ACCESSIBILITY.md` are written with the build (FR-35) and should use the strings in section 3 where they quote the app.

## 15. Open for the build

1. Re-measure R9 in the built app and move it if the real container disagrees (6.3).
2. Decide the optional hover ride-along (section 10, item 4).
3. Confirm the mechanism for section 5 item 3, and the Night Heron event's year (section 11).
4. Build fixtures for the states this spec specifies but the mockup does not draw (section 2), and measure the longest rename pair at 320px and 200% text once renames are in the record.
