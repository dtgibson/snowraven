// The alpha-code generator's pure core, driven over small IN-MEMORY fixtures
// (species-code-search, schema.md 5.1 to 5.4; QA-38, QA-39). No network and no
// real eBird download: every taxon below is written here, shaped like eBird's
// `ref/taxonomy/ebird` entries (the field names, the categories, a form's
// `reportAs`, the code lists exactly as eBird publishes them for these birds),
// so the suite states the derivation's rules rather than one revision's
// outcome. The committed asset is held by alphaCodesAsset.test.ts.
//
// "WRITES NOTHING" IS STRUCTURAL. The CLI calls `planTaxonomyRun` and writes
// only from a write plan, through the one `writeFile(` in the file, which comes
// after the plan (the source rows at the bottom). So every refusal here is a
// `stop` plan, and a `stop` plan is a run that wrote nothing.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ALPHA_CODES_GZIP_MAX_BYTES, MIN_ALPHA_CODE_ENTRIES, REVISION_MESSAGE,
  checkAlphaCodes, deriveAlphaCodes, deriveBundle, deriveSnapshotMaps, entryAlphaCodes,
  nameFormedCodes, planTaxonomyRun, sizeViolations,
  type TaxonLike,
} from '../../../scripts/lib/ebirdTaxonomyDerive.mjs'

// ── Fixture: real shapes ─────────────────────────────────────────────────────

function taxon(
  speciesCode: string, comName: string, category: string,
  codes: { band?: string[]; com?: string[]; sci?: string[]; reportAs?: string; order?: number } = {},
): TaxonLike {
  return {
    speciesCode, comName, category,
    sciName: `Genus ${speciesCode}`,
    taxonOrder: codes.order ?? 1,
    bandingCodes: codes.band ?? [],
    comNameCodes: codes.com ?? [],
    sciNameCodes: codes.sci ?? ['XXXX'],
    ...(codes.reportAs ? { reportAs: codes.reportAs } : {}),
  }
}

const FIXTURE: TaxonLike[] = [
  taxon('ostric2', 'Common Ostrich', 'species', { com: ['COOS'], sci: ['STCA'], order: 1 }),
  taxon('emu1', 'Emu', 'species', { com: ['EMU', 'COEM'], order: 2 }),
  taxon('ou', 'Ou', 'species', { band: ['OU'], order: 3 }),
  taxon('cangoo', 'Canada Goose', 'species', { band: ['CANG'], com: ['CAGO'], order: 4 }),
  taxon('cacgoo1', 'Cackling Goose', 'species', { band: ['CACG'], com: ['CAGO'], order: 5 }),
  taxon('y00470', 'Cackling/Canada Goose', 'slash', { band: ['CCGO'], com: ['CANG', 'CAGO', 'CACG'], order: 6 }),
  taxon('commer', 'Common Merganser', 'species', { band: ['COME'], com: ['GOOS'], order: 7 }),
  taxon('rocpig', 'Rock Pigeon', 'species', { band: ['ROPI'], com: ['RODO'], order: 8 }),
  taxon('cowpig1', 'Common Wood-Pigeon', 'species', { band: ['CWPI'], com: ['COWP', 'COWO'], order: 9 }),
  taxon('ruebus1', "R\u00FCppell's Bustard", 'species', { com: ['RUBU', 'RUKO', 'R\u00DCBU', 'R\u00DCKO'], order: 10 }),
  taxon('grnher', 'Green Heron', 'species', { band: ['GRHE'], com: ['NAGH', 'GBHE'], order: 11 }),
  taxon('grbher3', 'Great Blue Heron', 'species', { band: ['GBHE'], com: ['GBWH'], order: 12 }),
  taxon('yerwar', 'Yellow-rumped Warbler', 'species', { band: ['YRWA'], com: ['MYWA'], order: 13 }),
  taxon('myrwar', 'Yellow-rumped Warbler (Myrtle)', 'issf', { band: ['MYWA'], com: ['YRWA', 'MYWA'], reportAs: 'yerwar' }),
  taxon('audwar', "Yellow-rumped Warbler (Audubon's)", 'issf', { band: ['AUWA'], com: ['YRWA', 'MYWA'], reportAs: 'yerwar' }),
  taxon('yerwar1', 'Yellow-rumped Warbler (West Mexico)', 'issf', { com: ['AUWA', 'YRWA', 'MYWA'], reportAs: 'yerwar' }),
  taxon('x00980', 'Cape May x Yellow-rumped Warbler (hybrid)', 'hybrid', { com: ['YRWA', 'MYWA', 'CMWA'] }),
  taxon('vireo1', 'vireo sp.', 'spuh', { band: ['UNVI'] }),
  taxon('vireo2', 'vireo sp. (Red-eyed Vireo complex)', 'spuh'),
]

/** The asset the fixture must derive, value for value, in eBird's order. */
const EXPECTED_CODES: Record<string, string> = {
  'common ostrich': 'COOS',
  'emu': 'EMU',
  'ou': 'OU',
  'canada goose': 'CANG CAGO',
  'cackling goose': 'CACG CAGO',
  'cackling/canada goose': 'CCGO',
  'common merganser': 'COME',
  'rock pigeon': 'ROPI',
  'common wood-pigeon': 'CWPI COWO COWP',
  "r\u00FCppell's bustard": 'RUBU R\u00DCBU',
  'green heron': 'GRHE',
  'great blue heron': 'GBHE',
  'yellow-rumped warbler': 'YRWA',
  'yellow-rumped warbler (myrtle)': 'MYWA YRWA',
  "yellow-rumped warbler (audubon's)": 'AUWA YRWA',
  'yellow-rumped warbler (west mexico)': 'YRWA',
  'cape may x yellow-rumped warbler (hybrid)': '',
  'vireo sp.': 'UNVI',
  'vireo sp. (red-eyed vireo complex)': '',
}

const SNAPSHOT_VERSION = '2027'
const plan = (live: TaxonLike[], extra: Partial<Parameters<typeof planTaxonomyRun>[0]> = {}) =>
  planTaxonomyRun({ live, committed: null, version: SNAPSHOT_VERSION, generated: '2026-10-10', minEntries: 1, ...extra })
const messages = (p: ReturnType<typeof planTaxonomyRun>) => (p.mode === 'stop' ? p.messages.join('\n') : '')

// ── The American-name rule (QA-38, schema.md 5.2's pinned table) ─────────────

describe('nameFormedCodes: the codes the shown name forms (schema.md 5.2)', () => {
  const ROWS: [string, string[], string[]][] = [
    ['American Robin', ['AMRO'], []],
    ['Yellow-rumped Warbler', ['YRWA', 'YEWA'], ['MYWA']],
    ["Yellow-rumped Warbler (Audubon's)", ['YRWA'], ['AUWA']],
    ['Great Blue Heron', ['GBHE'], []],
    ['Green Heron', ['GRHE'], ['GBHE']],
    ['Common Merganser', ['COME'], ['GOOS']],
    ['Rock Pigeon', ['ROPI'], ['RODO']],
    ['Common Wood-Pigeon', ['CWPI', 'COWO', 'COWP'], []],
    ['Black-crowned Night Heron', ['BCNH'], []],
    ["R\u00FCppell's Bustard", ['R\u00DCBU', 'RUBU'], ['RUKO', 'R\u00DCKO']],
    ["Anna's Hummingbird", ['ANHU'], []],
    ['Emu', ['EMU'], ['COEM']],
    ['Ou', ['OU'], []],
    ['Kea', ['KEA'], []],
    ['Cackling/Canada Goose', ['CCGO'], ['CAGO', 'CANG']],
    ['Cape May x Yellow-rumped Warbler (hybrid)', ['CMXY'], ['YRWA', 'CMWA', 'MYWA']],
    // The other two hyphen conventions eBird uses on shown names (2.7).
    ['Spotted Whistling-Duck', ['SPWD', 'SWDU'], []],
    ['Greater Prairie-Chicken', ['GRPC', 'GPCH'], []],
    // A form's qualifier never forms a code (decisions.md 5).
    ['Sharp-shinned Hawk (Rufous-thighed)', ['SSHA'], ['RTHA']],
  ]

  it.each(ROWS)('%s', (name, include, exclude) => {
    const formed = nameFormedCodes(name)
    for (const c of include) expect(formed.has(c), `${name} forms ${c}`).toBe(true)
    for (const c of exclude) expect(formed.has(c), `${name} must not form ${c}`).toBe(false)
  })

  it('a curly apostrophe reads like a straight one', () => {
    expect(nameFormedCodes('Anna\u2019s Hummingbird')).toEqual(nameFormedCodes("Anna's Hummingbird"))
  })
})

describe('entryAlphaCodes: the filter (decisions.md 2)', () => {
  const byName = (n: string) => FIXTURE.find(t => t.comName === n)!

  it('keeps every banding code, first, and never edits one', () => {
    expect(entryAlphaCodes(byName('Common Merganser'))).toEqual(['COME'])
    expect(entryAlphaCodes(byName("Yellow-rumped Warbler (Audubon's)"))).toEqual(['AUWA', 'YRWA'])
  })

  it('keeps a comNameCodes member the shown name forms, after the banding codes', () => {
    expect(entryAlphaCodes(byName('Canada Goose'))).toEqual(['CANG', 'CAGO'])
    expect(entryAlphaCodes(byName('Common Wood-Pigeon'))).toEqual(['CWPI', 'COWO', 'COWP'])
  })

  it('drops codes from other names', () => {
    expect(entryAlphaCodes(byName('Green Heron'))).toEqual(['GRHE'])            // NAGH, GBHE
    expect(entryAlphaCodes(byName('Rock Pigeon'))).toEqual(['ROPI'])            // RODO
    expect(entryAlphaCodes(byName("R\u00FCppell's Bustard"))).toEqual(['RUBU', 'R\u00DCBU']) // RUKO, R\u00DCKO
    expect(entryAlphaCodes(byName('Yellow-rumped Warbler'))).toEqual(['YRWA'])  // MYWA
  })

  it('never reads sciNameCodes', () => {
    expect(entryAlphaCodes(byName('Common Ostrich'))).toEqual(['COOS'])          // STCA
  })

  it('sorts each group by code point, so a fetch that reorders eBird\'s arrays derives the same codes', () => {
    // Measured 2026-10-10: two fetches an hour apart listed the same comNameCodes
    // in a different order on 1,164 entries.
    for (const t of FIXTURE) {
      const reordered = { ...t, bandingCodes: [...(t.bandingCodes as string[])].reverse(), comNameCodes: [...(t.comNameCodes as string[])].reverse() }
      expect(entryAlphaCodes(reordered), t.comName).toEqual(entryAlphaCodes(t))
    }
    expect(deriveAlphaCodes([...FIXTURE].map(t => ({ ...t, comNameCodes: [...(t.comNameCodes as string[])].reverse() })), { version: SNAPSHOT_VERSION, generated: 'g' }).codes)
      .toEqual(EXPECTED_CODES)
  })

  it('collapses a code repeated within one entry', () => {
    expect(entryAlphaCodes(byName('Yellow-rumped Warbler (Myrtle)'))).toEqual(['MYWA', 'YRWA'])
  })
})

describe('deriveAlphaCodes over a fixture of real shapes', () => {
  it('derives exactly the expected asset, key order included', () => {
    const asset = deriveAlphaCodes(FIXTURE, { version: SNAPSHOT_VERSION, generated: '2026-10-10' })
    expect(asset.v).toBe(1)
    expect(asset.version).toBe(SNAPSHOT_VERSION)
    expect(Object.keys(asset)).toEqual(['v', 'version', 'generated', 'codes'])
    expect(asset.codes).toEqual(EXPECTED_CODES)
    expect(Object.keys(asset.codes)).toEqual(Object.keys(EXPECTED_CODES))
  })

  it('the fixture plans as a write (it is acceptable data)', () => {
    const p = plan(FIXTURE)
    expect(messages(p)).toBe('')
    expect(p.mode).toBe('all')
  })

  it('accepts R\u00DCBU, B\u00D6SP, OU and EMU', () => {
    const live = [...FIXTURE, taxon('bohspa1', 'Synthetic Sparrow', 'species', { band: ['R\u00DCBU', 'B\u00D6SP', 'OU', 'EMU'] })]
    expect(messages(plan(live))).toBe('')
  })
})

// ── Refusals (QA-38): each one a `stop`, so nothing is written ───────────────

describe('the generator refuses, writing nothing', () => {
  const swap = (name: string, next: Partial<TaxonLike>): TaxonLike[] =>
    FIXTURE.map(t => (t.comName === name ? { ...t, ...next } : t))

  it('a short entry count, at the default floor', () => {
    const p = planTaxonomyRun({ live: FIXTURE, committed: null, version: SNAPSHOT_VERSION, generated: '2026-10-10' })
    expect(p.mode).toBe('stop')
    expect(messages(p)).toMatch(new RegExp(`I3: \\d+ entries carry a code, fewer than the floor of ${MIN_ALPHA_CODE_ENTRIES}`))
  })

  it('a species with both code fields empty', () => {
    expect(messages(plan(swap('Rock Pigeon', { bandingCodes: [], comNameCodes: [] })))).toMatch(/I5: species "rock pigeon" has no code/)
  })

  it('a species whose codes all come from other names (I5 after filtering)', () => {
    expect(messages(plan(swap('Rock Pigeon', { bandingCodes: [], comNameCodes: ['RODO'] })))).toMatch(/I5: species "rock pigeon" has no code/)
  })

  it.each([['R\u00C4BU'], ['AB1'], ['A'], ['ABCDE'], ['abcd'], ['RU\u0308BU']])('the code %j', (code) => {
    expect(messages(plan(swap('Rock Pigeon', { bandingCodes: ['ROPI', code] })))).toMatch(/I6: "rock pigeon" carries/)
  })

  it('two names equal ignoring case', () => {
    const live = [...FIXTURE, taxon('rocpig9', 'ROCK PIGEON', 'issf', { band: ['ROPI'] })]
    expect(messages(plan(live))).toMatch(/I4: "Rock Pigeon" and "ROCK PIGEON" are equal ignoring case/)
  })

  it('a name equal to an Object.prototype member', () => {
    const live = [...FIXTURE, taxon('constr1', 'constructor', 'species', { band: ['CONS'] })]
    expect(messages(plan(live))).toMatch(/I8: "constructor" is an own key/)
  })

  it('a version that differs from the snapshot written in the same run', () => {
    const asset = deriveAlphaCodes(FIXTURE, { version: '2026', generated: '2026-10-10' })
    const bundle = deriveBundle(FIXTURE, { version: SNAPSHOT_VERSION, generated: '2026-10-10' })
    const out = checkAlphaCodes(asset, {
      speciesNames: Object.keys(bundle.byCom),
      publishedNames: Object.values(bundle.byCode).map(n => n.toLowerCase()),
      snapshotVersion: SNAPSHOT_VERSION,
      minEntries: 1,
    })
    expect(out.join('\n')).toMatch(/I1: version "2026" does not equal the snapshot version "2027"/)
  })

  it('a filter mutated to keep everything (I10)', () => {
    const keepAll = (t: TaxonLike) => [...new Set([...(t.bandingCodes as string[]), ...(t.comNameCodes as string[])])]
    expect(messages(plan(FIXTURE, { entryCodes: keepAll }))).toMatch(/I10: "Green Heron" keeps NAGH/)
  })

  it('a filter mutated to drop banding codes (I10)', () => {
    const noBanding = (t: TaxonLike) => entryAlphaCodes({ ...t, bandingCodes: [] })
    expect(messages(plan(FIXTURE, { entryCodes: noBanding }))).toMatch(/I10: "Common Merganser" drops its banding code COME/)
  })

  it('a name with five hyphenated tokens (I11)', () => {
    const live = [...FIXTURE, taxon('hyph5', 'A-a B-b C-c D-d E-e', 'species', { band: ['ABCD'] })]
    expect(messages(plan(live))).toMatch(/I11: "A-a B-b C-c D-d E-e" has 5 hyphenated tokens/)
  })

  it('an asset over the gzip budget (I9)', () => {
    let seed = 1
    const noise = Array.from({ length: ALPHA_CODES_GZIP_MAX_BYTES * 2 }, () => {
      // xorshift32: an LCG's low bits cycle quickly and compress well, which
      // would make this row measure the generator rather than the bound.
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
      return String.fromCharCode(33 + ((seed >>> 0) % 90))
    }).join('')
    expect(sizeViolations(noise).join('')).toMatch(/I9: \d+ bytes gzipped/)
    expect(sizeViolations('{"v":1}')).toEqual([])
  })
})

// ── The revision check (QA-39, FR-05, OQ-05, OQ-06) ──────────────────────────

describe('the revision check and the write plan', () => {
  const committed = (version: string, live = FIXTURE) =>
    JSON.stringify(deriveBundle(live, { version, generated: '2026-06-20' }))

  it('equal maps under the same version give codes-only, which writes the asset alone', () => {
    const p = plan(FIXTURE, { committed: committed(SNAPSHOT_VERSION) })
    expect(p.mode).toBe('codes-only')
  })

  it('a reorder with the same content is not a revision', () => {
    const p = plan(FIXTURE, { committed: committed(SNAPSHOT_VERSION, [...FIXTURE].reverse()) })
    expect(p.mode).toBe('codes-only')
  })

  it('one byCom entry changed under the same version stops with the revision message', () => {
    const live = FIXTURE.map(t => (t.comName === 'Rock Pigeon' ? { ...t, comName: 'Rock Dove' } : t))
    const p = plan(live, { committed: committed(SNAPSHOT_VERSION) })
    expect(p.mode).toBe('stop')
    expect(messages(p)).toContain(REVISION_MESSAGE)
    expect(messages(p)).toMatch(/byCom: 1 of \d+ live keys differ/)
  })

  it('an advanced version writes every asset', () => {
    expect(plan(FIXTURE, { committed: committed('2026') }).mode).toBe('all')
  })

  it('an absent snapshot writes every asset', () => {
    expect(plan(FIXTURE, { committed: null }).mode).toBe('all')
  })

  it('an unparseable committed snapshot stops', () => {
    const p = plan(FIXTURE, { committed: '{"version":"2027",' })
    expect(p.mode).toBe('stop')
    expect(messages(p)).toMatch(/not parseable JSON/)
  })
})

describe('deriveSnapshotMaps: the move from the CLI is verbatim', () => {
  it('derives the five hand-written maps, species-only name maps and all-category code maps', () => {
    const live = [
      taxon('aaa', 'Alpha Bird', 'species', { order: 10.7 }),
      taxon('bbb', 'Alpha Bird (Form)', 'issf', { reportAs: 'aaa' }),
      taxon('ccc', 'alpha sp.', 'spuh'),
      { ...taxon('', 'No Code', 'species') },
    ]
    expect(deriveSnapshotMaps(live)).toEqual({
      bySci: { 'genus aaa': 'aaa' },
      byCom: { 'alpha bird': 'aaa' },
      byOrder: { 'alpha bird': 10 },
      byCode: { aaa: 'Alpha Bird', bbb: 'Alpha Bird (Form)', ccc: 'alpha sp.' },
      reportAs: { bbb: 'aaa' },
    })
    expect(Object.keys(deriveBundle(live, { version: 'v', generated: 'g' })))
      .toEqual(['version', 'generated', 'bySci', 'byCom', 'byOrder', 'byCode', 'reportAs'])
  })
})

// ── The CLI writes only after the plan, through one call ─────────────────────

describe('scripts/build-ebird-taxonomy.mjs: nothing is written before every check', () => {
  const cli = readFileSync(new URL('../../../scripts/build-ebird-taxonomy.mjs', import.meta.url), 'utf8')
  const code = cli.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('has exactly one writeFile( call, and it comes after planTaxonomyRun(', () => {
    expect(code.match(/writeFile\(/g) ?? []).toHaveLength(1)
    const plannedAt = code.indexOf('planTaxonomyRun(')
    expect(plannedAt).toBeGreaterThan(-1)
    expect(code.indexOf('writeFile(')).toBeGreaterThan(plannedAt)
  })

  it('its header names the new asset and the shared core', () => {
    expect(cli).toContain('frontend/src/assets/ebird-alpha-codes.json')
    expect(cli).toContain('scripts/lib/ebirdTaxonomyDerive.mjs')
  })
})
