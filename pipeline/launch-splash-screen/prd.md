# PRD — Launch Splash Screen
**Feature:** launch-splash-screen
**Date:** 2026-09-25
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

SnowRaven will show a small raven glyph centered on a full-screen green field while a new app session opens. The native iOS launch frame and the first shared frontend frame will form one continuous opening that yields as soon as the app can show a usable destination or an actionable startup problem.

## User Stories

> **US-01** — As a birder opening SnowRaven on iPhone or iPad, I want the native launch frame to lead smoothly into the app, so that opening it feels like one start.

> **US-02** — As a birder opening SnowRaven on Mac, Windows, or a self-hosted web install, I want to see SnowRaven's mark while the app starts, so that the first painted frame is recognizable.

> **US-03** — As a returning birder, I want the splash to leave as soon as my app screen is usable, so that branding never slows my route to my data.

> **US-04** — As a new birder, I want the splash to lead directly to the first-run welcome, so that I do not briefly see a different tab first.

> **US-05** — As a birder whose app starts slowly or fails, I want an honest status and a way forward, so that I am not left staring at an inert logo.

> **US-06** — As a screen-reader or reduced-motion user, I want a clear loading state without distracting or repeated announcements, so that the opening remains understandable and comfortable.

## Functional Requirements

### Entry and visual continuity

> **FR-01** — The launch splash shall be available during each new app or browser-page load across iPhone, iPad, Mac, Windows, and self-hosted web/Pi installations. A full page reload counts as a new load. A fast load may go straight to its destination without painting the app-owned splash.

> **FR-02** — The splash shall use the committed SnowRaven raven glyph as a small, visually centered mark on a green field covering the available window. It shall show no wordmark, slogan, progress percentage, or decorative spinner.

> **FR-03** — On iPhone and iPad, the native launch frame shall match the first app-owned splash frame in field treatment, glyph silhouette, apparent size, and position closely enough that the handoff shows no visible jump or intervening blank frame.

> **FR-04** — On Mac, Windows, and self-hosted web/Pi, the branded splash shall be the first frame the shared frontend can paint, including before the interactive app mounts.

> **FR-05** — The field shall fill the viewport and the glyph shall remain visually centered when a phone or tablet rotates, an iPad window is resized, a desktop window changes size, or safe-area insets change. The glyph shall remain small rather than scaling with the window.

> **FR-06** — The opening shall remain a deliberate green-and-glyph composition in both light and dark settings. No white, system-background, or differently colored app-owned frame shall flash between launch and the destination. The Designer will specify the exact palette and optical alignment using the existing brand assets.

### Readiness and exit

> **FR-07** — The splash shall leave when the first destination is ready to use: the first-run welcome when that decision applies, or the app shell with the correct selected tab and its normal ready, setup, loading, or error state. It shall not wait for tab data, a network result, a map, or an idle-prefetched feature once navigation is usable.

> **FR-08** — The splash shall impose no minimum display time. If the destination is ready quickly, it shall appear on the next available paint rather than waiting for the glyph to be noticed; any optional exit effect shall not delay interaction.

> **FR-09** — The transition shall not expose a provisional tab before first-run welcome or saved-tab selection is resolved. A cold start from a widget link shall still reach its requested destination; a widget link received while SnowRaven is already open shall not trigger the splash.

### Slow starts and failures

> **FR-10** — If the app-owned splash is still the only visible screen two seconds after it first appears, it shall add the visible status “Opening SnowRaven…” while keeping the glyph and green field. This status shall not delay a ready destination.

> **FR-11** — If the app-owned splash has not handed off after 15 seconds, it shall show “SnowRaven is taking longer than expected” and a Reload action. It shall remain able to hand off automatically if startup finishes later; elapsed time alone shall not be described as a failure.

> **FR-12** — A known startup failure shall replace the splash on the next available paint with SnowRaven's existing actionable error experience, or an equivalent reload action when the interactive app cannot render. An error shall not be covered by the decorative field, and the user shall not need to wait for the slow-start threshold after a failure is known.

### Session boundaries

> **FR-13** — The launch splash shall not reappear for tab switches, file imports, background refreshes, normal in-app loading, or widget navigation within an already open app session.

## Non-Functional Requirements

> **NFR-01 — Performance:** The splash itself shall initiate no additional network request, data-file read, telemetry, or extra startup work beyond rendering its bundled art and managing the handoff. Its display shall never be used as a timing gate.

> **NFR-02 — Accessibility:** The glyph shall be decorative to assistive technology. The app-owned opening shall expose one meaningful loading status, update that status on a slow start, and remove it when the destination or error appears. The splash shall not take keyboard focus or block access to the resulting screen.

> **NFR-03 — Motion:** Any exit motion shall be brief and shall be removed for users who request reduced motion. No looping decorative animation is permitted.

> **NFR-04 — Compatibility:** The splash and its fallback shall work without a network connection and at 320px viewport width and 200% in-app text scale, without clipping the mark, status, or Reload action.

> **NFR-05 — Privacy:** The launch shall collect or transmit no new information and shall leave existing provider, key, file, and first-run behavior intact.

## Out of Scope

- A new logo, app icon, illustrated scene, slogan, progress percentage, or looping animation.
- A splash for tab switches, imports, refreshes, warm widget navigation, or ordinary tab loading.
- Changes to data loading, saved-tab rules, welcome eligibility, error recovery, providers, or privacy behavior.
- Published website, README, or App Store listing language.

## Open Questions

- What slow-start status and recovery thresholds fit the measured startup path? **Default if not revised before Stage 5:** Show the status after 2 seconds and the longer-wait message with Reload after 15 seconds, as required in FR-10 and FR-11. The strategic brief delegates the exact timing to design and architecture; they should validate or revise these defaults before implementation.

The Designer will set exact visual values and the Architect will choose the handoff mechanics within these requirements. Neither decision needs a new user interview.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | New-load coverage (FR-01) | With app readiness deliberately slowed, a cold start or page load shows the splash on iPhone, iPad, Mac, Windows, and web/Pi; a full page reload shows it again. A fast load may bypass the app-owned splash. |
| QA-02 | Composition (FR-02) | The visible opening has only the small committed raven mark centered on a full green field, with no wordmark, percentage, or spinner. |
| QA-03 | Native handoff (FR-03) | A recorded iPhone and iPad cold launch shows matching native and app-owned field and glyph, with no blank frame or visible mark jump between them. |
| QA-04 | Earliest shared paint (FR-04) | With the interactive bundle deliberately slowed, the first frontend paint on Mac, Windows, and web/Pi is the branded splash rather than a blank or text-and-spinner frame. |
| QA-05 | Geometry (FR-05) | Phone/tablet rotation and iPad/desktop resize keep the field edge-to-edge and the small mark visibly centered, without clipping at safe areas. |
| QA-06 | Theme continuity (FR-06) | Light and dark cold-launch recordings contain no white, system-background, or differently colored app-owned intermediate frame. |
| QA-07 | Ready destination (FR-07) | Returning users see the navigable app shell and correct selected tab; new users see the welcome; an initially loading tab may show its own loading state without keeping the splash over it. |
| QA-08 | Fast start (FR-08) | When the destination is ready before two seconds, the splash leaves immediately on readiness and no fixed wait or exit animation delays interaction. |
| QA-09 | Selection and widget route (FR-09) | A saved-tab or first-run case shows no interim wrong tab; a cold widget launch reaches its target, and a warm widget tap causes no splash. |
| QA-10 | Slow-start status (FR-10) | With readiness held past two seconds, “Opening SnowRaven…” becomes visible; if readiness then arrives, the destination appears without waiting for another timer. |
| QA-11 | Long-start fallback (FR-11) | With readiness held past 15 seconds, the longer-wait message and working Reload action appear; a later successful startup still replaces them. |
| QA-12 | Failure visibility (FR-12) | A forced, detectable render or bootstrap failure reveals an actionable error or Reload on the next available paint, without leaving the glyph over it or waiting for 15 seconds. |
| QA-13 | Session-only scope (FR-13) | Tab changes, imports, background updates, ordinary tab loading, and a widget tap into a running session never mount the launch splash. |
| QA-14 | Startup cost and privacy (NFR-01, NFR-05) | A launch trace shows no splash-specific network call, data read, telemetry event, or delay added to app readiness. |
| QA-15 | Assistive technology (NFR-02) | In a real accessibility tree the glyph is absent and one loading status is present; a screen reader announces the initial and slow loading states without repeating them, then reaches the destination or error without splash focus trapping. |
| QA-16 | Reduced motion (NFR-03) | In a rendered reduced-motion launch, the exit has no animation and no looping decorative motion appears in either setting. |
| QA-17 | Offline and small viewports (NFR-04) | With provider internet unavailable but the local app or web/Pi host reachable, cold launch renders the mark and fallback; at 320px and 200% in-app text scale, the status and Reload action remain visible and operable. |

## TestFlight verification scope addendum — 2026-09-26

After reviewing the QA evidence, the user explicitly deferred the seven remaining checks for this **TestFlight-only closeout** and said the project usually relies on automated tests. This changes the sign-off scope, not the requirements or the results above. No App Store submission or agent access to a physical device is authorized by this addendum.

For this TestFlight closeout, the applicable acceptance rows are **QA-02, QA-03, QA-06, QA-08, QA-10, QA-11, QA-12, QA-13, QA-16, and QA-17**. The existing automated suite and recorded browser and local-simulator evidence are the basis for their results.

**QA-01, QA-04, QA-05, QA-07, QA-09, QA-14, and QA-15** remain **Partial and deferred**: cross-platform runtime coverage, native rotation and resize, additional destination states, installed-widget taps, a conclusive launch trace, and screen-reader behavior have not been fully verified. Their original pass conditions remain above for any future scope decision. Deferral does not turn them into passes or imply that the signed TestFlight build was observed launching.
