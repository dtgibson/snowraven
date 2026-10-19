// Candidate P4 for decisions.md entry 2: the parse builds a PACKED form (one
// table of distinct strings, two flat typed arrays), which crosses a worker
// boundary as a string table plus transferable buffers, and each side that
// needs entries MATERIALIZES plain ObservationEntry objects from it. Every
// repeated string is then one instance shared by every entry that carries it,
// on both sides of every boundary, in every engine, because the sharing is in
// the data rather than in what an engine's structured clone happens to keep.
import { streamCsvRows } from '../../../../frontend/src/lib/parseEbirdObservations'
import type { ObservationEntry } from '../../../../frontend/src/types'

const NULL_STR = 0xffffffff
// string slots per row
const S_SUB = 0, S_COM = 1, S_SCI = 2, S_DATE = 3, S_LOC = 4, S_LOCID = 5, S_COUNTY = 6, S_BREED = 7,
  S_SPCOM = 8, S_CAT = 9, S_TIME = 10, S_PROTO = 11, S_CHKCOM = 12, S_STATE = 13
const STR_SLOTS = 14
// number slots per row (NaN = null)
const N_LAT = 0, N_LNG = 1, N_COUNT = 2, N_DUR = 3, N_DIST = 4, N_AREA = 5, N_OBS = 6, N_ALL = 7
const NUM_SLOTS = 8
// optional-column presence bits, in the entry's key order
const OPT = ['time', 'duration', 'distance', 'area', 'protocol', 'numObservers', 'allObsReported', 'checklistComments', 'stateProvince'] as const
const ALL_OPT = (1 << OPT.length) - 1

export interface PackedObservations {
  rows: number
  present: number
  strings: string[]
  str: Uint32Array
  num: Float64Array
}

interface ColumnIndex { [k: string]: number }
function columnIndex(headerRow: readonly string[]): ColumnIndex {
  const h = headerRow.map(x => x.trim().toLowerCase())
  const f = (p: (s: string) => boolean) => h.findIndex(p)
  const idx: ColumnIndex = {
    submissionId: f(x => x === 'submission id'), commonName: f(x => x === 'common name'),
    sciName: f(x => x === 'scientific name'), date: f(x => x === 'date'), location: f(x => x === 'location'),
    locationId: f(x => x === 'location id'), latitude: f(x => x === 'latitude'), longitude: f(x => x === 'longitude'),
    county: f(x => x === 'county'), count: f(x => x === 'count'), breedingCode: f(x => x === 'breeding code'),
    speciesComments: f(x => x === 'species comments' || x === 'observation details'),
    catalogNumbers: f(x => x === 'ml catalog numbers'), time: f(x => x === 'time'),
    duration: f(x => x === 'duration min' || x === 'duration (min)'), distance: f(x => x === 'distance traveled (km)'),
    area: f(x => x === 'area covered (ha)'), protocol: f(x => x === 'protocol'),
    numObservers: f(x => x === 'number of observers'), allObsReported: f(x => x === 'all obs reported'),
    checklistComments: f(x => x === 'checklist comments'),
    stateProvince: f(x => x === 'state/province code' || x === 'state province code' || x === 'state/province'),
  }
  if (idx.submissionId === -1 || idx.commonName === -1 || idx.date === -1) throw new Error('INVALID_EBIRD')
  return idx
}

export function packEbirdObservations(content: string): PackedObservations {
  const rowsIt = streamCsvRows(content)
  const header = rowsIt.next()
  if (header.done) throw new Error('INVALID_EBIRD')
  const idx = columnIndex(header.value)
  let present = 0
  OPT.forEach((k, b) => { if (idx[k] >= 0) present |= 1 << b })
  const strings: string[] = []
  const table = new Map<string, number>()
  const S = (s: string): number => {
    let v = table.get(s)
    if (v === undefined) { v = strings.length; strings.push(s); table.set(s, v) }
    return v
  }
  let cap = 1024
  let str = new Uint32Array(cap * STR_SLOTS)
  let num = new Float64Array(cap * NUM_SLOTS)
  let n = 0
  const cell = (cols: readonly string[], i: number) => (i >= 0 ? (cols[i]?.trim() ?? '') : '')
  const numOrNaN = (raw: string, parsed: number) => (raw && !Number.isNaN(parsed) ? parsed : NaN)
  for (const cols of rowsIt) {
    if (cols.length === 1 && cols[0].trim() === '') continue
    const commonName = cols[idx.commonName]?.trim() ?? ''
    if (!commonName) continue
    if (n === cap) {
      cap *= 2
      const s2 = new Uint32Array(cap * STR_SLOTS); s2.set(str); str = s2
      const n2 = new Float64Array(cap * NUM_SLOTS); n2.set(num); num = n2
    }
    const so = n * STR_SLOTS
    const no = n * NUM_SLOTS
    str[so + S_SUB] = S(cols[idx.submissionId]?.trim() ?? '')
    str[so + S_COM] = S(commonName)
    str[so + S_SCI] = S(cell(cols, idx.sciName))
    str[so + S_DATE] = S(cols[idx.date]?.trim() ?? '')
    str[so + S_LOC] = S(cell(cols, idx.location))
    str[so + S_LOCID] = S(cell(cols, idx.locationId))
    const rawLat = cell(cols, idx.latitude)
    const rawLng = cell(cols, idx.longitude)
    num[no + N_LAT] = numOrNaN(rawLat, parseFloat(rawLat))
    num[no + N_LNG] = numOrNaN(rawLng, parseFloat(rawLng))
    const county = idx.county >= 0 ? (cols[idx.county]?.trim() || null) : null
    str[so + S_COUNTY] = county === null ? NULL_STR : S(county)
    const countInt = parseInt(cell(cols, idx.count), 10)
    num[no + N_COUNT] = countInt
    const firstToken = cell(cols, idx.breedingCode).split(/\s+/)[0] ?? ''
    str[so + S_BREED] = firstToken ? S(firstToken) : NULL_STR
    str[so + S_SPCOM] = S(cell(cols, idx.speciesComments))
    const rawCatalog = cell(cols, idx.catalogNumbers)
    const ids = rawCatalog
      ? rawCatalog.split(/[\s,]+/).map(id => id.replace(/^ML/i, '').trim()).filter(id => /^\d+$/.test(id))
      : []
    str[so + S_CAT] = ids.length === 0 ? NULL_STR : S(ids.join(' '))
    if (idx.time >= 0) str[so + S_TIME] = S(cols[idx.time]?.trim() || '') // '' = null
    if (idx.duration >= 0) { const r = cell(cols, idx.duration); num[no + N_DUR] = numOrNaN(r, parseInt(r, 10)) }
    if (idx.distance >= 0) { const r = cell(cols, idx.distance); num[no + N_DIST] = numOrNaN(r, parseFloat(r)) }
    if (idx.area >= 0) { const r = cell(cols, idx.area); num[no + N_AREA] = numOrNaN(r, parseFloat(r)) }
    if (idx.protocol >= 0) str[so + S_PROTO] = S(cols[idx.protocol]?.trim() || '')
    if (idx.numObservers >= 0) { const r = cell(cols, idx.numObservers); num[no + N_OBS] = numOrNaN(r, parseInt(r, 10)) }
    if (idx.allObsReported >= 0) { const r = cell(cols, idx.allObsReported); num[no + N_ALL] = r === '1' ? 1 : r === '0' ? 0 : NaN }
    if (idx.checklistComments >= 0) str[so + S_CHKCOM] = S(cell(cols, idx.checklistComments))
    if (idx.stateProvince >= 0) str[so + S_STATE] = S(cols[idx.stateProvince]?.trim() || '')
    n++
  }
  return { rows: n, present, strings, str: str.slice(0, n * STR_SLOTS), num: num.slice(0, n * NUM_SLOTS) }
}

const EMPTY_IDS: string[] = Object.freeze([]) as unknown as string[]

export function materializeObservations(p: PackedObservations): ObservationEntry[] {
  const { rows, strings, str, num, present } = p
  const out = new Array<ObservationEntry>(rows)
  const sn = (i: number) => (i === NULL_STR ? null : strings[i])
  const se = (i: number) => (strings[i] === '' ? null : strings[i]) // optional '' = null
  const nn = (v: number) => (Number.isNaN(v) ? null : v)
  for (let r = 0; r < rows; r++) {
    const so = r * STR_SLOTS
    const no = r * NUM_SLOTS
    const cat = str[so + S_CAT]
    const catalogIds = cat === NULL_STR ? EMPTY_IDS : strings[cat].split(' ')
    const all = num[no + N_ALL]
    if (present === ALL_OPT) {
      out[r] = {
        submissionId: strings[str[so + S_SUB]], commonName: strings[str[so + S_COM]],
        scientificName: strings[str[so + S_SCI]], date: strings[str[so + S_DATE]],
        location: strings[str[so + S_LOC]], locationId: strings[str[so + S_LOCID]],
        latitude: nn(num[no + N_LAT]), longitude: nn(num[no + N_LNG]),
        county: sn(str[so + S_COUNTY]), count: nn(num[no + N_COUNT]), breedingCode: sn(str[so + S_BREED]),
        speciesComments: strings[str[so + S_SPCOM]], catalogIds,
        time: se(str[so + S_TIME]), duration: nn(num[no + N_DUR]), distance: nn(num[no + N_DIST]),
        area: nn(num[no + N_AREA]), protocol: se(str[so + S_PROTO]), numObservers: nn(num[no + N_OBS]),
        allObsReported: Number.isNaN(all) ? null : all === 1,
        checklistComments: strings[str[so + S_CHKCOM]], stateProvince: se(str[so + S_STATE]),
      }
    } else {
      const e: ObservationEntry = {
        submissionId: strings[str[so + S_SUB]], commonName: strings[str[so + S_COM]],
        scientificName: strings[str[so + S_SCI]], date: strings[str[so + S_DATE]],
        location: strings[str[so + S_LOC]], locationId: strings[str[so + S_LOCID]],
        latitude: nn(num[no + N_LAT]), longitude: nn(num[no + N_LNG]),
        county: sn(str[so + S_COUNTY]), count: nn(num[no + N_COUNT]), breedingCode: sn(str[so + S_BREED]),
        speciesComments: strings[str[so + S_SPCOM]], catalogIds,
      }
      if (present & 1) e.time = se(str[so + S_TIME])
      if (present & 2) e.duration = nn(num[no + N_DUR])
      if (present & 4) e.distance = nn(num[no + N_DIST])
      if (present & 8) e.area = nn(num[no + N_AREA])
      if (present & 16) e.protocol = se(str[so + S_PROTO])
      if (present & 32) e.numObservers = nn(num[no + N_OBS])
      if (present & 64) e.allObsReported = Number.isNaN(all) ? null : all === 1
      if (present & 128) e.checklistComments = strings[str[so + S_CHKCOM]]
      if (present & 256) e.stateProvince = se(str[so + S_STATE])
      out[r] = e
    }
  }
  return out
}

/** Re-pack interned entries (what a hand-over without a retained packed form costs). */
export function repack(obs: readonly ObservationEntry[]): PackedObservations {
  const strings: string[] = []
  const table = new Map<string, number>()
  const S = (s: string) => { let v = table.get(s); if (v === undefined) { v = strings.length; strings.push(s); table.set(s, v) } return v }
  const str = new Uint32Array(obs.length * STR_SLOTS)
  const num = new Float64Array(obs.length * NUM_SLOTS)
  for (let r = 0; r < obs.length; r++) {
    const o = obs[r]; const so = r * STR_SLOTS; const no = r * NUM_SLOTS
    str[so] = S(o.submissionId); str[so + 1] = S(o.commonName); str[so + 2] = S(o.scientificName); str[so + 3] = S(o.date)
    str[so + 4] = S(o.location); str[so + 5] = S(o.locationId); str[so + 6] = o.county === null ? NULL_STR : S(o.county)
    str[so + 7] = o.breedingCode === null ? NULL_STR : S(o.breedingCode); str[so + 8] = S(o.speciesComments)
    str[so + 9] = o.catalogIds.length ? S(o.catalogIds.join(' ')) : NULL_STR
    str[so + 10] = S(o.time ?? ''); str[so + 11] = S(o.protocol ?? ''); str[so + 12] = S(o.checklistComments ?? ''); str[so + 13] = S(o.stateProvince ?? '')
    num[no] = o.latitude ?? NaN; num[no + 1] = o.longitude ?? NaN; num[no + 2] = o.count ?? NaN; num[no + 3] = o.duration ?? NaN
    num[no + 4] = o.distance ?? NaN; num[no + 5] = o.area ?? NaN; num[no + 6] = o.numObservers ?? NaN
    num[no + 7] = o.allObsReported == null ? NaN : o.allObsReported ? 1 : 0
  }
  return { rows: obs.length, present: ALL_OPT, strings, str, num }
}
