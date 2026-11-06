// The Life Lists control strip (life-lists-tab FR-21, FR-27, FR-35; design-spec 3).
//
// Two ToggleSwitches and three media pills, every control through the native
// primitives so WebKit's default tab mode reaches them (tabOrderCoverage.test.ts).
// Without a readable ML export the pills stay focusable with `aria-disabled` and
// the FR-27 sentence wired through `aria-describedby`, and ignore activation by
// click and by keyboard (ui.md, the not-operable-but-readable rule). Every id is
// minted by `useId`, never from file content (FR-38).

import { useId } from 'react'
import { Camera, Mic, Video } from 'lucide-react'
import { Button } from '../ui/Button'
import { ToggleSwitch } from '../ui/ToggleSwitch'
import { MEDIA_FORMATS, type MediaFormat } from '../../lib/lifeLists'
import {
  FORMAT_COPY, MEDIA_GROUP_LABEL, ML_NONE_SENTENCE, ML_UNREADABLE_SENTENCE, SWITCH_LABELS,
} from '../../lib/lifeListsCopy'

export type MlAvailability = 'ready' | 'none' | 'unreadable'

const FORMAT_GLYPHS: Record<MediaFormat, typeof Camera> = { Photo: Camera, Audio: Mic, Video }

export interface LifeListsControlsProps {
  includeEscapees: boolean
  includeExotics: boolean
  formats: ReadonlySet<MediaFormat>
  ml: MlAvailability
  onToggleEscapees: () => void
  onToggleExotics: () => void
  onToggleFormat: (format: MediaFormat) => void
}

export function LifeListsControls({
  includeEscapees, includeExotics, formats, ml,
  onToggleEscapees, onToggleExotics, onToggleFormat,
}: LifeListsControlsProps) {
  const base = useId()
  const labelId = `${base}-media-label`
  const noteId = `${base}-ml-note`
  const inert = ml !== 'ready'
  return (
    <div className="sr-lfl-controls sr-ctl-row">
      <div className="sr-lfl-ctl-row">
        <ToggleSwitch label={SWITCH_LABELS.escapees} checked={includeEscapees} onChange={onToggleEscapees} />
        <ToggleSwitch label={SWITCH_LABELS.exotics} checked={includeExotics} onChange={onToggleExotics} />
        <span className="sr-pill-sep sr-pill-sep--spaced" aria-hidden="true" />
        <span className="sr-ctl-label sr-lfl-label" id={labelId}>{MEDIA_GROUP_LABEL}</span>
        <span role="group" aria-labelledby={labelId} className="sr-lfl-media-group">
          {MEDIA_FORMATS.map(f => {
            const Glyph = FORMAT_GLYPHS[f]
            return (
              <Button
                key={f}
                type="button"
                className="sr-pill sr-lfl-pill sr-touch-target"
                aria-pressed={!inert && formats.has(f)}
                aria-disabled={inert || undefined}
                aria-describedby={inert ? noteId : undefined}
                onClick={inert ? undefined : () => onToggleFormat(f)}
              >
                <Glyph size={12} strokeWidth={2.2} className="sr-lfl-glyph" aria-hidden="true" />
                {FORMAT_COPY[f].label}
              </Button>
            )
          })}
        </span>
      </div>
      {inert && (
        <p className="sr-lfl-ml-note" id={noteId}>
          {ml === 'none' ? ML_NONE_SENTENCE : ML_UNREADABLE_SENTENCE}
        </p>
      )}
    </div>
  )
}
