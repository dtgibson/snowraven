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
  it('has its own grid with a fifth column for the reference figure', () => {
    // The row carries a fifth child that the distribution rows do not. On
    // desktop it is a trailing column of its own, so every reference aligns
    // down the group.
    const d = decls('.sr-wx-row--sp')
    const cols = d.get('grid-template-columns')
    expect(cols, '.sr-wx-row--sp declares its own tracks').toBeTruthy()
    expect((cols as string).trim().split(/\s+(?![^(]*\))/).length).toBe(5)
    const noGlyph = decls('.sr-wx-row--sp.no-glyph').get('grid-template-columns')
    expect((noGlyph as string).trim().split(/\s+(?![^(]*\))/).length).toBe(4)
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

  it('the reference takes a THIRD line at the phone tier, which is a measurement', () => {
    // With all three figures on the identity line the count column takes about
    // 187 of the 292 available pixels at 200% text, leaving the label roughly
    // 49px, which wraps "Scattered clouds" into four-character fragments.
    const tier = phoneTier()
    expect(tier).toContain('.sr-wx-row--sp > .sr-wx-ref')
    // Row 3, spanning the row's full width, in both glyph and no-glyph forms.
    expect(tier).toMatch(/\.sr-wx-row--sp > \.sr-wx-ref\s*\{[^}]*grid-area:\s*3 \/ 1 \/ 4 \/ 4/)
    expect(tier).toMatch(/\.sr-wx-row--sp\.no-glyph > \.sr-wx-ref\s*\{[^}]*grid-area:\s*3 \/ 1 \/ 4 \/ 3/)
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
