// @vitest-environment jsdom
// The Alerts inbox as its own sheet (ios-alerts design-spec 7.3, 7.5 and 8, the
// revision after the live look), rendered for real over a snapshot. The rows,
// the empty state and the Clear confirmation moved here from
// AlertsSection.test.tsx with the inbox itself (QA-36, QA-39; NFR-07). The
// host rows drive the sheet through `useAlertsInboxHost`, the same hook App.tsx
// calls, so the close paths, "last viewed" and the focus return are tested
// where they are decided, and so is Mark read (alerts-inbox-mark-read).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within, waitFor, act } from '@testing-library/react'
import { useRef } from 'react'

const storageMock = vi.hoisted(() => ({ setSetting: vi.fn().mockResolvedValue(undefined), getSetting: vi.fn().mockResolvedValue(null) }))
vi.mock('../lib/storage', () => ({ storage: storageMock }))
// The host acts on iPhone and iPad only (security I12), so this file runs as one.
vi.mock('../lib/platform', () => ({
  isTauri: vi.fn(() => true), isIOS: vi.fn(() => true), isWindows: vi.fn(() => false), isMacOS: vi.fn(() => false),
}))

import AlertsInboxSheet from './AlertsInboxSheet'
import { Button } from './ui/Button'
import {
  getAlertsState, installAlertsActions, resetAlertsState, setAlertsState,
  type AlertsActions, type AlertsSnapshot, type InboxRow,
} from '../lib/alerts/alertsState'
import { useAlertsInboxHost } from '../lib/alerts/alertsInboxHost'
import { INBOX_VIEWED_SETTING, newSinceViewed } from '../lib/alerts/alertsInboxEntry'
import * as C from '../lib/alerts/alertsCopy'
import { isIOS } from '../lib/platform'

const NOW = '2026-09-30T16:00:00Z'

function snap(over: Partial<AlertsSnapshot> = {}): AlertsSnapshot {
  return {
    settings: {
      version: 1, enabled: true, cadence: 'hourly', quietHours: { on: false, startMin: 1320, endMin: 420 },
      model: 'fixed', fixedPlace: null, radiusMi: 25, updatedAt: NOW,
    },
    state: { version: 1, lastCheck: null, holdUntil: null, position: null, pending: null, scheduledEarliest: null, backgroundRefresh: 'available' },
    inbox: [],
    blocked: null,
    permissions: { notifications: 'granted', location: 'not-determined' },
    defaultLocation: { lat: 38.5446, lng: -121.7405 },
    now: NOW,
    ...over,
  }
}

const row = (i: number, over: Partial<InboxRow> = {}): InboxRow => ({
  id: `00000000-0000-4000-8000-00000000000${i}`, checkId: 'c', speciesCode: `sp${i}`, comName: `Species Number ${i}`,
  locId: `L${i}`, locName: `Place Number ${i}`, lat: 38.55, lng: -121.63, obsDt: '2026-09-30 07:45',
  distanceMi: 5.9 + i, point: { lat: 38.5449, lng: -121.7405 }, radiusMi: 25, place: { kind: 'nearby' },
  alertedAt: NOW, updatedAt: NOW, ...over,
})

let actions: { [K in keyof AlertsActions]: ReturnType<typeof vi.fn> }
beforeEach(() => {
  resetAlertsState()
  storageMock.setSetting.mockClear()
  actions = {
    setEnabled: vi.fn(async () => {}), updateSettings: vi.fn(async () => {}), chooseMyLocation: vi.fn(async () => {}),
    useMyLocationForFixedPlace: vi.fn(async () => {}), clearInbox: vi.fn(async () => {}), openRow: vi.fn(),
  }
  installAlertsActions(actions as unknown as AlertsActions)
})
afterEach(() => { cleanup(); installAlertsActions(null); vi.mocked(isIOS).mockReturnValue(true) })

function sheet(s: AlertsSnapshot, viewedAt: string | null = null) {
  setAlertsState({ loaded: true, snapshot: s })
  const onClosed = vi.fn()
  const onMarkRead = vi.fn(() => true)
  const utils = render(<AlertsInboxSheet viewedAt={viewedAt} opener={() => null} onClosed={onClosed} onMarkRead={onMarkRead} />)
  return { ...utils, onClosed, onMarkRead }
}

describe('the sheet: rows, the empty state, the New marks (QA-36; NFR-07)', () => {
  it('is a modal dialog named by its title; the Close button takes initial focus', () => {
    sheet(snap({ inbox: [row(1)] }))
    const dialog = screen.getByRole('dialog', { name: /^Alerts inbox/ })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: C.CLOSE_INBOX }))
    expect(dialog.textContent).toContain('1 alert')
  })

  it('empty: the two sentences, no list, Clear and Mark read disabled', () => {
    const { container } = sheet(snap())
    expect(container.textContent).toContain(C.INBOX_EMPTY)
    expect(container.textContent).toContain(C.INBOX_EMPTY_DETAIL)
    expect(container.querySelector('ul')).toBeNull()
    expect((screen.getByRole('button', { name: C.CLEAR }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: C.MARK_READ }) as HTMLButtonElement).disabled).toBe(true)
    expect(container.textContent).toContain(C.INBOX_BOUND)
  })

  it('rows: one Button each, named in one sentence, index-keyed ids, in native\'s order; New only after last viewed', () => {
    const rows = [row(1), row(2, { alertedAt: '2026-09-29T15:00:00Z' })]
    const { container } = sheet(snap({ inbox: rows }), '2026-09-30T00:00:00Z')
    const list = screen.getByRole('list', { name: C.INBOX_LIST_LABEL })
    const buttons = within(list).getAllByRole('button')
    expect(buttons.map(b => b.id)).toEqual(['sr-alerts-row-0', 'sr-alerts-row-1'])
    expect(buttons[0]!.getAttribute('aria-label')).toMatch(/^New\. Species Number 1, Place Number 1, 6\.9 miles, reported today, alerted .+\. Show on the map$/)
    expect(buttons[1]!.getAttribute('aria-label')).toMatch(/^Species Number 2, /)
    expect(buttons[0]!.className).toContain('sr-alert--new')
    expect(buttons[0]!.textContent).toContain(C.NEW_WORD)
    expect(buttons[1]!.className).not.toContain('sr-alert--new')
    expect(container.querySelectorAll('.sr-alert-dot')).toHaveLength(1)
    for (const el of Array.from(container.querySelectorAll('[id]'))) expect(el.id).not.toMatch(/Species|Place|sp1|sp2/)
    // Mark read sits just before Clear, in one group, enabled while a row is New.
    const actions = container.querySelector('.sr-inbox-actions')!
    expect(within(actions as HTMLElement).getAllByRole('button').map(b => b.textContent)).toEqual([C.MARK_READ, C.CLEAR])
    expect((screen.getByRole('button', { name: C.MARK_READ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('rows but none New: Mark read is disabled, Clear is not', () => {
    sheet(snap({ inbox: [row(1, { alertedAt: '2026-09-29T15:00:00Z' })] }), '2026-09-30T00:00:00Z')
    expect((screen.getByRole('button', { name: C.MARK_READ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: C.CLEAR }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('never viewed: every row is new', () => {
    sheet(snap({ inbox: [row(1), row(2)] }), null)
    expect(screen.getAllByRole('button', { name: /^New\. / })).toHaveLength(2)
  })
})

describe('closing: one path (design-spec 7.3)', () => {
  it.each([
    ['the X', () => fireEvent.click(screen.getByRole('button', { name: C.CLOSE_INBOX }))],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['a mousedown on the scrim outside the panel', () => fireEvent.mouseDown(document.querySelector('.sr-inbox-root')!)],
  ])('%s closes it once, after the exit, with no row', async (_name, act) => {
    const { onClosed } = sheet(snap({ inbox: [row(1)] }))
    act()
    act()
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1))
    expect(onClosed).toHaveBeenCalledWith(null)
  })

  it('a mousedown INSIDE the panel does not close it; a short drag on the handle does not either, a swipe down does', async () => {
    const { onClosed } = sheet(snap({ inbox: [row(1)] }))
    fireEvent.mouseDown(screen.getByRole('dialog'))
    const grab = document.querySelector('.sr-inbox-grab')!
    fireEvent.pointerDown(grab, { pointerId: 1, clientY: 100 })
    fireEvent.pointerUp(grab, { pointerId: 1, clientY: 120 })
    await new Promise(r => setTimeout(r, 300))
    expect(onClosed).not.toHaveBeenCalled()
    fireEvent.pointerDown(grab, { pointerId: 2, clientY: 100 })
    fireEvent.pointerUp(grab, { pointerId: 2, clientY: 200 })
    await waitFor(() => expect(onClosed).toHaveBeenCalledWith(null))
  })
})

describe('Clear (design-spec 8; QA-39)', () => {
  it('the confirmation renders ABOVE the sheet: a child of the sheet root, after the panel, outside its transform', async () => {
    const { container } = sheet(snap({ inbox: [row(1)] }))
    fireEvent.click(screen.getByRole('button', { name: C.CLEAR }))
    const dialog = await screen.findByRole('dialog', { name: C.CLEAR_TITLE })
    const root = container.querySelector('.sr-inbox-root')!
    const dlgRoot = dialog.closest('.sr-dlg-root')!
    expect(dlgRoot.parentElement).toBe(root)
    expect(root.querySelector('.sr-inbox-sheet')!.contains(dlgRoot)).toBe(false)
    expect(root.lastElementChild).toBe(dlgRoot)
  })

  it('asks first; Escape closes only the confirmation; Cancel changes nothing; confirming clears and the sheet stays', async () => {
    const { onClosed } = sheet(snap({ inbox: [row(1)] }))
    const clear = screen.getByRole('button', { name: C.CLEAR })
    fireEvent.click(clear)
    const dialog = await screen.findByRole('dialog', { name: C.CLEAR_TITLE })
    expect(within(dialog).getByText(C.CLEAR_BODY)).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: C.CLEAR_TITLE })).toBeNull())
    await new Promise(r => setTimeout(r, 300))
    expect(onClosed).not.toHaveBeenCalled()
    fireEvent.click(clear)
    const again = await screen.findByRole('dialog', { name: C.CLEAR_TITLE })
    fireEvent.click(within(again).getByRole('button', { name: C.CANCEL }))
    expect(actions.clearInbox).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: C.CLEAR_TITLE })).toBeNull())
    fireEvent.click(clear)
    const third = await screen.findByRole('dialog', { name: C.CLEAR_TITLE })
    // The clear lands as native's next snapshot does: the inbox is empty, so
    // the footer's Clear (the dialog's trigger) is now disabled.
    actions.clearInbox.mockImplementation(async () => { setAlertsState({ snapshot: snap() }) })
    fireEvent.click(within(third).getAllByRole('button', { name: C.CLEAR }).at(-1)!)
    expect(actions.clearInbox).toHaveBeenCalledTimes(1)
    expect(actions.setEnabled).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /^Alerts inbox/ })).toBeTruthy()
    // So focus goes to Close, never to <body> (the dialog's fallbackFocus).
    await waitFor(() => expect(screen.queryByRole('dialog', { name: C.CLEAR_TITLE })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: C.CLOSE_INBOX })))
    expect((clear as HTMLButtonElement).disabled).toBe(true)
  })
})

// ── The host: last viewed, focus return, a row tap ──────────────────────────

function Host({ showOpener = true, showSwitch = false }: { showOpener?: boolean; showSwitch?: boolean }) {
  const mainRef = useRef<HTMLElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const host = useAlertsInboxHost(mainRef)
  return (
    <>
      <main ref={mainRef} tabIndex={-1}>
        {showSwitch && (
          <div className="sr-alerts-switch"><Button type="button" role="switch" aria-checked="true">Alerts</Button></div>
        )}
        {showOpener && (
          <Button ref={btn} type="button" onClick={() => host.openInbox({ trigger: () => btn.current })}>Open inbox</Button>
        )}
      </main>
      {host.open && (
        <AlertsInboxSheet viewedAt={host.open.viewedAt} opener={host.openerEl} onClosed={host.closeInbox} onMarkRead={host.markRead} />
      )}
    </>
  )
}

describe('the host (design-spec 7.3 and 7.5)', () => {
  it.each([
    ['the X', () => fireEvent.click(screen.getByRole('button', { name: C.CLOSE_INBOX }))],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['outside', () => fireEvent.mouseDown(document.querySelector('.sr-inbox-root')!)],
  ])('%s: focus returns to the opener; "last viewed" is written on open and counted from on close', async (_n, close) => {
    setAlertsState({ loaded: true, snapshot: snap({ inbox: [row(1)] }), inboxViewedAt: '2026-09-29T00:00:00Z' })
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Open inbox' })
    opener.focus()
    fireEvent.click(opener)
    expect(storageMock.setSetting).toHaveBeenCalledWith(INBOX_VIEWED_SETTING, NOW)
    // The marks and the count do not move while the user is looking at them.
    expect(getAlertsState().inboxViewedAt).toBe('2026-09-29T00:00:00Z')
    expect(screen.getAllByRole('button', { name: /^New\. / })).toHaveLength(1)
    close()
    await waitFor(() => expect(document.querySelector('.sr-inbox-root')).toBeNull())
    expect(document.activeElement).toBe(opener)
    expect(getAlertsState().inboxViewedAt).toBe(NOW)
  })

  it.each([
    ['the Alerts switch, when Settings is showing', true, () => screen.getByRole('switch', { name: 'Alerts' })],
    ['<main>, when the switch is not showing', false, () => document.querySelector('main')],
  ])('if the opener is gone, focus goes to %s', async (_n, showSwitch, target) => {
    setAlertsState({ loaded: true, snapshot: snap({ inbox: [row(1)] }) })
    const { rerender } = render(<Host showSwitch={showSwitch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }))
    rerender(<Host showOpener={false} showSwitch={showSwitch} />)
    fireEvent.click(screen.getByRole('button', { name: C.CLOSE_INBOX }))
    await waitFor(() => expect(document.querySelector('.sr-inbox-root')).toBeNull())
    expect(document.activeElement).toBe(target())
  })

  it('a snapshot time "last viewed" would refuse is neither written nor kept, so memory and disk agree (security I11)', async () => {
    const ahead = new Date(Date.now() + 25 * 3_600_000).toISOString().slice(0, 19) + 'Z'
    setAlertsState({ loaded: true, snapshot: snap({ inbox: [row(1)], now: ahead }), inboxViewedAt: '2026-09-29T00:00:00Z' })
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }))
    expect(storageMock.setSetting).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: C.CLOSE_INBOX }))
    await waitFor(() => expect(document.querySelector('.sr-inbox-root')).toBeNull())
    expect(getAlertsState().inboxViewedAt).toBe('2026-09-29T00:00:00Z')
  })

  it('not iPhone or iPad: opening does nothing, whoever calls it (security I12)', () => {
    vi.mocked(isIOS).mockReturnValue(false)
    setAlertsState({ loaded: true, snapshot: snap({ inbox: [row(1)] }) })
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }))
    expect(document.querySelector('.sr-inbox-root')).toBeNull()
    expect(storageMock.setSetting).not.toHaveBeenCalled()
  })

  it('a row tap closes the sheet, THEN opens the map (FR-37 unchanged)', async () => {
    const rows = [row(1), row(2)]
    setAlertsState({ loaded: true, snapshot: snap({ inbox: rows }) })
    actions.openRow.mockImplementation(() => {
      // By the time the map opens, the exit has run.
      expect(document.querySelector('.sr-inbox-root--closing')).not.toBeNull()
    })
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }))
    fireEvent.click(screen.getByRole('button', { name: /^New\. Species Number 2/ }))
    expect(actions.openRow).not.toHaveBeenCalled()
    await waitFor(() => expect(actions.openRow).toHaveBeenCalledWith(rows[1]))
    await waitFor(() => expect(document.querySelector('.sr-inbox-root')).toBeNull())
  })
})

describe('Mark read (alerts-inbox-mark-read)', () => {
  const OPENED = '2026-09-29T00:00:00Z'
  const LANDED = '2026-09-30T16:30:00Z'
  const LATER = '2026-09-30T17:15:00Z'
  const newNames = () => screen.queryAllByRole('button', { name: /^New\. / })
  const markBtn = () => screen.getByRole('button', { name: C.MARK_READ }) as HTMLButtonElement
  const closeBtn = () => screen.getByRole('button', { name: C.CLOSE_INBOX })

  function openWithLateCheck() {
    setAlertsState({ loaded: true, snapshot: snap({ inbox: [row(1)] }), inboxViewedAt: OPENED })
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }))
    expect(storageMock.setSetting).toHaveBeenCalledWith(INBOX_VIEWED_SETTING, NOW)
    // A check lands while the sheet is open: a newer snapshot, a newer row.
    act(() => setAlertsState({ snapshot: snap({ inbox: [row(2, { alertedAt: LANDED }), row(1)], now: LANDED }) }))
    expect(newNames()).toHaveLength(2)
    storageMock.setSetting.mockClear()
  }

  it('clears every New mark in place, moves "last viewed" to the snapshot\'s now on disk and in the store before close, and close never moves it back', async () => {
    openWithLateCheck()
    const mark = markBtn()
    mark.focus()
    fireEvent.click(mark)
    // Focus went to Close before the button disabled itself: never <body>.
    expect(document.activeElement).toBe(closeBtn())
    expect(mark.disabled).toBe(true)
    // The accessible names drop "New. " at once; nothing is removed.
    expect(newNames()).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: /^Species Number / })).toHaveLength(2)
    expect(storageMock.setSetting).toHaveBeenCalledTimes(1)
    expect(storageMock.setSetting).toHaveBeenCalledWith(INBOX_VIEWED_SETTING, LANDED)
    const st = getAlertsState()
    expect(st.inboxViewedAt).toBe(LANDED)
    expect(newSinceViewed(st.snapshot!.inbox, st.inboxViewedAt)).toBe(0)
    expect(screen.getByRole('status').textContent).toBe(C.MARKED_READ_STATUS)
    // The visible marks fade (aria-hidden), then go: the write did not wait for them.
    expect(document.querySelectorAll('.sr-alert--read .sr-alert-dot')).toHaveLength(2)
    await waitFor(() => expect(document.querySelectorAll('.sr-alert-dot')).toHaveLength(0))
    expect(document.querySelectorAll('.sr-alert--read, .sr-alert--new')).toHaveLength(0)
    // Close commits the pending value: the Mark read time, not the opening's.
    fireEvent.click(closeBtn())
    await waitFor(() => expect(document.querySelector('.sr-inbox-root')).toBeNull())
    expect(getAlertsState().inboxViewedAt).toBe(LANDED)
    expect(storageMock.setSetting).toHaveBeenCalledTimes(1)
  })

  it('a row that arrives later is New again and re-enables the button; a second press announces again', async () => {
    openWithLateCheck()
    fireEvent.click(markBtn())
    const status = screen.getByRole('status')
    const first = status.firstElementChild
    expect(first?.textContent).toBe(C.MARKED_READ_STATUS)
    act(() => setAlertsState({ snapshot: snap({ inbox: [row(3, { alertedAt: LATER }), row(2, { alertedAt: LANDED }), row(1)], now: LATER }) }))
    expect(newNames().map(b => b.id)).toEqual(['sr-alerts-row-0'])
    expect(markBtn().disabled).toBe(false)
    fireEvent.click(markBtn())
    expect(newNames()).toHaveLength(0)
    expect(storageMock.setSetting).toHaveBeenLastCalledWith(INBOX_VIEWED_SETTING, LATER)
    expect(getAlertsState().inboxViewedAt).toBe(LATER)
    // The same sentence in a NEW node, so the live region speaks again (ui.md).
    expect(status.textContent).toBe(C.MARKED_READ_STATUS)
    expect(status.firstElementChild).not.toBe(first)
    // The marks' own opacity transitionend ends the fade before the fallback.
    const dot = document.querySelector('.sr-alert--read .sr-alert-dot')!
    fireEvent.transitionEnd(dot, { propertyName: 'opacity' })
    expect(document.querySelectorAll('.sr-alert-dot')).toHaveLength(0)
  })

  it('a snapshot time "last viewed" would refuse is neither written nor kept, and nothing is announced (security I11)', async () => {
    openWithLateCheck()
    const ahead = new Date(Date.now() + 25 * 3_600_000).toISOString().slice(0, 19) + 'Z'
    act(() => setAlertsState({ snapshot: snap({ inbox: [row(2, { alertedAt: LANDED }), row(1)], now: ahead }) }))
    fireEvent.click(markBtn())
    expect(document.activeElement).toBe(closeBtn())
    expect(storageMock.setSetting).not.toHaveBeenCalled()
    expect(getAlertsState().inboxViewedAt).toBe(OPENED)
    expect(newNames()).toHaveLength(2)
    expect(screen.getByRole('status').textContent).toBe('')
    // The close still commits the opening's own validated time, never the refused one.
    fireEvent.click(closeBtn())
    await waitFor(() => expect(document.querySelector('.sr-inbox-root')).toBeNull())
    expect(getAlertsState().inboxViewedAt).toBe(NOW)
  })
})
