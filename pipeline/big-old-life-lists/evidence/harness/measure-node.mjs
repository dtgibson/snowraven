// V8 (Node) heap and time per copy, for decisions.md entry 1.
//
//   node --expose-gc --max-old-space-size=12000 measure-node.mjs <bundle.js> <export.csv> [label]
//
// Method. Every heap figure is `process.memoryUsage().heapUsed` after three
// forced full GCs, as a DELTA against the same reading taken just before the
// structure was built, with the source text still alive in both readings, so
// the delta is what the structure itself retains. "main copy" is the parse's
// own output (what the main thread holds after the parse worker's reply in the
// shipped design is a structured-clone deserialization, so "clone copy" is the
// figure for it AND for the stats worker's held copy: both are produced by the
// same serializer). Times are wall clock on a quiet machine, one cold run,
// because a 1M-row parse is long enough that warm-up noise does not matter.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const [bundlePath, csvPath, label = csvPath] = process.argv.slice(2)
vm.runInThisContext(readFileSync(bundlePath, 'utf8'))
const SRH = globalThis.SRH

function heap() {
  for (let i = 0; i < 3; i++) globalThis.gc()
  return process.memoryUsage().heapUsed
}
const MB = (b) => +(b / 1048576).toFixed(1)

let text = readFileSync(csvPath, 'utf8')
const chars = text.length
const h0 = heap()
let t = performance.now()
let obs = SRH.parseEbirdObservations(text)
const parseMs = performance.now() - t
const h1 = heap()
const rows = obs.length

t = performance.now()
let clone = structuredClone(obs)
const cloneMs = performance.now() - t
const h2 = heap()

t = performance.now()
const bundle = SRH.computeStatsBundle(obs, SRH.defaultRequest)
const statsMs = performance.now() - t
const species = bundle && typeof bundle === 'object' ? Object.keys(bundle).length : 0

const out = {
  engine: `V8 ${process.versions.v8} (Node ${process.version})`,
  label, rows, chars,
  parseMs: Math.round(parseMs),
  mainCopyMB: MB(h1 - h0),
  mainBytesPerRow: Math.round((h1 - h0) / rows),
  cloneMs: Math.round(cloneMs),
  cloneCopyMB: MB(h2 - h1),
  cloneBytesPerRow: Math.round((h2 - h1) / rows),
  statsMs: Math.round(statsMs),
  bundleFields: species,
}
console.log(JSON.stringify(out))
// keep the structures alive until the readings above are taken
if (clone.length !== rows || text.length !== chars) throw new Error('unreachable')
obs = clone = text = null
