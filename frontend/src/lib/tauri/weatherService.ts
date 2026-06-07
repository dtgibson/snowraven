import { tauriFetch } from './http';
import { invoke } from '@tauri-apps/api/core';
import { storage } from '../storage';
import { formatWeather, type HourlyResponse } from '../weatherFormatter';

const EBIRD_BASE = 'https://api.ebird.org/v2';
const OWM_BASE = 'https://api.openweathermap.org/data/3.0';

interface ChecklistData {
  obs_dt: string;
  loc_name: string;
  lat: number;
  lng: number;
  duration_hrs: number;
}

async function fetchChecklist(checklistId: string, ebirdKey: string): Promise<ChecklistData> {
  const headers = { 'X-eBirdApiToken': ebirdKey };

  const res = await tauriFetch(`${EBIRD_BASE}/product/checklist/view/${checklistId}`, { headers });
  if (res.status === 404) throw Object.assign(new Error('Checklist not found. Check the ID and try again.'), { status: 400 });
  if (!res.ok) throw Object.assign(new Error('Could not fetch checklist data. Please try again.'), { status: 502 });
  const data = await res.json() as Record<string, unknown>;

  const locId = data['locId'] as string;
  let locName = (data['locName'] as string | undefined) ?? '';
  let lat: number | null = null;
  let lng: number | null = null;

  // Primary: bounding box centre from region info
  const regionRes = await tauriFetch(`${EBIRD_BASE}/ref/region/info/${locId}`, { headers });
  if (regionRes.ok) {
    const regionData = await regionRes.json() as Record<string, unknown>;
    if (!locName) locName = (regionData['result'] as string | undefined) ?? (regionData['name'] as string | undefined) ?? '';
    const bounds = (regionData['bounds'] as Record<string, number> | undefined) ?? {};
    if ('minX' in bounds && 'maxX' in bounds && 'minY' in bounds && 'maxY' in bounds) {
      lat = (bounds['minY'] + bounds['maxY']) / 2;
      lng = (bounds['minX'] + bounds['maxX']) / 2;
    }
  }

  // Fallback: exact GPS pin from product/lists
  if (lat === null || lng === null) {
    const listsRes = await tauriFetch(`${EBIRD_BASE}/product/lists/${locId}?maxResults=1`, { headers });
    if (listsRes.ok) {
      const listsData = await listsRes.json() as unknown;
      const first = Array.isArray(listsData) ? listsData[0] : listsData;
      if (first) {
        const loc = (first as Record<string, unknown>)['loc'] ?? (first as Record<string, unknown>)['location'] ?? {};
        const locObj = loc as Record<string, unknown>;
        if (!locName) locName = (locObj['name'] as string | undefined) ?? '';
        lat = (locObj['lat'] ?? locObj['latitude']) as number | null;
        lng = ((locObj['lng'] ?? locObj['longitude'] ?? locObj['lon']) as number | null);
      }
    }
  }

  // Last resort: recent observations
  if (lat === null || lng === null) {
    const obsRes = await tauriFetch(`${EBIRD_BASE}/data/obs/${locId}/recent?back=365`, { headers });
    if (obsRes.ok) {
      const obsList = await obsRes.json() as Array<Record<string, unknown>>;
      if (obsList.length > 0) {
        lat = obsList[0]['lat'] as number;
        lng = obsList[0]['lng'] as number;
      }
    }
  }

  if (lat === null || lng === null) {
    throw Object.assign(new Error(`Could not find coordinates for location ${locId}.`), { status: 502 });
  }

  return {
    obs_dt: data['obsDt'] as string,
    loc_name: locName || locId,
    lat,
    lng,
    duration_hrs: (data['durationHrs'] as number | undefined) ?? 1,
  };
}

async function fetchHistorical(lat: number, lng: number, dt: number, owmKey: string): Promise<HourlyResponse> {
  const url = `${OWM_BASE}/onecall/timemachine?lat=${lat}&lon=${lng}&dt=${dt}&appid=${owmKey}&units=imperial`;
  const res = await tauriFetch(url);
  if (!res.ok) throw Object.assign(new Error('Weather data unavailable for this checklist.'), { status: 502 });
  return res.json() as Promise<HourlyResponse>;
}

// Parse "YYYY-MM-DD HH:MM" or "YYYY-MM-DD" as local time in the given timezone,
// return Unix timestamp in milliseconds. Uses iterative convergence to handle DST.
function parseLocalDateTimeInZone(dtStr: string, tzName: string): number {
  const normalized = dtStr.length === 10 ? `${dtStr} 00:00` : dtStr;
  const [datePart, timePart] = normalized.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  // Start with a UTC guess and iterate until local time matches
  let utcMs = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i++) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tzName,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(new Date(utcMs));
    const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
    const localHour = get('hour') === 24 ? 0 : get('hour');
    const localMin = get('minute');
    const localYear = get('year');
    const localMonth = get('month');
    const localDay = get('day');

    const diffMs =
      (year - localYear) * 365.25 * 86400000 +
      (month - localMonth) * 30 * 86400000 +
      (day - localDay) * 86400000 +
      (hour - localHour) * 3600000 +
      (minute - localMin) * 60000;

    if (Math.abs(diffMs) < 60000) break;
    utcMs += diffMs;
  }
  return utcMs;
}

export interface WeatherResult {
  formatted: string;
  checklist_id: string;
  loc_name: string;
  obs_dt: string;
}

export async function getWeather(checklistId: string): Promise<WeatherResult> {
  const [ebirdKey, owmKey] = await Promise.all([
    storage.getApiKey('ebird'),
    storage.getApiKey('openweather'),
  ]);

  if (!ebirdKey || !owmKey) {
    throw Object.assign(
      new Error('API key not configured. Add it in Settings.'),
      { status: 500, detail: 'API key not configured. Add it in Settings.' }
    );
  }

  const checklist = await fetchChecklist(checklistId, ebirdKey);
  const tzName: string = await invoke('get_timezone', { lat: checklist.lat, lng: checklist.lng });

  const obsDtMs = parseLocalDateTimeInZone(checklist.obs_dt, tzName);
  const startTs = Math.floor(obsDtMs / 1000);
  const durationMs = (checklist.duration_hrs || 1) * 3600 * 1000;
  const endTs = Math.floor((obsDtMs + durationMs) / 1000);

  const timestamps = startTs === endTs ? [startTs] : [startTs, endTs];

  const hourlyResponses = await Promise.all(
    timestamps.map(ts => fetchHistorical(checklist.lat, checklist.lng, ts, owmKey))
  );

  return {
    formatted: formatWeather(hourlyResponses, tzName),
    checklist_id: checklistId,
    loc_name: checklist.loc_name,
    obs_dt: checklist.obs_dt,
  };
}
