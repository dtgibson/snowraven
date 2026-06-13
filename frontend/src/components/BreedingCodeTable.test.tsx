// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { BreedingCodeTable } from './BreedingCodeTable'
import type { BreedingEntry } from '../lib/parseBreedingCodes'
import type { BreedingSortState } from '../types'

afterEach(cleanup)

function entry(p: Partial<BreedingEntry> & { commonName: string }): BreedingEntry {
  return {
    commonName: p.commonName,
    scientificName: p.scientificName ?? 'Genus species',
    codes: p.codes ?? {},
  }
}

const baseSort: BreedingSortState = { column: 'name', dir: 'asc', nameSortMode: 'az' }

function renderTable(over: Partial<React.ComponentProps<typeof BreedingCodeTable>> = {}) {
  return render(
    <BreedingCodeTable
      entries={over.entries ?? [entry({ commonName: 'American Robin', codes: { NB: 2 } })]}
      codesPresent={over.codesPresent ?? ['NB', 'FL']}
      sort={over.sort ?? baseSort}
      onSortChange={over.onSortChange ?? vi.fn()}
      filter={over.filter ?? new Set()}
      taxonMap={over.taxonMap ?? {}}
      taxonOrders={over.taxonOrders ?? {}}
      wideMode={over.wideMode ?? false}
      onOpenSpecies={over.onOpenSpecies}
    />
  )
}

describe('BreedingCodeTable accessibility', () => {
  it('renders sortable column headers as real <button>s inside <th> (F041)', () => {
    renderTable()
    expect(screen.getByRole('button', { name: /Species/ }).tagName).toBe('BUTTON')
  })

  it('code column header buttons carry the full code meaning in the accessible name (F073/F041)', () => {
    renderTable({ codesPresent: ['NB', 'FL'] })
    // "NB" = Nest Building, "FL" = Recently Fledged Young — exposed without the
    // mouse-only title tooltip.
    expect(screen.getByRole('button', { name: 'Sort by Nest Building (NB)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sort by Recently Fledged Young (FL)' })).toBeTruthy()
  })

  it('keeps aria-sort on the <th> for the active column (F041)', () => {
    renderTable({ sort: { column: 'NB', dir: 'asc', nameSortMode: 'az' } })
    // The columnheader's visible name is the terse code; its inner button carries
    // the full label. aria-sort stays on the <th>.
    const nbHeader = screen.getByRole('columnheader', { name: /^NB/ })
    expect(nbHeader.getAttribute('aria-sort')).toBe('ascending')
  })

  it('clicking a code header button sorts by that code (F041 operability)', () => {
    const onSortChange = vi.fn()
    renderTable({ onSortChange })
    screen.getByRole('button', { name: 'Sort by Nest Building (NB)' }).click()
    expect(onSortChange).toHaveBeenCalledWith(expect.objectContaining({ column: 'NB' }))
  })

  it('keeps the species name cell as a row header (F081 parity)', () => {
    renderTable()
    const rowHeader = screen.getByRole('rowheader')
    expect(rowHeader.getAttribute('scope')).toBe('row')
    expect(within(rowHeader).getByText('American Robin')).toBeTruthy()
  })

  it('count badge announces its tier category and is not color-only (F004)', () => {
    // FL is tier 4 → "Confirmed"; pick a code whose category label is unique to
    // the badge (not also a legend row for another tier present).
    renderTable({ entries: [entry({ commonName: 'American Robin', codes: { FL: 3 } })], codesPresent: ['FL'] })
    const badge = screen.getByText('3', { selector: 'div' })
    // The sr-only category text rides with the count inside the badge.
    expect(badge.textContent).toContain('Confirmed')
  })

  it('shows a "no results" message when the filter empties the table (F080)', () => {
    // Filter requires a code no entry has → zero rows.
    renderTable({
      entries: [entry({ commonName: 'American Robin', codes: { NB: 1 } })],
      codesPresent: ['NB', 'FL'],
      filter: new Set(['FL']),
    })
    expect(screen.getByText('No species match these filters.')).toBeTruthy()
  })
})
