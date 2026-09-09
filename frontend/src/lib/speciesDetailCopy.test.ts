import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checklistFilterSummary } from './speciesDetailCopy'

// Generated from the shipped function across reachable filter-strip states:
// the filtered count is between zero and the selected species' base count.
const TOTALS = [0, 1, 2, 3, 3252]
const CORPUS = TOTALS.flatMap(total => (
  [...new Set([0, 1, Math.max(0, total - 1), total])]
    .filter(showing => showing <= total)
    .map(showing => checklistFilterSummary(showing, total))
))

describe('Species Detail count-bearing copy', () => {
  it('uses the denominator to singularize the checklist noun', () => {
    expect(checklistFilterSummary(1, 1)).toBe('Showing 1 of 1 checklist')
    expect(checklistFilterSummary(0, 1)).toBe('Showing 0 of 1 checklist')
    expect(checklistFilterSummary(1, 2)).toBe('Showing 1 of 2 checklists')
  })

  it('has no count of one followed by a plural noun anywhere in its generated corpus', () => {
    expect(CORPUS).not.toHaveLength(0)
    for (const text of CORPUS) expect(text).not.toMatch(/\b1 checklists\b/)
  })

  it('has no em dash anywhere in its generated corpus', () => {
    for (const text of CORPUS) expect(text).not.toContain('—')
  })

  it('is the component source for the filter-strip sentence', () => {
    const source = readFileSync(new URL('../components/SpeciesDetail.tsx', import.meta.url), 'utf8')
    expect(source).toContain("from '../lib/speciesDetailCopy'")
    expect(source).toContain('checklistFilterSummary(')
    expect(source).not.toContain('`Showing ${')
  })
})
