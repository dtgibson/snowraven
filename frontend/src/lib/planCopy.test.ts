// The Weather/tide Planner's copy module, swept as rules over a corpus built by
// CALLING every exported builder per render state (the testing rule for
// count-bearing copy, v1.0.22): no count of one takes a plural noun, no em
// dash anywhere, no ranking or recommending language (FR-50), and the exact
// strings the design spec fixes. What this guard cannot see: a count-bearing
// string built inline in a component; PlanResult.test.tsx renders the real
// thing as the second half of the pair.
import { describe, it, expect } from 'vitest'
import { PLAN_COPY } from './planCopy'
import { FORECAST_DAILY_LABEL, FORECAST_HOURLY_LABEL } from './forecastLabels'

/** Every string the module can produce, over the render states a plan reaches:
 *  one to sixteen days, one to forty-eight strip readings, each bracket shape. */
function corpus(): string[] {
  const out: string[] = []
  for (const v of Object.values(PLAN_COPY)) if (typeof v === 'string') out.push(v)
  for (let n = 1; n <= 16; n += 1) out.push(PLAN_COPY.pill(n))
  for (let n = 1; n <= 48; n += 1) out.push(PLAN_COPY.skySummary(n))
  out.push(PLAN_COPY.loading('Del Monte Beach'), PLAN_COPY.ready('Del Monte Beach'))
  out.push(PLAN_COPY.localTimeLine('36.603', '-121.876', '3:41 PM'))
  out.push(PLAN_COPY.stationLine('MONTEREY, MONTEREY BAY', '9413450', '0.9'))
  out.push(PLAN_COPY.daySky('Overcast clouds', 63, 54), PLAN_COPY.daySky('Overcast clouds', null, null))
  out.push(PLAN_COPY.skyBoundary('2:30 PM', 'Scattered clouds'))
  out.push(PLAN_COPY.tideHeight('0.7'))
  for (const n of [1, 2, 3, 5, 8, 16]) for (const v of ['1', '3', '7', 'all'] as const) out.push(PLAN_COPY.daysOption(v, n))
  for (const h of [3, 6]) out.push(PLAN_COPY.stripHourlyEvery(h), PLAN_COPY.stripHourlyShort(h))
  const side = PLAN_COPY.bracketSide('low', '−1.2', '4:48 PM')
  out.push(side, PLAN_COPY.bracketBetween(side, side), PLAN_COPY.bracketAfter(side), PLAN_COPY.bracketBefore(side))
  out.push(PLAN_COPY.chartNameWithTide('Del Monte Beach', 'Sat, Sep 12, 2026, 3:41 PM', 'Sat, Sep 19, 2026, 11:59 PM'))
  out.push(PLAN_COPY.chartNameNoTide('Del Monte Beach', 'Sat, Sep 12, 2026, 3:41 PM', 'Sat, Sep 19, 2026, 11:59 PM'))
  return out
}

describe('the planner copy corpus', () => {
  const all = corpus()

  it('is not vacuous', () => {
    expect(all.length).toBeGreaterThan(90)
    expect(all.filter(s => /\b1 /.test(s)).length).toBeGreaterThanOrEqual(2)
  })

  it('carries no em dash', () => {
    for (const s of all) expect(s.includes('—'), s).toBe(false)
  })

  it('no count of one takes a plural noun, and no count above one takes the singular', () => {
    for (const s of all) {
      expect(/\b1 [a-z]+s\b/.test(s), s).toBe(false)
      expect(/\b([2-9]|[1-9]\d) (day|reading|HOUR)\b/.test(s), s).toBe(false)
    }
    expect(PLAN_COPY.pill(1)).toBe('Plan · 1 day')
    expect(PLAN_COPY.pill(8)).toBe('Plan · 8 days')
    expect(PLAN_COPY.skySummary(1)).toBe('Sky hour by hour, 1 reading')
    expect(PLAN_COPY.skySummary(24)).toBe('Sky hour by hour, 24 readings')
    expect(PLAN_COPY.daysOption('1', 8)).toBe('1 day')
    expect(PLAN_COPY.daysOption('all', 1)).toBe('All 1 day')
    expect(PLAN_COPY.daysOption('all', 8)).toBe('All 8 days')
  })

  it('ranks and recommends nothing (FR-50)', () => {
    for (const s of all) {
      const low = s.toLowerCase()
      for (const phrase of ['best', 'good morning', 'recommend', 'should', 'ideal', 'score', 'rank']) {
        expect(low.includes(phrase), `${s}: "${phrase}"`).toBe(false)
      }
    }
  })
})

describe('the exact strings the design fixes', () => {
  it('the action, caption, region, loading and ready words', () => {
    expect(PLAN_COPY.actionLabel).toBe('Plan sunrises and sunsets')
    expect(PLAN_COPY.caption).toBe('The plan runs from now to the end of the forecast, about eight days, for the place above. The date and time apply only to Get forecast.')
    expect(PLAN_COPY.regionName).toBe('Weather and tide plan')
    expect(PLAN_COPY.loading('X')).toBe('Building the plan for X…')
    expect(PLAN_COPY.ready('X')).toBe('Plan ready for X.')
  })

  it('the daily resolution label is Predict\'s, shared through forecastLabels, and the hourly one is parallel', () => {
    expect(PLAN_COPY.dailyLabel).toBe(FORECAST_DAILY_LABEL)
    expect(PLAN_COPY.dailyLabel).toBe('FORECAST · DAILY')
    expect(PLAN_COPY.hourlyLabel).toBe(FORECAST_HOURLY_LABEL)
    expect(PLAN_COPY.hourlyLabel).toBe('FORECAST · HOURLY')
    expect(PLAN_COPY.stripDailyTag).toBe('FORECAST · DAILY FROM HERE')
  })

  it('the closing note states both facts: tide reaches further, and Get forecast covers a later moment', () => {
    expect(PLAN_COPY.closingNote).toBe('The plan stops where the weather forecast stops. Tide predictions reach further ahead: for any later moment, use Get forecast with a date and time.')
  })

  it('the bracket wordings and the polar notes', () => {
    expect(PLAN_COPY.bracketAfter('high 5.4 ft (4:12 PM)')).toBe('after high 5.4 ft (4:12 PM); no later high or low in the data')
    expect(PLAN_COPY.bracketBefore('low 0.6 ft (11:07 PM)')).toBe('before low 0.6 ft (11:07 PM); no earlier high or low in the data')
    expect(PLAN_COPY.bracketNone).toBe('no high or low in the data on either side')
    expect(PLAN_COPY.tideTrendUnknown).toBe('trend unknown (no later high or low in the data)')
    expect(PLAN_COPY.noSunrise).toBe('No sunrise this day.')
    expect(PLAN_COPY.noSunset).toBe('No sunset this day.')
    expect(PLAN_COPY.tideUnavailable).toBe('Tide is unavailable for this spot.')
  })
})
