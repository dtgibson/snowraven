export type ThemePreference = 'light' | 'dark' | 'system'
export type AppliedTheme = 'light' | 'dark'

export function applyTheme(pref: ThemePreference): void {
  const effective: AppliedTheme =
    pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : pref
  document.documentElement.setAttribute('data-theme', effective)
}

export function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem('sr-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage disabled (private browsing, strict settings)
  }
  return 'system'
}
