// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { LifeListTable } from './LifeListTable'
import type { LifeListEntry } from '../lib/parseLifeList'
import type { MediaFilterState, SortState } from '../types'
import { MEDIA_FILTER_CLEAR } from '../types'

afterEach(cleanup)

function entry(p: Partial<LifeListEntry> & { commonName: string }): LifeListEntry {
  return {
    commonName: p.commonName,
    scientificName: p.scientificName ?? 'Genus species',
    taxonomicOrder: p.taxonomicOrder ?? Infinity,
    catalogIds: p.catalogIds ?? [],
    isNonBird: p.isNonBird,
  }
}

const baseSort: SortState = { column: 'name', dir: 'asc', nameSortMode: 'az' }
const noFilter: MediaFilterState = MEDIA_FILTER_CLEAR

function renderTable(over: Partial<React.ComponentProps<typeof LifeListTable>> = {}) {
  return render(
    <LifeListTable
      entries={over.entries ?? [entry({ commonName: 'Mallard', catalogIds: ['c1'] })]}
      mediaMap={over.mediaMap ?? { c1: 'Photo' }}
      filter={over.filter ?? noFilter}
      sort={over.sort ?? baseSort}
      onSortChange={over.onSortChange ?? vi.fn()}
      userId={over.userId ?? null}
      taxonMap={over.taxonMap ?? {}}
      taxonOrders={over.taxonOrders ?? {}}
      wideMode={over.wideMode ?? false}
      onOpenSpecies={over.onOpenSpecies}
      hasEbirdBackbone={over.hasEbirdBackbone}
    />
  )
}

describe('LifeListTable accessibility', () => {
  it('renders sortable column headers as real <button>s inside <th> (F041)', () => {
    renderTable()
    // The visible "Entries" header is an activatable button, not a bare <th>.
    const entriesBtn = screen.getByRole('button', { name: /Entries/ })
    expect(entriesBtn.tagName).toBe('BUTTON')
    // Icon-only media headers carry an explicit accessible name via aria-label.
    expect(screen.getByRole('button', { name: 'Sort by Photo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sort by Audio' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sort by Video' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Total/ })).toBeTruthy()
  })

  it('keeps aria-sort on the <th> reflecting the active column/direction (F041)', () => {
    renderTable({ sort: { column: 'photo', dir: 'desc', nameSortMode: 'az' } })
    const photoHeader = screen.getByRole('columnheader', { name: /Photo/ })
    expect(photoHeader.getAttribute('aria-sort')).toBe('descending')
    const nameHeader = screen.getByRole('columnheader', { name: /Entries/ })
    expect(nameHeader.getAttribute('aria-sort')).toBe('none')
  })

  it('clicking a sort button calls onSortChange (F041 keyboard/SR operability)', () => {
    const onSortChange = vi.fn()
    renderTable({ onSortChange })
    screen.getByRole('button', { name: 'Sort by Audio' }).click()
    expect(onSortChange).toHaveBeenCalledWith(expect.objectContaining({ column: 'audio' }))
  })

  it('renders the species cell as a row header (F081)', () => {
    renderTable()
    const rowHeader = screen.getByRole('rowheader')
    expect(rowHeader.tagName).toBe('TH')
    expect(rowHeader.getAttribute('scope')).toBe('row')
    expect(within(rowHeader).getByText('Mallard')).toBeTruthy()
  })

  it('media-count links announce a meaningful name + new-tab indication (F078)', () => {
    renderTable({
      entries: [entry({ commonName: 'Mallard', catalogIds: ['p1', 'a1'] })],
      mediaMap: { p1: 'Photo', a1: 'Audio' },
    })
    expect(screen.getByRole('link', { name: '1 photo on Macaulay Library (opens in new tab)' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '1 audio recording on Macaulay Library (opens in new tab)' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '2 total media items on Macaulay Library (opens in new tab)' })).toBeTruthy()
  })

  it('renders an AT-reachable "no media" indicator instead of an unlabeled faint glyph (F082)', () => {
    renderTable({
      entries: [entry({ commonName: 'Mallard', catalogIds: ['p1'] })],
      mediaMap: { p1: 'Photo' },
    })
    // Photo present (link), but audio/video/total-for-this-entry... total is present so:
    expect(screen.getByRole('img', { name: 'No audio' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'No video' })).toBeTruthy()
  })

  it('shows a "no results" message when the filtered row set is empty (F080)', () => {
    renderTable({ entries: [] })
    expect(screen.getByText('No species match these filters.')).toBeTruthy()
  })
})
