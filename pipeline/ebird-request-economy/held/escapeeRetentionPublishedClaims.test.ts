// The published privacy-policy claim about how long the Statistics tab's
// escapee answers are kept (ebird-request-economy, held item 1), held to the
// code.
//
// WHY THIS FILE EXISTS. Until 1.0.66 the policy said "The answer is stored on
// your device for 30 days", which stated the REUSE window as if it were the
// retention: `rebuildSnapshot` counts every ledger entry however old, species
// records never age out, and only a Clear (or the ledger's first-in-first-out
// cap) removes an answer (decisions.md D-04; the v1.0.42 rule that a published
// retention sentence describes what is on disk). No guard pinned that sentence,
// which is how it stayed wrong. The corrected sentence was approved by the user
// and written into both files at the 1.0.66 release commit, with this file.
//
// THE SHAPE IS `hotspotSharePublishedClaims.test.ts`'s: scoped to the policy's
// Statistics sub-bullet (located by its opening words), each claim asserted to
// EXIST before it is checked, the "30 days" built FROM `PROVENANCE_TTL_MS`,
// "until you clear your eBird backup" checked against the Clear registry, and
// the two hand-kept copies compared with each other.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PROVENANCE_STORE_KEY, PROVENANCE_TTL_MS } from './exoticProvenanceCache'
import { registeredTeardowns } from './clearDerived'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const POLICY_MD = read('PRIVACY_POLICY.md')
const POLICY_HTML = read('website/privacy.html')

/** The opening words of the Statistics sub-bullet, identical in both files. */
const STATS_LEAD = 'The Statistics tab also asks eBird about a set of your own checklists'
/** The sentence the retention sentence follows, already published. */
const HISTORY_END = 'not your whole history.'
/** The 1.0.66 retention sentence's lead (held-copy.md, privacy item 1). */
const RETENTION_LEAD = 'Each answer is kept on your device until you clear your eBird backup,'
/** The sentence it replaced, which must not come back. */
const RETIRED = 'The answer is stored on your device for'

const DAY_MS = 24 * 60 * 60 * 1000

function mdProse(md: string): string {
  return md.replace(/\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
}

function htmlProse(html: string): string {
  return html.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
}

function mdItem(lead: string): string {
  const i = POLICY_MD.indexOf(lead)
  expect(i, `PRIVACY_POLICY.md has the bullet beginning "${lead}"`).toBeGreaterThan(-1)
  const end = POLICY_MD.indexOf('\n', i)
  return mdProse(POLICY_MD.slice(i, end === -1 ? undefined : end))
}

function htmlItem(lead: string): string {
  const i = POLICY_HTML.indexOf(lead)
  expect(i, `website/privacy.html has the item beginning "${lead}"`).toBeGreaterThan(-1)
  const end = POLICY_HTML.indexOf('</li>', i)
  expect(end, `website/privacy.html closes the item beginning "${lead}"`).toBeGreaterThan(i)
  return htmlProse(POLICY_HTML.slice(i, end))
}

const SURFACES: Array<[string, (lead: string) => string]> = [
  ['PRIVACY_POLICY.md', mdItem],
  ['website/privacy.html', htmlItem],
]

function sentenceFrom(text: string, start: string): string {
  const i = text.indexOf(start)
  expect(i, `the passage carries "${start}"`).toBeGreaterThan(-1)
  const end = text.indexOf('.', i)
  return text.slice(i, end + 1)
}

describe('the escapee answers\' retention sentence', () => {
  it('the TTL is a whole number of days, so a sentence in days can state it exactly', () => {
    expect(Number.isInteger(PROVENANCE_TTL_MS / DAY_MS)).toBe(true)
  })

  it('"until you clear your eBird backup" is what the code does: Clearing the backup purges the escapee store', () => {
    expect(registeredTeardowns('ebird')).toContain(PROVENANCE_STORE_KEY)
  })

  for (const [name, passage] of SURFACES) {
    it(`${name}: the sentence exists, follows the sentence it qualifies, and states the reuse window`, () => {
      const text = passage(STATS_LEAD)
      // Non-vacuity: the passage is the escapee one.
      expect(text).toContain('which of your birds eBird tags as exotic escapees')
      // Exists, and directly after the covering-subset sentence.
      expect(text).toContain(`${HISTORY_END} ${RETENTION_LEAD}`)
      // Built FROM the constant, so moving the TTL turns this red.
      const days = PROVENANCE_TTL_MS / DAY_MS
      expect(sentenceFrom(text, RETENTION_LEAD)).toContain(` reused for ${days} days `)
    })

    it(`${name}: the retired sentence, which stated the reuse window as the retention, is gone`, () => {
      expect(passage(STATS_LEAD).includes(RETIRED)).toBe(false)
    })
  }

  it('the two files carry the same sentence', () => {
    expect(sentenceFrom(htmlItem(STATS_LEAD), RETENTION_LEAD)).toBe(sentenceFrom(mdItem(STATS_LEAD), RETENTION_LEAD))
  })

  it('carries no em dash', () => {
    for (const [name, passage] of SURFACES) {
      expect(sentenceFrom(passage(STATS_LEAD), RETENTION_LEAD).includes('\u2014'), name).toBe(false)
    }
  })
})
