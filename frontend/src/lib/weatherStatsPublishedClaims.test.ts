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
//     and `docs/HELP.md` says so.
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
//
// website-readme-copy-pass: TWO TIERS, STATED ONCE HERE AND APPLIED BELOW.
// `docs/HELP.md` keeps every byte-exact row it had. `README.md` and
// `website/index.html` are decision surfaces, written for a reader deciding
// whether the app fits them, so they carry the feature's two CLAIMS (a Weather
// section reads back the blocks SnowRaven and RainCrow write into checklist
// comments; a Weather card on Species Detail shows one bird's skies and
// temperatures from the same blocks) and nothing of its mechanism or its
// promises. Each row that the two surfaces leave says so where it happens: the
// offline claim (offline is unmentioned on both surfaces by user decision;
// HELP keeps `## Using SnowRaven offline`, asserted by
// `icloudKeysPublishedClaims`, and `palettePublishedClaims` holds the two
// surfaces to never mentioning it), "never predicts or ranks" (reassurance
// about what the app does not do, excluded by the same direction), the
// two-wholes, same-derivation and below-floor mechanics (HELP's bullet carries
// all three), and "no picker", which MOVES into HELP's bullet and gains a HELP
// row here. Every surface keeps its existence leg and its 200-character floor;
// no floor was lowered. README's passages are its `### Statistics` and
// `### Species Detail` sections, heading to heading, not single bullet lines;
// the website's are the Statistics and Species Detail articles' one paragraph
// each, located by the sentence that makes the claim.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  WEATHER_BAND_MIN_TO_SHOW, WEATHER_SECTION_MIN_READABLE, WEATHER_SPECIES_MIN_CHECKLISTS,
} from './weatherStats'
import { WEATHER_COPY } from './weatherStatsCopy'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

/** `README.md`'s `### <heading>` section, heading to the next `##` or `###`. */
function readmeSection(heading: string): string {
  const src = read('README.md')
  const start = src.indexOf(`\n### ${heading}\n`)
  expect(start, `README.md has a \`### ${heading}\` section`).toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const end = rest.search(/\n#{2,3} /)
  return end === -1 ? rest : rest.slice(0, end)
}

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

/** `README.md`'s Statistics section, which is where its Weather passage lives. */
function readmeWeatherPassage(): string {
  return readmeSection('Statistics')
}

/** The website's Weather paragraph inside the Statistics feature row, tags
 *  stripped so the prose reads as prose. */
function siteWeatherParagraph(): string {
  const src = read('website/index.html')
  // Lowercase by user direction: "weather" here is prose, not the tab's name.
  const i = src.indexOf('A weather section reads back')
  expect(i, 'website/index.html states the Weather section in its Statistics row').toBeGreaterThan(-1)
  const open = src.lastIndexOf('<p>', i)
  const close = src.indexOf('</p>', i)
  return src.slice(open, close).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const SURFACES: Array<[string, () => string]> = [
  ['docs/HELP.md', helpWeatherSection],
  ['README.md', readmeWeatherPassage],
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

describe('claim 3: offline, no lookup, on the surface that makes it', () => {
  // website-readme-copy-pass: HELP only. README and the website leave this
  // roster because they no longer make the claim at all (offline is unmentioned
  // on both, by user decision), not because the claim was weakened. The
  // structural half is unchanged: `weatherStats.test.ts` asserts the module
  // imports neither seam.
  it('docs/HELP.md says it works offline and makes no lookup', () => {
    const text = helpWeatherSection().toLowerCase()
    expect(text).toContain('offline')
    expect(/no lookup|makes no network|no network request/.test(text)).toBe(true)
  })
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

  it('all three say the section reads the blocks BACK, out of checklist comments', () => {
    // The claim that makes this a feature: the blocks the two apps write into
    // comments are read again. Held on every surface at claim level, so the
    // passage cannot shrink to a bare mention of the apps.
    for (const [name, get] of SURFACES) {
      const text = get().toLowerCase()
      // "reads back", "read one back", "reads them back", "read back from": the
      // verb and "back" within a few words, however the sentence is built.
      expect(/\breads? (?:[a-z-]+ ){0,3}back\b/.test(text), `${name}: reads the blocks back`).toBe(true)
      expect(text, `${name}: out of checklist comments`).toContain('checklist comment')
    }
  })

  it('none of them predicts, recommends or ranks, which is the section\'s own promise', () => {
    for (const [name, get] of SURFACES) {
      const text = get().toLowerCase()
      for (const phrase of ['best conditions', 'you should', 'expect to find', 'most associated']) {
        expect(text.includes(phrase), `${name}: "${phrase}"`).toBe(false)
      }
    }
    // HELP says so positively, so the promise is published rather than merely
    // not broken. website-readme-copy-pass: the decision surfaces leave this
    // positive leg; "never predicts or ranks" is a statement about what the app
    // does NOT do, which their register excludes. They keep the negative leg.
    expect(/never predicts|no ranked|does not predict/.test(helpWeatherSection().toLowerCase())).toBe(true)
  })

  it('carries no em dash', () => {
    for (const [name, get] of SURFACES) expect(get().includes('—'), name).toBe(false)
  })
})

// ── The Species Detail card's own published claims (species-detail-weather) ──
//
// A SECOND SET OF PASSAGES, extracted the same way and for the same reason: the
// card publishes claims that can go stale silently, and this repo has learned
// twice that a requirement resting on a named guard is a claim about that guard
// rather than a fact. Four claims, each with a non-vacuity leg per file:
//
//  1. THE PER-SPECIES FLOOR IS A CONSTANT. `WEATHER_SPECIES_MIN_CHECKLISTS`
//     lives once, in `lib/weatherStats.ts`, and `speciesFloorNote()` reads it
//     rather than re-spelling it. HELP states the number, which puts a copy
//     outside that arrangement, so the matcher is built FROM the constant.
//  2. ONE NUMERATOR, TWO WHOLES, AND NOTHING DIVIDES THEM. The decision that
//     matters most on this card, and the one a later "helpful" edit would undo
//     by adding a coverage percentage.
//  3. THE TWO SURFACES COME OUT OF ONE DERIVATION, and where their bases can
//     differ HELP says so rather than leaving it to be discovered.
//  4. NO PICKER, AND OFFLINE. Both are promises about behaviour, and both are
//     structural in the code.
//
// website-readme-copy-pass: claims 2, 3 and the offline half of 4 are
// mechanism, and the two decision surfaces no longer describe the card's
// mechanism. They keep the card's CLAIM: a Weather card on Species Detail shows
// what the selected bird has turned up in, read back from both apps' blocks,
// for a bird on enough weather-block checklists. "No picker" moves INTO HELP's
// bullet (a sentence the copy pass drafts for it) and the HELP row below is what
// keeps that fact guarded; it is red against a HELP.md that predates the
// addition, by design, and lands with it.

/** `docs/HELP.md`'s Species Detail Weather bullet. */
function helpSpeciesCardBullet(): string {
  const src = read('docs/HELP.md')
  const start = src.indexOf('\n- Weather: the skies and temperatures you have recorded this bird in')
  expect(start, 'docs/HELP.md documents the Species Detail Weather card').toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const end = rest.indexOf('\n- ', 1)
  return end === -1 ? rest : rest.slice(0, end)
}

/** `README.md`'s Species Detail section, which is where its card passage lives. */
function readmeSpeciesCardPassage(): string {
  return readmeSection('Species Detail')
}

/** The website's paragraph for the card, tags stripped so the prose reads as prose.
 *  The anchor is short and sits on one source line; the paragraph is
 *  whitespace-normalised after extraction, so the longer claim is matched below
 *  over the normalised text rather than over the raw source. */
function siteSpeciesCardParagraph(): string {
  const src = read('website/index.html')
  const i = src.indexOf('card shows the skies')
  expect(i, 'website/index.html states the Species Detail Weather card').toBeGreaterThan(-1)
  const open = src.lastIndexOf('<p>', i)
  const close = src.indexOf('</p>', i)
  return src.slice(open, close).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const CARD_SURFACES: Array<[string, () => string]> = [
  ['docs/HELP.md', helpSpeciesCardBullet],
  ['README.md', readmeSpeciesCardPassage],
  ['website/index.html', siteSpeciesCardParagraph],
]

describe('the published Species Detail card passages exist at all', () => {
  for (const [name, get] of CARD_SURFACES) {
    it(`${name} carries one`, () => {
      // Deleting the sentence is the move an author under time pressure actually
      // reaches for, and it is the one a naive "must contain" guard rewards.
      const text = get()
      expect(text.length, name).toBeGreaterThan(200)
    })
  }

  it('and HELP\'s lives inside the Species Detail section, not merely somewhere in the file', () => {
    // Named by its PLACE rather than by a restatement: a bullet under
    // `## Species Detail` does not need to say "Species Detail" to be about it,
    // and published prose that repeats what the surrounding heading already says
    // is the restatement the docs rule asks us to reduce.
    const src = read('docs/HELP.md')
    const section = src.indexOf('\n## Species Detail\n')
    const next = src.indexOf('\n## ', section + 1)
    const bullet = src.indexOf('\n- Weather: the skies and temperatures you have recorded this bird in')
    expect(section).toBeGreaterThan(-1)
    expect(bullet).toBeGreaterThan(section)
    expect(bullet).toBeLessThan(next)
  })

  it('and the website\'s lives inside the Species Detail row, not the Statistics row', () => {
    // website-readme-copy-pass moved the paragraph to the tab it describes. A
    // paragraph lives in the section for the surface it describes; this is the
    // guard that stops the append-log shape (a Species Detail card described
    // under the Statistics heading) coming back.
    const src = read('website/index.html')
    const card = src.indexOf('card shows the skies')
    const heading = src.lastIndexOf('<h3>', card)
    expect(src.slice(heading, src.indexOf('</h3>', heading))).toBe('<h3>Species Detail')
  })
})

describe('card claim 1: the per-species floor is stated as the constant', () => {
  it('docs/HELP.md names it, and names the RIGHT one', () => {
    const text = helpSpeciesCardBullet()
    // Built FROM the constant, so raising it turns this red instead of leaving
    // the documentation quietly wrong -- the same trap one level up that
    // `speciesFloorNote()` closes in the code.
    const re = new RegExp(`\\bfewer than ${WEATHER_SPECIES_MIN_CHECKLISTS} weather-block checklists\\b`)
    expect(re.test(text), `HELP.md should name ${WEATHER_SPECIES_MIN_CHECKLISTS}`).toBe(true)
    // And the EXPORT floor is the other constant, named as the other thing.
    expect(text).toContain(`fewer than ${WEATHER_SECTION_MIN_READABLE} readable ones`)
    expect(WEATHER_SPECIES_MIN_CHECKLISTS).not.toBe(WEATHER_SECTION_MIN_READABLE)
    expect(WEATHER_SPECIES_MIN_CHECKLISTS).not.toBe(WEATHER_BAND_MIN_TO_SHOW)
  })

  it('docs/HELP.md says the below-floor state is the ordinary one, not an edge case', () => {
    // Four species in five land there on a real export, and the design is built
    // for that. A published sentence implying it is rare would misdescribe what
    // most readers will actually see. website-readme-copy-pass: HELP only; the
    // decision surfaces describe no floor and no below-floor state at all (a
    // threshold is operating detail), so they imply nothing about its frequency.
    expect(/ordinary outcome for most species/.test(helpSpeciesCardBullet())).toBe(true)
    for (const [name, get] of CARD_SURFACES.slice(1)) {
      expect(/too few|fewer than|below the floor|rare/.test(get()), `${name}: says nothing about the floor either way`).toBe(false)
    }
  })
})

describe('card claim 2: one numerator, two wholes, and nothing divides them', () => {
  it('docs/HELP.md states both wholes and says nothing divides them', () => {
    // website-readme-copy-pass: HELP only for the positive half; the mechanism
    // left the decision surfaces.
    const text = helpSpeciesCardBullet()
    expect(text).toContain('two different wholes')
    expect(/[Nn]othing divides/.test(text)).toBe(true)
  })

  for (const [name, get] of CARD_SURFACES) {
    it(`${name} never quietly promises a rate`, () => {
      // The negative half stays on every surface: a "helpful" coverage
      // percentage is the edit this claim exists to refuse, wherever it lands.
      const text = get()
      expect(/coverage percentage for the bird|percentage of the checklists you have it on/
        .test(text.replace('there is no coverage percentage for the bird', '')), name).toBe(false)
    })
  }
})

describe('card claim 3: one derivation, and the stated basis where they differ', () => {
  it('docs/HELP.md says the two surfaces come out of one derivation', () => {
    // website-readme-copy-pass: HELP only. "So the two always agree" is a
    // property whose negation would be a bug, which is not what a reader
    // deciding on the app is weighing; HELP keeps it, in both places.
    expect(/same derivation/.test(helpSpeciesCardBullet())).toBe(true)
  })

  it('docs/HELP.md states how the two bases relate, in the Statistics section', () => {
    // Where the card and the section CAN differ is published rather than left to
    // be discovered by a reader holding two numbers.
    const text = helpWeatherSection()
    expect(text).toContain('one derivation')
    expect(text).toContain('Count all forms')
    expect(text).toContain('two stated populations')
  })
})

describe('card claim 4: no picker, offline, and no prediction', () => {
  it('docs/HELP.md says it works offline and makes no lookup', () => {
    // website-readme-copy-pass: HELP only, for the same reason as claim 3 above.
    const text = helpSpeciesCardBullet().toLowerCase()
    expect(text).toContain('offline')
    expect(/no lookup|makes no network|no network request/.test(text)).toBe(true)
  })

  it('docs/HELP.md states there is no picker on it, and why', () => {
    // The decision that makes this not a duplicate of the Statistics view. It
    // used to be asserted on README and the website; website-readme-copy-pass
    // moves the fact into HELP's bullet, so this row reads HELP and is RED
    // against a HELP.md that predates that sentence, by design. The code side:
    // `SpeciesWeatherCard.tsx` declares no species state and renders no
    // selector, which is checked below rather than trusted.
    const text = helpSpeciesCardBullet()
    expect(/no picker/.test(text)).toBe(true)
    expect(/already looking at a bird/.test(text)).toBe(true)
    const src = read('frontend/src/components/SpeciesWeatherCard.tsx')
    const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n')
    expect(code).not.toContain('SpeciesCombobox')
    expect(code).not.toContain('<select')
  })

  it('none of them predicts or ranks, and HELP says so positively', () => {
    for (const [name, get] of CARD_SURFACES) {
      const text = get().toLowerCase()
      for (const phrase of ['best conditions', 'you should', 'expect to find', 'most associated']) {
        expect(text.includes(phrase), `${name}: "${phrase}"`).toBe(false)
      }
    }
    // Stated positively in HELP's Statistics section, which the card shares a
    // derivation with. website-readme-copy-pass: the decision surfaces no
    // longer state it anywhere (reassurance about what the app does not do);
    // they keep the negative leg above.
    expect(/never predicts|does not predict|no ranked/.test(helpWeatherSection().toLowerCase())).toBe(true)
  })
})

describe('the three card passages agree with each other, not merely each with the code', () => {
  it('all three name the surface from TAB_LABELS, never from a component name', () => {
    for (const [name, get] of CARD_SURFACES) {
      const text = get()
      // `SpeciesWeatherCard` and `WeatherSpeciesRow` are file names, and this
      // repo has published a component name as a surface name before.
      expect(text, name).not.toContain('SpeciesWeatherCard')
      expect(text, name).not.toContain('WeatherSpeciesRow')
      expect(text, name).not.toContain('SpeciesDetail')
    }
    // website-readme-copy-pass: the two decision surfaces no longer summarise
    // the card from outside the tab; each describes it INSIDE its own Species
    // Detail section (README, heading to heading) or article (the website, the
    // place row above), so the surface is named by its place, as HELP's is.
    expect(read('README.md')).toContain('\n### Species Detail\n')
  })

  it('all three name the apps whose blocks the card reads, and spell the other one its own way', () => {
    // website-readme-copy-pass brought the website into this row. The old
    // exemption ("the website paragraph leans on the section paragraph directly
    // above it for the attribution") stopped holding the moment the paragraph
    // moved out of the Statistics row into the Species Detail row: nothing is
    // directly above it now, so the attribution is stated where the claim is.
    for (const [name, get] of CARD_SURFACES) {
      const text = get()
      expect(text, name).toContain('SnowRaven')
      expect(text, name).toContain('RainCrow')
      expect(text, name).not.toContain('Raincrow')
    }
  })

  it('the two decision surfaces make the same card claim', () => {
    // Compared against each other: the card shows this bird's skies and
    // temperatures, drawn from the same two apps' blocks the Statistics passage
    // named. One surface having it right does not make the other right.
    for (const [name, get] of CARD_SURFACES.slice(1)) {
      const text = get()
      expect(text, name).toMatch(/card shows the skies and temperatures you have found this bird in/)
      expect(text, name).toMatch(/SnowRaven and RainCrow weather blocks/)
    }
  })

  it('carries no em dash', () => {
    for (const [name, get] of CARD_SURFACES) expect(get().includes('—'), name).toBe(false)
  })
})
