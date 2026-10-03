/// <reference types="node" />
// THE ANDROID INSET TWINS (android-release FR-20, design-spec section 2).
//
// The Android WebView reports 0px for env(safe-area-inset-*) below Chromium 140
// and the app's floor is 111, so MainActivity.kt injects the system-bar and
// cutout insets as --sr-inset-top/right/bottom/left and every Android inset
// rule reads ONLY those. The design's rule is one `.sr-android-app` twin per
// shipped `.sr-ios-app` safe-area rule, same selectors and same at-rule
// context, with `env(safe-area-inset-X, 0px)` replaced by
// `var(--sr-inset-X, 0px)`; the Alerts inbox never renders on Android and has
// no twin.
//
// THE SUBJECTS ARE DERIVED, NEVER NAMED: every iOS rule that reads a safe-area
// variable is read out of globals.css at any depth through the shared parser,
// so an iOS inset rule added later with no Android twin turns this red rather
// than going unnoticed (testing.md, a totality claim needs a total test).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseRulesAtAnyDepth, type CssRuleOccurrence } from './cssTopLevelRules'

const css = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const rules = parseRulesAtAnyDepth(css)

/** Selector list split on top-level commas, each part whitespace-normalized. */
function parts(selector: string): string[] {
  return selector.split(',').map(p => p.trim().replace(/\s+/g, ' '))
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

const context = (r: CssRuleOccurrence) => r.atRules.join(' | ')

// The iOS rules that read a safe-area variable, minus the inbox (FR-15: it
// never renders on Android).
const iosInsetRules = rules.filter(
  r =>
    parts(r.selector).every(p => p.startsWith('.sr-ios-app ')) &&
    /env\(safe-area-inset-/.test(r.body) &&
    !/sr-inbox-/.test(r.selector),
)
const androidRules = rules.filter(r => parts(r.selector).some(p => p.startsWith('.sr-android-app')))

describe('every iOS safe-area rule has an Android twin', () => {
  it('the derivation is not vacuous (the iOS family and the twins are both present)', () => {
    // 21 at the time of writing; asserted as a floor so the guard cannot pass
    // over an empty scan, while the per-rule assertion below carries the claim.
    expect(iosInsetRules.length).toBeGreaterThanOrEqual(20)
    expect(androidRules.length).toBeGreaterThanOrEqual(iosInsetRules.length)
  })

  it.each(iosInsetRules.map(r => [r.selector.replace(/\s+/g, ' '), r] as const))(
    '%s',
    (_label, ios) => {
      const wanted = parts(ios.selector).map(p => p.replace(/^\.sr-ios-app /, '.sr-android-app ')).join(', ')
      const twin = androidRules.find(
        r => parts(r.selector).join(', ') === wanted && context(r) === context(ios),
      )
      expect(twin, `no .sr-android-app twin for "${ios.selector}" in "${context(ios)}"`).toBeDefined()
      // Every iOS declaration appears in the twin with env() swapped for the
      // injected variable of the SAME side; the twin may add declarations
      // (the phone bar's slide transition) but never drop one.
      const twinDecls = decls(twin!.body)
      for (const [prop, value] of decls(ios.body)) {
        const converted = value.replace(/env\(safe-area-inset-(top|right|bottom|left),\s*0px\)/g, 'var(--sr-inset-$1, 0px)')
        expect(twinDecls).toContainEqual([prop, converted])
      }
    },
  )
})

describe('the Android rules read only the injected variables', () => {
  it('no .sr-android-app rule reads env() (a WebView that later reports env() cannot double-pad)', () => {
    const offenders = androidRules.filter(r => /env\(/.test(r.body)).map(r => r.selector)
    expect(offenders).toEqual([])
  })

  it('each --sr-inset-X feeds only a declaration addressing side X, or a side-free one', () => {
    const SIDES = ['top', 'right', 'bottom', 'left']
    for (const r of androidRules) {
      for (const [prop, value] of decls(r.body)) {
        const used = [...value.matchAll(/var\(--sr-inset-(top|right|bottom|left)/g)].map(m => m[1])
        const side = SIDES.find(s => prop === s || prop.endsWith(`-${s}`))
        for (const u of used) {
          if (side) expect(u, `${r.selector} { ${prop}: ${value} }`).toBe(side)
          // side-free properties (height, max-height) may subtract the top inset only
          else expect(u, `${r.selector} { ${prop}: ${value} }`).toBe('top')
        }
      }
    }
  })

  it('every injected variable falls back to 0px, so the first paint is the un-inset layout', () => {
    for (const r of androidRules) {
      const bare = r.body.match(/var\(--sr-inset-(top|right|bottom|left)\)/g)
      expect(bare, r.selector).toBeNull()
    }
  })

  it('the inbox has no Android twin (it never renders on Android)', () => {
    expect(androidRules.filter(r => /sr-inbox-/.test(r.selector))).toEqual([])
  })
})

describe('the keyboard rule (design-spec section 4)', () => {
  it('the phone bar slides out while the keyboard is up, and carries the 160ms ease-out', () => {
    const open = rules.find(r => r.selector.replace(/\s+/g, ' ') === '.sr-android-app.sr-ime-open .sr-navbar')
    expect(open).toBeDefined()
    expect(decls(open!.body)).toContainEqual(['transform', 'translateY(100%)'])
    expect(open!.atRules).toEqual([])
    const bar = androidRules.find(r => r.selector.replace(/\s+/g, ' ') === '.sr-android-app .sr-navbar')
    expect(decls(bar!.body)).toContainEqual(['transition', 'transform 160ms ease-out'])
  })
})
