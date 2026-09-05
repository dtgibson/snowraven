// Every user-facing string the command palette renders, in ONE module (FR-56).
//
// One module rather than two, deliberately. The `countabilityCopy.ts` precedent
// -- split out of `exoticCopy.ts` so an entry-graph component would not drag
// 3.7 KB for one string -- does not bind here: this whole set is a handful of
// short sentences well under 1 KB, and splitting it would put the palette's
// strings in two files and defeat the point of having a copy module at all,
// which is that every one of them rides the repo's em-dash and agreement sweeps
// (.claude/rules/docs-and-website.md).
//
// It rides App.tsx's entry chunk on purpose (the nav's search control needs the
// control label before any lazy chunk has loaded) and imports NOTHING, so it
// costs the entry graph one small module and no edges. `entryChunk.test.ts`
// asserts both halves.
//
// WHAT IS NOT HERE, and must not be moved here: `EBIRD_BACKUP_LOAD_ERROR`.
// FR-35 requires that exact string, and `components/setupCopy.tsx` is where it
// lives for every surface that says a stored file would not load. A second name
// for one string would break the delivery-versus-content split
// `honestLoadFailures.test.tsx` rests on, which is the whole reason that
// constant is single-sourced. The palette imports it from there.
//
// NO EM DASH (U+2014) appears in any string below, and none may be added.
// Surface names come from `TAB_LABELS` in lib/tabLayout.ts, never from a
// component or file name (FR-57), which is why no destination is named here.

export const PALETTE_COPY = {
  /** The nav's entry-point control, at all three densities. */
  controlLabel: 'Search',
  /** The query input's accessible name, the dialog's, and the listbox's. */
  inputLabel: 'Search destinations and species',
  /** State-voiced, naming what the control searches rather than commanding. */
  placeholder: 'Search destinations and species',
  closeLabel: 'Close search',
  groupDestinations: 'Destinations',
  groupSpecies: 'Species',
  /** FR-34. The species half only; destinations are never blocked by it. */
  speciesLoading: 'Reading your eBird backup.',
  /** FR-33. Reuses the shipped setup wording and names the exact Settings path. */
  speciesNoBackup:
    'Searching species needs your eBird backup. Upload MyEBirdData.csv in Settings → Default Files → eBird Backup.',
  /** FR-36. Says NOTHING about species, so it is distinguishable from the three above. */
  noMatches: 'Nothing matches that search.',
  legendMove: 'Move',
  legendOpen: 'Open',
  legendClose: 'Close',
} as const

/**
 * FR-26's cap line, as a function of the cap rather than a literal.
 *
 * The number lives once, in `SPECIES_CAP` (lib/paletteRows.ts), and this reads
 * it -- so the sentence and the slice can never disagree, which two constants
 * holding the same literal cannot promise. It is still IN the copy module, so it
 * rides the em-dash and agreement sweeps like every other string here (the
 * standing rule that a count-bearing string built outside the copy module is
 * invisible to those sweeps).
 *
 * The cap is a plural in every shipped configuration and the sentence is written
 * for one; a cap of 1 would need its own wording, and there is no reason to have
 * one.
 */
export function speciesCapLine(cap: number): string {
  return `Showing the first ${cap} matches. Keep typing to narrow them.`
}
