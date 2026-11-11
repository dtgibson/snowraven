// The Hotspot Reports sentence on the three decision surfaces (README.md,
// website/index.html, appstore/LISTING.md) and the release's What's New, held
// for the user's yes (hotspot-reports FR-60, QA-58).
//
// WHY A SEPARATE FILE. These surfaces are published copy and wait for the
// user's express yes; the held-patch rule (`.claude/rules/docs-and-website.md`)
// puts a held patch's guard rows in a file the run does not otherwise edit, so
// the patch can be applied or dropped as one unit. Help is guarded in
// `hotspotReportsPublishedClaims.test.ts`.
//
// TWO STATES, ONE SWITCH. The proposals live in
// `pipeline/hotspot-reports/held/` as fenced blocks (four backticks, an info
// string `before|after|proposal <surface> [n]`), every BEFORE cut verbatim from
// the published file. While `APPLIED` is false this suite (1) asserts that the
// published files carry no Hotspot Reports copy yet, which is QA-58's "no diff
// before the yes" held as a row, (2) asserts that each BEFORE occurs exactly
// once in its file, so the patch applies cleanly, and (3) applies the pairs IN
// MEMORY and runs every structural check on the result. The copy commit that
// follows the yes applies the same pairs to the files and sets `APPLIED` to
// true, and the same checks then run on the real files. If the user changes a
// word, the held block is edited first, so the two states never disagree.
//
// THE SHAPE IS `lifeListsSurfacesPublishedClaims.test.ts`'s: each file's own
// passage (a README `###` section, a website `<h3>` article, a listing bullet
// line), the claim asserted to EXIST before it is checked, every name built from
// the code (`TAB_LABELS`, `DEFAULT_TAB_ORDER`), and the files compared with each
// other as well as with the code, because the register asks them to say the same
// thing in the same words.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_TAB_ORDER, TAB_LABELS } from './tabLayout'

/** Flip to true in the copy commit that applies the held pairs after the yes. */
const APPLIED = true

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const HELD_DIR = 'pipeline/hotspot-reports/held/'
const HELD_FILES = ['readme-and-website.md', 'appstore.md', 'fastlane-changelog.md'] as const
const SURFACES = { readme: 'README.md', website: 'website/index.html', listing: 'appstore/LISTING.md' } as const
type Surface = keyof typeof SURFACES

const TAB = 'hotspot-reports' as const
const LABEL = TAB_LABELS[TAB]
const AT = DEFAULT_TAB_ORDER.indexOf(TAB)
const BEFORE = TAB_LABELS[DEFAULT_TAB_ORDER[AT - 1]]
const AFTER = TAB_LABELS[DEFAULT_TAB_ORDER[AT + 1]]

interface Block { kind: string; name: string; n: number; body: string; from: string }

/** Every fenced block in the held files. */
const BLOCKS: readonly Block[] = (() => {
  const out: Block[] = []
  for (const f of HELD_FILES) {
    const text = read(`${HELD_DIR}${f}`)
    for (const m of text.matchAll(/^````([a-z-]+)(?: ([a-z-]+))?(?: (\d+))?\n([\s\S]*?)\n````$/gm)) {
      out.push({ kind: m[1], name: m[2] ?? '', n: m[3] ? Number(m[3]) : 0, body: m[4], from: f })
    }
  }
  return out
})()

function proposal(name: string): string {
  const found = BLOCKS.filter(b => b.kind === 'proposal' && b.name === name)
  expect(found.length, `exactly one "proposal ${name}" block in the held files`).toBe(1)
  return found[0].body
}

/** The surface's BEFORE/AFTER pairs, in order, each body re-terminated by the one
 *  newline the fence holds back. */
function pairs(surface: Surface): { n: number; before: string; after: string }[] {
  const ns = [...new Set(BLOCKS.filter(b => b.name === surface && (b.kind === 'before' || b.kind === 'after')).map(b => b.n))].sort((a, b) => a - b)
  return ns.map(n => {
    const before = BLOCKS.filter(b => b.kind === 'before' && b.name === surface && b.n === n)
    const after = BLOCKS.filter(b => b.kind === 'after' && b.name === surface && b.n === n)
    expect(before.length, `${surface} ${n} has one BEFORE`).toBe(1)
    expect(after.length, `${surface} ${n} has one AFTER`).toBe(1)
    return { n, before: `${before[0].body}\n`, after: `${after[0].body}\n` }
  })
}

const count = (hay: string, needle: string) => hay.split(needle).length - 1

/** The surface as it will read once the copy is applied: the real file after
 *  the yes, the held pairs applied in memory before it. */
function published(surface: Surface): string {
  const real = read(SURFACES[surface])
  if (APPLIED) return real
  let text = real
  for (const p of pairs(surface)) text = text.replace(p.before, p.after)
  return text
}

const collapse = (t: string) => t.replace(/\s+/g, ' ').trim()

function readmeSection(text: string, label: string): { at: number; body: string } {
  const head = `\n### ${label}\n`
  const i = text.indexOf(head)
  expect(i, `README has a "### ${label}" section`).toBeGreaterThan(-1)
  const rest = text.slice(i + head.length)
  const end = rest.search(/\n#{2,3} /)
  return { at: i, body: collapse(end === -1 ? rest : rest.slice(0, end)) }
}

function siteArticle(text: string, label: string): { at: number; html: string } {
  const h = text.indexOf(`<h3>${label}</h3>`)
  expect(h, `the website has an <h3>${label}</h3> row`).toBeGreaterThan(-1)
  const start = text.lastIndexOf('<article', h)
  return { at: start, html: text.slice(start, text.indexOf('</article>', h)) }
}

function siteSentence(text: string, label: string): string {
  const { html } = siteArticle(text, label)
  const p = html.indexOf('<p>')
  expect(p, `the ${label} row opens its body as a bare <p>`).toBeGreaterThan(-1)
  return collapse(html.slice(p + 3, html.indexOf('</p>', p)).replace(/<[^>]*>/g, ' '))
}

function listingBullet(text: string, label: string): { at: number; text: string } {
  const lead = `\n\u2022 ${label}: `
  const i = text.indexOf(lead)
  expect(i, `the listing has a "${label}" bullet`).toBeGreaterThan(-1)
  return { at: i, text: text.slice(i + lead.length, text.indexOf('\n', i + 1)) }
}

/** True when the text holds a character outside ASCII (no control-character regex). */
function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0x7f) return true
  return false
}

/** The register's word rules for a proposal, as rows rather than a read. */
function registerFindings(s: string): string[] {
  const out: string[] = []
  if (s.includes('\u2014')) out.push('an em dash')
  if (hasNonAscii(s)) out.push('a non-ASCII character')
  if (/\d/.test(s)) out.push('a number (publish the property, never the count)')
  if (/\b(colour|favourite|behaviour|neighbour|centre|organis|recognis|catalogue|grey)/i.test(s)) out.push('British spelling')
  if (/[^.]\bWeather\b/.test(s.slice(1))) out.push('"Weather" capitalized mid-sentence')
  if (/\b(offline|without a connection)\b/i.test(s)) out.push('an offline mention')
  if (/\b(simply|easily|just|seamless|effortless|already have|don't worry)\b/i.test(s)) out.push('reassurance')
  if (/\b(press|tap|click|button|switch|toggle|picker|dropdown)\b/i.test(s)) out.push('operating detail')
  return out
}

describe('the held copy for the Hotspot Reports tab', () => {
  it('the held folder has its index and every proposal file, and each surface has its pairs (non-vacuity)', () => {
    const index = read(`${HELD_DIR}README.md`)
    for (const f of [...HELD_FILES, 'changelog-entry.md', 'privacy-and-accessibility-read.md', 'website-tools.patch']) {
      expect(index, `held/README.md lists ${f}`).toContain(f)
    }
    expect(pairs('readme')).toHaveLength(1)
    expect(pairs('website')).toHaveLength(4)
    expect(pairs('listing')).toHaveLength(3)
  })

  it.runIf(!APPLIED)('while held, no published file carries Hotspot Reports copy yet (QA-58)', () => {
    const marks: Record<Surface, string> = { readme: `\n### ${LABEL}\n`, website: `<h3>${LABEL}</h3>`, listing: `\u2022 ${LABEL}: ` }
    for (const s of Object.keys(SURFACES) as Surface[]) {
      expect(read(SURFACES[s]).includes(marks[s]), `${SURFACES[s]} is untouched`).toBe(false)
      // Non-vacuity: each mark is exactly what the held patch would add, so the
      // absence above is an absence of the patch and not of a misspelt string.
      expect(published(s).includes(marks[s]), `the held ${s} patch adds "${marks[s].trim()}"`).toBe(true)
    }
  })

  it.runIf(!APPLIED)('while held, every BEFORE block occurs exactly once in its published file, so the patch applies cleanly', () => {
    for (const s of Object.keys(SURFACES) as Surface[]) {
      const real = read(SURFACES[s])
      for (const p of pairs(s)) expect(count(real, p.before), `${s} ${p.n}`).toBe(1)
    }
  })

  it.runIf(APPLIED)('once applied, every AFTER block occurs exactly once in its published file', () => {
    for (const s of Object.keys(SURFACES) as Surface[]) {
      const real = read(SURFACES[s])
      for (const p of pairs(s)) expect(count(real, p.after), `${s} ${p.n}`).toBe(1)
    }
  })

  it('the proposal sentence is one sentence in the register: no count, no operating detail, no reassurance, ASCII, no em dash', () => {
    const s = proposal('sentence')
    expect(s.length).toBeGreaterThan(80)
    expect(s.endsWith('.')).toBe(true)
    expect(s.slice(0, -1).includes('. '), 'one sentence').toBe(false)
    expect(registerFindings(s)).toEqual([])
    expect(proposal('listing')).toBe(s.charAt(0).toLowerCase() + s.slice(1))
  })
})

describe('the Hotspot Reports sentence on the three decision surfaces', () => {
  const S = () => proposal('sentence')

  it('README.md: a section named from TAB_LABELS, between its neighbours in DEFAULT_TAB_ORDER, holding the sentence', () => {
    const text = published('readme')
    const sec = readmeSection(text, LABEL)
    expect(sec.at).toBeGreaterThan(readmeSection(text, BEFORE).at)
    expect(sec.at).toBeLessThan(readmeSection(text, AFTER).at)
    expect(sec.body).toBe(S())
  })

  it('website/index.html: a row between its neighbours, the same sentence, its figure, and the rows still alternating', () => {
    const text = published('website')
    const row = siteArticle(text, LABEL)
    expect(row.at).toBeGreaterThan(siteArticle(text, BEFORE).at)
    expect(row.at).toBeLessThan(siteArticle(text, AFTER).at)
    expect(siteSentence(text, LABEL)).toBe(S())
    expect(row.html).toContain('src="assets/shots/hotspot-reports.webp"')
    expect(row.html).toMatch(/ alt="The Hotspot Reports tab [^"]+"/)
    const start = text.indexOf('<section class="features"')
    const section = text.slice(start, text.indexOf('</section>', start))
    const rows = [...section.matchAll(/<article class="([^"]*)"/g)].map(m => m[1])
    expect(rows.length, 'the features section has rows (non-vacuity)').toBeGreaterThanOrEqual(11)
    rows.forEach((cls, i) => expect(cls, `row ${i + 1}`).toBe(i % 2 === 0 ? 'feature-row' : 'feature-row reverse'))
    // The numbering comments follow the rows.
    const numbers = [...section.matchAll(/<!-- (\d+)\. /g)].map(m => Number(m[1]))
    expect(numbers).toEqual(rows.map((_, i) => i + 1))
  })

  it('appstore/LISTING.md: a bullet between its neighbours, the sentence first letter down, and the recorded length matching its block', () => {
    const text = published('listing')
    const b = listingBullet(text, LABEL)
    expect(b.at).toBeGreaterThan(listingBullet(text, BEFORE).at)
    expect(b.at).toBeLessThan(listingBullet(text, AFTER).at)
    expect(b.text).toBe(proposal('listing'))
    const m = /\n## Description \(([\d,]+) \/ 4,000\)\n/.exec(text)
    expect(m, 'the Description heading records its length').not.toBeNull()
    const from = text.indexOf('```\n', m!.index) + 4
    const block = text.slice(from, text.indexOf('\n```', from))
    expect(Number(m![1].replace(/,/g, ''))).toBe(block.length)
    expect(block.length).toBeLessThanOrEqual(4000)
  })

  it('the three files say the same thing in the same words', () => {
    const readme = readmeSection(published('readme'), LABEL).body
    expect(siteSentence(published('website'), LABEL)).toBe(readme)
    expect(listingBullet(published('listing'), LABEL).text).toBe(readme.charAt(0).toLowerCase() + readme.slice(1))
  })

  it('carries no em dash in anything the patch adds', () => {
    for (const s of Object.keys(SURFACES) as Surface[]) {
      for (const p of pairs(s)) expect(p.after.includes('\u2014'), `${s} ${p.n}`).toBe(false)
    }
  })
})

describe("the release's What's New, F-Droid changelog and screenshot caption", () => {
  it("the App Store What's New and the F-Droid text are one sentence, the same words, within F-Droid's limit", () => {
    const whatsNew = proposal('whats-new')
    expect(proposal('fastlane')).toBe(whatsNew)
    expect(whatsNew.length + 1, 'the file holds the text and one newline').toBeLessThanOrEqual(500)
    expect(whatsNew.slice(0, -1).includes('. '), 'one sentence').toBe(false)
    expect(whatsNew).toMatch(new RegExp(`^A new ${LABEL} tab, between ${BEFORE} and ${AFTER}, `))
    const findings = registerFindings(whatsNew).filter(f => f !== 'operating detail')
    expect(findings).toEqual([])
  })

  it('the screenshot caption is the tab label over one short line, and the listing record carries it as the new frame', () => {
    const caption = proposal('caption')
    const [display, second] = caption.split(' | ')
    expect(display).toBe(LABEL)
    expect(second.length).toBeGreaterThan(10)
    expect(second.length).toBeLessThanOrEqual(52)
    expect(second.endsWith('.')).toBe(false)
    expect(registerFindings(second)).toEqual([])
    expect(published('listing')).toContain(`| \`07-hotspot-reports.png\` | ${LABEL} | ${second} |\n`)
  })
})
