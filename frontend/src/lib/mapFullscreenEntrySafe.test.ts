/// <reference types="node" />
//
// feature: map-fullscreen-toggle (NFR-03, QA-34) — the module-graph split this
// feature is built on, asserted directly.
//
// entryChunk.test.ts already carries the live guard ("no statically-reachable
// file imports maplibre") and is DELIBERATELY LEFT UNAMENDED: NamedBirdRow.tsx
// really is on App.tsx's walked graph and really does import lib/useMapFullscreen
// directly, so a maplibre edge from either new lib module surfaces there and
// turns that file red. Making it pass by editing it is the failure mode.
//
// What this file adds is belt-and-braces, in the shape of that file's own
// `closureFrom(...)` / `registry.files.size` check on lib/clearDerived.ts: the
// two new lib modules are dependency-free BY THEIR OWN CLOSURE, and the map-side
// module is reachable only from the three lazy hosts. Stating it here localizes
// a break to "someone added an import to the hook" rather than to "the entry
// chunk grew", which is what entryChunk.test.ts would say.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../', import.meta.url))
const APP = resolve(SRC, 'App.tsx')

/** Strip comments before scanning. Without it, the word `import` inside prose —
 *  and these files carry a great deal of prose about exactly which imports are
 *  forbidden — starts a specifier match that runs forward to the next real
 *  `from '...'` and reports an edge that does not exist. */
function stripComments(code: string): string {
  let out = ''
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && code[i + 1] === '*') {
      i += 2
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i += 1
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') { out += code[i]; i += 1 }
        if (i < code.length) { out += code[i]; i += 1 }
      }
      out += quote
      i += 1
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** Static, non-type specifiers. `import(` never matches (whitespace required). */
function staticSpecifiers(source: string): string[] {
  const code = stripComments(source)
  const specs: string[] = []
  const fromRe = /(?:import|export)\s+[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(code)) !== null) {
    if (/^(?:import|export)\s+type\b/.test(m[0].trim())) continue
    specs.push(m[1])
  }
  const sideRe = /import\s*['"]([^'"]+)['"]/g
  while ((m = sideRe.exec(code)) !== null) specs.push(m[1])
  return specs
}

function resolveLocal(spec: string, fromFile: string): string | null {
  const clean = spec.split('?')[0]
  let base: string
  if (clean.startsWith('@/')) base = resolve(SRC, clean.slice(2))
  else if (clean.startsWith('.')) base = resolve(dirname(fromFile), clean)
  else return null
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}.css`, `${base}/index.ts`, `${base}/index.tsx`]
  return candidates.find(p => existsSync(p) && !p.endsWith('/')) ?? null
}

function closureFrom(root: string): { files: Set<string>; externals: Set<string> } {
  const files = new Set<string>()
  const externals = new Set<string>()
  const stack = [root]
  while (stack.length) {
    const file = stack.pop()!
    if (files.has(file)) continue
    files.add(file)
    if (!/\.tsx?$/.test(file)) continue
    for (const spec of staticSpecifiers(readFileSync(file, 'utf8'))) {
      const local = resolveLocal(spec, file)
      if (local) { if (!files.has(local)) stack.push(local) }
      else if (!spec.startsWith('.') && !spec.startsWith('@/')) externals.add(spec)
    }
  }
  return { files, externals }
}

const rel = (p: string) => p.replace(/\\/g, '/').slice(SRC.replace(/\\/g, '/').length)
const mapExternals = (ext: Set<string>) =>
  [...ext].filter(s => s === 'maplibre-gl' || s.startsWith('react-map-gl'))

describe('the two entry-safe lib modules', () => {
  it('lib/useFocusTrap.ts imports react and NOTHING else', () => {
    const { files, externals } = closureFrom(resolve(SRC, 'lib/useFocusTrap.ts'))
    expect(files.size).toBe(1)                // itself, and no local edge at all
    expect([...externals]).toEqual(['react'])
  })

  it('lib/useMapFullscreen.ts imports react and the focus trap, and NOTHING else', () => {
    const { files, externals } = closureFrom(resolve(SRC, 'lib/useMapFullscreen.ts'))
    expect([...files].map(rel).sort()).toEqual(['lib/useFocusTrap.ts', 'lib/useMapFullscreen.ts'])
    expect([...externals]).toEqual(['react'])
  })

  it('BOTH are genuinely on App.tsx\'s static graph, which is what makes the above live', () => {
    // Guards the guard. If NamedBirdRow ever stopped importing the hook, or
    // Settings stopped importing ModalDialog, the map-free assertions above
    // would still pass and would be protecting nothing.
    const app = closureFrom(APP)
    const has = (suffix: string) => [...app.files].some(f => rel(f) === suffix)
    expect(has('lib/useMapFullscreen.ts')).toBe(true)
    expect(has('lib/useFocusTrap.ts')).toBe(true)
    expect(has('components/NamedBirdRow.tsx')).toBe(true)
    expect(has('components/ui/ModalDialog.tsx')).toBe(true)
    // ...and the entry graph is still map-free, which is the property the whole
    // split exists to preserve. entryChunk.test.ts owns this claim; it is
    // repeated here so a break in THIS feature localizes to THIS file.
    expect(mapExternals(app.externals)).toEqual([])
  })
})

describe('the map-side module stays off the entry chunk', () => {
  it('is absent from App.tsx\'s static closure', () => {
    const app = closureFrom(APP)
    expect([...app.files].some(f => rel(f) === 'components/map/MapCornerControls.tsx')).toBe(false)
  })

  it('is NOT imported by NamedBirdRow, which is the one host on the entry graph', () => {
    // NamedBirdRow reaches the row the same way it already reaches the map:
    // through `lazy(() => import('./SightingsMap'))`. A direct static import here
    // would put the ~1 MB maplibre vendor chunk on first paint.
    const row = closureFrom(resolve(SRC, 'components/NamedBirdRow.tsx'))
    expect([...row.files].some(f => rel(f) === 'components/map/MapCornerControls.tsx')).toBe(false)
    expect(mapExternals(row.externals)).toEqual([])
    // Non-vacuity: the row DOES have a graph, and it does reach the hook.
    expect([...row.files].some(f => rel(f) === 'lib/useMapFullscreen.ts')).toBe(true)
  })

  it('really does import maplibre, so the exclusions above are not trivially true', () => {
    const corner = closureFrom(resolve(SRC, 'components/map/MapCornerControls.tsx'))
    expect(mapExternals(corner.externals).length).toBeGreaterThan(0)
  })

  it('is reached from each of the three lazy hosts', () => {
    // The other half of the split: off the entry graph, and actually wired
    // everywhere it is meant to be.
    for (const host of ['components/SightingsMap.tsx', 'components/SpeciesDetail.tsx', 'components/BirdingStats.tsx']) {
      const { files } = closureFrom(resolve(SRC, host))
      expect([...files].some(f => rel(f) === 'components/map/MapCornerControls.tsx'), host).toBe(true)
    }
  })
})
