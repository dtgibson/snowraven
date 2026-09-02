import { useSyncExternalStore } from 'react'
import { getFilesEpoch, subscribeFilesChanged } from './filesChanged'

// React seam over lib/filesChanged.ts: re-renders the caller whenever a stored
// data file is saved, replaced (a manual upload or an iCloud arrival), or
// cleared. Put the returned number in the deps of the effect that loads the
// file, exactly as the prop-threaded `filesVersion` is used today.
export function useFilesEpoch(): number {
  return useSyncExternalStore(subscribeFilesChanged, getFilesEpoch, getFilesEpoch)
}
