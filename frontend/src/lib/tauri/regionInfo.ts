// Shared, short-TTL-memoized eBird region-info lookup (ref/region/info/{locId}).
// Both the weather and checklist services resolve the same locIds — often the
// same one repeatedly (e.g. re-checking a checklist) — so the lookup rides the
// networkCache keyed by locId. Failures throw (and are therefore never cached);
// callers treat the lookup as best-effort.

import { tauriFetch } from './http'
import { cachedGet } from '../networkCache'

const EBIRD_BASE = 'https://api.ebird.org/v2'

export interface RegionInfo {
  /** Human-readable place name ('' when eBird has none). */
  name: string
  /** Bounding-box centre, when eBird supplies bounds. */
  lat: number | null
  lng: number | null
}

export function getRegionInfo(locId: string, ebirdKey: string): Promise<RegionInfo> {
  return cachedGet(`region-info:${locId}`, async () => {
    const res = await tauriFetch(`${EBIRD_BASE}/ref/region/info/${locId}`, {
      headers: { 'X-eBirdApiToken': ebirdKey },
    })
    if (!res.ok) throw Object.assign(new Error(`Region info unavailable for ${locId}.`), { status: 502 })
    const data = await res.json() as { result?: string; name?: string; bounds?: Record<string, number> }
    const b = data.bounds ?? {}
    const hasBounds = 'minX' in b && 'maxX' in b && 'minY' in b && 'maxY' in b
    return {
      name: data.result || data.name || '',
      lat: hasBounds ? (b['minY'] + b['maxY']) / 2 : null,
      lng: hasBounds ? (b['minX'] + b['maxX']) / 2 : null,
    }
  })
}
