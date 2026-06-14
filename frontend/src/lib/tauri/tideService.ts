// Desktop (Tauri) tide lookup — the twin of backend/routers/tide.py. Resolves the
// checklist (reusing weatherService.fetchChecklist), finds the nearest bundled
// NOAA station, and either returns the formatted tide block or a notice
// (too-far / outside-US) the UI can offer to override. NOAA CO-OPS is keyless.
// See pipeline/weather-tides/schema.md.

import { tauriFetch } from './http'
import { storage } from '../storage'
import { fetchChecklist } from './weatherService'
import { nearestStation, classifyTideLocation, type TideLocationStatus } from '../tideStations'
import {
  parseObserved, parsePredictions, parseHiLo, computeTideReading,
  normalizeObsDt, shiftLocal, toNoaaDate, summarizeReading, type TideAtResponse,
} from '../tide'
import { formatTide, formatTideBody } from '../tideFormatter'

const NOAA = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

export interface TideResult {
  checklist_id: string
  loc_name: string
  obs_dt: string
  status: TideLocationStatus | 'unavailable'
  formatted?: string
  body?: string
  station?: { id: string; name: string }
  distanceMi?: number
}

function noaaUrl(params: Record<string, string>): string {
  const base = {
    datum: 'MLLW', units: 'english', time_zone: 'lst_ldt',
    format: 'json', application: 'SnowRaven',
  }
  const qs = Object.entries({ ...base, ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return `${NOAA}?${qs}`
}

async function getJson(url: string): Promise<unknown> {
  try {
    const res = await tauriFetch(url)
    return await res.json()  // NOAA returns 200-with-error or 400-with-error; parse regardless
  } catch {
    return null
  }
}

export async function getTide(checklistId: string, force = false): Promise<TideResult> {
  const ebirdKey = await storage.getApiKey('ebird')
  if (!ebirdKey) {
    throw Object.assign(new Error('eBird API key not configured. Add it in Settings.'), { status: 500, detail: 'eBird API key not configured. Add it in Settings.' })
  }

  const checklist = await fetchChecklist(checklistId, ebirdKey)
  const base = { checklist_id: checklistId, loc_name: checklist.loc_name, obs_dt: checklist.obs_dt }

  // Genuinely nearest station — prediction-only stations are fine (they show as
  // Predicted). Biasing toward gauge stations would skip a much closer one.
  const nearest = nearestStation(checklist.lat, checklist.lng)
  if (!nearest) return { ...base, status: 'unavailable' }

  const status = classifyTideLocation(checklist.lat, checklist.lng, nearest)
  if (status !== 'ok' && !force) {
    return { ...base, status, station: { id: nearest.station.id, name: nearest.station.name }, distanceMi: nearest.distanceMi }
  }

  const start = normalizeObsDt(checklist.obs_dt)
  const end = shiftLocal(start, checklist.duration_hrs || 1)
  const begin = toNoaaDate(start), finish = toNoaaDate(end)
  const station = nearest.station.id

  const [obsBody, predBody, hiloBody] = await Promise.all([
    getJson(noaaUrl({ begin_date: begin, end_date: finish, station, product: 'water_level' })),
    getJson(noaaUrl({ begin_date: begin, end_date: finish, station, product: 'predictions', interval: '6' })),
    getJson(noaaUrl({ begin_date: toNoaaDate(shiftLocal(start, -24)), end_date: toNoaaDate(shiftLocal(end, 24)), station, product: 'predictions', interval: 'hilo' })),
  ])

  const reading = computeTideReading(
    start, end,
    parseObserved(obsBody), parsePredictions(predBody), parseHiLo(hiloBody),
    nearest.station, nearest.distanceMi,
  )
  if (!reading) return { ...base, status: 'unavailable' }

  return {
    ...base,
    status: 'ok',
    formatted: formatTide(reading),
    body: formatTideBody(reading),
    station: { id: nearest.station.id, name: nearest.station.name },
    distanceMi: nearest.distanceMi,
  }
}

// Live (Current) or predicted (Predict) tide for an arbitrary location and moment,
// bypassing the eBird checklist. `dtLocal` is the local wall-clock; a 1-hour
// window around it gives the trend + bracketing high/low. Twin of GET /tide/at.
export async function getTideAt(lat: number, lng: number, dtLocal: string, force = false): Promise<TideAtResponse> {
  const start = normalizeObsDt(dtLocal)
  const end = shiftLocal(start, 1)

  const nearest = nearestStation(lat, lng)
  if (!nearest) return { status: 'unavailable' }

  const status = classifyTideLocation(lat, lng, nearest)
  if (status !== 'ok' && !force) {
    return { status, station: { id: nearest.station.id, name: nearest.station.name }, distanceMi: nearest.distanceMi }
  }

  const station = nearest.station.id
  const begin = toNoaaDate(start), finish = toNoaaDate(end)

  const [obsBody, predBody, hiloBody] = await Promise.all([
    getJson(noaaUrl({ begin_date: begin, end_date: finish, station, product: 'water_level' })),
    getJson(noaaUrl({ begin_date: begin, end_date: finish, station, product: 'predictions', interval: '6' })),
    getJson(noaaUrl({ begin_date: toNoaaDate(shiftLocal(start, -24)), end_date: toNoaaDate(shiftLocal(end, 24)), station, product: 'predictions', interval: 'hilo' })),
  ])

  const reading = computeTideReading(
    start, end,
    parseObserved(obsBody), parsePredictions(predBody), parseHiLo(hiloBody),
    nearest.station, nearest.distanceMi,
  )
  if (!reading) return { status: 'unavailable' }

  return {
    status: 'ok',
    formatted: formatTide(reading),
    body: formatTideBody(reading),
    station: { id: nearest.station.id, name: nearest.station.name },
    distanceMi: nearest.distanceMi,
    reading: summarizeReading(reading),
  }
}
