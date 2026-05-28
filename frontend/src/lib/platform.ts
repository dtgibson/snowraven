export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// OS-within-platform check. In the WebView2 used by the Windows desktop build,
// navigator.userAgent contains "Windows". Used to degrade platform-specific
// features (e.g. native geolocation) that aren't implemented on Windows yet.
export function isWindows(): boolean {
  return typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
}
