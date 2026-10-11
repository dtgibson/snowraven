# PRD — Species Code Search
**Feature:** species-code-search
**Date:** 2026-10-08
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)
**Amended:** 2026-10-10, after the Designer stage (decisions.md 1 to 6). The user resolved OQ-02 (rule A) and decided that a row's codes are its American name's codes: its `bandingCodes` plus only the `comNameCodes` formed from the eBird common name SnowRaven shows, with hyphen-convention and accent-free spellings of that name counting as variants. **This supersedes Key Decision 1 of the strategic brief** (the union of `bandingCodes` and `comNameCodes`), which is left unedited as the record of what was first approved. Rows changed: the measured notes below, US-02, US-03, FR-01, FR-04, FR-15, FR-28, Out of Scope, OQ-01, OQ-02, QA-04, QA-07, QA-09, QA-10, QA-13, QA-16, QA-19, QA-20, QA-21, QA-27, QA-38, QA-42. The precise rule and every re-derived figure are in schema.md 2.7 and 5.2.

## Feature Overview

Search and the shared type-to-find species picker gain a third way to find a bird: typing one of its eBird codes in full (`yrwa`, `amro`, `cago`). A query that equals a bird's code lists every bird in the user's backup that carries that code, ahead of the ordinary name matches. Every other query behaves exactly as it does today.

### Measured on 2026-10-08, against eBird's live taxonomy (public `ref/taxonomy/ebird`, 17,891 entries)

These figures were taken while writing this PRD so the Architect and Tester start from numbers, not reasoning. Each count carries its denominator.

- The live taxonomy still matches the shipped snapshot (`version` 2027): `byCom` 0 differences over 11,167 names, `byCode` 0 differences over 17,891 codes. This confirms the brief.
- 17,193 of 17,891 entries carry at least one code once `bandingCodes` and `comNameCodes` are combined. All 11,167 species carry at least one. Most spuhs carry none (28 of 722 carry one).
- 10,277 distinct codes across all entries. One entry has a two-letter code (OU) and five have three-letter codes (EMU, KEA, TUI on two entries, MAO). Every other code has four characters.
- **Correction to the brief (flagged, see OQ-01):** not every code is A to Z. 23 code occurrences on 19 entries (15 of them species) contain `Ü` (U+00DC) or `Ö` (U+00D6), for example Rüppell's Bustard `RÜBU`. All are NFC. Each of those 15 species also carries eBird's own unaccented twin (`RUBU`). A guard written as `^[A-Z]{2,4}$` would stop the generator on today's data.
- One code can name up to 54 entries (`ISTH`, the island-thrushes). No two published common names are equal ignoring case (0 of 17,891). No published name equals an `Object.prototype` member name.
- The brief's examples held for eBird's full code set: `yrwa` and `mywa` both named Yellow-rumped Warbler and its forms; `cago` named Canada Goose, Cackling Goose and `Cackling/Canada Goose`; `nosh` named Northern Shoveler and Northern Shrike; `trsw` named Tree Swallow and Trumpeter Swan; `auwa` named `Yellow-rumped Warbler (Audubon's)` and `Yellow-rumped Warbler (West Mexico)`, not the species; `gbhe` named Great Blue Heron and also Green Heron (once called Green-backed Heron).
- Hybrids and slashes carried their parents' codes. `Cape May x Yellow-rumped Warbler (hybrid)` carried YRWA, MYWA and CMWA.
- **Re-derived 2026-10-10 under the amended rule (American name and variants):** 15,471 of 17,891 entries keep a code, including all 11,167 species; 8,951 distinct codes; at most 30 entries share one (RECR). `yrwa` names Yellow-rumped Warbler and its forms. `mywa` names the Myrtle form (its banding code), not the species, Audubon's or the hybrid. `auwa` names Audubon's only. `cago` names Canada Goose and Cackling Goose; the `Cackling/Canada Goose` slash keeps only its banding code CCGO. `nosh` and `trsw` are unchanged. `gbhe` names Great Blue Heron, not Green Heron. `goos`, `cost`, `rodo`, `liau`, `gndi` and `isth` name nothing. A slash or hybrid forms its code from its whole displayed name, so 82 of 1,035 slashes and 19 of 792 hybrids keep a code, and `Cape May x Yellow-rumped Warbler (hybrid)` keeps none. `rubu` and `rübu` both name Rüppell's Bustard. Common Wood-Pigeon keeps CWPI, COWP and COWO (hyphen variants).
- Not codes: `teal`, `duck`, `gull`, `hawk`, `tern`, `rail`, `loon`, `owl`, `jay`, `yr`, `yrw`. Codes that are also words: `wren`, `dove`, `crow`, `swan`, `ibis`, `rook`, `ruff`, `smew`, `sora`, `sand`, `rock`, `gold`, `blue` (all still codes under the amended rule).
- **Name prefixes that are codes (flagged, see OQ-02):** 463 of 2,175 four-letter word-start prefixes in species names are themselves codes. Among birds with banding codes (2,253 species, the North American set), 53 such prefixes name one bird and begin other birds' names. Examples a North American birder will meet: `goos` is Common Merganser (Goosander), `cost` is European Starling, `snow` is Snowy Owl, `sand` is Sanderling, `will` is Willet, `colo` is Common Loon, `buff` is Bufflehead, `dove` is Dovekie. **Under the amended rule `goos` and `cost` are no longer codes (they come from other names); `snow`, `sand`, `will`, `colo`, `buff` and `dove` still are, and 421 of the 2,190 four-letter word-start prefixes in species names are kept codes (counted with the schema's word split).**
- Destination labels in Search that contain a code: `weat` (Weather), `tail` (Species Detail), `tati` and `tist` (Statistics), `list` (Checklists, List Comparer), `comp`, `ompa` and `pare` (List Comparer), `etti` (Settings). Nine codes in all. Under the amended rule `weat` and `etti` are no longer codes; the other seven are.

## User Stories

> **US-01** — As a birder who enters checklists on eBird Mobile, I want to type a bird's four-letter code into Search, so that Enter takes me to that bird on Species Detail without typing its name.

> **US-02** — As that birder, I want a code shared by several of my birds to list all of them, ahead of the name matches, so that I can pick the one I meant even when codes collide (`cago`, `nosh`, `trsw`).

> **US-03** — As a birder who knows both kinds of code, I want the banding codes (`amro`, `yrwa`, `mall`) and the code formed from the bird's name where it differs (`cago` for Canada Goose, whose banding code is CANG; `cowp` and `cowo` for Common Wood-Pigeon) to work, so that whichever habit I have, it works. *(Amended 2026-10-10: codes eBird takes from a bird's other names, such as `mywa` for the species, `rodo` and `goos`, are no longer offered.)*

> **US-04** — As a birder who records forms, I want a form's own code (`auwa`) to find that form and the parent's code (`yrwa`) to find the species and its forms, so that forms are as easy to reach as species.

> **US-05** — As a birder using a species picker on Species Detail, the Calendar, the Map Explorer or Statistics, I want the same codes to work there as in Search, so that one habit works on every surface.

> **US-06** — As a birder who searches by name, I want every query that is not a bird's code to behave exactly as it does today, so that nothing I rely on moves.

> **US-07** — As any user, I want Search and the pickers to open and match names at once, whatever the state of the code data, so that the feature never slows or breaks what already works.

## Functional Requirements

### A. The code data

> **FR-01** — The app shall ship a build-time code asset derived from eBird's taxonomy. For every published taxon entry, in every category, that carries at least one code, the asset shall record that entry's kept codes: all of its `bandingCodes`, plus only those `comNameCodes` formed from the entry's own displayed eBird common name under the standard four-letter rule, where a code formed under another hyphen convention or from the name with its accents removed counts as a variant of that name (schema.md 5.2). Codes eBird lists from a bird's other names (British, international or former names) are dropped at generation time. Duplicates within one entry may collapse. No kept code shall be rewritten or folded, and none shall be added. `sciNameCodes` and the six-letter scientific codes are excluded. *(Amended 2026-10-10; was the union of `bandingCodes` and `comNameCodes`.)*

> **FR-02** — The asset shall be keyed so a common name from the user's backup can be joined to its codes without loading the taxonomy snapshot. The key is the published common name compared without regard to case.

> **FR-03** — The asset shall carry the taxonomy snapshot's `version`. It shall be produced by the same generator run that produces `ebird-taxonomy.json` and `ebird-countability.json` (`scripts/build-ebird-taxonomy.mjs`), and not by `npm run build`. A missing API key shall never break CI.

> **FR-04** — Before writing any file, the generator shall stop with a non-zero exit and write nothing when any of these holds:
> (a) fewer entries carry codes than a plausibility floor set well below the measured 17,193;
> (b) any species-category entry carries no code after the filter of FR-01;
> (c) any code is shorter than 2 or longer than 4 characters, contains a character other than `A` to `Z`, `Ö` (U+00D6) or `Ü` (U+00DC), or is not in Unicode NFC (the admitted alphabet is closed: a new character stops the build for a human decision);
> (d) two published common names are equal ignoring case;
> (e) a key equals an `Object.prototype` member name (`__proto__`, `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`);
> (f) the asset's `version` differs from the snapshot `version` written in the same run;
> (g) the filter of FR-01 disagrees with its own definition (a kept code that is neither one of the entry's `bandingCodes` nor formed from its name, or a dropped banding code), or a displayed name has a shape the rule does not cover (more than four hyphenated words).

> **FR-05** — **Revision check.** When the generator's version equals the committed snapshot's `version`, it shall derive the five snapshot maps (`bySci`, `byCom`, `byOrder`, `byCode`, `reportAs`) from the live fetch and compare them with the committed snapshot. If any map differs, it shall stop, write nothing, and print a message saying that eBird's taxonomy has moved past the shipped snapshot and that the annual-revision procedure in `.claude/rules/bird-names.md` applies. Codes shall never be generated from a newer taxonomy revision than the shipped snapshot. When the version has been advanced deliberately (the annual revision), the generator writes every asset together, as it does today.

> **FR-06** — This build shall not change the content of the existing taxonomy assets: both snapshot twins (`frontend/src/assets/ebird-taxonomy.json`, `backend/staticdata/ebird_taxonomy.json`), `ebird-countability.json` and `ebird-taxonomy-history.json` stay byte-identical (OQ-05).

> **FR-07** — A CI test shall read the committed asset and the committed snapshot and assert, in its own code and independently of the generator's checker: the asset's `version` equals the snapshot's; every species name in the snapshot has at least one code in the asset; every asset key is a published common name in the snapshot (compared without regard to case); every code satisfies FR-04(c); no key is an `Object.prototype` member name as an own key. Each invariant shall have a mutation row that alters a copy of the asset and must be rejected.

### B. Matching

> **FR-08** — Code matching shall use the same normalized query the name match already uses (surrounding whitespace removed, case ignored), computed once per keystroke, not once per row.

> **FR-09** — A row matches by code when the normalized query equals one of the row's codes in full, compared without regard to case. There is no prefix, substring or partial code match (`yr` and `yrw` do not match YRWA), and no separate length rule. A query with interior whitespace (`yr wa`) never matches a code.

> **FR-10** — A row's codes are the codes the asset records for the row's own name. If the asset has no entry for that name (for example a name from an older taxonomy revision), the row takes the codes of its normalized parent name, meaning the name with its trailing parenthetical removed, as the app's existing species-name normalizer defines it. If neither resolves, the row has no codes and matches by name only.

> **FR-11** — Name and scientific-name matching shall behave exactly as they do today: same normalization, same case-insensitive substring test over the common name and the scientific name, same treatment of a missing scientific name. This build shall not change the name half of the predicate.

> **FR-12** — A row is listed when it matches by code, by name, or both. A row that matches both ways is listed once, in the code group.

### C. Ranking

> **FR-13** — The ranking rule shall be defined once, in the shared matching layer, and used by every surface: rows that match by code first, then rows that match by name only. Within each group a surface keeps its existing order. Search uses `compareSpeciesName` (unchanged, identical on every platform). Each picker uses the order of the options it was handed.

> **FR-14** — In Search the species cap (`SPECIES_CAP`, 50) shall apply to the ranked list. Code matches are never pushed past the cap by name matches; they can be cut only when code matches alone exceed the cap. The "first N" cap line appears exactly when the ranked list was cut.

> **FR-15** — In Search, destinations shall still come first, filtered by their labels exactly as today, and are never capped. A code that is also part of a destination label (measured under the amended rule: `tail`, `tati`, `tist`, `list`, `comp`, `ompa`, `pare`) leaves the destination rows first, as today.

> **FR-16** — In a picker that has an "All species" row, that row stays first and is never filtered out. Code matches follow it directly.

> **FR-17** — Enter with no highlighted row shall pick what it picks today, read against the ranked list. In Search that is the first row: a destination if any destination matches, otherwise the first species row, which is the first code match when there is one. In a picker it is the first species row, skipping "All species", which is the first code match when there is one.

> **FR-18** — **Non-code invariant.** For any query where no listed row matches by code, every surface shall show the same rows in the same order as today, with the same cap line, the same highlight behavior and the same Enter target. This includes queries that are a code of no bird in the user's backup, queries typed before the code data has loaded, and every query after a failed load.

> **FR-19** — **One matcher everywhere.** For any query, a species name that appears both in a picker's options and in Search's index shall match in the picker exactly when it matches in Search. Pickers list different populations (the Calendar folds forms into their species, Species Detail hides forms and escapees by default), so the matched sets differ only by what each list holds. A form's own code finds that form only where the form is listed (OQ-08).

### D. Surfaces

> **FR-20** — Code matching shall reach these five surfaces, named as the app names them: **Search** (Cmd-K / Ctrl-K); the **Select species** picker on **Species Detail**; the **Calendar**'s species filter; the **Map Explorer**'s **Species** filter on My Sightings; and the **Filter by species** picker in the **Statistics** tab's Weather section. The four picker call sites (`SpeciesDetail.tsx`, `Calendar.tsx`, `MapExplorer.tsx`, `WeatherStatsSection.tsx`) shall gain no code-specific wiring. A future picker built on the shared component gets codes with no wiring.

> **FR-21** — Surfaces that do not use the shared matcher shall behave exactly as today: the Media Targets target-species box on the Map Explorer, the Checklists comment search, the Targets tab's County picker and the Named Birds tick list.

> **FR-22** — Result rows shall look exactly as they do today. There is no code badge, no "matched by code" label, no new icon, highlight, text or layout. The only visible difference is which rows appear and in what order.

### E. Loading and failure

> **FR-23** — **Never wait.** Opening Search or a picker, for the first time or any time, shall never wait for the code data. Destinations and name matches render as they do today while the code data is pending.

> **FR-24** — The code data shall start loading no later than the first time in a session that Search opens or a species picker's input receives focus. It loads at most once per session and is shared by every surface. It may start earlier only if it delays neither first paint nor any destination (OQ-07).

> **FR-25** — **Arrival while open.** When the code data arrives while Search or a picker is open with a query typed, the results shall update for that query without the user retyping or reopening. If the update changes the rows and a species row is highlighted, the highlight shall be cleared, so the highlight never moves to a different bird on its own. A highlighted destination row or "All species" row keeps its highlight. If the update leaves the rows unchanged, nothing changes, the highlight included (OQ-03).

> **FR-26** — **Failure.** If the code data fails to load, every surface shall match names exactly as today and show no new message, alert, announcement or error state. Search's four species-half sentences are unchanged and unaffected. The app shall not retry within the session (OQ-04).

> **FR-27** — Replacing or clearing the eBird backup shall reach code matching the way it already reaches name matching: an open Search or picker never matches a code against a name from a file that is gone, and the current backup's names are joined with no relaunch.

### F. Documentation and published surfaces

> **FR-28** — `docs/HELP.md`, `## Search`: the **Species** bullet shall say that typing a bird's code finds it, that both its four-letter banding code and the code formed from its name as SnowRaven shows it work (stated as a property, without promising every code eBird publishes), and that a code shared by several of the user's birds lists all of them. The sentence "Species results are listed alphabetically by common name" shall be revised to say that birds matching a typed code come first and the rest follow alphabetically by common name. The cap stays stated as a property, never as its number.

> **FR-29** — `docs/HELP.md`, the picker passages: Map Explorer `### My Sightings` ("by common or scientific name"), `## Species Detail` ("type to search by common name or scientific name"), Calendar `### Focusing on one species` ("by common or scientific name") and Statistics `### Weather` ("**One species, its weather** lets you pick a bird") shall each say that the picker also finds a bird by its code. HELP and in-app text are written without a stop for approval (CLAUDE.md, 2026-09-28).

> **FR-30** — `palettePublishedClaims.test.ts` shall be updated in the same change. Every added or revised HELP sentence gets a guard. Any code example HELP publishes (for instance `yrwa`) shall be re-derived through the shipped asset and the real matcher, and must produce the bird HELP names. The old, unqualified "listed alphabetically by common name" claim shall be unable to return. The existing legs (visible destinations, cap as a property, README and website carry no Search section) stay as they are.

> **FR-31** — This build shall not change `README.md`, `website/`, `appstore/LISTING.md`, `PRIVACY_POLICY.md` or `ACCESSIBILITY.md`. The one exception is the ship's version-stamp step, which moves only the version pill and footer in `website/index.html` (FR-33). None of these files carries a claim this feature makes false, and nothing here changes what the app sends anywhere.

### G. Rule-file upkeep (CLAUDE.md, extend a rule's `paths` in the same change)

> **FR-32** — `.claude/rules/security.md` `paths` shall cover the shared matching module (`lib/speciesMatch.ts`, not gated today) and every new `lib/` module that scans backup names or typed text. `.claude/rules/bird-names.md` `paths` shall cover the new asset, its loader and its derivation, and that file's annual-revision paragraph shall name the code asset as refreshing with the snapshot. The generator's header comment shall name it too.

### H. Release

> **FR-33** — At ship: a patch version bump across the four-file set (`frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, the `website/index.html` version pill and footer via the version-stamp step only). The App Store What's New line is drafted at ship and held for the user's explicit approval before it is written anywhere.

## Non-Functional Requirements

> **NFR-01 — Bundle:** No new file shall join `App.tsx`'s static import graph, and the code asset shall not appear in the built `index.html`'s modulepreload. `entryChunk.test.ts` gains paired assertions: the asset is absent from the entry graph, and the module that loads it reaches it through a dynamic `import()` (the guard proving the negative is not vacuous). `lib/speciesMatch.ts`, `lib/paletteRows.ts` and `components/SpeciesCombobox.tsx` stay off the entry graph.

> **NFR-02 — Size budget:** The committed asset shall be at most 200 KiB (204,800 bytes) gzipped, asserted in CI against the committed file. The brief measured about 151 KB gzip (619 KB raw) for all entries with codes. If the encoding cannot meet the budget, the build stops and returns to the user rather than raising the bound.

> **NFR-03 — Per-keystroke cost:** Each keystroke adds at most one lookup of the normalized query plus one constant-time membership test per row, inside the existing single pass over the list. No new pass over the rows, no re-parse of the asset and no re-join of names per keystroke. No `RegExp` is constructed from the query anywhere on this path; the query reaches only equality, hash lookups and `String.prototype.includes`.

> **NFR-04 — One-time cost:** Parsing the asset happens at most once per session and never on a keystroke path. Joining names to codes costs one hash lookup per distinct name and runs at most once per distinct list of names. The schema shall state the measured main-thread cost of the first load and of one join on the dev Mac, with a backup of realistic size.

> **NFR-05 — Linearity:** The join and the per-keystroke filter are linear in the number of names. The schema shall declare both new scans (over typed text and over backup names) with their linearity argument and the `security.md` glob the build adds. A doubling test shall show roughly 2x growth per doubling of distinct names, measured as work done or as CPU time through `frontend/src/test/cpuTiming.ts`, never wall-clock time.

> **NFR-06 — Network:** No third-party request, no new endpoint or host, and no request moved between components. On web and Pi the asset is a static chunk served by the user's own server alongside every other frontend chunk. On the desktop, iPhone, iPad and Android apps it is bundled. `CACHED_GET_PATHS`, the Vite proxy, the backend routes, `/taxonomy/codes`, the desktop live taxonomy fetch, the IndexedDB `CACHE_KEY`, the Tauri content security policy and the Tauri HTTP permit are all unchanged.

> **NFR-07 — Offline and keys:** Search and every picker keep working offline and need no API key, with code matching included wherever the asset has loaded.

> **NFR-08 — Hostile keys:** Every lookup keyed by a backup name or a typed query shall use a `Map` or `Object.hasOwn` at the point of use, never a bare `obj[key]` on an ordinary object. Any accumulator keyed by such strings is a `Map` or `Object.create(null)`. This holds on both the name side and the query side.

> **NFR-09 — Trust boundary:** The asset is bundled build-time data. It is defended at build time (FR-04, FR-05) and at CI time (FR-07, NFR-02). No per-entry runtime validation is owed (CLAUDE.md, bundled-asset rule). The loader may make one structural check so that FR-26 has a failure signal.

> **NFR-10 — Memory and teardown:** Joined codes live in memory only and die with the parse they were derived from, following `lib/speciesIndex.ts`'s `WeakRef` pattern. There is no persisted document, no `storage` write and no `clearDerived.ts` row (the v1.0.20 boundary in CLAUDE.md). `cacheInventory.test.ts` is unchanged and green.

> **NFR-11 — Determinism:** Result order shall be identical on every platform (macOS, Windows, iOS, iPadOS, Android, web, Pi). No `localeCompare` is introduced, and the existing comparators are reused unchanged.

> **NFR-12 — Accessibility:** No new control, row, label, live region or announcement. WCAG 2.1 AA holds at 320 px and at 200% in-app text scale, because nothing visual changes. Option ids stay keyed on index. Existing accessibility tests stay green unedited.

> **NFR-13 — Bird names:** Name rendering is unchanged. Search and picker rows keep their plain-text names under the standing form-control exclusion (`.claude/rules/bird-names.md`, command-palette FR-27): `<BirdName>` composes links and a button, which cannot sit inside `role="option"`. Every other surface keeps `<BirdName>`. This feature adds no name rendering of its own.

> **NFR-14 — Compatibility:** The build uses no runtime API beyond those already cleared for the shipped targets (`Map`, `WeakRef`, `Object.hasOwn`, dynamic `import()`). Any other ES2022-or-later runtime API needs the explicit availability check `security.md` requires.

> **NFR-15 — Regression safety:** The existing rows of `speciesMatch.test.ts`, `SpeciesCombobox.test.tsx`, `paletteRows.test.ts`, `speciesIndex.test.ts`, `CommandPalette.test.tsx`, `MapExplorerSpeciesFilter.test.tsx` and `WeatherStatsSection.test.tsx` pass with their existing assertions unmodified. New rows are added; old rows are not edited to fit.

> **NFR-16 — Published prose:** HELP changes contain no em dashes (U+2014), use American spelling, state properties rather than counts, and name surfaces from `TAB_LABELS` (Species Detail, Calendar, Map Explorer, Statistics), never from component names.

## Out of Scope

- eBird's `sciNameCodes` and the six-letter scientific codes. Typing part of a scientific name already works.
- Partial, prefix or substring code matching (`yr` does not find YRWA).
- Folding accented codes to plain letters, or any other edit to eBird's codes (adding, re-ranking, rewriting). `rubu` works because eBird publishes RUBU itself and it is formed from the shown name with its accents removed. Removing codes is in scope only as FR-01's filter.
- Codes eBird lists from a bird's other names (British, international or former names: `goos`, `cost`, `rodo`, `liau`, `gndi`, `mywa` on the species, `gbhe` on Green Heron). Amended 2026-10-10.
- Forming codes from a slash's or hybrid's component names. A composite keeps only its own banding codes and the codes formed from its whole displayed name (decisions.md 6 records the reversal and its cost).
- Any visible change to result rows: no code badge, no "matched by code" label, no code shown beside a name.
- Species outside the user's backup. Search and the pickers list only birds the user has recorded.
- Surfaces that do not use the shared matcher: the Map Explorer's Media Targets target-species box (`filteredManualSpecies`), the Checklists comment search, the Targets County picker, the Named Birds tick list. The target-species box is a possible follow-on for the roadmap.
- The backend, `/taxonomy/codes`, the desktop live taxonomy fetch, the IndexedDB `CACHE_KEY` and the backend snapshot twin.
- The annual taxonomy revision. If eBird's live taxonomy moves past the snapshot before the code asset is generated, this build stops (OQ-06); it does not take on the revision.
- Giving a folded or hidden-forms list its forms' codes (OQ-08).
- `README.md`, `website/`, `appstore/LISTING.md`, `PRIVACY_POLICY.md` and `ACCESSIBILITY.md`. The What's New line is drafted at ship and held for approval (FR-33).
- New App Store screenshots. Rows look identical, so no screenshot can be stale.

## Open Questions

**OQ-01. Accented codes (conflicts with the brief's Key Decisions 3 and 9).** The brief says every code is A to Z and asks for a guard of `^[A-Z]{2,4}$`. Today's data contains 23 codes with `Ü` or `Ö` (19 entries, 15 species), so that guard stops the generator. Every one of those 15 species also carries an unaccented twin.
*Default:* keep codes as published (Key Decision 1), admit exactly `Ö` and `Ü` alongside `A` to `Z` in NFC, and fail closed on any other character (FR-04(c)). `rübu` and `rubu` both find Rüppell's Bustard; nothing is folded.
*Amended 2026-10-10:* under the American-name rule 13 kept codes contain `Ö` or `Ü`. The accent-free twin is kept beside each where eBird publishes it, as a variant of the shown name (decisions.md 4, an orchestrator default), so `rubu` still finds Rüppell's Bustard.

**OQ-02. Code matches leading at four-letter name prefixes (widens the brief's accepted consequence 4(a)).** Typing a name passes through its first four letters, and 463 of 2,175 such prefixes in species names are codes. For a North American birder holding the code bird: `goos` puts Common Merganser ahead of every goose, `cost` puts European Starling ahead of Costa's Hummingbird, `snow` puts Snowy Owl first, and `sand`, `will`, `colo`, `buff` and `dove` behave similarly. The fifth letter restores today's order, but Enter pressed at four letters opens the code bird.
*Default:* accept, per the brief's one-rule decision (Key Decision 4). The Designer may propose a mitigation that adds no visible row change; any such proposal comes back to the user.
**Resolved 2026-10-10 by the user at the Designer stage: rule A stands** (exact code matches first, then name matches in each surface's usual order; no mitigation). Under the amended code rule `goos` and `cost` above are no longer codes; `snow`, `sand`, `will`, `colo`, `buff` and `dove` still lead with their code bird (decisions.md 1).

**OQ-03. The highlight when code data arrives mid-session.**
*Default:* FR-25. Rows update for the current query; a highlighted species row is cleared only if the rows actually change; nothing changes for a query that is not a code.

**OQ-04. Retrying after a failed load.**
*Default:* no retry within the session, matching `loadTaxonomyHistory`. A bundled asset that fails to load is a build defect, not a user condition, and name matching continues unaffected.

**OQ-05. Whether this build re-stamps the snapshot's `generated` field.** Running the generator today would change only that stamp in both snapshot twins, rewriting two 1.7 MB single-line files for no content change.
*Default:* leave every existing asset byte-identical (FR-06). The Architect may write only the code asset when FR-05 finds no drift.

**OQ-06. eBird's annual update landing before generation.** It usually lands in late October, and the asset has not been generated yet.
*Default:* FR-05 stops the run, and the build returns to the user. The annual revision is not folded into this build.

**OQ-07. When loading starts.**
*Default:* the first opening of Search, or the first focus on a species picker, in a session (FR-24). An earlier idle start is allowed only with its measured cost stated in the schema and no effect on first paint.

**OQ-08. Lists that fold or hide forms.** The Calendar lists species only, and Species Detail hides forms unless Show subspecies is on. There, `auwa` finds nothing, because no listed row carries AUWA, while `yrwa` and `mywa` find Yellow-rumped Warbler. That is the brief's rule (a row matches its own entry's codes). *Amended 2026-10-10:* under the American-name rule MYWA is the Myrtle form's code only, so on those lists `mywa` finds nothing too, and `yrwa` finds Yellow-rumped Warbler.
*Default:* accept. Folding a form's codes into its species row on those lists is out of scope.

## Success Metrics

Every row is meant to be verified by an automated test unless it says otherwise. "Fixture backup" means a synthetic species list handed to the real ranking and matching code. "Real asset" means the committed code asset.

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | `yrwa` in Search (FR-09, FR-13, FR-17) | With the fixture backup [Yellow-rumped Warbler, Yellow-rumped Warbler (Myrtle), Yellow-rumped Warbler (Audubon's), Northern Yellow Warbler, Cape May Warbler] and the real asset, the species rows are exactly Yellow-rumped Warbler, then (Audubon's), then (Myrtle). Yellow-rumped Warbler is the first species row. Enter with nothing highlighted calls the open-species handler with `Yellow-rumped Warbler`, which opens Species Detail. |
| QA-02 | Case and surrounding whitespace (FR-08) | `YRWA`, `Yrwa`, `yRwA`, ` yrwa`, `yrwa `, `\tyrwa\n` and ` yrwa　` each give rows identical to QA-01's. |
| QA-03 | Interior whitespace and partial codes do not match (FR-09) | `yr wa`, `yr`, `yrw`, `yrwar` and `rwa` produce no code-group rows. Each gives exactly the rows today's name-only predicate gives on the same fixture. |
| QA-04 | `cago` collision (FR-12, US-02) | Fixture [Canada Goose, Cackling Goose, Cackling/Canada Goose, Snow Goose]: species rows are Cackling Goose, then Canada Goose. Cackling/Canada Goose (whose only code is its banding code CCGO) and Snow Goose are absent. *(Amended 2026-10-10.)* |
| QA-05 | `nosh` collision | Fixture [Northern Shoveler, Northern Shrike, Northern Pintail]: rows are Northern Shoveler, then Northern Shrike. Northern Pintail is absent. |
| QA-06 | `trsw` collision | Fixture [Tree Swallow, Trumpeter Swan, Tundra Swan]: rows are Tree Swallow, then Trumpeter Swan. |
| QA-07 | `gbhe` collision | Fixture [Great Blue Heron, Green Heron, Great Egret]: rows are Great Blue Heron only. Green Heron (whose GBHE came from its former name, Green-backed Heron) and Great Egret are absent. *(Amended 2026-10-10.)* |
| QA-08 | Banding codes (US-03) | With one-bird fixtures, `amro` gives American Robin, `anhu` gives Anna's Hummingbird and `mall` gives Mallard as the first species row. |
| QA-09 | Name-formed codes, their variants, and dropped other-name codes (US-03, FR-01) | `cago` includes Canada Goose (QA-04; CAGO is formed from its name, its banding code is CANG). With one-bird fixtures, `rodo` (Rock Pigeon), `goos` (Common Merganser), `cost` (European Starling), `liau` (Dovekie) and `gndi` (Common Loon) each give no code-group row and exactly today's rows. On [Yellow-rumped Warbler, Yellow-rumped Warbler (Myrtle), Yellow-rumped Warbler (Audubon's), Cape May x Yellow-rumped Warbler (hybrid)], `mywa` gives (Myrtle) only. `cowp`, `cowo` and `cwpi` each give Common Wood-Pigeon (hyphen variants); `rubu` and `rübu` each give Rüppell's Bustard (accent variant). *(Amended 2026-10-10.)* |
| QA-10 | A form's own code (FR-10, US-04) | Fixture with the species, (Audubon's), (Myrtle) and (West Mexico): `auwa` gives (Audubon's) only. The species row, (Myrtle) and (West Mexico) are absent (West Mexico's AUWA came from its group's name, not its own). *(Amended 2026-10-10.)* |
| QA-11 | The parent's code finds forms (US-04) | Same fixture: `yrwa` lists the species and all three forms in the code group. |
| QA-12 | Name fallback (FR-10) | A fixture name the asset does not publish, `Yellow-rumped Warbler (Old Form)`, matches `yrwa` through its parent. `Unknown Bird (Form)`, which resolves neither way, matches only by name. |
| QA-13 | A hybrid carries no parent code (amended rule; accepted consequence 4(b) no longer arises) | Fixture [Yellow-rumped Warbler, Cape May x Yellow-rumped Warbler (hybrid)]: `yrwa` gives Yellow-rumped Warbler only. The hybrid carries no code (its eBird codes come from its parents' names, not its own) and its name does not contain `yrwa`. `cape may` still lists the hybrid by name, exactly as today. *(Amended 2026-10-10.)* |
| QA-14 | Code group, then name group, no duplicates (FR-12, FR-13) | Fixture [Small Minivet, Malleefowl, Mallard]: `mall` gives Mallard, then Malleefowl (the code group, alphabetical), then Small Minivet (name only). Mallard appears once. Today's order for the same fixture is Mallard, Malleefowl, Small Minivet, so the test also checks a fixture where the name group would sort first: [Allmall Bird (synthetic, no codes), Mallard] gives Mallard, then Allmall Bird. |
| QA-15 | Word codes (accepted consequence 4(a)) | Fixture [Wrentit, Winter Wren, Rock Wren]: `wren` gives Wrentit first, then Rock Wren and Winter Wren in alphabetical order. |
| QA-16 | Name-prefix codes (OQ-02 resolved: rule A) | Fixture [Snowy Owl, Snow Goose, Snow Bunting]: `snow` gives Snowy Owl first, then Snow Bunting and Snow Goose. `snowy` gives exactly today's rows (Snowy Owl). On [Common Merganser, Snow Goose, Canada Goose], `goos` is no longer a code and gives exactly today's rows (Canada Goose, Snow Goose). *(Amended 2026-10-10.)* |
| QA-17 | Non-code queries unchanged: named examples (FR-18) | For `teal`, `duck`, `gull`, `hawk`, `tern`, `rail`, `loon`, `owl`, `jay`, `calypte`, `warbler`, `a` and the empty and whitespace-only queries, on a fixture of at least 200 real names, Search's rows, `speciesTruncated` and Enter target, and each picker's rows, equal today's (computed by the pre-change predicate and comparator) exactly. |
| QA-18 | Non-code invariant over a generated corpus (FR-18) | For every query in a generated corpus (every string of length 1 to 3 over `a` to `z` plus space, about 20,000; every code in the real asset, lowercased; and every single-position edit of 20 real names over a wide alphabet that includes U+00A0, U+3000 and `Ü`), on a fixed fixture of at least 200 real names: whenever no fixture row carries the normalized query as a code, the output with the real asset loaded is structurally equal to the output with no code data. The test asserts how many corpus queries were codes and how many were not, so it cannot pass vacuously. |
| QA-19 | A code of no bird in the backup (FR-18) | `amro` on a fixture with no American Robin gives exactly today's rows. (`isth` is no longer a code of any entry under the amended rule.) *(Amended 2026-10-10.)* |
| QA-20 | Cap after ranking (FR-14) | Fixture: 60 synthetic names beginning `Snow ` (all sorting before `Snowy Owl`), plus Snowy Owl. `snow` gives Snowy Owl as the first species row, 50 species rows in total, and `speciesTruncated` true. The same fixture without Snowy Owl gives today's first 50 rows. (`goos` is no longer a code.) *(Amended 2026-10-10.)* |
| QA-21 | Cap cuts code matches only when they alone exceed it (FR-14) | With `cap: 2`, a fixture of 3 `cago` carriers (for example Cackling Goose, Cackling Goose (Aleutian) and Canada Goose; the Cackling/Canada Goose slash no longer carries CAGO) and 5 name matches gives the first 2 code matches only, with `speciesTruncated` true. |
| QA-22 | Destinations still lead (FR-15) | With the default visible tabs, `list` lists Checklists and List Comparer as destination rows first, in the saved order, and Little Stint (if in the fixture) after them. Enter opens the first of the two destinations. `weat` opens Weather on Enter. |
| QA-23 | Picker: "All species" stays first (FR-16) | In `SpeciesCombobox` with `allLabel` and options [American Robin, Northern Yellow Warbler, Yellow-rumped Warbler], typing `yrwa` renders rows "All species", then Yellow-rumped Warbler. Northern Yellow Warbler is absent. |
| QA-24 | Picker: upstream order inside groups (FR-13) | Options handed in a deliberately non-alphabetical (taxonomic) order: the code group and the name group each keep that order. |
| QA-25 | Picker Enter (FR-17) | In each of the four mounted surfaces (Species Detail, Calendar, Map Explorer My Sightings, Statistics Weather), typing `cago` and pressing Enter with nothing highlighted selects the first code match, never "All species". With `xyzq`, Enter selects nothing and does not reset to "All species". |
| QA-26 | One matcher everywhere (FR-19) | For every query in QA-01 to QA-19's rosters, the set of species a picker lists equals the set Search lists, filtered to the picker's options, with the cap not reached. |
| QA-27 | Calendar folds forms (OQ-08 default) | In the Calendar picker, with forms folded into Yellow-rumped Warbler, `yrwa` lists Yellow-rumped Warbler, and `mywa` and `auwa` list no species row (both are form codes under the amended rule). *(Amended 2026-10-10.)* |
| QA-28 | Call sites wire nothing (FR-20) | A source scan finds that `SpeciesDetail.tsx`, `Calendar.tsx`, `MapExplorer.tsx` and `WeatherStatsSection.tsx` import neither the code asset nor its loader, and that their diff in this build contains no code-specific change. |
| QA-29 | Out-of-scope surfaces unchanged (FR-21) | The Media Targets target-species box, the Checklists comment search, the Targets County picker and the Named Birds tick list do not import the code module (source scan), and their existing tests pass unmodified. |
| QA-30 | No visible row change (FR-22) | Under jsdom, an option row rendered for a code match has the same element structure, attributes, classes and text pattern as one rendered for a name match. A source scan finds no new user-facing string in `SpeciesCombobox.tsx`, `CommandPalette.tsx`, `paletteCopy.ts` or the call sites. |
| QA-31 | Never wait: pending (FR-23) | With the code loader stubbed to a promise that never settles, Search's first render shows every destination; `calypte` lists Anna's Hummingbird; `yrwa` shows today's "Nothing matches that search." A picker behaves the same. Nothing renders a loading state for codes. |
| QA-32 | Loading starts on first use, once (FR-24) | The loader is called no later than Search's first open or a picker's first focus. Across 5 opens, 3 pickers and 50 keystrokes it is called exactly once. It is not called at app start, unless OQ-07 is resolved otherwise. |
| QA-33 | Arrival while open (FR-25) | With `yrwa` typed and the loader resolving afterwards, the rows update to QA-01's without retyping. If a species row was highlighted and the rows changed, nothing is highlighted afterwards and Enter opens Yellow-rumped Warbler. With `calypte` typed, arrival changes no row and the highlight index stays where it was. A highlighted destination stays highlighted. |
| QA-34 | Failure (FR-26) | With the loader rejecting, and separately resolving a value that fails the loader's shape check: every surface's output equals today's for every query in QA-17's roster; no new text, alert or `role="status"` / `role="alert"` content appears; Search's four species-half sentences render as today; the loader is not called again in that session. |
| QA-35 | Backup replaced or cleared (FR-27) | After a files-epoch change that swaps the parse to a backup without Yellow-rumped Warbler, `yrwa` in an open Search lists no Yellow-rumped Warbler, and a backup that adds Northern Shoveler makes `nosh` find it with no relaunch. |
| QA-36 | Hostile backup names (NFR-08) | A fixture whose names include `__proto__`, `constructor`, `toString`, `valueOf` and `hasOwnProperty` renders Search and each picker under jsdom without throwing. Those rows get no codes, match by name only, and `yrwa` still finds Yellow-rumped Warbler alongside them. |
| QA-37 | Hostile queries (NFR-08) | The queries `__proto__`, `constructor`, `toString`, `valueOf` and `hasOwnProperty` produce no code-group rows and exactly today's name-only rows on a fixture that contains and one that lacks those names. |
| QA-38 | Generator guards fail closed (FR-04) | Unit tests over the derivation and guard, with fixtures and no network, show it refuses, writing nothing, for each of: a short entry count; a species with empty `bandingCodes` and `comNameCodes`; each of the codes `RÄBU`, `AB1`, `A`, `ABCDE`, `abcd`, `RÜBU` (non-NFC); two names equal ignoring case; a name equal to `constructor`; a version mismatch. It accepts `RÜBU`, `BÖSP`, `OU`, `EMU` and a fixture that mirrors real data. It pins the American-name filter: every row of schema.md 5.2's table of names and formed codes; banding codes always kept; other-name codes dropped (Common Merganser GOOS, Green Heron GBHE, Rüppell's Bustard RUKO and RÜKO); and it refuses a species left with no code after filtering (FR-04(b)) and a filter that disagrees with its own definition (FR-04(g)). *(Amended 2026-10-10.)* |
| QA-39 | Revision check (FR-05) | With an injected live taxonomy whose derived `byCom` differs by one entry from the committed snapshot, under an unchanged version: the generator stops with the annual-revision message and writes nothing. Equal maps let it proceed. An advanced version lets it proceed and write every asset. |
| QA-40 | Existing assets unchanged (FR-06) | `git diff --stat main` lists neither snapshot twin, `ebird-countability.json` nor `ebird-taxonomy-history.json`. |
| QA-41 | Asset CI guard (FR-07) | The CI test passes on the committed asset. Each mutation row fails it: a changed `version`; one species' codes removed; a key that is not a published name; a code `R1BU`; an own `__proto__` key added through `JSON.parse`. |
| QA-42 | Real-data spot checks (FR-01) | In the committed asset, Yellow-rumped Warbler's codes are exactly [YRWA]; MYWA is on (Myrtle); AUWA is on (Audubon's) and on neither the species nor (West Mexico), whose codes are exactly [YRWA]; CAGO is on both Canada Goose and Cackling Goose and not on Cackling/Canada Goose, whose codes are exactly [CCGO]; Cape May x Yellow-rumped Warbler (hybrid) has no code; Green Heron's codes are exactly [GRHE]; RUBU and RÜBU are both on Rüppell's Bustard and RUKO and RÜKO are not; Common Wood-Pigeon carries CWPI, COWP and COWO; Common Ostrich's codes are exactly [COOS] (its `sciNameCodes` value STCA is absent); GOOS, COST, RODO, LIAU, GNDI and ISTH are on no entry. *(Amended 2026-10-10.)* |
| QA-43 | Entry graph (NFR-01) | `entryChunk.test.ts`: the asset and every new module are absent from `App.tsx`'s static graph. The matcher's subtree reaches the asset only through `import()`, asserted as a positive (guard the guard). When a production build exists, the asset chunk is not in `dist/index.html`'s modulepreload. |
| QA-44 | Size budget (NFR-02) | `gzipSync` of the committed asset is at most 204,800 bytes. The bound is read from one constant, not spelled twice. |
| QA-45 | Per-keystroke cost (NFR-03) | Over 50 keystrokes against one index, the asset is parsed once and the join runs once (counted). A source scan of the matcher module and every new module finds no `RegExp` constructor and no regex literal applied to the query. |
| QA-46 | Linearity (NFR-05) | The join plus one filter pass, at 1k, 2k, 4k and 8k distinct names, grows at most about 2.2x per doubling, measured as work done or CPU time via `cpuTiming.ts`, with an explicit `testTimeout`. |
| QA-47 | Network posture (NFR-06) | No new or changed module imports `transport`, `storage`, `fetch` or a Tauri HTTP call. `CACHED_GET_PATHS`, `frontend/vite.config.ts`'s proxy, `backend/routers/`, `taxonomyService.ts`'s `CACHE_KEY`, `src-tauri/tauri.conf.json`'s CSP and `src-tauri/capabilities/default.json` are unchanged (diff check). `tauriCsp.test.ts` and `tauriHttpScope.test.ts` pass unmodified. |
| QA-48 | Memory and teardown (NFR-10) | No new `storage.setSetting` or document path; `clearDerived.ts` and `cacheInventory.test.ts` are unchanged and green. The joined codes are released with the parse (WeakRef or identity memo test mirroring `speciesIndex.test.ts`). |
| QA-49 | Determinism (NFR-11) | A source scan finds no `localeCompare` in any new or changed matching or ranking code. QA-01 to QA-16 pass identically in the Node and jsdom environments. |
| QA-50 | Accessibility and names (NFR-12, NFR-13) | The existing accessibility and tab-order tests (`tabOrderCoverage.test.ts`, `SpeciesCombobox.test.tsx`, `CommandPalette.test.tsx`) pass unmodified. Option ids stay index-keyed: with a code query, every `aria-activedescendant` value resolves to an element. `entryChunk.test.ts`'s "palette adds no BirdName edge" leg stays green. |
| QA-51 | Regression safety (NFR-15) | `git diff main` shows no modified or removed existing assertion in the seven suites NFR-15 names; only additions. The full frontend suite, `npm run typecheck`, `npm run build` and the backend suite pass. |
| QA-52 | HELP Search section (FR-28, FR-30) | `palettePublishedClaims.test.ts` asserts that HELP's `## Search` passage states code matching, both code kinds and collisions, and code-first ordering. It asserts that no sentence claims species are listed alphabetically without the code-first qualifier (guard the guard: the sentence HELP carries today trips it), and that `SPECIES_CAP`'s value still does not appear. |
| QA-53 | HELP picker passages (FR-29) | A published-claims test asserts that each of the four named passages mentions finding a bird by its code. Each passage is extracted by its heading, not by scanning the whole file. |
| QA-54 | Published example re-derived (FR-30) | Every backticked code HELP publishes as an example is run through the real asset and matcher on a one-bird fixture holding the bird HELP names, and must return that bird first. |
| QA-55 | Published surfaces untouched (FR-31) | Before the version-stamp step, `git diff --stat main` lists nothing under `website/` and does not list `README.md`, `appstore/LISTING.md`, `PRIVACY_POLICY.md` or `ACCESSIBILITY.md`. After it, the only `website/` change is the version pill (text and `aria-label`) and the footer version line. The existing negative legs (no Search section on README or website) stay green. |
| QA-56 | Prose rules (NFR-16) | The HELP diff contains no U+2014 and no British spellings, and names surfaces only from `TAB_LABELS` (checked by the existing docs guards plus a scan of the diff). |
| QA-57 | Rule-file upkeep (FR-32) | `.claude/rules/security.md` frontmatter `paths` matches `frontend/src/lib/speciesMatch.ts` and each new `lib/` module that scans names or queries. `.claude/rules/bird-names.md` `paths` matches the asset, its loader and its derivation, and its annual-revision paragraph names the code asset. Checked by globbing each path against the frontmatter. |
| QA-58 | Release (FR-33) | At ship, `icloudKeysPublishedClaims.test.ts`'s four-file version parity leg is green and CHANGELOG carries the entry. The What's New text is shown to the user and approved before it is written to App Store Connect (checked by the deploy stage record). |
