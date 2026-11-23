# CHANGELOG entry for 1.0.76 (held with the release; not gated copy)

`CHANGELOG.md` is a historical record, not published copy, so this entry does
not wait for the user's yes; it is shown at the sign-off for review. The
`version` group of `apply-release-1.0.76.sh` inserts it from this file when it
runs, so a word or the date is changed here. Phase B re-dates it to the ship day, and the last Internal bullet
names the pictures actually retaken (final at Phase B: the iPad and iPhone Duo
Weather frames were retaken with the saved eBird key, D-65). The block between the fences is inserted verbatim above `## [1.0.75]`.

````changelog
## [1.0.76] - 2026-11-22

### Added
- **A Family Tree tab, between Breeding Codes and Hotspot Reports.** It arranges your life list by eBird's classification: every order and family you have recorded, each family with how many of the world's species in it you have seen, opening to its genera and species, under a headline of your species, families and orders against the world's. Order, family and genus come from the copy of eBird's taxonomy built into this version, never from your backup's text, and a name that taxonomy does not list is shown under Not placed with the reason rather than guessed into a family. Region, Year, Include Escapees and three-state Photo, Audio and Video buttons narrow it; Names shows common names, scientific names or both; Sort orders the families; and Find searches every species, genus, family and order you have recorded. Table and Tree switch to a tree you can zoom, drag and open branch by branch, with a panel for what is selected and, for a family, a link to its account on Birds of the World; the toolbar's fullscreen button opens the tree to fill the window. It opens on the tree in a wide window and on the table on a phone, where the tree in the page is a picture of its top that opens in fullscreen. SnowRaven remembers the region, the names and the view you choose; the rest is per-session, resetting on relaunch. Nothing is looked up online for the tab.

### Changed
- **On a phone, a map inside a page is a still that a swipe scrolls past, and it opens in fullscreen.** On any window 640 px wide or less, the maps on Species Detail, Statistics and Named Birds, the Weather tab's Plan location picker and the map in a Hotspot Reports report show a still with an "Open the map" button under it. Pressing either opens the map in fullscreen, where it pans and zooms, the tab bar is hidden, and Exit is a labeled button that returns you to the same place in the page. The Map Explorer's own map stays live and takes the still only where the window is too short to hold it whole; its least height on a phone is now 300 px on every platform.
- On a phone, the five dropdown lists in a page (Hotspot Reports' hotspot picker, Life Lists' region picker, Targets' county picker and its distance chooser, and the species picker) keep to the room visible above the tab bar or the on-screen keyboard, bringing the field up first when there is too little.
- The default tab order gains Family Tree between Breeding Codes and Hotspot Reports. A saved copy of the previous default order reads as the new one; any other saved order keeps its own order and gets the new tab last.
- On a phone, the More sheet's height cap rises from `min(73dvh, 616px)` to `min(78dvh, 660px)`, so on a 393 by 852 point screen at the default text size it lists every destination without scrolling (measured in WebKit and Chromium).
- The built-in eBird taxonomy is refreshed to eBird's live 2026 taxonomy: Great Nicobar White-eye (undescribed form) no longer reports as Indian White-eye, so it no longer counts as a species.

### Fixed
- On a phone, the tab bar no longer covers an expanded map's Exit and Share buttons; a tap on Exit had opened the More sheet instead.
- An expanded map has its Exit before the map has drawn, and when the map fails to load.
- On a phone, an expanded map's base map switcher stays clear of its zoom buttons, and in the iPhone and Android apps an expanded in-page map's credits sit above the home indicator.
- In the iPhone and Android apps a page is no longer taller than the window by the top inset, and on Android the tab bar's height is measured after its bottom inset arrives, so a long tab's footer no longer sits under the bar.
- Escape in the Map Explorer's fullscreen returns focus to its fullscreen button.
- On the Weather tab, the second tap of the double tap that opens the Plan location picker no longer drops a pin.

### Internal
- The family asset, `frontend/src/assets/ebird-families.json`, is written by the taxonomy snapshot run (`scripts/lib/ebirdFamiliesDerive.mjs`) and held to the snapshot by `familiesAsset.test.ts`. The tab lives under `components/familyTree/` with its `lib/familyTree*.ts` modules and loads lazily, and its tree is a lazy chunk of its own. For the mid-year refresh the snapshot's `VERSION` and the desktop `CACHE_KEY` move together to 2029, and the widget and Alerts parity fixtures gain the one name.
- `lib/useMapFullscreen.ts` grows by addition (`stillTier`, `still`, `open`, `registerOpener`, `hostClassName`) beside `components/ui/FsOpenRow.tsx`, `components/ui/MapExitStandIn.tsx` and `lib/mapStillCopy.ts`; while any panel is expanded the hook sets `data-sr-fs-open` on `<html>` and one rule hides the phone bar. The Family Tree is the hook's fifth host and draws its own toggle outside its lazy chunk; `mapFullscreenWiring.test.tsx` holds every host's shape.
- `<BirdName>` gains a `lead` prop for the Family Tree's scientific-names state, every other call held byte-identical by a markup golden. The shared load-failure alert gains an optional Reload action, drawn only when the Family Tree's bundled family data fails to load on web or Pi; without it the alert's markup is unchanged across its eight states.
- `docs/HELP.md` gains `## Family Tree` and describes the phone still and opener, and `ACCESSIBILITY.md` gives the phone keyboard route for maps; `familyTreePublishedClaims.test.ts` and `mapStillPublishedClaims.test.ts` hold them to the code. The Family Tree sentence is in `README.md`, on the website as a new feature row with its screenshot, and in the App Store listing, held by `familyTreeSurfacesPublishedClaims.test.ts`. The capture tools gain the Family Tree job, and the tab's browser harness joins `website/tools/verify/`.
- The demo dataset the screenshots and the App Review data come from now names nine birds as eBird's 2026 taxonomy does (Black-crowned Night Heron, Cooper's Hawk, Forster's Tern and Swainson's Thrush with straight apostrophes; American Herring Gull, Northern House Wren, Eastern Marsh Wren, Eastern Warbling Vireo and Northern Yellow Warbler), so every one of its species has a family on the Family Tree. `website/tools/gen-demo-data.mjs` and the reviewer copies under `website/demo/` change together; no other field of any row moved.
- The pictures are recaptured from the corrected demo data wherever the new menu entry or a corrected name shows: eleven website screenshots plus a new Family Tree shot, every frame of the iPad and iPhone Duo App Store sets and the iPhone set's Breeding Codes frame, and all six F-Droid tablet screenshots with the phone set's Breeding Codes and Multimedia. Every other frame was retaken and kept, identical or differing by capture variance alone; captions are unchanged.
- The F-Droid changelog for this release is three identical files, one per processor-type build (`10000761.txt`, `10000762.txt`, `10000764.txt`), and the in-repo F-Droid recipe names 1.0.76.
````
