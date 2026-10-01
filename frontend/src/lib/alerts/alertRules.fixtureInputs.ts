// HAND-AUTHORED INPUTS for the alert rules parity fixture (ios-alerts,
// schema.md section 8.3). Only inputs live here: every expected value in
// alertRules.fixture.json is GENERATED from these by the shipped TypeScript
// twin (`alertRules.ts`, which calls the app's own functions) in
// alertRules.fixtureBuild.ts, never written by hand (testing.md v1.0.29).
//
// Not a test file and never imported by shipped code: only the builder and
// the parity tests import it.
//
// Bodies are shaped exactly as eBird's data/obs/geo/recent returns them.
// Coordinates that must TIE use the identical pair, so both runtimes compute a
// bit-identical haversine; every other pair differs by far more than a last-ulp
// libm difference could move.

import type { InboxRow, PendingHit, PendingSummary, PlacePhrase } from './alertsState'

export const TZ = 'America/Los_Angeles'
/** 09:00 local in Los Angeles on 2026-09-30. */
export const NOW_ISO = '2026-09-30T16:00:00Z'
export const DAVIS = { lat: 38.5449, lng: -121.7405 }

type Rec = Record<string, unknown>

function rec(speciesCode: string, comName: string, locId: string, locName: string, lat: number, lng: number, obsDt: string, subId = 'S100'): Rec {
  return { speciesCode, comName, sciName: 'x', locId, locName, obsDt, howMany: 1, lat, lng, obsValid: true, obsReviewed: false, locationPrivate: false, subId }
}

// ── candidates ────────────────────────────────────────────────────────────────

/** QA-22: recorded {A, B (a subspecies form)}; eBird returns A, B at species
 *  level, C, a spuh, a hybrid, D. The candidates are exactly {C, D}. */
export const QA22 = {
  // Folded as the hand-over's builder folds the backup's names.
  recorded: ['american avocet', 'yellow-rumped warbler'],
  body: [
    rec('ameavo', 'American Avocet', 'L1000001', 'Yolo Bypass Wildlife Area', 38.5512, -121.6331, '2026-09-30 07:10'),
    rec('yerwar', 'Yellow-rumped Warbler', 'L1000002', 'Davis Wetlands', 38.5870, -121.6910, '2026-09-30 08:02'),
    rec('ruff', 'Ruff', 'L1000001', 'Yolo Bypass Wildlife Area', 38.5512, -121.6331, '2026-09-30 07:45'),
    rec('gull', 'gull sp.', 'L1000003', 'Yolo County Central Landfill', 38.6034, -121.6802, '2026-09-30 06:30'),
    rec('x00776', 'Glaucous-winged x Western Gull (hybrid)', 'L1000003', 'Yolo County Central Landfill', 38.6034, -121.6802, '2026-09-29 16:20'),
    rec('sabgul', "Sabine's Gull", 'L1000004', 'Lake Solano County Park', 38.4935, -122.0301, '2026-09-30 09:05'),
  ],
}

export const CANDIDATE_CASES: { name: string; recorded: string[]; body: Rec[]; point: { lat: number; lng: number } }[] = [
  { name: 'qa22', recorded: QA22.recorded, body: QA22.body, point: DAVIS },
  {
    // One record per species: the nearest; on a distance tie the later obsDt;
    // on that tie too the smaller locId.
    name: 'one-per-species-and-ties',
    recorded: [],
    point: DAVIS,
    body: [
      rec('bawsan', "Baird's Sandpiper", 'L2000009', 'Far Pond', 38.7100, -121.5000, '2026-09-30 08:00'),
      rec('bawsan', "Baird's Sandpiper", 'L2000005', 'Near Pond', 38.5600, -121.7000, '2026-09-29 18:00'),
      rec('pecsan', 'Pectoral Sandpiper', 'L2000002', 'Twin Ponds A', 38.5600, -121.7000, '2026-09-29 18:00'),
      rec('pecsan', 'Pectoral Sandpiper', 'L2000003', 'Twin Ponds B', 38.5600, -121.7000, '2026-09-30 06:00'),
      rec('bkbwar', 'Broad-winged Hawk', 'L2000007', 'Ridge East', 38.5600, -121.7000, '2026-09-30 06:00'),
      rec('bkbwar', 'Broad-winged Hawk', 'L2000006', 'Ridge West', 38.5600, -121.7000, '2026-09-30 06:00'),
    ],
  },
  {
    // A non-ASCII name, an escapee that is NOT recorded (escapee exclusion is
    // out of scope, so it alerts), and an unrecorded subspecies form, which
    // alerts under its own name and code.
    name: 'non-ascii-escapee-and-forms',
    recorded: ['mallard'],
    point: DAVIS,
    body: [
      rec('ruewar1', "Rüppell's Warbler", 'L3000001', 'Putah Creek Riparian Reserve', 38.5231, -121.7876, '2026-09-30 07:00'),
      rec('swagoo1', 'Swan Goose', 'L3000002', 'Arboretum Waterway', 38.5390, -121.7550, '2026-09-30 07:30'),
      rec('audwar', "Yellow-rumped Warbler (Audubon's)", 'L3000003', 'Central Park', 38.5450, -121.7400, '2026-09-30 08:10'),
      rec('mallar3', 'Mallard (Domestic type)', 'L3000002', 'Arboretum Waterway', 38.5390, -121.7550, '2026-09-30 07:30'),
      rec('mallar3', 'Mallard', 'L3000004', 'North Pond', 38.5600, -121.7500, '2026-09-30 07:30'),
    ],
  },
  {
    // The parenthetical " x " is ADMITTED (an intergrade is countable), the
    // base-name " x " is not; a slash is not; a domestic form the artifact
    // rejects is not.
    name: 'countability-shapes',
    recorded: [],
    point: DAVIS,
    body: [
      rec('yerwar2', "Yellow-rumped Warbler (Myrtle x Audubon's)", 'L4000001', 'A', 38.55, -121.74, '2026-09-30 08:00'),
      rec('x00001', 'Mallard x American Black Duck (hybrid)', 'L4000002', 'B', 38.56, -121.74, '2026-09-30 08:00'),
      rec('y00478', 'Greater/Lesser Scaup', 'L4000003', 'C', 38.57, -121.74, '2026-09-30 08:00'),
      rec('domgoo1', 'Domestic goose sp. (Domestic type)', 'L4000004', 'D', 38.58, -121.74, '2026-09-30 08:00'),
      rec('lbbgul', 'Lesser Black-backed Gull', 'L4000005', 'E', 38.59, -121.74, '2026-09-30 08:00'),
    ],
  },
  {
    // The inbox row's shape at its edges is ADMITTED (the other direction of
    // the unrowable records below): a two-character code with no location id,
    // a 16-character code with a 512-unit name, a 15-digit location id.
    name: 'row-shape-edges',
    recorded: [],
    point: DAVIS,
    body: [
      rec('ab', 'Edge Bird One', '', 'No hotspot', 38.55, -121.74, '2026-09-30 08:00'),
      rec('abcdefghijklmnop', 'N'.repeat(512), 'L1', 'A', 38.56, -121.74, '2026-09-30 08:00'),
      rec('edge-3', 'Edge Bird Three', 'L' + '9'.repeat(15), 'B', 38.57, -121.74, '2026-09-30 08:00'),
    ],
  },
]

/** Records that never become a candidate, each appended to QA-22's body in
 *  turn: the candidates must equal QA-22's (the structural rule, CLAUDE.md).
 *  The reducer DROPS the first group; it KEEPS the `unrowable-` group (the
 *  parity tests assert so), which no inbox row could hold, so the candidate
 *  filter is what drops them (`isAlertableRecord`, security review L5). */
const MAG = 'Magnificent Frigatebird'
export const MALFORMED_RECORDS: { name: string; record: unknown }[] = [
  { name: 'boolean-lat', record: { ...rec('mag1', 'Magnificent Frigatebird', 'L9', 'X', 0, 0, '2026-09-30 08:00'), lat: true } },
  { name: 'string-lng', record: { ...rec('mag1', 'Magnificent Frigatebird', 'L9', 'X', 0, 0, '2026-09-30 08:00'), lng: '-121.7' } },
  { name: 'no-code', record: rec('', 'Magnificent Frigatebird', 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'bad-date', record: rec('mag1', 'Magnificent Frigatebird', 'L9', 'X', 38.5, -121.7, '2026-02-30 08:00') },
  { name: 'lat-out-of-range', record: rec('mag1', 'Magnificent Frigatebird', 'L9', 'X', 91, -121.7, '2026-09-30 08:00') },
  { name: 'overlong-name', record: rec('mag1', 'M'.repeat(513), 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'not-an-object', record: 'Magnificent Frigatebird' },
  { name: 'unrowable-code-uppercase', record: rec('Mag1', MAG, 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-code-one-char', record: rec('m', MAG, 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-code-17-chars', record: rec('m'.repeat(17), MAG, 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-code-trailing-newline', record: rec('mag1\n', MAG, 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-code-non-ascii-digit', record: rec('mag\u0661', MAG, 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-name-empty', record: rec('mag1', '', 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-name-bell', record: rec('mag1', 'Magnificent\u0007Frigatebird', 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-name-del', record: rec('mag1', MAG + '\u007f', 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-name-newline', record: rec('mag1', 'Magnificent\nFrigatebird', 'L9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-loc-shape', record: rec('mag1', MAG, 'X9', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-loc-bare-l', record: rec('mag1', MAG, 'L', 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-loc-16-digits', record: rec('mag1', MAG, 'L' + '1'.repeat(16), 'X', 38.5, -121.7, '2026-09-30 08:00') },
  { name: 'unrowable-loc-trailing-newline', record: rec('mag1', MAG, 'L9\n', 'X', 38.5, -121.7, '2026-09-30 08:00') },
]

// ── checks: the whole pure pipeline (reduce, candidates, dedupe, evict) ───────

export const NAMED_PLACE: PlacePhrase = { kind: 'name', name: 'Davis' }

const T = Date.parse(NOW_ISO)
const days = (n: number) => new Date(T - n * 86_400_000).toISOString().slice(0, 19) + 'Z'
const ahead = (seconds: number) => new Date(T + seconds * 1000).toISOString().slice(0, 19) + 'Z'

export function row(id: string, speciesCode: string, comName: string, alertedAt: string, extra: Partial<InboxRow> = {}): InboxRow {
  return {
    id, checkId: '00000000-0000-4000-8000-000000000001', speciesCode, comName,
    locId: 'L1000001', locName: 'Yolo Bypass Wildlife Area', lat: 38.5512, lng: -121.6331,
    obsDt: '2026-09-20 07:45', distanceMi: 5.9, point: DAVIS, radiusMi: 25, place: NAMED_PLACE,
    alertedAt, updatedAt: alertedAt, ...extra,
  }
}

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const CHECK_CASES: {
  name: string; body: unknown[]; recorded: string[]; point: { lat: number; lng: number }; radiusMi: number
  place: PlacePhrase; nowIso: string; checkId: string; ids: string[]; rows: InboxRow[]
}[] = [
  // QA-23 at T+6d: Ruff was alerted six days ago; found again, its row takes
  // the newer sighting and keeps its alerted time. Sabine's Gull is new.
  { name: 'qa23-six-days-updates', body: QA22.body, recorded: QA22.recorded, point: DAVIS, radiusMi: 25, place: NAMED_PLACE,
    nowIso: NOW_ISO, checkId: ID(100), ids: [ID(101), ID(102)], rows: [row(ID(1), 'ruff', 'Ruff', days(6))] },
  // QA-23 at T+8d: a new alert and a new row; the old row stays as history.
  { name: 'qa23-eight-days-realerts', body: QA22.body, recorded: QA22.recorded, point: DAVIS, radiusMi: 25, place: NAMED_PLACE,
    nowIso: NOW_ISO, checkId: ID(200), ids: [ID(201), ID(202)], rows: [row(ID(2), 'ruff', 'Ruff', days(8))] },
  // Exactly seven days is outside the rule (the boundary alerts again).
  { name: 'exactly-seven-days-realerts', body: QA22.body, recorded: QA22.recorded, point: DAVIS, radiusMi: 25, place: NAMED_PLACE,
    nowIso: NOW_ISO, checkId: ID(300), ids: [ID(301), ID(302)], rows: [row(ID(3), 'ruff', 'Ruff', days(7))] },
  // QA-26: an aged-out row (31 days) re-arms the species and is itself evicted.
  { name: 'qa26-aged-out', body: QA22.body, recorded: QA22.recorded, point: DAVIS, radiusMi: 25, place: NAMED_PLACE,
    nowIso: NOW_ISO, checkId: ID(400), ids: [ID(401), ID(402)], rows: [row(ID(4), 'ruff', 'Ruff', days(31))] },
  // QA-26: after Clear the inbox is empty and both species alert.
  { name: 'qa26-cleared', body: QA22.body, recorded: QA22.recorded, point: DAVIS, radiusMi: 25, place: NAMED_PLACE,
    nowIso: NOW_ISO, checkId: ID(500), ids: [ID(501), ID(502)], rows: [] },
  // QA-27: a newer backup now records Ruff, so it is no longer a candidate;
  // its old row stays as history.
  { name: 'qa27-backup-now-records', body: QA22.body, recorded: [...QA22.recorded, 'ruff'], point: DAVIS, radiusMi: 25, place: NAMED_PLACE,
    nowIso: NOW_ISO, checkId: ID(600), ids: [ID(601)], rows: [row(ID(6), 'ruff', 'Ruff', days(2))] },
  // QA-24: nothing new, the inbox unchanged.
  { name: 'qa24-nothing-new', body: QA22.body, recorded: [...QA22.recorded, 'ruff', "sabine's gull"], point: DAVIS, radiusMi: 10,
    place: { kind: 'nearby' }, nowIso: NOW_ISO, checkId: ID(700), ids: [], rows: [row(ID(7), 'ruff', 'Ruff', days(2))] },
  // Under My location, with a radius other than 25.
  { name: 'near-you', body: CANDIDATE_CASES[2]!.body, recorded: ['mallard'], point: { lat: 38.53, lng: -121.76 }, radiusMi: 7,
    place: { kind: 'near-you' }, nowIso: NOW_ISO, checkId: ID(800), ids: [ID(801), ID(802), ID(803), ID(804)], rows: [] },
]

// ── evict ─────────────────────────────────────────────────────────────────────

function manyRows(n: number, startDaysAgo: number): InboxRow[] {
  const out: InboxRow[] = []
  for (let i = 0; i < n; i++) {
    const at = new Date(T - startDaysAgo * 86_400_000 + i * 60_000).toISOString().slice(0, 19) + 'Z'
    out.push(row(ID(10_000 + i), `sp${String(i).padStart(4, '0')}`, `Species ${i}`, at))
  }
  return out
}

export const EVICT_CASES: { name: string; nowIso: string; rows: InboxRow[] }[] = [
  // QA-38: row 201 evicts the oldest by alerted time.
  { name: 'row-201-evicts-oldest', nowIso: NOW_ISO, rows: manyRows(201, 5) },
  // QA-38: a row 31 days old is removed; 29 days stays; exactly 30 goes.
  { name: 'retention', nowIso: NOW_ISO, rows: [
    row(ID(1), 'ruff', 'Ruff', days(31)), row(ID(2), 'sabgul', "Sabine's Gull", days(29)),
    row(ID(3), 'bawsan', "Baird's Sandpiper", days(30)),
  ] },
  // A time more than 24 hours ahead is implausible (security review L4): an
  // alerted time exactly 24 h ahead stays, one second past goes, and so does
  // a row whose UPDATED time is past it.
  { name: 'future-skew', nowIso: NOW_ISO, rows: [
    row(ID(1), 'ruff', 'Ruff', ahead(24 * 3600)), row(ID(2), 'sabgul', "Sabine's Gull", ahead(24 * 3600 + 1)),
    row(ID(3), 'bawsan', "Baird's Sandpiper", days(1), { updatedAt: ahead(25 * 3600) }),
    row(ID(4), 'pecsan', 'Pectoral Sandpiper', days(1), { updatedAt: ahead(3600) }),
  ] },
  // Ties: the same alerted time orders by species code, then id.
  { name: 'ties', nowIso: NOW_ISO, rows: [
    row(ID(3), 'ruff', 'Ruff', days(1)), row(ID(1), 'bawsan', "Baird's Sandpiper", days(1)),
    row(ID(2), 'ruff', 'Ruff', days(1)), row(ID(4), 'aaa1', 'Aaa', days(2)),
  ] },
]

// ── quiet hours ───────────────────────────────────────────────────────────────

/** QA-33's instants and more, as [minute, start, end]. */
export const QUIET_ROWS: [number, number, number][] = [
  [23 * 60 + 30, 1320, 420], [6 * 60 + 59, 1320, 420], [7 * 60, 1320, 420], [21 * 60, 1320, 420],
  [22 * 60, 1320, 420], [0, 1320, 420], [1439, 1320, 420],
  [13 * 60, 12 * 60, 14 * 60], [14 * 60, 12 * 60, 14 * 60], [11 * 60 + 59, 12 * 60, 14 * 60],
  [0, 600, 600], [600, 600, 600], [1439, 600, 600],
]

/** windowEnd: [tz, nowIso, endMin]. */
export const WINDOW_END_ROWS: [string, string, number][] = [
  [TZ, '2026-09-30T06:30:00Z', 420],   // 23:30 local -> 07:00 the next morning
  [TZ, '2026-09-30T13:59:59Z', 420],   // 06:59:59 local -> 07:00 the same morning
  [TZ, '2026-09-30T14:00:00Z', 420],   // exactly 07:00 local -> the next morning
  [TZ, '2027-03-14T06:00:00Z', 420],   // 22:00 PST on the night of spring-forward -> 07:00 PDT
  [TZ, '2026-11-01T05:30:00Z', 420],   // 22:30 PDT on the night of fall-back -> 07:00 PST
  [TZ, '2026-12-31T08:00:00Z', 1439],  // 00:00 local -> 23:59 the same day
  ['Europe/London', '2027-03-27T23:00:00Z', 420],
  ['Asia/Kolkata', '2026-09-30T17:00:00Z', 420],
  ['Australia/Lord_Howe', '2026-10-03T12:00:00Z', 420],
]

// ── merge ─────────────────────────────────────────────────────────────────────

function ph(speciesCode: string, comName: string, distanceMi: number, locId = 'L1'): PendingHit {
  return { speciesCode, comName, locId, distanceMi, link: `snowraven://map/lifers?window=day` }
}

export const MERGE_CASES: { name: string; pending: PendingSummary | null; hits: PendingHit[]; first: { windowEndAt: string; place: PlacePhrase }; checkId: string }[] = [
  // QA-34: 2 and 3 hits in one window become one summary of 5.
  { name: 'qa34-two-then-three', pending: {
      windowEndAt: '2026-10-01T14:00:00Z', place: NAMED_PLACE, checkIds: [ID(1)],
      hits: [ph('ruff', 'Ruff', 5.9), ph('sabgul', "Sabine's Gull", 13.4)] },
    hits: [ph('bawsan', "Baird's Sandpiper", 2.1), ph('pecsan', 'Pectoral Sandpiper', 8.0), ph('brwhaw', 'Broad-winged Hawk', 20.2)],
    first: { windowEndAt: '2026-10-02T14:00:00Z', place: { kind: 'nearby' } }, checkId: ID(2) },
  // A species in both checks is kept once, at the nearer sighting.
  { name: 'same-species-nearer-wins', pending: {
      windowEndAt: '2026-10-01T14:00:00Z', place: NAMED_PLACE, checkIds: [ID(1)],
      hits: [ph('ruff', 'Ruff', 5.9, 'L1')] },
    hits: [ph('ruff', 'Ruff', 3.2, 'L2'), ph('sabgul', "Sabine's Gull", 13.4)],
    first: { windowEndAt: '2026-10-01T14:00:00Z', place: NAMED_PLACE }, checkId: ID(2) },
  // The first deferred check creates the summary with its own window end.
  { name: 'first-deferral', pending: null, hits: [ph('ruff', 'Ruff', 5.9)],
    first: { windowEndAt: '2026-10-01T14:00:00Z', place: { kind: 'near-you' } }, checkId: ID(3) },
]

// ── notification ──────────────────────────────────────────────────────────────

export const NOTIFICATION_CASES: { count: number; phrase: PlacePhrase; names: string[] }[] = [
  { count: 1, phrase: NAMED_PLACE, names: ['Ruff'] },
  { count: 3, phrase: NAMED_PLACE, names: ["Sabine's Gull", 'Ruff', "Baird's Sandpiper"] },
  { count: 5, phrase: NAMED_PLACE, names: ["Sabine's Gull", 'Ruff', "Baird's Sandpiper", 'Pectoral Sandpiper', 'Broad-winged Hawk'] },
  { count: 1, phrase: { kind: 'near-you' }, names: ['Swan Goose'] },
  { count: 2, phrase: { kind: 'nearby' }, names: ['Ruff', "Rüppell's Warbler"] },
  { count: 4, phrase: { kind: 'name', name: 'Yolo Bypass Wildlife Area, Yolo County, California, United States' },
    names: ['Olive-sided Flycatcher (Western) x Greater Pewee (a very long display name kept whole)', 'Ruff', 'Ruff', 'Ruff'] },
]

// ── links ─────────────────────────────────────────────────────────────────────

export const LINK_CASES: { bird: { speciesCode: string; locId: string }; point: { lat: number; lng: number }; radiusMi: number; show: 'all' | 'one' }[] = [
  { bird: { speciesCode: 'ruff', locId: 'L1000001' }, point: DAVIS, radiusMi: 25, show: 'all' },
  { bird: { speciesCode: 'sabgul', locId: 'L1000004' }, point: DAVIS, radiusMi: 1, show: 'one' },
  // The longest instance (schema 5.1: 117 characters).
  { bird: { speciesCode: 'abcdefghijklmnop', locId: 'L123456789012345' }, point: { lat: -12.345671, lng: -123.456784 }, radiusMi: 25, show: 'all' },
  { bird: { speciesCode: 'ruff', locId: 'L1' }, point: { lat: 90, lng: -180 }, radiusMi: 10, show: 'one' },
  { bird: { speciesCode: 'ruff', locId: 'L1' }, point: { lat: -0.000001, lng: 0.000004 }, radiusMi: 5, show: 'all' },
  // JavaScript toFixed's tie rule at the fifth decimal (the Swift JSNumber twin).
  { bird: { speciesCode: 'ruff', locId: 'L1' }, point: { lat: 38.123455, lng: -121.000005 }, radiusMi: 5, show: 'all' },
  // DEGRADE rows: the view link.
  { bird: { speciesCode: 'ruff', locId: '' }, point: DAVIS, radiusMi: 25, show: 'all' },
  { bird: { speciesCode: 'Ruff', locId: 'L1' }, point: DAVIS, radiusMi: 25, show: 'all' },
  { bird: { speciesCode: 'ruff', locId: 'L1' }, point: DAVIS, radiusMi: 26, show: 'all' },
  { bird: { speciesCode: 'ruff', locId: 'L1' }, point: DAVIS, radiusMi: 0, show: 'one' },
  { bird: { speciesCode: 'ruff', locId: 'L1' }, point: { lat: 91, lng: 0 }, radiusMi: 5, show: 'all' },
  { bird: { speciesCode: 'ruff', locId: 'L1234567890123456' }, point: DAVIS, radiusMi: 5, show: 'all' },
]

// ── retry-after (the pacing contract's table, plus the absent header) ─────────

export const RETRY_AFTER_ROWS: (string | null)[] = [null, '', '0', '1', '30', '60', '61', '999', '1000', '-1', '1.5', ' 5', '5 ', 'Wed, 21 Oct 2026 07:28:00 GMT', '٣']

// ── outcome ───────────────────────────────────────────────────────────────────

export const OUTCOME_ROWS: { name: string; fetch: { kind: 'ok'; body: unknown } | { kind: 'status'; code: number; retryAfter: string | null } | { kind: 'offline' } | { kind: 'timeout' } | { kind: 'tooLarge' } }[] = [
  { name: 'ok-array', fetch: { kind: 'ok', body: [] } },
  { name: 'ok-object-malformed', fetch: { kind: 'ok', body: { error: 'x' } } },
  { name: 'ok-null-malformed', fetch: { kind: 'ok', body: null } },
  { name: '429-with-header', fetch: { kind: 'status', code: 429, retryAfter: '30' } },
  { name: '429-no-header', fetch: { kind: 'status', code: 429, retryAfter: null } },
  { name: '401', fetch: { kind: 'status', code: 401, retryAfter: null } },
  { name: '403', fetch: { kind: 'status', code: 403, retryAfter: null } },
  { name: '500', fetch: { kind: 'status', code: 500, retryAfter: null } },
  { name: '302', fetch: { kind: 'status', code: 302, retryAfter: null } },
  { name: 'offline', fetch: { kind: 'offline' } },
  { name: 'timeout', fetch: { kind: 'timeout' } },
  { name: 'too-large', fetch: { kind: 'tooLarge' } },
]

// ── the point and the preconditions ──────────────────────────────────────────

const HOURS = (h: number) => T - h * 3_600_000
const HANDOVER = { hasKey: true, hasBackup: true, defaultLocation: { lat: 38.5446, lng: -121.7405 } }

export const RESOLVE_CASES: { name: string; inputs: {
  model: 'fixed' | 'my-location'; fixedPlace: { lat: number; lng: number; name: string | null } | null
  handover: { hasKey: boolean; hasBackup: boolean; defaultLocation: { lat: number; lng: number } | null } | null
  position: { lat: number; lng: number; atMs: number } | null
  widgetCell: { lat: number; lng: number; atMs: number; source: 'device' | 'default-location' | null } | null
  location: 'not-determined' | 'granted' | 'denied' | 'restricted'
} }[] = [
  { name: 'fixed-named', inputs: { model: 'fixed', fixedPlace: { lat: 38.5449, lng: -121.7405, name: 'Davis, CA' }, handover: HANDOVER, position: null, widgetCell: null, location: 'not-determined' } },
  { name: 'fixed-coords', inputs: { model: 'fixed', fixedPlace: { lat: 38.5449, lng: -121.7405, name: null }, handover: HANDOVER, position: null, widgetCell: null, location: 'not-determined' } },
  { name: 'fixed-follows-default', inputs: { model: 'fixed', fixedPlace: null, handover: HANDOVER, position: null, widgetCell: null, location: 'not-determined' } },
  { name: 'fixed-nothing', inputs: { model: 'fixed', fixedPlace: null, handover: { ...HANDOVER, defaultLocation: null }, position: null, widgetCell: null, location: 'granted' } },
  { name: 'no-handover', inputs: { model: 'fixed', fixedPlace: { lat: 1, lng: 1, name: null }, handover: null, position: null, widgetCell: null, location: 'granted' } },
  { name: 'no-key', inputs: { model: 'fixed', fixedPlace: { lat: 1, lng: 1, name: null }, handover: { ...HANDOVER, hasKey: false }, position: null, widgetCell: null, location: 'granted' } },
  { name: 'no-backup', inputs: { model: 'fixed', fixedPlace: null, handover: { ...HANDOVER, hasBackup: false, defaultLocation: null }, position: null, widgetCell: null, location: 'granted' } },
  // QA-16: 23 h is used, 25 h is unavailable.
  { name: 'my-23h', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: 38.6, lng: -121.5, atMs: HOURS(23) }, widgetCell: null, location: 'granted' } },
  { name: 'my-25h-falls-back', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: 38.6, lng: -121.5, atMs: HOURS(25) }, widgetCell: null, location: 'granted' } },
  { name: 'my-25h-no-fixed', inputs: { model: 'my-location', fixedPlace: null, handover: { ...HANDOVER, defaultLocation: null }, position: { lat: 38.6, lng: -121.5, atMs: HOURS(25) }, widgetCell: null, location: 'granted' } },
  { name: 'my-widget-cell-newer', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: 38.6, lng: -121.5, atMs: HOURS(5) }, widgetCell: { lat: 38.61, lng: -121.52, atMs: HOURS(1), source: 'device' }, location: 'granted' } },
  { name: 'my-own-position-newer', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: 38.6, lng: -121.5, atMs: HOURS(1) }, widgetCell: { lat: 38.61, lng: -121.52, atMs: HOURS(5), source: 'device' }, location: 'granted' } },
  { name: 'my-tie-prefers-own', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: 38.6, lng: -121.5, atMs: HOURS(2) }, widgetCell: { lat: 38.61, lng: -121.52, atMs: HOURS(2), source: 'device' }, location: 'granted' } },
  // Security review L4: a cell stamped more than 24 h ahead is never used (it
  // would otherwise win "newest"); exactly 24 h ahead still is.
  { name: 'my-cell-25h-ahead-ignored', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: 38.6, lng: -121.5, atMs: HOURS(5) }, widgetCell: { lat: 38.61, lng: -121.52, atMs: HOURS(-25), source: 'device' }, location: 'granted' } },
  { name: 'my-cell-24h-ahead-used', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: 38.6, lng: -121.5, atMs: HOURS(5) }, widgetCell: { lat: 38.61, lng: -121.52, atMs: HOURS(-24), source: 'device' }, location: 'granted' } },
  // Security review L7: a widget cell is "My location" only when the widget
  // marked it as read from the device. The probe's scenario: a hand-set fixed
  // place, no own position, and the newest source a cell 10 minutes old.
  { name: 'my-cell-device-used', inputs: { model: 'my-location', fixedPlace: { lat: 40, lng: -120, name: null }, handover: HANDOVER, position: null, widgetCell: { lat: 38.54, lng: -121.74, atMs: HOURS(1 / 6), source: 'device' }, location: 'granted' } },
  { name: 'my-cell-default-location-ignored', inputs: { model: 'my-location', fixedPlace: { lat: 40, lng: -120, name: null }, handover: HANDOVER, position: null, widgetCell: { lat: 38.54, lng: -121.74, atMs: HOURS(1 / 6), source: 'default-location' }, location: 'granted' } },
  { name: 'my-cell-unmarked-legacy-ignored', inputs: { model: 'my-location', fixedPlace: { lat: 40, lng: -120, name: null }, handover: HANDOVER, position: null, widgetCell: { lat: 38.54, lng: -121.74, atMs: HOURS(1 / 6), source: null }, location: 'granted' } },
  // An ignored cell falls through to the app's own position when it has one,
  // even an older one; with neither and no place, no-position.
  { name: 'my-cell-default-location-own-position-used', inputs: { model: 'my-location', fixedPlace: { lat: 40, lng: -120, name: null }, handover: HANDOVER, position: { lat: 38.6, lng: -121.5, atMs: HOURS(5) }, widgetCell: { lat: 38.54, lng: -121.74, atMs: HOURS(1 / 6), source: 'default-location' }, location: 'granted' } },
  { name: 'my-cell-unmarked-no-place', inputs: { model: 'my-location', fixedPlace: null, handover: { ...HANDOVER, defaultLocation: null }, position: null, widgetCell: { lat: 38.54, lng: -121.74, atMs: HOURS(1 / 6), source: null }, location: 'granted' } },
  // Security review L6: My location measures from a point rounded to two
  // decimals; a tie rounds AWAY from zero on both signs (-0.125 and -121.125
  // are exact binary halves, where Math.round alone would round toward zero).
  { name: 'my-position-approximated', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: 38.61234567, lng: -121.51234567, atMs: HOURS(1) }, widgetCell: null, location: 'granted' } },
  { name: 'my-position-ties-away-from-zero', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: -0.125, lng: -121.125, atMs: HOURS(1) }, widgetCell: null, location: 'granted' } },
  { name: 'my-position-positive-tie', inputs: { model: 'my-location', fixedPlace: null, handover: HANDOVER, position: { lat: 38.125, lng: 121.375, atMs: HOURS(1) }, widgetCell: null, location: 'granted' } },
  // QA-15: denied with a fixed place measures from it; without one, location-off.
  { name: 'my-denied-fixed', inputs: { model: 'my-location', fixedPlace: { lat: 38.5449, lng: -121.7405, name: 'Davis, CA' }, handover: HANDOVER, position: { lat: 38.6, lng: -121.5, atMs: HOURS(1) }, widgetCell: null, location: 'denied' } },
  { name: 'my-denied-nothing', inputs: { model: 'my-location', fixedPlace: null, handover: { ...HANDOVER, defaultLocation: null }, position: { lat: 38.6, lng: -121.5, atMs: HOURS(1) }, widgetCell: null, location: 'denied' } },
  { name: 'my-restricted-nothing', inputs: { model: 'my-location', fixedPlace: null, handover: { ...HANDOVER, defaultLocation: null }, position: null, widgetCell: null, location: 'restricted' } },
  { name: 'my-nothing-known', inputs: { model: 'my-location', fixedPlace: null, handover: { ...HANDOVER, defaultLocation: null }, position: null, widgetCell: null, location: 'granted' } },
]

// ── countability ──────────────────────────────────────────────────────────────

export const COUNTABILITY_SHAPES: string[] = [
  'gull sp.', 'Greater/Lesser Scaup', 'Mallard x American Black Duck (hybrid)',
  "Yellow-rumped Warbler (Myrtle x Audubon's)", 'Domestic goose sp. (Domestic type)', 'Ruff', "Rüppell's Warbler",
  'Canada Goose (moffitti/maxima)', 'Brewster\'s Warbler (hybrid)', 'sp.', ' sp.', 'x', ' x ', 'a x b', 'a x b (c)', '(a x b)',
  'Gull sp. ', 'gull sp.\n', 'Accipitrine hawk sp. (former Accipiter sp.)', '',
]

/** Synthetic exception lists with non-ASCII names (the artifact holds none). */
export const SYNTHETIC_LISTS = {
  counts: ['Grünling sp.', 'Ölgänse/Äsche', 'Plain'],
  rejects: ['Kiebitz (Hausform)', 'Rüppell\'s Warbler', 'x'],
  names: ['Grünling sp.', 'Grunling sp.', 'Ölgänse/Äsche', 'Kiebitz (Hausform)', "Rüppell's Warbler", "Ruppell's Warbler", 'x', 'Plain', 'Plain sp.'],
}

/** The single-position-edit corpus: every replace, insert and delete of one
 *  UTF-16 unit over this alphabet (printable ASCII plus one non-ASCII letter:
 *  96 units), applied to this base, in this order. Both runtimes build it. */
export const CORPUS_BASE = "Yellow-rumped Warbler (Myrtle x Audubon's)"
export const CORPUS_ALPHABET: string = (() => {
  let a = ''
  for (let c = 0x20; c <= 0x7e; c++) a += String.fromCharCode(c)
  return a + 'é'
})()

export function corpusNames(base: string = CORPUS_BASE, alphabet: string = CORPUS_ALPHABET): string[] {
  const out: string[] = []
  for (let i = 0; i < base.length; i++) {
    for (const c of alphabet) out.push(base.slice(0, i) + c + base.slice(i + 1))
  }
  for (let i = 0; i <= base.length; i++) {
    for (const c of alphabet) out.push(base.slice(0, i) + c + base.slice(i))
  }
  for (let i = 0; i < base.length; i++) out.push(base.slice(0, i) + base.slice(i + 1))
  return out
}
