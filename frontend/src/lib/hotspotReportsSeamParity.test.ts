// @vitest-environment jsdom
//
// hotspot-reports QA-71 (NFR-10), the dynamic half: the derivation returns
// identical output for one fixture under BOTH storage seams, in the shape of
// `lifeListsRegionConvergence.test.ts`. The files arrive through the REAL
// `storage.ts` (TauriStorage over a mocked plugin-fs; WebStorage over a mocked
// `/settings/files` route) and the real `observationsCache.ts` and
// `mlExportCache.ts`, each seam in its own module graph, so the only thing that
// differs between the two runs is how the same file text arrives. The static
// half (no platform import in the feature) is `hotspotReportsNetwork.test.ts`.
//
// AN AGREEING WRONG NUMBER IS INVISIBLE TO PARITY CHECKING (CLAUDE.md,
// testing.md v1.0.32), so each seam's output is also held to an ORACLE outside
// both runs: the fixture's own row specs, read by this file, give every
// location's checklist count, its life list (name and first date), its media
// counts and its protocol tally, and a structural identity ties the overview's
// species totals to the reports' list lengths. Equality across the seams is the
// last row; it is never the only one.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Static import, so the mock is registered before any dynamic import of the
// plugin (storageWriteSerialization.test.ts records the race this avoids).
import '@tauri-apps/plugin-fs'

const seam = { tauri: false }
vi.mock('./platform', () => ({
  isTauri: () => seam.tauri,
  isIOS: () => false,
  isAndroid: () => false,
  isMacOS: () => false,
  isMobileApp: () => false,
  isWindows: () => false,
}))

const tauriFiles = new Map<string, string>()
/** Every path the plugin-fs double was asked to read, so each seam is seen to
 *  take its own read path (the Tauri leg reads these; the web leg reads none). */
const tauriReads: string[] = []
vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppLocalData: 4 },
  exists: async (path: string) => tauriFiles.has(path),
  readTextFile: async (path: string) => {
    tauriReads.push(path)
    const v = tauriFiles.get(path)
    if (v === undefined) throw new Error(`ENOENT: ${path}`)
    return v
  },
  writeTextFile: async (path: string, content: string) => { tauriFiles.set(path, content) },
  mkdir: async () => undefined,
  remove: async (path: string) => { tauriFiles.delete(path) },
}))

// The fixture, as row specs: the CSV both seams serve is built from these,
// and the oracle reads these, never the parse.

interface Spec { sub: string; loc: string; name: string; county: string; st: string; date: string; protocol: string; species: string[] }
const SPECS: Spec[] = [
  { sub: 'S9000000101', loc: 'L101', name: 'Jamaica Bay', county: 'Queens', st: 'US-NY', date: '2023-05-01', protocol: 'Traveling', species: ['Song Sparrow', 'Blue Jay', 'gull sp.'] },
  { sub: 'S9000000102', loc: 'L101', name: 'Jamaica Bay', county: 'Queens', st: 'US-NY', date: '2024-06-02', protocol: 'Stationary', species: ['Song Sparrow', 'Wood Duck'] },
  { sub: 'S9000000103', loc: 'L101', name: 'Jamaica Bay', county: 'Queens', st: 'US-NY', date: '2022-04-03', protocol: 'Traveling', species: ["Red-tailed Hawk (Harlan's)"] },
  { sub: 'S9000000201', loc: 'L202', name: 'Home', county: 'Kings', st: 'US-NY', date: '2021-01-04', protocol: '', species: ['Blue Jay'] },
  { sub: 'S9000000202', loc: 'L202', name: 'Home', county: 'Kings', st: 'US-NY', date: 'not a date', protocol: 'Incidental', species: ['Mallard'] },
  { sub: 'S9000000301', loc: 'L303', name: 'Sandy Hook', county: 'Monmouth', st: 'US-NJ', date: '2020-09-05', protocol: 'Traveling', species: ['duck sp.'] },
]
const HEADER = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Latitude,Longitude,Date,Time,Protocol,Duration (Min),All Obs Reported,Distance Traveled (km),Area Covered (ha),Number of Observers,Breeding Code,Observation Details,Checklist Comments,ML Catalog Numbers'
const CSV = [HEADER, ...SPECS.flatMap(s => s.species.map(sp =>
  [s.sub, sp, `Sci ${sp.split(' ')[0]}`, '1', '1', s.st, s.county, s.loc, s.name, '40.60', '-73.80', s.date, '07:00 AM', s.protocol, '60', '1', '1', '', '1', '', '', '', '']
    .map(c => (c.includes(',') || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c)).join(',')))].join('\n') + '\n'
// The ML export, cut to the columns the parser reads plus the place columns
// the join must NOT read (a wrong County, Locality and coordinates on every
// row, so a join by place would land nowhere).
const ML_HEADER = 'ML Catalog Number,Format,Common Name,Scientific Name,Date,Time,County,Locality,Latitude,Longitude,eBird Checklist ID'
const ML_SPECS: { id: string; format: 'Photo' | 'Audio' | 'Video'; sub: string }[] = [
  { id: '1001', format: 'Photo', sub: 'S9000000101' },
  { id: '1002', format: 'Photo', sub: 'S9000000102' },
  { id: '1003', format: 'Audio', sub: 'S9000000102' },
  { id: '1004', format: 'Video', sub: 'S9000000201' },
  { id: '1005', format: 'Photo', sub: '' },
]
const ML_CSV = [ML_HEADER, ...ML_SPECS.map(m =>
  [m.id, m.format, 'Song Sparrow', 'Melospiza melodia', '2024-06-02', '700', 'Elsewhere', 'Not the place', '10.0', '10.0', m.sub].join(','))].join('\n') + '\n'
const FILES_STATUS = {
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T12:00:00Z' },
  ml: { filename: 'ML__2026-06-01.csv', uploadedAt: '2026-06-01T12:00:00Z' },
}

/** The web/Pi route: the files status and the two stored files. Every URL
 *  asked for is recorded. */
const webReads: string[] = []
async function webFetch(url: string): Promise<Response> {
  webReads.push(url)
  if (url === '/settings/files') return new Response(JSON.stringify(FILES_STATUS), { status: 200, headers: { 'content-type': 'application/json' } })
  if (url === '/settings/files/ebird') return new Response(CSV, { status: 200, headers: { 'content-type': 'text/csv' } })
  if (url === '/settings/files/ml') return new Response(ML_CSV, { status: 200, headers: { 'content-type': 'text/csv' } })
  return new Response('not found', { status: 404 })
}

// The oracle, from the specs alone.

const NON_COUNTABLE = new Set(['gull sp.', 'duck sp.'])
const fold = (n: string) => (n.includes(' (') ? n.slice(0, n.indexOf(' (')) : n)
const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)
const LOCS = [...new Set(SPECS.map(s => s.loc))]
const locOfSub = new Map(SPECS.map(s => [s.sub, s.loc]))
const ORACLE = {
  /** Distinct submissions per location, in first-appearance order. */
  checklists: LOCS.map(loc => [loc, new Set(SPECS.filter(s => s.loc === loc).map(s => s.sub)).size] as [string, number]),
  /** Photo, audio, video per location, by each asset's linked checklist alone. */
  media: Object.fromEntries(LOCS.map(loc => [loc, (['Photo', 'Audio', 'Video'] as const).map(f =>
    ML_SPECS.filter(m => m.format === f && locOfSub.get(m.sub) === loc).length)])) as Record<string, number[]>,
  /** Dated checklists per calendar month, January first. */
  months: Object.fromEntries(LOCS.map(loc => {
    const m = new Array<number>(12).fill(0)
    for (const s of SPECS) if (s.loc === loc && isDay(s.date)) m[Number(s.date.slice(5, 7)) - 1] += 1
    return [loc, m]
  })) as Record<string, number[]>,
  /** Name and first date at the place (YYYYMMDD), dated countable rows only:
   *  hand-derived, then checked against SPECS below. */
  life: {
    L101: [['Wood Duck', 20240602], ['Song Sparrow', 20230501], ['Blue Jay', 20230501], ['Red-tailed Hawk', 20220403]],
    L202: [['Blue Jay', 20210104]],
    L303: [],
  } as Record<string, [string, number][]>,
  /** Count descending then label, the blank bucket last. */
  protocols: { L101: [['Traveling', 2], ['Stationary', 1]], L202: [['Incidental', 1], ['', 1]], L303: [['Traveling', 1]] } as Record<string, [string, number][]>,
}
// The hand-typed life lists, checked against the specs (names and the
// earliest dated row of each) so the oracle is not a second guess.
for (const loc of LOCS) {
  const first = new Map<string, number>()
  for (const s of SPECS) {
    if (s.loc !== loc || !isDay(s.date)) continue
    const day = Number(s.date.replaceAll('-', ''))
    for (const sp of s.species) if (!NON_COUNTABLE.has(sp)) first.set(fold(sp), Math.min(first.get(fold(sp)) ?? Infinity, day))
  }
  const typed = new Map(ORACLE.life[loc])
  if (typed.size !== first.size || [...first].some(([n, d]) => typed.get(n) !== d)) throw new Error(`the typed oracle disagrees with SPECS at ${loc}`)
}

interface Summary {
  locations: { id: string; name: string; place: string; checklists: number }[]
  totals: number[]
  ranks: { byChecklists: string[]; bySpecies: string[] }
  reports: Record<string, { life: [string, number][]; protocols: [string, number][]; months: number[]; media: number[]; biggest: number | null }>
}
const bySeam = new Map<'tauri' | 'web', Summary>()

describe.each(['tauri', 'web'] as const)('the Hotspot Reports derivation under the %s storage seam (QA-71)', (which) => {
  beforeEach(async () => {
    seam.tauri = which === 'tauri'
    tauriFiles.clear()
    tauriFiles.set('data/metadata.json', JSON.stringify(FILES_STATUS))
    tauriFiles.set('data/ebird-backup.csv', CSV)
    tauriFiles.set('data/ml-export.csv', ML_CSV)
    tauriReads.length = 0
    webReads.length = 0
    // The Tauri leg makes no HTTP request at all: a fetch there fails the row.
    vi.stubGlobal('fetch', vi.fn(which === 'web' ? webFetch : async (url: string) => { throw new Error(`the Tauri seam fetched ${url}`) }))
    // storage.ts picks its adapter when it is first evaluated, and both caches
    // hold module state, so each seam gets its own module graph.
    vi.resetModules()
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('reads both files through the seam and derives the oracle\'s figures', async () => {
    const { storage } = await import('./storage')
    const { loadEbirdObservations } = await import('./observationsCache')
    const { loadMLExport } = await import('./mlExportCache')
    const reports = await import('./hotspotReports')
    const location = await import('./hotspotReportsLocation')

    const status = await storage.getFilesStatus()
    expect(status.ebird).not.toBeNull()
    expect(status.ml).not.toBeNull()
    const ebird = await loadEbirdObservations()
    const ml = await loadMLExport()
    expect(ebird, `${which}: the backup was read and parsed`).not.toBeNull()
    expect(ml, `${which}: the ML export was read and parsed`).not.toBeNull()
    const obs = ebird!.observations
    // Each seam took its own read path, and only its own.
    if (which === 'tauri') {
      expect(tauriReads).toEqual(expect.arrayContaining(['data/metadata.json', 'data/ebird-backup.csv', 'data/ml-export.csv']))
      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    } else {
      expect(webReads).toEqual(expect.arrayContaining(['/settings/files', '/settings/files/ebird', '/settings/files/ml']))
      expect(tauriReads).toEqual([])
    }
    expect(obs.length, `${which}: every fixture row parsed`).toBe(SPECS.reduce((n, s) => n + s.species.length, 0))
    expect(ml!.rows.length, `${which}: every ML row parsed`).toBe(ML_SPECS.length)

    const index = reports.buildLocationIndex(obs)
    const none = new Set<string>()
    const totals = reports.speciesTotals(index, none)
    const ranks = reports.rankLocations(index, totals)
    const media = reports.deriveMediaCounts(ml!.rows, index)
    const summary: Summary = {
      locations: index.locations.map(l => ({ id: l.locationId, name: l.name, place: l.place, checklists: index.checklistCount[l.ord] })),
      totals: [...totals],
      ranks: { byChecklists: ranks.byChecklists.map(r => index.locations[r.ord].locationId), bySpecies: ranks.bySpecies.map(r => index.locations[r.ord].locationId) },
      reports: {},
    }
    for (const l of index.locations) {
      const facts = location.deriveLocationFacts(index, obs, l.ord)
      const species = location.applySpeciesRule(facts, none)
      // Structural: the overview's total for a place IS its list's length.
      expect(totals[l.ord], `${which} ${l.locationId}`).toBe(species.total)
      summary.reports[l.locationId] = {
        life: species.rows.map(r => [r.name, r.day] as [string, number]),
        protocols: facts.protocols.map(p => [p.kind === 'blank' ? '' : p.name, p.count] as [string, number]),
        months: [...facts.months],
        media: [media[l.ord * 3], media[l.ord * 3 + 1], media[l.ord * 3 + 2]],
        biggest: species.biggest === null ? null : species.biggest.species,
      }
    }

    // Recorded before the oracle is consulted, so the last row judges the two
    // seams' agreement on its own: a figure both seams get wrong the same way
    // leaves that row green and turns these red, which is why they exist.
    bySeam.set(which, summary)

    // The oracle, outside both runs.
    expect(summary.locations.map(l => [l.id, l.checklists])).toEqual(ORACLE.checklists)
    for (const id of LOCS) {
      const got = summary.reports[id]
      expect(new Map(got.life), `${which} ${id} life list`).toEqual(new Map(ORACLE.life[id]))
      expect(got.life.length, `${which} ${id} no duplicate rows`).toBe(ORACLE.life[id].length)
      expect(got.media, `${which} ${id} media`).toEqual(ORACLE.media[id])
      expect(got.months, `${which} ${id} months`).toEqual(ORACLE.months[id])
      expect(got.protocols, `${which} ${id} protocols`).toEqual(ORACLE.protocols[id])
    }
    // Ranked by checklists L101 (3), L202 (2), L303 (1); a place with no
    // countable species never enters the species ranking.
    expect(summary.ranks.byChecklists).toEqual(['L101', 'L202', 'L303'])
    expect(summary.ranks.bySpecies).toEqual(['L101', 'L202'])
  })
})

describe('the two seams agree (QA-71)', () => {
  it('derive identical output for the same fixture under the Tauri and web/Pi seams', () => {
    const tauri = bySeam.get('tauri'), web = bySeam.get('web')
    expect(tauri, 'the Tauri row ran').toBeDefined()
    expect(web, 'the web/Pi row ran').toBeDefined()
    expect(Object.keys(tauri!.reports).length).toBe(3)
    expect(web).toEqual(tauri)
  })
})
