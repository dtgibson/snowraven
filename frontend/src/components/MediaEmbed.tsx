// Shared resilient Macaulay Library inline-embed COMPONENTS. Extracted from the
// Named Birds media (v0.5.66) so the Species Detail "Recent Media" section reuses
// ONE implementation instead of a second copy. The frame keeps its iframe MOUNTED
// for its whole lifetime: a 20s give-up timer and the iframe's onError only OVERLAY
// a fallback; a late onLoad clears the latch so a slow-but-working embed swaps in.
// Offline handling is the caller's: key the frame on the online flag (from useOnline)
// so a fresh remount re-attempts on reconnect (event-driven, no setState-in-effect).
//
// Security: a catalog id is `^\d+$`-guarded and `encodeURIComponent`-wrapped before
// it can reach the iframe src or the link-out (the shared contract for ML embeds).
//
// The non-component constants (MEDIA_CATALOG_ID_RE, EMBED_GIVE_UP_MS,
// MEDIA_FORMAT_META) live in lib/mediaEmbed.ts so this file stays component-only.

import { useEffect, useState } from 'react'
import { CloudOff, ImageOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MediaType } from '../types'
import { mlAssetUrl } from '../lib/mlCatalog'
import { OutboundLink } from './OutboundLink'
import { MEDIA_CATALOG_ID_RE, EMBED_GIVE_UP_MS } from '../lib/mediaEmbed'

export const EMBEDDED_MEDIA_DISABLED_MESSAGE = 'Embedded media is disabled in Settings.'

// One shared, neutral replacement for an intentionally suppressed player. It is
// plain informational content (not an alert) and uses the player's existing frame.
export function EmbeddedMediaDisabled() {
  return (
    <div className="sr-media-disabled" role="status">
      <span className="sr-media-disabled__icon" aria-hidden>
        <ImageOff size={18} strokeWidth={2} />
      </span>
      <span>{EMBEDDED_MEDIA_DISABLED_MESSAGE}</span>
    </div>
  )
}

// Loading / lazy placeholder — same footprint as the player, a subtle surface sweep.
export function MediaShimmer({ Icon }: { Icon: LucideIcon }) {
  return (
    <div className="sr-media-shimmer" aria-hidden>
      <Icon size={20} strokeWidth={2} style={{ color: 'var(--sr-text-disabled)' }} />
    </div>
  )
}

// The offline / failed-load placeholder — never a broken frame. Always keeps a
// link-out to the asset on Macaulay Library (when the id is valid).
export function MediaFallback({ catalogId, format, compact, reason = 'offline' }: {
  catalogId: string
  format: MediaType
  compact: boolean
  /** Why the embed isn't showing — drives the placeholder message. */
  reason?: 'offline' | 'load-failed'
}) {
  const canLink = MEDIA_CATALOG_ID_RE.test(catalogId)
  const message = reason === 'load-failed' ? "Media couldn't load" : 'Media unavailable offline'
  return (
    <div style={{
      height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: compact ? 6 : 8,
      padding: '10px 12px', textAlign: 'center', background: 'var(--sr-surface-subtle)',
    }}>
      <CloudOff size={compact ? 16 : 20} strokeWidth={2} style={{ color: 'var(--sr-text-muted)' }} aria-hidden />
      {!compact && (
        <span style={{ fontSize: '0.72rem', color: 'var(--sr-text-muted)', lineHeight: 1.4 }}>
          {message}
        </span>
      )}
      {canLink && (
        <OutboundLink
          href={mlAssetUrl(catalogId)}
          aria-label={`View ${format} on Macaulay Library`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: '0.72rem', fontWeight: 600, color: 'var(--sr-accent)',
            textDecoration: 'none', border: '1.5px solid var(--sr-accent-border)',
            borderRadius: 7, padding: '5px 10px', background: 'var(--sr-accent-bg)',
          }}
        >
          View on Macaulay Library
        </OutboundLink>
      )}
    </div>
  )
}

// The live embed frame. Keeps the iframe MOUNTED for its whole lifetime — the give-up
// timeout and iframe onError NEVER unmount it, they only overlay a fallback. A late
// onLoad clears the latches and reveals the real player. Remount it (a key on the
// caller's online flag) to re-attempt after a reconnection — no reset effect needed.
export function MediaFrame({ catalogId, format, title, Icon, heightClass, embedAllowed, compact = format === 'Audio' }: {
  catalogId: string
  format: MediaType
  title: string
  Icon: LucideIcon
  heightClass: string
  /** Defense in depth: every frame callsite must prove the hydrated global
   * preference allows an iframe before this component can construct one. */
  embedAllowed: boolean
  /** Whether the give-up/failed overlay uses the compact fallback (icon + link, no
   *  message). Defaults to the audio compact preview; a full-height caller (Species
   *  Detail) passes false so the offline message shows. */
  compact?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [gaveUp, setGaveUp] = useState(false)

  // Give-up timer: if nothing loads within the deadline, SHOW the fallback overlay
  // (non-destructive). Cleared once loaded. A plain timer id in an effect, never in
  // render (no Date.now() in render).
  useEffect(() => {
    if (!embedAllowed || loaded) return
    const t = setTimeout(() => setGaveUp(true), EMBED_GIVE_UP_MS)
    return () => clearTimeout(t)
  }, [embedAllowed, loaded])

  // Overlay the fallback while giving-up/broken AND not yet loaded, so a late load
  // makes it disappear. The iframe underneath is always mounted and loading.
  const showFallbackOverlay = (failed || gaveUp) && !loaded

  if (!embedAllowed) return null

  return (
    <>
      {!loaded && !showFallbackOverlay && <MediaShimmer Icon={Icon} />}
      <iframe
        src={`https://macaulaylibrary.org/asset/${encodeURIComponent(catalogId)}/embed`}
        title={title}
        loading="lazy"
        allowFullScreen
        scrolling="no"
        className={`sr-media-iframe ${heightClass}`}
        // On a (possibly late) load, reveal the real embed AND clear both latches so
        // it swaps in over any give-up/error overlay — recovery in place.
        onLoad={() => { setLoaded(true); setFailed(false); setGaveUp(false) }}
        onError={() => setFailed(true)}
        style={loaded ? undefined : { visibility: 'hidden' }}
      />
      {showFallbackOverlay && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <MediaFallback catalogId={catalogId} format={format} compact={compact} reason="load-failed" />
        </div>
      )}
    </>
  )
}
