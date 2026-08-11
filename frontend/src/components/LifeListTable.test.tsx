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
      formTaxonMap={over.formTaxonMap}
      showSubspecies={over.showSubspecies}
      taxonOrders={over.taxonOrders ?? {}}
      wideMode={over.wideMode ?? false}
      pinned={over.pinned}
      onOpenSpecies={over.onOpenSpecies}
      hasEbirdBackbone={over.hasEbirdBackbone}
      sexFilter={over.sexFilter}
      ageFilter={over.ageFilter}
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
    expect(screen.getByRole('link', { name: '1 photo on Macaulay Library (opens in a new tab)' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '1 audio recording on Macaulay Library (opens in a new tab)' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '2 total media items on Macaulay Library (opens in a new tab)' })).toBeTruthy()
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

  it('appends the active sex/age facet to the Macaulay links (FR-10)', () => {
    renderTable({
      entries: [entry({ commonName: 'Wood Duck', catalogIds: ['p1'] })],
      mediaMap: { p1: 'Photo' },
      taxonMap: { 'Wood Duck': 'wooduc' },
      userId: 'USER1',
      sexFilter: 'Female',
      ageFilter: 'Juvenile',
    })
    const href = screen.getByRole('link', { name: /1 photo on Macaulay Library/ }).getAttribute('href') || ''
    expect(href).toContain('https://media.ebird.org/catalog')
    expect(href).toContain('taxonCode=wooduc')
    expect(href).toContain('age=juvenile')
    expect(href).toContain('sex=female')
  })

  it('omits facet params from the links when no facet is active', () => {
    renderTable({
      entries: [entry({ commonName: 'Wood Duck', catalogIds: ['p1'] })],
      mediaMap: { p1: 'Photo' },
      taxonMap: { 'Wood Duck': 'wooduc' },
    })
    const href = screen.getByRole('link', { name: /1 photo on Macaulay Library/ }).getAttribute('href') || ''
    expect(href).not.toContain('age=')
    expect(href).not.toContain('sex=')
  })
})

// media-catalog-taxon-links: the ML link's taxonCode is toggle-aware and never
// falls back to ?taxaName= for a form name.
describe('LifeListTable ML link taxonCode (subspecies toggle)', () => {
  const photoLink = () =>
    (screen.getByRole('link', { name: /1 photo on Macaulay Library/ }).getAttribute('href') || '')

  it('OFF (merged): a form entry links by the SPECIES code, never taxaName', () => {
    // Merged view — the display name is the species; taxonMap carries the species code.
    renderTable({
      entries: [entry({ commonName: 'Scaly-breasted Munia', catalogIds: ['p1'] })],
      mediaMap: { p1: 'Photo' },
      taxonMap: { 'Scaly-breasted Munia': 'nutman' },
      formTaxonMap: { 'Scaly-breasted Munia': 'nutman' },
      showSubspecies: false,
    })
    const href = photoLink()
    expect(href).toContain('taxonCode=nutman')
    expect(href).not.toContain('taxaName')
    expect(href.startsWith('https://media.ebird.org/catalog')).toBe(true)
  })

  it('ON (show subspecies): a form entry links by the FORM issf code', () => {
    // Un-merged view — the display name is the form; formTaxonMap carries scbmun2.
    renderTable({
      entries: [entry({ commonName: 'Scaly-breasted Munia (Scaled)', catalogIds: ['p1'] })],
      mediaMap: { p1: 'Photo' },
      taxonMap: { 'Scaly-breasted Munia': 'nutman' },
      formTaxonMap: { 'Scaly-breasted Munia (Scaled)': 'scbmun2' },
      showSubspecies: true,
    })
    const href = photoLink()
    expect(href).toContain('taxonCode=scbmun2')
    expect(href).not.toContain('taxaName')
  })

  it('ON but form code unresolved: falls back to the SPECIES code (never taxaName)', () => {
    renderTable({
      entries: [entry({ commonName: 'Scaly-breasted Munia (Scaled)', catalogIds: ['p1'] })],
      mediaMap: { p1: 'Photo' },
      // taxonMap keyed by the normalized name so the fallback resolves the species.
      taxonMap: { 'Scaly-breasted Munia': 'nutman' },
      formTaxonMap: {}, // form code missing (offline gap)
      showSubspecies: true,
    })
    const href = photoLink()
    expect(href).toContain('taxonCode=nutman')
    expect(href).not.toContain('taxaName')
  })

  it('no code at all: emits no taxon filter but stays on the media host (no taxaName, no bare-name)', () => {
    renderTable({
      entries: [entry({ commonName: 'Mystery Bird', catalogIds: ['p1'] })],
      mediaMap: { p1: 'Photo' },
      taxonMap: {},
      formTaxonMap: {},
      showSubspecies: false,
    })
    const href = photoLink()
    expect(href).not.toContain('taxaName')
    expect(href).not.toContain('taxonCode')
    expect(href.startsWith('https://media.ebird.org/catalog?mediaType=photo')).toBe(true)
  })
})

describe('LifeListTable pinned header repair (freezable-label-rows)', () => {
  // The Multimedia header sticky shipped on the <tr> from v0.0.29, and WKWebView
  // honors position:sticky on CELLS ONLY — so it has very likely never pinned
  // anything in the macOS app or on iOS, and was alive only in Chromium. The
  // repair moves it to `.sr-ll-table--pinned thead th` in globals.css, which is
  // also the only form the .sr-ios-app safe-area gate and the scroll-margin-top
  // focus guard can reach.
  //
  // jsdom has no layout engine, so what these carry is the CLASS HOOK and the
  // ABSENCE of the inline declarations that would keep the stylesheet unreachable.
  // The stylesheet's own rules are guarded in lib/lifeListPinnedCss.test.ts.

  const headerRow = (c: HTMLElement) => c.querySelector('thead tr') as HTMLElement
  const tableEl = (c: HTMLElement) => c.querySelector('table') as HTMLElement

  it('never leaves position:sticky on the <tr> (WKWebView honors it on cells only)', () => {
    // Rejects the shipped mechanism outright. It looks correct in Chrome and does
    // nothing in the app the project actually ships.
    for (const wideMode of [false, true]) {
      const { container, unmount } = renderTable({ wideMode })
      expect(headerRow(container).style.position).not.toBe('sticky')
      expect(headerRow(container).style.top).toBe('')
      unmount()
    }
  })

  it('applies .sr-ll-table--pinned only when the OPT-IN pin is on in Unbounded', () => {
    const { container } = renderTable({ wideMode: true, pinned: true })
    // Both classes: the modifier layers onto the surface's base hook.
    expect(tableEl(container).classList.contains('sr-ll-table')).toBe(true)
    expect(tableEl(container).classList.contains('sr-ll-table--pinned')).toBe(true)
  })

  it('does NOT pin in Unbounded until the control is pressed', () => {
    // The reversal. An always-on band (modifier whenever wideMode, no control) was
    // built first and reversed by the user, who wanted the two surfaces to match on
    // the CONTROL, not only on the mechanism. This fails against that version.
    const { container } = renderTable({ wideMode: true, pinned: false })
    expect(tableEl(container).classList.contains('sr-ll-table--pinned')).toBe(false)
    expect(tableEl(container).classList.contains('sr-ll-table')).toBe(true)
  })

  it('does NOT apply the modifier in Normal view, where the header cannot pin', () => {
    // Normal's wrapper scrolls horizontally only, so a sticky top there would need
    // a capped-height inner box — the shape v0.5.69 reverted on both surfaces.
    // `pinned implies Unbounded`, so a stray pinned in Normal is inert: the local
    // guard makes the component honest even if the parent's state machine broke.
    for (const pinned of [false, true]) {
      const { container, unmount } = renderTable({ wideMode: false, pinned })
      expect(tableEl(container).classList.contains('sr-ll-table--pinned')).toBe(false)
      expect(tableEl(container).classList.contains('sr-ll-table')).toBe(true)
      unmount()
    }
  })

  it('sets NO inline position/top/background/box-shadow on the pinned header cells', () => {
    // The band's fill and hairline have to come from the stylesheet: an inline
    // style is specificity 1,0,0, so the .sr-ios-app gate could never re-point
    // `top` and the band would pin into the Dynamic Island on a notched iPhone.
    const { container } = renderTable({ wideMode: true, pinned: true })
    const cells = container.querySelectorAll('thead th')
    expect(cells.length).toBeGreaterThan(0)
    for (const th of cells) {
      const el = th as HTMLElement
      expect(el.style.position).toBe('')
      expect(el.style.top).toBe('')
      expect(el.style.background).toBe('')
      expect(el.style.boxShadow).toBe('')
    }
  })

  it('moves the band fill OFF the row when pinned, so it cannot scroll out from under', () => {
    // A sticky CELL travels while its <tr> stays in flow. A fill left on the row
    // would slide away and leave the pinned cells transparent over the body rows.
    const { container } = renderTable({ wideMode: true, pinned: true })
    expect(headerRow(container).style.background).toBe('')
    expect(headerRow(container).style.boxShadow).toBe('')
  })

  it('leaves every UNPINNED path byte-identical: the row keeps its fill and hairline', () => {
    // The regression bar, and it covers UNBOUNDED-unpinned too, not just Normal.
    // That state is the one Chromium users land in by default now, so its fill and
    // hairline have to be exactly what shipped.
    for (const wideMode of [false, true]) {
      const { container, unmount } = renderTable({ wideMode, pinned: false })
      expect(headerRow(container).style.background).toBe('var(--sr-bg)')
      expect(headerRow(container).style.boxShadow).toBe('inset 0 -1px 0 var(--sr-border)')
      unmount()
    }
  })

  it('keeps borderCollapse separate (sticky table headers require it)', () => {
    for (const wideMode of [false, true]) {
      const { container, unmount } = renderTable({ wideMode })
      expect(tableEl(container).style.borderCollapse).toBe('separate')
      unmount()
    }
  })

  it('does not add a capped-height inner scroll box in either view', () => {
    // v0.5.69 stays not-reversed on this surface too.
    for (const wideMode of [false, true]) {
      const { container, unmount } = renderTable({ wideMode })
      const card = tableEl(container).parentElement as HTMLElement
      expect(card.style.maxHeight).toBe('')
      expect(card.style.overflowY).toBe('')
      unmount()
    }
  })
})
