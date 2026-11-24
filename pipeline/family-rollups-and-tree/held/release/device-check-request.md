# The user's iPhone check for 1.0.77 (to send once TestFlight build 1.0.77 (1) reads VALID)

Agents never touch a physical device (CLAUDE.md, Device boundary), so these
are your steps, and the result is recorded exactly as you report it. They
cover only what 1.0.77 changes, plus the one routine launch check. A step you
skip is recorded as not checked; its item stays Partial and is not asked
again. 1.0.76 was never released and its TestFlight build is not part of this
check. About ten minutes.

## On the iPhone, with TestFlight build 1.0.77 (1)

**Routine, every build: the exact uploaded build launches.**

1. Install 1.0.77 (1) from TestFlight and open it. It opens to your last tab
   with your data: not a blank or white screen, and not a crash.

**The Family Tree tab (new in this release).**

2. Open **Family Tree** (in More). It opens on the table. Press
   **Expand all**, then swipe up and down starting on a species row. The
   whole page scrolls; nothing scrolls inside the table on its own.
3. Switch to **Tree**. The tree in the page is a still picture. Swipe up
   starting on the picture: the page scrolls and full screen does not open.
   Then tap the picture once: the tree opens in full screen.
4. In that full screen, pinch outward and inward with two fingers on the
   tree. The tree zooms; the page itself never zooms. **Find** sits beside
   **Exit**. Press **Exit**: you are back where you were on the page.
5. Larger text (the row layout for it is new in this build). In SnowRaven's
   **Settings, Appearance, Text Size**, choose **200%**. Go back to Family
   Tree, choose **Table**, press **Expand all**, and look over a screen or
   two: your species, families and orders count one per row at the top;
   each species name sits whole on its own line, with its marks and counts
   on a line below; nothing overlaps and nothing runs off the right edge.
   Switch to **Tree**, tap the picture, and check that **Find** is still
   beside **Exit** and the tree keeps most of the screen. Press Exit, then
   set Text Size back to what you use.

**Maps on phones (the map build's steps, `pipeline/map-scroll-on-phones/release-handoff.md`).**

6. On Species Detail, Statistics, Named Birds, Weather (Plan) and Hotspot
   Reports, swipe across the map in the page. The page scrolls and the map
   does not move.
7. Press **Open the map**. The map fills the screen, the tab bar is gone,
   and **Exit** sits whole at the bottom right, clear of the home indicator.
   Pan and pinch with your fingers. Press Exit: the page is where it was.
8. On Weather, open the map and tap once to place the pin. One pin appears
   where you tapped.
9. On Map Explorer, the page does not scroll under the map. Open its own
   fullscreen and tell us whether the map credits sit under the home
   indicator (a known item, D-30; just say what you see).
10. Open a dropdown list with the keyboard up (Hotspot Reports' hotspot
    picker, Life Lists' region picker, or Targets' county picker). The list
    stays above the keyboard with at least one whole row showing.
11. Scroll any long tab to its end. There is no extra strip of empty scroll
    past the content.

The map build's step 7 (on Android, the back gesture with a map open closes
the map) is not yours: there is no Android device, so the Deployer checks it
on the local Android emulator with the signed 1.0.77 APK.

**No widget steps this time, and why.** 1.0.77 changes no widget code and
not the vendored `tao`. Its one change to native iPhone code is inside the
iCloud Sync module, where a listing waits for files being fetched: in the
shipped app it makes the same call as before, and only the tests changed how
they measure it. The widget pass was last done at 1.0.75. The widget
extension's 143 Swift tests passed on a local simulator before this archive.

## On the Mac (optional)

12. After the in-app update to 1.0.77, open Family Tree, choose Tree, and
    pinch on the trackpad over the tree. The tree zooms and the page does
    not.
