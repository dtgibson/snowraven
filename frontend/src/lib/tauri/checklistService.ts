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

// ── What a 200 answer must be before anything reads it (ebird-request-economy
// D-02 and D-10, extended by ebird-store-hygiene) ────────────────────────────
//
// Every shape below is a TYPE test, never truthiness, because Python and
// JavaScript disagree about `{}`, `[]`, `0`, `false` and `""`
// (`.claude/rules/security.md`, the twinned-builder rule, v1.0.29). The Python
// twins are named on each function, and the shared fixture
// (`lib/checklistProvenance.fixture.json`, its `answers` rows) drives both
// through the shipped code. A body that fails any of them is a FAILED answer
// with one fixed wording (`unreadableAnswer`), never the engine's text.
//
// COST. Each check reads every observation once with constant work per item
// (a type test and at most a few own-property reads), and the obsAux search
// reads each entry of one observation's list once, so the whole pass is linear
// in the size of the body eBird sent and dominated by the platform's
// `res.json()` that precedes it. Nothing caps the body's size or read time
// (pre-existing, on both transports): `tauriFetch`'s 10 s timer is cleared once
// the headers arrive, before the body is read, so the bound is the decode's
// own. No regex runs over the body here.

/** A plain JSON object: not null, not an array. `typeof [] === 'object'` in
 *  JavaScript, so the array is excluded explicitly to agree with Python's
 *  `isinstance(v, dict)`. */
function isJsonObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** The species modes can read this observation: an object whose `speciesCode`
 *  is absent, null or text. An absent, null or empty code is skipped below, as
 *  it always was; any other code (a number, a boolean, a list, an object) makes
 *  the observation unreadable. Python twin: `_is_readable_observation`. */
function isReadableObservation(o: unknown): boolean {
  if (!isJsonObject(o)) return false
  const code = o.speciesCode
  return code === undefined || code === null || typeof code === 'string'
}

/** The body carries an observation LIST every item of which is readable (an
 *  empty list included). Python twin: `_has_readable_observation_list`. */
function hasReadableObservationList(body: Record<string, unknown>): boolean {
  const obs = body.obs
  return Array.isArray(obs) && obs.every(isReadableObservation)
}

/** The one failed-answer error for a 200 the app cannot use: a body that is
 *  not JSON, not a JSON object, or (in the species modes) has no readable
 *  observation list. It keeps the generic `!res.ok` clause's shape and wording
 *  (status 502), so `isOfflineError` never reads it as no connection and the
 *  List Comparer shows this sentence, never an engine message. */
function unreadableAnswer(): Error & { status: number } {
  return Object.assign(new Error('Could not fetch checklist (HTTP 502).'), { status: 502 })
}

/** The largest media count either transport accepts: 9 digits, below 2^53, so
 *  a number's value is the same in both runtimes. Python twin:
 *  `services.ebird.MEDIA_COUNT_MAX`, compared by the fixture's boundary rows. */
export const MEDIA_COUNT_MAX = 999_999_999

function mediaCount(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MEDIA_COUNT_MAX) return 0
  return v === 0 ? 0 : v   // -0 reads as 0
}

/** The display fields an observation carries beside its species, normalized
 *  the same way on both transports (ebird-store-hygiene). The breeding code is
 *  the first object entry of `obsAux` whose `fieldName` is `breeding_code`: its
 *  `value` when that is non-empty text, else its `auxCode` when that is, else
 *  ''. A media count is a non-negative whole number up to MEDIA_COUNT_MAX, else
 *  0. Anything else in either field reads as absent, never as an error: the
 *  species and its provenance are still readable. Python twins:
 *  `_breeding_code` and `_media_counts`. */
function normalizeDisplayFields(
  obsAux: unknown, mediaCounts: unknown,
): { breedingCode: string; media: { photo: number; audio: number; video: number } } {
  let breedingCode = ''
  if (Array.isArray(obsAux)) {
    for (const a of obsAux) {
      if (!isJsonObject(a) || a.fieldName !== 'breeding_code') continue
      if (typeof a.value === 'string' && a.value !== '') breedingCode = a.value
      else if (typeof a.auxCode === 'string' && a.auxCode !== '') breedingCode = a.auxCode
      break
    }
  }
  const mc = isJsonObject(mediaCounts) ? mediaCounts : {}
  return { breedingCode, media: { photo: mediaCount(mc.P), audio: mediaCount(mc.A), video: mediaCount(mc.V) } }
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

  // A 200 whose body is not JSON is a FAILED answer in every mode, never a
  // status-less SyntaxError that `isOfflineError` could read as no connection
  // (ebird-store-hygiene). The WebView's `Response.json()` is the Fetch spec's
  // "parse JSON from bytes" (UTF-8 with replacement, one leading BOM dropped,
  // then JSON.parse), which the Python twin's decode mirrors.
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw unreadableAnswer()
  }
  // A body that is not a JSON object answers nothing, in every mode: under
  // `fields=projects` it has no project fields either, and storing it as "no
  // projects" would keep that for a year.
  if (!isJsonObject(body)) throw unreadableAnswer()
  // A successful answer with no readable observation list is a FAILED answer in
  // the two modes that read species (no `fields`, and `provenance`), never an
  // empty one (ebird-request-economy D-02). Read as empty, it would have the
  // escapee check stamp every species the checklist carries as "not in eBird's
  // answer" for 30 days, and the List Comparer show an empty checklist. So an
  // `obs` that is absent, null or not an array, or an array holding an item
  // that is not a readable observation, is refused here, BEFORE either
  // follow-up request. `obs: []` is still an answer: eBird answered, and the
  // checklist carries nothing. Under `fields=projects` the list is not read at
  // all, so this does not apply there.
  if (!opts.skipSpecies && !hasReadableObservationList(body)) throw unreadableAnswer()
  const data = body as {
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
      speciesCode?: string | null
      howManyStr?: string
      comments?: string
      exoticCategory?: string
      userDoNotCount?: string
      obsAux?: unknown
      mediaCounts?: unknown
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
    // Breeding code (internal API code; the UI translates to a display code)
    // and media presence, normalized beside the Python twin.
    const { breedingCode, media } = normalizeDisplayFields(o.obsAux, o.mediaCounts)
    return {
      speciesCode: resolved[o.speciesCode!]?.speciesCode ?? o.speciesCode!,
      commonName: resolved[o.speciesCode!]?.commonName ?? o.speciesCode!,
      count: o.howManyStr ?? 'X',
      breedingCode,
      comments: o.comments ?? '',
      media,
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
