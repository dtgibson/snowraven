// GENERATED CORPORA for the two twinned predicates (ios-alerts, schema.md 8.3;
// testing.md: a fixture can only report on its own rows, so diff the
// predicates over a generated corpus, in BOTH directions).
//
// 1. Countability: every single-position edit (replace, insert, delete of one
//    UTF-16 unit over a 96-unit alphabet) of a name built to sit on the rule's
//    edges, through the parameterized twin (the Swift shape) and the app's own
//    `isNonCountableForm`. The two directions are counted separately and both
//    must be zero; the Swift twin is held to the same verdict string by the
//    fixture's `countability.corpus` family on the release machine.
// 2. The alert link: every single-position edit of a valid alert link through
//    the parser. Whatever it accepts must be in range, carry in-pattern ids and
//    survive build-then-parse to the same value; the count of accepted edits is
//    asserted non-zero so the check cannot pass on a parser that refuses all.
import { describe, it, expect } from 'vitest'
import { corpusNames, CORPUS_ALPHABET } from './alertRules.fixtureInputs'
import { isNonCountableWith } from './alertRules'
import { EBIRD_COUNTABLE_EXCEPTIONS, EBIRD_NONCOUNTABLE_EXCEPTIONS, isNonCountableForm } from '../speciesUtils'
import { buildWidgetLink, isAlertLink, isLinkableBird, parseWidgetLink } from '../links/deepLink'

describe('the countability twin over the single-position-edit corpus', () => {
  it('agrees with the app rule in both directions, over thousands of edits that do flip the verdict', () => {
    const rejects = new Set(EBIRD_NONCOUNTABLE_EXCEPTIONS)
    const counts = new Set(EBIRD_COUNTABLE_EXCEPTIONS)
    const names = corpusNames()
    let twinOnly = 0
    let appOnly = 0
    let flagged = 0
    for (const n of names) {
      const a = isNonCountableForm(n)
      const b = isNonCountableWith(n, rejects, counts)
      if (a) flagged++
      if (b && !a) twinOnly++
      if (a && !b) appOnly++
    }
    expect({ twinOnly, appOnly }).toEqual({ twinOnly: 0, appOnly: 0 })
    // Non-vacuity: the corpus reaches both verdicts in quantity.
    expect(names.length).toBe(8202)
    expect(flagged).toBeGreaterThan(100)
    expect(names.length - flagged).toBeGreaterThan(1000)
    expect(CORPUS_ALPHABET.length).toBe(96)
  })
})

describe('the alert link parser over the single-position-edit corpus', () => {
  const BASE = 'snowraven://map/lifers?window=day&lat=38.54490&lng=-121.74050&r=25&sp=ruff&loc=L1000001&show=all'
  const alphabet = (() => {
    let a = ''
    for (let c = 0x20; c <= 0x7e; c++) a += String.fromCharCode(c)
    return a + 'é\n'
  })()

  it('accepts only in-range, in-pattern links that survive build-then-parse, and refuses the rest whole', () => {
    const edits: string[] = []
    for (let i = 0; i < BASE.length; i++) for (const c of alphabet) edits.push(BASE.slice(0, i) + c + BASE.slice(i + 1))
    for (let i = 0; i <= BASE.length; i++) for (const c of alphabet) edits.push(BASE.slice(0, i) + c + BASE.slice(i))
    for (let i = 0; i < BASE.length; i++) edits.push(BASE.slice(0, i) + BASE.slice(i + 1))
    let accepted = 0
    let degradedOrView = 0
    for (const s of edits) {
      const got = parseWidgetLink(s)
      if (got === null) continue
      if (!isAlertLink(got)) { degradedOrView++; continue }
      accepted++
      expect(got.point.lat >= -90 && got.point.lat <= 90, s).toBe(true)
      expect(got.point.lng >= -180 && got.point.lng <= 180, s).toBe(true)
      expect(Number.isInteger(got.radiusMi) && got.radiusMi >= 1 && got.radiusMi <= 25, s).toBe(true)
      expect(isLinkableBird(got.bird), s).toBe(true)
      expect(parseWidgetLink(buildWidgetLink(got)), s).toEqual(got)
    }
    expect(accepted).toBeGreaterThan(500)
    // An edit that breaks the alert form never lands on a widget VIEW link:
    // its head is not one of the fifteen, so it is refused whole.
    expect(degradedOrView).toBe(0)
  })
})
