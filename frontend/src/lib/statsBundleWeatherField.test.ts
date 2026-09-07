/// <reference types="node" />
// The weather field's place in the worker payload (weather-stats FR-32, QA-28).
//
// THE TRAP THIS FILE EXISTS FOR, stated first because it is silent and green.
// `isStatsBundle` rejects a bundle when any table field is `undefined` OR
// `null`. The instinctive way to express "the section is hidden when nothing was
// found" is for `computeWeatherStats` to return `null` at zero blocks -- and
// that would fail validation on EVERY reply for EVERY user with no weather
// blocks. The promise would settle, the reply would be rejected as unusable,
// `useStatsBundle` would fall back, and the tab would compute the whole chain on
// the thread that paints, forever, silently, on exactly the users the worker
// exists for, with every figure correct and no test red.
//
// So the two halves below are one guard and neither is optional: a bundle with
// the field STRIPPED must FAIL, and a bundle for a user with NO BLOCKS AT ALL
// must PASS. Asserting only the first is how the trap ships.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { computeStatsBundle, isStatsBundle, EMPTY_STATS_BUNDLE } from './statsBundle'
import { weatherSectionState } from './weatherStats'
import { formatWeather } from './weatherFormatter'
import type { HourlyResponse } from './weatherFormatter'
import type { ObservationEntry } from '../types'

const hour: HourlyResponse = {
  data: [{
    dt: 1716570000, temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
    clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
    sunrise: 1716550000, sunset: 1716600000,
  }],
}
const BLOCK = formatWeather([hour], 'America/Los_Angeles', 33.7)

function obs(submissionId: string, commonName: string, checklistComments: string): ObservationEntry {
  return {
    submissionId, commonName, scientificName: 'Genus species',
    date: '2024-05-24', location: 'Pond', locationId: 'L1',
    latitude: 1, longitude: 2, county: 'C', count: 1, breedingCode: null,
    speciesComments: '', catalogIds: [], time: '07:00 AM', duration: 60,
    distance: 1, area: null, protocol: 'Traveling', numObservers: 1,
    allObsReported: true, checklistComments, stateProvince: 'US-CA',
  }
}

const REQUEST = { includeSpuh: false, granularity: 'total' as const, excludedNames: [] }

describe('the weather field and the bundle predicate (FR-32, QA-28)', () => {
  it('a bundle with the field STRIPPED is rejected, so the tab falls back rather than hanging', () => {
    const good = computeStatsBundle([obs('S1', 'Anna\'s Hummingbird', BLOCK)], REQUEST)
    expect(isStatsBundle(good)).toBe(true)
    const stripped = { ...good } as Record<string, unknown>
    delete stripped.weather
    expect(isStatsBundle(stripped)).toBe(false)
    // And the two shapes the predicate treats identically, because both are how
    // a half-built reply actually arrives.
    expect(isStatsBundle({ ...good, weather: undefined })).toBe(false)
    expect(isStatsBundle({ ...good, weather: null })).toBe(false)
  })

  it('A BUNDLE FOR A USER WITH NO WEATHER BLOCKS PASSES, which is the other half of the same guard', () => {
    const none = computeStatsBundle([obs('S1', 'Anna\'s Hummingbird', 'A lovely morning.')], REQUEST)
    expect(none.weather.foundCount).toBe(0)
    // Absence is expressed INSIDE the object, never by a null field.
    expect(none.weather).not.toBeNull()
    expect(weatherSectionState(none.weather)).toBe('absent')
    expect(isStatsBundle(none)).toBe(true)
  })

  it('the EMPTY bundle passes too, which is what the shell pass renders from', () => {
    expect(isStatsBundle(EMPTY_STATS_BUNDLE)).toBe(true)
    expect(EMPTY_STATS_BUNDLE.weather.foundCount).toBe(0)
    expect(weatherSectionState(EMPTY_STATS_BUNDLE.weather)).toBe('absent')
  })

  it('the field is in BOTH the interface and the BUNDLE_FIELDS table', () => {
    // Omitting the table row would be a build error rather than a hole in the
    // predicate, because the table is a `Record<keyof StatsBundle, true>` -- but
    // a build error is only a guard for someone who runs the build, and the
    // predicate's reach is what this asserts. Read from the source so the claim
    // is about the shipped table rather than about this test's imagination.
    const src = readFileSync(fileURLToPath(new URL('./statsBundle.ts', import.meta.url)), 'utf8')
    expect(src).toContain('weather: WeatherStats')
    expect(src).toContain('weather: true,')
    expect(src).toContain('weather: computeWeatherStats(checklists, filtered)')
    // The predicate is driven by the table, not by a hand-written roster, so the
    // row is what gives it reach. Proved behaviourally above; asserted
    // structurally here.
    expect(src).toContain('Object.keys(BUNDLE_FIELDS)')
  })

  it('the whole bundle still survives a structured clone with the new field on it (FR-33)', () => {
    const b = computeStatsBundle(
      [obs('S1', 'Anna\'s Hummingbird', BLOCK), obs('S2', 'American Crow', BLOCK)],
      REQUEST,
    )
    const cloned = structuredClone(b)
    expect(cloned.weather).toEqual(b.weather)
    expect(isStatsBundle(cloned)).toBe(true)
  })

  it('the worker path and the main-thread fallback compute equal weather figures (QA-29)', () => {
    // Both threads run the SAME function, which is the property this asserts:
    // there is no second copy of the wiring, so equality is structural. The
    // clone round trip stands in for the boundary.
    const input = [obs('S1', 'Anna\'s Hummingbird', BLOCK), obs('S2', 'American Crow', BLOCK)]
    const onThisThread = computeStatsBundle(input, REQUEST)
    const acrossTheWire = structuredClone(computeStatsBundle(input, REQUEST))
    expect(acrossTheWire.weather).toEqual(onThisThread.weather)
  })

  it('the section state agrees with the figures it is derived from', () => {
    const withBlocks = computeStatsBundle(
      Array.from({ length: 3 }, (_, i) => obs(`S${i}`, 'Anna\'s Hummingbird', BLOCK)),
      REQUEST,
    )
    expect(withBlocks.weather.foundCount).toBe(3)
    expect(weatherSectionState(withBlocks.weather)).toBe('below-floor')
  })
})
