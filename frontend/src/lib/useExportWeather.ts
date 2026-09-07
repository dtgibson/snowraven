// The Species Detail Weather card's read of the shared seam, SCHEDULED
// (species-detail-weather).
//
// THE SCHEDULING IS PART OF THE REQUIREMENT, NOT A MATTER OF TASTE. The cold
// seam measures 15.67 ms against NFR-01's 20 ms budget -- 1.28x, not the 2x this
// repo's own testing rules call margin. A `useMemo` would meet the budget on the
// development Mac and break it on a Raspberry Pi and on the older iPhones the
// app ships to. So the work runs in an EFFECT, after a real frame has landed, in
// its own task, and never in a render body.
//
// The double `requestAnimationFrame` is the shipped `BirdingStats` gate, for the
// same reason it exists there: the first callback fires BEFORE the pending paint
// and the second AFTER it, so the compute is scheduled for the frame after the
// tab's own content is on screen. The tab therefore paints at exactly the speed
// it does today, and the card arrives a frame later, low on the page.
//
// THE GATE RUNS FIRST AND IS WHAT MAKES THE ABSENT STATE FREE. On an export with
// no attributed weather block `hasAnyWeatherBlock` returns false in 0.732 ms
// worst case and this hook stays at `null` forever -- no aggregate, no card, and
// (because `SpeciesDetail` reaches the card through `lazy`) no card chunk
// fetched at all.
//
// IT RETURNS `null` FOR TWO DIFFERENT REASONS and that is deliberate: "not
// computed yet" and "this export has no weather blocks" both render nothing, so
// the caller needs no third state and cannot accidentally paint a placeholder
// for either.

import { useEffect, useState } from 'react'
import type { ObservationEntry } from '../types'
import {
  hasAnyWeatherBlock, speciesChecklistCountsFor, weatherStatsFor,
} from './weatherStatsShared'
import type { WeatherStats } from './weatherStats'

export interface ExportWeather {
  /** The whole-export aggregate, all-forms variant. */
  stats: WeatherStats
  /** Normalized common name -> distinct submissions the species is on, over the
   *  raw unfiltered parse. Built in the SAME task and off the SAME
   *  observations-identity memo, so a species change is a map read and never a
   *  pass over the export. */
  ownChecklists: ReadonlyMap<string, number>
}

/**
 * @param observations the tab's raw parse. Its IDENTITY is the key: a Settings
 *   re-upload or an iCloud arrival hands back a new array, which is a memo miss
 *   and a recompute, with no epoch arithmetic and no stale window.
 * @param active the tab's readiness gate, so nothing is computed for an export
 *   that has not loaded. The same role `active` plays in `useStatsBundle`.
 */
export function useExportWeather(observations: ObservationEntry[], active: boolean): ExportWeather | null {
  const [read, setRead] = useState<ExportWeather | null>(null)

  useEffect(() => {
    // Deliberate synchronous reset, matching the one `useStatsBundle` and
    // `BirdingStats` both document: when the export identity changes we WANT to
    // drop the previous file's figures for a commit rather than paint them.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRead(null)
    if (!active || observations.length === 0) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!hasAnyWeatherBlock(observations)) return
        setRead({
          stats: weatherStatsFor(observations),
          ownChecklists: speciesChecklistCountsFor(observations),
        })
      })
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [active, observations])

  return read
}
