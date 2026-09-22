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
import { readdirSync, readFileSync } from 'node:fs'

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

/** Every .tsx under src, tests excluded — the source scan's corpus. */
function listSourceFiles(dir: URL): URL[] {
  const out: URL[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) out.push(...listSourceFiles(child))
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) out.push(child)
  }
  return out
}

/** Top-level comma-separated arguments of the outermost `max(...)` of a value. */
function maxTerms(value: string): string[] {
  const inner = /^max\((.*)\)\s*(?:!important)?$/s.exec(value.replace(/\s*!important\s*$/, ''))
  if (!inner) throw new Error(`not a max(): ${value}`)
  return splitList(inner[1])
}

function firstMaxTerm(value: string): string {
  return maxTerms(value)[0]
}

/** The fallback of a `var(--name, fallback)` reference. */
function fallbackOf(ref: string): string {
  const m = /^var\(\s*--[-\w]+\s*,(.*)\)$/s.exec(ref)
  if (!m) throw new Error(`no fallback in: ${ref}`)
  return m[1].trim()
}

/**
 * A custom property's value as declared on `:root`.
 *
 * EVERY `:root` block is searched, not the first one found: this stylesheet
 * carries more than one (the component library ships its own token block), and
 * taking the first would read a block that declares none of these and report a
 * correctly declared property as missing. Exactly one declaration is required,
 * so two blocks racing to define the same token is a failure rather than a
 * silent last-one-wins.
 */
function rootValue(name: string): string {
  const pattern = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`)
  const hits = rules()
    // The selector is read from its LAST statement: this file's rule scanner
    // takes everything since the previous closing brace as the prelude, so the
    // stylesheet's very first block carries the `@import` line ahead of it. A
    // plain equality there reports the app's own token block as absent, which is
    // the opposite of what this helper is for.
    .filter(r => splitList(r.selector.split(';').pop()!.trim()).includes(':root'))
    .map(r => pattern.exec(r.body))
    .filter((m): m is RegExpExecArray => m !== null)
  expect(hits, `${name} must be declared exactly once on :root`).toHaveLength(1)
  return hits[0][1].replace(/\s+/g, ' ').trim()
}

/** Substitute every `var(--x)` that :root declares, so a term can be checked. */
function resolveRootVars(value: string): string {
  return value.replace(/var\(\s*(--[-\w]+)\s*\)/g, (_, name: string) => rootValue(name))
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
    //
    // The first term is now named rather than written, so the one number every
    // phone-tier floor in the app derives from is declared once. The INTENT is
    // unchanged and is what this still proves: the hard floor must be provably
    // 16px, so the variable is RESOLVED from its declaration before the term is
    // checked, and a declaration that went missing or moved off the root fails
    // here rather than silently reading as a zero-width term.
    expect(rootValue('--sr-ctl-floor'), 'the floor must be an absolute px value').toBe('16px')
    for (const r of sizingRules()) {
      expect(firstMaxTerm(fontSize(r))).toBe('var(--sr-ctl-floor)')
      expect(resolveRootVars(firstMaxTerm(fontSize(r)))).toBe('16px')
    }
  })

  it('takes its rem term from the CONTROL rather than one hardcoded register', () => {
    // The second defect, and the one that shipped from v0.5.81 until this pass:
    // the rem term was the literal `0.75rem`, which made the rule a REPLACEMENT
    // and not a floor. Above the crossover it returned 0.75rem scaled, so every
    // control with a larger register was overridden in BOTH directions and the
    // command palette's 1rem search rendered 24px against its declared 32px at
    // 200% text scale, for exactly the users who had asked for larger text.
    // Nothing went red, because the guard above checked the floor term and this
    // one did not exist.
    //
    // Rejects a return to any literal rem: the term must be the control's own
    // property. The fallback is pinned separately, because it is what every
    // control that declares nothing relies on.
    for (const r of sizingRules()) {
      const second = maxTerms(fontSize(r))[1]
      expect(second).toMatch(/^var\(--sr-ctl-rem\s*,/)
      expect(fallbackOf(second), 'the default register covers the majority').toBe('0.75rem')
    }
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
    // Eight native controls; the ninth (Species) is the shared SpeciesCombobox
    // (improve: searchable-species-pickers), whose className prop rides onto its
    // <input> element. The tag-level match keeps THIS guard rejecting a dropped
    // prop; MapExplorerInputZoom.test.tsx asserts the RENDERED placement (the
    // class on the input element itself), which a prop the component ignored
    // would fail.
    expect(onControls.length).toBe(8)
    // `[^>]*` cannot be used here: the tag's arrow-function props contain `>`.
    // Match the whole self-closing tag lazily instead; it is bounded to this one
    // element by its own `/>`.
    const comboboxTags = [...src.matchAll(/<SpeciesCombobox\b[\s\S]*?\/>/g)]
    const onCombobox = comboboxTags.filter(m => m[0].includes('className="sr-input-16"'))
    expect(comboboxTags.length).toBe(1)
    expect(onCombobox.length).toBe(1)
  })
})

describe('labels beside a floored control, sized in relation to it', () => {
  // Part three of the same repair, and it needs its own assertions because the
  // collector above deliberately cannot see this rule. `.sr-ctl-label` is a
  // STANDALONE class rather than `.sr-ctl-row .sr-ctl-label`, because a leading
  // `.sr-ctl-row` compound would sweep it into the CONTROL set and redden four
  // assertions about a declaration it does not share. Standalone means invisible
  // to that collector, which means unguarded unless it is guarded here.

  function labelRule(): Rule {
    const hits = rules().filter(r => splitList(r.selector).includes('.sr-ctl-label'))
    expect(hits, '.sr-ctl-label must be declared exactly once').toHaveLength(1)
    return hits[0]
  }

  it('exists, is phone-tier only, and out-ranks the inline size it must beat', () => {
    // The label registers are inline style objects, specificity 1,0,0, exactly
    // like the controls'. Without !important this rule is inert and its failure
    // is invisible: the labels keep rendering, at the old size.
    const r = labelRule()
    const [open, close] = phoneTierRange()
    expect(r.offset, 'desktop is not broken and must stay byte-identical').toBeGreaterThan(open)
    expect(r.offset).toBeLessThan(close)
    expect(fontSize(r)).toMatch(/!important$/)
  })

  it('states the DERIVATION, both terms carrying the same factor', () => {
    // Rejects a label rule written as its own literals (`max(14.67px, 0.6875rem)`
    // and friends). Independently chosen constants happen to agree at the scales
    // someone sampled and drift everywhere else, and nothing detects the loss.
    // Rejects, too, the half-repair that carries the factor on ONE term: that
    // reopens a band where the label is pinned to a floor while its control
    // tracks rem, which is the exact mechanism that produced this defect.
    const terms = maxTerms(fontSize(labelRule()))
    expect(terms).toHaveLength(2)
    for (const term of terms) {
      expect(term).toMatch(/^calc\(/)
      expect(term).toMatch(/var\(--sr-label-ratio\s*,/)
    }
    // The two terms are the CONTROL rule's two terms, each scaled by the factor,
    // so the pair can never be given a floor or a register of its own.
    const control = maxTerms(fontSize(sizingRules()[0]))
    for (let i = 0; i < 2; i++) {
      expect(terms[i].replace(/\s+/g, '')).toContain(control[i].replace(/\s+/g, ''))
    }
    expect(rootValue('--sr-label-optical'), 'the uppercase factor is declared once')
      .toMatch(/^calc\(\s*11\s*\/\s*12\s*\)$/)
  })

  it('COMPUTES the invariant rather than restating it, over the whole scale domain', () => {
    // THE INVARIANT: a label crosses from floor-governed to scale-governed at
    // exactly the text scale its control does. There is never a band where one is
    // pinned while its neighbour tracks rem.
    //
    // Evaluated from the parsed stylesheet, not from numbers typed here: the two
    // formulas are read out of globals.css and run against every shipped pairing
    // across a scale sweep, so a change to either formula moves these results.
    // The scales deliberately run BELOW 1, where the shipped gap was worst and
    // where sampling the four in-app text sizes would have seen nothing: rem also
    // tracks a browser or OS default the user has lowered.
    const floorPx = parseFloat(rootValue('--sr-ctl-floor'))
    const optical = 11 / 12
    const ctlFormula = maxTerms(fontSize(sizingRules()[0]))
    const labelFormula = maxTerms(fontSize(labelRule()))

    /** Evaluate one parsed term for a given control register and label factor. */
    function evaluate(term: string, remPx: number, ratio: number): number {
      const body = term.replace(/^calc\(/, '').replace(/\)$/, '')
      const factor = /var\(--sr-label-ratio/.test(body) ? ratio : 1
      const base = /--sr-ctl-floor/.test(body) ? floorPx : remPx
      return base * factor
    }
    const size = (formula: string[], remPx: number, ratio: number) =>
      Math.max(evaluate(formula[0], remPx, ratio), evaluate(formula[1], remPx, ratio))
    /** True once the SECOND (scale-tracking) term is the one max() returns. */
    const scaleGoverned = (formula: string[], remPx: number, ratio: number) =>
      evaluate(formula[1], remPx, ratio) >= evaluate(formula[0], remPx, ratio)

    // The eight shipped pairings: the control's own register, and whether the
    // label is uppercase (which is the only reason a factor is ever applied).
    const pairings: { name: string; ctlRem: number; upper: boolean }[] = [
      { name: 'Calendar strip', ctlRem: 0.71875, upper: true },
      { name: 'Checklists rows', ctlRem: 0.75, upper: false },
      { name: 'Hotspot mode', ctlRem: 0.75, upper: true },
      { name: 'Hotspot time window', ctlRem: 0.75, upper: false },
      { name: 'Map Explorer selects', ctlRem: 0.8125, upper: true },
      { name: 'Map Explorer dates', ctlRem: 0.75, upper: true },
      { name: 'Weather forecast fields', ctlRem: 0.84375, upper: false },
      { name: 'Named bird range', ctlRem: 0.75, upper: false },
      { name: 'Checklist lookup field', ctlRem: 0.875, upper: false },
    ]
    const scales: number[] = []
    for (let x = 0.5; x <= 3.0001; x += 0.01) scales.push(Math.round(x * 100) / 100)

    for (const p of pairings) {
      const ratio = p.upper ? optical : 1
      const ratios = new Set<string>()
      let ctlCrossover: number | null = null
      let labelCrossover: number | null = null
      for (const scale of scales) {
        const remPx = p.ctlRem * 16 * scale
        const ctl = size(ctlFormula, remPx, 1)
        const label = size(labelFormula, remPx, ratio)
        ratios.add((label / ctl).toFixed(6))
        // Crossover: the first scale at which each formula's rem term is the
        // one max() returns. Read off the PARSED formulas, so a rule that lost
        // the factor on one term moves one of these and not the other.
        if (ctlCrossover === null && scaleGoverned(ctlFormula, remPx, 1)) ctlCrossover = scale
        if (labelCrossover === null && scaleGoverned(labelFormula, remPx, ratio)) labelCrossover = scale
        expect(label, `${p.name}: a label must never exceed its control`).toBeLessThanOrEqual(ctl + 1e-9)
      }
      expect([...ratios], `${p.name}: the label/control ratio must be constant at every scale`).toHaveLength(1)
      expect(labelCrossover, `${p.name}: the pair must cross together`).toBe(ctlCrossover)
      expect([...ratios][0]).toBe(ratio.toFixed(6))
    }
  })

  it('never reaches a label through an ELEMENT selector', () => {
    // Rejects `.sr-ctl-row :is(span, label)`, which is the shape that looks
    // tidier and is wrong: the Breeding Codes filter pill's own label is a span
    // inside a pill inside a control row, so an element rule would size it and
    // SHRINK the pill's text. Four text nodes app-wide are correctly floored by
    // inheritance from a button ancestor and must stay that way. Membership is
    // declared on the element, never inferred from its tag.
    for (const selector of splitList(labelRule().selector)) {
      expect(elementsNamed(rightmost(selector)), `${selector} must name no element type`).toEqual([])
    }
  })
})

describe('the two declarations of one fact cannot drift', () => {
  it('gives every guarded control with a non-default inline size its own --sr-ctl-rem', () => {
    // The drift risk the repair creates: a control's inline fontSize and its
    // --sr-ctl-rem are two statements of the same number. A control that declares
    // the first and not the second is silently back on the REPLACEMENT, rendering
    // below its own declared size at large text scale with nothing going red —
    // which is precisely how the original defect survived for 51 versions.
    //
    // A control whose register IS the rule's own fallback needs no declaration,
    // and that reliance is only sound while the fallback says so, which is
    // asserted above and re-read here rather than assumed.
    const fallback = fallbackOf(maxTerms(fontSize(sizingRules()[0]))[1])
    const root = new URL('..', import.meta.url)
    const files = listSourceFiles(root)
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      // Each opening tag that carries the guard class, bounded to that one tag.
      for (const m of src.matchAll(/<[A-Za-z][^<]*?className="[^"]*\bsr-input-16\b[^"]*"[\s\S]*?\/>/g)) {
        const tag = m[0]
        const declared = /fontSize:\s*'([^']+)'/.exec(tag)?.[1]
        if (!declared || declared === fallback) continue
        const property = /'--sr-ctl-rem'[^:]*\]:\s*'([^']+)'/.exec(tag)?.[1]
        if (property !== declared) {
          offenders.push(`${file.pathname.split('/src/')[1]}: fontSize ${declared}, --sr-ctl-rem ${property ?? 'absent'}`)
        }
      }
    }
    expect(offenders).toEqual([])
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
