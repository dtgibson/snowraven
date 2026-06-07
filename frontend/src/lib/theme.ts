import { storage } from './storage'

export type ThemePreference = 'light' | 'dark' | 'system'
export type AppliedTheme = 'light' | 'dark'

const LS_KEY = 'sr-theme'   // sync (web flash-free; read by the index.html anti-flash script)
const SETTING = 'theme'     // durable storage seam (desktop survives relaunch)

export function applyTheme(pref: ThemePreference): void {
  const effective: AppliedTheme =
    pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : pref
  document.documentElement.setAttribute('data-theme', effective)
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
