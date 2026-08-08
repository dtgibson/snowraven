// Pure formatting helpers and slug/URL builders shared by BirdingStats and its
// presentational sub-components. No React, no closures — safe to import anywhere.

export function fmt(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

// Whole-number percent share for a legend row, with the zero-collapse fixed:
// a NONZERO count never renders a bare "0%" — a share under half a percent
// reads "<1%" so rare rows stay visibly nonzero (the observer-count legend on
// a 99%-solo dataset). A genuinely zero count (or empty total) is an honest "0%".
export function fmtSharePct(count: number, total: number): string {
  if (total <= 0 || count <= 0) return '0%'
  const pct = Math.round(count / total * 100)
  return pct === 0 ? '<1%' : `${pct}%`
}

export function sectionSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Spell a total duration (minutes) into yr/mo/day/hr/min, largest non-zero units
// only (eBird durations are minute-granular, so seconds never apply).
export function formatDuration(totalMin: number): string {
  let m = Math.round(totalMin)
  const yr = Math.floor(m / 525600); m -= yr * 525600
  const mo = Math.floor(m / 43200); m -= mo * 43200
  const day = Math.floor(m / 1440); m -= day * 1440
  const hr = Math.floor(m / 60); m -= hr * 60
  const parts: string[] = []
  if (yr) parts.push(`${yr} yr${yr !== 1 ? 's' : ''}`)
  if (mo) parts.push(`${mo} mo`)
  if (day) parts.push(`${day} day${day !== 1 ? 's' : ''}`)
  if (hr) parts.push(`${hr} hr${hr !== 1 ? 's' : ''}`)
  if (m) parts.push(`${m} min`)
  return parts.length ? parts.join(', ') : '0 min'
}

// A whole-day span as one round headline unit ("41 days" / "19 months" /
// "2 years" / "2.5 years") — for stat-tile values, where "1 yr, 11 mo, 21 days"
// precision (formatDuration above) would be noise.
export function formatSpanLength(days: number): string {
  if (!Number.isFinite(days) || days < 0) return ''
  if (days < 61) return `${Math.round(days)} day${Math.round(days) !== 1 ? 's' : ''}`
  const months = Math.round(days / 30.44)
  if (months < 24) return `${months} months`
  const halfYears = Math.round(days / 365.25 * 2) / 2
  return Number.isInteger(halfYears) ? `${halfYears} years` : `${halfYears.toFixed(1)} years`
}

// The current Macaulay Library catalog host. The older search.macaulaylibrary.org
// /catalog still resolves but is legacy; the Multimedia tab already builds on this
// host, so the Statistics links use it too (consolidating the two link builders the
// 0.5.33 work had deferred). It is also the host that accepts the `tag=` behavior
// filters (see mlBehaviorCatalogUrl). Exported so mlCatalog.ts (Species Detail) and
// LifeListTable (Multimedia) build on the ONE host with the ONE taxonCode pattern
// (media-catalog-taxon-links consolidation).
export const ML_CATALOG_BASE = 'https://media.ebird.org/catalog'

// Build the user's Macaulay Library catalog link for a species/form, filtered by a
// media type. `taxonCode` is REQUIRED for a correct filter — the caller resolves it by
// normalizing the name before the code lookup (species code), or, when "Show
// subspecies" is on, the form's own issf code. We NEVER fall back to `?taxaName=`: a
// form name there (e.g. "Scaly-breasted Munia (Scaled)") is a malformed filter, and a
// bare link shows ALL the user's media. When no code resolves at all (offline gap /
// unmapped name) we emit no taxon filter rather than a broken one — the caller's
// species code is the universal fallback, so this is the rare last resort.
export function mlCatalogUrl(_name: string, type: 'Photo' | 'Audio' | 'Video', userId: string | null, taxonCode?: string | null): string {
  const mt = type.toLowerCase()
  const userSuffix = userId ? `&userId=${encodeURIComponent(userId)}` : ''
  const taxonPart = taxonCode ? `&taxonCode=${encodeURIComponent(taxonCode)}` : ''
  return `${ML_CATALOG_BASE}?mediaType=${mt}${taxonPart}${userSuffix}`
}

// Deep link to the user's Macaulay Library media filtered by a single behavior (or
// sound-type) tag — e.g. media.ebird.org/catalog?userId=USER123&tag=flying_flight.
// Behaviors aren't per-species here: this is "all my <behavior> media". The caller
// gates on a non-null userId (a behavior link with no user is a meaningless global
// view) and on a known slug (lib/mediaStats behaviorTagSlug).
export function mlBehaviorCatalogUrl(slug: string, userId: string): string {
  return `${ML_CATALOG_BASE}?userId=${encodeURIComponent(userId)}&tag=${encodeURIComponent(slug)}`
}
