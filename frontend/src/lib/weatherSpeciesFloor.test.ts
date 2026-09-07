/// <reference types="node" />
// The per-species floor and the ONE discriminator that reads it
// (species-detail-weather, FR-04, FR-09, FR-10, QA-03, QA-07).
//
// A separate file from `weatherStats.test.ts` on purpose: that file is the
// shipped v1.0.22 suite for the aggregation and the two shipped thresholds, and
// leaving it untouched is part of what makes "the Statistics section's own
// behaviour is unchanged" checkable rather than argued.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  WEATHER_BAND_MIN_TO_SHOW, WEATHER_SECTION_MIN_READABLE, WEATHER_SPECIES_MIN_CHECKLISTS,
  speciesWeatherIndex, speciesWeatherState, weatherSectionState,
} from './weatherStats'
import type { WeatherStats } from './weatherStats'

/** A stats object shaped only where the discriminator reads it. Hand-built here
 *  deliberately: this is a test of the PREDICATE, and driving it from a fixture
 *  would make the boundary cases hard to name and easy to miss. */
function stats(over: Partial<WeatherStats> & Pick<WeatherStats, 'foundCount' | 'readableCount'>): WeatherStats {
  return {
    totalChecklists: 100, unreadableCount: 0, medianTempSpanF: null,
    byCondition: [], byTempBand: [], byWindBand: [],
    dayNight: { day: 0, night: 0, denominator: 0 },
    species: { names: [], checklists: [], byCondition: [], byTempBand: [] },
    ...over,
  } as WeatherStats
}

function source(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
}
const code = (rel: string) =>
  source(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '')

describe('the per-species floor is its own judgement, not a borrowed one (FR-09, QA-07)', () => {
  it('is a named constant at ten', () => {
    expect(WEATHER_SPECIES_MIN_CHECKLISTS).toBe(10)
  })

  it('does not import, derive from, or express itself as a multiple of the section floor', () => {
    // Two independent judgements, one about an EXPORT and one about a BIRD,
    // which may share a value and must not share a constant. Coupling them would
    // make a future change to one silently move the other -- the same reason
    // `WEATHER_BAND_MIN_TO_SHOW` deliberately does not import
    // `RATINGS_MIN_TO_SHOW`, which it happens to equal.
    const src = code('./weatherStats.ts')
    const decl = /export const WEATHER_SPECIES_MIN_CHECKLISTS\s*=\s*([^\n]+)/.exec(src)
    expect(decl, 'the constant must be declared here').toBeTruthy()
    expect(decl![1].trim()).toBe('10')
    // No arithmetic anywhere relating the two.
    expect(src).not.toMatch(/WEATHER_SPECIES_MIN_CHECKLISTS\s*=\s*[^\n]*WEATHER_SECTION_MIN_READABLE/)
    expect(src).not.toMatch(/WEATHER_SECTION_MIN_READABLE\s*[*+\-/]\s*\d/)
    // And the values are genuinely different, so "they happen to agree" is not
    // quietly doing the work here.
    expect(WEATHER_SPECIES_MIN_CHECKLISTS).not.toBe(WEATHER_SECTION_MIN_READABLE)
    expect(WEATHER_SPECIES_MIN_CHECKLISTS).not.toBe(WEATHER_BAND_MIN_TO_SHOW)
  })

  it('carries its reason in the code, in the terms the decision was made in', () => {
    const src = source('./weatherStats.ts')
    const at = src.indexOf('export const WEATHER_SPECIES_MIN_CHECKLISTS')
    const reason = src.slice(Math.max(0, at - 1800), at)
    expect(reason).toMatch(/ones and zeros|eleven sky conditions/)
    expect(reason).toContain('four species in five')
  })
})

describe('ONE discriminator, four states, and the test order is load-bearing (FR-04, QA-03)', () => {
  const above = { foundCount: 400, readableCount: 400 }

  it('returns absent when nothing was found at all', () => {
    expect(speciesWeatherState(stats({ foundCount: 0, readableCount: 0 }), 0)).toBe('absent')
    // Even for a bird with a count, which cannot happen but must not decide it.
    expect(speciesWeatherState(stats({ foundCount: 0, readableCount: 0 }), 99)).toBe('absent')
  })

  it('reads the EXPORT floor before the bird\'s, so a thin export is named as one', () => {
    // A user with four readable blocks is told about their export rather than
    // about this bird. Reversing the two tests renders a floor note about one
    // species over an export that cannot chart anything at all, which is a true
    // sentence about the wrong subject.
    for (const readable of [1, WEATHER_SECTION_MIN_READABLE - 1]) {
      expect(speciesWeatherState(stats({ foundCount: 10, readableCount: readable }), 0))
        .toBe('export-below-floor')
      expect(speciesWeatherState(stats({ foundCount: 10, readableCount: readable }), 99))
        .toBe('export-below-floor')
    }
  })

  it('is exact at the bird\'s boundary', () => {
    expect(speciesWeatherState(stats(above), WEATHER_SPECIES_MIN_CHECKLISTS - 1)).toBe('bird-below-floor')
    expect(speciesWeatherState(stats(above), WEATHER_SPECIES_MIN_CHECKLISTS)).toBe('full')
    expect(speciesWeatherState(stats(above), 0)).toBe('bird-below-floor')
  })

  it('agrees with the shipped section discriminator wherever they overlap', () => {
    // The two are separate functions answering separate questions, and the
    // Statistics section's is untouched by this work -- but they must not
    // disagree about the EXPORT, or the same file would be described two ways on
    // two tabs.
    for (const [found, readable] of [[0, 0], [10, 1], [10, 4], [400, 400]] as const) {
      const s = stats({ foundCount: found, readableCount: readable })
      const section = weatherSectionState(s)
      const card = speciesWeatherState(s, 50)
      if (section === 'absent') expect(card).toBe('absent')
      else if (section === 'below-floor') expect(card).toBe('export-below-floor')
      else expect(card).toBe('full')
    }
  })

  it('is the only place the card\'s state is decided', () => {
    // A repo grep for a second decision. The card reads the discriminator and
    // branches on its result; it must not re-derive any of the three conditions
    // for itself, or "the card does not render and nothing else points at it"
    // can half-happen the day Species Detail gains a section index.
    const card = readFileSync(
      fileURLToPath(new URL('../components/SpeciesWeatherCard.tsx', import.meta.url)), 'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '')
    expect(card).toContain('speciesWeatherState(')
    expect(card).not.toContain('foundCount === 0')
    expect(card).not.toContain('WEATHER_SECTION_MIN_READABLE')
    expect(card).not.toContain('WEATHER_SPECIES_MIN_CHECKLISTS')
  })
})

describe('the published table lookup answers zero, never an error (FR-03)', () => {
  const s = stats({
    foundCount: 400, readableCount: 400,
    species: { names: ['Anna\'s Hummingbird', 'Wood Duck'], checklists: [12, 3], byCondition: [], byTempBand: [] },
  })

  it('finds a name that is there', () => {
    expect(speciesWeatherIndex(s, 'Anna\'s Hummingbird')).toBe(0)
    expect(speciesWeatherIndex(s, 'Wood Duck')).toBe(1)
  })

  it('returns -1 for a name that is not, including hostile ones', () => {
    // An absent name means a bird on no readable-block checklist, which is the
    // ordinary outcome for 114 of the 283 species on the reference export. It is
    // never an error and never a reason to hide the card.
    for (const missing of ['Steller\'s Jay', '', '__proto__', 'constructor', 'toString']) {
      expect(speciesWeatherIndex(s, missing), missing).toBe(-1)
    }
  })

  it('is written as a loop rather than `indexOf`, so the module\'s linearity guard stays whole', () => {
    // The rule this module's own guard enforces is a file-scoped ABSENCE check.
    // The honest move on a call the rule does not actually forbid is to write
    // the loop, not to narrow the guard: v1.0.21 widened that rule precisely
    // because it had been written narrowly enough to let a quadratic
    // `Array.includes` through.
    const src = code('./weatherStats.ts')
    expect(src).not.toContain('.indexOf(')
    expect(src).toContain('export function speciesWeatherIndex')
  })
})
