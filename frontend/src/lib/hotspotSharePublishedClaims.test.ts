// The published privacy-policy claims about the persisted hotspot store
// (hotspot-share-stat), held to the code.
//
// WHY THIS FILE EXISTS. The docs rule asks that a sentence added to
// `PRIVACY_POLICY.md` arrive with a guard of the `*PublishedClaims` shape, or the
// statement is unguarded prose. The security review (finding L1) proposed two:
// the Clear list in "Your Data Stays on Your Device" gains "the lists of public
// hotspots for the regions you have birded", and the Statistics sub-bullet under
// eBird gains how long each region's answer is kept. Both are published copy, so
// they wait in `pipeline/hotspot-share-stat/held-copy.md` for the user's yes and
// are NOT in either file at this commit.
//
// SO THE CLAIM ROWS ARE SKIPPED UNTIL THE COPY LANDS. The skip lifts when the held
// copy is applied at the release commit: the gate below opens as soon as EITHER
// sentence is in EITHER file, so a half-applied patch (one file edited, or one
// sentence of two) runs every row and goes red rather than staying skipped. When
// the copy lands, delete the `skipIf`: a gate on presence cannot see both
// sentences being removed again, and an unconditional existence row can.
//
// THE SHAPE IS `weatherStatsPublishedClaims.test.ts`'s, for the same reasons.
// It scopes to the policy's own passages (the Clear bullet and the Statistics
// sub-bullet, each located by its opening words) rather than the whole document,
// which talks about other stores' retention on purpose. It asserts each claim
// EXISTS before checking it is right, because deleting a sentence is the move a
// "must contain" guard rewards. It builds the "30 days" FROM
// `HOTSPOT_REGION_TTL_MS` rather than re-spelling it. And it compares the two
// files against each other as well as each against the code, because the policy
// is hand-kept in Markdown and in HTML.
//
// ONE ROW RUNS NOW: the two files already say the same thing about Clear, and
// the held patch is applied to both identically, so that row is what keeps the
// two copies from drifting apart before it lands.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HOTSPOT_REGION_TTL_MS } from './hotspotRegionCache'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const POLICY_MD = read('PRIVACY_POLICY.md')
const POLICY_HTML = read('website/privacy.html')

/** The opening words of the two passages, identical in both files. */
const CLEAR_LEAD = 'You can delete your stored files and keys at any time'
const STATS_LEAD = 'The Statistics tab also asks eBird about a set of your own checklists'

/** The sentence each insertion attaches to, already published. */
const CLEAR_SENTENCE = 'Clearing your eBird backup also removes what was worked out from it and saved on your device:'
const LOOKUP_SENTENCE = 'it asks eBird which locations in the regions you have birded are public hotspots.'

/** The two held insertions (held-copy.md, "Proposed privacy policy sentences"). */
const HOTSPOT_CLEAR_ITEM = 'the lists of public hotspots for the regions you have birded,'
const RETENTION_LEAD = "Each region's answer is stored on your device for"

const DAY_MS = 24 * 60 * 60 * 1000

/** Markdown as prose: bold markers and link targets dropped, whitespace collapsed. */
function mdProse(md: string): string {
  return md.replace(/\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
}

/** HTML as prose: tags dropped, the entities this page can carry decoded,
 *  whitespace collapsed. */
function htmlProse(html: string): string {
  return html.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
}

/** A Markdown bullet, from its opening words to the end of its line. */
function mdItem(lead: string): string {
  const i = POLICY_MD.indexOf(lead)
  expect(i, `PRIVACY_POLICY.md has the bullet beginning "${lead}"`).toBeGreaterThan(-1)
  const end = POLICY_MD.indexOf('\n', i)
  return mdProse(POLICY_MD.slice(i, end === -1 ? undefined : end))
}

/** An HTML list item, from its opening words to its own `</li>`. */
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

/** The sentence of `text` that starts at `start`, through its first full stop. */
function sentenceFrom(text: string, start: string): string {
  const i = text.indexOf(start)
  expect(i, `the passage carries "${start}"`).toBeGreaterThan(-1)
  const end = text.indexOf('.', i)
  return text.slice(i, end + 1)
}

// Open the claim rows once either held sentence is in either file.
const LANDED = [HOTSPOT_CLEAR_ITEM, RETENTION_LEAD].some(s =>
  mdProse(POLICY_MD).includes(s) || htmlProse(POLICY_HTML).includes(s))

describe('the two copies of the policy agree about Clear (always on)', () => {
  it('PRIVACY_POLICY.md and website/privacy.html say the same thing about what Clear removes', () => {
    const md = mdItem(CLEAR_LEAD)
    // Non-vacuity: the passage is there and still carries the eBird-backup list.
    expect(md.length).toBeGreaterThan(200)
    expect(md).toContain(CLEAR_SENTENCE)
    expect(htmlItem(CLEAR_LEAD)).toBe(md)
  })
})

describe.skipIf(!LANDED)('the hotspot store\'s policy sentences, once the held copy is applied', () => {
  it('the TTL is a whole number of days, so a sentence in days can state it exactly', () => {
    expect(Number.isInteger(HOTSPOT_REGION_TTL_MS / DAY_MS)).toBe(true)
  })

  for (const [name, passage] of SURFACES) {
    it(`${name}: what Clearing the eBird backup removes includes the hotspot answers`, () => {
      const sentence = sentenceFrom(passage(CLEAR_LEAD), CLEAR_SENTENCE)
      expect(sentence).toContain(HOTSPOT_CLEAR_ITEM)
    })

    it(`${name}: the retention sentence exists, follows the lookup it qualifies, and states the TTL`, () => {
      const text = passage(STATS_LEAD)
      // Exists, and directly after the sentence that says the tab asks eBird.
      expect(text).toContain(`${LOOKUP_SENTENCE} ${RETENTION_LEAD}`)
      // Built FROM the constant, so moving the TTL turns this red instead of
      // leaving the policy quietly wrong.
      const days = HOTSPOT_REGION_TTL_MS / DAY_MS
      expect(sentenceFrom(text, RETENTION_LEAD)).toMatch(new RegExp(`^${RETENTION_LEAD} ${days} days, `))
    })
  }

  it('the two files carry the same sentences in both passages', () => {
    expect(htmlItem(STATS_LEAD)).toBe(mdItem(STATS_LEAD))
    expect(htmlItem(CLEAR_LEAD)).toBe(mdItem(CLEAR_LEAD))
  })

  it('carries no em dash', () => {
    for (const [name, passage] of SURFACES) {
      for (const lead of [CLEAR_LEAD, STATS_LEAD]) expect(passage(lead).includes('\u2014'), `${name}: ${lead}`).toBe(false)
    }
  })
})
