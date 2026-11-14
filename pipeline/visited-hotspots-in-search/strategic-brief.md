# Strategic Brief: Visited Hotspots in Search

## What We're Building
Search (the Cmd-K overlay) gains a third kind of result: the places in the user's own eBird backup. Typing part of a place name lists matching locations, and choosing one opens the Hotspot Reports tab on that location's report. It ships only if it passes the responsiveness gates in this brief; if no form of it passes, it does not ship.

## Why Now
The user asked for it fresh, in these words: "Add visited hotspots to the app search, unless it would degrade responsiveness of the app". It is not a roadmap Up Next item. It is the follow-up the Hotspot Reports brief named and set aside one release ago ("Opening a report from a location name elsewhere in the app, and locations in Search. A good follow-up once the tab exists"), and 1.0.71 shipped that tab, so a location result now has somewhere to go.

## The User Problem
A birder thinks in places, and Search is how the app is reached by name: a tab, a bird. A place is the one thing a user can name that Search cannot reach. Today the route to "my record at the refuge" is open Hotspot Reports, open its picker, type, choose. Search should make that one step, from anywhere in the app, without getting slower at what it already does.

## What the repo establishes (the grounds for the decisions below)
- **Search is `components/CommandPalette.tsx` over `lib/paletteRows.ts`.** One flat row array (destinations, then species), one active index, option ids keyed on the index. Destinations render in the first commit from a prop. Species come from the shared parse (`loadEbirdObservations`) through `speciesIndexFor` (`lib/speciesIndex.ts`): one pass over the observations on the main thread, memoized on the identity of the observations array behind a `WeakRef`, so it is built once per loaded file and never per keystroke.
- **Every keystroke rebuilds the rows synchronously on the main thread, inside render.** There is no debounce and no worker. The shipped requirement (command-palette PRD, NFR-02) is under one frame, 16 ms, per keystroke on an index of about 1,000 species, with the index never re-derived per keystroke. Species rows are capped at `SPECIES_CAP` (50) with a visible cap line.
- **Search makes no request and stores nothing.** Help says so ("It works offline and needs no key"), and README and the website carry no Search section at all, held by `palettePublishedClaims.test.ts`.
- **The backup carries a Location ID, name, county and state on every row, and no hotspot flag.** Whether a location is a public eBird hotspot comes only from the region-scoped hotspot Set (`lib/hotspotSet.ts`), which is built from an eBird lookup with the user's key and answers in three states (hotspot, personal, not yet known).
- **Hotspot Reports already defines "a location in the backup".** `buildLocationIndex` (`lib/hotspotReports.ts`): a location is its Location ID (1 to 16 code units), a row counts at its checklist's first row's location, names are bounded at 200 code units, namesakes are told apart by place label and, where that ties, by Location ID. The index is held only by the tab's ready phase (no module memo, by decision), so Search cannot borrow it from a tab that is not mounted. Measured in that schema (section 12.5): the full index costs 64.1 / 31.9 ms at the realistic cap (150,000 rows, 3,000 species, 2,000 locations, 21,429 checklists) and 266.3 / 225.9 ms when every row is its own location; the picker's per-keystroke filter is 0.04 to 0.07 ms at 2,000 locations and 1.8 to 4.4 ms at 150,000, with a 97 ms worst case in V8 for a hand-built file and an adversarial query.
- **The tab has no way in from outside.** `HotspotReportsTab` takes `onGoToSettings` and `onOpenSpecies` only; its selection is local state keyed on Location ID. Species Detail's precedent is `App.requestedSpecies` plus a single-use consume effect that waits for the tab's ready phase.
- **"Visited" has two meanings in this project.** The Map Explorer's Hotspots view marks each hotspot visited, unvisited, or a personal location. The user's own words for Hotspot Reports were "all public and personal hotspots", which that brief settled as every location in the backup.

## The responsiveness condition
The condition is part of the request. This section turns it into gates that a measurement settles. Nobody downstream may treat a gate as advisory, drop one, or loosen a number without the user's decision.

**Fixtures.** The realistic cap is the hotspot-reports schema's shape: 150,000 rows, 3,000 species, 2,000 locations. The hostile shape is 150,000 rows with every row its own location. Engines: V8 and JavaScriptCore, on the developer Mac, CPU time through `frontend/src/test/cpuTiming.ts` with nothing else compiling.

| Gate | What is measured | Pass rule |
|---|---|---|
| R1 Typing | The whole synchronous row build for one keystroke (destinations, species with code ranking, locations) at the realistic cap, over a one-character query, an ordinary match and a no-match, beside the same build with locations removed | The location half adds at most 4 ms (a quarter of a frame) and the total stays at or under 16 ms, in both engines. If the build without locations is already over 16 ms on this fixture, that is reported as a separate finding about the shipped palette and the feature is judged on the 4 ms alone |
| R2 First open | Main-thread CPU the feature adds to the first Search open after a file load, at the realistic cap | At most 50 ms (the long-task line) in both engines, none of it before destinations have painted. Later opens and later keystrokes cause zero location index builds (counted by a spy). A session that never opens Search does no location work at all: none at launch, on file load, or on another tab |
| R3 Hostile files | Every new scan over file text, at doubling sizes, including a leg where every row is its own location | Linear by the house method (at most 2.2x per doubling). Rendered location rows are capped by a named constant the file cannot change, with a visible cap line. Names are length-bounded before matching and before render. At 150,000 distinct locations the location half of a keystroke costs no more than the species half costs at 150,000 distinct species in the same run, so the worst case is no worse in kind than what ships |
| R4 Load and memory | The entry chunk, and the heap the location index retains | Nothing new on the entry chunk (`entryChunk.test.ts`). The index becomes unreachable when the parse it came from is replaced or cleared (asserted by test). Retained heap at the realistic cap is recorded and at most 5 MB; the hostile figure is recorded with the bound that limits it |
| R5 What ships today | Destinations, species results and the four backup states | With locations present, destination and species rows, their order, the cap line and Enter's choice of the first row are unchanged for every query that matches no location; destinations still render in the first commit; the existing palette suites stay green |

**Who measures, and when.** The Architect measures first, on the pure functions, in both engines, and writes the figures into the schema beside each declared scan (cost per draw and per re-draw, as CLAUDE.md requires). That is the first go or no-go, taken before any design or build work. The Engineer re-measures in the built app in Chromium and WebKit and records the figures. QA judges R1 to R5 on those recorded figures before the deploy gate, with a live look at the built app on a cap-sized synthetic backup. Absolute times are judged from recorded measurements; the committed guards are quotients, counts and structural assertions, which is the house practice for timing.

**The outcome ladder.** Each form is measured against the same five gates, in this order, and the first that passes is the one that ships.
1. **Full form.** Location results on every keystroke from the first character, in the same open search as species.
2. **Deferred form.** Location rows join an open search a moment after species do, as species already join after the parse, so typing never waits on location work. The only visible difference is a short gap on the first open after a file load.
3. **Threshold form.** Locations are matched only once the query has a minimum length the Architect sets from the measurement, at most three characters, stated in Help.
4. **Does not ship.** If no form passes, the run stops at the stage that measured it, the numbers go to the user, and nothing is merged, bumped or released.

**Not acceptable as a reduced form:** indexing only some locations without saying so; dropping personal locations to cut the count; delaying, debouncing or capping destinations or species; any network request; a persisted index. A persisted index would be a new durable store keyed on file content (a `clearDerived.ts` row and a privacy-policy sentence); if it turns out to be the only passing form, that goes back to the user as a decision, not into the build.

**Device limit, stated.** No agent touches a phone, so every figure is from the developer Mac. The gates carry headroom for that: a real backup holds hundreds of locations to the low thousands, where the shipped picker filter measures under a tenth of a millisecond. The user's routine iPhone check of the build gains one step: open Search and type a place name.

## Success Criteria
- With a backup loaded, typing part of a place name in Search lists matching locations from that backup, and choosing one lands on the Hotspot Reports tab showing that location's report, from any tab, including from a fullscreen map.
- Every location Search offers is one the Hotspot Reports picker offers, and the reverse. A Search result never opens a place the tab does not know.
- Two locations that share a name are distinguishable in Search and each opens its own report, because a location is its Location ID, never its name.
- With nothing typed, Search shows destinations only, as today. Destination and species results behave exactly as they do now.
- When more locations match than are shown, a line says so; the cut is never silent.
- The backup states cover locations as they cover species: reading, no backup saved, a saved backup that would not load. A failed status read is never reported as "no backup".
- Replacing or clearing the backup reaches an open Search at once, and a location chosen just before a replace that the new file lacks falls back to the tab's general statistics silently.
- Choosing a location from Search costs no more than choosing it in the tab's own picker: one location index build per loaded file in the tab, never one per selection.
- Search still makes no request and stores nothing over a full open, type and select cycle.
- Gates R1 to R5 pass on recorded measurements, for the form that ships, and the brief's ladder position is written into the run's decisions.
- The overlay holds at 320px and 200% text scale in both themes, and adds no tab stop.

## Scope
- **Location rows in Search**, as a third group after Species in the same flat row array, with its own heading, its own cap constant and cap line. Each row shows the location's name and its place label (county and state), and the Location ID only where name and place both tie, the same rule the picker uses.
- **Matching** on the location name, as a lowercased substring against a bounded query, through the same kind of predicate destinations use. No regex built from the query.
- **A location index for Search**, derived in memory from the shared parse, tied to that parse's lifetime, built at most once per loaded file and only once Search is opened.
- **A way into Hotspot Reports from outside**: an App-level single-use request carrying a Location ID, consumed by the tab once its ready phase holds an index, with the same fullscreen-map collapse the species route has. Chosen from Search, the report behaves as a picker selection does.
- **In-app copy and Help in the same change**: the group heading, the backup-state sentences that today say "species", the cap line, the Search section of `docs/HELP.md`, the Default Files sentence that says what Search reads, and one sentence in the Hotspot Reports section. The Help guards in `palettePublishedClaims.test.ts` move with them.
- **Guards**: the gate measurements above as committed quotient and count rows; set parity with the Hotspot Reports picker over a generated corpus; a zero-request row over the full cycle; hostile-name rows (`__proto__`, `constructor`, whitespace, a 200-unit name, a delimiter-absent leg for any native search); the rule files' `paths` extended for every new module that holds a scan.
- **Release consequences carried by later stages**: a patch bump with the six-file set on all platforms; the What's New and Fastlane changelog lines held for the user's yes.

## Out of Scope
- **Hotspots the user has never birded**, and any eBird lookup from Search. That is the Map Explorer's Hotspots view.
- **Hotspot or personal marks on Search rows, and filtering Search to public hotspots only.** Both need the hotspot classification, which is a network answer Search must not start (see Key Decision 1 and the open question).
- **Matching on county, state or Location ID.** A state name would match most of a backup at three letters and bury the species results.
- **Checklists, named birds, counties or dates in Search.** One new result kind per feature.
- **Opening a report from location names elsewhere in the app** (Checklists, Species Detail, map popups). Those keep their eBird links.
- **Remembering the chosen location across launches, recent searches, or any stored value.**
- **Changes to the Hotspot Reports page itself**, beyond accepting a requested location.
- **README, website, App Store listing and privacy policy.** None describes Search results today and none changes. If a later stage wants a sentence there, it is a held proposal of at most one sentence for the user's yes.
- **New screenshots.** No tab is added, so the regenerate-every-set rule is not triggered.

## Key Decisions
1. **"Visited hotspots" means every location in the user's own eBird backup, public hotspots and personal locations alike: exactly the set Hotspot Reports reports on.** Reason: it matches the user's own usage one release ago ("all public and personal hotspots"), the home patch and the yard are the places a birder most wants to reach, and it is the only reading Search can serve without a network answer. The narrower reading (public eBird hotspots only) would make Search start or depend on the eBird hotspot lookup, break its published no-request property, and show nothing useful to a user with no key or an unanswered region. Reversal is cheap if the user wants it: a filter over the same rows from the passively read classification, with the not-yet-known state handled as Hotspot Reports handles it. Listed as an open question below.
2. **A location result opens Hotspot Reports on that location.** Reason: it is the only location-scoped surface, and its brief named this route. The Map Explorer and Checklists have no per-location entry point and would each need a new filter path.
3. **A location is its Location ID, and Search's set is the tab's set.** Reason: names repeat. The Architect either shares one rule with `buildLocationIndex` or proves parity over a generated corpus; a second, slightly different definition is the failure to avoid.
4. **Locations are the third group, after Species.** Reason: nothing that is first today stops being first, so Enter with no highlight and every learned arrow position are unchanged. Empty query shows no locations, as it shows no species.
5. **The responsiveness condition is a ship gate with a fixed ladder** (the section above): full, deferred, threshold, or not shipped. The first go or no-go is the Architect's measurement, before design and build.
6. **Search does not import the full Hotspot Reports index build unless the measurement says it fits.** Reason: that index carries per-row columns, species tables and media joins Search does not need, and its measured cost is the larger part of the R2 budget. A slim pass, or one folded into the species pass, is the expected shape; the choice is the Architect's, inside the gates.
7. **The location index must not outlive its parse.** Reason: the species memo keeps a strong reference to its index because it is about a thousand small objects; a hostile file can make a location index 150,000 records with long names, so the same shape would hold tens of megabytes after a clear. This needs its own argument at the definition site.
8. **Network posture, in the durable form: no third-party request, no new endpoint or host, and no request moved between components.** Search itself asks for nothing. Choosing a location opens a tab that may make its existing requests (the hotspot classification with the user's key, map tiles once a located place is shown), exactly as pressing that tab does today; Search adds a route to them, not a request. On web/Pi the file reads are the existing calls to the user's own server.
9. **Nothing is persisted.** No durable store, so no `clearDerived.ts` row and no privacy-policy sentence.
10. **Scans declared for the Architect**: the location pass over the observations (per draw: once per loaded file; per re-draw: none), the per-keystroke match over bounded names, and the ordering of matches. Each owes a linearity argument, the end bound of any native search it uses, its measured cost per draw and per re-draw at the cap, and the `security.md` glob that covers the module holding it. Two shipped precedents disagree on ordering (the picker uses `localeCompare`, Search's species use code-unit comparison for an identical order on every platform); the Architect picks one and says why.
11. **The group heading must be true of a personal location.** Recommendation: "Locations", the word Hotspot Reports uses inside its page. The final word is the Designer's.
12. **Inherited constraints, named once**: option ids and anything a selector must find are keyed on an index, never on file text; file-text keys live in a `Map`; no interactive element inside a `role="option"` row (so no `HotspotLink` and no `BirdName` in rows); every color through `var(--sr-*)` tokens; tab names from `TAB_LABELS`; no em dashes and American spelling in copy; properties, not counts, in any published claim; verification by automated tests plus a live look at the built app, with no agent touching a physical device.

## Alignment with the product brief
No tension. The feature serves the same birder, reads only their own export on their own device, adds no account, server, request or stored data, and works alongside eBird. It makes an existing local report easier to reach.

## Open question for the user
**Should Search list personal locations, or public eBird hotspots only?** This brief builds on "every location in your backup", for the reasons in Key Decision 1. If the answer is "public hotspots only", the build changes: Search would read the hotspot classification, could show nothing for a region eBird has not answered, and its Help sentence about needing no key would need a caveat.
