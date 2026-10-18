// The alpha-code table as React state (species-code-search, schema.md section 6).
//
// SUBSCRIBE-ONLY. It never starts a load: the three load triggers are explicit
// lines in `CommandPalette.tsx`, `SpeciesCombobox.tsx` and
// `map/TargetSpeciesList.tsx` (the Media Targets search box, on focus), so "the
// code data starts loading no later than the first Search open, the first
// picker open or the first focus of that box, and not at app start" is a
// property of those three lines rather than of which components happen to
// mount. `null` while pending, after a failure, or before
// anything asked; the loaded table afterwards, identical for the session.

import { useSyncExternalStore } from 'react'
import type { AlphaCodeTable } from './alphaCodes'
import { getAlphaCodes, subscribeAlphaCodes } from './alphaCodesAsset'

export function useAlphaCodes(): AlphaCodeTable | null {
  return useSyncExternalStore(subscribeAlphaCodes, getAlphaCodes, getAlphaCodes)
}
