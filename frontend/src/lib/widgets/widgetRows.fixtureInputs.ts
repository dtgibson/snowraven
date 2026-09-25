// HAND-AUTHORED INPUTS for the widget parity fixture (ios-lifer-widgets,
// schema.md section 7.2). Only inputs live here; every expected output in
// widgetRows.fixture.json is GENERATED from these by the shipped TypeScript
// twin (widgetRows.fixtureGen.test.ts), never written by hand (testing.md
// v1.0.29: a hand-written expected document encodes the author's model, which
// is the model that wrote the bug).
//
// Not a test file and never imported by shipped code: only the generator and
// widgetRows.parity.test.ts import it.
//
// The body is shaped exactly as eBird's data/obs/geo/recent returns it. The
// symmetric pairs sit at the reference latitude with longitudes the reference
// +/- an exactly representable offset (1/8, 1/4, 3/8 of a degree), so the two
// haversine inputs differ only in the sign of dLng and the distances are
// bit-identical in both runtimes; the tie-breaks are then what the row order
// asserts. A plain decimal offset such as 0.1 is NOT symmetric in binary
// (-121.9 - -122.0 and -122.1 - -122.0 differ in their last bits).

export const TZ = 'America/Los_Angeles'
/** Local 05:00 on 2026-09-24 in Los Angeles, and the same calendar date in
 *  every zone from UTC-12 to UTC+11, so the app-side parity rows (which run in
 *  the test process's own zone) agree with the fixture's zone on today. */
export const NOW_ISO = '2026-09-24T12:00:00Z'
export const REFERENCE = { lat: 37.4, lng: -122.0 }
export const APP_VERSION = '0.0.0-fixture'

/** Common names as the eBird backup carries them (one row each is enough:
 *  the recorded set is distinct names, and the target sets are per raw name). */
export const OBSERVATIONS: { commonName: string }[] = [
  { commonName: 'Mallard' },
  { commonName: 'Northern Shrike' },
  { commonName: 'American Robin' },
  { commonName: "Hutton's Vireo" },
  { commonName: 'Oak Titmouse' },
  { commonName: 'Wrentit' },
  { commonName: 'California Thrasher' },
  { commonName: "Nuttall's Woodpecker" },
  { commonName: 'Yellow-billed Magpie' },
  { commonName: "Bell's Sparrow" },
  { commonName: 'Acorn Woodpecker' },
]

/** Macaulay rows: which media each recorded species HOLDS. Hutton's Vireo
 *  holds none (missing all three); the next six hold each single type and
 *  each pair; Acorn Woodpecker and the three others hold all three. */
export const ML_ROWS: { commonName: string; format: 'Photo' | 'Audio' | 'Video' }[] = [
  { commonName: 'Oak Titmouse', format: 'Photo' },
  { commonName: 'Wrentit', format: 'Audio' },
  { commonName: 'California Thrasher', format: 'Video' },
  { commonName: "Nuttall's Woodpecker", format: 'Photo' },
  { commonName: "Nuttall's Woodpecker", format: 'Audio' },
  { commonName: 'Yellow-billed Magpie', format: 'Photo' },
  { commonName: 'Yellow-billed Magpie', format: 'Video' },
  { commonName: "Bell's Sparrow", format: 'Audio' },
  { commonName: "Bell's Sparrow", format: 'Video' },
  ...(['Acorn Woodpecker', 'Mallard', 'Northern Shrike', 'American Robin'] as const).flatMap(commonName =>
    (['Photo', 'Audio', 'Video'] as const).map(format => ({ commonName, format }))),
]

const rec = (
  speciesCode: string | undefined, comName: string, locId: string, locName: string,
  lat: unknown, lng: unknown, obsDt: string, subId: string,
): Record<string, unknown> => {
  const r: Record<string, unknown> = {
    comName, sciName: 'Fixture fixture', locId, locName, obsDt, howMany: 1,
    obsValid: true, obsReviewed: false, locationPrivate: false, subId,
  }
  if (speciesCode !== undefined) r.speciesCode = speciesCode
  if (lat !== undefined) r.lat = lat
  if (lng !== undefined) r.lng = lng
  return r
}

export const BODY: Record<string, unknown>[] = [
  // Same species, same location, two reports: the pair keeps the later date and its subId.
  rec('ruff', 'Ruff', 'L1001', 'Coyote Hills Regional Park', 37.45, -122.05, '2026-09-24 05:00', 'S1001'),
  rec('ruff', 'Ruff', 'L1001', 'Coyote Hills Regional Park', 37.45, -122.05, '2026-09-24 06:10', 'S1002'),
  // Two locations: the nearer wins even though the farther is more recent.
  rec('trokin', 'Tropical Kingbird', 'L1002', 'Alameda Point', 37.43, -122.02, '2026-09-23 08:00', 'S1003'),
  rec('trokin', 'Tropical Kingbird', 'L1003', 'Lake Merced', 37.55, -122.2, '2026-09-24 07:00', 'S1004'),
  // Two species at bit-identical distance: the more recent report orders first.
  rec('baisan', "Baird's Sandpiper", 'L1004', 'Hayward Regional Shoreline', 37.4, -121.875, '2026-09-22 09:00', 'S1005'),
  rec('pecsan', 'Pectoral Sandpiper', 'L1005', 'Don Edwards NWR, Alviso', 37.4, -122.125, '2026-09-23 10:30', 'S1006'),
  // Two species at one place and one time, names that sort differently with
  // and without case: case-insensitive order puts "black Tern" before "Brant".
  rec('blkter', 'black Tern', 'L1006', 'Charleston Slough', 37.3, -122.1, '2026-09-21 16:00', 'S1007'),
  rec('brant', 'Brant', 'L1006', 'Charleston Slough', 37.3, -122.1, '2026-09-21 16:00', 'S1007'),
  // A non-ASCII name.
  rec('ruegri1', "Rüppell's Griffon", 'L1007', 'Palo Alto Baylands', 37.46, -122.1, '2026-09-20 11:15', 'S1008'),
  // A non-countable form and an escapee, not recorded: listed on both sides (FR-14).
  rec('gull', 'gull sp.', 'L1008', 'Shoreline Lake', 37.43, -122.09, '2026-09-19 17:40', 'S1009'),
  rec('mandar', 'Mandarin Duck', 'L1009', 'Vasona Lake', 37.4, -121.75, '2026-09-18 08:20', 'S1010'),
  // Same species at bit-identical distance: the more recent location wins.
  rec('mandar', 'Mandarin Duck', 'L1010', 'Lake Cunningham', 37.4, -122.25, '2026-09-15 09:00', 'S1011'),
  // Exactly 7 days old, at two locations tied on distance AND date: the smaller locId wins.
  rec('bkpwar', 'Blackpoll Warbler', 'L1012', 'Golden Gate Park, Middle Lake', 37.4, -121.625, '2026-09-17 07:00', 'S1012'),
  rec('bkpwar', 'Blackpoll Warbler', 'L1011', 'Rancho San Antonio', 37.4, -122.375, '2026-09-17 07:00', 'S1013'),
  // 8 days old: in 30 days, out of Week.
  rec('prowar', 'Prothonotary Warbler', 'L1013', 'Lake Merritt', 37.35, -121.95, '2026-09-16 09:30', 'S1014'),
  // 29 days old: only in 30 days.
  rec('sabgul', "Sabine's Gull", 'L1014', 'Pillar Point Harbor', 37.5, -122.15, '2026-08-26 12:00', 'S1015'),
  // An impossible date: the widget drops it; the app keeps it under 30 days (declared).
  rec('bubsan', 'Buff-breasted Sandpiper', 'L1015', 'Bolinas Lagoon', 37.41, -122.01, '2026-02-30 10:00', 'S1016'),
  // No coordinates, and a non-numeric latitude: skipped on both sides.
  rec('rensti', 'Red-necked Stint', 'L1016', 'Alviso Marina', undefined, undefined, '2026-09-24 08:00', 'S1017'),
  rec('litsti', 'Little Stint', 'L1017', 'Moffett Bay', '37.42', -122.03, '2026-09-24 08:30', 'S1018'),
  // No species code: the widget drops it; the app would plot it (declared).
  rec(undefined, 'Curlew Sandpiper', 'L1018', 'Ravenswood', 37.44, -122.06, '2026-09-24 09:00', 'S1019'),
  // A trailing parenthetical form whose parent is recorded, and a mixed-case
  // name: both subtracted.
  rec('mallar2', 'Mallard (Domestic type)', 'L1019', 'Stevens Creek', 37.39, -122.07, '2026-09-24 07:30', 'S1020'),
  rec('norshr', 'NORTHERN SHRIKE', 'L1020', 'Sunnyvale Baylands', 37.42, -122.0, '2026-09-23 12:00', 'S1021'),
  // The eight media cases, all recorded (so none is a lifer).
  rec('hutvir', "Hutton's Vireo", 'L1021', 'Joseph D. Grant County Park', 37.34, -121.72, '2026-09-24 08:00', 'S1022'),
  rec('oaktit', 'Oak Titmouse', 'L1022', 'Coyote Creek Trail', 37.3, -121.85, '2026-09-23 09:00', 'S1023'),
  rec('wrenti', 'Wrentit', 'L1023', 'Sunol Regional Wilderness', 37.52, -121.83, '2026-09-22 07:45', 'S1024'),
  rec('calthr', 'California Thrasher', 'L1024', 'Ed R. Levin County Park', 37.45, -121.86, '2026-09-20 08:10', 'S1025'),
  rec('nutwoo', "Nuttall's Woodpecker", 'L1025', 'Alum Rock Park', 37.4, -121.8, '2026-09-19 10:00', 'S1026'),
  rec('yebmag', 'Yellow-billed Magpie', 'L1026', 'Mount Hamilton Road', 37.35, -121.7, '2026-09-17 11:00', 'S1027'),
  rec('belspa', "Bell's Sparrow", 'L1027', 'Henry W. Coe State Park', 37.2, -121.55, '2026-09-16 07:00', 'S1028'),
  rec('acowoo', 'Acorn Woodpecker', 'L1028', 'Calero County Park', 37.18, -121.78, '2026-09-24 09:15', 'S1029'),
]

/** Coordinate pairs for the distance rule, and one-decimal display rows. The
 *  exact binary ties (0.25, 1.25, 3.25) are where `toFixed` rounds up and C's
 *  `%.1f` rounds to even; the Swift formatter must follow `toFixed`. */
export const DISTANCE_PAIRS = [
  { lat1: 37.4, lng1: -122.0, lat2: 37.4, lng2: -122.0 },
  { lat1: 37.4, lng1: -122.0, lat2: 37.4005, lng2: -122.0 },
  { lat1: 37.4, lng1: -122.0, lat2: 37.45, lng2: -122.05 },
  { lat1: 37.4, lng1: -122.0, lat2: 37.2, lng2: -121.55 },
  { lat1: -33.9, lng1: 151.2, lat2: -33.85, lng2: 151.21 },
  { lat1: 64.84, lng1: -147.72, lat2: 64.9, lng2: -147.5 },
]
export const FORMAT_MILES = [0, 0.04, 0.05, 0.25, 0.75, 1.25, 2.45, 2.75, 3.15, 3.25, 9.95, 24.96]

/** Seeds for the strict date parse. */
export const DATE_SEEDS = [
  '2026-09-24', '2026-09-24 06:10', '2024-02-29', '0000-01-01', '2026-12-31 23:59',
  '2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-09-00', '2026-04-31',
  '2026-09-24T06:10', ' 2026-09-24', '2026-09-24 ', '2026-09-24\n', '2026-9-24', '+2026-09-24',
  '٢٠٢٦-09-24', '2026-09-24 6:10', '', '2026-09-24 06:10:00', '2026/09/24',
]

/** The day after the 2026 US spring-forward transition (Sunday 2026-03-08),
 *  local 05:00 in Los Angeles. The app's floor counts one day short here. */
export const DST_NOW_ISO = '2026-03-09T12:00:00Z'
export const DST_OBS = ['2026-03-08 08:00', '2026-03-02 08:00', '2026-03-01 08:00']

export const RECENCY_DAYS = [-1, 0, 1, 2, 5, 29, 30]

export const FOLD_INPUTS = [
  'Mallard', 'Mallard (Domestic type)', '  Northern Shrike  ', 'NORTHERN SHRIKE', "Rüppell's Griffon",
  "RÜPPELL'S GRIFFON", 'Mallard (Domestic type) (x)', 'A (b (c))', 'Mallard (', '(Domestic type)',
  '', 'Brant ', '﻿Brant', 'Brant\u0085', 'gull sp.', 'Western x Glaucous-winged Gull (hybrid)',
]
