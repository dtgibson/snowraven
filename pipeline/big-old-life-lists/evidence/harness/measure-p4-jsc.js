// JSC: the packed form (P4); method as measure-jsc.js.
//   $jsc measure-p4-jsc.js -- <bundle> <csv> [label]
var bundlePath = arguments[0], csvPath = arguments[1], label = arguments[2] || csvPath
load(bundlePath)
var SRH = globalThis.SRH
function heap() { fullGC(); fullGC(); return gcHeapSize() }
function MB(b) { return Math.round(b / 1048576 * 10) / 10 }
var text = readFile(csvPath)
var h0 = heap()
var t = preciseTime(); var packed = SRH.pack(text); var packMs = (preciseTime() - t) * 1000
var h1 = heap()
t = preciseTime(); var obs = SRH.materialize(packed); var matMs = (preciseTime() - t) * 1000
var h2 = heap()
t = preciseTime(); var re = SRH.repack(obs); var repackMs = (preciseTime() - t) * 1000
re = null
t = preciseTime(); var b = SRH.computeStatsBundle(obs, SRH.defaultRequest); var statsMs = (preciseTime() - t) * 1000
var rows = obs.length
print(JSON.stringify({ engine: 'JSC', label: label, rows: rows, packMs: Math.round(packMs), packedMB: MB(h1 - h0), packedBytesPerRow: Math.round((h1 - h0) / rows), materializeMs: Math.round(matMs), objectsMB: MB(h2 - h1), objectsBytesPerRow: Math.round((h2 - h1) / rows), repackMs: Math.round(repackMs), statsMs: Math.round(statsMs) }))
if (!b || !text) throw new Error('unreachable')
