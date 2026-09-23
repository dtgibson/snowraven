// @vitest-environment jsdom
/// <reference types="node" />
//
// county-date-filter-mobile: the where-and-when block and the shared date pair.
//
// WHAT THIS PROVES, and how. The fix is almost entirely CSS, and its central
// mechanism is a CASCADE claim: the five desktop registers are zero-specificity
// `:where()` defaults, so the <=640 tier overrides every one of them with plain
// class rules and no `!important`, while desktop and iPad resolve to exactly the
// inline styles the registers replaced. A presence check on a declaration cannot
// see that (a desktop rule that lost its `:where()` still "exists", and then
// silently beats the phone rule it was meant to yield to). So this file RESOLVES
// the cascade: it renders the real component into jsdom, asks jsdom's own
// selector engine which rules of the REAL globals.css match each element, and
// picks the winner per property by importance, specificity and source order,
// with the element's inline style in its proper place, at a given viewport
// width. The assertions are about the resolved values.
//
// WHAT IT CANNOT PROVE: geometry. jsdom has no layout, so whether the word
// clears the value, whether the pair fits 320px at 200% text, and whether iOS
// paints the value left-aligned are settled in real engines (Chromium, WebKit,
// and the iOS simulator), not here.
//
// The desktop expectations are the pre-change inline styles, transcribed
// verbatim from the five call sites at f5e52a3 (LifeList, SpeciesDetail,
// BreedingCodeList, Checklists' `selectStyle`, MapExplorer's sidebar pair). They
// are the golden of the "before" state: the drawings no longer exist anywhere
// else in the code, so this table is what keeps a later edit to a `:where()`
// register from moving a desktop pixel unnoticed.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { createElement, type CSSProperties, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DateRangeFields, type DateRangeRegister } from '../components/ui/DateRangeFields'

afterEach(cleanup)

// A path string, not a URL object: under jsdom the global `URL` is jsdom's,
// which node's fs does not accept as a file URL.
const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../globals.css'), 'utf8')
// Comments blanked to equal-length spaces, so no assertion is satisfied by prose.
const clean = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

// ── The stylesheet, as rules with their at-rule ancestry and source order ────

interface Decl { prop: string; value: string; important: boolean }
interface Rule { selectors: string[]; decls: Decl[]; ancestors: string[]; order: number }

function splitTop(list: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === sep && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

function parseDecls(body: string): Decl[] {
  const out: Decl[] = []
  for (const part of splitTop(body, ';')) {
    const colon = part.indexOf(':')
    if (colon < 0) continue
    const prop = part.slice(0, colon).trim()
    let value = part.slice(colon + 1).trim()
    const important = /!important$/.test(value)
    if (important) value = value.replace(/\s*!important$/, '').trim()
    out.push({ prop, value, important })
  }
  return out
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
    else out.push({ selectors: splitTop(prelude, ','), decls: parseDecls(body), ancestors, order: out.length })
    i = end
    start = end
  }
  return out
}

const RULES = collect(clean)

/**
 * Does this rule apply at this viewport width, in the resting state?
 *
 * Only width queries are evaluated. A layered rule is skipped because every
 * rule in `@layer base` loses to every unlayered normal declaration, and none of
 * ours is layered. Reduced motion, pointer and container queries describe a
 * state this resolution is not about and are treated as not matching.
 */
function applies(ancestors: string[], width: number): boolean {
  for (const a of ancestors) {
    const m = /^@media \((max|min)-width: (\d+)px\)$/.exec(a)
    if (!m) return false
    const n = Number(m[2])
    if (m[1] === 'max' ? width > n : width < n) return false
  }
  return true
}

/** (a,b,c) per Selectors 4: `:where()` is 0; `:is()` / `:not()` take their max. */
function specificity(sel: string): number {
  let a = 0
  let b = 0
  let c = 0
  const compounds: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (depth === 0 && (/\s/.test(ch) || ch === '>' || ch === '+' || ch === '~')) {
      if (cur) compounds.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur) compounds.push(cur)
  for (const compound of compounds) {
    let i = 0
    while (i < compound.length) {
      const ch = compound[i]
      if (ch === '[') { b++; i = compound.indexOf(']', i) + 1; continue }
      if (ch === '#' || ch === '.' || ch === ':') {
        let j = i + 1
        const element = ch === ':' && compound[j] === ':'
        if (element) j++
        while (j < compound.length && /[-\w\\]/.test(compound[j])) j++
        const name = compound.slice(i, j).replace(/^:+/, '')
        let args: string | null = null
        if (compound[j] === '(') {
          let d = 1
          const from = j + 1
          j++
          while (j < compound.length && d > 0) { if (compound[j] === '(') d++; else if (compound[j] === ')') d--; j++ }
          args = compound.slice(from, j - 1)
        }
        if (ch === '#') a++
        else if (ch === '.') b++
        else if (element) c++
        else if (name === 'where') { /* zero */ }
        else if (args !== null && (name === 'is' || name === 'not')) {
          const best = Math.max(...splitTop(args, ',').map(specificity))
          a += Math.floor(best / 1e6)
          b += Math.floor(best / 1e3) % 1000
          c += best % 1000
        } else b++
        i = j
        continue
      }
      if (ch === '*') { i++; continue }
      let j = i
      while (j < compound.length && /[-\w]/.test(compound[j])) j++
      if (j === i) { i++; continue }
      c++
      i = j
    }
  }
  return a * 1e6 + b * 1e3 + c
}

/** Shorthands expanded to the longhands this file resolves. */
function expand(d: Decl): Decl[] {
  const parts = d.value.split(/\s+(?![^(]*\))/)
  if (d.prop === 'padding') {
    const [t, r = t, bottom = t, l = r] = parts
    void bottom
    return [
      { ...d, prop: 'padding-right', value: r },
      { ...d, prop: 'padding-left', value: l },
      { ...d, prop: 'padding-top', value: t },
    ]
  }
  if (d.prop === 'border') {
    return [
      { ...d, prop: 'border-width', value: parts[0] },
      { ...d, prop: 'border-color', value: parts.slice(2).join(' ') },
    ]
  }
  if (d.prop === 'background') return [{ ...d, prop: 'background-color', value: d.value }]
  return [d]
}

/** Inline style, as React wrote it, parsed into declarations. */
function inlineDecls(el: Element): Decl[] {
  return parseDecls(el.getAttribute('style') ?? '').flatMap(expand)
}

/** jsdom throws on a selector it cannot parse; such a rule cannot match here. */
function matchesSafely(el: Element, selector: string): boolean {
  try {
    return el.matches(selector)
  } catch {
    return false
  }
}

/**
 * The value a property resolves to on `el` at `width`, or undefined when no
 * rule declares it (the UA default then applies). Importance first, then inline
 * over any selector, then specificity, then source order.
 */
function resolved(el: Element, prop: string, width: number): string | undefined {
  type Cand = { value: string; rank: number }
  const cands: Cand[] = []
  for (const rule of RULES) {
    if (!applies(rule.ancestors, width)) continue
    let spec = -1
    for (const sel of rule.selectors) {
      if (matchesSafely(el, sel)) spec = Math.max(spec, specificity(sel))
    }
    if (spec < 0) continue
    for (const d of rule.decls.flatMap(expand)) {
      if (d.prop !== prop) continue
      cands.push({ value: d.value, rank: (d.important ? 4 : 0) * 1e15 + spec * 1e5 + rule.order })
    }
  }
  for (const d of inlineDecls(el)) {
    if (d.prop !== prop) continue
    // Inline beats every normal selector; an !important declaration beats it.
    cands.push({ value: d.value, rank: (d.important ? 5 : 3) * 1e15 })
  }
  cands.sort((x, y) => x.rank - y.rank)
  return cands.at(-1)?.value
}

// ── The rendered component, in each surface's surrounding structure ──────────

const REGISTERS: DateRangeRegister[] = ['multimedia', 'species-detail', 'breeding-codes', 'checklists', 'map-sidebar']
const PILL_ROW: DateRangeRegister[] = ['multimedia', 'species-detail', 'breeding-codes']

/** The block's ancestors as each call site mounts them (the classes are what rules key on). */
function mount(register: DateRangeRegister, from: string, to: string) {
  const pair = createElement(DateRangeFields, { register, from, to, onFrom: () => {}, onTo: () => {} })
  const wrap = (cls: string, ...children: ReactNode[]) => createElement('div', { className: cls }, ...children)
  let tree: ReactNode
  if (register === 'map-sidebar') tree = wrap('sr-map-sidebar-overlay', wrap('', pair))
  else if (register === 'checklists') tree = wrap('sr-ctl-row', wrap('sr-field-row', wrap('sr-whenwhere', pair)))
  else tree = wrap('sr-ctl-row', wrap('sr-whenwhere', pair))
  const { container } = render(createElement('div', null, tree))
  const group = container.querySelector('.sr-daterange')!
  const fields = [...group.querySelectorAll(':scope > .sr-daterange-field')]
  return {
    group,
    fields,
    inputs: fields.map(f => f.querySelector('input')!),
    words: fields.map(f => f.querySelector('.sr-daterange-word')!),
    arrow: group.querySelector('.sr-daterange-arrow'),
    glyph: group.querySelector('.sr-daterange-glyph'),
  }
}

const DESKTOP = [1280, 800]      // a desktop window, and the iPad band inside the <=1024 tier
const PHONE = [640, 480, 390, 320]

// The pre-change inline styles, verbatim (see the header). `undefined` means the
// call site declared nothing, so nothing may be declared now either.
type Golden = Record<string, string | undefined>
const PILL_ROW_CHROME: Golden = {
  'padding-right': '6px', 'border-radius': '5px', 'border-width': '1.5px',
  'font-size': '0.75rem', 'font-family': 'inherit', 'max-width': undefined, flex: undefined,
}
const DESKTOP_GOLDEN: Record<DateRangeRegister, { from: Golden; to: Golden; tints: boolean; rest: string }> = {
  multimedia: {
    from: { ...PILL_ROW_CHROME, width: '100%', 'min-height': '1.75rem', height: undefined, 'padding-left': '24px' },
    to: { ...PILL_ROW_CHROME, width: undefined, 'min-height': '1.75rem', height: undefined, 'padding-left': '8px' },
    tints: true, rest: 'var(--sr-text-muted)',
  },
  'species-detail': {
    from: { ...PILL_ROW_CHROME, width: '100%', 'min-height': '1.625rem', height: undefined, 'padding-left': '24px' },
    to: { ...PILL_ROW_CHROME, width: undefined, 'min-height': '1.625rem', height: undefined, 'padding-left': '8px' },
    tints: true, rest: 'var(--sr-text-muted)',
  },
  'breeding-codes': {
    from: { ...PILL_ROW_CHROME, width: undefined, 'min-height': undefined, height: '26px', 'padding-left': '24px' },
    to: { ...PILL_ROW_CHROME, width: undefined, 'min-height': undefined, height: '26px', 'padding-left': '8px' },
    tints: true, rest: 'var(--sr-text-muted)',
  },
  checklists: {
    from: { height: '28px', 'padding-left': '8px', 'padding-right': '8px', 'border-radius': '6px', 'border-width': '1.5px', 'font-size': '0.75rem', 'font-family': 'inherit', 'max-width': '100%', width: undefined, 'min-height': undefined, flex: undefined },
    to: { height: '28px', 'padding-left': '8px', 'padding-right': '8px', 'border-radius': '6px', 'border-width': '1.5px', 'font-size': '0.75rem', 'font-family': 'inherit', 'max-width': '100%', width: undefined, 'min-height': undefined, flex: undefined },
    tints: false, rest: 'var(--sr-text)',
  },
  'map-sidebar': {
    from: { flex: '1', height: '34px', 'padding-left': '8px', 'padding-right': '8px', 'border-radius': '6px', 'border-width': '1.5px', 'font-size': '0.75rem', 'font-family': 'inherit', 'min-width': '0', 'box-sizing': 'border-box', width: undefined, 'min-height': undefined },
    to: { flex: '1', height: '34px', 'padding-left': '8px', 'padding-right': '8px', 'border-radius': '6px', 'border-width': '1.5px', 'font-size': '0.75rem', 'font-family': 'inherit', 'min-width': '0', 'box-sizing': 'border-box', width: undefined, 'min-height': undefined },
    tints: false, rest: 'var(--sr-text)',
  },
}

describe('desktop and iPad resolve to the inline drawings the registers replaced', () => {
  for (const register of REGISTERS) {
    it(`${register}: every date input property, resting and set, at every desktop width`, () => {
      const g = DESKTOP_GOLDEN[register]
      for (const [from, to] of [['', ''], ['2025-03-01', '2025-06-30']]) {
        const view = mount(register, from, to)
        const set = from !== ''
        for (const width of DESKTOP) {
          for (const [i, golden] of [[0, g.from], [1, g.to]] as const) {
            const input = view.inputs[i]
            for (const [prop, value] of Object.entries(golden)) {
              expect(resolved(input, prop, width), `${register} ${i ? 'To' : 'From'} ${prop} @${width}`).toBe(value)
            }
            const tinted = set && g.tints
            expect(resolved(input, 'border-color', width)).toBe(tinted ? 'var(--sr-accent-border-strong)' : 'var(--sr-border)')
            expect(resolved(input, 'background-color', width)).toBe(tinted ? 'var(--sr-accent-bg)' : 'var(--sr-surface)')
            expect(resolved(input, 'color', width)).toBe(tinted ? 'var(--sr-accent)' : g.rest)
          }
          // The word is phone-only, and nothing else on the pair moved.
          for (const word of view.words) expect(resolved(word, 'display', width)).toBe('none')
          if (view.arrow) expect(resolved(view.arrow, 'display', width)).toBeUndefined()
          if (view.glyph) expect(resolved(view.glyph, 'display', width)).toBeUndefined()
        }
        cleanup()
      }
    })
  }

  it('keeps each group and field in the box tree it had: real where there was a box, transparent where there was none', () => {
    for (const width of DESKTOP) {
      for (const register of REGISTERS) {
        const view = mount(register, '', '')
        const group = resolved(view.group, 'display', width)
        // Pill-row: the old `.sr-field-row` with a 4px gap. Checklists: its inputs
        // were children of the row itself. Map: still `.sr-field-row`.
        expect(group, `${register} group`).toBe(register === 'checklists' ? 'contents' : 'flex')
        if (PILL_ROW.includes(register)) expect(resolved(view.group, 'gap', width)).toBe('4px')
        // The pill-row From field was a real icon wrapper; every other field was
        // not there at all.
        const pillRow = PILL_ROW.includes(register)
        expect(resolved(view.fields[0], 'display', width), `${register} From field`).toBe(pillRow ? 'inline-flex' : 'contents')
        expect(resolved(view.fields[1], 'display', width), `${register} To field`).toBe('contents')
        // No containment on desktop: the fields there are sized as they were.
        for (const f of view.fields) expect(resolved(f, 'contain', width), `${register} field`).toBeUndefined()
        expect(resolved(view.fields[0], 'min-width', width)).toBe(register === 'multimedia' ? '0' : undefined)
        cleanup()
      }
    }
  })
})

describe('on a phone, one register overrides all five without !important', () => {
  for (const register of REGISTERS) {
    it(`${register}: stacks into a joined pair of wrapping fields with a visible word, at every phone width`, () => {
      for (const [from, to] of [['', ''], ['2025-03-01', '']]) {
        const view = mount(register, from, to)
        for (const width of PHONE) {
          const at = `${register} @${width}`
          // A BLOCK, never a flex column: as a column flex item inside the
          // wrapping pill row, WebKit measured each field's height at an
          // intrinsic width where word and value sat on two lines and kept it
          // (55px at 100% text instead of 31px). Resolved here, because the
          // pill-row register's desktop default is `flex`.
          expect(resolved(view.group, 'display', width), at).toBe('block')
          expect(resolved(view.arrow ?? view.group, 'display', width)).toBe(view.arrow ? 'none' : 'block')
          if (view.glyph) expect(resolved(view.glyph, 'display', width), at).toBe('none')

          for (const [i, input] of view.inputs.entries()) {
            const which = `${at} ${i ? 'To' : 'From'}`
            const field = view.fields[i]
            const set = i === 0 && from !== ''
            // THE FIELD IS THE VISIBLE CONTROL: it draws the box, and it WRAPS,
            // so a value that cannot fit beside the word drops beneath it instead
            // of being clipped (the fixed-slot design clipped at 320px / 200% on
            // Checklists in both engines and on the Map in Chromium).
            expect(resolved(field, 'display', width), which).toBe('flex')
            expect(resolved(field, 'flex-wrap', width), which).toBe('wrap')
            expect(resolved(field, 'position', width), which).toBe('relative')
            expect(resolved(field, 'border-width', width), which).toBe('1.5px')
            expect(resolved(field, 'border-radius', width), which).toBe(i === 0 ? '6px 6px 0 0' : '0 0 6px 6px')
            // Every register tints on a phone, Checklists and the Map included.
            expect(resolved(field, 'border-color', width), which).toBe(set ? 'var(--sr-accent-border-strong)' : 'var(--sr-border)')
            expect(resolved(field, 'background-color', width), which).toBe(set ? 'var(--sr-accent-bg)' : 'var(--sr-surface)')
            expect(resolved(field, 'z-index', width), which).toBe(set ? '1' : undefined)

            // The input is borderless and transparent inside it, and fills the
            // rest of the line. A desktop `:where()` rule that lost its zero
            // specificity (the pill-row From field's 24px padding, its border,
            // its tint) would reappear inside the field and turn these red.
            expect(resolved(input, 'flex', width), which).toBe('1 1 auto')
            expect(resolved(input, 'width', width), which).toBe('auto')
            expect(resolved(input, 'min-width', width), which).toBe('0')
            expect(resolved(input, 'height', width), which).toBe('auto')
            expect(resolved(input, 'padding-left', width), which).toBe('0')
            expect(resolved(input, 'border-width', width), which).toBe('0')
            // The field's background, never `transparent`: over a transparent
            // background WebKit paints an EMPTY date as today's date in full text
            // colour instead of its grey placeholder, which reads as a set filter.
            expect(resolved(input, 'background-color', width), which).toBe('inherit')
            expect(resolved(input, 'text-align', width), which).toBe('left')
            expect(resolved(input, 'color', width), which).toBe(set ? 'var(--sr-accent)' : DESKTOP_GOLDEN[register].rest)

            // The word is IN FLOW at a fixed em basis, the same rule for From and
            // To, so both fields of a pair wrap under the same condition.
            const word = view.words[i]
            expect(resolved(word, 'display', width), which).toBe('block')
            expect(resolved(word, 'position', width), which).toBeUndefined()
            expect(resolved(word, 'flex', width), which).toBe('0 0 2.6em')
            expect(resolved(word, 'color', width), which).toBe(set ? 'var(--sr-accent)' : 'var(--sr-text-muted)')
          }
          // Only the To field overlaps, by exactly the width of the edge it shares.
          expect(resolved(view.fields[0], 'margin-top', width)).toBeUndefined()
          const edge = resolved(view.fields[0], 'border-width', width)!
          expect(resolved(view.fields[1], 'margin-top', width)).toBe(`-${edge}`)
        }
        cleanup()
      }
    })
  }

  it('gives every field the pill register\'s height as a MINIMUM, and the Map its own panel height', () => {
    // Two declarations of each number, compared to each other rather than to a
    // literal: the pill register's min-height, and the Map sidebar's desktop
    // input height, are what the phone tier must match.
    const pill = RULES.find(r => r.ancestors.length === 0 && r.selectors.includes('.sr-pill'))!
    const pillMin = pill.decls.find(d => d.prop === 'min-height')!.value
    for (const register of REGISTERS) {
      const view = mount(register, '', '')
      const expected = register === 'map-sidebar' ? resolved(view.inputs[0], 'height', 1280) : pillMin
      for (const field of view.fields) expect(resolved(field, 'min-height', 390), register).toBe(expected)
      // The input inside carries no floor of its own, so it can never force a
      // wrapped field taller than its two lines.
      for (const input of view.inputs) expect(resolved(input, 'min-height', 390), register).toBe('0')
      cleanup()
    }
  })

  it('lets a set field win the shared edge, inside the pair\'s own stacking context', () => {
    const view = mount('multimedia', '2025-03-01', '')
    expect(Number(resolved(view.fields[0], 'z-index', 390)), 'a set field is lifted over its neighbour').toBeGreaterThan(0)
    expect(resolved(view.fields[1], 'z-index', 390), 'an unset field is not lifted').toBeUndefined()
    // Contained: the pair is its own stacking context, so the lift can never
    // reach a pinned table band that scrolls past the filter row.
    expect(resolved(view.group, 'isolation', 390)).toBe('isolate')
  })

  it('draws the focus ring on the field the user sees, and only there', () => {
    // The global input ring would outline the borderless input inside the box.
    // It moves to the field as the same outline and border colour, and is
    // suppressed on the input only where the field draws it: a ring removed
    // with nothing drawing its replacement is a keyboard user with no focus.
    const view = mount('checklists', '', '')
    view.inputs[0].focus()
    expect(document.activeElement).toBe(view.inputs[0])
    for (const width of PHONE) {
      expect(resolved(view.fields[0], 'outline', width)).toBe('2px solid var(--sr-accent)')
      expect(resolved(view.fields[0], 'border-color', width)).toBe('var(--sr-accent)')
      expect(Number(resolved(view.fields[0], 'z-index', width))).toBeGreaterThan(0)
      expect(resolved(view.inputs[0], 'outline', width)).toBe('none')
      // The unfocused field draws no ring.
      expect(resolved(view.fields[1], 'outline', width)).toBeUndefined()
    }
    for (const width of DESKTOP) {
      // Desktop keeps the global ring on the input itself.
      expect(resolved(view.fields[0], 'outline', width)).toBeUndefined()
      expect(resolved(view.inputs[0], 'outline', width)).toBe('2px solid var(--sr-accent)')
    }
  })

  it('moves with the pill register\'s own fade, not a timing of its own', () => {
    const pill = RULES.find(r => r.ancestors.length === 0 && r.selectors.includes('.sr-pill'))!
    const pillTransition = pill.decls.find(d => d.prop === 'transition')!.value
    const view = mount('checklists', '', '')
    expect(resolved(view.fields[0], 'transition', 390)).toBe(pillTransition)
    // The text inside fades with it, on the pill's own colour timing.
    const colourLeg = pillTransition.split(',').map(t => t.trim()).find(t => t.startsWith('color '))!
    expect(resolved(view.inputs[0], 'transition', 390)).toBe(colourLeg)
    expect(resolved(view.words[0], 'transition', 390)).toBe(colourLeg)
    // Desktop never animated these inputs and still does not.
    expect(resolved(view.inputs[0], 'transition', 1280)).toBeUndefined()
  })

  it('declares every phone-tier date-range rule WITHOUT !important', () => {
    // The mechanism, stated structurally beside the resolved results above: the
    // desktop registers yield by specificity, so the phone tier needs no
    // escalation. An `!important` creeping in here is the start of an arms race
    // with the global input focus ring, whose border colour is `!important`.
    const phone = RULES.filter(r =>
      r.ancestors.includes('@media (max-width: 640px)') &&
      r.selectors.some(s => /\.sr-daterange\b|\.sr-daterange-/.test(s)))
    expect(phone.length, 'never vacuous').toBeGreaterThan(8)
    for (const r of phone) {
      for (const d of r.decls) expect(d.important, `${r.selectors.join(', ')} { ${d.prop} }`).toBe(false)
    }
    // And every desktop rule on the pair is zero-specificity, which is what lets
    // the phone rules above win without it.
    const desktop = RULES.filter(r =>
      r.ancestors.length === 0 && r.selectors.some(s => /\.sr-daterange\b|\.sr-daterange-|\.sr-whenwhere/.test(s)))
    expect(desktop.length, 'never vacuous').toBeGreaterThan(8)
    for (const r of desktop) {
      for (const s of r.selectors) expect(specificity(s), s).toBe(0)
    }
  })
})

// ── The block, the county select and the separators ─────────────────────────

/** A county select the way the pill-row surfaces draw it: geometry inline. */
function mountBlock(selectStyle: CSSProperties, bare = false, countySet = false) {
  const { container } = render(
    createElement('div', { className: 'sr-ctl-row' },
      createElement('span', { className: 'sr-pill-sep sr-pill-sep--spaced' }),
      createElement('div', { className: 'sr-whenwhere' },
        createElement('div', {
          className: bare ? 'sr-whenwhere-county sr-whenwhere-county--bare' : 'sr-whenwhere-county',
          'data-set': countySet ? 'true' : undefined,
        },
          createElement('select', { 'aria-label': 'County', className: 'sr-input-16', style: selectStyle }),
          bare ? createElement('span', { className: 'sr-whenwhere-caret', 'aria-hidden': 'true' }, '\u25BE') : null),
        createElement('span', { className: 'sr-whenwhere-tail sr-whenwhere-count' }, '12 checklists'),
        createElement('span', { className: 'sr-only' }, '12 checklists'))))
  return {
    sep: container.querySelector('.sr-pill-sep')!,
    block: container.querySelector('.sr-whenwhere')!,
    county: container.querySelector('.sr-whenwhere-county')!,
    select: container.querySelector('select')!,
    caret: container.querySelector('.sr-whenwhere-caret'),
    tail: container.querySelector('.sr-whenwhere-tail')!,
    live: container.querySelector('.sr-only')!,
  }
}

describe('the block, its county select and the pill-row separators', () => {
  it('is layout-transparent on desktop and a full row of its own on a phone', () => {
    const v = mountBlock({ height: '26px' })
    for (const width of DESKTOP) {
      expect(resolved(v.block, 'display', width)).toBe('contents')
      // The icon wrapper the pill-row surfaces drew inline, lifted verbatim.
      expect(resolved(v.county, 'display', width)).toBe('inline-flex')
      expect(resolved(v.county, 'position', width)).toBe('relative')
    }
    for (const width of PHONE) {
      expect(resolved(v.block, 'display', width)).toBe('flex')
      expect(resolved(v.block, 'flex', width)).toBe('0 0 100%')
      expect(resolved(v.county, 'display', width)).toBe('flex')
      expect(resolved(v.county, 'width', width)).toBe('100%')
      // The tail takes a line of its own; the count reads right-aligned on it.
      expect(resolved(v.tail, 'flex', width)).toBe('0 0 100%')
      expect(resolved(v.tail, 'text-align', width)).toBe('right')
      // The live region keeps its 1px clipped box (v1.0.4).
      expect(resolved(v.live, 'width', width)).toBe('1px')
    }
  })

  it('keeps Checklists\' bare county wrapper transparent on desktop only', () => {
    const v = mountBlock({ height: '28px' }, true)
    for (const width of DESKTOP) expect(resolved(v.county, 'display', width)).toBe('contents')
    for (const width of PHONE) expect(resolved(v.county, 'display', width)).toBe('flex')
  })

  it('beats the county select\'s inline geometry on a phone, and only there', () => {
    // The county select is not componentised and keeps its inline chrome, so
    // this is the one phone rule that must carry !important: without it the
    // inline 26px height and 5px radius win and the county row stays the old
    // size beside a 30px pair. Resolved against BOTH inline shapes the surfaces
    // use, a fixed `height` (Breeding Codes) and a `min-height` (Multimedia).
    for (const inline of [{ height: '26px', borderRadius: '5px' }, { minHeight: '1.75rem', borderRadius: '5px' }]) {
      const v = mountBlock(inline)
      for (const width of PHONE) {
        expect(resolved(v.select, 'width', width)).toBe('100%')
        expect(resolved(v.select, 'height', width)).toBe('auto')
        expect(resolved(v.select, 'min-height', width)).toBe('30px')
        expect(resolved(v.select, 'border-radius', width)).toBe('6px')
      }
      for (const width of DESKTOP) {
        expect(resolved(v.select, 'border-radius', width)).toBe('5px')
        expect(resolved(v.select, 'width', width)).toBeUndefined()
      }
      cleanup()
    }
  })

  it('removes the native select control on a phone, where WebKit ignores its min-height', () => {
    // THE DEFECT THIS ROW EXISTS FOR (QA attempt 1): desktop WebKit and iOS do
    // not honour `min-height` on a NATIVELY drawn select, so Checklists' county
    // (whose inline `selectStyle` sets no `appearance`) rendered 23px on desktop
    // WebKit and 29px on iOS under a 30px minimum, while Chromium and the three
    // surfaces that set `appearance: none` inline measured 30px. jsdom honours
    // `min-height`, so the resolved height above stayed green through all of it;
    // this row pins the declaration that makes the minimum real in WebKit, on
    // exactly the shape that failed: a select with no `appearance` of its own.
    const checklistsShape = { height: '28px', padding: '0 8px', borderRadius: '6px' }
    const v = mountBlock(checklistsShape, true)
    for (const width of PHONE) {
      expect(resolved(v.select, 'appearance', width), `@${width}`).toBe('none')
      expect(resolved(v.select, '-webkit-appearance', width), `@${width}`).toBe('none')
      // The gutter the drawn caret sits in, beating the inline `padding: 0 8px`.
      expect(resolved(v.select, 'padding-right', width), `@${width}`).toBe('22px')
      expect(resolved(v.select, 'min-height', width), `@${width}`).toBe('30px')
    }
    for (const width of DESKTOP) {
      // Desktop keeps the native control and its own inline padding.
      expect(resolved(v.select, 'appearance', width), `@${width}`).toBeUndefined()
      expect(resolved(v.select, 'padding-right', width), `@${width}`).toBe('8px')
    }
  })

  it('pairs every phone-tier select minimum with appearance: none, structurally', () => {
    // The invariant behind the row above, stated over the stylesheet rather than
    // one fixture, so a select rule added to the block later cannot re-open it:
    // any <=640 rule that gives a select inside the block a `min-height` must
    // also remove the native control. Both spellings are declared, matching the
    // three call sites that set it inline; the build keeps only the one its
    // browser targets need (today the unprefixed one).
    const isBlock = (sel: string) => /\.sr-whenwhere\b|\.sr-whenwhere-|\.sr-daterange\b|\.sr-daterange-/.test(sel)
    const subjectIsSelect = (sel: string) => /(^|[\s>+~])select(?=$|[.:[\s])/.test(sel.trim().split(/[\s>+~]+/).pop() ?? '')
    const minHeightOnSelect = RULES.filter(r =>
      r.ancestors.includes('@media (max-width: 640px)') &&
      r.selectors.some(sel => isBlock(sel) && subjectIsSelect(sel)) &&
      r.decls.some(d => d.prop === 'min-height'))
    expect(minHeightOnSelect.length, 'never vacuous: the county select rule must be found').toBeGreaterThan(0)
    for (const r of minHeightOnSelect) {
      const decl = (prop: string) => r.decls.find(d => d.prop === prop)?.value
      expect(decl('appearance'), r.selectors.join(', ')).toBe('none')
      expect(decl('-webkit-appearance'), r.selectors.join(', ')).toBe('none')
    }
  })

  it('draws the caret the phone tier removed, only on a phone, tinted when set', () => {
    for (const set of [false, true]) {
      const v = mountBlock({ height: '28px' }, true, set)
      for (const width of DESKTOP) expect(resolved(v.caret!, 'display', width)).toBe('none')
      for (const width of PHONE) {
        expect(resolved(v.caret!, 'display', width)).toBe('block')
        expect(resolved(v.caret!, 'position', width)).toBe('absolute')
        expect(resolved(v.caret!, 'pointer-events', width)).toBe('none')
        expect(resolved(v.caret!, 'color', width)).toBe(set ? 'var(--sr-accent)' : 'var(--sr-text-muted)')
      }
      cleanup()
    }
  })

  it('every county wrapper in the block draws a caret beside its select', () => {
    // The shared rule removes the native control from EVERY select in the block,
    // so a wrapper without a drawn caret would leave a dropdown with no sign it
    // is one. Read from each call site's own wrapper, comments stripped.
    for (const file of ['components/LifeList.tsx', 'components/BreedingCodeList.tsx', 'components/SpeciesDetail.tsx', 'components/Checklists.tsx']) {
      const wrappers = [...source(file).matchAll(/className="sr-whenwhere-county[^"]*"[\s\S]*?<\/div>/g)]
      expect(wrappers, file).toHaveLength(1)
      expect(wrappers[0][0], `${file}: the county wrapper must hold its select`).toMatch(/<select\b/)
      expect(wrappers[0][0], `${file}: the county wrapper must draw a caret`).toContain('\u25BE')
    }
  })

  it('draws the separator verbatim on desktop and hides it on a phone', () => {
    const v = mountBlock({})
    for (const width of DESKTOP) {
      expect(resolved(v.sep, 'display', width)).toBeUndefined()
      expect(resolved(v.sep, 'width', width)).toBe('1px')
      expect(resolved(v.sep, 'height', width)).toBe('20px')
      expect(resolved(v.sep, 'background-color', width)).toBe('var(--sr-border)')
      expect(resolved(v.sep, 'flex-shrink', width)).toBe('0')
      expect(resolved(v.sep, 'align-self', width)).toBe('center')
      expect(resolved(v.sep, 'margin', width)).toBe('0 3px')
    }
    for (const width of PHONE) expect(resolved(v.sep, 'display', width)).toBe('none')
  })
})

// ── The call sites ───────────────────────────────────────────────────────────

/** Source with comments blanked, so prose describing a shape cannot satisfy or fail a scan. */
function source(name: string): string {
  return readFileSync(resolve(here, '..', name), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length))
}

describe('every call site uses the shared pair and the lifted separator', () => {
  const SURFACES: [string, DateRangeRegister, number][] = [
    // file, register, separators it draws (counted, not merely present)
    ['components/LifeList.tsx', 'multimedia', 6],
    ['components/SpeciesDetail.tsx', 'species-detail', 0],
    ['components/BreedingCodeList.tsx', 'breeding-codes', 2],
    ['components/Checklists.tsx', 'checklists', 2],
    ['components/MapExplorer.tsx', 'map-sidebar', 0],
  ]

  for (const [file, register, seps] of SURFACES) {
    it(`${file}: one shared pair at its own register, no hand-drawn date input left`, () => {
      const src = source(file)
      const pairs = [...src.matchAll(/<DateRangeFields\b[\s\S]*?\/>/g)]
      expect(pairs).toHaveLength(1)
      expect(pairs[0][0]).toContain(`register="${register}"`)
      // A hand-drawn date input beside the shared one is how the five copies
      // came to drift in the first place.
      expect(src).not.toMatch(/type="date"/)
      // The arrow lives in the shared pair only, where it is aria-hidden.
      expect(src).not.toMatch(/>\s*→\s*</)
    })

    it(`${file}: ${seps} pill-row separator(s), all through the class, none inline`, () => {
      const src = source(file)
      expect([...src.matchAll(/className="sr-pill-sep(?: sr-pill-sep--spaced)?"/g)]).toHaveLength(seps)
      // The inline 1 x 20 object the class replaced, in either spelling it had.
      expect(src).not.toMatch(/width:\s*1,\s*height:\s*20/)
      expect(src).not.toMatch(/\bpillSep\b/)
    })
  }

  for (const [file] of SURFACES.slice(0, 4)) {
    it(`${file}: the county picker and the pair share one where-and-when block`, () => {
      const src = source(file)
      expect([...src.matchAll(/className="sr-whenwhere"/g)]).toHaveLength(1)
      expect([...src.matchAll(/className="sr-whenwhere-county(?: sr-whenwhere-county--bare)?"/g)]).toHaveLength(1)
      // The block is never a .sr-field-row: that class's <=480 stacking inside a
      // shrink-to-fit item is what built the reported tower.
      expect(src).not.toMatch(/className="[^"]*\bsr-whenwhere\b[^"]*\bsr-field-row\b/)
      expect(src).not.toMatch(/className="[^"]*\bsr-field-row\b[^"]*\bsr-whenwhere\b/)
    })
  }

  it('the pair\'s arrow is aria-hidden in the one place it is drawn', () => {
    const src = source('components/ui/DateRangeFields.tsx')
    const arrows = [...src.matchAll(/<span\b[^>]*>\s*→\s*<\/span>/g)]
    expect(arrows).toHaveLength(1)
    expect(arrows[0][0]).toContain('aria-hidden="true"')
    expect(arrows[0][0]).toContain('className="sr-daterange-arrow"')
  })
})
