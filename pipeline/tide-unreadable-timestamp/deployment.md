# Deployment Record — SnowRaven 1.0.32

**Date:** 2026-09-16
**Lane:** Fix (bundled Spool release, 5 builds)
**Deployer stage:** ship
**Production sign-off:** given by the user at the bundle gate, before this stage ran.

---

## What shipped

A bundled Spool release of five builds, landed on `main` as `520ebeb` and
released as **1.0.32**.

From `CHANGELOG.md` [1.0.32]:

**Changed**
- Settings opens on API Keys, with Default Files (and iCloud Sync) directly below.
- Sort controls on List Comparer, Multimedia and Species Detail announce the
  selected option to screen readers.

**Fixed**
- Current tide on the Mac, iPhone and iPad apps had been showing as unavailable
  instead of fetching the tide for where you are.
- Weather lookups refuse a malformed forecast instead of showing a made-up
  reading (`0°F` + fabricated "Clear sky" on web/Pi, `NaN°F` on Apple
  platforms), plus a high-latitude forecast failure and a single-bad-hour
  failure.
- An unreadable date and time is refused politely by both the tide and weather
  lookups.
- An unreadable tide timestamp drops that high or low from the reading instead
  of being treated as 1970 (the acceptance basis for this run —
  `bug-brief.md`).

---

## Pre-deploy state (verified, not inherited)

| Check | Result |
|---|---|
| The Tester | **PASSED** — `qa-report.md`, all 8 acceptance criteria Pass |
| The Auditor | **PASSED WITH NOTES** — `security-report.md`, **no Critical or High findings**; F1/F2 Open, F3 Accepted; deployment explicitly not blocked |
| Four-file version parity | `frontend/package.json` 1.0.32 · `src-tauri/tauri.conf.json` 1.0.32 · `CHANGELOG.md` [1.0.32] · `website/index.html` pill text + aria-label + footer — all confirmed by direct grep, not by the substring-check guard alone |
| Tag | `v1.0.32` = `ff9c20cfa71be41501b49fc38a2decec479a8793` |
| Windows CI | run `35119945371`, conclusion **success**, `headSha` `ff9c20cf` — **equal to the tag commit**, so the stale-run hazard is ruled out |
| Pipeline CI on tag commit | run `35119937900` on `ff9c20cf` — **success** (completed before the stamp push, so it was *not* cancelled this ship) |
| Keychain | `login.keychain-db` unlocked, `no-timeout` — no post-reboot signing block |
| Node | v24.18.0, matching `.nvmrc` = 24 |
| App Store reconciliation | `appstore-ledger.md` — no unaccounted gap; 1.0.31 `READY_FOR_SALE` confirms the version bump was the only available route |

**One correction made during this stage:** HEAD `3fdeafd` (the App Store ledger
commit) had **not** been pushed — `origin/main` was still at `ff9c20c`. It was
doc-only and `release.sh` builds the working tree, so it did not affect the
release; it was pushed together with the iOS stamp as `ed1c710`.

---

## macOS + Windows — `release.sh`

Run on Hephaestus, `rc=0`. Every step completed with no errors in 602 lines of
log. Steps, in order: iCloud profile OK (`8QKC3L2FKP.com.snowraven`, container
`iCloud.com.dtgibson.snowraven`) → root + frontend `npm ci` → frontend build →
universal Tauri build with the iCloud overlay → bundle version verified 1.0.32
→ iCloud entitlements and embedded profile verified on the `.app` → DMG styled
headlessly → final DMG signed → notarized (**Accepted**) → stapled ("The staple
and validate action worked!") → Windows CI artifact fetched and signed locally
→ published.

Tauri's own `Warn skipping app notarization, no APPLE_ID & APPLE_PASSWORD…`
line is expected: `release.sh` notarizes and staples the styled DMG itself
afterwards, which is the whole point of the v1.0.28 post-styling-signature fix.

**Release:** https://github.com/dtgibson/snowraven/releases/tag/v1.0.32

### Independent verification (fresh download from GitHub, not release.sh's say-so)

Per the v1.0.28 rule, the DMG asset was downloaded fresh from the GitHub
release and checked. SHA-256 of the downloaded asset:
`d54dfc61eb66d25207284b1b4aca3dd41bcd742cf17957fb80a74213c54787c7`

All three Gatekeeper checks, verbatim:

```
codesign --verify --verbose=2
  SnowRaven_1.0.32_universal.dmg: valid on disk
  SnowRaven_1.0.32_universal.dmg: satisfies its Designated Requirement
  rc=0

xcrun stapler validate
  Processing: SnowRaven_1.0.32_universal.dmg
  The validate action worked!
  rc=0

spctl -a -t open --context context:primary-signature -vv
  SnowRaven_1.0.32_universal.dmg: accepted
  source=Notarized Developer ID
  origin=Developer ID Application: DAVID THOMAS GIBSON (8QKC3L2FKP)
  rc=0
```

The app bundle inside the mounted DMG independently passes too:
`codesign --verify --deep --strict` valid, and `spctl -a -t exec -vv` →
`accepted`, `source=Notarized Developer ID`.

### Release assets (all six present)

| Asset | Size |
|---|---|
| `SnowRaven_1.0.32_universal.dmg` | 30,808,963 |
| `SnowRaven-updater.app.tar.gz` | 30,472,010 |
| `SnowRaven-updater.app.tar.gz.sig` | 408 |
| `SnowRaven_1.0.32_x64-setup.exe` | 9,974,303 |
| `SnowRaven_1.0.32_x64-setup.exe.sig` | 420 |
| `latest.json` | 1,852 |

### `latest.json` architecture keys

```
version:  1.0.32
pub_date: 2026-09-16T16:24:57Z
platform keys: ['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64']
  darwin-aarch64  -> SnowRaven-updater.app.tar.gz
  darwin-x86_64   -> SnowRaven-updater.app.tar.gz
  windows-x86_64  -> SnowRaven_1.0.32_x64-setup.exe
```

- `darwin-x86_64` present and spelled correctly; the wrong `darwin-x64` key is
  **absent** (that spelling would silently break Intel updates forever).
- Both macOS keys map to the **same** universal bundle: same URL **and** same
  signature (byte-identical, `sha256(sig)[:12] = 887e661706bf` on both).

### Universal binary and iCloud payload in the shipped bundle

- `lipo -archs` → `x86_64 arm64` (genuinely universal).
- `Contents/embedded.provisionprofile` present, 13,356 bytes.
- Entitlements on the shipped bundle carry all three iCloud keys plus the
  container: `com.apple.developer.icloud-container-identifiers`,
  `com.apple.developer.icloud-services` (`CloudDocuments`),
  `com.apple.developer.ubiquity-container-identifiers`, all
  `iCloud.com.dtgibson.snowraven`, with `com.apple.application-identifier`
  `8QKC3L2FKP.com.snowraven` and `com.apple.developer.team-identifier`
  `8QKC3L2FKP`.

---

## Website

GitHub Pages run `35119937967` on `ff9c20cf` — **success**. Verified live at
https://snowraven.dtgibson.com/ by direct fetch, not by trusting the workflow:

```
<span class="version-pill" aria-label="Version 1.0.32">v1.0.32</span>
<p class="footer-version">SnowRaven v1.0.32 · Free &amp; open source</p>
```

All three website legs the four-file guard covers (pill text, aria-label,
footer) read 1.0.32 in production. Worth noting because the guard is a
whole-file `toContain` substring check and would go green on one correct string
with the others stale — these were confirmed individually.

---

## iOS — TestFlight

Prep, per the standing rules:

- `/tmp/xcshim` recreated **unconditionally** first (macOS had cleared it, as
  expected — both shims were gone).
- A stale archive was present, as it has been at every ship that looked: a
  **1.0.31 / build 1.0.31.2** archive. Moved aside to
  `snowraven_iOS-1.0.31.1-stale-b.xcarchive` **before** building, and the fresh
  archive confirmed by its stamped `CFBundleVersion`, not by its presence.
- Both credential sets exported: `APPLE_API_KEY_ID` / `APPLE_API_ISSUER_ID` for
  altool, and `APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_PATH` for
  the Tauri export step.

Build: `npx tauri ios build --export-method app-store-connect --build-number 1`
→ `** BUILD SUCCEEDED **`, fresh archive stamped **1.0.32 / 1.0.32.1**.

Tauri's own export then failed at profile qualification with
`Cloud signing permission error` plus three "profile doesn't include the iCloud
capability" lines — **expected and not chased**, exactly as at 1.0.28 and
1.0.29. Went straight to the manual export:

`xcodebuild -exportArchive` with the manual-signing options plist (manual
signing, `Apple Distribution`, team `8QKC3L2FKP`, profile
"SnowRaven iOS App Store iCloud 20260901", `iCloudContainerEnvironment`
`Production`) → `** EXPORT SUCCEEDED **`.

`DistributionSummary.plist` confirms the IPA carries the iCloud entitlements:

```
architectures = ['arm64']
certificate   = Apple Distribution, SHA1 1861F7A472C9D10C86D3BB55BC3A5B902AC7697B, expires 7/5/27
profile       = SnowRaven iOS App Store iCloud 20260901 (ce7036ac-…), expires 7/5/27
com.apple.developer.icloud-container-environment  = Production
com.apple.developer.icloud-container-identifiers  = ['iCloud.com.dtgibson.snowraven']
com.apple.developer.icloud-services               = ['CloudDocuments']
com.apple.developer.ubiquity-container-identifiers= ['iCloud.com.dtgibson.snowraven']
application-identifier = 8QKC3L2FKP.com.dtgibson.snowraven
```

`xcrun altool --validate-app` **before** the upload, per the standing rule:
`VERIFY SUCCEEDED with no errors`.

`xcrun altool --upload-app`: `UPLOAD SUCCEEDED with no errors`,
**Delivery UUID `f94ec2ed-6a50-4e93-9592-1d6623db930b`**, 15,190,369 bytes.

Stamp committed as `ed1c710` `chore(ios): stamp iOS 1.0.32 build 1` and pushed
with the ledger commit.

---

## Route decision for the App Store (recorded, not assumed)

ASC was queried live at this ship. **1.0.31 is `READY_FOR_SALE`**, so its train
is closed to every new build, TestFlight included (altool 90186 + 90062) —
there was no TestFlight-only path against it, and the full version bump this
ship carries was the only available route. Checked *before* building the
archive, per the skill.

Version records at the ship (newest first): 1.0.31, 1.0.30, 1.0.28, 1.0.27,
1.0.24, 1.0.23, 1.0.21, 1.0.19, 1.0.17, 1.0.14, 1.0.13, 1.0.4 — all
`READY_FOR_SALE`. Every version in this window holding a VALID build without a
record of its own is accounted for in writing in `appstore-ledger.md` (1.0.29,
1.0.26, 1.0.22, 1.0.20 rollups; 1.0.25 deferred). **No new skip from this
ship**, and nothing new to add to the CLAUDE.md list.

**1.0.32 owes its own version record and submission.** That is outstanding —
see below.

---

## STOPPED BEFORE SUBMISSION — deliberately

Per the v1.0.31 post-mortem, the uploaded build must be installed on a **real
device** and opened before anything is submitted. 1.0.31.1 was submitted having
never run on hardware and crashed on launch every time; the release-only tao
use-after-free behind it was invisible to the full green suite, both CI jobs,
the iOS 27 simulator and `--validate-app` (which checks icons and entitlements,
not whether the app runs). That submission then had to be withdrawn to
`DEVELOPER_REJECTED` before Apple could approve it, because an approval would
have auto-released a crashing app to every user.

The vendored tao patch (`src-tauri/vendor/tao`, tauri-apps/tao#1245) is present
and compiled into this build — it appeared in the release build log — so the
1.0.31 crash cause is fixed here. **That is a reason to expect the launch to
work, not evidence that it does.** The device install is the only check that
covers it, and it is the user's action.

No version record was created and nothing was submitted.

---

## CI on the stamp commit went RED — diagnosed, NOT worked around

The pipeline run on `ed1c710` (run `35122333111`) came back **failure**, and so
did a re-run of it. Backend green both times; Frontend failed both times —
**but on a DIFFERENT test each time**, which is the whole story.

| Run | `weatherStatsShared.test.ts` | `MapExplorerLocateFab.test.tsx` |
|---|---|---|
| Tag commit `ff9c20cf` — **the tree that shipped** | ✓ passed, 4,696 ms | ✓ passed, 6,452 ms |
| `ed1c710` first attempt | **FAILED — timed out in 5000ms** | ✓ passed |
| `ed1c710` re-run | ✓ passed, 4,654 ms (the timing test itself 4,566 ms) | **FAILED** |
| Locally, quiet machine | ✓ 24/24, file 2.87 s | ✓ 19/19, file 3.98 s |

Two independent, load-sensitive tests, each failing on a different run of the
same commit, both green on the shipped tree and both green locally. That
pattern is the signature of CI-runner contention, not of a defect.

### The failures

**1. `weatherStatsShared.test.ts` — "grows about 2x per doubling on hostile
input built to FAIL after consuming the run"**, `Error: Test timed out in
5000ms` at `weatherStatsShared.test.ts:340:3`.

`frontend/vite.config.ts` sets no `testTimeout`, so this inherits vitest's
**5,000 ms default**, and the test passes no per-test timeout of its own. It is
deliberately built to consume the entire run with no short-circuit, at three
sizes (10k / 20k / 40k rows x 5 iterations, ~440 chars per row). On CI it lands
at 4,566-4,696 ms — roughly **7% under the limit**. Local is 2,661 ms, so CI
hardware is ~1.75x slower and the margin is gone.

Its own comment shows the authors reasoned carefully about **ratio** noise (the
3x bound is explicitly loosened citing the recorded 2.79 incident). What was
never reasoned about is the **absolute** wall-clock budget against the default
timeout.

**2. `MapExplorerLocateFab.test.tsx` — "the failure message > replaces the
message node across two identical failures (QA-19)"**,
`AssertionError: expected '' to be 'Location request timed out. Try again or
enter coordinates manually.'`

Reading the live region as empty is the exact shape `.claude/rules/testing.md`
describes at v1.0.25: an async test that asserts on an **effect-owned
announcement** before the effect has flushed. Under a contended runner the
commit has not landed when the assertion reads the node.

**That rule also names the wrong fix**: "Do not replace the missing readiness
condition with a sleep, timeout increase, or weaker assertion." This one needs
to await the exact downstream observable its assertion consumes — not a longer
timeout. (The `weatherStatsShared` one is the opposite case: its assertion is
the *ratio*, so an explicit longer timeout does not weaken the guard at all.)

### Why the release is unaffected

`release.sh` built the working tree at `3fdeafd`, and the iOS archive was built
from that same tree. The diff from the green-CI tag commit to the red one is,
in full:

```
ff9c20cf -> 3fdeafd : pipeline/tide-unreadable-timestamp/appstore-ledger.md  (+37)
3fdeafd  -> ed1c710 : src-tauri/gen/apple/snowraven_iOS/Info.plist           (2 version lines)
```

Nothing under `frontend/`, `backend/`, `src-tauri/src/` or `Cargo*` changed
between the green run and the red ones. **The shipped code is exactly the code
that passed CI on the tag commit**, where both of these tests were green.

### Deliberately not fixed here

Both fixes are test-only changes and would qualify for CLAUDE.md's dev-only
exemption (no version bump, changelog entry, tag or release). But changing a
guard test's budget, and repairing an async readiness condition, are decisions
that belong to an Engineer pass with the rules read — not deploy-stage
improvisation. Handed back rather than worked around.

**`main` is RED and will stay flaky until both are addressed.** CLAUDE.md
records 1.0.14 shipping with the suite red on `main` for five commits, so this
is named here rather than left to be found. Note this red is **pre-existing to
both of my commits** — it is a property of these two tests on CI hardware, not
of anything this ship introduced.

## Outstanding for the user

1. **Install TestFlight build 1.0.32 (1.0.32.1) on a real device and open it.**
   Blocking precondition for the submission.
2. **Then submit to the App Store**: create the 1.0.32 version record, select
   build 1.0.32.1, confirm metadata against `appstore/LISTING.md`, answer the
   age-rating social-media declaration (only editable once the version record
   exists), paste `appstore/REVIEW_NOTES.md` verbatim, and submit. Release
   immediately on approval, no phased rollout.
3. **iCloud Sync** can only be truly verified on the user's own devices —
   Hephaestus is not signed into iCloud, so local checks stopped at
   entitlements (which are confirmed present and correct on both the macOS
   bundle and the iOS IPA).
4. **Decide what to do about the two flaky CI tests** (section above). Both
   are green locally and both were green on the shipped tree, so neither blocks
   1.0.32 — but `main` is red and will keep flapping.
   - `weatherStatsShared.test.ts`: give that one test an explicit timeout, or
     lower its row counts. Its assertion is the *ratio*, so a longer timeout
     does not weaken the guard.
   - `MapExplorerLocateFab.test.tsx`: needs the missing readiness condition —
     await the effect-owned announcement the assertion consumes. Per
     `.claude/rules/testing.md` (v1.0.25), explicitly **not** a sleep, a
     timeout increase, or a weaker assertion.

   Both are test-only changes: no version bump, changelog entry, tag or
   release, per the dev-only exemption in CLAUDE.md.
