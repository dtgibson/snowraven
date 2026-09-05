// The two link marks beside every bird name: eBird first, Birds of the World
// second, on every surface, in every state (feature: species-link-glyph-fallback).
//
// FAILURE IS A VISIBLE STATE, NOT A HIDDEN ONE. A favicon that cannot load used
// to run `visibility: hidden` and leave a fully invisible, still focusable, still
// clickable 24x24 target beside the name -- and offline that happened to every
// mark on every surface. A failed load now reveals a bundled lucide glyph in the
// same reserved 14px slot, so the target the user could already click is visible.
//
// Non-destructive and per image (the v0.5.66 embed shape, extended to a third
// surface): the `<img>` is NEVER unmounted, only hidden, so it keeps its reserved
// box and can still fire `onLoad` -- which clears the flag and restores the real
// favicon in place. Each mark decides for itself, so one favicon beside one glyph
// is an ordinary state rather than an edge case: eBird's favicon is a 302 carrying
// no cache headers and goes the moment the connection does, while Birds of the
// World's `max-age=3600` can outlive it by up to an hour. No retry and no `src`
// nudge is added -- re-requesting a failed image would be a new outbound-request
// policy, which this change deliberately does not make.
//
// Entry-chunk safety: this file imports `react` and `lucide-react` only, both of
// which App.tsx already carries (`BirdName` -> `SpeciesLinks` is on its static
// graph, and `lib/tabIcons.tsx` already pulls lucide). `entryChunk.test.ts` is the
// live guard.
import { useState } from 'react'
import { Globe, SquareLibrary } from 'lucide-react'

/**
 * The shape of an eBird species code as this app resolves one (`/taxonomy/codes`,
 * or the bundled taxonomy snapshot offline): short, lowercase, alphanumeric.
 *
 * A code that misses renders NOTHING -- exactly what the component already does
 * when it is handed no code at all -- rather than shipping a styled 404 link
 * built from a junk value, which is the house answer everywhere a raw id becomes
 * an href (`ChecklistLink`, `HotspotLink`, `CommentText`). Anchored, bounded and
 * quantifier-free by construction, so it is linear on any input.
 */
const SPECIES_CODE_RE = /^[a-z0-9-]{2,16}$/

interface SpeciesLinkMarkProps {
  href: string
  /** The site as the anchor names it to the user, e.g. `eBird`. */
  destination: string
  /** `"{Common name} "`, or `""` when the caller gave no name. */
  who: string
  /** The site's own favicon: the mark a user normally sees. */
  faviconSrc: string
  /** Drawn in the same slot when, and only when, that favicon fails to load. */
  Glyph: typeof Globe
}

/**
 * One mark. Both anchors are this component so the fallback lives in one place
 * rather than being inlined twice.
 */
function SpeciesLinkMark({ href, destination, who, faviconSrc, Glyph }: SpeciesLinkMarkProps) {
  const [failed, setFailed] = useState(false)
  return (
    <a
      tabIndex={0}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`View ${who}on ${destination} (opens in a new tab)`}
      title={`View ${who}on ${destination}`}
      // padding + matching negative margin: a ≥24×24 hit target (WCAG 2.5.8,
      // F098/F099) while the visible 14px favicon stays put in dense rows.
      style={{ opacity: 0.75, display: 'inline-flex', alignItems: 'center', padding: 5, margin: -5 }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75' }}
    >
      {/* `position: relative` only in the fallback state, so the success-state DOM
          is byte-identical to what shipped before. It is the containing block for
          the glyph and has no effect of its own on a fixed 14×14 inline-flex box;
          the slot's geometry lives in `globals.css` and is untouched. */}
      <span className="sr-favicon-slot" style={failed ? { position: 'relative' } : undefined}>
        <img
          src={faviconSrc}
          className="sr-favicon"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          width={14}
          height={14}
          // `visibility: hidden` rather than unmounting or `display: none`: the
          // element stays in the box it reserved and stays able to report a late
          // success back through `onLoad`.
          style={{ display: 'block', visibility: failed ? 'hidden' : undefined }}
          onError={() => setFailed(true)}
          onLoad={() => setFailed(false)}
        />
        {failed && (
          <Glyph
            // 14px in a 14px slot at the design system's in-content stroke, so the
            // fallback occupies the identical box and nothing moves in either
            // direction. No per-glyph size correction: `Globe` and `SquareLibrary`
            // measure 12.95px and 11.80px here and read as equal, because a square
            // encloses more area than the circle inscribed in the same box.
            size={14}
            strokeWidth={2.2}
            aria-hidden="true"
            focusable="false"
            // The colour is SET, never inherited. lucide draws with
            // `stroke="currentColor"`, which would otherwise pick up whatever
            // colour the host surface gives a link context -- and the measured 3:1
            // non-text contrast holds for `--sr-text` specifically (7.96:1 light,
            // 7.63:1 dark at the anchor's resting 0.75, worst-case surface). The
            // dark-theme `brightness(0) invert(1)` favicon filter is
            // `img.sr-favicon`-scoped and must never reach a token-coloured stroke.
            // No transition anywhere: this is a substitution, not an entrance.
            style={{ position: 'absolute', top: 0, left: 0, color: 'var(--sr-text)' }}
          />
        )}
      </span>
    </a>
  )
}

interface SpeciesLinksProps {
  speciesCode: string | undefined
  /** Common name — used to give each favicon link an accessible name. */
  commonName?: string
}

export function SpeciesLinks({ speciesCode, commonName }: SpeciesLinksProps) {
  if (!speciesCode || !SPECIES_CODE_RE.test(speciesCode)) return null
  const who = commonName ? `${commonName} ` : ''
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      marginLeft: 6,
      verticalAlign: 'middle',
    }}>
      {/* Globe for eBird: worldwide observation data. SquareLibrary for Birds of
          the World: the shelf of long-form species accounts. Circle against
          rounded square is the strongest silhouette difference two 14px marks can
          have, which is what carries them at this size; the destination itself is
          named in full by each anchor's own label. */}
      <SpeciesLinkMark
        href={`https://ebird.org/species/${speciesCode}`}
        destination="eBird"
        who={who}
        faviconSrc="https://ebird.org/favicon.ico"
        Glyph={Globe}
      />
      <SpeciesLinkMark
        href={`https://birdsoftheworld.org/bow/species/${speciesCode}/cur/introduction`}
        destination="Birds of the World"
        who={who}
        faviconSrc="https://birdsoftheworld.org/favicon.ico"
        Glyph={SquareLibrary}
      />
    </span>
  )
}
