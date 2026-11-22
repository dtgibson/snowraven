#!/bin/zsh
# Apply the held 1.0.76 release changes to this checkout, by group, after the
# user's yes (family-rollups-and-tree, Phase B). Each group applies all or
# nothing and refuses when it is already applied or half applied, so a re-run
# is safe. Nothing here commits, pushes or tags.
#
#   zsh pipeline/family-rollups-and-tree/held/release/apply-release-1.0.76.sh [--check] <group>...
#
# Groups, in the order Phase B runs them:
#   version   the six-file version set (+ package-lock, CHANGELOG), patch 1, and
#             the three F-Droid changelog files written from the `proposal
#             fastlane` block of copy/published-copy.md (the approved What's New)
#   copy      README, website row and listing bullet from the held before/after
#             blocks, plus patch 2 (the surfaces guard, the capture tools' Family
#             Tree job, the harness moved into website/tools/verify/ with its
#             run.mjs entry)
#   pictures  every file in pictures/manifest.tsv copied to its published path
#   records   patch 3 (the map build's DECISIONS.md heading and ROADMAP line)
#
# The approved text is read from copy/published-copy.md when the script runs,
# so a word the user changes is changed there, once, before applying.
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
HELD="$ROOT/pipeline/family-rollups-and-tree/held/release"
CHECK=0
groups=()
for a in "$@"; do
  case "$a" in
    --check) CHECK=1 ;;
    version|copy|pictures|records) groups+=("$a") ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done
(( ${#groups[@]} )) || { echo "name at least one group: version copy pictures records" >&2; exit 2; }
cd "$ROOT"

block() { # print the body of the fenced block "<kind> <name>" from published-copy.md
  python3 -I - "$HELD/copy/published-copy.md" "$1" "$2" <<'EOF'
import re, sys
text = open(sys.argv[1], encoding='utf-8').read()
found = [m.group(3) for m in re.finditer(r'^````([a-z-]+) ([a-z-]+)\n([\s\S]*?)\n````$', text, re.M)
         if m.group(1) == sys.argv[2] and m.group(2) == sys.argv[3]]
if len(found) != 1: sys.exit(f'expected one "{sys.argv[2]} {sys.argv[3]}" block, found {len(found)}')
sys.stdout.write(found[0])
EOF
}

do_version() {
  grep -q '"version": "1.0.75"' frontend/package.json || { echo "version: frontend/package.json is not at 1.0.75 (already applied?)" >&2; return 1; }
  local fl wn
  fl=$(block proposal fastlane); wn=$(block proposal whats-new)
  [[ "$fl" == "$wn" ]] || { echo "version: proposal fastlane differs from proposal whats-new" >&2; return 1; }
  (( ${#fl} + 1 <= 500 )) || { echo "version: the F-Droid text is over 500 characters" >&2; return 1; }
  grep -q '^## \[1.0.76\]' CHANGELOG.md && { echo "version: CHANGELOG.md already has a 1.0.76 entry" >&2; return 1; }
  grep -q '^## \[1.0.75\] - ' CHANGELOG.md || { echo "version: CHANGELOG.md has no 1.0.75 entry to insert above" >&2; return 1; }
  git apply --check "$HELD/patches/1-version-set-1.0.76.patch"
  (( CHECK )) && { echo "version: check OK"; return 0; }
  git apply "$HELD/patches/1-version-set-1.0.76.patch"
  for c in 10000761 10000762 10000764; do printf '%s\n' "$fl" > "fastlane/metadata/android/en-US/changelogs/$c.txt"; done
  python3 -I - "$HELD/copy/changelog-entry.md" CHANGELOG.md <<'EOF'
import re, sys
held = open(sys.argv[1], encoding='utf-8').read()
entry = re.search(r'^````changelog\n([\s\S]*?)\n````$', held, re.M).group(1)
t = open(sys.argv[2], encoding='utf-8').read()
i = t.index('\n## [1.0.75] - ') + 1
open(sys.argv[2], 'w', encoding='utf-8').write(t[:i] + entry + '\n\n' + t[i:])
EOF
  echo "version: applied (F-Droid text: ${#fl} characters; CHANGELOG entry inserted)"
}

do_copy() {
  if grep -q '^### Family Tree$' README.md; then echo "copy: README already has the Family Tree section" >&2; return 1; fi
  python3 -I "$HELD/apply-pairs.py" "$ROOT" --check
  git apply --check "$HELD/patches/2-copy-tools-and-guard-1.0.76.patch"
  (( CHECK )) && { echo "copy: check OK"; return 0; }
  python3 -I "$HELD/apply-pairs.py" "$ROOT"
  git apply "$HELD/patches/2-copy-tools-and-guard-1.0.76.patch"
  echo "copy: applied"
}

do_pictures() {
  local missing=0 n=0
  while IFS=$'\t' read -r src dst; do
    [[ -z "$src" || "$src" == \#* ]] && continue
    [[ -f "$HELD/pictures/$src" ]] || { echo "pictures: missing $src" >&2; missing=1; }
    n=$((n + 1))
  done < "$HELD/pictures/manifest.tsv"
  (( missing )) && return 1
  (( CHECK )) && { echo "pictures: check OK ($n files)"; return 0; }
  while IFS=$'\t' read -r src dst; do
    [[ -z "$src" || "$src" == \#* ]] && continue
    mkdir -p "$(dirname "$dst")"; cp "$HELD/pictures/$src" "$dst"
  done < "$HELD/pictures/manifest.tsv"
  echo "pictures: copied $n files"
}

do_records() {
  git apply --check "$HELD/patches/3-records-1.0.76.patch"
  (( CHECK )) && { echo "records: check OK"; return 0; }
  git apply "$HELD/patches/3-records-1.0.76.patch"
  echo "records: applied"
}

for g in "${groups[@]}"; do "do_$g"; done
