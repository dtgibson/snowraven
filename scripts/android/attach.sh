#!/usr/bin/env bash
# attach.sh: upload the signed universal APK to the vX.Y.Z GitHub release
# (android-release schema 6.2, FR-38), ONLY after the user's device check of
# those exact bytes. A separate step after release.sh: release.sh owns the
# release and creates it; this script only ever runs `gh release upload`, and
# stops when the release does not exist yet.
#
# Usage:  ANDROID_DEVICE_CHECK=passed scripts/android/attach.sh [<signed.apk>]
#   <signed.apk> defaults to /tmp/snowraven-android/<version>/SnowRaven_<version>_android_universal.apk
#   (sign.sh's default output)
#   and must carry exactly that file name, which becomes the asset name.
#
# Required:
#   ANDROID_DEVICE_CHECK=passed    the user reported the device check passed, or
#   ANDROID_DEVICE_CHECK=partial   no device was available and attaching anyway is
#                                  a written decision (CLAUDE.md's Android record)
# Optional, and set at every real ship:
#   ANDROID_CHECKED_SHA256=<hex>        SHA-256 of the file the user checked; must equal this file's
#   SNOWRAVEN_ANDROID_SIGNER_SHA256=<hex>  the signer digest recorded at the previous release
#   DRY_RUN=1                           every check, then print the upload instead of running it
#
# Refuses: a missing release, an asset of that name already on it, an APK that
# does not verify or does not match tauri.conf.json, and an APK signed by the
# Android debug key or by a certificate whose subject says it is not for release
# (the throwaway emulator key). After the upload it downloads the asset back and
# compares SHA-256 with the local file.
set -euo pipefail
. "$(dirname "$0")/release-lib.sh"
CALLER_PWD="$PWD"
sr_init
sr_build_tools
APK="${1:-$SR_WORK_DIR/$VERSION/$SR_SIGNED_NAME}"
case "$APK" in /*) ;; *) APK="$CALLER_PWD/$APK" ;; esac

case "${ANDROID_DEVICE_CHECK:-}" in
  passed) ;;
  partial) echo "warning: ANDROID_DEVICE_CHECK=partial: attaching without a device check; the decision and its reason belong in CLAUDE.md's Android record" >&2 ;;
  *) sr_die "the user's device check of this exact APK comes first (the release skill's Android section). Set ANDROID_DEVICE_CHECK=passed once they report it, or =partial with the written decision" ;;
esac

[ -f "$APK" ] || sr_die "$APK does not exist; run sign.sh"
[ "$(basename "$APK")" = "$SR_SIGNED_NAME" ] || sr_die "the file is named $(basename "$APK"); the asset must be $SR_SIGNED_NAME"
for t in "$APKSIGNER" "$AAPT2"; do [ -x "$t" ] || sr_die "$t not found; run preflight.sh"; done

echo "==> Checking $SR_SIGNED_NAME"
sr_badging "$APK" || sr_die "aapt2 could not read $APK"
[ "$APK_PKG" = "com.dtgibson.snowraven" ] || sr_die "the APK's package is '$APK_PKG'"
[ "$APK_VNAME" = "$VERSION" ] && [ "$APK_VCODE" = "$VERSION_CODE" ] \
  || sr_die "the APK is $APK_VNAME ($APK_VCODE); tauri.conf.json says $VERSION ($VERSION_CODE)"
[ "$APK_DEBUGGABLE" = "no" ] || sr_die "the APK is debuggable"
sr_signer "$APK" || sr_die "the APK does not verify; run sign.sh"
case "$SIGNER_DN" in
  *"Android Debug"*|*THROWAWAY*|*"not for release"*) sr_die "the APK is signed by '$SIGNER_DN', which is not the release key" ;;
esac
if [ -n "${SNOWRAVEN_ANDROID_SIGNER_SHA256:-}" ]; then
  want="$(printf '%s' "$SNOWRAVEN_ANDROID_SIGNER_SHA256" | tr 'A-F' 'a-f' | tr -d ': ')"
  [ "$SIGNER_SHA256" = "$want" ] || sr_die "the signer is $SIGNER_SHA256, not the recorded $want"
fi
HAVE_SHA="$(sr_sha256 "$APK")"
if [ -n "${ANDROID_CHECKED_SHA256:-}" ]; then
  [ "$HAVE_SHA" = "$(printf '%s' "$ANDROID_CHECKED_SHA256" | tr 'A-F' 'a-f')" ] \
    || sr_die "this file ($HAVE_SHA) is not the file the user checked ($ANDROID_CHECKED_SHA256)"
  echo "  ok  byte-identical to the checked file"
else
  echo "warning: ANDROID_CHECKED_SHA256 not set; the file is not compared with the one the user checked" >&2
fi
echo "  ok  $APK_PKG $APK_VNAME ($APK_VCODE), signer $SIGNER_SHA256"

command -v gh >/dev/null 2>&1 || sr_die "gh is not on PATH"
gh release view "$TAG" --repo "$SR_REPO" >/dev/null 2>&1 \
  || sr_die "no GitHub release $TAG yet: release.sh creates it; run that first (this script never creates a release)"
ASSETS="$(gh release view "$TAG" --repo "$SR_REPO" --json assets --jq '.assets[].name')"
if printf '%s\n' "$ASSETS" | grep -qx "$SR_SIGNED_NAME"; then
  sr_die "$TAG already has an asset named $SR_SIGNED_NAME; replacing published bytes is a decision, not a re-run"
fi

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "==> DRY_RUN=1: would run: gh release upload $TAG $APK --repo $SR_REPO"
  exit 0
fi

echo "==> Uploading to $TAG"
gh release upload "$TAG" "$APK" --repo "$SR_REPO"

echo "==> Downloading the asset back"
SR_TMP="$(mktemp -d "${TMPDIR:-/tmp}/sr-android-attach.XXXXXX")"
gh release download "$TAG" --repo "$SR_REPO" --pattern "$SR_SIGNED_NAME" -D "$SR_TMP"
BACK_SHA="$(sr_sha256 "$SR_TMP/$SR_SIGNED_NAME")"
[ "$BACK_SHA" = "$HAVE_SHA" ] || sr_die "the asset downloaded back ($BACK_SHA) differs from the local file ($HAVE_SHA)"
echo "Attached $SR_SIGNED_NAME to $TAG"
echo "ASSET_SHA256=$BACK_SHA"
echo "SIGNER_SHA256=$SIGNER_SHA256"
