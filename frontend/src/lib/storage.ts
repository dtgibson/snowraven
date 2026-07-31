import { isTauri } from './platform';

export interface FileMetadata {
  filename: string;
  uploadedAt: string;
}

export interface FilesStatus {
  ebird: FileMetadata | null;
  ml: FileMetadata | null;
}

// ── Offline-support persisted shapes ──────────────────────────────────────────
// All three stores live in their OWN files on desktop (never settings.json — FR-42)
// and as one-file-per-key generic settings on web/Pi.

// A tuned maplibre StyleSpecification persisted whole for offline map mount (FR-01/02/05/06).
// `savedAt` is provenance only (QA-04) — NOT a TTL gate (FR-05 unbounded).
export interface PersistedStyle {
  variant: string;
  style: unknown; // maplibre StyleSpecification JSON (JSON-serializable)
  savedAt: number; // ms epoch
}

// One replayed network response (weather/tide/checklist) — FR-31..FR-34.
export interface ReplayEntry {
  data: unknown; // response JSON
  loadedAt: number; // ms epoch — the FR-31 staleness timestamp
  bytes: number; // serialized length, for the byte-cap eviction
}

// Whole-document replay store, rewritten atomically per put.
// `order` is an explicit oldest-loaded → newest-loaded list (a put moves/appends
// its key to the tail), so eviction is correct without relying on object key order.
export interface ReplayStore {
  version: number;
  entries: Record<string, ReplayEntry>;
  order: string[];
}

// One completed offline region (desktop only) — FR-13/17/19.
export interface RegionEntry {
  regionId: string;
  name: string;
  kind: 'county' | 'state';
  stateCode: string;
  countyName?: string;
  extent: [number, number, number, number]; // [w, s, e, n] WGS84
  minZoom: number;
  maxZoom: number; // baked range (FR-17 over-zoom fallback)
  bytes: number; // on-disk size
  downloadedAt: number; // ms epoch
  sourceVersion: string; // catalog/bake version (FR-19 supersede)
}

// Manifest of all completed regions. Empty (never null) when absent so callers
// don't branch (FR-13/14/19).
export interface RegionsManifest {
  version: number;
  regions: RegionEntry[];
}

export interface StorageAdapter {
  getApiKey(service: 'ebird' | 'openweather'): Promise<string | null>;
  setApiKey(service: 'ebird' | 'openweather', value: string): Promise<void>;
  deleteApiKey(service: 'ebird' | 'openweather'): Promise<void>;
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;
  deleteSetting(key: string): Promise<void>;
  getFilesStatus(): Promise<FilesStatus>;
  readFile(name: 'ebird' | 'ml'): Promise<string | null>;
  writeFile(name: 'ebird' | 'ml', content: string, filename: string): Promise<void>;
  deleteFile(name: 'ebird' | 'ml'): Promise<void>;

  // ── Offline support — persisted style (FR-01/02/05/06/42) ──
  getStyleBlob(variant: string): Promise<PersistedStyle | null>;
  setStyleBlob(variant: string, blob: PersistedStyle): Promise<void>;

  // ── Offline support — replay store (FR-32/33/34) ──
  getReplayStore(): Promise<ReplayStore | null>;
  setReplayStore(store: ReplayStore): Promise<void>;

  // ── Offline support — region files, DESKTOP ONLY (FR-12/16/20) ──
  // Downloads write to a temp `.partial` name and atomic-rename on completion.
  writeRegionPartial(regionId: string, bytes: Uint8Array): Promise<void>;
  renameRegionPartial(regionId: string): Promise<void>;
  writeRegionFile(regionId: string, bytes: Uint8Array): Promise<void>;
  readRegionBytes(regionId: string, offset: number, length: number): Promise<ArrayBuffer>;
  removeRegionFile(regionId: string): Promise<void>;

  // ── Offline support — regions manifest (FR-13/14/19) ──
  getRegionsManifest(): Promise<RegionsManifest>;
  setRegionsManifest(m: RegionsManifest): Promise<void>;
}

// Region id shape guard (NFR-12/QA-39): `us-ca-001`, `us-ca`, etc.
// Validate BEFORE any path interpolation — never interpolate an unvalidated id.
const REGION_ID_RE = /^[a-z]{2}(-[a-z0-9-]{1,40})?$/;
function assertRegionId(regionId: string): void {
  if (!REGION_ID_RE.test(regionId)) {
    throw new Error(`Invalid region id: ${JSON.stringify(regionId)}`);
  }
}

function regionDownloadsUnavailable(): never {
  throw new Error('Region downloads are not available in the browser build');
}

class WebStorage implements StorageAdapter {
  async getApiKey(service: 'ebird' | 'openweather'): Promise<string | null> {
    const res = await fetch('/settings/keys');
    if (!res.ok) return null;
    const data = await res.json() as Record<string, string | null>;
    return data[service] ?? null;
  }

  async setApiKey(service: 'ebird' | 'openweather', value: string): Promise<void> {
    await fetch(`/settings/keys/${service}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  }

  async deleteApiKey(service: 'ebird' | 'openweather'): Promise<void> {
    await fetch(`/settings/keys/${service}`, { method: 'DELETE' });
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const res = await fetch(`/settings/${key}`);
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const res = await fetch(`/settings/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    // A resolved fetch is not necessarily a saved setting. Propagate non-2xx
    // responses so controlled Settings rows can restore the last durable value.
    if (!res.ok) throw new Error(`Setting save failed (${res.status})`);
  }

  async deleteSetting(key: string): Promise<void> {
    await fetch(`/settings/${key}`, { method: 'DELETE' });
  }

  async getFilesStatus(): Promise<FilesStatus> {
    const res = await fetch('/settings/files');
    if (!res.ok) return { ebird: null, ml: null };
    return res.json() as Promise<FilesStatus>;
  }

  async readFile(name: 'ebird' | 'ml'): Promise<string | null> {
    const res = await fetch(`/settings/files/${name}`);
    if (!res.ok) return null;
    return res.text();
  }

  async writeFile(name: 'ebird' | 'ml', content: string, filename: string): Promise<void> {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'text/csv' }), filename);
    await fetch(`/settings/files/${name}`, { method: 'POST', body: form });
  }

  async deleteFile(name: 'ebird' | 'ml'): Promise<void> {
    await fetch(`/settings/files/${name}`, { method: 'DELETE' });
  }

  // ── Offline support ──
  // Persisted style + replay round-trip through the generic /settings/{key} route
  // (one file per key on the backend → FR-42 satisfied structurally). getSetting/
  // setSetting already send/receive the RAW JSON value (FR-41 contract).
  async getStyleBlob(variant: string): Promise<PersistedStyle | null> {
    return this.getSetting<PersistedStyle>(`map-style-${variant}`);
  }

  async setStyleBlob(variant: string, blob: PersistedStyle): Promise<void> {
    await this.setSetting(`map-style-${variant}`, blob);
  }

  async getReplayStore(): Promise<ReplayStore | null> {
    return this.getSetting<ReplayStore>('replay-store-v1');
  }

  async setReplayStore(store: ReplayStore): Promise<void> {
    await this.setSetting('replay-store-v1', store);
  }

  // Region downloads are desktop-only (FR-20). Fail loudly — callers gate on
  // isTauri(), but a stray call must not silently no-op.
  async writeRegionPartial(regionId: string, bytes: Uint8Array): Promise<void> {
    void regionId; void bytes;
    regionDownloadsUnavailable();
  }

  async renameRegionPartial(regionId: string): Promise<void> {
    void regionId;
    regionDownloadsUnavailable();
  }

  async writeRegionFile(regionId: string, bytes: Uint8Array): Promise<void> {
    void regionId; void bytes;
    regionDownloadsUnavailable();
  }

  async readRegionBytes(regionId: string, offset: number, length: number): Promise<ArrayBuffer> {
    void regionId; void offset; void length;
    return regionDownloadsUnavailable();
  }

  async removeRegionFile(regionId: string): Promise<void> {
    void regionId;
    regionDownloadsUnavailable();
  }

  // Empty manifest on web/Pi (desktop-only feature) — never null so the UI
  // doesn't branch. setRegionsManifest is a friendly no-op (the UI won't call it).
  async getRegionsManifest(): Promise<RegionsManifest> {
    return { version: 1, regions: [] };
  }

  async setRegionsManifest(m: RegionsManifest): Promise<void> {
    void m; // no-op: regions are desktop-only
  }
}

// All persistent Tauri data lives in AppLocalData/data/:
//   api-keys.json   — API keys (ebird, openweather)
//   settings.json   — app settings (map center, zoom, etc.)
//   metadata.json   — uploaded file metadata
//   ebird-backup.csv
//   ml-export.csv
//
// tauri-plugin-fs + AppLocalData is the single mechanism for all of it.
// localStorage is NOT used — it is ephemeral in Tauri's WKWebView (cleared on every relaunch).
// The system Keychain is NOT used — it requires entitlements not configured in this app.
const DATA_DIR = 'data';
const API_KEYS_PATH = `${DATA_DIR}/api-keys.json`;
const SETTINGS_PATH = `${DATA_DIR}/settings.json`;
const META_PATH = `${DATA_DIR}/metadata.json`;
const FILE_PATHS: Record<'ebird' | 'ml', string> = {
  ebird: `${DATA_DIR}/ebird-backup.csv`,
  ml: `${DATA_DIR}/ml-export.csv`,
};

// Offline-support own-file locations (never settings.json — FR-42).
const STYLE_DIR = `${DATA_DIR}/map-style`;
const REPLAY_PATH = `${DATA_DIR}/replay.json`;
const REGIONS_DIR = `${DATA_DIR}/regions`;
const REGIONS_MANIFEST_PATH = `${DATA_DIR}/regions-manifest.json`;
const regionFilePath = (regionId: string) => `${REGIONS_DIR}/${regionId}.pmtiles`;
const regionPartialPath = (regionId: string) => `${REGIONS_DIR}/.${regionId}.partial`;
const styleFilePath = (variant: string) => `${STYLE_DIR}/${variant}.json`;

class TauriStorage implements StorageAdapter {
  // Reads a JSON file from AppLocalData. Returns {} if the file doesn't exist.
  private async readJson<T extends Record<string, unknown>>(path: string): Promise<T> {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    if (!await exists(path, { baseDir: BaseDirectory.AppLocalData })) return {} as T;
    return JSON.parse(await readTextFile(path, { baseDir: BaseDirectory.AppLocalData })) as T;
  }

  // Writes a JSON file to AppLocalData, creating the data/ directory if needed.
  private async writeJson(path: string, data: Record<string, unknown>): Promise<void> {
    const { mkdir, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(path, JSON.stringify(data), { baseDir: BaseDirectory.AppLocalData });
  }

  async getApiKey(service: 'ebird' | 'openweather'): Promise<string | null> {
    try {
      const keys = await this.readJson<Record<string, string>>(API_KEYS_PATH);
      const value = keys[service];
      return value && value.length > 0 ? value : null;
    } catch {
      return null;
    }
  }

  async setApiKey(service: 'ebird' | 'openweather', value: string): Promise<void> {
    const keys = await this.readJson<Record<string, string>>(API_KEYS_PATH).catch(() => ({} as Record<string, string>));
    keys[service] = value;
    await this.writeJson(API_KEYS_PATH, keys);
  }

  async deleteApiKey(service: 'ebird' | 'openweather'): Promise<void> {
    const keys = await this.readJson<Record<string, string>>(API_KEYS_PATH).catch(() => ({} as Record<string, string>));
    delete keys[service];
    await this.writeJson(API_KEYS_PATH, keys);
  }

  async getSetting<T>(key: string): Promise<T | null> {
    try {
      const settings = await this.readJson(SETTINGS_PATH);
      const value = settings[key];
      return value !== undefined ? value as T : null;
    } catch {
      return null;
    }
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const settings = await this.readJson(SETTINGS_PATH).catch(() => ({} as Record<string, unknown>));
    settings[key] = value as unknown;
    await this.writeJson(SETTINGS_PATH, settings);
  }

  async deleteSetting(key: string): Promise<void> {
    const settings = await this.readJson(SETTINGS_PATH).catch(() => ({} as Record<string, unknown>));
    delete settings[key];
    await this.writeJson(SETTINGS_PATH, settings);
  }

  async getFilesStatus(): Promise<FilesStatus> {
    try {
      const meta = await this.readJson<{ ebird?: FileMetadata | null; ml?: FileMetadata | null }>(META_PATH);
      return { ebird: meta.ebird ?? null, ml: meta.ml ?? null };
    } catch {
      return { ebird: null, ml: null };
    }
  }

  async readFile(name: 'ebird' | 'ml'): Promise<string | null> {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const path = FILE_PATHS[name];
    try {
      if (!await exists(path, { baseDir: BaseDirectory.AppLocalData })) return null;
      return await readTextFile(path, { baseDir: BaseDirectory.AppLocalData });
    } catch {
      return null;
    }
  }

  async writeFile(name: 'ebird' | 'ml', content: string, filename: string): Promise<void> {
    const { mkdir, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(FILE_PATHS[name], content, { baseDir: BaseDirectory.AppLocalData });
    const meta = await this.getFilesStatus();
    meta[name] = { filename, uploadedAt: new Date().toISOString() };
    await writeTextFile(META_PATH, JSON.stringify(meta), { baseDir: BaseDirectory.AppLocalData });
  }

  async deleteFile(name: 'ebird' | 'ml'): Promise<void> {
    const { remove, exists, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const path = FILE_PATHS[name];
    try {
      if (await exists(path, { baseDir: BaseDirectory.AppLocalData })) {
        await remove(path, { baseDir: BaseDirectory.AppLocalData });
      }
    } catch { /* best-effort */ }
    const meta = await this.getFilesStatus();
    meta[name] = null;
    await writeTextFile(META_PATH, JSON.stringify(meta), { baseDir: BaseDirectory.AppLocalData });
  }

  // ── Offline support — persisted style (FR-01/02/05/06/42) ──
  // OWN file data/map-style/<variant>.json. Never touches settings.json.
  async getStyleBlob(variant: string): Promise<PersistedStyle | null> {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const path = styleFilePath(variant);
    try {
      if (!await exists(path, { baseDir: BaseDirectory.AppLocalData })) return null;
      return JSON.parse(await readTextFile(path, { baseDir: BaseDirectory.AppLocalData })) as PersistedStyle;
    } catch {
      return null;
    }
  }

  async setStyleBlob(variant: string, blob: PersistedStyle): Promise<void> {
    const { mkdir, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await mkdir(STYLE_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(styleFilePath(variant), JSON.stringify(blob), { baseDir: BaseDirectory.AppLocalData });
  }

  // ── Offline support — replay store (FR-32/33/34) ──
  // OWN file data/replay.json.
  async getReplayStore(): Promise<ReplayStore | null> {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    try {
      if (!await exists(REPLAY_PATH, { baseDir: BaseDirectory.AppLocalData })) return null;
      return JSON.parse(await readTextFile(REPLAY_PATH, { baseDir: BaseDirectory.AppLocalData })) as ReplayStore;
    } catch {
      return null;
    }
  }

  async setReplayStore(store: ReplayStore): Promise<void> {
    const { mkdir, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(REPLAY_PATH, JSON.stringify(store), { baseDir: BaseDirectory.AppLocalData });
  }

  // ── Offline support — region files (FR-12/16) ──
  // Binary writes to data/regions/. Download flow writes a temp `.partial`,
  // then atomic-renames on completion.
  async writeRegionPartial(regionId: string, bytes: Uint8Array): Promise<void> {
    assertRegionId(regionId);
    const { mkdir, writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await mkdir(REGIONS_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeFile(regionPartialPath(regionId), bytes, { baseDir: BaseDirectory.AppLocalData });
  }

  async renameRegionPartial(regionId: string): Promise<void> {
    assertRegionId(regionId);
    const { rename, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await rename(regionPartialPath(regionId), regionFilePath(regionId), {
      oldPathBaseDir: BaseDirectory.AppLocalData,
      newPathBaseDir: BaseDirectory.AppLocalData,
    });
  }

  // Convenience whole-write: partial → rename, so the final file is never seen
  // half-written (atomic completion).
  async writeRegionFile(regionId: string, bytes: Uint8Array): Promise<void> {
    await this.writeRegionPartial(regionId, bytes);
    await this.renameRegionPartial(regionId);
  }

  // TRUE range read via open + seek + sized read (NOT whole-file readFile).
  // `read` may return fewer bytes than requested near EOF, so loop on the
  // actual bytes-read and return only what was read.
  async readRegionBytes(regionId: string, offset: number, length: number): Promise<ArrayBuffer> {
    assertRegionId(regionId);
    const { open, SeekMode, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const handle = await open(regionFilePath(regionId), {
      read: true,
      baseDir: BaseDirectory.AppLocalData,
    });
    try {
      await handle.seek(offset, SeekMode.Start);
      const buf = new Uint8Array(length);
      let total = 0;
      while (total < length) {
        const chunk = buf.subarray(total);
        const n = await handle.read(chunk);
        if (n === null || n === 0) break; // EOF
        total += n;
      }
      // Return exactly the bytes read as a standalone ArrayBuffer (never a
      // view onto a larger buffer, so the consumer owns the full slice).
      return buf.slice(0, total).buffer;
    } finally {
      await handle.close();
    }
  }

  async removeRegionFile(regionId: string): Promise<void> {
    assertRegionId(regionId);
    const { remove, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    // Remove the completed file and any stray `.partial` (swept on manager open).
    for (const path of [regionFilePath(regionId), regionPartialPath(regionId)]) {
      try {
        if (await exists(path, { baseDir: BaseDirectory.AppLocalData })) {
          await remove(path, { baseDir: BaseDirectory.AppLocalData });
        }
      } catch { /* best-effort: ignore if absent */ }
    }
  }

  // ── Offline support — regions manifest (FR-13/14/19) ──
  // OWN file data/regions-manifest.json. Empty (never null) when absent.
  async getRegionsManifest(): Promise<RegionsManifest> {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    try {
      if (!await exists(REGIONS_MANIFEST_PATH, { baseDir: BaseDirectory.AppLocalData })) {
        return { version: 1, regions: [] };
      }
      return JSON.parse(await readTextFile(REGIONS_MANIFEST_PATH, { baseDir: BaseDirectory.AppLocalData })) as RegionsManifest;
    } catch {
      return { version: 1, regions: [] };
    }
  }

  async setRegionsManifest(m: RegionsManifest): Promise<void> {
    const { mkdir, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(REGIONS_MANIFEST_PATH, JSON.stringify(m), { baseDir: BaseDirectory.AppLocalData });
  }
}

export const storage: StorageAdapter = isTauri()
  ? new TauriStorage()
  : new WebStorage();
