// The selected county's eBird bar-chart file (targets-tab, schema.md sections
// 1.3, 2 and 5.7; FR-26 to FR-40).
//
// Re-derived from the stored file on every load, and NOTHING derived is
// persisted (FR-39): the parse and the range are recomputed here, and the join
// against the pool is recomputed by the tab whenever either side changes, so
// deleting the file is its whole teardown.
//
// Keyed on the bar-chart files epoch (add, replace, remove) AND on the shared
// files epoch (a backup replace can change which county is selected, which
// changes which manifest entry is read).
//
// A REJECTED manifest read is UNKNOWN (FR-40): "Couldn't check for a bar-chart
// file" with a retry, never the add-a-file prompt. A manifest entry whose file
// cannot be read or no longer parses is its own honest state.

import { useCallback, useEffect, useState } from 'react'
import { storage, type BarChartFileMeta } from '../storage'
import { parseBarChart, type BarChartFile } from '../barChart/parseBarChart'
import { barChartRange, type BarChartRange } from '../barChart/barChartFrequency'

export type BarChartState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unknown' }
  | { status: 'absent' }
  | { status: 'unreadable'; meta: BarChartFileMeta }
  | { status: 'present'; meta: BarChartFileMeta; file: BarChartFile; range: BarChartRange }

export function useBarChartFile(
  regionCode: string | null,
  barChartEpoch: number,
  filesVersion: number | undefined,
): { state: BarChartState; retry: () => void } {
  const [state, setState] = useState<{ region: string | null; file: BarChartState }>({ region: null, file: { status: 'idle' } })
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    if (!regionCode) return
    let cancelled = false
    const put = (file: BarChartState) => { if (!cancelled) setState({ region: regionCode, file }) }
    void (async () => {
      let meta: BarChartFileMeta | undefined
      try {
        const manifest = await storage.getBarChartFiles()
        meta = Object.hasOwn(manifest.counties, regionCode) ? manifest.counties[regionCode] : undefined
      } catch {
        put({ status: 'unknown' })
        return
      }
      if (!meta) { put({ status: 'absent' }); return }
      let text: string | null
      try {
        text = await storage.readBarChartFile(regionCode)
      } catch {
        text = null
      }
      if (cancelled) return
      if (text === null) { put({ status: 'unreadable', meta }); return }
      const parsed = parseBarChart(text)
      if (!parsed.ok) { put({ status: 'unreadable', meta }); return }
      put({ status: 'present', meta, file: parsed.file, range: barChartRange(parsed.file, meta.filename) })
    })()
    return () => { cancelled = true }
  }, [regionCode, barChartEpoch, filesVersion, nonce])

  const file: BarChartState = regionCode && state.region === regionCode
    ? state.file
    : (regionCode ? { status: 'loading' } : { status: 'idle' })
  return { state: file, retry }
}
