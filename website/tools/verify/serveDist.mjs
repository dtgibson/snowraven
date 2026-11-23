// Shared APPARATUS for the real-engine verification gate: a loopback static
// server over a built `frontend/dist`.
//
// WHY IT IS SHARED. The two promoted harnesses that need a server each carried
// a near-duplicate of one, and each had a property the other lacked. The
// palette harness normalized the request path and stripped a leading `..`
// (traversal); the backlog harness did neither. Neither had the `Object.hasOwn`
// MIME guard the backlog harness's own header asked a promoting build to fold
// in. One module carries both, so the third harness inherits them instead of
// re-deriving them -- and a fourth cannot get one and miss the other.
//
// WHAT IS APPARATUS AND WHAT IS SCENARIO. This module serves files and nothing
// else. A harness whose SCENARIO is a particular backend state -- the backlog
// harness's stored-but-unreadable eBird backup -- passes it as a `routes`
// handler and keeps ownership of it, because that stub IS the measurement. The
// same line decides what an environment variable may override: the base URL is
// apparatus and is overridable, a stub backend is not.

import { createServer } from 'node:http'
import { readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, extname, join, normalize } from 'node:path'

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.otf': 'font/otf', '.ttf': 'font/ttf',
}

// -- A face for a local run (family-rollups-and-tree D-70) --------------------
//
// The app bundles no font: its stack names 'Inter' first, and GitHub's runner
// installs it (`fonts-inter` in pipeline.yml), so the gate there measures text
// in Inter. A Mac without Inter measures the next face in the stack, which is
// how a 5.45px overflow in Inter passed every local run of the 1.0.76 build.
// `SR_VERIFY_FACE_DIR` closes that without installing anything: it names a
// directory of one family's static font files, named as Debian's package
// names them (`Inter-Regular.otf`, `Inter-SemiBoldItalic.otf`, ...), and when
// it is set this server serves them under `/__verify-face/` and gives the page
// an `@font-face` rule per file, so every harness the gate runs draws that
// family as the runner does. `SR_VERIFY_FACE_FAMILY` names the family
// (default `Inter`); files of any other family in the directory are ignored.
// It is never set on CI, which has the face installed, and no font file is
// committed. The harness that measures text still names the face it measured.

const FACE_ROUTE = '/__verify-face/'
const FACE_WEIGHTS = {
  Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500,
  SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
}
const FACE_FORMATS = { '.otf': 'opentype', '.ttf': 'truetype', '.woff2': 'woff2' }

/**
 * The faces a directory offers for `family`: one entry per file named
 * `<family>-<Style>.<otf|ttf|woff2>`, where Style is a weight name, a weight
 * name followed by `Italic`, or `Italic` alone (Regular italic).
 */
export function facesIn(dir, family = 'Inter') {
  const out = []
  for (const file of readdirSync(dir)) {
    const ext = extname(file)
    if (!Object.hasOwn(FACE_FORMATS, ext)) continue
    const m = /^([A-Za-z]+)-([A-Za-z]+)$/.exec(basename(file, ext))
    if (!m || m[1] !== family) continue
    const italic = m[2].endsWith('Italic')
    const weightName = italic ? (m[2] === 'Italic' ? 'Regular' : m[2].slice(0, -'Italic'.length)) : m[2]
    if (!Object.hasOwn(FACE_WEIGHTS, weightName)) continue
    out.push({ file, weight: FACE_WEIGHTS[weightName], style: italic ? 'italic' : 'normal', format: FACE_FORMATS[ext] })
  }
  return out
}

/** The `<style>` and eager loads that give the page `family` from the served files. */
export function faceInjection(faces, family = 'Inter') {
  const rules = faces.map(f => `@font-face{font-family:'${family}';font-style:${f.style};font-weight:${f.weight};`
    + `font-display:block;src:url('${FACE_ROUTE}${f.file}') format('${f.format}')}`).join('')
  const loads = JSON.stringify(faces.map(f => `${f.style} ${f.weight} 16px '${family}'`))
  return `<style id="sr-verify-face">${rules}</style><script>for (const d of ${loads}) document.fonts.load(d)</script>`
}


/**
 * Content type for a served path.
 *
 * `.claude/rules/security.md` (v0.5.81): a lookup table keyed by an unvalidated
 * string is read through `Object.hasOwn`, so the lookup is allowlist driven. A
 * bare `TYPES[ext]` returns a truthy INHERITED member for at least twelve keys
 * (`constructor`, `__proto__`, `toString`, ...), and `?? fallback` does not see
 * an inherited value at all. The invariant that made the bare form safe here --
 * `extname` returns either `''` or a leading-dot string, and no
 * `Object.prototype` member begins with a dot -- is one refactor of the key
 * away from being untrue, and this is tooling now rather than a throwaway.
 */
export function contentTypeFor(pathname) {
  const ext = extname(pathname)
  return Object.hasOwn(TYPES, ext) ? TYPES[ext] : 'application/octet-stream'
}

/**
 * Map a request pathname to a path relative to the dist root.
 *
 * `normalize` collapses `.` and `..` segments; because a request pathname is
 * always absolute, a traversal attempt resolves inside the root rather than
 * above it, and the leading-`..` strip covers the relative forms `normalize`
 * leaves in place on either separator.
 */
export function distRelativePath(pathname) {
  const p = pathname === '/' ? '/index.html' : pathname
  return normalize(p).replace(/^(\.\.[/\\])+/, '')
}

/**
 * Serve `dist` on an ephemeral loopback port.
 *
 * @param {string} dist              absolute path to a built frontend/dist
 * @param {object} [opts]
 * @param {(pathname: string, req: import('node:http').IncomingMessage,
 *          res: import('node:http').ServerResponse) => boolean} [opts.routes]
 *        scenario hook, called before any file is served. Return true when the
 *        response has been written; anything else falls through to the files.
 * @param {'index' | '404'} [opts.fallback]
 *        what an unknown path gets. `index` is the SPA fallback; `404` is for a
 *        harness that deliberately drives the app with no backend answering.
 * @returns {Promise<{ base: string, close: () => Promise<void> }>}
 */
export async function serveDist(dist, { routes, fallback = 'index' } = {}) {
  const faceDir = process.env.SR_VERIFY_FACE_DIR || null
  const faceFamily = process.env.SR_VERIFY_FACE_FAMILY || 'Inter'
  const faces = faceDir ? facesIn(faceDir, faceFamily) : []
  if (faceDir && faces.length === 0) throw new Error(`SR_VERIFY_FACE_DIR holds no ${faceFamily}-<Style> font files`)
  const faceFiles = new Set(faces.map(f => f.file))
  const sendIndex = (res, body) => {
    res.writeHead(200, { 'content-type': contentTypeFor('index.html') })
    res.end(faces.length ? body.toString('utf8').replace('</head>', `${faceInjection(faces, faceFamily)}</head>`) : body)
  }
  const server = createServer(async (req, res) => {
    let pathname
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    } catch {
      res.writeHead(400); res.end('bad request'); return
    }

    if (routes?.(pathname, req, res)) return

    // Only a file `facesIn` listed, by its exact name: nothing else in the
    // directory, and no path, is reachable through this route.
    if (faces.length && pathname.startsWith(FACE_ROUTE)) {
      const name = pathname.slice(FACE_ROUTE.length)
      if (!faceFiles.has(name)) { res.writeHead(404); res.end('not found'); return }
      res.writeHead(200, { 'content-type': contentTypeFor(name) })
      res.end(await readFile(join(faceDir, name)))
      return
    }

    const rel = distRelativePath(pathname)
    try {
      const body = await readFile(join(dist, rel))
      if (rel === normalize('/index.html')) { sendIndex(res, body); return }
      res.writeHead(200, { 'content-type': contentTypeFor(rel) })
      res.end(body)
      return
    } catch {
      // Falls through: missing file, or a directory (EISDIR).
    }

    if (fallback === '404') { res.writeHead(404); res.end('not found'); return }
    try {
      sendIndex(res, await readFile(join(dist, 'index.html')))
    } catch {
      res.writeHead(404); res.end('not found')
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  }
}
