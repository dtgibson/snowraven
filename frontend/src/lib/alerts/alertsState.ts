// The iOS Alerts state store (ios-alerts, schema.md section 6.1). ENTRY-SAFE:
// it imports only react's useSyncExternalStore and the platform probe, holds
// nothing async and no native import, so App.tsx and Settings.tsx may import
// it statically. The controller (alertsController.ts, dynamic-imported after
// first paint and only on iPhone and iPad) fills the store and installs the
// real actions; before it loads, `loaded` is false and every action is a
// no-op. entryChunk.test.ts asserts this file IS on the entry graph and the
// controller, the native wrapper, the purge, the rules twin, the copy and the
// section are NOT.
//
// THE WEBVIEW IS A CLIENT. The check, the schedule, the notifications and the
// three alert documents are native Swift behind one actor in the app process
// (schema.md sections 1 and 2). This store holds the last snapshot native
// returned and nothing else; it never writes an alert document and never
// decides whether a check runs.
//
// The constants below are declared once here and pinned to the Rust
// (`src-tauri/src/alerts.rs`) and Swift (`AlertsLogic/AlertsFiles.swift`,
// `AlertsLogic/AlertRules.swift`, `Alerts/AlertsScheduler.swift`) declarations
// by alertsPaths.parity.test.ts, which compares the declarations to each other
// rather than restating a literal (testing.md).

import { useSyncExternalStore } from 'react'
import { isIOS, isTauri } from '../platform'

/** The App Group subdirectory the alert documents live in (a sibling of `widgets/`). */
export const ALERTS_DIR = 'alerts'
export const ALERTS_SETTINGS_FILE = 'settings.json'
export const ALERTS_STATE_FILE = 'state.json'
export const ALERTS_INBOX_FILE = 'inbox.json'

/** FR-24: a species that alerted does not alert again for this many days. */
export const ALERT_DEDUPE_DAYS = 7
/** FR-38: an inbox row is removed this many days after its alerted time. */
export const ALERT_RETENTION_DAYS = 30
/** FR-38: the inbox holds at most this many rows. */
export const ALERT_INBOX_MAX_ROWS = 200
/** FR-17 / OQ-04: a recorded position older than this counts as unavailable. */
export const ALERT_POSITION_MAX_AGE_HOURS = 24
/** A time in an alert document more than this far ahead of now is implausible
 *  (the device's own clock wrote it): an inbox row carrying one is dropped,
 *  and native reads a state field carrying one as absent. The same 24 hours
 *  as the iCloud records' `isWritableTime` window. */
export const ALERT_FUTURE_SKEW_HOURS = 24
/** FR-11: the radius is a whole number of miles in this range. */
export const ALERT_RADIUS_MIN = 1
export const ALERT_RADIUS_MAX = 25
export const ALERT_RADIUS_DEFAULT = 25
/** FR-07: quiet hours default to 10:00 PM to 7:00 AM, as minutes of the local day. */
export const ALERT_QUIET_DEFAULT = { startMin: 1320, endMin: 420 } as const
/** FR-06: "about hourly" and "about daily" are requests for no sooner than these. */
export const ALERT_HOURLY_SECONDS = 3600
export const ALERT_DAILY_SECONDS = 86400
/** The BGAppRefreshTask identifier, declared in the three iOS plist sources. */
export const BG_TASK_ID = 'com.dtgibson.snowraven.alerts.refresh'
/** The native poke the webview answers by re-reading its snapshot. */
export const ALERTS_EVENT = 'snowraven-alerts'
/** The notification identifiers native posts (a prefix scopes the delegate). */
export const ALERT_NOTIFICATION_PREFIX = 'alerts.'
export const ALERT_DEFERRED_ID = 'alerts.deferred'

export type AlertCadence = 'hourly' | 'daily'
export type AlertModel = 'fixed' | 'my-location'

export interface QuietHours { on: boolean; startMin: number; endMin: number }

/** A hand-set fixed place. `name` is the place-name search's string when the
 *  place was chosen that way, else null (coordinates or Use my location). */
export interface FixedPlace { lat: number; lng: number; name: string | null }

export interface AlertsSettings {
  version: 1
  enabled: boolean
  cadence: AlertCadence
  quietHours: QuietHours
  model: AlertModel
  /** null = follow the saved Default Location (FR-09). */
  fixedPlace: FixedPlace | null
  radiusMi: number
  updatedAt: string
}

/** The six last-check outcomes (design-spec section 4). `unreachable` is a
 *  request that never got an answer (offline, timeout); `no-answer` is an
 *  answer that came back unusable (a server error, an oversized or malformed
 *  body, or a stale hand-over without the countability lists). */
export type AlertOutcome = 'nothing-new' | 'hits' | 'unreachable' | 'no-answer' | 'busy' | 'key-rejected'
export const ALERT_OUTCOMES: readonly AlertOutcome[] = ['nothing-new', 'hits', 'unreachable', 'no-answer', 'busy', 'key-rejected']

export type CheckFrom = 'fixed' | 'my-location' | 'fixed-fallback'

export interface LastCheck {
  completedAt: string
  outcome: AlertOutcome
  hits: number
  from: CheckFrom
  checkId: string
}

export type PlacePhrase = { kind: 'name'; name: string } | { kind: 'near-you' } | { kind: 'nearby' }

export interface PendingHit { speciesCode: string; comName: string; locId: string; distanceMi: number; link: string }

export interface PendingSummary {
  windowEndAt: string
  place: PlacePhrase
  hits: PendingHit[]
  checkIds: string[]
}

export type BackgroundRefresh = 'available' | 'denied' | 'restricted'

export interface AlertsStateDoc {
  version: 1
  lastCheck: LastCheck | null
  holdUntil: string | null
  position: { lat: number; lng: number; at: string; source: 'seed' | 'foreground' } | null
  pending: PendingSummary | null
  scheduledEarliest: string | null
  backgroundRefresh: BackgroundRefresh
}

export interface InboxRow {
  id: string
  checkId: string
  speciesCode: string
  comName: string
  locId: string
  locName: string
  lat: number
  lng: number
  obsDt: string
  distanceMi: number
  point: { lat: number; lng: number }
  radiusMi: number
  place: PlacePhrase
  alertedAt: string
  updatedAt: string
}

/** The first missing precondition, in FR-18's order. */
export type AlertBlocked = 'no-key' | 'no-backup' | 'no-place' | 'location-off' | 'no-position'
export const ALERT_BLOCKED: readonly AlertBlocked[] = ['no-key', 'no-backup', 'no-place', 'location-off', 'no-position']

export type NotificationPermission = 'not-determined' | 'granted' | 'denied'
export type LocationPermission = 'not-determined' | 'granted' | 'denied' | 'restricted'

/** What native returns for every call (schema.md 10.1, plus the Default
 *  Location the check would follow, so the section can show it). */
export interface AlertsSnapshot {
  settings: AlertsSettings
  state: AlertsStateDoc
  inbox: InboxRow[]
  blocked: AlertBlocked | null
  permissions: { notifications: NotificationPermission; location: LocationPermission }
  defaultLocation: { lat: number; lng: number } | null
  now: string
}

/** A settings edit. `position` is the webview's location seed (schema.md 6.4). */
export interface AlertsSettingsPatch {
  cadence?: AlertCadence
  quietHours?: QuietHours
  model?: AlertModel
  fixedPlace?: FixedPlace | null
  radiusMi?: number
  position?: { lat: number; lng: number }
}

export interface AlertsState {
  /** a snapshot has been read at least once */
  loaded: boolean
  snapshot: AlertsSnapshot | null
  /** a command is in flight */
  busy: boolean
  /** the last command's short stable error string, or null */
  error: string | null
  /** "Last viewed" for the inbox count (`alertsInboxViewedAt`, settings.json,
   *  validated on read): the controller reads it alongside the first snapshot
   *  (applied before it when the read answers within 1 s), and the inbox host
   *  moves it forward when the sheet CLOSES, or at once on Mark read, so the
   *  marks and the badge update on close or on that press (design-spec 7.5;
   *  alerts-inbox-mark-read). null: every row counts as new. */
  inboxViewedAt: string | null
}

/**
 * The feature's platform gate: iPhone and iPad only (FR-01). On macOS,
 * Windows, web and the Pi this is false by construction, the section is never
 * rendered and the controller is never fetched.
 */
export function alertsSupported(): boolean {
  return isTauri() && isIOS()
}

const INITIAL: AlertsState = { loaded: false, snapshot: null, busy: false, error: null, inboxViewedAt: null }

let state: AlertsState = INITIAL
const subscribers = new Set<() => void>()

export function getAlertsState(): AlertsState {
  return state
}

export function subscribeAlertsState(cb: () => void): () => void {
  subscribers.add(cb)
  return () => { subscribers.delete(cb) }
}

/** Replace part of the state; the object identity changes so subscribers re-render. */
export function setAlertsState(patch: Partial<AlertsState>): void {
  state = { ...state, ...patch }
  for (const cb of subscribers) cb()
}

/** Test helper: back to the pre-controller state. */
export function resetAlertsState(): void {
  state = INITIAL
  for (const cb of subscribers) cb()
}

export function useAlertsState(): AlertsState {
  return useSyncExternalStore(subscribeAlertsState, getAlertsState, getAlertsState)
}

export interface AlertsActions {
  /** The switch. Native asks for the notification permission on the first on. */
  setEnabled(on: boolean): Promise<void>
  /** Any settings edit that needs no location read. */
  updateSettings(patch: AlertsSettingsPatch): Promise<void>
  /** Measure from My location: reads the position (the only prompt), then saves. */
  chooseMyLocation(): Promise<void>
  /** Use my location for the fixed place: reads the position, then saves. */
  useMyLocationForFixedPlace(): Promise<void>
  /** The inbox's Clear, after its confirmation. */
  clearInbox(): Promise<void>
  /** An inbox row's tap: Nearby Lifers, that species alone (FR-37). */
  openRow(row: InboxRow): void
}

export const NOOP_ACTIONS: AlertsActions = {
  setEnabled: async () => {},
  updateSettings: async () => {},
  chooseMyLocation: async () => {},
  useMyLocationForFixedPlace: async () => {},
  clearInbox: async () => {},
  openRow: () => {},
}

let installed: AlertsActions = NOOP_ACTIONS

/** A stable object whose methods delegate to whatever the controller installed. */
export const alertsActions: AlertsActions = {
  setEnabled: (on) => installed.setEnabled(on),
  updateSettings: (patch) => installed.updateSettings(patch),
  chooseMyLocation: () => installed.chooseMyLocation(),
  useMyLocationForFixedPlace: () => installed.useMyLocationForFixedPlace(),
  clearInbox: () => installed.clearInbox(),
  openRow: (row) => installed.openRow(row),
}

export function installAlertsActions(actions: AlertsActions | null): void {
  installed = actions ?? NOOP_ACTIONS
}
