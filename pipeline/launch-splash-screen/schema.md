# Schema — Launch Splash Screen

**Feature:** launch-splash-screen

**Stage:** 3, The Architect

**Source:** approved `strategic-brief.md` and `prd.md`

**Path:** Frontend Only — no data layer changes required

## Confirmation

Every user story and functional requirement concerns the launch frame, its timing, or the handoff to an existing destination. The feature creates no records, reads no new kind of data, changes no stored field, and adds no derived document or relationship. There are **no new tables, columns, files, settings, endpoints, migrations, or backend changes**. The existing data reads below continue to determine the destination; the splash only observes when those decisions have settled.

## Existing data used by the launch

| Existing source | Read already performed by | Use at launch |
|---|---|---|
| `sr-tab-layout` in `localStorage` (web/Pi) | `loadTabLayout()` in `frontend/src/lib/tabLayout.ts` | Synchronous saved order and visibility select the initial tab. A missing or malformed value uses the existing default. |
| `tabLayout` in the storage seam's settings document (Tauri desktop and iOS) | `storage.getSetting('tabLayout')` in `App.tsx` | Asynchronous saved layout can change the initially selected tab. Its result, including an absent or failed read, must settle before the splash reveals the shell. Preserve the current fallback behavior. |
| eBird and OpenWeather key slots, stored file metadata, and `welcomeSeen` in the storage seam | The existing first-run effect in `App.tsx`: `getApiKey('ebird')`, `getApiKey('openweather')`, `getFilesStatus()`, `getSetting('welcomeSeen')` | Resolve `coldStart` to the existing welcome or shell decision. This reads metadata, **not** CSV contents or tab data. Keep its current failure fallback. On web/Pi these reads use the existing settings routes; on Tauri they use local storage. |
| `sr-theme` and `sr-text-scale` in `localStorage`, plus the existing durable theme and scale preferences | `frontend/index.html` and the existing `App.tsx` effects | Keep the current prepaint preference behavior. The launch composition uses one fixed light/dark treatment, so it does not wait for later Tauri preference hydration. |
| iOS native parked widget URL (`widgets_take_pending_link`) | `linkController.ts` → `linkRequest.ts` → `App.tsx` | A cold widget link can select Map Explorer before the splash reveals the shell. The existing allowlist and last-link-wins behavior remain authoritative. Warm links continue within the open session. |

No splash-specific request goes through `transport`, no provider is contacted, and no persistent splash flag is written. A full page load creates a new in-memory launch instance; tab switches and other in-session work do not.

## Startup path and handoff design

### What exists now

`frontend/index.html` puts the text-and-spinner boot view **inside** `#root`. `main.tsx` replaces that node with `RootErrorBoundary` and `App`. `App` initially chooses a tab synchronously, then separately resolves the desktop saved layout and first-run welcome in effects. The iOS link controller currently starts through a dynamic import after first paint. Consequently, React mounting is earlier than the point at which the correct first destination is known. The iOS storyboard currently paints `systemBackgroundColor`, which cannot visually join the green frontend frame.

### Minimal ownership change

1. Put the static launch surface in `frontend/index.html` as a **sibling of `#root`**, with its CSS and tiny status/recovery controller available before the module script. It owns the first frontend paint even if the React bundle is slow. Keep the glyph decorative and one status node for assistive technology. Keep `#root` inert while the launch surface covers it; clear inert when removing the surface or showing the root error. Do not autofocus the splash.
2. Use the committed glyph master (`frontend/src/assets/snowraven-bird-glyph.svg`) for the pre-React frame, and the existing `RavenGlyph` component at its React sites. Avoid a second hand-maintained SVG path. The Designer sets the exact field, glyph color, size, and optical placement; the native asset is derived from the same master. A pre-React asset reference must resolve in the built Vite output as well as development and remain bundled/offline. The splash may fetch that bundled asset, but introduces no provider call or data read.
3. Track only three destination decisions in `App.tsx`: first-run `coldStart !== null`; saved layout settled on Tauri (already synchronous on web/Pi); and the iOS initial parked-link check settled. Start the existing iOS link controller once during launch selection, concurrently with the other reads, rather than behind the current after-first-paint timer. Leave widget hand-over and iCloud startup deferred. An explicit cold link uses the existing pending-link store and routing. If the first-run welcome is eligible, keep the existing welcome decision and let the link remain the requested destination beneath it until the welcome is dismissed; do not write `welcomeSeen` or alter eligibility.
4. After the React commit containing the resolved welcome or selected shell, remove the static launch surface in a layout effect before the browser's next paint. The shell's own normal setup, loading, or error state counts as usable; **do not** wait for a lazy tab chunk, CSV parse, network result, map, iCloud task, or idle prefetch. Use a one-way, idempotent release for this page load. If all decisions resolve before the first paint, removal may mean the app-owned splash is never seen.
5. On a render error, `RootErrorBoundary` tells the launch controller to reveal its existing actionable error immediately. On a known entry-module load failure, the pre-React controller reveals its Reload recovery immediately. If startup merely remains pending, the controller's timers update the status without blocking eventual release. Do not treat a long elapsed time alone as a failed startup.

This is one launch surface and one release signal, not a second React overlay or a separate launch-state store. No transition animation is needed: removing the surface before paint gives the destination interaction immediately and satisfies reduced motion by construction. A warm widget link never recreates the removed surface.

### Native continuity

`src-tauri/gen/apple/LaunchScreen.storyboard` should use a fixed, opaque green field and a centered image view whose asset is generated from the committed glyph master. Center against the full view, not the safe-area guide, with fixed point size and aspect fit. The frontend surface is likewise fixed to the viewport (`inset: 0`), outside the iOS body safe-area padding; keep the glyph at a fixed apparent size rather than scaling it with the window. The Designer supplies exact color and optical offsets, and the Engineer matches those values in the storyboard, bundled frontend style, and any native window/webview background setting that a recorded launch shows is needed to avoid a blank intermediary. The current Xcode project includes both `LaunchScreen.storyboard` and `Assets.xcassets` as resources. Preserve that wiring and verify the produced iOS build, since source markup alone cannot prove the native-to-webview frame.

The glyph stays at the visual center when status text appears. Position the status and Reload action independently below it; do not center a growing glyph-plus-text column as one group. Allow the text to wrap and remain operable at 320px width and 200% text scale.

## Slow starts and recovery thresholds

**Retain the Planner's 2-second and 15-second defaults.** The traced launch path has a bounded set of local decisions (saved layout, first-run metadata, and on iOS one parked-link take) that may be asynchronous; tab data, maps, provider responses, iCloud, and prefetch are outside the handoff. A fixed hold would add latency to normal starts, while a 2-second status gives context only when those local decisions or bundle loading remain visibly pending. Fifteen seconds is a recovery offer for a stalled bundle or storage bridge, **not** an automatic dismissal: revealing the shell before selection settles risks the wrong tab or welcome flash. No existing startup benchmark in the approved artifacts justifies a different numeric threshold. The Engineer should measure cold starts on the supported surfaces; a later timing change needs observed evidence, not an animation target.

Start both clocks from the first app-owned visible frame, using an animation-frame callback and elapsed monotonic time; if the surface is removed before a paint, no slow-start clock is needed. A throttled timer can catch up after backgrounding. At 2 seconds, make the existing “Opening SnowRaven…” status visible without changing its accessible text or repeating its announcement. At 15 seconds, change that same status to “SnowRaven is taking longer than expected” and show Reload. Keep the pending startup able to release automatically at any later time. Clear timers on release or known failure. The Reload control is the only focusable splash element and is operable by keyboard; it receives no automatic focus.

## No data layer work required

The Engineer can proceed to the shared frontend and iOS launch presentation. Do not add a migration, a persistent `splashSeen`/timestamp setting, a new backend route, a new data-file read, or a splash-specific network or telemetry call.

## Verification seams for implementation

- Build the frontend and inspect the emitted HTML/asset reference, then hold the entry bundle to verify the branded first frontend frame and 2-second/15-second status sequence on web and desktop. A module-load failure must expose Reload without waiting 15 seconds.
- Hold each destination decision independently. Verify no provisional tab appears for a saved desktop layout, no shell flashes before welcome, and a cold iOS widget link reaches Map Explorer while a warm link causes no splash. Release as soon as the correct shell or welcome commits, including when the selected tab's own loading state remains.
- Record iPhone and iPad cold launches through the native-to-webview handoff in both system appearances, including rotation and iPad resize. Inspect actual frames for a white interlude or glyph jump; a running process is insufficient evidence. Check the real accessibility tree and reduced-motion behavior, plus 320px/200% layout.
