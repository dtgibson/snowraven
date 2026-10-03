import { storage } from './storage'
import { isAndroid } from './platform'

export type ThemePreference = 'light' | 'dark' | 'system'
export type AppliedTheme = 'light' | 'dark'

const LS_KEY = 'sr-theme'   // sync (web flash-free; read by the index.html anti-flash script)
const SETTING = 'theme'     // durable storage seam (desktop survives relaunch)
const SCHEME_QUERY = '(prefers-color-scheme: dark)'

declare global {
  interface Window {
    // The Android app's page-to-native channel (android-release decisions.md,
    // "Status and navigation bar glyph color follows the PAINTED in-app
    // theme"): MainActivity.kt registers it with WebViewCompat
    // .addWebMessageListener, allowlisted to the app's own origin
    // (http://tauri.localhost), and it accepts exactly 'light' or 'dark'.
    // Absent on every other platform and below the Android WebView floor.
    srAndroid?: { postMessage(message: string): void }
  }
}

// The last preference applyTheme() painted, so the system-theme listener knows
// whether a live OS flip should repaint (only under 'system'). Null until the
// first applyTheme(); the index.html anti-flash script paints before that from
// the same stored preference readStoredPreference() returns.
let lastPreference: ThemePreference | null = null

export function applyTheme(pref: ThemePreference): void {
  lastPreference = pref
  const effective: AppliedTheme =
    pref === 'system'
      ? window.matchMedia(SCHEME_QUERY).matches ? 'dark' : 'light'
      : pref
  document.documentElement.setAttribute('data-theme', effective)
  reportPaintedTheme(effective)
}

/**
 * Tell the Android app which theme the page has PAINTED, so native code sets
 * the status and navigation bar glyphs to contrast with it (dark glyphs over
 * the light theme, light over dark). Called at the end of applyTheme(), and
 * once by main.tsx at first paint, so the three triggers (first paint, every
 * Appearance change, a live system flip under System) all pass through here.
 * A no-op unless this is the Android app AND the channel exists, so no other
 * platform changes and a WebView without the listener simply keeps the
 * resource default. Never throws: the bar color is cosmetic.
 */
export function reportPaintedTheme(effective: AppliedTheme): void {
  if (!isAndroid()) return
  try {
    window.srAndroid?.postMessage(effective)
  } catch {
    // the channel refused the message; the bars keep their current glyphs
  }
}

/**
 * Follow a live OS light/dark flip while the preference is System. The app had
 * no such listener on any platform before android-release, so System only
 * caught up at the next applyTheme(); this corrects it everywhere (the Designer
 * allowed it platform-wide, design-spec section 2), and on Android it is what
 * keeps the bar glyphs right after a flip. Returns the unsubscribe. Guarded for
 * environments with no matchMedia (jsdom) and for the old addListener API.
 */
export function subscribeSystemThemeChanges(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mql = window.matchMedia(SCHEME_QUERY)
  if (!mql) return () => {}
  const onChange = () => {
    if ((lastPreference ?? readStoredPreference()) === 'system') applyTheme('system')
  }
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }
  // Older WebKit exposes only the deprecated pair.
  const legacy = mql as MediaQueryList & {
    addListener?: (cb: () => void) => void
    removeListener?: (cb: () => void) => void
  }
  legacy.addListener?.(onChange)
  return () => legacy.removeListener?.(onChange)
}

export function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage disabled (private browsing, strict settings)
  }
  return 'system'
}

/** Persist an explicit light/dark choice to BOTH localStorage (web anti-flash) and
 * the storage seam (desktop, where localStorage is wiped on every relaunch). */
export function persistThemePreference(pref: 'light' | 'dark'): void {
  try { localStorage.setItem(LS_KEY, pref) } catch { /* private browsing */ }
  void storage.setSetting<string>(SETTING, pref)
}

/** Clear the explicit choice (back to System), in both stores. */
export function clearThemePreference(): void {
  try { localStorage.removeItem(LS_KEY) } catch { /* private browsing */ }
  void storage.setSetting<string>(SETTING, 'system')
}

/** Read the durable preference from the storage seam (desktop). Returns null if
 * nothing was ever saved, so the caller can keep the anti-flash default. */
export async function hydrateStoredTheme(): Promise<ThemePreference | null> {
  try {
    const v = await storage.getSetting<string>(SETTING)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // storage seam unavailable
  }
  return null
}
