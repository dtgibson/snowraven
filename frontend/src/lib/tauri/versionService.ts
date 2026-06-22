import { tauriFetch } from './http';
import { getVersion } from '@tauri-apps/api/app';

const GITHUB_API = 'https://api.github.com/repos/dtgibson/snowraven/releases/latest';

export interface VersionCheckResult {
  current: string;
  latest: string;
  up_to_date: boolean;
}

export async function checkVersion(): Promise<VersionCheckResult> {
  const current = await getVersion();

  // A connection-level failure (offline / DNS / timeout) makes tauriFetch reject
  // BEFORE this line — that rejection has no HTTP status, so isOfflineError
  // classifies it as offline (FR-36/FR-39). We only reach here with a real HTTP
  // response.
  const res = await tauriFetch(GITHUB_API, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  // FR-39: a 404 / no-release / any non-OK status is a REACHABLE-BUT-ERROR
  // outcome (a 502-class server error), NOT "up to date". The old code reported
  // up_to_date=true on a 404 — the specific false positive being fixed. Throwing
  // a status >= 100 keeps isOfflineError false, so the caller shows the generic
  // update-check error rather than the offline message.
  if (!res.ok) {
    throw Object.assign(
      new Error('The update server returned an error.'),
      { status: 502 }
    );
  }

  const data = await res.json() as { tag_name: string };
  const latest = data.tag_name.replace(/^v/, '');
  return { current, latest, up_to_date: current === latest };
}
