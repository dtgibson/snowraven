#!/usr/bin/env bash
# sign.sh: sign the UNSIGNED universal APK with the user's own key on the release
# Mac (android-release schema 6.2, FR-35). Run after preflight.sh passes.
#
# Usage:  scripts/android/sign.sh <unsigned.apk> [<out.apk>]
#   <out.apk> defaults to /tmp/snowraven-android/<version>/SnowRaven_<version>_android_universal.apk,
#   where attach.sh looks for it.
#
# Steps: zipalign with 16 KB page alignment for the uncompressed native libraries
# (-P 16, never the 4 KB -p, which would undo the 16 KB alignment Android 15 and
# later need on 16 KB-page devices; apksigner from build-tools 36 page-aligns
# native libraries to 16 KB by default too), then apksigner with its default
# scheme set (v1 to v3; Android 8.0 verifies v2), the passwords handed over by
# file, then apksigner verify --print-certs. Prints the signer certificate's
# SHA-256, which must be the same at every release (a changed signer breaks the
# install-over path), and the signed file's SHA-256 for the byte-identity check
# at the attach. With SNOWRAVEN_ANDROID_SIGNER_SHA256 set (the digest recorded at
# the previous release), a different signer stops the script.
#
# It never creates a keystore; a missing keystore or properties file stops with
# the user-performed keytool step printed.
set -euo pipefail
. "$(dirname "$0")/release-lib.sh"
CALLER_PWD="$PWD"
IN="${1:-}"
[ -n "$IN" ] || sr_die "usage: scripts/android/sign.sh <unsigned.apk> [<out.apk>]"
[ -f "$IN" ] || sr_die "$IN does not exist"
IN="$(sr_abspath "$IN")"
sr_init
sr_build_tools
OUT="${2:-$SR_WORK_DIR/$VERSION/$SR_SIGNED_NAME}"
mkdir -p "$(dirname "$OUT")"
case "$OUT" in /*) ;; *) OUT="$CALLER_PWD/$OUT" ;; esac
[ "$OUT" != "$IN" ] || sr_die "the output must not overwrite the input"
for t in "$APKSIGNER" "$ZIPALIGN" "$AAPT2"; do [ -x "$t" ] || sr_die "$t not found; run preflight.sh"; done

sr_badging "$IN" || sr_die "aapt2 could not read $IN"
[ "$APK_PKG" = "com.dtgibson.snowraven" ] || sr_die "$IN is package '$APK_PKG', not com.dtgibson.snowraven"
[ "$APK_VNAME" = "$VERSION" ] && [ "$APK_VCODE" = "$VERSION_CODE" ] \
  || sr_die "$IN is $APK_VNAME ($APK_VCODE); tauri.conf.json says $VERSION ($VERSION_CODE). Run preflight.sh"
[ "$APK_DEBUGGABLE" = "no" ] || sr_die "$IN is debuggable; only a release build is signed"

sr_resolve_keystore || exit 1

echo "==> Signing $(basename "$IN") as $(basename "$OUT")"
SR_TMP="$(mktemp -d "${TMPDIR:-/tmp}/sr-android-sign.XXXXXX")"
ALIGNED="$SR_TMP/aligned.apk"
"$ZIPALIGN" -f -P 16 4 "$IN" "$ALIGNED"
"$ZIPALIGN" -c -P 16 4 "$ALIGNED" || sr_die "zipalign check failed on the aligned copy"
# Signed into the scratch directory and moved into place only after every check
# passes, so a refused signature leaves no signed file behind.
SIGNED="$SR_TMP/signed.apk"
"$APKSIGNER" sign \
  --ks "$KS_FILE" --ks-type PKCS12 --ks-key-alias "$KS_ALIAS" \
  --ks-pass "file:$KS_PASS_FILE" --key-pass "file:$KEY_PASS_FILE" \
  --out "$SIGNED" "$ALIGNED"

echo "==> Verifying"
"$APKSIGNER" verify --verbose "$SIGNED" | grep -E '^(Verifies|Verified using v[0-9.]+ scheme)' || true
sr_signer "$SIGNED" || sr_die "apksigner verify failed"
"$ZIPALIGN" -c -P 16 4 "$SIGNED" || sr_die "the signed APK is not 16 KB page-aligned"
sr_badging "$SIGNED" || sr_die "aapt2 could not read the signed APK"
[ "$APK_VNAME" = "$VERSION" ] && [ "$APK_VCODE" = "$VERSION_CODE" ] || sr_die "the signed APK reads $APK_VNAME ($APK_VCODE)"
if [ -n "${SNOWRAVEN_ANDROID_SIGNER_SHA256:-}" ]; then
  want="$(printf '%s' "$SNOWRAVEN_ANDROID_SIGNER_SHA256" | tr 'A-F' 'a-f' | tr -d ': ')"
  [ "$SIGNER_SHA256" = "$want" ] || sr_die "the signer is $SIGNER_SHA256, not the recorded $want; a changed signer breaks the install-over path"
  echo "  ok  signer equals the recorded digest"
fi
mv -f "$SIGNED" "$OUT"

echo "Signer #1 certificate DN: $SIGNER_DN"
echo "Signer #1 certificate SHA-256 digest: $SIGNER_SHA256"
echo "SIGNED_APK=$OUT"
echo "SIGNED_APK_SHA256=$(sr_sha256 "$OUT")"
