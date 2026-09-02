import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

const source = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8')

/**
 * Every SHIPPED source file under src/, as a path relative to src/ (tests and
 * type declarations excluded). A guard about "how many call sites exist" has to
 * see the whole tree, not a file named in advance: naming the files is exactly
 * the assumption such a guard exists to stop.
 */
const shippedSources = (): string[] => {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      if (entry.isDirectory()) { walk(`${dir}${entry.name}/`); continue }
      if (!/\.tsx?$/.test(entry.name)) continue
      if (/\.test\.tsx?$/.test(entry.name) || entry.name.endsWith('.d.ts')) continue
      found.push(`${dir}${entry.name}`)
    }
  }
  walk('')
  return found.sort()
}

/**
 * Source with commented-out lines dropped — whole-line `//`, and a `/*` block
 * that OPENS a line (one-liner or spanning). Line-based on purpose: it can
 * never damage a `//` or `/*` inside a string on a code line (the hazard the
 * graph tests' full tokenizer exists for), and it closes the one hole that
 * matters to a call-site guard — a call commented out still reads as a call.
 * Demonstrated: commenting out the three purge calls left every text assertion
 * below green while the behavioural tests went red.
 *
 * Both comment forms are stripped because the guard must not be satisfiable by
 * a call that no longer runs, and `//` alone left the block form as a way to do
 * exactly that. The residual line-based imprecision fails in the SAFE
 * direction: a line wrongly dropped makes a `toContain` go red, which is loud.
 */
const code = (relative: string): string => {
  const kept: string[] = []
  let inBlock = false
  for (const line of source(relative).split('\n')) {
    const trimmed = line.trimStart()
    if (inBlock) {
      // The whole closing line goes: a call sharing a line with `*/` is not a
      // shape this codebase writes, and dropping it would only fail loudly.
      if (trimmed.includes('*/')) inBlock = false
      continue
    }
    if (trimmed.startsWith('//')) continue
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlock = true
      continue
    }
    kept.push(line)
  }
  return kept.join('\n')
}

describe('capacity-plus-one cache inventory', () => {
  it('storage remains an I/O adapter and owns no cache or eviction policy', () => {
    const storage = source('./storage.ts')
    expect(storage).not.toMatch(/\b(?:Map|Set)\s*</)
    expect(storage).not.toMatch(/\b(?:shift|splice)\s*\(/)
    expect(storage).not.toContain('MAX_ENTRIES')
    expect(storage).not.toContain('MAX_BYTES')
    expect(storage).toContain("return this.getSetting<ReplayStore>('replay-store-v1')")
    expect(storage).toContain("await this.setSetting('replay-store-v1', store)")
  })

  it('SnowMap ships only positron while the typed style domain is exactly two variants', () => {
    const snowMap = source('../components/SnowMap.tsx')
    const mapStyle = source('./mapStyle.ts')
    expect(mapStyle).toContain("export type VectorVariant = 'positron' | 'liberty'")
    expect(snowMap.match(/const variant: VectorVariant = 'positron'/g)).toHaveLength(1)
    expect(snowMap).not.toMatch(/const variant: VectorVariant = 'liberty'/)
  })

  it('the live network cache is capped, and EVERY entry point goes through it', () => {
    // This was the ONE cache missing from this inventory, and it was the one that
    // was uncapped: a module-scope Map with expire-on-read only, keyed by lat/lng
    // rounded to ~1 m, so every distinct map search center added a permanent entry
    // holding a whole eBird payload. Enumerated here so it cannot drift back out.
    const networkCache = source('./networkCache.ts')
    expect(networkCache).toMatch(/NETWORK_CACHE_MAX_ENTRIES = 64/)
    // FIFO: an eviction costs one redundant request (DECISIONS.md, v0.5.86).
    expect(networkCache).toContain('cache.keys().next()')

    // The cap lives at the one chokepoint, so every caller inherits it rather than
    // each remembering it: the transport's cached GET, the desktop raw path, and
    // desktop region-info lookups. Enumerated by name so a NEW caller that keeps its
    // own store instead of routing here is a visible diff, not a silent second cache.
    expect(source('./transport.ts')).toMatch(/import \{[^}]*cachedGet[^}]*\} from '\.\/networkCache'/s)
    expect(source('./transport.ts')).toContain('return cachedGet(networkCacheKey(path, params), load)')
    expect(source('./tauri/mapService.ts')).toMatch(/import \{[^}]*cachedGet[^}]*\} from '\.\.\/networkCache'/s)
    expect(source('./tauri/mapService.ts')).toContain('await cachedGet(rawKey, () => fetchRecentObsRaw(lat, lng, dist))')
    expect(source('./tauri/regionInfo.ts')).toMatch(/import \{[^}]*cachedGet[^}]*\} from '\.\.\/networkCache'/s)
    expect(source('./tauri/regionInfo.ts')).toContain('cachedGet(`region-info:${locId}`')

    // Neither entry point keeps a second, uncapped store of its own alongside it.
    expect(source('./tauri/mapService.ts')).not.toMatch(/new Map<string, \{[^}]*expires/)
  })

  it('the observations cache retains a header line, not the whole export', () => {
    // It used to cache { text, observations } at module scope for the session, to
    // answer one first-line boolean for the Breeding Codes tab.
    const observations = source('./observationsCache.ts')
    expect(observations).toContain('export interface LoadedEbird')
    expect(observations).toContain('headerLine: string')
    expect(observations).not.toMatch(/\btext: string;\s*observations\b/)
  })

  it('every durable store keyed on the user\'s own file registers a clear-path teardown', () => {
    // THE CONVENTION, made enforceable (clear-means-clear). "Clear my data" has
    // to clear the derived answers too, and four stores each missed it because
    // each of the three clear paths would have had to remember all four. The
    // rule that travels: a durable store keyed on user-file content registers
    // with the same teardown that deletes the file. This pairs the two halves,
    // so a store that grows a purge no registry row calls — or a row naming a
    // purge no store exports — fails HERE rather than silently leaving a user's
    // checklist ids on disk after they pressed Clear.
    const registry = code('./clearDerived.ts')
    const stores: Array<[string, string]> = [
      ['./exoticProvenanceCache.ts', 'purgeProvenanceStore'],
      ['./checklistProjectsCache.ts', 'purgeProjectsStore'],
      ['./countyCompletenessCache.ts', 'purgeCountyCompletenessStore'],
      ['./replayStore.ts', 'purgeChecklistReplay'],
    ]
    for (const [module, purge] of stores) {
      // A PRODUCTION export, not a test seam: `_reset*ForTests` only detaches
      // the mirror, so shipping one as the clear path would leave the document.
      expect(code(module)).toContain(`export async function ${purge}(`)
      expect(registry).toContain(`.${purge}()`)
    }
    // Every registry row states the slot it belongs to, and the ONE entry point
    // is named for the side of the clear/replace boundary it serves.
    expect(registry).toContain('export async function purgeDerivedOnClear(')
    expect(registry.match(/slot: 'ebird'/g)).toHaveLength(stores.length)

    // The three settings-document stores purge through the CHAINED seam link
    // rather than a hand-rolled read-modify-write (CLAUDE.md docChains, v1.0.9).
    for (const [module] of stores.slice(0, 3)) {
      expect(code(module)).toMatch(/storage\.deleteSetting\(/)
    }
  })

  it('replayStore.put has ONE call site, and it hands over the pre-request generation', () => {
    // `put`'s third argument — the generation captured BEFORE the request — is
    // optional, and that is safe TODAY only because of a structural fact: one
    // module in all of src calls `put`, and that call opts in. So the guard is
    // on the structural fact. `transport.test.ts` cannot cover this: it mocks
    // the store and pins only the call site it drives, so a new
    // `await fetch(); put(key, data)` in some other module would leak a
    // checklist key past a Clear and stay green there. If a second call site
    // ever needs to exist, this test failing is the prompt to make the argument
    // required rather than to add a row here.
    const callers = shippedSources().filter(rel => /['"][^'"]*replayStore['"]/.test(code(`../${rel}`)))
    expect(callers).toEqual(['lib/clearDerived.ts', 'lib/transport.ts'])

    // clearDerived reaches the store for the teardown only, never to write.
    expect(code('./clearDerived.ts')).toContain('purgeChecklistReplay()')
    expect(code('./clearDerived.ts')).not.toMatch(/\.put\(/)

    // The one real call site, with all three arguments.
    const calls = code('./transport.ts').match(/\breplayStore\.put\([^;]*?\)/g) ?? []
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatch(/^replayStore\.put\([^,]+,[^,]+,[^,)]+\)$/)

    // And the capture is read BEFORE the request, not after it — the behaviour
    // is pinned in transport.test.ts; this keeps the two lines from being
    // reordered without one of them going red.
    // Sliced from the chokepoint's own first line — `getReplayable` also has
    // two bare implementations above it that hold no store at all.
    const transportSrc = code('./transport.ts')
    const chokepoint = transportSrc.slice(transportSrc.indexOf('const key = replayStore.replayKey('))
    expect(chokepoint.indexOf('replayStore.purgeGeneration()'))
      .toBeLessThan(chokepoint.indexOf('await this.get<T>(path, params)'))
  })

  it('all three clear paths go through the shared teardown, and no replace path does', () => {
    // The clear/replace boundary, held as source text because it is a boundary
    // about WHICH CALL SITES exist. The behaviour on each side is proven in
    // clearDerived.test.ts, icloudSync.test.ts and Settings.clear.test.tsx.
    const settings = code('../components/Settings.tsx')
    const controller = code('./icloud/icloudSync.ts')

    // Settings: exactly one call, in the delete handler.
    expect(settings.match(/purgeDerivedOnClear\(/g)).toHaveLength(1)

    // The controller takes the teardown as a dependency SEPARATE from
    // `invalidate` — which also serves the synced arrival, a replace — and calls
    // it exactly twice: `delete-local` and `clearWithSync`.
    // The list it resolves with is the failed stores, and the type says so:
    // an empty resolve used to be indistinguishable from a clean sweep.
    expect(controller).toContain('purgeDerived: (slot: Slot) => Promise<readonly string[]>')
    expect(controller.match(/await deps\.purgeDerived\(slot\)/g)).toHaveLength(2)
    // The two are wired from different places, so one cannot silently become
    // the other.
    expect(controller).toContain('purgeDerived: (slot) => cd.purgeDerivedOnClear(slot)')
  })

  it('the two durable cache caps and Nominatim admission caps stay explicit', () => {
    expect(source('./countyCompletenessCache.ts')).toMatch(
      /COMPLETENESS_MAX_ENTRIES = 250[\s\S]*COMPLETENESS_MAX_BYTES = 4_000_000/,
    )
    expect(source('./replayStore.ts')).toMatch(
      /REPLAY_MAX_ENTRIES = 300[\s\S]*REPLAY_MAX_BYTES = 3_000_000/,
    )
    expect(source('./tauri/nominatimService.ts')).toContain(
      'NOMINATIM_COUNTY_CACHE_MAX_ENTRIES = 4_096',
    )
  })
})
