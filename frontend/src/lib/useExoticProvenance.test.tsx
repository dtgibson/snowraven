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
import type { ObservationEntry } from '../types'

const seamDoc: { value: unknown } = { value: null }
vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async (key: string) => (key === 'exotic-provenance-v1' ? seamDoc.value : null)),
    setSetting: vi.fn(async (_k: string, v: unknown) => { seamDoc.value = JSON.parse(JSON.stringify(v)) }),
  },
}))

interface Row { speciesCode: string; exoticCategory?: string; userDoNotCount?: string }
const responses = new Map<string, Row[] | 'fail'>()
const requested: string[] = []
let inFlight = 0
let peakInFlight = 0
/** When set, every mocked request awaits it, so a pass can be held mid-flight. */
let hold: Promise<void> | null = null

vi.mock('./transport', () => ({
  TransportError: class extends Error {},
  transport: {
    get: vi.fn(async (path: string, params?: Record<string, string>) => {
      requested.push(`${path}?${params?.fields ?? ''}`)
      inFlight += 1
      peakInFlight = Math.max(peakInFlight, inFlight)
      try {
        // A real await point, so the pool's concurrency is observable.
        await new Promise<void>(r => { setTimeout(r, 1) })
        if (hold) await hold
        const id = path.slice('/checklists/'.length)
        const body = responses.get(id)
        if (body === 'fail') throw Object.assign(new Error('eBird 502'), { status: 502 })
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
})

afterEach(cleanup)

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
    await waitFor(() => expect(kind()).toBe('complete'), { timeout: 6000 })

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
