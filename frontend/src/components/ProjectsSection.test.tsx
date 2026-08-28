// @vitest-environment jsdom
//
// The Projects section's eleven display states, its live region and its progress
// bar (county-shading-and-project-stats, FR-49 through FR-56; QA-52, QA-53,
// QA-54, QA-55, QA-56, QA-58, QA-59, QA-63, QA-64).
//
// The controller is supplied directly here, because the question is what each
// STATE renders — its sentence, its supporting note and exactly the controls it
// can actually perform. The controller's own behaviour is covered in
// useChecklistProjects.test.tsx.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { ProjectsSection } from './ProjectsSection'
import type { ChecklistProjectsController, ProjectsStatus } from '../lib/useChecklistProjects'
import type { ProjectsView } from '../lib/checklistProjects'

afterEach(cleanup)

const EMPTY_VIEW: ProjectsView = { projects: [], portals: [], checked: 0, total: 3252, skipped: 0 }

function controller(status: ProjectsStatus, view: Partial<ProjectsView> = {}, seq = 1): ChecklistProjectsController {
  return {
    status, statusSeq: seq,
    view: { ...EMPTY_VIEW, ...view },
    failedIds: new Set(),
    start: vi.fn(), stop: vi.fn(), resume: vi.fn(), checkAgain: vi.fn(),
  }
}

const show = (status: ProjectsStatus, view: Partial<ProjectsView> = {}) => {
  const c = controller(status, view)
  const r = render(<ProjectsSection controller={c} onGoToSettings={() => {}} />)
  return { ...r, c }
}

// ── The eleven states: distinct copy and exactly their own controls ──────────

const STATES: Array<[string, ProjectsStatus, Partial<ProjectsView>, string[]]> = [
  ['never-run', { kind: 'never-run', total: 3252, skipped: 0 }, {}, ['Check projects']],
  ['running', { kind: 'running', checked: 412, total: 3252 }, { checked: 412 }, ['Stop']],
  ['cooldown', { kind: 'cooldown', checked: 412, total: 3252, seconds: 7 }, { checked: 412 }, ['Stop']],
  ['stopped', { kind: 'stopped', checked: 412, total: 3252 }, { checked: 412 }, ['Resume']],
  ['partial', { kind: 'partial', checked: 412, total: 3252, remaining: 2840 }, { checked: 412 }, ['Check the rest']],
  ['complete', { kind: 'complete', checked: 3252, total: 3252 }, { checked: 3252 }, ['Check again']],
  ['unanswered', { kind: 'unanswered', checked: 3200, total: 3252, failed: 52 }, { checked: 3200 }, ['Try again']],
  ['at-capacity', { kind: 'at-capacity', checked: 500, total: 3252, capacity: 500 }, { checked: 500 }, []],
  ['no-key', { kind: 'no-key' }, {}, []],
  ['offline', { kind: 'offline', checked: 412, total: 3252 }, { checked: 412 }, []],
  ['error', { kind: 'error', checked: 412, total: 3252 }, { checked: 412 }, ['Try again']],
]

describe('the eleven display states (FR-51, QA-54)', () => {
  it.each(STATES)('%s renders its own copy and exactly its own controls', (_name, status, view, controls) => {
    const { container } = show(status, view)
    const buttons = [...container.querySelectorAll('.sr-proj-act')].map(b => b.textContent?.trim())
    expect(buttons).toEqual(controls)
    expect(container.querySelector('.sr-proj-msg')!.textContent!.length).toBeGreaterThan(10)
    expect(container.querySelector('.sr-proj-rule')!.textContent!.length).toBeGreaterThan(10)
  })

  it('every state produces a DISTINCT status sentence', () => {
    // A copy table that quietly collapsed two states onto one sentence would
    // pass every per-state assertion above.
    const sentences = STATES.map(([, status, view]) => {
      const r = show(status, view)
      const text = r.container.querySelector('.sr-proj-msg')!.textContent!
      r.unmount()
      return text
    })
    // offline and error each have two shapes; these eleven rows are the ones
    // FR-51 names, all distinct.
    expect(new Set(sentences).size).toBe(STATES.length)
  })

  it('offline and error at checked = 0 say something different again (10b, 11b)', () => {
    const a = show({ kind: 'offline', checked: 0, total: 3252 })
    const offlineZero = a.container.querySelector('.sr-proj-msg')!.textContent
    a.unmount()
    const b = show({ kind: 'offline', checked: 412, total: 3252 }, { checked: 412 })
    expect(b.container.querySelector('.sr-proj-msg')!.textContent).not.toBe(offlineZero)
    b.unmount()

    const c = show({ kind: 'error', checked: 0, total: 3252 })
    expect(c.container.querySelector('.sr-proj-msg')!.textContent)
      .toContain('no checklist has been asked about yet')
  })

  it('QA-55: the partial sentence states COUNTS ONLY and never claims a stop', () => {
    // After a relaunch the app genuinely cannot tell a deliberate stop from a
    // quit, and nothing about a stop is persisted.
    const { container } = show({ kind: 'partial', checked: 412, total: 3252, remaining: 2840 }, { checked: 412 })
    const msg = container.querySelector('.sr-proj-msg')!.textContent!
    expect(msg).toContain('412 of 3,252 checklists checked')
    expect(msg).not.toMatch(/stop/i)
    expect(msg).not.toMatch(/you /i)
  })
})

describe('never-run shows NO count and NO zero (FR-49, QA-52)', () => {
  it('names the exact total, derives the estimate, and calls it a floor', () => {
    const { container } = show({ kind: 'never-run', total: 3252, skipped: 0 })
    const text = container.textContent!
    expect(text).toContain('Projects have not been checked yet.')
    expect(text).toContain('3,252 requests')
    // 3252 x 150 ms = 8.13 minutes, derived rather than hardcoded.
    expect(text).toContain('about 8 minutes')
    expect(text).toContain('That is a floor')
    expect(text).toContain('Nothing is sent until you press Check projects.')
  })

  it('renders no tally, no zero, and exactly ONE start control', () => {
    const { container } = show({ kind: 'never-run', total: 3252, skipped: 0 })
    expect(container.textContent).not.toMatch(/\b0 projects\b/)
    expect(container.textContent).not.toMatch(/No projects found/)
    expect(container.querySelectorAll('.sr-proj-act')).toHaveLength(1)
    expect(container.querySelector('.sr-proj-act--primary')).toBeTruthy()
  })

  it('the estimate tracks the count rather than being a constant', () => {
    const small = show({ kind: 'never-run', total: 400, skipped: 0 })
    // ANCHORED, not `toContain`. `toContain('about 1 minute')` is satisfied by
    // the superstring "about 1 minutes", which is what this section shipped, so
    // the assertion that appeared to cover the singular could not fail on the
    // plural. The negative below is the one with teeth.
    expect(small.container.textContent).toMatch(/\babout 1 minute\b/)
    expect(small.container.textContent).not.toMatch(/\babout 1 minutes\b/)
    small.unmount()
    const big = show({ kind: 'never-run', total: 20000, skipped: 0 })
    expect(big.container.textContent).toMatch(/\babout 50 minutes\b/)
  })

  it('no state renders "1 minutes", in the DOM, at the figures that produce a 1', () => {
    // The rendered counterpart of the copy-table sweep: the four states that
    // quote a duration, at counts whose estimate is 1. `stopped` and `partial`
    // quote what is LEFT, so this is the end of every sweep on every account,
    // not a small-backup edge case.
    const cases: Array<[string, ProjectsStatus, Partial<ProjectsView>]> = [
      ['never-run', { kind: 'never-run', total: 400, skipped: 0 }, {}],
      ['complete', { kind: 'complete', checked: 400, total: 400 }, { checked: 400, total: 400 }],
      ['stopped', { kind: 'stopped', checked: 100, total: 400 }, { checked: 100, total: 400 }],
      ['partial', { kind: 'partial', checked: 100, total: 400, remaining: 300 }, { checked: 100, total: 400 }],
    ]
    for (const [name, status, view] of cases) {
      const r = show(status, view)
      expect(r.container.textContent, name).toMatch(/\babout 1 minute\b/)
      expect(r.container.textContent, name).not.toMatch(/\babout 1 minutes\b/)
      r.unmount()
    }
  })
})

describe('every tally carries its denominator (FR-50, QA-53)', () => {
  it.each(STATES.filter(([n]) => n !== 'never-run' && n !== 'no-key'))(
    '%s renders both the checked count and the export total',
    (_name, status, view) => {
      const { container } = show(status, view)
      const text = container.textContent!
      expect(text).toContain('3,252')
      expect(text).toMatch(/\d/)
    },
  )

  it('a completed sweep says "all 3,252 of your checklists" rather than a bare count', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252,
      projects: [{ key: 'atl-ca', label: 'California Breeding Bird Atlas', named: true, checklists: 147, firstDate: '2026-02-14', lastDate: '2026-06-28' }],
    })
    expect(container.textContent).toContain('1 project across all 3,252 of your checklists.')
  })

  it('QA-63: the earned zero states itself against the denominator, not as an empty list', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, { checked: 3252, projects: [] })
    expect(container.textContent).toContain('No projects found across all 3,252 of your checklists.')
    expect(container.querySelector('.sr-proj-rows')).toBeNull()
  })

  it('the skipped line appears only when nonzero (FR-47)', () => {
    const none = show({ kind: 'never-run', total: 3252, skipped: 0 })
    expect(none.container.textContent).not.toContain('no usable checklist id')
    none.unmount()
    const some = show({ kind: 'never-run', total: 3252, skipped: 4 }, { skipped: 4 })
    expect(some.container.textContent).toContain('4 rows in this backup carry no usable checklist id')
    expect(some.container.textContent).toContain('outside the 3,252')
  })
})

describe('the live region (FR-52, QA-56)', () => {
  it('is in the accessibility tree from FIRST render and is never display:none', () => {
    const { container } = show({ kind: 'never-run', total: 3252, skipped: 0 })
    const region = container.querySelector('[role="status"]')!
    expect(region).toBeTruthy()
    expect(region.getAttribute('aria-live')).toBe('polite')
    // It is `flex` in every state; the class carries no hiding display. Hiding a
    // role="status" while idle makes it be INSERTED with its first message,
    // which breaks announcement entirely.
    expect(region.className).toContain('sr-proj-status')
    expect((region as HTMLElement).style.display).toBe('')
  })

  it('its message sits in a SEQUENCE-KEYED child, so a repeat is a real replacement', () => {
    // aria-live fires on DOM MUTATION and React bails when reconciling a text
    // node to an identical string, so an unkeyed child would announce once for
    // two identical updates.
    const status: ProjectsStatus = { kind: 'running', checked: 5, total: 10 }
    const first = controller(status, { checked: 5 }, 1)
    const { container, rerender } = render(<ProjectsSection controller={first} onGoToSettings={() => {}} />)
    const region = container.querySelector('[role="status"]')!
    const before = region.querySelector('.sr-proj-msg')

    const second = controller(status, { checked: 5 }, 2)   // identical message, new seq
    rerender(<ProjectsSection controller={second} onGoToSettings={() => {}} />)
    const after = region.querySelector('.sr-proj-msg')
    expect(after).not.toBe(before)                          // a real node replacement
    expect(after!.textContent).toBe(before!.textContent)    // ...of identical text
    // No invisible character is appended to force a diff, which would make every
    // textContent assertion quietly false. (Zero-width space, ZWNJ, ZWJ, BOM.)
    for (const invisible of ['\u200B', '\u200C', '\u200D', '\uFEFF']) {
      expect(after!.textContent).not.toContain(invisible)
    }
  })

  it('the no-key state offers its inline Settings link inside the message', () => {
    const c = controller({ kind: 'no-key' })
    const onGoToSettings = vi.fn()
    const { container } = render(<ProjectsSection controller={c} onGoToSettings={onGoToSettings} />)
    const link = container.querySelector('.sr-proj-link') as HTMLButtonElement
    expect(link.textContent).toBe('Add a key in Settings')
    fireEvent.click(link)
    expect(onGoToSettings).toHaveBeenCalledTimes(1)
    // ...and it is the ONLY affordance: no action button it could not perform.
    expect(container.querySelectorAll('.sr-proj-act')).toHaveLength(0)
  })
})

describe('the progress bar (FR-53, QA-58)', () => {
  it('renders with an explicit name and the checked / total pair while running', () => {
    const { container } = show({ kind: 'running', checked: 412, total: 3252 }, { checked: 412 })
    const bar = container.querySelector('[role="progressbar"]')!
    expect(bar.getAttribute('aria-label')).toBe('Project check progress')
    expect(bar.getAttribute('aria-valuenow')).toBe('412')
    expect(bar.getAttribute('aria-valuemax')).toBe('3252')
    expect(container.querySelector('.sr-proj-count')!.textContent).toBe('412 / 3,252')
  })

  it('measures checked / total, so the sentence and the readout quote ONE pair', () => {
    const { container } = show({ kind: 'running', checked: 412, total: 3252 }, { checked: 412 })
    const msg = container.querySelector('.sr-proj-msg')!.textContent!
    const readout = container.querySelector('.sr-proj-count')!.textContent!
    expect(msg).toContain('412 of 3,252 checklists')
    expect(readout).toContain('412')
    expect(readout).toContain('3,252')
  })

  it('is CONDITIONALLY RENDERED, never hidden against an author display', () => {
    // `[hidden]` loses to an author `display`, so a hidden progress row would
    // still paint. Only the running and cooldown states show one.
    for (const [name, status, view] of STATES) {
      const r = show(status, view)
      const bar = r.container.querySelector('[role="progressbar"]')
      if (name === 'running' || name === 'cooldown') expect(bar, name).toBeTruthy()
      else expect(bar, name).toBeNull()
      r.unmount()
    }
  })

  it('never emits aria-valuenow above aria-valuemax, whatever it is handed', () => {
    // The shipped controller could reach checked = 2 x total on a forced
    // re-check ("6,502 / 3,251" on the reference account). That is fixed in the
    // controller and guarded there, by a test that presses Check again. THIS
    // element additionally refuses to write the pair at all: a progress bar
    // reporting more than its own maximum is an ARIA violation, so the
    // invariant is enforced where the attribute is written.
    const { container } = show({ kind: 'running', checked: 6502, total: 3251 }, { checked: 6502 })
    const bar = container.querySelector('[role="progressbar"]')!
    const now = Number(bar.getAttribute('aria-valuenow'))
    const max = Number(bar.getAttribute('aria-valuemax'))
    expect(now).toBeLessThanOrEqual(max)
    expect(now).toBe(3251)
    // The visible readout quotes the same clamped pair, so the two cannot
    // disagree on screen.
    expect(container.querySelector('.sr-proj-count')!.textContent).toBe('3,251 / 3,251')
  })

  it('a pass with failures correctly stops short of 100%', () => {
    const { container } = show({ kind: 'running', checked: 3200, total: 3252 }, { checked: 3200 })
    const fill = container.querySelector('.sr-proj-fill') as HTMLElement
    expect(parseInt(fill.style.width, 10)).toBeLessThan(100)
  })
})

describe('the results rows (FR-54, FR-55, FR-56)', () => {
  const view: Partial<ProjectsView> = {
    checked: 3252,
    projects: [
      { key: 'atl-ca', label: 'California Breeding Bird Atlas', named: true, checklists: 147, firstDate: '2026-02-14', lastDate: '2026-06-28' },
      { key: '1103', label: '1103', named: false, checklists: 6, firstDate: '2026-04-03', lastDate: '2026-05-19' },
    ],
    portals: [
      { code: 'EBIRD', label: 'eBird', named: true, checklists: 2894 },
      { code: 'EBIRD_MERLIN', label: 'Merlin', named: true, checklists: 211 },
      { code: 'FOO_BAR', label: 'FOO_BAR', named: false, checklists: 3 },
    ],
  }

  it('each row carries a label, a count, a share and a date span, and NO rank number', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, view)
    const rows = [...container.querySelectorAll('.sr-proj-row')]
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('.sr-proj-name')!.textContent).toBe('California Breeding Bird Atlas')
    expect(rows[0].querySelector('.sr-proj-n')!.textContent).toBe('147 checklists')
    const meta = rows[0].querySelector('.sr-proj-meta')!.textContent!
    expect(meta).toContain('5% of the 3,252 checked')
    expect(meta).toContain('Feb 14')
    expect(meta).toContain('Jun 28, 2026')
    // No rank digits before the label.
    expect(rows[0].textContent!.trimStart().startsWith('1')).toBe(false)
  })

  it('routes the share through fmtSharePct, so a nonzero share never rounds to a bare 0%', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, view)
    const meta = container.querySelectorAll('.sr-proj-meta')[1].textContent!
    expect(meta).toContain('<1% of the 3,252 checked')
    expect(meta).not.toContain('0% of')
  })

  it('an UNNAMED project renders its raw identifier in mono with the why-line', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, view)
    const unnamed = container.querySelectorAll('.sr-proj-row')[1]
    expect(unnamed.querySelector('.sr-proj-name .raw')!.textContent).toBe('1103')
    expect(unnamed.querySelector('.sr-proj-unnamed')!.textContent)
      .toContain('No public eBird endpoint gives this project a name')
  })

  it('QA-30: no identifier is a link, and no href appears anywhere in the section', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, view)
    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(container.innerHTML).not.toContain('href')
  })

  it('QA-64: the portal block is subordinate, labelled, and never called a project', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, view)
    expect(container.textContent).toContain('Projects you have contributed to')
    expect(container.textContent).toContain('How you submitted')
    expect(container.textContent).toContain('The app or portal a checklist came in through, not a project.')
    const portalRows = [...container.querySelectorAll('.sr-proj-portalrow')]
    expect(portalRows).toHaveLength(3)
    expect(portalRows[0].querySelector('.nm')!.textContent).toBe('eBird')
    // An unlabelled portal shows its raw code in mono, like an unnamed project.
    expect(portalRows[2].querySelector('.nm code')!.textContent).toBe('FOO_BAR')
  })

  it('QA-64: the portal block renders with NO project at all', () => {
    // The common case, and the one the shipped nesting made unreachable: a
    // sweep that finds only submission portals. Every eBird account that has
    // never joined a project lands here, and the block it paid for was hidden
    // behind `projects.length > 0`.
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252,
      projects: [],
      portals: [
        { code: 'EBIRD', label: 'eBird', named: true, checklists: 3041 },
        { code: 'EBIRD_MERLIN', label: 'Merlin', named: true, checklists: 211 },
      ],
    })
    expect(container.textContent).toContain('How you submitted')
    expect(container.querySelectorAll('.sr-proj-portalrow')).toHaveLength(2)
    // Still no projects block, and still nothing calling a portal a project.
    expect(container.querySelector('.sr-proj-rows')).toBeNull()
    expect(container.textContent).not.toContain('Projects you have contributed to')
    // The earned zero is still stated by the sentence, against its denominator.
    expect(container.querySelector('.sr-proj-msg')!.textContent)
      .toContain('No projects found across all 3,252 of your checklists.')
  })

  it('renders the projects block with NO portal, the mirror case', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252,
      projects: [{ key: 'atl-ca', label: 'California Breeding Bird Atlas', named: true, checklists: 147, firstDate: '2026-02-14', lastDate: '2026-06-28' }],
      portals: [],
    })
    expect(container.querySelectorAll('.sr-proj-row')).toHaveLength(1)
    expect(container.querySelector('.sr-proj-portals')).toBeNull()
    expect(container.textContent).not.toContain('How you submitted')
  })

  it('singularizes a one-checklist row', () => {
    const { container } = show({ kind: 'complete', checked: 1, total: 1 }, {
      checked: 1, total: 1,
      projects: [{ key: 'x', label: 'X Project', named: false, checklists: 1, firstDate: '2026-01-01', lastDate: '2026-01-01' }],
    })
    expect(container.querySelector('.sr-proj-n')!.textContent).toBe('1 checklist')
  })

  it('renders no results zone at all before anything is checked', () => {
    const { container } = show({ kind: 'never-run', total: 3252, skipped: 0 })
    expect(container.querySelector('.sr-proj-rows')).toBeNull()
    expect(container.querySelector('.sr-proj-portals')).toBeNull()
  })
})

describe('the controls call the controller they name', () => {
  it.each([
    ['never-run', { kind: 'never-run', total: 10, skipped: 0 } as ProjectsStatus, 'start'],
    ['running', { kind: 'running', checked: 1, total: 10 } as ProjectsStatus, 'stop'],
    ['stopped', { kind: 'stopped', checked: 1, total: 10 } as ProjectsStatus, 'resume'],
    ['partial', { kind: 'partial', checked: 1, total: 10, remaining: 9 } as ProjectsStatus, 'resume'],
    ['complete', { kind: 'complete', checked: 10, total: 10 } as ProjectsStatus, 'checkAgain'],
    ['unanswered', { kind: 'unanswered', checked: 9, total: 10, failed: 1 } as ProjectsStatus, 'resume'],
    ['error', { kind: 'error', checked: 1, total: 10 } as ProjectsStatus, 'resume'],
  ])('%s presses %s', (_name, status, method) => {
    const c = controller(status, { checked: 1, total: 10 })
    const { container } = render(<ProjectsSection controller={c} onGoToSettings={() => {}} />)
    fireEvent.click(container.querySelector('.sr-proj-act')!)
    expect(c[method as 'start' | 'stop' | 'resume' | 'checkAgain']).toHaveBeenCalledTimes(1)
  })
})
