// Small pieces the Hotspot Reports picker, overview and report share
// (design-spec "The kind tag", "Component Usage"): the kind tag, the meta line,
// a section card with its head, a distribution group head and group.
//
// No DOM id is minted from file content here; the meta line prints fields of a
// LocationRecord as React text, every one bounded at the index build (H2).

import type { ReactNode } from 'react'
import { MapPin, Star } from 'lucide-react'
import { DistRow } from '../WeatherDistRow'
import { fmtSharePct } from '../../lib/statsFormat'
import type { LocationRecord } from '../../lib/hotspotReports'
import type { LocationKind } from '../../lib/hotspotReportsKind'
import { KIND_WORDS, MOST_COMMON, TOO_FEW_TYPICAL, UNNAMED_LOCATION, displayName } from '../../lib/hotspotReportsCopy'

/** A glyph AND its word, or nothing at all: a location whose kind is not yet
 *  known gets no tag and nothing stands in for it (FR-21, decisions.md D-01). */
export function KindTag({ kind, eyebrow = false }: { kind: LocationKind; eyebrow?: boolean }) {
  if (kind === null) return null
  const Glyph = kind === 'hotspot' ? MapPin : Star
  return (
    <span className={eyebrow ? 'sr-hsr-kind sr-hsr-eyebrow' : 'sr-hsr-kind'}>
      <Glyph size={12} strokeWidth={2.2} className="sr-hsr-kind-glyph" aria-hidden="true" />
      {KIND_WORDS[kind]}
    </span>
  )
}

/** The meta line: items separated by an `aria-hidden` middle dot that travels
 *  with the item before it, so a wrap never starts a line with the dot. */
export function MetaLine({ items }: { items: readonly ReactNode[] }) {
  if (items.length === 0) return null
  return (
    <span className="sr-hsr-meta">
      {items.map((item, i) => (
        <span key={i}>
          {item}
          {i < items.length - 1 ? <span className="sr-hsr-dot" aria-hidden="true">{'\u00b7'}</span> : null}
        </span>
      ))}
    </span>
  )
}

/** The meta line a location shows: its kind where known, its place, the
 *  Location ID for a namesake (FR-21), then any `extra` items, in reading order. */
export function LocationMeta({ rec, kind, showId, extra }: {
  rec: LocationRecord
  kind: LocationKind
  showId: boolean
  extra?: ReactNode
}) {
  const items: ReactNode[] = []
  if (kind !== null) items.push(<KindTag kind={kind} />)
  if (rec.place !== '') items.push(rec.place)
  if (showId) items.push(<span className="sr-hsr-locid">{rec.locationId}</span>)
  if (extra !== undefined) items.push(extra)
  return <MetaLine items={items} />
}

/** A location's name as text: the placeholder in italics for an empty name. */
export function LocationName({ rec }: { rec: LocationRecord }) {
  if (rec.name === '') return <span className="sr-hsr-noname">{UNNAMED_LOCATION}</span>
  return <>{displayName(rec.name, rec.truncated)}</>
}

/** A headed report section (the Species Detail section head). The heading is
 *  the jump target, so it takes `tabIndex={-1}` and no ring. */
export function SectionCard({ id, glyph, title, children, flushBody = false }: {
  id: string
  glyph: ReactNode
  title: string
  children: ReactNode
  flushBody?: boolean
}) {
  return (
    <section className="sr-hsr-card" aria-labelledby={id}>
      <div className="sr-hsr-sechead">
        <div className="sr-hsr-sectile">{glyph}</div>
        <h4 id={id} tabIndex={-1}>{title}</h4>
      </div>
      {flushBody ? children : <div className="sr-hsr-secbody">{children}</div>}
    </section>
  )
}

/** A group head: the SubLabel and, at the row's end, its denominator. */
export function GroupHead({ title, den }: { title: string; den?: ReactNode }) {
  return (
    <div className="sr-hsr-grouphead">
      <p className="sr-hsr-sub">{title}</p>
      {den !== undefined ? <span className="sr-hsr-den">{den}</span> : null}
    </div>
  )
}

export interface GroupRow { readonly glyph?: ReactNode; readonly label: string; readonly n: number }

/**
 * One distribution group on this tab: the head, the optional "Most common"
 * line, and the shared distribution rows. `typical` is undefined for a group
 * that names no typical band, null for one whose denominator is under the floor.
 */
export function DistGroup({ title, den, rows, share, typical, className }: {
  title: string
  den: ReactNode
  rows: readonly GroupRow[]
  share: boolean
  typical?: number | null
  className?: string
}) {
  let max = 0
  let sum = 0
  for (const r of rows) { if (r.n > max) max = r.n; sum += r.n }
  return (
    <>
      <GroupHead title={title} den={den} />
      {typical === undefined ? null : typical === null
        ? <p className="sr-hsr-typical">{TOO_FEW_TYPICAL}</p>
        : <p className="sr-hsr-typical">{MOST_COMMON}<b>{rows[typical].label}</b></p>}
      <div className={className ? `sr-wx-rows ${className}` : 'sr-wx-rows'}>
        {rows.map((r, i) => (
          <DistRow
            key={i}
            glyph={r.glyph}
            label={r.label}
            n={r.n}
            max={max}
            share={share ? fmtSharePct(r.n, sum) : undefined}
            emphasis={typical !== undefined && typical !== null && i === typical}
          />
        ))}
      </div>
    </>
  )
}
