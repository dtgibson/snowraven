// @vitest-environment jsdom
//
// Locks the accessibility shape of the List Comparer's comparison-mode switch:
// it is a role="group" of aria-pressed buttons (NOT a role="tablist" without
// panels or arrow-key support, F083), and the two-state "List A source" switch
// also exposes aria-pressed (F008). These are the regression-prone bits of the
// accessibility pass; the comparison logic is covered in lib/compare.test.ts.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// Seams used by ListComparer and its ChecklistComparer child.
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({ ebird: { filename: 'x.csv', uploadedAt: '' }, ml: null })),
    readFile: vi.fn(async () => null),
  },
}))
vi.mock('../lib/transport', () => ({
  transport: { get: vi.fn(), post: vi.fn(async () => ({ codes: {} })) },
  TransportError: class extends Error {},
}))

import { ListComparer } from './ListComparer'

const props = { onOpenSpecies: undefined, keyStatus: null, onGoToSettings: () => {} }

afterEach(cleanup)

describe('ListComparer — comparison-mode switch a11y', () => {
  it('exposes the mode switch as a role="group", not a tablist (F083)', () => {
    render(<ListComparer {...props} />)
    expect(screen.getByRole('group', { name: 'Comparison mode' })).toBeTruthy()
    // The misused tab semantics are gone.
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('marks the active mode with aria-pressed (F083)', () => {
    render(<ListComparer {...props} />)
    const lists = screen.getByRole('button', { name: 'Life Lists' })
    const checklists = screen.getByRole('button', { name: 'Checklists' })
    expect(checklists.getAttribute('aria-pressed')).toBe('true')   // default mode
    expect(lists.getAttribute('aria-pressed')).toBe('false')
  })

  it('renders Checklists on the left side of the mode switch', () => {
    render(<ListComparer {...props} />)
    const buttons = screen.getAllByRole('button').map(button => button.textContent)
    expect(buttons.slice(0, 2)).toEqual(['Checklists', 'Life Lists'])
  })

  it('exposes the List A source toggle as a pressed-state group (F008)', async () => {
    render(<ListComparer {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Life Lists' }))
    // The source switch only shows when a stored backup is available.
    const myList = await screen.findByRole('button', { name: 'My List' })
    expect(screen.getByRole('group', { name: 'List A source' })).toBeTruthy()
    expect(myList.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Upload a file' }).getAttribute('aria-pressed')).toBe('false')
  })
})
