## Life Lists filter toggle state (life-list-filter-toggle-state)

### What this does
On a phone, tapping a Life Lists Media pill (Photo, Audio, Video) left it dark gray whether it had just turned on or off, and its real look appeared only after a tap somewhere else; with a mouse, a selected pill turned gray while the pointer was over it. The fix is in the shared control styles, not a Life Lists override: the hover rules of the filter pill (`.sr-pill`), the segmented toggle (`.sr-segbar-btn`) and the boxed switch (`.sr-toggle`) now apply only where the primary pointer can hover (`@media (hover: hover)`), and the pill and segment hover rules carry their inert gates inside `:where()`, so every selected state beats them. The false "equal specificity" comment in `globals.css` and the guard that repeated it are corrected.

### How to test
1. With a media export saved, open Life Lists. Click Photo with the mouse: it turns green and stays green while the pointer is still on it. Move the pointer away and back: still green.
2. Click Photo again: it turns off, shows the light gray hover look under the pointer, and the plain off look once the pointer leaves.
3. Hover Include Escapees: its frame darkens under the pointer and returns when the pointer leaves.
4. Press Tab from Include Exotics: focus lands on Photo with the accent focus ring. Press Space: it toggles and the ring stays.
5. Repeat 1 and 2 in the dark theme.
6. On a phone or tablet (the iPhone TestFlight build at the ship, or a simulator): tap Photo, Audio and Video on and off. Each tap shows green or plain at once, never dark gray. Tap Include Escapees: the frame stays plain.
7. Spot-check the same on another surface that uses these styles, such as Multimedia's "No photo" and Is Target pills or a sort toggle: a selected one keeps its look under the mouse.

### Notes for reviewer
- **The cascade, stated correctly.** Each bare `:not()` adds its argument's specificity, so `.sr-pill:not(:disabled):not([aria-disabled="true"]):hover` was (0,4,0) and beat every selected-state rule at (0,2,0) and (0,3,0) whatever their order. With the gates inside `:where()` the hover is (0,2,0): the (0,2,0) selected rules tie it and win on source order, and the tier rules win on specificity. `decisions.md` D-1 says why this beats raising nine selected selectors (one reason: a raised pressed rule would beat the disabled rule).
- **Blast radius, both directions** (D-2). The hover now loses only to the selected-state rules; the one other rule it newly loses to (`.sr-segbar[aria-disabled="true"] .sr-segbar-btn`) is unreachable, because that group's buttons carry `aria-disabled` themselves. It wins nowhere new. A rule-level diff of the built `index-*.css` against a HEAD build differs by exactly the three hover rules; nothing inside any `@layer` moved and the maplibre sheet is byte-identical.
- **Real-engine evidence** (`evidence/`). `probe-filter-pill-state.mjs` drives the built app's real Life Lists tab through a stub backend (an eBird export and a media export, no key stored), plus a small fixture in the same page for the segment group and the negative, target and tier pills. Chromium and WebKit, light and dark; touch at 390px (both engines report `(hover: none)`) and mouse at 1280px (`(hover: hover)`).
  - Fixed build: **169 of 169** checks pass. WebKit dark, Photo tapped on: fill `rgb(5, 46, 22)` (`--sr-accent-bg`); tapped off: `rgb(24, 24, 27)` (`--sr-surface`), with `:hover` still matching in WebKit, so the gate is what holds the look. A pressed pill under the mouse reads `--sr-accent-bg` in both engines. Tab draws a 3px solid outline in all 16 keyboard readings.
  - Pre-fix build, same probe (`--expect-broken`): **97 of 169**. WebKit fails every tap: dark fill `rgb(39, 39, 42)`, the brief's number, light fill `rgb(244, 244, 245)`; Include Escapees keeps a `rgb(63, 63, 70)` frame. All 32 mouse-selected readings fail in both engines. Mouse hover on unselected controls and every keyboard reading pass there too, so the probe sees the defect and only it.
  - Request census, taken before any loop: one cold load to Life Lists asks the stub for no eBird-backed path and nothing reaches another host; after all legs, still 0 and 0. The stub never forwards anything.
  - Worth knowing: on the pre-fix build Chromium did not keep `:hover` on a real Life Lists pill after a tap (the tap re-renders the list) but did on the static fixture pills. A Chromium-only touch check of the real tab would have called the defect absent; iOS runs WebKit.
- **Guards.** `lib/controlRegisters.test.ts` gains a stylesheet-wide guard: every `:hover` rule on the three registers sits inside `@media (hover: hover)`, and every selected-state rule has at least the hover rule's specificity and comes after it. Its mutation rows transform the real stylesheet text: the gate removed from each register, the (0,4,0) selector restored, and a selected rule moved above the hover all go red; an equivalent reordered spelling stays green; a hover rule inside a comment is not read and the same text outside one is. Run against HEAD's `globals.css` it lists exactly the three ungated rules and the nine selected rules the old hover outranked. `ToggleSwitch.test.tsx` reads the switch's hover rule inside the media block.
- **The shared specificity helper** (D-4). The brief named `specificity()` in `mapFabCascade.test.ts`; it scored a class as a type selector (`.sr-pill` as (0,0,1)). It moved, mechanically unchanged apart from one line, to `frontend/src/test/cssSpecificity.ts`, and both guards import it. The map control guard stays 8 of 8 with the correction, built-bundle half included; the new instrument row goes red if the old bug returns.
- **Gates run.** `npm run typecheck` and `npm run build` pass; eslint on the changed files is clean; the full suite is 490 files passed (5 skipped), 10,665 tests passed (7 skipped), no failures, run with the load average near 20. `weft-design-lint`: no warnings; the notes on the touched files are present at HEAD too.
- **Out of scope, recorded** (D-5): the command palette's highlighted row and the Map Explorer's hotspot kind chips have their own hover rules with the same kinds of problem; neither was touched.
- **Residual** (D-3): `(hover: hover)` reads the primary pointer, so a touch-first device with a trackpad attached gets no hover feedback on these controls, and a mouse-first laptop with a touch screen still shows the hover look after a tap that turns a pill off (a tap that turns one on is fixed).
- **Published copy is held** in `held-copy.md`: the CHANGELOG entry, the F-Droid changelog (three identical files) and the App Store "What's New". No README, website or privacy policy sentence. No version bump; `docs/HELP.md` describes no hover look, so it is unchanged.
- **The iPhone look is the user's check** (device boundary). Until it is done it is Partial.

## Seeing the filter fix locally

1. Open a terminal in the project folder (the folder that holds `frontend/`, `backend/` and `src-tauri/`).

2. Start the desktop app in development mode:
   `npm run desktop:dev`
   The first start compiles the app and can take a few minutes. A SnowRaven window opens when it is ready.

3. If you have not saved a media export in this app before, open Settings and save your Macaulay Library export there; without one the Media buttons on Life Lists stay switched off and grayed.

4. Open the Life Lists tab.

5. Click Photo. It should turn green and stay green while the mouse is still over it. Move the mouse away: still green. Click it again: it turns off, looks light gray only while the mouse is over it, and plain once the mouse moves away.

6. Hover Include Escapees: its border darkens under the mouse and goes back when you move away.

7. Press Tab until Photo has the green focus ring, then press Space: Photo toggles and the ring stays.

8. Switch to the dark theme in Settings and repeat step 5.

The touch half of the fix (no gray after a tap) cannot be seen with a mouse. It is checked on the iPhone TestFlight build at the ship: tap Photo, Audio and Video on and off on Life Lists, and each tap should show green or plain at once. If you would like to see it before then, the iOS Simulator shows it too (`npm run tauri -- ios dev`, then choose an iPhone simulator; this command was not run in this session).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
