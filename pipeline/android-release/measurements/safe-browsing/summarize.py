#!/usr/bin/env python3
"""Summarize sb-launch.sh captures: per launch, every remote peer seen, with the
owning process name, pid and uid, the number of 2 s samples it appeared in, and
the whois owner of the address (cached). Usage: summarize.py <capture.log>..."""
import re, subprocess, sys, json, os
from collections import defaultdict

CACHE = os.path.join(os.path.dirname(__file__), 'whois-cache.json')
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

def owner(ip):
    if ip in cache: return cache[ip]
    try:
        out = subprocess.run(['whois', ip], capture_output=True, text=True, timeout=20).stdout
    except Exception:
        out = ''
    m = re.search(r'^(?:OrgName|org-name|owner|netname):\s*(.+)$', out, re.M | re.I)
    cache[ip] = m.group(1).strip() if m else '?'
    json.dump(cache, open(CACHE, 'w'), indent=1)
    return cache[ip]

LINE = re.compile(r'^(\S+)\s+\d+\s+\d+\s+(\S+)\s+(\S+)(.*)$')
for path in sys.argv[1:]:
    peers = defaultdict(lambda: {'samples': set(), 'procs': set(), 'states': set()})
    app_uid = None; samples = 0; header = ''
    for raw in open(path):
        line = raw.rstrip('\n')
        if line.startswith('# image'):
            header = line[2:]; m = re.search(r'app uid (\d+)', line); app_uid = m.group(1) if m else None
        elif line.startswith('== sample'):
            samples += 1
        elif line.startswith('#') or line.startswith('TotalTime') or not line.strip():
            continue
        else:
            m = LINE.match(line)
            if not m: continue
            state, local, peer, rest = m.groups()
            if peer.startswith('127.') or peer.startswith('[::1]') or peer == '*:*' or peer.startswith('0.0.0.0'):
                continue
            if local.startswith('127.') or local.startswith('[::1]') : continue
            uid = re.search(r'uid:(\d+)', rest); uid = uid.group(1) if uid else '0'
            procs = re.findall(r'\("([^"]*)",pid=(\d+)', rest)
            proc = ','.join(f'{n}[{p}]' for n, p in procs) or '-'
            ip = re.sub(r'^\[::ffff:([\d.]+)\]$', r'\1', peer.rsplit(':', 1)[0])
            port = peer.rsplit(':', 1)[1]
            key = (f'{ip}:{port}', uid)
            peers[key]['samples'].add(samples); peers[key]['procs'].add(proc); peers[key]['states'].add(state)
    print(f'## {os.path.basename(path)}  ({samples} samples)  {header}')
    rows = []
    for (peer, uid), d in sorted(peers.items(), key=lambda kv: (kv[0][1] != app_uid, kv[0][1], kv[0][0])):
        ip = peer.rsplit(':', 1)[0]
        rows.append((peer, uid, '; '.join(sorted(d['procs'])), len(d['samples']), ','.join(sorted(d['states'])), owner(ip)))
    print('| peer | uid | process[pid] | samples | states | whois owner |')
    print('|---|---|---|---|---|---|')
    for r in rows:
        flag = ' **(app uid)**' if r[1] == app_uid else ''
        print(f'| {r[0]} | {r[1]}{flag} | {r[2]} | {r[3]}/{samples} | {r[4]} | {r[5]} |')
    app_rows = [r for r in rows if r[1] == app_uid]
    goog = [r for r in app_rows if 'google' in r[5].lower()]
    print(f'\napp uid {app_uid}: {len(app_rows)} peer(s), {len(goog)} Google-owned\n')
