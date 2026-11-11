// @vitest-environment jsdom
// MARKUP GOLDEN for the Statistics Weather section and the Species Detail
// Weather card (hotspot-reports schema 8.1).
//
// WHY THIS FILE EXISTS AND WHY ITS ORDER MATTERS. The distribution row
// (`DistRow`) leaves `WeatherStatsSection.tsx` for its own file,
// `WeatherDistRow.tsx`, so the Hotspot Reports tab renders the one
// implementation rather than a copy. That extraction must change nothing a user
// sees, and "before and after" can only be compared if the BEFORE exists as an
// artifact. So `WeatherDistRow.golden.json` was captured from the UNMODIFIED
// section, run green, and only then was the row extracted, with this file and
// `WeatherStatsSection.test.tsx` and `SpeciesWeatherCard.test.tsx` untouched
// (testing.md, the v1.0.22 golden-before-refactor rule). If this suite goes red,
// fix the code, never the JSON.
//
// HOW THE GOLDEN WAS CAPTURED: `SR_CAPTURE_WEATHER_GOLDEN=1 npx vitest run
// src/components/WeatherDistRow.golden.test.tsx` writes the JSON instead of
// comparing. A capture is a deliberate act and is never run in the same change
// as a refactor of what it pins.
//
// The fixtures are built by running real observation rows through
// `computeChecklists` and `computeWeatherStats`, with the blocks built by the
// real formatter, as the section's own suite builds them. React `useId` values
// are renumbered by first appearance so the golden pins the markup's structure,
// not the process-wide id counter.

import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { WeatherStatsSection } from './WeatherStatsSection'
import { SpeciesWeatherCard } from './SpeciesWeatherCard'
import { computeWeatherStats } from '../lib/weatherStats'
import type { WeatherStats } from '../lib/weatherStats'
import { computeChecklists } from '../lib/birdingStats'
import { normalizeSpeciesName } from '../lib/speciesUtils'
import { formatWeather } from '../lib/weatherFormatter'
import type { HourlyResponse } from '../lib/weatherFormatter'
import type { ObservationEntry } from '../types'

const GOLDEN = join(dirname(fileURLToPath(import.meta.url)), 'WeatherDistRow.golden.json')
const CAPTURE = process.env.SR_CAPTURE_WEATHER_GOLDEN === '1'

const TZ = 'America/Los_Angeles'
function hourly(over: Partial<HourlyResponse['data'][number]> = {}): HourlyResponse {
  return {
    data: [{
      dt: 1716570000, temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
      clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
      sunrise: 1716550000, sunset: 1716600000, ...over,
    }],
  }
}
const block = (temp: number, owmId = 801, wind = 6) =>
  formatWeather([hourly({ temp, wind_speed: wind, weather: [{ id: owmId, description: 'x' }] })], TZ, 33.7)

interface Spec { comment: string; species: string[]; duration?: number | null }

function build(specs: Spec[]): ObservationEntry[] {
  const obs: ObservationEntry[] = []
  specs.forEach((spec, i) => {
    for (const n of spec.species) {
      obs.push({
        submissionId: `S${700000 + i}`, commonName: n, scientificName: `Sci ${n}`,
        date: '2024-05-24', location: 'Pond', locationId: 'L1',
        latitude: 1, longitude: 2, county: 'C', count: 1, breedingCode: null,
        speciesComments: '', catalogIds: [], time: '07:00 AM',
        duration: spec.duration === undefined ? 60 : spec.duration,
        distance: 1, area: null, protocol: 'Traveling', numObservers: 1,
        allObsReported: true, checklistComments: spec.comment, stateProvince: 'US-CA',
      })
    }
  })
  return obs
}

function statsOf(obs: ObservationEntry[]): WeatherStats {
  return computeWeatherStats(computeChecklists(obs), obs)
}

/** Varied bands on every axis, so every row state appears: zero, small, large. */
function fullSpecs(): Spec[] {
  const out: Spec[] = []
  const temps = [20, 40, 50, 60, 60, 70, 70, 70, 80, 90]
  const sky = [800, 801, 802, 803, 804, 500, 600, 741, 200, 300]
  for (let i = 0; i < 14; i++) {
    out.push({
      comment: `Nice morning. ${block(temps[i % temps.length], sky[i % sky.length], 2 + (i % 5) * 3)}`,
      species: Array.from({ length: 6 + (i % 4) }, (_, k) => `Sp ${k}`).concat(i < 11 ? ['Ruby-crowned Kinglet'] : []),
    })
  }
  out.push({ comment: 'No block here.', species: ['Sp 0'] })
  return out
}

/** React's useId values, renumbered by first appearance. */
function normalizeIds(html: string): string {
  const seen = new Map<string, string>()
  return html.replace(/(?:\u00abr[0-9a-z]+\u00bb|:r[0-9a-z]+:)/g, m => {
    let v = seen.get(m)
    if (v === undefined) { v = `\u00abid${seen.size}\u00bb`; seen.set(m, v) }
    return v
  })
}

const PROPS = {
  onGoToWeather: () => {},
  codeFor: () => undefined,
  hasEntryFor: () => false,
  sciFor: (n: string) => `Sci ${n}`,
}

function captureAll(): Record<string, string> {
  const out: Record<string, string> = {}

  const full = statsOf(build(fullSpecs()))
  let r = render(<WeatherStatsSection stats={full} {...PROPS} />)
  out['statistics-full'] = normalizeIds(r.container.innerHTML)
  cleanup()

  const thin = statsOf(build(fullSpecs().slice(0, 3)))
  r = render(<WeatherStatsSection stats={thin} {...PROPS} />)
  out['statistics-below-floor'] = normalizeIds(r.container.innerHTML)
  cleanup()

  r = render(<WeatherStatsSection stats={full} {...PROPS} />)
  fireEvent.focus(r.container.querySelector('input[role="combobox"]')!)
  const option = [...r.container.querySelectorAll('[role="option"]')]
    .find(o => o.textContent?.includes('Ruby-crowned Kinglet'))!
  fireEvent.click(option)
  out['statistics-species'] = normalizeIds(r.container.innerHTML)
  cleanup()

  const obs = build(fullSpecs())
  const own = new Map<string, Set<string>>()
  for (const o of obs) {
    const n = normalizeSpeciesName(o.commonName)
    let s = own.get(n)
    if (s === undefined) { s = new Set(); own.set(n, s) }
    s.add(o.submissionId)
  }
  const ownChecklists = new Map<string, number>()
  for (const [n, s] of own) ownChecklists.set(n, s.size)
  r = render(
    <SpeciesWeatherCard
      stats={statsOf(obs)} ownChecklists={ownChecklists} selectedSpecies="Ruby-crowned Kinglet"
      sciName="Regulus calendula" filtersActive={false} onGoToWeather={() => {}}
    />,
  )
  out['species-card-full'] = normalizeIds(r.container.innerHTML)
  cleanup()
  return out
}

afterEach(cleanup)

describe('the Weather section markup is unchanged by the distribution-row extraction', () => {
  it('matches the golden captured from the unmodified section, state by state', () => {
    const now = captureAll()
    if (CAPTURE) {
      writeFileSync(GOLDEN, JSON.stringify(now, null, 2) + '\n')
      return
    }
    expect(existsSync(GOLDEN), 'the golden is missing: capture it from the UNMODIFIED section first').toBe(true)
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Record<string, string>
    expect(Object.keys(now).sort()).toEqual(Object.keys(golden).sort())
    for (const key of Object.keys(golden)) expect(now[key], key).toBe(golden[key])
    // Non-vacuity: the full state really draws distribution rows in all three
    // row states (zero, a fill, and a count with its share).
    expect(golden['statistics-full']).toContain('sr-wx-row')
    expect(golden['statistics-full']).toContain('is-zero')
    expect(golden['statistics-full']).toContain('sr-wx-fill')
  })
})
