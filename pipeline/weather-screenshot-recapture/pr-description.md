## Weather screenshot recapture

### What this fixes

The website's Weather screenshot was a partial frame: Tide had finished, Weather still said `Looking up…`, and the published image contained no Weather output. Its 1080×1385 intrinsic dimensions also disagreed with the 1080×1327 dimensions declared in `website/index.html`.

The capture script had treated `Sunset`, `Tide`, or `Station` as interchangeable readiness signals, swallowed the readiness timeout, and logged a Weather capture failure without changing the command's successful exit status. Tide could therefore win the race and publish a plausible but incomplete frame.

### Implementation

`website/tools/weather-capture.mjs` now owns the fail-closed Weather capture contract. It polls the rendered Weather panel and accepts a frame only after both sides are present: a Weather result line (`Sunrise:` or `Sunset:`) and a Tide result line (`Tide:` or `Station:`). `Looking up…` and `Loading tide…` remain pending; missing-key, unavailable, offline, backend-down, generic-error, and invalid-checklist states fail immediately; a partial or loading frame that never completes throws a bounded timeout.

`capture.mjs` uses that contract before its settle/attribution pass and re-checks the final frame immediately before writing the PNG. The readiness error is no longer swallowed. A missing lookup button, missing panel bounds, timeout, terminal state, or other Weather capture exception is recorded as a required failure, and required failures set `process.exitCode` to 1 after Chromium closes. Other screenshot behavior is unchanged.

The confirmed complete raw frame was processed with the unchanged `process-img.mjs` Weather operation (`resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 86 })`). The regenerated `website/assets/shots/weather.webp` is 1080×2021, 74,508 bytes, and has SHA-256 `99eabd809b96a52da7be1ae807bcfc1d6c5afdef0cb414e919362034a4c1e664`, byte-identical to the known-good committed asset from `43d5593`. The Weather image markup now declares the same 1080×2021 intrinsic dimensions.

### Security remediation

The Auditor found installed `sharp` 0.35.3 covered by High-severity advisory GHSA-rgj7-g3m4-5g8c, fixed in 0.35.4. The direct website-tools dependency is now pinned to exactly 0.35.4 through the normal npm install workflow, with only its lockfile-resolved Sharp platform packages and libvips binaries moving to the matching patch line. Playwright and unrelated dependencies are unchanged.

Both `npm audit --omit=dev --json` and full `npm audit --json` now report zero vulnerabilities at every severity. The installed runtime, manifest, lockfile root, and locked Sharp package all report 0.35.4. Reprocessing the confirmed raw PNG with Sharp 0.35.4 produces the same 74,508-byte WebP, dimensions, and SHA-256 as the committed asset, byte-for-byte, so the remediation changes no published pixels or capture behavior.

### Guard coverage

The tools package now has an executable Node test instead of its placeholder failure. Nine focused tests cover:

- the Weather-and-Tide conjunction, including Weather-only and Tide-only controls;
- loading precedence even if old result markers are present;
- terminal missing-key and unavailable states;
- transition from loading through a partial Tide frame to complete output;
- a Tide-only timeout that cannot be accepted as success;
- final-frame rejection of loading and either partial result;
- required-capture failure propagation to exit code 1; and
- the actual `capture.mjs` wiring: an unswallowed awaited readiness call, the final recheck after cleanup and before screenshot, required-failure collection, mutually exclusive failure/success banners, and exit-status application; and
- actual WebP metadata and the scoped website figure agreeing on 1080×2021 while retaining the Weather-and-Tide alt claim.

Six discriminating mutations were exercised and reverted. The wiring guard failed when the final recheck was deleted, the readiness wait gained `.catch(() => {})`, required-failure collection was deleted, or the failure-banner condition was inverted so the success banner could print on failure. Replacing the completion conjunction with OR made four behavioral tests fail, and changing the required-failure exit code from 1 to 0 made the fail-closed test fail. The restored source passes all tests.

### Files

- `website/tools/capture.mjs` — requires complete Weather and Tide output, re-checks the final frame, and propagates Weather capture failure to the command status.
- `website/tools/weather-capture.mjs` — testable readiness, timeout, required-capture, and exit-status helpers.
- `website/tools/weather-capture.test.mjs` — focused behavioral, fail-closed, asset, and markup guards.
- `website/tools/package.json` — runs the focused Node test and pins Sharp 0.35.4.
- `website/tools/package-lock.json` — resolves Sharp and its platform/libvips packages to the patched line without unrelated dependency changes.
- `website/assets/shots/weather.webp` — restored complete 1080×2021 Weather-and-Tide frame.
- `website/index.html` — declares the asset's matching 1080×2021 intrinsic dimensions.

### Verification

- `npm test` in `website/tools`: 9/9 passing.
- Node syntax checks for the capture script, helper, and test: passing.
- Installed/manifest/locked Sharp: 0.35.4; runtime libvips: 8.18.6.
- `npm audit --omit=dev --json`: 0 vulnerabilities, including 0 High and 0 Critical.
- `npm audit --json`: 0 vulnerabilities, including 0 High and 0 Critical.
- A fresh Sharp 0.35.4 reprocess of `weather-light.png` is byte-identical to the committed WebP: 74,508 bytes, 1080×2021, SHA-256 `99eabd809b96a52da7be1ae807bcfc1d6c5afdef0cb414e919362034a4c1e664`.
- `npm run lint` in `frontend`: passing.
- `npm run build` in `frontend`: passing; 2,607 modules transformed, with only the existing large-chunk advisory.
- `npm run verify` in `website/tools`: 5/5 real-browser harnesses green across Chromium and WebKit.
- The first post-upgrade browser-gate run had one transient WebKit Statistics reading at 641px (`page +10px`) in the unrelated weather-row geometry harness. That harness passed immediately in isolation with its ordinary 0.02px worst reading, and a subsequent complete five-harness run passed cleanly; Sharp is not imported by the browser build or harness.
- Headless Chromium loaded the local website and reported declared dimensions 1080×2021, natural dimensions 1080×2021, `complete: true`, and the unchanged Weather-and-Tide alt text.
- Sharp metadata reports WebP 1080×2021; the SHA-256 matches the known-good historical asset exactly.
- Direct image inspection confirms the restored `Get weather` button, checklist header, complete Weather output including Sunrise and Sunset, complete Tide output including Tide and Station, and the combined-copy action. The partial `Looking up…` frame is gone.
- `git diff --check`: passing.

### Deliberately unchanged

Application source and runtime behavior, `process-img.mjs` parameters, other website screenshots, App Store capture and screenshots, README/help copy, Playwright and unrelated dependencies, backend, versions, changelog, release, and deployment files are unchanged. No live-key recapture or full cumulative test suite was required. This fix receives the shared Spool release stamp when the queue is flushed.
