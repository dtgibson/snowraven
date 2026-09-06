// The real-engine verification gate.
//
// Runs every `verify-*.mjs` harness in this directory against a built
// `frontend/dist` in Chromium AND WebKit, and reports one exit code. Wired into
// `.github/workflows/pipeline.yml`'s frontend job immediately after
// `npm run build`.
//
//   npm run verify --prefix website/tools                 # this repo's dist
//   npm run verify --prefix website/tools -- <distDir>    # some other dist
//
// WHY A GATE THAT CAN SKIP MUST FAIL WHEN `CI` IS SET. `.claude/rules/
// testing.md`, from the v1.0.16 `npm audit --offline` post-mortem: a harness
// that skips when its dependency is missing is worse than no harness at all,
// because a green line then means "not run" and reads as "verified". That is
// the shape that rots. So:
//
//   * Playwright available            -> run every harness; exit 1 if any is red.
//   * unavailable and `CI` is unset   -> a loud, unmissable skip, exit 0. A
//                                        developer without the browsers
//                                        installed is not a broken build.
//   * unavailable and `CI` is set     -> exit 1, naming the missing piece. On a
//                                        machine that claims to verify, being
//                                        unable to is a failure.
//
// EACH HARNESS RUNS AS ITS OWN PROCESS. They are top-level-await scripts that
// own their servers, their browsers and their `process.exit`, so one that dies
// badly cannot take the others with it or leave a listening socket behind in
// this one.

import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { playwrightStatus } from './playwright.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_DIST = fileURLToPath(new URL('../../../frontend/dist/', import.meta.url))

// MEMBERSHIP COMES FROM THE DIRECTORY; THE LIST BELOW ONLY SETS ORDER.
//
// A hand-written roster wearing a "runs everything" claim is the same false
// assurance this gate exists to kill, moved one level up: drop a fourth harness
// in here, forget the roster, and the summary prints `3/3 green` over a
// denominator that silently shrank. So `verify-*.mjs` in this directory IS the
// roster, and an unlisted one RUNS rather than being skipped -- a file named
// like a harness, sitting in the gate's own directory, is a harness. The
// `verify-` prefix is what keeps the apparatus (`serveDist.mjs`,
// `playwright.mjs`, this file) and any scratch file out of the set.
//
// ORDER is still worth stating: fastest first, so a machine whose browsers are
// broken says so in seconds rather than after two full app loads, and the
// tab-premise harness first because it drives its own inline fixture rather
// than the app, so it is the one that still means something when the build
// itself is the problem. A name here that is NOT on disk is a failure, because
// it means a rename left this list stale.
const ORDER = [
  'verify-webkit-tab-premise.mjs',
  'verify-palette.mjs',
  'verify-backlog-alert.mjs',
]

// EVERY HARNESS GETS THE DIST, including the one that ignores it. A second
// roster saying which of them takes an argument is a list that drifts out of
// step with the directory, and an ignored argv entry costs nothing.
function discoverHarnesses() {
  // `isFile()` is load-bearing, not tidiness. A NAME-only filter admits a
  // directory called `verify-x.mjs/` (Node's CJS resolution then runs the
  // `index.js` inside it) and a symlink pointing anywhere at all -- both
  // measured executing and reporting PASS, which puts a non-harness in the
  // denominator and prints `N/N green` over it. That is the same false
  // assurance as an unlisted harness, one layer further down. A `Dirent` for a
  // symlink reports false here, so one predicate closes both.
  const found = readdirSync(HERE, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.startsWith('verify-') && e.name.endsWith('.mjs'))
    .map(e => e.name)
    .sort()
  return {
    ordered: ORDER.filter(f => found.includes(f)),
    unlisted: found.filter(f => !ORDER.includes(f)),
    stale: ORDER.filter(f => !found.includes(f)),
  }
}

// A hung harness is neither green nor red, which is the one outcome a gate may
// never have. 180 s is ~29x the slowest harness measured locally (6.2 s), so it
// cannot fire on contention, and three of them still finish inside the job's
// own `timeout-minutes`. Override for a slow machine with SR_VERIFY_TIMEOUT_MS;
// a non-positive or non-finite value falls back to the default rather than
// disabling the bound.
const DEFAULT_TIMEOUT_MS = 180_000
const rawTimeout = Number(process.env.SR_VERIFY_TIMEOUT_MS)
const TIMEOUT_MS = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_TIMEOUT_MS
const TIMEOUT_S = Math.round(TIMEOUT_MS / 1000)

const dist = resolve(process.argv[2] ?? process.env.SR_VERIFY_DIST ?? REPO_DIST)
const inCI = Boolean(process.env.CI)

function announce(lines) {
  console.log('')
  for (const l of lines) console.log(l)
  console.log('')
}

const status = playwrightStatus()
if (!status.ok) {
  const banner = '='.repeat(72)
  if (inCI) {
    announce([
      banner,
      'VERIFICATION GATE FAILED: the real-engine harnesses could not run.',
      banner,
      `  ${status.reason}`,
      `  fix: ${status.fix}`,
      '',
      '  CI is set, so this is a failure rather than a skip. A gate that skips',
      '  silently reports "not run" as "verified" -- see .claude/rules/testing.md.',
      banner,
    ])
    process.exit(1)
  }
  announce([
    banner,
    'VERIFICATION GATE SKIPPED -- NOTHING WAS MEASURED.',
    banner,
    `  ${status.reason}`,
    `  fix: ${status.fix}`,
    '',
    '  Nothing below this line was verified in a real engine. Set CI=1 to make',
    '  this a failure instead of a skip.',
    banner,
  ])
  process.exit(0)
}

if (!existsSync(resolve(dist, 'index.html'))) {
  announce([
    'VERIFICATION GATE FAILED: no build to verify.',
    `  ${resolve(dist, 'index.html')} does not exist.`,
    '  fix: npm run build --prefix frontend',
  ])
  process.exit(1)
}

const { ordered, unlisted, stale } = discoverHarnesses()
if (stale.length) {
  announce([
    'VERIFICATION GATE FAILED: the run order names a harness that is not here.',
    `  missing: ${stale.join(', ')}`,
    '  fix: restore the file, or drop its name from ORDER in run.mjs.',
  ])
  process.exit(1)
}
const harnesses = [...ordered, ...unlisted]
if (!harnesses.length) {
  announce(['VERIFICATION GATE FAILED: no verify-*.mjs harness found in this directory.'])
  process.exit(1)
}
if (unlisted.length) {
  console.log(`note: ${unlisted.join(', ')} found on disk but not in ORDER -- running last.`)
  console.log('      add it to ORDER in run.mjs if where it runs matters.')
}

console.log(`verification gate: ${harnesses.length} harnesses against ${dist}`)

// A detached child is its own process group, so a timeout kills the harness AND
// the browsers it spawned. Without that, a killed harness leaves WebKit and
// Chromium processes behind to tax every later run on the machine.
let live = null
function killTree(child, signal) {
  try {
    process.kill(-child.pid, signal)
  } catch {
    try { child.kill(signal) } catch { /* already gone */ }
  }
}
// SIGHUP IS NOT OPTIONAL HERE. Detaching bought the ability to kill a hung
// harness's browsers with it; the price is that the child no longer dies with
// the parent's foreground process group, so every signal that can end this
// process has to be handled or the detach leaks through the gap. SIGHUP is a
// closed terminal window, and it was measured orphaning the harness and both
// browsers before it was on this list.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    if (live) killTree(live, 'SIGKILL')
    process.exit(130)
  })
}

function runHarness(name) {
  const args = [resolve(HERE, name), dist]
  return new Promise(done => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', detached: true })
    live = child
    let timedOut = false
    let hardKill
    const timer = setTimeout(() => {
      timedOut = true
      console.log(`\n  ${name}: no result after ${TIMEOUT_S}s. Killing it -- a hung`)
      console.log('  harness is a FAILURE, never a skip, for the same reason a')
      console.log('  missing dependency is one under CI.')
      killTree(child, 'SIGTERM')
      hardKill = setTimeout(() => killTree(child, 'SIGKILL'), 5000)
    }, TIMEOUT_MS)
    const finish = (code, reason) => {
      clearTimeout(timer)
      clearTimeout(hardKill)
      live = null
      done({ name, code, reason })
    }
    child.on('error', err => finish(1, err.message))
    child.on('close', code => (timedOut
      ? finish(1, `timed out after ${TIMEOUT_S}s`)
      : finish(code ?? 1)))
  })
}

const results = []
for (const name of harnesses) {
  console.log(`\n${'-'.repeat(72)}\n${name}\n${'-'.repeat(72)}`)
  results.push(await runHarness(name))
}

const red = results.filter(r => r.code !== 0)
console.log(`\n${'='.repeat(72)}`)
for (const r of results) {
  console.log(`  ${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.name}${r.reason ? `  (${r.reason})` : ''}`)
}
console.log(red.length === 0
  ? `verification gate: ${results.length}/${results.length} harnesses green`
  : `verification gate: ${red.length} of ${results.length} harnesses RED`)
console.log('='.repeat(72))
process.exit(red.length === 0 ? 0 : 1)
