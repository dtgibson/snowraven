/// <reference types="node" />
// A generated corpus for the Family Tree suites (family-rollups-and-tree
// schema 17): observation and ML rows in the shapes the two parsers produce,
// from a seeded generator, so every run is the same corpus and a property
// asserted over it is asserted over hundreds of shapes at once. It mixes real
// species of the bundled asset (so they place) with countable names the asset
// does not list (Not placed), subspecies forms that fold, spuhs, slashes and
// hybrids, several countries, states and counties (and cells outside the
// region bounds), several years with undated rows, ML rows linked to a
// checklist, linked to none and linked to one the backup does not hold, and
// the hostile names the security rules name (`__proto__`, `constructor`, a
// name past the placement key bound).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from '../lib/parseMLExport'
import { buildFamilyIndex, type FamiliesAssetJson, type FamilyIndex } from '../lib/familyTreeAsset'
import { deriveFirstSightings } from '../lib/lifeLists'
import { deriveRegionIndex } from '../lib/lifeListsRegion'
import { deriveScope, deriveYearColumns, type ScopeBase } from '../lib/familyTreeScope'
import { NO_MEDIA_CONSTRAINTS, buildFamilyModel, worldCounts, type FamilyModel } from '../lib/familyTreeModel'

/** A path beside this file, as a plain string, so a jsdom suite (whose global
 *  URL is jsdom's, not Node's) can read it as well as a node one. */
function asPath(rel: string): string {
  return fileURLToPath(String(new URL(rel, import.meta.url)))
}

export function readFamilyIndex(): FamilyIndex {
  const raw = JSON.parse(readFileSync(asPath('../assets/ebird-families.json'), 'utf8')) as FamiliesAssetJson
  return buildFamilyIndex(raw)
}

interface Snapshot { byCode: Record<string, string>; byCom: Record<string, string> }
let snapshot: Snapshot | null = null
/** Every species name of the snapshot, spelled as eBird spells it, in taxonomic order of the asset. */
export function speciesNames(index: FamilyIndex): string[] {
  if (snapshot === null) snapshot = JSON.parse(readFileSync(asPath('../assets/ebird-taxonomy.json'), 'utf8')) as Snapshot
  const byLower = new Array<string>(index.epithets.length)
  for (const [lc, seq] of index.bySpecies) byLower[seq] = snapshot.byCode[snapshot.byCom[lc]]
  return byLower
}

/** mulberry32: a small seeded generator. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function obsRow(commonName: string, date: string, submissionId: string, extra: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    submissionId, commonName, scientificName: '', date, location: 'Lake Park', locationId: 'L1',
    latitude: null, longitude: null, county: 'Marin', count: 1, breedingCode: null,
    speciesComments: '', catalogIds: [], time: '7:05 AM', stateProvince: 'US-CA', ...extra,
  }
}

export function mlRow(commonName: string, format: MLExportRow['format'], date: string, checklistId: string, catalogId: string, extra: Partial<MLExportRow> = {}): MLExportRow {
  return {
    catalogId, commonName, scientificName: '', format, date, location: 'River Trail', county: 'Dakota',
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '', ageSex: '',
    behaviors: '', time: '643', year: null, month: null, avgRating: null, numRatings: 0, checklistId, ...extra,
  }
}

const PLACES: readonly [string | null, string | null][] = [
  ['US-CA', 'Marin'], ['US-CA', 'Sonoma'], ['US-CA', ''], ['US-NY', 'Kings'], ['US-NY', 'Marin'],
  ['CA-ON', null], ['MX', null], ['GB-ENG', 'Kent'], ['', null], [null, 'Marin'],
  ['US-CA-EXTRA-LONG-CODE', 'Marin'], ['-CA', 'Marin'],
]

const UNPLACED = ['Imaginary Warbler', 'Hand-edited Flycatcher', '__proto__', 'constructor', 'toString', 'L' + 'o'.repeat(140) + 'ng Bird']
const NOT_SINGLE = ['gull sp.', 'Mallard x American Black Duck (hybrid)', 'Cackling/Canada Goose', 'Western x Glaucous-winged Gull (hybrid)', 'hawk sp.']
const FORMS = ['Dark-eyed Junco (Oregon)', 'Yellow-rumped Warbler (Myrtle)', 'Red-tailed Hawk (Western/Northern)']

export interface Corpus { readonly obs: ObservationEntry[]; readonly ml: MLExportRow[] }

/**
 * `checklists` checklists of `perChecklist` rows each, plus a fixed tail of
 * hostile and edge rows. `species` is a list of placed names to draw from.
 */
export function generateCorpus(seed: number, species: readonly string[], checklists = 120, perChecklist = 8): Corpus {
  const r = rng(seed)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
  const obs: ObservationEntry[] = []
  const ml: MLExportRow[] = []
  const pool = species.slice(0, Math.max(40, Math.min(species.length, 400)))
  const subs: string[] = []
  for (let c = 0; c < checklists; c++) {
    const sub = `S${1000 + c}`
    subs.push(sub)
    const [sp, county] = pick(PLACES)
    const year = 2018 + Math.floor(r() * 6)
    const month = 1 + Math.floor(r() * 12)
    const day = 1 + Math.floor(r() * 28)
    const date = r() < 0.04 ? 'not a date' : `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`
    for (let k = 0; k < perChecklist; k++) {
      const roll = r()
      const name = roll < 0.74 ? pick(pool)
        : roll < 0.82 ? pick(FORMS)
          : roll < 0.9 ? pick(NOT_SINGLE)
            : roll < 0.95 ? pick(UNPLACED)
              : pick(pool).toUpperCase()
      obs.push(obsRow(name, date, r() < 0.02 ? '' : sub, { stateProvince: sp, county }))
    }
  }
  // The tail: shapes a generator draw might never make.
  // Year 0000 reads as no year (schema 5.2), so this species is also dated
  // in a real year at the same place, and the union over years holds.
  obs.push(obsRow(pool[0], '0000-01-01', 'S9001'))
  obs.push(obsRow(pool[0], '2020-06-06', 'S9006'))
  obs.push(obsRow(pool[1], '2024-13-01', 'S9002'))
  obs.push(obsRow(pool[2], '2019-02-30', 'S9003', { stateProvince: 'US-NY', county: 'Kings' }))
  obs.push(obsRow('', '2020-05-05', 'S9004'))
  obs.push(obsRow(pool[3], '2020-05-05', 'S9005', { stateProvince: 'US-CA', county: 'C'.repeat(120) }))
  // ML: linked to a checklist of the backup, to none, to one it does not hold.
  const formats: MLExportRow['format'][] = ['Photo', 'Photo', 'Audio', 'Video']
  for (let i = 0; i < checklists * 3; i++) {
    const o = pick(obs)
    const roll = r()
    const cid = roll < 0.78 ? o.submissionId : roll < 0.9 ? '' : 'S7777777'
    const year = 2018 + Math.floor(r() * 6)
    const date = r() < 0.05 ? '' : `${year}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`
    // The ML parser normalizes the name; so does this generator.
    const name = o.commonName.endsWith(')') ? o.commonName.slice(0, o.commonName.lastIndexOf(' (')) : o.commonName
    ml.push(mlRow(name, pick(formats), date, cid, `ML${i}`))
  }
  ml.push(mlRow(pool[0], 'Photo', '2021-01-01', subs[0], 'MLX1', { format: 'Unknown' as MLExportRow['format'] }))
  ml.push(mlRow('', 'Photo', '2021-01-01', subs[0], 'MLX2'))
  return { obs, ml }
}

/**
 * A model over EVERY species in the committed asset, one sighting each (the
 * diagram's measured roster, schema 11.2): read when the test runs, so a
 * regenerated asset moves it with no typed-in figure.
 */
export function fullRosterModel(index: FamilyIndex): FamilyModel {
  const names = speciesNames(index).filter(n => typeof n === 'string')
  const obs = names.map((n, i) => obsRow(n, '2024-05-01', `S${9000000000 + i}`))
  const base: ScopeBase = { observations: obs, mlRows: null, firsts: deriveFirstSightings(obs), index: deriveRegionIndex(obs), columns: deriveYearColumns(obs, null) }
  return buildFamilyModel({
    index, world: worldCounts(index, base.firsts), scope: deriveScope(base, null, null, null), firsts: base.firsts,
    escapees: new Set(), includeEscapees: true, media: NO_MEDIA_CONSTRAINTS, mediaReadable: false, scopeFiltered: false,
  })
}
