// The Targets tab's load gate and the user's record (targets-tab, schema.md
// section 5.7; FR-09, FR-20).
//
// ONE lookup covers both files, so the phases are:
//   - `getFilesStatus()` REJECTS           -> error, EBIRD_BACKUP_LOAD_ERROR (UNKNOWN, never setup, FR-09)
//   - resolves with no eBird backup        -> setup-required
//   - backup stored but unloadable         -> error, EBIRD_BACKUP_LOAD_ERROR
//   - ready, with the ML export in one of three states: none stored, loaded,
//     or stored but unreadable (FR-20: the last is its own honest state with a
//     retry, never the add-the-export reason).
//
// The effect resets to `loading` at the start of every run, so the tab's
// error phase is only ever entered from a phase whose alert region is already
// mounted (TabLoadErrorAlert's contract). A cancelled run writes no state.

import { useCallback, useEffect, useState } from 'react'
import type { ObservationEntry } from '../../types'
import { storage } from '../storage'
import { loadEbirdObservations } from '../observationsCache'
import { loadMLExport } from '../mlExportCache'
import { transport } from '../transport'
import { withNormalizedParents } from '../speciesUtils'
import { EBIRD_BACKUP_LOAD_ERROR } from '../../components/setupCopy'
import { buildTargetsRecord, distinctNamePairs, type TargetsRecord } from './targetsRecord'

export type MediaState = 'ok' | 'none' | 'unreadable'

export type RecordPhase =
  | { tag: 'loading' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: readonly ObservationEntry[]; record: TargetsRecord; media: MediaState }

export function useTargetsRecord(filesVersion: number | undefined): { phase: RecordPhase; retry: () => void } {
  const [phase, setPhase] = useState<RecordPhase>({ tag: 'loading' })
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setPhase({ tag: 'loading' })
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }
        const ebird = await loadEbirdObservations()
        if (cancelled) return
        if (!ebird) { setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR }); return }

        let mlRows = null
        let media: MediaState = 'none'
        if (status.ml) {
          const ml = await loadMLExport()
          if (cancelled) return
          if (ml) { mlRows = ml.rows; media = 'ok' } else { media = 'unreadable' }
        }

        // The code half of the Lifer subtraction. Local on both transports (the
        // bundled taxonomy on desktop, the backend's static copy on web/Pi), so
        // it works offline; a failure degrades to the name-only subtraction.
        let codes: Record<string, unknown> | null = null
        try {
          const res = await transport.post<{ codes?: Record<string, unknown> }>(
            '/taxonomy/codes',
            { species: withNormalizedParents(distinctNamePairs(ebird.observations)) },
          )
          codes = res && typeof res.codes === 'object' && res.codes !== null ? res.codes : null
        } catch {
          codes = null
        }
        if (cancelled) return
        const record = buildTargetsRecord(ebird.observations, mlRows, codes)
        setPhase({ tag: 'ready', observations: ebird.observations, record, media })
      } catch {
        if (!cancelled) setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [filesVersion, nonce])

  return { phase, retry }
}
