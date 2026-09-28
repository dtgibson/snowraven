// Per-sighting media matching for the Map Explorer's "my sightings" media filter.
//
// Media must be tied to the SPECIFIC observation (via the ML catalog numbers eBird
// records on each backup row), not to the species. Filtering by species would show
// every sighting of any bird you've ever photographed/recorded — the bug this fixes.

export type MediaFormat = 'Photo' | 'Audio' | 'Video'

export type MediaFilter = 'any' | 'photo' | 'audio' | 'video' | 'none'

/** The one acceptance rule for a mediaMap value. Shared by the presence join
 *  (observationMediaFormats) and the counting join (mediaFormatCounts) so the
 *  two cannot drift on what counts as a format. */
export function asMediaFormat(v: unknown): MediaFormat | null {
  return v === 'Photo' || v === 'Audio' || v === 'Video' ? v : null
}

/**
 * The set of media formats present on a single observation, resolved from its ML
 * catalog numbers via the export's catalogId → format map. Unknown/absent catalog
 * IDs contribute nothing, so an observation with no media yields an empty set.
 */
export function observationMediaFormats(
  catalogIds: readonly string[],
  mediaMap: Record<string, string>,
): Set<MediaFormat> {
  const set = new Set<MediaFormat>()
  for (const id of catalogIds) {
    const fmt = asMediaFormat(mediaMap[id])
    if (fmt) set.add(fmt)
  }
  return set
}

/** Per-format counts of a set of DISTINCT catalog ids (calendar-overlays). */
export interface MediaFormatCounts {
  /** Every id, whatever its format. */
  total: number
  photo: number
  audio: number
  video: number
  /** Ids the loaded map does not name, or names under an unrecognised format.
   *  Always 0 when mediaMap is null: "unknown" means the export was consulted
   *  and had no answer, which is a different fact from "no export". */
  unknown: number
}

/**
 * Count a set of DISTINCT catalog ids by format against the ML export's map.
 * With a null map this is O(1) and reports the plain total, since no format can
 * be known. With a map, `total === photo + audio + video + unknown`.
 *
 * The plain index `mediaMap[id]` is safe for the same reason it is safe in
 * observationMediaFormats: every id reaching here passed the eBird parser's
 * `^\d+$` filter, so no prototype key (`constructor`, `__proto__`) can ever be
 * looked up, whatever the ML side put in the map. The two joins are twins, so
 * neither adds an own-property check the other lacks.
 */
export function mediaFormatCounts(
  catalogIds: readonly string[],
  mediaMap: Record<string, string> | null,
): MediaFormatCounts {
  const out: MediaFormatCounts = { total: catalogIds.length, photo: 0, audio: 0, video: 0, unknown: 0 }
  if (mediaMap === null) return out
  for (const id of catalogIds) {
    const fmt = asMediaFormat(mediaMap[id])
    if (fmt === 'Photo') out.photo++
    else if (fmt === 'Audio') out.audio++
    else if (fmt === 'Video') out.video++
    else out.unknown++
  }
  return out
}

/** Whether an observation's media formats satisfy the chosen filter. */
export function matchesMediaFilter(formats: Set<MediaFormat>, filter: MediaFilter): boolean {
  switch (filter) {
    case 'photo': return formats.has('Photo')
    case 'audio': return formats.has('Audio')
    case 'video': return formats.has('Video')
    case 'none':  return formats.size === 0
    case 'any':
    default:      return true
  }
}
