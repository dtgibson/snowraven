// Structural guard for the two shared control registers (`.sr-pill` and
// `.sr-segbar` / `.sr-segbar-btn`) and for the two repairs that shipped with
// them: the phone-tier control floor's per-control rem term, and the derived
// label floor beside it.
//
// It parses the REAL globals.css, the same posture as weatherRowTierCss /
// milestoneContrast / filterControlSizeCss: a register is entirely CSS, so a
// jsdom component mount can only ever assert that a class name is present, never
// that the class does anything. Every value a call site used to declare inline
// now lives in one block, which is the whole point and also the whole risk: one
// edit here changes 44 controls across 15 components at once.
//
// Every assertion is written against a NAMED wrong implementation and was
// verified by mutating the source until it went red, never by reading it.
/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
// Comments blanked to spaces of EQUAL LENGTH: this file's subjects are discussed
// at length in the stylesheet's own prose, so a raw scan would be satisfied by a
// comment describing a rule that is not there.
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

/** All style rules, with their at-rule ancestry retained for tier assertions. */
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

/** Every rule whose selector list contains this selector, exactly. */
function matching(selector: string): Rule[] {
  return rules.filter(r => r.selectors.includes(selector))
}

function only(selector: string): Rule {
  const hits = matching(selector)
  expect(hits, `${selector} must be declared exactly once`).toHaveLength(1)
  return hits[0]
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  let depth = 0
  let current = ''
  const parts: string[] = []
  for (const ch of body) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ';' && depth === 0) { parts.push(current); current = '' }
    else current += ch
  }
  parts.push(current)
  for (const part of parts) {
    const colon = part.indexOf(':')
    if (colon >= 0) out.set(part.slice(0, colon).trim(), part.slice(colon + 1).replace(/\s+/g, ' ').trim())
  }
  return out
}

/** The offset at which a selector's rule body starts, for source-order checks. */
function orderOf(selector: string): number {
  const at = clean.indexOf(selector)
  expect(at, `${selector} must appear in the stylesheet`).toBeGreaterThan(-1)
  return at
}

// ── The component corpus ────────────────────────────────────────────────────

const srcRoot = new URL('../', import.meta.url)

function listFiles(dir: URL, ext: string[]): URL[] {
  const out: URL[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) out.push(...listFiles(child, ext))
    else if (ext.some(e => entry.name.endsWith(e)) && !entry.name.includes('.test.')) out.push(child)
  }
  return out
}

const sourceFiles = listFiles(srcRoot, ['.tsx', '.ts'])
/**
 * Comments blanked to spaces of EQUAL LENGTH, for the same reason the stylesheet
 * is: several of these files explain the classes this guard counts, so a raw
 * scan would count the prose describing an opt-in as an opt-in.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length))
}

const sources = sourceFiles.map(url => ({
  name: url.pathname.split('/src/')[1],
  text: stripComments(readFileSync(url, 'utf8')),
  raw: readFileSync(url, 'utf8'),
}))

describe('Register A: the standalone filter pill', () => {
  it('declares the family geometry once, as a MINIMUM height', () => {
    // `min-height`, not `height`, and the difference is load-bearing rather than
    // stylistic: a fixed height is exactly what forced the Breeding Codes filter
    // pill to override it with `height: auto !important` in the phone tier, and a
    // register that moved back to a fixed height would make that override
    // load-bearing again and reopen the clipping it was written for.
    const pill = declarations(only('.sr-pill').body)
    expect(only('.sr-pill').ancestors, 'the register applies at every width').toEqual([])
    expect(pill.get('min-height')).toBe('30px')
    expect(pill.has('height')).toBe(false)
    expect(pill.get('border-radius')).toBe('15px')
    expect(pill.get('font-size')).toBe('0.75rem')
    expect(pill.get('font-weight')).toBe('500')
    expect(pill.get('padding')).toBe('0 12px')
  })

  it('takes border, background AND transition together', () => {
    // v1.0.18, the mechanism this whole pass runs on: a class taking over inline
    // chrome must take all three. An inline `transition` left on a call site is
    // specificity 1,0,0 and silently beats the class rule, so the hover colours
    // land with no motion and nothing goes red.
    const pill = declarations(only('.sr-pill').body)
    expect(pill.get('border')).toBe('1.5px solid var(--sr-border)')
    expect(pill.get('background')).toBe('var(--sr-surface)')
    expect(pill.get('transition')).toMatch(/\b120ms ease-out\b/)
    // The properties that fade are colours only. `all` would animate layout too,
    // and a transform would make `transform-origin` meaningful on a control that
    // deliberately has no origin-aware motion.
    expect(pill.get('transition')).not.toMatch(/\ball\b|transform/)
    for (const property of ['background-color', 'border-color', 'color']) {
      expect(pill.get('transition')).toContain(property)
    }
  })

  it('gates hover so an inert control never lights up as operable', () => {
    // `.sr-toggle`'s rule, copied deliberately. A pill showing a not-allowed
    // cursor that still brightens under the pointer reads as operable, which is
    // the thing its disabled state exists to deny.
    const hover = matching('.sr-pill:not(:disabled):not([aria-disabled="true"]):hover')
    expect(hover, 'the hover rule must carry both inert gates').toHaveLength(1)
    const disabled = declarations(only('.sr-pill:disabled').body)
    expect(disabled.get('cursor')).toBe('not-allowed')
    expect(disabled.get('color')).toBe('var(--sr-text-disabled)')
  })

  it('declares every selected state AFTER hover, so the selection wins', () => {
    // Equal specificity, so source order decides. Declared before `:hover`, a
    // pressed pill would revert to the hover colours under the pointer — visible
    // only while hovering, which is why this is asserted rather than eyeballed.
    // The `.sr-map-fab` / `.sr-hotspot-mode-pill` convention.
    const hover = orderOf('.sr-pill:not(:disabled)')
    for (const selected of [
      '.sr-pill[aria-pressed="true"]',
      '.sr-pill[data-state="negative"]',
      '.sr-pill[data-state="target"]',
      '.sr-pill[data-tier="1"][aria-pressed="true"]',
    ]) {
      expect(orderOf(selected), `${selected} must follow the hover rule`).toBeGreaterThan(hover)
    }
  })

  it('carries the two selected-state carriers in ONE declaration', () => {
    // The register serves controls that expose `aria-pressed` and controls that
    // do not (adding it would be an ARIA change this pass holds fixed). Two rules
    // holding two copies of the same colours can drift; one cannot.
    const hits = matching('.sr-pill[aria-pressed="true"]')
    expect(hits).toHaveLength(1)
    expect(hits[0].selectors).toContain('.sr-pill[data-state="positive"]')
  })

  it('keeps every colour on a token, in both themes', () => {
    // The standing rule, and the register is where it is cheapest to break: one
    // literal here would land on 28 controls at once.
    for (const selector of rules.filter(r => r.selectors.some(sel => sel.startsWith('.sr-pill') || sel.startsWith('.sr-segbar')))) {
      expect(selector.body, `${selector.selectors.join(', ')} must use only tokens`)
        .not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(/)
      for (const m of selector.body.matchAll(/rgba\(([^)]*)\)/g)) {
        expect(m[1], 'an rgba() must take its triplet from a token').toMatch(/var\(--sr-/)
      }
    }
  })

  it('keeps the Breeding Codes tier tints as shipped, not flattened to one pair', () => {
    // The register introduces NO new colour pairing, and that claim is only true
    // while these stay at their shipped alphas: the pale tier-1 tint needs
    // 0.15/0.5 to read at all and the darker tiers carry 0.08/0.3. Flattening
    // them to one pair (which an earlier draft of the spec wrote) would mint four
    // unmeasured pairings in a build that promised none.
    const tier1 = declarations(only('.sr-pill[data-tier="1"][aria-pressed="true"]').body)
    expect(tier1.get('background')).toBe('rgba(var(--sr-tier-1-rgb), 0.15)')
    expect(tier1.get('border-color')).toBe('rgba(var(--sr-tier-1-rgb), 0.5)')
    for (const tier of [2, 3, 4]) {
      const d = declarations(only(`.sr-pill[data-tier="${tier}"][aria-pressed="true"]`).body)
      expect(d.get('background')).toBe(`rgba(var(--sr-tier-${tier}-rgb), 0.08)`)
      expect(d.get('border-color')).toBe(`rgba(var(--sr-tier-${tier}-rgb), 0.3)`)
      expect(d.get('color')).toBe(`var(--sr-tier-${tier}-fg)`)
    }
    // The one shipped cross-case: the "Possible" CATEGORY pill sits on the tier-1
    // tint and takes tier-2's foreground, the token measured against that tint.
    // It must follow the tier-1 rule or it is overridden by it.
    const cross = only('.sr-pill[data-tier="1"][data-tier-fg="2"][aria-pressed="true"]')
    expect(declarations(cross.body).get('color')).toBe('var(--sr-tier-2-fg)')
    expect(orderOf('.sr-pill[data-tier="1"][data-tier-fg="2"]'))
      .toBeGreaterThan(orderOf('.sr-pill[data-tier="1"][aria-pressed="true"]'))
  })
})

describe('Register B: the segmented group', () => {
  it('puts the edge on the shell and none on the options', () => {
    // The structural finding the two registers exist for: a segment has no radius
    // and no outer border of its own, and giving it one breaks the group it
    // belongs to. The shell clips; the option is chromeless.
    const shell = declarations(only('.sr-segbar').body)
    expect(shell.get('border')).toBe('1.5px solid var(--sr-accent-border)')
    expect(shell.get('border-radius')).toBe('15px')
    expect(shell.get('overflow')).toBe('hidden')
    const option = declarations(only('.sr-segbar-btn').body)
    expect(option.get('border')).toBe('none')
    expect(option.has('border-radius')).toBe(false)
    expect(option.get('background')).toBe('transparent')
  })

  it('shares height, type and motion with the pill, differing only at the edge', () => {
    // What keeps the two shapes reading as one family. If these drift, the app
    // has two registers rather than one family in two shapes.
    const pill = declarations(only('.sr-pill').body)
    const option = declarations(only('.sr-segbar-btn').body)
    for (const property of ['min-height', 'padding', 'font-size', 'font-weight', 'gap']) {
      expect(option.get(property), `${property} must match the pill`).toBe(pill.get(property))
    }
    expect(option.get('transition')).toMatch(/\b120ms ease-out\b/)
    expect(declarations(only('.sr-segbar-btn[aria-pressed="true"]').body).get('font-weight')).toBe('600')
  })

  it('draws its divider on the leading edge of each SIBLING', () => {
    // Rejects a divider on every option, which doubles the shell's own border at
    // the ends, and a trailing-edge divider, which draws a stray rule on a
    // one-option group.
    const divider = only('.sr-segbar-btn + .sr-segbar-btn')
    expect(declarations(divider.body).get('border-left')).toBe('1.5px solid var(--sr-accent-border)')
  })

  it('insets its focus ring so the shell cannot clip it', () => {
    // The one register-local focus declaration in the pass. `overflow: hidden` on
    // the shell cuts an outside ring off, and a segment whose focus is invisible
    // is a keyboard trap in appearance if not in fact. The pill deliberately has
    // no focus rule at all and rides the global one unchanged.
    expect(declarations(only('.sr-segbar-btn:focus-visible').body).get('outline-offset')).toBe('-3px')
    expect(matching('.sr-pill:focus-visible'), 'the pill must not fork the global ring').toHaveLength(0)
  })

  it('never collides with SegControl, which is a different register', () => {
    // `.sr-seg` / `.sr-seg-btn` are shipped class names on the Calendar's
    // SegControl, which this pass leaves alone. A rule that matched both would
    // land on that control PARTIALLY -- its inline padding, size, border and
    // background would beat the class while the pressed and hover rules would not
    // -- which is the half-moved-chrome trap by another route.
    for (const rule of rules) {
      for (const selector of rule.selectors) {
        if (!/\bsr-segbar\b/.test(selector)) continue
        expect(selector, `${selector} must not also match SegControl`).not.toMatch(/\.sr-seg\b|\.sr-seg-btn\b/)
      }
    }
  })
})

describe('the register replaced the duplicated helpers, and no call site kept its chrome', () => {
  it('leaves no component defining ghostBtn or sortBtn', () => {
    // The two private style helpers the pass retires. `ghostBtn` had two
    // byte-identical copies and `sortBtn` two that had ALREADY drifted by one
    // declaration, which is the failure a shared register exists to prevent.
    const offenders = sources
      .filter(f => /\b(?:function|const)\s+(?:ghostBtn|sortBtn)\b/.test(f.text))
      .map(f => f.name)
    expect(offenders).toEqual([])
  })

  it('keeps inline chrome off every register call site', () => {
    // The v1.0.18 rule enforced at the call sites rather than trusted: a
    // left-behind inline `transition`, `border` or `background` is specificity
    // 1,0,0 and silently beats the register, so the site keeps its old look and
    // nothing goes red. Read out of the register element's OWN opening tag.
    //
    // Linearity, since this scans source text: the scan is a single pass over
    // each file's opening tags with a bounded, non-backtracking body. Each tag is
    // visited once, each tag's style text is tested by a fixed set of anchored
    // property patterns, and no pattern is applied to a substring of another
    // tag's text -- so the work is linear in total source length and independent
    // of how many register call sites a file holds.
    const banned: [string, RegExp][] = [
      ['border', /(?:^|[{,\s])border:\s*/],
      ['background', /(?:^|[{,\s])background:\s*/],
      ['borderRadius', /(?:^|[{,\s])borderRadius:\s*/],
      ['height', /(?:^|[{,\s])height:\s*/],
      ['fontSize', /(?:^|[{,\s])fontSize:\s*/],
      ['transition', /(?:^|[{,\s])transition:\s*/],
    ]
    const offenders: string[] = []
    let sitesSeen = 0
    for (const file of sources) {
      for (const m of file.text.matchAll(/<[A-Za-z][A-Za-z0-9.]*\b[^<>]*>/g)) {
        const tag = m[0]
        if (!/className="[^"]*\b(?:sr-pill|sr-segbar-btn)\b[^"]*"/.test(tag)) continue
        sitesSeen++
        const style = /style=\{\{([\s\S]*?)\}\}/.exec(tag)?.[1] ?? ''
        for (const [name, pattern] of banned) {
          if (pattern.test(style)) offenders.push(`${file.name}: inline ${name} on a register call site`)
        }
      }
    }
    // Never vacuous: a scan that found no call sites would pass while the whole
    // pass had been reverted.
    expect(sitesSeen, 'the register must actually be in use').toBeGreaterThan(10)
    expect(offenders).toEqual([])
  })

  it('leaves no inline transition on a control the register now animates', () => {
    // The five declaration sites the pass sweeps, asserted by their absence in
    // the four files that carried a pill-family one. The chevron rotations in
    // SpeciesDetail are `transform` and are deliberately untouched; the Settings
    // colour-scheme rows are a radio register this pass does not adopt, so theirs
    // stay with the chrome they belong to.
    for (const name of ['components/ListComparer.tsx', 'components/SpeciesDetail.tsx']) {
      const file = sources.find(f => f.name === name)!
      expect(file.text, `${name} must keep no inline pill transition`)
        .not.toMatch(/transition:\s*'(?:all|background)\s/)
    }
  })
})

describe('the clamp repair and the label floor reached their call sites', () => {
  it('declares the floor and the optical factor once, on the root', () => {
    // One number, one place. The iOS focus-zoom threshold is an absolute px
    // value; the optical factor is the only reason a label is ever set smaller
    // than its control. A second copy of either is how they drift.
    const roots = rules.filter(r => r.selectors.includes(':root') || r.selectors.some(s => s.endsWith(':root')))
    const floors = roots.map(r => declarations(r.body).get('--sr-ctl-floor')).filter(Boolean)
    const opticals = roots.map(r => declarations(r.body).get('--sr-label-optical')).filter(Boolean)
    expect(floors).toEqual(['16px'])
    expect(opticals).toEqual(['calc(11 / 12)'])
  })

  it('gives every control the repair is FOR its own register', () => {
    // The repair is only real where the property is declared. These are the
    // controls the spec measured as being cut down at 200% text scale; a control
    // that lost its declaration is silently back on the replacement, rendering
    // below its own declared size with nothing going red.
    const expected: [string, string][] = [
      ['globals.css', '1rem'],                                  // the command palette's hero search
      ['App.tsx', '0.875rem'],                                  // the checklist lookup field
      ['components/SpeciesCombobox.tsx', 'fontSize'],           // md / panel / sm, derived once
      ['components/WeatherForecastPanel.tsx', '0.84375rem'],    // the five forecast inputs
      ['lib/mapExplorerFormat.ts', '0.8125rem'],                // both Map Explorer selects
      ['components/Checklists.tsx', '0.8125rem'],               // the comment search
      ['components/Calendar.tsx', '0.71875rem'],                // the strip's own register
    ]
    for (const [name, value] of expected) {
      const text = name === 'globals.css' ? css : sources.find(f => f.name === name)!.text
      expect(text, `${name} must declare --sr-ctl-rem`).toContain('--sr-ctl-rem')
      expect(text, `${name} must declare --sr-ctl-rem as ${value}`)
        .toMatch(new RegExp(`--sr-ctl-rem'?\\s*(?:as string\\])?\\]?\\s*:\\s*'?${value.replace('.', '\\.')}`))
    }
  })

  it('opts each of the 24 paired labels in, and no unpaired one', () => {
    // The boundary the spec draws, and the reason it is a boundary: a label with
    // no floored control beside it is not broken, it renders exactly as designed,
    // so flooring its register globally would enlarge labels across two dozen
    // files where nothing is wrong. Membership is declared, never inferred.
    //
    // 22 -> 24 at county-date-filter-mobile, deliberately: the shared date pair
    // (components/ui/DateRangeFields.tsx) draws a visible "From" and "To" word
    // beside each floored date input on phones, written once there and rendered
    // on all five surfaces that use it. No per-surface count moved.
    const counts = new Map<string, number>()
    for (const file of sources) {
      // Counted as a class TOKEN anywhere in the file's code, not through one
      // `className=` spelling: the shared sidebar label opts in through a
      // conditional expression, and a pattern anchored to a quoted attribute
      // silently reports that file as carrying none.
      const n = [...file.text.matchAll(/\bsr-ctl-label\b/g)].length
      if (n) counts.set(file.name, n)
    }
    expect(Object.fromEntries([...counts].sort())).toEqual({
      'App.tsx': 1,                                     // the checklist field's own <label>
      'components/Calendar.tsx': 4,                     // the uppercase strip labels
      'components/Checklists.tsx': 4,                   // the three filter rows plus Effort
      'components/NamedBirdRangeControl.tsx': 1,
      'components/WeatherForecastPanel.tsx': 5,
      'components/map/HotspotModeControl.tsx': 1,       // Time window; Color pins by opts in via SidebarLabel
      'components/map/MapSidebarUI.tsx': 1,             // SidebarLabel's own opt-in, used 5 + 1 times
      'components/ui/DateRangeFields.tsx': 2,           // the From and To words inside the date pair
    })
    // The opt-in prop, counted where it is PASSED rather than where it is read.
    const mapExplorer = sources.find(f => f.name === 'components/MapExplorer.tsx')!
    expect([...mapExplorer.text.matchAll(/<SidebarLabel ctlRem=/g)]).toHaveLength(5)
    const hotspot = sources.find(f => f.name === 'components/map/HotspotModeControl.tsx')!
    expect([...hotspot.text.matchAll(/<SidebarLabel ctlRem=/g)]).toHaveLength(1)
  })

  it('gives the Checklists companion width its own hook, not the shared one', () => {
    // v0.5.82: a phone-tier size guard that makes a row stop FITTING needs a
    // companion layout rule, in the same tier, scoped to the feature's subtree.
    // Scoped through `.sr-ctl-row` instead, its `min-width` would reach four
    // other filter surfaces and redden the Breeding Codes containment guard.
    const phone = matching('.sr-chk-row-label').filter(r => r.ancestors.includes('@media (max-width: 640px)'))
    expect(phone, 'the companion rule must be phone-tier').toHaveLength(1)
    const d = declarations(phone[0].body)
    expect(d.get('width')).toBe('auto')
    expect(d.get('min-width')).toBe('72px')
    const base = matching('.sr-chk-row-label').filter(r => r.ancestors.length === 0)
    expect(declarations(base[0].body).get('width'), 'desktop keeps the shipped box').toBe('72px')

    // The Effort row's shrink-wrapping variant. Its `min-width` release belongs
    // in the PHONE TIER only: the inline value this class replaced declared no
    // `min-width` at all, so a base declaration would change a computed style on
    // desktop (`auto` to `0px`) for no rendered reason, and a record claiming the
    // labels are byte-identical there would be wrong by exactly one declaration.
    // The only minimum that needs releasing is the one the phone tier itself
    // introduces.
    const autoBase = matching('.sr-chk-row-label.sr-chk-row-label--auto').filter(r => r.ancestors.length === 0)
    expect(autoBase, 'the shrink-wrap variant must exist').toHaveLength(1)
    expect(declarations(autoBase[0].body).get('width')).toBe('auto')
    expect(declarations(autoBase[0].body).has('min-width'), 'desktop declares no minimum').toBe(false)
    const autoPhone = matching('.sr-chk-row-label.sr-chk-row-label--auto')
      .filter(r => r.ancestors.includes('@media (max-width: 640px)'))
    expect(autoPhone, 'the phone tier must release its own minimum').toHaveLength(1)
    expect(declarations(autoPhone[0].body).get('min-width')).toBe('0')
  })
})
