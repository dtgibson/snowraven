import { tauriFetch } from './http';
import { storage } from '../storage';

const EBIRD_BASE = 'https://api.ebird.org/v2';

async function ebirdHeaders(): Promise<Record<string, string>> {
  const key = await storage.getApiKey('ebird');
  if (!key) throw Object.assign(new Error('eBird API key not configured. Add it in Settings.'), { status: 401 });
  return { 'X-eBirdApiToken': key };
}

export interface Hotspot {
  locId: string;
  locName: string;
  lat: number;
  lng: number;
}

export async function getHotspots(lat: number, lng: number, dist: number): Promise<Hotspot[]> {
  const headers = await ebirdHeaders();
  const url = `${EBIRD_BASE}/ref/hotspot/geo?lat=${lat}&lng=${lng}&dist=${dist}&back=30&fmt=json`;
  const res = await tauriFetch(url, { headers });
  if (!res.ok) {
    throw Object.assign(
      new Error(`eBird API error: ${res.status}`),
      { status: 502, detail: `eBird API error: ${res.status}` }
    );
  }
  return res.json() as Promise<Hotspot[]>;
}

/** All PUBLIC hotspot locIds in an eBird region (e.g. "US-CA"). Mirrors backend
 *  /map/hotspot-region (dual-transport parity — keep both in lockstep). */
export async function getHotspotRegion(regionCode: string): Promise<string[]> {
  const headers = await ebirdHeaders();
  const url = `${EBIRD_BASE}/ref/hotspot/${encodeURIComponent(regionCode)}?fmt=json`;
  const res = await tauriFetch(url, { headers });
  if (!res.ok) {
    throw Object.assign(
      new Error(`eBird API error: ${res.status}`),
      { status: 502, detail: `eBird API error: ${res.status}` }
    );
  }
  const data = await res.json() as Array<{ locId?: string }>;
  return data.map(h => h.locId).filter((id): id is string => !!id);
}

// County subnational2 codes only ("US-CA-085") — stricter than hotspot-region,
// matching deriveCountyRegionCode's COUNTY_REGION_RE (NFR-09 shape guard).
const COUNTY_REGION_RE = /^US-[A-Z]{2}-\d{3}$/;

export interface CountySpeciesPayload {
  regionCode: string;
  /** Y — species-level count after the FR-09 comparability collapse. */
  speciesCount: number;
  /** Species-level entries in eBird taxonomic order (the targets pool). */
  species: { speciesCode: string; commonName: string }[];
}

/** All-time species list for a US county region, collapsed to species level.
 *  Mirrors backend GET /map/county-species (dual-transport parity — keep both
 *  in lockstep): eBird product/spplist/{region} → reportAs collapse → dedupe
 *  preserving taxonomic order. Empty eBird list ⇒ { speciesCount: 0 } (FR-25). */
export async function getCountySpecies(regionCode: string): Promise<CountySpeciesPayload> {
  if (!COUNTY_REGION_RE.test(regionCode)) {
    throw Object.assign(
      new Error('Invalid county region code.'),
      { status: 422, detail: 'Invalid county region code.' }
    );
  }
  const headers = await ebirdHeaders();
  const url = `${EBIRD_BASE}/product/spplist/${encodeURIComponent(regionCode)}`;
  const res = await tauriFetch(url, { headers });
  if (!res.ok) {
    throw Object.assign(
      new Error(`eBird API error: ${res.status}`),
      { status: 502, detail: `eBird API error: ${res.status}` }
    );
  }
  const raw = await res.json() as unknown;
  const codes = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : [];
  const { collapseToSpeciesList } = await import('./taxonomyService');
  const species = await collapseToSpeciesList(codes);
  return { regionCode, speciesCount: species.length, species };
}

export interface RecentObs {
  speciesCode: string;
  comName: string;
  locId: string;
  locName: string;
  lat: number;
  lng: number;
  recentDate: string;
  checklistCount: number;
  subId: string;
}

export async function getRecentObs(
  lat: number,
  lng: number,
  dist: number,
  codes: string
): Promise<RecentObs[]> {
  // codes is OPTIONAL: empty/omitted ⇒ return every species in the radius (skip
  // the species-code filter). Media Targets always passes codes; Nearby Lifers
  // passes none. Mirrors backend/routers/map.py get_recent_obs (dual-transport
  // parity) — keep both in lockstep.
  const codeSet = new Set(codes.split(',').map(c => c.trim()).filter(Boolean));
  const headers = await ebirdHeaders();
  const url = `${EBIRD_BASE}/data/obs/geo/recent?lat=${lat}&lng=${lng}&dist=${dist}&back=30&fmt=json`;
  const res = await tauriFetch(url, { headers });
  if (!res.ok) {
    throw Object.assign(
      new Error(`eBird API error: ${res.status}`),
      { status: 502, detail: `eBird API error: ${res.status}` }
    );
  }
  const observations = await res.json() as Array<Record<string, unknown>>;

  const groups = new Map<string, RecentObs>();
  for (const obs of observations) {
    const code = (obs['speciesCode'] as string) ?? '';
    if (codeSet.size > 0 && !codeSet.has(code)) continue;
    // Skip records missing numeric coordinates (the lifers path maps by coord;
    // a coordinate-less obs would otherwise plot at 0,0).
    const recLat = obs['lat'];
    const recLng = obs['lng'];
    if (typeof recLat !== 'number' || typeof recLng !== 'number'
        || Number.isNaN(recLat) || Number.isNaN(recLng)) continue;
    const locId = (obs['locId'] as string) ?? '';
    const groupKey = `${code}|${locId}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        speciesCode: code,
        comName: (obs['comName'] as string) ?? '',
        locId,
        locName: (obs['locName'] as string) ?? '',
        lat: recLat,
        lng: recLng,
        recentDate: (obs['obsDt'] as string) ?? '',
        checklistCount: 0,
        subId: (obs['subId'] as string) ?? '',
      });
    }
    const entry = groups.get(groupKey)!;
    entry.checklistCount += 1;
    const currentDate = (obs['obsDt'] as string) ?? '';
    if (currentDate > entry.recentDate) {
      entry.recentDate = currentDate;
      entry.subId = (obs['subId'] as string) ?? '';
    }
  }
  return [...groups.values()];
}
