# Draft: the CHANGELOG.md entry for the Hotspot Reports release

**For the Deployer.** `CHANGELOG.md` is written at the version bump, not here. The version is read off `main` at ship time: this draft assumes **1.0.71** (the next patch after 1.0.70, `bundle.android.versionCode` 1000071), and the Deployer confirms the number, the date and the file names before writing it, and adds any other change that rides the same release. The `### Added` paragraph follows the Help section's wording; nothing in it is published copy until the What's New and the store text it echoes are approved (`appstore.md`, `fastlane-changelog.md`).

```markdown
## [1.0.71] - 2026-11-DD

### Added
- **A Hotspot Reports tab, between Breeding Codes and Checklists.** It reports on any one place in your eBird backup, a public eBird hotspot or one of your personal locations, chosen from a Location picker that matches what you type against each place's name, county, and state or province, and shows a namesake's Location ID beside it. Before you choose, an overview counts your locations, splits them into hotspots and personal locations once eBird has answered, and lists your places with the most checklists and the most species; a place is never called personal until eBird has answered for its region. A report shows the place's species and checklist totals; its life list, each species dated to your first record there, with how many of the place's checklists include it; a plain map with one pin; your checklists there by eBird protocol, with the complete-checklist share; the weather on your visits from the SnowRaven and RainCrow weather blocks in your own checklist comments, summarized from 10 readable blocks on and never looked up; your first and latest visit, time birded, the checklist with the most species, and visits by month and by year; and, with your ML export saved, the photos, audio recordings, and videos linked to the place's checklists. One species rule governs every species figure on the tab, the one Life Lists follows at its defaults, and Help explains why Statistics' top locations by species and the Map Explorer's My species can show a different number for the same place. The place you choose is per-session, resetting on relaunch.

### Changed
- The default tab order gains Hotspot Reports between Breeding Codes and Checklists. A saved copy of the previous default order reads as the new one; any other saved order keeps its own order and gets the new tab last.
- Help's two Map Explorer sentences about the maps' corner buttons now say which maps carry them: copying a location works on every map with a share button in its corner, and the Weather tab's Plan location picker and the map in a Hotspot Reports report have none.

### Internal
- New `lib/hotspotReports.ts` (the per-location index, built once per load), `lib/hotspotReportsLocation.ts` (one place's facts and the species rule over them), `lib/hotspotReportsPicker.ts`, `lib/hotspotReportsKind.ts` (the kind, read passively from the shared hotspot Set), `lib/hotspotReportsProvenance.ts` (the passive escapee reader) and `lib/hotspotReportsCopy.ts`, with the tab under `components/hotspotReports/`. The report's map is the tab's only `SnowMap` importer and loads lazily. The Statistics Weather section's distribution row moved to `components/WeatherDistRow.tsx`, pinned by a markup golden captured before the move.
- `docs/HELP.md` gains `## Hotspot Reports` and names the tab in its two lists of tabs and in the ML export lists; `helpToc.test.ts` counts 20 sections. `hotspotReportsPublishedClaims.test.ts` holds Help's section, its two lists of tabs and the re-scoped map sentences to `TAB_LABELS`, `DEFAULT_TAB_ORDER`, the tab's copy module, `WEATHER_SPECIES_MIN_CHECKLISTS` and the map components' own source; `hotspotReportsSurfacesPublishedClaims.test.ts` holds the README, website and App Store sentences.
- The F-Droid changelog for this release is three identical files, one per processor-type build (`10000711.txt`, `10000712.txt`, `10000714.txt`), and the in-repo F-Droid recipe names 1.0.71.
```

Notes for the Deployer:

- Add a `### Changed` line for the phone More sheet if its height cap moved in this build (FR-05; the measured cap is in `pipeline/hotspot-reports/decisions.md`), in the form "On a phone, the More sheet is tall enough to show every destination at the default text size" only if the WebKit measurement supports exactly that.
- The "summarized from 10 readable blocks on" figure is `WEATHER_SPECIES_MIN_CHECKLISTS`; if that constant moves before the ship, so does this line.
- `CHANGELOG.md` is a historical record and is outside the em dash sweep, but this draft carries none.
