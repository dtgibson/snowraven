// Guard for the Help overlay's content column
// (fixes: help-docs-phone-width, then help-overlay-641-leak).
//
// SCOPE CORRECTION (help-overlay-641-leak). This file was written as a phone-tier
// guard, and its tier test asserted that EVERY .sr-help-content rule sits inside
// @media (max-width: 640px) — on the stated ground that "641/768/1024/1440 measured
// clean before the fix". That was true at 100% TEXT SCALE ONLY: those widths were
// never measured at 200%, where the column is `viewport − 288` and the longest
// unbreakable run in the help text is 399.77px, so 641–687px overflowed and
// 641–663px dragged the help body (46.77px over / 23px of drag at 641px). The fix
// adds the WRAP ALLOWANCE above the tier as well, so the tier test is now split:
// the constraint half is still pinned to ≤640 (it would fight flex:1 above it), the
// wrap allowance is required in BOTH bands, and the upper band must stay unbounded
// above. Page scrollWidth cannot see any of this — .sr-help-panel is overflow:hidden
// and read exactly the viewport width in all 40 configurations measured, every
// broken one included — so the real-render proof measures the element against its
// container's content box.
//
// The defect: the ≤640 tier flips `.sr-help-row` to flex-direction:column, which hands
// the row's INLINE alignItems:'flex-start' control of the cross axis — now width — so
// the content column shrink-to-fit to its widest child's min-content (the coordinates
// <pre> is white-space:pre) instead of filling the row. Measured shipped: a 494.28px
// column in a 296px row at 320px, dragging the help body 186px sideways; 372px at 200%
// text scale.
//
// The FIX IS THE RULE — the component only adds a class — and everything that decides
// whether it works is invisible to jsdom: no layout engine, no media queries, no
// cascade against React's inline styles. So this file parses the REAL globals.css,
// the same posture as filterControlSizeCss / breedingCodePinnedCss / milestoneContrast.
// It is a tripwire, NOT the proof: per CLAUDE.md a CSS-only fix is proven against a
// real render, and this one was (Chromium, 320/390/430/640 × 100%/200% text scale,
// column measured against .sr-help-row's content box — see pr-description.md). A
// stylesheet test passes just as happily on an inert rule, which is exactly how
// .sr-wrap-flex shipped inert in v0.5.82.
//
// Every assertion is written as the INVARIANT that must hold, not as a match on
// today's exact declaration: any measured-equivalent form of the constraint stays
// green, and each named wrong implementation goes red. The wrong implementations
// below are not hypothetical — the half-fix in particular was measured, and it leaves
// 92px of drag at 320px/200%.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

// Comments blanked to spaces of EQUAL LENGTH, so offsets still point at the same
// character while no assertion can be satisfied by prose. This rule's own comment
// discusses `width:100%`, `align-self` and `.sr-wrap-anywhere`, so an unmasked search
// would find the commentary rather than the declarations.
const masked = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

interface Rule { selector: string; body: string; offset: number }

function rules(): Rule[] {
  const out: Rule[] = []
  for (const m of masked.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].trim(), body: m[2], offset: m.index! + m[1].search(/\S/) })
  }
  return out
}

/** Offset range of the `@media (max-width: 640px)` phone tier, by brace matching. */
function phoneTierRange(): [number, number] {
  const at = masked.indexOf('@media (max-width: 640px) {\n')
  if (at < 0) throw new Error('the ≤640 phone tier block was not found')
  const open = masked.indexOf('{', at)
  let depth = 0
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{') depth++
    else if (masked[i] === '}' && --depth === 0) return [open, i]
  }
  throw new Error('unbalanced braces in globals.css')
}

/**
 * Rules whose subject IS the help content column — matched exactly, never by
 * substring. `selector.includes('.sr-help-content')` also matches five forms
 * that would leave the defect open while keeping this file green: a
 * prefix-extended rename (`.sr-help-content-typo`), a scope under an ancestor
 * that does not exist (`.sr-nope .sr-help-content`), and three descendant
 * narrowings (`.sr-help-content pre`, `> pre`, ` a`). The `pre` one is the
 * sharpest, because `white-space: pre` makes a wrap allowance a no-op there, so
 * the guard would be green on a rule that fixes nothing. Exact-match form
 * follows mapFabCascade.test.ts. A comma-joined selector list still counts if
 * any of its parts is exactly this element.
 */
const contentRules = () =>
  rules().filter(r =>
    r.selector.split(',').some(part => part.trim() === '.sr-help-content'),
  )

/**
 * The at-rule preludes enclosing an offset, outermost first — e.g.
 * ['@media (max-width: 640px)'] for a rule in the phone tier, [] at top level.
 *
 * This file keeps its own parser rather than moving to lib/cssTopLevelRules.ts,
 * for the reason CLAUDE.md records: that helper answers "what is the body of this
 * top-level selector", skipping at-rule blocks WHOLE, and every question here is
 * an OFFSET/NESTING question it cannot answer — which tier a rule sits in, and
 * whether that tier is bounded above. Same carve-out as filterControlSizeCss and
 * breedingCodePinnedCss.
 */
function enclosingAtRules(offset: number): string[] {
  const stack: string[] = []
  let last = 0
  for (let i = 0; i < masked.length && i < offset; i++) {
    const ch = masked[i]
    if (ch === '{') { stack.push(masked.slice(last, i).trim()); last = i + 1 }
    // A top-level `;` terminates a prelude (globals.css opens with
    // `@import "tailwindcss";`) — the same property cssTopLevelRules.ts carries.
    else if (ch === '}') { stack.pop(); last = i + 1 }
    else if (ch === ';') { last = i + 1 }
  }
  return stack.filter(s => s.startsWith('@'))
}

/** A declaration's value, whitespace-normalised, `!important` kept. */
function decl(r: Rule, prop: string): string | null {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(r.body)
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

/** Either property, either spelling — .sr-wrap-anywhere itself ships both. */
function wrapAllowance(r: Rule): string[] {
  const ow = decl(r, 'overflow-wrap')
  const wb = decl(r, 'word-break')
  return [
    ow && /\b(anywhere|break-word)\b/.test(ow) ? ow : null,
    wb && /\b(break-word|break-all)\b/.test(wb) ? wb : null,
  ].filter((v): v is string => v !== null)
}

/** Any of the measured-equivalent ways to make the column fill the stacked row. */
function crossAxisConstraint(r: Rule): string | null {
  for (const prop of ['align-self', 'width', 'min-width']) {
    const v = decl(r, prop)
    if (!v) continue
    // No trailing \b after `100%`: `%` is a non-word character, so there is no word
    // boundary between it and the following space, and `/\b100%\b/` can never match.
    if (prop === 'align-self' && !/\bstretch\b/.test(v)) continue
    if (prop !== 'align-self' && !/\b100%/.test(v)) continue
    return v
  }
  return null
}

describe('help overlay phone-tier content column (help-docs-phone-width)', () => {
  it('constrains the column at all, in some measured-equivalent form', () => {
    // Rejects the shipped pre-fix state, where the column had no rule and no class:
    // it shrink-to-fits to 494.28px inside a 296px row and the help body scrolls
    // sideways. Deliberately accepts align-self:stretch, width:100% or min-width:100%
    // — all three were measured to reach the same 0px overflow — so a later
    // simplification to one of them stays green while "no constraint" does not.
    const constraints = contentRules().map(crossAxisConstraint).filter(Boolean)
    expect(constraints.length).toBeGreaterThan(0)
  })

  it('carries !important, or the element inline styles outrank it', () => {
    // Rejects a rule that reads correctly and does nothing. The column carries an
    // inline style block (flex/minWidth/padding/maxWidth) at specificity 1,0,0, which
    // beats any class selector, so a future inline width or alignSelf there would
    // silently defeat a plain rule — the exact failure mode that left .sr-input-16
    // inert on ~25 inputs until v0.5.61 and .sr-wrap-flex inert in v0.5.82. The two
    // sibling overrides in this tier (.sr-help-row, .sr-help-toc) carry it for the
    // same reason.
    for (const r of contentRules()) {
      const c = crossAxisConstraint(r)
      if (c) expect(c, `${r.selector} cross-axis constraint`).toMatch(/!important$/)
    }
  })

  it('grants a wrap allowance inside the ≤640 tier, or the fix is only half done', () => {
    // Rejects the constraint-only half-fix, which is NOT hypothetical: it was
    // measured, and it leaves 92px of drag at 320px/200% and 22px at 390px/200%.
    // Three strings have no wrap opportunity at that scale — the links
    // "github.com/dtgibson/snowraven-mini" (399.77px) and "ebird.org/downloadMyData"
    // (326.89px), and the single H1 word "Documentation" (356.42px) — against a
    // 296px column.
    //
    // Scoped to the phone tier by help-overlay-641-leak: the allowance now ships in
    // TWO places (see the band test below), so an unscoped "at least one exists"
    // count would stay green if this tier's copy were deleted.
    const [open, close] = phoneTierRange()
    const inTier = contentRules().filter(r => r.offset > open && r.offset < close)
    expect(inTier.flatMap(wrapAllowance).length).toBeGreaterThan(0)
  })

  it('grants a wrap allowance above the tier too, unbounded above', () => {
    // The help-overlay-641-leak regression guard. Rejects the shipped v0.5.83 state,
    // where BOTH halves sat inside @media (max-width: 640px) so 641px and up got no
    // wrap allowance at all: at 200% text scale the column is `viewport − 288` and
    // the longest unbreakable run is 399.77px ("github.com/dtgibson/snowraven-mini"
    // breaks at its hyphen, leaving "github.com/dtgibson/snowraven-"), so 641–687px
    // overflowed and 641–663px dragged the help body — 46.77px over / 23px of drag
    // at 641px.
    //
    // Also rejects pinning the upper bound (`and (max-width: 687px)`), which reads
    // like a tighter fix and is a trap: 687 is a function of the longest link's
    // rendered width in docs/HELP.md, so a longer future URL would silently escape
    // the band. Accepts a top-level rule as measured-equivalent — that covers 641+
    // as well — so a later consolidation stays green.
    const unbounded = contentRules().filter(r => {
      if (wrapAllowance(r).length === 0) return false
      const at = enclosingAtRules(r.offset)
      return !at.some(a => /max-width/i.test(a))
    })
    expect(
      unbounded.length,
      'a .sr-help-content wrap allowance must apply above 640px with no upper bound',
    ).toBeGreaterThan(0)

    // Both edges, not just the top one. Pinning the upper bound is the trap the
    // comment above describes; leaving the LOWER edge unpinned is its mirror and
    // was the live hole here — rewriting the rule as `min-width: 900px` leaves
    // 641-899 broken at 200% scale with this file green. The band must START at
    // or below 641, the exact complement of the established 640 tier.
    const startsLowEnough = unbounded.some(r => {
      const at = enclosingAtRules(r.offset)
      const mins = at.flatMap(a => [...a.matchAll(/min-width:\s*(\d+)px/gi)].map(m => Number(m[1])))
      // A top-level rule (no min-width at all) covers 641+ by construction.
      return mins.length === 0 || Math.max(...mins) <= 641
    })
    expect(
      startsLowEnough,
      'the wrap allowance must begin at or below 641px, not partway up',
    ).toBe(true)
  })

  it('keeps the CONSTRAINT half ONLY inside the ≤640 tier', () => {
    // Rejects a cross-axis constraint written at top level or in another tier —
    // NOT merely a style preference. align-self:stretch / width:100% exist because
    // the phone tier flips the row to flex-direction:column and hands the parent's
    // inline alignItems:'flex-start' control of WIDTH. Above 640 the row is a real
    // two-column layout, flex-start governs the VERTICAL axis (load-bearing for the
    // sticky TOC), and the column's inline flex:1/minWidth:0 already fills the row
    // — measured `viewport − 288` at every width — so these two would fight it.
    //
    // Narrowed from "every .sr-help-content rule lives inside the tier" by
    // help-overlay-641-leak, which deliberately adds a second rule above the tier.
    // The narrowing is exactly the wrap allowance: the constraint half is still
    // pinned here, and the band test above pins the other side, so neither half can
    // drift into the other's tier unnoticed.
    const [open, close] = phoneTierRange()
    const constrained = contentRules().filter(r => crossAxisConstraint(r) !== null)
    expect(constrained.length).toBeGreaterThan(0)
    for (const r of constrained) {
      expect(r.offset, `${r.selector} cross-axis constraint must live inside @media (max-width: 640px)`)
        .toBeGreaterThan(open)
      expect(r.offset).toBeLessThan(close)
    }
  })
})
