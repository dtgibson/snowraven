// The command palette's species-half load decision (FR-32 to FR-36).
//
// MODELLED LINE FOR LINE ON `lib/weatherBacklogLoad.ts`, because it is the same
// decision on the same two questions -- is a backup STORED, and did it load --
// and because that module's own header records the two ways this shape has
// already been got wrong in this repo. Copying the shape without copying the
// guards would be copying only the half that looks correct.
//
// WHY IT IS A MODULE AND NOT FOUR LINES IN AN EFFECT: the same reason as there.
// Everything that DECIDES lives here, where a test drives it directly with its
// dependencies handed in; what is left in `CommandPalette.tsx` is one liveness
// check and one setter. The dependencies are INJECTED rather than imported for
// the reason `.claude/rules/testing.md` gives: a test that mocked
// `../lib/storage` and `../lib/observationsCache` wholesale to reach this code
// would be mocking the two modules it is trying to prove this function consults.
//
// Off the entry graph, with the palette overlay that owns it.

import type { ObservationEntry } from '../types'
import type { SpeciesIndexEntry } from './speciesIndex'

/**
 * A backup IS stored and it could not be turned into a species index.
 * Deliberately distinct from `null` (no backup stored) and from `undefined`
 * (still loading), because the `setup-required` / `error` split those two encode
 * is the whole point (DECISIONS.md, 2026-05-22): telling a birder to import a
 * file Settings plainly lists as saved is the exact lie this family removes.
 */
export const PALETTE_SPECIES_UNLOADABLE = 'palette-species-unloadable'

/**
 * Returned when the run was superseded (a newer files epoch, or the palette
 * closing) while it was waiting. The caller writes NO STATE for it -- it is not
 * a fifth display state, and writing `undefined` for it would push a settled
 * half back to its loading line. TypeScript enforces the narrowing.
 */
export const PALETTE_SPECIES_SUPERSEDED = 'palette-species-superseded'

/** Everything the species half can be once the load has settled. */
export type ResolvedSpecies = SpeciesIndexEntry[] | null | typeof PALETTE_SPECIES_UNLOADABLE

export interface PaletteSpeciesDeps {
  /** `storage.getFilesStatus` -- is a backup STORED, whatever it contains. */
  getFilesStatus: () => Promise<{ ebird: unknown }>
  /** `loadEbirdObservations` -- the shared parse-once cache, falsy on any failure. */
  loadObservations: () => Promise<{ observations: ObservationEntry[] } | null>
  /** `speciesIndexFor` -- the memoized derivation. */
  buildIndex: (observations: ObservationEntry[]) => SpeciesIndexEntry[]
  /**
   * False once this run has been superseded. Checked after BOTH awaits: the
   * status read is an async boundary of its own, and a run that loses the race
   * must stop rather than spend a full index build on an answer nobody reads.
   */
  isCurrent: () => boolean
}

/**
 * Decide what the palette's species half should show.
 *
 * Four outcomes, one per PRD state, all distinguishable by their rendered text
 * (QA-35):
 *
 *   `null`                        FR-33  no backup saved
 *   PALETTE_SPECIES_UNLOADABLE    FR-35  a backup IS stored and would not load
 *   SpeciesIndexEntry[]           ready  the rows
 *   (never returned; the caller's own pending state carries FR-34's loading line)
 *
 * A REJECTING STATUS READ LANDS ON `UNLOADABLE`, NEVER ON `null`. That is the
 * precise lie the reference module exists to remove, and it is reachable on
 * web/Pi where `WebStorage.getFilesStatus` is a bare fetch at a backend that can
 * be unreachable. When the palette cannot see the file, "you have no backup" is
 * a claim it has no basis for.
 *
 * THIS PROMISE NEVER REJECTS, and the call site depends on it: `CommandPalette`
 * has no `.catch`, because a branch written in a `.then` would be one more
 * unguarded place. What carries it, exactly: EVERY call this function makes into
 * an injected dependency happens inside a `try` -- both `isCurrent()` call sites
 * and the index build included, which is why that one is `return await` and not
 * `return` -- and the function's own statements are a `Boolean`, two comparisons
 * and returns, none of which can throw.
 *
 * ONE BOUNDARY, NAMED, because an absolute claim that is false is worth less
 * than a bounded one that is true. Rejection is closed; NON-SETTLEMENT is not. A
 * dependency that returns a thenable which never settles leaves this promise
 * pending forever, the species half holds its loading line, and no `try` closes
 * that anywhere. The answer to it is a timeout, which belongs to whoever
 * introduces a dependency that can hang; none of the four can today. Apart from
 * that there are no exceptions, and if one is ever added it belongs in this
 * paragraph.
 */
export async function resolvePaletteSpecies(
  deps: PaletteSpeciesDeps,
): Promise<ResolvedSpecies | typeof PALETTE_SPECIES_SUPERSEDED> {
  let stored: boolean
  try {
    const status = await deps.getFilesStatus()
    if (!deps.isCurrent()) return PALETTE_SPECIES_SUPERSEDED
    stored = Boolean(status.ebird)
  } catch {
    // Whether a backup is stored is unknown, so report the load failure rather
    // than the absence. See the paragraph above.
    return PALETTE_SPECIES_UNLOADABLE
  }

  if (!stored) return null

  let loaded: { observations: ObservationEntry[] } | null
  try {
    loaded = await deps.loadObservations()
    // INSIDE the try, and the placement is the point rather than formatting.
    // Only the FIRST `isCurrent()` call happens to sit inside the status read's
    // try, so a predicate that throws immediately reads as guarded while one
    // that throws late is not -- which is exactly how the reference module's
    // promise came to reject and park its section on a spinner for the session.
    // Cancellation wins over a falsy load: the check is ahead of `!loaded`.
    if (!deps.isCurrent()) return PALETTE_SPECIES_SUPERSEDED
  } catch {
    return PALETTE_SPECIES_UNLOADABLE
  }
  if (!loaded) return PALETTE_SPECIES_UNLOADABLE

  try {
    // `return await`, not `return`, and the `await` is load-bearing on a value
    // the type says is a plain array. An async function's `return v` performs
    // promise resolution of `v` AFTER the try block has exited, so if a
    // `buildIndex` implementation ever hands back a thenable, BOTH the
    // `Get(v, "then")` lookup and the `then` call happen outside this catch:
    // two separate doors out of a statement that looks entirely enclosed
    // (CLAUDE.md, Promise boundaries). The cost on the array path is one
    // microtask tick.
    return await deps.buildIndex(loaded.observations)
  } catch {
    // A backup that read and parsed but could not be turned into an INDEX is
    // still a backup that could not be turned into one. `buildSpeciesIndex` is a
    // pure pass over already-normalized records, so this is remote rather than
    // likely -- but it is the difference between one honest sentence and a
    // loading line that never resolves.
    return PALETTE_SPECIES_UNLOADABLE
  }
}
