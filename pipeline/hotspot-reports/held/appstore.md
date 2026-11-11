# Held: the Hotspot Reports App Store listing bullet, What's New, and screenshot caption

**Status: HELD for the user's yes.** `appstore/LISTING.md`, the description, the What's New and the screenshot captions written into App Store Connect are published copy (CLAUDE.md, "Published copy needs the user's approval first").

## 1. The listing bullet (`appstore/LISTING.md`, the description's WHAT'S INSIDE list)

The bullet is the README and website sentence with its first letter lowercased, as every bullet in the list is (`readme-and-website.md`):

````proposal listing
your own record at any one place you have birded, an eBird hotspot or one of your personal locations: your life list there, a map, your checklists by protocol, and the weather on your visits from the weather blocks in your checklist comments.
````

It goes between the Breeding Codes and Checklists bullets, the tab's place in `DEFAULT_TAB_ORDER`.

**BEFORE** (`listing 1`), verbatim from the published file:

````before listing 1
• Breeding Codes: every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.
• Checklists: your checklists as whole outings: search every comment you have written, and filter by what an outing has.
````

**AFTER** (`listing 1`):

````after listing 1
• Breeding Codes: every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.
• Hotspot Reports: your own record at any one place you have birded, an eBird hotspot or one of your personal locations: your life list there, a map, your checklists by protocol, and the weather on your visits from the weather blocks in your checklist comments.
• Checklists: your checklists as whole outings: search every comment you have written, and filter by what an outing has.
````

The recorded description length moves from 3,471 to 3,733 of 4,000 (counted by script over the description block with the bullet applied):

**BEFORE** (`listing 2`), verbatim from the published file:

````before listing 2
## Description (3,471 / 4,000)
````

**AFTER** (`listing 2`):

````after listing 2
## Description (3,733 / 4,000)
````

After the yes the App Store description is PATCHed to match in the ship follow-up, and every listing field is read back against `appstore/LISTING.md` on the new version record (CLAUDE.md, Versioning).

## 2. What's New (the App Store record for this release)

The same text as the F-Droid changelog (`fastlane-changelog.md`), as at 1.0.63:

````proposal whats-new
A new Hotspot Reports tab, between Breeding Codes and Checklists, reports on any one place in your eBird backup, an eBird hotspot or one of your personal locations: your life list there, dated to your first record of each species at that place, a map, your checklists there by protocol and by month and year, and the weather from the weather blocks in your checklist comments.
````

376 characters, ASCII, one sentence, no count, the tab named from `TAB_LABELS` and placed by its two neighbours in `DEFAULT_TAB_ORDER`. If the release carries other user-visible changes by ship time, the Deployer proposes their sentences beside this one for the same yes.

## 3. The screenshot frame and its caption (FR-62)

FR-62 adds a Hotspot Reports frame to each App Store set, captured by the `07-hotspot-reports.png` job in `website-tools.patch`. A caption is published copy. Proposed, in the record's two-line form (the display line is the tab's name exactly as the app spells it):

````proposal caption
Hotspot Reports | Your own record at any one place
````

It parallels "Your whole history with one bird" (Species Detail) and states what the frame shows without a count. The frame is appended as the seventh in every set; the record's table and its "six frames" sentence change with it. Whether each set gains the frame, and whether each existing frame is replaced, is decided per image against the committed frame when the regenerated sets are shown (`.claude/rules/docs-and-website.md`, the v1.0.63 rule); if a set does not take the frame, this pair is dropped for that set and the sentence keeps its count.

**BEFORE** (`listing 3`), verbatim from the published file:

````before listing 3
Three sets, one per App Store Connect slot, each in this order. All three use
the same six frames and captions:

| # | Raw capture | Display line | Second line |
|---|---|---|---|
| 1 | `01-map-explorer.png` | Map Explorer | Your sightings and nearby hotspots on a map |
| 2 | `02-statistics.png` | Statistics | Life list totals, growth, and milestones |
| 3 | `04-calendar.png` | Calendar | Each day shaded by species, checklists, media, etc. |
| 4 | `05-species-detail.png` | Species Detail | Your whole history with one bird |
| 5 | `03-weather-tide.png` | Weather | A weather and tide summary for a checklist |
| 6 | `06-breeding-codes.png` | Breeding Codes | Breeding evidence by species and code |
````

**AFTER** (`listing 3`):

````after listing 3
Three sets, one per App Store Connect slot, each in this order. All three use
the same seven frames and captions:

| # | Raw capture | Display line | Second line |
|---|---|---|---|
| 1 | `01-map-explorer.png` | Map Explorer | Your sightings and nearby hotspots on a map |
| 2 | `02-statistics.png` | Statistics | Life list totals, growth, and milestones |
| 3 | `04-calendar.png` | Calendar | Each day shaded by species, checklists, media, etc. |
| 4 | `05-species-detail.png` | Species Detail | Your whole history with one bird |
| 5 | `03-weather-tide.png` | Weather | A weather and tide summary for a checklist |
| 6 | `06-breeding-codes.png` | Breeding Codes | Breeding evidence by species and code |
| 7 | `07-hotspot-reports.png` | Hotspot Reports | Your own record at any one place |
````

## How this was checked

`frontend/src/lib/hotspotReportsSurfacesPublishedClaims.test.ts` applies the three pairs in memory to the current `appstore/LISTING.md` and checks that the bullet sits between its neighbours, equals the README and website sentence with its first letter lowercased, that the recorded length equals the description block's length and stays within 4,000, and that the What's New and caption proposals carry the tab's label and no U+2014. While the copy is held it asserts that the listing carries no Hotspot Reports bullet yet.
