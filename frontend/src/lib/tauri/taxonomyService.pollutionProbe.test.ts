import { describe, it, expect, vi } from 'vitest'

// taxonomy-hasown-lookups — the JSON.parse pollution probe (v0.5.81 rule: NEVER
// an object literal, because `{ __proto__: ... }` in source sets the prototype
// and creates no own key; JSON.parse produces the real own `__proto__` data key
// that persisted/parsed data can actually carry).
//
// This file proves the OTHER half of the guard contract from
// taxonomyService.hostileKeys.test.ts: for a GENUINE own `__proto__` key the
// hasOwn-true branch is transparent — resolution is byte-identical to any other
// own key (an own data property also shadows the inherited accessor, so these
// cases do NOT discriminate a guard revert; discrimination lives in the
// hostile-keys file and the fixture row in taxonomyCollapse.fixture.json). What
// this file DOES uniquely pin is the `orders` accumulator conversion: only a
// snapshot with an own byOrder `__proto__` key can force the write
// `orders['__proto__'] = <number>`, which a plain `{}` accumulator silently
// drops via the inherited setter.
//
// Scope note: byCode deliberately carries NO `__proto__`-NAMED entry — the
// byComAllFor inversion writes into a plain map and is exempt by the change
// brief (eBird's own published names; the bundled snapshot is a build-time
// trust boundary, v0.5.89). Feeding it a hostile NAME here would test an
// out-of-scope surface.
const SNAP = vi.hoisted(() => JSON.parse(`{
  "version": "pollution-probe-fixture-1",
  "generated": "2026-08-14",
  "bySci": { "turdus migratorius": "amerob", "__proto__": "protsci1" },
  "byCom": { "american robin": "amerob", "__proto__": "protcom1" },
  "byOrder": { "american robin": 27616, "__proto__": 424242 },
  "byCode": { "amerob": "American Robin", "protsci1": "Proto Sci Bird", "protcom1": "Proto Com Bird" },
  "reportAs": { "__proto__": "amerob" }
}`) as {
  version: string
  generated: string
  bySci: Record<string, string>
  byCom: Record<string, string>
  byOrder: Record<string, number>
  byCode: Record<string, string>
  reportAs: Record<string, string>
})

vi.mock('../../assets/ebird-taxonomy.json', () => ({ default: SNAP }))

vi.mock('./http', () => ({
  tauriFetch: () => Promise.reject(new Error('network blocked in pollution probe')),
}))
vi.mock('../storage', () => ({
  storage: { getApiKey: () => Promise.resolve(null) },
}))

import { getTaxonomyCodes, resolveSpecies, collapseToSpeciesList } from './taxonomyService'

describe('probe premise (guard-the-guard: the fixture really carries own __proto__ keys)', () => {
  it('JSON.parse produced own `__proto__` data keys, not prototype swaps', () => {
    expect(Object.hasOwn(SNAP.bySci, '__proto__')).toBe(true)
    expect(Object.hasOwn(SNAP.byCom, '__proto__')).toBe(true)
    expect(Object.hasOwn(SNAP.byOrder, '__proto__')).toBe(true)
    expect(Object.hasOwn(SNAP.reportAs, '__proto__')).toBe(true)
    // The maps are still ordinary objects (their OWN prototype was not swapped
    // by parsing) — the hostile key is data, not a corrupted container.
    expect(Object.getPrototypeOf(SNAP.byCom)).toBe(Object.prototype)
    // And parsing polluted nothing globally.
    expect(Object.hasOwn(Object.prototype, 'protcom1')).toBe(false)
  })
})

describe('guards are transparent for genuine own `__proto__` keys (hasOwn-true branch byte-identical)', () => {
  it('byCom + byOrder: a commonName of `__proto__` resolves through its own keys', async () => {
    const { codes, orders, formCodes } = await getTaxonomyCodes([
      { commonName: '__proto__', scientificName: 'zzz nosuchus' },
    ])
    expect(Object.hasOwn(codes, '__proto__')).toBe(true)
    expect(codes['__proto__']).toBe('protcom1')
    // THE orders-accumulator pin: this write only happens with an own byOrder
    // `__proto__` key; reverting `orders` to a plain `{}` drops it silently.
    expect(Object.hasOwn(orders, '__proto__')).toBe(true)
    expect(orders['__proto__']).toBe(424242)
    // byComAll (inverted from byCode NAMES) has no '__proto__' name → guarded
    // miss → falls back to the species code, exactly the shipped `??` chain.
    expect(Object.hasOwn(formCodes, '__proto__')).toBe(true)
    expect(formCodes['__proto__']).toBe('protcom1')
  })

  it('bySci: a scientificName of `__proto__` resolves through its own key', async () => {
    const { codes } = await getTaxonomyCodes([
      { commonName: 'zzz no bird', scientificName: '__proto__' },
    ])
    expect(codes['zzz no bird']).toBe('protsci1')
  })

  it('resolveSpecies: reportAs own `__proto__` normalizes to its parent and the entry is stored', async () => {
    const out = await resolveSpecies(['__proto__'])
    expect(Object.hasOwn(out, '__proto__')).toBe(true)
    expect(out['__proto__']).toEqual({ speciesCode: 'amerob', commonName: 'American Robin' })
    expect(Object.getPrototypeOf(out)).toBe(null)
  })

  it('collapseToSpeciesList: reportAs own `__proto__` collapses to its species parent', async () => {
    // Documented non-discrimination holds here too: an own data key shadows the
    // inherited accessor, so a bare index would read the same value. This case
    // proves the guarded collapse serves the own key, not that a revert fails.
    expect(await collapseToSpeciesList(['__proto__'])).toEqual([
      { speciesCode: 'amerob', commonName: 'American Robin' },
    ])
  })

  it('no global pollution after all hostile traffic', () => {
    expect(Object.hasOwn(Object.prototype, 'amerob')).toBe(false)
    expect(Object.hasOwn(Object.prototype, 'speciesCode')).toBe(false)
    expect(({} as Record<string, unknown>)['protsci1']).toBeUndefined()
  })
})
