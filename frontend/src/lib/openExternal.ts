// Open an external URL in the user's default browser, working in BOTH the web
// build and every Tauri app.
//
// DO NOT use `window.open()` for this. In a Tauri WebView it can be silently
// dropped. Tauri calls the opener command directly with the immutable URL string;
// web/Pi synthesizes a real target=_blank anchor click.
//
// TWO ENTRY POINTS, ONE RULE (sortable-list-links-own-dispatch, extending v1.0.28):
// in the Tauri apps, the URL that reaches native code is the URL the link or row
// supplied when it rendered, never one rediscovered later from the live DOM.
//
//   * `openNewTabLink` is the click handler EVERY app-drawn new-tab link carries:
//     the shared OutboundLink (and through it HotspotLink), ChecklistLink, the
//     SpeciesLinks marks, CommentText's links, and the hand-written
//     target="_blank" anchors. Each passes the URL it already built for its own
//     `href`. In Tauri it sends that URL to the opener and cancels the click, so
//     the opener plugin's window-level listener (which skips a cancelled click)
//     never has to find the anchor and read its `href` back. Web and Pi keep
//     ordinary anchor behavior: the handler does nothing there.
//     `lib/newTabLinkDispatch.test.ts` fails any target="_blank" element in
//     shipped source that does not carry it with its own `href` expression.
//   * `openExternalUrl` is for an open that must happen from code (after an
//     `await`, from a Button rather than a link).
//
// `components/ui/Link.tsx` stays free of behavior (v1.0.24): the handler lives in
// the components that own each link, so a caller's own onClick runs first and the
// shared handler skips a click that caller already cancelled.
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

/** The click fields the opener plugin's gate reads, plus the cancel. */
type OpenerClick = Pick<MouseEvent, 'preventDefault' | 'defaultPrevented' | 'button' | 'metaKey' | 'altKey'>

/**
 * Give a visible href its row-owned Tauri dispatch. Web/Pi remains ordinary
 * anchor behavior. On Tauri, match the opener plugin's click gate: leave
 * prevented, non-primary, Command, and Alt clicks alone; dispatch ordinary,
 * Control, and Shift activations directly.
 */
export function openExternalLink(event: OpenerClick, url: string): void {
  if (!isTauri()) return
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey) return
  event.preventDefault()
  openExternalUrl(url)
}

/** The schemes this handler sends: every app-drawn new-tab link is http(s). */
const LINK_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:'])

/**
 * The click handler every app-drawn target="_blank" link carries. Pass the SAME
 * expression the anchor renders as its `href`, so the URL sent is the one from
 * the render the user clicked, whatever a caller or a re-render does later.
 *
 * The string sent is the anchor's RESOLVED href (`new URL(href, document.baseURI)`
 * is the algorithm the anchor's own `href` getter runs), which is what the opener
 * plugin's listener sent before this handler existed. That matters for a URL a
 * user wrote in a comment (a mixed-case host, a non-ASCII path) and for a query
 * value `encodeURIComponent` leaves alone but the URL parser escapes (`'`).
 *
 * A URL that does not parse, or is not http(s), is left entirely alone: no cancel
 * and no dispatch, so whatever happened to it before still happens. Everything
 * else is `openExternalLink`'s, unchanged (v1.0.28): the web and Pi no-op and the
 * gate on the click itself. It reads the NATIVE event, so a caller that cancelled
 * the click on either the native or the React event is seen.
 */
export function openNewTabLink(event: { nativeEvent: OpenerClick }, href: string): void {
  let url: URL
  try {
    url = new URL(href, document.baseURI)
  } catch {
    return
  }
  if (!LINK_SCHEMES.has(url.protocol)) return
  openExternalLink(event.nativeEvent, url.href)
}
