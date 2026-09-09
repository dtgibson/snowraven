// Open an external URL in the user's default browser, programmatically, working
// in BOTH the web build and every Tauri app.
//
// DO NOT use `window.open()` for this. In a Tauri WebView it can be silently
// dropped. Tauri calls the opener command directly with the immutable URL string;
// web/Pi synthesizes a real target=_blank anchor click. Keeping the native command
// explicit is important for repeated lists: the URL arriving at native code is the
// URL the row supplied, not one rediscovered later by a global click interceptor
// from the live DOM.
//
// This is the programmatic sibling of the OutboundLink convention: use
// OutboundLink / ChecklistLink for a link the user clicks; use this seam when the
// open must happen from code.
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './platform'

export function openExternalUrl(url: string): void {
  if (isTauri()) {
    void invoke('plugin:opener|open_url', { url })
    return
  }

  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Give a visible href its row-owned Tauri dispatch. Web/Pi remains ordinary
 * anchor behavior. On Tauri, match the opener plugin's click gate: leave
 * prevented, non-primary, Command, and Alt clicks alone; dispatch ordinary,
 * Control, and Shift activations directly.
 */
export function openExternalLink(
  event: Pick<MouseEvent, 'preventDefault' | 'defaultPrevented' | 'button' | 'metaKey' | 'altKey'>,
  url: string,
): void {
  if (!isTauri()) return
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey) return
  event.preventDefault()
  openExternalUrl(url)
}
