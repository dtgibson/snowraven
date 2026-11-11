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
// WebKit under a classic scrollbar (decisions.md D-07), and the geometric claim
// is held by `website/tools/verify/verify-hotspot-reports.mjs` (held for the
// user's approval with the rest of website/).
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
