// The published claims about the Weather/tide Planner, held to the code
// (tide-weather-planner FR-54 / FR-55 / FR-57, QA-49 / QA-50 / QA-52), in the
// weatherStatsPublishedClaims.test.ts shape: three extractors scoped to each
// file's own planner passage (anchored on the literal name), an existence
// assertion before every claim, the claims held to the CODE rather than to
// each other, the three files compared against each other on the claim
// sentences, and the em-dash check. The privacy policy's one new clause gets
// its own row, because a sentence added to PRIVACY_POLICY.md owes a guard in
// the same change.
//
// WHY PASSAGES RATHER THAN WHOLE FILES: HELP.md's Weather tab section
// legitimately describes Predict's single-moment result in the same
// subsection, README's Weather bullet legitimately describes the checklist
// lookup, and the website's Weather article carries both. A whole-document
// guard would either fail on those or be loosened until it asserted nothing.
//
// MUTATION-VERIFIED in four directions before its first green was trusted,
// each restored byte-identical: the "stops where the forecast stops" sentence
// deleted from HELP alone RED; the four sentences re-worded in README alone
// (one file diverging from the other two) RED; the ranking sentence removed
// from the website RED; and the NOAA clause reverted in PRIVACY_POLICY RED.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLAN_COPY } from './planCopy'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const NAME = 'Weather/tide Planner'

/** docs/HELP.md's `### Current and Predict` subsection, heading to the next `###`. */
function helpPassage(): string {
  const src = read('docs/HELP.md')
  const start = src.indexOf('\n### Current and Predict\n')
  expect(start, 'docs/HELP.md has a `### Current and Predict` subsection').toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const end = rest.indexOf('\n### ', 1)
  const section = end === -1 ? rest : rest.slice(0, end)
  // The planner's own paragraph within it, anchored on the literal name.
  const p = section.split('\n').find(l => l.includes(NAME))
  expect(p, `docs/HELP.md names the ${NAME} inside Current and Predict`).toBeTruthy()
  return p as string
}

/** README.md's Weather bullet. */
function readmePassage(): string {
  const line = read('README.md').split('\n').find(l => l.startsWith('- **Weather & Tide Lookup**'))
  expect(line, 'README.md has a Weather & Tide Lookup bullet').toBeTruthy()
  return line as string
}

/** The website's Weather & Tide Lookup paragraph, tags stripped. */
function sitePassage(): string {
  const src = read('website/index.html')
  const i = src.indexOf(NAME)
  expect(i, `website/index.html names the ${NAME}`).toBeGreaterThan(-1)
  const open = src.lastIndexOf('<p>', i)
  const close = src.indexOf('</p>', i)
  return src.slice(open, close).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const SURFACES: Array<[string, () => string]> = [
  ['docs/HELP.md', helpPassage],
  ['README.md', readmePassage],
  ['website/index.html', sitePassage],
]

/** The sentences of a passage, so a claim is matched as a statement rather than
 *  as a co-occurrence of words. */
const sentences = (text: string): string[] => text.split(/(?<=[.!?])\s+/).map(s => s.replace(/\*\*/g, '').trim())

describe('the published Weather/tide Planner passages exist at all', () => {
  for (const [name, get] of SURFACES) {
    it(`${name} carries one, under the one name`, () => {
      const text = get()
      expect(text.length, name).toBeGreaterThan(200)
      expect(text, name).toContain(NAME)
    })
  }
})

describe('claim 1: the window ends where the forecast ends, in the closing note\'s own words', () => {
  // Built FROM the shipped copy: the first sentence of the closing note the
  // plan itself renders, so the published files and the screen cannot drift.
  const stops = PLAN_COPY.closingNote.split('. ')[0] + '.'
  it('the code states it', () => {
    expect(stops).toBe('The plan stops where the weather forecast stops.')
  })
  for (const [name, get] of SURFACES) {
    it(`${name} states it in the same words`, () => {
      expect(sentences(get()), name).toContain(stops)
    })
  }
})

describe('claim 2: every sunrise and sunset in the window is listed with its tide and weather', () => {
  const re = /lists every sunrise and sunset from now to the end of the weather forecast, each with the predicted tide and the forecast weather at that moment/
  for (const [name, get] of SURFACES) {
    it(`${name} states it`, () => {
      expect(sentences(get()).some(s => re.test(s)), name).toBe(true)
    })
  }
  it('the code lists sunrises and sunsets, and the list is named so', () => {
    expect(PLAN_COPY.listName).toBe('Sunrises and sunsets ahead')
    expect(PLAN_COPY.sunrise).toBe('Sunrise')
    expect(PLAN_COPY.sunset).toBe('Sunset')
  })
})

describe('claim 3: the plan ranks and recommends nothing', () => {
  for (const [name, get] of SURFACES) {
    it(`${name} says so positively, and never says the opposite`, () => {
      const text = get()
      expect(sentences(text), name).toContain('It ranks and recommends nothing.')
      const low = text.toLowerCase()
      for (const phrase of ['best morning', 'best conditions', 'you should', 'recommended window', 'good birding']) {
        expect(low.includes(phrase), `${name}: "${phrase}"`).toBe(false)
      }
    })
  }
  it('the code carries no ranking or recommending word in any planner string', () => {
    const strings: string[] = []
    for (const v of Object.values(PLAN_COPY)) if (typeof v === 'string') strings.push(v)
    expect(strings.length).toBeGreaterThan(20)
    for (const s of strings) {
      for (const word of ['best', 'recommend', 'should', 'rank', 'score', 'ideal']) expect(s.toLowerCase().includes(word), s).toBe(false)
    }
  })
})

describe('claim 4: a plan loaded once re-shows offline with a cue', () => {
  const claim = 'A plan loaded once re-shows offline with a cue naming when it was fetched.'
  for (const [name, get] of SURFACES) {
    it(`${name} states it`, () => {
      expect(sentences(get()), name).toContain(claim)
    })
  }
  it('the panel really fetches both halves through the replay seam', () => {
    // Read the component rather than trusting the sentence, with comments
    // stripped so a commented-out call cannot satisfy it.
    const src = read('frontend/src/components/WeatherForecastPanel.tsx')
    const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n')
    expect(code).toContain("transport.getReplayable<WeatherPlan>('/weather/plan'")
    expect(code).toContain("transport.getReplayable<TidePlanResponse>('/tide/plan'")
    // And the override is the one fresh read, never replayed.
    expect(code).toContain("transport.get<TidePlanResponse>('/tide/plan'")
  })
})

describe('claim 5: the Days in view choice and the day buttons (design D4-12 / D4-14)', () => {
  const claim = "On a wide window a Days in view choice above the chart fits one, three, seven or all of the plan's days into the chart at once, and two day buttons beside the legend move the chart a day at a time."
  for (const [name, get] of SURFACES) {
    it(`${name} states it in the same words`, () => {
      expect(sentences(get()), name).toContain(claim)
    })
  }
  it('the code names the control and the buttons as the prose does', () => {
    expect(PLAN_COPY.daysInView).toBe('Days in view')
    expect(PLAN_COPY.daysOption('1', 8)).toBe('1 day')
    expect(PLAN_COPY.daysOption('3', 8)).toBe('3 days')
    expect(PLAN_COPY.daysOption('7', 8)).toBe('7 days')
    expect(PLAN_COPY.daysOption('all', 8)).toBe('All 8 days')
    expect(PLAN_COPY.earlierDay).toBe('Earlier day')
    expect(PLAN_COPY.laterDay).toBe('Later day')
  })
})

describe('the three files agree with each other, not merely each with the code', () => {
  it('all four claim sentences are identical across the three surfaces', () => {
    const claims = [
      'The plan stops where the weather forecast stops.',
      'It ranks and recommends nothing.',
      'A plan loaded once re-shows offline with a cue naming when it was fetched.',
      "On a wide window a Days in view choice above the chart fits one, three, seven or all of the plan's days into the chart at once, and two day buttons beside the legend move the chart a day at a time.",
    ]
    for (const [name, get] of SURFACES) {
      const ss = sentences(get())
      for (const c of claims) expect(ss, `${name}: ${c}`).toContain(c)
      const first = ss.find(s => s.startsWith('The Weather/tide Planner, a second action in Predict, lists every sunrise and sunset'))
      expect(first, name).toBe('The Weather/tide Planner, a second action in Predict, lists every sunrise and sunset from now to the end of the weather forecast, each with the predicted tide and the forecast weather at that moment, on one chart and in one list that carries every figure the chart draws.')
    }
  })

  it('names the surface as the user sees it, never from a component or file name', () => {
    for (const [name, get] of SURFACES) {
      const text = get()
      expect(text, name).toContain('Predict')
      for (const internal of ['PlanChart', 'PlanResult', 'WeatherForecastPanel', 'PredictMap', 'weatherPlan', 'tidePlan', 'composePlan']) {
        expect(text, `${name}: ${internal}`).not.toContain(internal)
      }
    }
  })

  it('carries no em dash', () => {
    for (const [name, get] of SURFACES) expect(get().includes('—'), name).toBe(false)
  })
})

describe('the privacy policy covers the plan\'s NOAA request (FR-57 / QA-52)', () => {
  const policy = () => read('PRIVACY_POLICY.md')

  it('the NOAA sentence names the predicted tide across the days ahead for a place you choose', () => {
    const line = policy().split('\n').find(l => l.startsWith('- **NOAA Tides & Currents (CO-OPS)**'))
    expect(line, 'PRIVACY_POLICY.md has the NOAA bullet').toBeTruthy()
    expect(line).toContain('or the predicted tide across the days ahead for a place you choose')
    // The clauses it already carried are still there.
    expect(line).toContain("the tide for a checklist's location and time")
    expect(line).toContain('the current or predicted tide for a location and time you choose')
  })

  it('the OpenWeather sentence is unchanged: the plan sends the request Predict already sends', () => {
    const line = policy().split('\n').find(l => l.startsWith('- **OpenWeather**'))
    expect(line).toBe('- **OpenWeather**: to fetch weather, either the historical weather for a checklist, or the current and forecast weather for a location and time you choose. Uses your own OpenWeather API key. See [OpenWeather\'s privacy policy](https://openweather.co.uk/privacy-policy).')
  })

  it('carries no em dash', () => {
    expect(policy().includes('—')).toBe(false)
  })
})
