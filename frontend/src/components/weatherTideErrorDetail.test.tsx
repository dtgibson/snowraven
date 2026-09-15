// @vitest-environment jsdom
/// <reference types="node" />
// What the USER SEES when a weather lookup fails on the DESKTOP transport.
//
// This file exists because the preceding round verified the THROW and reasoned
// about the render, and the divergence is invisible exactly there: the desktop
// services throw a plain `Error` carrying `status`/`detail`, while every
// weather/tide call site extracted the detail with
// `err instanceof TransportError ? … : undefined`. A plain Error is not a
// TransportError, so the detail was dropped and `classifyLiveError` fell
// through to GENERIC_ERROR_MESSAGE -- "Something went wrong. Please try again."
// about a checklist date that will never parse, on the majority platform,
// while the web/Pi transport showed the real sentence.
//
// So every assertion here is on RENDERED TEXT through the real component, the
// real classifyLiveError and the real OfflineMessage. Nothing asserts on a
// thrown object, and nothing re-implements the extraction expression (which
// would be a reference point derived from the thing being verified).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TransportError } from '../lib/transport'
import { GENERIC_ERROR_MESSAGE } from '../lib/offlineMessage'
import type { ChecklistMeta } from '../lib/compareChecklists'
import { formatTide, formatTideBody } from '../lib/tideFormatter'
import type { TideReading } from '../lib/tide'
import type { TideStation } from '../lib/tideStations'

const getMock = vi.fn()
vi.mock('../lib/transport', async (orig) => {
  const actual = await orig<typeof import('../lib/transport')>()
  return { ...actual, transport: { get: (...a: unknown[]) => getMock(...a), post: vi.fn() } }
})
vi.mock('../lib/clipboard', () => ({ copyText: vi.fn(async () => true) }))

import { WeatherTideSection } from './WeatherTideSection'

const STN: TideStation = { id: '9410660', name: 'Los Angeles', lat: 33.7, lng: -118.2, state: 'CA', obs: true }
const reading: TideReading = {
  levelMin: 4.1, levelMax: 5.3, source: 'predicted', trend: 'falling', turnedDuring: true,
  prevHL: { kind: 'high', v: 5.4, timeLocal: '9:12am' },
  nextHL: { kind: 'low', v: 0.7, timeLocal: '4:38pm' },
  station: STN, distanceMi: 11.2,
}
const TIDE_OK = { status: 'ok', formatted: formatTide(reading), body: formatTideBody(reading) }
const WEATHER_OK = { formatted: 'x', checklist_id: 'X', loc_name: 'L', obs_dt: '2024-01-01 06:30' }

const meta: ChecklistMeta = {
  locName: 'Plain Marsh', obsDt: '2024-01-01 06:30', protocolId: '', durationHrs: null,
  distanceKm: null, distanceUnit: '', numObservers: null, submissionMethod: '', submissionVersion: '', comments: '',
}

const DATE_SENTENCE = "This checklist's date could not be read."
const PROVIDER_SENTENCE = 'Weather data unavailable for this checklist.'

/** Exactly what lib/tauri/weatherService.ts throws: a PLAIN Error, not a TransportError. */
const desktopThrow = (message: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(message), { status: 502, ...extra })

function routeBy(map: Record<string, unknown>) {
  getMock.mockImplementation((path: string) => {
    if (path in map) {
      const v = map[path]
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
    }
    return Promise.reject(new Error(`unexpected path ${path}`))
  })
}

function load(err: unknown) {
  routeBy({ '/weather/S1': err, '/tide/S1': TIDE_OK, '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK })
  render(<WeatherTideSection idA="S1" idB="S2" metaA={meta} metaB={meta}
    keyStatus={{ ebird: 'k', openweather: 'k' }} onGoToSettings={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
}

beforeEach(() => { getMock.mockReset() })
afterEach(cleanup)

describe('a desktop-thrown weather failure reaches the user in its own words', () => {
  it('an unreadable checklist date renders the date sentence, NOT the generic fallback', async () => {
    load(desktopThrow(DATE_SENTENCE, { detail: DATE_SENTENCE }))
    const alert = await screen.findByRole('alert')
    await waitFor(() => expect(alert.textContent).toContain(DATE_SENTENCE))
    expect(alert.textContent).not.toContain(GENERIC_ERROR_MESSAGE)
  })

  // The provider-body catches carry `status` only, so `err.message` is the sole
  // carrier -- a fallback that reads `detail` alone would still show GENERIC here.
  it('a malformed provider body renders the provider sentence, NOT the generic fallback', async () => {
    load(desktopThrow(PROVIDER_SENTENCE))
    const alert = await screen.findByRole('alert')
    await waitFor(() => expect(alert.textContent).toContain(PROVIDER_SENTENCE))
    expect(alert.textContent).not.toContain(GENERIC_ERROR_MESSAGE)
  })

  // The web/Pi twin of the first row. Both transports must now put the SAME
  // sentence on screen for the same failure; before the repair only this one did.
  it('the web/Pi TransportError shows the same sentence, so the transports agree', async () => {
    load(new TransportError('boom', 502, DATE_SENTENCE))
    const alert = await screen.findByRole('alert')
    await waitFor(() => expect(alert.textContent).toContain(DATE_SENTENCE))
    expect(alert.textContent).not.toContain(GENERIC_ERROR_MESSAGE)
  })

  // Guard the floor: a failure with NOTHING to say must still say something.
  it('an error carrying no message and no detail still renders the generic fallback', async () => {
    load(Object.assign(new Error(''), { status: 502 }))
    const alert = await screen.findByRole('alert')
    await waitFor(() => expect(alert.textContent).toContain(GENERIC_ERROR_MESSAGE))
  })
})

// ── Coverage completeness ────────────────────────────────────────────────────
// The render rows above prove the expression works, on the ONE weather/tide site
// that has a component harness. App.tsx has none (there is no App.test.tsx and
// mounting it is not viable), so its identical call site is covered structurally
// here instead. Stated plainly rather than implied: this half asserts the code
// SHAPE, the half above asserts the rendered text, and neither substitutes for
// the other.
const src = (rel: string) => {
  const text = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  // Comments stripped, both forms: a `toContain` over raw source is satisfied by
  // a commented-out copy, which is exactly the state a half-revert leaves.
  let inBlock = false
  return text.split('\n').filter(line => {
    const t = line.trim()
    if (inBlock) { if (t.includes('*/')) inBlock = false; return false }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; return false }
    return !t.startsWith('//') && !t.startsWith('*')
  }).join('\n')
}

// Every site that extracts a detail for classifyLiveError. The three precedents
// already carried the non-TransportError fallback; the two weather/tide sites
// were the odd ones out. Cardinality is asserted so a sixth site added later
// reads as a missing row rather than as nothing at all.
const DETAIL_SITES = [
  { file: '../App.tsx', what: 'loadWeather (/weather/{id})', weatherTide: true },
  { file: './WeatherTideSection.tsx', what: 'loadSideWeather (/weather/{id})', weatherTide: true },
  { file: './MapExplorer.tsx', what: 'classifyOverlayError (precedent)', weatherTide: false },
  { file: '../lib/useHotspotActivity.ts', what: 'activity controller (precedent)', weatherTide: false },
  { file: '../lib/useCountyCompleteness.ts', what: 'completeness controller (precedent)', weatherTide: false },
]

describe('every detail-extracting site handles a non-TransportError throw', () => {
  it.each(DETAIL_SITES)('$what carries the non-TransportError fallback', ({ file }) => {
    const text = src(file)
    expect(text).toContain('instanceof TransportError')
    expect(text).toMatch(/err instanceof Error \? err\.message : undefined/)
  })

  it('the weather/tide sites are exactly the two that were missing it', () => {
    expect(DETAIL_SITES.filter(s => s.weatherTide)).toHaveLength(2)
    expect(DETAIL_SITES).toHaveLength(5)
  })
})
