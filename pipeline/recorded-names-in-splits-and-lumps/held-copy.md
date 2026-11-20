# Held published copy: recorded-names-in-splits-and-lumps

Nothing below is written to a published surface. Each item waits for the user's explicit yes at the deploy sign-off (CLAUDE.md, published copy). American spelling, no em dash, a section title used inside a sentence is lowercased, What's New is one short sentence naming the change.

## 1. The shared Species Detail sentence (README.md, website, F-Droid)

One sentence changes on each of three surfaces, identically. The rest of each paragraph is untouched.

| Surface | Where |
|---|---|
| `README.md` | line 27, the `### Species Detail` paragraph |
| `website/index.html` | lines 240 to 243, the `<p>` under `<h3>Species Detail</h3>` (wrapped across lines; wrap the new text the same way) |
| `fastlane/metadata/android/en-US/full_description.txt` | line 13 |

**Before:**

> Your whole history with one bird: sightings, field notes, breeding codes, a map of every observation, and any splits or lumps along the way.

**After (proposed):**

> Your whole history with one bird: sightings, field notes, breeding codes, a map of every observation, and any splits, lumps, or renames along the way.

The following sentence ("A weather card shows ...") is unchanged.

**A guard pins this sentence.** `frontend/src/lib/taxonomyHistoryPublishedClaims.test.ts`, describe "README.md and website/index.html: the Species Detail paragraph", asserts `/a map of every observation, and any splits or lumps along the way\./` on the README and equality with the website. If the user approves, that assertion changes in the same commit to `/a map of every observation, and any splits, lumps, or renames along the way\./`. It does not read the F-Droid description. If the user declines, nothing changes and every surface stays true (it omits renames; it claims nothing false).

## 2. What's New (App Store) and the three F-Droid changelogs for 1.0.74

One sentence, identical in all four places:

> Species Detail's splits/lumps/renames section now counts your reports under each earlier name, and adds renamed species.

Files, written at the version-stamp step only after the yes (versionCode 1000074): `fastlane/metadata/android/en-US/changelogs/10000741.txt`, `10000742.txt`, `10000744.txt`.

## 3. Published images that draw the old label (recapture from the synthetic demo data)

Each frame below draws the control labeled "Splits and lumps" and, where noted, the section titled "Splits and Lumps" and its not-affected line. After a yes, each is recaptured from `website/tools/demo-data` and compared against the committed image. The demo dataset holds no renamed species and no traced lump count: its affected count stays 11 before and after (measured through the real derivation, 2026-11-19), so the frames change in the label, the section title and the not-affected line only.

| Image | What changes |
|---|---|
| `appstore/screenshots/ipad-13/05-species-detail.png` | control label, section title, not-affected line |
| `appstore/screenshots/iphone-6.9/05-species-detail.png` | control label |
| `appstore/screenshots/iphone-duo/05-species-detail.png` | control label |
| `website/assets/shots/species.webp` | control label |
| `fastlane/metadata/android/en-US/images/tenInchScreenshots/4.png` | control label (its count reads 6 from an earlier capture; a recapture reads the demo's present 11, a difference this feature does not cause) |

Captions and the website image's alt text do not mention the section and do not change. No new frame is proposed.

## 4. CHANGELOG.md entry for 1.0.74 (draft; written at the version bump, not before)

```markdown
## [1.0.74] - YYYY-MM-DD

### Changed
- **Species Detail's splits/lumps/renames section now counts your reports under each earlier name, and adds renamed species.** The section and its control are named "Splits/Lumps/Renames". An earlier name of a split or a rename shows how many of your reports eBird held under that name until the update, worked out from each report's date. A lump's earlier names are counted from the form eBird kept for each one; reports with no form sit in "Earlier name not recorded", and an earlier name eBird kept no form for says "Not traceable in your backup". Renames that change a word of a species' common name, from eBird's 2019 to 2026 updates, join the list as a third kind of change.

### Fixed
- On a phone, the Subspecies and forms and Splits/Lumps/Renames controls and the list rows no longer keep their hover color after a tap.

### Internal
- The splits-and-lumps record is version 2: a `renames` array beside `events`, and a kept `form` on lump earlier names. The generator derives renames under one cutoff (`renameKey`), checks each against Cornell's English-name-change annotation, and leaves out by name the three Cornell does not annotate until eBird's 2019 and 2022 pages are read (`RENAMES_AWAITING_SOURCE`); the escapee check's join and its recorded absences are unchanged.
- `docs/HELP.md` and `ACCESSIBILITY.md` follow the new name; `scripts/taxonomy-history-input/README.md` gains the rename steps; `.claude/rules/security.md` gates `SplitsLumps*.tsx`.
- The F-Droid changelog for this release is three identical files, one per processor-type build (`10000741.txt`, `10000742.txt`, `10000744.txt`), and the in-repo F-Droid recipe names 1.0.74.
```

## Not held, and why

- `PRIVACY_POLICY.md`: unchanged (no stored document, no request, nothing new kept).
- `appstore/LISTING.md`: does not mention splits or lumps.
- The F-Droid phone screenshot of Species Detail (`phoneScreenshots/4.png`) does not draw the control.
- `docs/HELP.md` and `ACCESSIBILITY.md` are not published copy under the approval rule and were written with the build.
