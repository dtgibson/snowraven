# PRD — Windows Desktop App
**Feature:** windows-desktop-app
**Date:** 2026-05-28
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
Ship a native Windows build of the SnowRaven Tauri app at full feature parity with the web/Pi and macOS clients, built and released automatically by GitHub Actions, distributed unsigned with a working in-app updater. "Use my location" is gracefully degraded on Windows and marked as coming later.

## User Stories

> **US-01** — As a Windows-using birder, I want to download and run SnowRaven as a standalone desktop app, so that I get the same no-server experience Mac users have.

> **US-02** — As a Windows user, I want every tab and feature to work exactly as it does on macOS, so that the platform I'm on doesn't limit what I can do.

> **US-03** — As a Windows user, I want my API keys, settings, and uploaded data files to persist across relaunches, so that I set up once and it just works.

> **US-04** — As a Windows user, I want the app to detect and install updates from within the app, so that I stay current without re-downloading manually.

> **US-05** — As a Windows user, I want "Use my location" to clearly tell me it's not available yet (rather than silently fail), and I want to still set my location by address or coordinates.

> **US-06** — As the maintainer, I want Windows builds to be produced and published automatically by CI alongside the macOS release, so that I don't need a Windows machine to ship.

## Functional Requirements

**Build & release (CI builds, local assembly — Option A)**
> **FR-01** — A GitHub Actions workflow shall build the Tauri Windows app on a `windows-latest` runner, producing the Windows installer and the (unsigned) updater archive.
> **FR-02** — The CI build shall NOT have access to the signing key. The Windows updater archive shall be signed locally during `release.sh` with the project's existing Tauri minisign key (the same key whose public half is in `tauri.conf.json`). The private key and its password shall never be uploaded to GitHub or exposed to CI — they stay on the maintainer's machine, consistent with how the macOS/Apple credentials are handled.
> **FR-03** — CI shall make the built Windows artifacts retrievable by the local release step (e.g. as workflow artifacts or a draft prerelease) so `release.sh` can fetch them; CI shall not publish the final public release itself.
> **FR-04** — `release.sh` shall be the single assembler of the release: it builds and signs macOS as today, fetches the CI-built Windows artifacts, signs the Windows updater archive locally, writes ONE `latest.json` containing both the macOS and Windows entries, and publishes all artifacts to a single GitHub release. Because one script owns the manifest, the platform entries cannot clobber each other.
> **FR-05** — The Windows build shall be reproducible from a clean checkout via the workflow with no manual local steps on Windows.

**Application parity**
> **FR-06** — The Windows app shall run fully standalone (no Python backend): all API calls route through the Tauri transport seam to the TypeScript services, as on macOS.
> **FR-07** — All tabs and features shall function on Windows: weather lookup, species detail, statistics, map explorer, breeding codes, life list comparer, settings, and in-app help.
> **FR-08** — API keys, settings, and uploaded data files shall persist in the Windows app-data directory (`AppLocalData`) via the storage seam and survive relaunch.
> **FR-09** — The in-app update check shall work on Windows: the app detects an available version from `latest.json`, downloads, installs, and relaunches into the new version.

**Geolocation degradation**
> **FR-10** — On Windows, "Use my location" shall not attempt the macOS-only native call. It shall present a clear, non-error indication that location detection is not available on Windows yet.
> **FR-11** — On Windows, address search, manual latitude/longitude entry, and saved default location shall all remain fully functional for setting the map location.

**Distribution**
> **FR-12** — The app shall be distributed unsigned (no Authenticode). User-facing documentation shall describe the one-time Windows SmartScreen "unknown publisher" click-through.

## Non-Functional Requirements

> **NFR-01 — Parity by shared code:** Windows behavior shall come from the existing cross-platform frontend and the transport/storage/platform seams. Platform-specific branches shall use the existing platform detection, not scattered ad-hoc OS checks.

> **NFR-02 — Mobile-forward:** No change shall introduce a desktop-only assumption that would block the future mobile client from reusing the shared core. Geolocation degradation shall be structured so a real Windows (and later mobile) implementation can slot in behind the same seam.

> **NFR-03 — Updater integrity:** Windows updates shall be verified by the existing Tauri minisign public key. Lack of Authenticode signing shall not weaken update verification.

> **NFR-04 — No macOS regression:** Adding Windows builds shall not break the existing macOS local build/release (`release.sh`) or its `latest.json` entry.

> **NFR-05 — Secrets hygiene:** The minisign signing key and password shall never reach GitHub or CI — they remain local to the maintainer's machine (Option A). CI uses only the auto-provided `GITHUB_TOKEN`. No key or token shall appear in the repo or build logs.

> **NFR-06 — Theming/UX consistency:** Any new UI (e.g. the geolocation "coming later" note) shall use `var(--sr-*)` tokens and read correctly in light and dark.

## Out of Scope
- Windows code signing / Authenticode (later add-on).
- Native Windows geolocation (deferred until worth the hands-on Windows testing).
- The mobile app (separate roadmap item).
- Any new user-facing features beyond parity and the geolocation notice.
- Windows on ARM (see Open Questions; default is x64 only).

## Open Questions
- **Installer format.** Tauri can emit NSIS (`.exe`) and/or MSI on Windows. *Default if unresolved by Stage 5:* NSIS, which the Tauri updater supports cleanly; MSI optional/skipped.
- **Architecture.** *Default if unresolved by Stage 5:* x64 only (`windows-x86_64`); Windows-on-ARM deferred.
- **CI trigger & artifact handoff.** How CI is triggered (tag push vs. manual dispatch) and exactly how `release.sh` retrieves the CI-built Windows artifacts (workflow artifacts via `gh run download` vs. a draft prerelease via `gh release download`). *Default if unresolved by Stage 5:* The Architect chooses; FR-03/FR-04 stand regardless of mechanism.
- **Resolved (was open): signing-key-in-CI is no longer needed.** Option A keeps the key local; CI never signs. No GitHub secret for the signing key is required.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | CI builds Windows (FR-01, FR-05) | A `windows-latest` workflow run produces an installer + updater artifacts from a clean checkout |
| QA-02 | Updater artifact signed locally (FR-02, NFR-03) | The Windows updater archive, signed during `release.sh`, has a valid signature that verifies against the `tauri.conf.json` pubkey; the key never appears in CI |
| QA-03 | CI artifacts retrievable + published (FR-03, FR-04) | CI exposes the Windows build for local retrieval; the final GitHub release (published by `release.sh`) contains the Windows installer + signed updater files |
| QA-04 | Combined latest.json from release.sh (FR-04, NFR-04) | The release `latest.json`, written by `release.sh`, contains both a macOS entry and a Windows entry; neither overwrites the other |
| QA-05 | Standalone runtime (FR-06, FR-07) | On Windows, every tab/feature works with no Python backend running |
| QA-06 | Persistence (FR-08) | On Windows, keys/settings/data files persist across a relaunch |
| QA-07 | In-app update (FR-09) | On a real Windows machine, an older build detects, installs, and relaunches into the newer version |
| QA-08 | Geolocation degraded (FR-10) | On Windows, "Use my location" shows the not-available-yet notice and does not error |
| QA-09 | Location fallbacks (FR-11) | On Windows, address search, manual lat/lng, and default location all set the map location |
| QA-10 | Unsigned documented (FR-12) | Docs describe the SmartScreen click-through |
| QA-11 | No macOS regression (NFR-04) | The macOS `release.sh` flow and its `latest.json` entry still work unchanged |
| QA-12 | Secrets hygiene (NFR-05) | The signing key never reaches CI/GitHub; no key or token appears in the repo, CI config, or build logs |
| QA-13 | Theming (NFR-06) | The geolocation notice uses `var(--sr-*)` tokens; correct in light and dark |

**Verification note:** QA-01–QA-04 and QA-11–QA-13 are verifiable from CI output, the published release, and the repo. QA-05–QA-09 that require real Windows runtime are confirmed by a single smoke test on the available Windows 11 machine; everything else relies on CI and shared cross-platform logic.
