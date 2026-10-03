// "Measure distances from" (targets-tab FR-51a, QA-53a; design-spec 2a): the
// small dialog the status line's anchor trigger opens. My location (the location
// seam), the Default Location, a place by name (the shared, submit-only
// `AddressSearch`: one OpenStreetMap request per press, never per keystroke),
// and the places the county's live data already names (no request at all).
//
// FOCUS. Opening moves focus to the first item; Tab stays inside (the shared
// `useFocusTrap`, the ModalDialog posture, `containOutsideFocus: false`);
// Escape, a choice and a successful search close it and return focus to the
// trigger; a click outside closes it and returns focus to the trigger only when
// the click left focus nowhere (a click on another control keeps that control's
// focus). A search miss or a failed locate keeps it open.
//
// No DOM id here is built from a place name (security.md v1.0.21): the dialog's
// own id comes from the caller and the section labels from `useId`.

import { useEffect, useId, useRef, type RefObject } from 'react'
import { LocateFixed, MapPin } from 'lucide-react'
import { Button } from '../ui/Button'
import { AddressSearch } from '../AddressSearch'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { showLocationControls } from '../../lib/platformGates'
import { placeDistance, type ListPlace } from '../../lib/targets/targetsAnchor'
import type { AnchorState } from '../../lib/targets/useDistanceAnchor'
import {
  CHOOSER_DEFAULT, CHOOSER_DEFAULT_NONE, CHOOSER_DEFAULT_SUB, CHOOSER_LIST_EMPTY, CHOOSER_LIST_SECTION,
  CHOOSER_MY_LOCATION, CHOOSER_MY_LOCATION_SUB, CHOOSER_PLACE_SECTION, CHOOSER_SEARCH_FAILED, CHOOSER_SEARCH_HINT,
  CHOOSER_TITLE, LOCATING, milesText,
} from '../../lib/targets/targetsCopy'

export type ChooserClose = 'choice' | 'outside'

export interface ChooserProps {
  id: string
  anchor: AnchorState
  places: readonly ListPlace[]
  /** The trigger, so a click on it toggles rather than counting as outside. */
  triggerRef: RefObject<HTMLButtonElement | null>
  onClose: (how: ChooserClose) => void
}

export function TargetsAnchorChooser({ id, anchor, places, triggerRef, onClose }: ChooserProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)
  const placeSecId = useId()
  const listSecId = useId()

  useFocusTrap(true, rootRef, { containOutsideFocus: false })

  // Focus the first item on open. My location is always enabled (aria-disabled,
  // never native-disabled, while it locates), so it is the first wherever it
  // renders. On Android under location branch B it is absent (FR-56) and the
  // list opens on Default Location, which can be native-disabled when no
  // default is saved; then the place search's field takes focus instead.
  const locationShown = showLocationControls()
  const defaultRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const first = locationShown ? firstRef.current : defaultRef.current
    if (first && !first.disabled) { first.focus(); return }
    rootRef.current?.querySelector<HTMLElement>('input')?.focus()
  }, [locationShown])

  // Escape and a click outside, through the caller's one close path.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose('choice')
    }
    function onPointer(e: PointerEvent) {
      const t = e.target
      if (!(t instanceof Node)) return
      if (rootRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      onClose('outside')
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [onClose, triggerRef])

  const current = anchor.kind
  return (
    <div className="sr-tg-apop" id={id} role="dialog" aria-label={CHOOSER_TITLE} ref={rootRef}>
      <div className="sr-tg-apop-head" aria-hidden="true">{CHOOSER_TITLE}</div>
      {locationShown && <>
      <Button
        ref={firstRef}
        type="button"
        className="sr-tg-apop-item"
        aria-current={current === 'device' ? 'true' : undefined}
        aria-disabled={anchor.locating ? true : undefined}
        onClick={() => {
          if (anchor.locating) return
          void anchor.chooseDevice().then(ok => { if (ok) onClose('choice') })
        }}
      >
        <LocateFixed className="sr-tg-apop-ic" size={14} strokeWidth={2.2} aria-hidden="true" />
        <span className="sr-tg-apop-t">
          {CHOOSER_MY_LOCATION}
          <span className="sr-tg-apop-sub">{anchor.locating ? LOCATING : CHOOSER_MY_LOCATION_SUB}</span>
        </span>
      </Button>
      {/* Always mounted, sequence-keyed: a failed locate is announced each time
          and leaves the previous anchor in force. */}
      <div className="sr-tg-apop-err" role="alert">
        {anchor.error ? <span key={anchor.errorSeq}>{anchor.error}</span> : null}
      </div>
      </>}
      <Button
        ref={defaultRef}
        type="button"
        className="sr-tg-apop-item"
        aria-current={current === 'default' ? 'true' : undefined}
        disabled={!anchor.hasDefault}
        onClick={() => { anchor.chooseDefault(); onClose('choice') }}
      >
        <MapPin className="sr-tg-apop-ic" size={14} strokeWidth={2.2} aria-hidden="true" />
        <span className="sr-tg-apop-t">
          {CHOOSER_DEFAULT}
          <span className="sr-tg-apop-sub">{anchor.hasDefault ? CHOOSER_DEFAULT_SUB : CHOOSER_DEFAULT_NONE}</span>
        </span>
      </Button>

      <div role="group" aria-labelledby={placeSecId}>
        <div className="sr-tg-apop-sec" id={placeSecId}>{CHOOSER_PLACE_SECTION}</div>
        <AddressSearch
          hint={CHOOSER_SEARCH_HINT}
          failedMessage={CHOOSER_SEARCH_FAILED}
          onLocate={(lat, lng, query) => { anchor.choosePlace('search', query, lat, lng); onClose('choice') }}
        />
      </div>

      <div role="group" aria-labelledby={listSecId}>
        <div className="sr-tg-apop-sec" id={listSecId}>{CHOOSER_LIST_SECTION}</div>
        {places.length === 0 ? (
          <div className="sr-tg-apop-empty">{CHOOSER_LIST_EMPTY}</div>
        ) : (
          <div className="sr-tg-apop-list">
            {places.map((p, i) => {
              const d = placeDistance(anchor.anchor, p)
              const on = current === 'place' && anchor.name === p.name
                && anchor.anchor !== null && anchor.anchor.lat === p.lat && anchor.anchor.lng === p.lng
              return (
                <Button
                  key={i}
                  type="button"
                  className="sr-tg-apop-item"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => { anchor.choosePlace('place', p.name, p.lat, p.lng); onClose('choice') }}
                >
                  <MapPin className="sr-tg-apop-ic" size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span className="sr-tg-apop-t">{p.name}</span>
                  {d !== null ? <span className="sr-tg-apop-d">{`${milesText(d).value} ${milesText(d).unit}`}</span> : null}
                </Button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
