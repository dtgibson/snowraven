// The Life Lists sentences on the three decision surfaces (life-lists-tab,
// 1.0.63): the README section, the website feature row and the App Store
// listing bullet, held to the code and to each other.
//
// WHY A SEPARATE FILE. These three are published copy and waited for the
// user's express yes; the held-patch rule (`.claude/rules/docs-and-website.md`)
// puts a held patch's guard rows in a file the run does not otherwise edit, so
// the patch can be applied or dropped as one unit. Help and the F-Droid
// changelog are guarded in `lifeListsPublishedClaims.test.ts`.
//
// THE SHAPE IS `palettePublishedClaims.test.ts`'s: each file's own passage (a
// README `###` section, a website `<h3>` article, a listing bullet line), the
// claim asserted to EXIST before it is checked, every name built from the code
// (`TAB_LABELS`, `DEFAULT_TAB_ORDER`, `MEDIA_FORMATS`), and the three files
// compared with each other as well as with the code, because the register asks
// them to say the same thing in the same words.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_TAB_ORDER, TAB_LABELS } from './tabLayout'
import { MEDIA_FORMATS } from './lifeLists'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const README = read('README.md')
const SITE = read('website/index.html')
const LISTING = read('appstore/LISTING.md')

const TAB = 'life-lists' as const
const LABEL = TAB_LABELS[TAB]
const AT = DEFAULT_TAB_ORDER.indexOf(TAB)
const BEFORE = TAB_LABELS[DEFAULT_TAB_ORDER[AT - 1]]
const AFTER = TAB_LABELS[DEFAULT_TAB_ORDER[AT + 1]]

function serialList(items: readonly string[], conj: 'and' | 'or'): string {
  if (items.length < 2) return items.join('')
  if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, ${conj} ${items[items.length - 1]}`
}

/** The sentence's shape, with the formats built from the manifest. */
const FORMATS_CLAUSE = `turns into a ${serialList(MEDIA_FORMATS.map(f => f.toLowerCase()), 'or')} life list, or any combination of them.`
const LEAD = 'ists every species you have recorded along with its first checklist and place, and '

const collapse = (t: string) => t.replace(/\s+/g, ' ').trim()

/** README: the body of `### Label`, up to the next heading. */
function readmeSection(label: string): string {
  const head = `\n### ${label}\n`
  const i = README.indexOf(head)
  expect(i, `README.md has a "### ${label}" section`).toBeGreaterThan(-1)
  const rest = README.slice(i + head.length)
  const end = rest.search(/\n#{2,3} /)
  return collapse(end === -1 ? rest : rest.slice(0, end))
}

/** Website: the `<article>` whose heading is `<h3>Label</h3>`, and its offset. */
function siteArticle(label: string): { at: number; html: string } {
  const h = SITE.indexOf(`<h3>${label}</h3>`)
  expect(h, `website/index.html has an <h3>${label}</h3> row`).toBeGreaterThan(-1)
  const start = SITE.lastIndexOf('<article', h)
  const end = SITE.indexOf('</article>', h)
  return { at: start, html: SITE.slice(start, end) }
}

/** Website: an article's body paragraph as prose. */
function siteSentence(label: string): string {
  const { html } = siteArticle(label)
  const p = html.indexOf('<p>')
  expect(p, `the ${label} row has a bare <p>`).toBeGreaterThan(-1)
  return collapse(html.slice(p + 3, html.indexOf('</p>', p)).replace(/<[^>]*>/g, ' '))
}

/** Listing: the bullet line for a label (a U+2022 bullet, then `Label: `). */
function listingBullet(label: string): { at: number; text: string } {
  const lead = `\n\u2022 ${label}: `
  const i = LISTING.indexOf(lead)
  expect(i, `appstore/LISTING.md has a "${label}" bullet`).toBeGreaterThan(-1)
  return { at: i, text: LISTING.slice(i + lead.length, LISTING.indexOf('\n', i + 1)) }
}

describe('the Life Lists sentence on the three decision surfaces', () => {
  it('README.md: a section named from TAB_LABELS, between its neighbours in DEFAULT_TAB_ORDER', () => {
    const at = README.indexOf(`\n### ${LABEL}\n`)
    expect(at).toBeGreaterThan(README.indexOf(`\n### ${BEFORE}\n`))
    expect(at).toBeLessThan(README.indexOf(`\n### ${AFTER}\n`))
    expect(README.indexOf(`\n### ${BEFORE}\n`)).toBeGreaterThan(-1)
    const s = readmeSection(LABEL)
    expect(s).toBe(`L${LEAD}${FORMATS_CLAUSE}`)
  })

  it('website/index.html: a row between its neighbours, the same sentence, and the figure it promises', () => {
    const row = siteArticle(LABEL)
    expect(row.at).toBeGreaterThan(siteArticle(BEFORE).at)
    expect(row.at).toBeLessThan(siteArticle(AFTER).at)
    expect(siteSentence(LABEL)).toBe(`L${LEAD}${FORMATS_CLAUSE}`)
    expect(row.html).toContain('src="assets/shots/life-lists.webp"')
  })

  it('website/index.html: the feature rows still alternate, odd rows media right and even rows reverse', () => {
    const start = SITE.indexOf('<section class="features"')
    const section = SITE.slice(start, SITE.indexOf('</section>', start))
    const rows = [...section.matchAll(/<article class="([^"]*)"/g)].map(m => m[1])
    expect(rows.length, 'the features section has rows (non-vacuity)').toBeGreaterThanOrEqual(10)
    rows.forEach((cls, i) => expect(cls, `row ${i + 1}`).toBe(i % 2 === 0 ? 'feature-row' : 'feature-row reverse'))
  })

  it('appstore/LISTING.md: a bullet named from TAB_LABELS, between its neighbours, the same sentence', () => {
    const b = listingBullet(LABEL)
    expect(b.at).toBeGreaterThan(listingBullet(BEFORE).at)
    expect(b.at).toBeLessThan(listingBullet(AFTER).at)
    expect(b.text).toBe(`l${LEAD}${FORMATS_CLAUSE}`)
  })

  it('the three files say the same thing in the same words', () => {
    const readme = readmeSection(LABEL)
    expect(siteSentence(LABEL)).toBe(readme)
    expect(listingBullet(LABEL).text).toBe(readme.charAt(0).toLowerCase() + readme.slice(1))
  })

  it("the listing's recorded description length matches its block", () => {
    const m = /\n## Description \(([\d,]+) \/ 4,000\)\n/.exec(LISTING)
    expect(m, 'the Description heading records its length').not.toBeNull()
    const from = LISTING.indexOf('```\n', m!.index) + 4
    const block = LISTING.slice(from, LISTING.indexOf('\n```', from))
    expect(Number(m![1].replace(/,/g, ''))).toBe(block.length)
    expect(block.length).toBeLessThanOrEqual(4000)
  })

  it('carries no em dash', () => {
    for (const t of [readmeSection(LABEL), siteSentence(LABEL), listingBullet(LABEL).text, siteArticle(LABEL).html]) {
      expect(t.includes('\u2014')).toBe(false)
    }
  })
})
