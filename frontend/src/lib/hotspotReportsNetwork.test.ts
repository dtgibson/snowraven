// NETWORK POSTURE, MADE CHECKABLE (hotspot-reports schema section 11; NFR-01,
// QA-17, QA-56's static half, QA-62, QA-63; QA-71's static half).
//
// The Hotspot Reports tab adds no endpoint, no host and no request of its own
// beyond ONE batched `/taxonomy/codes` post. It reads the hotspot kind through
// the shared Set (`useHotspotSet`, which starts the shared build and adds no
// request), reads the escapee classification passively, and persists nothing.
// The import-graph half of that claim lives in `exoticProvenanceGraph.test.ts`;
// this file is the source half, and it is what bounds `hotspotReportsKind.ts`,
// which reaches `transport` through `hotspotSet.ts` by design.
//
// HOW IT READS THE SOURCES. The subjects are DERIVED from the directory, never
// listed, so a new file of the feature joins the scan by existing: every
// `lib/hotspotReports*.ts` and everything under `components/hotspotReports/`,
// test files excluded, with `withFileTypes` and `isFile()` deciding what counts
// as a file (testing.md v1.0.20). Comments are removed by the TypeScript
// printer, not a character walker: JSX text may hold an apostrophe, which a
// quote-tracking walker reads as the start of a string, after which it can
// take a real string's `https://` for a comment and drop it. The printer keeps
// every string literal and every JSX text exactly as written.
//
// WHAT IT CANNOT SEE, stated rather than implied. A source scan sees only the
// feature's own files: a request made by a module they import (HotspotLink,
// the shared hotspot Set, the passive provenance store) is bounded by those
// modules' own guards and by the graph rows. And a call spelled through an
// alias the patterns do not name (a `transport` re-bound to another name) is
// caught only by the import row below, which pins WHO imports transport.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import ts from 'typescript'

const SRC = fileURLToPath(new URL('../', import.meta.url))        // frontend/src/

/** The source with every comment removed, string literals and JSX text kept. */
function codeOf(rel: string, text: string): string {
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind)
  return ts.createPrinter({ removeComments: true }).printFile(sf)
}

/** Every non-test source file of the feature, as src-relative paths. */
function featureFiles(): string[] {
  const out: string[] = []
  for (const d of readdirSync(join(SRC, 'lib'), { withFileTypes: true })) {
    if (d.isFile() && /^hotspotReports[A-Za-z]*\.ts$/.test(d.name)) out.push(`lib/${d.name}`)
  }
  const walk = (dir: string) => {
    for (const d of readdirSync(join(SRC, dir), { withFileTypes: true })) {
      const rel = `${dir}/${d.name}`
      if (d.isDirectory()) walk(rel)
      else if (d.isFile() && /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name)) out.push(rel)
    }
  }
  walk('components/hotspotReports')
  return out.sort()
}

const FILES = featureFiles()
const CODE = new Map(FILES.map(f => [f, codeOf(f, readFileSync(join(SRC, f), 'utf8'))]))

/** Occurrences of `re` (global) in one file's code. */
function count(code: string, re: RegExp): number {
  return [...code.matchAll(re)].length
}

/** The files whose code matches `re`, each with its count. */
function hits(re: RegExp): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [f, code] of CODE) {
    const n = count(code, re)
    if (n) out[f] = n
  }
  return out
}

// The forbidden shapes, each written to catch the spellings the defect could
// return in rather than one literal.
const NO_NETWORK: [string, RegExp][] = [
  ['fetch(', /\bfetch\s*\(/g],
  ['XMLHttpRequest', /XMLHttpRequest/g],
  ['navigator.sendBeacon', /\bsendBeacon\b/g],
  ['<iframe', /<iframe\b/gi],
  ["an 'iframe' element name", /['"`]iframe['"`]/gi],
  ['https://', /https:\/\//g],
  ['http://', /http:\/\//g],
  ['window.open', /\bwindow\s*\.\s*open\b/g],
]
const NO_SET_BUILD: [string, RegExp][] = [
  ['getHotspotSet(', /\bgetHotspotSet\s*\(/g],
  ['loadHotspotSet(', /\bloadHotspotSet\s*\(/g],
  ['buildHotspotSet(', /\bbuildHotspotSet\s*\(/g],
  ['dedupedFetch(', /\bdedupedFetch\s*\(/g],
  ['invalidateHotspotSet(', /\binvalidateHotspotSet\s*\(/g],
]
const NO_WRITE: [string, RegExp][] = [
  ['storage.set', /\bstorage\s*\.\s*set/g],
  ['storage.delete', /\bstorage\s*\.\s*delete/g],
  ['storage.write', /\bstorage\s*\.\s*write/g],
  ['localStorage', /localStorage/g],
]
const NO_PLATFORM: [string, RegExp][] = [
  ['isTauri()', /\bisTauri\s*\(/g],
  ['isIOS()', /\bisIOS\s*\(/g],
  ['isAndroid()', /\bisAndroid\s*\(/g],
]
const TRANSPORT_USE = /\btransport\s*\.\s*/g

describe('the scan is real before it is trusted', () => {
  it('covers every file of the feature, so it cannot pass on an empty set', () => {
    for (const f of [
      'lib/hotspotReports.ts', 'lib/hotspotReportsPicker.ts', 'lib/hotspotReportsLocation.ts',
      'lib/hotspotReportsKind.ts', 'lib/hotspotReportsProvenance.ts', 'lib/hotspotReportsCopy.ts',
      'components/hotspotReports/HotspotReportsTab.tsx', 'components/hotspotReports/HotspotReportsPicker.tsx',
      'components/hotspotReports/HotspotReportsOverview.tsx', 'components/hotspotReports/HotspotReport.tsx',
      'components/hotspotReports/HotspotReportHeader.tsx', 'components/hotspotReports/HotspotReportLifeList.tsx',
      'components/hotspotReports/HotspotReportSections.tsx', 'components/hotspotReports/HotspotReportsParts.tsx',
      'components/hotspotReports/HotspotReportMap.tsx',
    ]) expect(FILES, `the scan must include ${f}`).toContain(f)
    // No test file is a subject: a test names the forbidden shapes on purpose.
    expect(FILES.filter(f => /\.test\./.test(f))).toEqual([])
    for (const [f, code] of CODE) expect(code.length, `${f} was read`).toBeGreaterThan(200)
  })

  it('removes comments and keeps code, strings and JSX text (the strip, proved)', () => {
    // A comment naming a forbidden shape is invisible to the scan...
    const commented = codeOf('x.tsx', "// fetch('https://a')\n/* window.open() */\nexport const a = 1\n")
    expect(count(commented, /\bfetch\s*\(/g)).toBe(0)
    expect(count(commented, /https:\/\//g)).toBe(0)
    expect(count(commented, /\bwindow\s*\.\s*open\b/g)).toBe(0)
    // ...while the same shapes in code, in a string after a JSX apostrophe, and
    // in JSX text itself are all seen.
    const live = codeOf('x.tsx', "export const A = () => <p>It's here {'https://a'}</p>\nexport const b = () => fetch('/x')\n")
    expect(count(live, /https:\/\//g)).toBe(1)
    expect(count(live, /\bfetch\s*\(/g)).toBe(1)
    expect(live).toContain("It's here")
    // And on the real tab: its header comment is gone, its one request is not.
    const tab = CODE.get('components/hotspotReports/HotspotReportsTab.tsx')!
    expect(readFileSync(join(SRC, 'components/hotspotReports/HotspotReportsTab.tsx'), 'utf8')).toContain('REQUESTS (NFR-01)')
    expect(tab).not.toContain('REQUESTS (NFR-01)')
    expect(tab).toContain('transport.post')
  })
})

describe('the feature makes no request of its own beyond the codes batch (NFR-01)', () => {
  it.each(NO_NETWORK)('no file of the feature contains %s', (_label, re) => {
    expect(hits(re)).toEqual({})
  })

  it('`transport.` appears exactly once across the feature: the /taxonomy/codes post in the tab', () => {
    expect(hits(TRANSPORT_USE)).toEqual({ 'components/hotspotReports/HotspotReportsTab.tsx': 1 })
    const tab = CODE.get('components/hotspotReports/HotspotReportsTab.tsx')!
    expect(tab).toMatch(/\btransport\.post\b[^(]*\(\s*['"]\/taxonomy\/codes['"]/)
  })

  it('only the tab imports transport, under its own name', () => {
    const importers: string[] = []
    for (const [f, code] of CODE) {
      if (/from\s*['"][./]*(?:lib\/)?transport['"]/.test(code)) importers.push(f)
    }
    expect(importers).toEqual(['components/hotspotReports/HotspotReportsTab.tsx'])
    const tab = CODE.get('components/hotspotReports/HotspotReportsTab.tsx')!
    expect(tab).toMatch(/import\s*\{\s*transport\s*\}\s*from\s*['"]\.\.\/\.\.\/lib\/transport['"]/)
  })
})

describe('the hotspot Set is read, never built here (QA-17)', () => {
  it.each(NO_SET_BUILD)('no file of the feature calls %s', (_label, re) => {
    expect(hits(re)).toEqual({})
  })

  it('`useHotspotSet(` appears exactly once, in the tab', () => {
    expect(hits(/\buseHotspotSet\s*\(/g)).toEqual({ 'components/hotspotReports/HotspotReportsTab.tsx': 1 })
  })
})

describe('nothing is persisted (FR-58, QA-56 static half)', () => {
  it.each(NO_WRITE)('no file of the feature contains %s', (_label, re) => {
    expect(hits(re)).toEqual({})
  })

  it('the storage seam is read, which is what makes the write absence mean something', () => {
    // Positive leg: the tab really does hold the seam (the files status and
    // the key check), so a scan reporting no writes is reading the right name.
    const tab = CODE.get('components/hotspotReports/HotspotReportsTab.tsx')!
    expect(count(tab, /\bstorage\s*\.\s*get/g)).toBeGreaterThan(0)
  })
})

describe('the derivation reads no platform (QA-71 static half)', () => {
  it.each(NO_PLATFORM)('no file of the feature calls %s', (_label, re) => {
    expect(hits(re)).toEqual({})
  })

  it('and no file imports the platform module', () => {
    expect(hits(/from\s*['"][./]*(?:lib\/)?platform['"]/g)).toEqual({})
  })
})
