// @vitest-environment jsdom
// FR-14 (mobile-app): the footer update affordance renders NOTHING on iOS —
// no check button, no install button, no live region — and renders the full
// pre-extraction DOM on desktop/web. showUpdaterFooter/isTauri mocked both ways.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../lib/platformGates', () => ({ showUpdaterFooter: vi.fn() }))
vi.mock('../lib/platform', () => ({ isTauri: vi.fn(), isIOS: vi.fn(), isWindows: vi.fn() }))

import { showUpdaterFooter } from '../lib/platformGates'
import { isTauri } from '../lib/platform'
import { UpdateFooter } from './UpdateFooter'

afterEach(() => {
  cleanup()
  vi.mocked(showUpdaterFooter).mockReset()
  vi.mocked(isTauri).mockReset()
})

const noop = () => {}

describe('UpdateFooter on iOS (showUpdaterFooter → false)', () => {
  it('renders nothing at all while idle', () => {
    vi.mocked(showUpdaterFooter).mockReturnValue(false)
    vi.mocked(isTauri).mockReturnValue(true)
    const { container } = render(
      <UpdateFooter updateStatus={{ kind: 'idle' }} onCheck={noop} onInstall={noop} />,
    )
    expect(container.innerHTML).toBe('')
    expect(screen.queryByText('Check For Updates')).toBeNull()
  })

  it('renders nothing even when an update is "available" (no install affordance can exist)', () => {
    vi.mocked(showUpdaterFooter).mockReturnValue(false)
    vi.mocked(isTauri).mockReturnValue(true)
    const { container } = render(
      <UpdateFooter updateStatus={{ kind: 'available', latest: '9.9.9' }} onCheck={noop} onInstall={noop} />,
    )
    expect(container.innerHTML).toBe('')
    expect(screen.queryByText('Install update and restart')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull() // the live region never mounts on iOS
  })
})

describe('UpdateFooter on desktop (showUpdaterFooter → true, isTauri → true)', () => {
  it('renders the Check For Updates button and the always-mounted live region while idle', () => {
    vi.mocked(showUpdaterFooter).mockReturnValue(true)
    vi.mocked(isTauri).mockReturnValue(true)
    render(<UpdateFooter updateStatus={{ kind: 'idle' }} onCheck={noop} onInstall={noop} />)
    expect(screen.getByText('Check For Updates')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders the Install button when an update is available', () => {
    vi.mocked(showUpdaterFooter).mockReturnValue(true)
    vi.mocked(isTauri).mockReturnValue(true)
    render(
      <UpdateFooter updateStatus={{ kind: 'available', latest: '9.9.9' }} onCheck={noop} onInstall={noop} />,
    )
    expect(screen.getByText('Install update and restart')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('v9.9.9 available')
  })

  it('renders the download progressbar while downloading', () => {
    vi.mocked(showUpdaterFooter).mockReturnValue(true)
    vi.mocked(isTauri).mockReturnValue(true)
    render(
      <UpdateFooter updateStatus={{ kind: 'downloading', progress: 0.5 }} onCheck={noop} onInstall={noop} />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('50')
  })
})

describe('UpdateFooter on web (showUpdaterFooter → true, isTauri → false)', () => {
  it('keeps the ./update.sh instruction in the live region, no Install button', () => {
    vi.mocked(showUpdaterFooter).mockReturnValue(true)
    vi.mocked(isTauri).mockReturnValue(false)
    render(
      <UpdateFooter updateStatus={{ kind: 'available', latest: '9.9.9' }} onCheck={noop} onInstall={noop} />,
    )
    expect(screen.queryByText('Install update and restart')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('./update.sh')
  })
})
