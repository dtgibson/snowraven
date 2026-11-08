# Bug Brief — Life Lists filter toggle state

## What is broken
On a phone, each tap on a Life Lists Media pill (Photo, Audio, Video) leaves it dark grey with bright text (`--sr-surface-subtle` fill, `--sr-border-medium` edge, `--sr-text`), whether it just turned on or off. The real look (green on, plain off) appears only after a tap somewhere else.
Cause 1, in the shared `.sr-pill` register (`frontend/src/globals.css` ~4340): the hover rule `.sr-pill:not(:disabled):not([aria-disabled="true"]):hover` has specificity (0,4,0), so it beats `.sr-pill[aria-pressed="true"]` at (0,2,0) even though the pressed rule comes later. Cause 2: touch screens keep `:hover` on the tapped button until the next tap.
The register comment and `lib/controlRegisters.test.ts` both say the two rules have "equal specificity, so source order decides". That is false, so the guard passes on the defect.
Focus is not involved: `:focus-visible` stays false after a tap in both engines, and the global ring paints no fill.

## Steps to reproduce
1. Open the Life Lists tab with a readable ML export loaded. Without one the pills are inert and have no hover.
2. On a phone (or Playwright with `hasTouch` at 390px), tap Photo: it turns dark grey, not green. Tap it again: still dark grey, not off.
3. Tap empty space: only now does the pill show green (if it is on).
Measured in Chromium and WebKit with the shipped block and dark tokens: after each tap the fill is `rgb(39,39,42)`; after a tap elsewhere it is `rgb(5,46,22)`. With a mouse, a pressed pill also reads grey until the pointer leaves it.

## Expected behavior
On touch, only two looks: off (`--sr-surface` fill, `--sr-border`, `--sr-text-muted`) and on (`--sr-accent-bg`, `--sr-accent-border`, `--sr-accent`, weight 600). Each shows immediately after the tap, in both themes.
A selected pill keeps its selected look under a mouse pointer too, which is what the register says it does. Mouse users still get hover feedback on unselected pills.
Keyboard focus stays visible (WCAG 2.4.7). The global `:focus-visible` ring (3px accent outline plus halo) is not the in-between state and must not be removed or weakened.

## Blast radius
The fix goes in the shared registers, not in a Life Lists override. Affected: `.sr-pill` (8 components, including the Multimedia tab's filter pills and their red "No ..." and Is Target states, which lose to hover the same way) and `.sr-segbar-btn` (the same (0,4,0) against (0,2,0) defect, 10 components).
`.sr-toggle` (the Include Escapees and Include Exotics boxes, 8 components) also keeps a dark grey frame after a tap. Its track still shows on or off, so only its hover needs the touch gate.
Guards to update in the same change: `controlRegisters.test.ts` (exact hover selector, false equal-specificity premise) and `components/ui/ToggleSwitch.test.tsx` (looks up the `.sr-toggle` hover rule). Correct the false comment in `globals.css` too. There is no `(hover: hover)` rule yet; the only touch query is `@media (pointer: coarse)` for the map popup close button (~line 4134).
Decision touched: control-style-registers (v1.0.33) says the selected state beats hover. This fix makes that true and reverses nothing. Out of scope: other single-surface hover rules (`.sr-hotspot-mode-pill`, action buttons).

## What done looks like
Stylesheet guard: every `:hover` rule on `.sr-pill`, `.sr-segbar-btn` and `.sr-toggle` sits inside `@media (hover: hover)`, and every selected-state rule has specificity at least the hover rule's (reuse `specificity()` from `lib/mapFabCascade.test.ts`) and comes after it. Mutation-check both directions: removing the gate fails, and restoring the (0,4,0) hover selector fails.
Real-engine probe of the built app in Chromium and WebKit with `hasTouch` (both report `(hover: none)`): after every tap, a Life Lists pill's fill equals the off token or the on token, never `--sr-surface-subtle`. Mouse leg: a pressed pill under the pointer reads `--sr-accent-bg`. Keyboard leg: Tab still draws the global ring.
jsdom cannot evaluate `:hover` or media queries, so a jsdom test is not evidence for this. The look on the user's iPhone is a check the user performs (device boundary); if they defer it, it is marked Partial.
