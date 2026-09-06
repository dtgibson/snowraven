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
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
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
  const server = createServer(async (req, res) => {
    let pathname
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    } catch {
      res.writeHead(400); res.end('bad request'); return
    }

    if (routes?.(pathname, req, res)) return

    const rel = distRelativePath(pathname)
    try {
      const body = await readFile(join(dist, rel))
      res.writeHead(200, { 'content-type': contentTypeFor(rel) })
      res.end(body)
      return
    } catch {
      // Falls through: missing file, or a directory (EISDIR).
    }

    if (fallback === '404') { res.writeHead(404); res.end('not found'); return }
    try {
      const body = await readFile(join(dist, 'index.html'))
      res.writeHead(200, { 'content-type': contentTypeFor('index.html') })
      res.end(body)
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
