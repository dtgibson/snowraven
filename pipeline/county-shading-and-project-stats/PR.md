# County Shading and Project Contributions

### What this does

Two additions in one build. The shipped county overlay reaches two maps that
carried none: **Species Detail's Sighting Locations map**, shaded by how many of
your checklists in each county reported the selected bird, and **Statistics'
Geographic Stats map**, shaded by species or by checklists across the whole
export. Both are computed entirely from the loaded backup, so they need no
connection and no API key, and the 3.85 MB county geometry is still only fetched
the first time someone turns Counties on.

And the Statistics tab gains a **Projects** section reporting which eBird
projects your checklists were submitted to, the California Breeding Bird Atlas
among them. Your backup does not record that at all, so it is built from a
user-initiated, stoppable, resumable, durably-cached sweep of your own checklists
through your own eBird key: nothing is sent until you press Check projects, the
section states the exact cost first, and every tally is rendered against the
number of checklists it was drawn from so a partial answer reads as a floor.

### How to test

The step-by-step version is in `HOW-TO-SEE.md` beside this file. In short: start
the app, open **Species Detail**, pick a species with a wide range, and turn on
**Counties**; then open **Statistics**, turn on **Counties** in the Geographic
Stats header, and compare a county's number with the Map Explorer's for the same
county and metric; then scroll to **Projects** and read the never-run state
before pressing anything.

### Notes for reviewer

**The one place the county half could have been silently wrong.**
`buildCountyAggregates(observations, checklists)` derives `records` from its
SECOND argument. FR-09 named only `speciesObs`, and the obvious reading — passing
the tab's or the backup's checklist array — shades *every county you have ever
birded, at its total checklist count*, regardless of species. It looks right and
is wrong everywhere. The shipped call is
`buildCountyAggregates(speciesObs, computeChecklists(speciesObs))`, and
`countyShadingPerSpecies.test.ts` asserts the wrong form's exact output as a
fixed reference so it cannot be "simplified" back in without a red test.

**The static/dynamic import split is the inverse of the intuitive reading.**
`entryChunk.test.ts`'s walker follows STATIC edges only, so FR-21's
guard-the-guard ("this host's subtree really reaches `CountyLayer`") is
satisfiable *only* with a static `CountyLayer` import at each host. A dynamic one
would fail a correct implementation. It is safe because both hosts are already
off `App.tsx`'s static closure. The GEOMETRY is what stays lazy:
`lib/countyGeometry.ts` is reached by `await import()` at all three call sites,
so the asset is two dynamic hops from any host.

**Only the 429 half of the eBird error mapper is single-sourced.** The full
mapper's non-429 fallback is `502 "eBird API error: {n}"`, which would replace
the checklist route's `502 "Could not fetch checklist: {exc}"` — a string the
Life List Comparer displays — and the desktop route's `{ status: res.status }`.
`ebird_rate_limit_exception` / `ebirdRateLimitError` return the 429 or null, and
each route keeps its own non-429 fallback. Please do not collapse them.

**"Check again" needs the force path.** Under the 365-day TTL a completed sweep
leaves the normal target set empty for a year, so the complete state's control
would otherwise be a no-op press for its entire useful lifetime. It passes
`{ force: true }` through the SAME `dedupedFetchProjects` chokepoint — the
escapee store's `opts.refetch` precedent — so it is not a second write path and
not a second enforcement point.

**The store is fill-and-stop, never FIFO.** An eviction here destroys a paid-for
network answer and, at capacity+1, would do so on every pass forever. Admission
gates on `store.order.length` — the container's own size — never a separate
counter. Measured at capacity+1 as WORK DONE (admissions, refusals, evictions),
never elapsed time, and there is a test that re-merges one id fifty times to
prove admission capacity is not silently consumed.

**Nothing derived is persisted.** The store holds the two normalized fields plus
a TTL anchor and nothing else; every count, date and share is recomputed by
joining against the currently loaded backup. The denormalized-published-field
rule's precondition is not met here (the only reader owns both inputs), so
publishing a copy would buy nothing and would be the stale-cache trap the rule
warns about.

**Two live Python/JS parity traps, both carried as fixture rows rather than
comments.** Python's `$` admits a trailing newline (hence `re.fullmatch`), and
`isinstance(True, int)` is `True` (hence the explicit bool exclusion, or
`projectIds: [true]` would become `[1]` on one transport only).

**The county popup becomes a SHEET on a narrow map, and that is a visible
change on phones at every text scale.** MapLibre picks a popup's anchor itself,
and `left` / `right` place an EDGE at the click point, so containment needs
`width <= (mapWidth - offset) / 1.5`, not `width <= mapWidth`. Past two thirds
the centred band between its two thresholds is empty and every click overflows
by nearly the popup's own width — which is the 129px clip QA measured on the
240px Statistics map at 200% text scale, and which the same 240px map was
already exposed to at 100%. `lib/countyPopupFit.ts` caps the width at what the
container can anchor (so any map at 382px or wider is byte-identical to today,
including desktop and the Map Explorer's own full-width map) and, below the
design's own 188px body minimum plus chrome, pins the popup to the container
instead. On the failing map that is 224px of readable width rather than the
153px an anchored cap alone would have left. It reaches all three mounts,
because they share one `CountyLayer`; that is deliberate, since Species Detail
and the Map Explorer have the same latent exposure at phone widths.

Verified in Chromium against the BUILT stylesheets (not the sources: Tailwind's
preflight `box-sizing` is load-bearing here), both configurations on the same
DOM nodes, sweeping every click position in the container:

| map / scale | before: worst overflow | close button off-container | after |
|---|---|---|---|
| Statistics 240px @ 200% | **129px** | 121 of 241 positions | 0px, button inside |
| Statistics 240px @ 100% | 106px | 128 of 241 | 0px, button inside |
| Species Detail 270px @ 200% | 111px | 133 of 271 | 0px, button inside |
| Species Detail 270px @ 100% | 76px | 128 of 271 | 0px, button inside |

The 129px reproduces QA's screenshotted figure exactly. Two things the browser
settled that no stylesheet assertion could: the computed `max-width` resolves to
the published value, so the `!important` really does beat the inline `max-width`
MapLibre writes on the popup element; and `transform` computes to `none` in
sheet form, beating the inline anchor transform MapLibre rewrites on every map
move. The Species Detail rows also show QA's `rightOver: 0` there was one lucky
click rather than a passing surface.

**The popup body's two width declarations are ABSOLUTE lengths, and the sheet
alone releases them.** Moving `min-width: 188px` / `max-width: 220px` off the
inline style and onto `.sr-county-popup-body` as `min(188px, 100%)` / `100%`
made the floor a no-op: the popup is absolutely positioned and shrink-to-fit, so
the `100%` resolves against the used width the content itself produced and the
`min()` collapses to it. The Map Explorer's county popup, a surface this change
was required to leave alone, rendered 30px narrower at the default text scale.
The floor is safe as an absolute length because `COUNTY_POPUP_MIN_PX` is now
DEFINED as that 188px plus the content chrome, so the narrowest anchored popup
leaves the body exactly its minimum; only the SHEET, pinned to a container that
may be narrower than that, releases both, and it does so in its own rule rather
than by weakening the anchored one.

Re-measured in Chromium against BOTH BUILT stylesheets on identical DOM nodes
(a detached HEAD worktree built with the same toolchain), popup width / body
width, at 100% and 200% in-app text scale:

| case | HEAD | this build | |
|---|---|---|---|
| Map Explorer 1140px map | 218 / 188 | 218 / 188 | identical |
| narrowest anchored (337px map) | 218 / 188 | 218 / 188 | identical |
| anchored band (360px map) | 218 / 188 | 218 / 188 | identical |
| sheet, 240px map | 218 / 188 | 224 / 194 | differs BY DESIGN (QA-69) |
| sheet, 200px map | 184 / **188** | 184 / 154 | differs; HEAD overflows its own content box |

Every anchored row is identical at both scales, with zero overflow. The two
sheet rows are the QA-69 fix itself, and the 200px row is the case the class
form exists for: HEAD's absolute floor puts a 188px body inside a 184px popup.
**Non-vacuity, by injection:** re-applying `min-width: min(188px, 100%)` to the
running page collapses the same anchored body from 188px to 103.3px, so the
harness can see the defect it certifies as absent. `countyPopupFit.test.ts`
additionally rejects a percentage in either width on the anchored form in any
spelling, and sweeps every map width in the anchored band asserting the body's
room never falls below the floor.

**Agreement is a rule now, not a ban list.** The pass that fixed "about 1
minutes" shipped "1 requests" and "The other 1 have not been asked about yet."
past a guard that banned four named strings. Executing the copy over every
reachable state at every count where a singular can appear found seven defects,
five of them unreported: `1 requests`, `The other 1 have`, `1 row ... carry`
(the skipped-ids note's verb was never pluralised), `0 of 1 checklists checked`,
`all 1 of your checklists`, `Counts below cover only those 1`, and `of the 1
checked`. Three helpers now carry the whole class — `countRef` (a count standing
in for a noun already named), `thoseClause`, and one `fraction` composed by the
four states that show one plus `checkedClause` — and the guard states RULES over
the corpus: no count of one takes a plural noun, no determiner takes a bare "1",
and no plural verb follows a subject counted at one (sentence-scoped, which is
what catches "1 row ... carry" at four words' distance). The grid is generated
by the shipped `restingStatus` rather than hand-written, so it covers what the
app can reach and nothing else. All seven defects were mutation-restored and
each turned the sweep red.

**The Projects denominator is 3,300, and no longer moves with a checkbox.** The
sweep was fed the `filteredObs`-derived `checklists` memo, so "Count all forms"
governed a count of CHECKLISTS: `S290076558`'s only row is a `hawk sp.`, which
dropped that checklist from the total at the default setting. Worse, the
identity change tripped FR-46's export-swap cancellation, so flipping the
checkbox mid-sweep silently killed an eight-minute pass. It now derives from
`effectiveObs` alone, the same shape as `countableBackboneNames`.

An earlier draft of this note said 3,252. That figure is the DESKTOP DATADIR's
older export (`MyEBirdData 2026-06-28.csv`, 21,369 rows); the file the app
actually serves is `<repo>/data/ebird-backup.csv` (`MyEBirdData 2026-07-11.csv`,
21,856 rows, 3,300 submissions). Running the shipped `isNonCountableForm` over
every checklist in BOTH files finds exactly one that vanishes at the default
setting — `S290076558` in each — so the defect was 3,299/3,300 on the served
file and 3,251/3,252 on the older one. The fix removes the coupling rather than
correcting a number, so it is independent of either total, and the guard's
fixture is four checklists rather than a real count.

**Deliberate deviations, each stated in the code where it lives:**

1. The county shading panel's legend carries **no `aria-live`**, unlike the Map
   Explorer's. Here it sits inside a clipped, `inert`-able disclosure, and a live
   region in such a subtree is *inserted* into the accessibility tree when the
   panel opens, announcing the whole ramp every time. The metric change is
   already announced by the `SegControl`'s own `aria-pressed`. The design spec
   asked for `aria-live`; this is the repo's own standing rule winning over it.
2. The running spinner does **not** survive `prefers-reduced-motion`. The design
   spec says it should, on the belief that the shipped `.spin` does; it does not
   — `globals.css`'s global reduce block collapses every animation app-wide, and
   the escapee section's spinner behaves identically. Making an exception would
   deviate from every other spinner in the app. Reduced-motion users get the
   status sentence, which updates on the same schedule.
3. `weft-design-lint` is unchanged: **zero warns**, and its 43 advisory notes
   are byte-identical to HEAD's apart from two line-number shifts of
   pre-existing `CountyLayer.tsx` notes. An earlier revision of the pin dim
   added an unconditional `transition`, which raised one new "reduced-motion"
   note on `SightingsMap.tsx`; making the dim strictly opt-in removed both the
   note and the DOM/style change on the Named Birds card map, so FR-19's "no new
   DOM with the overlay off" is exact rather than approximate. Reduced motion is
   handled app-wide by `globals.css`'s
   `* { transition-duration: 0.001ms !important }`, which beats a normal inline
   declaration; that is recorded in a comment at the site.

**Measured, not assumed** (the two aggregate figures are QA's independent
re-measurement, which perturbs the input every run — a distinct species per
run, the full-export input perturbed — so no memo is being timed; the earlier
numbers in this note were optimistic for that reason and have been replaced):

- Per-species aggregate: **0.31 ms** against the 50 ms ceiling (min of 7), a
  ~160x margin.
- Full-export aggregate: **16.84 ms** against the 200 ms ceiling (min of 7), a
  ~11.9x margin. Both margins are asserted as ratios, not as bare ceilings, and
  both clear the PRD's 10x requirement.
- First-paint JS, genuine build A/B (a detached `git worktree` at HEAD built
  with the same toolchain, both `dist/` trees measured by the same script):
  504,596 B -> **506,513 B**, **+1,917 B (+0.38%)**.
- **NFR-04's "no growth" is still NOT met, but no byte of the shortfall is this
  feature's own code any more.** The one module that was on first paint,
  `lib/checklistFields.ts` (150 B gross / 125 B net), is off it: `transport.ts`
  rides the entry chunk and used to resolve the `fields=` flags there before
  handing them to the dynamically imported desktop service, so the whole table
  came with it. The transport now passes the raw `fields` STRING and
  `tauri/checklistService.ts` — which is only ever reached through
  `await import(...)` — resolves it. Measured: the first-paint total fell
  506,662 -> 506,513, and `skipLocName` now appears only in
  `assets/checklistService-*.js`. `entryChunk.test.ts` pins both halves (the
  table absent from the App graph, present in the service's), and the guard was
  mutation-tested red by re-adding the import.
- **Every new module of this feature is absent from every first-paint chunk**,
  probed in the shipped minified bundles by string literals that survive
  minification — `sr-county-fill`, `sr-county-popup-max`, `Check projects`,
  `skipLocName`, `fields=projects`, `sr-proj-rows`, `us-counties`, `projId` —
  all ABSENT, against a positive control (`/checklists/`, found in
  `assets/commentBlocks-*.js`) that proves the probe can see the first-paint
  set at all. The first attempt at this probe reported the controls absent too:
  zsh does not word-split an unquoted array-like parameter, so `grep` received
  one nonexistent path. The numbers below are from the fixed harness.
- **The remaining +1,917 B is chunk-boundary redistribution**, not reachable new
  code. New import edges changed Rolldown's chunking: `index-*.js` fell
  301,968 B -> 269,344 B (-32,624 B) while five pre-existing modules
  (`ChecklistLink`, `commentBlocks`, `observationsCache`, `offlineDetect`,
  `speciesUtils`) were extracted into their own preloaded chunks, 10 first-paint
  chunks becoming 14. The cost is per-chunk plumbing, and it is caused by this
  change even though none of it is this change's code.
- QA-23's second clause ("the entry chunk gains no modules") is therefore now
  met module-for-module — the App graph reaches no module it did not reach at
  HEAD — while the BYTE total is still 1,917 B up for the chunking reason above.
  Stated both ways rather than picking the flattering one.
- CSS: 56,636 B -> **63,512 B** (**+6,876 B**), the new `.sr-proj-*`,
  `.sr-countypanel-*` and `.sr-countylegend-*` rules plus the county-popup
  containment block. (An earlier figure of 62,842 predated that block.)
- `dist/index.html`'s modulepreload set contains no county geometry, no
  `CountyLayer`, no completeness code and no `vendor-maplibre` — independently
  re-verified.

**Deliberately NOT done here:** the version bump, `CHANGELOG.md`, tagging and
release are the deploy stage's.
