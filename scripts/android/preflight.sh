#!/usr/bin/env bash
# preflight.sh: the release Mac's Android preflight (android-release schema 6.2,
# FR-35, FR-36). Run after the vX.Y.Z tag's Android CI run is green and after
# release.sh, before sign.sh. Any failure exits non-zero before anything is
# signed, and nothing is attached.
#
# Checks: JDK 17; apksigner, zipalign and aapt2 from the pinned build-tools;
# Gradle and cargo-tauri at the toolchain.env pins; the keystore present, outside
# the repository and opening with its password (missing: the user-performed
# keytool step is printed); the version and version code agreeing across
# tauri.conf.json, frontend/package.json and the formula; the tag pushed and
# carrying the same pair; and the CI artifact: the android-build run PINNED to the
# tag's commit, exactly one APK named SnowRaven_<version>_android_universal_unsigned.apk,
# whose package, versionName and versionCode match and which is not debuggable.
#
# Usage:  scripts/android/preflight.sh
# The verified unsigned APK lands in a fresh private directory (mktemp -d under
# $TMPDIR, mode 0700; never a fixed /tmp path, security L2); its path is the last
# line printed (UNSIGNED_APK=...), which is sign.sh's first argument.
#
# Toggles (dry runs only; a real ship sets neither):
#   ANDROID_APK=<path>   check this local APK instead of downloading the CI artifact
#   SKIP_TAG_CHECK=1     skip the tag checks (no tag exists yet)
set -euo pipefail
. "$(dirname "$0")/release-lib.sh"
sr_init
sr_build_tools

FAILS=0
fail() { echo "FAIL: $*" >&2; FAILS=$((FAILS + 1)); }
ok()   { echo "  ok  $*"; }

echo "==> Android preflight for $TAG (versionCode $VERSION_CODE)"

# ── Toolchain ───────────────────────────────────────────────────────────────
JAVA_LINE="$(java -version 2>&1 | head -1 || true)"
JAVA_MAJOR="$(printf '%s\n' "$JAVA_LINE" | sed -n 's/.*version "\([0-9]*\).*/\1/p')"
if [ "$JAVA_MAJOR" = "$JAVA_VERSION" ]; then ok "JDK $JAVA_MAJOR ($JAVA_LINE)"; else fail "java on PATH is '$JAVA_LINE'; JDK $JAVA_VERSION is required"; fi
command -v keytool >/dev/null 2>&1 && ok "keytool" || fail "keytool not on PATH (it comes with the JDK)"
for t in "$APKSIGNER" "$ZIPALIGN" "$AAPT2"; do
  if [ -x "$t" ]; then ok "$(basename "$t") from build-tools $BUILD_TOOLS"; else fail "$t not found (sdkmanager \"build-tools;$BUILD_TOOLS\")"; fi
done
GRADLE_PIN="$(sed -n 's/^distributionUrl=.*gradle-\([0-9.]*\)-bin\.zip$/\1/p' src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties)"
GRADLE_HAVE="$(gradle --version 2>/dev/null | sed -n 's/^Gradle \([0-9.]*\)$/\1/p' || true)"
if [ "$GRADLE_PIN" != "$GRADLE_VERSION" ]; then fail "gradle-wrapper.properties pins $GRADLE_PIN but toolchain.env says $GRADLE_VERSION"
elif [ "$GRADLE_HAVE" = "$GRADLE_VERSION" ]; then ok "Gradle $GRADLE_HAVE"
else fail "gradle on PATH is '${GRADLE_HAVE:-missing}'; Gradle $GRADLE_VERSION is required"; fi
TAURI_HAVE="$(cargo tauri --version 2>/dev/null | awk '{print $2}' || true)"
if [ "$TAURI_HAVE" = "$TAURI_CLI_VERSION" ]; then ok "cargo-tauri $TAURI_HAVE"; else fail "cargo tauri is '${TAURI_HAVE:-missing}'; cargo install tauri-cli --version $TAURI_CLI_VERSION --locked"; fi

# ── Keystore ────────────────────────────────────────────────────────────────
if sr_resolve_keystore; then
  if keytool -list -storetype PKCS12 -keystore "$KS_FILE" -storepass:file "$KS_PASS_FILE" -alias "$KS_ALIAS" >/dev/null 2>&1; then
    ok "keystore opens: $KS_FILE (alias $KS_ALIAS)"
  else
    fail "keytool could not open $KS_FILE with the password in $KS_PROPS, or it has no alias '$KS_ALIAS'"
  fi
else
  fail "keystore not ready (see above)"
fi

# ── Version agreement ───────────────────────────────────────────────────────
[ "$VERSION" = "$PKG_VERSION" ] && ok "tauri.conf.json version $VERSION equals frontend/package.json" \
  || fail "tauri.conf.json version $VERSION differs from frontend/package.json $PKG_VERSION"
[ "$VERSION_CODE" = "$EXPECTED_CODE" ] && ok "bundle.android.versionCode $VERSION_CODE follows the formula" \
  || fail "bundle.android.versionCode is $VERSION_CODE; $VERSION needs $EXPECTED_CODE"

# ── Tag ─────────────────────────────────────────────────────────────────────
TAG_SHA=""
if [ "${SKIP_TAG_CHECK:-0}" = "1" ]; then
  echo "  --  SKIP_TAG_CHECK=1: tag checks skipped (dry run; never on a ship)"
elif ! TAG_SHA="$(git rev-parse -q --verify "refs/tags/$TAG^{commit}")"; then
  TAG_SHA=""
  fail "tag $TAG does not exist locally (push the tag before preflight)"
else
  # The peeled line (an annotated tag's commit) sorts last when present.
  REMOTE_SHA="$({ git ls-remote --tags origin "refs/tags/$TAG" "refs/tags/$TAG^{}" 2>/dev/null || true; } | awk '{print $1}' | tail -1)"
  [ "$REMOTE_SHA" = "$TAG_SHA" ] && ok "$TAG is pushed to origin at ${TAG_SHA:0:12}" \
    || fail "$TAG on origin (${REMOTE_SHA:-absent}) is not the local $TAG (${TAG_SHA:0:12})"
  TAG_PAIR="$({ git show "$TAG:src-tauri/tauri.conf.json" 2>/dev/null || echo '{}'; } | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log(c.version+" "+((c.bundle||{}).android||{}).versionCode)})' || true)"
  [ "$TAG_PAIR" = "$VERSION $VERSION_CODE" ] && ok "tauri.conf.json at $TAG carries $TAG_PAIR" \
    || fail "tauri.conf.json at $TAG carries '$TAG_PAIR', not '$VERSION $VERSION_CODE'"
  [ "$(git rev-parse HEAD)" = "$TAG_SHA" ] || echo "warning: HEAD is not $TAG's commit; the artifact is checked against $TAG" >&2
  # F-Droid looks the changelog up by each per-processor code (code x 10 + 1, 2, 4).
  for OFFSET in 1 2 4; do
    ABI_CODE=$((VERSION_CODE * 10 + OFFSET))
    git cat-file -e "$TAG:fastlane/metadata/android/en-US/changelogs/$ABI_CODE.txt" 2>/dev/null \
      && ok "Fastlane changelog $ABI_CODE.txt exists at $TAG" \
      || echo "warning: fastlane/metadata/android/en-US/changelogs/$ABI_CODE.txt is absent at $TAG, so F-Droid shows no changelog for that build (it does not block the GitHub APK)" >&2
  done
fi

# ── The CI artifact ─────────────────────────────────────────────────────────
APK=""
if [ -n "${ANDROID_APK:-}" ]; then
  echo "  --  ANDROID_APK set: checking $ANDROID_APK instead of the CI artifact (dry run)"
  [ -f "$ANDROID_APK" ] && APK="$ANDROID_APK" || fail "ANDROID_APK=$ANDROID_APK does not exist"
elif [ -z "$TAG_SHA" ]; then
  fail "no tag commit to pin the android-build run to; nothing downloaded"
else
  command -v gh >/dev/null 2>&1 || sr_die "gh is not on PATH"
  RUN_ID="$(gh run list --repo "$SR_REPO" --workflow android-build.yml --status success --commit "$TAG_SHA" \
    --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  if [ -z "$RUN_ID" ]; then
    fail "no successful Android Build run for $TAG's commit ${TAG_SHA:0:12}; wait for it, or re-run it"
  else
    DL="$(sr_work_dir ci)"
    gh run download "$RUN_ID" --repo "$SR_REPO" -n android-build -D "$DL"
    COUNT="$(find "$DL" -name '*.apk' | wc -l | tr -d ' ')"
    if [ "$COUNT" != "1" ]; then fail "the android-build artifact of run $RUN_ID holds $COUNT APKs, not exactly one"
    elif [ ! -f "$DL/$SR_UNSIGNED_NAME" ]; then fail "the artifact's APK is $(cd "$DL" && ls *.apk), not $SR_UNSIGNED_NAME"
    else APK="$DL/$SR_UNSIGNED_NAME"; ok "run $RUN_ID artifact: $SR_UNSIGNED_NAME"; fi
  fi
fi
if [ -n "$APK" ]; then
  if sr_badging "$APK"; then
    [ "$APK_PKG" = "com.dtgibson.snowraven" ] && ok "package $APK_PKG" || fail "the APK's package is '$APK_PKG', not com.dtgibson.snowraven"
    [ "$APK_VNAME" = "$VERSION" ] && ok "versionName $APK_VNAME" || fail "the APK's versionName is '$APK_VNAME', not $VERSION"
    [ "$APK_VCODE" = "$VERSION_CODE" ] && ok "versionCode $APK_VCODE" || fail "the APK's versionCode is '$APK_VCODE', not $VERSION_CODE"
    [ "$APK_DEBUGGABLE" = "no" ] && ok "not debuggable" || fail "the APK is debuggable; only a release build ships"
  else
    fail "aapt2 could not read $APK"
  fi
fi

if [ "$FAILS" -gt 0 ]; then
  echo "==> Android preflight FAILED ($FAILS). Nothing was signed or attached." >&2
  exit 1
fi
echo "==> Android preflight passed."
echo "UNSIGNED_APK=$APK"
