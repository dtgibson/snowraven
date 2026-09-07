// The published claims about the Weather section, held to the code.
//
// A REQUIREMENT THAT RESTS ON A NAMED GUARD IS A CLAIM ABOUT THAT GUARD, NOT A
// FACT. Named Birds learned that at v1.0.21: `ACCESSIBILITY.md` gained a
// sentence under a requirement citing `tabOrderCoverage.test.ts` as its guard,
// and that file has never read `ACCESSIBILITY.md` at all, so mutating the
// published sentence left the whole suite green. This repo has exactly two tests
// that hold published prose to shipped behaviour; this is the third, and it
// exists because the Weather section publishes three claims that can go stale
// silently:
//
//  1. THE AVERAGING FLOOR IS A CONSTANT. `WEATHER_BAND_MIN_TO_SHOW` lives once,
//     in `lib/weatherStats.ts`, and `legendFloorNote()` reads it rather than
//     re-spelling it, precisely so the sentence on screen and the refusal can
//     never disagree. `docs/HELP.md` states the number, which puts a copy
//     outside that arrangement -- so the guard builds its regex FROM the
//     constant rather than re-spelling it here, which is the same trap one level
//     up.
//
//  2. THE TWO DENOMINATORS DIFFER ON PURPOSE. The section counts a block only
//     when it carries a SnowRaven or RainCrow credit; the Weather tab's backlog
//     uses the looser label-based test. HELP.md is where that is documented, and
//     a later "consistency fix" to either side has to go red here.
//
//  3. THE SECTION IS OFFLINE AND MAKES NO LOOKUP. That is true because
//     `weatherStats.ts` and `weatherBlockParse.ts` import neither the transport
//     nor the storage seam -- asserted structurally in `weatherStats.test.ts` --
//     and all three published files say so.
//
// WHY THE PASSAGES ARE EXTRACTED RATHER THAN THE WHOLE FILE. HELP.md's Data
// Quality section legitimately talks about weather blocks with the OTHER
// denominator, and the Weather tab section legitimately talks about the backlog.
// A whole-document guard would either fail on those or be loosened until it
// asserted nothing.
//
// AND EACH ROW ASSERTS THE FILE MAKES THE CLAIM AT ALL BEFORE CHECKING IT IS
// RIGHT, because deleting the sentence is the move an author under time pressure
// actually reaches for, and it is the one a naive "must contain" guard rewards.
//
// MUTATION-VERIFIED IN FOUR DIRECTIONS before any green reading from it was
// trusted, each restored byte-identical afterwards: a re-spelled constant (5 for
// 8 in HELP.md) RED; the whole divergence paragraph DELETED RED; one file
// misspelling the other app while the other two have it right RED; and the
// offline claim dropped from the website alone RED. It also caught two real
// defects on its first run -- README.md named only SnowRaven where the other two
// name both apps, and HELP.md QUOTED the forbidden phrase while explaining that
// the section does not use it, which reads as the claim rather than as its
// denial.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { WEATHER_BAND_MIN_TO_SHOW, WEATHER_SECTION_MIN_READABLE } from './weatherStats'
import { WEATHER_COPY } from './weatherStatsCopy'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

/** `docs/HELP.md`'s `### Weather` subsection under Statistics, heading to the
 *  next `###`. Not the `## Weather` TAB section, which is a different surface
 *  with different claims. */
function helpWeatherSection(): string {
  const src = read('docs/HELP.md')
  const start = src.indexOf('\n### Weather\n')
  expect(start, 'docs/HELP.md has a Statistics `### Weather` subsection').toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const end = rest.indexOf('\n### ', 1)
  return end === -1 ? rest : rest.slice(0, end)
}

/** `README.md`'s Weather bullet. */
function readmeWeatherBullet(): string {
  const line = read('README.md').split('\n').find(l => l.startsWith('- **Weather, read back**'))
  expect(line, 'README.md has a Weather feature bullet').toBeTruthy()
  return line as string
}

/** The website's Weather paragraph inside the Statistics feature row, tags
 *  stripped so the prose reads as prose. */
function siteWeatherParagraph(): string {
  const src = read('website/index.html')
  const i = src.indexOf('<strong>Weather</strong> section reads back')
  expect(i, 'website/index.html states the Weather section in its Statistics row').toBeGreaterThan(-1)
  const open = src.lastIndexOf('<p>', i)
  const close = src.indexOf('</p>', i)
  return src.slice(open, close).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const SURFACES: Array<[string, () => string]> = [
  ['docs/HELP.md', helpWeatherSection],
  ['README.md', readmeWeatherBullet],
  ['website/index.html', siteWeatherParagraph],
]

describe('the published Weather passages exist at all', () => {
  for (const [name, get] of SURFACES) {
    it(`${name} carries one`, () => {
      const text = get()
      expect(text.length, name).toBeGreaterThan(200)
      expect(text.toLowerCase(), name).toContain('weather')
    })
  }
})

describe('claim 1: the averaging floor is stated as the constant, not a remembered number', () => {
  it('docs/HELP.md names the floor, and names the RIGHT one', () => {
    const text = helpWeatherSection()
    // Built FROM the constant rather than re-spelled, so moving the constant
    // turns this red instead of leaving the documentation quietly wrong.
    const re = new RegExp(`\\b${WEATHER_BAND_MIN_TO_SHOW} checklists\\b`)
    expect(re.test(text), `HELP.md should say "${WEATHER_BAND_MIN_TO_SHOW} checklists"`).toBe(true)
    // And it is the band floor being described, not the section floor.
    expect(text).toContain('averages only once it has')
  })

  it('the on-screen legend and the documentation agree, because both read the constant', () => {
    expect(WEATHER_COPY.legendSpecies).toBe('Species per checklist')
    const help = helpWeatherSection()
    // The section floor is a DIFFERENT constant and must not be confused with
    // the band floor in either place.
    expect(WEATHER_SECTION_MIN_READABLE).not.toBe(WEATHER_BAND_MIN_TO_SHOW)
    expect(help).not.toContain(`averages only once it has ${WEATHER_SECTION_MIN_READABLE}`)
  })
})

describe('claim 2: the two denominators differ deliberately, and HELP.md says so', () => {
  it('states that this section counts more strictly than the backlog', () => {
    const text = helpWeatherSection()
    expect(text).toContain('more strictly than the Weather tab')
    expect(text).toContain('not complements of each other')
    // And it names WHY, which is the part that stops a future consistency fix.
    expect(text.toLowerCase()).toContain('credit')
  })

  it('states that the coverage figure matches the Data Quality bar, which uses the same rule', () => {
    expect(helpWeatherSection()).toContain('matches the **any weather** bar in Data Quality')
  })
})

describe('claim 3: offline, no lookup, on every surface that makes it', () => {
  for (const [name, get] of SURFACES) {
    it(`${name} says it works offline and makes no lookup`, () => {
      const text = get().toLowerCase()
      expect(text, name).toContain('offline')
      expect(/no lookup|makes no network|no network request/.test(text), name).toBe(true)
    })
  }
})

describe('the published accessibility claim states the MECHANISM, not a universal', () => {
  // Security review, informational: `ACCESSIBILITY.md` said charts expose a
  // summary via an image role, with examples and "and the like". This section's
  // rails are deliberately `aria-hidden` with no role -- every value is already
  // text on its row -- so the sentence implied a universal the code does not
  // meet. The repair states the RULE that decides membership, which is the
  // repo's own answer to a false "every X": a shorter list of X breaks on the
  // next sweep.
  const accessibility = () => read('ACCESSIBILITY.md')

  it('names the condition rather than implying every chart', () => {
    const text = accessibility()
    expect(text).toContain('A chart drawn as a GRAPHIC')
    expect(text).toContain('A chart drawn as ROWS OF TEXT does not')
    // The universal that was there before must not come back.
    expect(text).not.toContain('and the like) expose a concise text summary')
  })

  it('names this section as an instance of the no-role side, not as an exception', () => {
    // An exception list is the shape the rule warns against; naming the
    // instance under a stated mechanism is the shape it asks for.
    const text = accessibility()
    expect(text).toContain("The Weather section's distribution and per-species charts")
    expect(text).toContain('Data Quality bars')
  })

  it('the code it describes really does carry no image role', () => {
    // The claim is only as good as the component. Read the component rather
    // than trusting the sentence -- this is the pairing the repo's own rule
    // asks for, a published statement held to the source it came from.
    const src = read('frontend/src/components/WeatherStatsSection.tsx')
    const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
    expect(code).not.toContain('role="img"')
    expect(code).toContain('aria-hidden="true"')
  })
})

describe('the three files agree with each other, not merely each with the code', () => {
  it('all three name the two apps whose blocks are read, and spell the other one its own way', () => {
    for (const [name, get] of SURFACES) {
      const text = get()
      expect(text, name).toContain('SnowRaven')
      expect(text, name).toContain('RainCrow')
      // Its own spelling, which is what raincrow.app uses and what the blocks
      // this feature reads actually carry.
      expect(text, name).not.toContain('Raincrow')
    }
  })

  it('none of them predicts, recommends or ranks, which is the section\'s own promise', () => {
    for (const [name, get] of SURFACES) {
      const text = get().toLowerCase()
      for (const phrase of ['best conditions', 'you should', 'expect to find', 'most associated']) {
        expect(text.includes(phrase), `${name}: "${phrase}"`).toBe(false)
      }
      // And each says so positively, so the promise is published rather than
      // merely not broken.
      expect(/never predicts|no ranked|does not predict/.test(text), name).toBe(true)
    }
  })

  it('carries no em dash', () => {
    for (const [name, get] of SURFACES) expect(get().includes('—'), name).toBe(false)
  })
})
