# Mutation table for hotspot-report-order-and-stats. Snapshots the whole
# working set ONCE, applies one mutation at a time by an exact single-match
# replace (refusing a no-op), runs the named suites, restores from the
# snapshot and verifies every file's hash against the INTENDED content.
import hashlib, pathlib, subprocess, sys, json
ROOT = pathlib.Path('/Users/developer/devwork/snowraven/frontend')
FILES = ['src/lib/hotspotReportsLocation.ts', 'src/components/hotspotReports/HotspotReport.tsx', 'src/globals.css', 'src/lib/hotspotReportsCopy.ts']
snap = {f: (ROOT / f).read_bytes() for f in FILES}
sha = {f: hashlib.sha256(b).hexdigest() for f, b in snap.items()}
LOC = ['src/lib/hotspotReportsLocation.test.ts']
MUTS = [
  ('gap tie goes to the later pair', 'src/lib/hotspotReportsLocation.ts', 'span > 0 && (best === null || span > best.days)', 'span > 0 && (best === null || span >= best.days)', LOC),
  ('rate leaves out a zero-species checklist (Statistics rule)', 'src/lib/hotspotReportsLocation.ts', "if (!usableDuration(d) || d === 0) continue", "if (!usableDuration(d) || d === 0 || counts[ci] === 0) continue", LOC),
  ('distance bound exclusive', 'src/lib/hotspotReportsLocation.ts', 'd >= 0 && d <= DISTANCE_MAX_KM', 'd >= 0 && d < DISTANCE_MAX_KM', LOC),
  ('top ten inserts before an equal row', 'src/lib/hotspotReportsLocation.ts', 'while (at > 0 && compareTop(r, top[at - 1]) < 0) at -= 1', 'while (at > 0 && compareTop(r, top[at - 1]) <= 0) at -= 1', LOC),
  ('species rows drawn when first seen together', 'src/lib/hotspotReportsLocation.ts', 'else if (S > 1 && species.rows[S - 1].day !== species.rows[0].day) {', 'else if (S > 1) {', LOC),
  ('most-recorded drawn at one checklist', 'src/lib/hotspotReportsLocation.ts', 'if (facts.checklists.length < 2 || species.total === 0) return null', 'if (species.total === 0) return null', LOC + ['src/components/hotspotReports/HotspotReportsTab.test.tsx']),
  ('gap drawn with two dates', 'src/lib/hotspotReportsLocation.ts', 'gap: facts.daysBirded >= 3 ? facts.longestGap : null,', 'gap: facts.daysBirded >= 2 ? facts.longestGap : null,', LOC),
  ('every chip drawn, section or not', 'src/components/hotspotReports/HotspotReport.tsx', "const chips = JUMP_SECTIONS.filter(s => s !== 'top' || top !== null)", 'const chips = JUMP_SECTIONS', ['src/components/hotspotReports/HotspotReportsTab.test.tsx']),
  ('two columns back to the list first', 'src/globals.css', '.sr-hsr-body { display: grid; grid-template-columns: minmax(0, 24rem) minmax(0, 1fr);', '.sr-hsr-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 24rem);', ['src/lib/hotspotReportsCss.test.ts']),
  ('facts track minimum loosened to 16rem', 'src/globals.css', 'minmax(min(max(19rem, 34%), 100%), 1fr)', 'minmax(min(max(16rem, 34%), 100%), 1fr)', ['src/lib/hotspotReportsCss.test.ts']),
  ('per-hour note loses "above zero"', 'src/lib/hotspotReportsCopy.ts', "const tail = aboveZero ? 'with a duration above zero' : 'with a duration'", "const tail = 'with a duration'", ['src/lib/hotspotReportsCopy.test.ts']),
  ('time birded average dropped', 'src/lib/hotspotReportsCopy.ts', 'return counted > 1 ? `${head}, ${hoursMinutes(minutes / counted)} on average` : head', 'return head', ['src/lib/hotspotReportsCopy.test.ts', 'src/components/hotspotReports/HotspotReportsTab.test.tsx']),
]
results = []
def restore():
    for f, b in snap.items(): (ROOT / f).write_bytes(b)
    for f in FILES: assert hashlib.sha256((ROOT / f).read_bytes()).hexdigest() == sha[f], f
try:
    base = subprocess.run(['npx', 'vitest', 'run', *sorted({t for m in MUTS for t in m[4]})], cwd=ROOT, capture_output=True, text=True)
    results.append({'mutation': 'BASELINE (unmutated)', 'rc': base.returncode, 'tail': base.stdout.strip().splitlines()[-4:]})
    for label, f, old, new, tests in MUTS:
        src = snap[f].decode()
        assert src.count(old) == 1, (label, src.count(old))
        (ROOT / f).write_text(src.replace(old, new, 1))
        assert (ROOT / f).read_bytes() != snap[f], label
        r = subprocess.run(['npx', 'vitest', 'run', *tests], cwd=ROOT, capture_output=True, text=True)
        failed = [l.strip() for l in r.stdout.splitlines() if l.strip().startswith('FAIL') or l.strip().startswith('×')][:6]
        results.append({'mutation': label, 'rc': r.returncode, 'red': r.returncode != 0, 'failing': failed})
        restore()
finally:
    restore()
print(json.dumps(results, indent=1))
