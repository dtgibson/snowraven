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
