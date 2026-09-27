// Stylesheet guards for the Calendar overlay tile (calendar-overlays QA F1 and
// F2). Both defects are LAYOUT defects that jsdom cannot see (it loads no
// stylesheet and has no layout engine), so what is asserted here is the shape
// of the rules that removed them, read from the real globals.css at any depth.
// The layout itself was measured in Chromium and WebKit by width-band sweeps
// (pipeline/calendar-overlays/decisions.md E5-07, E5-08); these rows keep the
// shape those sweeps certified from being edited back. Three WebKit behaviours
// were measured, and each has a row that forbids the shape it bites:
//
//   1. a grid row sized from a STALE flex-wrap line count after the text size
//      changes under a laid-out grid (F1): no fact row may wrap, and the
//      stack-or-inline choice is a container query on the cell;
//   2. a column flex keeping its items' shrink-to-fit widths from an earlier,
//      narrower cell after a resize: the stacked pair is block layout;
//   3. a shrink-to-fit box sized WITHOUT its trailing letter-spacing, so an
//      ellipsis fires on text that fits ("NY" drawn as "N.."): no ellipsis box
//      on the code; the tile's bound is tileCodeText's text, and the block's
//      clip at the cell edge is the backstop (F2).
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseRulesAtAnyDepth, parseTopLevelRules } from './cssTopLevelRules'
import { TILE_PADDING_INLINE_REM } from './calendarOverlays'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const all = parseRulesAtAnyDepth(css)
const top = parseTopLevelRules(css)

const decls = (body: string): Map<string, string> => {
  const m = new Map<string, string>()
  for (const part of body.split(';')) {
    const i = part.indexOf(':')
    if (i > 0) m.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim().toLowerCase().replace(/\s+/g, ' '))
  }
  return m
}
const queryEm = (atRules: string[]): number | null => {
  for (const a of atRules) {
    const m = a.match(/@container\s*\(\s*max-width\s*:\s*([0-9.]+)em\s*\)/)
    if (m) return Number(m[1])
  }
  return null
}

// Every rule whose selector reaches the tile's fact blocks or their rows.
// Row modifiers (.sr-fact--more, .sr-fact--cat, .sr-fact-n) are rows too.
const FACT_SUBJECT = /\.sr-cal-facts(?![\w-])|\.sr-cal-facts--(rich|condensed)(?![\w-])|\.sr-fact(-[a-z-]+)?(?![\w-])/
const factRules = all.filter(r => FACT_SUBJECT.test(r.selector))
const ROW = '.sr-cal-facts--condensed .sr-fact'

describe('the tile\'s fact rows never let flex line breaking decide their height (QA F1)', () => {
  it('finds the fact-row rules at all (non-vacuous)', () => {
    expect(factRules.length).toBeGreaterThanOrEqual(10)
    expect(factRules.some(r => r.selector === ROW)).toBe(true)
    // The By-category row (D4-11) is inside every check below.
    expect(factRules.some(r => r.selector === '.sr-fact--cat b')).toBe(true)
  })

  it('no rule reaching a fact block or row lets it wrap, at any depth', () => {
    const wrapping = factRules
      .filter(r => { const d = decls(r.body); return /^wrap/.test(d.get('flex-wrap') ?? '') || /\bwrap\b/.test(d.get('flex-flow') ?? '') })
      .map(r => `${r.atRules.join(' ')} ${r.selector}`.trim())
    expect(wrapping).toEqual([])
  })

  it('the condensed row sits inline without wrapping, at the top level', () => {
    const body = top.get(ROW)
    expect(body, 'a top-level rule for the condensed row').toBeTruthy()
    const d = decls(body!)
    expect(d.get('display')).toBe('flex')
    expect(d.get('flex-wrap')).toBe('nowrap')
  })

  it('one container-query rule stacks the pair, as BLOCK layout, below the rich/condensed threshold', () => {
    const stack = factRules.filter(r => r.selector === ROW && queryEm(r.atRules) !== null && decls(r.body).get('display') === 'block')
    expect(stack).toHaveLength(1)
    const at = queryEm(stack[0].atRules)!
    // The stacked children are blocks too (the glyph centred by its margins).
    const kids = factRules.filter(r => queryEm(r.atRules) === at && decls(r.body).get('display') === 'block' && r.selector.startsWith(`${ROW} >`))
    expect(kids.map(r => r.selector).sort()).toEqual([`${ROW} > b`, `${ROW} > span`])
    // The rich/condensed switch, read from the stylesheet rather than retyped.
    const condensedShown = factRules.find(r => r.selector === '.sr-cal-facts--condensed'
      && decls(r.body).get('display') === 'flex' && queryEm(r.atRules) !== null)
    expect(condensedShown, 'the rich/condensed container query').toBeTruthy()
    expect(at).toBeLessThan(queryEm(condensedShown!.atRules)!)
    // Measured in both engines (decisions.md E5-07), not derivable in jsdom:
    // the widest known code needs 1.61em of the cell's font beside its glyph,
    // and a 320px phone cell at 100% offers 1.79em, where the approved design
    // shows the pair inline. The threshold must sit between the two.
    expect(at).toBeGreaterThan(1.61)
    expect(at).toBeLessThan(1.785)
  })

  it('no rule turns the condensed row into a column flex (WebKit keeps stale item widths there)', () => {
    const column = factRules.filter(r => r.selector === ROW && /^column/.test(decls(r.body).get('flex-direction') ?? ''))
    expect(column.map(r => `${r.atRules.join(' ')} ${r.selector}`)).toEqual([])
  })
})

describe('fact ink never leaves its cell, and the code needs no ellipsis box (QA F2)', () => {
  const block = decls(top.get('.sr-cal-facts') ?? '')

  it('the fact block spans the cell\'s whole border box, giving back exactly the tile\'s inline padding', () => {
    // Two declarations of one number, compared, never retyped: the component
    // pads the tile by TILE_PADDING_INLINE_REM a side, and the block returns it.
    expect(block.get('width')).toBe(`calc(100% + ${2 * TILE_PADDING_INLINE_REM}rem)`)
    expect(block.get('margin-inline')).toBe(`-${TILE_PADDING_INLINE_REM}rem`)
  })

  it('the rich rows keep the tile\'s inset as the block\'s own padding; the centred condensed rows take the full width', () => {
    // clip cuts at the PADDING box, so the rich rows sit at the designed inset
    // while the clip line is still the cell edge.
    expect(decls(top.get('.sr-cal-facts--rich') ?? '').get('padding-inline')).toBe(`${TILE_PADDING_INLINE_REM}rem`)
    expect(decls(top.get('.sr-cal-facts--condensed.is-backed') ?? '').get('padding-inline')).toBe('0')
  })

  it('and clips at the cell edge with `clip`, never `hidden` (no scroll container, so a short tile cannot hide)', () => {
    expect(block.get('overflow-x')).toBe('clip')
    const hidden = factRules.filter(r => { const d = decls(r.body); return d.get('overflow') === 'hidden' || d.get('overflow-y') === 'hidden' || d.get('overflow-x') === 'hidden' })
    expect(hidden.map(r => r.selector)).toEqual([])
  })

  it('no rule puts an ellipsis box on a fact row\'s text (WebKit fires it on text that fits)', () => {
    const ellipsis = factRules.filter(r => decls(r.body).has('text-overflow')).map(r => r.selector)
    expect(ellipsis).toEqual([])
  })

  it('the rows do not wrap their text (one line per glyph or text)', () => {
    expect(decls(top.get('.sr-fact')!).get('white-space')).toBe('nowrap')
  })
})

describe('a "By category" tile turns compact at the width its short label and count need (D4-11, E5-12)', () => {
  // Measured in Chromium and WebKit (decisions.md E5-12): glyph, Conf/Prob/Poss
  // and the count need at most this much of the cell's font, by the widest
  // count's digits (the component's categoryCountDigits states it as a class).
  // At the base 2.4em a "Conf 26" row met its count by up to 7.5px.
  const NEED: [cls: string, em: number][] = [['sr-cal-facts--cat', 2.557], ['sr-cal-facts--cat-2d', 2.938], ['sr-cal-facts--cat-3d', 3.319]]
  const base = queryEm(factRules.find(r => r.selector === '.sr-cal-facts--condensed' && decls(r.body).get('display') === 'flex' && queryEm(r.atRules) !== null)!.atRules)!

  it.each(NEED)('%s: rich hidden and compact shown under one query, just above the measured need', (cls, need) => {
    const hide = all.filter(r => r.selector === `.sr-cal-facts--rich.${cls}` && decls(r.body).get('display') === 'none')
    const show = all.filter(r => r.selector === `.sr-cal-facts--condensed.${cls}` && decls(r.body).get('display') === 'flex')
    expect(hide, 'one rule hides the rich block').toHaveLength(1)
    expect(show, 'one rule shows the compact block').toHaveLength(1)
    const at = queryEm(hide[0].atRules)
    expect(at).toBe(queryEm(show[0].atRules))
    expect(at!).toBeGreaterThan(need)
    expect(at!).toBeLessThan(need + 0.15)
    expect(at!).toBeGreaterThan(base)
  })

  it('the thresholds rise with the digits (a wider count never flips sooner)', () => {
    const at = NEED.map(([cls]) => queryEm(all.find(r => r.selector === `.sr-cal-facts--rich.${cls}`)!.atRules)!)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(new Set(at).size).toBe(NEED.length)
  })
})
