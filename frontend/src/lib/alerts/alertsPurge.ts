// The clear registry's row for the alert inbox (ios-alerts, schema.md 7).
//
// The inbox is a NATIVE-OWNED store: `alerts/inbox.json` in the App Group
// container, written only by the Swift alert actor, outside the webview's `fs`
// grant. So this row has no `storage.deleteSetting` and no ordered writer; its
// purge is a message to the actor, which bumps its generation (a check in
// flight then writes nothing), deletes the inbox, cancels the pending summary
// (it is derived from the same file), and keeps the settings and the last
// check. `cacheInventory.test.ts` holds this third row class to exactly that
// shape.
//
// Registered on its KEY SET (CLAUDE.md, v1.0.14): every row exists only because
// a species was absent from the eBird backup. CLEAR only, never REPLACE: a newer
// backup does not run the registry, so a row stays as history (FR-28, FR-40).
//
// Lazy: reached from `clearDerived.ts` through `import()` only, and a no-op on
// every platform but iPhone and iPad, where it is the only path that loads the
// native wrapper. A rejection propagates, so `purgeDerivedOnClear` reports the
// row rather than calling a half-failed clear a clean one.

import { alertsSupported } from './alertsState'

export async function purgeAlertsInbox(): Promise<void> {
  if (!alertsSupported()) return
  await (await import('./alertsNative')).purgeInbox()
}
