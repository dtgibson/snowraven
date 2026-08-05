// @vitest-environment jsdom
// Tests for the SHARED resilient-embed primitives (MediaFrame / MediaFallback) that
// back both the Named Birds media and the Species Detail "Recent Media" section.
// NamedBirdMedia.test.tsx exercises these through that component; this locks the
// primitives directly so either surface's wiring can be refactored without losing
// the give-up / offline / late-load / safe-id guarantees.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { Image as ImageIcon } from 'lucide-react'
import { MediaFrame, MediaFallback } from './MediaEmbed'

afterEach(() => cleanup())

describe('MediaFrame — embed src + title', () => {
  it('renders the /embed iframe with an encodeURIComponent-wrapped id and the given title', () => {
    render(
      <MediaFrame
        embedAllowed
        catalogId="123456"
        format="Photo"
        title="Most recent Photo of Acorn Woodpecker"
        Icon={ImageIcon}
        heightClass="sr-media-iframe--photo"
        compact={false}
      />,
    )
    const frame = document.querySelector('iframe')!
    expect(frame.getAttribute('src')).toBe('https://macaulaylibrary.org/asset/123456/embed')
    expect(frame.getAttribute('title')).toBe('Most recent Photo of Acorn Woodpecker')
  })

  it('constructs no iframe when the shared eligibility gate is closed', () => {
    const { container } = render(
      <MediaFrame
        embedAllowed={false}
        catalogId="123456"
        format="Photo"
        title="Most recent Photo of Acorn Woodpecker"
        Icon={ImageIcon}
        heightClass="sr-media-iframe--photo"
        compact={false}
      />,
    )
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('.sr-media-shimmer')).toBeNull()
  })
})

describe('MediaFrame — non-destructive give-up + late-load recovery', () => {
  it('give-up timer overlays the fallback without unmounting the iframe; a late onLoad swaps it back', () => {
    vi.useFakeTimers()
    try {
      render(
        <MediaFrame embedAllowed catalogId="55" format="Photo" title="t" Icon={ImageIcon} heightClass="sr-media-iframe--photo" compact={false} />,
      )
      const frame = document.querySelector('iframe')!
      // Before the deadline: no give-up overlay.
      expect(screen.queryByText("Media couldn't load")).toBeNull()

      // Fire the 20s give-up timer.
      act(() => { vi.advanceTimersByTime(21000) })
      expect(screen.getByText("Media couldn't load")).toBeTruthy()
      // The iframe is STILL the same mounted node (non-destructive overlay).
      expect(document.querySelector('iframe')).toBe(frame)

      // A late onLoad still wins: the overlay clears, the real embed shows.
      act(() => { fireEvent.load(frame) })
      expect(screen.queryByText("Media couldn't load")).toBeNull()
      expect(document.querySelector('iframe')).toBe(frame)
    } finally {
      vi.useRealTimers()
    }
  })

  // NOTE: React's synthetic iframe `onError` does not fire from `fireEvent.error`
  // under jsdom (only `load` is reliably delivered), so the broken-embed path is
  // exercised via the give-up TIMER — the guaranteed trigger and the primary
  // protection (onError is a best-effort belt on top of it in a real browser).
  it('a give-up overlay keeps the ML link-out (never a dead frame) and stays mounted', () => {
    vi.useFakeTimers()
    try {
      render(
        <MediaFrame embedAllowed catalogId="56" format="Photo" title="t" Icon={ImageIcon} heightClass="sr-media-iframe--photo" compact={false} />,
      )
      const frame = document.querySelector('iframe')!
      act(() => { vi.advanceTimersByTime(21000) })
      expect(screen.getByText("Media couldn't load")).toBeTruthy()
      // Overlay keeps the link-out to the asset (never a dead frame).
      expect(screen.getByRole('link', { name: /View Photo on Macaulay Library/i }).getAttribute('href'))
        .toBe('https://macaulaylibrary.org/asset/56')
      expect(document.querySelector('iframe')).toBe(frame)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('MediaFallback — offline / failed / safe ids', () => {
  it('offline reason shows the offline message and a link-out to the single asset', () => {
    render(<MediaFallback catalogId="77" format="Photo" compact={false} />)
    expect(screen.getByText('Media unavailable offline')).toBeTruthy()
    expect(screen.getByRole('link', { name: /View Photo on Macaulay Library/i }).getAttribute('href'))
      .toBe('https://macaulaylibrary.org/asset/77')
  })

  it('load-failed reason shows the failed message', () => {
    render(<MediaFallback catalogId="77" format="Video" compact={false} reason="load-failed" />)
    expect(screen.getByText("Media couldn't load")).toBeTruthy()
    expect(screen.getByRole('link', { name: /View Video on Macaulay Library/i })).toBeTruthy()
  })

  it('a non-numeric id renders no link (safe id guard)', () => {
    render(<MediaFallback catalogId="not-a-number" format="Photo" compact={false} />)
    expect(screen.getByText('Media unavailable offline')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Macaulay Library/i })).toBeNull()
  })

  it('audio compact fallback drops the message line but keeps the link-out', () => {
    render(<MediaFallback catalogId="90" format="Audio" compact />)
    expect(screen.queryByText('Media unavailable offline')).toBeNull()
    expect(screen.getByRole('link', { name: /View Audio on Macaulay Library/i })).toBeTruthy()
  })
})
