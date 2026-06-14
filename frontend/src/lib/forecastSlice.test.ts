import { describe, it, expect } from 'vitest'
import { pickForecastSlice, buildWeatherPayload, type OneCallResponse } from './forecastSlice'

// Mirror of backend/tests/test_forecast.py — same fixtures + assertions lock the
// TS↔Python tier/adapter parity.
const NOW = 1718000000
const TZ = 'UTC'

function hour(dt: number, temp = 60, wid = 802, desc = 'scattered clouds') {
  return { dt, temp, humidity: 70, dew_point: 50, wind_speed: 8, wind_deg: 270, clouds: 20, weather: [{ id: wid, description: desc }] }
}
function current() {
  return { ...hour(NOW, 61), sunrise: NOW - 3 * 3600, sunset: NOW + 6 * 3600 }
}
function daily(dt: number, day = 58, lo = 51, hi = 64) {
  return { dt, temp: { day, min: lo, max: hi }, humidity: 78, dew_point: 50, wind_speed: 6, wind_deg: 315, clouds: 30, weather: [{ id: 801, description: 'few clouds' }], sunrise: dt - 6 * 3600, sunset: dt + 6 * 3600 }
}
function onecall(): OneCallResponse {
  return {
    current: current(),
    hourly: Array.from({ length: 48 }, (_, i) => hour(NOW + i * 3600, 60 + (i % 5))),
    daily: Array.from({ length: 8 }, (_, d) => daily(NOW + 12 * 3600 + d * 86400)),
  }
}

describe('pickForecastSlice', () => {
  it('current when no target', () => {
    expect(pickForecastSlice(onecall()).resolution).toBe('current')
  })
  it('current within an hour', () => {
    expect(pickForecastSlice(onecall(), NOW + 1800).resolution).toBe('current')
  })
  it('hourly within 48h', () => {
    const p = pickForecastSlice(onecall(), NOW + 6 * 3600)
    expect(p.resolution).toBe('hourly')
    if (p.resolution === 'hourly') expect(Math.abs(p.slice.dt - (NOW + 6 * 3600))).toBeLessThanOrEqual(1800)
  })
  it('daily beyond 48h', () => {
    expect(pickForecastSlice(onecall(), NOW + 72 * 3600).resolution).toBe('daily')
  })
  it('out-of-range beyond 8 days', () => {
    const p = pickForecastSlice(onecall(), NOW + 9 * 86400)
    expect(p.resolution).toBe('out-of-range')
    expect(p.slice).toBeNull()
  })
})

describe('buildWeatherPayload', () => {
  it('current', () => {
    const p = buildWeatherPayload(onecall(), undefined, TZ, 40)
    expect(p.resolution).toBe('current')
    expect(p.formatted).toContain('Temperature:')
    expect(p.formatted).toContain('SnowRaven')
    expect(p.summary?.isDaily).toBe(false)
    expect(p.summary?.tempF).toBe(61)
  })
  it('daily has range + high/low', () => {
    const p = buildWeatherPayload(onecall(), NOW + 72 * 3600, TZ, 40)
    expect(p.resolution).toBe('daily')
    expect(p.summary?.isDaily).toBe(true)
    expect(p.summary?.highF).toBe(64)
    expect(p.summary?.lowF).toBe(51)
    expect(p.formatted).toContain('Temperature: 51 - 64°F')
  })
  it('out-of-range has no weather', () => {
    const p = buildWeatherPayload(onecall(), NOW + 9 * 86400, TZ, 40)
    expect(p.resolution).toBe('out-of-range')
    expect(p.formatted).toBeNull()
    expect(p.summary).toBeNull()
  })
  it('hourly injects sun lines', () => {
    const p = buildWeatherPayload(onecall(), NOW + 6 * 3600, TZ, 40)
    expect(p.resolution).toBe('hourly')
    expect(p.formatted).toContain('Sunrise:')
    expect(p.formatted).toContain('Sunset:')
  })
})
