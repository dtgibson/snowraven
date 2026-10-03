// The Android System WebView floor (android-release FR-33, schema 5.6, OQ-06).
//
// The shipped frontend needs Chromium 111. The audit behind the number:
//
//   requirement                                     Chromium  where
//   @container (11 uses), :has() (1 in built CSS)   105       globals.css
//   dvh units (11 in the built CSS)                  108       globals.css
//   Tailwind CSS v4: @property, color-mix(), @layer  111       the built index-*.css
//   Vite 8's default build.target (baseline-widely-  111       vite.config.ts sets no
//     available, esbuild chrome111)                            target
//   Object.hasOwn, WeakRef, requestIdleCallback,     93 / 84 / src/
//     ResizeObserver                                 47 / 64
//
// Nothing newer was found in shipped src/ (no @scope, popover, toSorted,
// groupBy, Set.prototype.union, Promise.withResolvers, URL.canParse or
// structuredClone), so the floor is the Tailwind and Vite toolchain floor, and
// the probe that maps to it one to one is Tailwind's own: color-mix() in lab
// space, supported from Chromium 111. Every API 24 device can reach it: Chrome
// 119 was the last WebView release for Android 7.
//
// The probe RUNS in frontend/index.html's inline launch script (it must decide
// before the bundle loads, and an inline script adds nothing to the entry
// chunk); this module holds the values once so launchSplash.test.ts can assert
// the script and the copy agree with them. Nothing in the app imports it.
export const ANDROID_WEBVIEW_FLOOR = 111

// CSS.supports(property, value) arguments for the probe.
export const WEBVIEW_FLOOR_PROBE = ['color', 'color-mix(in lab, red, red)'] as const

// The approved copy (design-spec, Content Notes): shown in the launch frame's
// status line, with no Reload control, because reloading cannot change the
// WebView.
export const WEBVIEW_FLOOR_MESSAGE =
  'SnowRaven needs a newer Android System WebView. Update it from Google Play, then open SnowRaven again.'
