// THE STRICT DATE PARSE AGAINST THE APP'S, OVER A GENERATED CORPUS
// (ios-lifer-widgets, schema.md section 6.2; testing.md v1.0.32: a fixture can
// only ever report on its own rows, so diff the two predicates over a corpus).
//
// One conforming `obsDt`, every single-position substitution over a 96-character
// alphabet (printable ASCII plus a handful of look-alikes that coercion loves:
// Unicode digits, full-width digits, whitespace and line terminators), every
// single deletion and every single insertion, run through BOTH predicates:
//   * the app's: `isWithinWindow` with an unbounded window and a far-future
//     now, which is true exactly when the app's own parse accepts the date;
//   * the widget's: `parseObsDateStrict`.
// The claim is one-directional and it is the one that matters: the widget
// admits NOTHING the app refuses. The reverse set (the app coerces, the widget
// refuses) is expected to be large and is reported in the message, because
// none of those shapes can leave eBird.
import { describe, it, expect } from 'vitest'
import { isWithinWindow } from '../nearbyLifers'
import { parseObsDateStrict } from './widgetRows'

const SEED = '2026-09-24 06:10'
const ALPHABET = (() => {
  const out: string[] = []
  for (let c = 0x20; c < 0x7f; c++) out.push(String.fromCharCode(c))   // 95 printable ASCII
  out.push('\t')
  return [...out, '\n', '\r', ' ', ' ', '﻿', '٢', '０', '𝟐']
})()

function corpus(seed: string): string[] {
  const out = new Set<string>([seed])
  for (let i = 0; i < seed.length; i++) {
    out.add(seed.slice(0, i) + seed.slice(i + 1))
    for (const ch of ALPHABET) out.add(seed.slice(0, i) + ch + seed.slice(i + 1))
  }
  for (let i = 0; i <= seed.length; i++) for (const ch of ALPHABET) out.add(seed.slice(0, i) + ch + seed.slice(i))
  return [...out]
}

const FAR_FUTURE = Date.UTC(9999, 11, 31)
const appAdmits = (s: string) => isWithinWindow(s, Number.MAX_SAFE_INTEGER, FAR_FUTURE)
const widgetAdmits = (s: string) => parseObsDateStrict(s) !== null

describe('strict obsDt parse vs the app parse, generated corpus', () => {
  it('the widget admits nothing the app refuses, over both seed shapes', { timeout: 20_000 }, () => {
    for (const seed of [SEED, '2026-09-24']) {
      const all = corpus(seed)
      expect(all.length).toBeGreaterThan(1000)
      const widgetOnly = all.filter(s => widgetAdmits(s) && !appAdmits(s))
      const appOnly = all.filter(s => appAdmits(s) && !widgetAdmits(s))
      expect(widgetOnly, `widget-only set must be empty; app-only (declared) size ${appOnly.length} of ${all.length}`).toEqual([])
      // Non-vacuity: both predicates admit the seed, and the declared reverse
      // set really exists (a leading space, a plus sign, a one-digit month).
      expect(widgetAdmits(seed) && appAdmits(seed)).toBe(true)
      expect(appOnly.length).toBeGreaterThan(0)
    }
  })

  it('the named rows of the declaration behave as declared', () => {
    // MEASURED, not taken from the schema's list: two of the schema's examples
    // (a leading space, and a `T` separator) are refused by the app as well,
    // because its parse splits on the first space and then needs three finite
    // parts, so they sit in neither half of the difference.
    for (const s of ['+2026-09-01', '2026-9-1', '2026-09-24\n', '2026-09-01 ', '2026-0x9-01', '2026-09-01e0']) {
      expect(appAdmits(s), s).toBe(true)
      expect(widgetAdmits(s), s).toBe(false)
    }
    for (const s of [' 2026-09-01', '2026-09-01T00:00']) {
      expect(appAdmits(s), s).toBe(false)
      expect(widgetAdmits(s), s).toBe(false)
    }
    // An impossible calendar day: the app rolls it over into a real instant,
    // the widget refuses it ("app row, no widget row", never the reverse).
    expect(appAdmits('2026-02-30')).toBe(true)
    expect(widgetAdmits('2026-02-30')).toBe(false)
    expect(widgetAdmits('2024-02-29')).toBe(true)
  })
})
