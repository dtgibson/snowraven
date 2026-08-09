// Guard for the ONE phone-tier filter-control text size (fix:
// mobile-filter-text-size). The fix is entirely CSS — the components only add a
// class — so the rule IS the fix, and every property that matters here is
// invisible to a jsdom component test: no layout engine, no media queries, no
// computed font-size, no cascade against React's inline styles. This parses the
// REAL globals.css, the same posture as milestoneContrast / calendarContrast /
// countyContrast / breedingCodePinnedCss / helpToc.
//
// Every assertion below is written against a SPECIFIC wrong implementation, named
// in its comment, and each was verified to fail by mutating the source rather than
// by reading it. The wrong implementations are not hypothetical: the flat `16px`
// this replaces is what shipped, and a rule that looks right but cannot beat an
// inline fontSize is exactly how .sr-input-16 sat inert on ~25 inputs until
// v0.5.61.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Vitest stubs `.css` imports (`?raw` included), so read the file directly. Node
// types are pulled in for this one file by the reference above, matching how
// tsconfig.node scopes them to tooling.
const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

// Comments blanked to spaces of EQUAL LENGTH, so every offset below still points
// at the same character in the real file while no assertion can be satisfied by
// prose. This file's comments discuss the values it deliberately does not use
// (`16px`, `0.75rem`), so searching the raw text would find the wrong thing.
const masked = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

interface Rule { selector: string; body: string; offset: number }

/** Every declaration block in the stylesheet, at-rule preludes skipped. */
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

/** Rules that set a font-size on the guarded controls or on .sr-ctl-row. */
function sizingRules(): Rule[] {
  return rules().filter(r =>
    (r.selector.includes('.sr-input-16') || r.selector.includes('.sr-ctl-row')) &&
    /font-size\s*:/.test(r.body),
  )
}

/** The font-size value a rule declares, whitespace-normalised, `!important` kept. */
function fontSize(r: Rule): string {
  return /font-size\s*:\s*([^;]+);/.exec(r.body)![1].replace(/\s+/g, ' ').trim()
}

describe('phone-tier filter-control size: one formula for both sides', () => {
  it('sizes the guarded controls AND the .sr-ctl-row neighbours', () => {
    // Rejects a stylesheet that only sizes one side — including the shipped
    // pre-fix state, which had `.sr-input-16 { font-size: 16px !important; }` and
    // no neighbour rule at all. That is the reported bug: 16px selects against
    // 12px pills in the same wrapping row.
    const selectors = sizingRules().map(r => r.selector).join(' ')
    expect(selectors).toContain('.sr-input-16')
    expect(selectors).toContain('.sr-ctl-row')
  })

  it('gives both sides the IDENTICAL value, so they cannot drift apart', () => {
    // Rejects the likeliest wrong fix, and the one the brief's own wording invites:
    // "raise the neighbours" taken literally — add `.sr-ctl-row :is(...) {
    // max(16px, 0.75rem) }` and leave `.sr-input-16` on its flat `16px`. At 1x both
    // sides read 16px, so a phone screenshot at default text size looks fixed; at
    // 200% the neighbours reach 24px and the form controls are still pinned at
    // 16px, which is the inverted half of this same bug, still shipped. Two rules
    // holding two literals can drift; one distinct value cannot.
    const values = new Set(sizingRules().map(fontSize))
    expect([...values]).toHaveLength(1)
  })

  it('keeps a hard 16px floor so iOS focus zoom stays fixed', () => {
    // Rejects option (b), shrinking the form controls to match the pills
    // (`0.75rem`, 12px at 1x) — the obvious fix, and the one that silently
    // reintroduces the exact iOS focus zoom .sr-input-16 was added for in
    // v0.5.55/v0.5.61. A `max()` whose first term is 16px can never compute below
    // it; `min()` or a bare rem can.
    for (const r of sizingRules()) expect(fontSize(r)).toMatch(/^max\(\s*16px\s*,/)
  })

  it('tracks --sr-text-scale above the floor rather than pinning flat', () => {
    // Rejects the pre-fix flat `16px`, on either side of the pair. A pinned 16px
    // leaves its side frozen while 0.75rem neighbours reach 24px at 200% text
    // scale — the inversion, where the FORM CONTROLS become the small ones for the
    // user who asked for bigger text.
    for (const r of sizingRules()) expect(fontSize(r)).toMatch(/[0-9.]rem\b/)
  })

  it('carries !important, or it is inert against React inline styles', () => {
    // Rejects a rule that reads correctly and does nothing. Every control it must
    // reach sets an inline fontSize (specificity 1,0,0), which outranks any class
    // selector — the precise reason .sr-input-16 was silently inert on ~25 inputs
    // until v0.5.61. This is a fix whose failure mode is invisible.
    for (const r of sizingRules()) expect(fontSize(r)).toMatch(/!important$/)
  })

  it('scopes the size to the ≤640 tier, leaving desktop byte-identical', () => {
    // Rejects a rule written outside the phone tier. Desktop is not broken — both
    // sides are already 12px there — so a global rule would enlarge every filter
    // control on every desktop, a change nobody asked for and the brief explicitly
    // excludes ("No desktop rendering changes").
    const [open, close] = phoneTierRange()
    for (const r of sizingRules()) {
      expect(r.offset, `${r.selector} must live inside @media (max-width: 640px)`).toBeGreaterThan(open)
      expect(r.offset).toBeLessThan(close)
    }
  })

  it('sizes interactive DESCENDANTS of .sr-ctl-row, never the container itself', () => {
    // Rejects `.sr-ctl-row { font-size: ... }`. A container that takes the size
    // cascades it onto every descendant with no size of its own — including the
    // uppercase section labels these rows are built around, which are deliberately
    // smaller, and every unstyled span in five components' filter blocks. The
    // container is a hook, not a text element.
    for (const r of sizingRules()) {
      for (const sel of r.selector.split('\n').map(s => s.trim().replace(/,$/, ''))) {
        if (!sel.includes('.sr-ctl-row')) continue
        expect(sel, '.sr-ctl-row must be a container hook, not a sized element')
          .toMatch(/\.sr-ctl-row\s+\S/)
      }
    }
  })

  it('reaches buttons, selects and inputs — the three shapes a filter control takes', () => {
    // Rejects a descendant rule narrowed to `button`, which would miss the county
    // <select> and the date <input>s, or to `input`, which would miss every pill.
    const sel = sizingRules().map(r => r.selector).join(' ')
    for (const tag of ['button', 'select', 'input']) expect(sel).toContain(tag)
  })
})

describe('the Map Explorer Date Range pair adapts to the guard (fix: map-explorer-input-zoom)', () => {
  /** Rules that set a flex-direction on a .sr-field-row. */
  function stackingRules(): Rule[] {
    return rules().filter(r =>
      r.selector.includes('.sr-field-row') && /flex-direction\s*:/.test(r.body),
    )
  }

  it('stacks the sidebar field row inside the ≤640 tier', () => {
    // Rejects deleting the rule, and rejects writing it outside the phone tier.
    // It exists only because .sr-input-16 raises these two native date inputs to
    // 16px in this tier: MEASURED in a browser against the built CSS, at 12px
    // "08/09/2026" fits the 120.5px each gets side by side in the 282px sidebar,
    // and at 16px it renders "08/09/202" with the year's last digit cut off.
    // Stacking gives each field the full 250px. Above 640 the guard does not
    // apply, so neither must this.
    const [open, close] = phoneTierRange()
    const inTier = stackingRules().filter(r => r.offset > open && r.offset < close)
    expect(inTier.length, 'the sidebar field row must stack inside @media (max-width: 640px)').toBe(1)
    expect(inTier[0].body).toMatch(/flex-direction:\s*column/)
  })

  it('scopes the stacking to the map sidebar rather than moving the global tier', () => {
    // Rejects the over-reaching fix: changing the general `@media (max-width:
    // 480px)` .sr-field-row block to 640. That would restack the pair on five
    // other surfaces (LifeList, BreedingCodeList, Checklists, SpeciesDetail,
    // App) which sit in the full-width main panel, get 220px+ per field in this
    // band, and have no problem at any size. The Map Explorer's row is the only
    // .sr-field-row inside a fixed 282px overlay, and its fix belongs in its own
    // subtree.
    const [open, close] = phoneTierRange()
    for (const r of stackingRules()) {
      const scoped = r.selector.includes('.sr-map-sidebar-overlay')
      if (r.offset > open && r.offset < close) {
        expect(scoped, `${r.selector} in the ≤640 tier must be scoped to the map sidebar`).toBe(true)
      } else {
        // The general stacking rule stays where it was, at ≤480.
        expect(scoped, `${r.selector} outside the ≤640 tier must stay unscoped`).toBe(false)
      }
    }
  })

  it('gives the stacked fields the full row width', () => {
    // Rejects flipping the axis without releasing the width. The children carry
    // an inline `flex: 1; min-width: 0`, which in a column container distributes
    // height, not width, so without this they would keep their auto width and
    // the stack would buy nothing.
    const widthRule = rules().find(r =>
      r.selector.includes('.sr-map-sidebar-overlay') &&
      r.selector.includes('.sr-field-row') &&
      /width\s*:/.test(r.body),
    )
    expect(widthRule, 'the stacked fields need width: 100%').toBeTruthy()
    expect(widthRule!.body).toMatch(/width:\s*100%/)
  })

  it('keeps the nine Map Explorer controls carrying the guard itself', () => {
    // Rejects "fixing" the clipped date by dropping .sr-input-16 from the pair
    // instead of stacking them. That would make the row fit and silently restore
    // the iOS focus zoom on both date fields, which is the whole bug. The count
    // is nine: place-name search, latitude, longitude, species, both dates,
    // county, media, target-species search.
    const src = readFileSync(new URL('../components/MapExplorer.tsx', import.meta.url), 'utf8')
    // `[^>]*` cannot cross a `>`, so this only matches a class inside the SAME
    // opening tag as the control -- a class on a wrapper is not counted.
    const onControls = [...src.matchAll(/<(?:input|select)\b[^>]*className="sr-input-16"/g)]
    expect(onControls.length).toBe(9)
  })
})

describe('the premise the formula rests on', () => {
  it('keeps the root font-size multiplied by --sr-text-scale', () => {
    // The rem half of max(16px, 0.75rem) only tracks in-app text scale because the
    // root does. Rejects a future change to a flat root px size, which would leave
    // this rule computing a constant 16px forever — the fix would stop working at
    // 200% with nothing else failing.
    const html = rules().find(r => r.selector === 'html')!
    expect(html.body).toMatch(/font-size:\s*calc\(100%\s*\*\s*var\(--sr-text-scale/)
  })
})

describe('the class is actually applied where the bug was reported', () => {
  // Rejects a stylesheet-only change: a perfect rule that nothing carries fixes
  // nothing. These are the five surfaces named in the bug brief; LifeList serves
  // both Life List and Multimedia, the tab in the user's screenshot.
  const surfaces = [
    'components/LifeList.tsx',
    'components/Checklists.tsx',
    'components/BreedingCodeList.tsx',
    'components/SpeciesDetail.tsx',
    'components/Calendar.tsx',
  ]
  for (const file of surfaces) {
    it(`${file} wraps its filter controls in .sr-ctl-row`, () => {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      expect(src).toMatch(/className="sr-ctl-row"/)
    })
  }

  it('declares the Calendar strip switch font-size on the button, not its label span', () => {
    // Rejects putting the size back on the nested <span>, which is where it was.
    // A font-size on a descendant WINS over any class on an ancestor, so the
    // container rule cannot reach it and the strip's two switch labels stay small
    // beside everything else in the same strip. This one is invisible in review:
    // both forms render identically on desktop and differ only under .sr-ctl-row.
    const src = readFileSync(new URL('../components/Calendar.tsx', import.meta.url), 'utf8')
    expect(src).not.toMatch(/<span style=\{\{ fontSize: small \?/)
    expect(src).toMatch(/fontSize: small \? '0\.71875rem' : '0\.75rem',/)
  })
})
