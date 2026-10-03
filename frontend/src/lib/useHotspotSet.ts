import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { loadHotspotSet, isPublicHotspot, subscribeHotspotSet, getHotspotSetEpoch } from './hotspotSet'

const EMPTY: Set<string> = new Set()

/** The user's public-hotspot locId Set plus a bound `isHotspot(locId)` helper.
 *  Parameterless: it loads the parsed backup itself (via the shared observationsCache,
 *  so no extra read/parse) and builds the Set through the region-keyed module cache —
 *  so every tab shares ONE underlying build no matter how many call this. The Set is
 *  empty until the region fetches resolve, so location names render plain until then —
 *  never a speculative link. Call it unconditionally at a tab's top level.
 *
 *  It subscribes to the hotspot-set change epoch (bumped on an eBird file/key change),
 *  so a tab that stays mounted across such a change reloads the Set instead of
 *  showing the previous backup's (or the no-key empty) classification all session.
 *  The same epoch moves when a re-ask of a rate-limited region adds ids
 *  (hotspot-links-retry-after-429), so those links appear on every mounted tab with
 *  no key or file save; the reload is a cache hit on the merged Set. */
export function useHotspotSet(): {
  set: Set<string>
  isHotspot: (locId: string | null | undefined) => boolean
} {
  const epoch = useSyncExternalStore(subscribeHotspotSet, getHotspotSetEpoch, getHotspotSetEpoch)
  const [set, setSet] = useState<Set<string>>(EMPTY)
  useEffect(() => {
    let alive = true
    loadHotspotSet().then(s => { if (alive) setSet(s) }).catch(() => { /* degrade to empty */ })
    return () => { alive = false }
  }, [epoch])
  const isHotspot = useCallback((locId: string | null | undefined) => isPublicHotspot(locId, set), [set])
  return { set, isHotspot }
}
