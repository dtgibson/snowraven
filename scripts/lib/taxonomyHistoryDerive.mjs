// The pure core of the splits-and-lumps history generator
// (taxonomic-splits-lumps, schema.md section 4). No `process`, no `fs`, no app
// imports: `scripts/build-taxonomy-history.mjs` reads the files and writes the
// asset, and `frontend/src/lib/taxonomyHistoryGenerator.test.ts` drives this
// module over small in-memory fixtures. The invariant checker at the bottom is
// the SAME one the CI guard (`taxonomyHistoryAsset.test.ts`) runs over the
// committed asset, so the generator refuses to write anything CI would refuse.
//
// FAIL CLOSED. Every problem below throws a `HistoryInputError` naming the file
// or row; the caller writes nothing. Nothing here fetches, and nothing here
// reads an API key.
//
// HOW AN EVENT IS FOUND. The schema's derivation (section 4.2), with the
// refinements the real 2019 to 2025 files required, each stated where it is
// implemented. The result reproduces eBird's own announced tallies for every
// covered year (2019 and 2022 with one cited reorganization each counted as
// eBird counts it, ANNOUNCED_RECOUNTS), and the generator checks that
// (UPDATE_PUBLISHED below).
//
//   Splits. Each species row of the year's integrated eBird/Clements checklist
//   whose change cell carries the token `split` is a daughter. Its parent is the
//   previous year's eBird species it came from, resolved by independent means
//   in order of reliability:
//     R1  the eBird taxonomy's own link (added): the daughter's code in the
//         PREVIOUS taxonomy is that species itself (the nominate kept the code)
//         or a subspecies group whose REPORT_AS names the parent.
//     R2  the checklist's previous-sort link, climbed to that row's species
//         when it was a group or subspecies (the schema stopped at the group).
//     R3  the "text for website" sentence: a previous-year species named by
//         scientific name (by common name only when no binomial answers, as
//         across a genus move) that did not come through the year unchanged,
//         searched in the split's subject first ("X is split into ...").
//   R1 and R2 are structural and must agree whenever both answer; R3 is used
//   only when neither answers, and must then name exactly one species, after
//   two tie-breaks that only narrow (the daughter's own rows, then its own
//   sentence). A row also carrying `new species` is newly described, never a
//   daughter. A group eBird promoted to a species is a daughter of the species
//   it reported as even without the annotation. Daughters are grouped by
//   parent and each group is completed from the taxonomy: the parent itself
//   where eBird kept its code as a species, and a NEW species that now files
//   one of the parent's former groups. A group of one fails closed (FR-04),
//   except the two cases named where they are decided: a parent left alone by
//   a newly described sibling, and a lone unannotated promotion that carries
//   the parent's own scientific name on (a re-code).
//
//   Lumps. Each species row whose change cell carries `lump` is a survivor. Its
//   before side is its own previous identity (its code, the groups now filed
//   under it, its previous-sort row, its scientific name, and its split parent
//   when it is also a daughter), every previous-year species the taxonomy now
//   reports as the survivor or the checklist's rows now place under it, and
//   every previous-year species named in the sentence that is no longer a
//   species and is not placed under another survivor. Fewer than two fails
//   closed, and one that is the survivor's own previous identity is a rename. A previous-year species that the taxonomy reports as a
//   current species without any lump annotation is still a lump in eBird's
//   terms (its records now report as that species), so it forms or joins that
//   survivor's event.
//
// NAMES. A before-side entry carries the code, scientific name and common name
// the PREVIOUS year's taxonomy printed, because those are the names an export
// made before the update carries. An after-side or slash entry carries its
// CURRENT names from the bundled snapshot whenever its code is still current
// there, because a current export carries those; an entry whose code a later
// covered update retired keeps the names of its own year.

export class HistoryInputError extends Error {
  constructor(message) {
    super(message)
    this.name = 'HistoryInputError'
  }
}

const fail = (msg) => { throw new HistoryInputError(msg) }

// ── Published dates (OQ-02) ──────────────────────────────────────────────────
// The day eBird announced each update complete. The spreadsheets do not carry
// it, so it is a cited table; a covered year with no row, or a row marked
// `assumed`, is a fail-closed exit (verify the date, then change the mark).
// Sources: eBird's annual taxonomy update announcements
// (https://science.ebird.org/en/use-ebird-data/the-ebird-taxonomy and the
// ebird.org news post for each year), as measured in schema.md section 4.2.
//
// `announced` is eBird's own published tally for the update: species gained
// through splits and species lost through lumps. Where a row carries it, the
// generator derives the same two figures from its events (gained = the sum of
// each split's daughters minus one; lost = the sum of each lump's before side
// minus one) and FAILS CLOSED on any difference, so a resolver that misplaced a
// single daughter cannot ship. Figures as eBird announced them (gained /
// lost), each reproduced exactly by the committed asset (2023 to 2025 measured
// 2026-09-30; 2019, 2021 and 2022 on 2026-10-21, 2019 and 2022 with their
// recount):
//   2019: 106 / 20    2021: 94 / 8      2022: 118 / 41
//   2023: 124 / 16    2024: 141 / 16    2025: 40 / 18
// Sources: Cornell's "Overview August 2019" (2019: "Another 106 species are
// newly recognized ... due to 'splits', while there is a loss of 20 species
// due to 'lumps'"); eBird's "2021 eBird Taxonomy Update, COMPLETE", 8 Sep 2021
// (94 from splits, 8 lumps); eBird's "2022 Taxonomy Update" (118 gained
// through splits, 41 lost through lumps);
// https://ebird.org/news/2024-taxonomy-update (2024) and eBird's taxonomy
// update announcements for 2023 and 2025, linked from
// https://science.ebird.org/en/use-ebird-data/the-ebird-taxonomy. Each year's
// net (gained minus lost, plus its newly described species) also equals the
// change in its taxonomy file's species count, which the 2021 to 2025 figures
// reproduce exactly.
//
// REQUIRED FOR EVERY COVERED YEAR since big-old-life-lists: a covered year with
// no `announced` fails closed, because the tally is the independent check the
// rename rule in deriveYear rests on. The generator never fetches: the tallies
// above were read from the announcements by a person and typed here, with
// their sources, like the published dates.
// There is no 2020 row because eBird released no 2020 update
// (YEARS_WITHOUT_UPDATE): the 2021 update's previous update is 2019. If
// Cornell's download page ever lists a v2020 file, that is the reversal: add
// the row and take 2020 out of YEARS_WITHOUT_UPDATE.
export const UPDATE_PUBLISHED = Object.freeze({
  2013: { published: '2013-10-14', mark: 'measured' },
  2014: { published: '2014-08-01', mark: 'assumed' },
  2015: { published: '2015-08-01', mark: 'assumed' },
  2016: { published: '2016-08-01', mark: 'assumed' },
  2017: { published: '2017-08-18', mark: 'measured' },
  2018: { published: '2018-08-17', mark: 'measured' },
  2019: { published: '2019-08-21', mark: 'measured', announced: { gained: 106, lost: 20 } },
  2021: { published: '2021-09-08', mark: 'measured', announced: { gained: 94, lost: 8 } },
  2022: { published: '2022-11-01', mark: 'measured', announced: { gained: 118, lost: 41 } },
  2023: { published: '2023-10-24', mark: 'measured', announced: { gained: 124, lost: 16 } },
  2024: { published: '2024-10-22', mark: 'measured', announced: { gained: 141, lost: 16 } },
  2025: { published: '2025-10-31', mark: 'measured', announced: { gained: 40, lost: 18 } },
})

// ── Recounted reorganizations (cited) ────────────────────────────────────────
// eBird's announced tally counts these two reorganizations by their NET change
// (three species became two: one species lost, none gained), where the events
// they decompose into count a split's daughter and a lump's survivor
// separately (one gained, two lost). The events stay in the asset exactly as
// derived, because each is what happened to a user's records; only the tally
// they are compared with is recounted. A recount can only relabel within the
// events it names, and never changes the net: every named event must be
// derived exactly once, each of the recount's two figures must lie between
// zero and its events' own figure (gained and lost alike), and its net (gained
// minus lost) must equal its events' own. So a recount lowers the year's
// compared tally by the same amount on both sides, never by more than the
// smaller of its events' own two figures. Anything else still fails closed on
// the tally.
//
//   2019, the white-eyes. eBird's 2019 post ("2019 eBird Taxonomy Update",
//   ebird.org/news/2019-ebird-taxonomy-update, Wayback capture 20200107042928)
//   narrates "JAPANESE WHITE-EYE SPLIT and REORGANIZATION" as Mountain and
//   Japanese White-eye mixed and divided into Warbling and Swinhoe's, and its
//   "LUMPS and INVALID SPECIES" section itemizes exactly the announced 20
//   species lost, with Enggano White-eye among them and Mountain White-eye
//   not. The derived 2019 events tally 107 and 21 against the announced 106
//   and 20, the difference being exactly this reorganization.
//   2022, the hill mynas. The same shape, the only one in 2022: Tenggara Hill
//   Myna split from Common Hill Myna while Nias and Enggano Myna were lumped
//   into it. eBird's 2022 page (science.ebird.org .../2022-ebird-taxonomy-
//   update, Wayback capture 20231130041808) lists no Tenggara split among its
//   splits, and the derived events tally 119 and 42 against the announced 118
//   and 41. Attributed by that parallel, not by an itemized list: eBird's own
//   lumps list adds up to 42, so the announced 41 is not its sum (decisions.md
//   in pipeline/taxonomy-history-2019 records the alternatives considered).
// Codes within each side are sorted, matching how an event is compared.
export const ANNOUNCED_RECOUNTS = Object.freeze({
  2019: Object.freeze([Object.freeze({
    what: "Japanese, Mountain and Enggano White-eye reorganized as Warbling and Swinhoe's White-eye",
    events: Object.freeze([
      Object.freeze({ kind: 'split', before: ['jaweye'], after: ['swiwhe1', 'warwhe1'] }),
      Object.freeze({ kind: 'lump', before: ['jaweye', 'moweye2'], after: ['warwhe1'] }),
      Object.freeze({ kind: 'lump', before: ['enweye1', 'jaweye'], after: ['swiwhe1'] }),
    ]),
    counted: Object.freeze({ gained: 0, lost: 1 }),
  })]),
  2022: Object.freeze([Object.freeze({
    what: 'Common, Nias and Enggano Hill Myna reorganized as Common and Tenggara Hill Myna',
    events: Object.freeze([
      Object.freeze({ kind: 'split', before: ['hilmyn'], after: ['cohmyn2', 'hilmyn'] }),
      Object.freeze({ kind: 'lump', before: ['engmyn1', 'hilmyn', 'niamyn1'], after: ['hilmyn'] }),
    ]),
    counted: Object.freeze({ gained: 0, lost: 1 }),
  })]),
})

// ── Slashes eBird dropped (cited) ────────────────────────────────────────────
// A slash entry keeps its own year's name, and its code is normally held to
// the snapshot (checkHistory). These two slash codes are in no taxonomy file
// since 2023 and no later event carries them, so the checker admits them by
// code here and refuses any other slash code missing from the snapshot. Both are
// 2019 split slashes whose two species eBird lumped back together in 2023
// (asset events: Glossy-backed into Fork-tailed Drongo, Fanti into
// Velvet-mantled Drongo), after which the slash names nothing: each code is a
// `slash` row in the 2019, 2021 and 2022 eBird taxonomy files and absent from
// the 2023 file onward (scripts/taxonomy-history-input/ebird-taxonomy-vYYYY.csv).
// y01204 (2022's Northern/Southern Mouse-colored Tyrannulet) needs no entry:
// it is a species now, and the checker admits that only where a later event
// creates it (2024's Mouse-colored Tyrannulet lump).
export const SLASHES_DROPPED = Object.freeze({
  fotdro1: 'Fork-tailed/Glossy-backed Drongo (2019): its species lumped back in 2023, slash absent from the 2023 file onward',
  vemdro1: 'Fanti/Velvet-mantled Drongo (2019): its species lumped back in 2023, slash absent from the 2023 file onward',
})

/** An event's identity for a recount: its kind and each side's sorted codes. */
const eventKey = (kind, before, after) => `${kind}|${[...before].sort().join(',')}|${[...after].sort().join(',')}`

/**
 * The tally to compare with eBird's announcement: the events' own tally with
 * each cited reorganization (ANNOUNCED_RECOUNTS) replaced by eBird's count of
 * it. Throws when a named event is not derived exactly once, when a recount
 * would change the net, or when either of its figures lies below zero or above
 * its events' own. `label` names the year in a failure.
 */
export function recountedTally(events, recounts = [], label = '') {
  const got = tally(events)
  for (const rc of recounts) {
    const named = rc.events.map(n => {
      const key = eventKey(n.kind, n.before, n.after)
      const hits = events.filter(e => eventKey(e.kind, e.before.map(b => b.code), e.after.map(a => a.code)) === key)
      if (hits.length !== 1) fail(`${label}recount "${rc.what}" names ${n.kind} ${n.before.join('+')} -> ${n.after.join('+')}, which the events hold ${hits.length} times, not once`)
      return hits[0]
    })
    const own = tally(named)
    if (own.gained - own.lost !== rc.counted.gained - rc.counted.lost) {
      fail(`${label}recount "${rc.what}" changes the net: its events gain ${own.gained} and lose ${own.lost}, the recount ${rc.counted.gained} and ${rc.counted.lost}`)
    }
    if (rc.counted.gained < 0 || rc.counted.gained > own.gained || rc.counted.lost < 0 || rc.counted.lost > own.lost) {
      fail(`${label}recount "${rc.what}" counts ${rc.counted.gained} gained and ${rc.counted.lost} lost, outside its events' own ${own.gained} and ${own.lost}: a recount may only relabel within the events it names, so each figure lies from 0 to theirs`)
    }
    got.gained += rc.counted.gained - own.gained
    got.lost += rc.counted.lost - own.lost
  }
  return got
}

/** The two figures eBird announces for an update, derived from its events. */
export function tally(events) {
  let gained = 0
  let lost = 0
  for (const e of events) {
    if (e.kind === 'split') gained += e.after.length - 1
    else lost += e.before.length - 1
  }
  return { gained, lost }
}

/** eBird released no taxonomy update in these years. */
export const YEARS_WITHOUT_UPDATE = Object.freeze([2020])

/** The eBird update immediately before `year`. */
export function previousUpdate(year, withoutUpdate = YEARS_WITHOUT_UPDATE) {
  let p = year - 1
  while (withoutUpdate.includes(p)) p -= 1
  return p
}

// ── CSV (RFC 4180) ───────────────────────────────────────────────────────────

/** Quoted fields, doubled quotes, embedded newlines, CRLF or LF, leading BOM. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0
  let quoted = false
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        quoted = false; i += 1; continue
      }
      field += c; i += 1; continue
    }
    if (c === '"' && field === '') { quoted = true; i += 1; continue }
    if (c === ',') { row.push(field); field = ''; i += 1; continue }
    if (c === '\r' || c === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
      i += (c === '\r' && text[i + 1] === '\n') ? 2 : 1
      continue
    }
    field += c; i += 1
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(f => f.trim() !== ''))
}

const norm = (h) => h.trim().toLowerCase()
const lower = (s) => s.trim().toLowerCase()
/** Apostrophes normalized for JOIN KEYS only; emitted names are never touched. */
const joinKey = (s) => lower(s).replace(/\u2019/g, "'")

function columnIndex(header, file, test, label) {
  const idx = header.findIndex(h => test(norm(h)))
  if (idx < 0) fail(`${file}: missing required column ${label} (its header row has: ${header.map(h => JSON.stringify(h.trim())).join(', ')})`)
  return idx
}

function checkNoReplacementChar(value, file, what) {
  if (value.includes('\ufffd')) fail(`${file}: U+FFFD in ${what} "${value}" (a non-UTF-8 file read as UTF-8)`)
}

// ── Input files ──────────────────────────────────────────────────────────────

export const INTEGRATED_NAME_RE = /^clements-integrated-v(\d{4})\.csv$/
export const TAXONOMY_NAME_RE = /^ebird-taxonomy-v(\d{4})\.csv$/

/** Parse an eBird taxonomy CSV (Cornell's layout or the API's). */
export function readTaxonomy(file, text) {
  const rows = parseCsv(text)
  if (rows.length < 2) fail(`${file}: no data rows`)
  const header = rows[0]
  const iCode = columnIndex(header, file, h => h === 'species_code', 'SPECIES_CODE')
  const iCat = columnIndex(header, file, h => h === 'category', 'CATEGORY')
  const iCom = columnIndex(header, file, h => h === 'primary_com_name' || h === 'common_name', 'PRIMARY_COM_NAME')
  const iSci = columnIndex(header, file, h => h === 'sci_name' || h === 'scientific_name', 'SCI_NAME')
  const iRa = columnIndex(header, file, h => h === 'report_as', 'REPORT_AS')
  const byCode = new Map()
  const speciesBySci = new Map()
  for (const r of rows.slice(1)) {
    const e = {
      code: (r[iCode] ?? '').trim(),
      category: (r[iCat] ?? '').trim(),
      com: (r[iCom] ?? '').trim(),
      sci: (r[iSci] ?? '').trim(),
      reportAs: (r[iRa] ?? '').trim(),
    }
    if (!e.code) fail(`${file}: a row with no SPECIES_CODE`)
    checkNoReplacementChar(e.com, file, 'common name')
    checkNoReplacementChar(e.sci, file, 'scientific name')
    if (byCode.has(e.code)) fail(`${file}: duplicate species code ${e.code}`)
    byCode.set(e.code, e)
    if (e.category === 'species') {
      const k = joinKey(e.sci)
      if (speciesBySci.has(k)) fail(`${file}: duplicate species scientific name "${e.sci}"`)
      speciesBySci.set(k, e)
    }
  }
  return { file, byCode, speciesBySci }
}

const INFRASPECIFIC = /^(group|subspecies|form|intergrade|domestic|issf)/

/** Parse an integrated eBird/Clements checklist CSV for year `year`. */
export function readIntegrated(file, text, year) {
  const rows = parseCsv(text)
  if (rows.length < 2) fail(`${file}: no data rows`)
  // Cornell has written these headers with spaces ("sort v2023") and with
  // underscores ("sort_v2023"); both are read as spaces, here only (the
  // taxonomy file's SPECIES_CODE-style names keep their underscores).
  const header = rows[0].map(h => h.replace(/_/g, ' '))
  const iCat = columnIndex(header, file, h => h === 'category', 'category')
  const iEng = columnIndex(header, file, h => h === 'english name', 'English name')
  const iSci = columnIndex(header, file, h => h === 'scientific name', 'scientific name')
  const sorts = []
  header.forEach((h, i) => {
    const m = /^sort[ _]v?(\d{4})$/.exec(norm(h))
    if (m) sorts.push({ i, year: Number(m[1]) })
  })
  const own = sorts.find(s => s.year === year)
  if (!own) fail(`${file}: missing required column sort v${year} (its header row has: ${rows[0].map(h => JSON.stringify(h.trim())).join(', ')})`)
  const prev = sorts.find(s => s.year !== year) ?? null
  const iChange = header.findIndex(h => /^clements v\d{4}[a-z]? change$/.test(norm(h)))
  const iText = header.findIndex(h => /^text for website v\d{4}[a-z]?$/.test(norm(h)))

  const out = []
  for (const r of rows.slice(1)) {
    const category = (r[iCat] ?? '').trim()
    const sortRaw = (r[own.i] ?? '').trim()
    if (!category && !sortRaw) continue
    const sort = sortRaw === '' ? null : Number(sortRaw)
    if (sort !== null && !Number.isFinite(sort)) fail(`${file}: unreadable sort value "${sortRaw}"`)
    const prevRaw = prev ? (r[prev.i] ?? '').trim() : ''
    // Cornell's v2025 CSV carries "####" (a spreadsheet's too-narrow-column
    // display) in 35 previous-sort cells. That is an absent link, never a
    // guessed one: the row simply has no R2 evidence and its other resolvers
    // decide. Any other unreadable value still fails closed below.
    const prevSort = prevRaw === '' || /^#+$/.test(prevRaw) ? null : Number(prevRaw)
    if (prevSort !== null && !Number.isFinite(prevSort)) fail(`${file}: unreadable previous sort value "${prevRaw}"`)
    const english = (r[iEng] ?? '').trim()
    const sci = (r[iSci] ?? '').trim()
    checkNoReplacementChar(english, file, 'English name')
    checkNoReplacementChar(sci, file, 'scientific name')
    out.push({
      category, english, sci, sort, prevSort,
      change: iChange >= 0 ? (r[iChange] ?? '').trim() : '',
      text: iText >= 0 ? (r[iText] ?? '').trim() : '',
    })
  }
  return {
    file, year, rows: out,
    hasChangeColumns: iChange >= 0 && iText >= 0 && prev !== null,
    // What a year needs to be COVERED by this file, named for the failure that
    // explains why a supplied file was not used.
    missingForCoverage: [
      iChange < 0 ? `Clements v${year} change` : null,
      iText < 0 ? `text for website v${year}` : null,
      prev === null ? `the previous update's sort column (sort vYYYY)` : null,
    ].filter(Boolean),
  }
}

/** The change cell's tokens: "split; range" -> ["split", "range"]. A token must
 *  BE the word: "family split" is a family-level move, not a species split. */
export function changeTokens(cell) {
  return cell.split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean)
}

/**
 * The subject of a split sentence: the words before "is/are split into" in
 * that sentence, or after "split from" to the end of that sentence; null when
 * the text has neither shape. A sentence boundary is a full stop followed by
 * whitespace and a capital, so an abbreviated genus ("P. fulvotincta") or
 * "s.l." never ends one.
 */
export function splitSubject(text) {
  const into = /\b(?:is|are) split into\b/.exec(text)
  if (into) {
    const head = text.slice(0, into.index)
    let start = 0
    const re = /\.\s+(?=[A-Z])/g
    let m
    while ((m = re.exec(head)) !== null) start = m.index + m[0].length
    return head.slice(start)
  }
  const from = /\bsplit from\b/i.exec(text)
  if (from) {
    const tail = text.slice(from.index + from[0].length)
    const end = /\.\s+(?=[A-Z])/.exec(tail)
    return end ? tail.slice(0, end.index) : tail
  }
  return null
}

/**
 * The first sentence of `text` that names `sci` (a "Genus epithet" binomial,
 * matched case-insensitively and word-bounded), or null. Sentences end where
 * splitSubject's do: a full stop, whitespace, then a capital.
 */
export function sentenceNaming(text, sci) {
  const want = sci.trim().toLowerCase()
  if (want === '') return null
  const re = /\.\s+(?=[A-Z])/g
  let start = 0
  let m
  while ((m = re.exec(text)) !== null) {
    const sentence = text.slice(start, m.index + 1)
    if (binomials(sentence).has(want)) return sentence
    start = m.index + m[0].length
  }
  const last = text.slice(start)
  return binomials(last).has(want) ? last : null
}

/** Every "Genus epithet" binomial in a sentence, lowercased. Word-bounded. */
export function binomials(text) {
  const out = new Set()
  const re = /(?<![A-Za-z])([A-Z][a-z]+) ([a-z]+(?:-[a-z]+)?)(?![a-z])/g
  let m
  while ((m = re.exec(text)) !== null) out.add(`${m[1]} ${m[2]}`.toLowerCase())
  return out
}

// ── The derivation ───────────────────────────────────────────────────────────

/**
 * @param {{
 *   files: { name: string, text: string }[],
 *   snapshot: { version: string, byCode: Record<string,string>, byCom: Record<string,string>, bySci: Record<string,string> },
 *   generated: string,
 *   published?: Record<number, { published: string, mark: string }>,
 *   withoutUpdate?: readonly number[],
 * }} input
 * @returns {{ history: object }}
 */
export function deriveHistory(input) {
  const published = input.published ?? UPDATE_PUBLISHED
  const withoutUpdate = input.withoutUpdate ?? YEARS_WITHOUT_UPDATE
  const recountsFor = input.recounts ?? ANNOUNCED_RECOUNTS
  const snapshot = input.snapshot

  // File names are the provenance; anything else is refused.
  const integrated = new Map()
  const taxonomy = new Map()
  for (const f of input.files) {
    let m
    if ((m = INTEGRATED_NAME_RE.exec(f.name))) {
      const y = Number(m[1])
      integrated.set(y, readIntegrated(f.name, f.text, y))
    } else if ((m = TAXONOMY_NAME_RE.exec(f.name))) {
      taxonomy.set(Number(m[1]), readTaxonomy(f.name, f.text))
    } else {
      fail(`unrecognised input file name "${f.name}" (expected clements-integrated-vYYYY.csv or ebird-taxonomy-vYYYY.csv)`)
    }
  }

  // Covered years: an integrated file with change columns whose own taxonomy
  // and previous year's taxonomy and integrated file are all present.
  const covered = [...integrated.keys()].sort((a, b) => a - b).filter(y => {
    const p = previousUpdate(y, withoutUpdate)
    return integrated.get(y).hasChangeColumns && taxonomy.has(y) && taxonomy.has(p) && integrated.has(p)
  })
  for (let i = 1; i < covered.length; i += 1) {
    if (previousUpdate(covered[i], withoutUpdate) !== covered[i - 1]) {
      fail(`covered years are not consecutive eBird updates: ${covered[i - 1]} then ${covered[i]} (supply the inputs for the updates between, or remove the older year)`)
    }
  }
  const used = new Set()
  for (const y of covered) {
    const p = previousUpdate(y, withoutUpdate)
    used.add(`clements-integrated-v${y}.csv`).add(`clements-integrated-v${p}.csv`)
    used.add(`ebird-taxonomy-v${y}.csv`).add(`ebird-taxonomy-v${p}.csv`)
  }
  // Why a year with an integrated file is not covered, by name, so a refused
  // input says exactly which file or column would make it count.
  const whyNotCovered = (y) => {
    const p = previousUpdate(y, withoutUpdate)
    const reasons = []
    const int = integrated.get(y)
    if (int && int.missingForCoverage.length > 0) reasons.push(`${int.file} has no ${int.missingForCoverage.join(', no ')} column`)
    if (!taxonomy.has(y)) reasons.push(`ebird-taxonomy-v${y}.csv is missing`)
    if (!taxonomy.has(p)) reasons.push(`ebird-taxonomy-v${p}.csv (the ${p} update before it) is missing`)
    if (!integrated.has(p)) reasons.push(`clements-integrated-v${p}.csv (the ${p} update before it) is missing`)
    return reasons
  }
  const uncovered = [...integrated.keys()].sort((a, b) => a - b).filter(y => !covered.includes(y))
    .map(y => ({ y, why: whyNotCovered(y) })).filter(u => u.why.length > 0)
  for (const f of input.files) {
    if (used.has(f.name)) continue
    const why = uncovered.map(u => `${u.y} is not covered because ${u.why.join('; ')}`).join('. ')
    fail(`input ${f.name} is not needed by any covered year (remove it, or supply the files that would make its year covered${why ? `: ${why}` : ''})`)
  }

  // Snapshot views: current species by code, and current sci by code.
  const snapSpecies = new Set(Object.values(snapshot.byCom))
  const snapSciByCode = new Map()
  for (const [sci, code] of Object.entries(snapshot.bySci)) snapSciByCode.set(code, sci)

  const updates = []
  const events = []
  for (const year of covered) {
    const rec = published[year]
    if (!rec) fail(`no published date for the ${year} update in UPDATE_PUBLISHED`)
    if (rec.mark !== 'measured') fail(`the published date for ${year} is marked "${rec.mark}"; verify it and mark it measured before this year can ship`)
    // eBird's announced tally is REQUIRED for every covered year (big-old-life-
    // lists): it is the independent check that a resolver misplaced nothing,
    // and the rename rule in deriveYear leans on it.
    if (!rec.announced) {
      fail(`no announced tally for the ${year} update in UPDATE_PUBLISHED: add announced: { gained, lost } (species eBird gained through splits and lost through lumps that year, from its announcement) before this year can ship`)
    }
    const diag = { excluded: [], notSplits: [], vocabulary: null }
    const yearEvents = deriveYear(year, previousUpdate(year, withoutUpdate), {
      intY: integrated.get(year), intP: integrated.get(previousUpdate(year, withoutUpdate)),
      taxY: taxonomy.get(year), taxP: taxonomy.get(previousUpdate(year, withoutUpdate)),
      published: rec.published,
      diag,
    })
    const notes = [
      diag.excluded.length ? `excluded as renames, not lumps: ${diag.excluded.join('; ')}` : null,
      diag.notSplits.length ? `not splits: ${diag.notSplits.join('; ')}` : null,
      diag.vocabulary,
    ].filter(Boolean)
    const note = notes.length ? ` (${notes.join('. ')})` : ''
    const recounts = recountsFor[year] ?? []
    const got = recountedTally(yearEvents, recounts, `the ${year} update: `)
    if (got.gained !== rec.announced.gained || got.lost !== rec.announced.lost) {
      const how = recounts.length ? `, with ${recounts.length} reorganization${recounts.length === 1 ? '' : 's'} recounted as eBird counts ${recounts.length === 1 ? 'it' : 'them'},` : ''
      fail(`the ${year} events tally${how} ${got.gained} gained through splits and ${got.lost} lost through lumps, but eBird announced ${rec.announced.gained} and ${rec.announced.lost}${note}`)
    }
    if (yearEvents.length === 0) fail(`the ${year} update produced no events; remove its inputs rather than claim coverage${note}`)
    updates.push({ year, published: rec.published })
    events.push(...yearEvents)
  }

  // Names: after/slash entries carry current names wherever the code is still
  // current in the snapshot; before entries carry the previous year's names.
  for (const ev of events) {
    for (const e of ev.after) {
      if (!snapSpecies.has(e.code)) continue
      e.com = snapshot.byCode[e.code]
      const sci = snapSciByCode.get(e.code)
      if (sci !== undefined && sci !== e.sci.toLowerCase()) e.sci = capitalizeGenus(sci)
    }
    for (const e of ev.slashes) {
      const now = Object.hasOwn(snapshot.byCode, e.code) ? snapshot.byCode[e.code] : undefined
      if (now !== undefined && !snapSpecies.has(e.code) && now.includes('/')) e.com = now
    }
    for (const b of ev.before) b.retired = !Object.hasOwn(snapshot.byCom, b.com.toLowerCase())
  }

  events.sort((a, b) =>
    a.published < b.published ? -1 : a.published > b.published ? 1
      : a.before[0].sci < b.before[0].sci ? -1 : a.before[0].sci > b.before[0].sci ? 1 : 0)

  const history = {
    v: 1,
    snapshot: snapshot.version,
    generated: input.generated,
    inputs: [...used].sort(),
    updates,
    coverage: updates.length === 0 ? null : { earliest: updates[0], latest: updates[updates.length - 1] },
    events,
  }
  checkHistory(history, snapshot)
  return { history }
}

/** The snapshot stores lowercase scientific names; restore the genus capital. */
function capitalizeGenus(sci) {
  return sci.charAt(0).toUpperCase() + sci.slice(1)
}

function entryOf(t) {
  return { code: t.code, sci: t.sci, com: t.com }
}

function deriveYear(year, prevYear, { intY, intP, taxY, taxP, published, diag = { excluded: [], notSplits: [], vocabulary: null } }) {
  const excluded = diag.excluded
  const notSplits = diag.notSplits
  const label = `${intY.file}`
  const speciesY = (sci) => taxY.speciesBySci.get(joinKey(sci))
  const speciesP = (sci) => taxP.speciesBySci.get(joinKey(sci))
  const isSpeciesY = (code) => taxY.byCode.get(code)?.category === 'species'
  const isSpeciesP = (code) => taxP.byCode.get(code)?.category === 'species'

  // The previous checklist indexed by its own sort value, and each of its rows'
  // species (the nearest preceding species row in checklist order).
  const prevBySort = new Map()
  const prevSpeciesOf = new Map()
  let lastSpecies = null
  for (const r of intP.rows) {
    if (r.category === 'species') lastSpecies = r
    if (r.sort !== null) prevBySort.set(r.sort, r)
    prevSpeciesOf.set(r, r.category === 'species' ? r : (INFRASPECIFIC.test(r.category) ? lastSpecies : null))
  }

  // Where each previous-year species' rows went: every row of this year's
  // checklist whose previous-sort link lands on a row of previous species P is
  // filed under the current species it now sits under (the species row itself,
  // or the nearest species row above a group or subspecies). The 2019
  // white-eyes need it: one sentence, shared by Warbling and Swinhoe's
  // White-eye, names both Mountain and Enggano White-eye, while the rows say
  // where each went (Mountain's subspecies now sit under Warbling, Enggano's
  // species row under Swinhoe's). Rows that join no taxonomy species are
  // skipped here, never failed: this is evidence for the lump rule below, and
  // joinY still fails closed on any daughter or survivor row.
  const rowsWentTo = new Map() // previous species code -> Set of current species codes
  let lastYSpecies = null
  for (const r of intY.rows) {
    if (r.category === 'species') lastYSpecies = speciesY(r.sci) ?? null
    const now = r.category === 'species' ? lastYSpecies : (INFRASPECIFIC.test(r.category) ? lastYSpecies : null)
    if (!now || r.prevSort === null) continue
    const pr = prevBySort.get(r.prevSort)
    const sp = pr ? prevSpeciesOf.get(pr) : null
    const tp = sp ? speciesP(sp.sci) : null
    if (!tp) continue
    if (!rowsWentTo.has(tp.code)) rowsWentTo.set(tp.code, new Set())
    rowsWentTo.get(tp.code).add(now.code)
  }

  const species = intY.rows.filter(r => r.category === 'species')
  const daughterRows = species.filter(r => changeTokens(r.change).includes('split'))
  const survivorRows = species.filter(r => changeTokens(r.change).includes('lump'))
  if (daughterRows.length === 0 && survivorRows.length === 0) {
    // Not one species row carries the token, which in a real update means the
    // year's change cells use another vocabulary, not that nothing happened.
    // Reported with the tally or no-events failure this almost always causes.
    const seen = [...new Set(species.map(r => r.change).filter(Boolean))].slice(0, 12)
    diag.vocabulary = `no species row of ${label} carries the change token "split" or "lump"; its change cells include ${seen.length ? seen.map(v => JSON.stringify(v)).join(', ') : 'nothing at all'}`
  }

  const joinY = (r) => speciesY(r.sci) ?? fail(`${label}: species row "${r.english}" (${r.sci}) joins no ${year} taxonomy species`)

  // Codes that changed this year (daughters and survivors): a species named in
  // a sentence under one of these codes is NOT "unchanged", even where eBird
  // kept its code (the kept-code nominate of a split).
  const changed = new Set([...daughterRows, ...survivorRows].map(r => joinY(r).code))
  const unchanged = (tp) => isSpeciesY(tp.code) && !changed.has(tp.code)

  // R2: the previous-sort link, climbed to its species.
  const viaSort = (r) => {
    if (r.prevSort === null) return null
    const pr = prevBySort.get(r.prevSort)
    if (!pr) return null
    const sp = prevSpeciesOf.get(pr)
    if (!sp) return null
    const tp = speciesP(sp.sci)
    if (!tp) fail(`${intP.file}: species row "${sp.english}" (${sp.sci}) joins no ${prevYear} taxonomy species`)
    return tp.code
  }

  // R1: the eBird taxonomy's own link for a current species' code: the code
  // was that species itself, or a group whose REPORT_AS names it.
  const viaTaxonomy = (code) => {
    const tp = taxP.byCode.get(code)
    if (!tp) return null
    if (tp.category === 'species') return tp.code
    if (tp.reportAs && isSpeciesP(tp.reportAs)) return tp.reportAs
    return null
  }

  // R3: previous-year species named in the sentence, by scientific name, then,
  // only when no binomial answers (a genus move renames every binomial), by
  // common name. A species that came through the year unchanged is skipped.
  // The search is scoped to the split's SUBJECT where the sentence has one
  // ("<parent> is split into ...", "... split from <parent>"), because a long
  // sentence goes on to name other species a subspecies moved to; the whole
  // text is searched only when the subject names nobody.
  const sentenceParents = (text) => {
    const scoped = splitSubject(text)
    if (scoped !== null) {
      const inSubject = namedParents(scoped)
      if (inSubject.length > 0) return inSubject
    }
    return namedParents(text)
  }
  const namedParents = (text) => {
    const bySci = [...binomials(text)].map(speciesP).filter(Boolean).filter(t => !unchanged(t))
    if (bySci.length > 0) return [...new Set(bySci.map(t => t.code))]
    const t = text.toLowerCase()
    const out = new Set()
    for (const sp of taxP.speciesBySci.values()) {
      if (unchanged(sp)) continue
      const name = sp.com.toLowerCase()
      let at = t.indexOf(name)
      while (at >= 0) {
        const pre = at === 0 ? '' : t[at - 1]
        const post = t[at + name.length] ?? ''
        if (!/[a-z'-]/.test(pre) && !/[a-z'-]/.test(post)) { out.add(sp.code); break }
        at = t.indexOf(name, at + 1)
      }
    }
    return [...out]
  }

  // ── Splits ──
  // NEWLY DESCRIBED, NOT GAINED BY A SPLIT (2021). eBird announces newly
  // described species apart from species gained through splits, and a row
  // carrying the token `new species` is one of them even when it also carries
  // `split`: 2021's Oxapampa Antpitta ("split; new species"), described from
  // Chestnut Antpitta, is one of the 17 newly described species eBird
  // announced, and 2021 has exactly 17 `new species` rows (2022: 5 and 5). So
  // such a row is not a daughter. Its sentence's candidates are kept, so a
  // split it leaves holding only its own parent is recognized below as no
  // split at all rather than as a missed daughter.
  const describedFrom = new Set() // parent candidates of newly described rows
  for (const r of daughterRows) {
    if (!changeTokens(r.change).includes('new species')) continue
    for (const c of sentenceParents(r.text)) describedFrom.add(c)
  }
  const parentOf = new Map() // daughter code -> parent code
  for (const r of daughterRows) {
    if (changeTokens(r.change).includes('new species')) continue
    const d = joinY(r)
    const r1 = viaTaxonomy(d.code)
    const r2 = viaSort(r)
    if (r1 !== null && r2 !== null && r1 !== r2) {
      fail(`${label}: split daughter "${r.english}" has conflicting parents: the ${prevYear} taxonomy says ${r1}, the previous-sort link says ${r2}`)
    }
    let parent = r1 ?? r2
    if (parent === null) {
      let cands = sentenceParents(r.text)
      // Two tie-breaks, never a new answer (2021). Each only narrows a text
      // that names more than one candidate, a case that would otherwise fail
      // closed, so no daughter that resolves without them can move.
      //   Rows first, because they are structural: keep the candidates whose
      //   rows now sit under this daughter (Striped Prinia: its subspecies
      //   catharia, parumstriata and striata were Striated Prinia's, though
      //   every sentence names Brown Prinia too).
      //   Then the daughter's own sentence: the first sentence naming this
      //   daughter by its scientific name, if it names exactly ONE candidate
      //   (Equatorial Antpitta: a preamble shared by every daughter of the
      //   Rufous/Chestnut Antpitta group names both, while "Rufous Antpitta
      //   (Rufous) Grallaria rufula rufula now is recognized as three
      //   monotypic species: ... Equatorial Antpitta Grallaria saturata ..."
      //   names one).
      if (cands.length > 1) {
        const narrowed = cands.filter(c => rowsWentTo.get(c)?.has(d.code))
        if (narrowed.length === 1) cands = narrowed
      }
      if (cands.length > 1) {
        const own = sentenceNaming(r.text, r.sci)
        if (own !== null) {
          const named = new Set(namedParents(own))
          const narrowed = cands.filter(c => named.has(c))
          if (narrowed.length === 1) cands = narrowed
        }
      }
      if (cands.length !== 1) {
        fail(`${label}: split daughter "${r.english}" (${d.code}) has ${cands.length === 0 ? 'no' : cands.length} parent candidates${cands.length ? ` (${cands.join(', ')})` : ''} in its sentence, and no taxonomy or previous-sort link`)
      }
      parent = cands[0]
    }
    parentOf.set(d.code, parent)
  }
  // A subspecies group eBird promoted to a species is a split daughter of the
  // species it reported as, whether or not the checklist annotates the row.
  const promotedOnly = new Set() // daughters found only by this rule
  for (const t of taxY.byCode.values()) {
    if (t.category !== 'species' || parentOf.has(t.code)) continue
    const tp = taxP.byCode.get(t.code)
    if (tp && tp.category !== 'species' && tp.reportAs && isSpeciesP(tp.reportAs)) {
      parentOf.set(t.code, tp.reportAs)
      promotedOnly.add(t.code)
    }
  }

  // Group by parent. Where eBird kept the parent's code as a species, that
  // species is a daughter too (the nominate). And a NEW species that now files
  // one of the parent's former groups was formed partly from the parent, so it
  // is a daughter as well, even when it is ALSO a lump's survivor: "Large
  // Cuckooshrike is split into Indian, Malayan and, with lump of Javan,
  // Oriental Cuckooshrike" is a three-way split plus a lump, which is exactly
  // how eBird counts it (2024: 141 gained by splits, 16 lost to lumps). A
  // species that already existed and merely received a group is a subspecies
  // transfer, which is out of scope, so it is not added.
  const byParent = new Map()
  for (const [d, p] of parentOf) {
    if (!byParent.has(p)) byParent.set(p, new Set())
    byParent.get(p).add(d)
  }
  for (const [p, set] of byParent) if (isSpeciesY(p)) set.add(p)
  for (const t of taxY.byCode.values()) {
    if (t.category === 'species' || !t.reportAs || !isSpeciesY(t.reportAs) || isSpeciesP(t.reportAs)) continue
    const from = viaTaxonomy(t.code)
    if (from !== null && byParent.has(from) && from !== t.reportAs) byParent.get(from).add(t.reportAs)
  }

  const events = []
  const splitParents = new Set()
  for (const [p, set] of byParent) {
    const parent = taxP.byCode.get(p)
    if (set.size < 2) {
      const [only] = set
      // Not a split: the parent kept its code and its only other daughter was
      // set aside above as newly described (2021, Chestnut Antpitta and
      // Oxapampa Antpitta). eBird gained no species through a split here.
      if (only === p && describedFrom.has(p)) {
        notSplits.push(`"${parent.com}" (${p}), whose other daughter is newly described`)
        continue
      }
      // A RE-CODE, NOT A SPLIT (2022, Brace's Emerald). One species before and
      // one after, the after found only by the promotion rule (no row carries
      // \`split\`), with the parent gone and its scientific name carried on:
      // eBird deleted a group and moved the species onto its remaining group's
      // code (braeme1 to braeme2). Like the rename rule for lumps below, this
      // is never a silent guess: the year's announced tally is required, so a
      // real split hidden here leaves "gained" short and fails closed.
      const now = only === undefined ? undefined : taxY.byCode.get(only)
      if (now && only !== p && promotedOnly.has(only) && !isSpeciesY(p) && joinKey(now.sci) === joinKey(parent.sci)) {
        notSplits.push(`"${parent.com}" (${p}) re-coded as ${only}`)
        continue
      }
      fail(`${label}: split of "${parent.com}" (${p}) has ${set.size} daughter species (${[...set].join(', ')}); a split needs two or more`)
    }
    splitParents.add(p)
    // Daughters in taxonomy order (the taxonomy file's row order).
    const after = [...taxY.byCode.values()].filter(t => t.category === 'species' && set.has(t.code)).map(entryOf)
    // Slash taxa the split created (schema.md 4.2).
    const genus = new Set(after.map(a => a.sci.split(' ')[0]))
    const epithets = new Set(after.map(a => a.sci.split(' ')[1]))
    const slashes = []
    if (genus.size === 1) {
      const g = [...genus][0]
      for (const t of taxY.byCode.values()) {
        if (t.category !== 'slash') continue
        const m = /^(\S+) (\S+(?:\/\S+)+)$/.exec(t.sci)
        if (!m || m[1] !== g) continue
        const eps = m[2].split('/')
        if (!eps.every(e => epithets.has(e))) continue
        const prevT = taxP.byCode.get(t.code)
        if (prevT && t.code !== p) continue
        slashes.push(entryOf(t))
      }
    }
    events.push({
      kind: 'split', year, published,
      before: [{ ...entryOf(parent), retired: false }],
      after, slashes,
    })
  }

  // ── Lumps ──
  // Every previous-year species the taxonomy now reports as a current species.
  const lumpedInto = new Map() // survivor code -> Set of before codes
  const addLump = (survivor, code) => {
    if (!lumpedInto.has(survivor)) lumpedInto.set(survivor, new Set())
    lumpedInto.get(survivor).add(code)
  }
  for (const t of taxP.byCode.values()) {
    if (t.category !== 'species' || isSpeciesY(t.code) || splitParents.has(t.code)) continue
    const now = taxY.byCode.get(t.code)
    if (now && now.category !== 'species' && now.reportAs && isSpeciesY(now.reportAs)) addLump(now.reportAs, t.code)
  }
  // The survivor's own previous identity, by every structural link: its code
  // (the species itself, or the group it was), the codes of the groups the
  // taxonomy now files under it (each group's previous species), its
  // previous-sort row, and its scientific name. More than one answer is real:
  // a new survivor can be one species plus another's former group.
  const groupsUnder = new Map() // current species code -> codes reporting as it
  for (const t of taxY.byCode.values()) {
    if (t.category === 'species' || !t.reportAs) continue
    if (!groupsUnder.has(t.reportAs)) groupsUnder.set(t.reportAs, [])
    groupsUnder.get(t.reportAs).push(t.code)
  }
  const previousIdentity = (s, row) => {
    const out = new Set()
    const r1 = viaTaxonomy(s.code)
    if (r1 !== null) out.add(r1)
    for (const g of groupsUnder.get(s.code) ?? []) {
      const prev = viaTaxonomy(g)
      if (prev !== null) out.add(prev)
    }
    const r2 = row ? viaSort(row) : null
    if (r2 !== null) out.add(r2)
    const bySci = speciesP(s.sci)
    if (bySci) out.add(bySci.code)
    // A survivor that is also a split daughter was formed partly from its
    // split parent, so the parent is part of its previous identity: "Large
    // Cuckooshrike is split into Indian, Malayan and, with lump of Javan,
    // Oriental Cuckooshrike" (2024) puts Large and Javan on Oriental's before
    // side. The 2024 asset already had Large there through the previous-sort
    // link; Swinhoe's White-eye (2019) has no such link, so without this its
    // lump of Enggano White-eye would hold one species and fail closed.
    const parent = parentOf.get(s.code)
    if (parent !== undefined && splitParents.has(parent)) out.add(parent)
    return out
  }
  // A previous-year species the checklist's rows (or the taxonomy's REPORT_AS)
  // place under some OTHER current species is not this survivor's to take,
  // however its sentence names it. With no structural placement at all, the
  // sentence decides, as before.
  const placedElsewhere = (code, survivor) => {
    const went = new Set(rowsWentTo.get(code) ?? [])
    const now = taxY.byCode.get(code)
    if (now && now.category !== 'species' && now.reportAs && isSpeciesY(now.reportAs)) went.add(now.reportAs)
    return went.size > 0 && !went.has(survivor)
  }
  const annotated = new Set()
  for (const r of survivorRows) {
    const s = joinY(r)
    annotated.add(s.code)
    for (const own of previousIdentity(s, r)) addLump(s.code, own)
    // Every previous-year species, no longer a species and not a split
    // parent, whose rows now sit under this survivor: the checklist's own
    // placement, for a sentence that names the lumped species by common name
    // only ("Pale-billed Firefinch is lumped into African Firefinch", 2022,
    // where Pale-billed's row is now subspecies landanae of African).
    for (const [code, went] of rowsWentTo) {
      if (went.has(s.code) && isSpeciesP(code) && !isSpeciesY(code) && !splitParents.has(code)) addLump(s.code, code)
    }
    for (const b of binomials(r.text)) {
      const t = speciesP(b)
      if (t && !isSpeciesY(t.code) && !splitParents.has(t.code) && !placedElsewhere(t.code, s.code)) addLump(s.code, t.code)
    }
  }
  for (const [s, set] of lumpedInto) {
    if (!annotated.has(s)) {
      // An unannotated lump: add the survivor's own previous identity.
      for (const own of previousIdentity(taxY.byCode.get(s), null)) set.add(own)
    }
    // A RENAME, NOT A LUMP (big-old-life-lists). A candidate whose whole before
    // side is ONE species that is the survivor's own previous identity lost no
    // species: eBird re-coded or renamed it, or moved a subspecies into it
    // under a "lump" annotation. Renames are excluded like every other
    // non-split, non-lump change. This is never a silent guess: the year's
    // announced tally is required, so a real lump excluded here leaves the
    // derived "lost" short and the run fails closed, naming it.
    if (set.size === 1) {
      const [only] = set
      const ownRow = survivorRows.find(r => joinY(r).code === s) ?? null
      if (previousIdentity(taxY.byCode.get(s), ownRow).has(only)) {
        excluded.push(`"${taxY.byCode.get(s).com}" (${s}) from ${only}`)
        continue
      }
    }
    if (set.size < 2) {
      fail(`${label}: lump into "${taxY.byCode.get(s).com}" (${s}) has ${set.size} before-side species (${[...set].join(', ')}); a lump needs two or more`)
    }
    const before = [...taxP.byCode.values()].filter(t => t.category === 'species' && set.has(t.code))
      .map(t => ({ ...entryOf(t), retired: false }))
    events.push({
      kind: 'lump', year, published,
      before, after: [entryOf(taxY.byCode.get(s))], slashes: [],
    })
  }
  return events
}

// ── The invariant checker (schema.md 3.3), shared with CI ───────────────────

const CODE_RE = /^[a-z0-9-]{2,16}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function realDate(s) {
  if (!DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/**
 * Throws a HistoryInputError naming the first violated invariant (I1 to I9,
 * I11; I10, the size bound, is the CI test's, because it is about the committed
 * FILE). `snapshot` is the bundled taxonomy snapshot.
 */
export function checkHistory(h, snapshot) {
  const bad = (msg) => fail(`asset invariant: ${msg}`)
  // I1
  if (h.v !== 1) bad(`v is ${h.v}, expected 1`)
  if (h.snapshot !== snapshot.version) bad(`snapshot "${h.snapshot}" does not equal the bundled snapshot version "${snapshot.version}"`)
  if (!Array.isArray(h.updates) || !Array.isArray(h.events) || !Array.isArray(h.inputs)) bad('updates, events and inputs must be arrays')
  // I9: updates ascending, unique, coverage derived
  const years = new Set()
  h.updates.forEach((u, i) => {
    if (!Number.isInteger(u.year) || !realDate(u.published)) bad(`update ${i} is incomplete`)
    if (years.has(u.year)) bad(`update year ${u.year} repeats`)
    years.add(u.year)
    if (i > 0 && !(h.updates[i - 1].published < u.published)) bad('updates are not ascending by published date')
  })
  const expectCoverage = h.updates.length === 0 ? null
    : { earliest: h.updates[0], latest: h.updates[h.updates.length - 1] }
  if (JSON.stringify(h.coverage) !== JSON.stringify(expectCoverage)) bad('coverage does not equal the first and last updates')

  const snapSpecies = new Set(Object.values(snapshot.byCom))
  const beforeCodesLater = (ev) => new Set(h.events.filter(f => f.published > ev.published).flatMap(f => f.before.map(b => b.code)))
  const afterCodesLater = (ev) => new Set(h.events.filter(f => f.published > ev.published).flatMap(f => f.after.map(a => a.code)))
  const eventsPerYear = new Map()

  h.events.forEach((ev, i) => {
    const at = `event ${i} (${ev.kind} ${ev.year})`
    // I2
    if (ev.kind !== 'split' && ev.kind !== 'lump') bad(`${at}: kind "${ev.kind}"`)
    if (!Number.isInteger(ev.year) || !realDate(ev.published)) bad(`${at}: incomplete year or date`)
    if (!h.updates.some(u => u.year === ev.year && u.published === ev.published)) bad(`${at}: (year, published) is not a member of updates`)
    eventsPerYear.set(ev.year, (eventsPerYear.get(ev.year) ?? 0) + 1)
    // I3
    if (!Array.isArray(ev.before) || !Array.isArray(ev.after) || !Array.isArray(ev.slashes)) bad(`${at}: sides must be arrays`)
    if (ev.kind === 'split' && !(ev.before.length === 1 && ev.after.length >= 2)) bad(`${at}: a split needs one before and two or more after`)
    if (ev.kind === 'lump' && !(ev.before.length >= 2 && ev.after.length === 1)) bad(`${at}: a lump needs two or more before and one after`)
    if (ev.kind === 'lump' && ev.slashes.length !== 0) bad(`${at}: a lump carries no slashes`)
    // I4, I11
    for (const e of [...ev.before, ...ev.after, ...ev.slashes]) {
      for (const k of ['code', 'sci', 'com']) {
        if (typeof e[k] !== 'string' || e[k].trim() === '') bad(`${at}: an entry has no ${k}`)
        if (e[k].includes('\ufffd')) bad(`${at}: U+FFFD in ${e[k]}`)
      }
      if (!CODE_RE.test(e.code)) bad(`${at}: code "${e.code}" fails the species-code shape`)
    }
    // I8
    for (const side of [ev.before, ev.after, ev.slashes]) {
      const codes = side.map(e => e.code)
      if (new Set(codes).size !== codes.length) bad(`${at}: a side repeats a code`)
    }
    // I5: after-side codes resolve in the snapshot. An after code that is no
    // longer current is allowed only where a LATER covered event carries it on
    // its before side (the chain, FR-03). Slashes follow below.
    const later = beforeCodesLater(ev)
    for (const a of ev.after) {
      if (snapSpecies.has(a.code)) {
        if (snapshot.byCode[a.code] !== a.com) bad(`${at}: after "${a.code}" name "${a.com}" is not the snapshot's "${snapshot.byCode[a.code]}"`)
      } else if (!later.has(a.code)) {
        bad(`${at}: after code "${a.code}" is not a species in the snapshot and no later event retires it`)
      }
    }
    // A slash is matched by its exact name only, never by its code (the
    // runtime indexes slashes by name). Where the snapshot still has the code
    // as a slash, the name must be the snapshot's. eBird also re-uses a
    // slash's code for a later species (2022's Northern/Southern Mouse-colored
    // Tyrannulet, y01204, became 2024's lumped Mouse-colored Tyrannulet); such
    // an entry keeps its own year's name, and a slash code that is a species
    // now must be a LATER event's after-side code, so a slash cannot borrow an
    // unrelated species' code. A slash code missing from the snapshot is
    // refused unless a LATER event retires it or it is a cited dropped slash
    // (SLASHES_DROPPED: the two 2019 drongos).
    const laterAfter = afterCodesLater(ev)
    for (const s of ev.slashes) {
      if (!s.com.includes('/')) bad(`${at}: slash "${s.code}" name has no "/"`)
      if (snapSpecies.has(s.code)) {
        if (!laterAfter.has(s.code)) bad(`${at}: slash "${s.code}" is a species in the snapshot and no later event creates it`)
      } else if (Object.hasOwn(snapshot.byCode, s.code)) {
        if (snapshot.byCode[s.code] !== s.com) bad(`${at}: slash "${s.code}" name "${s.com}" is not the snapshot's`)
      } else if (!later.has(s.code) && !Object.hasOwn(SLASHES_DROPPED, s.code)) {
        bad(`${at}: slash "${s.code}" is not in the snapshot, no later event retires it, and it is not a cited dropped slash (SLASHES_DROPPED)`)
      }
    }
    // I6: a before code that is a current species is the kept-code case, or a
    // code a LATER event creates again on its after side: eBird re-uses a
    // lumped species' code when it splits it back out (Pilbara Grasswren,
    // lumped 2021 and split 2024; Beesley's Lark, 2022 and 2024) and a split
    // parent's code for a later lump of its daughters (Chestnut-naped
    // Francolin, 2019, and Chestnut-naped Spurfowl, 2022). The runtime takes a
    // current code to the later after side only (taxonomyHistory.ts).
    for (const b of ev.before) {
      if (snapSpecies.has(b.code) && !ev.after.some(a => a.code === b.code) && !laterAfter.has(b.code)) {
        bad(`${at}: before code "${b.code}" is still a species, is not among its own event's after side, and no later event creates it`)
      }
      // I7
      if (typeof b.retired !== 'boolean') bad(`${at}: before "${b.code}" has no retired flag`)
      if (b.retired !== !Object.hasOwn(snapshot.byCom, b.com.toLowerCase())) bad(`${at}: before "${b.code}" retired flag disagrees with the snapshot`)
    }
    // I9: events sorted
    if (i > 0) {
      const p = h.events[i - 1]
      const ok = p.published < ev.published || (p.published === ev.published && p.before[0].sci <= ev.before[0].sci)
      if (!ok) bad(`${at}: events are not sorted by (published, first before sci)`)
    }
  })
  for (const u of h.updates) if (!eventsPerYear.get(u.year)) bad(`update ${u.year} has no events`)
  return true
}
