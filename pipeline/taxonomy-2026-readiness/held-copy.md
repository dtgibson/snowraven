# Held copy: taxonomy-2026-readiness

`CHANGELOG.md` entries are written at the release commit, so the proposed entry waits here for the release that carries both legs (1.0.61). The CHANGELOG entry itself is not published copy, but the F-Droid changelogs (three identical files under `fastlane/metadata/android/en-US/changelogs/`, codes 10000611, 10000612 and 10000614) and the App Store "What's New" are, and both wait for the user's yes. The texts below were shown to the user at the deploy sign-off; the gate's answer records whether they were approved as written.

## Proposed CHANGELOG.md entry

## [1.0.61] - 2026-11-03

### Changed
- **SnowRaven carries eBird's 2026 taxonomy.** The bird names, species codes, and countability rules that ship with the app, and the Splits and lumps record in Species Detail, now follow eBird's October 2026 update: 39 species gained through splits, 7 lost through lumps, and 2 newly described, with Willet and Marsh Wren among the splits. Splits and lumps now covers eBird's 2019 to 2026 updates. eBird also renamed most subspecies-group names this year, so a bird recorded under one of the old group names in a backup downloaded before the update counts again once you download a fresh backup from eBird.

### Fixed
- **A self-hosted SnowRaven keeps up with eBird's taxonomy.** On the web and Raspberry Pi version, the server's saved copy of eBird's taxonomy is now refreshed whenever eBird changes it, a server left running fetches it again once a week, as the apps do, and an offline start no longer prefers an old saved copy to the newer one built into the release. The Mac, Windows, iPhone, iPad, and Android apps are unchanged by this fix.

### Internal
- The bundled taxonomy snapshot (both twins), the countability and species-code assets and the splits-and-lumps history are regenerated from eBird's 2026 taxonomy (18,631 entries, 11,201 species), stamped "2028" with the desktop `CACHE_KEY` moved to `taxonomy-v2028` in lockstep. The 2026 `UPDATE_PUBLISHED` row (published 2026-10-29; 39 gained, 7 lost) reproduces eBird's tally with no recount. Every figure pinned to the 2025 snapshot was re-derived (the list is in `pipeline/taxonomy-2026-readiness/decisions.md`), and the runbook's step 6 now seeds its search with every measured figure, not only the two counts.
- Two new checks fail the tests if a Frivolous Lists name or a species code in the bundled eBird taxonomy stops fitting what the app expects, the taxonomy generator refuses a code outside that shape before writing anything, and `scripts/taxonomy-history-input/README.md` holds the annual taxonomy refresh as one ordered runbook.
- The F-Droid changelog for this release is three identical files, one per processor-type build (`10000611.txt`, `10000612.txt`, `10000614.txt`), and the in-repo F-Droid recipe names 1.0.61.

## Proposed F-Droid changelog (the three files, identical; under 500 characters)

SnowRaven now carries eBird's October 2026 taxonomy update in its bird names, species codes, countability rules, and the Splits and lumps record, which now covers 2019 to 2026. A bird recorded under one of the subspecies-group names eBird renamed this year counts again once you download a fresh backup from eBird. Nothing else changes on Android.

## Proposed App Store "What's New"

SnowRaven now carries eBird's October 2026 taxonomy update in its bird names, species codes, countability rules, and the Splits and lumps record, which now covers 2019 to 2026. A bird recorded under one of the subspecies-group names eBird renamed this year counts again once you download a fresh backup from eBird.
