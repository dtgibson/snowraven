// Structural guard for the Splits and Lumps chart's two stacking triggers
// (taxonomic-splits-lumps, QA fix 1). jsdom computes neither container queries
// nor layout, so, per the house pattern in weatherRowTierCss.test.ts, this file
// parses the REAL stylesheet with its at-rule ancestry and asserts:
//
//   1. the event is the chart's named inline-size container;
//   2. the container trigger carries BOTH terms: an em term that tracks the text
//      scale (the 641 to ~740px band at 200% text is what failed) and a px floor
//      for 100% text;
//   3. the container block and the <=640 tier hold the SAME .sr-lin-* rules,
//      selector for selector and declaration for declaration, so the two
//      triggers cannot drift into two different stacked layouts.
//
// The geometry itself is a real-engine claim, measured in Chromium and WebKit
// across 320 to 900px at 100, 150 and 200% text as text ink against the card
// (a SectionCard clips, so page scrollWidth cannot see it). Mutation-verified:
// dropping a declaration from either block, dropping either query term, and
// renaming the container each turn a row red.
/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
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

function declarations(body: string): string[] {
  return body.split(';').map(d => d.trim().replace(/\s+/g, ' ')).filter(Boolean).sort()
}

const rules = collect(clean)
const PHONE = '@media (max-width: 640px)'
const isLin = (r: Rule) => r.selectors.every(s => s.startsWith('.sr-lin-'))

/** selector list -> sorted declarations, for the .sr-lin-* rules under one at-rule. */
function block(ancestor: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const r of rules) {
    if (r.ancestors.length !== 1 || r.ancestors[0] !== ancestor || !isLin(r)) continue
    const key = r.selectors.join(', ')
    expect(out.has(key), `${ancestor} states ${key} once`).toBe(false)
    out.set(key, declarations(r.body))
  }
  return out
}

const containerAt = rules.map(r => r.ancestors[0]).find(a => a?.startsWith('@container sr-lin '))

describe('the Splits and Lumps chart stacks on a narrow event as well as a narrow viewport (QA fix 1)', () => {
  it('the event is the chart\'s named inline-size container', () => {
    const event = rules.filter(r => r.ancestors.length === 0 && r.selectors.includes('.sr-lin-event'))
    expect(event).toHaveLength(1)
    const decls = declarations(event[0].body)
    expect(decls).toContain('container-type: inline-size')
    expect(decls).toContain('container-name: sr-lin')
    expect(decls).toContain('position: relative')
  })

  it('the container trigger tracks the text scale AND keeps a px floor', () => {
    expect(containerAt, 'an @container sr-lin block exists').toBeTruthy()
    expect(containerAt).toMatch(/\(max-width: \d+(\.\d+)?em\)/)
    expect(containerAt).toMatch(/\(max-width: \d+px\)/)
    expect(containerAt).toMatch(/ or /)
  })

  it('both triggers hold the identical .sr-lin-* rules, and the set is not vacuous', () => {
    const phone = block(PHONE)
    const container = block(containerAt!)
    expect(phone.size).toBeGreaterThanOrEqual(10)
    expect([...container.keys()].sort()).toEqual([...phone.keys()].sort())
    for (const [sel, decls] of phone) expect(container.get(sel), sel).toEqual(decls)
    // The load-bearing one: the chart becomes a single column.
    expect(container.get('.sr-lin-chart')).toContain('grid-template-columns: minmax(0, 1fr)')
  })
})
