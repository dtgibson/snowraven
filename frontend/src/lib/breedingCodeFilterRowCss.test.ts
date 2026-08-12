// Structural guard for the Breeding Codes full-label filter-row overflow fix.
// jsdom cannot compute flex min-content or media queries, so this file parses the
// real stylesheet and pairs it with source assertions for the three dedicated
// hooks. Exact selectors are deliberate: a broad `.sr-ctl-row` repair would alter
// four unrelated surfaces and is the primary regression this guard must reject.
/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const source = readFileSync(new URL('../components/BreedingCodeList.tsx', import.meta.url), 'utf8')
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

/** All style rules, retaining the exact at-rule ancestry for tier assertions. */
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

function unique(selector: string): Rule {
  const hits = rules.filter(r => r.selectors.includes(selector))
  expect(hits, `${selector} must be declared exactly once`).toHaveLength(1)
  expect(hits[0].ancestors, `${selector} must be phone-only`).toEqual([phone])
  return hits[0]
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of body.split(';')) {
    const colon = part.indexOf(':')
    if (colon >= 0) out.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim())
  }
  return out
}

describe('Breeding Codes filter row overflow containment', () => {
  it('releases both flex floors and breaks only the visible full label', () => {
    const row = declarations(unique('.sr-bc-filter-row').body)
    expect(row.get('min-width')).toBe('0')
    expect(row.get('max-width')).toBe('100%')

    const pill = declarations(unique('.sr-bc-filter-row > .sr-bc-filter-pill').body)
    expect(pill.get('height')).toBe('auto !important')
    expect(pill.get('min-height')).toBe('30px')
    expect(pill.get('min-width')).toBe('0')
    expect(pill.get('max-width')).toBe('100%')

    const label = declarations(unique('.sr-bc-filter-row > .sr-bc-filter-pill > .sr-bc-filter-pill-label').body)
    expect(label.get('min-width')).toBe('0')
    expect(label.get('overflow-wrap')).toBe('break-word')
    expect(label.has('overflow')).toBe(false)
    expect(label.has('text-overflow')).toBe(false)
    expect(label.has('white-space')).toBe(false)
  })

  it('never broadens the repair to the shared control-row hook', () => {
    const layoutProperties = /(?:^|;)\s*(?:min-width|max-width|overflow-wrap|word-break|white-space)\s*:/
    const sharedSubjects = rules.flatMap(r => r.selectors.map(selector => ({ r, selector })))
      .filter(({ selector }) => selector === '.sr-ctl-row' || selector.startsWith('.sr-ctl-row '))
      .filter(({ r }) => layoutProperties.test(r.body))
    expect(sharedSubjects).toEqual([])
  })

  it('puts all three hooks on the intended component and keeps every label visible', () => {
    expect(source).toMatch(/className="sr-ctl-row sr-bc-filter-row"/)
    expect(source).toMatch(/className="sr-bc-filter-pill"/)
    expect(source).toMatch(/className="sr-bc-filter-pill-label"/)
    expect(source).toMatch(/height:\s*30/)
    expect(source).not.toMatch(/minHeight:\s*30/)
    expect(source).not.toMatch(/sr-bc-filter-pill[^\n]*(?:overflow:\s*['"]hidden|textOverflow|whiteSpace:\s*['"]nowrap)/)
  })
})
