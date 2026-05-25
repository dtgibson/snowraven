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

// Phase 0: TauriStorage delegates to WebStorage while the backend is still required.
// Phase 2: getApiKey/setApiKey/deleteApiKey migrate to OS keychain (tauri-plugin-stronghold).
// Phase 4: readFile/writeFile/deleteFile migrate to the app data directory (tauri-plugin-fs).
class TauriStorage implements StorageAdapter {
  private web = new WebStorage();

  async getApiKey(service: 'ebird' | 'openweather'): Promise<string | null> {
    return this.web.getApiKey(service);
  }

  async setApiKey(service: 'ebird' | 'openweather', value: string): Promise<void> {
    return this.web.setApiKey(service, value);
  }

  async deleteApiKey(service: 'ebird' | 'openweather'): Promise<void> {
    return this.web.deleteApiKey(service);
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
