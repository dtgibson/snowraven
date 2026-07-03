# QA Report — Media Catalog Taxon Links (subspecies/form fix)

**Date:** 2026-07-03
**Lane:** Fix (Stage 3)
**Version:** 0.5.57
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

---

## Test Suite Results

| Suite | Command | Result |
|---|---|---|
| Frontend (vitest) | `npx vitest run` | **1282 passed, 0 failed** (107 test files) |
| Backend (pytest) | `.venv/bin/python -m pytest tests/ -v` | **178 passed, 0 failed** |
| Lint (eslint) | `npm run lint` | Clean — 0 errors |
| Production build | `npm run build` (`tsc -b && vite build`) | Succeeded (`✓ built`) — type-check + bundle both pass |
| Entry-chunk guard | `npx vitest run src/lib/entryChunk.test.ts` | **7 passed, 0 failed** |

Counts match the expected targets (~1282 frontend, ~178 backend) exactly. No failures were
summarized away — every file was green.

**Entry-chunk contract re-verified (CLAUDE.md standing check):** the built `dist/index.html`
has **no** modulepreload entry for maplibre, counties, or the taxonomy snapshot. `maplibre`
(1.03 MB), `ebird-taxonomy` (1.74 MB), and `us-counties` (3.79 MB) are all separate on-demand
chunks. The lone `vendor-maplibre` string in the entry chunk is a **lazy-import dependency
array** feeding the preload helper (verified: there is NO bare/static `import"...maplibre"` in
the entry chunk), which is exactly the permitted pattern. The automated guard passed.

---

## Reproduction / Done-Criteria Verification

Each repro case from the bug brief and each "What done looks like" criterion, mapped to
Pass/Fail with evidence. Evidence is drawn from (a) the passing test suites, (b) reading the
builder code (cited file:line), and (c) a throwaway resolution check run against the **real
bundled taxonomy** (`frontend/src/assets/ebird-taxonomy.json`, 17,891 `byCode` entries) — not
just the fixtures.

| # | Repro case / done-criterion | Result | Evidence |
|---|---|---|---|
| R1 | Species Detail (OFF) — flagship Scaly-breasted Munia (Scaled) emits `taxonCode=nutman` | ✓ Pass | Real taxonomy: OFF → `media.ebird.org/catalog?mediaType=photo&taxonCode=nutman&userId=…`. `mlCatalog.test.ts` OFF case. `SpeciesDetail.tsx:439-442` (`mediaLinkTaxonCode`) → `:954` (link). |
| R2 | Species Detail (ON) — flagship emits form issf `taxonCode=scbmun2` | ✓ Pass | Real taxonomy: ON → `…&taxonCode=scbmun2&…`. `mlCatalog.test.ts` ON case; `resolveMediaLinkTaxonCode(true, formCode, speciesCode)`. |
| R3 | Multimedia (OFF) — form entry links by species code, never `taxaName` | ✓ Pass | `LifeListTable.test.tsx` "OFF (merged)": `taxonCode=nutman`, `not taxaName`, host is `media.ebird.org/catalog`. `LifeListTable.tsx:107-109`. |
| R4 | Multimedia (ON) — form entry links by form issf code | ✓ Pass | `LifeListTable.test.tsx` "ON (show subspecies)": `taxonCode=scbmun2`, `not taxaName`. |
| R5 | Statistics (no toggle) — always species code, never `taxaName` | ✓ Pass | Real taxonomy: `codeFor("Scaly-breasted Munia (Scaled)")` → `nutman` via normalize fallback. `statsFormat.test.ts` asserts host + `taxonCode=nutman` + `not taxaName`. `BirdingStats.tsx:1760/1782/1804` use `codeFor(entry.name)`. |
| D1 | No `taxaName=` emitted anywhere | ✓ Pass | Grep of non-test source: every `taxaName` occurrence is in a comment only; no live code path emits it. `mlCatalogUrl` (statsFormat.ts) dropped the `?taxaName=` branch; `mlUrl`/`mlUrlAll` (LifeListTable) build taxonCode-or-nothing; `mlCatalogLink` (mlCatalog.ts) taxonCode-only. |
| D2 | No bare (code-less) link for a resolvable species | ✓ Pass | All builders resolve the species code from the **normalized** name; only an unresolvable name yields a code-less URL (rare last resort, still on the media host). Proven by the fallback check below. |
| D3 | Species Detail off the legacy `search.macaulaylibrary.org` host | ✓ Pass | `mlCatalogLink` now builds on `ML_CATALOG_BASE` (`media.ebird.org/catalog`). Grep: legacy host appears only in comments. `mlCatalog.test.ts` asserts `not search.macaulaylibrary.org`. |
| D4 | Fallback: unresolvable form code → species code (never `taxaName`, never bare) | ✓ Pass | Real taxonomy: `Scaly-breasted Munia (Nonexistent Form)` → formCode `undefined`, `resolveMediaLinkTaxonCode(true, undefined, "nutman")` → `nutman`. `LifeListTable.test.tsx` "ON but form code unresolved" + "no code at all" cases. |

### Blast-radius examples (verified against the real bundled taxonomy)

Every trailing-parenthetical name resolves both a species code (OFF) and its own form code
(ON) — no `taxaName`, no bare links:

| Name | OFF (species) | ON (form) |
|---|---|---|
| Scaly-breasted Munia (Scaled) | `nutman` | `scbmun2` |
| Dark-eyed Junco (Oregon) | `daejun` | `orejun` |
| Yellow-rumped Warbler (Myrtle) | `yerwar` | `myrwar` |
| Northern Flicker (Red-shafted) | `norfli` | `resfli` |
| Rock Pigeon (Feral Pigeon) | `rocpig` | `rocpig1` |
| Mallard (Domestic type) | `mallar3` | `mallar2` |
| Fox Sparrow (Sooty) | `foxspa` | `foxsp2` |

---

## Regression Verdict (the Fix-lane primary concern)

**No regression. Favicons and taxonomic sort are byte-identical; dual-transport parity holds.**

- **`formCodes` is purely additive.** The species-only `codes`/`orders` maps are built exactly
  as before (species-category `bySci`/`byCom`/`byOrder`); no line in their derivation changed.
  Backend `test_species_codes_byte_identical_with_form_map_added` asserts the exact `codes`/
  `orders` dicts, and `test_species_only_codes_miss_form_names` proves form names still MISS
  `codes`. Both are meaningful (assert exact dict equality, would fail if the derivation drifted).
- **Species Detail favicons untouched.** `<SpeciesLinks speciesCode={speciesTaxonCode}>`
  (`SpeciesDetail.tsx:800`) reads the species-only `speciesTaxonCode`. The ONLY consumer of the
  new `formTaxonMap` is `mediaLinkTaxonCode` (the ML link, `:441`). The header eBird/BoW
  favicons point at the same species page as before, even with "Show subspecies" ON.
- **LifeListTable favicons untouched.** `<BirdName taxonCode={taxonMap[entry.commonName]}>`
  (`LifeListTable.tsx:325`) uses the species `taxonMap`; the new `linkTaxonCode` (form-aware)
  feeds only the media hrefs. Favicon and media-link codes are cleanly separated.
- **Statistics never touches `formCodes`.** `BirdingStats.tsx:153-154` requests `/taxonomy/codes`
  and reads only `data.codes` into `mlTaxonMap` — it does not even destructure `formCodes`.
  Correct: Statistics has no subspecies toggle and is always species-level.
- **Dual-transport parity confirmed and meaningful.** The `formCodes` map has a parity test on
  the ONE shared fixture (`taxonomyCollapse.fixture.json`, `formCodesCases` block) driven through
  BOTH twins: backend `test_form_codes_match_shared_fixture` and frontend
  `taxonomyCollapse.parity.test.ts` "getTaxonomyCodes.formCodes" case. Each asserts
  `expectedFormCodes` AND `expectedSpeciesOnlyCodes` on its own transport — so if either twin
  dropped `formCodes` (or the species-only guarantee), that twin's parity test fails. Mutation
  reasoning: removing `formCodes` from `taxonomyService.ts` fails the TS parity test; removing
  `_by_com_all` from `taxonomy.py` fails the Python parity + router tests. The check is not vacuous.
- **No other `/taxonomy/codes` consumer broke.** The full green suite (1282 + 178) covers the
  favicon batches, taxonomic sort, the Frivolous lists, `BirdName`, and the collapse consumers.
  The collapse parity tests (`collapseToSpeciesList` on both twins) still pass unchanged,
  confirming the `_by_com_all`/`byComAllFor` addition did not disturb the existing derivation.

---

## Edge Cases Tested

- **Fallback chain** (form code unresolved → species code → code-less-but-on-host, never
  `taxaName`/bare) — verified in `LifeListTable.test.tsx` (ON-unresolved, no-code), `mlCatalog.test.ts`
  (`resolveMediaLinkTaxonCode` all four branches), and against the real taxonomy.
- **Offline floor** — `formCodes` resolves a form name from the bundled snapshot with the network
  blocked (`test_form_codes_offline_floor`), proving the `byCode` inversion works with zero eBird calls.
- **Empty request** — `/taxonomy/codes` with `species: []` returns `{codes:{}, orders:{}, formCodes:{}}`.
- **Encoding** — userId and taxonCode are `encodeURIComponent`-wrapped (`mlCatalog.test.ts`,
  `statsFormat.test.ts`).
- **Facet composition** — sex/age filter params still append correctly alongside the new taxonCode
  on Multimedia links (`LifeListTable.test.tsx` FR-10 case).
- **Lossless inversion assumption** — the real snapshot's `byCode` has 17,891 entries; the notes'
  "zero name collisions" claim is consistent with the parity fixture and no test detected a lost
  entry. (A full 17,891-entry collision audit was not run headlessly; see Known Limitations.)

---

## Known Limitations

1. **ON-case live catalog behavior — NOT headlessly verifiable (deploy-smoke item, NOT a failure).**
   Whether `media.ebird.org/catalog?taxonCode=<issf code>` actually filters to the form's media
   (i.e. the catalog honors an issf code, e.g. `scbmun2`) can only be confirmed by opening a live
   link. This does not fail the QA run. The links are correctly built per eBird's form-linking
   pattern. **Deploy-smoke action:** open one ON-case link (e.g.
   `https://media.ebird.org/catalog?taxonCode=scbmun2&userId=<you>`) and confirm it filters to the
   (Scaled) form. If the catalog turns out to be species-only, the degrade is a **one-line change**
   in `frontend/src/lib/mlCatalog.ts` — change `resolveMediaLinkTaxonCode`'s ON branch
   `return formCode ?? speciesCode` to `return speciesCode`. Both call sites route through that one
   helper, so nothing else changes; the backend/Tauri `formCodes` map can stay (harmless additive)
   or be removed separately.

2. **Live in-browser rendering not exercised.** This QA verified URL construction and code
   resolution via unit tests, code reading, and a taxonomy resolution check — it did not launch the
   app in a browser to click links, nor verify 375px/responsive rendering of the Media cards. The
   builders are pure and fully unit-covered, so this is low residual risk, but a manual click-through
   at deploy smoke is the natural pairing with limitation #1.

3. **Snapshot name-collision audit not exhaustive.** The "zero `byCode` name collisions → lossless
   inversion" property is relied upon by both `_by_com_all` and `byComAllFor`. It is consistent with
   the fixture parity and the real-taxonomy spot checks, but a full pass over all 17,891 names
   checking for duplicate common names was not performed. Low risk (last-wins would silently pick one
   code); could be a one-time build-time assertion if desired.

---

## Convention Flags

None beyond what the Engineer already flagged in `implementation-notes.md` (the shared
`ML_CATALOG_BASE` host + `taxonCode` pattern, and the additive `formCodes` map + centralized
`resolveMediaLinkTaxonCode` toggle decision with its shared-fixture parity test). Those are sound
standing rules; the QA process surfaced no additional recurring check to codify.
