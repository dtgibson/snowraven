// The Days in view setting's validated read (D4-15): the four values pass,
// everything else reads as the default, including the prototype-chain names a
// stored document can carry and the shapes a corrupted document can take.
import { describe, it, expect } from 'vitest'
import { asPlanDaysInView, PLAN_DAYS_IN_VIEW_DEFAULT, PLAN_DAYS_IN_VIEW_SETTING, planDaysInViewOptions } from './planDaysInView'

describe('asPlanDaysInView', () => {
  it('accepts exactly the four values', () => {
    for (const v of ['1', '3', '7', 'all']) expect(asPlanDaysInView(v)).toBe(v)
  })

  it('reads anything else as the default, never a throw', () => {
    for (const raw of [null, undefined, '', 'bogus', '2', 1, 3, true, [], {}, 'constructor', '__proto__', 'toString', 'ALL', ' all', 'all\n']) {
      expect(asPlanDaysInView(raw), JSON.stringify(raw)).toBe(PLAN_DAYS_IN_VIEW_DEFAULT)
    }
    expect(asPlanDaysInView(JSON.parse('{"__proto__":{"x":1}}'))).toBe('all')
  })

  it('the setting key and the default are what the spec names', () => {
    expect(PLAN_DAYS_IN_VIEW_SETTING).toBe('planDaysInView')
    expect(PLAN_DAYS_IN_VIEW_DEFAULT).toBe('all')
    expect(planDaysInViewOptions(8).at(-1)).toBe('all')
  })
})
