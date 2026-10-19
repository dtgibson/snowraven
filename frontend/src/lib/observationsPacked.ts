import type { ObservationEntry } from '../types'

/**
 * The packed form of a parsed eBird export: one table of DISTINCT strings and a
 * few flat typed arrays, built once by the parse and turned into ordinary
 * `ObservationEntry` objects wherever a thread needs entries
 * (big-old-life-lists, decisions.md entries 1 and 2).
 *
 * WHY IT EXISTS. A parsed entry used to carry its own copy of every string it
 * read, so a checklist's comment (on the reference export, a weather block of
 * about 490 characters) was held once per species row of that checklist, and
 * the same was true of every date, place, protocol and submission id. Measured
 * per held copy: 831 B/row in V8 (Node), 612 in Chromium, 910 in JavaScriptCore.
 * Built from this form, every entry that carries a string shares one instance of
 * it, and the copy measures 305, about 180 and 272 B/row in the same engines.
 *
 * WHY A PACKED FORM AND NOT INTERNING ALONE. The parse runs in a worker and the
 * statistics run in another, and a structured clone does not keep string
 * sharing: interned entries measured 782 B/row after one V8 clone, against 315
 * before it. So what crosses a thread boundary is this form, a string table
 * cloned once per distinct string plus buffers that are TRANSFERRED (moved, not
 * copied), and each side materializes its own entries. The entries themselves
 * are plain objects with the same keys in the same order and the same values as
 * the shipped parse produced, so no consumer changes; `parseEbirdObservations
 * Streaming.test.ts` holds the round trip to the pre-change parser byte for byte.
 *
 * NOTHING HERE IS PERSISTED. The form lives between a `postMessage` and the
 * materialize that consumes it, and is never written to storage.
 */
export interface PackedObservations {
  /** Number of entries. Authoritative: the arrays may be longer (a parse
   *  sizes them from an estimate, doubles them past it, and transfers them
   *  without trimming). */
  rows: number
  /** Distinct strings; every string slot is an index into this table. */
  strings: string[]
  /** `STR_SLOTS` string-table indices per row; `NULL_INDEX` means null. */
  str: Uint32Array
  /** `NUM_SLOTS` numbers per row; NaN means null (the parse never yields NaN). */
  num: Float64Array
  /** Per row, which of the nine optional keys the entry has (`OPTIONAL_KEYS`). */
  opt: Uint16Array
  /** Row r's catalog ids are `catIds[catStart[r]] .. catIds[catStart[r + 1] - 1]`. */
  catStart: Uint32Array
  /** String-table indices of catalog ids, row after row. */
  catIds: Uint32Array
}

export const NULL_INDEX = 0xffffffff

// String slots. `checklistComments` is optional and typed as a string, but the
// slot takes null like the others so a round trip never depends on that.
const S_SUBMISSION = 0, S_COMMON = 1, S_SCI = 2, S_DATE = 3, S_LOCATION = 4, S_LOCATION_ID = 5,
  S_COUNTY = 6, S_BREEDING = 7, S_SPECIES_COMMENTS = 8, S_TIME = 9, S_PROTOCOL = 10,
  S_CHECKLIST_COMMENTS = 11, S_STATE = 12
export const STR_SLOTS = 13

// Number slots. `allObsReported` is stored as 1, 0 or NaN.
const N_LAT = 0, N_LNG = 1, N_COUNT = 2, N_DURATION = 3, N_DISTANCE = 4, N_AREA = 5,
  N_OBSERVERS = 6, N_ALL_OBS = 7
export const NUM_SLOTS = 8

/**
 * Bytes of typed array the builder reserves per row of capacity: the string
 * slots, the number slots, one optional-key mask and one catalog offset. A
 * parse bounds its capacity hint by the file's length over this, so the
 * reservation can never exceed one byte per character of the file
 * (`rowCapacity` in parseEbirdObservations.ts, security review L2).
 */
export const PACKED_BYTES_PER_ROW = STR_SLOTS * Uint32Array.BYTES_PER_ELEMENT
  + NUM_SLOTS * Float64Array.BYTES_PER_ELEMENT
  + Uint16Array.BYTES_PER_ELEMENT
  + Uint32Array.BYTES_PER_ELEMENT

/** The optional keys, in the order an entry carries them. Bit i of `opt` is key i. */
export const OPTIONAL_KEYS = [
  'time', 'duration', 'distance', 'area', 'protocol', 'numObservers', 'allObsReported',
  'checklistComments', 'stateProvince',
] as const
const ALL_OPTIONAL = (1 << OPTIONAL_KEYS.length) - 1

/**
 * Every entry with no catalog ids shares this one array. It is frozen, so a
 * consumer that tried to grow one entry's list in place would throw rather than
 * silently grow every entry's; none does (the consumers read, filter or copy).
 */
const NO_CATALOG_IDS: string[] = Object.freeze([]) as unknown as string[]

/**
 * Accumulates entries into the packed form, interning every string through one
 * Map for the life of the builder. `capacityHint` sizes the arrays once; past
 * it they double, so a hint that is too small costs copies and never a wrong
 * result, and the capacity then stays under twice the rows added.
 */
export class PackedObservationsBuilder {
  private rows = 0
  private cap: number
  private readonly strings: string[] = []
  private readonly table = new Map<string, number>()
  private str: Uint32Array
  private num: Float64Array
  private opt: Uint16Array
  private catStart: Uint32Array
  private catIds: Uint32Array
  private catLen = 0

  constructor(capacityHint = 1024) {
    this.cap = Math.max(1, capacityHint)
    this.str = new Uint32Array(this.cap * STR_SLOTS)
    this.num = new Float64Array(this.cap * NUM_SLOTS)
    this.opt = new Uint16Array(this.cap)
    this.catStart = new Uint32Array(this.cap + 1)
    this.catIds = new Uint32Array(64)
  }

  private intern(s: string): number {
    let i = this.table.get(s)
    if (i === undefined) {
      i = this.strings.length
      this.strings.push(s)
      this.table.set(s, i)
    }
    return i
  }

  private orNull(s: string | null | undefined): number {
    return s === null || s === undefined ? NULL_INDEX : this.intern(s)
  }

  private grow(): void {
    this.cap *= 2
    const str = new Uint32Array(this.cap * STR_SLOTS); str.set(this.str); this.str = str
    const num = new Float64Array(this.cap * NUM_SLOTS); num.set(this.num); this.num = num
    const opt = new Uint16Array(this.cap); opt.set(this.opt); this.opt = opt
    const cs = new Uint32Array(this.cap + 1); cs.set(this.catStart); this.catStart = cs
  }

  add(e: ObservationEntry): void {
    if (this.rows === this.cap) this.grow()
    const r = this.rows
    const so = r * STR_SLOTS
    const no = r * NUM_SLOTS
    const str = this.str
    const num = this.num
    str[so + S_SUBMISSION] = this.intern(e.submissionId)
    str[so + S_COMMON] = this.intern(e.commonName)
    str[so + S_SCI] = this.intern(e.scientificName)
    str[so + S_DATE] = this.intern(e.date)
    str[so + S_LOCATION] = this.intern(e.location)
    str[so + S_LOCATION_ID] = this.intern(e.locationId)
    str[so + S_COUNTY] = this.orNull(e.county)
    str[so + S_BREEDING] = this.orNull(e.breedingCode)
    str[so + S_SPECIES_COMMENTS] = this.intern(e.speciesComments)
    num[no + N_LAT] = e.latitude ?? NaN
    num[no + N_LNG] = e.longitude ?? NaN
    num[no + N_COUNT] = e.count ?? NaN

    let mask = 0
    if (e.time !== undefined) { mask |= 1; str[so + S_TIME] = this.orNull(e.time) }
    if (e.duration !== undefined) { mask |= 2; num[no + N_DURATION] = e.duration ?? NaN }
    if (e.distance !== undefined) { mask |= 4; num[no + N_DISTANCE] = e.distance ?? NaN }
    if (e.area !== undefined) { mask |= 8; num[no + N_AREA] = e.area ?? NaN }
    if (e.protocol !== undefined) { mask |= 16; str[so + S_PROTOCOL] = this.orNull(e.protocol) }
    if (e.numObservers !== undefined) { mask |= 32; num[no + N_OBSERVERS] = e.numObservers ?? NaN }
    if (e.allObsReported !== undefined) {
      mask |= 64
      num[no + N_ALL_OBS] = e.allObsReported === null ? NaN : e.allObsReported ? 1 : 0
    }
    if (e.checklistComments !== undefined) { mask |= 128; str[so + S_CHECKLIST_COMMENTS] = this.orNull(e.checklistComments) }
    if (e.stateProvince !== undefined) { mask |= 256; str[so + S_STATE] = this.orNull(e.stateProvince) }
    this.opt[r] = mask

    const ids = e.catalogIds
    if (this.catLen + ids.length > this.catIds.length) {
      const grown = new Uint32Array(Math.max(this.catIds.length * 2, this.catLen + ids.length))
      grown.set(this.catIds)
      this.catIds = grown
    }
    for (const id of ids) this.catIds[this.catLen++] = this.intern(id)
    this.catStart[r + 1] = this.catLen
    this.rows = r + 1
  }

  /** The packed form. The builder must not be used afterwards. */
  finish(): PackedObservations {
    return {
      rows: this.rows,
      strings: this.strings,
      str: this.str,
      num: this.num,
      opt: this.opt,
      catStart: this.catStart,
      catIds: this.catIds,
    }
  }
}

/** Pack entries that already exist (the statistics hand-over). Exact sizes. */
export function packObservationEntries(entries: readonly ObservationEntry[]): PackedObservations {
  const b = new PackedObservationsBuilder(entries.length)
  for (const e of entries) b.add(e)
  return b.finish()
}

/** The buffers a `postMessage` should TRANSFER rather than copy. After the post
 *  they are detached on the sending side, so send a form nothing else holds. */
export function packedTransferables(p: PackedObservations): ArrayBuffer[] {
  return [p.str.buffer, p.num.buffer, p.opt.buffer, p.catStart.buffer, p.catIds.buffer] as ArrayBuffer[]
}

function malformed(): never {
  throw new Error('PACKED_OBSERVATIONS_MALFORMED')
}

/**
 * Build entries from the packed form: plain objects, keys in the shipped parse's
 * order (the thirteen it always carries, then each optional key the row has, in
 * `OPTIONAL_KEYS` order), every string the table's one instance of it.
 *
 * THE PAYLOAD IS CHECKED, NOT TRUSTED (the v1.0.20 settle-contract rule): this
 * runs on what a worker replied, and an entry built from an index past the
 * table would read `undefined` as a name and carry it into every tab. Any shape
 * or index that does not fit throws `PACKED_OBSERVATIONS_MALFORMED`, which each
 * caller already routes to its failure path.
 *
 * Entries are PUSHED, never written into a preallocated `new Array(rows)`, so
 * the array is the same packed-elements array the shipped parse returned.
 */
export function materializeObservations(p: PackedObservations): ObservationEntry[] {
  if (!p || typeof p !== 'object') malformed()
  const { rows, strings, str, num, opt, catStart, catIds } = p
  if (!Number.isInteger(rows) || rows < 0 || !Array.isArray(strings)
    || !(str instanceof Uint32Array) || !(num instanceof Float64Array) || !(opt instanceof Uint16Array)
    || !(catStart instanceof Uint32Array) || !(catIds instanceof Uint32Array)
    || str.length < rows * STR_SLOTS || num.length < rows * NUM_SLOTS || opt.length < rows
    || catStart.length < rows + 1) {
    malformed()
  }
  const n = strings.length
  const s = (i: number): string => {
    if (i >= n) malformed()
    const v = strings[i]
    if (typeof v !== 'string') malformed()
    return v
  }
  const sn = (i: number): string | null => (i === NULL_INDEX ? null : s(i))
  const nn = (v: number): number | null => (Number.isNaN(v) ? null : v)
  const bool = (v: number): boolean | null => (Number.isNaN(v) ? null : v === 1)

  const out: ObservationEntry[] = []
  for (let r = 0; r < rows; r++) {
    const so = r * STR_SLOTS
    const no = r * NUM_SLOTS
    const c0 = catStart[r]
    const c1 = catStart[r + 1]
    if (c1 < c0 || c1 > catIds.length) malformed()
    let catalogIds = NO_CATALOG_IDS
    if (c1 > c0) {
      catalogIds = []
      for (let k = c0; k < c1; k++) catalogIds.push(s(catIds[k]))
    }
    const mask = opt[r]
    if (mask === ALL_OPTIONAL) {
      // The normal eBird export carries all nine optional columns: one literal,
      // so every entry is one allocation with its fields in-object.
      out.push({
        submissionId: s(str[so + S_SUBMISSION]),
        commonName: s(str[so + S_COMMON]),
        scientificName: s(str[so + S_SCI]),
        date: s(str[so + S_DATE]),
        location: s(str[so + S_LOCATION]),
        locationId: s(str[so + S_LOCATION_ID]),
        latitude: nn(num[no + N_LAT]),
        longitude: nn(num[no + N_LNG]),
        county: sn(str[so + S_COUNTY]),
        count: nn(num[no + N_COUNT]),
        breedingCode: sn(str[so + S_BREEDING]),
        speciesComments: s(str[so + S_SPECIES_COMMENTS]),
        catalogIds,
        time: sn(str[so + S_TIME]),
        duration: nn(num[no + N_DURATION]),
        distance: nn(num[no + N_DISTANCE]),
        area: nn(num[no + N_AREA]),
        protocol: sn(str[so + S_PROTOCOL]),
        numObservers: nn(num[no + N_OBSERVERS]),
        allObsReported: bool(num[no + N_ALL_OBS]),
        checklistComments: sn(str[so + S_CHECKLIST_COMMENTS]) as string,
        stateProvince: sn(str[so + S_STATE]),
      })
      continue
    }
    if (mask > ALL_OPTIONAL) malformed()
    const e: ObservationEntry = {
      submissionId: s(str[so + S_SUBMISSION]),
      commonName: s(str[so + S_COMMON]),
      scientificName: s(str[so + S_SCI]),
      date: s(str[so + S_DATE]),
      location: s(str[so + S_LOCATION]),
      locationId: s(str[so + S_LOCATION_ID]),
      latitude: nn(num[no + N_LAT]),
      longitude: nn(num[no + N_LNG]),
      county: sn(str[so + S_COUNTY]),
      count: nn(num[no + N_COUNT]),
      breedingCode: sn(str[so + S_BREEDING]),
      speciesComments: s(str[so + S_SPECIES_COMMENTS]),
      catalogIds,
    }
    if (mask & 1) e.time = sn(str[so + S_TIME])
    if (mask & 2) e.duration = nn(num[no + N_DURATION])
    if (mask & 4) e.distance = nn(num[no + N_DISTANCE])
    if (mask & 8) e.area = nn(num[no + N_AREA])
    if (mask & 16) e.protocol = sn(str[so + S_PROTOCOL])
    if (mask & 32) e.numObservers = nn(num[no + N_OBSERVERS])
    if (mask & 64) e.allObsReported = bool(num[no + N_ALL_OBS])
    if (mask & 128) e.checklistComments = sn(str[so + S_CHECKLIST_COMMENTS]) as string
    if (mask & 256) e.stateProvince = sn(str[so + S_STATE])
    out.push(e)
  }
  return out
}
