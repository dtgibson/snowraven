# Decisions -- Calendar Overlays

## Stage 4, The Designer (first mockup, 2026-09-26)

`pipeline/design-system.md` exists; the mockup is designed within it. The
entries below are the design decisions the mockup embodies, with the two that
touch a token or a sizing rule called out as deviations. `weft-design-lint`:
clean, 0 findings. Everything is in `design.html`; nothing is written to the
app.

### D4-01. Breeding mark form (PRD Open Question 1): a fill ladder, not a letter

The breeding mark is a circle in the cell's bottom-right corner whose fill
carries the category: open for Possible, half-filled for Probable, solid for
Confirmed. This is the breeding-atlas map convention birders already read, it
survives at 6px where a letter ("C" / "Pr" / "Po") does not, and it is a
shape, so QA-20's grayscale test passes by construction. Media is a small
rounded square in the bottom-left corner: one shape whatever the format
(formats live in the popup, per the brief). The two corners are fixed, so
position disambiguates a filled circle from a filled square at the smallest
size, and the legend teaches the pairing.

### D4-02. On-cell ink is `--sr-cal-fg` for every mark; tier tokens appear in the popup only (deviation from schema.md section 6.3's suggested tokens)

schema.md suggested the three breeding keys "reinforce with `--sr-tier-4` /
`--sr-tier-2` / `--sr-tier-1`". Measured against the deep-green day ramp the
purple tier fills do not clear the 3:1 non-text floor on any tier (`--sr-tier-1`
`#C084FC` on `--sr-cal-1` `#357E56` is about 1.9:1; the darker tiers are worse
and vanish on `--sr-cal-5`), so a tier-coloured mark would fail QA-24 and,
more to the point, would not be seen. The marks therefore use `currentColor`,
which the cell already sets to its number's colour (`--sr-cal-fg` on a data
day, `--sr-text-muted` on a zero day), so the one token family that is already
AA-guarded on every tier in both themes carries the number and the marks
together. `OVERLAY_MARK_SPECS[*].token` is `var(--sr-cal-fg)` for all four
keys, which is what `calendarContrast.test.ts` will parse. The tier tokens do
their reinforcement where they are legible: the popup's per-checklist breeding
chip reuses the Breeding Codes tab's tint register (`data-tier` 4 / 2 / 1, the
1-with-tier-2-foreground cross-case for Possible, exactly as shipped). This is
consistent with design-system.md's own rule that where no colour is free on a
surface, shape carries the distinction; it is a deviation only from the
schema's suggested token values, which the schema itself leaves to this stage.

### D4-03. Mark size is rem with a px ceiling: `min(0.375rem, 10px)` (deviation from NFR-04's bare "sized in rem")

6px at 100%, growing with the text scale to a 10px ceiling. The ceiling exists
for the phone tier at 200%, where a cell is 32.56px wide (its shipped
`max-width: 100%` cap) and two 12px marks with their insets would meet in the
middle; at 10px they sit 8px apart (measured in the mockup: 34.28px cell,
marks at x 3-13 and 21-31). Vertically the phone cell is 88px tall at 200%
(the shipped `.sr-touch-target` min-height), so the marks at y 76-86 clear
the count's box (y 33-55) by 21px. Same reasoning as the `.sr-input-16`
`max()` and the 152px Large floor: a scale-tracking term plus one absolute
term stated with its reason. Stated honestly: on a desktop-width square cell
at 200% the COUNT itself no longer fits (a two-digit count is 24px wide in a
28px cell today), so that band is not one the marks can be measured against;
the bar in NFR-02 / QA-23 is 320px at 200%, and that band is measured clean.

### D4-04. Large view: same corners, `clamp(4px, 1.75cqw, 6px)`, same container query

The marks ride the shipped `@container (min-width: 152px)` rule beside
`.sr-cal-daynum` (one threshold, never a second) and size with the card via
`cqw`, so a 300px three-up card gets 6px marks and a card at the floor gets
4px. Below the floor the marks hide with the date and the popup carries the
facts. Note for the Tester: the container query measures the card's CONTENT
box, so a 180px card (150px content) is below the floor; the mockup's
specimen uses 200px / 160px for that reason.

### D4-05. The Overlays group sits at the trailing end of the settling row, outside the dimmed cluster

The existing "Count all forms" switch and its helper become a `.sr-cal-forms`
cluster that keeps the exact dim/inert treatment it has today (opacity 0.45,
`pointer-events: none`, `aria-disabled`), and the Overlays group
(`role="group"`, label "OVERLAYS" in the strip's uppercase register, two small
switches "Media" and "Breeding") sits after it with `margin-left: auto` and a
hairline separator, mirroring how "Use Textures" ends the row above. On the
phone tier it takes its own line under the forms cluster. Nothing about the
forms cluster's position or copy changes, and the row's dim never reaches the
group (FR-07).

### D4-06. Legend: one horizontal key row per active overlay

Each active overlay adds one row-block to the legend: "media" alone; the
breeding ladder as three entries read strongest to weakest along the row, the
same direction as "fewer -> more". Each swatch is a 14px tier-3 cell with the
mark in the cell's white, so the key shows the mark exactly as it sits on the
grid rather than an abstract icon. Blocks wrap as units on a phone. With both
overlays off nothing is rendered (FR-19).

### D4-07. Popup: one summary line in the header, one fact line per checklist row

Header: a muted line under the date, "media on N checklists · breeding
evidence: Confirmed", each fact led by its own mark glyph so the popup and the
grid visibly share a vocabulary. Rows: beneath the existing "time · place · N
species" line, a media phrase ("4 media", then the Multimedia tab's lucide
Camera / Mic / Video glyphs with "3 photos", "1 audio" when the ML export is
loaded; the bare count otherwise) and the breeding chip from D4-02 (code bold,
label, "· Category"). A row with neither shows nothing extra. Both overlays
off leaves the popup byte-identical to today's.

### D4-08. Motion

Marks and legend entries enter with a 160ms ease-out scale-and-fade from
their own corner (`transform-origin: bottom left` / `bottom right`) only on
the flip that turns an overlay on; turning off is instant, and nothing
animates on a re-render that did not change the overlay state. The popup keeps
its shipped (unanimated) entrance: giving it one would add a class to markup
that FR-19 requires to be byte-identical with both overlays off, so it is out
of scope here.

### D4-09. Round 2 (user feedback, 2026-09-26): rich, specific, counted facts on the day; the tile may grow

The user's direction, verbatim: "ideally we would make a rich illustration
for the user, such as by showing specific media and breeding code glyphs and
counts ... since the glyphs will be off by default, it is okay if things get a
little busy when the user chooses to turn things on." Round 1's quiet
presence marks (D4-01) are therefore replaced on the Compact grid; D4-02
(white ink, tier tint only in the popup), D4-05 (switch placement), D4-08
(motion) stand. This REVERSES the strategic brief's Out of Scope item
"per-format media marks on the cell (... a three-way glyph fails the 320px
legibility bar)" and PRD FR-20's "marks shall never ... extend the cell"; the
brief, PRD and schema are to be amended to match once the user approves the
design. What the mockup now embodies:

- **The tile.** With any overlay on, `.sr-cal-months` reflows to a 340px card
  minimum (was 230) and every cell in every grid drops its 1:1 aspect for a
  top-aligned tile: the count first, in its shipped register, then a column of
  fact rows at 0.5625rem (the Large-view date's size). Cells in a week share
  the row height (grid stretch), so a week with no facts stays squares. Off:
  no class, byte-identical.
- **Media rows** (ML export loaded): one row per format present, the
  Multimedia tab's lucide Camera / Mic / Video glyph and the day's count of
  distinct catalog ids in that format; ids the export does not name get one
  "frame" row. Not loaded: the frame glyph with the total distinct ids. The
  legend states the count's meaning ("Macaulay Library items that day").
- **Breeding rows:** one row per distinct eBird code recorded that day,
  strongest first: the round-1 category circle (solid / half / open), the code
  in bold, and the number of species carrying that code that day. Past three
  codes the tile shows "+N"; the popup lists every code. Category is carried by
  the circle, so nothing rests on colour. The mockup carries a variant toggle,
  "One per category" (strongest code per category, count = species at that
  category); the recommendation is "Every code".
- **Two forms, chosen by the cell's own width.** Each cell is a size container
  (`container-type: inline-size`); below `2.4em` the rich block hides and a
  condensed one shows: one frame glyph with the total, the strongest code with
  its circle, "+N". Both blocks are in the DOM (both `aria-hidden`) and the
  stylesheet picks, so a resize never re-renders. Measured: a 320px phone cell
  at 100% (32.56px) is condensed; at 200% it is 34 x 144, the glyph and number
  wrap to two lines, no overflow, zero page scroll. Desktop cells at 100% are
  about 48px and rich.
- **Large view** keeps round 1's corner marks as its condensed overview form,
  on the shipped 152px floor (D4-04 stands).
- **Popup** header carries per-format totals and every code with its species
  count; each checklist row lists its media by format and every code it
  recorded as a tier-tint chip (code, label, category, "N species" when more
  than one).
- **Accessible name** appends the same facts in words: `, media: 3 photos,
  1 audio` (or `, media: 5`), `, breeding: NY 1 (Confirmed), S 2 (Possible)`.
- **Textures:** the fact block takes the same `rgba(--sr-cal-N-rgb, 0.9)`
  backing the count wears over the hatch.

Data-layer consequences are listed in the round-2 hand-back for the PRD /
schema amendment.

### D4-10. Round 2 approved; the breeding-rows variant becomes a real, persisted control (user, 2026-09-26)

The user's addition, verbatim: "For the codes, lets do a further toggle
between categories and every code, so the user can choose." The mockup-bar
variant from D4-09 is promoted into the Calendar controls:

- **Form and place:** a two-option `SegControl` in the Calendar's own
  register (the Show / View pill), options "Every code" and "By category",
  `role="group"` named "Breeding rows", after the Breeding switch inside the
  Overlays group. Chosen over a third switch because it is a choice between
  two renderings, not an on/off, and over a native select because the strip's
  other two-way choices are SegControls.
- **Subordinate to Breeding:** with Breeding off it takes the app's existing
  gated-sub-option treatment rather than hiding: the wrapper dims to opacity
  0.45 (the forms cluster's value), each option carries `aria-disabled="true"`,
  activation is ignored by click and by keyboard, both options stay tab stops
  through the `Button` primitive, and the reason ("Turn on Breeding to choose
  how codes show.") is a visually hidden sentence wired through
  `aria-describedby`, per ui.md's aria-disabled rule. `pointer-events: none`
  is NOT used here (unlike the forms cluster) so a pointer user still gets the
  focus ring and the cursor change; the guard is the handler.
- **Default and persistence:** default "Every code". A third field on the
  same `calendarOverlays` settings value, `codes: 'every' | 'category'`,
  validated the same way (any other value reads as `'every'`), written whole
  with the two booleans on every change.
- **What it governs:** the cell rows (rich and condensed) and the legend's
  breeding caption. The popup always lists every code.
- **Phone tier:** the control takes its own line inside the wrapped Overlays
  group, its two options growing to share the line (the existing
  `.sr-seg > .sr-seg-btn { flex: 1 1 auto }` phone rule); the 16px control
  floor reaches it through `.sr-ctl-row` like every other strip control.

The direction is approved as of this entry; `design-spec.md` is written from
D4-02 through D4-10.

### D4-11. Live-look re-entry: "By category" names the category, never a code (user, 2026-09-26)

The user's finding on the built app, verbatim: "In breeding codes, if i click
by category, it still shows individual codes instead of the categories." The
cause was the design: D4-09/D4-10's category branch rendered each row as the
STRONGEST CODE at that category plus the species count ("FY 3"), which is
indistinguishable from an Every-code row. Everything else in the build stands.

The revision, for the category branch only:

- **Rich form:** one row per category present, in the order Confirmed,
  Probable, Possible: the category circle, the category NAME, and the number
  of distinct species with evidence at that category
  (`DayCell.codeCategoryCounts`). The name is the title-case short form
  **Conf / Prob / Poss**, because the full word does not fit: at 0.5625rem
  "Confirmed" alone measures about 42px against about 44px of tile content on
  a desktop cell, so the word plus a glyph and a count would overflow every
  rich tile; a short form at 4 characters (about 20px) fits with room for a
  two-digit count. It is set at 600 with no tracking (`.sr-fact--cat b`)
  against a code's 700 with 0.02em, so a category row and a code row differ
  in weight as well as in words. No code appears on the tile in this mode.
- **Condensed form:** every category present as its circle and count, no text
  (about 16px per row; at 320px/200% the circle and number wrap to two lines
  as the other rows do). The circle carries the category by shape; the full
  word is in the legend and in the accessible name.
- **Legend under By category:** entries read "Conf · Confirmed", "Prob ·
  Probable", "Poss · Possible", so the short form is keyed to its word next to
  its circle; caption "one row per category that day · count: species with
  evidence at that category".
- **Unchanged:** Every code, the popup (always every code), and the accessible
  name suffix, which already names every code WITH its category
  (`NY 1 (Confirmed), S 2 (Possible)`), so a screen-reader user under By
  category hears the categories with more detail, not less. Rejected: a
  separate suffix for the category mode, which would make the announced facts
  depend on a display preference.

Measured in the mockup: June 21, 2025 (codes FY, CF, NB, S, H) renders
"Conf 3 / Poss 2" rich with zero overflow; on the 320px phone frame at 200%
it renders as two circle-and-count rows with zero overflow and zero page
scroll.

### Mockup-only notes (not design decisions)

- The mockup's popup backdrop uses the house `--sr-scrim`; the shipped
  Calendar popup's own `rgba(0,0,0,0.32)` backdrop is untouched by this
  feature and is not the Engineer's to change.
- The mockup's shadow values are the shipped `--sr-card-shadow` shapes with
  the app's ink `rgb(15,17,23)` in place of `rgb(0,0,0)`, visually identical;
  the real tokens are used as they are in the build.
- Textures mode is reproduced as it RENDERS today (the hatch on the surface,
  no tint underlay, per the ROADMAP `calHatchCss` key-order defect), and the
  marks take the same `rgba(--sr-cal-N-rgb, 0.9)` backing the count wears
  there.
- The house type stack (`--font-sans`) is retained; the linter did not flag
  it, and design-system.md wins on type specifics.

## Stage 5, The Engineer (2026-09-26)

Built to schema.md's build order from step 0: the byte-identical-off fixture
(`frontend/src/components/calendarOverlaysOff.fixture.json`) was captured from
the unedited base a9c9042 before any source file changed, and the comparison was
seen failing at base on exactly the missing metric noun before it passed.

### E5-01. The cell keeps ONE inline key set in both states and varies the values

The first cut switched the day cell between two style objects (shipped layout
off, a class-driven layout on). Initial-off markup matched the fixture, but a
user who turned an overlay on and then off got the same look with a different
`style` attribute: React re-appends a key that was removed, so the declaration
order changed. The shipped cell keeps every shipped key in its shipped order and
varies only the values (`aspectRatio: rich ? 'auto' : '1 / 1'`, padding,
justify-content), with the two tile-only keys (`flexDirection`, `gap`) undefined
while off, which React never writes. The min-height floor and `container-type`
are a class (`.sr-cal-grid--rich > .sr-cal-cell`) so the phone tier can restore
the 44px touch posture over it. `calendarOverlaysOff.test.tsx` now also asserts
every scenario byte-identical after an on-then-off round trip; a mutation that
reintroduces a conditional key turns exactly those rows red.

### E5-02. The pass allocates its overlay Sets and Maps lazily

Measured through the real `buildDayCells` (base vs new, same process, min of 7,
doubling 10k to 80k rows, All years): an eager empty Set and Map per checklist
put a realistic mix at 1.3 to 1.6x base. Allocating on first use brings it to
1.14 to 1.26x base with growth matching base per doubling (x1.97, x2.30, x2.40
against base x2.00, x2.20, x2.27). Media-heavy (three ids per row) is 1.5 to
1.6x base; the code-heavy worst case (every row a distinct unknown code, the
sort's O(k log k)) is 2.1 to 2.7x base, growing x2.13, x2.58, x2.23. Linear in
practice on every fixture; QA-41's 50ms contract stays green.

### E5-03. The rich/condensed threshold stays at the approved 2.4em; the one engine difference is recorded, not fixed

Measured in the built app: Chromium switches at a 38.4px content box, exactly
2.4em; WebKit switches between 38.84px (condensed) and 39.44px (rich). The band
is under a pixel, but a 390px viewport lands inside it (cell 42.56px, content
38.56px), so an iPhone at that width shows the condensed form where Chromium at
the same width shows rich. Both forms are designed, and both measured with zero
fact-row ink outside the cell at that width. Not acted on because the approved
design specifies 2.4em and the disagreement is a sub-pixel boundary, not a
legibility or overflow defect. Reversal condition: the live look finds the
390px condensed form wrong on a real iPhone, or a user reports the two engines
disagreeing. The fix: change `@container (max-width: 2.4em)` in globals.css; at
`2.6em` a 390px viewport (content 38.56px) is condensed in both engines, but the
sub-pixel band then moves to about a 414px viewport (content 42.0px), so the
value is chosen by measuring the target device widths in both engines, never by
arithmetic alone.

### E5-04. QA-48's expected rows classify P as Possible; the build follows the table

QA-48 expects `NY 1, A 2, S 3, +2` under Every code and `S 5 (Possible: S, H,
P)` under By category for a day with NY, A, S, H and P. The Breeding Codes table
(`BREEDING_CODE_MAP`, FR-12, "no re-litigating") has P, Pair in Suitable
Habitat, at tier 2, Probable. So strongest first is NY, A, P, S, H: Every code
shows `NY 1, A 2, P 1, +2`, and By category shows `NY 1`, `A 3` (A and P species
counted distinctly) and `S 4` (S and H). The unit test encodes the table's
answer. The Tester should read QA-48 with P as Probable.

### E5-05. The popup omits the unknown bucket from its format phrases (FR-25 over the mockup)

The mockup's popup row showed ids the export does not name as "N other" beside
the formats. FR-25 and QA-28 (amended post-design) say those ids are counted in
every total, shown on the tile as the frame row, and omitted from the popup's
format phrases. The build follows FR-25: the row reads "4 media" then "2 photos",
"1 audio", and the header's totals omit the bucket too. The tile and the
accessible name keep it ("…, 2 media").

### E5-06. Smaller calls

- Legend block classes are namespaced (`.sr-cal-legend-ov`, `-ov-rows`,
  `-unit`, `-row`, `-mark`, `-cap`) rather than the spec's bare `.legend-ov`
  and `.legend-cap`, the house `sr-` prefix; nothing else renamed.
- `normalizeCalendarOverlays` reads OWN properties only (`Object.hasOwn`), so a
  value built on a prototype, or a polluted `Object.prototype`, cannot switch an
  overlay on. Found by the test row for a prototype-carried field.
- The media-map effect never sets state synchronously in its body (the React
  lint's set-state-in-effect rule): the map is cleared in the Media toggle
  handler and read through `overlays.media ? mediaMap : null` at render, which
  keeps schema 5.1's "the map exists while Media is on" rule.
- The popup header's media lead reads "media on 2 checklists:" with the mockup's
  colon; "media on 1 checklist:" takes the singular.
- Two other suites needed a same-change edit, both deliberate: the paired-label
  roster in `controlRegisters.test.ts` moves 24 to 25 (the new OVERLAYS label
  sits beside floored controls), and `exoticRuleSurfaces.test.ts`'s cast fixture
  gains the three ObservationEntry fields the parser always sets, which the cast
  had hidden until the Calendar's pass started reading them.
- `ROADMAP.md`'s "Name the metric in the Calendar's day accessible name" is
  removed, folded in as FR-28.

### O-01. QA-48 corrected to the Breeding Codes table (Orchestrator, Case 1)

Following E5-04, the PRD's QA-48 expected rows were corrected in place: `P`
(Pair in Suitable Habitat) is Probable per `BREEDING_CODE_MAP` and FR-12, so
"Every code" reads `NY 1, A 2, P 1, +2` and "By category" reads `NY 1`, `A 3`,
`S 4`. A factual correction to the check, not a change of direction.

## Stage 5, The Engineer: QA retry 1 (2026-09-26)

Fix errand for QA F1 and F2 (`qa-report.md`), measured in the built app behind
the real backend (`SR_DATA_DIR` = the Tester's demo data) in Chromium and
WebKit, with the Tester's own probes reused.

### E5-07. F1 root cause: WebKit sizes a grid row from a stale flex-wrap line count after the text size changes

Reproduced in WebKit only (1024px / 200%, April and June 2026): the grid row
was 104.39px where the tile needed 124.4px, exactly one wrapped condensed line
short (a `NY` row that wraps to 38px in a 45.6px-wide row, sized as 18px).
**The trigger is ORDER, not size:** resizing to 1024px and then setting the
text scale gave 11 short tiles; setting the scale first, or loading fresh at
the same size, gave 0; and the short rows survived a 1.5s wait, a forced
relayout and a 1px resize. That is the Settings -> Text size path with the
Calendar tab mounted (tabs stay mounted), and it is also why the Tester's sweep
(scale changed inside each width) found it and my first probe did not.
Isolated by CSS variants on that path: replacing the percentage widths with
stretch, a px container query instead of em, and px padding instead of rem all
stayed broken (11, 30 and 31 short tiles); every variant that stopped the
condensed rows from LINE-BREAKING (nowrap, or always stacked) gave 0. So the
stale quantity is the flex-wrap line count, and the rich/condensed flip (a
container query) was always measured correctly. **Fix:** the condensed row no
longer wraps; whether the glyph sits beside or over its text is decided by a
container query on the cell (`@container (max-width: 1.7em)`), the house
incompressible-pair answer (ui.md v1.0.22). 1.7em is set from measured text in
both engines: a known code needs at most 1.61em of the cell's font beside its
glyph, a 2-digit total 1.45em, a 3-digit total 1.83em, and a 320px phone cell
at 100% offers 1.785em, where the approved design shows the pair inline.

### E5-08. The stacked form is block layout, not a column flex (a second WebKit behaviour)

The first cut stacked the pair with `flex-direction: column`. Measured in WebKit
after a width change (820 -> 320 -> 1024px at 200%): the column flex kept its
items' shrink-to-fit widths from the narrower cell, drawing glyphs 5.5 to 17px
wide instead of 18px and holding a code box at 25px in a 45.6px row, while every
tile's scrollHeight equalled its height, so a "rows below the tile" sweep could
not see it. Stacked rows are now block layout (the glyph centred by its
margins, the text a centred block), which has no shrink-to-fit width to go
stale. The sweeps below add a glyph-size check for exactly this reason.

### E5-09. F2: the tile has its own bound for unknown codes, and fact ink is clipped at the cell edge

Root cause: `codeText` bounds an unknown code to 8 code points for SAFETY, the
tile printed that bound, and a nowrap row let it widen the cell (12.5 to 57px,
7 to 20px of page scroll). The first repair, a CSS ellipsis on the code box,
was wrong in WebKit and is recorded so it is not retried: WebKit sizes a
shrink-to-fit box by an advance that excludes its trailing letter-spacing (the
ui.md v1.0.30 trait), so the ellipsis fired on text that fits and a real `NY`
rendered as `N..`. What shipped:
- `tileCodeText` (lib/calendarOverlays.ts): on a tile, a known code is its own
  text and an unknown code of up to TILE_CODE_MAX_CODE_POINTS (2) is shown
  whole; a longer one shows its first code point and an ellipsis in the text.
  The popup and the accessible name keep `codeText` (schema decision 15
  unchanged, and nothing is lost: the whole bounded code is one tap away).
- The fact block spans the cell's whole border box (the tile's inline padding,
  now the shared `TILE_PADDING_INLINE_REM`, given back by a negative margin) and
  clips horizontally with `overflow-x: clip`. `clip`, never `hidden`: `hidden`
  makes a scroll container, which would let the tile's column flex shrink a
  block below its content and HIDE a short tile instead of growing it, the F1
  shape. The rich block pads the returned width back as `padding-inline`, so
  its rows keep the designed inset (clip cuts at the padding box, so the clip
  line is still the cell edge); the centred condensed rows use the full width,
  which is what lets a real two-letter code and a 3-digit total fit a 320px /
  200% cell at all. Visible consequence, deliberate: in textures mode a fact
  block's backing now reaches the cell's sides.
- Residual, measured: the only text the clip ever cuts across every sweep is
  the Jun 20 specimen's 3-digit media total (185) at 320px / 200%, 0.78px per
  side, within the digits' side bearings (the QA report's minor #2, which used
  to spill into the grid gap). A total of four digits in one day would be cut
  more; a number is never truncated with an ellipsis.

### E5-10. Verification (both engines)

- Tester's `vsweep.mjs` (width outer, scale inner; 320 to 1440px by 20px at
  100/125/150/175/200%): 0 of 285 configurations with rows below their tile,
  Chromium and WebKit, under Every code and By category (it was WebKit 4 + 3).
- `hsweep.mjs` (scale outer, width inner; 320 to 1440px by 20px at
  100/150/175/200%, all days including the unknown-code specimens): 228 per
  engine per mode, 0 rows below a tile, 0 blocks past a cell's side, 0
  squeezed glyphs, 0 page scroll added; textures mode (40px steps) the same.
- The order-dependent repro (resize then scale, scale then resize, fresh
  load): 0 in every order. The Tester's `unknowncode.mjs`: page scroll 0px at
  every configuration that read 7, 8 and 20px. (Its per-row "over" figures read
  a text Range, which reports the unclipped run; the sweep reads the clip box.)
- Screenshots of June at 320/100, 320/200, 820/200 and 1024/200 in both
  engines looked right: codes whole and centred, unknown codes `ZZ`, `A…`, `X…`.
- New suite guard `lib/calendarOverlaysCss.test.ts` (10 rows) holds the shape:
  no fact row wraps, the stack is a query-driven block layout, no column flex,
  no ellipsis box, the block's widening equals twice `TILE_PADDING_INLINE_REM`,
  `clip` not `hidden`, the rich inset. 11 of 11 stylesheet mutations and 5 of 5
  `tileCodeText`/constant mutations went red, restored by hash.

### O-02. PRD Open Question 6 corrected to the built bounds (Orchestrator, Case 1)

The Tester noted that Open Question 6 said the accessible name carries an
unknown code untruncated, while the build bounds it with `codeText` (8 code
points plus an ellipsis) per schema decision 15; QA retry 1 then added the
tile-only `tileCodeText` bound (E5-09). The PRD text was corrected in place to
describe all three surfaces. The build was right; the check text was stale.

### E5-11. Security review follow-ups (security-report.md Findings 1, 3 and 4)

- **Finding 1 (Low), the missing validator rows:** `calendarOverlays.test.ts` now
  carries a `JSON.parse('{"__proto__":{...}}')` document (the own `__proto__`
  key storage can deliver, which an object literal cannot build) and a
  prototype-member-name document (`media: 'constructor'`, `breeding:
  '__proto__'`, `codes: 'toString'`), both expected to normalize to the frozen
  default. Each was seen red under a validator mutation that would admit it,
  then restored by hash: a copy through a setter (`Object.assign`) read without
  `Object.hasOwn` admits the first; truthiness booleans and a plain-object
  lookup table for `codes` admit the second, and the lookup-table mutation is
  caught by that row ALONE.
- **Finding 4 (Informational), schema.md corrected at source:** §7.1 gains the
  `tileCodeText` row (at most 3 code points walked, at most 6 UTF-16 units read,
  whatever the token's length); §7.2 now states the three forms an unknown code
  takes, including that its bounded `codeText` IS in each marked day's
  `aria-label`, deliberately (§6.2, decision 15), and that only the popup
  label carries the raw token, never in an attribute; §6.4 notes the tile
  prints `tileCodeText`.
- **Finding 3 (Informational), the "no network call" claim:** FR-31, NFR-05 and
  the brief's Success Criterion restated in the durable form: no third-party
  request, no new endpoint or host, no request moved between components; on
  web/Pi the preference read and write and the ML export read go to the user's
  own backend over existing routes. `docs/HELP.md`'s Calendar intro carried the
  same over-strong wording ("works entirely offline, no network", pre-existing)
  and is corrected at paragraph scope: it now says the Calendar needs no API
  key, never contacts eBird or any other outside service, and keeps working
  with no internet connection. The section's other network sentences were
  checked and left: the species filter's "makes no network calls" is true on
  every target, and the Statistics paragraph's "keeps working with no
  connection at all" is about the internet. `PRIVACY_POLICY.md` makes no
  Calendar claim and is unchanged. HELP.md is bundled, so the corrected
  sentence reaches the preview on the next build.
- Findings 2, 5 and 6 are outside this build's changed lines (the report routes
  2 and 6 to the idea inbox and 5 to the Deployer's staging) and were not
  touched.

### O-03. Live look: "By category" must show categories, not codes (Stage 4 re-entry)

At the live look over the tailnet (2026-09-26) the user found that choosing "By
category" still shows individual codes: the approved design rendered each
category row as the strongest code at that category ("FY 3", "S 2"), so the
switch reads as if it does nothing. The user wants the rows to name the
categories themselves. This is a design change found on the built app, so per
CLAUDE.md it goes back to The Designer rather than shipping as a post-ship fix.
The run re-enters Stage 4 for this one element only; everything else approved
stands and is not re-litigated. The Engineer, Tester and Auditor then re-run
as scoped errands over the revised element.

### E5-12. D4-11 built: "By category" names the categories; its tile turns compact at a width set by its counts

Implemented exactly the revised element and nothing else. `BREEDING_CATEGORY_SHORT`
(`Conf` / `Prob` / `Poss`) in `lib/breedingCodes.ts`; `tileRows` emits a
`{ kind: 'category', key, label, count }` row per category present (label on a
rich row, `null` on a condensed one, so the compact tile is circle and count
with no text and no "+N"); the cell renders it as `.sr-fact--cat` (label set at
600 and untracked); the legend keys each short form to its word
(`<b>Conf</b>· Confirmed`) with the caption "one row per category that day ·
count: species with evidence at that category". Popup, accessible-name suffix,
persistence and the control are unchanged. prd.md FR-30, FR-37, FR-38, QA-34 and
QA-48 and schema.md §6.4 are amended at source, each marked "amended per D4-11";
docs/HELP.md's By category and compact-tile sentences are rewritten to match.

**One layout defect the revision introduced, found by the sweep and fixed.** A
short label is wider than any code, so at the base 2.4em rich/condensed
threshold a rich "Conf 26" row's label ran into its count: up to 7.5px in
Chromium and 7.3px in WebKit, in both sweep orders, at 100%, 150% and 175%
text across the band from 400px (Every code measured 0 collisions over the
same band, so this was new with D4-11). Measured per row from glyph, label and count advances
(forcing every tile rich, 4 widths x 4 scales, both engines): a row needs at most
2.557em of the cell's font with a 1-digit count, 2.938em with 2 digits, and a
digit is 0.381em (3.319em for 3). A single container query cannot express that,
because how wide the content is depends on the data (ui.md, the
incompressible-pair rule), so the component states it: `categoryCountDigits`
(pure, `lib/calendarOverlays.ts`) gives the widest category count's digits and
`FactBlocks` adds `sr-cal-facts--cat`, `--cat-2d`, `--cat-3d` cumulatively; one
container query per class (2.6em, 3em, 3.4em) hides the rich block and shows the
compact one. Every code tiles carry no such class and keep the approved 2.4em.
The cost, stated: under By category more tiles show the compact form (in the
sweep, rich category rows fell from 3,315 to 2,448 of 8,892 in the scale-outer
order in Chromium), which is the approved compact form, not a new one.

**Verification (both engines, By category, 100 / 150 / 175 / 200% text):**
- Collision probe (`catoverlap.mjs`), 228 configs per engine per order, text
  scale changed before and after layout: 0 label/count or glyph/label
  collisions, 0 rows past their row, 0 code rows and 0 "+N" on a By-category
  tile. With every category tile forced to a 3-digit count and its class: 0.
- Tester's `vsweep.mjs category` (scale changed after layout): 0 of 285 configs
  with a tile below its cell, per engine.
- Reverse-order `hsweep.mjs category`: 0 rows below a tile, 0 blocks past a
  side, 0 squeezed glyphs, 0 page scroll added; the only cut ink is the
  pre-existing 3-digit media total "185" on Jun 20 (1.5px Chromium, 1.6px
  WebKit), identical to the Every code sweep before this errand.
- `unknowncode.mjs` adapted to take the codes mode: 0px page scroll at every
  listed width and scale, with and without the unknown-code text; Large view's
  forced 7-up floor unchanged (the unknown-code days' ink is inside the
  hsweep's cut check above). `f1stale.mjs` (the F1 orders) under By
  category: 0 in every order in both engines.
- Screenshots of June at 1280/100% and 640/150% and the legend in both engines
  match the revised design.

**Tests (extend before add):** the QA-48 and June 21 rows in
`calendarOverlays.test.ts`, the condensed By-category row, one
`categoryCountDigits` row (1, 2, 99, 100, 1,000, Every code, empty); the stored
By-category component test now also asserts the fit class on both blocks and
its absence under Every code, and the legend test the short forms and caption;
`calendarOverlaysCss.test.ts` gains one describe (a row per class: one hide and
one show rule under the same query, above the measured need and within 0.15em
of it, above the base; thresholds rising with digits), and its fact-subject
pattern now reaches `.sr-fact--cat b`. Mutations, restore verified by hash, all
red: 1-digit query back at 2.4em, 2-digit query under its need (2.9em), 3-digit
query removed, 2-digit compact block not shown, 3-digit query far past its need
(4.5em), the component not stating the class, digits off by one at 100, digits
reading code rows too (8 of 8).

### O-04. README and website left unchanged (user decision, 2026-09-26)

The one proposed Calendar sentence (`copy-proposal.md`) was shown to the user as
tailnet pages (the website and the rendered README, before and after). The user
chose to leave both pages as they are. The feature is described in
`docs/HELP.md` only. `calendarOverlaysPublishedClaims.test.ts` therefore gains
no README or website passage.

## Stage 8, The Deployer (2026-09-27)

### D8-01. The iOS archive needs a `swift` shim under Swift 6.4 (Orchestrator-approved deploy workaround)

**What happened.** The first `tauri ios build` for 1.0.38 build 1 failed inside the
Rust compile, in Tauri's own build script (swift-rs 1.0.7), with
`ld: building for 'macOS'` and macOS-SDK header errors. swift-rs compiles
Tauri's Swift package (and each iOS plugin's) with `swift build` plus iOS
`-Xswiftc -target` / `-Xcc --target` flags. Swift 6.4 (Xcode 27, the only
toolchain on the release Mac) makes the new `swiftbuild` engine the default,
and that engine ignores those flags and links for macOS. Only iOS is affected:
the desktop builds do not compile these Swift packages.

**Why no earlier ship met it.** Most likely because the main checkout's
`src-tauri/target` held those build-script outputs from before the toolchain
reached 6.4. This build ships from a worktree whose target was cold.

**The workaround.** A third wrapper beside the two the runbook already uses:
`/tmp/xcshim/swift` adds `--build-system native` to `swift build` only and
passes every other `swift` invocation through unchanged. That restores the
engine every prior iOS build used. Approved by the Orchestrator within the
user's all-platforms production sign-off. The exact wrapper, the
verification and the removal condition are in the release skill's iOS
section, so every later ship recreates it with the other shims.

**Verified on the built output, not assumed.**
- A hand run of swift-rs's exact command with the native engine produced
  `libTauri.a` at `platform 2`, `minos 16.0`.
- In the real build, all five swift-rs libraries (Tauri, clipboard-manager,
  dialog, geolocation, opener) report `platform 2`.
- `vtool -show-build` on the archived app's executable reports `platform IOS`,
  `minos 16.0`, `sdk 27.0`, and on the widget extension `platform IOS`,
  `minos 17.0`.
- The archive is stamped 1.0.38 / 1.0.38.1.
- `DistributionSummary.plist` lists both bundle ids with their expected
  entitlements, profiles and the Apple Distribution certificate.

**Residual risk.** `--build-system native` is deprecated in SwiftPM, so this is
a bridge. The runtime backstop is the user's own TestFlight install of the
exact uploaded build, before any App Store record is created.

**Removal condition.** When swift-rs, or the Tauri release that pins it, builds
a correct iOS package under Swift 6.4's default build system, drop the shim,
and repeat the `platform 2` / `platform IOS` checks from a cold target.

### D8-02. App Store: device check reported, What's New approved, iPad Calendar shot recaptured, submitted

**Device check.** The user installed TestFlight build 1.0.38.1 (delivery
`b35f45eb-030e-4267-8789-bf2b9fc65154`) on their own iPhone. They reported
"the phone build works". Per the device boundary, that is the user's reported
result, recorded as given; no agent touched a device.

**What's New.** The user approved the drafted text unchanged. It was set on
the record and read back byte-equal (388 characters):

> SnowRaven 1.0.38 adds overlays to the Calendar.
>
> Two switches under Overlays mark the days you brought home photos,
> recordings or videos, and the breeding codes you recorded, each led by a
> circle for Confirmed, Probable or Possible. Both stay off until you turn
> them on.
>
> The app now also opens on a small white raven on SnowRaven green, which
> clears as soon as the first screen is ready.

**Record.** `63dc73df-a7a6-4726-9ad4-76decc1fb676`, created on build 1.0.38.1,
`AFTER_APPROVAL`, no phased release.
- Promotional text: the new record came without it, as every new record
  does, so it was set from `appstore/LISTING.md` and read back equal.
- Unchanged and verified equal: the inherited description, keywords and URLs
  (to LISTING.md), the review notes (to `appstore/REVIEW_NOTES.md`,
  byte-equal), and the review contact (to 1.0.36's).
- Age rating: the new editable app-info record (`83687f7b`) equals the
  released one field for field.

**Screenshots.** The planned "no change" was checked against the images and
did not hold. The iPad 13 Calendar shot photographs the whole Calendar
controls panel, and 1.0.38 always shows a new Overlays row there. By the
user's standing rule never to submit a store screenshot a release behind, it
was recaptured before submission:
- From the synthetic demo data (guard OK, 368 synthetic checklists), with a
  scratch copy of `capture-appstore.mjs` limited to that one shot, at the same
  2064x2752 RGB with no alpha.
- It shows the Overlays row with Media and Breeding off and is otherwise the
  same 2025 Large view.
- The taller panel makes the page scroll, so the rig's own framing now sits
  the Calendar heading near the top edge. Nothing is clipped.
- The whole iPad set was deleted and re-uploaded in order, 01 to 06. The read
  back matches the committed files by name, order, size and MD5, all
  `COMPLETE`. The other five were byte-identical to the store's images
  before.
- The iPhone set was untouched: its Calendar shot shows only the grid and
  legend, which are unchanged with overlays off.

The website's `calendar.webp` has the same property. A recapture was made to
the scratchpad only, pending the user's approval under the website rule.

**Submission.** Review submission `451305aa-56c8-49e0-9b19-9924ccbbed8b`,
`WAITING_FOR_REVIEW`; the record reads `WAITING_FOR_REVIEW`.

**Reconciliation.** Every TestFlight train since 1.0.13 without a version
record is named in CLAUDE.md's list: the three skips, the five rollups, the
1.0.25 deferral, and now 1.0.37, TestFlight-only by the user's direction.
