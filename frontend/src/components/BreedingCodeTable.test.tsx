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

  it('shows each present code\'s full meaning as visible text in the legend (#26)', () => {
    // NB = Nest Building (tier 3), FL = Recently Fledged Young (tier 4) — both are
    // now readable without the hover-only title tooltip.
    renderTable({ codesPresent: ['NB', 'FL'] })
    expect(screen.getByText('Nest Building')).toBeTruthy()
    expect(screen.getByText('Recently Fledged Young')).toBeTruthy()
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

describe('BreedingCodeTable mobile column narrowing (mobile-wide-tables)', () => {
  // The code-column width is lifted off the inline width:44 onto the .sr-bc-code-col
  // class so the ≤640 media query can narrow it to ~30px (globals.css). jsdom has no
  // layout engine and can't apply a media query, so these assert the CLASS HOOK is
  // present (the pixel narrowing is verified visually on-device at the gate) and that
  // the desktop base carries no inline width that would defeat the class. FR-01/FR-05.

  it('applies .sr-bc-code-col to each code column header (FR-01/QA-05)', () => {
    renderTable({ codesPresent: ['NB', 'FL'] })
    // The columnheader's visible/accessible name is the terse code; its <th> carries
    // the class the ≤640 rule targets.
    const nbHeader = screen.getByRole('columnheader', { name: /^NB/ })
    expect(nbHeader.classList.contains('sr-bc-code-col')).toBe(true)
    const flHeader = screen.getByRole('columnheader', { name: /^FL/ })
    expect(flHeader.classList.contains('sr-bc-code-col')).toBe(true)
  })

  it('applies .sr-bc-code-col to each code count cell (FR-02)', () => {
    renderTable({ entries: [entry({ commonName: 'American Robin', codes: { NB: 2 } })], codesPresent: ['NB', 'FL'] })
    // The count-dot cells are <td>s (not <th>); the row header is the species name.
    const cells = document.querySelectorAll('td.sr-bc-code-col')
    expect(cells.length).toBe(2) // one per present code (NB, FL)
  })

  it('does NOT set an inline width on the code header (so the class rule can reach it) (FR-01)', () => {
    renderTable({ codesPresent: ['NB'] })
    const nbHeader = screen.getByRole('columnheader', { name: /^NB/ })
    // An inline width:44 would beat the class (specificity 1,0,0) and freeze the
    // desktop width onto the phone tier — the exact convention pitfall we're avoiding.
    expect(nbHeader.style.width).toBe('')
    expect(nbHeader.style.minWidth).toBe('')
  })

  it('keeps the code header a real sortable button with its full-meaning aria-label after narrowing (FR-04/QA-04)', () => {
    renderTable({ codesPresent: ['NB', 'FL'] })
    // Narrowing the column must not cost the accessible name or the sort control.
    const nbBtn = screen.getByRole('button', { name: 'Sort by Nest Building (NB)' })
    expect(nbBtn.tagName).toBe('BUTTON')
    // The button is the direct child of the classed <th>, so the ≤640 font rule
    // (th.sr-bc-code-col > button) reaches it.
    expect((nbBtn.parentElement as HTMLElement).classList.contains('sr-bc-code-col')).toBe(true)
  })

  it('does not use CSS zoom or transform:scale to magnify (FR-08/NFR-03/QA-08)', () => {
    const { container } = renderTable({ codesPresent: ['NB', 'FL'] })
    // No element on the changed surface carries a CSS pixel-scaling primitive — the
    // magnify strategy is native viewport pinch, not CSS scaling (proven WKWebView
    // failure). Guards against a regression re-introducing the reverted approach.
    const scaled = container.querySelectorAll('[style*="scale"],[style*="zoom"]')
    expect(scaled.length).toBe(0)
  })

  it('keeps the sticky name column in the default (non-wideMode) branch and drops it in wideMode (FR-03/FR-13)', () => {
    const { rerender } = renderTable({ wideMode: false })
    const rowHeader = screen.getByRole('rowheader')
    // Default: frozen name column (position:sticky; left:0) so it stays visible while
    // the narrowed code columns scroll/pan.
    expect(rowHeader.style.position).toBe('sticky')
    expect(rowHeader.style.left).toBe('0px')
    // wideMode drops the sticky positioning (the graceful escape for the
    // sticky-under-pinch risk) — the whole matrix scrolls as max-content.
    rerender(
      <BreedingCodeTable
        entries={[entry({ commonName: 'American Robin', codes: { NB: 2 } })]}
        codesPresent={['NB', 'FL']}
        sort={baseSort}
        onSortChange={vi.fn()}
        filter={new Set()}
        taxonMap={{}}
        taxonOrders={{}}
        wideMode={true}
        onOpenSpecies={undefined}
      />
    )
    expect(screen.getByRole('rowheader').style.position).not.toBe('sticky')
  })
})

describe('BreedingCodeTable column separators + horizontal-sticky name column (mobile-wide-tables)', () => {
  // jsdom has no layout engine, so these assert the CLASS HOOKS (border separators)
  // and the position/left attributes (horizontal name-column freeze) — the actual
  // pinning is eyeballed on the live dev instance. The vertical (top) header freeze
  // and the capped-height data-grid were removed in favor of natural page scroll:
  // the header row scrolls away with the page, the table renders full-height, and the
  // tier legend follows the last row in normal flow. Only the HORIZONTAL name-column
  // freeze (which predates that work) remains.

  // --- Separators (kept) ---

  it('gives each code column cell the separator class (.sr-bc-code-col carries border-right) (rev1)', () => {
    renderTable({ entries: [entry({ commonName: 'American Robin', codes: { NB: 2 } })], codesPresent: ['NB', 'FL'] })
    // Header + body code cells both carry the class whose CSS adds the 1px right
    // separator (full-height column line through header + body).
    expect(document.querySelectorAll('th.sr-bc-code-col').length).toBe(2)
    expect(document.querySelectorAll('td.sr-bc-code-col').length).toBe(2)
  })

  it('gives the species-name header and every name row cell the name-column separator class (rev1)', () => {
    renderTable({
      entries: [
        entry({ commonName: 'American Robin', codes: { NB: 2 } }),
        entry({ commonName: 'Song Sparrow', codes: { FL: 1 } }),
      ],
      codesPresent: ['NB', 'FL'],
    })
    // The corner header cell (the "Species" columnheader) carries the name-col class.
    const speciesHeader = screen.getByRole('columnheader', { name: /Species/ })
    expect(speciesHeader.classList.contains('sr-bc-name-col')).toBe(true)
    // Every name row header carries it too, so the divider runs the full body height.
    const rowHeaders = screen.getAllByRole('rowheader')
    expect(rowHeaders.length).toBe(2)
    for (const rh of rowHeaders) expect(rh.classList.contains('sr-bc-name-col')).toBe(true)
  })

  // --- Header row scrolls away; no vertical freeze (frozen-header/capped-box removed) ---

  it('does NOT vertically freeze the code headers — they scroll away with the page', () => {
    renderTable({ codesPresent: ['NB', 'FL'], wideMode: false })
    // No sticky-top on the code headers: the header row is normal flow and scrolls
    // with the page (the user chose natural page scroll over a frozen-header grid).
    for (const name of [/^NB/, /^FL/]) {
      const codeHeader = screen.getByRole('columnheader', { name }) as HTMLElement
      expect(codeHeader.style.position).not.toBe('sticky')
      expect(codeHeader.style.top).toBe('')
    }
  })

  it('does NOT vertically freeze the corner — it has no top inset in either mode', () => {
    const cornerStyle = () => (screen.getByRole('columnheader', { name: /Species/ }) as HTMLElement).style
    const { rerender } = renderTable({ codesPresent: ['NB'], wideMode: false })
    expect(cornerStyle().top).toBe('')
    rerender(
      <BreedingCodeTable
        entries={[entry({ commonName: 'American Robin', codes: { NB: 2 } })]}
        codesPresent={['NB']}
        sort={baseSort}
        onSortChange={vi.fn()}
        filter={new Set()}
        taxonMap={{}}
        taxonOrders={{}}
        wideMode={true}
        onOpenSpecies={undefined}
      />
    )
    expect(cornerStyle().top).toBe('')
  })

  // --- Horizontal name-column freeze (pre-existing) is KEPT ---

  it('keeps the corner horizontally sticky (left:0, no top) in Normal mode', () => {
    renderTable({ codesPresent: ['NB'], wideMode: false })
    const corner = screen.getByRole('columnheader', { name: /Species/ }) as HTMLElement
    // Horizontal freeze only: sticky + left:0 so the name column stays put while the
    // codes scroll sideways; NO top (the header scrolls away vertically).
    expect(corner.style.position).toBe('sticky')
    expect(corner.style.left).toBe('0px')
    expect(corner.style.top).toBe('')
  })

  it('drops the corner horizontal freeze in wideMode (FR-13)', () => {
    renderTable({ codesPresent: ['NB'], wideMode: true })
    const corner = screen.getByRole('columnheader', { name: /Species/ }) as HTMLElement
    // wideMode scrolls the whole max-content matrix — the name column is not frozen.
    expect(corner.style.position).toBe('')
    expect(corner.style.left).toBe('')
  })

  it('keeps the name row cells horizontally sticky (left:0, no top) in Normal, dropped in wideMode (FR-03/FR-13)', () => {
    const { rerender } = renderTable({ entries: [entry({ commonName: 'American Robin', codes: { NB: 2 } })], codesPresent: ['NB'], wideMode: false })
    const nameCell = () => screen.getByRole('rowheader') as HTMLElement
    expect(nameCell().style.position).toBe('sticky')
    expect(nameCell().style.left).toBe('0px')
    expect(nameCell().style.top).toBe('')
    rerender(
      <BreedingCodeTable
        entries={[entry({ commonName: 'American Robin', codes: { NB: 2 } })]}
        codesPresent={['NB']}
        sort={baseSort}
        onSortChange={vi.fn()}
        filter={new Set()}
        taxonMap={{}}
        taxonOrders={{}}
        wideMode={true}
        onOpenSpecies={undefined}
      />
    )
    expect(nameCell().style.position).not.toBe('sticky')
  })

  // --- No inner vertical-scroll box: the table is full-height, the page scrolls ---

  it('scrolls the wrapper horizontally only, with no vertical max-height box (natural page scroll)', () => {
    const { container } = renderTable({ wideMode: false })
    const wrapper = container.querySelector('table')!.parentElement as HTMLElement
    // Horizontal scroll for the wide matrix; NO capped-height data-grid class and no
    // inline vertical bound — the table renders full-height and the whole page scrolls.
    expect(wrapper.classList.contains('sr-bc-scroll')).toBe(false)
    expect(wrapper.style.overflowX).toBe('auto')
    expect(wrapper.style.maxHeight).toBe('')
    // overflow (both-axes) must not be set — that would reintroduce the inner box.
    expect(wrapper.style.overflow).toBe('')
  })
})

describe('BreedingCodeTable matrix table-layout hook (unbounded-column-narrowing)', () => {
  // The phone code-column narrowing (.sr-bc-code-col → 30px at ≤640) only held in
  // Normal view, not Unbounded (wideMode), because the matrix <table> uses the
  // default table-layout: auto (30px is a floor there). The fix puts .sr-bc-matrix
  // on the <table> and moves the table's OWN width/min-width onto that class, so a
  // ≤640-only rule can switch to `table-layout: fixed; width: max-content; min-width: 0`
  // and make the declared widths bind in BOTH modes without the circular-width runaway
  // that inline `width:100%; min-width:max-content` + fixed layout caused in wideMode.
  // jsdom has no layout engine and can't apply a media query or compute layout, so
  // these assert the CLASS HOOK is present and the width is NOT re-pinned inline (the
  // pixel narrowing / no-explosion is verified live at phone width at the gate).

  it('puts .sr-bc-matrix on the matrix <table> and does NOT set inline width/min-width/table-layout (so the class rules bind) — Normal mode', () => {
    const { container } = renderTable({ wideMode: false })
    const table = container.querySelector('table')!
    expect(table.classList.contains('sr-bc-matrix')).toBe(true)
    // The table's width/min-width now live on .sr-bc-matrix (base = width:100%/
    // min-width:max-content; ≤640 override = table-layout:fixed; width:max-content;
    // min-width:0). An inline width/min-width would beat the media query (specificity
    // 1,0,0) and re-introduce the wideMode circular-width explosion — so there must be
    // none. table-layout is never set in JS (one CSS rule fixes both modes).
    expect(table.style.width).toBe('')
    expect(table.style.minWidth).toBe('')
    expect(table.style.tableLayout).toBe('')
  })

  it('keeps .sr-bc-matrix on the <table> with no inline width/min-width in Unbounded (wideMode) — the mode that exploded', () => {
    const { container } = renderTable({ wideMode: true })
    const table = container.querySelector('table')!
    expect(table.classList.contains('sr-bc-matrix')).toBe(true)
    // Same contract in wideMode: no inline width/min-width, so the ≤640
    // width:max-content override can tame the fixed-layout table to its ~540px
    // definite width instead of running away to the max-element cap.
    expect(table.style.width).toBe('')
    expect(table.style.minWidth).toBe('')
    expect(table.style.tableLayout).toBe('')
  })

  it('keeps .sr-bc-code-col on the code cells in BOTH modes so the 30px width can bind under fixed layout', () => {
    for (const wideMode of [false, true]) {
      const { unmount } = renderTable({
        entries: [entry({ commonName: 'American Robin', codes: { NB: 2 } })],
        codesPresent: ['NB', 'FL'],
        wideMode,
      })
      // header + body code cells both carry the width-bearing class in either mode.
      expect(document.querySelectorAll('th.sr-bc-code-col').length).toBe(2)
      expect(document.querySelectorAll('td.sr-bc-code-col').length).toBe(2)
      unmount()
    }
  })

  it('keeps the sticky name column carrying its declared NAME_COL_WIDTH so fixed layout distributes cleanly', () => {
    // Under table-layout: fixed every column needs a declared width; the name column's
    // is the inline clamp() NAME_COL_WIDTH on both the corner header and each name row
    // cell. (jsdom's CSSOM drops `width: clamp(...)` on the width longhand but keeps it
    // on min-width — the TSX sets both to the same clamp, so the observable min-width
    // proves the declared width is present.)
    renderTable({ entries: [entry({ commonName: 'American Robin', codes: { NB: 2 } })], codesPresent: ['NB'] })
    const corner = screen.getByRole('columnheader', { name: /Species/ }) as HTMLElement
    expect(corner.style.minWidth).toContain('clamp(')
    const nameCell = screen.getByRole('rowheader') as HTMLElement
    expect(nameCell.style.minWidth).toContain('clamp(')
  })

  // The wideMode card's width was lifted off the inline `width: max-content` onto
  // .sr-bc-card so the ≤640 tier can switch it to `width: min-content` — sizing the
  // Unbounded card to the fixed-layout table's declared-width sum (~540px) instead of
  // the columns' intrinsic content width (~1751px), removing the trailing whitespace.
  // The card is the component's ROOT <div> (the <table>'s grandparent: table → wrapper
  // → card). jsdom can't compute layout, so these assert the class hook + no inline
  // width (the same lift-to-class contract as .sr-bc-matrix); the whitespace removal is
  // verified live at phone width.
  function card(container: HTMLElement): HTMLElement {
    return container.querySelector('table')!.parentElement!.parentElement as HTMLElement
  }

  it('puts .sr-bc-card on the Unbounded (wideMode) card with no inline width, so the ≤640 min-content rule can bind', () => {
    const { container } = renderTable({ wideMode: true })
    const c = card(container)
    expect(c.classList.contains('sr-bc-card')).toBe(true)
    // No inline width — it lives on .sr-bc-card (base max-content; ≤640 min-content).
    // An inline width would beat the media query and re-introduce the whitespace.
    expect(c.style.width).toBe('')
  })

  it('does NOT put .sr-bc-card on the card in Normal mode (it never uses the max-content card)', () => {
    const { container } = renderTable({ wideMode: false })
    const c = card(container)
    // Normal mode uses the overflowX:auto wrapper, not the max-content card, so it must
    // not carry .sr-bc-card — the ≤640 min-content rule must not reach Normal mode.
    expect(c.classList.contains('sr-bc-card')).toBe(false)
    expect(c.style.width).toBe('')
  })
})
