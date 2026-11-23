# Design Spec: Family Rollups and Tree

The Engineer builds from this document. It follows the amended `prd.md`, the amended `schema.md` (sections 6.5, 8.3, 9, 11, 12 and 23) and the reconciled mockup `pipeline/family-rollups-and-tree/design.html`, which the user approved in three rounds (decisions D-20, D-23). Section 16 says which document governs where they still differ.

The mockup is one self-contained page. Its class prefix is `sr-ft-`, which is the prefix to build with (the schema's host is `.sr-ft-host`). Everything under `.mk-*` is mockup chrome and is not built. Rules the mockup scopes under `.mk-phone` are the app's `@media (max-width: 640px)` tier. The mockup's script holds a mock of `useMapFullscreen`; nothing in that mock is this build's to write (schema 11.9).

## 1. Visual direction

Quiet utility, inside the established design system: one card on the page ground, the Life Lists filter strip, three headline figures, and one of two views. Nothing is minted. The accent means active or actionable and appears in four places only: a pressed control, the bars that show a share of the world, the active node with its lineage, and the phone's Open the tree button. The tree is the payoff: four columns of real text joined by hairline curves, read left to right from order to species, with the birder's own birds and nothing else.

Type is the app's: Inter with the system fallback. Three roles are used and no fourth is introduced.

| Role | Size and weight | Where |
|---|---|---|
| Headline figure | 1.5rem / 700, tabular, tracking -0.02em | The three headline counts |
| Tab title | 1.125rem / 700, tracking -0.01em | "Family Tree" |
| Readout name | 1rem / 700, tracking -0.01em, line-height 1.3 | The active node's leading name |
| Body | 0.84375rem, weight by level (below) | Tree labels, table names, species links |
| Description | 0.8125rem, `--sr-text-muted`, line-height 1.5 | The tab's one-line description, the readout's rest lines |
| Second name | 0.71875rem / 400, `--sr-text-gray` | A scientific name under or after a common name |
| Label | 0.6875rem / 700 uppercase, tracking 0.06em, `--sr-text-muted` | REGION, YEAR, MEDIA, SORT |
| Micro label | 0.625rem / 700 uppercase, tracking 0.07em, `--sr-text-muted` | Column headers, readout eyebrow, find result level |
| Note | 0.71875rem, `--sr-text-gray`, line-height 1.5 | Standing lines and footers |

Italic follows the name, never the state (schema 6.5): a genus or species scientific name is italic; a family or order scientific name is upright; a common name is never italic.

## 2. Tiers

There is one width query and one measured threshold. Nothing else decides layout.

| Tier | Condition | Tree in the page | Table |
|---|---|---|---|
| Wide, columns | window wider than 640 CSS px and the tree's box at least 54rem wide | Live, four columns | Grid with a column header |
| Wide, outline | window wider than 640 CSS px and the box narrower than 54rem (a narrow window, or 150% or 200% in-app text) | Live, indented outline | Rows stack when the list is narrower than 44em |
| Still tier | window at or under 640 CSS px (`fs.stillTier`, the hook's one query; never restated in this build) | A still with the opener beneath | Flows with the page, rows stacked |

- The still tier is a window width, not a device and not a text size. A desktop window dragged to 640 px or under gets it. A phone in landscape wider than 640 px does not.
- The form (columns or outline) is chosen by the box's own width through `formFor`, so full screen can change it: at 150% text on a 1440 px window the page box is an outline and the full-screen box is columns. State is kept across that change (section 9.6).
- The mockup bar's "Narrow tree: Columns" choice is a comparison that was not taken. Only the outline is built for the narrow form.
- Inside the still tier three things follow a width in rem, so that large text counts as a narrow window: the headline's form (three-up from 16.5rem of its wrapper, one column below, section 5), the full-screen tools' captions (section 10.3) and the full-screen readout's form (section 10.3). None of them is a second window breakpoint.

## 3. The tab in the shell

- **Label:** Family Tree (`TAB_LABELS`), key `family-tree`.
- **Icon:** lucide `Network`, used nowhere else in the app. Sizes from `NAV_ICON`.
- **Default position:** between Breeding Codes and Hotspot Reports (D-13). On a phone it is in the More sheet until moved.
- **Tab page header:** the house header. A 30 px tile (`--sr-accent-bg`, radius 8, the icon at 15 px in `--sr-accent`), the `h2` "Family Tree", and the description "Your life list arranged by order, family, and genus, as a table and as a tree you can zoom."

The card (`.sr-ft-card`: `--sr-surface`, 1px `--sr-border`, radius 12, `--sr-card-shadow`, no `overflow: hidden`, so listboxes can hang below it) holds, top to bottom:

1. The filter strip.
2. The headline, then the standing notes.
3. The view bar: the view switch and the Names control.
4. The host: the toolbar (Find, then the view's tools), then the view.
5. On the still tier in the tree view: the opener row.
6. In the tree view: the footer lines.

## 4. Filter strip

`.sr-ft-controls sr-ctl-row`: the Life Lists strip (`--sr-surface-faint`, padding 12px 18px, a bottom rule in `--sr-border-subtle`, radius 11px 11px 0 0). One wrapping row, gap 6px, with `.sr-pill-sep` separators that are hidden on the still tier.

| Control | Form | Notes |
|---|---|---|
| Region | The Life Lists region picker, reused (`LifeListsRegionPicker` or its choice builder), label "Region" | Placeholder "Everywhere". While a region is set the field takes `--sr-accent-bg`, `--sr-accent-border-strong` and `--sr-accent` text |
| Year | Native `<select>` at the strip's 30 px register (1.5px `--sr-border-input`, radius 6, 0.75rem / 600), label "Year" | "All years", then each year newest first. Tinted the same way while set |
| Include Escapees | The shared `ToggleSwitch`, boxed, off by default | Label from `SWITCH_LABELS.escapees` |
| Media | Label "Media", then three cycling tri-state pills, the Checklists pill | Each cycles any, has, lacks |

Media pill states, per kind (Photo, Audio, Video):

| State | Text | Glyph | Look | Exposed as |
|---|---|---|---|---|
| any | "Photo" | Camera, Mic or Video at 12 px | `.sr-pill` at rest | `aria-pressed="false"` |
| has | "Has photo" | Check at 11 px, stroke 3 | `aria-pressed="true"` accent look | `aria-pressed="true"` |
| lacks | "No photo" | X at 11 px, stroke 3 | `data-state="negative"` | `aria-pressed="true"`, the text carries which |

The state is carried by the words and the glyph, never by color alone. Title on each pill: "{Kind}. Press to cycle: any, has, lacks".

With no readable Macaulay Library export the three pills stay focusable with `aria-disabled="true"`, ignore activation, and point `aria-describedby` at the note under the strip (section 13).

Still tier: Region takes the first line whole; every control is at least 2.75rem tall; the 16 px control-font floor applies through `.sr-ctl-row`.

## 5. Headline and standing notes

**Headline** (`.sr-ft-glance`, a `<dl>` in a polite live region that is always rendered): three tiles on `repeat(auto-fit, minmax(min(15rem, 100%), 1fr))`, gap 12px 36px, padding 14px 18px 13px. Each tile is one wrapping line and a bar:

- the count (headline figure), the label ("SPECIES", "FAMILIES", "ORDERS") in the label register with `--sr-text`, then "of **{world}** in the world" and the share at the right, both in the note register;
- a 5 px bar (`--sr-surface-subtle` track, `--sr-accent` fill, radius 3, `aria-hidden`), its width from the two integers. A zero count draws no fill.

**The headline on the still tier** (amended 2026-11-23 for QA-79, NFR-07 and FR-36; it read "three equal columns" with no rule for when they cannot hold their figures, and a four-digit count was drawn over the next tile's count at large text). It has two forms there, and which one shows follows the headline's own width in rem, so it answers the text size as well as the window. There is no two-up form: three tiles in two columns leave one alone.

- **The container.** The `<dl>` gains a wrapper, `<div class="sr-ft-glance-wrap">`, with `container-type: inline-size; container-name: sr-ft-glance; min-width: 0`. Its width is the card's inner width. It exists on every tier and nothing queries it outside the still tier's block.
- **Three-up, where the wrapper is 16.5rem or wider.** The form the user approved, unchanged: three equal columns (`repeat(3, minmax(0, 1fr))`), gap 12px 14px, padding 14px 12px 12px; each tile stacks label (0.6875rem / 600, `--sr-text-muted`), count (1.375rem / 700), denominator, share, bar.
- **One column, where the wrapper is narrower than 16.5rem.** One tile per row, left aligned, 12 px between tiles, the same padding. Each tile takes the wide tier's own tile form at the still tier's count size: the count (1.375rem / 700) and its label (0.6875rem / 700, `--sr-text`) on one baseline 8 px apart; then "of **{world}** in the world" with the share at the row's right end (`flex: 1 1 8rem`, `justify-content: space-between`); then the bar, full width, 5 px tall, 4 px below. The tile is a wrapping row, so a part that does not fit beside the one before it moves to a line of its own whole: the label under the count, the share under the denominator. Nothing breaks inside a word, and every figure keeps its words.
- **Type.** No size changes in either form.

Where each form shows, at the app's four text sizes: a 320 px window is three-up at 100% and one column from 125%; a 360 px window the same; a 390 px window is three-up at 100% and 125% and one column from 150%; a 430 px window the same; a 600 or 640 px window is three-up at all four.

**The rule, in the tab's own blocks of `globals.css`** (class names as built; the five three-up declarations move inside the query and nothing else changes):

```css
/* beside .sr-ft-glance, every tier */
.sr-ft-glance-wrap { container-type: inline-size; container-name: sr-ft-glance; min-width: 0; }

/* in the tab's still-tier block, inside @media (max-width: 640px) */
.sr-ft-glance { padding: 14px 12px 12px; gap: 12px 14px; }
.sr-ft-tile-value { font-size: 1.375rem; }
@container sr-ft-glance (width >= 16.5rem) {
  .sr-ft-glance { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .sr-ft-tile { flex-direction: column; flex-wrap: nowrap; align-items: stretch; }
  .sr-ft-tile dt { order: 0; color: var(--sr-text-muted); font-weight: 600; }
  .sr-ft-tile-den { flex: none; }
  .sr-ft-tile .sr-ft-bar { flex: none; }
}
```

Under 16.5rem the base rules stand, which is the one-column form: the base grid (`repeat(auto-fit, minmax(min(15rem, 100%), 1fr))`) is one column at these widths, and the base tile is the wrapping row.

**Why 16.5rem.** Measured on the built app (main at `1adfc0b3`) in Chromium and WebKit, in Inter (Debian's `fonts-inter` 4.1, served to the page from the scratchpad and proven by a width test in which `'Inter', serif` and `'Inter', monospace` agree only when Inter resolves) and in SF (this Mac's fallback for the same stack):

| Measure | Inter | SF |
|---|---|---|
| A five-digit count ("11,070", tabular, so any five digits) at 1.375rem / 700 | 4.649rem | 4.668rem |
| A four-digit count | 3.788rem | 3.806rem |
| The longest label, "FAMILIES", at 0.6875rem / 600 | 3.494rem | 3.597rem |

- A three-up column is a third of the wrapper less 52 px (24 px of side padding and two 14 px gaps).
- The wrapper is 16.875rem in a 320 px window at 100% text and 21.25rem in a 390 px window at 100%. Both were approved as three-up, so the threshold cannot be above 16.875rem; 16.5rem leaves 6 px under the 320 px window.
- At exactly 16.5rem with a 16 px root, the worst case because the pixel parts weigh most there, a column is 70.67 px: the five-digit count (74.7 px in SF) ends 4 px past its own column and 10 px short of the next tile, and every label fits on one line with 13 px to spare.
- Tried on the built page with this rule added and the worst case written into the tiles (11,070 of 11,070 species, 250 of 250 families, 45 of 45 orders), at 320, 360, 390, 430, 600 and 640 px and at 100%, 125%, 150% and 200%, in both faces and both engines, 96 configurations with the face proven in each: the form is three-up exactly where the wrapper is 16.5rem or wider; in three-up the species count ends at least 12.0 px short of the families tile (the least is the 320 px window at 100%, where it sits 1.7 px in Inter and 2.0 px in SF past its own column, inside the gap); every label is one line; the headline's text never passes the headline's right edge; the page never scrolls sideways.
- With the app's own data, at 320, 390 and 640 px and 100% text, in both faces and both engines, every box in the headline is in the same place before and after the rule is added.

**What a check of tile against tile asserts** (a leg of the real-engine harness, with the face named and proven, in Inter and in the fallback face, in both engines; at 320 and 390 px and all four text sizes at least; on a roster or fixture that gives a five-digit species count, and on the demo roster):

1. The form: three columns exactly where the wrapper's width over the root font size is 16.5 or more, one column otherwise.
2. In three-up, each tile's count (its text's own box, not its element's) ends at least 6 px before the next tile's left edge.
3. In either form, no text box of one tile crosses a text box of another, and no text in the headline passes the headline's content edge.
4. Each label is one line: its box is no taller than one line of its own line height. A label never breaks inside the word.
5. Each tile's count, label, denominator and share are present as text.
6. The page does not scroll sideways.
7. At 320 and 390 px and 100% text the form is three-up (the approved look is not traded away by a later change of the threshold).

It must not assert that a count stays inside its own tile: at the approved 320 px and 100%, a five-digit count is 2 px past its column by design, in the gap.

The species figure is the whole roster, unplaced species included. Shares go through `fmtSharePct`.

**Standing notes** (`.sr-ft-notes`, note register, under the headline, each present only on its condition):

| Condition | Sentence |
|---|---|
| Region, Year or a Media constraint is off its default | "Family totals are world species and do not change with the filters." |
| An export is readable and a Region or Year is set | "Photo, audio, and video figures count only media from **{region}** dated **{year}**." with only the clause that applies ("from **{region}**." or "dated **{year}**.") |
| Statistics' escapee check is not complete for this export | "Escapee status comes from the escapee check on Statistics, which has not finished for this export, so species it has not settled are counted." |

## 6. View bar: the view switch and Names

`.sr-ft-viewbar sr-ctl-row`: padding 10px 18px, a rule above and below in `--sr-border-subtle`, one wrapping row.

**View switch** (left): the `.sr-segbar` register, `role="group"` named "View", two options with `aria-pressed`, each a glyph then its word: "Table" (lucide `Rows3`) and "Tree" (lucide `Network`), 13 px. Stored values are `'rollup'` and `'diagram'`.

**First view (FR-53, D-35).** With no stored choice the tab opens on the tree when the window is wider than the still tier and on the table at or under it. It is read when the tab opens, writes nothing, and does not switch if the window later crosses the tier. After the first change of view the choice is stored and stands on every tier. Where FR-71's gate withholds the diagram the tab opens on the table.

**Names** (right, `margin-left: auto`): the compact segmented toggle (`.sr-segbar.sr-segbar--compact`: 1.5px `--sr-border`, radius 6, 0.71875rem), three options at min-height 30 px: "Common", "Scientific", "Both". `role="group"` named "Names shown"; each option `aria-pressed`. It has no visible label. It opens on Both and is remembered under `familyTreeNames`. Its options may wrap at large text; dividers are each option's own left and top edge (a `box-shadow` in `--sr-border` clipped by the shell), so a wrapped row stays ruled.

On the still tier each control takes a full row, options share it equally, and each is at least 2.75rem tall.

### 6.1 What each Names state shows, at all four levels

One rule, `nameOf` (schema 6.5). An order and a genus are scientific by nature and carry a common name from the asset (an order always, a genus where the rule gives one). A family and a species are common by nature and carry a scientific name.

| Level | Common | Scientific | Both |
|---|---|---|---|
| Order | Waterfowl | Anseriformes | Waterfowl, then Anseriformes |
| Family | Ducks, Geese, and Waterfowl | Anatidae | Ducks, Geese, and Waterfowl, then Anatidae |
| Genus with a derived name | Geese | *Anser* | Geese, then *Anser* |
| Genus without one | *Branta* | *Branta* | *Branta* alone |
| Species | Canada Goose | *Branta canadensis* | Canada Goose, then *Branta canadensis* |
| Unplaced species with no scientific name in the backup | its common name | its common name | its common name alone |

No row or node is ever nameless. Every accessible name carries the names the eye sees. The readout always shows both.

How "then" is drawn:

| Surface | Both |
|---|---|
| Tree label, either form | The second name on a second line under the first, in the second-name register. A label takes its second line only where the room it owns holds two lines; elsewhere it shows its leading name alone (section 9.3) |
| Table family row, table species row | Stacked: the second name beneath, as `LifeListsRows.tsx` stacks it |
| Table order heading, table genus line | Inline: the second name after the first on the same line, in the second-name register |
| Find result | Stacked: the other name beneath |

### 6.2 The order names (authored, approved by the user; QA-92 checks the shipped table against this one, name for name)

| Order | Common name | Order | Common name |
|---|---|---|---|
| Struthioniformes | Ostriches | Opisthocomiformes | Hoatzin |
| Casuariiformes | Cassowaries and Emu | Eurypygiformes | Kagu and Sunbittern |
| Apterygiformes | Kiwis | Phaethontiformes | Tropicbirds |
| Rheiformes | Rheas | Gaviiformes | Loons |
| Tinamiformes | Tinamous | Sphenisciformes | Penguins |
| Anseriformes | Waterfowl | Procellariiformes | Tubenoses |
| Galliformes | Gamebirds | Ciconiiformes | Storks |
| Columbiformes | Pigeons and Doves | Suliformes | Cormorants and Allies |
| Mesitornithiformes | Mesites | Pelecaniformes | Pelicans and Herons |
| Pterocliformes | Sandgrouse | Cathartiformes | New World Vultures |
| Otidiformes | Bustards | Accipitriformes | Hawks and Eagles |
| Musophagiformes | Turacos | Strigiformes | Owls |
| Cuculiformes | Cuckoos | Coliiformes | Mousebirds |
| Caprimulgiformes | Nightjars | Leptosomiformes | Cuckoo-roller |
| Nyctibiiformes | Potoos | Trogoniformes | Trogons |
| Steatornithiformes | Oilbird | Bucerotiformes | Hornbills and Hoopoes |
| Podargiformes | Frogmouths | Coraciiformes | Kingfishers and Allies |
| Aegotheliformes | Owlet-nightjars | Piciformes | Woodpeckers and Allies |
| Apodiformes | Swifts and Hummingbirds | Cariamiformes | Seriemas |
| Gruiformes | Rails and Cranes | Falconiformes | Falcons and Caracaras |
| Charadriiformes | Shorebirds and Gulls | Psittaciformes | Parrots |
| Phoenicopteriformes | Flamingos | Passeriformes | Perching Birds |
| Podicipediformes | Grebes | | |

Forty-five rows. The longest is 23 characters; the order column is sized for it (section 9.2). Genus names are derived by the generator under FR-83's rule and are not authored here.

## 7. The host and its toolbar

`.sr-ft-host` holds the toolbar, the empty line, the tree view and the table view. It is the one container that becomes the full-screen panel, by the hook's class swap (section 10). It declares none of the eight properties the shared panel class sets, except under `.sr-ft-host:not(.sr-map-fs-panel)` or the compound selector.

**Toolbar** (`.sr-ft-toolbar sr-ctl-row`): padding 10px 18px, a bottom rule in `--sr-border-subtle`, one wrapping row, gap 8px 10px. Left to right: Find; the tools (`role="toolbar"` named "View tools", `margin-left: auto`); the full-screen toggle.

| Control | Shown in | Form | Accessible name |
|---|---|---|---|
| Find | both views | Section 8 | "Find a species, genus, family, or order" |
| Zoom out | tree | 30 px glyph button, lucide `ZoomOut` | "Zoom out" |
| Zoom readout | tree | "{n}%" of full zoom, 0.71875rem / 600 tabular, `aria-hidden` | none |
| Zoom in | tree | 30 px glyph button, lucide `ZoomIn` | "Zoom in" |
| Fit | tree | glyph (lucide `Scan`) and "Fit" | "Fit the whole tree" |
| Sort | table | label "Sort" and a native `<select>` | its label |
| Expand all | both views | glyph (lucide `ChevronsUpDown`) and "Expand all" | "Expand all" |
| Collapse all | both views | glyph (lucide `ChevronsDownUp`) and "Collapse all" | "Collapse all" |
| Reset | tree | glyph (lucide `RotateCcw`) and "Reset" | "Reset the tree" |
| Full-screen toggle | tree, every tier | 30 px glyph button, `aria-pressed`, lucide `Maximize2` and `Minimize2`, registered through `fs.registerToggle` | "Enter fullscreen" and "Exit fullscreen" (the maps' vocabulary) |

Tool buttons are `.sr-ft-tool`: min-height 30 px, padding 0 10px, radius 6, 1px `--sr-border-medium`, `--sr-surface`, 0.75rem / 600, `--sr-text`, gap 6px; hover `--sr-surface-subtle` only inside `@media (hover: hover)` and gated off `:disabled` inside `:where()`; disabled takes `--sr-border`, `--sr-surface-subtle`, `--sr-text-disabled`. All render through the `Button` primitive. Zoom out and Fit are disabled at the fit; Zoom in is disabled at full zoom; all six tree tools are disabled while the roster is empty.

Expand all and Collapse all are one pair acting on the view that is showing. In the table, Expand all opens every family and the Not placed group; Collapse all closes them; order headings stay (FR-84, with schema 9.2's chunked mounting). Both keep focus on the pressed control.

Sort options, in order: "Taxonomic order", "Family name", "Species seen", "Share of world species", and with a readable export "Species photographed", "Species recorded", "Species filmed".

**Still tier, in the page.** In the tree view the toolbar shows Find alone (the tools and the toggle are not rendered while `fs.still`). In the table view it shows Find, then Sort with the two cells Expand and Collapse.

**Still tier tool cells.** On the still tier a tool is a cell: the glyph over a caption at 0.625rem / 600 (the bottom bar's cell form), min-height 3rem. Captions: "Zoom out", "Zoom in", "Fit", "Expand", "Collapse", "Reset". The accessible names are unchanged.

## 8. Find

The house combobox: one `role="combobox"` input (`.sr-ft-input` in the Region field's anatomy, with a leading Search glyph), a `role="listbox"` named "Matching species, genera, families, and orders" of `role="option"` rows chosen through `aria-activedescendant`, ids keyed on the row's index. It lives inside the host, so it is in the page on every tier and inside the panel in full screen, and its list renders inside the host, never in a portal.

- **Placeholder and accessible name:** "Find a species, genus, family, or order".
- **Match:** a row matches when its common or its scientific name contains the query, in every Names state; species also match by four-letter code (schema 12).
- **Rank:** code hits; a word start in the leading name; elsewhere in the leading name; the other name only. Within a tier: species, families, genera, orders, each in taxonomic sequence. At most 50 rows.
- **A result row:** the leading name, the other name beneath in the second-name register where there is one, and its level at the right in the micro-label register: "Species", "Genus", "Family", "Order".
- **No match:** "Nothing matches this search."
- **Keys:** Down and Up move the active option, Enter chooses it, Escape closes the list only and is consumed at the element while the list is open.
- **Motion:** the list scales in from the field's top left corner (`scaleY(0.92)` to none, 140 ms, `cubic-bezier(0.2, 0, 0, 1)`); closing is instant.
- **Reveal in the tree:** the taxon's ancestors open, it becomes the active node, the zoom rises to one line per leaf if it was below that, it is centered, and focus moves to the tree.
- **Reveal in the table:** the sort returns to taxonomic order, the family opens, the row scrolls to the middle and takes focus (a species' link; a family's or genus's family row). For an order, its heading scrolls to the top and focus moves to its first family row. An unplaced species opens the Not placed group.
- **On the still:** choosing a result calls `fs.open()` and reveals the taxon in full screen.

Width: `flex: 1 1 15rem`, at most 24rem, never wider than its row (`min-width: min(11rem, 100%)`). On the still tier it takes the row.

## 9. The tree

### 9.1 The box

`.sr-ft-box`: the one scrolling element, `role="tree"`, named "Family tree of your species", `aria-describedby` a visually hidden sentence, "The Table view holds the same information as a list." `overflow: auto`, `contain: layout paint`, `touch-action: pan-x pan-y`, `--sr-surface`.

| Where | Height |
|---|---|
| In the page, wider than the still tier | `clamp(min(20rem, 62vh), calc(64vh - 9.5rem), 40rem)`. The first term keeps the box no taller than the window at any text size |
| The still | `min(17rem, 42dvh)`, `overflow: hidden`, `touch-action: auto` |
| Full screen | The rest of the panel (section 10) |

A press or focus that lands on a box only partly in view, outside full screen and off the still tier, first brings the whole box into view (`scrollIntoView({ block: 'nearest' })`, with `scroll-margin: 3.5rem 0 0.75rem`).

Cursor: `grab`, and `grabbing` while a mouse drag is under way.

### 9.2 Columns form

- A sticky header inside the box (`.sr-ft-colhead`: 1.75rem tall, `--sr-surface-faint`, a bottom rule in `--sr-border`, `aria-hidden`), its four labels in the micro-label register at each column's start: "ORDER seen / world", "FAMILY seen / world", "GENUS", "SPECIES". The words "seen / world" are 500 weight, not uppercase.
- The plane is the box's width or 54rem, whichever is larger. Column starts, as fractions of the plane inside 0.75rem side padding: order 0, family 0.26, genus 0.545, species 0.70. Each of the first three columns ends 1.75rem before the next (the link zone). The species column is at most 19rem wide.
- Lanes: the order and genus columns sit on `--sr-surface-faint`; the family and species columns on `--sr-surface`.
- A branch's label sits beside the middle of the visible part of its span (computed, not CSS sticky), so the order and family a reader is inside stay in view while species scroll past.
- Edges: one stroked path in `--sr-border-medium` at 1.25 px, a cubic from the link zone's start at the parent's label height to 3 px before the child (`M x0,yp C mx,yp mx,yc x1,yc`). An open branch's label carries a leader, a 1.25 px rule from its text to the link zone.

### 9.3 Outline form

- No header and no lanes. Each level is indented 1.125rem; a label runs to the plane's right edge. The plane is the box's width or 17rem, whichever is larger.
- An open branch has a row of its own above its children (schema 11.3).
- Edges are elbows: down from under the parent's label, then across to the child, in the same stroke.

### 9.4 Pitches and level of detail

Three pitches, in rem, carried in `metrics` (schema 11.3):

| Pitch | Columns | Outline |
|---|---|---|
| `line`: the least room for a label of one line | 1.125 | 1.375 |
| `twoLine`: the room a label needs for its second line | 1.875 | 2.125 |
| `full`: one leaf at full zoom | 1.625; 2.25 in Both; 1.875 and 2.5 on the still tier | 1.75; 2.5 in Both; 2.125 and 2.75 on the still tier |

Text never changes size with zoom. Level of detail decides which nodes have a label, one sibling group at a time, inside the room its parent's label owns:

1. If a line fits for every sibling, all are named, spread so that no two labels are closer than a line and each is as near its own place as the others allow.
2. Otherwise a sibling at least one line tall keeps its name, and each run of smaller siblings between two of those is named if the gap has a line for each, drawn as ONE count if the gap has a line at all, and as a dot on its edge if it has none.
3. Each label then owns the room up to the line it shares with its neighbors. Its children are laid out inside that room in proportion to their leaves, so labels in the next column can never collide.
4. In Both, a label takes its second line where the room it owns holds `twoLine`; otherwise it shows its leading name.
5. The active node and its ancestors are always drawn by name.

**A count** (`.sr-ft-bundle`): a pill (radius 999px, 1px `--sr-border-medium`, `--sr-surface-subtle`, 0.6875rem / 500 tabular, `--sr-text-muted`), reading "{n} species" for a run of species and "{n} {orders | families | genera} · {m} species" otherwise. It is not a tree item. For a pointer it zooms to its run (cursor `zoom-in`, title "Zoom in to this part of the tree"); the keyboard path to the same place is the arrow keys and Focus.

### 9.5 Zoom, Fit and Reset

- Zoom is one number, the pixels per leaf slot, between the fit and `full`. Zoom in and Zoom out step by 1.5 about the box's middle, snapping to either end within 6%. The readout shows the zoom as a percentage of `full`.
- **Fit is a true fit.** It sets the pitch to the box's usable height over the drawn tree's slots, from the top, so every drawn node is inside the box (QA-55 as written). It has no floor. Where the orders do not each get a line, rule 2 above applies to the orders as to any siblings: the larger orders keep their names and each run of smaller ones is one count.
- Reset returns to the arrival state.
- Zooming and panning are never animated: a zoom re-lays the tree out at once.
- Gestures and keys are schema 11.5's: a plain wheel pans the box and chains to the page; Ctrl or Cmd with the wheel, a trackpad pinch and a two-finger pinch zoom about the pointer; a mouse drag pans one to one with no threshold and no motion after release; a double-click on empty space zooms in one step; with focus in the tree, `+` or `=` zooms in, `-` zooms out, `0` fits.

### 9.6 Arrival, and what is kept

**Arrival** (first layout, and Reset): full zoom, from the top, nothing active. Columns: every branch open, so the first thing read is species by name. Outline: orders open to their families.

**Kept across every relayout** (D-28, schema 11.3): expansion, the active node, zoom as a fraction of full zoom, and place as the node at the top of the box with its offset. A relayout is a resize, entering or leaving full screen, a change of form, of Names, of text size, or a new model. A relayout never starts over and never scrolls to the active node.

- A tree opened to orders only in the outline, on becoming columns, is columns with orders open to families: the order and family columns filled, the genus and species columns empty until a family is opened.
- If the anchor node is no longer drawn, its nearest drawn ancestor is used, then the top.

**The moves that may scroll the tree:** a keyboard move, a find reveal, choosing an ancestor in the readout (each centers the node if it is out of view); a press on a node (the least scroll that shows it); Fit, Reset, Expand all, Collapse all, Focus, a press on a count. A selection takes effect after the readout has taken its height, because in full screen the readout takes that height from the box.

### 9.7 Nodes

A node is a `div role="treeitem"` positioned on the plane, with `aria-level`, `aria-expanded` where it can expand, `aria-selected`, `aria-setsize` and `aria-posinset` from the data, an index-keyed id, and no `tabIndex`, anchor or handler of its own.

| Level | Label | Figure | Weight |
|---|---|---|---|
| Order | leading name | "**{seen}**/{world}" | 700, tracking -0.005em |
| Family | leading name | "**{seen}**/{world}" | 600 |
| Genus | leading name | "**{seen}**" | 500 |
| Species | leading name | the media cell at the label's right edge, when an export is readable | 500 |

- A branch's label is a chip (`.sr-ft-chip`): a 1rem twisty (lucide `ChevronRight` at 12 px, turned 90 degrees when open, 140 ms ease-out), the name (ellipsis if it must), the figure (0.6875rem tabular; seen in `--sr-text` at 600, the rest in `--sr-text-muted`).
- The media cell is the Life Lists presence cell (three fixed slots: Camera, Mic, Video at 12 px; has in `--sr-text`, lacks in `--sr-border-medium`), `aria-hidden` on a leaf because the item's accessible name says it.
- **Accessible name:** "{Level}, {leading name}[, {second name}], {figures}". Figures: an order or family "{seen} of {world} species"; a genus "{seen} species"; a species the kinds it has ("photo and audio") or "no media".
- **Hover** (inside `@media (hover: hover)`, never on the active node): `--sr-surface-subtle` on the chip or the leaf, 120 ms ease-out.
- **Active:** `--sr-accent-bg` fill, a 2 px inset ring in `--sr-accent`, the name in `--sr-accent` at 700. Three cues, two of them shape. It is drawn above its neighbors.
- **Lineage:** the active node's ancestors take `--sr-accent` names, and the edges from the order to the active node are a second path in `--sr-accent` at 2 px with a 2 px accent leader.

Pointer: a press on a node selects it. A press on its twisty, or on a node that is already active, opens or closes it.

### 9.8 Keyboard

The tree is one tab stop, in the page and in full screen. Focus is shown by a 3 px frame in `--sr-accent` drawn over the box (`.sr-ft-boxwrap::after`, lit by `:has(> .sr-ft-box:focus-visible)`), so neither the sticky header nor a label can cover it.

| Key | Columns | Outline |
|---|---|---|
| Any arrow with nothing active | The first order becomes active | The same |
| Down, Up | Next or previous drawn node at the same level | Next or previous drawn node in reading order |
| Right | Open a closed branch; on an open branch, go to its middle child | Open a closed branch; on an open branch, go to its middle child |
| Left | Go to the parent | Close an open branch; otherwise go to the parent |
| Home, End | First or last drawn node at the same level | First or last drawn node |
| Enter, Space | Open or close a branch; on a species, move focus to its name in the readout | The same |
| `+` or `=`, `-`, `0` | Zoom in, zoom out, fit | The same |

Every pointer action on a node has one of these.

### 9.9 The readout

`.sr-ft-readout`: a region named "Selected", directly after the box in DOM order, with no live semantics. It is rendered from first paint and never unmounted. `--sr-surface-faint`, a top rule in `--sr-border`, padding 12px 18px 13px. Its content cross-fades in over 140 ms when the selection changes.

**Layout.** Columns form: three columns (`minmax(0, 1.05fr) minmax(0, 1.25fr) minmax(0, 1fr)`, gap 10px 32px), min-height 6.25rem. Outline form: one column, min-height 11.5rem in the page.

**Content, by the kind of active node.** The parts are named because full screen can drop them (section 10.3).

| Kind | Identity | Figures | Detail | Lineage | Actions |
|---|---|---|---|---|---|
| Nothing | Eyebrow "NOTHING SELECTED"; "Select a branch or a species to see its figures and links here." | | The hint line (below) | | |
| Species | Eyebrow "SPECIES"; `<BirdName>` at the readout-name size with `showSci`, its Species Detail link and its eBird and Birds of the World marks | The media cell and its words ("Photo and audio", "Photo, audio, and video", "No media"), when an export is readable | | Genus, Family, Order | |
| Genus | Eyebrow "GENUS"; the common name where it has one with the scientific name beneath in italic, else the scientific name in italic | "**{n}** species seen" | | Family, Order | Expand or Collapse; Focus |
| Family | Eyebrow "FAMILY"; common name; scientific name beneath, upright | "**{seen}** of {world} world species", the share, a 4 px bar | Per kind, when an export is readable: "Photographed", "Recorded", "Filmed", each "**{n}** species · {items} {photos | recordings | videos}". The two outside links, when verified | Order | Expand or Collapse; Focus |
| Order | Eyebrow "ORDER"; common name; scientific name beneath, upright | "**{seen}** of {world} world species", the share, a bar | "**{n}** of {world} world {family | families}", the share, a bar | | Expand or Collapse; Focus |

- **Hint line** at rest: "Drag to move. Pinch, or hold Ctrl or Command and scroll, to zoom." While the zoom is below one line per leaf: "Where names do not fit, a branch shows as a count. Zoom in, or press a count, to see every name."
- **Lineage** rows are a term ("Genus", "Family", "Order") and a button in `--sr-accent` at 600 that makes that ancestor the active node and returns focus to the tree. The button reads the ancestor's common name, or its scientific name in italic where it has none.
- **Actions** are `.sr-ft-tool` buttons: "Expand" or "Collapse" (the toolbar's glyphs) and "Focus" (lucide `Focus`), which fits that branch in the box.
- **Family links**, each only when its flag is verified (D-12): "Birds of the World" and, with a readable export, "Your media in the Macaulay Library", each with a 12 px external glyph, through `OutboundLink`. Accessible names: "Open {family} on Birds of the World (opens in a new tab)" and "Open your {family} media in the Macaulay Library (opens in a new tab)". The readout reads complete without them.

**Tab stops the readout adds (FR-68, QA-86).** They follow the tree's stop, in DOM order, and depend only on the kind of active node.

| Active node | Stops, in order | Count |
|---|---|---|
| None | none | 0 |
| Species | the name link, the eBird mark, the Birds of the World mark, Genus, Family, Order | 6 (4 while the species' code is unresolved, when the two marks are absent) |
| Genus | Family, Order, Expand or Collapse, Focus | 4 |
| Family | Order, Expand or Collapse, Focus, then each verified outside link | 3 as shipped; 4 with the Birds of the World link; 5 with both |
| Order | Expand or Collapse, Focus | 2 |

In full screen in the outline form, where the readout drops parts (section 10.3): short form, species 3 (or 1), genus 2, family 2, order 2; least form, species 3 (or 1), the others 0.

The tree view's stops are therefore: the view switch (2), Names (3), Find (1), the tools (up to 6), the full-screen toggle (1), the tree (1) and the readout's count above. None grows with the roster.

### 9.10 Footer lines

Under the host in the tree view (`.sr-ft-treefoot`, note register, padding 9px 18px 10px, a top rule), each only when its count is above zero:

- "{N} species {is | are} not placed on the tree." followed by a text button, "Show {it | them} in the table", which switches to the table, opens the Not placed group and focuses its row.
- "{N} other {entry | entries} in your backup {is | are} not a single species, so {it has | they have} no place on the tree."

## 10. Full screen, the still and the opener

Everything in this section is the shared pattern (D-19 update, D-26, D-27, schema 11.9 and 11.10). The tree builds the inside of the panel and the two controls that toggle it, and nothing else: no stacking level, no bar handling, no trap, no Escape handler, no scroll lock, no opener classes.

### 10.1 The still (still tier, tree view, not expanded)

- The box's wrapper (`.sr-ft-boxwrap`) is the image: `role="img"`, not a tab stop, and a press anywhere on it calls `fs.open()`. Its name: "Your family tree: {N} species in {F} {family | families} and {O} {order | orders}", where N is the species drawn on the tree.
- The box inside carries the literal `inert` attribute, no `tabIndex`, no `aria-activedescendant` and no listener. It does not scroll, so a swipe that starts on it moves the page.
- **What it shows.** The tree from its top, at the larger of the true fit and one line per order, with the current expansion. Its view is derived and never written to the tab's view. Where the tree at that pitch is taller than the box, the box cuts it and a 3.5rem fade to `--sr-surface` covers the bottom edge. Where it is not, there is no fade. This is the still the user approved; it is not the Fit of section 9.5.
- **Its width** (decided 2026-11-23). In the still the outline's plane is exactly the box's width: the 17rem least width of section 9.3 does not apply, because the still cannot be panned. A row's name ends in an ellipsis inside the box and its figure stays whole. Measured on the built app (main at `1adfc0b3`, WebKit, in SF and in Inter): the 17rem plane is wider than the box from 125% text in a 320 px window and from 150% in a 390 px window, and rows are cut at the box's right edge, a figure mid-number among them ("Pigeons and Doves 7/3" at 390 px and 200%; 1 row at 320 px and 125%, up to 6 rows at 320 px and 200%). At 100% text nothing is cut at either width. The change narrows the plane by 2 px at 320 px and 100% (17rem against a 16.9rem box) and moves nothing drawn there, because the still's rows are left aligned; the built comparison of line boxes, old against new, is the check. In full screen the 17rem least width stays: there the box pans sideways and the readout carries the whole name.
- The tools, the toggle and the readout are not rendered. Find stays.

### 10.2 The opener

`<FsOpenRow fs={fs} label note />`, a sibling directly after the host, outside the box that expands, mounted while it is expanded, rendered only on the still tier and only in the tree view with a roster.

- Button: `sr-btn-accent sr-fs-open-btn sr-touch-target`, full width, min-height 2.75rem, radius 8px, 0.875rem / 600, a `Maximize2` glyph at 15 px, then the label "Open the tree".
- Helper line beneath (`.sr-fs-open-note`, 0.75rem, `--sr-text-muted`), wired with `aria-describedby`: "It opens in fullscreen, where it scrolls and zooms on its own."
- It is the keyboard and assistive path. The still adds a pointer path and nothing else.

### 10.3 The panel

The host with the shared class. Inside it, under the compound selector `.sr-ft-host.sr-map-fs-panel`:

- a flex column: the toolbar at its own height (on `--sr-surface`), the tree view filling the rest, the box taking what the readout leaves (`flex: 1 1 0`, min-height 30% of the panel), the readout at its own height;
- **the box is the only element that scrolls** (FR-88, QA-98). The toolbar and the readout never scroll in either axis;
- the rotate note is not shown;
- the readout insets its own bottom under `.sr-ios-app` (`env(safe-area-inset-bottom)`) with its `.sr-android-app` twin (`var(--sr-inset-bottom, 0px)`), 13 px above the inset.

**The toolbar in the panel.**

- Wider than the still tier: the page's toolbar, unchanged, wrapping as it does in the page. The toggle is the glyph button with `aria-pressed="true"` and the name "Exit fullscreen".
- Still tier: the toggle leads the toolbar (`order: -1`) as the shared Exit form: the `Minimize2` glyph, the visible word "Exit", the accessible name "Exit fullscreen", min-height 2.75rem. Find shares its row at every text size: `flex: 1 1 4rem; min-width: 0`, so it narrows beside Exit and never drops under it (made exact 2026-11-23: built with a basis of 11rem, Find dropped to a row of its own at 320 px from 150% text and at 390 px at 200%, the toolbar grew from 189 px to 285 px, and at 320 px and 200% the tree's box was 85 px, 15% of the panel, with the readout cut; with the 4rem basis the box is 177 px, 31%, and the readout is whole; the same in Inter and in SF; where Find already sits beside Exit its width is the same before and after, measured at 320 px and 100% and at 390 px and 150%). The six tools are ONE row that neither wraps nor scrolls: six equal cells, a glyph over its caption while six captions fit, and the glyph alone, with the same accessible names, when the row is narrower than 20.75rem (a 320 px phone at every text size, and a 390 px phone from 125% text). Glyph-only cells are `max(44px, 2.25rem)` tall. The figure is measured on the built toolbar (amended 2026-11-22; it was 19.5rem, taken from the mockup): the widest caption, "Zoom out", is 2.98rem, each cell adds 1 px of padding and 1 px of border on each side, and the five gaps are 4 px, so six captions need `6 * 2.98rem + 44px`, which is 20.63rem at a 16 px root and less at every larger text size. At 19.5rem a row between the two figures showed captions up to 3 px wider than their cells. The rule that hides the captions must outrank the rule that shows them.

**The readout in the panel.** In the columns form it is the page's three-column band. In the outline form it is the page's stacked readout, and it gives up its lower parts as the panel gets short, by the panel's height in rem, so that a large text size counts as a short panel:

| Panel height | Form | What shows |
|---|---|---|
| 40rem or more | Full | Everything in section 9.9 |
| 25rem to under 40rem | Short | Identity, Figures and Actions. Lineage and Detail are not rendered |
| Under 25rem | Least | Identity only (a species keeps its link and marks) |

On the still tier the readout's least height is `min(6.5rem, 20%)`. If a name wraps far enough that the readout would still exceed its share, it is cut at its bottom edge (`overflow: hidden`); it does not scroll. What a short or least readout drops stays reachable: lineage by selecting the ancestor in the tree, expand and focus by the keys and the toolbar, and every figure in the table.

Measured on the mockup in both engines, with a family active: 390 by 844 is Full at 100% and 125% and Short at 150% and 200%; 320 by 568 is Short at 100% and 125% and Least at 150% and 200%. In each of those eight the box was the only scroller, the tools were one row, the readout was not cut, and the box held 29% to 51% of the panel.

### 10.4 In and out

- In: the toolbar's toggle on every tier; on the still tier also the opener and a press on the still; choosing a find result on the still.
- Out: the toggle (Exit on the still tier) and Escape. With Find's list open the first Escape closes the list.
- Focus on the way in is the hook's default: it moves to the toggle when it was outside the host. This build adds no focus effect of its own. On the way out the hook returns focus to the opener on the still tier and to the toggle elsewhere, and restores the page's scroll offset.
- A view switch, an empty roster or leaving the tab collapses it (the hook's `active`).
- Expansion, the active node, zoom and place are the same after a round trip in either direction, at every text size (measured equal on the mockup at 100%, 125%, 150% and 200% on a 1440 px window and on the phone frame, in WebKit and Chromium).
- The bottom bar is hidden while the panel is open, by the shared `data-sr-fs-open` rule. No rule or line of this build names the bar or that attribute.

### 10.5 The rotate note

The app's `ChartViewTip`, with `page="family-tree"` and its body and accessible name passed from `familyTreeCopy.ts` (schema 11.10). Above the tree in the tree view, inside the host, on the still tier only, never in full screen, never before the saved flags have loaded.

- Kicker: "TIP".
- Body: "The tree gets more room in landscape. Rotate your device for a wider view, or open SnowRaven's desktop app if you have it."
- Accessible name of the note: "Tip about tree viewing options". Dismiss button: "Dismiss this tip".

## 11. The table

`.sr-ft-list` is its own container (`container-type: inline-size`). It flows with the page on every tier and has no scroller of its own.

**Column header** (`.sr-ft-cols`, `aria-hidden`, micro-label register on `--sr-surface-faint`): "FAMILY", "SEEN OF WORLD SPECIES", and with a readable export "PHOTOGRAPHED", "RECORDED", "FILMED", each with its 12 px glyph. Grid: `1rem minmax(0, 1fr) 12.5rem repeat(3, 6.75rem)`, column gap 16px, padding 9px 18px 10px; without an export, `1rem minmax(0, 1fr) 14rem`.

**Order heading** (`.sr-ft-oband`, taxonomic sort only): an `h3` with the order's leading name (0.8125rem / 700), the second name after it in Both (second-name register), then "**{seen}** of {world} species · **{families seen}** of {world families} {family | families}" in the note register. A top rule separates orders.

**Family row** (`.sr-ft-frow`): the whole row is one `Button`, a disclosure with `aria-expanded`, its name containing the family's leading name.

| Cell | Content |
|---|---|
| Chevron | lucide `ChevronRight` at 14 px, turned 90 degrees when open |
| Name | leading name (0.84375rem / 600); beneath, in the second-name register, the second name in Both, and under any sort but taxonomic the order's leading name, joined by " · " |
| Seen | "**{seen}** of {world}" and the share at the right, over a 4 px bar |
| Each media kind | the species with that kind (0.84375rem / 600; a zero in `--sr-text-muted` at 400), and beneath, "{items} {photos | recordings | videos}" when above zero |

Hover: `--sr-surface-subtle`, inside `@media (hover: hover)`. Focus: the global ring, inset 3 px.

**An opened family** (`.sr-ft-open`, conditionally rendered, on `--sr-surface-faint`, indented to the name column): for each genus a line with its leading name at 600 (italic when it is the scientific name), the second name after it in Both, and "{n} species"; then its species, each a row with `<BirdName>` and the media cell, divided by `--sr-border`. `<BirdName>` takes `showSci` in Both, neither in Common, and `lead="scientific"` in Scientific (D-30).

**Long names in an opened family** (decided 2026-11-23, on D-70). The genus line and the species name carry `overflow-wrap: anywhere` (`.sr-ft-genus`, `.sr-ft-sp .sr-birdname`), so a name wider than its row breaks inside the word and can never run past the row. This is accepted as built. Its one visible cost is a single letter carried to a second line where a word is a few pixels wider than the row: measured in Inter at 320 px and 200% text only ("Campylorhamphus" carries its "s", each "Laughingthrush" its "h"); in SF nothing moves at any width. No rule that avoids the lone letter is taken, because each one costs more than it buys:

- Hyphenation (`hyphens: auto`) depends on the engine and its dictionary, cannot be held to one result across WebKit, Chromium 111 and WebView2, and would still need this rule behind it.
- `text-wrap: balance` or `pretty` is not in the app's engine floor.
- Releasing the block's indent at that size would move every row of the block in SF as well, at a size where nothing is wrong in SF.

What would reverse it: a user reports the lone letter, or the app comes to draw Inter on a shipped platform. The fix then, and where: in the tab's block of `globals.css`, `@container sr-ft-list (width < 9rem) { .sr-ft-open { padding-left: 12px; } }`, which gives the row back the chevron column's indent (1rem plus 12 px, 44 px at 200%) only where the list is narrower than 9rem, which is a 320 px window at 200% text and nothing wider. That rule is written from the measured widths (a 207.45 px word in a 202 px row) and has not been tried in a browser. `overflow-wrap: anywhere` stays behind it.

**The family's outside link, in the opened family** (added 2026-11-22 for NFR-07 and QA-79; the family's Birds of the World link was in the tree's readout only). The table carries the same link the readout does, as the first line of the opened family block, above the first genus line. It is never inside the family row, which stays one disclosure `Button` with no interactive content in it.

- **Form.** A line `.sr-ft-open-links` (a `<p>`: `display: flex`, `flex-wrap: wrap`, `align-items: baseline`, gap 4px 18px, margin 0, padding 10px 0 0, `min-width: 0`) holding one `OutboundLink` with the readout's own class `.sr-ft-out` (0.78125rem / 600, `--sr-accent`, no underline at rest, underline on hover) and the 12 px `ExternalLink` glyph at stroke 2.2 after the text. The first genus line follows with its own 11 px top padding.
- **Wording.** Visible text "Birds of the World" (`BOW_LINK_TEXT`, the readout's). Accessible name "Open {family} on Birds of the World (opens in a new tab)" (`bowLinkLabel`), where {family} is the family's common name in every Names state, as in the readout. The visible text does not change with the Names control.
- **The same link.** The href is `bowFamilyHref(code)`, under the same flag and the same shape guard. When it returns null (the flag off, or a code that fails the shape) the line is not rendered: no empty line, no text and nothing that looks pressable. The Not placed group has no such line.
- **Room for a second link.** The line is a wrapping row, so a family-level Macaulay link, if it is ever verified (D-47 leaves it off), sits after this one as "Your media in the Macaulay Library", with a readable export only. Nothing is drawn for it now.
- **Tab order.** The family row's disclosure button, then this link, then the block's species in order (each species' name link and its two marks). One stop per open family.
- **320 px and 200% text.** Nothing in the line is `nowrap`: the link is at most the block's width (`max-width: 100%`, `min-width: 0`), its text may wrap (`overflow-wrap: anywhere` on the text) and the glyph does not shrink. Tried in both engines on a copy of the mockup: at 320 px and 200% the link is 218 px wide on one line inside a 218 px block, and the page does not scroll sideways at 320 px or 390 px.
- **Still tier.** The link carries `.sr-touch-target` (at least 2.75rem tall, its text centered on the glyph) and the line's top padding is 0, so the gap above it stays about what the wider tiers have.
- **Expand all.** The line is part of the block's frame, like a genus line, and mounts with the block's first chunk, before any of its species; it does not wait on the block's row limit and does not count toward schema 9.2's 150 species rows per chunk. Expand all therefore adds one anchor, and one tab stop, for each open family that has a link: at most one per family in the asset, against three stops for every species row.
- **Motion.** None of its own; it arrives with the block.

**Not placed** (only when not empty, after the last order): a heading "Not placed" with "**{N}** species", then a disclosure row reading "Species with no family here" over "{N} species, counted in the species total above". Open, it shows the reason, "eBird's taxonomy in this version of SnowRaven does not list {this name, so it has | these names, so they have} no family here.", then its species in name order.

**Footer** (`.sr-ft-tablefoot`): the two footer lines of section 9.10, the first without its button.

**Stacked** (the list narrower than 44em, which includes the still tier): the header is not shown; a family row is the chevron beside a stack of name, seen with its bar, and one media line of three glyph and count pairs, each with its words for assistive technology ("{n} species photographed,").

## 12. Loading, empty, error, media-less and not-placed states

| State | What shows |
|---|---|
| Loading | The shared loading indicator with its status label. No controls |
| No eBird backup | The house header, then the shared setup panel: "eBird Backup Required"; "The Family Tree tab loads automatically from your stored eBird backup. You haven't saved one yet."; the shared steps; the shared "Go to Settings" action. No controls, table or tree |
| Backup unreadable | The shared tab load-error alert with the shared eBird backup message |
| Family data failed to load | The same alert with "SnowRaven couldn't load its bird family data." No table or tree; never every species as unplaced |
| No Macaulay Library export | Under the strip: "Photo, audio, and video figures need your Macaulay Library export, saved in Settings under Default Files." The Media pills are `aria-disabled`. Media columns, media lines, media marks on leaves and in the readout, the three media sorts and the media scoping note are absent, not zero |
| Export unreadable | The same, with "SnowRaven couldn't read your Macaulay Library export, so photo, audio, and video figures are unavailable; re-upload it in Settings under Default Files." |
| Nothing counts, filters at default | In place of the view: "No countable species in your eBird backup yet." The strip, the headline (zeros, no bar fill), the view bar and Find stay; the tree's tools are disabled; full screen collapses and the opener is not shown |
| Nothing matches the filters | The same, with "No species match these filters." |
| Not placed | Section 9.10 and section 11 |
| Family links unverified | No link and nothing that looks pressable in its place |

The alert region is mounted, empty, in every branch that can reach an error.

## 13. Tokens

Every color is a `var(--sr-*)` token that exists in both themes. No token is added.

| Use | Token |
|---|---|
| Page ground; the shared panel's ground | `--sr-bg` |
| Card, box, toolbar in the panel, family and species lanes | `--sr-surface` |
| Strip, column header, order and genus lanes, readout, opened family, table header | `--sr-surface-faint` |
| Hover, bar track, count pill | `--sr-surface-subtle` |
| Names and figures | `--sr-text` |
| Descriptions, labels, figure remainders, count text | `--sr-text-muted` |
| Second names, notes | `--sr-text-gray` |
| Disabled controls | `--sr-text-disabled` |
| Card edge, readout rule, species row rules | `--sr-border` |
| Row and section rules | `--sr-border-subtle` |
| Edges, leaders, tool edges, the lacks glyph | `--sr-border-medium` |
| Field edges, the dot for an unlabeled run | `--sr-border-input` |
| Pressed states, bars, active node, lineage, links | `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border`, `--sr-accent-border-strong`, `--sr-accent-strong` |
| The opener's text | `--sr-on-accent` |
| The lacks pill | `--sr-error`, `--sr-error-bg`, `--sr-error-overlay` |
| Card | `--sr-card-shadow` |

Focus rings and the field halo are the global rules. No pure black and no untokened gray appears.

## 14. Touch targets, text size and reduced motion

- **Touch targets, still tier:** every control in the strip, the view bar and the toolbar is at least 2.75rem tall (`.sr-touch-target` and the tier's rules); tool cells are 3rem; the opener is 2.75rem; a table family row is at least 2.75rem; region and find options are at least 2.75rem. Tree rows at full zoom are 2.125rem, or 2.75rem in Both; they are diagram items, not controls, and every action on one has a toolbar, readout or keyboard path.
- **Text size:** every length that holds text is in rem, so the layout follows the in-app text scale. At 150% and 200% in a window wider than 640 px the tree takes the outline form live in the page, the box is never taller than the window, and the toolbar wraps. No page scrolls sideways at 320 px and 200%, in either view (checked on the mockup). The table is the full equivalent of the tree for a reader at 320 px and 200%. On the still tier the headline goes from three columns to one where its wrapper is narrower than 16.5rem, so no count is ever drawn over another and no label breaks inside a word (section 5).
- **Reduced motion:** every transition and animation below collapses under the global `prefers-reduced-motion` block. A scroll that brings a node or the box into view uses `behavior: 'auto'` when reduced motion matches at that moment.

## 15. Motion spec

All motion is CSS; no library is added. Zoom, pan, fit, a filter change and a re-sort are instant by design, because animating a re-scale misstates the data in flight.

- Hover on controls, nodes and rows: ease-out, 120ms, no origin, instant under reduced motion, CSS.
- Twisty and row chevron turn: ease-out, 140ms, its own center, instant under reduced motion, CSS.
- Children a press adds in the columns form: `cubic-bezier(0.2, 0, 0, 1)`, 180ms, from 0.5rem toward the parent (left), instant under reduced motion, CSS.
- Children a press adds in the outline form: `cubic-bezier(0.2, 0, 0, 1)`, 180ms, from 0.25rem above, instant under reduced motion, CSS.
- An opened family's rows in the table: `cubic-bezier(0.2, 0, 0, 1)`, 180ms, from 4px above, instant under reduced motion, CSS.
- View swap, table to tree and back: `cubic-bezier(0.16, 1, 0.3, 1)`, 160ms, from 0.1875rem below, instant under reduced motion, CSS. Not replayed inside the panel.
- Readout content on a new selection: `cubic-bezier(0.2, 0, 0, 1)`, 140ms, opacity only, instant under reduced motion, CSS.
- Region and Find listbox open: `cubic-bezier(0.2, 0, 0, 1)`, 140ms, `scaleY(0.92)` from the field's top left; close is instant; instant under reduced motion, CSS.
- Headline and row bars on a filter change: `cubic-bezier(0.2, 0, 0, 1)`, 240ms, width from the left, instant under reduced motion, CSS.
- Switch knob and track: ease-out, 180ms, the shared `ToggleSwitch`.
- Rotate note dismissal: ease-out, height 220ms and opacity 180ms, collapsing upward, removed at once under reduced motion, the shared `ChartViewTip`.

## 16. Where the documents differ, and which governs

| Subject | Governs | Why |
|---|---|---|
| Fit | This spec, section 9.5: a true fit with no floor | QA-55 as written. Schema 11.3's line that `fitView` returns the larger of the true fit and one line per order is superseded; the floor belongs to the still only |
| What the still shows | This spec, section 10.1 | The user approved this still. FR-87 and QA-97 say "the whole tree fitted", which is true only where one line per order fits; their wording should change to match (requested from the Planner) |
| Readout tab stops | This spec, section 9.9 | FR-68 and QA-86 defer to the spec's count |
| The helper line under the opener | FR-87's sentence, as written | It is the approved mockup's line |
| Class names of the opener and the panel | The companion map build as it lands | D-26: the mockup draws them as relayed; if they land differently, the landed names win and nothing here is copied |
| Focus on entering full screen | The hook's default (the toggle) | Schema 11.9 offers a box-focus effect; this spec does not ask for it |
| The mockup's level-of-detail walk | Schema 11.4's clamp and guards | The mockup lays out every child of a visited branch; the build may search the slot range. The look is section 9.4 |
| Computed positions | Inline position values, or custom properties, on the plane's own elements | They are geometry from data, as a chart's marks are. No responsive behavior lives in an inline style |
| The headline on the still tier | This spec, section 5 | The mockup draws only the three-up form and was never looked at above 100% text on a phone with a four-digit count. The mockup is not changed |
| A long name's lone letter in an opened family | This spec, section 11: accepted as built | D-70's rule cannot overflow; the alternatives cost more than the lone letter at one size in one face |
| The mockup's data | Not built | Media figures, the two escapees and the state-level Region list are inventions of the mockup |

## 17. Copy rules and the strings

No em dashes, American spelling, the serial comma, tab names from `TAB_LABELS`, section titles lowercase mid-sentence. Every count-bearing string is built in `familyTreeCopy.ts` with count-of-one agreement, and counts take locale grouping. Every string the user sees is in this document: sections 3 to 12 hold each one in place. The set, by home:

| Home | Strings |
|---|---|
| Header | "Family Tree"; the description (section 3) |
| Strip | "Region", "Everywhere", "Year", "All years", "Include Escapees", "Media", "Photo", "Audio", "Video", "Has photo", "Has audio", "Has video", "No photo", "No audio", "No video", the pill title, the two export sentences |
| Headline and notes | "Species", "Families", "Orders", "of {n} in the world", the three standing notes (section 5) |
| View bar | "Table", "Tree", "Common", "Scientific", "Both"; group names "View", "Names shown" |
| Toolbar | Section 7's labels, captions and accessible names; "View tools"; "Sort" and its seven options |
| Find | The placeholder and name, the list's name, "Species", "Genus", "Family", "Order", "Nothing matches this search." |
| Tree | "Family tree of your species"; the description sentence; "ORDER", "FAMILY", "GENUS", "SPECIES", "seen / world"; the count forms; "Zoom in to this part of the tree"; the node name pattern (section 9.7) |
| Readout | "Selected"; the five eyebrows; the rest line and the two hints; "species seen"; "of {n} world species"; "of {n} world {family | families}"; "Photographed", "Recorded", "Filmed"; "photos", "recordings", "videos" and their singulars; "Genus", "Family", "Order"; "Expand", "Collapse", "Focus"; the media words; the two link labels and names |
| Footers | The two footer lines and "Show {it | them} in the table" |
| Table | The five column headers; "Not placed"; "Species with no family here"; "{N} species, counted in the species total above"; the reason sentence; "{n} species"; the stacked row's words; in an opened family, "Birds of the World" with the name "Open {family} on Birds of the World (opens in a new tab)" |
| Full screen | "Open the tree"; the helper line; "Exit"; "Enter fullscreen"; "Exit fullscreen"; the still's name (section 10.1) |
| Rotate note | "Tip"; the body; the two accessible names (section 10.5) |
| States | Section 12's sentences |
| Order names | Section 6.2's table |

## 18. Open for the live look at the built app

Not checked on the mockup, and owed a look in the built app before the deploy gate:

- **Touch pinch** on a real touch screen, and the **trackpad pinch in WebKit** (both are wired in the mockup; neither could be driven from the test browsers).
- **Real devices:** the top and side safe-area insets of the panel, the readout's bottom inset over the home indicator, and the Android inset twins. The mockup simulates only a 34 px home indicator.
- **The focus trap** in full screen. The mockup has Escape and Exit and no trap; the hook supplies it.
- **The map build's classes** (`.sr-fs-open-row`, `.sr-fs-open-btn`, `.sr-fs-open-note`, `data-sr-fs-open`), drawn here as relayed and not read from that build.
- **A tree with many more orders.** The saved backup has 20 orders. Fit with orders folded into counts was seen only by shrinking the box; a life list across 40 or more orders should be looked at in both forms.
- **The still in a landscape phone window at or under 640 px**, and the columns threshold in a rotated phone wider than 640 px: at 54rem a rotated phone still gets the outline, so the rotate note's promise is wider rows and not four columns.
- **Screen readers:** how VoiceOver and TalkBack read the still's name, the tree's items and the readout.
- **Contrast** was held by using the audited text tokens on the audited surfaces; no ratio was measured on the mockup.
- **The More sheet** with fourteen destinations, measured on the combined tree (FR-11).
- **Expand all in the table** at a roster of several thousand species (schema 9.2's chunks); the mockup opens 261 rows at once.
- **The first-view rule** against a saved choice, and the Names and Region keys, which the mockup holds only for the session.
