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
