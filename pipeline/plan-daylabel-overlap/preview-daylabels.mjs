// A local preview of the Planner's day labels with the plan's FIRST DAY set to
// any width you like, so the fix can be looked at without waiting for 6 PM.
//
// The defect only appears when a plan's first day is narrower than its own day
// label, which in the real app means a plan fetched after about 5:57 PM local.
// This server answers `/weather/plan` from the committed test fixture with
// `window.axisStartTs` moved, which is the same thing the plan's own document
// says when you fetch one late in the evening -- `composePlan` trusts that
// field, so the chart cannot tell the difference.
//
//   node pipeline/plan-daylabel-overlap/preview-daylabels.mjs            # 1h first day
//   node pipeline/plan-daylabel-overlap/preview-daylabels.mjs 5.25       # the 84px band
//   node pipeline/plan-daylabel-overlap/preview-daylabels.mjs 9 --port 8793
//
// It serves `frontend/dist`, so run `npm run build --prefix frontend` first.
// It binds loopback on a FIXED port (8793 by default) because a tailnet
// preview needs a stable one -- `serveDist.mjs` in the verification gate
// always takes an ephemeral port, which is right for a harness and wrong here,
// so this keeps its own listener and borrows only the two hardened path
// helpers. Put it on the tailnet with
// `tailscale serve --https=8793 http://127.0.0.1:8793` (never 443, which is
// already serving something else).

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contentTypeFor, distRelativePath } from '../../website/tools/verify/serveDist.mjs'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] !== undefined ? Number(argv[i + 1]) : fallback
}
const PORT = flag('port', 8793)
// The first positional argument that is not a flag or a flag's value.
const flagValues = new Set(argv.filter((a, i) => argv[i - 1]?.startsWith('--')))
const positional = argv.find(a => !a.startsWith('--') && !flagValues.has(a))
const HOURS = positional !== undefined ? Number(positional) : 1
if (!Number.isFinite(HOURS) || HOURS <= 0 || HOURS > 24) {
  console.error(`first-day hours must be a number in (0, 24]; got ${positional}`)
  process.exit(1)
}

const DIST = resolve(fileURLToPath(new URL('../../frontend/dist/', import.meta.url)))
const FIXTURE = JSON.parse(readFileSync(fileURLToPath(new URL('../../frontend/src/lib/weatherTidePlan.fixture.json', import.meta.url)), 'utf8'))
const REF = FIXTURE.families.find(f => f.name === 'reference')
const BASE = REF.expectedWeather.plan
const TIDE = REF.expectedTide

const localOf = (ts) => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: BASE.tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ts * 1000)).reduce((a, x) => (a[x.type] = x.value, a), {})
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}

const axisStartTs = BASE.days[1].startTs - Math.round(HOURS * 3600)
const startTs = Math.max(BASE.window.startTs, axisStartTs + 60)
const PLAN = {
  ...BASE,
  fetchedAt: Math.max(BASE.fetchedAt, axisStartTs + 60),
  window: { ...BASE.window, axisStartTs, axisStartLocal: localOf(axisStartTs), startTs, startLocal: localOf(startTs) },
}

const server = createServer(async (req, res) => {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  } catch { res.writeHead(400); res.end('bad request'); return }

  const json = (b) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)) }
  if (pathname === '/settings/files') return json({ ebird: null, ml: null })
  if (pathname === '/settings/keys') return json({ ebird: null, openweather: null })
  if (pathname === '/weather/plan') return json(PLAN)
  if (pathname === '/tide/plan') return json(TIDE)
  if (pathname.startsWith('/settings/') || pathname.startsWith('/weather') || pathname.startsWith('/tide')
      || pathname.startsWith('/map') || pathname.startsWith('/taxonomy') || pathname.startsWith('/version')) {
    res.writeHead(404); res.end('not found'); return
  }

  const rel = distRelativePath(pathname)
  try {
    const body = await readFile(join(DIST, rel))
    res.writeHead(200, { 'content-type': contentTypeFor(rel) })
    res.end(body)
    return
  } catch { /* missing file or a directory: fall through to the SPA entry */ }
  try {
    const body = await readFile(join(DIST, 'index.html'))
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(body)
  } catch {
    res.writeHead(404); res.end('no build at ' + DIST + ' -- run: npm run build --prefix frontend')
  }
})

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE'
    ? `port ${PORT} is already in use -- pass --port <other>`
    : String(err))
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  SnowRaven preview: http://127.0.0.1:${PORT}`)
  console.log(`  first day: ${HOURS}h  (a plan fetched at ${localOf(axisStartTs).slice(11)} local)`)
  console.log(`  column width: ${(HOURS * 16).toFixed(0)}px at the phone tier's 16 px/hour\n`)
  console.log(`  tailnet:  tailscale serve --https=${PORT} http://127.0.0.1:${PORT}\n`)
  console.log('  In the app:  Plan -> Plan weather and tide for a place')
  console.log('               -> 36.603 / -121.876')
  console.log('               -> See all upcoming weather and tide data\n')
  console.log('  Ctrl-C to stop.\n')
})
