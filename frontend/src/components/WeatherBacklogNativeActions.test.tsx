// @vitest-environment jsdom
// Native-dispatch regression for the Missing Weather list.
//
// Static href assertions alone cannot cover the app defect: in a Tauri build a
// global opener listener converts the click into an IPC command after React has
// rendered the row. This suite installs the real __TAURI_INTERNALS__ seam and
// proves the exact URL string that reaches native code for all three actions,
// across reorder and widen-toggle renders.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ChecklistEntry } from '../types'
import type { ChecklistRowData } from '../lib/checklistsTab'
import { WeatherBacklog } from './WeatherBacklog'

function row(submissionId: string, date: string, allObsReported = true): ChecklistRowData {
  const checklist: ChecklistEntry = {
    submissionId,
    date,
    location: `Location ${submissionId}`,
    locationId: `L${submissionId.slice(1)}`,
    latitude: 38,
    longitude: -122,
    county: 'Marin',
    stateProvince: 'US-CA',
    time: '07:30 AM',
    duration: 60,
    distance: 1,
    area: null,
    protocol: 'P22',
    numObservers: 1,
    allObsReported,
    checklistComments: '',
    speciesCount: 12,
    individualCount: 20,
  }
  return {
    checklist,
    commentFull: '',
    commentStripped: '',
    hasSpeciesComments: false,
    hasAnyMedia: false,
    mediaFormats: new Set(),
    hasBreeding: false,
    weatherBlock: false,
    tideBlock: false,
  }
}

afterEach(() => {
  cleanup()
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  vi.restoreAllMocks()
})

describe('Missing Weather row identity reaches native dispatch', () => {
  it('dispatches each row\'s validated checklist, edit, and copy-and-go URL after reorder and toggle changes', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    ;(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = { invoke }
    const lookupWeather = vi.fn(async (id: string) => `weather:${id}`)
    const onCopy = vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(true)

    const initial = [
      row('S101', '2026-09-03'),
      row('S202', '2026-09-02'),
      row('S303', '2026-09-04', false),
    ]
    const view = render(
      <WeatherBacklog rows={initial} lookupWeather={lookupWeather} onCopy={onCopy} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /list checklists with no weather blocks/i }))

    // Two complete rows are visible. Both their DOM targets and the native IPC
    // payloads are distinct; activating the second may never reuse the first.
    const checklistLinks = view.container.querySelectorAll<HTMLAnchorElement>('a[title="Open checklist on eBird"]')
    const editLinks = view.container.querySelectorAll<HTMLAnchorElement>('a[title="Open comment/edit page on eBird"]')
    expect([...checklistLinks].map(a => a.getAttribute('href'))).toEqual([
      'https://ebird.org/checklist/S101',
      'https://ebird.org/checklist/S202',
    ])
    expect([...editLinks].map(a => a.getAttribute('href'))).toEqual([
      'https://ebird.org/edit/effort?subID=S101',
      'https://ebird.org/edit/effort?subID=S202',
    ])
    checklistLinks.forEach(link => fireEvent.click(link))
    editLinks.forEach(link => fireEvent.click(link))

    expect(invoke.mock.calls.map(([, args]) => (args as { url: string }).url)).toEqual([
      'https://ebird.org/checklist/S101',
      'https://ebird.org/checklist/S202',
      'https://ebird.org/edit/effort?subID=S101',
      'https://ebird.org/edit/effort?subID=S202',
    ])

    // Re-render the same ids in a new derived order, then widen the list. This
    // is the state churn under which an index-owned or delegated target can
    // collapse onto another row.
    view.rerender(
      <WeatherBacklog
        rows={[
          row('S202', '2026-09-05'),
          row('S101', '2026-09-01'),
          row('S303', '2026-09-06', false),
        ]}
        lookupWeather={lookupWeather}
        onCopy={onCopy}
      />,
    )
    fireEvent.click(screen.getByRole('switch', { name: /incomplete and incidental/i }))

    const reorderedChecklistLinks = view.container.querySelectorAll<HTMLAnchorElement>('a[title="Open checklist on eBird"]')
    const reorderedEditLinks = view.container.querySelectorAll<HTMLAnchorElement>('a[title="Open comment/edit page on eBird"]')
    expect([...reorderedChecklistLinks].map(a => a.getAttribute('href'))).toEqual([
      'https://ebird.org/checklist/S303',
      'https://ebird.org/checklist/S202',
      'https://ebird.org/checklist/S101',
    ])
    expect([...reorderedEditLinks].map(a => a.getAttribute('href'))).toEqual([
      'https://ebird.org/edit/effort?subID=S303',
      'https://ebird.org/edit/effort?subID=S202',
      'https://ebird.org/edit/effort?subID=S101',
    ])
    reorderedChecklistLinks.forEach(link => fireEvent.click(link))
    reorderedEditLinks.forEach(link => fireEvent.click(link))

    const buttons = screen.getAllByRole('button', { name: /copy this checklist's weather/i })
    expect(buttons).toHaveLength(3)
    buttons.forEach(button => fireEvent.click(button))

    await waitFor(() => expect(lookupWeather.mock.calls.map(([id]) => id)).toEqual(['S303', 'S202', 'S101']))
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(13))
    expect(invoke.mock.calls.slice(4).map(([, args]) => (args as { url: string }).url)).toEqual([
      'https://ebird.org/checklist/S303',
      'https://ebird.org/checklist/S202',
      'https://ebird.org/checklist/S101',
      'https://ebird.org/edit/effort?subID=S303',
      'https://ebird.org/edit/effort?subID=S202',
      'https://ebird.org/edit/effort?subID=S101',
      'https://ebird.org/edit/effort?subID=S303',
      'https://ebird.org/edit/effort?subID=S202',
      'https://ebird.org/edit/effort?subID=S101',
    ])
    expect(onCopy.mock.calls.map(([text]) => text)).toEqual([
      'weather:S303',
      'weather:S202',
      'weather:S101',
    ])
  })

  it('keeps the newly paged row\'s identity on all three native actions', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    ;(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = { invoke }
    const lookupWeather = vi.fn(async (id: string) => `weather:${id}`)
    const onCopy = vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(true)
    const rows = Array.from({ length: 101 }, (_, index) =>
      row(`S${1000 + index}`, '2026-09-01'))

    const view = render(
      <WeatherBacklog rows={rows} lookupWeather={lookupWeather} onCopy={onCopy} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /list checklists with no weather blocks/i }))
    expect(view.container.querySelector('a[href="https://ebird.org/checklist/S1000"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /show next 100/i }))

    const checklist = view.container.querySelector<HTMLAnchorElement>('a[title="Open checklist on eBird"][href="https://ebird.org/checklist/S1000"]')!
    const edit = view.container.querySelector<HTMLAnchorElement>('a[title="Open comment/edit page on eBird"][href="https://ebird.org/edit/effort?subID=S1000"]')!
    const copy = [...screen.getAllByRole('button', { name: /copy this checklist's weather/i })]
      .find(button => button.closest('div[style*="border-bottom"]')?.querySelector('a[href="https://ebird.org/checklist/S1000"]'))!

    expect(checklist).not.toBeNull()
    expect(edit).not.toBeNull()
    expect(copy).not.toBeNull()
    fireEvent.click(checklist)
    fireEvent.click(edit)
    fireEvent.click(copy)

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(3))
    expect(invoke.mock.calls.map(([, args]) => (args as { url: string }).url)).toEqual([
      'https://ebird.org/checklist/S1000',
      'https://ebird.org/edit/effort?subID=S1000',
      'https://ebird.org/edit/effort?subID=S1000',
    ])
    expect(lookupWeather).toHaveBeenCalledWith('S1000')
    expect(onCopy).toHaveBeenCalledWith('weather:S1000')
  })

  it('never dispatches a malformed submission id to native code', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    ;(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = { invoke }
    const lookupWeather = vi.fn(async () => 'weather')
    const onCopy = vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(true)
    const view = render(
      <WeatherBacklog rows={[row('not-an-id', '2026-09-01')]} lookupWeather={lookupWeather} onCopy={onCopy} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /list checklists with no weather blocks/i }))

    expect(view.container.querySelector('a[href*="not-an-id"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /copy this checklist's weather/i }))
    await screen.findByText(/no valid eBird id/i)
    expect(lookupWeather).not.toHaveBeenCalled()
    expect(onCopy).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })
})
