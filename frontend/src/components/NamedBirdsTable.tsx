// Shared sortable list of individually-named birds. Used by the Named Birds tab
// (showSpecies, singleOpen, a per-individual map, the range control and both
// sighting timelines) and by a per-species section on Species Detail (showSpecies
// off, multi-open, none of those). Each row expands to the bird's reports: date ·
// location · checklist link, the species comment as a quoted block, and (on the
// tab) a small sightings map.
//
// THE TAB-ONLY SURFACES ARE GATED BY A DISCRIMINATED PROPS UNION, not by
// discipline: `singleOpen: true` REQUIRES `today`, so "the tab passed singleOpen
// and forgot the session date" is a compile error rather than a silently
// timeline-less tab. Species Detail supplies neither half, so `sessionToday` is
// null there and every tab-only surface below is absent by construction.
//
// The strip at the bottom lives HERE rather than in `NamedBirds.tsx`, and the
// reason is `sort`, not convenience: lane order must equal card order under
// whichever Sort option is selected, and `sort` plus the `sorted` memo are this
// component's own state. Lifting them to the tab would convert this component
// from self-contained to controlled for EVERY caller, including the one that
// must not receive the feature; duplicating the sort would create two surfaces
// required to agree, which is the failure this feature exists to remove.

import { Button } from './ui/Button'
import { useMemo, useState } from 'react'
import { sortNamedBirds, type NamedBird, type NamedBirdSort } from '../lib/namedBirds'
import { NamedBirdRow } from './NamedBirdRow'
import { NamedBirdMasterTimeline } from './NamedBirdMasterTimeline'
import { NamedBirdRangeControl } from './NamedBirdRangeControl'
import { useHotspotSet } from '../lib/useHotspotSet'
import { buildLanes, masterAxis, type SpanRange } from '../lib/namedBirdTimeline'
import { rangeGroupTab } from '../lib/namedBirdTimelineCopy'
import type { NamedBirdAsset } from '../lib/namedBirdMedia'

type NamedBirdsTableBaseProps = {
  birds: NamedBird[]
  showSpecies: boolean
  /** Renders a species name (BirdName) — supplied only when showSpecies. */
  renderSpecies?: (commonName: string, scientificName: string) => React.ReactNode
  /** commonName → eBird taxonomic order. Supplied only by the Named Birds tab —
   *  enables (and gates the presence of) the Taxonomic sort. */
  orderFor?: (commonName: string) => number
  /** Accordion mode: opening a card collapses the previously open one, capping
   *  live maps at one WebGL context. The Named Birds tab passes true; Species
   *  Detail's map-less section stays multi-open. */
  singleOpen?: boolean
  /** NamedBird.key → that individual's matched ML media. Supplied only by the
   *  Named Birds tab; Species Detail omits it → every row gets [] (media-less). */
  mediaByBird?: Map<string, NamedBirdAsset[]>
  /** True when an ML export is loaded (rides alongside mediaByBird) — lets a bird
   *  with no matched media show the empty state vs. the section being absent. */
  hasML?: boolean
  /** Hydrated app-wide iframe eligibility gate. */
  embedAllowed: boolean
}

/**
 * `today` is the Named Birds tab's session date (`YYYY-MM-DD`), threaded down
 * from the single module-level clock read in `NamedBirds.tsx` so nothing below
 * that component reads the clock and no pure helper takes a clock reading.
 * Pairing it with `singleOpen` in the union is what makes the pair unbreakable.
 */
type NamedBirdsTableProps = NamedBirdsTableBaseProps & (
  | { singleOpen: true; today: string }      // the Named Birds tab
  | { singleOpen?: false; today?: never }    // Species Detail, and tests
)

export function NamedBirdsTable(props: NamedBirdsTableProps) {
  const {
    birds, showSpecies, renderSpecies, orderFor, singleOpen, mediaByBird, hasML, embedAllowed,
  } = props
  // Read off `props`, not off the destructured locals: destructuring a
  // discriminated union loses the narrowing that makes `today` safe here.
  const sessionToday = props.singleOpen ? props.today : null
  const tabOnly = sessionToday !== null

  const [sort, setSort] = useState<NamedBirdSort>('lastSeen')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // ONE range value for the whole tab, session-only React state: not persisted,
  // never `localStorage`, never the `storage` seam. This component is mounted
  // once per tab and a hidden tab is `display: none` rather than unmounted, so
  // the value survives leaving and returning to the tab and resets on relaunch —
  // which is exactly the published "per-session, resetting on relaunch" claim.
  // Nothing else is needed to make that true; do not add persistence.
  const [range, setRange] = useState<SpanRange>('last-sighting')
  const { isHotspot } = useHotspotSet()

  // orderFor in deps so the list re-sorts when the taxonomic orders load (its
  // identity changes only then) — the graceful-degradation signal for FR-14.
  const sorted = useMemo(() => sortNamedBirds(birds, sort, orderFor), [birds, sort, orderFor])

  // The shared axis is order-independent, so it depends on `birds` (stable
  // across a Sort change) rather than on `sorted`: changing Sort then moves lanes
  // without recomputing the axis. It is MEMOIZED SPECIFICALLY SO IT CAN BE A
  // DEPENDENCY — a freshly built {start, end, spanDays} per render would fire the
  // lanes memo every time, and depending on its fields instead would leave
  // react-hooks/exhaustive-deps unsatisfiable.
  //
  // Both bodies are pure: no clock read, no I/O, so react-hooks/purity (which is
  // build-blocking here) is satisfied.
  const axis = useMemo(() => masterAxis(birds, range, sessionToday), [birds, range, sessionToday])
  // The one place a memo earns itself: buildLanes is O(birds x sightings) and the
  // tab re-renders on every accordion toggle and every range press. Species
  // Detail does none of this work at all.
  const lanes = useMemo(() => (tabOnly ? buildLanes(sorted, axis) : []), [tabOnly, sorted, axis])

  const toggle = (key: string) =>
    setExpanded(prev => {
      if (singleOpen) return prev.has(key) ? new Set() : new Set([key])
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const sortOptions: { key: NamedBirdSort; label: string }[] = showSpecies
    ? [
        { key: 'name', label: 'Name (Individual)' },
        { key: 'alphabetical', label: 'Alphabetical' },
        { key: 'taxonomic', label: 'Taxonomic' },
        { key: 'lastSeen', label: 'Last Seen' },
      ]
    : [
        { key: 'name', label: 'Name (Individual)' },
        { key: 'lastSeen', label: 'Last Seen' },
      ]

  return (
    <div>
      {/* Sort control — wrap-aware so the wide "Name (Individual)" label never
          truncates and the group reflows to two rows on a phone. */}
      <div role="group" aria-label="Sort named birds" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: tabOnly ? 8 : 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', fontWeight: 600 }}>Sort</span>
        {/* Self-bordered pills with a gap (not a shared shell + borderLeft
            dividers): when the group wraps at large text scale, each pill keeps
            its own rounded border instead of leaving stray divider lines and a
            rounded shell that no longer encloses row 2. */}
        <div className="sr-wrap-flex" style={{ ['--sr-wrap-gap' as string]: '6px' }}>
          {sortOptions.map((o) => (
            <Button
              className="sr-touch-target"
              key={o.key}
              aria-pressed={sort === o.key}
              onClick={() => setSort(o.key)}
              style={{
                height: 30, padding: '0 13px',
                border: '1.5px solid var(--sr-accent-border)', borderRadius: 8,
                background: sort === o.key ? 'var(--sr-accent-bg)' : 'transparent',
                color: sort === o.key ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontWeight: sort === o.key ? 600 : 500,
                fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </Button>
          ))}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {birds.length} {birds.length === 1 ? 'named bird' : 'named birds'}
        </span>
      </div>

      {/* The CANONICAL range control, in the tab's own control strip beneath
          Sort. Scope is read from the company a control keeps, and Sort is
          already unambiguously tab-wide on this exact surface; the figure this
          switch governs is on every collapsed card at all times, so a control
          governing it has to be reachable without expanding a card. The two
          other instances (inside the open card, and above the strip below) read
          and write this same value. */}
      {tabOnly && (
        <div style={{ marginBottom: 14 }}>
          <NamedBirdRangeControl range={range} onChange={setRange} groupLabel={rangeGroupTab} />
        </div>
      )}

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(bird => (
          <NamedBirdRow
            key={bird.key}
            bird={bird}
            open={expanded.has(bird.key)}
            onToggle={() => toggle(bird.key)}
            showSpecies={showSpecies}
            showMap={!!singleOpen}
            renderSpecies={renderSpecies}
            isHotspot={isHotspot}
            media={mediaByBird?.get(bird.key) ?? []}
            hasML={!!hasML}
            embedAllowed={embedAllowed}
            timeline={
              sessionToday ? { range, onRangeChange: setRange, today: sessionToday } : undefined
            }
          />
        ))}
      </div>

      {tabOnly && (
        <NamedBirdMasterTimeline
          lanes={lanes}
          axis={axis}
          range={range}
          onRangeChange={setRange}
          showSpecies={showSpecies}
        />
      )}
    </div>
  )
}
