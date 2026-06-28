// Mutual-exclusion rule for the Map Explorer's two choropleth shade overlays.
//
// The Map Explorer can draw two shadings: the California atlas breeding-code ramp
// (purple) and the US county species ramp (green). Their fills visually fight, so
// only ONE shade fill may be active at a time — turning a shade ON clears the
// other; toggling a shade OFF leaves the other untouched. The boundary-LINE
// overlays (atlas blocks / county lines) are NOT affected by this rule and may
// still coexist.
//
// Pure function, factored out of MapExplorer so the rule is unit-testable in
// isolation (cf. lib/mapPins.ts, lib/heat.ts).

export type ShadingWhich = 'breeding' | 'county'

export interface ShadingState {
  shadeByBreeding: boolean
  shadeByCounty: boolean
}

/**
 * Next shading state after the user toggles one shade control. Toggling a shade
 * ON clears the other shade; toggling it OFF is a plain off (the other is left
 * as-is).
 */
export function nextShadingState(which: ShadingWhich, prev: ShadingState): ShadingState {
  if (which === 'breeding') {
    const on = !prev.shadeByBreeding
    return { shadeByBreeding: on, shadeByCounty: on ? false : prev.shadeByCounty }
  }
  const on = !prev.shadeByCounty
  return { shadeByCounty: on, shadeByBreeding: on ? false : prev.shadeByBreeding }
}
