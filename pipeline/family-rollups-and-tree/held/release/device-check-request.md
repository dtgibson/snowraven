# The user's device check for 1.0.76 (to send after TestFlight build 1.0.76 (1) reads VALID)

Agents never touch a physical device (CLAUDE.md, Device boundary), so these
are the user's steps, and the result is recorded exactly as the user reports
it. Each step says whether it covers **this release's changes** or is the
**routine** per-build check, and why it is there. A step the user skips is
recorded as not checked; its criterion stays Partial and is not asked again.

## On the iPhone, with TestFlight build 1.0.76 (1)

**A. Routine, every build (standing since v1.0.31): the exact uploaded build launches.**
1. Install 1.0.76 (1) from TestFlight and open it. It opens to your last tab
   with your data, not a blank or white screen and not a crash. (A green
   suite, CI and a simulator cannot see a release-only launch crash; this is
   the only check that can.)

**B. This release: the Family Tree tab (the three gestures no agent can make, QA-59, QA-96, QA-97).**
2. Open **Family Tree** (in More). It opens on the table. Press **Expand all**,
   then swipe up and down starting on a species row. The whole page scrolls;
   nothing scrolls inside the table on its own.
3. Switch to **Tree**. Swipe up starting on the tree picture. The page
   scrolls and full screen does **not** open. Then tap the picture once: the
   tree opens in full screen.
4. In that full screen, pinch outward and inward with two fingers on the
   tree. The tree zooms; the page itself never zooms. Press **Exit**: you are
   back where you were on the page.

**C. This release: maps on phones (the seven steps from map-scroll-on-phones, `release-handoff.md`).**
5. On Species Detail, Statistics, Named Birds, Weather (Plan) and Hotspot
   Reports, swipe across the map in the page. The page scrolls and the map
   does not move.
6. Press **Open the map**. The map fills the screen, the tab bar is gone, and
   **Exit** sits whole at the bottom right, clear of the home indicator. Pan
   and pinch with your fingers. Press Exit: the page is where it was.
7. On Weather, open the map and tap once to place the pin. One pin appears
   where you tapped.
8. On Map Explorer: the page does not scroll under the map. Open its own
   fullscreen and note whether the map credits sit under the home indicator
   (a known item, D-30; just tell us what you see).
9. Open a dropdown list with the keyboard up (Hotspot Reports' hotspot
   picker, Life Lists' region picker, Targets' county picker): the list stays
   above the keyboard with at least one whole row showing.
10. Scroll any long tab to its end: there is no extra strip of empty scroll
    past the content. (This checks the app-wide inset fix, D-33 and D-34,
    which was only measured on a model of the app.)

**D. Routine, optional this time: the widgets.**
11. Only if you want to: open a Nearby Lifers or Media Targets widget and tap
    it through to Map Explorer. **Why it is listed as routine, not as this
    release's change:** 1.0.76 changes no widget code, no vendored `tao` and no
    native iOS code; the only thing that reaches the widgets is one more
    non-countable name in the data the app hands them (the taxonomy refresh),
    which the widget extension's Swift tests cover against regenerated
    fixtures. The widget pass owed since 1.0.71 was discharged at 1.0.75. If
    you skip it, it is recorded as not checked, and the next build that
    touches widgets, `tao` or native iOS code owes the full widget pass.

## On the Mac (optional, QA-59's other half)

12. In the Mac app (after the in-app update to 1.0.76), open Family Tree,
    choose Tree, and pinch on the trackpad over the tree. The tree zooms and
    the page does not.

## Android

No Android device, by standing decision, so the Android leg is Partial on
emulator evidence. The map build's step 7 (the back gesture with a map open
closes the map) is checked by the Deployer on the API 36 emulator with the
signed 1.0.76 APK in Phase B and recorded there; it is not asked of the user.
