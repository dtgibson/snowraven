/// <reference types="node" />
//
// weather-stats: the two stylesheet invariants the species picker's readability
// rests on.
//
// THE DEFECT THIS HOLDS CLOSED. The picker shares a row model with the shipped
// `SpeciesCombobox`: a listbox option is `check | common name | scientific
// name`, the scientific name capped at 40% of the row. That cap must NOT be
// widened from here -- five surfaces render the component, and the cap exists
// because without it the scientific name crushed the common name to a measured
// 0px in the Map Explorer panel at 200% text scale. So the only lever this
// section has is the WIDTH IT HANDS THE LISTBOX.
//
// Two things were starving it, and both are fixed in this section's own code:
// `.sr-wx-pick` split the card into two columns, and `size="sm"` capped the
// combobox at 220px inline (the listbox is `left: 0; right: 0` on that wrapper,
// so the cap was the listbox's width too). Measured on the real component's DOM
// in Chromium AND WebKit with "Northern Rough-winged Swallow" /
// "Stelgidopteryx serripennis" -- the longest pair in the author's own export --
// the common name had a 79.2px box against 210.2px of ink and the scientific
// name 76.8px against 138.0px: both cut at once, which is exactly what the user
// reported seeing.
//
// WHAT THIS FILE CAN AND CANNOT PROVE. It proves the declarations exist, at TOP
// LEVEL rather than stranded in a media tier, on exactly the right selectors,
// with values of the right kind. It does NOT prove the text fits -- a stylesheet
// test passes on an inert class, which is how an inert `.sr-wrap-flex` once
// shipped. The geometry is a browser measurement and it is recorded in the
// commit: stacked, the name box goes to 278.0px at 1x and 535.7px at 200% on a
// 900px window, both clear of the ink, in both engines, with zero page scroll
// and zero painted overflow past the card at any width.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseTopLevelRules } from './cssTopLevelRules'

const CSS = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const TOP = parseTopLevelRules(CSS)

/** Declarations of one top-level rule, as a `prop -> value` map. */
function decls(selector: string): Map<string, string> {
  const body = TOP.get(selector)
  expect(body, `globals.css has a TOP-LEVEL \`${selector}\` rule`).toBeTruthy()
  const out = new Map<string, string>()
  for (const part of (body as string).split(';')) {
    const i = part.indexOf(':')
    if (i === -1) continue
    out.set(part.slice(0, i).trim(), part.slice(i + 1).trim())
  }
  return out
}

/** The established phone tier: this file's FIRST multi-line 640px block, which
 *  is how the repo's offset-question guards resolve it. */
function phoneTier(): string {
  const start = CSS.indexOf('@media (max-width: 640px) {\n  .sr-header')
  expect(start, 'globals.css has its established phone tier').toBeGreaterThan(-1)
  let depth = 0
  let i = CSS.indexOf('{', start)
  for (; i < CSS.length; i++) {
    if (CSS[i] === '{') depth++
    else if (CSS[i] === '}' && --depth === 0) break
  }
  return CSS.slice(start, i)
}

describe('the picker is given the whole card to lay a row out in', () => {
  it('.sr-wx-pick is ONE column, at top level so it holds at every width', () => {
    const d = decls('.sr-wx-pick')
    expect(d.get('display')).toBe('grid')
    // One track. A second track is what starved the listbox, and it cannot be
    // reintroduced without turning this red.
    const cols = d.get('grid-template-columns')
    expect(cols).toBe('minmax(0, 1fr)')
    expect(cols).not.toMatch(/1fr[\s\S]*1fr/)
  })

  it('the one-column shape is not stranded inside the phone tier', () => {
    // `parseTopLevelRules` skips at-rule blocks WHOLE, so the assertion above
    // already proves top level. This states the converse the file must also
    // hold: the tier no longer needs its own copy, and a re-added override
    // would be a second place for the shape to drift.
    const tier = phoneTier()
    expect(tier).toContain('.sr-wx-row')          // non-vacuity: this IS the tier
    expect(tier).not.toContain('.sr-wx-pick {')
  })
})

describe('the per-species row, after the rescale', () => {
  // WHAT THIS `it()` REJECTS, stated because commit ee56497's message got it
  // wrong and an inaccurate claim about a guard outlives the guard.
  //
  // That message said the block was mutation-checked with "an equivalent
  // spelling green". It is not that tolerant: the exact `toBe` below shares an
  // `it()` with the tolerant `toContain` beside it, so THREE genuinely
  // equivalent rewrites also turn it red -- commutative `min()` arguments,
  // `grid-area` split into `grid-row` plus `grid-column`, and a whitespace
  // variant. That fails CLOSED, so nothing can ship wrong through it and the
  // guard is left as it is; what was wrong was the sentence describing it.
  // Anyone rewriting these declarations equivalently should expect to update
  // the literal here, and that is the intended cost of pinning an exact value.
  it('the reference figure ALWAYS takes a line of its own, at every width', () => {
    // It was a trailing fifth column above 640px, and that did not hold: the row
    // then carried two incompressible `nowrap` `auto` tracks inside a half-card
    // column, and real Chromium and real WebKit both measured it up to 126px
    // past that column with page scroll behind it.
    //
    // A SECOND BREAKPOINT WOULD NOT HAVE FIXED IT. The width a row needs is the
    // width of its own text, so the fitting boundary moves with the DATA as well
    // as the text scale -- measured from 30.4rem of column at 100% down to
    // 11.5rem at 200%. This asserts the property that removes the failure mode
    // rather than a threshold that relocates it: the reference is on its own
    // grid row, spanning the full width, at TOP LEVEL.
    const d = decls('.sr-wx-row--sp > .sr-wx-ref')
    expect(d.get('grid-area')).toBe('2 / 1 / 3 / -1')
    expect(d.get('padding-left')).toBe('0')
    expect(d.get('text-align')).toBe('right')
  })

  it('the row declares NO grid of its own, so it is the distribution row plus a line', () => {
    // The inline content is then exactly `.sr-wx-row`'s -- glyph, label, track,
    // count -- which is the shape already measured clean at 320px and 200%. A
    // re-added column list is the defect coming back.
    expect(TOP.has('.sr-wx-row--sp')).toBe(false)
    expect(TOP.has('.sr-wx-row--sp.no-glyph')).toBe(false)
    expect(CSS).not.toContain('.sr-wx-row--sp {')
    expect(CSS).not.toContain('.sr-wx-row--sp.no-glyph')
  })

  it('the reference figure is muted and a step smaller than the count beside it', () => {
    const ref = decls('.sr-wx-ref')
    expect(ref.get('color')).toBe('var(--sr-text-muted)')
    const refSize = parseFloat(ref.get('font-size') as string)
    const countSize = parseFloat(decls('.sr-wx-count').get('font-size') as string)
    // It is the thing being compared AGAINST, not the figure being read.
    expect(refSize).toBeLessThan(countSize)
    // Never animated: it is text, and only the bar grows.
    expect(ref.get('animation')).toBeUndefined()
    expect(ref.get('transition')).toBeUndefined()
  })

  it('the phone tier moves ONLY the row index, so the two tiers cannot drift', () => {
    // The row is already two lines there, so the reference takes the third. The
    // base rule keeps the column span, the padding and the alignment: a tier
    // that restated them would be a second place for them to diverge.
    const tier = phoneTier()
    expect(tier).toMatch(/\.sr-wx-row--sp > \.sr-wx-ref\s*\{\s*grid-row:\s*3 \/ 4;\s*\}/)
    expect(tier).not.toContain('grid-template-columns: auto minmax(0, 1fr) auto;\n  .sr-wx-row--sp')
  })

  it('the bar fill keeps its 3px floor, which the rescale did not retire', () => {
    // A genuinely small non-zero band must not render as the same nothing a
    // zero band renders. Scaling to the species' own maximum makes bars bigger
    // on average and does not remove the case: a bird with 1 in one band and 40
    // in another still paints that 1 at 2.5% of the track.
    expect(decls('.sr-wx-fill').get('min-width')).toBe('3px')
  })

  it('.sr-wx-scale is gone, not merely unused', () => {
    // It existed only to hold the old proportional rail. Under species-max
    // scaling every track is full width again, so a leftover rule would be dead
    // CSS that a later reader has to work out the meaning of.
    expect(CSS).not.toContain('sr-wx-scale')
  })
})

describe('the per-species pair cannot overflow its container at any width', () => {
  it('uses the house self-collapsing idiom, not a bare minimum', () => {
    // A bare `minmax(240px, 1fr)` is a track that cannot shrink below 240px, so
    // a narrower container overflows. Measured, it was safe by accident: 290px
    // of card content at a 320px viewport, 50px of headroom, first overflowing
    // below about 270px -- under the supported floor, but a guarantee that rests
    // on nobody opening a narrow window is weaker than one that cannot fail.
    const cols = decls('.sr-wx-pair').get('grid-template-columns')
    expect(cols).toBe('repeat(auto-fit, minmax(min(240px, 100%), 1fr))')
    // The property, stated so a different-but-equivalent spelling is judged on
    // whether it has it: the track's minimum is capped at the container.
    expect(cols).toContain('100%')
  })
})

describe('the control keeps a sensible width without capping the listbox in rem-blind px', () => {
  it('.sr-wx-pickctl caps in REM, so the cap stops binding when large text needs the room', () => {
    const d = decls('.sr-wx-pickctl')
    const max = d.get('max-width')
    expect(max, '.sr-wx-pickctl carries a max-width').toBeTruthy()
    // REM, not px: at 200% text scale a px cap would still be 480px while the
    // ink it has to hold has nearly doubled. This is the same reasoning as
    // `.sr-input-16`'s `max(16px, rem)`, in the other direction.
    expect(max).toMatch(/^\d+(?:\.\d+)?rem$/)
    const rem = parseFloat(max as string)
    // Wide enough at 1x to clear the longest real pair with headroom, and not so
    // wide that the control sprawls across a desktop card.
    expect(rem).toBeGreaterThanOrEqual(28)
    expect(rem).toBeLessThanOrEqual(36)
    // It must be able to SHRINK below its cap on a phone, or it becomes the
    // page-scroll leak this repo has fixed three times.
    expect(d.get('min-width')).toBe('0')
    expect(max).not.toContain('!important')
  })

  it('nothing in this section reaches into the shared combobox to widen its cap', () => {
    // The 40% scientific-name cap and the `sm` 220px cap are the component's,
    // and five other surfaces depend on them. A rule here targeting the
    // combobox's internals -- especially one carrying `!important` to beat its
    // inline styles -- would fix this card by regressing the surface the cap was
    // written for.
    for (const selector of TOP.keys()) {
      if (!selector.includes('sr-wx-')) continue
      expect(selector, `${selector} must not target the shared combobox`)
        .not.toMatch(/sr-combobox|sr-cb\b/)
    }
    expect(CSS).not.toContain('.sr-wx-pickctl .sr-combobox-list')
    expect(CSS).not.toContain('.sr-wx-pick .sr-combobox-list')
  })
})
