// @vitest-environment jsdom
//
// The shared county shading panel (county-shading-and-project-stats, FR-04,
// FR-12, FR-13, FR-16, FR-18; QA-05, QA-12, QA-14, QA-18, QA-70).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CountyShadingPanel } from './CountyShadingPanel'
import { computeCountyTiers } from '../../lib/countyShading'

const TIERS = computeCountyTiers([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89], 10)
const EMPTY = computeCountyTiers([], 10)

afterEach(cleanup)

const base = {
  open: true as boolean,
  metric: 'records' as const,
  useTextures: false,
  onToggleTextures: () => {},
  tiers: TIERS,
  hint: 'Tints each county by your own count there.',
  emptyNote: 'You have no US county records for this bird.',
}

describe('the disclosure carries `inert` while closed (NFR-05, QA-70)', () => {
  // A CSS-collapsed panel is CLIPPED, not unmounted, so its focusable
  // descendants would stay in the tab order and the accessibility tree while it
  // reads as closed. `inert` is what removes them.
  //
  // Assert the LITERAL attribute in BOTH states: React 19 emits `inert={false}`
  // correctly as absent, while pre-19 rendered the truthy string `inert="false"`
  // — which would pin the panel PERMANENTLY inert and is invisible to a
  // boolean-prop assertion.
  it('is inert when closed', () => {
    const { container } = render(<CountyShadingPanel {...base} open={false} />)
    const inner = container.querySelector('.sr-countypanel-inner')!
    expect(inner.hasAttribute('inert')).toBe(true)
    expect(container.querySelector('.sr-countypanel')!.getAttribute('data-open')).toBe('false')
  })

  it('is NOT inert when open, and the attribute is absent rather than "false"', () => {
    const { container } = render(<CountyShadingPanel {...base} open />)
    const inner = container.querySelector('.sr-countypanel-inner')!
    expect(inner.hasAttribute('inert')).toBe(false)
    expect(inner.getAttribute('inert')).toBe(null)
    expect(container.querySelector('.sr-countypanel')!.getAttribute('data-open')).toBe('true')
  })
})

describe('the metric group (FR-13, FR-16)', () => {
  it('offers EXACTLY two options, matching the Map Explorer in value and label', () => {
    render(<CountyShadingPanel {...base} metric="species" onMetricChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Choropleth metric' })
    const options = [...group.querySelectorAll('button')].map(b => b.textContent)
    expect(options).toEqual(['Species', 'Checklists'])
  })

  it('carries aria-pressed on each option and a group label', () => {
    render(<CountyShadingPanel {...base} metric="species" onMetricChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Species' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Checklists' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('NEVER offers Completeness, in either metric (FR-16, QA-18)', () => {
    for (const metric of ['species', 'records'] as const) {
      const r = render(<CountyShadingPanel {...base} metric={metric} onMetricChange={() => {}} />)
      expect(r.container.textContent).not.toMatch(/Completeness/i)
      const group = screen.getByRole('group', { name: 'Choropleth metric' })
      expect(group.querySelectorAll('button')).toHaveLength(2)
      r.unmount()
    }
  })

  it('Species Detail renders NO metric group at all (OQ-04)', () => {
    // Per species "distinct species" is always 1, so a switch would offer one
    // useful option and one meaningless one.
    render(<CountyShadingPanel {...base} />)
    expect(screen.queryByRole('group', { name: 'Choropleth metric' })).toBeNull()
  })

  it('reports the chosen metric', () => {
    const onMetricChange = vi.fn()
    render(<CountyShadingPanel {...base} metric="species" onMetricChange={onMetricChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Checklists' }))
    expect(onMetricChange).toHaveBeenCalledWith('records')
  })
})

describe('Use Textures (FR-04, QA-05)', () => {
  it('is a switch with an explicit accessible name, off by default', () => {
    render(<CountyShadingPanel {...base} />)
    const sw = screen.getByRole('switch', { name: 'Use textures on shaded counties' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
  })

  it('reports its press', () => {
    const onToggleTextures = vi.fn()
    render(<CountyShadingPanel {...base} onToggleTextures={onToggleTextures} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Use textures on shaded counties' }))
    expect(onToggleTextures).toHaveBeenCalledTimes(1)
  })

  it('swaps the legend swatches to the density spec when on', () => {
    const flat = render(<CountyShadingPanel {...base} />)
    const flatSwatches = flat.container.querySelectorAll('.sr-countylegend-sw:not(.sr-countylegend-sw--none)')
    expect(flatSwatches.length).toBeGreaterThan(0)
    // The flat branch paints from the token; nothing else is a swatch.
    expect((flatSwatches[0] as HTMLElement).style.background).toContain('--sr-county-1')
    flat.unmount()

    const hatched = render(<CountyShadingPanel {...base} useTextures />)
    // The density swatch is the shipped inline-SVG crosshatch, not a
    // token-painted span; the ramp rows now hold an <svg> each.
    const hatchedRows = hatched.container.querySelectorAll('.sr-countylegend-row')
    const svgs = [...hatchedRows].filter(r => r.querySelector('svg'))
    expect(svgs.length).toBeGreaterThan(0)
    // ...and the flat token-painted swatch is gone from those rows.
    expect(svgs[0].querySelector('.sr-countylegend-sw')).toBeNull()
  })
})

describe('the legend (FR-12, FR-18)', () => {
  it('uses the shipped metric title by default', () => {
    render(<CountyShadingPanel {...base} metric="records" onMetricChange={() => {}} />)
    expect(screen.getByText('Total checklists per county')).toBeTruthy()
  })

  it('names the species when the host supplies a title (FR-12)', () => {
    render(<CountyShadingPanel {...base} legendTitle="Your Common Raven checklists per county" />)
    expect(screen.getByText('Your Common Raven checklists per county')).toBeTruthy()
    expect(screen.queryByText('Total checklists per county')).toBeNull()
  })

  it('renders the shipped "No records (outline only)" row and the quantile note', () => {
    const { container } = render(<CountyShadingPanel {...base} />)
    expect(container.textContent).toContain('No records')
    expect(container.textContent).toContain('(outline only)')
    expect(container.textContent).toContain('Ranges are quantiles of')
    expect(container.querySelector('.sr-countylegend-sw--none')).toBeTruthy()
  })

  it('says "1 checklist", not "1 checklists", on the first row', () => {
    // The shipped legend appends the unit to the first row only, which reads
    // "1 checklists" whenever the minimum is 1 — and on both new surfaces it
    // always is. One word.
    const { container } = render(<CountyShadingPanel {...base} metric="records" />)
    expect(container.textContent).toContain('1 checklist')
    expect(container.textContent).not.toMatch(/\b1 checklists\b/)
  })

  it('keeps the plural when the first row is a RANGE rather than exactly 1', () => {
    // Guards the guard: the singular is keyed on the rendered range being "1",
    // not on "this is the first row", so a first row of 1–3 stays plural.
    const wide = computeCountyTiers([1, 2, 3, 40, 41, 42], 2)
    const { container } = render(<CountyShadingPanel {...base} metric="records" tiers={wide} />)
    expect(container.textContent).toMatch(/checklists/)
  })

  it('renders the honest empty note instead of an empty ramp', () => {
    const { container } = render(
      <CountyShadingPanel {...base} tiers={EMPTY} emptyNote="You have no US county records for Common Raven in the loaded backup." />,
    )
    expect(container.textContent).toContain('No recorded counties to shade.')
    expect(container.textContent).toContain('You have no US county records for Common Raven in the loaded backup.')
    // The shipped Map Explorer advice would be wrong here: a backup IS loaded.
    expect(container.textContent).not.toContain('load a backup with county data')
    expect(container.querySelector('.sr-countylegend')).toBeNull()
  })

  it('carries no aria-live inside the inert-able panel', () => {
    // Deliberate deviation from the Map Explorer's legend, recorded in the
    // component: a live region inside a clipped, inert-able subtree is INSERTED
    // into the accessibility tree when the panel opens, announcing the whole
    // ramp on every open. The metric change is already announced by the
    // SegControl's aria-pressed.
    const { container } = render(<CountyShadingPanel {...base} onMetricChange={() => {}} />)
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(0)
  })
})

describe('no completeness code path from this surface (FR-16, QA-18)', () => {
  it('renders no completeness affordance in any prop combination', () => {
    for (const metric of ['species', 'records'] as const) {
      for (const useTextures of [false, true]) {
        for (const open of [false, true]) {
          const r = render(
            <CountyShadingPanel {...base} metric={metric} useTextures={useTextures} open={open} onMetricChange={() => {}} />,
          )
          expect(r.container.textContent).not.toMatch(/complete/i)
          expect(r.container.textContent).not.toMatch(/eBird API key/i)
          r.unmount()
        }
      }
    }
  })
})
