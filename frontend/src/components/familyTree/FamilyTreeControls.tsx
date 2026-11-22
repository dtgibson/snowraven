// The Family Tree filter strip (family-rollups-and-tree design-spec section 4;
// FR-28 to FR-31, FR-35): Region (the Life Lists picker, reused), Year (a
// native select of the years in the backup), Include Escapees (the shared
// ToggleSwitch) and Media (three tri-state pills, each cycling any, has,
// lacks). Every control renders through the native primitives so WebKit's
// default tab mode reaches it (tabOrderCoverage.test.ts); every select and
// input carries an explicit accessible name; every id is minted by `useId`,
// never from file content (FR-45). Without a readable ML export the pills stay
// focusable with `aria-disabled`, the reason wired through
// `aria-describedby`, and ignore activation (ui.md, the not-operable-but-
// readable rule).

import { useId } from 'react'
import { Camera, Check, ChevronDown, Mic, Video, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { ToggleSwitch } from '../ui/ToggleSwitch'
import { LifeListsRegionPicker } from '../lifeLists/LifeListsRegionPicker'
import type { RegionChoices, RegionRef } from '../../lib/lifeListsRegion'
import { SWITCH_LABELS } from '../../lib/lifeListsCopy'
import type { MediaConstraints } from '../../lib/familyTreeModel'
import {
  ALL_YEARS, KIND_COPY, KIND_KEYS, MEDIA_LABEL, ML_NONE_SENTENCE, ML_UNREADABLE_SENTENCE, YEAR_LABEL, pillTitle,
  type KindKey,
} from '../../lib/familyTreeCopy'

export type MlAvailability = 'ready' | 'none' | 'unreadable'

const GLYPHS: Record<KindKey, typeof Camera> = { photo: Camera, audio: Mic, video: Video }

export interface FamilyTreeControlsProps {
  regionChoices: RegionChoices
  /** The effective region, a choice's own object, or null for Everywhere. */
  region: RegionRef | null
  onSelectRegion: (region: RegionRef | null) => void
  years: readonly number[]
  year: number | null
  onSelectYear: (year: number | null) => void
  includeEscapees: boolean
  onToggleEscapees: () => void
  ml: MlAvailability
  media: MediaConstraints
  onCycleKind: (kind: KindKey) => void
}

export function FamilyTreeControls({
  regionChoices, region, onSelectRegion, years, year, onSelectYear, includeEscapees, onToggleEscapees, ml, media, onCycleKind,
}: FamilyTreeControlsProps) {
  const base = useId()
  const mediaLabelId = `${base}-media-label`
  const yearLabelId = `${base}-year-label`
  const noteId = `${base}-ml-note`
  const inert = ml !== 'ready'
  return (
    <div className="sr-ft-controls sr-ctl-row">
      <div className="sr-ft-ctl-row">
        <span className="sr-ft-region" data-set={region !== null ? '1' : undefined}>
          <LifeListsRegionPicker choices={regionChoices} selected={region} onSelect={onSelectRegion} />
        </span>
        <span className="sr-pill-sep sr-pill-sep--spaced" aria-hidden="true" />
        <span className="sr-ctl-label sr-ft-label" id={yearLabelId}>{YEAR_LABEL}</span>
        <span className="sr-ft-selwrap">
          <select
            className={`sr-ft-select sr-input-16${year !== null ? ' is-set' : ''}`}
            aria-labelledby={yearLabelId}
            value={year === null ? '' : String(year)}
            onChange={e => onSelectYear(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">{ALL_YEARS}</option>
            {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          <ChevronDown size={12} strokeWidth={2.4} className="sr-ft-selcaret" aria-hidden="true" />
        </span>
        <span className="sr-pill-sep sr-pill-sep--spaced" aria-hidden="true" />
        <ToggleSwitch label={SWITCH_LABELS.escapees} checked={includeEscapees} onChange={onToggleEscapees} />
        <span className="sr-pill-sep sr-pill-sep--spaced" aria-hidden="true" />
        <span className="sr-ft-group sr-ft-group--media">
          <span className="sr-ctl-label sr-ft-label" id={mediaLabelId}>{MEDIA_LABEL}</span>
          <span role="group" aria-labelledby={mediaLabelId} className="sr-ft-media-pills">
            {KIND_KEYS.map(k => {
              const state = inert ? 'any' : media[k]
              const Glyph = state === 'has' ? Check : state === 'lacks' ? X : GLYPHS[k]
              const text = state === 'has' ? KIND_COPY[k].has : state === 'lacks' ? KIND_COPY[k].lacks : KIND_COPY[k].label
              return (
                <Button
                  key={k}
                  type="button"
                  className="sr-pill sr-ft-pill sr-touch-target"
                  aria-pressed={state !== 'any'}
                  data-state={state === 'lacks' ? 'negative' : undefined}
                  aria-disabled={inert || undefined}
                  aria-describedby={inert ? noteId : undefined}
                  title={pillTitle(k)}
                  onClick={inert ? undefined : () => onCycleKind(k)}
                >
                  <Glyph size={state === 'any' ? 12 : 11} strokeWidth={state === 'any' ? 2.2 : 3} className="sr-ft-pill-glyph" aria-hidden="true" />
                  {text}
                </Button>
              )
            })}
          </span>
        </span>
      </div>
      {inert && (
        <p className="sr-ft-note" id={noteId}>{ml === 'none' ? ML_NONE_SENTENCE : ML_UNREADABLE_SENTENCE}</p>
      )}
    </div>
  )
}
