// The published claims about the Family Tree tab (family-rollups-and-tree
// FR-72, FR-73; QA-69), held to the code.
//
// THE SHAPE IS `lifeListsPublishedClaims.test.ts`'s. It scopes to Help's own
// passage (the `## Family Tree` heading to the next `##`), never the whole
// document. It asserts each claim EXISTS before checking it is right, because
// deleting a sentence is the move a "must contain" guard rewards. It builds
// every name it checks FROM the code (`TAB_LABELS`, `DEFAULT_TAB_ORDER`, the
// copy module's labels, the settings keys) rather than re-spelling it.
//
// WHAT IT DOES NOT COVER. The README and website sentences are held for the
// user's yes (FR-74) and their rows arrive with that copy, in a separate file,
// so this file stays green whether or not that copy has landed.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_TAB_ORDER, TAB_LABELS } from './tabLayout'
import { SWITCH_LABELS, EVERYWHERE_LABEL, REGION_CONTROL_LABEL } from './lifeListsCopy'
import { OPEN_TREE_LABEL, COLLAPSE, COLLAPSE_ALL, EXPAND, EXPAND_ALL, FIT, FOCUS, KIND_COPY, MEDIA_LABEL, NOT_PLACED_HEADING, RESET, SORT_LABEL, VIEW_LABELS, YEAR_LABEL } from './familyTreeCopy'
import { BOW_FAMILY_LINK_VERIFIED, ML_FAMILY_LINK_VERIFIED } from './familyTreeLinks'
import { DEFAULT_NAMES, FAMILY_TREE_NAMES_SETTING, FAMILY_TREE_REGION_SETTING, FAMILY_TREE_VIEW_SETTING, defaultViewFor } from './familyTreeSettings'

const HELP = readFileSync(new URL('../../../docs/HELP.md', import.meta.url), 'utf8')
const TAB = 'family-tree' as const
const LABEL = TAB_LABELS[TAB]
const AT = DEFAULT_TAB_ORDER.indexOf(TAB)

function helpPassage(label: string): string {
  const head = `\n## ${label}\n`
  const i = HELP.indexOf(head)
  expect(i, `docs/HELP.md has a "## ${label}" section`).toBeGreaterThan(-1)
  expect(HELP.indexOf(head, i + 1), `exactly one "## ${label}"`).toBe(-1)
  const end = HELP.indexOf('\n## ', i + head.length)
  return HELP.slice(i, end === -1 ? undefined : end)
}
const PASSAGE = helpPassage(LABEL)
/** The passage's sentences, so a claim is read as what a sentence states. */
const SENTENCES = PASSAGE.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z*])/)
function sentenceWith(...needles: string[]): string {
  const s = SENTENCES.find(x => needles.every(n => x.includes(n)))
  expect(s, `a Family Tree Help sentence naming ${needles.join(' + ')}`).toBeTruthy()
  return s!
}

describe('where the section sits', () => {
  it('between its neighbours in the default tab order', () => {
    const prev = TAB_LABELS[DEFAULT_TAB_ORDER[AT - 1]]
    const next = TAB_LABELS[DEFAULT_TAB_ORDER[AT + 1]]
    const iPrev = HELP.indexOf(`\n## ${prev}\n`)
    const iThis = HELP.indexOf(`\n## ${LABEL}\n`)
    const iNext = HELP.indexOf(`\n## ${next}\n`)
    expect(iPrev).toBeGreaterThan(-1)
    expect(iThis).toBeGreaterThan(iPrev)
    expect(iNext).toBeGreaterThan(iThis)
  })
  it('the Getting Started and Default Files lists of what the files power name the tab', () => {
    const gs = HELP.slice(HELP.indexOf('\n## Getting Started\n'), HELP.indexOf('\n## Search\n'))
    expect(gs).toMatch(new RegExp(`This powers the [^.]*\\b${LABEL}\\b`))
    const df = HELP.slice(HELP.indexOf('\n## Default Files\n'), HELP.indexOf('\n## Weather\n'))
    expect(df).toMatch(new RegExp(`The eBird backup is used by every tab: [^.]*\\b${LABEL}\\b`))
    expect(df).toMatch(new RegExp(`the ${LABEL} tab's photo, audio and video figures`))
  })
})

describe('the controls the passage names are the controls the tab draws', () => {
  it('Region and Everywhere', () => {
    const s = sentenceWith(`**${REGION_CONTROL_LABEL}**`)
    expect(s).toContain(`**${EVERYWHERE_LABEL}**`)
  })
  it('Year', () => {
    sentenceWith(`**${YEAR_LABEL}**`, 'calendar year')
  })
  it('Include Escapees, off by default, read and never run', () => {
    sentenceWith(`**${SWITCH_LABELS.escapees}**`, 'off by default')
    sentenceWith('only reads the result of that check and never runs it')
  })
  it('Media, with the two words each pill shows past its rest state', () => {
    const s = PASSAGE.split('\n\n').find(p => p.startsWith(`**${MEDIA_LABEL}**`))
    expect(s, 'the Media paragraph').toBeTruthy()
    const has = KIND_COPY.photo.has.split(' ')[0]
    const no = KIND_COPY.photo.lacks.split(' ')[0]
    expect(s!).toContain(`**${has}**`)
    expect(s!).toContain(`**${no}**`)
    for (const k of Object.values(KIND_COPY)) expect(k.has.startsWith(has) && k.lacks.startsWith(no)).toBe(true)
  })
  it('Names, which opens on Both', () => {
    const s = sentenceWith('**Names**', 'both at once')
    expect(s).toContain('which is where it opens')
    expect(DEFAULT_NAMES).toBe('both')
  })
  it('Expand all, Collapse all and Sort', () => {
    sentenceWith(`**${EXPAND_ALL}**`, `**${COLLAPSE_ALL}**`)
    sentenceWith(`**${SORT_LABEL}**`, 'taxonomic order')
  })
  it('Not placed, with the reason that no family is guessed', () => {
    sentenceWith(`**${NOT_PLACED_HEADING}**`, 'never guessed')
  })
})

describe('the tree and Find (Slice B)', () => {
  it('the view switch by its two labels, and the first view by the window', () => {
    sentenceWith(`**${VIEW_LABELS.rollup}**`, `**${VIEW_LABELS.diagram}**`)
    const s = sentenceWith('When you first open the tab')
    expect(s).toContain('the tree in a wide window and the table on a phone')
    expect([defaultViewFor(false), defaultViewFor(true)]).toEqual(['diagram', 'rollup'])
  })
  it('the tools and the readout actions by their labels', () => {
    sentenceWith(`**${FIT}**`, `**${RESET}**`)
    sentenceWith(`**${EXPAND}**`, `**${COLLAPSE}**`, `**${FOCUS}**`)
  })
  it('the tree is one Tab stop with its keys', () => {
    const s = sentenceWith('one stop for the Tab key')
    expect(s).toContain('plus, minus and zero zoom in, out and to fit')
  })
  it('a family links to Birds of the World, and no family-level Macaulay link is claimed (D-47)', () => {
    sentenceWith('A selected family also links to its account on Birds of the World')
    sentenceWith("Press a family's row to open it", "under a link to the family's account on Birds of the World")
    expect(BOW_FAMILY_LINK_VERIFIED).toBe(true)
    expect(ML_FAMILY_LINK_VERIFIED).toBe(false)
    expect(/family[^.]*Macaulay|Macaulay[^.]*famil/i.test(PASSAGE.replace(/\s+/g, ' '))).toBe(false)
  })
  it('full screen and the phone still, by the opener\'s own label and the shared Exit word (FR-72)', async () => {
    const { EXIT_WORD } = await import('./mapStillCopy')
    const s = sentenceWith(`**${OPEN_TREE_LABEL}**`, 'a swipe on it scrolls the page')
    expect(s).toContain(`**${EXIT_WORD}**`)
    sentenceWith("The toolbar's fullscreen button opens the tree to fill the window")
    sentenceWith('Your zoom, place and selection are kept between visits to fullscreen')
  })
  it('Find searches all four levels by either name, and a species by its code', () => {
    const s = sentenceWith('**Find** searches every species, genus, family and order')
    expect(s).toContain('by common or scientific name in any Names state')
    expect(s).toContain('four-letter code')
  })
})

describe('the claims about figures and memory', () => {
  it('world totals never change with the filters', () => {
    sentenceWith('never change with the filters')
  })
  it('the remembered choices are the keys the tab writes, and the rest are per-session', () => {
    const s = sentenceWith('SnowRaven remembers the region, the names and the view you choose')
    expect(s).toContain('per-session, resetting on relaunch')
    expect([FAMILY_TREE_REGION_SETTING, FAMILY_TREE_NAMES_SETTING, FAMILY_TREE_VIEW_SETTING]).toEqual(['familyTreeRegion', 'familyTreeNames', 'familyTreeView'])
    expect(PASSAGE).not.toContain('on this device')
  })
  it('nothing is looked up for the tab', () => {
    sentenceWith('nothing is looked up for the tab')
  })
})
