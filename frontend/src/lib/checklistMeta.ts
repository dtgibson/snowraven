// Formatting + labels for eBird checklist effort/provenance metadata, used by the
// checklist comparer. Pure and dependency-free so it can be unit-tested.

// eBird protocol IDs → short display names (matches the eBird checklist page).
// Derived from the eBird backup's Protocol column for the common ones; the rest
// are the well-known eBird protocols. Unknown IDs fall back to the raw code.
const PROTOCOL_NAMES: Record<string, string> = {
  P20: 'Incidental',
  P21: 'Stationary',
  P22: 'Traveling',
  P23: 'Area',
  P33: 'Banding',
  P34: 'Nocturnal Flight Call Count',
  P52: 'Oiled Birds',
  P54: 'Heron Area Count',
  P60: 'Pelagic',
  P62: 'Pelagic',
}

// Both tables below are keyed on eBird-SUPPLIED strings, so every lookup goes
// through `Object.hasOwn` (county-shading-and-project-stats, FR-57). A bare
// index on an object literal returns a TRUTHY INHERITED MEMBER for at least
// twelve strings — 'constructor', '__proto__', 'toString', 'valueOf',
// 'hasOwnProperty', 'isPrototypeOf', 'toLocaleString',
// 'propertyIsEnumerable' and the four __define/__lookup accessors — so
// `TABLE[raw] ?? raw` silently returned an inherited member instead of falling
// through to the raw input. Production callers are unaffected for every real
// code; this makes the allowlist visible AT THE POINT OF USE, which a
// null-prototype construction expression would not.
export function protocolName(protocolId: string | null | undefined): string {
  if (!protocolId) return ''
  return Object.hasOwn(PROTOCOL_NAMES, protocolId) ? PROTOCOL_NAMES[protocolId] : protocolId
}

// eBird submission method codes → the app/source shown on the checklist page.
const APP_NAMES: Record<string, string> = {
  EBIRD_iOS: 'eBird iOS',
  EBIRD_Android: 'eBird Android',
  EBIRD_WEB: 'eBird Website',
  EBIRD_WEBSITE: 'eBird Website',
  EBIRD: 'eBird Website',
  EBIRD_API: 'eBird API',
}

export function submissionAppName(code: string | null | undefined): string {
  if (!code) return ''
  // Indexed TWICE before; both reads now go through the same guard.
  if (Object.hasOwn(APP_NAMES, code)) return APP_NAMES[code]
  // Unknown but eBird-prefixed → "eBird Xyz"; otherwise show the raw code.
  if (code.startsWith('EBIRD_')) return 'eBird ' + code.slice('EBIRD_'.length)
  return code
}

/** App name plus its version when known, e.g. "eBird iOS 3.6.5". */
export function submissionLabel(code: string | null | undefined, version: string | null | undefined): string {
  const app = submissionAppName(code)
  if (!app) return ''
  return version ? `${app} ${version}` : app
}

/** Duration in hours → "45 min" / "1 hr" / "1h 20m". Empty for null/zero. */
export function formatDuration(hrs: number | null | undefined): string {
  if (hrs == null) return ''
  const totalMin = Math.round(hrs * 60)
  if (totalMin <= 0) return ''
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m === 0) return `${h} hr`
  return `${h}h ${m}m`
}

const KM_PER_MI = 1.60934

function trimNum(n: number): string {
  // Up to 2 decimals, trailing zeros stripped: 1.14, 2, 0.5.
  return Number(n.toFixed(2)).toString()
}

/**
 * Distance in the unit the observer entered. eBird stores `effortDistanceKm` in km
 * and records the entered unit separately, so convert km→mi when mi was entered
 * (matches what the eBird checklist page shows). Empty for null distance.
 */
export function formatDistance(km: number | null | undefined, unit: string | null | undefined): string {
  if (km == null) return ''
  if (unit === 'mi') return `${trimNum(km / KM_PER_MI)} mi`
  return `${trimNum(km)} km`
}

/** "1 observer" / "3 observers". Empty for null/zero. */
export function formatObservers(n: number | null | undefined): string {
  if (n == null || n <= 0) return ''
  return `${n} observer${n === 1 ? '' : 's'}`
}
