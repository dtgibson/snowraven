// Loopback server for page.html: the harness files, the CSVs under /csv/, and
// POST /result appended to a JSON-lines file. Binds 127.0.0.1 only (the iOS
// simulator shares the Mac's loopback; the Android emulator reaches it as
// 10.0.2.2).   node serve.mjs <port> <csv dir> <results.jsonl> <bundle.js>
import { createServer } from 'node:http'
import { createReadStream, readFileSync, appendFileSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('.', import.meta.url))
const [port, csvDir, results, bundle] = process.argv.slice(2)
createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  if (req.method === 'POST' && u.pathname === '/result') {
    let b = ''; req.on('data', c => { b += c }); req.on('end', () => { appendFileSync(results, b + '\n'); console.log(b); res.end('ok') }); return
  }
  if (u.pathname === '/page.html' || u.pathname === '/') { res.setHeader('content-type', 'text/html'); res.end(readFileSync(join(here, 'page.html'))); return }
  if (u.pathname === '/page-bundle.js') { res.setHeader('content-type', 'text/javascript'); res.end(readFileSync(bundle)); return }
  if (u.pathname.startsWith('/csv/')) {
    const f = join(csvDir, basename(u.pathname))
    try { const st = statSync(f); res.setHeader('content-type', 'text/csv; charset=utf-8'); res.setHeader('content-length', st.size); createReadStream(f).pipe(res) } catch { res.statusCode = 404; res.end() }
    return
  }
  res.statusCode = 404; res.end()
}).listen(Number(port), '127.0.0.1', () => console.log('listening', port))
