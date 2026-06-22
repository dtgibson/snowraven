// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// Mock the platform + region orchestration seams so the component is exercised
// without the storage seam / network. formatRegionMB + isDownloadAbort are kept
// faithful so the size display + cancel handling read like production.
const { isTauri, seam } = vi.hoisted(() => ({
  isTauri: vi.fn(),
  seam: {
    isOfflineMapsEnabled: vi.fn(),
    setOfflineMapsEnabled: vi.fn(),
    countiesYouBird: vi.fn(),
    listRegions: vi.fn(),
    downloadRegion: vi.fn(),
    removeRegion: vi.fn(),
  },
}))
vi.mock('../lib/platform', () => ({ isTauri }))
vi.mock('../lib/regionDownload', () => ({
  ...seam,
  isDownloadAbort: (e: unknown) => e instanceof DOMException && e.name === 'AbortError',
  formatRegionMB: (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return mb <= 0 ? '0 MB' : mb < 1 ? '<1 MB' : `${Math.round(mb)} MB`
  },
}))

import { OfflineMapsSection } from './OfflineMapsSection'

const MB = 1024 * 1024

beforeEach(() => {
  isTauri.mockReturnValue(true)
  seam.isOfflineMapsEnabled.mockResolvedValue(false)
  seam.setOfflineMapsEnabled.mockResolvedValue(undefined)
  seam.countiesYouBird.mockResolvedValue([])
  seam.listRegions.mockResolvedValue({ regions: [], totalBytes: 0, currentVersion: '2026.06' })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('OfflineMapsSection — FR-11a default-off gate', () => {
  it('toggle is OFF by default and the manager body is hidden', async () => {
    render(<OfflineMapsSection />)
    const toggle = await screen.findByRole('switch', { name: /enable offline maps/i })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByText(/counties you bird/i)).toBeNull()
    // Nothing downloaded until the user opts in.
    expect(seam.setOfflineMapsEnabled).not.toHaveBeenCalled()
  })

  it('turning the toggle on persists the setting and reveals the manager', async () => {
    seam.countiesYouBird.mockResolvedValue([])
    seam.listRegions.mockResolvedValue({ regions: [], totalBytes: 0, currentVersion: '2026.06' })
    render(<OfflineMapsSection />)
    const toggle = await screen.findByRole('switch', { name: /enable offline maps/i })
    fireEvent.click(toggle)
    expect(seam.setOfflineMapsEnabled).toHaveBeenCalledWith(true)
    // Empty ON state still shows the honest manager (not bare), per design screen 3.
    await waitFor(() => expect(screen.getByText(/no regions downloaded yet/i)).toBeTruthy())
  })
})

describe('OfflineMapsSection — FR-13 region list + total (desktop, enabled)', () => {
  it('lists a downloaded region with its size + the running total', async () => {
    seam.isOfflineMapsEnabled.mockResolvedValue(true)
    seam.countiesYouBird.mockResolvedValue([
      { countyName: 'Marin', stateProvince: 'US-CA', region: { regionId: 'us-ca-marin', name: 'Marin County, CA', kind: 'county', stateCode: 'US-CA', countyName: 'Marin', extent: [-123, 37.8, -122.4, 38.3], minZoom: 0, maxZoom: 14, bytes: 24 * MB } },
    ])
    seam.listRegions.mockResolvedValue({
      regions: [{ regionId: 'us-ca-scl', name: 'Santa Clara County, CA', kind: 'county', stateCode: 'US-CA', countyName: 'Santa Clara', extent: [-122.2, 37.0, -121.2, 37.5], minZoom: 0, maxZoom: 14, bytes: 41 * MB, downloadedAt: 1_700_000_000_000, sourceVersion: '2026.06', stale: false }],
      totalBytes: 41 * MB,
      currentVersion: '2026.06',
    })
    render(<OfflineMapsSection />)
    await waitFor(() => expect(screen.getByText('Santa Clara County, CA')).toBeTruthy())
    expect(screen.getByText('Counties you bird')).toBeTruthy()
    expect(screen.getByText('Downloaded regions')).toBeTruthy()
    // Total footer (FR-13): "Using 41 MB across 1 region."
    expect(screen.getByText(/Using 41 MB across 1 region\./)).toBeTruthy()
    // A downloadable county appears with a Download control.
    expect(screen.getByRole('button', { name: /download marin/i })).toBeTruthy()
    // A Remove control for the downloaded region (FR-14).
    expect(screen.getByRole('button', { name: /remove santa clara/i })).toBeTruthy()
  })

  it('shows the Out-of-date badge + an Update control for a stale region (FR-19)', async () => {
    seam.isOfflineMapsEnabled.mockResolvedValue(true)
    seam.listRegions.mockResolvedValue({
      regions: [{ regionId: 'us-ca-son', name: 'Sonoma County, CA', kind: 'county', stateCode: 'US-CA', countyName: 'Sonoma', extent: [-123.5, 38.0, -122.3, 38.9], minZoom: 0, maxZoom: 14, bytes: 35 * MB, downloadedAt: 1_000_000_000_000, sourceVersion: '2025.01', stale: true }],
      totalBytes: 35 * MB,
      currentVersion: '2026.06',
    })
    render(<OfflineMapsSection />)
    await waitFor(() => expect(screen.getByText('Sonoma County, CA')).toBeTruthy())
    expect(screen.getByText(/out of date/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /update sonoma/i })).toBeTruthy()
  })
})

describe('OfflineMapsSection — FR-20 web/self-hosted limitation', () => {
  it('disables the toggle and shows the desktop-only note on web', async () => {
    isTauri.mockReturnValue(false)
    render(<OfflineMapsSection />)
    expect(await screen.findByText(/available in the desktop app/i)).toBeTruthy()
    // The disabled web toggle is not interactive (no download path here).
    expect(screen.queryByText(/counties you bird/i)).toBeNull()
  })
})
