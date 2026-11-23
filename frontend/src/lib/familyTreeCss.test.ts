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
import { specificity, splitList } from '../test/cssSpecificity'

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
    expect(ft.some(r => r.atRules.some(a => /@container sr-ft-list \(max-width: 50em\)/.test(a)))).toBe(true)
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
// matcher cannot read, such as one with a child combinator or `:not()`, is not
// a candidate, and none of the tools row's own rules has one; the matcher's
// reach is stated above PLAIN), under the phone tier, with the container query
// on and off.
type Chain = readonly (readonly string[])[]
const PANEL_TOOL: Chain = [
  ['sr-ft-host', 'sr-map-fs-panel'], ['sr-ft-toolbar', 'sr-ctl-row'], ['sr-ft-tools'], ['sr-ft-tool', 'sr-touch-target'],
]
const CAP: Chain = [...PANEL_TOOL, ['cap']]
// A compound is an optional tag, classes, attribute equalities and a closing
// `:hover`; a chain element lists its classes, as `<tag>` its tag, as `[a="v"]`
// its attributes and as `:hover` a pointer resting on it (D-70 added tags, for
// `.sr-ft-genus b`; D-80 attributes, for `.sr-ft-tab[data-media="on"]`; D-86
// `:hover`, for the family row). One `:is(...)` in a selector is expanded
// into its alternatives; a selector with a combinator other than descendant,
// or with `:not(...)`, is not a candidate this matcher can read. What covers
// the rules it skips (the narrow form's child-combinator and `:not()` rules
// among them) is the rendered result: legs 9 and 10 of
// `website/tools/verify/verify-family-tree.mjs` measure the rows those rules
// lay out, in both engines (D-84 R4-2).
const PLAIN = /^([a-z][a-z0-9]*)?(\.[a-zA-Z0-9_-]+|\[[a-z-]+="[^"]*"\])*(:hover)?$/
function expandIs(sel: string): string[] {
  const m = /:is\(([^()]*)\)/.exec(sel)
  if (!m) return [sel]
  return splitList(m[1]).flatMap(alt => expandIs(sel.slice(0, m.index) + alt + sel.slice(m.index + m[0].length)))
}
function matches(sel: string, chain: Chain): boolean {
  return expandIs(sel).some(one => matchesOne(one, chain))
}
function matchesOne(sel: string, chain: Chain): boolean {
  const compounds = sel.trim().split(/\s+/)
  if (!compounds.every(c => c !== '' && PLAIN.test(c))) return false
  const want = (c: string) => {
    const tag = /^[a-z][a-z0-9]*/.exec(c)?.[0]
    return [
      ...(tag ? [`<${tag}>`] : []),
      ...[...c.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(x => x[1]),
      ...[...c.matchAll(/\[[a-z-]+="[^"]*"\]/g)].map(x => x[0]),
      ...(c.endsWith(':hover') ? [':hover'] : []),
    ]
  }
  const subject = want(compounds[compounds.length - 1])
  const last = chain[chain.length - 1]
  if (!subject.every(c => last.includes(c))) return false
  let at = chain.length - 2
  for (let i = compounds.length - 2; i >= 0; i--) {
    const w = want(compounds[i])
    while (at >= 0 && !w.every(c => chain[at].includes(c))) at--
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

// -- The tree's label size, as a resolved value at the surface (QA-57, D-55(b)) --
// Round 1 shipped the labels a half pixel under the spec's body size and no
// suite noticed; setting `.sr-ft-node` back to its old size left every test
// green. This row resolves `font-size` at a family label's text and at its
// second name, by the same cascade as the tools-row rows (inherited up the
// chain when no rule there sets it), on the desktop and on the phone tier, and
// holds each to the app's own body-name register, BirdName's md link and its
// md second name, resolved the same way. Two declarations compared to each
// other: no size is typed here.
type Tier = 'desktop' | 'phone'
// The headline's container query (D-74) is the one container condition this
// resolver can be told is true; every other container rule stays inactive.
const GLANCE_QUERY = /^@container sr-ft-glance \(width >= 16\.5rem\)$/
// The list's two queries (D-80): stacked under 50em, the narrow form under 15rem.
const LIST_STACKED_QUERY = /^@container sr-ft-list \(max-width: 50em\)$/
const LIST_NARROW_QUERY = /^@container sr-ft-list \(width < 15rem\)$/
type ListWidth = 'wide' | 'stacked' | 'narrow'
// `@media (hover: hover)` is true only when the resolver is told the device
// hovers (a mouse or trackpad); a touch screen keeps `:hover` after a tap and
// does not match it (ui.md v1.0.65).
const HOVER_MEDIA = /^@media \(hover: hover\)$/
function activeAt(tier: Tier, atRules: readonly string[], glanceWide = false, list: ListWidth = 'wide', hoverDevice = false): boolean {
  return atRules.every(a => /^@layer/.test(a) || (tier === 'phone' && /max-width:\s*640px/.test(a)) || (glanceWide && GLANCE_QUERY.test(a.trim()))
    || (list !== 'wide' && LIST_STACKED_QUERY.test(a.trim())) || (list === 'narrow' && LIST_NARROW_QUERY.test(a.trim()))
    || (hoverDevice && HOVER_MEDIA.test(a.trim())))
}
function resolvedAt(chain: Chain, prop: string, tier: Tier, { glanceWide = false, inherit = true, list = 'wide' as ListWidth, hoverDevice = false } = {}): string | null {
  for (let end = chain.length; end > (inherit ? 0 : chain.length - 1); end--) {
    const sub = chain.slice(0, end)
    let best: { spec: [number, number, number]; order: number; value: string } | null = null
    rules.forEach((r, order) => {
      if (!activeAt(tier, r.atRules, glanceWide, list, hoverDevice)) return
      const value = decl(r.body, prop)
      if (value === null) return
      for (const sel of splitList(r.selector)) {
        if (!matches(sel, sub)) continue
        const spec = specificity(sel.trim())
        if (best === null || cmpSpec(spec, best.spec) > 0 || (cmpSpec(spec, best.spec) === 0 && order >= best.order)) best = { spec, order, value }
      }
    })
    if (best !== null) return (best as { value: string }).value
  }
  return null
}
const TREE_NODE: Chain = [['sr-ft-box'], ['sr-ft-plane'], ['sr-ft-node', 'sr-ft-node--f'], ['sr-ft-chip'], ['sr-ft-names']]
const TREE_LABEL: Chain = [...TREE_NODE, ['sr-ft-nm']]
const TREE_ALT: Chain = [...TREE_NODE, ['sr-ft-alt']]
const BODY_NAME: Chain = [['sr-birdname', 'sr-birdname-md'], ['sr-birdname-row'], ['sr-birdname-link']]
const BODY_SECOND: Chain = [['sr-birdname', 'sr-birdname-md'], ['sr-birdname-sci']]

describe('the tree\'s labels are the app\'s body-name size (QA-57, D-55(b))', () => {
  it('a family label and its second name resolve to BirdName\'s md name and second name, on both tiers', () => {
    for (const tier of ['desktop', 'phone'] as const) {
      const body = resolvedAt(BODY_NAME, 'font-size', tier)
      const second = resolvedAt(BODY_SECOND, 'font-size', tier)
      expect(body, `${tier}: the body-name register resolves`).not.toBeNull()
      expect(second, `${tier}: the second-name register resolves`).not.toBeNull()
      expect(resolvedAt(TREE_LABEL, 'font-size', tier), `${tier}: the tree's label`).toBe(body)
      expect(resolvedAt(TREE_ALT, 'font-size', tier), `${tier}: the tree's second name`).toBe(second)
    }
  })
})

// -- Every name in an opened family can break inside a word wider than its
// line (D-70; QA-79, NFR-07; the standing 320px and 200% rule) ---------------
// In Inter (the stack's first face, which GitHub's runner installs) the genus
// line's second name "Campylorhamphus" ran 5.45px past its row at 320px and
// 200%, and a few species names 0.52px, while every fallback face fit. The
// fix lets these texts break inside a word only when the word is wider than
// the line, so this row resolves `overflow-wrap` (inherited) at each text the
// table draws in an opened family, on both tiers, rather than reading one
// declaration. The browser half, both faces, is the harness's table leg.
const OPENED: Chain = [['sr-ft-list'], ['<section>', 'sr-ft-order'], ['sr-ft-fblock'], ['sr-ft-open']]
const GENUS_LINE: Chain = [...OPENED, ['sr-ft-genus-block'], ['<p>', 'sr-ft-genus']]
const SPECIES_NAME: Chain = [...OPENED, ['sr-ft-genus-block'], ['sr-ft-sp'], ['<span>', 'sr-birdname', 'sr-birdname-md'], ['<span>', 'sr-birdname-row']]
const OPENED_TEXTS: Record<string, Chain> = {
  'the genus lead': [...GENUS_LINE, ['<b>']],
  'the genus second name (common)': [...GENUS_LINE, ['<span>', 'alt']],
  'the genus second name (scientific)': [...GENUS_LINE, ['<span>', 'alt', 'is-sci']],
  'the genus count': [...GENUS_LINE, ['<span>']],
  'a species name that links': [...SPECIES_NAME, ['<button>', 'sr-birdname-link']],
  'a species name that does not link': [...SPECIES_NAME, ['<span>', 'sr-birdname-text']],
  'a species second name': [...SPECIES_NAME.slice(0, -1), ['<span>', 'sr-birdname-sci']],
  'the family name': [['sr-ft-list'], ['<section>', 'sr-ft-order'], ['sr-ft-fblock'], ['<button>', 'sr-ft-frow'], ['sr-ft-fname'], ['<span>', 'n']],
  'the order name': [['sr-ft-list'], ['<section>', 'sr-ft-order'], ['sr-ft-oband'], ['<h3>'], ['<span>', 'alt']],
}

describe('every name in an opened family can break inside an over-long word (D-70)', () => {
  it('overflow-wrap resolves to anywhere at each text, on the desktop and the phone tier', () => {
    for (const tier of ['desktop', 'phone'] as const) {
      for (const [what, chain] of Object.entries(OPENED_TEXTS)) {
        expect(resolvedAt(chain, 'overflow-wrap', tier), `${tier}: ${what}`).toBe('anywhere')
      }
    }
  })
  it('the matcher reads tags: `.sr-ft-genus b` reaches the lead and not the count', () => {
    expect(matches('.sr-ft-genus b', OPENED_TEXTS['the genus lead'])).toBe(true)
    expect(matches('.sr-ft-genus b', OPENED_TEXTS['the genus count'])).toBe(false)
  })
})

// -- The headline's form follows its own width on the phone tier (QA-79,
// NFR-07, FR-36; design-spec 5 as amended, D-73(a), D-74) ---------------------
const GLANCE_WRAP: Chain = [['<div>', 'sr-ft-glance-wrap']]
const GLANCE: Chain = [...GLANCE_WRAP, ['<dl>', 'sr-ft-glance']]
const TILE: Chain = [...GLANCE, ['<div>', 'sr-ft-tile']]

describe('the headline is three-up only where its wrapper holds three figures (D-74)', () => {
  it('the wrapper is a named inline-size container on every tier, and the query is 16.5rem inside the phone tier', () => {
    for (const tier of ['desktop', 'phone'] as const) {
      expect(resolvedAt(GLANCE_WRAP, 'container-type', tier, { inherit: false }), tier).toBe('inline-size')
      expect(resolvedAt(GLANCE_WRAP, 'container-name', tier, { inherit: false }), tier).toBe('sr-ft-glance')
    }
    const q = rules.filter(r => r.atRules.some(a => /@container sr-ft-glance/.test(a)))
    expect(q.length).toBeGreaterThanOrEqual(5)
    for (const r of q) {
      expect(r.atRules.some(a => GLANCE_QUERY.test(a.trim())), r.selector).toBe(true)
      expect(r.atRules.some(a => /max-width:\s*640px/.test(a)), r.selector).toBe(true)
    }
  })
  it('on the phone tier: three columns, stacked tiles at or over the threshold; under it the base grid and the wrapping tile', () => {
    const base = resolvedAt(GLANCE, 'grid-template-columns', 'desktop', { inherit: false })
    expect(base).toBe('repeat(auto-fit, minmax(min(15rem, 100%), 1fr))')
    expect(resolvedAt(GLANCE, 'grid-template-columns', 'phone', { glanceWide: true, inherit: false })).toBe('repeat(3, minmax(0, 1fr))')
    expect(resolvedAt(TILE, 'flex-direction', 'phone', { glanceWide: true, inherit: false })).toBe('column')
    expect(resolvedAt(GLANCE, 'grid-template-columns', 'phone', { inherit: false })).toBe(base)
    expect(resolvedAt(TILE, 'flex-direction', 'phone', { inherit: false })).toBeNull()
    expect(resolvedAt(TILE, 'flex-wrap', 'phone', { inherit: false })).toBe('wrap')
  })
  it('no type size changes with the form', () => {
    const VALUE: Chain = [...TILE, ['<dd>'], ['<span>', 'sr-ft-tile-value']]
    const LABEL: Chain = [...TILE, ['<dt>']]
    for (const p of ['font-size']) {
      expect(resolvedAt(VALUE, p, 'phone', { glanceWide: true })).toBe(resolvedAt(VALUE, p, 'phone'))
      expect(resolvedAt(LABEL, p, 'phone', { glanceWide: true })).toBe(resolvedAt(LABEL, p, 'phone'))
    }
  })
})

// -- Find narrows beside Exit in the phone full screen (design-spec 10.3, D-73(c))
describe('Find in the phone full screen keeps Exit\'s row (D-74)', () => {
  const FIND: Chain = [['sr-ft-host', 'sr-map-fs-panel'], ['sr-ft-toolbar', 'sr-ctl-row'], ['sr-ft-find']]
  it('its basis is 4rem and it may shrink to nothing, against the base and tier rules', () => {
    expect(resolvedAt(FIND, 'flex', 'phone', { inherit: false })).toBe('1 1 4rem')
    expect(resolvedAt(FIND, 'min-width', 'phone', { inherit: false })).toBe('0')
    // Outside the panel the tier's own rule stands.
    expect(resolvedAt([['sr-ft-toolbar'], ['sr-ft-find']], 'flex', 'phone', { inherit: false })).toBe('1 1 100%')
  })
})

// -- The table's narrow form and its 50em stacking (design-spec 11, D-78,
// D-79, D-80) --------------------------------------------------------------------
// Resolved at the species row, its name and media cell, the opened block and
// the family row, with the list wide, stacked and narrow, on both tiers.
const TAB_ON: Chain = [['sr-ft-tab', '[data-media="on"]'], ['sr-ft-list']]
const TAB_OFF: Chain = [['sr-ft-tab', '[data-media="off"]'], ['sr-ft-list']]
const OPEN_BLOCK = (tab: Chain): Chain => [...tab, ['<section>', 'sr-ft-order'], ['sr-ft-fblock'], ['sr-ft-open']]
const SP_ROW = (tab: Chain): Chain => [...OPEN_BLOCK(tab), ['sr-ft-genus-block'], ['sr-ft-sp']]
const SP_NAME_WRAP = (tab: Chain): Chain => [...SP_ROW(tab), ['<span>', 'sr-birdname', 'sr-birdname-md']]
const SP_NAME_ROW = (tab: Chain): Chain => [...SP_NAME_WRAP(tab), ['<span>', 'sr-birdname-row']]
const SP_MEDIA = (tab: Chain): Chain => [...SP_ROW(tab), ['<span>', 'sr-lfl-media']]
const FAM_ROW = (tab: Chain): Chain => [...tab, ['<section>', 'sr-ft-order'], ['sr-ft-fblock'], ['<button>', 'sr-ft-frow']]
const FAM_NAME = (tab: Chain): Chain => [...FAM_ROW(tab), ['sr-ft-fname'], ['<span>', 'n']]

describe('the table\'s narrow form under 15rem, and stacking under 50em (D-80)', () => {
  const at = (chain: Chain, prop: string, tier: Tier, list: ListWidth, inherit = false) => resolvedAt(chain, prop, tier, { list, inherit })
  it('narrow, with media marks: the row is a two-track grid and BirdName\'s wrappers leave the box tree', () => {
    for (const tier of ['desktop', 'phone'] as const) {
      expect(at(SP_ROW(TAB_ON), 'grid-template-columns', tier, 'narrow'), tier).toBe('minmax(0, 1fr) auto')
      expect(at(SP_NAME_WRAP(TAB_ON), 'display', tier, 'narrow'), tier).toBe('contents')
      expect(at(SP_NAME_ROW(TAB_ON), 'display', tier, 'narrow'), tier).toBe('contents')
      expect(at(SP_MEDIA(TAB_ON), 'grid-column', tier, 'narrow'), tier).toBe('2')
    }
  })
  it('narrow, without media marks: BirdName keeps its own form; only the indent goes', () => {
    for (const tier of ['desktop', 'phone'] as const) {
      expect(at(SP_NAME_WRAP(TAB_OFF), 'display', tier, 'narrow'), tier).not.toBe('contents')
      expect(at(OPEN_BLOCK(TAB_OFF), 'padding-left', tier, 'narrow'), tier).toBe('12px')
    }
  })
  it('narrow: the opened block gives up its indent, the family row is a wrapping flex row, its name breaks only a word wider than the row', () => {
    for (const tier of ['desktop', 'phone'] as const) {
      expect(at(OPEN_BLOCK(TAB_ON), 'padding-left', tier, 'narrow'), tier).toBe('12px')
      expect(at(FAM_ROW(TAB_ON), 'display', tier, 'narrow'), tier).toBe('flex')
      expect(at(FAM_ROW(TAB_OFF), 'display', tier, 'narrow'), tier).toBe('flex')
      expect(at(FAM_NAME(TAB_ON), 'overflow-wrap', tier, 'narrow', true), tier).toBe('break-word')
      // The species name keeps the last resort.
      expect(at([...SP_NAME_ROW(TAB_ON), ['<button>', 'sr-birdname-link']], 'overflow-wrap', tier, 'narrow', true), tier).toBe('anywhere')
    }
  })
  it('not narrow (every width at 100% text): none of it applies, stacked or not', () => {
    for (const list of ['wide', 'stacked'] as const) {
      for (const tier of ['desktop', 'phone'] as const) {
        expect(at(SP_NAME_WRAP(TAB_ON), 'display', tier, list), `${tier} ${list}`).not.toBe('contents')
        expect(at(FAM_ROW(TAB_ON), 'display', tier, list), `${tier} ${list}`).not.toBe('flex')
        expect(at(FAM_NAME(TAB_ON), 'overflow-wrap', tier, list, true), `${tier} ${list}`).toBe('anywhere')
        expect(at(OPEN_BLOCK(TAB_ON), 'padding-left', tier, list), `${tier} ${list}`).not.toBe('12px')
      }
    }
    // Stacked hides the column header; wide does not.
    expect(at([...TAB_ON, ['sr-ft-cols']], 'display', 'desktop', 'stacked')).toBe('none')
    expect(at([...TAB_ON, ['sr-ft-cols']], 'display', 'desktop', 'wide')).not.toBe('none')
  })
  it('the two queries read 15rem and 50em, and the narrow rules follow the phone tier\'s opened-block shorthand', () => {
    const narrow = rules.filter(r => r.atRules.some(a => LIST_NARROW_QUERY.test(a.trim())))
    expect(narrow.length).toBeGreaterThanOrEqual(8)
    expect(rules.some(r => r.atRules.some(a => LIST_STACKED_QUERY.test(a.trim())))).toBe(true)
    expect(rules.some(r => r.atRules.some(a => /@container sr-ft-list \(max-width: 44em\)/.test(a)))).toBe(false)
    const phoneShorthand = rules.findIndex(r => r.selector === '.sr-ft-open' && /max-width:\s*640px/.test(r.atRules.join()) && decl(r.body, 'padding') !== null)
    const narrowOpen = rules.findIndex(r => r.selector === '.sr-ft-open' && r.atRules.some(a => LIST_NARROW_QUERY.test(a.trim())))
    expect(phoneShorthand).toBeGreaterThanOrEqual(0)
    expect(narrowOpen).toBeGreaterThan(phoneShorthand)
  })
})

// -- The family row's second name on the hover fill (D-83, D-85, D-86) -------------
// What these rows check: the resolved `color` of a family row's second name,
// with a pointer resting on the row or not, on a device that hovers or not,
// both tiers, the list wide, stacked and narrow, the row collapsed and
// expanded. The contrast itself (4.5:1 on `--sr-surface-subtle`) is measured on
// the built app by harness leg 10, in both themes and both engines.
const FAM_SECOND = (row: readonly string[]): Chain => [...TAB_ON, ['<section>', 'sr-ft-order'], ['sr-ft-fblock'], row, ['sr-ft-fname'], ['<span>', 's']]
const ROW_REST = ['<button>', 'sr-ft-frow']
const ROW_HOVER = ['<button>', 'sr-ft-frow', ':hover']
const ROW_HOVER_OPEN = ['<button>', 'sr-ft-frow', '[aria-expanded="true"]', ':hover']

describe('the family row\'s second name takes the muted token on the hover fill (D-86)', () => {
  const at = (row: readonly string[], tier: Tier, list: ListWidth, hoverDevice: boolean) =>
    resolvedAt(FAM_SECOND(row), 'color', tier, { list, inherit: false, hoverDevice })
  it('a pointer resting on the row, collapsed or expanded: muted, at every list width on both tiers', () => {
    for (const tier of ['desktop', 'phone'] as const) for (const list of ['wide', 'stacked', 'narrow'] as const) {
      expect(at(ROW_HOVER, tier, list, true), `${tier} ${list}`).toBe('var(--sr-text-muted)')
      expect(at(ROW_HOVER_OPEN, tier, list, true), `${tier} ${list} open`).toBe('var(--sr-text-muted)')
    }
  })
  it('at rest, and on a touch screen that keeps :hover after a tap: the gray it always had', () => {
    for (const tier of ['desktop', 'phone'] as const) for (const list of ['wide', 'stacked', 'narrow'] as const) {
      expect(at(ROW_REST, tier, list, true), `${tier} ${list} rest`).toBe('var(--sr-text-gray)')
      expect(at(ROW_HOVER, tier, list, false), `${tier} ${list} touch`).toBe('var(--sr-text-gray)')
    }
  })
  it('the hover look is two rules, both inside @media (hover: hover), and touches only the fill and the second name', () => {
    const hovered = rules.filter(r => splitList(r.selector).some(sel => /\.sr-ft-frow:hover\b/.test(sel)))
    expect(hovered.map(r => r.selector).sort()).toEqual(['.sr-ft-frow:hover', '.sr-ft-frow:hover .sr-ft-fname .s'])
    for (const r of hovered) expect(r.atRules.map(a => a.trim()), r.selector).toEqual(['@media (hover: hover)'])
    const props = (body: string) => body.split(';').map(d => d.split(':')[0].trim()).filter(Boolean)
    expect(props(hovered.find(r => r.selector === '.sr-ft-frow:hover')!.body)).toEqual(['background'])
    expect(props(hovered.find(r => r.selector !== '.sr-ft-frow:hover')!.body)).toEqual(['color'])
  })
  it('the matcher can fail: a hover rule does not reach a row the pointer is not on', () => {
    expect(matches('.sr-ft-frow:hover .sr-ft-fname .s', FAM_SECOND(ROW_REST))).toBe(false)
    expect(matches('.sr-ft-frow:hover .sr-ft-fname .s', FAM_SECOND(ROW_HOVER))).toBe(true)
  })
})
