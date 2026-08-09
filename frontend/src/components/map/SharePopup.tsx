// Pin Share — the one popup body, two hosts, two densities.
//
// SharePin renders it under a dropped share pin (surfaces A, C, D, E, F);
// MapExplorer renders it under the EXISTING search-center pin (surface B). One
// implementation, one accessible-name formula, one failure state — which is what
// keeps the center views from growing their own copy UI.
//
// It renders the react-map-gl <Popup> itself (not just the inner body) so both
// hosts also share the chrome, the anchor/offset behaviour and the single close
// path. Escaped JSX throughout, no dangerouslySetInnerHTML (NFR-08).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Popup, useMap } from 'react-map-gl/maplibre'
import { AlertTriangle, Check, Copy, MapPin } from 'lucide-react'
import { copyText } from '../../lib/clipboard'
import {
  buildSharePayload, formatCoordinate, selectedParts, shareCopyLabel, shareModeLine,
  SHARE_EMPTY_POPUP,
} from '../../lib/shareLocation'
import { useShareCopySelection } from '../../lib/shareCopyPreference'

/** How long the "Copied" confirmation stays before the button settles back. */
const COPIED_MS = 2000

const MSG_COPIED = 'Location copied to the clipboard.'
const MSG_FAILED = 'Could not copy. The text is shown so you can copy it manually.'
const MSG_SELECTED = "Text selected. Copy it with your device's copy command."

// ── Compact scroll cap, measured against the room the MAP has ─────────────────
// The Named Birds card map is a fixed 220px (.sr-named-map) with overflow:
// hidden, and it does not grow with the in-app text scale. A rem cap therefore
// got the sign wrong twice over: it was unrelated to the space available, and at
// 200% text scale it DOUBLED on a card that had not grown at all, which is
// exactly where it had to shrink. These are px because the thing being fitted is
// a px-sized box, not a line of text.
/** The Designer's 9.5rem cap, pinned to px: the most the body may ever take. */
const COMPACT_BODY_MAX_PX = 152
/** Never collapse below a touch target, so the copy control stays reachable. */
const COMPACT_BODY_MIN_PX = 44
/** Header, content padding and the popup tip, i.e. everything outside the body. */
const COMPACT_CHROME_PX = 44
/** Breathing room so the popup does not sit flush against the map edge. */
const COMPACT_EDGE_MARGIN_PX = 8

export function SharePopup({ lat, lng, compact, offset, onClose }: {
  lat: number
  lng: number
  /** Density. REQUIRED, never defaulted, per the MediaFrame precedent: a default
   *  that encodes a display decision is invisible at the call site and silently
   *  hands the next caller a choice they did not make. Compact reduces size,
   *  never meaning — every label, the mode line, the failure text and Select all
   *  are present at both densities. */
  compact: boolean
  /** Distance in px from the coordinate to the popup tip, so the popup clears
   *  whichever pin sprite it belongs to. */
  offset: number
  /** The ONE close path: the close control, Escape and any maplibre dismissal all
   *  route here. The host removes the pin and the popup together (FR-09) and
   *  restores focus after the close render commits (FR-40). */
  onClose: () => void
}) {
  const map = useMap().current
  const selection = useShareCopySelection()
  const on = useMemo(() => selectedParts(selection), [selection])
  const coord = useMemo(() => formatCoordinate(lat, lng), [lat, lng])
  const payload = useMemo(() => buildSharePayload(lat, lng, selection), [lat, lng, selection])

  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  // The live region is rendered from the start and never mounts alongside its
  // message. It carries a SEQUENCE alongside the text because a repeat of an
  // identical message must still be announced: React bails out when a state
  // string is unchanged, so `setAnnouncement(MSG_COPIED)` on a second identical
  // copy wrote nothing, the region's DOM never mutated, and assistive tech said
  // nothing. FR-27 is worded per-copy, and the asymmetry was the tell: the
  // visible confirmation re-rendered every press while the announcement fired
  // once. The seq is the key of the message node inside the region, so each
  // announcement is a real node replacement (an "addition" in aria-live terms)
  // while the region's own textContent stays exactly the message.
  const [announcement, setAnnouncement] = useState<{ text: string; seq: number }>({ text: '', seq: 0 })
  const announce = (text: string) => setAnnouncement(a => ({ text, seq: a.seq + 1 }))

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const payloadRef = useRef<HTMLPreElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // A drag (or a preference change) makes any previous result stale: the
  // confirmation would be claiming a copy of a coordinate that is no longer on
  // screen, and a revealed failure payload would be the wrong text. This is
  // React's "adjusting state when a prop changes" pattern (a bare setState
  // during render, no effect) — an effect here would be a cascading render and
  // is what react-hooks/set-state-in-effect rejects. The 2s timer is left armed
  // on purpose: its callback only sets `copied` to false, which is already the
  // value, and doCopy clears it before arming a new one.
  const [renderedPayload, setRenderedPayload] = useState(payload)
  if (renderedPayload !== payload) {
    setRenderedPayload(payload)
    setCopied(false)
    setFailed(false)
  }

  // The popup can close mid-timeout.
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
  }, [])

  // Size the compact body to the room the map ACTUALLY has on the side maplibre
  // will anchor to, rather than to the font size. Writes a px custom property
  // straight onto the element (a DOM side effect, no setState), so this stays
  // out of the render path entirely.
  useEffect(() => {
    if (!compact || !map) return
    const container = map.getContainer()
    if (!container) return
    const apply = () => {
      const el = bodyRef.current
      if (!el) return
      // MapLibre picks the roomier side, so bound by the better of the two.
      const y = map.project([lng, lat]).y
      const room = Math.max(y - offset, container.clientHeight - y - offset) - COMPACT_EDGE_MARGIN_PX
      const cap = Math.min(COMPACT_BODY_MAX_PX, Math.max(COMPACT_BODY_MIN_PX, room - COMPACT_CHROME_PX))
      el.style.setProperty('--sr-share-body-cap', `${Math.round(cap)}px`)
    }
    apply()
    // The card map can be resized by the page (a phone rotation, a text-scale
    // change reflowing the card), and panning moves the pin within it.
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(apply); ro.observe(container) }
    map.on('move', apply)
    return () => { ro?.disconnect(); map.off('move', apply) }
  }, [compact, map, lat, lng, offset])

  // Escape closes. Bound in the CAPTURE phase at document with stopPropagation so
  // this innermost layer wins over the bubble-phase document handlers that exit
  // map fullscreen and close the mobile filters overlay.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  async function doCopy() {
    // FR-26 — always the clipboard seam, never navigator.clipboard. It returns a
    // boolean and CAN genuinely be refused, so false is a handled outcome.
    const ok = await copyText(payload)
    if (ok) {
      setFailed(false)
      setCopied(true)
      announce(MSG_COPIED)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => { setCopied(false); copiedTimerRef.current = null }, COPIED_MS)
      return
    }
    setCopied(false)
    setFailed(true)
    announce(MSG_FAILED)
  }

  // Selection API only — it makes NO clipboard call, so it cannot fail the way
  // the copy just did. It earns its place because on a phone, dragging a
  // selection across three wrapped lines inside a map popup is hard enough that
  // "select the text below" would be advice the user cannot follow.
  function selectAll() {
    const el = payloadRef.current
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!el || !sel) return
    sel.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.addRange(range)
    announce(MSG_SELECTED)
  }

  // Both generated from the parts table, never a lookup over the eight states.
  // Neither is called when nothing is selected: n === 0 is a STRUCTURAL change
  // below (a sentence in place of the control), not a ninth string.
  const buttonLabel = copied ? 'Copied' : shareCopyLabel(on)

  return (
    <Popup
      longitude={lng}
      latitude={lat}
      offset={offset}
      // Our own close button (below) so the accessible name can be the honest
      // "Close and remove the pin" — maplibre hardcodes "Close popup" on its own.
      closeButton={false}
      // A stray map click must not destroy the pin; FR-09 lists the close
      // control, Escape and leaving the map, not an incidental click.
      closeOnClick={false}
      onClose={onClose}
      className={`sr-share-popup${compact ? ' sr-share-popup--compact' : ''}`}
      maxWidth="calc(100vw - 24px)"
    >
      {/* Styled as maplibre's own close button so it inherits the existing theming
          and the ~44px coarse-pointer target already in globals.css. */}
      <button
        type="button"
        className="maplibregl-popup-close-button"
        aria-label="Close and remove the pin"
        onClick={onClose}
      >
        ×
      </button>

      <div className="sr-share-pop-head">
        <MapPin size={11} strokeWidth={2.4} aria-hidden />
        Share location
      </div>

      <div ref={bodyRef} className={compact ? 'sr-share-pop-body' : 'sr-share-pop-body sr-map-popup-body'}>
        <p className="sr-share-coord">{coord}</p>

        {on.length === 0 ? (
          /* The copy control is REPLACED by a sentence, never left as a dead
             disabled button: no control that looks pressable may put an empty
             string on the clipboard, and a greyed control invites a press that
             explains nothing. The coordinate above still renders, so the pin
             shows the spot and the text stays selectable by hand. */
          <p className="sr-share-none">{SHARE_EMPTY_POPUP}</p>
        ) : (
          <>
            <button
              type="button"
              className="sr-share-copy-btn sr-touch-target"
              data-state={copied ? 'done' : undefined}
              onClick={() => { void doCopy() }}
            >
              {copied
                ? <Check size={13} strokeWidth={2.6} aria-hidden />
                : <Copy size={13} strokeWidth={2.2} aria-hidden />}
              <span>{buttonLabel}</span>
            </button>

            {/* FR-30 — what the press produces is evident BEFORE it, so a
                partial copy is never a surprise. This names every part in full,
                which is what makes the button's collapsed "map links" safe. */}
            <p className="sr-share-mode-line">{shareModeLine(on)}</p>
          </>
        )}

        {failed && (
          <div className="sr-share-fail">
            <p className="sr-share-fail-msg">
              <AlertTriangle size={12} strokeWidth={2.4} aria-hidden />
              <span>Could not copy automatically. Select the text below and copy it.</span>
            </p>
            <div className="sr-share-fail-bar">
              <span>Text to copy</span>
              <button type="button" className="sr-share-link-btn" onClick={selectAll}>Select all</button>
            </div>
            <pre ref={payloadRef} className="sr-share-payload">{payload}</pre>
          </div>
        )}
      </div>

      {/* One region, present from first render; only its CHILD changes. The key
          makes each announcement a fresh node, so a repeat of an identical
          message is still an addition assistive tech reports. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement.text ? <span key={announcement.seq}>{announcement.text}</span> : null}
      </span>
    </Popup>
  )
}
