// Reading a SnowRaven / RainCrow WEATHER block back out of a checklist comment.
//
// SnowRaven has written these blocks since its first release and has never read
// one. This is the grammar half of that: a pure text function that takes a
// comment and returns a PARTIAL record. The policy half (banding, thresholds,
// aggregation) is `lib/weatherStats.ts`, deliberately separate — a band boundary
// can move without touching a parse test, and a formatter drift breaks parse
// tests without touching banding.
//
// STANDING RULE FOR THIS MODULE: it imports only `commentBlocks`, `commentText`
// and `weatherFormatter`. No React, no transport, no storage, no component. It
// is a pure text function and it must stay one.
//
// THREE THINGS ABOUT THE INPUT, each of which has cost this repo a bug:
//
//  1. eBird returns comments HTML-ENTITY-ENCODED, so everything here runs on
//     `decodeEntities(comment)` and nothing touches innerHTML.
//  2. eBird's CSV export COLLAPSES the pasted block's newlines into spaces, so
//     this cannot be line-based. A value is bounded by the start of the next
//     known structure, never by a line ending. That single fact is the
//     documented cause of all three shipped strip bugs.
//  3. A block SHARES ITS LINE with the user's prose, before and after. So the
//     block is located as a SPAN, by the one span finder
//     (`findBlockSpans`), which the stripper also builds on. There is exactly
//     one span implementation and this module is not a second one.
//
// AND THE POSTURE, which decides every close call below: a WRONG number is
// worse than a MISSING one. A field that does not parse cleanly is null, and
// null means "this block did not yield this field", never a default and never a
// sentinel. That is why a `°C` block yields a missing temperature rather than a
// Fahrenheit reading.
//
// LINEARITY. This scans untrusted export text on a thread that may be the main
// thread (the worker fallback), so every scan is linear BY CONSTRUCTION:
// `Set`/`Map` lookups only, one global pass per pattern with `lastIndex` reset,
// every quantifier length-bounded, and no `includes` / `indexOf` / `find` inside
// any loop over export text — this module contains none of those three at all.
// `weatherStatsLinearity.test.ts` measures the exported entry point at
// 10k / 20k / 40k on inputs built so the pattern FAILS after consuming the run.

import { findBlockSpans } from './commentBlocks'
import { decodeEntities } from './commentText'
import { BEAUFORT_WORDS, CARDINALS, CONDITION_EMOJI } from './weatherFormatter'
import type { ConditionEmoji } from './weatherFormatter'

/** A range as the block writes it. `low === high` for a single-value block
 *  (`formatRange` collapses a range whose sampled hours agreed), so a consumer
 *  never has to branch on which form the block used. */
export interface WeatherRange { low: number; high: number }

/** Beaufort ORDINALS 0..8 — never a wind speed. The block stores a description,
 *  which is already an ordinal band; inverting the mph threshold table to
 *  synthesize a number would invent precision the block never had. */
export interface WeatherWind { minIndex: number; maxIndex: number }

/**
 * One weather block, parsed. PARTIAL BY CONTRACT: a null field means "this
 * block did not yield this field", and every other field still counts. A block
 * with a good temperature and a corrupted wind contributes to the temperature
 * figures and to no others; discarding the whole block on one bad field would
 * shrink every figure at once for a reason the user cannot see.
 *
 * ABSENT IS `null` IN EVERY CASE — never a default, never a sentinel number,
 * never an empty string. That uniformity is what makes "wholly unreadable" one
 * cheap check instead of ten special cases. In particular `dayNight: null` is
 * not "day", and `condition: null` is not the 🌡️ fallback, which is a real
 * value the formatter writes into real blocks.
 */
export interface WeatherRecord {
  /** The canonical glyph from CONDITION_EMOJI, with its shipped presentation
   *  (ten carry U+FE0F, ⛅ does not), so rendering it reproduces the block.
   *  MATCHING is variation-selector-insensitive; the STORED value is canonical. */
  condition: ConditionEmoji | null
  /** Night when the header run carries a moon phase, day when it carries a
   *  condition glyph and no moon. Neither present is null, not a default. */
  dayNight: 'day' | 'night' | null
  /** °F. Rejected (null) outside -80..140 or when low > high. */
  temperature: WeatherRange | null
  /** A single-label wind gives min === max. Three or more labels are possible
   *  (the formatter emits a de-duplicated Beaufort-sorted SET), and the labels
   *  between the ends are not retained because no figure reads them. */
  wind: WeatherWind | null
  /** Percent. Rejected outside 0..100 or when low > high. */
  cloudCover: WeatherRange | null
  /** Cardinals in the order the block lists them. One unrecognized token makes
   *  the whole field null, the same rule as wind on the same run grammar. */
  windDirection: string[] | null
  /** Percent, bounds as cloudCover. */
  humidity: WeatherRange | null
  /** °F, bounds as temperature. */
  dewPoint: WeatherRange | null
  /** The block's own local-time string ("6:16am"), trimmed, NOT parsed. A time
   *  with no date and no zone is not a moment; whoever charts it decides what to
   *  do about that, and inventing a Date here would bake in a wrong answer. */
  sunrise: string | null
  sunset: string | null
}

/**
 * Every field of a record, as a table the COMPILER keeps exhaustive: adding a
 * field to `WeatherRecord` and forgetting this line is a build error rather than
 * a field that silently never counts toward readability. Same device as
 * `BUNDLE_FIELDS` in statsBundle.ts, same reason.
 */
const RECORD_FIELDS: Record<keyof WeatherRecord, true> = {
  condition: true, dayNight: true, temperature: true, wind: true,
  cloudCover: true, windDirection: true, humidity: true, dewPoint: true,
  sunrise: true, sunset: true,
}
const RECORD_KEYS = Object.keys(RECORD_FIELDS) as Array<keyof WeatherRecord>

/** The all-null record, frozen at module scope so the no-block path allocates
 *  nothing. Frozen because it is SHARED: a caller that mutated it would poison
 *  every later no-block answer. */
export const EMPTY_WEATHER_RECORD: WeatherRecord = Object.freeze({
  condition: null, dayNight: null, temperature: null, wind: null,
  cloudCover: null, windDirection: null, humidity: null, dewPoint: null,
  sunrise: null, sunset: null,
})

/** Did this block yield anything at all? The "wholly unreadable" test, as ONE
 *  function driven by the compiler-checked field table above. */
export function hasAnyWeatherField(r: WeatherRecord): boolean {
  for (const k of RECORD_KEYS) {
    if (r[k] !== null) return true
  }
  return false
}

// ── The vocabulary, single-sourced from the writer ──────────────────────────

/** Variation-selector-insensitive condition lookup. Ten of the eleven glyphs
 *  carry U+FE0F and ⛅ does not, and a round trip through eBird or a user's
 *  clipboard can add or drop one, so both forms have to resolve to the same
 *  CANONICAL member. The map is asserted to hold exactly eleven entries by
 *  `weatherFormatter.test.ts` — a base-code-point collision would silently merge
 *  two conditions into one bar. */
// U+FE0F is written as an ESCAPE, never as a literal: it is invisible, and an
// editor or a formatter can silently eat one, which would leave this map keyed
// on the un-stripped glyph and quietly stop matching half the real blocks. Same
// reason charClasses.ts escapes U+2028/U+2029.
const CONDITION_BY_BASE = new Map<string, ConditionEmoji>()
for (const e of CONDITION_EMOJI) CONDITION_BY_BASE.set(e.replace(/\uFE0F/g, ''), e)

/**
 * The eight moon-phase glyphs, as a SET.
 *
 * Written out here rather than imported because `MOON_NORTH` and `MOON_SOUTH`
 * in weatherFormatter.ts are two ORDERINGS of the same eight glyphs (the
 * Southern Hemisphere sees the moon mirrored) and what a reader needs is the
 * set, not either order. `weatherBlockParse.test.ts` asserts set equality
 * against the union of those two shipped arrays, so a future ninth glyph
 * reaches this parser rather than quietly failing to mark a checklist as night.
 * None of the eight carries a variation selector.
 */
const MOON_GLYPHS = new Set(['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'])

/** Beaufort word (lowercased) → ordinal 0..8. */
const BEAUFORT_ORDINAL = new Map<string, number>()
for (let i = 0; i < BEAUFORT_WORDS.length; i++) BEAUFORT_ORDINAL.set(BEAUFORT_WORDS[i].toLowerCase(), i)

/** Cardinal (lowercased) → its canonical form. */
const CARDINAL_CANONICAL = new Map<string, string>()
for (const c of CARDINALS) CARDINAL_CANONICAL.set(c.toLowerCase(), c)

// ── The grammar ─────────────────────────────────────────────────────────────

/**
 * The one scan that finds where every value starts and where it stops.
 *
 * `field` is a labeled value this parser reads; `stop` is known structure that
 * merely BOUNDS one — the tide block's own labels and the three attribution
 * phrases. Both matter, and the `stop` half is not defensive tidying: a
 * COMBINED block puts the tide body inside the same span as the weather body
 * (see `commentBlocksSpans.test.ts`), so without the tide labels here the
 * `Sunset:` value would swallow the entire tide block.
 *
 * Ordering inside `field` is load-bearing: `wind direction` before `wind`,
 * because regex alternation is first-match.
 *
 * EVERY QUANTIFIER IS BOUNDED. `[^\S\n]{0,8}` before the colon rather than
 * `\s*:` — the formatter emits exactly one space, and `\s*` followed by a `:`
 * that can fail is the precise backtracking shape the superlinear-regex sweep
 * removed six times over.
 */
const BOUNDARY_RE = new RegExp(
  '(?<field>' +
    'temperature|wind[^\\S\\n]{1,4}direction|wind|cloud[^\\S\\n]{1,4}cover|' +
    'humidity|dew[^\\S\\n]{1,4}point|sunrise|sunset' +
  ')[^\\S\\n]{0,8}:' +
  '|(?<stop>' +
    '(?:water[^\\S\\n]{1,4}level|tide|station|' +
    'previous[^\\S\\n]{1,4}(?:high|low)|next[^\\S\\n]{1,4}(?:high|low))[^\\S\\n]{0,8}:' +
    '|relative[^\\S\\n]{1,4}to[^\\S\\n]{1,4}mllw' +
    '|weather[^\\S\\n]{1,4}and[^\\S\\n]{1,4}tide[^\\S\\n]{1,4}generated[^\\S\\n]{1,4}by' +
    '|weather[^\\S\\n]{1,4}generated[^\\S\\n]{1,4}by' +
    '|tide[^\\S\\n]{1,4}data[^\\S\\n]{1,4}from[^\\S\\n]{1,4}noaa[^\\S\\n]{1,4}co-ops' +
  ')',
  'giu',
)

/** The `field` label text, normalized to a record key. */
const FIELD_KEY = new Map<string, keyof WeatherRecord>([
  ['temperature', 'temperature'],
  ['wind direction', 'windDirection'],
  ['wind', 'wind'],
  ['cloud cover', 'cloudCover'],
  ['humidity', 'humidity'],
  ['dew point', 'dewPoint'],
  ['sunrise', 'sunrise'],
  ['sunset', 'sunset'],
])

/**
 * The value length bound, and it is STRUCTURAL rather than taste.
 *
 * It is over 1.7x the longest value the formatter can emit: the widest is a
 * nine-label wind run, 93 characters of words plus 8 separators of 3, i.e. 117.
 * `weatherBlockParse.test.ts` asserts both halves of that -- the nine-label run
 * really parses, and the bound is at most 2x it, so it is a bound rather than a
 * gesture. Applying it BEFORE the `split` is what keeps a hostile 40,000
 * character value from allocating 20,000 substrings on the thread that paints.
 *
 * It fails in the safe direction: over the bound the FIELD is missing, never
 * wrong. The two time fields need no such bound; see `parseTime`.
 */
const MAX_VALUE_CHARS = 200

/** The separator `formatRange` and the run joins emit, and ONLY this. Splitting
 *  on a bare '-' would make a negative endpoint (`-5 - 12°F`) ambiguous. */
const RUN_SEP = ' - '

/** A fully-bounded number: no quantifier here can backtrack. */
const NUMBER_RE = /^-?\d{1,4}(?:\.\d{1,2})?$/

/**
 * One endpoint. The unit suffix is OPTIONAL (a round trip can drop it) but is
 * never assumed when a DIFFERENT unit is present: a `°C` block leaves a `C`
 * behind, the number regex rejects it, and the field goes null. Reading Celsius
 * as Fahrenheit would be a wrong number rather than a missing one, which is the
 * one thing this feature will not do.
 *
 * `Number()` runs only after the regex passes: `Number('')` and `Number(' ')`
 * are both 0, so an unguarded parse turns an empty value into a real reading.
 */
function parseEndpoint(raw: string, unit: 'F' | '%'): number | null {
  let s = raw.trim()
  if (unit === 'F') {
    if (s.endsWith('°F') || s.endsWith('°f')) s = s.slice(0, -2)
  } else if (s.endsWith('%')) {
    s = s.slice(0, -1)
  }
  s = s.trim()
  if (!NUMBER_RE.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** The range grammar, one rule for all five numeric fields. */
function parseRange(value: string, unit: 'F' | '%', lo: number, hi: number): WeatherRange | null {
  const v = value.trim()
  if (!v || v.length > MAX_VALUE_CHARS) return null
  const parts = v.split(RUN_SEP)
  // Zero separators is a single value (low = high); two or more is not a range
  // this app ever wrote, so it is a missing field rather than a guess.
  if (parts.length > 2) return null
  const low = parseEndpoint(parts[0], unit)
  const high = parts.length === 2 ? parseEndpoint(parts[1], unit) : low
  if (low === null || high === null) return null
  if (low > high) return null
  if (low < lo || high > hi) return null
  return { low, high }
}

/**
 * The run grammar, shared by wind and wind direction: split on ' - ', map each
 * token through a `Map`, and one unrecognized token makes the WHOLE field null.
 *
 * The token cap is structural rather than arbitrary: the formatter emits a
 * de-duplicated set drawn from a closed vocabulary, so it can never write more
 * tokens than the vocabulary has members.
 */
function parseRun(value: string, max: number): string[] | null {
  const v = value.trim()
  if (!v || v.length > MAX_VALUE_CHARS) return null
  const parts = v.split(RUN_SEP)
  if (parts.length > max) return null
  return parts
}

function parseWind(value: string): WeatherWind | null {
  const parts = parseRun(value, BEAUFORT_WORDS.length)
  if (!parts) return null
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const p of parts) {
    const ord = BEAUFORT_ORDINAL.get(p.trim().toLowerCase())
    if (ord === undefined) return null
    // min/max rather than first/last, so a hand-reordered block still bands
    // correctly.
    if (ord < min) min = ord
    if (ord > max) max = ord
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { minIndex: min, maxIndex: max }
}

function parseWindDirection(value: string): string[] | null {
  const parts = parseRun(value, CARDINALS.length)
  if (!parts) return null
  const out: string[] = []
  for (const p of parts) {
    const c = CARDINAL_CANONICAL.get(p.trim().toLowerCase())
    if (c === undefined) return null
    out.push(c)
  }
  return out.length > 0 ? out : null
}

/**
 * A time as both runtimes write it: `H:MMam` / `H:MMpm`, from
 * `formatLocalTime` here and `format_local_time` in
 * `backend/formatters/weather.py`, which agree byte for byte. Fully bounded, so
 * nothing here can backtrack: every quantifier has a ceiling and the optional
 * suffix sits at the end of the pattern.
 *
 * It is anchored at the START and takes the LEADING time rather than requiring
 * the whole value to be one, and that is not laxness -- it is the only shape
 * that reads a COMBINED block correctly. `Sunset:` is the last label in a
 * weather block, so in a combined comment its value runs to the tide body's
 * first label and picks up the tide block's emoji header and its condition line
 * on the way ("6:20pm\n\n\ud83c\udf0a\nPredicted"). Requiring a whole-value match
 * would drop a perfectly good sunset on every combined block ever written;
 * taking the leading token reads it, and a value that does not BEGIN with a
 * time still yields null rather than a wrong string.
 *
 * The am/pm suffix is optional and a separating space is tolerated, because a
 * round trip can drop or widen either.
 */
const TIME_LEAD_RE = /^\d{1,2}:\d{2}(?:[^\S\n]{0,2}[ap]\.?m\.?)?/i

function parseTime(value: string): string | null {
  // No length bound is needed here and that is a property of the pattern rather
  // than an oversight: anchored at `^` with every quantifier bounded, it either
  // matches or fails inside the first handful of characters however long the
  // value is, and what it returns is at most ten characters long.
  const m = TIME_LEAD_RE.exec(value.trim())
  return m ? m[0] : null
}

// ── The emoji header ────────────────────────────────────────────────────────

const PICTO_RE = /\p{Extended_Pictographic}/u
const HSPACE_RE = /[^\S\n]/

/**
 * Read the span's LEADING emoji run: the first CONDITION_EMOJI member is the
 * condition, and any of the eight moon glyphs makes it night.
 *
 * The walk is per code point with `Set`/`Map` lookups, so it is O(1) per code
 * point with no early exit available in the worst case — which is the honest
 * worst case for a header of many non-member pictographs, and one of the three
 * hostile shapes the linearity suite measures.
 *
 * A span that does not begin with an emoji run (a block whose header was
 * trimmed off, or one located by its first label) yields BOTH fields null.
 * `dayNight` is not defaulted to 'day' just because no moon was found: with no
 * header at all, nothing was found either way.
 */
function readHeader(span: string): { condition: ConditionEmoji | null; dayNight: 'day' | 'night' | null } {
  let condition: ConditionEmoji | null = null
  let moon = false
  let i = 0
  // Leading horizontal whitespace only: a newline would mean the span did not
  // start on the header line at all.
  while (i < span.length && HSPACE_RE.test(span[i])) i++
  while (i < span.length) {
    const cp = span.codePointAt(i)
    if (cp === undefined) break
    const ch = String.fromCodePoint(cp)
    const width = ch.length
    if (cp === 0xfe0f || cp === 0x200d) { i += width; continue }
    if (!PICTO_RE.test(ch)) break
    if (condition === null) {
      const c = CONDITION_BY_BASE.get(ch)
      if (c !== undefined) condition = c
    }
    if (!moon && MOON_GLYPHS.has(ch)) moon = true
    i += width
    if (condition !== null && moon) break
  }
  const dayNight = moon ? 'night' : condition !== null ? 'day' : null
  return { condition, dayNight }
}

// ── The entry point ─────────────────────────────────────────────────────────

/** Parse one already-located span. Kept separate so the aggregation can decode
 *  once and hand the decoded string down. */
function parseSpanText(span: string): WeatherRecord {
  const header = readHeader(span)
  const rec: WeatherRecord = {
    condition: header.condition,
    dayNight: header.dayNight,
    temperature: null, wind: null, cloudCover: null, windDirection: null,
    humidity: null, dewPoint: null, sunrise: null, sunset: null,
  }

  // One pass collects every boundary; a value then runs from just past its own
  // colon to the NEXT boundary of any kind, or to the end of the span. Never to
  // a line ending — eBird collapsed those into spaces.
  BOUNDARY_RE.lastIndex = 0
  const marks: Array<{ key: keyof WeatherRecord | null; valueStart: number; start: number }> = []
  let m: RegExpExecArray | null
  while ((m = BOUNDARY_RE.exec(span)) !== null) {
    const label = m.groups?.field
    const key = label === undefined
      ? null
      : FIELD_KEY.get(label.toLowerCase().replace(/[^\S\n]+/g, ' ')) ?? null
    marks.push({ key, valueStart: m.index + m[0].length, start: m.index })
    if (BOUNDARY_RE.lastIndex === m.index) BOUNDARY_RE.lastIndex++
  }

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i]
    if (mark.key === null) continue
    // The FIRST occurrence of a label wins; a block pasted with a duplicate
    // label does not get to overwrite what already parsed.
    if (rec[mark.key] !== null) continue
    const end = i + 1 < marks.length ? marks[i + 1].start : span.length
    const value = span.slice(mark.valueStart, end)
    switch (mark.key) {
      case 'temperature': rec.temperature = parseRange(value, 'F', -80, 140); break
      case 'dewPoint': rec.dewPoint = parseRange(value, 'F', -80, 140); break
      case 'cloudCover': rec.cloudCover = parseRange(value, '%', 0, 100); break
      case 'humidity': rec.humidity = parseRange(value, '%', 0, 100); break
      case 'wind': rec.wind = parseWind(value); break
      case 'windDirection': rec.windDirection = parseWindDirection(value); break
      case 'sunrise': rec.sunrise = parseTime(value); break
      case 'sunset': rec.sunset = parseTime(value); break
    }
  }
  return rec
}

/**
 * THE ENTRY POINT. Pure, read-only, never throws. Takes the RAW comment,
 * decodes internally, and returns the all-null record when nothing readable is
 * there.
 *
 * It returns a record rather than `WeatherRecord | null` on purpose: "found but
 * yielded nothing" has to be a countable state, and a null return would collapse
 * it with "no block here". The aggregation distinguishes the two by calling the
 * attribution gate first.
 *
 * WHICH SPAN IT READS, and why this is not the kind-based rule the schema
 * sketched. It walks the spans in document order and takes the FIRST that yields
 * any field. Selecting by `kind` looks right and is wrong on the shape that
 * matters most: a COMBINED block ends its tide body with the bare NOAA credit,
 * which the attribution pattern matches, so a combined comment is two spans — a
 * `'tide'` span carrying the whole weather body AND the tide body, and a
 * `'combined'` span carrying only the trailing attribution line. A kind-based
 * pick would hand this function the attribution and nothing else, on every
 * combined block ever written. `commentBlocksSpans.test.ts` pins that shape.
 *
 * "A tide span is never parsed for weather" survives in substance, twice over: a
 * standalone tide block carries none of the eight labels this parser reads and
 * no condition or moon glyph, so it can only ever yield the empty record; and a
 * tide-only comment never reaches here at all, because the attribution gate one
 * level up does not fire on it.
 *
 * The walk is an explicit indexed loop with an early break rather than
 * `Array.prototype.find`, so the linearity grep over this module comes back
 * clean rather than arguable. It is bounded by the span count, and the spans are
 * disjoint, so the total work is linear in the comment length however many
 * spans a hostile comment manufactures.
 */
export function parseWeatherBlock(rawComment: string): WeatherRecord {
  if (!rawComment) return EMPTY_WEATHER_RECORD
  const spans = findBlockSpans(rawComment)
  if (spans.length === 0) return EMPTY_WEATHER_RECORD
  const decoded = decodeEntities(rawComment)
  for (let i = 0; i < spans.length; i++) {
    const rec = parseSpanText(decoded.slice(spans[i].start, spans[i].end))
    if (hasAnyWeatherField(rec)) return rec
  }
  return EMPTY_WEATHER_RECORD
}

/** Test seam: the variation-selector-insensitive condition map, so the drift
 *  guards can assert its cardinality without re-deriving it. */
export const CONDITION_LOOKUP: ReadonlyMap<string, ConditionEmoji> = CONDITION_BY_BASE
/** Test seam: the moon set, asserted equal to the union of MOON_NORTH and
 *  MOON_SOUTH so a future ninth glyph reaches this parser. */
export const MOON_PHASE_GLYPHS: ReadonlySet<string> = MOON_GLYPHS
/** Exported only so a test can prove the bound exists and is not vacuous. */
export const WEATHER_VALUE_MAX_CHARS = MAX_VALUE_CHARS
