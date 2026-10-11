// The alpha-code table as React state (species-code-search, schema.md section 6).
//
// SUBSCRIBE-ONLY. It never starts a load: the two load triggers are explicit
// lines in `CommandPalette.tsx` and `SpeciesCombobox.tsx`, so "the code data
// starts loading no later than the first Search open or the first picker open,
// and not at app start" is a property of those two lines rather than of which
// components happen to mount. `null` while pending, after a failure, or before
// anything asked; the loaded table afterwards, identical for the session.

import { useSyncExternalStore } from 'react'
import type { AlphaCodeTable } from './alphaCodes'
import { getAlphaCodes, subscribeAlphaCodes } from './alphaCodesAsset'

export function useAlphaCodes(): AlphaCodeTable | null {
  return useSyncExternalStore(subscribeAlphaCodes, getAlphaCodes, getAlphaCodes)
}
