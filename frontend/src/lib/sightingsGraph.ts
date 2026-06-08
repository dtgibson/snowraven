import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'

export type GraphInterval = 'weekly' | 'monthly' | 'yearly'

export type GraphPoint = {
  key: string
  individuals: number
  checklists: number
  photo: number
  audio: number
  video: number
}

// Returns the ISO week key (YYYY-Www) for a YYYY-MM-DD date string
function isoWeekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayOfWeek = date.getUTCDay() || 7 // 1=Mon … 7=Sun
  // Move to Thursday of this ISO week — Thursday determines the ISO year
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek)
  const weekYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${weekYear}-W${String(weekNo).padStart(2, '0')}`
}

// Returns the UTC Monday date for an ISO week key (YYYY-Www)
function mondayOfISOWeek(weekKey: string): Date {
  const [yearStr, wStr] = weekKey.split('-W')
  const year = parseInt(yearStr, 10)
  const week = parseInt(wStr, 10)
  // ISO week 1 always contains Jan 4
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1) + (week - 1) * 7)
  return monday
}

export function buildGraphData(
  obs: ObservationEntry[],
  mlRows: MLExportRow[],
  interval: GraphInterval,
): { data: GraphPoint[]; interval: GraphInterval } {
  if (obs.length === 0) return { data: [], interval }

  const keyOf = (date: string): string => {
    if (interval === 'weekly') return isoWeekKey(date)
    if (interval === 'monthly') return date.slice(0, 7)
    return date.slice(0, 4)
  }

  const indivMap = new Map<string, number>()
  const checklistMap = new Map<string, number>()
  for (const o of obs) {
    const k = keyOf(o.date)
    indivMap.set(k, (indivMap.get(k) ?? 0) + (o.count ?? 0))
    checklistMap.set(k, (checklistMap.get(k) ?? 0) + 1)
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
  if (sortedKeys.length < 2) return { data: [], interval }

  // Fill gaps so the x-axis is continuous
  const filled = new Set(sortedKeys)
  if (interval === 'yearly') {
    const firstY = parseInt(sortedKeys[0])
    const lastY = parseInt(sortedKeys[sortedKeys.length - 1])
    for (let y = firstY + 1; y < lastY; y++) filled.add(String(y))
  } else if (interval === 'monthly') {
    const [fy, fm] = sortedKeys[0].split('-').map(Number)
    const [ly, lm] = sortedKeys[sortedKeys.length - 1].split('-').map(Number)
    let cy = fy, cm = fm
    while (cy < ly || (cy === ly && cm <= lm)) {
      filled.add(`${cy}-${String(cm).padStart(2, '0')}`)
      cm++; if (cm > 12) { cm = 1; cy++ }
    }
  } else {
    // Weekly: step Monday by Monday between first and last observed week
    const firstMonday = mondayOfISOWeek(sortedKeys[0])
    const lastMonday = mondayOfISOWeek(sortedKeys[sortedKeys.length - 1])
    const current = new Date(firstMonday)
    while (current <= lastMonday) {
      filled.add(isoWeekKey(current.toISOString().slice(0, 10)))
      current.setUTCDate(current.getUTCDate() + 7)
    }
  }

  const data: GraphPoint[] = [...filled].sort().map(k => ({
    key: k,
    individuals: indivMap.get(k) ?? 0,
    checklists: checklistMap.get(k) ?? 0,
    photo: photoMap.get(k) ?? 0,
    audio: audioMap.get(k) ?? 0,
    video: videoMap.get(k) ?? 0,
  }))

  return { data, interval }
}

export type MediaGraphInterval = 'weekly' | 'monthly' | 'yearly' | 'total'

export type MediaGraphPoint = {
  key: string
  photo: number
  audio: number
  video: number
  total: number
}

export function buildMediaGraphData(
  mlRows: MLExportRow[],
  interval: MediaGraphInterval,
): { data: MediaGraphPoint[]; interval: MediaGraphInterval } {
  const keyOf = (date: string): string => {
    if (interval === 'weekly') return isoWeekKey(date)
    if (interval === 'monthly') return date.slice(0, 7)
    if (interval === 'yearly') return date.slice(0, 4)
    return date.slice(0, 10) // 'total' → daily YYYY-MM-DD
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

  const allKeys = new Set([...photoMap.keys(), ...audioMap.keys(), ...videoMap.keys()])
  const sortedKeys = [...allKeys].sort()

  if (sortedKeys.length < 2) return { data: [], interval }

  if (interval === 'total') {
    const data = sortedKeys.map(k => {
      const photo = photoMap.get(k) ?? 0
      const audio = audioMap.get(k) ?? 0
      const video = videoMap.get(k) ?? 0
      return { key: k, photo, audio, video, total: photo + audio + video }
    })
    return { data, interval }
  }

  // Gap-fill for weekly / monthly / yearly
  const filled = new Set(sortedKeys)
  if (interval === 'yearly') {
    const firstY = parseInt(sortedKeys[0])
    const lastY = parseInt(sortedKeys[sortedKeys.length - 1])
    for (let y = firstY + 1; y < lastY; y++) filled.add(String(y))
  } else if (interval === 'monthly') {
    const [fy, fm] = sortedKeys[0].split('-').map(Number)
    const [ly, lm] = sortedKeys[sortedKeys.length - 1].split('-').map(Number)
    let cy = fy, cm = fm
    while (cy < ly || (cy === ly && cm <= lm)) {
      filled.add(`${cy}-${String(cm).padStart(2, '0')}`)
      cm++; if (cm > 12) { cm = 1; cy++ }
    }
  } else {
    const firstMonday = mondayOfISOWeek(sortedKeys[0])
    const lastMonday = mondayOfISOWeek(sortedKeys[sortedKeys.length - 1])
    const current = new Date(firstMonday)
    while (current <= lastMonday) {
      filled.add(isoWeekKey(current.toISOString().slice(0, 10)))
      current.setUTCDate(current.getUTCDate() + 7)
    }
  }

  const data: MediaGraphPoint[] = [...filled].sort().map(k => {
    const photo = photoMap.get(k) ?? 0
    const audio = audioMap.get(k) ?? 0
    const video = videoMap.get(k) ?? 0
    return { key: k, photo, audio, video, total: photo + audio + video }
  })

  return { data, interval }
}

export const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function formatPeriodLabel(key: string, interval: GraphInterval): string {
  if (interval === 'yearly') return key
  if (interval === 'monthly') {
    const [year, month] = key.split('-')
    const m = parseInt(month, 10) - 1
    return `${MONTH_ABBR[m] ?? ''} ${year}`
  }
  // weekly: "2024-W03" → "Wk 3 '24"
  const [yearStr, wStr] = key.split('-W')
  return `Wk ${parseInt(wStr, 10)} '${yearStr.slice(2)}`
}
