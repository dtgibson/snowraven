// SHARED-FIXTURE PARITY TEST — the JS half of the dual-transport exotic-provenance
// lockstep (escapee-count-toggle, schema.md §11.4, FR-39, QA-44).
//
// `lib/tauri/checklistService.normalizeProvenancePair` (desktop/Tauri) and
// `services.ebird._norm_token` applied to the same two fields (web/Pi backend)
// are twins kept in lockstep by comment only. This test and its pytest sibling
// (backend/tests/test_checklist_provenance_parity.py) both load the ONE shared
// fixture (checklistProvenance.fixture.json) and assert the SAME normalized
// pair, so if either twin drifts its own test fails.
//
// Both sides are called through their SHIPPED exports rather than a retyped copy
// of the pattern; retyping is how a reproduction quietly stops testing the code
// that ships.

import { describe, it, expect, vi } from 'vitest'

// The answer-body rows below drive the SHIPPED `getChecklist` end to end, so
// its outbound seams are faked: one 200 carrying the row's body, a key, and an
// empty taxonomy and region lookup. The normalization rows above them never
// touch these. The 200 is a real `Response` over the row's BYTES, so
// `res.json()` is the Fetch spec's decode (UTF-8 with replacement, one BOM
// dropped, JSON.parse) rather than a stand-in. Node's undici drops a SECOND
// leading BOM where the spec and the WebViews do not, so no row depends on one.
const http = vi.hoisted(() => ({ bytes: new Uint8Array(), urls: [] as string[], regionLookups: 0 }))
vi.mock('./tauri/http', () => ({
  tauriFetch: async (url: string) => {
    http.urls.push(url)
    return new Response(http.bytes, { status: 200 })
  },
}))
vi.mock('./storage', () => ({ storage: { getApiKey: async () => 'test-key' } }))
vi.mock('./tauri/taxonomyService', () => ({ resolveSpecies: async () => ({}) }))
vi.mock('./tauri/regionInfo', () => ({
  getRegionInfo: async () => { http.regionLookups += 1; return { name: 'Somewhere' } },
}))

import { getChecklist, normalizeProvenancePair, MEDIA_COUNT_MAX } from './tauri/checklistService'
import fixture from './checklistProvenance.fixture.json'

interface Case {
  why: string
  obs: { speciesCode: string; exoticCategory?: unknown; userDoNotCount?: unknown }
  expected: { exoticCategory: string; userDoNotCount: string }
}

const cases = fixture.cases as unknown as Case[]

describe('exotic-provenance seam normalization (desktop half of the parity pair)', () => {
  it('normalizes every shared-fixture case to the expected pair', () => {
    for (const c of cases) {
      expect(
        normalizeProvenancePair(c.obs.exoticCategory, c.obs.userDoNotCount),
        c.why,
      ).toEqual(c.expected)
    }
  })

  // Non-vacuity: a fixture that had quietly lost its hostile rows would still
  // pass the loop above. These assert the probe set actually exercises the
  // branches the guard exists for.
  it('the fixture still carries the cases that make the guard discriminating', () => {
    const cats = cases.map(c => c.obs.exoticCategory)
    // The v0.5.54 trap: a `\d`/`\w` pattern would admit these on the Python side
    // (rust-regex treats them as Unicode) while rejecting them in JS.
    expect(cats).toContain('٠١٢')          // Arabic-Indic 012
    expect(cats).toContain('Х')                       // Cyrillic capital Ha
    expect(cats.some(v => typeof v !== 'string')).toBe(true)
    // The three real eBird values plus an unrecognized future one.
    for (const v of ['X', 'N', 'P', 'Q']) expect(cats).toContain(v)
    // ANCHOR parity, not just class parity. Matching character classes are only
    // half of it: Python's `$` matches before a trailing newline and
    // JavaScript's does not, so `re.match` accepted 'X\n' where `.test()`
    // rejected it, and the divergence was invisible to every row above.
    expect(cats).toContain('X\n')
    expect(cats).toContain('\nX')
    expect(cats).toContain('X\nN')
    expect(cases.length).toBeGreaterThanOrEqual(15)
  })

  it('rejects a hostile value rather than coercing it (the direction that COUNTS)', () => {
    // Anything unrecognized normalizes to '', and '' counts under FR-01. So a
    // malformed response can never silently REMOVE a species from a life list;
    // the failure direction is the safe one.
    for (const c of cases) {
      const out = normalizeProvenancePair(c.obs.exoticCategory, c.obs.userDoNotCount)
      if (out.exoticCategory !== 'X') {
        expect(out.exoticCategory === '' || out.exoticCategory.length <= 4).toBe(true)
      }
    }
  })

  it('mutation guard: the ANCHORS must reject what a Python `$` would admit', () => {
    // The shipped JS side already rejects these, so this test is the fixed
    // reference the backend's `fullmatch` has to meet. Reverting the backend to
    // `.match()` turns its half of the parity pair red against the same rows.
    expect(normalizeProvenancePair('X\n', 'DNC\n')).toEqual({ exoticCategory: '', userDoNotCount: '' })
    expect(normalizeProvenancePair('\nX', '\nDNC')).toEqual({ exoticCategory: '', userDoNotCount: '' })
    expect(normalizeProvenancePair('X\nN', '')).toEqual({ exoticCategory: '', userDoNotCount: '' })
  })

  it('mutation guard: an ASCII-only class is what makes the two transports agree', () => {
    // `\w` and `\d` are the two shapes the v0.5.54 finding was about. If the
    // shipped pattern were rewritten with either, the Cyrillic and Arabic-Indic
    // rows would start passing on one transport and not the other. Assert
    // directly that the shipped normalizer rejects them, so such a rewrite goes
    // red here rather than at a user's data.
    expect(normalizeProvenancePair('Х', '').exoticCategory).toBe('')
    expect(normalizeProvenancePair('٠١٢', '').exoticCategory).toBe('')
    expect(normalizeProvenancePair('X', 'DNC')).toEqual({ exoticCategory: 'X', userDoNotCount: 'DNC' })
  })
})

interface Verdict {
  status: number
  species?: number
  first?: { breedingCode: string; media: { photo: number; audio: number; video: number } }
}

interface AnswerRow {
  why: string
  fields: string | null
  /** Sent as JSON; or `text`, sent as UTF-8; or `hex`, sent as those bytes. */
  body?: unknown
  text?: string
  hex?: string
  expected: Verdict
}

const answers = (fixture as unknown as { answers: AnswerRow[] }).answers

/** The exact bytes eBird answered with for one row. */
function bytesOf(row: Pick<AnswerRow, 'body' | 'text' | 'hex'>): Uint8Array<ArrayBuffer> {
  if (row.hex !== undefined) return new Uint8Array(Buffer.from(row.hex, 'hex'))
  return new Uint8Array(new TextEncoder().encode(row.text !== undefined ? row.text : JSON.stringify(row.body)))
}

/** The verdict a caller of the desktop seam sees for one eBird body. */
async function verdict(row: AnswerRow): Promise<Verdict> {
  http.bytes = bytesOf(row)
  try {
    const res = await getChecklist('S12345678', row.fields ?? undefined)
    const out: Verdict = { status: 200, species: res.species.length }
    if (row.expected.first) {
      out.first = { breedingCode: res.species[0]?.breedingCode, media: res.species[0]?.media }
    }
    return out
  } catch (err) {
    return { status: (err as { status?: number }).status ?? -1 }
  }
}

/** A row's body when it is a JSON object, else null. */
const objectBody = (r: AnswerRow): Record<string, unknown> | null =>
  (typeof r.body === 'object' && r.body !== null && !Array.isArray(r.body) ? r.body as Record<string, unknown> : null)

describe('a successful body the app cannot read (desktop half, ebird-request-economy D-02, ebird-store-hygiene)', () => {
  it('reaches the shared fixture\'s verdict for every body', async () => {
    for (const row of answers) expect(await verdict(row), row.why).toEqual(row.expected)
  })

  it('a failed answer is a 502, never a status-less error the offline test would read as no connection', async () => {
    for (const row of answers.filter(r => r.expected.status === 502)) {
      http.bytes = bytesOf(row)
      const err = await getChecklist('S12345678', row.fields ?? undefined).then(() => null, (e: unknown) => e)
      expect(err, row.why).toMatchObject({ status: 502 })
      expect((err as Error).message, row.why).toBe('Could not fetch checklist (HTTP 502).')
    }
  })

  it('a refused body costs no second request: the location-name lookup is never reached', async () => {
    http.urls.length = 0
    http.regionLookups = 0
    expect(await verdict({ why: 'no fields, absent list', fields: null, body: { locId: 'L99' }, expected: { status: 502 } }))
      .toEqual({ status: 502 })
    expect(http.urls).toHaveLength(1)
    expect(http.regionLookups).toBe(0)
    // Control: the same body with a list does look the name up.
    await verdict({ why: 'no fields, a list', fields: null, body: { locId: 'L99', obs: [] }, expected: { status: 200 } })
    expect(http.regionLookups).toBe(1)
  })

  it('the fixture still carries the rows that make it discriminating', () => {
    const failed = answers.filter(r => r.expected.status === 502)
    const answered = answers.filter(r => r.expected.status === 200)
    expect(failed.length).toBeGreaterThanOrEqual(8)
    // An empty list stays an answer in a species-reading mode, and the projects
    // mode is untouched by a body whose list is absent or not a list.
    expect(answered.some(r => r.fields === 'provenance' && Array.isArray(objectBody(r)?.obs)
      && (objectBody(r)!.obs as unknown[]).length === 0)).toBe(true)
    expect(answered.some(r => r.fields === 'projects' && objectBody(r) !== null && !Array.isArray(objectBody(r)!.obs))).toBe(true)
    // Each falsy non-list Python's `or []` used to turn into an empty answer.
    const failedObs = failed.filter(r => r.body !== undefined)
      .map(r => (objectBody(r) === null ? 'NO OBJECT BODY' : objectBody(r)!.obs))
    for (const v of [undefined, null, '', 0, false]) expect(failedObs).toContain(v)
    expect(failedObs.some(v => typeof v === 'object' && v !== null && !Array.isArray(v))).toBe(true)
    // ebird-store-hygiene: the rows that separate the twins. An observation
    // list holding a list (`typeof [] === 'object'`), a list body under
    // fields=projects, a NaN that Python's decoder accepts, bytes that are not
    // UTF-8, and the breeding fallback that `??` and `or` read differently.
    const items = failed.flatMap(r => (Array.isArray(objectBody(r)?.obs) ? objectBody(r)!.obs as unknown[] : []))
    expect(items.some(Array.isArray)).toBe(true)
    expect(items.some(o => o === null)).toBe(true)
    expect(failed.some(r => r.fields === 'projects' && Array.isArray(r.body))).toBe(true)
    expect(failed.some(r => r.text?.includes('NaN'))).toBe(true)
    expect(failed.some(r => r.hex !== undefined)).toBe(true)
    expect(answered.some(r => r.hex !== undefined)).toBe(true)
    expect(answered.some(r => r.expected.first?.breedingCode === 'S')).toBe(true)
  })

  it('the media count bound is the fixture\'s boundary pair, compared with this side\'s declaration', () => {
    // Python declares the same bound again (services.ebird.MEDIA_COUNT_MAX);
    // the pair of rows at the bound and one past it is what compares the two.
    const photos = answers.filter(r => r.expected.first)
      .map(r => (objectBody(r)?.obs as Array<{ mediaCounts?: { P?: unknown } }> | undefined)?.[0]?.mediaCounts?.P)
    expect(photos).toContain(MEDIA_COUNT_MAX)
    expect(photos).toContain(MEDIA_COUNT_MAX + 1)
  })
})
