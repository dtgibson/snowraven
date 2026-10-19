// V8 heap per copy for one shape candidate (proto-entry.ts). Same method as
// measure-node.mjs: heapUsed after three forced GCs, as a delta with the
// source text alive in both readings.
//   node --expose-gc --max-old-space-size=14000 measure-proto-node.mjs <bundle> <csv> <variant> [label]
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const [bundlePath, csvPath, variant, label = csvPath] = process.argv.slice(2)
vm.runInThisContext(readFileSync(bundlePath, 'utf8'))
const SRH = globalThis.SRH
const heap = () => { for (let i = 0; i < 3; i++) globalThis.gc(); return process.memoryUsage().heapUsed }
const MB = (b) => +(b / 1048576).toFixed(1)
let text = readFileSync(csvPath, 'utf8')
const h0 = heap()
let t = performance.now()
let obs = SRH[variant](text)
const parseMs = performance.now() - t
const h1 = heap()
const rows = obs.length ?? obs.n
t = performance.now()
let clone = structuredClone(obs)
const cloneMs = performance.now() - t
const h2 = heap()
console.log(JSON.stringify({ engine: 'V8 ' + process.versions.v8, variant, label, rows, parseMs: Math.round(parseMs), mainCopyMB: MB(h1 - h0), mainBytesPerRow: Math.round((h1 - h0) / rows), cloneMs: Math.round(cloneMs), cloneCopyMB: MB(h2 - h1), cloneBytesPerRow: Math.round((h2 - h1) / rows) }))
if (!clone || !text) throw new Error('unreachable')
