## iOS 27.1 and iPhone Duo (ios27-iphone-duo)

### What this does
Gets the app ready for the iPhone Duo and the iOS 27.1 SDK. The phone bar, the
More sheet and the Alerts inbox sheet now pad both sides by the safe-area inset,
so nothing sits under a side camera or cutout; an iPhone-only copy of the 16px
focus-zoom floor applies above 640px, so tapping a filter on the Duo's inner
screen or on an iPhone in landscape no longer zooms the page; a new guard keeps
monitor lookups (which abort on the Duo's inner screen, tao issue 1373) off iOS;
and the release skill now says Xcode 27.1 is required and how the Duo simulator
check works.

### How to test
1. `cd frontend && npm run typecheck && npm run lint && npx vitest run && npm run build`.
2. The new and changed guards on their own:
   `npx vitest run src/lib/bottomSurfaceSideInsets.test.ts src/lib/filterControlSizeCss.test.ts src/lib/iosMonitorLookups.test.ts src/lib/androidInsetsCss.test.ts src/lib/safeAreaPerSide.test.ts`.
3. In a desktop browser at any width: nothing looks different. Every rule is
   gated on `.sr-ios-app` or `.sr-android-app`, which web and Pi never carry.
4. Xcode 27.1 (the Tester's step): build the iOS app for the simulator, install
   and launch it on the iPhone Duo simulator, and judge it by screenshots of the
   outer display (`pipeline/ios27-iphone-duo/how-to-see.md` has the commands).
   Run the widget extension's Swift tests under Xcode 27.1.
5. On a real iPhone Duo (the user's check): open the app folded and unfolded,
   rotate on the inner screen, fold and unfold while it runs; nothing under the
   camera, and tapping a filter field does not zoom.

### Notes for reviewer
- **The focus-zoom floor was measured before it was added.** On the Duo
  simulator's outer screen a 13px field zoomed the page to 1.231 (twice) and a
  16px field stayed at 1.000 (twice), each with the keyboard up. The inner screen
  and landscape could not be driven: this Xcode has no Simulator app, the
  simulator boots folded, and powering the outer display off does not unfold it.
  So the block rests on that measurement plus the idiom rule (WebKit zooms on the
  phone idiom at any width, never on iPad). Figures and screenshots:
  `pipeline/ios27-iphone-duo/decisions.md` E1 and `evidence/`.
- **One companion rule the spec did not list.** The floor raises the Map
  Explorer sidebar's two date fields to 16px in a sidebar of 240 to 268px on an
  iPhone, and side by side the year was cut off (WebKit and Chromium, measured).
  The block therefore carries the phone tier's sidebar stacking rule, verbatim
  and gated. The Checklists labels, which the spec asked to be measured, fit
  their 72px box and need nothing.
- **A measured cost that differs from the spec.** The spec expected "+0 rows on
  every filter block". The Calendar strip gains one row at 669 and 951 and two at
  874x402, and Checklists gains one in Chromium only at 669. Nothing clips or
  overflows (decisions.md E2, with renders). Worth a look in the live preview.
- **The built stylesheet differs from HEAD by exactly the intended rules**
  (eleven rule-level changes), with the Tailwind utilities layer and the MapLibre
  stylesheet identical.
- **No code changed in Rust.** `lib.rs` and `window_geometry.rs` gain comments
  naming the hazard and the guard, at the real `#[cfg(desktop)]` site (the
  `mod window_geometry;` line in lib.rs). The vendored tao is not patched.
- **Every new or changed guard was seen red first**, against HEAD's files and
  against 19 mutations in all, each restored and verified by hash (decisions.md
  E5). One weak row was found that way and fixed: the threshold row first read
  the test's own copy of the gate, not the stylesheet's.
- **Full suite:** 475 files, 10,331 passed, 7 skipped. The first full run had
  one failure, the wall-clock ratio row in `weatherStatsShared.test.ts` (3.54
  against 3), a file this change does not touch, while two Vite builds ran beside
  it at a load average near 47 from other sessions. It passed in isolation (24 of
  24) and the full suite passed at `--maxWorkers=2`.
- **Unchanged, as the brief requires:** the three scene-manifest plists,
  `LaunchScreen.storyboard`, the vendored tao, `tauri.conf.json`, the widget
  extension, `website/`, `README.md`, `appstore/`, `PRIVACY_POLICY.md`,
  `CHANGELOG.md` and the version set (the Deployer's at ship). `docs/HELP.md`
  needs no sentence: the app describes no device.
- **Known limitations:** the Duo's inner-screen insets and its focus-zoom scale
  are unmeasured (no Simulator app); Multimedia and Breeding Codes rendered no
  filter rows with the probe's fixture, so their row counts were not measured;
  the real-device Duo check is the user's and stays Partial until they have one.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
