// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react'
import { ChartViewTip, CHART_TIP_SETTING } from './ChartViewTip'
import { storage } from '../lib/storage'

vi.mock('../lib/storage', () => ({
  storage: {
    getSetting: vi.fn().mockResolvedValue(null),
    setSetting: vi.fn().mockResolvedValue(undefined),
  },
}))

const getSetting = vi.mocked(storage.getSetting)
const setSetting = vi.mocked(storage.setSetting)

// jsdom has no matchMedia; the component reads it twice — the phone-width
// query (via useIsPhone) and the reduced-motion query. Stub both explicitly:
// with no stub, useIsPhone's guard returns false and the tip never renders,
// which is itself the desktop case but would make every phone test vacuous.
function stubMatchMedia({ phone, reducedMotion }: { phone: boolean; reducedMotion: boolean }) {
  const mql = (matches: boolean, media: string) =>
    ({
      matches,
      media,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
  window.matchMedia = (query: string) =>
    query.includes('max-width')
      ? mql(phone, query)
      : query.includes('prefers-reduced-motion')
        ? mql(reducedMotion, query)
        : mql(false, query)
}

beforeEach(() => {
  getSetting.mockReset().mockResolvedValue(null)
  setSetting.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  // matchMedia does not exist in jsdom natively; drop the stub between tests.
  delete (window as { matchMedia?: unknown }).matchMedia
})

describe('ChartViewTip', () => {
  it('renders the tip on a phone once the saved flags hydrate', async () => {
    stubMatchMedia({ phone: true, reducedMotion: true })
    render(<ChartViewTip page="statistics" />)
    await waitFor(() => expect(screen.getByRole('note')).toBeTruthy())
    expect(screen.getByText('Tip')).toBeTruthy()
    expect(
      screen.getByText(
        "Charts get more room in landscape. Rotate your device for a wider view, or open SnowRaven's desktop app if you have it.",
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dismiss this tip' })).toBeTruthy()
  })

  it('renders nothing at desktop and tablet widths', async () => {
    stubMatchMedia({ phone: false, reducedMotion: true })
    const { container } = render(<ChartViewTip page="statistics" />)
    // Let hydration settle, then confirm nothing mounted.
    await act(async () => {})
    expect(container.firstChild).toBeNull()
  })

  it('stays closed until the saved flags hydrate (no flash before the read resolves)', async () => {
    stubMatchMedia({ phone: true, reducedMotion: true })
    let resolveRead: (v: null) => void = () => {}
    getSetting.mockReturnValue(
      new Promise<null>(r => {
        resolveRead = r
      }),
    )
    const { container } = render(<ChartViewTip page="statistics" />)
    expect(container.firstChild).toBeNull()
    await act(async () => resolveRead(null))
    await waitFor(() => expect(screen.getByRole('note')).toBeTruthy())
  })

  it('never renders on a page already dismissed', async () => {
    stubMatchMedia({ phone: true, reducedMotion: true })
    getSetting.mockResolvedValue({ statistics: true })
    const { container } = render(<ChartViewTip page="statistics" />)
    await act(async () => {})
    expect(container.firstChild).toBeNull()
  })

  it('a dismissal on one page does not hide the other page', async () => {
    stubMatchMedia({ phone: true, reducedMotion: true })
    getSetting.mockResolvedValue({ statistics: true })
    render(<ChartViewTip page="species-detail" />)
    await waitFor(() => expect(screen.getByRole('note')).toBeTruthy())
  })

  it('dismiss persists the per-page flag, merging with the other page, and removes the tip', async () => {
    stubMatchMedia({ phone: true, reducedMotion: true })
    getSetting.mockResolvedValue({ 'species-detail': true })
    const { container } = render(<ChartViewTip page="statistics" />)
    await waitFor(() => expect(screen.getByRole('note')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this tip' }))
    // Reduced motion: removal is instant, no animation to wait out.
    await waitFor(() => expect(container.firstChild).toBeNull())
    await waitFor(() =>
      expect(setSetting).toHaveBeenCalledWith(CHART_TIP_SETTING, {
        'species-detail': true,
        statistics: true,
      }),
    )
  })

  it('with motion allowed, the tip collapses and unmounts on transitionend', async () => {
    stubMatchMedia({ phone: true, reducedMotion: false })
    const { container } = render(<ChartViewTip page="statistics" />)
    await waitFor(() => expect(screen.getByRole('note')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this tip' }))
    const wrap = container.firstChild as HTMLElement
    // Still mounted while the collapse runs; unmounts when the height
    // transition reports done.
    expect(wrap).not.toBeNull()
    fireEvent.transitionEnd(wrap, { propertyName: 'height' })
    await waitFor(() => expect(container.firstChild).toBeNull())
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith(CHART_TIP_SETTING, { statistics: true }))
  })

  it('a corrupt saved value is treated as never-dismissed, not thrown on', async () => {
    stubMatchMedia({ phone: true, reducedMotion: true })
    getSetting.mockResolvedValue(['not', 'a', 'map'])
    render(<ChartViewTip page="statistics" />)
    await waitFor(() => expect(screen.getByRole('note')).toBeTruthy())
  })
})
