// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react'
import { NamedBirdMedia } from './NamedBirdMedia'
import type { NamedBirdAsset } from '../lib/namedBirdMedia'

// jsdom has no IntersectionObserver — the component falls back to "in view when
// open" (its documented safe degradation), which is exactly what we want to test:
// with that fallback, an open row mounts iframes immediately.
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', undefined)
  // Default: online.
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function asset(partial: Partial<NamedBirdAsset>): NamedBirdAsset {
  return { catalogId: '1', format: 'Photo', date: '2024-06-01', checklistId: 'S1', ...partial }
}

function assets(n: number): NamedBirdAsset[] {
  return Array.from({ length: n }, (_, i) =>
    asset({ catalogId: String(100 + i), date: `2024-06-${String((i % 28) + 1).padStart(2, '0')}` }))
}

describe('NamedBirdMedia — presence gates (FR-16 / FR-17)', () => {
  it('renders nothing when no ML export is loaded (hasML=false)', () => {
    const { container } = render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[]} open hasML={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the muted empty state when ML is loaded but no assets match', () => {
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[]} open hasML />)
    expect(screen.getByText('No media matched to this bird.')).toBeTruthy()
    expect(screen.queryByTitle(/of Winky/)).toBeNull() // no iframe
  })

  it('does not mount any embed when the row is closed (FR-11)', () => {
    const { container } = render(<NamedBirdMedia embedAllowed birdName="Winky" assets={assets(3)} open={false} hasML />)
    expect(container.querySelector('iframe')).toBeNull()
  })
})

describe('NamedBirdMedia — app-wide disabled state', () => {
  it('shows one exact note, preserves every local row and direct link, and mounts no player UI', () => {
    const { container } = render(
      <NamedBirdMedia
        embedAllowed={false}
        birdName="Winky"
        assets={[
          asset({ catalogId: '77', date: '2024-06-08', checklistId: 'S9' }),
          asset({ catalogId: '78', format: 'Audio', date: '2024-06-09', checklistId: 'S10' }),
        ]}
        open
        hasML
      />,
    )

    expect(screen.getAllByText('Embedded media is disabled in Settings.')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe('Embedded media is disabled in Settings.')
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('.sr-media-shimmer')).toBeNull()
    expect(screen.queryByText(/Media couldn't load|Media unavailable offline/i)).toBeNull()
    expect(screen.getByText('Jun 8, 2024')).toBeTruthy()
    expect(screen.getByText('Jun 9, 2024')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Macaulay Library \(ML77\)/i }).getAttribute('href'))
      .toBe('https://macaulaylibrary.org/asset/77')
    expect(screen.getByRole('link', { name: /open checklist S9 on eBird/i })).toBeTruthy()
  })

  it('does not show the disabled note without an ML export, matching assets, or an expanded row', () => {
    const { rerender } = render(
      <NamedBirdMedia embedAllowed={false} birdName="Winky" assets={assets(1)} open hasML={false} />,
    )
    expect(screen.queryByText('Embedded media is disabled in Settings.')).toBeNull()

    rerender(<NamedBirdMedia embedAllowed={false} birdName="Winky" assets={[]} open hasML />)
    expect(screen.queryByText('Embedded media is disabled in Settings.')).toBeNull()

    rerender(<NamedBirdMedia embedAllowed={false} birdName="Winky" assets={assets(1)} open={false} hasML />)
    expect(screen.queryByText('Embedded media is disabled in Settings.')).toBeNull()
  })

  it('restores the existing lazy player path immediately when embeds are re-enabled', () => {
    const props = { birdName: 'Winky', assets: assets(1), open: true, hasML: true }
    const { container, rerender } = render(<NamedBirdMedia {...props} embedAllowed={false} />)
    expect(container.querySelector('iframe')).toBeNull()

    rerender(<NamedBirdMedia {...props} embedAllowed />)
    expect(container.querySelector('iframe')).toBeTruthy()
    expect(screen.queryByText('Embedded media is disabled in Settings.')).toBeNull()
  })
})

describe('NamedBirdMedia — embed rendering + labels (FR-06/07/08)', () => {
  it('renders the header and one iframe per shown asset with a descriptive title', () => {
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={assets(2)} open hasML />)
    expect(screen.getByText('Media of Winky')).toBeTruthy()
    const frames = document.querySelectorAll('iframe')
    expect(frames.length).toBe(2)
    expect(frames[0].getAttribute('title')).toMatch(/^Photo of Winky \(/)
    // Embed URL uses the /embed pattern with the catalog id.
    expect(frames[0].getAttribute('src')).toMatch(/macaulaylibrary\.org\/asset\/100\/embed$/)
  })

  it('labels each item with its date and a checklist link (FR-08/09)', () => {
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '5', date: '2024-06-08', checklistId: 'S42' })]} open hasML />)
    expect(screen.getByText('Jun 8, 2024')).toBeTruthy()
    const link = screen.getByRole('link', { name: /open checklist S[0-9]+ on eBird/i })
    expect(link.getAttribute('href')).toBe('https://ebird.org/checklist/S42')
  })

  it('omits the checklist link (and does not 404) for an invalid checklistId, still shows the date', () => {
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '5', date: '2024-06-08', checklistId: 'garbage' })]} open hasML />)
    expect(screen.getByText('Jun 8, 2024')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /open checklist S[0-9]+ on eBird/i })).toBeNull()
  })
})

describe('NamedBirdMedia — bounded batch + Show more (FR-12)', () => {
  it('renders only the initial batch and a keyboard-operable Show more', () => {
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={assets(11)} open hasML initialCount={6} />)
    expect(document.querySelectorAll('iframe').length).toBe(6)
    expect(screen.getByText('Showing 6 of 11')).toBeTruthy()

    const more = screen.getByRole('button', { name: /Show 5 more \(of 11\)/ })
    expect(more.textContent).toContain('Show 5 more (of 11)')

    fireEvent.click(more)
    expect(document.querySelectorAll('iframe').length).toBe(11)
    // All revealed → no more button, no count line.
    expect(screen.queryByRole('button', { name: /Show .* more/ })).toBeNull()
  })

  it('batches reveal by batchSize (default = initialCount)', () => {
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={assets(20)} open hasML initialCount={6} />)
    expect(document.querySelectorAll('iframe').length).toBe(6)
    fireEvent.click(screen.getByRole('button', { name: /Show 6 more \(of 20\)/ }))
    expect(document.querySelectorAll('iframe').length).toBe(12)
  })

  it('the Show more accessible name CONTAINS the visible label text (WCAG 2.5.3)', () => {
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={assets(11)} open hasML initialCount={6} />)
    const btn = screen.getByRole('button', { name: /Show 5 more/ })
    const visible = 'Show 5 more (of 11)'
    // Visible text is exactly the label…
    expect(btn.textContent).toContain(visible)
    // …and the accessible name is a SUPERSTRING of that visible text.
    const accName = btn.getAttribute('aria-label')!
    expect(accName).toContain(visible)
    expect(accName).toBe('Show 5 more (of 11): media of Winky')
  })

  it('does not drop focus to <body> when the final reveal exhausts the list (WCAG 2.4.3)', () => {
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={assets(8)} open hasML initialCount={6} />)
    const more = screen.getByRole('button', { name: /Show 2 more \(of 8\)/ })
    more.focus()
    fireEvent.click(more) // reveals the last 2 → button unmounts
    // Focus moved to the first newly-revealed tile (index 6), not <body>.
    expect(document.activeElement).not.toBe(document.body)
    const focused = document.activeElement as HTMLElement
    expect(focused.getAttribute('data-media-index')).toBe('6')
  })
})

describe('NamedBirdMedia — offline fallback (FR-14/15, NFR-04)', () => {
  it('shows the placeholder + ML link-out + date + checklist, no iframe, when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '77', date: '2024-06-08', checklistId: 'S9' })]} open hasML />)

    // No iframe while offline.
    expect(document.querySelector('iframe')).toBeNull()
    // Placeholder message + link-out to the single-asset ML URL.
    expect(screen.getByText('Media unavailable offline')).toBeTruthy()
    const out = screen.getByRole('link', { name: /View Photo on Macaulay Library/i })
    expect(out.getAttribute('href')).toBe('https://macaulaylibrary.org/asset/77')
    // Local metadata still present.
    expect(screen.getByText('Jun 8, 2024')).toBeTruthy()
    expect(screen.getByRole('link', { name: /open checklist S[0-9]+ on eBird/i }).getAttribute('href'))
      .toBe('https://ebird.org/checklist/S9')
  })

  it('flips to the embed live when the app comes back online', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '88' })]} open hasML />)
    expect(document.querySelector('iframe')).toBeNull()

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    fireEvent(window, new Event('online'))
    expect(document.querySelector('iframe')).toBeTruthy()
  })
})

describe('NamedBirdMedia — slow / broken embed give-up timer (non-destructive)', () => {
  // The give-up timeout must OVERLAY a fallback, never tear the iframe down — so a
  // slow-but-working embed that fires onLoad after the deadline still wins.
  it('slow load: timer fires → fallback overlay shows → a late onLoad swaps the real embed in', () => {
    vi.useFakeTimers()
    try {
      render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '55' })]} open hasML />)
      const frame = document.querySelector('iframe')!
      // Before the deadline: no give-up fallback.
      expect(screen.queryByText("Media couldn't load")).toBeNull()

      // Fire the give-up timer.
      act(() => { vi.advanceTimersByTime(21000) })
      // Fallback overlay is shown, but the iframe is STILL mounted underneath.
      expect(screen.getByText("Media couldn't load")).toBeTruthy()
      expect(document.querySelector('iframe')).toBe(frame) // same node, not torn down

      // A LATE onLoad still wins: the overlay disappears, the real embed shows.
      act(() => { fireEvent.load(frame) })
      expect(screen.queryByText("Media couldn't load")).toBeNull()
      expect(document.querySelector('iframe')).toBe(frame)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never loads: timer fires and the fallback stays, still with the link-out', () => {
    vi.useFakeTimers()
    try {
      render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '56' })]} open hasML />)
      act(() => { vi.advanceTimersByTime(21000) })
      expect(screen.getByText("Media couldn't load")).toBeTruthy()
      // The link-out is present in the overlay (never a dead frame).
      expect(screen.getByRole('link', { name: /View Photo on Macaulay Library/i }).getAttribute('href'))
        .toBe('https://macaulaylibrary.org/asset/56')
      // Advancing further changes nothing (idempotent).
      act(() => { vi.advanceTimersByTime(60000) })
      expect(screen.getByText("Media couldn't load")).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  // NOTE on onError: React's synthetic iframe `onError` does not fire from
  // `fireEvent.error` under jsdom (only `load` is reliably delivered), so the
  // loaded-but-broken path is exercised here via the give-up TIMER — which is the
  // guaranteed trigger and the primary protection; onError is a best-effort belt on
  // top of it in the real browser. The give-up overlay is non-destructive: the
  // iframe stays mounted, so a late onLoad recovers in place.
  it('a give-up overlay does not unmount the iframe, and a later onLoad recovers in place', () => {
    vi.useFakeTimers()
    try {
      render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '57' })]} open hasML />)
      const frame = document.querySelector('iframe')!
      act(() => { vi.advanceTimersByTime(21000) })
      expect(screen.getByText("Media couldn't load")).toBeTruthy()
      expect(document.querySelector('iframe')).toBe(frame) // still mounted
      act(() => { fireEvent.load(frame) })
      expect(screen.queryByText("Media couldn't load")).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('NamedBirdMedia — reconnection recovery re-attempts a fresh embed', () => {
  it('offline → online remounts a fresh iframe (clean latch state)', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '58' })]} open hasML />)
    // Offline: fallback, no iframe.
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getByText('Media unavailable offline')).toBeTruthy()

    // Come back online → a fresh iframe mounts and re-attempts.
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    act(() => { fireEvent(window, new Event('online')) })
    const frame = document.querySelector('iframe')
    expect(frame).toBeTruthy()
    // The fresh frame is in its clean loading state (no give-up overlay yet).
    expect(screen.queryByText("Media couldn't load")).toBeNull()
  })

  it('a gave-up embed recovers to a fresh attempt after a flap offline→online', () => {
    vi.useFakeTimers()
    try {
      render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '59' })]} open hasML />)
      // Drive it into the give-up (broken) overlay via the timer.
      act(() => { vi.advanceTimersByTime(21000) })
      expect(screen.getByText("Media couldn't load")).toBeTruthy()

      // Flap offline then back online → the frame remounts with clean state.
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      act(() => { fireEvent(window, new Event('offline')) })
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      act(() => { fireEvent(window, new Event('online')) })

      // The previous give-up latch is gone; a fresh iframe is loading again.
      expect(screen.queryByText("Media couldn't load")).toBeNull()
      expect(document.querySelector('iframe')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('NamedBirdMedia — safe ids (FR-18 / QA-20)', () => {
  it('does not build an embed or link for a non-numeric catalog id (falls back safely)', () => {
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: 'not-a-number', checklistId: 'S1' })]} open hasML />)
    // No iframe (invalid id short-circuits to the fallback).
    expect(document.querySelector('iframe')).toBeNull()
    // No ML link-out for an unguarded id either.
    expect(screen.queryByRole('link', { name: /Macaulay Library/i })).toBeNull()
  })

  it('encodeURIComponent-wraps the catalog id in the embed src', () => {
    // A pure-digit id needs no escaping, but assert the /embed pattern is exact.
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '123456' })]} open hasML />)
    const frame = document.querySelector('iframe')!
    expect(frame.getAttribute('src')).toBe('https://macaulaylibrary.org/asset/123456/embed')
  })
})

// ── Audio fallback density: BOTH failure modes, BOTH call sites ────────────────
//
// Audio used to render the COMPACT fallback (icon + link, no message) because its
// 116px tile had no room for a sentence. v0.5.75 grew the tile to a full 230px, so
// audio takes the FULL fallback like photo and video.
//
// The trap this guards: NamedBirdMedia reaches MediaFallback down TWO independent
// paths — the offline placeholder it renders directly, and the give-up/failed
// overlay MediaFrame renders internally — and MediaFrame USED TO default `compact`
// to `format === 'Audio'` on its own. So passing compact={false} at only the first
// call site would give the same audio tile a message when offline and no message
// when the embed fails, which is worse than either behavior consistently. Each test
// below drives ONE of those two paths; do not collapse them into one case.
describe('NamedBirdMedia — audio takes the FULL fallback in both failure modes', () => {
  it('OFFLINE path (direct MediaFallback call site): audio shows the message AND the link-out', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '90', format: 'Audio', date: '2024-06-08', checklistId: 'S9' })]} open hasML />)

    // The message audio previously suppressed.
    expect(screen.getByText('Media unavailable offline')).toBeTruthy()
    const out = screen.getByRole('link', { name: /View Audio on Macaulay Library/i })
    expect(out.getAttribute('href')).toBe('https://macaulaylibrary.org/asset/90')
    // The meta row is outside the frame and unaffected by fallback density.
    const item = out.closest<HTMLElement>('.sr-media-item')!
    expect(within(item).getByText('Audio')).toBeTruthy()
    expect(screen.getByText('Jun 8, 2024')).toBeTruthy()
    expect(screen.getByRole('link', { name: /open checklist S[0-9]+ on eBird/i }).getAttribute('href'))
      .toBe('https://ebird.org/checklist/S9')
  })

  it('GIVE-UP path (MediaFrame overlay call site): audio shows the message AND keeps the iframe mounted', () => {
    vi.useFakeTimers()
    try {
      render(<NamedBirdMedia embedAllowed birdName="Winky" assets={[asset({ catalogId: '91', format: 'Audio', date: '2024-06-08', checklistId: 'S9' })]} open hasML />)
      const frame = document.querySelector('iframe')!

      act(() => { vi.advanceTimersByTime(21000) })

      // This is the assertion that fails if only the offline call site was fixed:
      // MediaFrame's own `compact` would still default to true for Audio.
      expect(screen.getByText("Media couldn't load")).toBeTruthy()
      expect(screen.getByRole('link', { name: /View Audio on Macaulay Library/i }).getAttribute('href'))
        .toBe('https://macaulaylibrary.org/asset/91')
      // Non-destructive overlay: same iframe node, and a late load still recovers.
      expect(document.querySelector('iframe')).toBe(frame)
      act(() => { fireEvent.load(frame) })
      expect(screen.queryByText("Media couldn't load")).toBeNull()
      expect(document.querySelector('iframe')).toBe(frame)
    } finally {
      vi.useRealTimers()
    }
  })

  it('audio and photo now degrade identically — no format-dependent fallback density', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(
      <NamedBirdMedia
        embedAllowed
        birdName="Winky"
        assets={[
          asset({ catalogId: '92', format: 'Audio' }),
          asset({ catalogId: '93', format: 'Photo' }),
        ]}
        open
        hasML
      />,
    )
    // One message per tile: audio is no longer the odd one out.
    expect(screen.getAllByText('Media unavailable offline')).toHaveLength(2)
  })
})

describe('NamedBirdMedia — per-format frame height classes', () => {
  // The height lives on the FRAME as well as the iframe so the shimmer, the player,
  // the fallback, and the disabled notice all occupy the identical box (no layout
  // shift between states). Audio must carry its OWN class, not Species Detail's
  // --recent: the two surfaces are numerically equal today but stay independently
  // tunable (the v0.5.71 per-caller-height decision).
  it('each format keeps its own height class on the frame', () => {
    const { container } = render(
      <NamedBirdMedia
        embedAllowed
        birdName="Winky"
        assets={[
          asset({ catalogId: '94', format: 'Audio' }),
          asset({ catalogId: '95', format: 'Photo' }),
          asset({ catalogId: '96', format: 'Video' }),
        ]}
        open
        hasML
      />,
    )
    expect(container.querySelector('.sr-media-frame.sr-media-iframe--audio')).toBeTruthy()
    expect(container.querySelector('.sr-media-frame.sr-media-iframe--photo')).toBeTruthy()
    expect(container.querySelector('.sr-media-frame.sr-media-iframe--video')).toBeTruthy()
    // Named Birds tiles never borrow Species Detail's --recent height.
    expect(container.querySelector('.sr-media-item .sr-media-iframe--recent')).toBeNull()
  })
})
