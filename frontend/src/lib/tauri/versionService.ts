import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getVersion } from '@tauri-apps/api/app';

const GITHUB_API = 'https://api.github.com/repos/dtgibson/snowraven/releases/latest';

export interface VersionCheckResult {
  current: string;
  latest: string;
  up_to_date: boolean;
}

export async function checkVersion(): Promise<VersionCheckResult> {
  const current = await getVersion();

  const res = await tauriFetch(GITHUB_API, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (res.status === 404) {
    return { current, latest: current, up_to_date: true };
  }
  if (!res.ok) {
    throw Object.assign(
      new Error('Could not reach GitHub to check for updates.'),
      { status: 503 }
    );
  }

  const data = await res.json() as { tag_name: string };
  const latest = data.tag_name.replace(/^v/, '');
  return { current, latest, up_to_date: current === latest };
}
