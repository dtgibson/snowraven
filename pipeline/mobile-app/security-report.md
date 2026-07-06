# Security Review — Mobile App (iOS + iPadOS)

**Date:** 2026-07-05
**Feature:** mobile-app
**Stack:** react-vite + tauri v2 (iOS target added; python-fastapi backend untouched — zero backend changes verified)
**Checklist:** security-react-vite.md, extended with the Tauri capability/ACL and iOS App-Store-posture review items this platform target requires
**Outcome:** PASSED WITH NOTES (three informational/low findings, none blocking)

---

## Summary

Reviewed the full uncommitted mobile-app diff: the three-way capability split, the committed Xcode project under `src-tauri/gen/apple/`, `Info.ios.plist`, the Rust plugin partitioning, every new and modified JS surface, the supply-chain delta, and the privacy-label claims against observed code behavior. The prior QA sweep's credential and public-silence checks were independently re-verified, not trusted. The capability posture is genuinely least-privilege per platform, no secrets or team identifiers exist anywhere in the committed tree, and every privacy-label claim matches the code. Three notes are recorded below — the deliberate dormant `dialog:allow-open` grant (verdict: keep through TestFlight, remove before App Store submission), the standard iOS backup behavior for the sandboxed key file, and the pre-existing null CSP now shipping on a second platform. Nothing blocks deployment.

---

## Findings

### Dormant `dialog:allow-open` grant on iOS (Mechanism B fallback)

**Severity:** Low
**Location:** `src-tauri/capabilities/mobile.json` line 11; `src-tauri/Cargo.toml` mobile target block; `frontend/src/lib/iosImport.ts`
**Description:** Mechanism A (the plain `<input type="file">`, which WebKit renders as the native document picker) was user-verified in the simulator and is the ship path (`IOS_IMPORT_MECHANISM = 'input'`). The `dialog:allow-open` grant and `tauri-plugin-dialog` remain compiled and granted on iOS purely as insurance against device-vs-simulator divergence in the TestFlight rounds. Real risk, characterized honestly: `open()` can only *present* the native `UIDocumentPickerViewController` — script cannot pre-select a file; a path is returned only after an explicit user pick, and only that picked path enters the runtime fs scope (the static fs grants stay `$APPLOCALDATA/**` and do not widen). Exploiting it therefore requires arbitrary code execution inside the WebView first — at which point the attacker can already read `data/api-keys.json` through the legitimate `$APPLOCALDATA` grants, so the dialog grant's *marginal* added exposure is a user-mediated, one-file-per-pick read. All app JS is bundled at build time (no remote code), which makes the precondition itself remote. This is a deliberate, documented least-privilege deviation, not an oversight.
**Remediation (the Auditor's call):** **Keep it through the TestFlight phase** — the fallback insurance is worth more than the negligible marginal risk while device behavior is unconfirmed. **Removal trigger:** once Mechanism A is confirmed on physical hardware in the first TestFlight round, remove the `dialog:allow-open` grant from `mobile.json`, drop `tauri-plugin-dialog` from the mobile Cargo target (also removing the `rfd`/`nix` transitives from the iOS binary), and delete the Mechanism B branch — before the public App Store submission. Retaining it past that point requires a fresh logged decision.
**Status:** Accepted (documented in `pipeline/mobile-app/decisions.md` and the `mobile.json` description; removal trigger assigned to the TestFlight round)

### API keys ride device/iCloud backups by default on iOS

**Severity:** Informational
**Location:** `data/api-keys.json` under `AppLocalData` (iOS sandbox `Library/Application Support/com.snowraven`)
**Description:** The keys file is plaintext inside the app sandbox, same as desktop. On iOS the sandbox's Application Support directory is included in encrypted device/iCloud backups by default. This is standard iOS behavior for app data, the keys are the user's own usage-scoped, revocable eBird/OpenWeather keys, and the sandbox is otherwise inaccessible — the Files-app exposure keys (`UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`) are correctly omitted precisely to protect this file, and the system Keychain is banned by standing project convention (CLAUDE.md). The prepared Phase 2 privacy text already discloses the backup behavior honestly ("included in your device/iCloud backups under the iOS defaults"). Characterization: acceptable; no scaremongering warranted.
**Remediation:** None required. Keep the Phase 2 privacy-policy text in sync when published.
**Status:** Accepted

### Null CSP now ships on a second platform

**Severity:** Informational
**Location:** `src-tauri/tauri.conf.json` — `app.security.csp: null` (pre-existing, unchanged by this feature)
**Description:** Tauri injects no Content-Security-Policy, and the iOS WKWebView inherits that posture. This is not a regression — the setting predates this feature and the diff does not touch it — and the compensating controls are real: all JS is bundled at build time, the codebase's standing escaping discipline (JSX-only popups, shape-validated ids, `CommentText`, `escHtml`) holds in the new code, and this review found no new unescaped rendering. A CSP would be defense-in-depth against a future escaping mistake, and its value grows once the app is on the App Store where a shipped XSS costs a review cycle to fix.
**Remediation:** Consider defining a CSP as a hardening pass before the public App Store launch. Out of scope for this feature; flagged so it is a decision, not an accident.
**Status:** Accepted for this phase (hardening candidate, not a defect in the new code)

---

## Capability/ACL posture (the core assessment)

The split is correct and genuinely least-privilege:

- **`default.json` (all platforms):** core basics, `opener:default`, `http:default` + `http:allow-fetch` pinned to `https://**`, `clipboard-manager:allow-write-text` (write only, no read), `os:allow-platform`, and the nine `fs:*` grants all scoped `$APPLOCALDATA/**`. The diff moved updater/process OUT and added only `os:allow-platform`. On iOS, `$APPLOCALDATA` resolves inside the app sandbox — the WebView cannot reach any path outside `AppLocalData` through the static grants; the storage seam's boundary and the granted surface are identical. `os:allow-platform` exposes only the platform name (not hostname/version/arch) — the minimal grant backing `isIOS()`.
- **`desktop.json` (`macOS`/`windows`/`linux` only):** `updater:default`, `process:allow-restart`, `process:allow-exit`. Doubly absent on iOS: the capability excludes the platform AND the plugins are `#[cfg(desktop)]` / target-scoped in Cargo — `cargo tree` (per QA) confirms they are not in the iOS dependency graph. FR-14's "no self-update capability" holds at the binary level.
- **`mobile.json` (`iOS` only):** the three geolocation grants (`check-permissions`, `request-permissions`, `get-current-position` — notably NO `watch-position`, matching the when-in-use single-shot design) plus the dormant `dialog:allow-open` (Finding 1). Not granted on Android despite the Cargo cfg including it — tighter than it needs to be, which is the right direction.
- **Entitlements:** `snowraven_iOS.entitlements` is an empty dict — no app groups, no keychain sharing, no associated domains.

---

## Independent re-verifications (not taken from the QA report)

- **Credentials/team-ID sweep of the committed `gen/apple`:** `project.yml`, `project.pbxproj`, `ExportOptions.plist`, both Info.plists, the entitlements, and the scheme were searched for `DEVELOPMENT_TEAM`, provisioning identifiers, Apple IDs, keys, and tokens. Nothing found; `CODE_SIGN_IDENTITY = "iPhone Developer"` is the generic placeholder, `ExportOptions.plist` is `method: debugging` with no team key, and `tauri.conf.json` gained only `bundle.iOS.minimumSystemVersion` — no `developmentTeam` committed. Build products (`gen/apple/build/`, `Externals/` incl. `libapp.a`) are excluded by the init-dropped `.gitignore` — verified with `git check-ignore`; the committed set is source/config only.
- **Public silence:** README.md, PRIVACY_POLICY.md, ACCESSIBILITY.md, docs/HELP.md, website/, and CHANGELOG.md contain no SnowRaven-mobile/TestFlight/App-Store mention (all grep hits are pre-existing eBird-iOS references and the historical mobile-friendliness prep entries), and none of those files are in the diff. Mobile privacy text exists only in the pipeline package material.
- **Secrets in the diff:** a pattern sweep over every added line (keys, tokens, passwords, private-key blocks, team IDs) found nothing beyond the long-public updater minisign pubkey and lockfile integrity hashes.
- **No backend changes:** `git status` over `backend/` is empty; the transport seam and outbound destination set are byte-unchanged.

---

## Info.ios.plist and App Store posture

- `NSLocationWhenInUseUsageDescription` — "SnowRaven uses your location to center the map on your current position." Honest and accurate: the code does exactly this (one `getCurrentPosition` per explicit user tap, no watch, no background modes, no Always key). It is the ONLY usage-description key, in both `Info.ios.plist` and the generated/merged `gen/apple` Info.plists.
- `ITSAppUsesNonExemptEncryption = false` — correct. The app's only cryptography is standard TLS (HTTPS) via OS/platform libraries; no crypto dependency exists in `frontend/package.json` or the iOS Rust graph (minisign verification is desktop-updater-only and not compiled into the iOS binary; `keyring` is dead code using the OS credential store, exempt regardless).
- `UIFileSharingEnabled` / `LSSupportsOpeningDocumentsInPlace` — confirmed ABSENT from both plists, per the schema's rationale (the sandbox holds `data/api-keys.json`; import is picker-only).
- **ATS:** no `NSAppTransportSecurity` dict anywhere. Provider list spot-checked against `mapStyle.ts` and the service layer — eBird, OpenWeather, Nominatim, NOAA, OpenFreeMap, Esri, USGS, Waymarked Trails are all `https:`, and the capability layer independently pins fetch to `https://**`.

---

## New JS surfaces (injection review)

- `main.tsx` — adds the fixed literal class `sr-ios-app` synchronously; no data flows into it.
- `iosImport.ts` — dynamic imports only; the picked path is used for `readTextFile` and a `split('/').pop()` filename; the filename feeds the existing metadata path rendered as JSX text. No HTML strings, no hrefs.
- `location.ts` — the iOS branch maps plugin failures onto the existing `LocationError` codes via a local regex test; the raw plugin message is never rendered. `describeLocationError` returns fixed constant strings only — no user- or plugin-controlled interpolation into UI.
- `UpdateFooter.tsx` — verbatim extraction of the App.tsx footer; the only interpolations (`updateStatus.current`/`latest`) are pre-existing, JSX-escaped, and sourced from the signed desktop update flow that never runs on iOS (`showUpdaterFooter()` returns null there).
- `platformGates.ts`, `fileRowCopy.ts`, `mapFullscreen.ts` — pure predicates/constant-string helpers.
- `Settings.tsx` — both import mechanisms funnel through one `importFileContent` tail with the `.csv` extension guard intact; new status strings are constants. No `dangerouslySetInnerHTML`, no new `href` construction, no remote refs in the CSS additions anywhere in the diff.

---

## Privacy labels — claims vs. code

Every claim in `privacy-labels.md` was checked against observed behavior; none is contradicted:

| Claim | Verified against |
|---|---|
| No developer server / "Data Not Collected" | No backend ships on iOS; TauriTransport routes to on-device TS services; no telemetry/analytics/crash/account code or dependency exists in `package.json`, the lockfile delta, or the iOS Cargo graph |
| Keys local-only, per-provider | Storage seam writes `AppLocalData`; per-call auth at call sites (no shared headers) — unchanged by this diff |
| Location on-device, when-in-use, user-initiated | Grants (no watch-position), plist (no Always/background), code (single `getCurrentPosition` per tap); coordinates leave the device only as the user's own provider query parameters, identical to hand-typed coordinates |
| Imported CSVs never leave the device | `storage.writeFile` to the sandbox; no upload path exists |
| No new network destinations | Outbound set byte-identical to desktop; geolocation is an OS API, not a network service |

The label nuance flagged in the package (don't defensively declare Location collection) is correct under Apple's taxonomy and is carried forward to the Deployer.

---

## Supply chain delta

Three new npm dependencies, all official `@tauri-apps` plugins at the current latest published versions (registry-verified today, none yanked): `plugin-os` 2.3.2, `plugin-geolocation` 2.3.2, `plugin-dialog` 2.7.1 — each depending only on the already-present `@tauri-apps/api`. Cargo adds the three matching crates plus four unsurprising transitives (`nix` 0.31.3, `os_info` 3.15.0, `rfd` 0.16.0, `sys-locale` 0.3.2). Updater/process crates are target-excluded from mobile; geolocation/dialog are target-excluded from desktop. No other lockfile movement.

---

## Checks Performed

| Check | Result |
|---|---|
| No API keys, tokens, or secrets in any source file (full-diff + gen/apple sweep) | Pass |
| No `VITE_` variables added; none carry sensitive values | Pass |
| `.env` remains gitignored; no credentials in `vite.config.ts` or any committed config | Pass |
| No team IDs / signing credentials in committed `gen/apple` (pbxproj, project.yml, ExportOptions, plists, scheme) — independent re-verify | Pass |
| Build products under `gen/apple` excluded from the commit set (`git check-ignore` on `build/`, `Externals/`, `xcuserdata/`) | Pass |
| Capability split least-privilege: default (shared) / desktop / mobile, correct `platforms` scoping | Pass |
| fs grants confined to `$APPLOCALDATA/**` on every platform; no widening for iOS; static scope matches the storage seam | Pass |
| Updater/process desktop-only at BOTH layers (capability platforms + `#[cfg(desktop)]`/Cargo target scoping) | Pass |
| `os:allow-platform` scope minimal (platform name only) | Pass |
| Geolocation grants mobile-only, when-in-use semantics, no `watch-position` | Pass |
| Dormant `dialog:allow-open` grant assessed | Finding — see above (Low, Accepted, removal trigger set) |
| iOS entitlements empty (no app groups / keychain sharing / associated domains) | Pass |
| `Info.ios.plist`: location usage string honest; sole usage-description key | Pass |
| `ITSAppUsesNonExemptEncryption = false` correct (HTTPS-only, no custom crypto in the iOS binary) | Pass |
| `UIFileSharingEnabled` / `LSSupportsOpeningDocumentsInPlace` omitted (api-keys.json not Files-app exposed) | Pass |
| No ATS exceptions; provider list spot-checked all-HTTPS; `http:allow-fetch` pinned `https://**` | Pass |
| API keys at rest on iOS (sandbox + default backup inclusion) characterized | Finding — see above (Informational, Accepted) |
| CSP posture on the new platform | Finding — see above (Informational, pre-existing, Accepted) |
| `main.tsx` `.sr-ios-app` marker — no injection vector | Pass |
| `iosImport.ts` — dynamic-only plugin loads, no HTML/href construction, cancel = no-op | Pass |
| `location.ts` — plugin errors mapped to fixed strings; raw messages never rendered | Pass |
| `UpdateFooter.tsx` extraction — no new interpolation surfaces; renders null on iOS | Pass |
| `platformGates.ts` / `fileRowCopy.ts` / `mapFullscreen.ts` — pure constants/predicates | Pass |
| `Settings.tsx` import wiring — shared tail keeps `.csv` guard, storage-seam write, JSX-escaped display | Pass |
| No new `dangerouslySetInnerHTML` / `innerHTML` / `window.open` / raw `href` in the diff | Pass |
| No remote refs (`url()` / `@import` / http) in CSS additions | Pass |
| Error responses handled gracefully; no raw error details shown to users | Pass |
| No auth/accounts; keys via storage seam, never localStorage | Pass |
| Dependencies current: 3 official Tauri plugins at latest, unyanked; transitives inspected | Pass |
| Source maps not emitted to production (Vite default, unchanged) | Pass |
| No sensitive console logging added; `RUST_LOG` scheme var applies only to Xcode-launched dev runs | Pass |
| No dev-only code paths in the shipped bundle (dev-mode location guard stays desktop-dev-only) | Pass |
| Dev-server LAN exposure gated on opt-in `TAURI_DEV_HOST` (dev-only; default stays localhost) | Pass |
| Privacy-label claims verified against code (table above); no contradiction | Pass |
| Public surfaces silent on mobile (README, website, HELP, PRIVACY_POLICY, ACCESSIBILITY, CHANGELOG) — independent re-verify | Pass |
| Zero backend changes; outbound destination set unchanged; PRIVACY_POLICY "Map Tiles" disclosure unaffected | Pass |

---

## Convention Flags

- New plugin permissions must land in the narrowest capability file (`default`/`desktop`/`mobile` split by `platforms`), and any grant kept for a dormant fallback must carry a documented removal trigger — the `dialog:allow-open` pattern from this review is the template.
- `Info.ios.plist` is the single home for iOS plist keys: no new usage-description key may be added without the feature that needs it AND a matching privacy-label/policy update in the same change (mirrors the existing map-tile-provider disclosure rule).

---

## Deployer carry-forwards (TestFlight step)

1. The committed `ExportOptions.plist` is `method: debugging` (correct for the repo — nothing distribution-specific leaked); the TestFlight build must use the App-Store-Connect export method at build time (schema verify-item V5).
2. First TestFlight round: confirm Mechanism A (native picker from the file input) on physical hardware, then execute the Finding 1 removal trigger before the public App Store submission.
3. App Store Connect privacy questionnaire: answer per `privacy-labels.md` §1 ("Data Not Collected"); do NOT defensively declare Location collection.
4. Reviewer notes must include the synthetic demo CSVs and import steps (schema Risk 1) and the privacy blurb from `privacy-labels.md` §4.
5. `PRIVACY_POLICY.md` stays untouched until Phase 2 (App Store launch) per the phased-announcement decision; the prepared §3 additions ship then.
