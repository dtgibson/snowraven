// The per-species row's TWO stacked triggers, held to ONE declaration list
// (species-detail-weather, FR-34, FR-35, FR-27).
//
// WHY THIS FILE EXISTS. The distribution rows keep their viewport trigger and
// the per-species rows gain a container trigger, so two blocks now hold the same
// stacked shape. Two blocks whose declarations agree today are two blocks that
// will disagree later, on a row FR-26 exists to keep single -- and the repo
// already has the pattern and the reason: `.sr-input-16` and
// `.sr-ctl-row :is(button, select, input)` deliberately differ, share one
// declaration, and are locked identical by `filterControlSizeCss.test.ts`
// parsing the real stylesheet. This is that, for a whole block rather than one
// property, and it exists because the two triggers CANNOT be written as one rule
// (they live under different at-rules).
//
// WHAT IT CANNOT SEE, said plainly in its own header the way the repo asks: this
// guard is DECLARATION-ONLY. It reads the stylesheet, so it can prove the two
// blocks agree, that the container is scoped where FR-27 requires, and that the
// wrap allowance carries its break allowance -- and it can prove NONE of the
// geometry. No label overlap, no rail width, no engine. Every geometric claim
// this feature makes is measured in Chromium and WebKit against a real build by
// `website/tools/verify/verify-weather-species-rows.mjs`, which was run against
// a build with these two repairs reverted and reported 48.88px of painted
// overlap and rails at 0.00px, so it is known to be able to reject a revert.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Vitest stubs `.css` imports (`?raw` included), so read the file directly.
const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

// Comments blanked to spaces of EQUAL LENGTH, so every offset still points at
// the same character in the real file while no assertion can be satisfied by
// prose. Both blocks below are heavily commented and those comments name the
// very tokens this file asserts on.
const masked = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

/** Offset range of a block, found by its prelude and closed by brace matching. */
function blockRange(prelude: string): [number, number] {
  const at = masked.indexOf(prelude)
  expect(at, `globals.css should carry \`${prelude.trim()}\``).toBeGreaterThan(-1)
  const open = masked.indexOf('{', at)
  let depth = 0
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{') depth++
    else if (masked[i] === '}' && --depth === 0) return [open + 1, i]
  }
  throw new Error(`unbalanced braces after ${prelude}`)
}

/** Declarations of one rule body, normalised and keyed by property. */
function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = Object.create(null)
  for (const decl of body.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const prop = decl.slice(0, i).trim()
    if (!prop) continue
    out[prop] = decl.slice(i + 1).replace(/\s+/g, ' ').trim()
  }
  return out
}

/** Every rule inside a block, as `selector -> declarations`, selector
 *  whitespace-normalised so a reflow cannot make two identical rules differ. */
function rulesIn([from, to]: [number, number]): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>()
  const slice = masked.slice(from, to)
  for (const m of slice.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.set(m[1].trim().replace(/\s+/g, ' '), declarations(m[2]))
  }
  return out
}

const PHONE_TIER = '@media (max-width: 640px) {\n'
const CONTAINER_TIER = '@container sr-wx-col '

/** The rules a stacked ROW needs. Everything else in the phone tier -- the band
 *  lanes, the axis toggle, the header padding -- is the Statistics section's own
 *  and is deliberately NOT shared. */
const isRowRule = (sel: string) => /^\.sr-wx-rows?\b|^\.sr-wx-row[.>\s-]/.test(sel)

function rowRules(range: [number, number]): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>()
  for (const [sel, decls] of rulesIn(range)) if (isRowRule(sel)) out.set(sel, decls)
  return out
}

const phoneRows = rowRules(blockRange(PHONE_TIER))
const containerRows = rowRules(blockRange(CONTAINER_TIER))

describe('the stacked row tier is single-sourced across its two triggers', () => {
  it('both blocks exist and actually carry the stacked shape', () => {
    // Non-vacuity first: every equality below is satisfied by two empty maps,
    // which is the state a deleted block leaves behind and the one a naive
    // "they match" guard rewards.
    expect(phoneRows.size, 'the ≤640 tier must carry the row rules').toBeGreaterThan(8)
    expect(containerRows.size, 'the container tier must carry the row rules').toBeGreaterThan(8)
    // And they are the SHAPE, not just any rules: three tracks instead of four,
    // which is what "stacked" means here.
    for (const [name, rules] of [['phone', phoneRows], ['container', containerRows]] as const) {
      expect(rules.get('.sr-wx-row')?.['grid-template-columns'], name)
        .toBe('auto minmax(0, 1fr) auto')
      expect(rules.get('.sr-wx-row.no-glyph')?.['grid-template-columns'], name)
        .toBe('minmax(0, 1fr) auto')
    }
  })

  it('the two blocks hold the IDENTICAL selectors', () => {
    // Rejects the likeliest drift: a rule added to one tier and forgotten in the
    // other, which renders correctly at whichever widths that tier happens to
    // govern and wrongly everywhere else.
    expect([...containerRows.keys()].sort()).toEqual([...phoneRows.keys()].sort())
  })

  it('and the IDENTICAL declarations, property for property', () => {
    // Rejects the subtler drift: the same selector in both, one value changed in
    // one. `toEqual` over the parsed declaration maps rather than a string
    // compare, so a reflow, a reordered pair or a whitespace change is not a
    // failure and a changed VALUE is.
    for (const [sel, decls] of phoneRows) {
      expect(containerRows.get(sel), `${sel} is missing from the container tier`).toBeTruthy()
      expect(containerRows.get(sel), sel).toEqual(decls)
    }
  })

  it('carries the wrap allowance AND the break allowance together (FR-34)', () => {
    // Repair 1. `white-space: normal` alone is a wrap allowance with no break
    // allowance: it only breaks at spaces, so a multi-word label wraps cleanly
    // while "Thunderstorm" and "Overcast" cannot break at all and, with no
    // clipping ancestor anywhere, paint straight through the count cell. The two
    // belong in the same declaration block or the first is a trap.
    //
    // `anywhere`, never `break-word`: only `anywhere` lowers the item's
    // intrinsic contribution. They render identically here, which is exactly why
    // the wrong one is easy to write and impossible to see.
    for (const [name, rules] of [['phone', phoneRows], ['container', containerRows]] as const) {
      const label = rules.get('.sr-wx-row > .sr-wx-label')
      expect(label, `${name}: the label rule must exist`).toBeTruthy()
      expect(label!['white-space'], name).toBe('normal')
      expect(label!['overflow-wrap'], name).toBe('anywhere')
    }
  })

  it('keeps the trailing reference figure on its own row in both tiers', () => {
    // The v1.0.22 structural fix, which is what removed the DATA-dependent half
    // of the row's width and is the reason a container query is not a guess in
    // better-dressed units here. Losing it in either tier puts the guess back.
    for (const [name, rules] of [['phone', phoneRows], ['container', containerRows]] as const) {
      expect(rules.get('.sr-wx-row--sp > .sr-wx-ref')?.['grid-row'], name).toBe('3 / 4')
    }
  })

  it('adds no positive min-width, in either tier (NFR-08)', () => {
    // The section's own standing rule, and what keeps it from leaking horizontal
    // page scroll at 320px and 200%. The one sanctioned `min-width: 3px` sits on
    // the bar FILL inside an `overflow: hidden` track, which is neither of these
    // blocks.
    for (const [name, rules] of [['phone', phoneRows], ['container', containerRows]] as const) {
      for (const [sel, decls] of rules) {
        const mw = decls['min-width']
        if (mw === undefined) continue
        expect(mw, `${name} ${sel}`).toMatch(/^0(px|%)?$/)
      }
    }
  })
})

describe('the container is scoped to the per-species groups only (FR-27)', () => {
  const containerRule = (() => {
    for (const m of masked.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decls = declarations(m[2])
      if (decls['container-name'] === 'sr-wx-col') return { selector: m[1].trim(), decls }
    }
    return null
  })()

  it('is declared on `.sr-wx-pair`\'s own children, never on `.sr-wx-rows`', () => {
    // THE SCOPE IS THE REQUIREMENT, not tidiness. `.sr-wx-rows` appears in three
    // places in `WeatherStatsSection.tsx`: the distribution groups, which serve
    // all four whole-export axes, and the two per-species columns. Putting the
    // container on that class wholesale would re-trigger the DISTRIBUTION rows,
    // which do not have THE RAIL defect this repair is about -- they run at full
    // card width and their rails measure healthily at 200% -- and would visibly
    // change the shipped Statistics distribution rows between roughly 480 and
    // 640px. Only the per-species pair uses `.sr-wx-pair`, on both surfaces, so
    // its children are exactly the columns in question.
    //
    // NAME THE DEFECT, NOT JUST THE ROWS. An earlier revision of this comment
    // said "this defect" with no noun, which is true of the rail and false of the
    // label: the distribution rows DID have repair 1's label-over-count defect,
    // and repair 1 fixes it for them, because `overflow-wrap: anywhere` sits in
    // the shared viewport tier rather than in the container block asserted here.
    // Measured after the fact, so the ambiguity is removed rather than left to be
    // re-derived: scoped as asserted below, the distribution rows show zero
    // change anywhere between 470 and 660px at any text scale.
    expect(containerRule, 'a `container-name: sr-wx-col` rule must exist').toBeTruthy()
    expect(containerRule!.selector).toBe('.sr-wx-pair > *:not(.sr-only)')
    expect(containerRule!.decls['container-type']).toBe('inline-size')
  })

  it('names the container, so the query cannot bind to an unrelated ancestor', () => {
    // An unnamed `container-type` would let `@container (max-width: …)` match the
    // nearest size container in the tree, which is a different element the day
    // anything above these columns becomes one.
    const [from, to] = blockRange(CONTAINER_TIER)
    expect(masked.slice(Math.max(0, from - 120), from)).toContain('sr-wx-col')
    expect(to).toBeGreaterThan(from)
  })

  it('is excluded from `.sr-only`, per the standing rule for `> *` selectors', () => {
    expect(containerRule!.selector).toContain(':not(.sr-only)')
  })
})

describe('the container query threshold carries both of its terms (FR-35)', () => {
  /** The at-rule's condition, read out of the unmasked source. */
  const condition = (() => {
    const at = css.indexOf('@container sr-wx-col ')
    expect(at, 'the container tier must exist').toBeGreaterThan(-1)
    return css.slice(at, css.indexOf('{', at)).trim()
  })()

  it('tracks the text scale with an `em` term', () => {
    // The whole point of keying on the container: `em` inside a container query
    // resolves against the container's OWN font size, so the same 398px column
    // reads 24.9em at 100% and 12.4em at 200% -- exactly the quantity in
    // question, and the reason this is not the v1.0.22 rule being contradicted.
    // A threshold written only in px would be the guess that rule rejects.
    expect(condition).toMatch(/\(max-width:\s*[\d.]+em\)/)
  })

  it('carries an absolute px floor as well, because 120px does not scale', () => {
    // Measured, not added for safety: in the inline shape the row's chrome is
    // 254px at 100% text scale, so the `em` term alone (22em = 352px) would
    // leave a 98px rail -- under FR-35's floor. Same shape as `.sr-input-16`'s
    // `max(16px, 0.75rem)`: a scale-tracking term and an absolute floor, with
    // the guarantee stated over the whole domain rather than at three sampled
    // scales.
    expect(condition).toMatch(/\(max-width:\s*\d+px\)/)
    expect(condition).toContain(' or ')
  })

  it('is a MAX-width query, so the stacked shape is the narrow one', () => {
    // Rejects an inverted condition, which would stack every wide column and
    // leave every narrow one inline -- the defect, upside down, and visually
    // plausible enough on a desktop screenshot to ship.
    expect(condition).not.toMatch(/min-width/)
  })
})
