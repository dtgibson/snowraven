// @vitest-environment jsdom
/// <reference types="node" />
// The scheduling, asserted by CALL COUNT rather than by timing
// (species-detail-weather, NFR-01, NFR-02, NFR-03, QA-20, QA-21, QA-22, QA-36).
//
// WHY CALL COUNT. NFR-01's 20 ms budget and NFR-02's 1 ms are measured on the
// reference export on a quiet machine and recorded at the definition site;
// re-measuring them here would be a timing-ratio assertion on a machine that may
// be compiling something else, which `.claude/rules/testing.md` records going
// wrong in this repo already. What a unit test CAN prove, and what NFR-02 asks
// for in those words, is that a species change calls `computeWeatherStats` zero
// times and parses zero weather blocks -- and that the one call there is happens
// after a frame rather than during a render.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, cleanup } from '@testing-library/react'
import { useState } from 'react'

const computeCalls = vi.fn()

vi.mock('./weatherStats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./weatherStats')>()
  return {
    ...actual,
    computeWeatherStats: (...args: Parameters<typeof actual.computeWeatherStats>) => {
      computeCalls()
      return actual.computeWeatherStats(...args)
    },
  }
})

const { useExportWeather } = await import('./useExportWeather')
const { _resetWeatherStatsMemoForTests } = await import('./weatherStatsShared')
const { formatWeather } = await import('./weatherFormatter')
type HourlyResponse = import('./weatherFormatter').HourlyResponse
type ObservationEntry = import('../types').ObservationEntry

const TZ = 'America/Los_Angeles'
const block = formatWeather([{
  data: [{
    dt: 1716570000, temp: 60, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
    clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
    sunrise: 1716550000, sunset: 1716600000,
  }],
} as HourlyResponse], TZ, 33.7)

let seq = 0
function build(n: number, comment: string, names: string[]): ObservationEntry[] {
  const out: ObservationEntry[] = []
  for (let i = 0; i < n; i++) {
    const sub = `S${300000 + seq++}`
    for (const name of names) {
      out.push({
        submissionId: sub, commonName: name, scientificName: 'Genus species',
        date: '2024-05-24', location: 'Pond', locationId: 'L1', latitude: 1, longitude: 2,
        county: 'C', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
        time: '07:00 AM', duration: 60, distance: 1, area: null, protocol: 'Traveling',
        numObservers: 1, allObsReported: true, checklistComments: comment, stateProvince: 'US-CA',
      })
    }
  }
  return out
}

/** Drain the double `requestAnimationFrame` the hook schedules its work behind.
 *  jsdom's rAF is the shim `test-setup.ts` installs, so two flushes is exactly
 *  the two frames the production path waits for. */
async function frames(n = 2) {
  for (let i = 0; i < n; i++) {
    await act(async () => { await new Promise(r => requestAnimationFrame(() => r(null))) })
  }
}

/** A consumer that re-renders on every "species change" without touching the
 *  observations identity -- which is exactly what the tab's selector does. */
function Harness({ observations, active }: { observations: ObservationEntry[]; active: boolean }) {
  const [species, setSpecies] = useState(0)
  const read = useExportWeather(observations, active)
  return (
    <div>
      <span data-testid="state">{read === null ? 'null' : `ready:${read.stats.readableCount}`}</span>
      <span data-testid="own">{read === null ? '-' : String(read.ownChecklists.get('Anna\'s Hummingbird') ?? 0)}</span>
      <span data-testid="species">{species}</span>
      <button type="button" tabIndex={0} onClick={() => setSpecies(n => n + 1)}>next</button>
    </div>
  )
}

beforeEach(() => { computeCalls.mockClear(); _resetWeatherStatsMemoForTests() })
afterEach(() => { cleanup() })

describe('the aggregate runs after paint, never in a render body (NFR-01)', () => {
  const obs = build(12, block, ['Anna\'s Hummingbird'])

  it('computes NOTHING during the commit that renders the tab', () => {
    // 15.67 ms against a 20 ms budget is 1.28x, not the 2x this repo's own rules
    // call margin, so the scheduling is part of the requirement rather than an
    // implementation taste. A `useMemo` would meet the budget on the development
    // Mac and break it on a Raspberry Pi.
    const { getByTestId } = render(<Harness observations={obs} active />)
    expect(computeCalls).toHaveBeenCalledTimes(0)
    expect(getByTestId('state').textContent).toBe('null')
  })

  it('computes exactly once, after the frames, and hands back both derived values', async () => {
    const { getByTestId } = render(<Harness observations={obs} active />)
    await frames()
    expect(computeCalls).toHaveBeenCalledTimes(1)
    expect(getByTestId('state').textContent).toBe('ready:12')
    expect(getByTestId('own').textContent).toBe('12')
  })

  it('is scheduled behind two frames in the source, not merely in an effect', () => {
    // The first callback fires BEFORE the pending paint and the second AFTER it,
    // which is the shipped `BirdingStats` gate and the only shape that puts the
    // work in the frame after the tab's own content is on screen.
    // Resolved from the vitest root rather than from `import.meta.url`: under
    // the jsdom environment this module's URL is not a file URL.
    const src = readFileSync(resolve(process.cwd(), 'src/lib/useExportWeather.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '')
    expect(src).not.toContain('useMemo')
    expect((src.match(/requestAnimationFrame/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(src).toContain('cancelAnimationFrame')
  })
})

describe('a species change is a lookup, asserted by call count (NFR-02, QA-21, QA-36)', () => {
  it('twenty species changes call computeWeatherStats zero further times', async () => {
    const obs = build(30, block, ['Anna\'s Hummingbird', 'Steller\'s Jay'])
    const { getByTestId, getByRole } = render(<Harness observations={obs} active />)
    await frames()
    expect(computeCalls).toHaveBeenCalledTimes(1)
    const own = getByTestId('own').textContent
    for (let i = 0; i < 20; i++) {
      await act(async () => { getByRole('button').click() })
    }
    expect(getByTestId('species').textContent).toBe('20')
    // Zero further calls, and the map is the SAME answer throughout: the memo is
    // keyed on the observations identity, which a species change does not touch,
    // so a switch structurally cannot reach the compute.
    expect(computeCalls).toHaveBeenCalledTimes(1)
    expect(getByTestId('own').textContent).toBe(own)
  })
})

describe('the gate is what makes the absent state free (NFR-03, QA-22)', () => {
  it('computes nothing at all on an export with no weather block, and stays null', async () => {
    const obs = build(30, '', ['Anna\'s Hummingbird'])
    const { getByTestId } = render(<Harness observations={obs} active />)
    await frames(4)
    expect(computeCalls).toHaveBeenCalledTimes(0)
    expect(getByTestId('state').textContent).toBe('null')
  })

  it('computes nothing while the tab is not ready, and nothing on an empty export', async () => {
    const obs = build(12, block, ['Anna\'s Hummingbird'])
    const { rerender, getByTestId } = render(<Harness observations={obs} active={false} />)
    await frames(4)
    expect(computeCalls).toHaveBeenCalledTimes(0)
    rerender(<Harness observations={[]} active />)
    await frames(4)
    expect(computeCalls).toHaveBeenCalledTimes(0)
    expect(getByTestId('state').textContent).toBe('null')
  })
})

describe('a new export resets synchronously and recomputes (the WeakRef teardown)', () => {
  it('drops back to null in the same commit rather than painting the previous file', async () => {
    const first = build(12, block, ['Anna\'s Hummingbird'])
    const second = build(20, block, ['Anna\'s Hummingbird'])
    const { rerender, getByTestId } = render(<Harness observations={first} active />)
    await frames()
    expect(getByTestId('state').textContent).toBe('ready:12')
    rerender(<Harness observations={second} active />)
    // The reset is deliberate and synchronous, matching the one `useStatsBundle`
    // and `BirdingStats` both document: when the export identity changes we WANT
    // to drop the previous file's figures rather than paint them for a commit.
    expect(getByTestId('state').textContent).toBe('null')
    await frames()
    expect(getByTestId('state').textContent).toBe('ready:20')
    expect(computeCalls).toHaveBeenCalledTimes(2)
  })
})
