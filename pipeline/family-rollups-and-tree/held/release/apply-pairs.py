"""Apply (or check) the held before/after pairs in published-copy.md to a tree.
usage: python3 -I apply-pairs.py <repo-root> [--check]"""
import re, sys
root = sys.argv[1]; check = '--check' in sys.argv
held = open(f'{root}/pipeline/family-rollups-and-tree/held/release/copy/published-copy.md', encoding='utf-8').read()
blocks = [(m.group(1), m.group(2) or '', int(m.group(3) or 0), m.group(4))
          for m in re.finditer(r'^````([a-z-]+)(?: ([a-z-]+))?(?: (\d+))?\n([\s\S]*?)\n````$', held, re.M)]
files = {'readme': 'README.md', 'website': 'website/index.html', 'listing': 'appstore/LISTING.md'}
problems = []
plan = {}
for s, path in files.items():
    text = open(f'{root}/{path}', encoding='utf-8').read()
    ns = sorted({n for k, name, n, _ in blocks if name == s and k in ('before', 'after')})
    for n in ns:
        b = [x for k, name, nn, x in blocks if k == 'before' and name == s and nn == n]
        a = [x for k, name, nn, x in blocks if k == 'after' and name == s and nn == n]
        if len(b) != 1 or len(a) != 1: problems.append(f'{s} {n}: needs one before and one after'); continue
        before, after = b[0] + '\n', a[0] + '\n'
        if text.count(before) != 1: problems.append(f'{s} {n}: BEFORE occurs {text.count(before)} times'); continue
        text = text.replace(before, after)
    plan[path] = text
if problems:
    print('REFUSED, nothing written:\n  ' + '\n  '.join(problems)); sys.exit(1)
if check:
    print('check OK: every pair applies once'); sys.exit(0)
for path, text in plan.items():
    open(f'{root}/{path}', 'w', encoding='utf-8').write(text)
print('applied:', ', '.join(plan))
