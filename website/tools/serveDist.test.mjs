// The shared static server's face support (family-rollups-and-tree D-70).
//
// `verify/serveDist.mjs` serves every harness the real-engine gate runs, so
// what its face support adds must be inert unless asked for: with
// `SR_VERIFY_FACE_DIR` unset, `index.html` is served byte for byte as built.
// When it is set, only the listed face files are reachable, by exact name, and
// the page gets one `@font-face` rule per file for the named family.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { facesIn, faceInjection, serveDist } from './verify/serveDist.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'sr-servedist-'))
  const dist = join(root, 'dist')
  const faces = join(root, 'faces')
  mkdirSync(dist)
  mkdirSync(faces)
  writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>t</title></head><body></body></html>')
  for (const f of ['Inter-Regular.otf', 'Inter-SemiBold.otf', 'Inter-BoldItalic.otf', 'Inter-Italic.otf',
    'InterDisplay-Regular.otf', 'Inter-Wide.otf', 'Inter-Regular.txt', 'notes.otf']) writeFileSync(join(faces, f), f)
  writeFileSync(join(root, 'secret.txt'), 'never served')
  return { root, dist, faces }
}

async function get(base, path) {
  const res = await fetch(base + path)
  return { status: res.status, type: res.headers.get('content-type'), body: await res.text() }
}

test('facesIn lists one family by weight and style, and nothing else', () => {
  const { root, faces } = fixture()
  try {
    const got = facesIn(faces).map(f => `${f.file}:${f.weight}:${f.style}:${f.format}`).sort()
    assert.deepEqual(got, [
      'Inter-BoldItalic.otf:700:italic:opentype',
      'Inter-Italic.otf:400:italic:opentype',
      'Inter-Regular.otf:400:normal:opentype',
      'Inter-SemiBold.otf:600:normal:opentype',
    ])
    assert.equal(facesIn(faces, 'InterDisplay').length, 1)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('faceInjection writes one @font-face per file for the family', () => {
  const css = faceInjection([{ file: 'Inter-SemiBold.otf', weight: 600, style: 'normal', format: 'opentype' }])
  assert.match(css, /@font-face\{font-family:'Inter';font-style:normal;font-weight:600;font-display:block;src:url\('\/__verify-face\/Inter-SemiBold\.otf'\) format\('opentype'\)\}/)
})

test('unset, the page is served exactly as built and no face route exists', async () => {
  const { root, dist } = fixture()
  const saved = process.env.SR_VERIFY_FACE_DIR
  delete process.env.SR_VERIFY_FACE_DIR
  const { base, close } = await serveDist(dist)
  try {
    const page = await get(base, '/')
    assert.equal(page.body, '<!doctype html><html><head><title>t</title></head><body></body></html>')
    assert.equal((await get(base, '/some/route')).body, page.body)
    assert.doesNotMatch((await get(base, '/__verify-face/Inter-Regular.otf')).body, /Inter-Regular/)
  } finally {
    await close()
    if (saved !== undefined) process.env.SR_VERIFY_FACE_DIR = saved
    rmSync(root, { recursive: true, force: true })
  }
})

test('set, the listed files are served by exact name, the page gains the rules, and nothing else is reachable', async () => {
  const { root, dist, faces } = fixture()
  const saved = process.env.SR_VERIFY_FACE_DIR
  process.env.SR_VERIFY_FACE_DIR = faces
  const { base, close } = await serveDist(dist)
  try {
    const page = await get(base, '/index.html')
    assert.match(page.body, /<style id="sr-verify-face">.*Inter-SemiBold\.otf.*<\/style><script>.*<\/script><\/head>/)
    assert.equal((await get(base, '/deep/route')).body, page.body)
    const font = await get(base, '/__verify-face/Inter-SemiBold.otf')
    assert.equal(font.status, 200)
    assert.equal(font.type, 'font/otf')
    // In the route, only a listed name answers.
    for (const path of ['/__verify-face/InterDisplay-Regular.otf', '/__verify-face/notes.otf', '/__verify-face/Inter-Regular.txt',
      '/__verify-face/%2e%2e%2fsecret.txt', '/__verify-face/']) {
      assert.equal((await get(base, path)).status, 404, path)
    }
    // A dot segment the URL parser resolves never reaches the route, and
    // nothing outside the dist is served either way.
    assert.notEqual((await get(base, '/__verify-face/../secret.txt')).body, 'never served')
  } finally {
    await close()
    if (saved === undefined) delete process.env.SR_VERIFY_FACE_DIR
    else process.env.SR_VERIFY_FACE_DIR = saved
    rmSync(root, { recursive: true, force: true })
  }
})
