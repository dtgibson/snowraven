// @vitest-environment jsdom
//
// Locks the accessibility shape of the Checklist Comparer's per-species cells
// after a comparison renders: the breeding-code badge is announced (role="img"
// + "<code> — <label>") and uses a per-tier text color that passes contrast
// (F004), and the media-presence icons are announced with a pluralized name
// matching the tooltip (F035). The comparison logic itself is covered in
// lib/compareChecklists.test.ts.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import type { ChecklistData } from '../lib/compareChecklists'

const getMock = vi.fn()
vi.mock('../lib/transport', async (orig) => {
  const actual = await orig<typeof import('../lib/transport')>()
  return { ...actual, transport: { get: (...a: unknown[]) => getMock(...a), post: vi.fn() } }
})
vi.mock('../lib/storage', () => ({
  storage: { readFile: vi.fn(async () => null) },
}))

import { ChecklistComparer } from './ChecklistComparer'

const meta = {
  locName: 'Marsh', obsDt: '2024-05-01 06:30', protocolId: '', durationHrs: null,
  distanceKm: null, distanceUnit: '', numObservers: null, submissionMethod: '', submissionVersion: '', comments: '',
}

// A shared species (NY = display "Nest with Young", tier 4) with photo+audio
// media on side A, so both the breeding badge and the media icons render.
const dataA: ChecklistData = {
  ...meta,
  species: [{
    speciesCode: 'amerob', commonName: 'American Robin', count: '3',
    breedingCode: 'NY', comments: '', media: { photo: 2, audio: 1, video: 0 },
  }],
}
const dataB: ChecklistData = {
  ...meta, locName: 'Pond',
  species: [{
    speciesCode: 'amerob', commonName: 'American Robin', count: '1',
    breedingCode: '', comments: '', media: { photo: 0, audio: 0, video: 0 },
  }],
}

const props = { onOpenSpecies: undefined, keyStatus: null, onGoToSettings: () => {} }

beforeEach(() => {
  getMock.mockReset()
  getMock.mockImplementation((path: string) =>
    path.includes('S111') ? Promise.resolve(dataA) : Promise.resolve(dataB),
  )
})
afterEach(cleanup)

async function compare() {
  render(<ChecklistComparer {...props} />)
  // Two inputs (A and B) share the same placeholder.
  const inputs = screen.getAllByPlaceholderText(/S12345678/)
  fireEvent.change(inputs[0], { target: { value: 'S111' } })
  fireEvent.change(inputs[1], { target: { value: 'S222' } })
  fireEvent.click(screen.getByRole('button', { name: /compare checklists/i }))
  await waitFor(() => expect(screen.getByText('In Both')).toBeTruthy())
}

describe('ChecklistComparer — per-species cell a11y', () => {
  it('announces the breeding badge as an image with code and label (F004)', async () => {
    await compare()
    // NY → "Recently..."? NY is "Nest with Young". role="img" makes the label reliable.
    const badge = screen.getByRole('img', { name: 'NY — Nest with Young' })
    expect(badge).toBeTruthy()
    // Uses the per-tier text token (tier 4), never the old flat --sr-on-accent.
    expect(badge.getAttribute('style')).toContain('var(--sr-tier-4-text)')
    expect(badge.getAttribute('style')).not.toContain('--sr-on-accent')
  })

  it('announces media icons with a pluralized name matching the tooltip (F035)', async () => {
    await compare()
    // 2 photos + 1 audio on side A.
    expect(screen.getByRole('img', { name: '2 photos' })).toBeTruthy()
    const audio = screen.getByRole('img', { name: '1 audio' })
    expect(audio).toBeTruthy()
    expect(audio.getAttribute('title')).toBe('1 audio')
  })
})
