/// <reference types="node" />
// SIDE INSETS ON THE THREE FIXED BOTTOM SURFACES (ios27-iphone-duo,
// design-refinement section 1).
//
// The phone bar, the More sheet and the Alerts inbox sheet are position:fixed,
// full width, and escape `.sr-ios-app body`'s side padding, so a side inset the
// OS reports (the iPhone Duo's camera, an Android cutout in landscape) would sit
// over the bar's end cell and the sheets' first rows. They PAD on both sides,
// each edge reading its own side's inset, gated on the platform class, and on
// every device whose side insets are 0 the result must be what it was before.
//
// What this file asserts, and how:
//   1. The exact declaration list of each gated rule, so the change is the two
//      side declarations and nothing else moved (the bottom pad, the Android
//      bar's slide transition, the 641px inbox panel's top pad).
//   2. The RESOLVED padding of each surface per platform class and width,
//      computed from the parsed stylesheet by a small cascade model (exact
//      selectors, specificity, source order, the padding shorthand, the two
//      media tiers), with the insets substituted. A presence check would pass a
//      rule another rule overrides; the resolved value cannot.
//   3. ZERO INSETS CHANGE NOTHING, derived rather than restated: the resolved
//      padding with every inset at 0 must EQUAL the resolved padding of the same
//      stylesheet with every side declaration that reads an inset removed. Each
//      side of that equality comes from the same model, so it needs no typed
//      expectation and cannot go stale.
//
// Its reach, stated so it is not over-read: these four surfaces' own padding
// only, in globals.css, at the two width tiers. Layout (the bar's label
// container query reading the content box, the sheet's 528px cap) is a browser
// measurement and is covered elsewhere (navCss.test.ts, TabNav.test.tsx).
// The per-side and the Android-twin rules for the whole stylesheet are
// safeAreaPerSide.test.ts and androidInsetsCss.test.ts.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseRulesAtAnyDepth, type CssRuleOccurrence } from './cssTopLevelRules'

const css = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')

type Platform = 'ios' | 'android' | 'web'
type Side = 'top' | 'right' | 'bottom' | 'left'
type Insets = Record<Side, number>
type Box = Record<Side, number>

const SIDES: Side[] = ['top', 'right', 'bottom', 'left']
const GATE: Record<Platform, string | null> = { ios: '.sr-ios-app', android: '.sr-android-app', web: null }
const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
/** A camera or cutout on the LEFT only, so a mirrored read shows as a wrong side. */
const LEFT_CAMERA: Insets = { top: 0, right: 0, bottom: 34, left: 34 }

/** Split on top-level commas, so `:is(a, b)` survives whole. */
function splitList(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out.map(p => p.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/** The compounds of one complex selector, combinator-separated, paren-aware. */
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

/** Declarations of a rule body as [property, value] pairs, normalized. */
function decls(body: string): Array<[string, string]> {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map(d => d.trim())
    .filter(Boolean)
    .map(d => {
      const i = d.indexOf(':')
      return [d.slice(0, i).trim(), d.slice(i + 1).trim().replace(/\s+/g, ' ')] as [string, string]
    })
}

/** Padding declarations expanded to the four physical longhands (LTR). */
function paddingLonghands(prop: string, value: string): Array<[Side, string]> | null {
  const v = value.split(/\s+(?![^(]*\))/)
  switch (prop) {
    case 'padding':
      return [['top', v[0]], ['right', v[1] ?? v[0]], ['bottom', v[2] ?? v[0]], ['left', v[3] ?? v[1] ?? v[0]]]
    case 'padding-top': case 'padding-right': case 'padding-bottom': case 'padding-left':
      return [[prop.slice('padding-'.length) as Side, value]]
    case 'padding-inline': return [['left', v[0]], ['right', v[1] ?? v[0]]]
    case 'padding-block': return [['top', v[0]], ['bottom', v[1] ?? v[0]]]
    case 'padding-inline-start': return [['left', value]]
    case 'padding-inline-end': return [['right', value]]
    case 'padding-block-start': return [['top', value]]
    case 'padding-block-end': return [['bottom', value]]
    default:
      if (prop.startsWith('padding')) throw new Error(`unmodelled padding property ${prop}`)
      return null
  }
}

/** A padding value with the insets substituted, in px. Fails closed on any other shape. */
function evaluate(value: string, insets: Insets): number {
  const sub = value
    .replace(/env\(safe-area-inset-(top|right|bottom|left), 0px\)/g, (_, s: Side) => `${insets[s]}px`)
    .replace(/var\(--sr-inset-(top|right|bottom|left), 0px\)/g, (_, s: Side) => `${insets[s]}px`)
  if (sub === '0') return 0
  const px = /^(-?\d*\.?\d+)px$/.exec(sub)
  if (px) return Number(px[1])
  const sum = /^calc\((-?\d*\.?\d+)px \+ (-?\d*\.?\d+)px\)$/.exec(sub)
  if (sum) return Number(sum[1]) + Number(sum[2])
  throw new Error(`unmodelled padding value "${value}"`)
}

/** Whether an at-rule context holds at a width. Anything else is refused, not guessed. */
function contextHolds(atRules: string[], width: number): boolean {
  return atRules.every(a => {
    if (a === '@media (min-width: 641px)') return width >= 641
    if (a === '@media (max-width: 640px)') return width <= 640
    throw new Error(`unmodelled at-rule context "${a}"`)
  })
}

/**
 * The padding a surface resolves to, per platform class and viewport width.
 *
 * A selector counts when its subject compound is exactly the surface class and
 * it is either the bare class (0,1,0) or the class under a platform gate
 * (0,2,0), the gate holding only on that platform. Any OTHER selector whose
 * subject is the surface and which sets padding is refused, because this model
 * cannot say when it matches. Unset sides are 0 (preflight's `padding: 0`,
 * which every rule here outranks, being unlayered).
 */
function resolve(rules: CssRuleOccurrence[], surface: string, platform: Platform, width: number, insets: Insets): Box {
  const won = new Map<Side, { value: string; spec: number; order: number }>()
  rules.forEach((rule, order) => {
    for (const sel of splitList(rule.selector)) {
      const c = compounds(sel)
      if (c[c.length - 1] !== `.${surface}`) continue
      const paddings = decls(rule.body).flatMap(([p, v]) => paddingLonghands(p, v) ?? [])
      if (paddings.length === 0) continue
      let spec: number
      if (c.length === 1) spec = 1
      else if (c.length === 2 && (c[0] === '.sr-ios-app' || c[0] === '.sr-android-app')) {
        if (c[0] !== GATE[platform]) continue
        spec = 2
      } else throw new Error(`unmodelled selector "${sel}" sets padding on .${surface}`)
      if (rule.body.includes('!important')) throw new Error(`unmodelled !important on "${sel}"`)
      if (!contextHolds(rule.atRules, width)) continue
      for (const [side, value] of paddings) {
        const prev = won.get(side)
        if (!prev || spec > prev.spec || (spec === prev.spec && order > prev.order)) won.set(side, { value, spec, order })
      }
    }
  })
  return Object.fromEntries(SIDES.map(s => [s, won.has(s) ? evaluate(won.get(s)!.value, insets) : 0])) as Box
}

const RULES = parseRulesAtAnyDepth(css)

/**
 * The same stylesheet with every SIDE declaration that reads an inset removed:
 * exactly what the change added. The identity row compares against it.
 */
const WITHOUT_SIDE_READS = parseRulesAtAnyDepth(
  css.replace(/^[ \t]*padding-(?:left|right):[^;{}]*(?:env\(safe-area-inset-|var\(--sr-inset-)[^;{}]*;[ \t]*\n/gm, ''),
)

const PHONE = 390
const PANEL = 800

/** Each surface, the widths it renders at, and the platforms whose class reaches it. */
const SURFACES: Array<{ surface: string; widths: number[] }> = [
  { surface: 'sr-navbar', widths: [PHONE] },
  { surface: 'sr-nav-sheet', widths: [PHONE] },
  { surface: 'sr-inbox-sheet', widths: [PHONE, PANEL] },
  { surface: 'sr-inbox-root', widths: [PHONE, PANEL] },
]
const PLATFORMS: Platform[] = ['ios', 'android', 'web']

const rule = (selector: string, atRules: string[] = []) => {
  const hits = RULES.filter(r => splitList(r.selector).includes(selector) && r.atRules.join(' | ') === atRules.join(' | '))
  expect(hits, `${selector} in "${atRules.join(' | ')}" must be declared exactly once`).toHaveLength(1)
  return decls(hits[0].body)
}

describe('the gated rules declare the two side insets and nothing else changed', () => {
  it.each([
    ['.sr-ios-app .sr-navbar', [], [
      ['padding-bottom', 'calc(6px + env(safe-area-inset-bottom, 0px))'],
      ['padding-left', 'env(safe-area-inset-left, 0px)'],
      ['padding-right', 'env(safe-area-inset-right, 0px)'],
    ]],
    ['.sr-ios-app .sr-nav-sheet', [], [
      ['padding-bottom', 'calc(14px + env(safe-area-inset-bottom, 0px))'],
      ['padding-left', 'env(safe-area-inset-left, 0px)'],
      ['padding-right', 'env(safe-area-inset-right, 0px)'],
    ]],
    ['.sr-ios-app .sr-inbox-sheet', [], [
      ['padding-left', 'env(safe-area-inset-left, 0px)'],
      ['padding-right', 'env(safe-area-inset-right, 0px)'],
    ]],
    ['.sr-ios-app .sr-inbox-root', [], [
      ['padding-top', 'env(safe-area-inset-top, 0px)'],
    ]],
    ['.sr-ios-app .sr-inbox-root', ['@media (min-width: 641px)'], [
      ['padding-top', 'calc(24px + env(safe-area-inset-top, 0px))'],
      ['padding-left', 'calc(24px + env(safe-area-inset-left, 0px))'],
      ['padding-right', 'calc(24px + env(safe-area-inset-right, 0px))'],
    ]],
    ['.sr-ios-app .sr-inbox-sheet', ['@media (min-width: 641px)'], [
      ['padding-left', '0'],
      ['padding-right', '0'],
    ]],
    ['.sr-android-app .sr-navbar', [], [
      ['padding-bottom', 'calc(6px + var(--sr-inset-bottom, 0px))'],
      ['padding-left', 'var(--sr-inset-left, 0px)'],
      ['padding-right', 'var(--sr-inset-right, 0px)'],
      ['transition', 'transform 160ms ease-out'],
    ]],
    ['.sr-android-app .sr-nav-sheet', [], [
      ['padding-bottom', 'calc(14px + var(--sr-inset-bottom, 0px))'],
      ['padding-left', 'var(--sr-inset-left, 0px)'],
      ['padding-right', 'var(--sr-inset-right, 0px)'],
    ]],
  ] as Array<[string, string[], Array<[string, string]>]>)('%s %j', (selector, atRules, expected) => {
    expect(rule(selector, atRules)).toEqual(expected)
  })

  it('the ungated base rules read no inset (index.html ships viewport-fit=cover to browsers too)', () => {
    for (const { surface } of SURFACES) {
      const base = RULES.filter(r => splitList(r.selector).includes(`.${surface}`))
      expect(base.length, `.${surface} has a base rule`).toBeGreaterThan(0)
      for (const r of base) {
        expect(r.body, `.${surface} in "${r.atRules.join(' | ')}"`).not.toMatch(/env\(|--sr-inset-/)
      }
    }
  })

  it('the inbox has no Android rule (it never renders on Android)', () => {
    expect(RULES.filter(r => /\.sr-android-app\b[^,]*\.sr-inbox-/.test(r.selector))).toEqual([])
  })
})

describe('the resolved padding, per surface, platform class and width', () => {
  it.each(SURFACES.flatMap(({ surface, widths }) =>
    PLATFORMS.flatMap(platform => widths.map(width => [surface, platform, width] as const))))(
    'ZERO insets change nothing: .%s on %s at %ipx equals the stylesheet without the side reads',
    (surface, platform, width) => {
      expect(resolve(RULES, surface, platform, width, ZERO))
        .toEqual(resolve(WITHOUT_SIDE_READS, surface, platform, width, ZERO))
    },
  )

  it.each([
    // The phone tier: the bar, the More sheet and the inbox sheet start at the
    // inset; each edge reads its own side, so the right stays 0.
    ['sr-navbar', 'ios', PHONE, { top: 0, right: 0, bottom: 40, left: 34 }],
    ['sr-nav-sheet', 'ios', PHONE, { top: 0, right: 0, bottom: 48, left: 34 }],
    ['sr-inbox-sheet', 'ios', PHONE, { top: 0, right: 0, bottom: 0, left: 34 }],
    ['sr-inbox-root', 'ios', PHONE, { top: 0, right: 0, bottom: 0, left: 0 }],
    // 641px and up: the centred panel touches no edge, so the ROOT pads and the
    // sheet resets to 0.
    ['sr-inbox-sheet', 'ios', PANEL, { top: 0, right: 0, bottom: 0, left: 0 }],
    ['sr-inbox-root', 'ios', PANEL, { top: 24, right: 24, bottom: 24, left: 58 }],
    // Android: the twins read the injected variables; the inbox has no twin.
    ['sr-navbar', 'android', PHONE, { top: 0, right: 0, bottom: 40, left: 34 }],
    ['sr-nav-sheet', 'android', PHONE, { top: 0, right: 0, bottom: 48, left: 34 }],
    // Web and Pi never carry either class, so nothing moves there.
    ['sr-navbar', 'web', PHONE, { top: 0, right: 0, bottom: 0, left: 0 }],
    ['sr-nav-sheet', 'web', PHONE, { top: 0, right: 0, bottom: 14, left: 0 }],
    ['sr-inbox-sheet', 'web', PHONE, { top: 0, right: 0, bottom: 0, left: 0 }],
    ['sr-inbox-root', 'web', PANEL, { top: 24, right: 24, bottom: 24, left: 24 }],
  ] as Array<[string, Platform, number, Box]>)(
    'a left camera: .%s on %s at %ipx', (surface, platform, width, expected) => {
      expect(resolve(RULES, surface, platform, width, LEFT_CAMERA)).toEqual(expected)
    },
  )
})

// GUARD THE GUARD. The identity rows above are only as good as the model and the
// removal, so each is shown to see what it must.
describe('the cascade model and the removal are not vacuous', () => {
  it('the removal takes out exactly the side reads and keeps every other declaration', () => {
    // It must remove something from each surface's gated rules, or the
    // identity rows would compare a stylesheet with itself; and it must remove
    // nothing else, or they would compare against a different stylesheet.
    const find = (rules: CssRuleOccurrence[], selector: string, atRules: string[]) =>
      rules.find(r => splitList(r.selector).includes(selector) && r.atRules.join(' | ') === atRules.join(' | '))!
    const SIDE = new Set(['padding-left', 'padding-right'])
    for (const [selector, atRules] of [
      ['.sr-ios-app .sr-navbar', []], ['.sr-ios-app .sr-nav-sheet', []], ['.sr-ios-app .sr-inbox-sheet', []],
      ['.sr-ios-app .sr-inbox-root', ['@media (min-width: 641px)']],
      ['.sr-android-app .sr-navbar', []], ['.sr-android-app .sr-nav-sheet', []],
    ] as Array<[string, string[]]>) {
      const before = decls(find(RULES, selector, atRules).body)
      const after = decls(find(WITHOUT_SIDE_READS, selector, atRules).body)
      expect(before.filter(([p]) => SIDE.has(p)), selector).toHaveLength(2)
      expect(after, selector).toEqual(before.filter(([p]) => !SIDE.has(p)))
    }
    // The 641px reset reads no inset, so it is kept as written.
    expect(decls(find(WITHOUT_SIDE_READS, '.sr-ios-app .sr-inbox-sheet', ['@media (min-width: 641px)']).body))
      .toEqual([['padding-left', '0'], ['padding-right', '0']])
    expect(WITHOUT_SIDE_READS.length).toBe(RULES.length)
  })

  it('a non-zero side read IS visible to the identity comparison', () => {
    // The mutation the identity rows exist to refuse: a side declaration that
    // moves the surface even when the OS reports no inset.
    const mutated = parseRulesAtAnyDepth(css.replace(
      /(\.sr-ios-app \.sr-navbar \{[^}]*padding-left: )env\(safe-area-inset-left, 0px\)/,
      '$1calc(4px + env(safe-area-inset-left, 0px))',
    ))
    expect(resolve(mutated, 'sr-navbar', 'ios', PHONE, ZERO).left).toBe(4)
    expect(resolve(WITHOUT_SIDE_READS, 'sr-navbar', 'ios', PHONE, ZERO).left).toBe(0)
  })

  it('reads the shorthand, specificity and source order as the engine does', () => {
    const fixture = parseRulesAtAnyDepth([
      '.sr-x { padding: 1px 2px 3px; }',
      '.sr-ios-app .sr-x { padding-left: 9px; }',
      '.sr-x { padding-left: 5px; }',
      '@media (min-width: 641px) { .sr-x { padding-top: 7px; } }',
    ].join('\n'))
    expect(resolve(fixture, 'sr-x', 'web', PHONE, ZERO)).toEqual({ top: 1, right: 2, bottom: 3, left: 5 })
    expect(resolve(fixture, 'sr-x', 'ios', PHONE, ZERO)).toEqual({ top: 1, right: 2, bottom: 3, left: 9 })
    expect(resolve(fixture, 'sr-x', 'web', PANEL, ZERO).top).toBe(7)
  })

  it('refuses what it cannot model rather than guessing', () => {
    const atRule = parseRulesAtAnyDepth('@media (max-width: 480px) { .sr-x { padding-left: 1px; } }')
    expect(() => resolve(atRule, 'sr-x', 'web', PHONE, ZERO)).toThrow(/at-rule/)
    const selector = parseRulesAtAnyDepth('.sr-open .sr-x { padding-left: 1px; }')
    expect(() => resolve(selector, 'sr-x', 'web', PHONE, ZERO)).toThrow(/selector/)
    const value = parseRulesAtAnyDepth('.sr-x { padding-left: 1rem; }')
    expect(() => resolve(value, 'sr-x', 'web', PHONE, ZERO)).toThrow(/value/)
  })
})
