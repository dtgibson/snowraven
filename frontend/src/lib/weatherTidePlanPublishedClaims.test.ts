// The published claims about the Weather/tide Planner, held to the code
// (tide-weather-planner FR-54 / FR-55 / FR-57, QA-49 / QA-50 / QA-52), in the
// weatherStatsPublishedClaims.test.ts shape: three extractors scoped to each
// file's own planner passage (anchored on the literal name), an existence
// assertion before every claim, the claims held to the CODE rather than to
// each other, the files compared against each other on the claim sentences,
// and the em-dash check. The privacy policy's one new clause gets its own row,
// because a sentence added to PRIVACY_POLICY.md owes a guard in the same
// change.
//
// WHY PASSAGES RATHER THAN WHOLE FILES: HELP.md's Weather tab section
// legitimately describes Plan's single-moment result in the same subsection,
// README's Weather section legitimately describes the checklist lookup, and
// the website's Weather article carries both. A whole-document guard would
// either fail on those or be loosened until it asserted nothing.
//
// MUTATION-VERIFIED in four directions before its first green was trusted,
// each restored byte-identical: the "stops where the forecast stops" sentence
// deleted from HELP alone RED; the four sentences re-worded in README alone
// (one file diverging from the other two) RED; the ranking sentence removed
// from the website RED; and the NOAA clause reverted in PRIVACY_POLICY RED.
//
// plan-sun-moon-readout (1.0.30, FR-05, FR-06, FR-45, FR-46, FR-48; QA-05,
// QA-06, QA-41, QA-43): the HELP anchor follows the renamed heading; the
// rename is a claim per file (the passage names the entry Plan and never
// Predict, non-vacuously); three new claims (the readout from the plan rather
// than a fresh lookup, the sun's height with sunrise and sunset where the plan
// lists them, the moon phase from the checklist blocks' own computation) join
// the existing no-ranking claim; and ACCESSIBILITY.md's one new sentence has
// its own row. Mutation-verified again in three directions and restored
// byte-identical: the moon sentence deleted from README alone RED; the sun
// sentence re-worded in the website alone (one file diverging) RED; "Predict"
// re-inserted as the entry's name in HELP alone RED; the ACCESSIBILITY
// sentence deleted RED.
//
// website-readme-copy-pass: TWO TIERS, STATED. `docs/HELP.md` keeps every one
// of the eight byte-exact sentences. `README.md` and `website/index.html` are
// decision surfaces written for a reader deciding whether the app fits them,
// so they carry the Planner's one CLAIM at claim level (it lays out the
// sunrises and sunsets ahead, each with its tide and forecast weather) and
// nothing about its operation, its bounds, its chart or its promises. The rows
// the two surfaces leave are named where it happens: "the plan stops where the
// weather forecast stops" (the user's own example of stating the obvious), "it
// ranks and recommends nothing" (reassurance, by the same direction), the
// offline re-show (offline is unmentioned on both surfaces by decision;
// `palettePublishedClaims` holds them to that), the moon phase, the Days in
// view control, the tap-or-arrow-keys readout, the drawn sun height and the
// entry's name Plan (all operation or in-app labels, all in HELP). Every
// surface keeps its existence leg and its 200-character floor. README's
// passage is its `### Weather` section, heading to heading; the website's is
// the paragraph holding the FIRST occurrence of the name in the file, which is
// the Weather article's one paragraph.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLAN_COPY } from './planCopy'
import { MOON_PHASE_NAMES } from './planMoon'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const NAME = 'Weather/tide Planner'

const HELP_HEADING = '### Current and Plan'

/** docs/HELP.md's `### Current and Plan` subsection (renamed from Current and
 *  Predict in 1.0.30), heading to the next `###`. */
function helpSection(): string {
  const src = read('docs/HELP.md')
  const start = src.indexOf(`\n${HELP_HEADING}\n`)
  expect(start, `docs/HELP.md has a \`${HELP_HEADING}\` subsection`).toBeGreaterThan(-1)
  expect(src.includes('### Current and Predict'), 'the old heading is gone').toBe(false)
  const rest = src.slice(start + 1)
  const end = rest.indexOf('\n### ', 1)
  return end === -1 ? rest : rest.slice(0, end)
}

/** The planner's own paragraph within that subsection, anchored on the literal name. */
function helpPassage(): string {
  const p = helpSection().split('\n').find(l => l.includes(NAME))
  expect(p, `docs/HELP.md names the ${NAME} inside Current and Plan`).toBeTruthy()
  return p as string
}

/** README.md's `### Weather` section, heading to the next heading. */
function readmePassage(): string {
  const src = read('README.md')
  const start = src.indexOf('\n### Weather\n')
  expect(start, 'README.md has a `### Weather` section').toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const end = rest.search(/\n#{2,3} /)
  return end === -1 ? rest : rest.slice(0, end)
}

/** The website's Planner paragraph, tags stripped. */
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
/** The two decision surfaces, held to each other at claim level. */
const DECISION_SURFACES = SURFACES.slice(1)

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

  it('the website locates it by the FIRST occurrence of the name, so nothing earlier in the file may use it', () => {
    // The extractor above is a file-wide indexOf. A hero, a meta description or
    // the features heading naming the Planner would silently relocate the
    // extraction to a paragraph that makes none of these claims.
    const src = read('website/index.html')
    const first = src.indexOf(NAME)
    expect(src.indexOf(NAME, first + 1), 'the name occurs once in website/index.html').toBe(-1)
    expect(first).toBeGreaterThan(src.indexOf('<h3>Weather</h3>'))
  })
})

describe('claim 1: the window ends where the forecast ends, in the closing note\'s own words', () => {
  // Built FROM the shipped copy: the first sentence of the closing note the
  // plan itself renders, so the published files and the screen cannot drift.
  const stops = PLAN_COPY.closingNote.split('. ')[0] + '.'
  it('the code states it', () => {
    expect(stops).toBe('The plan stops where the weather forecast stops.')
  })
  it('docs/HELP.md states it in the same words', () => {
    // website-readme-copy-pass: HELP only. The two decision surfaces leave this
    // roster because they no longer make the claim, by user decision ("of
    // course it does"); HELP keeps the sentence byte for byte.
    expect(sentences(helpPassage())).toContain(stops)
  })
})

describe('claim 2: every sunrise and sunset in the window is listed with its tide and weather', () => {
  const exact = /lists every sunrise and sunset from now to the end of the weather forecast, each with the predicted tide and the forecast weather at that moment/
  it('docs/HELP.md states it in the same words', () => {
    expect(sentences(helpPassage()).some(s => exact.test(s))).toBe(true)
  })
  for (const [name, get] of DECISION_SURFACES) {
    it(`${name} states the claim: the sunrises and sunsets ahead, each with its tide and forecast weather`, () => {
      // Claim-level, one sentence: the three things laid out together are what
      // the Planner IS; a passage that drops the tide or the weather from that
      // sentence describes a different feature.
      const s = sentences(get()).find(x => x.includes(NAME))
      expect(s, `${name}: the sentence naming the Planner`).toBeTruthy()
      expect(s, name).toMatch(/sunrises? and sunsets?/)
      expect(s, name).toMatch(/\btide\b/)
      expect(s, name).toMatch(/forecast weather/)
    })
  }
  it('the code lists sunrises and sunsets under the day-by-day divider that names the list', () => {
    expect(PLAN_COPY.listName).toBe('Day by day')
    expect(PLAN_COPY.sunrise).toBe('Sunrise')
    expect(PLAN_COPY.sunset).toBe('Sunset')
  })
})

describe('claim 3: the plan ranks and recommends nothing', () => {
  it('docs/HELP.md says so in the closing note\'s words', () => {
    // website-readme-copy-pass: the positive statement is HELP's only. On the
    // decision surfaces "it ranks and recommends nothing" is reassurance about
    // what the app does NOT do, which the user's register excludes; they leave
    // this roster's positive leg and keep its negative one below.
    expect(sentences(helpPassage())).toContain('It ranks and recommends nothing.')
  })
  for (const [name, get] of SURFACES) {
    it(`${name} never says the opposite`, () => {
      const low = get().toLowerCase()
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
  it('docs/HELP.md states it', () => {
    // website-readme-copy-pass: HELP only. Offline is unmentioned on the two
    // decision surfaces by user decision, so they leave this roster; the
    // sentence and the behaviour are unchanged.
    expect(sentences(helpPassage())).toContain(claim)
  })
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
  it('docs/HELP.md states it in the same words', () => {
    // website-readme-copy-pass: HELP only. A control's layout is operation, and
    // the decision surfaces no longer describe operation.
    expect(sentences(helpPassage())).toContain(claim)
  })
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

// ── plan-sun-moon-readout: the rename and the three additions (FR-05, FR-06, FR-45, FR-46)

describe('the rename: the entry is Plan, never Predict (FR-05, FR-06, QA-05, QA-06)', () => {
  it('docs/HELP.md names the entry Plan in the planner passage', () => {
    // website-readme-copy-pass: HELP only for the positive half. The decision
    // surfaces no longer name the entry at all (a control name is operating
    // detail), so what they owe is the negative half below: the retired name
    // never comes back through them.
    expect(helpPassage()).toContain('a second action in Plan')
  })
  for (const [name, get] of SURFACES) {
    it(`${name} never names the entry Predict`, () => {
      const text = get()
      expect(/\bPredict\b/.test(text), `${name}: Predict`).toBe(false)
      expect(text, name).not.toContain('Get forecast')
    })
  }
  it('docs/HELP.md, the one surface that names the single-moment action, names it Get specific forecast', () => {
    expect(helpPassage()).toContain('Get specific forecast')
    expect(helpPassage().match(/Get specific forecast/g)!.length).toBeGreaterThanOrEqual(3)
  })
  it('docs/HELP.md: the subsection heading, the Plan bullet naming both actions, and the Map Explorer sentence all say Plan', () => {
    const section = helpSection()
    expect(section).toContain(`- **${PLAN_COPY.entryLabel}** lets you choose a place`)
    expect(section).toContain(`**${PLAN_COPY.forecastAction}**`)
    expect(section).toContain(`**${PLAN_COPY.actionLabel}**`)
    expect(/\bPredict\b/.test(section)).toBe(false)
    const src = read('docs/HELP.md')
    expect(src).toContain("The small location-picker map in the Weather tab's Plan form has no row at all.")
    expect(src).not.toContain("Weather tab's Predict mode")
    // No published sentence in the three files names the entry or the form Predict;
    // the word Predicted as the tide label stays legal.
    for (const file of ['docs/HELP.md', 'README.md', 'website/index.html']) {
      const body = read(file)
      expect(/\bPredict\b/.test(body), file).toBe(false)
      expect(body.includes('Get forecast'), file).toBe(false)
    }
    expect(src).toContain('**Predicted**')
  })
  it('the code carries the same three labels', () => {
    expect(PLAN_COPY.entryLabel).toBe('Plan')
    expect(PLAN_COPY.forecastAction).toBe('Get specific forecast')
    expect(PLAN_COPY.actionLabel).toBe('See all upcoming weather and tide data')
    expect(PLAN_COPY.caption).toContain(PLAN_COPY.forecastAction)
    expect(PLAN_COPY.closingNote).toContain(PLAN_COPY.forecastAction)
  })
})

describe('claim 6: a tap or the arrow keys read the estimated tide, weather and sun at any moment, from the plan rather than a fresh lookup (FR-45)', () => {
  const claim = 'A tap on the timeline, or the arrow keys with it focused, reads the estimated tide, weather and sun height at any moment, from the plan already loaded rather than a fresh lookup.'
  it('docs/HELP.md states it', () => {
    // website-readme-copy-pass: HELP only. How a moment is read off the chart is
    // operation; the decision surfaces describe what the Planner lists.
    expect(sentences(helpPassage())).toContain(claim)
  })
  it('the code states both facts in the readout\'s own words', () => {
    expect(PLAN_COPY.restLine).toContain('use the arrow keys, to read the tide, weather and sun height at any moment')
    expect(PLAN_COPY.estimateLine).toBe('Estimated from the plan, not a fresh lookup. For an exact moment, use Get specific forecast.')
  })
})

describe('claim 7: the sun\'s height is drawn with sunrise and sunset where the plan lists them (FR-45)', () => {
  const claim = "The sun's height is drawn across the whole window, with sunrise and sunset exactly where the plan lists them."
  it('docs/HELP.md states it', () => {
    // website-readme-copy-pass: HELP only, for the same reason as claim 6.
    expect(sentences(helpPassage())).toContain(claim)
  })
  it('the code names the track in the legend and anchors it to the listed events', () => {
    expect(PLAN_COPY.legendSun).toBe('Sun height')
    // The anchoring is the module's contract, with comments stripped so a
    // commented-out rule cannot satisfy it.
    const src = read('frontend/src/lib/planSun.ts')
    const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n')
    expect(code).toContain('if (i > 0 && A[i - 1].t === t) return 0')
  })
})

describe('claim 8: each day states its moon phase from the checklist blocks\' own computation (FR-45)', () => {
  const claim = 'Each day states its moon phase, from the same computation the checklist weather blocks use.'
  it('docs/HELP.md states it in the same words', () => {
    // website-readme-copy-pass: HELP only. The moon phase is one figure among
    // the plan's; the decision surfaces describe what the Planner is for, not
    // each figure it lists.
    expect(sentences(helpPassage())).toContain(claim)
  })
  it('the code imports the checklist blocks\' moon function rather than copying it', () => {
    const src = read('frontend/src/lib/planMoon.ts')
    const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n')
    expect(code).toContain("import { MOON_NORTH, MOON_SOUTH, moonPhaseEmoji } from './weatherFormatter'")
    expect(code).not.toContain('LUNAR_MONTH')
    expect(MOON_PHASE_NAMES).toHaveLength(8)
  })
})

describe('the files agree with each other, not merely each with the code', () => {
  it('docs/HELP.md carries all seven byte-exact claim sentences and the opening sentence', () => {
    // The byte-exact tier, unweakened: the eight sentences that were pinned
    // across three files through 1.0.32 are still pinned, on the one surface
    // whose job is the full account.
    const claims = [
      'The plan stops where the weather forecast stops.',
      'It ranks and recommends nothing.',
      'A plan loaded once re-shows offline with a cue naming when it was fetched.',
      "On a wide window a Days in view choice above the chart fits one, three, seven or all of the plan's days into the chart at once, and two day buttons beside the legend move the chart a day at a time.",
      'A tap on the timeline, or the arrow keys with it focused, reads the estimated tide, weather and sun height at any moment, from the plan already loaded rather than a fresh lookup.',
      "The sun's height is drawn across the whole window, with sunrise and sunset exactly where the plan lists them.",
      'Each day states its moon phase, from the same computation the checklist weather blocks use.',
    ]
    const ss = sentences(helpPassage())
    for (const c of claims) expect(ss, `docs/HELP.md: ${c}`).toContain(c)
    const first = ss.find(s => s.startsWith('The Weather/tide Planner, a second action in Plan, lists every sunrise and sunset'))
    expect(first).toBe('The Weather/tide Planner, a second action in Plan, lists every sunrise and sunset from now to the end of the weather forecast, each with the predicted tide and the forecast weather at that moment, on one chart and in one list that carries every figure the chart draws.')
  })

  it('README and the website make the same claim, at claim level', () => {
    // The two decision surfaces, compared against EACH OTHER: the same
    // matchers over both, so one carrying a claim the other dropped goes red
    // as a sweep failure rather than passing as a wording difference.
    const CLAIMS: Array<[string, RegExp]> = [
      ['names the Planner', /The Weather\/tide Planner lays out/],
      ['the sunrises and sunsets ahead, each with its tide and forecast weather', /sunrises? and sunsets?[^.]*\btide\b[^.]*forecast weather/],
    ]
    for (const [name, get] of DECISION_SURFACES) {
      const text = get()
      for (const [what, re] of CLAIMS) expect(re.test(text), `${name}: ${what}`).toBe(true)
    }
  })

  it('names the surface as the user sees it, never from a component or file name', () => {
    expect(helpPassage()).toContain('Plan')
    for (const [name, get] of SURFACES) {
      const text = get()
      for (const internal of ['PlanChart', 'PlanResult', 'WeatherForecastPanel', 'PredictMap', 'weatherPlan', 'tidePlan', 'composePlan', 'planSun', 'planMoon', 'planReadout', 'planPick']) {
        expect(text, `${name}: ${internal}`).not.toContain(internal)
      }
    }
  })

  it('carries no em dash', () => {
    for (const [name, get] of SURFACES) expect(get().includes('—'), name).toBe(false)
  })
})

describe('the accessibility statement carries the plan timeline\'s one sentence (plan-sun-moon-readout OQ-07, FR-48, QA-43)', () => {
  const sentence = "The Weather tab's plan timeline is a single keyboard-operable control: the arrow keys move a picked moment along it and that moment's estimated tide, weather and sun height are announced, while the per-day list beneath carries every figure the chart draws."
  it('states it under the screen-reader paragraph, once, with no em dash', () => {
    const src = read('ACCESSIBILITY.md')
    const i = src.indexOf(sentence)
    expect(i).toBeGreaterThan(-1)
    expect(src.indexOf(sentence, i + 1)).toBe(-1)
    expect(i).toBeGreaterThan(src.indexOf('## Screen Reader Support'))
    expect(i).toBeLessThan(src.indexOf('## A Visible Focus Indicator'))
    expect(src.includes('—')).toBe(false)
  })
  it('the code is what the sentence says: one slider, its value text the figures, the list carrying every figure', () => {
    const chart = read('frontend/src/components/PlanChart.tsx')
    const code = chart.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n')
    expect(code).toContain('role="slider"')
    expect(code).toContain('aria-valuetext={valueText}')
    expect(code).not.toContain('aria-live')
    expect(code).not.toContain('role="status"')
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

  it('the OpenWeather sentence is unchanged: the plan sends the request the single-moment action already sends', () => {
    const line = policy().split('\n').find(l => l.startsWith('- **OpenWeather**'))
    expect(line).toBe('- **OpenWeather**: to fetch weather, either the historical weather for a checklist, or the current and forecast weather for a location and time you choose. Uses your own OpenWeather API key. See [OpenWeather\'s privacy policy](https://openweather.co.uk/privacy-policy).')
  })

  it('carries no em dash', () => {
    expect(policy().includes('—')).toBe(false)
  })
})
