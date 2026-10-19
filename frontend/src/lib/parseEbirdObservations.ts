import type { ObservationEntry } from '../types'
import { PACKED_BYTES_PER_ROW, PackedObservationsBuilder, materializeObservations } from './observationsPacked'
import type { PackedObservations } from './observationsPacked'

// Row-at-a-time CSV reader handling quoted fields with embedded newlines.
// Follows the same character-level approach required by all eBird CSV parsers
// in this project — line-splitting breaks on multi-line quoted fields.
//
// STREAMING CONTRACT — the whole point of this generator.
// It yields ONE array, cleared and refilled for every row, so at most one row
// array is ever live no matter how large the export is. The previous shape
// returned a full `string[][]` of every cell, which on the reference 6.6 MB /
// 21,369-row export peaked at ~19x the file size — dominated by the cons-string
// rope nodes that `field += ch` builds and that only collapse when a consumer
// calls `.trim()`. Held for the whole entry-building loop, that transient grid
// is what runs a large export out of worker heap.
//
// Because the array is REUSED, a consumer must read what it needs during its own
// iteration and must never retain the yielded array (or hand it to something that
// does). Copy values out — which is exactly what building an ObservationEntry
// does, since every field is `.trim()`ed into the entry.
export function* streamCsvRows(content: string): Generator<string[], void, undefined> {
  const row: string[] = []
  let field = ''
  let inQuotes = false
  let i = content.charCodeAt(0) === 0xFEFF ? 1 : 0

  while (i < content.length) {
    const ch = content[i]

    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        field += '"'
        i += 2
      } else {
        inQuotes = !inQuotes
        i++
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      row.push(field)
      field = ''
      i++
      continue
    }

    if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && content[i + 1] === '\n') i++
      row.push(field)
      field = ''
      yield row
      row.length = 0
      i++
      continue
    }

    field += ch
    i++
  }

  if (field || row.length > 0) {
    row.push(field)
    yield row
    row.length = 0
  }
}

/** Column positions read off the header row. -1 means the column is absent. */
interface ColumnIndex {
  submissionId: number
  commonName: number
  sciName: number
  date: number
  location: number
  locationId: number
  latitude: number
  longitude: number
  county: number
  count: number
  breedingCode: number
  speciesComments: number
  catalogNumbers: number
  time: number
  duration: number
  distance: number
  area: number
  protocol: number
  numObservers: number
  allObsReported: number
  checklistComments: number
  stateProvince: number
}

function columnIndex(headerRow: readonly string[]): ColumnIndex {
  const headers = headerRow.map(h => h.trim().toLowerCase())
  const idx: ColumnIndex = {
    submissionId:      headers.findIndex(h => h === 'submission id'),
    commonName:        headers.findIndex(h => h === 'common name'),
    sciName:           headers.findIndex(h => h === 'scientific name'),
    date:              headers.findIndex(h => h === 'date'),
    location:          headers.findIndex(h => h === 'location'),
    locationId:        headers.findIndex(h => h === 'location id'),
    latitude:          headers.findIndex(h => h === 'latitude'),
    longitude:         headers.findIndex(h => h === 'longitude'),
    county:            headers.findIndex(h => h === 'county'),
    count:             headers.findIndex(h => h === 'count'),
    breedingCode:      headers.findIndex(h => h === 'breeding code'),
    speciesComments:   headers.findIndex(h => h === 'species comments' || h === 'observation details'),
    catalogNumbers:    headers.findIndex(h => h === 'ml catalog numbers'),
    time:              headers.findIndex(h => h === 'time'),
    duration:          headers.findIndex(h => h === 'duration min' || h === 'duration (min)'),
    distance:          headers.findIndex(h => h === 'distance traveled (km)'),
    area:              headers.findIndex(h => h === 'area covered (ha)'),
    protocol:          headers.findIndex(h => h === 'protocol'),
    numObservers:      headers.findIndex(h => h === 'number of observers'),
    allObsReported:    headers.findIndex(h => h === 'all obs reported'),
    checklistComments: headers.findIndex(h => h === 'checklist comments'),
    stateProvince:     headers.findIndex(h =>
      h === 'state/province code' || h === 'state province code' || h === 'state/province'
    ),
  }

  if (idx.submissionId === -1 || idx.commonName === -1 || idx.date === -1) {
    throw new Error('INVALID_EBIRD')
  }

  return idx
}

/** Build one entry from one row, or null for a row the parse skips. Reads every
 *  value it keeps out of `cols` before returning, so the reused row array can be
 *  refilled immediately. */
function entryFromRow(cols: readonly string[], idx: ColumnIndex): ObservationEntry | null {
  if (cols.length === 1 && cols[0].trim() === '') return null

  const commonName = cols[idx.commonName]?.trim() ?? ''
  if (!commonName) return null

  const submissionId    = cols[idx.submissionId]?.trim() ?? ''
  const scientificName  = idx.sciName >= 0    ? (cols[idx.sciName]?.trim() ?? '')    : ''
  const date            = cols[idx.date]?.trim() ?? ''
  const location        = idx.location >= 0   ? (cols[idx.location]?.trim() ?? '')   : ''
  const locationId      = idx.locationId >= 0 ? (cols[idx.locationId]?.trim() ?? '') : ''

  const rawLat  = idx.latitude >= 0  ? (cols[idx.latitude]?.trim() ?? '')  : ''
  const rawLng  = idx.longitude >= 0 ? (cols[idx.longitude]?.trim() ?? '') : ''
  const latNum  = parseFloat(rawLat)
  const lngNum  = parseFloat(rawLng)
  const latitude  = rawLat  && !Number.isNaN(latNum)  ? latNum  : null
  const longitude = rawLng  && !Number.isNaN(lngNum)  ? lngNum  : null

  const rawCount   = idx.count >= 0 ? (cols[idx.count]?.trim() ?? '') : ''
  const countInt   = parseInt(rawCount, 10)
  const count      = Number.isNaN(countInt) ? null : countInt

  const rawCode     = idx.breedingCode >= 0 ? (cols[idx.breedingCode]?.trim() ?? '') : ''
  const firstToken  = rawCode.split(/\s+/)[0] ?? ''
  const breedingCode = firstToken || null

  const speciesComments = idx.speciesComments >= 0 ? (cols[idx.speciesComments]?.trim() ?? '') : ''

  const rawCatalog = idx.catalogNumbers >= 0 ? (cols[idx.catalogNumbers]?.trim() ?? '') : ''
  const catalogIds = rawCatalog
    ? rawCatalog.split(/[\s,]+/).map(id => id.replace(/^ML/i, '').trim()).filter(id => /^\d+$/.test(id))
    : []

  const county = idx.county >= 0 ? (cols[idx.county]?.trim() || null) : null

  // Optional checklist-level fields — only included when the column exists in the CSV.
  // Absent column → property omitted (undefined); blank value → null.
  const optFields: {
    time?: string | null
    duration?: number | null
    distance?: number | null
    area?: number | null
    protocol?: string | null
    numObservers?: number | null
    allObsReported?: boolean | null
    checklistComments?: string
    stateProvince?: string | null
  } = {}

  if (idx.time >= 0) {
    optFields.time = cols[idx.time]?.trim() || null
  }
  if (idx.duration >= 0) {
    const raw = cols[idx.duration]?.trim() ?? ''
    const parsed = parseInt(raw, 10)
    optFields.duration = raw && !Number.isNaN(parsed) ? parsed : null
  }
  if (idx.distance >= 0) {
    const raw = cols[idx.distance]?.trim() ?? ''
    const parsed = parseFloat(raw)
    optFields.distance = raw && !Number.isNaN(parsed) ? parsed : null
  }
  if (idx.area >= 0) {
    const raw = cols[idx.area]?.trim() ?? ''
    const parsed = parseFloat(raw)
    optFields.area = raw && !Number.isNaN(parsed) ? parsed : null
  }
  if (idx.protocol >= 0) {
    optFields.protocol = cols[idx.protocol]?.trim() || null
  }
  if (idx.numObservers >= 0) {
    const raw = cols[idx.numObservers]?.trim() ?? ''
    const parsed = parseInt(raw, 10)
    optFields.numObservers = raw && !Number.isNaN(parsed) ? parsed : null
  }
  if (idx.allObsReported >= 0) {
    const raw = cols[idx.allObsReported]?.trim() ?? ''
    optFields.allObsReported = raw === '1' ? true : raw === '0' ? false : null
  }
  if (idx.checklistComments >= 0) {
    optFields.checklistComments = cols[idx.checklistComments]?.trim() ?? ''
  }
  if (idx.stateProvince >= 0) {
    optFields.stateProvince = cols[idx.stateProvince]?.trim() || null
  }

  return {
    submissionId, commonName, scientificName, date, location, locationId,
    latitude, longitude, county, count, breedingCode, speciesComments, catalogIds,
    ...optFields,
  }
}

/**
 * The pack's starting capacity: the export's line-feed count, bounded by its
 * length over `PACKED_BYTES_PER_ROW`.
 *
 * For a real export the line-feed count is the row count (1.00 line feeds a row
 * on the reference export, whose weather blocks sit on one line), so the arrays
 * are sized once and never doubled. But a line feed that makes no row still
 * counts: a blank line, one inside a quoted field, a row with no common name.
 * Unbounded, each reserved `PACKED_BYTES_PER_ROW` (122) bytes, so an eBird
 * header followed by 64 MB of line feeds reserved 8.2 GB and an empty backup
 * could fail to load on a device with less to give (security review L2). The
 * length bound is one the file cannot inflate: the reservation stays under one
 * byte per character of the text it was counted from, which is itself held as a
 * string at least that large. Real rows are far longer than 122 characters (173
 * a row on the demo export, 277 on the synthetic one, 323 on the reference), so
 * for them the line-feed count is the smaller bound and decides. A file of
 * shorter rows starts short and the builder doubles as rows arrive, so its
 * capacity stays under twice the rows it actually makes.
 *
 * Cost: one forward pass of `indexOf('\n')`, each search starting just past the
 * previous line feed and ending at the next one, or at the end of the string
 * when there is none, which ends the loop (the absence case is one search). The
 * loop also stops once the count reaches the length bound, so a line-feed flood
 * is counted only that far. O(n) in the file. No regex and no slice, so nothing
 * here keeps the source alive.
 */
function rowCapacity(content: string): number {
  const bound = Math.ceil(content.length / PACKED_BYTES_PER_ROW)
  let n = 1
  for (let i = content.indexOf('\n'); i !== -1 && n < bound; i = content.indexOf('\n', i + 1)) n++
  return n
}

/**
 * Parse an eBird "MyEBirdData" export into the PACKED form (`observationsPacked.ts`):
 * the parse worker's reply, posted with its buffers transferred.
 *
 * Streams the CSV a row at a time (`streamCsvRows`): the source string, the one
 * reused row array and the packed form are the only whole-file structures alive,
 * never a `string[][]` of every cell and never an array of per-row objects. Each
 * row is still built by `entryFromRow`, unchanged, so what is packed is exactly
 * the entry the shipped parse returned.
 */
export function packEbirdObservations(content: string): PackedObservations {
  const rows = streamCsvRows(content)

  const header = rows.next()
  if (header.done) throw new Error('INVALID_EBIRD')
  const idx = columnIndex(header.value)

  const packed = new PackedObservationsBuilder(rowCapacity(content))
  for (const cols of rows) {
    const entry = entryFromRow(cols, idx)
    if (entry !== null) packed.add(entry)
  }
  return packed.finish()
}

/**
 * Parse an eBird "MyEBirdData" export into observation entries: the packed parse,
 * materialized on this thread. This is the parse wherever no worker runs it (an
 * older browser, jsdom under vitest), and its entries share their strings exactly
 * as the worker path's do.
 *
 * Output is byte-identical to the pre-streaming parser —
 * `parseEbirdObservationsStreaming.test.ts` carries that parser verbatim as a
 * differential oracle and sweeps both over the repo's demo export plus malformed
 * probes, which now proves the pack-and-materialize round trip as well.
 */
export function parseEbirdObservations(content: string): ObservationEntry[] {
  return materializeObservations(packEbirdObservations(content))
}
