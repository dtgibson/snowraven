import { tauriFetch } from './http'
import { storage } from '../storage'
import { resolveSpecies } from './taxonomyService'
import { getRegionInfo } from './regionInfo'
import { ebirdRateLimitError } from './ebirdErrors'
import { checklistFieldFlags } from '../checklistFields'

const EBIRD_BASE = 'https://api.ebird.org/v2'

export interface ChecklistSpecies {
  speciesCode: string
  commonName: string
  count: string
  breedingCode: string
  comments: string
  media: { photo: number; audio: number; video: number }
  /** Raw eBird exotic provenance: 'X' (escapee), 'N' (naturalized), 'P'
   *  (provisional), or '' when absent. Deliberately NOT a closed union — an
   *  unrecognized future category is carried verbatim and, per the countability
   *  rule, counts. */
  exoticCategory: string
  /** Raw companion flag ('DNC' in sampled data), or '' when absent. Recorded so
   *  the question of what it means stays answerable without re-fetching; it is
   *  never used to decide countability. */
  userDoNotCount: string
}

// The eBird response is untrusted input (NFR-08). Both fields are normalized
// here, at the seam, against EXPLICIT ASCII CLASSES rather than `\w` or `\d`.
// The backend twin uses the same explicit classes for the same reason: the
// v0.5.54 finding was a pydantic rust-regex `\d` admitting `٠١٢` while its JS
// twin did not, so the "same" pattern validated differently on the two
// transports. Anything not matching becomes '', which counts.
const EXOTIC_RE = /^[A-Z]{1,4}$/
const DNC_RE = /^[A-Z]{1,8}$/

function normToken(v: unknown, re: RegExp): string {
  return typeof v === 'string' && re.test(v) ? v : ''
}

/** The exotic-provenance normalization, exported so the dual-transport parity
 *  test exercises the SHIPPED code rather than a retyped copy of it. Its Python
 *  twin is `services.ebird._norm_token` applied to the same two fields, and both
 *  are driven by the one shared fixture
 *  (`frontend/src/lib/checklistProvenance.fixture.json`). */
export function normalizeProvenancePair(
  exoticCategory: unknown, userDoNotCount: unknown,
): { exoticCategory: string; userDoNotCount: string } {
  return {
    exoticCategory: normToken(exoticCategory, EXOTIC_RE),
    userDoNotCount: normToken(userDoNotCount, DNC_RE),
  }
}

// The projects seam (county-shading-and-project-stats, FR-24, NFR-09). Same
// posture as the provenance pair above: the eBird response is untrusted input,
// normalized here at the seam against EXPLICIT ASCII CLASSES, with the Python
// twin (`services.ebird._norm_project_fields`) written identically and both
// driven by ONE shared fixture (checklistProjects.fixture.json).
//
// TWO PARITY TRAPS LIVE HERE, and both are fixture ROWS rather than comments:
//
//  1. ANCHORS. Python's `$` matches before a trailing newline, so
//     `re.match(r'^[A-Z0-9_]{1,32}$', 'EBIRD\n')` succeeds where this
//     `.test()` fails. The Python half uses `re.fullmatch` for that reason.
//  2. `isinstance(True, int)` is True in Python, so `projectIds: [true]` would
//     normalize to 1 there; `typeof v === 'number'` rejects a boolean here for
//     free, and the Python guard excludes bool explicitly. A STRING element is
//     rejected outright rather than coerced, because `int('١٠٥٠')` parses as
//     1050 under BOTH runtimes.
const PROJ_ID_RE = /^[A-Z0-9_]{1,32}$/

/** 9-digit ceiling, so the persisted number's string form is length-bounded. */
export const PROJECT_ID_MAX = 999_999_999

/** Array length cap. Sampled data carries 1; 8 mirrors MAX_SEEN_PER_SPECIES and
 *  keeps a hostile response from growing the persisted entry without bound. */
export const MAX_PROJECT_IDS = 8

/** The projects normalization, exported so the dual-transport parity test
 *  exercises the SHIPPED code rather than a retyped copy of the pattern.
 *  Rejected `projId` becomes ''; non-conforming `projectIds` ELEMENTS are
 *  dropped (never coerced, never defaulted) and the array is capped. */
export function normalizeProjectFields(
  projId: unknown, projectIds: unknown,
): { projId: string; projectIds: number[] } {
  const proj = typeof projId === 'string' && PROJ_ID_RE.test(projId) ? projId : ''
  const ids: number[] = []
  if (Array.isArray(projectIds)) {
    for (const v of projectIds) {
      if (ids.length >= MAX_PROJECT_IDS) break
      if (typeof v !== 'number' || !Number.isInteger(v)) continue
      if (v < 0 || v > PROJECT_ID_MAX) continue
      ids.push(v)
    }
  }
  return { projId: proj, projectIds: ids }
}

// The `fields=` flag table lives in `lib/checklistFields.ts` and is resolved
// HERE rather than at the transport chokepoint. THAT IS AN ENTRY-CHUNK
// DECISION, not a taste one: `transport.ts` rides the first-paint set, so a
// static import of the table there put the whole module on the entry chunk for
// a mapping only this dynamically-imported service ever needs (NFR-04, QA-23).
// Taking the raw `fields` STRING also makes the transport's wiring executable —
// the desktop `fields=projects` test now drives the same string the caller
// sends, rather than hand-built flags that could disagree with the table.

export interface ChecklistResult {
  locName: string
  obsDt: string
  protocolId: string
  durationHrs: number | null
  distanceKm: number | null
  distanceUnit: string
  numObservers: number | null
  submissionMethod: string
  submissionVersion: string
  comments: string
  species: ChecklistSpecies[]
  /** Normalized eBird `projId` — the submission/project PORTAL a checklist came
   *  in through ('EBIRD', 'EBIRD_MERLIN', 'EBIRD_ATL_CA'), '' when absent or
   *  rejected. Additive: every existing caller ignores it (FR-23). */
  projId: string
  /** Normalized eBird `projectIds` — the project MEMBERSHIP array ([1050] for
   *  the California atlas), [] when absent or rejected. */
  projectIds: number[]
}

// Desktop counterpart of the backend /checklists/{id} endpoint: fetch a checklist's
// observations directly from eBird, then resolve species codes → common names via the
// cached taxonomy. eBird returns obs in taxonomic order, which we preserve.
export async function getChecklist(checklistId: string, fields?: string | null): Promise<ChecklistResult> {
  const opts = checklistFieldFlags(fields)
  const key = await storage.getApiKey('ebird')
  if (!key) {
    throw Object.assign(new Error('eBird API key not configured. Add it in Settings.'), { status: 401 })
  }

  let res: Awaited<ReturnType<typeof tauriFetch>>
  try {
    res = await tauriFetch(`${EBIRD_BASE}/product/checklist/view/${checklistId}`, {
      headers: { 'X-eBirdApiToken': key },
    })
  } catch (err) {
    throw Object.assign(
      new Error(`Could not reach eBird (${err instanceof Error ? err.message : String(err)}).`),
      { status: 0 },
    )
  }
  if (res.status === 404) {
    throw Object.assign(new Error('Checklist not found. Check the ID and try again.'), { status: 404 })
  }
  // A 429 keeps the shared rate-limit shape (status 429, the shared detail, a
  // validated bounded retryAfterSec) so the key-global gate lib/ebirdGate.ts can
  // pace and retry this path — without it, `retryAfterMsFrom` returns null here
  // and the pacing contract the projects sweep depends on is unenforceable
  // (FR-31). ONLY the 429 branch is shared: the generic `!res.ok` below keeps
  // its `{ status: res.status }` shape and its exact detail string, which the
  // List Comparer displays (FR-32).
  if (res.status === 429) {
    const limited = ebirdRateLimitError(res)
    if (limited) throw limited
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Could not fetch checklist (HTTP ${res.status}).`), { status: res.status })
  }

  const data = await res.json() as {
    locId?: string
    locName?: string
    obsDt?: string
    protocolId?: string
    durationHrs?: number | null
    effortDistanceKm?: number | null
    effortDistanceEnteredUnit?: string
    numObservers?: number | null
    submissionMethodCode?: string
    submissionMethodVersionDisp?: string
    comments?: string
    projId?: unknown
    projectIds?: unknown
    obs?: Array<{
      speciesCode?: string
      howManyStr?: string
      comments?: string
      exoticCategory?: string
      userDoNotCount?: string
      obsAux?: Array<{ fieldName?: string; value?: string; auxCode?: string }>
      mediaCounts?: { P?: number; A?: number; V?: number }
    }>
  }
  // Under `fields=projects` the caller wants neither the resolved species list
  // nor the location name, so BOTH outbound follow-ups are skipped and the
  // checklist costs exactly one request (FR-25). `species: []` is the stated
  // shape; every other response field keeps its current one.
  const obs = opts.skipSpecies ? [] : (data.obs ?? []).filter(o => o.speciesCode)
  const resolved: Record<string, { speciesCode: string; commonName: string }> =
    opts.skipSpecies ? {} : await resolveSpecies(obs.map(o => o.speciesCode!))
  const species: ChecklistSpecies[] = obs.map(o => {
    // Breeding code (internal API code; the UI translates to a display code).
    const aux = (o.obsAux ?? []).find(a => a.fieldName === 'breeding_code')
    const breedingCode = aux?.value ?? aux?.auxCode ?? ''
    const mc = o.mediaCounts ?? {}
    return {
      speciesCode: resolved[o.speciesCode!]?.speciesCode ?? o.speciesCode!,
      commonName: resolved[o.speciesCode!]?.commonName ?? o.speciesCode!,
      count: o.howManyStr ?? 'X',
      breedingCode,
      comments: o.comments ?? '',
      media: { photo: mc.P ?? 0, audio: mc.A ?? 0, video: mc.V ?? 0 },
      // `exoticCategory` rides on the OBSERVATION, so it lands on the COLLAPSED
      // parent species code above — precisely the join key the provenance cache
      // wants. Two forms on one checklist ("Mallard" and "Mallard (Domestic
      // type)") therefore contribute two rows for one code, which is the case
      // the monotone OR exists for; never de-duplicate by code before merging.
      ...normalizeProvenancePair(o.exoticCategory, o.userDoNotCount),
    }
  })

  // checklist/view carries only locId, not a readable name. Resolve it so the two
  // checklists are easy to tell apart (mirrors the backend /checklists/{id} flow).
  const locName = data.locName
    || (data.locId && !opts.skipLocName ? await resolveLocName(key, data.locId) : '')
  return {
    locName: locName || data.locId || '',
    obsDt: data.obsDt ?? '',
    protocolId: data.protocolId ?? '',
    durationHrs: data.durationHrs ?? null,
    distanceKm: data.effortDistanceKm ?? null,
    distanceUnit: data.effortDistanceEnteredUnit ?? '',
    numObservers: data.numObservers ?? null,
    submissionMethod: data.submissionMethodCode ?? '',
    submissionVersion: data.submissionMethodVersionDisp ?? '',
    comments: data.comments ?? '',
    species,
    ...normalizeProjectFields(data.projId, data.projectIds),
  }
}

/** Resolve an eBird locId (e.g. "L99381") to a human-readable place name. Best-effort,
 *  via the shared short-TTL region-info memo (also used by the weather service). */
async function resolveLocName(key: string, locId: string): Promise<string> {
  try {
    const info = await getRegionInfo(locId, key)
    return info.name
  } catch {
    return ''
  }
}
