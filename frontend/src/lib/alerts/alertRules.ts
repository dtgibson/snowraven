// The alert check's rules, restated over plain data (ios-alerts, schema.md
// sections 3.4, 4 and 5). THE TYPESCRIPT TWIN of the Swift `AlertsLogic/` the
// app target runs: the check itself is native (a BGAppRefreshTask has no
// webview), so nothing in the app CALLS these to decide anything. They exist so
// the parity fixture (`alertRules.fixture.json`) can be GENERATED from the
// app's own functions rather than hand-written (testing.md, v1.0.29), and so
// the inbox row's link is built by the same rule the notification's is.
//
// Every rule that already exists in the app is CALLED, not copied:
// `isNonCountableForm` and `normalizeSpeciesName` (speciesUtils), the widget
// reduce and fold (`reduceWidgetRecords`, `foldName`), `distanceMiles`, and
// `parseRetryAfterSeconds`. So the TypeScript side of the fixture is the app's
// rule by construction, and only the Swift side is a twin.
//
// Off the entry chunk (entryChunk.test.ts): imported only by the lazy
// controller, the lazy section and the tests.
//
// ORDERINGS, every string comparison by UTF-16 code unit (JS `<`), which the
// Swift `JSText.compare` reproduces:
//   * one record per species: nearest to the point, then the later `obsDt`,
//     then the smaller `locId` (the widget's row rule);
//   * hits: distance ascending, then the later `obsDt`, then the folded name,
//     then the species code (the widget's list order);
//   * the inbox: the later `alertedAt` first, then the species code, then the id;
//   * a deferred summary's hits: distance ascending, then the species code.

import { isNonCountableForm, isNonCountableNameShape } from '../speciesUtils'
import { SPECIES_CODE_RE } from '../speciesCode'
import { distanceMiles } from '../mapExplorerFormat'
import { parseRetryAfterSeconds, RETRY_AFTER_CAP_SEC } from '../rateLimit'
import { foldName, RECORD_MAX_STRING, reduceWidgetRecords, type WidgetRecord } from '../widgets/widgetRows'
import {
  alertCoord, ALERT_LINK_RADIUS_MAX, ALERT_LINK_RADIUS_MIN, buildWidgetLink, isLinkableBird, LOC_ID_RE,
  type AlertShow, type WidgetLink,
} from '../links/deepLink'
import {
  ALERT_DEDUPE_DAYS, ALERT_FUTURE_SKEW_HOURS, ALERT_INBOX_MAX_ROWS, ALERT_POSITION_MAX_AGE_HOURS, ALERT_RADIUS_MAX,
  ALERT_RADIUS_MIN, ALERT_RETENTION_DAYS,
  type AlertBlocked, type AlertModel, type AlertOutcome, type CheckFrom, type FixedPlace, type InboxRow,
  type LocationPermission, type PendingHit, type PendingSummary, type PlacePhrase,
} from './alertsState'

const DAY_MS = 86_400_000
export const DEDUPE_MS = ALERT_DEDUPE_DAYS * DAY_MS
export const RETENTION_MS = ALERT_RETENTION_DAYS * DAY_MS
export const POSITION_MAX_AGE_MS = ALERT_POSITION_MAX_AGE_HOURS * 3_600_000
export const FUTURE_SKEW_MS = ALERT_FUTURE_SKEW_HOURS * 3_600_000
/** A deferred summary holds at most this many hits and check ids. */
export const PENDING_MAX = 200

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** ISO-8601 UTC to the second, the one time format the documents carry. */
export function isoSeconds(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19) + 'Z'
}

// ── The request (FR-22) ───────────────────────────────────────────────────────

/** eBird's `dist` for a radius in miles, as the app's handlers compute it
 *  (`handleFindLifers`); `EBirdRequest.make(distKm:)` takes the same. */
export function distKmFor(radiusMi: number): number {
  return Math.round(radiusMi * 1.60934)
}

// ── Outcome of the one request (schema.md 4.4, design-spec section 4) ─────────

export type FetchKind =
  | { kind: 'ok'; body: unknown }
  | { kind: 'status'; code: number; retryAfter: string | null }
  | { kind: 'offline' }
  | { kind: 'timeout' }
  | { kind: 'tooLarge' }

/** The outcome a fetch result earns. `hits` vs `nothing-new` is decided after
 *  the rows (a decoded body yields `ok-body` here). */
export function outcomeOf(f: FetchKind): AlertOutcome | 'ok-body' {
  switch (f.kind) {
    case 'ok': return reduceWidgetRecords(f.body) === null ? 'no-answer' : 'ok-body'
    case 'status':
      if (f.code === 429) return 'busy'
      if (f.code === 401 || f.code === 403) return 'key-rejected'
      return 'no-answer'
    case 'offline':
    case 'timeout':
      return 'unreachable'
    case 'tooLarge':
      return 'no-answer'
  }
}

/** FR-26: the hold after a 429, bounded exactly as the pacing contract bounds
 *  it (1 to 60 s), 60 s when the header is absent or unparseable. */
export function holdUntilFrom(nowMs: number, retryAfter: string | null): number {
  return nowMs + (parseRetryAfterSeconds(retryAfter) ?? RETRY_AFTER_CAP_SEC) * 1000
}

// ── Countability, with its data passed in (schema.md 3.7) ────────────────────

/**
 * `isNonCountableForm` with the two exception sets as PARAMETERS: the shape the
 * Swift twin has, since it receives the lists through the hand-over. With the
 * artifact's own lists this IS the app's rule (alertRules.parity.test.ts
 * asserts the two agree over every name in both lists and the whole corpus);
 * with synthetic lists it lets the fixture carry non-ASCII exception names the
 * artifact happens not to hold.
 */
export function isNonCountableWith(name: string, rejects: ReadonlySet<string>, counts: ReadonlySet<string>): boolean {
  if (rejects.has(name)) return true
  if (counts.has(name)) return false
  return isNonCountableNameShape(name)
}

// ── Candidates (FR-23, schema.md 4.5 steps 1 to 3 and 5) ─────────────────────

export interface AlertHit {
  speciesCode: string
  comName: string
  locId: string
  locName: string
  lat: number
  lng: number
  obsDt: string
  distanceMi: number
}

/** No C0 control character and no DEL (the Swift `AlertValidate.noControls`). */
function hasNoControls(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c <= 0x1f || c === 0x7f) return false
  }
  return true
}

/**
 * Whether the three fields a hit copies from eBird could be held by an inbox
 * row (the Swift `InboxRow.isValid` predicates, the twin of
 * `Candidates.isAlertable`): the species code in its pattern, the common name
 * 1 to 512 UTF-16 units with no control character, the location id empty or
 * in its pattern. A record that fails is never a hit, so it is never notified
 * and then refused at the inbox's write, which would leave nothing to dedupe
 * it and alert it again on every check. The reducer admits such a record
 * (only an empty code is dropped there), which is why this is a second gate.
 */
export function isAlertableRecord(r: Pick<WidgetRecord, 'speciesCode' | 'comName' | 'locId'>): boolean {
  return SPECIES_CODE_RE.test(r.speciesCode)
    && r.comName.length >= 1 && r.comName.length <= RECORD_MAX_STRING && hasNoControls(r.comName)
    && (r.locId === '' || LOC_ID_RE.test(r.locId))
}

/**
 * The check's candidates, nearest first: records an inbox row could hold
 * (`isAlertableRecord`) whose folded name is NOT in the recorded set (already
 * folded by the hand-over's builder), minus every non-countable form through
 * the app's shared rule, one per species.
 */
export function alertCandidates(
  records: readonly WidgetRecord[],
  recorded: readonly string[],
  point: { lat: number; lng: number },
  isNonCountable: (name: string) => boolean = isNonCountableForm,
): AlertHit[] {
  const recordedSet = new Set(recorded)
  const best = new Map<string, AlertHit>()
  for (const r of records) {
    if (!isAlertableRecord(r)) continue
    if (recordedSet.has(foldName(r.comName))) continue
    if (isNonCountable(r.comName)) continue
    const d = distanceMiles(point.lat, point.lng, r.lat, r.lng)
    const prev = best.get(r.speciesCode)
    if (!prev
      || d < prev.distanceMi
      || (d === prev.distanceMi && (cmp(r.obsDt, prev.obsDt) > 0
        || (r.obsDt === prev.obsDt && cmp(r.locId, prev.locId) < 0)))) {
      best.set(r.speciesCode, {
        speciesCode: r.speciesCode, comName: r.comName, locId: r.locId, locName: r.locName,
        lat: r.lat, lng: r.lng, obsDt: r.obsDt, distanceMi: d,
      })
    }
  }
  return [...best.values()].sort((x, y) =>
    (x.distanceMi - y.distanceMi)
    || -cmp(x.obsDt, y.obsDt)
    || cmp(foldName(x.comName), foldName(y.comName))
    || cmp(x.speciesCode, y.speciesCode))
}

// ── The inbox (FR-24, FR-27, FR-37, FR-38; schema.md 3.4) ─────────────────────

function inboxOrder(a: InboxRow, b: InboxRow): number {
  return -cmp(a.alertedAt, b.alertedAt) || cmp(a.speciesCode, b.speciesCode) || cmp(a.id, b.id)
}

/** The bound, on every write and every load: drop rows 30 days past their
 *  alerted time, and rows whose alerted or updated time is more than 24 hours
 *  ahead (the device clock wrote them, so such a time is implausible; kept, a
 *  future alerted time would never age out and would hold back the species'
 *  next alert), then keep the newest 200 in inbox order. Idempotent. */
export function evictInbox(rows: readonly InboxRow[], nowMs: number): InboxRow[] {
  return rows
    .filter(r => nowMs - Date.parse(r.alertedAt) < RETENTION_MS
      && Date.parse(r.alertedAt) - nowMs <= FUTURE_SKEW_MS
      && Date.parse(r.updatedAt) - nowMs <= FUTURE_SKEW_MS)
    .sort(inboxOrder)
    .slice(0, ALERT_INBOX_MAX_ROWS)
}

export interface CheckContext {
  nowMs: number
  checkId: string
  point: { lat: number; lng: number }
  radiusMi: number
  place: PlacePhrase
  /** Fresh row ids, taken in order for each new row (UUIDs in production). */
  ids: readonly string[]
}

/**
 * Apply one check's candidates to the inbox (schema.md 3.4): a species whose
 * most recent row is inside seven days updates THAT row's sighting fields and
 * is not a hit; any other candidate is a hit and gets a new row. Returns the
 * rows (evicted, in inbox order) and the hits (nearest first).
 */
export function applyCandidates(
  rows: readonly InboxRow[], candidates: readonly AlertHit[], ctx: CheckContext,
): { rows: InboxRow[]; hits: AlertHit[] } {
  const now = isoSeconds(ctx.nowMs)
  const out = rows.map(r => ({ ...r }))
  const latest = new Map<string, InboxRow>()
  for (const r of out) {
    const prev = latest.get(r.speciesCode)
    if (!prev || cmp(r.alertedAt, prev.alertedAt) > 0) latest.set(r.speciesCode, r)
  }
  const hits: AlertHit[] = []
  let next = 0
  for (const c of candidates) {
    const row = latest.get(c.speciesCode)
    if (row && ctx.nowMs - Date.parse(row.alertedAt) < DEDUPE_MS) {
      row.locId = c.locId
      row.locName = c.locName
      row.lat = c.lat
      row.lng = c.lng
      row.obsDt = c.obsDt
      row.distanceMi = c.distanceMi
      row.point = { lat: ctx.point.lat, lng: ctx.point.lng }
      row.radiusMi = ctx.radiusMi
      row.place = ctx.place
      row.updatedAt = now
      continue
    }
    hits.push(c)
    out.push({
      id: ctx.ids[next++] ?? '',
      checkId: ctx.checkId,
      speciesCode: c.speciesCode,
      comName: c.comName,
      locId: c.locId,
      locName: c.locName,
      lat: c.lat,
      lng: c.lng,
      obsDt: c.obsDt,
      distanceMi: c.distanceMi,
      point: { lat: ctx.point.lat, lng: ctx.point.lng },
      radiusMi: ctx.radiusMi,
      place: ctx.place,
      alertedAt: now,
      updatedAt: now,
    })
  }
  return { rows: evictInbox(out, ctx.nowMs), hits }
}

// ── The link (FR-31, FR-37; schema.md 5) ──────────────────────────────────────

/** The link for one sighting: the alert form when both ids are in pattern and
 *  the point and radius are in range, else the plain Day view link (the
 *  widget's rule: the view-only landing is always correct). */
export function alertLinkFor(
  bird: { speciesCode: string; locId: string },
  point: { lat: number; lng: number },
  radiusMi: number,
  show: AlertShow,
): WidgetLink {
  const view: WidgetLink = { view: 'lifers', window: 'day' }
  if (!isLinkableBird(bird)) return view
  const lat = alertCoord(point.lat)
  const lng = alertCoord(point.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return view
  if (!Number.isInteger(radiusMi) || radiusMi < ALERT_LINK_RADIUS_MIN || radiusMi > ALERT_LINK_RADIUS_MAX) return view
  return { view: 'lifers', window: 'day', point: { lat, lng }, radiusMi, bird: { speciesCode: bird.speciesCode, locId: bird.locId }, show }
}

/** The link string for one sighting (the notification's `userInfo.link`). */
export function alertLinkString(
  bird: { speciesCode: string; locId: string }, point: { lat: number; lng: number }, radiusMi: number, show: AlertShow,
): string {
  return buildWidgetLink(alertLinkFor(bird, point, radiusMi, show))
}

/** An inbox row's own link: that species alone, from the row's point (FR-37). */
export function inboxRowLink(row: InboxRow): WidgetLink {
  return alertLinkFor({ speciesCode: row.speciesCode, locId: row.locId }, row.point, row.radiusMi, 'one')
}

/** The fixed place's name as the settings validator accepts it (schema 3.2):
 *  1 to 120 UTF-16 units, no control characters, no edge whitespace; a query
 *  outside that is saved with no name ("nearby") rather than refused. */
export function placeName(query: string): string | null {
  const t = query.trim()
  if (t.length < 1 || t.length > 120) return null
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i)
    if (c <= 0x1f || c === 0x7f) return null
  }
  return t
}

/** The radius as typed (FR-11): a whole number 1 to 25, or null, which the
 *  section refuses at entry; the stored value is never changed by a refusal. */
export function parseRadius(v: string): number | null {
  if (!/^[0-9]{1,2}$/.test(v)) return null
  const n = Number(v)
  return n >= ALERT_RADIUS_MIN && n <= ALERT_RADIUS_MAX ? n : null
}

// ── The notification (FR-29; design-spec section 9) ──────────────────────────

export function phraseText(p: PlacePhrase): string {
  return p.kind === 'name' ? `near ${p.name}` : p.kind === 'near-you' ? 'near you' : 'nearby'
}

export function notificationTitle(count: number, phrase: PlacePhrase): string {
  return `${count} ${count === 1 ? 'lifer' : 'lifers'} reported ${phraseText(phrase)}`
}

export function notificationBody(namesNearestFirst: readonly string[]): string {
  const shown = namesNearestFirst.slice(0, 3).join(', ')
  const more = namesNearestFirst.length - 3
  return more > 0 ? `${shown} and ${more} more` : shown
}

// ── Quiet hours (FR-33 to FR-36; schema.md 4.6) ───────────────────────────────

/** True inside the window. Equal start and end is no quiet period (FR-34);
 *  an end before the start spans midnight. */
export function isQuiet(minuteOfDay: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false
  if (startMin < endMin) return minuteOfDay >= startMin && minuteOfDay < endMin
  return minuteOfDay >= startMin || minuteOfDay < endMin
}

interface WallClock { y: number; mo: number; d: number; h: number; mi: number; s: number }

function wallClock(ms: number, tz: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

/** The local minute of the day at an instant, in an IANA zone. */
export function minuteOfDay(ms: number, tz: string): number {
  const w = wallClock(ms, tz)
  return w.h * 60 + w.mi
}

function offsetMs(ms: number, tz: string): number {
  const w = wallClock(ms, tz)
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000
}

/**
 * The next instant strictly after `nowMs` whose local wall time is `endMin`:00
 * (Swift: `Calendar.nextDate(after:matching:[hour, minute])`). A window end on
 * a DST transition night lands on the right instant because the local date is
 * advanced first and converted after. Stated limit: a wall time inside a
 * spring-forward GAP is not twinned (the fixture carries none; 7:00 AM, the
 * default end, never falls in one in any zone the app is used in).
 */
export function windowEnd(nowMs: number, endMin: number, tz: string): number {
  const w = wallClock(nowMs, tz)
  const nowSec = w.h * 3600 + w.mi * 60 + w.s
  const endSec = endMin * 60
  const addDay = nowSec >= endSec ? 1 : 0
  const guess = Date.UTC(w.y, w.mo - 1, w.d + addDay, Math.floor(endMin / 60), endMin % 60, 0)
  const o1 = offsetMs(guess, tz)
  let t = guess - o1
  const o2 = offsetMs(t, tz)
  if (o2 !== o1) t = guess - o2
  return t
}

/**
 * Merge one check's hits into the deferred summary (FR-35): one entry per
 * species (the nearer sighting kept, the existing one on a tie), the union
 * nearest first, at most 200; the window end and the place stay those of the
 * FIRST deferred check (FR-13).
 */
export function mergePending(
  pending: PendingSummary | null,
  hits: readonly PendingHit[],
  first: { windowEndAt: string; place: PlacePhrase },
  checkId: string,
): PendingSummary {
  const base: PendingSummary = pending ?? { windowEndAt: first.windowEndAt, place: first.place, hits: [], checkIds: [] }
  const by = new Map<string, PendingHit>()
  for (const h of base.hits) by.set(h.speciesCode, h)
  for (const h of hits) {
    const prev = by.get(h.speciesCode)
    if (!prev || h.distanceMi < prev.distanceMi) by.set(h.speciesCode, h)
  }
  const merged = [...by.values()]
    .sort((a, b) => (a.distanceMi - b.distanceMi) || cmp(a.speciesCode, b.speciesCode))
    .slice(0, PENDING_MAX)
  const checkIds = [...base.checkIds, checkId].slice(-PENDING_MAX)
  return { windowEndAt: base.windowEndAt, place: base.place, hits: merged, checkIds }
}

// ── The point and the preconditions (FR-10, FR-16 to FR-18; schema.md 4.3, 4.7) ─

/** Where the widget's cache cell came from (the Swift `CellSource`). */
export type WidgetCellSource = 'device' | 'default-location'

export interface PointInputs {
  model: AlertModel
  fixedPlace: FixedPlace | null
  /** The hand-over, or null when it is absent or invalid. */
  handover: { hasKey: boolean; hasBackup: boolean; defaultLocation: { lat: number; lng: number } | null } | null
  /** The app's own recorded position (a seed or a foreground fix). */
  position: { lat: number; lng: number; atMs: number } | null
  /** The widget cache's cell, its fetch time, and where it came from (null:
   *  a cache written before the widget recorded it). */
  widgetCell: { lat: number; lng: number; atMs: number; source: WidgetCellSource | null } | null
  location: LocationPermission
  nowMs: number
}

export type Resolved =
  | { kind: 'point'; point: { lat: number; lng: number }; phrase: PlacePhrase; from: CheckFrom }
  | { kind: 'blocked'; blocked: AlertBlocked }

function fixedPoint(i: PointInputs): { point: { lat: number; lng: number }; phrase: PlacePhrase } | null {
  if (i.fixedPlace) {
    const phrase: PlacePhrase = i.fixedPlace.name ? { kind: 'name', name: i.fixedPlace.name } : { kind: 'nearby' }
    return { point: { lat: i.fixedPlace.lat, lng: i.fixedPlace.lng }, phrase }
  }
  const d = i.handover?.defaultLocation
  return d ? { point: { lat: d.lat, lng: d.lng }, phrase: { kind: 'nearby' } } : null
}

/**
 * The point a My location check measures from (security review L6): rounded
 * half away from zero to two decimals, the precision the widget's cache cell
 * already has, so the request, the distances, the inbox rows and the links all
 * carry a point within about half a mile of the device. The twin of
 * `AlertRules.approximate` (Swift `(x * 100).rounded(.toNearestOrAwayFromZero)`;
 * `Math.round` alone rounds a negative tie toward zero, hence the sign split).
 */
export function approximatePoint(p: { lat: number; lng: number }): { lat: number; lng: number } {
  const round2 = (x: number) => Math.sign(x) * Math.round(Math.abs(x) * 100) / 100
  return { lat: round2(p.lat), lng: round2(p.lng) }
}

/**
 * Where a check measures from, or the first missing thing. Under My location a
 * denied or restricted permission uses no stored position at all (FR-16 reads
 * "location denied" as the user's answer, and it is honored); otherwise the
 * newest of the app's own position and the widget's cell (only a cell the
 * widget marked as read from the device, L7), each admitted only
 * inside 24 hours and no more than 24 hours ahead (security review L4), as an
 * approximate point (`approximatePoint`, L6), then the fixed place, at the
 * precision the user gave it, as the fallback.
 */
export function resolvePoint(i: PointInputs): Resolved {
  if (i.model === 'fixed') {
    const f = fixedPoint(i)
    return f ? { kind: 'point', ...f, from: 'fixed' } : { kind: 'blocked', blocked: 'no-place' }
  }
  const denied = i.location === 'denied' || i.location === 'restricted'
  if (!denied) {
    // Security review L7: the cell is a reading of the device only when the
    // widget says so; a Default Location fallback, or an unmarked cell, is not.
    const cell = i.widgetCell !== null && i.widgetCell.source === 'device' ? i.widgetCell : null
    const fresh = [i.position, cell].filter(
      (p): p is { lat: number; lng: number; atMs: number } => p !== null && i.nowMs - p.atMs <= POSITION_MAX_AGE_MS
        && p.atMs - i.nowMs <= FUTURE_SKEW_MS,
    )
    if (fresh.length > 0) {
      // Newest wins; the app's own position wins a tie (it is listed first).
      const pick = fresh.reduce((a, b) => (b.atMs > a.atMs ? b : a))
      return { kind: 'point', point: approximatePoint(pick), phrase: { kind: 'near-you' }, from: 'my-location' }
    }
  }
  const f = fixedPoint(i)
  if (f) return { kind: 'point', ...f, from: 'fixed-fallback' }
  return { kind: 'blocked', blocked: denied ? 'location-off' : 'no-position' }
}

/** FR-18's order: a key, a backup, then a point. An absent hand-over reads as
 *  no key (the revocation document the widget build writes when a key goes). */
export function resolveBlocked(i: PointInputs): AlertBlocked | null {
  if (!i.handover || !i.handover.hasKey) return 'no-key'
  if (!i.handover.hasBackup) return 'no-backup'
  const r = resolvePoint(i)
  return r.kind === 'blocked' ? r.blocked : null
}
