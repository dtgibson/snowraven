#!/bin/bash
# pcap-launch.sh <serial> <label> : a cold launch (force-stop, clear, start) under an
# on-device tcpdump of DNS and TLS, pulled to out/<label>.pcap; prints the app's pid.
set -u
ADB=/Users/developer/Library/Android/sdk/platform-tools/adb
S=$1; L=$2; PKG=com.dtgibson.snowraven
O=/private/tmp/claude-502/-Users-developer-devwork-snowraven/1890b5dd-4eff-4f7c-a0b4-9ae2413dac4b/scratchpad/sb/out
$ADB -s "$S" root >/dev/null 2>&1; sleep 1; $ADB -s "$S" wait-for-device
$ADB -s "$S" shell am force-stop $PKG; $ADB -s "$S" shell pm clear $PKG >/dev/null
$ADB -s "$S" shell "rm -f /data/local/tmp/$L.pcap; nohup tcpdump -i any -s 0 -w /data/local/tmp/$L.pcap 'port 53 or port 443 or port 80' >/dev/null 2>&1 &"
sleep 3
echo "start $(date '+%H:%M:%S')"
$ADB -s "$S" shell am start -W -n $PKG/.MainActivity | grep -E "TotalTime"
sleep 20
$ADB -s "$S" shell "ss -tanpe | grep -E 'snowraven' | tr -s ' '"
$ADB -s "$S" shell pkill -INT tcpdump; sleep 2
$ADB -s "$S" pull /data/local/tmp/$L.pcap "$O/$L.pcap" >/dev/null && ls -la "$O/$L.pcap"
