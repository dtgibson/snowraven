// Settings -> Alerts (ios-alerts, design-spec.md sections 1 to 8). iPhone and
// iPad only: Settings.tsx renders this lazily behind `alertsSupported()`, so on
// the Mac, Windows, web and the Pi it is never fetched and never in the markup
// (FR-01; settingsAlertsOff.test.tsx holds those tabs to the base commit).
//
// A CLIENT OF NATIVE. Everything shown comes from the snapshot the Swift alert
// actor returned (`useAlertsState`), and every change is an action the
// controller forwards to it (`alertsActions`). The section never checks, never
// schedules, never posts a notification and never reads location on its own:
// the only location reads are the two presses that ask for one, My location and
// Use my location (FR-15, QA-07).
//
// Every string is in `lib/alerts/alertsCopy.ts`; every DOM id is keyed on the
// instance and an index, never on a species or place name (NFR-07). Buttons
// and links are the shared primitives (the WebKit tab-order contract).
//
// THE CONFIGURATION REVEAL is a grid-collapse (`0fr` to `1fr`) whose inner block
// is `inert` while collapsed (ui.md: a CSS-collapsed panel is not hidden), so
// it contributes no height and no tab stops while alerts are off. The status
// line lives inside it: the region enters the accessibility tree when the
// switch turns on, carrying the sentence of that moment (which needs no
// announcement: the switch's own state change is what was just heard), and
// every later change, a check's outcome, lands while it is already in the
// tree. While alerts are off no check can run, so no change is lost.
//
// THE INBOX IS NOT IN HERE ANY MORE (the revision after the live look,
// design-spec 7.0 to 7.4). It is its own App-root sheet; this card ends with the
// Inbox row that opens it, OUTSIDE the reveal so it still shows while alerts
// are off and the inbox has rows, and ABSENT (never hidden) when alerts are off
// and the inbox is empty. The rows, the empty state, the bound line and the
// Clear confirmation moved with the inbox to components/AlertsInboxSheet.tsx.

import { useId, useRef, useState } from 'react'
import { Bell, ChevronRight, Navigation } from 'lucide-react'
import { Button } from '../ui/Button'
import { ToggleSwitch } from '../ui/ToggleSwitch'
import { AddressSearch } from '../AddressSearch'
import { SectionHeader } from './SectionHeader'
import { RadioGroup } from './RadioGroup'
import { describeLocationError, type LocationError } from '../../lib/location'
import {
  alertsActions, useAlertsState,
  type AlertCadence, type AlertModel, type AlertsSnapshot,
} from '../../lib/alerts/alertsState'
import { inboxEntryOpen, newSinceViewed, openAlertsInbox } from '../../lib/alerts/alertsInboxEntry'
import { parseRadius, placeName } from '../../lib/alerts/alertRules'
import * as C from '../../lib/alerts/alertsCopy'

function choiceStyle(active: boolean): React.CSSProperties {
  // The Appearance row's register; one key set in both states (ui.md v1.0.35).
  return {
    flex: 1,
    height: 34,
    border: active ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
    background: active ? 'var(--sr-accent-bg)' : 'var(--sr-surface-subtle)',
    color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
    fontSize: '0.8125rem',
    fontWeight: active ? 600 : 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: 6,
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  }
}

const coord = (x: number | undefined) => (x === undefined ? '' : x.toFixed(5))

function toMinutes(v: string): number | null {
  const m = /^([0-9]{2}):([0-9]{2})$/.exec(v)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  return h <= 23 && mi <= 59 ? h * 60 + mi : null
}

function toTimeValue(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function StatusLine({ snap }: { snap: AlertsSnapshot | null }) {
  if (!snap) return <>{C.NOT_CHECKED}</>
  const nowMs = Date.parse(snap.now)
  if (snap.blocked) {
    const b = C.BLOCKED[snap.blocked]
    return <><span className="sr-alerts-status-lead">{b.lead}</span>{b.rest}</>
  }
  const lc = snap.state.lastCheck
  if (!lc) return <span className="sr-alerts-status-lead">{C.NOT_CHECKED}</span>
  return (
    <>
      <span className="sr-alerts-status-lead">{C.lastCheckedSentence(lc, nowMs)}</span>
      {lc.from === 'fixed-fallback' ? <span className="sr-alerts-status-cap">{C.FROM_FIXED_CAPTION}</span> : null}
    </>
  )
}

export default function AlertsSection() {
  const { loaded, snapshot: snap, busy, error, inboxViewedAt } = useAlertsState()
  const uid = useId()
  const ids = {
    header: `${uid}-h`, intro: `${uid}-intro`, note: `${uid}-note`, cadence: `${uid}-cad`,
    quiet: `${uid}-qh`, quietDesc: `${uid}-qhd`, from: `${uid}-from`, to: `${uid}-to`,
    measure: `${uid}-mf`, lat: `${uid}-lat`, lng: `${uid}-lng`, radius: `${uid}-rad`, radiusHint: `${uid}-radh`,
  }
  const inboxRowRef = useRef<HTMLButtonElement>(null)

  const settings = snap?.settings
  const enabled = settings?.enabled ?? false
  const quiet = settings?.quietHours ?? { on: false, startMin: 1320, endMin: 420 }
  const model: AlertModel = settings?.model ?? 'fixed'
  const fixed = settings?.fixedPlace ?? null
  const following = fixed === null
  const resolved = fixed ?? snap?.defaultLocation ?? null
  const inbox = snap?.inbox ?? []
  const newCount = newSinceViewed(inbox, inboxViewedAt)

  // Drafts that follow the stored values: re-seeded, in render, whenever the
  // stored value they mirror changes (React's adjust-state-on-prop pattern).
  const placeSig = resolved ? `${resolved.lat},${resolved.lng}` : ''
  const [coords, setCoords] = useState({ sig: placeSig, lat: coord(resolved?.lat), lng: coord(resolved?.lng) })
  if (coords.sig !== placeSig) setCoords({ sig: placeSig, lat: coord(resolved?.lat), lng: coord(resolved?.lng) })
  const radiusSig = String(settings?.radiusMi ?? 25)
  const [radius, setRadius] = useState({ sig: radiusSig, text: radiusSig })
  if (radius.sig !== radiusSig) setRadius({ sig: radiusSig, text: radiusSig })
  const radiusRefused = radius.text !== '' && parseRadius(radius.text) === null

  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')

  function commitCoords() {
    const lat = Number(coords.lat)
    const lng = Number(coords.lng)
    const valid = coords.lat.trim() !== '' && coords.lng.trim() !== '' && Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    if (!valid) {
      setCoords({ sig: placeSig, lat: coord(resolved?.lat), lng: coord(resolved?.lng) })
      return
    }
    if (resolved && !following && fixed && fixed.lat === lat && fixed.lng === lng && fixed.name === null) return
    void alertsActions.updateSettings({ fixedPlace: { lat, lng, name: null } })
  }

  async function locateFixedPlace() {
    setLocating(true)
    setLocError('')
    try {
      await alertsActions.useMyLocationForFixedPlace()
    } catch (err) {
      setLocError(describeLocationError(err as LocationError))
    } finally {
      setLocating(false)
    }
  }

  function chooseModel(next: AlertModel) {
    if (next === model) return
    if (next === 'my-location') void alertsActions.chooseMyLocation()
    else void alertsActions.updateSettings({ model: 'fixed' })
  }

  function setQuietTime(which: 'startMin' | 'endMin', value: string) {
    const min = toMinutes(value)
    if (min === null) return
    void alertsActions.updateSettings({ quietHours: { ...quiet, [which]: min } })
  }

  const notifDenied = snap?.permissions.notifications === 'denied'
  const bgOff = snap?.state.backgroundRefresh === 'denied' || snap?.state.backgroundRefresh === 'restricted'

  return (
    <div className="sr-alerts">
      <SectionHeader label={C.ALERTS_HEADER} id={ids.header} />
      <div className="sr-alerts-card">
        <div className="sr-alerts-row sr-alerts-toggle-row">
          <div className="sr-alerts-grow">
            <p className="sr-ics-desc" id={ids.intro}>{C.INTRO}</p>
            <p className="sr-ics-desc sr-alerts-desc-2" id={ids.note}>{enabled ? C.ON_NOTE : C.OFF_NOTE}</p>
            <div className="sr-alerts-err" role="alert">{error ? <span>{C.SAVE_FAILED}</span> : null}</div>
          </div>
          <div className="sr-alerts-switch">
            <ToggleSwitch
              bare
              labelVisible={false}
              label={C.ALERTS_SWITCH_LABEL}
              labelledBy={ids.header}
              describedBy={`${ids.intro} ${ids.note}`}
              checked={enabled}
              busy={busy}
              disabled={!loaded}
              onChange={() => { void alertsActions.setEnabled(!enabled) }}
            />
          </div>
        </div>

        <div className={`sr-alerts-reveal sr-alerts-reveal--rule${enabled ? ' sr-alerts-reveal--open' : ''}`}>
          <div className="sr-alerts-reveal-inner" inert={!enabled}>

            <div className="sr-alerts-row">
              <p className="sr-ics-key-label">{C.CADENCE_LABEL}</p>
              <p className="sr-ics-desc sr-alerts-gap" id={ids.cadence}>{C.CADENCE_DESC}</p>
              <RadioGroup<AlertCadence>
                label={C.CADENCE_LABEL}
                describedBy={ids.cadence}
                value={settings?.cadence ?? 'hourly'}
                onChange={c => { void alertsActions.updateSettings({ cadence: c }) }}
                options={(['hourly', 'daily'] as const).map(k => ({
                  key: k, style: choiceStyle((settings?.cadence ?? 'hourly') === k), children: C.CADENCE_OPTIONS[k],
                }))}
              />
            </div>

            <div className="sr-alerts-row sr-alerts-toggle-row sr-alerts-toggle-row--wrap">
              <div className="sr-alerts-grow">
                <p className="sr-ics-key-label" id={ids.quiet}>{C.QUIET_LABEL}</p>
                <p className="sr-ics-desc" id={ids.quietDesc}>{C.QUIET_DESC}</p>
              </div>
              <ToggleSwitch
                bare
                labelVisible={false}
                label={C.QUIET_LABEL}
                labelledBy={ids.quiet}
                describedBy={ids.quietDesc}
                checked={quiet.on}
                onChange={() => { void alertsActions.updateSettings({ quietHours: { ...quiet, on: !quiet.on } }) }}
              />
              <div className={`sr-alerts-reveal sr-alerts-reveal--full${quiet.on ? ' sr-alerts-reveal--open' : ''}`}>
                <div className="sr-alerts-reveal-inner" inert={!quiet.on}>
                  <div className="sr-alerts-grid-2 sr-alerts-times">
                    <div>
                      <label className="sr-alerts-field-label" htmlFor={ids.from}>{C.QUIET_FROM}</label>
                      <input
                        id={ids.from} type="time" className="sr-alerts-input sr-alerts-input--text sr-input-16"
                        value={toTimeValue(quiet.startMin)}
                        onChange={e => setQuietTime('startMin', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="sr-alerts-field-label" htmlFor={ids.to}>{C.QUIET_TO}</label>
                      <input
                        id={ids.to} type="time" className="sr-alerts-input sr-alerts-input--text sr-input-16"
                        value={toTimeValue(quiet.endMin)}
                        onChange={e => setQuietTime('endMin', e.target.value)}
                      />
                    </div>
                  </div>
                  <p className={`sr-ics-note${quiet.startMin === quiet.endMin ? '' : ' sr-alerts-note--muted'}`}>
                    {C.quietNote(quiet.startMin, quiet.endMin)}
                  </p>
                </div>
              </div>
            </div>

            <div className="sr-alerts-row">
              <p className="sr-ics-key-label">{C.MEASURE_LABEL}</p>
              <div className="sr-alerts-gap">
                <RadioGroup<AlertModel>
                  label={C.MEASURE_LABEL}
                  describedBy={ids.measure}
                  value={model}
                  onChange={chooseModel}
                  options={(['fixed', 'my-location'] as const).map(k => ({
                    key: k, style: choiceStyle(model === k), children: C.MEASURE_OPTIONS[k],
                  }))}
                />
              </div>
              <p className="sr-ics-desc" id={ids.measure}>{model === 'fixed' ? C.MEASURE_DESC_FIXED : C.MEASURE_DESC_MY}</p>
            </div>

            <div className="sr-alerts-row">
              <p className="sr-ics-key-label">{model === 'fixed' ? C.FIXED_LABEL : C.FIXED_LABEL_FALLBACK}</p>
              {resolved ? (
                <div className="sr-alerts-place">
                  {!following && fixed?.name ? <span className="sr-alerts-place-name">{fixed.name}</span> : null}
                  {following ? <span className="sr-alerts-place-from">{C.FOLLOWING_DEFAULT}</span> : null}
                  <span className="sr-alerts-place-coords">{`${coord(resolved.lat)}, ${coord(resolved.lng)}`}</span>
                </div>
              ) : null}
              <AddressSearch onLocate={(lat, lng, query) => {
                void alertsActions.updateSettings({ fixedPlace: { lat, lng, name: placeName(query) } })
              }} />
              <div className="sr-alerts-grid-2 sr-alerts-coords">
                <div>
                  <label className="sr-alerts-field-label" htmlFor={ids.lat}>{C.LATITUDE}</label>
                  <input
                    id={ids.lat} type="text" inputMode="decimal" className="sr-alerts-input sr-input-16"
                    value={coords.lat}
                    onChange={e => setCoords({ ...coords, lat: e.target.value })}
                    onBlur={commitCoords}
                    onKeyDown={e => { if (e.key === 'Enter') commitCoords() }}
                  />
                </div>
                <div>
                  <label className="sr-alerts-field-label" htmlFor={ids.lng}>{C.LONGITUDE}</label>
                  <input
                    id={ids.lng} type="text" inputMode="decimal" className="sr-alerts-input sr-input-16"
                    value={coords.lng}
                    onChange={e => setCoords({ ...coords, lng: e.target.value })}
                    onBlur={commitCoords}
                    onKeyDown={e => { if (e.key === 'Enter') commitCoords() }}
                  />
                </div>
              </div>
              <div className="sr-alerts-btn-row">
                <Button
                  type="button" className="sr-btn-quiet sr-touch-target"
                  aria-busy={locating || undefined}
                  onClick={() => { if (!locating) void locateFixedPlace() }}
                >
                  <Navigation size={13} strokeWidth={2} aria-hidden="true" className="sr-alerts-glyph" />
                  {locating ? C.LOCATING : C.USE_MY_LOCATION}
                </Button>
                <Button
                  type="button" className="sr-btn-quiet sr-touch-target"
                  disabled={following}
                  onClick={() => { void alertsActions.updateSettings({ fixedPlace: null }) }}
                >
                  {C.FOLLOW_DEFAULT}
                </Button>
              </div>
              <div className="sr-alerts-err" role="alert">{locError ? <span>{locError}</span> : null}</div>
              <p className="sr-alerts-hint">{C.FIXED_HINT}</p>
            </div>

            <div className="sr-alerts-row">
              <label className="sr-ics-key-label sr-alerts-block" htmlFor={ids.radius}>{C.RADIUS_LABEL}</label>
              <div className="sr-alerts-radius">
                <input
                  id={ids.radius} type="text" inputMode="numeric" className="sr-alerts-input sr-input-16"
                  aria-describedby={ids.radiusHint}
                  aria-invalid={radiusRefused || undefined}
                  value={radius.text}
                  onChange={e => {
                    const text = e.target.value
                    setRadius({ sig: radiusSig, text })
                    const n = parseRadius(text)
                    if (n !== null && n !== settings?.radiusMi) void alertsActions.updateSettings({ radiusMi: n })
                  }}
                  onBlur={() => { if (parseRadius(radius.text) === null) setRadius({ sig: radiusSig, text: radiusSig }) }}
                />
                <span className="sr-alerts-unit">{C.RADIUS_UNIT}</span>
              </div>
              <p className="sr-alerts-hint" id={ids.radiusHint}>{C.RADIUS_HINT}</p>
              <div className="sr-alerts-err" role="alert">{radiusRefused ? <span>{C.RADIUS_REFUSED}</span> : null}</div>
            </div>

            <div className="sr-alerts-row">
              <p className="sr-alerts-status" role="status" aria-live="polite"><StatusLine snap={snap} /></p>
            </div>

            {notifDenied || bgOff ? (
              <div className="sr-alerts-row">
                {notifDenied ? <p className="sr-ics-note sr-alerts-note">{C.NOTIFICATIONS_DENIED}</p> : null}
                {bgOff ? <p className="sr-ics-note sr-alerts-note">{C.BACKGROUND_REFRESH_OFF}</p> : null}
              </div>
            ) : null}

            <p className="sr-alerts-fine">{C.FINE_NETWORK}</p>
            <p className="sr-alerts-fine">{C.FINE_COUNTABILITY}</p>
          </div>
        </div>

        {/* The Inbox row (design-spec 7.1): the card's last element, OUTSIDE
            the reveal, rendered while alerts are on or the inbox has rows and
            absent otherwise. It opens the App-root sheet with itself as the
            opener, so focus returns here when the sheet closes. */}
        {inboxEntryOpen(snap) ? (
          <Button
            ref={inboxRowRef}
            type="button"
            className="sr-inbox-link"
            aria-haspopup="dialog"
            aria-label={C.inboxRowName(inbox.length, newCount)}
            onClick={() => openAlertsInbox({ trigger: () => inboxRowRef.current })}
          >
            <Bell size={15} strokeWidth={2.2} aria-hidden="true" className="sr-inbox-link-glyph" />
            <span className="sr-inbox-link-text">
              <span className="sr-inbox-link-title">{C.INBOX_LABEL}</span>
              <span className="sr-inbox-link-sub">{C.inboxRowSub(inbox.length, newCount)}</span>
            </span>
            <ChevronRight size={15} strokeWidth={2} aria-hidden="true" className="sr-inbox-link-chev" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
