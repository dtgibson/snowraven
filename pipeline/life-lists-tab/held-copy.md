# Held copy: Life Lists (published surfaces)

**Status at the 1.0.63 release prep (2026-11-06).** Two texts are APPROVED and are written as part of the ship; everything else below is HELD for the user's express yes and is not in any published file. The user asked mid-prep to re-approve the README and website wording expressly, preferring the plainer What's New sentence for every surface, and to see the website feature row and every regenerated screenshot set before the ship (`deployment.md`, "User direction mid-prep"). The privacy policy needs no change (schema section 10): no third-party request, no new endpoint or host, no request moved between components, and no new stored document.

| Surface | State |
|---|---|
| F-Droid "What's new" (three per-processor files) | **APPROVED** verbatim at the copy gate; written in the release commit |
| App Store "What's New" (1.0.63 record) | **APPROVED** verbatim; written into App Store Connect in the ship follow-up |
| README `### Life Lists` section | **HELD**, proposal 2 below |
| Website feature row (sentence, figure, alt text) | **HELD**, proposal 3 below |
| `appstore/LISTING.md` bullet (and the App Store description) | **HELD**, proposal 4 below |
| Website screenshots (ten regenerated, one new) | **HELD**, section 5 |
| App Store screenshot sets | **HELD**, section 6 |

**Review pages (tailnet only):**

- Website, with the new row and every regenerated shot: https://hephaestus-developer.giraffe-chuckwalla.ts.net:18951/
- README, rendered as GitHub renders it, the new section highlighted: https://hephaestus-developer.giraffe-chuckwalla.ts.net:18952/
- App Store sets, the current set above the regenerated one for each device: https://hephaestus-developer.giraffe-chuckwalla.ts.net:18953/

**How the held copy lands on a yes:** `git apply pipeline/life-lists-tab/held/held-copy.patch` writes proposals 2 to 4 and the website images of section 5 exactly as reviewed, together with their guard, `frontend/src/lib/lifeListsSurfacesPublishedClaims.test.ts` (7 rows: each file's sentence held to `TAB_LABELS`, `DEFAULT_TAB_ORDER` and `MEDIA_FORMATS`, the three files against each other, the row alternation and the listing's recorded length; mutation-checked six ways in a scratch copy). The App Store frames of section 6 are copied from the scratch output named in `deployment.md`. A partial yes applies only the approved hunks.

## 1. Approved: the What's New sentence (App Store and F-Droid)

> A new Life Lists tab, after Checklists, lists every species you have recorded newest first by your first sighting, with its checklist and place, and turns into a photo, audio, or video life list, or any combination of them.

The three F-Droid files (`fastlane/metadata/android/en-US/changelogs/10000631.txt`, `10000632.txt`, `10000634.txt`) hold this sentence and a newline, 224 bytes each, ASCII, identical (SHA-256 `4d7fdd868b5c7d64e550518c058ef59b25a690c7858ea9f972760b0ff40dc3d2`). `lifeListsPublishedClaims.test.ts` holds them to the tab label, the tab before it and the media manifest.

## 2. Held: `README.md`, a new `### Life Lists` section directly after `### Checklists`

The What's New sentence without its "A new ... tab, after Checklists," lead, since the section heading names the tab.

Before:

```
### Checklists

Your checklists as whole outings: search every comment you have written, and filter by what an outing has.

### List Comparer
```

After:

```
### Checklists

Your checklists as whole outings: search every comment you have written, and filter by what an outing has.

### Life Lists

Lists every species you have recorded newest first by your first sighting, with its checklist and place, and turns into a photo, audio, or video life list, or any combination of them.

### List Comparer
```

## 3. Held: `website/index.html`, a Life Lists feature row directly after the Checklists row

- **Sentence:** the same as the README's.
- **Figure:** `assets/shots/life-lists.webp`, 1600 x 900 (the shared 16:9 box), the Life Lists tab from the demo data after the Statistics exotic check has finished, so it shows the settled-check line rather than the not-finished one.
- **Alt text:** "The Life Lists tab: species newest first by the date of first sighting, each with its date, time, checklist link, place, and photo, audio, and video marks, below the Include Escapees and Include Exotics switches and the Photo, Audio, and Video buttons."
- **Icon:** lucide `ListChecks`, the tab's own icon in the app (`lib/tabIcons.tsx`), drawn in the row's usual 1.75 stroke.
- **Layout:** the row is the ninth, so it is media right; List Comparer becomes the tenth row (`reverse`) and Named Birds the eleventh (media right), keeping the odd/even alternation the section's comment states. Nothing else on the page changes.

## 4. Held: `appstore/LISTING.md` (and the App Store description), the feature list

The same plain words, lowercased after the colon as the other bullets are.

Before:

```
• Checklists: your checklists as whole outings: search every comment you have written, and filter by what an outing has.
• List Comparer: two life lists side by side, or any two public checklists: what they share and what only one has.
```

After:

```
• Checklists: your checklists as whole outings: search every comment you have written, and filter by what an outing has.
• Life Lists: lists every species you have recorded newest first by your first sighting, with its checklist and place, and turns into a photo, audio, or video life list, or any combination of them.
• List Comparer: two life lists side by side, or any two public checklists: what they share and what only one has.
```

The recorded length moves from 3,234 to 3,432 of 4,000. One note for the yes: in this form the bullet reads "Life Lists: lists", the label followed by its own verb.

## 5. Held: the website screenshots

Every shot that draws the app's navigation was regenerated from the demo data at the documented 1600 px width, because the sidebar gains Life Lists after Checklists. Measured against the committed images, each differs in the sidebar strip (1.7 to 2.2 percent; Named Birds 7.6 percent, its highlighted row moving down one) and almost nowhere else (0.00 to 0.54 percent), except Species Detail (12.6 percent), whose controls row has changed since that shot was taken; it still shows Wood Thrush, as approved at 1.0.52.

| File | Change |
|---|---|
| `statistics.webp`, `statistics-dark.webp`, `map.webp`, `map-dark.webp`, `species.webp`, `calendar.webp`, `multimedia.webp`, `breeding.webp`, `named-birds.webp` | regenerated (nav) |
| `life-lists.webp` | new (proposal 3) |
| `statistics-mobile.webp` | **kept**: the phone bottom bar does not show Life Lists, and the regenerated image differed by 0.10 percent |
| `weather.webp` | **kept**: its frame is the weather output alone, with no navigation |

## 6. Held: the App Store screenshot sets

No Life Lists frame is added: the sets carry no Checklists frame to sit after, and a seventh frame would need a new caption, which is published copy. Each set keeps its six frames and captions, in the upload order 01 Map Explorer, 02 Statistics, 04 Calendar, 05 Species Detail, 03 Weather, 06 Breeding Codes.

| Device | Proposal | Measured |
|---|---|---|
| iPad 13-inch (`ipad-13`) | **Replace the whole set**, in order | the sidebar gains Life Lists in every frame (nav region 0.2 to 0.9 percent, the rest 0.00 to 0.12 percent); 05 is still Wood Thrush |
| iPhone Duo (`iphone-duo`) | **Replace the whole set**, in order | the icon rail gains Life Lists in every frame (nav region 0.81 percent, the rest 0.00 to 0.07 percent) |
| iPhone 6.9-inch (`iphone-6.9`) | **Keep the current set** | the bottom bar shows no Life Lists in any frame; the regenerated set differs only by capture variance (01: where the map drag landed). It is on the review page if you prefer it |

The Weather frames were served from the demo store's saved result (this Mac's `backend/.env` carries no eBird key), and the app's "Offline: showing the last loaded result" line was trimmed from them. The trimmed frames match the committed live frames exactly outside the navigation (0.00 percent), which is the evidence that the trim reproduces the live render.

## Superseded

The sentence approved at the earlier copy gate for the README, the website and the listing ("Every species you have recorded, newest first by your first sighting, and your photo, audio, and video life lists, alone or combined.") is withdrawn by the user's direction of 2026-11-06 in favor of the plainer form above.
