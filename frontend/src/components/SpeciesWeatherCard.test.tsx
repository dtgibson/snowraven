// @vitest-environment jsdom
/// <reference types="node" />
// The Species Detail Weather card: its four states, its opening block, its rows,
// and the controls it deliberately does not render (species-detail-weather).
//
// WHAT THIS FILE CANNOT SEE, said plainly. It runs in jsdom, which has no layout
// engine, so every claim about rendered GEOMETRY -- the label never painting over
// its count, the rail keeping a usable width, the shape the row takes at a given
// column -- is measured elsewhere, in Chromium and WebKit against a real build,
// by `website/tools/verify/verify-weather-species-rows.mjs`. Two consecutive
// releases in this repo have had a real browser find what the unit suite
// structurally could not.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { render, cleanup, within } from '@testing-library/react'
import { SpeciesWeatherCard } from './SpeciesWeatherCard'
import { computeWeatherStats, WEATHER_SPECIES_MIN_CHECKLISTS } from '../lib/weatherStats'
import type { WeatherStats } from '../lib/weatherStats'
import { computeChecklists } from '../lib/birdingStats'
import { formatWeather } from '../lib/weatherFormatter'
import type { HourlyResponse } from '../lib/weatherFormatter'
import {
  WEATHER_COPY, belowFloorLine, speciesFloorNote, speciesLedeParts, speciesOwnWhole,
  speciesOwnWholeZero, speciesZeroLedeParts,
} from '../lib/weatherStatsCopy'
import { CONDITION_LABEL, CONDITION_DISPLAY_ORDER } from '../lib/weatherDisplay'
import type { ObservationEntry } from '../types'

// ── Fixtures, built through the real formatter and the real aggregation ─────

const TZ = 'America/Los_Angeles'
function hourly(over: Partial<HourlyResponse['data'][number]> = {}): HourlyResponse {
  return {
    data: [{
      dt: 1716570000, temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
      clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
      sunrise: 1716550000, sunset: 1716600000, ...over,
    }],
  }
}
const srBlock = (temp: number, owmId = 801) =>
  formatWeather([hourly({ temp, weather: [{ id: owmId, description: 'x' }] })], TZ, 33.7)

let seq = 0
const BASE: Omit<ObservationEntry, 'submissionId' | 'commonName' | 'scientificName'> = {
  date: '2024-05-24', location: 'Pond', locationId: 'L1', latitude: 1, longitude: 2,
  county: 'C', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
  time: '07:00 AM', duration: 60, distance: 1, area: null, protocol: 'Traveling',
  numObservers: 1, allObsReported: true, checklistComments: '', stateProvince: 'US-CA',
}
interface Spec { comment: string; species: string[] }
function build(specs: Spec[]): ObservationEntry[] {
  const obs: ObservationEntry[] = []
  for (const spec of specs) {
    const sub = `S${200000 + seq++}`
    for (const n of spec.species) {
      obs.push({ ...BASE, submissionId: sub, commonName: n, scientificName: 'Genus species', checklistComments: spec.comment })
    }
  }
  return obs
}
const repeat = (n: number, comment: string, species: string[]): Spec[] =>
  Array.from({ length: n }, () => ({ comment, species }))

function statsFor(specs: Spec[]): { stats: WeatherStats; obs: ObservationEntry[] } {
  const obs = build(specs)
  return { stats: computeWeatherStats(computeChecklists(obs), obs), obs }
}

/** The bird's own whole, as the seam computes it: distinct submissions on the
 *  raw parse, normalized on both sides. Rebuilt here from the same fixture so
 *  the card's two figures are driven, never hand-fed. */
function ownChecklists(obs: ObservationEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  const seen = new Set<string>()
  for (const o of obs) {
    const name = o.commonName.replace(/\s*\([^)]*\)\s*$/, '')
    const key = `${name}|${o.submissionId}`
    if (seen.has(key)) continue
    seen.add(key)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return counts
}

const BIRD = 'Anna\'s Hummingbird'

/** The FULL state: the bird is on 12 readable-block checklists, and on 40
 *  checklists altogether. Two sky conditions and two temperature bands, so no
 *  group is degenerate; the remaining bands are the two zeros the chart most
 *  needs to keep apart. */
function fullFixture() {
  const { stats, obs } = statsFor([
    ...repeat(8, srBlock(60), [BIRD, 'Steller\'s Jay']),
    ...repeat(4, srBlock(30, 601), [BIRD]),
    ...repeat(6, srBlock(60), ['Steller\'s Jay']),
    // A sky and a temperature the user HAS birded and the bird was never in --
    // the `0 · 0%` row, which is a fact about the bird and keeps its reference
    // figure, against the `no outings` rows, which are facts about the birder.
    ...repeat(5, srBlock(80, 500), ['Steller\'s Jay']),
    ...repeat(28, '', [BIRD]),
  ])
  return { stats, own: ownChecklists(obs) }
}

function renderCard(over: Partial<Parameters<typeof SpeciesWeatherCard>[0]> = {}) {
  const base = fullFixture()
  return render(
    <SpeciesWeatherCard
      stats={base.stats}
      ownChecklists={base.own}
      selectedSpecies={BIRD}
      sciName="Calypte anna"
      filtersActive={false}
      onGoToWeather={() => {}}
      {...over}
    />,
  )
}

const text = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()

function source(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
}
function code(rel: string): string {
  return source(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
}

// ── The four states (FR-04 … FR-08) ─────────────────────────────────────────

describe('the four states', () => {
  it('absent: renders nothing at all, not even a head (FR-05, QA-04)', () => {
    const { stats, obs } = statsFor(repeat(20, '', [BIRD]))
    expect(stats.foundCount).toBe(0)
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies={BIRD}
        filtersActive={false} onGoToWeather={() => {}} />,
    )
    expect(container.innerHTML).toBe('')
    cleanup()
  })

  it('export below floor: the shipped words, the shipped route, and nothing about the bird (FR-06, QA-05)', () => {
    for (const readable of [1, 4]) {
      const { stats, obs } = statsFor([
        ...repeat(readable, srBlock(60), [BIRD]),
        ...repeat(30, '', [BIRD]),
      ])
      const { container } = render(
        <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies={BIRD}
          filtersActive={false} onGoToWeather={() => {}} />,
      )
      const body = text(container)
      // Byte for byte the shipped strings, because it is the same state about
      // the same export as the Statistics section's.
      expect(body).toContain(belowFloorLine(readable))
      expect(body).toContain(WEATHER_COPY.belowFloorBody)
      expect(body).toContain(WEATHER_COPY.route)
      // And nothing about this bird: no name, no count sentence, no bars.
      expect(body).not.toContain(BIRD)
      // `belowFloorLine` itself opens its second sentence with "That is", so the
      // discriminator is the own-whole's own words, not that phrase.
      expect(body).not.toContain('you have it on')
      expect(body).not.toContain('of its')
      expect(container.querySelectorAll('.sr-wx-row--sp').length).toBe(0)
      cleanup()
    }
  })

  it('export below floor is read BEFORE the bird\'s floor, and the order is load-bearing (FR-04, QA-03)', () => {
    // A user with four readable blocks is told about their EXPORT rather than
    // about this bird, which is the statement that is actually true and
    // actionable. Reversing the two tests renders a floor note about one species
    // over an export that cannot chart anything.
    const { stats, obs } = statsFor([
      ...repeat(4, srBlock(60), [BIRD]),
      ...repeat(30, '', [BIRD]),
    ])
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies={BIRD}
        filtersActive={false} onGoToWeather={() => {}} />,
    )
    expect(text(container)).toContain(WEATHER_COPY.route)
    expect(text(container)).not.toContain(speciesFloorNote())
    cleanup()
  })

  it('bird below floor: the full opening block, the floor note, no bars and NO route (FR-07, QA-06)', () => {
    const { stats, obs } = statsFor([
      ...repeat(9, srBlock(60), [BIRD]),
      ...repeat(20, srBlock(60), ['Steller\'s Jay']),
      ...repeat(15, '', [BIRD]),
    ])
    const own = ownChecklists(obs)
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={own} selectedSpecies={BIRD}
        filtersActive={false} onGoToWeather={() => {}} />,
    )
    const body = text(container)
    expect(body).toContain(speciesLedeParts(9, stats.readableCount).lead)
    expect(body).toContain(speciesOwnWhole(9, own.get(BIRD)!))
    expect(body).toContain(speciesLedeParts(9, stats.readableCount).note)
    expect(body).toContain(speciesFloorNote())
    // Zero bars, zero reference figures, zero controls of any kind.
    expect(container.querySelectorAll('.sr-wx-row--sp').length).toBe(0)
    expect(container.querySelectorAll('.sr-wx-ref').length).toBe(0)
    expect(container.querySelectorAll('button, a[href]').length).toBe(0)
    expect(body).not.toContain(WEATHER_COPY.route)
    cleanup()
  })

  it('the boundary is exact: nine draws nothing, ten draws the chart (FR-09, QA-07)', () => {
    for (const [on, rows] of [[WEATHER_SPECIES_MIN_CHECKLISTS - 1, 0], [WEATHER_SPECIES_MIN_CHECKLISTS, 18]] as const) {
      const { stats, obs } = statsFor([
        ...repeat(on, srBlock(60), [BIRD]),
        ...repeat(20, srBlock(60), ['Steller\'s Jay']),
      ])
      const { container } = render(
        <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies={BIRD}
          filtersActive={false} onGoToWeather={() => {}} />,
      )
      expect(container.querySelectorAll('.sr-wx-row--sp').length, `on=${on}`).toBe(rows)
      cleanup()
    }
  })

  it('the floor reads the bird\'s own checklist count, never a per-axis sum (FR-10, QA-08)', () => {
    // A readable block can carry a wind and no sky and no temperature, so an
    // axis sum understates by exactly the checklists it skipped and would refuse
    // a bird the chart it had earned. Ten readable blocks of which only six
    // carry a sky condition must still draw.
    const noTemp = '⛅  Scattered clouds  Wind: Light breeze  '
      + 'Weather generated by <a href="https://raincrow.app/">RainCrow</a>'
    const { stats, obs } = statsFor([
      ...repeat(6, srBlock(60), [BIRD]),
      ...repeat(4, noTemp, [BIRD]),
      ...repeat(20, srBlock(60), ['Steller\'s Jay']),
    ])
    const i = stats.species.names.indexOf(BIRD)
    expect(stats.species.checklists[i]).toBe(10)
    expect(stats.species.byTempBand[i].reduce((a, b) => a + b, 0)).toBe(6)
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies={BIRD}
        filtersActive={false} onGoToWeather={() => {}} />,
    )
    expect(container.querySelectorAll('.sr-wx-row--sp').length).toBe(18)
    cleanup()
  })
})

// ── The opening block: one numerator, two wholes (FR-30 … FR-33) ────────────

describe('the opening block states one numerator against two wholes', () => {
  it('prints both sentences in order, with the SAME numeral, and no rate (FR-30, QA-34)', () => {
    const { container } = renderCard()
    const lede = container.querySelector('p')!
    const body = text(lede)
    const { stats, own } = fullFixture()
    const on = stats.species.checklists[stats.species.names.indexOf(BIRD)]
    expect(on).toBe(12)
    expect(own.get(BIRD)).toBe(40)
    expect(body).toContain(speciesLedeParts(on, stats.readableCount).lead)
    expect(body).toContain(speciesOwnWhole(on, own.get(BIRD)!))
    // Asserted by EQUALITY, not by fixture coincidence: the numeral in the
    // second sentence is the numeral in the first.
    const first = /is on (\d[\d,]*) of your/.exec(body)![1]
    const second = /That is (\d[\d,]*) of the/.exec(body)![1]
    expect(second).toBe(first)
    // "That is" is load-bearing: without it the same figure printed twice reads
    // as two different counts.
    expect(body).toContain('That is')
    // NOTHING divides them. No percentage anywhere in the opening block, and no
    // division of one figure by the other anywhere in the component.
    expect(body).not.toContain('%')
    const src = code('./SpeciesWeatherCard.tsx')
    expect(src).not.toMatch(/ownTotal\s*[)]?\s*[*/]/)
    expect(src).not.toMatch(/onCount\s*\/\s*ownTotal/)
    cleanup()
  })

  it('the zero case takes its own wording in BOTH sentences (FR-33, QA-37)', () => {
    for (const total of [26, 1]) {
      const { stats, obs } = statsFor([
        ...repeat(20, srBlock(60), ['Steller\'s Jay']),
        ...repeat(total, '', [BIRD]),
      ])
      const own = ownChecklists(obs)
      expect(own.get(BIRD)).toBe(total)
      const { container } = render(
        <SpeciesWeatherCard stats={stats} ownChecklists={own} selectedSpecies={BIRD}
          filtersActive={false} onGoToWeather={() => {}} />,
      )
      const body = text(container)
      expect(body).toContain(speciesZeroLedeParts(stats.readableCount).lead)
      expect(body).toContain(speciesOwnWholeZero(total))
      // Neither of the two bare-zero forms the shipped helpers would produce.
      expect(body).not.toContain('is on 0 of your')
      expect(body).not.toContain('That is 0 of the')
      cleanup()
    }
  })

  it('stepping between an above-floor and a below-floor bird leaves the paragraph in place (QA-06)', () => {
    // The design rule for the state four birds in five see: the opening block is
    // identical in STRUCTURE, POSITION and WEIGHT, and only the chart is absent.
    // A reader stepping through their list must not see the first paragraph move
    // or change register between one bird and the next.
    const { stats, obs } = statsFor([
      ...repeat(12, srBlock(60), [BIRD]),
      ...repeat(9, srBlock(60), ['Steller\'s Jay']),
      ...repeat(20, '', [BIRD, 'Steller\'s Jay']),
    ])
    const own = ownChecklists(obs)
    const shape = (name: string) => {
      const { container } = render(
        <SpeciesWeatherCard stats={stats} ownChecklists={own} selectedSpecies={name}
          filtersActive={false} onGoToWeather={() => {}} />,
      )
      const card = container.firstElementChild!
      const bodyDiv = card.children[1]
      const first = bodyDiv.firstElementChild as HTMLElement
      const out = {
        tag: first.tagName,
        index: [...bodyDiv.children].indexOf(first),
        sentences: text(first).split('. ').length,
        opensWithName: text(first).startsWith(name),
        hasThatIs: text(first).includes('That is'),
      }
      cleanup()
      return out
    }
    const above = shape(BIRD)
    const below = shape('Steller\'s Jay')
    expect(below.tag).toBe(above.tag)
    expect(below.index).toBe(above.index)
    expect(below.sentences).toBe(above.sentences)
    expect(below.opensWithName).toBe(true)
    expect(above.opensWithName).toBe(true)
    expect(below.hasThatIs).toBe(true)
    expect(above.hasThatIs).toBe(true)
  })
})

// ── The basis clauses (FR-13, QA-10) ────────────────────────────────────────

describe('the card states its basis, and only the clauses that apply', () => {
  it('with no filter and no form, the muted run is exactly the shipped one sentence', () => {
    const { container } = renderCard()
    const body = text(container.querySelector('p')!)
    expect(body).toContain('Counts are checklists, not sightings.')
    expect(body).not.toContain('do not narrow them')
    expect(body).not.toContain('parent species')
    cleanup()
  })

  it('adds the filter clause only while a county or date filter is active', () => {
    const { container } = renderCard({ filtersActive: true })
    const body = text(container.querySelector('p')!)
    expect(body).toContain('so this tab\'s filters do not narrow them')
    // Order: lede-note, then filter, then form.
    expect(body.indexOf('Counts are checklists')).toBeLessThan(body.indexOf('do not narrow them'))
    cleanup()
  })

  it('adds the form clause only when the normalized name differs, and names no species (FR-02)', () => {
    const { stats, obs } = statsFor([
      ...repeat(12, srBlock(60), ['Mallard']),
      ...repeat(20, '', ['Mallard']),
    ])
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies="Mallard (Domestic type)"
        filtersActive={false} onGoToWeather={() => {}} />,
    )
    const body = text(container)
    expect(body).toContain('Every form counts as its parent species.')
    // The parent's figures, reported under the parent's row.
    expect(body).toContain(speciesLedeParts(12, 12).lead)
    // The clause does not name the parent: the lede's BirdName already shows it,
    // and naming it twice is a second place for one fact.
    expect(/Every form counts as its parent species\.\s*Mallard/.test(body)).toBe(false)
    cleanup()
  })

  it('a name absent from the published table is a count of zero, never an error (FR-03, QA-02)', () => {
    const { stats, obs } = statsFor([
      ...repeat(20, srBlock(60), ['Steller\'s Jay']),
      ...repeat(3, '', ['Wood Duck']),
    ])
    expect(stats.species.names).not.toContain('Wood Duck')
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies="Wood Duck"
        filtersActive={false} onGoToWeather={() => {}} />,
    )
    expect(text(container)).toContain(speciesOwnWholeZero(3))
    cleanup()
  })
})

// ── The chart (FR-15 … FR-20) ───────────────────────────────────────────────

describe('the chart', () => {
  it('renders all eleven sky rows and all seven temperature rows (FR-15, QA-12)', () => {
    const { container } = renderCard()
    const groups = [...container.querySelectorAll('.sr-wx-pair > div')]
    expect(groups.length).toBe(2)
    expect(groups[0].querySelectorAll('.sr-wx-row--sp').length).toBe(11)
    expect(groups[1].querySelectorAll('.sr-wx-row--sp').length).toBe(7)
    cleanup()
  })

  it('keeps the two zeros apart: a band with outings against a band never birded (FR-17, QA-12)', () => {
    const { container } = renderCard()
    const rows = [...container.querySelectorAll('.sr-wx-row--sp')] as HTMLElement[]
    const noOutings = rows.filter(r => text(r).includes('no outings'))
    expect(noOutings.length).toBeGreaterThan(0)
    for (const r of noOutings) {
      // No numeral and NO reference figure: "outings 0%" would only repeat what
      // "no outings" already said, and would collapse the one distinction the
      // chart most needs.
      expect(text(r.querySelector('.sr-wx-count')!)).toBe('no outings')
      expect(text(r.querySelector('.sr-wx-ref')!)).toBe('')
      expect(r.querySelector('.sr-wx-track')!.className).toContain('is-empty')
    }
    // And the other zero: a band the user birded and the bird was not in, which
    // KEEPS its reference figure because it is a fact about the bird.
    const zeroWithOutings = rows.find(r => /^0 · 0%/.test(text(r.querySelector('.sr-wx-count')!)))
    expect(zeroWithOutings).toBeTruthy()
    expect(text(zeroWithOutings!.querySelector('.sr-wx-ref')!)).toMatch(/^outings /)
    expect(zeroWithOutings!.querySelector('.sr-wx-track')!.className).not.toContain('is-empty')
    cleanup()
  })

  it('scales each group to the BIRD\'s own largest band on THAT axis (FR-16, QA-13)', () => {
    const { container } = renderCard()
    const groups = [...container.querySelectorAll('.sr-wx-pair > div')]
    for (const g of groups) {
      const widths = [...g.querySelectorAll('.sr-wx-fill')]
        .map(f => parseFloat((f as HTMLElement).style.getPropertyValue('--w')))
      expect(widths.length).toBeGreaterThan(0)
      // The largest band in each group fills its own track exactly, which is what
      // "scaled to the bird's own largest value on that axis" means, and the two
      // groups reach 100% independently.
      expect(Math.max(...widths)).toBeCloseTo(100, 5)
    }
    cleanup()
  })

  it('prints the count, its share of the bird\'s axis total, then the muted population share', () => {
    const { container } = renderCard()
    const row = ([...container.querySelectorAll('.sr-wx-row--sp')] as HTMLElement[])
      .find(r => text(r.querySelector('.sr-wx-count')!).startsWith('8 ·'))!
    expect(text(row.querySelector('.sr-wx-count')!)).toBe('8 · 67%')
    expect(text(row.querySelector('.sr-wx-ref')!)).toMatch(/^outings \d+%$/)
    // No rendered figure is one share divided by the other.
    expect(text(row)).not.toMatch(/\d+% of \d+%/)
    cleanup()
  })

  it('states each group\'s own denominator through the shipped helper (FR-18, QA-11)', () => {
    const { container } = renderCard()
    const body = text(container)
    expect(body).toContain('of its 12 have a sky condition')
    expect(body).toContain('of its 12 have a temperature')
    cleanup()
  })

  it('names the confound exactly once, above the pair (FR-19, QA-11)', () => {
    const { container } = renderCard()
    const body = text(container)
    const matches = body.split('so it reflects when you were out as well as the bird').length - 1
    expect(matches).toBe(1)
    expect(body.indexOf('so it reflects when you were out')).toBeLessThan(body.indexOf('By sky'))
    cleanup()
  })

  it('puts the bird\'s own count sentence before every bar in DOM order (FR-08, QA-11)', () => {
    const { container } = renderCard()
    const html = container.innerHTML
    expect(html.indexOf('is on 12 of your')).toBeLessThan(html.indexOf('sr-wx-row--sp'))
    cleanup()
  })

  it('renders the sky rows in the shipped display order, addressed by index (FR-20, QA-14)', () => {
    const { container } = renderCard()
    const sky = [...container.querySelectorAll('.sr-wx-pair > div')][0]
    const labels = [...sky.querySelectorAll('.sr-wx-label')].map(l => text(l as HTMLElement))
    expect(labels).toEqual(CONDITION_DISPLAY_ORDER.map(i => CONDITION_LABEL[i]))
    cleanup()
  })

  it('replays the bar entrance only when the species changed (Motion Spec)', () => {
    // Keyed on the selection, the same mechanism and the same reason as the
    // shipped section's `key={`sp-${selected}`}`.
    expect(code('./SpeciesWeatherCard.tsx')).toContain('key={`sp-${selectedSpecies}`}')
  })
})

// ── The controls it does not render, and accessibility ──────────────────────

describe('the card renders no species control of any kind (FR-01, QA-01)', () => {
  it('has no combobox, listbox, select or picker in any state', () => {
    for (const props of [{}, { filtersActive: true }]) {
      const { container } = renderCard(props)
      expect(container.querySelectorAll('select, [role="combobox"], [role="listbox"], input').length).toBe(0)
      cleanup()
    }
  })

  it('renders no control at all in the full and bird-below-floor states', () => {
    const { container } = renderCard()
    expect(container.querySelectorAll('button, a[href]').length).toBe(0)
    cleanup()
  })

  it('the one control it can render carries a literal tabIndex (NFR-08)', () => {
    const onGoToWeather = vi.fn()
    const { stats, obs } = statsFor([
      ...repeat(2, srBlock(60), [BIRD]),
      ...repeat(20, '', [BIRD]),
    ])
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies={BIRD}
        filtersActive={false} onGoToWeather={onGoToWeather} />,
    )
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('tabindex')).toBe('0')
    btn.click()
    expect(onGoToWeather).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('creates no DOM identifier at all, so none can be keyed on user file content (NFR-09, QA-27)', () => {
    // The strongest form of the index-keyed rule: an id that does not exist
    // cannot carry whitespace from a species name or a condition glyph. Driven
    // with a hostile name and the emoji-bearing residual band on screen.
    const hostile = 'Anna\'s  Hummingbird (Weird\nform)'
    const { stats, obs } = statsFor([
      ...repeat(12, srBlock(60), [hostile]),
      ...repeat(4, '', [hostile]),
    ])
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies={hostile}
        filtersActive={false} onGoToWeather={() => {}} />,
    )
    expect(container.querySelectorAll('[id]').length).toBe(0)
    for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-activedescendant', 'aria-controls']) {
      expect(container.querySelectorAll(`[${attr}]`).length, attr).toBe(0)
    }
    cleanup()
  })

  it('every rail is aria-hidden and carries no role, following the shipped section', () => {
    const { container } = renderCard()
    for (const t of container.querySelectorAll('.sr-wx-track')) {
      expect(t.getAttribute('aria-hidden')).toBe('true')
      expect(t.getAttribute('role')).toBeNull()
    }
    expect(container.querySelectorAll('[role="img"]').length).toBe(0)
    cleanup()
  })
})

// ── Source-level conventions (NFR-08, NFR-10, NFR-11, FR-21, FR-23, FR-24) ──

describe('the component\'s own conventions', () => {
  const src = code('./SpeciesWeatherCard.tsx')

  it('uses only var(--sr-*) tokens, with no hardcoded hex or RGB (NFR-08, QA-26)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).not.toMatch(/\brgba?\(/)
    expect(src).toContain('var(--sr-text-muted)')
  })

  it('builds no count-bearing string inline; every one comes from the copy module (FR-21, QA-15)', () => {
    // A count-bearing string built here would be invisible to the generated
    // corpus sweep however correct it happens to be today.
    expect(src).not.toMatch(/\?\s*'checklist'\s*:\s*'checklists'/)
    expect(src).not.toMatch(/\$\{[^}]*\}\s*(checklist|outing|species)s?\b/)
    expect(src).toContain('from \'../lib/weatherStatsCopy\'')
  })

  it('carries no em dash in anything it renders (NFR-10, QA-28)', () => {
    // The comments are stripped, so this is about rendered strings. The card
    // renders no literal user-facing string of its own at all.
    expect(src).not.toContain('—')
  })

  it('makes no network call, writes nothing, and reads no cached answer (NFR-11, QA-29)', () => {
    for (const forbidden of ['fetch(', 'transport', 'storage.', 'setSetting', 'localStorage']) {
      expect(src, forbidden).not.toContain(forbidden)
    }
  })

  it('never reads the Statistics bundle, under any condition (NFR-06, QA-24)', () => {
    // Not even as a fast path when it happens to exist: that is the kill
    // criterion, and it fails intermittently rather than visibly.
    for (const forbidden of ['statsBundle', 'useStatsBundle', 'bundle.weather', 'statsOffThread']) {
      expect(src, forbidden).not.toContain(forbidden)
    }
  })

  it('copies neither the row nor the display vocabulary (FR-26, QA-18)', () => {
    // Extract and import. A second implementation is a pair of numbers that will
    // disagree later, on a screen where the user can reach both in two clicks.
    expect(src).toContain('from \'./WeatherSpeciesRow\'')
    expect(src).toContain('from \'../lib/weatherDisplay\'')
    expect(src).not.toContain('Thunderstorm')
    // The row's own markup is not rebuilt here: no glyph, track, fill or count
    // cell. `.sr-wx-rows` and `.sr-wx-pair` ARE this component's, because the
    // group wrapper and the pair grid are the card's own layout, not the row.
    for (const cls of ['sr-wx-glyph', 'sr-wx-track', 'sr-wx-fill', 'sr-wx-count', 'sr-wx-ref', 'sr-wx-label']) {
      expect(src, cls).not.toContain(cls)
    }
  })

  it('is one SectionCard with a SectionHead titled Weather (FR-24, QA-17)', () => {
    const { container } = renderCard()
    expect(within(container as HTMLElement).getByText('Weather')).toBeTruthy()
    expect(WEATHER_COPY.cardTitle).toBe('Weather')
    cleanup()
    expect(src).toContain('SectionCard')
    expect(src).toContain('SectionHead')
  })

  it('sits below Top Locations and adds no section index to the tab (FR-24, FR-25, QA-17)', () => {
    const tab = source('./SpeciesDetail.tsx')
    expect(tab.indexOf('title="Top Locations"')).toBeLessThan(tab.indexOf('<SpeciesWeatherCard'))
    expect(tab.indexOf('<SpeciesWeatherCard')).toBeLessThan(tab.indexOf('title="Named Individuals"'))
    // No jump nav, anchor list or section index shipped as a side effect.
    expect(code('./SpeciesWeatherCard.tsx')).not.toMatch(/href="#|scrollIntoView|jumpTo/)
  })
})

// ── The two surfaces agree (NFR-04, QA-19, QA-43) ───────────────────────────

describe('the card and the Statistics per-species view read one derivation', () => {
  it('prints the figures the shipped payload holds, for the same species and export', () => {
    const { stats, obs } = fullFixtureRaw()
    const i = stats.species.names.indexOf(BIRD)
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={ownChecklists(obs)} selectedSpecies={BIRD}
        filtersActive={false} onGoToWeather={() => {}} />,
    )
    const body = text(container)
    // The lede's numerator IS `species.checklists[i]`, which is what the
    // Statistics readout prints from the same array.
    expect(body).toContain(speciesLedeParts(stats.species.checklists[i], stats.readableCount).lead)
    // And each row's count IS `species.byCondition[i][index]`.
    const sky = [...container.querySelectorAll('.sr-wx-pair > div')][0]
    const counts = [...sky.querySelectorAll('.sr-wx-count')].map(c => text(c as HTMLElement))
    for (const [n, idx] of CONDITION_DISPLAY_ORDER.entries()) {
      const expected = stats.species.byCondition[i][idx]
      if (stats.byCondition[idx].checklists === 0) expect(counts[n]).toBe('no outings')
      else expect(counts[n]).toMatch(new RegExp(`^${expected} ·`))
    }
    cleanup()
  })

  it('the card\'s checklist figure is the DEDUPED one, and it spends no copy saying so (QA-43)', () => {
    // The Recorded Decision: on the reference export four species of 282 show a
    // lower count here than the tab's own "Checklists" stat two sections above,
    // because that stat is a row count and this is a distinct-submission count.
    // The user's decision is to leave the card as it is and explain nothing.
    const { stats, obs } = statsFor([
      { comment: srBlock(60), species: ['Mallard', 'Mallard (Domestic type)'] },
      ...repeat(11, srBlock(60), ['Mallard']),
      ...repeat(8, '', ['Mallard', 'Mallard (Domestic type)']),
    ])
    const own = ownChecklists(obs)
    // The row count is higher than the deduped count, which is the divergence.
    const rowCount = obs.filter(o => o.commonName.startsWith('Mallard')).length
    expect(own.get('Mallard')).toBe(20)
    expect(rowCount).toBe(29)
    const { container } = render(
      <SpeciesWeatherCard stats={stats} ownChecklists={own} selectedSpecies="Mallard"
        filtersActive={false} onGoToWeather={() => {}} />,
    )
    const body = text(container)
    expect(body).toContain(speciesOwnWhole(12, 20))
    expect(body).not.toContain('29')
    // No copy explaining the difference.
    expect(body).not.toMatch(/row count|sightings rather than|differs from/)
    cleanup()
  })
})

function fullFixtureRaw() {
  return statsFor([
    ...repeat(8, srBlock(60), [BIRD, 'Steller\'s Jay']),
    ...repeat(4, srBlock(30, 601), [BIRD]),
    ...repeat(6, srBlock(60), ['Steller\'s Jay']),
    // A sky and a temperature the user HAS birded and the bird was never in --
    // the `0 · 0%` row, which is a fact about the bird and keeps its reference
    // figure, against the `no outings` rows, which are facts about the birder.
    ...repeat(5, srBlock(80, 500), ['Steller\'s Jay']),
    ...repeat(28, '', [BIRD]),
  ])
}
