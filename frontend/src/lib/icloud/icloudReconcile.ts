// Reconciliation rules (icloud-sync FR-14 to FR-18, FR-21, FR-31, and the
// OQ-3 origin-id tiebreaker; schema.md "Reconciliation rules"). Pure and
// fully tabulated: one input shape in, one decision out, no I/O.
//
// | local   | shared                                   | action        |
// | null    | null                                     | none          |
// | present | null                                     | push          |
// | null    | file                                     | pull/download |
// | null    | cleared                                  | none          |
// | present | cleared, local newer than the marker     | push          |
// | present | cleared, local not newer                 | delete-local  |
// | present | file, shared newer                       | pull/download |
// | present | file, local newer                        | push          |
// | present | file, equal, same origin or no origin    | none          |
// | present | file, equal, different origins           | tiebreaker    |
//
// "pull" when the container csv is downloaded on this device, "download"
// when it is not (the caller starts the download and the row reads
// "In iCloud, not downloaded here" until it lands). Times compare as numbers
// (ms, UTC). The tiebreaker orders origin ids by UTF-16 code units so two
// devices tied to the millisecond pick the same winner (FR-22). There is no
// row that deletes a local file for a null record: that is the FR-37
// guarantee the validator relies on.

import type { SharedRecord } from './icloudRecord'
import { recordTimeMs } from './icloudRecord'

export type SlotAction = 'none' | 'push' | 'pull' | 'download' | 'delete-local'

export interface LocalView {
  /** ms epoch of the local entry's uploadedAt */
  uploadedAt: number
  /** the local entry's origin device id, or null for a pre-1.0.11 entry */
  originId: string | null
}

export interface ReconcileInput {
  local: LocalView | null
  shared: SharedRecord | null
  file: { downloaded: boolean; downloading: boolean }
  deviceId: string
}

export interface SlotDecision {
  action: SlotAction
  /** the table row that decided it, for logs and tests */
  rule: string
}

/** Code-unit order: the same on every device, which is the whole point. */
export function compareOriginIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function fetchAction(file: ReconcileInput['file']): SlotAction {
  return file.downloaded ? 'pull' : 'download'
}

export function reconcileSlot(input: ReconcileInput): SlotDecision {
  const { local, shared, file, deviceId } = input

  if (!local && !shared) return { action: 'none', rule: 'FR-18 neither present' }

  if (local && !shared) return { action: 'push', rule: 'FR-14 local only' }

  if (!local && shared) {
    if (shared.state === 'cleared') return { action: 'none', rule: 'FR-31 cleared, nothing local' }
    return { action: fetchAction(file), rule: 'FR-15 shared only' }
  }

  // Both present from here on.
  const l = local as LocalView
  const s = shared as SharedRecord
  const sharedAt = recordTimeMs(s)

  if (s.state === 'cleared') {
    if (l.uploadedAt > sharedAt) return { action: 'push', rule: 'FR-31 local newer than the cleared marker' }
    return { action: 'delete-local', rule: 'FR-31 cleared marker newer than local' }
  }

  if (sharedAt > l.uploadedAt) return { action: fetchAction(file), rule: 'FR-16 shared newer' }
  if (sharedAt < l.uploadedAt) return { action: 'push', rule: 'FR-16 local newer' }

  // Equal upload times.
  if (l.originId === null || l.originId === s.origin.deviceId) {
    return { action: 'none', rule: 'FR-17 identical' }
  }
  // Different origins at the same millisecond: deterministic by origin id so
  // every device converges on the same file (FR-21 + OQ-3 tiebreaker).
  if (compareOriginIds(deviceId, s.origin.deviceId) > 0) {
    return { action: 'push', rule: 'FR-21 tiebreaker: this device wins' }
  }
  return { action: fetchAction(file), rule: 'FR-21 tiebreaker: the shared origin wins' }
}
