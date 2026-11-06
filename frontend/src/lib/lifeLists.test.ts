/// <reference types="node" />
// The Life Lists derivation (life-lists-tab schema section 2; QA-10 to QA-14,
// QA-19, QA-23 to QA-30, QA-32, QA-34, QA-46, QA-54 to QA-56), plus the
// file-scoped absence guard that keeps the module's field reads hand loops.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import { parseMLExport } from './parseMLExport'
import { normalizeSpeciesName } from './speciesUtils'
import { pageList, PAGE_SIZE } from './pageList'
import regionCodes from './regionCode.fixture.json'
import {
  BINOMIAL_SCAN_CHARS, MEDIA_FORMATS, STATE_CODE_SCAN_CHARS,
  binomialOf, compareDisplay, compareInstant, dayKey, dayToIso, deriveFirstAssets, deriveFirstSightings,
  formatClock12h, minuteOf12h, minuteOfMlClock, placeOf, selectRows,
  type LifeListClassification, type LifeListControls, type LifeListRow, type MediaFormat,
} from './lifeLists'

// ── Fixture helpers ───────────────────────────────────────────────────────────

function obs(commonName: string, date: string, time: string | null, submissionId: string, extra: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    submissionId, commonName, scientificName: '', date, location: 'Lake Park', locationId: 'L1',
    latitude: null, longitude: null, county: 'Hennepin', count: 1, breedingCode: null,
    speciesComments: '', catalogIds: [], time, stateProvince: 'US-MN', ...extra,
  }
}

function ml(commonName: string, format: MediaFormat, date: string, time: string, catalogId: string, extra: Partial<MLExportRow> = {}): MLExportRow {
  return {
    catalogId, commonName, scientificName: '', format, date, location: 'River Trail', county: 'Dakota',
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '', ageSex: '',
    behaviors: '', time, year: null, month: null, avgRating: null, numRatings: 0, checklistId: 'S90', ...extra,
  }
}

const NONE: LifeListClassification = { escapees: new Set(), exotics: new Set() }
const controls = (formats: MediaFormat[] = [], includeEscapees = false, includeExotics = false): LifeListControls =>
  ({ includeEscapees, includeExotics, formats: new Set(formats) })

function list(o: ObservationEntry[], m: MLExportRow[] = [], c: LifeListControls = controls(), cls = NONE): LifeListRow[] {
  return selectRows(deriveFirstSightings(o), deriveFirstAssets(m), cls, c)
}
const names = (rows: readonly LifeListRow[]) => rows.map(r => r.name)

/** Every subset of the three formats, the eight media selections. */
const SELECTIONS: MediaFormat[][] = [[], ['Photo'], ['Audio'], ['Video'], ['Photo', 'Audio'], ['Photo', 'Video'], ['Audio', 'Video'], ['Photo', 'Audio', 'Video']]

// ── The bounded field reads (S1 to S3, S5, S8) ────────────────────────────────

describe('dayKey (S1, FR-12)', () => {
  it('reads a YYYY-MM-DD day as a comparable integer and writes it back', () => {
    expect(dayKey('2019-05-02')).toBe(20190502)
    expect(dayToIso(20190502)).toBe('2019-05-02')
    expect(dayKey('2018-11-20')! < dayKey('2019-05-02')!).toBe(true)
  })
  it('refuses an out-of-range month or day, a blank, a wrong shape and a long cell before reading it', () => {
    for (const bad of ['2024-13-05', '2024-00-05', '2024-05-00', '2024-05-32', '', '2024/05/05', '2024-5-05', '20240505', ' 2024-05-05', 'x'.repeat(40_000)]) {
      expect(dayKey(bad), JSON.stringify(bad.slice(0, 12))).toBe(null)
    }
    expect(dayKey(null)).toBe(null)
  })
})

describe('the clocks and the one formatter (S2, S3, FR-30, QA-32)', () => {
  it('reads the backup 12-hour clock, both widths and either case', () => {
    expect(minuteOf12h('7:05 AM')).toBe(425)
    expect(minuteOf12h('07:05 AM')).toBe(425)
    expect(minuteOf12h('12:05 AM')).toBe(5)
    expect(minuteOf12h('12:05 PM')).toBe(725)
    expect(minuteOf12h('9:30 pm')).toBe(21 * 60 + 30)
  })
  it('refuses a blank, an unparseable or an over-long backup time', () => {
    for (const bad of [null, undefined, '', 'abc', '13:00 PM', '0:30 AM', '7:60 AM', '7:05AM', '7:05 XM', '7:05 AMX', '107:05 AM', ' '.repeat(40_000)]) {
      expect(minuteOf12h(bad), String(bad).slice(0, 12)).toBe(null)
    }
  })
  it('reads the ML 24-hour clock and refuses what is not one', () => {
    expect(minuteOfMlClock('643')).toBe(6 * 60 + 43)
    expect(minuteOfMlClock('1530')).toBe(15 * 60 + 30)
    expect(minuteOfMlClock('0')).toBe(0)
    for (const bad of ['', '2400', '1260', 'abc', '12:30', '12345', '9'.repeat(40_000)]) expect(minuteOfMlClock(bad), bad.slice(0, 8)).toBe(null)
  })
  it('one formatter renders both sources the same way', () => {
    expect(formatClock12h(minuteOf12h('7:05 AM'))).toBe('7:05 AM')
    expect(formatClock12h(minuteOfMlClock('0705'))).toBe('7:05 AM')
    expect(formatClock12h(minuteOfMlClock('643'))).toBe('6:43 AM')
    expect(formatClock12h(minuteOfMlClock('1530'))).toBe('3:30 PM')
    expect(formatClock12h(0)).toBe('12:00 AM')
    expect(formatClock12h(minuteOf12h('abc'))).toBe(null)
  })
})

describe('placeOf (S5, FR-32, QA-34)', () => {
  it('builds "County, ST", either half alone, or nothing', () => {
    expect(placeOf('Hennepin', 'US-MN')).toBe('Hennepin, MN')
    expect(placeOf('Quintana Roo', 'MX-ROO')).toBe('Quintana Roo, ROO')
    expect(placeOf(null, 'US-MN')).toBe('MN')
    expect(placeOf('Hennepin', null)).toBe('Hennepin')
    expect(placeOf('Hennepin', 'MN')).toBe('Hennepin')
    expect(placeOf(null, '')).toBe('')
    expect(placeOf(undefined, undefined)).toBe('')
  })
  it('equals the Checklists split form on every code within the scan bound', () => {
    const splitForm = (county: string | null, sp: string) => [county, sp.split('-')[1]].filter(Boolean).join(', ')
    const codes = ['US-MN', 'CA-ON', 'MX-ROO', 'GB-ENG', 'US', 'US-', '-MN', ...regionCodes.map(r => r.input)]
    let checked = 0
    for (const code of codes) {
      if (code.length > STATE_CODE_SCAN_CHARS) continue
      expect(placeOf('Hennepin', code), code).toBe(splitForm('Hennepin', code))
      expect(placeOf(null, code), code).toBe(splitForm(null, code))
      checked += 1
    }
    expect(checked).toBeGreaterThan(20)
  })
  it('a cell past the scan bound yields no state, a 40,000-character hyphen run included', () => {
    expect(placeOf('Hennepin', '-'.repeat(40_000))).toBe('Hennepin')
    expect(placeOf('Hennepin', 'US-' + 'M'.repeat(STATE_CODE_SCAN_CHARS))).toBe('Hennepin')
  })
})

describe('binomialOf (S8, FR-43, QA-55)', () => {
  it('keeps the first two whitespace-separated tokens', () => {
    expect(binomialOf('Junco hyemalis oreganus')).toBe('Junco hyemalis')
    expect(binomialOf('Setophaga coronata auduboni')).toBe('Setophaga coronata')
    expect(binomialOf('Turdus migratorius')).toBe('Turdus migratorius')
    expect(binomialOf('Turdus  migratorius')).toBe('Turdus migratorius')
    expect(binomialOf('Turdus')).toBe('Turdus')
    expect(binomialOf('')).toBe('')
    expect(binomialOf(null)).toBe('')
  })
  it('reads no further than its own cap, whatever the cell holds', () => {
    const long = 'A'.repeat(40_000)
    expect(binomialOf(long)).toBe('A'.repeat(BINOMIAL_SCAN_CHARS))
    expect(binomialOf(`Genus ${'b'.repeat(40_000)}`)).toHaveLength(BINOMIAL_SCAN_CHARS)
  })
})

// ── Pass 1: the roster and its first sightings ───────────────────────────────

describe('first sightings (FR-10 to FR-12)', () => {
  it('folds subspecies into the parent and drops non-countable forms (QA-10)', () => {
    const rows = list([
      obs('Dark-eyed Junco (Oregon)', '2020-03-01', '8:00 AM', 'S1'),
      obs('Dark-eyed Junco', '2021-01-01', '8:00 AM', 'S2'),
      obs('Mallard x American Black Duck (hybrid)', '2019-01-01', '8:00 AM', 'S3'),
      obs('gull sp.', '2019-01-01', '8:00 AM', 'S4'),
      obs('Herring/Iceland Gull', '2019-01-01', '8:00 AM', 'S6'),
    ])
    expect(names(rows)).toEqual(['Dark-eyed Junco'])
    expect(rows[0].day).toBe(20200301)
  })

  it('a form eBird counts as its parent folds into it rather than dropping (the shared rule wins)', () => {
    // QA-10 listed these two among the forms that yield no row of their own.
    // Neither does, but neither is dropped either: the shared isNonCountableForm
    // follows eBird's reportAs, which counts an intraspecific intergrade and a
    // domestic type as the parent species (bird-names.md). So each folds in,
    // dated like a subspecies row.
    const rows = list([
      obs('Dark-eyed Junco', '2021-01-01', '8:00 AM', 'S1'),
      obs('Dark-eyed Junco (Slate-colored x Oregon)', '2019-01-01', '8:00 AM', 'S2'),
      obs('Mallard (Domestic type)', '2018-01-01', '8:00 AM', 'S3'),
    ])
    expect(names(rows)).toEqual(['Dark-eyed Junco', 'Mallard'])
    expect(rows.map(r => r.checklistId)).toEqual(['S2', 'S3'])
    expect(rows.some(r => r.name.includes('('))).toBe(false)
  })

  it('takes the earliest by date, then time (QA-11)', () => {
    const o = [obs('American Robin', '2019-05-02', '9:10 AM', 'S1'), obs('American Robin', '2019-05-02', '6:30 AM', 'S2')]
    expect(list(o)[0]).toMatchObject({ time: '6:30 AM', checklistId: 'S2' })
    const later = list([...o, obs('American Robin', '2018-11-20', null, 'S3')])[0]
    expect(later).toMatchObject({ day: 20181120, time: null, checklistId: 'S3' })
  })

  it('a blank time ranks after every timed observation that day (QA-12)', () => {
    expect(list([obs('American Robin', '2019-05-02', null, 'S2'), obs('American Robin', '2019-05-02', '7:00 AM', 'S1')])[0].checklistId).toBe('S1')
  })

  it('breaks a full tie by submission id as a code-unit comparison, not a numeric one', () => {
    // 'S10' < 'S9' in code units: the tiebreak is stable, not numeric.
    expect(list([obs('American Robin', '2019-05-02', null, 'S9'), obs('American Robin', '2019-05-02', null, 'S10')])[0].checklistId).toBe('S10')
  })

  it('an undated observation establishes nothing; a species with none dated is absent (QA-13)', () => {
    const rows = list([obs('American Robin', '2024-13-05', null, 'S1'), obs('American Robin', '', null, 'S2'), obs('Mallard', '2020-01-01', null, 'S3')])
    expect(names(rows)).toEqual(['Mallard'])
  })

  it('holds exactly one record per species (QA-46)', () => {
    const o = Array.from({ length: 50 }, (_, i) => obs(i % 2 ? 'Mallard' : 'American Robin', `2020-01-${String((i % 28) + 1).padStart(2, '0')}`, null, `S${i}`))
    expect(deriveFirstSightings(o).size).toBe(2)
  })

  it("carries the first sighting's own binomial, never a later row's (QA-55)", () => {
    const f = deriveFirstSightings([
      obs('Dark-eyed Junco (Oregon)', '2019-01-01', null, 'S1', { scientificName: 'Junco hyemalis oreganus' }),
      obs('Dark-eyed Junco', '2020-01-01', null, 'S2', { scientificName: 'Junco different' }),
    ])
    expect(f.get('Dark-eyed Junco')!.scientificName).toBe('Junco hyemalis')
  })
})

// ── Pass 2: first assets ──────────────────────────────────────────────────────

describe('first assets per format (FR-22, QA-23)', () => {
  it('takes the earliest of a format by date then clock, ignores undated rows and other formats', () => {
    const a = deriveFirstAssets([
      ml('American Robin', 'Photo', '2022-04-01', '1530', 'ML1'),
      ml('American Robin', 'Photo', '2022-04-01', '0905', 'ML2'),
      ml('American Robin', 'Photo', '', '0100', 'ML3'),
      ml('American Robin', 'Audio', '2020-01-01', '0100', 'ML4'),
    ]).get('American Robin')!
    expect(a.Photo).toMatchObject({ catalogId: 'ML2', minute: 9 * 60 + 5 })
    expect(a.Audio!.catalogId).toBe('ML4')
    expect(a.Video).toBeUndefined()
  })

  it('the ML parser normalizes the join key the way pass 1 does', () => {
    const header = 'ML Catalog Number,Format,Common Name,Scientific Name,Date\n'
    const raw = ['Dark-eyed Junco (Oregon)', 'American Robin', 'Yellow-rumped Warbler (Myrtle)']
    const text = header + raw.map((n, i) => `${i + 1},Photo,"${n}",X y,2020-01-0${i + 1}`).join('\n') + '\n'
    const parsed = parseMLExport(text).rows.map(r => r.commonName)
    expect(parsed).toEqual(raw.map(normalizeSpeciesName))
  })
})

// ── Pass 3: switches, media, ordering, positions ─────────────────────────────

describe('the switches compose (FR-18, FR-19, QA-19)', () => {
  const o = [obs('American Robin', '2020-01-01', null, 'S1'), obs('Mandarin Duck', '2021-01-01', null, 'S2'), obs('Rock Pigeon', '2022-01-01', null, 'S3')]
  const cls: LifeListClassification = { escapees: new Set(['Mandarin Duck']), exotics: new Set(['Rock Pigeon']) }
  const m = [ml('Mandarin Duck', 'Photo', '2021-02-02', '0800', 'ML1')]

  it('each switch adds exactly its species, and turning it off removes exactly those', () => {
    expect(names(list(o, m, controls(), cls))).toEqual(['American Robin'])
    expect(names(list(o, m, controls([], true), cls))).toEqual(['Mandarin Duck', 'American Robin'])
    expect(names(list(o, m, controls([], false, true), cls))).toEqual(['Rock Pigeon', 'American Robin'])
    expect(names(list(o, m, controls([], true, true), cls))).toEqual(['Rock Pigeon', 'Mandarin Duck', 'American Robin'])
  })

  it('a species a switch excludes stays excluded whatever media it has', () => {
    expect(names(list(o, m, controls(['Photo']), cls))).toEqual([])
    expect(names(list(o, m, controls(['Photo'], true), cls))).toEqual(['Mandarin Duck'])
  })

  it('an unresolved classification lists every countable species (QA-20)', () => {
    expect(list(o, [], controls(), NONE)).toHaveLength(3)
  })
})

describe('media life lists (FR-23 to FR-26)', () => {
  const sighting = obs('American Robin', '2015-06-01', '6:00 AM', 'S1')

  it('narrows to the roster: no photo, or not on the roster, is absent (QA-24)', () => {
    const rows = list(
      [sighting, obs('Mallard', '2016-01-01', null, 'S2')],
      [ml('American Robin', 'Photo', '2019-08-14', '0712', 'ML1'), ml('Snowy Owl', 'Photo', '2019-01-01', '0712', 'ML2')],
      controls(['Photo']),
    )
    expect(names(rows)).toEqual(['American Robin'])
  })

  it('one format dates the row to its first asset, not the sighting (QA-25)', () => {
    const r = list([sighting], [ml('American Robin', 'Photo', '2019-08-14', '0712', 'ML1', { checklistId: 'S77', location: 'Lake Park', county: 'Hennepin' })], controls(['Photo']))[0]
    expect(r).toMatchObject({ day: 20190814, time: '7:12 AM', checklistId: 'S77', location: 'Lake Park', place: 'Hennepin' })
  })

  it('several formats date the row to the latest of their firsts (QA-26)', () => {
    const photo = ml('American Robin', 'Photo', '2019-08-14', '0712', 'ML1', { checklistId: 'S77', location: 'Lake Park' })
    const audio = ml('American Robin', 'Audio', '2021-02-03', '0650', 'ML2', { checklistId: 'S90', location: 'River Trail' })
    const pa = list([sighting], [photo, audio], controls(['Photo', 'Audio']))[0]
    expect(pa).toMatchObject({ day: 20210203, time: '6:50 AM', checklistId: 'S90', location: 'River Trail' })
    const early = ml('American Robin', 'Video', '2020-01-01', '0100', 'ML3')
    expect(list([sighting], [photo, audio, early], controls(['Photo', 'Audio', 'Video']))[0].day).toBe(20210203)
    const late = ml('American Robin', 'Video', '2023-05-05', '1015', 'ML4', { checklistId: 'S99', location: 'Bluff' })
    expect(list([sighting], [photo, audio, late], controls(['Photo', 'Audio', 'Video']))[0])
      .toMatchObject({ day: 20230505, time: '10:15 AM', checklistId: 'S99', location: 'Bluff' })
  })

  it('an exact tie between two formats goes to the later format in the manifest order', () => {
    const photo = ml('American Robin', 'Photo', '2021-02-03', '0650', 'ML1', { checklistId: 'S1' })
    const audio = ml('American Robin', 'Audio', '2021-02-03', '0650', 'ML2', { checklistId: 'S2' })
    expect(list([sighting], [photo, audio], controls(['Photo', 'Audio']))[0].checklistId).toBe('S2')
  })

  it('deselecting every format returns the first-sighting list, species with no media included (QA-27)', () => {
    const o = [sighting, obs('Mallard', '2016-01-01', null, 'S2')]
    const m = [ml('American Robin', 'Photo', '2019-08-14', '0712', 'ML1')]
    expect(list(o, m, controls([]))).toEqual(list(o, [], controls([])).map(r => ({ ...r, media: r.name === 'American Robin' ? { photo: true, audio: false, video: false } : r.media })))
    expect(names(list(o, m, controls([])))).toEqual(['Mallard', 'American Robin'])
  })
})

describe('the comparator family (one blank-last rule)', () => {
  it('the same two instants: the timed one is first, the blank one is latest, and the display puts the blank last', () => {
    const timed = { day: 20200505, minute: 360 }, blank = { day: 20200505, minute: null }
    expect(compareInstant(timed.day, timed.minute, blank.day, blank.minute)).toBe(-1)   // minimum: timed (FR-11)
    expect(compareInstant(blank.day, blank.minute, timed.day, timed.minute)).toBe(1)    // maximum: blank (FR-25)
    const row = (minute: number | null, name: string) => ({ name, day: 20200505, minute }) as LifeListRow
    expect(compareDisplay(row(360, 'A'), row(null, 'B'))).toBe(-1)                      // display: timed before blank (FR-28)
  })

  it('orders newest day first, later time first, blank last, then by name (QA-29)', () => {
    const rows = list([
      obs('P', '2020-05-05', '6:00 AM', 'S1'), obs('Q', '2020-05-05', '9:30 AM', 'S2'),
      obs('R', '2020-05-05', null, 'S3'), obs('S', '2020-05-06', '5:00 AM', 'S4'),
      obs('U', '2020-05-04', null, 'S5'), obs('T', '2020-05-04', null, 'S6'),
    ])
    expect(names(rows)).toEqual(['S', 'Q', 'P', 'R', 'T', 'U'])
  })

  it('is identical across a re-derive and a shuffled input (QA-30)', () => {
    const o = Array.from({ length: 300 }, (_, i) => obs(`Bird ${i % 97}`, `20${10 + (i % 9)}-0${(i % 9) + 1}-1${i % 9}`, i % 5 ? `${(i % 12) + 1}:0${i % 10} AM` : null, `S${i}`))
    const a = list(o)
    const shuffled = [...o].reverse().sort((x, y) => (x.submissionId.length % 3) - (y.submissionId.length % 3))
    expect(list(o)).toEqual(a)
    expect(list(shuffled)).toEqual(a)
  })
})

describe('positions, counts and media presence (FR-13, FR-42, FR-44; QA-14, QA-54, QA-56)', () => {
  const o = Array.from({ length: 250 }, (_, i) => obs(`Bird ${String(i).padStart(3, '0')}`, `2020-01-01`, null, `S${i}`))
  const m = o.filter((_, i) => i % 3 === 0).map((x, i) => ml(x.commonName, 'Photo', '2021-01-01', '0800', `ML${i}`))

  it('numbers the newest row N and the oldest 1, and a selection renumbers from its own count', () => {
    const all = list(o, m)
    expect(all.map(r => r.position)).toEqual(Array.from({ length: 250 }, (_, i) => 250 - i))
    const photo = list(o, m, controls(['Photo']))
    expect(photo[0].position).toBe(photo.length)
    expect(photo[photo.length - 1].position).toBe(1)
  })

  it('page two continues from where page one stopped', () => {
    const all = list(o, m)
    const second = pageList(all, PAGE_SIZE * 2).visible
    expect(second[PAGE_SIZE].position).toBe(250 - PAGE_SIZE)
  })

  it('the top position equals the row count for every switch and selection combination', () => {
    const cls: LifeListClassification = { escapees: new Set(['Bird 000']), exotics: new Set(['Bird 003']) }
    for (const esc of [false, true]) for (const exo of [false, true]) for (const sel of SELECTIONS) {
      const rows = list(o, m, controls(sel, esc, exo), cls)
      expect(rows.length === 0 || rows[0].position === rows.length, `${esc} ${exo} ${sel}`).toBe(true)
    }
  })

  it('media presence reports what the species has, identical under every selection', () => {
    const om = [obs('American Robin', '2015-06-01', null, 'S1')]
    const mm = [ml('American Robin', 'Photo', '2019-01-01', '0100', 'ML1'), ml('American Robin', 'Audio', '2019-01-02', '0100', 'ML2')]
    const seen = SELECTIONS.filter(s => !s.includes('Video')).map(s => list(om, mm, controls(s))[0].media)
    for (const m of seen) expect(m).toEqual({ photo: true, audio: true, video: false })
    expect(list(om, [])[0].media).toEqual({ photo: false, audio: false, video: false })
  })

  it('a media row keeps the first sighting binomial (QA-55)', () => {
    const om = [obs('Yellow-rumped Warbler (Audubon\'s)', '2015-06-01', null, 'S1', { scientificName: 'Setophaga coronata auduboni' })]
    const mm = [ml('Yellow-rumped Warbler', 'Photo', '2019-01-01', '0100', 'ML1', { scientificName: 'Setophaga coronata coronata' })]
    expect(list(om, mm, controls(['Photo']))[0].scientificName).toBe('Setophaga coronata')
  })

  it('holds at most one asset record per species per format (QA-46)', () => {
    const many = Array.from({ length: 30 }, (_, i) => ml('American Robin', MEDIA_FORMATS[i % 3], '2019-01-01', String(100 + i), `ML${i}`))
    const a = deriveFirstAssets(many)
    expect(a.size).toBe(1)
    expect(Object.keys(a.get('American Robin')!).sort()).toEqual(['Audio', 'Photo', 'Video'])
  })
})

// ── The file-scoped absence guard (schema section 7; testing.md v1.0.23) ─────

/** Drop line and block comments, line-wise (the weatherStats.test.ts shape). */
function stripComments(src: string): string {
  const BLOCK_OPEN = '/' + '*'
  const BLOCK_CLOSE = '*' + '/'
  const out: string[] = []
  let inBlock = false
  for (const line of src.split('\n')) {
    let l = line
    if (inBlock) {
      const close = l.indexOf(BLOCK_CLOSE)
      if (close === -1) continue
      inBlock = false
      l = l.slice(close + 2)
    }
    const open = l.indexOf(BLOCK_OPEN)
    if (open !== -1) {
      const close = l.indexOf(BLOCK_CLOSE, open + 2)
      if (close === -1) { inBlock = true; l = l.slice(0, open) }
      else l = l.slice(0, open) + l.slice(close + 2)
    }
    const lineComment = l.indexOf('//')
    if (lineComment !== -1) l = l.slice(0, lineComment)
    out.push(l)
  }
  return out.join('\n')
}

describe('lifeLists.ts reads parsed fields through hand loops only', () => {
  const raw = readFileSync(fileURLToPath(new URL('./lifeLists.ts', import.meta.url)), 'utf8')
  const code = stripComments(raw)

  it('holds no regex and none of the search primitives, comments stripped', () => {
    const FORBIDDEN = ['.includes(', '.indexOf(', '.find(', '.filter(', '.match(', '.search(', '.split(', '.replace(', '.test(', '.exec(', 'RegExp']
    for (const f of FORBIDDEN) expect(code, f).not.toContain(f)
  })

  it('the strip is proven: the comments name a primitive the code does not use', () => {
    expect(raw).toContain(".split('-')[1]")
    expect(code).not.toContain(".split('-')[1]")
    expect(code.length).toBeGreaterThan(5000)
  })

  it('each file pass is one loop over its rows, with no loop nested inside it', () => {
    for (const fn of ['deriveFirstSightings', 'deriveFirstAssets']) {
      const at = code.indexOf(`export function ${fn}(`)
      const body = code.slice(at, code.indexOf('\n}\n', at))
      expect(body.split('for (').length - 1, fn).toBe(1)
      expect(body, fn).not.toContain('while')
    }
  })

  it('holds no literal control or non-ASCII character outside comments', () => {
    const bad: number[] = []
    for (let i = 0; i < code.length; i++) {
      const c = code.charCodeAt(i)
      if ((c < 0x20 && c !== 0x0a && c !== 0x0d) || c > 0x7e) bad.push(c)
    }
    expect(bad).toEqual([])
  })
})
