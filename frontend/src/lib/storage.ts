import { isTauri } from './platform';

export interface FileMetadata {
  filename: string;
  uploadedAt: string;
}

export interface FilesStatus {
  ebird: FileMetadata | null;
  ml: FileMetadata | null;
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
    await fetch(`/settings/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
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
}

export const storage: StorageAdapter = isTauri()
  ? new TauriStorage()
  : new WebStorage();
