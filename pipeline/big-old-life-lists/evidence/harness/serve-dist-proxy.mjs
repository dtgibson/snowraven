// A built frontend/dist on loopback, with the backend's route prefixes proxied
// to a running backend, so two builds can be driven against ONE data folder
// side by side (decisions.md entry 2, the identical-output check).
//   node serve-dist-proxy.mjs <port> <dist dir> <backend origin>
import { createServer, request } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const [port, dist, backend] = process.argv.slice(2)
const API = /^\/(weather|tide|checklists|health|version|nominatim|taxonomy|settings|map|media|stats)(\/|$|\?)/
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' }
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (API.test(url.pathname)) {
    const b = new URL(backend)
    const p = request({ host: b.hostname, port: b.port, path: req.url, method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res) })
    p.on('error', () => { res.statusCode = 502; res.end() })
    req.pipe(p)
    return
  }
  const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '')
  try {
    const body = await readFile(join(dist, rel))
    res.setHeader('content-type', Object.hasOwn(TYPES, extname(rel)) ? TYPES[extname(rel)] : 'application/octet-stream')
    res.end(body)
  } catch {
    res.setHeader('content-type', 'text/html')
    res.end(await readFile(join(dist, 'index.html')))
  }
}).listen(Number(port), '127.0.0.1')
