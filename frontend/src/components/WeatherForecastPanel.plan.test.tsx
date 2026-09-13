// @vitest-environment jsdom
// The Weather/tide Planner's action inside the Predict form and the panel's
// handling of the plan (QA-01 to QA-06, QA-30, QA-31, QA-36, QA-37, QA-40 to
// QA-42, QA-48): place validation with zero requests, the loading status and
// the ready announcement, the plan replacing the result region, the three
// honest failures in Predict's words, the replay cue, the request token, the
// override through plain transport.get with the coord identity guard, and
// Predict's single-moment result byte-unchanged. The transport is the only
// double beside the map and the (deferred) chart chunk; the halves are the
// parity fixture's, composed by the real merge.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within, act } from '@testing-library/react'

vi.mock('./PredictMap', () => ({ PredictMap: () => <div data-testid="predict-map" /> }))
vi.mock('../lib/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))

// The lazy chart chunk, held back until a test releases it, so "the list is
// visible before the chart chunk resolves" is observable rather than assumed.
const chartGate = vi.hoisted(() => {
  let release!: () => void
  const promise = new Promise<void>(r => { release = r })
  return { promise, release }
})
vi.mock('./PlanChart', async () => {
  await chartGate.promise
  return { PlanChart: () => <div data-testid="plan-chart" /> }
})
// The storage seam: the Days in view setting is read on mount and written on
// change (D4-15); an in-memory document stands in for the disk.
const settings = vi.hoisted(() => ({ doc: {} as Record<string, unknown> }))
vi.mock('../lib/storage', () => ({
  storage: {
    getSetting: vi.fn(async (key: string) => settings.doc[key] ?? null),
    setSetting: vi.fn(async (key: string, value: unknown) => { settings.doc[key] = value }),
  },
}))

const getMock = vi.fn()
const getReplayableMock = vi.fn()
vi.mock('../lib/transport', () => ({
  transport: {
    get: (path: string, params?: Record<string, string>) => getMock(path, params),
    getReplayable: (path: string, params?: Record<string, string>) => getReplayableMock(path, params),
  },
}))
const getCurrentLocationMock = vi.fn()
vi.mock('../lib/location', () => ({
  getCurrentLocation: () => getCurrentLocationMock(),
  describeLocationError: () => 'Location access was denied.',
}))

import { WeatherForecastPanel } from './WeatherForecastPanel'
import fixture from '../lib/weatherTidePlan.fixture.json'
import { PLAN_COPY } from '../lib/planCopy'
import { OFFLINE_MESSAGE, BACKEND_DOWN_MESSAGE, NO_KEY_MESSAGE } from '../lib/offlineMessage'
import { tideOverrideLabel } from '../lib/tideNotice'
import { storage } from '../lib/storage'

const REF = (fixture as { families: Array<{ name: string; expectedWeather: { plan: unknown }; expectedTide: unknown }> }).families.find(f => f.name === 'reference')!
const WEATHER_HALF = REF.expectedWeather.plan
const TIDE_HALF = REF.expectedTide
const TIDE_FAR = { status: 'too-far', station: { id: '9413623', name: 'Elkhorn Slough, Highway 1 Bridge' }, distanceMi: 58 }

const live = (byPath: Record<string, unknown>) => (path: string) =>
  path in byPath ? Promise.resolve({ data: byPath[path], replayedAt: null }) : Promise.reject(new Error('unexpected ' + path))

class TransportErrorLike extends Error {
  status: number; detail?: string
  constructor(status: number, detail?: string) { super(`Transport error: ${status}`); this.status = status; this.detail = detail }
}
const noKeyError = () => Object.assign(new Error('API key not configured. Add it in Settings.'), { status: 500, detail: 'API key not configured. Add it in Settings.' })

async function openPredictAt(lat: string, lng: string) {
  render(<WeatherForecastPanel />)
  fireEvent.click(screen.getByRole('button', { name: /predict weather and tide/i }))
  await screen.findByLabelText(/Latitude/)
  if (lat) fireEvent.change(screen.getByLabelText(/Latitude/), { target: { value: lat } })
  if (lng) fireEvent.change(screen.getByLabelText(/Longitude/), { target: { value: lng } })
}
const planButton = () => screen.getByRole('button', { name: PLAN_COPY.actionLabel })

beforeEach(() => {
  getMock.mockReset()
  getReplayableMock.mockReset()
  getCurrentLocationMock.mockReset().mockRejectedValue({ code: 'unavailable' })
  settings.doc = {}
  vi.mocked(storage.getSetting).mockClear()
  vi.mocked(storage.setSetting).mockClear()
  // The wide tier by default here (jsdom has no matchMedia; the hook reads
  // "not a phone"), where the Days in view control renders.
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('the action and its validation (QA-01, QA-02)', () => {
  it('sits beneath Get forecast with its caption, through the Button primitive', async () => {
    await openPredictAt('', '')
    const btn = planButton()
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('tabindex')).toBe('0')
    expect(btn.getAttribute('type')).toBe('button')
    expect(screen.getByText(PLAN_COPY.caption)).toBeTruthy()
    const forecast = screen.getByRole('button', { name: 'Get forecast' })
    expect(forecast.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('with no place picked shows Predict\'s message and makes no request', async () => {
    await openPredictAt('', '')
    fireEvent.click(planButton())
    expect((await screen.findByRole('alert')).textContent).toBe('Pick a place first: search, tap the map, or type coordinates.')
    expect(getReplayableMock).not.toHaveBeenCalled()
    expect(getMock).not.toHaveBeenCalled()
  })

  it('ignores the date and time fields entirely: the request carries the coordinates only', async () => {
    getReplayableMock.mockImplementation(live({ '/weather/plan': WEATHER_HALF, '/tide/plan': TIDE_HALF }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.change(screen.getByLabelText('Forecast date'), { target: { value: '2031-01-01' } })
    fireEvent.change(screen.getByLabelText('Forecast time'), { target: { value: '03:33' } })
    fireEvent.click(planButton())
    await screen.findByRole('region', { name: PLAN_COPY.regionName })
    expect(getReplayableMock).toHaveBeenCalledTimes(2)
    expect(getReplayableMock).toHaveBeenCalledWith('/weather/plan', { lat: '36.603', lng: '-121.876' })
    expect(getReplayableMock).toHaveBeenCalledWith('/tide/plan', { lat: '36.603', lng: '-121.876' })
    expect(getMock).not.toHaveBeenCalled()
  })
})

describe('loading, ready, the region (QA-03, QA-04, QA-54)', () => {
  it('shows the loading status, renders the list before the chart chunk resolves, then announces', async () => {
    getReplayableMock.mockImplementation(live({ '/weather/plan': WEATHER_HALF, '/tide/plan': TIDE_HALF }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    const status = await screen.findByText('Building the plan for Selected location…')
    expect(status.closest('[role="status"]')).toBeTruthy()
    const region = await screen.findByRole('region', { name: PLAN_COPY.regionName })
    // The figures are on screen while the chart chunk is still unresolved.
    expect(within(region).getByRole('list', { name: PLAN_COPY.listName })).toBeTruthy()
    expect(within(region).queryByTestId('plan-chart')).toBeNull()
    expect(within(region).getByText(PLAN_COPY.closingNote)).toBeTruthy()
    // The form is gone, as for Get forecast; only one result is on screen.
    expect(screen.queryByLabelText(/Latitude/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Weather and tide result' })).toBeNull()
    // The announcement lands in the persistent live region.
    const announced = await screen.findByText('Plan ready for Selected location.')
    expect(announced.closest('[role="status"]')!.getAttribute('aria-live')).toBe('polite')
    // Release the chunk: the chart arrives inside the region, and nothing else moves.
    await act(async () => { chartGate.release() })
    await within(region).findByTestId('plan-chart')
  })

  it('a typed place names the plan and the announcement', async () => {
    getReplayableMock.mockImplementation(live({ '/weather/plan': WEATHER_HALF, '/tide/plan': TIDE_HALF }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.change(screen.getByLabelText('Search for a place'), { target: { value: 'Del Monte Beach' } })
    fireEvent.click(planButton())
    const region = await screen.findByRole('region', { name: PLAN_COPY.regionName })
    expect(within(region).getByRole('heading', { level: 3 }).textContent).toBe('Del Monte Beach')
    await screen.findByText('Plan ready for Del Monte Beach.')
  })
})

describe('the weather half blocks the plan, in Predict\'s words (QA-36, QA-37)', () => {
  it('no key: the no-key message, no region', async () => {
    getReplayableMock.mockImplementation(() => Promise.reject(noKeyError()))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    expect((await screen.findByText(NO_KEY_MESSAGE)).closest('[role="status"]')).toBeTruthy()
    expect(screen.queryByRole('region', { name: PLAN_COPY.regionName })).toBeNull()
  })

  it('offline on web with the device online: the server-down variant; device offline: the offline message', async () => {
    getReplayableMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    expect(await screen.findByText(BACKEND_DOWN_MESSAGE)).toBeTruthy()
    cleanup()
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      await openPredictAt('36.603', '-121.876')
      fireEvent.click(planButton())
      expect(await screen.findByText(OFFLINE_MESSAGE)).toBeTruthy()
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    }
  })

  it('a provider error: Predict\'s muted line, no region, no partial plan', async () => {
    getReplayableMock.mockImplementation((path: string) =>
      path === '/weather/plan' ? Promise.reject(new TransportErrorLike(502, 'Weather data unavailable for this location.'))
        : Promise.resolve({ data: TIDE_HALF, replayedAt: null }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    expect(await screen.findByText(PLAN_COPY.providerError)).toBeTruthy()
    expect(screen.queryByRole('region', { name: PLAN_COPY.regionName })).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('a tide half that fails while the weather succeeds still renders the plan, with the words in the tide slot', async () => {
    getReplayableMock.mockImplementation((path: string) =>
      path === '/weather/plan' ? Promise.resolve({ data: WEATHER_HALF, replayedAt: null })
        : Promise.reject(new TypeError('Failed to fetch')))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    const region = await screen.findByRole('region', { name: PLAN_COPY.regionName })
    // The tide slot speaks Predict's offline words (the same slot copy the
    // single-moment result uses); the plan itself is not blocked.
    expect(within(region).getByText(OFFLINE_MESSAGE)).toBeTruthy()
    expect(region.querySelectorAll('li.sr-plan-ev').length).toBeGreaterThan(0)
  })
})

describe('replay (QA-40)', () => {
  it('a replayed pair re-shows with the staleness cue naming the fetch time', async () => {
    const loadedAt = new Date(2026, 8, 12, 15, 41).getTime()
    getReplayableMock.mockImplementation((path: string) =>
      Promise.resolve({ data: path === '/weather/plan' ? WEATHER_HALF : TIDE_HALF, replayedAt: loadedAt }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    const region = await screen.findByRole('region', { name: PLAN_COPY.regionName })
    expect(within(region).getByText(/showing the last loaded result, from Sep 12, 2026, 3:41 PM/)).toBeTruthy()
  })
})

describe('replacement and the stale-response guard (QA-06)', () => {
  it('a plan response that resolves after the user reopened Predict never appears', async () => {
    let resolveWeather!: (v: unknown) => void
    getReplayableMock.mockImplementation((path: string) =>
      path === '/weather/plan' ? new Promise(r => { resolveWeather = r }) : Promise.resolve({ data: TIDE_HALF, replayedAt: null }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    await screen.findByText('Building the plan for Selected location…')
    // The user goes back to the form before the plan lands.
    fireEvent.click(screen.getByRole('button', { name: /predict weather and tide/i }))
    await screen.findByLabelText(/Latitude/)
    await act(async () => { resolveWeather({ data: WEATHER_HALF, replayedAt: null }) })
    // The form stays; no plan region ever mounts.
    expect(screen.getByLabelText(/Latitude/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: PLAN_COPY.regionName })).toBeNull()
  })

  it('Get forecast after a plan replaces it with the single-moment result, whose words are unchanged (QA-48)', async () => {
    const WEATHER_DAILY = {
      resolution: 'daily', formatted: 'x', tz: 'America/Los_Angeles',
      summary: { emoji: '⛅', moon: '', description: 'Scattered clouds', isDaily: true, tempF: 61, highF: 66, lowF: 52, windDesc: 'Gentle breeze', windDir: 'W', cloudsPct: 40, humidityPct: 72, dewPointF: 52, sunrise: '6:48am', sunset: '7:19pm', isNight: false },
    }
    getReplayableMock.mockImplementation(live({ '/weather/plan': WEATHER_HALF, '/tide/plan': TIDE_HALF, '/weather/at': WEATHER_DAILY, '/tide/at': { status: 'unavailable' } }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    await screen.findByRole('region', { name: PLAN_COPY.regionName })
    fireEvent.click(screen.getByRole('button', { name: /predict weather and tide/i }))
    await screen.findByLabelText(/Latitude/)
    fireEvent.change(screen.getByLabelText('Forecast date'), { target: { value: '2026-09-15' } })
    fireEvent.change(screen.getByLabelText('Forecast time'), { target: { value: '06:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Get forecast' }))
    const single = await screen.findByRole('region', { name: 'Weather and tide result' })
    expect(screen.queryByRole('region', { name: PLAN_COPY.regionName })).toBeNull()
    // The extracted labels render Predict's exact bytes.
    expect(within(single).getByText('FORECAST · DAILY')).toBeTruthy()
    expect(within(single).getByText('Scattered clouds, forecast for that day')).toBeTruthy()
  })
})

describe('the override (QA-30, QA-31)', () => {
  it('fills the tide into the same plan through a forced plain read, never the replay seam, with no second weather request', async () => {
    getReplayableMock.mockImplementation(live({ '/weather/plan': WEATHER_HALF, '/tide/plan': TIDE_FAR }))
    let resolveTide!: (v: unknown) => void
    getMock.mockImplementation(() => new Promise(r => { resolveTide = r }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    const region = await screen.findByRole('region', { name: PLAN_COPY.regionName })
    const btn = within(region).getByRole('button', { name: PLAN_COPY.overrideAria })
    expect(btn.textContent).toBe(tideOverrideLabel('too-far'))
    expect(region.querySelectorAll('.sr-plan-ev-tide')).toHaveLength(0)
    fireEvent.click(btn)
    // Busy while it runs; the plan stays on screen.
    await waitFor(() => expect(within(region).getByRole('button', { name: PLAN_COPY.overrideAria }).getAttribute('aria-busy')).toBe('true'))
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock).toHaveBeenCalledWith('/tide/plan', { lat: '36.603', lng: '-121.876', force: '1' })
    expect(getReplayableMock).toHaveBeenCalledTimes(2)
    await act(async () => { resolveTide(TIDE_HALF) })
    // The station line, the tide lines and the High/Low legend fill in; the
    // weather figures are unchanged and no weather request was made.
    await within(region).findByText(/Tide: MONTEREY, MONTEREY BAY/)
    expect(region.querySelectorAll('.sr-plan-ev-tide').length).toBeGreaterThan(0)
    expect(within(region).queryByRole('button', { name: PLAN_COPY.overrideAria })).toBeNull()
    expect(getReplayableMock).toHaveBeenCalledTimes(2)
  })

  it('an override that fails offline leaves the notice and says so in the tide slot; nothing is replayed', async () => {
    getReplayableMock.mockImplementation(live({ '/weather/plan': WEATHER_HALF, '/tide/plan': TIDE_FAR }))
    getMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    const region = await screen.findByRole('region', { name: PLAN_COPY.regionName })
    fireEvent.click(within(region).getByRole('button', { name: PLAN_COPY.overrideAria }))
    await within(region).findByText(OFFLINE_MESSAGE)
    expect(within(region).getByRole('button', { name: PLAN_COPY.overrideAria })).toBeTruthy()
    expect(getReplayableMock).toHaveBeenCalledTimes(2)
  })
})

describe('the Days in view setting and the widened card (D4-13, D4-15)', () => {
  it('reads planDaysInView through the storage seam on mount, validated, and writes every change', async () => {
    settings.doc.planDaysInView = '3'
    getReplayableMock.mockImplementation(live({ '/weather/plan': WEATHER_HALF, '/tide/plan': TIDE_HALF }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    const region = await screen.findByRole('region', { name: PLAN_COPY.regionName })
    expect(storage.getSetting).toHaveBeenCalledWith('planDaysInView')
    const group = within(region).getByRole('group', { name: PLAN_COPY.daysInView })
    expect(within(group).getByRole('button', { name: '3 days' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(group).getByRole('button', { name: '7 days' }))
    await waitFor(() => expect(storage.setSetting).toHaveBeenCalledWith('planDaysInView', '7'))
    expect(within(group).getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe('true')
    expect(settings.doc.planDaysInView).toBe('7')
  })

  it('a stored value that is not one of the four reads as All', async () => {
    settings.doc.planDaysInView = 'bogus'
    getReplayableMock.mockImplementation(live({ '/weather/plan': WEATHER_HALF, '/tide/plan': TIDE_HALF }))
    await openPredictAt('36.603', '-121.876')
    fireEvent.click(planButton())
    const region = await screen.findByRole('region', { name: PLAN_COPY.regionName })
    const group = within(region).getByRole('group', { name: PLAN_COPY.daysInView })
    expect(within(group).getByRole('button', { name: 'All 8 days' }).getAttribute('aria-pressed')).toBe('true')
    expect(storage.setSetting).not.toHaveBeenCalled()
  })

  it('tells the card when a plan is on screen and when it leaves, and wraps everything else in the narrow measure', async () => {
    const onPlanVisible = vi.fn()
    getReplayableMock.mockImplementation(live({ '/weather/plan': WEATHER_HALF, '/tide/plan': TIDE_HALF }))
    const { container } = render(<WeatherForecastPanel onPlanVisible={onPlanVisible} />)
    expect(onPlanVisible).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole('button', { name: /predict weather and tide/i }))
    await screen.findByLabelText(/Latitude/)
    fireEvent.change(screen.getByLabelText(/Latitude/), { target: { value: '36.603' } })
    fireEvent.change(screen.getByLabelText(/Longitude/), { target: { value: '-121.876' } })
    fireEvent.click(planButton())
    const region = await screen.findByRole('region', { name: PLAN_COPY.regionName })
    await waitFor(() => expect(onPlanVisible).toHaveBeenLastCalledWith(true))
    // The plan region sits OUTSIDE the narrow wrapper; the form and the live
    // region sit inside it.
    const narrow = container.querySelector('.sr-weather-narrow')!
    expect(narrow.contains(region)).toBe(false)
    expect(narrow.querySelector('[role="status"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /predict weather and tide/i }))
    await screen.findByLabelText(/Latitude/)
    await waitFor(() => expect(onPlanVisible).toHaveBeenLastCalledWith(false))
    expect(narrow.contains(screen.getByLabelText(/Latitude/))).toBe(true)
  })
})
