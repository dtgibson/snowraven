// The two published claims about Search that QA measured false (QA-50, QA-51),
// pinned so a later edit cannot write either of them back.
//
// Both are the failure mode a hand-maintained restatement always has: the same
// fact is written out in `docs/HELP.md`, `README.md` and `website/index.html`,
// and one of them being right does not make the others right. In the delivered
// change HELP.md said "Every tab you have visible" while README and the website
// said "every destination" / "every tab" flat, in the SAME diff. The correct
// formulation existed in the tree the whole time.
//
//  1. THE DESTINATION POPULATION. `buildPaletteRows` is handed `items`, which is
//     App.tsx's `navItems` = `visibleTabs(tabLayout)` with Settings appended, so
//     a tab hidden in Settings is not in the population at all. Any published
//     sentence that quantifies over destinations has to say so.
//
//  2. THE SPECIES CAP IS A PROPERTY, NOT A NUMBER. `SPECIES_CAP` lives once, in
//     lib/paletteRows.ts, and `speciesCapLine(cap)` reads it rather than
//     repeating it, precisely so the sentence on screen and the slice can never
//     disagree. Published prose re-spelling the number puts a third copy outside
//     that arrangement, with nothing holding it to the constant. The repo rule
//     is "publish the property, never the count"
//     (.claude/rules/docs-and-website.md), and the mechanical form of it here is
//     that the cap's VALUE does not appear in the published Search prose.
//
// WHY THE PASSAGES ARE EXTRACTED RATHER THAN THE WHOLE FILE. HELP.md's
// navigation section legitimately says "Every tab is reachable at every width",
// a true claim about the nav and not about Search. A guard over the whole
// document would either fail on that sentence or be loosened until it asserted
// nothing. Each file's Search passage is its own population.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SPECIES_CAP } from './paletteRows'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

/** `docs/HELP.md`'s `## Search` section, heading to the next `##`. */
function helpSearchSection(): string {
  const src = read('docs/HELP.md')
  const start = src.indexOf('\n## Search\n')
  expect(start, 'docs/HELP.md has a `## Search` section').toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const end = rest.indexOf('\n## ', 1)
  return end === -1 ? rest : rest.slice(0, end)
}

/** `README.md`'s Search bullet. */
function readmeSearchBullet(): string {
  const line = read('README.md')
    .split('\n')
    .find(l => l.startsWith('- **Search anything by name**'))
  expect(line, 'README.md has a Search feature bullet').toBeTruthy()
  return line as string
}

/** The website's Search feature row, tags stripped so the prose reads as prose. */
function siteSearchArticle(): string {
  const src = read('website/index.html')
  const h = src.indexOf('<h3>Search anything by name</h3>')
  expect(h, 'website/index.html has a Search feature row').toBeGreaterThan(-1)
  const end = src.indexOf('</article>', h)
  return src
    .slice(h, end === -1 ? undefined : end)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ')
}

const SURFACES = [
  ['docs/HELP.md', helpSearchSection()],
  ['README.md', readmeSearchBullet()],
  ['website/index.html', siteSearchArticle()],
] as const

/** A passage's sentences, whitespace-normalised. */
function sentences(src: string): string[] {
  return src
    .split(/(?<=[.!?:])\s+/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/**
 * A sentence that quantifies over destinations, however it names them. Both
 * shipped nouns are here because the three files reached for different ones and
 * a guard that knows only its author's favourite is a guard over one file.
 */
const QUANTIFIES = /\b(?:every|all|any) (?:tab|destination)s?\b/i
/** The qualifier that makes such a sentence true of the shipped population. */
const SCOPED_TO_VISIBLE = /\bvisible\b/i

describe('what Search reaches is published as the VISIBLE destinations (QA-51)', () => {
  it.each(SURFACES)('%s scopes every destination claim to the visible ones', (name, passage) => {
    const claims = sentences(passage).filter(s => QUANTIFIES.test(s))

    // Non-vacuity: each of these three files makes the claim. A pass because the
    // sentence was deleted would be a silent loss of the guard, not a fix.
    expect(claims.length, `${name} makes at least one destination-population claim`).toBeGreaterThan(0)

    for (const claim of claims) {
      expect(claim, `${name}: a hidden tab is not in the population`).toMatch(SCOPED_TO_VISIBLE)
    }
  })

  it('rejects the wording that actually shipped, in both files that shipped it', () => {
    // Guard-the-guard, against the real defect rather than an invented one.
    for (const shipped of [
      'Search reaches every tab and every species in your own eBird backup.',
      'It reaches every destination and every species in your own eBird backup.',
    ]) {
      expect(QUANTIFIES.test(shipped)).toBe(true)
      expect(SCOPED_TO_VISIBLE.test(shipped)).toBe(false)
    }
  })
})

describe('the species cap is published as a property, never as its number (QA-50)', () => {
  const capNumber = new RegExp(String.raw`\b${SPECIES_CAP}\b`)

  it.each(SURFACES)('%s does not re-spell SPECIES_CAP', (name, passage) => {
    expect(
      passage,
      `${name} names the cap's value, which puts a copy of SPECIES_CAP outside ` +
        'lib/paletteRows.ts with nothing holding the two together. State the ' +
        'property instead: the list stops after a fixed number and says how many.',
    ).not.toMatch(capNumber)
  })

  it('rejects the wording that actually shipped', () => {
    expect(capNumber.test(`Species results are capped at the first ${SPECIES_CAP}.`)).toBe(true)
    // And is not satisfied by a passage that merely talks about a cap.
    expect(capNumber.test('the list stops after a fixed number of them')).toBe(false)
  })
})
