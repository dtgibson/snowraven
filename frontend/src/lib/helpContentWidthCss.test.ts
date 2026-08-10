// Guard for the Help overlay's phone-tier content column (fix: help-docs-phone-width).
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

const contentRules = () => rules().filter(r => r.selector.includes('.sr-help-content'))

/** A declaration's value, whitespace-normalised, `!important` kept. */
function decl(r: Rule, prop: string): string | null {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(r.body)
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
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

  it('grants a wrap allowance, without which the fix is only half done', () => {
    // Rejects the constraint-only half-fix, which is NOT hypothetical: it was
    // measured, and it leaves 92px of drag at 320px/200% and 22px at 390px/200%.
    // Three strings have no wrap opportunity at that scale — the links
    // "github.com/dtgibson/snowraven-mini" (399.77px) and "ebird.org/downloadMyData"
    // (326.89px), and the single H1 word "Documentation" (356.42px) — against a
    // 296px column. Accepts either property, and either spelling of each, since
    // .sr-wrap-anywhere itself ships both.
    const allowances = contentRules().flatMap(r => {
      const ow = decl(r, 'overflow-wrap')
      const wb = decl(r, 'word-break')
      return [
        ow && /\b(anywhere|break-word)\b/.test(ow) ? ow : null,
        wb && /\b(break-word|break-all)\b/.test(wb) ? wb : null,
      ].filter(Boolean)
    })
    expect(allowances.length).toBeGreaterThan(0)
  })

  it('lives ONLY inside the ≤640 tier, leaving 641px and up byte-identical', () => {
    // Rejects a rule written at top level (or in another tier). Above 640 the row is
    // a real two-column layout and align-items:flex-start is load-bearing for the
    // sticky TOC; 641/768/1024/1440 measured clean before the fix and must stay so.
    // This is also why the wrap allowance is spelled out here rather than added as
    // the unconditional .sr-wrap-anywhere class in the markup — that helper cannot
    // be scoped to a tier.
    const [open, close] = phoneTierRange()
    expect(contentRules().length).toBeGreaterThan(0)
    for (const r of contentRules()) {
      expect(r.offset, `${r.selector} must live inside @media (max-width: 640px)`)
        .toBeGreaterThan(open)
      expect(r.offset).toBeLessThan(close)
    }
  })
})
