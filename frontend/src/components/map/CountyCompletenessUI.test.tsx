// @vitest-environment jsdom
//
// County Completeness UI — the popup content (design.html Variants A + B and
// the three degraded states, FR-20/21/22/24/25/29/30/31/33) and the fixed
// 0–100% band legend (FR-27). Presentational components, real <BirdName>.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CountyCompletenessPopup } from './CountyCompletenessPopup'
import { CountyCompletenessLegend } from './MapSidebarUI'
import { monthDay, type CountyCompletenessResult } from '../../lib/countyCompleteness'

afterEach(cleanup)

function result(over: Partial<CountyCompletenessResult>): CountyCompletenessResult {
  return {
    x: 0,
    band: 0,
    status: 'unfetched',
    fromCache: false,
    regionResolvable: true,
    recentNew: [],
    ...over,
  }
}

describe('monthDay', () => {
  it('formats an ISO date as "Mon D" and passes junk through', () => {
    expect(monthDay('2026-06-14')).toBe('Jun 14')
    expect(monthDay('2026-04-05')).toBe('Apr 5')
    expect(monthDay('junk')).toBe('junk')
  })
})

describe('CountyCompletenessPopup — birded county (Variant A)', () => {
  const ready = result({
    x: 128, y: 312, percent: 41, band: 5, ratio: 128 / 312, status: 'ready', fetchedAt: 1,
    recentNew: [
      { commonName: "Lawrence's Goldfinch", scientificName: 'Spinus lawrencei', firstDate: '2026-06-14' },
      { commonName: 'Yellow-breasted Chat', scientificName: 'Icteria virens', firstDate: '2026-05-31' },
    ],
    targets: [
      { speciesCode: 'tunswa', commonName: 'Tundra Swan' },
      { speciesCode: 'rengre', commonName: 'Red-necked Grebe' },
    ],
  })

  it('shows the progress bar with an accessible value plus the equivalent text (FR-20, NFR-04)', () => {
    render(<CountyCompletenessPopup countyName="Santa Clara" result={ready} onLoad={() => {}} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('41')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
    expect(screen.getByText('128')).toBeTruthy()
    expect(screen.getByText('312')).toBeTruthy()
    expect(screen.getByText('41%')).toBeTruthy()
    // FR-20 / D-402: the countable X is labeled so it can't be confused with
    // the raw Species-metric count.
    expect(screen.getByText(/spuhs, slashes & hybrids don't count/)).toBeTruthy()
  })

  it('lists recent new-in-county species with their first-record dates (FR-21)', () => {
    render(<CountyCompletenessPopup countyName="Santa Clara" result={ready} onLoad={() => {}} />)
    expect(screen.getByText("Lawrence's Goldfinch")).toBeTruthy()
    expect(screen.getByText('Jun 14')).toBeTruthy()
    expect(screen.getByText(/works offline/)).toBeTruthy()
  })

  it('gates target links on the backbone: in-backbone links, out-of-backbone renders plain (FR-23)', () => {
    const hasEntryFor = (name: string) => name === 'Tundra Swan'
    const onOpenSpecies = vi.fn()
    render(
      <CountyCompletenessPopup countyName="Santa Clara" result={ready} onLoad={() => {}} hasEntryFor={hasEntryFor} onOpenSpecies={onOpenSpecies} />,
    )
    const swan = screen.getByText('Tundra Swan')
    fireEvent.click(swan)
    expect(onOpenSpecies).toHaveBeenCalledWith('Tundra Swan')
    const grebe = screen.getByText('Red-necked Grebe')
    fireEvent.click(grebe)
    expect(onOpenSpecies).toHaveBeenCalledTimes(1) // plain text — no navigation
  })

  it('shows the cache line', () => {
    render(<CountyCompletenessPopup countyName="Santa Clara" result={ready} onLoad={() => {}} />)
    expect(screen.getByText(/cached for 30 days/)).toBeTruthy()
  })
})

describe('CountyCompletenessPopup — hostile content stays inert (QA-35, NFR-09)', () => {
  it('a hostile species name in recent + target lists renders as literal text — no element injection', () => {
    const hostileMarkup = '<img src=x onerror=alert(1)>'
    const hostileEntity = 'Rock & "Pigeon" <b>bold</b> &amp;'
    const r = result({
      x: 2, y: 10, percent: 20, band: 2, status: 'ready', fetchedAt: 1,
      recentNew: [
        { commonName: hostileMarkup, scientificName: 'Hostilis hostilis', firstDate: '2026-06-01' },
      ],
      targets: [{ speciesCode: 'hstl1', commonName: hostileEntity }],
    })
    const { container } = render(
      <CountyCompletenessPopup countyName="Santa Clara" result={r} onLoad={() => {}} />,
    )
    // The payloads appear as LITERAL text (React auto-escape), byte-for-byte —
    // the entity case must not double-decode either.
    expect(screen.getByText(hostileMarkup)).toBeTruthy()
    expect(screen.getByText(hostileEntity)).toBeTruthy()
    // …and never as parsed markup: no injected element, handler, or <b>
    // anywhere in the rendered popup.
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(container.querySelector('[onerror]')).toBeNull()
    expect(container.querySelector('.sr-birdname-text b, .sr-birdname-link b')).toBeNull()
  })
})

describe('CountyCompletenessPopup — never-birded county (Variant B)', () => {
  it('idle: explains the plain outline and offers the single-county Load button (FR-14)', () => {
    const onLoad = vi.fn()
    render(<CountyCompletenessPopup countyName="San Benito" result={result({ status: 'unfetched' })} onLoad={onLoad} />)
    expect(screen.getByText(/You haven’t birded San Benito yet/)).toBeTruthy()
    const btn = screen.getByRole('button', { name: /Load completeness/ })
    fireEvent.click(btn)
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/One eBird request, for this county only/)).toBeTruthy()
  })

  it('pending: a visible bounded status while the fetch runs (FR-33)', () => {
    render(<CountyCompletenessPopup countyName="San Benito" result={result({ status: 'loading' })} onLoad={() => {}} />)
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Checking eBird for San Benito')
  })

  it('loaded 0%: shows "0 of Y species" and the plain-outline caption; stays band 0 (FR-14)', () => {
    const loaded = result({
      x: 0, y: 287, percent: 0, band: 0, status: 'ready', fetchedAt: 1,
      targets: [{ speciesCode: 'gwfgoo', commonName: 'Greater White-fronted Goose' }],
    })
    render(<CountyCompletenessPopup countyName="San Benito" result={loaded} onLoad={() => {}} />)
    expect(screen.getByText('0%')).toBeTruthy()
    expect(screen.getByText('287')).toBeTruthy()
    expect(screen.getByText(/stays a plain outline on the map/)).toBeTruthy()
    expect(screen.getByText('Greater White-fronted Goose')).toBeTruthy()
  })
})

describe('CountyCompletenessPopup — degraded states (FR-24/25/29/30/31, NFR-08)', () => {
  const local = {
    x: 42,
    recentNew: [{ commonName: 'Canada Goose', scientificName: 'Branta canadensis', firstDate: '2026-05-01' }],
  }

  it('offline: honest message, local X and recent list still render, no blank section (FR-24/FR-30)', () => {
    render(
      <CountyCompletenessPopup
        countyName="Santa Clara"
        result={result({ ...local, status: 'offline', message: "You're offline — this needs a connection." })}
        onLoad={() => {}}
      />,
    )
    expect(screen.getByText(/You're offline/)).toBeTruthy()
    expect(screen.getByText(/recorded 42 countable species here/)).toBeTruthy()
    expect(screen.getByText('Canada Goose')).toBeTruthy()
  })

  it('no-key: the standard no-key copy, distinct from offline (FR-29)', () => {
    render(
      <CountyCompletenessPopup
        countyName="Santa Clara"
        result={result({ ...local, status: 'no-key', message: 'eBird API key not configured. Add it in Settings.' })}
        onLoad={() => {}}
      />,
    )
    expect(screen.getByText(/API key not configured/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Try again/ })).toBeNull()
  })

  it('server error: an alert with a retry that calls back into the fetch (FR-31)', () => {
    const onLoad = vi.fn()
    render(
      <CountyCompletenessPopup
        countyName="Santa Clara"
        result={result({ ...local, status: 'error', message: 'eBird API error: 502' })}
        onLoad={onLoad}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('eBird API error: 502')
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(onLoad).toHaveBeenCalledTimes(1)
  })

  it('empty eBird list: an explanatory note and no percentage (FR-25)', () => {
    render(
      <CountyCompletenessPopup countyName="Loving" result={result({ ...local, y: 0, status: 'empty', fetchedAt: 1 })} onLoad={() => {}} />,
    )
    expect(screen.getByText(/No species have been reported to eBird/)).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('unresolvable region: honest "no eBird data" note, no button, no link (FR-18)', () => {
    render(
      <CountyCompletenessPopup countyName="Somewhere" result={result({ status: 'no-region', regionResolvable: false })} onLoad={() => {}} />,
    )
    expect(screen.getByText(/eBird data isn't available for this county/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('CountyCompletenessLegend — fixed 0–100% scale (FR-27)', () => {
  it('shows ten fixed percentage ranges, the unshaded entry, and the fixed-bands caption', () => {
    render(<CountyCompletenessLegend useTextures={false} />)
    expect(screen.getByText('Completeness — % of the county list')).toBeTruthy()
    expect(screen.getByText('1–10%')).toBeTruthy()
    expect(screen.getByText('41–50%')).toBeTruthy()
    expect(screen.getByText('91–100%')).toBeTruthy()
    expect(screen.getByText(/Not birded \/ not fetched/)).toBeTruthy()
    expect(screen.getByText(/Fixed 0–100% bands/)).toBeTruthy()
  })

  it('textures mode renders the density swatches (SVG) instead of flat color (FR-04)', () => {
    const { container } = render(<CountyCompletenessLegend useTextures />)
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(10)
  })
})
