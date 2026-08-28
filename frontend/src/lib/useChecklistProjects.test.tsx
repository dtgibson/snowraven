// @vitest-environment jsdom
//
// The projects sweep controller (county-shading-and-project-stats, FR-39
// through FR-47, FR-51 through FR-53; QA-41, QA-43, QA-45, QA-46, QA-47, QA-48,
// QA-49, QA-50, QA-55, QA-56, QA-57).
//
// The harness follows the shipped useExoticProvenance.test.tsx shape: the
// controller's state is RENDERED into the DOM and its actions are driven through
// real buttons, with every recording done in an effect. That is not ceremony —
// reassigning an outer binding or reading a clock during render are both
// build-blocking here, and the effect is also where a render-timeline
// measurement genuinely belongs.
//
// PACING NOTE. The shared gate's 150 ms start spacing is real time, and the
// house rule is that a rate CLAIM is measured against a REAL-DURATION pass,
// anchored on CLIENT observation. The pacing and announcement blocks do exactly
// that; every other block zeroes the spacing through the shipped test seam so it
// exercises its own contract at full speed rather than measuring the gate twice.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { act, render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import type { ChecklistEntry } from '../types'

const net = vi.hoisted(() => ({
  starts: [] as number[],
  /** The same starts on the WALL clock, for comparison against the gate's own
   *  `Date.now()`-based cooldown deadline. */
  startsWall: [] as number[],
  calls: [] as Array<{ path: string; params?: Record<string, string> }>,
  handler: null as null | ((id: string) => Promise<{ projId: string; projectIds: number[] }>),
}))

vi.mock('./transport', () => ({
  transport: {
    get: async (path: string, params?: Record<string, string>) => {
      net.starts.push(performance.now())
      net.startsWall.push(Date.now())
      net.calls.push({ path, params })
      const id = path.slice('/checklists/'.length)
      if (!net.handler) return { projId: 'EBIRD', projectIds: [] }
      return net.handler(id)
    },
    post: async () => ({}),
    getReplayable: async () => ({ data: {}, replayedAt: null }),
  },
}))

const disk = vi.hoisted(() => ({ doc: null as unknown }))
vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async () => disk.doc),
    setSetting: vi.fn(async (_k: string, v: unknown) => { disk.doc = v }),
  },
}))

import { useChecklistProjects } from './useChecklistProjects'
import { _resetProjectsCacheForTests, setProjectsMaxChecklists, getSnapshot } from './checklistProjectsCache'
import { _resetEbirdGateForTests, ebirdGateState, gatedEbirdCall } from './ebirdGate'
import {
  _setActivityStartSpacingMsForTests, ACTIVITY_START_SPACING_DEFAULT_MS,
  ACTIVITY_RATE_LIMIT_RETRIES,
} from './rateLimit'

function lists(n: number, from = 1): ChecklistEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    submissionId: `S${from + i}`,
    date: `2026-0${1 + ((from + i) % 9)}-01`,
    location: 'X', locationId: 'L1', latitude: null, longitude: null,
    county: 'Alameda', stateProvince: 'US-CA',
    time: null, duration: null, distance: null, area: null, protocol: null,
    numObservers: null, allObsReported: null, checklistComments: '',
    speciesCount: 1, individualCount: 1,
  }))
}

/** Every emission the component would render, recorded in an EFFECT. */
const emitted: Array<{ at: number; seq: number; kind: string; checked: number; total: number }> = []

function Harness({ checklists, hasEbirdKey = true, online = true }: {
  checklists: ChecklistEntry[]; hasEbirdKey?: boolean | null; online?: boolean
}) {
  const p = useChecklistProjects({ checklists, hasEbirdKey, online })
  const st = p.status as { kind: string; checked?: number; total?: number }
  useEffect(() => {
    emitted.push({
      at: performance.now(), seq: p.statusSeq, kind: st.kind,
      checked: st.checked ?? -1, total: st.total ?? -1,
    })
  }, [p.status, p.statusSeq, st.kind, st.checked, st.total])
  return (
    <div>
      <span data-testid="kind">{st.kind}</span>
      <span data-testid="checked">{String(p.view.checked)}</span>
      <span data-testid="total">{String(p.view.total)}</span>
      <span data-testid="skipped">{String(p.view.skipped)}</span>
      <span data-testid="failed">{[...p.failedIds].sort().join(',')}</span>
      <span data-testid="projects">{p.view.projects.map(x => `${x.label}:${x.checklists}`).join(',')}</span>
      <span data-testid="capacity">{p.status.kind === 'at-capacity' ? String(p.status.capacity) : ''}</span>
      <span data-testid="remaining">{p.status.kind === 'partial' ? String(p.status.remaining) : ''}</span>
      <button type="button" onClick={p.start}>start</button>
      <button type="button" onClick={p.stop}>stop</button>
      <button type="button" onClick={p.resume}>resume</button>
      <button type="button" onClick={p.checkAgain}>again</button>
    </div>
  )
}

const kind = () => screen.getByTestId('kind').textContent
const num = (id: string) => Number(screen.getByTestId(id).textContent)
const press = async (label: string) => {
  await act(async () => { fireEvent.click(screen.getByText(label)) })
}

beforeEach(() => {
  _resetProjectsCacheForTests()
  _resetEbirdGateForTests()
  _setActivityStartSpacingMsForTests(0)
  disk.doc = null
  net.starts.length = 0
  net.startsWall.length = 0
  net.calls.length = 0
  net.handler = null
  emitted.length = 0
})
afterEach(() => {
  cleanup()
  _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
})

describe('nothing is fetched without a press (FR-39, QA-41)', () => {
  it('mounting issues ZERO requests and reports never-run', async () => {
    render(<Harness checklists={lists(5)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    // Give any effect that might have started a pass every chance to run.
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    expect(net.calls).toEqual([])
    expect(kind()).toBe('never-run')
  })

  it('the never-run state carries the definite total and NO count of any kind', async () => {
    render(<Harness checklists={lists(7)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    expect(num('total')).toBe(7)
    expect(num('checked')).toBe(0)
    expect(screen.getByTestId('projects').textContent).toBe('')
  })

  it('the denominator is correct from FIRST paint, before the store has loaded', async () => {
    // A 0-of-0 flash would be exactly the unearned figure this section exists
    // to avoid: `total` and `skipped` come from the backup alone.
    render(<Harness checklists={lists(7)} />)
    expect(num('total')).toBe(7)
  })

  it('re-rendering with a new backup still issues nothing', async () => {
    const r = render(<Harness checklists={lists(5)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    r.rerender(<Harness checklists={lists(9)} />)
    await act(async () => { await new Promise(x => setTimeout(x, 30)) })
    expect(net.calls).toEqual([])
  })
})

describe('a pass (FR-41, FR-42)', () => {
  it('asks about every shape-valid checklist exactly once and completes', async () => {
    render(<Harness checklists={lists(4)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(net.calls).toHaveLength(4)
    expect(num('checked')).toBe(4)
  })

  it('requests `fields=projects`, so a checklist costs exactly one eBird call', async () => {
    render(<Harness checklists={lists(2)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    for (const c of net.calls) expect(c.params).toEqual({ fields: 'projects' })
  })

  it('encodeURIComponent-wraps the id and never lets it escape the path', async () => {
    render(<Harness checklists={lists(1)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(net.calls[0].path).toBe('/checklists/S1')
  })

  it('QA-51: a malformed id is never requested and is reported as skipped', async () => {
    const backup = [...lists(2), { ...lists(1)[0], submissionId: 'not-an-id' }]
    render(<Harness checklists={backup} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    expect(num('skipped')).toBe(1)
    expect(num('total')).toBe(2)
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(net.calls.map(c => c.path)).not.toContain('/checklists/not-an-id')
    expect(net.calls).toHaveLength(2)
  })

  it('finds the projects it was asked about', async () => {
    net.handler = async (id) =>
      id === 'S2' ? { projId: 'EBIRD_ATL_CA', projectIds: [1050] } : { projId: 'EBIRD', projectIds: [] }
    render(<Harness checklists={lists(3)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(screen.getByTestId('projects').textContent).toBe('California Breeding Bird Atlas:1')
  })

  it('QA-43: a resume after a simulated quit asks only about the unanswered', async () => {
    // A "quit" is a fresh module state with the persisted document intact —
    // exactly what a relaunch gives, because nothing about progress is stored.
    disk.doc = { version: 1, entries: { S1: { proj: 'EBIRD', ids: [], at: Date.now() } }, order: ['S1'] }
    render(<Harness checklists={lists(3)} />)
    await waitFor(() => expect(num('checked')).toBe(1))
    // QA-55: the partial sentence's inputs are counts only. Nothing about a stop
    // is persisted, so the app cannot claim one and does not.
    expect(kind()).toBe('partial')
    expect(num('total')).toBe(3)
    expect(screen.getByTestId('remaining').textContent).toBe('2')
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(net.calls.map(c => c.path)).toEqual(['/checklists/S3', '/checklists/S2'])
  })

  it('QA-43: a newer export asks only about the checklists it added', async () => {
    render(<Harness checklists={lists(2)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    net.calls.length = 0

    cleanup()
    render(<Harness checklists={lists(4)} />)
    await waitFor(() => expect(num('checked')).toBe(2))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(net.calls.map(c => c.path).sort()).toEqual(['/checklists/S3', '/checklists/S4'])
  })

  it('checkAgain FORCES a re-ask of everything through the same chokepoint', async () => {
    render(<Harness checklists={lists(3)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    net.calls.length = 0
    // Without the force path this would be a no-op press for a whole year.
    await press('again')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(net.calls).toHaveLength(3)
  })
})

describe('Stop (FR-45, QA-49)', () => {
  it('starts no further request and KEEPS every answer already written', async () => {
    let answered = 0
    net.handler = async () => {
      answered += 1
      if (answered === 2) fireEvent.click(screen.getByText('stop'))
      return { projId: 'EBIRD', projectIds: [] }
    }
    render(<Harness checklists={lists(10)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('stopped'))
    // Sequential pump: at most ONE in-flight request may complete after Stop.
    expect(net.calls.length).toBeLessThanOrEqual(3)
    expect(num('checked')).toBe(net.calls.length)
    expect(getSnapshot().size).toBe(net.calls.length)
  })

  it('a resume after a Stop asks only about what is left', async () => {
    net.handler = async (id) => {
      if (id === 'S8') fireEvent.click(screen.getByText('stop'))
      return { projId: 'EBIRD', projectIds: [] }
    }
    render(<Harness checklists={lists(10)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('stopped'))
    const already = new Set(net.calls.map(c => c.path))
    net.handler = null
    net.calls.length = 0
    await press('resume')
    await waitFor(() => expect(kind()).toBe('complete'))
    for (const c of net.calls) expect(already.has(c.path)).toBe(false)
  })
})

describe('failures are left unanswered (FR-44; QA-47, QA-48)', () => {
  it('a persistent failure is not stored, not counted, and reported as a failure', async () => {
    net.handler = async (id) => {
      if (id === 'S2') throw Object.assign(new Error('nope'), { status: 500 })
      return { projId: 'EBIRD', projectIds: [] }
    }
    render(<Harness checklists={lists(3)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('unanswered'))
    expect(num('checked')).toBe(2)
    expect(num('total')).toBe(3)
    expect(screen.getByTestId('failed').textContent).toBe('S2')
    expect(getSnapshot().has('S2')).toBe(false)
  })

  it('QA-47: a 429 is retried exactly twice THROUGH the sweep, then left unanswered', async () => {
    // WHY THE 500 FIXTURE ABOVE CANNOT MAKE THIS CLAIM: `gatedEbirdCall` retries
    // ONLY the rate-limit shape, so a 500 issues exactly one request and the
    // bound is never reached. The bound is what FR-44 is about, so it is
    // exercised here at full duration through the real gate — no mocked clock,
    // because the retries are separated by the cooldown the 429 itself opens.
    _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
    net.handler = async () => {
      throw Object.assign(new Error('429'), { status: 429, retryAfterSec: 1 })
    }
    render(<Harness checklists={lists(1)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('unanswered'), { timeout: 15000 })

    // 1 first attempt + ACTIVITY_RATE_LIMIT_RETRIES. Asserted against the
    // shipped constant, so the two cannot drift.
    expect(net.calls.map(c => c.path))
      .toEqual(Array(1 + ACTIVITY_RATE_LIMIT_RETRIES).fill('/checklists/S1'))
    // And the unanswered half stays true: nothing stored, nothing counted.
    expect(getSnapshot().has('S1')).toBe(false)
    expect(screen.getByTestId('failed').textContent).toBe('S1')
    expect(num('checked')).toBe(0)
    // Each 429 landed outside the previous cooldown, so each advanced the
    // ladder: the bound was reached by real waves, not by one wave counted
    // three times.
    expect(ebirdGateState().cooldownWave).toBe(1 + ACTIVITY_RATE_LIMIT_RETRIES)
  }, 30000)

  it('GUARD THE GUARD: a non-429 failure is not retried at all', async () => {
    // The reading that makes the count above meaningful rather than a number
    // that happens to be three.
    net.handler = async () => { throw Object.assign(new Error('nope'), { status: 500 }) }
    render(<Harness checklists={lists(1)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('unanswered'))
    expect(net.calls.map(c => c.path)).toEqual(['/checklists/S1'])
  })

  it('QA-48: Try again re-asks ONLY the unanswered ids', async () => {
    net.handler = async (id) => {
      if (id === 'S2') throw Object.assign(new Error('nope'), { status: 500 })
      return { projId: 'EBIRD', projectIds: [] }
    }
    render(<Harness checklists={lists(3)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('unanswered'))
    net.calls.length = 0
    net.handler = null
    await press('resume')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(net.calls.map(c => c.path)).toEqual(['/checklists/S2'])
  })
})

describe('the honest states (FR-51)', () => {
  it('no-key renders no tally and starts nothing when pressed', async () => {
    render(<Harness checklists={lists(5)} hasEbirdKey={false} />)
    await waitFor(() => expect(kind()).toBe('no-key'))
    await press('start')
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(net.calls).toEqual([])
  })

  it('offline with nothing checked carries the pair but claims nothing', async () => {
    render(<Harness checklists={lists(5)} online={false} />)
    await waitFor(() => expect(kind()).toBe('offline'))
    expect(num('checked')).toBe(0)
    expect(num('total')).toBe(5)
  })

  it('offline with answers keeps every one of them', async () => {
    disk.doc = {
      version: 1,
      entries: { S1: { proj: 'EBIRD_ATL_CA', ids: [1050], at: Date.now() } },
      order: ['S1'],
    }
    render(<Harness checklists={lists(5)} online={false} />)
    await waitFor(() => expect(num('checked')).toBe(1))
    expect(kind()).toBe('offline')
    expect(screen.getByTestId('projects').textContent).toBe('California Breeding Bird Atlas:1')
  })

  it('at-capacity is reached when the store refuses a new key', async () => {
    setProjectsMaxChecklists(2)
    render(<Harness checklists={lists(4)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('at-capacity'))
    expect(screen.getByTestId('capacity').textContent).toBe('2')
  })

  it('every emitted state that can show a tally carries BOTH numbers (QA-53)', async () => {
    render(<Harness checklists={lists(3)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    const tallyStates = emitted.filter(e => e.kind !== 'never-run' && e.kind !== 'no-key')
    expect(tallyStates.length).toBeGreaterThan(0)
    for (const e of tallyStates) {
      expect(e.checked, e.kind).toBeGreaterThanOrEqual(0)
      expect(e.total, e.kind).toBeGreaterThan(0)
    }
  })
})

// ── The progress pair can never exceed its own denominator (QA-58, QA-53) ────
//
// The defect this replaces: `progressRef` was seeded with every ALREADY-ANSWERED
// checklist and then incremented once per network answer. "Check again" forces a
// re-ask of the whole backup, so on a completed store the readout climbed to 2x
// total and `aria-valuenow` passed `aria-valuemax` — "6,502 / 3,251" on the
// reference account. Nothing caught it because every existing loop presses
// `start`, and only `again` and a past-TTL re-ask reach the double-count.
describe('the progress pair never exceeds its denominator (QA-58, QA-53)', () => {
  /**
   * Make every per-item `emit` clear the 2,000 ms throttle.
   *
   * WITHOUT THIS THE WHOLE BLOCK IS NEARLY VACUOUS, which was found by mutation
   * rather than by reading: a pass at zero spacing finishes inside one throttle
   * window, so the only `running` figure ever published is the OPENING one, and
   * the terminal status is recomputed by `deriveProjectsView` and is correct
   * whatever the counter did. The over-count lives strictly in the ticker's
   * second and later emissions, so a test that cannot see them cannot see the
   * defect — which is exactly how it shipped.
   *
   * Advancing a monotone clock is safe here: the only other readers are the
   * TTL (365 days) and the entry timestamps, neither of which a few seconds
   * moves.
   */
  let clock: ReturnType<typeof vi.spyOn> | null = null
  const unthrottle = () => {
    let t = Date.now()
    clock = vi.spyOn(Date, 'now').mockImplementation(() => { t += 2500; return t })
  }
  afterEach(() => { clock?.mockRestore(); clock = null })

  it('a full re-check counts to the total ONCE, not twice', async () => {
    unthrottle()
    render(<Harness checklists={lists(6)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))

    // Every target is already answered here, which is exactly the state the
    // double-count needed.
    emitted.length = 0
    net.calls.length = 0
    await press('again')
    await waitFor(() => expect(kind()).toBe('complete'))

    const withTally = emitted.filter(e => e.total > 0 && e.checked >= 0)
    // Non-vacuity, and specifically that the MID-PASS figures were observed:
    // one running emission per checklist plus the opening one and the terminal.
    expect(withTally.filter(e => e.kind === 'running').length).toBeGreaterThan(1)
    for (const e of withTally) {
      expect(e.checked, `${e.kind} ${e.checked}/${e.total}`).toBeLessThanOrEqual(e.total)
    }
    expect(Math.max(...withTally.map(e => e.checked))).toBe(6)
    // And it genuinely re-asked, so this is not passing by doing no work.
    expect(net.calls.filter(c => c.path.startsWith('/checklists/'))).toHaveLength(6)
  })

  it('restarts the bar at zero for a forced re-check, and climbs back to full', async () => {
    unthrottle()
    render(<Harness checklists={lists(4)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))

    emitted.length = 0
    await press('again')
    await waitFor(() => expect(kind()).toBe('complete'))
    const running = emitted.filter(e => e.kind === 'running' || e.kind === 'cooldown')
    expect(running.length).toBeGreaterThan(0)
    // The opening figure is the checklists this pass is NOT re-asking, which for
    // 'all' mode is none of them.
    expect(running[0].checked).toBe(0)
    expect(emitted[emitted.length - 1].checked).toBe(4)
  })

  it('a RESUME still opens where it left off rather than at zero', async () => {
    // The counterpart property: the base is the answered checklists this pass is
    // not about to re-ask, so a resume must NOT restart at zero.
    let answered = 0
    net.handler = async () => {
      answered += 1
      if (answered === 2) fireEvent.click(screen.getByText('stop'))
      return { projId: 'EBIRD', projectIds: [] }
    }
    render(<Harness checklists={lists(8)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('stopped'))
    const stoppedAt = num('checked')
    expect(stoppedAt).toBeGreaterThan(0)

    net.handler = null
    emitted.length = 0
    unthrottle()
    await press('resume')
    await waitFor(() => expect(kind()).toBe('complete'))
    const running = emitted.filter(e => e.kind === 'running')
    expect(running.length).toBeGreaterThan(0)
    expect(running[0].checked).toBe(stoppedAt)
    for (const e of emitted.filter(x => x.total > 0)) {
      expect(e.checked).toBeLessThanOrEqual(e.total)
    }
  })

  it('a FAILED request is not progress: the readout does not climb on a pass that answers nothing', async () => {
    // THE HOLE THE ABOVE LEAVE OPEN. Every assertion in this block brackets the
    // counter from above (`checked <= total`), and an `answeredHere` that
    // incremented unconditionally satisfies all of them: a pass where every
    // request fails would climb 1, 2, 3 ... N and then snap back to `unanswered`
    // at 0. That contradicts the intent stated at `useChecklistProjects.ts:285`
    // and would show the user a bar filling while nothing was being learned. The
    // increment is gated on the STORE, so this brackets it from BELOW.
    unthrottle()
    // A real macrotask per item. Not decoration: with every request failing
    // there is no store write, so nothing re-renders between items and React
    // batches all five emissions into one render — the guard would then observe
    // a single figure and pass by not looking. A real network call has this
    // boundary; the mock has to be given it.
    net.handler = async () => {
      await new Promise(r => setTimeout(r, 0))
      throw Object.assign(new Error('nope'), { status: 500 })
    }
    render(<Harness checklists={lists(5)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('unanswered'))

    const running = emitted.filter(e => e.kind === 'running')
    // Non-vacuity: the per-item emissions really were observed, which is the
    // whole reason `unthrottle` exists. Without it the pass publishes only its
    // opening figure and this test is green by not looking.
    expect(running.length).toBeGreaterThan(1)
    for (const e of running) {
      expect(e.checked, `climbed to ${e.checked}/${e.total} with nothing stored`).toBe(0)
    }
    // The work really was attempted, and really did fail.
    expect(net.calls.filter(c => c.path.startsWith('/checklists/'))).toHaveLength(5)
    expect(getSnapshot().size).toBe(0)
    expect(num('checked')).toBe(0)
  })

  it('...and a MIXED pass counts exactly the ones that were answered', async () => {
    // The same bracket where it has to discriminate rather than compare against
    // zero: two of five succeed, so the readout must reach 2 and stop.
    unthrottle()
    net.handler = async (id) => {
      await new Promise(r => setTimeout(r, 0))
      // The two NEWEST, so they are answered first (QA-44) and three failing
      // items follow them: the readout must reach 2 and then stay there while
      // the rest fail, which is what discriminates a store-gated increment from
      // an unconditional one.
      if (id === 'S5' || id === 'S4') return { projId: 'EBIRD', projectIds: [] }
      throw Object.assign(new Error('nope'), { status: 500 })
    }
    render(<Harness checklists={lists(5)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('unanswered'))
    const running = emitted.filter(e => e.kind === 'running')
    expect(running.length).toBeGreaterThan(1)
    expect(Math.max(...running.map(e => e.checked))).toBe(2)
    // It reached 2 and STOPPED: the three later failures added nothing.
    expect(running.filter(e => e.checked === 2).length).toBeGreaterThan(1)
    expect(num('checked')).toBe(2)
  })

  it('a stale (past-TTL) entry re-asked in pending mode is not counted twice', async () => {
    // The second route to the double-count, and the one that reaches a user who
    // never presses Check again.
    disk.doc = {
      version: 1,
      entries: {
        S1: { proj: 'EBIRD', ids: [], at: 1 }, S2: { proj: 'EBIRD', ids: [], at: 1 },
        S3: { proj: 'EBIRD', ids: [], at: 1 }, S4: { proj: 'EBIRD', ids: [], at: 1 },
      },
      order: ['S1', 'S2', 'S3', 'S4'],
    }
    render(<Harness checklists={lists(4)} />)
    await waitFor(() => expect(num('checked')).toBe(4))
    emitted.length = 0
    unthrottle()
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    const seen = emitted.filter(x => x.total > 0 && x.checked >= 0)
    expect(seen.filter(e => e.kind === 'running').length).toBeGreaterThan(1)
    for (const e of seen) {
      expect(e.checked, `${e.kind} ${e.checked}/${e.total}`).toBeLessThanOrEqual(e.total)
    }
    expect(emitted[emitted.length - 1].checked).toBe(4)
  })
})

describe('an export swap mid-pass (FR-46, QA-50)', () => {
  it('cancels the pass and recomputes against the new backup', async () => {
    let release!: () => void
    const held = new Promise<void>(r => { release = r })
    let first = true
    net.handler = async () => {
      if (first) { first = false; await held }
      return { projId: 'EBIRD', projectIds: [] }
    }
    const r = render(<Harness checklists={lists(6)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    // Swap the export while a request is in flight.
    r.rerender(<Harness checklists={lists(2, 100)} />)
    await act(async () => { release() })
    await waitFor(() => expect(num('total')).toBe(2))
    // The in-flight answer still landed in the store (it was paid for), but the
    // pass stopped and the denominator followed the new backup.
    expect(num('total')).toBe(2)
    expect(net.calls.length).toBeLessThan(6)
  })

  it('SAYS it stopped, and keeps every answer it had paid for', async () => {
    // An interruption used to be silent: the pump returned without publishing
    // anything, so the section sat on its last `running` figure until some
    // unrelated re-render dislodged it, and then resolved to `partial` — which
    // reads as though the sweep had simply never got that far. On an
    // eight-minute pass that looks like the work vanished.
    let release!: () => void
    const held = new Promise<void>(r => { release = r })
    let n = 0
    net.handler = async () => {
      n += 1
      if (n === 3) await held
      return { projId: 'EBIRD', projectIds: [] }
    }
    // The new backup is a SUPERSET, so every answer already paid for is still
    // joinable and must still be counted. (A smaller backup legitimately drops
    // answers from the tally — the join is backup -> store — which would make
    // the count assertion below depend on which ids the pass happened to reach
    // first, and that is a different criterion.)
    const r = render(<Harness checklists={lists(8)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(net.calls.length).toBeGreaterThanOrEqual(3))
    const paidFor = getSnapshot().size
    expect(paidFor).toBeGreaterThan(0)

    r.rerender(<Harness checklists={lists(12)} />)
    await act(async () => { release() })

    // `stopped` and not `partial`: its sentence is the one that says every
    // answer so far is kept.
    await waitFor(() => expect(kind()).toBe('stopped'))
    expect(num('total')).toBe(12)
    // Nothing paid for was discarded, and every one of those answers is still
    // counted against the new backup.
    expect(getSnapshot().size).toBeGreaterThanOrEqual(paidFor)
    expect(num('checked')).toBe(getSnapshot().size)
    expect(num('checked')).toBeGreaterThanOrEqual(paidFor)
  })

  it('a first mount is never mistaken for an interruption', async () => {
    // The generation effect fires on mount and on the shell-pass -> real-data
    // transition too. Marking those as stopped would put a "Stopped at 0 of N"
    // sentence on a section that has never run.
    const r = render(<Harness checklists={[]} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    r.rerender(<Harness checklists={lists(3)} />)
    await waitFor(() => expect(num('total')).toBe(3))
    expect(kind()).toBe('never-run')
  })
})

describe('pacing (FR-43, QA-45)', () => {
  it('request STARTS are at least the shipped spacing apart, measured client-side', async () => {
    _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
    render(<Harness checklists={lists(4)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'), { timeout: 10000 })
    expect(net.starts).toHaveLength(4)
    for (let i = 1; i < net.starts.length; i += 1) {
      // A small tolerance for timer coarseness; the claim is the FLOOR, not an
      // exact interval.
      expect(net.starts[i] - net.starts[i - 1]).toBeGreaterThanOrEqual(ACTIVITY_START_SPACING_DEFAULT_MS - 20)
    }
  }, 20000)

  it('concurrency is 1: no two requests are ever in flight together', async () => {
    let inFlight = 0
    let peak = 0
    net.handler = async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise(r => setTimeout(r, 1))
      inFlight -= 1
      return { projId: 'EBIRD', projectIds: [] }
    }
    render(<Harness checklists={lists(6)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(peak).toBe(1)
  })

  it('QA-46: a 429 opens the SHARED cooldown, so the rest of the app slows too', async () => {
    let sent = 0
    net.handler = async () => {
      sent += 1
      if (sent === 1) throw Object.assign(new Error('429'), { status: 429, retryAfterSec: 1 })
      return { projId: 'EBIRD', projectIds: [] }
    }
    render(<Harness checklists={lists(2)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    await press('start')
    await waitFor(() => expect(ebirdGateState().cooldownUntil).toBeGreaterThan(0), { timeout: 5000 })
    // The cooldown is module-scoped, so a 429 raised HERE is the same state the
    // Map Explorer's gated calls read, and vice versa.
    expect(ebirdGateState().cooldownWave).toBeGreaterThan(0)

    // DIRECTION 1, MEASURED RATHER THAN INFERRED: a call on the OTHER
    // enforcement point, started while this cooldown is live, does not run
    // until the wait is out. `gatedEbirdCall` is exactly what the transport
    // chokepoint wraps /map/hotspots and friends in, so this IS the second
    // surface, not a stand-in for one.
    const until = ebirdGateState().cooldownUntil
    let ranAt = 0
    const other = gatedEbirdCall(async () => { ranAt = Date.now(); return 'ok' })
    expect(ranAt, 'the other surface has not started yet').toBe(0)
    await expect(other).resolves.toBe('ok')
    expect(ranAt).toBeGreaterThanOrEqual(until)

    await waitFor(() => expect(kind()).toBe('complete'), { timeout: 15000 })
  }, 30000)

  it('QA-46, the OTHER direction: a 429 raised elsewhere slows the SWEEP', async () => {
    // The direction that had no sweep-level test. The 429 is raised on the
    // single-shot lookup path — the Map Explorer's enforcement point — and the
    // sweep, which has not started yet, must honor the cooldown that call
    // opened: it announces `cooldown`, issues NOTHING while the wait runs, and
    // resumes by itself when it clears. Full duration, no mocked clock.
    _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
    let attempts = 0
    const other = gatedEbirdCall(async () => {
      attempts += 1
      if (attempts === 1) throw Object.assign(new Error('429'), { status: 429, retryAfterSec: 2 })
      return 'ok'
    })
    await waitFor(() => expect(ebirdGateState().cooldownUntil).toBeGreaterThan(Date.now()))
    const until = ebirdGateState().cooldownUntil

    render(<Harness checklists={lists(2)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    const pressedAt = Date.now()
    await press('start')

    // It says so, in the state the user sees.
    await waitFor(() => expect(kind()).toBe('cooldown'))
    expect(net.calls.length, 'nothing is sent during another surface’s cooldown').toBe(0)
    expect(Date.now()).toBeLessThan(until)   // still inside the window

    // ...and it carries on by itself, with the first request starting no
    // earlier than the cooldown the other surface opened.
    await waitFor(() => expect(kind()).toBe('complete'), { timeout: 15000 })
    // Newest-first (QA-44), so the order is S2 then S1; what matters here is
    // that both went out, after the wait.
    expect(net.calls.map(c => c.path).sort()).toEqual(['/checklists/S1', '/checklists/S2'])
    expect(net.startsWall[0] - pressedAt).toBeGreaterThan(0)
    expect(net.startsWall[0]).toBeGreaterThanOrEqual(until)
    await expect(other).resolves.toBe('ok')
  }, 30000)
})

describe('announcement rate, measured against a REAL-DURATION pass (FR-52, QA-56, QA-57)', () => {
  it('emits at the throttled rate, not per arrival, and never disagrees with itself', async () => {
    // A FAST MOCK would let any throttle suppress everything and report a rate
    // the user will never see, so this runs at the shipped 150 ms spacing over
    // enough checklists to last several seconds. The measurement is taken at the
    // RENDER timeline — the emissions the component would paint — not at the
    // emitter's own bookkeeping, because the v0.5.92 defect was an emitter that
    // looked throttled while the rendered text updated at arrival rate (it
    // emitted the live accumulator instead of a frozen snapshot).
    _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
    render(<Harness checklists={lists(24)} />)     // 24 x 150 ms is about 3.6 s
    await waitFor(() => expect(kind()).toBe('never-run'))

    const t0 = performance.now()
    emitted.length = 0
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'), { timeout: 25000 })
    const elapsed = performance.now() - t0
    expect(elapsed).toBeGreaterThan(2000)          // it really was a real pass

    const seqs = new Set(emitted.map(e => e.seq))
    const perSecond = seqs.size / (elapsed / 1000)
    // The escapee defect was 7.7 announcements per second. At a 2 s throttle the
    // ceiling is ~0.5/s plus the two unthrottled ones (the opening figure and
    // the terminal status), so 3/s is a generous bound that the per-arrival
    // shape (24 arrivals over 3.6 s = 6.6/s) still fails.
    expect(perSecond).toBeLessThan(3)
    expect(seqs.size).toBeGreaterThan(1)           // non-vacuity: it did emit

    // QA-57: the pair on screen is ONE pair. Every running/cooldown emission
    // carries a checked that never exceeds its own total and never goes
    // backwards, so the sentence, the bar and the readout cannot disagree.
    let last = -1
    for (const e of emitted) {
      if (e.kind !== 'running' && e.kind !== 'cooldown') continue
      expect(e.checked).toBeLessThanOrEqual(e.total)
      expect(e.checked).toBeGreaterThanOrEqual(last)
      last = e.checked
    }
  }, 40000)

  it('the FIRST definite figure and the terminal status are never throttled', async () => {
    // FR-52: the opening figure must be shown before the first request goes out,
    // and a pass must always report how it ended. This whole pass fits inside
    // ONE throttle window, so a throttled opening figure would leave `running`
    // absent from the timeline entirely.
    _setActivityStartSpacingMsForTests(0)
    render(<Harness checklists={lists(3)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    emitted.length = 0
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    expect(emitted.map(e => e.kind)).toContain('running')
    expect(emitted[emitted.length - 1].kind).toBe('complete')
  })

  it('the sequence advances on EVERY update, including an identical one', async () => {
    // The live region keys its message child on it: aria-live fires on DOM
    // MUTATION and React bails on an identical text node, so a sequence that
    // skipped a repeat would announce once for two identical updates.
    render(<Harness checklists={lists(3)} />)
    await waitFor(() => expect(kind()).toBe('never-run'))
    emitted.length = 0
    await press('start')
    await waitFor(() => expect(kind()).toBe('complete'))
    const seqs = emitted.map(e => e.seq)
    for (let i = 1; i < seqs.length; i += 1) expect(seqs[i]).toBeGreaterThan(seqs[i - 1])
  })
})
