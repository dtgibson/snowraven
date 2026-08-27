// @vitest-environment jsdom
//
// The "Color pins by" block (QA-01 / QA-09 / FR-12 / FR-14): exactly four
// mode options with the approved labels, the window row present only while
// Recent activity is active (Week default, no "Day" rung), the always-
// rendered status live region with its sequence-keyed child, the progress
// track, the classified warn box + supporting lines, and the retry pill.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HotspotModeControl } from './HotspotModeControl'
import type { HotspotModeControlProps } from './HotspotModeControl'

afterEach(cleanup)

const DONE_STATUS = {
  phase: 'done' as const, answered: 19, target: 19, cappedCount: 0,
  cacheServed: 0, liveFetched: 19, failedCount: 0,
  latestCachedAt: null, latestAnswerAt: 100, rateLimited: false, error: null, seq: 3,
}

function renderControl(over: Partial<HotspotModeControlProps> = {}) {
  const props: HotspotModeControlProps = {
    mode: 'default', onModeChange: vi.fn(), window: 7, onWindowChange: vi.fn(),
    status: null, windowFlipped: false, onRetry: vi.fn(),
    tierRings: false, onTierRingsChange: vi.fn(),
    ...over,
  }
  return { ...render(<HotspotModeControl {...props} />), props }
}

/** The switch is queried by selector (not getByRole) because half these tests
 *  exercise it INSIDE an inert boundary. */
function tierRingsSwitch(container: HTMLElement): HTMLElement {
  return container.querySelector('[aria-label="Use tier rings on hotspot color modes"]')!
}

describe('mode selector (FR-01, QA-01)', () => {
  it('offers exactly the four approved options, default pressed', () => {
    renderControl()
    for (const label of ['Visited status', 'My species', 'My checklists', 'Recent activity']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Visited status' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'My species' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('selecting a pill dispatches the label-agnostic semantic value', () => {
    const { props } = renderControl()
    fireEvent.click(screen.getByRole('button', { name: 'Recent activity' }))
    expect(props.onModeChange).toHaveBeenCalledWith('activity')
    fireEvent.click(screen.getByRole('button', { name: 'My checklists' }))
    expect(props.onModeChange).toHaveBeenCalledWith('myChecklists')
  })
})

describe('window row (FR-10, QA-09)', () => {
  it('exactly two windows, Week and 30 days, no Day rung; Week default-pressed', () => {
    renderControl({ mode: 'activity' })
    expect(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '30 days' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Day' })).toBeNull()
  })

  it('is inert (no stray tab stops) in every other mode', () => {
    const { container } = renderControl({ mode: 'mySpecies' })
    const reveal = container.querySelector('.sr-hotspot-reveal')!
    expect(reveal.classList.contains('sr-hotspot-reveal--open')).toBe(false)
    expect(reveal.querySelector('[inert]')).toBeTruthy()
  })

  it('carries NO inert attribute while Recent activity is active (literal absence)', () => {
    // Both-states rule (the v0.5.87 escapee-panel precedent): pre-19 React
    // rendered inert={false} as the truthy string "false", which would pin the
    // Week / 30 days pills permanently inert with the presence test above
    // still green. [inert] matches the attribute regardless of value, so a
    // null here asserts the literal attribute is absent, not merely falsy.
    const { container } = renderControl({ mode: 'activity' })
    const reveal = container.querySelector('.sr-hotspot-reveal')!
    expect(reveal.classList.contains('sr-hotspot-reveal--open')).toBe(true)
    expect(reveal.querySelector('[inert]')).toBeNull()
  })

  it('dispatches the numeric window value', () => {
    const { props } = renderControl({ mode: 'activity' })
    fireEvent.click(screen.getByRole('button', { name: '30 days' }))
    expect(props.onWindowChange).toHaveBeenCalledWith(30)
  })
})

describe('Use Tier Rings switch (colorblind-accessible-hotspot-pins)', () => {
  it('is revealed (reveal open, no inert boundary) in every non-default mode', () => {
    for (const mode of ['mySpecies', 'myChecklists', 'activity'] as const) {
      const { container } = renderControl({ mode })
      const sw = tierRingsSwitch(container)
      expect(sw, mode).toBeTruthy()
      expect(sw.getAttribute('role')).toBe('switch')
      const reveal = sw.closest('.sr-hotspot-reveal')!
      expect(reveal.classList.contains('sr-hotspot-reveal--open'), mode).toBe(true)
      // Literal-absence rule (the v0.5.87 both-states inert precedent).
      expect(sw.closest('[inert]'), mode).toBeNull()
      cleanup()
    }
  })

  it('is collapsed + inert in default mode, and the status live region stays OUTSIDE every inert boundary', () => {
    const { container } = renderControl({ mode: 'default' })
    const sw = tierRingsSwitch(container)
    const reveal = sw.closest('.sr-hotspot-reveal')!
    expect(reveal.classList.contains('sr-hotspot-reveal--open')).toBe(false)
    expect(sw.closest('[inert]')).toBeTruthy()
    // The v0.5.92 rule: inert removes a subtree from the accessibility tree,
    // so the role="status" region must never sit inside one.
    expect(screen.getByRole('status').closest('[inert]')).toBeNull()
  })

  it('carries the approved label, explainer, and aria-checked from the persisted value', () => {
    const { container } = renderControl({ mode: 'mySpecies', tierRings: true })
    expect(screen.getByText('Use Tier Rings')).toBeTruthy()
    expect(screen.getByText('Adds a segmented ring per tier so pins are readable without color.')).toBeTruthy()
    expect(tierRingsSwitch(container).getAttribute('aria-checked')).toBe('true')
    cleanup()
    const off = renderControl({ mode: 'mySpecies', tierRings: false })
    expect(tierRingsSwitch(off.container).getAttribute('aria-checked')).toBe('false')
  })

  it('a press dispatches the toggled value in both directions', () => {
    const { container, props } = renderControl({ mode: 'mySpecies', tierRings: false })
    fireEvent.click(tierRingsSwitch(container))
    expect(props.onTierRingsChange).toHaveBeenCalledWith(true)
    cleanup()
    const second = renderControl({ mode: 'activity', tierRings: true })
    fireEvent.click(tierRingsSwitch(second.container))
    expect(second.props.onTierRingsChange).toHaveBeenCalledWith(false)
  })
})

describe('status region (FR-12 — always rendered, sequence-keyed child)', () => {
  it('the role=status region exists in EVERY mode, before any message', () => {
    renderControl({ mode: 'default' })
    expect(screen.getByRole('status')).toBeTruthy()
    cleanup()
    renderControl({ mode: 'activity', status: null })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('running: the N-of-M sentence and the progress track', () => {
    const { container } = renderControl({
      mode: 'activity',
      status: { ...DONE_STATUS, phase: 'running', answered: 14, target: 19 },
    })
    expect(screen.getByRole('status').textContent).toContain('Checking activity: 14 of 19 hotspots')
    const fill = container.querySelector('.sr-hotspot-progress-fill') as HTMLElement
    expect(fill).toBeTruthy()
    expect(fill.style.width).toBe('74%')
  })

  it('a rate-limited running status carries the slowdown line in the live region (429 pacing revision)', () => {
    renderControl({
      mode: 'activity',
      status: { ...DONE_STATUS, phase: 'running', answered: 14, target: 19, rateLimited: true },
    })
    expect(screen.getByRole('status').textContent)
      .toBe('Checking activity: 14 of 19 hotspots. eBird asked us to slow down, so this is taking a little longer.')
  })

  it('done: the checked-just-now sentence, no progress track', () => {
    const { container } = renderControl({ mode: 'activity', status: DONE_STATUS })
    expect(screen.getByRole('status').textContent).toBe('All 19 hotspots checked just now.')
    expect(container.querySelector('.sr-hotspot-progress-track')).toBeNull()
  })

  it('the cap sentences render in words when the cap bit (FR-19, QA-20)', () => {
    renderControl({ mode: 'activity', status: { ...DONE_STATUS, cappedCount: 14 } })
    expect(screen.getByText('Checked 200 hotspots: on your screen first, then nearest your search center.')).toBeTruthy()
    expect(screen.getByText(/14 more stay in the not-checked gray\. Search a smaller area/)).toBeTruthy()
  })
})

describe('degradation + retry (FR-14, QA-13)', () => {
  it('an error status renders the classified warn box, the supporting line, and a retry pill', () => {
    const { props } = renderControl({
      mode: 'activity',
      status: {
        ...DONE_STATUS, answered: 12, target: 19,
        error: { kind: 'error' as const, message: 'Something went wrong. Please try again.' },
      },
    })
    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy()
    expect(screen.getByText('12 hotspots kept the answers that already arrived. Retry re-asks only the 7 that failed.')).toBeTruthy()
    const retry = screen.getByRole('button', { name: /Retry/ })
    fireEvent.click(retry)
    expect(props.onRetry).toHaveBeenCalledTimes(1)
  })

  it('the offline state carries the reassurance that modes 1/2 still work', () => {
    renderControl({
      mode: 'activity',
      status: {
        ...DONE_STATUS, answered: 11, target: 19, latestAnswerAt: 42,
        error: { kind: 'offline' as const, message: "You're offline. This needs a connection." },
      },
    })
    expect(screen.getByText('My species and My checklists still work fully offline.')).toBeTruthy()
    expect(screen.getByText(/Showing cached activity for 11 hotspots/)).toBeTruthy()
  })

  it('the no-key state names the requirement', () => {
    renderControl({
      mode: 'activity',
      status: {
        ...DONE_STATUS, answered: 0, liveFetched: 0,
        error: { kind: 'no-key' as const, message: 'eBird API key not configured. Add it in Settings.' },
      },
    })
    expect(screen.getByText('Recent activity needs your own eBird key. Pins stay in the not-checked gray until one is added.')).toBeTruthy()
  })
})
