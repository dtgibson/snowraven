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
//
// website-readme-copy-pass: THE TWO DECISION SURFACES LEFT THIS ROSTER, AND THAT
// IS RECORDED HERE RATHER THAN LEFT TO BE INFERRED FROM A SHORTER ARRAY. By user
// decision `README.md` and `website/index.html` no longer carry a Search section
// at all (Search is app plumbing, not a birding feature a reader decides on), so
// there is no Search passage in either file for these rows to read. That is
// different from deleting an existence leg while the surface still carries a
// passage, which stays forbidden: `docs/HELP.md`'s `## Search` keeps every row
// below, byte for byte. In place of the two retired extractors, a NEGATIVE leg
// asserts the sections stay gone, because `.claude/rules/docs-and-website.md`
// requires every feature change to update README and the website in the same
// change, which is the exact mechanism that appended them in the first place.
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

/** `docs/HELP.md`'s `### Tab Layout` subsection, heading to the next `###` or `##`. */
function helpTabLayoutSection(): string {
  const src = read('docs/HELP.md')
  const start = src.indexOf('\n### Tab Layout\n')
  expect(start, 'docs/HELP.md has a `### Tab Layout` subsection').toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const end = rest.search(/\n#{2,3} /)
  return end === -1 ? rest : rest.slice(0, end)
}

const SURFACES = [
  ['docs/HELP.md', helpSearchSection()],
] as const

/** The two decision surfaces, read whole: the negative legs below are about
 *  what they must NOT carry, so there is no passage to scope to. */
const DECISION_SURFACES = [
  ['README.md', read('README.md')],
  ['website/index.html', read('website/index.html')],
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

    // Non-vacuity: the file makes the claim. A pass because the sentence was
    // deleted would be a silent loss of the guard, not a fix.
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

// ── website-readme-copy-pass: the decision surfaces carry no Search and no Offline section ──
//
// The register the two surfaces are written in describes what each tab does for
// a reader deciding whether the app fits them. Search is app plumbing and offline
// support is partial, so by user decision neither gets a section on either
// surface. Both facts stay published in `docs/HELP.md` (`## Search`,
// `## Using SnowRaven offline`), and `icloudKeysPublishedClaims` still asserts
// the HELP offline section. These legs stop the append-log re-forming one build
// later, when the docs rule asks the next feature to "update README and the
// website in the same change".

/** A Markdown heading of any level whose text starts with the word. */
const readmeHeading = (word: string) => new RegExp(String.raw`^#{1,6}\s+${word}\b`, 'im')
/** A website `<h3>` whose text starts with the word, attributes or not. */
const siteHeading = (word: string) => new RegExp(String.raw`<h3[^>]*>\s*${word}\b`, 'i')
/** The bullet form the README used to carry for each. */
const readmeBullet = (label: string) => new RegExp(String.raw`^- \*\*${label}`, 'm')

describe('README.md and website/index.html carry no Search or Offline section (website-readme-copy-pass)', () => {
  it.each(DECISION_SURFACES)('%s has no Search section heading', (name, src) => {
    const re = name === 'README.md' ? readmeHeading('Search') : siteHeading('Search')
    expect(re.test(src), `${name}: a Search section is back`).toBe(false)
    expect(readmeBullet('Search anything by name').test(src), `${name}: the Search bullet is back`).toBe(false)
  })

  it.each(DECISION_SURFACES)('%s has no Offline section heading', (name, src) => {
    const re = name === 'README.md' ? readmeHeading('Offline') : siteHeading('Offline')
    expect(re.test(src), `${name}: an Offline section is back`).toBe(false)
    expect(readmeBullet('Offline').test(src), `${name}: the Offline bullet is back`).toBe(false)
  })

  it.each(DECISION_SURFACES)('%s does not mention offline at all', (name, src) => {
    // The user's decision, stated as its own leg rather than inferred from the
    // heading check: offline support is partial and is not a reason to choose
    // the app, so it is unmentioned on both surfaces. HELP keeps the full
    // account. A heading-free sentence would pass the leg above and fail here.
    expect(/\boffline\b/i.test(src), `${name} mentions offline`).toBe(false)
  })

  it('GUARD THE GUARD: the headings and bullets that shipped through 1.0.32 trip these legs', () => {
    expect(siteHeading('Search').test('<h3>Search anything by name</h3>')).toBe(true)
    expect(siteHeading('Offline').test('<h3>Offline support</h3>')).toBe(true)
    expect(readmeBullet('Search anything by name').test('- **Search anything by name**: press Cmd-K')).toBe(true)
    expect(readmeBullet('Offline').test('- **Offline**: every analytical tab')).toBe(true)
    expect(readmeHeading('Search').test('## What it does\n\n### Search\n')).toBe(true)
    expect(readmeHeading('Offline').test('### Offline support\n')).toBe(true)
    // And a heading that merely CONTAINS the word, like the Weather tab's own
    // "Search this area" control described under Map Explorer, does not.
    expect(siteHeading('Search').test('<h3>Map Explorer</h3>')).toBe(false)
    expect(readmeHeading('Search').test('### Map Explorer\n\nSearch this area re-runs')).toBe(false)
  })
})

// ── website-readme-copy-pass: the one navigation fact that left README lives in HELP ──
//
// README's retired `- **Navigation that fits the window**` bullet carried one
// claim HELP did not already make: the layout is chosen from the space actually
// available, not from a device check. It moves into HELP's `### Tab Layout`
// paragraph, and a sentence added to HELP owes a guard in the same change
// (.claude/rules/docs-and-website.md). Held to the CODE: `navDensity.ts` derives
// the wide-window density from the shell's width and `useIsPhone.ts` is a
// `(max-width:640px)` media query; neither reads the user agent, the pointer
// type or the touch-point count.

describe('docs/HELP.md says the navigation shape follows the space available, and the code has no device check', () => {
  it('the Tab Layout paragraph states it beside the three shapes', () => {
    const text = helpTabLayoutSection()
    expect(text).toMatch(/changes shape with the width of the window/)
    expect(text).toMatch(/space actually available/)
    expect(text).toMatch(/(never|not) from what kind of device/)
  })

  it('the density code reads widths, not devices', () => {
    for (const file of ['frontend/src/lib/navDensity.ts', 'frontend/src/lib/useIsPhone.ts']) {
      const src = read(file)
      const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n')
      for (const probe of ['userAgent', 'maxTouchPoints', 'pointer: coarse', 'pointer:coarse', 'platform']) {
        expect(code.includes(probe), `${file} reads ${probe}`).toBe(false)
      }
    }
    expect(read('frontend/src/lib/useIsPhone.ts')).toContain('(max-width:640px)')
  })
})
