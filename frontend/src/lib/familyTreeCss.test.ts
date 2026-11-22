/// <reference types="node" />
// The Family Tree stylesheet, as declarations (family-rollups-and-tree NFR-09,
// FR-86, schema 9.4 and 17; QA-81's declaration half, QA-96's static half).
//
// WHAT IT CANNOT SEE, said plainly: this guard is DECLARATION-ONLY. It reads
// globals.css and pins that every colour the tab's rules use is a token defined
// in both themes, that nothing between the tab panel and the table's rows
// declares a vertical scroller or a height cap (the table flows with the page,
// FR-86), that the list is the inline-size container its stacked rows key on,
// that no rule scales or zooms anything and none snaps, that every hover look
// is gated on `(hover: hover)`, and that the phone rules sit inside the
// established 640px block, after the base rules they refine. It proves none of
// the geometry; the real-engine probe takes those readings.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseRulesAtAnyDepth } from './cssTopLevelRules'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const rules = parseRulesAtAnyDepth(css)
const ft = rules.filter(r => /\.sr-ft-/.test(r.selector))

function decl(body: string, prop: string): string | null {
  let found: string | null = null
  for (const part of body.split(';')) {
    const at = part.indexOf(':')
    if (at === -1) continue
    if (part.slice(0, at).trim() === prop) found = part.slice(at + 1).trim()
  }
  return found
}

/** A token block's custom property names. */
function tokensIn(selector: string): Set<string> {
  const block = rules.find(r => r.selector.trim() === selector && r.atRules.every(a => a.startsWith('@layer')))
  expect(block, `${selector} token block`).toBeTruthy()
  return new Set([...block!.body.matchAll(/(--sr-[a-z0-9-]+)\s*:/g)].map(m => m[1]))
}

describe('the tab\'s rules exist and are scoped', () => {
  it('finds the base block, the container query and the phone tier', () => {
    expect(ft.length).toBeGreaterThan(80)
    expect(ft.some(r => r.atRules.some(a => a.includes('sr-ft-list')))).toBe(true)
    expect(ft.some(r => r.atRules.some(a => a.includes('max-width: 640px')))).toBe(true)
  })
})

describe('colours are tokens defined in both themes (QA-81)', () => {
  it('every var(--sr-*) the rules read is declared on :root and in the dark theme', () => {
    const light = tokensIn(':root')
    const dark = tokensIn('[data-theme="dark"]')
    const used = new Set<string>()
    for (const r of ft) for (const m of r.body.matchAll(/var\((--sr-[a-z0-9-]+)/g)) used.add(m[1])
    expect(used.size).toBeGreaterThan(10)
    // Layout variables the tab's own rules set, never colours.
    const local = new Set(['--sr-label-ratio', '--sr-ctl-rem', '--sr-label-optical', '--sr-ctl-floor'])
    for (const t of used) {
      if (local.has(t)) continue
      expect(light.has(t), `${t} in :root`).toBe(true)
      expect(dark.has(t), `${t} in the dark theme`).toBe(true)
    }
  })
  it('no literal colour in the tab\'s rules', () => {
    for (const r of ft) {
      expect(/#[0-9a-fA-F]{3,8}\b/.test(r.body), r.selector).toBe(false)
      expect(/\brgba?\((?!var)/.test(r.body), r.selector).toBe(false)
    }
  })
})

describe('the table flows with the page on every tier (FR-86, QA-96 static half)', () => {
  const CHAIN = ['.sr-ft-tab', '.sr-ft-card', '.sr-ft-host', '.sr-ft-list', '.sr-ft-fblock', '.sr-ft-open', '.sr-ft-order']
  it('nothing between the panel and the rows declares a vertical scroller or a height cap', () => {
    for (const r of ft) {
      const subject = r.selector.split(',').map(s => s.trim().split(/\s+/).pop()!)
      if (!subject.some(s => CHAIN.some(c => s === c || s.startsWith(c + '.') || s.startsWith(c + ':') || s.startsWith(c + '[')))) continue
      for (const p of ['overflow', 'overflow-y', 'max-height', 'height']) {
        const v = decl(r.body, p)
        if (v === null) continue
        expect(/auto|scroll/.test(v) || p === 'max-height' || p === 'height', `${r.selector} sets ${p}: ${v}`).toBe(false)
      }
    }
  })
  it('the list is an inline-size container named for its stacked rows', () => {
    const list = ft.find(r => r.selector.trim() === '.sr-ft-list' && r.atRules.length === 0)!
    expect(decl(list.body, 'container-type')).toBe('inline-size')
    expect(decl(list.body, 'container-name')).toBe('sr-ft-list')
    expect(ft.some(r => r.atRules.some(a => /@container sr-ft-list \(max-width: 44em\)/.test(a)))).toBe(true)
  })
})

describe('nothing is scaled or snapped (QA-57\'s scan, QA-60)', () => {
  it('no zoom, transform scale, scale property or scroll-snap in the tab\'s rules', () => {
    for (const r of ft) {
      // The house listbox entrance animates a scaleY on Find's list alone; the
      // tree's box, plane, nodes and counts never scale.
      expect(/(^|;|\s)zoom\s*:/.test(r.body), r.selector).toBe(false)
      expect(/scroll-snap/.test(r.body), r.selector).toBe(false)
      expect(/(^|;|\s)scale\s*:/.test(r.body), r.selector).toBe(false)
      expect(/transform\s*:[^;]*scale/.test(r.body), r.selector).toBe(false)
    }
  })
})

describe('hover and the phone tier', () => {
  it('every hover look sits inside @media (hover: hover)', () => {
    for (const r of ft.filter(x => x.selector.includes(':hover'))) {
      expect(r.atRules.some(a => a.includes('(hover: hover)')), r.selector).toBe(true)
    }
  })
  it('the phone rules are inside the established 640px tier, after the base block', () => {
    const firstTier = css.indexOf('@media (max-width: 640px) {\n')
    const baseAt = css.indexOf('.sr-ft-tab { display: flex;')
    const phoneAt = css.indexOf('  .sr-ft-controls { padding: 12px; }')
    expect(baseAt).toBeGreaterThan(0)
    expect(baseAt).toBeLessThan(firstTier)
    expect(phoneAt).toBeGreaterThan(firstTier)
    // ...and inside THAT block, not a later one: no 640px block opens between.
    expect(css.slice(firstTier + 10, phoneAt).includes('@media (max-width: 640px)')).toBe(false)
  })
})
