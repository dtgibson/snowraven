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

## Proposed privacy policy sentences (held)

Security review finding L1 (`security-report.md`): the policy's list of what Clear removes, and its per-store retention statements, do not name the new 30-day hotspot store. No existing sentence becomes false; the policy under-describes what is kept. `PRIVACY_POLICY.md` and `website/privacy.html` are published copy, so nothing below has been written into either file. Both insertions go into both files identically, at the release commit, and only on the user's yes. If the user declines, record it as a follow-up with that reason.

`frontend/src/lib/hotspotSharePublishedClaims.test.ts` is the guard the docs rule asks for. It is skipped until either sentence lands in either file, and builds the "30 days" from `HOTSPOT_REGION_TTL_MS` once it runs; one always-on row holds the two files' Clear passages equal to each other meanwhile.

### Insertion 1: the Clear list

Where: `PRIVACY_POLICY.md`, the bullet beginning "You can delete your stored files and keys" under "Your Data Stays on Your Device" (line 16 at this commit), and `website/privacy.html`, the same bullet's `<li>` (line 124 at this commit). Insert, directly after "the county species lists behind the map's Completeness shading,":

> the lists of public hotspots for the regions you have birded,

Anchor sentence, identical in both files today:

> Clearing your eBird backup also removes what was worked out from it and saved on your device: the escapee and Projects answers for your checklists, the county species lists behind the map's Completeness shading, the day-by-day eBird reports behind the Targets tab's live counts (and, with iCloud Sync on, every device's copy of them in iCloud), the saved weather and tide readings for your checklists, and, on iPhone and iPad, the list of your species that the home-screen widgets compare against, and the Alerts inbox together with any alert waiting for the end of your quiet hours and the position the app read for Alerts.

After:

> Clearing your eBird backup also removes what was worked out from it and saved on your device: the escapee and Projects answers for your checklists, the county species lists behind the map's Completeness shading, the lists of public hotspots for the regions you have birded, the day-by-day eBird reports behind the Targets tab's live counts (and, with iCloud Sync on, every device's copy of them in iCloud), the saved weather and tide readings for your checklists, and, on iPhone and iPad, the list of your species that the home-screen widgets compare against, and the Alerts inbox together with any alert waiting for the end of your quiet hours and the position the app read for Alerts.

### Insertion 2: how long each region's answer is kept

Where: `PRIVACY_POLICY.md`, the sub-bullet beginning "The Statistics tab also asks eBird about a set of your own checklists" under eBird in "Connections to Bird and Weather Services" (line 33 at this commit), and `website/privacy.html`, the same sub-bullet's `<li>` (line 142 at this commit). Insert, as a new sentence directly after the anchor sentence:

> Each region's answer is stored on your device for 30 days, so a later launch asks again only about a region your export newly names or whose stored answer is older than that.

Anchor sentence, identical in both files today:

> The tab itself has always made requests, which is a different thing, and worth stating plainly on this page: it matches your species names against the bird taxonomy, and it asks eBird which locations in the regions you have birded are public hotspots.

After:

> The tab itself has always made requests, which is a different thing, and worth stating plainly on this page: it matches your species names against the bird taxonomy, and it asks eBird which locations in the regions you have birded are public hotspots. Each region's answer is stored on your device for 30 days, so a later launch asks again only about a region your export newly names or whose stored answer is older than that.
