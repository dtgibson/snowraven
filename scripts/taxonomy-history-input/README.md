# Inputs for `scripts/build-taxonomy-history.mjs`

This directory holds the files the splits-and-lumps history generator reads. It
is gitignored except for this README: the files are the Cornell Lab's published
data, several megabytes each and re-downloadable, so the repository commits only
the generator's output (`frontend/src/assets/ebird-taxonomy-history.json`), the
same way the taxonomy snapshot is committed without the API response behind it.

The generator reads only regular `.csv` files at the top level of this
directory, and only under these exact names. It refuses any other `.csv` name,
and it refuses an input that no covered year needs, so the directory's contents
state the coverage. Subdirectories are ignored, so keep scratch downloads in one.

## What to put here

For every update year Y the asset should cover, plus the update P before the
earliest covered year:

| File | What it is | Where it comes from |
|---|---|---|
| `clements-integrated-vY.csv` | The eBird/Clements integrated checklist for Y, as CSV (UTF-8). It carries the per-row change annotation ("Clements vY change"), the "text for website vY" sentence and the previous year's sort key. | Cornell's download page for that year's update, e.g. https://www.birds.cornell.edu/clementschecklist/download/ and the "October 2025" / "October 2024" / "October 2023" update pages. If only the XLSX is available, export its first sheet to CSV (UTF-8) with every cell exactly as stored. |
| `ebird-taxonomy-vY.csv` | Cornell's eBird taxonomy file for Y (`eBird_taxonomy_vY.csv`). | The same download page. |

`birds.cornell.edu` answers automated clients with a Cloudflare 403, so these are
downloaded **in a browser**. (Archived copies on the Wayback Machine are byte
copies of the same files and are fine to use.)

**Use Cornell's taxonomy file, not the eBird API's.** `api.ebird.org`'s
`ref/taxonomy/ebird?version=Y` returns that year's codes and categories but
TODAY's common names (measured 2026-09-30: 813 names differ for 2023 and 229 for
2024). A before-side entry must carry the name an export made before the update
carries, which only the year's own file has.

## The files behind the committed asset (coverage 2019 to 2026)

The asset covers eBird's 2019, 2021, 2022, 2023, 2024, 2025 and 2026 updates
(eBird released no 2020 update, so 2021's previous update is 2019), which takes
16 files: the integrated checklist and the taxonomy for each of 2018 (the update
before 2019, read as the previous year only) and 2019 to 2026.

| File | Source | Changed before use |
|---|---|---|
| `clements-integrated-v2018.csv` | `eBird-Clements-v2018-integrated-checklist-August-2018.csv` | Windows-1252 to UTF-8. No change columns; it is 2019's previous-year file only. |
| `clements-integrated-v2019.csv` | `Clements-Checklist-v2019-August-2019.csv`, the **Clements checklist**, not the integrated file | Windows-1252 to UTF-8. See the note below. |
| `clements-integrated-v2021.csv` | `eBird-Clements-v2021-integrated-checklist-August-2021.csv` | DOS code page 437 to UTF-8. A few range cells had already lost a character at the source. |
| `clements-integrated-v2022.csv` | `eBird-Clements-v2022-integrated-checklist-October-2022.xlsx` | First sheet exported to CSV, every cell as stored (the archived CSVs of that release are truncated or mislabeled). |
| `clements-integrated-v2023.csv` | `eBird-Clements-v2023-integrated-checklist-October-2023.csv` | none |
| `clements-integrated-v2024.csv` | `eBird-Clements-v2024-integrated-checklist-October-2024-rev.csv` | none |
| `clements-integrated-v2025.csv` | `eBird-Clements_v2025-integrated-checklist-October-2025.csv` | none |
| `clements-integrated-v2026.csv` | `eBird-Clements_v2026_integrated-checklist-October-2026.csv` | none (UTF-8 with a byte-order mark, as Cornell ships it). |
| `ebird-taxonomy-v2018.csv` | `eBird_Taxonomy_v2018_14Aug2018.csv` | Mac Roman to UTF-8; its CR line endings are kept, because the generator's parser reads them. |
| `ebird-taxonomy-v2019.csv` to `ebird-taxonomy-v2024.csv` | Cornell's `eBird_Taxonomy_v2019.csv`, `eBird_Taxonomy_v2021.csv`, `ebird_taxonomy_v2022.csv`, `ebird_taxonomy_v2023.csv` and `eBird_taxonomy_v2024.csv` | none |
| `ebird-taxonomy-v2025.csv` | `eBird_taxonomy_v2025.csv` | Gunzipped: the archived capture was stored gzip-compressed. |
| `ebird-taxonomy-v2026.csv` | `eBird_Taxonomy_v2026-october-2026.csv` | none (UTF-8 with a byte-order mark and CRLF line endings, as Cornell ships it; its header row is lowercase, which the column matching reads as is). |

**The 2019 integrated file cannot stand in for itself.** Cornell's 2019
integrated CSV and XLSX carry only the code, taxon order, category, names,
range, order, family, group and extinct columns; that year the change
annotation, the "text for website" sentence and the 2018 sort column exist
only in the Clements checklist, so the checklist is saved under the integrated
file's name. Its 2019 sort equals the integrated file's and the taxonomy's
TAXON_ORDER for every species (measured 2026-10-21).

**Legacy encodings.** The generator reads UTF-8 and fails closed on U+FFFD (a
non-UTF-8 file read as UTF-8), so an older file is converted first:
`iconv -f CP1252 -t UTF-8` (Windows-1252), `iconv -f CP437 -t UTF-8` (DOS
code page 437) or `iconv -f MACINTOSH -t UTF-8` (Mac Roman), and a gzipped
capture is gunzipped. Check a conversion by eye on an accented name before
running the generator: a wrong code page yields plausible wrong letters, which
no U+FFFD check can see.

**Where they came from.** Every file for 2018 to 2025 is a Wayback Machine
capture of Cornell's own upload, fetched raw with
`https://web.archive.org/web/<timestamp>id_/<Cornell upload URL>`. The two 2026
files were downloaded from Cornell's site in a browser for the 2026 refresh and
used unchanged, so `originals/` holds nothing for them. Their sha256:
`ebird-taxonomy-v2026.csv`
`dcabf48e85abb2494e80780258a21da0c6ec0425fbe0577a7cbb5e0e61b9c4ab`,
`clements-integrated-v2026.csv`
`ca63a4c93fe20f1ea6d073e6ff929c3d1f0b0ed7592839ecfce1ef296237a331`. The
`originals/` subfolder (ignored by the generator) keeps the captured bytes of
each file that was changed before use, with `SOURCES.md` giving each file's
capture timestamp and the change applied, and the sources of the three
announced tallies below. Like the rest of this directory, `originals/` stays on
the machine that fetched the files and is not in the repository, so this
section is the tracked record of where each file came from.

eBird's announced tallies for these years (species gained through splits,
species lost through lumps): 2019 106 / 20 (Cornell's "Overview August 2019"),
2021 94 / 8 and 2022 118 / 41 (eBird's announcements), beside 2023 124 / 16,
2024 141 / 16, 2025 40 / 18 and 2026 39 / 7 (eBird's "2026 Taxonomy Update",
https://ebird.org/news/2026-taxonomy-update). They are on the `announced`
field of each year's `UPDATE_PUBLISHED` row.

## The annual refresh, in order

eBird publishes one taxonomy update a year (between August and November in the
years covered so far). The two generators, `scripts/build-ebird-taxonomy.mjs`
(the snapshot, countability and species-code assets) and
`scripts/build-taxonomy-history.mjs` (the splits-and-lumps history, built from
this directory's files), refresh together and land in one commit: the history
holds every after-side code and name to the snapshot, and records the snapshot
version it was built against. Start only once the live API, Cornell's two files
and eBird's announcement all exist; they do not always land on the same day.

1. **Confirm the update is out.** `ref/taxonomy/versions` needs no key:

   ```
   curl -s https://api.ebird.org/v2/ref/taxonomy/versions
   ```

   The new year must be the entry marked `"latest":true`. Find eBird's
   announcement of the update and record three things from it, with its URL:
   the date it was published, the number of species gained through splits and
   the number lost through lumps. A year without its announced tally cannot
   ship, because that tally is the check the history generator rests on.
   The published date is the "Updated DD Mon YYYY eBird Taxonomy vYYYY" line
   on https://science.ebird.org/en/use-ebird-data/the-ebird-taxonomy (for 2026,
   "Updated 29 Oct 2026"), read by a person in a browser: eBird's and Cornell's
   pages refuse scripts.

2. **Download Cornell's two files in a browser** (the site refuses scripts with
   a 403): the eBird taxonomy CSV and the integrated checklist for the year.
   Save them here under the generator's fixed names, `ebird-taxonomy-vY.csv`
   and `clements-integrated-vY.csv` (for 2026: `ebird-taxonomy-v2026.csv` and
   `clements-integrated-v2026.csv`), whatever Cornell called them. Convert
   either to UTF-8 if it is not already (see "Legacy encodings" above), check
   an accented name by eye, and keep the original bytes of any file you changed
   in `originals/`, with a line in `originals/SOURCES.md`. Add both files to the
   table of files above.

3. **Bump the two cache counters together, by one:** `VERSION` in
   `scripts/build-ebird-taxonomy.mjs` and `CACHE_KEY` in
   `frontend/src/lib/tauri/taxonomyService.ts` (for the 2026 update, "2027" to
   "2028" and `taxonomy-v2027` to `taxonomy-v2028`). They are cache counters,
   not taxonomy years: the snapshot stamped "2027" holds eBird's 2025 taxonomy.
   The web/Pi backend needs no edit; it reads the version from its bundled
   snapshot, and stops using a copy saved under the old version offline once
   the new snapshot ships. Skipping this step makes step 4 stop with the
   revision message and write nothing.

4. **Run the snapshot generator with the eBird key in its environment only.**
   On the Mac, the key is the `ebird` entry of the app's own key store. Read it
   straight into the generator's environment, so it is never printed, never in
   a command line or the shell history, and never written to a file:

   ```
   EBIRD_API_KEY="$(node -e 'try { const p = require("os").homedir() + "/Library/Application Support/com.snowraven/data/api-keys.json"; process.stdout.write(JSON.parse(require("fs").readFileSync(p, "utf8")).ebird ?? "") } catch { process.stderr.write("api-keys.json could not be read; nothing was printed\n"); process.exit(1) }')" node scripts/build-ebird-taxonomy.mjs
   ```

   If the key file is missing or does not parse, the command prints only
   `api-keys.json could not be read; nothing was printed`, and the generator
   then stops for want of a key. Node's own error would quote the failing line,
   and the app writes the key file as one line, so that line holds every stored
   key.

   On a web/Pi install the key is in `backend/.env`, and
   `node --env-file=backend/.env scripts/build-ebird-taxonomy.mjs` does the
   same. Do not echo the variable, paste the key anywhere, or add it to
   `backend/.env` for this. The generator writes both snapshot twins
   (`frontend/src/assets/ebird-taxonomy.json` and
   `backend/staticdata/ebird_taxonomy.json`), the countability asset and the
   species-code asset, or nothing: it stops on a truncated fetch, a dangling
   `reportAs`, a species code outside the shape the app's code guards accept,
   or a failed check on the countability or four-letter-code assets.

5. **Add the year to `UPDATE_PUBLISHED`** in
   `scripts/lib/taxonomyHistoryDerive.mjs`: its published date,
   `mark: 'measured'` and the announced tally, with the announcement cited in
   the comment block above the table, as for every earlier year. Then run:

   ```
   node scripts/build-taxonomy-history.mjs
   ```

   It writes `frontend/src/assets/ebird-taxonomy-history.json`, or nothing. It
   fails closed on an unreadable file, a split daughter with no single parent,
   a lump with fewer than two species, a year whose events do not reproduce
   eBird's announced tally, or an output that breaks any of the asset's
   invariants.

   If a year's events differ from eBird's tally only because eBird counts one
   reorganization by its net change (three species became two: one lost, none
   gained, where the events count a split's daughter and two lumps), add that
   reorganization to `ANNOUNCED_RECOUNTS` beside `UPDATE_PUBLISHED`, citing the
   announcement that shows it, as for 2019's white-eyes and 2022's hill mynas.
   A recount may only relabel within the events it names: its events must each
   be derived exactly once, each of its two figures must lie between zero and
   its events' own, and its net must equal theirs, so it never changes the net
   and can lower the compared tally only by what its own events count. Any
   other difference is a resolver to fix, never a loosened check.

6. **Re-derive every figure measured on the old snapshot.** Until the commit,
   the old snapshot is still in git; print its code and species counts:

   ```
   git show HEAD:frontend/src/assets/ebird-taxonomy.json | node -e 'let t = ""; process.stdin.on("data", (d) => { t += d }).on("end", () => { const s = JSON.parse(t); console.log(Object.keys(s.byCode).length, Object.keys(s.byCom).length) })'
   ```

   Those two seed the search but do not finish it (in 2026 they missed four
   figures). Measure the other figures on the old assets too: the count of
   snapshot strings (keys and values), the longest name's length and the
   mean name length, the number of groups by normalized name, the
   countability corrections in `ebird-countability.json` and their countable
   and non-countable split, the hybrid and intergrade counts, the entries in
   `ebird-alpha-codes.json` that carry a code, and the longest code. Search
   the tree for every one of these numbers, with and without a thousands
   separator, and re-derive each one from the new snapshot together with the
   claim beside it; never change a number alone. The known sites are the
   counts in `countableForms.test.ts`, `csvParserIntergradeFilter.test.ts`,
   `speciesUtilsMemoBound.test.ts` (and its longest-name figure) and
   `truncateAtFirstParen.test.ts` (its count of snapshot strings), and the
   comments in `exoticProvenanceCache.ts` (species, codes and the code shape),
   `speciesCode.ts` (the longest code), `speciesUtils.ts` and
   `build-countability.mjs` (the published names and the countability
   corrections), `ebirdTaxonomyDerive.mjs` (`MIN_ALPHA_CODE_ENTRIES` and
   `MAX_HYPHENATED_TOKENS`) and the plausibility floors in
   `build-ebird-taxonomy.mjs`. If `frivolousLists.test.ts` turns red, a listed
   species was renamed or split: change the list to eBird's current name.

7. **Run every check:** the full frontend suite (`cd frontend && npx vitest
   run`, because pinned text was edited), the backend suite
   (`cd backend && .venv/bin/python -m pytest tests/ -v`), `npm run build` and
   `npx eslint .` in `frontend/`. `entryChunk.test.ts` confirms the snapshot
   stays off the entry chunk and the countability asset stays small, and
   `cmp` on the two snapshot twins confirms they are identical.

8. **Ship it as a patch release on every platform**, through the release
   skill. The F-Droid changelogs and the App Store "What's New" are published
   copy and wait for the user's yes.

### If Cornell changed the files

2026 is the first update since Cornell began aligning its checklist with
AviList, so the file names, the header row or the change annotations may not
match earlier years. A renamed file is simply saved under the fixed name
(step 2). The history generator reads these columns, and fails closed with a
message naming any it cannot find:

- the taxonomy file: `SPECIES_CODE`, `CATEGORY`, `PRIMARY_COM_NAME` (or
  `common_name`), `SCI_NAME` and `REPORT_AS`;
- the integrated checklist: `category`, `English name`, `scientific name`, the
  year's own `sort vY`, the previous update's sort column, `Clements vY change`
  and `text for website vY`. Header case does not matter, an underscore reads
  as a space, and the change and website columns may carry a letter after the
  year.

A missing column reads like
`clements-integrated-v2026.csv: missing required column sort v2026 (its header
row has: "...", "...")`, listing the header the file does have. A file with no
change annotation or no "text for website" column is not refused outright: its
year is not covered, and the run stops saying which file lacks which column
(`... has no Clements v2026 change column`). Widen a matcher in
`scripts/lib/taxonomyHistoryDerive.mjs` only against the real file, with a row
in `frontend/src/lib/taxonomyHistoryGenerator.test.ts` for the new spelling.
The tally in step 5 is the check that a widened matcher still reads the year
correctly.

What 2026 actually changed (measured 2026-11-03): the eBird taxonomy file's
header became lowercase (`species_code`, `primary_com_name`, ...), which the
case-insensitive matching reads as is, and the integrated checklist kept every
column the generator needs. Its two newly described species carry `species
ratified` rather than `new species`; neither carries `split`, so neither can be
read as a split daughter and the tally reproduced with no matcher change. A
future row carrying both `split` and `species ratified` would be counted as a
daughter, and the tally check would then stop the run. Separately, eBird renamed
most Latin-epithet subspecies-group slash names to English group names
(`Red-tailed Hawk (calurus/abieticola)` is now `Red-tailed Hawk
(Western/Northern)`, same code), which moves the countability figures in step
6 and the test fixtures that used a renamed name as their example.
