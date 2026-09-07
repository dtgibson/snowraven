// The Weather section's copy, swept as RULES over a GENERATED corpus.
//
// Not a ban list of known-bad strings. A ban list can only ever reject the
// defects someone already found, and the pass that fixed "about 1 minutes" in
// this repo shipped "1 requests" straight past one. The corpus below is built by
// CALLING every exported string builder across a grid of counts that includes
// every boundary the section can actually reach -- zero, one, the band floor
// either side, the section floor either side, and a large value -- so a new
// string joins the sweep by being added to `weatherStatsCopy.ts` and nowhere
// else.
//
// WHAT IT CANNOT SEE, said plainly: a count-bearing string built inline in the
// component is invisible here however correct it is today. That is exactly why
// the module exists, and `weatherStatsSection.test.tsx` renders the real
// component so a stray one would have to survive both.
import { describe, it, expect } from 'vitest'
import {
  NO_OUTINGS, SPECIES_FIGURE_SUFFIX, WEATHER_COPY, axisDenominator, axisDenominatorSuffix,
  bandHeadCount, belowFloorLine, coverageCounts, coverageDenominator, coveragePct,
  coverageSentence, durationFigureDenominator, durationFigureUnit, legendFloorNote,
  pickerRestLine, pickerRestParts, speciesChartNote, speciesFigure, speciesFigureValue,
  speciesGroupDenominator, speciesLede, speciesLedeParts, speciesRowReference,
  speciesRowShare, tempFootnote, thinDurationsLine, unreadableClause,
  filterBasisClause, formBasisClause, speciesFloorNote, speciesOwnWhole,
  speciesOwnWholeZero, speciesZeroLede, speciesZeroLedeParts,
} from './weatherStatsCopy'
import type { WeatherAxis } from './weatherStatsCopy'
import {
  WEATHER_BAND_MIN_TO_SHOW, WEATHER_SECTION_MIN_READABLE, WEATHER_SPECIES_MIN_CHECKLISTS,
} from './weatherStats'

/**
 * The corpus is generated PER RENDER STATE, not over a free grid of numbers.
 *
 * That matters twice. It covers every state the app can actually reach --
 * `weatherSectionState` admits exactly three, and the section's own gate decides
 * which strings exist at all -- and it covers NOTHING it cannot: the coverage
 * sentence is only ever rendered above the section floor, so sweeping it at one
 * readable checklist would demand wording for a screen that does not exist and
 * would make the guard about this test's imagination rather than the product.
 * Where a string is nonetheless correct over its whole domain (the coverage
 * sentence agrees its verb at every count), that is stated in its own assertion
 * below rather than inferred from the sweep.
 */
const BELOW_FLOOR_READABLE = [0, 1, 2, WEATHER_SECTION_MIN_READABLE - 1]
const FULL_READABLE = [
  WEATHER_SECTION_MIN_READABLE, WEATHER_SECTION_MIN_READABLE + 1,
  WEATHER_BAND_MIN_TO_SHOW - 1, WEATHER_BAND_MIN_TO_SHOW, WEATHER_BAND_MIN_TO_SHOW + 1,
  21, 100, 301, 1214, 12345,
]
/** A band count, or an unreadable count: both range freely from zero. */
const FREE_COUNTS = [
  0, 1, 2,
  WEATHER_BAND_MIN_TO_SHOW - 1, WEATHER_BAND_MIN_TO_SHOW, WEATHER_BAND_MIN_TO_SHOW + 1,
  21, 100, 301, 1214, 12345,
]
const AXES: WeatherAxis[] = ['sky', 'temp', 'wind', 'daynight']

/** The whole corpus, as `{ where, text }` so a failure names its own producer. */
function corpus(): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = []
  const add = (where: string, text: string) => { if (text) out.push({ where, text }) }

  // Static strings, rendered in every state that renders them.
  for (const [k, v] of Object.entries(WEATHER_COPY)) add(`WEATHER_COPY.${k}`, v)
  add('SPECIES_FIGURE_SUFFIX', SPECIES_FIGURE_SUFFIX)
  add('NO_OUTINGS', NO_OUTINGS)
  add('legendFloorNote', legendFloorNote())
  for (const axis of AXES) add(`axisDenominatorSuffix(${axis})`, axisDenominatorSuffix(axis))

  // ── State: below-floor ────────────────────────────────────────────────────
  for (const readable of BELOW_FLOOR_READABLE) {
    for (const unreadable of FREE_COUNTS) {
      add(`belowFloor(${readable}, ${unreadable})`, belowFloorLine(readable) + unreadableClause(unreadable))
    }
  }

  // ── State: full ───────────────────────────────────────────────────────────
  for (const readable of FULL_READABLE) {
    add(`pickerRestLine(${readable})`, pickerRestLine(readable))
    for (const unreadable of FREE_COUNTS) {
      for (const total of [readable, readable + unreadable, readable * 4 + 1]) {
        add(
          `coverageLine(${readable}, ${total}, ${unreadable})`,
          coverageSentence(readable, total) + unreadableClause(unreadable),
        )
        add(`coverageDenominator(${readable}, ${total})`, coverageDenominator(readable, total))
        add(`coverageCounts(${readable}, ${total})`, coverageCounts(readable, total))
      }
    }
    // A species is on at least one and at most every readable-block checklist.
    for (const onCount of [1, 2, Math.max(1, readable - 1), readable]) {
      add(`speciesLede(${onCount}, ${readable})`, speciesLede(onCount, readable))
      // Denominator 4, over every species total the lede can have bound.
      for (const axis of ['sky', 'temp'] as const) {
        for (const sum of [0, 1, Math.max(1, onCount - 1), onCount]) {
          add(`speciesGroupDenominator(${sum}, ${onCount}, ${axis})`,
            speciesGroupDenominator(sum, onCount, axis))
        }
      }
      // The row's own share, of the species' axis total.
      for (const count of [0, 1, Math.max(1, onCount - 1), onCount]) {
        add(`speciesRowShare(${count}, ${onCount})`, speciesRowShare(count, onCount))
      }
    }
    // A band's count, its duration denominator and its figures.
    for (const n of FREE_COUNTS) {
      if (n > readable) continue
      add(`bandHeadCount(${n})`, bandHeadCount(n))
      add(`thinDurationsLine(${n})`, thinDurationsLine(n))
      add(`durationFigureDenominator(${n})`, durationFigureDenominator(n))
      // The per-species row: the bird's count and its share of the bird's own
      // axis total, plus the reference share of ALL outings on that axis. Both
      // wholes are swept, at every count the row can hold.
      add(`speciesRowReference(${n}, ${n})`, speciesRowReference(n, n))
      for (const axisTotal of [n, readable]) {
        add(`speciesRowReference(${n}, ${axisTotal})`, speciesRowReference(n, axisTotal))
      }
      for (const axis of AXES) add(`axisDenominator(${n}, ${axis})`, axisDenominator(n, axis))
    }
    for (const avg of [0, 1, 1.05, 10, 13.5, 47.25]) {
      add(`speciesFigure(${avg})`, speciesFigure(avg))
      add(`durationFigureUnit(${avg})`, durationFigureUnit(avg))
    }
    for (const span of [null, 0, 1, 2, 6, 61]) {
      add(`tempFootnote(${span})`, tempFootnote(span))
    }
  }

  for (const name of ["Anna's Hummingbird", 'Dark-eyed Junco', 'Ruby-crowned Kinglet']) {
    add(`speciesChartNote(${name})`, speciesChartNote(name))
  }

  // ── The Species Detail card (species-detail-weather) ──────────────────────
  //
  // Swept at the counts the card can actually REACH, the same discipline the
  // rest of this file follows. The bird's own whole has a total of at least one
  // (a selectable bird is on at least one checklist) and a numerator of at least
  // one (zero takes its own function), and `on <= total` always, because the
  // numerator counts a subset of the same checklists.
  //
  // ONE is the interesting row rather than an edge: on the reference export 49
  // of the 114 zero-block species sit at exactly one checklist, so the singular
  // is the case a fixture-driven suite is least likely to exercise and the one
  // many users meet first.
  add('speciesFloorNote', speciesFloorNote())
  add('filterBasisClause', filterBasisClause())
  add('formBasisClause', formBasisClause())
  const OWN_TOTALS = [1, 2, 3, 9, 10, 11, 26, 97, 1307]
  for (const total of OWN_TOTALS) {
    add(`speciesOwnWholeZero(${total})`, speciesOwnWholeZero(total))
    for (const on of [...new Set([1, 2, Math.max(1, total - 1), total])].filter(n => n <= total)) {
      add(`speciesOwnWhole(${on}, ${total})`, speciesOwnWhole(on, total))
    }
  }
  for (const readable of FULL_READABLE) {
    add(`speciesZeroLede(${readable})`, speciesZeroLede(readable))
    // The OPENING BLOCK as the component composes it: the lede, the bird's own
    // whole, and the muted run with every clause that can apply. Composed rather
    // than swept apart, because the sentence-scoped agreement rules are about
    // sentences the reader actually meets in one paragraph.
    for (const total of OWN_TOTALS) {
      for (const on of [1, Math.min(total, readable)]) {
        if (on > total) continue
        const parts = speciesLedeParts(on, readable)
        add(`openingBlock(${on}, ${readable}, ${total})`,
          `${parts.lead} ${speciesOwnWhole(on, total)} ${parts.note} `
          + `${filterBasisClause()} ${formBasisClause()}`)
      }
      const zero = speciesZeroLedeParts(readable)
      add(`openingBlockZero(${readable}, ${total})`,
        `${zero.lead} ${speciesOwnWholeZero(total)} ${zero.note} `
        + `${filterBasisClause()} ${formBasisClause()}`)
    }
  }
  return out
}

const CORPUS = corpus()

describe('the corpus is real', () => {
  it('is generated by calling the module, not written out here', () => {
    // Non-vacuity: every rule below sweeps nothing if this is empty or tiny.
    expect(CORPUS.length).toBeGreaterThan(1000)
    // And it reaches the interesting boundaries, in both states.
    expect(CORPUS.some(c => c.where === 'bandHeadCount(1)')).toBe(true)
    expect(CORPUS.some(c => c.where === 'thinDurationsLine(1)')).toBe(true)
    expect(CORPUS.some(c => c.where.startsWith('belowFloor(1, '))).toBe(true)
    expect(CORPUS.some(c => c.where.startsWith('coverageLine(5, '))).toBe(true)
    expect(CORPUS.some(c => c.where === 'speciesLede(1, 5)')).toBe(true)
  })
})

describe('number agreement, over the whole corpus', () => {
  it('no count of one takes a plural noun', () => {
    // The rule is stated over the SHAPE -- a count of one followed by a word
    // ending in `s` -- rather than over a list of known-bad strings, which could
    // only ever reject the defects someone already found.
    //
    // Two kinds of word end in `s` and are not a plural noun, and both are
    // exempted BY NAME so the exemption is reviewable rather than a loosening:
    // invariant plurals (`1 species` is correct English), and singular VERBS
    // (`1 of its 1 has a sky condition` is the corrected form of a defect this
    // very rule caught).
    const NOT_A_PLURAL_NOUN = new Set([
      'species', 'gaps',        // invariant plurals
      'is', 'has', 'was', 'does', // singular verbs
    ])
    const bad: string[] = []
    for (const { where, text } of CORPUS) {
      for (const m of text.matchAll(/\b1 ([a-z]+s)\b/g)) {
        if (!NOT_A_PLURAL_NOUN.has(m[1])) bad.push(`${where}: "${m[0]}"`)
      }
    }
    expect(bad).toEqual([])
  })

  it('no determiner takes a bare "1"', () => {
    // The lookahead is load-bearing, not tidying: `\b` sits happily between a
    // digit and a comma, so a bare `\b` here matches "your 1" inside "your
    // 1,219 checklists" and reports 77 defects that are not there. Same trap
    // this repo has recorded twice (`/\b100%\b/`, `/^\.sr-foo\b/`).
    const bad: string[] = []
    for (const { where, text } of CORPUS) {
      for (const m of text.matchAll(/\b(?:the|a|an|these|those|your) 1(?![\d,.])/gi)) {
        bad.push(`${where}: "${m[0]}"`)
      }
    }
    expect(bad).toEqual([])
  })

  it('the auxiliary exemption still rejects the defect the verb rule exists for', () => {
    // Guard the guard, in both directions. The exemption must pardon a bare
    // infinitive after an auxiliary and NOTHING else -- an exemption that
    // swallowed the finite case would make the whole rule pass on anything.
    const VERBS = /\b(?:are|were|have|do|carry|cover|show|include|contain|count|record)\b/g
    const AUX = /\b(?:does|did|to|can|will|may|must|should|would)\s+(?:not\s+)?$/
    const flags = (sentence: string) => {
      const one = /(?:^|\s)1 [a-z]/.exec(sentence)
      if (!one) return false
      const after = sentence.slice(one.index + one[0].length)
      if (/\b(?:[02-9]|\d{2,}) [a-z]/.test(after)) return false
      for (const m of after.matchAll(new RegExp(VERBS.source, 'g'))) {
        if (AUX.test(after.slice(0, m.index))) continue
        return true
      }
      return false
    }
    // The defect this rule was written for, four words between subject and verb.
    expect(flags('Only 1 row of these carry a weather block.')).toBe(true)
    expect(flags('The 1 checklist have a weather block.')).toBe(true)
    // The correct singular the exemption exists for.
    expect(flags('You have it on 1 checklist, and it does not carry a weather block.')).toBe(false)
    // And the auxiliary itself is still caught, which is what keeps the
    // exemption from being a hole: `do` is in the list and `\bdo\b` does not
    // match inside "does".
    expect(flags('You have it on 1 checklist, and it do not carry a weather block.')).toBe(true)
  })

  it('that determiner rule still rejects the defect it exists for', () => {
    // Guard the guard: a lookahead that excluded too much would make the rule
    // above pass on anything.
    const probe = /\b(?:the|a|an|these|those|your) 1(?![\d,.])/i
    expect(probe.test('cover the 1 checklist')).toBe(true)
    expect(probe.test('of your 1 checklist')).toBe(true)
    expect(probe.test('of your 1,219 checklists')).toBe(false)
    expect(probe.test('of your 1.5 checklists')).toBe(false)
  })

  it('no plural verb follows a subject counted at one, SENTENCE-scoped', () => {
    // Sentence-scoped deliberately: `1 row ... carry` puts four words between
    // subject and verb, which no window- or string-scoped check reaches.
    //
    // Scanned only AFTER the counted one, because a verb BEFORE it has a
    // different subject entirely -- "You have 1 checklist" is correct English
    // and a whole-sentence scan calls it a defect.
    // `do` joins the list at species-detail-weather, and it is what makes the
    // auxiliary exemption below safe rather than a loosening: `\bdo\b` does not
    // match "does", so "1 checklist do not carry" is still caught at the
    // auxiliary even though "carry" after it is exempt.
    const PLURAL_VERBS = /\b(?:are|were|have|do|carry|cover|show|include|contain|count|record)\b/g
    // A BARE INFINITIVE AFTER AN AUXILIARY IS NOT A FINITE PLURAL VERB, and the
    // auxiliary already carries the agreement: "it does not carry a weather
    // block" is the CORRECT singular, and `speciesOwnWholeZero(1)` renders
    // exactly that. Without this the rule reports a defect that is not there,
    // and the pressure would be to reword correct copy to satisfy a naive scan.
    const AUXILIARY_BEFORE = /\b(?:does|did|to|can|will|may|must|should|would)\s+(?:not\s+)?$/
    const bad: string[] = []
    for (const { where, text } of CORPUS) {
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        const one = /(?:^|\s)1 [a-z]/.exec(sentence)
        if (!one) continue
        const after = sentence.slice(one.index + one[0].length)
        // Only while the ONE is still the subject: another count after it takes
        // over, and its own agreement is that count's business.
        if (/\b(?:[02-9]|\d{2,}) [a-z]/.test(after)) continue
        for (const m of after.matchAll(PLURAL_VERBS)) {
          if (AUXILIARY_BEFORE.test(after.slice(0, m.index))) continue
          bad.push(`${where}: "${sentence.trim()}" (${m[0]})`)
          break
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('the singular forms really are produced, so the rules above are not vacuous', () => {
    expect(bandHeadCount(1)).toBe('1 checklist')
    expect(bandHeadCount(2)).toBe('2 checklists')
    expect(unreadableClause(1)).toContain('1 more carries a block')
    expect(unreadableClause(7)).toContain('7 more carry a block')
    expect(belowFloorLine(1)).toContain('1 checklist with a readable')
    expect(belowFloorLine(4)).toContain('4 checklists with a readable')
    expect(thinDurationsLine(1)).toContain('Only 1 of these has a recorded time')
    expect(thinDurationsLine(5)).toContain('Only 5 of these have a recorded time')
    // The coverage sentence agrees over its WHOLE domain, including counts the
    // section's own floor keeps it from ever rendering. A string correct only at
    // the values sampled is correct by luck.
    expect(coverageSentence(1, 9)).toContain('the 1 checklist that carries a weather block')
    expect(coverageSentence(2, 9)).toContain('the 2 checklists that carry a weather block')
    expect(coverageSentence(9, 1)).toContain('of your 1 checklist.')
    expect(coverageSentence(9, 12)).toContain('of your 12 checklists.')
  })
})

describe('the Species Detail card\'s six new strings (species-detail-weather)', () => {
  it('the bird\'s own whole binds the repeated numerator with "That is"', () => {
    // Without it the same figure printed twice reads as two different counts;
    // with it the repeated number is unmistakably one number held against two
    // wholes, which is the card's whole thesis stated before the chart.
    expect(speciesOwnWhole(308, 1307)).toBe('That is 308 of the 1,307 checklists you have it on.')
    expect(speciesOwnWhole(5, 97)).toBe('That is 5 of the 97 checklists you have it on.')
    expect(speciesOwnWhole(2, 2)).toBe('That is 2 of the 2 checklists you have it on.')
  })

  it('and takes its own sentence at one, where the obvious formula reads wrong', () => {
    // "That is 1 of the 1 checklist you have it on." is what the formula
    // produces and it is wrong three ways: a determiner on a bare "1", a numeral
    // held against itself, and a clumsy line where the sentence is meant to be
    // an account. The words carry the count instead. This is the ONE case where
    // the second sentence prints no numeral, which is why the equality assertion
    // in the card's own suite is stated for totals of two and up.
    expect(speciesOwnWhole(1, 1)).toBe('That is the one checklist you have it on.')
    expect(speciesOwnWhole(1, 1)).not.toContain(' 1 ')
  })

  it('NOTHING in it divides one whole by the other, at any pair of counts', () => {
    // Two shares of two different wholes sit side by side; a rate is precisely
    // what the pattern exists to refuse, and there is no coverage percentage for
    // the bird on the card or anywhere, now or later.
    for (const total of [1, 2, 26, 97, 1307]) {
      for (const on of [1, Math.max(1, total - 1), total]) {
        if (on > total) continue
        expect(speciesOwnWhole(on, total)).not.toContain('%')
      }
      expect(speciesOwnWholeZero(total)).not.toContain('%')
    }
  })

  it('the zero case leads with the bird\'s own record, and both clauses inflect at one', () => {
    expect(speciesOwnWholeZero(26))
      .toBe('You have it on 26 checklists, and none of them carry a weather block.')
    expect(speciesOwnWholeZero(1))
      .toBe('You have it on 1 checklist, and it does not carry a weather block.')
    // Never the bare zero the shipped helpers would print.
    expect(speciesOwnWholeZero(26)).not.toContain('That is 0')
    expect(speciesZeroLedeParts(353).lead).toBe('is on none of your 353 weather-block checklists.')
    expect(speciesZeroLedeParts(353).lead).not.toContain('0 of your')
    // The zero lede keeps the shipped note, so the component renders one branch.
    expect(speciesZeroLedeParts(353).note).toBe(speciesLedeParts(5, 353).note)
  })

  it('the floor note is built FROM the constant, so raising it moves the sentence', () => {
    expect(speciesFloorNote()).toContain(String(WEATHER_SPECIES_MIN_CHECKLISTS))
    // It names what would CHANGE rather than what is missing, which is the
    // honest replacement for the route this state declines to offer.
    expect(speciesFloorNote()).toContain('appear once a bird is on')
    expect(speciesFloorNote()).not.toMatch(/not enough|too few|no data|unavailable/i)
    // And it is the SPECIES floor, not the section floor or the band floor.
    expect(WEATHER_SPECIES_MIN_CHECKLISTS).not.toBe(WEATHER_SECTION_MIN_READABLE)
    expect(WEATHER_SPECIES_MIN_CHECKLISTS).not.toBe(WEATHER_BAND_MIN_TO_SHOW)
  })

  it('the two basis clauses say what they are about and nothing else', () => {
    expect(filterBasisClause())
      .toBe('These cover every checklist in your export, so this tab\'s filters do not narrow them.')
    // The form clause does not name the parent: the lede's BirdName already
    // shows it, and naming it twice is a second place for one fact.
    expect(formBasisClause()).toBe('Every form counts as its parent species.')
    expect(formBasisClause().split(' ').length).toBeLessThan(8)
  })

  it('every new string is in the corpus, so none of the sweeps is passing it by', () => {
    // The whole reason these live in this module. A count-bearing string built
    // inline in the component would be invisible to every rule above however
    // correct it happens to be today.
    for (const where of [
      'speciesFloorNote', 'filterBasisClause', 'formBasisClause',
      'speciesOwnWhole(1, 1)', 'speciesOwnWholeZero(1)', 'speciesZeroLede(5)',
      'openingBlock(1, 5, 1)', 'openingBlockZero(5, 26)',
    ]) {
      expect(CORPUS.some(c => c.where === where), where).toBe(true)
    }
  })
})

describe('the section never predicts, recommends or ranks (FR-29)', () => {
  const FORBIDDEN = [
    'best conditions', 'you should', 'expect to find', 'correlation',
    'most associated', 'likely', 'predict', 'recommend', 'ideal for',
    'unknown weather', 'could not read your',
  ]
  it('no forbidden phrase appears anywhere in the corpus', () => {
    const bad: string[] = []
    for (const { where, text } of CORPUS) {
      const lower = text.toLowerCase()
      for (const phrase of FORBIDDEN) if (lower.includes(phrase)) bad.push(`${where}: "${phrase}"`)
    }
    expect(bad).toEqual([])
  })

  it('the residual condition row is labelled "Other", never "Unknown"', () => {
    // The 🌡️ group is a real value the formatter wrote into a real block, not a
    // parse failure -- "Unknown weather" would read as one.
    expect(WEATHER_COPY.skyFootnote).toContain('Other is the glyph')
    expect(WEATHER_COPY.skyFootnote.toLowerCase()).not.toContain('unknown')
  })
})

describe('copy conventions', () => {
  it('no em dash anywhere', () => {
    const bad = CORPUS.filter(c => c.text.includes('—')).map(c => c.where)
    expect(bad).toEqual([])
  })

  it('names user-facing surfaces from TAB_LABELS, never from a component name', () => {
    // "Weather Backlog" is a component name and the pipeline's internal name for
    // a section whose own visible heading is "List checklists with no weather
    // blocks", on a tab labelled Weather.
    const bad = CORPUS.filter(c => /weather backlog|birding ?stats|life ?list tab/i.test(c.text))
    expect(bad.map(c => c.where)).toEqual([])
    expect(WEATHER_COPY.route).toBe('Fill in the gaps on the Weather tab')
  })

  it('the OpenWeather provider is not named, because a RainCrow block is not theirs to attribute', () => {
    const bad = CORPUS.filter(c => /openweather/i.test(c.text))
    expect(bad.map(c => c.where)).toEqual([])
    expect(WEATHER_COPY.skyFootnote).toContain('the weather service')
  })

  it('the legend floor is built FROM the constant, not re-spelled', () => {
    expect(legendFloorNote()).toContain(String(WEATHER_BAND_MIN_TO_SHOW))
  })
})

describe('the figures the copy is about', () => {
  it('the coverage percentage is a whole percent of the real ratio', () => {
    expect(coveragePct(301, 1214)).toBe(25)
    expect(coveragePct(0, 0)).toBe(0)
    expect(coverageDenominator(301, 1214)).toBe('25% · 301 of 1,214')
  })

  it('the temperature footnote handles a zero median without reading as a glitch', () => {
    // "Half your blocks span 0°F or less" is true and looks broken.
    expect(tempFootnote(0)).toContain('record a single temperature rather than a range')
    expect(tempFootnote(0)).not.toContain('0°F or less')
    expect(tempFootnote(6)).toContain('Half your blocks span 6°F or less.')
    expect(tempFootnote(null)).not.toContain('Half your blocks')
  })

  it('the two zeros are different strings, and only one carries a numeral', () => {
    // `0 · 0%` is a fact about the BIRD (outings in that band, never this
    // species); `no outings` is a fact about the BIRDER. They must never render
    // alike, and the reference figure is the third place they differ.
    expect(speciesRowShare(0, 27)).toBe('0%')
    expect(NO_OUTINGS).toBe('no outings')
    expect(NO_OUTINGS).not.toMatch(/\d/)
    // The reference is present for a band with outings and ABSENT for one
    // without: "outings 0%" would only repeat what "no outings" already said.
    expect(speciesRowReference(27, 298)).toBe('outings 9%')
    expect(speciesRowReference(0, 298)).toBe('')
  })

  it('a share the bird really has never rounds away to nothing', () => {
    // The "<1%" floor is load-bearing on this chart: a band the bird was
    // genuinely in must not read as one it was not.
    expect(speciesRowShare(1, 400)).toBe('<1%')
    expect(speciesRowShare(0, 400)).toBe('0%')
    expect(speciesRowReference(1, 400)).toBe('outings <1%')
  })

  it('the species group denominator names the species by pronoun, and agrees its verb', () => {
    // "of its 78" is deliberate: it binds to the lede one line above, so a
    // skimmer cannot read 77 as an outing count disagreeing with the card's own
    // coverage figure.
    expect(speciesGroupDenominator(77, 78, 'sky')).toBe('77 of its 78 have a sky condition')
    expect(speciesGroupDenominator(76, 78, 'temp')).toBe('76 of its 78 have a temperature')
    expect(speciesGroupDenominator(1, 1, 'sky')).toBe('1 of its 1 has a sky condition')
  })

  it('the species average keeps one decimal', () => {
    expect(speciesFigureValue(13.5)).toBe('13.5')
    expect(speciesFigure(10)).toBe('10.0 species per checklist')
  })

  it('the duration figure carries its own denominator, which the band count does not', () => {
    expect(durationFigureUnit(32.12)).toBe('32 min')
    expect(durationFigureDenominator(103)).toBe('· from 103 with a time')
  })

  it('the parts and the whole agree, so the sweep reads what the component renders', () => {
    const COUNTS = [...BELOW_FLOOR_READABLE, ...FULL_READABLE]
    for (const n of COUNTS) {
      const p = pickerRestParts(n)
      expect(`${p.lead} ${p.note}`).toBe(pickerRestLine(n))
      for (const m of COUNTS) {
        const q = speciesLedeParts(n, m)
        expect(`${q.lead} ${q.note}`).toBe(speciesLede(n, m))
      }
      for (const axis of AXES) {
        expect(axisDenominator(n, axis)).toContain(axisDenominatorSuffix(axis))
      }
    }
  })
})
