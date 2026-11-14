// The stylesheet half of Search's location rows (visited-hotspots-in-search,
// design DD-1 to DD-4). Declaration-level only: whether the rows wrap, fit and
// read right at 320px and 200% text is measured in Chromium and WebKit against
// the built app (decisions.md), which no stylesheet scan can stand in for.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTopLevelRules } from './cssTopLevelRules'

const CSS = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const CLEAN = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
const RULES = parseTopLevelRules(CSS)
function rule(selector: string): string {
  const body = RULES.get(selector)
  if (body === undefined) throw new Error(`no top-level rule for ${selector}`)
  return body
}

describe('DD-1: the location name wraps and is never cut by CSS', () => {
  it('the name and the meta line are blocks that wrap anywhere, with no nowrap, ellipsis or clamp', () => {
    for (const sel of ['.sr-palette-loc-name', '.sr-palette-loc-meta']) {
      const body = rule(sel)
      expect(body).toContain('display: block')
      expect(body).toContain('overflow-wrap: anywhere')
      expect(body).not.toMatch(/white-space\s*:\s*nowrap|text-overflow|line-clamp/)
    }
    expect(rule('.sr-palette-loc')).toContain('display: block')
  })
})

describe('DD-4: the highlighted row\'s place and ID take the full ink', () => {
  it('the active row\'s meta line is --sr-text', () => {
    expect(rule('.sr-palette-row--active .sr-palette-loc-meta')).toContain('color: var(--sr-text)')
  })
})

describe('DD-3: a cap line followed by another group gets air beneath it', () => {
  it('the rule exists at the top level', () => {
    expect(rule('.sr-palette-results [role="group"]:not(:last-child) > .sr-palette-note')).toContain('margin-bottom: 8px')
  })
})

describe('DD-2: the narrow-field hint', () => {
  it('the field is a named inline-size container at 1rem, and the hint is hidden until the query fires', () => {
    const field = rule('.sr-palette-field')
    expect(field).toContain('container-type: inline-size')
    expect(field).toContain('container-name: sr-palette-field')
    expect(field).toContain('position: relative')
    expect(rule('.sr-palette-hint')).toContain('display: none')
    expect(rule('.sr-palette-hint')).toContain('pointer-events: none')
  })

  it('the query is the disjunction of an em and a px threshold, and shows the hint only over an empty field', () => {
    const at = CLEAN.indexOf('@container sr-palette-field (max-width: 27em) or (max-width: 432px) {')
    expect(at).toBeGreaterThan(-1)
    const block = CLEAN.slice(at, CLEAN.indexOf('}\n}', at) + 3)
    expect(block).toContain('.sr-palette-input::placeholder { color: transparent; }')
    expect(block).toContain('.sr-palette-input:placeholder-shown + .sr-palette-hint { display: block; }')
  })

  it('the phone tier\'s 16px for the hint IS --sr-ctl-floor, so the two declarations cannot drift', () => {
    // The palette section may not read the floor's variable (paletteCss.test.ts
    // holds every --sr-* reference there to the two theme blocks), so the value
    // is written and compared here (testing.md v1.0.33: two declarations of one
    // number are compared to each other, never restated).
    const floor = /--sr-ctl-floor:\s*([^;]+);/.exec(rule(':root'))
    expect(floor).not.toBeNull()
    const hint = /\.sr-palette-hint \{ font-size: max\((\d+px), 1rem\); \}/.exec(CLEAN)
    expect(hint).not.toBeNull()
    expect(hint![1]).toBe(floor![1].trim())
    // It sits inside the palette's own phone block, after the base rule.
    const phone = CLEAN.lastIndexOf('@media (max-width: 640px) {')
    expect(hint!.index).toBeGreaterThan(phone)
    expect(CLEAN.indexOf('.sr-palette-hint {')).toBeLessThan(phone)
  })
})
