# Change Brief — Report-As Countability

## What is changing

Countability stops being decided by string shape and starts being decided by eBird's own `reportAs` field, which is already in the bundled taxonomy snapshot (`frontend/src/assets/ebird-taxonomy.json`, 4,120 `reportAs` entries, 11,167 species codes, 17,891 all-category names). A name counts toward a life list when its code is itself a species or resolves through `reportAs` to one. That is exactly eBird's distinction: ambiguity about *which species* does not count, ambiguity about *which subspecies* counts as the parent. The three predicates in `lib/speciesUtils.ts` (`isSpuhOrSlash`, `isNonCountableSpecies`, `isNonCountableObservedName`) collapse to one rule with one input, and the raw-versus-normalized asymmetry v0.5.83 documented at length becomes unnecessary rather than being "tidied away" — the reason it existed (a parenthetical ` x ` means something different from a base-name ` x `) is answered by eBird's own data instead of by string inspection. Four existing control labels are re-chosen because the set they govern moves.

## Why now

Two saved ideas asked whether an eBird standard exists for two open countability questions (`ROADMAP.md` lines 175 and 176, both recorded as deliberate deferrals). It does, and it is already shipped offline in the snapshot the app loads for favicons and taxonomic sort. The prompting inconsistency is real and recorded: Statistics and Calendar exclude `Canada Goose (moffitti/maxima)` while county Completeness keeps it, so two numbers in the same app disagree about the same bird.

## Scope — the measured delta

Swept over all 17,891 bundled names (script kept in the run scratchpad), comparing today's `isNonCountableObservedName` against eBird's rule. The delta is **two-way**, which the saved ideas did not anticipate:

- **A. eBird counts, SnowRaven excludes: 88 names → 59 parent species.** Subspecies-group slashes inside a trailing parenthetical: `Canada Goose (moffitti/maxima)`, `Dark-eyed Junco (Slate-colored/cismontanus)`, `Redpoll (Common/Hoary)`, `Iceland Gull (thayeri/kumlieni)`, `Red-tailed Hawk (calurus/abieticola)`, `Song Sparrow (melodia/atlantica)`. Common for a North American birder. This is exactly the 88 that `ROADMAP.md` line 176 and the `isNonCountableObservedName` doc comment both predict.
- **B. SnowRaven counts, eBird does not: 81 names.** Not previously recorded anywhere. Three named hybrids carrying no ` x ` (`Brewster's Warbler (hybrid)`, `Lawrence's Warbler (hybrid)`, `Bogota Sunangel (hybrid)`), 25 spuhs that do not end in ` sp.` because a parenthetical follows it (`storm-petrel sp. (dark-rumped)`, `cuckoo sp. (Cuculidae sp.)`, `Domestic goose sp. (Domestic type)`), and 53 `(undescribed form)` / `(unrecognized species)` entries.

Direction B is the finding that changes this build's character: today's rule is not merely conservative, it is wrong in both directions, and a birder with Brewster's Warbler has it counting as a species right now.

## Scope — surfaces, confirmed against the code

The `CLAUDE.md` v0.5.87 scope rule (headline counts move, species *lists* do not) was checked call site by call site and holds, with three corrections worth carrying:

- **Headline counts that move:** Statistics species tile (`birdingStats.filterObservations`), Statistics documentation coverage count *and* percentage (`mediaStats.ts:413`), Statistics Frivolous Lists completion figures (`frivolousLists.ts:149`), Calendar day-cell counts and the heat tiers derived from them (`calendar.ts:207`), Map Explorer county Completeness numerator (`countyCompleteness.ts:206`) and county Species aggregates (`MapExplorer.tsx:855`, hardcoded `includeSpuh: false`), Multimedia `"X of N species"` (`LifeList.tsx:364` and `:398`), Breeding Codes `"N species"` (`parseBreedingCodes.ts:128`), Species Detail `"{n} species"` counter (`SpeciesDetail.tsx:215`).
- **Correction 1:** `parseLifeList.ts:74` is a **dead call site** — `parseLifeList()` has zero app callers. Do not spend design or test effort on it; decide separately whether it is deleted.
- **Correction 2:** `parseBreedingCodes.ts:178` is dormant (the live path is `deriveBreedingRows` at `:128`); `parseEbird.ts:56` feeds the List Comparer and Checklists comparer backbone, a *list* surface, so it changes membership rather than a headline.
- **Correction 3:** on the same Statistics tab, the `Count spuh, slash & hybrids` control moves the species tile but **not** documentation coverage or Frivolous Lists, which apply the rule to their own inputs. That asymmetry is pre-existing and deliberate; unifying the predicate makes it more visible, and whether it should persist is a design question rather than an engineering one.

## Scope — the fallback, and the offline and cost questions

**Unresolvable name falls back to today's string rule, not to "counts".** A user's export can carry a name from an older revision or a since-renamed species. Defaulting an unknown name to countable is the v0.5.87 precedent for *escapees*, where the alternative erases a bird; here it is unsafe in a way that precedent does not cover, because a not-yet-loaded lookup would make all 2,604 non-countable forms count at once and flash a badly wrong headline. Falling back to the current rule means the change is a bounded, fully enumerated delta over the 17,891 names the snapshot knows, and anything else behaves exactly as it does today.

**Offline is clean and the predicate can stay synchronous.** The name-to-code inversion is lossless (17,891 names, zero collisions, zero case-only collisions), so the rule can be precomputed to a 2,604-entry name set and the predicate keeps its current `(name: string) => boolean` signature — no call-site signature changes, no async parsers, no worker involvement (the one worker parses observations and touches none of these predicates). Two viable sources, and picking between them is The Engineer's call: derive the set at load from the existing snapshot (which today has exactly one importer, a dynamic `import()` inside `lib/tauri/taxonomyService.ts`, so it must not become a static edge — `entryChunk.test.ts` and `exoticProvenanceGraph.test.ts` both bear on this), or emit a companion artifact from `scripts/build-ebird-taxonomy.mjs` (**80.0 KB raw / 20.7 KB gzipped**), which keeps the predicate synchronous with no load-order or flicker question at all. **Cost is a saving, not a tax:** measured over 240,000 calls on realistic names, the set lookup runs 2.89–7.43 ms against 14.05–16.91 ms for today's string rule.

## Design pass

**Needed.** Four shipped control labels stop being accurate because the set they name moves: `Count spuh, slash & hybrids` on Statistics (a checkbox, with the v0.5.87 `Count escapees` toggle stacked beneath it) and on Calendar (a switch), and `Show sp./slash` on Multimedia and on Species Detail (both `ToggleSwitch`, neither with helper text). Under the new rule the excluded set is "forms eBird does not count toward a species list" — which newly includes named hybrids and parenthetical spuhs and newly excludes subspecies-group slashes — so the old wording describes a set that no longer exists. Naming that set well is the heart of the user's stated intent (conform to eBird where there is a standard, give control where there is not), and `CLAUDE.md` treats a control label whose scope has moved as inaccurate rather than merely stale. The Designer also owns two felt-behavior calls: whether the Multimedia and Species Detail toggles widen to govern the whole non-countable set (making the visible rows and the `"X of N species"` count agree by construction, which is the resolution `ROADMAP.md` line 175 asks for), and whether the Statistics same-tab asymmetry above stays as it is. No new control, no new surface, no layout change.

## Feature check

Stays in the Improve lane. No new capability, screen, flow, schema, or persisted setting; the toggles already exist and keep their positions, and the snapshot is already bundled and already loaded. The boundary is drawn at the control count: relabelling an existing toggle and widening what it governs is refinement, and **adding any new control — a separate hybrids switch, a three-way selector, a per-surface override — is New Feature work and is out of scope.** Splitting that out if it comes up during the design pass is the correct answer, not a setback.

## Decisions touched

- **v0.5.83** (`DECISIONS.md` line 273, "Hybrid life-list count: the raw-vs-normalized predicate asymmetry") — this supersedes its mechanism while honouring its finding. The 36 intergrades it protected stay countable under `reportAs`; the asymmetry it introduced is retired because eBird's data answers the question the asymmetry was inferring. The entry's own warning that collapsing the two predicates is a silent data-loss bug must be discharged explicitly by the sweep above, not waved through.
- **v0.5.86** (line 53, "Export parsers classify the RAW observation before their deliberately distinct output normalization") — the five converged call sites are re-pointed at the new rule. `truncateAtFirstParen` is untouched and stays distinct from `normalizeSpeciesName`.
- **v0.5.87** (line 27, escapee provenance) — composes rather than conflicts: escapees exclude by provenance, this excludes by form, and both remain exclusions layered on the same totals. `ProvenanceSnapshot.excludedNames` and the Calendar's passive-reader guarantee are untouched. `ROADMAP.md` line 173 (Geographic Stats per-county counts, a stated v0.5.87 omission) is **not** pulled in here.
- **v0.5.54** (County Completeness) — the Completeness numerator moves; the eBird regional denominator and its "numerator only" caption do not.

## The 37-versus-36 loose end — resolved

Both numbers are right and they count different things. **37** is the number of bundled names containing ` x ` that eBird counts. **36** is the number v0.5.86's parser convergence actually rescued into 26 parent species. The one name in the gap is `Common Tern (hirundo/tibetana x longipennis)`: it carries a `/` inside its parenthetical, so the raw-name slash half of `isNonCountableObservedName` still excludes it, and v0.5.86 relaxed only the ` x ` half. It was therefore never among the 36, and it is excluded today. It sits inside direction A above (under `Common Tern`, alongside `Common Tern (hirundo/tibetana)`), so this build is what finally admits it. Nothing in the record needs correcting.

## What done looks like

A birder's headline species total matches what eBird shows them for the same data, in the direction eBird chooses, and the same number appears on Statistics, Calendar, county Completeness, and the Multimedia count instead of three rules disagreeing. The sweep is re-derived at build time and both directions are asserted: 88 names admitted into 59 parents, 81 names excluded, and a named test proving an unresolvable name falls back to today's rule rather than counting. Reverting the predicate turns a test red on every surface listed above, per the repo's discriminating-case rule.
