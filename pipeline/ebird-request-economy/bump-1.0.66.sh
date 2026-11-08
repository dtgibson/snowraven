#!/usr/bin/env bash
# bump-1.0.66.sh: the version set for 1.0.66 (ebird-request-economy), split the way
# CLAUDE.md's copy rule requires.
#
# The Engineer already wrote the five files of the six-file set that are not
# published copy: frontend/package.json (and its lockfile's two "frontend" lines),
# src-tauri/tauri.conf.json (version 1.0.66, bundle.android.versionCode 1000066),
# CHANGELOG.md (the 1.0.66 entry), website/index.html (the version pill, its
# aria-label and the footer line, nothing else) and the in-repo F-Droid recipe
# (three Builds entries, CurrentVersion 1.0.66, CurrentVersionCode 10000664; the
# three `commit:` lines are LEFT on 1.0.65's commit, because a commit cannot carry
# its own hash, so they move after the v1.0.66 tag exists, as at 1.0.65).
#
# What is left is HELD published copy, written only after the user's explicit yes:
#
#     bash pipeline/ebird-request-economy/bump-1.0.66.sh            # check: writes nothing
#     bash pipeline/ebird-request-economy/bump-1.0.66.sh held       # items 1 and 2, guards, F-Droid
#     bash pipeline/ebird-request-economy/bump-1.0.66.sh held --offered   # ...and item 3
#
# `held` writes, from held-copy.md and held/ (pipeline/ebird-request-economy/):
#   1. PRIVACY_POLICY.md and website/privacy.html: privacy items 1 and 2 (and 3 with
#      --offered), each "Before" line replaced by its "After" line, identically in both;
#   2. frontend/src/lib/hotspotSharePublishedClaims.test.ts replaced by the held revision
#      (refused unless the live file is byte-identical to HEAD's), and the new guard
#      frontend/src/lib/escapeeRetentionPublishedClaims.test.ts (with --offered, also
#      frontend/src/lib/hotspotActivityRetentionPublishedClaims.test.ts);
#   3. fastlane/metadata/android/en-US/changelogs/10000661.txt, 10000662.txt, 10000664.txt:
#      held/whats-new.txt byte for byte (none under the unsplit 1000066).
#   RELEASE_DATE=YYYY-MM-DD also re-dates the CHANGELOG heading, if the ship slipped a day.
#
# Refuses, changing nothing, when: the five stamped files are not consistently at
# 1.0.66; held-copy.md's text fails its own stated facts (length, SHA-256, ASCII, no em
# dash) or disagrees with held/whats-new.txt; a "Before" line does not occur exactly once
# in each policy file; any held item is already partly applied; or the live guard is not
# HEAD's. A second run after a complete one exits 3. Every check runs before the first
# write, and each file is replaced atomically. BUMP_ROOT=<dir> runs it against a scratch
# copy of the repo instead (how the held patch was proved before the yes).
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=${BUMP_ROOT:-$(cd "$HERE/../.." && pwd)}
MODE=${1:-check}
OFFERED=${2:-}
case "$MODE" in check|held) ;; *) echo "usage: $0 [check | held [--offered]]"; exit 2 ;; esac
case "$OFFERED" in ''|--offered) ;; *) echo "usage: $0 [check | held [--offered]]"; exit 2 ;; esac
SNAP=$(mktemp -d "${TMPDIR:-/tmp}/bump-1.0.66.XXXXXX")
trap 'rm -rf "$SNAP"' EXIT

echo "bump-1.0.66: root $ROOT, mode $MODE${OFFERED:+ $OFFERED}"

python3 -I - "$ROOT" "$HERE" "$MODE" "$OFFERED" "${RELEASE_DATE:-}" "$SNAP" <<'PY'
import datetime
import difflib
import hashlib
import json
import os
import re
import sys

ROOT, HERE, MODE, OFFERED, RELEASE_DATE, SNAP = sys.argv[1:7]
WITH_OFFERED = OFFERED == '--offered'
NEW, PREV = '1.0.66', '1.0.65'
NEW_CODE = 1000066
ABI = (1, 2, 4)
LANE = 'fastlane/metadata/android/en-US/changelogs'
RECIPE = 'pipeline/android-release/fdroid/com.dtgibson.snowraven.yml'
PKG, LOCK, CONF = 'frontend/package.json', 'frontend/package-lock.json', 'src-tauri/tauri.conf.json'
SITE, LOG = 'website/index.html', 'CHANGELOG.md'
POLICIES = ('PRIVACY_POLICY.md', 'website/privacy.html')
GUARD = 'frontend/src/lib/hotspotSharePublishedClaims.test.ts'
GUARD_HEAD_BLOB = 'bdf64151bf3655c5158ce6c9be302b129e2a44e5'
NEW_GUARDS = {'frontend/src/lib/escapeeRetentionPublishedClaims.test.ts': 'escapeeRetentionPublishedClaims.test.ts'}
OFFERED_GUARD = ('frontend/src/lib/hotspotActivityRetentionPublishedClaims.test.ts',
                 'hotspotActivityRetentionPublishedClaims.test.ts')


def refuse(msg, code=2):
    print(f'REFUSED: {msg}')
    print('Nothing was changed.')
    sys.exit(code)


def path(p):
    return os.path.join(ROOT, p)


def read(p, base=None):
    with open(os.path.join(base or ROOT, p), encoding='utf-8', newline='') as f:
        return f.read()


def blob(text):
    b = text.encode('utf-8')
    return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()


# --- The five stamped files (written by the Engineer) --------------------------
problems = []
pkg = json.loads(read(PKG))
lock = json.loads(read(LOCK))
conf = json.loads(read(CONF))
if pkg['version'] != NEW:
    problems.append(f'{PKG} is {pkg["version"]}')
if lock['version'] != NEW or lock['packages']['']['version'] != NEW:
    problems.append(f'{LOCK} is {lock["version"]} / {lock["packages"][""]["version"]}')
if conf['version'] != NEW or conf['bundle']['android']['versionCode'] != NEW_CODE:
    problems.append(f'{CONF} is {conf["version"]} / {conf["bundle"]["android"]["versionCode"]}')
site = read(SITE)
for needle in (f'aria-label="Version {NEW}">v{NEW}</span>', f'SnowRaven v{NEW} \u00b7 Free'):
    if site.count(needle) != 1:
        problems.append(f'{SITE} does not carry {needle!r} exactly once')
if PREV in site:
    problems.append(f'{SITE} still carries {PREV}')
log = read(LOG)
top = re.search(r'^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$', log, flags=re.M)
if not top or top.group(1) != NEW:
    problems.append(f'the top entry of {LOG} is not ## [{NEW}]')
rec = read(RECIPE)
if len(re.findall(rf'^  - versionName: {re.escape(NEW)}$', rec, flags=re.M)) != 3:
    problems.append(f'{RECIPE}: not three Builds entries at {NEW}')
for a in ABI:
    if len(re.findall(rf'^    versionCode: {NEW_CODE * 10 + a}$', rec, flags=re.M)) != 1:
        problems.append(f'{RECIPE}: no Builds entry with versionCode {NEW_CODE * 10 + a}')
if not re.search(rf'^CurrentVersion: {re.escape(NEW)}$', rec, flags=re.M) \
        or not re.search(rf'^CurrentVersionCode: {NEW_CODE * 10 + 4}$', rec, flags=re.M):
    problems.append(f'{RECIPE}: CurrentVersion/CurrentVersionCode are not {NEW}/{NEW_CODE * 10 + 4}')
commits = set(re.findall(r'^    commit: (\S+)$', rec, flags=re.M))
if len(commits) != 1 or not re.fullmatch(r'[0-9a-f]{40}', next(iter(commits), '')):
    problems.append(f'{RECIPE}: the Builds entries do not name one full commit hash ({sorted(commits)})')
if problems:
    refuse('the stamped set is not consistently at 1.0.66:\n  - ' + '\n  - '.join(problems))
print(f'  stamped set at {NEW}: package, lockfile, tauri.conf (versionCode {NEW_CODE}), '
      f'website pill and footer, CHANGELOG ({top.group(2)}), recipe')
print(f'  recipe commit lines: {next(iter(commits))} (set them to v{NEW}^{{commit}} after the tag)')

# --- The held text ------------------------------------------------------------
held = read('held-copy.md', HERE)
lines = held.split('\n')


def section(prefix):
    i = next((k for k, l in enumerate(lines) if l.startswith(prefix)), None)
    if i is None:
        refuse(f'held-copy.md has no heading starting {prefix!r}')
    out = []
    for l in lines[i + 1:]:
        if l.startswith('## '):
            break
        out.append(l)
    return out


def quoted(sec, after_marker=None):
    start = 0
    if after_marker is not None:
        try:
            start = sec.index(after_marker) + 1
        except ValueError:
            refuse(f'held-copy.md: no {after_marker!r} line where expected')
    for l in sec[start:]:
        if l.startswith('> '):
            return l[2:]
    refuse(f'held-copy.md: no quoted line after {after_marker!r}')


ITEMS = {}
for n in (1, 2, 3):
    sec = section(f'## Privacy item {n} ')
    ITEMS[n] = (quoted(sec, 'Before:'), quoted(sec, 'After:'))
fdroid = quoted(section('## Proposed F-Droid changelog'))
appstore = quoted(section('## Proposed App Store'))
fbytes = (fdroid + '\n').encode('utf-8')
fsha = hashlib.sha256(fbytes).hexdigest()
stated_sha = re.search(r"SHA-256 of each file's exact bytes: `([0-9a-f]{64})`", held)
stated_chars = re.search(r'^- (\d+) characters, under the 500', held, flags=re.M)
if not stated_sha or stated_sha.group(1) != fsha:
    refuse(f'the F-Droid text hashes to {fsha}, not the SHA-256 held-copy.md states; '
           'if the wording changed at the gate, update the stated facts first')
if not stated_chars or int(stated_chars.group(1)) != len(fdroid):
    refuse(f'the F-Droid text is {len(fdroid)} characters, not the count held-copy.md states')
if fdroid != appstore:
    refuse('the held F-Droid and App Store texts differ; held-copy.md says they are the same')
with open(os.path.join(HERE, 'held/whats-new.txt'), 'rb') as f:
    if f.read() != fbytes:
        refuse('held/whats-new.txt is not the held-copy.md text plus one newline')
if not 0 < len(fdroid) <= 500 or any(b >= 0x80 for b in fbytes) or fdroid != fdroid.strip():
    refuse('the F-Droid text is empty, over 500 characters, non-ASCII, or has edge spaces')
for n, (before, after) in ITEMS.items():
    for t in (before, after):
        if '\u2014' in t or '\r' in t or not t or t != t.strip():
            refuse(f'privacy item {n}: a line is empty, has edge spaces, an em dash or a carriage return')
    if before == after:
        refuse(f'privacy item {n}: Before and After are the same')

# --- Where each held item stands ----------------------------------------------
policy = {p: read(p) for p in POLICIES}
state = {}  # item -> 'todo' | 'done'
for n in (1, 2, 3):
    before, after = ITEMS[n]
    seen = set()
    for p, text in policy.items():
        b, a = text.count(before), text.count(after)
        if (b, a) == (1, 0):
            seen.add('todo')
        elif (b, a) == (0, 1):
            seen.add('done')
        else:
            refuse(f'{p}: privacy item {n} occurs as Before {b} and After {a} times; expected 1/0 or 0/1')
    if len(seen) != 1:
        refuse(f'privacy item {n} is applied in one policy file and not the other')
    state[n] = seen.pop()

guard_live = read(GUARD)
guard_held = read('held/hotspotSharePublishedClaims.test.ts', HERE)
if blob(guard_live) == GUARD_HEAD_BLOB:
    guard_state = 'todo'
elif guard_live == guard_held:
    guard_state = 'done'
else:
    refuse(f'{GUARD} is neither HEAD\'s (blob {GUARD_HEAD_BLOB}) nor the held revision')

install_state = {}
for dst, src in list(NEW_GUARDS.items()) + [OFFERED_GUARD]:
    if not os.path.lexists(path(dst)):
        install_state[dst] = 'todo'
    elif read(dst) == read(f'held/{src}', HERE):
        install_state[dst] = 'done'
    else:
        refuse(f'{dst} exists and is not the held file')

lane_state = {}
for a in ABI:
    p = f'{LANE}/{NEW_CODE * 10 + a}.txt'
    if not os.path.lexists(path(p)):
        lane_state[p] = 'todo'
    else:
        with open(path(p), 'rb') as f:
            if f.read() != fbytes:
                refuse(f'{p} exists with other bytes')
        lane_state[p] = 'done'
if os.path.lexists(path(f'{LANE}/{NEW_CODE}.txt')):
    refuse(f'{LANE}/{NEW_CODE}.txt exists; F-Droid reads only the per-processor codes')

print('\n  held items:')
for n in (1, 2, 3):
    print(f'    privacy item {n}{" (offered)" if n == 3 else ""}: {"applied" if state[n] == "done" else "not applied"}')
print(f'    {GUARD}: {"held revision" if guard_state == "done" else "HEAD (not applied)"}')
for dst, st in install_state.items():
    print(f'    {dst}: {"installed" if st == "done" else "absent (not applied)"}')
for p, st in lane_state.items():
    print(f'    {p}: {"written" if st == "done" else "absent (not applied)"}')

if MODE == 'check':
    today = datetime.date.today().isoformat()
    if top.group(2) != today:
        print(f'\n  NOTE: the CHANGELOG heading is dated {top.group(2)}, not today ({today}); '
              'RELEASE_DATE=YYYY-MM-DD with `held` re-dates it.')
    print('\nbump-1.0.66: check only, nothing written.')
    sys.exit(0)

# --- `held`: decide, all or nothing per group -----------------------------------
# Two groups, each all-applied or all-not: the REQUIRED one (items 1 and 2, the
# revised and the new guard, the three F-Droid files) and the OFFERED one (item 3
# and its guard). So item 3 may be approved after the required group has landed.
required = [state[1], state[2], guard_state] + [install_state[d] for d in NEW_GUARDS] + list(lane_state.values())
offered = [state[3], install_state[OFFERED_GUARD[0]]]
for name, group in (('required', required), ('offered', offered)):
    if len(set(group)) != 1:
        refuse(f'the {name} held items are partly applied; inspect `git status` and restore the files '
               'to HEAD (or finish them by hand) before running this again')
do_required = required[0] == 'todo'
do_offered = WITH_OFFERED and offered[0] == 'todo'
if offered[0] == 'done' and not WITH_OFFERED:
    print('  (privacy item 3 and its guard are already applied)')
if not do_required and not do_offered and not RELEASE_DATE:
    refuse('every selected held item is already applied: nothing to do.', code=3)
applying = ([1, 2] if do_required else []) + ([3] if do_offered else [])

out = {}
if applying:
    for p, text in policy.items():
        for n in applying:
            before, after = ITEMS[n]
            text = text.replace(before, after)
        out[p] = text
if do_required:
    out[GUARD] = guard_held
    for dst, src in NEW_GUARDS.items():
        out[dst] = read(f'held/{src}', HERE)
    for p in lane_state:
        out[p] = fdroid + '\n'
if do_offered:
    out[OFFERED_GUARD[0]] = read(f'held/{OFFERED_GUARD[1]}', HERE)
if RELEASE_DATE:
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', RELEASE_DATE):
        refuse(f'RELEASE_DATE {RELEASE_DATE!r} is not YYYY-MM-DD')
    out[LOG] = log.replace(f'## [{NEW}] - {top.group(2)}\n', f'## [{NEW}] - {RELEASE_DATE}\n', 1)

# Post-conditions on the new texts, before anything is written.
if applying:
    for p in POLICIES:
        for n in applying:
            assert out[p].count(ITEMS[n][1]) == 1 and ITEMS[n][0] not in out[p]
        assert '\u2014' not in ''.join(ITEMS[n][1] for n in applying)

for p in out:
    snap = os.path.join(SNAP, p)
    os.makedirs(os.path.dirname(snap), exist_ok=True)
    if os.path.exists(path(p)):
        with open(path(p), 'rb') as s_, open(snap, 'wb') as d_:
            d_.write(s_.read())
for p, text in out.items():
    os.makedirs(os.path.dirname(path(p)), exist_ok=True)
    tmp = path(p) + '.bump-tmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    os.replace(tmp, path(p))

print('\nbump-1.0.66: written')
for p in out:
    snap = os.path.join(SNAP, p)
    before = open(snap, encoding='utf-8', newline='').read().splitlines() if os.path.exists(snap) else []
    after = out[p].splitlines()
    add = sum(1 for d in difflib.unified_diff(before, after, lineterm='', n=0) if d.startswith('+') and not d.startswith('+++'))
    dl = sum(1 for d in difflib.unified_diff(before, after, lineterm='', n=0) if d.startswith('-') and not d.startswith('---'))
    print(f'  {p:<72} +{add} -{dl}{"  (new)" if not before else ""}')
print(f'\n  F-Droid text: {len(fdroid)} characters, {len(fbytes)} bytes per file, SHA-256 {fsha}')
print(f'  App Store What\'s New: the same {len(appstore)} characters, without the newline')
PY

cat <<'NEXT'

Next, from frontend/ (the held guards, the version-set guards, then the full suite):
  npx vitest run src/lib/hotspotSharePublishedClaims.test.ts src/lib/escapeeRetentionPublishedClaims.test.ts \
    src/lib/privacyPageParity.test.ts src/lib/fastlaneMetadata.test.ts src/lib/fdroidRecipe.test.ts \
    src/lib/androidVersionSource.test.ts src/lib/icloudKeysPublishedClaims.test.ts src/lib/iosSceneManifest.test.ts
  (with --offered, add src/lib/hotspotActivityRetentionPublishedClaims.test.ts)
  npx vitest run && npm run typecheck && npm run build
NEXT
