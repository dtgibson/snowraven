// The cost a raised cap puts on the shared settings document (decisions.md
// entry 7): the projects store and the provenance ledger live inside it, and
// every preference save rewrites the whole document (TauriStorage reads,
// merges and writes it on its docChains link). Builds each store AT its cap,
// typical entries and the worst entries the validators admit, and times one
// JSON.parse plus one JSON.stringify of a settings document holding it: the
// CPU half of one save. Runs in Node (V8) and the jsc shell (JavaScriptCore).
//   node measure-settings-docs.js <cap>      jsc measure-settings-docs.js -- <cap>
var cap = Number((typeof process !== 'undefined' ? process.argv[2] : arguments[0]) || 262144)
var now = function () { return typeof performance !== 'undefined' ? performance.now() : preciseTime() * 1000 }
var log = typeof console !== 'undefined' ? function (s) { console.log(s) } : print
function projects(worst) {
  var entries = {}, order = []
  for (var i = 0; i < cap; i++) {
    var k = 'S' + (100000000 + i)
    entries[k] = worst ? { proj: 'EBIRD_ATL_CA_AND_A_LONG_PROJ_ID', ids: [999999999, 999999998, 999999997, 999999996, 999999995, 999999994, 999999993, 999999992], at: 1729300000000 } : { proj: i % 20 === 0 ? 'EBIRD_ATL_CA' : 'EBIRD', ids: i % 20 === 0 ? [1050] : [], at: 1729300000000 }
    order.push(k)
  }
  return { version: 1, entries: entries, order: order }
}
function ledger() {
  var checklists = {}, order = []
  for (var i = 0; i < cap; i++) { var k = 'S' + (100000000 + i); checklists[k] = 1729300000000; order.push(k) }
  return { version: 1, checklists: checklists, order: order, species: {}, speciesOrder: [], excludedNames: [] }
}
var cases = [['checklist-projects-v1 (typical)', projects(false)], ['checklist-projects-v1 (worst admitted)', projects(true)], ['exotic-provenance-v1 ledger', ledger()]]
for (var c = 0; c < cases.length; c++) {
  var doc = { theme: 'dark', 'map-defaults': { lat: 40, lng: -74, dist: 5 } }
  doc[cases[c][0].split(' ')[0]] = cases[c][1]
  var t = now(); var text = JSON.stringify(doc); var sMs = now() - t
  t = now(); JSON.parse(text); var pMs = now() - t
  log(JSON.stringify({ engine: typeof process !== 'undefined' ? 'V8 ' + process.versions.v8 : 'JSC', store: cases[c][0], cap: cap, chars: text.length, stringifyMs: Math.round(sMs), parseMs: Math.round(pMs) }))
}
