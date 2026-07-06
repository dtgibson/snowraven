# PRD — Mobile App (iOS + iPadOS)
**Feature:** mobile-app
**Date:** 2026-07-04
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

A universal iOS/iPadOS app — one app target, iPhone and iPad both first-class — that ships the existing hardened SnowRaven frontend and TypeScript service layer on Apple mobile devices, distributed to the user's own devices via TestFlight with a complete App Store submission package prepared. Every existing tab runs in its device-appropriate rendering; the two CSVs arrive on-device through the standard iOS document picker; the privacy posture is inherited unchanged.

## User Stories

> **US-01** — As a birder in the field with my iPhone, I want the full SnowRaven tab set (species history, targets, county progress, maps) in the phone-tier layout, so that the app's insights are available at the moment I'm deciding what to chase.

> **US-02** — As a birder who just submitted a checklist from my phone, I want to paste the checklist ID, get the formatted weather + tide block, and copy it to the clipboard, so that the founding workflow completes end-to-end on mobile.

> **US-03** — As a SnowRaven user setting up the mobile app, I want to import my eBird backup CSV and ML export CSV through the standard iOS Files picker and have them persist across relaunches, so that getting my data onto the device is a one-time, ordinary iOS action.

> **US-04** — As an iPad user on the couch, I want the richer existing layouts — multi-column Statistics, map beside sidebar, the Calendar year overview — in both orientations and in Split View / Slide Over, so that the app uses the iPad canvas instead of showing a stretched or letterboxed phone UI.

> **US-05** — As a privacy-conscious birder, I want my data to stay on the device, network calls to go only device-to-provider with my own keys, and the Tier A offline behaviors to hold with no signal, so that the founding local-first posture is unchanged on mobile.

> **US-06** — As the app's owner, I want a TestFlight build running the full feature set on my own iPhone and iPad, plus a complete and accurate App Store submission package, so that shipping to the App Store is a single decision left in my hands.

## Functional Requirements

### A. App target and devices

> **FR-01** — The app shall build as one universal iOS/iPadOS app target whose single build installs and runs on both the iPhone and iPad device families.

> **FR-02** — On iPad, the app shall support both portrait and landscape orientations, reflowing the layout on rotation without losing state or clipping content. On iPhone, the app shall support portrait; where the OS presents other orientations, the layout shall reflow rather than break.

> **FR-03** — The layout shall respond to live window-size changes — iPad Split View, Slide Over, and rotation — without reload: a narrow pane shall receive the phone-tier layout, and widening the pane shall restore the richer tier, per the existing CSS-tier + matchMedia system.

> **FR-04** — On iPad, the app shall render on the native iPad canvas. A letterboxed or scaled-up phone UI is a failure of this requirement.

### B. Full tab set

> **FR-05** — All ten existing tabs (Weather, Statistics, Calendar, Species Detail, Map Explorer, Multimedia, Breeding Codes, Checklists, List Comparer, Named Birds) plus Settings and Help shall load and function on both device families, computing from the imported data exactly as on desktop.

> **FR-06** — Each surface shall render in its device-appropriate existing tier: the phone tier on iPhone and narrow split panes; the tablet/desktop tiers on the iPad canvas (e.g. multi-column Statistics, map-plus-sidebar Map Explorer).

> **FR-07** — Existing phone-tier behaviors are the design, not gaps: deliberate phone-tier reductions (e.g. the Calendar showing only its phone view mode on phones) shall carry over on iPhone, while iPad shall retain the full desktop behavior of those surfaces.

### C. File import (the new mobile UX)

> **FR-08** — The user shall be able to import the eBird backup CSV via the standard iOS document picker / Files app, from any location the picker can reach (On My iPhone/iPad, iCloud Drive, third-party providers).

> **FR-09** — The user shall be able to import the ML export CSV the same way, independently of the eBird backup.

> **FR-10** — Imported files shall persist in app storage with the existing storage-seam semantics: they survive app relaunch and device restart without re-import.

> **FR-11** — Re-importing a file shall replace the prior file of that kind, and all tabs shall recompute from the new data with the existing cache-invalidation semantics.

> **FR-12** — The existing Settings upload surface shall adapt to the platform: on iOS/iPadOS it shall present the native document picker (no inert web-style file input), and after import it shall show the app's existing file metadata display (file name, size/rows, upload date) as confirmation.

> **FR-13** — A failed or invalid import (wrong file type, malformed CSV, user cancels the picker) shall produce the app's existing clear error states — or a clean no-op on cancel — leaving previously imported data intact and the app usable.

### D. Platform-conditional behavior

> **FR-14** — The in-app update mechanism shall be absent on iOS/iPadOS: no update check, no update UI, no self-update capability in the mobile build. (Updates flow through TestFlight/App Store; at most, update-related copy may point at the App Store.)

> **FR-15** — Desktop-only Settings shall be hidden on iOS/iPadOS — the Tier B "Offline maps" region-download section and any other desktop-specific maintenance controls — with no dangling references, dead controls, or errors from their absence.

> **FR-16** — "Use my location" shall work on iOS/iPadOS: first use triggers the system location permission prompt; a grant fills the location as on desktop; a denial degrades gracefully through the app's existing degradation patterns (clear message, manual entry and place search remain fully usable; the app never blocks on the permission).

> **FR-17** — Clipboard copy shall work on iOS/iPadOS for every copy affordance, including the weather/tide block's copy-after-await path (the desktop auto-copy pattern), placing the exact block text on the system clipboard.

> **FR-18** — All outbound network calls shall continue through the existing transport seam, device-to-provider only, to the providers already disclosed in PRIVACY_POLICY.md. The mobile build shall introduce no new network destinations, telemetry, or accounts.

### E. Keys and settings

> **FR-19** — API keys (eBird, OpenWeather) shall be enterable in the existing Settings tab on both device families and shall persist on device across relaunch, enabling all key-gated features.

> **FR-20** — All app settings — theme, text size, date format, tab layout, default location, map preferences, and any other persisted setting — shall survive relaunch through the storage seam, as on desktop.

> **FR-21** — Keys shall be stored locally only and transmitted only to their respective providers (the eBird key only to eBird, the OpenWeather key only to OpenWeather), matching the existing per-call auth posture.

### F. Offline

> **FR-22** — Tier A offline behaviors shall carry over on mobile: the bundled taxonomy snapshot serves as the offline floor for favicons/sort/reportAs (including a first-ever cold start offline); a map that has loaded online once shall mount offline and draw the user's data layers via the persisted style; weather/tide results loaded online once shall replay offline with the "last loaded result" cue.

> **FR-23** — Tier B offline map region downloads shall be absent on iOS/iPadOS without breaking anything: no download UI, no errors, and the map's online and Tier A offline behavior unaffected.

> **FR-24** — The three honest degradation states — offline, no-key, and server/provider error — shall present their existing distinct messages on mobile everywhere a live feature runs; the app shall never show an indefinite spinner or a false success when unreachable.

### G. Distribution

> **FR-25** — A TestFlight build shall install and run the full tab set on the user's own physical iPhone and iPad, using the existing Apple Developer account. This is the v1 completion milestone.

> **FR-26** — An App Store submission package shall be prepared as a deliverable of this run: App Store metadata (name, subtitle, description, keywords, category, age rating), screenshots for both device families, privacy nutrition labels, and reviewer notes (including how a reviewer can exercise the app — see Open Questions). Actually submitting is the user's explicit final step, outside the pipeline.

> **FR-27** — All submission screenshots shall come from synthetic demo data (the established website-screenshot convention), never the user's real eBird/Macaulay data.

### H. Records — PHASED (user decision, 2026-07-05)

The user's announcement policy governs this area: **no public mention of the
mobile apps on the website or README while they are in the testing/TestFlight
phase.** The mobile apps are announced as available only once live on the App
Store (further TestFlight dev rounds may happen before that). Records work is
therefore split into two phases:

> **FR-28** — *(Phase 1 — this run)* Any privacy-statement changes the new
> platform genuinely requires (the iOS location permission wording,
> TestFlight/App Store distribution notes, confirmation the provider list and
> no-collection posture are unchanged) shall be PREPARED as part of the
> submission package (FR-26) but NOT published to the repo's public
> PRIVACY_POLICY.md while distribution is internal TestFlight (which requires
> no public policy change). The prepared text ships publicly in Phase 2.

> **FR-29** — *(Phase 2 — deferred to App Store launch, OUT of this run's
> verification)* README.md, docs/HELP.md, and the website shall be updated to
> announce the iOS/iPadOS platform (availability, file-import instructions,
> platform differences) only when the user makes the App Store listing live.
> During this run those surfaces shall remain SILENT about mobile — QA must
> verify the absence of mobile mentions, not their presence. (In-app Help
> content that would surface in shipped desktop builds counts as public for
> this purpose.)

> **FR-30** — *(Phase 2 — deferred)* product-brief.md's founding distribution
> line is updated at App Store launch. This run's Chronicler records the
> phased-announcement decision in DECISIONS.md so no interim release
> "helpfully" updates the public surfaces early — this deliberately overrides
> the standing "always update README/website with every feature" convention
> for the mobile platform until launch.

## Non-Functional Requirements

> **NFR-01 — Performance:** With a large backup (~20k rows) imported, a cold launch on a supported device shall reach an interactive Weather tab within 5 seconds, and opening any tab shall complete its compute (via the existing parse-once caches) without the OS terminating the app.

> **NFR-02 — Touch targets:** Interactive controls in the phone tier shall meet the existing ~44px touch-target posture (`.sr-touch-target`) on iPhone and in narrow iPad panes.

> **NFR-03 — Input zoom:** Focusing any form control on iOS shall not trigger the automatic focus-zoom (the `.sr-input-16` guard holds app-wide), and pinch-to-zoom shall remain available (no viewport `maximum-scale` clamp).

> **NFR-04 — Accessibility:** The WCAG 2.1 AA posture carries over: existing semantics (accessible names, contrast tokens, keyboard/list alternatives to map gestures) shall function under iOS assistive technologies (VoiceOver), and ACCESSIBILITY.md shall remain true for the mobile build.

> **NFR-05 — Privacy label accuracy:** The App Store privacy nutrition label shall exactly match observed app behavior — as close to "Data Not Collected" as Apple's taxonomy allows, with device-to-provider calls and the optional location use represented honestly.

> **NFR-06 — App size and load discipline:** The on-demand chunk boundaries (maplibre vendor, taxonomy snapshot, county boundaries) shall hold in the mobile build — none load at first paint — and the packaged app size shall remain sane for a bundled-asset app (no accidental duplication of large assets).

> **NFR-07 — Safe areas:** Content and fixed UI (tab navigation, map FAB cluster, fullscreen map overlay, popups) shall respect iOS safe-area insets — notch/Dynamic Island, home indicator, rounded corners — in both orientations, per the existing `viewport-fit=cover` posture.

> **NFR-08 — Memory stability:** The app shall remain stable (no crash, no blank WebView) under iPad Split View / Slide Over resizing with memory-heavy surfaces open (Map Explorer with overlays), within WKWebView's mobile memory constraints.

> **NFR-09 — Text scale:** All surfaces shall hold at 200% in-app text scale on iPhone-width viewports with no page-level horizontal scroll, per the existing 320px/200% invariant.

## Out of Scope

Carried from the approved strategic brief, in full force:

- **Android** — explicitly "to follow" as its own feature; nothing in v1 may block it, but nothing targets it.
- Accounts, cloud sync, or any developer-operated server — the founding out-of-scope list applies with full force.
- Any new backend; the device runs no Python, same as desktop.
- Feature redesigns or new features beyond device-appropriate rendering — existing phone-tier behaviors (e.g. the Calendar's single-view mode on phones) are the design, not gaps to fix; on iPad the existing wider tiers apply.
- Tier B offline map region downloads on iOS (desktop-only in v1; Tier A offline resilience — persisted map style, weather/tide replay, bundled taxonomy — carries over).
- Apple Pencil-specific interactions, iPad-exclusive features, visionOS, widgets, Siri/Shortcuts, watchOS, push notifications, background sync — no platform-specific surface area beyond running the app well on iPhone and iPad.
- App Store review outcomes and timing — prepared for, not promised. Submission itself is the user's explicit final step.

Added during PRD writing:

- Changes to the desktop (macOS/Windows) or web/Pi builds beyond what platform-conditional gating requires — their behavior is byte-equivalent except where a platform branch is explicitly introduced.
- Document-provider "open in place" editing, share-sheet *export* of the CSVs, or acting as a Files location — import via the picker is the whole v1 surface.
- iCloud backup semantics beyond the OS default for app data (no custom backup/restore feature).

## Open Questions

> **OQ-01 — Minimum iOS/iPadOS version.** What OS floor does the app target?
> **Default:** the lowest version that supports every web-platform feature the app relies on (CSS container queries, `dvh` units, the existing matchMedia patterns) within what Tauri v2's iOS target supports — expected to land at iOS/iPadOS 16 or later. The Architect confirms the exact floor at Stage 3.

> **OQ-02 — App display name and bundle identity.** What name and bundle id does the mobile app ship under?
> **Default:** derive from the existing identity — display name "SnowRaven", bundle id `com.snowraven` (or the minimal Apple-required variant if App Store Connect demands a distinct id from the notarized Mac app). The Architect confirms against the developer account's existing registrations.

> **OQ-03 — Screenshot tooling.** How are the two device families' App Store screenshots produced?
> **Default:** the existing website screenshot convention — the synthetic demo dataset from `website/tools/gen-demo-data.mjs`, captured from the app running on iPhone- and iPad-class viewports (simulator or the existing Playwright capture pattern adapted). Never the user's real data.

> **OQ-04 — Geolocation mechanism on iOS.** How is FR-16 satisfied, given the desktop path is macOS-native and the mobile geolocation plugin was deliberately removed in v0.5.55?
> **Default:** re-add the mobile geolocation path behind the existing platform seam, per the brief's note that re-adding is small if mobile is Tauri-based. The Architect ratifies the mechanism; the PRD binds only the behavior (system prompt, grant fills location, graceful denial).

> **OQ-05 — App Store metadata specifics.** Category, age rating, keywords, and reviewer-notes content (Apple reviewers need a way to exercise a bring-your-own-data app — e.g. a bundled demo CSV pointer or instructions plus sample files).
> **Default:** category Reference, age rating 4+, keywords drawn from the website copy; reviewer notes include step-by-step instructions and the synthetic demo CSVs as reviewer-importable sample files. Presented for user approval inside the prepared submission package (FR-26), not before.

> **OQ-06 — iPhone landscape.** Is iPhone landscape formally supported or portrait-only?
> **Default:** allow it — the layout is responsive by construction and FR-02 requires reflow, not pixel-perfection. Lock to portrait only if verification surfaces a real defect, and log that as a decision.

> **OQ-07 — TestFlight scope.** Internal-only or external testers for v1?
> **Default:** internal testing on the user's own account and devices only — that satisfies the v1 milestone (FR-25); external TestFlight groups are a user decision later.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Universal app target (FR-01) | One build installs and launches to the app UI on both an iPhone and an iPad (simulator and device). |
| QA-02 | iPad orientation (FR-02) | Rotating an iPad between portrait and landscape reflows every open tab live, with no state loss, reload, or clipped content. |
| QA-03 | Live window response (FR-03) | In iPad Split View, the app's narrow pane renders the phone-tier layout; widening the pane restores the richer tier — both without reload. |
| QA-04 | iPad-native canvas (FR-04) | Full-screen iPad shows iPad-tier layouts (e.g. multi-column Statistics, map beside sidebar); no letterboxing or scaled phone UI on any tab. |
| QA-05 | Full tab set (FR-05) | Each of the ten tabs plus Settings and Help opens on both device families and renders correct content computed from the imported data. |
| QA-06 | Device-appropriate tiers (FR-06) | iPhone shows the phone tier (single-column layouts, condensed nav); iPad landscape shows the wider tiers on the same surfaces. |
| QA-07 | Phone-tier behaviors carried (FR-07) | The Calendar on iPhone shows its phone view mode only; on iPad it shows the full Compact/Large toggle. |
| QA-08 | CSV import via Files (FR-08, FR-09) | Importing the eBird backup via the iOS document picker populates Statistics; independently importing the ML export populates Multimedia. |
| QA-09 | Import persistence (FR-10) | Force-quit and relaunch after import: all tabs still compute from the data with no re-import. |
| QA-10 | Re-import replaces (FR-11) | Importing a second, different backup replaces the first: tab contents reflect only the new file. |
| QA-11 | Platform-adapted upload surface (FR-12) | The Settings file section on iOS opens the native picker (no inert web file input) and shows the existing file metadata after import. |
| QA-12 | Import failure handling (FR-13) | A malformed/wrong file yields the existing clear error; cancelling the picker is a clean no-op; prior data remains intact either way. |
| QA-13 | No updater on iOS (FR-14) | The iOS build contains no update check or update UI anywhere; desktop builds retain theirs. |
| QA-14 | Desktop-only Settings hidden (FR-15) | Settings on iOS shows no Tier B "Offline maps" section or other desktop-only controls, with no errors or dangling references. |
| QA-15 | Location permission flow (FR-16) | First "Use my location" tap raises the system prompt; grant fills the location; deny shows the graceful message and manual entry/place search still work. |
| QA-16 | Mobile clipboard (FR-17) | On iPhone, the weather+tide copy action (including the copy-after-await path) places the exact block on the clipboard, verified by pasting into another app. |
| QA-17 | No new network destinations (FR-18) | A full-feature session's outbound traffic reaches only the providers disclosed in PRIVACY_POLICY.md; no telemetry or new hosts. |
| QA-18 | Keys work and persist (FR-19) | Entering both API keys enables the key-gated features; after relaunch the keys are still present and features still work. |
| QA-19 | Settings persist (FR-20) | Theme, text size, date format, tab layout, and default location changes all survive a relaunch. |
| QA-20 | Key scoping (FR-21) | Keys exist only in local app storage; each request carries only its own provider's key (eBird key never sent to OpenWeather, and vice versa). |
| QA-21 | Tier A offline (FR-22) | In airplane mode: a cold start with data imported shows favicons/sort from the taxonomy floor; a previously loaded map mounts and draws sightings; a previously fetched checklist's weather/tide replays with the "last loaded" cue. |
| QA-22 | Tier B absent cleanly (FR-23) | No region-download UI exists on iOS and its absence produces no errors; online map behavior is unaffected. |
| QA-23 | Honest degradation states (FR-24) | Airplane-mode live-feature attempts show the offline message; a missing key shows the no-key message; neither shows an endless spinner or false success. |
| QA-24 | TestFlight milestone (FR-25) | The TestFlight build installs on the user's own physical iPhone and iPad and runs the full tab set on both. |
| QA-25 | Submission package complete (FR-26) | The package contains metadata, both device families' screenshot sets, privacy nutrition labels, and reviewer notes with a working way for a reviewer to exercise the app. |
| QA-26 | Synthetic screenshots (FR-27) | Inspection of every screenshot confirms only synthetic demo data appears — no real locations, dates, or names from the user's data. |
| QA-27 | Phased records policy honored (FR-28, FR-29, FR-30) | The submission package contains the prepared privacy-label/policy text; README.md, the website, docs/HELP.md, and the public PRIVACY_POLICY.md contain NO mobile-app availability mentions (grep-verified); the phased-announcement decision is queued for DECISIONS.md. |
| QA-28 | Launch performance (NFR-01) | Cold launch with a ~20k-row backup reaches an interactive Weather tab in ≤5s on a supported device; opening each tab completes without OS termination. |
| QA-29 | Touch targets (NFR-02) | Dense phone-tier controls measure ≥44px effective target height on iPhone (spot-check the known `.sr-touch-target` surfaces). |
| QA-30 | No focus zoom (NFR-03) | Focusing inputs across the app on iPhone never zooms the page; pinch-to-zoom still functions. |
| QA-31 | Accessibility carries over (NFR-04) | A VoiceOver smoke pass succeeds on the key flows (weather lookup, tab switching, a map's keyboard/list alternative); ACCESSIBILITY.md statements hold on mobile. |
| QA-32 | Privacy label truth (NFR-05) | Each nutrition-label claim is checked against observed behavior and matches; nothing collected is undeclared and nothing declared is uncollected. |
| QA-33 | Chunk discipline (NFR-06) | The mobile build's entry chunk excludes maplibre/taxonomy/county assets (entry-chunk guard green); those load only on demand. |
| QA-34 | Safe areas (NFR-07) | On a notched iPhone in both orientations, no content or fixed UI (tab nav, map FABs, fullscreen map, popups) is clipped by the notch/Dynamic Island/home indicator. |
| QA-35 | Split View stability (NFR-08) | Repeated iPad Split View resizes with Map Explorer and overlays open produce no crash or blank WebView. |
| QA-36 | Text scale invariant (NFR-09) | At 200% in-app text scale on an iPhone-width viewport, no page-level horizontal scroll appears and all surfaces remain usable. |
