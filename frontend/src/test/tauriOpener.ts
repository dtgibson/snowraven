// A jsdom double of the Tauri apps' opener, for link-dispatch tests
// (sortable-list-links-own-dispatch). It installs two things:
//
//   1. The IPC seam (`window.__TAURI_INTERNALS__.invoke`), so `isTauri()` is true
//      and `openExternalUrl` reaches a spy rather than native code.
//   2. A REPLICA of the opener plugin's window-level click listener, the script
//      the plugin injects into every Tauri webview
//      (tauri-plugin-opener 2.5.4, src/init-iife.js). Its logic is copied
//      unchanged: skip a cancelled, non-primary, Command or Alt click; find the
//      nearest anchor on the event path; open it when it is a new-tab link (or
//      the click carried Control or Shift) with an http, https, mailto or tel
//      URL, read from the anchor's `href` at that moment, after cancelling the
//      click.
//
// The replica is what lets a test say "nothing opens twice": a link that sends
// its own URL must also cancel the click, or the replica sends a second one. It
// sends a URL OBJECT where the app's own dispatch sends a string, so `calls()`
// can say which path opened each page. Native code receives the same text from
// either: the IPC layer serializes a URL to its href.
//
// Test infrastructure only; nothing in the app imports it.
import { vi, type Mock } from 'vitest'

type Internals = { invoke: Mock }
type TauriWindow = Window & { __TAURI_INTERNALS__?: Internals }

export interface OpenerCall {
  /** The URL as native code receives it. */
  url: string
  /** `own`: the link's own handler sent it. `listener`: the plugin's listener did. */
  via: 'own' | 'listener'
}

export interface TauriOpener {
  invoke: Mock
  /** Every `plugin:opener|open_url` call so far, in order. */
  calls(): OpenerCall[]
  uninstall(): void
}

const OPENER_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:']

export function installTauriOpener(): TauriOpener {
  const w = window as TauriWindow
  const invoke = vi.fn().mockResolvedValue(undefined)
  w.__TAURI_INTERNALS__ = { invoke }

  const listener = (e: MouseEvent): void => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey) return
    const anchor = e.composedPath()
      .find((n): n is HTMLAnchorElement => n instanceof Node && n.nodeName.toUpperCase() === 'A')
    if (!anchor || !anchor.href || (anchor.target !== '_blank' && !e.ctrlKey && !e.shiftKey)) return
    const url = new URL(anchor.href)
    if (OPENER_PROTOCOLS.every(p => url.protocol !== p)) return
    e.preventDefault()
    void w.__TAURI_INTERNALS__?.invoke('plugin:opener|open_url', { url }, undefined)
  }
  window.addEventListener('click', listener)

  return {
    invoke,
    calls: () => invoke.mock.calls
      .filter(([cmd]) => cmd === 'plugin:opener|open_url')
      .map(([, args]) => {
        const url = (args as { url: unknown }).url
        return { url: String(url), via: typeof url === 'string' ? 'own' : 'listener' }
      }),
    uninstall: () => {
      window.removeEventListener('click', listener)
      delete w.__TAURI_INTERNALS__
    },
  }
}
