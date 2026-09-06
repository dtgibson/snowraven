// The command palette's species-half load decision (FR-32 to FR-36, QA-31 to
// QA-35).
//
// DRIVEN THROUGH THE FUNCTION, WITH ITS DEPENDENCIES HANDED IN, for the two
// reasons `lib/weatherBacklogLoad.ts`'s own suite gives. A test that reached
// this code by mocking `../lib/storage` and `../lib/observationsCache` wholesale
// would be mocking the two modules it is trying to prove the loader consults
// (.claude/rules/testing.md: a guard test that mocks a module wholesale
// structurally cannot verify that module). And the branch under test used to
// live in an effect, and no test in this repo renders `App.tsx`.
//
// The rows cover every answer the resolver can reach: the two honest states,
// every route into the failure one, the two it must stay silent about, and the
// claim the call site rests on -- that the promise never rejects. What is left
// in `CommandPalette.tsx` after the lift is one liveness check and one setter,
// with no `.catch`, so a route out of this function that is neither a resolved
// state nor a caught throw would park the species half on its loading line for
// the session.
import { describe, it, expect, vi } from 'vitest'
import {
  PALETTE_SPECIES_SUPERSEDED,
  PALETTE_SPECIES_UNLOADABLE,
  resolvePaletteSpecies,
} from './paletteSpeciesLoad'
import type { PaletteSpeciesDeps } from './paletteSpeciesLoad'
import type { ObservationEntry } from '../types'
import type { SpeciesIndexEntry } from './speciesIndex'

const EBIRD_ONLY = { ebird: { filename: 'MyEBirdData.csv' } }
const NO_FILES = { ebird: null }
const OBSERVATIONS = [] as unknown as ObservationEntry[]
const LOADED = { observations: OBSERVATIONS }
const INDEX: SpeciesIndexEntry[] = [{ name: 'Sora', sciName: 'Porzana carolina' }]

function deps(over: Partial<PaletteSpeciesDeps> = {}): PaletteSpeciesDeps {
  return {
    getFilesStatus: async () => EBIRD_ONLY,
    loadObservations: async () => LOADED,
    buildIndex: () => INDEX,
    isCurrent: () => true,
    ...over,
  }
}

describe('the four states, all distinguishable (QA-32 to QA-35)', () => {
  it('builds the index when a stored backup loads', async () => {
    expect(await resolvePaletteSpecies(deps())).toBe(INDEX)
  })

  it('reports NO BACKUP only when none is stored (FR-33)', async () => {
    expect(await resolvePaletteSpecies(deps({ getFilesStatus: async () => NO_FILES }))).toBeNull()
  })

  it('does NOT touch the backup at all when none is stored', async () => {
    // Non-vacuity for the row above: the honest branch has to come from the
    // status read, not from the load happening to fail.
    const loadObservations = vi.fn(async () => LOADED)
    await resolvePaletteSpecies(deps({ getFilesStatus: async () => NO_FILES, loadObservations }))
    expect(loadObservations).not.toHaveBeenCalled()
  })

  const STORED_BUT_UNUSABLE: { name: string; load: () => Promise<typeof LOADED | null> }[] = [
    {
      // `loadEbirdObservations` resolves null for a read that failed, a file
      // that read back empty, and a parse that failed alike. An interrupted
      // write leaves a truncated CSV with its metadata intact, and the eBird
      // Backup slot accepts any `.csv`, so a wrong file stores without complaint.
      name: 'the load resolves falsy',
      load: async () => null,
    },
    {
      // Defense in depth rather than the live path: v1.0.15 moved the read
      // inside the cache's own try, so that promise structurally cannot reject
      // today. What matters is that the catch points at the HONEST state.
      name: 'the load rejects',
      load: async () => { throw new TypeError('Failed to fetch') },
    },
  ]

  it.each(STORED_BUT_UNUSABLE.map(r => [r.name, r] as const))(
    'reports UNLOADABLE when a backup is stored and %s (FR-35)',
    async (_name, route) => {
      expect(await resolvePaletteSpecies(deps({ loadObservations: route.load })))
        .toBe(PALETTE_SPECIES_UNLOADABLE)
    },
  )

  it('reports UNLOADABLE when the STATUS READ itself fails, never NO BACKUP', async () => {
    // THE PRECISE LIE THIS FAMILY EXISTS TO REMOVE. When the palette cannot find
    // out whether a backup is stored, "you have no backup, go upload one" is a
    // claim it has no basis for -- and it is reachable on web and the Pi, where
    // `getFilesStatus` is a bare fetch at a backend that can be unreachable.
    const r = await resolvePaletteSpecies(deps({
      getFilesStatus: async () => { throw new TypeError('Failed to fetch') },
    }))
    expect(r).toBe(PALETTE_SPECIES_UNLOADABLE)
    expect(r).not.toBeNull()
  })

  it('reports UNLOADABLE when the INDEX BUILD throws', async () => {
    // A backup that read and parsed but could not be turned into an index is
    // still a backup that could not be turned into one. Remote rather than
    // likely, and the difference between one honest sentence and a loading line
    // that never resolves.
    const r = await resolvePaletteSpecies(deps({
      buildIndex: () => { throw new TypeError('cannot read properties of undefined') },
    }))
    expect(r).toBe(PALETTE_SPECIES_UNLOADABLE)
  })

  it('the four outcomes are four DISTINCT values, so no two can be rendered at once', () => {
    // QA-33's "never present at the same time as either" is a property of the
    // type rather than of the render: one state variable, four values, and the
    // component's own pending marker is a fifth that this resolver never returns.
    const outcomes = new Set([JSON.stringify(INDEX), 'null', PALETTE_SPECIES_UNLOADABLE, PALETTE_SPECIES_SUPERSEDED])
    expect(outcomes.size).toBe(4)
    expect(PALETTE_SPECIES_UNLOADABLE).not.toBe(PALETTE_SPECIES_SUPERSEDED)
  })
})

describe('a superseded run writes no state at all (FR-31, QA-30)', () => {
  it('when it loses the race during the STATUS READ', async () => {
    // The status read is an async boundary of its own, so it needs its own
    // liveness check -- and a run that stops here must not spend a load on an
    // answer nobody will read.
    const loadObservations = vi.fn(async () => LOADED)
    const r = await resolvePaletteSpecies(deps({ isCurrent: () => false, loadObservations }))
    expect(r).toBe(PALETTE_SPECIES_SUPERSEDED)
    expect(loadObservations).not.toHaveBeenCalled()
  })

  it('when it loses the race AFTER the load, even though it settled TRUTHY', async () => {
    // Finding C's rule at this surface: a cancelled run writes no state at all,
    // including the state it would otherwise have been right about. Cancelled
    // only after the observations load, so the EARLIER guard cannot be what
    // makes this pass.
    let calls = 0
    const buildIndex = vi.fn(() => INDEX)
    const r = await resolvePaletteSpecies(deps({
      isCurrent: () => { calls += 1; return calls < 2 },
      buildIndex,
    }))
    expect(r).toBe(PALETTE_SPECIES_SUPERSEDED)
    expect(calls).toBe(2)                     // non-vacuity: the later call was reached
    expect(buildIndex).not.toHaveBeenCalled() // and no work was spent on the dead answer
  })

  it('cancellation wins over a falsy load, which is why the check is ahead of !loaded', async () => {
    let calls = 0
    const r = await resolvePaletteSpecies(deps({
      isCurrent: () => { calls += 1; return calls < 2 },
      loadObservations: async () => null,
    }))
    expect(r).toBe(PALETTE_SPECIES_SUPERSEDED)
  })
})

describe('the promise NEVER REJECTS, which is what the call site rests on', () => {
  it('not even when the liveness check throws on its LATER call', async () => {
    // The named case, because it is the one a roster missed in the reference
    // module. `isCurrent` is called twice and only the FIRST call sits inside
    // the status read's try, so a predicate that throws immediately reads as
    // guarded while one that throws late rejected the whole promise. There is no
    // good answer to a throwing liveness predicate, so it takes the same visible
    // one as everything else here rather than escaping to nobody.
    let calls = 0
    const d = deps({
      isCurrent: () => { calls += 1; if (calls === 2) throw new TypeError('boom'); return true },
    })
    await expect(resolvePaletteSpecies(d)).resolves.toBe(PALETTE_SPECIES_UNLOADABLE)
    expect(calls).toBe(2)
  })

  it('whichever dependency throws, and however late', async () => {
    // ITERATED OVER THE DEPENDENCY OBJECT, NEVER A LIST OF NAMES. A roster
    // cannot see what it does not name, and in the reference module the omitted
    // member was the one with the unguarded call site -- a designed mutation
    // produced zero failures. `Object.keys` closes that by construction, since
    // TypeScript already forces this fixture to carry every member of
    // `PaletteSpeciesDeps` for the call below to compile, so a dependency added
    // later brings its own rows whether or not anyone remembers this file.
    //
    // AND THE nth-CALL SWEEP IS THE OTHER HALF. A member called more than once
    // has more than one site and they are not equally guarded; throwing only on
    // the first call is exactly what made the reference defect invisible.
    const KEYS = Object.keys(deps())
    const NTH_MAX = 3
    const LEGAL: unknown[] = [PALETTE_SPECIES_UNLOADABLE, PALETTE_SPECIES_SUPERSEDED, null]
    let checked = 0
    let maxCallsOnHealthyPath = 0

    for (const key of KEYS) {
      for (let nth = 1; nth <= NTH_MAX; nth += 1) {
        const base = deps() as unknown as Record<string, (...args: never[]) => unknown>
        const real = base[key]
        let calls = 0
        base[key] = (...args: never[]) => {
          calls += 1
          if (calls === nth) throw new TypeError(`${key} threw on call ${nth}`)
          return real(...args)
        }
        const d = base as unknown as PaletteSpeciesDeps

        const [settled] = await Promise.allSettled([resolvePaletteSpecies(d)])
        // Compared as a labelled string so a failure names the member and the
        // call number rather than reporting 'rejected' with no context.
        expect(`${key}#${nth}: ${settled.status}`).toBe(`${key}#${nth}: fulfilled`)
        const value = (settled as PromiseFulfilledResult<unknown>).value
        // A throw on a call that never happens leaves the healthy path intact,
        // so the resolved value is a LEGAL state rather than always the failure.
        expect(Array.isArray(value) || LEGAL.includes(value)).toBe(true)
        maxCallsOnHealthyPath = Math.max(maxCallsOnHealthyPath, calls)
        checked += 1
      }
    }

    // Non-vacuity: an empty or partial key list would otherwise pass silently.
    expect(checked).toBe(KEYS.length * NTH_MAX)
    expect(KEYS.length).toBeGreaterThanOrEqual(4)
    // And the ceiling is real headroom rather than a number that has silently
    // narrowed as the code grew: the healthy path's true maximum is below it.
    expect(maxCallsOnHealthyPath).toBeLessThan(NTH_MAX)
  })

  it('and not when a dependency RESOLVES BADLY, which a throw-sweep is blind to', async () => {
    // The sweep above can only see members that throw. A member that hands back
    // a hostile VALUE is a different shape, and one of them -- a `getFilesStatus`
    // that resolves without the field being read -- is the ordinary web/Pi
    // degradation rather than an exotic case.
    const HOSTILE: { name: string; over: Partial<PaletteSpeciesDeps> }[] = [
      { name: 'a status object with no ebird field', over: { getFilesStatus: async () => ({}) as { ebird: unknown } } },
      { name: 'a status object whose ebird is undefined', over: { getFilesStatus: async () => ({ ebird: undefined }) } },
      { name: 'a load that resolves undefined', over: { loadObservations: async () => (undefined as unknown as null) } },
    ]
    for (const c of HOSTILE) {
      const [settled] = await Promise.allSettled([resolvePaletteSpecies(deps(c.over))])
      expect(`${c.name}: ${settled.status}`).toBe(`${c.name}: fulfilled`)
    }
  })

  it('and `return await` is what closes the last door, on a value the type says is an array', async () => {
    // In an async function `return v` performs promise resolution of `v` AFTER
    // the try block exits, so a thenable escapes through TWO doors on one
    // enclosed-looking statement: the `then` call, and the `Get(v, "then")`
    // getter lookup. Both are exercised here, and both are caught only because
    // the statement is `return await`.
    const rejectingThenable = {
      then: (_res: unknown, rej: (e: unknown) => void) => rej(new TypeError('late rejection')),
    } as unknown as SpeciesIndexEntry[]
    await expect(resolvePaletteSpecies(deps({ buildIndex: () => rejectingThenable })))
      .resolves.toBe(PALETTE_SPECIES_UNLOADABLE)

    const throwingGetter = {} as SpeciesIndexEntry[]
    Object.defineProperty(throwingGetter, 'then', {
      get() { throw new TypeError('then getter threw') },
    })
    await expect(resolvePaletteSpecies(deps({ buildIndex: () => throwingGetter })))
      .resolves.toBe(PALETTE_SPECIES_UNLOADABLE)
  })
})
