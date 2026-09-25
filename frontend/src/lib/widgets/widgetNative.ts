// Typed wrappers over the three iOS widget commands in src-tauri/src/widgets.rs
// (ios-lifer-widgets, schema.md section 1.7). NEVER on the entry graph: it
// imports @tauri-apps/api statically and is reached only through the two
// dynamic-imported controllers (entryChunk.test.ts asserts both halves).

import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getVersion } from '@tauri-apps/api/app'

/** Pinned to `LINK_EVENT` in widgets.rs by widgetPaths.parity.test.ts. */
export const LINK_EVENT = 'snowraven-link'

/** Write the whole hand-over document; native validates, writes and reloads
 *  the widget timelines. Rejects with a short stable string on refusal. */
export function writeHandover(document: string): Promise<void> {
  return invoke<void>('widgets_write_handover', { document })
}

/** Remove the hand-over (the revocation fallback when even a no-key document
 *  cannot be written); an absent file is done. Rejects with a short stable
 *  string when the file is still there. */
export function removeHandover(): Promise<void> {
  return invoke<void>('widgets_remove_handover')
}

/** Take (return and clear) the URL the native hook parked, or null. */
export async function takePendingLink(): Promise<string | null> {
  const raw = await invoke<string | null>('widgets_take_pending_link')
  return typeof raw === 'string' ? raw : null
}

/** Listen for the native hook's poke that a link was parked. */
export function onLinkParked(cb: () => void): Promise<UnlistenFn> {
  return listen(LINK_EVENT, () => cb())
}

/** The bundle's version, written into the hand-over for display only. */
export function appVersion(): Promise<string> {
  return getVersion()
}
