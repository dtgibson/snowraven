// SVG <defs> with one pattern per breeding tier. Each pattern bakes BOTH channels
// of the encoding into a single fill: a translucent tier-color rect + a distinct
// hatch that grows denser with tier strength (sparse dots → dense cross-hatch), so
// the breeding level is legible without relying on color (colorblind-accessible).
// Colors use the --sr-tier-N-rgb tokens via inline style, so they stay correct in
// light and dark. Block paths reference these via `fill: url(#sr-atlas-tier-N)`.
//
// Rendered once in the MapExplorer DOM (same document as the Leaflet overlay SVG),
// so `fill: url(#id)` fragment refs resolve. Spacing/alpha are tuned for base-map
// label readability — keep fills translucent and strokes thin.

// Kept deliberately light so the base map (street/place labels, imagery) stays
// readable THROUGH the shading: only a faint fill tint, with spaced hatch lines so
// most of each block shows the map between strokes. The tier is carried by line
// DENSITY (sparse dots → dense cross-hatch) plus the line color — not by a heavy
// fill. Tune these if a tier still obscures the map.
const FILL_ALPHA = 0.12
const STROKE_ALPHA = 0.85  // single-mark tiers (dots, single diagonal)
const CROSS_ALPHA = 0.6    // cross-hatch tiers: lighter, since two line directions overlap

export function AtlasTierPatterns() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {/* Tier 1 — Possible: sparse dots */}
        <pattern id="sr-atlas-tier-1" patternUnits="userSpaceOnUse" width="14" height="14">
          <rect width="14" height="14" style={{ fill: `rgba(var(--sr-tier-1-rgb), ${FILL_ALPHA})` }} />
          <circle cx="7" cy="7" r="1.1" style={{ fill: `rgba(var(--sr-tier-1-rgb), ${STROKE_ALPHA})` }} />
        </pattern>
        {/* Tier 2 — Probable: single diagonal, widely spaced */}
        <pattern id="sr-atlas-tier-2" patternUnits="userSpaceOnUse" width="13" height="13">
          <rect width="13" height="13" style={{ fill: `rgba(var(--sr-tier-2-rgb), ${FILL_ALPHA})` }} />
          <path d="M0,13 L13,0" style={{ stroke: `rgba(var(--sr-tier-2-rgb), ${STROKE_ALPHA})`, strokeWidth: 1 }} />
        </pattern>
        {/* Tier 3 — Confirmed (nest building): cross-hatch.
            Cross-hatch covers ~2× a single diagonal, so it uses wider spacing,
            thinner lines, and a lighter line opacity (CROSS_ALPHA) than tiers 1–2
            to keep the base map readable through the diamonds. */}
        <pattern id="sr-atlas-tier-3" patternUnits="userSpaceOnUse" width="22" height="22">
          <rect width="22" height="22" style={{ fill: `rgba(var(--sr-tier-3-rgb), ${FILL_ALPHA})` }} />
          <path d="M0,22 L22,0 M0,0 L22,22" style={{ stroke: `rgba(var(--sr-tier-3-rgb), ${CROSS_ALPHA})`, strokeWidth: 0.75 }} />
        </pattern>
        {/* Tier 4 — Confirmed (nest/young): denser cross-hatch (still well-spaced) */}
        <pattern id="sr-atlas-tier-4" patternUnits="userSpaceOnUse" width="16" height="16">
          <rect width="16" height="16" style={{ fill: `rgba(var(--sr-tier-4-rgb), ${FILL_ALPHA})` }} />
          <path d="M0,16 L16,0 M0,0 L16,16" style={{ stroke: `rgba(var(--sr-tier-4-rgb), ${CROSS_ALPHA})`, strokeWidth: 0.75 }} />
        </pattern>
      </defs>
    </svg>
  )
}
