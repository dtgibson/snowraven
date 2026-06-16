// The richer Statistics → Media card sections, driven by computeMediaStats.
// Rendered inside BirdingStats' existing <SectionCard title="Media">, between the
// media-over-time chart and the Top-10 rankings. Kept here (not inline in
// BirdingStats) to keep that file manageable. Species names render through the
// `renderName` closure the parent supplies (so BirdName gets the right taxon code
// + hasEntry without threading those helpers through props).

import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { StatCell, BarRow, SubLabel, Divider } from './statsPrimitives'
import { ChecklistLink } from './ChecklistLink'
import { fmt, formatSpanLength, mlBehaviorCatalogUrl } from '../lib/statsFormat'
import { formatDate, formatDateRange } from '../lib/formatDate'
import { speciesWithYoung, sortSpeciesAgeCoverage, behaviorTagSlug, BREEDING_BEHAVIOR_TIER } from '../lib/mediaStats'
import type { MediaStats, AgeClass, Sex, AgeSort } from '../lib/mediaStats'

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px 12px' } as const
// At a glance only: a wider column floor so the date-range sub-lines
// ("Jun 12, 2024 – Jun 3, 2026") never wrap to a second line, which would
// reintroduce the uneven tile heights this grid is built to prevent.
const GLANCE_GRID = { ...GRID, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' } as const

const AGE_COLOR: Record<AgeClass, string> = {
  Adult: 'var(--sr-age-adult)', Immature: 'var(--sr-age-immature)',
  Juvenile: 'var(--sr-age-juvenile)', Unknown: 'var(--sr-age-unknown)',
}
const SEX_COLOR: Record<Sex, string> = {
  Male: 'var(--sr-sex-male)', Female: 'var(--sr-sex-female)', Unknown: 'var(--sr-sex-unknown)',
}

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : '0%'
}

function hourLabel(h: number): string {
  const ampm = h < 12 ? 'a' : 'p'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${ampm}`
}

// A labelled donut with a centered caption. `data` slices carry their own color.
function Donut({ title, data, centerValue, centerLabel }: {
  title: string
  data: { label: string; value: number; color: string }[]
  centerValue: string
  centerLabel: string
}) {
  const total = data.reduce((a, b) => a + b.value, 0)
  const slices = data.filter(d => d.value > 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <SubLabel>{title}</SubLabel>
      <div style={{ position: 'relative', width: 132, height: 132 }} role="img" aria-label={`${title}: ${slices.map(d => `${d.label} ${fmt(d.value)} (${pct(d.value, total)})`).join(', ')}`}>
        <PieChart width={132} height={132}>
          <Pie data={slices} dataKey="value" cx={66} cy={66} innerRadius={40} outerRadius={62} strokeWidth={0} startAngle={90} endAngle={-270}>
            {slices.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 8px', pointerEvents: 'none' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sr-text)', lineHeight: 1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{centerValue}</span>
          <span style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginTop: 2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{centerLabel}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', justifyContent: 'center', maxWidth: 200 }}>
        {slices.map(d => (
          <span key={d.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            {d.label} {fmt(d.value)} ({pct(d.value, total)})
          </span>
        ))}
      </div>
    </div>
  )
}

function Dot({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: on ? color : 'transparent',
        border: on ? 'none' : '1.5px solid var(--sr-border)',
      }}
    />
  )
}

export function MediaStatsSections({ stats, renderName, taxonOrderFor, userId }: {
  stats: MediaStats
  renderName: (name: string) => React.ReactNode
  /** Maps a species name to its eBird taxonomic order (for the age-coverage sort). */
  taxonOrderFor?: (name: string) => number
  /** The user's Macaulay Library id (parsed from the ML export filename). Each
      behavior count deep-links to that behavior filtered to the user's media; when
      absent, behavior counts stay plain text (a behavior link with no user is a
      meaningless global view). */
  userId?: string | null
}) {
  const [ageSort, setAgeSort] = useState<AgeSort>('name')
  const [showAllAges, setShowAllAges] = useState(false)
  // Age coverage: species with a young (immature/juvenile) bird documented, sorted.
  const youngSpecies = useMemo(() => speciesWithYoung(stats.speciesDemographics), [stats.speciesDemographics])
  const sortedYoung = useMemo(
    () => sortSpeciesAgeCoverage(youngSpecies, ageSort, taxonOrderFor ?? (() => Infinity)),
    [youngSpecies, ageSort, taxonOrderFor],
  )

  if (stats.total === 0) return null
  const s = stats
  // Behaviors split: when we can link to the user's media (userId present), breeding
  // behaviors are pulled into their own linked list below, so drop them from the top
  // "Behaviors documented" list rather than list the same behavior twice. With no
  // userId there is no breeding list, so they stay in the documented list (unlinked).
  const breedingBehaviors = s.behaviorCounts.filter(b => BREEDING_BEHAVIOR_TIER[b.label])
  const showBreedingLinks = !!userId && breedingBehaviors.length > 0
  const topBehaviors = (showBreedingLinks
    ? s.behaviorCounts.filter(b => !BREEDING_BEHAVIOR_TIER[b.label])
    : s.behaviorCounts).slice(0, 10)
  // Per-individual age/sex totals so the donut center % shares the ring's basis.
  const ageTotal = s.ageMix.reduce((a, b) => a + b.value, 0)
  const agedInd = s.ageMix.reduce((a, b) => a + (b.label === 'Unknown' ? 0 : b.value), 0)
  const sexTotal = s.sexMix.reduce((a, b) => a + b.value, 0)
  const sexedInd = s.sexMix.reduce((a, b) => a + (b.label === 'Unknown' ? 0 : b.value), 0)
  return (
    <>
      <Divider />

      {/* At a glance — every fact is a tile (no floating caption: a bare date
          range below the grid reads as orphaned tile content). Each tile
          reserves the sub-line slot (reserveSub) so the auto-fit grid stays
          equal-height at any width (the 0.5.24 misalignment can't return). */}
      <SubLabel>At a glance</SubLabel>
      <div style={GLANCE_GRID}>
        <StatCell label="Total media" value={s.total} large={false} reserveSub />
        <StatCell label="Species documented" value={s.distinctSpecies} large={false} reserveSub />
        <StatCell label="Photos" value={s.photo} large={false} reserveSub />
        <StatCell label="Audio" value={s.audio} large={false} reserveSub />
        <StatCell label="Video" value={s.video} large={false} reserveSub />
        {s.busiestDay && (() => {
          const dayLabel = formatDate(s.busiestDay.date)
          return (
            <StatCell
              label="Busiest day"
              value={s.busiestDay.count}
              sub={s.busiestDay.checklistId && dayLabel ? (
                <ChecklistLink
                  submissionId={s.busiestDay.checklistId}
                  label={dayLabel}
                  title={s.busiestDay.checklistCount > 1
                    ? `Opens the checklist with the most media (1 of ${fmt(s.busiestDay.checklistCount)} that day)`
                    : "Open this day's checklist on eBird"}
                />
              ) : dayLabel || undefined}
              large={false}
              reserveSub
            />
          )
        })()}
        {s.longestStreak && s.longestStreak.days > 1 && (
          <StatCell
            label="Longest streak"
            value={`${fmt(s.longestStreak.days)} days`}
            sub={formatDateRange(s.longestStreak.start, s.longestStreak.end) || undefined}
            large={false}
            reserveSub
          />
        )}
        {s.firstDate && s.lastDate && (
          <StatCell
            label="Archive span"
            value={formatSpanLength(s.spanDays)}
            sub={formatDateRange(s.firstDate, s.lastDate) || undefined}
            large={false}
            reserveSub
          />
        )}
      </div>

      {/* Documentation coverage */}
      {s.coverage && (
        <>
          <Divider />
          <SubLabel>Documentation coverage</SubLabel>
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text)', margin: '0 0 12px' }}>
            <strong>{fmt(s.coverage.documented)}</strong> of {fmt(s.coverage.lifeListTotal)} life-list species documented with media
            {' '}<span style={{ color: 'var(--sr-text-muted)' }}>({pct(s.coverage.documented, s.coverage.lifeListTotal)})</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <BarRow label="Photo" value={s.coverage.withPhoto} max={s.coverage.lifeListTotal} pctOf={s.coverage.lifeListTotal} color="var(--sr-graph-photo)" labelWidth={48} />
            <BarRow label="Audio" value={s.coverage.withAudio} max={s.coverage.lifeListTotal} pctOf={s.coverage.lifeListTotal} color="var(--sr-graph-audio)" labelWidth={48} />
            <BarRow label="Video" value={s.coverage.withVideo} max={s.coverage.lifeListTotal} pctOf={s.coverage.lifeListTotal} color="var(--sr-graph-video)" labelWidth={48} />
          </div>
        </>
      )}

      {/* Photos tagged with age or gender */}
      {ageTotal > 0 && (
        <>
          <Divider />
          <SubLabel>Photos Tagged With Age or Gender</SubLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>
            <Donut
              title="Age"
              data={s.ageMix.map(b => ({ label: b.label, value: b.value, color: AGE_COLOR[b.label] }))}
              centerValue={pct(agedInd, ageTotal)}
              centerLabel="tagged"
            />
            <Donut
              title="Gender"
              data={s.sexMix.map(b => ({ label: b.label, value: b.value, color: SEX_COLOR[b.label] }))}
              centerValue={pct(sexedInd, sexTotal)}
              centerLabel="tagged"
            />
          </div>
          <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'center', margin: '10px 0 0' }}>
            Counted per individual: age tagged for {fmt(agedInd)} and gender for {fmt(sexedInd)} of {fmt(ageTotal)} documented {ageTotal === 1 ? 'individual' : 'individuals'}.
          </p>
        </>
      )}

      {/* Age coverage by species — species you've documented as a juvenile or
          immature; top 10 + expand; sortable by name or taxonomic order. The
          adults-only note renders even when no young birds are documented yet
          (that's the case it's most informative for), so the section opens
          whenever there's either a young-species list or an adults-only note. */}
      {(youngSpecies.length > 0 || s.onlyAdults.length > 0) && (
        <>
          <Divider />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <SubLabel>Age coverage by species</SubLabel>
            {youngSpecies.length > 0 && (
              <div role="group" aria-label="Sort age coverage" style={{ marginLeft: 'auto', display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden' }}>
                {([['name', 'A–Z'], ['taxonomic', 'Taxonomic']] as const).map(([key, label], i) => (
                  <button tabIndex={0}
                    key={key}
                    aria-pressed={ageSort === key}
                    onClick={() => setAgeSort(key)}
                    style={{
                      height: 26, padding: '0 10px', border: 'none',
                      borderLeft: i > 0 ? '1.5px solid var(--sr-accent-border)' : 'none',
                      background: ageSort === key ? 'var(--sr-accent-bg)' : 'transparent',
                      color: ageSort === key ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                      fontSize: '0.6875rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {youngSpecies.length > 0 && (
            <>
              <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '0 0 8px' }}>
                Species you've documented as a juvenile or immature — a filled dot marks each age class you've captured.
              </p>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginBottom: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot on color={AGE_COLOR.Adult} /> Adult</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot on color={AGE_COLOR.Immature} /> Immature</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot on color={AGE_COLOR.Juvenile} /> Juvenile</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(showAllAges ? sortedYoung : sortedYoung.slice(0, 10)).map((sp, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{renderName(sp.name)}</span>
                    <span style={{ display: 'inline-flex', gap: 5, flexShrink: 0 }}>
                      <Dot on={sp.adult} color={AGE_COLOR.Adult} />
                      <Dot on={sp.immature} color={AGE_COLOR.Immature} />
                      <Dot on={sp.juvenile} color={AGE_COLOR.Juvenile} />
                    </span>
                  </div>
                ))}
              </div>
              {sortedYoung.length > 10 && (
                <button tabIndex={0}
                  onClick={() => setShowAllAges(v => !v)}
                  style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-accent)', fontFamily: 'inherit', padding: 0 }}
                >
                  {showAllAges ? 'Show fewer' : `Show all ${fmt(sortedYoung.length)}`}
                </button>
              )}
            </>
          )}
          {s.onlyAdults.length > 0 && (
            <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '10px 0 0' }}>
              {fmt(s.onlyAdults.length)} {s.onlyAdults.length === 1 ? 'species is' : 'species are'} documented only as adults so far.
            </p>
          )}
        </>
      )}

      {/* Behaviors */}
      {s.behaviorCounts.length > 0 && (
        <>
          <Divider />
          <SubLabel>Behaviors documented</SubLabel>
          <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '0 0 10px' }}>
            {fmt(s.distinctBehaviors)} distinct {s.distinctBehaviors === 1 ? 'behavior' : 'behaviors'} captured.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topBehaviors.map(b => {
              const slug = behaviorTagSlug(b.label)
              const href = slug && userId ? mlBehaviorCatalogUrl(slug, userId) : undefined
              return (
                <BarRow key={b.label} label={b.label} value={b.value} max={topBehaviors[0]?.value ?? 1} labelWidth={150}
                  href={href}
                  linkLabel={href ? `${fmt(b.value)} — Open your ${b.label} media in the Macaulay Library` : undefined} />
              )
            })}
          </div>
          {(s.breeding.confirmed.length > 0 || s.breeding.probable.length > 0 || s.breeding.possible.length > 0) && (
            <>
              <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '14px 0 8px' }}>Species with media showing breeding behavior:</p>
              <div style={GRID}>
                <StatCell label="Confirmed" value={s.breeding.confirmed.length} sub="nest / young / food" large={false} />
                <StatCell label="Probable" value={s.breeding.probable.length} sub="courtship, display" large={false} />
                <StatCell label="Possible" value={s.breeding.possible.length} sub="singing in habitat" large={false} />
              </div>
              {/* Each breeding behavior the user has, linked to its own Macaulay
                  filter — breeding behaviors are often rarer than the top-10 cut, so
                  this surfaces them individually (the tiles above count species). */}
              {showBreedingLinks && (
                <>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '12px 0 6px' }}>Your media by breeding behavior:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {breedingBehaviors.map(b => {
                      const slug = behaviorTagSlug(b.label)
                      const href = slug && userId ? mlBehaviorCatalogUrl(slug, userId) : undefined
                      return (
                        <BarRow key={b.label} label={b.label} value={b.value} max={breedingBehaviors[0]?.value ?? 1} labelWidth={150}
                          href={href}
                          linkLabel={href ? `${fmt(b.value)} — Open your ${b.label} media in the Macaulay Library` : undefined} />
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Time of day */}
      {s.withTime > 0 && (
        <>
          <Divider />
          <SubLabel>When you capture media</SubLabel>
          <div style={{ height: 180 }} role="img" aria-label="Bar chart of media captures by hour of day, split by photo, audio, and video">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.timeOfDay} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <XAxis dataKey="hour" tick={{ fontSize: '0.5625rem', fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} interval={2} tickFormatter={h => hourLabel(Number(h))} />
                <YAxis tick={{ fontSize: '0.5625rem', fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  trigger="click"
                  wrapperStyle={{ pointerEvents: 'auto' }}
                  contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: '0.75rem' }}
                  labelFormatter={h => hourLabel(Number(h))}
                />
                <Bar dataKey="photo" name="Photo" stackId="t" fill="var(--sr-graph-photo)" />
                <Bar dataKey="audio" name="Audio" stackId="t" fill="var(--sr-graph-audio)" />
                <Bar dataKey="video" name="Video" stackId="t" fill="var(--sr-graph-video)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Community ratings section removed for now (v0.5.22); computeMediaStats
          still computes `ratings` so it can be re-added without parser work. */}
    </>
  )
}
