# Decisions: taxonomy-history-2019 (Stage 2, The Engineer)

Splits and lumps now covers eBird's 2019, 2021, 2022, 2023, 2024 and 2025
updates. This file records each resolver rule and why, the red-first evidence
per row, the 2023 to 2025 identity proof, the measured size, the tallies, the
two places the work grew past the brief's file list, and what is left for
others.

## 1. Starting state, re-measured

- With only the 2022 to 2025 inputs, the unchanged generator rebuilt the
  committed asset byte for byte: **93,936 bytes** (`wc -c` on HEAD's file and
  on `git show HEAD:` output; the brief's 93,932 is 4 bytes off, so the
  measured figure is the one recorded here).
- 2019 derived 107 / 22 against the announced 106 / 20. 2021 failed closed on
  Oxapampa Antpitta (two parent candidates). 2022, run alone, failed closed on
  Brace's Emerald (a split of one daughter). All three matched the brief.

## 2. The rules, year by year

Every rule is written where it is implemented in
`scripts/lib/taxonomyHistoryDerive.mjs`; the summaries below say why each is
general, and name the real case it was found on.

### 2019

**R-A. A lump survivor that is also a split daughter carries its split parent
on its before side.** Swinhoe's White-eye is a daughter of the 2019 Japanese
White-eye split and also absorbs Enggano White-eye. Its code is new and its
checklist row has no previous-sort link, so its "previous identity" was empty
and its lump held Enggano alone, which fails closed. A daughter was formed
partly from its parent by definition; the 2024 asset already had the same
shape (Large Cuckooshrike on Oriental Cuckooshrike's lump) only because a
previous-sort link happened to supply it. The rule adds the parent only when
that parent's split was emitted.

**R-B. A previous-year species a sentence names joins a survivor's lump only if
the checklist does not place it under a different current species.** Warbling
and Swinhoe's White-eye share one sentence that names Mountain and Enggano
White-eye together, so both survivors took both, and each lost species was
counted twice. The 2019 checklist's subspecies rows say where each went:
Warbling's rows carry previous-sort links into Japanese and Mountain
White-eye's rows, Swinhoe's into Japanese, Oriental (williamsoni) and
Enggano's. The module now builds `rowsWentTo` (previous species code to the
current species its rows now sit under) in one pass over the year's
checklist, and the sentence scan skips a species that the rows or the
taxonomy's REPORT_AS place under another survivor. With no structural
placement at all, the sentence still decides, as before.

**R-C (tally). eBird counts the white-eye reorganization by its net change.**
With R-A and R-B, 2019 derives 107 / 21. eBird's own 2019 post (Wayback
capture 20200107042928 of `ebird.org/news/2019-ebird-taxonomy-update`)
narrates "JAPANESE WHITE-EYE SPLIT and REORGANIZATION" as Mountain and
Japanese White-eye mixed and divided into Warbling and Swinhoe's, and its
"LUMPS and INVALID SPECIES" section itemizes exactly 20 species lost, with
Enggano White-eye in it and Mountain White-eye not. Three species became
two: eBird counts one lost and none gained; the events count one gained (the
split) and two lost. The difference is exactly (1, 1). Checked against the
file arithmetic: 10,585 species in 2018 plus 52 `new species` rows minus 2
deletions plus gained minus lost equals 10,721 for both 107/21 and 106/20, so
the arithmetic cannot separate them and the itemized list is what does.

How it is implemented: `ANNOUNCED_RECOUNTS`, a cited table beside
`UPDATE_PUBLISHED`, shaped like it. Each entry names the reorganization's
events (kind and each side's codes) and eBird's count of it. The generator,
under the tally check, (1) requires each named event to be derived exactly
once, (2) requires the recount's net (gained minus lost) to equal its events'
own net, and (3) compares the tally with each recounted reorganization taken
at eBird's count. The events stay in the asset exactly as derived, because
each is what happened to a user's records (a Mountain White-eye report really
did become Warbling White-eye). The tally check is not weakened: it is still
an exact comparison, a recount can only relabel, it cannot hide or add a
species, and every other difference still fails closed.

### 2021

**R-D. A row carrying `new species` is newly described, never a split
daughter.** Oxapampa Antpitta ("split; new species") was described from
Chestnut Antpitta. eBird announces newly described species apart from splits:
2021 has exactly 17 `new species` rows and eBird announced 17 newly described
species (2022: 5 and 5). The candidates its sentence names are kept, and a
split left holding only its own parent (Chestnut Antpitta, code kept) is no
split when that parent is among them, recorded in the run's notes. A split
holding only its parent with no such sibling still fails closed (FR-04 stays,
and a row pins it).

**R-E. Two tie-breaks for a sentence that names more than one parent, rows
first, then the daughter's own sentence.** Both only narrow a case that would
otherwise fail closed, so no daughter that resolved before can move (the
identity proof below confirms it).
- Rows: keep the candidates whose rows now sit under this daughter. Striped
  Prinia's every sentence names Striated and Brown Prinia; its subspecies
  catharia, parumstriata and striata were Striated Prinia's.
- Own sentence: the first sentence that names the daughter by its scientific
  name decides if it names exactly one candidate (new helper
  `sentenceNaming`). Equatorial Antpitta shares a preamble naming Rufous and
  Chestnut Antpitta with every daughter of that group; its own sentence ("The
  monotypic group Rufous Antpitta (Rufous) Grallaria rufula rufula now is
  recognized as three monotypic species: ... Equatorial Antpitta Grallaria
  saturata ...") names one.

With R-D and R-E, 2021 derives 94 / 8, eBird's figures exactly, no recount.

### 2022

**R-F. A lone, unannotated promotion that carries the parent's scientific name
on is a re-code, not a split.** eBird deleted Brace's Emerald's group elegans
and moved the species onto its remaining group's code (braeme1 to braeme2).
No row carries `split`; the promotion rule made a one-daughter split. The
rule is bounded four ways: one daughter, found only by the promotion rule,
parent no longer a species, same scientific name. A row pins that a lone
promotion under another name still fails closed. Like 1.0.57's rename rule
for lumps, the required tally is the backstop: a real split hidden here
leaves "gained" short. eBird's 2022 page files Brace's Emerald under
"SHUFFLES OF OTHER TAXA", not splits, which agrees.

**R-G. An annotated survivor takes every previous species (no longer a species,
not a split parent) whose rows now sit under it.** "Pale-billed Firefinch is
lumped into African Firefinch" names the lumped species by common name only,
so the binomial scan never saw it; its row is now subspecies landanae under
African Firefinch. The structural counterpart of the sentence scan, from the
same `rowsWentTo` evidence.

**Pink Pigeon is a real lump, not a rename.** R-G also found 2022's Pink
Pigeon lump: the extinct Reunion Pigeon (duboisi, named by common name only)
became its subspecies. 1.0.57 inferred, without these files, that Pink
Pigeon's one-species "lump" was a rename. It was not: the old resolver could
not see the second species. **The 1.0.57 rename rule stays** (its fixture row
still passes; on the real 2022 files it no longer excludes Pink Pigeon or
African Firefinch, both now real lumps, as the R-G mutant's message shows by
listing them as excluded once the rule is off); only the
claim about Pink Pigeon in DECISIONS.md v1.0.41's correction note and the
v1.0.57 paragraph is wrong, which is for The Chronicler (section 9).

**R-C again (tally). The 2022 hill mynas.** With R-F and R-G, 2022 derives
119 / 42 against the announced 118 / 41. The same three-into-two shape occurs
exactly once in 2022: Tenggara Hill Myna split from Common Hill Myna while
Nias and Enggano Myna were lumped into it (one gained, two lost by the
events). eBird's 2022 page (Wayback capture 20231130041808 of
`science.ebird.org/en/use-ebird-data/the-ebird-taxonomy/2022-ebird-taxonomy-update`)
lists no Tenggara split among its splits ("but see above for a split" points
at nothing). The recount is the same as 2019's: none gained, one lost.

**This attribution is an inference, and the record says so.** eBird's own
2022 lumps list, entry by entry, adds up to 42 (it includes Reunion Pigeon,
two hill mynas and "four separate lumps (loss of four species)" for the
kingfishers), exactly the derived set, so the announced 41 is not the sum of
eBird's list. Cornell's "Updates & Corrections, October 2022" page sums to 41
only by omitting Barlow's Lark (which the 2022 checklist annotates and eBird
lists) and lists neither the thicketbird nor the Wetar Scops-Owl split (both
real: eBird lists them, the checklist annotates them). Alternatives
considered and rejected:
- Reunion Pigeon left out of eBird's count, plus the hill myna split: possible,
  but nothing in either page singles Reunion out of the count, while the hill
  myna shape has the 2019 precedent.
- Barlow's Lark: real, annotated, on eBird's list; Cornell's page omitting it
  is an incomplete page, not a count.
What does not depend on the choice: **the asset's events are identical under
every attribution**; only which events the recount table names would move.
Reversal: an itemized eBird count that reconciles 118 / 41 differently moves
the 2022 entry in `ANNOUNCED_RECOUNTS`, and nothing else.

### Codes eBird re-used (the Evaluator's warning, and what it took)

The full 2019 to 2025 run then tripped the shared invariant checker seven
times, all of one family the 2023 to 2025 window never spanned:
- Two 2019 slash codes eBird dropped in 2023 with no event (Fork-tailed/
  Glossy-backed and Fanti/Velvet-mantled Drongo).
- One 2022 slash code eBird re-used for a species (y01204, Northern/Southern
  Mouse-colored Tyrannulet, became 2024's lumped Mouse-colored Tyrannulet).
- Four before codes eBird re-used later: Pilbara and Sandhill Grasswren
  (lumped 2021, split back out 2024 under the same codes), Beesley's Lark
  (2022 and 2024), and chnfra2 (2019's Chestnut-naped Francolin, split; the
  code then names 2022's lump of its daughters, Chestnut-naped Spurfowl).

**R-H (checker).** Slashes are matched by exact name only, never by code, so a
slash code is held to the snapshot only where the snapshot still has it as a
slash (then the name must be the snapshot's). A dropped slash keeps its own
year's name; a slash code that is now a species must be a LATER event's
after-side code, so a slash cannot borrow an unrelated species' code. I6 now
admits a current before code that a LATER event creates again on its after
side, and nothing else.

**R-I (runtime, outside the brief's file list).** Relaxing I6 alone would have
shipped a false sentence. `buildTaxonomyHistoryIndex` indexes a before code by
code for tier-1 matching; with a re-used code, a current backup holding
Pilbara Grasswren (code strgra4) would also land on the 2021 lump's before
side, and that event's `predates` reading (`before.some(count > 0) &&
after.every(count === 0)`) would show "Your backup predates the September 2021
update" for a backup made in 2025. So `frontend/src/lib/taxonomyHistory.ts`
now skips indexing a before code that a later event creates again (one Map of
each code's latest after-side date, built once per index). The 2021 lump stays
on the species' line through the chain (backward through Rufous Grasswren),
with no reports counted on its before side. The change cannot alter the
2023 to 2025 behavior: under the old I6 no before code was a current species
unless kept, and a code the page resolves is always current.

**Why the scope grew.** The brief put `lib/taxonomyHistory.ts` out of scope
because no year is typed there. That held; this is a correctness change the
new coverage needs, one condition and its comment, with a red-first row. It is
the smallest change that keeps the published "predates" sentence true. Stated
limit, the same kind as Cory's Shearwater's: a backup exported before 2021
holding "Pilbara Grasswren" carries the same name as a current one, so it is
read as current.

### What stays exactly as it was

The 1.0.57 rename exclusion (its row passes unchanged), v1.0.41's "a species'
chain is its own line of descent" (no lineage code changed; the re-used-code
row asserts the 2021 lump is reached backward through Rufous Grasswren, never
by turning around), FR-04's group-of-one failure for anything but the two
named cases, and the required tally for every covered year.

## 3. Red-first evidence, per row

Two runs per row. "HEAD" is the row run against `git show
HEAD:scripts/lib/taxonomyHistoryDerive.mjs` written in place (my module
snapshotted and restored, verified by sha256 both times). "Own rule" is my
module with only that row's rule disabled, by a harness that asserts each
mutation pattern matches exactly once and changes the file, restores from one
snapshot, and verifies the restore by sha256; "real data" is the same mutant
run over the 14 real inputs.

| Row (generator suite unless named) | HEAD | Own rule disabled | Real data with that rule disabled |
|---|---|---|---|
| survivor that is a split daughter carries its parent (Swinhoe's) | red | red (R-A) | fails: lump into Swinhoe's White-eye has 1 before-side species |
| shared sentence: rows decide which survivor (Warbling/Swinhoe's) | red | red (R-B) | fails: the 2019 recount's Warbling lump is derived 0 times |
| common-name-only lump joins by rows (Pale-billed Firefinch) | red | red (R-G) | fails: 2022 tallies 39 lost (Pale-billed and Reunion Pigeon missing) |
| newly described is no daughter; parent-only split is none (Oxapampa) | red | red (R-D, either half) | daughter half: 2021 tallies 95 gained; exemption half: fails on Chestnut Antpitta's 1-daughter split |
| parent-only split still fails without a described sibling (guard) | green (old behavior kept) | n/a | n/a |
| lone unannotated promotion is a re-code (Brace's Emerald) | red | red (R-F) | fails: split of Brace's Emerald has 1 daughter |
| re-code bounded: another scientific name still fails (guard) | green (old behavior kept) | n/a | n/a |
| rows tie-break (Striped Prinia) | red | red (R-E rows) | fails: Striped Prinia has 2 parent candidates |
| own-sentence tie-break (Equatorial Antpitta) | red | red (R-E sentence) | fails: Equatorial Antpitta has 2 parent candidates |
| a cited recount relabels; the asset keeps every event | red | red (R-C) | fails: 2019 tallies 107 / 21 against 106 / 20 |
| without the recount, the tally fails closed | red (HEAD derives a different lost figure) | n/a (a requirement row) | n/a |
| a recount naming an event not derived fails closed | red | red (R-C) | n/a |
| a recount that would change the net fails closed | red | red (R-C) | n/a |
| checker: a dropped slash keeps its year's name (drongo) | red | red (R-H slash) | fails: slash fotdro1 is not in the snapshot |
| checker: a slash code a later event re-uses (Mouse-colored Tyrannulet) | red | red (R-H slash) | (covered by the line above) |
| checker: not a slash code that is a current species no later event creates (bound) | red (old message) | n/a | n/a |
| checker: a before code a later event re-creates (Pilbara Grasswren) | red | red (R-H I6) | fails: before code chnfra2 is still a species ... |
| checker: not a current before code neither kept nor re-created (bound) | red (old message) | n/a | n/a |
| generator source holds no literal non-ASCII outside comments | n/a | red: the `joinKey` escape turned into the literal U+2019 names line 262 | n/a |
| `taxonomyHistory.test.ts`: a re-used code is the later species (Pilbara Grasswren) | red against HEAD's `taxonomyHistory.ts` (`expected 1 to be +0`: the 2025 report landed on the 2021 lump's before side) | same as HEAD | n/a |
| `taxonomyHistoryAsset.test.ts`: covers 2019 to 2025, no 2020, consecutive | red on HEAD's asset | n/a | n/a |
| `taxonomyHistoryAsset.test.ts`: fits historyMaxBytes(6) with six updates | red on HEAD's asset | n/a | n/a |
| `taxonomyHistoryAsset.test.ts`: a recounted event missing is rejected | red on HEAD's asset | n/a | n/a |
| `taxonomyHistoryAsset.test.ts`: independent re-assertions apply the recounts | before the test knew the recounts it rejected the new asset with `tally 2019`, `tally 2022` | n/a | n/a |

On HEAD's resolver, 16 of the 18 new rule and checker rows fail; the 2 that
pass are the boundary guards, which assert behavior that must not change. (The
non-ASCII source row was added after that run and is mutation-checked
instead.)

## 4. The 2023 to 2025 identity proof

- **Method 1, structural.** A copy of the committed asset (`git show
  HEAD:frontend/src/assets/ebird-taxonomy-history.json`) and the newly written
  asset; for each of 2023, 2024 and 2025, every event serialized as canonical
  JSON (sorted keys), compared as an ordered list and as a multiset.
- **Result:** 2023 103 = 103, 2024 95 = 95, 2025 36 = 36 events, identical in
  sequence and as multisets; the 234 ordered 2023 to 2025 events are identical
  as one list.
- **Method 2, byte-level.** The changed generator over only the 2022 to 2025
  inputs, serialized with the build script's own `stableStringify` and the
  committed `generated` date (2026-09-30): **93,936 bytes, sha256 prefix
  6e783cb5941c2b1f, byte-identical to HEAD's asset.**
- **The Evaluator's warning** (a pre-2023 code renamed later) did bite, as
  section 2 records: no 2023 to 2025 event changed, and the checker was
  widened only to the re-use shapes measured.

## 5. Size, tallies, coverage

- **Asset size: 213,276 bytes** against `historyMaxBytes(6)` = 409,600 (52%).
  The bound was not loosened. Lazy chunk roughly 2.27x the 93,936 it replaces.
- **Generator output:** `wrote .../ebird-taxonomy-history.json: 453 splits and
  97 lumps covering 2019 to 2025, 213276 bytes`, exit 0. Inputs: the 14 files.
  The final module (after its comment edits) reproduces that file byte for
  byte over the same inputs and date (sha256 prefix 70b6474c56a687c1), and
  the mutation table in section 3 was re-run on the final module with the
  same result. Gzipped, the asset goes from 16,598 to 36,898 bytes; the built
  lazy chunk is 191.57 kB (36.34 kB gzipped) and `entryChunk.test.ts` keeps it
  off the entry chunk.
- **Per year** (events derived; tally as the events count it; tally as
  compared with eBird, after recounts; eBird's announcement):

| Year | Splits / lumps | Events' tally | Compared | Announced |
|---|---|---|---|---|
| 2019 | 83 / 17 | 107 / 21 | 106 / 20 | 106 / 20 |
| 2021 | 70 / 8 | 94 / 8 | 94 / 8 | 94 / 8 |
| 2022 | 98 / 40 | 119 / 42 | 118 / 41 | 118 / 41 |
| 2023 | 90 / 13 | 124 / 16 | 124 / 16 | 124 / 16 |
| 2024 | 81 / 14 | 141 / 16 | 141 / 16 | 141 / 16 |
| 2025 | 31 / 5 | 40 / 18 | 40 / 18 | 40 / 18 |

- **2021 and 2022 net check**, independent of every resolver: each year's
  species-count change in its taxonomy file equals newly described plus
  gained minus lost (2021: 10,824 minus 10,721 is 103, and 17 + 94 - 8 = 103;
  2022: 82, and 5 + 118 - 41 = 82).
- **Coverage copy** (derived, no year typed): "Covers eBird's 2019 to 2025
  taxonomy updates. A change made before 2019 is not recorded here."

## 6. Linearity and the declared reads

- **Real-asset linearity row** (`taxonomyHistory.test.ts`, every row its own
  affected key, real asset), re-measured on the new asset through the same
  shape: 10k to 40k rows grew 4.10, 3.66 and 3.86 times (27 to 29 ms to 106
  to 111 ms) against the row's limit of 9, and 3.98, 3.90 and 3.70 on HEAD's
  asset. The row passes in the suite. Measured with load average about 22
  from processes outside this session (no orphans of mine), so the absolute
  times are high; the quotient is what the row asserts.
- **Declared reads (security.md, Improve lane).** The runtime change adds one
  pass over the bundled asset's after sides, once per index build, O(events x
  entries), never over user-file content. The generator's new reads
  (`rowsWentTo`, the rows-placed lump loop, `sentenceNaming`) run at build
  time over Cornell's files on the developer's Mac, never in the app.

## 7. The visual check for The Tester

- **More events on one species than before: yes.** Through the real runtime
  over every name in each asset, the longest line of descent is **3 events**
  on the new asset against **2** on HEAD's. Current names with 3: **Little
  Shrikethrush** (2019 split, 2021 split, 2025 lump) and **Sunda Crow**
  (likewise Samar, Sierra Madre and Sulawesi Crow: 2019, 2023 and 2024
  splits). A retired name with 3: Japanese White-eye (2019 split and two 2019
  lumps). Look at Little Shrikethrush or Sunda Crow at 320px and 200% text.
- **Demo data count moves: "6 species" becomes "10 species".** Re-derived
  through the app's parser and `historyListEntries` over
  `website/tools/demo-data/ebird-backup.csv` (the method reproduces HEAD's 6:
  Herring Gull, House Wren, Northern Flicker, Virginia Rail, Warbling Vireo,
  Yellow Warbler). New: American Crow (2021 lump of Northwestern Crow), Barred
  Owl (2021 split, Cinereous Owl), Eastern Meadowlark and Great Horned Owl
  (2022 splits). So **both 05 screenshots** (iPad 13 and iPhone 6.9) are
  stale, not only the iPad's coverage line.

## 8. Deferred, with reasons

- **Published copy and the version bump** (the six-file patch bump, CHANGELOG,
  the held App Store What's New line and three F-Droid changelogs, and the 05
  screenshot recaptures with the iPad set replaced whole and in order): The
  Deployer's, with the user's yes. Nothing under `website/`, `README.md`,
  `appstore/`, `PRIVACY_POLICY.md` or `fastlane/` was touched.
- **DECISIONS.md** correction notes (v1.0.41 and v1.0.57): The Chronicler's
  (section 9).
- **The 2022 recount's attribution** stays an inference until eBird itemizes
  a count that reconciles 118 / 41 (section 2).
- **The rows-placed lump loop** walks `rowsWentTo` once per annotated
  survivor (about 40 survivors by about 11,000 keys at build time). Inverting
  it would be tidier; it runs on the developer's Mac only, so it was left.

## 9. Convention flags for The Chronicler

- **eBird's announced tally can count a reorganization by its net change.**
  Where the events and the announcement differ by a split and a lump within
  one three-into-two reorganization, the house answer is a cited
  `ANNOUNCED_RECOUNTS` entry that may relabel but never change the net; any
  other difference is a resolver to fix. Added to `.claude/rules/bird-names.md`.
- **eBird re-uses codes across updates**, so a current code means the latest
  species that carries it; the runtime indexes a before code by code only when
  no later event re-creates it, and I6 admits exactly those codes. Added to
  `.claude/rules/bird-names.md`.
- **A row carrying `new species` is newly described, never a split daughter.**
  Added to the same bullet.
- **Read the checklist's rows before the sentence.** Subspecies rows'
  previous-sort links place species structurally where one sentence names
  several (2019 white-eyes, 2021 Striped Prinia, 2022 Pale-billed Firefinch
  and Pink Pigeon). Recorded in the module header.
- **Correct DECISIONS.md, do not rewrite it:** v1.0.41's 2026-10-19 note and
  v1.0.57's "Splits and lumps: the generator is ready" paragraph both call the
  2022 Pink Pigeon shape a rename; with the files in hand it is a real lump of
  Reunion Pigeon that the old resolver could not see (the rename rule stands).
  v1.0.41's "Before 2023 is not covered" is superseded by 2019 to 2025.
- **A cross-language, published-source fact was settled by fetching the
  sources, and the announced figure is not always the sum of the publisher's
  own list** (2022: eBird's lumps list sums to 42, the announcement says 41).
  A future refresh should expect to cite, not just copy, a tally.

## 10. The Guide's decisions on the Engineer's two questions (2026-10-21, hands-off)

- **The one step outside the brief, in `lib/taxonomyHistory.ts`, is accepted.** Without it a current backup reads as predating the September 2021 update, because eBird reuses codes (Pilbara Grasswren lumped in 2021 and split back out in 2024 under the same code). The runtime change skips indexing a before-side code that a later covered event creates again, so a current export's code resolves to the later species; its tests cover the reused-code case and, since section 11, a backup of every current species over the real asset. (The Tester found the generator's slash checker had been widened past this in the same build; section 11 records the bound put back on it.) The Tester verifies it as part of the regression check and the Auditor reviews its diff.
- **The 2022 recount inference stands, and is named at the ship sign-off.** eBird's own 2022 lumps list sums to 42 against its announced 41; the hill mynas have the same three-into-two shape as the evidenced 2019 white-eye case, and the asset is identical under every alternative the Engineer recorded in section 2. The tally check is unchanged. The user hears this in one line at the deploy gate rather than as a stop now, because no choice changes what ships.
- **The Pink Pigeon correction** (a real lump of the extinct Reunion Pigeon, not the rename 1.0.57 assumed) goes to The Chronicler as correction notes on the v1.0.41 and v1.0.57 DECISIONS.md entries; the rename rule itself stays.

## 11. Tester follow-ups, 2026-10-21

The Tester passed the build and flagged three things to tighten before the
security review (`qa-report.md`, Known Limitations). Each was made with the
smallest edit.

**1. The slash checker refuses an absent code again, bounded by a cited
table.** R-H (section 2) had dropped HEAD's `else` refusal, so a slash code
missing from the snapshot passed `checkHistory` whatever it was (the Tester's
probe: `{ code: 'zzzzzz9', com: 'Invented Foo/Bar' }`). The refusal is back
for the general case, with HEAD's one admission (a LATER event retires the
code) and one new, named one: `SLASHES_DROPPED` in
`scripts/lib/taxonomyHistoryDerive.mjs`, beside `ANNOUNCED_RECOUNTS`, holding
exactly `fotdro1` and `vemdro1` with the reason. Measured, not inferred: both
are `slash` rows in the 2019, 2021 and 2022 eBird taxonomy files and absent
from 2023 on, and the asset's own 2023 events lump each pair back together
(Glossy-backed into Fork-tailed Drongo, Fanti into Velvet-mantled Drongo), so
section 2's "dropped with no event" is more precisely "dropped once its two
species were lumped back". `y01204` needs no entry: it is a species in the
snapshot and the bounded species branch already admits it only because 2024's
lump creates it. A scan of the real asset found no other slash that is absent
from the snapshot or a species. The type is declared in
`taxonomyHistoryDerive.d.mts`.
- New row, `taxonomyHistoryGenerator.test.ts`: "but not an invented slash
  code that is absent from the snapshot, retired by no later event and not a
  cited dropped slash". **Red first** against the widened module: 1 failed,
  62 passed; green after the fix.
- The existing drongo row's input was itself an invented code (`xxx9`), which
  is why it passed under the widening and why it could not stay as written
  next to the new row. It now uses `fotdro1`, the code its title names, and
  passes through the table.
- Mutation: with `SLASHES_DROPPED` emptied, 2 of 81 rows across the generator
  and asset suites go red (the drongo row, and the real asset failing the
  shared checker on event 32's `fotdro1`); restored by sha256.
- Asset checksum, sha256 of `frontend/src/assets/ebird-taxonomy-history.json`:
  `70b6474c56a687c1cc89064120d4315539ba4b0bbcd1c129348b05e9b30b7f01` before,
  and the same after `node scripts/build-taxonomy-history.mjs` re-ran (exit 0;
  453 splits and 97 lumps, 2019 to 2025). `git diff --stat` on the asset shows
  the same single changed line as before.

**2. A real-asset runtime row for the re-used-code skip.** New row in
`taxonomyHistory.test.ts`, beside the synthetic Pilbara Grasswren row: a
backup holding every species in the bundled snapshot (11,167, read from the
tracked `frontend/src/assets/ebird-taxonomy.json`, dated 2025-12-01, with the
codes the page's `/taxonomy/codes` batch returns) gives zero "predates"
events and zero before entries with reports through `buildTaxonomyHistoryIndex`
over the shipped asset, with a non-vacuity check that it reaches after sides.
It runs in about 44 ms, well inside the 5,000 ms default, so it states no
`testTimeout`. Both lists are compared in one assertion so a failure shows
both. **Red first** with the skip removed (`reusedLater = false`): 2 of 34
rows red (this one and the Pilbara row), reading predates `split 2019` (event
71, Chestnut-naped Francolin) and `lump 2021` (event 103, the grasswrens) and
before-side hits `2019 chnfra2`, `2021 strgra4`, `2021 sangra1`, `2022 beelar1`,
the Tester's figures exactly; restored by sha256 and 34 of 34 green.

**3. The ROADMAP pointer.** The DONE item now points at the tracked
`scripts/taxonomy-history-input/README.md` instead of the gitignored
`originals/SOURCES.md`. The README already carried the provenance (Wayback
captures of Cornell's own uploads, and the source of each announced tally);
one sentence was added saying `originals/` is not in the repository, so that
section is the tracked record.

Checks: `npm run typecheck` and `npm run lint` clean; the three taxonomy
history suites 115 of 115. No literal non-ASCII outside comment lines and no
em dash in the edited code; the added Markdown lines are ASCII.

## 12. The Guide's decision on the Tester's delta flag (2026-10-21, hands-off)

**Accepted as shipped, not fixed now.** `SLASHES_DROPPED` in `scripts/lib/taxonomyHistoryDerive.mjs` admits `fotdro1` and `vemdro1` by code alone: the Tester's probe put `fotdro1` under an invented name on a 2024 split and `checkHistory` passed it. Evidence it has no effect: slash entries come only from eBird's own `slash` rows in the taxonomy files, the app matches a slash by its exact name (`slashByRawName`), and a slash entry is never current, so its code never reaches a link. What would reverse this: a third slash joining the table, or the generator ever deriving a slash from anything but eBird's rows. The fix, if wanted: store each table entry as `{ code, com, lastYear }` and have the slash block compare the name and the year as well as the code, with one row in `taxonomyHistoryGenerator.test.ts` showing the invented-name probe refused. It is recorded here as the follow-up; the build does not re-enter the loop for it.

## 13. Auditor follow-up I1, 2026-10-21

**The change.** `recountedTally` in `scripts/lib/taxonomyHistoryDerive.mjs`
now refuses a recount whose `gained` or `lost` lies below zero or above its
named events' own figure, after the net check, which is unchanged. It fails
closed with `recount "<what>" counts G gained and L lost, outside its events'
own g and l: a recount may only relabel within the events it names, so each
figure lies from 0 to theirs`. The header comment above `ANNOUNCED_RECOUNTS`
no longer says a recount "can never hide or add a species". It now states
what the code checks: a recount relabels only within the events it names and
never changes the net, so it lowers the year's compared tally by the same
amount on both sides, never by more than the smaller of its events' own two
figures. The `recountedTally` docblock names the new refusal. The same claim
in `scripts/taxonomy-history-input/README.md` ("so it cannot hide a misplaced
species") and the PR description's recount sentence were brought into line.
Section 1's wording above ("it cannot hide or add a species") is superseded by
this entry. Both shipped entries are in range: each counts 0 gained and 1 lost
against its events' own 1 and 2.

**The row.** New in `frontend/src/lib/taxonomyHistoryGenerator.test.ts`,
after the net row: with the Lima fixture (events' own 1 gained and 2 lost, net
-1), a net-preserving `{3, 4}` announced as the 4 and 4 it produces, and a
negative `{-1, 0}` announced as 0 and 0, each fail closed. A `{3, 3}` would
already fail the net check here, so `{3, 4}` is that shape for these events.
**Red first** against the unchanged module: 1 of 64 rows red ("no object is
returned": the run wrote an asset for `{3, 4}`); a direct probe of the
unchanged `recountedTally` accepted `{3, 4}`, `{-1, 0}` and `{-2, -1}` and
refused only `{0, 0}`, on the net. Green after the change, 64 of 64. Each arm
was then removed alone. Without the upper bound, the row went red at its
`{3, 4}` call (line 589). Without the lower bound, it went red at its
`{-1, 0}` call (line 590). Each time 1 of 64 went red, and each restore
matched the intended module's sha256.

**Asset.** sha256 of `frontend/src/assets/ebird-taxonomy-history.json`:
`70b6474c56a687c1cc89064120d4315539ba4b0bbcd1c129348b05e9b30b7f01` before,
and the same after `node scripts/build-taxonomy-history.mjs` re-ran (exit 0;
453 splits and 97 lumps, 2019 to 2025, 213,276 bytes).

Checks: `npm run typecheck` and `npm run lint` clean; the three taxonomy
history suites 116 of 116. No em dash and no literal non-ASCII outside comment
lines in either edited code file.

## 14. The Guide's decisions on the second delta's flags (2026-10-21, hands-off)

- **The `lost < 0` arm of the recount range check ships without a row of its own; accepted, not looped.** The Tester measured that removing that arm alone leaves every row green, because both shipped entries and the fixture lose more than they gain, so `gained < 0` refuses first; on a fixture that gains 2 and loses 1 the shipped code refuses `{0, -1}` and the arm-less code accepts it. The code is right and the gap is one row. The fix: a fixture in `taxonomyHistoryGenerator.test.ts` whose recounted events gain more than they lose, with `{gained: 0, lost: -1}` expected refused. What would reverse this decision: any later edit to `recountedTally`. Recorded here as the follow-up rather than a third delta loop over one assertion.
- **`.claude/rules/bird-names.md` line 73 describes the recount by its net alone.** The Chronicler aligns it with the range bound at closeout (the rule now reads: a recount may relabel within the events it names, never beyond their own figures, and never changes the net).

## 15. The Guide's edit for the Auditor's I3 (2026-10-21, hands-off)

The net row's title in `taxonomyHistoryGenerator.test.ts` still read "never add or hide a species"; it now reads "never change the net", which is what the row asserts. A title only, no assertion changed; the file's suite was re-run green after the edit.

## 16. Production sign-off (2026-10-21)

The user confirmed "Confirm, ship 1.0.58 with this copy" at the Deployer's sign-off gate, after reading the held copy inside the gate itself and on a tailnet page (the What's New text, the three F-Droid changelogs carrying it word for word, and both recaptured 05 screenshots beside the ones they replace). That yes approves held-copy.md sections (a) and (b) and the ship to Mac, Windows, the Android APK on emulator evidence (as at 1.0.53 to 1.0.57, the user owns no Android device), and TestFlight. The App Store submission waits for the user's own iPhone check of build 1.0.58.1, as at every ship. The gate's first two renderings did not reach the user with the copy visible (the chat text above the question was not shown to them); the copy was put inside the question text and the option preview on the third, which is the form to use from now on.

## 17. The user's device check of TestFlight 1.0.58.1 (2026-10-21)

Build 1.0.58.1 reads VALID in App Store Connect (uploaded 2026-10-21 15:25 PDT, train 1.0.58). The user's own iPhone check: "It was processed on TestFlight and works on my iPhone", after an earlier "Works, submit it" that arrived before the build existed and was not counted. The App Store submission proceeds on build 1.0.58.1 on its own new record (1.0.57's record d5b968b4 is READY_FOR_SALE, nothing in review), with the approved What's New (held-copy.md (a)).

## 18. Deployment record: 1.0.58 on Mac, Windows, Android and TestFlight (2026-10-21)

Run by The Deployer on section 16's sign-off, with the `snowraven-release` skill.

- **Parallel-ship check, immediately before the push:** after `git fetch origin
  --tags`, `origin/main` was still `e22a9dc6`, the newest tag was `v1.0.57`, and no
  `v1.0.58` tag existed on the remote. The login keychain read `no-timeout`.
- **F-Droid changelogs:** held-copy.md (b) written to `10000581.txt`,
  `10000582.txt` and `10000584.txt`: 283 bytes each (the text and one newline),
  SHA-256 `d579aaaef2487c537c697d1e3f9671e28c24c032b416119d006dd90155d11548` each,
  ASCII only; nothing under the unsplit code `1000058`.
- **Gates on the final tree, before the release commit:** `npm run typecheck`
  and `npm run lint` exit 0; the full vitest suite exit 0, 473 files passed and 5
  skipped, 10,303 tests passed, 6 skipped, 0 failed; `npm run build` exit 0 (its
  one chunk-size warning predates this run); the backend suite exit 0, 2,066
  passed.
- **Commits pushed to `main`** as fast-forwards: `507eb48e` (`chore(release):
  1.0.58, Splits and lumps back to eBird's 2019 update`: the build's code, the
  regenerated asset and its tests, the input README, ROADMAP.md,
  `.claude/rules/bird-names.md`, the six-file version set, the three Fastlane
  changelogs, both recaptured 05 screenshots, and this run's change brief,
  decisions, PR description and held copy), `7de62264` (`fix(fdroid): the recipe
  names v1.0.58's commit`; the recipe, Fastlane and version-source guards, 57 of
  57, green before the commit), `10d3cf65` (`chore(ios): stamp iOS 1.0.58 build
  1`, the two Info.plist files only; `iosSceneManifest` and `iosWidgetManifest`,
  55 of 55, green before the commit), and the docs commit carrying this section
  and `evidence/`.
- **Tag `v1.0.58`** (lightweight, like `v1.0.57`) on
  `507eb48e7d68662fb43b886a2c2d50441a40a841`. Pages deployed the version pill from
  it (run `39685219667`, success).
- **iOS (built during the CI wait):** the stale 1.0.57.1 archive moved aside to
  `snowraven_iOS-1.0.57.1-stale-before-1.0.58.xcarchive`; the three
  `/tmp/xcshim` shims recreated. Widget extension Swift tests on the local iPhone
  18 Pro (iOS 27.0) simulator, which the test run booted and which was then shut
  down: 143 tests, 0 failures, `TEST SUCCEEDED`. `tauri ios build
  --export-method app-store-connect --build-number 1`, outside the Bash sandbox,
  against the iPhoneOS 27.1 SDK: `BUILD SUCCEEDED`; Tauri's own export refused
  with "No Account for Team" and "No profiles" (expected). The fresh archive
  reads 1.0.58 (1.0.58.1), created 15:21 local; its executable reports
  `platform IOS` (minos 16.0) and all nine swift-rs libraries `platform 2`. Tauri
  re-quoted `PRODUCT_NAME` in `project.pbxproj` (a no-op), and that file was
  restored. The archived `snowraven_widgets.appex` (`not signed at all`) was
  ad-hoc signed with its entitlements and then lists the App Group. The manual
  export (`~/.tauri/snowraven-ios-export-options.plist`) succeeded;
  `DistributionSummary.plist` lists the appex with the App Group alone (profile
  "SnowRaven Widgets App Store") and the app with the App Group, the three iCloud
  keys and `Production` (profile "SnowRaven iOS App Store iCloud AppGroup
  20260924"), both 1.0.58 (1.0.58.1). IPA SHA-256
  `5149f39f9012ea9d0676cd818d5a2617d24094bcd6fa05a3be1ab9e16bc4bea2`.
  `altool --validate-app`: VERIFY SUCCEEDED with no errors; `--upload-app`: UPLOAD
  SUCCEEDED, **Delivery UUID `ba21125d-2552-4dee-bca3-1303f54a697b`**.
- **TestFlight:** App Store Connect lists build 1.0.58.1 (`ba21125d`) `VALID`,
  uploaded 15:25 local, on train 1.0.58.
- **CI on the tag:** Windows Build `39685230527` and Android Build `39685230598`
  both succeeded, and the lookups pinned to the tag (`gh run list --workflow <wf>
  --commit 507eb48e...`) return exactly those runs. The Pipeline runs on
  `507eb48e` (`39685219580`) and `7de62264` (`39685265344`) were cancelled by the
  next push (`cancel-in-progress`); the run of record is `39685933259` on
  `10d3cf65`: success (Frontend lint, test, build; Backend lint, test).
- **Desktop:** `CI=true zsh -lc ./release.sh` exit 0 on a clean tree. Bundle
  version verified 1.0.58; iCloud entitlements and embedded profile verified; DMG
  styled, signed and verified; notarization submission
  `c8644130-2c75-4199-bdbf-64a5f3d69073` `Accepted`, stapled; Windows installer
  fetched from the tag's run and signed locally; release published 2026-10-21
  22:35 UTC, not a draft or pre-release:
  https://github.com/dtgibson/snowraven/releases/tag/v1.0.58. The DMG downloaded
  back from the release (SHA-256
  `464207e059263920ce508d75a0975a0213159903529cc62a8c068a59c1d0ec3f`) passes
  `codesign --verify` (valid on disk, satisfies its Designated Requirement),
  `stapler validate`, `spctl -a -t open --context context:primary-signature`
  (accepted, Notarized Developer ID, `DAVID THOMAS GIBSON (8QKC3L2FKP)`) and
  `hdiutil verify`, and mounts read-only to SnowRaven.app 1.0.58 (x86_64 and
  arm64). `latest.json` (resolved through `releases/latest/download`): version
  1.0.58; `darwin-aarch64` and `darwin-x86_64` identical, both on
  `SnowRaven-updater.app.tar.gz`; `windows-x86_64` on
  `SnowRaven_1.0.58_x64-setup.exe`. The published installer is byte-identical to
  run `39685230527`'s artifact (SHA-256
  `7e9fc3d5324d62645dc214abc4686a65b77bfb17d0e5f357efd63243b52bf09a`).
- **Android:** `preflight.sh` passed every check (JDK 17, build-tools 36.0.0,
  Gradle 8.14.3, cargo-tauri 2.11.2, the keystore opens, the version pair, the tag
  pushed at `507eb48e`, the three changelogs at the tag, run `39685230598`'s
  artifact `com.dtgibson.snowraven` 1.0.58 / 1000058, not debuggable). `sign.sh`
  with the recorded digest pinned: v2 and v3, signer `CN=SnowRaven, O=Dave
  Gibson`, SHA-256
  `42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`, equal to the
  keystore's certificate and to the recorded digest; signed APK SHA-256
  `738a5bca1816a69af4607d548bbdc06502483cd84f2d7de4aa9a1a11a79dd164`. Emulator
  evidence on the local API 36 Google APIs image only (`sr-api36-phone`, started
  on port 5554 so it is `emulator-5554`, headless, `-gpu host`, no snapshot
  saved; every `adb` call addressed to it by serial, and no device listing was
  taken): those exact bytes installed fresh (`pm list packages` showed no
  SnowRaven before; `versionName` 1.0.58, `versionCode` 1000058), cold start in
  680 ms to the Welcome screen with the app's one window focused and an empty
  crash buffer (`evidence/deploy-1.0.58-api36-first-launch.png`). Then, with the
  website's synthetic demo eBird backup, its Macaulay Library export and its
  `metadata.json` seeded into `/data/user/0/com.dtgibson.snowraven/data/` with
  root (the folder created owner `u0_a264`, mode 0700; files 0600; `restorecon`
  to the app data directory's own SELinux context), Species Detail showed the
  "Splits and lumps 10 species" control
  (`evidence/deploy-1.0.58-api36-splits-lumps-control.png`, the count the
  recaptured store shots show); its list opened with "Every species in your
  loaded data that eBird split or lumped in its 2019 to 2025 taxonomy updates" and
  listed American Crow (Lump 2021), Barred Owl (Split 2021), Eastern Meadowlark
  and Great Horned Owl (Split 2022) beside the 2024 and 2025 entries
  (`evidence/deploy-1.0.58-api36-splits-lumps-list.png`); picking American Crow
  showed the September 2021 lump of American Crow and Northwestern Crow
  (`evidence/deploy-1.0.58-api36-american-crow-2021-lump.png`); and the section
  ended with "Covers eBird's 2019 to 2025 taxonomy updates. A change made before
  2019 is not recorded here."
  (`evidence/deploy-1.0.58-api36-splits-lumps-coverage.png`). The crash buffer
  stayed empty, with one app window, and the app was still running when the
  emulator was stopped. WebView 133.0.6943.137: **WebView 133, unchanged since
  the last measurement.** `attach.sh` with `ANDROID_DEVICE_CHECK=partial`
  (section 16, emulator only): byte-identical to the checked file, uploaded to
  v1.0.58 as `SnowRaven_1.0.58_android_universal.apk` and downloaded back, asset
  SHA-256 `738a5bca1816a69af4607d548bbdc06502483cd84f2d7de4aa9a1a11a79dd164`.
- **F-Droid, read at the ship (public reads):** f-droid.org publishes 1.0.55
  (10000551, 10000552, 10000554) and 1.0.53. fdroiddata `master` has 1.0.56's and
  1.0.57's three entries each and `CurrentVersion` 1.0.57, nothing for 1.0.58 yet.
  State: 1.0.56 **included and this tag not yet built**; 1.0.57 **included and
  this tag not yet built**; 1.0.58 **included and this tag not yet built**. This
  tag changes nothing under `scripts/android/` or `src-tauri/gen/android/`, and
  the recipe differs from 1.0.57's only in versions, codes and the commit, so
  nothing goes to fdroiddata.
- **App Store Connect, read only, after the TestFlight build went VALID:** 26
  version records, 1.0.57 (`d5b968b4`) and every other `READY_FOR_SALE`, nothing
  in review, no 1.0.58 record; TestFlight's newest builds 1.0.58.1, 1.0.57.1,
  1.0.56.1 and 1.0.55.1, all `VALID`; no 1.0.59 build.
- **The App Store leg: 1.0.58 is ROLLED UP into 1.0.59 by the user's decision
  on 2026-10-21, before any record existed, so nothing was withdrawn.** Build
  1.0.58.1 (delivery `ba21125d`) is `VALID` and the user's iPhone check of it
  passed (section 17). After that check the coordinator first passed on the
  instruction to submit, then held it while the user chose, and the user picked
  "Fold 1.0.58 into 1.0.59": no 1.0.58 version record was created and nothing
  was submitted, so section 17's "the App Store submission proceeds" is
  superseded. The 1.0.59 record (another session's ship) carries 1.0.58, its
  What's New including held-copy.md (a), the approved paragraph, word for word.
  So 1.0.58 ends with VALID build 1.0.58.1 and no version record of its own by
  rollup, not by skip; the 1.0.59 ship adds it to CLAUDE.md's rollup list with
  the record id it is submitted on. Both 05 screenshots recaptured for this
  release (held-copy.md) go up with the 1.0.59 record, each set replaced whole
  and in order, unless that ship recaptures them again.
- **Commit trailer:** the brief asked for a `Claude Fable 5.1` co-author line;
  these commits carry `Claude Opus 5.5`, the model that made them, per the
  session's attribution rule.

## 18. 1.0.58 is ROLLED UP into 1.0.59 for the App Store (2026-10-21)

Decided by the user ("Fold 1.0.58 into 1.0.59") before any 1.0.58 version record existed, so nothing was withdrawn. The reason: the parallel build 1.0.59 (ios27-iphone-duo, in its own worktree) carries two iPhone Duo fixes, the Duo goes on sale 2026-10-23, and 1.0.58.1 is the first build on Xcode 27.1 and lacks them. 1.0.58 therefore holds VALID build 1.0.58.1 (user's iPhone check passed) and no record of its own by rollup, not by skip; the 1.0.59 record carries it, and its What's New must carry held-copy.md (a) word for word, which was sent to the 1.0.59 session verbatim along with the note that both 05 screenshots changed in 507eb48e. The macOS, Windows, Android and TestFlight legs of 1.0.58 are unaffected. CLAUDE.md's version-record list gets the rollup sentence naming both versions (The Chronicler).
