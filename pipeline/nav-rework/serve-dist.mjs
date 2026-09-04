// Minimal loopback static server for frontend/dist, for the nav layout harness.
// Loopback only (127.0.0.1), no tailscale, no browser window.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('../../frontend/dist/', import.meta.url).pathname
const PORT = Number(process.argv[2] || 45817)
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.webp': 'image/webp',
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  if (p === '/' || p.endsWith('/')) p = '/index.html'
  let file = join(ROOT, p)
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    // SPA fallback; API calls have no backend here and return 503 on purpose.
    if (/^\/(weather|tide|checklists|health|version|nominatim|taxonomy|settings|map|media|stats)\b/.test(p)) {
      res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"error":"no backend"}'); return
    }
    try {
      const body = await readFile(join(ROOT, 'index.html'))
      res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(body)
    } catch { res.writeHead(404); res.end('not found') }
  }
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`))
