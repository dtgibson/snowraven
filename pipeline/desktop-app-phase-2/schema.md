# Schema — Desktop App Phase 2: OS Keychain

## No Database Schema Changes
Phase 2 is entirely within the Tauri/Rust/TypeScript layer. No database, no new backend tables, no new API endpoints on the Python side.

## OS Keychain Entries

| Service Name  | Account Name  | Value                  |
|---------------|---------------|------------------------|
| `SnowRaven`   | `ebird`       | eBird API key string   |
| `SnowRaven`   | `openweather` | OpenWeather API key string |

These are native OS keychain entries managed by the `keyring` Rust crate:
- macOS: Keychain item type "generic password"
- Windows: Windows Credential Manager "generic credential"
- Linux: Secret Service protocol (via libsecret)

## New Rust Tauri Commands

```rust
#[tauri::command]
fn get_api_key(service: &str) -> Result<Option<String>, String>

#[tauri::command]
fn set_api_key(service: &str, value: &str) -> Result<(), String>

#[tauri::command]
fn delete_api_key(service: &str) -> Result<(), String>
```

## StorageAdapter Interface (unchanged)
The `StorageAdapter` interface in `storage.ts` is unchanged. Only `TauriStorage`'s implementation of `getApiKey/setApiKey/deleteApiKey` changes.

## New npm Dependency
- `@tauri-apps/api: ^2` — added to `frontend/package.json` dependencies

## New Rust Dependency
- `keyring = "3"` — added to `src-tauri/Cargo.toml` dependencies
