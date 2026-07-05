// iOS file import — the Mechanism A/B switch (mobile-app schema §2.6).
//
// Mechanism A ('input', the primary): the existing hidden
// `<input type="file" accept=".csv">` in Settings' FileRow. On iOS, WebKit
// itself presents the native document picker (UIDocumentPicker via the Files
// sheet) for file inputs — no new code, cancel is a clean no-op (no change
// event), and everything downstream (storage.writeFile, cache invalidation,
// metadata display) is untouched. The macOS WKUIDelegate file-chooser gap
// recorded in DECISIONS.md was macOS-specific; wry-iOS rides WebKit's
// built-in handling. ⚠ Verify-item V2: this is the FIRST thing to check in
// the iOS simulator. If the picker does not present, flip the constant below
// to 'dialog' — that is the entire switch.
//
// Mechanism B ('dialog', the ratified fallback): @tauri-apps/plugin-dialog
// `open()` presents UIDocumentPickerViewController natively; the picked path
// is read via @tauri-apps/plugin-fs `readTextFile` (the dialog plugin adds
// the picked path to the fs scope — ⚠ V3: confirm that scope-extension on
// the MOBILE path in the simulator). Both plugins are mobile-registered in
// src-tauri (cfg(mobile)) and granted in capabilities/mobile.json, so the
// flip needs no Rust/config change. Dynamic imports keep both plugins off
// the entry chunk and out of desktop/web execution entirely.
export const IOS_IMPORT_MECHANISM: 'input' | 'dialog' = 'input';

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
