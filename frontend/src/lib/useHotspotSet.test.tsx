// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { useHotspotSet } from './useHotspotSet'
import { invalidateHotspotSet } from './hotspotSet'

// Use the REAL invalidation/epoch/subscribe plumbing, but stub loadHotspotSet so the
// test controls which Set resolves — so we can prove the hook refreshes on an
// invalidation (the eBird key/file-change recovery the two high findings were about).
let nextSet: Set<string> = new Set()
vi.mock('./hotspotSet', async (importActual) => {
  const actual = await importActual<typeof import('./hotspotSet')>()
  return { ...actual, loadHotspotSet: () => Promise.resolve(nextSet) }
})

afterEach(() => { cleanup(); nextSet = new Set() })

function Probe({ id }: { id: string }) {
  const { isHotspot } = useHotspotSet()
  return <span data-testid="probe">{isHotspot(id) ? 'public' : 'plain'}</span>
}

describe('useHotspotSet', () => {
  it('starts plain (empty Set) and flips to public once the Set resolves', async () => {
    nextSet = new Set(['L1'])
    render(<Probe id="L1" />)
    // Empty until the load resolves — never a speculative link.
    expect(screen.getByTestId('probe').textContent).toBe('plain')
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('public'))
  })

  it('reloads on invalidation so a mounted tab picks up a key/file change', async () => {
    nextSet = new Set() // built empty first (e.g. no eBird key yet)
    render(<Probe id="L9" />)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('plain'))
    // Key added → Settings invalidates → the still-mounted hook reloads the new Set.
    nextSet = new Set(['L9'])
    invalidateHotspotSet()
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('public'))
  })
})
