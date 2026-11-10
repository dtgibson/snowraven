// @vitest-environment jsdom
//
// life-list-region-filter QA-34 and FR-22 to FR-24, under BOTH storage seams,
// through the real `storage.ts` (TauriStorage over a mocked plugin-fs,
// WebStorage over a mocked `/settings/{key}` route), in the shape of
// `exoticProvenanceConvergence.test.tsx`. Every Region row in
// `components/lifeLists/LifeListsTab.test.tsx` mocks `storage` whole, so this
// is the suite that reads the saved region back from what each seam keeps on
// disk (testing.md v1.0.64). The rows are module-level: they write the matched
// choice's RegionRef, read it back through `parseStoredRegion` and
// `findChoice`, derive the region's rows, and delete the key, in each seam's
// own module graph; the last row compares the two seams' rows.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import type { LifeListRow, MediaFormat } from './lifeLists'

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
vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppLocalData: 4 },
  exists: async (path: string) => tauriFiles.has(path),
  readTextFile: async (path: string) => {
    const v = tauriFiles.get(path)
    if (v === undefined) throw new Error(`ENOENT: ${path}`)
    return v
  },
  writeTextFile: async (path: string, content: string) => { tauriFiles.set(path, content) },
  mkdir: async () => undefined,
  remove: async (path: string) => { tauriFiles.delete(path) },
}))

// The web/Pi route: one JSON body per key, as backend/routers/settingskv.py
// keeps, with each write's request header recorded.
const webSettings = new Map<string, string>()
const webWrites: { method: string; key: string; appHeader: string | undefined }[] = []
async function webFetch(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<unknown> {
  const key = decodeURIComponent(url.slice('/settings/'.length))
  const method = init?.method ?? 'GET'
  if (method !== 'GET') webWrites.push({ method, key, appHeader: init?.headers?.['X-SnowRaven-Request'] })
  if (method === 'POST') { webSettings.set(key, init?.body ?? 'null'); return { ok: true, status: 200 } }
  if (method === 'DELETE') { webSettings.delete(key); return { ok: true, status: 200 } }
  const body = webSettings.get(key)
  return body === undefined
    ? { ok: false, status: 404, json: async () => null }
    : { ok: true, status: 200, json: async () => JSON.parse(body) }
}

function obs(commonName: string, date: string, time: string | null, submissionId: string, county: string | null, stateProvince: string | null): ObservationEntry {
  return {
    submissionId, commonName, scientificName: 'Genus species subsp', date, location: `Place ${submissionId}`, locationId: 'L1',
    latitude: null, longitude: null, county, count: 1, breedingCode: null, speciesComments: '', catalogIds: [], time, stateProvince,
  }
}
const FIXTURE: ObservationEntry[] = [
  obs('Wrentit', '2019-05-01', '6:00 AM', 'S10', 'Clark', 'US-NV'),
  obs('Wrentit', '2021-03-02', '7:05 AM', 'S20', 'Marin', 'US-CA'),
  obs('Bushtit', '2022-08-08', null, 'S30', 'Marin', 'US-CA'),
  obs('Spotted Towhee', '2018-01-01', '9:00 AM', 'S40', 'Sonoma', 'US-CA'),
  obs('Spotted Towhee', '2023-02-02', '8:00 AM', 'S50', 'Marin', 'US-CA'),
  obs('gull sp.', '2020-01-01', null, 'S60', 'Marin', 'US-CA'),
]
const ML: MLExportRow[] = [
  { catalogId: '1', commonName: 'Wrentit', scientificName: '', format: 'Photo', date: '2018-01-01', location: 'Elsewhere', county: 'Clark', latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '', ageSex: '', behaviors: '', time: '0700', year: null, month: null, avgRating: null, numRatings: 0, checklistId: 'S10' },
  { catalogId: '2', commonName: 'Wrentit', scientificName: '', format: 'Photo', date: '2021-03-02', location: 'Point Reyes', county: 'Marin', latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '', ageSex: '', behaviors: '', time: '0710', year: null, month: null, avgRating: null, numRatings: 0, checklistId: 'S20' },
]
const KEY = 'lifeListsRegion'
const OTHER = 'targetsCounty'
const SEL: MediaFormat[][] = [[], ['Photo']]

/** Each seam's derived rows, compared by the last row of the file. */
const rowsBySeam = new Map<'tauri' | 'web', LifeListRow[][]>()

describe.each(['tauri', 'web'] as const)('the saved region round-trips under the %s storage seam (QA-34, FR-22 to FR-24)', (which) => {
  let storage: typeof import('./storage').storage
  let region: typeof import('./lifeListsRegion')
  let lifeLists: typeof import('./lifeLists')

  /** What the seam keeps on disk for a key: the parsed value, or undefined. */
  const onDisk = (key: string): unknown => {
    if (which === 'tauri') {
      const file = tauriFiles.get('data/settings.json')
      if (file === undefined) return undefined
      const settings = JSON.parse(file) as Record<string, unknown>
      return Object.hasOwn(settings, key) ? settings[key] : undefined
    }
    const body = webSettings.get(key)
    return body === undefined ? undefined : JSON.parse(body)
  }

  beforeEach(async () => {
    seam.tauri = which === 'tauri'
    tauriFiles.clear()
    webSettings.clear()
    webWrites.length = 0
    if (which === 'web') vi.stubGlobal('fetch', vi.fn(webFetch))
    // storage.ts picks its adapter when it is first evaluated, so each seam
    // gets its own module graph.
    vi.resetModules()
    storage = (await import('./storage')).storage
    region = await import('./lifeListsRegion')
    lifeLists = await import('./lifeLists')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes the matched choice, reads the same choice back, derives the same rows, and deletes the key', async () => {
    // A neighbouring preference, so the write and the delete are seen to
    // leave the rest of the document alone.
    await storage.setSetting(OTHER, 'US-CA-041')
    const index = region.deriveRegionIndex(FIXTURE)
    const choice = region.findChoice(index.choices, { level: 'county', code: 'US-CA', county: 'Marin' })
    expect(choice).not.toBeNull()

    // (1) The write: the matched choice's RegionRef under the one key.
    await storage.setSetting(region.LIFE_LISTS_REGION_SETTING, choice!.region)
    expect(onDisk(KEY)).toEqual({ level: 'county', code: 'US-CA', county: 'Marin' })
    expect(onDisk(OTHER)).toBe('US-CA-041')
    if (which === 'web') expect(webWrites.filter(w => w.key === KEY)).toEqual([{ method: 'POST', key: KEY, appHeader: '1' }])

    // (2) The read-back, as the tab's load effect reads it: the validator,
    // then the match, which returns the derived choice object itself.
    const saved = await storage.getSetting<unknown>(KEY)
    const wanted = region.parseStoredRegion(saved)
    expect(wanted).toEqual(choice!.region)
    const back = region.findChoice(index.choices, wanted!)
    expect(back).toBe(choice)
    expect(back!.label).toBe('Marin, CA')

    // (3) The region's rows, as the tab composes them (the world asset map as
    // presence), for no format and for Photo.
    const world = lifeLists.deriveFirstAssets(ML)
    const regional = region.regionAssets(region.deriveRegionAssets(ML, index.join), back!.region, ML)
    const none = { escapees: new Set<string>(), exotics: new Set<string>() }
    const rows = SEL.map(sel => lifeLists.selectRows(
      region.regionFirsts(index, back!.region, FIXTURE)!, regional, none,
      { includeEscapees: false, includeExotics: false, formats: new Set(sel) }, world,
    ))
    expect(rows[0].map(r => [r.name, r.day, r.time, r.checklistId, r.position, r.place, r.scientificName])).toEqual([
      ['Spotted Towhee', 20230202, '8:00 AM', 'S50', 3, 'Marin, CA', 'Genus species'],
      ['Bushtit', 20220808, null, 'S30', 2, 'Marin, CA', 'Genus species'],
      ['Wrentit', 20210302, '7:05 AM', 'S20', 1, 'Marin, CA', 'Genus species'],
    ])
    expect(rows[1].map(r => [r.name, r.day, r.checklistId, r.media.photo])).toEqual([['Wrentit', 20210302, 'S20', true]])
    rowsBySeam.set(which, rows)

    // (4) Everywhere: the key is deleted, reads back null, and is absent from
    // what the seam keeps; the neighbouring preference stays.
    await storage.deleteSetting(region.LIFE_LISTS_REGION_SETTING)
    expect(await storage.getSetting<unknown>(KEY)).toBeNull()
    expect(region.parseStoredRegion(await storage.getSetting<unknown>(KEY))).toBeNull()
    if (which === 'tauri') {
      const settings = JSON.parse(tauriFiles.get('data/settings.json')!) as Record<string, unknown>
      expect(Object.hasOwn(settings, KEY)).toBe(false)
      expect(settings[OTHER]).toBe('US-CA-041')
    } else {
      expect(webSettings.has(KEY)).toBe(false)
      expect(webSettings.get(OTHER)).toBe('"US-CA-041"')
      expect(webWrites.filter(w => w.key === KEY).map(w => [w.method, w.appHeader])).toEqual([['POST', '1'], ['DELETE', '1']])
    }
  })
})

describe('the two seams agree (QA-34)', () => {
  it('derive identical rows for the same fixture under the Tauri and web/Pi seams', () => {
    const tauri = rowsBySeam.get('tauri'), web = rowsBySeam.get('web')
    expect(tauri, 'the Tauri row ran').toBeDefined()
    expect(web, 'the web/Pi row ran').toBeDefined()
    expect(tauri!.flat().length).toBeGreaterThan(2)
    expect(web).toEqual(tauri)
  })
})
