// The published privacy-policy clause about how long a hotspot's Recent
// activity answer is kept (ebird-request-economy, held item 3, OFFERED), held
// to the code. Installed only if the user took item 3 at the 1.0.66 gate.
//
// WHY THIS FILE EXISTS. The eBird bullet said "bounded and cached on your
// device for six hours", which reads as a retention of six hours. Six hours is
// the REUSE window (`HOTSPOT_ACTIVITY_TTL_MS`); the answers stay on the device
// past it, and this store is deliberately NOT on the Clear path
// (`clearDerived.ts` excludes it, because its keys come from public eBird
// hotspot ids, not from the user's file). So the clause says "kept on your
// device and reused for six hours", with no "until you clear", and this file
// checks both halves against the code: the hours built FROM the constant, and
// the store's absence from the Clear registry.
//
// Shape: `hotspotSharePublishedClaims.test.ts`'s, scoped to the eBird bullet's
// own clause, existence asserted before correctness, the two files compared.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HOTSPOT_ACTIVITY_STORE_KEY, HOTSPOT_ACTIVITY_TTL_MS } from './hotspotActivityCache'
import { registeredTeardowns } from './clearDerived'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const POLICY_MD = read('PRIVACY_POLICY.md')
const POLICY_HTML = read('website/privacy.html')

/** The clause's opening words, identical in both files. */
const CLAUSE_LEAD = 'one request per hotspot, bounded, with each answer kept on your device and reused for'
/** The wording it replaced, which must not come back. */
const RETIRED = 'bounded and cached on your device for'

const HOUR_MS = 60 * 60 * 1000
/** Hours spelled the way the policy writes small numbers. */
const WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 6: 'six', 12: 'twelve', 24: 'twenty-four' }

describe('the Recent activity answers\' retention clause', () => {
  it('the TTL is a whole number of hours the policy can spell', () => {
    const hours = HOTSPOT_ACTIVITY_TTL_MS / HOUR_MS
    expect(Number.isInteger(hours)).toBe(true)
    expect(Object.hasOwn(WORDS, hours), `${hours} hours`).toBe(true)
  })

  it('no "until you clear": the store is not on the Clear path, so the clause promises no removal', () => {
    expect(registeredTeardowns('ebird')).not.toContain(HOTSPOT_ACTIVITY_STORE_KEY)
    expect(registeredTeardowns('ml')).not.toContain(HOTSPOT_ACTIVITY_STORE_KEY)
  })

  for (const [name, text] of [['PRIVACY_POLICY.md', POLICY_MD], ['website/privacy.html', POLICY_HTML]] as const) {
    it(`${name}: the clause exists and states the reuse window from the constant`, () => {
      const hours = WORDS[HOTSPOT_ACTIVITY_TTL_MS / HOUR_MS]
      expect(text).toContain(`${CLAUSE_LEAD} ${hours} hours)`)
      expect(text.includes(RETIRED)).toBe(false)
    })
  }
})
