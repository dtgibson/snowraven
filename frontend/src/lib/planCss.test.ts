// Stylesheet guard for the Weather/tide Planner's layout declarations (FR-29,
// QA-28; plan-sun-moon-readout QA-17, QA-45, QA-48): the chart box is a
// CONTAINED horizontal scroller (the standing rule: a wide track sits under an
// overflow:hidden / position:relative ancestor with min-width 0 and max-width
// 100%, so it can never extend the page's scroll width), the figure lines and
// the readout wrap anywhere, no planner rule carries a positive min-width, the
// day list is one column, the readout is a stacked-layer grid with a 140ms
// cross-fade collapsed by the global reduced-motion block, the pick marker is
// a never-animated overlay, no rule hides the loading status, and the
// phone-tier rules live INSIDE the established first multi-line 640px block
// rather than in a new one.
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

  it('the day list is ONE chronological column at every tier, capped at 44rem, and the shipped two-column container query is gone (plan-sun-moon-readout D4-07)', () => {
    const region = body('.sr-plan-result')
    expect(decl(region, 'container-type')).toBeNull()
    expect(decl(region, 'container-name')).toBeNull()
    expect(css.indexOf('@container plan')).toBe(-1)
    expect(css).not.toContain('.sr-plan-days { columns')
    expect(css).not.toContain('break-inside')
    const days = body('.sr-plan-days')
    expect(decl(days, 'max-width')).toBe('44rem')
    expect(decl(days, 'margin')).toBe('12px 0 0')
    expect(decl(days, 'columns')).toBeNull()
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

  it('the event grid track that holds the text can shrink to zero, and so does the readout\'s', () => {
    expect(decl(body('.sr-plan-ev'), 'grid-template-columns')).toBe('30px minmax(0, 1fr)')
    expect(decl(body('.sr-plan-ro-row'), 'grid-template-columns')).toBe('14px minmax(0, 1fr)')
  })

  it('the readout\'s text lines and the day-facts line wrap anywhere', () => {
    for (const sel of ['.sr-plan-ro-figs', '.sr-plan-ro-wx', '.sr-plan-ro-est', '.sr-plan-ro-l1', '.sr-plan-ro-keys', '.sr-plan-dayfacts']) {
      expect(decl(body(sel), 'overflow-wrap'), sel).toBe('anywhere')
    }
  })
})

// ── plan-sun-moon-readout: the readout block, the pick marker and the divider
describe('the picked-moment readout is a fixed block of stacked layers (schema 6.2, D13)', () => {
  it('three layers share one grid cell; the sizer is always hidden; the inactive layer is hidden at the end of a 140ms opacity cross-fade', () => {
    expect(decl(body('.sr-plan-ro-layers'), 'display')).toBe('grid')
    expect(decl(body('.sr-plan-ro-layer'), 'grid-area')).toBe('1 / 1')
    expect(decl(body('.sr-plan-ro-sizer'), 'visibility')).toBe('hidden')
    for (const layer of ['.sr-plan-ro-rest', '.sr-plan-ro-pick']) {
      expect(decl(body(layer), 'transition'), layer).toBe('opacity 140ms cubic-bezier(0.2, 0, 0, 1), visibility 0s linear 140ms')
      const off = body(`${layer}.is-off`)
      expect(decl(off, 'opacity')).toBe('0')
      expect(decl(off, 'visibility')).toBe('hidden')
      const on = body(`${layer}.is-on`)
      expect(decl(on, 'opacity')).toBe('1')
      expect(decl(on, 'visibility')).toBe('visible')
      expect(decl(on, 'transition-delay')).toBe('0s, 0s')
    }
    // The block itself: the rule above the layers, rem sizes, no positive min-width.
    const ro = body('.sr-plan-readout')
    expect(decl(ro, 'border-top')).toBe('1px solid var(--sr-border)')
    expect(decl(ro, 'padding-top')).toBe('11px')
    expect(decl(ro, 'margin-top')).toBe('12px')
    expect(decl(body('.sr-plan-ro-est'), 'padding-left')).toBe('23px')
    expect(decl(body('.sr-plan-ro-time'), 'font-size')).toBe('1.0625rem')
    expect(decl(body('.sr-plan-ro-figs'), 'font-size')).toBe('0.8125rem')
  })

  it('the fade has no per-component reduced-motion block: the global one collapses it', () => {
    // No planner-scoped prefers-reduced-motion query anywhere; the file's one
    // global block (`*, *::before, *::after { transition-duration: 0.001ms }`) does it.
    const re = /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.sr-plan-/g
    expect(css.match(re)).toBeNull()
    expect(css).toContain('transition-duration: 0.001ms !important')
  })

  it('the pick marker is an absolutely positioned overlay under the canvas\'s own positioning, never animated, never hit-tested', () => {
    expect(decl(body('.sr-plan-canvas'), 'position')).toBe('relative')
    const mark = body('.sr-plan-pickmark')
    expect(decl(mark, 'position')).toBe('absolute')
    expect(decl(mark, 'width')).toBe('2px')
    expect(decl(mark, 'background')).toBe('var(--sr-plan-pick)')
    expect(decl(mark, 'pointer-events')).toBe('none')
    expect(decl(mark, 'transition')).toBeNull()
    expect(decl(mark, 'animation')).toBeNull()
    const handle = body('.sr-plan-pickmark::before')
    expect(decl(handle, 'width')).toBe('12px')
    expect(decl(handle, 'height')).toBe('7px')
    expect(decl(handle, 'border-radius')).toBe('3.5px')
  })

  it('the scroller shows the inset ring on plain :focus only while a pick exists (D4-01)', () => {
    expect(decl(body('.sr-plan-scroller:focus-visible'), 'outline-offset')).toBe('-3px')
    const pick = body('.sr-plan-scroller.has-pick:focus')
    expect(decl(pick, 'outline')).toBe('3px solid var(--sr-accent)')
    expect(decl(pick, 'outline-offset')).toBe('-3px')
    expect(rules.has('.sr-plan-scroller:focus')).toBe(false)
  })

  it('QA-32: the legend\'s scroll hint is reserved with visibility, never display, so the legend\'s height is fixed from first paint', () => {
    const hint = body('.sr-plan-legend-scroll')
    expect(decl(hint, 'display')).toBe('inline-flex')
    expect(decl(body('.sr-plan-legend-scroll.is-off'), 'visibility')).toBe('hidden')
    expect(decl(body('.sr-plan-legend-scroll.is-off'), 'display')).toBeNull()
    expect(rules.has('.sr-plan-legend-scroll[hidden]')).toBe(false)
    // An all-depth scan: no rule anywhere display-hides the hint.
    const re = /([^{}]*\.sr-plan-legend-scroll[^{}]*)\{([^{}]*)\}/g
    let m: RegExpExecArray | null
    let seen = 0
    while ((m = re.exec(css)) !== null) { seen += 1; expect(m[2], m[1]).not.toMatch(/display\s*:\s*none/) }
    expect(seen).toBeGreaterThanOrEqual(2)
  })

  it('the divider is a labelled rule in the section-label register with a hairline to the right edge (D4-09)', () => {
    const week = body('.sr-plan-week')
    expect(decl(week, 'display')).toBe('flex')
    expect(decl(week, 'margin-top')).toBe('22px')
    expect(decl(week, 'text-transform')).toBe('uppercase')
    expect(decl(week, 'font-size')).toBe('0.6875rem')
    const rule = body('.sr-plan-week::after')
    expect(decl(rule, 'height')).toBe('1px')
    expect(decl(rule, 'background')).toBe('var(--sr-border-medium)')
    expect(decl(rule, 'flex')).toBe('1 1 24px')
    expect(decl(body('.sr-plan-week-label'), 'white-space')).toBe('nowrap')
  })

  it('the single-moment action\'s chrome lives in a class, and both form actions wrap on the phone tier', () => {
    const primary = body('.sr-plan-btn-primary')
    expect(decl(primary, 'height')).toBe('44px')
    expect(decl(primary, 'background')).toBe('var(--sr-accent)')
    expect(decl(primary, 'white-space')).toBe('nowrap')
    const first = css.indexOf('@media (max-width: 640px) {\n')
    const block = css.slice(first, css.indexOf('\n}\n', first))
    expect(block).toContain('.sr-plan-forecast, .sr-plan-action { white-space: normal; height: auto; min-height: 44px; padding-top: 8px; padding-bottom: 8px; line-height: 1.3; text-align: center; }')
    expect(block).toContain('.sr-plan-ro-wx .sr-plan-ev-res { display: block; margin-left: 0; margin-top: 2px; }')
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
