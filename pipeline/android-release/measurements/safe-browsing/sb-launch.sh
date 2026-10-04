#!/bin/bash
# QA-52 Safe Browsing measurement: N cold launches (force-stop, clear, launch),
# each followed by 15 samples at 2 s (30 s) of every TCP socket on the device
# with its owning process and uid (`ss -tanpe`, under adb root). Raw captures:
#   <out>/<label>-launch-<i>.log   every sample, every socket, with timestamps
#   <out>/<label>-logcat-<i>.log   the launch's logcat (SafeBrowsing, WebView lines)
# Usage: sb-launch.sh <serial> <label> <n> <outdir>
set -u
ADB=/Users/developer/Library/Android/sdk/platform-tools/adb
SER=$1; LABEL=$2; N=${3:-3}; OUT=$4
PKG=com.dtgibson.snowraven
mkdir -p "$OUT"
$ADB -s "$SER" root >/dev/null 2>&1; sleep 2
$ADB -s "$SER" wait-for-device
UID_=$($ADB -s "$SER" shell cmd package list packages -U $PKG | grep -oE 'uid:[0-9]+' | head -1 | cut -d: -f2)
IMG=$($ADB -s "$SER" shell getprop ro.product.name | tr -d '\r')
WV=$($ADB -s "$SER" shell dumpsys webviewupdate | grep -m1 "Current WebView package" | tr -d '\r')
echo "serial $SER image $IMG uid $UID_ $WV"
for i in $(seq 1 "$N"); do
  F="$OUT/$LABEL-launch-$i.log"
  {
    echo "# image $IMG  app uid $UID_  $WV"
    echo "# $(date '+%Y-%m-%d %H:%M:%S') force-stop, clear"
  } > "$F"
  $ADB -s "$SER" shell am force-stop $PKG
  $ADB -s "$SER" shell pm clear $PKG >/dev/null
  $ADB -s "$SER" logcat -c
  sleep 1
  echo "# $(date '+%H:%M:%S') am start" >> "$F"
  $ADB -s "$SER" shell am start -W -n $PKG/.MainActivity | grep -E "TotalTime|Status" | tr '\n' ' ' >> "$F"; echo >> "$F"
  for s in $(seq 1 15); do
    PID=$($ADB -s "$SER" shell pidof $PKG | tr -d '\r')
    echo "== sample $s $(date '+%H:%M:%S') app pid ${PID:-none}" >> "$F"
    # every TCP socket, any state, with process and uid; the header line dropped
    $ADB -s "$SER" shell "ss -tanpe 2>/dev/null" | tail -n +2 | tr -d '\r' >> "$F"
    sleep 2
  done
  $ADB -s "$SER" logcat -d -v threadtime 2>/dev/null | grep -iE "safebrowsing|safe_browsing|SafeBrowsing|webview|chromium|cr_|variations|component" > "$OUT/$LABEL-logcat-$i.log"
  echo "launch $i done: $(grep -c '^== sample' "$F") samples"
done
