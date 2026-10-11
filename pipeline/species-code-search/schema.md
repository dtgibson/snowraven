# Schema - Species Code Search

**Feature:** species-code-search
**Date:** 2026-10-08
**Stage:** 3 - The Architect
**Source:** prd.md (approved), strategic-brief.md (approved)
**Path:** Incremental
**Amended:** 2026-10-10, after the Designer stage. The user approved rule A for OQ-02 and narrowed
the codes to the American name and its variants (decisions.md 1 to 6). Changed: sections 1, 2.2,
2.3, 2.6, 2.7 (new), 4.2 to 4.4, 5.1, 5.2, 7, 11, 15, 17 and 18. Everything else stands.

## Architect assessment - Incremental

`pipeline.config.json` exists and is complete, so the config step is skipped. SnowRaven has no
database. Its data layer is the user's eBird backup parsed in memory, a family of storage-seam
documents, and a family of **bundled build-time assets** (`ebird-taxonomy.json`,
`ebird-countability.json`, `ebird-taxonomy-history.json`, `us-counties.json`,
`noaa-tide-stations.json`, `ca-atlas-blocks.json`), each with a developer-run generator under
`scripts/` and a CI guard. This feature adds one member to that asset family, a change to the
generator that already produces its siblings, and one new in-memory derivation over names the
app already holds. It persists nothing and adds no storage-seam document, backend route,
transport path or request. It is not frontend-only, because a committed data artifact with a
build pipeline and a trust boundary is data-layer work (the `taxonomic-splits-lumps` precedent).
It is not a migration, because nothing existing is remapped. Running hands-off, so this is
declared here rather than confirmed in chat.

---

## 1. The design in one paragraph

A committed asset, `frontend/src/assets/ebird-alpha-codes.json`, maps every published eBird
common name (lowercased, in taxonomic order) to that entry's own four-letter codes: all of its
`bandingCodes`, plus only those `comNameCodes` formed from the name SnowRaven shows (or a hyphen or
accent variant of it, section 5.2), joined by single spaces, with `""` for a name left with no
code. Codes eBird lists from a bird's other names are filtered out at generation time, so the app
never sees them. It is produced by the same run of `scripts/build-ebird-taxonomy.mjs`
that produces the snapshot, whose pure core moves into `scripts/lib/ebirdTaxonomyDerive.mjs`;
when the live taxonomy still equals the committed snapshot, that run writes only the new asset.
`lib/alphaCodesAsset.ts` loads it through one dynamic `import()`, memoized for the session,
started by the first Search open or the first picker open, and publishes it through a tiny store
that `lib/useAlphaCodes.ts` reads. `lib/alphaCodes.ts` joins a list of names to an inverted index
(lowercased code to the names in that list carrying it), memoized in a `WeakMap` on the list's
identity so it dies with the list. `lib/speciesMatch.ts` gains `rankSpeciesMatches`, the one
place the ranking rule lives (code matches first, then name matches, each in the surface's own
order), and `highlightOnCodeArrival`, the one place FR-25's highlight rule lives. Search
(`lib/paletteRows.ts`, `CommandPalette.tsx`) and `SpeciesCombobox.tsx` call both; the four
picker call sites change nothing.

---

## 2. Measured facts that shape the design (2026-10-08)

All figures from eBird's public `ref/taxonomy/ebird` (17,891 entries), fetched today into scratch
(no API token was needed for this endpoint; the generator still requires one, unchanged), and the
committed snapshot (`version` "2027", generated 2026-06-20). Node v24.18.0 on the dev Mac (Apple
M1 Pro).

**2.1 The live taxonomy equals the snapshot.** The five maps derived from today's fetch are equal
to the committed ones, key for key and in the same key order: `bySci`, `byCom`, `byOrder`,
`byCode`, `reportAs`. FR-05's check passes today, so the generator will run in codes-only mode
(section 5.3) and FR-06 holds.

**2.2 The PRD's counts hold for what eBird publishes.** 17,193 of 17,891 entries carry a code;
all 11,167 species do; 698 entries carry none (694 spuhs, 4 slashes). 10,277 distinct codes: one of
length 2 (OU), four of length 3 (EMU, KEA, TUI, MAO), the rest length 4. Alphabet `A-Z` plus `Ö`
and `Ü`, every code NFC. No two published names are equal ignoring case. No name equals an
`Object.prototype` member. The longest name is 63 characters, 37 names contain a non-ASCII letter,
none contains a tab or newline. Up to 10 codes per entry; one code names up to 54 entries (ISTH).
**What the asset keeps after the American-name filter (2.7) is smaller:** 15,471 entries carry a
code, still including all 11,167 species; 8,951 distinct codes (OU, the same four three-letter
codes, 8,946 of length 4); at most 30 entries share one code (RECR); 13 codes contain `Ö` or `Ü`
(`BÖBE BÖFL FÜBO FÜLO LÜBU RÜBU RÜCH RÜGR RÜPA RÜRC RÜST RÜWA RÜWE`), all inside OQ-01's closed
alphabet.

**2.3 The parent fallback would lend codes to one published name eBird gives none.** FR-10's
fallback (an unknown name takes its normalized parent's codes) is meant for names from an older
revision. Applied to a name eBird DOES publish but gives no code, it invents one:
`vireo sp. (Red-eyed Vireo complex)` has no codes, and its normalized parent `vireo sp.` carries
UNVI, so `unvi` would find it. That contradicts Key Decision 1 ("a row matches the codes eBird
publishes for that row's own taxon entry") and FR-01 ("no code shall be added"). **Resolution:
the asset carries every published name, with `""` for the 698 that have no code**, so a published
name always resolves through its own entry and the fallback is reached only by names this revision
does not publish. Cost: +4.6 KB gzip, measured on eBird's full code set. It also turns FR-07's
"every key is a published name" into a set equality CI can assert in both directions. After the
American-name filter (2.7) the empty entries number 2,420 (mostly slashes and hybrids), the leak
above still exists (`vireo sp.` keeps UNVI, a banding code), and section 4.3's size already counts
every empty entry.

**2.4 "Species code" already means something else in this repo.** `lib/speciesCode.ts`
(`SPECIES_CODE_RE`) and every `taxonCode` / `speciesCode` field mean eBird's six-letter taxon code
(`yerwar`). Naming the new modules `speciesCodes*` beside `speciesCode.ts` would invite exactly the
mix-up the bird-name rules exist to prevent. The new modules and the asset are therefore named for
**alpha codes**, the standard term for the four-letter codes. User-facing copy is unaffected
(HELP says "code").

**2.5 One existing guard dictates the ranking function's signature.**
`components/speciesComboboxOptionsIdentity.test.tsx` counts predicate calls by mocking
`../lib/speciesMatch` as `{ ...original, matchesSpeciesQuery: spy }` and asserts
`expect(typing).toBeGreaterThan(0)` as its non-vacuity leg. A ranking function that called the
module's own `matchesSpeciesQuery` internally would bypass the spy (an ESM module's internal calls
do not go through its export binding), the count would read zero, and its non-vacuity rows (four
`typing > 0` legs and a `cost > 0` leg) would go red with nothing wrong. So `rankSpeciesMatches` takes the name predicate as a parameter and both consumers
pass the `matchesSpeciesQuery` binding they import (section 8.1). `lib/speciesMatch.test.ts`'s
existing rows also constrain the module: it must keep the two exact predicate spellings, contain no
`new RegExp`, `.match(`, `.replace(` or `.search(`, and the two consumers must not contain
`.name.toLowerCase().includes(` or `sciName ?? ''`.

**2.6 No existing assertion is exposed to the new ranking.** Every quoted string in the seven
NFR-15 suites plus the identity suite and `palettePublishedClaims.test.ts` was checked against the
live codes. Code-shaped strings appear (`crow`, `span`, `list`, `snow`, `sora`), but no fixture in
the same file carries any of them except `Sora` in `speciesIndex.test.ts`, which does no matching.
The Engineer re-runs this audit against the committed asset (verify item V-1), because a string
built at runtime would not show in a scan. (The audit ran over eBird's full code set; the filtered
asset is a subset, so it can only expose fewer.)

**2.7 The American-name filter, checked against eBird's own codes (2026-10-10).** The user decided
that a row matches its `bandingCodes` plus only the `comNameCodes` formed from the name SnowRaven
shows (decisions.md 2); the orchestrator added that hyphen-convention and accent-free spellings of
that name are variants and keep their codes (decisions.md 3, 4). The precise rule is section 5.2.
Measured over the same taxonomy, against every `comNameCodes` entry eBird publishes:

- **The strict reference rule** (`rule()` / `am_codes()` in the scratchpad's `american_only.py`:
  split on whitespace, hyphens and slashes, no variants) reproduces the Designer's figures exactly:
  15,441 entries with a code, 8,237 distinct codes, RECR the most shared at 30, 11 accented codes,
  3,375 species codes dropped (389 on species with banding codes). So the two implementations agree
  before variants are added.
- **Hyphen conventions.** eBird forms codes from the displayed name under three treatments of a
  hyphen, and the reference rule knows only the first: every hyphen part is a word (Common
  Wood-Pigeon: CWPI, the banding code), the hyphenated group noun is one word (COWO, FLST for Flying
  Steamer-Duck, SLWO for Sri Lanka Wood-Pigeon), or a two-word name takes two letters of the first
  word and the initials of the hyphenated second (COWP, SPWD for Spotted Whistling-Duck, GRPC for
  Greater Prairie-Chicken). Of the 14,938 non-banding `comNameCodes` the final rule keeps, 13,625
  are formed by the strict rule, 1,298 only by a hyphen variant, 13 only by the accent variant and 2
  by both. Every variant-only code in the samples inspected (about 100, across all three
  conventions) was spelled from the name shown; none came from another name.
- **Accents.** 13 entries (11 species and 2 forms) carry an accented name whose plain-letter code
  eBird also publishes: Rüppell's Bustard (RUBU), Griffon, Parrot, Warbler, Starling, Chat and
  Weaver, Lühder's Bushshrike, Fülleborn's Boubou and two of its forms, Fülleborn's Longclaw and
  Böhm's Flycatcher. Both spellings are kept (decisions.md 4).
- **What is dropped really comes from other names.** Species examples: Common Merganser GOOS
  (Goosander), European Starling COST (Common Starling), Dovekie LIAU (Little Auk), Common Loon GNDI
  (Great Northern Diver), Rock Pigeon RODO (Rock Dove), Green Heron GBHE and NAGH, Yellow-rumped
  Warbler MYWA (Myrtle Warbler), Emu COEM, Greater Sage-Grouse SAGR, Montezuma Quail MBQU, Willow
  Ptarmigan WIGR, Northern Yellow Warbler YEWA and AYWA, the island-thrushes' ISTH (the pre-split
  "Island Thrush"). Under the final rule 2,433 species codes drop, 366 of them on species with
  banding codes.
- **Every species keeps at least one code** (all 11,167), so FR-04(b)'s guard holds after
  filtering. The fail-closed guard stays (I5), now evaluated on the filtered asset.
- **Two readings decided here (decisions.md 5, 6).** A form's parenthesised qualifier never forms a
  code: forming codes from qualifiers would add 168 codes, many from other names (Green-winged Teal
  (Eurasian) EUTE) and one colliding with a familiar code (Sharp-shinned Hawk (Rufous-thighed)
  RTHA, Red-tailed Hawk's banding code). And a slash or hybrid forms one code from its whole
  displayed name, as the approved design-spec table states, so only 82 of 1,035 slashes and 19 of
  792 hybrids keep a code (`cago` no longer lists Cackling/Canada Goose, and Cape May x
  Yellow-rumped Warbler (hybrid) carries none). Expanding composites into their named components
  would restore 1,031 and 789 for about 6 KB gzip; that is offered to the user, not taken.

---

## 3. Data-layer state after this feature

| Item | Kind | How it is reached | Status |
|---|---|---|---|
| `frontend/src/assets/ebird-taxonomy.json` + `backend/staticdata/ebird_taxonomy.json` | bundled build-time, twins | dynamic import (desktop), FastAPI route (web/Pi) | unchanged, byte-identical |
| `frontend/src/assets/ebird-countability.json` | bundled, entry chunk | static import in `speciesUtils.ts` | unchanged, byte-identical |
| `frontend/src/assets/ebird-taxonomy-history.json` | bundled | dynamic import (Species Detail) | unchanged, byte-identical |
| **`frontend/src/assets/ebird-alpha-codes.json`** | **bundled build-time** | **dynamic import in `lib/alphaCodesAsset.ts` only** | **new** |
| `us-counties.json`, `noaa-tide-stations.json`, `ca-atlas-blocks.json` | bundled | lazy | unchanged |
| Species index (`lib/speciesIndex.ts`) | in memory, `WeakRef` memo on the parse | Search | unchanged |
| **Alpha-code index per list (`lib/alphaCodes.ts`)** | **in memory, `WeakMap` memo on the list's identity** | **Search and the shared picker** | **new** |
| Storage-seam documents, replay, derived caches, iCloud scope | persisted | | unchanged, none added |

---

## 4. The alpha-code asset

### 4.1 Location, loading, no backend twin

- **File:** `frontend/src/assets/ebird-alpha-codes.json`. Minified JSON, one line.
- **Consumed only by the frontend**, through the single `import()` in `lib/alphaCodesAsset.ts`
  (section 6). On web/Pi the FastAPI server serves `frontend/dist/` as static files, so the chunk
  reaches the browser like every other chunk. No backend twin, no route, no transport branch,
  nothing in `vite.config.ts`'s proxy, nothing in `backend/staticdata/`. The snapshot ships twice
  only because a backend route reads it; no route reads this one.
- **Network posture, in the durable form (CLAUDE.md, v1.0.38):** no third-party request, no new
  endpoint or host, and no request moved between components. On web/Pi the one HTTP request this
  feature adds is the fetch of a static chunk from the user's own server, the same class of request
  that loads a tab. On the Mac, Windows, iPhone, iPad and Android apps the chunk is in the bundle.
  The Tauri content security policy and HTTP permit are unaffected (a bundled module is `'self'`).
- **Trust boundary (NFR-09):** a Vite-inlined JSON import is build-time data. A user cannot change
  it without changing the code that reads it, and malformed JSON fails the build. Defended at build
  time (section 5) and CI time (section 15, `alphaCodesAsset.test.ts`). No per-entry runtime
  validation; the loader makes one structural check so FR-26 has a failure signal.

### 4.2 Shape

The TypeScript type lives in `lib/alphaCodes.ts` and is the contract; the JSON is its literal form.

```ts
export interface AlphaCodeTable {
  /** Asset schema version. Any other value is a load failure (FR-26), never a migration. */
  v: 1
  /** The taxonomy snapshot `version` generated in the same run ("2027"). CI asserts equality. */
  version: string
  /** ISO date the generator ran. Provenance only. */
  generated: string
  /**
   * EVERY published common name eBird lists (17,891 today), lowercased, in eBird's
   * taxonomic order, to that entry's KEPT codes (section 5.2): all of its `bandingCodes` in
   * published order, then each `comNameCodes` member that `nameFormedCodes` admits and that
   * is not already present, in published order, joined by ONE space. `""` for a published
   * name left with no code (section 2.3). Nested under one key so the top level has four
   * fields, never 17,891 (Vite's JSON named exports, and the snapshot's own precedent).
   */
  codes: Readonly<Record<string, string>>
}
```

Literal form (abridged; values re-derived 2026-10-10 with the final rule):

```json
{"v":1,"version":"2027","generated":"2026-10-10","codes":{"common ostrich":"COOS",
"canada goose":"CANG CAGO","cackling goose":"CACG CAGO","cackling/canada goose":"CCGO",
"common merganser":"COME","green heron":"GRHE","common wood-pigeon":"CWPI COWP COWO",
"yellow-rumped warbler":"YRWA","yellow-rumped warbler (myrtle)":"MYWA YRWA",
"yellow-rumped warbler (audubon's)":"AUWA YRWA","yellow-rumped warbler (west mexico)":"YRWA",
"cape may x yellow-rumped warbler (hybrid)":"","rüppell's bustard":"RUBU RÜBU",
"vireo sp. (red-eyed vireo complex)":"", ...}}
```

**Why a lowercased key is collision-safe (FR-02, the brief's ask):** measured 0 case-equal pairs
across all 17,891 published names, and the generator refuses to write if one ever appears (I4).
A key is the output of `String.prototype.toLowerCase`, which is locale-independent and identical on
every shipped engine, and the join lowercases the backup name the same way. Collisions of CODES
across names are not carried in the asset at all: each name holds its own codes, and the inverted
index the app builds (section 7) simply puts several names under one code. That is how `cago`
lists Canada Goose and Cackling Goose.

Kept codes are stored exactly as eBird publishes them (uppercase, `Ü` and `Ö` included); the filter
removes codes, it never rewrites one. The app lowercases them when it builds its index, so `rübu`
and `rubu` both find Rüppell's Bustard because eBird publishes both and both are formed from the
name shown (decisions.md 4), and nothing is folded in the app (OQ-01 default).

### 4.3 Why this encoding (measured)

Raw bytes, gzip and brotli of each candidate. The comparison rows were measured on 2026-10-08 over
eBird's full code set (before the American-name filter), which is fair for comparing shapes; the
chosen row is re-measured on 2026-10-10 with the filter. The comparison rows use gzip level 9; the
chosen row also shows level 6, which is what `zlib.gzipSync` defaults to and so what CI measures.

| Candidate | Raw | gzip | brotli | Verdict |
|---|---|---|---|---|
| Name to array of codes, taxonomic order (17,193 entries) | 672,279 | 155,415 | 126,970 | brackets and per-code quotes buy nothing |
| Same, keys sorted | 672,279 | 164,979 | 124,094 | sorting separates forms from their parents; gzip loses 9.5 KB |
| Name to space-joined codes, taxonomic (17,193 entries) | 618,997 | 153,427 | 125,397 | the shape chosen, before 2.3 |
| One string of `name<TAB>codes` lines | 584,622 | 151,972 | 124,868 | 1.5 KB smaller, but needs a 17k-entry `Map` build at load and a hand parser |
| Forms carry only their own codes (decoder adds the parent's) | 561,073 | 149,919 | 122,751 | 3.5 KB smaller for a decoder and a second invariant; rejected |
| Species only | 339,236 | 101,751 | 81,835 | loses every form's own code (`auwa`); refused by FR-01 and by floor I3 |
| Chosen shape over eBird's full code set (2026-10-08, before the filter) | 633,705 | 158,067 (level 9), 158,362 (level 6) | 129,184 | superseded by the row below |
| **Chosen: every published name to its kept codes, space-joined, taxonomic, with envelope (2026-10-10)** | **588,825** | **142,314 (level 9), 142,625 (level 6)** | **115,652** | **70% of the 204,800-byte budget** |

The chosen form is JSON that `JSON.parse` turns straight into the lookup object, so there is no
build pass at load; lookups are `Object.hasOwn` on that object (section 7). Vite emits a large JSON
import either as an object literal (about 589 KB) or as `JSON.parse("...")`, whose escaped quotes
make it 660,430 bytes raw and 146,293 gzip; both are under budget. The Engineer records which form
Vite 8 emits (verify item V-4). Web/Pi serve chunks uncompressed (`backend/main.py` mounts
`StaticFiles` with no gzip middleware), so a web or Pi session transfers about 0.59 to 0.66 MB from
its own server, once, after which the browser caches it.

### 4.4 Invariants (the generator refuses to write, and CI re-asserts, every one)

| ID | Invariant | PRD |
|---|---|---|
| I1 | `v === 1` and `version` equals the snapshot `version` written or kept by the same run | FR-04(f), FR-07 |
| I2 | The key set equals the set of published common names lowercased (the snapshot's `byCode` values), in both directions | FR-02, FR-07, section 2.3 |
| I3 | At least `MIN_ALPHA_CODE_ENTRIES` (13,000) keys carry a non-empty value. Measured 15,471 after the American-name filter (17,193 before it). Deliberately ABOVE the 11,167 species, so a derivation that dropped every non-species entry (the species-only row above, which loses `auwa`) is refused | FR-04(a) |
| I4 | No two published names are equal ignoring case (checked over the live taxonomy) | FR-04(d) |
| I5 | Every species name (the snapshot's `byCom` keys) has a non-empty value. Evaluated on the FILTERED asset, so it is the fail-closed guard that every species still has at least one code after the American-name filter (measured: all 11,167 do) | FR-04(b), FR-07 |
| I6 | Every value is `""` or codes joined by single spaces, no code repeated within one value; every code matches `ALPHA_CODE_RE = /^[A-Z\u00D6\u00DC]{2,4}$/` and is NFC (`c.normalize('NFC') === c`). The class is closed: a new character stops the build for a human decision | FR-04(c), FR-07 |
| I7 | Every key equals its own `toLowerCase()` | FR-02 |
| I8 | No own key is an `Object.prototype` member name (the twelve FR-04(e) lists, held in `PROTOTYPE_MEMBER_NAMES`; CI also asserts that list covers `Object.getOwnPropertyNames(Object.prototype)` in the test runtime, so a runtime that adds a member turns the guard red rather than leaving it short) | FR-04(e), FR-07, NFR-08 |
| I9 | `gzipSync(raw).length <= ALPHA_CODES_GZIP_MAX_BYTES` (204,800) | NFR-02 |
| I10 | **Generator only (needs the live `bandingCodes`).** Every kept code of an entry is one of its `bandingCodes` or a member of `nameFormedCodes(comName)` that eBird lists in its `comNameCodes`; and every `bandingCodes` member is kept. A self-check of the filter against its own definition, so a refactor that loosens or tightens it stops the build | FR-01, FR-04(g) |
| I11 | **Generator only.** No displayed name has more than `MAX_HYPHENATED_TOKENS` (4) hyphenated tokens (measured maximum 3), so the variant enumeration in 5.2 stays at most 16 word lists per spelling. A longer name is a new shape for a human to look at | FR-04(g) |
| I12 | **CI only, by name.** None of the named other-name codes is on the entry it was dropped from, and the dropped-everywhere ones are on no entry at all (the QA-42 roster in section 15). The CI test cannot re-run the filter, because the snapshot carries no `bandingCodes`, so it pins the decision by its examples instead | FR-07, QA-42 |

`ALPHA_CODE_RE` is written with `\u00D6` and `\u00DC` escapes, never literal letters (the
`bird-names.md` rule on invisible-in-diff characters). It is anchored, quantifier-bounded and only
ever applied to eBird's data in the generator and the CI test; no regex meets the typed query.

I8 also protects the existing snapshot derivation, which builds plain objects keyed on eBird names:
a published name of `__proto__` would corrupt `byCom` there, and since every published name is now
an alpha-code key, I8 refuses such a run before anything is written.

---

## 5. The generator

### 5.1 Files

- **New: `scripts/lib/ebirdTaxonomyDerive.mjs`**, the pure core of `build-ebird-taxonomy.mjs`
  (no I/O, no `process.exit`, no network), with **`scripts/lib/ebirdTaxonomyDerive.d.mts`** so the
  frontend guards import it with types (the `taxonomyHistoryDerive` precedent). Exports:

  ```js
  export const ALPHA_CODES_ASSET_VERSION = 1
  export const ALPHA_CODE_RE = /^[A-Z\u00D6\u00DC]{2,4}$/
  export const PROTOTYPE_MEMBER_NAMES = Object.freeze([/* the twelve FR-04(e) names */])
  export const MIN_ALPHA_CODE_ENTRIES = 13_000
  export const MAX_HYPHENATED_TOKENS = 4
  export const ALPHA_CODES_GZIP_MAX_BYTES = 204_800   // the ONE spelling of the NFR-02 bound
  export const REVISION_MESSAGE                       // section 5.3

  export function deriveSnapshotMaps(taxonomy)        // { bySci, byCom, byOrder, byCode, reportAs }
  export function nameFormedCodes(displayedName)      // Set<string>: the codes the shown name forms (5.2)
  export function entryAlphaCodes(taxon)              // string[]: the KEPT codes (5.2)
  export function deriveAlphaCodes(taxonomy, { version, generated })  // the asset object
  export function caseCollisions(taxonomy)            // string[]: names equal ignoring case
  export function checkAlphaCodes(asset, { speciesNames, publishedNames, snapshotVersion,
                                           minEntries = MIN_ALPHA_CODE_ENTRIES })  // string[] violations
  export function snapshotDrift(liveMaps, committed)  // string[]: maps that differ, with counts
  export function planTaxonomyRun({ live, committed, version, generated, minEntries })
  ```

- **Changed: `scripts/build-ebird-taxonomy.mjs`** becomes I/O only: fetch, read the committed
  snapshot, plan, guard, then one write loop (section 5.4). Its header names the new asset and the
  lib, and keeps the annual-revision reminder.

`deriveSnapshotMaps` is the body of today's `deriveBundle`, **moved verbatim**: the same plain
objects, the same skip of a code-less entry, the same species-only name maps, the same
`Math.trunc(Number(taxonOrder))`. The CLI keeps a `deriveBundle(taxonomy)` that returns
`{ version: VERSION, generated: GENERATED, ...deriveSnapshotMaps(taxonomy) }`, so the key order,
and therefore the bytes of a regenerated snapshot, are unchanged. Neither twin
(`taxonomyService.ts`, `backend/routers/taxonomy.py`) names this file or this function, so no twin
comment goes stale and `backend/` is not touched.

### 5.2 Derivation and the American-name rule (`deriveAlphaCodes`, `nameFormedCodes`)

**Derivation.** One pass over the live taxonomy in eBird's order. For each entry with a
`speciesCode` (the same skip rule `byCode` uses, so the key set equals the `byCode` value set): key
`comName.toLowerCase()`, value `entryAlphaCodes(taxon).join(' ')`. The accumulator is a `Map`,
emitted through `Object.fromEntries`, so a hostile name could never write a prototype during
derivation; I8 then refuses it.

**`entryAlphaCodes(taxon)`, the filter (decisions.md 2).** Runs here, at build time, so the
committed asset carries only kept codes and the app does no filtering of its own:

1. Every `bandingCodes` member, in published order (the North American banding codes, always kept).
2. Then each `comNameCodes` member, in published order, that is in `nameFormedCodes(comName)` and
   not already present.
3. Nothing else. A code is never edited, added or folded; `sciNameCodes` is never read.

**`nameFormedCodes(displayedName)`: the codes the shown name forms.** Returns a set; a published
code is kept when it is a member. Precisely:

1. **Qualifiers out.** Replace every parenthesised segment (an opening parenthesis, any run of
   characters containing no parenthesis, a closing parenthesis) with one space. A form's qualifier
   never forms a code (decisions.md 5); the form's own codes reach it through its `bandingCodes`
   (MYWA on the Myrtle form, AUWA on Audubon's, ORJU on Oregon).
2. **Apostrophes out.** Delete U+0027 and U+2019 (`Anna's` reads `Annas`).
3. **Two spellings (the accent variant, decisions.md 4).** Spelling A is the result as shown.
   Spelling B is the result with accents removed: NFD, delete every code point U+0300 to U+036F,
   NFC. Rüppell's gives `Ruppells` in B. Every step below runs on each spelling and the results
   are pooled.
4. **Tokens.** Split on runs of whitespace and on `/`. Trim leading and trailing hyphens from each
   token. Drop a token with no letter. A token may still contain inner hyphens.
5. **Words, under every hyphen convention (the hyphen variant, decisions.md 3).** Let the
   hyphenated tokens be h1..hk (k is at most 4, I11; at most 3 today). For each of the 2^k ways to
   treat each hyphenated token as either SPLIT (each hyphen-separated part is its own word:
   `Yellow-rumped` gives `Yellow`, `rumped`) or JOINED (one word with the hyphens deleted:
   `Wood-Pigeon` gives `WoodPigeon`), build the word list. Within a word, keep letters only
   (Unicode letter category; `\p{L}` in the generator); drop a word left empty.
6. **The standard four-letter rule on each word list.** One word: its first four letters (all of
   them if it has fewer: `Emu` gives EMU, `Ou` gives OU). Two words: the first two letters of each.
   Three words: the first letter of the first two words, then the first two letters of the third.
   Four or more: the first letter of each of the first four words.
7. **The initials convention.** When the name has exactly two tokens, the first with no hyphen and
   the second with one: the first two letters of the first token, then the first letter of each
   of the second token's first two hyphen parts (`Common Wood-Pigeon` gives COWP; `Spotted
   Whistling-Duck` SPWD; `Greater Prairie-Chicken` GRPC).
8. **Uppercase** each result (`String.prototype.toUpperCase`, locale-independent: `ü` gives `Ü`).

The rule is checked against eBird's own codes in section 2.7. Its pinned cases for the generator
test (QA-38), each the full set or a stated member:

| Displayed name | Formed codes include | Must NOT include |
|---|---|---|
| `American Robin` | AMRO | |
| `Yellow-rumped Warbler` | YRWA (split), YEWA (joined) | MYWA |
| `Yellow-rumped Warbler (Audubon's)` | YRWA | AUWA (a banding code, kept by step 1 of the filter, not formed) |
| `Great Blue Heron` | GBHE | |
| `Green Heron` | GRHE | GBHE |
| `Common Merganser` | COME | GOOS |
| `Rock Pigeon` | ROPI | RODO |
| `Common Wood-Pigeon` | CWPI, COWO, COWP | |
| `Black-crowned Night Heron` | BCNH | |
| `Rüppell's Bustard` | RÜBU, RUBU | RUKO, RÜKO |
| `Anna's Hummingbird` | ANHU | |
| `Emu`, `Ou`, `Kea` | EMU, OU, KEA | COEM |
| `Cackling/Canada Goose` | CCGO | CAGO, CANG |
| `Cape May x Yellow-rumped Warbler (hybrid)` | (the whole name as words: CMXY) | YRWA, CMWA, MYWA |

**Composites are not expanded (decisions.md 6).** A slash or hybrid forms its codes from its whole
displayed name, as the approved design-spec states, so it keeps its own banding codes and little
else (82 of 1,035 slashes and 19 of 792 hybrids keep any code). The reversal is a change to this
one function: also form codes from each named component (each part between `/` or ` x `, with the
last part's trailing words appended to an earlier part that omits them) and admit the components'
banding codes; measured, that restores 1,031 slashes and 789 hybrids for about 6 KB gzip.

**What the filter costs the app: nothing at runtime.** It runs once per generator run over 17,891
names (at most 2 spellings x 16 word lists each). The app never sees a dropped code.

### 5.3 The revision check and the write plan (FR-05, FR-06, OQ-05, OQ-06)

`planTaxonomyRun` derives the live maps and the alpha-code asset, then decides:

| Committed snapshot | Decision |
|---|---|
| Present, `version === VERSION`, `snapshotDrift` empty | **`codes-only`**: write `ebird-alpha-codes.json` and nothing else. Both snapshot twins, `ebird-countability.json` and `ebird-taxonomy-history.json` stay byte-identical (FR-06, QA-40) |
| Present, `version === VERSION`, any map differs | **`stop`** with `REVISION_MESSAGE`: eBird's taxonomy has moved past the shipped snapshot (version N); name the differing maps and counts; the annual-revision procedure in `.claude/rules/bird-names.md` applies (bump `VERSION` and `CACHE_KEY` together, re-run this script, then `build-taxonomy-history.mjs`); codes are never generated from a newer revision than the snapshot. Exit non-zero, write nothing |
| Present, `version !== VERSION` (a deliberate hand-bump) | **`all`**: write both snapshot twins, countability and the alpha-code asset together, as today plus the new one |
| Absent | **`all`** (today's behaviour for a fresh snapshot) |
| Present but not parseable JSON | **`stop`** |

`snapshotDrift` compares each of the five maps as a key-to-value set: same key count, and every
key present (`Object.hasOwn`) with an equal value. It is order-insensitive on purpose: a reorder
with the same content is not a revision. Codes themselves are not compared, because the snapshot
holds none; the guarantee is that codes are generated only from a live taxonomy whose five maps
equal the shipped ones.

The plan also runs the alpha-code checks so that a refusal is part of the plan, not a side effect:
`caseCollisions(live)` (I4), `checkAlphaCodes` with `speciesNames` and `publishedNames` taken from
the live taxonomy (I1 to I3, I5 to I8), and the size bound on the exact JSON string it would write
(I9). Any violation is a `stop`. A `write` plan carries `{ mode, bundle, alphaCodes,
alphaCodesJson }`.

### 5.4 Order of operations in the CLI (FR-04: nothing is written before every check)

1. `fetchTaxonomy()` (unchanged: requires `EBIRD_API_KEY`, exits on HTTP error or a non-array).
2. Read `frontend/src/assets/ebird-taxonomy.json` (absent is allowed; unparseable stops).
3. `plan = planTaxonomyRun(...)`. On `stop`: print every message, `process.exit(1)`.
4. `guard(plan.bundle, taxonomy.length)`, the existing snapshot floors, in both modes.
5. In `all` mode only: `deriveCountability(plan.bundle)` and its existing `guard`.
6. Build the list of `{ target, json }` writes for the mode.
7. **The only `writeFile` call in the file**, in one loop over that list.

Today's script writes the twins before it derives and guards countability, so a countability
refusal could leave new twins on disk. Step 7 closes that: no guard runs after the first write.
QA-38's "writes nothing" is then structural, and a source row (section 15) asserts `writeFile(`
appears exactly once in the CLI, after `planTaxonomyRun(`.

### 5.5 Running it in this build

- Run `node --env-file=backend/.env scripts/build-ebird-taxonomy.mjs` with a key in the
  environment. **This worktree has no `backend/.env`**; the Engineer needs `EBIRD_API_KEY` from
  the user's environment, and must not read another checkout's `.env` without asking (CLAUDE.md,
  other worktrees). Flagged for the Designer stage.
- Expected output: `codes-only` mode, one file written. `git diff --stat main` then lists only the
  new asset among `frontend/src/assets/` and nothing under `backend/staticdata/` (QA-40).
- eBird's annual update usually lands in late October. If it lands first, step 3 stops the run and
  the build returns to the user (OQ-06 default). Generate early in Stage 5.

---

## 6. Loading: `lib/alphaCodesAsset.ts` and `lib/useAlphaCodes.ts`

`lib/alphaCodesAsset.ts` is the one place app code names the asset. Shape, on the
`taxonomyHistoryAsset.ts` precedent plus a store, because two surfaces must re-render when it
arrives:

```ts
import type { AlphaCodeTable } from './alphaCodes'

type Importer = () => Promise<{ default: unknown }>
const importAsset: Importer = () => import('../assets/ebird-alpha-codes.json')

let importer: Importer = importAsset
let pending: Promise<AlphaCodeTable | null> | null = null
let table: AlphaCodeTable | null = null
const listeners = new Set<() => void>()

/** Start the load if nothing has; idempotent, memoized for the session, never rejects. */
export function loadAlphaCodes(): Promise<AlphaCodeTable | null>
/** The loaded table, or null while pending, after a failure, or before anything asked. */
export function getAlphaCodes(): AlphaCodeTable | null
/** useSyncExternalStore's subscribe. Notified once, when the table arrives. */
export function subscribeAlphaCodes(listener: () => void): () => void
/** TEST SEAMS ONLY. */
export function _setAlphaCodesImporterForTests(fn: Importer | null): void
export function _resetAlphaCodesForTests(): void
```

- **Structural check only:** `v === 1`, `typeof version === 'string'`, `codes` a non-null,
  non-array object. Fail resolves `null`; a rejected import resolves `null` (`.catch(() => null)`).
- **Failure (FR-26, OQ-04):** `table` stays `null`, `pending` stays the settled promise, so there
  is no retry within the session, no message, no alert, no announcement; every surface matches
  names exactly as today. Same posture as `loadTaxonomyHistory`: a bundled asset that fails to load
  is a build defect, not a user condition.
- **Arrival:** set `table`, then call each listener. A listener that throws cannot reject the
  promise (the `.catch` maps it to `null`), and React's store listeners do not throw.
- **The asset path appears exactly once, inside `import(`** (the entryChunk guard reads this).
  The importer seam lets tests count calls (QA-32), hold the promise forever (QA-31), reject or
  hand back a wrong shape (QA-34).
- **Nothing calls `loadAlphaCodes` at module evaluation or app start (FR-24, OQ-07 default).**

`lib/useAlphaCodes.ts`:

```ts
export function useAlphaCodes(): AlphaCodeTable | null {
  return useSyncExternalStore(subscribeAlphaCodes, getAlphaCodes, getAlphaCodes)
}
```

It subscribes and never starts a load. The two load triggers are explicit (section 9), so "the
code data starts loading no later than the first Search open or the first picker open, and not at
app start" is a property of two named lines rather than of which components happen to mount.

---

## 7. The join: `lib/alphaCodes.ts`

Pure, no React, no I/O. Its only value import is `normalizeSpeciesName` from `./speciesUtils`,
which is already on the entry graph (it carries `ebird-countability.json`), so importing it from
this lazy module adds nothing to first paint.

```ts
export interface AlphaCodeTable { ... }                 // section 4.2
/** Lowercased alpha code -> the names in ONE list that carry it. */
export type AlphaCodeIndex = ReadonlyMap<string, ReadonlySet<string>>

/** A name's codes: its own published entry; else its normalized parent's; else none (FR-10). */
export function alphaCodesForName(table: AlphaCodeTable, name: string): readonly string[]
/** One pass over a list: the inverted index for exactly the names in it. */
export function buildAlphaCodeIndex(table: AlphaCodeTable, rows: readonly { name: string }[]): AlphaCodeIndex
/** The memoized index for this list (WeakMap on the list's identity, checked against the table). */
export function alphaCodeIndexFor(table: AlphaCodeTable, rows: readonly { name: string }[]): AlphaCodeIndex
/** The names in `rows` carrying the normalized query `q` as a code, or undefined. */
export function alphaCodeHits(table: AlphaCodeTable | null, rows: readonly { name: string }[], q: string): ReadonlySet<string> | undefined
```

**`alphaCodesForName` (FR-10, NFR-08).**
1. `lc = name.toLowerCase()`. If `Object.hasOwn(table.codes, lc)`: return its value split on
   `' '`, or a frozen empty array for `""`. A published name ALWAYS stops here (section 2.3).
2. Else `parent = normalizeSpeciesName(name).toLowerCase()` (the app's existing normalizer:
   trims, then removes one trailing parenthetical). If `parent !== lc` and
   `Object.hasOwn(table.codes, parent)`: return the parent's codes. This is the older-revision
   case (`Yellow-rumped Warbler (Old Form)` finds YRWA through its parent, QA-12), and it
   also covers a stray surrounding space in a backup name.
3. Else a frozen empty array: the row matches by name only. Re-exporting from eBird fixes it.

Every read is `Object.hasOwn`-gated, never a bare `obj[key]` reached by an unchecked string; a
backup name of `__proto__`, `constructor`, `toString`, `valueOf` or `hasOwnProperty` is not an own
key (I8), so it takes no codes and matches by name only (QA-36). The values are trusted (I6), so
no per-value type check is made.

**`buildAlphaCodeIndex`.** One pass over the list. Per row: `alphaCodesForName`, then for each
code (at most 10) `code.toLowerCase()` and an add into a `Map<string, Set<string>>`. Keys are
codes from the trusted asset; the user's names are only ever Set members, never keys. A work
counter (incremented once per row looked up, read only by tests; the `speciesUtils.ts` `_recomputes`
precedent) makes "the join runs once" and the doubling test countable (QA-45, QA-46).

**`alphaCodeIndexFor`: lifetime (NFR-10, FR-27).** A module-scope
`WeakMap<object, { table, index }>` keyed on the list array. A hit requires the stored `table` to
be the current one. This is the multi-key form of `speciesIndex.ts`'s `WeakRef` memo, and it is
stricter: the key is held weakly and the value lives only while the key does, so there is not even
the derived-value residual the `WeakRef` pattern carries. Search's list is the species index, whose
identity changes exactly when the parse changes (the `speciesIndex.ts` argument); each picker's
list is its call site's memoized `options`, whose identity is pinned by
`speciesComboboxOptionsIdentity.test.tsx`. So replacing or clearing the backup gives each surface a
new list, the next keystroke joins the new names, and the old index becomes unreachable with no
teardown and no `clearDerived.ts` row (the v1.0.20 boundary: nothing on disk to delete, and a row
would turn `cacheInventory.test.ts` red for a store that does not exist). Up to five lists are
alive at once (Search plus four pickers), which is why a single `WeakRef` slot is the wrong shape
here: alternating keys would defeat it (the capacity+1 rule), and a `WeakMap` cannot be defeated
that way.

**`alphaCodeHits`.** `undefined` when `table` is `null` or `q` is empty; otherwise
`alphaCodeIndexFor(table, rows).get(q)`. `Map.get` on the typed query is hostile-safe
(`__proto__` is an ordinary missing key, QA-37). There is no length rule (Key Decision 3): a query
that is not a code simply misses. The join is lazy: it runs on the first non-empty query after the
table arrives, so a closed picker never joins.

---

## 8. Matching and ranking: `lib/speciesMatch.ts`

`normalizeSpeciesQuery` and `matchesSpeciesQuery` are **unchanged, byte for byte** (FR-11, the
extraction note). The module still imports nothing. Three additions:

### 8.1 `rankSpeciesMatches`: the ranking rule, defined once (FR-12, FR-13, FR-18, OQ-02)

```ts
export function rankSpeciesMatches<T extends { name: string; sciName?: string }>(
  rows: readonly T[],
  q: string,                                   // already normalized, non-empty
  codeHits: ReadonlySet<string> | undefined,   // from alphaCodeHits for THIS list
  matchesName: (row: T, q: string) => boolean, // callers pass matchesSpeciesQuery (section 2.5)
  order?: (a: T, b: T) => number,              // Search passes compareSpeciesName; pickers pass none
): T[]
```

- **No hits** (`undefined` or empty): `rows.filter(r => matchesName(r, q))`, then `.sort(order)`
  when `order` is given. That is today's palette (filter, then `compareSpeciesName`) and today's
  picker (filter, upstream order) exactly, so FR-18's non-code invariant is the old code path
  rather than an equivalent of it.
- **Hits:** one pass. A row whose `name` is in `codeHits` goes to the code group and is not tested
  by name (so it is listed once, FR-12); otherwise it goes to the name group when `matchesName`
  holds. Each group is sorted by `order` when given (`Array.prototype.sort` is stable, and
  `compareSpeciesName` is a total order on distinct names), then the code group is concatenated
  ahead of the name group.
- No `localeCompare`, no `RegExp`, no `.match(` / `.replace(` / `.search(` (the module's existing
  source rows forbid them).

**OQ-02 is isolated here.** The default (accept: a four-letter name prefix that is also a code puts
the code bird first) is this function as written. Any mitigation the Designer proposes and the user
approves is a change to this one function, which already receives everything such a rule could
need: the rows, the query, the hits and the name predicate. Because it only acts when `codeHits` is
non-empty, no mitigation can disturb a non-code query.

### 8.2 `highlightOnCodeArrival`: FR-25 defined once (OQ-03)

```ts
/** When the code data arrives mid-session: keep `active`, or clear it (-1). */
export function highlightOnCodeArrival(
  active: number,                // the surface's current highlight index
  firstSpeciesIndex: number,     // Search: destinationCount. Picker: allLabel ? 1 : 0
  before: readonly string[],     // species row names before arrival
  after: readonly string[],      // species row names after arrival
): number
```

Returns `active` when `active < firstSpeciesIndex` (nothing, a destination, the inbox row or "All
species" is highlighted: kept) or when `before` and `after` are equal element by element (rows
unchanged: nothing changes, the highlight included). Otherwise `-1`, so the highlight never moves
to a different bird on its own.

---

## 9. Consumers

### 9.1 `lib/paletteRows.ts`

`PaletteRowsInput` gains `alphaCodes?: AlphaCodeTable | null` (absent or `null` means no code
data). Inside the existing `if (q && index)` block:

```ts
const hits = alphaCodeHits(input.alphaCodes ?? null, index, q)
const matched = rankSpeciesMatches(index, q, hits, matchesSpeciesQuery, compareSpeciesName)
if (matched.length > cap) { speciesTruncated = true; matched.length = cap }
```

The cap now applies to the ranked list (FR-14): code matches are cut only when they alone exceed
it. Destinations, the inbox row and their label filter are untouched (FR-15). Existing callers that
pass no `alphaCodes` get today's output exactly. The header's "its only value import is
`speciesMatch`" becomes "`speciesMatch` and `alphaCodes`", both off the entry graph.

### 9.2 `components/CommandPalette.tsx`

- **Load trigger (FR-24):** `useEffect(() => { void loadAlphaCodes() }, [])`, beside the focus
  effect. The palette mounts fresh on every open, and the loader is memoized, so this is "the first
  Search open in a session" and costs a resolved-promise check thereafter.
- **Read:** `const alphaCodes = useAlphaCodes()`, added to `buildPaletteRows`' input and to its
  `useMemo` deps.
- **FR-25, adjusted during render, never in an effect.** An effect would let one commit show the
  highlight, and `aria-activedescendant`, on a different bird before clearing it. The component
  already uses the render-phase pattern for `statusSeq`:

  ```ts
  // `current` is this render's buildPaletteRows result; `active` its clamped highlight.
  // speciesNames(r) = r.rows.slice(r.destinationCount).map(row => row.name)
  const [alphaSeen, setAlphaSeen] = useState(alphaCodes)
  if (alphaSeen !== alphaCodes) {
    setAlphaSeen(alphaCodes)
    const before = buildPaletteRows({ items, index, query, inbox, alphaCodes: alphaSeen })
    const next = highlightOnCodeArrival(active, current.destinationCount,
      speciesNames(before), speciesNames(current))
    if (next !== active) setActiveIdx(next)
  }
  ```

  `destinationCount` is the same before and after (destinations never depend on codes). The extra
  `buildPaletteRows` runs once per session per open palette. Enter, arrows, the clamp and the four
  species-half sentences are unchanged.

### 9.3 `components/SpeciesCombobox.tsx`

- **Load trigger (FR-24):** `useEffect(() => { if (open) void loadAlphaCodes() }, [open])`. Every
  path that opens the list (focus, typing, ArrowDown, the toggle) sets `open`, so this is "the first
  focus on a picker's input" and covers the toggle too.
- **Read and rank:**

  ```ts
  const alphaCodes = useAlphaCodes()
  const filtered = useMemo(() => {
    const q = normalizeSpeciesQuery(query)
    if (!q) return options
    return rankSpeciesMatches(options, q, alphaCodeHits(alphaCodes, options, q), matchesSpeciesQuery)
  }, [options, query, alphaCodes])
  ```

  No `order`: each picker keeps the order it was handed (FR-13). The `rows` memo still prepends
  "All species" (FR-16), and Enter's `rows.find(r => r.kind === 'species')` now lands on the first
  code match when there is one (FR-17) with no change to that line.
- **FR-25:** the same render-phase block, with `firstSpeciesIndex = allLabel != null ? 1 : 0`,
  `before` recomputed with the previous table, and only when the query is non-empty and
  `activeIdx >= 0`.
- A closed picker with an empty query does no work when the table arrives: `filtered` returns
  `options` unchanged, so `rows` keeps its identity.

### 9.4 The four call sites: no change (FR-20, QA-28)

`SpeciesDetail.tsx`, `Calendar.tsx`, `MapExplorer.tsx` and `WeatherStatsSection.tsx` gain no
import and no line. A fifth picker built on `SpeciesCombobox` gets codes by construction.
Out-of-scope surfaces (Media Targets target-species box, Checklists comment search, Targets County
picker, Named Birds tick list) import none of the new modules (FR-21).

---

## 10. Declared scans over untrusted text, and the `security.md` globs

Declared up front with their linearity arguments (CLAUDE.md v1.0.23, `.claude/rules/security.md`).

| Scan | Where | Input | Shape and bound |
|---|---|---|---|
| Typed query, per keystroke | `alphaCodeHits` + `rankSpeciesMatches` | the query; each listed row's name | One `normalizeSpeciesQuery` (existing, linear). One `WeakMap.get` (identity) and one `Map.get(q)` (hash, linear in the query's length). On a non-code query that is ALL: the row pass is today's `filter` and gains nothing. On a code query: per row one `Set.has(row.name)` (hash of a string the engine has already hashed on insertion, otherwise linear in the name) inside the existing single pass, then today's `includes` for rows not in the code group. Total O(query length + sum of row name lengths), the bound today's pass already has. No `RegExp`, no `indexOf` to the end of a string, no nested loop |
| Backup names, once per list | `buildAlphaCodeIndex` | each listed name | Per row: one `toLowerCase` (linear), one `Object.hasOwn` (hash, linear). Only on a miss: one `normalizeSpeciesName` (existing; memoized under its own bounds, linear per its declaration), one more `toLowerCase` and `hasOwn`. Then at most 10 codes of at most 4 characters each, each a `toLowerCase` and a `Map`/`Set` add. Total O(sum of name lengths). Runs once per (list identity, table) |
| Arrival recompute, once per session per open surface | sections 9.2 and 9.3 | the same list | One more ranking pass and one element-wise name compare. Linear |
| Generator scans | `scripts/lib/ebirdTaxonomyDerive.mjs` | eBird's published data, at build time | Trusted input, not a runtime path; listed so nothing is undeclared |

**Measurement duty for the Engineer (security.md's method, QA-46):** through the real exported
entry points, join plus one ranking pass at 1k, 2k, 4k and 8k distinct names, asserted two ways:
exact work done (the join counter equals the row count; no row is looked up twice) and CPU time via
`frontend/src/test/cpuTiming.ts` `bestPerCallCpuMs` at no more than 2.2x per doubling, never wall
clock, with an explicit `testTimeout`. Plus a hostile leg where every name is 4,000 characters and
none is published (so every row takes the fallback through `normalizeSpeciesName`), held to the same
quotient.

**`.claude/rules/security.md` `paths` gains (FR-32, QA-57):**
- `frontend/src/lib/speciesMatch.ts` (the shared matcher, not gated today; it now ranks)
- `frontend/src/lib/paletteRows.ts` (gains the code lookup over typed text)
- `frontend/src/lib/alphaCodes*.ts` (the join over backup names and its loader; the glob also
  covers their tests)

**`.claude/rules/bird-names.md` `paths` gains:** `frontend/src/assets/ebird-alpha-codes.json`,
`frontend/src/lib/alphaCodes*.ts`, `scripts/lib/ebirdTaxonomyDerive*`. Its annual-revision
paragraph (the snapshot bullet) gains one sentence: the alpha-code asset is written by the same
run and refreshes with the snapshot, and with `VERSION` unchanged the generator refuses a live
taxonomy that has moved, so the hand-bump of `VERSION` and `CACHE_KEY` comes first.

---

## 11. Costs, measured on the dev Mac (NFR-04)

Node v24.18.0, Apple M1 Pro, the chosen asset, synthetic backups drawn from published names with
2% unknown forms. Engine figures are Node's V8; the Engineer re-measures in the dev desktop app
(WebKit) and records both (verify item V-3).

| Cost | When | Measured |
|---|---|---|
| `JSON.parse` of the asset | once per session, first Search or picker open, after that surface's first paint | 3.1 ms median (p10 3.05, p90 3.74) on the filtered asset; 3.3 ms on the unfiltered one |
| Compile and evaluate the `JSON.parse` chunk form | same, if Vite emits that form | 3.4 ms median, measured on the larger unfiltered asset, so an upper bound |
| Join (`buildAlphaCodeIndex`) | once per list after arrival, on the first non-empty query | 0.50 ms at 1,000 distinct names; 0.88 ms at 2,000; 1.79 ms at 4,000; 4.5 ms at 8,000 |
| Ranking pass, 2,000 rows | per keystroke | 0.09 to 0.11 ms median, code and non-code queries alike |
| Re-draw on arrival | once per session per mounted surface | open surface with a query: one extra ranking pass; closed picker or empty query: a memo dependency check, no join |

A realistic personal backup holds roughly 300 to 2,000 distinct names, so the first code query
costs about a millisecond on top of a one-time 3 to 4 ms parse, never on a keystroke path and
never before destinations or name matches render (FR-23). No clamp is declared, so there is no
clamp cost to state.

---

## 12. Persistence: none

No storage-seam document or setting, no `localStorage`, no `docChains` link, no `CACHED_GET_PATHS`
or `EBIRD_GATED_PATHS` change, no replay entry, no iCloud scope change, no `clearDerived.ts` row,
no `PRIVACY_POLICY.md` change. The alpha-code index is an in-memory derivation keyed on user data,
outside `clearDerived.ts` by design, terminated by its `WeakMap` (section 7). The loaded table is
session-scoped and identical for every user and backup.

---

## 13. Unchanged, confirmed in scope

`backend/` entirely (routes, `/taxonomy/codes`, `staticdata`); `lib/tauri/taxonomyService.ts`, its
live fetch and `CACHE_KEY`; `lib/speciesIndex.ts`; `lib/paletteSpeciesLoad.ts`; `lib/paletteCopy.ts`
(the cap line stays true); `frontend/vite.config.ts`; `src-tauri/tauri.conf.json` (CSP) and
`src-tauri/capabilities/` (HTTP permit); `README.md`, `website/`, `appstore/LISTING.md`,
`PRIVACY_POLICY.md`, `ACCESSIBILITY.md` (FR-31; the ship's version stamp aside); every existing
asset's bytes (FR-06).

---

## 14. Files the Engineer creates or touches

**Created**

| Path | Role |
|---|---|
| `frontend/src/assets/ebird-alpha-codes.json` | the asset (generated, committed) |
| `scripts/lib/ebirdTaxonomyDerive.mjs` | the generator's pure core (5.1) |
| `scripts/lib/ebirdTaxonomyDerive.d.mts` | its types, for the frontend guards |
| `frontend/src/lib/alphaCodes.ts` | types, the join, the `WeakMap` memo, `alphaCodeHits` |
| `frontend/src/lib/alphaCodesAsset.ts` | the loader and store; the one `import()` |
| `frontend/src/lib/useAlphaCodes.ts` | the subscribe-only hook |
| `frontend/src/test/alphaCodeRoster.ts` | the shared QA-01 to QA-16 roster, run in node and jsdom |
| test files | section 15 |

**Changed**

| Path | Change |
|---|---|
| `scripts/build-ebird-taxonomy.mjs` | I/O only; plan, guards, one write loop; header names the new asset and lib |
| `frontend/src/lib/speciesMatch.ts` | `rankSpeciesMatches`, `highlightOnCodeArrival`; the two existing functions byte-identical |
| `frontend/src/lib/paletteRows.ts` | optional `alphaCodes` input; ranks before capping |
| `frontend/src/components/CommandPalette.tsx` | load trigger, `useAlphaCodes`, FR-25 block |
| `frontend/src/components/SpeciesCombobox.tsx` | load trigger, `useAlphaCodes`, ranking, FR-25 block; header comment |
| `docs/HELP.md` | FR-28 (Search: the Species bullet and the "listed alphabetically" sentence), FR-29 (the four picker passages). Written without a stop |
| `.claude/rules/security.md`, `.claude/rules/bird-names.md` | `paths` (section 10) and the annual-revision sentence |
| `CHANGELOG.md` and the four-file version set | at ship (FR-33) |

---

## 15. Tests this design obligates

**New**

| File | Covers |
|---|---|
| `lib/alphaCodesAsset.test.ts` (node) | The CI guard for the committed asset (FR-07, QA-41, QA-42, QA-44). Reads the asset and snapshot with `readFileSync`. Runs the shared `checkAlphaCodes` with `speciesNames = keys(byCom)` and `publishedNames = lowercased values(byCode)`, AND re-asserts I1, I2, I5, I6, I8 in its own code. I9 against `ALPHA_CODES_GZIP_MAX_BYTES` imported from the lib (one spelling). Spot checks (QA-42, I12), re-derived 2026-10-10: Yellow-rumped Warbler exactly `YRWA` (MYWA absent); (Myrtle) `MYWA YRWA`; (Audubon's) `AUWA YRWA`; (West Mexico) exactly `YRWA` (AUWA and MYWA absent); Canada Goose `CANG CAGO`; Cackling Goose `CACG CAGO`; Cackling/Canada Goose exactly `CCGO`; Cape May x Yellow-rumped Warbler (hybrid) `""`; Green Heron exactly `GRHE`; Common Merganser exactly `COME`; Rock Pigeon exactly `ROPI`; European Starling exactly `EUST`; Common Loon exactly `COLO`; Dovekie exactly `DOVE`; Rüppell's Bustard `RUBU RÜBU` (RUKO and RÜKO absent); Common Wood-Pigeon `CWPI COWP COWO`; Common Ostrich exactly `COOS` (STCA absent). On NO entry: GOOS, COST, RODO, LIAU, GNDI, ISTH, FEPI. Mutation rows, each red on BOTH the checker and the independent leg: re-spelled `version`; one species emptied; one species key removed; an unpublished key added; a code `R1BU`; an own `__proto__` key added through `JSON.parse` of edited text; a value with a doubled space |
| `lib/alphaCodesGenerator.test.ts` (node) | QA-38, QA-39 over `ebirdTaxonomyDerive.mjs` with in-memory fixtures, no network. Refusals: a short count (default floor); a species with both code fields empty; codes `RÄBU`, `AB1`, `A`, `ABCDE`, `abcd`, decomposed `RÜBU`; two names equal ignoring case; a `constructor` name; a version mismatch. Accepts `RÜBU`, `BÖSP`, `OU`, `EMU` and a fixture mirroring real shapes (forms, hybrids, a code-less spuh). **The American-name filter:** `nameFormedCodes` over section 5.2's pinned table, every row; `entryAlphaCodes` keeps every banding code, keeps a formed `comNameCodes` member, drops an other-name one (fixture entries shaped like Common Merganser `band [COME] com [GOOS]`, Green Heron `band [GRHE] com [NAGH, GBHE]`, Rüppell's Bustard `com [RUBU, RUKO, RÜBU, RÜKO]`, the Audubon's form `band [AUWA] com [YRWA, MYWA]`), and never reorders or edits a kept code. Refusals added by the filter: a species whose codes all come from other names (no banding code, every `comNameCodes` member unformed) stops the build (I5 after filtering); a filter mutated to keep everything, or to drop banding codes, stops it (I10); a name with five hyphenated tokens stops it (I11). Plan rows: equal maps under the same version give `codes-only` with one file; one `byCom` entry changed gives `stop` with the revision message; an advanced version gives `all`; an unparseable committed snapshot gives `stop`. `deriveSnapshotMaps` over a fixture equals hand-written maps (pins the move). Source rows over the CLI: `writeFile(` occurs exactly once and after `planTaxonomyRun(` |
| `lib/alphaCodesLoader.test.ts` (node) | Through the importer seam: the import runs once across many `loadAlphaCodes` calls (QA-32); reject and wrong shape each resolve `null`, leave `getAlphaCodes()` `null`, and never call the importer again (QA-34); a never-settling import leaves the store `null` (QA-31); listeners fire once on arrival |
| `lib/alphaCodes.test.ts` (node) | `alphaCodesForName`: own entry, `""` entry (no fallback for a published name: `vireo sp. (Red-eyed Vireo complex)` gets nothing), parent fallback (QA-12), neither; hostile names (QA-36 at the function level). Index: forms (QA-10, QA-11), collisions. Memo: same list and table give the same index object; a new list or table rebuilds; the counter shows one join for 50 lookups (QA-45, QA-48). Linearity and hostile legs (section 10, QA-46) |
| `lib/alphaCodeSearch.test.ts` (node) + `lib/alphaCodeSearch.jsdom.test.ts` (jsdom docblock) | The roster in `test/alphaCodeRoster.ts` with the real asset: QA-01 to QA-16, QA-19 to QA-22 through `buildPaletteRows`, and the picker path through `rankSpeciesMatches` with no `order`. The roster carries the amended rows: `goos`, `cost` and `rodo` give no code-group row and exactly today's rows (Common Merganser, European Starling and Rock Pigeon in the fixture); `gbhe` lists Great Blue Heron and not Green Heron; `mywa` lists the Myrtle form only, never the species, Audubon's or a hybrid; `auwa` lists Audubon's only, not West Mexico; `cago` lists Canada and Cackling Goose and not the slash; `rubu` and `rübu` both find Rüppell's Bustard; `cowp`, `cowo` and `cwpi` all find Common Wood-Pigeon. QA-17 against an inline copy of today's algorithm as an independent oracle. QA-18 corpus (output with the table equals output with `null` whenever no fixture row carries the query; asserts both counts so it cannot pass vacuously; explicit `testTimeout`). QA-26, QA-37. The jsdom twin re-runs QA-01 to QA-16 (QA-49) |
| `components/SpeciesCombobox.alphaCodes.test.tsx` (jsdom) | QA-23, QA-24, QA-30 (row structure identical for a code match and a name match), QA-31 and QA-34 for the picker, QA-33 (arrival: rows update without retyping; a species highlight clears only when rows changed; "All species" highlight kept), QA-36 |
| `components/CommandPalette.alphaCodes.test.tsx` (jsdom) | QA-01 Enter opens Species Detail, QA-22, QA-31 (destinations and `calypte` immediate; `yrwa` shows today's "Nothing matches that search." while pending), QA-32 (no load before open; once across five opens), QA-33 (including a highlighted destination kept), QA-34, QA-35 (through the real observations cache and files epoch, the `CommandPalette.test.tsx` FR-31 harness), QA-36, QA-50's `aria-activedescendant` row |
| `components/speciesComboboxAlphaCodes.callSites.test.tsx` (jsdom) | QA-25 and QA-27 on the four mounted tabs, reusing the identity suite's mounting harness and fixture shape |
| `lib/alphaCodeWiring.test.ts` (node) | Source scans: QA-28 (the four call sites import neither the asset nor `alphaCodes*`), QA-29, QA-45 (no `RegExp` or regex method in `alphaCodes*.ts`), QA-47 (no new module imports `transport`, `storage`, `fetch` or a Tauri HTTP call), QA-49 (no `localeCompare` in the new or changed matching code), QA-57 (each new and named path matched by the rule files' `paths`), and both consumers pass `matchesSpeciesQuery` to `rankSpeciesMatches` |

**Extended (new rows only; no existing assertion edited, NFR-15)**

| File | Rows |
|---|---|
| `lib/speciesMatch.test.ts` | `rankSpeciesMatches`: no hits equals `filter` (and `filter` then `sort` with `order`) element for element; partition, order within groups, no duplicate; QA-03. `highlightOnCodeArrival`: each branch |
| `lib/paletteRows.test.ts` | `alphaCodes` absent and `null` both equal today's output on the existing fixtures |
| `lib/entryChunk.test.ts` | QA-43: the asset, `alphaCodes.ts`, `alphaCodesAsset.ts` and `useAlphaCodes.ts` are absent from `App.tsx`'s closure; the asset is absent from `CommandPalette.tsx`'s and `SpeciesCombobox.tsx`'s static closures; both closures DO reach the three modules (guard the guard); the loader names the asset once, inside `import(`. Post-build: `ebird-alpha-codes` joins the modulepreload negative regex, and exactly one `ebird-alpha-codes-*.js` chunk exists |
| `lib/palettePublishedClaims.test.ts` | QA-52, QA-53, QA-54 (every backticked code HELP publishes is run through the real asset and `buildPaletteRows` on a one-bird fixture and must return that bird first); the unqualified "listed alphabetically" claim cannot return, with today's sentence as the guard-the-guard |

**Unchanged and green:** `speciesIndex.test.ts`, `SpeciesCombobox.test.tsx`,
`CommandPalette.test.tsx`, `MapExplorerSpeciesFilter.test.tsx`, `WeatherStatsSection.test.tsx`,
`speciesComboboxOptionsIdentity.test.tsx`, `cacheInventory.test.ts`, `tauriCsp.test.ts`,
`tauriHttpScope.test.ts`, `taxonomyHistoryAsset.test.ts`, `countableForms.test.ts`.

---

## 16. Build order (the migration plan)

1. `scripts/lib/ebirdTaxonomyDerive.mjs` and `.d.mts`; `alphaCodesGenerator.test.ts` green.
2. Restructure the CLI (5.4).
3. Run the generator (5.5); confirm `codes-only`; commit-ready asset; QA-40 diff check.
4. `alphaCodesAsset.test.ts`, each mutation row seen red first.
5. `alphaCodes.ts`, `alphaCodesAsset.ts`, `useAlphaCodes.ts` and their tests.
6. `speciesMatch.ts` additions and rows.
7. `paletteRows.ts`, `CommandPalette.tsx`, `SpeciesCombobox.tsx`.
8. `entryChunk.test.ts` rows, the wiring scans, the roster and corpus, component and call-site
   suites.
9. `docs/HELP.md` and `palettePublishedClaims.test.ts`; both rule files; the generator header.
10. `npm run typecheck`, `npm run build` (the post-build entryChunk rows run), the full frontend
    suite, the backend suite.

---

## 17. Engineer verify-items and carried risks

- **V-1** Re-run the section 2.6 audit mechanically against the committed asset: every string typed
  or passed as a query in the NFR-15 suites and the identity suite, against every fixture name in
  the same file. Any hit where an existing assertion would see a reorder is a conflict to report,
  never an assertion to edit.
- **V-2** The identity suite (`speciesComboboxOptionsIdentity.test.tsx`) passes unmodified, which
  proves `SpeciesCombobox` still calls the imported `matchesSpeciesQuery` binding (section 2.5).
- **V-3** Measure the first load (import to table available) and one join in the dev desktop app
  under WebKit with the user's real backup, and record both beside section 11's Node figures in
  the run's decisions.
- **V-4** Record which form Vite 8 emits for the JSON chunk and its raw and gzip size; confirm one
  `ebird-alpha-codes-*.js` chunk and no modulepreload of it.
- **V-6** On the generator run, compare the written asset with section 2.7 and 2.2's figures for
  the same taxonomy revision: 15,471 entries with a code, 8,951 distinct codes, RECR the most
  shared at 30, 13 accented codes, every species keeping one. A difference means the
  implementation reads the rule differently from section 5.2; reconcile the reading, never just
  the figure.
- **V-5** Component tests now load the real asset in the background whenever a picker opens or the
  palette mounts. That can print React `act()` warnings in existing suites; they are not failures
  (the test setup does not fail on `console.error`). A suite that needs a settled state awaits
  `loadAlphaCodes()` or stubs the importer; none needs an existing assertion changed.
- **R-1** eBird's annual update before generation stops the run (OQ-06). Generate first in Stage 5.
- **R-2** `EBIRD_API_KEY` is not in this worktree (5.5).
- **R-3** A backup carrying a decomposed (NFD) accented name, such as `Ru` plus a combining
  diaeresis in Rüppell's, misses its own entry and its parent and matches by name only. eBird
  exports NFC, as its taxonomy is; accepted, not folded (OQ-01's "nothing is folded").

---

## 18. Open questions resolved here, and requirement traceability

| Item | Resolution |
|---|---|
| OQ-01 | Default: `A-Z`, `Ö`, `Ü`, NFC, closed class (I6). The accent-free twin is kept beside the accented code where eBird publishes both and both are formed from the shown name (decisions.md 4) |
| OQ-02 | **Resolved by the user at the Designer stage, 2026-10-10: rule A stands** (decisions.md 1); isolated in `rankSpeciesMatches` (8.1) |
| OQ-03 | Default: `highlightOnCodeArrival`, applied during render (8.2, 9.2, 9.3) |
| OQ-04 | Default: no retry; the memoized promise stays settled (6) |
| OQ-05 | Default: `codes-only` mode writes only the new asset (5.3) |
| OQ-06 | Default: the revision check stops the run (5.3) |
| OQ-07 | Default: first Search open or first picker open; nothing at app start (6, 9.2, 9.3) |
| OQ-08 | Default: a row matches only its own codes, so folded and hidden-forms lists do not offer a form's code (7) |

| Requirement | Where |
|---|---|
| FR-01 (amended: the American-name filter), FR-02, FR-03 | 2.7, 4.2, 5.2, 5.4 |
| FR-04 | 4.4, 5.3, 5.4 |
| FR-05, FR-06 | 2.1, 5.3 |
| FR-07 | 4.4, 15 |
| FR-08, FR-09, FR-10, FR-11, FR-12 | 7, 8.1 |
| FR-13, FR-14, FR-15, FR-16, FR-17 | 8.1, 9.1, 9.3 |
| FR-18, FR-19 | 8.1 (no hits is the old path), 7 (codes are per name) |
| FR-20, FR-21, FR-22 | 9.4; no render change anywhere |
| FR-23, FR-24, FR-25, FR-26, FR-27 | 6, 7, 8.2, 9.2, 9.3 |
| FR-28 to FR-31 | 14, 15 |
| FR-32 | 10 |
| FR-33 | 14 |
| NFR-01 | 6, 15 (entryChunk) |
| NFR-02 | 4.3, 4.4 (I9) |
| NFR-03 to NFR-05 | 10, 11 |
| NFR-06, NFR-07 | 4.1 |
| NFR-08 | 4.4 (I8), 7 |
| NFR-09 | 4.1 |
| NFR-10 | 7, 12 |
| NFR-11 | 8.1 |
| NFR-12, NFR-13 | no new control, row, label, region or name rendering; rows render as today |
| NFR-14 | `Map`, `Set`, `WeakMap`, `Object.hasOwn`, dynamic `import()`, React's `useSyncExternalStore`; no new runtime API needs a check |
| NFR-15, NFR-16 | 15, 17 |
