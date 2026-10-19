// The per-answer cost a raised cap adds to a sweep: each merge in
// checklistProjectsCache.ts rebuilds its snapshot Map over every admitted key,
// and exoticProvenanceCache.ts rebuilds a Set over its ledger. Times one rebuild
// at the old and the new cap (best of 5), in Node (V8) and the jsc shell.
//   node measure-snapshot-rebuild.js     jsc measure-snapshot-rebuild.js
var now = function () { return typeof performance !== 'undefined' ? performance.now() : preciseTime() * 1000 }
var log = typeof console !== 'undefined' ? function (s) { console.log(s) } : print
var engine = typeof process !== 'undefined' ? 'V8 ' + process.versions.v8 : 'JSC'
var caps = [32768, 65536, 262144]
for (var c = 0; c < caps.length; c++) {
  var n = caps[c], entries = Object.create(null), order = []
  for (var i = 0; i < n; i++) { var k = 'S' + (100000000 + i); entries[k] = { proj: 'EBIRD', ids: [], at: 1 }; order.push(k) }
  var best = Infinity, bestSet = Infinity
  for (var r = 0; r < 5; r++) {
    var t = now(); var out = new Map(); for (var j = 0; j < order.length; j++) { var key = order[j]; if (Object.prototype.hasOwnProperty.call(entries, key)) out.set(key, entries[key]) } best = Math.min(best, now() - t)
    t = now(); var s = new Set(order); bestSet = Math.min(bestSet, now() - t)
    if (out.size !== n || s.size !== n) throw new Error('unreachable')
  }
  log(JSON.stringify({ engine: engine, entries: n, projectsSnapshotMs: +best.toFixed(1), ledgerSetMs: +bestSet.toFixed(1) }))
}
