import { useSyncExternalStore } from 'react'
import { getBarChartFilesEpoch, subscribeBarChartFilesChanged } from './barChartFilesChanged'

// React seam over lib/barChartFilesChanged.ts: re-renders the caller whenever a
// county's bar-chart file is added, replaced or removed. Put the returned
// number in the deps of the effect that reads the bar-chart manifest, exactly
// as `useFilesEpoch()` is used for the two data files.
export function useBarChartFilesEpoch(): number {
  return useSyncExternalStore(subscribeBarChartFilesChanged, getBarChartFilesEpoch, getBarChartFilesEpoch)
}
