// Per-sighting media matching for the Map Explorer's "my sightings" media filter.
//
// Media must be tied to the SPECIFIC observation (via the ML catalog numbers eBird
// records on each backup row), not to the species. Filtering by species would show
// every sighting of any bird you've ever photographed/recorded — the bug this fixes.

export type MediaFormat = 'Photo' | 'Audio' | 'Video'

export type MediaFilter = 'any' | 'photo' | 'audio' | 'video' | 'none'

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
    const fmt = mediaMap[id]
    if (fmt === 'Photo' || fmt === 'Audio' || fmt === 'Video') set.add(fmt)
  }
  return set
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
