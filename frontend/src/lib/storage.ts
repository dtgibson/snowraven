import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './platform';

export interface StorageAdapter {
  getApiKey(service: 'ebird' | 'openweather'): Promise<string | null>;
  setApiKey(service: 'ebird' | 'openweather', value: string): Promise<void>;
  deleteApiKey(service: 'ebird' | 'openweather'): Promise<void>;
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;
  deleteSetting(key: string): Promise<void>;
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
      body: JSON.stringify({ key: value }),
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

// Phase 2: getApiKey/setApiKey/deleteApiKey use OS keychain via Rust commands.
//   Bridge write to backend .env kept so the Python backend continues to work
//   during the Phase 3 transition. Bridge failures are silently swallowed.
// Phase 4: readFile/writeFile/deleteFile migrate to the app data directory (tauri-plugin-fs).
//   getSetting/setSetting/deleteSetting migrate to tauri-plugin-store.
class TauriStorage implements StorageAdapter {
  private web = new WebStorage();

  async getApiKey(service: 'ebird' | 'openweather'): Promise<string | null> {
    try {
      return await invoke<string | null>('get_api_key', { service });
    } catch {
      return this.web.getApiKey(service);
    }
  }

  async setApiKey(service: 'ebird' | 'openweather', value: string): Promise<void> {
    await invoke('set_api_key', { service, value });
    this.web.setApiKey(service, value).catch(() => {});
  }

  async deleteApiKey(service: 'ebird' | 'openweather'): Promise<void> {
    await invoke('delete_api_key', { service });
    this.web.deleteApiKey(service).catch(() => {});
  }

  async getSetting<T>(key: string): Promise<T | null> {
    return this.web.getSetting<T>(key);
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    return this.web.setSetting<T>(key, value);
  }

  async deleteSetting(key: string): Promise<void> {
    return this.web.deleteSetting(key);
  }

  async readFile(name: 'ebird' | 'ml'): Promise<string | null> {
    return this.web.readFile(name);
  }

  async writeFile(name: 'ebird' | 'ml', content: string, filename: string): Promise<void> {
    return this.web.writeFile(name, content, filename);
  }

  async deleteFile(name: 'ebird' | 'ml'): Promise<void> {
    return this.web.deleteFile(name);
  }
}

export const storage: StorageAdapter = isTauri()
  ? new TauriStorage()
  : new WebStorage();
