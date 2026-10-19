// JSC heap per copy for one shape candidate; method as measure-jsc.js.
//   $jsc measure-proto-jsc.js -- <bundle> <csv> <variant> [label]
var bundlePath = arguments[0], csvPath = arguments[1], variant = arguments[2], label = arguments[3] || csvPath
load(bundlePath)
var SRH = globalThis.SRH
function heap() { fullGC(); fullGC(); return gcHeapSize() }
function MB(b) { return Math.round(b / 1048576 * 10) / 10 }
var text = readFile(csvPath)
var h0 = heap()
var t = preciseTime()
var obs = SRH[variant](text)
var parseMs = (preciseTime() - t) * 1000
var h1 = heap()
var rows = obs.length === undefined ? obs.n : obs.length
print(JSON.stringify({ engine: 'JSC', variant: variant, label: label, rows: rows, parseMs: Math.round(parseMs), mainCopyMB: MB(h1 - h0), mainBytesPerRow: Math.round((h1 - h0) / rows) }))
if (!text) throw new Error('unreachable')
