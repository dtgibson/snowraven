// Key reconciliation (icloud-api-key-sync FR-10, FR-11, FR-13, FR-14, FR-29;
// schema.md "Reconciliation"). Pure and fully tabulated: one input shape in,
// one decision out, no I/O. Controller-only: this file must NOT reach the
// entry graph (entryChunk.test.ts asserts it), which is what proves the
// logic did not leak into Settings.
//
// Actions: `seed` = stamp the local key with now + this device, then upload
// it (FR-13); `push` = upload the local entry (key or marker) as it is;
// `apply` = write the shared key locally with its time and origin (`replaced`
// when a different local key existed, FR-41); `adopt` = keep the local value,
// take the shared entry's time and origin (OQ-3), upload nothing;
// `clear-local` = remove the local key and keep the shared marker locally
// (FR-24, FR-42).
//
// Times compare as numbers (ms, UTC, FR-10). An untimed local key is older
// than every shared entry (FR-13). The FR-11 tiebreaker compares the two
// ENTRIES' origin ids (the local entry's recorded origin, which may be a
// peer's after an adopt or apply, against the shared entry's) in UTF-16
// code-unit order, so every device computes the same winner from the same
// two ids; a local entry with no origin at an equal time reads as identical,
// as files do. A rejected shared slot arrives as null (the "shared absent"
// column), so a malformed slot is overwritten by this device's entry when it
// has one and left alone when it does not (FR-20 healing).

import { keyEntryTimeMs, type SharedKeyEntry } from './keyRecord'
import { compareOriginIds } from './icloudReconcile'

export type LocalKeyEntry =
  | { state: 'key'; value: string; changedAt: number | null; originId: string | null }
  | { state: 'cleared'; clearedAt: number; originId: string | null }

export type KeyAction = 'none' | 'seed' | 'push' | 'apply' | 'adopt' | 'clear-local'

export interface KeyDecision {
  action: KeyAction
  /** for `apply`: a different local key existed (FR-41) */
  replaced?: boolean
  /** the table row that decided it, for logs and tests */
  rule: string
}

export interface KeyReconcileInput {
  local: LocalKeyEntry | null
  shared: SharedKeyEntry | null
}

export function reconcileKeySlot(input: KeyReconcileInput): KeyDecision {
  const { local, shared } = input

  if (!local && !shared) return { action: 'none', rule: 'FR-14 neither present' }

  if (local && !shared) {
    if (local.state === 'cleared') return { action: 'push', rule: 'FR-30 local marker, nothing shared' }
    if (local.changedAt === null) return { action: 'seed', rule: 'FR-13 untimed local key, nothing shared' }
    return { action: 'push', rule: 'FR-14 local only' }
  }

  if (!local && shared) {
    if (shared.state === 'cleared') return { action: 'none', rule: 'FR-14 shared marker, nothing local' }
    return { action: 'apply', replaced: false, rule: 'FR-14 shared only' }
  }

  const l = local as LocalKeyEntry
  const s = shared as SharedKeyEntry
  const sharedAt = keyEntryTimeMs(s)

  if (l.state === 'key') {
    if (l.changedAt === null) {
      // FR-13: an untimed local key is older than any shared entry.
      if (s.state === 'cleared') return { action: 'clear-local', rule: 'FR-29 untimed local key, shared marker' }
      if (s.value === l.value) return { action: 'adopt', rule: 'FR-14 same value, untimed local adopts (OQ-3)' }
      return { action: 'apply', replaced: true, rule: 'FR-13 untimed local key is older' }
    }
    if (s.state === 'cleared') {
      if (l.changedAt > sharedAt) return { action: 'push', rule: 'FR-29 local key newer than the marker' }
      return { action: 'clear-local', rule: 'FR-29 marker newer than (or equal to) the local key' }
    }
    if (sharedAt > l.changedAt) {
      if (s.value === l.value) return { action: 'adopt', rule: 'FR-14 same value, shared newer' }
      return { action: 'apply', replaced: true, rule: 'FR-10 shared newer' }
    }
    if (sharedAt < l.changedAt) return { action: 'push', rule: 'FR-10 local newer' }
    // Equal change times.
    if (l.originId === null || l.originId === s.origin.deviceId) {
      return { action: 'none', rule: 'FR-14 identical' }
    }
    if (compareOriginIds(l.originId, s.origin.deviceId) > 0) {
      return { action: 'push', rule: 'FR-11 tiebreaker: the local entry wins' }
    }
    if (s.value === l.value) return { action: 'adopt', rule: 'FR-11 tiebreaker: the shared entry wins, same value' }
    return { action: 'apply', replaced: true, rule: 'FR-11 tiebreaker: the shared entry wins' }
  }

  // Local cleared marker from here on.
  if (s.state === 'key') {
    if (l.clearedAt > sharedAt) return { action: 'push', rule: 'FR-14 marker newer than the shared key' }
    if (l.clearedAt < sharedAt) return { action: 'apply', replaced: false, rule: 'FR-14 shared key newer than the marker' }
    if (l.originId !== null && compareOriginIds(l.originId, s.origin.deviceId) > 0) {
      return { action: 'push', rule: 'FR-11 tiebreaker: the marker wins' }
    }
    return { action: 'apply', replaced: false, rule: 'FR-11 tiebreaker: the shared key wins' }
  }
  if (l.clearedAt > sharedAt) return { action: 'push', rule: 'FR-10 local marker newer' }
  return { action: 'none', rule: 'FR-10 shared marker newer or equal' }
}
