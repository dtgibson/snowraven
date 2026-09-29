// The Calendar overlays preference: hydrate once from the storage seam, then
// persist every change of any of the three controls as ONE whole value under
// ONE key (schema.md 1.3), built by storedCalendarOverlays so every write
// carries the version marker (calendar-breeding-category-default).
//
// A component-local hook rather than a module store: the Calendar is the only
// reader and it is mounted once per session (tabs hide with display:none), so a
// useSyncExternalStore singleton would buy sideways propagation nobody needs and
// cost a test-reset seam. Never localStorage, on either transport: the storage
// seam is the source of truth (CLAUDE.md, desktop storage).

import { useCallback, useEffect, useRef, useState } from 'react'
import { storage } from './storage'
import {
  CALENDAR_OVERLAYS_SETTING_KEY, DEFAULT_CALENDAR_OVERLAYS, normalizeCalendarOverlays, overlaysEqual,
  storedCalendarOverlays, type CalendarOverlays, type CodesMode,
} from './calendarOverlays'

export interface CalendarOverlaysControls {
  overlays: CalendarOverlays
  toggle: (layer: 'media' | 'breeding') => void
  setCodes: (mode: CodesMode) => void
}

export function useCalendarOverlays(): CalendarOverlaysControls {
  // Starts at the default with no separate "not hydrated" phase: off issues no
  // request and reads no file, so there is no unsafe pre-hydration state.
  const [overlays, setOverlays] = useState<CalendarOverlays>(DEFAULT_CALENDAR_OVERLAYS)
  // A ref mirror so two changes in one tick compose rather than clobber.
  const stateRef = useRef<CalendarOverlays>(DEFAULT_CALENDAR_OVERLAYS)
  // Set by the first user change: hydration then never overwrites it (FR-05).
  const userChoseRef = useRef(false)
  // Writes run one at a time in change order, so the last change is the one
  // that lands on web/Pi, where two overlapping POSTs of the whole value have
  // no other ordering. Every link swallows its own rejection (FR-06): a failed
  // write leaves the in-session choice alone and the next change writes again.
  const writeChainRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    void storage.getSetting<unknown>(CALENDAR_OVERLAYS_SETTING_KEY)
      .then(raw => normalizeCalendarOverlays(raw))
      .catch(() => DEFAULT_CALENDAR_OVERLAYS)
      .then(next => {
        if (cancelled || userChoseRef.current) return
        if (overlaysEqual(next, stateRef.current)) return
        stateRef.current = next
        setOverlays(next)
      })
    // Hydration is a pure read: nothing is written back here (FR-03), and that
    // includes a migrated value, which is saved only on the next change.
    return () => { cancelled = true }
  }, [])

  const commit = useCallback((next: CalendarOverlays) => {
    stateRef.current = next
    userChoseRef.current = true
    setOverlays(next)
    // Exactly one write per change, always all three fields plus the marker
    // (QA-03), so a deliberate Every code reads back as a choice.
    const value = storedCalendarOverlays(next)
    writeChainRef.current = writeChainRef.current
      .then(() => storage.setSetting(CALENDAR_OVERLAYS_SETTING_KEY, value))
      .catch(() => { /* FR-06: silent; the next change retries */ })
  }, [])

  const toggle = useCallback((layer: 'media' | 'breeding') => {
    const cur = stateRef.current
    commit(layer === 'media' ? { ...cur, media: !cur.media } : { ...cur, breeding: !cur.breeding })
  }, [commit])

  // Re-pressing the pressed option writes nothing. The hook has no opinion on
  // which control is enabled: the component gates the codes control while
  // Breeding is off (FR-36), and a stored choice persists regardless.
  const setCodes = useCallback((mode: CodesMode) => {
    const cur = stateRef.current
    if (cur.codes === mode) return
    commit({ ...cur, codes: mode })
  }, [commit])

  return { overlays, toggle, setCodes }
}
