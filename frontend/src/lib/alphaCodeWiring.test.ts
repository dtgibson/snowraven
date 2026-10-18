// Source scans for species code search (species-code-search; PRD QA-28 to
// QA-30, QA-45, QA-47, QA-49, QA-57). Structural, so none of them can flake,
// and each says what it reads. Comments are stripped first, both forms, so a
// file's own explanation of a shape it forbids cannot fail it and a
// commented-out line cannot satisfy it (.claude/rules/testing.md).

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (repoRel: string) => readFileSync(new URL(`../../../${repoRel}`, import.meta.url), 'utf8')
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .map(l => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n')
}
const code = (repoRel: string) => stripComments(read(repoRel))

const NEW_MODULES = [
  'frontend/src/lib/alphaCodes.ts',
  'frontend/src/lib/alphaCodesAsset.ts',
  'frontend/src/lib/useAlphaCodes.ts',
]
// The three surfaces that rank through the shared rule and start the code load:
// Search, the shared picker, and (code-search-and-a11y-polish) the Media Targets
// view's Target Species list, which is its own component so MapExplorer.tsx can
// keep its call-site row below.
const CONSUMERS = [
  'frontend/src/components/SpeciesCombobox.tsx',
  'frontend/src/lib/paletteRows.ts',
  'frontend/src/components/map/TargetSpeciesList.tsx',
]
const CHANGED_MATCHING = [
  ...NEW_MODULES,
  'frontend/src/lib/speciesMatch.ts',
  'frontend/src/lib/paletteRows.ts',
  'frontend/src/components/SpeciesCombobox.tsx',
  'frontend/src/components/CommandPalette.tsx',
  'frontend/src/components/map/TargetSpeciesList.tsx',
]
const CALL_SITES = [
  'frontend/src/components/SpeciesDetail.tsx',
  'frontend/src/components/Calendar.tsx',
  'frontend/src/components/MapExplorer.tsx',
  'frontend/src/components/WeatherStatsSection.tsx',
]
// The Media Targets target-species box left this list on purpose
// (code-search-and-a11y-polish retired the 1.0.55 FR-21 / QA-29 pin): it now
// ranks through the shared rule in `map/TargetSpeciesList.tsx`, a CONSUMER above.
const OUT_OF_SCOPE = [
  'frontend/src/components/Checklists.tsx',               // the comment search
  'frontend/src/components/targets/TargetsCountyPicker.tsx',
  'frontend/src/components/NamedBirdTickList.tsx',
]
const CODE_MODULE_IMPORT = /from\s+['"][./]*(?:lib\/)?(?:alphaCodes|alphaCodesAsset|useAlphaCodes)['"]|ebird-alpha-codes/

describe('the call sites wire nothing, and out-of-scope surfaces are untouched (QA-28, QA-29, FR-20, FR-21)', () => {
  it.each(CALL_SITES)('%s imports neither the asset nor a code module', (path) => {
    expect(code(path)).not.toMatch(CODE_MODULE_IMPORT)
    expect(code(path)).toContain('<SpeciesCombobox')   // non-vacuity: it is a call site
  })

  it.each(OUT_OF_SCOPE)('%s does not import the code module', (path) => {
    expect(code(path)).not.toMatch(CODE_MODULE_IMPORT)
  })

  it('the three consumers DO import it (guards the negatives above)', () => {
    for (const path of CONSUMERS) {
      expect(code(path), path).toMatch(CODE_MODULE_IMPORT)
    }
  })

  it('MapExplorer hands the Media Targets list the same array as its species picker', () => {
    // So the code index, memoized per array identity, is built once for both.
    const src = code('frontend/src/components/MapExplorer.tsx')
    expect(src).toMatch(/<TargetSpeciesList\b[^>]*\brows=\{speciesOptions\}/)
    expect(src).toMatch(/<SpeciesCombobox\b[^>]*\boptions=\{speciesOptions\}/)
  })
})

describe('every consumer ranks through the shared rule with the imported predicate (schema.md 2.5, FR-13)', () => {
  it.each(CONSUMERS.map(p => [p]))('%s passes matchesSpeciesQuery to rankSpeciesMatches', (path) => {
    expect(code(path)).toMatch(/rankSpeciesMatches\([^;]*?\bmatchesSpeciesQuery\b/)
  })
})

describe('no regex, no localeCompare, no network (QA-45, QA-47, QA-49)', () => {
  it.each(NEW_MODULES)('%s constructs no RegExp and applies no regex method', (path) => {
    const src = code(path)
    expect(src).not.toContain('new RegExp')
    expect(src).not.toMatch(/\.(?:match|matchAll|replace|replaceAll|search|test|exec)\(/)
    // No regex literal at all: a `/.../` after an operator or bracket.
    expect(src).not.toMatch(/[=(,:]\s*\/[^/*\s][^/\n]*\/[dgimsuyv]*/)
  })

  it.each(CHANGED_MATCHING)('%s carries no localeCompare', (path) => {
    expect(code(path)).not.toContain('localeCompare')
  })

  it.each(NEW_MODULES)('%s imports no transport, storage, fetch or Tauri HTTP', (path) => {
    const src = code(path)
    expect(src).not.toMatch(/from\s+['"][^'"]*(?:transport|storage|plugin-http)['"]/)
    expect(src).not.toMatch(/\bfetch\(/)
  })
})

describe('no new user-facing text (QA-30, FR-22)', () => {
  it.each([
    ['frontend/src/components/SpeciesCombobox.tsx'],
    ['frontend/src/components/CommandPalette.tsx'],
    ['frontend/src/lib/paletteCopy.ts'],
    ['frontend/src/components/map/TargetSpeciesList.tsx'],
  ])('%s has no string that mentions a code', (path) => {
    expect(code(path)).not.toMatch(/['"`][^'"`\n]*\bcodes?\b[^'"`\n]*['"`]/i)
  })
})

// ── QA-57: the rule files' `paths` reach every file they now govern ───────────

function frontmatterPaths(rulePath: string): string[] {
  const src = read(rulePath)
  const fm = src.slice(src.indexOf('---') + 3, src.indexOf('\n---', 3))
  return [...fm.matchAll(/^\s*-\s*"([^"]+)"/gm)].map(m => m[1])
}
function globToRegExp(glob: string): RegExp {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]
    if (ch === '*' && glob[i + 1] === '*') { re += '.*'; i += 1 }
    else if (ch === '*') re += '[^/]*'
    else re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}
const covered = (rulePath: string, file: string) => frontmatterPaths(rulePath).some(g => globToRegExp(g).test(file))

describe('rule-file upkeep (QA-57, FR-32)', () => {
  it.each([
    ['frontend/src/lib/speciesMatch.ts'],
    ['frontend/src/lib/paletteRows.ts'],
    ['frontend/src/lib/alphaCodes.ts'],
    ['frontend/src/lib/alphaCodesAsset.ts'],
    ['frontend/src/lib/alphaCodes.test.ts'],
  ])('security.md gates %s', (file) => {
    expect(covered('.claude/rules/security.md', file)).toBe(true)
  })

  it.each([
    ['frontend/src/assets/ebird-alpha-codes.json'],
    ['frontend/src/lib/alphaCodes.ts'],
    ['frontend/src/lib/alphaCodesAsset.ts'],
    ['scripts/lib/ebirdTaxonomyDerive.mjs'],
    ['scripts/lib/ebirdTaxonomyDerive.d.mts'],
    ['scripts/build-ebird-taxonomy.mjs'],
  ])('bird-names.md gates %s', (file) => {
    expect(covered('.claude/rules/bird-names.md', file)).toBe(true)
  })

  it('the glob reader is not vacuous', () => {
    expect(frontmatterPaths('.claude/rules/security.md').length).toBeGreaterThan(20)
    expect(covered('.claude/rules/security.md', 'frontend/src/lib/notGatedAnywhere.ts')).toBe(false)
  })

  it('bird-names.md\'s annual-revision paragraph names the code asset', () => {
    const src = read('.claude/rules/bird-names.md')
    const para = src.split('\n').find(l => l.includes('The bundled eBird taxonomy snapshot is the OFFLINE FLOOR')) ?? ''
    expect(para).toContain('ebird-alpha-codes.json')
  })
})
