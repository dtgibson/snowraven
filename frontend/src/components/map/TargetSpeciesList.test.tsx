// @vitest-environment jsdom
//
// The Media Targets view's Target Species list (code-search-and-a11y-polish,
// item 1): the box ranks through the shared species matcher exactly as every
// picker does, starts the code load on focus and never waits for it. The code
// data is driven through the loader's importer seam so each row controls when
// it arrives; the table itself is always the REAL committed asset, as in
// `SpeciesCombobox.alphaCodes.test.tsx`.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { TargetSpeciesList, TARGET_SPECIES_ROW_CAP, type TargetSpeciesRow } from './TargetSpeciesList'
import { _resetAlphaCodesForTests, _setAlphaCodesImporterForTests, loadAlphaCodes } from '../../lib/alphaCodesAsset'

type Module = { default: unknown }
const realModule = () => import('../../assets/ebird-alpha-codes.json') as Promise<Module>

beforeEach(() => _resetAlphaCodesForTests())
afterEach(() => { cleanup(); _resetAlphaCodesForTests() })

/** The list as MapExplorer drives it: the query and the ticks are the host's state. */
function Host({ rows, onToggle = () => {} }: { rows: readonly TargetSpeciesRow[]; onToggle?: (name: string, checked: boolean) => void }) {
  const [query, setQuery] = useState('')
  return <TargetSpeciesList rows={rows} query={query} onQueryChange={setQuery} selected={new Set()} onToggle={onToggle} />
}
const box = () => screen.getByPlaceholderText('Search species…') as HTMLInputElement
const listed = () => screen.queryAllByRole('checkbox').map(cb => cb.closest('label')!.textContent)
const type = (value: string) => {
  fireEvent.focus(box())
  fireEvent.change(box(), { target: { value } })
}
async function loaded() {
  _setAlphaCodesImporterForTests(realModule)
  await act(async () => { await loadAlphaCodes() })
}

// Alphabetical, as MapExplorer's `speciesOptions` is: every distinct name in the
// backup with the scientific name of its first observation.
const ROWS: TargetSpeciesRow[] = [
  { name: 'American Robin', sciName: 'Turdus migratorius' },
  { name: "Anna's Hummingbird", sciName: 'Calypte anna' },
  { name: 'Northern Yellow Warbler', sciName: 'Setophaga aestiva' },
  { name: 'Townsend\'s Warbler', sciName: 'Setophaga townsendi' },
  { name: 'Wilson\'s Warbler', sciName: 'Cardellina pusilla' },
  { name: 'Yellow-rumped Warbler', sciName: 'Setophaga coronata' },
  { name: "Yellow-rumped Warbler (Audubon's)", sciName: 'Setophaga coronata auduboni' },
]

describe('the shared match (rule A, FR-13)', () => {
  it('a typed code lists the bird and its forms first, then name matches in list order', async () => {
    await loaded()
    render(<Host rows={[...ROWS, { name: 'Yellow Warbler', sciName: 'Setophaga petechia' }].sort((a, b) => (a.name < b.name ? -1 : 1))} />)
    type('yrwa')
    expect(listed()).toEqual(['Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)"])
    type('YRWA ')   // normalized once: trimmed and lowercased, like every picker
    expect(listed()).toEqual(['Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)"])
  })

  it('a scientific-name fragment matches', () => {
    render(<Host rows={ROWS} />)
    type('calypte')
    expect(listed()).toEqual(["Anna's Hummingbird"])
    type('setophaga')
    expect(listed()).toEqual([
      'Northern Yellow Warbler', "Townsend's Warbler", 'Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)",
    ])
  })

  it('a query that is no listed bird\'s code gives the old rows in the old order', async () => {
    await loaded()
    render(<Host rows={ROWS} />)
    // The old filter, exactly: a lowercase substring over common names, in list order.
    const old = (q: string) => ROWS.filter(r => r.name.toLowerCase().includes(q)).map(r => r.name)
    for (const q of ['warbler', 'yellow', 'rob', "'s", 'american robin']) {
      type(q)
      expect(listed(), q).toEqual(old(q))
    }
    type('')
    expect(listed()).toEqual(ROWS.map(r => r.name))
  })

  it('the row cap applies AFTER ranking, so a code match past the cap still leads', async () => {
    await loaded()
    // Seventy fillers sort ahead of Snowy Owl and all contain "snow"; SNOW is
    // Snowy Owl's code. Capping before ranking would cut the owl.
    const fillers = Array.from({ length: 70 }, (_, i) => ({ name: `Snow Filler ${String(i).padStart(2, '0')}` }))
    const rows = [...fillers, { name: 'Snowy Owl', sciName: 'Bubo scandiacus' }]
    render(<Host rows={rows} />)
    type('snow')
    const names = listed()
    expect(names).toHaveLength(TARGET_SPECIES_ROW_CAP)
    expect(names[0]).toBe('Snowy Owl')
    expect(names.slice(1)).toEqual(fillers.slice(0, TARGET_SPECIES_ROW_CAP - 1).map(f => f.name))
  })

  it('a tick reports the row\'s own name, whichever group it was listed in', async () => {
    await loaded()
    const onToggle = vi.fn()
    render(<Host rows={ROWS} onToggle={onToggle} />)
    type('yrwa')
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    expect(onToggle).toHaveBeenCalledWith("Yellow-rumped Warbler (Audubon's)", true)
  })
})

describe('load on focus, never wait (FR-23, FR-24)', () => {
  it('nothing loads until the box is focused; focusing it starts the one load', () => {
    const importer = vi.fn(() => new Promise<Module>(() => {}))
    _setAlphaCodesImporterForTests(importer)
    render(<Host rows={ROWS} />)
    expect(importer).not.toHaveBeenCalled()
    fireEvent.focus(box())
    fireEvent.focus(box())
    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('while the codes are in flight the box matches names, and re-ranks the typed query when they land', async () => {
    let release!: () => void
    const gate = new Promise<void>(r => { release = r })
    _setAlphaCodesImporterForTests(async () => { await gate; return realModule() })
    render(<Host rows={ROWS} />)
    type('calypte')
    expect(listed()).toEqual(["Anna's Hummingbird"])
    type('yrwa')
    expect(listed()).toEqual([])
    await act(async () => { release(); await loadAlphaCodes() })
    expect(listed()).toEqual(['Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)"])
  })

  it('a failed load leaves name matching exactly as it was', async () => {
    _setAlphaCodesImporterForTests(() => Promise.reject(new Error('chunk failed')))
    render(<Host rows={ROWS} />)
    type('yrwa')
    await act(async () => { await loadAlphaCodes() })
    expect(listed()).toEqual([])
    type('warbler')
    expect(listed()).toEqual(ROWS.filter(r => r.name.includes('Warbler')).map(r => r.name))
  })
})
