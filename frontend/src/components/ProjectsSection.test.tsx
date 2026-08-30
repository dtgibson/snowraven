// @vitest-environment jsdom
//
// The Projects section's twelve display states, its live region and its progress
// bar (county-shading-and-project-stats, FR-49 through FR-56; QA-52, QA-53,
// QA-54, QA-55, QA-56, QA-58, QA-59, QA-63, QA-64; `paused` added by
// project-checker-rate-limiting).
//
// The controller is supplied directly here, because the question is what each
// STATE renders — its sentence, its supporting note and exactly the controls it
// can actually perform. The controller's own behaviour is covered in
// useChecklistProjects.test.tsx.

import { describe, it, expect, vi, afterEach, afterAll } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { ProjectsSection } from './ProjectsSection'
import type { ChecklistProjectsController, ProjectsStatus } from '../lib/useChecklistProjects'
import type { ProjectsView, ProjectRow } from '../lib/checklistProjects'

afterEach(cleanup)

// recharts bundles @reduxjs/toolkit, whose autoBatch enhancer arms a 100 ms
// fallback timer when a chart mounts (the participation chart here). Wait it
// out BEFORE this file's jsdom environment is torn down, so the timer fires
// where cancelAnimationFrame still exists — the node-env shim in test-setup.ts
// never installs in jsdom files. Same pattern as BirdingStats.test.tsx.
afterAll(() => new Promise((r) => setTimeout(r, 120)))

// jsdom has no ResizeObserver; recharts' ResponsiveContainer wants one. The
// chart is decorative (aria-hidden + inert) and none of these tests asserts
// recharts-internal geometry, so a no-op observer is sufficient and honest.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

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

// ── The twelve states: distinct copy and exactly their own controls ──────────

const STATES: Array<[string, ProjectsStatus, Partial<ProjectsView>, string[]]> = [
  ['never-run', { kind: 'never-run', total: 3252, skipped: 0 }, {}, ['Check projects']],
  ['running', { kind: 'running', checked: 412, total: 3252 }, { checked: 412 }, ['Stop']],
  ['cooldown', { kind: 'cooldown', checked: 412, total: 3252, seconds: 7 }, { checked: 412 }, ['Stop']],
  ['stopped', { kind: 'stopped', checked: 412, total: 3252 }, { checked: 412 }, ['Resume']],
  ['paused', { kind: 'paused', checked: 412, total: 3252 }, { checked: 412 }, ['Resume']],
  ['partial', { kind: 'partial', checked: 412, total: 3252, remaining: 2840 }, { checked: 412 }, ['Check the rest']],
  ['complete', { kind: 'complete', checked: 3252, total: 3252 }, { checked: 3252 }, ['Check again']],
  ['unanswered', { kind: 'unanswered', checked: 3200, total: 3252, failed: 52 }, { checked: 3200 }, ['Try again']],
  ['at-capacity', { kind: 'at-capacity', checked: 500, total: 3252, capacity: 500 }, { checked: 500 }, []],
  ['no-key', { kind: 'no-key' }, {}, []],
  ['offline', { kind: 'offline', checked: 412, total: 3252 }, { checked: 412 }, []],
  ['error', { kind: 'error', checked: 412, total: 3252 }, { checked: 412 }, ['Try again']],
]

describe('the twelve display states (FR-51, QA-54)', () => {
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
    // offline and error each have two shapes; these twelve rows are the ones
    // FR-51 names (plus the paused row), all distinct.
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

describe('the participation chart (projects-stats-card)', () => {
  const proj = (n: number, checklists: number): ProjectRow => ({
    key: `p${n}`, label: `Project ${n}`, named: true, checklists,
    firstDate: '2026-01-01', lastDate: '2026-06-01',
  })
  const manyProjects = (count: number): ProjectRow[] =>
    Array.from({ length: count }, (_, i) => proj(i + 1, 100 - i))

  const CATEGORICAL = [
    'var(--sr-accent)', 'var(--sr-graph-photo)', 'var(--sr-graph-audio)', 'var(--sr-graph-video)',
  ]

  it('renders with ≥2 projects: an aria-hidden + inert wrapper inside the chart-aside grid', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252, projects: manyProjects(4),
    })
    const grid = container.querySelector('.sr-grid-chart-aside')!
    expect(grid).toBeTruthy()
    const viz = grid.querySelector('.sr-proj-viz')!
    expect(viz).toBeTruthy()
    // The literal attributes, both load-bearing: recharts leaves a focusable
    // root <svg> otherwise, and aria-hidden alone leaves an axe
    // aria-hidden-focus ghost. React 19 emits boolean inert correctly.
    expect(viz.getAttribute('aria-hidden')).toBe('true')
    expect(viz.hasAttribute('inert')).toBe(true)
    // The caption labels the decoration, inside the inert wrapper.
    expect(viz.querySelector('.sr-proj-viz-cap')!.textContent).toBe('Checklists per project')
    // The rows sit beside it in the same grid.
    expect(grid.querySelectorAll('.sr-proj-row')).toHaveLength(4)
  })

  it('every figure stays in the rows as text — the chart adds no accessible content', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252, projects: manyProjects(3),
    })
    // Text rows are intact and complete (the sole accessible carrier).
    const rows = [...container.querySelectorAll('.sr-proj-row')]
    expect(rows).toHaveLength(3)
    expect(rows[0].querySelector('.sr-proj-n')!.textContent).toBe('100 checklists')
    expect(rows[0].querySelector('.sr-proj-meta')!.textContent).toContain('3% of the 3,252 checked')
    // Everything the chart renders sits under the inert wrapper.
    const viz = container.querySelector('.sr-proj-viz')!
    for (const svg of container.querySelectorAll('svg.recharts-surface')) {
      expect(viz.contains(svg)).toBe(true)
    }
  })

  it('the height formula is container-level px: 24 per charted row plus 8', () => {
    const four = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252, projects: manyProjects(4),
    })
    const sizer4 = four.container.querySelector('.sr-proj-viz > div:last-child') as HTMLElement
    expect(sizer4.style.height).toBe('104px')   // 24 * 4 + 8
    four.unmount()
    const two = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252, projects: manyProjects(2),
    })
    const sizer2 = two.container.querySelector('.sr-proj-viz > div:last-child') as HTMLElement
    expect(sizer2.style.height).toBe('56px')    // 24 * 2 + 8
  })

  it('the chart gate: one project renders a plain flat block — no chart, no grid, no dot', () => {
    const { container } = show({ kind: 'complete', checked: 214, total: 214 }, {
      checked: 214, total: 214, projects: [proj(1, 3)],
    })
    expect(container.querySelector('.sr-proj-viz')).toBeNull()
    expect(container.querySelector('.sr-grid-chart-aside')).toBeNull()
    expect(container.querySelector('.sr-proj-dot')).toBeNull()
    // The row itself still states the fact.
    expect(container.querySelectorAll('.sr-proj-row')).toHaveLength(1)
  })

  it('dots render only on rows that have a bar, INSIDE the name span, in the fixed categorical order', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252, projects: manyProjects(10),
    })
    // First 8 rows are charted; rows 9 and 10 keep full text rows, no dot.
    const rows = [...container.querySelectorAll('.sr-proj-row')]
    expect(rows).toHaveLength(10)
    const dots = [...container.querySelectorAll('.sr-proj-dot')] as HTMLElement[]
    expect(dots).toHaveLength(8)
    expect(rows[8].querySelector('.sr-proj-dot')).toBeNull()
    expect(rows[9].querySelector('.sr-proj-dot')).toBeNull()
    for (const [i, dot] of dots.entries()) {
      // Inside .sr-proj-name — never a direct row child, or the ≤640 stacking
      // rule (`.sr-proj-row > *:not(.sr-only)` → width:100%) would seize it.
      expect(dot.parentElement!.className).toContain('sr-proj-name')
      expect(dot.getAttribute('aria-hidden')).toBe('true')
      // Fixed order, never cycled: accent, photo, audio, video, then slate.
      const expected = i < 4 ? CATEGORICAL[i] : 'var(--sr-chart-slate)'
      expect(dot.style.background, `dot ${i}`).toBe(expected)
    }
  })

  it('charts at most 8 bars however many projects exist', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252, projects: manyProjects(12),
    })
    const sizer = container.querySelector('.sr-proj-viz > div:last-child') as HTMLElement
    expect(sizer.style.height).toBe('200px')    // 24 * 8 + 8, not 24 * 12 + 8
    expect(container.querySelectorAll('.sr-proj-dot')).toHaveLength(8)
  })

  it('mounts mid-sweep the moment two projects exist (the gate is the rows, not the status)', () => {
    const { container } = show({ kind: 'running', checked: 1204, total: 3300 }, {
      checked: 1204, total: 3300, projects: manyProjects(2),
    })
    expect(container.querySelector('.sr-proj-viz')).toBeTruthy()
  })

  it('the entrance is keyed by charted-row COUNT: a new bar replays it, a progress tick does not', () => {
    // The .sr-proj-viz animation rides the class; React replays it exactly when
    // the keyed wrapper REMOUNTS. Same-count re-renders (bar widths moving
    // during a sweep) must keep the node, so the entrance never fires per tick.
    const status: ProjectsStatus = { kind: 'running', checked: 100, total: 3300 }
    const first = controller(status, { checked: 100, total: 3300, projects: manyProjects(2) }, 1)
    const { container, rerender } = render(<ProjectsSection controller={first} onGoToSettings={() => {}} />)
    const before = container.querySelector('.sr-proj-viz')

    // A progress tick: same two projects, new counts. Node identity holds.
    const tick = controller(status, {
      checked: 120, total: 3300,
      projects: [proj(1, 60), proj(2, 40)],
    }, 2)
    rerender(<ProjectsSection controller={tick} onGoToSettings={() => {}} />)
    expect(container.querySelector('.sr-proj-viz')).toBe(before)

    // A third project appears: the chartable shape changed, the wrapper remounts.
    const grown = controller(status, { checked: 140, total: 3300, projects: manyProjects(3) }, 3)
    rerender(<ProjectsSection controller={grown} onGoToSettings={() => {}} />)
    const after = container.querySelector('.sr-proj-viz')
    expect(after).toBeTruthy()
    expect(after).not.toBe(before)
  })

  it('portals stay chartless and dotless while the projects block renders', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252,
      projects: manyProjects(3),
      portals: [
        { code: 'EBIRD', label: 'eBird', named: true, checklists: 3000 },
        { code: 'EBIRD_MERLIN', label: 'Merlin', named: true, checklists: 252 },
      ],
    })
    // Exactly ONE chart on the card, and it belongs to the projects block.
    expect(container.querySelectorAll('.sr-proj-viz')).toHaveLength(1)
    const portals = container.querySelector('.sr-proj-portals')!
    expect(portals.querySelector('.sr-proj-dot')).toBeNull()
    expect(portals.closest('.sr-grid-chart-aside')).toBeNull()
  })

  it('chart ownership falls back to portals when no projects exist and portals has ≥2 rows', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252, projects: [],
      portals: [
        { code: 'EBIRD', label: 'eBird', named: true, checklists: 3000 },
        { code: 'EBIRD_MERLIN', label: 'Merlin', named: true, checklists: 252 },
      ],
    })
    const viz = container.querySelector('.sr-proj-viz')!
    expect(viz).toBeTruthy()
    // A portal is NEVER called a project, the caption included.
    expect(viz.querySelector('.sr-proj-viz-cap')!.textContent).toBe('Checklists per portal')
    expect(viz.hasAttribute('inert')).toBe(true)
    // The portal rows own the grid and carry the linking dots.
    const grid = container.querySelector('.sr-grid-chart-aside')!
    expect(grid.querySelectorAll('.sr-proj-portalrow')).toHaveLength(2)
    const dots = [...grid.querySelectorAll('.sr-proj-dot')] as HTMLElement[]
    expect(dots).toHaveLength(2)
    expect(dots[0].parentElement!.className).toContain('nm')
  })

  it('a single portal with no projects stays flat: no chart, no dots', () => {
    const { container } = show({ kind: 'complete', checked: 214, total: 214 }, {
      checked: 214, total: 214, projects: [],
      portals: [{ code: 'EBIRD', label: 'eBird', named: true, checklists: 209 }],
    })
    expect(container.querySelector('.sr-proj-viz')).toBeNull()
    expect(container.querySelector('.sr-proj-dot')).toBeNull()
    expect(container.querySelector('.sr-grid-chart-aside')).toBeNull()
  })

  it('QA-30 still holds with the chart mounted: no identifier is a link, no href anywhere', () => {
    const { container } = show({ kind: 'complete', checked: 3252, total: 3252 }, {
      checked: 3252, projects: manyProjects(5),
    })
    expect(container.querySelectorAll('a')).toHaveLength(0)
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
