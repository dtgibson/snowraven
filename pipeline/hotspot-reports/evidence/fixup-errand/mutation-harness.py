#!/usr/bin/env python3
"""Mutation checks for the hotspot-reports fix-up errand (D-25), run in a
scratch copy of frontend/ so the real product source never changes.

Per mutation: the pattern must occur exactly once, the mutated file must
differ, the named suites run through vitest's JSON reporter, and the file is
restored from the ONE snapshot taken at the top, then hashed against the REAL
tree's file (the intended content), never against the snapshot."""
import hashlib, json, os, subprocess, sys

SP = os.path.dirname(os.path.abspath(__file__))
REAL = '/Users/developer/devwork/snowraven/frontend'
BOX = os.path.join(SP, 'mutbox', 'frontend')

TAB = 'src/components/hotspotReports/HotspotReportsTab.test.tsx'
IDX = 'src/lib/hotspotReports.test.ts'
LOC = 'src/lib/hotspotReportsLocation.test.ts'
SEAM = 'src/lib/hotspotReportsSeamParity.test.ts'

MUTATIONS = [
    ('M1 cols header loses aria-hidden', 'src/components/hotspotReports/HotspotReportLifeList.tsx',
     '<div className="sr-hsr-ll-cols" aria-hidden="true">', '<div className="sr-hsr-ll-cols">', [TAB]),
    ('M2a name bound 200 -> 199', 'src/lib/hotspotReports.ts',
     'export const LOCATION_NAME_MAX_CHARS = 200', 'export const LOCATION_NAME_MAX_CHARS = 199', [IDX]),
    ('M2b name bound 200 -> 201', 'src/lib/hotspotReports.ts',
     'export const LOCATION_NAME_MAX_CHARS = 200', 'export const LOCATION_NAME_MAX_CHARS = 201', [IDX]),
    ('M3a protocol bound 64 -> 63', 'src/lib/hotspotReportsLocation.ts',
     'export const PROTOCOL_NAME_MAX_CHARS = 64', 'export const PROTOCOL_NAME_MAX_CHARS = 63', [LOC]),
    ('M3b protocol bound 64 -> 65', 'src/lib/hotspotReportsLocation.ts',
     'export const PROTOCOL_NAME_MAX_CHARS = 64', 'export const PROTOCOL_NAME_MAX_CHARS = 65', [LOC]),
    ('M4a ranked list renders when empty', 'src/components/hotspotReports/HotspotReportsOverview.tsx',
     '  if (rows.length === 0) return null\n', '  if (rows.length < 0) return null\n', [TAB]),
    ('M4b sole species sentence renders at zero', 'src/components/hotspotReports/HotspotReportsOverview.tsx',
     "  if (list === 'species' && figure === 0) return null\n", "  if (list === 'species' && figure < 0) return null\n", [TAB]),
    ('M5 live node keeps its identity', 'src/components/hotspotReports/HotspotReportsTab.tsx',
     '<span key={selectionSeq}>{announcement}</span>', '<span>{announcement}</span>', [TAB]),
    ('M6a media formats swapped (both seams agree, wrongly)', 'src/lib/hotspotReports.ts',
     "row.format === 'Photo' ? 0 : row.format === 'Audio' ? 1", "row.format === 'Photo' ? 1 : row.format === 'Audio' ? 0", [SEAM]),
    ('M6b web/Pi read drops the last record', 'src/lib/storage.ts',
     "    return chunks.join('')\n", "    return chunks.join('').replace(/[^\\n]*\\n$/, '')\n", [SEAM]),
    ('M6c Tauri read drops the last record', 'src/lib/storage.ts',
     "    const path = FILE_PATHS[name];\n    try {\n      if (!await exists(path, { baseDir: BaseDirectory.AppLocalData })) return null;\n      return await readTextFile(path, { baseDir: BaseDirectory.AppLocalData });\n",
     "    const path = FILE_PATHS[name];\n    try {\n      if (!await exists(path, { baseDir: BaseDirectory.AppLocalData })) return null;\n      return (await readTextFile(path, { baseDir: BaseDirectory.AppLocalData })).replace(/[^\\n]*\\n$/, '');\n",
     [SEAM]),
]


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def run(suites, tag):
    out = os.path.join(SP, f'mut-{tag}.json')
    if os.path.exists(out):
        os.remove(out)
    p = subprocess.run(['npx', 'vitest', 'run', '--reporter=json', f'--outputFile={out}', *suites],
                       cwd=BOX, capture_output=True, text=True, timeout=600)
    if not os.path.exists(out):
        print(p.stdout[-2000:], p.stderr[-2000:])
        raise SystemExit(f'{tag}: no report written (rc={p.returncode})')
    rep = json.load(open(out))
    failed = [a['fullName'] for r in rep['testResults'] for a in r['assertionResults'] if a['status'] == 'failed']
    files_failed = [os.path.relpath(r['name'], BOX) for r in rep['testResults'] if r['status'] == 'failed' and not r['assertionResults']]
    return p.returncode, rep['numTotalTests'], rep['numPassedTests'], failed, files_failed


def main():
    targets = sorted({m[1] for m in MUTATIONS})
    # ONE snapshot of every file any mutation touches, taken before anything.
    snap = {t: open(os.path.join(BOX, t), 'rb').read() for t in targets}
    for t in targets:
        assert sha(os.path.join(BOX, t)) == sha(os.path.join(REAL, t)), f'sandbox copy of {t} differs from the real tree'

    all_suites = sorted({s for m in MUTATIONS for s in m[4]})
    rc, total, passed, failed, ff = run(all_suites, 'baseline')
    print(f'BASELINE  rc={rc} tests={total} passed={passed} failed={len(failed)} file-errors={len(ff)}')
    if rc != 0 or failed or ff or total == 0:
        raise SystemExit('baseline is not green: the harness cannot be trusted')

    rows = []
    for i, (label, path, old, new, suites) in enumerate(MUTATIONS):
        full = os.path.join(BOX, path)
        text = snap[path].decode('utf-8')
        n = text.count(old)
        if n != 1:
            raise SystemExit(f'{label}: pattern occurs {n} times')
        mutated = text.replace(old, new)
        assert mutated != text
        open(full, 'w', encoding='utf-8').write(mutated)
        assert sha(full) != sha(os.path.join(REAL, path)), f'{label}: mutated file equals the real file'
        try:
            rc, total, passed, failed, ff = run(suites, f'm{i}')
        finally:
            open(full, 'wb').write(snap[path])
            restored = sha(full) == sha(os.path.join(REAL, path))
        print(f'\n{label}  [{path}]\n  rc={rc} tests={total} passed={passed} failed={len(failed)} restored-to-real={restored}')
        for f in failed:
            print(f'   RED  {f}')
        for f in ff:
            print(f'   FILE ERROR  {f}')
        rows.append((label, len(failed), restored))
        if not restored:
            raise SystemExit(f'{label}: restore does not match the real tree')

    rc, total, passed, failed, ff = run(all_suites, 'after')
    print(f'\nAFTER     rc={rc} tests={total} passed={passed} failed={len(failed)}')
    print('\nSUMMARY')
    for label, nfail, restored in rows:
        print(f'  {nfail:3d} red  restored={restored}  {label}')


if __name__ == '__main__':
    main()
