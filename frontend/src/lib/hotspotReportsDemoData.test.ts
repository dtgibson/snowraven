/// <reference types="node" />
// The demo dataset every website and App Store screenshot is captured from
// (hotspot-reports FR-62, QA-60; schema.md section 14), read through the app's
// OWN parser and statistics rather than described. `buildDemoData()` is the
// generator's pure core (website/tools/gen-demo-data.mjs): nothing here reads
// the gitignored website/tools/demo-data/ folder, so these rows hold on a fresh
// clone and in CI, and a regeneration that would photograph a Weather summary
// below its floor goes red here before any frame is captured.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buildDemoData, FRAMED_LOCATION_ID, LOCS, WEATHER_BLOCK_EVERY,
} from '../../../website/tools/gen-demo-data.mjs'
import { parseEbirdObservations, streamCsvRows } from './parseEbirdObservations'
import { computeChecklists } from './birdingStats'
import { computeWeatherStats, WEATHER_SPECIES_MIN_CHECKLISTS } from './weatherStats'
import type { WeatherDistRow } from './weatherStats'
import { hasAnyWeatherField, parseWeatherBlock } from './weatherBlockParse'
import type { WeatherRecord } from './weatherBlockParse'
import { findBlockSpans, hasSnowravenWeatherBlock, stripWeatherTideBlocks } from './commentBlocks'
import { decodeEntities } from './commentText'
import { ATTRIBUTION, CONDITION_EMOJI } from './weatherFormatter'

const WITH = buildDemoData()
const WITHOUT = buildDemoData({ weather: false })

const OBS = parseEbirdObservations(WITH.ebirdCsv)
const FRAMED_OBS = OBS.filter(o => o.locationId === FRAMED_LOCATION_ID)
const FRAMED_CHECKLISTS = computeChecklists(FRAMED_OBS)
const WEATHER = computeWeatherStats(FRAMED_CHECKLISTS, FRAMED_OBS)

/** Each submission's comment in the dataset WITHOUT the post-pass. */
const PLAIN_COMMENT = new Map(
  parseEbirdObservations(WITHOUT.ebirdCsv).map(o => [o.submissionId, o.checklistComments ?? '']),
)

const denominator = (rows: readonly WeatherDistRow[]): number => rows.reduce((n, r) => n + r.checklists, 0)
const bandsUsed = (rows: readonly WeatherDistRow[]): number => rows.reduce((n, r) => n + (r.checklists > 0 ? 1 : 0), 0)

/** Every row of a CSV text through the app's own reader, copied out of its
 *  reused row array. */
function csvRows(text: string): string[][] {
  const out: string[][] = []
  for (const row of streamCsvRows(text)) out.push([...row])
  return out
}

/** "07:45 AM" -> minutes after midnight, for the date order the schema names. */
function minutesOf(time: string | null): number {
  const m = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(time ?? '')
  if (!m) throw new Error(`unexpected time ${time}`)
  return (Number(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2])
}

describe('the demo dataset the screenshots are captured from (QA-60)', () => {
  it('holds several locations, at least two of which share a State/Province code', () => {
    const byState = new Map<string, Set<string>>()
    for (const o of OBS) {
      const state = o.stateProvince ?? ''
      if (!byState.has(state)) byState.set(state, new Set())
      byState.get(state)!.add(o.locationId)
    }
    expect(new Set(OBS.map(o => o.locationId))).toEqual(new Set(LOCS.map(l => l.locId)))
    expect(LOCS.length).toBeGreaterThanOrEqual(3)
    expect([...byState.entries()].filter(([state, ids]) => state !== '' && ids.size >= 2).length).toBeGreaterThan(0)
  })

  it('carries at least the floor of readable weather blocks at the framed location, and no unreadable one', () => {
    expect(FRAMED_CHECKLISTS.length).toBeGreaterThan(0)
    expect(WEATHER.unreadableCount).toBe(0)
    expect(WEATHER.foundCount).toBe(WEATHER.readableCount)
    expect(WEATHER.readableCount).toBeGreaterThanOrEqual(WEATHER_SPECIES_MIN_CHECKLISTS)
    expect(WEATHER.readableCount).toBe(Math.ceil(FRAMED_CHECKLISTS.length / WEATHER_BLOCK_EVERY))
  })

  it('gives sky condition, temperature and wind each a denominator at or above the floor, spread over several bands', () => {
    const axes = [
      ['sky condition', WEATHER.byCondition],
      ['temperature', WEATHER.byTempBand],
      ['wind', WEATHER.byWindBand],
    ] as const
    for (const [axis, rows] of axes) {
      expect(denominator(rows), axis).toBeGreaterThanOrEqual(WEATHER_SPECIES_MIN_CHECKLISTS)
      expect(bandsUsed(rows), axis).toBeGreaterThanOrEqual(3)
    }
  })

  it('writes every block in the formatter\'s form: each field reads back, under a daytime header glyph, with the attribution last', () => {
    const fields = Object.keys(parseWeatherBlock('')) as Array<keyof WeatherRecord>
    expect(fields.length).toBe(10)
    let checked = 0
    for (const c of FRAMED_CHECKLISTS) {
      const comment = c.checklistComments
      const rec = parseWeatherBlock(comment)
      if (!hasAnyWeatherField(rec)) continue
      checked++
      expect(fields.filter(f => rec[f] === null), c.submissionId).toEqual([])
      expect(rec.dayNight, c.submissionId).toBe('day')

      const spans = findBlockSpans(comment)
      expect(spans.length, c.submissionId).toBe(1)
      const span = decodeEntities(comment).slice(spans[0].start, spans[0].end)
      // The exact presentation conditionEmoji() writes, variation selector
      // included, then the collapsed line break: a header the parser would
      // still match (it ignores U+FE0F) but the formatter never writes fails.
      expect(CONDITION_EMOJI.filter(e => span.startsWith(`${e} `)).length, c.submissionId).toBe(1)
      expect(span.endsWith(ATTRIBUTION), c.submissionId).toBe(true)
      // Hiding the block leaves exactly the prose the checklist had before.
      expect(stripWeatherTideBlocks(comment), c.submissionId)
        .toBe(decodeEntities(PLAIN_COMMENT.get(c.submissionId) ?? '').trim())
    }
    expect(checked).toBe(WEATHER.readableCount)
    // Some of them follow prose, so the strip comparison is not only ever ''.
    expect(FRAMED_CHECKLISTS.filter(c => hasAnyWeatherField(parseWeatherBlock(c.checklistComments))
      && (PLAIN_COMMENT.get(c.submissionId) ?? '') !== '').length).toBeGreaterThan(0)
  })

  it('puts blocks only at the framed location, on every WEATHER_BLOCK_EVERY-th of its checklists in date order', () => {
    const all = computeChecklists(OBS)
    const withBlock = all.filter(c => hasSnowravenWeatherBlock(c.checklistComments))
    expect(withBlock.length).toBe(WEATHER.readableCount)
    expect(withBlock.filter(c => c.locationId !== FRAMED_LOCATION_ID)).toEqual([])

    const ordered = [...FRAMED_CHECKLISTS].sort((a, b) =>
      a.date.localeCompare(b.date) || minutesOf(a.time) - minutesOf(b.time) || a.submissionId.localeCompare(b.submissionId))
    const positions = ordered.flatMap((c, i) => (hasSnowravenWeatherBlock(c.checklistComments) ? [i] : []))
    expect(positions).toEqual(ordered.flatMap((_, i) => (i % WEATHER_BLOCK_EVERY === 0 ? [i] : [])))
  })

  it('changes Checklist Comments and nothing else when the post-pass is on, and leaves the ML export byte-identical', () => {
    const off = csvRows(WITHOUT.ebirdCsv)
    const on = csvRows(WITH.ebirdCsv)
    expect(on.length).toBe(off.length)
    expect(on[0]).toEqual(off[0])
    const ci = off[0].indexOf('Checklist Comments')
    expect(ci).toBeGreaterThan(-1)

    const otherCells: string[] = []
    const notAppended: number[] = []
    const changedSubs = new Set<string>()
    let changedRows = 0
    for (let i = 1; i < off.length; i++) {
      if (on[i].length !== off[i].length) { otherCells.push(`row ${i}: ${on[i].length} cells, was ${off[i].length}`); continue }
      for (let j = 0; j < off[i].length; j++) {
        if (j !== ci && on[i][j] !== off[i][j]) otherCells.push(`row ${i} ${off[0][j]}`)
      }
      if (on[i][ci] !== off[i][ci]) {
        changedRows++
        changedSubs.add(on[i][0])
        if (!on[i][ci].startsWith(off[i][ci])) notAppended.push(i)
      }
    }
    expect(otherCells).toEqual([])
    expect(notAppended).toEqual([])
    // Non-vacuity: the column did change, on every row of every block-bearing
    // checklist and on no other.
    expect(changedSubs.size).toBe(WEATHER.readableCount)
    expect(changedRows).toBe(FRAMED_OBS.filter(o => changedSubs.has(o.submissionId)).length)

    expect(WITH.mlCsv === WITHOUT.mlCsv).toBe(true)
    expect(WITH.mlCsv.length).toBeGreaterThan(0)
  })
})

describe('the generator source (CLAUDE.md, the non-ASCII literal rule)', () => {
  it('holds no literal non-ASCII character: the weather emoji, the degree sign and the curly apostrophes are written as escapes', () => {
    const src = readFileSync(new URL('../../../website/tools/gen-demo-data.mjs', import.meta.url), 'utf8')
    const lines = src.split('\n')
    expect(lines.length, 'the source was read').toBeGreaterThan(100)
    const offending = lines
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => [...line].some(ch => ch.charCodeAt(0) > 0x7f))
    expect(offending).toEqual([])
    // And the output does carry them, so the source row is not vacuous.
    expect(WITH.ebirdCsv).toMatch(/\p{Extended_Pictographic}\uFE0F/u)
    expect(WITH.ebirdCsv).toContain('\u00B0F')
  })
})
