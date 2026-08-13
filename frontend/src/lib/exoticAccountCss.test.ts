// STYLESHEET GUARD for the count-rule account (escapee-count-toggle).
//
// Two of the three claims here are invisible to the component test, and one of
// them is invisible to any layout measurement too:
//
//  1. THE LIVE REGION MUST NEVER BE HIDDEN. `display: none` on a `role="status"`
//     removes it from the ACCESSIBILITY TREE entirely, so it is inserted along
//     with its first message, which is the documented way to make a live region
//     fail to announce. That was the v0.5.83 Medium: `.sr-map-geo-error:empty
//     { display: none }` broke EVERY announcement, and it was invisible to
//     jsdom (which loads no stylesheet), to a textContent assertion, and to
//     every geometric measurement. An ABSENCE claim needs the ALL-DEPTH walk,
//     not `parseTopLevelRules`, because a hiding rule nested inside a media tier
//     would be missed by a top-level map.
//  2. THE EVIDENCE LINE MUST WRAP. A `white-space: nowrap` version ran 133.38px
//     past the card's content box at 320px and 200% text scale, measured as text
//     ink against the container's content box. Page `scrollWidth` read a clean
//     320 on that broken build, so it is not a usable assertion for it.
//  3. THE CHECKBOX ROWS take the touch-target posture on a phone.
//
// Selectors are compared EXACTLY (by rightmost compound where a rule is a
// descendant selector), never with `String.includes`: `includes('.sr-exotic')`
// also matches `.sr-exotic-why` and `.sr-exotic pre`, both of which keep a guard
// green while the rule stops doing its job.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseRulesAtAnyDepth, parseTopLevelRules } from './cssTopLevelRules'

const CSS = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const AT_ANY_DEPTH = parseRulesAtAnyDepth(CSS)
const TOP_LEVEL = parseTopLevelRules(CSS)

/** The selector list, split and trimmed. */
function selectors(sel: string): string[] {
  return sel.split(',').map(s => s.trim()).filter(Boolean)
}

/** Every rule at any depth whose selector list contains `exact`. */
function rulesFor(exact: string) {
  return AT_ANY_DEPTH.filter(r => selectors(r.selector).includes(exact))
}

const HIDING = /(?:^|[;{\s])(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)/

describe('the live region is never removed from the accessibility tree', () => {
  it('the region rule exists and is laid out, at the top level', () => {
    const body = TOP_LEVEL.get('.sr-exotic-status')
    expect(body, '.sr-exotic-status must be a top-level rule so it applies at every width').toBeTruthy()
    // Positive assertion, so the scan below cannot pass vacuously by the rule
    // simply having been deleted.
    expect(body).toMatch(/display\s*:\s*flex/)
  })

  it('NO rule at ANY depth hides it, in any of the three ways that remove it from the tree', () => {
    const rules = rulesFor('.sr-exotic-status')
    expect(rules.length).toBeGreaterThan(0)
    for (const r of rules) {
      expect(HIDING.test(r.body), `${r.selector} { ${r.body} } must not hide the live region`).toBe(false)
    }
    // ...and nothing targets it through the `:empty` shape that caused the
    // v0.5.83 defect, at any depth.
    for (const r of AT_ANY_DEPTH) {
      for (const sel of selectors(r.selector)) {
        if (!sel.startsWith('.sr-exotic-status')) continue
        expect(HIDING.test(r.body), `${sel} must not hide the live region`).toBe(false)
      }
    }
  })

  it('the message child is never hidden either', () => {
    for (const r of rulesFor('.sr-exotic-msg')) {
      expect(HIDING.test(r.body)).toBe(false)
    }
  })

  it('guard-the-guard: the hiding matcher really does fire on the shapes it names', () => {
    // A matcher that had gone inert would report every rule clean, which is
    // exactly the false confidence this file exists to avoid.
    for (const decl of ['display: none', 'display:none', 'visibility: hidden', 'content-visibility: hidden']) {
      expect(HIDING.test(`color: red; ${decl};`), decl).toBe(true)
    }
    // ...and does NOT fire on the declarations the region actually carries.
    expect(HIDING.test('display: flex; align-items: flex-start;')).toBe(false)
  })
})

describe('the evidence line wraps (the 133.38px overflow the mockup fixed)', () => {
  it('does not set nowrap, and releases the flex automatic minimum', () => {
    const body = TOP_LEVEL.get('.sr-exotic-why')
    expect(body).toBeTruthy()
    expect(body).not.toMatch(/white-space\s*:\s*nowrap/)
    expect(body).toMatch(/overflow-wrap\s*:\s*break-word/)
    // `min-width: 0` is load-bearing on BOTH the line and its row: a flex item's
    // `min-width: auto` floors it at its min-content width regardless of the
    // space available, so the wrap allowance alone does not contain it.
    expect(body).toMatch(/min-width\s*:\s*0/)
    expect(TOP_LEVEL.get('.sr-exotic-row')).toMatch(/min-width\s*:\s*0/)
  })

  it('no rule at any depth reintroduces nowrap on it', () => {
    for (const r of rulesFor('.sr-exotic-why')) {
      expect(r.body).not.toMatch(/white-space\s*:\s*nowrap/)
    }
  })

  it('the status row and the excluded row WRAP rather than shrinking their contents', () => {
    // Wrapping is what keeps the trailing action's touch target intact on a
    // phone instead of squeezing it.
    expect(TOP_LEVEL.get('.sr-exotic-statusrow')).toMatch(/flex-wrap\s*:\s*wrap/)
    expect(TOP_LEVEL.get('.sr-exotic-row')).toMatch(/flex-wrap\s*:\s*wrap/)
  })
})

describe('phone-tier posture', () => {
  it('the count-rule checkbox rows meet the touch-target minimum at <= 640', () => {
    const phone = AT_ANY_DEPTH.filter(r =>
      selectors(r.selector).includes('.sr-count-rule')
      && r.atRules.some(a => /max-width\s*:\s*640px/.test(a)))
    expect(phone.length, 'a phone-tier rule for .sr-count-rule must exist').toBeGreaterThan(0)
    expect(phone.some(r => /min-height\s*:\s*2\.75rem/.test(r.body))).toBe(true)
  })

  it('each excluded row stacks its evidence beneath the name at <= 640', () => {
    const phone = AT_ANY_DEPTH.filter(r =>
      selectors(r.selector).includes('.sr-exotic-row')
      && r.atRules.some(a => /max-width\s*:\s*640px/.test(a)))
    expect(phone.some(r => /flex-direction\s*:\s*column/.test(r.body))).toBe(true)
  })

  it('the phone rules really are inside a max-width tier, not at the top level', () => {
    // Non-vacuity for the two assertions above: an at-rule matcher that never
    // matched would make both of them pass against an empty set... which the
    // `length > 0` check already rejects, so this pins the converse — the base
    // rule must NOT carry the phone-only declaration.
    expect(TOP_LEVEL.get('.sr-count-rule')).not.toMatch(/min-height/)
    expect(TOP_LEVEL.get('.sr-exotic-row')).not.toMatch(/flex-direction\s*:\s*column/)
  })
})

describe('the feature mints no new colour', () => {
  it('every colour in the account rules comes from a var(--sr-*) token', () => {
    const ours = AT_ANY_DEPTH.filter(r =>
      selectors(r.selector).some(s => s.startsWith('.sr-exotic') || s.startsWith('.sr-count-rule')))
    expect(ours.length).toBeGreaterThan(8)
    for (const r of ours) {
      // No hex literal, no rgb()/rgba() with raw channels.
      expect(r.body, r.selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(r.body, r.selector).not.toMatch(/\brgba?\(\s*\d/)
    }
  })
})
