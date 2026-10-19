// Security review L2, re-measured after the fix: the pack's reserved typed-array
// bytes and its time, through the real entry point (packEbirdObservations), at
// doubling sizes, on a line-feed flood (the hostile shape) and on a real-shaped
// export (the demo export repeated). Bundled by run-pack-reservation.sh; prints
// one JSON line per reading. Reads no user data.
import { packEbirdObservations } from '../../../../frontend/src/lib/parseEbirdObservations'

declare const process: { argv: string[]; hrtime: { bigint(): bigint } }
declare function require(m: string): { readFileSync(p: string, e: string): string }

const HEADER = 'Submission ID,Common Name,Scientific Name,Date\n'
const demo = require('node:fs').readFileSync(process.argv[2], 'utf8')
const demoBody = demo.slice(demo.indexOf('\n') + 1)
const demoHeader = demo.slice(0, demo.indexOf('\n') + 1)

const reserved = (p: ReturnType<typeof packEbirdObservations>) =>
  p.str.byteLength + p.num.byteLength + p.opt.byteLength + p.catStart.byteLength + p.catIds.byteLength

function time(f: () => unknown): number {
  let best = Infinity
  for (let r = 0; r < 3; r += 1) {
    const t0 = process.hrtime.bigint(); f(); best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6)
  }
  return best
}

const MB = 1024 * 1024
for (const mb of [8, 16, 32, 64, 100]) {
  const flood = HEADER + '\n'.repeat(mb * MB - HEADER.length)
  let p = packEbirdObservations(flood)
  const floodMs = time(() => { p = packEbirdObservations(flood) })
  console.log(JSON.stringify({ shape: 'line-feed flood', chars: flood.length, rows: p.rows, reservedBytes: reserved(p), reservedPerChar: +(reserved(p) / flood.length).toFixed(3), ms: +floodMs.toFixed(1) }))
}
for (const mb of [8, 16, 32, 64]) {
  let body = ''
  while (body.length < mb * MB) body += demoBody
  const real = demoHeader + body
  let p = packEbirdObservations(real)
  const realMs = time(() => { p = packEbirdObservations(real) })
  let lf = 0
  for (let i = real.indexOf('\n'); i !== -1; i = real.indexOf('\n', i + 1)) lf += 1
  console.log(JSON.stringify({ shape: 'demo export repeated', chars: real.length, rows: p.rows, capacity: p.opt.length, lineFeedsPlusOne: lf + 1, reservedBytes: reserved(p), ms: +realMs.toFixed(1) }))
}
