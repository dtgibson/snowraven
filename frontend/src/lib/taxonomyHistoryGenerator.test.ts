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
import { readFileSync } from 'node:fs'
import {
  deriveHistory, checkHistory, HistoryInputError, parseCsv, changeTokens, splitSubject, tally, renameKey,
  RENAMES_AWAITING_SOURCE, RENAMES_UNANNOTATED,
  type PublishedRow, type SnapshotLike, type HistoryLike, type Recount, type RenameRow,
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

/** The "current" snapshot for the fixture: the 2024 taxonomy's maps. Both lumped
 *  codes survive as forms of the lumped species, so each earlier name of the
 *  2024 lump is traced to a kept form (FR-06). */
const SNAPSHOT: SnapshotLike = {
  version: 'T1',
  byCode: { vvv: 'Vee Bird', www: 'Vee Bird (Delta)', yyy: 'Vee Bird (Beta)', zzz: 'Gamma Bird', xxx: 'Beta/Gamma Bird' },
  byCom: { 'vee bird': 'vvv', 'gamma bird': 'zzz' },
  bySci: { 'genus beta': 'vvv', 'genus gamma': 'zzz' },
  reportAs: { www: 'vvv', yyy: 'vvv' },
}

// eBird's announced tally is required for every covered year (big-old-life-
// lists), so the fixture carries the fixture's own: one species gained in 2023,
// one lost in 2024.
const PUBLISHED: Record<number, PublishedRow> = {
  2023: { published: '2023-10-24', mark: 'measured', announced: { gained: 1, lost: 0 } },
  2024: { published: '2024-10-22', mark: 'measured', announced: { gained: 0, lost: 1 } },
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

/** The fixture's own rename tables: none. The shipped tables name real 2019 and
 *  2022 renames, and a row that matches nothing stops the run. */
const FIXTURE_RENAME_TABLES = { renamesUnannotated: {}, renamesAwaitingSource: {} }

function run(files: Files = BASE, published: Record<number, PublishedRow> = PUBLISHED) {
  return deriveHistory({
    files: Object.entries(files).map(([name, text]) => ({ name, text })),
    snapshot: SNAPSHOT,
    generated: '2026-09-30',
    published,
    ...FIXTURE_RENAME_TABLES,
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
    // Each earlier name carries the present name of the form eBird kept for it.
    expect(lump.before).toEqual([
      { code: 'www', sci: 'Genus delta', com: 'Delta Bird', retired: true, form: 'Vee Bird (Delta)' },
      { code: 'yyy', sci: 'Genus beta', com: 'Beta Bird', retired: true, form: 'Vee Bird (Beta)' },
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

  it('is version 2, with a renames array that is empty when no name changed', () => {
    expect(h.v).toBe(2)
    expect(h.renames).toEqual([])
  })

  it('keeps no form where the snapshot keeps none (FR-06): a split, and a lumped code the snapshot dropped', () => {
    expect(h.events[0].before.every(b => !Object.hasOwn(b, 'form'))).toBe(true)
    const noForms = deriveHistory({
      files: Object.entries(BASE).map(([name, text]) => ({ name, text })),
      snapshot: { ...SNAPSHOT, reportAs: { yyy: 'vvv' } },
      generated: '2026-09-30', published: PUBLISHED, ...FIXTURE_RENAME_TABLES,
    }).history
    expect(noForms.events[1].before.map(b => b.form)).toEqual([undefined, 'Vee Bird (Beta)'])
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

  it('a missing required header, naming the columns the file does have', () => {
    expectFailsClosed(replace('ebird-taxonomy-v2023.csv', 'REPORT_AS', 'REPORTED_AS'), /missing required column REPORT_AS \(its header row has: .*"REPORTED_AS"\)/)
    expectFailsClosed(replace('clements-integrated-v2023.csv', 'English name', 'Common name'), /missing required column English name \(its header row has: .*"Common name"/)
  })

  it('an input no covered year uses says which file or column its year lacks', () => {
    // 2023's checklist without its change columns: 2023 is not covered, and the
    // refusal names the two columns rather than only "not needed".
    const files = {
      'ebird-taxonomy-v2022.csv': TAX_2022, 'ebird-taxonomy-v2023.csv': TAX_2023,
      'clements-integrated-v2022.csv': INT_2022,
      'clements-integrated-v2023.csv': INT_2022.replace('sort v2022', 'sort v2023'),
    }
    expectFailsClosed(files, /2023 is not covered because clements-integrated-v2023.csv has no Clements v2023 change, no text for website v2023, no the previous update's sort column/)
    // And a missing previous-year file is named by its exact name.
    const noPrevTax = { ...BASE }
    delete (noPrevTax as Record<string, string>)['ebird-taxonomy-v2022.csv']
    expectFailsClosed(noPrevTax, /2023 is not covered because ebird-taxonomy-v2022.csv \(the 2022 update before it\) is missing/)
  })

  it('a year whose change cells use another vocabulary says so, with the cells it saw', () => {
    // Without the issf rows the taxonomy offers no promotion link either, so
    // nothing finds the split and the tally fails, carrying the vocabulary.
    const files = {
      ...BASE,
      'ebird-taxonomy-v2022.csv': TAX_2022.replace('3,issf,yyy,Alpha Bird (Beta),Genus alpha beta,xxx\r\n', '').replace('\r\n4,issf,zzz,Alpha Bird (Gamma),Genus alpha gamma,xxx', ''),
      'clements-integrated-v2023.csv': INT_2023.replace(',split,', ',new species (from split),').replace(',split; range,', ',new species (from split),'),
    }
    expectFailsClosed(files, /no species row of clements-integrated-v2023.csv carries the change token "split" or "lump"; its change cells include "new species \(from split\)"/)
  })

  it('reads integrated headers written with underscores', () => {
    const files = {
      ...BASE,
      'clements-integrated-v2023.csv': INT_2023.replace('Clements v2023 change,text for website v2023,category,English name', 'Clements_v2023_change,text_for_website_v2023,category,English_name'),
    }
    expect(run(files).events.map(e => e.kind)).toEqual(['split', 'lump'])
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

  it('a "lump" whose one before-side species is the survivor itself is a rename: excluded, and the announced tally fails it closed when eBird counted it', () => {
    // Delta Bird stays a species in 2024, so the "lump" has only Beta Bird,
    // which is Vee Bird's own previous identity: Beta Bird re-coded and renamed.
    // big-old-life-lists: that is excluded as a rename (the 2022 Pink Pigeon
    // shape the v1.0.41 run could not get past), and because the tally is
    // required, a year that counted it as a lump still refuses to ship, and the
    // message names what was excluded.
    const files = {
      ...BASE,
      'ebird-taxonomy-v2024.csv': TAX_2024.replace('2,issf,www,Vee Bird (Delta),Genus beta delta,vvv', '2,species,www,Delta Bird,Genus delta,'),
    }
    expectFailsClosed(files, /tally 0 gained .* and 0 lost .* announced 0 and 1 \(excluded as renames, not lumps: "Vee Bird" \(vvv\) from yyy\)/)
  })

  it('a covered year without eBird\'s announced tally', () => {
    expectFailsClosed(BASE, /no announced tally for the 2024 update in UPDATE_PUBLISHED: add announced: \{ gained, lost \}/, {
      ...PUBLISHED, 2024: { published: '2024-10-22', mark: 'measured' },
    })
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

// The rules that take coverage back to 2019 (taxonomy-history-2019).
// Each fixture is the 2022 to 2023 half of the chained fixture (whose Alpha
// Bird split gains one species) plus a few rows in the shape of one real case
// from Cornell's 2019, 2021 or 2022 files, named in each row. Every row was
// seen failing against the resolver before that rule existed
// (pipeline/taxonomy-history-2019/decisions.md has each one's red-first).

type Sp = [code: string, com: string, sci: string]
/** The species current after the 2023 fixture update, plus `extra`. */
function snapshot2023(extra: Sp[]): SnapshotLike {
  const species: Sp[] = [['www', 'Delta Bird', 'Genus delta'], ['yyy', 'Beta Bird', 'Genus beta'], ['zzz', 'Gamma Bird', 'Genus gamma'], ...extra]
  return {
    version: 'T1',
    byCode: { xxx: 'Beta/Gamma Bird', ...Object.fromEntries(species.map(([c, com]) => [c, com])) },
    byCom: Object.fromEntries(species.map(([c, com]) => [com.toLowerCase(), c])),
    bySci: Object.fromEntries(species.map(([c, , sci]) => [sci.toLowerCase(), c])),
  }
}
/** A quoted CSV cell. */
const q = (text: string) => `"${text.replace(/"/g, '""')}"`
/** The 2022 to 2023 fixture with rows appended to each file. Taxonomy lines
 *  are `category,code,common name,scientific name,report as`; integrated
 *  lines are written in each file's own column order. */
function plus2023(add: { tax2022?: string[]; tax2023?: string[]; int2022?: string[]; int2023?: string[] }): Files {
  const tax = (base: string, lines: string[] = []) => [base, ...lines.map(l => `9,${l}`)].join('\r\n')
  const int = (base: string, lines: string[] = []) => [base, ...lines].join('\r\n')
  return {
    'ebird-taxonomy-v2022.csv': tax(TAX_2022, add.tax2022),
    'ebird-taxonomy-v2023.csv': tax(TAX_2023, add.tax2023),
    'clements-integrated-v2022.csv': int(INT_2022, add.int2022),
    'clements-integrated-v2023.csv': int(INT_2023, add.int2023),
  }
}
function run2023(files: Files, extra: Sp[], announced: { gained: number; lost: number }, recounts?: Record<number, readonly Recount[]>) {
  return deriveHistory({
    files: Object.entries(files).map(([name, text]) => ({ name, text })),
    snapshot: snapshot2023(extra),
    generated: '2026-10-21',
    published: { 2023: { published: '2023-10-24', mark: 'measured', announced } },
    recounts: recounts ?? {},
    ...FIXTURE_RENAME_TABLES,
  }).history
}
function failsClosed2023(files: Files, extra: Sp[], announced: { gained: number; lost: number }, what: RegExp, recounts?: Record<number, readonly Recount[]>) {
  let out: HistoryLike | undefined
  let err: unknown
  try { out = run2023(files, extra, announced, recounts) } catch (e) { err = e }
  expect(out, 'no object is returned').toBeUndefined()
  expect(err).toBeInstanceOf(HistoryInputError)
  expect((err as Error).message).toMatch(what)
}
const codes = (side: { code: string }[]) => side.map(e => e.code).sort()
const lumpInto = (h: HistoryLike, code: string) => h.events.find(e => e.kind === 'lump' && e.after[0].code === code)

// Lima Bird is split into Mike Bird (once Lima's group) and November Bird (a
// new code, found by its sentence), and Oscar Bird is lumped into November
// Bird: the 2019 Swinhoe's White-eye shape. With `papa`, Papa Bird is lumped
// into Mike Bird too, and ONE sentence on both rows names Papa and Oscar
// together: the 2019 Warbling and Swinhoe's White-eye shape.
const LIMA_SPLIT = 'Lima Bird Genus lima is split into Mike Bird Genus mike and November Bird Genus november.'
function lima(papa: boolean): Files {
  const text = papa ? `${LIMA_SPLIT} Papa Bird Genus papa is embedded in the first and Oscar Bird Genus oscar in the second.` : `${LIMA_SPLIT} Oscar Bird Genus oscar is lumped into November Bird Genus november.`
  return plus2023({
    tax2022: ['species,lll,Lima Bird,Genus lima,', 'issf,mmm,Lima Bird (Mike),Genus lima mike,lll', 'species,ooo,Oscar Bird,Genus oscar,', ...(papa ? ['species,ppp,Papa Bird,Genus papa,'] : [])],
    int2022: ['20,species,Lima Bird,Genus lima', '21,species,Oscar Bird,Genus oscar', ...(papa ? ['22,species,Papa Bird,Genus papa'] : [])],
    tax2023: ['species,mmm,Mike Bird,Genus mike,', 'species,nnn,November Bird,Genus november,'],
    int2023: [
      `20,${papa ? 'split; lump' : 'split'},${q(papa ? text : LIMA_SPLIT)},species,Mike Bird,Genus mike,20`,
      ...(papa ? ['21,,,subspecies,,Genus mike papa,22'] : []),
      `22,split; lump,${q(text)},species,November Bird,Genus november,`,
      '23,,,subspecies,,Genus november oscar,21',
    ],
  })
}
const LIMA_SPECIES: Sp[] = [['mmm', 'Mike Bird', 'Genus mike'], ['nnn', 'November Bird', 'Genus november']]

describe('the rules that take coverage back to 2019 (taxonomy-history-2019)', () => {
  it('a lump survivor that is also a split daughter carries its split parent on its before side (2019, Swinhoe\'s White-eye)', () => {
    const h = run2023(lima(false), LIMA_SPECIES, { gained: 2, lost: 1 })
    expect(codes(lumpInto(h, 'nnn')!.before)).toEqual(['lll', 'ooo'])
    expect(h.events.find(e => e.kind === 'split' && e.before[0].code === 'lll')!.after.map(a => a.code)).toEqual(['mmm', 'nnn'])
  })

  it('a species one shared sentence names goes only to the survivor the checklist rows place it under (2019, Warbling and Swinhoe\'s White-eye)', () => {
    const h = run2023(lima(true), LIMA_SPECIES, { gained: 2, lost: 2 })
    expect(codes(lumpInto(h, 'mmm')!.before)).toEqual(['lll', 'ppp'])
    expect(codes(lumpInto(h, 'nnn')!.before)).toEqual(['lll', 'ooo'])
    // Each lumped species is lost once, not once per survivor that names it.
    expect(h.events.filter(e => e.before.some(b => b.code === 'ooo'))).toHaveLength(1)
    expect(h.events.filter(e => e.before.some(b => b.code === 'ppp'))).toHaveLength(1)
  })

  it('a lumped species named by common name only joins the survivor its rows now sit under (2022, Pale-billed Firefinch)', () => {
    const files = plus2023({
      tax2022: ['species,sss,Sierra Bird,Genus sierra,', 'species,ttt,Tango Bird,Genus tango,'],
      int2022: ['30,species,Sierra Bird,Genus sierra', '31,species,Tango Bird,Genus tango'],
      tax2023: ['species,sss,Sierra Bird,Genus sierra,'],
      int2023: ['30,lump,"Tango Bird is lumped into Sierra Bird.",species,Sierra Bird,Genus sierra,30', '31,,,subspecies,,Genus sierra tango,31'],
    })
    const h = run2023(files, [['sss', 'Sierra Bird', 'Genus sierra']], { gained: 1, lost: 1 })
    expect(codes(lumpInto(h, 'sss')!.before)).toEqual(['sss', 'ttt'])
  })

  const CHESTNUT = 'Chestnut Bird Genus castaneus is found to consist of two species: Chestnut Bird Genus castaneus and newly described Oxa Bird Genus oxa.'
  const chestnut = (described: boolean) => plus2023({
    tax2022: ['species,ccc,Chestnut Bird,Genus castaneus,'],
    int2022: ['40,species,Chestnut Bird,Genus castaneus'],
    tax2023: ['species,ccc,Chestnut Bird,Genus castaneus,', ...(described ? ['species,oxa,Oxa Bird,Genus oxa,'] : [])],
    int2023: [
      `40,split,${q(CHESTNUT)},species,Chestnut Bird,Genus castaneus,40`,
      ...(described ? [`41,split; new species,${q(CHESTNUT)},species,Oxa Bird,Genus oxa,`] : []),
    ],
  })
  const CHESTNUT_SPECIES: Sp[] = [['ccc', 'Chestnut Bird', 'Genus castaneus'], ['oxa', 'Oxa Bird', 'Genus oxa']]

  it('a newly described species is no split daughter, and the split it leaves holding only its parent is no split (2021, Oxapampa Antpitta)', () => {
    // eBird counts Oxa Bird among the year's newly described species, so the
    // year gains one species through splits (Alpha Bird's), not two.
    const h = run2023(chestnut(true), CHESTNUT_SPECIES, { gained: 1, lost: 0 })
    expect(h.events.map(e => e.before[0].code)).toEqual(['xxx'])
  })

  it('a split holding only its own parent still fails closed when no newly described species explains it (FR-04 stays)', () => {
    failsClosed2023(chestnut(false), CHESTNUT_SPECIES, { gained: 1, lost: 0 }, /split of "Chestnut Bird" \(ccc\) has 1 daughter species \(ccc\)/)
  })

  const brace = (sci: string) => plus2023({
    tax2022: ['species,bra,Brace Bird,Genus bracei,', 'issf,bra2,Brace Bird (Brace),Genus bracei bracei,bra', 'issf,bra3,Brace Bird (Other),Genus bracei alius,bra'],
    int2022: ['50,species,Brace Bird,Genus bracei', '51,group (monotypic),Brace Bird (Brace),Genus bracei bracei', '52,group (monotypic),Brace Bird (Other),Genus bracei alius'],
    tax2023: [`species,bra2,Brace Bird,${sci},`],
    int2023: [`50,subspecies deletion,"The group alius is no longer recognized.",species,Brace Bird,${sci},51`],
  })

  it('a group promoted unannotated as the parent\'s only continuation, under its name, is a re-code, not a split (2022, Brace\'s Emerald)', () => {
    const h = run2023(brace('Genus bracei'), [['bra2', 'Brace Bird', 'Genus bracei']], { gained: 1, lost: 0 })
    expect(h.events.some(e => [...e.before, ...e.after].some(x => x.code === 'bra' || x.code === 'bra2'))).toBe(false)
  })

  it('the re-code rule is bounded: a lone promotion under ANOTHER scientific name still fails closed', () => {
    failsClosed2023(brace('Genus nova'), [['bra2', 'Brace Bird', 'Genus nova']], { gained: 1, lost: 0 }, /split of "Brace Bird" \(bra\) has 1 daughter species \(bra2\)/)
  })

  it('where every sentence names two parents, the daughter\'s own rows decide (2021, Striped Prinia)', () => {
    const text = 'The Striated Bird Genus crinigera/Brown Bird Genus polychroa complex is revised. Four species are recognized: a Himalayan Bird Genus crinigera; a Striped Bird Genus striata; a Brown Bird Genus polychroa; and an Annam Bird Genus rocki.'
    const files = plus2023({
      tax2022: ['species,str,Striated Bird,Genus crinigera,', 'species,brn,Brown Bird,Genus polychroa,'],
      int2022: ['60,species,Striated Bird,Genus crinigera', '61,subspecies,,Genus crinigera striata', '62,species,Brown Bird,Genus polychroa'],
      tax2023: ['species,str,Himalayan Bird,Genus crinigera,', 'species,stp,Striped Bird,Genus striata,', 'species,brn,Brown Bird,Genus polychroa,', 'species,ann,Annam Bird,Genus rocki,'],
      int2023: [
        `60,split,${q(text)},species,Himalayan Bird,Genus crinigera,60`,
        `61,split,${q(text)},species,Striped Bird,Genus striata,`,
        '62,,,subspecies,,Genus striata striata,61',
        `63,split,${q(text)},species,Brown Bird,Genus polychroa,62`,
        `64,split,${q(text)},species,Annam Bird,Genus rocki,62`,
      ],
    })
    const h = run2023(files, [['str', 'Himalayan Bird', 'Genus crinigera'], ['stp', 'Striped Bird', 'Genus striata'], ['brn', 'Brown Bird', 'Genus polychroa'], ['ann', 'Annam Bird', 'Genus rocki']], { gained: 3, lost: 0 })
    expect(codes(h.events.find(e => e.before[0].code === 'str')!.after)).toEqual(['stp', 'str'])
    expect(codes(h.events.find(e => e.before[0].code === 'brn')!.after)).toEqual(['ann', 'brn'])
  })

  it('where the shared preamble names two parents and no row decides, the daughter\'s own sentence does (2021, Equatorial Antpitta)', () => {
    const pre = 'The Rufous Bird Genus rufula/Chestnut Bird Genus blakei group is partitioned into four species.'
    const rufous = `${pre} The group Rufous Bird (Rufous) Genus rufula rufula is recognized as two species: Muisca Bird Genus rufula; Equatorial Bird Genus saturata.`
    const che = `${pre} Chestnut Bird Genus blakei is found to be two species: Chestnut Bird Genus blakei and Dark Bird Genus obscurus.`
    const files = plus2023({
      tax2022: ['species,ruf,Rufous Bird,Genus rufula,', 'issf,mui,Rufous Bird (Muisca),Genus rufula rufula,ruf', 'species,che,Chestnut Bird,Genus blakei,'],
      int2022: ['70,species,Rufous Bird,Genus rufula', '71,species,Chestnut Bird,Genus blakei'],
      tax2023: ['species,mui,Muisca Bird,Genus rufula,', 'species,equ,Equatorial Bird,Genus saturata,', 'species,che,Chestnut Bird,Genus blakei,', 'species,dar,Dark Bird,Genus obscurus,'],
      int2023: [
        `70,split,${q(rufous)},species,Muisca Bird,Genus rufula,`,
        `71,split,${q(rufous)},species,Equatorial Bird,Genus saturata,`,
        `72,split,${q(che)},species,Chestnut Bird,Genus blakei,71`,
        `73,split,${q(che)},species,Dark Bird,Genus obscurus,71`,
      ],
    })
    const h = run2023(files, [['mui', 'Muisca Bird', 'Genus rufula'], ['equ', 'Equatorial Bird', 'Genus saturata'], ['che', 'Chestnut Bird', 'Genus blakei'], ['dar', 'Dark Bird', 'Genus obscurus']], { gained: 3, lost: 0 })
    expect(codes(h.events.find(e => e.before[0].code === 'ruf')!.after)).toEqual(['equ', 'mui'])
    expect(codes(h.events.find(e => e.before[0].code === 'che')!.after)).toEqual(['che', 'dar'])
  })

  // The Lima reorganization recounted as eBird counted the 2019 white-eyes:
  // three species became two, one lost and none gained.
  const RECOUNT: Recount = {
    what: 'Lima, Oscar and Papa Bird reorganized as Mike and November Bird',
    events: [
      { kind: 'split', before: ['lll'], after: ['mmm', 'nnn'] },
      { kind: 'lump', before: ['lll', 'ppp'], after: ['mmm'] },
      { kind: 'lump', before: ['lll', 'ooo'], after: ['nnn'] },
    ],
    counted: { gained: 0, lost: 1 },
  }

  it('a cited recount relabels a reorganization for the tally and the asset keeps every event (2019 white-eyes, 2022 hill mynas)', () => {
    const h = run2023(lima(true), LIMA_SPECIES, { gained: 1, lost: 1 }, { 2023: [RECOUNT] })
    expect(h.events.filter(e => e.year === 2023)).toHaveLength(4)
    expect(tally(h.events)).toEqual({ gained: 2, lost: 2 })
  })

  it('without the recount the same year fails closed on the tally', () => {
    failsClosed2023(lima(true), LIMA_SPECIES, { gained: 1, lost: 1 }, /the 2023 events tally 2 gained .* and 2 lost .* but eBird announced 1 and 1/)
  })

  it('a recount naming an event the year does not hold fails closed', () => {
    const wrong: Recount = { ...RECOUNT, events: [...RECOUNT.events.slice(0, 2), { kind: 'lump', before: ['ooo', 'ppp'], after: ['nnn'] }] }
    failsClosed2023(lima(true), LIMA_SPECIES, { gained: 1, lost: 1 }, /recount "Lima, Oscar and Papa Bird reorganized as Mike and November Bird" names lump ooo\+ppp -> nnn, which the events hold 0 times/, { 2023: [wrong] })
  })

  it('a recount that would change the net fails closed: it may relabel, never change the net', () => {
    failsClosed2023(lima(true), LIMA_SPECIES, { gained: 1, lost: 0 }, /changes the net: its events gain 1 and lose 2, the recount 0 and 0/, { 2023: [{ ...RECOUNT, counted: { gained: 0, lost: 0 } }] })
  })

  // Its events count 1 gained and 2 lost, so the year tallies 2 and 2 before
  // the recount. Each count below keeps the net (-1) and is announced as the
  // year it would produce, so only the range check can refuse it: above, it
  // would absorb one extra daughter and one extra lumped species elsewhere;
  // below, it would count a negative number of species.
  it('a recount outside its own events\' figures fails closed even when it keeps the net: it may relabel only within the events it names', () => {
    failsClosed2023(lima(true), LIMA_SPECIES, { gained: 4, lost: 4 }, /recount "Lima, Oscar and Papa Bird reorganized as Mike and November Bird" counts 3 gained and 4 lost, outside its events' own 1 and 2/, { 2023: [{ ...RECOUNT, counted: { gained: 3, lost: 4 } }] })
    failsClosed2023(lima(true), LIMA_SPECIES, { gained: 0, lost: 0 }, /counts -1 gained and 0 lost, outside its events' own 1 and 2/, { 2023: [{ ...RECOUNT, counted: { gained: -1, lost: 0 } }] })
  })
})

function expectFailsClosedWithSnapshot(snapshot: SnapshotLike, what: RegExp) {
  let err: unknown
  let out: unknown
  try {
    out = deriveHistory({
      files: Object.entries(BASE).map(([name, text]) => ({ name, text })),
      snapshot, generated: '2026-09-30', published: PUBLISHED, ...FIXTURE_RENAME_TABLES,
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

describe('the generator source (CLAUDE.md, the non-ASCII literal rule)', () => {
  it('holds no literal non-ASCII character outside a full-line comment: accented names and curly quotes are written as escapes', () => {
    // The module reads accented and curly-quoted names (an apostrophe join
    // key, a U+FFFD check), which agents' editing tools have turned from
    // escapes into literals before. Comments may carry section rules.
    const src = readFileSync(new URL('../../../scripts/lib/taxonomyHistoryDerive.mjs', import.meta.url), 'utf8')
    const lines = src.split('\n')
    expect(lines.length, 'the source was read').toBeGreaterThan(100)
    const offending = lines
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => !line.trimStart().startsWith('//') && [...line].some(ch => ch.charCodeAt(0) > 0x7f))
    expect(offending).toEqual([])
  })
})

describe('the shared checker admits a code eBird re-used or dropped, and nothing wider (taxonomy-history-2019)', () => {
  const good = run()
  const mutate = (fn: (h: HistoryLike) => void): HistoryLike => {
    const h = structuredClone(good)
    fn(h)
    return h
  }
  // The fixture: 2023 splits xxx into yyy and zzz (slash xxx); 2024 lumps www
  // and yyy into vvv. Current species: vvv and zzz.
  it('a slash eBird later dropped with no event keeps its own year\'s name (2019, Fork-tailed/Glossy-backed Drongo)', () => {
    // Admitted only because fotdro1 is a cited entry in SLASHES_DROPPED; the
    // row below refuses an invented code in the same position.
    expect(checkHistory(mutate(h => { h.events[0].slashes[0].code = 'fotdro1' }), SNAPSHOT)).toBe(true)
  })
  it('but not an invented slash code that is absent from the snapshot, retired by no later event and not a cited dropped slash', () => {
    expect(() => checkHistory(mutate(h => { h.events[0].slashes.push({ code: 'zzzzzz9', sci: 'Genus foo/bar', com: 'Invented Foo/Bar' }) }), SNAPSHOT)).toThrow(/slash "zzzzzz9" is not in the snapshot/)
  })
  it('a slash code a LATER event re-uses for a species (2022, Northern/Southern Mouse-colored Tyrannulet)', () => {
    expect(checkHistory(mutate(h => { h.events[0].slashes[0].code = 'vvv' }), SNAPSHOT)).toBe(true)
  })
  it('but not a slash code that is a current species no later event creates', () => {
    expect(() => checkHistory(mutate(h => { h.events[0].slashes[0].code = 'zzz' }), SNAPSHOT)).toThrow(/slash "zzz" is a species in the snapshot and no later event creates it/)
  })
  it('a before code a LATER event creates again on its after side (2021 to 2024, Pilbara Grasswren)', () => {
    expect(checkHistory(mutate(h => { h.events[0].before[0].code = 'vvv' }), SNAPSHOT)).toBe(true)
  })
  it('but not a current before code that is neither kept nor created again later (I6)', () => {
    expect(() => checkHistory(mutate(h => { h.events[1].before[0].code = 'zzz' }), SNAPSHOT)).toThrow(/before code "zzz" is still a species, is not among its own event's after side, and no later event creates it/)
  })
})

// ── Renames (recorded-names-in-splits-and-lumps; QA-02 to QA-05, QA-10) ──────
//
// A second fixture, over three updates. In 2023 Ash Bird (aaa) is renamed
// Ashy Bird and, in 2024, Ashen Bird; Dun Bird (ddd) is split into Dun Finch
// (the kept code, renamed by the split) and Elm Bird (eee); Cedar Bird (ccc)
// changes only its scientific name; Gray Bird (ggg) is replaced by Grey Finch
// under a NEW code (hhh); Ice-Bird (iii) loses only its hyphen; Fen Bird (fff)
// is a species in the 2023 file alone. In 2024 Kite Bird (kkk) is split into
// Kite Bird and Lark Kite (lll). Exactly two renames follow, both of aaa.

const RN_TAX_2022 = [
  TAX_HEAD,
  '1,species,aaa,Ash Bird,Genus ash,',
  '2,species,ccc,Cedar Bird,Genus cedar,',
  '3,species,ddd,Dun Bird,Genus dun,',
  '4,issf,eee,Dun Bird (Elm),Genus dun elm,ddd',
  '5,species,ggg,Gray Bird,Genus gray,',
  '6,species,iii,Ice-Bird,Genus ice,',
  '7,species,jjj,Jay Bird,Genus jay,',
  '8,species,kkk,Kite Bird,Genus kite,',
].join('\r\n')

const RN_TAX_2023 = [
  TAX_HEAD,
  '1,species,aaa,Ashy Bird,Genus ash,',
  '2,species,ccc,Cedar Bird,Genus cedrus,',
  '3,species,ddd,Dun Finch,Genus dun,',
  '4,species,eee,Elm Bird,Genus elm,',
  '5,species,hhh,Grey Finch,Genus grisea,',
  '6,species,iii,Ice Bird,Genus ice,',
  '7,species,jjj,Jay Bird,Genus jay,',
  '8,species,kkk,Kite Bird,Genus kite,',
  '9,issf,lll,Kite Bird (Lark),Genus kite lark,kkk',
  '10,species,fff,Fen Bird,Genus fen,',
].join('\r\n')

const RN_TAX_2024 = [
  TAX_HEAD,
  '1,species,aaa,Ashen Bird,Genus ash,',
  '2,species,ccc,Cedar Bird,Genus cedrus,',
  '3,species,ddd,Dun Finch,Genus dun,',
  '4,species,eee,Elm Bird,Genus elm,',
  '5,species,hhh,Grey Finch,Genus grisea,',
  '6,species,iii,Ice Bird,Genus ice,',
  '7,species,jjj,Jay Bird,Genus jay,',
  '8,species,kkk,Kite Bird,Genus kite,',
  '9,species,lll,Lark Kite,Genus lark,',
  '10,species,fff,Fen Bird,Genus fen,',
].join('\r\n')

const RN_INT_2022 = [
  'sort v2022,category,English name,scientific name',
  '1,species,Ash Bird,Genus ash', '2,species,Cedar Bird,Genus cedar', '3,species,Dun Bird,Genus dun',
  '5,species,Gray Bird,Genus gray', '6,species,Ice-Bird,Genus ice', '7,species,Jay Bird,Genus jay',
  '8,species,Kite Bird,Genus kite',
].join('\r\n')

const DUN_TEXT = '"Dun Bird Genus dun is split into Dun Finch Genus dun and Elm Bird Genus elm."'
const RN_INT_2023 = [
  'sort v2023,Clements v2023 change,text for website v2023,category,English name,scientific name,sort v2022',
  '1,name change - English name,,species,Ashy Bird,Genus ash,1',
  '2,,,species,Cedar Bird,Genus cedrus,2',
  `3,split,${DUN_TEXT},species,Dun Finch,Genus dun,3`,
  `4,split,${DUN_TEXT},species,Elm Bird,Genus elm,`,
  '5,,,species,Grey Finch,Genus grisea,',
  '6,name change - English name,,species,Ice Bird,Genus ice,6',
  '7,,,species,Jay Bird,Genus jay,7',
  '8,,,species,Kite Bird,Genus kite,8',
  '10,,,species,Fen Bird,Genus fen,',
].join('\r\n')

const KITE_TEXT = '"Kite Bird Genus kite is split into Kite Bird Genus kite and Lark Kite Genus lark."'
const RN_INT_2024 = [
  'sort v2024,Clements v2024 change,text for website v2024,category,English name,scientific name,sort v2023',
  '1,name change - English,,species,Ashen Bird,Genus ash,1',
  '2,,,species,Cedar Bird,Genus cedrus,2',
  '3,,,species,Dun Finch,Genus dun,3',
  '4,,,species,Elm Bird,Genus elm,4',
  '5,,,species,Grey Finch,Genus grisea,5',
  '6,,,species,Ice Bird,Genus ice,6',
  '7,,,species,Jay Bird,Genus jay,7',
  `8,split,${KITE_TEXT},species,Kite Bird,Genus kite,8`,
  `9,split,${KITE_TEXT},species,Lark Kite,Genus lark,`,
  '10,,,species,Fen Bird,Genus fen,10',
].join('\r\n')

const RN_FILES: Files = {
  'ebird-taxonomy-v2022.csv': RN_TAX_2022, 'ebird-taxonomy-v2023.csv': RN_TAX_2023, 'ebird-taxonomy-v2024.csv': RN_TAX_2024,
  'clements-integrated-v2022.csv': RN_INT_2022, 'clements-integrated-v2023.csv': RN_INT_2023, 'clements-integrated-v2024.csv': RN_INT_2024,
}
const RN_PUBLISHED: Record<number, PublishedRow> = {
  2023: { published: '2023-10-24', mark: 'measured', announced: { gained: 1, lost: 0 } },
  2024: { published: '2024-10-22', mark: 'measured', announced: { gained: 1, lost: 0 } },
}
/** The 2024 taxonomy as the bundled snapshot. */
function rnSnapshot(names: Record<string, string> = {}): SnapshotLike {
  const rows: [string, string, string][] = [
    ['aaa', 'Ashen Bird', 'genus ash'], ['ccc', 'Cedar Bird', 'genus cedrus'], ['ddd', 'Dun Finch', 'genus dun'],
    ['eee', 'Elm Bird', 'genus elm'], ['hhh', 'Grey Finch', 'genus grisea'], ['iii', 'Ice Bird', 'genus ice'],
    ['jjj', names.jjj ?? 'Jay Bird', 'genus jay'], ['kkk', 'Kite Bird', 'genus kite'], ['lll', 'Lark Kite', 'genus lark'],
    ['fff', 'Fen Bird', 'genus fen'],
  ]
  return {
    version: 'T2',
    byCode: Object.fromEntries(rows.map(([c, n]) => [c, n])),
    byCom: Object.fromEntries(rows.map(([c, n]) => [n.toLowerCase(), c])),
    bySci: Object.fromEntries(rows.map(([c, , s]) => [s, c])),
    reportAs: {},
  }
}
const NO_ROWS: Readonly<Record<number, readonly RenameRow[]>> = {}
function runRn(opts: {
  files?: Files, snapshot?: SnapshotLike,
  unannotated?: Readonly<Record<number, readonly RenameRow[]>>, awaiting?: Readonly<Record<number, readonly RenameRow[]>>,
} = {}) {
  return deriveHistory({
    files: Object.entries(opts.files ?? RN_FILES).map(([name, text]) => ({ name, text })),
    snapshot: opts.snapshot ?? rnSnapshot(),
    generated: '2026-11-19',
    published: RN_PUBLISHED,
    renamesUnannotated: opts.unannotated ?? NO_ROWS,
    renamesAwaitingSource: opts.awaiting ?? NO_ROWS,
  })
}
function expectRnFails(what: RegExp, opts: Parameters<typeof runRn>[0]) {
  let out: unknown
  let err: unknown
  try { out = runRn(opts) } catch (e) { err = e }
  expect(out, 'no object is returned').toBeUndefined()
  expect(err).toBeInstanceOf(HistoryInputError)
  expect((err as Error).message).toMatch(what)
}
/** Jay Bird becomes Jade Bird in 2023 with no annotation (2024 and the snapshot follow). */
const JADE = {
  files: {
    ...RN_FILES,
    'ebird-taxonomy-v2023.csv': RN_TAX_2023.replace('jjj,Jay Bird', 'jjj,Jade Bird'),
    'ebird-taxonomy-v2024.csv': RN_TAX_2024.replace('jjj,Jay Bird', 'jjj,Jade Bird'),
  },
  snapshot: rnSnapshot({ jjj: 'Jade Bird' }),
}
const JADE_ROW: RenameRow = { code: 'jjj', from: 'Jay Bird', to: 'Jade Bird' }

describe('the generator derives renames (recorded-names-in-splits-and-lumps; FR-01 to FR-04, QA-02, QA-04)', () => {
  const { history: h, report } = runRn()

  it('yields exactly the word-changing renames, each a species in both files and on no event of its update', () => {
    // Not Cedar Bird (scientific name only), not Dun Bird (on the split), not
    // Gray Bird or Grey Finch (a changed code), not Ice-Bird (spelling only),
    // not Fen Bird or Elm Bird (species in one file only).
    expect(h.renames.map(r => `${r.year} ${r.before[0].code} ${r.before[0].com} > ${r.after[0].com}`)).toEqual([
      '2023 aaa Ash Bird > Ashy Bird',
      '2024 aaa Ashy Bird > Ashen Bird',
    ])
  })

  it('reads A to B, then B to C: a current name is the update file\'s own, never the snapshot\'s (FR-01)', () => {
    const [first, second] = h.renames
    expect(first).toEqual({
      kind: 'rename', year: 2023, published: '2023-10-24',
      before: [{ code: 'aaa', sci: 'Genus ash', com: 'Ash Bird', retired: true }],
      after: [{ code: 'aaa', sci: 'Genus ash', com: 'Ashy Bird' }],
      slashes: [],
    })
    expect(second.before[0]).toEqual({ code: 'aaa', sci: 'Genus ash', com: 'Ashy Bird', retired: true })
    expect(second.after[0].com).toBe('Ashen Bird')
  })

  it('dates each rename to the update whose file first carries the new name, and to nothing finer (FR-04)', () => {
    for (const r of h.renames) expect(h.updates).toContainEqual({ year: r.year, published: r.published })
  })

  it('leaves every split and lump exactly as derived without renames', () => {
    expect(h.events.map(e => `${e.kind} ${e.year} ${e.before.map(b => b.code)}>${e.after.map(a => a.code)}`)).toEqual([
      'split 2023 ddd>ddd,eee',
      'split 2024 kkk>kkk,lll',
    ])
  })

  it('prints kept, left out and excluded per update, and the annotated rows that made no rename (FR-05)', () => {
    expect(report.renames.map(r => [r.year, r.kept, r.leftOut, r.excluded])).toEqual([[2023, 1, 1, 1], [2024, 1, 0, 0]])
    expect(report.renames[0].annotatedWithoutRename).toMatchObject({ equalUnderCutoff: 1, onEvent: 0, newCode: 0 })
    expect(report.renames.every(r => r.cited.length === 0 && r.awaiting.length === 0)).toBe(true)
  })

  it('passes the shared invariant checker CI runs', () => {
    expect(checkHistory(h, rnSnapshot())).toBe(true)
  })
})

describe('R8: every rename is annotated by Cornell or cited from eBird (schema.md 4.3)', () => {
  it('an unannotated rename that no row cites stops the run, naming it', () => {
    expectRnFails(/2023 rename jjj "Jay Bird" to "Jade Bird" is not annotated as an English name change/, JADE)
  })

  it('a cited row with its source admits it, and the printout lists it as cited', () => {
    const { history, report } = runRn({ ...JADE, unannotated: { 2023: [{ ...JADE_ROW, source: 'https://science.ebird.org/example', mark: 'measured' }] } })
    expect(history.renames.map(r => r.before[0].code)).toEqual(['aaa', 'jjj', 'aaa'])
    expect(report.renames[0].cited).toEqual([JADE_ROW])
  })

  it('a cited row matches by year, code and BOTH names exactly: a wrong name admits nothing', () => {
    expectRnFails(/is not annotated as an English name change/, { ...JADE, unannotated: { 2023: [{ ...JADE_ROW, from: 'Jay Birds', source: 'https://x.example' }] } })
    expectRnFails(/is not annotated as an English name change/, { ...JADE, unannotated: { 2024: [{ ...JADE_ROW, source: 'https://x.example' }] } })
  })

  it('a cited row marked assumed, or with no source URL, stops the run', () => {
    expectRnFails(/marked assumed/, { ...JADE, unannotated: { 2023: [{ ...JADE_ROW, source: 'https://x.example', mark: 'assumed' }] } })
    expectRnFails(/missing its source URL/, { ...JADE, unannotated: { 2023: [JADE_ROW] } })
  })

  it('a rename awaiting a source is left out of the record and printed by name', () => {
    const { history, report } = runRn({ ...JADE, awaiting: { 2023: [JADE_ROW] } })
    expect(history.renames.map(r => r.before[0].code)).toEqual(['aaa', 'aaa'])
    expect(report.renames[0].awaiting).toEqual([JADE_ROW])
    expect(report.renames[0].kept).toBe(1)
  })

  it('neither table can outlive its reason: a row matching nothing, an annotated rename, or both tables at once stop the run', () => {
    expectRnFails(/RENAMES_AWAITING_SOURCE row 2023 jjj "Jay Bird" to "Jade Bird" matches no unannotated rename/, { awaiting: { 2023: [JADE_ROW] } })
    expectRnFails(/RENAMES_UNANNOTATED row 2023 jjj .* matches no unannotated rename/, { unannotated: { 2023: [{ ...JADE_ROW, source: 'https://x.example' }] } })
    expectRnFails(/RENAMES_AWAITING_SOURCE row 2023 aaa "Ash Bird" to "Ashy Bird" is annotated/, { awaiting: { 2023: [{ code: 'aaa', from: 'Ash Bird', to: 'Ashy Bird' }] } })
    expectRnFails(/both cited and awaiting a source/, { ...JADE, awaiting: { 2023: [JADE_ROW] }, unannotated: { 2023: [{ ...JADE_ROW, source: 'https://x.example' }] } })
  })

  it('ships no cited row, and exactly the three renames that await a person\'s reading of eBird\'s pages', () => {
    // Literal on purpose: adding, removing or editing a row is a deliberate,
    // reviewable act (the runbook's "Read the rename printout" step).
    expect(RENAMES_UNANNOTATED).toEqual({})
    expect(RENAMES_AWAITING_SOURCE).toEqual({
      2019: [
        { code: 'rutbuh1', from: 'Rufous-tailed Bush-hen', to: 'Pale-vented Bush-hen' },
        { code: 'yegfin1', from: 'Yellow-green Finch', to: 'Yellow-green Brushfinch' },
      ],
      2022: [{ code: 'grasal3', from: 'Blue-gray Saltator', to: 'Bluish-gray Saltator' }],
    })
  })
})

describe('the rename cutoff, renameKey (FR-03; QA-03)', () => {
  // Every code point the steps name, written as an escape (testing.md v1.0.52).
  const same: [string, string, string][] = [
    ['case', 'Ash Bird', 'ash bird'],
    ['an accent', 'R\u00fcppell Bird', 'Ruppell Bird'],
    ['a decomposed accent', 'Ru\u0308ppell Bird', 'Ruppell Bird'],
    ['a hyphen', 'Ice-Bird', 'Ice Bird'],
    ['a space', 'Ice Bird', 'IceBird'],
    ['a straight apostrophe', "McCown's Longspur", 'McCowns Longspur'],
    ['a right curly apostrophe', 'McCown\u2019s Longspur', 'McCowns Longspur'],
    ['a left curly apostrophe', 'McCown\u2018s Longspur', 'McCowns Longspur'],
    ['a grave accent as apostrophe', 'McCown`s Longspur', 'McCowns Longspur'],
    ['a modifier-letter apostrophe', 'McCown\u02bcs Longspur', 'McCowns Longspur'],
    ['an okina', 'Hawai\u02bbi Bird', 'Hawaii Bird'],
    ['grey and gray', 'Grey-headed Bird', 'Gray-headed Bird'],
    ['several at once', 'Grey-headed R\u00fcppell\u2019s Bird', 'grayheaded ruppells bird'],
  ]
  for (const [what, a, b] of same) {
    it(`ignores ${what}`, () => expect(renameKey(a)).toBe(renameKey(b)))
  }
  const different: [string, string, string][] = [
    ['a changed word', 'Ash Bird', 'Ash Finch'],
    ['a changed letter', 'Ash Bird', 'Ask Bird'],
    ['an ignored difference beside a changed word', 'Grey-headed Bird', 'Gray-headed Finch'],
    ['a period', 'St. Helena Rail', 'St Helena Rail'],
    ['a non-breaking hyphen', 'Ice\u2011Bird', 'Ice-Bird'],
    ['a no-break space', 'Ice\u00a0Bird', 'Ice Bird'],
  ]
  for (const [what, a, b] of different) {
    it(`counts ${what} as a rename`, () => expect(renameKey(a)).not.toBe(renameKey(b)))
  }
  it('pins the code points it was written with (the escapes an editing tool can flatten)', () => {
    const points = new Set([...same, ...different].flatMap(([, a, b]) => [...a, ...b]).map(ch => ch.codePointAt(0)!).filter(c => c > 0x7f))
    expect([...points].sort((x, y) => x - y)).toEqual([0xa0, 0xfc, 0x2bb, 0x2bc, 0x308, 0x2011, 0x2018, 0x2019].sort((x, y) => x - y))
  })
})

describe('the shared checker refuses each rename and kept-form fault (schema.md 3.3, 3.4; QA-05)', () => {
  const good = runRn().history
  const snap = rnSnapshot()
  const mutate = (fn: (h: HistoryLike) => void): HistoryLike => {
    const h = structuredClone(good)
    fn(h)
    return h
  }
  const rows: [string, (h: HistoryLike) => void, RegExp][] = [
    ['R1, a rename with a slash', h => { h.renames[0].slashes.push({ code: 'aaa', sci: 'Genus a/b', com: 'A/B Bird' }) }, /one earlier name, one current name and no slashes/],
    ['R1, two different codes', h => { h.renames[0].after[0].code = 'ccc' }, /is not the current code/],
    ['R1, a date outside updates', h => { h.renames[0].published = '2023-10-25' }, /not a member of updates/],
    // Each asserts the checker's OWN message, so the row goes red when that
    // check is removed even though a later invariant would still refuse.
    ['R1, a rename with no code', h => { h.renames[0].before[0].code = ''; h.renames[0].after[0].code = '' }, /rename 0 \(2023\): an entry has no code/],
    ['R1, a rename with no name', h => { h.renames[0].after[0].com = '' }, /rename 0 \(2023\): an entry has no com/],
    ['R2, two names equal under the cutoff', h => { h.renames[0].after[0].com = 'ash-bird' }, /same name under the rename cutoff/],
    ['R3, a code on a split of the same update', h => { h.renames[0].before[0].code = 'ddd'; h.renames[0].after[0].code = 'ddd' }, /also on a split or lump of the same update/],
    ['R4, two renames of one code in one update', h => { h.renames.splice(1, 0, structuredClone(h.renames[0])) }, /two renames in the 2023 update/],
    ['R5, a flipped retired flag', h => { h.renames[0].before[0].retired = false }, /retired flag disagrees/],
    ['R6, a chain that does not connect', h => { h.renames[1].before[0].com = 'Oak Bird' }, /earlier name "Oak Bird" is not the 2023 new name "Ashy Bird"/],
    ['R7, a last rename that is not the snapshot\'s name', h => { h.renames[1].after[0].com = 'Ashes Bird' }, /last new name "Ashes Bird" is not the snapshot's "Ashen Bird"/],
    ['R9, unsorted renames', h => { h.renames.reverse() }, /not sorted|is not the 2024 new name/],
    ['I2, a rename moved into events', h => { h.events.push(h.renames.pop() as unknown as HistoryLike['events'][number]) }, /kind "rename"/],
    ['K2, a form on a rename entry', h => { h.renames[0].before[0].form = 'Ash Bird (Ash)' }, /a rename entry carries a form/],
    ['K2, a form on a split earlier name', h => { h.events[0].before[0].form = 'Dun Finch (Dun)' }, /a split's earlier name carries a form/],
  ]
  for (const [label, fn, msg] of rows) {
    it(label, () => {
      expect(() => checkHistory(mutate(fn), snap)).toThrow(msg)
    })
  }

  const lumpGood = run()
  const mutateLump = (fn: (h: HistoryLike) => void): HistoryLike => {
    const h = structuredClone(lumpGood)
    fn(h)
    return h
  }
  const formRows: [string, (h: HistoryLike) => void, SnapshotLike, RegExp][] = [
    ['K1, a wrong kept form', h => { h.events[1].before[0].form = 'Vee Bird (Gamma)' }, SNAPSHOT, /kept form is "Vee Bird \(Gamma\)", not the snapshot's "Vee Bird \(Delta\)"/],
    ['K1, a kept form removed', h => { delete h.events[1].before[0].form }, SNAPSHOT, /kept form is "\(absent\)"/],
    ['K1, a form where the snapshot keeps none', () => {}, { ...SNAPSHOT, reportAs: { yyy: 'vvv' } }, /carries the form "Vee Bird \(Delta\)" where the snapshot keeps none/],
    ['K1 and K3, a form set to a species name', h => { h.events[1].before[0].form = 'Gamma Bird' }, SNAPSHOT, /kept form is "Gamma Bird"/],
    ['K2, a form on an after entry', h => { h.events[1].after[0].form = 'Vee Bird' }, SNAPSHOT, /an after or slash entry carries a form/],
  ]
  for (const [label, fn, s, msg] of formRows) {
    it(label, () => {
      expect(() => checkHistory(mutateLump(fn), s)).toThrow(msg)
    })
  }
})
