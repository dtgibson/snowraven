// IMPORT-GRAPH GUARD (schema.md §2, FR-17, FR-35, QA-40).
//
// The Calendar's zero-network guarantee (v0.5.63) is enforced by the import
// graph rather than by discipline. The passive reader, the persistent store, and
// the pure model must never be able to reach `transport.ts` or any
// `lib/tauri/*Service` module; only `useExoticProvenance.ts` (the Statistics-only
// controller) may.
//
// Same graph-walking methodology as `entryChunk.test.ts`, and written as its
// SIBLING rather than an extension of it because the question is different:
// reachability of a network module, not entry-chunk membership.
//
// It walks STATIC value imports only. A `import()` is not an edge here, which is
// correct: `transport.ts` itself reaches every Tauri service that way, and a
// module that never statically imports transport cannot trigger one of those.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../', import.meta.url))       // frontend/src/

/**
 * Strip comments before scanning, tracking string and template state so a URL's
 * `//` is never mistaken for a line comment.
 *
 * This is NOT defensive tidiness: without it, the word "import" or "export"
 * inside a prose comment starts the lazy specifier match, which then runs
 * forward to the NEXT real `from '...'` and reports an edge that does not
 * exist. It happened on the first run of this very file — a comment in
 * `exoticCopy.ts` reading "export from a `.tsx` trips ..." made that
 * dependency-free module appear to reach `transport.ts`. Same comment-hijack
 * class the CSS guards' `parseTopLevelRules` strips for.
 */
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

/** Static import / re-export specifiers, EXCLUDING dynamic `import(` (which
 *  needs no whitespace after `import`, so it never matches) and type-only
 *  imports (erased at build, no runtime edge). */
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
  else return null                                                // bare (external)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}.css`, `${base}/index.ts`, `${base}/index.tsx`]
  return candidates.find(p => existsSync(p) && !p.endsWith('/')) ?? null
}

/** Transitive closure of a root's static graph, as src-relative paths. */
function closure(rootRelative: string): Set<string> {
  const root = resolve(SRC, rootRelative)
  expect(existsSync(root), `${rootRelative} must exist`).toBe(true)
  const files = new Set<string>()
  const stack = [root]
  while (stack.length) {
    const file = stack.pop()!
    if (files.has(file)) continue
    files.add(file)
    if (!/\.(ts|tsx)$/.test(file)) continue
    for (const spec of staticSpecifiers(readFileSync(file, 'utf8'))) {
      const target = resolveLocal(spec, file)
      if (target) stack.push(target)
    }
  }
  return new Set([...files].map(f => relative(SRC, f)))
}

const NETWORK_MODULES = /^(lib\/transport\.ts|lib\/tauri\/.*Service\.ts|lib\/tauri\/http\.ts|lib\/networkCache\.ts|lib\/replayStore\.ts)$/

function networkReach(rootRelative: string): string[] {
  return [...closure(rootRelative)].filter(f => NETWORK_MODULES.test(f)).sort()
}

describe('the passive provenance path can never reach the network (FR-35, QA-40)', () => {
  for (const root of [
    'lib/useProvenanceLookup.ts',
    'lib/exoticProvenanceCache.ts',
    'lib/exoticProvenance.ts',
    'lib/exoticCopy.ts',
  ]) {
    it(`${root} statically reaches no network module`, () => {
      expect(networkReach(root)).toEqual([])
    })
  }

  it('the passive reader does not reach the resolution CONTROLLER either', () => {
    // The controller is where `transport` lives, so this is the edge that would
    // reintroduce the dependency by the back door.
    expect(closure('lib/useProvenanceLookup.ts')).not.toContain('lib/useExoticProvenance.ts')
  })

  it('the passive reader really does reach the store and the model', () => {
    // Non-vacuity. A walker that resolved nothing at all would pass every
    // assertion above while proving nothing; this pins that the graph is real.
    const reached = closure('lib/useProvenanceLookup.ts')
    expect(reached).toContain('lib/exoticProvenanceCache.ts')
    expect(reached).toContain('lib/exoticProvenance.ts')
    expect(reached).toContain('lib/storage.ts')
    expect(reached.size).toBeGreaterThan(4)
  })

  it('the walker DOES detect a network module when one is genuinely reachable', () => {
    // Guard-the-guard: the same walker, pointed at the controller, must find
    // exactly the module the passive path is forbidden. Without this, a broken
    // matcher would report a clean result for every root above.
    expect(networkReach('lib/useExoticProvenance.ts')).toContain('lib/transport.ts')
  })
})

describe('the Calendar tab adds no network dependency (QA-40)', () => {
  it('the Calendar reads provenance through the passive hook only', () => {
    const code = readFileSync(resolve(SRC, 'components/Calendar.tsx'), 'utf8')
    expect(code).toContain("from '../lib/useProvenanceLookup'")
    expect(code).not.toContain('useExoticProvenance')
    // The tab's own promise: it computes purely from the already-loaded backup.
    for (const spec of staticSpecifiers(code)) {
      const target = resolveLocal(spec, resolve(SRC, 'components/Calendar.tsx'))
      if (!target) continue
      expect(NETWORK_MODULES.test(relative(SRC, target)), `Calendar must not import ${spec}`).toBe(false)
    }
  })

  it('nothing the Calendar statically imports can reach a network module', () => {
    expect(networkReach('components/Calendar.tsx')).toEqual([])
  })
})

describe('Species Detail reads the rule passively (species-detail-escapee-toggle)', () => {
  it('Species Detail reads provenance through the passive hook only', () => {
    // The tab already reaches `transport` for its own taxonomy batch, so the
    // Calendar's whole-closure assertion does not transfer; what is asserted is
    // the FR-17 half that does: the Show escapees layer is fed by the passive
    // reader, and the tab never becomes a second initiator by importing the
    // controller.
    const code = readFileSync(resolve(SRC, 'components/SpeciesDetail.tsx'), 'utf8')
    expect(code).toContain("from '../lib/useProvenanceLookup'")
    expect(code).not.toContain('useExoticProvenance')
  })
})

describe('only Statistics initiates a provenance request (FR-17, QA-22)', () => {
  it('useExoticProvenance is imported by exactly one component', () => {
    // A shared hook mounted outside Statistics would silently make some other
    // tab a requester. Enumerating the importers is what keeps that visible.
    const roots = ['components/BirdingStats.tsx', 'components/Calendar.tsx', 'components/MapExplorer.tsx', 'components/SpeciesDetail.tsx']
    const importers = roots.filter(r => closure(r).has('lib/useExoticProvenance.ts'))
    expect(importers).toEqual(['components/BirdingStats.tsx'])
  })
})
