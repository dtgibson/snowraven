# Held: the 1.0.76 release (family-rollups-and-tree + map-scroll-on-phones)

Prepared in Phase A (2026-11-22) by The Deployer. Nothing here has been applied
to its published location. Phase B applies it after the user's yes, in this
order, with `apply-release-1.0.76.sh` (each group all or nothing, refused when
already applied; `--check` dry-runs a group):

| Group | What it writes | Gated by |
|---|---|---|
| `version` | `patches/1-version-set-1.0.76.patch`: `frontend/package.json` and its lockfile, `src-tauri/tauri.conf.json` (1.0.76, versionCode 1000076), the website pill, its `aria-label` and the footer, and the in-repo F-Droid recipe (names and codes; its `commit:` lines move after the tag). Then, from the held files as they stand when the script runs, the three F-Droid changelogs `10000761/2/4.txt` (the `proposal fastlane` block) and the `CHANGELOG.md` entry (`copy/changelog-entry.md`, re-dated there to the ship day). | the user's yes on What's New (the changelog text); the rest is the version stamp |
| `copy` | README section, website row, listing bullet and length, from the before/after blocks in `copy/published-copy.md` (`apply-pairs.py`), plus `patches/2-copy-tools-and-guard-1.0.76.patch`: the new `familyTreeSurfacesPublishedClaims.test.ts`, `SUPERSEDED` entries in `hotspotReportsSurfacesPublishedClaims.test.ts` for the edits this copy makes inside 1.0.71's blocks, the capture tools' Family Tree job, the browser harness moved into `website/tools/verify/` with its `run.mjs` entry and 1,200 s budget, and `pipeline.yml`'s frontend job bound raised from 90 to 110 minutes with its arithmetic | the user's yes on the sentence, the alt text, and the website tools change |
| `pictures` | every file in `pictures/manifest.tsv` to its published path | the user's yes on the pictures |
| `records` | `patches/3-records-1.0.76.patch`: the map build's `DECISIONS.md` heading and `ROADMAP.md` line read "shipped in 1.0.76" | none (record) |

If the user changes a word, edit the block in `copy/published-copy.md` first;
the apply script and both surfaces guards read the blocks when they run.

## Files

- `copy/published-copy.md`: every published sentence, BEFORE and AFTER, and the What's New options (A recommended, B the one-sentence alternative).
- `copy/changelog-entry.md`: the CHANGELOG entry (not gated copy).
- `copy/privacy-accessibility-review-notes-read.md`: why the privacy policy, the accessibility statement, the review notes and the F-Droid description need no change.
- `device-check-request.md`: the user's iPhone check for this release, step by step, marked as this release's change or routine.
- `pictures/`: the retaken frames (website, App Store raws and composed frames, F-Droid) and `manifest.tsv`; files named `*-structural-not-for-publication.png` are not in the manifest.
- `apply-release-1.0.76.sh`, `apply-pairs.py`: the apply tooling.

## Not retaken in Phase A, awaiting the user's leave for outside requests

Phase A sent no request to any host but this Mac. These frames need one and
still show the menu without Family Tree:

- OpenFreeMap tiles: website `map.webp`, `map-dark.webp`, `hotspot-reports.webp`; App Store iPad `01-map-explorer.png` and `07-hotspot-reports.png`, iPhone Duo `01-map-explorer.png`.
- The Android emulator's network (the app's own tiles, and the eBird and Birds of the World site icons its WebView loads beside every name; the WebView's own Google connections come with it): F-Droid tablet `1`, `2`, `4`, `5`, `6` (their `*-structural-not-for-publication.png` files show the layout only).
- The Weather lookup (an eBird checklist read and an OpenWeather call with the capture backend's keys, plus NOAA): App Store iPad and iPhone Duo `03-weather-tide.png`.

With leave, each is one more run of the same capture command against the same
rig with the network open, compared with its published frame, and added to
`manifest.tsv`; the composed sets are re-run by `compose-appstore.mjs`.

## How it was proven

On a fresh clone of `012c3b7c` with all four groups applied: `npm run build`,
`npx eslint .` (no output), `npx vitest run` (547 files passed, 5 skipped;
12,136 tests passed, 11 skipped), `website/tools` `npm test` (15 of 15), and `npm run verify` (10 of 10 harnesses green, 989 s).
The new guard leaves the built CSS byte-identical; deleting the new README
section turns both surfaces suites red; in its held state the new suite passes
on the unapplied tree. Full readings in `../../deployment.md`.
