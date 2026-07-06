# Strategic Brief — Mobile App (iOS + iPadOS)

## What We're Building
A native SnowRaven app for iPhone **and iPad** — one universal app, both device families first-class — carrying the full feature set in its phone- and tablet-appropriate rendering, distributed through the iOS App Store. v1 ships the existing hardened React frontend and TypeScript service layer on Apple mobile via the app's existing desktop-app architecture; Android follows as its own later feature.

## Why Now
The groundwork is finished and pointing here. The v0.5.37 responsive sweep made every screen reflow from ~320px up through large desktops (which is also the iPad range — the tablet/desktop tiers already exist); the v0.5.55 mobile-prep pass closed the last two lenses (44px touch targets, iOS input-zoom suppression), and v0.5.61 made the input-zoom guard actually bind app-wide. Every surface holds at 320px and 200% text scale. The platform seams (transport / storage / platform / clipboard) were hardened across the Windows release, and the desktop already runs the entire app with no Python on the machine — the exact posture a mobile device requires. This is roadmap Up Next #1, and nothing upstream of it remains.

## The User Problem
The person SnowRaven serves — a birder living in their own eBird and Macaulay data — is in the field with a phone, not a laptop. Today the desktop app's insights (species history, targets, county progress, the weather block workflow, offline-capable maps) are unreachable at the moment they're most useful: standing somewhere deciding what to chase, checking what a county still needs, or pasting a weather block right after submitting a checklist. At home, the same person reaches for an iPad on the couch, where the app should breathe — multi-column stats, map beside sidebar, the year-at-a-glance Calendar — not show a stretched phone screen. A device-appropriate app on both closes that gap without compromising the founding posture: local data, user's own keys, nothing collected.

## Success Criteria
- The app builds and runs the full tab set on an iPhone and an iPad (simulator and the user's own devices), with every surface usable in its device-appropriate rendering — the phone tier on iPhone; richer multi-column / map-plus-sidebar / Calendar-overview layouts on iPad. No tab is dropped; no iPad screen is a letterboxed or scaled-up phone UI.
- iPad works beautifully in **both orientations and in Split View / Slide Over** — layouts respond to live window-size changes (the existing CSS-tier + matchMedia system does this by construction), and a narrow iPad split pane correctly gets the phone-tier layout.
- The user can get their eBird backup and ML export onto the device through the standard iOS document picker / Files app and every tab computes from them, offline-capable as on desktop.
- The founding workflow works end-to-end on both devices: paste a checklist ID, get the weather + tide block, copy it to the clipboard.
- The app reaches the user's own iPhone and iPad via TestFlight — this is the v1 "done" milestone the pipeline can verify.
- The App Store submission package (metadata, screenshots for both device families, privacy nutrition labels, review notes) is prepared and accurate; actually submitting — and Apple's review clock — is the user's explicit final step, outside the pipeline.
- The privacy posture is provably unchanged: no new network destinations beyond the already-disclosed providers, no telemetry, no accounts — which is also what makes the privacy labels honest and simple.

## Scope
- One universal iOS/iPadOS app target on the existing codebase (iPhone + iPad device families), reusing the React frontend and TS service layer through the existing desktop-app architecture; the Architect ratifies the concrete build path.
- Device-appropriate presentation across the whole range: the established responsive tiers ARE the design — phone tier on iPhone and narrow split panes, tablet/desktop tiers letting iPad layouts breathe in both orientations. "Reactive and beautiful on both" is in scope as polish work where a surface composes poorly on the iPad canvas, not as redesign.
- On-device file import UX for the two CSVs (iOS document picker / share sheet) — a first-class scope item for the Planner; this is the mobile moment with no desktop precedent.
- Platform-conditional behavior: hide/redirect the in-app updater (Apple prohibits self-updating; updates flow through TestFlight/App Store), hide desktop-only Settings (offline region downloads), and restore a mobile-capable "Use my location" path (the desktop path is macOS-native; the mobile geolocation plugin was deliberately removed as dead code in v0.5.55 with re-adding noted as small if mobile is Tauri-based).
- Signing, provisioning, and TestFlight distribution using the user's existing Apple Developer account (the same one that notarizes the Mac app today).
- App Store submission materials prepared (both device families' screenshots). Record updates are PHASED per the user's announcement policy (2026-07-05): public surfaces (README, website, in-app Help, public PRIVACY_POLICY.md, the product brief's distribution list) stay SILENT about mobile through the TestFlight phase; the announcement lands only when the apps go live on the App Store. Privacy/label text is prepared inside the submission package meanwhile. (PRD area H governs.)

## Out of Scope
- **Android** — explicitly "to follow" as its own feature; nothing in v1 may block it, but nothing targets it.
- Accounts, cloud sync, or any developer-operated server — the founding out-of-scope list applies with full force.
- Any new backend; the device runs no Python, same as desktop.
- Feature redesigns or new features beyond device-appropriate rendering — existing phone-tier behaviors (e.g. the Calendar's single-view mode on phones) are the design, not gaps to fix; on iPad the existing wider tiers apply.
- Tier B offline map region downloads on iOS (desktop-only in v1; Tier A offline resilience — persisted map style, weather/tide replay, bundled taxonomy — carries over).
- Apple Pencil-specific interactions, iPad-exclusive features, visionOS, widgets, Siri/Shortcuts, watchOS, push notifications, background sync — no platform-specific surface area beyond running the app well on iPhone and iPad.
- App Store review outcomes and timing — prepared for, not promised.

## Key Decisions
- **Reuse the hardened frontend via the existing desktop-app architecture — no rewrite.** A React Native or Swift rewrite would discard 97 shipped versions of hardened, tested frontend (responsive system, accessibility pass, offline tiers, the platform seams). The strategic commitment is: the mobile app IS this codebase on Apple mobile devices. The *how* (build targets, capabilities, signing config) belongs to the Architect.
- **One universal app, iPad first-class.** iPhone and iPad are both v1 targets in a single app — device-appropriate layouts on each, never a phone UI scaled onto the iPad canvas. iPad multitasking (Split View / Slide Over) resizes the app live, so layout must key off window size, not device identity — which the existing CSS-tier + matchMedia approach already does by construction (a load-bearing point in favor of the reuse decision). A narrow iPad split pane getting phone-tier layout is correct behavior, not a bug.
- **TestFlight-first milestone.** v1 is done when the app runs the full feature set on the user's own iPhone and iPad via TestFlight. App Store submission is prepared in full but executed by the user — Apple's human review is outside the pipeline's control and must not gate the feature's completion.
- **Manual file import, no cloud.** The eBird backup and ML export get onto the device via the iOS document picker / Files app, by the user's hand. No sync service, no account, no companion uploader — consistent with the founding decisions, and the simplest true answer for the privacy labels.
- **Privacy posture inherited wholesale.** No analytics, telemetry, accounts, or new providers; network calls remain device-to-provider with the user's own keys. The App Store privacy nutrition label should read as close to "Data Not Collected" as Apple's taxonomy allows, with the provider calls already disclosed in PRIVACY_POLICY.md.
- **Updates via the App Store, not the in-app updater.** The minisign/`latest.json` updater is desktop-only; on iOS/iPadOS the update UI must not offer in-app updating (at most, point at the App Store).
- **"Full feature set" means every tab, device-appropriately rendered** — phone-tier on iPhone, the richer existing tiers on iPad — not desktop pixel parity on either.
- **Android is a separate future feature** — the platform seams keep the door open; this brief spends nothing on it.
- **Alignment note (not a conflict):** the product brief's founding distribution decision enumerates "standalone Mac/Windows desktop app and self-hosted Pi/Linux install." Mobile extends that list rather than contradicting it — it's roadmap #1 and squarely serves the same user and posture — but `product-brief.md`'s distribution line should be updated when this ships so the founding record stays true.
