// Stylesheet guard for the Weather/tide Planner's layout declarations (FR-29,
// QA-28): the chart box is a CONTAINED horizontal scroller (the standing rule:
// a wide track sits under an overflow:hidden / position:relative ancestor with
// min-width 0 and max-width 100%, so it can never extend the page's scroll
// width), the two figure lines wrap anywhere, the list carries no positive
// min-width, no rule hides the loading status, and the phone-tier rules live
// INSIDE the established first multi-line 640px block rather than in a new one.
//
// Selectors are compared exactly by rightmost compound, never with
// String.includes. What this cannot prove: that the page actually never
// scrolls sideways at 320px and 200% text scale; that is a browser
// measurement (the house method), and this guard says so rather than
// pretending a stylesheet can settle a geometric claim.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTopLevelRules } from './cssTopLevelRules'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const rules = parseTopLevelRules(css)

const body = (selector: string): string => {
  const b = rules.get(selector)
  if (b === undefined) throw new Error(`no top-level rule for ${selector}`)
  return b
}
const decl = (b: string, prop: string): string | null => {
  const m = b.match(new RegExp(`(?:^|[;{\\s])${prop.replace(/[-]/g, '\\-')}\\s*:\\s*([^;}]+)`))
  return m ? m[1].trim() : null
}

describe('the chart box is a contained horizontal scroller', () => {
  it('.sr-plan-chartbox: position relative, overflow hidden, min-width 0, max-width 100%', () => {
    const b = body('.sr-plan-chartbox')
    expect(decl(b, 'position')).toBe('relative')
    expect(decl(b, 'overflow')).toBe('hidden')
    expect(decl(b, 'min-width')).toBe('0')
    expect(decl(b, 'max-width')).toBe('100%')
  })

  it('.sr-plan-scroller scrolls on x only, with NO snapping and no scroll padding anywhere (D4-12)', () => {
    const b = body('.sr-plan-scroller')
    expect(decl(b, 'overflow-x')).toBe('auto')
    expect(decl(b, 'overflow-y')).toBe('hidden')
    expect(decl(b, 'scroll-snap-type')).toBeNull()
    expect(decl(b, 'scroll-padding-left')).toBeNull()
    expect(rules.has('.sr-plan-snap')).toBe(false)
    for (const [sel, rb] of rules) {
      if (!sel.includes('.sr-plan-')) continue
      expect(rb, sel).not.toMatch(/scroll-snap|scroll-padding/)
    }
    // While the mouse button is down the scroller takes no smooth behaviour.
    const d = body('.sr-plan-scroller.is-dragging')
    expect(decl(d, 'cursor')).toBe('grabbing')
    expect(decl(d, 'user-select')).toBe('none')
    expect(decl(d, 'scroll-behavior')).toBe('auto')
  })
})

describe('the wide tier (D4-13, D4-17)', () => {
  it('the card lifts its width to a class with a 220ms max-width transition, and widens for a plan only from 641px', () => {
    const card = body('.sr-weather-card')
    expect(decl(card, 'max-width')).toBe('540px')
    expect(decl(card, 'transition')).toMatch(/^max-width 220ms cubic-bezier\(0\.2, 0, 0, 1\)$/)
    const wide = css.indexOf('@media (min-width: 641px) {\n  .sr-weather-card--plan { max-width: 1080px; }')
    expect(wide).toBeGreaterThan(-1)
    const block = css.slice(wide, css.indexOf('\n}\n', wide))
    expect(block).toContain('.sr-weather-card--plan .sr-weather-narrow { max-width: 476px; margin-inline: auto; }')
    // Nothing top-level makes the narrow wrapper do anything without the widened card.
    expect(rules.has('.sr-weather-narrow')).toBe(false)
  })

  it('the region is a named container and the day list flows into two columns above 760px', () => {
    const region = body('.sr-plan-result')
    expect(decl(region, 'container-type')).toBe('inline-size')
    expect(decl(region, 'container-name')).toBe('plan')
    const q = css.indexOf('@container plan (min-width: 760px) {')
    expect(q).toBeGreaterThan(-1)
    const block = css.slice(q, css.indexOf('\n}\n', q))
    expect(block).toContain('.sr-plan-days { columns: 2; column-gap: 36px; }')
    expect(block).toContain('.sr-plan-day { break-inside: avoid; }')
  })

  it('App.tsx puts the card class and the narrow wrapper where the spec says, with no inline max-width left', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
    expect(app).toContain("className={`sr-card sr-weather-card${planOnScreen ? ' sr-weather-card--plan' : ''}`}")
    expect(app).toContain('<WeatherForecastPanel onPlanVisible={setPlanOnScreen} />')
    const cardStart = app.indexOf('sr-card sr-weather-card')
    const cardStyle = app.slice(cardStart, app.indexOf('}}>', cardStart))
    expect(cardStyle).not.toContain('maxWidth')
    // The narrow wrapper opens right after the card and closes right before the panel.
    const narrowOpen = app.indexOf('<div className="sr-weather-narrow">', cardStart)
    expect(narrowOpen).toBeGreaterThan(cardStart)
    expect(narrowOpen).toBeLessThan(app.indexOf('htmlFor="checklist-input"', cardStart))
    const panel = app.indexOf('<WeatherForecastPanel onPlanVisible')
    expect(app.slice(0, panel).lastIndexOf('</div>')).toBeGreaterThan(narrowOpen)
  })
})

describe('the list never scrolls sideways', () => {
  it('the tide and weather lines wrap anywhere (the spelling that lowers a flex item\'s minimum)', () => {
    expect(decl(body('.sr-plan-ev-tide'), 'overflow-wrap')).toBe('anywhere')
    expect(decl(body('.sr-plan-ev-wx'), 'overflow-wrap')).toBe('anywhere')
    expect(decl(body('.sr-plan-hours p'), 'overflow-wrap')).toBe('anywhere')
    expect(decl(body('.sr-plan-meta'), 'overflow-wrap')).toBe('anywhere')
  })

  it('no planner rule carries a positive min-width', () => {
    for (const [sel, b] of rules) {
      if (!sel.includes('.sr-plan-')) continue
      const mw = decl(b, 'min-width')
      if (mw !== null) expect(mw, sel).toBe('0')
    }
  })

  it('the event grid track that holds the text can shrink to zero', () => {
    expect(decl(body('.sr-plan-ev'), 'grid-template-columns')).toBe('30px minmax(0, 1fr)')
  })
})

describe('the phone tier', () => {
  it('the planner\'s phone rules sit inside the FIRST multi-line 640px block, not a new one', () => {
    const first = css.indexOf('@media (max-width: 640px) {\n')
    expect(first).toBeGreaterThan(-1)
    // The block ends at the first line that is a bare closing brace after it.
    const close = css.indexOf('\n}\n', first)
    const block = css.slice(first, close)
    expect(block).toContain('.sr-plan-h3 { white-space: normal; }')
    expect(block).toContain('.sr-plan-ev-res { margin-left: 0; width: 100%; white-space: normal; }')
    expect(block).toContain('.sr-plan-notice .sr-plan-btn-outline { width: 100%; }')
    // And no later 640 block re-declares them.
    const rest = css.slice(close)
    expect(rest).not.toContain('.sr-plan-h3 {')
  })

  it('the region trims its side padding on a small phone through the shared hook', () => {
    // The class is applied in PlanResult; the hook itself is the shared one.
    const src = readFileSync(new URL('../components/PlanResult.tsx', import.meta.url), 'utf8')
    expect(src).toContain('className="sr-plan-result sr-pad-x-trim"')
  })
})

describe('nothing hides the live status', () => {
  it('no rule anywhere sets display or visibility on .sr-plan-status to a hiding value', () => {
    // An all-depth scan: every rule whose selector list names the status.
    const re = /([^{}]*\.sr-plan-status[^{}]*)\{([^{}]*)\}/g
    let m: RegExpExecArray | null
    let seen = 0
    while ((m = re.exec(css)) !== null) {
      seen += 1
      expect(m[2]).not.toMatch(/display\s*:\s*none/)
      expect(m[2]).not.toMatch(/visibility\s*:\s*hidden/)
    }
    expect(seen).toBeGreaterThanOrEqual(1)
    expect(decl(body('.sr-plan-status'), 'display')).toBe('flex')
  })
})
