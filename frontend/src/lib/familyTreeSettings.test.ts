// The Family Tree tab's three remembered choices (family-rollups-and-tree
// schema 8.3; QA-51's lib half, QA-90): each validator with malformed, unknown
// and prototype-member inputs written through `JSON.parse` (security.md: an
// object literal cannot carry an own `__proto__`), and the first-use view at
// both tier values.

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_NAMES, FAMILY_TREE_NAMES_SETTING, FAMILY_TREE_REGION_SETTING, FAMILY_TREE_VIEW_SETTING,
  defaultViewFor, parseStoredNames, parseStoredRegion, parseStoredView,
} from './familyTreeSettings'
import { LIFE_LISTS_REGION_SETTING } from './lifeListsRegion'

const HOSTILE = [
  null, undefined, '', 0, 1, true, [], {}, 'Both', 'BOTH', ' both', 'tree', 'table', 'constructor', '__proto__', 'toString',
  JSON.parse('{"__proto__": "both"}'), JSON.parse('{"constructor": "rollup"}'), JSON.parse('["diagram"]'),
]

describe('the three keys', () => {
  it('are distinct, and distinct from Life Lists\' region key (Open Question 16)', () => {
    const keys = [FAMILY_TREE_REGION_SETTING, FAMILY_TREE_VIEW_SETTING, FAMILY_TREE_NAMES_SETTING, LIFE_LISTS_REGION_SETTING]
    expect(new Set(keys).size).toBe(4)
  })
})

describe('parseStoredView', () => {
  it('accepts exactly the two stored values', () => {
    expect(parseStoredView('rollup')).toBe('rollup')
    expect(parseStoredView('diagram')).toBe('diagram')
  })
  it('reads anything else as nothing saved', () => {
    for (const v of HOSTILE) expect(parseStoredView(v), JSON.stringify(v)).toBeNull()
  })
})

describe('parseStoredNames', () => {
  it('accepts exactly the three stored values', () => {
    for (const v of ['common', 'scientific', 'both'] as const) expect(parseStoredNames(v)).toBe(v)
  })
  it('reads anything else as Both', () => {
    expect(DEFAULT_NAMES).toBe('both')
    for (const v of HOSTILE) expect(parseStoredNames(v), JSON.stringify(v)).toBe('both')
  })
})

describe('parseStoredRegion (Life Lists\' validator, its own key)', () => {
  it('accepts the shapes the app writes and refuses prototype-member objects', () => {
    expect(parseStoredRegion({ level: 'state', code: 'US-CA' })).toEqual({ level: 'state', code: 'US-CA' })
    expect(parseStoredRegion(JSON.parse('{"__proto__": {"level": "state", "code": "US-CA"}}'))).toBeNull()
    for (const v of HOSTILE) expect(parseStoredRegion(v), JSON.stringify(v)).toBeNull()
  })
})

describe('the first-use view (FR-53, D-35)', () => {
  it('is the table at or under the still tier and the tree above it', () => {
    expect(defaultViewFor(true)).toBe('rollup')
    expect(defaultViewFor(false)).toBe('diagram')
  })
})
