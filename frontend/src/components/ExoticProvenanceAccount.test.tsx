// @vitest-environment jsdom
//
// The count-rule account: the seven states and their one message each, which
// controls each state offers, the live region's announcement contract, and the
// disclosure.
//
// A NOTE ON WHAT A jsdom TEST CAN AND CANNOT SETTLE HERE. jsdom has no
// accessibility tree, no layout engine and no stylesheet, so it cannot prove
// that the live region is in the accessibility tree while idle (a
// `display: none` on a `role="status"` breaks announcement entirely and is
// invisible here) and it cannot prove the evidence line wraps. Those two claims
// are held by `exoticAccountCss.test.ts`, which parses the real stylesheet, and
// by the design probe's browser measurement. This file is necessary but not
// sufficient, and says so rather than banking a false confidence.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ExoticProvenanceAccount } from './ExoticProvenanceAccount'
import type { ExcludedSpecies } from '../lib/exoticProvenance'
import type { ProvenanceStatus } from '../lib/useExoticProvenance'

afterEach(cleanup)

const EXCLUDED: ExcludedSpecies[] = [
  { name: 'Graylag Goose', speciesCode: 'graygo', seen: ['X|DNC'], checklistsChecked: 2 },
  { name: 'Muscovy Duck', speciesCode: 'musduc', seen: ['X|DNC'], checklistsChecked: 1 },
]

function renderAccount(status: ProvenanceStatus, over: Partial<{
  excluded: ExcludedSpecies[]; includeEscapees: boolean; statusSeq: number
  onStop: () => void; onRetry: () => void; onGoToSettings: () => void
  /** Give BirdName what it needs to render its real focusables (the name
   *  button plus its two reference links). Off by default so the seven-state
   *  tests stay minimal; on where the tab order is what is being asserted. */
  linked: boolean
}> = {}) {
  const props = {
    status,
    statusSeq: over.statusSeq ?? 1,
    excluded: over.excluded ?? [],
    includeEscapees: over.includeEscapees ?? false,
    onStop: over.onStop ?? vi.fn(),
    onRetry: over.onRetry ?? vi.fn(),
    onGoToSettings: over.onGoToSettings ?? vi.fn(),
    codeFor: over.linked ? (n: string) => `code-${n}` : () => undefined,
    ...(over.linked ? { onOpenSpecies: vi.fn() } : {}),
  }
  return { ...render(<ExoticProvenanceAccount {...props} />), props }
}

// ── The seven states ──────────────────────────────────────────────────────────

describe('the seven states, one message each (FR-31, QA-36)', () => {
  const cases: Array<[string, ProvenanceStatus, RegExp]> = [
    ['not-checked', { kind: 'not-checked' }, /Exotic status has not been checked yet\. Every species counts until it is\./],
    ['in-progress', { kind: 'in-progress', done: 24, planned: 73, additional: 0 }, /Checking exotic status: 24 of 73 checklists\./],
    ['complete', { kind: 'complete', planned: 73, found: 0 }, /Exotic status checked across 73 checklists\./],
    ['partial', { kind: 'partial', done: 40, planned: 73, failed: 0, openSpecies: 5, reason: 'cancelled', cap: 0 }, /Stopped at 40 of 73 checklists\./],
    ['no-key', { kind: 'no-key' }, /No eBird key, so exotic status cannot be checked\. Every species counts\./],
    ['offline', { kind: 'offline', checkedLabel: null }, /Offline, so exotic status cannot be checked\. Every species counts\./],
    ['error', { kind: 'error' }, /eBird could not be reached\. Every species counts until the check succeeds\./],
  ]

  for (const [name, status, message] of cases) {
    it(`${name} renders its own distinct sentence`, () => {
      renderAccount(status)
      expect(screen.getByRole('status').textContent).toMatch(message)
    })
  }

  it('every SETTLED state says what the NUMBER is doing, not only what the network is doing', () => {
    // "Every species counts until it is", "still unchecked and still count":
    // the FR-04 invariant stated in the reader's own terms. A settled state that
    // talked only about the network would leave the reader guessing whether the
    // figure beside it is wrong.
    //
    // `in-progress` is the deliberate exception and is asserted separately
    // below: its account of the number is the definite "24 of 73" figure plus
    // the muted value, both of which say "not final yet" more precisely than a
    // sentence could, and neither of which is colour alone.
    const numberWords = /count|counts|escapee/i
    for (const [name, status] of cases) {
      if (name === 'in-progress') continue
      cleanup()
      renderAccount(status)
      expect(screen.getByRole('status').textContent, name).toMatch(numberWords)
    }
  })

  it('in-progress accounts for the number with a definite figure instead of a clause', () => {
    renderAccount({ kind: 'in-progress', done: 24, planned: 73, additional: 0 })
    expect(screen.getByRole('status').textContent).toMatch(/24 of 73 checklists/)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('24')
  })

  it('each partial reason gets its OWN sentence rather than one message four times', () => {
    const reasons: Array<[ProvenanceStatus, RegExp]> = [
      [{ kind: 'partial', done: 40, planned: 73, failed: 0, openSpecies: 5, reason: 'cancelled', cap: 0 }, /33 checklists were not checked/],
      [{ kind: 'partial', done: 63, planned: 73, failed: 10, openSpecies: 4, reason: 'failures', cap: 0 }, /10 requests failed/],
      [{ kind: 'partial', done: 500, planned: 500, failed: 0, openSpecies: 9, reason: 'pass-budget', cap: 500 }, /limit of 500 requests/],
      [{ kind: 'partial', done: 90, planned: 73, failed: 0, openSpecies: 2, reason: 'species-budget', cap: 25 }, /after 25 checklists each\. Both still count\./],
    ]
    const seen = new Set<string>()
    for (const [status, message] of reasons) {
      cleanup()
      renderAccount(status)
      const text = screen.getByRole('status').textContent ?? ''
      expect(text).toMatch(message)
      seen.add(text)
    }
    expect(seen.size).toBe(4)
  })

  it("the species-budget clause reads 'They all still count.' when it is not exactly two", () => {
    renderAccount({ kind: 'partial', done: 9, planned: 73, failed: 0, openSpecies: 3, reason: 'species-budget', cap: 25 })
    expect(screen.getByRole('status').textContent).toMatch(/They all still count\./)
  })

  it('in-progress names follow-ups as a GROWING clause, never a silently moving denominator', () => {
    renderAccount({ kind: 'in-progress', done: 80, planned: 73, additional: 12 })
    expect(screen.getByRole('status').textContent).toMatch(/24|80 of 73 checklists, plus 12 follow-up checks\./)
  })

  it('complete reports the count found, or says none were', () => {
    renderAccount({ kind: 'complete', planned: 73, found: 3 }, { excluded: EXCLUDED.concat({ name: 'Swan Goose', speciesCode: 'swagoo', seen: ['X|DNC'], checklistsChecked: 1 }) })
    expect(screen.getByRole('status').textContent).toMatch(/3 of your species are eBird escapees\./)
    cleanup()
    renderAccount({ kind: 'complete', planned: 73, found: 0 })
    expect(screen.getByRole('status').textContent).toMatch(/None of your species are eBird escapees\./)
  })

  it('offline names the date of the check it is showing', () => {
    renderAccount({ kind: 'offline', checkedLabel: '14 Jun 2026' })
    expect(screen.getByRole('status').textContent).toMatch(/Showing the check from 14 Jun 2026\./)
  })
})

// ── Which state offers which control ──────────────────────────────────────────

describe('controls per state (FR-31 and its approved deviation)', () => {
  it('in-progress offers Stop and nothing else', () => {
    const onStop = vi.fn()
    renderAccount({ kind: 'in-progress', done: 1, planned: 73, additional: 0 }, { onStop })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /again/ })).toBeNull()
  })

  it('ALL FOUR partial reasons offer "Check again" (the approved FR-31 deviation)', () => {
    // FR-31 as written gives only `error` a retry. The design gate raised and
    // the user approved giving the partial states one too: a birder who presses
    // Stop otherwise has no route back, and because a tab stays mounted once
    // opened, partial (cancelled) would persist for the rest of the session with
    // no way to resume. This is intended behaviour, not a defect against FR-31.
    for (const reason of ['cancelled', 'failures', 'pass-budget', 'species-budget'] as const) {
      cleanup()
      const onRetry = vi.fn()
      renderAccount({ kind: 'partial', done: 1, planned: 2, failed: 0, openSpecies: 1, reason, cap: 25 }, { onRetry })
      fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
      expect(onRetry, reason).toHaveBeenCalledTimes(1)
    }
  })

  it('error offers "Try again", which is a different label from the partial one', () => {
    const onRetry = vi.fn()
    renderAccount({ kind: 'error' }, { onRetry })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull()
  })

  it('no-key offers navigation to Settings, which is not a retry', () => {
    const onGoToSettings = vi.fn()
    const onRetry = vi.fn()
    renderAccount({ kind: 'no-key' }, { onGoToSettings, onRetry })
    fireEvent.click(screen.getByRole('button', { name: 'Add a key in Settings' }))
    expect(onGoToSettings).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /again/ })).toBeNull()
  })

  it('not-checked, complete and offline offer no control at all', () => {
    for (const status of [
      { kind: 'not-checked' },
      { kind: 'complete', planned: 73, found: 0 },
      { kind: 'offline', checkedLabel: null },
    ] as ProvenanceStatus[]) {
      cleanup()
      renderAccount(status)
      expect(screen.queryByRole('button')).toBeNull()
    }
  })
})

// ── Progress ──────────────────────────────────────────────────────────────────

describe('the progress figure (FR-11, QA-17)', () => {
  it('is a DEFINITE figure with its denominator known, never an indeterminate bar', () => {
    renderAccount({ kind: 'in-progress', done: 24, planned: 73, additional: 0 })
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('24')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('73')
    expect(screen.getByText('24 / 73')).toBeTruthy()
  })

  it("the bar's denominator is planned + additional once follow-ups exist", () => {
    renderAccount({ kind: 'in-progress', done: 80, planned: 73, additional: 12 })
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('85')
    expect(screen.getByText('80 / 85')).toBeTruthy()
  })

  it('is CONDITIONALLY RENDERED, so it cannot survive into a non-running state', () => {
    // The mockup's third defect: `[hidden]` lost to an author `display: flex`,
    // so the progress row survived into every state that was not a running pass.
    // In React that is expressed as conditional rendering, and this is the
    // assertion that keeps it so.
    for (const status of [
      { kind: 'not-checked' },
      { kind: 'complete', planned: 73, found: 0 },
      { kind: 'partial', done: 1, planned: 2, failed: 0, openSpecies: 1, reason: 'cancelled', cap: 0 },
      { kind: 'error' },
      { kind: 'no-key' },
      { kind: 'offline', checkedLabel: null },
    ] as ProvenanceStatus[]) {
      cleanup()
      renderAccount(status)
      expect(screen.queryByRole('progressbar'), status.kind).toBeNull()
    }
  })
})

// ── The live region ───────────────────────────────────────────────────────────

describe('the live region (NFR-06, QA-54)', () => {
  it('is rendered from first paint in EVERY state, idle included', () => {
    for (const status of [
      { kind: 'not-checked' },
      { kind: 'in-progress', done: 0, planned: 73, additional: 0 },
      { kind: 'complete', planned: 73, found: 0 },
      { kind: 'no-key' },
      { kind: 'offline', checkedLabel: null },
      { kind: 'error' },
    ] as ProvenanceStatus[]) {
      cleanup()
      renderAccount(status)
      const region = screen.getByRole('status')
      expect(region.getAttribute('aria-live')).toBe('polite')
      expect(region.hasAttribute('hidden')).toBe(false)
      expect((region.textContent ?? '').length).toBeGreaterThan(0)
    }
  })

  it('re-keys its message child on every status update, so an identical repeat still announces', async () => {
    // `aria-live` fires on DOM MUTATION, and React bails out when reconciling a
    // text node to an identical string, so pressing "Check again" twice would
    // otherwise announce once while the visible sentence re-renders both times
    // and every textContent assertion stays green.
    const status: ProvenanceStatus = { kind: 'partial', done: 40, planned: 73, failed: 0, openSpecies: 5, reason: 'cancelled', cap: 0 }
    const { rerender } = renderAccount(status, { statusSeq: 7 })
    const region = screen.getByRole('status')
    const before = region.querySelector('.sr-exotic-msg')

    let mutations = 0
    const observer = new MutationObserver(records => { mutations += records.length })
    observer.observe(region, { childList: true, subtree: true, characterData: true })

    // The SAME message, a new sequence: the pressed-twice case.
    rerender(
      <ExoticProvenanceAccount
        status={status} statusSeq={8} excluded={[]} includeEscapees={false}
        onStop={vi.fn()} onRetry={vi.fn()} onGoToSettings={vi.fn()} codeFor={() => undefined}
      />,
    )
    // MutationObserver delivers at the microtask checkpoint, so the records are
    // not available synchronously after the re-render.
    await Promise.resolve()
    observer.disconnect()

    const after = screen.getByRole('status').querySelector('.sr-exotic-msg')
    // A real node REPLACEMENT, not merely a re-render of the same node.
    //
    // The mutation count DOES discriminate here, which is worth stating because
    // it does not always: the region and its message node both stay mounted
    // across this re-render, so an UNKEYED child would reconcile the identical
    // string, React would bail out, and the observer would record ZERO
    // mutations. (Where the message node unmounts between states, the remount is
    // already a DOM addition and an unkeyed child passes the same check.)
    expect(after).not.toBe(before)
    expect(mutations).toBeGreaterThan(0)
    // ...and the region's textContent is still EXACTLY the message. Forcing a
    // diff by appending an invisible character would make every textContent
    // assertion in this file quietly false.
    expect(screen.getByRole('status').textContent).toMatch(/^Stopped at 40 of 73 checklists\./)
  })

  it('status is carried in WORDS, so the muted figure and tinted icon are cues only', () => {
    // WCAG 1.4.1. Every icon in the region is aria-hidden, so nothing about the
    // state is available only as colour or only as an icon.
    renderAccount({ kind: 'error' })
    const region = screen.getByRole('status')
    for (const svg of region.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
    }
    expect(region.textContent).toMatch(/eBird could not be reached/)
  })
})

// ── The disclosure ────────────────────────────────────────────────────────────

describe('the disclosure (FR-32, QA-37)', () => {
  it('appears only once a species has been found', () => {
    renderAccount({ kind: 'complete', planned: 73, found: 0 })
    expect(screen.queryByRole('button', { name: /escapee/ })).toBeNull()
  })

  it('names each excluded species with its own evidence', () => {
    renderAccount({ kind: 'complete', planned: 73, found: 2 }, { excluded: EXCLUDED })
    fireEvent.click(screen.getByRole('button', { name: /Show the 2 escapees/ }))
    expect(screen.getByText('Exotic: Escapee · 2 checklists checked')).toBeTruthy()
    expect(screen.getByText('Exotic: Escapee · 1 checklist checked')).toBeTruthy()
    expect(screen.getAllByText('Graylag Goose').length).toBeGreaterThan(0)
  })

  it('is collapsed by default and toggles aria-expanded against its panel', () => {
    renderAccount({ kind: 'complete', planned: 73, found: 2 }, { excluded: EXCLUDED })
    const button = screen.getByRole('button', { name: /Show the 2 escapees/ })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const panelId = button.getAttribute('aria-controls')!
    expect(document.getElementById(panelId)).toBeTruthy()
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: /Hide the 2 escapees/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('the COLLAPSED panel leaves nothing in the tab order or the accessibility tree', () => {
    // The panel is clipped by grid-template-rows, not unmounted, so without
    // `inert` its bird-name buttons and their two link icons stay focusable and
    // stay in the accessibility tree while aria-expanded says "false" (WCAG
    // 2.4.3 and 4.1.2). jsdom implements neither focus scoping nor an
    // accessibility tree, so the honest assertion here is the MECHANISM: the
    // attribute is present when collapsed and absent when open. The behaviour
    // it produces was measured in a real browser.
    renderAccount({ kind: 'complete', planned: 73, found: 2 }, { excluded: EXCLUDED, linked: true })
    const button = screen.getByRole('button', { name: /Show the 2 escapees/ })
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!
    const inner = panel.firstElementChild as HTMLElement

    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(inner.hasAttribute('inert')).toBe(true)
    // Non-vacuity: the focusables really are present in the DOM, so the guard
    // is about them being neutralized rather than about an empty panel.
    expect(inner.querySelectorAll('button, a').length).toBeGreaterThan(0)

    fireEvent.click(button)
    expect(screen.getByRole('button', { name: /Hide the 2 escapees/ }).getAttribute('aria-expanded')).toBe('true')
    expect((document.getElementById(panel.id)!.firstElementChild as HTMLElement).hasAttribute('inert')).toBe(false)
  })

  it('gains "found so far" only while a pass is running', () => {
    renderAccount({ kind: 'in-progress', done: 5, planned: 73, additional: 0 }, { excluded: EXCLUDED })
    expect(screen.getByRole('button', { name: /Show the 2 escapees found so far/ })).toBeTruthy()
    cleanup()
    renderAccount({ kind: 'complete', planned: 73, found: 2 }, { excluded: EXCLUDED })
    expect(screen.getByRole('button', { name: 'Show the 2 escapees' })).toBeTruthy()
  })

  it('uses the singular at exactly one species', () => {
    renderAccount({ kind: 'complete', planned: 73, found: 1 }, { excluded: [EXCLUDED[1]] })
    expect(screen.getByRole('button', { name: 'Show the 1 escapee' })).toBeTruthy()
  })

  it('STAYS AVAILABLE with the toggle on, reframed as information', () => {
    renderAccount({ kind: 'complete', planned: 73, found: 2 }, { excluded: EXCLUDED, includeEscapees: true })
    fireEvent.click(screen.getByRole('button', { name: /Show the 2 escapees/ }))
    expect(screen.getByText(/They are counted here because Count escapees is on\./)).toBeTruthy()
    expect(screen.queryByText(/They stay on your Life List\./)).toBeNull()
  })
})

// ── The standing rule ─────────────────────────────────────────────────────────

describe('the standing rule line', () => {
  it('is present in every state and follows the toggle', () => {
    renderAccount({ kind: 'not-checked' })
    expect(screen.getByText(/Escapees do not count toward Species, following eBird\./)).toBeTruthy()
    // The anti-shortcut promise made visible: a birder never has to wonder
    // whether their Indian Peafowl or Red Junglefowl quietly vanished.
    expect(screen.getByText(/Naturalized and provisional exotics do count\./)).toBeTruthy()
    cleanup()
    renderAccount({ kind: 'not-checked' }, { includeEscapees: true })
    expect(screen.getByText(/this total will read higher than the one eBird shows you\./)).toBeTruthy()
  })
})

// ── Copy hygiene ──────────────────────────────────────────────────────────────

describe('copy hygiene (FR-44, QA-50)', () => {
  it('no user-facing string in this feature contains an em dash', async () => {
    // The standing sweep. This asserts against the copy module itself rather
    // than the rendered DOM, so a string that only appears in an unrendered
    // state is covered too.
    const copy = await import('../lib/exoticCopy')
    const rendered: string[] = []
    for (const [, value] of Object.entries(copy)) {
      if (typeof value === 'string') rendered.push(value)
    }
    for (const s of [
      ...rendered,
      copy.statusSentence({ kind: 'not-checked' }, 0),
      copy.statusSentence({ kind: 'in-progress', done: 1, planned: 2, additional: 3 }, 0),
      copy.statusSentence({ kind: 'complete', planned: 2, found: 1 }, 1),
      copy.statusSentence({ kind: 'complete', planned: 2, found: 0 }, 0),
      copy.statusSentence({ kind: 'no-key' }, 0),
      copy.statusSentence({ kind: 'offline', checkedLabel: '1 Jan 2026' }, 0),
      copy.statusSentence({ kind: 'offline', checkedLabel: null }, 0),
      copy.statusSentence({ kind: 'error' }, 0),
      ...(['cancelled', 'failures', 'pass-budget', 'species-budget'] as const).map(reason =>
        copy.statusSentence({ kind: 'partial', done: 1, planned: 2, failed: 1, openSpecies: 2, reason, cap: 25 }, 0)),
      copy.discloseLabel(1, false, false),
      copy.evidenceLine(1),
    ]) {
      expect(s.includes('—'), s).toBe(false)
      expect(s.includes('’'), s).toBe(false)   // straight apostrophes only
    }
    expect(rendered.length).toBeGreaterThanOrEqual(7)
  })
})
