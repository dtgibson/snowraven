/// <reference types="node" />
// The Family Tree tab's network posture, held to its source (family-rollups-
// and-tree FR-51, schema 15; QA-50's static half). A comment-stripped scan over
// every shipped file of the feature, with positive legs so a renamed file or a
// scan that reads nothing cannot pass: no request primitive, one `transport.`
// call (the codes batch, in the tab), every `https://` literal in the links
// module and consumed only as an href, `storage.` writes only in the tab and
// only for the tab's own keys, no `localStorage`. The rotate note's flag, when
// it lands, is written by the shared ChartViewTip, outside these files.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FAMILY_TREE_NAMES_SETTING, FAMILY_TREE_REGION_SETTING, FAMILY_TREE_VIEW_SETTING } from './familyTreeSettings'

const LIB = fileURLToPath(new URL('.', import.meta.url))
const COMP = fileURLToPath(new URL('../components/familyTree/', import.meta.url))

function strip(src: string): string {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '')
  return noBlocks.split('\n').map(l => {
    const i = l.indexOf('//')
    // Keep a `//` inside a string literal such as 'https://'; drop a line comment.
    if (i === -1) return l
    const before = l.slice(0, i)
    const quotes = (before.match(/['"`]/g) ?? []).length
    return quotes % 2 === 1 ? l : before
  }).join('\n')
}

const FILES: { name: string; code: string }[] = [
  ...readdirSync(LIB).filter(f => /^familyTree[A-Za-z]*\.ts$/.test(f) && !f.endsWith('.test.ts')).map(f => ({ name: `lib/${f}`, code: strip(readFileSync(LIB + f, 'utf8')) })),
  ...readdirSync(COMP).filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map(f => ({ name: `components/familyTree/${f}`, code: strip(readFileSync(COMP + f, 'utf8')) })),
]
const count = (re: RegExp) => FILES.reduce((n, f) => n + (f.code.match(re) ?? []).length, 0)

describe('the scan reads the feature', () => {
  it('finds the lib modules and the components', () => {
    expect(FILES.some(f => f.name === 'components/familyTree/FamilyTreeTab.tsx')).toBe(true)
    expect(FILES.some(f => f.name === 'lib/familyTreeModel.ts')).toBe(true)
    expect(FILES.length).toBeGreaterThan(8)
  })
  it('the strip is proven: a commented request is not counted, a coded one is', () => {
    expect(strip("// fetch('https://x')\nconst a = 1").includes('fetch(')).toBe(false)
    expect(strip("const u = 'https://x'").includes('https://x')).toBe(true)
  })
})

describe('no request beyond the codes batch (FR-51)', () => {
  it('no fetch, XMLHttpRequest, sendBeacon, iframe or window.open', () => {
    for (const f of FILES) {
      for (const p of [/\bfetch\(/, /XMLHttpRequest/, /sendBeacon/, /<iframe/, /window\.open/, /localStorage/, /new Image\(/]) {
        expect(p.test(f.code), `${f.name} holds ${p}`).toBe(false)
      }
    }
  })
  it('transport is called exactly once, the codes post in the tab', () => {
    expect(count(/\btransport\./g)).toBe(1)
    const tab = FILES.find(f => f.name === 'components/familyTree/FamilyTreeTab.tsx')!
    expect(tab.code).toMatch(/transport\.post<.*>\('\/taxonomy\/codes'/)
  })
  it('every https literal sits in the links module', () => {
    for (const f of FILES) {
      const hits = f.code.match(/https:\/\//g) ?? []
      if (f.name === 'lib/familyTreeLinks.ts') expect(hits.length).toBeGreaterThan(0)
      else expect(hits.length, f.name).toBe(0)
    }
  })
  it('storage writes are only the tab\'s own keys, only in the tab', () => {
    for (const f of FILES) {
      const writes = f.code.match(/storage\.(setSetting|deleteSetting|writeFile|saveFile|setFile)\(/g) ?? []
      if (f.name !== 'components/familyTree/FamilyTreeTab.tsx') expect(writes, f.name).toEqual([])
    }
    const tab = FILES.find(f => f.name === 'components/familyTree/FamilyTreeTab.tsx')!.code
    const keys = [...tab.matchAll(/storage\.(?:setSetting|deleteSetting)\(([A-Z_]+)/g)].map(m => m[1])
    expect(keys.length).toBeGreaterThan(0)
    const allowed = new Set(['FAMILY_TREE_REGION_SETTING', 'FAMILY_TREE_NAMES_SETTING', 'FAMILY_TREE_VIEW_SETTING'])
    for (const k of keys) expect(allowed.has(k), k).toBe(true)
    expect([FAMILY_TREE_REGION_SETTING, FAMILY_TREE_NAMES_SETTING, FAMILY_TREE_VIEW_SETTING]).toEqual(['familyTreeRegion', 'familyTreeNames', 'familyTreeView'])
  })
})
