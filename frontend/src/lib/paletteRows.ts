// The command palette's result list, as ONE FLAT ARRAY built by a pure function
// (FR-21, FR-24, FR-26, FR-39, NFR-02, NFR-11).
//
// FLAT IS THE POINT. Destinations first, then species, in a single array with a
// single active index -- which is what makes FR-39's arrow navigation cross the
// group boundary for free rather than needing per-group index arithmetic. The
// two `role="group"` wrappers the overlay draws are a RENDER concern layered on
// top of this array (the APG grouped-listbox shape); they do not partition it.
//
// WHAT IS DELIBERATELY NOT IN `rows`: the group headings, the cap line and the
// four species-half state lines. They are not options, are not focusable and are
// not reachable by the arrow keys (FR-41, QA-40), so putting them in the array
// that `activeIdx` walks is exactly the mistake to avoid.
//
// Off the entry graph. Its only value import is `speciesMatch`, which is also
// off it; the rest are type imports and are erased.

import type { Tab } from './tabLayout'
import type { TabIcon } from './tabIcons'
import { compareSpeciesName, type SpeciesIndexEntry } from './speciesIndex'
import { matchesSpeciesQuery, normalizeSpeciesQuery } from './speciesMatch'

/**
 * A destination, in the shape `App.tsx` already builds for the navigation.
 * Structurally identical to `NavItem` (components/TabNav.tsx) on purpose: the
 * palette takes the nav's own array and holds no destination list of its own.
 */
export interface PaletteNavItem {
  id: Tab
  label: string
  icon: TabIcon
}

export type PaletteRow =
  | { kind: 'tab'; id: Tab; label: string; icon: TabIcon }
  | { kind: 'species'; name: string; sciName: string }

/**
 * FR-26 / PRD Open Question 3. A judgement, not a measurement -- and ONE
 * constant, so changing it is one edit and the cap line
 * (`speciesCapLine` in lib/paletteCopy.ts) reads it rather than repeating it.
 */
export const SPECIES_CAP = 50

export interface PaletteRowsInput {
  /** `App.tsx`'s `navItems`: the saved visible order, Settings appended last. */
  items: readonly PaletteNavItem[]
  /** The species index, or `null` while the species half has no answer. */
  index: readonly SpeciesIndexEntry[] | null
  /** The raw query, exactly as typed. Normalized ONCE here, never per row. */
  query: string
  /** Overridable for tests; production always uses `SPECIES_CAP`. */
  cap?: number
}

export interface PaletteRowsResult {
  rows: PaletteRow[]
  /** How many leading rows are destinations. The species rows are the rest. */
  destinationCount: number
  /** True when more species matched than the cap admitted (FR-26). */
  speciesTruncated: boolean
}

/**
 * Build the palette's rows for one query.
 *
 * - An EMPTY query yields every destination and ZERO species (FR-21, FR-24), so
 *   the palette is usable as a plain navigation jump with nothing typed and does
 *   not dump a thousand species on open.
 * - A non-empty query filters destinations on their label and species through
 *   the shared `matchesSpeciesQuery` predicate, against a query normalized once
 *   per call.
 * - DESTINATIONS ARE NEVER CAPPED. Species are capped after ordering, and
 *   `speciesTruncated` reports whether anything was dropped.
 *
 * The species matches are sorted HERE rather than relying on the index arriving
 * sorted, so the ordering guarantee (FR-25, QA-24) is a property of this
 * function over any input rather than of whoever built the index. It uses the
 * same `compareSpeciesName` the index build uses, so the two cannot disagree.
 */
export function buildPaletteRows(input: PaletteRowsInput): PaletteRowsResult {
  const { items, index, query } = input
  const cap = input.cap ?? SPECIES_CAP
  const q = normalizeSpeciesQuery(query)

  const destinations = q
    ? items.filter(it => it.label.toLowerCase().includes(q))
    : items
  const rows: PaletteRow[] = destinations.map(it => ({
    kind: 'tab',
    id: it.id,
    label: it.label,
    icon: it.icon,
  }))
  const destinationCount = rows.length

  let speciesTruncated = false
  if (q && index) {
    const matched = index.filter(s => matchesSpeciesQuery(s, q))
    matched.sort(compareSpeciesName)
    if (matched.length > cap) {
      speciesTruncated = true
      matched.length = cap
    }
    for (const s of matched) rows.push({ kind: 'species', name: s.name, sciName: s.sciName })
  }

  return { rows, destinationCount, speciesTruncated }
}
