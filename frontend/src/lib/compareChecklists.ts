// Pure comparison of two eBird checklists' species lists (with counts), matched by
// eBird speciesCode. eBird returns each checklist's species in taxonomic order; that
// order is preserved (both/aOnly follow A's order, bOnly follows B's).

/** Photo / audio / video counts for a species on a checklist (0 if none). */
export interface MediaPresence {
  photo: number
  audio: number
  video: number
}

export interface ChecklistSpecies {
  speciesCode: string
  commonName: string
  count: string   // eBird "howManyStr": an integer string, or "X" for presence-only
  breedingCode: string   // raw eBird API breeding code (e.g. "S1"), or "" if none
  comments: string       // per-species note (HTML-entity encoded), or "" if none
  media: MediaPresence
}

/** Per-checklist effort/provenance metadata + the checklist-level note. */
export interface ChecklistMeta {
  locName: string
  obsDt: string
  protocolId: string
  durationHrs: number | null
  distanceKm: number | null
  distanceUnit: string
  numObservers: number | null
  submissionMethod: string
  submissionVersion: string
  comments: string       // checklist-level note (HTML-entity encoded), or "" if none
}

export interface ChecklistData extends ChecklistMeta {
  species: ChecklistSpecies[]
}

export interface ChecklistRow {
  speciesCode: string
  commonName: string
  countA: string | null   // null ⇒ not on list A
  countB: string | null   // null ⇒ not on list B
  breedingA: string | null   // raw API breeding code on A, or null
  breedingB: string | null
  mediaA: MediaPresence | null
  mediaB: MediaPresence | null
  commentsA: string   // per-species note on A ("" if none)
  commentsB: string
}

export interface ChecklistComparison {
  both: ChecklistRow[]
  aOnly: ChecklistRow[]
  bOnly: ChecklistRow[]
  totalA: number
  totalB: number
  metaA: ChecklistMeta   // location + date for checklist A, to tell the two apart
  metaB: ChecklistMeta
}

export function compareChecklists(a: ChecklistData, b: ChecklistData): ChecklistComparison {
  const aByCode = new Map(a.species.map(s => [s.speciesCode, s]))
  const bByCode = new Map(b.species.map(s => [s.speciesCode, s]))

  const both: ChecklistRow[] = []
  const aOnly: ChecklistRow[] = []
  for (const s of a.species) {
    const bs = bByCode.get(s.speciesCode)
    if (bs) {
      both.push({
        speciesCode: s.speciesCode, commonName: s.commonName,
        countA: s.count, countB: bs.count,
        breedingA: s.breedingCode || null, breedingB: bs.breedingCode || null,
        mediaA: s.media, mediaB: bs.media,
        commentsA: s.comments || '', commentsB: bs.comments || '',
      })
    } else {
      aOnly.push({
        speciesCode: s.speciesCode, commonName: s.commonName,
        countA: s.count, countB: null,
        breedingA: s.breedingCode || null, breedingB: null,
        mediaA: s.media, mediaB: null,
        commentsA: s.comments || '', commentsB: '',
      })
    }
  }

  const bOnly: ChecklistRow[] = []
  for (const s of b.species) {
    if (!aByCode.has(s.speciesCode)) {
      bOnly.push({
        speciesCode: s.speciesCode, commonName: s.commonName,
        countA: null, countB: s.count,
        breedingA: null, breedingB: s.breedingCode || null,
        mediaA: null, mediaB: s.media,
        commentsA: '', commentsB: s.comments || '',
      })
    }
  }

  return {
    both, aOnly, bOnly,
    totalA: a.species.length, totalB: b.species.length,
    metaA: toMeta(a),
    metaB: toMeta(b),
  }
}

/** Extract the per-checklist metadata (everything except the species list). */
function toMeta(d: ChecklistData): ChecklistMeta {
  const { species: _species, ...meta } = d
  return meta
}

/** Format an eBird obsDt ("2025-03-02 10:55" or "2025-03-02") into a friendly date.
 * Returns '' for empty/unparseable input. Parsed as local time (no TZ shift). */
export function formatObsDate(obsDt: string): string {
  if (!obsDt) return ''
  const m = obsDt.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/)
  if (!m) return obsDt
  const [, y, mo, d, hh, mm] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), hh ? Number(hh) : 0, mm ? Number(mm) : 0)
  if (Number.isNaN(date.getTime())) return obsDt
  const datePart = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  if (hh == null) return datePart
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${datePart}, ${timePart}`
}

/** eBird count string → number, or null for "X" / presence-only / non-numeric. */
export function parseCount(c: string | null): number | null {
  if (!c) return null
  const n = parseInt(c, 10)
  return Number.isNaN(n) ? null : n
}

/** Which side has the strictly-higher numeric count, for emphasis. Null when equal,
 * either side is presence-only ("X"), or not comparable. */
export function higherCount(countA: string | null, countB: string | null): 'a' | 'b' | null {
  const a = parseCount(countA)
  const b = parseCount(countB)
  if (a === null || b === null) return null
  if (a > b) return 'a'
  if (b > a) return 'b'
  return null
}
