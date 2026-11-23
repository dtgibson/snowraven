# Held: the 1.0.76 release (family-rollups-and-tree + map-scroll-on-phones)

Prepared in Phase A (2026-11-22) by The Deployer, finished after the user's
answers at the first gate (decisions.md D-63: the copy and What's New text A
approved, outside requests allowed for the retakes, the demo birds fixed first).
Nothing here has been applied to its published location. Phase B applies it after the user's yes, in this
order, with `apply-release-1.0.76.sh` (each group all or nothing, refused when
already applied; `--check` dry-runs a group):

| Group | What it writes | Gated by |
|---|---|---|
| `version` | `patches/1-version-set-1.0.76.patch`: `frontend/package.json` and its lockfile, `src-tauri/tauri.conf.json` (1.0.76, versionCode 1000076), the website pill, its `aria-label` and the footer, and the in-repo F-Droid recipe (names and codes; its `commit:` lines move after the tag). Then, from the held files as they stand when the script runs, the three F-Droid changelogs `10000761/2/4.txt` (the `proposal fastlane` block) and the `CHANGELOG.md` entry (`copy/changelog-entry.md`, re-dated there to the ship day). | What's New text A, approved (D-63); the rest is the version stamp |
| `demo` | `patches/4-demo-birds-1.0.76.patch`: the nine pre-2026 bird names in `website/tools/gen-demo-data.mjs` (and its header note), the reviewer copies `website/demo/snowraven-demo-ebird-backup.csv` and `snowraven-demo-ml-export.csv` regenerated from it, and one test title in `hotspotReportsDemoData.test.ts` | covered by the user's yes on the `website/tools/` change (D-63) |
| `copy` | README section, website row, listing bullet and length, from the before/after blocks in `copy/published-copy.md` (`apply-pairs.py`), plus `patches/2-copy-tools-and-guard-1.0.76.patch`: the new `familyTreeSurfacesPublishedClaims.test.ts`, `SUPERSEDED` entries in `hotspotReportsSurfacesPublishedClaims.test.ts` for the edits this copy makes inside 1.0.71's blocks, the capture tools' Family Tree job, the browser harness moved into `website/tools/verify/` with its `run.mjs` entry and 1,200 s budget, and `pipeline.yml`'s frontend job bound raised from 90 to 110 minutes with its arithmetic | approved (D-63) |
| `pictures` | every file in `pictures/manifest.tsv` (46) to its published path | the user's look at the finished sets, at the deploy sign-off |
| `records` | `patches/3-records-1.0.76.patch`: the map build's `DECISIONS.md` heading and `ROADMAP.md` line read "shipped in 1.0.76" | none (record) |

If the user changes a word, edit the block in `copy/published-copy.md` first;
the apply script and both surfaces guards read the blocks when they run.

## Files

- `copy/published-copy.md`: every published sentence, BEFORE and AFTER, and the What's New options (A recommended, B the one-sentence alternative).
- `copy/changelog-entry.md`: the CHANGELOG entry (not gated copy).
- `copy/privacy-accessibility-review-notes-read.md`: why the privacy policy, the accessibility statement, the review notes and the F-Droid description need no change.
- `device-check-request.md`: the user's iPhone check for this release, step by step, marked as this release's change or routine.
- `pictures/`: the retaken frames (website, App Store raws and composed frames, F-Droid) and `manifest.tsv`; the F-Droid retakes kept only for comparison (`*-keep-published-retake-for-comparison.png`, `3-different-view-not-for-publication.png`) are not in the manifest, and `pictures/fdroid/NOTES.md` records how every F-Droid frame was taken and judged.
- `apply-release-1.0.76.sh`, `apply-pairs.py`: the apply tooling.

## Open: the iPad and iPhone Duo Weather frames

`appstore/screenshots/{ipad-13,iphone-duo}/03-weather-tide.png` are not retaken:
their checklist lookup reads the checklist from eBird, and the capture setup's
own key file holds no eBird key (only the OpenWeather one). With the user's
leave to use the eBird key in SnowRaven's own app data, each is one more run of
`capture-appstore.mjs` (`FAMILY=ipad SHOT=03`, `FAMILY=duo SHOT=03`) with the
Weather lookup routed to the keyed scratch backend, then compared, composed and
added to `manifest.tsv`. Every other frame of every set is decided
(`../../deployment.md`, part one (b)).

## How it was proven

On a fresh clone of `fea69e3b` with all five groups applied: `npm run build`,
`npx eslint .` (no output), `npx vitest run` (547 files passed, 5 skipped;
12,136 tests passed, 11 skipped), `website/tools` `npm test` (15 of 15), and
`npm run verify` (10 of 10 harnesses green, 989 s). Each group refuses a tree it
cannot fully apply to and leaves it untouched, and refuses a second run. The
new surfaces guard leaves the built CSS byte-identical; deleting the new README
section turns both surfaces suites red; in its held state the new suite passes
on the unapplied tree. Full readings in `../../deployment.md`.
