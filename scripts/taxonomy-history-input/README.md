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

## The files behind the committed asset (coverage 2019 to 2025)

The asset covers eBird's 2019, 2021, 2022, 2023, 2024 and 2025 updates (eBird
released no 2020 update, so 2021's previous update is 2019), which takes 14
files: the integrated checklist and the taxonomy for each of 2018 (the update
before 2019, read as the previous year only) and 2019 to 2025.

| File | Source | Changed before use |
|---|---|---|
| `clements-integrated-v2018.csv` | `eBird-Clements-v2018-integrated-checklist-August-2018.csv` | Windows-1252 to UTF-8. No change columns; it is 2019's previous-year file only. |
| `clements-integrated-v2019.csv` | `Clements-Checklist-v2019-August-2019.csv`, the **Clements checklist**, not the integrated file | Windows-1252 to UTF-8. See the note below. |
| `clements-integrated-v2021.csv` | `eBird-Clements-v2021-integrated-checklist-August-2021.csv` | DOS code page 437 to UTF-8. A few range cells had already lost a character at the source. |
| `clements-integrated-v2022.csv` | `eBird-Clements-v2022-integrated-checklist-October-2022.xlsx` | First sheet exported to CSV, every cell as stored (the archived CSVs of that release are truncated or mislabeled). |
| `clements-integrated-v2023.csv` | `eBird-Clements-v2023-integrated-checklist-October-2023.csv` | none |
| `clements-integrated-v2024.csv` | `eBird-Clements-v2024-integrated-checklist-October-2024-rev.csv` | none |
| `clements-integrated-v2025.csv` | `eBird-Clements_v2025-integrated-checklist-October-2025.csv` | none |
| `ebird-taxonomy-v2018.csv` | `eBird_Taxonomy_v2018_14Aug2018.csv` | Mac Roman to UTF-8; its CR line endings are kept, because the generator's parser reads them. |
| `ebird-taxonomy-v2019.csv` to `ebird-taxonomy-v2024.csv` | Cornell's `eBird_Taxonomy_v2019.csv`, `eBird_Taxonomy_v2021.csv`, `ebird_taxonomy_v2022.csv`, `ebird_taxonomy_v2023.csv` and `eBird_taxonomy_v2024.csv` | none |
| `ebird-taxonomy-v2025.csv` | `eBird_taxonomy_v2025.csv` | Gunzipped: the archived capture was stored gzip-compressed. |

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

**Where they came from.** Every file above is a Wayback Machine capture of
Cornell's own upload, fetched raw with
`https://web.archive.org/web/<timestamp>id_/<Cornell upload URL>`. The
`originals/` subfolder (ignored by the generator) keeps the captured bytes of
each file that was changed before use, with `SOURCES.md` giving each file's
capture timestamp and the change applied, and the sources of the three
announced tallies below. Like the rest of this directory, `originals/` stays on
the machine that fetched the files and is not in the repository, so this
section is the tracked record of where each file came from.

eBird's announced tallies for these years (species gained through splits,
species lost through lumps): 2019 106 / 20 (Cornell's "Overview August 2019"),
2021 94 / 8 and 2022 118 / 41 (eBird's announcements), beside 2023 124 / 16,
2024 141 / 16 and 2025 40 / 18. They are on the `announced` field of each
year's `UPDATE_PUBLISHED` row.

## The annual refresh

After `scripts/build-ebird-taxonomy.mjs` writes the new snapshot, add the new
year's two files here, add the year's published date and eBird's announced
tally (species gained through splits, species lost through lumps) to
`UPDATE_PUBLISHED` in `scripts/lib/taxonomyHistoryDerive.mjs`, and run:

```
node scripts/build-taxonomy-history.mjs
```

The generator fails closed, and writes nothing, on anything it cannot resolve:
an unreadable file, a split daughter with no single parent, a lump with fewer
than two species, a year whose events do not reproduce eBird's announced tally,
or an output that breaks any of the asset's invariants.

If a year's events differ from eBird's tally only because eBird counts one
reorganization by its net change (three species became two: one lost, none
gained, where the events count a split's daughter and two lumps), add that
reorganization to `ANNOUNCED_RECOUNTS` beside `UPDATE_PUBLISHED`, citing the
announcement that shows it, as for 2019's white-eyes and 2022's hill mynas. A
recount may only relabel within the events it names: its events must each be
derived exactly once, each of its two figures must lie between zero and its
events' own, and its net must equal theirs, so it never changes the net and
can lower the compared tally only by what its own events count. Any other
difference is a resolver to fix.
