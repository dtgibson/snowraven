// The Family Tree sentence on the three decision surfaces (README.md,
// website/index.html, appstore/LISTING.md) and the 1.0.76 What's New with its
// three F-Droid changelog files, held for the user's yes (family-rollups-and-
// tree FR-74, QA-70 and QA-71). Help is guarded in
// `familyTreePublishedClaims.test.ts`.
//
// WHY A SEPARATE FILE. These surfaces are published copy and wait for the
// user's express yes; the held-patch rule (`.claude/rules/docs-and-website.md`)
// puts a held patch's guard rows in a file the run does not otherwise edit, so
// the patch can be applied or dropped as one unit.
//
// TWO STATES, ONE SWITCH, as in `hotspotReportsSurfacesPublishedClaims.test.ts`.
// The proposals live in `pipeline/family-rollups-and-tree/held/release/copy/`
// as fenced blocks (four backticks, an info string `before|after|proposal
// <surface> [n]`), every BEFORE cut verbatim from the published file. While
// `APPLIED` is false this suite asserts the published files carry no Family
// Tree copy yet, that each BEFORE occurs exactly once, and runs every
// structural check on the pairs applied in memory. The copy commit after the
// yes applies the same pairs and sets `APPLIED` to true, and the checks then
// run on the real files.
//
// The F-Droid rows name THIS release's version code (docs-and-website.md,
// v1.0.64: a guard over one release's published file names that release), so
// a later bump does not turn them red on an honest later changelog.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_TAB_ORDER, TAB_LABELS } from './tabLayout'

/** Flip to true in the copy commit that applies the held pairs after the yes. */
const APPLIED = true

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const HELD_DIR = 'pipeline/family-rollups-and-tree/held/release/copy/'
const HELD_FILES = ['published-copy.md'] as const
const SURFACES = { readme: 'README.md', website: 'website/index.html', listing: 'appstore/LISTING.md' } as const
type Surface = keyof typeof SURFACES

const TAB = 'family-tree' as const
const LABEL = TAB_LABELS[TAB]
const AT = DEFAULT_TAB_ORDER.indexOf(TAB)
/** The release this What's New belongs to: 1.0.76, `major * 1e6 + minor * 1e3 + patch`. */
const VERSION_CODE = 1000076
const FASTLANE_CODES = [1, 2, 4].map(n => 10 * VERSION_CODE + n)

const MARKS: Record<Surface, (label: string) => string> = {
  readme: l => `\n### ${l}\n`,
  website: l => `<h3>${l}</h3>`,
  listing: l => `\n• ${l}: `,
}

/** The nearest tab in DEFAULT_TAB_ORDER, in `dir`, that the surface carries. */
function neighbour(text: string, surface: Surface, dir: -1 | 1): string {
  for (let i = AT + dir; i >= 0 && i < DEFAULT_TAB_ORDER.length; i += dir) {
    const label = TAB_LABELS[DEFAULT_TAB_ORDER[i]]
    if (text.includes(MARKS[surface](label))) return label
  }
  throw new Error(`${surface} carries no neighbour of ${LABEL} in direction ${dir}`)
}

interface Block { kind: string; name: string; n: number; body: string }

const BLOCKS: readonly Block[] = (() => {
  const out: Block[] = []
  for (const f of HELD_FILES) {
    const text = read(`${HELD_DIR}${f}`)
    for (const m of text.matchAll(/^````([a-z-]+)(?: ([a-z-]+))?(?: (\d+))?\n([\s\S]*?)\n````$/gm)) {
      out.push({ kind: m[1], name: m[2] ?? '', n: m[3] ? Number(m[3]) : 0, body: m[4] })
    }
  }
  return out
})()

function proposal(name: string): string {
  const found = BLOCKS.filter(b => b.kind === 'proposal' && b.name === name)
  expect(found.length, `exactly one "proposal ${name}" block in the held files`).toBe(1)
  return found[0].body
}

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
  const lead = `\n• ${label}: `
  const i = text.indexOf(lead)
  expect(i, `the listing has a "${label}" bullet`).toBeGreaterThan(-1)
  return { at: i, text: text.slice(i + lead.length, text.indexOf('\n', i + 1)) }
}

function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0x7f) return true
  return false
}

/** The register's word rules for a proposal, as rows rather than a read. */
function registerFindings(s: string): string[] {
  const out: string[] = []
  if (s.includes('—')) out.push('an em dash')
  if (hasNonAscii(s)) out.push('a non-ASCII character')
  if (/\d/.test(s)) out.push('a number (publish the property, never the count)')
  if (/\b(colour|favourite|behaviour|neighbour|centre|organis|recognis|catalogue|grey)/i.test(s)) out.push('British spelling')
  if (/[^.]\bWeather\b/.test(s.slice(1))) out.push('"Weather" capitalized mid-sentence')
  if (/\b(offline|without a connection)\b/i.test(s)) out.push('an offline mention')
  if (/\b(simply|easily|just|seamless|effortless|already have|don't worry)\b/i.test(s)) out.push('reassurance')
  if (/\b(press|tap|click|button|switch|toggle|picker|dropdown)\b/i.test(s)) out.push('operating detail')
  return out
}

/** Sentences in a short text: a period, or the end, closes one. */
const sentences = (s: string) => s.split(/(?<=\.)\s+/).filter(x => x.length > 0)

describe('the held copy for the Family Tree tab', () => {
  it('the held file has every surface\'s pairs (non-vacuity)', () => {
    expect(pairs('readme')).toHaveLength(1)
    expect(pairs('website')).toHaveLength(5)
    expect(pairs('listing')).toHaveLength(2)
  })

  it.runIf(!APPLIED)('while held, no published file carries Family Tree copy yet (QA-70)', () => {
    for (const s of Object.keys(SURFACES) as Surface[]) {
      const mark = MARKS[s](LABEL)
      expect(read(SURFACES[s]).includes(mark), `${SURFACES[s]} is untouched`).toBe(false)
      expect(published(s).includes(mark), `the held ${s} patch adds "${mark.trim()}"`).toBe(true)
    }
  })

  it.runIf(!APPLIED)('while held, every BEFORE block occurs exactly once in its published file', () => {
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

  it('the sentence is one sentence in the register, and the listing is it with the first letter lowered', () => {
    const s = proposal('sentence')
    expect(s.length).toBeGreaterThan(80)
    expect(s.endsWith('.')).toBe(true)
    expect(sentences(s)).toHaveLength(1)
    expect(registerFindings(s)).toEqual([])
    expect(proposal('listing')).toBe(s.charAt(0).toLowerCase() + s.slice(1))
  })
})

describe('the Family Tree sentence on the three decision surfaces', () => {
  const S = () => proposal('sentence')

  it('README.md: a section named from TAB_LABELS, between its neighbours in DEFAULT_TAB_ORDER, holding the sentence', () => {
    const text = published('readme')
    const sec = readmeSection(text, LABEL)
    expect(sec.at).toBeGreaterThan(readmeSection(text, neighbour(text, 'readme', -1)).at)
    expect(sec.at).toBeLessThan(readmeSection(text, neighbour(text, 'readme', 1)).at)
    expect(sec.body).toBe(S())
  })

  it('website/index.html: a row between its neighbours, the same sentence, its figure and alt, and the rows still alternating and numbered', () => {
    const text = published('website')
    const row = siteArticle(text, LABEL)
    expect(row.at).toBeGreaterThan(siteArticle(text, neighbour(text, 'website', -1)).at)
    expect(row.at).toBeLessThan(siteArticle(text, neighbour(text, 'website', 1)).at)
    expect(siteSentence(text, LABEL)).toBe(S())
    expect(row.html).toContain('src="assets/shots/family-tree.webp"')
    expect(row.html).toContain(` alt="${proposal('alt')}"`)
    expect(registerFindings(proposal('alt')).filter(f => f !== 'operating detail')).toEqual([])
    const start = text.indexOf('<section class="features"')
    const section = text.slice(start, text.indexOf('</section>', start))
    const rows = [...section.matchAll(/<article class="([^"]*)"/g)].map(m => m[1])
    expect(rows.length, 'the features section has rows (non-vacuity)').toBeGreaterThanOrEqual(12)
    rows.forEach((cls, i) => expect(cls, `row ${i + 1}`).toBe(i % 2 === 0 ? 'feature-row' : 'feature-row reverse'))
    const numbers = [...section.matchAll(/<!-- (\d+)\. /g)].map(m => Number(m[1]))
    expect(numbers).toEqual(rows.map((_, i) => i + 1))
    // Each numbering comment states its row's side, and the side matches the class.
    for (const m of section.matchAll(/<!-- \d+\. [^:]+: (reverse|media right)[^>]*-->\s*<article class="([^"]*)"/g)) {
      expect(m[2]).toBe(m[1] === 'reverse' ? 'feature-row reverse' : 'feature-row')
    }
  })

  it('appstore/LISTING.md: a bullet between its neighbours, the sentence first letter down, and the recorded length matching its block', () => {
    const text = published('listing')
    const b = listingBullet(text, LABEL)
    expect(b.at).toBeGreaterThan(listingBullet(text, neighbour(text, 'listing', -1)).at)
    expect(b.at).toBeLessThan(listingBullet(text, neighbour(text, 'listing', 1)).at)
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
      for (const p of pairs(s)) expect(p.after.includes('—'), `${s} ${p.n}`).toBe(false)
    }
  })
})

describe("the 1.0.76 What's New and its three F-Droid changelog files", () => {
  it("is the gist: at most two short sentences, the new tab named first, within F-Droid's limit, in the register", () => {
    const whatsNew = proposal('whats-new')
    expect(proposal('fastlane')).toBe(whatsNew)
    expect(whatsNew.length + 1, 'the file holds the text and one newline').toBeLessThanOrEqual(500)
    expect(sentences(whatsNew).length).toBeGreaterThanOrEqual(1)
    expect(sentences(whatsNew).length).toBeLessThanOrEqual(2)
    expect(whatsNew).toMatch(new RegExp(`^A new ${LABEL} tab `))
    expect(registerFindings(whatsNew).filter(f => f !== 'operating detail')).toEqual([])
  })

  it.runIf(APPLIED)('the three per-processor files of this release hold it, byte for byte, with one newline', () => {
    for (const code of FASTLANE_CODES) {
      expect(read(`fastlane/metadata/android/en-US/changelogs/${code}.txt`), `${code}.txt`).toBe(`${proposal('fastlane')}\n`)
    }
  })
})
