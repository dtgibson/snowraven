import { platform } from '@tauri-apps/plugin-os';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// iOS/iPadOS check (mobile-app schema §2.5). `platform()` from
// @tauri-apps/plugin-os is SYNCHRONOUS in v2 — it reads the compile-time
// injected `__TAURI_OS_PLUGIN_INTERNALS__`, so this is a render-safe pure
// probe, same posture as isTauri(). It returns 'ios' on BOTH iPhone and
// iPadOS (one predicate covers both device families).
//
// Never use this for layout — layout stays window-size-driven (useIsPhone,
// CSS tiers). isIOS() exists only for CAPABILITY branching (updater absence,
// offline-region section, import wording/picker, iOS map-fullscreen rule).
// No user-agent sniffing: iPadOS WKWebView reports a desktop-Safari
// "Macintosh" UA, so UA checks are unreliable on exactly the device family
// this predicate is for.
export function isIOS(): boolean {
  if (!isTauri()) return false;
  // try/catch: on builds where the os plugin isn't registered (e.g. a stale
  // desktop binary), the internals are absent and the read throws — treat as
  // not-iOS rather than crashing the caller.
  try {
    return platform() === 'ios';
  } catch {
    return false;
  }
}

// macOS check, the same sync platform() probe as isIOS() (icloud-sync schema,
// "Frontend modules and seams"). Exists only for CAPABILITY branching: the
// iCloud Sync gate (`showICloudSync` in platformGates.ts) is
// isTauri() && (isIOS() || isMacOS()), so Windows desktop, web and Pi are
// false by construction. Never use it for layout.
export function isMacOS(): boolean {
  if (!isTauri()) return false;
  try {
    return platform() === 'macos';
  } catch {
    return false;
  }
}

// OS-within-platform check. In the WebView2 used by the Windows desktop build,
// navigator.userAgent contains "Windows". Used to degrade platform-specific
// features (e.g. native geolocation) that aren't implemented on Windows yet.
export function isWindows(): boolean {
  return typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
}
