#!/bin/sh
# The one Android build entry (android-release schema 6.0), run identically by
# CI (.github/workflows/android-build.yml), the release Mac and F-Droid's build
# server (the fdroiddata recipe's build: step). It produces the UNSIGNED release
# universal APK (arm64, 32-bit ARM, x86_64); nothing here signs anything.
#
# The caller builds the frontend first (npm --prefix frontend ci && npm --prefix
# frontend run build), because F-Droid runs that in prebuild, before its source
# scan, and deletes node_modules afterward. Every build goes through
# `cargo tauri android build`: Gradle's Rust tasks call the CLI's
# android-studio-script, which needs the parent CLI process, so a bare Gradle run
# cannot build this app.
set -eu
cd "$(dirname "$0")/../.."
# The gradlew shim (schema 3.8). F-Droid deletes gradlew before its scan; CI and
# the Mac have it from git.
test -x src-tauri/gen/android/gradlew || printf '#!/bin/sh\ncd "$(dirname "$0")" && exec gradle "$@"\n' > src-tauri/gen/android/gradlew
chmod +x src-tauri/gen/android/gradlew
# frontend/dist was built by the caller; the beforeBuildCommand is removed
# (an RFC 7396 merge: null deletes the key).
cargo tauri android build --ci --apk --target aarch64 armv7 x86_64 \
  --config '{"build":{"beforeBuildCommand":null}}'
OUT=src-tauri/gen/android/app/build/outputs/apk/universal/release
# Exactly one APK, or stop (the Windows artifact-selection lesson).
test "$(ls "$OUT"/*.apk | wc -l)" -eq 1
