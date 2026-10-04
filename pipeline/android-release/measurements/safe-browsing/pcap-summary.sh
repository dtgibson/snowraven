#!/bin/bash
# pcap-summary.sh <pcap>... : DNS names asked and TCP connection targets (IPv4 SYNs) per capture.
for f in "$@"; do
  echo "== $(basename "$f")"
  echo "DNS queries:"
  /usr/sbin/tcpdump -nn -r "$f" 2>/dev/null | grep -E "A\? |AAAA\? " | sed -E 's/.* (A|AAAA)\? ([^ ]+)\..*/  \1 \2/' | sort | uniq -c
  echo "TCP SYNs (IPv4):"
  /usr/sbin/tcpdump -nn -r "$f" 2>/dev/null | grep -E "Flags \[S\]" | grep -v "IP6" | awk '{print "  " $5 " > " $7}' | sort | uniq -c
  echo "TCP SYNs (IPv6, unreachable on the emulator):"
  /usr/sbin/tcpdump -nn -r "$f" 2>/dev/null | grep -E "Flags \[S\]" | grep "IP6" | awk '{print "  " $5 " > " $7}' | sort | uniq -c | wc -l
done
