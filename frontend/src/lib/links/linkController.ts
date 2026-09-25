// The widget link controller (ios-lifer-widgets, schema.md section 4.4).
// Dynamic-imported by App.tsx after first paint on iPhone and iPad only, so
// neither it nor the native wrapper it reaches is on the entry chunk.
//
// Delivery has two paths and they interleave, so the NATIVE PARKED SLOT is
// the single source of truth: the Rust hook parks the last `snowraven://` URL
// and pokes the `snowraven-link` event; this controller answers every poke,
// and its own start, by TAKING the parked URL (take returns it and clears it).
//   * The listener is armed FIRST, then the start-up take runs. A cold-start
//     tap was parked before any JS existed, so the take delivers it; a tap that
//     lands between the two steps pokes the armed listener. Whichever take runs
//     first gets the URL and the other gets null, so a URL is applied once.
//   * The event payload is deliberately ignored: applying the payload AND the
//     parked copy is how one tap would be applied twice.
// Every taken URL runs through `parseWidgetLink`, the fifteen-entry allowlist;
// anything else is dropped whole with nothing set, shown or logged.

import { parseWidgetLink } from './deepLink'
import { setPendingLink } from './linkRequest'

export interface LinkDeps {
  takePendingLink(): Promise<string | null>
  onLinkParked(cb: () => void): Promise<() => void>
}

/** Apply one raw URL: parse against the allowlist, publish only a match. */
export function acceptLink(raw: unknown): void {
  const link = parseWidgetLink(raw)
  if (link) setPendingLink(link)
}

export async function startLinkController(deps: LinkDeps): Promise<() => void> {
  const take = () => deps.takePendingLink().then(acceptLink, () => {})
  const unlisten = await deps.onLinkParked(() => { void take() })
  await take()
  return unlisten
}

let _started = false

/** Boot with the real native wrapper (App.tsx, iOS only). Idempotent. */
export async function bootLinkController(): Promise<void> {
  if (_started) return
  _started = true
  const native = await import('../widgets/widgetNative')
  await startLinkController({
    takePendingLink: () => native.takePendingLink(),
    onLinkParked: cb => native.onLinkParked(cb),
  })
}
