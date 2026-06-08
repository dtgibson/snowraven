// @vitest-environment jsdom
// Integration tests for the Weather & Tide section: the explicit, no-auto-fetch
// Load action; per-side independence and scoped errors; the reconciliation note
// trigger; the keys-absent nudge + Settings navigation; and the no-auto-copy /
// copy-on-press contract. The transport and clipboard SEAMS are mocked so we
// control weather/tide responses and observe copyText without a real backend or
// real clipboard. Covers QA-07/08/09/11/12/13/14/18 (and 15 via the per-side
// independence path).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { TransportError } from '../lib/transport'
import type { ChecklistMeta } from '../lib/compareChecklists'
import { formatWeather } from '../lib/weatherFormatter'
import type { HourlyResponse } from '../lib/weatherFormatter'
import { formatTide, formatTideBody } from '../lib/tideFormatter'
import type { TideReading } from '../lib/tide'
import type { TideStation } from '../lib/tideStations'

// ── Seam mocks ────────────────────────────────────────────────────────────────
const getMock = vi.fn()
vi.mock('../lib/transport', async (orig) => {
  const actual = await orig<typeof import('../lib/transport')>()
  return {
    ...actual, // keep the real TransportError class
    transport: { get: (...a: unknown[]) => getMock(...a), post: vi.fn() },
  }
})

const copyMock = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true))
vi.mock('../lib/clipboard', () => ({ copyText: (...a: unknown[]) => copyMock(...a) }))

import { WeatherTideSection } from './WeatherTideSection'

// ── Fixtures: real formatter output so the section renders the genuine blocks ──
const hour: HourlyResponse = {
  data: [{
    temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
    clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
    sunrise: 1716550000, sunset: 1716600000,
  }],
}
const WEATHER_FORMATTED = formatWeather([hour], 'America/Los_Angeles')

const STN: TideStation = { id: '9410660', name: 'Los Angeles', lat: 33.7, lng: -118.2, state: 'CA', obs: true }
const reading: TideReading = {
  levelMin: 4.1, levelMax: 5.3, source: 'predicted', trend: 'falling', turnedDuring: true,
  prevHL: { kind: 'high', v: 5.4, timeLocal: '9:12am' },
  nextHL: { kind: 'low', v: 0.7, timeLocal: '4:38pm' },
  station: STN, distanceMi: 11.2,
}
const TIDE_FORMATTED = formatTide(reading)
const TIDE_BODY = formatTideBody(reading)

const WEATHER_OK = { formatted: WEATHER_FORMATTED, checklist_id: 'X', loc_name: 'L', obs_dt: '2024-01-01 06:30' }
const TIDE_OK = { status: 'ok', formatted: TIDE_FORMATTED, body: TIDE_BODY }
const TIDE_TOO_FAR = { status: 'too-far', station: { id: STN.id, name: STN.name }, distanceMi: 38.4 }

// A plain meta and a meta whose comment carries an embedded weather block.
const plainMeta: ChecklistMeta = {
  locName: 'Plain Marsh', obsDt: '2024-01-01 06:30', protocolId: '', durationHrs: null,
  distanceKm: null, distanceUnit: '', numObservers: null, submissionMethod: '', submissionVersion: '', comments: '',
}
const embeddedWeatherMeta: ChecklistMeta = {
  ...plainMeta, locName: 'Coast Point',
  comments: `Calm dawn.\n${WEATHER_FORMATTED}`,
}

const KEYS_OK = { ebird: 'k', openweather: 'k' }

function setup(over: Partial<React.ComponentProps<typeof WeatherTideSection>> = {}) {
  const onGoToSettings = vi.fn()
  const props = {
    idA: 'S1', idB: 'S2', metaA: plainMeta, metaB: plainMeta,
    keyStatus: KEYS_OK, onGoToSettings, ...over,
  }
  render(<WeatherTideSection {...props} />)
  return { onGoToSettings }
}

// Route a transport.get call to the right response by path + id.
function routeBy(map: Record<string, unknown>) {
  getMock.mockImplementation((path: string) => {
    if (path in map) {
      const v = map[path]
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
    }
    return Promise.reject(new Error(`unexpected path ${path}`))
  })
}

beforeEach(() => {
  getMock.mockReset()
  copyMock.mockClear()
})
afterEach(cleanup)

// ── QA-07 / QA-18: no auto-fetch, no auto-copy on mount ─────────────────────────
describe('explicit-action lookup — no auto-fetch (QA-07)', () => {
  it('fires NO transport.get on mount; the Load button is shown', () => {
    setup()
    expect(getMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /load weather & tide/i })).toBeTruthy()
    // and nothing is copied just by rendering
    expect(copyMock).not.toHaveBeenCalled()
  })

  it('clicking Load fetches weather + tide for BOTH A and B', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_OK,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(4))
    const paths = getMock.mock.calls.map(c => c[0])
    expect(paths).toContain('/weather/S1')
    expect(paths).toContain('/tide/S1')
    expect(paths).toContain('/weather/S2')
    expect(paths).toContain('/tide/S2')
  })
})

// ── QA-08: loaded section shows the same formatted blocks; both sides render ────
describe('loaded section renders the reused formatted blocks (QA-08)', () => {
  it('renders the real weather + tide blocks for both sides after Load', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_OK,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    // Both sides produce the same formatted blocks → 2 weather + 2 tide <pre>s.
    await waitFor(() => {
      expect(screen.getAllByText((_, n) => !!n && n.textContent === WEATHER_FORMATTED).length).toBeGreaterThanOrEqual(2)
    })
    expect(screen.getAllByText((_, n) => !!n && n.textContent === TIDE_FORMATTED).length).toBeGreaterThanOrEqual(2)
  })
})

// ── QA-09 / QA-15: per-side independence; one side errors, the other renders ────
describe('per-side independence — scoped error, section not blanked (QA-09/15)', () => {
  it('B weather fails → A renders fully, B shows a scoped error with the detail', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_OK,
      '/weather/S2': new TransportError('boom', 502, 'Upstream weather provider error'),
      '/tide/S2': TIDE_OK,
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))

    // A's weather block renders.
    await waitFor(() => {
      expect(screen.getAllByText((_, n) => !!n && n.textContent === WEATHER_FORMATTED).length).toBeGreaterThanOrEqual(1)
    })
    // B's weather error surfaces the backend detail in an alert.
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Upstream weather provider error')

    // The section is not blanked: tide blocks for BOTH sides still render (B's
    // tide succeeded independently of B's weather failure).
    expect(screen.getAllByText((_, n) => !!n && n.textContent === TIDE_FORMATTED).length).toBe(2)
  })

  it("a side's tide failure does not affect that side's weather", async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': new TransportError('nope', 500),
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    // A's weather still renders despite A's tide error line.
    await waitFor(() => {
      expect(screen.getAllByText((_, n) => !!n && n.textContent === WEATHER_FORMATTED).length).toBe(2)
    })
    expect(screen.getByText(/tide data unavailable right now/i)).toBeTruthy()
  })
})

// ── QA-11 / QA-12: reconciliation note present vs absent ────────────────────────
describe('reconciliation note (QA-11/12)', () => {
  const NOTE = /OpenWeather revises its historical/i

  it('appears for a side with an embedded weather block AND a successful lookup (QA-11)', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_OK,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup({ metaA: embeddedWeatherMeta, metaB: plainMeta })
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    await waitFor(() => expect(screen.getByText(NOTE)).toBeTruthy())
    // Exactly one note — only side A had an embedded block.
    expect(screen.getAllByText(NOTE).length).toBe(1)
  })

  it('does NOT appear with no embedded block (QA-12)', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_OK,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup({ metaA: plainMeta, metaB: plainMeta })
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    await waitFor(() => {
      expect(screen.getAllByText((_, n) => !!n && n.textContent === WEATHER_FORMATTED).length).toBe(2)
    })
    expect(screen.queryByText(NOTE)).toBeNull()
  })

  it('does NOT appear for a tide-only embedded block (QA-12)', async () => {
    const tideOnlyMeta: ChecklistMeta = { ...plainMeta, comments: `Low water.\n${TIDE_FORMATTED}` }
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_OK,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup({ metaA: tideOnlyMeta, metaB: plainMeta })
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    await waitFor(() => {
      expect(screen.getAllByText((_, n) => !!n && n.textContent === WEATHER_FORMATTED).length).toBe(2)
    })
    expect(screen.queryByText(NOTE)).toBeNull()
  })

  it('does NOT appear when the embedded-block side has a FAILED lookup (QA-12)', async () => {
    routeBy({
      '/weather/S1': new TransportError('down', 502, 'weather down'), '/tide/S1': TIDE_OK,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup({ metaA: embeddedWeatherMeta, metaB: plainMeta })
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    // Side A has the embedded block but its weather lookup failed → no note.
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.queryByText(NOTE)).toBeNull()
  })
})

// ── QA-18: no auto-copy on Load; copy only on explicit button press ─────────────
describe('copy buttons — no auto-copy, copy on press only (QA-18)', () => {
  it('Load does NOT call copyText; pressing Copy does', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_OK,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    await waitFor(() => {
      expect(screen.getAllByText((_, n) => !!n && n.textContent === WEATHER_FORMATTED).length).toBe(2)
    })
    // After a full load, nothing has been copied.
    expect(copyMock).not.toHaveBeenCalled()

    // Press a "Copy weather" button → copyText called with the weather block.
    const copyWeather = screen.getAllByRole('button', { name: /copy weather output/i })[0]
    fireEvent.click(copyWeather)
    expect(copyMock).toHaveBeenCalledTimes(1)
    expect(copyMock).toHaveBeenCalledWith(WEATHER_FORMATTED)
  })

  it('Copy tide copies the standalone tide block', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_OK,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    const copyTide = (await screen.findAllByRole('button', { name: /copy tide output/i }))[0]
    fireEvent.click(copyTide)
    expect(copyMock).toHaveBeenCalledWith(TIDE_FORMATTED)
  })

  it('Copy weather & tide together emits a single combined block', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_OK,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    const both = (await screen.findAllByRole('button', { name: /copy weather and tide together/i }))[0]
    fireEvent.click(both)
    expect(copyMock).toHaveBeenCalledTimes(1)
    const arg = copyMock.mock.calls[0][0] as string
    // One combined SnowRaven attribution; the weather block's own trailing
    // attribution line is stripped (single attribution — QA-18).
    expect(arg).toContain('Weather and tide generated by')
    expect(arg.split('Weather and tide generated by').length - 1).toBe(1)
  })

  it('omits the Copy tide button when that side has no tide (status unavailable)', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': { status: 'unavailable' },
      '/weather/S2': WEATHER_OK, '/tide/S2': { status: 'unavailable' },
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    await waitFor(() => {
      expect(screen.getAllByText((_, n) => !!n && n.textContent === WEATHER_FORMATTED).length).toBe(2)
    })
    expect(screen.queryByRole('button', { name: /copy tide output/i })).toBeNull()
    expect(screen.getAllByText(/no tide reading available/i).length).toBe(2)
    // No combined copy either (needs tide ok).
    expect(screen.queryByRole('button', { name: /copy weather and tide together/i })).toBeNull()
  })
})

// ── QA-10 (partial): tide too-far notice + override re-fetch ────────────────────
describe('tide too-far notice + one-tap override (QA-10)', () => {
  it('shows the too-far notice and re-fetches with force on override', async () => {
    routeBy({
      '/weather/S1': WEATHER_OK, '/tide/S1': TIDE_TOO_FAR,
      '/weather/S2': WEATHER_OK, '/tide/S2': TIDE_OK,
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /load weather & tide/i }))
    const override = await screen.findByRole('button', { name: /show the nearest tide station anyway/i })
    expect(screen.getByText(/nearest tide station is 38 miles away/i)).toBeTruthy()

    // Pressing override re-fetches THAT side's tide with force:'1'.
    getMock.mockClear()
    getMock.mockResolvedValueOnce(TIDE_OK)
    fireEvent.click(override)
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
    expect(getMock).toHaveBeenCalledWith('/tide/S1', { force: '1' })
  })
})

// ── QA-13 / QA-14: keys-absent nudge + Settings navigation ─────────────────────
describe('keys-absent nudge + Settings navigation (QA-13/14)', () => {
  it('OpenWeather missing → nudge naming it, no Load button, no fetch', () => {
    setup({ keyStatus: { ebird: 'k', openweather: null } })
    expect(screen.getByText(/OpenWeather API key not configured/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /load weather & tide/i })).toBeNull()
    expect(getMock).not.toHaveBeenCalled()
  })

  it('eBird missing → nudge names eBird', () => {
    setup({ keyStatus: { ebird: null, openweather: 'k' } })
    expect(screen.getByText(/eBird API key not configured/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /load weather & tide/i })).toBeNull()
  })

  it('both missing → both nudges shown', () => {
    setup({ keyStatus: { ebird: null, openweather: null } })
    expect(screen.getByText(/eBird API key not configured/i)).toBeTruthy()
    expect(screen.getByText(/OpenWeather API key not configured/i)).toBeTruthy()
  })

  it('clicking "Go to Settings" calls onGoToSettings (QA-14)', () => {
    const { onGoToSettings } = setup({ keyStatus: { ebird: null, openweather: 'k' } })
    fireEvent.click(screen.getByRole('button', { name: /go to settings/i }))
    expect(onGoToSettings).toHaveBeenCalledTimes(1)
  })

  it('keyStatus === null (still resolving) shows Load, NOT a nudge', () => {
    setup({ keyStatus: null })
    expect(screen.getByRole('button', { name: /load weather & tide/i })).toBeTruthy()
    expect(screen.queryByText(/not configured/i)).toBeNull()
  })
})
