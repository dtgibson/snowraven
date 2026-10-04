/// <reference types="node" />
// The published claims about First of Year (species-first-of-year, FR-26,
// QA-27), pinned to the code that makes them true. Scoped to the feature's OWN
// passage in `docs/HELP.md`, the "- First of Year:" bullet in the Species
// Detail section, with a non-vacuity leg per claim, so deleting the sentence or
// a clause of it goes red (.claude/rules/docs-and-website.md). README.md and
// website/index.html carry nothing about it: no held copy was proposed.
//
// Each claim and what holds it:
//   * "one row per calendar year": the derivation, run on a fixture holding
//     several rows a year (below); the section renders one list item per row
//     (FirstOfYearSection.test.tsx).
//   * "each date opening its eBird checklist": every row's date renders
//     through ChecklistLink (source scan below; the section test clicks one).
//   * "from two years on a small chart": the section's gate reads
//     FOY_CHART_MIN_ROWS, and the word in the bullet is built from it.
//   * "follows Show subspecies and the county and date filters": the tab's one
//     memo derives from `speciesObs` and nothing else, and `speciesObs` is the
//     merge plus the county and date filters (source scan below;
//     SpeciesDetailFirstOfYear.test.tsx drives each one).
//   * "reads only your loaded export": the feature's modules import no
//     transport, storage or Tauri seam and call no fetch (source scan below).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ObservationEntry } from '../types'
import { computeFirstOfYear } from './firstOfYear'
import { FOY_CHART_MIN_ROWS } from './firstOfYearChartGeometry'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
/** Comments stripped, so a guard never passes on a commented-out line. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const HELP = read('docs/HELP.md')

function speciesDetailSection(): string {
  const start = HELP.indexOf('\n## Species Detail\n')
  expect(start, 'docs/HELP.md has a Species Detail section').toBeGreaterThan(-1)
  const next = HELP.indexOf('\n## ', start + 1)
  return HELP.slice(start, next === -1 ? undefined : next)
}

const SECTION = speciesDetailSection()
const bulletLines = SECTION.split('\n').filter(l => l.startsWith('- '))
const BULLET = bulletLines.find(l => l.startsWith('- First of Year:')) ?? ''

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five']

describe('docs/HELP.md, the First of Year bullet', () => {
  it('exists once, in the Species Detail section list, between Media and Subspecies and Forms', () => {
    expect(BULLET, 'the bullet exists').not.toBe('')
    expect(bulletLines.filter(l => l.startsWith('- First of Year:'))).toHaveLength(1)
    const at = bulletLines.indexOf(BULLET)
    expect(bulletLines[at - 1]).toMatch(/^- Media: /)
    expect(bulletLines[at + 1]).toMatch(/^- Subspecies and Forms: /)
    // The whole file carries it once: no stray copy elsewhere.
    expect(HELP.split('- First of Year:')).toHaveLength(2)
  })

  it('"one row per calendar year" holds: the derivation gives one row a year', () => {
    expect(BULLET).toMatch(/one row per calendar year with the first date you reported the species that year/)
    const o = (date: string, submissionId: string): ObservationEntry => ({
      submissionId, commonName: 'Osprey', scientificName: 'Pandion haliaetus', date, location: 'Lake',
      locationId: 'L1', latitude: null, longitude: null, county: null, count: 1, breedingCode: null,
      speciesComments: '', catalogIds: [],
    })
    const rows = computeFirstOfYear([
      o('2024-04-02', 'S1'), o('2024-03-21', 'S2'), o('2025-03-30', 'S3'), o('2025-08-01', 'S4'), o('2026-03-18', 'S5'),
    ])
    expect(rows.map(r => [r.year, r.date])).toEqual([[2024, '2024-03-21'], [2025, '2025-03-30'], [2026, '2026-03-18']])
  })

  it('"each date opening its eBird checklist" holds: every row\'s date is a ChecklistLink', () => {
    expect(BULLET).toMatch(/each date opening its eBird checklist/)
    const section = code('frontend/src/components/speciesDetail/FirstOfYearSection.tsx')
    // The raw date fills the label where formatDate leaves it empty (a year-0000 date).
    expect(section).toMatch(/<ChecklistLink submissionId=\{r\.submissionId\} label=\{formatDate\(r\.date\) \|\| r\.date\}/)
  })

  it('"from two years on a small chart" holds, with the number built from the section\'s own constant', () => {
    const word = NUMBER_WORDS[FOY_CHART_MIN_ROWS]
    expect(BULLET).toMatch(new RegExp(`from ${word} years on a small chart of those first dates by day of year`))
    const section = code('frontend/src/components/speciesDetail/FirstOfYearSection.tsx')
    expect(section).toMatch(/rows\.length >= FOY_CHART_MIN_ROWS \? buildFirstOfYearChartData\(rows\) : null/)
  })

  it('"follows Show subspecies and the county and date filters" holds: one memo over the filtered set', () => {
    expect(BULLET).toMatch(/It follows Show subspecies and the county and date filters/)
    const tab = code('frontend/src/components/SpeciesDetail.tsx')
    expect(tab).toMatch(/const firstOfYear = useMemo\(\(\) => computeFirstOfYear\(speciesObs\), \[speciesObs\]\)/)
    expect(tab).toMatch(/<FirstOfYearSection rows=\{firstOfYear\}/)
    // speciesObs is the merge, then the county and the date range.
    const memo = tab.slice(tab.indexOf('const speciesObs = useMemo('), tab.indexOf('const baseChecklistCount'))
    expect(memo).toMatch(/countyFilter !== null && o\.county !== countyFilter/)
    expect(memo).toMatch(/dateRange\.from && o\.date < dateRange\.from/)
    expect(memo).toMatch(/dateRange\.to && o\.date > dateRange\.to/)
    const base = tab.slice(tab.indexOf('const baseSpeciesObs = useMemo('), tab.indexOf('const speciesObs = useMemo('))
    expect(base).toMatch(/mergeSubspecies\s*\?\s*phase\.observations\.filter\(o => normalizeSpeciesName\(o\.commonName\) === selectedSpecies\)/)
  })

  it('"reads only your loaded export" holds: no transport, storage or Tauri seam, and no fetch', () => {
    expect(BULLET).toMatch(/reads only your loaded export\.$/)
    for (const f of [
      'frontend/src/lib/firstOfYear.ts', 'frontend/src/lib/firstOfYearChartGeometry.ts',
      'frontend/src/components/speciesDetail/FirstOfYearSection.tsx', 'frontend/src/components/speciesDetail/FirstOfYearChart.tsx',
    ]) {
      const src = code(f)
      expect(src, f).not.toMatch(/from '[^']*\/(transport|storage|replayStore|clearDerived)'/)
      expect(src, f).not.toMatch(/from '[^']*\/(tauri|icloud)\//)
      expect(src, f).not.toMatch(/\bfetch\(/)
    }
  })

  it('carries no em dash and no offline or no-network selling point (NFR-05, NFR-06)', () => {
    expect(BULLET).not.toContain('\u2014')
    expect(BULLET).not.toMatch(/offline|network|connection|API key|lookup/i)
    // The heading's claim is qualified by the filters in the same bullet, never
    // stated as "of the year" on its own.
    expect(BULLET).not.toMatch(/of the year/i)
  })
})
