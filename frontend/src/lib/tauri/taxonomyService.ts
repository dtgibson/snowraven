import { tauriFetch } from './http';
import { storage } from '../storage';

const EBIRD_BASE = 'https://api.ebird.org/v2';

interface TaxonEntry {
  speciesCode?: string;
  sciName?: string;
  comName?: string;
  taxonOrder?: number;
  category?: string;
  reportAs?: string;
}

interface TaxonomyCache {
  bySci: Record<string, string>;
  byCom: Record<string, string>;
  byOrder: Record<string, number>;
  byCode: Record<string, string>;       // speciesCode -> comName (ALL categories, original case)
  reportAs: Record<string, string>;     // sub-form code -> parent species code (eBird reportAs)
  loadedAt: number;
}

const DB_NAME = 'snowraven-taxonomy';
const STORE_NAME = 'cache';
const CACHE_KEY = 'taxonomy-v2027';   // bumped: full taxonomy + reportAs (sub-form normalization)

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readCache(): Promise<TaxonomyCache | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(CACHE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function writeCache(cache: TaxonomyCache): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(cache, CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-fatal — cache writes best-effort
  }
}

// In-memory cache + an in-flight promise so concurrent first-callers (six components
// resolve taxon codes on load) share ONE download instead of each fetching the full
// ~17k-entry taxonomy.
let _memCache: TaxonomyCache | null = null;
let _loading: Promise<TaxonomyCache> | null = null;

async function ensureTaxonomy(): Promise<TaxonomyCache> {
  if (_memCache) return _memCache;
  if (!_loading) {
    _loading = loadTaxonomy()
      .then(c => { _memCache = c; return c; })
      .finally(() => { _loading = null; });
  }
  return _loading;
}

async function loadTaxonomy(): Promise<TaxonomyCache> {
  const cached = await readCache();
  // Cache valid for 7 days
  if (cached && Date.now() - cached.loadedAt < 7 * 24 * 60 * 60 * 1000) {
    return cached;
  }

  const ebirdKey = await storage.getApiKey('ebird');
  const headers: Record<string, string> = ebirdKey ? { 'x-ebirdapitoken': ebirdKey } : {};

  let res: Awaited<ReturnType<typeof tauriFetch>>;
  try {
    // Full taxonomy (no cat filter) so sub-forms reported on checklists —
    // domestic/issf/form, e.g. "rocpig1" — resolve and map to a species.
    res = await tauriFetch(
      `${EBIRD_BASE}/ref/taxonomy/ebird?fmt=json`,
      { headers, timeoutMs: 30_000 }   // ~17k-entry one-time download — allow longer
    );
  } catch (err) {
    throw new Error(`Could not reach eBird (${err instanceof Error ? err.message : String(err)}). Check your internet connection.`, { cause: err });
  }
  if (!res.ok) throw new Error(`eBird returned HTTP ${res.status}. Check your API key in Settings.`);

  let taxonomy: TaxonEntry[];
  try {
    taxonomy = await res.json() as TaxonEntry[];
  } catch {
    throw new Error('eBird returned an unexpected response format. Try again later.');
  }
  if (!Array.isArray(taxonomy) || taxonomy.length < 100) {
    throw new Error(`eBird taxonomy returned ${Array.isArray(taxonomy) ? taxonomy.length : 0} entries — expected 10,000+. Check your API key in Settings.`);
  }
  const bySci: Record<string, string> = {};
  const byCom: Record<string, string> = {};
  const byOrder: Record<string, number> = {};
  const byCode: Record<string, string> = {};
  const reportAs: Record<string, string> = {};

  for (const taxon of taxonomy) {
    const code = taxon.speciesCode ?? '';
    if (!code) continue;
    byCode[code] = taxon.comName ?? '';
    if (taxon.reportAs) reportAs[code] = taxon.reportAs;
    // Name -> code maps stay species-level (preserves the /taxonomy/codes behavior).
    if (taxon.category !== 'species') continue;
    const sci = (taxon.sciName ?? '').toLowerCase();
    const com = (taxon.comName ?? '').toLowerCase();
    if (sci) bySci[sci] = code;
    if (com) {
      byCom[com] = code;
      if (taxon.taxonOrder != null) byOrder[com] = taxon.taxonOrder;
    }
  }

  const fresh: TaxonomyCache = { bySci, byCom, byOrder, byCode, reportAs, loadedAt: Date.now() };
  writeCache(fresh); // fire-and-forget; ensureTaxonomy sets the in-memory cache
  return fresh;
}

interface SpeciesItem { commonName: string; scientificName: string }

export async function getTaxonomyCodes(
  species: SpeciesItem[]
): Promise<{ codes: Record<string, string>; orders: Record<string, number> }> {
  const cache = await ensureTaxonomy();

  const codes: Record<string, string> = {};
  const orders: Record<string, number> = {};

  for (const item of species) {
    const comLower = item.commonName.toLowerCase();
    const code = cache.bySci[item.scientificName.toLowerCase()] ?? cache.byCom[comLower];
    if (code) codes[item.commonName] = code;
    const order = cache.byOrder[comLower];
    if (order != null) orders[item.commonName] = order;
  }

  return { codes, orders };
}

/**
 * Resolve raw observation codes → { speciesCode, commonName }, normalizing eBird
 * sub-forms (domestic/issf/form) to their parent species via reportAs — so the same
 * bird matches across checklists regardless of the form it was reported at, and the
 * real common name shows instead of a raw code like "rocpig1".
 */
export async function resolveSpecies(
  codes: string[]
): Promise<Record<string, { speciesCode: string; commonName: string }>> {
  const cache = await ensureTaxonomy();
  const out: Record<string, { speciesCode: string; commonName: string }> = {};
  for (const c of codes) {
    const norm = cache.reportAs[c] ?? c;
    const name = cache.byCode[norm] || cache.byCode[c] || norm;
    out[c] = { speciesCode: norm, commonName: name };
  }
  return out;
}
