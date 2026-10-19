// V8: the packed form (P4) end to end, as the shipped design would run it.
//   node --expose-gc --max-old-space-size=14000 measure-p4-node.mjs <bundle> <csv> [label]
// Heap = heapUsed + arrayBuffers (typed-array backing stores live outside the
// V8 heap and would otherwise be missed), after three forced GCs, as deltas.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const [bundlePath, csvPath, label = csvPath] = process.argv.slice(2)
vm.runInThisContext(readFileSync(bundlePath, 'utf8'))
const SRH = globalThis.SRH
const heap = () => { for (let i = 0; i < 3; i++) globalThis.gc(); const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers }
const MB = (b) => +(b / 1048576).toFixed(1)
let text = readFileSync(csvPath, 'utf8')
const h0 = heap()
let t = performance.now(); let packed = SRH.pack(text); const packMs = performance.now() - t
const h1 = heap()
t = performance.now(); const wire = structuredClone(packed, { transfer: [packed.str.buffer, packed.num.buffer] }); const wireMs = performance.now() - t
packed = wire
const h2 = heap()
t = performance.now(); let obs = SRH.materialize(packed); const matMs = performance.now() - t
const h3 = heap()
t = performance.now(); const re = SRH.repack(obs); const repackMs = performance.now() - t
const rows = obs.length
// Identity, compared in slices: one JSON string of 1M rows passes V8's maximum string length.
let shippedObs = SRH.parseEbirdObservations(text)
let same = shippedObs.length === obs.length
for (let i = 0; same && i < obs.length; i += 10000) same = JSON.stringify(shippedObs.slice(i, i + 10000)) === JSON.stringify(obs.slice(i, i + 10000))
shippedObs = null
t = performance.now(); const b = SRH.computeStatsBundle(obs, SRH.defaultRequest); const statsMs = performance.now() - t
console.log(JSON.stringify({ engine: 'V8 ' + process.versions.v8, label, rows, packMs: Math.round(packMs), packedMB: MB(h1 - h0), packedBytesPerRow: Math.round((h1 - h0) / rows), strings: packed.strings.length, wireMs: Math.round(wireMs), materializeMs: Math.round(matMs), objectsMB: MB(h3 - h2), objectsBytesPerRow: Math.round((h3 - h2) / rows), repackMs: Math.round(repackMs), statsMs: Math.round(statsMs), identicalToShippedParse: same }))
if (!re || !b || !text) throw new Error('unreachable')
