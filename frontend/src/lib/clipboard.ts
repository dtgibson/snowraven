// Clipboard seam — single path for writing text to the system clipboard.
//
// On desktop (Tauri) the web Clipboard API is unreliable: an auto-copy that
// runs *after* an await (e.g. on a successful weather lookup) has lost the
// user-activation WKWebView/WebView2 require, so navigator.clipboard.writeText
// throws NotAllowedError. The native Tauri clipboard plugin writes via the OS
// directly, with no user-gesture requirement. On web/Pi we use the Clipboard
// API with a legacy execCommand fallback (works over plain HTTP on a LAN).
//
// Mirrors the transport/storage seams — branch on isTauri() in one place,
// never in components.

import { isTauri } from './platform'

/** Write text to the clipboard. Returns true on success, false otherwise. */
export async function copyText(text: string): Promise<boolean> {
  if (isTauri()) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
      await writeText(text)
      return true
    } catch {
      return false
    }
  }

  // Web / Pi: async Clipboard API first (secure contexts), then legacy fallback.
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to legacy method
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
