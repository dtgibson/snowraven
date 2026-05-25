# Schema — SnowRaven Desktop App

## Path
Frontend Only — No SQL data layer changes required

## Confirmation

Assessed against all functional requirements. SnowRaven has no SQL database; all prior feature schemas in this project have taken this path. The desktop app introduces new persistent data mechanisms — OS keychain, IndexedDB, and the app data directory — but none are SQL tables or migrations. All data architecture work is TypeScript interface contracts behind the transport and storage seams.

---

## Existing Backend Proxies (Migration Checklist)

The `frontend/vite.config.ts` proxy configuration defines every backend dependency. This is the complete migration checklist for Phase 3:

| Proxy path | Backend route | External API | Migration phase |
|---|---|---|---|
| `/weather` | `GET /weather` | OpenWeather One Call | Phase 3 (last — needs formatter) |
| `/taxonomy` | `GET /taxonomy` | eBird Taxonomy API | Phase 3 (first) |
| `/settings` | `GET/POST /settings` | (none — reads `.env` / `data/`) | Phase 2 + Phase 4 |
| `/nominatim` | `GET /nominatim` | Nominatim geocoding | Phase 3 |
| `/stats` | `GET /stats` | eBird API | Phase 3 |
| `/map` | `GET /map` | eBird API | Phase 3 |
| `/version` | `GET /version/check` | GitHub releases | Phase 5 (Tauri updater) |
| `/health` | `GET /health` | (none — liveness check) | Phase 5 (removed) |

---

## Seam 1 — Transport

**File:** `frontend/src/lib/transport.ts`

The transport seam wraps all outbound HTTP. In web mode it is a thin pass-through to the existing Vite proxy (no behavior change). In Tauri mode it calls external APIs directly.

### Interface

```typescript
export interface TransportAdapter {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}
```

### Web implementation

Routes through the existing Vite proxy paths. No behavior change for web/Pi users.

```typescript
class WebTransport implements TransportAdapter {
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Transport error: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Transport error: ${res.status}`);
    return res.json() as Promise<T>;
  }
}
```

### Tauri implementation

Calls external APIs directly. Requires API keys from the storage seam. Each proxy migration (FR-15 through FR-19) is a method on this class.

```typescript
class TauriTransport implements TransportAdapter {
  // Calls external APIs directly using keys from storage seam
  // Built up incrementally as each Phase 3 proxy is migrated
}
```

### Platform detection and export

```typescript
import { isTauri } from './platform';

export const transport: TransportAdapter = isTauri()
  ? new TauriTransport()
  : new WebTransport();
```

### Platform detection utility

**File:** `frontend/src/lib/platform.ts`

```typescript
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
```

This is the single source of truth for platform detection. No other file should inspect `window.__TAURI_INTERNALS__` directly.

---

## Seam 2 — Storage

**File:** `frontend/src/lib/storage.ts`

The storage seam wraps all persistent data: API keys, settings, user files, and cached data.

### Interface

```typescript
export interface StorageAdapter {
  // API keys
  getApiKey(service: 'ebird' | 'openweather'): Promise<string | null>;
  setApiKey(service: 'ebird' | 'openweather', value: string): Promise<void>;
  deleteApiKey(service: 'ebird' | 'openweather'): Promise<void>;

  // Arbitrary settings (JSON-serializable values)
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;

  // Named files (eBird backup, ML export, map defaults)
  readFile(name: string): Promise<string | null>;
  writeFile(name: string, content: string): Promise<void>;
}
```

### Web implementation

Reads and writes via the existing `/settings` proxy (which reads `backend/.env` and `data/`). No behavior change for web/Pi users.

```typescript
class WebStorage implements StorageAdapter {
  async getApiKey(service: 'ebird' | 'openweather'): Promise<string | null> {
    const res = await fetch('/settings');
    const data = await res.json();
    return service === 'ebird' ? data.eBirdApiKey : data.openWeatherApiKey;
  }
  // ... other methods route through /settings and /data proxies
}
```

### Tauri implementation

Uses Tauri's native keychain plugin for API keys, `appDataDir()` from `@tauri-apps/api/path` for files, and IndexedDB (via a thin wrapper) for taxonomy cache.

```typescript
class TauriStorage implements StorageAdapter {
  async getApiKey(service: 'ebird' | 'openweather'): Promise<string | null> {
    const { getPassword } = await import('@tauri-apps/plugin-stronghold');
    // or Tauri keychain plugin — confirm exact plugin in Phase 2
    return getPassword('snowraven', service);
  }
  // ... other methods use Tauri path APIs and native file write
}
```

### Platform detection and export

```typescript
export const storage: StorageAdapter = isTauri()
  ? new TauriStorage()
  : new WebStorage();
```

---

## Data Storage Locations

| Data | Web/Pi mode | Tauri mode |
|---|---|---|
| eBird API key | `backend/.env` (EBIRD_API_KEY) | OS keychain (service: `snowraven`, account: `ebird`) |
| OpenWeather API key | `backend/.env` (OPENWEATHER_API_KEY) | OS keychain (service: `snowraven`, account: `openweather`) |
| eBird backup file | `data/` relative to server | `$APP_DATA/SnowRaven/backups/` |
| ML export file | `data/` relative to server | `$APP_DATA/SnowRaven/exports/` |
| Map defaults | returned by `/settings` | `$APP_DATA/SnowRaven/settings.json` |
| Taxonomy cache | not cached (fetched each session) | IndexedDB — database `snowraven`, store `taxonomy-cache` |

`$APP_DATA` resolves via `appDataDir()` from `@tauri-apps/api/path`:
- Mac: `~/Library/Application Support/com.snowraven.app`
- Windows: `%APPDATA%\SnowRaven`

---

## IndexedDB Taxonomy Cache

**Database:** `snowraven`
**Store:** `taxonomy-cache`
**Key:** `species-list`
**Value shape:**

```typescript
interface TaxonomyCacheEntry {
  data: TaxonomyEntry[];   // full eBird taxonomy response
  fetchedAt: string;        // ISO 8601 timestamp
  version: string;          // eBird taxonomy version string
}
```

Cache is invalidated when the taxonomy version from eBird differs from the stored version. Force-refresh available from Settings.

---

## Tauri Project Structure

```
src-tauri/
  Cargo.toml          # Rust dependencies
  tauri.conf.json     # App identifier, window config, updater config, bundle config
  src/
    main.rs           # Tauri entry point
    lib.rs            # Plugin registration, command handlers
  icons/              # App icons for Mac (.icns) and Windows (.ico)
  capabilities/       # Tauri v2 permission files (keychain, filesystem, http)
```

### `tauri.conf.json` key fields

```json
{
  "productName": "SnowRaven",
  "identifier": "com.snowraven.app",
  "build": {
    "frontendDist": "../frontend/dist",
    "devUrl": "http://localhost:5173"
  },
  "bundle": {
    "targets": ["dmg", "nsis"],
    "macOS": { "signingIdentity": "$APPLE_SIGNING_IDENTITY" },
    "windows": { "certificateThumbprint": "$WINDOWS_CERT_THUMBPRINT" }
  },
  "plugins": {
    "updater": {
      "endpoints": ["https://github.com/dtgibson/snowraven/releases/latest/download/latest.json"],
      "dialog": true
    }
  }
}
```

---

## Tauri Plugins Required

| Plugin | Purpose | Phase introduced |
|---|---|---|
| `tauri-plugin-stronghold` or `tauri-plugin-keychain` | OS keychain read/write | Phase 2 |
| `tauri-plugin-http` | Outbound HTTP from Rust (if needed) | Phase 3 |
| `tauri-plugin-fs` | App data directory read/write | Phase 4 |
| `tauri-plugin-updater` | In-app update check and apply | Phase 5 |
| `tauri-plugin-shell` (optional) | Backend sidecar in Phase 0 | Phase 0 |

Confirm exact plugin names against Tauri v2 plugin registry before implementation — plugin names differ between Tauri v1 and v2.

---

## Weather Formatter Contract (Phase 1)

**Input:** Raw OpenWeather One Call API response (JSON)
**Output:** The same transformed shape currently returned by `backend/formatters/weather.py`
**File:** `frontend/src/lib/formatters/weather.ts`

Golden test structure:
```
frontend/src/lib/formatters/__tests__/
  weather.test.ts         # vitest golden test suite
  fixtures/
    raw-response-1.json   # raw OpenWeather API responses
    expected-output-1.json  # Python formatter output for each fixture
```

The TypeScript formatter cannot be promoted to Phase 3 until all golden tests pass byte-for-byte against stored Python outputs.

---

## No SQL Work Required

No migrations need to be written or run. The Engineer proceeds directly to implementing `platform.ts`, `transport.ts`, and `storage.ts`, then initializing the Tauri project structure.
