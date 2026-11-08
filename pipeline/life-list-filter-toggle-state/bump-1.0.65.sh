#!/usr/bin/env bash
# bump-1.0.65.sh: the six-file version set for 1.0.65 (life-list-filter-toggle-state).
#
# Run it from the worktree root AFTER `git merge origin/main` has brought in the
# other session's 1.0.64 ship:
#
#     bash pipeline/life-list-filter-toggle-state/bump-1.0.65.sh
#
# What it writes (CLAUDE.md, Versioning: the six-file set):
#   1. frontend/package.json and frontend/package-lock.json (its two "frontend" lines)
#   2. src-tauri/tauri.conf.json: version 1.0.65 and bundle.android.versionCode 1000065
#   3. CHANGELOG.md: the held entry from held-copy.md, byte for byte, dated today
#      (local date; RELEASE_DATE=YYYY-MM-DD overrides), above the 1.0.64 entry
#   4. website/index.html: the version pill text, its aria-label and the footer line, nothing else
#   5. fastlane/metadata/android/en-US/changelogs/10000651.txt, 10000652.txt, 10000654.txt:
#      the held F-Droid text plus one newline each (none under the unsplit 1000065)
#   6. pipeline/android-release/fdroid/com.dtgibson.snowraven.yml: the three Builds entries'
#      versionName and versionCode, CurrentVersion 1.0.65 and CurrentVersionCode 10000654.
#      Its three `commit:` lines are LEFT on 1.0.64's commit: a commit cannot carry its own
#      hash, so they move after the v1.0.65 tag exists (the 1.0.63 ship's 9392ffc3 shape).
#
# Refuses, changing nothing, when:
#   - frontend/package.json is 1.0.63 (the merge has not happened, or brought no 1.0.64 bump);
#   - it is already 1.0.65 (a second run; exit 3);
#   - any file of the set is not consistently at 1.0.64, or any 1.0.65 target already exists;
#   - the held copy's text fails its own stated facts (length, SHA-256, ASCII, no em dash).
# Every check runs before the first write, and each file is replaced atomically.
#
# It prints a diff stat at the end, and the guard files to run next.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
DATE=${RELEASE_DATE:-$(date +%Y-%m-%d)}
SNAP=$(mktemp -d "${TMPDIR:-/tmp}/bump-1.0.65.XXXXXX")
trap 'rm -rf "$SNAP"' EXIT

echo "bump-1.0.65: root $ROOT"
echo "bump-1.0.65: release date $DATE"

python3 -I - "$ROOT" "$DATE" "$SNAP" <<'PY'
import difflib
import hashlib
import json
import os
import re
import sys

ROOT, DATE, SNAP = sys.argv[1], sys.argv[2], sys.argv[3]
PREV, NEW = '1.0.64', '1.0.65'
PREV_CODE, NEW_CODE = 1000064, 1000065
ABI = (1, 2, 4)
HELD = 'pipeline/life-list-filter-toggle-state/held-copy.md'
LANE = 'fastlane/metadata/android/en-US/changelogs'
RECIPE = 'pipeline/android-release/fdroid/com.dtgibson.snowraven.yml'
PKG, LOCK, CONF = 'frontend/package.json', 'frontend/package-lock.json', 'src-tauri/tauri.conf.json'
SITE, LOG = 'website/index.html', 'CHANGELOG.md'


def refuse(msg, code=2):
    print(f'REFUSED: {msg}')
    print('Nothing was changed.')
    sys.exit(code)


def path(p):
    return os.path.join(ROOT, p)


def read(p):
    with open(path(p), encoding='utf-8', newline='') as f:
        return f.read()


if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', DATE):
    refuse(f'release date {DATE!r} is not YYYY-MM-DD')

# --- The gate: where frontend/package.json stands ------------------------------
pkg_version = json.loads(read(PKG))['version']
if pkg_version == NEW:
    refuse('frontend/package.json is already 1.0.65: this script has run, or 1.0.65 was '
           'bumped another way. Check `git log -3` and `git status`.', code=3)
if pkg_version == '1.0.63':
    refuse('frontend/package.json is still 1.0.63, so origin/main has not been merged yet, '
           "or the merge did not bring the other session's 1.0.64 bump. Run "
           '`git fetch && git merge origin/main` once its 1.0.64 ship is on origin, then re-run.')
if pkg_version != PREV:
    refuse(f'frontend/package.json is {pkg_version}; this script moves 1.0.64 to 1.0.65 only.')


def sub_exact(text, pattern, repl, count, where):
    """Replace a regex exactly `count` times, or refuse."""
    new, n = re.subn(pattern, repl, text, flags=re.M)
    if n != count:
        refuse(f'{where}: expected {count} match(es) of {pattern!r}, found {n}')
    return new


out = {}  # repo path -> new text

# --- 1. frontend/package.json and its lockfile ---------------------------------
out[PKG] = sub_exact(read(PKG), r'^  "version": "1\.0\.64",$', '  "version": "1.0.65",', 1, PKG)
lock = read(LOCK)
lock = sub_exact(lock, r'\A\{\n  "name": "frontend",\n  "version": "1\.0\.64",\n',
                 '{\n  "name": "frontend",\n  "version": "1.0.65",\n', 1, LOCK)
lock = sub_exact(lock, r'^    "": \{\n      "name": "frontend",\n      "version": "1\.0\.64",$',
                 '    "": {\n      "name": "frontend",\n      "version": "1.0.65",', 1, LOCK)
out[LOCK] = lock

# --- 2. src-tauri/tauri.conf.json ----------------------------------------------
conf = read(CONF)
if json.loads(conf)['version'] != PREV or json.loads(conf)['bundle']['android']['versionCode'] != PREV_CODE:
    refuse(f'{CONF} is not at 1.0.64 / 1000064')
conf = sub_exact(conf, r'^  "version": "1\.0\.64",$', '  "version": "1.0.65",', 1, CONF)
conf = sub_exact(conf, r'^(\s*)"versionCode": 1000064$', r'\g<1>"versionCode": 1000065', 1, CONF)
out[CONF] = conf

# --- The held copy: the CHANGELOG entry and the store text ---------------------
held = read(HELD)
held_lines = held.split('\n')
try:
    start = held_lines.index('## [1.0.65] - (release date)')
except ValueError:
    refuse(f'{HELD} has no "## [1.0.65] - (release date)" line')
entry_lines = []
for line in held_lines[start:]:
    if entry_lines and line.startswith('## '):
        break
    entry_lines.append(line)
while entry_lines and entry_lines[-1] == '':
    entry_lines.pop()
entry_lines[0] = f'## [1.0.65] - {DATE}'
entry = '\n'.join(entry_lines) + '\n'
if '### Fixed' not in entry or '10000651.txt' not in entry or 'recipe names 1.0.65' not in entry:
    refuse('the held CHANGELOG entry is not the 1.0.65 entry it should be')
if '\u2014' in entry or '\r' in entry:
    refuse('the held CHANGELOG entry carries an em dash or a carriage return')


def quoted_after(prefix):
    i = next((k for k, l in enumerate(held_lines) if l.startswith(prefix)), None)
    if i is None:
        refuse(f'{HELD} has no heading starting {prefix!r}')
    for l in held_lines[i + 1:]:
        if l.startswith('## '):
            break
        if l.startswith('> '):
            return l[2:]
    refuse(f'{HELD} has no quoted text under {prefix!r}')


fdroid = quoted_after('## Proposed F-Droid changelog')
appstore = quoted_after('## Proposed App Store')
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
if not 0 < len(fdroid) <= 500 or any(b >= 0x80 for b in fbytes) or fdroid != fdroid.strip():
    refuse('the F-Droid text is empty, over 500 characters, non-ASCII, or has edge spaces')

# --- 3. CHANGELOG.md -----------------------------------------------------------
log = read(LOG)
if '## [1.0.65]' in log:
    refuse(f'{LOG} already has a 1.0.65 entry')
first = re.search(r'^## \[', log, flags=re.M)
if not first or not log.startswith('## [1.0.64] - ', first.start()):
    refuse(f'the top entry of {LOG} is not ## [1.0.64]')
if '\r' in log:
    refuse(f'{LOG} has carriage returns')
out[LOG] = log[:first.start()] + entry + '\n' + log[first.start():]

# --- 4. website/index.html (pill, aria-label, footer only) ---------------------
site = read(SITE)
if site.count('1.0.64') != 3:
    refuse(f'{SITE} carries 1.0.64 {site.count("1.0.64")} times; the stamp expects exactly 3')
site = sub_exact(site, re.escape('aria-label="Version 1.0.64">v1.0.64</span>'),
                 'aria-label="Version 1.0.65">v1.0.65</span>', 1, SITE)
site = sub_exact(site, re.escape('SnowRaven v1.0.64 \u00b7 Free'), 'SnowRaven v1.0.65 \u00b7 Free', 1, SITE)
out[SITE] = site

# --- 5. The three Fastlane changelogs ------------------------------------------
for a in ABI:
    if not os.path.isfile(path(f'{LANE}/{PREV_CODE * 10 + a}.txt')):
        refuse(f'{LANE}/{PREV_CODE * 10 + a}.txt is missing, so the 1.0.64 bump is incomplete')
for name in [f'{NEW_CODE * 10 + a}.txt' for a in ABI] + [f'{NEW_CODE}.txt']:
    if os.path.lexists(path(f'{LANE}/{name}')):
        refuse(f'{LANE}/{name} already exists')
for a in ABI:
    out[f'{LANE}/{NEW_CODE * 10 + a}.txt'] = fdroid + '\n'

# --- 6. The in-repo F-Droid recipe ---------------------------------------------
rec = read(RECIPE)
rec = sub_exact(rec, r'^  - versionName: 1\.0\.64$', '  - versionName: 1.0.65', 3, RECIPE)
for a in ABI:
    rec = sub_exact(rec, rf'^    versionCode: {PREV_CODE * 10 + a}$', f'    versionCode: {NEW_CODE * 10 + a}', 1, RECIPE)
rec = sub_exact(rec, r'^CurrentVersion: 1\.0\.64$', 'CurrentVersion: 1.0.65', 1, RECIPE)
rec = sub_exact(rec, rf'^CurrentVersionCode: {PREV_CODE * 10 + 4}$', f'CurrentVersionCode: {NEW_CODE * 10 + 4}', 1, RECIPE)
commits = set(re.findall(r'^    commit: (\S+)$', rec, flags=re.M))
if len(commits) != 1 or not re.fullmatch(r'[0-9a-f]{40}', next(iter(commits))):
    refuse(f'{RECIPE}: the Builds entries do not name one full commit hash ({sorted(commits)})')
out[RECIPE] = rec

# --- Post-conditions, checked on the new texts before anything is written -------
assert json.loads(out[PKG])['version'] == NEW
lk = json.loads(out[LOCK])
assert lk['version'] == NEW and lk['packages']['']['version'] == NEW
cf = json.loads(out[CONF])
assert cf['version'] == NEW and cf['bundle']['android']['versionCode'] == 1 * 1000000 + 0 * 1000 + 65
assert out[SITE].count('1.0.65') == 3 and '1.0.64' not in out[SITE]
assert f'CurrentVersionCode: {cf["bundle"]["android"]["versionCode"] * 10 + 4}\n' in out[RECIPE] + '\n'
assert out[LOG].startswith(log[:first.start()] + f'## [1.0.65] - {DATE}\n')

# --- Write: snapshot, then replace each file atomically -------------------------
for p in out:
    snap = os.path.join(SNAP, p)
    os.makedirs(os.path.dirname(snap), exist_ok=True)
    if os.path.exists(path(p)):
        with open(path(p), 'rb') as src, open(snap, 'wb') as dst:
            dst.write(src.read())
for p, text in out.items():
    tmp = path(p) + '.bump-tmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    os.replace(tmp, path(p))

# --- Diff stat ---------------------------------------------------------------------
print('\nbump-1.0.65: written')
total_add = total_del = 0
for p in out:
    snap = os.path.join(SNAP, p)
    before = open(snap, encoding='utf-8', newline='').read().splitlines() if os.path.exists(snap) else []
    after = out[p].splitlines()
    add = dl = 0
    for d in difflib.unified_diff(before, after, lineterm='', n=0):
        if d.startswith('+') and not d.startswith('+++'):
            add += 1
        elif d.startswith('-') and not d.startswith('---'):
            dl += 1
    total_add += add
    total_del += dl
    print(f'  {p:<66} +{add} -{dl}{"  (new)" if not before else ""}')
print(f'  {len(out)} files, +{total_add} -{total_del}')
print(f'\n  F-Droid text: {len(fdroid)} characters, {len(fbytes)} bytes per file, SHA-256 {fsha}')
print(f'  CHANGELOG heading: ## [1.0.65] - {DATE}')
print(f'  recipe commit lines unchanged: {next(iter(commits))} (the previous release\'s);'
      ' set them to v1.0.65^{commit} after the tag')

# --- Guards that read the CURRENT version's F-Droid files by derivation --------
lib = os.path.join(ROOT, 'frontend/src/lib')
watch = []
for name in sorted(os.listdir(lib)):
    if name.endswith('PublishedClaims.test.ts'):
        src = open(os.path.join(lib, name), encoding='utf-8').read()
        if 'bundle.android.versionCode' in src and 'changelogs/' in src:
            watch.append(name)
if watch:
    print('\n  WARNING: these guards read the F-Droid files of whatever version is current,')
    print('  so a bump hands them the 1.0.65 text; run them and expect red unless they were re-scoped:')
    for w in watch:
        print(f'    frontend/src/lib/{w}')
PY

if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo
  echo "bump-1.0.65: git diff --stat (tracked files)"
  git -C "$ROOT" diff --stat
  echo "bump-1.0.65: new files"
  git -C "$ROOT" status --short --untracked-files=all -- fastlane/metadata/android/en-US/changelogs
  PREV_TAG_SHA=$(git -C "$ROOT" rev-parse -q --verify 'v1.0.64^{commit}' 2>/dev/null || true)
  if [ -z "$PREV_TAG_SHA" ]; then
    echo "NOTE: no local v1.0.64 tag, so the recipe commit lines were not compared with it"
  elif grep -q "^    commit: $PREV_TAG_SHA\$" "$ROOT/pipeline/android-release/fdroid/com.dtgibson.snowraven.yml"; then
    echo "recipe commit lines equal v1.0.64^{commit} ($PREV_TAG_SHA), as expected before the v1.0.65 tag"
  else
    echo "NOTE: recipe commit lines do not name v1.0.64^{commit} ($PREV_TAG_SHA);"
    echo "      the 1.0.64 ship may not have written its recipe hash yet. Harmless: they move after the v1.0.65 tag."
  fi
fi

cat <<'NEXT'

Next, from frontend/ (the six-file guards, then the full suite):
  npx vitest run src/lib/androidVersionSource.test.ts src/lib/icloudKeysPublishedClaims.test.ts \
    src/lib/fdroidRecipe.test.ts src/lib/fastlaneMetadata.test.ts src/lib/iosSceneManifest.test.ts \
    src/lib/lifeListsPublishedClaims.test.ts
  npx vitest run && npm run typecheck && npm run build
NEXT
