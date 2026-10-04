#!/bin/bash
# M2 measurement: does the app's process bind Play services' font provider at
# launch? Usage: measure-emoji.sh <apk> <label>  (emulator-5554, Google APIs API 36)
# Method (the security report's): an idle control window with the app force-
# stopped, then a cold launch; count "Noto Color Emoji Compat" queries in logcat
# in each window, and read `dumpsys activity providers` for the FontsProvider's
# client connections after the launch.
set -u
A=/Users/developer/Library/Android/sdk/platform-tools/adb
S=emulator-5554
PKG=com.dtgibson.snowraven
APK=$1; LABEL=$2
OUT=/private/tmp/claude-502/-Users-developer-devwork-snowraven/1890b5dd-4eff-4f7c-a0b4-9ae2413dac4b/scratchpad/m2/$LABEL
mkdir -p "$OUT"
{
echo "== $LABEL  $(date '+%Y-%m-%d %H:%M:%S')"
echo "APK sha256: $(shasum -a 256 "$APK" | awk '{print $1}')"
"$A" -s "$S" shell getprop ro.build.fingerprint
"$A" -s "$S" shell dumpsys webviewupdate | grep -E "Current WebView package" | head -1
"$A" -s "$S" uninstall "$PKG" >/dev/null 2>&1
"$A" -s "$S" install -r "$APK" 2>&1 | tail -1
"$A" -s "$S" shell am force-stop "$PKG"
"$A" -s "$S" shell input keyevent KEYCODE_HOME
sleep 3
"$A" -s "$S" logcat -c
sleep 20
echo "CONTROL (20 s idle, app stopped): emoji-compat font queries = $("$A" -s "$S" logcat -d | grep -ciE 'Noto Color Emoji Compat')"
echo "CONTROL FontsProvider connections from the app:"
"$A" -s "$S" shell dumpsys activity providers 2>/dev/null | grep -A8 -iE 'gms\.fonts|FontsProvider' | grep -E "$PKG" || echo "  none"
"$A" -s "$S" logcat -c
"$A" -s "$S" shell am start -W -n "$PKG/.MainActivity" | grep -E 'Status|TotalTime'
for t in 1 2 3 5 8; do
  sleep 1; [ "$t" -gt 3 ] && sleep 1
  C="$("$A" -s "$S" shell dumpsys activity providers 2>/dev/null | grep -A12 -E 'com\.google\.android\.gms/\.fonts\.provider\.FontsProvider\}' | grep -E "Connections|-> [0-9]+:$PKG" | tr -s ' ' | tr '\n' ' ')"
  echo "  providers sample ~${t}s: ${C:-no Connections line}"
done
sleep 3
APP_PID="$("$A" -s "$S" shell pidof "$PKG" | tr -d '\r')"
echo "APP pid $APP_PID"
echo "LAUNCH (12 s after cold start): logcat lines naming Noto Color Emoji Compat = $("$A" -s "$S" logcat -d | grep -ciE 'Noto Color Emoji Compat')"
echo "LAUNCH: androidx emoji2's own query string [emojicompat-emoji-font] = $("$A" -s "$S" logcat -d | grep -c 'emojicompat-emoji-font')"
echo "logcat lines naming emoji or the font provider:"
"$A" -s "$S" logcat -d | grep -iE 'Noto Color Emoji|emojicompat|FontsProvider|gms\.fonts' | cut -c1-220 | head -12
echo "dumpsys activity providers, the FontsProvider block:"
"$A" -s "$S" shell dumpsys activity providers 2>/dev/null | grep -A10 -iE 'com\.google\.android\.gms/\.fonts\.provider\.FontsProvider' | head -14
echo "FontsProvider connections from the app after launch:"
"$A" -s "$S" shell dumpsys activity providers 2>/dev/null | grep -A10 -iE 'gms\.fonts|FontsProvider' | grep -E "$PKG" || echo "  none"
"$A" -s "$S" exec-out screencap -p > "$OUT/after-launch.png" && echo "screenshot: $OUT/after-launch.png"
"$A" -s "$S" logcat -d > "$OUT/logcat-launch.txt"
"$A" -s "$S" shell dumpsys activity providers > "$OUT/providers-after-launch.txt" 2>/dev/null
"$A" -s "$S" shell am force-stop "$PKG"
echo "== end $LABEL"
} 2>&1 | tee "$OUT/measure.log"
