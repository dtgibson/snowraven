// Drives page.html in Playwright's Chromium (at 1x, 4x and 6x CPU throttle, the
// v1.0.20 Pi stand-in) and WebKit, recording each run's result plus the PEAK
// resident memory of the page's content process, sampled every 100 ms with ps
// over the browser's whole process tree (the page and its workers share that
// process). Results go to <out.jsonl>.
//
//   node drive-browsers.mjs <port> <out.jsonl> <engine> <rate> <csv> <shape>
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium, webkit } = require('../../../../website/tools/node_modules/playwright')

const [port, outFile, engine, rateArg, csv, shape] = process.argv.slice(2)
const rate = Number(rateArg)

// The page's content process, found by its own command line: Chromium's
// renderer carries --type=renderer and descends from the launched browser;
// WebKit's web content process is an XPC service launched by launchd, so it
// is found by the Playwright WebKit build's path instead.
function contentProcesses(rootPid) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,args=']).toString().trim().split('\n').map(l => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(l)
    return m ? { pid: m[1], ppid: m[2], rss: Number(m[3]) * 1024, args: m[4] } : null
  }).filter(Boolean)
  if (engine === 'webkit') return rows.filter(r => r.args.includes('ms-playwright/webkit') && /WebContent|WebProcess/.test(r.args))
  const kids = new Map()
  for (const r of rows) { if (!kids.has(r.ppid)) kids.set(r.ppid, []); kids.get(r.ppid).push(r) }
  const out = []
  const walk = (p) => { for (const k of kids.get(String(p)) ?? []) { out.push(k); walk(k.pid) } }
  walk(rootPid)
  return out.filter(r => r.args.includes('--type=renderer'))
}

const type = engine === 'webkit' ? webkit : chromium
const server = await type.launchServer(engine === 'webkit' ? {} : { args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] })
const browser = await type.connect(server.wsEndpoint())
const page = await browser.newPage()
if (engine === 'chromium' && rate > 1) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
}
const root = server.process().pid
let peak = 0
let peakComm = ''
const sampler = setInterval(() => {
  try {
    for (const p of contentProcesses(root)) if (p.rss > peak) { peak = p.rss; peakComm = p.args.slice(0, 120) }
  } catch { /* a process exited between ps and the walk */ }
}, 100)
page.setDefaultTimeout(30 * 60 * 1000)
await page.goto(`http://127.0.0.1:${port}/page.html?csv=${csv}&shape=${shape}&release=1`)
await page.waitForFunction(() => document.title === 'done' || document.title === 'error')
const result = JSON.parse(await page.locator('#out').textContent())
// Resident size once the run has settled with both copies held.
let settled = 0
for (const p of contentProcesses(root)) settled = Math.max(settled, p.rss)
clearInterval(sampler)
const row = { engine, cpuThrottle: rate, ...result, peakContentRssMB: Math.round(peak / 1048576), settledContentRssMB: Math.round(settled / 1048576), sampledProcess: peakComm }
appendFileSync(outFile, JSON.stringify(row) + '\n')
console.log(JSON.stringify(row))
await browser.close()
await server.close()
