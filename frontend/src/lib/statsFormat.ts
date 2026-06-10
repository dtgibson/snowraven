// Pure formatting helpers and slug/URL builders shared by BirdingStats and its
// presentational sub-components. No React, no closures — safe to import anywhere.

export function fmt(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
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

export function mlCatalogUrl(name: string, type: 'Photo' | 'Audio' | 'Video', userId: string | null, taxonCode?: string | null): string {
  const mt = type.toLowerCase()
  const userSuffix = userId ? `&userId=${encodeURIComponent(userId)}` : ''
  if (taxonCode) {
    return `https://search.macaulaylibrary.org/catalog?mediaType=${mt}&taxonCode=${encodeURIComponent(taxonCode)}${userSuffix}`
  }
  return `https://search.macaulaylibrary.org/catalog?taxaName=${encodeURIComponent(name)}&mediaType=${mt}${userSuffix}`
}
