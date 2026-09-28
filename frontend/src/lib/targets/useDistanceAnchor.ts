// Where distances are measured from (targets-tab, schema.md section 5.7;
// FR-51, FR-51a, FR-54a; design-spec 2a).
//
// Four choices: the saved Default Location (the default), the device position
// (the existing location seam, no new permission prompt), a place the user
// searched for, or a place from the county's live data. The choice drives every
// distance cell, the distance sort and the slider at once.
//
// SESSION-ONLY, BY DESIGN (user decision): the choice is React state in this
// hook, which lives in the always-mounted Targets tab, so it survives a county
// change and resets on relaunch. It is NEVER written through the storage seam: a
// device position must not be persisted, and a remembered searched place would
// be a new stored document. The one storage call here is the READ of the
// Default Location, through the one shape guard the widget hand-over already
// uses (`readDefaultLocation`), re-read whenever Settings saves or clears it.
//
// A LOCATE THAT LANDS LATE ONLY ENDS ITS OWN REQUEST. Every choice advances a
// generation; a device position that arrives after the user has chosen
// something else is dropped rather than overwriting the newer choice.

import { useCallback, useEffect, useRef, useState } from 'react'
import { storage } from '../storage'
import { subscribeMapDefaultsChanged } from '../mapDefaultsChanged'
import { readDefaultLocation } from '../widgets/widgetHandover'
import { describeLocationError, getCurrentLocation, type LocationError } from '../location'
import type { Anchor } from './targetsLive'
import type { AnchorKind } from './targetsCopy'

type Choice =
  | { kind: 'default' }
  | { kind: 'device' | 'search' | 'place'; name: string | null; at: Anchor }

export interface AnchorState {
  /** The point distances are measured from, or null when nothing is set. */
  anchor: Anchor | null
  /** Which kind of point it is, or null when nothing is set. */
  kind: AnchorKind | null
  /** A searched or listed place's name; null for the Default Location and the device. */
  name: string | null
  hasDefault: boolean
  locating: boolean
  /** Why My location failed; the previous anchor stays in force. */
  error: string | null
  /** Advances on every failure, so a repeated message is re-announced. */
  errorSeq: number
  /** Resolves true when the device position became the anchor. */
  chooseDevice: () => Promise<boolean>
  chooseDefault: () => void
  choosePlace: (kind: 'search' | 'place', name: string, lat: number, lng: number) => void
}

export function useDistanceAnchor(): AnchorState {
  const [saved, setSaved] = useState<Anchor | null>(null)
  const [choice, setChoice] = useState<Choice>({ kind: 'default' })
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorSeq, setErrorSeq] = useState(0)
  const gen = useRef(0)

  useEffect(() => {
    let cancelled = false
    const read = () => {
      void storage.getSetting<unknown>('map-defaults')
        .then(raw => { if (!cancelled) setSaved(readDefaultLocation(raw)) })
        .catch(() => { if (!cancelled) setSaved(null) })
    }
    read()
    const unsubscribe = subscribeMapDefaultsChanged(read)
    return () => { cancelled = true; unsubscribe() }
  }, [])

  const chooseDevice = useCallback((): Promise<boolean> => {
    const mine = ++gen.current
    setLocating(true)
    setError(null)
    return getCurrentLocation()
      .then(loc => {
        if (gen.current !== mine) return false
        setChoice({ kind: 'device', name: null, at: { lat: loc.lat, lng: loc.lng } })
        return true
      })
      .catch((err: unknown) => {
        if (gen.current !== mine) return false
        const e = (err && typeof err === 'object' && 'code' in err) ? err as LocationError : { code: 'unavailable' } as LocationError
        setError(describeLocationError(e))
        setErrorSeq(s => s + 1)
        return false
      })
      .finally(() => { if (gen.current === mine) setLocating(false) })
  }, [])

  const chooseDefault = useCallback(() => {
    gen.current += 1
    setLocating(false)
    setError(null)
    setChoice({ kind: 'default' })
  }, [])

  const choosePlace = useCallback((kind: 'search' | 'place', name: string, lat: number, lng: number) => {
    gen.current += 1
    setLocating(false)
    setError(null)
    setChoice({ kind, name, at: { lat, lng } })
  }, [])

  const anchor = choice.kind === 'default' ? saved : choice.at
  const kind: AnchorKind | null = choice.kind === 'default' ? (saved ? 'default' : null) : choice.kind
  const name = choice.kind === 'default' ? null : choice.name
  return { anchor, kind, name, hasDefault: saved !== null, locating, error, errorSeq, chooseDevice, chooseDefault, choosePlace }
}
