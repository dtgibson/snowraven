// Shape candidates for decisions.md entry 2, weighed on the same engines as the
// shipped parser before either was built into the app. Each candidate is the
// shipped `entryFromRow` with one change, so the difference measured is the
// change and nothing else.
//
//   P1  intern every repeated string field through one Map for the parse, and
//       share one frozen empty catalogIds array;
//   P2  P1, plus a single full object literal when all nine optional columns
//       are present (the normal eBird export), so every entry is one
//       allocation with in-object fields instead of a literal grown by a
//       spread of optional fields;
//   P3  no per-row objects at all: typed-array columns over one string table.
//       The floor a getter-view design could reach, measured to know what P2
//       leaves on the table.
import { streamCsvRows, parseEbirdObservations } from '../../../../frontend/src/lib/parseEbirdObservations'
import { computeStatsBundle } from '../../../../frontend/src/lib/statsBundle'
import type { ObservationEntry } from '../../../../frontend/src/types'

interface Idx { [k: string]: number }
function columnIndex(headerRow: readonly string[]): Idx {
  const h = headerRow.map(x => x.trim().toLowerCase())
  const f = (p: (s: string) => boolean) => h.findIndex(p)
  return {
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
}

const EMPTY: string[] = Object.freeze([]) as unknown as string[]

function parseInterned(content: string, fullLiteral: boolean): ObservationEntry[] {
  const rows = streamCsvRows(content)
  const header = rows.next()
  if (header.done) throw new Error('INVALID_EBIRD')
  const idx = columnIndex(header.value)
  const table = new Map<string, string>()
  const I = (s: string): string => { const v = table.get(s); if (v !== undefined) return v; table.set(s, s); return s }
  const all = ['time', 'duration', 'distance', 'area', 'protocol', 'numObservers', 'allObsReported', 'checklistComments', 'stateProvince'].every(k => idx[k] >= 0)
  const out: ObservationEntry[] = []
  for (const cols of rows) {
    if (cols.length === 1 && cols[0].trim() === '') continue
    const commonName = cols[idx.commonName]?.trim() ?? ''
    if (!commonName) continue
    const g = (k: string) => (idx[k] >= 0 ? (cols[idx[k]]?.trim() ?? '') : '')
    const rawLat = g('latitude'); const rawLng = g('longitude')
    const latNum = parseFloat(rawLat); const lngNum = parseFloat(rawLng)
    const rawCount = g('count'); const countInt = parseInt(rawCount, 10)
    const rawCode = g('breedingCode'); const firstToken = rawCode.split(/\s+/)[0] ?? ''
    const rawCatalog = g('catalogNumbers')
    const catalogIds = rawCatalog
      ? rawCatalog.split(/[\s,]+/).map(id => id.replace(/^ML/i, '').trim()).filter(id => /^\d+$/.test(id))
      : EMPTY
    const county = idx.county >= 0 ? (cols[idx.county]?.trim() || null) : null
    const num = (k: string, f: (s: string) => number) => { const r = g(k); const p = f(r); return r && !Number.isNaN(p) ? p : null }
    const base = {
      submissionId: I(g('submissionId')), commonName: I(commonName), scientificName: I(g('sciName')),
      date: I(g('date')), location: I(g('location')), locationId: I(g('locationId')),
      latitude: rawLat && !Number.isNaN(latNum) ? latNum : null,
      longitude: rawLng && !Number.isNaN(lngNum) ? lngNum : null,
      county: county === null ? null : I(county),
      count: Number.isNaN(countInt) ? null : countInt,
      breedingCode: firstToken ? I(firstToken) : null,
      speciesComments: I(g('speciesComments')),
      catalogIds: catalogIds.length === 0 ? EMPTY : catalogIds,
    }
    if (fullLiteral && all) {
      const ar = g('allObsReported')
      out.push({
        submissionId: base.submissionId, commonName: base.commonName, scientificName: base.scientificName,
        date: base.date, location: base.location, locationId: base.locationId, latitude: base.latitude,
        longitude: base.longitude, county: base.county, count: base.count, breedingCode: base.breedingCode,
        speciesComments: base.speciesComments, catalogIds: base.catalogIds,
        time: g('time') ? I(g('time')) : null,
        duration: num('duration', s => parseInt(s, 10)),
        distance: num('distance', parseFloat),
        area: num('area', parseFloat),
        protocol: g('protocol') ? I(g('protocol')) : null,
        numObservers: num('numObservers', s => parseInt(s, 10)),
        allObsReported: ar === '1' ? true : ar === '0' ? false : null,
        checklistComments: I(g('checklistComments')),
        stateProvince: g('stateProvince') ? I(g('stateProvince')) : null,
      })
    } else {
      const o: Record<string, unknown> = {}
      if (idx.time >= 0) o.time = g('time') ? I(g('time')) : null
      if (idx.duration >= 0) o.duration = num('duration', s => parseInt(s, 10))
      if (idx.distance >= 0) o.distance = num('distance', parseFloat)
      if (idx.area >= 0) o.area = num('area', parseFloat)
      if (idx.protocol >= 0) o.protocol = g('protocol') ? I(g('protocol')) : null
      if (idx.numObservers >= 0) o.numObservers = num('numObservers', s => parseInt(s, 10))
      if (idx.allObsReported >= 0) { const ar = g('allObsReported'); o.allObsReported = ar === '1' ? true : ar === '0' ? false : null }
      if (idx.checklistComments >= 0) o.checklistComments = I(g('checklistComments'))
      if (idx.stateProvince >= 0) o.stateProvince = g('stateProvince') ? I(g('stateProvince')) : null
      out.push({ ...base, ...o } as ObservationEntry)
    }
  }
  return out
}

// P3: columns. Only the storage is modelled (what a view design would hold).
function parseColumns(content: string) {
  const rows = streamCsvRows(content)
  const header = rows.next()
  if (header.done) throw new Error('INVALID_EBIRD')
  const idx = columnIndex(header.value)
  const strings: string[] = []
  const table = new Map<string, number>()
  const S = (s: string) => { let v = table.get(s); if (v === undefined) { v = strings.length; strings.push(s); table.set(s, v) } return v }
  const STR = ['submissionId', 'commonName', 'sciName', 'date', 'location', 'locationId', 'county', 'breedingCode', 'speciesComments', 'catalogNumbers', 'time', 'protocol', 'checklistComments', 'stateProvince']
  const NUM = ['latitude', 'longitude', 'count', 'duration', 'distance', 'area', 'numObservers', 'allObsReported']
  let cap = 1024
  let n = 0
  let sc = STR.map(() => new Int32Array(cap))
  let nc = NUM.map(() => new Float64Array(cap))
  for (const cols of rows) {
    if (cols.length === 1 && cols[0].trim() === '') continue
    if (!(cols[idx.commonName]?.trim())) continue
    if (n === cap) {
      cap *= 2
      sc = sc.map(a => { const b = new Int32Array(cap); b.set(a); return b })
      nc = nc.map(a => { const b = new Float64Array(cap); b.set(a); return b })
    }
    for (let k = 0; k < STR.length; k++) sc[k][n] = idx[STR[k]] >= 0 ? S(cols[idx[STR[k]]]?.trim() ?? '') : -1
    for (let k = 0; k < NUM.length; k++) nc[k][n] = idx[NUM[k]] >= 0 ? parseFloat(cols[idx[NUM[k]]] ?? '') : NaN
    n++
  }
  return { n, strings, sc: sc.map(a => a.slice(0, n)), nc: nc.map(a => a.slice(0, n)) }
}

const g = globalThis as unknown as Record<string, unknown>
g.SRH = {
  parseEbirdObservations,
  P1: (t: string) => parseInterned(t, false),
  P2: (t: string) => parseInterned(t, true),
  P3: parseColumns,
  computeStatsBundle,
  defaultRequest: { includeSpuh: false, granularity: 'total', excludedNames: [] },
}

import { packEbirdObservations, materializeObservations, repack } from './packed-proto'
;(g.SRH as Record<string, unknown>).pack = packEbirdObservations
;(g.SRH as Record<string, unknown>).materialize = materializeObservations
;(g.SRH as Record<string, unknown>).repack = repack
;(g.SRH as Record<string, unknown>).P4 = (t: string) => materializeObservations(packEbirdObservations(t))

import { timeTabs, tabOutputs } from './tabs'
;(g.SRH as Record<string, unknown>).timeTabs = timeTabs
;(g.SRH as Record<string, unknown>).tabOutputs = tabOutputs
