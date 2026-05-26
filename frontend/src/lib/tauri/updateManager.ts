import { check } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';

export type UpdateCheckResult =
  | { status: 'up-to-date'; current: string }
  | { status: 'available'; current: string; latest: string; body: string | null }
  | { status: 'error'; message: string };

export type DownloadProgress = { downloaded: number; total: number | null };

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const current = await getVersion();
  try {
    const update = await check();
    if (!update?.available) {
      return { status: 'up-to-date', current };
    }
    return {
      status: 'available',
      current,
      latest: update.version,
      body: update.body ?? null,
    };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

export async function downloadAndInstall(
  onProgress?: (p: DownloadProgress) => void
): Promise<void> {
  const update = await check();
  if (!update?.available) return;
  let downloaded = 0;
  let total: number | null = null;
  await update.downloadAndInstall(event => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? null;
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      onProgress?.({ downloaded, total });
    }
  });
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
