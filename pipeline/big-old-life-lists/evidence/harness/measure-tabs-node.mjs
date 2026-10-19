// Per-tab derivation time (V8), shipped parse vs packed+materialized, plus the
// identical-output check over every tab's serialized result.
//   node --max-old-space-size=14000 measure-tabs-node.mjs <bundle> <csv> [label] [check]
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const [bundlePath, csvPath, label = csvPath, check] = process.argv.slice(2)
vm.runInThisContext(readFileSync(bundlePath, 'utf8'))
const SRH = globalThis.SRH
let text = readFileSync(csvPath, 'utf8')
const header = text.slice(0, text.indexOf('\n'))
let oldObs = SRH.parseEbirdObservations(text)
const shipped = SRH.timeTabs(oldObs, header)
let outOld = check ? SRH.tabOutputs(oldObs, header) : null
oldObs = null
let newObs = SRH.materialize(SRH.pack(text))
const packed = SRH.timeTabs(newObs, header)
let identical = null
if (check) { const outNew = SRH.tabOutputs(newObs, header); identical = Object.fromEntries(Object.keys(outOld).map(k => [k, outOld[k] === outNew[k]])) }
console.log(JSON.stringify({ engine: 'V8 ' + process.versions.v8, label, rows: newObs.length, msPerTab: { shipped, packed }, identical }))
