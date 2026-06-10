import type { LifeListEntry } from './parseLifeList'

export interface MLExportRow {
  catalogId: string
  commonName: string
  scientificName: string
  format: 'Photo' | 'Audio' | 'Video'
  date: string
  location: string
  county: string | null
  latitude: number | null
  longitude: number | null
  // Free-text fields (optional; '' when the column is absent or blank). The ML
  // export carries up to three: the asset Caption, the Media notes, and the
  // Observation Details (the eBird observation comment carried onto the media row).
  caption: string
  mediaNotes: string
  observationDetails: string
  // Richer fields for media statistics (Statistics → Media card). Stored as the
  // RAW export strings here; parsing/normalization lives in lib/mediaStats.ts so
  // this stays a thin reader. All optional — '' / null / 0 when the column is
  // absent (older or column-light exports keep parsing unchanged).
  ageSex: string        // e.g. "Adult Female – 1; Adult Male – 1" (en-dash + count, "; " groups)
  behaviors: string     // e.g. "Flying; Vocalizing" (controlled vocab, "; "-joined)
  time: string          // "HMM"/"HHMM" 24h clock, e.g. "643" = 06:43
  year: number | null
  month: number | null  // 1-12
  avgRating: number | null  // Average Community Rating 0..5 (0 when unrated)
  numRatings: number    // Number of Ratings (0 when blank — gate "rated" on > 0)
  checklistId: string   // eBird Checklist ID, e.g. "S123456789" ('' when absent)
}

export interface MLExportResult {
  entries: LifeListEntry[]
  mediaMap: Record<string, string>
  rows: MLExportRow[]
}

export function aggregateMLRows(rows: MLExportRow[]): LifeListEntry[] {
  type Entry = { scientificName: string; catalogIds: Set<string> }
  const speciesMap = new Map<string, Entry>()
  for (const row of rows) {
    const existing = speciesMap.get(row.commonName)
    if (!existing) {
      speciesMap.set(row.commonName, { scientificName: row.scientificName, catalogIds: new Set([row.catalogId]) })
    } else {
      existing.catalogIds.add(row.catalogId)
    }
  }
  return [...speciesMap.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map(commonName => {
      const data = speciesMap.get(commonName)!
      return {
        commonName,
        scientificName: data.scientificName,
        taxonomicOrder: Infinity,
        catalogIds: [...data.catalogIds],
      }
    })
}

// Record-aware CSV tokenizer: splits the whole text into records (rows of
// fields), treating commas and newlines inside double-quotes as literal. This is
// required because comment fields (Observation Details / Media notes / Caption)
// can contain embedded newlines; a line-by-line split would truncate them.
function parseCSVRecords(text: string): string[][] {
  const records: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      row.push(field); field = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++ // CRLF → one boundary
      row.push(field); field = ''
      records.push(row); row = []
    } else {
      field += ch
    }
  }
  row.push(field)
  records.push(row)
  return records
}

function col(cols: string[], idx: number): string {
  return cols[idx]?.trim().replace(/^"|"$/g, '') ?? ''
}

function isExcluded(name: string): boolean {
  return name.endsWith(' sp.') || name.includes('/') || name.includes(' x ')
}

function normalizeSpeciesName(name: string): string {
  const parenIdx = name.indexOf('(')
  if (parenIdx === -1) return name
  return name.slice(0, parenIdx).trim()
}

const VALID_FORMATS = new Set(['Photo', 'Audio', 'Video'])

export function parseMLExport(text: string): MLExportResult {
  const records = parseCSVRecords(text)
  const headerRow = records[0]
  if (!headerRow || (headerRow.length === 1 && headerRow[0].trim() === '')) {
    throw new Error('INVALID_ML_EXPORT')
  }

  const headers = headerRow.map(h =>
    h.trim().replace(/^"|"$/g, '').toLowerCase()
  )

  const catalogIdx = headers.findIndex(
    h => h === 'catalog number' || h === 'ml catalog number'
  )
  const commonNameIdx     = headers.findIndex(h => h === 'common name')
  const scientificNameIdx = headers.findIndex(h => h === 'scientific name')
  const formatIdx         = headers.findIndex(h => h === 'format')
  const dateIdx           = headers.findIndex(h => h === 'date')
  // A real ML export names this column "Locality"; older/synthetic files use
  // "Location". Accept either so the location field (and county resolution) work.
  const locationIdx       = headers.findIndex(h => h === 'location' || h === 'locality')
  const countyIdx         = headers.findIndex(h => h === 'county')
  const latitudeIdx       = headers.findIndex(h => h === 'latitude')
  const longitudeIdx      = headers.findIndex(h => h === 'longitude')
  const captionIdx        = headers.findIndex(h => h === 'caption')
  const mediaNotesIdx     = headers.findIndex(h => h === 'media notes')
  const obsDetailsIdx     = headers.findIndex(h => h === 'observation details')
  const ageSexIdx         = headers.findIndex(h => h === 'age/sex')
  const behaviorsIdx      = headers.findIndex(h => h === 'behaviors')
  const timeIdx           = headers.findIndex(h => h === 'time')
  const yearIdx           = headers.findIndex(h => h === 'year')
  const monthIdx          = headers.findIndex(h => h === 'month')
  const avgRatingIdx      = headers.findIndex(h => h === 'average community rating')
  const numRatingsIdx     = headers.findIndex(h => h === 'number of ratings')
  const checklistIdx      = headers.findIndex(h => h === 'ebird checklist id')

  if (catalogIdx === -1 || commonNameIdx === -1 || formatIdx === -1) {
    throw new Error('INVALID_ML_EXPORT')
  }

  const mediaMap: Record<string, string> = {}
  type Entry = { scientificName: string; catalogIds: Set<string> }
  const speciesMap = new Map<string, Entry>()
  const mlRows: MLExportRow[] = []

  for (let i = 1; i < records.length; i++) {
    const cols = records[i]
    if (cols.length === 1 && cols[0].trim() === '') continue // blank line

    const rawId = col(cols, catalogIdx).replace(/^ML/i, '').trim()
    if (!rawId || !/^\d+$/.test(rawId)) continue

    const rawName = col(cols, commonNameIdx)
    if (!rawName || isExcluded(rawName)) continue
    const commonName = normalizeSpeciesName(rawName)

    const format = col(cols, formatIdx)
    if (!VALID_FORMATS.has(format)) continue

    mediaMap[rawId] = format

    const scientificName = scientificNameIdx >= 0 ? col(cols, scientificNameIdx) : ''
    const existing = speciesMap.get(commonName)
    if (!existing) {
      speciesMap.set(commonName, { scientificName, catalogIds: new Set([rawId]) })
    } else {
      existing.catalogIds.add(rawId)
    }

    const rawLat = latitudeIdx  >= 0 ? col(cols, latitudeIdx)  : ''
    const rawLng = longitudeIdx >= 0 ? col(cols, longitudeIdx) : ''
    const latNum = parseFloat(rawLat)
    const lngNum = parseFloat(rawLng)

    const yearNum   = yearIdx      >= 0 ? parseInt(col(cols, yearIdx), 10)      : NaN
    const monthNum  = monthIdx     >= 0 ? parseInt(col(cols, monthIdx), 10)     : NaN
    const ratingNum = avgRatingIdx >= 0 ? parseFloat(col(cols, avgRatingIdx))   : NaN
    const nRatings  = numRatingsIdx>= 0 ? parseInt(col(cols, numRatingsIdx), 10): NaN

    mlRows.push({
      catalogId: rawId,
      commonName,
      scientificName,
      format: format as 'Photo' | 'Audio' | 'Video',
      date:     dateIdx     >= 0 ? col(cols, dateIdx)     : '',
      location: locationIdx >= 0 ? col(cols, locationIdx) : '',
      county:   countyIdx   >= 0 ? (col(cols, countyIdx) || null) : null,
      latitude:  rawLat && !Number.isNaN(latNum) ? latNum : null,
      longitude: rawLng && !Number.isNaN(lngNum) ? lngNum : null,
      caption:            captionIdx    >= 0 ? col(cols, captionIdx)    : '',
      mediaNotes:         mediaNotesIdx >= 0 ? col(cols, mediaNotesIdx) : '',
      observationDetails: obsDetailsIdx >= 0 ? col(cols, obsDetailsIdx) : '',
      ageSex:    ageSexIdx    >= 0 ? col(cols, ageSexIdx)    : '',
      behaviors: behaviorsIdx >= 0 ? col(cols, behaviorsIdx) : '',
      time:      timeIdx      >= 0 ? col(cols, timeIdx)      : '',
      year:  !Number.isNaN(yearNum)  ? yearNum  : null,
      month: !Number.isNaN(monthNum) ? monthNum : null,
      avgRating: !Number.isNaN(ratingNum) ? ratingNum : null,
      numRatings: !Number.isNaN(nRatings) ? nRatings : 0,
      checklistId: checklistIdx >= 0 ? col(cols, checklistIdx).trim() : '',
    })
  }

  const entries: LifeListEntry[] = Array.from(speciesMap.keys())
    .sort((a, b) => a.localeCompare(b))
    .map(commonName => {
      const data = speciesMap.get(commonName)!
      return {
        commonName,
        scientificName: data.scientificName,
        taxonomicOrder: Infinity,
        catalogIds: Array.from(data.catalogIds),
      }
    })

  return { entries, mediaMap, rows: mlRows }
}
