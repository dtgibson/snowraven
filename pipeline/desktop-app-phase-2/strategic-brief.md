# Strategic Brief — Desktop App Phase 2: OS Keychain

## Objective
Migrate API key storage from the Python backend's `.env` file to the OS native keychain (Mac Keychain on macOS, Windows Credential Manager on Windows) for the Tauri desktop app.

## Why This Matters
Phase 0 established the storage seam (`storage.ts`). Phase 1 proved the formatter works standalone. Phase 2 makes API keys first-class citizens on the desktop: stored securely in the OS credential store, accessible without a running Python backend, and ready for Phase 3 where TauriTransport will pass them as HTTP headers to external APIs directly.

## Scope
- Add a `keyring` Rust crate to the Tauri backend
- Expose three Tauri commands: `get_api_key`, `set_api_key`, `delete_api_key`
- Update `TauriStorage` to use these commands for API key operations
- Bridge: also write to the Python backend's `.env` so the backend continues to work during the Phase 3 transition
- Add `@tauri-apps/api` to frontend dependencies for typed `invoke()` access

## Out of Scope
- File storage (Phase 4)
- Map defaults storage (Phase 4)
- Direct external API calls (Phase 3)

## Success
In Tauri mode, saving an API key in Settings stores it in the OS keychain. The key persists across app restarts. The Python backend continues to receive keys via the bridge write so Phase 3 can ship cleanly.
