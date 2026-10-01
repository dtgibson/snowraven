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

## The files behind the committed asset (coverage 2023 to 2025)

| File | Source |
|---|---|
| `clements-integrated-v2022.csv` | `eBird-Clements-v2022-integrated-checklist-October-2022.xlsx`, first sheet exported to CSV (the archived CSVs of that release are truncated or mislabeled) |
| `clements-integrated-v2023.csv` | `eBird-Clements-v2023-integrated-checklist-October-2023.csv` |
| `clements-integrated-v2024.csv` | `eBird-Clements-v2024-integrated-checklist-October-2024-rev.csv` |
| `clements-integrated-v2025.csv` | `eBird-Clements_v2025-integrated-checklist-October-2025.csv` |
| `ebird-taxonomy-v2022.csv` to `ebird-taxonomy-v2025.csv` | Cornell's `eBird_taxonomy_v2022.csv` to `eBird_taxonomy_v2025.csv` |

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
