import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { storage } from '../storage'
import { resolveSpecies } from './taxonomyService'

const EBIRD_BASE = 'https://api.ebird.org/v2'

export interface ChecklistSpecies {
  speciesCode: string
  commonName: string
  count: string
  breedingCode: string
  media: { photo: number; audio: number; video: number }
}

export interface ChecklistResult {
  locName: string
  obsDt: string
  species: ChecklistSpecies[]
}

// Desktop counterpart of the backend /checklists/{id} endpoint: fetch a checklist's
// observations directly from eBird, then resolve species codes → common names via the
// cached taxonomy. eBird returns obs in taxonomic order, which we preserve.
export async function getChecklist(checklistId: string): Promise<ChecklistResult> {
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
    obs?: Array<{
      speciesCode?: string
      howManyStr?: string
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
      media: { photo: mc.P ?? 0, audio: mc.A ?? 0, video: mc.V ?? 0 },
    }
  })

  // checklist/view carries only locId, not a readable name. Resolve it so the two
  // checklists are easy to tell apart (mirrors the backend /checklists/{id} flow).
  const locName = data.locName || (data.locId ? await resolveLocName(key, data.locId) : '')
  return { locName: locName || data.locId || '', obsDt: data.obsDt ?? '', species }
}

/** Resolve an eBird locId (e.g. "L99381") to a human-readable place name. Best-effort. */
async function resolveLocName(key: string, locId: string): Promise<string> {
  try {
    const res = await tauriFetch(`${EBIRD_BASE}/ref/region/info/${locId}`, {
      headers: { 'X-eBirdApiToken': key },
    })
    if (!res.ok) return ''
    const region = await res.json() as { result?: string; name?: string }
    return region.result || region.name || ''
  } catch {
    return ''
  }
}
