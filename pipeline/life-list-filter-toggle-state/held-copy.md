# Held copy: life-list-filter-toggle-state

Nothing below has been written into `CHANGELOG.md`, `fastlane/`, App Store Connect, `website/`, `README.md` or `PRIVACY_POLICY.md`. Each item waits for the user's explicit yes at the ship. The version is assumed to be **1.0.64** (the next patch after 1.0.63); if another ship lands first, the ship step moves the number, the file names and the date, and the text stays as approved.

## Proposed CHANGELOG.md entry

The CHANGELOG entry is not published copy, but it is written at the release commit with the rest of the version set, so it waits here.

## [1.0.64] - (release date)

### Fixed
- **Filter buttons show their new state as soon as you tap them.** On a phone or tablet, tapping Photo, Audio, or Video on Life Lists left the button gray, whether it had just turned on or off, until you tapped somewhere else; the Include Escapees and Include Exotics switches beside them kept a gray frame the same way. Each tap now shows the button's real state at once, in both themes. The fix is in the shared style these controls use, so the filter buttons, option toggles and switches drawn the same way on other tabs (Multimedia's paired "No photo" buttons and Is Target, Breeding Codes, the sort and view toggles) are fixed too. With a mouse, a selected button now keeps its selected look while the pointer is over it, and an unselected one still lights up under the pointer.

### Internal
- `globals.css`: the hover rules of the `.sr-pill`, `.sr-segbar-btn` and `.sr-toggle` registers sit inside `@media (hover: hover)`, and the pill and segment hover rules carry their inert gates inside `:where()`, so they are (0,2,0) and every selected-state rule (0,2,0 or above, declared after) beats them. The register comment that called the old pair "equal specificity" is corrected.
- `lib/controlRegisters.test.ts` guards both rules over the whole stylesheet, with mutation rows that put the old ungated or (0,4,0) rule back and go red; `components/ui/ToggleSwitch.test.tsx` reads the switch's hover rule inside the media block.
- The selector-specificity helper moved from `lib/mapFabCascade.test.ts` to `test/cssSpecificity.ts`, shared by both guards, and now scores a class as (0,1,0); it used to score one as a type selector. None of the map control guard's verdicts changed.
- The F-Droid changelog for this release is three identical files, one per processor-type build (`10000641.txt`, `10000642.txt`, `10000644.txt`), and the in-repo F-Droid recipe names 1.0.64.

## Proposed F-Droid changelog (the three files, identical)

Files: `fastlane/metadata/android/en-US/changelogs/10000641.txt`, `10000642.txt` and `10000644.txt` (versionCode 1000064, times ten, plus 1, 2 and 4). Each file holds exactly this one line followed by a single newline:

> On a phone or tablet, tapping Photo, Audio, or Video on Life Lists, or the switches beside them, now shows the new state at once instead of a gray look that stayed until your next tap. Filter buttons, option toggles, and switches drawn in the same style on other tabs are fixed too. With a mouse, a selected button now keeps its selected look while the pointer is over it.

- 372 characters, under the 500 that `fastlaneMetadata.test.ts` allows.
- 373 bytes per file: the 372 characters plus one line feed (0x0A). ASCII only (every byte below 0x80), no em dash, no curly quote, no carriage return, no trailing space.
- SHA-256 of each file's exact bytes: `6aaeb7c4103444ce488a4b5e0729ac33a0acb4e631a5a11f1e5bbdb445d5c77e`. The three files are byte-identical, so all three hash to this value.

## Proposed App Store "What's New"

The same text, so the two stores say the same thing:

> On a phone or tablet, tapping Photo, Audio, or Video on Life Lists, or the switches beside them, now shows the new state at once instead of a gray look that stayed until your next tap. Filter buttons, option toggles, and switches drawn in the same style on other tabs are fixed too. With a mouse, a selected button now keeps its selected look while the pointer is over it.

## What the second sentence claims, and what it does not

"Drawn in the same style" is the reach of the fix and no wider: the controls that use the shared filter pill (`.sr-pill`), segmented toggle (`.sr-segbar-btn`) and boxed switch (`.sr-toggle`) styles. Two controls with their own hover rule are outside it and were left alone by the brief: by their stylesheet rules (read, not measured in a browser here), the Map Explorer's hotspot kind chips keep a gray tint after a tap on a touch screen until the next tap, and the command palette's highlighted row takes the hover fill instead of its highlight fill under the mouse (`decisions.md`, D-5). Neither is named in the copy, and the copy does not say "every".

## README.md and website/index.html

No sentence is proposed for either. This is a fix with no new capability, and the register is one or two sentences per tab saying what the tab does.

## PRIVACY_POLICY.md

No change. The fix adds no request, store or host.
