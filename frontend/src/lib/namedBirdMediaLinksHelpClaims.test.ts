/// <reference types="node" />
// The published claims about the named-bird item list (ml-media-links, FR-13,
// QA-24), pinned to the code that makes them true. Scoped to the feature's OWN
// passage in `docs/HELP.md`, the "**Media of a named bird.**" paragraph in the
// Named Birds section, with a non-vacuity leg per claim, so deleting the
// sentence or a clause of it goes red (.claude/rules/docs-and-website.md).
// README.md and website/ carry nothing about it: no copy was proposed.
//
// Each claim and what holds it:
//   * "grouped into photos, audio, and video and numbered newest first": the
//     groups follow MEDIA_FORMAT_ORDER, and within a group the gallery's own
//     newest-first order (mediaEmbed.test.ts runs that order through the join).
//   * "each number opens that item on the Macaulay Library": every list href is
//     the tile's own builder, mlAssetUrl(item.catalogId) (source scan below; the
//     component test clicks one).
//   * "covers every item, including the ones behind Show more": the list derives
//     from `assets`, the whole gallery, never the revealed slice (source scan).
//   * "stays the same whatever the players are doing": the list reads no embed
//     state (NamedBirdMediaLinks.test.tsx drives all four states).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { MEDIA_FORMAT_ORDER } from './mediaEmbed'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
/** Comments stripped, so a guard never passes on a commented-out line. */
const code = (p: string) =>
  read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const HELP = read('docs/HELP.md')
const LEAD = '**Media of a named bird.**'

function paragraph(): string {
  const start = HELP.indexOf('\n## Named Birds')
  expect(start, 'docs/HELP.md has a Named Birds section').toBeGreaterThan(-1)
  const next = HELP.indexOf('\n## ', start + 1)
  const section = HELP.slice(start, next === -1 ? undefined : next)
  return section.split('\n').find(l => l.startsWith(LEAD)) ?? ''
}

const PARA = paragraph()
const COMPONENT = code('frontend/src/components/NamedBirdMedia.tsx')

describe('docs/HELP.md, the named-bird item list', () => {
  it('lives once, in the Named Birds "Media of a named bird" paragraph, with no em dash', () => {
    expect(PARA, 'the paragraph exists').not.toBe('')
    expect(HELP.split(LEAD)).toHaveLength(2)
    expect(PARA.split('compact list')).toHaveLength(2)
    expect(PARA).not.toContain('\u2014')
  })

  it('"grouped into photos, audio, and video and numbered newest first" holds', () => {
    expect(PARA).toMatch(/compact list of the bird's items, grouped into photos, audio, and video and numbered newest first/)
    expect(MEDIA_FORMAT_ORDER).toEqual(['Photo', 'Audio', 'Video'])
  })

  it('"each number opens that item on the Macaulay Library" holds: every href is the tile\'s own builder', () => {
    expect(PARA).toMatch(/each number opens that item on the Macaulay Library/)
    expect(COMPONENT).toMatch(/className="sr-mli-link"\s+href=\{mlAssetUrl\(item\.catalogId\)\}/)
  })

  it('"covers every item, including the ones behind Show more" holds: the list derives from the whole gallery', () => {
    expect(PARA).toMatch(/The list covers every item, including the ones behind \*\*Show more\*\*/)
    expect(COMPONENT).toMatch(/useMemo\(\(\) => mediaItemLinkGroups\(assets\), \[assets\]\)/)
    expect(COMPONENT).not.toMatch(/mediaItemLinkGroups\(visible/)
  })

  it('"stays the same whatever the players are doing" is stated', () => {
    expect(PARA).toMatch(/stays the same whatever the players are doing, so it still works while they are blocked, turned off in Settings, or offline/)
  })
})
