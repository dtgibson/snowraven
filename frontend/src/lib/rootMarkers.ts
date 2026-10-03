import { isAndroid, isIOS } from './platform'

// Platform root markers on <html>, applied by main.tsx synchronously before
// render so the first paint already carries the right inset rules.
//
// `sr-ios-app` (mobile-app, QA round-1 fix): the safe-area rules in globals.css
// hang off it so they apply ONLY in the Tauri iOS app, NOT in the web build
// viewed in iOS Safari, where viewport-fit=cover also yields nonzero env()
// values and ungated rules would change the shipped web rendering.
//
// `sr-android-app` (android-release FR-20, design-spec section 2): gates the
// Android twins, which read only the --sr-inset-* properties MainActivity.kt
// injects. `sr-ios-app` is never applied on Android, and the two are exclusive
// because isIOS() and isAndroid() read the same platform() probe.
export function applyPlatformRootMarkers(root: HTMLElement): void {
  if (isIOS()) root.classList.add('sr-ios-app')
  if (isAndroid()) root.classList.add('sr-android-app')
}
