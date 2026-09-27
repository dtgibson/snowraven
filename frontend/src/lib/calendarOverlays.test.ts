// Unit coverage for the calendar-overlays pure module (schema.md 1.2, 4.2, 6.2 to
// 6.4; PRD FR-04, FR-17, FR-25, FR-29, FR-37, FR-38; QA-04, QA-19, QA-28,
// QA-29, QA-33, QA-48). No DOM: this module is React-free and lucide-free by
// contract, which the last describe asserts from its source.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  normalizeCalendarOverlays, DEFAULT_CALENDAR_OVERLAYS, CALENDAR_OVERLAYS_SETTING_KEY,
  OVERLAY_MARK_SPECS, codeText, tileCodeText, TILE_CODE_MAX_CODE_POINTS, tileRows, mediaFormatPhrases, dayNameSuffix,
  TILE_CODE_ROW_CAP, legendMediaKeys, LEGEND_BREEDING_KEYS, categoryCountDigits,
  type CalendarOverlays, type TileRow,
} from './calendarOverlays'
import { resolveDisplayBreedingCode } from './breedingCodes'
import { mediaFormatCounts } from './observationMedia'
import { buildDayCells, type DayCell } from './calendar'
import type { ObservationEntry } from '../types'

const ON: CalendarOverlays = { media: true, breeding: true, codes: 'every' }
const OFF: CalendarOverlays = { media: false, breeding: false, codes: 'every' }

// A cell's overlay facts built BY buildDayCells itself from rows, never
// hand-typed: the strongest-first order and the category unions are the
// production ones, so a change to the real derivation reorders every fixture
// here at once (testing.md, the production-order fixture rule).
function obsRow(submissionId: string, commonName: string, breedingCode: string | null, catalogIds: string[]): ObservationEntry {
  return {
    submissionId, commonName, scientificName: 'Sci name', date: '2025-05-17', location: 'West Pond', locationId: 'L1',
    latitude: null, longitude: null, county: null, count: 1, breedingCode, speciesComments: '', catalogIds,
  }
}
function cellOf(opts: { ids?: string[]; codes?: [string, string[]][] }): DayCell {
  const rows = [obsRow('S1', 'Anchor Bird', null, opts.ids ?? [])]
  for (const [code, species] of opts.codes ?? []) for (const name of species) rows.push(obsRow('S1', name, code, []))
  return buildDayCells(rows, { kind: 'year', year: 2025 }).get('2025-05-17')!
}
const sp = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}${i}`)
const show = (rows: TileRow[]) => rows.map(r =>
  r.kind === 'more' ? `+${r.count}`
    : r.kind === 'media' ? `${r.key}:${r.count}`
      : r.kind === 'category' ? `cat:${r.key}:${r.label ?? '-'}:${r.count}`
        : `${r.key}:${r.code}:${r.count ?? '-'}`)

describe('normalizeCalendarOverlays (FR-04, QA-04)', () => {
  it('the key and the frozen default', () => {
    expect(CALENDAR_OVERLAYS_SETTING_KEY).toBe('calendarOverlays')
    expect(DEFAULT_CALENDAR_OVERLAYS).toEqual({ media: false, breeding: false, codes: 'every' })
    expect(Object.isFrozen(DEFAULT_CALENDAR_OVERLAYS)).toBe(true)
  })

  it('a value that is not a plain object reads as the default', () => {
    for (const raw of [null, undefined, 'yes', 42, true, [], [true, true], () => 1]) {
      expect(normalizeCalendarOverlays(raw)).toBe(DEFAULT_CALENDAR_OVERLAYS)
    }
  })

  it('each boolean is honoured only when strictly a boolean', () => {
    expect(normalizeCalendarOverlays({ media: 'true' })).toEqual({ media: false, breeding: false, codes: 'every' })
    expect(normalizeCalendarOverlays({ media: 1, breeding: true })).toEqual({ media: false, breeding: true, codes: 'every' })
    expect(normalizeCalendarOverlays({ media: true, breeding: null })).toEqual({ media: true, breeding: false, codes: 'every' })
  })

  it('codes is honoured only when strictly "every" or "category"', () => {
    expect(normalizeCalendarOverlays({ breeding: true, codes: 'category' })).toEqual({ media: false, breeding: true, codes: 'category' })
    expect(normalizeCalendarOverlays({ breeding: true, codes: 'both' }).codes).toBe('every')
    expect(normalizeCalendarOverlays({ codes: 'Category' }).codes).toBe('every')
    expect(normalizeCalendarOverlays({ codes: ' category' }).codes).toBe('every')
    expect(normalizeCalendarOverlays({ codes: 1 }).codes).toBe('every')
    expect(normalizeCalendarOverlays({ codes: null }).codes).toBe('every')
    expect(normalizeCalendarOverlays({ media: 1, breeding: true, codes: 'CATEGORY' })).toEqual({ media: false, breeding: true, codes: 'every' })
  })

  it('a stored codes: category with Breeding off is kept (the gate is in the component, not the value)', () => {
    expect(normalizeCalendarOverlays({ media: false, breeding: false, codes: 'category' })).toEqual({ media: false, breeding: false, codes: 'category' })
  })

  it('a pre-amendment two-field document reads codes as "every"; unknown keys are dropped', () => {
    expect(normalizeCalendarOverlays({ media: true, breeding: false })).toEqual({ media: true, breeding: false, codes: 'every' })
    const out = normalizeCalendarOverlays({ media: true, extra: 'x', __proto__: { breeding: true } })
    expect(out).toEqual({ media: true, breeding: false, codes: 'every' })
    expect(Object.keys(out).sort()).toEqual(['breeding', 'codes', 'media'])
  })

  // security.md, the lookup-table rule: a normalizer's malformed-input list
  // carries prototype-chain member names, and a pollution probe written with
  // JSON.parse. An object literal's __proto__ sets the prototype and creates no
  // own key; JSON.parse creates the own "__proto__" key that CAN arrive from
  // storage, which a copy through a setter (Object.assign) would turn into a
  // prototype carrying media and breeding.
  it('an own "__proto__" key from JSON.parse reads as the default (the shape storage can deliver)', () => {
    const polluted = JSON.parse('{"__proto__":{"media":true,"breeding":true,"codes":"category"}}')
    expect(Object.hasOwn(polluted, '__proto__')).toBe(true)
    expect(normalizeCalendarOverlays(polluted)).toBe(DEFAULT_CALENDAR_OVERLAYS)
  })

  it('prototype-chain member names as values read as the default', () => {
    expect(normalizeCalendarOverlays({ media: 'constructor', breeding: '__proto__', codes: 'toString' })).toBe(DEFAULT_CALENDAR_OVERLAYS)
  })

  it('returns the frozen default only when all three fields equal it', () => {
    expect(normalizeCalendarOverlays({ media: false, breeding: false, codes: 'every' })).toBe(DEFAULT_CALENDAR_OVERLAYS)
    expect(normalizeCalendarOverlays({})).toBe(DEFAULT_CALENDAR_OVERLAYS)
    const on = normalizeCalendarOverlays({ media: true })
    expect(on).not.toBe(DEFAULT_CALENDAR_OVERLAYS)
    expect(Object.isFrozen(on)).toBe(false)
  })
})

describe('mediaFormatPhrases (FR-25, QA-29)', () => {
  const c = (photo: number, audio: number, video: number, unknown: number) =>
    ({ total: photo + audio + video + unknown, photo, audio, video, unknown })

  it('no count of one takes a plural noun, for every format and the unknown bucket', () => {
    expect(mediaFormatPhrases(c(1, 1, 1, 1))).toEqual(['1 photo', '1 audio', '1 video', '1 media'])
    expect(mediaFormatPhrases(c(2, 2, 2, 2))).toEqual(['2 photos', '2 audio', '2 videos', '2 media'])
    for (let n = 1; n <= 3; n++) {
      for (const phrase of mediaFormatPhrases(c(n, n, n, n))) expect(phrase).not.toMatch(/^1 [a-z]+s$/)
    }
  })

  it('fixed order photo, audio, video, unknown; zeros omitted; empty for a null-map count', () => {
    expect(mediaFormatPhrases(c(0, 3, 0, 0))).toEqual(['3 audio'])
    expect(mediaFormatPhrases(c(4, 0, 1, 0))).toEqual(['4 photos', '1 video'])
    expect(mediaFormatPhrases(mediaFormatCounts(['1', '2'], null))).toEqual([])
  })
})

describe('tileCodeText: the bound a tile is designed and measured at (QA F2)', () => {
  const t = (code: string) => tileCodeText(resolveDisplayBreedingCode(code))
  it('a known code is its own text, whatever its length', () => {
    expect(t('NY')).toBe('NY')
    expect(t('S7')).toBe('S7')
    expect(t('F')).toBe('F')
  })
  it('an unknown code up to the whole-code bound is shown whole, as a real code would be', () => {
    expect(TILE_CODE_MAX_CODE_POINTS).toBe(2)
    expect(t('ZZ')).toBe('ZZ')
    expect(t('Q')).toBe('Q')
  })
  it('a longer unknown code shows its first code point and an ellipsis', () => {
    expect(t('XYZ')).toBe('X\u2026')
    expect(t('ABCDEFGHIJ')).toBe('A\u2026')
    expect(t('X'.repeat(100_000))).toBe('X\u2026')
  })
  it('never splits an astral character, at either side of the bound', () => {
    const bird = '\u{1F426}'
    expect(t(bird + bird)).toBe(bird + bird)
    expect(t(bird + bird + bird)).toBe(bird + '\u2026')
    expect(t(bird + 'AB')).toBe(bird + '\u2026')
  })
  it('the tile bound is tighter than the popup and name bound, which is unchanged', () => {
    const def = resolveDisplayBreedingCode('ABCDEFGHIJ')
    expect(codeText(def)).toBe('ABCDEFGH\u2026')
    expect(tileCodeText(def).length).toBeLessThan(codeText(def).length)
  })
})

describe('codeText (schema.md 6.4)', () => {
  const t = (code: string) => codeText(resolveDisplayBreedingCode(code))
  it('a known code is its own text', () => {
    expect(t('NY')).toBe('NY')
    expect(t('S7')).toBe('S7')
  })
  it('an unknown code up to 8 code points is shown whole; longer is cut with an ellipsis', () => {
    expect(t('ABCDEFGH')).toBe('ABCDEFGH')
    expect(t('ABCDEFGHI')).toBe('ABCDEFGH…')
    expect(t('X'.repeat(100_000))).toBe('XXXXXXXX…')
  })
  it('never splits an astral character', () => {
    const bird = '\u{1F426}'
    expect(t(`ABCDEFG${bird}`)).toBe(`ABCDEFG${bird}`)
    expect(t(`ABCDEFG${bird}Z`)).toBe(`ABCDEFG${bird}…`)
    expect(t(`${bird.repeat(9)}`)).toBe(`${bird.repeat(8)}…`)
  })
})

describe('dayNameSuffix (FR-29, QA-33)', () => {
  const map = { '1': 'Photo', '2': 'Photo', '3': 'Photo', '4': 'Audio' }
  const cell = cellOf({ ids: ['1', '2', '3', '4'], codes: [['NB', ['a']], ['S', ['b', 'c']]] })

  it('both on with the export loaded: per-format media, then every code with count and category', () => {
    expect(dayNameSuffix(cell, ON, map)).toBe(', media: 3 photos, 1 audio, breeding: NB 1 (Confirmed), S 2 (Possible)')
  })
  it('without the export (or none resolving) the media clause is the plain total', () => {
    expect(dayNameSuffix(cell, ON, null)).toBe(', media: 4, breeding: NB 1 (Confirmed), S 2 (Possible)')
    expect(dayNameSuffix(cell, ON, { '99': 'Photo' })).toBe(', media: 4, breeding: NB 1 (Confirmed), S 2 (Possible)')
  })
  it('an unknown bucket beside resolved formats reads as "N media"', () => {
    expect(dayNameSuffix(cellOf({ ids: ['1', '2', '3', '9', '8'] }), ON, map)).toBe(', media: 3 photos, 2 media')
  })
  it('each clause only while its overlay is on; nothing for an unmarked day or with both off', () => {
    expect(dayNameSuffix(cell, { ...OFF, media: true }, null)).toBe(', media: 4')
    expect(dayNameSuffix(cell, { ...OFF, breeding: true }, null)).toBe(', breeding: NB 1 (Confirmed), S 2 (Possible)')
    expect(dayNameSuffix(cell, OFF, map)).toBe('')
    expect(dayNameSuffix(cellOf({}), ON, map)).toBe('')
  })
  it('reads EVERY code, past the tile\'s row cap: the name is never shortened to what the tile shows', () => {
    const busy = cellOf({ codes: [['NY', ['a']], ['A', ['b', 'c']], ['P', ['d']], ['S', ['e', 'f', 'g']], ['H', ['h']]] })
    expect(busy.codes.length).toBeGreaterThan(TILE_CODE_ROW_CAP)
    expect(dayNameSuffix(busy, ON, null)).toBe(', breeding: NY 1 (Confirmed), A 2 (Probable), P 1 (Probable), S 3 (Possible), H 1 (Possible)')
  })

  it('"By category" never shortens the name, and an unknown code is bounded', () => {
    expect(dayNameSuffix(cell, { ...ON, codes: 'category' }, map)).toBe(dayNameSuffix(cell, ON, map))
    const long = cellOf({ codes: [['ABCDEFGHIJKLMNOP', ['a']]] })
    expect(dayNameSuffix(long, ON, null)).toBe(', breeding: ABCDEFGH… 1 (Possible)')
  })
})

describe('tileRows (FR-17, FR-37, FR-38; QA-19, QA-28, QA-48)', () => {
  it('both lists are empty with both overlays off, whatever the day carries', () => {
    const c = cellOf({ ids: ['1'], codes: [['NY', ['a']]] })
    expect(tileRows(c, OFF, null)).toEqual({ rich: [], condensed: [] })
  })

  it('media with the export: one row per format present in photo, audio, video order, then the frame for unnamed ids (QA-28)', () => {
    const map = { '1': 'Photo', '2': 'Photo', '3': 'Audio' }
    expect(show(tileRows(cellOf({ ids: ['1', '2', '3', '9'] }), { ...OFF, media: true }, map).rich)).toEqual(['photo:2', 'audio:1', 'media:1'])
    expect(show(tileRows(cellOf({ ids: ['3', '1'] }), { ...OFF, media: true }, map).rich)).toEqual(['photo:1', 'audio:1'])
  })

  it('media without the export: one frame row with the total; with no id resolving, the frame carries them all', () => {
    expect(show(tileRows(cellOf({ ids: ['1', '2', '3'] }), { ...OFF, media: true }, null).rich)).toEqual(['media:3'])
    expect(show(tileRows(cellOf({ ids: ['1', '2'] }), { ...OFF, media: true }, { '9': 'Video' }).rich)).toEqual(['media:2'])
  })

  it('every code: strongest first, capped at three rows then +N (QA-48)', () => {
    const c = cellOf({ codes: [['S', sp(3, 's')], ['H', ['h0']], ['NY', ['n0']], ['A', sp(2, 'a')], ['P', ['p0']]] })
    expect(TILE_CODE_ROW_CAP).toBe(3)
    expect(show(tileRows(c, { ...OFF, breeding: true }, null).rich)).toEqual(['confirmed:NY:1', 'probable:A:2', 'probable:P:1', '+2'])
  })

  it('by category names the CATEGORIES, never a code: one row per category present, short form, distinct species (QA-48, amended per D4-11)', () => {
    // NY 1, A 2, S 3, H 1, P 1 (P is Probable in the table): Probable counts
    // the A and P species distinctly (3), Possible the S and H species (4).
    const c = cellOf({ codes: [['NY', ['n0']], ['A', sp(2, 'a')], ['S', sp(3, 's')], ['H', ['h0']], ['P', ['p0']]] })
    const rows = tileRows(c, { ...OFF, breeding: true, codes: 'category' }, null)
    expect(show(rows.rich)).toEqual(['cat:confirmed:Conf:1', 'cat:probable:Prob:3', 'cat:possible:Poss:4'])
    expect(rows.rich.some(r => r.kind === 'code' || r.kind === 'more')).toBe(false)
  })

  it('the June 21 specimen (FY, CF, NB, S, H): "Conf 3" and "Poss 2" only, no code and no row for an absent category', () => {
    const c = cellOf({ codes: [['FY', ['Western Bluebird']], ['NB', ['Bushtit']], ['CF', ['Acorn Woodpecker']], ['S', ['Oak Titmouse']], ['H', ['Wrentit']]] })
    const rows = tileRows(c, { ...OFF, breeding: true, codes: 'category' }, null)
    expect(show(rows.rich)).toEqual(['cat:confirmed:Conf:3', 'cat:possible:Poss:2'])
    const printed = JSON.stringify(rows)
    for (const code of ['FY', 'CF', 'NB', '"S"', '"H"']) expect(printed).not.toContain(code)
    // Every code is still one tap away, and still in the name.
    expect(show(tileRows(c, { ...OFF, breeding: true }, null).rich)).toEqual(['confirmed:FY:1', 'confirmed:CF:1', 'confirmed:NB:1', '+2'])
  })

  it('by category counts a species at a category once, however many codes it carried there', () => {
    const c = cellOf({ codes: [['S', ['x', 'y']], ['H', ['x']]] })
    expect(show(tileRows(c, { ...OFF, breeding: true, codes: 'category' }, null).rich)).toEqual(['cat:possible:Poss:2'])
  })

  it('a By-category tile states its widest count\'s digits, which pick the width it turns compact at (E5-12)', () => {
    const cat = { ...OFF, breeding: true, codes: 'category' } as const
    const digits = (codes: [string, string[]][], ov: CalendarOverlays = cat) => categoryCountDigits(tileRows(cellOf({ codes }), ov, null).rich)
    expect(digits([['NY', sp(9, 'n')], ['S', ['s0']]])).toBe(1)
    expect(digits([['NY', ['n0']], ['S', sp(10, 's')]])).toBe(2)
    expect(digits([['S', sp(99, 's')]])).toBe(2)
    expect(digits([['H', sp(100, 'h')]])).toBe(3)
    expect(digits([['H', sp(1000, 'h')]])).toBe(3)
    // Every code: no category row, so the ordinary rich/condensed width holds.
    expect(digits([['S', sp(12, 's')]], { ...OFF, breeding: true, codes: 'every' })).toBe(0)
    expect(categoryCountDigits([])).toBe(0)
  })

  it('three or fewer codes: no +N row', () => {
    const c = cellOf({ codes: [['NY', ['a']], ['A', ['b']], ['S', ['c']]] })
    const rich = tileRows(c, { ...OFF, breeding: true }, null).rich
    expect(rich.some(r => r.kind === 'more')).toBe(false)
    expect(rich).toHaveLength(3)
  })

  it('condensed, every code: one frame row with the total, the strongest code with no count, +N = codes minus one (FR-38)', () => {
    const c = cellOf({ ids: ['1', '2'], codes: [['S', ['a']], ['NY', ['b']], ['A', ['c']], ['H', ['d']]] })
    const map = { '1': 'Photo', '2': 'Audio' }
    expect(show(tileRows(c, { media: true, breeding: true, codes: 'every' }, map).condensed)).toEqual(['media:2', 'confirmed:NY:-', '+3'])
    expect(show(tileRows(cellOf({ codes: [['S', ['a']]] }), ON, null).condensed)).toEqual(['possible:S:-'])
  })

  it('condensed, by category: the frame row, then every category present as circle and count, no text and no +N (FR-38, amended per D4-11)', () => {
    const c = cellOf({ ids: ['1', '2'], codes: [['S', ['a']], ['NY', ['b']], ['A', ['c']], ['H', ['d']]] })
    const map = { '1': 'Photo', '2': 'Audio' }
    expect(show(tileRows(c, { media: true, breeding: true, codes: 'category' }, map).condensed))
      .toEqual(['media:2', 'cat:confirmed:-:1', 'cat:probable:-:1', 'cat:possible:-:2'])
  })

  it('a day with both facts carries both sets, media first', () => {
    const c = cellOf({ ids: ['1'], codes: [['NY', ['a']]] })
    expect(show(tileRows(c, ON, null).rich)).toEqual(['media:1', 'confirmed:NY:1'])
  })

  it('an unknown code on a tile is bounded text', () => {
    const c = cellOf({ codes: [['LONGUNKNOWNCODE', ['a']]] })
    // The tile's own bound (tileCodeText), in both blocks; the name keeps codeText.
    expect(show(tileRows(c, ON, null).rich)).toEqual(['possible:L\u2026:1'])
    expect(show(tileRows(c, ON, null).condensed)).toEqual(['possible:L\u2026:-'])
    expect(dayNameSuffix(c, ON, null)).toBe(', breeding: LONGUNKN\u2026 1 (Possible)')
  })
})

describe('OVERLAY_MARK_SPECS (schema.md 6.3)', () => {
  it('has exactly the seven keys, each spec keyed by its own key', () => {
    expect(Object.keys(OVERLAY_MARK_SPECS).sort()).toEqual(['audio', 'confirmed', 'media', 'photo', 'possible', 'probable', 'video'])
    for (const [k, spec] of Object.entries(OVERLAY_MARK_SPECS)) expect(spec.key).toBe(k)
  })
  it('every mark is drawn in the cell\'s own number colour (D4-02)', () => {
    for (const spec of Object.values(OVERLAY_MARK_SPECS)) expect(spec.token).toBe('var(--sr-cal-fg)')
  })
  it('lucide glyphs are named, never imported, and are one of the three Multimedia glyphs', () => {
    const lucide = Object.values(OVERLAY_MARK_SPECS).filter(s => s.glyph.kind === 'lucide')
    expect(lucide.map(s => s.key).sort()).toEqual(['audio', 'photo', 'video'])
    for (const s of lucide) if (s.glyph.kind === 'lucide') expect(['camera', 'mic', 'video']).toContain(s.glyph.icon)
  })
  it('the three categories differ by SHAPE (fill pattern), never by colour alone (QA-20)', () => {
    const shape = (k: 'confirmed' | 'probable' | 'possible') => {
      const g = OVERLAY_MARK_SPECS[k].glyph
      return g.kind === 'path' ? g.paths.map(p => `${p.filled ? 'F' : 'O'}:${p.d}`).join('|') : ''
    }
    const shapes = new Set([shape('confirmed'), shape('probable'), shape('possible')])
    expect(shapes.size).toBe(3)
    // Solid has only a filled path, open only an outline, half both.
    const fills = (k: 'confirmed' | 'probable' | 'possible') => {
      const g = OVERLAY_MARK_SPECS[k].glyph
      return g.kind === 'path' ? g.paths.map(p => p.filled) : []
    }
    expect(fills('confirmed')).toEqual([true])
    expect(fills('probable')).toEqual([false, true])
    expect(fills('possible')).toEqual([false])
  })
  it('the legend reads its entries from the same table: formats with the export, the frame without; categories strongest first', () => {
    expect(legendMediaKeys(true).map(k => OVERLAY_MARK_SPECS[k].label)).toEqual(['photos', 'audio', 'videos', 'media'])
    expect(legendMediaKeys(false).map(k => OVERLAY_MARK_SPECS[k].label)).toEqual(['media'])
    expect(LEGEND_BREEDING_KEYS.map(k => OVERLAY_MARK_SPECS[k].label)).toEqual(['Confirmed', 'Probable', 'Possible'])
  })
})

// Comments stripped first, so a file's prose cannot satisfy or fail a scan
// (testing.md, the comment-stripping rule): whole-line `//` and `/* */` blocks.
function source(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
}

describe('one table, one derivation (QA-34) and no new scan over raw text (QA-43)', () => {
  const tsx = source('../components/Calendar.tsx')
  const cal = source('./calendar.ts')

  it('Calendar.tsx renders the tile from tileRows and every mark and legend entry from OVERLAY_MARK_SPECS', () => {
    expect(tsx).toMatch(/\btileRows\(/)
    expect(tsx).toMatch(/OVERLAY_MARK_SPECS\[mark\]\.glyph/) // MarkGlyph: cells, legend, popup
    expect(tsx).toMatch(/OVERLAY_MARK_SPECS\[k\]\.label/) // the legend's entry text
    // No second row derivation in the component: the cap and the grouping live
    // in lib/calendarOverlays.ts only.
    expect(tsx).not.toMatch(/TILE_CODE_ROW_CAP/)
    expect(tsx).not.toMatch(/codeCategoryCounts/)
  })

  it('calendar.ts carries exactly one regex (DATE_RE) and no split, and its pass does no linear search', () => {
    const regexLiterals = cal.match(/(?:^|[=(,:!&|?]\s*)\/[^/*\s\n][^/\n]*\/[gimsuy]*/gm) ?? []
    expect(regexLiterals).toHaveLength(1)
    expect(regexLiterals[0]).toContain('[0-9]{4}-[0-9]{2}-[0-9]{2}')
    expect(cal).not.toMatch(/\.split\(/)
    const pass = cal.slice(cal.indexOf('export function buildDayCells'), cal.indexOf('export function dataYears'))
    expect(pass.length).toBeGreaterThan(1000)
    for (const scan of ['.indexOf(', '.includes(', '.find(', '.filter(', 'RegExp(']) expect(pass).not.toContain(scan)
  })
})

describe('module boundary (schema.md section 8)', () => {
  const src = source('./calendarOverlays.ts')
  const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map(m => m[1])
  it('imports no React, no lucide and no storage, so it runs in node with no DOM', () => {
    expect(imports.length).toBeGreaterThan(0)
    expect(imports.some(s => s === 'react' || s.startsWith('react/'))).toBe(false)
    expect(imports).not.toContain('lucide-react')
    expect(imports.some(s => s.includes('storage'))).toBe(false)
  })
})
