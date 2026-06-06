import { storage } from './storage'

// In-app Text Size: a multiplier on the root font-size (--sr-text-scale). Because
// the root is `calc(100% * var(--sr-text-scale))`, text honors BOTH the browser/OS
// default size (the 100%) and this multiplier — and all text is in rem, so it scales.
// Levels meet WCAG 2.1 SC 1.4.4 (text usable to 200%).

const LS_KEY = 'sr-text-scale'   // sync (web flash-free; mirrors the theme anti-flash)
const SETTING = 'textScale'      // durable storage seam (desktop survives relaunch)

export const TEXT_SCALES = [1, 1.25, 1.5, 2] as const
export type TextScale = (typeof TEXT_SCALES)[number]
const DEFAULT_SCALE: TextScale = 1

function coerce(v: number | null | undefined): TextScale {
  return (TEXT_SCALES as readonly number[]).includes(v ?? NaN) ? (v as TextScale) : DEFAULT_SCALE
}

/** Synchronous read for the initial value (web first paint). Desktop hydrates later. */
export function readStoredScale(): TextScale {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? coerce(parseFloat(raw)) : DEFAULT_SCALE
  } catch {
    return DEFAULT_SCALE
  }
}

/** Set the CSS variable that drives all rem-based text. */
export function applyScaleToDom(scale: TextScale): void {
  document.documentElement.style.setProperty('--sr-text-scale', String(scale))
}

/** Apply + persist to both localStorage (web/anti-flash) and the storage seam (desktop). */
export function persistTextScale(scale: TextScale): void {
  applyScaleToDom(scale)
  try { localStorage.setItem(LS_KEY, String(scale)) } catch { /* private browsing */ }
  void storage.setSetting<number>(SETTING, scale)
}

/** Read the durable value from the storage seam (desktop, where localStorage is wiped). */
export async function hydrateStoredScale(): Promise<TextScale | null> {
  try {
    const v = await storage.getSetting<number>(SETTING)
    return typeof v === 'number' ? coerce(v) : null
  } catch {
    return null
  }
}
