// @vitest-environment jsdom
// The Weather section, rendered (weather-stats FR-14 … FR-31, NFR-04 … NFR-06).
//
// The stats fixtures are built by running real observation rows through
// `computeChecklists` and `computeWeatherStats`, with the BLOCKS built by
// calling the real formatters -- never by hand-writing a `WeatherStats`. A
// hand-written payload encodes the author's mental model of the derivation,
// which is the same model that would write the bug, and it would keep passing
// after the derivation changed underneath it.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import { WeatherStatsSection } from './WeatherStatsSection'
import { computeWeatherStats, WEATHER_BAND_MIN_TO_SHOW } from '../lib/weatherStats'
import type { WeatherStats } from '../lib/weatherStats'
import { computeChecklists } from '../lib/birdingStats'
import { formatWeather, ATTRIBUTION } from '../lib/weatherFormatter'
import type { HourlyResponse } from '../lib/weatherFormatter'
import type { ObservationEntry } from '../types'

// ── Fixtures ────────────────────────────────────────────────────────────────

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
const block = (temp: number, owmId = 801, night = false) =>
  formatWeather([hourly({ temp, weather: [{ id: owmId, description: 'x' }], ...(night ? { dt: 1716540000 } : {}) })], TZ, 33.7)

const UNREADABLE_BLOCK = `\u{1F985}  Nonsense  Temperature: nope  Wind: nope  ${ATTRIBUTION}`

interface Spec { comment: string; species?: string[]; duration?: number | null }

let seq = 0
function statsFor(specs: Spec[]): WeatherStats {
  const obs: ObservationEntry[] = []
  for (const spec of specs) {
    const sub = `S${900000 + seq++}`
    for (const n of spec.species ?? ["Anna's Hummingbird"]) {
      obs.push({
        submissionId: sub, commonName: n, scientificName: `Sci ${n}`,
        date: '2024-05-24', location: 'Pond', locationId: 'L1',
        latitude: 1, longitude: 2, county: 'C', count: 1, breedingCode: null,
        speciesComments: '', catalogIds: [], time: '07:00 AM',
        duration: spec.duration === undefined ? 60 : spec.duration,
        distance: 1, area: null, protocol: 'Traveling', numObservers: 1,
        allObsReported: true, checklistComments: spec.comment, stateProvince: 'US-CA',
      })
    }
  }
  return computeWeatherStats(computeChecklists(obs), obs)
}

/** N block-bearing checklists, each with its own species set, so every band can
 *  clear the averaging floor. */
function many(n: number, comment: string, duration: (i: number) => number | null = () => 60): Spec[] {
  const out: Spec[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      comment,
      species: Array.from({ length: 10 + (i % 5) }, (_, k) => `Sp ${k}`),
      duration: duration(i),
    })
  }
  return out
}

const NOOP = () => {}
const PROPS = {
  onGoToWeather: NOOP,
  codeFor: () => undefined,
  hasEntryFor: () => false,
  sciFor: (n: string) => `Sci ${n}`,
}

const draw = (stats: WeatherStats, over: Partial<typeof PROPS> = {}) =>
  render(<WeatherStatsSection stats={stats} {...PROPS} {...over} />)

// This suite follows the project's assertion convention (BirdName.test.tsx):
// plain vitest matchers, no jest-dom -- it is a dependency but is not globally
// installed. `screen.getBy*` throws when absent, which IS the presence
// assertion.
afterEach(cleanup)

// ── Coverage, first (FR-14, FR-15) ──────────────────────────────────────────

describe('the coverage line comes before every chart (FR-14, FR-15)', () => {
  it('states the readable count, the percentage and the total', () => {
    draw(statsFor([...many(10, block(60)), ...Array.from({ length: 30 }, () => ({ comment: 'no block' }))]))
    expect(screen.getByText(/These figures cover the 10 checklists that carry a weather block SnowRaven or RainCrow wrote\./)).toBeTruthy()
    expect(screen.getByText(/That is 25% of your 40 checklists\./)).toBeTruthy()
  })

  it('renders ABOVE every chart in DOM order', () => {
    const { container } = draw(statsFor(many(10, block(60))))
    const text = container.textContent ?? ''
    expect(text.indexOf('These figures cover')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('These figures cover')).toBeLessThan(text.indexOf('Your outings by weather'))
    expect(text.indexOf('These figures cover')).toBeLessThan(text.indexOf('By sky'))
  })

  it('states the unreadable count when there is one, and says nothing when there is not', () => {
    const withBad = statsFor([...many(10, block(60)), { comment: UNREADABLE_BLOCK }, { comment: UNREADABLE_BLOCK }])
    expect(withBad.unreadableCount).toBe(2)
    const a = draw(withBad)
    expect(a.container.textContent).toContain('2 more carry a block this app could not read.')
    a.unmount()

    const clean = draw(statsFor(many(10, block(60))))
    expect(clean.container.textContent).not.toContain('could not read')
  })

  it('a SINGLE unreadable block agrees its verb', () => {
    const one = statsFor([...many(10, block(60)), { comment: UNREADABLE_BLOCK }])
    expect(draw(one).container.textContent).toContain('1 more carries a block this app could not read.')
  })
})

// ── The three states (FR-16, FR-17) ─────────────────────────────────────────

describe('the three whole-section states', () => {
  it('renders NOTHING at zero found blocks', () => {
    const { container } = draw(statsFor([{ comment: 'a lovely morning' }]))
    expect(container.innerHTML).toBe('')
  })

  it('below the floor it renders the line and the route, and no chart at all', () => {
    for (const n of [1, 4]) {
      const { container, unmount } = draw(statsFor(many(n, block(60))))
      const text = container.textContent ?? ''
      expect(text).toContain(`You have ${n} checklist${n === 1 ? '' : 's'} with a readable weather block. That is not enough to chart yet.`)
      expect(text).toContain('Fill in the gaps on the Weather tab')
      // No chart, no average, no picker.
      expect(text).not.toContain('Your outings by weather')
      expect(text).not.toContain('species per checklist')
      expect(text).not.toContain('One species, its weather')
      expect(container.querySelector('.sr-wx-track')).toBeNull()
      expect(container.querySelector('input[role="combobox"]')).toBeNull()
      unmount()
    }
  })

  it('below the floor it still reports blocks it could not read', () => {
    const stats = statsFor([...many(2, block(60)), { comment: UNREADABLE_BLOCK }])
    expect(draw(stats).container.textContent).toContain('1 more carries a block this app could not read.')
  })

  it('at the floor it renders the full section', () => {
    const { container } = draw(statsFor(many(5, block(60))))
    const text = container.textContent ?? ''
    expect(text).toContain('Your outings by weather')
    expect(text).toContain('Species and time out, by weather')
    expect(text).toContain('One species, its weather')
  })
})

// ── The distributions (FR-21, FR-23) ────────────────────────────────────────

describe('the distributions', () => {
  it('renders all eleven sky rows, all seven temperature bands and all nine wind bands', () => {
    const { container } = draw(statsFor(many(10, block(60))))
    const rows = container.querySelectorAll('.sr-wx-rows')
    // Four groups: sky, temperature, wind, day/night.
    expect(rows.length).toBe(4)
    expect(rows[0].querySelectorAll('.sr-wx-row').length).toBe(11)
    expect(rows[1].querySelectorAll('.sr-wx-row').length).toBe(7)
    expect(rows[2].querySelectorAll('.sr-wx-row').length).toBe(9)
    expect(rows[3].querySelectorAll('.sr-wx-row').length).toBe(2)
  })

  it('a zero band renders a ZERO rather than being dropped, and gets a DIFFERENT shape from a small one', () => {
    // Ten blocks all in one sky and one temperature band: every other band is a
    // real, rendered zero.
    const { container } = draw(statsFor(many(10, block(60))))
    const skyRows = [...container.querySelectorAll('.sr-wx-rows')[0].querySelectorAll('.sr-wx-row')]
    const zeros = skyRows.filter(r => r.classList.contains('is-zero'))
    expect(zeros.length).toBe(10)
    // A zero row draws a dashed empty rail and NO fill; a non-zero row draws a
    // fill. That is the shape difference, and it is not colour alone.
    for (const z of zeros) {
      expect(z.querySelector('.sr-wx-track.is-empty')).toBeTruthy()
      expect(z.querySelector('.sr-wx-fill')).toBeNull()
      expect(z.textContent).toContain('0')
    }
    const filled = skyRows.filter(r => !r.classList.contains('is-zero'))
    expect(filled.length).toBe(1)
    expect(filled[0].querySelector('.sr-wx-fill')).toBeTruthy()
    expect(filled[0].querySelector('.sr-wx-track.is-empty')).toBeNull()
  })

  it('a non-zero share that rounds to nothing prints "<1%", never "0%"', () => {
    // One cold outing among 200 warm ones is 0.5%.
    const stats = statsFor([...many(200, block(60)), ...many(1, block(20))])
    const { container } = draw(stats)
    const tempRows = [...container.querySelectorAll('.sr-wx-rows')[1].querySelectorAll('.sr-wx-row')]
    const cold = tempRows.find(r => r.textContent?.includes('Below 32'))!
    expect(cold.textContent).toContain('<1%')
    expect(cold.classList.contains('is-zero')).toBe(false)
  })

  it('each axis states its OWN denominator, and they legitimately differ', () => {
    const stats = statsFor([
      ...many(10, block(60)),
      // A block with a temperature and no wind: the wind axis is one short.
      ...many(3, `⛅  Scattered clouds  Temperature: 60°F  Wind: quite blowy  ${ATTRIBUTION}`),
    ])
    const { container } = draw(stats)
    const text = container.textContent ?? ''
    expect(text).toContain('13 with a sky condition')
    expect(text).toContain('13 with a temperature')
    expect(text).toContain('10 with a wind reading')
    expect(text).toContain('13 with a time of day')
    // And the section explains why they differ, once.
    expect(text.split('so the three totals differ').length - 1).toBe(1)
  })

  it('day and night are two ordinary rows and sum to their own denominator', () => {
    const stats = statsFor([...many(8, block(60)), ...many(2, block(60, 804, true))])
    expect(stats.dayNight).toEqual({ day: 8, night: 2, denominator: 10 })
    const { container } = draw(stats)
    const dn = container.querySelectorAll('.sr-wx-rows')[3]
    expect(within(dn as HTMLElement).getByText('Day')).toBeTruthy()
    expect(within(dn as HTMLElement).getByText('Night')).toBeTruthy()
  })

  it('the residual sky row is labelled Other, and is pinned LAST in display order', () => {
    const { container } = draw(statsFor(many(10, block(60))))
    const skyRows = [...container.querySelectorAll('.sr-wx-rows')[0].querySelectorAll('.sr-wx-label')]
    const labels = skyRows.map(n => n.textContent)
    expect(labels).toEqual([
      'Clear', 'Few clouds', 'Scattered clouds', 'Broken clouds', 'Overcast',
      'Fog', 'Drizzle', 'Rain', 'Snow', 'Thunderstorm', 'Other',
    ])
    expect(labels).not.toContain('Unknown')
    expect(labels).not.toContain('Unknown weather')
  })
})

// ── Species and duration (FR-24 … FR-27) ────────────────────────────────────

describe('species and time out, by weather', () => {
  it('every species average has the SAME bands\' duration average beside it', () => {
    const { container } = draw(statsFor(many(10, block(60))))
    const band = [...container.querySelectorAll('.sr-wx-band')]
      .find(b => b.textContent?.includes('55 to 64'))!
    expect(band.textContent).toContain('species per checklist')
    expect(band.textContent).toContain('min')
    expect(band.textContent).toContain('with a time')
    // Two lanes: the species bar and the duration bar.
    expect(band.querySelectorAll('.sr-wx-lane').length).toBe(2)
    expect(band.querySelector('.sr-wx-fill.is-dur')).toBeTruthy()
  })

  it('a band below the floor shows its count and NO average, and still appears', () => {
    const { container } = draw(statsFor(many(WEATHER_BAND_MIN_TO_SHOW - 1, block(60))))
    const band = [...container.querySelectorAll('.sr-wx-band')]
      .find(b => b.textContent?.includes('55 to 64'))!
    expect(band.textContent).toContain('7 checklists')
    expect(band.textContent).toContain('Too few to average.')
    expect(band.querySelectorAll('.sr-wx-lane').length).toBe(0)
  })

  it('a THIN-DURATIONS band keeps its species lane and draws NO second rail', () => {
    // Twelve in the band, four with a recorded time: enough to average species,
    // not enough to average time. An empty rail here would be the zero-band
    // treatment, which means something else entirely.
    const { container } = draw(statsFor(many(12, block(60), i => (i < 4 ? 30 : null))))
    const band = [...container.querySelectorAll('.sr-wx-band')]
      .find(b => b.textContent?.includes('55 to 64'))!
    expect(band.textContent).toContain('12 checklists')
    expect(band.textContent).toContain('species per checklist')
    expect(band.textContent).toContain('Only 4 of these have a recorded time, too few to average.')
    expect(band.querySelectorAll('.sr-wx-lane').length).toBe(1)
    expect(band.querySelector('.sr-wx-fill.is-dur')).toBeNull()
  })

  it('a ZERO band and a THIN band do not look alike', () => {
    const { container } = draw(statsFor(many(7, block(60))))
    const thin = [...container.querySelectorAll('.sr-wx-band')].find(b => b.textContent?.includes('55 to 64'))!
    const zero = [...container.querySelectorAll('.sr-wx-band')].find(b => b.textContent?.includes('Below 32'))!
    // Different sentences, in different registers: italic for "you have, and it
    // is too few", upright for "you never have".
    expect(thin.querySelector('.sr-wx-thin')?.textContent).toBe('Too few to average.')
    expect(zero.querySelector('.sr-wx-none')?.textContent).toBe('No outings in this band.')
    expect(thin.querySelector('.sr-wx-none')).toBeNull()
    expect(zero.querySelector('.sr-wx-thin')).toBeNull()
    // And the zero band is muted as a class, not by colour written inline.
    expect(zero.classList.contains('is-zero')).toBe(true)
    expect(thin.classList.contains('is-zero')).toBe(false)
  })

  it('the effort confound is named exactly ONCE', () => {
    const { container } = draw(statsFor(many(10, block(60))))
    const text = container.textContent ?? ''
    const marker = 'Weather changes how long you stay out'
    expect(text.split(marker).length - 1).toBe(1)
  })

  it('the axis toggle switches between temperature bands and sky conditions', () => {
    const { container } = draw(statsFor(many(10, block(60, 800))))
    const group = container.querySelector('[role="group"]')!
    const [tempBtn, skyBtn] = [...group.querySelectorAll('button')]
    expect(tempBtn.getAttribute('aria-pressed')).toBe('true')
    expect(skyBtn.getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelectorAll('.sr-wx-band').length).toBe(7)

    fireEvent.click(skyBtn)
    expect(skyBtn.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelectorAll('.sr-wx-band').length).toBe(11)
    // The zero sentence follows the axis: "condition" here, "band" there.
    expect(container.textContent).toContain('No outings in this condition.')
    expect(container.textContent).not.toContain('No outings in this band.')
  })
})

// ── The per-species view (FR-28) ────────────────────────────────────────────

describe('one species, its weather', () => {
  const withSpecies = () => statsFor([
    ...many(10, block(60)).map(sp => ({ ...sp, species: [...(sp.species ?? []), 'Ruby-crowned Kinglet'] })),
    ...many(4, block(20)),
  ])

  it('uses the shipped SpeciesCombobox and defaults to NOTHING selected', () => {
    const { container } = draw(withSpecies())
    const input = container.querySelector('input[role="combobox"]')!
    expect(input.getAttribute('aria-label')).toBe('Filter by species')
    expect((input as HTMLInputElement).value).toBe('')
    expect(container.textContent).toContain('Pick a species to see the skies and temperatures you have it on.')
    // The rest state draws no per-species chart.
    expect(container.textContent).not.toContain('Each bar is the outings in that band')
  })

  it('offers only species on at least one readable-block checklist', () => {
    const stats = statsFor([
      ...many(6, block(60)).map(sp => ({ ...sp, species: ['On A Block'] })),
      { comment: 'no block', species: ['Never On A Block'] },
    ])
    expect(stats.species.names).toEqual(['On A Block'])
    const { container } = draw(stats)
    fireEvent.focus(container.querySelector('input[role="combobox"]')!)
    const options = [...container.querySelectorAll('[role="option"]')].map(o => o.textContent)
    expect(options.some(o => o?.includes('On A Block'))).toBe(true)
    expect(options.some(o => o?.includes('Never On A Block'))).toBe(false)
  })

  it('selecting a species shows its sky and temperature counts, as CHECKLISTS', () => {
    const stats = withSpecies()
    const { container } = draw(stats)
    fireEvent.focus(container.querySelector('input[role="combobox"]')!)
    const option = [...container.querySelectorAll('[role="option"]')]
      .find(o => o.textContent?.includes('Ruby-crowned Kinglet'))!
    fireEvent.click(option)

    const text = container.textContent ?? ''
    expect(text).toContain('is on 10 of your 14 weather-block checklists.')
    expect(text).toContain('Each bar is the outings in that band; the filled part is the ones Ruby-crowned Kinglet is on.')
    // Two groups side by side.
    expect(container.querySelectorAll('.sr-wx-pair > div').length).toBe(2)
  })

  it('distinguishes "0 of 27" from "no outings", which are different facts', () => {
    const stats = withSpecies()
    const { container } = draw(stats)
    fireEvent.focus(container.querySelector('input[role="combobox"]')!)
    fireEvent.click([...container.querySelectorAll('[role="option"]')]
      .find(o => o.textContent?.includes('Ruby-crowned Kinglet'))!)

    const pair = container.querySelector('.sr-wx-pair')!
    const rows = [...pair.querySelectorAll('.sr-wx-row')]
    // The band the bird IS in.
    const found = rows.find(r => r.textContent?.includes('55 to 64'))!
    expect(found.textContent).toContain('10 of 10')
    // A band with outings the bird was never on: a real, interesting zero.
    const missed = rows.find(r => r.textContent?.includes('Below 32'))!
    expect(missed.textContent).toContain('0 of 4')
    expect(missed.querySelector('.sr-wx-track.is-empty')).toBeNull()
    // A band with no outings at all: no numeral anywhere on the row's count.
    const never = rows.find(r => r.textContent?.includes('85°F and up'))!
    expect(never.querySelector('.sr-wx-count')!.textContent).toBe('no outings')
    expect(never.querySelector('.sr-wx-track.is-empty')).toBeTruthy()
  })

  it('never prints a rate', () => {
    const { container } = draw(withSpecies())
    fireEvent.focus(container.querySelector('input[role="combobox"]')!)
    fireEvent.click([...container.querySelectorAll('[role="option"]')]
      .find(o => o.textContent?.includes('Ruby-crowned Kinglet'))!)
    const pair = container.querySelector('.sr-wx-pair')!
    // The fraction exists only as bar geometry. No percent sign in any count.
    for (const c of pair.querySelectorAll('.sr-wx-count')) {
      expect(c.textContent).not.toContain('%')
    }
  })

  it('sits inside .sr-wx-pickctl and NOT in the 220px-capped register', () => {
    // The two halves of the readability fix, asserted where they are rendered.
    // `size="sm"` caps the combobox at 220px with an INLINE style, and the
    // listbox is positioned `left: 0; right: 0` on that wrapper -- so the cap is
    // the listbox's width, and inside 220px the common name and the scientific
    // name are cut at once. The geometry is a browser measurement (see the
    // commit); what a render can prove is that neither half was quietly undone.
    const { container } = draw(withSpecies())
    const ctl = container.querySelector('.sr-wx-pickctl')
    expect(ctl).toBeTruthy()
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement
    expect(ctl!.contains(input)).toBe(true)
    // The combobox root is the element carrying the register's inline maxWidth.
    const root = input.closest('.sr-wx-pickctl')!.firstElementChild as HTMLElement
    expect(root.style.maxWidth, 'the sm register would pin this at 220px').toBe('')
    // The PROPERTY, not the spelling. `panel` and `md` are both uncapped and
    // either is a correct fix here; pinning `panel`'s own 34px box would turn
    // this red on an equivalent implementation, which is a guard testing its
    // author's memory rather than the defect. What must hold is only that this
    // is not the 30px `sm` register, whose 220px cap is the defect.
    expect(input.style.height).not.toBe('30px')
    expect(['34px', '40px']).toContain(input.style.height)
  })

  it('renders the selected name through BirdName, never as raw text in the picker rows', () => {
    const { container } = draw(withSpecies())
    fireEvent.focus(container.querySelector('input[role="combobox"]')!)
    fireEvent.click([...container.querySelectorAll('[role="option"]')]
      .find(o => o.textContent?.includes('Ruby-crowned Kinglet'))!)
    expect(container.querySelector('.sr-wx-lede .sr-birdname')).toBeTruthy()
  })
})

// ── The route out (interaction) ─────────────────────────────────────────────

describe('the route to the Weather tab', () => {
  it('is a BUTTON, calls onGoToWeather, and carries no figure', () => {
    const onGoToWeather = vi.fn()
    const { container } = draw(statsFor(many(10, block(60))), { onGoToWeather })
    const btn = container.querySelector('.sr-wx-route') as HTMLButtonElement
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.textContent).toBe('Fill in the gaps on the Weather tab')
    // No number: the Weather tab's own backlog counts blocks with a looser test,
    // so a figure here would sit on screen disagreeing with the one over there.
    expect(btn.textContent).not.toMatch(/\d/)
    fireEvent.click(btn)
    expect(onGoToWeather).toHaveBeenCalledTimes(1)
  })

  it('renders in the FULL state as well as below the floor', () => {
    expect(draw(statsFor(many(10, block(60)))).container.querySelector('.sr-wx-route')).toBeTruthy()
    expect(draw(statsFor(many(2, block(60)))).container.querySelector('.sr-wx-route')).toBeTruthy()
  })
})

// ── Accessibility and conventions (NFR-04 … NFR-06) ─────────────────────────

describe('accessibility and conventions', () => {
  it('every button carries a literal tabIndex of 0, and no anchor is rendered', () => {
    // WebKit's default tab mode -- what the shipped Mac, iPhone and iPad apps run
    // -- visits only explicitly-tabindexed elements, so an unmarked button is
    // unreachable by Tab there.
    const { container } = draw(statsFor(many(10, block(60))))
    const buttons = [...container.querySelectorAll('button')]
    expect(buttons.length).toBeGreaterThan(3)
    for (const b of buttons) {
      // The combobox's own toggle keeps its shipped tabIndex of -1: the input
      // beside it is the tab stop and its focus opens the same list.
      if (b.getAttribute('aria-label') === 'Toggle species list') {
        expect(b.getAttribute('tabindex')).toBe('-1')
        continue
      }
      expect(b.getAttribute('tabindex'), b.textContent ?? '').toBe('0')
    }
    // The route is an in-app tab move, so the section renders no anchors at all.
    expect(container.querySelectorAll('a[href]').length).toBe(0)
  })

  it('every rail is aria-hidden, because its value is already text on the row', () => {
    const { container } = draw(statsFor(many(10, block(60))))
    const tracks = [...container.querySelectorAll('.sr-wx-track')]
    expect(tracks.length).toBeGreaterThan(20)
    for (const t of tracks) {
      const hidden = t.closest('[aria-hidden="true"]')
      expect(hidden, t.className).toBeTruthy()
    }
    // And deliberately NOT an image role: that would replace readable rows with
    // one long label and make the section worse for a screen reader.
    expect(container.querySelectorAll('[role="img"]').length).toBe(0)
  })

  it('creates no DOM identifier of its own, and every one it inherits is index-keyed', () => {
    const { container } = draw(statsFor(many(10, block(60))))
    fireEvent.focus(container.querySelector('input[role="combobox"]')!)
    const ids = [...container.querySelectorAll('[id]')].map(n => n.id)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      // No whitespace: an id built from a data value can carry a space, which
      // cannot resolve as an IDREF and silently switches off the announcement it
      // exists for.
      expect(id, id).not.toMatch(/\s/)
      // Nothing keyed on a species name, a band label or a condition emoji.
      expect(id).not.toContain('Anna')
      expect(id).not.toContain('64')
      expect(id).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }
    // Every ARIA IDREF the section renders actually resolves.
    for (const attr of ['aria-controls', 'aria-activedescendant', 'aria-labelledby', 'aria-describedby']) {
      for (const el of container.querySelectorAll(`[${attr}]`)) {
        for (const ref of (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)) {
          expect(container.ownerDocument.getElementById(ref), `${attr}=${ref}`).toBeTruthy()
        }
      }
    }
  })

  it('hardcodes no hex or RGB colour', () => {
    const { container } = draw(statsFor(many(10, block(60))))
    const html = container.innerHTML
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(html).not.toMatch(/rgba?\(/)
    // Every inline colour is a token or a CSS keyword. The keywords are not a
    // loophole: `transparent` and `currentColor` name no colour of their own, so
    // neither can drift from the palette or fail in one theme. They arrive from
    // the shipped SpeciesCombobox, not from this section.
    const KEYWORDS = new Set(['transparent', 'none', 'inherit', 'currentColor', 'currentcolor'])
    for (const m of html.matchAll(/(?:color|background)\s*:\s*([^;"]+)/g)) {
      const value = m[1].trim()
      if (KEYWORDS.has(value)) continue
      expect(value, m[0]).toMatch(/^var\(--sr-/)
    }
  })

  it('renders no em dash in any state', () => {
    for (const stats of [statsFor(many(10, block(60))), statsFor(many(2, block(60)))]) {
      const { container, unmount } = draw(stats)
      expect(container.textContent).not.toContain('—')
      unmount()
    }
  })

  it('renders no predictive, recommending or ranked copy', () => {
    const { container } = draw(statsFor(many(10, block(60))))
    const text = (container.textContent ?? '').toLowerCase()
    for (const phrase of ['best conditions', 'you should', 'expect to find', 'correlation', 'most associated']) {
      expect(text, phrase).not.toContain(phrase)
    }
  })
})
