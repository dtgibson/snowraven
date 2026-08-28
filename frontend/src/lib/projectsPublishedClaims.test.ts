// Two published claims that measurement contradicted (QA-75, QA-76).
//
// Both were true of an earlier design and survived into shipped prose, which is
// the failure mode a hand-maintained restatement always has: `docs/HELP.md`,
// `README.md`, `website/index.html`, `PRIVACY_POLICY.md` and
// `website/privacy.html` each carry their own copy of the same fact, and one of
// them being corrected does not correct the others.
//
//  1. THE MAP EXPLORER PARITY CLAIM was unconditional. The equality holds only
//     with Count all forms OFF: `MapExplorer.tsx` hardcodes
//     `filterObservations(phase.observations, false)` while `BirdingStats.tsx`
//     uses the toggle. QA measured SIX counties diverging on the real export
//     with the setting on. Three hand-kept restatements disagreed within one
//     edit, `website/index.html` having quietly dropped the clause.
//
//  2. "RE-CHECKED AT MOST ONCE A YEAR" is contradicted by the shipped Check
//     again control, which re-asks every checklist on demand through the force
//     path. A privacy statement is read literally, so a clause the code
//     contradicts is the one that matters most.
//
// These assertions are deliberately about the CLAIM (a conditioning phrase in
// the same sentence), not about an exact wording, so an editorial rewrite that
// keeps the claim true stays green.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const help = read('docs/HELP.md')
const readme = read('README.md')
const policy = read('PRIVACY_POLICY.md')
const privacyPage = read('website/privacy.html')
// The third restatement, and the one that quietly dropped the clause. It is
// HTML, so tags are stripped before the prose is read: the sentence is broken
// across source lines by <strong> wrappers and would otherwise never match.
const site = read('website/index.html')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ')

/** A document's sentences, whitespace-normalised. */
function sentences(src: string): string[] {
  return src
    .split(/(?<=[.!?])\s+/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** The sentences of a document that mention `needle`. */
function sentencesWith(src: string, needle: string): string[] {
  return sentences(src).filter(s => s.includes(needle))
}

/**
 * The claim's condition, as a CONDITION rather than as a co-occurrence. The
 * earlier assertion was `toMatch(/Count all forms/)`, which a sentence reading
 * "...and the Map Explorer's, whatever the Count all forms setting" satisfies
 * while saying the opposite of the truth. The setting must be named WITH the
 * state the claim holds in.
 */
const CONDITIONED = /Count all forms is off/
/** Phrasings that assert the claim holds in every setting. */
const UNCONDITIONAL = /\b(whatever|regardless of|no matter|however you set|either way|whether or not)\b/i

describe('the Map Explorer parity claim states the setting it holds under (QA-75)', () => {
  // ALL THREE restatements, including the one that had quietly dropped the
  // clause. A guard that reads two of three surfaces cannot see the surface the
  // finding was about.
  const SURFACES = [
    ['docs/HELP.md', help],
    ['README.md', readme],
    ['website/index.html', site],
  ] as const

  it.each(SURFACES)('%s conditions it on Count all forms being OFF', (name, src) => {
    // Any sentence that claims the county NUMBERS agree, however it is
    // worded. A bare /match/ is too broad: README describes "a matching map
    // pin button" on the Map Explorer, which is not a claim about numbers.
    const claims = sentencesWith(src, "Map Explorer's")
      .filter(s => /match the county tables|numbers that match|match the Map Explorer's/.test(s))
    expect(claims.length, `${name}: no parity sentence found`).toBeGreaterThan(0)
    for (const s of claims) {
      expect(s, `${name}: ${s}`).toMatch(CONDITIONED)
      expect(s, `${name}: ${s}`).not.toMatch(UNCONDITIONAL)
    }
  })

  it('all three surfaces say the same thing, not merely three true things', () => {
    // The finding's actual complaint after the first repair: nothing was false
    // any more, but the three still did not agree. Each must carry the scope
    // AND the reason, so a reader of any one of them learns the same fact.
    for (const [name, src] of SURFACES) {
      const claims = sentencesWith(src, "Map Explorer's")
        .filter(s => /match the county tables|numbers that match|match the Map Explorer's/.test(s))
      const joined = claims.join(' ')
      expect(joined, `${name} names the scope`).toMatch(/Count all forms is off/)
      expect(joined, `${name} gives the reason`).toMatch(/countable-species rule/)
    }
  })

  it('GUARD THE GUARD: the co-occurrence phrasing the old assertion allowed fails', () => {
    // "...and the Map Explorer's, whatever the Count all forms setting" is
    // false, and the previous `toMatch(/Count all forms/)` passed it.
    const bad = "The numbers match the county tables beside it and the Map Explorer's, whatever the Count all forms setting."
    expect(bad).toMatch(/Count all forms/)          // the old assertion is satisfied
    expect(bad).not.toMatch(CONDITIONED)            // this one is not
    expect(bad).toMatch(UNCONDITIONAL)
  })

  it('no document claims the Map Explorer agrees whatever the setting', () => {
    // The specific shape that was shipped: the Map Explorer named in the same
    // breath as the county tables, with nothing scoping it.
    for (const [name, src] of SURFACES) {
      expect(src, name).not.toContain("the county tables below it and the Map Explorer's, because")
      expect(src, name).not.toContain("match the county tables beside it and the Map Explorer's.")
    }
  })
})

describe('the yearly re-check claim admits Check again (QA-76)', () => {
  it.each([
    ['PRIVACY_POLICY.md', policy],
    ['website/privacy.html', privacyPage],
    ['docs/HELP.md', help],
  ])('%s does not say an answer is re-checked at most once a year', (name, src) => {
    // The exact clause the shipped Check again control contradicts.
    expect(src, name).not.toMatch(/re-checked at most once a year/)
  })

  it.each([
    ['PRIVACY_POLICY.md', policy],
    ['website/privacy.html', privacyPage],
    ['docs/HELP.md', help],
  ])('%s names Check again wherever it makes the year claim', (name, src) => {
    const claims = sentencesWith(src, 'not re-checked for a year')
    expect(claims.length, `${name}: no year claim found`).toBeGreaterThan(0)
    // SENTENCE-SCOPED, not a character window. The 260-character lookahead this
    // replaces was satisfied by any later "Check again" that happened to fall
    // inside it, whatever it was about.
    const all = sentences(src)
    for (const s of claims) {
      const i = all.indexOf(s)
      expect(i, `${name}: the claim sentence is locatable`).toBeGreaterThanOrEqual(0)
      // Either the claim sentence carries the exception, or the one immediately
      // after it does (HELP.md gives it a sentence of its own).
      const scope = [all[i], all[i + 1] ?? ''].join(' ')
      expect(scope, `${name}: ${s}`).toMatch(/Check again/)
    }
  })

  it('the policy and its published mirror carry the same corrected sentence', () => {
    // The two are hand-maintained copies; a fix applied to one only is exactly
    // the drift `privacyPageParity.test.ts` exists for, at sentence scale.
    const claim = 'an answer already given is not re-checked for a year unless you press Check again, which re-asks about all of them.'
    expect(policy).toContain(claim)
    expect(privacyPage).toContain(claim)
  })
})

describe('the published prose keeps its standing rules', () => {
  it.each([
    ['docs/HELP.md', help],
    ['README.md', readme],
    ['PRIVACY_POLICY.md', policy],
    ['website/privacy.html', privacyPage],
    // The sixth published surface, previously outside this sweep as well as the
    // parity one. Read RAW here, not tag-stripped: an em dash inside markup is
    // still an em dash on the page.
    ['website/index.html', read('website/index.html')],
  ])('%s carries no em dash', (name, src) => {
    expect(src.includes('—'), name).toBe(false)
  })
})
