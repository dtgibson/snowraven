// Pure helpers for the Media Comments section on the Multimedia tab. Only the
// comment on the MEDIA ITSELF counts: the asset Caption and Media notes. The
// export's Observation Details is the eBird observation comment, which the ML
// export copies onto every media asset from that observation — so it repeats
// across items and is intentionally excluded here. No React, no I/O.

import type { MLExportRow } from './parseMLExport'

export type MediaCommentField = 'mediaNotes' | 'caption'

// Priority order for which comment to surface when a row has both, and the short
// label shown next to it.
const FIELD_ORDER: MediaCommentField[] = ['mediaNotes', 'caption']

export const MEDIA_COMMENT_LABEL: Record<MediaCommentField, string> = {
  mediaNotes: 'Media note',
  caption: 'Caption',
}

/** True if the row carries a per-asset comment (Caption or Media notes). */
export function hasMediaComment(row: MLExportRow): boolean {
  return !!(row.mediaNotes.trim() || row.caption.trim())
}

/** The comment to display for a row: the highest-priority field that matches
 *  `query` (when one is given), else the highest-priority non-empty field. Null
 *  when the row has no comment at all. */
export function pickComment(row: MLExportRow, query?: string): { field: MediaCommentField; text: string } | null {
  const q = query?.trim().toLowerCase() ?? ''
  if (q) {
    for (const field of FIELD_ORDER) {
      const text = row[field]
      if (text.trim() && text.toLowerCase().includes(q)) return { field, text }
    }
  }
  for (const field of FIELD_ORDER) {
    const text = row[field]
    if (text.trim()) return { field, text }
  }
  return null
}

/** Rows with a per-asset comment, filtered by a case-insensitive substring across
 *  both comment fields (Caption and Media notes), sorted by date (catalog id
 *  breaks ties for stable ordering). */
export function filterAndSortMediaComments(
  rows: MLExportRow[],
  query: string,
  sort: 'newest' | 'oldest',
): MLExportRow[] {
  const q = query.trim().toLowerCase()
  const matched = rows.filter(r => {
    if (!hasMediaComment(r)) return false
    if (!q) return true
    return (
      r.mediaNotes.toLowerCase().includes(q) ||
      r.caption.toLowerCase().includes(q)
    )
  })
  const dir = sort === 'newest' ? -1 : 1
  return matched.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return dir * byDate
    return dir * a.catalogId.localeCompare(b.catalogId)
  })
}
