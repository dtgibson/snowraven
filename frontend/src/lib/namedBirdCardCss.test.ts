// Stylesheet guard for the Named Birds card's phone-width and large-text fit
// (code-search-and-a11y-polish, item 2), parsed from the REAL globals.css
// (vitest stubs CSS `?raw` imports, so it is read with `fs`).
//
// WHAT THIS FILE CANNOT SEE: whether anything fits. That is a real-engine
// claim, measured in Chromium and WebKit by
// `website/tools/verify/verify-named-bird-media-links.mjs`, which is the gate
// for it. What this file pins is the arrangement that measurement rests on and
// a later tidy-up would quietly undo: where each rule lives, which container
// each query names, and the one source-order dependence.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTopLevelRules } from './cssTopLevelRules'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
const top = parseTopLevelRules(css)

/** Every at-rule block whose prelude matches, as [offset, prelude, body]. */
function blocks(prelude: RegExp): Array<{ at: number; prelude: string; body: string }> {
  const out: Array<{ at: number; prelude: string; body: string }> = []
  const re = new RegExp(prelude.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(clean)) !== null) {
    const open = clean.indexOf('{', m.index)
    let depth = 1
    let i = open + 1
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth += 1
      else if (clean[i] === '}') depth -= 1
      i += 1
    }
    out.push({ at: m.index, prelude: clean.slice(m.index, open).trim(), body: clean.slice(open + 1, i - 1) })
  }
  return out
}
/** `selector { body }` pairs directly inside a block body (one level). */
function innerRules(body: string): Array<{ selectors: string[]; body: string; at: number }> {
  const out: Array<{ selectors: string[]; body: string; at: number }> = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const sel = m[1].trim()
    if (sel.startsWith('@')) continue
    out.push({ selectors: sel.split(',').map(s => s.trim().replace(/\s+/g, ' ')), body: m[2], at: m.index })
  }
  return out
}
const decl = (body: string, prop: string): string | null => {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(body)
  return m ? m[1].trim() : null
}

/** The established phone tier: the file's FIRST multi-line 640px block (ui.md, v1.0.10). */
const PHONE = blocks(/@media \(max-width: 640px\)/).find(b => b.body.split('\n').length > 3)!

describe('the header date range (decisions.md D4)', () => {
  it('keeps its nowrap at every width above the phone tier, as a top-level class', () => {
    expect(decl(top.get('.sr-nbh-dates') ?? '', 'white-space')).toBe('nowrap')
  })

  it('is released inside the ESTABLISHED phone tier, right-aligned', () => {
    const r = innerRules(PHONE.body).find(x => x.selectors.includes('.sr-nbh-dates'))
    expect(r, 'the release must live in the first multi-line 640px block').toBeTruthy()
    expect(decl(r!.body, 'white-space')).toBe('normal')
    expect(decl(r!.body, 'text-align')).toBe('right')
  })
})

describe('the gallery column queries (decisions.md D3)', () => {
  const gridQueries = blocks(/@container[^{]*/)
    .filter(b => innerRules(b.body).some(r => r.selectors.includes('.sr-media-grid')))

  it('every container query on the shared grid names the Named Birds section, so Species Detail is untouched', () => {
    expect(gridQueries.length).toBe(2)   // two columns, then one
    for (const q of gridQueries) expect(q.prelude).toMatch(/^@container sr-nb-media \(max-width: \d+em\)$/)
    expect(decl(top.get('.sr-nb-media') ?? '', 'container-name')).toBe('sr-nb-media')
  })

  it('stays one class deep and ABOVE the phone tier, so the tier\'s one column still wins at 640px and below', () => {
    // Both are (0,1,0), so SOURCE ORDER decides. A descendant form
    // (`.sr-nb-media .sr-media-grid`) or a move below the tier would give a
    // phone two columns where it has one.
    const tierRule = innerRules(PHONE.body).find(r => r.selectors.includes('.sr-media-grid'))
    expect(tierRule && decl(tierRule.body, 'grid-template-columns')).toBe('1fr')
    for (const q of gridQueries) {
      for (const r of innerRules(q.body)) {
        for (const s of r.selectors) expect(s).toMatch(/^\.sr-media-(?:grid|disabled-list)$/)
      }
      expect(q.at).toBeLessThan(PHONE.at)
    }
  })
})

describe('text that must wrap inside the card', () => {
  it('the section header\'s name breaks ANYWHERE from a released minimum', () => {
    // `break-word` renders identically and does not lower a flex item's
    // automatic minimum (ui.md, v1.0.14), so the 120-character name would
    // still run past the card.
    const body = top.get('.sr-nb-head-text') ?? ''
    expect(decl(body, 'overflow-wrap')).toBe('anywhere')
    expect(decl(body, 'min-width')).toBe('0')
  })

  it('no rule for the tile meta row or the sighting line forbids wrapping', () => {
    const own = [...top.entries()].filter(([sel]) => /^\.sr-nb(?:m|s)-/.test(sel))
    expect(own.length).toBeGreaterThanOrEqual(10)   // non-vacuity: the rules exist
    for (const [sel, body] of own) expect(decl(body, 'white-space'), sel).toBeNull()
  })

  it('the stacked checklist link takes the 44px posture in the phone tier, inside its row query', () => {
    const nested = blocks(/@container sr-nbs \(max-width: 22em\)/)
    const inTier = nested.filter(b => b.at > PHONE.at && b.at < PHONE.at + PHONE.body.length)
    expect(inTier).toHaveLength(1)
    const r = innerRules(inTier[0].body).find(x => x.selectors.includes('.sr-nbs-link'))
    expect(r && decl(r.body, 'min-height')).toBe('2.75rem')
    // ...and the query outside the tier stacks the row at every width.
    const base = nested.find(b => b.at < PHONE.at)!
    const link = innerRules(base.body).find(x => x.selectors.includes('.sr-nbs-link'))!
    expect(decl(link.body, 'flex-basis')).toBe('100%')
  })
})
