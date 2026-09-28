import { tauriFetch } from './http';
import { storage } from '../storage';
import { cachedGet } from '../networkCache';
import {
  HOTSPOT_ACTIVITY_LOC_ID_RE, reduceActivityRecords,
  type HotspotActivityPayload,
} from '../hotspotActivity';
import { throwEbirdHttpError } from './ebirdErrors';
import { reduceRecentObs, type RecentObs } from '../recentObsReduce';
import { REGION_CODE_RE } from '../regionCode';
import {
  DAY_OBS_MAX_BODY_CHARS, isValidDayObsDate, reduceCountyDayObs, unexpectedEbirdResponse,
  type DayObsPayload,
} from '../countyDayObsReduce';

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
  if (!res.ok) throwEbirdHttpError(res);
  return res.json() as Promise<Hotspot[]>;
}

/** All PUBLIC hotspot locIds in an eBird region (e.g. "US-CA"). Mirrors backend
 *  /map/hotspot-region (dual-transport parity — keep both in lockstep). */
export async function getHotspotRegion(regionCode: string): Promise<string[]> {
  const headers = await ebirdHeaders();
  const url = `${EBIRD_BASE}/ref/hotspot/${encodeURIComponent(regionCode)}?fmt=json`;
  const res = await tauriFetch(url, { headers });
  if (!res.ok) throwEbirdHttpError(res);
  const data = await res.json() as Array<{ locId?: string }>;
  return data.map(h => h.locId).filter((id): id is string => !!id);
}

// County subnational2 codes only ("US-CA-085") — stricter than hotspot-region,
// matching deriveCountyRegionCode (NFR-09 shape guard). Single-sourced in
// lib/regionCode.ts since targets-tab; this consumer keeps its own 422 test.
const COUNTY_REGION_RE = REGION_CODE_RE;

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
  if (!res.ok) throwEbirdHttpError(res);
  const raw = await res.json() as unknown;
  const codes = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : [];
  const { collapseToSpeciesList } = await import('./taxonomyService');
  const species = await collapseToSpeciesList(codes);
  return { regionCode, speciesCount: species.length, species };
}

/** Every species reported in one US county on one calendar day (targets-tab,
 *  schema.md section 4): eBird data/obs/{regionCode}/historic/{y}/{m}/{d} with
 *  eBird's defaults, reduced to one record per species, the most recent that
 *  day. Mirrors backend GET /map/county-day-obs (dual-transport parity — keep
 *  both in lockstep; the shared fixture countyDayObs.fixture.json pins the
 *  reducer and both parameter validators on both transports).
 *
 *  The destination cannot be steered: the region code passes REGION_CODE_RE
 *  (no scheme, host, credential, separator, dot or percent is expressible) and
 *  is `encodeURIComponent`-wrapped besides, and the year, month and day are
 *  INTEGERS the code formats from a date already validated as a real calendar
 *  day (days-in-month arithmetic, never a `Date` rollover). Nothing else is
 *  forwarded. The body is capped BEFORE `JSON.parse` and reduced, never
 *  reflected; every failure after the fetch is the 502 shape, so a malformed
 *  body is never read as "you're offline" (security.md v1.0.29). Governed by
 *  the transport's shared eBird gate (EBIRD_GATED_PATHS) and cached only by
 *  the durable per-day store (lib/countyDayObsCache.ts). */
export async function getCountyDayObs(regionCode: string, date: string): Promise<DayObsPayload> {
  if (!REGION_CODE_RE.test(regionCode)) {
    throw Object.assign(
      new Error('Invalid county region code.'),
      { status: 422, detail: 'Invalid county region code.' }
    );
  }
  if (!isValidDayObsDate(date)) {
    throw Object.assign(new Error('Invalid date.'), { status: 422, detail: 'Invalid date.' });
  }
  const headers = await ebirdHeaders();
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const url = `${EBIRD_BASE}/data/obs/${encodeURIComponent(regionCode)}/historic/${y}/${m}/${d}`;
  const res = await tauriFetch(url, { headers });
  if (!res.ok) throwEbirdHttpError(res);
  // A body READ that fails is a connection failure and propagates as one (the
  // sibling services' `res.json()` posture); only a body that ARRIVED and is
  // too long or not JSON is the provider's 502.
  const text = await res.text();
  if (text.length > DAY_OBS_MAX_BODY_CHARS) throw unexpectedEbirdResponse();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw unexpectedEbirdResponse();
  }
  return reduceCountyDayObs(body, regionCode, date);
}

/** Recent community activity for ONE public hotspot: eBird
 *  data/obs/{locId}/recent with back=30, reduced to one (speciesCode, obsDt)
 *  pair per species — the most recent report of each. Mirrors backend
 *  GET /map/hotspot-activity (dual-transport parity — keep both in lockstep;
 *  the shared fixture hotspotActivity.fixture.json pins reduction AND id
 *  validation on both transports). The locId guard is the single-sourced
 *  compiled HOTSPOT_ACTIVITY_LOC_ID_RE (JS `$` never matches before a trailing
 *  newline, so anchor parity with the backend's Rust-regex `pattern=` holds by
 *  construction). Deliberately NOT in CACHED_GET_PATHS: the 6-hour persistent
 *  hotspotActivityCache is the single caching layer for this call. */
export async function getHotspotActivity(locId: string): Promise<HotspotActivityPayload> {
  if (!HOTSPOT_ACTIVITY_LOC_ID_RE.test(locId)) {
    throw Object.assign(
      new Error('Invalid hotspot location id.'),
      { status: 422, detail: 'Invalid hotspot location id.' }
    );
  }
  const headers = await ebirdHeaders();
  const url = `${EBIRD_BASE}/data/obs/${encodeURIComponent(locId)}/recent?back=30&fmt=json`;
  const res = await tauriFetch(url, { headers });
  // The 429 branch is the shared throwEbirdHttpError (parity with the FastAPI
  // route's own 429 — the shared fixture's rateLimit rows pin both transports).
  if (!res.ok) throwEbirdHttpError(res);
  const raw = await res.json() as unknown;
  return { locId, species: reduceActivityRecords(raw) };
}

export type { RecentObs } from '../recentObsReduce';

/** The bare eBird data/obs/geo/recent radius fetch — codes-INDEPENDENT (eBird
 *  returns every species in the radius). Mirrors backend _fetch_recent_obs_raw. */
async function fetchRecentObsRaw(
  lat: number,
  lng: number,
  dist: number,
): Promise<Array<Record<string, unknown>>> {
  const headers = await ebirdHeaders();
  const url = `${EBIRD_BASE}/data/obs/geo/recent?lat=${lat}&lng=${lng}&dist=${dist}&back=30&fmt=json`;
  const res = await tauriFetch(url, { headers });
  if (!res.ok) throwEbirdHttpError(res);
  return res.json() as Promise<Array<Record<string, unknown>>>;
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
  //
  // TIDY #3: the raw radius fetch is codes-INDEPENDENT and deduped on
  // (lat, lng, dist) via cachedGet (the SAME 90 s-TTL / single-flight /
  // never-cache-on-error store the transport layer uses, so Settings' ebird-key
  // change — which calls clearNetworkCache() — invalidates it too, via the
  // generation counter). The codes filter is applied AFTER, so a with-codes
  // (Media Targets) and a no-codes (Nearby Lifers) call at the SAME center share
  // one eBird fetch. lat/lng rounded to 5 decimals (≈1 m) to coalesce
  // trivially-different centers, matching networkCacheKey.
  const rawKey = `map/recent-obs-raw?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&dist=${dist}`;
  const observations = await cachedGet(rawKey, () => fetchRecentObsRaw(lat, lng, dist));
  // The reducer is shared with the iOS widget's TypeScript twin
  // (lib/recentObsReduce.ts): one function, so the two cannot drift.
  return reduceRecentObs(observations, codes);
}
