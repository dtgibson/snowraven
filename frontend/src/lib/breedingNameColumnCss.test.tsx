// Structural guard for the Breeding Codes phone name-column overflow fix.
// jsdom cannot evaluate table/flex geometry or media queries, so this parses the
// real stylesheet and pairs it with the rendered component seam. The exact
// selector and exact media ancestry reject a global BirdName repair, a widened
// viewport band, and a rule aimed at the wrong descendant.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { BreedingCodeTable } from '../components/BreedingCodeTable'
import { parseRulesAtAnyDepth, parseTopLevelRules } from './cssTopLevelRules'

afterEach(cleanup)

const css = readFileSync(resolve(process.cwd(), 'src/globals.css'), 'utf8')
const boxSelector = '.sr-bc-name-col .sr-birdname'
const rowSelector = '.sr-bc-name-col .sr-birdname-row'

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of body.split(';')) {
    const colon = part.indexOf(':')
    if (colon >= 0) out.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim())
  }
  return out
}

describe('Breeding Codes phone name-column containment', () => {
  it('contains and wraps only the Breeding Codes BirdName at the exact phone tier', () => {
    const boxRules = parseRulesAtAnyDepth(css).filter(rule => rule.selector === boxSelector)
    expect(boxRules, `${boxSelector} must be declared exactly once`).toHaveLength(1)
    expect(boxRules[0].atRules).toEqual(['@media (max-width: 640px)'])
    expect([...declarations(boxRules[0].body)]).toEqual([
      ['width', '100%'],
      ['max-width', '100%'],
    ])

    const rowRules = parseRulesAtAnyDepth(css).filter(rule => rule.selector === rowSelector)
    expect(rowRules, `${rowSelector} must be declared exactly once`).toHaveLength(1)
    expect(rowRules[0].atRules).toEqual(['@media (max-width: 640px)'])
    expect([...declarations(rowRules[0].body)]).toEqual([['flex-wrap', 'wrap']])

    const globalCaps = parseRulesAtAnyDepth(css)
      .filter(rule => rule.selector === '.sr-birdname')
      .filter(rule => ['width', 'max-width'].some(property => declarations(rule.body).has(property)))
    expect(globalCaps, 'the shared BirdName must not receive the local cap').toEqual([])
    const globalRows = parseRulesAtAnyDepth(css)
      .filter(rule => rule.selector === '.sr-birdname-row')
      .filter(rule => declarations(rule.body).has('flex-wrap'))
    expect(globalRows, 'the shared BirdName row must not receive the local wrap').toEqual([])
  })

  it('renders the capped descendant with both named 24px external targets intact', () => {
    const { container } = render(createElement(BreedingCodeTable, {
      entries: [{ commonName: 'American Robin', scientificName: 'Turdus migratorius', codes: { NB: 1 } }],
      codesPresent: ['NB'],
      sort: { column: 'name', dir: 'asc', nameSortMode: 'az' },
      onSortChange: vi.fn(),
      filter: new Set<string>(),
      taxonMap: { 'American Robin': 'amerob' },
      taxonOrders: {},
      wideMode: false,
      pinned: false,
      onOpenSpecies: vi.fn(),
    }))

    const nameCell = screen.getByRole('rowheader')
    expect(nameCell.classList.contains('sr-bc-name-col')).toBe(true)
    expect(nameCell.querySelector(':scope > .sr-birdname')).toBeTruthy()

    const links = within(nameCell).getAllByRole('link')
    expect(links.map(link => link.getAttribute('aria-label'))).toEqual([
      'View American Robin on eBird (opens in a new tab)',
      'View American Robin on Birds of the World (opens in a new tab)',
    ])
    const slot = declarations(parseTopLevelRules(css).get('.sr-favicon-slot') ?? '')
    expect(slot.get('width')).toBe('14px')
    expect(slot.get('height')).toBe('14px')
    for (const link of links) {
      expect((link as HTMLElement).style.padding).toBe('5px')
      expect(link.querySelector('.sr-favicon-slot')).toBeTruthy()
    }
    expect(container.querySelectorAll('.sr-birdname')).toHaveLength(1)
  })
})
