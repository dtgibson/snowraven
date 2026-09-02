import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8')

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
