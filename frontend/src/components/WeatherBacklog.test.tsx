// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { WeatherBacklog } from './WeatherBacklog'
import { BACKLOG_LOAD_FAILED } from '../lib/weatherBacklogLoad'
import { EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'
import type { ChecklistRowData } from '../lib/checklistsTab'
import type { ChecklistEntry } from '../types'
import { openExternalUrl } from '../lib/openExternal'

// Action #3 opens the eBird edit page via the openExternalUrl seam — NOT
// window.open, which is silently dropped in the Tauri desktop WebView. Mock it.
vi.mock('../lib/openExternal', () => ({ openExternalUrl: vi.fn() }))

// This suite follows the project's assertion convention (see BirdName.test.tsx):
// plain vitest matchers (.toBeTruthy/.toBeNull/.getAttribute), no jest-dom
// matchers — jest-dom is a dep but not globally installed. screen.getBy* throws
// when absent, which is itself the presence assertion.

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeChecklist(over: Partial<ChecklistEntry> = {}): ChecklistEntry {
  return {
    submissionId: 'S1', date: '2026-06-28', location: 'Point Reyes NS — Abbotts Lagoon',
    locationId: 'L100', latitude: 38, longitude: -122, county: 'Marin', stateProvince: 'US-CA',
    time: '07:30 AM', duration: 125, distance: 3.06, area: null, protocol: 'P22',
    numObservers: 1, allObsReported: true, checklistComments: '',
    speciesCount: 47, individualCount: 220, ...over,
  }
}

function makeRow(over: Partial<ChecklistEntry> = {}, weatherBlock = false): ChecklistRowData {
  return {
    checklist: makeChecklist(over), commentFull: '', commentStripped: '',
    hasSpeciesComments: false, hasAnyMedia: false, mediaFormats: new Set(),
    hasBreeding: false, weatherBlock, tideBlock: false,
  }
}

// A no-weather-block, complete, non-incidental row (default-view match).
const defaultRow = (id: string, over: Partial<ChecklistEntry> = {}) =>
  makeRow({ submissionId: id, ...over }, false)

const ENTRY = /list checklists with no weather blocks/i
const ACT3 = /copy this checklist's weather/i

function renderBacklog(props: Partial<React.ComponentProps<typeof WeatherBacklog>> = {}) {
  const onCopy = props.onCopy ?? vi.fn().mockResolvedValue(true)
  const lookupWeather = props.lookupWeather ?? vi.fn().mockResolvedValue('WEATHER-BLOCK')
  // Distinguish "rows not passed" (→ a default one-row list) from an explicit
  // null/undefined (needs-data / loading). The `??` idiom would coerce both.
  const rows = 'rows' in props ? props.rows : [defaultRow('S1')]
  const utils = render(
    <WeatherBacklog
      rows={rows}
      lookupWeather={lookupWeather}
      onCopy={onCopy}
      onFirstExpand={props.onFirstExpand}
      onGoToSettings={props.onGoToSettings}
      onGoToImport={props.onGoToImport}
      isHotspot={props.isHotspot}
    />,
  )
  return { ...utils, onCopy, lookupWeather }
}

const expand = () => fireEvent.click(screen.getByRole('button', { name: ENTRY }))
const act3Buttons = () => screen.getAllByRole('button', { name: ACT3 })

const openSpy = vi.mocked(openExternalUrl)

beforeEach(() => {
  openSpy.mockClear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ── Entry point + expand (QA-01/02) ──────────────────────────────────────────

describe('entry point', () => {
  it('renders a collapsed entry button with aria-expanded=false, and expands in place', () => {
    renderBacklog()
    const entry = screen.getByRole('button', { name: ENTRY })
    expect(entry.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('heading', { name: /checklists missing weather/i })).toBeNull()
    expand()
    expect(entry.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('heading', { name: /checklists missing weather/i })).toBeTruthy()
  })

  it('calls onFirstExpand only once, on the first expand', () => {
    const onFirstExpand = vi.fn()
    renderBacklog({ onFirstExpand })
    expand() // open
    expand() // close
    expand() // open again
    expect(onFirstExpand).toHaveBeenCalledTimes(1)
  })
})

// ── Needs-backup (QA-03) ─────────────────────────────────────────────────────

describe('needs-data state', () => {
  it('rows === null shows an explanatory needs-a-backup state, not a spinner', () => {
    renderBacklog({ rows: null, onGoToImport: vi.fn() })
    expand()
    expect(screen.getByText(/load your eBird backup first/i)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /checklists missing weather/i })).toBeNull()
  })

  it('rows === BACKLOG_LOAD_FAILED reports the failure instead of the missing-backup state', () => {
    renderBacklog({ rows: BACKLOG_LOAD_FAILED, onGoToImport: vi.fn(), onGoToSettings: vi.fn() })
    expand()
    expect(screen.getByText(EBIRD_BACKUP_LOAD_ERROR)).toBeTruthy()
    // The lie: a backup IS stored in this state, so neither the title nor the
    // Go to Import CTA belongs to it.
    expect(screen.queryByText(/load your eBird backup first/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /go to import/i })).toBeNull()
    // And it is not a silently empty list either.
    expect(screen.queryByRole('heading', { name: /checklists missing weather/i })).toBeNull()
    expect(screen.getByRole('button', { name: /go to settings/i })).toBeTruthy()
  })

  it('the Go to Import CTA navigates', () => {
    const onGoToImport = vi.fn()
    renderBacklog({ rows: null, onGoToImport })
    expand()
    fireEvent.click(screen.getByRole('button', { name: /go to import/i }))
    expect(onGoToImport).toHaveBeenCalledTimes(1)
  })

  it('rows === undefined shows a loading state', () => {
    renderBacklog({ rows: undefined })
    expand()
    expect(screen.getByText(/building your backlog/i)).toBeTruthy()
  })
})

// ── Zero-match (QA-28) ───────────────────────────────────────────────────────

describe('zero-match empty state', () => {
  it('names the default filter context when no complete rows match', () => {
    // A single row that carries a weather block → filtered out → zero matches.
    renderBacklog({ rows: [makeRow({ submissionId: 'S1' }, true)] })
    expand()
    expect(screen.getByText(/no complete checklists are missing weather/i)).toBeTruthy()
    // Points at the widen toggle (the switch is labelled for incomplete/incidental).
    expect(screen.getByRole('switch', { name: /incomplete and incidental/i })).toBeTruthy()
  })

  it('names the widened context when widened and still empty', () => {
    renderBacklog({ rows: [makeRow({ submissionId: 'S1' }, true)] })
    expand()
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.getByText(/no checklists are missing weather/i)).toBeTruthy()
  })
})

// ── Action #1 / #2 (QA-14/15) ────────────────────────────────────────────────

describe('actions #1 and #2 targets and names', () => {
  it('#1 open-checklist links to ebird.org/checklist/<id> with the shared name', () => {
    renderBacklog({ rows: [defaultRow('S123')] })
    expand()
    const link = screen.getByRole('link', { name: /open checklist .* on eBird \(opens in a new tab\)/i })
    expect(link.getAttribute('href')).toBe('https://ebird.org/checklist/S123')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('#2 open-comment/edit links to the edit/effort URL with a comment/edit accessible name', () => {
    renderBacklog({ rows: [defaultRow('S123')] })
    expand()
    const link = screen.getByRole('link', { name: /comment and edit page on eBird \(opens in a new tab\)/i })
    expect(link.getAttribute('href')).toBe('https://ebird.org/edit/effort?subID=S123')
    expect(link.getAttribute('target')).toBe('_blank')
  })
})

// ── Action #3 success (QA-16/17) ─────────────────────────────────────────────

describe('action #3 — copy then open (success)', () => {
  it('copies the WEATHER block via onCopy and opens the edit URL exactly once', async () => {
    const onCopy = vi.fn().mockResolvedValue(true)
    const lookupWeather = vi.fn().mockResolvedValue('WEATHER-ONLY-BLOCK')
    renderBacklog({ rows: [defaultRow('S77')], onCopy, lookupWeather })
    expand()
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))

    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('WEATHER-ONLY-BLOCK'))
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith('https://ebird.org/edit/effort?subID=S77'))
    expect(openSpy).toHaveBeenCalledTimes(1)
    // Success confirmation (the sr-only live region text is unique).
    await screen.findByText(/comment page opened in a new tab/i)
  })

  it('does NOT fetch or append tide (weather-only copy)', async () => {
    const onCopy = vi.fn().mockResolvedValue(true)
    const lookupWeather = vi.fn().mockResolvedValue('W')
    renderBacklog({ rows: [defaultRow('S1')], onCopy, lookupWeather })
    expand()
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('W'))
    expect(lookupWeather).toHaveBeenCalledTimes(1)
  })
})

// ── Action #3 failure kinds (QA-18/25/26/27) ─────────────────────────────────

describe('action #3 — failures never open the edit page', () => {
  it('offline error → offline state, no open', async () => {
    const lookupWeather = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) // no status → offline
    renderBacklog({ rows: [defaultRow('S1')], lookupWeather })
    expand()
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))
    await screen.findByText(/you're offline/i)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('no-key error → missing-key state with a Settings nudge, no open', async () => {
    const noKey = Object.assign(new Error('API key not configured'), { status: 401 })
    const lookupWeather = vi.fn().mockRejectedValue(noKey)
    const onGoToSettings = vi.fn()
    renderBacklog({ rows: [defaultRow('S1')], lookupWeather, onGoToSettings })
    expand()
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))
    await screen.findByText(/needs an API key/i)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(onGoToSettings).toHaveBeenCalledTimes(1)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('generic error → error state, no open', async () => {
    const err = Object.assign(new Error('boom'), { status: 500 })
    const lookupWeather = vi.fn().mockRejectedValue(err)
    renderBacklog({ rows: [defaultRow('S1')], lookupWeather })
    expand()
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))
    await screen.findByText(/weather lookup failed/i)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('a null lookup (no throw) is a generic error, no open', async () => {
    const lookupWeather = vi.fn().mockResolvedValue(null)
    renderBacklog({ rows: [defaultRow('S1')], lookupWeather })
    expand()
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))
    await screen.findByText(/weather lookup failed/i)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('copy returning false → error, no open', async () => {
    const onCopy = vi.fn().mockResolvedValue(false)
    const lookupWeather = vi.fn().mockResolvedValue('W')
    renderBacklog({ rows: [defaultRow('S1')], onCopy, lookupWeather })
    expand()
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))
    await screen.findByText(/weather lookup failed/i)
    expect(openSpy).not.toHaveBeenCalled()
  })
})

// ── Per-row independence + no double open (QA-30) ────────────────────────────

describe('per-row independence', () => {
  it('one row succeeds (opens once) while another errors', async () => {
    // S1001 succeeds, S1002 rejects (offline). Newest-first puts S1001 (later
    // date) first, so buttons[0] is the OK row.
    const lookupWeather = vi.fn((id: string) =>
      id === 'S1001' ? Promise.resolve('W') : Promise.reject(new TypeError('Failed to fetch')))
    const onCopy = vi.fn().mockResolvedValue(true)
    renderBacklog({
      rows: [defaultRow('S1001', { date: '2026-06-28' }), defaultRow('S1002', { date: '2026-06-01' })],
      lookupWeather, onCopy,
    })
    expand()
    const buttons = act3Buttons()
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[0]) // S1001 (newest first)
    fireEvent.click(buttons[1]) // S1002
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1))
    expect(openSpy).toHaveBeenCalledWith('https://ebird.org/edit/effort?subID=S1001')
    await screen.findByText(/you're offline/i)
  })

  it('an in-flight re-click does not double-fetch or double-open', async () => {
    let resolve!: (v: string) => void
    const lookupWeather = vi.fn(() => new Promise<string>(r => { resolve = r }))
    const onCopy = vi.fn().mockResolvedValue(true)
    renderBacklog({ rows: [defaultRow('S1')], lookupWeather, onCopy })
    expand()
    const btn = screen.getByRole('button', { name: ACT3 })
    fireEvent.click(btn)               // starts the lookup (button now busy)
    fireEvent.click(btn)               // ignored while in-flight
    expect(lookupWeather).toHaveBeenCalledTimes(1)
    resolve('W')
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1))
  })
})

// ── Malformed id degrade (QA-29) ─────────────────────────────────────────────

describe('malformed submission id', () => {
  it('renders the row info but degrades the checklist link and action #3 open', async () => {
    const lookupWeather = vi.fn().mockResolvedValue('W')
    renderBacklog({ rows: [defaultRow('junk-id', { location: 'Somewhere' })], lookupWeather })
    expand()
    // The row still lists (species count visible).
    expect(screen.getByText(/47 species/i)).toBeTruthy()
    // No checklist link to a 404.
    expect(screen.queryByRole('link', { name: /open checklist .* on eBird/i })).toBeNull()
    // Action #3 reports the bad-id state and never opens a page.
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))
    await screen.findByText(/no valid eBird id/i)
    expect(lookupWeather).not.toHaveBeenCalled()
    expect(openSpy).not.toHaveBeenCalled()
  })
})

// ── Pagination + toggle reset (QA-19/20/24) ──────────────────────────────────

describe('pagination and toggle', () => {
  const manyDefault = Array.from({ length: 150 }, (_, i) =>
    defaultRow(`S${(1000 + i)}`, { date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` }))

  it('shows the first 100 initially and appends with Show next 100', () => {
    renderBacklog({ rows: manyDefault })
    expand()
    expect(act3Buttons()).toHaveLength(100)
    fireEvent.click(screen.getByRole('button', { name: /show next 100/i }))
    expect(act3Buttons()).toHaveLength(150)
  })

  it('Show all reveals every remaining match', () => {
    renderBacklog({ rows: manyDefault })
    expand()
    fireEvent.click(screen.getByRole('button', { name: /show all/i }))
    expect(act3Buttons()).toHaveLength(150)
  })

  it('≤100 matches → no pagination controls', () => {
    renderBacklog({ rows: [defaultRow('S1'), defaultRow('S2', { date: '2026-01-01' })] })
    expand()
    expect(screen.queryByRole('button', { name: /show next 100/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /show all/i })).toBeNull()
  })

  it('toggling widen resets pagination to the first 100 of the new set', () => {
    // 150 default matches + 40 widen-only incomplete rows → widened set is 190.
    const widenOnly = Array.from({ length: 40 }, (_, i) =>
      defaultRow(`W${i}`, { allObsReported: false, date: '2026-02-01' }))
    renderBacklog({ rows: [...manyDefault, ...widenOnly] })
    expand()
    // Page to all 150 default rows.
    fireEvent.click(screen.getByRole('button', { name: /show all/i }))
    expect(act3Buttons()).toHaveLength(150)
    // Toggle widen → set grows to 190 but pagination resets to 100.
    fireEvent.click(screen.getByRole('switch'))
    expect(act3Buttons()).toHaveLength(100)
    // And the total is the widened superset (Show all names 190).
    expect(screen.getByRole('button', { name: /show all \(190\)/i })).toBeTruthy()
  })
})

// ── Widen marker (QA-12) ─────────────────────────────────────────────────────

describe('widened-list markers', () => {
  it('an incomplete row is marked Incomplete; an incidental row is marked Incidental', () => {
    renderBacklog({
      rows: [
        defaultRow('S1', { allObsReported: true, protocol: 'P22' }),
        defaultRow('S2', { allObsReported: false, protocol: 'P22', date: '2026-06-02' }),
        defaultRow('S3', { allObsReported: true, protocol: 'P20', date: '2026-06-01' }),
      ],
    })
    expand()
    // Default view shows only the complete non-incidental row — no chips, and no
    // incidental protocol row at all.
    expect(screen.queryByText('Incomplete')).toBeNull()
    expect(screen.queryByText('Incidental')).toBeNull()
    // Widen → the Incomplete chip appears (unique text), and "Incidental" now
    // appears (both as the chip and as the P20 protocol label on that row).
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.getByText('Incomplete')).toBeTruthy()
    expect(screen.getAllByText('Incidental').length).toBeGreaterThanOrEqual(1)
  })
})

// ── A11y (QA-31/32) ──────────────────────────────────────────────────────────

describe('accessibility', () => {
  it('the widen toggle is a switch carrying its checked state', () => {
    renderBacklog()
    expand()
    const sw = screen.getByRole('switch')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })

  it('row failures render as role=alert', async () => {
    const lookupWeather = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    renderBacklog({ rows: [defaultRow('S1')], lookupWeather })
    expand()
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))
    await screen.findByText(/you're offline/i)
    // Since v1.0.16 the section also carries an always-mounted, EMPTY
    // load-failure alert region (a live region has to be in the accessibility
    // tree before its message lands, DECISIONS.md v0.5.83), so `role="alert"` is
    // no longer a singleton here. That is the documented consequence rather than
    // a surprise: when a region becomes always-mounted, every alert-PRESENCE
    // assertion in the repo has to become an alert-CARRIES-TEXT one, or it starts
    // asserting the defect. The claim is unchanged — the row failure is announced
    // from an alert region, and it is the only thing being announced.
    const spoken = screen.getAllByRole('alert').filter(el => el.textContent !== '')
    expect(spoken.length).toBe(1)
    expect(spoken[0].textContent).toMatch(/you're offline/i)
  })

  it('a polite live region announces success', async () => {
    const lookupWeather = vi.fn().mockResolvedValue('W')
    renderBacklog({ rows: [defaultRow('S1')], lookupWeather })
    expand()
    fireEvent.click(screen.getByRole('button', { name: ACT3 }))
    await screen.findByText(/comment page opened in a new tab/i)
  })
})
