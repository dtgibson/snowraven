#!/bin/sh
# Chrome 133 on the API 36 emulator (the same Chromium as the Android app's
# System WebView 133). Needs serve.mjs on <port>; the emulator reaches the
# Mac's loopback as 10.0.2.2. Peak memory is the renderer's resident size
# (Chrome's sandboxed_process, read with ps through adb about twice a second).
# One-time setup (as root): /data/local/tmp/chrome-command-line with
# "_ --disable-fre --no-default-browser-check --no-first-run", and
# am set-debug-app --persistent com.android.chrome.
# Usage: run-android.sh <port> <page results.jsonl> <out.jsonl> <csv> <shape>
A=~/Library/Android/sdk/platform-tools/adb
P=$1; RES=$2; OUT=$3; CSV=$4; SHAPE=$5
$A shell am force-stop com.android.chrome
sleep 2
before=$(grep -c Android "$RES" 2>/dev/null || echo 0)
$A shell am start -a android.intent.action.VIEW -d "http://10.0.2.2:$P/page.html?csv=$CSV\&shape=$SHAPE\&release=1" com.android.chrome >/dev/null
peak=0; crashed=0; i=0
while [ $i -lt 2400 ]; do
  r=$($A shell ps -A -o RSS,NAME 2>/dev/null | grep sandboxed_process | awk '{print $1}' | sort -n | tail -1)
  [ -n "$r" ] && [ "$r" -gt "$peak" ] && peak=$r
  now=$(grep -c Android "$RES" 2>/dev/null || echo 0)
  [ "$now" -gt "$before" ] && break
  sleep 0.3; i=$((i+1))
done
if [ "$now" -gt "$before" ]; then line=$(grep Android "$RES" | tail -1); else line='{"error":"no result: the page did not finish (renderer killed or timed out)"}'; fi
echo "{\"engine\":\"android-emu-chrome133\",\"csv\":\"$CSV\",\"shape\":\"$SHAPE\",\"peakRendererRssMB\":$((peak/1024)),\"result\":$line}" >> "$OUT"
echo "{\"engine\":\"android-emu-chrome133\",\"csv\":\"$CSV\",\"shape\":\"$SHAPE\",\"peakRendererRssMB\":$((peak/1024))}"
