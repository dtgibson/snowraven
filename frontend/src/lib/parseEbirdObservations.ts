import type { ObservationEntry } from '../types'

// Full CSV parser handling quoted fields with embedded newlines.
// Follows the same character-level approach required by all eBird CSV parsers
// in this project — line-splitting breaks on multi-line quoted fields.
function parseCSV(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
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
      rows.push(row)
      row = []
      i++
      continue
    }

    field += ch
    i++
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

export function parseEbirdObservations(content: string): ObservationEntry[] {
  const rows = parseCSV(content)
  if (rows.length === 0) throw new Error('INVALID_EBIRD')

  const headers = rows[0].map(h => h.trim().toLowerCase())

  const submissionIdIdx       = headers.findIndex(h => h === 'submission id')
  const commonNameIdx         = headers.findIndex(h => h === 'common name')
  const sciNameIdx            = headers.findIndex(h => h === 'scientific name')
  const dateIdx               = headers.findIndex(h => h === 'date')
  const locationIdx           = headers.findIndex(h => h === 'location')
  const locationIdIdx         = headers.findIndex(h => h === 'location id')
  const latitudeIdx           = headers.findIndex(h => h === 'latitude')
  const longitudeIdx          = headers.findIndex(h => h === 'longitude')
  const countyIdx             = headers.findIndex(h => h === 'county')
  const countIdx              = headers.findIndex(h => h === 'count')
  const breedingCodeIdx       = headers.findIndex(h => h === 'breeding code')
  const speciesCommentsIdx    = headers.findIndex(h => h === 'species comments' || h === 'observation details')
  const catalogNumbersIdx     = headers.findIndex(h => h === 'ml catalog numbers')
  const timeIdx               = headers.findIndex(h => h === 'time')
  const durationIdx           = headers.findIndex(h => h === 'duration min')
  const distanceIdx           = headers.findIndex(h => h === 'distance traveled (km)')
  const protocolIdx           = headers.findIndex(h => h === 'protocol')
  const numObserversIdx       = headers.findIndex(h => h === 'number of observers')
  const allObsReportedIdx     = headers.findIndex(h => h === 'all obs reported')
  const checklistCommentsIdx  = headers.findIndex(h => h === 'checklist comments')
  const stateProvinceIdx      = headers.findIndex(h =>
    h === 'state/province code' || h === 'state province code' || h === 'state/province'
  )

  if (submissionIdIdx === -1 || commonNameIdx === -1 || dateIdx === -1) {
    throw new Error('INVALID_EBIRD')
  }

  const entries: ObservationEntry[] = []

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    if (cols.length === 1 && cols[0].trim() === '') continue

    const commonName = cols[commonNameIdx]?.trim() ?? ''
    if (!commonName) continue

    const submissionId    = cols[submissionIdIdx]?.trim() ?? ''
    const scientificName  = sciNameIdx >= 0    ? (cols[sciNameIdx]?.trim() ?? '')          : ''
    const date            = cols[dateIdx]?.trim() ?? ''
    const location        = locationIdx >= 0   ? (cols[locationIdx]?.trim() ?? '')         : ''
    const locationId      = locationIdIdx >= 0 ? (cols[locationIdIdx]?.trim() ?? '')       : ''

    const rawLat  = latitudeIdx >= 0  ? (cols[latitudeIdx]?.trim() ?? '')  : ''
    const rawLng  = longitudeIdx >= 0 ? (cols[longitudeIdx]?.trim() ?? '') : ''
    const latNum  = parseFloat(rawLat)
    const lngNum  = parseFloat(rawLng)
    const latitude  = rawLat  && !Number.isNaN(latNum)  ? latNum  : null
    const longitude = rawLng  && !Number.isNaN(lngNum)  ? lngNum  : null

    const rawCount   = countIdx >= 0 ? (cols[countIdx]?.trim() ?? '') : ''
    const countInt   = parseInt(rawCount, 10)
    const count      = Number.isNaN(countInt) ? null : countInt

    const rawCode     = breedingCodeIdx >= 0 ? (cols[breedingCodeIdx]?.trim() ?? '') : ''
    const firstToken  = rawCode.split(/\s+/)[0] ?? ''
    const breedingCode = firstToken || null

    const speciesComments = speciesCommentsIdx >= 0 ? (cols[speciesCommentsIdx]?.trim() ?? '') : ''

    const rawCatalog = catalogNumbersIdx >= 0 ? (cols[catalogNumbersIdx]?.trim() ?? '') : ''
    const catalogIds = rawCatalog
      ? rawCatalog.split(/[\s,]+/).map(id => id.replace(/^ML/i, '').trim()).filter(id => /^\d+$/.test(id))
      : []

    const county = countyIdx >= 0 ? (cols[countyIdx]?.trim() || null) : null

    // Optional checklist-level fields — only included when the column exists in the CSV.
    // Absent column → property omitted (undefined); blank value → null.
    const optFields: {
      time?: string | null
      duration?: number | null
      distance?: number | null
      protocol?: string | null
      numObservers?: number | null
      allObsReported?: boolean | null
      checklistComments?: string
      stateProvince?: string | null
    } = {}

    if (timeIdx >= 0) {
      optFields.time = cols[timeIdx]?.trim() || null
    }
    if (durationIdx >= 0) {
      const raw = cols[durationIdx]?.trim() ?? ''
      const parsed = parseInt(raw, 10)
      optFields.duration = raw && !Number.isNaN(parsed) ? parsed : null
    }
    if (distanceIdx >= 0) {
      const raw = cols[distanceIdx]?.trim() ?? ''
      const parsed = parseFloat(raw)
      optFields.distance = raw && !Number.isNaN(parsed) ? parsed : null
    }
    if (protocolIdx >= 0) {
      optFields.protocol = cols[protocolIdx]?.trim() || null
    }
    if (numObserversIdx >= 0) {
      const raw = cols[numObserversIdx]?.trim() ?? ''
      const parsed = parseInt(raw, 10)
      optFields.numObservers = raw && !Number.isNaN(parsed) ? parsed : null
    }
    if (allObsReportedIdx >= 0) {
      const raw = cols[allObsReportedIdx]?.trim() ?? ''
      optFields.allObsReported = raw === '1' ? true : raw === '0' ? false : null
    }
    if (checklistCommentsIdx >= 0) {
      optFields.checklistComments = cols[checklistCommentsIdx]?.trim() ?? ''
    }
    if (stateProvinceIdx >= 0) {
      optFields.stateProvince = cols[stateProvinceIdx]?.trim() || null
    }

    entries.push({
      submissionId, commonName, scientificName, date, location, locationId,
      latitude, longitude, county, count, breedingCode, speciesComments, catalogIds,
      ...optFields,
    })
  }

  return entries
}
