// Which key chord the palette's entry controls DISPLAY (FR-45 to FR-48).
//
// PRESENTATION ONLY. The listener in lib/usePaletteHotkey.ts accepts Cmd-K AND
// Ctrl-K on every platform and never consults this file (FR-47); nothing here
// decides what works, only what is written on a button. Entry-safe: it imports
// lib/platform.ts, which App.tsx already carries, and nothing else.

import { isIOS, isMacOS, isTauri } from './platform'

export type ChordHint = 'none' | 'cmd' | 'ctrl'

/**
 * THE ONE `navigator.userAgent` READ IN THIS FEATURE, AND IT IS FOR THE HINT
 * ONLY (FR-48).
 *
 * It must never be used for capability branching, and it is not a platform
 * predicate in the sense `lib/platform.ts` uses that word -- that file's own
 * comments record that iPadOS WKWebView reports a desktop-Safari "Macintosh"
 * user agent, which is exactly why `isIOS()` is the compile-time `platform()`
 * probe and not a UA test. What makes the read safe HERE is that it is reached
 * only after the coarse-pointer and iOS gates below have already returned
 * `'none'`, so an iPad can never arrive at it, and that the worst outcome of
 * being wrong is a button reading "Ctrl K" where "⌘K" would have been friendlier.
 *
 * A module-level literal over a bounded string with no `/g` flag: it is not
 * built from the query and is outside NFR-07's scan, which is scoped to the
 * query path.
 */
const APPLE_PLATFORM_UA = /\b(?:Macintosh|Mac OS X|iPhone|iPad|iPod)\b/

/**
 * Is the primary pointer coarse (a touchscreen with no hardware keyboard)?
 *
 * Guarded twice on purpose. jsdom has no `matchMedia` at all, and a `matches`
 * read can throw on an engine that does not know the feature; this runs on the
 * navigation's render path, so a throw here would take the whole nav down rather
 * than merely skip a key hint. Same reasoning as `isFocusVisible`'s
 * `try { el.matches(...) }` in TabNav.tsx. Failing closed shows the chord, which
 * is the safe direction for a keyboard user and merely noise for a touch one --
 * and on the one platform where it matters most, iOS, `isIOS()` has already
 * answered.
 */
function coarsePrimaryPointer(): boolean {
  try {
    if (typeof matchMedia !== 'function') return false
    return matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

/**
 * Resolve the displayed chord, in FR-45's order:
 *
 *   (a) iOS/iPadOS, or a coarse primary pointer            -> none
 *   (b) macOS desktop (Tauri's sync `platform()` probe)    -> cmd
 *   (c) not under Tauri, and an Apple platform user agent  -> cmd
 *   (d) otherwise                                          -> ctrl
 *
 * Evaluated at RENDER, with no `matchMedia` listener: a pointer-capability
 * change mid-session is not worth a subscription. If that ever needs to be live
 * it is a listener, not a redesign.
 */
export function resolveChordHint(): ChordHint {
  if (isIOS() || coarsePrimaryPointer()) return 'none'
  if (isMacOS()) return 'cmd'
  if (!isTauri() && typeof navigator !== 'undefined' && APPLE_PLATFORM_UA.test(navigator.userAgent)) {
    return 'cmd'
  }
  return 'ctrl'
}

/**
 * The hint's visible text. `''` for `'none'`, so a caller that renders it
 * unconditionally still shows nothing rather than an empty box -- though every
 * shipped caller omits the element entirely (FR-46: the user is never shown a
 * chord they have no way to press).
 */
export function chordHintText(hint: ChordHint): string {
  return hint === 'cmd' ? '⌘K' : hint === 'ctrl' ? 'Ctrl K' : ''
}
