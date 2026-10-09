// Non-component shared constants for the resilient Macaulay Library media embeds
// (the frame/fallback/shimmer COMPONENTS live in components/MediaEmbed.tsx). These
// are kept in a plain module so the component file stays component-only and passes
// react-refresh/only-export-components.

import type { LucideIcon } from 'lucide-react'
import { Image as ImageIcon, Mic, Video } from 'lucide-react'
import type { MediaType } from '../types'

// Catalog ids from a parser are already digits-only, but guard again before a value
// becomes an iframe src or a link — defense in depth for the security contract.
export const MEDIA_CATALOG_ID_RE = /^\d+$/

// A media embed can legitimately take a while on a slow-but-working link, so the
// give-up deadline is generous — it catches an embed that will NEVER load (a truly
// broken asset, a blocked host), not a slow one. When it fires it only SHOWS an
// overlay; the iframe is never torn down, so a late load still wins.
export const EMBED_GIVE_UP_MS = 20000

// Per-format icon + iframe height class. All formats share ONE embed URL; only the
// icon and player height vary.
export const MEDIA_FORMAT_META: Record<MediaType, { icon: LucideIcon; heightClass: string }> = {
  Photo: { icon: ImageIcon, heightClass: 'sr-media-iframe--photo' },
  Video: { icon: Video, heightClass: 'sr-media-iframe--video' },
  Audio: { icon: Mic, heightClass: 'sr-media-iframe--audio' },
}

/** The fixed display order of the three ML formats. */
export const MEDIA_FORMAT_ORDER: readonly MediaType[] = ['Photo', 'Audio', 'Video']

export interface MediaItemLinkGroup {
  format: MediaType
  /** This format's linkable items, in input order (the gallery's newest-first). */
  items: { catalogId: string; date: string }[]
}

/** The named-bird per-item list (ml-media-links): one group per format present,
 *  in MEDIA_FORMAT_ORDER, holding only items whose catalogId passes
 *  MEDIA_CATALOG_ID_RE (the tile's own gate before it draws its Macaulay Library
 *  link). An item that fails it gets no entry, so it neither takes a number nor
 *  counts toward its group's total. Empty groups are omitted; returns [] when no
 *  item is linkable. One pass over `items`, keeping their order, with one
 *  anchored digits-only test per item. The format lookup is a Map over the three
 *  known formats, so an unexpected value is skipped rather than reaching an
 *  object's prototype. */
export function mediaItemLinkGroups(
  items: Iterable<{ catalogId: string; format: MediaType; date: string }>,
): MediaItemLinkGroup[] {
  const buckets = new Map<MediaType, MediaItemLinkGroup['items']>(MEDIA_FORMAT_ORDER.map(f => [f, []]))
  for (const item of items) {
    if (!MEDIA_CATALOG_ID_RE.test(item.catalogId)) continue
    buckets.get(item.format)?.push({ catalogId: item.catalogId, date: item.date })
  }
  const groups: MediaItemLinkGroup[] = []
  for (const format of MEDIA_FORMAT_ORDER) {
    const bucket = buckets.get(format)!
    if (bucket.length > 0) groups.push({ format, items: bucket })
  }
  return groups
}
