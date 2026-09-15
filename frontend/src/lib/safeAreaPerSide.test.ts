/// <reference types="node" />
// PER-SIDE SAFE-AREA INSETS (improve: apple-platform-readiness, item 3).
//
// WHAT THIS PINS AND WHY IT IS A GUARD RATHER THAN A FIX. The stylesheet is
// already per-side correct everywhere -- every horizontal declaration reads its
// OWN side's variable, and no rule reuses one side's value for the other. This
// file exists so it STAYS that way. Apple's foldable iPhone ships with a hinge,
// and WebKit exposes neither the Device Posture nor the Viewport Segments API,
// so the app cannot detect a fold at all: there is nothing to build for it
// beyond never assuming the two horizontal insets are equal. The cheapest way
// that assumption gets introduced is a tidy-looking edit --
// `padding-right: env(safe-area-inset-left)` to "mirror" a rule, or a shorthand
// that applies one measured value to both edges. Neither is visible in review
// and both are silent on every phone whose insets happen to match.
//
// THE SUBJECTS ARE DERIVED, NEVER NAMED. `findAllSafeAreaDeclarations` reads
// every AST-confirmed safe-area declaration in globals.css at any at-rule or
// nesting depth. A guard that listed its surfaces would be a roster wearing a
// totality claim's clothes (.claude/rules/testing.md, v1.0.16) -- the defect
// this exists to catch arrives on a surface nobody has written yet, so a named
// list is exactly the shape that cannot see it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { findAllSafeAreaDeclarations } from './cssTopLevelRules'

const css = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const indexHtml = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')

type Side = 'top' | 'right' | 'bottom' | 'left'
const SIDES: Side[] = ['top', 'right', 'bottom', 'left']

/**
 * The physical side a PROPERTY addresses, or null when it addresses none.
 *
 * Matched on the last dash-separated segment so `padding-left`,
 * `scroll-margin-top` and the bare `left` all resolve, while `height`,
 * `max-height` and any future side-free property resolve to null and are
 * outside the side-agreement rule by construction rather than by exemption.
 */
function propertySide(property: string): Side | null {
  const last = property.split('-').pop() ?? ''
  return (SIDES as string[]).includes(last) ? (last as Side) : null
}

/** The physical side a safe-area variable names. `safe-area-inset-left` -> left. */
function variableSide(variable: string): Side | null {
  const last = variable.split('-').pop() ?? ''
  return (SIDES as string[]).includes(last) ? (last as Side) : null
}

const declarations = findAllSafeAreaDeclarations(css)

/** Every declaration whose property addresses a physical side. */
const sided = declarations
  .map(d => ({ ...d, side: propertySide(d.property) }))
  .filter((d): d is typeof d & { side: Side } => d.side !== null)

const horizontal = sided.filter(d => d.side === 'left' || d.side === 'right')

/**
 * Rules that deliberately inset ONE horizontal edge only.
 *
 * A row is keyed on selector PLUS side and carries its own `count`, and the
 * comparison below is a counted multiset rather than a membership test
 * (.claude/rules/testing.md, v1.0.16): a row keyed on the selector alone would
 * be a blanket pardon for that rule, so a SECOND unmatched horizontal
 * declaration added beside an already-rostered one would be absorbed in silence
 * -- which is the exact defect this file exists to catch.
 */
const SINGLE_EDGE_BY_DESIGN: Array<{ selector: string, side: Side, count: number, why: string }> = [
  {
    selector: '.sr-ios-app .sr-map-fab-cluster',
    side: 'right',
    count: 1,
    why: 'The FAB cluster is anchored to the right edge and declares no `left` at all, '
      + 'so there is no opposite edge to inset. Adding one would move the cluster.',
  },
  {
    selector: '.sr-ios-app .sr-skip-link:focus',
    side: 'left',
    count: 1,
    why: 'globals.css states the reason at the rule: `left` yes, `right` never. The element '
      + 'declares no `right`, and adding one to a width:auto fixed box would stretch the pill '
      + 'across the viewport. In the rotation where the housing is on the far side, inset-left '
      + 'is 0 and the calc collapses to the shipped 16px.',
  },
]

const key = (selector: string, side: Side) => `${selector} :: ${side}`

describe('safe-area insets are per-side', () => {
  it('is reading a real stylesheet (non-vacuity)', () => {
    // A parser that silently matched nothing would pass every assertion below.
    expect(declarations.length).toBeGreaterThan(30)
    expect(sided.length).toBeGreaterThan(20)
    expect(horizontal.length).toBeGreaterThan(8)
  })

  it('the viewport that makes any of this observable is still opted in', () => {
    // With no `viewport-fit=cover` every inset resolves to 0 and every rule
    // below is inert, so the per-side claim would be vacuously true.
    expect(indexHtml).toMatch(/viewport-fit\s*=\s*cover/)
  })

  it('NO DECLARATION READS THE OPPOSITE SIDE (the doubling assumption)', () => {
    const wrong = sided.flatMap(d =>
      d.safeAreaVariables
        .filter(v => variableSide(v) !== null && variableSide(v) !== d.side)
        .map(v => `${d.selector} { ${d.property}: ...${v}... }`),
    )
    expect(wrong, 'a property must only ever read its own side\'s inset').toEqual([])
  })

  it('every rule that insets one horizontal edge insets the other, or is rostered', () => {
    const bySelector = new Map<string, Set<Side>>()
    for (const d of horizontal) {
      const set = bySelector.get(d.selector) ?? new Set<Side>()
      set.add(d.side)
      bySelector.set(d.selector, set)
    }
    const singles = [...bySelector.entries()]
      .filter(([, sides]) => sides.size === 1)
      .map(([selector, sides]) => key(selector, [...sides][0]))
      .sort()
    const rostered = SINGLE_EDGE_BY_DESIGN.map(r => key(r.selector, r.side)).sort()
    expect(singles, 'a one-edge horizontal rule must pair up or join SINGLE_EDGE_BY_DESIGN with its reason')
      .toEqual(rostered)
  })

  it.each(SINGLE_EDGE_BY_DESIGN)(
    'rostered single edge $selector ($side) occurs exactly $count time(s)',
    ({ selector, side, count }) => {
      const found = horizontal.filter(d => d.selector === selector && d.side === side)
      expect(found.length).toBe(count)
    },
  )

  it('every rostered row carries a reason', () => {
    for (const row of SINGLE_EDGE_BY_DESIGN) expect(row.why.length).toBeGreaterThan(40)
  })
})

// GUARD THE GUARD. Each fixture is a form the defect could genuinely return in,
// run through the same derivation the assertions above use. Without these, a
// derivation that matched nothing would report a clean stylesheet.
describe('the per-side derivation rejects the defects it exists to catch', () => {
  const sidedOf = (src: string) => findAllSafeAreaDeclarations(src)
    .map(d => ({ ...d, side: propertySide(d.property) }))
    .filter((d): d is typeof d & { side: Side } => d.side !== null)

  it.each([
    ['one side\'s value reused for the other', '.x { padding-right: env(safe-area-inset-left); }'],
    ['a mirrored calc', '.x { right: calc(16px + env(safe-area-inset-left)); }'],
    ['vertical crossed too', '.x { padding-bottom: env(safe-area-inset-top); }'],
  ])('rejects %s', (_name, fixture) => {
    const wrong = sidedOf(fixture).filter(d =>
      d.safeAreaVariables.some(v => variableSide(v) !== null && variableSide(v) !== d.side))
    expect(wrong.length).toBe(1)
  })

  it.each([
    ['a matched pair', '.x { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }'],
    ['a side-free property', '.x { height: calc(100dvh - env(safe-area-inset-top)); }'],
  ])('accepts %s', (_name, fixture) => {
    const wrong = sidedOf(fixture).filter(d =>
      d.safeAreaVariables.some(v => variableSide(v) !== null && variableSide(v) !== d.side))
    expect(wrong).toEqual([])
  })

  it('an unpaired horizontal rule is visible as a single edge', () => {
    const fixture = '.x { padding-left: env(safe-area-inset-left); }'
    const h = sidedOf(fixture).filter(d => d.side === 'left' || d.side === 'right')
    expect(h.map(d => `${d.selector} :: ${d.side}`)).toEqual(['.x :: left'])
  })

  it('propertySide reads the LAST segment, so a side-named prefix cannot fool it', () => {
    expect(propertySide('scroll-margin-top')).toBe('top')
    expect(propertySide('left-gutter-width')).toBe(null)
    expect(propertySide('height')).toBe(null)
    expect(propertySide('left')).toBe('left')
  })
})
