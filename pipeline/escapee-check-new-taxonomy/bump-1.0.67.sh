#!/usr/bin/env bash
# bump-1.0.67.sh: the version set for 1.0.67 (escapee-check-new-taxonomy), split the
# way CLAUDE.md's copy rule requires.
#
# The Deployer's prep wrote the five files of the six-file set that are not published
# copy: frontend/package.json (and its lockfile's two "frontend" lines),
# src-tauri/tauri.conf.json (version 1.0.67, bundle.android.versionCode 1000067),
# CHANGELOG.md (the 1.0.67 entry), website/index.html (the version pill, its aria-label
# and the footer line, nothing else) and the in-repo F-Droid recipe (three Builds
# entries, CurrentVersion 1.0.67, CurrentVersionCode 10000674; the three `commit:` lines
# are LEFT on 1.0.66's commit, because a commit cannot carry its own hash, so they move
# after the v1.0.67 tag exists, as at every ship since 1.0.53).
#
# What is left is HELD published copy, written only after the user's explicit yes:
#
#     bash pipeline/escapee-check-new-taxonomy/bump-1.0.67.sh         # check: writes nothing
#     bash pipeline/escapee-check-new-taxonomy/bump-1.0.67.sh held    # the three F-Droid files
#
# `held` writes fastlane/metadata/android/en-US/changelogs/10000671.txt, 10000672.txt and
# 10000674.txt as held/whats-new.txt byte for byte (none under the unsplit 1000067).
# RELEASE_DATE=YYYY-MM-DD with `held` also re-dates the CHANGELOG heading, if the ship
# slipped a day. A wording changed at the gate is written into held/whats-new.txt first
# (one line plus a newline, ASCII, at most 500 characters, no em dash), or this refuses.
# Refuses, changing nothing, when the five stamped files are not consistently at 1.0.67,
# when a changelog file already exists with other bytes, or when the unsplit file exists.
# A second run after a complete one exits 3. BUMP_ROOT=<dir> runs it against a scratch copy.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=${BUMP_ROOT:-$(cd "$HERE/../.." && pwd)}
MODE=${1:-check}
case "$MODE" in check|held) ;; *) echo "usage: $0 [check | held]"; exit 2 ;; esac
echo "bump-1.0.67: root $ROOT, mode $MODE"

python3 -I - "$ROOT" "$HERE" "$MODE" "${RELEASE_DATE:-}" <<'PY'
import datetime, hashlib, json, os, re, sys

ROOT, HERE, MODE, RELEASE_DATE = sys.argv[1:5]
NEW, PREV, NEW_CODE, ABI = '1.0.67', '1.0.66', 1000067, (1, 2, 4)
LANE = 'fastlane/metadata/android/en-US/changelogs'
RECIPE = 'pipeline/android-release/fdroid/com.dtgibson.snowraven.yml'
PKG, LOCK, CONF = 'frontend/package.json', 'frontend/package-lock.json', 'src-tauri/tauri.conf.json'
SITE, LOG = 'website/index.html', 'CHANGELOG.md'


def refuse(msg, code=2):
    print(f'REFUSED: {msg}\nNothing was changed.')
    sys.exit(code)


def path(p):
    return os.path.join(ROOT, p)


def read(p):
    with open(path(p), encoding='utf-8', newline='') as f:
        return f.read()


problems = []
pkg, lock, conf = json.loads(read(PKG)), json.loads(read(LOCK)), json.loads(read(CONF))
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
    refuse(f'the stamped set is not consistently at {NEW}:\n  - ' + '\n  - '.join(problems))
print(f'  stamped set at {NEW}: package, lockfile, tauri.conf (versionCode {NEW_CODE}), '
      f'website pill and footer, CHANGELOG ({top.group(2)}), recipe')
print(f'  recipe commit lines: {next(iter(commits))} (set them to v{NEW}^{{commit}} after the tag)')

with open(os.path.join(HERE, 'held/whats-new.txt'), 'rb') as f:
    fbytes = f.read()
text = fbytes.decode('utf-8')
if not text.endswith('\n') or '\n' in text[:-1] or text[:-1] != text[:-1].strip():
    refuse('held/whats-new.txt is not one line plus a newline, without edge spaces')
note = text[:-1]
if not 0 < len(note) <= 500 or any(b >= 0x80 for b in fbytes) or '\u2014' in note:
    refuse('held/whats-new.txt is empty, over 500 characters, non-ASCII, or has an em dash')
fsha = hashlib.sha256(fbytes).hexdigest()
print(f'  held note: {len(note)} characters, {len(fbytes)} bytes, SHA-256 {fsha}')

state = {}
for a in ABI:
    p = f'{LANE}/{NEW_CODE * 10 + a}.txt'
    if not os.path.lexists(path(p)):
        state[p] = 'todo'
    else:
        with open(path(p), 'rb') as f:
            if f.read() != fbytes:
                refuse(f'{p} exists with other bytes')
        state[p] = 'done'
if os.path.lexists(path(f'{LANE}/{NEW_CODE}.txt')):
    refuse(f'{LANE}/{NEW_CODE}.txt exists; F-Droid reads only the per-processor codes')
for p, st in state.items():
    print(f'    {p}: {"written" if st == "done" else "absent (not applied)"}')

if MODE == 'check':
    today = datetime.date.today().isoformat()
    if top.group(2) != today:
        print(f'\n  NOTE: the CHANGELOG heading is dated {top.group(2)}, not today ({today}); '
              'RELEASE_DATE=YYYY-MM-DD with `held` re-dates it.')
    print('\nbump-1.0.67: check only, nothing written.')
    sys.exit(0)

if len(set(state.values())) != 1:
    refuse('the three changelog files are partly written; restore them before running this again')
todo = next(iter(state.values())) == 'todo'
if not todo and not RELEASE_DATE:
    refuse('the three changelog files are already written: nothing to do.', code=3)
out = {}
if todo:
    for p in state:
        out[p] = fbytes
if RELEASE_DATE:
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', RELEASE_DATE):
        refuse(f'RELEASE_DATE {RELEASE_DATE!r} is not YYYY-MM-DD')
    out[LOG] = log.replace(f'## [{NEW}] - {top.group(2)}\n', f'## [{NEW}] - {RELEASE_DATE}\n', 1).encode('utf-8')
for p, b in out.items():
    tmp = path(p) + '.bump-tmp'
    with open(tmp, 'wb') as f:
        f.write(b)
    os.replace(tmp, path(p))
print('\nbump-1.0.67: written')
for p in out:
    print(f'  {p}')
PY

cat <<'NEXT'

Next, from frontend/:
  npx vitest run src/lib/fastlaneMetadata.test.ts src/lib/fdroidRecipe.test.ts src/lib/androidVersionSource.test.ts \
    src/lib/icloudKeysPublishedClaims.test.ts src/lib/iosSceneManifest.test.ts
  npx vitest run && npm run typecheck && npm run build
NEXT
