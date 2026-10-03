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

// Android check (android-release schema 5.1), the same synchronous platform()
// probe as isIOS() and isMacOS(): false outside Tauri, and false when the os
// plugin internals are absent (a throw), so a caller never crashes on it.
// CAPABILITY branching only, never layout. It is NOT a user-agent read:
// isWindows() below is the one UA sniff in this file and is not the pattern.
// isIOS() keeps returning false on Android, so every gate whose argument is
// Apple-specific (iCloud, widgets, Alerts) stays false here by construction.
export function isAndroid(): boolean {
  if (!isTauri()) return false;
  try {
    return platform() === 'android';
  } catch {
    return false;
  }
}

// The two mobile apps, iPhone/iPad and Android. Exists so a gate whose argument
// is "mobile" (no updater, no self-relaunch, compact chrome, native import
// wording, the fullscreen map rule) says so once. A gate whose argument is
// Apple-specific keeps naming isIOS() / isMacOS(); never rename isIOS() into
// this (android-release FR-11: each call site is classified one at a time).
export function isMobileApp(): boolean {
  return isIOS() || isAndroid();
}

// OS-within-platform check. In the WebView2 used by the Windows desktop build,
// navigator.userAgent contains "Windows". Used to degrade platform-specific
// features (e.g. native geolocation) that aren't implemented on Windows yet.
export function isWindows(): boolean {
  return typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
}
