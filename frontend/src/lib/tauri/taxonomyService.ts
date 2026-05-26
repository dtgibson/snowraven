import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { storage } from '../storage';

const EBIRD_BASE = 'https://api.ebird.org/v2';

interface TaxonEntry {
  speciesCode?: string;
  sciName?: string;
  comName?: string;
  taxonOrder?: number;
}

interface TaxonomyCache {
  bySci: Record<string, string>;
  byCom: Record<string, string>;
  byOrder: Record<string, number>;
  loadedAt: number;
}

const DB_NAME = 'snowraven-taxonomy';
const STORE_NAME = 'cache';
const CACHE_KEY = 'taxonomy-v2025';

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

// In-memory fallback for the session (populated after first load)
let _memCache: TaxonomyCache | null = null;

async function ensureTaxonomy(): Promise<TaxonomyCache> {
  if (_memCache) return _memCache;

  const cached = await readCache();
  // Cache valid for 7 days
  if (cached && Date.now() - cached.loadedAt < 7 * 24 * 60 * 60 * 1000) {
    _memCache = cached;
    return cached;
  }

  const ebirdKey = await storage.getApiKey('ebird');
  const headers: Record<string, string> = ebirdKey ? { 'x-ebirdapitoken': ebirdKey } : {};

  const res = await tauriFetch(
    `${EBIRD_BASE}/ref/taxonomy/ebird?fmt=json&cat=species`,
    { headers }
  );
  if (!res.ok) throw new Error(`eBird taxonomy fetch failed (HTTP ${res.status}).`);

  const taxonomy = await res.json() as TaxonEntry[];
  if (!Array.isArray(taxonomy) || taxonomy.length < 100) {
    throw new Error('eBird taxonomy response was empty or incomplete. Check your API key and internet connection.');
  }
  const bySci: Record<string, string> = {};
  const byCom: Record<string, string> = {};
  const byOrder: Record<string, number> = {};

  for (const taxon of taxonomy) {
    const code = taxon.speciesCode ?? '';
    if (!code) continue;
    const sci = (taxon.sciName ?? '').toLowerCase();
    const com = (taxon.comName ?? '').toLowerCase();
    if (sci) bySci[sci] = code;
    if (com) {
      byCom[com] = code;
      if (taxon.taxonOrder != null) byOrder[com] = taxon.taxonOrder;
    }
  }

  const fresh: TaxonomyCache = { bySci, byCom, byOrder, loadedAt: Date.now() };
  _memCache = fresh;
  writeCache(fresh); // fire-and-forget
  return fresh;
}

interface SpeciesItem { commonName: string; scientificName: string }

export async function getTaxonomyCodes(
  species: SpeciesItem[]
): Promise<{ codes: Record<string, string>; orders: Record<string, number> }> {
  let cache: TaxonomyCache;
  try {
    cache = await ensureTaxonomy();
  } catch {
    return { codes: {}, orders: {} };
  }

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
