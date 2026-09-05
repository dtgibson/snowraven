import { isTauri } from './platform';

// Which device uploaded a data file (icloud-sync FR-11/FR-13). `deviceId` is
// a random per-install id (32 lowercase hex), never a hardware or account
// identifier; `label` is the user's device name or the platform word.
export interface FileOrigin {
  deviceId: string;
  label: string;
  platform: 'mac' | 'iphone' | 'ipad';
}

export interface FileMetadata {
  filename: string;
  uploadedAt: string;
  // icloud-sync (v1.0.11). Both optional and backward compatible: an entry
  // written before 1.0.11 has neither and is "local, no origin" (FR-17: equal
  // upload time with a shared record means identical; the first push stamps
  // `origin` = this device without touching `uploadedAt`).
  origin?: FileOrigin;
  // Set only by a synced pull that replaced the local copy (FR-25); a user
  // action on the row replaces the whole entry and so clears it.
  replacedBySyncAt?: string;
}

export interface FilesStatus {
  ebird: FileMetadata | null;
  ml: FileMetadata | null;
}

// ── API key entries (icloud-api-key-sync; schema.md "api-keys.json") ────────
// The values in api-keys.json stay top-level strings (byte-compatible with
// every shipped document); a sibling `meta` object carries, per slot, when
// the key was last changed and which device changed it, or a cleared marker
// left by a Clear made with the key switch on. A key with no meta entry is an
// UNTIMED key (saved before 1.0.12): it reads `changedAt: null`, never "now".

export type KeySlot = 'ebird' | 'openweather';

export type ApiKeyMeta =
  | { state: 'key'; changedAt: string; origin?: FileOrigin; replacedBySyncAt?: string }
  | { state: 'cleared'; clearedAt: string; origin: FileOrigin };

export interface ApiKeysDoc {
  ebird?: string;
  openweather?: string;
  meta?: Partial<Record<KeySlot, ApiKeyMeta>>;
}

export type ApiKeyEntry =
  | { state: 'key'; value: string; changedAt: string | null; origin: FileOrigin | null; replacedBySyncAt: string | null }
  | { state: 'cleared'; clearedAt: string; origin: FileOrigin };
export type ApiKeyEntries = Record<KeySlot, ApiKeyEntry | null>;

// The guard every sync-originated key link takes: the local entry the
// controller decided against (FR-26). Compared in memory inside the seam.
export type ExpectedKeyEntry =
  | { state: 'key'; value: string; changedAt: string | null }
  | { state: 'cleared'; clearedAt: string }
  | null;

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
  getApiKey(service: KeySlot): Promise<string | null>;
  // `origin` (icloud-api-key-sync FR-12): on Tauri builds every save stamps a
  // change time and, when given, this device as the key's origin; never
  // `replacedBySyncAt`. Web ignores it.
  setApiKey(service: KeySlot, value: string, origin?: FileOrigin): Promise<void>;
  // Removes the value AND its meta entry, marker included (FR-31).
  deleteApiKey(service: KeySlot): Promise<void>;

  // ── iCloud API key sync (icloud-api-key-sync; desktop + iOS only) ──
  // Every link below rides the api-keys.json chain with setApiKey and
  // deleteApiKey, so a user save and a synced arrival can never clobber each
  // other. The guarded links take the local entry the controller decided
  // against and return false, touching nothing, when it has changed since.
  getApiKeyEntries(): Promise<ApiKeyEntries>;
  // A Clear made with the key switch on: the value goes, a cleared marker
  // (clear time, this device) stays until the slot changes again (FR-28, OQ-8).
  clearApiKeyWithMarker(slot: KeySlot, marker: { clearedAt: string; origin: FileOrigin }): Promise<void>;
  // A received key lands with the shared entry's time and origin (FR-23);
  // `replaced` stamps replacedBySyncAt when a different local key existed.
  applySyncedKey(
    slot: KeySlot,
    entry: { value: string; changedAt: string; origin: FileOrigin },
    expect: ExpectedKeyEntry,
    replaced: boolean,
  ): Promise<boolean>;
  // A received cleared marker that wins removes the local key and keeps the
  // PEER's marker so the row can say who cleared it (FR-24, FR-42).
  applySyncedKeyClear(slot: KeySlot, marker: { clearedAt: string; origin: FileOrigin }, expect: ExpectedKeyEntry): Promise<boolean>;
  // Sets a key's time and origin without touching its value, only while the
  // value is still the one decided against: the seed stamp (FR-13), the adopt
  // stamp (OQ-3), and the origin stamp after a push of an origin-less key.
  stampApiKeyEntry(slot: KeySlot, stamp: { changedAt: string; origin: FileOrigin }, expectValue: string): Promise<boolean>;
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;
  deleteSetting(key: string): Promise<void>;
  getFilesStatus(): Promise<FilesStatus>;
  readFile(name: 'ebird' | 'ml'): Promise<string | null>;
  // `origin` (icloud-sync): written into the metadata entry when given (a
  // user upload with sync on passes this device), never `replacedBySyncAt`.
  writeFile(name: 'ebird' | 'ml', content: string, filename: string, origin?: FileOrigin): Promise<void>;
  deleteFile(name: 'ebird' | 'ml'): Promise<void>;

  // ── iCloud Sync (icloud-sync FR-15/FR-16/FR-31/FR-39; desktop + iOS only) ──
  // Every sync-originated write to metadata.json is one link on the same
  // per-document chain as writeFile/deleteFile, so a user upload and a synced
  // arrival can never clobber each other. Each takes the local entry's
  // `uploadedAt` the decision was made against and returns false, touching
  // nothing, when the entry has changed since (a user upload landed during
  // the download: the user wins, and the next check pushes it, FR-39).
  //
  // applySyncedFile: `materialize` performs the native pull (the csv bytes
  // never cross IPC); it runs INSIDE the link, and if it throws the link
  // rejects with metadata untouched (FR-29).
  applySyncedFile(
    name: 'ebird' | 'ml',
    entry: FileMetadata,
    expectLocalUploadedAt: string | null,
    materialize: () => Promise<void>,
  ): Promise<boolean>;
  // applySyncedClear: the deleteFile body under the same guard.
  applySyncedClear(name: 'ebird' | 'ml', expectLocalUploadedAt: string | null): Promise<boolean>;
  // stampFileOrigin: after a push, record this device as the origin of an
  // entry that has none (a pre-1.0.11 upload), only while it is still the
  // entry that was pushed. Never touches `uploadedAt`.
  stampFileOrigin(name: 'ebird' | 'ml', origin: FileOrigin, expectUploadedAt: string): Promise<boolean>;

  // ── Offline support — persisted style (FR-01/02/05/06/42) ──
  getStyleBlob(variant: string): Promise<PersistedStyle | null>;
  setStyleBlob(variant: string, blob: PersistedStyle): Promise<void>;

  // ── Offline support — replay store (FR-32/33/34) ──
  getReplayStore(): Promise<ReplayStore | null>;
  setReplayStore(store: ReplayStore): Promise<void>;
}

class WebStorage implements StorageAdapter {
  async getApiKey(service: KeySlot): Promise<string | null> {
    const res = await fetch('/settings/keys');
    if (!res.ok) return null;
    const data = await res.json() as Record<string, string | null>;
    return data[service] ?? null;
  }

  async setApiKey(service: KeySlot, value: string): Promise<void> {
    await fetch(`/settings/keys/${service}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  }

  async deleteApiKey(service: KeySlot): Promise<void> {
    await fetch(`/settings/keys/${service}`, { method: 'DELETE' });
  }

  // iCloud API key sync never runs on web/Pi (the platform gate is false
  // there); unreachable, and they reject rather than no-op, as the file-sync
  // links below do.
  getApiKeyEntries(): Promise<ApiKeyEntries> {
    return Promise.reject(new Error('not supported'));
  }

  clearApiKeyWithMarker(): Promise<void> {
    return Promise.reject(new Error('not supported'));
  }

  applySyncedKey(): Promise<boolean> {
    return Promise.reject(new Error('not supported'));
  }

  applySyncedKeyClear(): Promise<boolean> {
    return Promise.reject(new Error('not supported'));
  }

  stampApiKeyEntry(): Promise<boolean> {
    return Promise.reject(new Error('not supported'));
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
    const res = await fetch(`/settings/${key}`, { method: 'DELETE' });
    // Same reasoning as setSetting above: a resolved fetch is not a deleted
    // setting. It matters most on the clear path, where a swallowed non-2xx
    // left a derived document on disk while the UI reported a completed Clear.
    if (!res.ok) throw new Error(`Setting delete failed (${res.status})`);
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
    const res = await fetch(`/settings/files/${name}`, { method: 'POST', body: form });
    // The same reasoning as setSetting and deleteSetting above, on the path where
    // it was doing the most damage. A resolved fetch is not a saved file: the
    // backend answers 413 over its 50 MB cap and 400 on a non-.csv name, and with
    // the response discarded BOTH landed in Settings as a completed upload, over a
    // slot whose stored file was still the old one (or still nothing). Web and Pi
    // were the only platforms the cap ever ran on, and the only ones that could not
    // report it.
    if (!res.ok) throw new Error(`File save failed (${res.status})`);
  }

  async deleteFile(name: 'ebird' | 'ml'): Promise<void> {
    const res = await fetch(`/settings/files/${name}`, { method: 'DELETE' });
    // 404 is NOT a failure here. The backend answers it when no file is stored,
    // which is the state the caller asked for, and reporting it would put "Delete
    // failed. Please try again." over a row that is already empty and a button the
    // user can no longer press — the exact message v1.0.14 removed from the clear
    // path one method at a time. Every other non-2xx is a real failure and is
    // raised, so a clear can no longer report a file it did not remove.
    if (!res.ok && res.status !== 404) throw new Error(`File delete failed (${res.status})`);
  }

  // iCloud Sync never runs on web/Pi (the platform gate is false there), so
  // these are unreachable; they reject rather than silently no-op so a
  // mis-wired caller fails loudly.
  applySyncedFile(): Promise<boolean> {
    return Promise.reject(new Error('not supported'));
  }

  applySyncedClear(): Promise<boolean> {
    return Promise.reject(new Error('not supported'));
  }

  stampFileOrigin(): Promise<boolean> {
    return Promise.reject(new Error('not supported'));
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

// metadata.json is a persisted runtime document, so its optional `origin` is
// validated on the read side too (the v1.0.5 "validate at the chokepoint" rule
// applied to a document the app does not solely author): a deviceId that is
// not 32 lowercase hex, a label that is not a string, or an unknown platform
// drops the whole origin, and the entry reads as "local, no origin". The id
// names a staging file natively, so a malformed one never reaches a path.
const ORIGIN_DEVICE_ID_RE = /^[0-9a-f]{32}$/;
function normalizeMetaEntry(entry: FileMetadata | null | undefined): FileMetadata | null {
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.filename !== 'string' || typeof entry.uploadedAt !== 'string') return null;
  const out: FileMetadata = { filename: entry.filename, uploadedAt: entry.uploadedAt };
  if (typeof entry.replacedBySyncAt === 'string') out.replacedBySyncAt = entry.replacedBySyncAt;
  const o = entry.origin;
  if (
    o && typeof o === 'object'
    && typeof o.deviceId === 'string' && ORIGIN_DEVICE_ID_RE.test(o.deviceId)
    && typeof o.label === 'string'
    && (o.platform === 'mac' || o.platform === 'iphone' || o.platform === 'ipad')
  ) {
    out.origin = { deviceId: o.deviceId, label: o.label, platform: o.platform };
  }
  return out;
}

// api-keys.json is a persisted runtime document too, and from 1.0.12 it
// carries a `meta` sibling beside the values. One normalizer, applied by every
// reader: a value survives on its own (a string of length >= 1); a malformed
// `meta` is dropped whole (every key reads untimed); a malformed entry is
// dropped on its own; a change time is NEVER defaulted to now on read
// (FR-12). Both inconsistencies resolve in favour of the value: a key entry
// with no value is dropped, and a cleared marker beside a present value is
// dropped (the value wins and reads untimed). The value itself is not
// bounds-checked here: a local key outside the record bounds keeps working
// locally; only the upload refuses it.
const KEY_SLOTS_LOCAL: readonly KeySlot[] = ['ebird', 'openweather'];

function normalizeKeyOrigin(o: unknown): FileOrigin | null {
  if (!o || typeof o !== 'object') return null;
  const { deviceId, label, platform } = o as { deviceId?: unknown; label?: unknown; platform?: unknown };
  if (typeof deviceId !== 'string' || !ORIGIN_DEVICE_ID_RE.test(deviceId)) return null;
  if (typeof label !== 'string') return null;
  if (platform !== 'mac' && platform !== 'iphone' && platform !== 'ipad') return null;
  return { deviceId, label, platform };
}

function parseableTime(v: unknown): v is string {
  return typeof v === 'string' && Number.isFinite(Date.parse(v));
}

function normalizeKeyMetaEntry(raw: unknown, hasValue: boolean): ApiKeyMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.state === 'key') {
    if (!hasValue) return null;
    if (!parseableTime(r.changedAt)) return null;
    const out: ApiKeyMeta = { state: 'key', changedAt: r.changedAt };
    const origin = normalizeKeyOrigin(r.origin);
    if (origin) out.origin = origin;
    if (typeof r.replacedBySyncAt === 'string') out.replacedBySyncAt = r.replacedBySyncAt;
    return out;
  }
  if (r.state === 'cleared') {
    if (hasValue) return null;
    if (!parseableTime(r.clearedAt)) return null;
    const origin = normalizeKeyOrigin(r.origin);
    if (!origin) return null;
    return { state: 'cleared', clearedAt: r.clearedAt, origin };
  }
  return null;
}

export function normalizeApiKeysDoc(raw: unknown): ApiKeysDoc {
  const out: ApiKeysDoc = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const slot of KEY_SLOTS_LOCAL) {
    const v = r[slot];
    if (typeof v === 'string' && v.length > 0) out[slot] = v;
  }
  const meta = r.meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return out;
  const m = meta as Record<string, unknown>;
  for (const slot of KEY_SLOTS_LOCAL) {
    const entry = normalizeKeyMetaEntry(m[slot], out[slot] !== undefined);
    if (entry) {
      out.meta ??= {};
      out.meta[slot] = entry;
    }
  }
  return out;
}

/** The seam's view of one slot, from a normalized document. */
function keyEntryOf(doc: ApiKeysDoc, slot: KeySlot): ApiKeyEntry | null {
  const value = doc[slot];
  const meta = doc.meta?.[slot];
  if (value !== undefined) {
    if (meta && meta.state === 'key') {
      return {
        state: 'key',
        value,
        changedAt: meta.changedAt,
        origin: meta.origin ?? null,
        replacedBySyncAt: meta.replacedBySyncAt ?? null,
      };
    }
    return { state: 'key', value, changedAt: null, origin: null, replacedBySyncAt: null };
  }
  if (meta && meta.state === 'cleared') return { state: 'cleared', clearedAt: meta.clearedAt, origin: meta.origin };
  return null;
}

/** FR-26: is the current entry the one the controller decided against? */
function sameLocalEntry(current: ApiKeyEntry | null, expect: ExpectedKeyEntry): boolean {
  if (current === null || expect === null) return current === null && expect === null;
  if (current.state !== expect.state) return false;
  if (current.state === 'key' && expect.state === 'key') {
    return current.value === expect.value && current.changedAt === expect.changedAt;
  }
  if (current.state === 'cleared' && expect.state === 'cleared') return current.clearedAt === expect.clearedAt;
  return false;
}

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

  // Unchained api-keys read, the primitive every chained key link calls
  // (rule 1: never call a chained method from inside a link). Every reader
  // goes through the one normalizer.
  private async readKeysDoc(): Promise<ApiKeysDoc> {
    try {
      return normalizeApiKeysDoc(await this.readJson<Record<string, unknown>>(API_KEYS_PATH));
    } catch {
      return {};
    }
  }

  private writeKeysDoc(doc: ApiKeysDoc): Promise<void> {
    return this.writeJson(API_KEYS_PATH, doc as Record<string, unknown>);
  }

  async getApiKey(service: KeySlot): Promise<string | null> {
    return this.chain(API_KEYS_PATH, async () => {
      const doc = await this.readKeysDoc();
      return doc[service] ?? null;
    });
  }

  async setApiKey(service: KeySlot, value: string, origin?: FileOrigin): Promise<void> {
    return this.chain(API_KEYS_PATH, async () => {
      const doc = await this.readKeysDoc();
      doc[service] = value;
      // A user save writes a fresh meta entry: the change time, this device
      // when known, and never `replacedBySyncAt` (which clears the FR-41
      // notice), exactly as writeFile does for a file.
      doc.meta ??= {};
      doc.meta[service] = origin
        ? { state: 'key', changedAt: new Date().toISOString(), origin }
        : { state: 'key', changedAt: new Date().toISOString() };
      await this.writeKeysDoc(doc);
    });
  }

  async deleteApiKey(service: KeySlot): Promise<void> {
    return this.chain(API_KEYS_PATH, async () => {
      const doc = await this.readKeysDoc();
      delete doc[service];
      if (doc.meta) delete doc.meta[service];
      await this.writeKeysDoc(doc);
    });
  }

  // ── iCloud API key sync links (icloud-api-key-sync FR-23, FR-26, FR-28) ──

  async getApiKeyEntries(): Promise<ApiKeyEntries> {
    return this.chain(API_KEYS_PATH, async () => {
      const doc = await this.readKeysDoc();
      return { ebird: keyEntryOf(doc, 'ebird'), openweather: keyEntryOf(doc, 'openweather') };
    });
  }

  async clearApiKeyWithMarker(slot: KeySlot, marker: { clearedAt: string; origin: FileOrigin }): Promise<void> {
    return this.chain(API_KEYS_PATH, async () => {
      const doc = await this.readKeysDoc();
      delete doc[slot];
      doc.meta ??= {};
      doc.meta[slot] = { state: 'cleared', clearedAt: marker.clearedAt, origin: marker.origin };
      await this.writeKeysDoc(doc);
    });
  }

  async applySyncedKey(
    slot: KeySlot,
    entry: { value: string; changedAt: string; origin: FileOrigin },
    expect: ExpectedKeyEntry,
    replaced: boolean,
  ): Promise<boolean> {
    return this.chain(API_KEYS_PATH, async () => {
      const doc = await this.readKeysDoc();
      if (!sameLocalEntry(keyEntryOf(doc, slot), expect)) return false;
      doc[slot] = entry.value;
      doc.meta ??= {};
      doc.meta[slot] = replaced
        ? { state: 'key', changedAt: entry.changedAt, origin: entry.origin, replacedBySyncAt: new Date().toISOString() }
        : { state: 'key', changedAt: entry.changedAt, origin: entry.origin };
      await this.writeKeysDoc(doc);
      return true;
    });
  }

  async applySyncedKeyClear(slot: KeySlot, marker: { clearedAt: string; origin: FileOrigin }, expect: ExpectedKeyEntry): Promise<boolean> {
    return this.chain(API_KEYS_PATH, async () => {
      const doc = await this.readKeysDoc();
      if (!sameLocalEntry(keyEntryOf(doc, slot), expect)) return false;
      delete doc[slot];
      doc.meta ??= {};
      doc.meta[slot] = { state: 'cleared', clearedAt: marker.clearedAt, origin: marker.origin };
      await this.writeKeysDoc(doc);
      return true;
    });
  }

  async stampApiKeyEntry(slot: KeySlot, stamp: { changedAt: string; origin: FileOrigin }, expectValue: string): Promise<boolean> {
    return this.chain(API_KEYS_PATH, async () => {
      const doc = await this.readKeysDoc();
      const current = keyEntryOf(doc, slot);
      if (!current || current.state !== 'key' || current.value !== expectValue) return false;
      doc.meta ??= {};
      // The value is never touched; a replacedBySyncAt already set survives.
      doc.meta[slot] = current.replacedBySyncAt
        ? { state: 'key', changedAt: stamp.changedAt, origin: stamp.origin, replacedBySyncAt: current.replacedBySyncAt }
        : { state: 'key', changedAt: stamp.changedAt, origin: stamp.origin };
      await this.writeKeysDoc(doc);
      return true;
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
      return { ebird: normalizeMetaEntry(meta.ebird), ml: normalizeMetaEntry(meta.ml) };
    } catch {
      return { ebird: null, ml: null };
    }
  }

  async getFilesStatus(): Promise<FilesStatus> {
    return this.chain(META_PATH, () => this.readMeta());
  }

  // `await this.fs()` stays OUTSIDE the try deliberately (v1.0.16). Containing it
  // would be behaviour-neutral in every case reachable today and harmful in the one
  // case that is not: `fsModule` is memoized with `??=` and never reset, so a
  // rejection here is PERMANENT for the session, and folding a permanent failure
  // into a `null` return is exactly the "report a failure as no data" the 1.0.14
  // honest-load-failure family removed. The 1.0.15 cache fix is not a precedent for
  // moving it: that contained a TRANSIENT per-call failure inside a layer that
  // clears its memo, so the next mount retried. Callers that must distinguish the
  // two do it at their own call site -- LifeList.tsx reports a rejection and a falsy
  // result as the same load failure, which is what makes the throw route safe to
  // leave uncaught here.
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

  // Unchained metadata write, the primitive every chained metadata link ends
  // with (same rule as readMeta: never call a chained method from a link).
  private async writeMeta(meta: FilesStatus): Promise<void> {
    const { writeTextFile, BaseDirectory } = await this.fs();
    await writeTextFile(META_PATH, JSON.stringify(meta), { baseDir: BaseDirectory.AppLocalData });
  }

  // Unchained csv removal (best-effort: an already-absent file is not an error).
  private async removeCsv(name: 'ebird' | 'ml'): Promise<void> {
    const { remove, exists, BaseDirectory } = await this.fs();
    const path = FILE_PATHS[name];
    try {
      if (await exists(path, { baseDir: BaseDirectory.AppLocalData })) {
        await remove(path, { baseDir: BaseDirectory.AppLocalData });
      }
    } catch { /* best-effort */ }
  }

  async writeFile(name: 'ebird' | 'ml', content: string, filename: string, origin?: FileOrigin): Promise<void> {
    // The CSV write rides the metadata link so the content and its metadata
    // entry stay consistent with each other under overlapping calls.
    return this.chain(META_PATH, async () => {
      const { mkdir, writeTextFile, BaseDirectory } = await this.fs();
      await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
      await writeTextFile(FILE_PATHS[name], content, { baseDir: BaseDirectory.AppLocalData });
      const meta = await this.readMeta();
      // A user action writes a fresh entry: `origin` when sync supplied one,
      // and never `replacedBySyncAt` (this is what clears the FR-25 notice).
      meta[name] = origin
        ? { filename, uploadedAt: new Date().toISOString(), origin }
        : { filename, uploadedAt: new Date().toISOString() };
      await this.writeMeta(meta);
    });
  }

  async deleteFile(name: 'ebird' | 'ml'): Promise<void> {
    return this.chain(META_PATH, async () => {
      await this.removeCsv(name);
      const meta = await this.readMeta();
      meta[name] = null;
      await this.writeMeta(meta);
    });
  }

  // ── iCloud Sync links (icloud-sync FR-39) ──
  // Each is ONE link on the metadata chain, serialized with writeFile and
  // deleteFile. The guard compares the current entry's uploadedAt with the
  // one the controller decided against; a mismatch means a user action
  // landed in between, and the link returns false having touched nothing.

  async applySyncedFile(
    name: 'ebird' | 'ml',
    entry: FileMetadata,
    expectLocalUploadedAt: string | null,
    materialize: () => Promise<void>,
  ): Promise<boolean> {
    return this.chain(META_PATH, async () => {
      const before = await this.readMeta();
      if ((before[name]?.uploadedAt ?? null) !== expectLocalUploadedAt) return false;
      // The native pull writes the csv; it is not a chained op (rule 1 holds).
      // If it throws, this link rejects and the metadata stays as it was.
      await materialize();
      const meta = await this.readMeta();
      meta[name] = entry;
      await this.writeMeta(meta);
      return true;
    });
  }

  async applySyncedClear(name: 'ebird' | 'ml', expectLocalUploadedAt: string | null): Promise<boolean> {
    return this.chain(META_PATH, async () => {
      const before = await this.readMeta();
      if ((before[name]?.uploadedAt ?? null) !== expectLocalUploadedAt) return false;
      await this.removeCsv(name);
      const meta = await this.readMeta();
      meta[name] = null;
      await this.writeMeta(meta);
      return true;
    });
  }

  async stampFileOrigin(name: 'ebird' | 'ml', origin: FileOrigin, expectUploadedAt: string): Promise<boolean> {
    return this.chain(META_PATH, async () => {
      const meta = await this.readMeta();
      const current = meta[name];
      if (!current || current.uploadedAt !== expectUploadedAt || current.origin) return false;
      meta[name] = { ...current, origin };
      await this.writeMeta(meta);
      return true;
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
