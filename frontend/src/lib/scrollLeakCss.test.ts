// Guards for the 320px / 200% page-scroll repairs (a11y-taxonomy-screenshot-sweep).
//
// All five repairs are CSS, so the RULE is the fix and every property that
// matters is invisible to a jsdom component test: no layout engine, no media
// queries, no cascade against React's inline styles. This parses the REAL
// globals.css, the same posture as filterControlSizeCss / milestoneContrast /
// calendarContrast / breedingCodePinnedCss.
//
// What these tests can and cannot do, stated because the distinction cost a
// build here: a stylesheet assertion proves a declaration EXISTS, never that it
// wins or what it measures. The geometry itself was settled in a real render
// (pipeline/a11y-taxonomy-screenshot-sweep/overflow-discovery-probe.mjs, which
// drives the built app against the synthetic demo dataset and measures each
// element's right edge against the viewport). These guards exist to stop a
// future edit silently undoing a repair, not to re-prove the measurement.
//
// Every assertion is written against a SPECIFIC wrong implementation, named in
// its comment, and each was verified to fail by mutating the source. Two of
// them are the exact shapes that shipped: `.sr-field-row > *` without the
// exclusion, and an inline `min-width: 0` out-ranking a class rule.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

// Comments blanked to spaces of EQUAL LENGTH so offsets still point at the same
// character while no assertion can be satisfied by prose. Load-bearing here:
// the comments beside these rules quote the very selectors under test
// (`.sr-field-row > *`, `min-width: 0`), so a raw-text search finds the wrong
// thing and would pass on a stylesheet whose rules had been deleted.
const masked = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

interface Rule { selector: string; body: string; offset: number }

function rules(): Rule[] {
  const out: Rule[] = []
  for (const m of masked.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].trim(), body: m[2], offset: m.index! + m[1].search(/\S/) })
  }
  return out
}

/** Offset range of a `@media (max-width: Npx)` block, by brace matching. */
function tierRange(px: number): [number, number] {
  const at = masked.indexOf(`@media (max-width: ${px}px) {\n`)
  if (at < 0) throw new Error(`the <=${px} tier block was not found`)
  const open = masked.indexOf('{', at)
  let depth = 0
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{') depth++
    else if (masked[i] === '}' && --depth === 0) return [open, i]
  }
  throw new Error('unbalanced braces in globals.css')
}

const inRange = (r: Rule, [a, b]: [number, number]) => r.offset > a && r.offset < b

/** Rules whose selector list contains an exact comma-separated member. */
function withSelector(sel: string): Rule[] {
  return rules().filter(r => r.selector.split(',').some(s => s.trim() === sel))
}

/** A property matcher anchored at a declaration boundary, so `width` cannot be
 *  satisfied by `min-width` / `max-width` (the looseness roadmapped as
 *  "tighten the declaration matchers"). */
const decl = (body: string, prop: string) =>
  new RegExp(`(^|[;{\\s])${prop}\\s*:`).test(body)

// ── 1. Checklists: the .sr-only live region ──────────────────────────────────

describe('a visually-hidden live region is excluded from the phone-tier stacking rules', () => {
  // THE SHIPPED DEFECT. `.sr-field-row > *` matched the absolutely positioned
  // `<span class="sr-only" aria-live="polite">` in the Checklists filter row and
  // gave it `width: 100%`, which for an absolutely positioned box resolves
  // against its containing block rather than the row: a 320px box at x=42, right
  // edge 362 in a 320px viewport. Exactly the 42px page leak, at EVERY text
  // scale. Equal specificity (0,1,0) with .sr-only's own rule meant source order
  // decided it, and the tier block is later in the file.
  //
  // Mutation check: dropping `:not(.sr-only)` from either selector turns this
  // red, which is the shape that shipped.
  // Matched anywhere in the selector, not just at its start: the third instance
  // is `.sr-map-sidebar-overlay .sr-field-row > *`, which an anchored pattern
  // silently skipped — and skipping it is precisely how the defect would return
  // by the other route.
  const universalChildWidthRules = () =>
    rules().filter(r =>
      /\.sr-(field-row|action-row-stack)\s*>\s*\*/.test(r.selector) &&
      decl(r.body, 'width'))

  it('every universal-child width rule on these rows excludes .sr-only', () => {
    const found = universalChildWidthRules()
    // Guard the guard: if the rules are renamed away, this test must fail rather
    // than pass vacuously on an empty set.
    expect(found.length).toBeGreaterThanOrEqual(3)
    for (const r of found) {
      expect(r.selector, `${r.selector} must not reach a .sr-only live region`)
        .toContain(':not(.sr-only)')
    }
  })

  it('.sr-only itself still declares the 1px clipped box it is exempted to keep', () => {
    const [only] = withSelector('.sr-only')
    expect(only).toBeDefined()
    expect(only.body).toMatch(/position\s*:\s*absolute/)
    expect(only.body).toMatch(/width\s*:\s*1px/)
    // The exemption is only worth anything if the element is genuinely removed
    // from layout; a .sr-only that had grown a real box would need a different fix.
    expect(only.body).toMatch(/overflow\s*:\s*hidden/)
  })
})

// ── 2. Statistics: Rainbow Connection name rows ──────────────────────────────

describe('the Rainbow Connection name span can force its row to break', () => {
  // THE FIRST ATTEMPT, WHICH WAS INERT. The phone-tier floor was written while
  // the element still carried an inline `min-width: 0` (specificity 1,0,0), so
  // the class rule lost outright and the measured leak did not move (59.8px ->
  // 15.8px from the wrap alone, then stuck). The base rule below is what makes
  // the tier rule reachable, so it is asserted rather than assumed.
  it('declares the base min-width on the class, not inline on the element', () => {
    const base = withSelector('.sr-fl-name').filter(r => !inRange(r, tierRange(640)))
    expect(base).toHaveLength(1)
    expect(base[0].body).toMatch(/min-width\s*:\s*0/)
  })

  it('the phone tier floors it with a self-collapsing min(), never a bare length', () => {
    const tier = withSelector('.sr-fl-name').filter(r => inRange(r, tierRange(640)))
    expect(tier).toHaveLength(1)
    // A bare `min-width: 8rem` is the wrong implementation: at 200% text scale
    // that is 256px inside a 242px card, so the floor would BECOME the overflow
    // it exists to prevent. The min(..., 100%) form is the app's self-collapsing
    // idiom and can never exceed the container.
    expect(tier[0].body).toMatch(/min-width\s*:\s*min\([^)]*,\s*100%\s*\)/)
  })

  it('lets the name row wrap so the two-link group stays with the name', () => {
    const row = withSelector('.sr-fl-name .sr-birdname-row')
    expect(row).toHaveLength(1)
    expect(row[0].body).toMatch(/flex-wrap\s*:\s*wrap/)
    expect(inRange(row[0], tierRange(640))).toBe(true)
  })
})

// ── 3. Calendar: the year stepper ────────────────────────────────────────────

describe('the Calendar year stepper wraps instead of leaking page scroll', () => {
  // The layout had to be LIFTED out of Calendar.tsx's inline styles first: an
  // inline `display: flex` is specificity (1,0,0) and no media query can reach
  // it. Assert both halves — the base rules that replace the inline values, and
  // the tier rules that could not have existed without them.
  for (const sel of ['.sr-cal-year-group', '.sr-cal-year-nav']) {
    it(`${sel} declares its base layout in the stylesheet`, () => {
      const base = withSelector(sel).filter(r => !inRange(r, tierRange(640)))
      expect(base).toHaveLength(1)
      expect(decl(base[0].body, 'display')).toBe(true)
    })

    it(`${sel} wraps and releases its automatic minimum on the phone tier`, () => {
      const tier = withSelector(sel).filter(r => inRange(r, tierRange(640)))
      expect(tier).toHaveLength(1)
      expect(tier[0].body).toMatch(/flex-wrap\s*:\s*wrap/)
      // Without min-width: 0 the group is still floored at its content and the
      // wrap changes nothing — the v0.5.86 "every nested automatic minimum on
      // the overflow path" rule.
      expect(tier[0].body).toMatch(/min-width\s*:\s*0/)
    })
  }
})

// ── 4. Calendar: day cells ───────────────────────────────────────────────────

describe('a Calendar day cell caps its width to its grid track', () => {
  // The cell carries aspect-ratio: 1/1 AND .sr-touch-target's min-height, and
  // the ratio turns that min-height into WIDTH (44x44 at 100%, 88x88 at 200%,
  // in a 32.56px track). `min-width: 0` is NOT the fix and was already present
  // on the element — a wrong diagnosis this build made and corrected against a
  // real render.
  it('declares max-width in the phone tier', () => {
    const tier = withSelector('.sr-cal-day').filter(r => inRange(r, tierRange(640)))
    expect(tier).toHaveLength(1)
    expect(tier[0].body).toMatch(/max-width\s*:\s*100%/)
  })

  it('does not cap the height, which is the tap target that survives', () => {
    const tier = withSelector('.sr-cal-day').filter(r => inRange(r, tierRange(640)))
    // The accepted trade is width-only. A max-height here would shrink the tap
    // target on BOTH axes and break the AA target-size floor the trade relies on.
    expect(decl(tier[0].body, 'max-height')).toBe(false)
    expect(decl(tier[0].body, 'min-height')).toBe(false)
  })

  it('the touch-target min-height it caps against is still declared', () => {
    const tier = withSelector('.sr-touch-target').filter(r => inRange(r, tierRange(640)))
    expect(tier).toHaveLength(1)
    expect(tier[0].body).toMatch(/min-height\s*:\s*2\.75rem/)
  })
})
