// @vitest-environment jsdom
//
// THE ONE ROSTER OVER EVERY `SpeciesCombobox` CALL SITE (species-picker-options-memo).
//
// `SpeciesCombobox` filters and builds its rows in two `useMemo`s keyed on the
// `options` array it is handed. `useMemo` compares with `Object.is` and `.map()`
// returns a new array every call, so a call site that builds `options` inline
// misses BOTH memos on EVERY parent render -- certain, not probabilistic. Three
// of the four shipped call sites did exactly that, and the third was one level
// up: `BirdingStats`' `sciFor` was a plain body function, so it took a fresh
// identity per render and defeated `WeatherStatsSection`'s OWN `speciesOptions`
// memo before the combobox ever saw the array.
//
// WHAT THIS FILE ASSERTS, in three parts:
//
//   A. A SOURCE-DERIVED roster of every shipped importer of the component, with
//      CARDINALITY. This is the half that makes a FIFTH call site arrive as a
//      missing row rather than as nothing at all: the four behavioural rows
//      below can only ever see the sites they name.
//   B. One behavioural row per call site, each carrying ITS OWN in-app
//      re-trigger (v1.0.14: a roster that assumes a shared re-trigger leaves
//      rows passing by never reaching the code they exist to test). Two legs:
//      the `options` array is the SAME REFERENCE across an unrelated parent
//      re-render, and with a query typed that re-render adds ZERO
//      `matchesSpeciesQuery` calls where it previously added N.
//   C. A guard-the-guard: memoizing into STALENESS must go red. Today's defect
//      is merely wasteful; a stale options list shows the user the wrong
//      species, which is strictly worse. Without part C this file would pass a
//      memo that never updates at all.
//
// WORK DONE, NEVER ELAPSED TIME. Both legs count operations (array identity,
// predicate calls). This deliberately does NOT extend `speciesUtilsMemoBound`'s
// timing shape, which is only judgeable on a quiet machine
// (`.claude/rules/testing.md`): a reference the hardware cannot move is the
// whole point, and a re-render that adds exactly zero calls is such a reference.
//
// WHAT IT CANNOT SEE: anything geometric, and the actual cost of the rebuild.
// The claim here is the SHAPE of the work, which is what a regression would
// change. It also does NOT discriminate Species Detail's second dependency
// (`sciNameMap`): removing it leaves all twelve rows green, because that map and
// the list named in the first dependency are rebuilt by one shared memo, so
// neither can move without the other. Measured rather than assumed, and the
// reasoning is recorded at the definition site instead of being left here as a
// caution.

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'
import type { SpeciesComboboxOption } from './SpeciesCombobox'

// ── Recorders (hoisted so the mock factories below can close over them) ──────

const { seen, match } = vi.hoisted(() => ({
  /** picker aria-label -> every `options` reference that picker has rendered with. */
  seen: new Map<string, unknown[]>(),
  /** `matchesSpeciesQuery` invocations, across every picker. */
  match: { calls: 0 },
}))

function refsFor(label: string): unknown[] {
  return seen.get(label) ?? []
}
function latestOptions(label: string): unknown {
  const refs = refsFor(label)
  return refs[refs.length - 1]
}

// The REAL component, wrapped only to record the `options` identity it receives.
// Wrapping rather than replacing is load-bearing: the real `filtered` / `rows`
// memos have to run, because leg 2 counts the predicate calls they make.
vi.mock('./SpeciesCombobox', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./SpeciesCombobox')>()
  const { createElement } = await import('react')
  return {
    ...mod,
    SpeciesCombobox: (props: React.ComponentProps<typeof mod.SpeciesCombobox>) => {
      const prior = seen.get(props.ariaLabel) ?? []
      prior.push(props.options)
      seen.set(props.ariaLabel, prior)
      return createElement(mod.SpeciesCombobox, props)
    },
  }
})

// The predicate, counted. The real one still runs, so filtering behaviour is
// untouched and a row that asserts on the rendered list stays honest.
vi.mock('../lib/speciesMatch', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/speciesMatch')>()
  return {
    ...mod,
    matchesSpeciesQuery: (o: { name: string; sciName?: string }, q: string) => {
      match.calls++
      return mod.matchesSpeciesQuery(o, q)
    },
  }
})

// ── Fixture ──────────────────────────────────────────────────────────────────
//
// One export that satisfies all four parents at once: coordinates and a county
// for the Map Explorer's geography, breeding codes so `BirdingStats`' breeding
// filter (this row's re-trigger) renders its pills at all, and SIX checklists
// carrying real weather blocks -- `weatherSectionState` returns 'absent' below
// one readable block and 'below-floor' under five, and the Weather section
// renders no picker in either. The blocks are built by calling the REAL
// formatter rather than pasted, per this repo's fixture rule.

import { formatWeather } from '../lib/weatherFormatter'
import type { HourlyResponse } from '../lib/weatherFormatter'

const TZ = 'America/Los_Angeles'
function weatherBlock(temp: number): string {
  const hourly: HourlyResponse = {
    data: [{
      dt: 1716570000, temp, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
      clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
      sunrise: 1716550000, sunset: 1716600000,
    }],
  }
  return formatWeather([hourly], TZ, 33.7)
}

/** Four species, two of which match the query "jay" -- so a filtered list is a
 *  real subset and a row asserting on it cannot pass vacuously. */
const SPECIES: { name: string; sci: string }[] = [
  { name: 'American Robin', sci: 'Turdus migratorius' },
  { name: 'Blue Jay', sci: 'Cyanocitta cristata' },
  { name: "Steller's Jay", sci: 'Cyanocitta stelleri' },
  { name: 'Varied Thrush', sci: 'Ixoreus naevius' },
]

const OBS: ObservationEntry[] = Array.from({ length: 6 }, (_, i) => i).flatMap(i =>
  SPECIES.map((s, j): ObservationEntry => ({
    submissionId: `S${i + 1}`,
    commonName: s.name,
    scientificName: s.sci,
    date: `2026-0${(i % 6) + 1}-1${j}`,
    location: `Site ${i + 1}`,
    locationId: `L${i + 1}`,
    latitude: 37.9 + i * 0.01,
    longitude: -122.24 + j * 0.01,
    county: i % 2 === 0 ? 'Alameda' : 'Marin',
    count: 1,
    // A breeding code on some rows so the Breeding Stats card renders its tier
    // pills; with `breedingStats.total === 0` it renders a sentence and no
    // control, and this row's re-trigger would not exist.
    breedingCode: j === 0 ? 'C' : null,
    speciesComments: '',
    catalogIds: [],
    stateProvince: 'US-CA',
    time: '07:00 AM',
    duration: 60,
    distance: 1,
    area: null,
    protocol: 'Traveling',
    numObservers: 1,
    allObsReported: true,
    checklistComments: weatherBlock(60 + i),
  })),
)

// A form eBird does not count, on one checklist. It is FILTERED OUT of Species
// Detail's list by default and revealed by "Show all forms", which is what lets
// part C prove the options CONTENT is re-derived rather than only that its
// identity moved. Without a name the toggle can actually add, part C would
// assert a rebuild of an identical list -- true, and much weaker.
const NON_COUNTABLE = 'gull sp.'
OBS.push({
  ...OBS[0],
  commonName: NON_COUNTABLE,
  scientificName: 'Larus sp.',
  breedingCode: null,
})

// The export the mocked loader returns, swappable so a row can drive the app's
// REAL reload path: Settings bumps `filesVersion` after an upload and the tab
// re-reads (`Calendar.tsx:819`). `beforeEach` resets it, so only the row that
// opts in ever sees the second backup.
let CURRENT_EXPORT: ObservationEntry[] = OBS
const NEW_SPECIES = 'Pine Siskin'
const OBS_PLUS: ObservationEntry[] = [
  ...OBS,
  { ...OBS[0], commonName: NEW_SPECIES, scientificName: 'Spinus pinus', breedingCode: null },
]

// ── Mocks: everything below these tabs (maplibre, disk, network) ─────────────

vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock('./SightingsMap', () => ({ SightingsMap: () => <div data-testid="sightings-map-stub" /> }))
vi.mock('./AtlasLayer', () => ({ AtlasLayer: () => null }))
vi.mock('./map/CountyLayer', () => ({ CountyLayer: () => null }))
vi.mock('./map/SightingMarkers', () => ({ SightingMarkers: () => null }))
vi.mock('./map/HotspotMarkers', () => ({ HotspotMarkers: () => null }))
vi.mock('./map/TargetMarkers', () => ({ TargetMarkers: () => null }))
vi.mock('./map/NearbyLiferMarkers', () => ({ NearbyLiferMarkers: () => null }))
vi.mock('./map/BasemapDesaturation', () => ({ BasemapDesaturation: () => null }))
vi.mock('./map/SharePin', () => ({ SharePin: () => null }))
vi.mock('./map/SharePopup', () => ({ SharePopup: () => null }))
vi.mock('./map/MapControls', () => ({
  MapEffects: () => null, BoundsTracker: () => null, DetectedLocationPin: () => null,
  CenterPinDropper: () => null, CenterPin: () => null,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  useMap: () => ({ current: undefined }),
}))
// The real hook returns `{ set, isHotspot }`; both Species Detail and
// Statistics destructure `isHotspot` and call it while rendering location rows,
// so a stub offering only the module-level `isPublicHotspot` name crashes both.
vi.mock('../lib/useHotspotSet', () => ({
  useHotspotSet: () => ({ set: new Set<string>(), isHotspot: () => false }),
}))
vi.mock('../lib/useCountyCompleteness', () => ({
  useCountyCompleteness: () => ({
    summaryFor: () => null, resultFor: () => null,
    onViewportCounties: () => {}, requestCounty: () => {},
  }),
  EBIRD_NO_KEY_MESSAGE: 'no key',
}))
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({ ebird: { filename: 'ebird.csv', uploadedAt: '2026-06-01' }, ml: null })),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    readFile: vi.fn(async () => null),
    getApiKey: vi.fn(async () => null),
  },
}))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: CURRENT_EXPORT })),
}))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../lib/transport', () => ({
  transport: {
    get: vi.fn(async () => ({ species: [] })),
    post: vi.fn(async (path: string) =>
      path === '/taxonomy/codes' ? { codes: {}, orders: {}, formCodes: {} } : {}),
  },
  TransportError: class extends Error {},
}))

import { Calendar } from './Calendar'
import { SpeciesDetail } from './SpeciesDetail'
import { MapExplorer } from './MapExplorer'
import { BirdingStats } from './BirdingStats'

beforeEach(() => {
  seen.clear()
  match.calls = 0
  CURRENT_EXPORT = OBS
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// recharts bundles @reduxjs/toolkit, whose autoBatch enhancer arms a 100 ms
// fallback timer when a chart mounts. Statistics and Species Detail both mount
// charts here, so drain it before this file's jsdom environment is torn down.
afterAll(() => new Promise((r) => setTimeout(r, 120)))

// ── Part A: the source-derived roster ────────────────────────────────────────

/** Source with commented-out lines dropped -- whole-line `//`, and any line a
 *  `/*` block opens or continues. A guard about "which call sites exist" must
 *  not be satisfiable by a call site that no longer compiles, and this file's
 *  own header describes the very `.map(` shape it bans. Line-based on purpose:
 *  it cannot damage a `//` inside a string on a code line, and it fails in the
 *  SAFE direction (a line wrongly dropped makes an assertion go red, which is
 *  loud). Same helper shape as `cacheInventory.test.ts`. */
function stripComments(src: string): string {
  const out: string[] = []
  let inBlock = false
  for (const line of src.split('\n')) {
    const t = line.trim()
    if (inBlock) {
      if (t.includes('*/')) inBlock = false
      continue
    }
    if (t.startsWith('//')) continue
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) inBlock = true
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/** src/, as an absolute path. */
const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Every shipped `.tsx` under src/ (tests excluded), relative to src/. Derived
 *  from the tree rather than named in advance: naming the files is exactly the
 *  assumption this roster exists to remove. */
function shippedTsx(): string[] {
  const found: string[] = []
  const walk = (abs: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name)
      if (entry.isDirectory()) { walk(child); continue }
      if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue
      if (/\.test\.tsx$/.test(entry.name)) continue
      found.push(relative(SRC_DIR, child))
    }
  }
  walk(SRC_DIR)
  return found.sort()
}

/** The call sites: every shipped file that RENDERS `<SpeciesCombobox`.
 *
 *  Paths are resolved through `fileURLToPath` and joined with `node:path`
 *  rather than by `new URL('../…', import.meta.url)`: under vitest that form
 *  produced a Dirent whose `name` read `undefined` and sent the walk at
 *  `src/components/undefined`, which plain node does not reproduce. Absolute
 *  string paths remove the ambiguity. */
function callSites(): string[] {
  return shippedTsx().filter(rel => {
    if (rel === join('components', 'SpeciesCombobox.tsx')) return false
    const src = stripComments(readFileSync(join(SRC_DIR, rel), 'utf8'))
    return src.includes('<SpeciesCombobox')
  })
}

/** Each `<SpeciesCombobox …>` opening tag in a file, as source text.
 *
 *  SCOPED TO THE TAG, and that is the whole point rather than a nicety: a
 *  file-wide `options=\{…\}` scan matched the Calendar's `SegControl`
 *  (`options={[{ value: 'species', … }]}`) and reported the wrong element's
 *  prop, which is this repo's standing warning about a guard's own matching
 *  logic arriving in practice. The walk tracks brace depth so an `options` prop
 *  containing object literals cannot end the tag early, and the character after
 *  the name is checked so a longer component name starting with the same text
 *  can never be collected. */
function comboboxTags(src: string): string[] {
  const tags: string[] = []
  const NAME = '<SpeciesCombobox'
  let i = src.indexOf(NAME)
  while (i !== -1) {
    const next = src[i + NAME.length]
    if (!/[\s/>]/.test(next ?? '')) { i = src.indexOf(NAME, i + NAME.length); continue }
    let depth = 0
    let j = i
    for (; j < src.length; j++) {
      const c = src[j]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) { j++; break }
    }
    tags.push(src.slice(i, j))
    i = src.indexOf(NAME, j)
  }
  return tags
}

/** The text of the `options=` prop at a file's `<SpeciesCombobox` call. */
function optionsProps(rel: string): string[] {
  const src = stripComments(readFileSync(join(SRC_DIR, rel), 'utf8'))
  return comboboxTags(src).map(tag => {
    const k = tag.indexOf('options={')
    if (k === -1) return ''
    const start = k + 'options={'.length
    let depth = 1
    let j = start
    for (; j < tag.length && depth > 0; j++) {
      if (tag[j] === '{') depth++
      else if (tag[j] === '}') depth--
    }
    return tag.slice(start, j - 1).trim()
  })
}

const EXPECTED_SITES = [
  'components/BirdingStats.tsx',        // -> WeatherStatsSection, via the sciFor seam
  'components/Calendar.tsx',
  'components/MapExplorer.tsx',
  'components/SpeciesDetail.tsx',
  'components/WeatherStatsSection.tsx',
].sort()

describe('A. the roster of call sites is derived from the tree, with cardinality', () => {
  it('names every shipped file that renders a SpeciesCombobox', () => {
    // `BirdingStats` does not render the component itself -- it owns the
    // `sciFor` that feeds `WeatherStatsSection`'s options memo -- so it is a
    // behavioural row below without being a JSX call site here.
    const sites = callSites()
    expect(sites).toEqual(EXPECTED_SITES.filter(s => s !== 'components/BirdingStats.tsx'))
    // Cardinality, not membership: a fifth site added beside a rostered one must
    // fail rather than be absorbed silently.
    expect(sites.length).toBe(4)
  })

  it('no call site builds its options inline (the structural form of the defect)', () => {
    // The exact shape this build removed: `options={xs.map(...)}` is a fresh
    // array per render and defeats both memos with certainty. Structural, so it
    // cannot flake, and it reaches MapExplorer -- which was already clean and is
    // a roster row rather than a fix.
    for (const site of callSites()) {
      for (const prop of optionsProps(site)) {
        expect(`${site}: ${prop}`).not.toMatch(/\.map\(/)
        // A bare identifier is what a memoized value looks like at the call site.
        expect(prop).toMatch(/^[A-Za-z_$][\w$]*$/)
      }
    }
  })

  it('the scan is non-vacuous (it really found the option props it checked)', () => {
    const props = callSites().flatMap(optionsProps)
    expect(props.length).toBeGreaterThanOrEqual(4)
  })
})

// ── Part B: one behavioural row per call site ────────────────────────────────

/** Type a query into a picker and return the predicate-call count it cost.
 *  Non-vacuity is the caller's job: a re-render adding "zero" calls proves
 *  nothing unless typing the query cost more than zero in the first place. */
function typeQuery(label: string, query: string): number {
  const input = screen.getByRole('combobox', { name: label }) as HTMLInputElement
  fireEvent.focus(input)
  const before = match.calls
  fireEvent.change(input, { target: { value: query } })
  return match.calls - before
}

describe('B1. Calendar', () => {
  async function mount() {
    const utils = render(<Calendar onGoToSettings={() => {}} filesVersion={0} />)
    await screen.findByRole('combobox', { name: 'Filter the calendar to one species' })
    return utils
  }
  /** The day-metric SegControl: re-renders the whole tab and cannot touch the
   *  species list, which is derived from the observations alone. */
  function retrigger() {
    fireEvent.click(screen.getByRole('button', { name: 'Checklists' }))
  }
  const LABEL = 'Filter the calendar to one species'

  it('keeps one options identity across an unrelated re-render', async () => {
    await mount()
    const before = latestOptions(LABEL)
    expect(before).toBeTruthy()
    retrigger()
    expect(latestOptions(LABEL)).toBe(before)
  })

  it('adds zero match calls across that re-render, with a query typed', async () => {
    await mount()
    const typing = typeQuery(LABEL, 'jay')
    expect(typing).toBeGreaterThan(0)      // non-vacuity: the predicate really ran
    const after = match.calls
    retrigger()
    expect(match.calls - after).toBe(0)
  })

  // THE STALENESS LEG FOR THIS SITE, and it is NAMED rather than incidental.
  //
  // For one round Calendar had no such row. A frozen memo still went red, but
  // only through the `typing > 0` non-vacuity assertion above -- a frozen list
  // is empty, so typing costs zero matches. That is coverage by SIDE EFFECT:
  // the line that carried it is documented as checking something else, so
  // anyone tidying it gets no signal they are deleting staleness coverage.
  // Measured rather than argued -- freezing the memo AND relaxing that one
  // assertion to `toBeGreaterThanOrEqual(0)` turned the entire guard green over
  // a permanently empty, permanently stale picker. The identity row above stays
  // green under a frozen memo too, because a frozen memo trivially keeps one
  // identity, which is the exact inversion this file's header says the
  // staleness rows exist to prevent.
  //
  // The re-trigger is the app's REAL reload path, not a synthetic one: a new
  // export arrives and `filesVersion` bumps, which is what Settings does after
  // an upload.
  it('a new export rebuilds the options (the staleness leg this site owns)', async () => {
    const { rerender } = await mount()
    const before = latestOptions(LABEL) as SpeciesComboboxOption[]
    const namesBefore = before.map(o => o.name)
    expect(namesBefore.length).toBeGreaterThan(0)
    expect(namesBefore).not.toContain(NEW_SPECIES)

    CURRENT_EXPORT = OBS_PLUS
    rerender(<Calendar onGoToSettings={() => {}} filesVersion={1} />)
    await waitFor(() =>
      expect((latestOptions(LABEL) as SpeciesComboboxOption[]).map(o => o.name)).toContain(NEW_SPECIES))

    const after = latestOptions(LABEL) as SpeciesComboboxOption[]
    expect(after).not.toBe(before)
    expect(after.length).toBe(before.length + 1)
  })
})

describe('B2. Species Detail', () => {
  const LABEL = 'Select species'
  async function mount() {
    render(
      <SpeciesDetail
        onGoToSettings={() => {}}
        onGoToWeather={() => {}}
        filesVersion={0}
        embedAllowed={false}
      />,
    )
    await screen.findByRole('combobox', { name: LABEL })
    await waitFor(() => expect(latestOptions(LABEL)).toBeTruthy())
  }
  /** The comment filter: the brief's own example of why this site matters --
   *  it re-renders the tab on EVERY keystroke and has nothing to do with the
   *  species list. It lives behind a selection, so select first. */
  async function selectSpecies() {
    const input = screen.getByRole('combobox', { name: LABEL })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'American Robin' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByRole('textbox', { name: 'Filter comments' })
  }
  function retrigger() {
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter comments' }), { target: { value: 'x' } })
  }

  it('keeps one options identity across an unrelated re-render', async () => {
    await mount()
    await selectSpecies()
    const before = latestOptions(LABEL)
    expect(before).toBeTruthy()
    retrigger()
    expect(latestOptions(LABEL)).toBe(before)
  })

  it('adds zero match calls across that re-render, with a query typed', async () => {
    await mount()
    await selectSpecies()
    const typing = typeQuery(LABEL, 'jay')
    expect(typing).toBeGreaterThan(0)
    const after = match.calls
    retrigger()
    expect(match.calls - after).toBe(0)
  })
})

describe('B3. Map Explorer (already clean -- a roster row, not a fix)', () => {
  const LABEL = 'Species'
  async function mount() {
    render(
      <MapExplorer
        onGoToSettings={() => {}}
        onNavigateToMediaList={() => {}}
        keysVersion={0}
        isFullscreen={false}
        onToggleFullscreen={() => {}}
        onOpenSpecies={() => {}}
      />,
    )
    await screen.findByRole('combobox', { name: LABEL })
    await waitFor(() => expect(latestOptions(LABEL)).toBeTruthy())
  }
  /** The County select, beside the picker in the same panel. */
  function retrigger() {
    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: 'Marin' } })
  }

  it('keeps one options identity across an unrelated re-render', async () => {
    await mount()
    const before = latestOptions(LABEL)
    expect(before).toBeTruthy()
    retrigger()
    expect(latestOptions(LABEL)).toBe(before)
  })

  it('adds zero match calls across that re-render, with a query typed', async () => {
    await mount()
    const typing = typeQuery(LABEL, 'jay')
    expect(typing).toBeGreaterThan(0)
    const after = match.calls
    retrigger()
    expect(match.calls - after).toBe(0)
  })
})

describe('B4. Statistics -> WeatherStatsSection (the sciFor seam)', () => {
  const LABEL = 'Filter by species'

  /** Statistics gates its sections behind a double-rAF `computed` flip and
   *  mounts its map on an idle callback, so both are stubbed into flushable
   *  queues -- the harness `BirdingStats.test.tsx` documents. Stubbed per-test
   *  rather than file-wide: the other three rows use the real rAF. */
  async function mount() {
    const rafQueue: FrameRequestCallback[] = []
    const idleQueue: Array<() => void> = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafQueue.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => idleQueue.push(cb))
    vi.stubGlobal('cancelIdleCallback', () => {})

    render(<BirdingStats onGoToSettings={() => {}} onGoToWeather={() => {}} onOpenSpecies={() => {}} />)
    await waitFor(() => expect(screen.getByText('Statistics')).toBeTruthy())
    // Commit-vs-effect race: wait on the stub queue itself, never a sleep.
    await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))
    const flush = () => { const batch = rafQueue.splice(0); for (const cb of batch) cb(performance.now()) }
    await act(async () => { flush() })
    await act(async () => { flush() })
    await screen.findByRole('combobox', { name: LABEL })
  }
  /** The breeding-tier filter: display-only state on Statistics. Deliberately
   *  NOT the granularity or forms toggles, which are `useStatsBundle` INPUTS --
   *  those recompute the bundle, so `stats.species.names` genuinely changes and
   *  the options SHOULD be rebuilt. A re-trigger has to be unrelated to be
   *  evidence. */
  function retrigger() {
    fireEvent.click(screen.getByRole('button', { name: 'Probable' }))
  }

  it('keeps one options identity across an unrelated re-render', async () => {
    await mount()
    const before = latestOptions(LABEL)
    expect(before).toBeTruthy()
    retrigger()
    expect(latestOptions(LABEL)).toBe(before)
  })

  it('adds zero match calls across that re-render, with a query typed', async () => {
    await mount()
    const typing = typeQuery(LABEL, 'jay')
    expect(typing).toBeGreaterThan(0)
    const after = match.calls
    retrigger()
    expect(match.calls - after).toBe(0)
  })

  // THE STALENESS LEG FOR THIS SITE. Part C below guards the same direction at
  // Species Detail, and for one round that was the ONLY site where the staleness
  // mutation was ever run -- so freezing `sciFor` on `[]` turned nothing red
  // here, nor in any of the 141 pre-existing tests that touch these components.
  // The per-site behavioural rows above made the coverage look symmetric while
  // the mutation that matters was applied at one site in three.
  //
  // Frozen on `[]`, `sciFor` captures the first render's `sciByNorm`, which is
  // empty during load, so every option's `sciName` is `undefined` for the life
  // of the session and the Weather picker silently stops matching on scientific
  // name. Nothing about the NAMES changes, which is why every name-based row
  // stays green through it -- the last assertion is the one with teeth.
  //
  // The re-trigger here is deliberately a `useStatsBundle` INPUT, the opposite
  // of this block's breeding-tier re-trigger above: "Count all forms" genuinely
  // moves `stats.species.names`, so these options MUST rebuild.
  it('a real change to the species list rebuilds the options, and sciFor still resolves', async () => {
    await mount()
    const before = latestOptions(LABEL) as SpeciesComboboxOption[]
    const namesBefore = before.map(o => o.name)
    expect(namesBefore.length).toBeGreaterThan(0)
    expect(namesBefore).not.toContain(NON_COUNTABLE)

    fireEvent.click(screen.getByRole('checkbox', { name: /Count all forms/ }))
    await waitFor(() =>
      expect((latestOptions(LABEL) as SpeciesComboboxOption[]).map(o => o.name)).not.toEqual(namesBefore))

    const after = latestOptions(LABEL) as SpeciesComboboxOption[]
    expect(after).not.toBe(before)
    expect(after.map(o => o.name)).toContain(NON_COUNTABLE)
    // The frozen-`sciFor` detector: names alone cannot see it.
    expect(after.find(o => o.name === 'Blue Jay')?.sciName).toBe('Cyanocitta cristata')
  })
})

// ── Part C: guard the guard ──────────────────────────────────────────────────

describe('C. memoizing into staleness must go red', () => {
  // Every row above rewards a memo for NOT rebuilding. A memo that never
  // rebuilds would pass all eight of them and show the user a species list that
  // no longer matches their filters -- a real defect where today's is only
  // waste. This is the leg that separates the two.
  //
  // Driven on Species Detail because "Show all forms" widens its list in place,
  // without reloading anything.
  //
  // AN EARLIER VERSION OF THIS COMMENT CLAIMED the Calendar's and the Map
  // Explorer's lists are "functions of the loaded export alone, so nothing short
  // of a new file moves them," and used that to justify having no staleness row
  // at those sites. The second half is false and the conclusion did real damage:
  // a new file IS drivable -- the mocked loader plus a `filesVersion` bump is
  // the app's own reload path (`Calendar.tsx:819`), which is what Settings does
  // after an upload. Calendar now owns a named staleness row in B1 that drives
  // exactly that, and Statistics owns one in B4. Left standing, the sentence
  // told the next reader not to bother.
  //
  // Map Explorer remains without one, and that is a scope statement rather than
  // a claim about what is drivable: it is the site this build did not change.
  it('a real change to the species list rebuilds the options AND the rendered rows', async () => {
    const LABEL = 'Select species'
    render(
      <SpeciesDetail
        onGoToSettings={() => {}}
        onGoToWeather={() => {}}
        filesVersion={0}
        embedAllowed={false}
      />,
    )
    await screen.findByRole('combobox', { name: LABEL })
    await waitFor(() => expect(latestOptions(LABEL)).toBeTruthy())

    const before = latestOptions(LABEL) as SpeciesComboboxOption[]
    const namesBefore = before.map(o => o.name)
    expect(namesBefore.length).toBeGreaterThan(0)
    expect(namesBefore).not.toContain(NON_COUNTABLE)

    // A genuine input change: "Show all forms" widens the list to include forms
    // eBird does not count, so both the identity AND the content must move.
    fireEvent.click(screen.getByRole('switch', { name: /Show all forms/ }))

    const after = latestOptions(LABEL) as SpeciesComboboxOption[]
    expect(after).not.toBe(before)                                  // identity MUST move
    expect(after.map(o => o.name)).toContain(NON_COUNTABLE)         // content re-derived
    expect(after.length).toBe(before.length + 1)

    // And the predicate re-runs over the new array rather than serving a cached
    // answer: type, and the filter must actually do work again.
    const cost = typeQuery(LABEL, 'jay')
    expect(cost).toBeGreaterThan(0)
  })
})
