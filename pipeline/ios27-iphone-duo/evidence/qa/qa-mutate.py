#!/usr/bin/env python3
"""QA's own mutation harness (ios27-iphone-duo). Each mutation replaces one exact
substring that must occur exactly once, asserts the file then differs from the
snapshot, runs vitest on the named guards, restores from the ONE snapshot taken
before any mutation, and verifies the restore by sha1 against the intended hashes
recorded before the snapshot. Never uses git."""
import hashlib, shutil, subprocess, sys, os

REPO = os.environ['SR_REPO']  # the repo checkout; run from a scratch folder holding qa-snap/ and qa-intended.sha
SCR = os.path.dirname(os.path.abspath(__file__))
SNAP = os.path.join(SCR, 'qa-snap')
INTENDED = {}
for line in open(os.path.join(SCR, 'qa-intended.sha')):
    h, p = line.split()
    INTENDED[p] = h

GUARDS = ['src/lib/bottomSurfaceSideInsets.test.ts', 'src/lib/iosMonitorLookups.test.ts',
          'src/lib/filterControlSizeCss.test.ts', 'src/lib/androidInsetsCss.test.ts',
          'src/lib/safeAreaPerSide.test.ts']

MUTATIONS = [
    ('Q1 inbox sheet loses its left pad (top level)', 'frontend/src/globals.css',
     '.sr-ios-app .sr-inbox-sheet {\n  padding-left: env(safe-area-inset-left, 0px);\n  padding-right: env(safe-area-inset-right, 0px);\n}',
     '.sr-ios-app .sr-inbox-sheet {\n  padding-right: env(safe-area-inset-right, 0px);\n}'),
    ('Q2 iPhone block label rule ungated', 'frontend/src/globals.css',
     '  .sr-ios-app .sr-ctl-label {\n    font-size: max(calc(var(--sr-ctl-floor)        * var(--sr-label-ratio, 1)),',
     '  .sr-ctl-label {\n    font-size: max(calc(var(--sr-ctl-floor)        * var(--sr-label-ratio, 1)),'),
    ('Q3 641px inbox root loses its right inset', 'frontend/src/globals.css',
     '    padding-right: calc(24px + env(safe-area-inset-right, 0px));\n  }\n  .sr-ios-app .sr-inbox-foot { padding-bottom: 18px; }',
     '    padding-right: 24px;\n  }\n  .sr-ios-app .sr-inbox-foot { padding-bottom: 18px; }'),
    ('Q4 More sheet right pad hard-coded 0 (iOS)', 'frontend/src/globals.css',
     '.sr-ios-app .sr-nav-sheet {\n  padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));\n  padding-left: env(safe-area-inset-left, 0px);\n  padding-right: env(safe-area-inset-right, 0px);',
     '.sr-ios-app .sr-nav-sheet {\n  padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));\n  padding-left: env(safe-area-inset-left, 0px);\n  padding-right: 0px;'),
    ('Q5 a monitor lookup in icloud.rs (Apple-shared, compiles for iOS)', 'src-tauri/src/icloud.rs',
     None, '\npub fn qa_probe_monitor(w: &tauri::WebviewWindow) { let _ = w.current_monitor(); }\n'),
    ('Q6 a monitor command name in shipped frontend (platform.ts)', 'frontend/src/lib/platform.ts',
     None, "\nexport const qaProbeCmd = 'plugin:window|primary_monitor'\n"),
    ('Q7 GREEN control: comment naming a lookup in icloud.rs', 'src-tauri/src/icloud.rs',
     None, '\n// qa: current_monitor() would abort on the Duo inner screen\n'),
]


def sha(path):
    return hashlib.sha1(open(path, 'rb').read()).hexdigest()


def restore_all():
    for p in INTENDED:
        if p.endswith('.test.ts'):
            continue
        src = os.path.join(SNAP, os.path.basename(p))
        shutil.copyfile(src, os.path.join(REPO, p))
        got = sha(os.path.join(REPO, p))
        if got != INTENDED[p]:
            print(f'RESTORE MISMATCH {p}: {got} != {INTENDED[p]}')
            sys.exit(2)
    print('restored ok (sha1 matches intended for every snapshot file)')


def run(label):
    r = subprocess.run(['npx', 'vitest', 'run', *GUARDS], cwd=os.path.join(REPO, 'frontend'),
                       capture_output=True, text=True)
    out = r.stdout + r.stderr
    keep = [l for l in out.splitlines() if (' FAIL ' in l or l.strip().startswith('×') or 'Tests ' in l
            or 'Test Files' in l)]
    print(f'--- {label}: vitest exit {r.returncode}')
    for l in keep:
        print('   ' + l.strip()[:220])
    return r.returncode


def main():
    # Baseline: unmutated tree must be green, or every red below means nothing.
    for p in INTENDED:
        assert sha(os.path.join(REPO, p)) == INTENDED[p], f'tree not at intended state: {p}'
    if run('UNMUTATED baseline') != 0:
        print('baseline not green; stopping')
        sys.exit(1)
    for label, rel, old, new in MUTATIONS:
        path = os.path.join(REPO, rel)
        text = open(path, encoding='utf-8').read()
        if old is None:
            mutated = text + new
        else:
            n = text.count(old)
            if n != 1:
                print(f'--- {label}: pattern occurs {n} times, SKIPPED')
                continue
            mutated = text.replace(old, new)
        assert mutated != text
        open(path, 'w', encoding='utf-8').write(mutated)
        assert sha(path) != INTENDED[rel], 'mutation is a no-op'
        try:
            run(label)
        finally:
            restore_all()
    if run('RESTORED tree') != 0:
        print('restored tree not green!')
        sys.exit(3)


if __name__ == '__main__':
    main()
