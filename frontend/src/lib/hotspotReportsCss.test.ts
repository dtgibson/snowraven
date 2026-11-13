// The Hotspot Reports stylesheet, as declarations (hotspot-reports schema 8.1
// and 13.4; QA-69).
//
// WHAT IT CANNOT SEE, said plainly: this guard is DECLARATION-ONLY. It reads
// globals.css, so it can pin the two container names, that each threshold is a
// `max-width` query on its own named container at the MEASURED value, the
// resolved cascade of a protocol label's `white-space` above the phone tier,
// that no rule under this tab redeclares the shared distribution row's tracks or
// areas, that the phone-tier rules sit inside the established 640px block, and
// that every hover look is gated on `(hover: hover)`. It proves none of the
// geometry. The thresholds were measured against the BUILT app in Chromium and
// WebKit under a classic scrollbar (decisions.md D-07; re-measured for the
// reordered report and the At a glance grids, hotspot-report-order-and-stats
// D-08), and the geometric claim is held by
// `website/tools/verify/verify-hotspot-reports.mjs`, which the real-engine
// verification gate (`website/tools/verify/run.mjs`) runs.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseRulesAtAnyDepth, type CssRuleOccurrence } from './cssTopLevelRules'
import { compoundsOf, simpleParts, specificity, splitList } from '../test/cssSpecificity'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const rules = parseRulesAtAnyDepth(css)

/** The two measured thresholds (decisions.md D-07). A change of either number
 *  is a deliberate edit of this row, owed a new measurement. */
const REPORT_COLUMNS_MAX = '53.25em'
const LIST_STACK_MAX = '28em'

function decl(body: string, prop: string): string | null {
  let found: string | null = null
  for (const part of body.split(';')) {
    const at = part.indexOf(':')
    if (at === -1) continue
    if (part.slice(0, at).trim() === prop) found = part.slice(at + 1).trim()
  }
  return found
}

describe('the two size containers and their measured thresholds', () => {
  it('the report and the list are named inline-size containers', () => {
    const report = rules.filter(r => r.atRules.length === 0 && splitList(r.selector).includes('.sr-hsr-report'))
    const list = rules.filter(r => r.atRules.length === 0 && splitList(r.selector).includes('.sr-hsr-ll'))
    expect(report.length).toBe(1)
    expect(list.length).toBe(1)
    expect([decl(report[0].body, 'container-type'), decl(report[0].body, 'container-name')]).toEqual(['inline-size', 'sr-hsr-report'])
    expect([decl(list[0].body, 'container-type'), decl(list[0].body, 'container-name')]).toEqual(['inline-size', 'sr-hsr-ll'])
  })

  it('each threshold is a max-width query on its own named container, at the measured value', () => {
    const preludes = new Set<string>()
    for (const r of rules) for (const a of r.atRules) if (a.startsWith('@container')) preludes.add(a.replace(/\s+/g, ' '))
    const mine = [...preludes].filter(p => p.includes('sr-hsr'))
    expect(mine.sort()).toEqual([
      `@container sr-hsr-ll (max-width: ${LIST_STACK_MAX})`,
      `@container sr-hsr-report (max-width: ${REPORT_COLUMNS_MAX})`,
    ])
  })

  it('one column shows the jump row and collapses the body; the stacked row drops the header row', () => {
    const under = (q: string) => rules.filter(r => r.atRules.some(a => a.replace(/\s+/g, ' ') === q))
    const report = under(`@container sr-hsr-report (max-width: ${REPORT_COLUMNS_MAX})`)
    expect(decl(report.find(r => r.selector === '.sr-hsr-jump')!.body, 'display')).toBe('flex')
    expect(decl(report.find(r => r.selector === '.sr-hsr-body')!.body, 'grid-template-columns')).toBe('minmax(0, 1fr)')
    const base = rules.find(r => r.atRules.length === 0 && r.selector === '.sr-hsr-jump')!
    expect(decl(base.body, 'display')).toBe('none')
    const list = under(`@container sr-hsr-ll (max-width: ${LIST_STACK_MAX})`)
    expect(decl(list.find(r => r.selector === '.sr-hsr-ll-cols')!.body, 'display')).toBe('none')
  })
})

describe('the reading order is the DOM order, and the self-collapsing grids (hotspot-report-order-and-stats)', () => {
  const top = (sel: string) => rules.filter(r => r.atRules.length === 0 && splitList(r.selector).includes(sel))

  it('two columns put the 24rem rail first and the life list second', () => {
    const body = top('.sr-hsr-body')
    expect(body.length).toBe(1)
    expect(decl(body[0].body, 'grid-template-columns')).toBe('minmax(0, 24rem) minmax(0, 1fr)')
  })

  it('no rule on this tab reorders a section: no `order`, and no grid placement on a section-level box', () => {
    // The section-level boxes: the report's own children, the body's, the rail's.
    const SECTION_BOXES = ['.sr-hsr-hero', '.sr-hsr-card', '.sr-hsr-jump', '.sr-hsr-body', '.sr-hsr-rail', '.sr-hsr-report']
    let seen = 0
    for (const r of rules) {
      if (!r.selector.includes('.sr-hsr-')) continue
      seen += 1
      expect(decl(r.body, 'order'), r.selector).toBeNull()
      for (const sel of splitList(r.selector)) {
        const compounds = compoundsOf(sel)
        const subject = simpleParts(compounds[compounds.length - 1])
        if (!subject.some(p => SECTION_BOXES.includes(p))) continue
        for (const prop of ['grid-area', 'grid-row', 'grid-column', 'grid-row-start', 'grid-column-start']) {
          expect(decl(r.body, prop), `${sel} ${prop}`).toBeNull()
        }
      }
    }
    expect(seen).toBeGreaterThan(100)
  })

  it('the tiles and the facts collapse by their own track minima, as measured in the built app (D-08)', () => {
    expect(top('.sr-hsr-tiles').map(r => decl(r.body, 'grid-template-columns'))).toEqual(['repeat(auto-fit, minmax(min(8rem, 100%), 1fr))'])
    expect(top('.sr-hsr-facts').map(r => decl(r.body, 'grid-template-columns'))).toEqual(['repeat(auto-fit, minmax(min(max(19rem, 34%), 100%), 1fr))'])
    // With no tiles the facts stand alone in one column, no rule above the first.
    expect(top('.sr-hsr-glance > .sr-hsr-facts:first-child').map(r => decl(r.body, 'grid-template-columns'))).toEqual(['minmax(0, 1fr)'])
    expect(decl(top('.sr-hsr-glance > .sr-hsr-facts:first-child > .sr-hsr-fact:first-child')[0].body, 'border-top')).toBe('0')
    // The rule rides on each row's top edge, never beneath it.
    expect(decl(top('.sr-hsr-fact')[0].body, 'border-top')).toBe('1px solid var(--sr-border-subtle)')
    expect(decl(top('.sr-hsr-fact')[0].body, 'border-bottom')).toBeNull()
    // Nothing in a tile or a ranked row is held to one line.
    for (const sel of ['.sr-hsr-tile', '.sr-hsr-tile-value', '.sr-hsr-tile-unit', '.sr-hsr-toprow', '.sr-hsr-top-fig', '.sr-hsr-top-main']) {
      for (const r of top(sel)) expect(decl(r.body, 'white-space'), sel).toBeNull()
    }
    // No phone-tier rule for either grid: they collapse by themselves.
    expect(rules.filter(r => r.atRules.length > 0 && /\.sr-hsr-(tiles|facts|tile|fact|toprow|glance)\b/.test(r.selector))).toEqual([])
  })

  /**
   * The winning `prop` on an element whose own classes are `own` and whose
   * ancestors carry only classes in `chain`: every rule that can reach it,
   * conditional ones included as competitors (so a phone-tier or container rule
   * cannot silently win), scored by specificity, then source order.
   */
  function resolvedAt(chain: readonly string[], own: readonly string[], prop: string) {
    const allowed = new Set([...chain, ...own])
    const competing: { spec: [number, number, number]; order: number; value: string; sel: string }[] = []
    rules.forEach((r: CssRuleOccurrence, order) => {
      const value = decl(r.body, prop)
      if (value === null) return
      for (const sel of splitList(r.selector)) {
        const compounds = compoundsOf(sel)
        if (compounds.length === 0) continue
        const subject = simpleParts(compounds[compounds.length - 1])
        if (!subject.some(p => p.startsWith('.') && own.includes(p.slice(1)))) continue
        let ok = true
        for (const c of compounds) for (const p of simpleParts(c)) {
          if ((p.startsWith('.') && !allowed.has(p.slice(1))) || p.startsWith(':') || p.startsWith('[')) ok = false
        }
        if (subject.some(p => p.startsWith('.') && !own.includes(p.slice(1)))) ok = false
        if (ok) competing.push({ spec: specificity(sel), order, value, sel })
      }
    })
    competing.sort((a, b) => a.spec[0] - b.spec[0] || a.spec[1] - b.spec[1] || a.spec[2] - b.spec[2] || a.order - b.order)
    return { value: competing.length ? competing[competing.length - 1].value : null, competing }
  }

  it('a long name breaks inside its own cell as a resolved cascade, in the life list and the ranked rows (D-08, D-11)', () => {
    const ABOVE = ['sr-hsr-tab', 'sr-hsr-view', 'sr-hsr-report', 'sr-hsr-body', 'sr-hsr-rail', 'sr-hsr-card', 'sr-hsr-secbody', 'sr-birdname', 'sr-birdname-md', 'sr-birdname-row']
    const SURFACES: [string, string[]][] = [
      ['the life list', [...ABOVE, 'sr-hsr-ll', 'sr-hsr-ll-list', 'sr-hsr-ll-row', 'sr-hsr-ll-name']],
      ['the ranked rows', [...ABOVE, 'sr-hsr-toplist', 'sr-hsr-toprow', 'sr-hsr-top-main']],
    ]
    for (const [where, chain] of SURFACES) {
      for (const own of [['sr-birdname-link'], ['sr-birdname-text']]) {
        const { value, competing } = resolvedAt(chain, own, 'overflow-wrap')
        // `break-word` renders the same and does not fix an unbreakable run in a
        // flex item (ui.md v1.0.14), so the value is held exactly.
        expect(value, `${where} ${own[0]}: ${competing.map(c => `${c.sel} ${c.value}`).join(' | ')}`).toBe('anywhere')
      }
    }
    // Non-vacuity: the resolver reaches the shared scientific-name rule beside
    // it, and a chain without this tab's cells reaches no anywhere at all.
    expect(resolvedAt(SURFACES[0][1], ['sr-birdname-sci'], 'overflow-wrap').value).toBe('anywhere')
    expect(resolvedAt(ABOVE, ['sr-birdname-link'], 'overflow-wrap').value).toBeNull()
  })

  it('a bird name inside the glance and the ranked rows wraps in its own cell, scoped, so the shared BirdName rules are untouched', () => {
    for (const scope of ['.sr-hsr-fact-sp', '.sr-hsr-top-main']) {
      expect(decl(top(`${scope} .sr-birdname`)[0].body, 'max-width')).toBe('100%')
      expect(decl(top(`${scope} .sr-birdname-row`)[0].body, 'flex-wrap')).toBe('wrap')
    }
    // The ranked row's name may break inside a word: eBird's longest token is
    // wider than its cell at 320px and 200% text (measured, decisions.md D-08).
    for (const sel of ['.sr-hsr-top-main .sr-birdname-link', '.sr-hsr-top-main .sr-birdname-text']) {
      expect(top(sel).map(r => decl(r.body, 'overflow-wrap')), sel).toEqual(['anywhere'])
    }
    // ...and nothing on this tab reaches into the shared BirdName rules unscoped.
    expect(rules.filter(r => r.atRules.length === 0 && splitList(r.selector).some(s => s.startsWith('.sr-birdname')) && r.selector.includes('.sr-hsr-'))).toEqual([])
  })
})

describe('the shared distribution row on this surface (schema 8.1)', () => {
  /** The classes on a protocol label's ancestor chain and on itself. */
  const CHAIN = new Set(['sr-hsr-tab', 'sr-hsr-view', 'sr-hsr-report', 'sr-hsr-card', 'sr-hsr-secbody', 'sr-wx-rows', 'sr-hsr-proto', 'sr-wx-row', 'no-glyph', 'sr-wx-label'])

  /** A selector every class of which is on the chain, whose subject is the label. */
  function reachesLabel(sel: string): boolean {
    const compounds = compoundsOf(sel)
    if (compounds.length === 0) return false
    const subject = simpleParts(compounds[compounds.length - 1])
    if (!subject.includes('.sr-wx-label')) return false
    for (const c of compounds) for (const p of simpleParts(c)) {
      if (p.startsWith('.') && !CHAIN.has(p.slice(1))) return false
      if (p.startsWith(':') || p.startsWith('[')) return false
    }
    return true
  }

  it('a protocol label wraps above the phone tier: the resolved white-space is not nowrap', () => {
    const competing: { spec: [number, number, number]; order: number; value: string }[] = []
    rules.forEach((r: CssRuleOccurrence, order) => {
      if (r.atRules.length > 0) return
      const value = decl(r.body, 'white-space')
      if (value === null) return
      for (const sel of splitList(r.selector)) if (reachesLabel(sel)) competing.push({ spec: specificity(sel), order, value })
    })
    expect(competing.length).toBeGreaterThanOrEqual(2)
    competing.sort((a, b) => a.spec[0] - b.spec[0] || a.spec[1] - b.spec[1] || a.spec[2] - b.spec[2] || a.order - b.order)
    expect(competing[competing.length - 1].value).not.toBe('nowrap')
    // Non-vacuity: the shared base rule IS nowrap, so the tab's rule is what wins.
    expect(competing.some(c => c.value === 'nowrap')).toBe(true)
  })

  it('no rule under this tab redeclares the row\'s grid tracks or areas', () => {
    for (const r of rules) {
      if (!r.selector.includes('.sr-hsr-')) continue
      for (const sel of splitList(r.selector)) {
        const compounds = compoundsOf(sel)
        const subject = simpleParts(compounds[compounds.length - 1])
        if (!subject.some(p => p.startsWith('.sr-wx-'))) continue
        for (const prop of ['grid-template-columns', 'grid-template-areas', 'grid-area', 'grid-column', 'grid-row']) {
          expect(decl(r.body, prop), `${sel} ${prop}`).toBeNull()
        }
      }
    }
  })
})

describe('tiers and hover (ui.md)', () => {
  it('every phone-tier rule for this tab is inside the established 640px block', () => {
    const masked = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
    const opener = '@media (max-width: 640px) {\n'
    const first = masked.indexOf(opener)
    expect(first).toBeGreaterThan(-1)
    let depth = 0
    let end = -1
    for (let i = first + opener.length - 2; i < masked.length; i++) {
      if (masked[i] === '{') depth++
      else if (masked[i] === '}') { depth--; if (depth === 0) { end = i; break } }
    }
    const tier = masked.slice(first, end)
    const inTier = (tier.match(/\.sr-hsr-[a-z-]+/g) ?? []).length
    const inAny640 = rules.filter(r => r.selector.includes('.sr-hsr-') && r.atRules.some(a => a.includes('max-width: 640px'))).length
    expect(inAny640).toBeGreaterThan(10)
    // Every phone rule's selector text appears inside the first block.
    for (const r of rules.filter(x => x.selector.includes('.sr-hsr-') && x.atRules.some(a => a.includes('max-width: 640px')))) {
      expect(tier.includes(r.selector), r.selector).toBe(true)
    }
    expect(inTier).toBeGreaterThan(10)
  })

  it('every hover look on this tab sits inside @media (hover: hover)', () => {
    const hovers = rules.filter(r => r.selector.includes('.sr-hsr-') && r.selector.includes(':hover'))
    expect(hovers.length).toBeGreaterThan(2)
    for (const r of hovers) expect(r.atRules, r.selector).toContain('@media (hover: hover)')
  })
})

describe('the tab\'s component files draw every color from tokens (QA-69)', () => {
  it('holds no hex or rgb( color literal', () => {
    const files = ['HotspotReportsTab', 'HotspotReportsPicker', 'HotspotReportsOverview', 'HotspotReport', 'HotspotReportHeader', 'HotspotReportLifeList', 'HotspotReportSections', 'HotspotReportsParts', 'HotspotReportMap']
    for (const f of files) {
      const src = readFileSync(fileURLToPath(new URL(`../components/hotspotReports/${f}.tsx`, import.meta.url)), 'utf8')
      expect(/#[0-9a-fA-F]{3,8}\b/.test(src), f).toBe(false)
      expect(/\brgba?\(/.test(src), f).toBe(false)
    }
  })
})
