// The media presence cell (life-lists-tab FR-44), shared by Life Lists and the
// Family Tree tab (family-rollups-and-tree schema 9.3): three fixed slots in
// Photo, Audio, Video order, position carrying identity and ink carrying
// presence, with one accessible label naming the kinds present or "No media".
// Moved verbatim out of `LifeListsRows.tsx`; its markup is pinned by
// `familyTreeShared.golden.test.tsx`, captured before the move.

import { Camera, Mic, Video } from 'lucide-react'
import type { MediaPresence } from '../lib/lifeLists'
import { mediaLabel } from '../lib/lifeListsCopy'

export function MediaPresenceCell({ media }: { media: MediaPresence }) {
  const slot = (has: boolean) => `sr-lfl-media-glyph ${has ? 'is-has' : 'is-lacks'}`
  return (
    <span className="sr-lfl-media" role="img" aria-label={mediaLabel(media)}>
      <Camera size={12} strokeWidth={2.2} className={slot(media.photo)} aria-hidden="true" />
      <Mic size={12} strokeWidth={2.2} className={slot(media.audio)} aria-hidden="true" />
      <Video size={12} strokeWidth={2.2} className={slot(media.video)} aria-hidden="true" />
    </span>
  )
}
