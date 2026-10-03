// The Targets tab's sort <select>, its inline glyphs and the distance slider's
// stop labels, pinned as RESOLVED cascade values at the elements that need them
// (targets-tab QA round 1: F1 QA-67 / NFR-03, F2 design fidelity; the re-entry
// round: F3, the end stop labels, described at its own block below).
//
// F1. WebKit counted the full selected label of the `appearance: none` sort
// select as scrollable overflow: clipped on screen, yet it widened the PAGE
// (693px of document scroll at 360, 390 and 640px with a probability sort
// selected, 962px at 320px / 200%, measured in real WebKit; Chromium's UA sheet
// already clips a select, so it never overflowed). The repair is
// `overflow: hidden` on the SELECT. It must not move to the wrap or any
// ancestor, because an element's own overflow never clips its own outline, and
// the input focus ring draws outside the select's border box: clipping there
// would cut the ring.
//
// F2. Tailwind preflight sets `svg { display: block }` inside `@layer base`, so
// a glyph leading a line of text sat on a line of its own. The repair gives the
// glyph children of `.sr-tg-status` and `.sr-tg-link` an inline display.
//
// ASSERTED AS CASCADE RESULTS, not as the presence of a declaration (CLAUDE.md,
// v1.0.33: pin the property at the surface, assert the resolved cascade). Every
// rule in globals.css that can match the element, at any depth, is collected
// in source order; the winner is chosen by !important, then specificity, then
// order, per tier (desktop: top-level rules; phone: plus the <=640 tier). So a
// deleted declaration, a later rule that wins, an override written at a
// specificity that loses, or the declaration moved to the wrong element all
// fail here.
//
// WHAT THIS CANNOT SEE: whether WebKit still widens the page (layout), which is
// the scratch-probe measurement recorded with the fix; and rules outside
// globals.css other than the built bundle's preflight, checked in the last block.
//
// F4. The Last report hotspot glyph hangs into the cell's spare padding so it
// never starts a line alone (targets-hotspot-link), described at its own block.
//
// F5. The Species cell's BirdName wraps inside the cell on a phone, so a long
// scientific name no longer widens the table (upload-origin-table-wrap-copy).
/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HotspotLink } from '../components/HotspotLink'
import { BirdName } from '../components/BirdName'

const SRC = fileURLToPath(new URL('../', import.meta.url))
const css = readFileSync(`${SRC}globals.css`, 'utf8')
const controls = readFileSync(`${SRC}components/targets/TargetsControls.tsx`, 'utf8')
const PHONE = '@media (max-width: 640px)'

// ── A small cascade model over the real stylesheet ───────────────────────────

interface Rule { selectors: string[]; body: string; ancestors: string[]; order: number }

function strip(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
}

function splitList(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

function collect(src: string, ancestors: string[] = [], out: Rule[] = []): Rule[] {
  let i = 0
  let start = 0
  while (i < src.length) {
    if (src[i] === ';') { i++; start = i; continue }
    if (src[i] !== '{') { i++; continue }
    let depth = 1
    let end = i + 1
    while (end < src.length && depth) {
      if (src[end] === '{') depth++
      else if (src[end] === '}') depth--
      end++
    }
    const prelude = src.slice(start, i).trim().replace(/\s+/g, ' ')
    const body = src.slice(i + 1, end - 1)
    if (prelude.startsWith('@')) collect(body, [...ancestors, prelude], out)
    else out.push({ selectors: splitList(prelude), body, ancestors, order: out.length })
    i = end
    start = end
  }
  return out
}

function declarations(body: string): Map<string, { value: string; important: boolean }> {
  const out = new Map<string, { value: string; important: boolean }>()
  for (const part of body.split(';')) {
    const colon = part.indexOf(':')
    if (colon < 0) continue
    const prop = part.slice(0, colon).trim()
    let value = part.slice(colon + 1).trim()
    const important = /!important$/.test(value)
    if (important) value = value.replace(/\s*!important$/, '')
    out.set(prop, { value, important })
    // The `overflow` shorthand sets both axes (one value, or x then y).
    if (prop === 'overflow') {
      const [x, y = x] = value.split(/\s+/)
      out.set('overflow-x', { value: x, important })
      out.set('overflow-y', { value: y, important })
    }
  }
  return out
}

/**
 * One element in the chain: its tag and classes, and the STRUCTURAL
 * pseudo-classes it satisfies (`last-child`), which the element declares
 * because the chain carries no siblings to derive them from.
 */
interface El { tag: string; classes: string[]; structural?: string[] }

/** Structural pseudo-classes: a fact about the element's place in the tree, not a state. */
const STRUCTURAL = /:(first-child|last-child)(?![-\w])/g

/**
 * A compound selector's parts. A state pseudo-class (`:hover`, `:focus-visible`,
 * `:disabled`) or a pseudo-element makes it a non-RESTING match, which is what
 * this file resolves. A structural pseudo-class matches only an element that
 * declares it. An attribute selector is treated as SATISFIABLE (ignored),
 * which errs toward including a rule, so a themed or data-attribute override
 * that could win is never silently left out of the cascade.
 */
function parseCompound(compound: string) {
  const fnRe = /:(is|where|not)\(([^)]*)\)/g
  const fns = [...compound.matchAll(fnRe)].map(m => ({ fn: m[1], args: splitList(m[2]) }))
  const structural = [...compound.replace(fnRe, '').matchAll(STRUCTURAL)].map(m => m[1])
  const rest = compound.replace(fnRe, '').replace(/\[[^\]]*\]/g, '').replace(STRUCTURAL, '')
  const tag = /^[a-z][a-z0-9-]*|^\*/i.exec(rest)?.[0] ?? null
  const classes = [...rest.matchAll(/\.([-\w]+)/g)].map(m => m[1])
  const statePseudo = /:/.test(rest)
  return { tag, classes, fns, statePseudo, structural }
}

/** Does one simple argument of :is()/:where()/:not() match the element? */
function argMatches(arg: string, el: El): boolean {
  const p = parseCompound(arg.trim())
  if (p.statePseudo || p.fns.length) return false
  if (p.tag && p.tag !== '*' && p.tag !== el.tag) return false
  if (!p.structural.every(s => el.structural?.includes(s))) return false
  return p.classes.every(c => el.classes.includes(c))
}

function compoundMatches(compound: string, el: El): boolean {
  const p = parseCompound(compound)
  if (p.statePseudo) return false
  if (p.tag && p.tag !== '*' && p.tag !== el.tag) return false
  if (!p.structural.every(s => el.structural?.includes(s))) return false
  if (!p.classes.every(c => el.classes.includes(c))) return false
  for (const f of p.fns) {
    const any = f.args.some(a => argMatches(a, el))
    if (f.fn === 'not' ? any : !any) return false
  }
  return true
}

/** Split a complex selector into compounds and combinators, respecting ( ) and [ ]. */
function tokens(selector: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = '' }
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (depth === 0 && (ch === '>' || ch === '+' || ch === '~')) { flush(); out.push(ch); continue }
    if (depth === 0 && ch === ' ') { flush(); continue }
    cur += ch
  }
  flush()
  return out
}

/** Match a complex selector against the element and its ancestor chain (nearest first). */
function matches(selector: string, chain: El[]): boolean {
  const parts = tokens(selector)
  if (parts.includes('+') || parts.includes('~')) return false
  let i = parts.length - 1
  if (!compoundMatches(parts[i], chain[0])) return false
  let at = 0
  i--
  while (i >= 0) {
    const child = parts[i] === '>'
    if (child) i--
    const compound = parts[i]
    if (child) {
      at++
      if (at >= chain.length || !compoundMatches(compound, chain[at])) return false
    } else {
      let found = false
      for (at = at + 1; at < chain.length; at++) if (compoundMatches(compound, chain[at])) { found = true; break }
      if (!found) return false
    }
    i--
  }
  return true
}

/** (classes + attributes + pseudo-classes, elements); ids are not used in this stylesheet. */
function specificity(selector: string): [number, number] {
  let b = 0
  let c = 0
  const s = selector.replace(/:where\([^)]*\)/g, '')
  for (const m of s.matchAll(/:(is|not)\(([^)]*)\)/g)) {
    const best = splitList(m[2]).map(specificity).sort((x, y) => (y[0] - x[0]) || (y[1] - x[1]))[0]
    b += best[0]; c += best[1]
  }
  const bare = s.replace(/:(is|not)\([^)]*\)/g, '')
  b += (bare.match(/\.[-\w]+|\[[^\]]*\]|:(?!:)[-\w]+/g) ?? []).length
  c += tokens(bare).filter(t => /^[a-z]/i.test(t)).length
  return [b, c]
}

const rules = collect(strip(css))

interface Winner { value: string; selector: string; ancestors: string[] }

/** Lexicographic: is `a` a later-winning cascade key than `b`? */
function beats(a: number[], b: number[]): boolean {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] > b[k]
  return false
}

/** The resolved value of `prop` on the element, at the desktop or the phone tier. */
function resolve(prop: string, chain: El[], tier: 'desktop' | 'phone'): { winner: Winner | null; candidates: number } {
  let best: { key: number[]; w: Winner } | null = null
  let candidates = 0
  for (const r of rules) {
    const applies = r.ancestors.length === 0 || (tier === 'phone' && r.ancestors.length === 1 && r.ancestors[0] === PHONE)
    if (!applies) continue
    const d = declarations(r.body).get(prop)
    for (const sel of r.selectors) {
      if (!matches(sel, chain)) continue
      candidates++
      if (!d) continue
      const [b, c] = specificity(sel)
      const key = [d.important ? 1 : 0, b, c, r.order]
      if (!best || beats(key, best.key)) best = { key, w: { value: d.value, selector: sel, ancestors: r.ancestors } }
    }
  }
  return { winner: best?.w ?? null, candidates }
}

// The sort select's real ancestor chain, read from TargetsControls / Targets.
const SELECT_CHAIN: El[] = [
  { tag: 'select', classes: ['sr-tg-sel', 'sr-input-16'] },
  { tag: 'span', classes: ['sr-tg-sel-wrap'] },
  { tag: 'div', classes: ['sr-tg-group', 'sr-tg-group--sort'] },
  { tag: 'div', classes: ['sr-tg-strip-row', 'sr-tg-strip-row--faint'] },
  { tag: 'section', classes: ['sr-tg-strip', 'sr-ctl-row'] },
  { tag: 'div', classes: ['sr-tg'] },
  { tag: 'div', classes: [] },
  { tag: 'main', classes: [] },
  { tag: 'body', classes: [] },
  { tag: 'html', classes: [] },
]

describe('F1: the sort select clips its own label, so the page cannot widen (QA-67, WebKit)', () => {
  it('the component still renders the select with these classes inside the wrap', () => {
    // The chain above is only a model of the DOM if the markup still says so.
    expect(controls).toMatch(/<span className="sr-tg-sel-wrap">\s*<select[\s\S]*?className="sr-tg-sel sr-input-16"/)
    expect(controls).toMatch(/className="sr-tg-group sr-tg-group--sort"/)
    expect(controls).toMatch(/className="sr-tg-strip-row sr-tg-strip-row--faint"/)
  })

  it('never vacuous: the matcher reaches the base rule AND the shared phone-tier size rule', () => {
    const phoneRules = rules.filter(r => r.ancestors[0] === PHONE && r.selectors.some(s => matches(s, SELECT_CHAIN)))
    expect(phoneRules.some(r => r.selectors.includes('.sr-ctl-row :is(button, select, input)')),
      'the descendant + :is() form must match, or the matcher is blind to shared rules').toBe(true)
    expect(rules.some(r => r.ancestors.length === 0 && r.selectors.includes('.sr-tg-sel') && r.selectors.some(s => matches(s, SELECT_CHAIN)))).toBe(true)
    // And it rejects what it must: a state rule, and a rule for another element.
    expect(matches('select:focus-visible', SELECT_CHAIN)).toBe(false)
    expect(matches('.sr-tg-sel-caret', SELECT_CHAIN)).toBe(false)
    expect(matches('.sr-tg-combo .sr-tg-sel', SELECT_CHAIN)).toBe(false)
  })

  it.each(['desktop', 'phone'] as const)('%s: overflow-x on the select resolves to a clipping value', tier => {
    const { winner, candidates } = resolve('overflow-x', SELECT_CHAIN, tier)
    expect(candidates).toBeGreaterThan(1)
    expect(winner, 'some rule must set overflow on the select').not.toBeNull()
    expect(['hidden', 'clip'], `resolved from ${winner?.selector}`).toContain(winner!.value)
  })

  it.each(['desktop', 'phone'] as const)('%s: nothing between the select and the card clips, so the focus ring is whole', tier => {
    // The input ring (2px outline, 4px shadow) draws OUTSIDE the select's border
    // box, which fills the wrap; any clipping ancestor up to the card would cut it.
    for (let k = 1; k <= 4; k++) {
      const chain = SELECT_CHAIN.slice(k)
      for (const prop of ['overflow-x', 'overflow-y']) {
        const { winner } = resolve(prop, chain, tier)
        expect(winner?.value ?? 'visible', `${prop} on ${chain[0].tag}.${chain[0].classes.join('.')}`).toBe('visible')
      }
    }
  })

  it.each(['desktop', 'phone'] as const)('%s: the select still flexes and never sizes to its longest option', tier => {
    expect(resolve('min-width', SELECT_CHAIN, tier).winner?.value).toBe('0')
    expect(resolve('width', SELECT_CHAIN, tier).winner?.value).toBe('100%')
    expect(resolve('min-width', SELECT_CHAIN.slice(1), tier).winner?.value).toBe('0')
    expect(resolve('max-width', SELECT_CHAIN.slice(1), tier).winner?.value).toBe('30rem')
  })
})

// The glyph chains: a lucide <svg> as a direct child of each text container.
const GLYPH_CHAINS: Record<string, El[]> = {
  'the distance status line': [
    { tag: 'svg', classes: ['lucide', 'lucide-map-pin'] },
    { tag: 'div', classes: ['sr-tg-status'] },
    { tag: 'div', classes: ['sr-tg-anchor'] },
    { tag: 'div', classes: ['sr-tg-strip-row', 'sr-tg-strip-row--faint'] },
    { tag: 'section', classes: ['sr-tg-strip', 'sr-ctl-row'] },
    { tag: 'div', classes: ['sr-tg'] },
  ],
  'the LIVE sweep band': [
    { tag: 'svg', classes: ['lucide', 'lucide-check'] },
    { tag: 'div', classes: ['sr-tg-status'] },
    { tag: 'div', classes: ['sr-tg-sweep'] },
    { tag: 'section', classes: ['sr-tg-list-card'] },
    { tag: 'div', classes: ['sr-tg'] },
  ],
  'a link-button (Retry, the ebird.org link)': [
    { tag: 'svg', classes: ['lucide', 'lucide-refresh-cw'] },
    { tag: 'button', classes: ['sr-tg-link'] },
    { tag: 'span', classes: ['sr-tg-status'] },
    { tag: 'div', classes: ['sr-tg-strip-row'] },
    { tag: 'section', classes: ['sr-tg-strip', 'sr-ctl-row'] },
    { tag: 'div', classes: ['sr-tg'] },
  ],
  // FR-51a: the measuring-point trigger's chevron, inside the status line.
  'the anchor trigger (Measure distances from)': [
    { tag: 'svg', classes: ['lucide', 'lucide-chevron-down', 'sr-tg-anchor-chev'] },
    { tag: 'button', classes: ['sr-tg-anchor-btn'] },
    { tag: 'div', classes: ['sr-tg-status'] },
    { tag: 'div', classes: ['sr-tg-anchor'] },
    { tag: 'div', classes: ['sr-tg-strip-row', 'sr-tg-strip-row--faint'] },
    { tag: 'section', classes: ['sr-tg-strip', 'sr-ctl-row'] },
    { tag: 'div', classes: ['sr-tg'] },
  ],
}

describe('F2: a glyph beside text lays out inline, not on a line of its own', () => {
  it.each(Object.entries(GLYPH_CHAINS))('%s: display resolves to an inline value at both tiers', (_label, chain) => {
    for (const tier of ['desktop', 'phone'] as const) {
      const { winner } = resolve('display', chain, tier)
      expect(winner, 'a Targets rule must set the glyph display (preflight makes it block)').not.toBeNull()
      expect(['inline', 'inline-block'], `resolved from ${winner?.selector}`).toContain(winner!.value)
    }
  })

  it('the parents stay block-level text containers (a flex parent would need nothing, and this guard would be moot)', () => {
    for (const chain of Object.values(GLYPH_CHAINS)) {
      const parentDisplay = resolve('display', chain.slice(1), 'desktop').winner?.value
      expect(parentDisplay, chain[1].classes.join('.')).toMatch(/^(block|inline)$/)
    }
  })
})

// ── F3: the distance slider's END stop labels sit inside the track ───────────
//
// Each stop label used to be centred under its stop, so the first and last hung
// half their own width past the track ends (11.2px left, 20.1px right at 200%
// text; 8.1px past the controls card on a phone), in Chromium and WebKit
// (targets-tab QA re-entry). The end labels are now pinned to the track's ends,
// and the last label's unit drops out, by a container query on the stops row,
// where the narrow track would otherwise make "50 mi" collide with "25".
//
// WHAT THIS CANNOT SEE: whether the ink really stays inside the track and clear
// of "25" at every width and text scale. That is layout, measured in real
// Chromium and WebKit by the scratch probe recorded with the fix; this pins the
// cascade that measurement depends on, and the markup that feeds it.

/** The component source with comments removed, so a commented-out line cannot
 *  satisfy a markup assertion (and the file's own explanation cannot trip one). */
const controlsCode = controls.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const stopsBlock = (() => {
  const start = controlsCode.indexOf('<div className="sr-tg-range-stops"')
  return start < 0 ? '' : controlsCode.slice(start, controlsCode.indexOf('</div>', start))
})()

// A stop label's real ancestor chain, read from TargetsControls / Targets.
const STOP_ANCESTORS: El[] = [
  { tag: 'div', classes: ['sr-tg-range-stops'] },
  { tag: 'div', classes: ['sr-tg-range-wrap'] },
  { tag: 'div', classes: ['sr-tg-group', 'sr-tg-group--dist'] },
  { tag: 'div', classes: ['sr-tg-strip-row', 'sr-tg-strip-row--faint'] },
  { tag: 'section', classes: ['sr-tg-strip', 'sr-ctl-row'] },
  { tag: 'div', classes: ['sr-tg'] },
  { tag: 'div', classes: [] },
  { tag: 'main', classes: [] },
  { tag: 'body', classes: [] },
  { tag: 'html', classes: [] },
]

/** A label's chain with its modifiers, as the current stop (`on`) and/or with
 *  the slider disabled (`off`, the wrap's `is-off`). */
function stopChain(mods: string[], s: { on?: boolean; off?: boolean }): El[] {
  const [row, wrap, ...rest] = STOP_ANCESTORS
  return [
    { tag: 'span', classes: ['sr-tg-range-stop', ...mods, ...(s.on ? ['is-on'] : [])] },
    row,
    { ...wrap, classes: s.off ? [...wrap.classes, 'is-off'] : wrap.classes },
    ...rest,
  ]
}
const LABEL_STATES = [{}, { on: true }, { off: true }, { on: true, off: true }]
const UNIT_CHAIN: El[] = [{ tag: 'span', classes: ['sr-tg-range-unit'] }, ...stopChain(['sr-tg-range-stop--end'], {})]
const WRAP_CHAIN = STOP_ANCESTORS.slice(1)
const INPUT_CHAIN: El[] = [{ tag: 'input', classes: ['sr-tg-range'] }, ...WRAP_CHAIN]

/** A zero length, however it is spelled (`0`, `0px`); `null` never matches. */
const ZERO = /^0(px)?$/
const at = (prop: string, chain: El[], tier: 'desktop' | 'phone') => resolve(prop, chain, tier).winner?.value ?? null
const where = (prop: string, chain: El[], tier: 'desktop' | 'phone') => `${prop} resolved from ${resolve(prop, chain, tier).winner?.selector ?? 'nothing'}`

/** The stops row's container name, from its own resolved `container` declaration. */
function containerName(tier: 'desktop' | 'phone'): string | null {
  const v = at('container', STOP_ANCESTORS, tier)
  return v ? v.split('/')[0].trim() : null
}

/** Every rule under an `@container` at-rule that can match the unit. */
const unitQueries = rules.filter(r => r.ancestors.some(a => a.startsWith('@container')) && r.selectors.some(s => matches(s, UNIT_CHAIN)))

describe('F3: the distance slider\'s end stop labels stay inside the track (targets-tab QA re-entry)', () => {
  it('the markup puts the end classes on the first and last labels and the unit in its own span', () => {
    expect(stopsBlock, 'the stops row must still be rendered, aria-hidden').toMatch(/^<div className="sr-tg-range-stops" aria-hidden="true">/)
    expect(stopsBlock).toMatch(/const last = DISTANCE_STOPS\.length - 1/)
    expect(stopsBlock).toMatch(/i === 0 \? ' sr-tg-range-stop--start' : i === last \? ' sr-tg-range-stop--end' : ''/)
    expect(stopsBlock).toMatch(/className=\{`sr-tg-range-stop\$\{edge\}/)
    expect(stopsBlock).toMatch(/\{i === last \? <span className="sr-tg-range-unit">\{` \$\{DISTANCE_STOP_UNIT\}`\}<\/span> : null\}/)
  })

  it('no positioning is inline: each label\'s style sets only --sr-tg-stop, so the stylesheet decides', () => {
    // An inline `left` is specificity (1,0,0) and would beat every rule below,
    // re-centring the end labels however the stylesheet pins them.
    const styles = [...stopsBlock.matchAll(/style=\{\{([\s\S]*?)\}\}/g)].map(m => m[1])
    expect(styles.length, 'the label style must be found, or this is vacuous').toBe(1)
    for (const s of styles) {
      const keys = [...s.matchAll(/(?:\[\s*'([^']+)'[^\]]*\]|([A-Za-z-]+))\s*:/g)].map(m => m[1] ?? m[2])
      expect(keys).toEqual(['--sr-tg-stop'])
    }
  })

  it('never vacuous: the matcher reaches the label rules and rejects a different label', () => {
    // Keyed on what a rule DOES to the element, never on how its selector is
    // spelled, so an equivalent rewrite (a descendant form) stays green.
    const top = rules.filter(r => r.ancestors.length === 0)
    const reaches = (chain: El[], prop: string) => top.some(r => declarations(r.body).has(prop) && r.selectors.some(s => matches(s, chain)))
    expect(reaches(stopChain([], {}), 'transform')).toBe(true)
    expect(reaches(stopChain(['sr-tg-range-stop--start'], {}), 'left')).toBe(true)
    expect(reaches(stopChain(['sr-tg-range-stop--end'], {}), 'right')).toBe(true)
    expect(matches('.sr-tg-range-stop--end', stopChain(['sr-tg-range-stop--start'], {}))).toBe(false)
    expect(matches('.sr-tg-range-stop--start', stopChain([], {}))).toBe(false)
  })

  for (const tier of ['desktop', 'phone'] as const) {
    it.each(LABEL_STATES)(`${tier} %o: the FIRST label is pinned to the track start`, s => {
      const chain = stopChain(['sr-tg-range-stop--start'], s)
      expect(at('position', chain, tier)).toBe('absolute')
      expect(at('left', chain, tier), where('left', chain, tier)).toMatch(ZERO)
      expect(at('transform', chain, tier), where('transform', chain, tier)).toBe('none')
      expect(at('right', chain, tier) ?? 'auto', where('right', chain, tier)).toBe('auto')
      expect(at('white-space', chain, tier)).toBe('nowrap')
    })

    it.each(LABEL_STATES)(`${tier} %o: the LAST label is pinned to the track end`, s => {
      const chain = stopChain(['sr-tg-range-stop--end'], s)
      expect(at('position', chain, tier)).toBe('absolute')
      expect(at('right', chain, tier), where('right', chain, tier)).toMatch(ZERO)
      expect(at('left', chain, tier), where('left', chain, tier)).toBe('auto')
      expect(at('transform', chain, tier), where('transform', chain, tier)).toBe('none')
      expect(at('white-space', chain, tier)).toBe('nowrap')
    })

    it.each(LABEL_STATES)(`${tier} %o: an interior label stays centred under its stop`, s => {
      const chain = stopChain([], s)
      expect(at('left', chain, tier)).toBe('calc(9px + (100% - 18px) * var(--sr-tg-stop, 0))')
      expect(at('transform', chain, tier)).toBe('translateX(-50%)')
      expect(at('right', chain, tier) ?? 'auto').toBe('auto')
    })

    it(`${tier}: the row the labels resolve against IS the track: positioned, full wrap width, no offset`, () => {
      expect(at('position', STOP_ANCESTORS, tier)).toBe('relative')
      for (const p of ['width', 'margin', 'margin-left', 'margin-right', 'padding', 'padding-left', 'padding-right', 'border', 'border-left', 'border-right']) {
        expect(at(p, STOP_ANCESTORS, tier) ?? '0', where(p, STOP_ANCESTORS, tier)).toMatch(ZERO)
      }
      // A column flex wrap that stretches its items, so the row is as wide as
      // the range input beside it, whose own box is the whole wrap.
      expect(at('flex-direction', WRAP_CHAIN, tier)).toBe('column')
      expect(at('align-items', WRAP_CHAIN, tier) ?? 'normal').toMatch(/^(normal|stretch)$/)
      expect(at('width', INPUT_CHAIN, tier)).toBe('100%')
      expect(at('margin', INPUT_CHAIN, tier)).toMatch(ZERO)
    })

    it(`${tier}: outside the container query the unit is shown`, () => {
      expect(at('display', UNIT_CHAIN, tier) ?? 'inline', where('display', UNIT_CHAIN, tier)).not.toBe('none')
    })
  }

  it('the stops row is the named inline-size container the query names', () => {
    for (const tier of ['desktop', 'phone'] as const) {
      expect(at('container', STOP_ANCESTORS, tier)?.split('/')[1]?.trim()).toBe('inline-size')
    }
    expect(containerName('desktop')).toBeTruthy()
    expect(containerName('phone')).toBe(containerName('desktop'))
    expect(unitQueries.length, 'exactly one container rule may reach the unit').toBe(1)
    const prelude = unitQueries[0].ancestors.find(a => a.startsWith('@container'))!
    expect(prelude.split(/\s+/)[1], 'the query must name the stops row, not the nearest container').toBe(containerName('desktop'))
  })

  it('the query hides the unit on a pure-em width condition (it tracks text scale; no px, no calc)', () => {
    const [r] = unitQueries
    const prelude = r.ancestors.find(a => a.startsWith('@container'))!
    const m = /^@container [-\w]+ \(max-width: ([\d.]+)em\)$/.exec(prelude)
    expect(m, prelude).not.toBeNull()
    expect(declarations(r.body).get('display')?.value).toBe('none')
    // The threshold is the derivation written beside it, 5 * (the space "25"
    // and "50 mi" need, in em): the two must be changed together.
    const derived = /W >= 5 \* ([\d.]+)em - 27px/.exec(css)
    expect(derived, 'the derivation comment must state the threshold it produced').not.toBeNull()
    expect(Number(m![1])).toBeCloseTo(5 * Number(derived![1]), 5)
  })
})

// ── F4: the Last report glyph hangs into the cell's spare padding ────────────
// (targets-hotspot-link, QA amendment.) HotspotLink binds the glyph to the
// name's last word in one inline-block; when that word nearly fills its line
// the glyph would start the next line alone. In the Last report cell it adds
// no width to its line and hangs into the room to the cell's right instead.
// Pinned three ways: the hang equals the glyph HotspotLink actually renders
// (its gap plus its box, read off the server-rendered markup, never restated);
// the hang declarations resolve on the link and the glyph, at both tiers, and
// never on the last-word box or the lead span; and the room to the right of the
// column is at least the hang at each tier. WHAT THIS CANNOT SEE: that the glyph really
// shares the line in a real engine, which the build's browser sweep measured.

const LAST_TD: El[] = [
  { tag: 'td', classes: ['sr-tg-last'] },
  { tag: 'tr', classes: [] },
  { tag: 'tbody', classes: [] },
  { tag: 'table', classes: ['sr-tg-table'] },
  { tag: 'div', classes: ['sr-scroll-x'] },
  { tag: 'section', classes: ['sr-tg-list-card'] },
]
const ANCHOR: El[] = [{ tag: 'a', classes: [] }, { tag: 'span', classes: ['sr-tg-place'] }, ...LAST_TD]
const BOX: El[] = [{ tag: 'span', classes: [], structural: ['last-child'] }, ...ANCHOR]
const LEAD: El[] = [{ tag: 'span', classes: [], structural: ['first-child'] }, ...ANCHOR]
const GLYPH: El[] = [{ tag: 'svg', classes: ['lucide', 'lucide-external-link'] }, ...BOX]
const DIST_TD: El[] = [{ tag: 'td', classes: ['sr-tg-distc'] }, ...LAST_TD.slice(1)]
const ROW: El[] = LAST_TD.slice(1)

const px = (v: string | null | undefined): number => {
  const m = /^(-?[0-9.]+)px$/.exec((v ?? '').trim())
  if (!m) throw new Error(`not a px value: ${v}`)
  return Number(m[1])
}
/** The inline-end (right) component of a `padding` shorthand. */
const padRight = (v: string) => { const p = v.trim().split(/\s+/); return p[1] ?? p[0] }
const padLeft = (v: string) => { const p = v.trim().split(/\s+/); return p[3] ?? p[1] ?? p[0] }
const hangDecl = 'var(--sr-tg-glyph-hang)'
const negHangDecl = 'calc(-1 * var(--sr-tg-glyph-hang))'

describe('F4: the Last report glyph hangs into the cell\'s spare padding (targets-hotspot-link)', () => {
  it('the hang is the glyph HotspotLink renders in the Targets call: its gap plus its box', () => {
    // The Targets call passes no size, compact or truncate (the full-name, default-size branch).
    const list = readFileSync(`${SRC}components/targets/TargetsList.tsx`, 'utf8')
    const call = /<HotspotLink\b[\s\S]*?\/>/.exec(list)![0]
    expect(call).not.toMatch(/\b(size|compact|truncate)\b/)
    const html = renderToStaticMarkup(createElement(HotspotLink, { locId: 'L1', name: 'Lake Elizabeth', isHotspot: true, style: { color: 'var(--sr-text-muted)' } }))
    const svg = /<svg\b[^>]*>/.exec(html)![0]
    const width = Number(/\bwidth="([0-9.]+)"/.exec(svg)![1])
    const gap = px(/margin-left:\s*([0-9.]+px)/.exec(svg)![1])
    const hang = resolve('--sr-tg-glyph-hang', LAST_TD, 'desktop').winner
    expect(hang, 'the hang must be declared where Last report can inherit it').not.toBeNull()
    expect(px(hang!.value)).toBe(gap + width)
  })

  it.each(['desktop', 'phone'] as const)('%s: the link and the glyph resolve the hang; the last-word box and the lead span take none of it', tier => {
    // The link: end padding of the hang, cancelled by a negative margin, so its
    // last fragment (what WebKit outlines once the link has padding) reaches the
    // glyph's far edge while adding nothing to line fitting.
    expect(resolve('padding-inline-end', ANCHOR, tier).winner?.value).toBe(hangDecl)
    expect(resolve('margin-inline-end', ANCHOR, tier).winner?.value).toBe(negHangDecl)
    expect(resolve('margin-inline-end', GLYPH, tier).winner?.value).toBe(negHangDecl)
    // The last-word box takes NO padding or margin: padding there comes out of
    // the room its content may use, which split a word that fits the column
    // mid-word ("Sanctuar" / "y"), and a cancelling margin there ended the
    // link's fragment at the last letter, so WebKit's ring missed the glyph.
    for (const chain of [BOX, LEAD]) {
      for (const prop of ['box-sizing', 'padding-inline-end', 'margin-inline-end']) {
        expect(resolve(prop, chain, tier).winner, `${prop} on the ${chain === BOX ? 'last-word box' : 'lead span'}`).toBeNull()
      }
    }
  })

  it('desktop: this cell\'s end padding plus the Distance cell\'s start padding is at least the hang', () => {
    const hang = px(resolve('--sr-tg-glyph-hang', LAST_TD, 'desktop').winner!.value)
    expect(resolve('padding-inline-end', LAST_TD, 'desktop').winner).toBeNull()
    const mine = px(padRight(resolve('padding', LAST_TD, 'desktop').winner!.value))
    const theirs = px(padLeft(resolve('padding', DIST_TD, 'desktop').winner!.value))
    expect(mine + theirs).toBeGreaterThanOrEqual(hang)
  })

  it('phone: the column gap plus this cell\'s end padding is exactly the hang, and that padding beats the cells\' padding reset', () => {
    const hang = px(resolve('--sr-tg-glyph-hang', LAST_TD, 'phone').winner!.value)
    // The Distance cell has no start padding here, so the room is the gap plus ours.
    expect(resolve('padding', DIST_TD, 'phone').winner?.value).toBe('0')
    const gapDecl = resolve('gap', ROW, 'phone').winner!.value.split(/\s+/)
    const columnGap = px(gapDecl[1] ?? gapDecl[0])
    const end = resolve('padding-inline-end', LAST_TD, 'phone').winner!
    // calc(var(--sr-tg-glyph-hang) - <the column gap>): compared to the gap rule, never restated.
    const m = /^calc\(var\(--sr-tg-glyph-hang\) - ([0-9.]+px)\)$/.exec(end.value)
    expect(m, `the phone end padding is ${end.value}`).not.toBeNull()
    expect(px(m![1])).toBe(columnGap)
    expect((hang - px(m![1])) + columnGap).toBe(hang)
    // The longhand must win over the tier's `padding: 0` on the same cell.
    const reset = resolve('padding', LAST_TD, 'phone').winner!
    const [b1, c1] = specificity(end.selector)
    const [b0, c0] = specificity(reset.selector)
    expect(b1 > b0 || (b1 === b0 && c1 >= c0), `${end.selector} vs ${reset.selector}`).toBe(true)
  })
})

// ── F5: the Species cell's BirdName wraps inside the cell on a phone ─────────
// (upload-origin-table-wrap-copy.) The shared scientific-name rule does not
// wrap, and BirdName is a shrink-to-fit inline column, so in the phone tier,
// where the cell may shrink, the box was as wide as the whole scientific name
// on one line: 74px past the cell at 320px / 200% ("Xanthocephalus
// xanthocephalus"), 34px at 360px. The repair is the Breeding Codes / Rainbow
// Connection one, scoped to this cell: the box fills the cell, the name row
// wraps, and the scientific name wraps rather than ending in an ellipsis.
// Pinned as resolved values at the phone tier, and as a shared rule left alone
// (another surface's BirdName, and this cell on desktop, still resolve the
// shared values). WHAT THIS CANNOT SEE: that no row widens the table in a real
// engine; that is the built-app sweep recorded with the fix.

const NAME_TD: El[] = [{ tag: 'td', classes: ['sr-tg-name'] }, ...LAST_TD.slice(1)]

/** BirdName's own classes, read off its server-rendered markup with the scientific name shown, never restated. */
const birdNameClasses = (() => {
  const html = renderToStaticMarkup(createElement(BirdName, { commonName: 'Yellow-headed Blackbird', scientificName: 'Xanthocephalus xanthocephalus', showSci: true }))
  const cls = [...html.matchAll(/class="([^"]+)"/g)].map(m => m[1].split(' '))
  return { box: cls[0], row: cls[1], sci: cls[cls.length - 1] }
})()

const birdName = (cell: El[]) => {
  const box: El[] = [{ tag: 'span', classes: birdNameClasses.box }, ...cell]
  return {
    box,
    row: [{ tag: 'span', classes: birdNameClasses.row }, ...box] as El[],
    sci: [{ tag: 'span', classes: birdNameClasses.sci }, ...box] as El[],
  }
}
const TG = birdName(NAME_TD)
// Another table's name cell, which the repair must not reach.
const ELSEWHERE = birdName([{ tag: 'td', classes: [] }, { tag: 'tr', classes: [] }, { tag: 'tbody', classes: [] }, { tag: 'table', classes: [] }])

describe('F5: the Species cell\'s name wraps inside the cell on a phone (upload-origin-table-wrap-copy)', () => {
  it('the chain is BirdName\'s real markup, and the Targets row passes it a scientific name to show', () => {
    expect(birdNameClasses.box).toContain('sr-birdname')
    expect(birdNameClasses.box).not.toContain('sr-birdname-inline')
    expect(birdNameClasses.row).toEqual(['sr-birdname-row'])
    expect(birdNameClasses.sci).toEqual(['sr-birdname-sci'])
    const list = readFileSync(`${SRC}components/targets/TargetsList.tsx`, 'utf8')
    expect(list).toMatch(/<td role="cell" className="sr-tg-name">\s*<BirdName\b[\s\S]*?showSci=\{!!row\.sciName\}/)
  })

  it('never vacuous: both the shared rule and this cell\'s rule reach the scientific name', () => {
    expect(resolve('white-space', TG.sci, 'phone').candidates).toBeGreaterThan(1)
    expect(at('white-space', ELSEWHERE.sci, 'phone'), 'the shared rule must still be found').toBe('nowrap')
  })

  it('phone: the box fills the cell, the name row wraps, and the scientific name wraps anywhere', () => {
    expect(at('width', TG.box, 'phone'), where('width', TG.box, 'phone')).toBe('100%')
    expect(at('max-width', TG.box, 'phone'), where('max-width', TG.box, 'phone')).toBe('100%')
    expect(at('flex-wrap', TG.row, 'phone'), where('flex-wrap', TG.row, 'phone')).toBe('wrap')
    expect(at('white-space', TG.sci, 'phone'), where('white-space', TG.sci, 'phone')).toBe('normal')
    expect(at('overflow-wrap', TG.sci, 'phone'), where('overflow-wrap', TG.sci, 'phone')).toBe('anywhere')
    // The cell itself may still shrink to its grid track, which is what bounds the box.
    expect(at('min-width', NAME_TD, 'phone')).toMatch(ZERO)
  })

  it('the shared BirdName is unchanged: another surface, and this cell on desktop, keep the shared values', () => {
    for (const [chain, tier] of [[ELSEWHERE, 'phone'], [TG, 'desktop']] as const) {
      expect(at('white-space', chain.sci, tier)).toBe('nowrap')
      expect(at('overflow-wrap', chain.sci, tier)).toBeNull()
      expect(at('width', chain.box, tier)).toBeNull()
      expect(at('flex-wrap', chain.row, tier)).toBeNull()
    }
  })
})

// The built bundle is where preflight lives. Its `svg { display: block }` sits in
// `@layer base`; an unlayered rule beats any layered one whatever its
// specificity, so the Targets rules must be emitted OUTSIDE every @layer.
const DIST = fileURLToPath(new URL('../../dist/assets/', import.meta.url))
const built = existsSync(DIST) ? readdirSync(DIST).filter(f => /^index-.*\.css$/.test(f)).map(f => readFileSync(DIST + f, 'utf8')) : []

describe.skipIf(built.length === 0)('the emitted bundle: our rules are unlayered and beat preflight', () => {
  const emitted = built.flatMap(b => collect(strip(b)))
  const find = (sel: string) => emitted.filter(r => r.selectors.includes(sel))

  it('preflight really does block svgs, inside a layer (the reason this guard exists)', () => {
    const pre = emitted.filter(r => r.selectors.includes('svg') && declarations(r.body).get('display')?.value === 'block')
    expect(pre.length).toBeGreaterThan(0)
    expect(pre.every(r => r.ancestors.some(a => a.startsWith('@layer')))).toBe(true)
  })

  it.each([
    ['.sr-tg-sel', 'overflow', 'hidden'],
    ['.sr-tg-status>svg', 'display', 'inline-block'],
    ['.sr-tg-link>svg', 'display', 'inline-block'],
    // F4: the hang survives minification as logical properties, outside every layer.
    ['.sr-tg-place>a', 'margin-inline-end', 'calc(-1 * var(--sr-tg-glyph-hang))'],
    ['.sr-tg-place>a', 'padding-inline-end', 'var(--sr-tg-glyph-hang)'],
    ['.sr-tg-place>a>span:last-child>svg', 'margin-inline-end', 'calc(-1 * var(--sr-tg-glyph-hang))'],
    // F5: the scientific name's wrap survives minification, outside every layer.
    ['.sr-tg-name .sr-birdname-sci', 'white-space', 'normal'],
    ['.sr-tg-name .sr-birdname-sci', 'overflow-wrap', 'anywhere'],
  ])('%s is emitted unlayered with %s: %s', (sel, prop, value) => {
    const hits = find(sel)
    expect(hits.length, `${sel} must be emitted`).toBeGreaterThan(0)
    const top = hits.filter(r => !r.ancestors.some(a => a.startsWith('@layer')))
    expect(top.some(r => declarations(r.body).get(prop)?.value === value)).toBe(true)
  })

  it('F3: the unit query survives the build, still naming the stops row\'s container', () => {
    const name = containerName('desktop')
    const row = find('.sr-tg-range-stops').filter(r => r.ancestors.length === 0)
    expect(row.some(r => declarations(r.body).get('container')?.value.replace(/\s/g, '') === `${name}/inline-size`)).toBe(true)
    const q = find('.sr-tg-range-unit').filter(r => r.ancestors.some(a => a.startsWith(`@container ${name} `)))
    expect(q.some(r => declarations(r.body).get('display')?.value === 'none')).toBe(true)
  })
})
