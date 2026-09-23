// @vitest-environment jsdom
//
// The shared date pair (county-date-filter-mobile). What jsdom CAN prove here is
// the DOM contract the stylesheet and assistive technology both rely on: which
// classes land on which element, how the visible word is tied to its input, that
// the arrow is hidden from assistive technology, and that the set state is
// carried by an attribute rather than an inline colour. What it CANNOT prove is
// any of the layout (jsdom has no cascade and no media queries); that is
// lib/dateRangeFieldsCss.test.ts for the rules and a real-engine render for the
// geometry.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DateRangeFields, type DateRangeRegister } from './DateRangeFields'

afterEach(cleanup)

const REGISTERS: DateRangeRegister[] = ['multimedia', 'species-detail', 'breeding-codes', 'checklists', 'map-sidebar']
const PILL_ROW: DateRangeRegister[] = ['multimedia', 'species-detail', 'breeding-codes']

function renderPair(register: DateRangeRegister, from = '', to = '') {
  const onFrom = vi.fn()
  const onTo = vi.fn()
  const view = render(<DateRangeFields register={register} from={from} to={to} onFrom={onFrom} onTo={onTo} />)
  return { ...view, onFrom, onTo }
}

describe('DateRangeFields: the controls and their names', () => {
  for (const register of REGISTERS) {
    it(`${register}: two native date inputs named From date / To date, each carrying the phone floor`, () => {
      renderPair(register)
      for (const name of ['From date', 'To date']) {
        const el = screen.getByLabelText(name)
        expect(el.tagName).toBe('INPUT')
        expect(el.getAttribute('type')).toBe('date')
        // On the control element itself, the placement the iOS focus-zoom guard
        // needs (it was inert on a wrapper until v0.5.61).
        expect(el.classList.contains('sr-input-16')).toBe(true)
        // No inline style at all: an inline declaration is specificity 1,0,0 and
        // would beat the phone tier, which is the whole mechanism of this fix.
        expect(el.getAttribute('style')).toBeNull()
      }
    })
  }

  it('ties each visible word to its own input through a useId id, never a value', () => {
    // Two pairs on one page, as the app mounts several tabs at once: every id is
    // distinct, every word resolves to exactly the input its text names, and no
    // id carries the date the user typed.
    render(
      <>
        <DateRangeFields register="multimedia" from="2025-03-01" to="2025-06-30" onFrom={() => {}} onTo={() => {}} />
        <DateRangeFields register="checklists" from="2025-03-01" to="" onFrom={() => {}} onTo={() => {}} />
      </>,
    )
    const inputs = [...document.querySelectorAll('input[type="date"]')]
    expect(inputs).toHaveLength(4)
    const ids = inputs.map(i => i.id)
    expect(new Set(ids).size, 'no two inputs share an id').toBe(4)
    for (const id of ids) {
      expect(id).not.toBe('')
      expect(id).not.toContain('2025')
    }
    const words = [...document.querySelectorAll('label.sr-daterange-word')]
    expect(words).toHaveLength(4)
    for (const word of words) {
      const target = document.getElementById(word.getAttribute('for') ?? '')
      expect(target, 'each word points at a real input').toBeTruthy()
      const expected = word.textContent === 'From' ? 'From date' : 'To date'
      expect(target!.getAttribute('aria-label')).toBe(expected)
      // Label in name: the visible word is contained in the accessible name.
      expect(expected.startsWith(word.textContent!)).toBe(true)
    }
  })

  it('keeps the word out of the reading order and inside the label floor', () => {
    renderPair('multimedia')
    const words = [...document.querySelectorAll('label.sr-daterange-word')]
    expect(words.map(w => w.textContent)).toEqual(['From', 'To'])
    for (const word of words) {
      // The input already speaks the word; a second, unattached "From" in the
      // reading order is the double-read this avoids.
      expect(word.getAttribute('aria-hidden')).toBe('true')
      // The opt-in that keeps the word at its control's phone-tier size.
      expect(word.classList.contains('sr-ctl-label')).toBe(true)
    }
    // aria-label wins over the label element, so the names are unchanged.
    expect(screen.getByLabelText('From date').getAttribute('aria-label')).toBe('From date')
  })
})

describe('DateRangeFields: set state and change events', () => {
  it('carries the set state on each field as data-set, never as an inline colour', () => {
    renderPair('species-detail', '2025-03-01', '')
    const [fromField, toField] = [...document.querySelectorAll('.sr-daterange-field')]
    expect(fromField.getAttribute('data-set')).toBe('true')
    // Absent, not "false": the stylesheet keys on the literal "true".
    expect(toField.hasAttribute('data-set')).toBe(false)
  })

  it('reports each edit as the plain value string, one callback per field', () => {
    const { onFrom, onTo } = renderPair('breeding-codes')
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2025-04-02' } })
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2025-05-09' } })
    expect(onFrom).toHaveBeenCalledTimes(1)
    expect(onFrom).toHaveBeenCalledWith('2025-04-02')
    expect(onTo).toHaveBeenCalledTimes(1)
    expect(onTo).toHaveBeenCalledWith('2025-05-09')
  })
})

describe('DateRangeFields: what each register draws', () => {
  for (const register of REGISTERS) {
    it(`${register}: the group classes, the glyph and the arrow`, () => {
      const { container } = renderPair(register)
      const group = container.firstElementChild as HTMLElement
      expect(group.classList.contains('sr-daterange')).toBe(true)
      expect(group.classList.contains(`sr-daterange--${register}`)).toBe(true)
      const pillRow = PILL_ROW.includes(register)
      expect(group.classList.contains('sr-daterange--inline')).toBe(pillRow)
      // THE ROOT CAUSE, pinned: only the Map sidebar's pair may ride
      // .sr-field-row. On the pill-row surfaces that class's <=480 stacking is
      // what turned the pair into a tower inside a shrink-to-fit group.
      expect(group.classList.contains('sr-field-row')).toBe(register === 'map-sidebar')

      // The Calendar glyph belongs to the pill-row From field only.
      expect(container.querySelectorAll('.sr-daterange-glyph')).toHaveLength(pillRow ? 1 : 0)

      // The arrow: decorative everywhere it is drawn, never read as "right arrow".
      const arrows = container.querySelectorAll('.sr-daterange-arrow')
      expect(arrows).toHaveLength(register === 'map-sidebar' ? 0 : 1)
      for (const arrow of arrows) expect(arrow.getAttribute('aria-hidden')).toBe('true')

      // Field order is From, then To: the joined-pair rules key on it.
      const fields = [...group.querySelectorAll(':scope > .sr-daterange-field')]
      expect(fields).toHaveLength(2)
      expect(fields[0].querySelector('input')!.getAttribute('aria-label')).toBe('From date')
      expect(fields[1].querySelector('input')!.getAttribute('aria-label')).toBe('To date')
      expect(group.firstElementChild).toBe(fields[0])
    })
  }
})
