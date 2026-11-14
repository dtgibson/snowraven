# Decisions: Visited Hotspots in Search

The run's decision record. Each builder adds its own section. The Architect's decisions D-1 to D-10 are in `schema.md` section 14 until the build carries them here with its measurements.

## Stage 4, The Designer (first direction, 2026-11-13)

Status: reviewed by the user on 2026-11-13 ("This looks good"), with no change requested. The three questions relayed (place under the name or beside it; "Locations" or "Places"; the short "Search" hint on a narrow field) were not answered individually, so each stands at the Designer's recommendation: under, "Locations", short hint on a narrow field only.

The design system applies as it stands: no token, color, typeface or motion is added. The three entries below are additions inside existing patterns, recorded so none is silent drift. The full reasoning is in `design-spec.md`.

| # | Decision | Evidence | What would reverse it |
|---|---|---|---|
| DD-1 | A location row in Search is two lines at every width: the name, wrapping in full and never cut by CSS, over the place label and (on a full tie) the Location ID. No glyph. It is the Hotspot Reports picker's name-over-meta option, reused in the overlay, whose rows were one line until now | eBird names share long openings and differ at the end, so a one-line ellipsis hides the part that tells places apart. In the mockup at 320px and 200% text the place and ID stay whole while the shipped one-line species row ellipsizes both of its spans. The control leg with the name set to `nowrap` fails the mockup's probe 56 times | The user preferring the species row's one-line shape at desktop width. The place would then need its own rule at narrow widths, because a name and a place on one line cannot both shrink |
| DD-2 | Where the query field is too narrow for the full placeholder, the placeholder is hidden and a decorative `aria-hidden` span reading "Search" is drawn in its place, switched by a container query on the field: `(max-width: 27em) or (max-width: 432px)`. The placeholder attribute and the three accessible names keep the full wording | Measured in the mockup, both engines: the full wording is 19.5em wide; the shipped wording is 234px at 16px against 196px of room at 320px, so the shipped placeholder is already clipped there. Over 108 widths and text sizes per engine the hint shown fits with at least 8px to spare. With the switch disabled the probe fails 84 times | The built-app re-measure finding a face wide enough to clip inside the threshold (move both terms), or the user preferring "Search" at every width (delete the span, the container and the query; shorten `placeholder`) |
| DD-3 | Each cap line is the last child of its own `role="group"`, a `div.sr-palette-note` with `role="presentation"`, and the group carries `aria-describedby` to it. The species line moves in from after the listbox with its wording, presence and look unchanged. When another group follows, the line takes `margin-bottom: 8px` | A third group below Species makes a line after the whole listbox follow the wrong rows (schema 4.3). The shipped headings are the precedent for a presentational child inside a group. Both engines' trees in the mockup list the options with the lines not exposed as options | A real-engine tree in the built app exposing the line wrongly (QA-12, QA-49). The fallback is the same line as a sibling after its group, which needs the listbox to stop being the groups' only parent |
| DD-4 | On the highlighted location row the place label and Location ID take `--sr-text` | `--sr-text-muted` on `--sr-accent-bg-hover` is 3.79:1 in the dark theme by the token values (4.95:1 light); `--sr-text` is 8.84:1 and 17.69:1 | A token change that brings muted text on the highlight fill to 4.5:1 in both themes |

### Recorded, not acted on

- **The shipped species row has the same pair.** Its scientific name on the highlighted row is `--sr-text-muted` on `--sr-accent-bg-hover`: 3.79:1 in the dark theme by the token values. NFR-05 freezes species rows, so this design does not touch them. The exact fix, if the user wants it: `.sr-palette-row--active .sr-palette-row-sci { color: var(--sr-text); }` in the palette block of `frontend/src/globals.css`, with the shared species picker's highlighted row checked for the same pair. It is a change to what ships today and needs its own decision.
- **The shipped placeholder is clipped at 320px today** (the DD-2 measurement). DD-2 ends it as a side effect; nothing else is changed for it.
- **The mockup is not the app.** Its phone tier is a container query on a stand-in window, its face is this Mac's system face, and bird-code ranking is not modeled. Every figure above is re-measured in the built app (CLAUDE.md, v1.0.50).

## Stage 5, The Engineer (2026-11-13)

**Outcome: the FULL form (FR-33) holds in the built app, in Chromium and WebKit, on every gate. No gate number was changed, and the run does not return to the Architect.** One reading for QA to weigh was set out under R2 (scenario A); the Guide resolved it the same day by E-08, which moves the derivation out of the species answer's task in that case (re-measured below). The Architect's D-1 to D-10 stand as built, with the deviations E-01 to E-07 below.

### Method

- **Machine:** the developer Mac, 2026-11-13, shared with another session that ran an Xcode build and browser probes throughout. One-minute load average at the start and end of each run is recorded beside it; runs were sequential and nothing of mine compiled during a timed run.
- **Built app:** `cd frontend && npm run build` of this worktree (`index-C5gBJQX3.js`, `CommandPalette-CzQF7TnF.js`), served by `backend/` under the main checkout's interpreter on a free port with `SR_DATA_DIR` pointing at a scratch folder. The **base** build is the same commit's tree before this change (`git archive HEAD` into scratch, built with the same `node_modules`), served the same way on a second port over a copy of the same data, so every "with / without" pair is two builds on one machine in one sitting.
- **Fixtures:** the Architect's realistic cap generator (`vhs/src/fixtures.ts`): 150,000 rows, 3,000 species, 2,000 locations, 21,429 checklists, in its two-byte form (a curly apostrophe and weather emoji, as a real export has; "wide") and its one-byte form ("narrow"). The layout leg used a 73-row backup built for it (below).
- **Requests:** every request other than the app's own files and its `/settings` reads was answered INSIDE the browser (a 503 for the local server, an abort for any other host) and counted, so no probe reached eBird. The scratch data folder held no API key. Counts: 25 / 24 (Chromium / WebKit) in the full after-build probe, all from visiting the tabs (`/map/hotspot-region` 15, `/taxonomy/codes` 7, the map style 2 to 3); 22 / 21 in the base probe; 340 over the 40 first-open contexts; 0 in the layout leg.
- **Clocks:** browsers expose no CPU clock, so every browser figure is wall clock (`performance.now()`), best-of batches where a call is short. WebKit's clock here has 1 ms granularity, so its single-call figures are whole milliseconds and its per-call figures come from batches. Node figures (the committed suites) are CPU time through `frontend/src/test/cpuTiming.ts`.

### R1, typing (limit: the location half adds at most 4 ms, total at most 16 ms)

**In each engine, over the shipped source bundled for a page** (`fns.ts` imports the real `paletteRows.ts`, `paletteLocations.ts`, `speciesIndex.ts`, parser, materializer and code asset), at the realistic cap, the Architect's ten queries, 3 fresh pages per engine and fixture, each query the best of 9 batched samples per leg, legs interleaved:

| Engine, fixture | Worst whole build (with locations) | Worst added by the location half | Location half alone, worst |
|---|---|---|---|
| Chromium, two-byte | 0.435 ms | 0.094 ms | 0.063 ms |
| Chromium, one-byte | 0.420 ms | 0.071 ms | 0.052 ms |
| WebKit, two-byte | 0.625 ms | 0.070 ms | 0.051 ms |
| WebKit, one-byte | 0.641 ms | 0.078 ms | 0.060 ms |

The worst added is the largest "with" reading less the smallest "without" for one query; the costliest queries are the no-match `amro` and the 24-location `red`, as in the Architect's run. The build without locations is under 16 ms everywhere (0.19 to 0.63 ms), so no separate finding about the shipped overlay is owed.

**In the built app, the whole commit:** the overlay open over the cached parse, each query typed and cleared 20 times per sample (two commits: the query and back to empty, through React and the DOM), 5 samples, the same probe on the after build and the base build. Milliseconds per pair, median (range):

| Query (rows after) | Chromium after | Chromium base | WebKit after | WebKit base |
|---|---|---|---|---|
| `a` (9 dest, 50 sp, 50 loc) | 1.34 (1.21 to 1.45) | 0.94 (0.87 to 1.09) | 2.00 (1.95 to 2.35) | 1.75 (1.70 to 2.00) |
| `e` (13, 50, 50) | 1.22 (1.20 to 1.33) | 0.89 (0.86 to 0.98) | 1.90 (1.90 to 2.00) | 1.60 (1.50 to 1.70) |
| `park` (3 sp, 50 loc) | 1.08 (1.06 to 1.23) | 0.71 (0.68 to 0.79) | 1.80 (1.60 to 1.90) | 1.20 (1.15 to 1.30) |
| `lake` (50 loc) | 1.15 (1.03 to 1.33) | 0.77 (0.75 to 0.84) | 1.65 (1.60 to 1.80) | 1.30 (1.20 to 1.55) |
| `war` (50 sp, 23 loc) | 1.05 (0.98 to 1.10) | 0.81 (0.80 to 0.90) | 1.75 (1.70 to 1.85) | 1.45 (1.40 to 1.80) |
| `red` (50 sp, 24 loc) | 1.27 (1.18 to 1.37) | 0.96 (0.95 to 1.07) | 1.85 (1.80 to 1.90) | 1.50 (1.50 to 1.75) |
| `maow` (1 sp) | 0.77 (0.68 to 0.84) | 0.65 (0.64 to 0.84) | 1.15 (1.10 to 1.40) | 1.10 (1.10 to 1.25) |
| `amro` (none) | 0.91 (0.88 to 1.02) | 0.78 (0.77 to 0.89) | 1.30 (1.25 to 1.40) | 1.25 (1.25 to 1.30) |
| `cedar lake` (none) | 0.73 (0.67 to 0.75) | 0.64 (0.63 to 0.74) | 1.20 (1.15 to 1.30) | 1.05 (1.05 to 1.15) |
| `zzqxv` (none) | 0.62 (0.59 to 0.68) | 0.58 (0.55 to 0.67) | 1.20 (1.15 to 1.25) | 1.10 (1.05 to 1.40) |

Largest added per PAIR (median after less median base): 0.40 ms in Chromium (`a`), 0.60 ms in WebKit (`park`), which includes rendering and later removing up to fifty location rows; largest pair 2.35 ms. One process per build per engine (loads 4.6 then 4.0, and 3.5 then 4.0). **R1 passes in both engines, but the headroom is not what this record first said.** The figures above count React's commit and the DOM without a forced style and layout. The Tester measured the cost the location rows add to a keystroke INCLUDING style and layout (QA report, Known Limitations 1): 2.13 ms worst in Chromium and 3.75 ms worst in WebKit (median 2.95 to 3.10 ms) against the 4 ms gate, with the whole keystroke at most 5.30 ms against 16 ms. In WebKit that is about 1.07 times the worst reading and 1.3 times the median, and nearly all of it is laying out fifty two-line rows rather than the result build. **A heavier location row (another line, an icon, a link) would put the WebKit figure over 4 ms**, so it is the first number to re-measure on any change to the row. (Corrected 2026-11-13 at QA fix errand 1; the earlier sentence read "by more than six times on the added half and on the total, even counting the DOM", which held only without layout.)

### R2, the first open after a file load (limit: at most 50 ms added, none before destinations have painted; zero derivations later; none without Search)

**The derivation's first call in each engine** (fresh page per run, the real parse and materialize first, 7 runs): Chromium 11.8 to 15.4 ms (median 11.9) two-byte, 10.0 to 10.4 ms one-byte; WebKit 8 to 10 ms (median 8) two-byte, 7 to 8 ms one-byte. The shipped species pass on the same parse, for scale: 5.1 to 5.8 ms and 7 to 9 ms.

**In the built app, 5 fresh contexts per engine, scenario and build** (load 2.7 at start, 3.1 at end). The derivation is located by a marker no other code produces (an `Array.prototype.join('\n')` over exactly 2,000 parts, the column), its task by a MessageChannel ping loop that records every interval the main thread was held, and the overlay's first frame by the first animation frame after the panel enters the DOM:

| | Chromium | WebKit |
|---|---|---|
| **Scenario B** (parse cached by the Statistics tab, the case the first-frame gate exists for): the derivation's own task | 19.1 to 20.9 ms | 17 to 20 ms |
| Its start after the overlay's first frame | 12.8 to 18.8 ms after, 5 of 5 | 8 to 12 ms after, 5 of 5 |
| Blocked time from the key press to settled, after / base, medians | 76.1 / 71.9 ms (+4.2) | 93 / 84 ms (+9) |
| **Scenario A** (Search opened at launch, nothing parsed): blocked time key to settled, after / base, medians | 118.3 / 106.8 ms (+11.5) | 203 / 197 ms (+6) |
| The task carrying the derivation (it joins the species update, FR-33) | 44.7 to 56.8 ms; base's longest task 30.0 to 51.3 ms | 40 to 77 ms; base's longest 38 to 75 ms |
| Destination options present in the commit that inserted the panel | 14 of 14, every run, both builds | the same |

The full single-run probe agrees: Chromium's derivation task 14.9 ms starting 28 ms after the first frame; WebKit's 28 ms (the task boundary there also took the render that followed) starting 15 ms after.

**Counts, the built app, both engines:** launch plus a visit to all fourteen tabs, Hotspot Reports included, with Search never opened: **0** derivations. After the first open: **1**. After 50 typed-and-cleared pairs over ten queries: still **1**. After ten more opens of five keystrokes each: still **1**. A replace is the committed component row's (one more build).

**Amended by E-08 (below):** the scenario A figures in this table are the build BEFORE E-08, in which the derivation ran inside the species answer's task. Since E-08 it runs in its own task after the next frame, and the species answer's task is the base build's length; the re-measurement is under "E-08, re-measured".

**R2 passes:** the derivation adds 17 to 21 ms where the gate's paint clause applies and starts after the first frame in every run, and later opens and keystrokes derive nothing. **The reading to weigh, flagged:** in scenario A the derivation runs inside the species answer's task, as FR-33's "same update" requires, so it LENGTHENS a task that already sits near the 50 ms long-task line. In Chromium that task crossed 50 ms in 4 of 5 after-runs (largest 56.8) against 1 of 5 base runs (51.3); WebKit's base task already reaches 75 ms. The gate limits the CPU the feature ADDS (12 ms by the pure call; +11.5 / +6 ms by the medians), which passes; the long-task line is crossed by the sum. Moving the derivation out of that task in scenario A would be the deferred form's shape for that case, which the user did not ask for and the gate does not require. Recorded so QA judges it with the figures.

### R3, hostile files (limit: at most 2.2 per doubling by the house method)

The committed `paletteLocationsLinearity.test.ts`, legs 500 and 5,000, CPU time; asserted quotient (raw) against its limit, then the printed per-doubling readings over 625, 1,250, 2,500 and 5,000 against 2.2 or the limit derived from the sort:

| Row | Node 24 (load 29 at start) | Node 20, bare | Node 24, 1 MB young generation | Doublings (Node 24) |
|---|---|---|---|---|
| Pass, every row its own location, short names | 13.47 / 27.4 (0.49) | 13.03 (0.48) | 13.14 (0.48) | 2.12, 2.25, 2.23 against 2.44, 2.41, 2.39 |
| Pass, names at the bound | 13.71 / 27.4 (0.50) | 13.76 (0.50) | 13.83 (0.50) | 2.10, 2.31, 2.25 against 2.44, 2.41, 2.39 |
| Pass, realistic shape (20 passes a call) | 10.03 / 20 (0.50) | 10.30 (0.51) | 9.96 (0.50) | 2.00, 1.98, 2.10 against 2.20 |
| Match, names at the bound, 32 queries a call | 9.99 / 20 (0.50) | 10.00 (0.50) | 10.00 (0.50) | 2.00, 2.00, 2.00 against 2.20 |
| Location half / species half at 5,000 distinct each (limit 1) | 0.005, 0.006, 0.007 | 0.008, 0.007, 0.007 | | |

Every row sits at or under 0.51 of its limit, inside the schema's 0.65 acceptance. Both mutants (an array search for the Location IDs; every search restarted and run to the column's end) exceed their limits. An earlier run of the realistic row with tenfold legs read 0.65 and a 2.84 top doubling at 25,000 to 50,000 rows, the cache effect the Architect described at cap-size legs; the row was moved to the house legs with repeated work (E-06), no limit moved.

### R4, load and memory (limit: nothing new on the entry chunk; retained heap at most 5 MB)

- **Entry graph:** no new module (`entryChunk.test.ts`'s new rows: both modules off App's static graph and on the overlay's closure; the overlay reaches no Hotspot Reports component, no map and no maplibre; the two modules' own closure reaches no transport, storage, `lib/tauri` service or component). The built `index.html` preloads the same 27 files.
- **First-paint two-build sum** (the entry script plus every `modulepreload`, gzip level 9): 670,447 B / 201,408 B gz before, 670,919 B / 201,520 B gz after: **+472 B / +112 B gz**, the new strings in `paletteCopy.ts` and App's request state and two callbacks (E-05).
- **Lazy chunks**, raw / gzip, before then after:

| Chunk | Before | After | Change |
|---|---|---|---|
| `CommandPalette` | 7,872 / 2,868 | 12,979 / 4,597 | +5,107 / +1,729 |
| `hotspotReportsCopy` (shared with the tab; now also holds `hotspotReports.ts`'s bounds and helpers) | 7,249 / 2,720 | 11,892 / 4,586 | +4,643 / +1,866 |
| `HotspotReportsTab` | 39,273 / 12,365 | 35,538 / 11,099 | -3,735 / -1,266 |
| `lifeListsRegion` (before) / `lifeListsCopy` (after), the same shared chunk renamed | 12,305 / 4,512 | 12,305 / 4,496 | 0 / -16 |
| `HelpDocs` (Help's text) | 201,234 / 65,932 | 202,640 / 66,350 | +1,406 / +418 |
| `index.css` | 205,822 / 34,622 | 206,904 / 34,803 | +1,082 / +181 |
| Eight other chunks | | | -2 to +9 B each (identifier churn) |

The built `index.css` differs from the base build's by exactly the intended rules, compared rule by rule after a fresh build of each: the `.sr-palette-field` rule gains its container and font size, and twelve rules are added (the hint, the two container-query rules, the six location-row rules, the highlighted meta, the cap line's air, and the hint's phone size). No utility rule leaked in from words in the new test files (testing.md, v0.5.85).

Opening Search (or the idle warm-up of its chunk) now also loads `hotspotReportsCopy` and `lifeListsCopy`, which Hotspot Reports and Life Lists already load: the cost schema section 7 stated and accepted for single-sourcing the tab's bounds.
- **Retained heap, Chromium** (CDP, two forced collections before each reading, 5 fresh pages): **0.260 MB** two-byte and **0.205 MB** one-byte, identical in all five; 0.233 and 0.178 MB come back when the index is dropped. WebKit has no heap reading in Playwright; the Architect's JavaScriptCore figure (0.26 to 0.32 MB) stands. Lifetime (collected with its parse; the strong-slot control retained) is the committed `paletteLocationsLifetime.test.ts`.

### R5, what ships today

The full frontend suite is green with the only edited assertions the three string pins listed below; destination options are in the commit that inserts the panel in every built-app run; `buildSearchRows` returns `buildPaletteRows`' rows first for every query (`paletteRows.test.ts`, a structural comparison over twelve queries with and without locations).

### The rest of the live look (built app, both engines)

- **Search's own requests** over open, type and choose: `GET /settings/files` (the status read; the parse was cached) and nothing else. **After choosing**, the tab's own requests only: `POST /taxonomy/codes` and the map style, as when the place is chosen in its picker, both answered by the probe.
- **Choosing a location** (`park`, the first location row): Search closes, Hotspot Reports is visible with that place's report, its picker reads the place's name, the report header is in the viewport (the page had been scrolled down first), and focus is not on `<body>`.
- **From a fullscreen Map Explorer** (`lake`, arrowing past the species to the first location, Enter): the map is no longer fullscreen, Hotspot Reports is visible with the report, the body is not scroll-locked, and returning to the Map Explorer shows it not fullscreen.
- **Accessibility tree, query `a`** (both groups cut), `ariaSnapshot` in both engines: a listbox named "Search destinations, species, and locations" with three groups, Destinations, Species and Locations; each cap line is text inside its own group and never an option; the idle status region is present (`- status`). Chromium's CDP tree gives the Species and Locations groups each its own cap line as its description.
- **Layout at 320px and 200% text** (QA-50): 48 configurations, Chromium with overlay scrollbars, Chromium with a classic 15px scrollbar, and WebKit, at 320, 390, 641 and 1280px, 100% and 200% text (a rem-sized row read 14 then 28px), light and dark, over a backup holding a 200-unit unbroken name, a place label from a 96-unit County and a 16-unit State/Province cell, two namesakes with 16-unit Location IDs, and enough matches to cut both groups. **0 failures:** no horizontal scroll of the page, the panel or the results; no text ink outside the results' content box, in rows, cap lines or headings; both IDs shown and inside their rows; both cap lines present. The field hint reads "Search" at 320 and 390px at both text sizes and at 641px at 200%, and the full placeholder at 641px at 100% and at 1280px, with its ink inside the field. The expect-broken leg (the name and meta forced to one line, the hint switched off) fails 24 of 24 configurations at 320 and 390px.

### Guards shown red (FR-40, QA-40)

Each mutation was applied to a snapshot of its file, its pattern matched exactly once, the named suite ran, and the file was restored and its hash checked against the snapshot; every named suite was green on the unmutated tree first.

| # | Mutation | Suite | Result |
|---|---|---|---|
| M1 | The match restarts every search at the column start | `paletteLocations.test.ts` | red, 9 rows |
| M2 | A location per row, not per checklist (the named wrong derivation) | `paletteLocationsParity.test.ts` | red, 5 rows |
| M3 | A strong module slot beside the memo | `paletteLocationsLifetime.test.ts` | red, 2 rows |
| M4 | The derivation not gated on the first frame | `CommandPalette.locations.test.tsx` | red, 2 rows |
| M5 | Option ids built from the Location ID | the same | red, 4 rows |
| M6 | The species cap line left after the listbox when armed | the same | red, 1 row |
| M7 | App imports the location module statically | `entryChunk.test.ts` | red, 6 rows |
| M8 | The tab consumes a request without the settled-epoch check | `HotspotReportsTab.request.test.tsx` | red, 1 row |
| M9 | Search re-choosing the shown place replays the selection | the same | red, 1 row |
| M10 | The location route forgets the fullscreen collapse | `paletteLocationsRoute.test.ts` | red, 1 row |
| M11 | Help drops the hidden-tab sentence | `palettePublishedClaims.test.ts` | red, 1 row |
| M12 | Help re-spells the location cap | the same | red, 3 rows |
| M13 | The hint's phone 16px drifts from `--sr-ctl-floor` | `paletteLocationsCss.test.ts` | red, 1 row |
| M14 | The match also searches the place label | `paletteLocations.test.ts` | red, 3 rows |

### Deviations from the schema and design, each with what would reverse it

| # | Deviation | Why | What would reverse it |
|---|---|---|---|
| E-01 | `SearchRow = PaletteRow \| LocationRow` widens the shipped type; `PaletteRow` itself is unchanged (schema 3 had it gain the kind) | `lib/paletteRows.test.ts` line 38 narrows a `PaletteRow` with `row.kind === 'species' ? row.name : row.label`; with a location kind that has no `label`, `tsc -b` fails, and NFR-05 forbids editing that row | The shipped assertion being rewritten for another reason; then `PaletteRow` can carry the kind |
| E-02 | Both cap lines sit inside their groups (DD-3) only when the location half is ARMED; an overlay rendered without `onOpenLocation` keeps the shipped markup, the species line a `<p>` after the listbox | `CommandPalette.test.tsx`'s QA-25 row asserts that line is outside the listbox with no role, and it is not a string pin, so NFR-05 forbids editing it. Unarmed there is no third group, so the shipped place already follows the last rows (FR-12 holds either way), and App always arms the overlay, so the shipped app draws DD-3 | QA or the user deciding the pin may move: delete the unarmed branch (`speciesLineInGroup = speciesTruncated`, remove the `<p>`) and list the QA-25 edit here |
| E-03 | The hint's phone size is written `max(16px, 1rem)`, not `max(var(--sr-ctl-floor), 1rem)` as DD-2 drew it | `paletteCss.test.ts` holds every `--sr-*` the palette section reads to the two theme blocks, and the floor is a length declared once on `:root`; `paletteLocationsCss.test.ts` compares the two values so they cannot drift (M13) | That guard learning to exclude length tokens; then the variable can be read directly |
| E-04 | QA-26 to QA-28's App-level rows are structural (`paletteLocationsRoute.test.ts`: the location route equals the species route line for line, the props are wired) plus the built-app live look above | No suite in this repo renders `App.tsx` (`paletteSpeciesLoad.test.ts` records why), and rendering it here would be a new harness the brief did not earn | A suite that renders App. **Amended at QA fix errand 1: this structural check MISSED QA-28.** The two routes are the same sequence of state changes, but they land on different tabs, and only the species route's destination resets Species Detail's expanded map (through its `resetKey`), so from an expanded embedded map the location route left the page scroll-locked. My live look tested only the Map Explorer's fullscreen, which App collapses itself. What now proves QA-28 is the OUTCOME: per-host rows in `useMapFullscreen.test.tsx` that take the lock, leave the tab and assert it released and the map collapsed (red without E-09), and the wheel test in the built app from each of the three hosts by both routes in both engines (E-09 below) |
| E-05 | The entry chunk grows by App's request state and two callbacks as well as the strings (schema 7 named only the strings) | Schema 5.1 puts that code in `App.tsx`, which is the entry; no module joins the graph | None |
| E-06 | The realistic-shape linearity row repeats its pass 20 times a call at the house legs | At 500 rows a single pass is under the quotient floor; tenfold legs left the cache (0.65 of the limit, a 2.84 doubling) | None foreseen |
| E-07 | The overlay wraps both derivation calls in `safely`, turning a throw into FR-25's state | A throw inside the species `.then` would otherwise reject a promise the call site deliberately leaves without a `.catch`, leaving the location half pending forever | None |
| E-08 | **The derivation never runs in the task that commits the species answer.** A memo hit (no work) still joins in the species update; a miss is held in state from the species answer's commit and derived by `afterFirstFrame` (schema 4.2's mechanism) in its own task after the frame that follows that commit, so the location rows join one frame after the species rows, appended. This overrides FR-33's "same update" for the case in which Search is opened before the backup has been read (scenario A); the already-parsed case (scenario B) already waited for a frame and is unchanged in effect. One code path now serves both: the mount-time first-frame watcher and its `framed` and `waiting` refs are gone, and `locationsAtAnswer(obs)` returns the memo's value or `undefined` and does no work | **The Guide's decision, 2026-11-13:** the user's condition is that the feature must not degrade responsiveness, so an existing long task must not get longer. Scenario A put the derivation inside the species answer's task, already near the 50 ms long-task line (Chromium: 4 of 5 runs over 50 ms against 1 of 5 on the base build) | The user ranking FR-33's letter above the condition: a miss that finds the overlay's first frame already presented would derive in the species update again (the mutant "OLD" below is exactly that code) |
| E-09 | **An embedded map's fullscreen is tied to its tab showing** (QA fix errand 1, QA-28 / FR-28). `lib/useMapFullscreen.ts` gains `MapTabShowingProvider` (default `true`), and App.tsx wraps the panels of the three map hosts, Species Detail, Statistics and Named Birds, as `activeTab === '<that tab>'`. When the value turns false the hook clears its stored state during render, so the commit that hides the tab is already collapsed and its effects release the body scroll lock, the Escape listener and the focus trap; returning to the tab shows the map collapsed. One fix at the shared seam, covering every route out, rather than a patch per route | Every tab stays mounted and is hidden with `display: none`, so a Search result on another tab changes nothing inside the host (no `active` drop, no `resetKey` change, no unmount), and the lock stayed on the page over the destination. The hook's own comment had argued the tab could not be left while a map was expanded; Search, a later modal above the map, is the route that broke that premise | None foreseen. A fourth host of `useMapFullscreen` must be wrapped in App too; `paletteLocationsRoute.test.ts` lists the callers and goes red until it is |
| E-10 | **A deferred derivation adopts its result only while the location half's generation is unchanged** (security fix errand, F-1). `CommandPalette.tsx` keeps a generation ref, bumped at the top of the files-epoch effect before any state update; the `[pendingObs]` effect captures it when it schedules `afterFirstFrame`, and the callback returns without deriving or storing anything if it has moved. No change to the Hotspot Reports tab | The effect cleanup was the only cancellation, and it runs only when `pendingObs` commits back to `null`, a Default-lane render that the epoch effect schedules for a later task. A task the next frame had already queued could run first and put the cleared or replaced file's places back: after a clear until Search closed, after a replace until the new parse landed. Closing Search needs no bump, because unmounting runs that cleanup in the same commit. I tried an epoch check in the tab's request microtask as well, then removed it. The tab consumes a request only once its phase has settled for the rendered epoch, against that epoch's index, and the Auditor's P19 found that path safe. I could construct no ordering in the app that lands a files-epoch change between that effect and its microtask, so no row could reach the check. If one did land there, the tab's next settle keeps or drops the selection against the new file (FR-57); the only residue would be one polite announcement of the old file's figures | None foreseen. If the location half gains a second deferred path (another timer, a worker), that path captures the same generation |

**A shipped defect repaired in passing by E-09.** The same seam left the page locked for the SHIPPED species route when a species is chosen in Search from Statistics' expanded Geographic Stats map or from an expanded Named Birds card map (the Tester measured Statistics on the base build: `body` `hidden`, wheel 0 of 3,288 px, the map still expanded on return). E-09 releases it on every route out of those tabs, so that shipped behavior changes with this build; the before and after are in the table under "QA-28, re-measured" below.

### E-08, re-measured (2026-11-13, after the Guide's decision)

Rebuilt (`npm run build`: `index-CoHC2ygT.js`, `CommandPalette-ByeEkKUD.js`; the base build re-made from the same commit and byte-identical to the first one, `index-BEiFpN4r.js`), served as before over the regenerated two-byte cap fixture, every request outside the app's own files answered inside the browser and counted (340 over the 40 first-open contexts, 25 / 24 in the full probe, all from the tabs; Search's own: `GET /settings/files` only). Load 3.1 to 4.4 throughout.

**The species answer's task is now located directly:** a listener on the parse worker's `message` event marks the task in which the shared parse resolves, which is where the species index is built (and, before E-08, where the location derivation ran too). The derivation's task is located as before, by its column marker.

**Scenario A** (Search opened at launch, nothing parsed):

| | Chromium after | Chromium base | WebKit after | WebKit base |
|---|---|---|---|---|
| The species answer's task, 5 runs | 45.3, 45.6, 45.8, 46.1, 51.3 (median 45.8) | 32.7, 32.9, 41.2, 45.2, 51.5 (median 41.2) | 32, 32, 32, 32, 52 (median 32) | 32, 32, 33, 33, 33 (median 33) |
| 10 more runs (Chromium, where the first 5 differed) | 28.4 to 50.0, median 45.5; none over 50 | 32.9 to 50.7, median 44.5; 1 over 50 | | |
| Over 50 ms, all runs | 1 of 15 | 2 of 15 | 1 of 5 | 0 of 5 |
| The derivation's own task | 11.1 to 12.0 ms (15 runs) | none | 8 to 9 ms (5 runs) | none |
| Derivation inside the species answer's task | 0 of 15 | | 0 of 5 | |
| Derivation starts after the frame that follows the answer | 15 of 15 | | 5 of 5 | |
| Blocked time key to settled, medians | 123.9 ms | 103.3 ms | 208 ms | 201 ms |

Before E-08 the same task in this build was 44.7 to 56.8 ms in Chromium with the derivation inside it (4 of 5 over 50 ms). Now the species answer's task is the base build's within the spread of 15 runs each, and the derivation is a separate task of about 11 ms (Chromium) and 8 to 9 ms (WebKit), well under the long-task line. The blocked-time medians still differ by the derivation's own cost plus run-to-run spread; the gate limits added CPU, which is that derivation.

**Scenario B** (parse cached by the Statistics tab), 5 runs: the derivation's task 7.7 to 9.3 ms (Chromium) and 9 to 12 ms (WebKit), every run after the overlay's first frame, never in the answer's task; blocked time key to settled, medians 81.6 / 73.5 ms (Chromium) and 96 / 86 ms (WebKit), after / base. The full single-run probe agrees (Chromium 7.5 ms, WebKit 10 ms, both after the first frame).

**Nothing else moved** (the full probe, once, both engines): 0 derivations without Search across the fourteen tabs, 1 after the first open, still 1 after the keystrokes and ten more opens; destinations in the panel's first commit (14 of 14); choosing a location lands on its report with the header in view and focus not on `<body>`; from a fullscreen Map Explorer the map is collapsed, the report shows and scrolling is not locked. R1 typing, ms per typed-and-cleared pair, median now / before E-08: Chromium `a` 1.28 / 1.34, `park` 1.05 / 1.08, `lake` 1.06 / 1.15, `red` 1.17 / 1.27, `zzqxv` 0.59 / 0.62; WebKit `a` 2.0 / 2.0, `park` 1.55 / 1.8, `lake` 1.55 / 1.65, `red` 1.6 / 1.85, `zzqxv` 1.15 / 1.2; every query within the earlier spread or below it.

**Rows that hold it** (`CommandPalette.locations.test.tsx`, which counts every call of the derivation through its module wrapper): Search opened before the parse, with the overlay's first frame already presented and the next frame held, commits the species rows with zero derivations and no location row, then derives exactly once after that frame and appends (the species row is the same node with the same id); in that window a query with nothing else to show reads the reading sentence under Locations and never "nothing matches"; closing Search, or a files-epoch change, before the frame cancels the waiting derivation and nothing from the old file is adopted. Two mutants, each restored by hash: **OLD**, the pre-E-08 code reinstated (a mount-time frame watcher, and a miss derived in the answer's task once that frame was presented), turns exactly those 4 rows red and leaves the scenario B rows green; **EAGER**, every miss derived in the answer's task, turns 6 red. The earlier mutation M4 (the `framed` gate removed) has no code left to act on; OLD and EAGER replace it.

`docs/HELP.md` and `ACCESSIBILITY.md` needed no change: Help says species and locations "join the results in the same open search", which stays true.

### QA-28, re-measured (QA fix errand 1, 2026-11-13)

**The outcome in the built app, Chromium and WebKit.** A 30,003-row synthetic backup in the scratchpad (the Architect's realistic shape at a smaller size, every location with coordinates, plus a named bird, "Pilgrim", a Red-tailed Hawk tagged `[name:Pilgrim]` on three located checklists, and a distinctive place, "Zqtwin Pond"), served by the main checkout's interpreter on free ports; every request outside the app's own files and its `/settings` reads answered inside the browser and counted (220 to 226 a run, all from the tabs: the hotspot-region lookups, the taxonomy codes post and the map style, the last answered with a background-only style so the maps draw). For each host the probe expands the map, opens Search, chooses a LOCATION (`zqtwin`) or, from the same state, a SPECIES (`sparrow`), then wheel-scrolls the destination page by 600 px and returns to the source tab. Three builds: **pre** (this feature through E-08, before E-09), **after** (with E-09), and **base** (the shipped commit, for the species route; it has no location results). One fresh context per cell.

| Host (expanded map) | Route | pre: wheel moved / room, map on return | after: wheel moved / room, map on return | base (shipped): species route |
|---|---|---|---|---|
| Species Detail | location | **0 / 1,016 px, still expanded** (both engines) | 600 / 1,016, collapsed (both) | n/a |
| Species Detail | species | 600 / 3,416, collapsed (both) | 600 / 3,416, collapsed (both) | 600 / 3,416, collapsed (both) |
| Statistics | location | **0 / 1,016, still expanded** (both) | 600 / 1,016, collapsed (both) | n/a |
| Statistics | species | **0 / 3,416, still expanded** (both) | 600 / 3,416, collapsed (both) | **0 / 3,416, still expanded** (both): the shipped defect |
| Named Birds card | location | **0 / 1,016, still expanded** (both) | 600 / 1,016, collapsed (both) | n/a |
| Named Birds card | species | **0 / 3,416, still expanded** (both) | 600 / 3,416, collapsed (both) | **0 / 3,416, still expanded** (both): the shipped defect |

(WebKit's species-route room reads 3,417 px; every other figure is identical in the two engines.) In the after build `body` overflow is `visible` on every destination and on every return, and on each return the probe expanded the map again and pressed Escape: locked while expanded, released by Escape, focus back on the "Enter fullscreen" control, in all twelve cells. Named Birds was exercised (the fixture's named bird has a card map), so nothing stands in for it.

**Rows that hold it:** `lib/useMapFullscreen.test.tsx` gains one row per host, each with that host's own options (Species Detail's `resetKey` is the selected species, which a location choice does not change; Statistics and Named Birds pass none), inside a tab shell that hides the host panel with `display: none` and provides `MapTabShowingProvider value={tab === 'host'}` as App does: expand, take the lock, switch tabs, assert the lock released and the map collapsed, return, assert still collapsed, and expand again. Plus a row that a map in a tab still showing does not collapse when its host re-renders, and one that a mount outside any provider behaves as before. `lib/paletteLocationsRoute.test.ts` gains a row that App wraps each of the three hosts keyed to its own tab, and one that the three are every caller of `useMapFullscreen`. Mutants, each restored by hash: **Q28-A**, the hook ignoring the tab-showing input (the code before E-09), turns the three host rows red; **Q28-B**, App providing no tab-showing value for Statistics, turns the wrapper row red; **Q28-C**, the input masking the expanded state instead of clearing it (the map re-expands on return), turns the three host rows red.

### Security fix errand (F-1 and F-2, 2026-11-13)

**F-1, the rows.** `components/CommandPalette.locations.test.tsx` carries the Auditor's probe as three rows beside the existing cancellation row, extending its helpers: `holdFirstFrame()` gained `presentHoldingTask()`, which presents the frame but holds the zero-delay task its callback queues. Each row opens Search before the parse with `marsh` typed, lands the parse (species rows, locations pending), presents the frame with its task held, then changes the files epoch. In the **cleared** and **replaced** legs the change is made outside `act`, so React schedules it as it does in the app; in the **control** leg it commits inside `act` first. Each row asserts the premise (the epoch effect has re-read the file status before the held task runs), then runs the task and asserts: no location row, the right status sentence (cleared: "Searching species and locations needs your eBird backup."; replaced: "Reading your eBird backup."), and no derivation call.

**F-1, red then green.** Mutants on `CommandPalette.tsx` (scratch harness `eng/mutate3.mjs`). The 38-file working set was hashed once at the top, and every file was re-hashed after each restore.

| # | Mutant | Rows | Result |
|---|---|---|---|
| F1-A | The callback adopts without checking its generation (the code before E-10) | the cleared and replaced legs | red, 2 of 34; first failure: one location row offered (`Marsh Creek Trail`, from the gone file) where none is expected |
| F1-B | The files-epoch effect does not bump the generation | the cleared and replaced legs | red, 2 of 34 |

Under both mutants the control leg stays green. Once the change has committed, the effect cleanup cancels the waiting task, which is the order the shipped cancellation row already covered. The suite is green before and after (34 of 34), and every file is intact by hash. `docs/HELP.md` line 49 ("so it never offers species or locations from a file that is gone") is true again with no edit.

**F-2.** `.claude/rules/maps.md` gains `frontend/src/lib/useMapFullscreen*.ts` in its `paths` (checked with picomatch: it matches `useMapFullscreen.ts`). Its fullscreen paragraph also gains one sentence: an embedded map's expanded state is tied to its tab showing through `MapTabShowingProvider`, which App provides around each host's panel, so a new host is wrapped there in the same change, with `paletteLocationsRoute.test.ts` named as the guard. No existing rule text changed. No test reads `maps.md`.

### Edited existing assertions (NFR-05, the complete list)

- `frontend/src/components/CommandPalette.test.tsx` line 381: `'Searching species needs your eBird backup'` became `'Searching species and locations needs your eBird backup'` (FR-20 b).
- `frontend/src/components/HelpDocs.test.tsx` lines 304 and 309: the accessible name `'Search destinations and species'` became `'Search destinations, species, and locations'` (FR-36).

- `frontend/src/components/mapFullscreenWiring.test.tsx`, the row "adds no fullscreen state to App.tsx and writes nothing to the storage seam": its pattern `/useMapFullscreen|MapFullscreenProvider|sr-map-fs-panel/` became `/useMapFullscreen\(|MapFullscreenProvider|sr-map-fs-panel/` (QA fix errand 1, E-09). Not a string pin: the row's own statement is that App adds no fullscreen STATE, and it forbade the module's name as a proxy for that. E-09 has App import `MapTabShowingProvider` from that module and provide which tab is showing, state App already owns; App still calls no hook, provides no fullscreen state and touches no panel class, which the edited pattern still forbids. The row's premise, that z-index 1200 and a focus trap inside the overlay replace App's cooperation, is the premise QA-28 disproved.

Nothing else was edited in an existing row. `entryChunk.test.ts`, `palettePublishedClaims.test.ts` and `paletteRows.test.ts` gained new rows and import lines only.

### Stated limits (schema 2.5 and FR-15 c), each pinned by a row

- **A query holding a line feed matches no location.** The input is single-line, so no typed or pasted query reaches it. Reverse if the query input becomes multi-line.
- **The query bound and U+0130:** a normalized query over 200 units that would have matched a name lengthened by lowercasing is refused. Reverse on a real name reported unfindable.
- **A whitespace-only name** is listed and matched by no query. The parser trims the Location cell, so it cannot come from a real export. Reverse if the tab starts showing such names in a findable form.
- **One name outside Latin-1 widens the column to two bytes** (the two-byte fixture above carries it; the gate tables report both).

### Noted, not acted on

- `weft-design-lint check frontend/src`: 0 warnings; the run's one new note (`reduced-motion` on `HotspotReportsTab.request.test.tsx`) is the suite's stand-in for the Web Animations API, which counts calls and moves nothing.
- `website/tools/verify/verify-palette.mjs` was not extended, so nothing joins the held patch for it (schema flag 7). The probe scripts that produced the figures above are in the session scratchpad (`eng/probe/`), not in the repo.
