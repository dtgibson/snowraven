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

const DATA_DIR = 'data';
const SETTINGS_DIR = 'settings';
const META_PATH = `${DATA_DIR}/metadata.json`;
const FILE_PATHS: Record<'ebird' | 'ml', string> = {
  ebird: `${DATA_DIR}/ebird-backup.csv`,
  ml: `${DATA_DIR}/ml-export.csv`,
};

// All storage (API keys, settings, files) uses tauri-plugin-fs (AppLocalData directory).
// No backend or OS keychain required. Keys are stored as getSetting/setSetting JSON files.
class TauriStorage implements StorageAdapter {
  private web = new WebStorage();

  async getApiKey(service: 'ebird' | 'openweather'): Promise<string | null> {
    return this.getSetting<string>(`api-key-${service}`);
  }

  async setApiKey(service: 'ebird' | 'openweather', value: string): Promise<void> {
    await this.setSetting(`api-key-${service}`, value);
    this.web.setApiKey(service, value).catch(() => {});
  }

  async deleteApiKey(service: 'ebird' | 'openweather'): Promise<void> {
    await this.deleteSetting(`api-key-${service}`).catch(() => {});
    this.web.deleteApiKey(service).catch(() => {});
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const path = `${SETTINGS_DIR}/${key}.json`;
    try {
      if (!await exists(path, { baseDir: BaseDirectory.AppLocalData })) return null;
      return JSON.parse(await readTextFile(path, { baseDir: BaseDirectory.AppLocalData })) as T;
    } catch {
      return null;
    }
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const { mkdir, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await mkdir(SETTINGS_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(
      `${SETTINGS_DIR}/${key}.json`,
      JSON.stringify(value),
      { baseDir: BaseDirectory.AppLocalData }
    );
  }

  async deleteSetting(key: string): Promise<void> {
    const { remove, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const path = `${SETTINGS_DIR}/${key}.json`;
    try {
      if (await exists(path, { baseDir: BaseDirectory.AppLocalData })) {
        await remove(path, { baseDir: BaseDirectory.AppLocalData });
      }
    } catch { /* best-effort */ }
  }

  async getFilesStatus(): Promise<FilesStatus> {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    try {
      if (!await exists(META_PATH, { baseDir: BaseDirectory.AppLocalData })) {
        return { ebird: null, ml: null };
      }
      return JSON.parse(await readTextFile(META_PATH, { baseDir: BaseDirectory.AppLocalData })) as FilesStatus;
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
