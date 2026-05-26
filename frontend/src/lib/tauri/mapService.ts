import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
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
  if (!codes) return [];
  const headers = await ebirdHeaders();
  const codeSet = new Set(codes.split(',').map(c => c.trim()).filter(Boolean));
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
    if (!codeSet.has(code)) continue;
    const locId = (obs['locId'] as string) ?? '';
    const groupKey = `${code}|${locId}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        speciesCode: code,
        comName: (obs['comName'] as string) ?? '',
        locId,
        locName: (obs['locName'] as string) ?? '',
        lat: (obs['lat'] as number),
        lng: (obs['lng'] as number),
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
