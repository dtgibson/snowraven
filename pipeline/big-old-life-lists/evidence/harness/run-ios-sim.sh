#!/bin/sh
# Mobile Safari in an iOS 27 simulator, the same WebKit as the iPhone and iPad
# apps' WKWebView. Needs serve.mjs on <port>; the simulator shares the Mac's
# loopback, which Safari reaches as localhost. Peak memory is the simulator's
# WebContent process resident size (a host process, read with ps every 0.2 s).
# Usage: run-ios-sim.sh <port> <udid> <page results.jsonl> <out.jsonl> <csv> <shape>
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
P=$1; U=$2; RES=$3; OUT=$4; CSV=$5; SHAPE=$6
xcrun simctl terminate "$U" com.apple.mobilesafari >/dev/null 2>&1
sleep 2
before=$(grep -c iPhone "$RES" 2>/dev/null || echo 0)
xcrun simctl openurl "$U" "http://localhost:$P/page.html?csv=$CSV&shape=$SHAPE&release=1"
peak=0
i=0
while [ $i -lt 3000 ]; do
  r=$(ps -axo rss=,args= | grep "iOS 27.0.simruntime" | grep WebContent | grep -v grep | awk '{print $1}' | sort -n | tail -1)
  [ -n "$r" ] && [ "$r" -gt "$peak" ] && peak=$r
  now=$(grep -c iPhone "$RES" 2>/dev/null || echo 0)
  [ "$now" -gt "$before" ] && break
  sleep 0.2; i=$((i+1))
done
line=$(grep iPhone "$RES" | tail -1)
echo "{\"engine\":\"ios-sim-safari\",\"peakWebContentRssMB\":$((peak/1024)),\"result\":$line}" >> "$OUT"
echo "{\"engine\":\"ios-sim-safari\",\"peakWebContentRssMB\":$((peak/1024)),\"csv\":\"$CSV\",\"shape\":\"$SHAPE\"}"
