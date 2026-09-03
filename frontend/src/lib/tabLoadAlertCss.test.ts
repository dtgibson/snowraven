// STYLESHEET GUARD for the tab load-failure live region (improve:
// tab-error-panel-alerts).
//
// The claim here is invisible to every component test in the repo, and that is
// exactly why it needs its own file. jsdom loads no stylesheet, so
// `components/TabLoadErrorAlert.test.tsx` -- which mounts all eight tabs and
// asserts node identity across the failure -- passes in full on a build where a
// single CSS rule has silently switched the announcement off.
//
// THE DEFECT THIS EXISTS TO PREVENT is v0.5.83, caught in a security review as a
// Medium: `.sr-map-geo-error:empty { display: none }`. `display: none` removes an
// element from the ACCESSIBILITY TREE, not merely from view, so a region hidden
// while idle is inserted into the tree at the same instant its first content
// arrives -- the documented way to make a live region fail to announce. It is
// invisible to a `textContent` assertion, to every geometric measurement, and to
// jsdom. The tidiness argument that produced it ("do not leave an empty box") is
// exactly the argument someone will make again here, since this region is
// deliberately mounted and empty on eight tabs at once.
//
// THREE SELECTORS, NOT ONE. Hiding an ANCESTOR removes the region just as
// completely as hiding the region, so the frame and the Statistics-only inner
// column are guarded on the same terms as the region itself.
//
// Selectors are compared EXACTLY, never with `String.includes`: `.sr-tab-load-alert`
// is a strict prefix of `.sr-tab-load-alert-frame` and `.sr-tab-load-alert-inner`,
// so a substring match would silently resolve to whichever rule came first and
// the assertion carrying the teeth would be testing a different one.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseRulesAtAnyDepth, parseTopLevelRules } from './cssTopLevelRules'

const CSS = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const AT_ANY_DEPTH = parseRulesAtAnyDepth(CSS)
const TOP_LEVEL = parseTopLevelRules(CSS)

/** The three classes on the path from the tab to the announced sentence. */
const GUARDED = ['.sr-tab-load-alert-frame', '.sr-tab-load-alert-inner', '.sr-tab-load-alert'] as const

const HIDING = /(?:^|[;{\s])(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)/

/** The selector list, split and trimmed. */
function selectors(sel: string): string[] {
  return sel.split(',').map(s => s.trim()).filter(Boolean)
}

describe('the region and everything above it stay in the accessibility tree', () => {
  it.each(GUARDED)('%s is a laid-out top-level rule', sel => {
    const body = TOP_LEVEL.get(sel)
    expect(body, `${sel} must be a top-level rule so it applies at every width`).toBeTruthy()
    // Positive assertion, so the absence scan below cannot pass vacuously by the
    // rule simply having been deleted.
    expect(body).toMatch(/display\s*:\s*flex/)
  })

  it('NO rule at ANY depth hides any of the three, in any of the ways that remove it from the tree', () => {
    for (const guarded of GUARDED) {
      const matching = AT_ANY_DEPTH.filter(r => selectors(r.selector).includes(guarded))
      expect(matching.length, `${guarded} should have at least its own rule`).toBeGreaterThan(0)
      for (const r of matching) {
        expect(HIDING.test(r.body), `${r.selector} { ${r.body} } must not hide the live region`).toBe(false)
      }
    }
  })

  it('nothing targets them through the `:empty` shape that caused the v0.5.83 defect, at any depth', () => {
    // The prefix form catches `.sr-tab-load-alert:empty`, `.sr-tab-load-alert-frame:has(...)`,
    // a descendant rule, and a media-nested copy -- every route by which a
    // future "tidy away the idle box" rule could reach these elements.
    for (const r of AT_ANY_DEPTH) {
      for (const sel of selectors(r.selector)) {
        if (!GUARDED.some(g => sel.includes(g))) continue
        expect(HIDING.test(r.body), `${sel} { ${r.body} } must not hide the live region`).toBe(false)
      }
    }
  })

  it('guard-the-guard: the hiding matcher really does fire on the shapes it names', () => {
    // A matcher that had gone inert would report every rule clean, which is the
    // false confidence this file exists to avoid.
    for (const decl of ['display: none', 'display:none', 'visibility: hidden', 'visibility:collapse', 'content-visibility: hidden']) {
      expect(HIDING.test(`color: red; ${decl};`), decl).toBe(true)
    }
    // ...and does NOT fire on the declarations these rules actually carry.
    expect(HIDING.test('display: flex;')).toBe(false)
  })

  it('guard-the-guard: the selector scan really would catch a `:empty` hide', () => {
    // Aimed at a synthetic stylesheet carrying the exact v0.5.83 defect, so a
    // scan that had stopped matching cannot report the real file clean.
    const defective = parseRulesAtAnyDepth('.sr-tab-load-alert:empty { display: none; }')
    const caught = defective.some(r =>
      selectors(r.selector).some(sel => GUARDED.some(g => sel.includes(g))) && HIDING.test(r.body))
    expect(caught, 'the scan must reject `.sr-tab-load-alert:empty { display: none }`').toBe(true)
  })
})
