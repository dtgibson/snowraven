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
import { specificity } from '../test/cssSpecificity'

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
    // and the Android app's bottom inset, which main.tsx sets on the root, never a colour.
    const local = new Set(['--sr-label-ratio', '--sr-ctl-rem', '--sr-label-optical', '--sr-ctl-floor', '--sr-inset-bottom'])
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

describe('each open family is contained (schema 9.2 as amended, D-43)', () => {
  it('.sr-ft-open declares contain with both layout and paint', () => {
    const open = ft.find(r => r.selector.trim() === '.sr-ft-open' && r.atRules.length === 0)
    expect(open, 'the base .sr-ft-open rule').toBeTruthy()
    const v = (decl(open!.body, 'contain') ?? '').split(/\s+/)
    expect(v).toContain('layout')
    expect(v).toContain('paint')
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

// -- The phone full screen's tools row, as a RESOLVED cascade (QA-98; D-55(c)) --
// The first round shipped the caption-hiding rule three classes deep under a
// five-class showing rule, so it never applied while its declaration was
// present. These rows resolve the cascade over every rule that can reach the
// surface (a chain of class sets, descendant combinators only; a selector this
// matcher cannot read, such as one with `:is()` or an attribute, is not a
// candidate, and none of the tools row's own rules has one), under the phone
// tier, with the container query on and off.
type Chain = readonly (readonly string[])[]
const PANEL_TOOL: Chain = [
  ['sr-ft-host', 'sr-map-fs-panel'], ['sr-ft-toolbar', 'sr-ctl-row'], ['sr-ft-tools'], ['sr-ft-tool', 'sr-touch-target'],
]
const CAP: Chain = [...PANEL_TOOL, ['cap']]
const PLAIN = /^(\.[a-zA-Z0-9_-]+)+$/
function matches(sel: string, chain: Chain): boolean {
  const compounds = sel.trim().split(/\s+/)
  if (!compounds.every(c => PLAIN.test(c))) return false
  const classes = (c: string) => c.split('.').filter(Boolean)
  const subject = classes(compounds[compounds.length - 1])
  const last = chain[chain.length - 1]
  if (!subject.every(c => last.includes(c))) return false
  let at = chain.length - 2
  for (let i = compounds.length - 2; i >= 0; i--) {
    const want = classes(compounds[i])
    while (at >= 0 && !want.every(c => chain[at].includes(c))) at--
    if (at < 0) return false
    at--
  }
  return true
}
function cmpSpec(a: readonly number[], b: readonly number[]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}
function resolve(chain: Chain, prop: string, narrow: boolean): string | null {
  let best: { spec: [number, number, number]; order: number; value: string } | null = null
  rules.forEach((r, order) => {
    const active = r.atRules.every(a =>
      /max-width:\s*640px/.test(a) || (/@container sr-ft-tools/.test(a) && narrow) || /^@layer/.test(a))
    if (!active || r.atRules.some(a => /@container sr-ft-tools/.test(a)) && !narrow) return
    const value = decl(r.body, prop)
    if (value === null) return
    for (const sel of r.selector.split(',')) {
      if (!matches(sel, chain)) continue
      const spec = specificity(sel.trim())
      const beats = best === null || cmpSpec(spec, best.spec) > 0 || (cmpSpec(spec, best.spec) === 0 && order >= best.order)
      if (beats) best = { spec, order, value }
    }
  })
  return best === null ? null : (best as { value: string }).value
}

describe('the phone full screen\'s tools row resolves as designed (QA-98, D-55(c))', () => {
  it('the captions drop under 20.75rem of row and show above it', () => {
    expect(resolve(CAP, 'display', true)).toBe('none')
    expect(resolve(CAP, 'display', false)).toBe('block')
  })
  it('a glyph-only cell is max(44px, 2.25rem) tall; a captioned one 3rem', () => {
    expect(resolve(PANEL_TOOL, 'min-height', true)).toBe('max(44px, 2.25rem)')
    expect(resolve(PANEL_TOOL, 'min-height', false)).toBe('3rem')
  })
  it('the threshold is 20.75rem, inside the phone tier', () => {
    const q = rules.filter(r => r.atRules.some(a => /@container sr-ft-tools/.test(a)))
    expect(q.length).toBe(2)
    for (const r of q) {
      expect(r.atRules.some(a => /\(width < 20\.75rem\)/.test(a))).toBe(true)
      expect(r.atRules.some(a => /max-width:\s*640px/.test(a))).toBe(true)
    }
  })
  it('the matcher can fail: the first round\'s three-class rule loses to the showing rule', () => {
    expect(matches('.sr-ft-tools .sr-ft-tool .cap', CAP)).toBe(true)
    expect(specificity('.sr-ft-tools .sr-ft-tool .cap')[1]).toBeLessThan(specificity('.sr-ft-host.sr-map-fs-panel .sr-ft-tools .sr-ft-tool .cap')[1])
    expect(matches('.sr-ft-other .cap', CAP)).toBe(false)
  })
})

// -- QA-57's scan half: the diagram's CODE scales nothing --------------------------
// A computed font size cannot see a scaled box, so the tree's code is scanned
// too, comments stripped first (and the strip proven): no CSS `zoom`, no
// `transform` and no `scale` in any spelling (`scale3d`, `scaleX`, the `scale`
// property), in a style object or through `.style`; and the one SVG viewBox
// maps 1:1, its width and height the element's own width and height, so it
// places the edges in plane coordinates and scales nothing.
function stripCode(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => {
    const i = l.indexOf('//')
    if (i === -1) return l
    const before = l.slice(0, i)
    return (before.match(/['"`]/g) ?? []).length % 2 === 1 ? l : before
  }).join('\n')
}
const SCALE_CALL = /\b(scale|scale3d|scaleX|scaleY|scaleZ)\s*\(/
const STYLE_SCALE = /\.style\.(zoom|transform|scale)\b|\btransform\s*:/
function styleObjects(code: string): string[] {
  return [
    ...[...code.matchAll(/style=\{\{([^}]*)\}\}/g)].map(m => m[1]),
    ...[...code.matchAll(/:\s*CSSProperties\s*=\s*\{([^}]*)\}/g)].map(m => m[1]),
  ]
}

describe('the diagram\'s code scales nothing (QA-57, scan half)', () => {
  const files = ['../components/familyTree/FamilyTreeDiagram.tsx', './familyTreeLayout.ts']
    .map(f => ({ f, code: stripCode(readFileSync(new URL(f, import.meta.url), 'utf8')) }))
  it('the strip is proven: a commented scale is not seen, a coded one is', () => {
    expect(SCALE_CALL.test(stripCode('// transform: scale(2)\nconst a = 1'))).toBe(false)
    expect(SCALE_CALL.test(stripCode("el.style.transform = 'scale(2)'"))).toBe(true)
    expect(STYLE_SCALE.test(stripCode("el.style.transform = 'none'"))).toBe(true)
    expect(styleObjects('style={{ zoom: 2 }}')[0]).toContain('zoom')
  })
  it('no zoom, transform or scale anywhere in the code, nor in an inline style object', () => {
    for (const { f, code } of files) {
      expect(code.length, `${f} was read`).toBeGreaterThan(2000)
      expect(SCALE_CALL.test(code), f).toBe(false)
      expect(STYLE_SCALE.test(code), f).toBe(false)
      for (const o of styleObjects(code)) expect(/\b(zoom|transform|scale)\b/.test(o), `${f}: ${o}`).toBe(false)
    }
    expect(styleObjects(files[0].code).length).toBeGreaterThanOrEqual(3)
  })
  it('the one viewBox is 1:1 with the element\'s own width and height', () => {
    const svgs = [...files[0].code.matchAll(/<svg\b[^>]*>/g)].map(m => m[0])
    expect(svgs).toHaveLength(1)
    const w = /\bwidth=\{([^}]+)\}/.exec(svgs[0])![1]
    const h = /\bheight=\{([^}]+)\}/.exec(svgs[0])![1]
    const vb = /viewBox=\{`([^`]+)`\}/.exec(svgs[0])![1].trim().split(/\s+/)
    expect(vb).toHaveLength(4)
    expect(vb[2]).toBe('${' + w + '}')
    expect(vb[3]).toBe('${' + h + '}')
  })
})
