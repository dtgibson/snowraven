// @vitest-environment jsdom
//
// Locks the accessibility shape of the Checklist Comparer's per-species cells
// after a comparison renders: the breeding-code badge is announced (role="img"
// + "<code> — <label>") and uses a per-tier text color that passes contrast
// (F004), the media-presence icons are announced with a pluralized name
// matching the tooltip (F035), and each In Both side cell carries an A/B tag
// (shown only ≤640 so wrapped cells stay labeled, F074). The comparison logic
// itself is covered in lib/compareChecklists.test.ts.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import type { ChecklistData } from '../lib/compareChecklists'
import { TransportError } from '../lib/transport'
import * as gate from '../lib/ebirdGate'
import * as rateLimit from '../lib/rateLimit'

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
  // The two lookups ride the shared eBird gate (ebird-request-economy D-01),
  // whose state is module-scoped, so it is reset per test and its spacing
  // zeroed for every row but the gate rows (the Projects suites' posture).
  gate._resetEbirdGateForTests()
  rateLimit._setActivityStartSpacingMsForTests(0)
})
afterEach(() => {
  cleanup()
  rateLimit._setActivityStartSpacingMsForTests(rateLimit.ACTIVITY_START_SPACING_DEFAULT_MS)
})

async function compare() {
  const utils = render(<ChecklistComparer {...props} />)
  // Two inputs (A and B) share the same placeholder.
  const inputs = screen.getAllByPlaceholderText(/S12345678/)
  fireEvent.change(inputs[0], { target: { value: 'S111' } })
  fireEvent.change(inputs[1], { target: { value: 'S222' } })
  fireEvent.click(screen.getByRole('button', { name: /compare checklists/i }))
  await waitFor(() => expect(screen.getByText('In Both')).toBeTruthy())
  return utils
}

describe('ChecklistComparer — per-species cell a11y', () => {
  it('announces the breeding badge as an image with code and label (F004)', async () => {
    await compare()
    // NY → "Recently..."? NY is "Nest with Young". role="img" makes the label reliable.
    const badge = screen.getByRole('img', { name: 'NY: Nest with Young' })
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

  it('shows each media count as visible text next to its icon (#27, .sr-media-count, ≤640)', async () => {
    const { container } = await compare()
    // 2 photos + 1 audio on side A → the counts appear as visible text (revealed
    // on the ≤640 phone tier where the hover-only title never fires). aria-hidden
    // so the wrapping icon's "2 photos" label isn't doubled by the bare number.
    const counts = Array.from(container.querySelectorAll('.sr-media-count'))
    expect(counts.map(c => c.textContent)).toEqual(['2', '1'])
    counts.forEach(c => expect(c.getAttribute('aria-hidden')).toBe('true'))
  })

  it('tags each In Both side cell with an A/B label (shown only ≤640 via .sr-sidecell-tag)', async () => {
    const { container } = await compare()
    // One shared species → one A cell + one B cell, each carrying an identifying
    // tag so the cluster stays labeled when the fixed-width cells wrap under the
    // name on a phone / at 200% text scale (audit F074). Hidden ≥640 by the class.
    const tags = Array.from(container.querySelectorAll('.sr-sidecell-tag'))
    expect(tags.map(t => t.textContent)).toEqual(['A', 'B'])
  })
})

// breeding-code-lookup-hasown: the API breeding code is an unvalidated string.
// These twelve are the names a bare index on an ordinary object literal resolves
// to an inherited member: `__proto__` took the whole app down, and the other
// eleven drew an empty pill named after JavaScript source. Each must render as
// an unknown code does, the pill reading the raw code and named `<code>: <code>`.
const PROTOTYPE_CHAIN = [
  'constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty',
  'isPrototypeOf', 'toLocaleString', 'propertyIsEnumerable',
  '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
]

// Side A's checklist carrying `code`, put through JSON.parse the way it arrives.
function serveSideABreedingCode(code: string) {
  const wire = JSON.parse(JSON.stringify({
    ...dataA, species: [{ ...dataA.species[0], breedingCode: code }],
  })) as ChecklistData
  getMock.mockImplementation((path: string) =>
    path.includes('S111') ? Promise.resolve(wire) : Promise.resolve(dataB),
  )
}

describe('ChecklistComparer: inherited member names as breeding codes', () => {
  it.each(PROTOTYPE_CHAIN)('renders %s as an unknown code, named "<code>: <code>"', async name => {
    serveSideABreedingCode(name)
    await compare()
    const badge = screen.getByRole('img', { name: `${name}: ${name}` })
    expect(badge.textContent).toBe(name)
    expect(badge.getAttribute('title')).toBe(`${name}: ${name}`)
    expect(badge.getAttribute('style')).toContain('var(--sr-tier-1-text)')
  })

  it('control: a known API code through the same parsed payload renders its display def', async () => {
    // API FY is display CF (Carrying Food), so the helper really reaches the badge.
    serveSideABreedingCode('FY')
    await compare()
    const badge = screen.getByRole('img', { name: 'CF: Carrying Food' })
    expect(badge.textContent).toBe('CF')
    expect(badge.getAttribute('style')).toContain('var(--sr-tier-4-text)')
  })
})

// ── The shared eBird gate (ebird-request-economy D-01) ───────────────────────
//
// The tab is a self-enforcing point over the gate's key-global state: each of
// its two checklist lookups is wrapped in `gatedEbirdCall`, because
// `/checklists/` is not in the transport's EBIRD_GATED_PATHS. Observed at the
// CLIENT, as request starts on a fake clock (the v0.5.92 pacing rows).
describe('ChecklistComparer: the shared eBird gate (ebird-request-economy D-01)', () => {
  const SPACING = rateLimit.ACTIVITY_START_SPACING_DEFAULT_MS
  const starts: Array<{ id: string; at: number }> = []

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(1_750_000_000_000)
    rateLimit._setActivityStartSpacingMsForTests(SPACING)
    starts.length = 0
  })
  afterEach(() => { vi.useRealTimers() })

  /** Serve both checklists, answering `S111` with `limitedA` 429s first. */
  function serve(limitedA: number, retryAfterSec?: number): void {
    let left = limitedA
    getMock.mockImplementation(async (path: string) => {
      const id = path.slice('/checklists/'.length)
      starts.push({ id, at: Date.now() })
      if (id === 'S111' && left > 0) {
        left -= 1
        throw new TransportError('HTTP 429', 429, rateLimit.EBIRD_RATE_LIMIT_DETAIL, retryAfterSec)
      }
      return id === 'S111' ? dataA : dataB
    })
  }

  async function advance(ms: number): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
  }

  function press(): void {
    render(<ChecklistComparer {...props} />)
    const inputs = screen.getAllByPlaceholderText(/S12345678/)
    fireEvent.change(inputs[0], { target: { value: 'S111' } })
    fireEvent.change(inputs[1], { target: { value: 'S222' } })
    fireEvent.click(screen.getByRole('button', { name: /compare checklists/i }))
  }

  it('the two lookups start at least the spacing floor apart, and share it with another lookup on the key', async () => {
    serve(0)
    // Another enforcement point on the same key, started first.
    let otherAt = -1
    const other = gate.gatedEbirdCall(async () => { otherAt = Date.now() })
    press()
    await advance(4 * SPACING)
    await other
    expect(screen.getByText('In Both')).toBeTruthy()
    expect(starts.map(s => s.id)).toEqual(['S111', 'S222'])
    const all = [otherAt, ...starts.map(s => s.at)].sort((x, y) => x - y)
    expect(all).toHaveLength(3)
    for (let i = 1; i < all.length; i += 1) {
      expect(all[i] - all[i - 1], `start ${i}`).toBeGreaterThanOrEqual(SPACING)
    }
  })

  it('a 429 opens the shared cooldown: nothing starts inside it, and the lookup is retried and the comparison shown', async () => {
    serve(1, 2)
    press()
    await advance(10)
    const { cooldownUntil, waveCount } = gate.ebirdGateState()
    expect(waveCount).toBe(1)
    expect(cooldownUntil).toBeGreaterThanOrEqual(starts[0].at + 2000)
    await advance(5_000)
    expect(screen.getByText('In Both')).toBeTruthy()
    expect(starts.filter(s => s.id === 'S111')).toHaveLength(2)
    for (const s of starts.slice(1)) expect(s.at, s.id).toBeGreaterThanOrEqual(cooldownUntil)
  })

  it('still rate limited after two retries: three requests in all, and the error display shows the shared sentence', async () => {
    serve(Number.POSITIVE_INFINITY, 1)
    press()
    await advance(20_000)
    expect(starts.filter(s => s.id === 'S111')).toHaveLength(1 + rateLimit.ACTIVITY_RATE_LIMIT_RETRIES)
    expect(screen.getByText(rateLimit.EBIRD_RATE_LIMIT_DETAIL)).toBeTruthy()
    expect(screen.queryByText('In Both')).toBeNull()
  })
})
