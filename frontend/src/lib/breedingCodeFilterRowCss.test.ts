// Structural guard for the Breeding Codes full-label filter-row overflow fix.
// jsdom cannot compute flex min-content or media queries, so this file parses the
// real stylesheet and pairs it with source assertions for the three dedicated
// hooks. Exact selectors are deliberate: a broad `.sr-ctl-row` repair would alter
// four unrelated surfaces and is the primary regression this guard must reject.
/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const source = readFileSync(new URL('../components/BreedingCodeList.tsx', import.meta.url), 'utf8')
const clean = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

interface Rule { selectors: string[]; body: string; ancestors: string[] }

function splitList(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { out.push(current); current = '' }
    else current += ch
  }
  out.push(current)
  return out.map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/** All style rules, retaining the exact at-rule ancestry for tier assertions. */
function collect(src: string, ancestors: string[] = [], out: Rule[] = []): Rule[] {
  let i = 0
  let start = 0
  while (i < src.length) {
    if (src[i] === ';') { i++; start = i; continue }
    if (src[i] !== '{') { i++; continue }
    let depth = 1
    let end = i + 1
    while (end < src.length && depth) {
      if (src[end] === '{') depth++
      else if (src[end] === '}') depth--
      end++
    }
    const prelude = src.slice(start, i).trim().replace(/\s+/g, ' ')
    const body = src.slice(i + 1, end - 1)
    if (prelude.startsWith('@')) collect(body, [...ancestors, prelude], out)
    else out.push({ selectors: splitList(prelude), body, ancestors })
    i = end
    start = end
  }
  return out
}

const rules = collect(clean)
const phone = '@media (max-width: 640px)'

function unique(selector: string): Rule {
  const hits = rules.filter(r => r.selectors.includes(selector))
  expect(hits, `${selector} must be declared exactly once`).toHaveLength(1)
  expect(hits[0].ancestors, `${selector} must be phone-only`).toEqual([phone])
  return hits[0]
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of body.split(';')) {
    const colon = part.indexOf(':')
    if (colon >= 0) out.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim())
  }
  return out
}

describe('Breeding Codes filter row overflow containment', () => {
  it('releases both flex floors and breaks only the visible full label', () => {
    const row = declarations(unique('.sr-bc-filter-row').body)
    expect(row.get('min-width')).toBe('0')
    expect(row.get('max-width')).toBe('100%')

    const pill = declarations(unique('.sr-bc-filter-row > .sr-bc-filter-pill').body)
    expect(pill.get('height')).toBe('auto !important')
    expect(pill.get('min-height')).toBe('30px')
    expect(pill.get('min-width')).toBe('0')
    expect(pill.get('max-width')).toBe('100%')

    const label = declarations(unique('.sr-bc-filter-row > .sr-bc-filter-pill > .sr-bc-filter-pill-label').body)
    expect(label.get('min-width')).toBe('0')
    expect(label.get('overflow-wrap')).toBe('break-word')
    expect(label.has('overflow')).toBe(false)
    expect(label.has('text-overflow')).toBe(false)
    expect(label.has('white-space')).toBe(false)
  })

  it('never broadens the repair to the shared control-row hook', () => {
    const layoutProperties = /(?:^|;)\s*(?:min-width|max-width|overflow-wrap|word-break|white-space)\s*:/
    const sharedSubjects = rules.flatMap(r => r.selectors.map(selector => ({ r, selector })))
      .filter(({ selector }) => selector === '.sr-ctl-row' || selector.startsWith('.sr-ctl-row '))
      .filter(({ r }) => layoutProperties.test(r.body))
    expect(sharedSubjects).toEqual([])
  })

  it('puts all three hooks on the intended component and keeps every label visible', () => {
    expect(source).toMatch(/className="sr-ctl-row sr-bc-filter-row"/)
    expect(source).toMatch(/className="sr-pill sr-bc-filter-pill"/)
    expect(source).toMatch(/className="sr-bc-filter-pill-label"/)
    expect(source).not.toMatch(/sr-bc-filter-pill[^\n]*(?:overflow:\s*['"]hidden|textOverflow|whiteSpace:\s*['"]nowrap)/)
  })

  it('leaves the filter pill ABLE TO WRAP, which is what makes break-word do anything', () => {
    // The regression this row exists to reject, measured rather than reasoned
    // about: the shared `.sr-pill` register declares `white-space: nowrap`, which
    // is the family's universal shipped value and right for a short filter chip.
    // On THIS row it forbids line breaking outright, and `overflow-wrap:
    // break-word` below cannot act while wrapping is forbidden at all -- so the
    // three longest breeding-code labels rendered 38px on one line, took the row
    // to 334px inside a 272px parent at 320px/200%, and leaked 38px of page
    // horizontal scroll in both engines. Every other declaration in this block
    // was still correct and none of them could help.
    //
    // Asserted as a CASCADE RESULT, not as the presence of one declaration.
    // Every rule that can match this pill is collected in source order and the
    // LAST `white-space` among them is the one that governs; the assertion is
    // that it is not `nowrap`. That is what makes this row survive the repairs
    // that would otherwise slip past it: the override being deleted, the
    // override being written at a specificity the register beats, the register
    // gaining a `nowrap` later in the file, or the hook being renamed out from
    // under it. A presence check on `white-space: normal` would pass through
    // three of those four.
    //
    // It also says why the release is HERE and not on the register's own phone
    // tier: releasing it there would let every pill on every tab wrap mid-row at
    // <=640, which nobody measured, and v0.5.86's rule is that other filter
    // surfaces are outside this repair. So the assertion below is deliberately
    // paired -- the register keeps `nowrap`, and this surface overrides it.
    const registerWhiteSpace = declarations(
      rules.filter(r => r.selectors.includes('.sr-pill') && r.ancestors.length === 0)[0].body,
    ).get('white-space')
    expect(registerWhiteSpace, 'the register keeps the family default').toBe('nowrap')

    // Every rule whose subject can be this element, in source order. The pill
    // carries `sr-pill` and `sr-bc-filter-pill` and sits in a `.sr-bc-filter-row`
    // inside a `.sr-ctl-row`, so a rule qualifies when every class it names is
    // one this element or its ancestors carry.
    const carried = ['sr-pill', 'sr-bc-filter-pill', 'sr-bc-filter-row', 'sr-ctl-row']
    const governing = rules.filter(r => r.selectors.some(sel => {
      const named = [...sel.matchAll(/\.([-\w]+)/g)].map(m => m[1])
      return named.length > 0
        && named.every(c => carried.includes(c))
        && named.includes('sr-bc-filter-pill') === sel.includes('sr-bc-filter-pill')
        && /sr-pill|sr-bc-filter-pill/.test(sel)
    }))
    const declared = governing
      .map(r => ({ value: declarations(r.body).get('white-space'), phone: r.ancestors.includes(phone) }))
      .filter(d => d.value !== undefined)
    expect(declared.length, 'never vacuous: some rule must set white-space').toBeGreaterThan(1)
    // In the phone tier, the last word wins and it must not be `nowrap`.
    expect(declared[declared.length - 1].value).toBe('normal')
    expect(declared[declared.length - 1].phone, 'the release is phone-tier only').toBe(true)

    // And the release must out-rank the register rather than merely follow it,
    // so it still governs if the register ever moves later in the file.
    const release = governing.find(r => declarations(r.body).get('white-space') === 'normal')!
    for (const sel of release.selectors) {
      expect([...sel.matchAll(/\.([-\w]+)/g)].length,
        'the release must be more specific than the single-class register').toBeGreaterThan(1)
    }
  })

  it('takes its height from the shared register as a MINIMUM, not a fixed value', () => {
    // This asserted an inline `height: 30` in the component and the absence of an
    // inline `minHeight: 30`, which pinned the fixed height that the phone-tier
    // `height: auto !important` above had to release. The pill now takes its
    // height from the shared control register, so the same intent is pinned where
    // the declaration lives: desktop keeps a 30px pill, and the phone tier lets a
    // full label earn a second line. The old assertion could also have passed by
    // accident on any unrelated `height: 30` left in the file, which is worse
    // than going red.
    //
    // Two halves, and both are load-bearing. The component must carry the
    // register class, and the register must supply a MINIMUM: a register that
    // moved back to a fixed `height` would restore the very defect the phone-tier
    // override was written for, and would make that override load-bearing again.
    expect(source).toMatch(/className="sr-pill sr-bc-filter-pill"/)
    expect(source).not.toMatch(/height:\s*30/)

    const hits = rules.filter(r => r.selectors.includes('.sr-pill'))
    expect(hits, 'the .sr-pill register must be declared exactly once').toHaveLength(1)
    expect(hits[0].ancestors, 'the register applies at every width, not one tier').toEqual([])
    const pill = declarations(hits[0].body)
    expect(pill.get('min-height')).toBe('30px')
    expect(pill.has('height')).toBe(false)
  })
})
