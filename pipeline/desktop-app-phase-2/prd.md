# PRD — Desktop App Phase 2: OS Keychain

## Functional Requirements

**FR-01** — In Tauri mode, `storage.setApiKey('ebird', key)` writes the key to the OS keychain under service name `"SnowRaven"` and account `"ebird"`.

**FR-02** — In Tauri mode, `storage.getApiKey('ebird')` reads from the OS keychain. Returns `null` if no key is stored.

**FR-03** — In Tauri mode, `storage.deleteApiKey('ebird')` removes the key from the OS keychain. Is a no-op if the key does not exist.

**FR-04** — Bridge: `setApiKey` also writes to the Python backend `/settings/keys/{service}` endpoint so the backend continues to function during the Phase 3 transition period. Bridge failures are silently swallowed — they must not block the primary keychain write.

**FR-05** — In web mode, all three methods continue to use `WebStorage` (no change).

**FR-06** — Keys survive app restarts. The OS keychain is persistent storage.

## Non-Functional Requirements

**NFR-01** — The `keyring` crate is used for all keychain operations — no platform-specific Rust code branching.

**NFR-02** — `@tauri-apps/api` is added as a frontend dev/runtime dependency for typed `invoke()` access.

**NFR-03** — The Settings UI requires no changes — it already calls `storage.setApiKey/getApiKey/deleteApiKey`.

## Acceptance Criteria

- AC-01: In Tauri mode, setting an eBird key in Settings → the key appears in macOS Keychain Access under "SnowRaven".
- AC-02: Restarting the app → the key is still shown as configured in Settings.
- AC-03: Clearing the key in Settings → the key is removed from Keychain Access.
- AC-04: All existing vitest tests continue to pass (no regressions).
