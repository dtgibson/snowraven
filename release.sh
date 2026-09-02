#!/usr/bin/env bash
# release.sh — build, sign, notarize, and publish SnowRaven for macOS
#
# Run this after pushing a version bump and CHANGELOG update.
# Credentials stay local — nothing is stored in GitHub.
#
# The Mac is the macOS BUILD machine, not "signing only": a notarized macOS app
# can only be compiled, codesigned, and notarized on macOS (xcrun/notarytool are
# macOS-only). This script is self-healing — it installs BOTH the root and
# frontend dependencies itself and preflights tools/Node/network before the slow
# build — so the Mac's whole job is, once on the pinned Node (see .nvmrc):
#     zsh -lc ./release.sh
#
# iCloud Sync (v1.0.11) adds one release-time input: the Developer ID
# provisioning profile that authorizes the app's iCloud entitlements, at
#   ~/.tauri/snowraven-developerid.provisionprofile
# (never in the repo). The build applies src-tauri/tauri.icloud.conf.json,
# which pairs src-tauri/entitlements.icloud.plist with that profile embedded at
# Contents/embedded.provisionprofile, and the post-build check refuses to
# publish a bundle missing either. Portal prerequisites (one-time, human): the
# explicit macOS App ID com.snowraven, the iCloud container
# iCloud.com.dtgibson.snowraven assigned to both App IDs, and a "Developer ID
# Application" profile for com.snowraven with iCloud. Details: the
# snowraven-release skill and pipeline/icloud-sync/schema.md.
#
# Required env vars (live in the Mac login profile, which is why it's run as
# `zsh -lc ./release.sh` so they're sourced):
#   APPLE_SIGNING_IDENTITY  your Developer ID Application cert name, e.g.:
#                           "Developer ID Application: Dave Gibson (TEAMID)"
#                           Find it: security find-identity -v -p codesigning | grep "Developer ID Application"
#   APPLE_API_KEY_PATH      path to your .p8 key file from App Store Connect
#   APPLE_API_KEY_ID        10-character Key ID from App Store Connect
#   APPLE_API_ISSUER_ID     Issuer ID UUID from App Store Connect
#
# Optional env toggles:
#   CHECK_ONLY=1                  run preflight + dependency install, then STOP before
#                                 the macOS build (dry-run the portable half on the VM/CI).
#   SKIP_NPM_INSTALL=1            reuse the existing node_modules (fast re-runs).
#   ALLOW_DIRTY=1                 permit a dirty working tree.
#   ALLOW_NODE_MISMATCH=1         permit a Node version other than .nvmrc's.
#   ALLOW_NPM_INSTALL_FALLBACK=1  if `npm ci` fails, fall back to `npm install` (last resort; can drift from the lockfile).
#   SKIP_WINDOWS=1                publish a macOS-only release (Windows users will NOT get this update — emergencies only).
#
# Example:
#   export APPLE_SIGNING_IDENTITY="Developer ID Application: Dave Gibson (XXXXXXXXXX)"
#   export APPLE_API_KEY_PATH=~/AuthKey_XXXXXXXXXX.p8
#   export APPLE_API_KEY_ID=XXXXXXXXXX
#   export APPLE_API_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   zsh -lc ./release.sh

set -euo pipefail

# ── Helpers + run modes ─────────────────────────────────────────────────────────
CHECK_ONLY="${CHECK_ONLY:-0}"

die()  { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "warning: $*" >&2; }
need() { command -v "$1" >/dev/null 2>&1 || die "required tool '$1' not found on PATH — $2"; }

# `node` is needed immediately below to read the version out of tauri.conf.json.
need node "install Node and select the pinned version: 'nvm install \$(cat .nvmrc) && nvm use \$(cat .nvmrc)'."

# ── Config ────────────────────────────────────────────────────────────────────

REPO="dtgibson/snowraven"
SIGNING_KEY="$HOME/.tauri/snowraven-signing.key"

VERSION=$(node -e "console.log(require('./src-tauri/tauri.conf.json').version)")
TAG="v$VERSION"

# macOS ships a single UNIVERSAL binary (Apple Silicon + Intel). Tauri lipos the
# two arch builds into one .app, so one DMG and one updater bundle serve both
# architectures. latest.json maps BOTH darwin-aarch64 and darwin-x86_64 at that
# one bundle (see the platform JSON below) — Tauri's updater_arch() reports
# "aarch64" on Apple Silicon and "x86_64" on Intel, so both keys are required.
MAC_TARGET="universal-apple-darwin"

# iCloud Sync (v1.0.11): the release-time overlay pairs the iCloud entitlements
# with the embedded Developer ID provisioning profile. The profile lives
# outside the repo; the build reads a gitignored copy inside src-tauri/ (the
# overlay's `files` source path is relative to src-tauri/), removed afterwards.
ICLOUD_PROFILE="$HOME/.tauri/snowraven-developerid.provisionprofile"
ICLOUD_CONTAINER="iCloud.com.dtgibson.snowraven"
ICLOUD_OVERLAY="src-tauri/tauri.icloud.conf.json"
ICLOUD_ENTITLEMENTS="src-tauri/entitlements.icloud.plist"
ICLOUD_PROFILE_COPY="src-tauri/embedded.provisionprofile"
# The decoded profile (a mktemp path, set by the preflight) and the profile
# copy inside src-tauri/ are both removed on every exit path.
PROFILE_PLIST=""
cleanup_release_temps() {
  rm -f "$ICLOUD_PROFILE_COPY"
  [[ -n "${PROFILE_PLIST:-}" ]] && rm -f "$PROFILE_PLIST"
  return 0
}
trap cleanup_release_temps EXIT

# Build outside iCloud Drive to avoid extended-attribute interference with codesign.
export CARGO_TARGET_DIR="$HOME/.snowraven-build"
# An explicit --target makes Tauri nest the bundle under the target triple, and
# the universal DMG is named with the "universal" arch suffix.
BUNDLE_DIR="$CARGO_TARGET_DIR/$MAC_TARGET/release/bundle"
DMG="$BUNDLE_DIR/dmg/SnowRaven_${VERSION}_universal.dmg"
APP_TAR="$BUNDLE_DIR/macos/SnowRaven.app.tar.gz"
APP_SIG="${APP_TAR}.sig"

# ── Preflight checks ──────────────────────────────────────────────────────────
# Fast, loud, and BEFORE the slow build: every failure names the exact remedy.

# Required tooling (portable — needed on every platform).
need npm  "comes with Node; reinstall Node if missing."
need npx  "comes with npm; reinstall Node if missing."
need git  "install git."
need curl "install curl (used for the network reachability checks)."
need gh   "install the GitHub CLI: https://cli.github.com"

# Node must match the version this project is pinned to (.nvmrc). A bleeding-edge /
# non-LTS Node (e.g. 25) crashes `npm ci` with npm's 'Exit handler never called!'
# bug (npm/cli#8766) — the reason a release can fail on the Mac while the build VM
# (Node 24) and Windows CI (Node 20) succeed on the identical lockfile.
if [[ -f .nvmrc ]]; then
  WANT_NODE_MAJOR=$(tr -dc '0-9.' < .nvmrc | cut -d. -f1)
  HAVE_NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  if [[ -n "$WANT_NODE_MAJOR" && "$HAVE_NODE_MAJOR" != "$WANT_NODE_MAJOR" && "${ALLOW_NODE_MISMATCH:-0}" != "1" ]]; then
    die "Node $(node -v) is not the pinned version (.nvmrc = $WANT_NODE_MAJOR). Run: nvm install $WANT_NODE_MAJOR && nvm use $WANT_NODE_MAJOR  (or set ALLOW_NODE_MISMATCH=1 to override)."
  fi
fi

# GitHub auth — needed to fetch the Windows artifact and publish the release.
if [[ "$CHECK_ONLY" != "1" ]]; then
  gh auth status >/dev/null 2>&1 || die "GitHub CLI is not authenticated — run: gh auth login"
fi

# Working tree must be clean (the build keys off the checked-out commit).
DIRTY=$(git status --porcelain 2>/dev/null || true)
if [[ -n "$DIRTY" && "${ALLOW_DIRTY:-0}" != "1" ]]; then
  echo "$DIRTY" >&2
  die "working tree is not clean (files above). Commit/stash them, or re-run with ALLOW_DIRTY=1."
fi

# Informational: where HEAD sits relative to the tag (the real version gate is the
# CFBundleShortVersionString check after the build, not the git ref).
if git rev-parse -q --verify "$TAG^{commit}" >/dev/null 2>&1; then
  echo "==> Releasing $TAG: tag=$(git rev-parse --short "$TAG^{commit}") HEAD=$(git rev-parse --short HEAD)"
else
  warn "tag $TAG not found locally — the version is taken from tauri.conf.json, not the tag."
fi

# Apple signing / notarization credentials + macOS build toolchain. These live
# only on the Mac, so they're skipped under CHECK_ONLY to let the portable half be
# dry-run on the VM/CI.
if [[ "$CHECK_ONLY" == "1" ]]; then
  warn "CHECK_ONLY=1 — skipping Apple-cred / signing-key / Rust-target checks (macOS-only)."
else
  for var in APPLE_SIGNING_IDENTITY APPLE_API_KEY_PATH APPLE_API_KEY_ID APPLE_API_ISSUER_ID; do
    [[ -n "${!var:-}" ]] || die "$var is not set. Run via 'zsh -lc ./release.sh' so the login profile is sourced. See the usage comment at the top."
  done

  [[ -f "$APPLE_API_KEY_PATH" ]] || die "APPLE_API_KEY_PATH ($APPLE_API_KEY_PATH) does not exist."
  [[ -f "$SIGNING_KEY" ]] || die "Tauri signing key not found at $SIGNING_KEY"

  need rustup "install Rust: https://rustup.rs"
  need cargo  "install Rust: https://rustup.rs"
  need xcrun  "install the Xcode command-line tools: xcode-select --install"

  # The universal macOS build cross-compiles both arches, so both Rust targets
  # must be installed locally (the Apple Silicon machine has aarch64 by default,
  # but x86_64 is added explicitly).
  for tgt in aarch64-apple-darwin x86_64-apple-darwin; do
    rustup target list --installed 2>/dev/null | grep -qx "$tgt" \
      || die "Rust target '$tgt' is not installed (required for the universal build). Install it with: rustup target add $tgt"
  done

  # iCloud Sync: the Developer ID provisioning profile must exist, decode, name
  # this app and the container, and not have expired (it expires with the
  # Developer ID certificate; regenerate it in the portal and re-download).
  need plutil "part of macOS; the profile check decodes a plist."
  [[ -x /usr/libexec/PlistBuddy ]] || die "/usr/libexec/PlistBuddy is missing (part of macOS); the profile check reads dotted entitlement keys with it."
  [[ -f "$ICLOUD_OVERLAY" ]]      || die "iCloud overlay $ICLOUD_OVERLAY is missing from the checkout."
  [[ -f "$ICLOUD_ENTITLEMENTS" ]] || die "iCloud entitlements $ICLOUD_ENTITLEMENTS are missing from the checkout."
  [[ -f "$ICLOUD_PROFILE" ]] || die "Developer ID provisioning profile not found at $ICLOUD_PROFILE. Create a 'Developer ID Application' profile for com.snowraven with iCloud in the Apple Developer portal (Certificates, Identifiers & Profiles) and download it to that path. See the snowraven-release skill."
  # A private mktemp path (never a fixed name in the world-writable /tmp),
  # removed by the EXIT trap above.
  PROFILE_PLIST=$(mktemp -t snowraven-profile) || die "mktemp failed."
  security cms -D -i "$ICLOUD_PROFILE" > "$PROFILE_PLIST" 2>/dev/null \
    || die "could not decode $ICLOUD_PROFILE (security cms -D failed). Re-download the profile from the portal."
  # PlistBuddy, NOT `plutil -extract Entitlements.com.apple.application-identifier`:
  # plutil reads the dots inside the key NAME as key-path separators and reports
  # "No value at that key path", which the `|| true` would turn into an empty
  # id and a false "different App ID" abort (QA round 1, Failure 1). Every
  # other key read below is a top-level key with no dots, where plutil is fine.
  PROFILE_APP_ID=$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:com.apple.application-identifier' "$PROFILE_PLIST" 2>/dev/null || true)
  [[ "$PROFILE_APP_ID" == *.com.snowraven ]] \
    || die "the profile's application-identifier is '$PROFILE_APP_ID', not <TEAMID>.com.snowraven. It is a profile for a different App ID; regenerate it for com.snowraven."
  # The container must be in the profile's ENTITLEMENTS (a dotted key, so
  # PlistBuddy again), not merely somewhere in the decoded plist.
  PROFILE_CONTAINERS=$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:com.apple.developer.ubiquity-container-identifiers' "$PROFILE_PLIST" 2>/dev/null || true)
  grep -q "$ICLOUD_CONTAINER" <<<"$PROFILE_CONTAINERS" \
    || die "the profile's entitlements do not carry the iCloud container $ICLOUD_CONTAINER. Enable iCloud on the com.snowraven App ID, assign the container, and regenerate the profile."
  # Top-level key: `plutil -extract ... raw` prints the date as ISO 8601 UTC
  # ("2044-08-27T23:13:18Z"), so a string comparison against the same form
  # of "now" is a correct instant comparison (both zero-padded, both Z).
  PROFILE_EXPIRES=$(plutil -extract ExpirationDate raw -o - "$PROFILE_PLIST" 2>/dev/null || true)
  NOW_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  [[ "$PROFILE_EXPIRES" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] \
    || die "could not read the profile's ExpirationDate (got '$PROFILE_EXPIRES'). Re-download the profile from the portal."
  [[ "$PROFILE_EXPIRES" > "$NOW_UTC" ]] \
    || die "the provisioning profile expired on $PROFILE_EXPIRES. Regenerate it in the portal and re-download to $ICLOUD_PROFILE."
  echo "==> iCloud profile OK: $PROFILE_APP_ID, container $ICLOUD_CONTAINER, expires $PROFILE_EXPIRES"
fi

echo "==> SnowRaven $TAG (universal macOS: aarch64 + x86_64)"

# ── Dependency restore (self-healing) ───────────────────────────────────────────
# This script installs BOTH the root and frontend node_modules itself, from the
# committed lockfiles — no separate manual `npm ci` step to forget. The ROOT
# install provides the `tauri` CLI that `npm run desktop:build` resolves from root
# node_modules/.bin; the FRONTEND install provides the Vite/React toolchain.
if [[ "${SKIP_NPM_INSTALL:-0}" == "1" ]]; then
  echo "==> SKIP_NPM_INSTALL=1 — reusing the existing node_modules."
else
  echo "==> Checking network reachability..."
  curl -fsS --max-time 15 -o /dev/null https://registry.npmjs.org/ \
    || die "cannot reach the npm registry (registry.npmjs.org) — check network/VPN/proxy; npm ci needs it to restore node_modules."
  if [[ "$CHECK_ONLY" != "1" ]]; then
    curl -fsS --max-time 15 -o /dev/null https://api.github.com \
      || die "cannot reach GitHub (api.github.com) — needed to fetch the Windows installer and publish the release."
  fi

  install_deps() {
    local where="$1"; shift
    echo "==> Installing $where dependencies (npm ci)..."
    if npm "$@" ci; then return 0; fi
    if [[ "${ALLOW_NPM_INSTALL_FALLBACK:-0}" == "1" ]]; then
      warn "npm ci failed for $where — falling back to 'npm install' (ALLOW_NPM_INSTALL_FALLBACK=1); this can drift from the committed lockfile."
      npm "$@" install || die "npm install also failed for $where."
    else
      die "npm ci failed for $where. On a bleeding-edge Node this is often npm's 'Exit handler never called!' crash — use the pinned Node (.nvmrc). If the lockfile is genuinely out of sync, fix it deliberately, or set ALLOW_NPM_INSTALL_FALLBACK=1 to force an install."
    fi
  }
  install_deps "root"
  install_deps "frontend" --prefix frontend
fi

if [[ "$CHECK_ONLY" == "1" ]]; then
  echo "==> CHECK_ONLY=1 — preflight + dependency install validated; stopping before the macOS build."
  exit 0
fi

# ── Build ─────────────────────────────────────────────────────────────────────
# Two things are required for Tauri to generate the .app.tar.gz updater bundle:
#   1. bundle.createUpdaterArtifacts: true in tauri.conf.json
#   2. TAURI_SIGNING_PRIVATE_KEY set in the environment before the build

export TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY=$(cat "$SIGNING_KEY")
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

# Delete stale updater bundle artifacts before building.
# Tauri only regenerates .app.tar.gz when the Rust binary is recompiled.
# When only tauri.conf.json changes (version bump), Cargo produces an
# incremental build with no binary output and Tauri skips bundle regeneration,
# leaving a stale artifact from the last full compile. Deleting it forces
# Tauri to create a fresh bundle. Touching main.rs forces Cargo to relink.
echo "==> Cleaning stale updater bundle artifacts..."
rm -f "$BUNDLE_DIR/macos/SnowRaven.app.tar.gz"
rm -f "$BUNDLE_DIR/macos/SnowRaven.app.tar.gz.sig"
touch src-tauri/src/main.rs

echo "==> Building frontend..."
npm --prefix frontend run build

# The profile copy is consumed by the overlay's `files` mapping and must never
# be left behind in the checkout (it is gitignored, but a clean tree is the
# next release's precondition). Removed on every exit path.
cp "$ICLOUD_PROFILE" "$ICLOUD_PROFILE_COPY"

echo "==> Building Tauri app (universal binary, compiles both arches, takes a while) with the iCloud overlay..."
npm run desktop:build -- --target "$MAC_TARGET" --config "$(pwd)/$ICLOUD_OVERLAY"
rm -f "$ICLOUD_PROFILE_COPY"

if [[ ! -f "$DMG" ]]; then
  echo "Error: DMG not found at $DMG — build may have failed."
  exit 1
fi

if [[ ! -f "$APP_TAR" ]]; then
  echo "Error: Updater bundle not found at $APP_TAR — build may have failed."
  exit 1
fi

# Verify the bundle version matches the expected version before uploading.
# A mismatch means the stale artifact was not regenerated — abort rather
# than publish an update that installs the wrong binary.
BUNDLE_VERSION=$(defaults read "$BUNDLE_DIR/macos/SnowRaven.app/Contents/Info" CFBundleShortVersionString 2>/dev/null)
if [[ "$BUNDLE_VERSION" != "$VERSION" ]]; then
  echo "Error: Bundle version ($BUNDLE_VERSION) does not match expected version ($VERSION)."
  echo "The updater bundle was not regenerated correctly. Aborting."
  exit 1
fi
echo "==> Bundle version verified: $BUNDLE_VERSION"

# ── iCloud entitlements + embedded profile check (NFR-06 / QA-42) ────────────
# The updater .app.tar.gz is packed from this same .app, so one check covers
# both artifacts. A bundle that carries the restricted iCloud keys without the
# profile (or the profile without the keys) would launch into "This build
# cannot use iCloud" at best and fail to launch at worst; refuse to publish it.
APP="$BUNDLE_DIR/macos/SnowRaven.app"
[[ -f "$APP/Contents/embedded.provisionprofile" ]] \
  || die "the signed bundle has no Contents/embedded.provisionprofile: the overlay's files mapping did not land. Aborting before publish."
ENT_XML=$(codesign -d --entitlements - --xml "$APP" 2>/dev/null || codesign -d --entitlements :- "$APP" 2>/dev/null || true)
for key in com.apple.developer.icloud-container-identifiers com.apple.developer.ubiquity-container-identifiers com.apple.developer.icloud-services; do
  grep -q "$key" <<<"$ENT_XML" || die "the signed bundle's entitlements lack $key: the iCloud overlay was not applied. Aborting before publish."
done
grep -q "$ICLOUD_CONTAINER" <<<"$ENT_XML" || die "the signed bundle's entitlements do not name $ICLOUD_CONTAINER. Aborting before publish."
codesign --verify --deep --strict "$APP" \
  || die "codesign --verify --deep --strict failed on the bundle (the embedded profile must be inside the seal, i.e. copied before signing). Aborting before publish."
echo "==> iCloud entitlements and embedded profile verified in $APP"

# ── Style the DMG (headless) — inject the committed Finder layout ─────────────
# The build runs under CI=true so Tauri's bundle_dmg.sh skips its GUI-only Finder
# AppleScript (that step arranges the install window but needs a logged-in desktop
# session, which an automated release from a background process doesn't have — see
# the CI=true note in CLAUDE.md). That yields a functional but UNSTYLED DMG (no
# .DS_Store window layout). We restore the install-window styling by injecting a
# committed .DS_Store (icon positions + window bounds, captured from a prior styled
# release) with hdiutil — a CLI tool, no GUI/Finder needed. Runs BEFORE notarization
# so the ticket staples the final styled image. The .app + Applications symlink are
# already inside the DMG (Tauri built them); the .DS_Store only positions them.
DMG_LAYOUT="src-tauri/dmg/dmg-DS_Store"
if [[ -f "$DMG_LAYOUT" ]]; then
  echo "==> Styling DMG (injecting Finder layout)..."
  RW_DMG="/tmp/snowraven-dmg-rw.dmg"; MNT="/tmp/snowraven-dmg-mnt"
  rm -f "$RW_DMG"; rm -rf "$MNT"; mkdir -p "$MNT"
  hdiutil convert "$DMG" -format UDRW -o "$RW_DMG" >/dev/null
  hdiutil resize -size 200m "$RW_DMG" >/dev/null   # headroom so the .DS_Store write fits
  hdiutil attach "$RW_DMG" -readwrite -noverify -noautoopen -nobrowse -mountpoint "$MNT" >/dev/null
  cp "$DMG_LAYOUT" "$MNT/.DS_Store"
  sync
  hdiutil detach "$MNT" >/dev/null 2>&1 || { sleep 2; hdiutil detach "$MNT" -force >/dev/null; }
  rm -f "$DMG"
  hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG" >/dev/null
  rm -f "$RW_DMG"; rm -rf "$MNT"
  echo "==> DMG styled (Finder layout injected)."
else
  warn "DMG layout template ($DMG_LAYOUT) missing — shipping an unstyled DMG."
fi

# ── Notarize ─────────────────────────────────────────────────────────────────

echo "==> Notarizing (this takes a minute)..."
xcrun notarytool submit "$DMG" \
  --key "$APPLE_API_KEY_PATH" \
  --key-id "$APPLE_API_KEY_ID" \
  --issuer "$APPLE_API_ISSUER_ID" \
  --wait

echo "==> Stapling..."
xcrun stapler staple "$DMG"

# ── Rename updater bundle to avoid confusion with the installer DMG ──────────

UPDATER_TAR="/tmp/SnowRaven-updater.app.tar.gz"
UPDATER_SIG="${UPDATER_TAR}.sig"
cp "$APP_TAR" "$UPDATER_TAR"
cp "$APP_SIG" "$UPDATER_SIG"

# ── Read macOS updater signature ───────────────────────────────────────────────

MAC_SIG=$(cat "$APP_SIG")

DOWNLOAD_BASE="https://github.com/$REPO/releases/download/$TAG"

# ── Fetch + sign Windows artifacts (Option A) ──────────────────────────────────
# CI (windows-build.yml) builds the Windows installer + unsigned updater archive.
# We sign the updater archive HERE with the local key, so the signing key never
# leaves this machine. Rhythm: push the $TAG tag first so CI builds, wait for the
# Windows Build workflow to finish, then run this script.
# Set SKIP_WINDOWS=1 to publish a macOS-only release (Windows users will NOT get
# this update — emergencies only).

WIN_PLATFORM_JSON=""
WIN_ASSETS=()
if [[ "${SKIP_WINDOWS:-0}" == "1" ]]; then
  echo "==> SKIP_WINDOWS=1 — publishing macOS-only (no Windows entry in latest.json)."
else
  echo "==> Fetching Windows build artifacts from CI..."
  WIN_DIR="/tmp/snowraven-windows"
  rm -rf "$WIN_DIR" && mkdir -p "$WIN_DIR"

  WIN_RUN_ID=$(gh run list --repo "$REPO" --workflow windows-build.yml \
    --status success --limit 1 --json databaseId --jq '.[0].databaseId // empty')
  if [[ -z "$WIN_RUN_ID" ]]; then
    echo "Error: no successful 'Windows Build' run found."
    echo "Push the $TAG tag and wait for the Windows Build workflow to finish,"
    echo "or re-run with SKIP_WINDOWS=1 for a macOS-only release."
    exit 1
  fi

  gh run download "$WIN_RUN_ID" --repo "$REPO" -n windows-build -D "$WIN_DIR"

  # On Windows the NSIS installer (*-setup.exe) IS the updater target.
  WIN_EXE=$(ls "$WIN_DIR"/*-setup.exe 2>/dev/null | head -1 || true)
  if [[ -z "$WIN_EXE" ]]; then
    echo "Error: Windows installer (*-setup.exe) missing from CI artifacts (run $WIN_RUN_ID)."
    exit 1
  fi

  # Guard: the CI build must be for this version, not a stale run.
  if [[ "$WIN_EXE" != *"$VERSION"* ]]; then
    echo "Error: Windows installer ($WIN_EXE) does not match version $VERSION."
    echo "The latest Windows Build run is for a different version — push/rebuild the $TAG tag."
    exit 1
  fi

  echo "==> Signing Windows installer locally..."
  # Re-sign with the real key (CI used a throwaway key whose sig we ignore).
  # TAURI_SIGNING_PRIVATE_KEY (+ _PASSWORD) are already exported above for the
  # macOS build, so signer sign uses them — do NOT also pass --private-key-path,
  # the two key sources are mutually exclusive.
  npx @tauri-apps/cli signer sign "$WIN_EXE"
  WIN_SIG=$(cat "${WIN_EXE}.sig")
  WIN_EXE_SIG="${WIN_EXE}.sig"
  WIN_EXE_NAME=$(basename "$WIN_EXE")

  # The installer serves as both the user download and the updater target;
  # latest.json is regenerated each release so the versioned URL is always current.
  WIN_ASSETS=( "$WIN_EXE" "$WIN_EXE_SIG" )
  WIN_PLATFORM_JSON=",
    \"windows-x86_64\": {
      \"signature\": \"$WIN_SIG\",
      \"url\": \"$DOWNLOAD_BASE/$WIN_EXE_NAME\"
    }"
fi

# ── Generate latest.json (macOS + Windows) ─────────────────────────────────────

cat > /tmp/latest.json << ENDJSON
{
  "version": "$VERSION",
  "notes": "See CHANGELOG.md for details.",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$MAC_SIG",
      "url": "$DOWNLOAD_BASE/SnowRaven-updater.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "$MAC_SIG",
      "url": "$DOWNLOAD_BASE/SnowRaven-updater.app.tar.gz"
    }$WIN_PLATFORM_JSON
  }
}
ENDJSON

# ── Create or update GitHub release ──────────────────────────────────────────

echo "==> Publishing $TAG..."

# Note: the guarded expansion ${arr[@]+"${arr[@]}"} is safe under `set -u` even
# when WIN_ASSETS is empty (SKIP_WINDOWS=1), including on macOS's older bash 3.2.
ASSETS=( "$DMG" "$UPDATER_TAR" "$UPDATER_SIG" ${WIN_ASSETS[@]+"${WIN_ASSETS[@]}"} /tmp/latest.json )

if gh release view "$TAG" --repo "$REPO" &>/dev/null; then
  gh release upload "$TAG" "${ASSETS[@]}" --repo "$REPO" --clobber
else
  gh release create "$TAG" \
    --title "$TAG" \
    --notes "See CHANGELOG.md for details." \
    "${ASSETS[@]}" \
    --repo "$REPO"
fi

echo ""
echo "Done! $TAG is live:"
echo "  https://github.com/$REPO/releases/tag/$TAG"
