// One row of the Named Birds list: a collapsed header (chevron · name · species ·
// date-range · sighting count) that expands to the bird's reports and, on the
// Named Birds tab, a small per-individual sightings map.
//
// Extracted from NamedBirdsTable so the per-row `cardMarkers` useMemo lives at a
// stable hook position — an inline useMemo inside `.map()` would violate the
// rules of hooks. The map mounts only while the row is open (FR-21) and only when
// the individual has usable coordinates (FR-23); on the single-open Named Birds
// tab at most one map (one WebGL context) is ever mounted.

import { useMemo, useRef, lazy, Suspense } from 'react'
import { ChevronRight, ChevronDown, Map as MapIcon } from 'lucide-react'
import { formatDate, formatElapsedSpan } from '../lib/formatDate'
import { buildSightingMarkers } from '../lib/sightingMarkers'
import { ChecklistLink } from './ChecklistLink'
import { HotspotLink } from './HotspotLink'
import { NamedBirdMedia } from './NamedBirdMedia'
import { NamedBirdLocations } from './NamedBirdLocations'
import { NamedBirdRangeControl } from './NamedBirdRangeControl'
import { NamedBirdTimeline } from './NamedBirdTimeline'
import { birdAxis, buildLanes, type SpanRange } from '../lib/namedBirdTimeline'
import { endpoints, rangeGroupCard, scopeNote } from '../lib/namedBirdTimelineCopy'
import type { NamedBird } from '../lib/namedBirds'
import type { NamedBirdAsset } from '../lib/namedBirdMedia'
// react-only (it imports `react` and ./useFocusTrap and nothing else), which is
// what lets this file — which IS on App.tsx's static import graph — call it
// directly. The map-side half of the feature lives in
// components/map/MapCornerControls.tsx and must never be imported from here; it
// arrives with SightingsMap through the lazy import below.
import { useMapFullscreen, MapFullscreenProvider } from '../lib/useMapFullscreen'

// SightingsMap (and the ~1 MB maplibre-gl it pulls) is lazy-loaded so it stays
// out of the app's entry chunk and off first paint — this static import was the
// sole eager path that dragged maplibre into the entry bundle. The per-row map
// only renders when a row is expanded, and App idle-warms the same chunk so
// opening a row stays instant. See the 0.5.42 load-optimization change.
const SightingsMap = lazy(() => import('./SightingsMap').then(m => ({ default: m.SightingsMap })))

export function NamedBirdRow({ bird, open, onToggle, showSpecies, showMap, renderSpecies, isHotspot, media = [], hasML = false, embedAllowed, timeline }: {
  bird: NamedBird
  open: boolean
  onToggle: () => void
  showSpecies: boolean
  /** Render the per-individual map when expanded (Named Birds tab only). */
  showMap: boolean
  renderSpecies?: (commonName: string, scientificName: string) => React.ReactNode
  isHotspot: (locId: string | null | undefined) => boolean
  /** This individual's matched ML media (Named Birds tab only; [] elsewhere). */
  media?: NamedBirdAsset[]
  /** True when an ML export is loaded — gates the media section's presence (FR-17). */
  hasML?: boolean
  /** Hydrated app-wide iframe eligibility gate. */
  embedAllowed: boolean
  /**
   * The Named Birds tab's timeline wiring: the tab-wide range value, its setter,
   * and the tab's session date. ONE optional object, so the gate and the data the
   * gate needs cannot separate — Species Detail omits it, and therefore renders
   * no range control and no strip, and measures its figure firstSeen to lastSeen
   * because there is no other value it could take.
   */
  timeline?: {
    range: SpanRange
    onRangeChange: (r: SpanRange) => void
    /** YYYY-MM-DD, the tab's session constant. */
    today: string
  }
}) {
  // Per-coordinate markers for this bird, skipping null-coord sightings (FR-22).
  // Empty → no map rendered (FR-23). Cheap, but memoized so the array identity is
  // stable for SightingsMap / MapBoundsFitter across re-renders.
  const cardMarkers = useMemo(() => buildSightingMarkers(bird.sightings), [bird.sightings])

  // Fullscreen for the card map. `active` is the whole teardown story here: this
  // ROW stays mounted when the accordion closes — only its `{open && (...)}`
  // subtree unmounts — so a hook at the row's top level would never see an
  // unmount, and an expanded map would leave a body scroll lock and a document
  // Escape listener behind. `active` going false collapses and releases both.
  const cardMapRef = useRef<HTMLDivElement>(null)
  const cardMapFs = useMapFullscreen({
    containerRef: cardMapRef,
    baseClass: 'sr-named-map',
    active: open && showMap && cardMarkers.length > 0,
  })

  // ONE axis, two consumers: the header figure IS this axis's span, so the number
  // and the picture of the number cannot disagree. Species Detail passes no
  // `timeline`, so its axis runs firstSeen to lastSeen — the correctness repair
  // reaches that surface too, which is intended.
  const axis = birdAxis(bird, timeline?.range ?? 'last-sighting', timeline?.today ?? null)
  const duration = formatElapsedSpan(axis.spanDays)
  // A few dozen strings per open card, so no memo: the dependency array would be
  // a thing to get wrong and would save nothing measurable. (`cardMarkers` above
  // is memoized for a different reason — array identity for SightingsMap and
  // MapBoundsFitter — which does not apply to a strip of plain divs.)
  const lane = buildLanes([bird], axis)[0]

  return (
    <div style={{ border: '1px solid var(--sr-border)', borderRadius: 10, overflow: 'hidden', background: 'var(--sr-surface)', boxShadow: 'var(--sr-card-shadow)' }}>
      <button tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        style={{
          // flexWrap lets the date-range/count group drop to its own line on
          // phones instead of overflowing (the card clips at overflow:hidden);
          // the bird name gets min-width:0 so it ellipsizes rather than forcing
          // the right group off-row.
          display: 'flex', alignItems: 'baseline', gap: 8, rowGap: 4, flexWrap: 'wrap', width: '100%',
          padding: '11px 13px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ color: 'var(--sr-text-muted)', flexShrink: 0, display: 'inline-flex', alignSelf: 'center' }}>
          {open ? <ChevronDown size={15} strokeWidth={2.4} aria-hidden /> : <ChevronRight size={15} strokeWidth={2.4} aria-hidden />}
        </span>
        <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--sr-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{bird.name}</span>
        {showSpecies && (
          <span style={{ minWidth: 0, overflow: 'hidden', display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
            {renderSpecies ? renderSpecies(bird.commonName, bird.scientificName) : (
              <span style={{ fontSize: '0.84375rem', fontWeight: 500, color: 'var(--sr-text)' }}>{bird.commonName}</span>
            )}
          </span>
        )}
        {/* THE WIDTH CAP AND THE TWO RELEASED MINIMUMS ARE LOAD-BEARING, and this
            group clipped at 320px without them.

            `flexShrink: 0` says "do not squeeze me", which is shipped intent and
            is kept. But a group that is never narrowed has no reason to break a
            line, so the column inside it sizes to its widest child's MAX-CONTENT
            and simply overflows the card's `overflow: hidden` box, pushing the
            sighting count out of sight rather than wrapping. Removing this
            feature's `white-space: nowrap` from the duration line (FR-64) makes
            wrapping POSSIBLE; it does not make it happen, because nothing was
            ever asking the line to be narrower.

            `maxWidth: '100%'` is what makes the cap bind. It is
            responsive-by-construction (no breakpoint math), it was measured
            identical in effect to dropping `flexShrink: 0`, and it is preferred
            because it keeps the do-not-get-squeezed intent rather than
            discarding it. This is the v0.5.82 `.sr-wrap-flex` finding applied to
            a cluster that carries its flex inline.

            One cap is not enough: a wrapping flex row is not contained until
            EVERY nested automatic minimum on the overflow path is released
            (v0.5.86). Both this group and the date column below are flex items,
            and a flex item's `min-width: auto` floors it at its own min-content
            regardless of the space available, so both take `minWidth: 0`. The
            date-range line keeps its own `nowrap`, so the column's min-content
            stays that line's width and the two dates never break. */}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 13, flexShrink: 0, maxWidth: '100%', minWidth: 0 }}>
          {/* The date-range line, then the elapsed span on a subtle second line
              beneath it; the column keeps the two dates + duration together as a
              unit when the header wraps on phones (parent already flexWraps).
              The two dates above are facts about SIGHTINGS and do not move when
              the range moves: this line is byte-identical in both range states
              and keeps its nowrap.

              The duration line is the true number of calendar days between the
              two endpoints of the active range, rendered in the bands
              `formatElapsedSpan` documents — exact to the day below 365, then to
              within half a month. On the tab it names which two dates it
              measures, so a reader who never touches the range control can tell,
              and so a press changes the phrase on every visible card at once.
              That phrase is why this line LOSES its `white-space: nowrap`: it has
              to be allowed to wrap. */}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-gray)', whiteSpace: 'nowrap' }}>
              {formatDate(bird.firstSeen)} – {formatDate(bird.lastSeen)}
            </span>
            {duration && (
              <span className="sr-nbt-durline" style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right' }}>
                <b style={{ fontWeight: 600 }}>{duration}</b>
                {timeline && <span style={{ fontWeight: 400 }}> · {endpoints(timeline.range)}</span>}
              </span>
            )}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sr-accent)', whiteSpace: 'nowrap' }}>
            {bird.sightingCount} {bird.sightingCount === 1 ? 'sighting' : 'sightings'}
          </span>
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--sr-border-subtle)', background: 'var(--sr-surface-faint)' }}>
          {/* The range control comes first and carries no micro-label of its own:
              it has a visible label already, and it governs the header figure
              whether or not this bird has a strip. This is the one instance that
              reads as card-local, so it is the one that carries the scope note —
              the explanation goes where the ambiguity is. */}
          {timeline && (
            <div style={{ padding: '12px 14px 8px' }}>
              <NamedBirdRangeControl
                range={timeline.range}
                onChange={timeline.onRangeChange}
                groupLabel={rangeGroupCard}
              />
              <p className="sr-nbt-scope">{scopeNote}</p>
            </div>
          )}

          {/* Then the strip, above the report rows: a fast overview first, the
              full record second. A bird with a single sighting gets none, and its
              header figure still renders. The rows below are unchanged and remain
              the full record — they alone carry the checklist link and the
              species comment, so the strip is a strict subset of them. */}
          {timeline && bird.sightings.length >= 2 && lane && (
            <NamedBirdTimeline lane={lane} axis={axis} />
          )}

          {bird.sightings.map((s, i) => (
            <div
              key={`${s.submissionId}-${i}`}
              style={{ padding: '10px 14px 11px 36px', borderBottom: i < bird.sightings.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none' }}
            >
              {/* date · location · checklist on one line; location ellipsizes */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, marginBottom: 4 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-text)', flexShrink: 0 }}>{formatDate(s.date)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)', flexShrink: 0, padding: '0 7px' }} aria-hidden>·</span>
                {s.location && (
                  <>
                    <HotspotLink
                      locId={s.locationId}
                      name={s.location}
                      isHotspot={isHotspot(s.locationId)}
                      truncate
                      title={s.location}
                      style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', minWidth: 0 }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)', flexShrink: 0, padding: '0 7px' }} aria-hidden>·</span>
                  </>
                )}
                <ChecklistLink
                  submissionId={s.submissionId}
                  style={{ flexShrink: 0, fontSize: '0.75rem', fontWeight: 600 }}
                />
              </div>
              {s.comment && (
                <div className="sr-wrap-anywhere" style={{
                  fontSize: '0.8125rem', color: 'var(--sr-text)', lineHeight: 1.55,
                  background: 'var(--sr-quote-bg)',
                  border: '1px solid var(--sr-quote-border)',
                  borderLeft: '3px solid var(--sr-accent-border)',
                  borderRadius: 7, padding: '8px 11px', marginTop: 5,
                }}>
                  {s.comment}
                </div>
              )}
            </div>
          ))}

          {/* Where this individual has been recorded, ranked by its own sighting
              count — above the map, so the ranked read comes before the spatial
              one. Named-Birds-tab-only (same `showMap` gate as the map and media);
              it draws nothing when no sighting carries a location name. */}
          {showMap && (
            <NamedBirdLocations
              sightings={bird.sightings}
              isHotspot={isHotspot}
              lastInCard={cardMarkers.length === 0 && !hasML}
            />
          )}

          {/* Per-individual sightings map — below the reports, only when this bird
              has usable coordinates. The empty-array guard keeps the WebGL context
              from mounting for a no-coordinate individual (FR-23). */}
          {showMap && cardMarkers.length > 0 && (
            <div style={{ padding: '12px 14px 14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
                fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase', color: 'var(--sr-text-muted)',
              }}>
                <MapIcon size={12} strokeWidth={2.2} aria-hidden />
                Where {bird.name} has been seen
              </div>
              {/* The border, radius and clip moved into the .sr-named-map rule in
                  globals.css: an inline declaration is specificity 1,0,0, so the
                  expanded panel class could never drop them for the fullscreen
                  state. `switcher={false}` stays false in BOTH states — a control
                  that does not exist collapsed and appears expanded is
                  fullscreen-specific chrome, and turning it on would also open a
                  settings.json base-map write path from a card that has never had
                  one. */}
              <div ref={cardMapRef} className={cardMapFs.className}>
                <MapFullscreenProvider value={cardMapFs}>
                  <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>Loading map…</div>}>
                    {/* compact: this card map is 220px tall and often half the page
                        wide, so the share popup, its drop button and the fullscreen
                        toggle take the denser density — in both states, since
                        nothing about a control should change size as a side effect
                        of the toggle. Passed explicitly rather than by default. */}
                    <SightingsMap markers={cardMarkers} switcher={false} compact />
                  </Suspense>
                </MapFullscreenProvider>
              </div>
            </div>
          )}

          {/* Per-individual media — below the map block, Named-Birds-tab-only (like
              the map). Renders in this position whether or not the bird has a map;
              it draws its own empty state, and renders nothing when no ML is loaded
              (FR-06/16/17). Species Detail's caller omits showMap → media-less. */}
          {showMap && (
            <NamedBirdMedia birdName={bird.name} assets={media} open={open} hasML={hasML} embedAllowed={embedAllowed} />
          )}
        </div>
      )}
    </div>
  )
}
