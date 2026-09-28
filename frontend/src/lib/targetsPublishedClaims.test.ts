// The published Targets help passage, held to the code (targets-tab, schema.md
// 9.2; the v1.0.21 rule that a requirement resting on a guard needs a guard that
// actually reads the published file).
//
// docs/HELP.md is the in-app help and a published statement. Every figure and
// every control name the `## Targets` passage states is DERIVED here from the
// constant or the function that renders it, never retyped, so a renamed button
// or a moved slider stop turns this file red rather than leaving the help
// describing a control that no longer exists.
//
// DELIVERY vs CONTENT (testing.md v1.0.14): the rows that import a constant prove
// the help and the UI say the same thing. The behaviour rows (F and H count as
// codes; a form's media counts for its species; the file is not synced) prove
// the help's claim is TRUE of the shipped logic, which a shared constant cannot.
//
// WHAT THIS CANNOT SEE: whether a sentence is well written, and any claim made
// in words that name no constant. Those stay with review.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as copy from './targets/targetsCopy'
import { MEDIA_TYPES, buildTargetsRecord } from './targets/targetsRecord'
import { classifyPool } from './targets/targetsClassify'
import { isBreedingTarget, isMediaTarget } from './targets/targetsFilter'
import { SORT_ORDER } from './targets/targetsSort'
import { SWEEP_DAYS } from './targets/targetsDates'
import { parseBarChartFilename } from './uploadGuard'
import { SLOTS } from './icloud/icloudRecord'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'

const HELP = readFileSync(fileURLToPath(new URL('../../../docs/HELP.md', import.meta.url)), 'utf8')

function section(heading: string): string {
  const start = HELP.indexOf(`\n${heading}\n`)
  if (start === -1) return ''
  const rest = HELP.slice(start + heading.length + 2)
  const next = rest.search(/\n## /)
  return next === -1 ? rest : rest.slice(0, next)
}

const TARGETS = section('## Targets')
const bold = (s: string) => `**${s}**`

describe('the passage exists and is the one being read (non-vacuity)', () => {
  it('has the Targets section with its subsections', () => {
    expect(TARGETS.length).toBeGreaterThan(2000)
    for (const h of [
      '### Choosing a county', '### The three kinds of target', '### Probability and live: two different numbers',
      "### Adding a county's eBird bar-chart file", '### Live counts', '### Sorting and filtering',
    ]) expect(TARGETS, h).toContain(h)
  })
})

describe('control names match the controls', () => {
  it('the picker, the three types, the chips and the threshold', () => {
    expect(TARGETS).toContain(bold(copy.COUNTY_LABEL))
    for (const t of [copy.TYPE_LIFER, copy.TYPE_MEDIA, copy.TYPE_BREEDING]) expect(TARGETS, t).toContain(`- ${bold(t)}:`)
    for (const m of MEDIA_TYPES) expect(TARGETS, m).toContain(bold(m))
    expect(TARGETS).toContain(bold(copy.THRESHOLD_CONFIRMED))
  })

  it('the bar-chart section and its actions', () => {
    for (const s of [copy.FILE_SECTION_LABEL, copy.ADD_FILE, copy.REPLACE_FILE, copy.REMOVE_FILE, copy.SHOW_UNMATCHED, copy.ADD_FILE_DETAIL_ACTION]) {
      expect(TARGETS, s).toContain(bold(s))
    }
  })

  it('the window and distance controls', () => {
    expect(TARGETS).toContain(bold(copy.WINDOW_LABEL))
    expect(TARGETS).toContain(bold(copy.DISTANCE_LABEL))
    // The measuring-point chooser's options (FR-51a), named as the dialog names them.
    for (const s of [copy.CHOOSER_MY_LOCATION, copy.CHOOSER_DEFAULT, copy.CHOOSER_LIST_SECTION]) expect(TARGETS, s).toContain(bold(s))
    // The search's disclosure: OpenStreetMap, on a press of Search, in the help
    // and in the hint the dialog shows beside the field.
    expect(TARGETS).toContain('looked up on OpenStreetMap only when you press **Search**')
    expect(copy.CHOOSER_SEARCH_HINT).toContain('looked up on OpenStreetMap when you press Search')
    const any = copy.WINDOW_OPTIONS.find(o => o.key === 'any')!
    expect(TARGETS).toContain(bold(any.label))
    // "the last day, week, or 30 days": every other window option, in order.
    const rest = copy.WINDOW_OPTIONS.filter(o => o.key !== 'any').map(o => o.label.toLowerCase())
    expect(TARGETS).toContain(`in the last ${rest.slice(0, -1).join(', ')}, or ${rest[rest.length - 1]}`)
  })
})

describe('figures match the code that renders them', () => {
  it('the distance stops', () => {
    const miles = copy.DISTANCE_STOPS.filter((s): s is number => s !== null)
    expect(miles.length).toBeGreaterThan(1)
    expect(TARGETS).toContain(`within ${miles.slice(0, -1).join(', ')} or ${miles[miles.length - 1]} miles`)
  })

  it('the live window, and the live figure quoted in the help is the one the cell renders', () => {
    expect(TARGETS).toContain(`last ${SWEEP_DAYS} days`)
    expect(TARGETS).toContain(`"${copy.reportedFull(12).text}"`)
    expect(copy.reportedFull(12).text).not.toContain('%')
  })

  it('the probability label quoted in the help is the one the header renders', () => {
    expect(TARGETS).toContain(`"${copy.probabilityLabel('Alameda, CA', [1900, 2026], copy.YEAR_ROUND)}"`)
  })

  it('the example file name is one the import accepts, for the county it names', () => {
    const m = TARGETS.match(/`(ebird_[^`]+_barchart\.txt)`/)
    expect(m).not.toBeNull()
    expect(parseBarChartFilename(m![1])).toEqual({ regionCode: 'US-CA-001', years: [1900, 2026], months: [1, 12], malformedCode: false })
  })

  it('the six sorts the help lists are the six the control offers', () => {
    expect(SORT_ORDER).toEqual(['freq-month', 'freq-year', 'live-days', 'distance', 'alpha', 'taxonomic'])
    for (const phrase of ['eBird frequency this month', 'eBird frequency year-round', 'days reported in the last 30', 'distance to the last report', 'alphabetically', "eBird's taxonomic order"]) {
      expect(TARGETS, phrase).toContain(phrase)
    }
  })
})

// ---- behaviour behind the help's claims (CONTENT rows) ----------------------

function obs(commonName: string, breedingCode: string | null = null): ObservationEntry {
  return {
    submissionId: 'S1', commonName, scientificName: `${commonName} sci`, date: '2026-05-01',
    location: 'X', locationId: 'L1', latitude: 1, longitude: 1, county: 'Alameda', count: 1,
    breedingCode, speciesComments: '', catalogIds: [], stateProvince: 'US-CA',
  }
}
function ml(commonName: string, format: 'Photo' | 'Audio' | 'Video'): MLExportRow {
  return { catalogId: '1', commonName, scientificName: '', format } as unknown as MLExportRow
}

describe('what the help says is true of the shipped logic', () => {
  it('"F and H count as codes": a species with only F or H is not a Breeding target', () => {
    expect(TARGETS).toContain('F and H count as codes')
    const pool = [{ speciesCode: 'amerob', commonName: 'American Robin' }, { speciesCode: 'sonspa', commonName: 'Song Sparrow' }]
    const record = buildTargetsRecord([obs('American Robin', 'F'), obs('Song Sparrow', 'H')], null, null)
    for (const c of classifyPool(pool, record)) expect(isBreedingTarget(c, 'any'), c.commonName).toBe(false)
  })

  it('"a photo of Dark-eyed Junco (Oregon) counts as a photo of Dark-eyed Junco"', () => {
    expect(TARGETS).toContain('a photo of "Dark-eyed Junco (Oregon)" counts as a photo of Dark-eyed Junco')
    const record = buildTargetsRecord([obs('Dark-eyed Junco')], [ml('Dark-eyed Junco (Oregon)', 'Photo')], null)
    const [junco] = classifyPool([{ speciesCode: 'daejun', commonName: 'Dark-eyed Junco' }], record)
    expect(junco.missingMedia).not.toContain('Photo')
    // Selecting the Photo chip does not list it: the form's photo counts.
    expect(isMediaTarget(junco, new Set(['Photo'] as const))).toBe(false)
  })

  it('"not part of iCloud Sync": the synced slots are the two data files and nothing else', () => {
    expect(TARGETS).toContain('is not part of iCloud Sync')
    expect([...SLOTS]).toEqual(['ebird', 'ml'])
  })

  it('"a lifer is never a Media or Breeding target"', () => {
    expect(TARGETS).toContain('A lifer is never a Media or Breeding target')
    const record = buildTargetsRecord([obs('Song Sparrow')], [], null)
    const [lifer] = classifyPool([{ speciesCode: 'amerob', commonName: 'American Robin' }], record)
    expect(lifer.lifer).toBe(true)
    expect(isBreedingTarget(lifer, 'any')).toBe(false)
    expect(isMediaTarget(lifer, new Set())).toBe(false)
  })
})

// PRIVACY_POLICY.md is edited only after the user reads and approves the text
// (FR-61; pipeline/targets-tab/copy-proposals.md). Its rows land with it.
describe('PRIVACY_POLICY.md (FR-61)', () => {
  it.todo('names the per-day county query and the device-only, unsynced bar-chart file (lands with the approved text)')
})

describe('house copy rules over the passage', () => {
  const OFFLINE = HELP.split('\n').find(l => l.startsWith('- **Targets live counts**')) ?? ''

  it('the offline bullet exists and names what needs a connection and a key', () => {
    expect(OFFLINE).toContain('need a connection and your eBird API key')
    expect(OFFLINE).toContain('never need a connection')
  })

  it('no em dash anywhere in either', () => {
    expect(TARGETS).not.toContain('—')
    expect(OFFLINE).not.toContain('—')
  })
})
