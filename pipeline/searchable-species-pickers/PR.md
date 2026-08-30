# PR — Searchable Species Pickers (v1.0.7)

## What this does

Replaces the Map Explorer My Sightings **Species** filter, the app's last
scroll-only species dropdown (a native `<select>` over every distinct species
in the loaded backup), with the shared `SpeciesCombobox` type-to-find picker
already used by Species Detail and the Calendar. Typing narrows the list by
common or scientific name; the italic "All species" clearing row keeps the
filter clearable. Two supporting changes carry it: `SpeciesCombobox` gains an
additive `size="panel"` variant that maps exactly onto the filter panel's
SELECT_STYLE register (34px, 0.8125rem, radius 6, full panel width), and the
filter panel's grid-collapse clip wrapper now releases its `overflow: hidden`
once the open animation settles (transitionend-gated, re-clipped instantly on
collapse) so the picker's absolutely positioned listbox paints past the
panel's bottom edge instead of being cut off. All three pickers also gain the
approved 140ms ease-out origin-aware listbox entrance motion, shared in the
component so they cannot drift; reduced motion renders an instant appear via
the app's global reduced-motion rule.

### How to test

1. Load an eBird backup, open **Map Explorer** (My Sightings view).
2. In the Filters panel, click the Species control: the full list opens below
   it, past the panel's bottom edge, with a subtle 140ms entrance.
3. Type `sparrow` (or part of a scientific name like `zonotrichia`): the list
   narrows. Enter or click selects; the map, stats, and in-view list narrow to
   that species.
4. Reopen and pick **All species** (first row, italic): the filter clears.
5. Keyboard: ArrowDown/ArrowUp move the active row, Enter commits, Escape and
   Tab close, outside click closes. Same behavior as Species Detail's picker.
   In the phone sheet or fullscreen, Escape with the list open closes only
   the list; a second Escape then closes the sheet / exits fullscreen.
6. Collapse the panel with the **Filters** header button: it clips cleanly
   during the animation; reopen it and the listbox is reachable again.
7. Check the phone sheet (narrow window or device): same picker in the
   fullscreen filter sheet, its own scrollport keeps every row reachable.
8. Species Detail and Calendar pickers: unchanged sizes/behavior, plus the
   same subtle entrance on their lists.

### Notes for reviewer

- **Regression-free by construction:** the `sm`/`md` code paths in
  `SpeciesCombobox` are byte-identical in effect (heights, font sizes, icon
  metrics, radii, max-width all untouched; `radius` resolves to the same 8 for
  both). The ONE deliberate shared-surface change is the listbox entrance
  class `sr-combobox-list` on all sizes, the deviation the Designer flagged
  and the user approved (pipeline decisions.md).
- **Clip release mechanism:** `panelSettled` state in `MapExplorer` clears on
  every Filters toggle and sets only on the grid wrapper's own
  `grid-template-rows` transitionend while open. The handler gates on
  `e.target === e.currentTarget` AND the property name because transitionend
  bubbles (the combobox's border-color / chevron transitions run inside the
  panel). Under reduced motion the global rule shortens the transition to
  0.001ms but does not remove it, so transitionend still fires.
- **Reduced motion:** the entrance animation relies on the app-wide
  `prefers-reduced-motion` collapse in `globals.css` (the standing convention;
  per-component reduced-motion queries are deliberately not added). The
  `weft-design-lint` note on `SpeciesCombobox.tsx` ("motion present but no
  reduced-motion fallback") is this: the lint reads the component file alone
  and cannot see the stylesheet rule; `speciesComboboxMotionCss.test.ts` pins
  the rule that discharges it.
- **Guard updated, not weakened:** `filterControlSizeCss.test.ts`'s
  nine-controls count now matches 8 native controls plus the one
  `SpeciesCombobox` tag carrying `className="sr-input-16"`;
  `MapExplorerInputZoom.test.tsx` still asserts the class lands on the
  rendered `<input>` element itself.
- **Escape layering (QA round 1 fix):** with the listbox OPEN, the combobox's
  Escape branch now calls `e.stopPropagation()` (gated on `open`) so one press
  closes only the listbox and never also dismisses the Map Explorer filter
  sheet or exits fullscreen (both are bubble-phase document-level listeners;
  innermost layer first, .claude/rules/ui.md v0.5.80). With the listbox
  CLOSED the event still bubbles, so Escape keeps closing the sheet / exiting
  fullscreen as shipped. Species Detail and the Calendar have no outer Escape
  layers, so they are unchanged. Guarded by a SpeciesCombobox test with a
  document-level listener: consumed while open, delivered once closed.
- **Row crush fix (live-preview defect, deploy-stage round):** in a narrow
  listbox the scientific name was crushing the common name toward a zero-width
  box (user report: "scientific names overlapped the common names"). Root
  cause in the shared row layout: the name span's `flex: 1` is basis 0% while
  the sci span's `flex: 0 1 auto` is basis auto, so flex served the SECONDARY
  text its full intrinsic width first. Latent since the v1.0.4 extraction and
  already reachable in shipped 1.0.6 (Species Detail at a 320px viewport:
  63.8px minimum name box, measured); this change made it prominent by adding
  the first narrow-at-desktop consumer with scientific names (panel listbox
  267px: 58.8px name box at 100% scale, 0px at 200%, measured in Chromium
  with demo data). Fix: `maxWidth: '40%'` on the sci span, so the primary
  name always keeps the majority of the row; `.sr-truncate` (both spans) is
  what turns crowding into ellipsis truncation rather than paint-over. No
  literal glyph overlap existed in Chromium (ellipsis clips; the crush reads
  as overlap); measured post-fix name-box floors: panel 106.2px at both
  scales, Species Detail at 320px 109.2px; Species Detail desktop is
  byte-identical (the cap never binds at 1232px); Calendar passes no
  scientific names. Verified live at all three pickers, both themes, 100%
  and 200% in-app text scale, against the built dist. Guards:
  SpeciesCombobox.test.tsx pins the row layout mechanism (name `1 1 0%`, sci
  `0 1 auto` + `40%` cap, `.sr-truncate` on both) in every size, and
  speciesComboboxMotionCss.test.ts pins `.sr-truncate`'s clipping
  declarations.
- **jsdom limits:** the new tests prove register values, wiring, and the
  release state machine structurally; that the released listbox visually
  paints past the panel edge at 320px / 200% text scale is a layout claim
  jsdom cannot make (per `.claude/rules/testing.md`) and is left for The
  Tester's browser pass. Suggested probe: sightings sidebar and the phone
  sheet, listbox open, at 320px width and 200% in-app text scale, both themes.
- **Ride-along fix:** `website/index.html`'s version pill and footer were
  still at v1.0.5 (missed in the 1.0.6 release); both now read v1.0.7 per the
  lockstep rule.
- Verified green: `npx vitest run` (3,593 tests, 233 files), `npm run
  typecheck` (`tsc -b`), `npm run build` (the pre-push gate), entry-chunk
  guard (no maplibre/county/combobox on first paint; `SpeciesCombobox` stays
  its own lazy chunk shared by three lazy consumers).

## Seeing it locally

1. Open a terminal in your project folder.

2. Start the backend:

   ```
   cd backend && uvicorn main:app --reload --port 1620
   ```

3. In a second terminal, start the frontend:

   ```
   cd frontend && npm run dev
   ```

4. Open your browser and go to: http://localhost:5173

5. Click the **Map Explorer** tab in the top navigation. Make sure the view
   selector at the top of the left panel says **My Sightings** (it is the
   default).

6. In the left panel, under **Filters**, click the **Species** box (it shows
   "All species" with a small magnifying glass). The full list of your birds
   drops open below it.

7. Type part of a bird's name, for example `sparrow`. The list shrinks to just
   the matching birds as you type. Click one (or press Enter).

8. What to look for: the map now shows only that species' sightings, and the
   Locations / Species / Obs numbers at the bottom of the panel shrink to
   match. The box shows the bird you picked.

9. To get everything back, click the Species box again and choose
   **All species** (the first row, in italics).

10. On a phone-sized window, tap the round **Filters** button on the map to
    open the fullscreen filter sheet; the same type-to-find Species box is at
    the top and works the same way.

## Convention Flags

- A grid-collapse disclosure (`grid-template-rows 0fr/1fr` + inner
  `overflow: hidden` wrapper) that hosts a floating overlay (dropdown,
  listbox, popover) releases the clip only while fully open: a settled flag
  set by the wrapper's own `grid-template-rows` transitionend (gated on
  target AND property, because transitionend bubbles), cleared on every
  toggle so collapse re-clips instantly. First instance: the Map Explorer
  filter panel; the same shape applies if `.sr-countypanel` or another
  grid-collapse disclosure ever hosts a popover.
