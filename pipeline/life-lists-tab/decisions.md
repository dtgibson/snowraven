# Decisions: Life Lists

Running log for the life-lists-tab run. Each entry names the choice, the alternative, and what would reverse it.

## D-01 Designed within the established design system (Stage 4)

`pipeline/design-system.md` exists and applies in full. No token, radius, type role or pattern is new; the tab is drawn from the Checklists tab's header, card, control strip and row register, the Weather backlog's paging row, and the named-bird item list's 1.5rem link box. The one line offered for deliberate evolution: none was asked for, so none was taken.

## D-02 Tab placement: a sibling tab directly after Checklists

As the brief and PRD decided (FR-01). The mockup draws it there in the sidebar and under More on the phone bar. Alternative: a segmented view inside Checklists. Reversal: the user's word at the design gate; it is a registry change for the Engineer and nothing in the mockup's card changes.

## D-03 Media buttons are `.sr-pill` toggles with `aria-pressed`, not a `.sr-segbar`

Photo, Audio and Video are independently selectable, which is the filter-pill contract (multi-select, `aria-pressed`, accent positive state); the `.sr-segbar` register is the app's two-or-three-option EXCLUSIVE toggle (sort order, comparison mode) and would misread as one-of-three. Each pill carries its Multimedia-tab glyph (`Camera`, `Mic`, `Video`) at 12px so the three read as the media family the user already knows. The schema's "SegControl rule" reference is read as the `aria-pressed` requirement, which these satisfy. Reversal: a user preference for the joined shell; it is a class swap and the ARIA is unchanged.

## D-04 The checklist is a glyph-only `ChecklistLink` in its own 1.5rem cell, not the date made into a link

The PRD keeps date, time and checklist as three positions and renders a dash for an unlinkable row (FR-31, QA-33), so the row keeps a dedicated link cell: `ChecklistLink compact` in a 1.5rem box on desktop (WCAG 2.5.8 minimum) and a 2.75rem box at the right of the stacked card on the phone. Alternative, flagged for the user: the Checklists tab's own form, where the formatted date IS the link's label (`Nov 2, 2026 ↗`), a bigger target and a familiar affordance, at the cost of FR-31's dash and a QA-33 amendment (an unlinkable row would show its date plain with no mark). Reversal: the user's choice at the gate; it moves one cell and one test row.

## D-05 Rows are a five-track grid on desktop and a stacked card below 40em of the list's own width

A ledger wants aligned columns, and each row is its own grid, so the date and time tracks are fixed rem widths (5.4rem, 4rem) rather than `auto`, which left them ragged across rows in the first render. The stack is driven by a container query on the list (`max-width: 40em`), which fires at 640px / 100% and on any window under 1280px at 200%, AND by the established `<=640px` block for the phone, so a wide window at large text stacks too (the design system's date-place-link row rule). Alternative: a `<table>` with headers, which would be the Targets register and heavier than the sibling Checklists list; declined, and no column header row is drawn because the count sentence already names what the date is.

## D-06 Two location lines, plain text

"Location name" over "County, ST" (ML rows: county only), matching the Checklists place string and the schema's two-line reading, never `HotspotLink` (the tab issues no request). Location text wraps with `overflow-wrap: anywhere`; measured at 320px / 200% in both engines with zero overflow.

## D-07 Switches stay operable while the exotic status check is unfinished

A partially consulted export can still confirm some species (FR-14), so turning a switch on can add rows even under FR-20's first sentence; disabling them would be wrong in that state. The sentence explains; nothing is dimmed.

## D-08 Motion: only added rows animate

Rows a switch or media press ADDS enter with a 180ms ease-out fade and 4px drop from above (origin top); re-sorted rows, first paint and paging are instant, and the count sentence changes in the same commit with no animation (the design system's "consequence appears at the instant the switch flips" rule). Reduced motion is the app's global block. No stagger, no scale.

## D-09 Doctrine notes that are justified rather than fixed

- Display face: the app's `--font-sans` stack (`Inter`, system-ui, ...) per the design system's Type section; the doctrine's design-system-wins-on-specifics clause applies. `weft-design-lint` reported clean.
- `--sr-card-shadow` carries `rgba(0,0,0,...)` because that is the shipped token; the mockup copies tokens verbatim rather than retinting one.
- Background atmosphere: the design system's register is quiet utility on a flat tinted `--sr-bg` with one shadowed card; no gradient or texture is added, by the feel the system records.

## D-10 Position number at the leading edge (revision 1)

Each row carries its position on the list currently shown, oldest 1 at the bottom, newest N (the count sentence's figure) at the top; a position in the WHOLE list, so page two continues from where page one left off, and a media selection renumbers for that list (the photo life list's newest is its own N). A fixed 2.5rem right-aligned tabular track in `--sr-text-muted` on desktop, 1.9rem at the card's leading edge on the phone, top-aligned with the common name; four digits at 200% fit both without moving the name. The visible number is `aria-hidden` and an `.sr-only` "N of M." prefix in the name cell carries it to a screen reader. Alternative considered and declined: the number as a micro label above the name on the card, which costs a line per row. Reversal: the user's word; the number column is one track.

## D-11 Scientific name and the species-link marks, reversing OQ-6 / FR-39's "no favicons" (revision 1)

Every row renders `BirdName` with `showSci` and a `taxonCode`, the Checklists species-comment form, so the scientific name sits beneath the common name and `SpeciesLinks` draws the eBird and Birds of the World marks beside it. This REVERSES the PRD's OQ-6 default and FR-39's "no taxon-code batch": the codes come from the same `/taxonomy/codes` batch Checklists runs, a request to the user's own server on web/Pi and a local call in the native apps, which stays inside the brief's durable no-network form (no third-party request, no new endpoint or host). The Orchestrator cascades the change into the PRD (FR-39, OQ-6) and the schema (the tab's module closure now reaches the codes batch, and QA-15 / QA-41 lose the "zero taxon-code posts" clause). Row consequence: two lines per row on desktop; every other cell aligns to the first line. The cell overrides the shared `nowrap` scientific name so it wraps at 320px / 200% instead of ellipsizing (the Targets `.sr-tg-name` precedent). Mockup note: the favicon `<img>` and the glyph fallback are both drawn, exactly as the component does, so the marks look right online and offline.

## D-12 Per-row media presence: the Quiet treatment is recommended and is the default (revision 1)

Three treatments are in the review bar for the user to judge live. **Quiet** (default): three fixed slots in the filter's own order with the filter's own glyphs (Camera, Mic, Video, 12px), a format the species has in `--sr-text`, one it lacks as a faint `--sr-border-medium` outline that keeps the slot; no label, no accent, no target. **Count**: "N of 3" in the muted micro register, nothing at zero. **Off**: no cell, the track dropped. Recommendation: Quiet, because it answers "does this species have audio?" at a glance in the vocabulary the user has already learned from the Media pills, where a count says how many but never which and sends the user back to the pills to find out; the busy worry is answered by the ink (nothing coloured, lacking slots nearly silent) and by position (the eye reads the middle slot as audio without decoding). Rules carried: the cell is `role="img"` with the formats named in its label, is never a tab stop, and the track is a fixed width (`max(46px, 2.5rem)`) because the first Count render showed an empty cell collapsing an `auto` track and shifting every other column on that row. Reversal: the user picks Count or Off at the gate; the Engineer builds one treatment with no setting.

## D-13 The phone card's right rail is one px-floored column (revision 1)

On the stacked card the link mark and the media cell share one trailing column, the link centred against the name and date lines and the glyphs beneath it beside the place lines. The column is `max(44px, 1.5rem)`, not 2.75rem: a rem width doubles to 88px at 200% and starved the name column to 113px ("Lighthou-se"), while the touch floor the rem was protecting is 44 CSS px, which the `max()` never goes under (48px at 200%). Measured: 145px for the name at 320px / 200% after the change, zero overflow in both engines. The glyphs first sat on the date line and wrapped under it at 100% (the line is 178px wide and the three cells need 189px); the rail placement is the repair, not a squeeze.

## Cascade after the design sign-off (Stage 4, 2026-11-06)

The user approved the design after revision 1 ("Quiet glyphs work, this is the direction"). D-10 to D-12 changed what the row shows, so the PRD and the schema were edited in place before The Engineer: the PRD gained FR-42 (position numbers), FR-43 (scientific name, taxon codes and the eBird and Birds of the World marks; reverses OQ-6 and amends FR-39 to the brief's durable no-network form with one `/taxonomy/codes` batch per derivation), FR-44 (the Quiet media presence cell) and QA-54 to QA-56; the schema gained `position`, `scientificName` (binomial, capped hand scan, declared as scan S8) and `media` on the output row, section 5.4 (the once-per-roster codes batch as the single enforcement point) and the declined alternative of classifying exotics in the tab from codes. Every earlier ID is unchanged.

## Stage 5 (The Engineer), 2026-11-06

Each entry names the choice, the alternative, and what would reverse it. Where the build departs from an approved artifact, the reason is here and at the call site.

## D-14 Forms eBird counts as their parent fold in; QA-10's example is restated (the shared rule wins)

QA-10 lists `Dark-eyed Junco (Slate-colored x Oregon)` and `Mallard (Domestic type)` among forms that "yield no row of their own". Neither does, but neither is dropped either: the shared `isNonCountableForm` follows eBird's `reportAs`, which counts an intraspecific intergrade (bird-names.md, the 38 intergrades) and a domestic type as the parent species, so each FOLDS into its parent and can set that parent's first-sighting date. Measured through the module: `isNonCountableForm('Mallard (Domestic type)')` is false and it normalizes to `Mallard`. The repo convention outranks an artifact's example (bird-names.md, "the convention wins"), and FR-10 itself requires the shared predicate. `lifeLists.test.ts` keeps QA-10's drop cases with a true hybrid (`Mallard x American Black Duck (hybrid)`), the spuh and the slash, and pins the fold separately. Reversal: none at this layer; a change to which forms count is a change to the shared predicate, for every tab at once.

## D-15 The display order is not the bare reverse of the instant order

Schema 2.4 says the newest-first display is "the reverse" of `compareInstant`. Read literally that puts a blank-time row FIRST within its day, which contradicts FR-28, QA-29 (S, Q, P, R with R blank last) and the schema's own step 4. The build follows FR-28 and step 4: `compareDisplay` is day descending, timed before blank, minute descending, then name. One rule still governs blanks inside the comparator family (a blank is the greatest instant of its day, so the first of a set prefers a timed row and the latest of a set prefers the blank one); the display is the one place that does not reverse it, and the test states all three uses on the same two instants.

## D-16 The roster key is `JSON.stringify` of the sorted names, not a newline join

Schema 5.4 joins the sorted names with `\n` on the premise that a normalized name cannot hold a line break. A quoted CSV cell can carry an interior line break, and the parser trims only the ends, so two different rosters could join to one key and the codes batch would not re-issue. `JSON.stringify(sortedNames)` is unambiguous for any strings, still O(total characters) once per epoch. Behaviour is otherwise exactly the schema's: one post per distinct roster name set.

## D-17 Not added to the idle `warm()` prefetch, as the schema says, though its stated reason is wrong

Schema 4.2 says "Not added to the idle `warm()` prefetch list, matching Checklists." Checklists IS warmed (`void importChecklists()` in App's `warm`), so the reason does not hold. The build follows the instruction (the tab's chunk loads when the tab is first opened, which is FR-39's "the lazy chunk load that every tab incurs"). Reversal: one line, `void importLifeLists().catch(() => {})` in `warm`, if the live look finds the first open slow.

## D-18 Dashes use `--sr-text-muted`, not `--sr-text-disabled`

The design spec draws the time and checklist dashes in `--sr-text-disabled`. ui.md reserves that token for disabled controls (it is WCAG-exempt only there; #A1A1AA on white is 2.6:1), and a dash here is content: it says "no time" or "no checklist" (the checklist dash also carries an `.sr-only` "No checklist"). The dashes use `--sr-text-muted`, which the row's time already uses. Visually a step darker than the mockup. Reversal: the user's word at the live look; one declaration.

## D-19 The linearity guard's legs are 5k / 50k rows, and pass 3's limit is derived from S log S

Schema 8 plans N = 20,000 and 10N = 200,000 with a limit of 20 on every pass. Measured in CPU time on this Mac (Node 24.18), the distinct-species leg's quotient climbs with the size band for a reason that is the engine's, not the algorithm's: pass 2, which is nothing but one Map insert per distinct key, read 13.1 from 2k to 20k rows, 12.4 from 5k to 50k, 16.5 from 10k to 100k and 18.7 from 20k to 200k, and even a DOUBLING from 100k to 200k read 2.98. In-file at the planned sizes the distinct legs read 21.4 to 22.8. That is the live-set residual testing.md v1.0.40 rule 3 names, so the limit was not raised: the legs moved to 5k / 50k (the distinct legs then read about 12.5) and the limit stays 20 for passes 1 and 2. Pass 3 sorts its output, so a flat "linear is 10" was the wrong expectation for it; under full-suite load its distinct leg read 20.23. Its limit is now the same 2x house margin over its stated complexity, `2 x (rows ratio) x log2(large) / log2(small)`, derived in the row from the rows each leg actually sorts (about 26 on the distinct leg; the repeated-species leg, where S does not grow, keeps 20). Non-vacuity: the linear-search mutant of pass 1, in the test file, exceeds 20 through the same procedure at 2k / 20k, where the shipped pass stays under it. Each sample batches to the helper's default 20 ms, because the small legs are under a millisecond per call. Reversal: a pass whose quotient leaves its band on the realistic repeated-species leg, which is flat at either size.

## D-20 Measured cost per load and per re-draw (the security rule's measured-cost obligation)

CPU time through `src/test/cpuTiming.ts`, Node 24.18 (V8), this Mac, with nothing else compiling:

| Input | Pass 1 per load (first call / best) | Pass 2 per load (first / best) | Provenance confirm per load | Pass 3 per re-draw |
|---|---|---|---|---|
| Tracked demo export (`website/demo/`, 7,869 rows, 515 ML rows, 149 species) | 4.9 ms / 1.26 ms | 1.2 ms / 0.06 ms | under 0.1 ms (the demo's ledger is empty, so it short-circuits) | 0.03 ms (no selection), 0.02 ms (Photo + Audio, escapees on) |
| Generated 150,000-row backup, 3,000 species, a fifth of rows a form; 50,000-row ML export | 54.6 ms / 25.8 ms | 5.5 ms / 3.6 ms | 49 ms best, 66 ms first, worst case (every carrier consulted, 1,024 names on each list) | 0.81 ms (no selection), 0.19 ms (Photo + Audio, escapees on) |

"First call" is the real per-load figure (the species-name memos are cold); "best" is the warmed figure. At the 150k-row cap a load costs about 110 to 125 ms of main-thread CPU across the two passes and the confirmation, inside the load effect after the awaited parse (the confirmation runs in the provenance hook's memo, the schema's `useProvenanceLookup` shape), never in a render body. A control change re-runs only pass 3: under a millisecond. The Architect's expectation was 40 to 50 ms per load for pass 1 alone and a few milliseconds per re-draw; the figures sit inside it. A tenfold slower engine (a Pi's browser, an older phone) sits near 1.2 s per load at the cap, about the schema's worker reversal line, so that line is the one to watch on the slowest target; the realistic case (a few thousand species, tens of thousands of rows) is an order of magnitude below.

## D-21 The house header shows on the setup panel and the ready tab, not on loading or the load error

The design spec keeps the header above the setup panel, and the mockup draws the loading and unreadable states without it. The tab's root `div.sr-lfl-tab` and the `TabLoadErrorAlert` at its index 0 are the same nodes in every phase (so the region exists before its message), the header sits at index 1 in the setup and ready phases only.

## D-22 An exact tie between two selected formats goes to the later format in `MEDIA_FORMATS`

FR-25 breaks a tie "by format name as a stable tiebreak"; the schema says `MEDIA_FORMATS` order. The mockup compared lowercase keys alphabetically, which disagrees for a Photo / Audio tie. The build follows the schema: the latest is the maximum under (instant, manifest position), so Video beats Audio beats Photo on an exact tie, and a test pins it.

## D-23 Smaller build choices, recorded so nobody "fixes" them

- The count sentence keeps the global focus ring when the paging controls move focus to it (the mockup set `outline: none`; a visible ring is the better indicator after Show all).
- `ChecklistLink` takes no class, so the 1.5rem box is a wrapper `span.sr-lfl-cl` and the anchor is styled as its child (`.sr-lfl-cl > a`); the focus override is (0,2,1), which out-ranks the global `[tabindex]:focus-visible`, and it is also placed after the global ring block.
- The phone tier releases `ToggleSwitch`'s inline `height: 30` and `nowrap` with `!important` (the Breeding Codes pill precedent), because the switch takes no class and an inline style beats any class rule.
- `MAX_PUBLISHED_NAMES` stays module-private; the route-budget guard reads both lists' bounds through `sanitizeStore`, and a new row compares the two bounds to each other rather than restating them.
- `lib/pageList.ts` is on the entry graph, because the Weather backlog (an entry-chunk tab) now delegates to it. Its body was already on the entry chunk inside `weatherBacklog.ts`, so this is a move, not new weight; `entryChunk.test.ts` states both reaches.
- The disjointness of the two published lists over a generated token corpus is asserted in `exoticProvenance.test.ts`, the model's own suite, rather than `lifeLists.test.ts` as schema 3.1 suggests: the property belongs to `buildProvenanceLookup`.
- The Media label is the repo's 31st paired `.sr-ctl-label` (`controlRegisters.test.ts` moves 30 to 31 with the reason), and Search now lists Life Lists between Checklists and List Comparer for the query "list" (`alphaCodeSearch.test.ts`).
- The Settings markup fixture (`settingsOffIos.fixture.json`) was re-captured and diffed first: exactly one insertion per platform, the Life Lists tab-layout row, naming no other tab.

## D-24 Route budget, measured after the change

The guard's worst-case document, built through the shipped `sanitizeStore` with the guard's own constructions (131,072 ledger keys, 16,384 species at eight full-width tokens, two lists of 2,048 names of 128 `'\u0001'` units): **15,446,117 B against the route's 16,777,216 B**, 1.33 MB of headroom. The same construction with the two lists merged back into one list of 4,096 and no `exoticNames` field reads 15,446,101 B, so the new field costs exactly 16 bytes (its name and brackets) and the cap change keeps the document byte-for-byte what it was, as schema 3.2 intended. The schema quotes 15,118,421 B for the pre-change worst case; that figure does not reproduce through the guard's construction (15,446,101 B does, which also matches the store comment's existing "15.4 MB"), so the store comment keeps 15.4 MB. The conclusion the schema drew from it is unaffected: at 4,096 per list the document would exceed the route, at 2,048 it fits.
