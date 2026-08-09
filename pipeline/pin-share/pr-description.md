## Pin Share

### What this does

Drop a transient pin on any SnowRaven birding map with a right-click (desktop) or a long-press (touch), see that spot's coordinates on screen, drag the pin to fine-tune, and copy a share-ready block to the clipboard. The default payload is three lines: the coordinates in decimal degrees, a Google Maps link, and an Apple Maps link. A new Settings preference under a **Sharing** section switches to coordinates only.

Every share-pin map also carries a round pin button in its bottom-right corner that plants the pin at the center of the current view, which is both the required keyboard route and the feature's discoverability. On Map Explorer's Hotspots, Nearby Lifers, and Media Targets views, where the drop gesture is already claimed by the v0.5.43 search center, the **existing** center pin becomes a real button that opens the same copy popup; the drop-to-search path is literally untouched.

Everything is built locally as strings. The feature adds no npm package, no backend route, no bundled asset, and **no network request of any kind**, so `PRIVACY_POLICY.md` needs no change and the whole flow works offline.

### How to test

1. Start the app (`cd frontend && npm run dev`, then `cd backend && uvicorn main:app --reload --port 1620`) and open http://localhost:5173.
2. **Map Explorer → My Sightings.** Right-click the map. A red flag plants at the point you pressed and a popup shows its coordinates. Drag the flag: the coordinates follow. Press **Copy coordinates and links** and paste somewhere: you should get exactly three lines.
3. Press **Esc**. The pin and the popup both go away.
4. Press the round pin button at the bottom-right (first in the row, before Fullscreen and Filters). The pin plants at the center of the view and the button tints green. Tab to **Copy**, press Enter, then Esc: focus returns to the pin button.
5. **Map Explorer → Hotspots.** Right-click the map: it should set the search center and re-run the search exactly as before, with no popup. Now click the green search-center pin: the copy popup opens. Drag the pin instead: it re-runs the search and does **not** open the popup.
6. Switch back to My Sightings: no pin should be present.
7. **Species Detail** → pick a species with sightings → Sighting Locations. Right-click the map in **Pins** mode, then toggle to **Heatmap** and right-click again. Both modes must work. Drop a pin, then change the species: the pin should be gone.
8. **Statistics → Geographic Stats** and **Named Birds** (expand an individual with a map): same gesture, same button. The Named Birds popup is the compact density and still carries every label.
9. **Settings → Sharing.** Switch to **Copy coordinates only**; the example below the options changes to one line. With a share popup open on a map tab, change the preference: the popup's button relabels immediately and the next press copies the new payload.
10. Reload (or relaunch the desktop app): the preference is still selected.

### Notes for reviewer

- **OQ-01 and OQ-02 were verified live rather than assumed.** `https://maps.apple.com/?q=<lat>,<lng>` returns `301 → /place?coordinate=<lat>%2C<lng>` under both macOS and iOS user agents, i.e. Apple's own server recognises the value as a coordinate and routes it to a pinned place. A control request with a non-coordinate `q` (`?q=Putah+Creek`) redirects to `/search?query=…` instead, which is what proves the coordinate branch is real. The PRD's `?ll=&q=` fallback produces the identical redirect, so it buys nothing and costs 20 characters. The short form ships, as D-04 ratified. Google's `?q=` form returns `302 → https://maps.google.com/maps?q=<lat>,<lng>`.
- **The gesture was extracted, not duplicated.** `CenterPinDropper`'s effect body moved verbatim into `components/map/useMapLongPressDrop.ts`; `CenterPinDropper` is now a two-line wrapper. `components/map/CenterPinDropper.test.tsx` is **byte-unchanged** and green, which is the QA-54 evidence that the center-view drop path did not move.
- **`applyCenter` and the `<CenterPinDropper onDrop={applyCenter} />` line in `MapExplorer.tsx` are untouched.** The share popup on those views is driven by new state that only the pin's own click handler sets, so a drop-to-search is byte-identical to today (FR-16).
- **Two existing test files were edited, both mock-only, with no assertion changed.** `BirdingStats.test.tsx` gained `useMap` in its `react-map-gl/maplibre` mock (the geographic map now mounts a child that reads the map instance) and `SightingsMap.test.tsx` is untouched. `CenterPinDropper.test.tsx` is untouched by design.
- **`compact` is required on `SharePin` and `SharePopup`** per the `MediaFrame` precedent. It is defaulted on `SightingsMap` only so that component keeps its existing optional-prop shape and its test suite stays byte-unchanged; both call sites pass it explicitly anyway.
- **Species Detail reaches the pin down two independent paths** (the shared `SightingsMap` in Pins mode, its own inline `SharePin` in Heatmap mode). Both carry `selectedSpecies` as a reset key and there is a test per path, plus a structural guard, so a half-fix fails exactly one case.
- **Entry chunk:** `lib/shareLocation.ts` and `lib/shareCopyPreference.ts` are map-free by contract, because `Settings.tsx` imports the preference and is on `App.tsx`'s static graph. `entryChunk.test.ts` was extended with explicit absence assertions for the three new `components/map/` files, plus a guard-the-guard case asserting the two lib modules genuinely ARE on the entry graph (otherwise the map-free assertion would pass vacuously).
- **The capture-phase document Escape listener is deliberate**, so the share popup is the innermost dismiss layer and does not also exit map fullscreen. It is called out in the Convention Flags.
- The two `onContextMenu` handlers on this feature's own pins are **redundant defence in depth, not the mechanism**. Maplibre's canvas-container handler already ends with `this._map.listens("contextmenu") && e.preventDefault()`, and every share-pin surface registers a `contextmenu` listener, so the browser menu is suppressed over existing markers too.

### Fixed after QA round 1

- **QA-33 / FR-27, a repeat identical copy was never announced.** `setAnnouncement(MSG_COPIED)` with the string already in state made React bail out, so the `aria-live` region's DOM never mutated and assistive tech announced nothing on a second copy of the same location. The visible confirmation re-rendered every press, which is what made it easy to miss. The region now holds `{ text, seq }` and renders the message in a `seq`-keyed child, so every announcement is a real node replacement (an "addition" in `aria-live` terms) while the region stays mounted from first render and its `textContent` remains exactly the message, with no invisible characters smuggled in. `SharePopup.test.tsx` measures this with a `MutationObserver` rather than reasoning about it, and the case was confirmed to fail against the pre-fix implementation.
- **The compact popup did not fit the 220px Named Birds card map, and its cap was in the wrong unit.** `9.5rem` was text-relative while `.sr-named-map` is a fixed 220px that never grows, so at 200% in-app text scale the cap doubled to 304px exactly where it had to shrink, and a roughly 195px popup was clipped (not scrolled) by that card's `overflow: hidden`. The cap is now a px custom property `SharePopup` measures from the map's own height and the pin's projected position, bounded by the designed 152px maximum and floored at a 44px touch target, recomputed on map move and on container resize. The failure block and Select all stay inside that capped, scrollable body. Four cases pin the behaviour, all confirmed to fail against the pre-fix implementation.
