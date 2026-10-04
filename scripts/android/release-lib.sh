# Shared helpers for the release Mac's Android scripts (preflight.sh, sign.sh,
# attach.sh; android-release schema 6.2). Sourced, never run. Nothing here is
# used by CI or F-Droid, whose only entry is build-apk.sh.
#
# Secrets: the keystore and its password live OUTSIDE the repository, like the
# Apple keys, and are read only from the two documented locations:
#   SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES  default ~/.tauri/snowraven-android-keystore.properties
#                                          (storeFile, storePassword, keyAlias, keyPassword; mode 0600)
#   SNOWRAVEN_ANDROID_KEYSTORE             default: the properties file's storeFile,
#                                          else ~/.tauri/snowraven-android.p12
# A password is written only to a 0600 file in a private temp directory that is
# removed on exit, and is handed to keytool and apksigner by FILE, never on a
# command line (where it would land in the session's command log). Nothing here
# ever creates a keystore: when one is missing, the user-performed step is
# printed and the script stops.

SR_REPO="dtgibson/snowraven"
SR_DEFAULT_PROPS="$HOME/.tauri/snowraven-android-keystore.properties"
SR_DEFAULT_KEYSTORE="$HOME/.tauri/snowraven-android.p12"
# There is deliberately NO fixed work directory (security L2): a fixed path under
# the shared /tmp is world-writable at the directory level, so a file could be
# swapped between sign and attach. Each script that writes an APK makes its own
# private directory with sr_work_dir (mktemp -d, mode 0700, under the per-user
# $TMPDIR) and prints the path; the next script takes that path as an argument.

sr_die() { echo "ERROR: $*" >&2; exit 1; }

# Removes the private password directory and any scratch directory on exit.
sr_cleanup() {
  if [ -n "${SR_SECRETS:-}" ]; then rm -rf "$SR_SECRETS"; fi
  if [ -n "${SR_TMP:-}" ]; then rm -rf "$SR_TMP"; fi
}

# A fresh private work directory for an output that outlives the script (the
# downloaded CI artifact, the signed APK): mktemp -d under the per-user $TMPDIR,
# mode 0700, NOT removed on exit. Prints the path; the caller echoes it in its
# last line so the next step is given it explicitly.
sr_work_dir() {
  local d
  d="$(mktemp -d "${TMPDIR:-/tmp}/sr-android-$1.XXXXXX")" || sr_die "mktemp failed"
  chmod 700 "$d"
  printf '%s\n' "$d"
}

# Repository root, the toolchain pins, and the version pair from tauri.conf.json.
sr_init() {
  trap sr_cleanup EXIT
  SR_ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
  cd "$SR_ROOT" || sr_die "cannot enter $SR_ROOT"
  # shellcheck source=toolchain.env
  . "$SR_ROOT/scripts/android/toolchain.env"
  command -v node >/dev/null 2>&1 || sr_die "node is not on PATH (needed to read tauri.conf.json)"
  VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
  VERSION_CODE="$(node -p "(require('./src-tauri/tauri.conf.json').bundle.android || {}).versionCode")"
  PKG_VERSION="$(node -p "require('./frontend/package.json').version")"
  EXPECTED_CODE="$(node -p "const [a,b,c]='$VERSION'.split('.').map(Number); a*1000000+b*1000+c")"
  TAG="v$VERSION"
  SR_UNSIGNED_NAME="SnowRaven_${VERSION}_android_universal_unsigned.apk"
  SR_SIGNED_NAME="SnowRaven_${VERSION}_android_universal.apk"
}

# The pinned build-tools (apksigner, zipalign, aapt2), by path, not from PATH.
sr_build_tools() {
  [ -n "${ANDROID_HOME:-}" ] || sr_die "ANDROID_HOME is not set (the release skill's Android section lists the exports)"
  SR_BT="$ANDROID_HOME/build-tools/$BUILD_TOOLS"
  APKSIGNER="$SR_BT/apksigner"
  ZIPALIGN="$SR_BT/zipalign"
  AAPT2="$SR_BT/aapt2"
}

# One value from a Java properties file (key=value or key: value; # and ! comments).
# Escapes are not interpreted, so a password must not contain a backslash.
sr_prop() {
  awk -v k="$2" '
    /^[[:space:]]*[#!]/ { next }
    { line = $0; sub(/\r$/, "", line)
      if (match(line, "^[[:space:]]*" k "[[:space:]]*[=:][[:space:]]*")) { print substr(line, RLENGTH + 1); exit } }
  ' "$1"
}

sr_mode() { stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1"; }

# Absolute physical path of an existing file.
sr_abspath() { (cd "$(dirname "$1")" && printf '%s/%s\n' "$(pwd -P)" "$(basename "$1")"); }

sr_user_step_keystore() {
  cat >&2 <<'USER_STEP'

The Android signing keystore is a USER-PERFORMED, one-time step; no script
creates it. In your own terminal on the release Mac:

  keytool -genkeypair -v -storetype PKCS12 -keystore ~/.tauri/snowraven-android.p12 -alias snowraven -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=SnowRaven, O=Dave Gibson"

then write ~/.tauri/snowraven-android-keystore.properties beside it (a PKCS12
store has one password, so both password lines carry the same value):

  storeFile=/Users/<you>/.tauri/snowraven-android.p12
  storePassword=<the password>
  keyAlias=snowraven
  keyPassword=<the password>

and run:  chmod 600 ~/.tauri/snowraven-android.p12 ~/.tauri/snowraven-android-keystore.properties

Keep a backup of the keystore file and its password somewhere of your own: a
lost key means no later GitHub APK can install over an earlier one.
USER_STEP
}

# Resolves KS_PROPS, KS_FILE, KS_ALIAS and writes the two password files into
# SR_SECRETS (a private temp dir removed on exit). Returns 1, after printing what
# is wrong and the user step where it applies, when anything is missing.
sr_resolve_keystore() {
  KS_PROPS="${SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES:-$SR_DEFAULT_PROPS}"
  if [ ! -f "$KS_PROPS" ]; then
    echo "FAIL: keystore properties file not found: $KS_PROPS" >&2
    sr_user_step_keystore
    return 1
  fi
  local mode; mode="$(sr_mode "$KS_PROPS")"
  case "$mode" in
    *00) ;;
    *) echo "FAIL: $KS_PROPS is readable by others (mode $mode); run: chmod 600 \"$KS_PROPS\"" >&2; return 1 ;;
  esac
  local store; store="$(sr_prop "$KS_PROPS" storeFile)"
  KS_FILE="${SNOWRAVEN_ANDROID_KEYSTORE:-${store:-$SR_DEFAULT_KEYSTORE}}"
  case "$KS_FILE" in
    /*) ;;
    *) echo "FAIL: the keystore path must be absolute (got '$KS_FILE')" >&2; return 1 ;;
  esac
  if [ ! -f "$KS_FILE" ]; then
    echo "FAIL: keystore not found: $KS_FILE" >&2
    sr_user_step_keystore
    return 1
  fi
  if [ -n "${SNOWRAVEN_ANDROID_KEYSTORE:-}" ] && [ -n "$store" ] && [ "$store" != "$SNOWRAVEN_ANDROID_KEYSTORE" ]; then
    echo "warning: SNOWRAVEN_ANDROID_KEYSTORE ($SNOWRAVEN_ANDROID_KEYSTORE) differs from storeFile in $KS_PROPS ($store); using the environment's" >&2
  fi
  local f
  for f in "$KS_PROPS" "$KS_FILE"; do
    case "$(sr_abspath "$f")" in
      "$SR_ROOT"/*) echo "FAIL: $f is inside the repository; signing material lives outside it (~/.tauri)" >&2; return 1 ;;
    esac
  done
  KS_ALIAS="$(sr_prop "$KS_PROPS" keyAlias)"
  [ -n "$KS_ALIAS" ] || { echo "FAIL: keyAlias is missing from $KS_PROPS" >&2; return 1; }
  local spw kpw
  spw="$(sr_prop "$KS_PROPS" storePassword)"
  kpw="$(sr_prop "$KS_PROPS" keyPassword)"
  [ -n "$spw" ] || { echo "FAIL: storePassword is missing from $KS_PROPS" >&2; sr_user_step_keystore; return 1; }
  [ -n "$kpw" ] || kpw="$spw"
  SR_SECRETS="$(mktemp -d "${TMPDIR:-/tmp}/sr-android-secrets.XXXXXX")" || return 1
  chmod 700 "$SR_SECRETS"
  (umask 077; printf '%s' "$spw" > "$SR_SECRETS/ks.pass"; printf '%s' "$kpw" > "$SR_SECRETS/key.pass")
  unset spw kpw
  KS_PASS_FILE="$SR_SECRETS/ks.pass"
  KEY_PASS_FILE="$SR_SECRETS/key.pass"
}

# aapt2 badging: APK_PKG, APK_VNAME, APK_VCODE, APK_DEBUGGABLE (yes/no).
sr_badging() {
  local out
  out="$("$AAPT2" dump badging "$1" 2>/dev/null)" || return 1
  APK_PKG="$(printf '%s\n' "$out" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")"
  APK_VCODE="$(printf '%s\n' "$out" | sed -n "s/^package: .* versionCode='\([^']*\)'.*/\1/p")"
  APK_VNAME="$(printf '%s\n' "$out" | sed -n "s/^package: .* versionName='\([^']*\)'.*/\1/p")"
  if printf '%s\n' "$out" | grep -q '^application-debuggable'; then APK_DEBUGGABLE=yes; else APK_DEBUGGABLE=no; fi
}

# The configured keystore's own certificate, as the lowercase hex SHA-256 the
# APK signer digest is compared against (security L2). Read from the keystore
# itself with keytool on every run, so the first release is bound to the user's
# key exactly as every later one, with no previously recorded value needed.
# Needs sr_resolve_keystore first. Sets KS_CERT_SHA256; returns 1 on failure.
sr_keystore_cert_sha256() {
  local out
  out="$(keytool -list -v -storetype PKCS12 -keystore "$KS_FILE" -storepass:file "$KS_PASS_FILE" -alias "$KS_ALIAS" 2>&1)" \
    || { printf '%s\n' "$out" | head -3 >&2; return 1; }
  KS_CERT_SHA256="$(printf '%s\n' "$out" | sed -n 's/^[[:space:]]*SHA256: //p' | head -1 | tr 'A-F' 'a-f' | tr -d ': \r')"
  [ "${#KS_CERT_SHA256}" -eq 64 ]
}

# The APK's first signer: SIGNER_SHA256 and SIGNER_DN. Returns 1 when it does not verify.
sr_signer() {
  local out
  out="$("$APKSIGNER" verify --print-certs "$1" 2>&1)" || { printf '%s\n' "$out" >&2; return 1; }
  SIGNER_SHA256="$(printf '%s\n' "$out" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')"
  SIGNER_DN="$(printf '%s\n' "$out" | sed -n 's/^Signer #1 certificate DN: //p')"
  [ -n "$SIGNER_SHA256" ]
}

sr_sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
