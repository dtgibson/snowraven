#!/usr/bin/env bash
# release.sh — build, sign, notarize, and publish SnowRaven for macOS
#
# Run this after pushing a version bump and CHANGELOG update.
# Credentials stay local — nothing is stored in GitHub.
#
# Required env vars (set in your shell before running):
#   APPLE_API_KEY_PATH    path to your .p8 key file from App Store Connect
#   APPLE_API_KEY_ID      10-character Key ID from App Store Connect
#   APPLE_API_ISSUER_ID   Issuer ID UUID from App Store Connect
#
# Example:
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
  x86_64)  ARCH="x64" ;;
  *)       echo "Unsupported architecture: $(uname -m)" && exit 1 ;;
esac

BUNDLE_DIR="src-tauri/target/release/bundle"
DMG="$BUNDLE_DIR/dmg/SnowRaven_${VERSION}_${ARCH}.dmg"
APP_TAR="$BUNDLE_DIR/macos/SnowRaven.app.tar.gz"
APP_SIG="${APP_TAR}.sig"

# ── Preflight checks ──────────────────────────────────────────────────────────

for var in APPLE_API_KEY_PATH APPLE_API_KEY_ID APPLE_API_ISSUER_ID; do
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

echo "==> Building..."
npm run desktop:build

if [[ ! -f "$DMG" ]]; then
  echo "Error: DMG not found at $DMG — build may have failed."
  exit 1
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

# ── Sign updater bundle ───────────────────────────────────────────────────────

echo "==> Signing updater bundle..."
export TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY=$(cat "$SIGNING_KEY")
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npx @tauri-apps/cli@^2 signer sign "$APP_TAR"
SIG=$(cat "$APP_SIG")

# ── Generate latest.json ──────────────────────────────────────────────────────

DOWNLOAD_BASE="https://github.com/$REPO/releases/download/$TAG"

cat > /tmp/snowraven-latest.json << ENDJSON
{
  "version": "$VERSION",
  "notes": "See CHANGELOG.md for details.",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-$ARCH": {
      "signature": "$SIG",
      "url": "$DOWNLOAD_BASE/SnowRaven.app.tar.gz"
    }
  }
}
ENDJSON

# ── Create or update GitHub release ──────────────────────────────────────────

echo "==> Publishing $TAG..."

if gh release view "$TAG" --repo "$REPO" &>/dev/null; then
  gh release upload "$TAG" \
    "$DMG" \
    "$APP_TAR" \
    "$APP_SIG" \
    /tmp/snowraven-latest.json \
    --repo "$REPO" \
    --clobber
else
  gh release create "$TAG" \
    --title "$TAG" \
    --notes "See CHANGELOG.md for details." \
    "$DMG" \
    "$APP_TAR" \
    "$APP_SIG" \
    /tmp/snowraven-latest.json \
    --repo "$REPO"
fi

echo ""
echo "Done! $TAG is live:"
echo "  https://github.com/$REPO/releases/tag/$TAG"
