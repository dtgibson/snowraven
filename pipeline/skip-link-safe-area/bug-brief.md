# Bug Brief — skip-link-safe-area

## What is broken

The "Skip to main content" link is `position: fixed` and so is viewport-relative, escaping the
`.sr-ios-app body { padding-top: env(safe-area-inset-top) }` that protects every in-flow surface.
On focus it comes to rest at `top: 16px` — the *physical* top — landing inside the Dynamic Island
band. It is the third and last untreated surface of the family `CLAUDE.md` documents, and the most
direct: an interactive control, not a title. `CLAUDE.md:155` names it; `ROADMAP.md:158` tracks it.

## Steps to reproduce

1. Build the Tauri **iOS** app (the `.sr-ios-app` class is added to `<html>` by `main.tsx` only under `isIOS()`).
2. Run on a Dynamic Island iPhone (14/15/16 Pro class), portrait, with a hardware keyboard or Full Keyboard Access.
3. From a cold load, press Tab once. The skip link is the first thing in the tab order.
4. It reveals at `top: 16px`. Its box spans roughly **y=16 to y=57**; the Island occupies roughly **y=11 to y=48**.
5. About 32 of its ~41px sit behind opaque Island hardware. Landscape: `left: 16px` puts it under the sensor housing.

## Expected behavior

The focused link clears the status bar, Island, and sensor housing in both orientations, offset from the
*safe area* rather than the physical edge — `top: calc(16px + env(safe-area-inset-top, 0px))`, giving 75px
on an Island phone (Island bottom ~48px, so ~27px clearance) and 40px on iPad. Desktop and web render
byte-identically. The unfocused off-screen park stays exactly where it is.

## Verified before scoping

- **No lift needed — the idea's central claim holds.** Both rules live in `globals.css` (`1819`, `1832`) at brace
  depth 0, in no media block (depth-walk verified). `App.tsx:697` carries `className="sr-skip-link"` and no inline
  style, so unlike the map panel and the Help overlay there is nothing at specificity 1,0,0 to lift first.
- **The escape is real.** `html`, `body`, `#root`, and App's root div carry no `transform`/`filter`/`perspective`/
  `will-change`/`contain`/`backdrop-filter`, so no ancestor forms a containing block and `fixed` truly resolves
  against the viewport.
- **No cascade competitor.** Only those two rules match `.sr-skip-link`; the other shipped stylesheet
  (`maplibre-gl.css`) is entirely `.maplibregl-*`-scoped; the generic `a:focus-visible` rules set outline and
  box-shadow only. Specificity is being *raised* here, not lowered, so the v0.5.81 lift-scan is not triggered.

## Repair

- **One gated rule, `:focus` only:** `.sr-ios-app .sr-skip-link:focus` carrying exactly two declarations —
  `top: calc(16px + env(safe-area-inset-top, 0px))` and `left: calc(16px + env(safe-area-inset-left, 0px))`.
- **Re-point, do not pad.** The two panel precedents pad because they are `inset: 0` full-viewport boxes. This is a
  point-anchored pill: padding would grow it by the inset and paint its green background across the Island. The
  right precedent is the third one, `.sr-ios-app .sr-bc-matrix--pinned thead th { top: env(...) }`.
- **The base rule must NOT be touched — load-bearing.** `top: -100px` parks the pill off-screen; at 200% text scale
  it is ~62px tall (bottom at -38px). Add a 59px inset there, by `calc()` or by padding, and the bottom edge lands at
  **+21px** — the hidden link becomes permanently visible in the Island band, trading an occlusion bug for a worse one.
- **`left` yes, `right` never.** `left` is at risk in landscape and the value self-corrects (housing on the far side →
  `inset-left` is 0 → collapses to the shipped 16px). The element declares no `right`; adding one to a `width: auto`
  fixed box stretches it across the viewport. That is the deliberate deviation from the panels, which need both edges
  only because `inset: 0` pins both. Bottom omitted, as in every precedent.
- Specificity (0,3,0) beats the base (0,2,0), so the gated rule wins outright — no source-order test needed here,
  unlike the equal-specificity pinned-header case. Place it adjacent for readability.

## Blast radius

- **Desktop and web are provably untouched** by the `.sr-ios-app` gate alone: desktop is `env()`=0 either way, and
  web/Pi never carries the class. The guard must assert the ungated `.sr-skip-link` and `.sr-skip-link:focus` bodies
  contain no `env(` — the teeth for the gate, since `index.html` ships `viewport-fit=cover` to browsers too.
- **This IS the third guard `CLAUDE.md` anticipates, and it changes the shape of the work.** The rule must hold at all
  viewport widths (iPad >640 needs it too), and the guard must distinguish `.sr-skip-link:focus` from
  `.sr-ios-app .sr-skip-link:focus` — exactly the substring trap `parseTopLevelRules` exists to defeat. Per the
  convention the Engineer must **reuse a helper, not write a fourth parser**. Recommended: add the guard to
  `frontend/src/lib/iosChrome.test.ts`, reusing its in-file `parseTopLevelRules` (satisfies the letter at zero risk,
  and keeps the `.sr-ios-app` chrome guards together). The fuller reading — extract one shared helper and migrate
  `mapIosFullscreen.test.ts` off `stripMediaBlocks`/`cssRule` — is the one open decision; it touches two shipped,
  passing guards for tidiness and is arguably out of a Fix lane's blast radius.
- **Records to update in the same change:** `CLAUDE.md:155` (drop the "Known untreated" note; this family is now
  complete at three) and `ROADMAP.md:158` (move off the horizon). `ACCESSIBILITY.md:11` needs **no** edit — it claims
  only tab-order position, makes no geometric claim, and stays true.
- No component, no TSX, no version-visible behavior change off iOS. `frontend/package.json` +
  `src-tauri/tauri.conf.json` patch bump and `CHANGELOG.md` per the standing rule.

## What done looks like

The gated rule exists as a top-level `.sr-ios-app .sr-skip-link:focus` with both `calc()` offsets and nothing else;
the two ungated rules still contain no `env(`; the guard reuses an existing helper rather than deriving a new one;
and `npm run build` (not just vitest/lint) is clean. On an iOS device or simulator the first Tab press reveals the
link fully clear of the Island in portrait and clear of the sensor housing in landscape, while a desktop and web
build render byte-identically.
