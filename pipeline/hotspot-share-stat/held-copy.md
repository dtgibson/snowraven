# Held copy: hotspot-share-stat

`CHANGELOG.md` entries are written at the release commit, so the proposed entry waits here for the release that carries this feature (the next patch, 1.0.62). The CHANGELOG entry itself is not published copy, but the F-Droid changelogs (three identical files under `fastlane/metadata/android/en-US/changelogs/`, codes 10000621, 10000622 and 10000624) and the App Store "What's New" are, and both wait for the user's yes. Nothing below has been written into any of those files.

## Proposed CHANGELOG.md entry

## [1.0.62] - (release date)

### Added
- **Statistics shows how much of your birding is at public hotspots.** A new share bar in Geographic Stats, above the top-location lists, shows what part of your checklists you submitted at public eBird hotspots and what part at personal locations, with the counts behind both percentages. It agrees with the hotspot links beneath it, because both read the same answer from eBird, and it counts every checklist in your export whatever "Count all forms" says. It needs your eBird API key, because the export itself does not say which locations are hotspots. While a region is being looked up for the first time the block says how many checklists are not yet classified rather than guessing. SnowRaven now remembers each region's hotspot answer and asks eBird about it again only after 30 days, so later launches show the share and the hotspot links on every tab straight away, without a request; a newer backup asks only about a region it adds. Clearing the eBird backup removes the remembered answers too.

### Internal
- New `lib/hotspotRegionCache.ts`: the persisted per-region store (`hotspot-regions-v1`, a settings document), 30-day TTL, 512 regions and a 2^23 code-unit payload budget with oldest-fetched-first eviction (also applied at load, walking newest first), validation on every load, in-flight dedupe, and nothing written for an error or a 429. It is the one caching layer for `/map/hotspot-region`, which leaves `CACHED_GET_PATHS` and stays in `EBIRD_GATED_PATHS`. Registered in `lib/clearDerived.ts`; `settingsRouteBudget.test.ts` holds its worst-case document (7,520,689 bytes) under the route's 16 MiB.
- `lib/hotspotSet.ts` builds the Set in two phases (the stored answers, then the first ask of the regions with none) plus a TTL refresh, and publishes a per-region resolution snapshot (`getHotspotResolution`, `useHotspotResolution`) beside the Set. The build's settle still announces nothing, so the existing announce counts hold.
- New `lib/hotspotShare.ts` (the classification, the percentage pair and the view state), `lib/hotspotShareCopy.ts` (every string the block renders) and `components/HotspotShareBlock.tsx`, with `.sr-hs-*` rules in `globals.css`.
- The F-Droid changelog for this release is three identical files, one per processor-type build (`10000621.txt`, `10000622.txt`, `10000624.txt`), and the in-repo F-Droid recipe names 1.0.62.

## Proposed F-Droid changelog (the three files, identical; under 500 characters)

Statistics now shows what share of your checklists you submitted at public eBird hotspots and what share at personal locations, in Geographic Stats above your top locations. It needs your eBird API key. SnowRaven also remembers each region's hotspot answer for 30 days, so later launches show the share and the hotspot links straight away, without asking eBird again.

(367 characters.)

## Proposed App Store "What's New"

Statistics now shows what share of your checklists you submitted at public eBird hotspots and what share at personal locations, in Geographic Stats above your top locations. It needs your eBird API key. SnowRaven also remembers each region's hotspot answer for 30 days, so later launches show the share and the hotspot links straight away, without asking eBird again.

## README.md and website/index.html

No sentence is proposed for either. The register is one or two sentences per tab saying what the tab does, and the Statistics line already covers where you bird; a sub-statistic inside Geographic Stats does not earn a sentence there (the strategic brief and PRD NFR-08 say the same).
