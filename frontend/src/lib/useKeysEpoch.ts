import { useSyncExternalStore } from 'react'
import { getKeysEpoch, subscribeKeysChanged } from './keysChanged'

// React seam over lib/keysChanged.ts: re-renders the caller whenever a stored
// API key is saved, replaced (a Settings save or an iCloud arrival), or
// cleared. Put the returned number in the deps of the effect that reads the
// key, exactly as the prop-threaded `keysVersion` is used today.
export function useKeysEpoch(): number {
  return useSyncExternalStore(subscribeKeysChanged, getKeysEpoch, getKeysEpoch)
}
