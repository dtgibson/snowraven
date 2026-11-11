// @vitest-environment jsdom
// The location picker (hotspot-reports FR-18 to FR-24; QA-18, QA-21 to QA-24,
// QA-67, QA-74). jsdom has no layout, so nothing here claims a geometric fact.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import type { ObservationEntry } from '../../types'
import { row, checklist } from '../../test/hotspotReportsRows'
import { buildLocationIndex, type LocationIndex } from '../../lib/hotspotReports'
import type { HotspotResolution } from '../../lib/hotspotSet'
import { PICKER_OPTION_CAP } from '../../lib/hotspotReportsPicker'
import { HotspotReportsPicker } from './HotspotReportsPicker'

afterEach(cleanup)

const NO_RES = { regions: [], byRegion: new Map(), set: new Set(), pending: 0, answered: 0 } as unknown as HotspotResolution

function draw(index: LocationIndex, selectedOrd: number | null = null, res: HotspotResolution = NO_RES) {
  const onSelect = vi.fn()
  const r = render(<HotspotReportsPicker index={index} selectedOrd={selectedOrd} onSelect={onSelect} resolution={res} />)
  const input = r.container.querySelector('input[role="combobox"]') as HTMLInputElement
  return { ...r, input, onSelect }
}
const options = (c: HTMLElement) => [...c.querySelectorAll('[role="option"]')]
const activeText = (c: HTMLElement, input: HTMLInputElement) => {
  const id = input.getAttribute('aria-activedescendant')
  return id === null ? null : c.ownerDocument.getElementById(id)?.textContent ?? null
}

const small = buildLocationIndex([
  ...checklist({ submissionId: 'S1', locationId: 'L1', location: 'Home', county: 'Marin', stateProvince: 'US-CA', species: ['A'] }),
  ...checklist({ submissionId: 'S2', locationId: 'L2', location: 'Home', county: 'Marin', stateProvince: 'US-CA', species: ['A'] }),
  ...checklist({ submissionId: 'S3', locationId: 'L3', location: 'Bolinas Lagoon', county: 'Marin', stateProvince: 'US-CA', species: ['A'] }),
])

describe('contents and kinds (FR-18, FR-21, QA-18, QA-21)', () => {
  it('opens on focus with Overview first, then one row per location and no other', () => {
    const { container, input } = draw(small)
    fireEvent.focus(input)
    const opts = options(container)
    expect(opts.length).toBe(4)
    expect(opts[0].textContent).toContain('Overview')
    expect(opts[0].textContent).toContain('All 3 locations')
    expect(opts.slice(1).map(o => o.querySelector('.sr-hsr-opt-name')!.textContent)).toEqual(['Bolinas Lagoon', 'Home', 'Home'])
  })

  it('namesakes in one place each show their Location ID; kinds read as words', () => {
    const res = { ...NO_RES, set: new Set(['L1']), byRegion: new Map([['US-CA', 'answered']]) } as unknown as HotspotResolution
    const { container, input } = draw(small, null, res)
    fireEvent.focus(input)
    const [, bolinas, home1, home2] = options(container).map(o => o.textContent ?? '')
    expect(bolinas).toContain('Personal location')
    expect(bolinas).not.toContain('L3')
    expect(home1).toContain('Hotspot')
    expect(home1).toContain('L1')
    expect(home2).toContain('Personal location')
    expect(home2).toContain('L2')
  })

  it('a location whose kind is not yet known carries no kind word at all', () => {
    const { container, input } = draw(small)
    fireEvent.focus(input)
    for (const o of options(container).slice(1)) {
      expect(o.textContent).not.toContain('Hotspot')
      expect(o.textContent).not.toContain('Personal')
    }
  })
})

describe('combobox semantics and keys (FR-23, QA-23)', () => {
  it('carries the combobox attributes; options carry no tabIndex; ids are index-keyed', () => {
    const hostile = buildLocationIndex([
      ...checklist({ submissionId: 'S1', locationId: 'constructor', location: 'a b "quoted" <script>', species: ['A'] }),
      ...checklist({ submissionId: 'S2', locationId: 'L 2', location: 'x y', species: ['A'] }),
    ])
    const { container, input } = draw(hostile)
    fireEvent.focus(input)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(input.getAttribute('aria-controls')).toBeTruthy()
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy()
    for (const o of options(container)) expect(o.hasAttribute('tabindex')).toBe(false)
    const ids = [...container.querySelectorAll('[id]')].map(e => e.id)
    for (const id of ids) {
      for (const bad of ['constructor', 'quoted', 'script', 'L 2', ' ']) expect(id.includes(bad), id).toBe(false)
    }
  })

  it('arrows move and stop at the ends, Home and End jump, Enter chooses and keeps focus in the picker', () => {
    const { container, input, onSelect } = draw(small)
    input.focus()
    fireEvent.focus(input)
    expect(activeText(container, input)).toContain('Overview')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(activeText(container, input)).toContain('Overview')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(activeText(container, input)).toContain('Bolinas Lagoon')
    fireEvent.keyDown(input, { key: 'End' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(options(container).length).toBe(4)
    expect(input.getAttribute('aria-activedescendant')).toBe(options(container)[3].id)
    fireEvent.keyDown(input, { key: 'Home' })
    expect(activeText(container, input)).toContain('Overview')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(small.ordById.get('L3'))
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(container.ownerDocument.activeElement).toBe(input)
  })

  it('typing filters and makes the first location row active; no match leaves no row active', () => {
    const { container, input, onSelect } = draw(small)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'home' } })
    expect(options(container).length).toBe(3)
    expect(activeText(container, input)).toContain('Home')
    fireEvent.change(input, { target: { value: 'zzyzx' } })
    expect(container.textContent).toContain('No location matches.')
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('a pointer press chooses on mousedown; Escape is consumed only while the list is open', () => {
    const { container, input, onSelect } = draw(small)
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    try {
      fireEvent.focus(input)
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(outer).toHaveBeenCalledTimes(0)
      expect(input.getAttribute('aria-expanded')).toBe('false')
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(outer).toHaveBeenCalledTimes(1)
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.mouseDown(options(container)[0])
      expect(onSelect).toHaveBeenCalledWith(null)
    } finally {
      document.removeEventListener('keydown', outer)
    }
  })

  it('shows the selection as its value when closed; a disabled picker shows Overview', () => {
    const { input } = draw(small, small.ordById.get('L3')!)
    expect(input.value).toBe('Bolinas Lagoon')
    cleanup()
    const none = draw(buildLocationIndex([]))
    expect(none.input.disabled).toBe(true)
    expect(none.input.value).toBe('Overview')
    expect((none.container.querySelector('.sr-hsr-chev') as HTMLButtonElement).disabled).toBe(true)
  })

  it('refuses a 101st character', () => {
    const { input } = draw(small)
    expect(input.maxLength).toBe(100)
  })
})

describe('the rendered window at scale (FR-22, QA-22, QA-74)', () => {
  const rows: ObservationEntry[] = []
  for (let i = 0; i < 1000; i++) rows.push(row({ submissionId: `S${i}`, locationId: `L${i}`, location: `Place ${String(i).padStart(4, '0')}` }))
  const index = buildLocationIndex(rows)

  it('renders at most the cap plus Overview, a narrowing line that arrows never reach, and the true count', () => {
    const { container, input } = draw(index)
    fireEvent.focus(input)
    expect(options(container).length).toBe(PICKER_OPTION_CAP + 1)
    expect(container.querySelector('.sr-hsr-more')!.textContent).toBe('Showing 200 of 1,000 locations. Type to narrow.')
    expect(container.querySelector('.sr-hsr-more')!.hasAttribute('role')).toBe(false)
    fireEvent.keyDown(input, { key: 'End' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe(options(container)[PICKER_OPTION_CAP].id)
  })

  it('opening with a selection at rank 700 renders that row and makes it the active option', () => {
    const at700 = index.pickerOrder[700]
    const { container, input } = draw(index, at700)
    fireEvent.focus(input)
    expect(activeText(container, input)).toContain('Place 0700')
    expect(container.querySelector('.sr-hsr-more')!.textContent).toBe('Showing 200 of 1,000 locations. Type to narrow.')
    fireEvent.change(input, { target: { value: 'place' } })
    expect(options(container)[1].textContent).toContain('Place 0000')
  })

  it('contributes exactly two tab stops at any count', () => {
    const { container } = draw(index)
    const stops = [...container.querySelectorAll('input, button, a[href], [tabindex]')].filter(e => (e as HTMLElement).tabIndex >= 0)
    expect(stops.length).toBe(2)
  })
})
