# Bug Brief — iOS offline maps + app icon

Two unrelated iOS/iPadOS reports, diagnosed by code + build-config analysis
only (no iOS device/simulator on this machine). Issue 2 is a clean fixable
bug. Issue 1 is **mostly by-design**; its "make it work on iOS" half is
feature territory — see the verdict.

---

## Issue 1 — Offline maps on iOS  (VERDICT: by-design absence + FEATURE work)

### What is "broken"
Nothing is actually broken. Offline maps being absent on iOS is a deliberate,
recorded v1 scope decision. The Settings section is hidden by
`showOfflineMapsSection()` → `return !isIOS()`
(`frontend/src/lib/platformGates.ts:20-22`), gating the mount in
`Settings.tsx:1513`. This is the documented intent of FR-15 / FR-23 in
`pipeline/mobile-app/prd.md` (line 155 "Explicitly out of scope for v1: Tier B
offline map region downloads on iOS (desktop-only in v1)"), verified by QA-14 /
QA-22, and recorded in `DECISIONS.md` (offline-support v0.5.45: "Region
downloads are desktop-only (FR-20)"). So "no option in Settings on iOS" is
**correct current behavior**, not an accidental exclusion.

### Steps to reproduce (code-level, no device)
1. `platformGates.ts:20` — `showOfflineMapsSection()` returns `!isIOS()`; on
   iOS this is `false`, so the whole section never mounts (true absence — no
   header, no ghost).
2. `regionDownload.ts:176` gates the download on `!isTauri()` only (not iOS);
   iOS *is* Tauri, so the download fn itself is not the blocker — the UI gate is.
3. Fix-vs-feature line comes from the tile machinery: `srpm://` is registered
   in **JS** (`mapPmtiles.ts:118-125` via maplibre `addProtocol`), not Rust;
   `default.json` grants `http:allow-fetch https://**` + `fs:* $APPLOCALDATA/**`
   to **all** platforms incl. iOS. So the plumbing is not structurally blocked
   on iOS — but it has never been built, tested, or App-Review-vetted there.

### Expected behavior
This is a scope question, not a defect. Two separable outcomes:
- **(a) "Show the toggle" only** — trivial: flip `showOfflineMapsSection()` to
  also allow iOS. But this is ill-advised alone: it exposes a downloader that
  was never validated on iOS (see blast radius) — a hollow control.
- **(b) "Make offline maps actually work on iOS"** — the real ask, and it is
  **FEATURE work**, not a fix. New, untested surface on iOS: region storage in
  the iOS sandbox (hundreds of MB of `.pmtiles` under `$APPLOCALDATA`), the
  `srpm://` range-read path on WKWebView, iOS storage-quota / background-fetch
  behavior, an `mobile.json` capability review, and — critically — Apple App
  Review posture on large silent downloads + a "Download region" UX. It also
  reverses a logged v1 scope decision (FR-15/23), so it must go through the
  New Feature lane / Chronicler, not the Fix lane.

### FIX-vs-FEATURE verdict (the crux)
**FEATURE, with a trivial cosmetic sliver.** The reported "bug" (no option on
iOS) is intended v1 behavior. The `srpm`/PMTiles machinery is JS + cross-platform
capabilities (no Rust desktop-gate), so iOS is not structurally barred — but
enabling it for real is untested, unscoped, App-Review-sensitive work that
reverses a recorded decision. **The line:** un-hiding the toggle = a 1-line
config change; delivering working, reviewable offline maps on iOS = a feature.
Recommend routing to the **New Feature lane** and NOT shipping (a) alone.
Do not silently expand this fix into that work.

### Blast radius (if pursued as a feature)
- Reverses FR-15/FR-23 + the v0.5.45 desktop-only decision → `DECISIONS.md`
  + CLAUDE.md update, Chronicler log of the reversal.
- New iOS-sandbox storage behavior (`TauriStorage` region writes already run on
  iOS since it takes the Tauri path — untested there).
- `srpm://` range reads via `tauri-plugin-fs` on WKWebView (unproven).
- `mobile.json` capability review; possible new `PRIVACY_POLICY.md` egress note
  (the GitHub-Releases regions host is already disclosed, but the iOS surface is not).
- Apple App Review risk (large downloads / storage disclosure / consent UX).
- Web + desktop must stay byte-unchanged (PRD forbids their behavior shifting).

### What done looks like
- **Preferred:** Orchestrator routes Issue 1 to the New Feature lane as
  "Offline maps on iOS"; the Fix run does NOT touch it. Confirmed by: this
  brief's verdict accepted, and no `platformGates.ts` change made in this run.
- If instead a conscious decision is made to keep iOS desktop-only, "done" is a
  one-line confirmation that current behavior is correct and intended.

---

## Issue 2 — iOS app icon  (VERDICT: clean fixable BUG)

### What is broken
The iOS app bundles Tauri's **default template icon** (a teal-and-yellow
"8"/gyroscope logo), not the green "SR" icon. Confirmed by eye: the file Xcode
actually ships —
`src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` —
is the Tauri placeholder, while the correct **green SR** icon already exists,
unused, at `src-tauri/icons/ios/AppIcon-512@2x.png`. All 18 files in the shipped
appiconset are placeholders; a complete, filename-identical SR set sits in
`src-tauri/icons/ios/` and was simply never copied into the committed catalog.

### Steps to reproduce (code-level, no device)
1. View `src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
   → Tauri's teal/yellow "8" placeholder (121 KB). This is what iOS displays
   (`ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon` in the pbxproj).
2. View `src-tauri/icons/ios/AppIcon-512@2x.png` → the green "SR" icon
   (1024×1024, the true SR source). Also matches the desktop icon
   `src-tauri/icons/icon.png` (green SR, 512×512).
3. `md5`/size differ for every one of the 18 shared filenames → the catalog was
   populated with placeholders at `tauri ios init` and never regenerated.
4. Git: the placeholders were committed in `6268e39` (the iOS-target commit);
   the correct `icons/ios/` set predates it (`9d2fbf9`). The catalog under
   `gen/apple/` is committed (root `.gitignore` note: "gen/apple is COMMITTED"),
   so the fix must overwrite the tracked PNGs.

### Expected behavior
The iOS home-screen / App Store / TestFlight icon shows the green SR icon,
matching macOS + Windows.

### Blast radius
Minimal and self-contained. Only the 18 PNGs in
`gen/apple/Assets.xcassets/AppIcon.appiconset/` (and their `Contents.json` if
regenerated) change. No code, no desktop bundle, no web. `tauri.conf.json`'s
`bundle.icon` (desktop) is untouched — iOS icons come only from the committed
appiconset, not from that array.

### Fix approach
Two equivalent options (both are re-stamps of a generated-but-committed
artifact, exactly like the existing Info.plist version-stamp precedent):
- **Simplest:** copy the 18 SR PNGs from `src-tauri/icons/ios/` over the
  placeholders in `gen/apple/Assets.xcassets/AppIcon.appiconset/` (filenames are
  identical — a direct overwrite), commit them.
- **Canonical:** run `tauri icon` (e.g. `npx tauri icon src-tauri/icons/ios/AppIcon-512@2x.png`,
  the 1024² SR master) to regenerate the iOS appiconset from source, then commit.
Then rebuild via `tauri ios build` → TestFlight (Apple altool), NOT `release.sh`.
Since the appiconset is committed, make it durable — don't rely on re-running
init.

### What done looks like
- The committed `gen/apple/.../AppIcon.appiconset/` PNGs are the green SR icon
  (verify `AppIcon-512@2x.png` shows "SR", and its md5 == `icons/ios/AppIcon-512@2x.png`).
- A `tauri ios build` produces an app whose icon is the green SR (verifiable in
  the built `.app`'s asset catalog even without a device).

---

## iOS build/deploy implication (both issues)
Any iOS change ships via a **`tauri ios build` → TestFlight** rebuild (Apple
altool / Xcode), **not** `release.sh` (which is macOS + Windows desktop only).
Version-stamping the generated `Info.plist` is a hand-edit precedent already in
the repo (commit `bc4d26f`). The icon fix touches committed generated artifacts
under `gen/apple/` — same class of hand-managed generated state.
