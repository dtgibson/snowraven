// The splits-and-lumps generator's pure core, driven over small IN-MEMORY
// fixtures (taxonomic-splits-lumps, schema.md 5.2; QA-02, QA-03, QA-04). Never
// real Cornell data: every CSV below is written here, shaped like the real
// files (Cornell's taxonomy layout, the integrated checklist's year-suffixed
// headers), so the suite states the derivation's rules rather than one year's
// outcome. The committed asset is held by taxonomyHistoryAsset.test.ts.
//
// The fixture is a chain across two updates (QA-03): in 2023 Alpha Bird (xxx)
// is split into Beta Bird (yyy) and Gamma Bird (zzz), creating the slash
// Beta/Gamma Bird on the parent's code; in 2024 Beta Bird is lumped with Delta
// Bird (www) into Vee Bird (vvv). Every fail-closed row mutates ONE thing in it.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import {
  deriveHistory, checkHistory, HistoryInputError, parseCsv, changeTokens, splitSubject, tally,
  type PublishedRow, type SnapshotLike, type HistoryLike,
} from '../../../scripts/lib/taxonomyHistoryDerive.mjs'

const TAX_HEAD = 'TAXON_ORDER,CATEGORY,SPECIES_CODE,PRIMARY_COM_NAME,SCI_NAME,REPORT_AS'

const TAX_2022 = [
  TAX_HEAD,
  '1,species,www,Delta Bird,Genus delta,',
  '2,species,xxx,Alpha Bird,Genus alpha,',
  '3,issf,yyy,Alpha Bird (Beta),Genus alpha beta,xxx',
  '4,issf,zzz,Alpha Bird (Gamma),Genus alpha gamma,xxx',
].join('\r\n')

const TAX_2023 = [
  TAX_HEAD,
  '1,species,www,Delta Bird,Genus delta,',
  '2,species,yyy,Beta Bird,Genus beta,',
  '3,species,zzz,Gamma Bird,Genus gamma,',
  '4,slash,xxx,Beta/Gamma Bird,Genus beta/gamma,',
].join('\r\n')

const TAX_2024 = [
  TAX_HEAD,
  '1,species,vvv,Vee Bird,Genus beta,',
  '2,issf,www,Vee Bird (Delta),Genus beta delta,vvv',
  '3,issf,yyy,Vee Bird (Beta),Genus beta beta,vvv',
  '4,species,zzz,Gamma Bird,Genus gamma,',
  '5,slash,xxx,Beta/Gamma Bird,Genus beta/gamma,',
].join('\r\n')

const INT_2022 = [
  'sort v2022,category,English name,scientific name',
  '1,species,Delta Bird,Genus delta',
  '2,species,Alpha Bird,Genus alpha',
].join('\r\n')

const SPLIT_TEXT = '"Alpha Bird Genus alpha is split into Beta Bird Genus beta and Gamma Bird Genus gamma."'
const INT_2023 = [
  '\ufeffsort v2023,Clements v2023 change,text for website v2023,category,English name,scientific name,sort v2022',
  '1,,,species,Delta Bird,Genus delta,1',
  `2,split,${SPLIT_TEXT},species,Beta Bird,Genus beta,`,
  `3,split; range,${SPLIT_TEXT},species,Gamma Bird,Genus gamma,`,
].join('\r\n')

const INT_2024 = [
  'sort v2024,Clements v2024b change,text for website v2024b,category,English name,scientific name,sort_v2023',
  '1,lump,"Beta Bird Genus beta and Delta Bird Genus delta are lumped as Vee Bird Genus beta.",species,Vee Bird,Genus beta,2',
  '2,,,species,Gamma Bird,Genus gamma,3',
].join('\r\n')

/** The "current" snapshot for the fixture: the 2024 taxonomy's five maps. */
const SNAPSHOT: SnapshotLike = {
  version: 'T1',
  byCode: { vvv: 'Vee Bird', www: 'Vee Bird (Delta)', yyy: 'Vee Bird (Beta)', zzz: 'Gamma Bird', xxx: 'Beta/Gamma Bird' },
  byCom: { 'vee bird': 'vvv', 'gamma bird': 'zzz' },
  bySci: { 'genus beta': 'vvv', 'genus gamma': 'zzz' },
}

const PUBLISHED: Record<number, PublishedRow> = {
  2023: { published: '2023-10-24', mark: 'measured' },
  2024: { published: '2024-10-22', mark: 'measured' },
}

type Files = Record<string, string>
const BASE: Files = {
  'ebird-taxonomy-v2022.csv': TAX_2022,
  'ebird-taxonomy-v2023.csv': TAX_2023,
  'ebird-taxonomy-v2024.csv': TAX_2024,
  'clements-integrated-v2022.csv': INT_2022,
  'clements-integrated-v2023.csv': INT_2023,
  'clements-integrated-v2024.csv': INT_2024,
}

function run(files: Files = BASE, published: Record<number, PublishedRow> = PUBLISHED) {
  return deriveHistory({
    files: Object.entries(files).map(([name, text]) => ({ name, text })),
    snapshot: SNAPSHOT,
    generated: '2026-09-30',
    published,
  }).history
}

/** Assert the run fails closed with a message naming `what`, and returns nothing. */
function expectFailsClosed(files: Files, what: RegExp, published = PUBLISHED) {
  let out: HistoryLike | undefined
  let err: unknown
  try { out = run(files, published) } catch (e) { err = e }
  expect(out, 'no object is returned').toBeUndefined()
  expect(err).toBeInstanceOf(HistoryInputError)
  expect((err as Error).message).toMatch(what)
}

const replace = (name: string, from: string, to: string): Files => {
  expect(BASE[name].includes(from), `fixture mutation "${from}" must match`).toBe(true)
  return { ...BASE, [name]: BASE[name].replace(from, to) }
}

describe('the chained fixture (QA-02, QA-03)', () => {
  const h = run()

  it('covers exactly the two supplied updates, with coverage derived from them', () => {
    expect(h.updates).toEqual([
      { year: 2023, published: '2023-10-24' },
      { year: 2024, published: '2024-10-22' },
    ])
    expect(h.coverage).toEqual({ earliest: h.updates[0], latest: h.updates[1] })
    expect(h.snapshot).toBe('T1')
    expect(h.inputs).toEqual(Object.keys(BASE).sort())
  })

  it('derives the 2023 split with its slash, and the 2024 lump, each dated by its own update', () => {
    expect(h.events).toHaveLength(2)
    const [split, lump] = h.events
    expect(split).toMatchObject({ kind: 'split', year: 2023, published: '2023-10-24' })
    expect(split.before).toEqual([{ code: 'xxx', sci: 'Genus alpha', com: 'Alpha Bird', retired: true }])
    // Beta Bird is no longer current (the 2024 lump retired it), so it keeps
    // its own year's names; Gamma Bird is current and carries the snapshot's.
    expect(split.after).toEqual([
      { code: 'yyy', sci: 'Genus beta', com: 'Beta Bird' },
      { code: 'zzz', sci: 'Genus gamma', com: 'Gamma Bird' },
    ])
    expect(split.slashes).toEqual([{ code: 'xxx', sci: 'Genus beta/gamma', com: 'Beta/Gamma Bird' }])

    expect(lump).toMatchObject({ kind: 'lump', year: 2024, published: '2024-10-22', slashes: [] })
    expect(lump.before).toEqual([
      { code: 'www', sci: 'Genus delta', com: 'Delta Bird', retired: true },
      { code: 'yyy', sci: 'Genus beta', com: 'Beta Bird', retired: true },
    ])
    expect(lump.after).toEqual([{ code: 'vvv', sci: 'Genus beta', com: 'Vee Bird' }])
  })

  it('keeps the chain recoverable: Y is an after entry of the split and a before entry of the lump (QA-03)', () => {
    const [split, lump] = h.events
    expect(split.after.some(a => a.code === 'yyy')).toBe(true)
    expect(lump.before.some(b => b.code === 'yyy')).toBe(true)
    expect(split.published < lump.published).toBe(true)
  })

  it('tallies each update the way eBird announces it', () => {
    expect(tally(h.events.filter(e => e.year === 2023))).toEqual({ gained: 1, lost: 0 })
    expect(tally(h.events.filter(e => e.year === 2024))).toEqual({ gained: 0, lost: 1 })
  })

  it('passes the shared invariant checker CI runs', () => {
    expect(checkHistory(h, SNAPSHOT)).toBe(true)
  })

  it('a no-input run yields the stated empty coverage and zero events (QA-02)', () => {
    const empty = run({})
    expect(empty.updates).toEqual([])
    expect(empty.coverage).toBeNull()
    expect(empty.events).toEqual([])
  })

  it('a run over only the later update covers only that update', () => {
    const only2024 = run({
      'ebird-taxonomy-v2023.csv': TAX_2023, 'ebird-taxonomy-v2024.csv': TAX_2024,
      'clements-integrated-v2023.csv': INT_2023, 'clements-integrated-v2024.csv': INT_2024,
    })
    expect(only2024.updates.map(u => u.year)).toEqual([2024])
    expect(only2024.coverage?.earliest.year).toBe(2024)
    expect(only2024.events.map(e => e.kind)).toEqual(['lump'])
  })
})

describe('the derivation rules', () => {
  it('a daughter with no taxonomy or sort link is resolved from the split subject of its sentence', () => {
    // Beta Bird's code is new, so R1 and R2 have nothing; the sentence names
    // Alpha Bird as the subject and Delta Bird (unchanged) after it.
    const files = {
      ...BASE,
      'ebird-taxonomy-v2022.csv': TAX_2022.replace('3,issf,yyy,Alpha Bird (Beta),Genus alpha beta,xxx\r\n', ''),
      'clements-integrated-v2023.csv': INT_2023.replace(SPLIT_TEXT, '"Alpha Bird Genus alpha is split into Beta Bird Genus beta and Gamma Bird Genus gamma, compare Delta Bird Genus delta."'),
    }
    const h = run(files)
    expect(h.events[0].after.map(a => a.code)).toEqual(['yyy', 'zzz'])
  })

  it('"family split" is not a split token, and tokens split on ";" and ","', () => {
    expect(changeTokens('family split')).toEqual(['family split'])
    expect(changeTokens('split; range')).toEqual(['split', 'range'])
    expect(changeTokens('split, range')).toEqual(['split', 'range'])
    expect(changeTokens('name change - sciname; split')).toContain('split')
  })

  it('the split subject ends at a real sentence boundary, never at an abbreviated genus', () => {
    expect(splitSubject('Move taxa. Polytypic P. alpha Genus alpha is split into two.')).toBe('Polytypic P. alpha Genus alpha ')
    expect(splitSubject('Selayar Whistler Genus beta is split from polytypic G. alpha (now gamma). Change names.')).toBe(' polytypic G. alpha (now gamma)')
    expect(splitSubject('No split sentence here')).toBeNull()
  })

  it('parses RFC 4180 quoting, doubled quotes, embedded newlines, CRLF and a BOM', () => {
    expect(parseCsv('\ufeffa,"b,c","d ""e""\r\nf"\r\n,,\r\ng,h,i')).toEqual([
      ['a', 'b,c', 'd "e"\r\nf'],
      ['g', 'h', 'i'],
    ])
  })
})

describe('the generator fails closed and returns nothing (QA-04, schema.md 4.3)', () => {
  it('an unrecognised input file name', () => {
    expectFailsClosed({ ...BASE, 'eBird_taxonomy_v2024.csv': TAX_2024 }, /unrecognised input file name/)
  })

  it('a missing required header', () => {
    expectFailsClosed(replace('ebird-taxonomy-v2023.csv', 'REPORT_AS', 'REPORTED_AS'), /missing required column REPORT_AS/)
    expectFailsClosed(replace('clements-integrated-v2023.csv', 'English name', 'Common name'), /missing required column English name/)
  })

  it('a U+FFFD in a name cell (a non-UTF-8 file read as UTF-8)', () => {
    expectFailsClosed(replace('ebird-taxonomy-v2023.csv', 'Beta Bird', 'Beta B\ufffdrd'), /U\+FFFD/)
  })

  it('a duplicate species scientific name within a taxonomy file', () => {
    expectFailsClosed(replace('ebird-taxonomy-v2023.csv', '3,species,zzz,Gamma Bird,Genus gamma,', '3,species,zzz,Gamma Bird,Genus beta,'), /duplicate species scientific name/)
  })

  it('an integrated species row that joins no taxonomy species', () => {
    expectFailsClosed(replace('clements-integrated-v2023.csv', 'species,Gamma Bird,Genus gamma,', 'species,Gamma Bird,Genus epsilon,'), /joins no 2023 taxonomy species/)
  })

  it('a split daughter with no parent candidate', () => {
    const files = {
      ...BASE,
      'ebird-taxonomy-v2022.csv': TAX_2022.replace('3,issf,yyy,Alpha Bird (Beta),Genus alpha beta,xxx\r\n', ''),
      'clements-integrated-v2023.csv': INT_2023.replace(SPLIT_TEXT, '"A reshuffle."'),
    }
    expectFailsClosed(files, /Beta Bird.*no parent candidates/)
  })

  it('a split daughter whose sentence names two parents', () => {
    const files = {
      ...BASE,
      'ebird-taxonomy-v2022.csv': TAX_2022.replace('3,issf,yyy,Alpha Bird (Beta),Genus alpha beta,xxx\r\n', ''),
      'ebird-taxonomy-v2023.csv': TAX_2023.replace('1,species,www,Delta Bird,Genus delta,', '1,slash,www,Delta/Beta Bird,Genus delta/beta,'),
      'clements-integrated-v2023.csv': INT_2023
        .replace('1,,,species,Delta Bird,Genus delta,1\r\n', '')
        .replace(SPLIT_TEXT, '"Alpha Bird Genus alpha and Delta Bird Genus delta are split into Beta Bird Genus beta and Gamma Bird Genus gamma."'),
    }
    expectFailsClosed(files, /Beta Bird.*2 parent candidates/)
  })

  it('a daughter whose taxonomy link and previous-sort link disagree', () => {
    // Beta Bird's previous-sort now points at Delta Bird's row.
    expectFailsClosed(replace('clements-integrated-v2023.csv', 'species,Beta Bird,Genus beta,', 'species,Beta Bird,Genus beta,1'), /conflicting parents/)
  })

  it('a split group with one daughter', () => {
    // Gamma Bird is no longer a daughter of Alpha Bird: its previous code was a
    // group of Delta Bird instead, and its row is not annotated.
    const files = {
      ...BASE,
      'ebird-taxonomy-v2022.csv': TAX_2022.replace('4,issf,zzz,Alpha Bird (Gamma),Genus alpha gamma,xxx', '4,issf,zzz,Delta Bird (Gamma),Genus delta gamma,www'),
      'clements-integrated-v2023.csv': INT_2023.replace(`3,split; range,${SPLIT_TEXT}`, '3,,'),
    }
    expectFailsClosed(files, /split of "Alpha Bird" \(xxx\) has 1 daughter/)
  })

  it('a lump with fewer than two before-side species', () => {
    // Delta Bird stays a species in 2024, so the lump has only Beta Bird.
    const files = {
      ...BASE,
      'ebird-taxonomy-v2024.csv': TAX_2024.replace('2,issf,www,Vee Bird (Delta),Genus beta delta,vvv', '2,species,www,Delta Bird,Genus delta,'),
    }
    expectFailsClosed(files, /lump into "Vee Bird" \(vvv\) has 1 before-side species/)
  })

  it('a covered year with no published date, or with an assumed one', () => {
    expectFailsClosed(BASE, /no published date for the 2024 update/, { 2023: PUBLISHED[2023] })
    expectFailsClosed(BASE, /marked "assumed"/, { ...PUBLISHED, 2024: { published: '2024-10-22', mark: 'assumed' } })
  })

  it('a year whose events do not reproduce eBird\'s announced tally', () => {
    expectFailsClosed(BASE, /tally 1 gained .* but eBird announced 2/, {
      ...PUBLISHED, 2023: { ...PUBLISHED[2023], announced: { gained: 2, lost: 0 } },
    })
  })

  it('non-consecutive covered years', () => {
    // 2021's files make 2022 coverable, while 2023's checklist is supplied
    // WITHOUT its change columns (as a previous-year file only), so 2023 is
    // not covered and the covered years are 2022 then 2024.
    const files: Files = {
      ...BASE,
      'ebird-taxonomy-v2021.csv': TAX_2022,
      'clements-integrated-v2021.csv': INT_2022.replace('sort v2022', 'sort v2021'),
      'clements-integrated-v2022.csv': INT_2023
        .replace('sort v2023', 'sort v2022').replace('sort v2022\r\n', 'sort v2021\r\n')
        .replace('Clements v2023 change', 'Clements v2022 change').replace('text for website v2023', 'text for website v2022'),
      'clements-integrated-v2023.csv': INT_2022.replace('sort v2022', 'sort v2023'),
    }
    expectFailsClosed(files, /covered years are not consecutive eBird updates: 2022 then 2024/, {
      ...PUBLISHED, 2022: { published: '2022-11-01', mark: 'measured' },
    })
  })

  it('an input no covered year needs', () => {
    expectFailsClosed({ ...BASE, 'ebird-taxonomy-v2019.csv': TAX_2022 }, /ebird-taxonomy-v2019.csv is not needed/)
  })

  it('an after-side code the snapshot no longer holds as a species, that no later event retires (I5)', () => {
    // Caught by the shared checker inside the run, before anything is returned.
    expectFailsClosedWithSnapshot({ ...SNAPSHOT, byCom: { 'vee bird': 'vvv' }, bySci: { 'genus beta': 'vvv' } }, /after code "zzz" is not a species in the snapshot/)
  })
})

function expectFailsClosedWithSnapshot(snapshot: SnapshotLike, what: RegExp) {
  let err: unknown
  let out: unknown
  try {
    out = deriveHistory({
      files: Object.entries(BASE).map(([name, text]) => ({ name, text })),
      snapshot, generated: '2026-09-30', published: PUBLISHED,
    })
  } catch (e) { err = e }
  expect(out).toBeUndefined()
  expect(err).toBeInstanceOf(HistoryInputError)
  expect((err as Error).message).toMatch(what)
}

describe('the shared invariant checker rejects each incomplete event (FR-01, I2 to I4)', () => {
  const good = run()
  const mutate = (fn: (h: HistoryLike) => void): HistoryLike => {
    const h = structuredClone(good)
    fn(h)
    return h
  }
  const rows: [string, (h: HistoryLike) => void, RegExp][] = [
    ['a missing kind', h => { (h.events[0] as { kind?: string }).kind = undefined }, /kind/],
    ['a missing published date', h => { h.events[0].published = '' }, /incomplete year or date/],
    ['an impossible calendar date', h => { h.events[0].published = '2023-02-30' }, /incomplete year or date/],
    ['an event outside updates', h => { h.events[0].published = '2023-10-25' }, /not a member of updates/],
    ['a missing name', h => { h.events[0].after[0].com = '' }, /no com/],
    ['a code outside the species-code shape', h => { h.events[0].after[1].code = 'Gamma Bird' }, /species-code shape/],
    ['a split with one daughter', h => { h.events[0].after.pop() }, /a split needs one before and two or more after/],
    ['a lump with one parent', h => { h.events[1].before.shift() }, /a lump needs two or more before/],
    ['a lump carrying a slash', h => { h.events[1].slashes.push({ code: 'xxx', sci: 'Genus beta/gamma', com: 'Beta/Gamma Bird' }) }, /carries no slashes/],
    ['a flipped retired flag', h => { h.events[0].before[0].retired = false }, /retired flag/],
    ['a moved coverage', h => { h.coverage!.latest = h.updates[0] }, /coverage/],
    ['a re-spelled snapshot version', h => { h.snapshot = 'T2' }, /snapshot/],
    ['an unsorted event list', h => { h.events.reverse() }, /sorted|not a member|lump needs|split needs/],
  ]
  for (const [label, fn, msg] of rows) {
    it(label, () => {
      expect(() => checkHistory(mutate(fn), SNAPSHOT)).toThrow(msg)
    })
  }
})
