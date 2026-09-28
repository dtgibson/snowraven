// The eBird bar-chart file parser (targets-tab, schema.md sections 2.1 and 10).
//
// THE FILE. eBird's "Download Histogram Data" on a region's bar chart page
// (`ebird_US-CA-001__1900_2026_1_12_barchart.txt`) is tab-separated text: a
// title line, an optional `Number of taxa:` line, a month header, ONE
// `Sample Size:` row of 48 checklist counts (four periods per month), then one
// row per taxon of 48 frequencies (the share of those checklists reporting it).
// Blank lines separate every row. The layout was pinned against Cornell's `auk`
// package sample (`barchart-sample.fixture.txt`, public data), and the current
// download wraps the scientific name as
// `Lincoln's Sparrow (<em class="sci">Melospiza lincolnii</em>)`.
//
// UNTRUSTED TEXT, SCANNED LINEARLY. The input is whatever file the user picked,
// already bounded at the refusal registry's 50 MB cap (`uploadGuard.ts`)
// before this runs. There is NO regex over the content. The argument, search by
// search, because `indexOf` has no END parameter: when the character it looks
// for is absent it runs to the end of the WHOLE string, so every search below
// names what stops it.
//   * Lines: `indexOf('\n', pos)` from the line's start. It stops at the line's
//     own terminator, or at the end of the file for the last line, and the
//     cursor then moves past that point, so the line searches together read the
//     file once.
//   * Cells: a character loop over [line start, line end) that also stops at the
//     50th tab (`cellsOf`). It never looks past the line, so a line with no tab
//     costs its own length and not the rest of the file. (An `indexOf('\t')`
//     here was the M1 quadratic: a tab-free line searched on to the next tab
//     anywhere later in the file.)
//   * The name cell: a raw cell over MAX_RAW_NAME_CELL is malformed BEFORE it is
//     sliced, split, stripped, decoded or tidied, so all of that per-cell work,
//     including the `<em class="sci">` / `</em>` searches (which run inside the
//     cell's own copy), is bounded by a constant per row.
//   * Entities: each `&` looks at most six characters ahead for its `;`
//     (`decodeEntities`). (An unbounded `indexOf(';')` here was the other M1
//     quadratic: a cell of `&` with no `;` searched to the cell's end per `&`.)
//   * Numbers: `Number()` over a token copied by a loop, at most 32 characters.
// So each character of the file is visited a bounded constant number of times:
// O(n) in the file, with the per-row name work O(1). The worst case, named: a
// 50 MB single line with no line break is one `indexOf` that returns -1, after
// which that one line is refused on its length without being split.
//
// Every bound below is named at its enforcement point, and a malformed SPECIES
// row is counted and skipped, never a reason to refuse the file: eBird has
// changed cosmetic lines before, and one odd row must not cost the user their
// whole import. What refuses the file is the absence of the layout FR-28 defines
// it by (a Sample Size row and at least one species row), or a bound that says
// this is not a bar-chart file at all.

/** Non-blank lines allowed before the Sample Size row. A file that has not
 *  shown its Sample Size row in 64 lines is not a bar-chart file, and is
 *  refused cheaply rather than scanned to the end looking for one. */
export const MAX_PREAMBLE_LINES = 64

/** Longest line read, in characters. A species row is about 600; a longer
 *  species row is malformed (skipped), a longer Sample Size row refuses. */
export const MAX_LINE_CHARS = 65_536

/** Four periods per month, twelve months. */
export const PERIODS = 48

/** Longest numeric token handed to `Number()`. eBird writes `1095.0` and
 *  `9.132E-4`; nothing real comes near 32 characters. */
export const MAX_NUMERIC_TOKEN = 32

/** Longest common-name cell after tag stripping (the widget's
 *  RECORD_MAX_STRING); eBird's longest English name is about 60. */
export const MAX_NAME_CELL = 512

/** Longest RAW name cell (line start to the first tab, markup and entities
 *  included) that is processed at all. The current download's cell is the
 *  common name, ` (<em class="sci">`, the scientific name and `</em>)`: about
 *  130 characters for the longest real names. Four times MAX_NAME_CELL leaves
 *  room for any cell that could strip to a readable name; a longer raw cell is
 *  counted malformed before it is split, stripped or decoded, which is what
 *  keeps the per-row name work a constant (the header's linearity argument). */
export const MAX_RAW_NAME_CELL = 4 * MAX_NAME_CELL

/** Largest Sample Size cell, in checklists. A county's busiest period holds
 *  thousands; a billion is far past any region eBird has. The bound is what
 *  keeps the sample-weighted sums finite: 48 periods of at most 1e9 checklists,
 *  each weighted by a frequency in [0, 1], cannot overflow, so a percent cell
 *  can never read NaN or Infinity (Auditor I2: 48 cells of ~9e307 summed to
 *  Infinity, and Infinity / Infinity rendered "NaN%"). */
export const MAX_SAMPLE_SIZE = 1_000_000_000

/** Most species rows read. The world list is about 11,000 species and the
 *  forms and spuhs add hundreds; a 20,001st row says this is not a bar chart. */
export const MAX_TAXA_ROWS = 20_000

/** Tab positions the cell scanner looks for before it stops: the name, 48
 *  cells and one trailing empty cell are 49 tabs, so a 50th means too many. */
const MAX_TABS = PERIODS + 2

export interface BarChartRow {
  /** The common name with any markup stripped, as the pool join reads it. */
  name: string
  /** The scientific name from the current download's `<em class="sci">` cell,
   *  kept for the unmatched-rows list only; never a join key in v1. */
  sciName: string | null
  /** 48 frequencies in [0, 1], period order (Jan week 1 first). */
  freqs: number[]
}

export interface BarChartFile {
  /** 48 checklist counts, period order. */
  sampleSizes: number[]
  rows: BarChartRow[]
  /** Species rows skipped as malformed (counted, never silently dropped). */
  malformed: number
  /** The `Number of taxa:` line, when present. Shown, never trusted as a bound. */
  declaredTaxa: number | null
}

export type BarChartParseOutcome =
  | { ok: true; file: BarChartFile }
  | { ok: false; reason: 'no-sample-size' | 'bad-sample-size' | 'preamble-too-long' | 'no-species' | 'too-many-rows' }

const SCI_OPEN = '<em class="sci">'
const SCI_CLOSE = '</em>'
const SAMPLE_SIZE_PREFIX = 'sample size:'
const TAXA_PREFIX = 'number of taxa:'

function isWs(c: number): boolean {
  // Space, tab, CR, LF, and the NBSP eBird's HTML-sourced cells can carry.
  return c === 32 || c === 9 || c === 13 || c === 10 || c === 0xa0 || c === 0xfeff
}

/** Index of the first non-whitespace character in [start, end), or `end`. */
function skipWs(s: string, start: number, end: number): number {
  let i = start
  while (i < end && isWs(s.charCodeAt(i))) i++
  return i
}

/** Index one past the last non-whitespace character in [start, end), or `start`. */
function trimEnd(s: string, start: number, end: number): number {
  let i = end
  while (i > start && isWs(s.charCodeAt(i - 1))) i--
  return i
}

/** True when s[at, at + prefix.length) equals `prefix` ignoring ASCII case.
 *  `prefix` is lowercase. Reads at most prefix.length characters. */
function startsWithCi(s: string, at: number, end: number, prefix: string): boolean {
  if (end - at < prefix.length) return false
  for (let k = 0; k < prefix.length; k++) {
    let c = s.charCodeAt(at + k)
    if (c >= 65 && c <= 90) c += 32
    if (c !== prefix.charCodeAt(k)) return false
  }
  return true
}

/**
 * One numeric cell, or NaN. Only digits, `.`, `e`/`E`, `+` and `-` are
 * admitted, so `Number()`'s other accepted spellings (hex, `Infinity`, inner
 * whitespace) are refused; the token is at most MAX_NUMERIC_TOKEN characters
 * and is copied by a character loop, never `.slice()` of the whole file.
 * `emptyReads` is what an empty cell reads as (0 for a species row, NaN for the
 * Sample Size row, which has no such allowance).
 */
function readNumber(s: string, start: number, end: number, emptyReads: number): number {
  const a = skipWs(s, start, end)
  const b = trimEnd(s, a, end)
  if (a === b) return emptyReads
  if (b - a > MAX_NUMERIC_TOKEN) return NaN
  let token = ''
  for (let i = a; i < b; i++) {
    const c = s.charCodeAt(i)
    const ok = (c >= 48 && c <= 57) || c === 46 || c === 101 || c === 69 || c === 43 || c === 45
    if (!ok) return NaN
    token += s[i]
  }
  return Number(token)
}

/** How far past its `&` a `;` may sit and still close an entity. The longest
 *  name in the table, `&nbsp;`, closes at 5; 6 is the bound this decoder has
 *  always applied, kept so every cell decodes exactly as before. */
const ENTITY_WINDOW = 6

/** Decode the handful of entities an HTML-sourced cell can carry; anything
 *  else is left as written. Linear: one pass, and each `&` looks at most
 *  ENTITY_WINDOW characters ahead for its `;`. The look is a bounded loop, not
 *  `indexOf(';')`, which would search to the end of the cell when no `;`
 *  follows and make a cell of `&` quadratic (Auditor M1). */
function decodeEntities(text: string): string {
  if (text.indexOf('&') === -1) return text
  const table: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' }
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '&') {
      // The first `;` within the window, or -1: the same match the unbounded
      // search accepted (`semi - i <= ENTITY_WINDOW`), found without reading
      // past the window.
      let semi = -1
      const stop = Math.min(text.length, i + ENTITY_WINDOW + 1)
      for (let j = i + 1; j < stop; j++) {
        if (text.charCodeAt(j) === 59 /* ; */) { semi = j; break }
      }
      if (semi !== -1) {
        const name = text.slice(i + 1, semi)
        if (Object.hasOwn(table, name)) { out += table[name]; i = semi + 1; continue }
      }
    }
    out += ch
    i++
  }
  return out
}

/** Remove every `<...>` span with one character loop (a tag eBird has not
 *  shown yet is stripped, never rendered: the app never reads this as HTML). */
function stripTags(text: string): string {
  if (text.indexOf('<') === -1) return text
  let out = ''
  let inTag = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inTag) { if (ch === '>') inTag = false; continue }
    if (ch === '<') { inTag = true; continue }
    out += ch
  }
  return out
}

/** Collapse runs of whitespace to single spaces and trim, in one pass. */
function tidy(text: string): string {
  let out = ''
  let pendingSpace = false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (isWs(c)) { if (out.length > 0) pendingSpace = true; continue }
    if (pendingSpace) { out += ' '; pendingSpace = false }
    out += text[i]
  }
  return out
}

/**
 * Split a species row's name cell into the common name and, in the current
 * download's shape, the scientific name:
 *
 *   `Lincoln's Sparrow (<em class="sci">Melospiza lincolnii</em>)`
 *     -> { name: "Lincoln's Sparrow", sciName: 'Melospiza lincolnii' }
 *   `Bar-headed Goose` (the older shape, as in the auk sample)
 *     -> { name: 'Bar-headed Goose', sciName: null }
 *
 * `indexOf` once for the opening tag and once for its close; the text before
 * the opening tag loses one trailing ` (`; any remaining tag is stripped by one
 * character loop. Linear in the cell.
 */
export function splitNameCell(cell: string): { name: string; sciName: string | null } {
  const open = cell.indexOf(SCI_OPEN)
  if (open === -1) return { name: tidy(decodeEntities(stripTags(cell))), sciName: null }
  const afterOpen = open + SCI_OPEN.length
  const close = cell.indexOf(SCI_CLOSE, afterOpen)
  const sciRaw = close === -1 ? cell.slice(afterOpen) : cell.slice(afterOpen, close)
  let before = cell.slice(0, open)
  // One trailing " (" (space, paren) belongs to the wrapper, not the name.
  let end = before.length
  while (end > 0 && isWs(before.charCodeAt(end - 1))) end--
  if (end > 0 && before.charCodeAt(end - 1) === 40 /* ( */) {
    end--
    before = before.slice(0, end)
  }
  const sci = tidy(decodeEntities(stripTags(sciRaw)))
  return { name: tidy(decodeEntities(stripTags(before))), sciName: sci === '' ? null : sci }
}

/**
 * The cells of one line [start, end): the name cell's bounds and each numeric
 * cell's bounds, after dropping ONE trailing empty (whitespace-only) cell.
 * Returns null when the line holds more than MAX_TABS tab positions (the scan
 * stops at the 50th rather than reading the rest of the line) or does not end
 * in exactly PERIODS numeric cells.
 *
 * The tab search is a loop bounded by `end`, never `indexOf('\t', p)`: that has
 * no end parameter, so on a line with fewer tabs than it looks for it ran on
 * past the line to the next tab anywhere in the file, and a run of tab-free
 * lines before a long tab-free tail was quadratic (Auditor M1).
 */
function cellsOf(s: string, start: number, end: number): { nameEnd: number; cells: number[] } | null {
  const tabs: number[] = []
  for (let i = start; i < end; i++) {
    if (s.charCodeAt(i) !== 9 /* \t */) continue
    tabs.push(i)
    if (tabs.length >= MAX_TABS) return null
  }
  if (tabs.length === 0) return null
  // Cell k spans (tabs[k-1], tabs[k]) with the last cell running to `end`.
  const bounds: number[] = []  // pairs [from, to) flattened
  for (let k = 0; k < tabs.length; k++) {
    const from = tabs[k] + 1
    const to = k + 1 < tabs.length ? tabs[k + 1] : end
    bounds.push(from, to)
  }
  let count = bounds.length / 2
  // Drop ONE trailing empty cell: eBird writes a tab after the last value.
  const lastFrom = bounds[bounds.length - 2]
  const lastTo = bounds[bounds.length - 1]
  if (count === PERIODS + 1 && skipWs(s, lastFrom, lastTo) === lastTo) {
    bounds.length -= 2
    count -= 1
  }
  if (count !== PERIODS) return null
  return { nameEnd: tabs[0], cells: bounds }
}

/**
 * Parse one eBird bar-chart file. Never throws; a file that does not have the
 * layout is `{ ok: false, reason }`, and the registry turns every reason into
 * the one "This is not an eBird bar-chart file" message (FR-28).
 */
export function parseBarChart(text: string): BarChartParseOutcome {
  return parseBarChartCapped(text, Infinity)
}

/**
 * Test seam: the same parse with a cap on its OUTER loop's iterations, which
 * throws when exceeded. A `testTimeout` cannot interrupt a synchronous loop
 * (the timer that would fire sits behind the same blocked thread), so the
 * hostile-input guard walks this capped form of the one real loop before it
 * times the uncapped one: a regression that stops the line cursor advancing
 * fails here as a throw instead of hanging the worker (testing.md, v1.0.33).
 */
export function _parseBarChartWithIterationCapForTests(text: string, cap: number): BarChartParseOutcome {
  return parseBarChartCapped(text, cap)
}

function parseBarChartCapped(text: string, cap: number): BarChartParseOutcome {
  const n = text.length
  // A leading BOM is not part of the title line.
  let pos = n > 0 && text.charCodeAt(0) === 0xfeff ? 1 : 0

  let preambleLines = 0
  let declaredTaxa: number | null = null
  let sampleSizes: number[] | null = null
  const rows: BarChartRow[] = []
  let malformed = 0
  let speciesLines = 0
  let iterations = 0

  while (pos <= n) {
    if (++iterations > cap) throw new Error('parseBarChart: iteration cap exceeded')
    const nl = text.indexOf('\n', pos)
    const lineEndRaw = nl === -1 ? n : nl
    // CRLF: the CR belongs to the terminator, not the line.
    const lineEnd = lineEndRaw > pos && text.charCodeAt(lineEndRaw - 1) === 13 ? lineEndRaw - 1 : lineEndRaw
    const next = nl === -1 ? n + 1 : nl + 1

    const len = lineEnd - pos
    if (len > MAX_LINE_CHARS) {
      // Over the line bound: never split, never trimmed end to end. Only its
      // first few characters are read, to tell a Sample Size row (which then
      // refuses) from anything else.
      const first = skipWs(text, pos, Math.min(lineEnd, pos + 64))
      const isSample = startsWithCi(text, first, lineEnd, SAMPLE_SIZE_PREFIX)
      if (sampleSizes === null) {
        if (isSample) return { ok: false, reason: 'bad-sample-size' }
        preambleLines++
        if (preambleLines > MAX_PREAMBLE_LINES) return { ok: false, reason: 'preamble-too-long' }
      } else {
        if (isSample) return { ok: false, reason: 'bad-sample-size' }
        speciesLines++
        if (speciesLines > MAX_TAXA_ROWS) return { ok: false, reason: 'too-many-rows' }
        malformed++
      }
      pos = next
      continue
    }

    const a = skipWs(text, pos, lineEnd)
    if (a === lineEnd) { pos = next; continue }     // blank line (after trim)

    const isSample = startsWithCi(text, a, lineEnd, SAMPLE_SIZE_PREFIX)

    if (sampleSizes === null) {
      if (isSample) {
        const parsed = cellsOf(text, pos, lineEnd)
        if (!parsed) return { ok: false, reason: 'bad-sample-size' }
        const sizes: number[] = []
        for (let k = 0; k < parsed.cells.length; k += 2) {
          const v = readNumber(text, parsed.cells[k], parsed.cells[k + 1], NaN)
          if (!Number.isFinite(v) || v < 0 || v > MAX_SAMPLE_SIZE) return { ok: false, reason: 'bad-sample-size' }
          sizes.push(v)
        }
        sampleSizes = sizes
        pos = next
        continue
      }
      preambleLines++
      if (preambleLines > MAX_PREAMBLE_LINES) return { ok: false, reason: 'preamble-too-long' }
      if (declaredTaxa === null && startsWithCi(text, a, lineEnd, TAXA_PREFIX)) {
        const v = readNumber(text, a + TAXA_PREFIX.length, lineEnd, NaN)
        if (Number.isInteger(v) && v >= 0) declaredTaxa = v
      }
      pos = next
      continue
    }

    // After the Sample Size row: a second one is not a bar chart's layout.
    if (isSample) return { ok: false, reason: 'bad-sample-size' }
    speciesLines++
    if (speciesLines > MAX_TAXA_ROWS) return { ok: false, reason: 'too-many-rows' }

    const parsed = cellsOf(text, pos, lineEnd)
    if (!parsed) { malformed++; pos = next; continue }
    // Over the raw name bound: malformed before any of the name work runs.
    if (parsed.nameEnd - pos > MAX_RAW_NAME_CELL) { malformed++; pos = next; continue }
    const { name, sciName } = splitNameCell(text.slice(pos, parsed.nameEnd))
    if (name === '' || name.length > MAX_NAME_CELL) { malformed++; pos = next; continue }
    const freqs: number[] = []
    let bad = false
    for (let k = 0; k < parsed.cells.length; k += 2) {
      const v = readNumber(text, parsed.cells[k], parsed.cells[k + 1], 0)
      if (!Number.isFinite(v) || v < 0 || v > 1) { bad = true; break }
      freqs.push(v)
    }
    if (bad) { malformed++; pos = next; continue }
    rows.push({ name, sciName: sciName !== null && sciName.length > MAX_NAME_CELL ? null : sciName, freqs })
    pos = next
  }

  if (sampleSizes === null) return { ok: false, reason: 'no-sample-size' }
  if (rows.length === 0) return { ok: false, reason: 'no-species' }
  return { ok: true, file: { sampleSizes, rows, malformed, declaredTaxa } }
}
