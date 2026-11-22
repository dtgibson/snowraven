# Schema: Family Rollups and Tree

**Feature:** family-rollups-and-tree
**Date:** 2026-11-21
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (77 FRs, 14 NFRs, 85 QA rows; Open Questions 3, 13 and 15 are decided here, 16 is confirmed, the Designer's seven keep their defaults)
**Extends:** `pipeline/life-lists-tab/schema.md`, `pipeline/life-list-region-filter/schema.md` (the roster passes, the region tiers, the passive provenance reader, the codes batch) and `pipeline/hotspot-reports/schema.md` (the tab registration set, the More sheet cap), carried forward by reference
**Ships as:** one patch bump across the six-file set, in ONE release with the companion map build `map-scroll-on-phones` (FR-90, section 18). `main` is at 1.0.75, so the combined release ships as 1.0.76 unless another ship lands first; the Deployer reads the number off `main` at ship time, never off this document.
**Amended:** 2026-11-21, after the Stage 4 design review (`decisions.md` D-13 to D-25, the approved mockup `design.html`, the PRD's two amendment notes). The amendments are made in place and listed in section 23; nothing outside them was re-opened. In the decisions and the mockup the two views are the **table** (this document's rollup) and the **tree** (this document's diagram).

## Path

Incremental (extending the existing data layer: one new bundled build-time asset with its generator leg, three new validated keys in the settings document and one new flag inside an existing one, new pure derivation modules over the two parsed files; no existing document, route or store is modified).

## Architect assessment

> **Architect assessment: Incremental**
>
> SnowRaven has no database. Its data layer is the documents under `AppLocalData/data/` (mirrored by the web/Pi backend), the epoch modules that announce a change to them, the durable caches behind the `storage` seam, the bundled build-time assets, and the pure `lib/` modules that derive what the UI shows. Most of this feature is a pure derivation over the two parsed files, which alone would be Frontend Only. It is Incremental because it adds a bundled taxonomy asset with a fail-closed generator and a CI equivalence check (FR-01 to FR-07), and writes three new validated keys, `familyTreeRegion`, `familyTreeView` and `familyTreeNames`, into the settings document through `storage.setSetting` (FR-32), plus one dismissal flag the shared rotate note writes into its existing setting (FR-85). Nothing derived is stored, nothing joins `clearDerived.ts`, and no route, host, capability or policy entry is added. Proceeding on this assessment per the hands-off run.

## Confirmation

Every FR was checked for a record created, read from a new source, updated or deleted. The two settings keys and the asset are the whole of it. What follows is the technical design the Engineer builds from.

Settled by reading the code and by measurement rather than from the PRD alone. Each is returned as a flag in the hand-back:

1. **eBird marks extinct species, and the generator cannot write anything today.** The taxonomy response carries `extinct: true` and a numeric `extinctYear` on extinct taxa and omits both keys otherwise (section 2.1). The same response differs from the committed snapshot by one `reportAs` entry, so `planTaxonomyRun` returns `stop` (section 3.4). The first family asset therefore waits on a decision the user owns.
2. **One family is wholly extinct** (Hawaiian Honeyeaters, `mohoid1`), so FR-04's last clause ("the world family and order totals count every family and order in the asset") would put a family nobody can see in the denominator. Section 6.3 counts a family in the world total only when its world species count is above zero.
3. **The asset is keyed by lowercase common name and is self-sufficient**, so the tab never imports the 1.79 MB snapshot at runtime (section 2.2). FR-06's "species-category code set" is held as the equal statement over the snapshot's `byCom` key set.
4. **A leaf cannot host `<BirdName>`**, for a reason other than the mounted bound: FR-68's one tab stop and `aria-activedescendant` forbid focusable content inside a tree item (`ui.md`, v1.0.21). The PRD's own fallback applies (section 11.7), and the readout adds a fixed set of tab stops per kind of active node that FR-68's wording does not name.
5. **NFR-04 can only be met with level of detail.** At a whole-tree fit a roster of every species gives each leaf 0.05 px, so a run of siblings too small to label draws as one count (section 11.4). FR-55 is held over the diagram's node data.
6. **CSS `zoom` and `transform: scale` were measured and are not used** (section 11.2). In WebKit a computed font size cannot see either, so QA-57's assertion is meaningful only because the design uses neither; a scan holds that.
7. **FR-20's reader runs a row pass per provenance snapshot** (`confirmPublishedNames`, 19 ms at the cap). It is the shared reader's own pass, not one of this tab's; NFR-03 is read that way (section 7).
8. **The one-generation migration moves Hotspot Reports to the end** for a device that saved the pre-Hotspot-Reports default and has not saved since (section 14.2).

Settled at the amendment after the design review, each measured and returned as a flag (section 23 has the list of changes):

9. **The approved mockup loses the tree's state on some full-screen round trips, which FR-88 forbids.** At 1440 by 900 and 150% text, entering full screen changes the tree's form (outline to columns) and the mockup starts over: expansion, the active node, zoom and place are all reset, in both engines. At 100% and 125% text the place moves when the active node is out of view. Section 11.3 holds zoom as a fraction of full zoom and place as a node, so every relayout keeps all four.
10. **Two elements scroll inside the mockup's full-screen panel besides the tree's box** (the readout, and the phone toolbar's tools row), where FR-88 and QA-98 say the box is the only scroller. Settled by the design spec: the box is the only scroller, the readout sheds parts by the panel's height and the tools row is six cells that drop their captions (11.9).
11. **The mockup's Fit stops at one line per order**, so a roster with more orders than the box has lines is taller than the box at Fit (45 orders need 810 px at 100% text against a 424 px box), where QA-55 says every drawn node is inside the viewport after Fit. Settled by the design spec: Fit is a true fit with no floor, and the floor belongs to the still's own view, which is the tree from its top cut by its box (11.3, 11.10).
12. **Expand all in the table cannot mount in one commit.** A roster of every species through the real `<BirdName>` took 2.7 to 2.9 s in WebKit and 1.0 to 1.2 s in Chromium, and leaves 194,260 elements mounted. It mounts in chunks with a yield between them (section 9.2).
13. **The Names control changes the tree's full-zoom pitch and nothing about what is mounted.** The mounted count is set by the one-line pitch and read the same in Both and in Common (section 11.4).

---

## Existing data used by this feature

Nothing below is modified.

| Source | This feature |
|---|---|
| `data/ebird-backup.csv`, `data/ml-export.csv`, `data/metadata.json` | Read only, through `storage.getFilesStatus()`, `loadEbirdObservations()` and `loadMLExport()`, exactly as Life Lists reads them |
| `data/settings.json` (web/Pi `settingskv`) | Three new keys (below), and one new flag, `family-tree`, in the existing `chartTipDismissed` map, written by the shared `ChartViewTip` (section 11.10). `lifeListsRegion` is neither read nor written (Open Question 16: own key) |
| `exotic-provenance-v1` | Read passively through `useLifeListsProvenance` (section 7). Nothing is published to it |
| `frontend/src/assets/ebird-taxonomy.json` | Not imported at runtime by this feature. It is the CI oracle for the new asset (section 3.3) |
| `frontend/src/assets/ebird-alpha-codes.json` | Read through the shipped `useAlphaCodes()` for find's four-letter codes (Slice B) |
| Every other store, `ITEM_SUBDIRS` and its Rust twin, `lib/clearDerived.ts`, `cacheInventory.test.ts` | Not touched (FR-32, NFR-05) |

**Parsed rows.** `ObservationEntry`: `submissionId`, `commonName`, `scientificName`, `date`, `time`, `county`, `stateProvince` (through the Life Lists passes), and `commonName`, `date`, `submissionId` in this feature's own passes. `MLExportRow`: `commonName`, `format`, `date`, `checklistId`. No comment, location name or coordinate is read.

**Requests the tab can cause, all existing:** the seam reads above, its own lazy chunks, and one batched `transport.post('/taxonomy/codes', ...)` per distinct world roster name set (section 8.4). Section 15 makes this checkable.

---

## Changes in this feature

### Added

Build tooling:

1. **`scripts/lib/ebirdFamiliesDerive.mjs`** (and `.d.mts`): the pure core for the family asset (section 3).
2. **`frontend/src/assets/ebird-families.json`**: the asset (section 2).

Library modules, all matching one new glob `frontend/src/lib/familyTree*.ts`:

3. **`familyTreeAsset.ts`**: the lazy loader and the runtime index (section 4).
4. **`familyTreeScope.ts`**: the load passes and the per-scope pass (section 5).
5. **`familyTreeModel.ts`**: the one model both views read, world counts, the sort (section 6).
6. **`familyTreeLinks.ts`**: `FAMILY_CODE_RE`, the two family link builders and their verified flags (section 10).
7. **`familyTreeSettings.ts`**: the three setting keys and their validators (section 8.3).
8. **`familyTreeCopy.ts`**: every user-facing string (NFR-13).
9. **`familyTreeLayout.ts`** (Slice B): the drawn tree, projection, cull, fit and keyboard order (section 11).
10. **`familyTreeFind.ts`** (Slice B): the find index and match (section 12).
11. **`familyTreeNames.ts`**: what each Names state shows at each level (section 6.5). Pure; no plural or naming rule lives at run time.

Components under `frontend/src/components/familyTree/` (the design spec shapes them; this schema fixes their data contracts): `FamilyTreeTab.tsx`, `FamilyTreeControls.tsx`, `FamilyTreeRollup.tsx`, and in Slice B `FamilyTreeDiagram.tsx` (reached only through `React.lazy`) and `FamilyTreeFind.tsx`.

One shared component, **`frontend/src/components/MediaPresenceCell.tsx`**: Life Lists' media presence cell, moved verbatim out of `LifeListsRows.tsx` so both tabs render one implementation (section 9.3).

Settings keys: **`familyTreeRegion`** (a `RegionRef`), **`familyTreeNames`** (`'common' | 'scientific' | 'both'`) and, in Slice B, **`familyTreeView`** (`'rollup' | 'diagram'`).

Suites: section 17.

### Modified

1. `scripts/build-ebird-taxonomy.mjs` and `scripts/lib/ebirdTaxonomyDerive.mjs`: the plan carries the family asset in both write modes; the revision check is unchanged (section 3.4).
2. `lib/tabLayout.ts`, `lib/tabIcons.tsx`, `App.tsx`, `components/HelpDocs.tsx`, `globals.css`, `docs/HELP.md` and the guard rosters a new tab moves (section 14).
3. `components/lifeLists/LifeListsRows.tsx`: `MediaCell` moves out and is imported back. Rendered output byte-identical, pinned by a markup golden captured in an earlier commit of its own (section 9.3).
4. `scripts/taxonomy-history-input/README.md` and the rule files (section 18).
5. `components/BirdName.tsx`: one optional prop, `lead`, so a name can lead with its scientific name (section 9.3). Every existing call renders byte-identically, held by a golden captured before the change.
6. `components/ChartViewTip.tsx`: a third `ChartTipPage` value, `'family-tree'`, and two optional props for the note's body and accessible name (section 11.10). The Statistics and Species Detail notes render byte-identically.
7. `App.tsx` also wraps the tab's panel in `MapTabShowingProvider` (section 11.9).

### Consumed, owned by the companion map build (never edited here)

`lib/useMapFullscreen.ts` (as it stands, and with the additions the map build is landing: `stillTier`, `still`, `open`, `registerOpener`, `hostClassName`), the `.sr-map-fs-panel` rules, the `data-sr-fs-open` attribute and the rule that hides the phone's bottom bar under it, the opener register `.sr-fs-open-row` / `.sr-fs-open-btn` / `.sr-fs-open-note`, and `components/ui/FsOpenRow.tsx` (D-18, D-19). This build imports the hook, the provider and `FsOpenRow`, and writes its own compound rules beside the shared panel class. Section 11.9 states the contract, the dependency and the order it forces.

### Unchanged (used, not modified)

`lib/lifeLists.ts`, `lib/lifeListsRegion.ts`, `lib/lifeListsProvenance.ts`, `lib/lifeListsCopy.ts`, `lib/exoticProvenance.ts`, `lib/exoticProvenanceCache.ts`, `lib/exoticTaxonomyJoin.ts`, `lib/useExoticProvenance.ts`, `lib/speciesUtils.ts`, `lib/speciesMatch.ts`, `lib/alphaCodes.ts`, `lib/useAlphaCodes.ts`, `lib/statsFormat.ts`, `lib/mlCatalog.ts`, `lib/speciesCode.ts`, `lib/platformGates.ts`, `lib/statsOffThread.ts`, `transport.ts`, `storage.ts`, `observationsCache.ts`, `mlExportCache.ts`, `filesChanged.ts`, `useFilesEpoch.ts`, `clearDerived.ts`, `frontend/vite.config.ts`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/**`, every backend file, every `lib/tauri/` service, `lib/useIsPhone.ts`, `lib/useFocusTrap.ts`, `SpeciesLinks.tsx`, `OutboundLink.tsx`, `LifeListsRegionPicker.tsx`, `ToggleSwitch.tsx`, `TabLoadErrorAlert.tsx`, `SetupRequired.tsx`, Life Lists, Multimedia, Statistics and every other tab.

No new dependency is added. The diagram's layout is hand-written (section 11.3).

---

## 1. Data flow, stated once

```
storage.getFilesStatus()                    -> { ebird, ml }        a rejection is UNKNOWN: the load-error state
loadEbirdObservations()                     -> ObservationEntry[]   (shared cache)
loadMLExport().catch(() => null)            -> MLExportRow[] | null (shared cache, optional)
loadFamilyIndex()                           -> FamilyIndex          (lazy asset, section 4)
readSaved(familyTreeRegion, familyTreeView, familyTreeNames) -> validated or default

once per files epoch, in the load effect, a yield between passes
  P1   deriveFirstSightings(obs)            O(rows)     Life Lists pass 1, unchanged      the world roster
  P1R  deriveRegionIndex(obs)               O(rows)     Life Lists pass 1R, unchanged     tiers, join, choices
  Y1   deriveYearColumns(obs, mlRows)       O(rows + mlRows)   new: year per row, year list, not-single-species rows
  W1   worldCounts(index, firsts)           O(S)        new: extinct species on the unfiltered roster

per Region or Year change
  S1   deriveScope(base, region, year)      at most 3 visits per observation row, 1 per ML row (section 5.3)

per Region, Year, Media, Include Escapees or provenance change
  A1   buildFamilyModel(...)                O(S + asset species)   no row visit

per sort change       sortFamilies(model, key)     O(F log F), F at most the asset's families
per keystroke (B)     matchFind(findIndex, query)  O(names in the model), section 12
per view change (B)   cullTree(drawn, view, box)   O(nodes visited), at most DIAGRAM_MOUNTED_MAX out
```

Both views render from the one `FamilyModel` (FR-33). A view switch builds nothing (FR-54). Nothing runs in a render body.

---

## 2. The family taxonomy asset

### 2.1 What eBird's response carries (Open Question 3, settled)

One request was made, to the generator's own URL (`https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json`) on 2026-11-21, saved to the scratch area and never to the repo. It answered 200 without a key, so no key was used. (`backend/.env` on this Mac holds no `EBIRD_API_KEY`; the app's own key store holds one, which is where the runbook's step 4 reads it for a real generator run.)

| Fact | Reading |
|---|---|
| Rows, species-category rows | 18,631 and 11,201 |
| Field names | `order`, `familyCode`, `familyComName`, `familySciName`, present and non-empty on all 11,201 species rows (13 non-species rows lack the family fields, 2 lack `order`) |
| Extinct marker | `extinct: true` with a numeric `extinctYear` (0 when unknown) on 193 rows, 173 of them species; both keys are ABSENT otherwise, never `false` |
| Orders and families | 45 and 250, each one contiguous run in `taxonOrder`; each family code maps to one name pair and one order |
| Genera (first word of `sciName`) | 2,379, each one contiguous run, none under two families; every species `sciName` is exactly two ASCII words |
| Family codes | 7 or 8 characters, every one matching `^[a-z]+[0-9]+$` |
| Longest names | family common 44, family scientific 18, order 19, genus 18, epithet 21, species common 35 |
| Wholly extinct families | one: `mohoid1`, Hawaiian Honeyeaters |

Cornell's `ebird-taxonomy-v2026.csv` on this Mac (sha256 `dcabf48e...c4ab`, the README's recorded hash) agrees with the response on family, order, extinct and scientific name for all 11,201 species: zero differences in each column.

FR-04 therefore holds as written, with the one amendment of section 6.3.

### 2.2 Shape (version 2; version 1 never shipped)

```
{
  "v": 2,
  "version": "<the snapshot's version>",
  "orders":  [ [orderName, orderCommonName, [family, ...]], ... ],
  "extinct": [ lowercaseCommonName, ... ]
}
family = [ familyCode, familyComName, familySciName, living, [genus, ...] ]
genus  = [ genusName, [ lowercaseCommonName, epithet, lowercaseCommonName, epithet, ... ] ]
      or [ genusName, [ ... ], genusCommonName ]      the third element only where the rule of 3.5 gives a name
```

- `orderCommonName` is the authored name of FR-82, copied into the asset by the generator from the one table in its core (3.5). Every order has one.
- `genusCommonName` is derived by the generator (FR-83, 3.5). A genus without one has a two-element tuple; the app shows its scientific name. No name is ever formed at run time.
- Measured on the prototype with both added, built from the saved response and the mockup's approved order table: **449,944 bytes raw and 134,392 gzipped** (brotli 112,276), which is 15,953 raw and 4,430 gzipped more than the shape without them (433,991 and 129,962). It names all 45 orders and 1,253 of the 2,379 genera, 560 distinct names, the longest 21 characters; the longest order name is 23.

- Arrays are in eBird's taxonomic sequence, so a taxon's position IS its index and contiguity is structural.
- `living` is the family's species not marked extinct (the stored half of FR-04's world count).
- A species' scientific name is `genusName + ' ' + epithet`.
- No `generated` date, so the same taxonomy derives the same bytes.
- **Keyed by lowercase common name, not species code.** Measured on the prototype built from the saved response: 433,991 bytes raw and 129,962 gzipped keyed by name, against 300,622 and 107,894 keyed by code. The code form needs the snapshot's `byCom` beside it at runtime, a 1,786,735 byte chunk (473,455 gzipped) that the web/Pi frontend does not otherwise download. The name form costs 22 KB gzipped and is the only taxonomy file the tab loads. Species codes for the link marks still come from the `/taxonomy/codes` batch (FR-46), never from this asset.
- **Size bound:** `FAMILIES_GZIP_MAX_BYTES = 204_800`, the alpha-code asset's budget, declared once in the pure core. Measured use with the order and genus names: 66%.
- The size figures in the bullet above this one compare the two keyings on the shape without order and genus names; the names add the same bytes to either.

### 2.3 Placement key

A roster name is placed by `index.bySpecies.get(name.toLowerCase())` after a length gate: a name over `PLACE_KEY_MAX = 128` code units is unplaced with one length read and is never lowercased or hashed (the V8 long-key rule, `security.md` v1.0.74). `bySpecies` is a `Map`, so `constructor`, `__proto__` and `toString` are ordinary absent keys (FR-24, QA-24). eBird's longest species name is 35 characters.

---

## 3. The generator

### 3.1 The pure core, `scripts/lib/ebirdFamiliesDerive.mjs`

No `process`, no `fs`, no network, no app imports (the `ebirdTaxonomyDerive.mjs` posture). Exports:

- `FAMILIES_ASSET_VERSION = 2`, `FAMILIES_GZIP_MAX_BYTES`, `FAMILY_CODE_SHAPE_RE = /^[a-z]{2,12}[0-9]{1,3}$/`, the name bounds `FAMILY_COM_MAX = 80`, `FAMILY_SCI_MAX = 40`, `ORDER_MAX = 40`, `GENUS_MAX = 40`, `EPITHET_MAX = 40`, `SPECIES_NAME_MAX = 128`, `ORDER_COMMON_MAX = 40`, `GENUS_COMMON_MAX = 40`, and the floors `MIN_FAMILIES = 200`, `MIN_ORDERS = 30`, `MIN_GENERA = 1_500`.
- `ORDER_COMMON_NAMES`, the two closed lists `GENUS_PLURAL_EXCEPTIONS` and `GENUS_LEFT_UNNAMED`, and `genusCommonName(genus, speciesCommonNames)` (3.5).
- `deriveFamilies(taxonomy, { version })`: one pass in response order over species-category rows. Accumulators are arrays and `Map`s.
- `liveFamilyViolations(taxonomy)`: the checks that need the response (G rows below).
- `checkFamilies(asset, snapshot)`: the shared checker (F rows below), run by the generator over what it would write and by CI over the committed asset, so the generator refuses anything CI would refuse.

### 3.2 Checks. Every one returns violation messages; one message stops the whole run with nothing written (FR-03)

| # | Check | Where |
|---|---|---|
| G1 | Every species row has a non-empty string `order`, `familyCode`, `familyComName`, `familySciName` | generator |
| G2 | A family code maps to exactly one (common name, scientific name, order) triple across all species rows | generator |
| G3 | `extinct`, where the key is present on a species row, is exactly `true` or `false`; any other value stops the run | generator |
| G4 | Every species `sciName` is exactly two whitespace-separated words | generator |
| G5 | The per-family tallies equal an independent count (a `Map` by `familyCode` over the species rows) and sum to the species rows | generator |
| G6 | Every order of the response is an own key of `ORDER_COMMON_NAMES` (read through `Object.hasOwn`), and every key of the table is an order of the response. Either direction stops the run, so a new order stops the generator until its name is authored and a retired one until its row is removed | generator |
| G7 | Every member of `GENUS_LEFT_UNNAMED` is a genus of the response that the rule would otherwise name. A member that matches nothing stops the run, so the list cannot outlive its reason | generator |
| F1 | `v` is 2 and `version` equals the snapshot's | both |
| F2 | The flattened species names equal `Object.keys(snapshot.byCom)` as a set, both directions, no duplicate | both |
| F3 | Flattened, `snapshot.byOrder[name]` is strictly increasing (so every family's species, every order's families and every genus are contiguous in the snapshot's sequence) | both |
| F4 | Family codes, order names and genus names are each pairwise distinct across the asset | both |
| F5 | Every family code passes `FAMILY_CODE_SHAPE_RE`; every name is a non-empty string within its bound with no control character | both |
| F6 | Each `living` equals the family's species minus its members of `extinct`; every `extinct` member is a species of the asset; the sum of `living` plus the length of `extinct` equals the species count | both |
| F7 | For every species, `snapshot.bySci[(genus + ' ' + epithet).toLowerCase()] === snapshot.byCom[name]` | both |
| F8 | Families, orders and genera at or above their floors | both |
| F9 | The JSON text is within `FAMILIES_GZIP_MAX_BYTES` | both |
| F10 | Every order tuple carries a common name that is a non-empty string within `ORDER_COMMON_MAX` with no control character, and equals `ORDER_COMMON_NAMES[orderName]` | both |
| F11 | A genus common name, where present, is a non-empty string within `GENUS_COMMON_MAX` with no control character, sits on a genus with two or more species, and equals `genusCommonName` over that genus's species names as the snapshot spells them (`snapshot.byCode[snapshot.byCom[name]]`); a genus the function names carries that name unless it is in `GENUS_LEFT_UNNAMED` | both |

The prototype passes F1 to F9 against the committed snapshot (11,201 species, set-equal, strictly increasing, 11,201 scientific-name pairs, 11,028 living plus 173 extinct). The version 2 prototype also holds G6 in both directions (45 orders in the response, 45 rows in the approved table, none unmatched either way).

`FAMILY_CODE_SHAPE_RE` is spelled in the core because the core takes no app imports; `familiesGenerator.test.ts` holds it equal to the runtime `FAMILY_CODE_RE` (`lib/familyTreeLinks.ts`), the two declarations compared and never restated (the `SPECIES_CODE_SHAPE_RE` precedent). Its class cannot express a scheme, host, credential, path separator or percent escape.

### 3.3 CI equivalence, `familiesAsset.test.ts` (FR-06, QA-06)

No request. Reads the committed asset and the committed snapshot when the test runs and calls `checkFamilies`. It adds an independent re-derivation that does not call the core: it rebuilds each family's `living` and the species-to-family map by its own loop and compares. Mutation rows, each restored byte-identical: one species removed, one species moved to a non-adjacent family, one `living` altered, the recorded version changed, one family code given a `/`.

**Extended to the order and genus names (FR-82, FR-83, QA-92, QA-93).** The independent loop also, without calling `genusCommonName` or `deriveFamilies`:

- compares the asset's order names with `ORDER_COMMON_NAMES` as a set in both directions and name for name, and holds BOTH to the approved wording: the test carries the 45 pairs of the design spec's section 6.2 as its own literal, the oracle outside the generator, so a name changed in the core alone, or in the asset alone, is red (QA-92). The core's table and the test's literal are two declarations compared to each other; neither is derived from the other;
- for EVERY genus in the asset, takes its species' names as the snapshot spells them (the asset's keys are lowercase, and the rule reads eBird's own capitals), applies the rule of 3.5 written out again in the test, importing only the two closed lists, and asserts both directions: a genus that carries a name satisfies the rule and carries exactly the plural the rule and the exception list give; a genus that satisfies the rule carries a name unless it is on the left-unnamed list; a single-species genus carries none.

Further mutation rows: one order name removed, a name added for an order the asset lacks, one order name emptied, one genus name changed, a name put on a single-species genus. A generator fixture row runs the derivation twice over one response and compares bytes. A source scan of `lib/familyTree*.ts` and `components/familyTree/**` finds no pluralizing code (QA-93's last clause).

### 3.4 First generation and drift (Open Question 15, decided)

**Decision.** The family asset is written only by `scripts/build-ebird-taxonomy.mjs`, from the same single response, under the existing revision check, which is not changed. `planTaxonomyRun` derives the asset in both write modes (`all` and `codes-only`) and returns `familiesJson`; the CLI adds one entry to its `writes` list. `stop` still writes nothing. There is no second entry point, no flag and no path that writes the asset when the five maps differ. In `codes-only` the asset is rewritten from the live response, as the alpha-code asset is; with no date field its bytes are unchanged unless eBird changed a family, order or extinct field, and F1 to F9 hold it to the snapshot either way.

**Measured today: the check does not pass.** `planTaxonomyRun` over the saved response and the committed snapshot returns `stop` with the revision message and `reportAs: 0 of 4717 live keys differ (committed has 4718)`. The one entry is `grnwhe1` (Great Nicobar White-eye (undescribed form)), which reported as `indwhe1` (Indian White-eye) on 2026-11-03 and has no `reportAs` now. `bySci`, `byCom`, `byOrder` and `byCode` are equal.

**What happens on drift: the run stops and it is raised** (the PRD's default). It is raised now. Two routes, the first recommended:

- **Route 1, refresh the snapshot first.** Follow the runbook's steps 3 to 9 as a mid-year refresh (`VERSION` 2028 to 2029 and `CACHE_KEY` together, the generator in `all` mode writing every asset including this one, the history generator re-run from the files on disk, the re-derive step, every check). It is a taxonomy data change of its own (one form stops folding into its parent, the countability corrections move by one) and belongs to the user to start, as its own small run or as this build's first commit.
- **Route 2, a one-time bootstrap.** Feed the saved response through `deriveFamilies` and `checkFamilies` against the committed snapshot. Every field the asset reads is identical on both sides of the drift (section 2.1), so the bytes equal Route 1's apart from `version`. It is exactly what the PRD's default says not to do (an asset built from a response the revision check refuses), so it needs the user's explicit yes and a `decisions.md` entry.

Everything else in this document is independent of the route. The Engineer's first step of Slice A cannot start until one is chosen.

### 3.5 Order names and genus names (FR-82, FR-83, FR-91)

Both are build-time data in the pure core, `scripts/lib/ebirdFamiliesDerive.mjs`, emitted into the asset. The trust boundary is unchanged: defended at build time (G6, G7, F10, F11) and in CI (3.3), with no runtime validation and no naming code at run time.

**Order names: one authored table.** `ORDER_COMMON_NAMES`, a frozen object of order scientific name to the wording the user approved (the 45 rows of the mockup's table, D-21 and D-23: Waterfowl for Anseriformes, Perching Birds for Passeriformes). It is the one place the shipped wording is written. The approved record is the design spec's section 6.2 (45 rows, the same wording), and the CI suite holds this table and the asset to a literal of that record (3.3). G6 fails the run closed in both directions.

**Genus names: one pure function, `genusCommonName(genus, speciesCommonNames)`**, called once per genus over the species-category names of the response, extinct ones included. It returns the name or the empty string:

1. Fewer than two species: no name.
2. The group word is each name's whole last whitespace-separated word, a hyphenated word counting whole. If those are not all equal ignoring case, it is each last word's part after its last hyphen. If those are not all equal either: no name.
3. The group word equals the genus name ignoring case (the Vireo and Junco shape): no name.
4. The plural. `GENUS_PLURAL_EXCEPTIONS` is consulted first: a word, or the part after its last hyphen, ending in fowl, grouse or quail is unchanged; ending in goose becomes geese, in titmouse titmice, in monarch monarchs; bird-of-paradise and cock-of-the-rock pluralize on their first word. Otherwise the regular endings: es after s, x, z, ch or sh; ies for a consonant and y; s for the rest.
5. The first letter is capitalized and the rest is as eBird wrote it (Screech-Owls, Crag-Martins).
6. A genus in `GENUS_LEFT_UNNAMED` (a list of genus scientific names, empty until the read-through below adds one) gets no name.

No name is authored for a single genus outside those two lists, two genera may share a name, and no id, key or lookup is ever built on one (FR-45).

Measured on the prototype of this function over the saved response: 1,495 genera have two or more species; 1,253 get a name, 53 of them through the after-hyphen step; 61 are refused because the word is the genus itself; the names are ASCII. All 109 genus names in the approved mockup are reproduced exactly, with none different.

**The read-through, a named step of the generator (FR-91, QA-102).** In every write mode the CLI prints a genus-name report after its counts: how many genera are named, the distinct names, and the names that are new or changed against the committed asset (on the first generation, all of them). A person or the builder reads that list once before the feature ships. Each awkward plural found is settled in the core, by a row in `GENUS_PLURAL_EXCEPTIONS` or a genus in `GENUS_LEFT_UNNAMED`, never in the asset by hand; the generator is re-run; the date, the names changed and the names dropped go in `decisions.md`. The prototype's run gives the review its starting list: 52 distinct names with a formed es or ies ending, among them Hemispinguses, Arguses, Apalises, Crociases, Asities, Jeries and Topazes, plus Oos. None of those is settled here: the review is a ship-set step.

---

## 4. The runtime loader and index: `lib/familyTreeAsset.ts`

```ts
export interface FamilyIndex {
  readonly version: string
  readonly orders: readonly { readonly name: string; readonly common: string; readonly firstFamily: number; readonly familyCount: number }[]
  readonly families: readonly { readonly code: string; readonly name: string; readonly sci: string; readonly order: number;
                                readonly living: number; readonly firstGenus: number; readonly genusCount: number }[]
  /** `common` is null where the generator derived no name. */
  readonly genera: readonly { readonly name: string; readonly common: string | null; readonly family: number; readonly firstSpecies: number; readonly speciesCount: number }[]
  /** Per species, by taxonomic sequence. */
  readonly speciesGenus: Uint16Array
  readonly speciesFamily: Uint16Array
  readonly epithets: readonly string[]
  readonly extinct: Uint8Array
  /** Lowercase common name -> taxonomic sequence. */
  readonly bySpecies: ReadonlyMap<string, number>
}
export function loadFamilyIndex(): Promise<FamilyIndex>
```

- One `import('../assets/ebird-families.json')`, named exactly once in the source (the alpha-code loader's row in `entryChunk.test.ts` is the shape).
- The resolved index is memoized for the session: it is immutable build data and holds nothing from a user file. **A rejected or malformed import is not memoized**: the shared promise is released on failure, so the next call imports again (FR-14).
- A minimal shape check (`v === 2`, `orders` an array) turns a wrong file into a rejection. No per-entry runtime validation: a Vite-inlined asset is defended at build time and CI (FR-05; CLAUDE.md v0.5.89).
- Measured: parse plus index 2.5 ms, the index alone 0.9 ms (Node 24).

---

## 5. The scope module: `lib/familyTreeScope.ts`

Pure: no I/O, no clock, no React, no network import. Its suite carries the comment-stripped absence guard `lifeLists.test.ts` carries (no regex literal, no `RegExp`, none of `.includes(`, `.indexOf(`, `.find(`, `.filter(`, `.match(`, `.search(`, `.split(`).

### 5.1 The roster is Life Lists' derivation, called, not copied (FR-18, FR-19)

| Scope | The roster before escapees and media |
|---|---|
| Everywhere, all years | the keys of `deriveFirstSightings(obs)` |
| Region R, all years | the keys of `lookupTier(deriveRegionIndex(obs).firsts, R)` |
| Everywhere, year Y | the keys of `deriveFirstSightings(rowsOf(Y))` |
| Region R, year Y | the keys of `lookupTier(deriveRegionIndex(rowsOf(Y)).firsts, R)` |

`rowsOf(Y)` is the sub-array of observation rows whose `dayKey` year is Y, collected from the year column. Handing a year's own rows to Life Lists' own passes applies its gates (valid date, submission id, `isNonCountableForm` on the raw name, the folded name, the State/Province and County bounds) with no second copy of any of them. FR-19's union property holds by construction: each gate is per row and each dated row lies in exactly one year. `rowsOf(Y)` is transient: it is dropped when the pass returns, and only the returned key sets and tier maps are kept, for the selected year only.

Every roster under any scope is a subset of the world roster (the regional and year gates only add conditions), so `firsts.get(name)` exists for every roster species; an unplaced species' binomial is read from it (FR-27, Life Lists' `binomialOf`).

### 5.2 Load pass Y1, `deriveYearColumns(obs, mlRows)`

One loop over each array, constant work per row:

- `obsYear: Uint16Array(obs.length)`: `floor(dayKey(o.date) / 10000)`, 0 for no valid day (year 0000 reads as no year).
- `mlYear: Uint16Array(mlRows.length)`, the same over `row.date`.
- `years: number[]`: the distinct years with a row that is validly dated, has a submission id, is not `isNonCountableForm` and folds to a non-empty name; newest first; at most `YEAR_OPTIONS_MAX = 150` (older years are not offered, all years still covers them; `dayKey` admits ten thousand distinct years, the Hotspot Reports year-bound precedent).
- `nsRow: Int32Array` and `nsName: Int32Array`: the indices of rows that are validly dated, have a submission id and are `isNonCountableForm`, each with the ordinal of its distinct raw name in a `Map` built here. A raw name over `PLACE_KEY_MAX` gets ordinal -1 and is not counted, with one length read.

The year list restates four gates of pass 1 (it cannot call pass 1 without running it once per year). It owes its symmetric difference in both directions: `familyTreeScope.test.ts` asserts over a generated corpus, hostile rows included, that every offered year has a non-empty Everywhere roster and every year with a non-empty roster is offered (subject to the cap).

### 5.3 The per-scope pass S1, `deriveScope(base, region, year)`

```ts
export interface Scope {
  /** Normalized names, Life Lists' keys. */
  readonly names: ReadonlySet<string> | ReadonlyMap<string, unknown>
  /** ML name -> items by kind [photo, audio, video], in scope. null without a readable export. */
  readonly tallies: ReadonlyMap<string, Uint32Array> | null
  /** FR-26. */
  readonly notSingleSpecies: number
}
```

- **Names:** section 5.1. Under a Year the pass for Everywhere or for a region runs at most once per (year, kind) and is kept for the selected year, so a second region in the same year walks no row.
- **Tallies (FR-22), one loop over the ML rows:** skip `mlYear[i] === 0`; under a Year skip a different year; skip a format outside Photo, Audio, Video and an empty name; under a Region require a non-empty `checklistId` whose `join.get` cells lie in the region; then increment. Under Everywhere no checklist is required, so an unlinked item counts only there. `join` is the ALL-YEARS `deriveRegionIndex(obs).join` (the checklist is in the backup), never a year's.
- **Region membership of a checklist's cells:** `cellsInRegion(cells, region)`: a country when `cells.country === region.code`; a state when `cells.hyphenated && cells.state === region.code`; a county when that holds and `cells.county !== '' && cells.county === region.county`. It restates the tier insertion of `deriveRegionAssets`, so it owes both directions: over a generated corpus, has-a-kind from the tallies equals the key set of Life Lists' `deriveFirstAssets` (Everywhere) and `regionAssets` (every region), by kind (QA-22, FR-21's media half).
- **Not single species (FR-26):** one loop over `nsRow`: skip a different year under a Year; under a Region require the row's checklist cells in the region (by the join, as media is; for any export whose rows of one checklist share State/Province and County this equals the per-row rule, and a hand-edited file follows the checklist's first row); mark the name ordinal; count the marks.

**Work count per change (NFR-03), held by `familyTreeLinearity.test.ts`:** a Year change visits each observation row at most 3 times (the year-column scan, then at most one Life Lists pass over that year's rows for the current region kind, and at most one more the first time the other kind is asked in that year) and each ML row once. A Region change visits each ML row once, each not-single-species row once, and no observation row unless that year's pass for the kind has not run. Media, Include Escapees, sort, view and a provenance change visit no row.

---

## 6. The model: `lib/familyTreeModel.ts`

### 6.1 Shapes

```ts
export type KindState = 'any' | 'has' | 'lacks'
export interface MediaConstraints { readonly photo: KindState; readonly audio: KindState; readonly video: KindState }

export interface SpeciesLeaf {
  /** The roster's own name (BirdName's commonName, the Species Detail key). */
  readonly name: string
  /** From the asset; for an unplaced species, the backup's binomial. */
  readonly sci: string
  /** Bit 0 photo, 1 audio, 2 video, in scope. null when media figures are off. */
  readonly kinds: number | null
}
export interface GenusNode { readonly genus: number; readonly seen: number; readonly species: readonly SpeciesLeaf[] }
export interface FamilyNode {
  readonly family: number            // index into FamilyIndex.families
  readonly seen: number
  readonly world: number
  /** Species with each kind, and items of each kind, in scope. null when media figures are off. */
  readonly withKind: readonly [number, number, number] | null
  readonly items: readonly [number, number, number] | null
  readonly genera: readonly GenusNode[]
}
export interface OrderNode { readonly order: number; readonly seen: number; readonly world: number;
                             readonly familiesSeen: number; readonly familiesWorld: number; readonly families: readonly FamilyNode[] }
export interface FamilyModel {
  readonly orders: readonly OrderNode[]                 // taxonomic; only those with a roster species
  readonly unplaced: readonly SpeciesLeaf[]             // by name, localeCompare
  readonly seen:  { readonly species: number; readonly families: number; readonly orders: number }
  readonly world: { readonly species: number; readonly families: number; readonly orders: number }
  readonly notSingleSpecies: number
  readonly mediaShown: boolean
  /** True when Region, Year or a Media constraint is off its default (FR-38). */
  readonly filtered: boolean
}
```

Absence is expressed inside the object (`null` members, empty arrays), never a `null` model.

### 6.2 `buildFamilyModel` (A1)

Inputs: the `FamilyIndex`, the world counts, the `Scope`, the confirmed escapee set, `includeEscapees`, the `MediaConstraints`, whether an export is readable, and the world roster map. Steps:

1. One loop over `scope.names`: drop a confirmed escapee when Include Escapees is off; read the name's tallies; apply each set constraint ("has" is a tally above zero, "lacks" is its negation); place the name (section 2.3). A placed name writes its roster name into `nameAt[seq]` (an array the length of the asset's species); an unplaced one joins `unplaced`.
2. One walk over the index in taxonomic order (orders, families, genera, species), emitting a node only where `nameAt[seq]` is set, and summing as it goes. No sort.
3. `unplaced` sorted by `localeCompare` (the Region picker's residual class).

`O(S + asset species)`. Measured (Node 24, the sorting prototype, which is slower than the walk): 0.9 ms at 3,000 species, 3.8 ms at 11,201.

The sum invariants of FR-39 hold by construction (each count is summed from the level below in the one walk) and are asserted as identities over a generated corpus.

### 6.3 World counts (FR-04), with the wholly extinct family

`worldCounts(index, firsts)`, once per files epoch and index: `world[f] = living[f] + (extinct species of f present in the world roster)`. The world roster is `deriveFirstSightings(obs)`, which is Everywhere, all years, Include Escapees on. So a world count never moves with a control and is never below species seen.

- World species total: the sum of `world[f]`.
- **World family total: the families with `world[f] > 0`. World order total: the orders with such a family.** This departs from FR-04's last clause. Counting all 250 would put Hawaiian Honeyeaters, with no living species, in the denominator of "families seen", where it can never be reached; this rule is FR-04's own species rule applied one level up (an extinct taxon counts on both sides exactly when the birder has it). QA-36 still reads its totals from the asset through this function. Reversal: the user prefers every family in the asset counted; the change is the one predicate.

### 6.4 Sort (FR-40)

`sortFamilies(model, key)` returns a flat list for any key but taxonomic: family name (`localeCompare` on the asset's names), species seen, share of world seen (compared as cross products of integers, no float), species with each kind. Every comparator ends on the family index, so the order is total and identical across reloads and engines. The "family name" key sorts on the family's common name in every Names state, so a Names change never reorders rows (FR-78).

### 6.5 Names: `lib/familyTreeNames.ts` (FR-78 to FR-80)

```ts
export type NamesState = 'common' | 'scientific' | 'both'
export type Level = 'order' | 'family' | 'genus' | 'species'
export interface Naming {
  readonly lead: string
  /** The second name, only in Both and only where the taxon has two. */
  readonly alt: string | null
  readonly leadItalic: boolean
  readonly altItalic: boolean
}
export function nameOf(level: Level, common: string | null, scientific: string | null, state: NamesState): Naming
```

- **Both:** the common name leads and the scientific name is `alt`. **Common:** the common name alone; a taxon with no common name (a genus the generator gave none) shows its scientific name. **Scientific:** the scientific name alone; a taxon with none (an unplaced species whose backup row gives none) shows its common name. `lead` is never empty.
- **Italic** is a property of the name, not the state: a scientific name is italic at genus and species level and upright at family and order level; a common name is never italic.
- The names come from the `FamilyIndex` by index (order and genus common names, family names, the scientific names) and from the roster (a species' common name). **The model is not rebuilt and holds no Names state**: a Names change invokes no pass, no `buildFamilyModel`, no request, and changes no count, row order or expansion (QA-88).
- Every accessible name is built from the same `Naming` the eye sees. The readout calls `nameOf(..., 'both')` in every state (FR-79).
- This module is pure and holds no table. It joins the `lib/familyTree*.ts` glob.

---

## 7. Escapees: the passive reader, unchanged (FR-20, FR-23, FR-12)

The tab calls **`useLifeListsProvenance(observations, rosterCodes)`** from `lib/lifeListsProvenance.ts` as it stands: the store subscription, `loadSnapshot`, the one taxonomy join from `loadEscapeeJoin()`, `lifeListsClassification` and `statisticsCheckComplete`'s two halves. It reads `escapees` and `checkComplete`; `exotics` is ignored (naturalized and provisional exotics are always counted). No function of that module is edited or copied.

- `rosterCodes` is the codes map only while it belongs to the current world roster, `null` while pending or failed, so FR-23's sentence shows in those states (QA-23).
- **Cost, stated:** on every provenance snapshot change the hook re-runs `confirmPublishedNames`, one `Set.has` per observation row: measured 19 ms at 150,000 rows with twelve published names (Node 24), the figure Life Lists pays today. Its per-row cover index is already keyed on the rows, codes and join alone (`security.md` v1.0.63). This is the shared reader's pass. None of this tab's passes (P1, P1R, Y1, S1) is keyed on the snapshot, which is what NFR-03 and QA-76 are read to require. Reversal: if the Planner reads NFR-03 as forbidding the reader's pass too, the tab takes Hotspot Reports' indexed confirmation shape (its schema, section 6), proven equal to this function over a generated corpus.
- All `lib/familyTree*.ts` modules join the passive roster of `exoticProvenanceGraph.test.ts` (no `transport`, no `lib/tauri/*Service` in their static closure); a positive leg shows `FamilyTreeTab.tsx` reaches `lib/lifeListsProvenance.ts`, and a symbol row shows `buildCoverIndex` and `useExoticProvenance` appear in none of the feature's files.

---

## 8. The tab: `components/familyTree/FamilyTreeTab.tsx`

Props: `onGoToSettings`, `onOpenSpecies`, and **`showing: boolean`** (`activeTab === 'family-tree'` in `App.tsx`).

### 8.1 State

- `phase`: `loading` | `setup-required` | `error` (message: one of two module constants, `EBIRD_BACKUP_LOAD_ERROR` or the copy module's family-data message) | `ready` (the cache's own observation and ML arrays, `firsts`, `index` (pass 1R), the year columns, the `FamilyIndex`, the world counts, the ML state `none | unreadable | ready`, the remembered region, view and Names state).
- Session-only `useState`: `sessionRegion`, `sessionView`, `sessionNames` (each `undefined` until the user chooses, the saved value governing until then), the first-use view latched when nothing is saved (8.3), `year`, `media`, `includeEscapees`, `sort`, the rollup's open families (a `Set` of family indices), the diagram's expansion, active node and view (zoom and place, section 11.3; Slice B), `announceSeq`.
- The diagram's expansion, active node and view live HERE, in the tab, not in the lazy diagram component, so they survive the still, full screen, a change of form and a view switch (FR-88).
- `codeRequest`, `taxonMap`, `codesKey`: the Life Lists shapes.

`<TabLoadErrorAlert>` is mounted at fragment index 0 of every branch that can reach the error phase, empty while idle (FR-14; `ui.md` v1.0.15).

### 8.2 The load effect

Dependencies `[filesEpoch, retrySeq]`. The Life Lists effect with three differences:

1. `loadFamilyIndex()` rides the `Promise.all`, wrapped so its own failure settles as a tagged value and is never mistaken for a backup failure. With a backup saved and readable, an asset failure sets the error phase with the family-data message; nothing renders as unplaced. With no backup, the setup panel shows whatever the asset did.
2. Between passes the effect awaits a macrotask yield and re-checks its `cancelled` flag, so input is handled between passes and a superseded run writes no state (FR-15, NFR-02).
3. After a re-derive, a session Year the new year list lacks resets to all years; a region absent from the new choices reads as Everywhere through `findChoice`, with no write (FR-17).

`retrySeq` advances when `showing` turns true while the phase holds the family-data error, so the import is tried again the next time the tab is shown (FR-14).

### 8.3 The three settings (FR-32, FR-53, FR-80, Open Question 16 confirmed)

`lib/familyTreeSettings.ts`:

| Key | Stored value | Read through | Default |
|---|---|---|---|
| `familyTreeRegion` | a `RegionRef` | Life Lists' `parseStoredRegion` (the same stored shape, a different key) | Everywhere |
| `familyTreeView` (Slice B) | `'rollup'` or `'diagram'` | `parseStoredView`: exactly one of the two, anything else is the default | **No constant: derived from the still tier when nothing is saved** (FR-53, D-35, below): `'diagram'` when the window is wider than the still tier, `'rollup'` at or under it; and `'rollup'` wherever FR-71's predicate withholds the diagram, saved value or not |
| `familyTreeNames` | `'common'`, `'scientific'` or `'both'` | `parseStoredNames`: exactly one of the three, anything else is the default | `'both'` (D-22, D-23) |

**The view that opens, and an unsaved default (FR-53, D-35, which corrects D-25(a)).** The view shown is the first of these that applies:

1. `'rollup'` where FR-71's predicate withholds the diagram.
2. The view the user chose this session (`sessionView`).
3. The saved `familyTreeView`, when `parseStoredView` accepts it. A saved value governs on every tier: someone who chose the tree on a phone gets the tree there, as the still.
4. **The first-use default, derived once:** `defaultViewFor(stillTier)` is `'rollup'` when `stillTier` is true and `'diagram'` otherwise. It is pure, lives in `familyTreeSettings.ts`, and takes the tier as an argument, so nothing in that module reads a window.

- **`stillTier` is the one tier value the tab holds** (11.10): `fs.stillTier` from the full-screen hook once the last slice is in, and before that slice the app's `useIsPhone()`, which is the same `(max-width: 640px)` query. There is no second breakpoint for the default.
- **The default is latched, not followed.** It is decided when the tab first reaches its ready phase in a session with nothing saved, from the tier at that moment, and held in tab state for the rest of the session. **If the window then crosses 640 px before the user has chosen a view, nothing changes:** a phone turned to landscape stays on the table it opened on, and a narrowed desktop window stays on the tree, which at that width is the still with Open the tree (11.10). A files epoch does not decide again. A view never changes under the user without a press.
- **Nothing is written until the user changes view once.** The latched default is never saved, so the next launch derives it again from the window it opens in; after the first change of view the choice is saved and step 3 governs on every tier.
- A saved value that `parseStoredView` refuses reads as nothing saved, so step 4 applies; nothing is written back.

Declined: a default that follows the tier live until the first choice. It would swap the table for the tree, or back, on a rotation or a resize, with the user having pressed nothing. Reversal: the user asks at the live look for the view to follow the window until they choose; it is the latch removed and nothing else.

The stored values are label-agnostic. All three ride the load's `Promise.all` behind the never-rejecting, timed read Life Lists uses (`readSavedRegion`'s shape). Only a user choice writes: a region writes its value, Everywhere deletes the key, a view or a Names choice writes its value; one write at a time in press order; best effort. Nothing is written back on a read. Slice A alone ships `familyTreeRegion` and `familyTreeNames`.

The one other write in the tab's closure is the rotate note's dismissal, made by the shared `ChartViewTip` into its own existing setting (11.10).

`PRIVACY_POLICY.md` needs no change: it lists no remembered preference today (neither `lifeListsRegion`, `targetsCounty` nor `chartTipDismissed` is named there), nothing joins `clearDerived.ts`, and no request is added.

### 8.4 The codes batch

One `transport.post('/taxonomy/codes', { species })` per distinct WORLD roster name set (`withNormalizedParents`, the JSON key of the sorted names), exactly Life Lists' effect. It feeds `<BirdName>`'s marks and the completion check, never placement. No control, view, zoom, pan, expand or find issues a request.

### 8.5 Lifecycle (NFR-12)

**The tab's own code installs no `document` or `window` listener.** Every listener it adds is on an element inside the tab: the diagram box (`wheel`, pointer events, `gesturestart` / `gesturechange` / `gestureend`, `touchmove`, `keydown`, `scroll`, `focus`, `dblclick`) and the find input (`keydown`). Its one observer, a `ResizeObserver` on the diagram box, is connected in an effect keyed on `showing`, the diagram being the current view and the box element (held as state, `ui.md` v1.0.17), and disconnected otherwise; a pending animation frame is cancelled in the same cleanup. Reduced motion is read at the moment of an action through the shipped helper, with no subscription.

**The full-screen hook the tree consumes does install page-level effects, and only while the tree is expanded** (11.9): a `document` `keydown` listener for Escape, the focus trap's `document` listeners, the body scroll lock, and (once the map build's change lands) the `data-sr-fs-open` attribute on `<html>`. They are the hook's, not this tab's code, and the hook's own rule keeps NFR-12 true: `App.tsx` wraps the tab's panel in `MapTabShowingProvider`, so the render that hides the tab is already collapsed and its effects release every one of them with no frame in which they outlive the tab. QA-84's spy therefore reads none of them with another tab showing, and a row asserts it with the tree expanded at the moment of the switch.

---

## 9. The rollup view (Slice A)

### 9.1 Data contract

`FamilyTreeRollup` receives the `FamilyModel`, the `FamilyIndex`, the sort, the open set and `codeFor`. It reads counts only from model fields (QA-33); a source scan of the view components finds no arithmetic over counts beyond formatting.

- Headline (FR-36) in a polite live region that is always rendered, with the sequence-keyed child.
- Orders and families with a roster species only (FR-37). The two numbers of "seen of world" are always text; a bar is the Designer's and is `aria-hidden`, its width from the two integers.
- A family row is a disclosure rendered through `Button` with `aria-expanded` and a name containing the family's name. **Its contents are conditionally rendered** (FR-43), so a closed family contributes no focusable and no accessibility node. Toggling never unmounts the control that has focus (QA-41).
- Every id and IDREF is built from the row's position in the rendered list plus a `useId` prefix (FR-45).
- The Not placed group is a disclosure of the same shape with the reason sentence; omitted when empty.

### 9.2 Mounted rows, and Expand all (FR-84)

At most one row per order and family in the asset (295 today, read from the asset by the guard, never typed in) plus the species of the families that are open. The largest family has 448 species. Paging inside a family is out of scope (PRD).

**Expand all opens every family and the Not placed group; Collapse all closes them; order headings stay.** One pair of `Button` controls in the toolbar acts on the view that is showing; in the table it touches only the table's open set, never the tree's expansion.

**Measured: Expand all cannot be one commit.** A throwaway harness rendered the real `BirdName` (React 19 production build, the shipped stylesheet from `frontend/dist`, the mockup's table rules) with `showSci`, `hasEntry`, a taxon code and the presence cell on every row. Playwright 1.62.1, WebKit 26.5 and Chromium 151, this Mac, 100% text, 2026-11-21. The 390 px viewport read within 3% of the 1440 px one in both engines. The favicon marks are `loading="lazy"`, so only marks near the viewport asked for an image (at most 98 did); the harness could not tell a loading favicon from a failing one, so no figure here speaks to that difference.

| Reading | WebKit, every species (11,201) | Chromium, every species | WebKit, 2,801 species | Chromium, 2,801 species |
|---|---|---|---|---|
| Expand all in one commit: React commit | 837 to 852 ms | 464 to 474 ms | 261 ms | 144 ms |
| the same, through layout | 2,660 to 2,744 ms | 965 to 991 ms | 774 ms | 283 ms |
| the same, to the next painted frames | 2,830 to 2,913 ms | 1,191 to 1,242 ms | 829 ms | 337 ms |
| Elements mounted afterwards | 194,260 (11,451 buttons, 22,402 links, 22,402 images) | the same | 54,634 | the same |
| JavaScript heap afterwards | not readable in WebKit | 391 to 415 MB | not readable | 111 MB |
| **In chunks of about 150 species, a yield between: longest block** | **126 ms** | **45 to 54 ms** | **62 ms** | **25 ms** |
| the same, total | 5.3 to 5.4 s | 2.8 to 3.0 s | 0.9 s | 0.4 s |
| In chunks of about 400: longest block, total | 136 to 140 ms, 4.1 to 4.2 s | 54 to 55 ms, 1.9 s | 122 ms, 0.8 s | 39 ms, 0.3 s |
| The largest family opened alone (448 rows; 112 in the smaller roster) | 102 to 107 ms | 46 ms | 29 ms | 12 ms |
| A Names change with every family open | 605 to 661 ms | 314 to 389 ms | 183 to 191 ms | 91 to 98 ms |
| Collapse all | 197 to 203 ms | 124 to 135 ms | 56 ms | 37 ms |

**Decision: chunked mounting with a yield between chunks.** `expandAllFamilies` adds families to the open set in taxonomic order and commits each time the chunk has reached `EXPAND_CHUNK_SPECIES = 150` species rows, then yields a macrotask before the next. A family is never split, so a commit mounts at most 150 rows plus the rest of the family that crossed the line.

- **The bound, held as a work count (QA-94):** over a roster of every species in the asset (read when the test runs), no commit of an Expand all mounts more species rows than `EXPAND_CHUNK_SPECIES` plus the roster's largest family, and the number of commits is at most the species divided by `EXPAND_CHUNK_SPECIES`, plus one. A control press between chunks is handled before the next chunk.
- **Supersession:** each Expand all owns a run token. Collapse all, a family toggle, a files epoch or any change that rebuilds the model ends the run; a second Expand all replaces it. The run is a timer chain started by the press, not an effect and not a page-level listener, and it continues if the tab is hidden.
- Focus stays on the pressed control throughout. What is announced, and when, is the design spec's; the region that announces is the tab's existing polite region.
- **A Names change with many rows open** re-renders every mounted `BirdName`. The control itself updates at once and the rows update in a React transition, so the press is never the block.
- **What stays true after Expand all:** every species row is mounted, as the table's role as the tree's non-graphical equivalent requires (NFR-07), so the mounted total is the roster's. This is the residual Life Lists' "Show all" already carries.

Declined, each with its measurement or its reason:

- **One commit:** the table above.
- **Windowing the rows against the page scroll:** it would take the unmounted rows out of the accessibility tree, which defeats the table's purpose, and the phone tier's table has no scroller of its own to window against (9.4).
- **A cap on how many families Expand all opens:** FR-84 says every family.
- **`content-visibility: auto` on each open family's block:** measured and kept as the next lever, not adopted. At every species it cut the chunked run to 2.7 s with a 90 ms longest block in WebKit and to 0.7 s with 19 ms in Chromium, and Chromium's heap to 169 MB. Its cost is that the page's height becomes an estimate (177,681 px against the real 739,806 px in the same run), so the scrollbar and any scroll position move as families come into view, and WebKit before 18 ignores it.

**Reversal:** a live report that Expand all is slow or unsteady on a real backup, or the Engineer's reading of the built table at the roster of the saved backup above 150 ms for the longest block in WebKit; then `content-visibility` with a measured intrinsic size; then paging inside a family, which is a PRD change.

### 9.3 Species rows and the media cell

Each species renders `<BirdName commonName={leaf.name} scientificName={leaf.sci} hasEntry taxonCode={codeFor(leaf.name)} onOpenSpecies={onOpenSpecies} />` in every Names state, with two props set by the state (FR-81):

| Names | `showSci` | `lead` | What the link reads | Second line |
|---|---|---|---|---|
| Both | true | (default) | the common name | the scientific name |
| Common | false | (default) | the common name | none |
| Scientific | false | `'scientific'` | the scientific name, italic | none |

`codeFor` reads the codes map through `Object.hasOwn`.

**The one change to `<BirdName>`: an optional prop `lead?: 'common' | 'scientific'`, default `'common'`.** With `lead="scientific"` and a non-empty `scientificName`, the text of the name (the link when `hasEntry`, the plain span otherwise) is the scientific name, that element also takes the class `sr-birdname-lead-sci` (one new rule, `font-style: italic`), and no second line is drawn whatever `showSci` says. Nothing else moves: `onOpenSpecies` still receives `commonName`; `<SpeciesLinks>` still receives `commonName`, so both marks keep their hrefs and their accessible names; `hasEntry`, `taxonCode`, `size` and `trailing` behave as before; `breakAfterSlash` applies to a common name only. With an empty `scientificName` the prop does nothing and the common name shows (FR-79's fallback for an unplaced species).

- With the prop absent or `'common'` the component takes its existing path and emits the existing markup, class string included. A golden of the default output over the prop matrix is captured before the change, the existing `BirdName` suites run unmodified, and the markup of other tabs' names is compared before and after (QA-91).
- Declined: passing the scientific name as `commonName` (it would open the wrong Species Detail key and misname both marks); a hand-built name beside hand-placed marks (the bird-names rule forbids it); a general `label` node prop (wider than the need, and it would let a caller render any text as a bird's name).
- `.claude/rules/bird-names.md` stays true and gains the prop in its Props list in the same change (section 18).

The presence cell is Life Lists' own. `MediaCell` is module-private in `LifeListsRows.tsx`, so it moves verbatim to `components/MediaPresenceCell.tsx` (props `{ media: MediaPresence }`, markup, classes and `mediaLabel` unchanged) and `LifeListsRows.tsx` imports it back. A markup golden of Life Lists' rows is captured from the unmodified file in a commit of its own before the move (the `WeatherDistRow.golden.test.tsx` precedent). This tab passes presence from `leaf.kinds`, which is in scope (FR-22), where Life Lists passes the species' media anywhere; Help says how media is scoped.

### 9.4 Names in the table, and the phone tier (FR-37, FR-86)

- Order headings, family rows and genus lines read their names through `nameOf` (6.5): both names in Both, one otherwise, a family's scientific name upright and a genus's italic. A family row's disclosure name contains the family's leading name in the current state. The Not placed group's species follow the same table as 9.3.
- **The table has no vertical scroller of its own on any tier (FR-86, D-17, D-20; design spec 11).** It flows with the page: no element between the tab's panel and the rows declares a vertical overflow that scrolls or a height cap, so the page is the only thing a vertical swipe moves. The list is an inline-size container (`container-type: inline-size`), so its rows stack when it is narrower than the spec's 44em whatever the window is; that containment makes the list the containing block for the visually hidden spans inside its rows, and nothing else in its subtree is positioned. `familyTreeCss.test.ts` holds both as a scan of the tab's rules, and the real-engine probe reads scroll height against client height with every family open (QA-96).

---

## 10. Links: `lib/familyTreeLinks.ts`

```ts
export const FAMILY_CODE_RE = /^[a-z]{2,12}[0-9]{1,3}$/
export const BOW_FAMILY_LINK_VERIFIED = false   // Open Question 1
export const ML_FAMILY_LINK_VERIFIED = false    // Open Question 2
export function bowFamilyHref(code: string, verified = BOW_FAMILY_LINK_VERIFIED): string | null
export function mlFamilyHref(code: string, mediaType: MediaType, userId: string | null, verified = ML_FAMILY_LINK_VERIFIED): string | null
```

- Each builder returns `null` unless its flag is true AND the code passes `FAMILY_CODE_RE`. `bowFamilyHref` builds on the host `SpeciesLinks.tsx` already links, with the code through `encodeURIComponent`; `mlFamilyHref` calls the shipped `mlCatalogLink` on `ML_CATALOG_BASE`.
- A `null` renders the family name as plain text and no control in its place (FR-47). A non-null renders through `OutboundLink`, which owns the click dispatch, with the accessible name from the copy module.
- Both flags ship `false`. Neither shape could be verified here: Cornell's pages refuse scripts, so each needs a person's look in a browser at two or three families. Turning a flag on is one constant plus the two published-claims sentences, after that look.
- The `verified` parameter exists so the suite and the `tauriOpener.ts` runtime row exercise the verified branch while the shipped constant is false. `newTabLinkDispatch.test.ts` passes either way, since the anchor is `OutboundLink`.
- Orders and genera get no builder (FR-49).
- No CSP or `http:allow-fetch` entry: a link is opened through the opener, never loaded by the page or fetched by a service (confirmed against `tauriCsp.test.ts` and `tauriHttpScope.test.ts`, which derive from call sites this feature does not add).

---

## 11. The diagram (Slice B)

### 11.1 Decision: plain DOM with layout-driven sizing, in a native scroll box

- **Labels are HTML elements, absolutely positioned on a plane** inside one `overflow: auto` box. Their text is real text at the app's body size at every zoom.
- **Zoom is one number, `k`, the pixels given to one leaf slot.** A zoom step recomputes positions and the plane's size from `k`. Nothing is scaled: no CSS `zoom`, no `transform: scale`, no `scale`, no SVG `viewBox` scaling of text.
- **Pan is the box's own native scrolling.** Touch drag, wheel, trackpad and scroll chaining are the engine's; a mouse drag writes `scrollLeft` / `scrollTop` under pointer capture.
- **Edges are one `<path>` in one `<svg>` underlay** whose box covers only the drawn window, in plane coordinates.
- **What is mounted is a window with level of detail** (11.4), so the mounted count does not depend on the roster.
- **No library.** The layout is a slot assignment and a midpoint (11.3).

### 11.2 The measurement behind it

A throwaway probe (vanilla DOM, a keyed reconcile as the lower bound of what React will do) drew a roster of EVERY species in the prototype asset, fully expanded: 11,201 leaves, 13,875 nodes, a 600 px box, half a box of overscan each side. Playwright 1.62.1, WebKit 26.5 and Chromium 151, this Mac, 2026-11-21.

| Reading | WebKit, 100% text | WebKit, 200% | Chromium, 100% | Chromium, 200% |
|---|---|---|---|---|
| Plane height at full zoom (`scrollHeight`, equal to expected) | 268,824 px | 537,648 px | 268,824 px | 537,648 px |
| Mounted elements, most over fit, every zoom step and a full pan sweep at four zooms | 91 | 53 | 91 | 53 |
| Script plus forced layout, whole-tree fit | 3 ms | 2 ms | 7.1 ms | 6.1 ms |
| The same, worst zoom step (28 to 31 steps, fit to full) | 1 ms | 1 ms | 1.4 ms | 0.9 ms |
| The same, worst pan step (897 to 1,793 steps) | 5 ms | 3 ms | 5.2 ms | 4.7 ms |
| Last species at the far end: rendered top minus computed top | 0 px | 0 px | 0 px | 0 px |
| Leaf label computed font size | 14 px | 28 px | 14 px | 28 px |
| Zoom about a point: the slot under the anchor, before and after | 8339.583, 8339.583 | 4169.792, 4169.792 | equal | equal |
| Page `scrollWidth` against the viewport at full zoom | 1100, 1100 | equal | equal | equal |
| Plain wheel over the box | box scrolls 400, page 0 | same | same | same |
| Plain wheel with the box at its end | page scrolls 400 | same | same | same |
| Wheel with Ctrl held | `ctrlKey` true, cancelable, visual viewport scale 1 after `preventDefault` | same | same | same |
| Mouse drag, five steps | `scrollTop` equals start minus the pointer delta at every step; unchanged 400 ms after release | same | same | same |

WebKit's `performance.now` resolves to 1 ms, so its small figures are upper bounds.

**Controls, the two mechanisms `ui.md` records as unreliable, measured on the same page** (a 20 px row of 14 px text, the mechanism at 0.5):

| | CSS `zoom: 0.5` | `transform: scale(0.5)` |
|---|---|---|
| Row's rendered height | 10 px, both engines | 10 px, both engines |
| The scroll box's `scrollHeight` / `scrollWidth` | follows (403 / 480 in WebKit, 400 / 480 in Chromium) | does NOT follow: 800 / 960, twice the drawn content, in both engines |
| `position: sticky` under it | holds | fails in both engines (the cell sits 99 px outside) |
| Computed font size of the 14 px text | **18 px in WebKit**, 14 px in Chromium | 14 px in both, while drawn at 7 px |

The font-size row is at 100% text. At 200% text, where the zoomed text is still 14 px, WebKit reads the declared 28 px.

Two facts follow. Under `zoom`, WebKit reports the 14 px text as 18 px, which is 9 px after the zoom: the text is held at a floor and does not shrink with its box. That is the engine behavior under the 0.5.64 report ("the zoom % updated but the matrix didn't visibly shrink", `pipeline/mobile-app/decisions.md`), now with a mechanism. Under `transform`, layout does not follow and sticky breaks, the two defects that build fixed by hand before abandoning it. Neither is on this design's path.

**Limits of the measurement.** Playwright's WebKit is desktop WebKit, not the iOS WKWebView or the Android WebView. The probe is vanilla DOM, not the built app. The primitives the design rests on (absolute positioning, native overflow scrolling, a `scrollTop` write, one SVG path) are ordinary on every engine, which is the reason for choosing them, but the built app's figures are the Engineer's to take (section 22).

**Re-measured after the design review, on the approved mockup's own code.** The mockup implements this section's design (DOM labels, one zoom number, native scroll, an SVG underlay, level of detail) with the design's real label markup, its two forms and the Names control. A scratch copy of `design.html` had its roster swapped for every species in the asset and its genus names for the full derived set; nothing else was changed, and the mockup's own `render`, `zoomStep`, `fit`, `expandAll`, `enterFs` and `exitFs` were driven. Its Include Escapees default leaves out its two demo escapees, so the tree is 11,199 leaves (13,873 slots in the outline form). Same engines, same Mac, 2026-11-21; a 1440 px wide window, and the mockup's 390 px phone frame.

| Box, form, text | Tree items mounted, most over fit, every zoom step and a pan sweep at each zoom | Elements under the plane, most | Worst zoom step, WebKit / Chromium | Pan step, median and worst, WebKit / Chromium |
|---|---|---|---|---|
| Desktop in the page, 424 px box, columns, 100% | 129 | 845 | 5 ms / 2.7 ms | 5 and 13 ms / 1.7 and 12.1 ms |
| Desktop full screen, 749 px box, columns, 100% | **187** | **1,354** | 10 ms / 3.6 ms | 7 and 43 ms / 2.6 and 11.5 ms |
| Phone full screen, 548 px box, outline, 100% | 58 (57 in Chromium) | 501 | 8 ms / 3.4 ms | 3 and 9 ms / 1 and 8.9 ms |
| Desktop in the page, 558 px box, outline, 200% | 45 | 366 | 6 ms / 2.3 ms | 2 and 8 ms / 0.6 and 7.5 ms |
| Desktop full screen, 465 px box, outline, 200% | 48 | 395 | 3 ms / 1.1 ms | 1 and 15 ms / 0.5 and 6.7 ms |
| Phone full screen, 361 px box, outline, 200% | 42 | 342 | 5 ms / 1.7 ms | 1 and 6 ms / 0.5 and 6.1 ms |

- **The Names state does not change what is mounted.** Each row above read the same item count in Both and in Common (187 and 187, 129 and 129, 58 and 58); a two-line label is one item with one more child, so the element count moved by at most 20 (1,354 against 1,334).
- **Both makes the plane taller at full zoom, by the ratio of the two full-zoom pitches:** columns at 100%, 403,184 px against 291,194 px (1.38 times); outline on the phone at 100%, 610,432 against 471,702 (1.29 times); outline at 200% on desktop, 1,109,880 against 776,928 (1.43 times); outline at 200% on the phone, **1,220,864** against 943,404 (1.29 times). In rows per screen that is 23% to 30% fewer.
- **Far end:** at every one of those plane heights, in both engines, the last species' label sat within 0.1 px of its computed position and inside the box, its name at 13.5 px (27 px at 200%) and its second line at 11.5 px (23 px).
- **A full expand of the tree** (the toolbar's Expand all in the tree view) took at most 53 ms in WebKit and 15 ms in Chromium.
- **The phone's still** (the mockup's in-page box on its 390 px frame): 38 items and 310 elements at 100%, 23 and 190 at 200%; 48 and 38 items after a full expand in full screen and a return; computed `overflow-y: hidden`; `inert` true; no focusable descendant.
- **The phone's round trip** (zoom to full, scroll to the far end, select the last species, leave full screen, enter again): zoom, the top slot, the expansion and the active node were identical before and after, in both engines, in all four combinations of Names and text size.
- **The desktop round trip is where the mockup does not hold** (the approved file as committed, its own demo roster, a family collapsed, a leaf selected, one zoom step out, scrolled to the middle, then enter and exit):

| Text | Form in the page, then in full screen | Expansion, active node and zoom kept entering | Place after the round trip |
|---|---|---|---|
| 100% | columns, columns | yes | moved, 2,644 px to 2,990 px |
| 125% | columns, columns | yes | moved, 3,370 px to 3,802 px |
| 150% | **outline, columns** (the page box is 1,066 px and 54rem is 1,296 px; the full-screen box is 1,440 px) | **no: expansion 20 to 262, active node cleared, zoom 0.667 to 1** | reset to the top; the state is not restored on exit either |
| 200% | outline, outline | yes | kept, 2,061 px |

  The same in WebKit and Chromium. Two causes, both the mockup's own: it starts the tree over whenever the form changes, and on every relayout it scrolls to the active node. Section 11.3's view state removes both.

### 11.3 `lib/familyTreeLayout.ts`

Pure. No DOM, no React.

- **`buildDrawnTree(model, index, expansion)`**: the model's orders, families, genera and species as an indexed array of nodes `{ level, ref, parent, firstSlot, slots, firstChild, childCount }`. A collapsed node is one slot; an expanded node's slots are the sum of its children's. Expansion is three `Set`s of asset indices (orders, families, genera), so it is keyed on nothing from a user file and survives a taxon leaving the model and returning (FR-58). `QA-52` compares this node data to the model.
- **`project(tree, k, form, metrics)`**: plane size and each node's position from `k` and the form's depth mapping. `metrics` carries the root font size and the label pitches in pixels, read from the box when it is measured, so every length follows the in-app text scale. The contract is that the leaf axis is `slot * k` and the depth mapping is monotone.
- **`fitView(tree, box, form, metrics)`**, **`zoomAt(view, factor, anchor)`** (keeps the slot under the anchor fixed, the measured rule) and **`kMax(form, names, metrics)`**: the full-zoom pitch. `k` is clamped to `[k of fit, kMax]` inside `zoomAt`.

**The form, as the design settled it (Open Question 9).** Two forms of one left-to-right tree, chosen by the box's own width: **columns** (a column per level) when the box is at least `COLUMNS_MIN_REM = 54` rem wide, and **outline** (indented, one column) below that. `formFor(boxWidth, metrics)` is the one place the threshold lives. In the outline an open branch takes a slot of its own above its children, so the same expansion has more slots there (13,873 against 11,199 at the measured roster).

**The pitches, and what Both changes (FR-78, D-23).** Three pitches in rem, the design spec's values, carried in `metrics` and never typed into the cull:

| Pitch | What it is | Columns | Outline |
|---|---|---|---|
| `line` | the least extent at which a node gets a label of one line; the level-of-detail threshold of 11.4 | 1.125 | 1.375 |
| `twoLine` | the room a label needs to take its second line | 1.875 | 2.125 |
| `full(names)` | the pitch of one leaf at full zoom, `kMax` | 1.625, and **2.25 in Both** (1.875 and 2.5 on the still tier) | 1.75, and **2.5 in Both** (2.125 and 2.75 on the still tier) |

Only `full` depends on the Names state. In Both, full zoom gives every leaf two lines, and a label anywhere takes its second line exactly where the room it owns holds `twoLine`; zoomed out it shows its leading name alone. So Both costs height at full zoom (the measured 1.29 to 1.43 times) and changes neither the threshold nor the mounted count.

**The view is two values, and a relayout keeps both (FR-64, FR-88).**

```ts
export interface TreeView {
  /** k / kMax: 1 is full zoom. Held as a fraction so a change of Names, form or text scale keeps the same relative zoom. */
  readonly zoom: number
  /** True while the view sits at the whole-tree fit, so it stays at fit when the box changes. */
  readonly atFit: boolean
  /** The node at the top of the box and how far its top sits from the box's top, in pixels. null is the top of the tree. */
  readonly anchor: { readonly level: 0 | 1 | 2 | 3; readonly ref: number; readonly offset: number } | null
}
```

- `ref` is the taxon's asset index (an order, family or genus index, a species' sequence), so the anchor means the same node in either form and after any filter. Slots are never stored: they differ between the two forms.
- **A relayout** (the box resized, full screen entered or left, the form changed, Names changed, the text scale changed, the model rebuilt) recomputes `k` from `zoom` (or from the fit when `atFit`), then writes the scroll offset that puts the anchor node back at its offset. If the anchor is no longer drawn, its nearest drawn ancestor is used, then the top.
- **A relayout never scrolls to the active node and never changes expansion or the active node.** The moves that may scroll the tree are the explicit ones (design spec 9.6): a keyboard move, a find reveal, choosing an ancestor in the readout, a press on a node, Fit, Reset, Expand all, Collapse all, Focus, a press on a count, and a change that removes the active node from the model. That is the difference from the mockup measured in 11.2, and it is what makes the round trip of QA-98 exact in both directions at every text size.
- **An explicit move is applied after the readout has taken its height** (design spec 9.6). In full screen the readout's height comes out of the box, and a new selection can change the readout's form and height. So a move is recorded with the selection as a pending move and resolved in a layout effect after the commit that renders the readout, against the box as it is then; the relayout the box's resize triggers afterwards keeps the anchor that move set. The readout's height depends on the kind of active node and on the panel, never on the scroll offset, so there is no loop.
- The scroll handler updates `anchor` (throttled to a frame); zoom controls update `zoom` and `atFit`. Both are session state in the tab (8.1).
- **`fitView` is the true fit, with no floor** (design spec 9.5, which supersedes this document's earlier line that it returned the larger of the true fit and one line per order). The pitch is the box's usable height over the drawn tree's slots, from the top, so every drawn node is inside the box (QA-55 as written). Level of detail applies to the orders as to any siblings (11.4): where the orders do not each get a line, the larger keep their names and each run of smaller ones is one count.
- **`stillView(tree, box, form, metrics)` is the still's own derived view** (11.10): from the top, at the larger of the true-fit pitch and the pitch that gives the orders one `line` each on average (`orderCount * line / slots`). It is the only place that floor exists, it is never written to the `TreeView`, and the tree at that pitch may be taller than the still's box.
- **Positions are geometry from data** (design spec 16): the plane's size and each mark's place are written on the plane's own elements as inline `top`, `left`, `width` and `height`, or as custom properties the stylesheet reads. The keys are always present and none is a shorthand (`ui.md`, v1.0.35); no responsive rule lives in an inline style; QA-81's scan for inline widths exempts the plane and its marks by name and nothing else.
- **`cullTree(tree, view, box, form, metrics, active)`**: 11.4.
- **`neighbor(tree, node, direction)`**: the keyboard order (11.6).

### 11.4 Level of detail, and the mounted bound (NFR-04)

`cullTree` walks from the orders, skipping any node whose slot span misses the window (the box plus half a box each side):

- A node whose extent on the leaf axis is at least one label line is drawn with its label, placed at the middle of the VISIBLE part of its span (computed, not CSS sticky), and its children are visited.
- Siblings smaller than a label line are handled a run at a time, between two siblings that keep their names (design spec 9.4): the run is named if its gap has a line for each of them, drawn as ONE count if the gap has a line at all (real text stating how many taxa and species it stands for), and as a dot on its edge, in the underlay's path, if it has none. This holds at every level, the orders included.
- The active node and its ancestors are always emitted by name, whatever their size or position, so `aria-activedescendant` always resolves and the lineage is always drawn.

**The bound is a clamp inside the function, not a property of the data:** `DIAGRAM_MOUNTED_MAX = 600`. If a pass would emit more, it is re-run with the label pitch doubled, at most `DIAGRAM_COARSEN_MAX = 4` times, and then truncated at the cap with the active node kept. This holds for any form and any box. Measured need over the full-asset roster: 91 (100% text) and 53 (200%) in a 600 px box.

**The unit, and the re-measure with the design's labels.** The clamp counts MOUNTED MARKS: one per node (a `role="treeitem"`) and one per count (a pill the design spec makes not a tree item), whatever each holds inside; a dot is part of the edge path and is not a mark. Where this document reports a measured count of "tree items" or "items", it means these marks. On the mockup's own cull over every species the most was **187 items** (1,354 elements) in the 749 px full-screen box at 100% text, 129 in the 424 px page box, 58 in the phone's full-screen outline, and 42 to 48 at 200% (11.2). The count follows the box's height over the `line` pitch (about one item per 4 px of box at 100% text) and is the same in Both and in Common, so the 600 clamp holds with two-line labels and is first reached by a box about 2,400 px tall at 100% text. Full screen makes the box as tall as the window; the clamp's coarsening is what a taller window than that gets.

The mockup's walk lays out every child of each open node it visits before it tests the window, so its work per cull is the children of the visited nodes, bounded by the asset's largest sibling counts and not by the window. The Engineer's walk may do the same or search the slot range; the guard holds the mounted count, and section 22 holds the time.

`familyTreeLayout.test.ts` builds the roster from every species in the committed asset (read when the test runs) and asserts the cap at arrival, after a full expand, and over a scripted zoom and pan sweep; a non-vacuity leg with the level-of-detail rule disabled must exceed the cap; find reaches the last species in sequence.

FR-55 is held over the drawn tree's node data. Every species is reachable by expanding, zooming or find; what is mounted at one zoom is a window of it.

### 11.5 Zoom and pan inputs (FR-60 to FR-64)

| Input | Mechanism |
|---|---|
| Zoom in, Zoom out, Fit, Reset | `Button` primitives; `zoomAt` about the box's center, or `fitView` |
| `+`, `=`, `-`, `0` | `keydown` on the tree element, so they act only with focus inside it (FR-61) |
| Wheel with Ctrl or Cmd; a trackpad pinch in Chromium and WebView2 (which arrives as a Ctrl wheel) | a non-passive `wheel` listener added with `addEventListener` on the box (React's own `onWheel` is passive); `preventDefault` ONLY when `ctrlKey` or `metaKey` is set |
| Plain wheel | untouched: the box scrolls natively and chains to the page at its end, which is Open Question 10's default and was measured in both engines |
| Trackpad pinch in WebKit (the Mac app, Safari, an iPad with a trackpad) | `gesturestart` / `gesturechange` / `gestureend` on the box, `preventDefault`, `scale` relative to the gesture's start. `GestureEvent` exists in WebKit 26.5 and not in Chromium |
| Two-finger pinch on a touch screen | `touch-action: pan-x pan-y` on the box, so a pinch that starts inside never zooms the page and one-finger pan stays native; two tracked pointers drive `zoomAt` about their midpoint; a non-passive `touchmove` calls `preventDefault` only while two touches are down. The viewport meta is not edited (FR-62) |
| Mouse drag | pointer capture on a primary-button mouse `pointerdown`; `scrollLeft` and `scrollTop` set from the start position minus the pointer delta on every move; released on `pointerup`, `pointercancel`, `lostpointercapture`; no threshold, easing or motion after release; no `scroll-snap` anywhere (`ui.md` v1.0.29) |
| Bring the active node into view | a `scrollTop` / `scrollLeft` write; `behavior` is `'auto'` when reduced motion matches at that moment |
| A double-click on empty space of the plane | one zoom step in about the pointer (design spec 9.5); a `dblclick` listener on the box; the Zoom in button is the same action for every other input |
| A press on a count | zooms to its run, resolved by the container from the pressed element's index attribute; a count is not a tree item and has no handler of its own; the keyboard reaches the same place by the arrow keys and Focus (design spec 9.4) |
| Full screen | the toolbar's toggle on every tier, a `Button` with `aria-pressed`; on the still tier also the shared `FsOpenRow` beneath the host and a press on the still, both through `fs.open()` (11.9, 11.10) |
| A press or focus on a box only partly in view, outside full screen and off the still tier | a capture-phase `pointerdown` and a `focus` listener on the box call `scrollIntoView({ block: 'nearest' })` on the box before anything else happens (FR-88). No page listener |

Zoom and pan change only `k` and the scroll offsets (FR-64). A filter change rebuilds the drawn tree; the view is kept when the active node still exists, otherwise `fitView`.

The box has a bounded height of its own (the design spec's value, its own scrollport, **never taller than the window**, so the whole box can always be brought into view) and `contain: layout paint`, so nothing it draws extends the page (NFR-09). The column header of the columns form is `position: sticky` inside the box, which holds because nothing above it is transformed or zoomed (11.2). The underlay's box is clamped to the plane: unclamped, it extended the scroll area in the probe.

### 11.6 Keyboard and assistive technology (FR-68 to FR-70, Open Question 12's default)

**The tree is one tab stop, in the page and in full screen.** In full screen the focus trap's root is the host (11.9), which holds Find, the toolbar, the tree and the readout: Tab cycles through those and the tree is still one stop among them. On the still tier's still the tree is no stop at all (11.10).

One element, `role="tree"`, carries the single literal `tabIndex={0}`, the handlers and `aria-activedescendant`. Mounted nodes are `div role="treeitem"` with `aria-level`, `aria-expanded` where they can expand, `aria-setsize` and `aria-posinset` from the data (siblings are not all mounted), an id of `useId` prefix plus the drawn-tree index, and **no `tabIndex`, no anchor and no handler of their own**. A pointer press is resolved by the container from the pressed element's index attribute. Arrow keys call `neighbor`; Enter or Space expands, collapses or, on a leaf, moves focus to the readout's name. The tree's `aria-describedby` names a sentence saying the rollup holds the same information as a list. The active node's indicator is the Designer's within FR-70; the box's scroll padding keeps it clear of the toolbar.

### 11.7 `<BirdName>` on leaves (Open Question 13, decided: the readout)

A leaf's label is plain text in its tree item. **The active leaf's readout**, a region after the tree in DOM order with no live semantics, renders `<BirdName>` with FR-42's props and the media presence cell; for an active order or family it shows the model's figures and the family link when one is built. The mounted bound would allow `<BirdName>` on leaves; the keyboard contract does not: an `aria-activedescendant` item holds no focusable content and no link (`ui.md` v1.0.21), and `<BirdName>` renders a `Button` and two anchors, each a tab stop that would grow with the window. The rollup renders every species through `<BirdName>`. The exception is written into `.claude/rules/bird-names.md` in the same change (section 18).

The readout's controls are tab stops only while a node is active, and how many is fixed by the kind of node, never by the roster. The approved design gives the readout more than the name and its two marks (its ancestors as buttons that select them, and expand and focus actions), so the count is the design spec's, stated per kind and per readout form in its section 9.9 (a species six, a genus four, a family three as shipped, an order two; fewer in the short and least forms of 11.9); this document no longer says "at most three". FR-68's parenthesis names only the toolbar and the tree; the Planner's amendment is in the hand-back. QA-65 compares a ten-species roster with the full-asset roster at the same active-node kind.

The leaf's own label follows the Names control through `nameOf` (6.5): two lines in Both where the room holds them, the scientific name italic. The readout shows both names in every state.

### 11.8 Platform gate (FR-71)

No gate is designed in and no predicate is added. If the Engineer's measurement of the built app on an engine fails NFR-02, NFR-04 or FR-60 to FR-64, the predicate is `showFamilyTreeDiagram()` in `lib/platformGates.ts`, read only by the tab to decide whether the view control is drawn, with the measurement and reversal in `decisions.md`. Where it withholds the diagram, the tab opens on the table whatever is saved (FR-53).

### 11.9 Full screen: the maps' mechanism, consumed as a fifth host (FR-88, FR-89, D-19)

This reverses the first draft's "fullscreen is out of scope". The tree does not build a full screen. It calls the app's shared hook and takes the app's shared classes, and it consumes them exactly as the companion map build lands them. That build's worktree was not read for this document; its contract below is as its session relayed it through the Guide on 2026-11-21, and the parts that exist today were read from `lib/useMapFullscreen.ts` on `main` at `7cf126a6`.

**The contract consumed.**

| | On `main` today | Added by the map build, on `main` only once its branch lands |
|---|---|---|
| Call | `useMapFullscreen({ containerRef, baseClass, active?, resetKey? })` | unchanged. If the landed hook cannot read the tier itself under the entry-chunk guard, the host passes it in as an option and the tab passes `useIsPhone()`; the returned object is the same either way |
| Returned | `expanded`, `toggle`, `collapse`, `className`, `registerToggle` | `stillTier` (the `(max-width: 640px)` query matches), `still` (`stillTier && !expanded`), `open()` (an idempotent expand), `registerOpener(el)`, `hostClassName` |
| Other exports | `MAP_FS_PANEL_CLASS`, `mapFullscreenClass`, `MapFullscreenProvider`, `useMapFullscreenContext`, `MapTabShowingProvider` | nothing renamed |
| Stylesheet | `.sr-map-fs-panel`: fixed, `inset: 0`, `100dvh`, `z-index: 1200`, opaque ground, no border or radius, `overflow: hidden`, top and side safe-area insets on iOS and Android | `<html data-sr-fs-open>` while any consumer is expanded (counted at module scope), under which `.sr-navbar` is `visibility: hidden`; no width test in script. The opener register `.sr-fs-open-row`, `.sr-fs-open-btn`, `.sr-fs-open-note` |
| Component | | `components/ui/FsOpenRow.tsx`: `<FsOpenRow fs={fs} label note noteHidden? />`. It renders nothing unless `fs.stillTier`, registers through `fs.registerOpener` and calls `fs.open` |
| Behavior | The trap rooted at the container with containment; Escape on a bubble-phase `document` listener armed only while expanded; the body scroll lock; collapse when `active` drops, when `resetKey` changes, and when the tab stops showing | On opening, focus moves to the registered toggle if it was outside the container. After a user's exit (the toggle, Escape, `collapse()`), focus returns to the registered opener, else the toggle, and the page's scroll offset recorded at the lock is restored |

**How the tree uses it.**

```ts
const fs = useMapFullscreen({ containerRef: hostRef, baseClass: 'sr-ft-host', active })
```

- **The host** is the tab's own container that holds Find and the toolbar, the tree's box and the readout. It carries `className={fs.className}`: a class swap on that one element, never a portal and never a remount. The tree draws its own still (11.10), so it uses `className`, not `hostClassName`. The view control, the Names control and the filters sit outside the host and stay in the page.
- **The opener is `<FsOpenRow fs={fs} label note />`, a sibling directly AFTER the host**, outside the box that expands and mounted while it is expanded, as the shared register requires. The label ("Open the tree") and the helper line come from `familyTreeCopy.ts`. It replaces the mockup's own open row and button classes, which are not built.
- **The toolbar's toggle** is on every tier: a `Button` with `ref={fs.registerToggle}`, `onClick={fs.toggle}`, `aria-pressed`, and the maps' `Maximize2` and `Minimize2` glyphs. While expanded on the still tier it is the shared Exit form: a pill with the visible word "Exit", the `Minimize2` glyph and the accessible name "Exit fullscreen". It stays in the tree's own toolbar. A row holds its accessible names equal to the maps' toggle's. **On the still tier it is rendered first in the toolbar's DOM**, so it leads the row by document order and Tab meets it first. The design spec draws that lead with `order: -1`, which is not used: `order` moves a box without moving its place in the tab order (`ui.md`, v0.5.80). The toggle is not rendered at all while `fs.still`, so nothing moves under the user.
- **`active`** is true only while the phase is ready, the view is the tree and the roster is not empty, so a view switch, an empty filter or a reload collapses and releases by the hook's own rule.
- **`App.tsx`** wraps the tab's panel in `<MapTabShowingProvider value={activeTab === 'family-tree'}>`, beside passing the same expression as the tab's `showing` prop. `paletteLocationsRoute.test.ts` fails an unwrapped caller.
- The hook is called in `FamilyTreeTab.tsx`, which owns the host.

**What the tree adds, and what it does not.**

| The hook and the shared classes supply; nothing here rebuilds them | The tree adds |
|---|---|
| Expanded state; the trap; Escape; the scroll lock; the collapse on leaving the tab | `active`, and the two controls that toggle it |
| Focus on the way in (to the toggle, when focus was outside the host) and on the way out (to the opener, else the toggle) | Nothing. The design spec takes the hook's default (its section 10.4) and this build adds no focus effect of its own |
| The page's scroll offset restored after an exit | Nothing |
| The bottom bar hidden while expanded; the panel's level | **Nothing: no `z-index` for the full-screen state, no rule or line that names the bar or `data-sr-fs-open` (QA-99)** |
| The panel's geometry, ground and top and side insets | The inside of the panel, in the tree's own rules under the compound selector `.sr-ft-host.sr-map-fs-panel`: a flex column, the toolbar and the readout at their own height, the box taking the rest with `min-height: 0`; and the readout's own bottom inset under `.sr-ios-app` with its `.sr-android-app` twin, since the bar is gone and the readout reaches the home indicator |
| The source order that lets the shared class win over a host's base class | Not relied on. Every property the shared class sets (`position`, `inset`, `height`, `z-index`, `background`, `border`, `border-radius`, `overflow`) is declared on the host only under `.sr-ft-host:not(.sr-map-fs-panel)`, or under the compound selector for the expanded state, so where the tree's block sits in the stylesheet cannot decide the panel |
| Escape as the outer layer | Find's list consumes Escape at the element while it is open, so one press closes the list and the next leaves full screen (FR-88) |

**Inside the panel the tree's box is the only element that scrolls (FR-88, QA-98; settled by the design spec, section 10.3).** The windowing reads the new box through the same `ResizeObserver` (8.5): the class swap resizes the box, the observer fires, and the relayout of 11.3 keeps zoom and place. Expansion and the active node are tab state and are not touched. The toolbar and the readout never scroll in either axis:

- **The readout sheds parts by the panel's height, in the outline form.** The expanded host is a size container (`container-type: size`, declared only under `.sr-ft-host.sr-map-fs-panel`, because a size container needs a definite height and the host in the page has none). Under it, in the outline form: every part at 40rem of panel or more; identity, figures and actions from 25rem; identity alone below. A dropped part is `display: none`, so it leaves the tab order and the accessibility tree with no script, and the tab-stop counts per form are the design spec's (its section 9.9). The readout is `overflow: hidden`: in the rare case a wrapped name outgrows its share it is cut, never scrolled. In the columns form it is the page's three-column band.
- **The tools row is six cells in one row that neither wraps nor scrolls.** The row is an inline-size container, and its captions are dropped under 19.5rem of row.
- **Measured, WebKit 26.5 and Chromium 151, 2026-11-21** (a scratch page with the panel's rules, the root font size scaled as the in-app text scale scales it): a `rem` length in a container query follows the scaled root, which a media query's does not. A 390 by 844 window read 52.75rem, 42.2rem, 35.17rem and 26.38rem of panel at 100%, 125%, 150% and 200% text, so Full, Full, Short, Short; 320 by 568 read 35.5rem, 28.4rem, 23.67rem and 17.75rem, so Short, Short, Least, Least. Those are the design spec's readings of the mockup, in both engines. The tools row showed its captions at 19.5rem and dropped them below. With the containment on, the box's sticky header still held and Find's absolutely positioned list still sat under its field; in the page, with no size container, every part showed.
- **Containment, argued at the declaration (`ui.md`, v1.0.23).** `container-type: size` implies layout and size containment, which makes the host the containing block for positioned descendants and a stacking context. The expanded host already is both (it is fixed, with a level); no descendant is `position: fixed`; and every absolutely positioned descendant (Find's list, the plane's marks, the focus frame) has a nearer positioned ancestor. The tools row's container holds only its cells.
- **The footer lines** (the Not placed count with its way to the table, and the not-single-species line, FR-59) sit outside the host, after the opener row, so they are never inside the panel and the opener stays the host's next sibling, as the shared register requires.

**Guards.** `familyTreeCss.test.ts`: the shared class name is read from `MAP_FS_PANEL_CLASS`, never typed; the host's base rule sets none of the eight shared properties outside the two forms above; no rule in the tree's block that mentions the shared class declares `z-index`; no tree rule or source line names `.sr-navbar` or `data-sr-fs-open`; the tree's block declares none of the `.sr-fs-open-*` classes. A contract row in the tab's suite asserts every member of the hook's return the tree uses, so a change of shape is red here, not silent. A row switches tabs with the tree expanded and reads `expanded` false, the body's overflow restored, the `<html>` attribute gone and no `document` listener left. This build's diff does not touch `lib/useMapFullscreen.ts`, `components/ui/FsOpenRow.tsx`, the `.sr-map-fs-panel` rules or the `.sr-fs-open-*` rules (QA-99).

**The dependency, and the order it forces (D-18, D-19, FR-89, FR-90).**

- The additions in the table's right-hand column land in the map build's branch first and reach this checkout only when that branch is on `main`, which is the user's call. **So full screen, the still and the opener are this build's LAST slice** (section 19), after the asset, the table and the tree live in the page.
- **Before starting that slice the Engineer checks `main`:** `lib/useMapFullscreen.ts` returns `stillTier`, `still`, `open` and `registerOpener`; `components/ui/FsOpenRow.tsx` exists; `globals.css` declares `.sr-fs-open-row` and the `data-sr-fs-open` rule. **If any is missing, the Engineer stops and reports to the Guide.** No private copy of the hook's additions, no stub of `FsOpenRow`, no opener classes of this build's own, no interim full screen on the hook as it stands today, and no bar or stacking workaround.
- Until that slice, the tree is live in the page at every width. That state is never shipped: the two builds go out as one release (FR-90).
- Both builds edit `App.tsx`, `globals.css` and `.claude/rules/maps.md`; the second to land rebases over the first.

### 11.10 The still tier: the still, and the rotate note (FR-85, FR-87, D-20)

**The tree's phone tier IS the hook's `stillTier`: one query, `(max-width: 640px)`, and no second breakpoint.** It is the same query as the app's `useIsPhone`. The tab reads `fs.stillTier` and `fs.still` and never tests a width itself.

- This narrows D-20's desktop clause, by the Guide's call: at 150% or 200% text the tree's narrow form stays live in the page, with the toolbar's full-screen toggle, only while the window is wider than 640 CSS px. A window at or under 640 CSS px, on any device, gets the still, full screen and the hidden bar together, as the maps do, because all three follow the one query.
- The PRD's phone-tier requirements (FR-85 to FR-88) name no width, so nothing there disagrees. FR-88's "at desktop widths" is read as wider than 640 CSS px.

**The still is the tree itself, drawn once and switched off, under the maps' contract.** While `fs.still` is true the diagram component renders the same box through the same `cullTree`, with `stillView` (11.3): the tree from its top, at the larger of the true fit and one line per order, with the current expansion. That view is derived and never written to the tab's `TreeView`, and it is not the toolbar's Fit. Then:

- **the still's wrapper** carries `role="img"` and an accessible name built in the copy module from the model's counts (the design spec's "Your family tree: {N} species in {F} families and {O} orders", with count-of-one agreement), is not a tab stop, and calls `fs.open()` on a press anywhere on it;
- **the box inside it** has `overflow: hidden` and `touch-action: auto`, so it has no scroll offset and a swipe that starts on it moves the page; it carries the literal `inert` attribute, no `tabIndex`, no `aria-activedescendant` and no listener, so nothing inside it is focusable or exposed; where the tree at the still's pitch is taller than the box, the box cuts it and the design's fade covers the bottom edge, and where it is not there is no fade (a class set from the two heights the layout already holds, never a measurement of the page);
- **it mounts within the clamp of 11.4:** measured 38 tree items at 100% text and 23 at 200%, at most 48 with everything expanded, with no focusable descendant (11.2).

The toolbar's tools, the toggle and the readout are not rendered while `fs.still`. Find stays in the host and, when a result is chosen there, calls `fs.open()` and reveals the taxon in full screen (FR-66). `<FsOpenRow>` beneath the host is the keyboard and assistive path; the still adds a pointer path and nothing else.

Opening restores the tab's own `TreeView`, so the zoom and place the user left in full screen come back (measured exact on the mockup, 11.2).

**The PRD's wording follows.** FR-87 and QA-97 said "the whole tree fitted" and "absent from the accessibility tree". The Planner is changing both to the design spec's still: the top of the tree cut by its box, a named image whose content is inert.

**The rotate note is the app's `ChartViewTip`, reused (FR-85).** Two changes to that component and nothing else:

- `ChartTipPage` gains a third value, `'family-tree'`, which is the flag's key in the existing `chartTipDismissed` map. The dismissal is the component's own merge write through the `storage` seam, which leaves the Statistics and Species Detail flags as they are, and the note is not drawn until the saved flags have loaded. Both are the component's shipped behavior.
- Two optional props, `body` and `label`, default to the existing constants. The tab passes its sentence and its accessible name from `familyTreeCopy.ts`, so the tab's copy sweeps cover them and the two existing pages render byte-identically (the existing suite unmodified, plus one row).

The tab renders `<ChartViewTip page="family-tree" ... />` above the tree in the tree view, outside full screen. The component's own `useIsPhone` keeps it off every wider tier, on the same query as the still. The tab's storage scan (section 15) is unchanged by it: the write is in `ChartViewTip.tsx`. It does not depend on the map build, and is built with the still so the two arrive together.

---

## 12. Find: `lib/familyTreeFind.ts` (Slice B)

Amended after the design review: orders join the index, both names are matched in every Names state, and the ranking has tiers (FR-65 to FR-67, D-24, D-25).

- **Index, built per model, at all four levels:** one row `{ level, ref, common, scientific, commonLc, scientificLc }` for each species (the roster name; the asset's scientific name, or none for an unplaced species), each genus (its scientific name and its derived common name where it has one), each family (common and scientific) and each order (scientific and authored common). The lowercase forms are computed once, when the index is built, never per keystroke. A species name over `PLACE_KEY_MAX` is left out of find and still listed in the rollup. The index is rebuilt with the model and is NOT rebuilt by a Names change.
- **Match, per keystroke:** the query is normalized once by the shipped `normalizeSpeciesQuery` and cut to `FIND_QUERY_MAX = 64` code units inside the function. A row matches when its common OR its scientific name contains the query, in every Names state (plain `includes` on the two bounded lowercase strings, no `RegExp` built from the query): the same match set the shipped `matchesSpeciesQuery` gives over the same rows, which a table-driven row asserts in both directions. Species rows also match by four-letter code through the shipped `alphaCodeHits` over `useAlphaCodes()`; the other levels are never offered to the code join.
- **Rank, with no sort.** The Names state decides each row's LEADING name (the scientific name in Scientific, the common name otherwise, or the only name a taxon has). Matches fall into buckets in one pass, in this order: code hits; then a match at the start of the leading name or of one of its words (a word starts after a space or a hyphen, found with a bounded `indexOf` loop); then any other match in the leading name; then a match only in the other name. Within a bucket: species, families, genera, orders, each in taxonomic sequence, which is the order the index is walked in. Each bucket stops filling at `FIND_OPTIONS_MAX = 50`, and the first 50 across the buckets are rendered. This is the mockup's order with its last tier split in two, so that "a match on the leading name ranks ahead of a match on the other name" (QA-62) holds for every pair of rows.
- **A result row** leads with the leading name, shows the other name beneath where the Names state shows both, and states its level (Species, Genus, Family or Order). Italic follows 6.5. The input's accessible name and placeholder, the list's accessible name and the no-match sentence are in the copy module (FR-65, FR-67).
- **Cost, re-measured with orders and both names at every level:** 13,875 rows and 26,624 haystacks over a roster of every species (25,281 before). Per keystroke in Node 24, median of fifteen: **0.35 to 0.80 ms** for the bucketed form above across a one-letter query (13,125 matches), two-letter, whole-word, a miss and a 64-character query, the same in Scientific as in Common; 0.53 to 1.40 ms for the declined form (the shipped predicate lowercasing per row, then a comparator sort of every match). The work-count row holds haystack reads at no more than two per row per keystroke and asserts no sort over the matches.
- **Component:** the house combobox (`SpeciesCombobox` and `CommandPalette` are the shape): one `role="combobox"` input, a `role="listbox"` of `role="option"` rows with index-keyed ids through `aria-activedescendant`, Escape consumed at the element only while the list is open.
- **Reveal (FR-66):** in the diagram, add the ancestors to the expansion, set the active node, `zoomAt` to the `line` pitch if below it, and scroll it into view (one of the explicit moves 11.3 allows). In the rollup, return to taxonomic order, open the family, scroll to the row and focus it; for an order, scroll its heading into view and focus its first family row. On the still tier's still, choosing a result calls `fs.open()` and reveals the taxon in full screen.
- **Where it lives:** inside the host (11.9), so it is in the page on every tier and inside the panel in full screen. Its listbox renders inside the host, never in a portal, so the focus trap's containment has nothing to fight, and its Escape is consumed at the element while the list is open, so the hook's `document` listener never sees that press.

---

## 13. Chunking (NFR-06)

| Chunk | Holds | `entryChunk.test.ts` row |
|---|---|---|
| Entry | the registry lines in `lib/tabLayout.ts`, `lib/tabIcons.tsx` and `App.tsx` | the tab's component, every `lib/familyTree*.ts` module and the asset are absent from the App static closure |
| The tab's lazy chunk | `FamilyTreeTab`, controls, rollup, the Slice A lib modules, and modules shared with Life Lists | the closure from `FamilyTreeTab.tsx` reaches its own files (the positive leg); no chart library and no maplibre |
| The asset's chunk | `ebird-families.json` | named exactly once, inside `import()`, in `familyTreeAsset.ts`; absent from the tab's static closure |
| The diagram's lazy chunk (B) | `FamilyTreeDiagram.tsx`, `familyTreeLayout.ts` | absent from the tab's static closure; the closure from `FamilyTreeDiagram.tsx` reaches `familyTreeLayout.ts` |

`FamilyTreeFind` and `familyTreeFind.ts` ride the tab's chunk (find serves both views). The diagram box's height lives in a stylesheet class the `Suspense` fallback shares. The tab is not warmed at idle (the Life Lists precedent).

Added at the amendment: `familyTreeNames.ts` rides the tab's chunk. `lib/useMapFullscreen.ts` (which imports only `react` and `useFocusTrap` today, and may gain `useIsPhone`), the map build's entry-safe `components/ui/FsOpenRow.tsx` and `components/ChartViewTip.tsx` join the tab's static closure and reach no map, no maplibre and no chart library; the row that already holds "no maplibre" on the tab's closure is what would catch a map edge arriving through the hook. Because the tab opens on the tree at first use in a window wider than the still tier (FR-53, D-35), the diagram's chunk is requested at the tab's first mount there; it stays a separate chunk so the table path (a first use at or under the still tier, a saved table, a withheld diagram, Slice A alone) never loads it until the tree is chosen.

---

## 14. The tab registration set

### 14.1 Files and guards

The Hotspot Reports roster (its schema, 10.1) applies row for row with `'family-tree'`: `lib/tabLayout.ts`, `lib/tabIcons.tsx` (the Designer's glyph), `App.tsx` (the import, the `lazy()` line, `DEFERRED_TABS`, the tabpanel with `showing`, and the panel wrapped in `MapTabShowingProvider` with the same expression, 11.9), `components/HelpDocs.tsx` and `docs/HELP.md` (between Breeding Codes and Hotspot Reports, where the tab sits in the default order, D-13), `globals.css` (a `.sr-ft-*` family, every phone-tier declaration inside the established 640 px block, `.sr-ios-app` and `.sr-android-app` twins for anything fixed or sticky), and the rosters `tabLayout.test.ts`, `TabNav.test.tsx`, `entryChunk.test.ts`, `exoticProvenanceGraph.test.ts`, `helpToc.test.ts`, `TabLoadErrorAlert.test.tsx`, `honestLoadFailures.test.tsx`, `settingsAlertsOff.test.tsx` with its fixture, and `controlRegisters.test.ts` if a label takes `.sr-ctl-label`. The key and the file names stay `family-tree` and `familyTree*`; the label is **Family Tree** (D-24), one `TAB_LABELS` string and the copy module.

### 14.2 The default order and the migration (FR-08, FR-10, D-13)

Amended after the design review: the tab sits between Breeding Codes and Hotspot Reports (the user's direction), not after Life Lists.

`parseLayout` is unchanged. Two constants move.

- **New default (fourteen ids):** `weather`, `birding-stats`, `map-explorer`, `species-detail`, `calendar`, `targets`, `life-list`, `breeding-codes`, `family-tree`, `hotspot-reports`, `checklists`, `life-lists`, `comparer`, `named-birds`. The phone bar's four cells are unchanged.
- **`PREVIOUS_DEFAULT_TAB_ORDER` (thirteen ids, a spelled-out literal, kept as the named constant):** today's `DEFAULT_TAB_ORDER` exactly, which is the new default without `family-tree`. The twelve-id order that constant holds today is retired.

| Saved order | Reads as |
|---|---|
| Nothing saved, or malformed | the new default |
| Today's thirteen-id default | the new default, Family Tree between Breeding Codes and Hotspot Reports; the hidden set kept; nothing written |
| The new default | itself |
| Any other order | the saved order with `family-tree` appended last |
| A prefix of today's default cut at or before `breeding-codes` (its first eight ids or fewer) | the new default, by the append alone |
| A prefix cut after `breeding-codes` (through `hotspot-reports`, say) | a custom order: that prefix, then `family-tree`, then the rest in default order |
| The retired twelve-id order (no Hotspot Reports) | a custom order: those twelve, then `family-tree`, then `hotspot-reports` |

**One visible consequence of the one-generation rule.** A device that saved the pre-Hotspot-Reports default and has not saved since has been shown Hotspot Reports between Breeding Codes and Checklists by the migration, which writes nothing back. From this release that order is two generations old and reads as custom, so Hotspot Reports moves to the end, after the new tab. FR-10 accepts it ("the order it used to hold is retired and reads as a custom order"); it is in the hand-back so nobody meets it as a defect.

The `tabLayout.test.ts` rows are rewritten for the new generation as Hotspot Reports' were (its schema, 10.2): the fourteen-id literal; the new tab at index 8 between its two neighbors, and removing it yields the previous default exactly; Hotspot Reports at index 9 and Life Lists at index 11; the thirteen-id literal; the migration, the hidden set and the round trip; a custom order with `family-tree` last; the prefix row cut through `breeding-codes` with its second assertion cut through `hotspot-reports`; the retired twelve-id order reading as custom; and a stored default that loads with nothing written back.

### 14.3 The More sheet (FR-11)

The constants: `.sr-nav-sheet { max-height: min(73dvh, 616px) }` in `globals.css`, and `SHEET_AT_1X_PX = 616` with `REFERENCE_PHONE_HEIGHT_PX = 852` in `TabNav.test.tsx`. 616 px was measured for thirteen tabs: nine body rows, body 506 px, foot 61 px, padding 48 px, border 1 px (`pipeline/hotspot-reports/decisions.md` D-08). A fourteenth tab is a tenth body row of 44 px.

- **Predicted, not measured:** about 660 px, so `min(78dvh, 660px)` (78 is the smallest whole dvh holding 660 of 852).
- **The Engineer's WebKit measurement of the built app governs both terms:** the production build, WebKit with Chromium as the second reading, 393 by 852, `.sr-ios-app` on the root, a 34 px bottom inset, all fourteen tabs visible, text at 100%; record body, foot, padding, border and the total `H`; the rule becomes `min(<v>dvh, <H>px)` with `v` the smallest whole number holding `H`; `SHEET_AT_1X_PX` becomes `H`; both comments are restated for fourteen tabs; a leg with today's cap restored must show the list scrolling.
- The sheet then takes about 77% of the reference phone, and a fifteenth tab would take about 83%. That trend is a design question for a later run, sent to the idea inbox, not solved here.
- The tab's new position does not change the sheet: the bar's four cells are the first four tabs either way, so the sheet still gains one row. **The measurement is taken on the tree that holds both builds (FR-90)**, because the companion map build works on the same bottom bar and the same stylesheet.

---

## 15. Network posture and seams, confirmed

- No entry in `CACHED_GET_PATHS` or `EBIRD_GATED_PATHS`, no Vite proxy prefix, no `app.security.csp` host, no `http:allow-fetch` entry, no backend file, no `lib/tauri/` file, no frame, font, script or image beyond the favicons `<BirdName>` already loads.
- **`familyTreeNetwork.test.ts`**, a comment-stripped source scan over `lib/familyTree*.ts` and `components/familyTree/**` with a positive leg: no `fetch(`, `XMLHttpRequest`, `sendBeacon`, `<iframe`, `window.open`; `transport.` appears exactly once (the codes post in `FamilyTreeTab.tsx`); every `https://` literal sits in `familyTreeLinks.ts` and is consumed only as an `href`; `storage.` writes appear only in `FamilyTreeTab.tsx` and only for the three keys of 8.3; no `localStorage`. The rotate note's flag is written by the shared `ChartViewTip.tsx`, outside this scan's files, through the same seam (11.10).
- The amendment adds no request and no host: order and genus names come from the bundled asset, the Names control and full screen cause no request, and the full-screen hook and the rotate note make none.
- `clearDerived.ts` and `cacheInventory.test.ts`: no diff (nothing derived is stored; confirmed against section 8.1, where every derived value lives in component state and is replaced at each files epoch).
- Storage through `storage.*` only; the files epoch is in the load effect's dependencies; platform reads only through `lib/platformGates.ts` (none is needed today).

---

## 16. Security declaration: scans, bounds, measured costs, and where the work runs

### 16.1 Reads over user-file fields this feature adds

None is a regex. No loop is driven by a number read from a cell. Passes reused unchanged from Life Lists (pass 1, pass 1R, `dayKey`, `binomialOf`, `confirmPublishedNames`) are cited, not redeclared.

| # | Read | Module | Input | Bound and linearity argument |
|---|---|---|---|---|
| T1 | Year columns (Y1) | `familyTreeScope.ts` | every observation's `date`, `submissionId`, `commonName`; every ML row's `date` | One loop per array. Per row: `dayKey` (a length gate, then ten fixed positions), one truthiness read, the two memoized name reads of `speciesUtils.ts`, a `Set.add` of an integer year, and for a not-single-species row one length read then at most one `Map` operation on a key of at most 128 code units. `O(rows + mlRows)` |
| T2 | Year rows (S1) | `familyTreeScope.ts` | the year column | One loop over a `Uint16Array`, one push per match, then Life Lists' own pass over the collected rows. At most 3 visits per row per Year change (5.3) |
| T3 | Media tallies (S1) | `familyTreeScope.ts` | every ML row's `format`, `commonName`, `checklistId` | One loop. Per row: integer and string equality tests, at most one `Map.get` on the checklist id as parsed, at most one `Map` operation on the ML name as parsed. `O(mlRows)`. The two `Map`s are keyed on file text of unbounded length, the existing residual class of Life Lists' pass 2 and 2R (`security.md` v1.0.74, idea `47faa2a0`); this pass adds no new key kind |
| T4 | Not-single-species count (S1) | `familyTreeScope.ts` | the not-single-species rows' checklist ids | One loop over those rows only, one `Map.get` and one typed-array write each |
| T5 | Placement and aggregation (A1) | `familyTreeModel.ts` | the roster names | Per name: one `Set.has`, one `Map.get` of tallies, one length read, one `toLowerCase` of at most 128 code units, one `Map.get`. Then a walk of the asset. `O(S + asset species)` |
| T6 | Unplaced order | `familyTreeModel.ts` | unplaced names | `U log U` `localeCompare` calls; the Region picker's residual class. Its linearity row derives its limit from `n log n` |
| T7 | Find match | `familyTreeFind.ts` | names in the model, against the typed query | At most two `includes` per row over bounded lowercase haystacks computed when the index is built (at most 128 code units for a file-derived name, the asset's bounds otherwise), with the query cut to 64 inside the function; for a match, one bounded `indexOf` loop over the leading name to find a word start. No `RegExp` from the query and no sort over the matches. At most 50 rows out |
| T8 | Diagram cull | `familyTreeLayout.ts` | the drawn tree | Integers only; reads no file text. At most `DIAGRAM_MOUNTED_MAX` out, by the clamp of 11.4 |

`.claude/rules/security.md` gains `frontend/src/lib/familyTree*.ts` (T1 to T8 all sit under it, checked module by module) and `frontend/src/components/familyTree/**` (the components mint ids and IDREFs over file-derived rows and render unplaced names, which the IDREF rule governs; a `ui.md` gate does not discharge it).

### 16.2 Allocations sized from the file, each with a second bound

| Structure | Sized by | Second bound |
|---|---|---|
| `obsYear`, `mlYear` | row counts | 2 bytes per row; the rows are bounded by the upload cap |
| `nsRow`, `nsName`, the name-ordinal `Map` | not-single-species rows | at most the rows; keys at most 128 code units |
| `years` | distinct years | `YEAR_OPTIONS_MAX` |
| A year's transient row array | that year's rows | dropped when its pass returns |
| The selected year's key sets and tiers | that year's species and regions | one year at a time |
| `tallies` | distinct ML names in scope | at most the ML rows; 12 bytes of counts each |
| `nameAt`, the model | the asset's species | fixed by the asset |
| Rendered rows | orders, families, opened families' species | the asset's counts; `DIAGRAM_MOUNTED_MAX`; `FIND_OPTIONS_MAX`. After the table's Expand all the species rows mounted are the roster's (9.2): bounded per commit by `EXPAND_CHUNK_SPECIES` plus one family, and in total by the distinct countable species in the file |

**The amendment adds no scan over user-file text.** Order and genus names are bundled data read by index. `nameOf` (6.5) reads a roster name and names from the asset and compares nothing. The Names control, full screen, the still and Expand all read no file field. The one read that changed is T7, restated above: its rows gained a level and a second name from the asset, and the only file-derived strings in it are still the roster's species names, bounded as before. So no `security.md` glob is added beyond section 18's, and `familyTreeNames.ts` falls under the existing `frontend/src/lib/familyTree*.ts` entry.

### 16.3 Measured costs, per draw and per re-draw

Node 24 (V8) on this Mac, a generated corpus at the cap: 150,000 observation rows, about 18,750 checklists over 37 years, 60,000 ML rows, 3% not-single-species rows, the real Life Lists modules bundled unmodified. Median of seven after one warm run.

| Step | 3,000 species | 11,201 species | When |
|---|---|---|---|
| P1 `deriveFirstSightings` | 24.0 ms | 30.5 ms | once per epoch |
| P1R `deriveRegionIndex` | 85.1 ms | 100.2 ms | once per epoch |
| Y1 year columns and year list | 7.6 ms | 7.8 ms | once per epoch |
| Asset parse and index | 2.5 ms | 2.5 ms | once per session |
| S1, a Year change (largest year about 8,000 rows) | 6.3 ms | 7.1 ms | per Year change |
| S1, a Region change, names | under 0.1 ms | under 0.1 ms | per Region change |
| S1, media tallies | 3.5 ms | 2.9 ms | per Region or Year change |
| S1, not-single-species, as a pass over all rows | 13.4 ms | 13.5 ms | the declined form; the designed form walks 3% of the rows |
| A1 model build | 0.9 ms | 3.8 ms | per control or snapshot change |
| Find, per keystroke, as first measured (species, genera, families) | 0.3 to 0.4 ms | | |
| Find, per keystroke, with orders and both names at every level (section 12) | | 0.35 to 0.80 ms | per keystroke |
| A Names change | no pass and no model build | the same | per Names change; in the table it re-renders the mounted rows (9.2) |
| Reader's `confirmPublishedNames` (existing) | 18.6 ms | 19.4 ms | per snapshot change |

**The worst Year change** is a file whose every row lies in one year: the two Life Lists passes over all rows, about 110 to 130 ms here. No real backup has that shape (a heavy year is tens of thousands of rows), and the cost is bounded by the load's own.

### 16.4 Decision: the main thread, with a yield between passes

The load runs about 120 to 140 ms of passes at the cap in V8, about 110 ms of it the two Life Lists passes that Life Lists and Hotspot Reports already run on the main thread. The longest single block is pass 1R at 85 to 100 ms. The passes run in the load effect after the awaited loads, with a macrotask yield and a supersession check between them (8.2); the loading status is on screen before the first one.

Declined: the held-input stats worker (`createStatsSession`). Its results here would be `Map`s of tiers keyed by file strings, cloned back across the boundary, where a structured clone does not keep string sharing (CLAUDE.md v1.0.57), for passes two shipped tabs already run in place.

**Reversal, in order:** (1) a single pass over 200 ms in WebKit at the cap in the built app, or a live report of a frozen open; then (2) share one memo of P1 and P1R per observation array between this tab and Life Lists (a `WeakMap` on the array, Life Lists' output byte-identical), which halves the work when both are mounted; then (3) a one-shot worker of the `parseOffThread` shape returning packed columns.

---

## 17. Test and guard plan

Read `.claude/rules/testing.md` in full before writing any of these; it loads with the first test file.

| Suite | QA rows | Method |
|---|---|---|
| `lib/familiesGenerator.test.ts` | QA-01, 02, 03 | The pure core over in-memory fixture responses; one mutation per G and F check, each asserting `stop` and an empty write plan; the plan's fetch count unchanged; `FAMILY_CODE_SHAPE_RE` held equal to `FAMILY_CODE_RE` |
| `lib/familiesAsset.test.ts` | QA-04 (asset half), 05 (size), 06 | Section 3.3; every figure read from the committed files |
| `lib/familyTreeScope.test.ts` | QA-18, 19, 22, 26, 29 | Output equality against Life Lists' own functions over a generated corpus (import assertions plus equality); the year-list and `cellsInRegion` symmetric differences in both directions, the seam's own failure return as the first row |
| `lib/familyTreeReconcile.test.ts` | QA-20, 21 | For every region choice of a generated corpus, both switch states and all eight "has" selections: the model's name set equals `selectRows`' name set at the same settings. No typed-in total. A guard-the-guard leg with one gate removed must go red |
| `lib/familyTreeModel.test.ts` | QA-04, 24, 25, 27, 30, 36 to 40 | The FR-39 identities over a generated corpus and a sampled control grid; prototype-member names; world counts equal across control states |
| `lib/familyTreeLinearity.test.ts` | QA-74, 75 (call graph), 76 | WORK COUNTS at N and 10N rows (visits per row constant and equal; a leg where every row is its own species and its own year); pass counters across control and snapshot changes. CPU-quotient rows read `frontend/src/test/cpuTiming.ts` and run only in the local full suite behind `SR_SKIP_LOCAL_ONLY_TIMING` |
| `lib/familyTreeLinks.test.ts` | QA-47, 48, 49 | Both flag states through the `verified` parameter; a code failing the shape; the parser check (`new URL`) on every built href |
| `lib/familyTreeFind.test.ts` | QA-62 | The cap constants read by the test; a source scan for `RegExp`; work count per keystroke over the full-asset roster |
| `lib/familyTreeLayout.test.ts` | QA-52, 55, 61, 65 (table), 77 | Section 11.4; the keyboard path table |
| `lib/familyTreeCopy.test.ts` | QA-26, 44, 85 | The rule-based sweep over strings generated at zero, one and many through the shipped builders; no U+2014 |
| `lib/familyTreeNetwork.test.ts` | QA-50 (static half) | Section 15 |
| `lib/familyTreeCss.test.ts` | QA-81 | Tokens in both themes; no `zoom` and no `scale` (the property or the function) on the tree's box, plane, nodes or counts, in the stylesheet or inline, and no `scroll-snap` anywhere in the tab's rules (the house listbox entrance on Find and Region, a `scaleY` on the list alone, is outside that scope by name); `container-type: size` only under the compound panel selector, with the readout's thresholds read as 40rem and 25rem and scoped to the outline form; the tools row's 19.5rem; no `order` on the toggle; inline geometry only on the plane and its marks; inset twins; any text-on-fill pair at 4.5:1 by parsing the tokens |
| `lib/familyTreePublishedClaims.test.ts` | QA-69 | The house shape, scoped to the tab's Help passage, a non-vacuity leg per file |
| `components/familyTree/*.test.tsx` (jsdom) | QA-13 to 17, 23, 28, 31 to 35, 37, 41 to 46, 51, 53 to 56, 58, 63, 64, 78, 80 | The real hook through the real store on at least one row; a seam spy for writes; a listener and observer spy with `showing` false (QA-84); hostile names rendered, never read |
| `components/MediaPresenceCell` golden | QA-12 | The Life Lists rows' markup, captured before the move |
| `lib/familyTreeNames.test.ts` | QA-88 (lib half), 89 | The table of 6.5 over a named genus, an unnamed genus and an unplaced species with no scientific name, in all three states; no empty `lead`; italic by level |
| `components/BirdName.test.tsx` (extended) and a `BirdName` golden | QA-91 | The golden of the default output over the prop matrix, captured in a commit of its own before the prop is added; rows for `lead="scientific"`: the link's text, the class, no second line, the open-species argument, both marks' hrefs and accessible names unchanged; the empty-scientific-name fallback |
| `lib/familiesGenerator.test.ts` and `lib/familiesAsset.test.ts` (extended) | QA-92, 93, 102 (the lists half) | 3.2's G6, G7, F10, F11 and 3.3's extension; QA-93's fixture rows by name (Screech-Owl, Owl with Eagle-Owl, fowl, grouse, quail, goose, titmouse, monarch, bird-of-paradise, cock-of-the-rock, mixed endings, the genus-is-the-word shape); the two closed lists imported, never restated; two runs, identical bytes |
| `components/familyTree/FamilyTreeRollup.test.tsx` (extended) | QA-94 | Expand all and Collapse all on the real component; focus on the pressed control; the tree's expansion untouched; the work count of 9.2 over a roster of every species in the asset, with a press handled between two chunks and a superseding Collapse all |
| `components/ChartViewTip.test.tsx` (extended) | QA-95 | The third page value; the two optional props; the merge write leaving the other two flags; the existing rows unmodified |
| `components/familyTree/FamilyTreeFullscreen.test.tsx` (last slice) | QA-97 (jsdom half), 98, 99 | The real `useMapFullscreen`, the real provider and the real `FsOpenRow`, never a mock of any: the host's class; every member of the hook's return the tree uses; the toggle and the opener registered; `FsOpenRow` rendered directly after the host and only on the still tier; focus where the hook puts it on opening and on leaving by Exit and by Escape; Escape with Find's list open; a tab switch while expanded leaving no `document` listener, the body's overflow restored and the `<html>` attribute gone; the still's wrapper a named `role="img"` with no tab stop, its box carrying the literal `inert` and no listener; the toggle's accessible names equal to the maps'; a source scan for `z-index` beside the shared class and for `.sr-navbar`, `data-sr-fs-open` and `.sr-fs-open-` in the tree's files |
| `lib/familyTreeLayout.test.ts` (extended) | QA-98 (view half) | The `TreeView` of 11.3 as a property: for every pair of box sizes and both forms, relayout there and back returns the same zoom, anchor, expansion and active node; a guard-the-guard leg with "scroll to the active node on relayout" restored must go red |
| `lib/tabLayout.test.ts`, `lib/familyTreeSettings.test.ts` | QA-08, 10, 51, 90 | 14.2's rows; the three validators, each with malformed, unknown and prototype-member inputs written through `JSON.parse`; `defaultViewFor` at both tier values; in the tab's suite the opening view over the grid of gate (both ways), saved value (none, each view, malformed) and tier (both), with a saved view winning on both tiers; the latch as a row that flips the tier after the ready phase with nothing saved and nothing chosen and reads the same view, no write and no diagram chunk requested on the table side; a first change of view writing exactly one value |
| Roster edits | QA-05, 08 to 12, 73 | `tabLayout.test.ts`, `TabNav.test.tsx`, `entryChunk.test.ts`, `exoticProvenanceGraph.test.ts`, `helpToc.test.ts`, `tabOrderCoverage.test.ts` (no row expected), `androidReadings.test.ts`, `cacheInventory.test.ts` (no diff) |
| `verify-family-tree.mjs`, real engines against the built app | QA-11, 43, 57, 59, 60, 66, 67, 79, 81 (page width at full zoom), 83, and after the amendment 94 (the longest block of Expand all), 96, 97 (the still absent from Chromium's own accessibility tree, a swipe on it scrolling the page), 98 (the round trip at 100%, 125%, 150% and 200% text, both directions; the box never taller than the window), 99's phone leg on the combined tree, and after the design spec the readout's form and tab stops and the tools row at the eight phone settings of section 22, and Fit on a roster of 40 or more orders | Chromium AND WebKit; eBird-backed paths answered inside the browser and counted before any loop; controls filtered by visibility; each leg shown red on a build without the fix. **Held at `pipeline/family-rollups-and-tree/held/` until the user approves the `website/` change**, then lands under `website/tools/verify/` (the Hotspot Reports D-18 precedent) |

Not agent checks: a two-finger pinch on a physical phone and a trackpad pinch in the Mac app (QA-59). Each is a user-performed check, Partial if deferred.

---

## 18. Rule files, the runbook, Help, held copy, version

**`.claude/rules/bird-names.md`**, `paths` gain `frontend/src/assets/ebird-families.json`, `scripts/lib/ebirdFamiliesDerive*`, `frontend/src/lib/familyTree*.ts`, `frontend/src/components/familyTree/**`. New text: the family asset as a third build-time taxonomy asset written by the snapshot run (keyed by lowercase common name, held to the snapshot by `familiesAsset.test.ts`, its world counts excluding extinct species unless the birder has them); and the diagram exception of 11.7. **Added at the amendment:** the first bullet's Props list gains `lead?` with its one sentence (a name may lead with its scientific name; the open-species key and both marks still follow the common name; `<BirdName>` is still the only way a species name is rendered, in every Names state); and the asset bullet says that order common names are one authored table and genus common names one derived rule with two closed lists, both in the generator's core, with no naming code at run time and the read-through of 3.5 at each refresh. `BirdName*.tsx` is already under this file's `paths`.

**`.claude/rules/security.md`**, `paths` gain `frontend/src/lib/familyTree*.ts` and `frontend/src/components/familyTree/**`, with one sentence naming the scans (T1 to T7) and the IDREF reason for the components.

**`.claude/rules/ui.md`**, `paths` gain `frontend/src/lib/familyTreeCopy.ts` and `frontend/src/lib/familyTreeLayout.ts` (the components are already under `frontend/src/components/**`). Text: the More sheet sentence restated for fourteen tabs with the measured pair; a new bullet that a zoomable surface is zoomed by layout (positions and sizes recomputed from one number inside a native scroll box) and never by CSS `zoom` or `transform: scale`, with the WebKit reading of 11.2.

**`.claude/rules/testing.md`**: no `paths` change (the suites are under existing globs; the held probe joins `website/tools/verify/**` when it lands). **`docs-and-website.md`**: no change.

**`.claude/rules/maps.md`** (changed at the amendment; the first draft said no change, when the tab was not a full-screen host): `paths` gain `frontend/src/components/familyTree/FamilyTreeTab*.tsx`, the file that calls `useMapFullscreen`, so the rule that governs a host loads with it. Its tab-showing sentence gains the fifth host by name and says it is not a map: it takes the hook and the panel class and nothing of `<SnowMap>`. The companion map build edits the same file; the second build to land rebases.

**`.claude/rules/ui.md`**, further text at the amendment: the full-screen paragraph that lists the shipped fixed and sticky instances gains the tree's host as a consumer of `.sr-map-fs-panel`, with the rule of 11.9 that a host declares the shared class's properties only under `:not(.sr-map-fs-panel)` or under its compound selector, never on its bare base class.

**`scripts/taxonomy-history-input/README.md`**, the ordered refresh: step 4 names the family asset among what the generator writes "or nothing", with its stop conditions; step 8 adds the figures measured on the old family asset to the re-derive list (families, orders, genera, extinct species, the wholly extinct families, the longest name of each kind, the gzipped size against its budget) and their known sites; step 9 names `familiesAsset.test.ts`. One added paragraph: a mid-year stop on the revision check stops the family asset too, and is raised, never worked around. **Added at the amendment (FR-82, FR-91):** step 4 says a new order, or an order eBird retired, stops the generator until `ORDER_COMMON_NAMES` gains or loses its row, and that the wording of a new order's name is the user's to approve; a new step after step 4, the genus-name read-through, says to read the names the generator's report marks new or changed, settle each awkward plural in one of the two closed lists, re-run, and record the date and the names in the run's `decisions.md`.

**`docs/HELP.md`** (not held): the section between `## Breeding Codes` and `## Hotspot Reports` (the tab's place in the default order, D-13), the rollup with Slice A and the diagram and find with Slice B; the Getting Started and Default Files tab lists; "SnowRaven remembers the region, the view, and the names you choose"; per-session, resetting on relaunch, for the rest; the Names control, Expand all and Collapse all, full screen, and the phone's Open the tree (FR-72 as amended).

**Held copy, `pipeline/family-rollups-and-tree/held-copy.md`** (FR-74): one proposed sentence each for the README and the website, one for the App Store listing, one short What's New sentence, the three F-Droid changelog files' shared text. `ACCESSIBILITY.md` stays true in the same change (FR-77): the readout rule and any platform gate as properties.

**Version:** one patch bump across the six-file set, with the snapshot counters untouched by this feature (Route 1 of 3.4 moves them in its own commit).

**One release with the map build (FR-90, D-18). Where it touches this ship set:**

- **No version bump, no versioned `CHANGELOG.md` entry and no tag on this build's branch alone.** The six-file bump, the one changelog entry naming both changes, the Fastlane changelog files and the website version stamp are made once, on the tree that holds both builds.
- **Files both builds edit:** `App.tsx` (this build adds the tab's registration and the provider wrap), `globals.css` (this build adds its `.sr-ft-*` block and moves the More sheet cap; the map build owns `.sr-map-fs-panel`, the `data-sr-fs-open` rule and the `.sr-fs-open-*` register), `.claude/rules/maps.md`, and possibly `TabNav.test.tsx`. The second to land rebases over the first.
- **Files only the map build writes, which this build imports:** `lib/useMapFullscreen.ts` and `components/ui/FsOpenRow.tsx`. They reach this checkout when the map build's branch is on `main`, which is the user's call, and this build's last slice waits for that (11.9, section 19).
- **Judged on the combined tree, not on either branch:** the full suite and `npm run build`; the More sheet measurement (14.3); QA-99's phone leg and QA-98's Exit row on a phone (11.9); the real-engine probe's phone legs; the retaken pictures (FR-76) and the held copy (FR-74), which describe one release.
- **The asset route of 3.4 is independent of the map build** and is still the first step of Slice A.

---

## 19. Slices and build order

**Slice A** (complete on its own; no view control, no diagram, no find):

1. The route of 3.4 chosen; the pure core with the order table and the genus rule (3.5), its suite, the generator leg; the genus-name read-through (FR-91) and its record; the asset committed with `familiesAsset.test.ts` green.
2. `familyTreeAsset.ts`, `familyTreeScope.ts`, `familyTreeModel.ts`, `familyTreeNames.ts` with their suites, the reconciliation and the linearity guard.
3. The `MediaPresenceCell` golden, then the move. The `BirdName` golden, then the `lead` prop.
4. Registration (section 14, at the D-13 position), the tab, controls with the Names control, the rollup with Expand all and Collapse all (9.2) and no inner scroller on the phone tier (9.4), links (flags false), copy, settings (`familyTreeRegion` and `familyTreeNames`).
5. The rule files; Help; the runbook; the WebKit readings of section 22. The More sheet measurement waits for the combined tree (14.3).

**Slice B**, on Slice A's model:

6. `familyTreeLayout.ts` with the `TreeView` of 11.3 and its suite at the full-asset roster.
7. `FamilyTreeDiagram.tsx` behind `React.lazy`, live in the page at every width, the view control, `familyTreeView` with the first-use default of 8.3 read from `useIsPhone()` (the last slice moves that read to `fs.stillTier`).
8. Find in both views, at four levels.

**The last slice: full screen, the still and the opener** (the Guide's order, 2026-11-21). It consumes code the companion map build lands, so it comes after everything above.

9. **The gate.** The Engineer checks `main` for the map build's additions (11.9: the four new members of the hook's return, `components/ui/FsOpenRow.tsx`, the `.sr-fs-open-row` rule, the `data-sr-fs-open` rule). **If any is missing: stop and report to the Guide.** Nothing in this slice is built on a private copy, a stub or the hook as it stands today.
10. With them on `main`: the hook call and `fs.className` on the host, the tab's tier read moved from `useIsPhone()` to `fs.stillTier` (8.3), the provider wrap in `App.tsx`, the toolbar's toggle, `FsOpenRow` after the host, the still, the rotate note (11.9, 11.10), and the round-trip rows of 11.3.
11. The real-engine probe; the live look at the built app before the deploy gate, with what it finds going back to The Designer.
12. The two builds on one tree (FR-90): the combined tree's suite and build, the phone legs of QA-98 and QA-99, the More sheet measurement, then the one version bump.

Slices A and B and the last slice are build order, not three releases: nothing ships before step 12.

---

## 20. Open questions closed here

| # | Answer |
|---|---|
| 3 | eBird marks extinct species: `extinct: true`, `extinctYear` numeric, keys absent otherwise (2.1). FR-04 stands, with the world family and order totals of 6.3 |
| 13 | The leaf is plain text; the active leaf's readout renders `<BirdName>` (11.7) |
| 15 | Under the unchanged revision check, in both write modes; the check stops today; raised with two routes (3.4) |
| 16 | Own key, `familyTreeRegion` (8.3) |
| 17 | No gate designed in; the predicate is named and unused (11.8) |

Questions 1 and 2 keep their defaults (no family link; flags false). Questions 4, 5, 6, 7, 9, 10, 11 and 12 keep their defaults for the Designer; section 21's last entry lists what the structure cannot support.

**After the design review** (the user's and the Guide's answers, `decisions.md` D-13 to D-25; this document follows them and closes none itself):

| # | As settled | Where it lands here |
|---|---|---|
| 4 | Label Family Tree, key `family-tree` | 14.1 |
| 5 | Between Breeding Codes and Hotspot Reports | 14.2 |
| 6 | At first use the tree in a window wider than the still tier and the table at or under it (D-35, correcting D-25(a)); the saved choice on every tier after the first change of view; the table where the diagram is withheld | 8.3, 11.8 |
| 9 | One left-to-right tree in two forms by box width; arrival at reading size from the top | 11.3 |
| 19 | Full screen's stacking level and the phone's bar: the map build's, consumed here | 11.9 |
| 20 to 23 | The opening view as row 6 has it; find matches both names in every Names state; the readout shows both names; the genus rule written out with its two lists | 8.3, 12, 6.5, 3.5 |

Still open and not this document's to close: the snapshot route of 3.4 (D-03), for the user at the sign-off; the two family links (D-12), for a person's look in a browser.

---

## 21. Design decisions

1. **Incremental path.** Reversal: none expected.
2. **The asset is keyed by lowercase common name and self-sufficient** (2.2). Declined: keyed by species code beside the snapshot, 22 KB smaller gzipped and 473 KB more to load. Reversal: the app comes to load the snapshot on every platform anyway.
3. **Written only by the existing generator under the unchanged check** (3.4). Reversal: the user chooses Route 2 for the first generation.
4. **World family and order totals count only taxa with a world species count above zero** (6.3). Reversal: the user prefers every family in the asset.
5. **The year roster is Life Lists' passes over the year's own rows** (5.1), not a per-year index. Declined: a year-by-region-by-species index (memory in the product of the three) and a pass with its own copy of the gates (a twin). Reversal: a measured Year change over 100 ms on a real backup.
6. **Media figures come from one tally pass, with presence as a tally above zero** (5.3), proven equal to Life Lists' presence. Declined: Life Lists' first-asset passes for presence beside a second pass for counts (two derivations to keep in step).
7. **`useLifeListsProvenance` verbatim** (section 7). Reversal: stated there.
8. **Main thread with yields** (16.4). Reversal: stated there, in order.
9. **Diagram: DOM labels, layout-driven zoom, native scroll, one SVG path, no library** (11.1). Declined: CSS `zoom` and `transform: scale` (measured, 11.2); an SVG scaled by `viewBox` (text scales with it, and `<BirdName>` would need `foreignObject`); canvas (labels would not be real text); a tree library (the layout is a slot count and a midpoint). Reversal: the built app fails 11.2's readings on an engine, which is FR-71's gate before any change of renderer.
10. **Level of detail with a clamp at 600 mounted tree items** (11.4; the unit is stated and the count re-measured there at the amendment). Reversal: a form the Designer chooses needs more at once; the constant moves with a new measurement.
11. **Leaf text plain, `<BirdName>` in the readout** (11.7). Reversal: the keyboard model changes to one with focusable items, which FR-68 forbids.
12. **The tab's own code installs no document or window listener; the one observer is keyed on `showing`; the consumed full-screen hook installs its page-level effects only while the tree is expanded and releases them in the render that hides the tab** (8.5, as reworded at the amendment).
13. **Both family links ship off** (section 10). Reversal: a person's look in a browser, then one constant each.
14. **What the design cannot choose, because the structure or the engines cannot support it** (amended after the design review: full screen is now in scope and the form is settled, so the entries that said otherwise are struck and marked):
    - Text that shrinks with zoom, or any use of CSS `zoom`, `transform: scale` or a scaled `viewBox`. Labels stay at body size; zoom changes spacing and which nodes are labeled.
    - Every label visible at a whole-tree fit. A branch smaller than one label line draws as a count. In a 600 px box at 100% text that is about 30 labels down the leaf axis, so an arrival state that shows every family by name is a readable zoom scrolled to the top, not a fit.
    - Links or buttons on a leaf. The readout carries them.
    - Custom pan physics (inertia, easing, snapping). Pan is the box's native scroll, one to one under a mouse.
    - A plain wheel that zooms. It is possible (the handler would cancel every wheel) but traps the page over the diagram; Open Question 10's default is the engines' own behavior.
    - A diagram with no bounded box of its own. In the page the box is bounded and never taller than the window; in full screen the box is the window less the toolbar and the readout. **"Fullscreen is out of scope" is reversed** (D-19, D-20, FR-88, FR-89): the tree goes full screen through the maps' hook as a fifth host (11.9).
    - A full screen with a stacking level, a bottom-bar rule, a focus trap, an Escape handler, a scroll lock, an opener row or a still breakpoint of its own. Those are the hook's and the shared classes' (11.9), so the mockup's own panel class, its `z-index: 1250`, and its own open row and button classes are not built.
    - A still tier other than the hook's one query. At or under 640 CSS px of window the tree is the still, at any text size; above it the tree is live in the page (11.10).
    - A relayout that starts the tree over or jumps to the active node. Entering and leaving full screen, a change of form, a Names change and a text-scale change all keep zoom, place, expansion and the active node (11.3).
    - The form question is settled by the design (columns, and an outline below 54 rem of box), which answers the first draft's two cost notes: the outline is the phone's answer to four columns not fitting.
15. **Order names are one authored table and genus names one pure rule with two closed lists, both in the generator's core and emitted into the asset** (3.5). Declined: a table or a rule at run time (a second trust boundary and naming code in the app); order names beside the asset in a `lib/` module (two places to keep in step). Reversal: the user finds the derived genus names uneven and keeps genera scientific, which is an empty rule and a smaller asset.
16. **`<BirdName>` gains one optional prop, `lead`** (9.3). Reversal: a second surface needs a scientific-first name and a wider API is argued then.
17. **The table's Expand all mounts in chunks of 150 species with a yield** (9.2). Reversal: stated there, in order.
18. **The tree's view is zoom as a fraction of full zoom and place as a node** (11.3). Reversal: none expected; it is what FR-88 asks for.
19. **Full screen consumes the map build's hook, opener row and classes exactly as they land, and adds only the inside of the panel and the two controls that toggle it** (11.9). Focus in and out, the page's place, the bar and the level are the hook's. It is the last slice, and it stops and reports if the map build's code is not on `main`. Reversal: the map build's contract changes before it lands, and 11.9's table is rewritten to it.
20. **The still tier is the hook's `stillTier`, with no second breakpoint; the still is the tree's own cull at the fit, a named image whose content is inert; the rotate note is `ChartViewTip` with a third page value and two optional copy props** (11.10). Reversal: the user asks for a live tree in the page on a phone, which re-opens D-17.
21. **Find ranks in buckets without a sort and matches both names in every Names state** (section 12).
22. **The first-use view is derived from the still tier and latched for the session** (8.3; D-35 gives the rule, D-36 the latch). Declined: following the tier live until the first choice. Reversal: stated there.
23. **After the design spec: Fit is the true fit and the one-line-per-order floor is the still's alone; the readout's forms and the tools row's captions are container queries on the expanded host and on the row; an explicit move resolves after the readout has its height; the Exit toggle leads by DOM order** (11.3, 11.9, 11.10; D-37). Declined for the readout's forms: a script that measures the panel and re-renders (a second observer for something a container query answers, since the question is how tall the panel is) and a media query (its `rem` does not follow the in-app text scale, measured). Reversal: an engine at the floor that mis-sizes the expanded host under size containment, which moves the forms to a measured render branch.

---

## 22. Measured here, and owed by the Engineer

**Measured here** (scratch probes, nothing written to the repo): the taxonomy response's fields and extinct marker; its drift against the snapshot; Cornell's file against it; the prototype asset's sizes and its F1 to F9 checks; index build time; every row of 16.3 in V8; every row of 11.2 in WebKit 26.5 and Chromium 151.

**Owed by the Engineer, each recorded in `decisions.md` with its method:**

| Measurement | Method |
|---|---|
| The committed asset's gzipped size and the F checks | the generator's own run and `familiesAsset.test.ts` |
| Section 16.3's rows in WebKit (JavaScriptCore) | the built app in Playwright WebKit with a generated backup at the largest cap read from `EBIRD_MAX_UPLOAD_BYTES_BY_PLATFORM`; nothing else compiling; the longest single block against 16.4's 200 ms |
| The More sheet's four heights and `H` | 14.3 |
| The rollup at 320 px and 200% text, both engines | `document.scrollWidth` against the viewport with the longest family name and the largest counts (QA-79) |
| Section 11.2's rows on the BUILT diagram | mounted count, script time per zoom and pan step, far-offset position, page width at full zoom, wheel chaining, the drag sequence; both engines; 100% and 200% text; the full-asset roster |
| Pinch in Chromium | two-pointer touch through CDP; the visual viewport scale stays 1 |
| The focus indicator and accessible names | a real Tab and arrow presses; `ariaSnapshot` and the engine's own tree, both engines (QA-66, QA-67) |
| A trackpad pinch in the Mac app; a two-finger pinch on a phone | user-performed, with exact steps; Partial if deferred |

**Measured at the amendment (2026-11-21, scratch probes, nothing written to the repo):** the version 2 asset's size and its order and genus counts (2.2, 3.5); the genus rule against the approved mockup's 109 names; the mockup's own tree code over every species in both engines, both forms, both Names states and two text sizes, with the far end, the still and the round trips (11.2); the table's Expand all through the real `BirdName` in both engines, in one commit, in chunks and with `content-visibility` (9.2); find per keystroke at four levels (section 12).

**Owed by the Engineer after the amendment:**

| Measurement | Method |
|---|---|
| Expand all on the BUILT table | the longest block and the total at the saved backup's roster and at a roster of every species, WebKit and Chromium, 100% and 200% text; a control press handled between two chunks; the work count of 9.2 in the suite |
| A Names change with every family open, on the built table | the block the press itself causes, both engines |
| The built tree's mounted items and elements with the design's labels | the sweep of 11.2 in the page and in full screen, both forms, Both and Common, 100% and 200% text, against the 600 clamp |
| The full-screen round trip on the built tree | at 100%, 125%, 150% and 200% text at 1440 by 900 and at 390 by 844, in both directions: zoom, the anchor node and its offset, expansion and the active node equal before and after (QA-98); a leg with relayout scrolling to the active node restored must go red |
| The still | Chromium's own accessibility tree (CDP, since `ariaSnapshot` does not honor `inert`): the wrapper a named image, nothing beneath it exposed; a touch swipe begun on it scrolls the page, both engines |
| The table on the still tier | no element between the panel and the rows scrolls vertically; scroll height equals client height with every family open (QA-96) |
| The genus-name read-through (FR-91) | a person's or the builder's reading of the generator's report; its record in `decisions.md` before the tag |
| The phone legs of QA-98 and QA-99, and the More sheet | on the tree that holds both builds (FR-90) |
| The readout's three forms and the tools row on the BUILT panel | 390 by 844 and 320 by 568 at 100%, 125%, 150% and 200% text, both engines: the form against the design spec's table, the tab stops against its section 9.9, the box the only element with a scroll range, the readout not cut with a family active, the captions dropped under 19.5rem of row |
| Fit with the orders folded into counts | a roster across 40 or more orders in both forms, which the mockup showed only by shrinking its box (design spec 18): every drawn node inside the box after Fit, and the mounted marks against the clamp |

---

## 23. Amendments after the design review (2026-11-21)

Made in place for the user's directions and the Guide's calls (`decisions.md` D-13 to D-25), the PRD's two amendment notes, the approved mockup, and the companion map build's contract as its session relayed it. Nothing else was re-opened, and no first-draft measurement was re-taken except where a row says so. The decisions this pass adds are `decisions.md` D-26 to D-34, and D-36 for the opening view after the Guide's D-35.

| # | Section | What changed |
|---|---|---|
| 1 | Header, Path, Architect assessment, Existing data, Changes | The combined release; three settings keys and the rotate note's flag; `familyTreeNames.ts`; `BirdName.tsx`, `ChartViewTip.tsx` and the provider wrap as modifications; the map build's files as consumed and never edited |
| 2 | Confirmation | Five new findings (9 to 13), each measured |
| 3 | 2.2 | The asset is version 2, with an order common name on every order and a genus common name where the rule gives one; re-measured at 449,944 bytes raw and 134,392 gzipped |
| 4 | 3.1 to 3.3 | The core's new exports; checks G6, G7, F10, F11; the CI re-derivation extended to both kinds of name, reading the snapshot's spelling |
| 5 | 3.5 (new) | The authored order table, the genus rule as a pure function with two closed lists, and the read-through as a named step of the generator |
| 6 | 4 | `common` on orders and genera in the runtime index; the shape check reads version 2 |
| 7 | 6.4, 6.5 (new) | The family-name sort does not follow the Names state; `nameOf`, with italic by level; a Names change builds nothing |
| 8 | 8.1, 8.3, 8.5 | Names and the tree's view as tab state; the three keys; the opening view, with its first-use default derived from the still tier and latched (D-35, D-36); the listener sentence reworded for the consumed hook |
| 9 | 9.2 | Expand all, measured, as chunked mounting with its bound, its supersession and its declined alternatives |
| 10 | 9.3 | The `lead` prop on `<BirdName>` and the table of what each Names state passes |
| 11 | 9.4 (new) | Names in the table; no inner vertical scroller on the still tier |
| 12 | 11.2 | The re-measure on the mockup's own code, and the round trips where the mockup does not hold |
| 13 | 11.3 | The two forms and their threshold; the three pitches and what Both changes; the `TreeView` (zoom as a fraction, place as a node) and the rule that a relayout keeps it |
| 14 | 11.4 | The clamp's unit is tree items; 187 measured with the design's labels; the same in Both and in Common |
| 15 | 11.5, 11.6, 11.7 | The full-screen toggle and whole-box-into-view inputs; the box never taller than the window; one tab stop in the page and in full screen; the readout's stops are the design spec's to count, not "at most three" |
| 16 | 11.8 | The tab opens on the table where the diagram is withheld |
| 17 | 11.9 (new) | Full screen as a fifth host of the maps' hook, to the map build's relayed contract; what the tree adds and what it must not; the gate before the last slice |
| 18 | 11.10 (new) | The still tier is the hook's one query; the still as a named image with inert content; the rotate note through `ChartViewTip` |
| 19 | 12 | Orders in the index; both names matched in every Names state; ranking in buckets with no sort; re-measured at 0.35 to 0.80 ms per keystroke |
| 20 | 13, 14.1, 14.2, 14.3 | The hook, `FsOpenRow` and the note on the tab's closure; the tab between Breeding Codes and Hotspot Reports with the migration table rewritten; the More sheet measured on the combined tree |
| 21 | 15, 16.1, 16.2, 16.3 | The three keys in the storage scan; no new scan over user-file text, stated; T7 restated; Expand all's rows in the allocation table; the new measured rows |
| 22 | 17, 18, 19, 20, 21, 22 | The suites for QA-88 to QA-102; the rule-file edits (`bird-names.md`, `maps.md`, `ui.md`), the runbook's new-order and read-through steps, Help's position, the combined release; the build order with full screen last; the questions as settled; entry 14 amended and entries 15 to 21 added; the measurements made and owed |

**Returned to The Designer before the spec is written** (each is a place where the approved mockup, the PRD and this structure do not all say the same thing; the structure supports whichever is chosen unless a row says otherwise):

1. **The mockup loses state on a change of form.** At 1440 by 900 and 150% text, entering full screen switches the tree from the outline to columns, and the mockup starts over: expansion, the active node, zoom and place are reset, and are not restored on leaving (11.2). FR-88 and QA-98 require them kept, and this structure keeps them (11.3). The spec should describe the kept behavior, including what a tree that was opened to orders only in the outline looks like when it becomes columns.
2. **The mockup scrolls to the active node on every relayout**, which moves the place on a full-screen round trip whenever the active node is out of view (measured at 100% and 125% text). This structure does not; the spec should not ask for it.
3. **Two scrollers inside the full-screen panel besides the tree's box.** Settled by the design spec (its 10.3): the box is the only scroller; the readout sheds parts by the panel's height and the tools row drops its captions (11.9).
4. **Fit is not always a fit.** Settled by the design spec (its 9.5, 10.1 and 16): Fit is a true fit with no floor, and the one-line-per-order floor belongs to the still's own view (11.3, 11.10). The Planner is changing FR-87 and QA-97.
5. **The mockup opens on the table on a phone** (its viewport switch sets it), where D-25(a) said the tree first on every tier. **Settled by the Guide's D-35: the mockup stands.** The tree opens first in a window wider than the still tier and the table at or under it (8.3). Nothing for The Designer to change here.
6. **The mockup's own full-screen panel class, its `z-index: 1250`, its own Escape handler, its open row and button classes, and its `.mk-phone` test for the still** are replaced by the shared hook, classes and `FsOpenRow` (11.9, 11.10). The still's tier is the window's width, not a text size: at or under 640 CSS px.
7. **The still is a named image under the shared contract.** Settled: the design spec names it (its 10.1) and the Planner is changing FR-87 and QA-97.
8. **The find input's placeholder in the mockup names three levels**; FR-65 names four in the placeholder and the accessible name. The copy module follows FR-65.

Nothing in the mockup needs a renderer, a library or an engine feature this structure does not have: its sticky column header, its two-line labels, its `:has()` focus frame and its two forms all sit on the measured primitives.

**After the design spec (`design-spec.md`, 2026-11-21).** The Guide accepted the spec's two structural asks and this document was amended for them and checked against the rest of the spec. Items 1, 2, 6 and 8 above are written into the spec as this document has them (its 9.6, 10 and 8); items 3, 4 and 7 are settled as marked; item 5 by D-35. The decision is `decisions.md` D-37.

| Section | What changed for the spec |
|---|---|
| 11.3 | `fitView` is the true fit with no floor; `stillView` is new and is the only place the one-line-per-order floor exists; the list of moves that may scroll the tree is the spec's; an explicit move resolves after the readout has taken its height; positions as inline geometry on the plane's own elements; the "touch tier" of the pitch table is the still tier |
| 11.4 | A run of small siblings is named, one count, or a dot by the room its gap has, at every level including the orders; the active node's ancestors are always drawn; the clamp counts nodes and counts, and a count is not a tree item |
| 11.5, 8.5 | A double-click on empty space zooms in one step, on an element listener |
| 11.9 | The box is the only scroller; the readout's three forms as a size container query on the expanded host, and the tools row's captions as an inline-size one, both measured in both engines; no focus effect of this build's own; the footer lines after the opener; the Exit toggle first in the toolbar's DOM on the still tier |
| 11.10 | The still is the tree from its top at `stillView`, cut by its box with the fade where it continues; its name comes from the model's counts |
| 9.4 | The table has no scroller of its own on any tier, and its list is an inline-size container |
| 3.3, 3.5 | QA-92's name-for-name check is against a literal of the spec's order table held in the test |
| 17 | The stylesheet guard's scope for `scale`, the container rules, `order` and inline geometry |

**One thing in the spec this structure does not build as drawn:** its `order: -1` on the Exit toggle (spec 10.3). `order` moves a box without moving its place in the tab order, which the house rule forbids (`ui.md`, v0.5.80). The toggle is rendered first in the toolbar's DOM on the still tier instead, which draws the same row (11.9).

**Two notes for the spec that are not structure:** its disabled tool buttons (Zoom out and Fit at the fit, Zoom in at full zoom) should be `aria-disabled` and stay focusable, or the press that reaches the limit drops focus from the button it disabled (NFR-08); and its inline positions need QA-81's inline-width scan to exempt the plane and its marks, which 11.3 states.
