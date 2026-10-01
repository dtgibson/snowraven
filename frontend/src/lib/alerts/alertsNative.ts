// Typed wrappers over the five iOS alert commands in src-tauri/src/alerts.rs
// (ios-alerts, schema.md 10.1). NEVER on the entry graph: it imports
// @tauri-apps/api statically and is reached only through the dynamic-imported
// controller and the dynamic-imported purge (entryChunk.test.ts asserts both
// halves).
//
// Every reply is the snapshot native produced, as JSON text. It is PARSED and
// SHAPE-CHECKED here before it reaches the store, because a field that is not
// the type the section renders would reach React as a non-string child and take
// the whole Settings tab down (the CLAUDE.md worker-reply rule, applied to a
// native reply): an unusable reply rejects with `invalid`, and inbox rows are
// checked one by one so a single malformed row is dropped rather than the list.

import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  ALERT_BLOCKED, ALERT_OUTCOMES, ALERTS_EVENT, type AlertsSettingsPatch, type AlertsSnapshot, type InboxRow,
  type PlacePhrase,
} from './alertsState'

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isPt = (v: unknown): boolean => isObj(v) && isNum(v['lat']) && isNum(v['lng'])

function isPhrase(v: unknown): v is PlacePhrase {
  if (!isObj(v)) return false
  if (v['kind'] === 'name') return isStr(v['name'])
  return v['kind'] === 'near-you' || v['kind'] === 'nearby'
}

/** One inbox row as the section renders it: every field it reads, typed. */
export function isInboxRow(v: unknown): v is InboxRow {
  if (!isObj(v)) return false
  return isStr(v['id']) && isStr(v['checkId']) && isStr(v['speciesCode']) && isStr(v['comName'])
    && isStr(v['locId']) && isStr(v['locName']) && isNum(v['lat']) && isNum(v['lng']) && isStr(v['obsDt'])
    && isNum(v['distanceMi']) && isPt(v['point']) && isNum(v['radiusMi']) && isPhrase(v['place'])
    && isStr(v['alertedAt']) && isStr(v['updatedAt'])
}

function isSettings(v: unknown): boolean {
  if (!isObj(v)) return false
  const q = v['quietHours']
  const f = v['fixedPlace']
  return isBool(v['enabled']) && (v['cadence'] === 'hourly' || v['cadence'] === 'daily')
    && isObj(q) && isBool(q['on']) && isNum(q['startMin']) && isNum(q['endMin'])
    && (v['model'] === 'fixed' || v['model'] === 'my-location')
    && (f === null || (isObj(f) && isNum(f['lat']) && isNum(f['lng']) && (f['name'] === null || isStr(f['name']))))
    && isNum(v['radiusMi'])
}

function isStateDoc(v: unknown): boolean {
  if (!isObj(v)) return false
  const lc = v['lastCheck']
  if (lc !== null && !(isObj(lc) && isStr(lc['completedAt']) && (ALERT_OUTCOMES as readonly unknown[]).includes(lc['outcome'])
    && isNum(lc['hits']) && (lc['from'] === 'fixed' || lc['from'] === 'my-location' || lc['from'] === 'fixed-fallback'))) return false
  const br = v['backgroundRefresh']
  return br === 'available' || br === 'denied' || br === 'restricted'
}

/** Parse and shape-check a snapshot reply; null when it is not usable. */
export function parseSnapshot(text: string): AlertsSnapshot | null {
  let v: unknown
  try { v = JSON.parse(text) } catch { return null }
  if (!isObj(v) || !isSettings(v['settings']) || !isStateDoc(v['state']) || !Array.isArray(v['inbox'])) return null
  const blocked = v['blocked']
  if (blocked !== null && !(ALERT_BLOCKED as readonly unknown[]).includes(blocked)) return null
  const perms = v['permissions']
  if (!isObj(perms)) return null
  const n = perms['notifications']
  const l = perms['location']
  if (n !== 'not-determined' && n !== 'granted' && n !== 'denied') return null
  if (l !== 'not-determined' && l !== 'granted' && l !== 'denied' && l !== 'restricted') return null
  const d = v['defaultLocation']
  if (d !== null && !isPt(d)) return null
  if (!isStr(v['now'])) return null
  return { ...(v as unknown as AlertsSnapshot), inbox: (v['inbox'] as unknown[]).filter(isInboxRow) }
}

async function snapshotFrom(p: Promise<string>): Promise<AlertsSnapshot> {
  const snap = parseSnapshot(await p)
  if (!snap) throw new Error('invalid')
  return snap
}

export function snapshot(): Promise<AlertsSnapshot> {
  return snapshotFrom(invoke<string>('alerts_snapshot'))
}

export function updateSettings(patch: AlertsSettingsPatch): Promise<AlertsSnapshot> {
  return snapshotFrom(invoke<string>('alerts_update_settings', { patch: JSON.stringify(patch) }))
}

export function setEnabled(enabled: boolean): Promise<AlertsSnapshot> {
  return snapshotFrom(invoke<string>('alerts_set_enabled', { enabled }))
}

export function clearInbox(): Promise<AlertsSnapshot> {
  return snapshotFrom(invoke<string>('alerts_clear_inbox'))
}

/** The clear registry's purge; rejects when native could not purge, so
 *  `purgeDerivedOnClear` reports the row rather than a clean sweep. */
export function purgeInbox(): Promise<void> {
  return invoke<void>('alerts_purge_inbox')
}

/** Listen for native's poke that the alert state changed. */
export function onAlertsChanged(cb: () => void): Promise<UnlistenFn> {
  return listen(ALERTS_EVENT, () => cb())
}
