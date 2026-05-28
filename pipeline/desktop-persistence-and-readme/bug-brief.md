# Bug Brief — desktop-persistence-and-readme

Two unrelated issues bundled into one fix session at the user's request.

## What is broken
1. **Desktop tab-layout persistence:** In the Tauri desktop app, reordering or hiding tabs does not survive a relaunch — the layout resets to defaults. `tabLayout.ts` reads/writes `localStorage` directly, which is ephemeral in WKWebView (cleared on relaunch). It is the only setting that bypasses the `storage` seam used by every other persisted setting. Web/Pi is unaffected (browser localStorage is durable there).
2. **Stale Keychain docs:** Four doc references claim the desktop app stores API keys in the system/macOS Keychain. The app actually uses `tauri-plugin-fs` under `AppLocalData/data/api-keys.json` (the Keychain was abandoned — needs entitlements not configured).

## Steps to reproduce
1. (Persistence) Open the desktop app → Settings → reorder or hide a tab → quit and relaunch → layout is back to defaults.
2. (Docs) Read README.md:111, README.md:151, README.md:225, docs/HELP.md:252 → all state keys live in the Keychain, contradicting CLAUDE.md and `storage.ts`.

## Expected behavior
1. Tab order/visibility persists across desktop relaunches, the same way other settings do.
2. Docs accurately describe desktop key storage as the app's local data directory.

## Blast radius
`tabLayout.ts` (load/save/clear), `App.tsx` (synchronous `useState` initializers that read `loadTabLayout()` for no-flash, plus active-tab derivation), the Settings reorder/hide handlers, and `tabLayout.test.ts` (mocks localStorage). Design tension: the seam is async on both platforms (desktop file read; web `/settings` fetch) while the current read is synchronous to avoid a flash — the fix must load async without reintroducing a flash and without regressing or adding latency to the working web path. Docs: README.md (×3), docs/HELP.md (×1).

## What done looks like
- Desktop: reorder/hide a tab, relaunch → layout preserved.
- Web/Pi: unchanged — layout still persists, no added flash or network latency.
- All four doc references corrected to the app local data directory; no Keychain claims remain.
