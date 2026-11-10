# Held copy: Life Lists region filter (published surfaces)

**Status: APPROVED by the user on 2026-11-10 (`decisions.md` D-11) and applied at the ship (The Deployer, 1.0.70 part one):** section 1 on `README.md`, `website/index.html` and `appstore/LISTING.md` (description 3,471 / 4,000) with `lifeListsSurfacesPublishedClaims.test.ts` moved to it; section 2 as the three F-Droid changelogs `10000701.txt`, `10000702.txt` and `10000704.txt`, and as the App Store What's New (`held/whats-new-1.0.70.txt`, or after 1.0.69's line in `held/whats-new-1.0.70-rollup.txt` if 1.0.69 rolls up); section 3 as the recaptured `website/assets/shots/life-lists.webp` (copy at `held/life-lists-shot-preview.webp`) and its alt text. The text below is the proposal as it was approved.

The privacy policy needs no change: the feature makes no third-party request, adds no endpoint or host, moves no request between components, adds no stored document and no `clearDerived.ts` row (schema section 1 and 9). The one new stored value is a per-device preference key in the existing settings document, the `targetsCounty` precedent, which the policy does not enumerate.

## 1. Required: one sentence, the same on all three decision surfaces

The register is one or two sentences per tab and the three surfaces say the same thing in the same words (`.claude/rules/docs-and-website.md`). The proposal REPLACES the existing Life Lists sentence with one sentence that names the region, rather than appending a second one. It is 222 characters against the current 158 (plus 64), ASCII, no em dash.

**Before (all three surfaces today):**

> Lists every species you have recorded along with its first checklist and place, and turns into a photo, audio, or video life list, or any combination of them.

**After (proposed):**

> Lists every species you have recorded along with its first checklist and place, everywhere or in one country, state, or county you have birded, and turns into a photo, audio, or video life list, or any combination of them.

Where it goes, if approved:

| Surface | Place | Note |
|---|---|---|
| `README.md` | the `### Life Lists` section's one paragraph | replaces the sentence |
| `website/index.html` | the Life Lists feature row's `<p>` (row 9) | replaces the sentence, wrapped as the file wraps it |
| `appstore/LISTING.md` | the `• Life Lists:` bullet, lowercase "lists" after the colon as the bullet has it | the description moves from 3,407 to 3,471 of 4,000; the App Store description is PATCHed to match at the ship and read back |

`frontend/src/lib/lifeListsSurfacesPublishedClaims.test.ts` holds the current sentence on all three surfaces, so applying this proposal moves that suite's sentence in the same change (the held-patch rule: that file is the one the copy commit edits).

## 2. Required: the "What's New" and Fastlane changelog line

One line, 220 characters (under F-Droid's 500), ASCII, no em dash. For 1.0.70 if nothing ships first; the Deployer reads the number off `main`.

> Life Lists has a Region control: choose a country, state or province, or county from your eBird backup to see that region's life list, each species dated to your first sighting there, and SnowRaven remembers your choice.

At the ship this is the App Store What's New for the new record and the three identical F-Droid files `fastlane/metadata/android/en-US/changelogs/<10 * versionCode + 1, 2, 4>.txt` (for 1.0.70: `10000701.txt`, `10000702.txt`, `10000704.txt`), each the line plus a newline, present at the tag.

## 3. Offered, separately: the website Life Lists screenshot and its alt text

The committed `website/assets/shots/life-lists.webp` predates the Region control, so the strip it shows starts at Include Escapees. No App Store frame shows Life Lists (the 1.0.63 record added none), so no App Store set changes. If the user wants the website frame to show the control, the shot is regenerated from the demo data at the documented 1,600px width (Everywhere selected, so the list is unchanged) and its alt text becomes:

**Before:**

> The Life Lists tab: species newest first by the date of first sighting, each with its date, time, checklist link, place, and photo, audio, and video marks, below the Include Escapees and Include Exotics switches and the Photo, Audio, and Video buttons.

**After (offered):**

> The Life Lists tab: species newest first by the date of first sighting, each with its date, time, checklist link, place, and photo, audio, and video marks, below the Region control, the Include Escapees and Include Exotics switches, and the Photo, Audio, and Video buttons.

Approving section 1 does not require section 3; the existing frame stays accurate for what it shows.

## Draft for the Deployer (not published copy): the CHANGELOG entry

`CHANGELOG.md` is in the six-file version set, written at the ship; this is a draft the Deployer may use or replace.

```
### Added
- **A Region control on Life Lists.** Choose a country, state or province, or county from the places in your eBird backup to see that region's life list: each species you have recorded there, dated to your first sighting inside the region, with that sighting's time, checklist, and place. Countries are shown by their English names. With a media button pressed, a photo, audio recording, or video counts toward a region only when its checklist is in your eBird backup and lies inside the region; one with no checklist, or a checklist your backup does not hold, counts only under Everywhere. The region you choose is remembered; the switches and media buttons still reset on relaunch. Nothing new is looked up online.
```
