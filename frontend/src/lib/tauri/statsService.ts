import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { storage } from '../storage';

const EBIRD_BASE = 'https://api.ebird.org/v2';

export interface NemesisSpecies {
  commonName: string;
  recentDate: string;
}

export async function getNemesis(
  lat: number,
  lng: number,
  dist: number
): Promise<{ species: NemesisSpecies[] }> {
  const key = await storage.getApiKey('ebird');
  if (!key) {
    throw Object.assign(new Error('eBird API key not configured.'), { status: 503 });
  }

  const url = `${EBIRD_BASE}/data/obs/geo/recent?lat=${lat}&lng=${lng}&dist=${dist}&back=30`;
  const res = await tauriFetch(url, { headers: { 'X-eBirdApiToken': key } });
  if (!res.ok) {
    throw Object.assign(
      new Error(`eBird API error: ${res.status}`),
      { status: 502, detail: `eBird API error: ${res.status}` }
    );
  }

  const observations = await res.json() as Array<Record<string, unknown>>;
  const speciesDates = new Map<string, string>();
  for (const obs of observations) {
    const name = (obs['comName'] as string) ?? '';
    const date = (obs['obsDt'] as string) ?? '';
    if (!name) continue;
    if (!speciesDates.has(name) || date > speciesDates.get(name)!) {
      speciesDates.set(name, date);
    }
  }

  const species: NemesisSpecies[] = [...speciesDates.entries()]
    .map(([commonName, date]) => ({ commonName, recentDate: date.slice(0, 10) }))
    .sort((a, b) => b.recentDate.localeCompare(a.recentDate));

  return { species };
}
