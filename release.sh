#!/usr/bin/env bash
# release.sh — build, sign, notarize, and publish SnowRaven for macOS
#
# Run this after pushing a version bump and CHANGELOG update.
# Credentials stay local — nothing is stored in GitHub.
#
# Required env vars (set in your shell before running):
#   APPLE_SIGNING_IDENTITY  your Developer ID Application cert name, e.g.:
#                           "Developer ID Application: Dave Gibson (TEAMID)"
#                           Find it: security find-identity -v -p codesigning | grep "Developer ID Application"
#   APPLE_API_KEY_PATH      path to your .p8 key file from App Store Connect
#   APPLE_API_KEY_ID        10-character Key ID from App Store Connect
#   APPLE_API_ISSUER_ID     Issuer ID UUID from App Store Connect
#
# Example:
#   export APPLE_SIGNING_IDENTITY="Developer ID Application: Dave Gibson (XXXXXXXXXX)"
#   export APPLE_API_KEY_PATH=~/AuthKey_XXXXXXXXXX.p8
#   export APPLE_API_KEY_ID=XXXXXXXXXX
#   export APPLE_API_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   ./release.sh

set -euo pipefail

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

# Build outside iCloud Drive to avoid extended-attribute interference with codesign.
export CARGO_TARGET_DIR="$HOME/.snowraven-build"
# An explicit --target makes Tauri nest the bundle under the target triple, and
# the universal DMG is named with the "universal" arch suffix.
BUNDLE_DIR="$CARGO_TARGET_DIR/$MAC_TARGET/release/bundle"
DMG="$BUNDLE_DIR/dmg/SnowRaven_${VERSION}_universal.dmg"
APP_TAR="$BUNDLE_DIR/macos/SnowRaven.app.tar.gz"
APP_SIG="${APP_TAR}.sig"

# ── Preflight checks ──────────────────────────────────────────────────────────

for var in APPLE_SIGNING_IDENTITY APPLE_API_KEY_PATH APPLE_API_KEY_ID APPLE_API_ISSUER_ID; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set. See the usage comment at the top of this script."
    exit 1
  fi
done

if [[ ! -f "$APPLE_API_KEY_PATH" ]]; then
  echo "Error: APPLE_API_KEY_PATH ($APPLE_API_KEY_PATH) does not exist."
  exit 1
fi

if [[ ! -f "$SIGNING_KEY" ]]; then
  echo "Error: Tauri signing key not found at $SIGNING_KEY"
  exit 1
fi

# The universal macOS build cross-compiles both arches, so both Rust targets
# must be installed locally (the Apple Silicon machine has aarch64 by default,
# but x86_64 is added explicitly).
for tgt in aarch64-apple-darwin x86_64-apple-darwin; do
  if ! rustup target list --installed 2>/dev/null | grep -qx "$tgt"; then
    echo "Error: Rust target '$tgt' is not installed (required for the universal build)."
    echo "Install it with: rustup target add $tgt"
    exit 1
  fi
done

echo "==> SnowRaven $TAG (universal macOS: aarch64 + x86_64)"

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

echo "==> Building Tauri app (universal binary — compiles both arches, takes a while)..."
npm run desktop:build -- --target "$MAC_TARGET"

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
