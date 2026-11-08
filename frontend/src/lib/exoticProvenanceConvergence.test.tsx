// @vitest-environment jsdom
//
// exotic-provenance-reuse: the escapee check SETTLES on the measured shape, under
// BOTH storage seams, through the real `storage.ts` (TauriStorage over a mocked
// plugin-fs, WebStorage over a mocked `/settings/{key}` route). Every other
// controller suite mocks `./storage` wholesale; this one exists because the
// claim is about what a later session reads back from disk.
//
// The fixture is the shape measured on the user's real export
// (pipeline/exotic-provenance-reuse/decisions.md D-01): three cover species that
// no eBird answer carries under their own codes. "Willet" (34 carriers, 6 in
// the saved ledger) and "Marsh Wren" (2, both saved) resolve to the 2026
// nominate daughters while eBird answers with the slash codes, and "Eurasian
// Skylark" (1, saved) is simply absent from its answer. The saved ledger is
// older than the TTL, as it was on the real store. Before 1.0.64 every load
// sent 29 requests, forever; with the stamp (1.0.64) the loads went 29, 8, 0,
// 0 and three species stayed open; with the taxonomy join
// (escapee-check-new-taxonomy) the loads go 3, 0, 0, 0, the slash answers
// settle Willet and Marsh Wren on the first, and only the skylark stays open,
// named on the line. Statistics and Life Lists are read side by side, each
// through its own hook and the one join loader.

import { useEffect } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type { ObservationEntry } from '../types'

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

// The web/Pi route: one JSON body per key, as backend/routers/settingskv.py keeps.
const webSettings = new Map<string, string>()
async function webFetch(url: string, init?: { method?: string; body?: string }): Promise<unknown> {
  const key = decodeURIComponent(url.slice('/settings/'.length))
  const method = init?.method ?? 'GET'
  if (method === 'POST') { webSettings.set(key, init?.body ?? 'null'); return { ok: true, status: 200 } }
  if (method === 'DELETE') { webSettings.delete(key); return { ok: true, status: 200 } }
  const body = webSettings.get(key)
  return body === undefined
    ? { ok: false, status: 404, json: async () => null }
    : { ok: true, status: 200, json: async () => JSON.parse(body) }
}

const requested: string[] = []
const answers = new Map<string, Array<{ speciesCode: string; exoticCategory?: string }>>()
vi.mock('./transport', () => ({
  TransportError: class extends Error {},
  transport: {
    get: vi.fn(async (path: string) => {
      requested.push(path)
      await new Promise<void>(r => { setTimeout(r, 1) })
      return { species: answers.get(path.slice('/checklists/'.length)) ?? [] }
    }),
  },
}))

const KEY = 'exotic-provenance-v1'
const DAY = 86_400_000

// The batch's answer for these names (both transports land a pre-split name on
// the nominate daughter by scientific name); "House Swift" resolves to nothing.
const CODES: Record<string, string> = {
  Willet: 'willet2', 'Marsh Wren': 'eamwre1', 'Eurasian Skylark': 'skylar', Mallard: 'mallar3',
  'Great Horned Owl': 'grhowl',
}
const codeFor = (norm: string): string | undefined => (Object.hasOwn(CODES, norm) ? CODES[norm] : undefined)

function row(commonName: string, submissionId: string): ObservationEntry {
  return {
    commonName, scientificName: '', count: 1, submissionId, date: '2025-08-01',
    location: 'L', locationId: 'L1', latitude: null, longitude: null,
    county: null, stateProvince: 'US-CA',
  } as ObservationEntry
}

const WILLET = Array.from({ length: 34 }, (_, i) => `S${1_000_000 + i}`)
const SKYLARK = ['S2000000']
const MARSH_WREN = ['S3000000', 'S3000001']
const SAVED = [...WILLET.slice(0, 6), ...SKYLARK, ...MARSH_WREN]

function measuredShape(): ObservationEntry[] {
  const rows: ObservationEntry[] = []
  for (const id of WILLET) rows.push(row('Willet', id), row('Mallard', id))
  for (const id of SKYLARK) rows.push(row('Eurasian Skylark', id), row('Mallard', id))
  for (const id of MARSH_WREN) rows.push(row('Marsh Wren', id), row('Mallard', id))
  // eBird's answers carry the slash codes for the two split species (outside
  // the cover, so the merge drops them) and nothing at all for the skylark.
  for (const id of WILLET) answers.set(id, [{ speciesCode: 'willet1' }, { speciesCode: 'mallar3' }])
  for (const id of SKYLARK) answers.set(id, [{ speciesCode: 'mallar3' }])
  for (const id of MARSH_WREN) answers.set(id, [{ speciesCode: 'marwre' }, { speciesCode: 'mallar3' }])
  return rows
}

function savedDocument(now: number): unknown {
  const old = now - 40 * DAY
  return {
    version: 1,
    checklists: Object.fromEntries(SAVED.map(id => [id, old])),
    order: SAVED,
    species: { mallar3: { seen: ['|'], n: SAVED.length, at: old } },
    speciesOrder: ['mallar3'],
    excludedNames: [],
    exoticNames: [],
  }
}

/** The document as 1.0.64 to 1.0.66 leave it on this shape: every carrier
 *  asked within the TTL and the three species stamped, under the old join (no
 *  marker), or, for the control, under the current one. */
function settledUnderOldJoin(now: number, marker: number | null): unknown {
  const at = now - DAY
  const all = [...WILLET, ...SKYLARK, ...MARSH_WREN]
  return {
    version: 1,
    checklists: Object.fromEntries(all.map(id => [id, at])),
    order: all,
    species: { mallar3: { seen: ['|'], n: all.length, at } },
    speciesOrder: ['mallar3'],
    excludedNames: [],
    exoticNames: [],
    unmatched: { willet2: at, eamwre1: at, skylar: at },
    unmatchedOrder: ['willet2', 'skylar', 'eamwre1'],
    ...(marker === null ? {} : { unmatchedJoin: marker }),
  }
}

/** One checklist per 2026 shape (exotic-provenance-reuse's fixture has two):
 *  a retired split name answered under the slash that reuses its old code, a
 *  name the split kept answered under a sibling daughter, the Marsh Wren slash,
 *  and a lumped-away name answered under its surviving species. */
function everyShape(houseSwiftAnswered: boolean): ObservationEntry[] {
  const rows = [
    row('Willet', 'S5000001'), row('Mallard', 'S5000001'),
    row('Great Horned Owl', 'S5000002'), row('Mallard', 'S5000002'),
    row('Marsh Wren', 'S5000003'),
    row('House Swift', 'S5000004'),
  ]
  answers.set('S5000001', [{ speciesCode: 'willet1' }, { speciesCode: 'mallar3' }])
  answers.set('S5000002', [{ speciesCode: 'grhowl19' }, { speciesCode: 'mallar3' }])
  answers.set('S5000003', [{ speciesCode: 'marwre' }])
  answers.set('S5000004', houseSwiftAnswered ? [{ speciesCode: 'y00960' }] : [])
  return rows
}

describe.each(['tauri', 'web'] as const)('the measured shape settles under the %s storage seam', (which) => {
  let ctrl: typeof import('./useExoticProvenance')
  let cache: typeof import('./exoticProvenanceCache')
  let copy: typeof import('./exoticCopy')
  let lifeLists: typeof import('./lifeListsProvenance')
  let model: typeof import('./exoticProvenance')
  let join: import('./exoticProvenance').EscapeeJoin
  /** Statistics' cover index: the backup's rows, the batch's codes, the join. */
  const statsIndex = (rows: ObservationEntry[], j = join) => model.buildCoverIndex(rows, codeFor, j)

  const persisted = (): { order: string[]; unmatchedOrder?: string[] } | null => {
    if (which === 'tauri') {
      const file = tauriFiles.get('data/settings.json')
      if (file === undefined) return null
      const settings = JSON.parse(file) as Record<string, unknown>
      return Object.hasOwn(settings, KEY) ? settings[KEY] as { order: string[] } : null
    }
    const body = webSettings.get(KEY)
    return body === undefined ? null : JSON.parse(body) as { order: string[] }
  }

  function seed(doc: unknown): void {
    if (which === 'tauri') tauriFiles.set('data/settings.json', JSON.stringify({ [KEY]: doc }))
    else webSettings.set(KEY, JSON.stringify(doc))
  }

  beforeEach(async () => {
    seam.tauri = which === 'tauri'
    tauriFiles.clear()
    webSettings.clear()
    answers.clear()
    requested.length = 0
    if (which === 'web') vi.stubGlobal('fetch', vi.fn(webFetch))
    // storage.ts picks its adapter when it is first evaluated, so each seam
    // gets its own module graph.
    vi.resetModules()
    cache = await import('./exoticProvenanceCache')
    ctrl = await import('./useExoticProvenance')
    copy = await import('./exoticCopy')
    lifeLists = await import('./lifeListsProvenance')
    model = await import('./exoticProvenance')
    // The production loader, the one both tabs call: the history asset by its
    // dynamic import.
    join = await (await import('./exoticTaxonomyJoin')).loadEscapeeJoin()
    // The pass rides the shared eBird gate (ebird-request-economy D-01). The
    // graph is fresh, so the gate's state is too; its 150 ms spacing seam is
    // zeroed in this graph (the Projects suites' posture), so these rows count
    // requests rather than wait out the floor, which the controller suite's
    // gate rows pin on a fake clock.
    ;(await import('./rateLimit'))._setActivityStartSpacingMsForTests(0)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function Harness({ index }: { index: import('./exoticProvenance').CoverIndex }) {
    const p = ctrl.useExoticProvenance({ active: true, index, hasEbirdKey: true, online: true })
    useEffect(() => { /* keep the controller mounted */ }, [p])
    return (
      <div>
        <span data-testid="kind">{p.status.kind}</span>
        <span data-testid="reason">{p.status.kind === 'partial' ? p.status.reason : ''}</span>
        <span data-testid="sentence">{copy.statusSentence(p.status, p.lookup.excluded.length)}</span>
      </div>
    )
  }

  /** Life Lists' status reader, as the tab mounts it: the backup's own rows
   *  and its codes batch; the hook loads the join itself. */
  function LifeListsHarness({ rows }: { rows: readonly ObservationEntry[] }) {
    const p = lifeLists.useLifeListsProvenance(rows, CODES)
    return <span data-testid="lifelists">{p.checkComplete ? 'complete' : 'open'}</span>
  }

  /** One session: a fresh mirror read from the seam, one mount, the pass's
   *  terminal status, then the document on disk caught up with the mirror,
   *  which is exactly what the next session reads. With `rows`, Life Lists'
   *  reader is mounted beside Statistics and its completion read once the
   *  pass has settled. */
  async function load(
    index: import('./exoticProvenance').CoverIndex,
    rows?: readonly ObservationEntry[],
  ): Promise<{ requests: number; reason: string; kind: string; sentence: string; lifeLists: string }> {
    cache._resetProvenanceCacheForTests()
    const before = requested.length
    const view = render(<><Harness index={index} />{rows && <LifeListsHarness rows={rows} />}</>)
    await waitFor(() => expect(['partial', 'complete', 'error']).toContain(screen.getByTestId('kind').textContent), { timeout: 8000 })
    const reason = screen.getByTestId('reason').textContent ?? ''
    const kind = screen.getByTestId('kind').textContent ?? ''
    const sentence = screen.getByTestId('sentence').textContent ?? ''
    // Life Lists agrees once its join and the merged snapshot are in.
    if (rows) await waitFor(() => expect(screen.getByTestId('lifelists').textContent).toBe(kind === 'complete' ? 'complete' : 'open'))
    const lifeListsReads = rows ? screen.getByTestId('lifelists').textContent ?? '' : ''
    if (requested.length > before) {
      await waitFor(() => {
        const doc = persisted()
        expect(doc?.order).toEqual([...cache.getSnapshot().checklists])
        expect([...(doc?.unmatchedOrder ?? [])].sort()).toEqual([...cache.unmatchedSet(Date.now())].sort())
      }, { timeout: 4000 })
    }
    view.unmount()
    return { requests: requested.length - before, reason, kind, sentence, lifeLists: lifeListsReads }
  }

  it('consecutive loads send 3, 0, 0, 0 checklist requests, and a settled load names the one species left open', async () => {
    // Was 29, 8, 0, 0 with three species open (1.0.64 to 1.0.66). The first
    // wave asks one checklist per open species; the slash answers settle
    // Willet and Marsh Wren through the join, the skylark's answer stamps it,
    // and nothing is left to ask.
    const rows = measuredShape()
    const index = statsIndex(rows)
    seed(savedDocument(Date.now()))

    const loads = [await load(index, rows), await load(index, rows), await load(index, rows), await load(index, rows)]
    expect(loads.map(l => l.requests)).toEqual([3, 0, 0, 0])
    // Never `complete` while a species is open (D-04), from the first load on,
    // and Life Lists reads the same: not finished.
    expect(loads.map(l => l.reason)).toEqual(['unmatched', 'unmatched', 'unmatched', 'unmatched'])
    expect(loads.map(l => l.lifeLists)).toEqual(['open', 'open', 'open', 'open'])
    for (const l of loads) expect(l.sentence).toBe("eBird's answers did not include Eurasian Skylark, so it still counts.")
    expect(requested.filter(p => p.startsWith('/checklists/'))).toHaveLength(3)
    expect(model.remainingSpecies(cache.getSnapshot(), index, new Set())).toEqual(['skylar'])
  }, 30_000)

  it('without the join the same shape still settles with three open, the 1.0.66 figures (the control)', async () => {
    const index = statsIndex(measuredShape(), model.NO_ESCAPEE_JOIN)
    seed(savedDocument(Date.now()))
    const loads = [await load(index), await load(index), await load(index)]
    expect(loads.map(l => l.requests)).toEqual([29, 8, 0])
    expect(loads[2].sentence).toBe("eBird's answers did not include Eurasian Skylark, Marsh Wren, or Willet, so they still count.")
  }, 30_000)

  it('stamps written under the old join do not hold the line: the first load re-asks once per species, then settles', async () => {
    // The document 1.0.64 to 1.0.66 leave behind: every carrier fresh, all
    // three species stamped. Its stamps carry no join marker, so the load path
    // drops them; the ledger and the records stay, so only one checklist per
    // open species is asked, never the 37 the ledger holds.
    const rows = measuredShape()
    const index = statsIndex(rows)
    seed(settledUnderOldJoin(Date.now(), null))
    const loads = [await load(index, rows), await load(index, rows), await load(index, rows)]
    expect(loads.map(l => l.requests)).toEqual([3, 0, 0])
    for (const l of loads) {
      expect(l.sentence).toBe("eBird's answers did not include Eurasian Skylark, so it still counts.")
      expect(l.lifeLists).toBe('open')
    }
    expect(persisted()?.unmatchedOrder).toEqual(['skylar'])
  }, 30_000)

  it('the same stamps under the current marker are honoured, which is why the marker had to change (the control)', async () => {
    const index = statsIndex(measuredShape())
    seed(settledUnderOldJoin(Date.now(), cache.UNMATCHED_JOIN_VERSION))
    const first = await load(index)
    expect(first.requests).toBe(0)
    expect(first.sentence).toBe("eBird's answers did not include Eurasian Skylark, Marsh Wren, or Willet, so they still count.")
  }, 30_000)

  it('Statistics and Life Lists report the same completion for every 2026 shape, and only the shared join makes them agree', async () => {
    // Every shape answered under a sibling code: both tabs read complete.
    const rows = everyShape(true)
    const done = await load(statsIndex(rows), rows)
    expect(done.kind).toBe('complete')
    expect(done.lifeLists).toBe('complete')
    expect(model.remainingSpecies(cache.getSnapshot(), statsIndex(rows), new Set())).toEqual([])
    // The lumped-away name is checked: it has a record of its own.
    expect(cache.getSnapshot().species.has('houswi1')).toBe(true)

    // Now the lumped-away name's answer lacks it: both tabs read open, and the
    // line names it.
    await cache.purgeProvenanceStore()
    const lacking = everyShape(false)
    const open = await load(statsIndex(lacking), lacking)
    expect(open.reason).toBe('unmatched')
    expect(open.sentence).toBe("eBird's answers did not include House Swift, so it still counts.")
    expect(open.lifeLists).toBe('open')
    // The discriminator: without the join on the Life Lists side, the name is
    // not in its index at all and it would read complete beside Statistics'
    // open line.
    expect(lifeLists.checkCompleteFor(cache.getSnapshot(), lifeLists.rosterCoverIndex(lacking, CODES, model.NO_ESCAPEE_JOIN))).toBe(true)
    expect(lifeLists.checkCompleteFor(cache.getSnapshot(), lifeLists.rosterCoverIndex(lacking, CODES, join))).toBe(false)
  }, 30_000)

  it('after Clear the pass asks again', async () => {
    const index = statsIndex(measuredShape())
    seed(savedDocument(Date.now()))
    await load(index); await load(index)
    expect((await load(index)).requests).toBe(0)

    await cache.purgeProvenanceStore()
    expect(persisted()).toBeNull()
    expect((await load(index)).requests).toBeGreaterThan(0)
  }, 30_000)
})
