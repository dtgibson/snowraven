// @vitest-environment jsdom
//
// The species-code roster under jsdom (species-code-search, QA-49): the same
// rows `alphaCodeSearch.test.ts` runs in node, here loaded through the app's
// own lazy loader rather than read from disk, so "the same answers in every
// environment" is one roster run twice rather than two rosters that agree.
import { describe, it, expect, beforeAll } from 'vitest'
import { loadAlphaCodes } from './alphaCodesAsset'
import type { AlphaCodeTable } from './alphaCodes'
import { ROSTER, pickerExpectation, pickerRows, searchRows, speciesIndexOf, speciesOf } from '../test/alphaCodeRoster'

let table: AlphaCodeTable | null = null
beforeAll(async () => { table = await loadAlphaCodes() })

describe('the roster under jsdom, through the real loader (QA-49)', () => {
  it('the loader delivered the committed table', () => {
    expect(table?.codes['american robin']).toBe('AMRO')
  })

  it.each(ROSTER.map(r => [r.id, r] as const))('%s', (_id, row) => {
    expect(speciesOf(searchRows(table, row.fixture, row.query)), 'Search').toEqual([...row.code, ...row.name])
    expect(pickerRows(table, speciesIndexOf(row.fixture), row.query), 'picker').toEqual(pickerExpectation(row))
  })
})
