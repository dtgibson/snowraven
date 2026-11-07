# Held copy: Life Lists (published surfaces)

**Status: every proposal below is APPROVED (2026-11-06).** The What's New sentence was approved at the copy gate. The user then asked mid-prep to re-approve the README and website wording expressly and to see the website feature row and every regenerated screenshot set (`deployment.md`, "User direction mid-prep"). On the three review pages the user approved everything with one wording change: the README, website and listing sentence became "Lists every species you have recorded along with its first checklist and place, and turns into a photo, audio, or video life list, or any combination of them." (relayed by the coordinator). The privacy policy needs no change (schema section 10): no third-party request, no new endpoint or host, no request moved between components, and no new stored document.

| Surface | State |
|---|---|
| F-Droid "What's new" (three per-processor files) | **APPROVED**; in the release commit `a54d21a8` |
| App Store "What's New" (1.0.63 record) | **APPROVED**; written into App Store Connect in the ship follow-up |
| README `### Life Lists` section | **APPROVED 2026-11-06**; in the copy commit |
| Website feature row (sentence, figure, alt text) | **APPROVED 2026-11-06**; in the copy commit |
| `appstore/LISTING.md` bullet | **APPROVED 2026-11-06**; in the copy commit; the App Store description is PATCHed to match in the ship follow-up |
| Website screenshots (nine regenerated, one new) | **APPROVED 2026-11-06**; in the copy commit |
| App Store screenshot sets (iPad and iPhone Duo replaced, iPhone kept) | **APPROVED 2026-11-06**; committed and uploaded in the ship follow-up |

The review pages (tailnet ports 18951, 18952 and 18953) were taken down after the approval. The proposal as reviewed is kept in `held/held-copy.patch`; the copy commit applied it with the approved sentence substituted in every place the proposal sentence appeared, and `frontend/src/lib/lifeListsSurfacesPublishedClaims.test.ts` holds the approved sentence.

## 1. Approved: the What's New sentence (App Store and F-Droid)

> A new Life Lists tab, after Checklists, lists every species you have recorded newest first by your first sighting, with its checklist and place, and turns into a photo, audio, or video life list, or any combination of them.

The three F-Droid files (`fastlane/metadata/android/en-US/changelogs/10000631.txt`, `10000632.txt`, `10000634.txt`) hold this sentence and a newline, 224 bytes each, ASCII, identical (SHA-256 `4d7fdd868b5c7d64e550518c058ef59b25a690c7858ea9f972760b0ff40dc3d2`). `lifeListsPublishedClaims.test.ts` holds them to the tab label, the tab before it and the media manifest.

## 2. Approved 2026-11-06: `README.md`, a new `### Life Lists` section directly after `### Checklists`

```
### Checklists

Your checklists as whole outings: search every comment you have written, and filter by what an outing has.

### Life Lists

Lists every species you have recorded along with its first checklist and place, and turns into a photo, audio, or video life list, or any combination of them.

### List Comparer
```

## 3. Approved 2026-11-06: `website/index.html`, a Life Lists feature row directly after the Checklists row

- **Sentence:** "Lists every species you have recorded along with its first checklist and place, and turns into a photo, audio, or video life list, or any combination of them."
- **Figure:** `assets/shots/life-lists.webp`, 1600 x 900 (the shared 16:9 box), the Life Lists tab from the demo data after the Statistics exotic check has finished.
- **Alt text:** "The Life Lists tab: species newest first by the date of first sighting, each with its date, time, checklist link, place, and photo, audio, and video marks, below the Include Escapees and Include Exotics switches and the Photo, Audio, and Video buttons." It describes the figure, not the sentence, and was approved as shown.
- **Icon:** lucide `ListChecks`, the tab's own icon in the app (`lib/tabIcons.tsx`).
- **Layout:** the ninth row, media right; List Comparer becomes the tenth (`reverse`) and Named Birds the eleventh (media right).

## 4. Approved 2026-11-06: `appstore/LISTING.md` (and the App Store description), the feature list

```
• Checklists: your checklists as whole outings: search every comment you have written, and filter by what an outing has.
• Life Lists: lists every species you have recorded along with its first checklist and place, and turns into a photo, audio, or video life list, or any combination of them.
• List Comparer: two life lists side by side, or any two public checklists: what they share and what only one has.
```

The recorded description length moves from 3,234 to 3,407 of 4,000.

## 5. Approved 2026-11-06: the website screenshots

Regenerated from the demo data at the documented 1600 px width, because the sidebar gains Life Lists after Checklists; each differs from the committed image in the sidebar strip and almost nowhere else, except Species Detail, whose controls row has changed since that shot was taken (still Wood Thrush, as approved at 1.0.52).

| File | Change |
|---|---|
| `statistics.webp`, `statistics-dark.webp`, `map.webp`, `map-dark.webp`, `species.webp`, `calendar.webp`, `multimedia.webp`, `breeding.webp`, `named-birds.webp` | regenerated (nav) |
| `life-lists.webp` | new (section 3) |
| `statistics-mobile.webp` | kept: the phone bottom bar does not show Life Lists |
| `weather.webp` | kept: its frame is the weather output alone, with no navigation |

## 6. Approved 2026-11-06: the App Store screenshot sets

No Life Lists frame is added (no set has a Checklists frame to follow, and a new caption is published copy). Each set keeps its six frames and captions in the upload order 01 Map Explorer, 02 Statistics, 04 Calendar, 05 Species Detail, 03 Weather, 06 Breeding Codes.

| Device | Approved |
|---|---|
| iPad 13-inch (`ipad-13`) | **replace the whole set**, in order: the sidebar gains Life Lists in every frame; 05 is still Wood Thrush |
| iPhone Duo (`iphone-duo`) | **replace the whole set**, in order: the icon rail gains Life Lists in every frame |
| iPhone 6.9-inch (`iphone-6.9`) | **keep the current set**: its bottom bar shows no Life Lists |

The frames to upload, with their SHA-256 prefixes and scratch location, are in `deployment.md`. The Weather frames were served from the demo store's saved result with the app's "Offline: showing the last loaded result" line trimmed; outside the navigation they match the committed live frames exactly.

## Superseded

- The first approved README, website and listing sentence ("Every species you have recorded, newest first by your first sighting, and your photo, audio, and video life lists, alone or combined.") was withdrawn by the user's direction of 2026-11-06.
- The reviewed proposal ("Lists every species you have recorded newest first by your first sighting, with its checklist and place, and turns into a photo, audio, or video life list, or any combination of them.") was replaced at the approval by the sentence in sections 2 to 4.
