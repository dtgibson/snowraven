// Platform-conditional visibility gates for the mobile-app feature
// (schema §2.5's conditional-surfaces list). Kept as named predicates in one
// module so the FR they implement is greppable and unit-testable with
// isIOS() mocked both ways — components consume the gate, not raw isIOS().
import { isIOS, isMacOS, isTauri } from './platform';

// FR-14 — the in-app update affordance is ABSENT on iOS/iPadOS: updates flow
// through TestFlight / the App Store, and the updater/process plugins are not
// even compiled into the mobile binary (#[cfg(desktop)] in src-tauri). This
// gate hides the UI half; desktop and web/Pi keep their existing affordances.
export function showUpdaterFooter(): boolean {
  return !isIOS();
}

// iOS cannot programmatically relaunch itself — the process plugin is not
// compiled into the mobile binary (FR-14 posture) and the platform forbids
// self-restart. The Troubleshooting "Rebuild caches" control stays PRESENT on
// iOS (the cache delete is the valuable half) but skips the relaunch step and
// tells the user to close and reopen the app instead (QA round-1 finding:
// the ungated relaunch() rejected on iOS and stranded the button).
export function supportsAppRelaunch(): boolean {
  return !isIOS();
}

// Preview-driven composition fix (user-requested at the live simulator
// preview, logged in pipeline/mobile-app/decisions.md): on iOS/iPadOS the
// app's top chrome compacts — the brand header collapses to a slim
// single-line bar (no tagline), and the Map Explorer panel sizes to the
// visible viewport under that compact chrome so the map and its FAB cluster
// are above the fold on tab open. One predicate drives BOTH (the map-panel
// height constant assumes the compact header), via the `sr-header-compact` /
// `sr-map-panel-ios` classes in globals.css. Desktop and web are untouched.
export function compactChrome(): boolean {
  return isIOS();
}

// icloud-sync FR-01/FR-02: the iCloud Sync section, its toggle, its notes and
// its actions render ONLY in the macOS and iOS/iPadOS apps, and the sync
// controller boots only there. One predicate, consumed by Settings.tsx and
// App.tsx, so the platform decision is greppable and unit-testable with the
// platform probes mocked both ways. Windows desktop (isTauri true, neither OS
// probe true), web and Pi (isTauri false) are false by construction, so no
// iCloud markup exists on those builds (gated markup, never hidden markup).
export function showICloudSync(): boolean {
  return isTauri() && (isIOS() || isMacOS());
}
