// @vitest-environment jsdom
//
// Species code search in the shared picker (species-code-search; PRD QA-23,
// QA-24, QA-30 to QA-34, QA-36). The code data is driven through the loader's
// importer seam so each row controls when, and whether, it arrives; the table
// itself is always the REAL committed asset.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react'
import { SpeciesCombobox, type SpeciesComboboxOption } from './SpeciesCombobox'
import { _resetAlphaCodesForTests, _setAlphaCodesImporterForTests, loadAlphaCodes } from '../lib/alphaCodesAsset'

type Module = { default: unknown }
const realModule = () => import('../assets/ebird-alpha-codes.json') as Promise<Module>

/** An importer the test releases by hand. */
function deferredImporter() {
  let release!: () => Promise<void>
  let calls = 0
  const gate = new Promise<void>(resolve => {
    release = async () => { resolve(); await act(async () => { await loadAlphaCodes() }) }
  })
  _setAlphaCodesImporterForTests(async () => { calls += 1; await gate; return realModule() })
  return { release, calls: () => calls }
}

beforeEach(() => _resetAlphaCodesForTests())
afterEach(() => { cleanup(); _resetAlphaCodesForTests() })

function renderCombo(options: SpeciesComboboxOption[], extra: Partial<React.ComponentProps<typeof SpeciesCombobox>> = {}) {
  const onChange = vi.fn()
  render(<SpeciesCombobox options={options} value={null} onChange={onChange} ariaLabel="Select species" {...extra} />)
  const input = screen.getByRole('combobox', { name: 'Select species' }) as HTMLInputElement
  return { onChange, input }
}
const optionNames = () => {
  const listbox = screen.queryByRole('listbox')
  return listbox ? within(listbox).queryAllByRole('option').map(o => o.querySelector('.sr-truncate')?.textContent ?? '') : []
}
async function loaded() {
  _setAlphaCodesImporterForTests(realModule)
  await act(async () => { await loadAlphaCodes() })
}
const type = (input: HTMLInputElement, value: string) => {
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
}

describe('code matches in the picker', () => {
  it('"All species" stays first and code matches follow it (QA-23, FR-16)', async () => {
    await loaded()
    const { input } = renderCombo(
      [{ name: 'American Robin' }, { name: 'Northern Yellow Warbler' }, { name: 'Yellow-rumped Warbler' }],
      { allLabel: 'All species' },
    )
    type(input, 'yrwa')
    expect(optionNames()).toEqual(['All species', 'Yellow-rumped Warbler'])
  })

  it('each group keeps the order the call site handed in (QA-24, FR-13)', async () => {
    await loaded()
    // Taxonomic, not alphabetical: alphabetical would put Cackling first and
    // Snow Bunting before Snow Goose.
    const { input } = renderCombo([
      { name: 'Canada Goose' }, { name: 'Cackling Goose' }, { name: 'Snow Goose' }, { name: 'Snowy Owl' }, { name: 'Snow Bunting' },
    ])
    type(input, 'cago')
    expect(optionNames()).toEqual(['Canada Goose', 'Cackling Goose'])
    fireEvent.change(input, { target: { value: 'snow' } })
    expect(optionNames()).toEqual(['Snowy Owl', 'Snow Goose', 'Snow Bunting'])
  })

  it('Enter with nothing highlighted picks the first code match, never "All species" (FR-17)', async () => {
    await loaded()
    const { input, onChange } = renderCombo(
      [{ name: 'Snow Goose' }, { name: 'Snowy Owl' }], { allLabel: 'All species' },
    )
    type(input, 'snow')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Snowy Owl')
  })

  it('a row found by code looks exactly like the same row found by name (QA-30, FR-22)', async () => {
    await loaded()
    const { input } = renderCombo([{ name: 'American Robin', sciName: 'Turdus migratorius' }])
    type(input, 'amro')
    const byCode = within(screen.getByRole('listbox')).getAllByRole('option')[0].outerHTML
    fireEvent.change(input, { target: { value: 'robin' } })
    const byName = within(screen.getByRole('listbox')).getAllByRole('option')[0].outerHTML
    expect(byCode).toBe(byName)
  })

  it('hostile option names render, take no codes, and leave codes working (QA-36)', async () => {
    await loaded()
    const hostile = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']
    const { input } = renderCombo([...hostile.map(name => ({ name })), { name: 'Yellow-rumped Warbler' }])
    type(input, 'yrwa')
    expect(optionNames()).toEqual(['Yellow-rumped Warbler'])
    fireEvent.change(input, { target: { value: 'proto' } })
    expect(optionNames()).toEqual(['__proto__'])
    fireEvent.change(input, { target: { value: 'constructor' } })
    expect(optionNames()).toEqual(['constructor'])
  })
})

describe('never wait, and failure (QA-31, QA-34)', () => {
  const OPTIONS = [{ name: "Anna's Hummingbird", sciName: 'Calypte anna' }, { name: 'Yellow-rumped Warbler' }]

  it('a load that never settles leaves the picker matching names as today (QA-31)', async () => {
    _setAlphaCodesImporterForTests(() => new Promise<Module>(() => {}))
    const { input } = renderCombo(OPTIONS)
    type(input, 'calypte')
    expect(optionNames()).toEqual(["Anna's Hummingbird"])
    fireEvent.change(input, { target: { value: 'yrwa' } })
    expect(optionNames()).toEqual([])
    expect(screen.getByText('No species match this search.')).toBeTruthy()
  })

  it.each([
    ['a rejected import', () => Promise.reject(new Error('chunk failed'))],
    ['a wrong shape', async () => ({ default: { v: 9 } })],
  ])('%s: names only, no message, no retry (QA-34)', async (_label, importer) => {
    let calls = 0
    _setAlphaCodesImporterForTests(() => { calls += 1; return importer() as Promise<Module> })
    const { input } = renderCombo(OPTIONS)
    type(input, 'yrwa')
    await act(async () => { await loadAlphaCodes() })
    expect(optionNames()).toEqual([])
    fireEvent.change(input, { target: { value: 'warbler' } })
    expect(optionNames()).toEqual(['Yellow-rumped Warbler'])
    expect(document.querySelector('[role="alert"], [role="status"]')).toBeNull()
    fireEvent.blur(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    type(input, 'yrwa')
    await act(async () => { await loadAlphaCodes() })
    expect(calls).toBe(1)
  })

  it('nothing loads until a picker opens, and once across opens and keystrokes (QA-32)', async () => {
    let calls = 0
    _setAlphaCodesImporterForTests(() => { calls += 1; return realModule() })
    render(
      <>
        {['One', 'Two', 'Three'].map(label => (
          <SpeciesCombobox key={label} options={OPTIONS} value={null} onChange={() => {}} ariaLabel={label} />
        ))}
      </>,
    )
    expect(calls).toBe(0)
    // Opening a picker is what starts the load: nothing in this test calls the
    // loader before this line.
    fireEvent.focus(screen.getByRole('combobox', { name: 'One' }))
    expect(calls).toBe(1)
    for (const label of ['One', 'Two', 'Three']) {
      const input = screen.getByRole('combobox', { name: label }) as HTMLInputElement
      for (const v of ['y', 'yr', 'yrw', 'yrwa']) type(input, v)
      fireEvent.keyDown(input, { key: 'Escape' })
    }
    await act(async () => { await loadAlphaCodes() })
    expect(calls).toBe(1)
  })
})

describe('the code data arriving while the picker is open (QA-33, FR-25)', () => {
  it('rows update for the typed query without retyping', async () => {
    const { release } = deferredImporter()
    const { input } = renderCombo([{ name: 'Northern Yellow Warbler' }, { name: 'Yellow-rumped Warbler' }])
    type(input, 'yrwa')
    expect(optionNames()).toEqual([])
    await release()
    expect(optionNames()).toEqual(['Yellow-rumped Warbler'])
  })

  it('a highlighted species row is cleared when the rows change, so it never moves to another bird', async () => {
    const { release } = deferredImporter()
    const { input, onChange } = renderCombo([{ name: 'Snow Goose' }, { name: 'Snowy Owl' }, { name: 'Snow Bunting' }])
    type(input, 'snow')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy()
    await release()
    expect(optionNames()).toEqual(['Snowy Owl', 'Snow Goose', 'Snow Bunting'])
    expect(input.getAttribute('aria-activedescendant')).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Snowy Owl')
  })

  it('a highlighted "All species" row keeps its highlight', async () => {
    const { release } = deferredImporter()
    const { input } = renderCombo([{ name: 'Snow Goose' }, { name: 'Snowy Owl' }], { allLabel: 'All species' })
    type(input, 'snow')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const before = input.getAttribute('aria-activedescendant')
    expect(before).toBeTruthy()
    await release()
    expect(input.getAttribute('aria-activedescendant')).toBe(before)
    expect(document.getElementById(before!)?.textContent).toContain('All species')
  })

  it('when the rows do not change, nothing changes, the highlight included', async () => {
    const { release } = deferredImporter()
    const { input } = renderCombo([{ name: "Anna's Hummingbird", sciName: 'Calypte anna' }, { name: "Costa's Hummingbird", sciName: 'Calypte costae' }])
    type(input, 'calypte')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const before = input.getAttribute('aria-activedescendant')
    await release()
    expect(input.getAttribute('aria-activedescendant')).toBe(before)
    expect(document.getElementById(before!)?.textContent).toContain("Costa's Hummingbird")
  })
})
