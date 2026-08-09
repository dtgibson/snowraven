// One row of the Named Birds list: a collapsed header (chevron · name · species ·
// date-range · sighting count) that expands to the bird's reports and, on the
// Named Birds tab, a small per-individual sightings map.
//
// Extracted from NamedBirdsTable so the per-row `cardMarkers` useMemo lives at a
// stable hook position — an inline useMemo inside `.map()` would violate the
// rules of hooks. The map mounts only while the row is open (FR-21) and only when
// the individual has usable coordinates (FR-23); on the single-open Named Birds
// tab at most one map (one WebGL context) is ever mounted.

import { useMemo, lazy, Suspense } from 'react'
import { ChevronRight, ChevronDown, Map as MapIcon } from 'lucide-react'
import { formatDate, formatSightingDuration } from '../lib/formatDate'
import { buildSightingMarkers } from '../lib/sightingMarkers'
import { ChecklistLink } from './ChecklistLink'
import { HotspotLink } from './HotspotLink'
import { NamedBirdMedia } from './NamedBirdMedia'
import type { NamedBird } from '../lib/namedBirds'
import type { NamedBirdAsset } from '../lib/namedBirdMedia'

// SightingsMap (and the ~1 MB maplibre-gl it pulls) is lazy-loaded so it stays
// out of the app's entry chunk and off first paint — this static import was the
// sole eager path that dragged maplibre into the entry bundle. The per-row map
// only renders when a row is expanded, and App idle-warms the same chunk so
// opening a row stays instant. See the 0.5.42 load-optimization change.
const SightingsMap = lazy(() => import('./SightingsMap').then(m => ({ default: m.SightingsMap })))

export function NamedBirdRow({ bird, open, onToggle, showSpecies, showMap, renderSpecies, isHotspot, media = [], hasML = false, embedAllowed }: {
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
}) {
  // Per-coordinate markers for this bird, skipping null-coord sightings (FR-22).
  // Empty → no map rendered (FR-23). Cheap, but memoized so the array identity is
  // stable for SightingsMap / MapBoundsFitter across re-renders.
  const cardMarkers = useMemo(() => buildSightingMarkers(bird.sightings), [bird.sightings])

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
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 13, flexShrink: 0 }}>
          {/* Date range with the elapsed-span duration on a subtle second line
              beneath it; the column keeps the two dates + duration together as a
              unit when the header wraps on phones (parent already flexWraps). */}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-gray)', whiteSpace: 'nowrap' }}>
              {formatDate(bird.firstSeen)} – {formatDate(bird.lastSeen)}
            </span>
            {formatSightingDuration(bird.firstSeen, bird.lastSeen) && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>
                {formatSightingDuration(bird.firstSeen, bird.lastSeen)}
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
              <div className="sr-named-map" style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--sr-border)' }}>
                <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>Loading map…</div>}>
                  {/* compact: this card map is 220px tall and often half the page
                      wide, so the share popup and its drop button take the denser
                      density. Passed explicitly rather than relying on a default. */}
                  <SightingsMap markers={cardMarkers} switcher={false} compact />
                </Suspense>
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
