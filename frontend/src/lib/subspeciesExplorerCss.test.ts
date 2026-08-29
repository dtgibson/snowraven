// Structural guard for the Subspecies Explorer entry-control overflow fix
// (QA-27). jsdom computes neither flex min-content nor media queries, so — per
// the house pattern in breedingCodeFilterRowCss.test.ts — this file parses the
// REAL stylesheet, retaining at-rule ancestry, and pairs it with source
// assertions for the component hooks. The geometry itself was settled in a
// browser against the built CSS (testing.md): at 320px viewport / 200% in-app
// text scale, the app's 272px content column, the unwrappable single flex
// line's min-content (tile + longest label word + longest count word + caret +
// gaps + padding) measured 286.5px — 14.5px past the content box, both themes
// — and 0px after the phone-tier wrap; every width from 375px up at 100% keeps
// the single-line 34px chip.
//
// Exact selectors are deliberate (the rename/narrowing traps in testing.md);
// the phone-only ancestry is asserted because desktop must keep the approved
// single-line geometry byte-for-byte, exactly as the Breeding Codes pill
// repair does. Mutation-verified red-first: deleting the tier rule, renaming
// its selector, lifting it out of the media block, and dropping either
// load-bearing declaration each fail below.
/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const source = readFileSync(new URL('../components/speciesDetail/SubspeciesExplorer.tsx', import.meta.url), 'utf8')
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

/** All style rules, retaining the exact at-rule ancestry for tier assertions.
 *  (Local walker, same as breedingCodeFilterRowCss.test.ts: parseTopLevelRules
 *  deliberately skips at-rule blocks whole, so it cannot answer a tier
 *  question — the carve-out in testing.md.) */
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

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of body.split(';')) {
    const colon = part.indexOf(':')
    if (colon >= 0) out.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim())
  }
  return out
}

const toggleRules = rules.filter(r => r.selectors.includes('.sr-ssx-toggle'))

describe('Subspecies Explorer entry-control overflow containment (QA-27)', () => {
  it('the phone tier lets the control content wrap, with the width cap that makes it bind', () => {
    const tier = toggleRules.filter(r => r.ancestors.length > 0)
    expect(tier, 'exactly one at-rule-nested .sr-ssx-toggle rule').toHaveLength(1)
    // Phone-only: desktop keeps the approved single-line chip byte-for-byte.
    expect(tier[0].ancestors).toEqual([phone])
    // The repair is scoped to this control alone — never broadened onto a
    // shared hook (the primary regression this guard must reject).
    expect(tier[0].selectors).toEqual(['.sr-ssx-toggle'])

    const decls = declarations(tier[0].body)
    // flex-wrap turns the line's min-content from the SUM of the unwrappable
    // items (286.5px measured) into the largest single item (~127px)…
    expect(decls.get('flex-wrap')).toBe('wrap')
    // …and the cap is what makes a responsive class bind (v0.5.82: adding a
    // responsive class is not evidence the layout responds).
    expect(decls.get('max-width')).toBe('100%')
  })

  it('the base rule stays a flex container the tier rule can act on, and never clips instead', () => {
    const base = toggleRules.filter(r => r.ancestors.length === 0)
    expect(base, 'exactly one top-level .sr-ssx-toggle rule').toHaveLength(1)
    const decls = declarations(base[0].body)
    // flex-wrap is inert on a non-flex box; if the display ever changes, the
    // tier repair silently dies with every declaration still present.
    expect(decls.get('display')).toBe('inline-flex')
    // A clipping "fix" would hide the label instead of containing it.
    for (const r of toggleRules) {
      const d = declarations(r.body)
      expect(d.has('overflow')).toBe(false)
      expect(d.has('text-overflow')).toBe(false)
      expect(d.get('white-space')).toBeUndefined()
    }
  })

  it('the component carries both hooks the repair is calibrated to', () => {
    // The control button itself…
    expect(source).toMatch(/className="sr-ssx-toggle"/)
    // …inside the shared control-row hook whose phone rule creates the 24px
    // text pressure the wrap absorbs (max(16px, 0.75rem) at 200% scale). If
    // the wrapper class goes, the fix's premise changes and this must be
    // re-measured, not silently kept green.
    expect(source).toMatch(/className="sr-ctl-row"/)
    // The count stays rendered — dropping content is not the fix that shipped.
    expect(source).toMatch(/className="sr-ssx-count"/)
  })
})
