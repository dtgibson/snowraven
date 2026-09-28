// Rows 2 and 3 of the controls card (targets-tab FR-19 to FR-25, FR-48 to
// FR-54a; design-spec section 2): the three type toggles with the Media chips
// and the breeding threshold, the summary and its live twin, the sort select,
// the Last report window, the distance slider and the one status line beneath,
// whose anchor name opens the "Measure distances from" chooser (FR-51a,
// design-spec 2a).
//
// THE SLIDER'S DESCRIPTION IS A HIDDEN PLAIN-TEXT TWIN OF THE STATUS LINE, not
// the visible line itself: the line now holds the chooser's trigger, whose
// accessible name ("Distances are measured from ... Change") would be spliced
// into any description computed from the line's subtree.
//
// Every control is a native control or the `Button` primitive, each pill and
// segbar option carries `aria-pressed`, and nothing here is blocked by network
// activity (FR-59): the list recomputes from the same inputs whatever a pool
// fetch or a sweep is doing.

import { Fragment, useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import { Camera, ChevronDown, Egg, Key, LocateFixed, MapPin, Mic, Search, Sparkles, Video } from 'lucide-react'
import { Button } from '../ui/Button'
import { TargetsAnchorChooser, type ChooserClose } from './TargetsAnchorChooser'
import type { AnchorState } from '../../lib/targets/useDistanceAnchor'
import type { ListPlace } from '../../lib/targets/targetsAnchor'
import type { MediaType } from '../../lib/targets/targetsRecord'
import type { BreedingThreshold, TargetsToggles } from '../../lib/targets/targetsFilter'
import { SORT_LABELS, SORT_ORDER, type TargetsSort } from '../../lib/targets/targetsSort'
import {
  CHIPS_GROUP_LABEL, DISTANCE_LABEL, DISTANCE_STOP_UNIT, DISTANCE_STOPS, MEDIA_NEEDS_EXPORT,
  MEDIA_UNREADABLE, RETRY, SHOW_LABEL, SORT_ARIA_LABEL, SORT_LABEL,
  STATUS_NEEDS_LIVE_KEY, STATUS_NEEDS_LIVE_OFFLINE, THRESHOLD_ANY, THRESHOLD_CONFIRMED,
  THRESHOLD_GROUP_LABEL, TYPES_GROUP_LABEL, TYPE_BREEDING, TYPE_LIFER, TYPE_MEDIA,
  WINDOW_LABEL, WINDOW_NEEDS_LIVE, WINDOW_OPTIONS, anchorName, anchorStatus, anchorStatusText, anchorTriggerLabel,
  distanceAriaLabel, distancePhrase, distanceStopLabel, summaryAnnounced, summaryVisible, type TypeCounts, type WindowKey,
} from '../../lib/targets/targetsCopy'
import type { MediaState } from '../../lib/targets/useTargetsRecord'

const CHIP_ICONS: Record<MediaType, typeof Camera> = { Photo: Camera, Audio: Mic, Video }

export interface ControlsProps {
  toggles: TargetsToggles
  onToggles: (next: TargetsToggles) => void
  media: MediaState
  onRetryMedia: () => void
  summary: { total: number; counts: TypeCounts } | null
  summarySeq: number
  sort: TargetsSort
  sortSuffix: Record<TargetsSort, string>
  availability: Record<TargetsSort, string | null>
  onSort: (s: TargetsSort) => void
  window: WindowKey
  onWindow: (w: WindowKey) => void
  liveOn: boolean
  liveMissing: 'no-key' | 'no-data'
  distanceIdx: number
  onDistance: (idx: number) => void
  distanceOn: boolean
  anchor: AnchorState
  /** "Places in this list": the county's live-data places (targetsAnchor.ts). */
  places: readonly ListPlace[]
}

export function TargetsControls(p: ControlsProps) {
  const uid = useId()
  const statusId = `${uid}-status`
  const winLabelId = `${uid}-win`
  const mediaReasonId = `${uid}-media`
  const chooserId = `${uid}-anchor`

  // The chooser's open state is UI-local. It exists only with live data (the
  // trigger is not rendered without it), so losing live data closes it.
  const [chooserOpen, setChooserOpen] = useState(false)
  if (chooserOpen && !p.liveOn) setChooserOpen(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Focus returns to the trigger AFTER the commit, so it lands on the element
  // the new status line renders rather than on one the render is replacing.
  const pendingFocus = useRef(false)
  useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    triggerRef.current?.focus()
  })
  const closeChooser = useCallback((how: ChooserClose) => {
    setChooserOpen(false)
    if (how === 'choice') { pendingFocus.current = true; return }
    // A click outside: a click on another control keeps that control's focus;
    // a click on nothing would strand focus on <body>, so it returns to the
    // trigger. Read once the pointer's own focus change has happened.
    setTimeout(() => {
      const a = document.activeElement
      if (a === null || a === document.body) triggerRef.current?.focus()
    }, 0)
  }, [])

  const placeName = anchorName(p.anchor.kind, p.anchor.name)
  const mediaAvailable = p.media === 'ok'
  const set = (patch: Partial<TargetsToggles>) => p.onToggles({ ...p.toggles, ...patch })

  const stopIdx = p.distanceOn ? p.distanceIdx : 0
  const stopMiles = DISTANCE_STOPS[stopIdx]
  const on = { lifer: p.toggles.lifer, media: p.toggles.media && mediaAvailable, breeding: p.toggles.breeding }
  const vis = p.summary ? summaryVisible(p.summary.total, p.summary.counts, on) : null
  const announced = p.summary ? summaryAnnounced(p.summary.total, p.summary.counts, on) : null

  return (
    <>
      <div className="sr-tg-strip-row">
        <span className="sr-tg-label sr-ctl-label">{SHOW_LABEL}</span>
        <div role="group" aria-label={TYPES_GROUP_LABEL} className="sr-tg-group">
          <Button type="button" className="sr-pill" aria-pressed={p.toggles.lifer} onClick={() => set({ lifer: !p.toggles.lifer })}>
            <Sparkles size={12} strokeWidth={2.2} aria-hidden="true" />{TYPE_LIFER}
          </Button>
          <Button
            type="button"
            className="sr-pill"
            aria-pressed={p.toggles.media && mediaAvailable}
            aria-disabled={mediaAvailable ? undefined : true}
            aria-describedby={mediaAvailable ? undefined : mediaReasonId}
            onClick={() => { if (mediaAvailable) set({ media: !p.toggles.media }) }}
          >
            <Camera size={12} strokeWidth={2.2} aria-hidden="true" />{TYPE_MEDIA}
          </Button>
          {mediaAvailable && p.toggles.media ? (
            <span className="sr-tg-sub" role="group" aria-label={CHIPS_GROUP_LABEL}>
              {(['Photo', 'Audio', 'Video'] as const).map(t => {
                const Icon = CHIP_ICONS[t]
                const pressed = p.toggles.chips.has(t)
                return (
                  <Button
                    key={t}
                    type="button"
                    className="sr-tg-chip"
                    aria-pressed={pressed}
                    onClick={() => {
                      const next = new Set(p.toggles.chips)
                      if (pressed) next.delete(t); else next.add(t)
                      set({ chips: next })
                    }}
                  >
                    <Icon size={11} strokeWidth={2.2} aria-hidden="true" />{t}
                  </Button>
                )
              })}
            </span>
          ) : null}
          <Button type="button" className="sr-pill" aria-pressed={p.toggles.breeding} onClick={() => set({ breeding: !p.toggles.breeding })}>
            <Egg size={12} strokeWidth={2.2} aria-hidden="true" />{TYPE_BREEDING}
          </Button>
          {p.toggles.breeding ? (
            <span className="sr-tg-sub">
              <span className="sr-segbar sr-segbar--compact" role="group" aria-label={THRESHOLD_GROUP_LABEL}>
                {([['any', THRESHOLD_ANY], ['confirmed', THRESHOLD_CONFIRMED]] as [BreedingThreshold, string][]).map(([k, label]) => (
                  <Button key={k} type="button" className="sr-segbar-btn" aria-pressed={p.toggles.threshold === k} onClick={() => set({ threshold: k })}>
                    {label}
                  </Button>
                ))}
              </span>
            </span>
          ) : null}
        </div>
        {!mediaAvailable ? (
          <span className="sr-tg-status" id={mediaReasonId}>
            {p.media === 'unreadable'
              ? <>{MEDIA_UNREADABLE}. <Button type="button" className="sr-tg-link" onClick={p.onRetryMedia}>{RETRY}</Button></>
              : MEDIA_NEEDS_EXPORT}
          </span>
        ) : null}
        {vis ? (
          <div className="sr-tg-summary" aria-hidden="true">
            {vis.head}{vis.parts ? <small>{vis.parts}</small> : null}
          </div>
        ) : null}
        {/* Always mounted; the sequence-keyed child is a real node replacement per
            announcement (ui.md, v0.5.80). */}
        <div className="sr-only" role="status">
          {announced ? <Fragment key={p.summarySeq}>{announced}</Fragment> : null}
        </div>
      </div>

      <div className="sr-tg-strip-row sr-tg-strip-row--faint">
        <div className="sr-tg-group sr-tg-group--sort">
          <label className="sr-tg-label sr-ctl-label" htmlFor={`${uid}-sort`}>{SORT_LABEL}</label>
          <span className="sr-tg-sel-wrap">
            <select
              id={`${uid}-sort`}
              className="sr-tg-sel sr-input-16"
              aria-label={SORT_ARIA_LABEL}
              value={p.sort}
              onChange={e => p.onSort(e.target.value as TargetsSort)}
            >
              {SORT_ORDER.map(s => {
                const reason = p.availability[s]
                return (
                  <option key={s} value={s} disabled={reason !== null}>
                    {SORT_LABELS[s]}{reason !== null ? `, ${reason}` : p.sortSuffix[s]}
                  </option>
                )
              })}
            </select>
            <span className="sr-tg-sel-caret" aria-hidden="true"><ChevronDown size={14} strokeWidth={2.2} /></span>
          </span>
        </div>

        <div className="sr-tg-group">
          <span className="sr-tg-label sr-ctl-label" id={winLabelId}>{WINDOW_LABEL}</span>
          <span
            className="sr-segbar"
            role="group"
            aria-labelledby={winLabelId}
            aria-disabled={p.liveOn ? undefined : true}
            aria-describedby={p.liveOn ? undefined : statusId}
            title={p.liveOn ? undefined : WINDOW_NEEDS_LIVE}
          >
            {WINDOW_OPTIONS.map(o => (
              <Button
                key={o.key}
                type="button"
                className="sr-segbar-btn"
                aria-pressed={(p.liveOn ? p.window : 'any') === o.key}
                aria-disabled={p.liveOn ? undefined : true}
                onClick={() => { if (p.liveOn) p.onWindow(o.key) }}
              >
                {o.label}
              </Button>
            ))}
          </span>
        </div>

        <div className="sr-tg-group sr-tg-group--dist">
          <label className="sr-tg-label sr-ctl-label" htmlFor={`${uid}-dist`}>{DISTANCE_LABEL}</label>
          <div className={`sr-tg-range-wrap${p.distanceOn ? '' : ' is-off'}`}>
            <input
              id={`${uid}-dist`}
              className="sr-tg-range"
              type="range"
              min={0}
              max={DISTANCE_STOPS.length - 1}
              step={1}
              value={stopIdx}
              disabled={!p.distanceOn}
              aria-label={distanceAriaLabel(p.distanceOn ? placeName : null)}
              aria-valuemin={0}
              aria-valuemax={DISTANCE_STOPS.length - 1}
              aria-valuenow={stopIdx}
              aria-valuetext={distancePhrase(stopMiles)}
              aria-describedby={statusId}
              onChange={e => p.onDistance(Number(e.target.value))}
              style={{ ['--sr-tg-fill' as string]: `${(stopIdx / (DISTANCE_STOPS.length - 1)) * 100}%` }}
            />
            {/* Each label's position is decided in globals.css, never inline: the
                interior ones centre under their stops from `--sr-tg-stop`, the two
                end ones are pinned to the track's ends, and the last one's unit is
                its own span so it can drop out where it does not fit. */}
            <div className="sr-tg-range-stops" aria-hidden="true">
              {DISTANCE_STOPS.map((m, i) => {
                const last = DISTANCE_STOPS.length - 1
                const edge = i === 0 ? ' sr-tg-range-stop--start' : i === last ? ' sr-tg-range-stop--end' : ''
                return (
                  <span
                    key={i}
                    className={`sr-tg-range-stop${edge}${i === stopIdx ? ' is-on' : ''}`}
                    style={{ ['--sr-tg-stop' as string]: String(i / last) }}
                  >
                    {distanceStopLabel(m, false)}
                    {i === last ? <span className="sr-tg-range-unit">{` ${DISTANCE_STOP_UNIT}`}</span> : null}
                  </span>
                )
              })}
            </div>
          </div>
          <span className={`sr-tg-range-val${p.distanceOn ? '' : ' is-off'}`} aria-hidden="true">{distancePhrase(stopMiles)}</span>
        </div>

        <div className="sr-tg-anchor">
          <div className="sr-tg-status">
            {p.liveOn ? (
              <AnchorLine
                anchor={p.anchor}
                open={chooserOpen}
                chooserId={chooserId}
                triggerRef={triggerRef}
                onToggle={() => setChooserOpen(o => !o)}
              />
            ) : (
              <><Key size={13} strokeWidth={2.2} aria-hidden="true" />{p.liveMissing === 'no-key' ? STATUS_NEEDS_LIVE_KEY : STATUS_NEEDS_LIVE_OFFLINE}</>
            )}
          </div>
          <span id={statusId} hidden>
            {p.liveOn ? anchorStatusText(p.anchor.kind, p.anchor.name) : (p.liveMissing === 'no-key' ? STATUS_NEEDS_LIVE_KEY : STATUS_NEEDS_LIVE_OFFLINE)}
          </span>
          {chooserOpen && p.liveOn ? (
            <TargetsAnchorChooser id={chooserId} anchor={p.anchor} places={p.places} triggerRef={triggerRef} onClose={closeChooser} />
          ) : null}
        </div>
      </div>
    </>
  )
}

/**
 * The status line with its trigger (design-spec 2a). One structure for every
 * kind (glyph, optional bold lead, lead, the trigger Button, tail), so React
 * keeps the SAME trigger element when the anchor changes and focus returned to
 * it after a choice lands on a node that stays.
 */
function AnchorLine({ anchor, open, chooserId, triggerRef, onToggle }: {
  anchor: AnchorState
  open: boolean
  chooserId: string
  triggerRef: RefObject<HTMLButtonElement | null>
  onToggle: () => void
}) {
  const s = anchorStatus(anchor.kind, anchor.name)
  const Icon = anchor.kind === 'device' ? LocateFixed : anchor.kind === 'search' ? Search : MapPin
  return (
    <>
      <Icon size={13} strokeWidth={2.2} aria-hidden="true" />
      {s.strong !== null ? <b>{s.strong}</b> : null}
      {s.lead}
      <Button
        ref={triggerRef}
        type="button"
        className={`sr-tg-anchor-btn${anchor.kind === null ? ' is-cta' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? chooserId : undefined}
        aria-label={anchorTriggerLabel(anchor.kind, anchor.name)}
        onClick={onToggle}
      >
        {s.trigger}<ChevronDown className="sr-tg-anchor-chev" size={11} strokeWidth={2.4} aria-hidden="true" />
      </Button>
      {s.tail}
    </>
  )
}
