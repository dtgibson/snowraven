# Release hand-off: map-scroll-on-phones

For whichever session runs the one combined release with `family-rollups-and-tree`. This build landed on `main` unversioned by the user's direction (decisions.md D-40); nothing below has shipped.

**Status, 2026-11-24: taken.** Tagged as 1.0.76 with `family-rollups-and-tree`, whose ship stopped on a red run of record, and released as 1.0.77. The What's New sentence was approved (that run's D-63), the phone pictures retaken (D-64, D-65), the user's iPhone check passed with nothing reported against any step (D-93), and the Android back gesture was measured on the emulator (D-91). DECISIONS.md, v1.0.77.

## What the release owes for this build

- **Changelog entry (not yet written).** In plain terms: on phones and any window 640 px wide or less, a map inside a page is a still with an "Open the map" button and is used in fullscreen, where the tab bar is hidden and Exit is a labeled button; the tab bar no longer covers an expanded map's Exit and Share buttons (a shipped defect, measured at baseline); dropdown lists stay within the visible screen; in the iPhone and Android apps a page is no longer taller than the window by the top inset, and Android's tab bar height is measured after its inset arrives.
- **What's New and the three Fastlane changelogs (published copy, HELD).** Proposed sentence, seen by the user at the sign-off and NOT approved: "On phones, maps inside a page now open in fullscreen, so swiping the page never moves the map." It needs the user's explicit yes at the release, combined with the Family Tree's sentence.
- **Website and README.** No change proposed: no tab was added and no tab's one-sentence description changes.
- **Published pictures.** Any App Store or F-Droid phone picture that draws a map tab at phone width now shows the still and the opener row under the map; retake those before the tag (CLAUDE.md, v1.0.74). Tablet and desktop pictures are unaffected (nothing changes above 640 px).
- **`pipeline/design-system.md`.** Extended by this run's Chronicler for the still, the opener row, the labeled Exit and the bar rule.

## The user's device check at the release (the Partials)

No agent could measure these; they are the real reading for this build. On an iPhone, and on the Android emulator as far as it goes:

1. On Species Detail, Statistics, Named Birds, Weather and Hotspot Reports: swipe across the in-page map. The page scrolls and the map does not move.
2. Press "Open the map". The map fills the screen, the tab bar is gone, and Exit sits whole at the bottom right, clear of the home indicator. Pan and pinch with real fingers. Press Exit: the page is where it was.
3. On Weather, open the map and tap once to place the pin.
4. On Map Explorer: the page does not scroll under the map. Open its own fullscreen and note whether the map credits sit under the home indicator (known, D-30).
5. Open a dropdown list with the keyboard up (Hotspot Reports' hotspot picker, Life Lists' region picker, Targets' county picker): the list stays above the keyboard with at least one whole row.
6. Scroll any long tab to its end in the app: there is no extra strip of scroll past the content (D-33).
7. Android: the back gesture with a map open closes the map (not measured anywhere).

## Left alone, captured as follow-up ideas

Map Explorer fullscreen credits in the home-indicator strip (D-30); Map Explorer zoom over the base switcher at 200% text on 320 to 360 px phones, and its 28 px switcher buttons (D-35); the Targets distance chooser 11 px under the keyboard on the smallest phone at 200% text (D-32); the failed map's Retry button at 33.5 px, and a blank map area when WebGL is unavailable (D-39).
