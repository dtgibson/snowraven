import { tauriFetch } from './http'
import { storage } from '../storage'
import { resolveSpecies } from './taxonomyService'
import { getRegionInfo } from './regionInfo'

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

export interface ChecklistOptions {
  /** Skip the second outbound eBird call that resolves a readable location name
   *  from the locId. The provenance pass does not need one and FR-13 caps a
   *  pass at one request per checklist; `locName` then falls back to the locId
   *  exactly as it already does when resolution fails. */
  skipLocName?: boolean
}

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
}

// Desktop counterpart of the backend /checklists/{id} endpoint: fetch a checklist's
// observations directly from eBird, then resolve species codes → common names via the
// cached taxonomy. eBird returns obs in taxonomic order, which we preserve.
export async function getChecklist(checklistId: string, opts?: ChecklistOptions): Promise<ChecklistResult> {
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
  const obs = (data.obs ?? []).filter(o => o.speciesCode)
  const resolved = await resolveSpecies(obs.map(o => o.speciesCode!))
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
    || (data.locId && !opts?.skipLocName ? await resolveLocName(key, data.locId) : '')
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
