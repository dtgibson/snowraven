// Build-inspection test (NFR-03 / QA-30) — the County overlay's maplibre-coupled
// code and its geometry asset must stay OFF the entry chunk, reachable only via
// `import()` / React.lazy. This is the same standing check CLAUDE.md applies
// manually to `vendor-maplibre` and `ca-atlas-blocks.json`, encoded as a test.
//
// Primary check (always runs, no build needed): walk App.tsx's STATIC import
// graph — following only value (non-type) relative / "@/" imports, NOT `import()`
// or `lazy(() => import())` — and assert CountyLayer.tsx and us-counties.json are
// absent. As methodology sanity, the known-lazy AtlasLayer / ca-atlas-blocks must
// also be absent, and no statically-reachable file may import maplibre.
//
// Secondary check (only when a production build exists): assert the county
// geometry chunk is not in dist/index.html's modulepreload — the literal
// vendor-maplibre standing check, extended to us-counties.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../', import.meta.url))        // frontend/src/
const APP = resolve(SRC, 'App.tsx')

// Static import / re-export specifiers in a TS/TSX source, EXCLUDING:
//  - dynamic `import(` (needs whitespace after `import`, so `import(` never matches)
//  - type-only `import type` / `export type` (erased at build — no runtime edge)
function staticSpecifiers(code: string): string[] {
  const specs: string[] = []
  const fromRe = /(?:import|export)\s+[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(code)) !== null) {
    if (/^(?:import|export)\s+type\b/.test(m[0].trim())) continue // type-only, erased
    specs.push(m[1])
  }
  const sideRe = /import\s*['"]([^'"]+)['"]/g                      // side-effect: import './x.css'
  while ((m = sideRe.exec(code)) !== null) specs.push(m[1])
  return specs
}

// Resolve a relative / "@/" specifier to an on-disk file; null for bare (node_modules).
function resolveLocal(spec: string, fromFile: string): string | null {
  const clean = spec.split('?')[0] // strip ?raw / ?worker
  let base: string
  if (clean.startsWith('@/')) base = resolve(SRC, clean.slice(2))
  else if (clean.startsWith('.')) base = resolve(dirname(fromFile), clean)
  else return null // bare specifier (external)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}.css`, `${base}/index.ts`, `${base}/index.tsx`]
  return candidates.find(p => existsSync(p) && !p.endsWith('/')) ?? null
}

// Transitive closure of App.tsx's static graph: resolved local file paths + the
// set of bare (external) specifiers reached.
function buildClosure(): { files: Set<string>; externals: Set<string> } {
  const files = new Set<string>()
  const externals = new Set<string>()
  const stack = [APP]
  while (stack.length) {
    const file = stack.pop()!
    if (files.has(file)) continue
    files.add(file)
    if (!/\.tsx?$/.test(file)) continue // only follow TS/TSX
    const specs = staticSpecifiers(readFileSync(file, 'utf8'))
    for (const spec of specs) {
      const local = resolveLocal(spec, file)
      if (local) { if (!files.has(local)) stack.push(local) }
      else if (!spec.startsWith('.') && !spec.startsWith('@/')) externals.add(spec)
    }
  }
  return { files, externals }
}

const { files, externals } = buildClosure()
const has = (suffix: string) => [...files].some(f => f.replace(/\\/g, '/').endsWith(suffix))

describe('entry-chunk exclusion (NFR-03 / QA-30)', () => {
  it('App.tsx does not statically import CountyLayer (it is lazy via MapExplorer)', () => {
    expect(has('components/map/CountyLayer.tsx')).toBe(false)
  })

  it('App.tsx does not statically import the county geometry asset', () => {
    expect(has('assets/us-counties.json')).toBe(false)
  })

  it('methodology sanity: the known-lazy AtlasLayer / ca-atlas-blocks are also absent', () => {
    // If these appeared, the resolver would be wrong (or someone broke the
    // map-lazy rule); the County checks above would then be meaningless.
    expect(has('components/AtlasLayer.tsx')).toBe(false)
    expect(has('assets/ca-atlas-blocks.json')).toBe(false)
  })

  it('no statically-reachable file imports maplibre (vendor-maplibre off first paint)', () => {
    const maplibre = [...externals].filter(s => s === 'maplibre-gl' || s.startsWith('react-map-gl'))
    expect(maplibre).toEqual([])
  })

  it('the App entry actually exists (guards against a broken closure root)', () => {
    expect(files.has(APP)).toBe(true)
    expect(files.size).toBeGreaterThan(20) // a real graph, not an empty/short-circuited one
  })
})

// Secondary: when a production build is present, assert the county chunk is not
// preloaded by the entry HTML — the literal CLAUDE.md vendor-maplibre check.
const DIST_INDEX = resolve(SRC, '../dist/index.html')
describe.skipIf(!existsSync(DIST_INDEX))('dist/index.html modulepreload (post-build)', () => {
  const html = existsSync(DIST_INDEX) ? readFileSync(DIST_INDEX, 'utf8') : ''
  it('does not modulepreload the county geometry chunk or maplibre', () => {
    const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map(m => m[1])
    expect(preloads.some(h => /us-counties|CountyLayer|vendor-maplibre/.test(h))).toBe(false)
  })
})
