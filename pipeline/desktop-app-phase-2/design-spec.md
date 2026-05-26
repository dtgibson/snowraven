# Design Spec — Desktop App Phase 2: OS Keychain

## UI Impact: None
Phase 2 is an infrastructure change. The Settings tab UI for API key management is unchanged. Users interact with the same UI; the storage layer is different in Tauri mode.

## Architectural Change

### Before (Phase 0)
```
Settings UI → storage.setApiKey() → TauriStorage → WebStorage → POST /settings/keys/ebird → backend writes to .env
```

### After (Phase 2)
```
Settings UI → storage.setApiKey() → TauriStorage → invoke('set_api_key') → OS Keychain (primary)
                                                                          → POST /settings/keys/ebird → .env (bridge, best-effort)
```

### Read Path
```
storage.getApiKey() → TauriStorage → invoke('get_api_key') → OS Keychain → returns key or null
```

## Developer Notes
- The `invoke()` calls require `@tauri-apps/api/core` import in storage.ts
- In web mode, `isTauri()` returns false and `WebStorage` is used directly — `@tauri-apps/api` is installed but never called
- Vite tree-shaking does not remove the import, so the bundle includes the small `@tauri-apps/api` package — acceptable
