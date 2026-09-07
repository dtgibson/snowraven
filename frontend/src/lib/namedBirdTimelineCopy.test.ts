// The copy guard for the Named Birds timelines.
//
// IT STATES RULES OVER A GENERATED CORPUS, never a ban list of known-bad strings
// and never two hand-picked samples. A ban list can only reject the defects
// someone has already found; the rules below found nothing here because the
// module was written against them, which is the point of writing them first.
//
// The corpus is generated from the shipped copy FUNCTIONS over every count and
// every range the tab can actually reach, so a new state joins the sweep for
// free and nothing it cannot reach is swept.

import { describe, it, expect } from 'vitest'
import * as copy from './namedBirdTimelineCopy'
import type { SpanRange, TimelineAxis } from './namedBirdTimeline'

const RANGES: SpanRange[] = ['last-sighting', 'today']
const AXIS: TimelineAxis = { start: '2025-07-16', end: '2026-07-10', spanDays: 359 }

/** Every count the tab can reach, including the ones a realistic fixture never produces. */
const COUNTS = [1, 2, 3, 11, 21, 40, 101, 200]

/** Every user-facing string the module can render, over its whole reachable state space. */
function corpus(): string[] {
  const out: string[] = [
    copy.rangeLabel, copy.optLastSighting, copy.optToday, copy.scopeNote,
    copy.perBirdHead, copy.masterHead, copy.restPerBird, copy.restMaster, copy.lbMaster,
    copy.rangeGroupTab, copy.rangeGroupCard, copy.rangeGroupMaster,
    copy.oneDate('2026-07-04'),
    copy.lbPerBird('Bridge-Ravens'),
    copy.laneGroup('Bridge-Ravens', 'Common Raven'),
    copy.laneGroup('Bridge-Ravens', ''),
  ]
  for (const n of COUNTS) {
    out.push(copy.birdCount(n))
    for (const r of RANGES) {
      out.push(copy.masterSentence(n, AXIS, r), copy.masterCaption(n, r))
    }
    for (let i = 1; i <= Math.min(n, 3); i += 1) out.push(copy.readLine2(i, n))
  }
  for (const r of RANGES) out.push(copy.endpoints(r))
  for (const list of [[], ['A'], ['A', 'B'], ['A', 'B', 'C'], ['A', 'B', 'C', 'D']]) {
    out.push(copy.places(list))
    out.push(copy.readLine1('Bridge-Ravens', '2026-06-15', list))
    out.push(copy.readLine1('', '2026-06-15', list))
    out.push(copy.optionName('Bridge-Ravens', '2026-06-15', list))
    out.push(copy.optionName('', '2026-06-15', list))
  }
  return out
}

describe('the generated corpus obeys the house copy rules', () => {
  it('is not empty, and every entry is a real string (non-vacuity)', () => {
    const all = corpus()
    expect(all.length).toBeGreaterThan(60)
    expect(all.every(s => typeof s === 'string')).toBe(true)
  })

  it('no count of one takes a plural noun', () => {
    const offenders = corpus().filter(s => /\b1 [a-z]+s\b/.test(s))
    expect(offenders).toEqual([])
  })

  it('no determiner takes a bare "1"', () => {
    const offenders = corpus().filter(s => /\b(the|a|an|this|that|these|those) 1\b/i.test(s))
    expect(offenders).toEqual([])
  })

  it('no plural verb follows a subject counted at one, checked at SENTENCE scope', () => {
    // Sentence scope, not window scope: `1 row ... carry` puts four words between
    // the subject and the verb, and no window-scoped check reaches it.
    const offenders: string[] = []
    for (const s of corpus()) {
      for (const sentence of s.split(/(?<=[.!?])\s+/)) {
        if (/\b1 [a-z]+\b/.test(sentence) && /\b(are|were|have|carry|show|contain|include)\b/.test(sentence)) {
          offenders.push(sentence)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('contains no em dash (U+2014)', () => {
    expect(corpus().filter(s => s.includes('—'))).toEqual([])
  })

  it('never names this surface from a component or a file name', () => {
    // The surface is Named Birds. "Master timeline", "tick list" and "listbox"
    // are internal names that must not reach the screen.
    const banned = /master timeline|tick ?list|NamedBird[A-Z]|listbox|timeline component/i
    expect(corpus().filter(s => banned.test(s))).toEqual([])
  })
})

describe('birdCount', () => {
  it('agrees in number at every count the tab can reach', () => {
    expect(copy.birdCount(1)).toBe('1 named bird')
    expect(copy.birdCount(0)).toBe('0 named birds')
    for (const n of COUNTS.filter(n => n !== 1)) expect(copy.birdCount(n)).toBe(`${n} named birds`)
  })
})

describe('readLine2 — the position line counts DATES, not sightings', () => {
  it('is singular at one and plural above it', () => {
    expect(copy.readLine2(1, 1)).toBe('1 of 1 date')
    expect(copy.readLine2(1, 2)).toBe('1 of 2 dates')
    expect(copy.readLine2(8, 9)).toBe('8 of 9 dates')
  })

  it('says "dates" rather than "sightings", which is what explains 8 sightings and 7 marks', () => {
    for (const n of COUNTS) expect(copy.readLine2(1, n)).toContain('date')
    expect(copy.readLine2(1, 9)).not.toContain('sighting')
  })
})

describe('places — stated as a PROPERTY over the whole input domain', () => {
  /**
   * The claim is not "it is right at two sample values". For a list of length n:
   * n = 0 renders the empty string; n = 1 renders that element alone; n = 2
   * joins both with "and"; every n >= 3 renders the first element plus
   * "and {n - 1} more places". Swept over the whole reachable domain below, not
   * sampled.
   */
  const name = (i: number) => `Place ${i}`
  const listOf = (n: number) => Array.from({ length: n }, (_, i) => name(i))

  it('holds for every length from 0 to 200', () => {
    for (let n = 0; n <= 200; n += 1) {
      const s = copy.places(listOf(n))
      if (n === 0) { expect(s).toBe(''); continue }
      if (n === 1) { expect(s).toBe(name(0)); continue }
      if (n === 2) { expect(s).toBe(`${name(0)} and ${name(1)}`); continue }
      expect(s).toBe(`${name(0)} and ${n - 1} more places`)
    }
  })

  it('never puts a singular noun after a count, because the count is always at least 2 there', () => {
    for (let n = 3; n <= 200; n += 1) {
      const s = copy.places(listOf(n))
      expect(s).toMatch(/ and \d+ more places$/)
      expect(s).not.toMatch(/ and 1 more place/)
    }
  })

  it('is EXTENSIBLE: adding a hypothetical extra row changes only the count, never the shape', () => {
    // Extensibility asserted only against the shipped shapes is untested by
    // construction. Take a list the app produces today and add one more place.
    const shipped = ['Pierce and Washington', 'Solano Hill - Gateview Crest', 'Buchanan Curl']
    expect(copy.places(shipped)).toBe('Pierce and Washington and 2 more places')
    expect(copy.places([...shipped, 'Freeway Underpass'])).toBe('Pierce and Washington and 3 more places')
  })
})

describe('readLine1 and optionName — the same facts, punctuated for two audiences', () => {
  it('omits each absent segment rather than leaving a dangling separator', () => {
    expect(copy.readLine1('', '2026-06-15', [])).toBe('Jun 15, 2026')
    expect(copy.optionName('', '2026-06-15', [])).toBe('Jun 15, 2026')
    expect(copy.readLine1('Ravens', '2026-06-15', [])).toBe('Ravens · Jun 15, 2026')
    expect(copy.optionName('Ravens', '2026-06-15', [])).toBe('Ravens, Jun 15, 2026')
  })

  it('the spoken form is comma-punctuated and the visible form uses the app\'s middot', () => {
    const p = ['Pierce and Washington']
    expect(copy.readLine1('Ravens', '2026-06-15', p)).toBe('Ravens · Jun 15, 2026 · Pierce and Washington')
    expect(copy.optionName('Ravens', '2026-06-15', p)).toBe('Ravens, Jun 15, 2026, Pierce and Washington')
  })

  it('an option name carries NO position words, so a screen reader does not say them twice', () => {
    // Position belongs to aria-posinset / aria-setsize. This is the assertion
    // that keeps it out of the name.
    for (const n of COUNTS) {
      const s = copy.optionName('Ravens', '2026-06-15', ['A', 'B'])
      expect(s).not.toMatch(/\b\d+ of \d+\b/)
      expect(copy.readLine2(1, n)).toMatch(/\b\d+ of \d+\b/)   // it lives here instead
    }
  })

  it('names two places on one date in full, which is the two-checklists-one-date case', () => {
    expect(copy.optionName('Freeway-Turkey-Fam', '2026-06-12', ['Buchanan Curl', 'Pierce and Washington']))
      .toBe('Freeway-Turkey-Fam, Jun 12, 2026, Buchanan Curl and Pierce and Washington')
    // WHAT THIS ROW CANNOT SEE, said here rather than left to be assumed: these
    // helpers are pure formatters over an ALREADY ORDERED list, so no assertion
    // in this file can reject a places array that arrives reversed. That order is
    // `distinctDates`' job and is guarded end to end in
    // `namedBirdTimeline.test.ts` ("a production-ordered bird names its places
    // chronologically in the SPOKEN payload"), which drives the real records
    // through both modules.
  })
})

describe('the master sentence and caption carry the same facts', () => {
  it('the sentence names the bird count and both endpoint dates, and changes with the range', () => {
    expect(copy.masterSentence(3, AXIS, 'last-sighting')).toBe('3 named birds, from Jul 16, 2025 to Jul 10, 2026.')
    expect(copy.masterSentence(3, AXIS, 'today')).toBe('3 named birds, from Jul 16, 2025 to today, Jul 10, 2026.')
    expect(copy.masterSentence(1, AXIS, 'last-sighting')).toBe('1 named bird, from Jul 16, 2025 to Jul 10, 2026.')
  })

  it('the caption carries the same count and the same range, in the same words', () => {
    for (const n of COUNTS) {
      for (const r of RANGES) {
        expect(copy.masterCaption(n, r)).toContain(copy.birdCount(n))
        expect(copy.masterCaption(n, r)).toContain(copy.endpoints(r))
        expect(copy.masterSentence(n, AXIS, r)).toContain(copy.birdCount(n))
      }
    }
  })
})

describe('endpoints — both ends named, in both states', () => {
  it('names both dates the figure measures, whichever way the switch is set', () => {
    expect(copy.endpoints('last-sighting')).toBe('first to last sighting')
    expect(copy.endpoints('today')).toBe('first sighting to today')
  })

  it('is label-agnostic: the phrase never restates the control\'s own button labels', () => {
    // The switch's values name the ENDPOINT, so a relabel of the buttons touches
    // this module and nothing else.
    for (const r of RANGES) expect(copy.endpoints(r)).not.toBe(r)
  })
})

describe('oneDate — the zero-span sentence', () => {
  it('reuses the shipped one-item idiom and names the date', () => {
    expect(copy.oneDate('2026-07-04')).toBe('Every sighting on Jul 4, 2026.')
  })

  it('is never the shipped lie "1 day"', () => {
    expect(copy.oneDate('2026-07-04')).not.toContain('1 day')
  })
})
