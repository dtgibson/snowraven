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
// no eBird answer carries. "Willet" (34 carriers, 6 in the saved ledger) and
// "Marsh Wren" (2, both saved) resolve to the 2026 nominate daughters while
// eBird answers with the slash codes, and "Eurasian Skylark" (1, saved) is
// simply absent from its answer. The saved ledger is older than the TTL, as it
// was on the real store. Before the fix every load sent 29 requests, forever;
// with the stamp the loads go 29, 8, 0, 0.

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

const CODES: Record<string, string> = {
  Willet: 'willet2', 'Marsh Wren': 'eamwre1', 'Eurasian Skylark': 'skylar', Mallard: 'mallar3',
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

describe.each(['tauri', 'web'] as const)('the measured shape settles under the %s storage seam', (which) => {
  let ctrl: typeof import('./useExoticProvenance')
  let cache: typeof import('./exoticProvenanceCache')
  let copy: typeof import('./exoticCopy')
  let buildCoverIndex: typeof import('./exoticProvenance').buildCoverIndex

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
    ;({ buildCoverIndex } = await import('./exoticProvenance'))
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

  /** One session: a fresh mirror read from the seam, one mount, the pass's
   *  terminal status, then the document on disk caught up with the mirror,
   *  which is exactly what the next session reads. */
  async function load(index: import('./exoticProvenance').CoverIndex): Promise<{ requests: number; reason: string }> {
    cache._resetProvenanceCacheForTests()
    const before = requested.length
    const view = render(<Harness index={index} />)
    await waitFor(() => expect(['partial', 'complete', 'error']).toContain(screen.getByTestId('kind').textContent), { timeout: 8000 })
    const reason = screen.getByTestId('reason').textContent ?? ''
    if (requested.length > before) {
      await waitFor(() => {
        const doc = persisted()
        expect(doc?.order).toEqual([...cache.getSnapshot().checklists])
        expect([...(doc?.unmatchedOrder ?? [])].sort()).toEqual([...cache.unmatchedSet(Date.now())].sort())
      }, { timeout: 4000 })
    }
    view.unmount()
    return { requests: requested.length - before, reason }
  }

  it('consecutive loads send 29, 8, 0, 0 checklist requests, and a settled load says why the species still count', async () => {
    const index = buildCoverIndex(measuredShape(), codeFor)
    seed(savedDocument(Date.now()))

    const loads = [await load(index), await load(index), await load(index), await load(index)]
    expect(loads.map(l => l.requests)).toEqual([29, 8, 0, 0])
    // Load 1 parks the Willet at its follow-up bound, today's sentence.
    expect(loads[0].reason).toBe('species-budget')
    // Every later load ends settled-but-open: never `complete` while species
    // remain open (D-04), the reason Life Lists' completion test agrees with.
    expect(loads.slice(1).map(l => l.reason)).toEqual(['unmatched', 'unmatched', 'unmatched'])
    render(<Harness index={index} />)
    await waitFor(() => expect(screen.getByTestId('reason').textContent).toBe('unmatched'))
    expect(screen.getByTestId('sentence').textContent).toBe("eBird's answers did not include 3 of your species, so they still count.")
    expect(requested.filter(p => p.startsWith('/checklists/'))).toHaveLength(37)
  }, 30_000)

  it('after Clear the pass asks again', async () => {
    const index = buildCoverIndex(measuredShape(), codeFor)
    seed(savedDocument(Date.now()))
    await load(index); await load(index)
    expect((await load(index)).requests).toBe(0)

    await cache.purgeProvenanceStore()
    expect(persisted()).toBeNull()
    expect((await load(index)).requests).toBeGreaterThan(0)
  }, 30_000)
})
