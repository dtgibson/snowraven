// Platform-conditional visibility gates for the mobile-app feature
// (schema §2.5's conditional-surfaces list). Kept as named predicates in one
// module so the FR they implement is greppable and unit-testable with
// isIOS() mocked both ways — components consume the gate, not raw isIOS().
import { isIOS } from './platform';

// FR-14 — the in-app update affordance is ABSENT on iOS/iPadOS: updates flow
// through TestFlight / the App Store, and the updater/process plugins are not
// even compiled into the mobile binary (#[cfg(desktop)] in src-tauri). This
// gate hides the UI half; desktop and web/Pi keep their existing affordances.
export function showUpdaterFooter(): boolean {
  return !isIOS();
}

// FR-15 / FR-23 — the Tier B "Offline maps" region-download section is hidden
// on iOS/iPadOS (desktop-only in v1). Deliberately `!isIOS()` rather than the
// schema's literal `isTauri() && !isIOS()`: the web build currently RENDERS
// the section (disabled toggle + honest note), and the PRD forbids desktop/web
// behavior changes — so web keeps its section and only iOS loses it.
export function showOfflineMapsSection(): boolean {
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
