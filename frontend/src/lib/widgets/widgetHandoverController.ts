// The widget hand-over controller (ios-lifer-widgets, schema.md section 1.4).
// Dynamic-imported by App.tsx after first paint on iPhone and iPad only
// (`widgetsSupported`), so nothing here is on the entry chunk and nothing here
// runs on the Mac, Windows, web or Pi.
//
// It regenerates the WHOLE document, debounced 300 ms, on:
//   1. boot, once `getFilesStatus()` has answered (FR-31);
//   2. every `filesChanged` epoch: a Settings upload or clear, an iCloud
//      arrival or synced clear (all four bump it, CLAUDE.md v1.0.14);
//   3. every `keysChanged` epoch: a key save, replace or clear, and both
//      iCloud key paths;
//   4. every Default Location save or clear (`mapDefaultsChanged`).
// Each regeneration reads its inputs fresh through the seams and holds no copy
// of any of them between writes; the parses are memoized by their own caches.
//
// NOT IN THE CLEAR REGISTRY, ON PURPOSE (schema.md section 1.6). The clear
// paths run the file delete, the cache drops and `purgeDerivedOnClear` BEFORE
// they notify the epoch, so by the time this runs the slot already reads
// absent and the document written carries `hasEbirdBackup: false` (S3) or
// `hasMlExport: false` (S4); a cleared key arrives the same way through the
// keys epoch (S2). The hand-over is regenerated on clear, and deleted only as
// the last resort of a revocation (below): a deleted document reads as "open
// SnowRaven once" on a device whose app is open and set up minus one file.
//
// A FAILED READ IS UNKNOWN, NEVER EMPTY (CLAUDE.md v1.0.25). If the file
// status, the key, or the Default Location cannot be read, or a stored eBird
// backup cannot be loaded, the whole document is not rebuilt: writing
// `hasEbirdBackup: false` over a backup that is plainly stored would tell the
// user to load a file they have, and writing an empty recorded set would turn
// every species into a lifer. The Macaulay export follows the in-app rule
// instead: an export that cannot be loaded is "no media", exactly as Map
// Explorer's own `hasML` reads it.
//
// BUT A REMOVAL IS NEVER LEFT BEHIND (security review M1). The rule above is
// right for the name sets and wrong for a key or a file the user removed: that
// read SUCCEEDED, and its answer must not be thrown away because an unrelated
// input failed. So when the whole document cannot be written (any input
// unreadable, the build refused, or the native write rejected) and the reads
// that did succeed show something the last document may still hold was
// removed or replaced, the controller REVOKES: it writes `buildRevocation`'s
// document (no key, no names; the widget shows S2 and makes no request), and
// if even that write fails it removes the document (the widget shows S1).
// "May still hold" is exact while this session has written a document and
// conservative before it has: at boot the document on disk may be from any
// earlier session, so an absent key, a key the class refuses (no valid
// document can carry it) or an absent eBird backup revokes. Each of those
// leaves the widget making no request whichever document it reads, so
// revoking costs nothing. An absent Macaulay export at boot does NOT revoke,
// because that would stop Nearby Lifers for every user who never loaded one.
// The stated residuals, both needing a removal whose own rewrite and
// revocation failed or were cut off (the app killed inside the 300 ms
// debounce) AND a failed rebuild at the next launch: a VALID key read at boot
// is taken to be the one on disk, and the target sets of a removed export
// stay until a rebuild succeeds.
//
// A revocation that could not be done is RETURNED, never discarded (CLAUDE.md,
// best-effort teardown): `lastOutcome()` names what failed, and the
// revocation stays pending, so the next regeneration of any trigger retries
// it even if nothing else changed. No user is waiting on this background
// path, so it is deliberately not surfaced in the UI.
//
// One regeneration at a time, with one queued follow-up, so a burst of
// signals produces at most one extra write. Nothing is ever logged.

import { storage, type FilesStatus } from '../storage'
import { loadEbirdObservations } from '../observationsCache'
import { loadMLExport } from '../mlExportCache'
import { subscribeFilesChanged } from '../filesChanged'
import { subscribeKeysChanged } from '../keysChanged'
import { subscribeMapDefaultsChanged } from '../mapDefaultsChanged'
import { buildHandover, buildRevocation, EBIRD_KEY_RE, serializeHandover, type WidgetHandoverV1 } from './widgetHandover'

export const HANDOVER_DEBOUNCE_MS = 300

export interface HandoverDeps {
  getFilesStatus(): Promise<FilesStatus>
  loadEbird(): Promise<{ observations: ReadonlyArray<{ commonName: string }> } | null>
  loadML(): Promise<{ rows: ReadonlyArray<{ commonName: string; format: string }> } | null>
  getEbirdKey(): Promise<string | null>
  getMapDefaults(): Promise<unknown>
  getAppVersion(): Promise<string>
  now(): number
  write(document: string): Promise<void>
  /** Remove the document; resolves when it is gone (an absent file is gone). */
  remove(): Promise<void>
  subscribe(trigger: () => void): () => void
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
}

/** What one regeneration did. `failed` names each step that could not be
 *  done, as a fixed token (never an error's own text). */
export type HandoverOutcome =
  | { kind: 'written' }
  | { kind: 'kept' }
  | { kind: 'revoked'; by: 'no-key-document' | 'removal'; failed: string[] }
  | { kind: 'revoke-failed'; failed: string[] }
  | { kind: 'error' }

export interface HandoverController {
  /** Schedule a regeneration (debounced). */
  trigger(): void
  /** Stop listening and cancel any scheduled regeneration. */
  stop(): void
  /** Test seam: resolves when no regeneration is running or queued. */
  idle(): Promise<void>
  /** The last regeneration's outcome, or null before the first. */
  lastOutcome(): HandoverOutcome | null
}

/** What the last document this session wrote holds, as far as revocation cares. */
interface Written { key: string | null; hasEbirdBackup: boolean; hasMlExport: boolean }

/** A native refusal as a fixed token: the Rust errors are short stable
 *  strings, and anything else is reduced to `error` so no text is carried. */
function token(step: string, e: unknown): string {
  const known = ['unavailable', 'no-app-group', 'invalid', 'too-large']
  return `${step}:${typeof e === 'string' && known.includes(e) ? e : 'error'}`
}

export function createHandoverController(deps: HandoverDeps): HandoverController {
  let timer: unknown = null
  let running: Promise<void> | null = null
  let queued = false
  let stopped = false
  /** The last document this session wrote; null before the first write. */
  let written: Written | null = null
  let pendingRevocation = false
  let outcome: HandoverOutcome | null = null

  function remember(doc: WidgetHandoverV1): void {
    written = { key: doc.ebirdKey, hasEbirdBackup: doc.hasEbirdBackup, hasMlExport: doc.hasMlExport }
  }

  /** The whole document, or null when an input cannot be read or the build is refused. */
  async function buildWhole(ebirdKey: string | null, status: FilesStatus | null, appVersion: string): Promise<WidgetHandoverV1 | null> {
    if (!status) return null
    let mapDefaults: unknown
    try { mapDefaults = await deps.getMapDefaults() } catch { return null }
    let observations: ReadonlyArray<{ commonName: string }> | null = null
    if (status.ebird) {
      const loaded = await deps.loadEbird().catch(() => null)
      if (!loaded) return null
      observations = loaded.observations
    }
    let mlRows: ReadonlyArray<{ commonName: string; format: string }> | null = null
    if (status.ml) {
      const ml = await deps.loadML().catch(() => null)
      mlRows = ml?.rows ?? null
    }
    return buildHandover({ nowMs: deps.now(), appVersion, ebirdKey, observations, mlRows, mapDefaults })
  }

  /** Whether the document on disk may still hold something the user removed
   *  or replaced, judged only from reads that succeeded (see the header). */
  function mayHoldRemoved(key: { ok: boolean; value: string | null }, status: FilesStatus | null): boolean {
    if (pendingRevocation) return true
    if (key.ok) {
      if (written ? key.value !== written.key : key.value === null || !EBIRD_KEY_RE.test(key.value)) return true
    }
    if (status) {
      if (!status.ebird && (written ? written.hasEbirdBackup : true)) return true
      if (!status.ml && written?.hasMlExport === true) return true
    }
    return false
  }

  async function revoke(appVersion: string): Promise<HandoverOutcome> {
    const failed: string[] = []
    const doc = buildRevocation(deps.now(), appVersion)
    if (doc) {
      try {
        await deps.write(serializeHandover(doc))
        remember(doc)
        pendingRevocation = false
        return { kind: 'revoked', by: 'no-key-document', failed }
      } catch (e) { failed.push(token('write', e)) }
    } else failed.push('write:unbuildable')
    try {
      await deps.remove()
      written = { key: null, hasEbirdBackup: false, hasMlExport: false }
      pendingRevocation = false
      return { kind: 'revoked', by: 'removal', failed }
    } catch (e) { failed.push(token('remove', e)) }
    pendingRevocation = true
    return { kind: 'revoke-failed', failed }
  }

  async function regenerate(): Promise<HandoverOutcome> {
    const key = await deps.getEbirdKey().then(
      value => ({ ok: true, value }),
      () => ({ ok: false, value: null }),
    )
    const status = await deps.getFilesStatus().catch(() => null)
    const appVersion = await deps.getAppVersion().catch(() => 'unknown')
    // A key that could not be read is unknown: the whole document is not
    // rebuilt without it (the previous one may be exactly right).
    // A build that THROWS (a defect, not a read failure) is treated like one
    // that refused, so the revocation decision below still runs.
    const doc = key.ok ? await buildWhole(key.value, status, appVersion).catch(() => null) : null
    if (doc) {
      try {
        await deps.write(serializeHandover(doc))
        remember(doc)
        pendingRevocation = false
        return { kind: 'written' }
      } catch { /* fall through: the whole document did not land */ }
    }
    if (!mayHoldRemoved(key, status)) return { kind: 'kept' }
    return revoke(appVersion)
  }

  function run(): void {
    if (stopped) return
    if (running) { queued = true; return }
    // The outcome is KEPT (a failed revocation also stays pending and is
    // retried by the next regeneration), never discarded; see the header.
    running = regenerate()
      .then(o => { outcome = o }, () => { outcome = { kind: 'error' } })
      .finally(() => {
        running = null
        if (queued && !stopped) { queued = false; run() }
      })
  }

  function trigger(): void {
    if (stopped) return
    if (timer !== null) deps.clearTimer(timer)
    timer = deps.setTimer(() => { timer = null; run() }, HANDOVER_DEBOUNCE_MS)
  }

  const unsubscribe = deps.subscribe(trigger)

  return {
    trigger,
    stop() {
      stopped = true
      unsubscribe()
      if (timer !== null) { deps.clearTimer(timer); timer = null }
    },
    async idle() {
      while (running || queued || timer !== null) {
        if (running) await running
        else await new Promise(r => setTimeout(r, 0))
      }
    },
    lastOutcome: () => outcome,
  }
}

let _controller: HandoverController | null = null

/** Boot the controller with the real seams (App.tsx, iOS only). Idempotent. */
export async function startWidgetHandover(): Promise<void> {
  if (_controller) return
  const native = await import('./widgetNative')
  if (_controller) return
  _controller = createHandoverController({
    getFilesStatus: () => storage.getFilesStatus(),
    loadEbird: () => loadEbirdObservations(),
    loadML: () => loadMLExport(),
    getEbirdKey: () => storage.getApiKey('ebird'),
    getMapDefaults: () => storage.getSetting<unknown>('map-defaults'),
    getAppVersion: () => native.appVersion(),
    now: () => Date.now(),
    write: document => native.writeHandover(document),
    remove: () => native.removeHandover(),
    subscribe: trigger => {
      const offs = [subscribeFilesChanged(trigger), subscribeKeysChanged(trigger), subscribeMapDefaultsChanged(trigger)]
      return () => { for (const off of offs) off() }
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  })
  // Boot regeneration (FR-31, trigger 1).
  _controller.trigger()
}
