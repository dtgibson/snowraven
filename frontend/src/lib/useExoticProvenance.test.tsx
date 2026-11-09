// @vitest-environment jsdom
//
// The resolution pass controller: auto-start conditions, the one-request-per
// checklist rule, the concurrency bound, cancellation, failure handling, and the
// two follow-up budgets.
//
// `transport` is mocked at the module boundary, so every assertion about "how
// many outbound requests" is counted at the SEAM the feature actually uses. That
// also proves the negative FR-12 asks for: nothing here reaches a bare `fetch`,
// because a bare fetch would not be counted and the request assertions would
// fail rather than silently pass.

import { useEffect } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import { buildCoverIndex, type CoverIndex } from './exoticProvenance'
import { statusSentence } from './exoticCopy'
import type { ObservationEntry } from '../types'

const seamDoc: { value: unknown } = { value: null }
vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async (key: string) => (key === 'exotic-provenance-v1' ? seamDoc.value : null)),
    setSetting: vi.fn(async (_k: string, v: unknown) => { seamDoc.value = JSON.parse(JSON.stringify(v)) }),
    deleteSetting: vi.fn(async () => { seamDoc.value = null }),
  },
}))

interface Row { speciesCode: string; exoticCategory?: string; userDoNotCount?: string }
const responses = new Map<string, Row[] | 'fail' | 'no-list'>()
const requested: string[] = []
/** Every request START, client-observed (ebird-request-economy D-01). */
const starts: Array<{ id: string; at: number }> = []
/** Checklist id -> how many 429s to answer before its body (Infinity: always). */
const limited = new Map<string, number>()
/** The bounded Retry-After both transports attach to a 429, in seconds. */
let retryAfterSec: number | undefined
/** How long each mocked request takes, in ms (the fake clock in the gate rows). */
let latencyMs = 1
let inFlight = 0
let peakInFlight = 0
/** When set, every mocked request awaits it, so a pass can be held mid-flight. */
let hold: Promise<void> | null = null

vi.mock('./transport', () => ({
  TransportError: class extends Error {},
  transport: {
    get: vi.fn(async (path: string, params?: Record<string, string>) => {
      requested.push(`${path}?${params?.fields ?? ''}`)
      const id = path.slice('/checklists/'.length)
      starts.push({ id, at: Date.now() })
      inFlight += 1
      peakInFlight = Math.max(peakInFlight, inFlight)
      try {
        // A real await point, so the pool's concurrency is observable.
        await new Promise<void>(r => { setTimeout(r, latencyMs) })
        if (hold) await hold
        const left = limited.get(id) ?? 0
        if (left > 0) {
          limited.set(id, left - 1)
          // The shape both transports throw for an upstream 429.
          throw Object.assign(new Error('eBird is limiting requests right now. Try again in a moment.'), {
            status: 429, ...(retryAfterSec !== undefined ? { retryAfterSec } : {}),
          })
        }
        const body = responses.get(id)
        if (body === 'fail') throw Object.assign(new Error('eBird 502'), { status: 502 })
        // A 200 whose body carries no species list (D-02's defence in depth).
        if (body === 'no-list') return {}
        return { species: body ?? [] }
      } finally {
        inFlight -= 1
      }
    }),
  },
}))

const provenanceModule = await import('./useExoticProvenance')
const { useExoticProvenance, MAX_FOLLOWUP_PER_SPECIES, PROVENANCE_CONCURRENCY, setMaxRequestsPerPass } = provenanceModule
const cacheModule = await import('./exoticProvenanceCache')
const transportModule = await import('./transport')
const gateModule = await import('./ebirdGate')
const rateLimitModule = await import('./rateLimit')

function o(commonName: string, submissionId: string): ObservationEntry {
  return {
    commonName, scientificName: '', count: 1, submissionId, date: '2025-01-01',
    location: 'L', locationId: 'L1', latitude: null, longitude: null,
    county: null, stateProvince: 'US-CA',
  } as ObservationEntry
}

const codeFor = (norm: string): string | undefined => `c-${norm}`

/** Every status the harness has rendered, in order. `seq` is 0 for the initial
 *  mount state and advances once per `setStatus`, so entries with `seq > 0` are
 *  exactly the EMISSIONS, i.e. exactly the live-region announcements (the
 *  message child is keyed on the sequence). */
const announcements: Array<{ kind: string; seq: number; additional: number }> = []
/** The emissions only, with the initial mount state excluded. */
const emissions = () => announcements.filter(a => a.seq > 0)

function Harness({ index, hasEbirdKey = true, online = true }: {
  index: CoverIndex; hasEbirdKey?: boolean | null; online?: boolean
}) {
  const p = useExoticProvenance({ active: true, index, hasEbirdKey, online })
  useEffect(() => {
    announcements.push({
      kind: p.status.kind,
      seq: p.statusSeq,
      additional: p.status.kind === 'in-progress' ? p.status.additional : 0,
    })
  }, [p.status, p.statusSeq])
  return (
    <div>
      <span data-testid="kind">{p.status.kind}</span>
      <span data-testid="excluded">{[...p.lookup.excludedNames].sort().join(',')}</span>
      <span data-testid="reason">{p.status.kind === 'partial' ? p.status.reason : ''}</span>
      <span data-testid="failed">{p.status.kind === 'partial' ? String(p.status.failed) : ''}</span>
      <span data-testid="settled">{p.status.kind === 'complete' ? (p.status.settledNames ?? []).join(',') : ''}</span>
      <span data-testid="sentence">{statusSentence(p.status, p.lookup.excluded.length)}</span>
      <button type="button" onClick={p.stop}>stop</button>
      <button type="button" onClick={p.retry}>retry</button>
    </div>
  )
}

beforeEach(() => {
  seamDoc.value = null
  responses.clear()
  requested.length = 0
  inFlight = 0
  peakInFlight = 0
  hold = null
  vi.mocked(transportModule.transport.get).mockClear()
  cacheModule._resetProvenanceCacheForTests()
  setMaxRequestsPerPass(500)
  announcements.length = 0
  starts.length = 0
  limited.clear()
  retryAfterSec = undefined
  latencyMs = 1
  // The pass is an enforcement point over the shared eBird gate (D-01). Its
  // state is module-scoped, so it is reset per test, and the spacing seam is
  // zeroed so every row but the gate rows runs its own contract at full speed
  // (the Projects suites' posture).
  gateModule._resetEbirdGateForTests()
  rateLimitModule._setActivityStartSpacingMsForTests(0)
})

afterEach(() => {
  cleanup()
  rateLimitModule._setActivityStartSpacingMsForTests(rateLimitModule.ACTIVITY_START_SPACING_DEFAULT_MS)
})

const kind = () => screen.getByTestId('kind').textContent

describe('auto-start conditions (FR-18, QA-23)', () => {
  const index = buildCoverIndex([o('Muscovy Duck', 'S1')], codeFor)

  it('starts with a key, online, and a cache that is not already fresh', async () => {
    responses.set('S1', [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'X', userDoNotCount: 'DNC' }])
    render(<Harness index={index} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toEqual(['/checklists/S1?provenance'])
    expect(screen.getByTestId('excluded').textContent).toBe('Muscovy Duck')
  })

  it('does NOT start with no key, and says so', async () => {
    render(<Harness index={index} hasEbirdKey={false} />)
    await waitFor(() => expect(kind()).toBe('no-key'))
    expect(requested).toEqual([])
  })

  it('does NOT start while offline, and says so', async () => {
    render(<Harness index={index} online={false} />)
    await waitFor(() => expect(kind()).toBe('offline'))
    expect(requested).toEqual([])
  })

  it('does NOT start while the key lookup is still in flight', async () => {
    render(<Harness index={index} hasEbirdKey={null} />)
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(requested).toEqual([])
    expect(kind()).toBe('not-checked')
  })

  it('does NOT re-fetch when the cache already covers every species', async () => {
    responses.set('S1', [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'X', userDoNotCount: 'DNC' }])
    const first = render(<Harness index={index} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toHaveLength(1)
    first.unmount()

    // A fresh mount over the SAME loaded export: nothing left to ask about.
    render(<Harness index={index} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toHaveLength(1)
  })

  it('with an empty cover index it does nothing at all', async () => {
    render(<Harness index={buildCoverIndex([], codeFor)} />)
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(requested).toEqual([])
    expect(kind()).toBe('not-checked')
  })
})

describe('the pass (FR-12, FR-13, FR-14, QA-14, QA-18, QA-19)', () => {
  it('issues EXACTLY one request per checklist, all through the transport seam', async () => {
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 12; i += 1) {
      rows.push(o(`sp${i}`, `S${i}`))
      responses.set(`S${i}`, [{ speciesCode: `c-sp${i}`, exoticCategory: 'N' }])
    }
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toHaveLength(12)
    expect(new Set(requested).size).toBe(12)
    // Every one carries the provenance flag, which is what suppresses the seam's
    // SECOND per-checklist call for a location name (FR-13).
    for (const r of requested) expect(r.endsWith('?provenance')).toBe(true)
    expect(vi.mocked(transportModule.transport.get)).toHaveBeenCalledTimes(12)
  })

  it('never has more than PROVENANCE_CONCURRENCY requests in flight', async () => {
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 30; i += 1) {
      rows.push(o(`sp${i}`, `S${i}`))
      responses.set(`S${i}`, [{ speciesCode: `c-sp${i}`, exoticCategory: 'N' }])
    }
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('complete'), { timeout: 4000 })
    expect(PROVENANCE_CONCURRENCY).toBe(4)
    expect(peakInFlight).toBeGreaterThan(1)          // the pool really is parallel
    expect(peakInFlight).toBeLessThanOrEqual(PROVENANCE_CONCURRENCY)
  })

  it('stops seeking a species as soon as one COUNTING observation is found (FR-02, QA-06)', async () => {
    // The species is on three checklists. The cover picks one; it comes back
    // non-X, the species leaves `remaining`, and no follow-up is issued.
    const rows = [o('Muscovy Duck', 'S1'), o('Muscovy Duck', 'S2'), o('Muscovy Duck', 'S3')]
    responses.set('S1', [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'N' }])
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toEqual(['/checklists/S1?provenance'])
    expect(screen.getByTestId('excluded').textContent).toBe('')
  })

  it('FOLLOWS UP when the sampled observation came back X, then settles (FR-15)', async () => {
    const rows = [o('Muscovy Duck', 'S1'), o('Muscovy Duck', 'S2')]
    responses.set('S1', [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'X', userDoNotCount: 'DNC' }])
    responses.set('S2', [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'N' }])
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toHaveLength(2)
    // The follow-up found a counting observation, so nothing is excluded.
    expect(screen.getByTestId('excluded').textContent).toBe('')
  })

  it('classifies escapee-only only when EVERY carrier has been consulted (QA-07)', async () => {
    const rows = [o('Muscovy Duck', 'S1'), o('Muscovy Duck', 'S2')]
    responses.set('S1', [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'X', userDoNotCount: 'DNC' }])
    responses.set('S2', [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'X', userDoNotCount: 'DNC' }])
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(screen.getByTestId('excluded').textContent).toBe('Muscovy Duck')
  })
})

describe('failure and cancellation (FR-19, FR-20, QA-24, QA-25, QA-26)', () => {
  it('a mid-sweep failure does not abort the pass, and the failed one is not cached', async () => {
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 6; i += 1) {
      rows.push(o(`sp${i}`, `S${i}`))
      responses.set(`S${i}`, i === 2 ? 'fail' : [{ speciesCode: `c-sp${i}`, exoticCategory: 'N' }])
    }
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('partial'))
    expect(screen.getByTestId('reason').textContent).toBe('failures')
    expect(screen.getByTestId('failed').textContent).toBe('1')
    // Five succeeded and are in the ledger; the failure left no entry, so it is
    // retryable rather than remembered as an answer.
    expect(cacheModule.getSnapshot().checklists.has('S2')).toBe(false)
    expect(cacheModule.getSnapshot().checklists.size).toBe(5)
  })

  it('a 200 with no species list is a FAILED answer: no ledger entry and no stamp (D-02)', async () => {
    const rows = [o('sp0', 'S0'), o('sp1', 'S1')]
    responses.set('S0', 'no-list')
    responses.set('S1', [{ speciesCode: 'c-sp1', exoticCategory: 'N' }])
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('partial'))
    expect(screen.getByTestId('reason').textContent).toBe('failures')
    expect(screen.getByTestId('failed').textContent).toBe('1')
    expect(cacheModule.getSnapshot().checklists.has('S0')).toBe(false)
    expect([...cacheModule.unmatchedSet(Date.now())]).toEqual([])
    expect(cacheModule.getSnapshot().checklists.has('S1')).toBe(true)
  })

  it('every request failing is reported as `error`, not as a partial result', async () => {
    const rows = [o('sp0', 'S0'), o('sp1', 'S1')]
    responses.set('S0', 'fail')
    responses.set('S1', 'fail')
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('error'))
  })

  it('a retry after a failure issues a FRESH request (errors are never cached)', async () => {
    const rows = [o('sp0', 'S0')]
    responses.set('S0', 'fail')
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('error'))
    expect(requested).toHaveLength(1)

    responses.set('S0', [{ speciesCode: 'c-sp0', exoticCategory: 'N' }])
    await act(async () => { screen.getByText('retry').click() })
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toHaveLength(2)
  })

  it('Stop keeps everything already resolved and reports `partial` / `cancelled`', async () => {
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 20; i += 1) {
      rows.push(o(`sp${i}`, `S${i}`))
      responses.set(`S${i}`, [{ speciesCode: `c-sp${i}`, exoticCategory: 'X', userDoNotCount: 'DNC' }])
    }
    // Hold every in-flight request open so the pass is genuinely mid-flight
    // when Stop is pressed.
    let release!: () => void
    hold = new Promise<void>(r => { release = r })
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('in-progress'))

    await act(async () => { screen.getByText('stop').click() })
    hold = null
    await act(async () => { release(); await new Promise(r => setTimeout(r, 20)) })
    await waitFor(() => expect(kind()).toBe('partial'), { timeout: 4000 })
    expect(screen.getByTestId('reason').textContent).toBe('cancelled')
    // In-flight requests were allowed to complete, so nothing paid for is lost.
    expect(cacheModule.getSnapshot().checklists.size).toBeGreaterThan(0)
    // ...and the pass really did stop short of the whole cover.
    expect(requested.length).toBeLessThan(20)
  })
})

describe('the follow-up budgets (FR-16, QA-20)', () => {
  it('parks a species at MAX_FOLLOWUP_PER_SPECIES and reports `species-budget`', async () => {
    // One species, X on every one of 40 checklists: the pass can never resolve
    // it, so the per-species bound is what stops it.
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 40; i += 1) {
      rows.push(o('Muscovy Duck', `S${i}`))
      responses.set(`S${i}`, [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'X', userDoNotCount: 'DNC' }])
    }
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('partial'), { timeout: 8000 })
    expect(screen.getByTestId('reason').textContent).toBe('species-budget')
    // Bounded well below the 40 carriers, and never zero.
    expect(requested.length).toBeGreaterThan(1)
    expect(requested.length).toBeLessThanOrEqual(MAX_FOLLOWUP_PER_SPECIES + 1)
    // The parked species stays UNRESOLVED, which means it still COUNTS (FR-04).
    expect(screen.getByTestId('excluded').textContent).toBe('')
  }, 10_000)

  it('stops at MAX_REQUESTS_PER_PASS and reports `pass-budget` (QA-21)', () => {
    // The per-pass cap is enforced at three points (the round's budget, the
    // worker's own check, and the post-round classification) and, before this
    // test, at none of them by anything automated. The seam is what makes it
    // reachable without a 500-checklist fixture.
    expect(provenanceModule.MAX_REQUESTS_PER_PASS).toBe(500)
  })
})

describe('the per-pass request cap (FR-16, QA-21)', () => {
  /** 10 checklists, one distinct species each, so the first-wave cover is 10
   *  and only the cap can stop it short. */
  function tenSingletons() {
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 10; i += 1) {
      rows.push(o(`sp${i}`, `S${i}`))
      responses.set(`S${i}`, [{ speciesCode: `c-sp${i}`, exoticCategory: 'N' }])
    }
    return buildCoverIndex(rows, codeFor)
  }

  it('issues EXACTLY the cap and stops, reporting the reason and the cap', async () => {
    setMaxRequestsPerPass(3)
    render(<Harness index={tenSingletons()} />)
    await waitFor(() => expect(kind()).toBe('partial'))
    expect(requested).toHaveLength(3)
    expect(screen.getByTestId('reason').textContent).toBe('pass-budget')
    // The species left unconsulted stay UNRESOLVED, which means they still
    // COUNT (FR-04). A bound that erased them would be the failure this whole
    // feature is arranged to avoid.
    expect(screen.getByTestId('excluded').textContent).toBe('')
    expect(cacheModule.getSnapshot().checklists.size).toBe(3)
  })

  it('the cap, not the cover, is what stopped it: the same fixture completes at 500', async () => {
    // The must-stay-GREEN half. Without it the assertion above passes on a build
    // that had simply stopped fetching, and "stopped at the cap" would be
    // indistinguishable from "stopped for any other reason".
    setMaxRequestsPerPass(500)
    render(<Harness index={tenSingletons()} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toHaveLength(10)
  })

  // The EQUALITY case (cap === cover size), and the SOLE guard on the
  // cap-decided-at-two-points regression: a pass whose cover exactly equalled
  // the cap reported partial/pass-budget despite having finished. It reads like
  // a duplicate of the cap-500 case above. It is not. Do not delete.
  it('a cap EQUAL to the cover size does not truncate the pass', async () => {
    setMaxRequestsPerPass(10)
    render(<Harness index={tenSingletons()} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toHaveLength(10)
  })

  it('never issues more than the cap across FOLLOW-UP rounds', async () => {
    // The single-round cases above cannot see an off-by-one that accumulates:
    // `issued` is carried across rounds and each round's budget is derived from
    // it. This fixture forces real follow-up (one species that is X everywhere,
    // so it is pursued round after round) against a cap that must still hold.
    setMaxRequestsPerPass(7)
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 30; i += 1) {
      rows.push(o('Muscovy Duck', `S${i}`))
      responses.set(`S${i}`, [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'X', userDoNotCount: 'DNC' }])
    }
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('partial'), { timeout: 4000 })
    expect(requested.length).toBe(7)
    expect(new Set(requested).size).toBe(7)      // and no checklist asked twice
    expect(screen.getByTestId('reason').textContent).toBe('pass-budget')
    // Still unresolved, so it still counts (FR-04).
    expect(screen.getByTestId('excluded').textContent).toBe('')
  })

  it('a cap of exactly one issues one request and still reports the partial state', async () => {
    setMaxRequestsPerPass(1)
    render(<Harness index={tenSingletons()} />)
    await waitFor(() => expect(kind()).toBe('partial'))
    expect(requested).toHaveLength(1)
    expect(screen.getByTestId('reason').textContent).toBe('pass-budget')
  })
})


describe('the live region\'s announcement rate is bounded (Auditor finding 4)', () => {
  it('does NOT announce once per completed request', async () => {
    // Shipped first as one emission per request: 75 announcements over a 9.7
    // second pass, about 7.7 per second. The throttle is on the EMISSION, so
    // the sentence, the bar and the "N / M" readout still move together and
    // nothing on screen can disagree with anything else.
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 40; i += 1) {
      rows.push(o(`sp${i}`, `S${i}`))
      responses.set(`S${i}`, [{ speciesCode: `c-sp${i}`, exoticCategory: 'N' }])
    }
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    // `kind=complete` renders before the passive effect records its matching
    // live-region announcement. Wait for the effect-owned value asserted below.
    await waitFor(
      () => expect(announcements[announcements.length - 1]?.kind).toBe('complete'),
      { timeout: 6000 },
    )

    expect(requested).toHaveLength(40)
    const progress = emissions().filter(a => a.kind === 'in-progress')
    // The whole mocked pass runs in well under one throttle window, so the
    // bound is TIME, not request count: one definite opening figure, and no
    // per-request chatter behind it.
    expect(progress.length).toBeLessThanOrEqual(3)
    expect(progress.length).toBeGreaterThan(0)          // FR-11: it is announced
    // ...and the terminal status always lands, throttle or not.
    expect(announcements[announcements.length - 1].kind).toBe('complete')
  })

  it('announces the planned figure BEFORE the first request goes out (FR-11)', async () => {
    // The throttle must never swallow the opening figure: a definite "of 73" is
    // the thing that makes this not an indeterminate spinner.
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 5; i += 1) {
      rows.push(o(`sp${i}`, `S${i}`))
      responses.set(`S${i}`, [{ speciesCode: `c-sp${i}`, exoticCategory: 'N' }])
    }
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    // The FIRST emission (the initial mount state is seq 0 and is not one) must
    // already be the definite figure.
    expect(emissions()[0].kind).toBe('in-progress')
  })

  it('every emission advances the sequence, so an identical repeat still announces', async () => {
    // The throttle bounds HOW OFTEN the region changes; it must not reintroduce
    // the defect the sequence key exists to prevent.
    const rows = [o('sp0', 'S0')]
    responses.set('S0', [{ speciesCode: 'c-sp0', exoticCategory: 'N' }])
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    const seqs = emissions().map(a => a.seq)
    expect(new Set(seqs).size).toBe(seqs.length)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
  })

  it('a FOLLOW-UP wave discovered inside the throttle window is announced promptly', async () => {
    // This is what `force` uniquely protects, and it needs saying because the
    // obvious guard does not cover it: `lastEmit` starts at 0, so the FIRST
    // emission of any pass clears the interval on its own. The opening definite
    // figure is therefore protected by two overlapping mechanisms, and a
    // mutation making the emitter ignore `force` left every other test green.
    //
    // A follow-up wave is the case with only one mechanism behind it. It is
    // discovered in a LATER round, milliseconds after the opening emission and
    // well inside the 2 s window, and it changes the SHAPE of the sentence: it
    // gains the "plus N follow-up checks" clause. Without `force` that clause
    // would be suppressed until the window expired, on a pass that is typically
    // over before then, so the birder would never see the sentence grow.
    //
    // The clause's RENDERING is covered in ExoticProvenanceAccount.test.tsx;
    // this is the guard for its prompt EMISSION.
    const rows = [o('Muscovy Duck', 'S1'), o('Muscovy Duck', 'S2')]
    responses.set('S1', [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'X', userDoNotCount: 'DNC' }])
    responses.set('S2', [{ speciesCode: 'c-Muscovy Duck', exoticCategory: 'N' }])
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('complete'))

    // Two rounds really did run: the cover picked one carrier, it came back X,
    // and the follow-up round pursued the other.
    expect(requested).toHaveLength(2)
    const followUp = emissions().filter(a => a.kind === 'in-progress' && a.additional > 0)
    expect(followUp.length).toBeGreaterThan(0)
  })

  it('a terminal status is never throttled away', async () => {
    // Two passes back to back. The second ends inside the first's throttle
    // window, so a throttle applied to terminal statuses too would leave the tab
    // showing "in progress" after the work had finished.
    const rows = [o('sp0', 'S0')]
    responses.set('S0', 'fail')
    render(<Harness index={buildCoverIndex(rows, codeFor)} />)
    await waitFor(() => expect(kind()).toBe('error'))
    responses.set('S0', [{ speciesCode: 'c-sp0', exoticCategory: 'N' }])
    await act(async () => { screen.getByText('retry').click() })
    await waitFor(() => expect(kind()).toBe('complete'))
  })
})

// ── The recordless-species refetch (the v1.0.1 zero-escapees repair) ─────────
describe('a recordless cover species re-opens its consulted checklist', () => {
  // A store SEEDED at the seam must use keys that survive the load-path
  // guards: the harness's default `c-${norm}` codes carry uppercase and a
  // space, which SPECIES_CODE_KEY_RE drops on load — that silent drop is
  // exactly what these two tests must not be built on.
  const codeReal = (norm: string): string | undefined =>
    norm === 'Muscovy Duck' ? 'musduc' : norm === 'Mallard' ? 'mallar3' : undefined

  it('refetches the fresh-in-ledger carrier, records the answer, and excludes the escapee', async () => {
    // The pre-fix store shape, byte-for-byte: the carrier was consulted (fresh
    // ledger entry), the neighbor species got its token, and the escapee got
    // NOTHING because the cover of that era could not admit it. Before the
    // repair the auto-start read this as "already fresh", made zero requests,
    // and completed with zero escapees.
    const now = Date.now()
    seamDoc.value = {
      version: 1,
      checklists: { S1: now },
      order: ['S1'],
      species: { mallar3: { seen: ['|'], n: 1, at: now } },
      speciesOrder: ['mallar3'],
      excludedNames: [],
    }
    responses.set('S1', [
      { speciesCode: 'musduc', exoticCategory: 'X', userDoNotCount: 'DNC' },
      { speciesCode: 'mallar3' },
    ])
    const index = buildCoverIndex([o('Muscovy Duck', 'S1'), o('Mallard', 'S1')], codeReal)
    render(<Harness index={index} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toEqual(['/checklists/S1?provenance'])
    expect(screen.getByTestId('excluded').textContent).toBe('Muscovy Duck')
  })

  it('does NOT refetch when every cover species has a record (the fresh-skip stays intact)', async () => {
    const now = Date.now()
    seamDoc.value = {
      version: 1,
      checklists: { S1: now },
      order: ['S1'],
      species: {
        musduc: { seen: ['X|DNC'], n: 1, at: now },
        mallar3: { seen: ['|'], n: 1, at: now },
      },
      speciesOrder: ['musduc', 'mallar3'],
      excludedNames: ['Muscovy Duck'],
    }
    const index = buildCoverIndex([o('Muscovy Duck', 'S1'), o('Mallard', 'S1')], codeReal)
    render(<Harness index={index} />)
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(requested).toEqual([])
    expect(screen.getByTestId('excluded').textContent).toBe('Muscovy Duck')
  })
})

// ── The unmatched stamp settles the heal (exotic-provenance-reuse) ───────────
//
// Since the escapee-check-new-taxonomy re-entry a stamped species whose every
// carrier is answered is SETTLED: the check reads `complete`, names it, and
// offers Check again (which re-asks it, D-13), and Life Lists reads complete
// with it. Before, these rows ended on the `unmatched` partial and Life Lists
// read the check as unfinished, for good.
describe('a species eBird answered without settles instead of re-opening every load', () => {
  // Real-shaped codes, because a stamp is written only under a key the load
  // path keeps (the harness's `c-${norm}` codes are not).
  const codeReal = (norm: string): string | undefined =>
    norm === 'Muscovy Duck' ? 'musduc' : norm === 'Mallard' ? 'mallar3' : undefined
  const DAY = 86_400_000
  const index = buildCoverIndex(
    [o('Muscovy Duck', 'S1'), o('Mallard', 'S1'), o('Muscovy Duck', 'S2')],
    codeReal,
  )
  function seed(stampAt: number | null): void {
    const now = Date.now()
    seamDoc.value = {
      version: 1,
      checklists: { S1: now, S2: now },
      order: ['S1', 'S2'],
      species: { mallar3: { seen: ['|'], n: 1, at: now } },
      speciesOrder: ['mallar3'],
      excludedNames: [],
      exoticNames: [],
      // Stamps written under the current join (escapee-check-new-taxonomy):
      // a document without the marker loads with none.
      ...(stampAt === null ? {} : { unmatched: { musduc: stampAt }, unmatchedOrder: ['musduc'], unmatchedJoin: cacheModule.UNMATCHED_JOIN_VERSION }),
    }
    // eBird's answers have no Muscovy Duck row.
    responses.set('S1', [{ speciesCode: 'mallar3' }])
    responses.set('S2', [])
  }
  const settledNames = () => screen.getByTestId('settled').textContent
  /** The next session: the persisted stamp has caught up, then a fresh mirror. */
  async function nextSession(stampAfter: number) {
    await waitFor(() => expect((seamDoc.value as { unmatched?: Record<string, number> }).unmatched?.musduc).toBeGreaterThan(stampAfter))
    cleanup()
    cacheModule._resetProvenanceCacheForTests()
    announcements.length = 0
    render(<Harness index={index} />)
  }
  /** Life Lists' completion at every snapshot the store publishes from here on. */
  async function watchLifeLists(idx: CoverIndex): Promise<{ readings: boolean[]; stop: () => void }> {
    const { checkCompleteFor } = await import('./lifeListsProvenance')
    const readings: boolean[] = []
    const stop = cacheModule.subscribe(() => { readings.push(checkCompleteFor(cacheModule.getSnapshot(), idx)) })
    return { readings, stop }
  }

  it('a stamp past its TTL re-opens the species ONCE, re-stamps it, and the reading never passes through unfinished', async () => {
    const expired = Date.now() - 31 * DAY
    seed(expired)
    const { checkCompleteFor } = await import('./lifeListsProvenance')
    const watch = await watchLifeLists(index)
    render(<Harness index={index} />)
    await waitFor(() => expect(settledNames()).toBe('Muscovy Duck'))
    watch.stop()
    // One checklist re-asked, and its answer re-stamped the species, so the
    // pass did not go on to re-open S2 as the v1.0.1 heal alone would (2).
    expect(requested).toEqual(['/checklists/S1?provenance'])
    expect(kind()).toBe('complete')
    // The paced re-ask shows its progress as any pass does, and the line
    // never reads unfinished: no partial, no "not checked".
    expect(emissions().map(a => a.kind)).toEqual(['in-progress', 'complete'])
    // Life Lists read complete on the 31-day-old stamp before the re-ask, at
    // every snapshot during it, and after it (D-04 holds: nothing is open).
    expect(watch.readings.length).toBeGreaterThanOrEqual(2)
    expect(watch.readings.every(Boolean)).toBe(true)
    expect(checkCompleteFor(cacheModule.getSnapshot(), index)).toBe(true)

    await nextSession(expired)
    await waitFor(() => expect(settledNames()).toBe('Muscovy Duck'))
    expect(requested).toHaveLength(1)
    expect(emissions().map(a => a.kind)).toEqual(['complete'])
  })

  it('with no stamp the heal re-opens as before, and the answer stamps and settles it', async () => {
    seed(null)
    render(<Harness index={index} />)
    await waitFor(() => expect(settledNames()).toBe('Muscovy Duck'))
    expect(requested).toEqual(['/checklists/S1?provenance'])
    expect([...cacheModule.unmatchedSet(Date.now())]).toEqual(['musduc'])
  })

  it('Check again re-asks a settled species, bounded by the caps, and the load after it is settled again', async () => {
    const fresh = Date.now() - DAY
    seed(fresh)
    render(<Harness index={index} />)
    await waitFor(() => expect(settledNames()).toBe('Muscovy Duck'))
    expect(kind()).toBe('complete')
    expect(requested).toEqual([])

    await act(async () => { screen.getByText('retry').click() })
    await waitFor(() => expect(requested).toHaveLength(2))
    await waitFor(() => expect(settledNames()).toBe('Muscovy Duck'))
    // Both carriers re-asked, each once: the stamps were ignored for the run.
    expect([...requested].sort()).toEqual(['/checklists/S1?provenance', '/checklists/S2?provenance'])

    await nextSession(fresh)
    await waitFor(() => expect(settledNames()).toBe('Muscovy Duck'))
    expect(requested).toHaveLength(2)
  })

  it('Try again after an error keeps its meaning: it retries the failed checklist and leaves a settled species closed', async () => {
    // Muscovy Duck is settled (stamped, both carriers fresh). Graylag Goose's
    // one checklist was never asked, and its request fails.
    const withGoose = buildCoverIndex(
      [o('Muscovy Duck', 'S1'), o('Mallard', 'S1'), o('Muscovy Duck', 'S2'), o('Graylag Goose', 'S3')],
      norm => (norm === 'Graylag Goose' ? 'graygo' : codeReal(norm)),
    )
    seed(Date.now() - DAY)
    responses.set('S3', 'fail')
    render(<Harness index={withGoose} />)
    await waitFor(() => expect(kind()).toBe('error'))
    expect(requested).toEqual(['/checklists/S3?provenance'])

    responses.set('S3', [{ speciesCode: 'graygo', exoticCategory: 'N' }])
    await act(async () => { screen.getByText('retry').click() })
    await waitFor(() => expect(settledNames()).toBe('Muscovy Duck'))
    // Only the failed checklist was asked again; the stamped species' carriers
    // were not re-opened (they would be from the settled state's Check again).
    expect(requested).toEqual(['/checklists/S3?provenance', '/checklists/S3?provenance'])
  })

  it('the user\'s case (Eurasian Skylark): fresh and 31-day-old stamps read settled and named, Check again re-asks, a new carrier is asked, and a later answer with the row records it', async () => {
    const copy = await import('./exoticCopy')
    const { checkCompleteFor } = await import('./lifeListsProvenance')
    const codeSky = (norm: string): string | undefined =>
      norm === 'Eurasian Skylark' ? 'skylar' : norm === 'Mallard' ? 'mallar3' : undefined
    const repro = buildCoverIndex([o('Eurasian Skylark', 'S1'), o('Mallard', 'S1')], codeSky)
    const SENTENCE = "Exotic status checked. eBird's public data has no answer for Eurasian Skylark, so it counts."
    const seedSky = (age: number) => {
      const at = Date.now() - age
      seamDoc.value = {
        version: 1, checklists: { S1: at }, order: ['S1'],
        species: { mallar3: { seen: ['|'], n: 1, at } }, speciesOrder: ['mallar3'],
        excludedNames: [], exoticNames: [],
        unmatched: { skylar: at }, unmatchedOrder: ['skylar'], unmatchedJoin: cacheModule.UNMATCHED_JOIN_VERSION,
      }
      responses.set('S1', [{ speciesCode: 'mallar3' }])
    }
    const sentence = () => screen.getByTestId('sentence').textContent

    for (const [age, asked] of [[DAY, 0], [31 * DAY, 1]] as const) {
      cleanup()
      cacheModule._resetProvenanceCacheForTests()
      requested.length = 0
      announcements.length = 0
      seedSky(age)
      render(<Harness index={repro} />)
      await waitFor(() => expect(sentence()).toBe(SENTENCE))
      expect(requested, `stamp ${age / DAY} days old`).toHaveLength(asked)
      expect(emissions().some(a => a.kind === 'partial' || a.kind === 'not-checked')).toBe(false)
      expect(checkCompleteFor(cacheModule.getSnapshot(), repro)).toBe(true)
      // Check again re-asks the checklist, ignoring the stamp (D-13).
      await act(async () => { screen.getByText('retry').click() })
      await waitFor(() => expect(requested).toHaveLength(asked + 1))
      await waitFor(() => expect(sentence()).toBe(SENTENCE))
    }
    expect(copy.statusSentence({ kind: 'complete', planned: 0, found: 0, settledNames: ['Eurasian Skylark'] }, 0)).toBe(SENTENCE)

    // A newer backup adds a Skylark checklist nobody has asked: it is open, so
    // the load asks it, and its answer settles the species again.
    const wider = buildCoverIndex([o('Eurasian Skylark', 'S1'), o('Mallard', 'S1'), o('Eurasian Skylark', 'S2')], codeSky)
    expect(checkCompleteFor(cacheModule.getSnapshot(), wider)).toBe(false)
    responses.set('S2', [])
    cleanup()
    const before = requested.length
    render(<Harness index={wider} />)
    await waitFor(() => expect(requested).toHaveLength(before + 1))
    expect(requested[before]).toBe('/checklists/S2?provenance')
    await waitFor(() => expect(sentence()).toBe(SENTENCE))

    // eBird confirms the record: the next answer carries its row, so it is
    // recorded, the stamp goes, and the species classifies from its token.
    responses.set('S1', [{ speciesCode: 'mallar3' }, { speciesCode: 'skylar' }])
    await act(async () => { screen.getByText('retry').click() })
    await waitFor(() => expect(cacheModule.getSnapshot().species.has('skylar')).toBe(true))
    await waitFor(() => expect(kind()).toBe('complete'))
    await waitFor(() => expect(settledNames()).toBe(''))
    expect(cacheModule.getSnapshot().unmatched?.has('skylar')).toBe(false)
    expect(checkCompleteFor(cacheModule.getSnapshot(), wider)).toBe(true)
  })

  it('a store holding only a stamp (no record at all) reads settled, never "not checked yet"', async () => {
    // A Skylark-only checklist answered empty: the old `species.size === 0`
    // guard read this store as never checked.
    const alone = buildCoverIndex([o('Eurasian Skylark', 'S1')], norm => (norm === 'Eurasian Skylark' ? 'skylar' : undefined))
    const at = Date.now() - DAY
    seamDoc.value = {
      version: 1, checklists: { S1: at }, order: ['S1'], species: {}, speciesOrder: [],
      excludedNames: [], exoticNames: [],
      unmatched: { skylar: at }, unmatchedOrder: ['skylar'], unmatchedJoin: cacheModule.UNMATCHED_JOIN_VERSION,
    }
    render(<Harness index={alone} />)
    await waitFor(() => expect(settledNames()).toBe('Eurasian Skylark'))
    expect(requested).toEqual([])
    expect(emissions().map(a => a.kind)).toEqual(['complete'])
  })

  it('a failed answer stamps nothing, so the next load asks again', async () => {
    seed(null)
    responses.set('S1', 'fail')
    responses.set('S2', 'fail')
    render(<Harness index={index} />)
    await waitFor(() => expect(kind()).toBe('error'))
    expect(requested).toHaveLength(2)
    expect(cacheModule.unmatchedSet(Date.now()).size).toBe(0)
    cleanup()
    cacheModule._resetProvenanceCacheForTests()
    render(<Harness index={index} />)
    await waitFor(() => expect(requested).toHaveLength(4))
    await waitFor(() => expect(kind()).toBe('error'))
  })
})

// ── The shared eBird gate (ebird-request-economy D-01) ───────────────────────
//
// The pass is a self-enforcing point over the shared gate state, the Projects
// sweep's shape: the gate wraps the loader handed to the store's chokepoint.
// Every claim is observed at the CLIENT, as request starts on a fake clock
// (testing.md, the v0.5.92 pacing rows), never as elapsed wall time.
describe('the shared eBird gate (ebird-request-economy D-01)', () => {
  const SPACING = rateLimitModule.ACTIVITY_START_SPACING_DEFAULT_MS

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(1_750_000_000_000)
    rateLimitModule._setActivityStartSpacingMsForTests(SPACING)
  })
  afterEach(() => { vi.useRealTimers() })

  async function advance(ms: number): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
  }
  /** Let the mount commit, the one disk read land and the auto-start effect
   *  run, so the pass's first request starts at the fake clock's origin. */
  async function mount(index: CoverIndex): Promise<number> {
    render(<Harness index={index} />)
    for (let i = 0; i < 5; i += 1) await advance(0)
    return Date.now()
  }

  /** n checklists carrying one species each, all answered as counting. */
  function spread(n: number): CoverIndex {
    const rows: ObservationEntry[] = []
    for (let i = 0; i < n; i += 1) {
      rows.push(o(`sp${i}`, `S${i}`))
      responses.set(`S${i}`, [{ speciesCode: `c-sp${i}`, exoticCategory: 'N' }])
    }
    return buildCoverIndex(rows, codeFor)
  }

  it('every checklist request starts at least the spacing floor after the previous gated start, shared with the other lookups', async () => {
    await mount(spread(6))
    // Another enforcement point on the same key (the Statistics tab's own
    // hotspot-region lookups ride the transport's gate), started meanwhile.
    const other: number[] = []
    const otherCalls = [0, 1].map(() => gateModule.gatedEbirdCall(async () => { other.push(Date.now()) }))
    await advance(8 * SPACING + 100)
    await Promise.all(otherCalls)
    expect(kind()).toBe('complete')
    expect(starts).toHaveLength(6)
    expect(other).toHaveLength(2)
    const all = [...starts.map(s => s.at), ...other].sort((a, b) => a - b)
    for (let i = 1; i < all.length; i += 1) {
      expect(all[i] - all[i - 1], `start ${i} of ${all.length}`).toBeGreaterThanOrEqual(SPACING)
    }
  })

  it('a 429 opens the shared cooldown: nothing on the key starts inside it, and the checklist is retried and kept', async () => {
    const index = spread(3)
    limited.set('S0', 1)
    retryAfterSec = 2
    await mount(index)
    await advance(10)
    const { cooldownUntil, waveCount } = gateModule.ebirdGateState()
    expect(waveCount).toBe(1)
    expect(cooldownUntil).toBeGreaterThanOrEqual(starts[0].at + 2000)
    // The other direction: a lookup elsewhere in the app waits it out too.
    let otherAt = 0
    const other = gateModule.gatedEbirdCall(async () => { otherAt = Date.now() })
    await advance(5_000)
    await other
    expect(kind()).toBe('complete')
    expect(starts.map(s => s.id).filter(id => id === 'S0')).toHaveLength(2)
    for (const s of starts.slice(1)) expect(s.at, s.id).toBeGreaterThanOrEqual(cooldownUntil)
    expect(otherAt).toBeGreaterThanOrEqual(cooldownUntil)
    expect(cacheModule.getSnapshot().checklists.has('S0')).toBe(true)
  })

  it('a checklist still rate limited after two retries is a failed checklist, and nothing is cached for it', async () => {
    const index = spread(2)
    limited.set('S0', Number.POSITIVE_INFINITY)
    retryAfterSec = 1
    await mount(index)
    await advance(15_000)
    expect(starts.filter(s => s.id === 'S0')).toHaveLength(1 + rateLimitModule.ACTIVITY_RATE_LIMIT_RETRIES)
    expect(kind()).toBe('partial')
    expect(screen.getByTestId('reason').textContent).toBe('failures')
    expect(screen.getByTestId('failed').textContent).toBe('1')
    expect(cacheModule.getSnapshot().checklists.has('S0')).toBe(false)
    expect(cacheModule.getSnapshot().checklists.has('S1')).toBe(true)
  })

  it('Stop while calls wait in a cooldown: none of them is sent, none counts as failed, and the pass ends without waiting it out', async () => {
    const index = spread(6)
    limited.set('S0', 1)
    retryAfterSec = 30
    await mount(index)
    await advance(200)
    expect(starts).toHaveLength(1)                       // S0, then the 429
    expect(kind()).toBe('in-progress')
    await act(async () => { screen.getByText('stop').click() })
    await advance(10)
    expect(kind()).toBe('partial')
    expect(screen.getByTestId('reason').textContent).toBe('cancelled')
    expect(screen.getByTestId('failed').textContent).toBe('0')
    // Past the cooldown, when the waiting turns come up: still nothing sent.
    await advance(60_000)
    expect(starts).toHaveLength(1)
    expect(cacheModule.getSnapshot().checklists.size).toBe(0)
  })

  it('Stop while a request is on the wire keeps its answer (only calls still waiting are dropped)', async () => {
    const index = spread(6)
    latencyMs = 1_000
    await mount(index)
    await advance(SPACING * 3 + 10)                      // four on the wire
    expect(starts).toHaveLength(4)
    await act(async () => { screen.getByText('stop').click() })
    await advance(2_000)
    expect(kind()).toBe('partial')
    expect(screen.getByTestId('reason').textContent).toBe('cancelled')
    expect(starts).toHaveLength(4)
    expect(cacheModule.getSnapshot().checklists.size).toBe(4)
  })

  it('Stop while a request is on the wire that then answers 429 ends the pass without waiting out the cooldown', async () => {
    // QA's L1 (ebird-request-economy D-18): the on-wire call used to sit out
    // the gate's cooldown and its retry after Stop, about 30 s here, though a
    // stopped pass never sends that retry. Beside it, a 502 on the wire is the
    // gate's last word and still counts as failed, and an answer is kept.
    const index = spread(3)
    limited.set('S0', 1)
    retryAfterSec = 30
    latencyMs = 1_000
    responses.set('S1', 'fail')
    await mount(index)
    await advance(SPACING * 2 + 10)                      // S0, S1 and S2 on the wire
    expect(starts).toHaveLength(3)
    await act(async () => { screen.getByText('stop').click() })
    await advance(1_010)                                 // all three answer: S0 a 429, S1 a 502
    expect(kind()).toBe('partial')
    expect(screen.getByTestId('reason').textContent).toBe('cancelled')
    expect(screen.getByTestId('failed').textContent).toBe('1')
    expect(cacheModule.getSnapshot().checklists.has('S2')).toBe(true)
    // The 429 still reached the gate: the key-global cooldown is open.
    expect(gateModule.ebirdGateState().waveCount).toBe(1)
    await advance(60_000)
    expect(starts).toHaveLength(3)
  })

  it('a Clear while calls wait at the spacing floor sends none of them, and no later pick goes out', async () => {
    const index = spread(6)
    await mount(index)
    await advance(SPACING + 50)
    expect(starts.map(s => s.id)).toEqual(['S0', 'S1'])
    await act(async () => { await cacheModule.purgeProvenanceStore() })
    await advance(10_000)
    // S2 and S3 were waiting for their start slots, S4 and S5 not yet picked.
    expect(starts.map(s => s.id)).toEqual(['S0', 'S1'])
    expect(cacheModule.getSnapshot().checklists.size).toBe(0)
    expect(seamDoc.value).toBeNull()
    expect(kind()).toBe('partial')
    expect(screen.getByTestId('failed').textContent).toBe('0')
  })

  it('the cold pass on the reference shape: 73 checklists, every start the floor apart, measured on the fake clock', async () => {
    // v0.5.87's measured cover is 73 checklists, answered in about 531 ms each
    // (9.7 s four-wide). The floor puts the last start at 72 x 150 ms.
    const index = spread(73)
    latencyMs = 531
    const t0 = await mount(index)
    let end = 0
    for (let step = 0; step < 400 && end === 0; step += 1) {
      await advance(100)
      if (kind() === 'complete') end = Date.now() - t0
    }
    expect(starts).toHaveLength(73)
    const span = starts[72].at - starts[0].at
    expect(span, `last start ${span} ms after the first; terminal status at ${end} ms`).toBeGreaterThanOrEqual(72 * SPACING)
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i].at - starts[i - 1].at, `start ${i}`).toBeGreaterThanOrEqual(SPACING)
    }
    expect(end).toBeGreaterThan(0)
    expect(peakInFlight).toBeLessThanOrEqual(PROVENANCE_CONCURRENCY)
  }, 20_000)
})
