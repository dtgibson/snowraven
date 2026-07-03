// Calendar "Use Textures" mode — the DOM crosshatch density spec. Reuses only the
// monotonic density SHAPE from countyTextures.ts (HatchSpec { gapPx, lineWidthPx }
// + the density = lineWidth/gap proxy), re-tuned for a ~40px DOM cell and 5 tiers.
//
// It does NOT import the MapLibre sprite path (no canvas ImageData, no map.addImage,
// no fill-pattern, no styleimagemissing net, no data-theme MutationObserver). The
// crosshatch is two composited `repeating-linear-gradient`s reading the
// --sr-cal-N-rgb tokens, so it follows the theme automatically — there is nothing
// to regenerate.

export type CalTier = 1 | 2 | 3 | 4 | 5
export const CAL_TIERS: CalTier[] = [1, 2, 3, 4, 5]

export interface CalHatchSpec { gapPx: number; lineWidthPx: number }

/** Re-tuned for a ~40px cell. gap shrinks 9→3, weight rises 1.0→1.8 — the SAME
 *  monotonic-density shape as county. */
export const CAL_HATCH: Record<CalTier, CalHatchSpec> = {
  1: { gapPx: 9,   lineWidthPx: 1.0 },
  2: { gapPx: 7,   lineWidthPx: 1.1 },
  3: { gapPx: 5.5, lineWidthPx: 1.3 },
  4: { gapPx: 4,   lineWidthPx: 1.5 },
  5: { gapPx: 3,   lineWidthPx: 1.8 },
}

export function calHatchSpec(tier: CalTier): CalHatchSpec { return CAL_HATCH[tier] }

/** Pure ink-coverage proxy (lineWidth / gap) — the guard metric, strictly
 *  increasing across tiers (the countyHatchDensity analogue). */
export function calHatchDensity(tier: CalTier): number {
  return CAL_HATCH[tier].lineWidthPx / CAL_HATCH[tier].gapPx
}

/** SIMPLIFIED single-direction (45°) hatch for the FR-44 Year-Overview mini-cell
 *  (~7px). A full 45°/135° crosshatch clogs a tiny cell to mud, so the thumbnail
 *  drops the second diagonal and tightens the gap 5→2px / weight 1.0→1.2px. It is
 *  the SAME monotonic-density SHAPE, sourced from this same table so the big-cell
 *  and mini-cell curves cannot diverge and the ONE monotonic guard covers both. */
export const CAL_MINI_HATCH: Record<CalTier, CalHatchSpec> = {
  1: { gapPx: 5,   lineWidthPx: 1.0 },
  2: { gapPx: 4,   lineWidthPx: 1.0 },
  3: { gapPx: 3.2, lineWidthPx: 1.0 },
  4: { gapPx: 2.6, lineWidthPx: 1.1 },
  5: { gapPx: 2,   lineWidthPx: 1.2 },
}

/** Ink-coverage proxy for the mini hatch — also strictly monotonic across tiers. */
export function calMiniHatchDensity(tier: CalTier): number {
  return CAL_MINI_HATCH[tier].lineWidthPx / CAL_MINI_HATCH[tier].gapPx
}

/** Per-tier inline background for a BIG data cell in textures mode. A faint
 *  tier-color underlay (residual hue cue, FR-25) + two diagonal
 *  repeating-linear-gradients whose gap/weight come from CAL_HATCH. The legend
 *  swatch calls the identical source so cell and swatch can never drift. */
export function calHatchCss(tier: CalTier): { background: string; backgroundColor: string } {
  const { gapPx, lineWidthPx } = CAL_HATCH[tier]
  const rgb = `var(--sr-cal-${tier}-rgb)`
  const stroke = `rgba(${rgb}, 0.85)`
  const stop = `${lineWidthPx}px`
  const tile = `${gapPx}px`
  return {
    backgroundColor: `rgba(${rgb}, 0.12)`,
    background: [
      `repeating-linear-gradient(45deg,  ${stroke} 0 ${stop}, transparent ${stop} ${tile})`,
      `repeating-linear-gradient(135deg, ${stroke} 0 ${stop}, transparent ${stop} ${tile})`,
    ].join(', '),
  }
}

/** Per-tier inline background for a MINI (Year-Overview thumbnail) cell in textures
 *  mode — the simplified single-direction 45° hatch from CAL_MINI_HATCH. */
export function calMiniHatchCss(tier: CalTier): { background: string; backgroundColor: string } {
  const { gapPx, lineWidthPx } = CAL_MINI_HATCH[tier]
  const rgb = `var(--sr-cal-${tier}-rgb)`
  const stroke = `rgba(${rgb}, 0.9)`
  const stop = `${lineWidthPx}px`
  const tile = `${gapPx}px`
  return {
    backgroundColor: `rgba(${rgb}, 0.16)`,
    background: `repeating-linear-gradient(45deg, ${stroke} 0 ${stop}, transparent ${stop} ${tile})`,
  }
}
