import { describe, it, expect, vi } from 'vitest'

// taxonomy-hasown-lookups — the v0.5.81 allowlist-lookup rule applied to this
// module's seven untrusted-key reads plus its four returned accumulators.
//
// This file carries the MALFORMED-INPUT CORPUS (all twelve Object.prototype
// member names, per CLAUDE.md v0.5.81) and the PER-GUARD DISCRIMINATION cases:
// each test that pins a guard says which bare-index revert turns it red. The
// snapshot here is BENIGN (no hostile own keys) so a prototype-member name is a
// genuine miss on every map; the own-`__proto__`-key transparency half lives in
// taxonomyService.pollutionProbe.test.ts.
//
// One lowercasing nuance, stated so the corpus reads correctly: getTaxonomyCodes
// lowercases both name axes before the bySci/byCom/byOrder/byComAll reads, and
// only 'constructor' and '__proto__' are all-lowercase Object.prototype members —
// so of the twelve, those two (plus case variants like 'Constructor') are the
// rows that DISCRIMINATE a bare index on the name paths. The other ten still
// belong in the corpus (they must resolve to nothing under both implementations).
// The CODE paths (resolveSpecies / collapseToSpeciesList) do NOT lowercase, so
// there all twelve raw names are live hostile keys and all twelve discriminate.

// JSON.parse-built snapshot (never an object literal — `{ __proto__: ... }` in
// source is special-cased by the language; JSON.parse produces real own keys,
// the same shape IndexedDB/CSV-derived data actually arrives in).
const SNAP = vi.hoisted(() => JSON.parse(`{
  "version": "hostile-keys-fixture-1",
  "generated": "2026-08-14",
  "bySci": { "turdus migratorius": "amerob", "setophaga coronata": "yerwar" },
  "byCom": { "american robin": "amerob", "yellow-rumped warbler": "yerwar" },
  "byOrder": { "american robin": 27616, "yellow-rumped warbler": 32035 },
  "byCode": { "amerob": "American Robin", "yerwar": "Yellow-rumped Warbler", "yerwar1": "Yellow-rumped Warbler (Myrtle)", "subx1": "Sub X", "emptynam1": "" },
  "reportAs": { "yerwar1": "yerwar", "subx1": "emptynam1" }
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

// No network, no real storage seam (same posture as taxonomyService.floor.test.ts).
vi.mock('./http', () => ({
  tauriFetch: () => Promise.reject(new Error('network blocked in hostile-keys test')),
}))
vi.mock('../storage', () => ({
  storage: { getApiKey: () => Promise.resolve(null) },
}))

import { getTaxonomyCodes, resolveSpecies, collapseToSpeciesList } from './taxonomyService'

// The twelve Object.prototype member names, pinned member by member (CLAUDE.md
// v0.5.81). The runtime-coverage test below guards the pin: if the engine ever
// exposes a member this list misses, that test fails and the corpus grows.
const PROTO_MEMBER_NAMES = [
  'constructor',
  '__proto__',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'toLocaleString',
  'propertyIsEnumerable',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
] as const

describe('prototype-member corpus (v0.5.81 malformed-input rows)', () => {
  it('the pinned twelve cover every Object.prototype member the runtime exposes', () => {
    for (const member of Object.getOwnPropertyNames(Object.prototype)) {
      expect(PROTO_MEMBER_NAMES).toContain(member)
    }
  })

  it('getTaxonomyCodes: hostile commonName axis resolves nothing (pins the byCom / byOrder / byComAll guards)', async () => {
    // Reverting the byCom bare index leaks 'constructor' / '__proto__' (a truthy
    // inherited member passes `if (code)`); reverting byOrder leaks them into
    // `orders` (a function passes `!= null`); reverting byComAll leaks them into
    // `formCodes`. Each unique sciName is unresolvable so only the comName axis
    // is under test.
    const { codes, orders, formCodes } = await getTaxonomyCodes(
      PROTO_MEMBER_NAMES.map(n => ({ commonName: n, scientificName: `nosuchus ${n.toLowerCase()}` }))
    )
    for (const n of PROTO_MEMBER_NAMES) {
      expect(Object.hasOwn(codes, n)).toBe(false)
      expect(Object.hasOwn(orders, n)).toBe(false)
      expect(Object.hasOwn(formCodes, n)).toBe(false)
    }
    expect(Object.keys(codes)).toEqual([])
    expect(Object.keys(orders)).toEqual([])
    expect(Object.keys(formCodes)).toEqual([])
  })

  it('getTaxonomyCodes: hostile scientificName axis resolves nothing (pins the bySci guard)', async () => {
    // Reverting the bySci bare index leaks the rows whose sciName lowercases to
    // 'constructor' / '__proto__' under a benign, unique commonName.
    const { codes, orders, formCodes } = await getTaxonomyCodes(
      PROTO_MEMBER_NAMES.map((n, i) => ({ commonName: `No Such Bird ${i}`, scientificName: n }))
    )
    expect(Object.keys(codes)).toEqual([])
    expect(Object.keys(orders)).toEqual([])
    expect(Object.keys(formCodes)).toEqual([])
  })

  it('case variants that LOWERCASE into a prototype member still resolve to nothing', async () => {
    // The realistic CSV shape: a title-case "Constructor" or shouty "__PROTO__"
    // lowercases into the trap key before the map reads.
    const { codes, orders, formCodes } = await getTaxonomyCodes([
      { commonName: 'Constructor', scientificName: 'zzz nosuchus one' },
      { commonName: '__PROTO__', scientificName: 'zzz nosuchus two' },
    ])
    expect(Object.keys(codes)).toEqual([])
    expect(Object.keys(orders)).toEqual([])
    expect(Object.keys(formCodes)).toEqual([])
  })

  it('resolveSpecies: all twelve raw codes fall through to identity (pins the reportAs L-norm and BOTH byCode guards)', async () => {
    // Codes are NOT lowercased, so every one of the twelve is a live hostile key
    // here. Reverting the `norm` reportAs bare index makes speciesCode a
    // function; reverting either byCode arm makes commonName a function. For a
    // hostile code norm === c (reportAs has no own hostile key), so this one
    // case turns red under EITHER byCode arm's revert individually.
    const out = await resolveSpecies([...PROTO_MEMBER_NAMES])
    for (const n of PROTO_MEMBER_NAMES) {
      expect(Object.hasOwn(out, n)).toBe(true)
      expect(out[n]).toEqual({ speciesCode: n, commonName: n })
    }
  })

  it('collapseToSpeciesList: all twelve drop out', async () => {
    // Deliberately NON-discriminating for the collapse's reportAs guard: a bare
    // index yields a truthy inherited member that speciesSet.has rejects exactly
    // as it rejects the raw string — both implementations drop the row. The
    // in-code comment at that guard names this file's discriminating cases; the
    // corpus row is still owed (the function must return [] on hostile input).
    expect(await collapseToSpeciesList([...PROTO_MEMBER_NAMES])).toEqual([])
  })
})

describe('per-guard discrimination (revert one bare index → the named case goes red)', () => {
  it('bySci guard: a sciName of `constructor` must not mint a code', async () => {
    const { codes, formCodes } = await getTaxonomyCodes([
      { commonName: 'No Such Bird', scientificName: 'constructor' },
    ])
    // Bare `cache.bySci['constructor']` returns the inherited Object constructor
    // (truthy) → `codes['No Such Bird']` would hold a function.
    expect(Object.hasOwn(codes, 'No Such Bird')).toBe(false)
    expect(Object.hasOwn(formCodes, 'No Such Bird')).toBe(false)
  })

  it('byCom guard: a commonName of `constructor` must not mint a code', async () => {
    const { codes } = await getTaxonomyCodes([
      { commonName: 'constructor', scientificName: 'nosuchus zzz' },
    ])
    expect(Object.hasOwn(codes, 'constructor')).toBe(false)
  })

  it('byOrder guard: a commonName of `constructor` must not mint a taxon order', async () => {
    const { orders } = await getTaxonomyCodes([
      { commonName: 'constructor', scientificName: 'nosuchus zzz' },
    ])
    // Bare `cache.byOrder['constructor']` returns a function, which passes the
    // `!= null` write gate.
    expect(Object.hasOwn(orders, 'constructor')).toBe(false)
  })

  it('byComAll guard: a commonName of `constructor` must not mint a form code', async () => {
    const { formCodes } = await getTaxonomyCodes([
      { commonName: 'constructor', scientificName: 'nosuchus zzz' },
    ])
    expect(Object.hasOwn(formCodes, 'constructor')).toBe(false)
  })

  it('resolveSpecies reportAs + byCode guards: `constructor` stays a string identity entry', async () => {
    const out = await resolveSpecies(['constructor'])
    const entry = out['constructor']
    expect(entry).toEqual({ speciesCode: 'constructor', commonName: 'constructor' })
    expect(typeof entry.speciesCode).toBe('string') // reportAs revert → function
    expect(typeof entry.commonName).toBe('string')  // either byCode arm revert → function
  })
})

describe('null-prototype accumulators (a `__proto__` key is stored, never a setter hit)', () => {
  it('codes/formCodes keep an own `__proto__` entry when the name resolves via sciName', async () => {
    // commonName `__proto__` with a resolvable scientificName forces the write
    // `codes['__proto__'] = 'amerob'`. On a plain `{}` that assignment hits the
    // inherited __proto__ SETTER — a string value is a silent no-op and the
    // entry vanishes. Reverting Object.create(null) on either accumulator turns
    // this red.
    const { codes, orders, formCodes } = await getTaxonomyCodes([
      { commonName: '__proto__', scientificName: 'Turdus migratorius' },
    ])
    expect(Object.hasOwn(codes, '__proto__')).toBe(true)
    expect(codes['__proto__']).toBe('amerob')
    expect(Object.hasOwn(formCodes, '__proto__')).toBe(true)
    expect(formCodes['__proto__']).toBe('amerob')
    // byOrder has no own '__proto__' in this fixture, so the DIRECT lookup is a
    // guarded miss — but since the taxonomy rename bridge
    // (a11y-taxonomy-screenshot-sweep) `orders` falls back through the resolved
    // code to the CURRENT common name, which does have an order. So the write
    // `orders['__proto__'] = 27616` now happens here, and this file pins the
    // orders-accumulator own-key write directly rather than deferring it to the
    // pollution probe file.
    //
    // That is the bridge behaving correctly, not a leak: an unrecognized common
    // name whose scientific name resolves is exactly the stale-export case, and
    // a hostile name is simply an unrecognized one. It is SAFE because the
    // accumulator has no prototype — on a plain `{}` this same assignment would
    // hit the inherited __proto__ setter and be a silent no-op, which is the
    // property asserted three lines below. Reverting Object.create(null) on
    // `orders` turns this red.
    expect(Object.hasOwn(orders, '__proto__')).toBe(true)
    expect(orders['__proto__']).toBe(27616)
    // The mechanism itself, pinned deliberately: these maps ship with no
    // prototype at all, which is what makes every write an own key.
    expect(Object.getPrototypeOf(codes)).toBe(null)
    expect(Object.getPrototypeOf(orders)).toBe(null)
    expect(Object.getPrototypeOf(formCodes)).toBe(null)
  })

  it('resolveSpecies stores a `__proto__` entry instead of swapping the returned map prototype', async () => {
    // Here the value is an OBJECT: on a plain `{}` the assignment would SET the
    // prototype of `out` to the entry (the entry "disappears" and its fields
    // turn up as inherited properties). Reverting Object.create(null) on `out`
    // turns both asserts red.
    const out = await resolveSpecies(['__proto__'])
    expect(Object.hasOwn(out, '__proto__')).toBe(true)
    expect(out['__proto__']).toEqual({ speciesCode: '__proto__', commonName: '__proto__' })
    expect(Object.getPrototypeOf(out)).toBe(null)
  })

  it('no global pollution: Object.prototype is untouched by hostile-key traffic', async () => {
    await getTaxonomyCodes([{ commonName: '__proto__', scientificName: 'Turdus migratorius' }])
    await resolveSpecies(['__proto__', 'constructor'])
    expect(Object.hasOwn(Object.prototype, 'speciesCode')).toBe(false)
    expect(Object.hasOwn(Object.prototype, 'amerob')).toBe(false)
    expect(({} as Record<string, unknown>)['speciesCode']).toBeUndefined()
  })
})

describe('fallthrough semantics preserved exactly (the brief\'s two named traps)', () => {
  it('resolveSpecies keeps the deliberate `||`: an own byCode entry with an EMPTY comName falls through', async () => {
    // subx1 -> reportAs -> emptynam1, whose byCode entry is "" (an own key with a
    // falsy value). The shipped `||` chain falls through to byCode['subx1'] =
    // 'Sub X'; a `??` rewrite would stop at "" and return an empty commonName.
    const out = await resolveSpecies(['subx1'])
    expect(out['subx1']).toEqual({ speciesCode: 'emptynam1', commonName: 'Sub X' })
  })

  it('getTaxonomyCodes keeps the `??` chain: bySci wins, byCom is the fallback, real names byte-identical', async () => {
    const { codes, orders, formCodes } = await getTaxonomyCodes([
      { commonName: 'American Robin', scientificName: 'Turdus migratorius' },
      { commonName: 'Yellow-rumped Warbler', scientificName: 'zzz nosuchus' }, // byCom fallback arm
    ])
    expect(codes).toEqual({ 'American Robin': 'amerob', 'Yellow-rumped Warbler': 'yerwar' })
    expect(orders).toEqual({ 'American Robin': 27616, 'Yellow-rumped Warbler': 32035 })
    expect(formCodes).toEqual({ 'American Robin': 'amerob', 'Yellow-rumped Warbler': 'yerwar' })
  })
})
