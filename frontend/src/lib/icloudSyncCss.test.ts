// Stylesheet guards for the iCloud Sync classes (icloud-sync; the ui rules'
// standing checks for new classes). Parses the REAL globals.css, the same
// posture as scrollLeakCss / filterControlSizeCss.
//
// What is pinned:
// - the one new token, --sr-scrim, is defined in BOTH theme blocks;
// - the per-row status region (.sr-sync-line) is never hidden by any rule
//   (display:none / visibility:hidden on a live region is the
//   insert-with-first-message trap), and positively keeps display:flex;
// - the phone-tier declarations sit INSIDE the established ≤640 tier block
//   (the file's first multi-line 640px block, which the offset-question
//   tier guards resolve as "the phone tier");
// - the dialog root's iOS safe-area inset is gated on .sr-ios-app and the
//   ungated base rule carries no env();
// - the dialog and sync-line transitions are ease-out and under 300ms.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const masked = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

interface Rule { selector: string; body: string; offset: number }
function rules(): Rule[] {
  const out: Rule[] = []
  for (const m of masked.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].trim(), body: m[2], offset: m.index! + m[1].search(/\S/) })
  }
  return out
}
const all = rules()

/** Rules whose selector list contains `selector` as an exact member (rightmost compound compared whole). */
function withSubject(selector: string): Rule[] {
  return all.filter(r => r.selector.split(',').map(s => s.trim()).some(s => s === selector))
}

/** Offset range of the ≤640 phone tier block, by brace matching. */
function phoneTier(): { open: number; close: number } {
  const at = masked.indexOf('@media (max-width: 640px) {\n')
  if (at < 0) throw new Error('the ≤640 phone tier block was not found')
  let depth = 0
  for (let i = masked.indexOf('{', at); i < masked.length; i++) {
    if (masked[i] === '{') depth++
    else if (masked[i] === '}') { depth--; if (depth === 0) return { open: at, close: i } }
  }
  throw new Error('unbalanced phone tier block')
}

function tokenBlock(selector: ':root' | '[data-theme="dark"]'): string {
  const start = masked.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`${selector} block not found`)
  return masked.slice(start, masked.indexOf('\n}', start))
}

describe('--sr-scrim (the one new token)', () => {
  it('is defined in both theme blocks, as the app ink at an alpha, never pure black', () => {
    const light = /--sr-scrim:\s*rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/.exec(tokenBlock(':root'))
    const dark = /--sr-scrim:\s*rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/.exec(tokenBlock('[data-theme="dark"]'))
    expect(light).not.toBeNull()
    expect(dark).not.toBeNull()
    expect(light!.slice(1, 4).map(Number)).not.toEqual([0, 0, 0])
    expect(dark!.slice(1, 4).map(Number)).not.toEqual([0, 0, 0])
    expect(Number(light![4])).toBeLessThan(1)
    expect(Number(dark![4])).toBeLessThan(1)
  })

  it('the dialog root consumes it (and no other rule re-inlines a black scrim for it)', () => {
    const root = withSubject('.sr-dlg-root')
    expect(root.length).toBeGreaterThan(0)
    expect(root.some(r => /background:\s*var\(--sr-scrim\)/.test(r.body))).toBe(true)
    for (const r of root) expect(r.body).not.toMatch(/rgba\(0,\s*0,\s*0/)
  })
})

describe('.sr-sync-line is a stable live region', () => {
  it('no rule whose subject is the region sets a hiding display, visibility or content-visibility', () => {
    const subjects = all.filter(r =>
      r.selector.split(',').map(s => s.trim()).some(s => s === '.sr-sync-line' || s.endsWith(' .sr-sync-line') || s.startsWith('.sr-sync-line:') || s.startsWith('.sr-sync-line--')),
    )
    expect(subjects.length).toBeGreaterThan(0) // non-vacuity
    for (const r of subjects) {
      expect(r.body, r.selector).not.toMatch(/display:\s*none/)
      expect(r.body, r.selector).not.toMatch(/visibility:\s*hidden/)
      expect(r.body, r.selector).not.toMatch(/content-visibility/)
    }
  })

  it('positively keeps display:flex and only drops its margin when empty', () => {
    const base = withSubject('.sr-sync-line')
    expect(base.some(r => /display:\s*flex/.test(r.body))).toBe(true)
    const empty = withSubject('.sr-sync-line:empty')
    expect(empty.length).toBe(1)
    expect(empty[0].body.trim()).toBe('margin-top: 0;')
  })

  it('the fade is opacity only (no transform), ease-out and under 300ms', () => {
    const base = withSubject('.sr-sync-line')[0]
    expect(base.body).toMatch(/transition:\s*opacity\s+0\.16s\s+ease-out/)
    const fading = withSubject('.sr-sync-line--fading')[0]
    expect(fading.body).toMatch(/opacity:\s*0/)
    expect(fading.body).not.toMatch(/transform/)
  })
})

describe('phone tier placement (the tier-guard rule)', () => {
  it('every iCloud Sync phone declaration sits inside the established ≤640 block', () => {
    const { open, close } = phoneTier()
    const expected = [
      '.sr-btn-quiet, .sr-btn-accent, .sr-btn-inline',
      '.sr-sync-state',
      '.sr-sync-state svg',
      '.sr-sync-line .sr-btn-inline',
      '.sr-ics-status-row .sr-btn-quiet',
      '.sr-ics-remove-row .sr-btn-quiet',
      '.sr-dlg',
      '.sr-dlg-actions > *',
    ]
    for (const sel of expected) {
      const inTier = all.filter(r => r.selector === sel && r.offset > open && r.offset < close)
      expect(inTier.length, `${sel} must live inside @media (max-width: 640px)`).toBe(1)
    }
    const touch = all.find(r => r.selector === '.sr-btn-quiet, .sr-btn-accent, .sr-btn-inline' && r.offset > open && r.offset < close)!
    expect(touch.body).toMatch(/min-height:\s*2\.75rem/)
    expect(touch.body).toMatch(/white-space:\s*normal/)
    // QA round 1, Failure 2: the state label wraps on a phone (the base rule's
    // nowrap clipped "In iCloud, not downloaded here" at 320px / 200%), and
    // the glyph keeps its no-shrink base rule so it never squeezes.
    const label = all.find(r => r.selector === '.sr-sync-state' && r.offset > open && r.offset < close)!
    expect(label.body).toMatch(/white-space:\s*normal/)
    const glyph = withSubject('.sr-sync-state svg').find(r => r.offset < open)!
    expect(glyph.body).toMatch(/flex-shrink:\s*0/)
  })

  it('no standalone multi-line 640px block was added ahead of the established one', () => {
    const first = masked.indexOf('@media (max-width: 640px) {\n')
    const { open } = phoneTier()
    expect(first).toBe(open)
    // The established block is the one that carries .sr-touch-target's min-height.
    const { close } = phoneTier()
    const touchTarget = all.find(r => r.selector === '.sr-touch-target' && r.offset > open && r.offset < close)
    expect(touchTarget).toBeTruthy()
  })
})

describe('dialog shell', () => {
  it('the base dialog root is ungated and carries no env(); the inset is gated on .sr-ios-app, top edge only', () => {
    const base = withSubject('.sr-dlg-root')
    expect(base.length).toBe(1)
    expect(base[0].body).not.toContain('env(')
    expect(base[0].body).toMatch(/position:\s*fixed/)
    const gated = withSubject('.sr-ios-app .sr-dlg-root')
    expect(gated.length).toBe(1)
    expect(gated[0].body).toMatch(/padding-top:\s*calc\(16px \+ env\(safe-area-inset-top, 0px\)\)/)
    expect(gated[0].body).not.toMatch(/padding-bottom/)
    expect(gated[0].body).not.toMatch(/padding-left|padding-right/)
  })

  it('the panel scales in ease-out under 200ms, with transform-origin left to the component', () => {
    const panel = withSubject('.sr-dlg')[0]
    expect(panel.body).toMatch(/transform:\s*scale\(0\.94\)/)
    expect(panel.body).toMatch(/opacity 0\.16s ease-out, transform 0\.18s cubic-bezier\(0\.2, 0, 0, 1\)/)
    expect(panel.body).not.toMatch(/transform-origin/)
    const open = withSubject('.sr-dlg-root--open .sr-dlg')[0]
    expect(open.body).toMatch(/transform:\s*none/)
  })

  it('no iCloud Sync rule hardcodes a hex or rgb colour', () => {
    const own = all.filter(r => /\.sr-(sync|ics|dlg|btn-quiet|btn-accent|btn-inline|file-line)/.test(r.selector))
    expect(own.length).toBeGreaterThan(20)
    for (const r of own) {
      expect(r.body, r.selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(r.body, r.selector).not.toMatch(/rgba?\(\s*\d/)
    }
  })
})
