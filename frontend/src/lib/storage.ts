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
// Both stores live in their OWN files on desktop (never settings.json — FR-42)
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
const styleFilePath = (variant: string) => `${STYLE_DIR}/${variant}.json`;

class TauriStorage implements StorageAdapter {
  // The fs plugin is dynamically imported ONCE per adapter and every method
  // awaits the same promise. Besides skipping a resolver round-trip per call,
  // this keeps concurrent operations on one module instance — vitest's
  // per-call dynamic-import interception is not reentrant, so the
  // settings-write-clobber tests need a single import to mock reliably.
  private fsModule: Promise<typeof import('@tauri-apps/plugin-fs')> | null = null;

  private fs(): Promise<typeof import('@tauri-apps/plugin-fs')> {
    this.fsModule ??= import('@tauri-apps/plugin-fs');
    return this.fsModule;
  }

  // ── settings-write-clobber fix (v1.0.9): per-document serialization ──
  // Every save rewrites its whole JSON document from a base read, so two
  // overlapping read-modify-write cycles silently drop each other's keys
  // (last writer wins with a stale base — how the projects ledger was lost
  // in 1.0.8). Every method touching a shared JSON document (api-keys.json,
  // settings.json, metadata.json) therefore runs as one link on that
  // document's promise chain: each cycle starts from the previous write's
  // result. Reads are chained too — these are tiny local files, and it buys
  // read-your-writes ordering for free.
  // Two structural rules keep the chain safe:
  //   1. a link NEVER awaits another chained op (deadlock by construction) —
  //      inside a link, use only the readJson/writeJson/readMeta primitives;
  //   2. a failed link rejects its own caller only — the stored tail
  //      swallows the rejection, so one failed write never poisons the chain.
  // Not a cache (cacheInventory.test.ts): keys are the three internal path
  // constants, values are tail promises — nothing is retained or evicted.
  private docChains: Record<string, Promise<void>> = {};

  private chain<T>(path: string, op: () => Promise<T>): Promise<T> {
    const prev = this.docChains[path] ?? Promise.resolve();
    const link = prev.then(op);
    this.docChains[path] = link.then(() => undefined, () => undefined);
    return link;
  }

  // Reads a JSON file from AppLocalData. Returns {} if the file doesn't exist.
  private async readJson<T extends Record<string, unknown>>(path: string): Promise<T> {
    const { readTextFile, exists, BaseDirectory } = await this.fs();
    if (!await exists(path, { baseDir: BaseDirectory.AppLocalData })) return {} as T;
    return JSON.parse(await readTextFile(path, { baseDir: BaseDirectory.AppLocalData })) as T;
  }

  // Writes a JSON file to AppLocalData, creating the data/ directory if needed.
  private async writeJson(path: string, data: Record<string, unknown>): Promise<void> {
    const { mkdir, writeTextFile, BaseDirectory } = await this.fs();
    await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(path, JSON.stringify(data), { baseDir: BaseDirectory.AppLocalData });
  }

  async getApiKey(service: 'ebird' | 'openweather'): Promise<string | null> {
    return this.chain(API_KEYS_PATH, async () => {
      try {
        const keys = await this.readJson<Record<string, string>>(API_KEYS_PATH);
        const value = keys[service];
        return value && value.length > 0 ? value : null;
      } catch {
        return null;
      }
    });
  }

  async setApiKey(service: 'ebird' | 'openweather', value: string): Promise<void> {
    return this.chain(API_KEYS_PATH, async () => {
      const keys = await this.readJson<Record<string, string>>(API_KEYS_PATH).catch(() => ({} as Record<string, string>));
      keys[service] = value;
      await this.writeJson(API_KEYS_PATH, keys);
    });
  }

  async deleteApiKey(service: 'ebird' | 'openweather'): Promise<void> {
    return this.chain(API_KEYS_PATH, async () => {
      const keys = await this.readJson<Record<string, string>>(API_KEYS_PATH).catch(() => ({} as Record<string, string>));
      delete keys[service];
      await this.writeJson(API_KEYS_PATH, keys);
    });
  }

  async getSetting<T>(key: string): Promise<T | null> {
    return this.chain(SETTINGS_PATH, async () => {
      try {
        const settings = await this.readJson(SETTINGS_PATH);
        const value = settings[key];
        return value !== undefined ? value as T : null;
      } catch {
        return null;
      }
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    return this.chain(SETTINGS_PATH, async () => {
      const settings = await this.readJson(SETTINGS_PATH).catch(() => ({} as Record<string, unknown>));
      settings[key] = value as unknown;
      await this.writeJson(SETTINGS_PATH, settings);
    });
  }

  async deleteSetting(key: string): Promise<void> {
    return this.chain(SETTINGS_PATH, async () => {
      const settings = await this.readJson(SETTINGS_PATH).catch(() => ({} as Record<string, unknown>));
      delete settings[key];
      await this.writeJson(SETTINGS_PATH, settings);
    });
  }

  // Unchained metadata read — the primitive that chained metadata links call
  // (getFilesStatus itself is chained; calling IT from inside a link would
  // deadlock on the chain, rule 1 above).
  private async readMeta(): Promise<FilesStatus> {
    try {
      const meta = await this.readJson<{ ebird?: FileMetadata | null; ml?: FileMetadata | null }>(META_PATH);
      return { ebird: meta.ebird ?? null, ml: meta.ml ?? null };
    } catch {
      return { ebird: null, ml: null };
    }
  }

  async getFilesStatus(): Promise<FilesStatus> {
    return this.chain(META_PATH, () => this.readMeta());
  }

  async readFile(name: 'ebird' | 'ml'): Promise<string | null> {
    const { readTextFile, exists, BaseDirectory } = await this.fs();
    const path = FILE_PATHS[name];
    try {
      if (!await exists(path, { baseDir: BaseDirectory.AppLocalData })) return null;
      return await readTextFile(path, { baseDir: BaseDirectory.AppLocalData });
    } catch {
      return null;
    }
  }

  async writeFile(name: 'ebird' | 'ml', content: string, filename: string): Promise<void> {
    // The CSV write rides the metadata link so the content and its metadata
    // entry stay consistent with each other under overlapping calls.
    return this.chain(META_PATH, async () => {
      const { mkdir, writeTextFile, BaseDirectory } = await this.fs();
      await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
      await writeTextFile(FILE_PATHS[name], content, { baseDir: BaseDirectory.AppLocalData });
      const meta = await this.readMeta();
      meta[name] = { filename, uploadedAt: new Date().toISOString() };
      await writeTextFile(META_PATH, JSON.stringify(meta), { baseDir: BaseDirectory.AppLocalData });
    });
  }

  async deleteFile(name: 'ebird' | 'ml'): Promise<void> {
    return this.chain(META_PATH, async () => {
      const { remove, exists, writeTextFile, BaseDirectory } = await this.fs();
      const path = FILE_PATHS[name];
      try {
        if (await exists(path, { baseDir: BaseDirectory.AppLocalData })) {
          await remove(path, { baseDir: BaseDirectory.AppLocalData });
        }
      } catch { /* best-effort */ }
      const meta = await this.readMeta();
      meta[name] = null;
      await writeTextFile(META_PATH, JSON.stringify(meta), { baseDir: BaseDirectory.AppLocalData });
    });
  }

  // ── Offline support — persisted style (FR-01/02/05/06/42) ──
  // OWN file data/map-style/<variant>.json. Never touches settings.json.
  async getStyleBlob(variant: string): Promise<PersistedStyle | null> {
    const { readTextFile, exists, BaseDirectory } = await this.fs();
    const path = styleFilePath(variant);
    try {
      if (!await exists(path, { baseDir: BaseDirectory.AppLocalData })) return null;
      return JSON.parse(await readTextFile(path, { baseDir: BaseDirectory.AppLocalData })) as PersistedStyle;
    } catch {
      return null;
    }
  }

  async setStyleBlob(variant: string, blob: PersistedStyle): Promise<void> {
    const { mkdir, writeTextFile, BaseDirectory } = await this.fs();
    await mkdir(STYLE_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(styleFilePath(variant), JSON.stringify(blob), { baseDir: BaseDirectory.AppLocalData });
  }

  // ── Offline support — replay store (FR-32/33/34) ──
  // OWN file data/replay.json.
  async getReplayStore(): Promise<ReplayStore | null> {
    const { readTextFile, exists, BaseDirectory } = await this.fs();
    try {
      if (!await exists(REPLAY_PATH, { baseDir: BaseDirectory.AppLocalData })) return null;
      return JSON.parse(await readTextFile(REPLAY_PATH, { baseDir: BaseDirectory.AppLocalData })) as ReplayStore;
    } catch {
      return null;
    }
  }

  async setReplayStore(store: ReplayStore): Promise<void> {
    const { mkdir, writeTextFile, BaseDirectory } = await this.fs();
    await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(REPLAY_PATH, JSON.stringify(store), { baseDir: BaseDirectory.AppLocalData });
  }
}

export const storage: StorageAdapter = isTauri()
  ? new TauriStorage()
  : new WebStorage();
