// Mobile file import: the Mechanism A/B switch, one reading per mobile platform
// (mobile-app schema §2.6, android-release schema 5.4). Renamed from
// iosImport.ts when Android joined: each platform's mechanism is a measured
// constant of its own, never one shared literal (android-release FR-26).
//
// Mechanism A ('input', the primary): the existing hidden
// `<input type="file" accept=".csv">` in Settings' FileRow. On iOS, WebKit
// itself presents the native document picker (UIDocumentPicker via the Files
// sheet) for file inputs. On Android, wry's RustWebChromeClient implements
// onShowFileChooser and presents the system document picker (Storage Access
// Framework, no storage permission) for the same input. Cancel is a clean no-op
// on both (no change event), and everything downstream (the refusal registry,
// storage.writeFile, cache invalidation, metadata display) is untouched.
//
// Mechanism B ('dialog', the ratified fallback): @tauri-apps/plugin-dialog
// `open()` presents the platform picker natively; the picked path is read via
// @tauri-apps/plugin-fs `readTextFile`. Both plugins are mobile-registered in
// src-tauri (cfg(mobile)) and granted in capabilities/mobile.json for iOS and
// Android, so a flip needs no Rust/config change. Dynamic imports keep both
// plugins off the entry chunk and out of desktop/web execution entirely.
import { isAndroid, isIOS } from './platform';

// Verified in the iOS simulator at mobile-app V2.
export const IOS_IMPORT_MECHANISM: 'input' | 'dialog' = 'input';
// Measured on the API 36 emulator at android-release (OQ-12, recorded in
// pipeline/android-release/decisions.md): the file input presents the system
// document picker. Flip to 'dialog' only on a measurement that says otherwise.
export const ANDROID_IMPORT_MECHANISM: 'input' | 'dialog' = 'input';

// The mechanism for the platform this build is running on. Desktop, web and Pi
// always use the file input.
export function activeImportMechanism(): 'input' | 'dialog' {
  if (isIOS()) return IOS_IMPORT_MECHANISM;
  if (isAndroid()) return ANDROID_IMPORT_MECHANISM;
  return 'input';
}

export interface PickedCsv {
  filename: string;
  content: string;
}

// Present the native document picker (Mechanism B) and read the chosen CSV.
// Resolves null when the user cancels (FR-13: clean no-op). Throws on read
// failure — the caller routes that into the existing error state.
export async function pickCsvViaDialog(): Promise<PickedCsv | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (typeof path !== 'string' || path === '') return null; // cancelled
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const content = await readTextFile(path);
  const filename = path.split('/').pop() || 'import.csv';
  return { filename, content };
}
