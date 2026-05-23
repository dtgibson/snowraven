import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'

export type GraphPoint = {
  key: string
  individuals: number
  photo: number
  audio: number
  video: number
}

export function buildGraphData(
  obs: ObservationEntry[],
  mlRows: MLExportRow[],
  interval: 'yearly' | 'monthly',
): { data: GraphPoint[]; useMonthly: boolean } {
  if (obs.length === 0) return { data: [], useMonthly: false }

  const useMonthly = interval === 'monthly'
  const keyOf = (date: string) => useMonthly ? date.slice(0, 7) : date.slice(0, 4)

  const indivMap = new Map<string, number>()
  for (const o of obs) {
    const k = keyOf(o.date)
    indivMap.set(k, (indivMap.get(k) ?? 0) + (o.count ?? 0))
  }

  const photoMap = new Map<string, number>()
  const audioMap = new Map<string, number>()
  const videoMap = new Map<string, number>()
  for (const r of mlRows) {
    if (!r.date) continue
    const k = keyOf(r.date)
    if (r.format === 'Photo') photoMap.set(k, (photoMap.get(k) ?? 0) + 1)
    else if (r.format === 'Audio') audioMap.set(k, (audioMap.get(k) ?? 0) + 1)
    else if (r.format === 'Video') videoMap.set(k, (videoMap.get(k) ?? 0) + 1)
  }

  const allKeys = new Set([
    ...indivMap.keys(), ...photoMap.keys(), ...audioMap.keys(), ...videoMap.keys(),
  ])
  const sortedKeys = [...allKeys].sort()
  if (sortedKeys.length < 2) return { data: [], useMonthly }

  // Fill gaps so the x-axis is continuous
  const filled = new Set(sortedKeys)
  if (!useMonthly) {
    const firstY = parseInt(sortedKeys[0])
    const lastY = parseInt(sortedKeys[sortedKeys.length - 1])
    for (let y = firstY + 1; y < lastY; y++) filled.add(String(y))
  } else {
    const [fy, fm] = sortedKeys[0].split('-').map(Number)
    const [ly, lm] = sortedKeys[sortedKeys.length - 1].split('-').map(Number)
    let cy = fy, cm = fm
    while (cy < ly || (cy === ly && cm <= lm)) {
      filled.add(`${cy}-${String(cm).padStart(2, '0')}`)
      cm++; if (cm > 12) { cm = 1; cy++ }
    }
  }

  const data: GraphPoint[] = [...filled].sort().map(k => ({
    key: k,
    individuals: indivMap.get(k) ?? 0,
    photo: photoMap.get(k) ?? 0,
    audio: audioMap.get(k) ?? 0,
    video: videoMap.get(k) ?? 0,
  }))

  return { data, useMonthly }
}
