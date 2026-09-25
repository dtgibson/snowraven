// The /map/recent-obs reducer, extracted verbatim from lib/tauri/mapService.ts
// (ios-lifer-widgets, schema.md section 7.1) so the desktop transport and the
// widget's TypeScript twin (lib/widgets/widgetRows.ts) call ONE function
// rather than two copies that could drift. Behavior-preserving: the
// transport's own suite (tauri/mapService.recentObs.test.ts) stays green over
// the move, and backend/routers/map.py get_recent_obs remains its Python twin.
//
// One record per (speciesCode, locId): the FIRST record seen for a pair
// supplies its fields, and a later record with a strictly greater `obsDt`
// (plain string comparison, chronological for eBird's `YYYY-MM-DD HH:mm`)
// replaces the pair's date and `subId`. Records missing numeric coordinates
// are skipped so nothing plots at 0,0. `codes` is OPTIONAL: empty means every
// species in the radius (Nearby Lifers); a comma list filters to those species
// codes (Media Targets).

export interface RecentObs {
  speciesCode: string
  comName: string
  locId: string
  locName: string
  lat: number
  lng: number
  recentDate: string
  checklistCount: number
  subId: string
}

export function reduceRecentObs(observations: ReadonlyArray<Record<string, unknown>>, codes = ''): RecentObs[] {
  const codeSet = new Set(codes.split(',').map(c => c.trim()).filter(Boolean))
  const groups = new Map<string, RecentObs>()
  for (const obs of observations) {
    const code = (obs['speciesCode'] as string) ?? ''
    if (codeSet.size > 0 && !codeSet.has(code)) continue
    // Skip records missing numeric coordinates (the lifers path maps by coord;
    // a coordinate-less obs would otherwise plot at 0,0).
    const recLat = obs['lat']
    const recLng = obs['lng']
    if (typeof recLat !== 'number' || typeof recLng !== 'number'
        || Number.isNaN(recLat) || Number.isNaN(recLng)) continue
    const locId = (obs['locId'] as string) ?? ''
    const groupKey = `${code}|${locId}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        speciesCode: code,
        comName: (obs['comName'] as string) ?? '',
        locId,
        locName: (obs['locName'] as string) ?? '',
        lat: recLat,
        lng: recLng,
        recentDate: (obs['obsDt'] as string) ?? '',
        checklistCount: 0,
        subId: (obs['subId'] as string) ?? '',
      })
    }
    const entry = groups.get(groupKey)!
    entry.checklistCount += 1
    const currentDate = (obs['obsDt'] as string) ?? ''
    if (currentDate > entry.recentDate) {
      entry.recentDate = currentDate
      entry.subId = (obs['subId'] as string) ?? ''
    }
  }
  return [...groups.values()]
}
