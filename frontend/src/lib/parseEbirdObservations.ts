import type { ObservationEntry } from '../types'

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
 * Parse an eBird "MyEBirdData" export into observation entries.
 *
 * Streams the CSV a row at a time (`streamCsvRows`): the source string and the
 * growing entry array are the only whole-file structures alive, never a
 * `string[][]` of every cell. Output is byte-identical to the pre-streaming
 * parser — `parseEbirdObservationsStreaming.test.ts` carries that parser verbatim
 * as a differential oracle and sweeps both over the repo's demo export plus
 * malformed probes.
 */
export function parseEbirdObservations(content: string): ObservationEntry[] {
  const rows = streamCsvRows(content)

  const header = rows.next()
  if (header.done) throw new Error('INVALID_EBIRD')
  const idx = columnIndex(header.value)

  const entries: ObservationEntry[] = []
  for (const cols of rows) {
    const entry = entryFromRow(cols, idx)
    if (entry !== null) entries.push(entry)
  }

  return entries
}
