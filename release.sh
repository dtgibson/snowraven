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

case "$(uname -m)" in
  arm64)   ARCH="aarch64" ;;
  x86_64)  ARCH="x86_64" ;;
  *)       echo "Unsupported architecture: $(uname -m)" && exit 1 ;;
esac

# Build outside iCloud Drive to avoid extended-attribute interference with codesign.
export CARGO_TARGET_DIR="$HOME/.snowraven-build"
BUNDLE_DIR="$CARGO_TARGET_DIR/release/bundle"
DMG="$BUNDLE_DIR/dmg/SnowRaven_${VERSION}_${ARCH}.dmg"
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

echo "==> SnowRaven $TAG ($ARCH)"

# ── Build ─────────────────────────────────────────────────────────────────────
# TAURI_SIGNING_PRIVATE_KEY must be set before the build so Tauri generates
# the .app.tar.gz updater bundle and .sig file automatically.

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

echo "==> Building Tauri app..."
npm run desktop:build

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

# ── Read updater signature ────────────────────────────────────────────────────

SIG=$(cat "$APP_SIG")

# ── Generate latest.json ──────────────────────────────────────────────────────

DOWNLOAD_BASE="https://github.com/$REPO/releases/download/$TAG"

cat > /tmp/latest.json << ENDJSON
{
  "version": "$VERSION",
  "notes": "See CHANGELOG.md for details.",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-$ARCH": {
      "signature": "$SIG",
      "url": "$DOWNLOAD_BASE/SnowRaven-updater.app.tar.gz"
    }
  }
}
ENDJSON

# ── Create or update GitHub release ──────────────────────────────────────────

echo "==> Publishing $TAG..."

if gh release view "$TAG" --repo "$REPO" &>/dev/null; then
  gh release upload "$TAG" \
    "$DMG" \
    "$UPDATER_TAR" \
    "$UPDATER_SIG" \
    /tmp/latest.json \
    --repo "$REPO" \
    --clobber
else
  gh release create "$TAG" \
    --title "$TAG" \
    --notes "See CHANGELOG.md for details." \
    "$DMG" \
    "$UPDATER_TAR" \
    "$UPDATER_SIG" \
    /tmp/latest.json \
    --repo "$REPO"
fi

echo ""
echo "Done! $TAG is live:"
echo "  https://github.com/$REPO/releases/tag/$TAG"
