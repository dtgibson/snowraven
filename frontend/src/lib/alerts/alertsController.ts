// The iOS Alerts controller (ios-alerts, schema.md 6.1 and 6.4).
// Dynamic-imported by App.tsx after first paint, on iPhone and iPad only, so
// neither it nor the native wrapper rides the entry chunk.
//
// It installs the actions the Settings section calls, and keeps the store's
// snapshot current: the native poke (`snowraven-alerts`, sent after a
// foreground check), the page becoming visible again (a background check's
// outcome reaches the status line on the next open without a poke), and every
// command's own reply. The listener is armed FIRST and the start-up read runs
// after it, so a poke that lands between the two is not lost.
//
// THE ONLY LOCATION READS THIS FEATURE MAKES IN THE WEBVIEW are the two actions
// below that the user presses: choosing My location, and Use my location for
// the fixed place (FR-15, QA-07). Both go through the app's existing
// `getCurrentLocation()`, which is what prompts, with the existing When In Use
// purpose string. Nothing else here reads location, and nothing here ever calls
// a notification API: native asks for that permission on the switch.

import {
  getAlertsState, installAlertsActions, setAlertsState,
  type AlertsActions, type AlertsSettingsPatch, type AlertsSnapshot, type InboxRow,
} from './alertsState'
import { inboxRowLink } from './alertRules'
import { INBOX_VIEWED_SETTING, parseViewedAt } from './alertsInboxEntry'
import { buildWidgetLink } from '../links/deepLink'
import { storage } from '../storage'

export interface AlertsDeps {
  snapshot(): Promise<AlertsSnapshot>
  updateSettings(patch: AlertsSettingsPatch): Promise<AlertsSnapshot>
  setEnabled(on: boolean): Promise<AlertsSnapshot>
  clearInbox(): Promise<AlertsSnapshot>
  onAlertsChanged(cb: () => void): Promise<() => void>
  getCurrentLocation(): Promise<{ lat: number; lng: number }>
  /** The shipped link path: parse against the allowlist, then publish. */
  acceptLink(raw: string): void
  /** The inbox's "last viewed" (`alertsInboxViewedAt` in settings.json, the
   *  storage seam), read once, alongside the first snapshot and waited for at
   *  most VIEWED_READ_BOUND_MS (below). Optional for older test fakes. */
  readInboxViewedAt?(): Promise<unknown>
}

/** How long the first snapshot waits for "last viewed" before it is stored. */
const VIEWED_READ_BOUND_MS = 1000
const VIEWED_LATE = Symbol('viewed-late')

function message(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return 'unavailable'
}

export async function startAlertsController(deps: AlertsDeps): Promise<() => void> {
  let inFlight = 0
  let disposed = false

  const store = (snap: AlertsSnapshot) => {
    if (!disposed) setAlertsState({ loaded: true, snapshot: snap })
  }

  const refresh = () => deps.snapshot().then(store, () => {})

  /** One command: busy while any is in flight, the reply stored, a rejection
   *  kept as the short stable error. */
  async function command(run: () => Promise<AlertsSnapshot>): Promise<void> {
    inFlight += 1
    setAlertsState({ busy: true, error: null })
    try {
      store(await run())
    } catch (err) {
      if (!disposed) setAlertsState({ error: message(err) })
    } finally {
      inFlight -= 1
      if (!disposed) setAlertsState({ busy: inFlight > 0 })
    }
  }

  const actions: AlertsActions = {
    setEnabled: (on) => command(() => deps.setEnabled(on)),
    updateSettings: (patch) => command(() => deps.updateSettings(patch)),
    async chooseMyLocation() {
      let position: { lat: number; lng: number } | undefined
      try {
        const loc = await deps.getCurrentLocation()
        position = { lat: loc.lat, lng: loc.lng }
      } catch {
        // Denied, unavailable or timed out: the model is still set, and the
        // snapshot's permission and position drive the FR-16 sentence.
      }
      await command(() => deps.updateSettings(position ? { model: 'my-location', position } : { model: 'my-location' }))
    },
    async useMyLocationForFixedPlace() {
      // A location failure REJECTS, so the section can show the app's own
      // location message beside the button (the Default Location register).
      const loc = await deps.getCurrentLocation()
      await command(() => deps.updateSettings({ fixedPlace: { lat: loc.lat, lng: loc.lng, name: null } }))
    },
    clearInbox: () => command(() => deps.clearInbox()),
    openRow(row: InboxRow) {
      // A row tap and a notification tap travel ONE parser and ONE Map
      // Explorer effect: the row's link is built as a string and accepted
      // exactly as a parked native URL is.
      deps.acceptLink(buildWidgetLink(inboxRowLink(row)))
    },
  }

  installAlertsActions(actions)
  // "Last viewed" is read IN PARALLEL with the listener and the first snapshot,
  // never ahead of them. If it answers within VIEWED_READ_BOUND_MS (1 s) it is
  // applied before that snapshot is stored, so the entry points' first count
  // already uses it. If it does not, the snapshot is stored without waiting
  // any longer: until the read lands the value is absent, so every row counts
  // as new, and the late value is applied only if nothing has set one since (a
  // value set on a sheet close is newer than the file). A cold settings read on
  // the iPad simulator held the entry points back for 14 to 24 s when this was
  // awaited first, which is why it is bounded. Validated on read: a malformed
  // value, or one more than 24 hours ahead of this clock, reads as absent.
  const applyViewed = (raw: unknown) => {
    if (!disposed) setAlertsState({ inboxViewedAt: parseViewedAt(raw, Date.now()) })
  }
  const viewedRead = deps.readInboxViewedAt ? deps.readInboxViewedAt().catch(() => null) : null
  const unlisten = await deps.onAlertsChanged(() => { void refresh() })
  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') void refresh()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
  const first = deps.snapshot().then(s => s, () => null)
  if (viewedRead) {
    const bound = new Promise<typeof VIEWED_LATE>(r => setTimeout(() => r(VIEWED_LATE), VIEWED_READ_BOUND_MS))
    const raw = await Promise.race([viewedRead, bound])
    if (raw === VIEWED_LATE) {
      void viewedRead.then(v => { if (getAlertsState().inboxViewedAt === null) applyViewed(v) })
    } else {
      applyViewed(raw)
    }
  }
  const snap = await first
  if (snap) store(snap)

  return () => {
    disposed = true
    installAlertsActions(null)
    unlisten()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
  }
}

let _bootPromise: Promise<void> | null = null

/** Boot with the real native wrapper (App.tsx, iOS only). Idempotent. */
export function bootAlertsController(): Promise<void> {
  if (!_bootPromise) {
    _bootPromise = Promise.all([
      import('./alertsNative'),
      import('../location'),
      import('../links/linkController'),
    ]).then(([native, location, links]) =>
      startAlertsController({
        snapshot: () => native.snapshot(),
        updateSettings: (p) => native.updateSettings(p),
        setEnabled: (on) => native.setEnabled(on),
        clearInbox: () => native.clearInbox(),
        onAlertsChanged: (cb) => native.onAlertsChanged(cb),
        getCurrentLocation: () => location.getCurrentLocation(),
        acceptLink: (raw) => links.acceptLink(raw),
        readInboxViewedAt: () => storage.getSetting<unknown>(INBOX_VIEWED_SETTING),
      }).then(() => {}),
    )
  }
  return _bootPromise
}

