// Pure presence reducers for one side of a ChecklistComparison → the six badge
// flags rendered by <ChecklistBadges>. Media/breeding are OR-ed across that side's
// species; the weather/tide flags come from the decode-first comment detectors.
// No React, no network — unit-tested independent of the UI (NFR-07).

import type { ChecklistComparison, ChecklistRow } from './compareChecklists'
import { hasWeatherBlock, hasTideBlock } from './commentBlocks'

export interface BadgeFlags {
  photo: boolean
  audio: boolean
  video: boolean
  breeding: boolean
  weatherComment: boolean   // FR-05 weather-info badge
  tideComment: boolean      // FR-05 tide-info badge
}

/** OR media/breeding presence across one side's species + detect comment blocks. */
export function deriveBadges(comp: ChecklistComparison, side: 'a' | 'b'): BadgeFlags {
  // For side A scan both ∪ aOnly reading the A columns; for side B, both ∪ bOnly
  // reading the B columns. A null media/breeding on a row means that species
  // isn't on that side, so it contributes nothing.
  const rows: ChecklistRow[] = side === 'a'
    ? [...comp.both, ...comp.aOnly]
    : [...comp.both, ...comp.bOnly]

  let photo = false, audio = false, video = false, breeding = false
  for (const r of rows) {
    const media = side === 'a' ? r.mediaA : r.mediaB
    if (media) {
      if (media.photo > 0) photo = true
      if (media.audio > 0) audio = true
      if (media.video > 0) video = true
    }
    const br = side === 'a' ? r.breedingA : r.breedingB
    if (br) breeding = true
  }

  const comments = (side === 'a' ? comp.metaA : comp.metaB).comments
  return {
    photo, audio, video, breeding,
    weatherComment: hasWeatherBlock(comments),
    tideComment: hasTideBlock(comments),
  }
}
