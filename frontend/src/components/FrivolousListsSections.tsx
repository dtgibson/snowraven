// The Frivolous Lists section — three playful, self-completing collections at the
// bottom of the Statistics page (Avian American, California Dreamer, Rainbow
// Warrior). Pure presentation over computeFrivolousLists; species names render
// through BirdName, the Rainbow first-sighting dates through ChecklistLink. Kept
// out of BirdingStats.tsx to keep that file manageable (the MediaStatsSections
// pattern). No charts here, so no recharts test caveat applies.

import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { BirdName } from './BirdName'
import { ChecklistLink } from './ChecklistLink'
import { SubLabel, Divider } from './statsPrimitives'
import { formatDate } from '../lib/formatDate'
import { computeFrivolousLists } from '../lib/frivolousLists'
import type { NameListResult, RainbowEntry } from '../lib/frivolousLists'
import type { ObservationEntry } from '../types'

interface Props {
  observations: ObservationEntry[]
  codeFor: (name: string) => string | undefined
  hasEntryFor: (name: string) => boolean
  onOpenSpecies?: (commonName: string) => void
}

const HEAD_ROW: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }
const PROGRESS: CSSProperties = { marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-text-muted)', fontVariantNumeric: 'tabular-nums' }
const BADGE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px 3px 7px', borderRadius: 8,
  background: 'var(--sr-milestone-1-bg)', border: '1.5px solid var(--sr-milestone-1-border)',
  color: 'var(--sr-milestone-1-num)', fontSize: '0.6875rem', fontWeight: 700,
}
const NAME_GRID: CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '4px 18px',
}
const NAME_ROW: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', minHeight: 28 }
const CHECK_CIRCLE: CSSProperties = {
  width: 14, height: 14, borderRadius: '50%', background: 'var(--sr-milestone-1-check)', color: '#fff',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const CHECK_SPACER: CSSProperties = { width: 14, height: 14, flexShrink: 0 }
const RAINBOW_LIST: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }
const COLOR_NAME: CSSProperties = { width: 64, flexShrink: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--sr-text-muted)' }
const LOC: CSSProperties = { fontSize: '0.71875rem', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap', minWidth: 0, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }

function CompletionBadge() {
  return (
    <span style={BADGE}>
      <Check size={13} strokeWidth={3} style={{ color: 'var(--sr-milestone-1-check)' }} aria-hidden="true" />
      Complete!
    </span>
  )
}

function NameList({ title, list, codeFor, hasEntryFor, onOpenSpecies }: {
  title: string; list: NameListResult
} & Pick<Props, 'codeFor' | 'hasEntryFor' | 'onOpenSpecies'>) {
  return (
    <div>
      <div style={HEAD_ROW}>
        <SubLabel>{title}</SubLabel>
        <span style={PROGRESS} aria-label={`${list.recorded} of ${list.total} recorded`}>
          {list.recorded} / {list.total}
        </span>
        {list.complete && <CompletionBadge />}
      </div>
      <ul role="list" style={NAME_GRID}>
        {list.items.map(item => (
          <li key={item.commonName} style={NAME_ROW}>
            {item.recorded
              ? <span style={CHECK_CIRCLE} aria-hidden="true"><Check size={9} strokeWidth={3.5} /></span>
              : <span style={CHECK_SPACER} aria-hidden="true" />}
            <span className="sr-only">{item.recorded ? 'Recorded.' : 'Not yet recorded.'}</span>
            <BirdName commonName={item.commonName} taxonCode={codeFor(item.commonName)} hasEntry={hasEntryFor(item.commonName)} onOpenSpecies={onOpenSpecies} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RainbowList({ rows, complete, codeFor, hasEntryFor, onOpenSpecies }: {
  rows: RainbowEntry[]; complete: boolean
} & Pick<Props, 'codeFor' | 'hasEntryFor' | 'onOpenSpecies'>) {
  const filled = rows.reduce((acc, r) => acc + (r.bird ? 1 : 0), 0)
  return (
    <div>
      <div style={HEAD_ROW}>
        <SubLabel>Rainbow Warrior</SubLabel>
        <span style={PROGRESS} aria-label={`${filled} of ${rows.length} colors found`}>
          {filled} / {rows.length}
        </span>
        {complete && <CompletionBadge />}
      </div>
      <ul role="list" style={RAINBOW_LIST}>
        {rows.map(({ color, bird }) => (
          <li key={color} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 8,
            // Wrap on narrow phones: the flexShrink:0 date+location cluster can't
            // shrink, so without a wrap the row overflows ~290px usable width and
            // crushes the BirdName. flexWrap lets the cluster drop below the name.
            flexWrap: 'wrap',
            background: bird ? 'var(--sr-surface-subtle)' : 'transparent',
          }}>
            <span aria-hidden="true" style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: '1px solid var(--sr-border-medium)',
              background: `var(--sr-rainbow-${color})`, opacity: bird ? 1 : 0.3,
            }} />
            <span style={COLOR_NAME}>{color}</span>
            {bird ? (
              <>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <BirdName commonName={bird.commonName} taxonCode={codeFor(bird.commonName)} hasEntry={hasEntryFor(bird.commonName)} onOpenSpecies={onOpenSpecies} size="sm" />
                </span>
                {/* minWidth:0 (not flexShrink:0) so this date+location cluster
                    shrinks to the available width when it wraps below the name on
                    a narrow phone — the location ellipsizes instead of poking past
                    the card edge. The date link keeps its intrinsic width. */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
                  <ChecklistLink submissionId={bird.submissionId} label={formatDate(bird.date)} />
                  <span style={LOC} title={bird.location}>{bird.location}</span>
                </span>
              </>
            ) : (
              <span style={{ flex: 1, fontSize: '0.8125rem', fontStyle: 'italic', color: 'var(--sr-text-disabled)' }}>
                — no {color} bird yet
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FrivolousListsSections({ observations, codeFor, hasEntryFor, onOpenSpecies }: Props) {
  const data = useMemo(() => computeFrivolousLists(observations), [observations])
  return (
    <>
      <NameList title="Avian American" list={data.avianAmerican} codeFor={codeFor} hasEntryFor={hasEntryFor} onOpenSpecies={onOpenSpecies} />
      <Divider />
      <NameList title="California Dreamer" list={data.californiaDreamer} codeFor={codeFor} hasEntryFor={hasEntryFor} onOpenSpecies={onOpenSpecies} />
      <Divider />
      <RainbowList rows={data.rainbowWarrior.rows} complete={data.rainbowWarrior.complete} codeFor={codeFor} hasEntryFor={hasEntryFor} onOpenSpecies={onOpenSpecies} />
    </>
  )
}
