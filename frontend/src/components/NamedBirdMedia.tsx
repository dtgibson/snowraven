// The per-individual media section on the Named Birds tab: below a named bird's
// sightings map, its own Macaulay Library media (photo/audio/video) as inline
// embeds, each labeled with its capture date + checklist link. Rendered by
// NamedBirdRow, only on the Named Birds tab (Species Detail's reuse stays
// media-less). See design-spec.md.
//
// Loading discipline (FR-11/12/13, NFR-01): embeds mount only when the row is open
// (the parent unmounts this whole section when collapsed → releases every iframe)
// AND the item is in view (IntersectionObserver), on top of an initial-6 cap with a
// keyboard-operable "Show more". Concurrent live players stay bounded.
//
// Degradation (FR-14/15): offline or failed-load → a placeholder that keeps the
// date + ChecklistLink and adds an OutboundLink to the single-asset ML URL — never
// a broken frame. The date + checklist are local, so they always show. The resilient
// frame/fallback/shimmer primitives are shared with Species Detail (see MediaEmbed).

import { useEffect, useRef, useState } from 'react'
import { Play, ChevronDown } from 'lucide-react'
import { formatDate } from '../lib/formatDate'
import { useOnline } from '../lib/useOnline'
import { ChecklistLink } from './ChecklistLink'
import { MediaFrame, MediaFallback, MediaShimmer } from './MediaEmbed'
import { MEDIA_FORMAT_META, MEDIA_CATALOG_ID_RE } from '../lib/mediaEmbed'
import type { NamedBirdAsset } from '../lib/namedBirdMedia'

interface NamedBirdMediaProps {
  birdName: string
  assets: NamedBirdAsset[]
  /** Parent's expanded state — gates all embed mounting (FR-11). */
  open: boolean
  /** True when an ML export is loaded (so an empty bird shows the empty state).
   *  False → render nothing (no ML at all; FR-17). */
  hasML: boolean
  /** Bounded initial batch of live embeds; default 6 (design default). */
  initialCount?: number
  /** How many more each "Show more" reveals; default = initialCount. */
  batchSize?: number
}

export function NamedBirdMedia({
  birdName,
  assets,
  open,
  hasML,
  initialCount = 6,
  batchSize = initialCount,
}: NamedBirdMediaProps) {
  // revealCount resets to initialCount on each false→true open transition for
  // free: the parent (NamedBirdRow) renders this whole section only inside its
  // `{open && (…)}` block, so collapsing a row UNMOUNTS NamedBirdMedia and
  // re-expanding REMOUNTS it fresh — revealCount is re-initialized to initialCount,
  // players never accumulate across expansions (design + FR-13), with no reset
  // effect (which would cascade renders / trip react-hooks/set-state-in-effect).
  const [revealCount, setRevealCount] = useState(initialCount)
  const gridRef = useRef<HTMLDivElement | null>(null)
  // When a "Show more" click EXHAUSTS the list, the button unmounts and focus would
  // fall to <body> (WCAG 2.4.3). We stash the index of the first newly-revealed
  // tile and, after the commit, move focus there so keyboard focus is never lost.
  const pendingFocusIndex = useRef<number | null>(null)

  useEffect(() => {
    const idx = pendingFocusIndex.current
    if (idx == null) return
    pendingFocusIndex.current = null
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-media-index="${idx}"]`)
    el?.focus()
  })

  // No ML loaded at all → the section is absent entirely (FR-17). Nothing renders.
  if (!hasML) return null

  const total = assets.length
  const shown = Math.min(revealCount, total)
  const visible = assets.slice(0, shown)
  const remaining = total - shown

  // Build the visible label ONCE and make the accessible name a SUPERSTRING of it,
  // so Voice Control can activate the button by its on-screen text (WCAG 2.5.3
  // Label in Name — the visible "(of {total})" must appear in the accessible name).
  const revealN = Math.min(batchSize, remaining)
  const showMoreLabel = `Show ${revealN} more (of ${total})`

  const handleShowMore = () => {
    // If this reveal exhausts the list, the button will unmount — pre-arm focus to
    // move to the first newly-revealed tile after the commit.
    if (revealN >= remaining) pendingFocusIndex.current = shown
    setRevealCount(c => c + batchSize)
  }

  return (
    <div style={{ padding: '12px 14px 14px', borderTop: '1px solid var(--sr-border-subtle)' }}>
      {/* Header — mirrors the map block's micro-label voice ("Where {name} has been
          seen"), plus a quiet right-aligned count when more than shown. */}
      <div className="sr-action-row" style={{ marginBottom: 8 }}>
        <div
          className="sr-min0"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: 'var(--sr-text-muted)',
          }}
        >
          <Play size={12} strokeWidth={2.2} aria-hidden />
          Media of {birdName}
        </div>
        {remaining > 0 && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-gray)', whiteSpace: 'nowrap' }}>
            Showing {shown} of {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        // Empty state (FR-16): ML loaded but this bird has no name-tagged assets.
        <p style={{ margin: 0, fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--sr-text-muted)' }}>
          No media matched to this bird.
        </p>
      ) : (
        <>
          <div className="sr-media-grid" ref={gridRef}>
            {visible.map((asset, i) => (
              <NamedBirdMediaItem key={asset.catalogId} asset={asset} birdName={birdName} open={open} index={i} />
            ))}
          </div>

          {remaining > 0 && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="sr-touch-target"
                onClick={handleShowMore}
                // Accessible name = the visible label + a media-context suffix
                // (superstring), so it leads with the exact on-screen text.
                aria-label={`${showMoreLabel}: media of ${birdName}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 32, padding: '0 14px', borderRadius: 8,
                  border: '1.5px solid var(--sr-border-medium)', background: 'transparent',
                  color: 'var(--sr-accent)', fontSize: '0.75rem', fontWeight: 600,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <ChevronDown size={13} strokeWidth={2.4} aria-hidden />
                {showMoreLabel}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── One media item ──────────────────────────────────────────────────────────

function NamedBirdMediaItem({ asset, birdName, open, index }: {
  asset: NamedBirdAsset
  birdName: string
  open: boolean
  /** Position in the visible grid — used as a stable focus target when a "Show
   *  more" reveal exhausts the list and its button unmounts (WCAG 2.4.3). */
  index: number
}) {
  const online = useOnline()
  const [inView, setInView] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const { icon: Icon, heightClass } = MEDIA_FORMAT_META[asset.format]
  const validId = MEDIA_CATALOG_ID_RE.test(asset.catalogId)
  const dateLabel = formatDate(asset.date)
  const title = `${asset.format} of ${birdName}${dateLabel ? ` (${dateLabel})` : ''}`

  // Lazy-mount: reveal the iframe only after the item scrolls into view. Combined
  // with the open-gate and the reveal cap, this bounds live players even within a
  // revealed batch (FR-12, NFR-01).
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      // Environments without IntersectionObserver (some test/jsdom setups) fall
      // back to mounting when open, so behavior degrades safely rather than never
      // showing media.
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) setInView(true) },
      { rootMargin: '150px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const wantEmbed = open && inView && online && validId

  return (
    <div className="sr-media-item" data-media-index={index} tabIndex={-1} style={{ outline: 'none' }}>
      <div ref={wrapRef} className={`sr-media-frame ${heightClass}`}>
        {!validId || !online ? (
          // No embeddable id, or offline → the fallback (never a broken frame).
          // Offline is keyed by `online`, so coming back online remounts the frame
          // fresh and re-attempts — event-driven recovery, no setState-in-effect.
          <MediaFallback catalogId={asset.catalogId} format={asset.format} compact={asset.format === 'Audio'} />
        ) : wantEmbed ? (
          // Keyed on `online` so an offline→online flip remounts a FRESH frame with
          // clean latch state (the recovery path). The frame keeps its iframe
          // MOUNTED through a give-up timeout — the timeout only overlays a fallback,
          // so a late onLoad still swaps the real embed in.
          <MediaFrame key={online ? 'online' : 'offline'} catalogId={asset.catalogId} format={asset.format} title={title} Icon={Icon} heightClass={heightClass} />
        ) : (
          // Open but not yet in view (or waiting to mount): the loading shimmer.
          <MediaShimmer Icon={Icon} />
        )}
      </div>

      {/* Meta row — format marker + date + checklist link. Always shown, in both
          embed and fallback states (the date + checklist are local). */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        marginTop: 8, minWidth: 0,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
          textTransform: 'uppercase', color: 'var(--sr-text-muted)', flexShrink: 0,
        }}>
          <Icon size={12} strokeWidth={2.2} aria-hidden />
          {asset.format}
        </span>
        {dateLabel && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-text)', whiteSpace: 'nowrap' }}>
            {dateLabel}
          </span>
        )}
        {dateLabel && asset.checklistId && (
          <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)', flexShrink: 0 }} aria-hidden>·</span>
        )}
        <ChecklistLink submissionId={asset.checklistId} style={{ flexShrink: 0, fontSize: '0.75rem', fontWeight: 600 }} />
      </div>
    </div>
  )
}
