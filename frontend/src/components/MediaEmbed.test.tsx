// @vitest-environment jsdom
// Tests for the SHARED resilient-embed primitives (MediaFrame / MediaFallback) that
// back both the Named Birds media and the Species Detail "Recent Media" section.
// NamedBirdMedia.test.tsx exercises these through that component; this locks the
// primitives directly so either surface's wiring can be refactored without losing
// the give-up / offline / late-load / safe-id guarantees.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react'
import { Image as ImageIcon } from 'lucide-react'
import { MediaFrame, MediaFallback } from './MediaEmbed'
import { resetEmbedGateForTests } from '../lib/mlEmbedGate'

const transportGet = vi.fn()
vi.mock('../lib/transport', () => ({
  transport: { get: (...args: unknown[]) => transportGet(...args) },
}))

// The platform probe, mocked so the Android block below can flip it. Every
// other block runs with it false (web/desktop/iOS all read false here).
const isAndroidMock = vi.fn(() => false)
vi.mock('../lib/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/platform')>()
  return { ...actual, isAndroid: () => isAndroidMock() }
})

beforeEach(() => {
  resetEmbedGateForTests()
  isAndroidMock.mockReset()
  isAndroidMock.mockReturnValue(false)
  transportGet.mockReset()
  // Default: the gate probe never settles, so these tests see the pre-probe
  // state (not gated → the real frame mounts) with no stray async re-render.
  // The gate's own behavior is asserted in the bot-gate block below.
  transportGet.mockReturnValue(new Promise(() => {}))
})

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

// Cornell's bot check in front of macaulaylibrary.org cannot complete inside a
// cross-site iframe, so a mounted player renders THEIR "Missing feature Cookies"
// card. That card is a successful HTTP 200 load, so neither onError nor the
// give-up timer above can catch it — only the out-of-band probe can.
describe('MediaFrame — Cornell bot gate', () => {
  const frameProps = {
    format: 'Photo' as const,
    title: 't',
    Icon: ImageIcon,
    heightClass: 'sr-media-iframe--photo',
    compact: false,
  }

  it('shows our own card and mounts NO iframe when the gate is up', async () => {
    transportGet.mockResolvedValue({ gated: true })
    render(<MediaFrame embedAllowed catalogId="662004247" {...frameProps} />)

    await waitFor(() => expect(screen.getByText("Media can't play here right now")).toBeTruthy())
    // The whole point: no frame is mounted, so we are not hammering a gate
    // Cornell put up deliberately, and no foreign error card reaches the user.
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getByRole('link', { name: /View Photo on Macaulay Library/i }).getAttribute('href'))
      .toBe('https://macaulaylibrary.org/asset/662004247')
  })

  it('mounts the real frame when the gate is open', async () => {
    transportGet.mockResolvedValue({ gated: false })
    render(<MediaFrame embedAllowed catalogId="662004247" {...frameProps} />)

    await waitFor(() => expect(transportGet).toHaveBeenCalled())
    expect(document.querySelector('iframe')).toBeTruthy()
    expect(screen.queryByText("Media can't play here right now")).toBeNull()
  })

  // Fails open: an implementation that treated a failed probe as "blocked" would
  // blank every tile the moment the probe route erred or the device went offline.
  it('mounts the real frame when the probe fails', async () => {
    transportGet.mockRejectedValue(new Error('offline'))
    render(<MediaFrame embedAllowed catalogId="662004247" {...frameProps} />)

    await waitFor(() => expect(transportGet).toHaveBeenCalled())
    expect(document.querySelector('iframe')).toBeTruthy()
    expect(screen.queryByText("Media can't play here right now")).toBeNull()
  })

  it('probes with the catalog id it is about to embed', async () => {
    transportGet.mockResolvedValue({ gated: false })
    render(<MediaFrame embedAllowed catalogId="662004247" {...frameProps} />)

    await waitFor(() => expect(transportGet).toHaveBeenCalledWith(
      '/media/embed-status', { catalogId: '662004247' },
    ))
  })

  it('makes no probe call when embedded media is switched off', async () => {
    transportGet.mockResolvedValue({ gated: true })
    render(<MediaFrame embedAllowed={false} catalogId="662004247" {...frameProps} />)

    await act(async () => { await Promise.resolve() })
    expect(transportGet).not.toHaveBeenCalled()
  })
})

// android-release security M1: on Android, wry hands every iframe the Tauri IPC
// bridge and attributes its calls to the main frame, so a third-party frame
// would run with the app's own file, clipboard, opener and fetch grants. The
// platform reading joins the same gate the Cornell probe uses, so the frame
// component needs no branch of its own: with the probe answering OPEN (the
// case that would mount a player everywhere else), Android still mounts none.
describe('MediaFrame — Android mounts no third-party frame (security M1)', () => {
  const frameProps = {
    format: 'Photo' as const,
    title: 't',
    Icon: ImageIcon,
    heightClass: 'sr-media-iframe--photo',
    compact: false,
  }

  it('renders the fallback link and NO iframe, even with the embed endpoint open', async () => {
    isAndroidMock.mockReturnValue(true)
    transportGet.mockResolvedValue({ gated: false })
    render(<MediaFrame embedAllowed catalogId="662004247" {...frameProps} />)

    await act(async () => { await Promise.resolve() })
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.querySelector('.sr-media-shimmer')).toBeNull()
    expect(screen.getByText('Media opens on Macaulay Library')).toBeTruthy()
    expect(screen.getByRole('link', { name: /View Photo on Macaulay Library/i }).getAttribute('href'))
      .toBe('https://macaulaylibrary.org/asset/662004247')
    // The card's glyph says "opens elsewhere", not "offline": the crossed-out
    // cloud the offline / failed / gated cards wear reads as an outage on a
    // phone that is online. Read off lucide's own icon class on the decorative
    // (aria-hidden) svg; the component adds no id or test id of its own.
    const glyph = document.querySelector('svg[aria-hidden]')
    expect(glyph?.classList.contains('lucide-external-link')).toBe(true)
    expect(document.querySelector('svg.lucide-cloud-off')).toBeNull()
  })

  it('never probes the embed endpoint for a frame it will not mount', async () => {
    isAndroidMock.mockReturnValue(true)
    transportGet.mockResolvedValue({ gated: false })
    render(<MediaFrame embedAllowed catalogId="662004247" {...frameProps} />)

    await act(async () => { await Promise.resolve() })
    expect(transportGet).not.toHaveBeenCalled()
  })

  it('still constructs no iframe when the eligibility gate is closed as well', () => {
    isAndroidMock.mockReturnValue(true)
    const { container } = render(<MediaFrame embedAllowed={false} catalogId="662004247" {...frameProps} />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).toBe('')
  })

  // The control leg: the identical render with the probe false mounts the frame,
  // so the three rows above are reading the platform gate and not a stuck probe.
  it('control: off Android the same render mounts the real frame', async () => {
    transportGet.mockResolvedValue({ gated: false })
    render(<MediaFrame embedAllowed catalogId="662004247" {...frameProps} />)
    await waitFor(() => expect(transportGet).toHaveBeenCalled())
    expect(document.querySelector('iframe')).toBeTruthy()
    expect(screen.queryByText('Media opens on Macaulay Library')).toBeNull()
  })
})

describe('MediaFallback — offline / failed / safe ids', () => {
  it('offline reason shows the offline message and a link-out to the single asset', () => {
    render(<MediaFallback catalogId="77" format="Photo" compact={false} />)
    expect(screen.getByText('Media unavailable offline')).toBeTruthy()
    expect(screen.getByRole('link', { name: /View Photo on Macaulay Library/i }).getAttribute('href'))
      .toBe('https://macaulaylibrary.org/asset/77')
    // The offline card keeps the crossed-out cloud; only the Android `platform`
    // card (above) swaps it for the external-link glyph.
    expect(document.querySelector('svg.lucide-cloud-off')).toBeTruthy()
    expect(document.querySelector('svg.lucide-external-link')).toBeNull()
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
