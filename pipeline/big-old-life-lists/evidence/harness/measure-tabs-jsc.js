// Per-tab derivation time (JSC), shipped parse vs packed+materialized.
//   $jsc measure-tabs-jsc.js -- <bundle> <csv> [label]
var bundlePath = arguments[0], csvPath = arguments[1], label = arguments[2] || csvPath
load(bundlePath)
var SRH = globalThis.SRH
var performance = { now: function () { return preciseTime() * 1000 } }
globalThis.performance = performance
var text = readFile(csvPath)
var header = text.slice(0, text.indexOf('\n'))
var oldObs = SRH.parseEbirdObservations(text)
var shipped = SRH.timeTabs(oldObs, header)
oldObs = null; fullGC()
var newObs = SRH.materialize(SRH.pack(text))
var packed = SRH.timeTabs(newObs, header)
print(JSON.stringify({ engine: 'JSC', label: label, rows: newObs.length, msPerTab: { shipped: shipped, packed: packed } }))
