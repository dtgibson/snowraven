# Schema - Recorded Names in Splits and Lumps

**Feature:** recorded-names-in-splits-and-lumps
**Date:** 2026-11-18
**Stage:** 3 - The Architect
**Source:** prd.md (37 FRs, 9 NFRs), strategic-brief.md (approved)
**Extends:** `pipeline/taxonomic-splits-lumps/schema.md` (the shipped data layer; cited below as **TSL-S** with its section number). Anything in that schema this document does not name stays in force.

## Path

**Incremental (extending the existing schema).** A shipped `schema.md` exists for this data layer and this feature changes a bundled build-time asset, its generator, its CI guards and the in-memory derivation over the backup. It is not frontend-only, because a committed data artifact with a generator and a trust boundary changes shape. It is not a migration, because nothing stored is remapped: the app persists nothing for this feature before or after. `pipeline.config.json` exists and is unchanged. (Running hands-off: declared here, not confirmed in chat. The sub-file `architect-incremental` was fetched and followed.)

Every figure below marked **measured** was read on 2026-11-18 from the committed assets (`ebird-taxonomy-history.json`, `v` 1, snapshot `2028`, 582 events over 7 updates; `ebird-taxonomy.json`, 18,631 codes, 11,201 species), from Cornell's 16 per-year files in the gitignored `scripts/taxonomy-history-input/`, and from a scratch prototype of the derivation. Nothing in the tree was edited or regenerated. The prototype is a patched copy of the shipped `taxonomyHistory.ts`; its figures are the Architect's and the Engineer re-measures each one on the real implementation.

---

## 1. The design in one paragraph

The record gains a top-level `renames` array beside `events`, and each lump's earlier name gains an optional `form` (the name of the form eBird kept for it). `events` keeps holding splits and lumps only, so every existing reader of `events`, the Statistics escapee join first among them, reads exactly what it read before. The generator derives renames from Cornell's consecutive per-year taxonomy files under one normalization (`renameKey`), cross-checks each one against the integrated checklist's own English-name-change annotation, and holds each renamed code's chain to the bundled snapshot's present name. At runtime `taxonomyHistory.ts` merges the two arrays into one dated list, matches a rename's earlier name by retired-name identity only, and extends the one row pass with a single hash lookup that recognizes a kept form. Every new figure is a function of the shipped per-entry tallies plus one new counter per traced lump name. Nothing is stored, requested or synced.

---

## 2. Measured findings that shape the design

**2.1 Renames merged into `events` would widen the escapee join.** `buildEscapeeJoin` walks every event of the latest covered update and keys each before-side name. Measured: the join holds 39 entries on the committed record; with the 146 renames of 2026 merged into `events` and the join left as shipped it holds 185. With renames in their own array it holds the same 39, key for key and value for value. The separate array is therefore load-bearing, not a style choice (section 3.2, section 9).

**2.2 The cutoff in FR-03, applied exactly as written, reproduces the brief.** Of 695 species codes whose common name differs between consecutive files, 45 share a code with a split or lump entry of the same update and are excluded by FR-02, 135 are equal under FR-03 and are left out, and **515 are kept** (515 of 650, the brief's figure). Per update, kept / left out / excluded-for-an-event: 2019 60 / 33 / 2; 2021 50 / 50 / 8; 2022 53 / 19 / 6; 2023 62 / 22 / 9; 2024 131 / 4 / 13; 2025 13 / 0 / 3; 2026 146 / 7 / 4. Scientific-name-only changes (956) yield nothing. 510 codes are renamed; 5 are renamed twice; none more. `mcclon` reads McCown's Longspur to Thick-billed Longspur, dated 2021-09-08 (QA-04).

**2.3 An independent check for renames exists inside Cornell's files.** There is no announced rename total. But the integrated checklist (a different file from the taxonomy file the renames are derived from) annotates each species row whose English name changed: "name change - English name" (2019), "name change: English name" (2021, 2022), "name change - English" and "name change - English and sciname" (2023 to 2026). Measured: **512 of the 515 kept renames sit on a row carrying that annotation**; the 3 that do not are Rufous-tailed Bush-hen to Pale-vented Bush-hen (2019), Yellow-green Finch to Yellow-green Brushfinch (2019) and Blue-gray Saltator to Bluish-gray Saltator (2022). This is what plays the announced tally's role (section 4.3, R8).

**2.4 A second oracle outside the generator's inputs: the snapshot.** The bundled snapshot comes from eBird's API, not from Cornell's CSVs. Measured: for all 505 renamed codes that are still species, the last rename's new name equals the snapshot's name for the code under FR-03 (504 exactly; 1 differs in spelling only, Nankeen Night-Heron against today's Nankeen Night Heron). The other 5 renamed codes are no longer species and every one is on the before side of a later split or lump. All 5 two-rename chains connect exactly (the first event's new name is the second's earlier name). These become invariants R6 and R7.

**2.5 Kept forms.** Applying FR-06 to the committed record and snapshot (measured): of 229 earlier names in 101 lumps, **157 are traced**, 40 are the lumped species' own code (the surviving name) and 32 have no kept form. 49 lumps are traced in full, 33 in part, 19 not at all. These equal the PRD's OQ-01 figures. All 157 kept-form names are distinct, none is a species name, every one is countable under `isNonCountableForm`, and every one folds through `normalizeSpeciesName` to the present name of its lump's surviving code. Pacific-slope and Cordilleran Flycatcher trace to "Western Flycatcher (Pacific-slope)" and "Western Flycatcher (Cordilleran)"; American Crow is the surviving name and Northwestern Crow has no form (QA-06).

**2.6 Recognizing a rename's earlier name changes 14 shipped readings, all for the better.** Extending the shipped retired-name tier to renames (FR-09 asks for exactly that) changes how a row under a name *that a rename retired* is read at split and lump events. Measured over one probe backup per name, for all 2,664 names in the record, with the codes lookup present and absent: 14 names differ, and all 14 are earlier names of a rename. The roster is in section 6.3 with each direction argued. No other name's split or lump figure moves, and on the account owner's backup no shipped figure moves at all (0 of 582 events).

**2.7 Neither the account owner's backup nor the demo dataset holds a renamed species.** Measured, aggregates only: the stored backup (21,856 rows, 2024-02-22 to 2026-07-11, 268 species keys) has 0 species whose code carries a rename, and 2 rows under a kept-form name, both dated after its lump. The demo dataset (7,869 rows, 149 species keys) has 0 renamed species and 0 kept-form rows; its affected count is 11 before and after. Consequences are in the flags (section 14).

---

## 3. The record: `frontend/src/assets/ebird-taxonomy-history.json`

### 3.1 Location, loading, trust boundary: unchanged

One minified line, keys sorted, dynamically imported by `lib/taxonomyHistoryAsset.ts` and nowhere else, on its own chunk, with no backend twin (TSL-S 3.1). It stays a build-time artifact defended by the fail-closed generator and by CI; no per-entry runtime validation is added (NFR-02).

### 3.2 Shape (version 2)

```ts
export interface TaxonomyHistory {
  /** Asset schema version. 2 since renames joined. Any other value is a load failure (TSL FR-28). */
  v: 2
  snapshot: string                 // unchanged
  generated: string                // unchanged
  inputs: string[]                 // unchanged
  updates: HistoryUpdate[]         // unchanged; still derived from the split and lump events
  coverage: { earliest: HistoryUpdate; latest: HistoryUpdate } | null   // unchanged
  /** Splits and lumps ONLY, in the shipped order. No rename is ever a member. */
  events: HistoryEvent[]
  /** NEW. Word-changing common-name renames, ascending by `published`, then by the
   *  earlier name's scientific name (unique among species within one year's file). */
  renames: HistoryRename[]
}

export interface HistoryRename {
  kind: 'rename'
  /** The update whose file first carries the new name (FR-04). Always a member of `updates`. */
  year: number
  published: string
  /** Exactly one: the name the PREVIOUS update's file gives the code. */
  before: [HistoryBeforeEntry]
  /** Exactly one, same `code` as `before[0]`: the name THIS update's file gives the code.
   *  Never rewritten to the snapshot's present name, so a code renamed twice reads
   *  A to B, then B to C (FR-01). */
  after: [HistoryEntry]
  /** Always empty. Present so a rename has the event shape and one slot builder serves all three kinds. */
  slashes: []
}

export interface HistoryBeforeEntry extends HistoryEntry {
  retired: boolean                 // unchanged rule (I7), now also on a rename's earlier name
  /** NEW, lump events only. The kept form's CURRENT common name (the snapshot's
   *  `byCode[code]`). Present exactly when FR-06 holds; absent otherwise. The kept
   *  form's code is this entry's own `code`, so no second code is stored. */
  form?: string
}
```

`HistoryEvent`, `HistoryEntry` and `HistoryUpdate` are otherwise as shipped (`kind: 'split' | 'lump'`).

**Why a second array and not a third `kind` inside `events`.** Finding 2.1. It also makes FR-05's "every split and lump event exactly as the committed record holds it" structural: the rename path never touches `events`. The only change inside `events` is the added `form` key on lump before entries, so the Engineer's equality check is "the regenerated `events`, with `form` removed, deep-equals `git show HEAD:` events, 582 of 582".

**Why the full event shape and not a compact one.** FR-01 lists the fields (kind, year, published, one earlier and one current-side entry each with code, scientific and common name, a retired flag, no slashes), and one shape lets the runtime build slots, tallies and views with the shipped code. Cost measured: 41,181 bytes over a compact form (code once, no `kind`, no `slashes`). It fits (section 3.5), and the compact form is the recorded lever if the bound is ever threatened.

**What lump tracing needs, and what it does not.** Only `form`. The pre-lump slash is not recorded: plain lumped-name reports are the residual by subtraction (section 7), so nothing identifies the slash. No form code is recorded, because the backup carries no codes and the match is on the name (FR-16). The reason an earlier name is not traceable is derived, not stored: the entry's code equals the lump's after code (surviving name) or it does not (no kept form).

**Version handling.** `v` moves from 1 to 2 because the contract gained a required member (`renames`) and a reader that ignores it would silently show no renames, which is indistinguishable from "this backup has none". The loader's shape check becomes `v === 2 && Array.isArray(events) && Array.isArray(updates) && Array.isArray(renames)`. The record and its readers ship in one bundle, and the chunk name is content-hashed, so there is no skew to migrate; an annual refresh does not change `v`.

### 3.3 Invariants added (the generator refuses to emit, and CI re-asserts, each one unless marked)

I1 to I11 of TSL-S 3.3 stand over `events`, with I1 reading `v === 2`. Added:

| # | Invariant | Owner |
|---|---|---|
| R1 | Every rename has `kind: 'rename'`, exactly one `before` and one `after` with the SAME code, empty `slashes`, non-empty `code`/`sci`/`com` passing I4 and I11, and a (year, published) pair that is a member of `updates` | both |
| R2 | `renameKey(before.com) !== renameKey(after.com)` (FR-03, section 4.2) | both |
| R3 | The code appears on no before, after or slash entry of any split or lump of the same `year` | both |
| R4 | At most one rename per (code, year) | both |
| R5 | `retired === !Object.hasOwn(snapshot.byCom, before.com.toLowerCase())` | both |
| R6 | Chain continuity: for consecutive renames of one code, the later's earlier name equals the earlier's new name under `renameKey`, unless a split or lump of an update between them (the later's own update included) carries the code | both |
| R7 | Chain end: for the LAST rename of each code, if no later split or lump carries the code then the code is a species in the snapshot and `renameKey(after.com) === renameKey(snapshot.byCode[code])`; otherwise a later split or lump carries the code on its before side or its after side | both |
| R8 | Every rename's species row in that update's integrated checklist carries an English-name-change annotation, or the rename is a cited row of `RENAMES_UNANNOTATED` (section 4.3) | generator only (CI cannot read Cornell's files) |
| R9 | `renames` sorted by (`published`, `before[0].sci`) | both |
| K1 | A lump before entry has `form` exactly when the snapshot carries its code, the code is not a species, the code is not the lump's after code, and `reportAs[code]` is the lump's after code; `form === snapshot.byCode[code]` (FR-06) | generator derives; CI re-derives independently in the test body |
| K2 | `form` appears on no split entry, no after or slash entry, and no rename entry | both |
| K3 | Kept-form names are distinct across the whole record and none is a species common name in the snapshot | both |
| K4 | Every kept form is countable (`isNonCountableForm(form) === false`) and `normalizeSpeciesName(form)` resolves through `byCom` to its lump's after code | CI only (the generator imports no app code) |
| I10 | unchanged: committed byte length `<= historyMaxBytes(updates.length)`, constants unchanged | CI |

K4 is a non-vacuity check, not a safety one: a kept form that failed it would simply never be counted (section 7), so the identity in FR-17 cannot break. It turns CI red at a refresh so a person sees it.

### 3.4 What the generator refuses on for renames (FR-05)

Writes nothing and exits non-zero when: a rename lacks a code, either name, either scientific name or a published date (R1); its two names are equal under FR-03 (R2); its code is on a split or lump entry of the same update (R3); one code has two renames in one update (R4); a chain does not connect (R6); a chain does not end at the snapshot's name (R7); a kept rename is neither annotated nor cited (R8); a kept-form fact disagrees with the snapshot (K1 to K3); or any shipped condition of TSL-S 4.3 fails, the announced split and lump tallies included. R2, R3 and R4 cannot arise from the derivation itself (they are its own conditions); they are re-checked on the serialized object by the shared checker so a later edit to the derivation cannot emit them, and so QA-05's injected faults have something to hit.

### 3.5 Size (FR-07, NFR-03): the bound does not move

Measured with the generator's own key-sorted serialization:

| Record | Bytes | gzip |
|---|---|---|
| Committed today (`v` 1) | 226,245 | 39,098 |
| Plus `form` on 157 lump entries | 232,505 | |
| Plus 515 renames in the event shape (this design) | **363,933** | 58,627 |
| The same with a compact rename shape (not chosen) | 322,752 | |
| `historyMaxBytes(7)` = 16,384 + 65,536 x 7 | 475,136 | |

The record uses 76.6% of the bound with 111,203 bytes of headroom. `HISTORY_BYTES_PER_UPDATE`, `HISTORY_BYTES_ENVELOPE` and `HISTORY_BYTES_CEILING` are not raised. A rename event averages 255 bytes. The 2026 update contributes 37,302 bytes of renames and 13,183 of splits and lumps, 50,485 against the 65,536 each update adds to the bound, so headroom grows in an ordinary year. A year with roughly twice 2026's renames would spend headroom instead; if the guard ever goes red at a refresh the lever is the compact rename shape, decided then with a measurement, never a raised constant on its own.

The record stays off the entry chunk: its one reference is still the `import()` in `taxonomyHistoryAsset.ts`, and the three shipped `entryChunk.test.ts` rows (TSL-S 5.3) cover it unchanged.

---

## 4. The generator

`scripts/build-taxonomy-history.mjs` (CLI) and its pure core `scripts/lib/taxonomyHistoryDerive.mjs`, as shipped. No new input file: renames read the two taxonomy files each covered update already requires (its own and the previous update's; the 2018 file for 2019, the 2019 file for 2021) and the update's integrated checklist, already required. The generator still never fetches and reads no key.

### 4.1 Rename derivation (FR-02)

After the split and lump events of update Y are derived, for every code in `taxY` with `category === 'species'`:

1. Skip unless `taxP` (the previous update's file) carries the same code with `category === 'species'`.
2. Skip when the code is on a before, after or slash entry of any split or lump event of Y.
3. Skip when `renameKey(taxP.com) === renameKey(taxY.com)`. Count these as "left out under FR-03" when the raw names differ.
4. Otherwise emit `{ kind: 'rename', year: Y, published, before: [{ code, sci: taxP.sci, com: taxP.com, retired }], after: [{ code, sci: taxY.sci, com: taxY.com }], slashes: [] }`.

A scientific-name-only change never reaches step 4 (the common names are identical). A rename with a changed code never reaches step 1 (FR-10): it is not detected and the app says nothing about it. One code renamed in two updates yields two events. `retired` is computed by the shipped pass that computes it for every before entry. **The shipped pass that rewrites after-side names to the snapshot's present names does not run over renames**, which is what keeps A to B, B to C.

### 4.2 The cutoff, stated once (FR-03, NFR-07)

One exported function in `scripts/lib/taxonomyHistoryDerive.mjs`, the single definition:

```
renameKey(name) =
  1. name.normalize('NFD'), then delete every code point U+0300 to U+036F
  2. toLowerCase()
  3. replace every occurrence of "grey" with "gray"
  4. delete every U+002D (hyphen-minus), every U+0020 (space), and every one of
     U+0027, U+2018, U+2019, U+0060, U+02BC, U+02BB
```

Two names are the same name exactly when their keys are equal. Any other difference is a rename: a single letter, a period, a non-breaking hyphen (U+2011) or a no-break space (U+00A0) all count, because the steps do not name them. Names reach it already trimmed by `readTaxonomy`.

Every code point above is written as a `\uXXXX` escape in source, never as the literal character (`.claude/rules/testing.md`, v1.0.22 and its four recurrences: an agent's editing tools turn written escapes into literals, and combining marks cannot be seen in a diff). After writing, the Engineer greps the file for literal non-ASCII and the generator's suite carries a source row asserting that the derive module's code, comments stripped, holds none.

The app never evaluates `renameKey`: no module under `frontend/src` other than a test imports `scripts/lib/taxonomyHistoryDerive.mjs`. The CI test imports it, as it already imports `checkHistory`, and pins it with literal rows (section 10).

### 4.3 The independent check that replaces an announced total (R8)

Per covered update, join each integrated-checklist species row to `taxY` by scientific name (the shipped join) and mark a code **annotated** when the row's change cell, lowercased, contains `english`. Every emitted rename must be annotated, or be a row of a new cited table:

```js
/** Renames Cornell's integrated checklist does not annotate as an English name change.
 *  Each row is a person's reading of eBird's update page for that year, with its URL. */
export const RENAMES_UNANNOTATED = Object.freeze({
  2019: [{ code, from, to, source }, { code, from, to, source }],
  2022: [{ code, from, to, source }],
})
```

A row matches by year, code and both names exactly, so an invented entry admits nothing else (the lesson of `SLASHES_DROPPED`, whose code-only match is a recorded follow-up). The three measured rows are named in finding 2.3; the Engineer fills `code` from the files and `source` from eBird's 2019 and 2022 update pages, which the user reads in a browser because those pages refuse scripts. If a source cannot be read before the build ends, the row is marked `assumed` and the generator refuses it, exactly as `UPDATE_PUBLISHED` refuses an assumed date; that is a blocker to raise, not to work around.

What this check does and does not close. It closes the false rename: eBird re-uses codes, so a code that means one species in one file and another in the next would otherwise be emitted as a rename, and such a row carries no English-name-change annotation (3 of the 515 change genus and epithet as well as the common name, which is the shape to worry about; measured, all 3 are annotated and each is one species moved to another genus with its epithet's ending following: `sutspi1`, `lolwar1`, `palowl2`). It does not close a missed rename. That risk is bounded three ways: the rule is a pure comparison of two files, so a rename can be missed only by exclusion (R3) or by a changed code (FR-10, a stated limit); R7 fails the run when a renamed code's chain does not end at the snapshot's name; and the generator prints, per update, the annotated rows that produced no rename, grouped by reason (code new in this update, on an event of this update, equal under FR-03, name unchanged in eBird's file), which the runbook has a person read.

### 4.4 Kept forms (FR-06, K1)

In the shipped post-pass over events, for every before entry `b` of every lump with after entry `a`: set `b.form = snapshot.byCode[b.code]` when `Object.hasOwn(snapshot.byCode, b.code)`, `b.code !== a.code`, `b.code` is not a species in the snapshot, and `Object.hasOwn(snapshot.reportAs, b.code) && snapshot.reportAs[b.code] === a.code`; otherwise leave `form` absent. This is the kept-form rule's one definition (NFR-07). The CI test re-derives it independently from the committed snapshot and compares entry by entry (FR-07).

**OQ-02, tested and not adopted.** A scientific-name match (a form under the lumped species whose trinomial ends in the earlier species' epithet) was run against Cornell's 2026 file. On the 157 names where the code already gives the answer it agrees on 91, is silent on 64 and **picks a different form on 2** (Common Redpoll to "Redpoll (flammea)" where eBird kept "Redpoll (Common)"; Hoary Redpoll likewise). On the 32 names with no kept form it proposes 3 (Lord Howe White-eye, Barlow's Lark, Chestnut Owlet). A matcher that is wrong twice where the truth is known is not exact, and the bundled snapshot carries no scientific names for forms, so CI could not re-derive it from the bundled taxonomy as FR-07 requires. The default stands: those names are not traceable.

### 4.5 Output on success

The shipped line, plus per covered update: renames kept, name changes left out under FR-03, name changes excluded for sharing an event, and annotated rows that produced no rename by reason; then the traced / surviving / no-form counts over lump earlier names. These are printed for a person to read, never typed into a test (section 10).

---

## 5. CI guards (FR-07)

All in the existing files; each new figure is read from the committed assets when the test runs.

- **`taxonomyHistoryAsset.test.ts`**: R1 to R7, R9 and K1 to K4 through the shared checker AND re-asserted independently in the test body for the load-bearing rows (R2, R3, R5, R7, K1), as I1, I5, I7, I9 and I10 are today. Mutation rows, each seen red and restored from one top-of-file snapshot: a rename with equal names; a rename sharing a code with a split of its update; a rename moved into `events`; a flipped `retired`; a last rename whose new name is not the snapshot's; a `form` added where the snapshot has none; a `form` removed where it has one; a `form` set to a species name; the file padded past the bound (QA-07). The "current" check over the whole asset (TSL-S 6.4, security L1) extends to renames: every rename after entry the runtime marks current has a code that is a species in the snapshot.
- **`taxonomyHistoryGenerator.test.ts`**: QA-02 and QA-10 over two-update fixture files (a renamed code yields one event; a code on a split or lump of that update yields none; a code that is a species in only one file yields none; a scientific-name-only change yields none; a code renamed in two updates yields A to B then B to C; a rename with a changed code yields none); QA-03 as literal rows through `renameKey`, one per ignored difference, one combining several, and the three that must differ; one row per refusal of section 3.4, asserting a throw that names the row and no returned object; the R8 rows (annotated passes, unannotated refuses, cited passes, a cited row with a wrong name refuses); and the non-ASCII source row.
- **`exoticTaxonomyJoin.test.ts`**: section 9.
- **`entryChunk.test.ts`**: unchanged rows stay; add one negative with its positive leg: no non-test module under `frontend/src` imports `scripts/lib/taxonomyHistoryDerive`, and the two generator-facing tests do.

---

## 6. The derivation: `frontend/src/lib/taxonomyHistory.ts`

Still pure, still one module, still imports only `normalizeSpeciesName`, `isNonCountableForm` and `SPECIES_CODE_RE`. **No new module holds any part of the scan**, so the security gate that covers this file keeps covering all of it (section 8).

### 6.1 One dated list

At index build, merge `history.events` and `history.renames` into one list in a single linear pass (both are sorted by `published`; on an equal date splits and lumps come first). Every shipped structure is built over that list: slots, `eventSlots`, the chain maps, `lastAfterAt`, `lastSeen`, the views. `eventIndex` addresses the merged list. The merged list holds references to the record's own event objects; nothing is copied.

### 6.2 Matching (amends TSL-S 6.2)

| Entry | Tier 0 (retired name) | Tier 1 (current code) | Tier 2 (names, no code) |
|---|---|---|---|
| Rename, current-side | n/a | by code, with every other after entry (shipped `afterByCode`) | by (sci, com), sci, com, as any after entry |
| Rename, earlier name | **only here**, when `retired` | never: its code is on its own event's after side, which the shipped `afterCodes` test already excludes | **never indexed** (new) |

- **A rename's earlier name is reached by retired-name identity and by nothing else.** This is FR-09 in both of its halves: a retired earlier name in an older backup is recognized exactly as a split's is, and a name eBird has since given to another species (4 of the 515 are not retired, for example Malaysian Partridge, now another species' name, and the St. Helena Crake and Rail pair that exchanged names) can never count on the rename, with the codes lookup present or absent. The tier-1 half rests on the shipped `afterCodes` exclusion and the tier-2 half on the new non-indexing; they are separate guards over separate paths, and each owes its own row (QA-09's two legs) and its own mutation.
- **Tier-2 closure (new).** After tier 2 resolves, for each matched after-side entry add every rename after entry with the same code. Tier 1 reaches those by code; without the closure a code renamed twice would show its first rename as a chain-only line with no tallies whenever the codes batch has not landed.
- **Tier-0 closures.** The shipped `midChainTier0` rule runs unchanged over the merged list: a matched retired name also matches every EARLIER after-side entry with the same code, and at an event where both sides matched the after side wins. One rule is added for a rename's earlier name only: it also matches every split or lump BEFORE entry carrying the same code at an event published LATER than the rename. Reason: a rename does not change which species a code means, so a row that predates the rename predates every later update on that code. It is never extended to a later rename's earlier name (FR-09: only a report under that name counts there).

### 6.3 The 14 shipped readings that change (finding 2.6), each direction argued

Replacing a predicate owes its symmetric difference in both directions (`.claude/rules/testing.md`, v1.0.32). Measured as stated in 2.6:

| Direction | Names (measured) | Why the new reading is the true one |
|---|---|---|
| "Predates update U" becomes "after side at U" (8) | Red-headed Fody, Southern Boobook, Hottentot Buttonquail, Cape Lark, Yellow-margined Flycatcher, Waved Woodpecker, Red-crowned Parakeet, Gray-throated White-eye | The name was still current after U and was retired by a LATER rename. Shipped reads a 2025 export's Red-crowned Parakeet as predating the 2024 lump, which it postdates. The rename's own line now carries the "predates" reading |
| "After side at U" becomes "predates U" (4) | White-headed Black-Chat, Madagascar Brush-Warbler, Malagasy Scops-Owl, Red-lored Parrot | The name was retired by a rename EARLIER than U, so the export predates U. Shipped reached U through the scientific-name fallback and landed on the after side, the nominate-daughter misreading TSL-S 2.2 describes |
| "Not affected" becomes "after side at an earlier split" (2) | Comoros Cuckooshrike, Sharpe's Lark | The name is a split daughter's earlier name; shipped could not resolve it at all |
| Narrowing: a reading lost | none | With the forward rule of 6.2. Without it Siao Pitta lost its "predates the 2023 lump" reading, which is why the rule exists |

Every one of the 14 is a row in a backup exported before a rename of that species. No name outside "an earlier name of a rename, retired" changes, and the guard asserts that as a property (section 10), not as the count 14, which next year's refresh will move. The stated limits of TSL-S 6.2 stand: a name an update kept still cannot date an export on its own.

### 6.4 The row pass (amends TSL-S 6.3)

```
for each row o:
  if isNonCountableForm(o.commonName): ...shipped, unchanged...; continue
  key = normalizeSpeciesName(o.commonName)
  ids = entriesByKey.get(key) ?? resolve and cache          // shipped
  for id of ids: tally(id, o.date, key)                      // shipped
  kept = keptByRawName.get(o.commonName)                     // NEW: one Map.get on the raw name
  if kept !== undefined:
    for each before-slot b in kept:                          // K3 makes this one slot
      e = slots[b].event
      if o.date <= published(e):                             // the shipped comparison, same operands
        for each id in ids:                                  // integer compares only
          if slots[id].event === e and slots[id].side === 'after':
            slots[b].formOnOrBefore += 1; break
```

`keptByRawName` is built at index build from the record alone: kept form name to the lump before slots that carry it. The inner test is what makes the count "the lumped name's direct reports ... whose reported name is that earlier name's kept form" (FR-16): the row must also have been tallied on that lump's after entry. The date test is the shipped `date <= published` on the same operands, so no second date comparison exists (FR-11). The loops are hand-written `for` loops; no `includes`, `indexOf`, `find` or `filter` enters the pass.

### 6.5 Output (amends TSL-S 6.4)

```ts
export type HistoryKind = 'split' | 'lump' | 'rename'     // AffectedEvent.kind, EventView.kind, HistoryListEntry events

export interface EventView {
  kind: HistoryKind
  year: number; published: string
  before: readonly EntryView[]; after: readonly EntryView[]; slashes: readonly EntryView[]
  predates: boolean                                      // shipped, unchanged (TSL FR-19)
  /** NEW. Decided once per event, in FR-20 then FR-21 then FR-13 to FR-19 order. */
  earlierState: 'pre-update' | 'later-changed' | 'counted'
  /** NEW. Lump only, and only while `earlierState` is 'counted' and some earlier name is
   *  traced: the "Earlier name not recorded" count. 0 otherwise. The box shows when > 0. */
  residual: number
}

export interface EntryView {
  code: string; sci: string; com: string
  count: number; onOrBefore: number; after: number; speciesKey: string | null; current: boolean   // shipped
  /** NEW. '' unless this is a traced earlier name of a lump. */
  form: string
  /** NEW. Meaningful on before entries; always { state: 'none' } on after and slash entries
   *  and on every before entry of an event that is not 'counted'. */
  earlier:
    | { state: 'none' }
    | { state: 'count'; n: number }                       // n === 0 is the zero state (FR-19)
    | { state: 'untraceable'; reason: 'survivor' | 'no-form' }   // FR-18's two sentences
}
```

Absence stays inside the objects (`form: ''`, `residual: 0`, `{ state: 'none' }`), never a `null` member (the house rule, TSL-S 6.4). `current` on a rename's after entry is true only when the code is current by the shipped `lastSeen` rule AND this is the latest rename of that code, so site marks never sit beside a name the code no longer carries (FR-27); the earlier of two renames shows its new name unlinked and unmarked.

`affected`, `lineageFor` and `historyListEntries` are unchanged apart from the widened kind. A species touched only by renames is affected through the same path (FR-08) and the control's count is still the list's length (FR-30).

### 6.6 The chain

`lineageEvents` runs unchanged over the merged list, so a rename joins a species' line exactly as a split or lump does: forward through the code it carries, backward through it, never turning around. A later-changed event (FR-21) is decided from split and lump before sides only: `lastSLBefore[code]` is the latest published date at which a split or lump lists the code on its before side, and an event is later-changed when any of its after or slash codes has `lastSLBefore > published`. A later rename never makes an event later-changed. Measured on the committed record: **31 of 582** split and lump events (2 of them lumps) and **6 of 515** renames are later-changed.

---

## 7. Counting: every figure as a function of the record and the rows

Per event E with update date d, over the shipped per-entry tallies `count(s)` and `onOrBefore(s)` and the one new counter `formOnOrBefore(b)`:

| Quantity | Definition |
|---|---|
| Pre-update evidence | some before entry b of E has `count(b) > 0` |
| Later-changed | section 6.6 |
| `earlierState(E)` | `'pre-update'` if pre-update evidence; else `'later-changed'` if later-changed; else `'counted'` |
| Split, earlier-name figure (FR-13) | sum of `onOrBefore` over every after entry and every slash entry of E, drawn or not |
| Rename, earlier-name figure (FR-15) | `onOrBefore(after[0])` |
| Lump, traced earlier name b (FR-16) | `formOnOrBefore(b)`, where b is traced exactly when `b.form` is present |
| Lump, residual (FR-17) | `onOrBefore(after[0])` minus the sum of `formOnOrBefore` over traced b; defined only when some b is traced; shown when > 0 |
| Lump, not traceable (FR-18) | b has no `form`: reason `'survivor'` when `b.code === after[0].code`, else `'no-form'`; no number |
| Zero state (FR-19) | a defined figure equal to 0 |

**The identities, each true by construction.** Split: the earlier-name figure IS the sum of the reassigned figures shown. Rename: the earlier-name figure IS the current name's on-or-before figure. Lump: each row increments at most one traced counter per lump (K3: one kept name maps to one slot) and only when it was also tallied on-or-before on that lump's after entry, so the traced figures sum to at most `onOrBefore(after[0])` and the residual is the non-negative remainder; traced plus residual equals the reassigned figure exactly. Measured on a generated backup holding two dated-before and one dated-after report under every current-side name and every kept form in the record (4,339 rows): 447 splits, 504 renames and 89 lumps reached `'counted'`, with 0 identity violations in each kind; 73 of the 89 lumps showed a residual above zero and 137 traced names counted exactly their two form rows.

**The pre-update state (FR-20).** `earlierState === 'pre-update'` suppresses every new figure, state and paragraph for that event; each before entry carries `{ state: 'none' }` and the section renders the shipped figures from `count`, `onOrBefore`, `after` and `predates`. A report can never be counted both ways, because the earlier-name figures exist only when no before entry holds a report.

**Chains (FR-12, OQ-03).** Each event uses its own `published`. One row is tallied on every event its key resolves to, once per event, and no figure adds across events. The default of OQ-03 stands with no narrowing: at a later-changed event every earlier name shows the marker and no number. A complete figure there needs each report followed forward through every later split and lump, which the PRD puts out of scope; no partial case was proven exact, so none is offered.

**OQ-01 (the surviving earlier name).** The default stands: `'survivor'` is not traceable and plain reports are never assigned to it. The alternative needs nothing new in the record: the surviving entry is already identified (`reason: 'survivor'`) and the plain reports are already counted (`residual`), so adopting it later is a change to the view derivation alone, with no record change and no version change. It costs nothing to keep open, so it is kept open.

---

## 8. Declared scans over user-file content (amends TSL-S 6.6; `.claude/rules/security.md` v1.0.23, NFR-08)

| Scan | Where | What is new | Shape and bound |
|---|---|---|---|
| Row pass | `buildTaxonomyHistoryIndex`, 6.4 | One `Map.get(o.commonName)` per countable row. On a hit only: a loop over that name's before slots (bounded by the record; one by K3) and over the key's `ids` (bounded by the record: the entries one key resolves to), comparing integers, plus the shipped 10-character date compare | The lookup hashes the name once, linear in its length, as the shipped `slashByRawName.get` does. No nested scan over the file, no regex, no native search with an open end. Total stays O(sum of row string lengths) |
| Key resolution | first sight of a key | Tier-2 closure: one `Map.get` per matched after entry. Tier-0 forward rule: one `Map.get` per matched rename earlier name and one date compare per hit | Once per DISTINCT key; bounded by the record, never by the file |
| Lineage walk | once per affected key | none; it walks the merged list | Per key O(events + entries) of the record, which is larger now (1,097 events against 582) |
| Record-only passes | once per index build | the merge, `lastSLBefore`, the latest rename per code, the views' new fields | O(events x entries) of the record |

**Allocation.** `formOnOrBefore` is one integer on each slot, allocated at index build from the record. Nothing is allocated per row and nothing per distinct raw name: there is deliberately no memo keyed on the raw name, because it would be sized by the file (NFR-08: "no allocation from a count read off the backup beyond one counter per record entry"). The shipped per-distinct-key `entriesByKey` is unchanged.

**External-string keys.** `keptByRawName`, like every index in this module, is a `Map`, so a common name of `__proto__` or `constructor` is an ordinary miss. The one object read by a backup string, `lookup.codes[key]`, keeps its shipped `Object.hasOwn` guard. No new object is keyed by a backup string.

**No clamp, and no loop driven by a number read from the file.** Dates are compared lexically and never iterated; nothing in this feature has a span to clamp. The cost that stands in for "per draw" and "per re-draw":

| | Shipped (`v` 1) | This design (prototype) | Ratio |
|---|---|---|---|
| Demo dataset, 7,869 rows | 2.13 ms | 3.40 ms | 1.59 |
| Worst case: one report under every name on every side of every event (2,129 rows before; 3,473 after, kept forms included) | 2.70 ms | 4.89 ms | 1.81 |
| The same, on the SAME 2,129 rows | 2.70 ms | 3.93 ms | 1.46 |
| Worst case with no codes lookup (tier 2) | 2.95 ms | 5.45 ms | 1.85 |
| Empty backup (the record-only passes alone) | 1.36 ms | 2.53 ms | 1.86 |
| Account owner's backup, 21,856 rows | 2.94 ms | 4.21 ms | 1.43 |

CPU time of this process (`process.cpuUsage`), best of 9 batches per leg after an untimed first call, Node 24.18 on the developer Mac, nothing else compiling. **Neither NFR-03 figure exceeds twice its before figure (1.59 and 1.81), so the stop condition is not met.** The margin on the worst case is thin and its cause is structural: on a small backup the cost is the record-only passes, which grow with the merged list (1.88x the events). If the Engineer's implementation measures above 2.0 on either NFR-03 leg it stops and reports, as the NFR says; the lever is building a view only for events some key reaches, not weakening the measure. Per re-draw the cost is zero: the index is memoized on `[observations, history, taxonMap]` (TSL-S 6.7, unchanged), opening or closing the list and re-rendering run it zero times, and selecting a species is a `Map.get`.

**The gate, checked file by file** (the frontmatter of `.claude/rules/security.md` was read, not assumed):

| Module | Holds | Gated by |
|---|---|---|
| `frontend/src/lib/taxonomyHistory.ts` | the row pass and every per-key walk above | `frontend/src/lib/taxonomyHistory.ts`, present |
| `frontend/src/lib/speciesUtils.ts` | `normalizeSpeciesName`, `isNonCountableForm`, which the pass calls per row | `frontend/src/lib/speciesUtils.ts`, present |
| `frontend/src/lib/parseEbirdObservations.ts` | the parse that produces the rows | present |
| `frontend/src/lib/exoticTaxonomyJoin.ts` | the join section 9 pins | `frontend/src/lib/exoticTaxonomyJoin*.ts`, present |
| `frontend/src/components/speciesDetail/SplitsLumps.tsx` | no scan, but it mints ids and IDREFs over rows derived from the backup's names and renders them, which the rule's IDREF paragraph governs | **no glob matches it today**; add one (section 12) |

---

## 9. The Statistics escapee join (FR-33)

**Guaranteed structurally:** `buildEscapeeJoin` reads `history.coverage` and `history.events` and nothing else, and no rename is ever a member of `events` (R1 plus the array it lives in). `exoticTaxonomyJoin.ts` is not edited. `UNMATCHED_JOIN_VERSION` stays 1 and is not touched: the join does not widen. The `form` key added to lump before entries is not read by the join.

**Tested three ways, in `exoticTaxonomyJoin.test.ts`:**
1. Equality by removal (the structural form, `.claude/rules/testing.md` v1.0.32): the join built from the committed record equals, key for key and value for value, the join built from the same record with `renames` set to `[]`, and the one built with `form` stripped.
2. A control that can fail: the join built from a copy with the renames appended to `events` does NOT equal it (measured 185 entries against 39). Without this leg, row 1 would pass against a record with no renames at all.
3. A source pin, comments stripped (both forms): the module's code does not name `renames`. This is the row that goes red if someone later "unifies" the two arrays in the reader.

Plus one row asserting `UNMATCHED_JOIN_VERSION === 1`, written as the literal (QA-34: "the same value as in the prior release").

---

## 10. Verification plan for the Engineer and the Tester

**Structural, or against an oracle outside both runtimes**

| Claim | Form |
|---|---|
| The three identities (FR-13, FR-15, FR-17) | Equations over the index's own output, swept over a backup generated from the whole committed record (section 7's corpus), with non-vacuity legs: each kind reaches `'counted'` at least once, some lump has a residual above zero, some traced name counts above zero. A fixture where every earlier name is present reaches no counted lump at all (measured) and would pass vacuously |
| Renames leave split and lump figures alone (FR-11, FR-20) | Equality by removal: for a generated backup, every split and lump `EventView` from the committed record equals the one from the same record with `renames: []`, for every name that is NOT a retired earlier name of a rename. For the names that are, assert the direction per 6.3 (a reading moves only to the after side of an event the name outlived, or to "predates" at an event after its rename). The count of such names is printed, never asserted |
| FR-09's two halves | Two rows, each mutation-checked alone: with the codes lookup present, re-admit a rename's earlier name to the by-code index; with it absent, re-admit it to the tier-2 maps. Each mutation must redden exactly its own row |
| Kept forms (FR-06) | Independent re-derivation from the committed snapshot in the test body, entry by entry, beside the shared checker |
| The cutoff (FR-03) | Literal rows through `renameKey`, written as literals with escapes; the committed record's renames all differ under it |
| Rename chains end at eBird's own present name (R7) | The snapshot is the oracle: it comes from eBird's API, not from Cornell's files |
| Renames are real (R8) | Cornell's integrated checklist is the oracle: a different file, annotated by Cornell |
| The escapee join | section 9 |
| Linearity (NFR-03, QA-40) | The shipped guard, CPU time through `frontend/src/test/cpuTiming.ts`, over the record with renames: the three shipped legs, plus (a) a leg where EVERY row carries a kept-form name, so the new lookup hits on every row; (b) the distinct-key leg widened so its keys include case variants of a rename's retired earlier name (tier 0 and its forward rule at volume) and current names of twice-renamed codes with no codes lookup (the tier-2 closure at volume), each half asserted present. Prototype-chain names (`__proto__`, `constructor`, `toString`) as common names: no throw, not affected |
| Work done (QA-40) | The shipped instrumented count: once per distinct (observations, record, codes) triple; zero on list open, list close and an unrelated re-render |
| Text-equivalent parity (FR-32, QA-33) | Set equality in both directions between drawn and listed figures, names, markers and sentences, per state (`.claude/rules/testing.md`, v1.0.29), never a per-item assertion |

**Checkable on the account owner's stored backup** (`data/ebird-backup.csv`, the 2026-07-11 export; aggregate counts only, no row copied anywhere). The independent recount is a count of rows by exact common name and date, outside the app:

| Row | Measured through the prototype on 2026-11-18 |
|---|---|
| QA-14, Hudsonian Whimbrel | 25 reports, 14 on or before 2025-10-31, 11 after. Eurasian Whimbrel 0 and no slash rows, so the Whimbrel box reads 14 |
| QA-14, Northern Yellow Warbler | 2 reports, 1 and 1; the Yellow Warbler box reads 1 |
| QA-14, European Goldfinch | 5 reports, all on or before 2024-10-22; its earlier-name box reads 5 |
| QA-20, Western Flycatcher | 13 reports, 0 on or before 2023-10-24: both earlier names traced, both in the zero state, no residual box |
| QA-20, American Crow | 1,362 reports, 0 on or before 2021-09-08: American Crow not traceable (surviving name), Northwestern Crow not traceable (no kept form), no number |
| No shipped figure moves | 0 of 582 split and lump events differ between the shipped module and the prototype; 24 affected species before and after |

**Fixture only, and recorded as not available on real data, not as pending:** every rename (the backup holds no renamed species, finding 2.7); every traced lump count above zero and every residual box (its 2 kept-form rows postdate the lump); the pre-update state; the later-changed marker; the 14 changed readings of 6.3. The demo dataset shows none of these either, so every [Built app] row that needs a rename, a traced count or a residual (parts of QA-30, QA-39, QA-41, QA-43) runs on a fixture backup served through `SR_DATA_DIR`, with the dataset asserted in-page before any reading is taken.

**Fixture shape.** Chained fixtures need a name that is current after one update and retired at the next (`.claude/rules/bird-names.md`); for renames add a code renamed twice, and a rename followed by a split of the same code. Update dates are fixed history, so absolute dates are correct here (no wall-clock window is involved). QA-12 is addressed in the flags.

**Counts in guards.** Every figure in section 2 is a reading with a date on it. A test reads its figure from the committed asset when it runs; none of 515, 157, 31 or 14 is typed into an assertion.

---

## 11. Off-thread, memory, persistence, network

- **Where it runs: unchanged.** `buildTaxonomyHistoryIndex` runs on the main thread inside a `useMemo` in `SpeciesDetail.tsx`, keyed on the observations array, the loaded record and the codes result. It touches no worker boundary, so the off-thread rules do not come into play, and at 3 to 5 ms once per backup load there is no case for moving it.
- **Memory.** One integer per slot and three small fields per entry view; the merged list references the record's own objects. Nothing per row, nothing per distinct raw name. The index stays outside `clearDerived.ts` by design (an in-memory derivation; its lifetime argument in TSL-S 8 is unchanged).
- **Persistence: none.** No storage-seam document, setting, cache, `localStorage` key, `docChains` link, replay entry or iCloud item is added, so no `clearDerived.ts` row and no privacy-policy sentence is owed. `PRIVACY_POLICY.md` does not change.
- **Network, in the durable form (NFR-01).** No third-party request, no new endpoint or host, and no request moved between components. On web/Pi the record is still one static chunk served by the user's own server; it is larger (58,627 bytes gzipped against 39,098) and is fetched by the same request. Kept forms come from the record, so Species Detail does not load the taxonomy snapshot for this feature on any platform. No system component makes a new request from the app's process.

---

## 12. Changes in this feature

### Added

| What | Where |
|---|---|
| `renames` array; `HistoryRename`; `form` on lump before entries | the record and its types |
| `renameKey`, the rename derivation, `RENAMES_UNANNOTATED`, the kept-form pass, R1 to R9 and K1 to K3 in `checkHistory`, the per-update printout | `scripts/lib/taxonomyHistoryDerive.mjs` (+ `.d.mts`), `scripts/build-taxonomy-history.mjs` |
| The merged list, the rename matching rules, the two closures, the kept-form lookup, `earlierState`, `residual`, `EntryView.form`, `EntryView.earlier` | `frontend/src/lib/taxonomyHistory.ts` |
| Guard rows | the five existing `taxonomyHistory*.test.ts` files, `exoticTaxonomyJoin.test.ts`, `entryChunk.test.ts`, `SplitsLumps.test.tsx` |

No new source module, no new asset, no new input file, no new dependency.

### Modified (each is a change to something shipped)

| What | From | To | Why, and the risk |
|---|---|---|---|
| Record version | `v: 1` | `v: 2` | A required member joined the contract. One bundle carries reader and record, so no reader meets the other version. Fixtures that build a record by hand (`taxonomyHistory.test.ts`, `SplitsLumps.test.tsx`) move to `v: 2` with `renames: []` |
| Loader shape check | `v === 1`, two arrays | `v === 2`, three arrays | so a record without `renames` is a load failure, not a silent "no renames" |
| `kind` in the derivation's output types | `'split' \| 'lump'` | adds `'rename'` | the component and copy module switch on it |
| Tier 0 | retired split and lump names | also a rename's retired earlier name, with the forward rule | FR-09. Changes 14 measured readings, all toward the export's true date (6.3). Flagged |
| Tier 2 | pair, sci, com | the same plus the rename closure; a rename's earlier name is not indexed | FR-09's second half, and parity with tier 1 |

### Unchanged

`updates`, `coverage`, `snapshot`, `inputs`, `generated`; every split and lump event (apart from the added `form` key); I2 to I11; the announced-tally check, `ANNOUNCED_RECOUNTS`, `SLASHES_DROPPED`, `UPDATE_PUBLISHED`; the three size constants; the loader's memoized promise and its null-on-failure contract; `lineageEvents`; `tally` and the one date comparison; the slash exception; `predates`; the memo keys in `SpeciesDetail.tsx`; `exoticTaxonomyJoin.ts` and `UNMATCHED_JOIN_VERSION`; every storage, transport and sync seam.

### Rule files to edit in the same change

| File | Edit |
|---|---|
| `.claude/rules/security.md` `paths` | Add `frontend/src/components/speciesDetail/SplitsLumps*.tsx` (ids and IDREFs over backup-derived rows; ungated today, and a component's `ui.md` gate does not discharge it). If the Engineer moves any part of the scan out of `taxonomyHistory.ts`, widen the entry to `frontend/src/lib/taxonomyHistory*.ts` in that same edit |
| `.claude/rules/testing.md` `paths` | Add any `frontend/src/lib/taxonomyHistory*.fixture.json` the build commits. None is required by this design |
| `.claude/rules/bird-names.md` | `paths` already cover every touched file (`frontend/src/lib/taxonomy*`, the asset, the generator, `scripts/lib/taxonomyHistoryDerive*`, the README). Extend the splits-and-lumps bullet's body with the rename rules: a rename's earlier name is matched by retired-name identity only; renames live in their own array because the escapee join reads `events`; the cutoff is `renameKey` and nowhere else |
| `.claude/rules/docs-and-website.md`, `ui.md`, `maps.md` and the rest | no `paths` edit: nothing they govern is added, moved or twinned |

---

## 13. Migration plan for the Engineer (order matters)

1. **Golden first, in its own commit.** Before any source edit, capture what the shipped derivation returns for the generated backups of section 10 over the committed record, so "split and lump figures unchanged" is checked against an artifact that predates the change (`.claude/rules/testing.md`, v1.0.22).
2. **Generator.** Add `renameKey` (escapes; grep for literals after writing), the rename derivation, R8 with `RENAMES_UNANNOTATED`, the kept-form pass, and the new invariants in `checkHistory`. Extend the `.d.mts`. Fixture tests red first.
3. **Regenerate** the record with the 16 input files already on this Mac. Confirm the printout reproduces section 2.2 and 2.5, the byte length is within the bound, and the regenerated `events` with `form` removed deep-equals `git show HEAD:` events. Record the figures, with the date, in `decisions.md`. A difference from 515 is recorded, not forced (OQ-06).
4. **Types and loader** to version 2; update the two hand-built fixtures.
5. **Derivation**: the merged list, matching, closures, the row-pass lookup, the view fields. Run the removal-equality guard and read the changed-readings roster against 6.3.
6. **Guards** of sections 5, 9 and 10, each mutation-checked; re-measure the CPU table and stop if either NFR-03 ratio exceeds 2.0.
7. **Component and copy** from The Designer's spec, reading `earlierState`, `residual`, `earlier` and `form`. Every count-, year-, date- or name-bearing string lives in `taxonomyHistoryCopy.ts`.
8. **Runbook, rule files, Help**, then the six-file version set. Published surfaces stay held (FR-36).

### Annual-refresh runbook additions (`scripts/taxonomy-history-input/README.md`, FR-37)

- **Step 2 (downloads):** no new file. Note that the integrated checklist's change column now also feeds the rename check, so a hand-exported CSV must keep that column intact.
- **Step 5 (`UPDATE_PUBLISHED`):** unchanged. State that eBird announces no rename total and nothing is typed for renames.
- **New step after the generator runs, "Read the rename printout":** per update it prints renames kept, left out under FR-03, excluded for sharing an event, and annotated rows that produced no rename by reason. If the run refused a rename as unannotated: read eBird's update page for that year in a browser; if the rename is real, add a cited row to `RENAMES_UNANNOTATED` with the URL; never add a row to make the run pass. If it refused a chain end (R7), Cornell's file and the snapshot disagree, which is usually Cornell lagging eBird by days: wait and download again.
- **New step, "Diff the record against the last one":** `git show HEAD:frontend/src/assets/ebird-taxonomy-history.json` against the new file. Every earlier update's renames are unchanged apart from `retired`; every earlier split and lump is unchanged apart from present names, `retired` and `form`. Read each changed `form`: eBird renamed a kept form, and a backup exported before this refresh will count those reports as "Earlier name not recorded" until a fresh backup is loaded (the PRD's stated limit, the same kind as the 25 renamed group names of 2026).
- **Step 6 (re-derive):** add the record's byte length against `historyMaxBytes`; the lever if it is close is the compact rename shape, decided with a measurement.
- **The `UNMATCHED_JOIN_VERSION` step:** add one sentence: renames never reach the escapee join and are never a reason to raise it.
- **Step 7 (checks):** if K4 turns red (a kept form that is not countable, or does not fold to its lump's surviving species), stop and bring it to a design decision; do not exclude the form by hand.

---

## 14. Flags for the gate

1. **Fourteen shipped readings change (6.3).** Recognizing a rename's earlier name the way FR-09 asks moves how 14 names read at split and lump events in a backup exported before that rename. Every move is toward the export's true date, and 8 of them correct a misreading the shipped section makes today (the retiring renames date from 2021 to 2026). FR-20 and QA-22 say a pre-update backup renders "the same figures and states as the prior release"; for these 14 names it will not. Keeping the shipped readings instead would show one backup as predating the 2024 update and the 2026 update on the same species. Designed as the correction; the Planner and Tester should carve these names out of QA-22.
2. **QA-12 cannot be met as written.** It asks that on a species renamed in one update and split in a later one "a report dated before both counts on the earlier side of each". Under FR-21 that rename is a later-changed event and shows the marker with no number (the later split moved reports to another code). The claim is observable on a split followed by a rename, or on two renames. Proposed: QA-12's fixture becomes split-then-rename, and rename-then-split joins QA-23.
3. **No renamed species in the owner's backup or the demo dataset (2.7).** The user will not see a rename on their own data; the control's count stays 24 there. On the demo dataset the count stays 11, so the PRD's held-image table ("the label and the count change") is right about the label and not about the count, unless the demo generator gains a renamed species, which is a separate decision. Rename rows of the [Built app] checks need a fixture backup.
4. **Record version 1 to 2**, a modification to a shipped contract (3.2). No stored data and no cross-version reader exists.
5. **OQ-02: not adopted, measured** (4.4). The scientific-name match is wrong on 2 of the 93 names where the truth is known.
6. **OQ-01: default stands;** the alternative stays free to adopt with no record or version change (section 7). The 52-of-101 consequence in the PRD is confirmed (33 in part plus 19 not at all).
7. **OQ-03: no narrowing.** 31 of 582 split and lump events and 6 of 515 renames show the later-change marker.
8. **OQ-06: 515 kept, 135 left out,** equal to the brief's 515 of 650; 45 more name changes are excluded by FR-02 because their code is on a split or lump of the same update.
9. **CPU: within the 2x stop condition, thinly on the worst case** (1.59 and 1.81, prototype). The Engineer re-measures on the real implementation and stops above 2.0.
10. **One present name differs in spelling from its rename's new name.** FR-01 fixes the current-side name of a rename as the update's own file's, so Nankeen Night-Heron's rename line reads the hyphenated 2024 spelling beside a backup that says Nankeen Night Heron. One of 510 renamed codes today. Left as FR-01 states; The Designer may prefer the backup's spelling on the latest rename's current-side box, which needs nothing from the record.
11. **A backup that predates the first of two renames** shows that rename in the shipped predates state and the second rename in its zero state, because FR-09 counts only a report under a rename's own earlier name. Five codes can show it. Stated, not changed.
12. **Three renames rest on a person's reading of eBird's 2019 and 2022 update pages** (`RENAMES_UNANNOTATED`, 4.3), because Cornell's checklist does not annotate them and those pages refuse scripts. If the user cannot confirm them during the build, the choice is to hold the build or ship without those three; the generator will not accept them unverified.

---

## 15. Design decisions

- **Renames in their own array.** Structural protection of the escapee join and of every existing reader of `events`, measured as load-bearing (2.1). Reversal: nothing reads `events` expecting only splits and lumps.
- **The event shape for a rename.** FR-01's fields, one slot builder, 41 KB over the compact form, within the bound. Reversal: the size guard goes red at a refresh.
- **`form` in the record, not looked up at runtime.** The snapshot is a 1.79 MB chunk that web/Pi never loads in the browser; 6,260 bytes in the record keep FR-06 "from bundled data alone" true on every platform and let CI hold it to the snapshot.
- **The annotation check as the rename oracle.** The only independent statement about renames in the inputs; fail closed in the direction that catches a false rename, printed in the direction that would otherwise need a table of exceptions kept by hand.
- **A rename's earlier name is matched by retired-name identity only.** It makes FR-09's handed-on rule a property of the indexes, not of a check at tally time.
- **No memo on the raw name.** NFR-08's allocation rule; one hash lookup per row is cheaper than the bookkeeping and cannot be inflated by the file.
- **Where a repo rule and this document disagree on a fact the Engineer can measure, the measurement wins** and the deviation is written at the site (`.claude/rules/bird-names.md`).

---

## 16. Requirement traceability

| Requirement | Where |
|---|---|
| FR-01 | 3.2, R1 |
| FR-02 | 4.1 |
| FR-03, NFR-07 (cutoff once) | 4.2 |
| FR-04 | 3.2 (`year`, `published`), R1 |
| FR-05, NFR-02 | 3.4, 4.3, 4.5; the `events` equality in 3.2 |
| FR-06, NFR-07 (kept-form rule once) | 4.4, K1 to K4 |
| FR-07 | section 5, 3.5 |
| FR-08, FR-30 | 6.2, 6.5 |
| FR-09 | 6.2, 6.3 |
| FR-10 | 4.1 step 1 |
| FR-11, FR-12 | 6.4 (one date comparison), section 7 |
| FR-13 to FR-19 | section 7, 6.5 |
| FR-20, FR-21 | `earlierState`, 6.6, section 7 |
| FR-22 to FR-27, FR-32 | the view fields of 6.5; wording and layout are The Designer's |
| FR-28, FR-29, FR-31, FR-34 | no data-layer change; the shipped seams of TSL-S 7 |
| FR-33 | section 9 |
| FR-35 to FR-37 | section 13 (runbook, rule files, version set); published surfaces held |
| NFR-01 | section 11 |
| NFR-03 | 3.5, section 8 |
| NFR-04 | index-keyed ids unchanged (TSL-S 7.3); longest strings measured for The Designer: earlier name "Buff-breasted Paradise-Kingfisher" (33), kept form "North Solomons Dwarf-Kingfisher (North Solomons)" (48), rename pair "Black-headed Paradise-Flycatcher" to "Red-bellied Paradise-Flycatcher" (63 together) |
| NFR-08 | section 8 |
| NFR-09 | section 11; no platform branch anywhere in the design |
