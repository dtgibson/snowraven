// JavaScriptCore heap and time per copy (the engine of the Mac, iPhone and iPad
// apps), for decisions.md entry 1.
//
//   jsc=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
//   $jsc measure-jsc.js -- <bundle.js> <export.csv> [label]
//
// Method. `gcHeapSize()` after `fullGC()` (JSC's own accounting: GC-managed
// cells plus extra memory such as string storage), as a DELTA against the same
// reading just before the structure was built, with the source text alive in
// both readings. The jsc shell has no structuredClone, so the clone copy is
// measured in the WebKit page instead (measure-page.html). One cold run.
var bundlePath = arguments[0]
var csvPath = arguments[1]
var label = arguments[2] || csvPath
load(bundlePath)
var SRH = globalThis.SRH
function heap() { fullGC(); fullGC(); return gcHeapSize() }
function MB(b) { return Math.round(b / 1048576 * 10) / 10 }

var text = readFile(csvPath)
var chars = text.length
var h0 = heap()
var t = preciseTime()
var obs = SRH.parseEbirdObservations(text)
var parseMs = (preciseTime() - t) * 1000
var h1 = heap()
var rows = obs.length
t = preciseTime()
var bundle = SRH.computeStatsBundle(obs, SRH.defaultRequest)
var statsMs = (preciseTime() - t) * 1000
print(JSON.stringify({
  engine: 'JavaScriptCore (macOS jsc shell)',
  label: label, rows: rows, chars: chars,
  parseMs: Math.round(parseMs),
  mainCopyMB: MB(h1 - h0),
  mainBytesPerRow: Math.round((h1 - h0) / rows),
  statsMs: Math.round(statsMs),
  bundleFields: Object.keys(bundle).length,
}))
if (text.length !== chars) throw new Error('unreachable')
