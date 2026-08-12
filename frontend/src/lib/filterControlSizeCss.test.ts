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

// ── Exact selector matching ──────────────────────────────────────────────────
//
// Selector SELECTION here is exact, never String.includes, per the CLAUDE.md
// sub-rule and the mapFabCascade / helpContentWidthCss house pattern. The
// substring form this replaces was not merely fragile here: the "reaches buttons,
// selects and inputs" assertion below tested `sel.includes('input')` against the
// joined selector string, which the CLASS NAME `.sr-input-16` satisfies on its
// own — so that third of it could not fail, and narrowing the shipped rule to
// `:is(button, select)` left it green while the `button` mutation went red. That
// is the per-partition non-vacuity defect CLAUDE.md records for mapFabCascade's
// glyph half, live in a second file.
//
// "Exact" means the RIGHTMOST COMPOUND, not string equality with the whole
// selector. `.sr-ctl-row :is(button, select, input)` and
// `.sr-map-sidebar-overlay .sr-field-row > *` are deliberately DESCENDANT
// selectors, and equality with the ancestor asserts the opposite of what they mean.
//
// (That sentence is worded around one word on purpose, and this one is too.
// Tailwind v4 auto source detection scans THIS FILE and treats bare words in
// comments as class candidates, so a comment here can emit a rule into the SHIPPED
// stylesheet. An earlier draft used the obvious filter-utility verb for "turns it
// backwards" and grew the production CSS by 219 bytes; naming that verb again here,
// even to warn about it, reintroduced the rule. See the standing convention in
// CLAUDE.md, and verify with a byte-compare of dist CSS against HEAD.)
//
// These helpers stay LOCAL, and lib/cssTopLevelRules.ts is not an option for any
// question in this file: both subjects are ≤640-tier rules, and that parser skips
// at-rule blocks WHOLE, so neither is even present in its map. The three
// selector-analysis helpers below are a third copy of the ones in
// mapFabCascade.test.ts — hoisting them into a shared module is a deliberate step,
// as the parser extraction was, and is flagged for the roadmap rather than taken
// inside a test-only hardening change.

/** Split a selector list on TOP-LEVEL commas — `:is(button, select, input)` must survive whole. */
function splitList(list: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  parts.push(cur)
  return parts.map(p => p.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/** The compounds of ONE complex selector, in order — combinator-separated, paren-aware. */
function compounds(sel: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (depth === 0 && (/\s/.test(ch) || ch === '>' || ch === '+' || ch === '~')) {
      if (cur) out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

/** The compound that has to match the element itself. */
function rightmost(sel: string): string {
  const c = compounds(sel)
  return c[c.length - 1] ?? sel
}

/** Simple selectors inside one compound, in order (house form, mapFabCascade.test.ts). */
function simpleParts(compound: string): string[] {
  const parts: string[] = []
  let i = 0
  while (i < compound.length) {
    const ch = compound[i]
    if (ch === '[') {
      const end = compound.indexOf(']', i)
      parts.push(compound.slice(i, end + 1)); i = end + 1; continue
    }
    if (ch === '#' || ch === '.' || ch === ':') {
      let j = i + 1
      if (ch === ':' && compound[j] === ':') j++
      while (j < compound.length && /[-\w\\]/.test(compound[j])) j++
      if (compound[j] === '(') {           // functional pseudo: take the whole ()
        let d = 1; j++
        while (j < compound.length && d > 0) { if (compound[j] === '(') d++; else if (compound[j] === ')') d--; j++ }
      }
      parts.push(compound.slice(i, j)); i = j; continue
    }
    let j = i
    while (j < compound.length && /[-\w*|\\]/.test(compound[j])) j++
    if (j === i) { i++; continue }
    parts.push(compound.slice(i, j)); i = j
  }
  return parts
}

/**
 * The ELEMENT (type) selectors a compound names, including inside `:is()` /
 * `:where()` arguments — which is where all three of this rule's live, so a scan
 * that stopped at the compound would see none of them.
 */
function elementsNamed(compound: string): string[] {
  const out: string[] = []
  for (const p of simpleParts(compound)) {
    if (p.startsWith('.') || p.startsWith('#') || p.startsWith('[') || p === '*') continue
    if (p.startsWith(':')) {
      const args = /\((.*)\)$/s.exec(p)?.[1]
      if (args) for (const inner of splitList(args)) out.push(...elementsNamed(inner))
      continue
    }
    out.push(p.toLowerCase())
  }
  return out
}

/**
 * The two subjects this guard is about, and what an exact match means for each.
 *
 *   .sr-input-16 — the class sits ON the control, so the selector must BE it.
 *     Rejects a prefix-extended rename (`.sr-input-16-lg`), a descendant
 *     narrowing (`.sr-input-16 span`, which sizes the wrong element), and a scope
 *     under an ancestor that may not exist (`.sr-nope .sr-input-16`).
 *   .sr-ctl-row — a CONTAINER hook, so the guarded element is a DESCENDANT and
 *     equality would be wrong; the LEADING compound must be exactly the
 *     container. This deliberately still ADMITS the bare `.sr-ctl-row {
 *     font-size }` form: excluding it here would drop the container-hook rule out
 *     of the set entirely and leave the assertion that exists to reject it
 *     passing vacuously on the very bug it names.
 */
type Subject = 'input-16' | 'ctl-row'
interface Guarded { rule: Rule; selector: string; subject: Subject }

/** Every complex selector in the stylesheet that sizes one of the two subjects. */
function guardedSizing(): Guarded[] {
  const out: Guarded[] = []
  for (const rule of rules()) {
    if (!/font-size\s*:/.test(rule.body)) continue
    for (const selector of splitList(rule.selector)) {
      if (selector === '.sr-input-16') out.push({ rule, selector, subject: 'input-16' })
      else if (compounds(selector)[0] === '.sr-ctl-row') out.push({ rule, selector, subject: 'ctl-row' })
    }
  }
  return out
}

/** The rules those selectors live in, deduped. */
function sizingRules(): Rule[] {
  return [...new Set(guardedSizing().map(g => g.rule))]
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
    // Matched exactly, so a prefix-extended rename or a descendant narrowing on
    // either side goes red here rather than being found inside its own longer
    // selector — the substring form could not tell `.sr-input-16` from
    // `.sr-input-16-lg`, nor `.sr-ctl-row` from `.sr-ctl-row-x`.
    const subjects = new Set(guardedSizing().map(g => g.subject))
    expect(subjects.has('input-16'), '.sr-input-16 itself must be sized').toBe(true)
    expect(subjects.has('ctl-row'), '.sr-ctl-row must size its neighbours').toBe(true)
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
    //
    // Split on top-level COMMAS, not on '\n': the shipped selector list is one
    // comma-separated group that happens to be written across two lines, and a
    // newline split would tear `:is(button, select, input)` apart the moment the
    // group were reflowed onto one line.
    const ctlRow = guardedSizing().filter(g => g.subject === 'ctl-row')
    expect(ctlRow.length, 'never vacuous: a .sr-ctl-row sizing rule must exist').toBeGreaterThan(0)
    for (const g of ctlRow) {
      expect(compounds(g.selector).length, `${g.selector}: .sr-ctl-row is a container hook, not a sized element`)
        .toBeGreaterThan(1)
    }
  })

  it('reaches buttons, selects and inputs — the three shapes a filter control takes', () => {
    // Rejects a descendant rule narrowed to `button`, which would miss the county
    // <select> and the date <input>s, or to `input`, which would miss every pill.
    //
    // Read off the rule's ELEMENT LIST — the type selectors named by the subject
    // compound, `:is()` arguments included — never off the joined selector string.
    // The string form was INERT for `input`: `.sr-input-16` contains it as a
    // substring, so the narrowed `:is(button, select)` mutation stayed green while
    // the identical `button` mutation went red. A class name can no longer stand in
    // for the element it is named after.
    const named = new Set(guardedSizing().flatMap(g => elementsNamed(rightmost(g.selector))))
    for (const tag of ['button', 'select', 'input']) {
      expect([...named], `the sizing rule must reach <${tag}>`).toContain(tag)
    }
  })
})

describe('the Map Explorer Date Range pair adapts to the guard (fix: map-explorer-input-zoom)', () => {
  /**
   * Rules that set a flex-direction on a .sr-field-row.
   *
   * The row ITSELF is the subject, so the match is on the rightmost compound:
   * `.sr-field-row` and `.sr-map-sidebar-overlay .sr-field-row` both qualify (the
   * scope test below is what tells them apart), while `.sr-field-row > *` does
   * not — that rule's subject is the children, and it is picked up separately.
   */
  function stackingRules(): Rule[] {
    return rules().filter(r =>
      /flex-direction\s*:/.test(r.body) &&
      splitList(r.selector).some(sel => rightmost(sel) === '.sr-field-row'),
    )
  }

  /** Is this rule's .sr-field-row scoped under the map sidebar, exactly? */
  function scopedToSidebar(r: Rule): boolean {
    return splitList(r.selector).some(sel =>
      rightmost(sel) === '.sr-field-row' &&
      compounds(sel).slice(0, -1).includes('.sr-map-sidebar-overlay'),
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
      // Exact ancestor compound: `.sr-map-sidebar-overlay-x .sr-field-row` is a
      // scope that does not exist, and would leave the pair unstacked while
      // reading here as correctly scoped.
      const scoped = scopedToSidebar(r)
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
    //
    // Both ancestors matched as EXACT compounds, and the subject is whatever the
    // row contains — so this is the rule sizing the FIELDS, not one sizing the row
    // (`.sr-map-sidebar-overlay .sr-field-row { width: 100% }` would satisfy the
    // old substring pair while leaving the stacked children at their auto width).
    const widthRule = rules().find(r =>
      /width\s*:/.test(r.body) &&
      splitList(r.selector).some(sel => {
        const ancestors = compounds(sel).slice(0, -1)
        return ancestors.includes('.sr-map-sidebar-overlay') && ancestors.includes('.sr-field-row')
      }),
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
      // Token membership, not whole-attribute equality: a surface may carry a
      // second, feature-local hook beside this shared one (Breeding Codes does).
      // Whitespace boundaries keep `.sr-ctl-row-x` from satisfying the guard.
      const classValues = [...src.matchAll(/className="([^"]*)"/g)].map(m => m[1])
      expect(classValues.some(value => value.split(/\s+/).includes('sr-ctl-row'))).toBe(true)
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
