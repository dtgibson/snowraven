// The published claims about Splits and Lumps (taxonomic-splits-lumps), pinned
// to the code that makes them true. Scoped to the feature's OWN passages in
// `docs/HELP.md` (the "Splits and lumps." paragraph and the "- Splits and
// Lumps:" bullet), each with a non-vacuity leg, so deleting a sentence goes red
// (.claude/rules/docs-and-website.md). README.md and website/index.html carry
// the feature as one item in the Species Detail paragraph, in the wording the
// user approved on 2026-09-30 (pipeline/taxonomic-splits-lumps/held-copy.md);
// the last describe below pins that paragraph, identical on both surfaces.
//
// Each claim and what holds it:
//   * "no network and no API key": the derivation, the copy and the loader
//     import no transport, storage or Tauri module (source scan below), and the
//     asset is bundled (entryChunk.test.ts holds it to its own lazy chunk).
//   * "default merged view only": both mount points are gated on
//     `mergeSubspecies` (source scan below; SplitsLumps.test.tsx drives it).
//   * "the counts cover your whole backup": the derivation takes no filter or
//     toggle as an input (its signature, below; SplitsLumps.test.tsx drives it).
//   * "state which updates it covers": the coverage copy is derived from the
//     asset, and the passage publishes the PROPERTY, never a year, so it cannot
//     go stale at the annual refresh.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
const HELP = read('docs/HELP.md')

function paragraph(start: string): string {
  const at = HELP.indexOf(start)
  expect(at, `docs/HELP.md carries "${start}"`).toBeGreaterThan(-1)
  const end = HELP.indexOf('\n', at)
  return HELP.slice(at, end === -1 ? undefined : end)
}

/** Strip comments so a guard never passes on a commented-out line. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const CONTROL = paragraph('**Splits and lumps.**')
const SECTION = paragraph('- Splits and Lumps:')

describe('docs/HELP.md, the Splits and Lumps passages', () => {
  it('both passages exist and sit in the Species Detail section', () => {
    const species = HELP.indexOf('\n## Species Detail\n')
    const next = HELP.indexOf('\n## ', species + 1)
    for (const p of [CONTROL, SECTION]) {
      const at = HELP.indexOf(p)
      expect(at).toBeGreaterThan(species)
      expect(at).toBeLessThan(next)
    }
  })

  it('carry no em dash and publish no covered year (the property, never the count)', () => {
    for (const p of [CONTROL, SECTION]) {
      expect(p).not.toContain('\u2014')
      expect(p).not.toMatch(/\b20\d\d\b/)
    }
  })

  it('"no network and no API key" holds: the feature\'s modules reach no transport, storage or Tauri seam', () => {
    expect(CONTROL).toMatch(/no network and no API key/)
    for (const f of ['lib/taxonomyHistory.ts', 'lib/taxonomyHistoryAsset.ts', 'lib/taxonomyHistoryCopy.ts', 'components/speciesDetail/SplitsLumps.tsx']) {
      const src = stripComments(read(`frontend/src/${f}`))
      expect(src, f).not.toMatch(/from '[^']*\/(transport|storage)'/)
      expect(src, f).not.toMatch(/from '[^']*\/tauri\//)
      expect(src, f).not.toMatch(/\bfetch\(/)
    }
  })

  it('"default merged view only" holds: both mount points are gated on merged mode', () => {
    for (const p of [CONTROL, SECTION]) expect(p).toMatch(/default merged view only/)
    const page = stripComments(read('frontend/src/components/SpeciesDetail.tsx'))
    expect(page).toMatch(/\{mergeSubspecies && history && historyIndex && \(\s*<SplitsLumpsSection/)
    const row = page.slice(page.indexOf('<div className="sr-taxtools">') - 80, page.indexOf('<SplitsLumpsControl'))
    expect(row).toMatch(/\{mergeSubspecies && \(/)
  })

  it('"the counts cover your whole backup" holds: the derivation takes no filter or toggle', () => {
    expect(SECTION).toMatch(/The counts cover your whole backup/)
    const src = stripComments(read('frontend/src/lib/taxonomyHistory.ts'))
    const sig = src.slice(src.indexOf('export function buildTaxonomyHistoryIndex('), src.indexOf('): TaxonomyHistoryIndex {'))
    expect(sig).toMatch(/observations: readonly ObservationEntry\[\],\s*history: TaxonomyHistory,\s*lookup: HistoryCodeLookup,/)
    expect(sig).not.toMatch(/county|date|filter|merge|spuh|escapee/i)
  })

  it('"never suggests which new species an older report belongs to" is stated', () => {
    expect(SECTION).toMatch(/never suggests which new species an older report belongs to/)
  })
})

// ---- README.md and website/index.html: the approved Species Detail paragraph --
//
// Approved by the user before it was written (CLAUDE.md, published copy). The
// two surfaces carry the same text; the website wraps it across lines, so both
// are compared whitespace-normalized. The item names the feature without a
// control name or a year, in the register's one-paragraph-per-tab shape.
const README = read('README.md')
const SITE = read('website/index.html')
const norm = (t: string) => t.replace(/\s+/g, ' ').trim()

function readmeSpeciesDetail(): string {
  const start = README.indexOf('\n### Species Detail\n')
  expect(start, 'README.md has a Species Detail section').toBeGreaterThan(-1)
  const body = README.slice(start + '\n### Species Detail\n'.length)
  return norm(body.slice(0, body.indexOf('\n### ')))
}

function siteSpeciesDetail(): string {
  const at = SITE.indexOf('<h3>Species Detail</h3>')
  expect(at, 'website/index.html has a Species Detail row').toBeGreaterThan(-1)
  const p = SITE.indexOf('<p>', at)
  return norm(SITE.slice(p + 3, SITE.indexOf('</p>', p)))
}

describe('README.md and website/index.html: the Species Detail paragraph', () => {
  it('names splits and lumps as one item, identically on both surfaces', () => {
    const readme = readmeSpeciesDetail()
    expect(readme).toMatch(/a map of every observation and any splits or lumps along the way\./)
    expect(siteSpeciesDetail()).toBe(readme)
  })

  it('carries no em dash and no year', () => {
    for (const p of [readmeSpeciesDetail(), siteSpeciesDetail()]) {
      expect(p).not.toContain('\u2014')
      expect(p).not.toMatch(/\b20\d\d\b/)
    }
  })
})
