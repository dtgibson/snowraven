// The published claims about the Life Lists tab (life-lists-tab, 1.0.63), held
// to the code.
//
// WHY THIS FILE EXISTS. The docs rule asks that a feature adding sentences to
// `docs/HELP.md` arrive with a guard of the `*PublishedClaims` shape. This build
// added Help's `## Life Lists` section, and the release ships one more published
// sentence about the tab: the F-Droid "What's new", three identical per-processor
// files under `fastlane/metadata/android/en-US/changelogs/`, approved by the user
// word for word.
//
// WHAT IT DOES NOT COVER. The README section, the website feature row and the
// App Store listing bullet were held for the user's yes when this file was
// written, and their rows live in a separate file that arrives with that copy
// (the held-patch rule in `.claude/rules/docs-and-website.md`), so this file stays
// green whether or not that copy has landed.
//
// THE SHAPE IS `palettePublishedClaims.test.ts`'s. It scopes to Help's own
// passage (the `## Life Lists` heading to the next `##`), never the whole
// document, because List Comparer's section talks about "Life Lists" mode on
// purpose. It asserts each claim EXISTS before checking it is right, because
// deleting a sentence is the move a "must contain" guard rewards. It builds every
// name it checks FROM the code (`TAB_LABELS`, `DEFAULT_TAB_ORDER`,
// `MEDIA_FORMATS` with the label each button renders, `SWITCH_LABELS`) rather
// than re-spelling it, so renaming a control or reordering the formats turns this
// red instead of leaving the prose quietly wrong.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_TAB_ORDER, TAB_LABELS } from './tabLayout'
import { MEDIA_FORMATS } from './lifeLists'
import { FORMAT_COPY, SWITCH_LABELS } from './lifeListsCopy'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const HELP = read('docs/HELP.md')
// Pinned to 1.0.63's version code: the Life Lists "What's new" is that
// release's text, and its three files stay in the folder. Reading the CURRENT
// code from tauri.conf.json made the next bump hold 1.0.64's changelog to the
// Life Lists sentence (found at the 1.0.64 bump).
const VERSION_CODE = 1000063
const FASTLANE = [1, 2, 4].map(abi => `fastlane/metadata/android/en-US/changelogs/${10 * VERSION_CODE + abi}.txt`)

const TAB = 'life-lists' as const
const LABEL = TAB_LABELS[TAB]
const AT = DEFAULT_TAB_ORDER.indexOf(TAB)

/** "a, b, and c" / "a, b, or c", the serial-comma list the house register uses. */
function serialList(items: readonly string[], conj: 'and' | 'or'): string {
  if (items.length < 2) return items.join('')
  if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, ${conj} ${items[items.length - 1]}`
}

/** Help's passage for a tab: its `## Label` heading to the next `## `. */
function helpPassage(label: string): string {
  const head = `\n## ${label}\n`
  const i = HELP.indexOf(head)
  expect(i, `docs/HELP.md has a "## ${label}" section`).toBeGreaterThan(-1)
  expect(HELP.indexOf(head, i + 1), `docs/HELP.md has exactly one "## ${label}" section`).toBe(-1)
  const end = HELP.indexOf('\n## ', i + head.length)
  return HELP.slice(i + 1, end === -1 ? undefined : end)
}

/** Every `## ` heading in Help, in document order. */
const HELP_SECTIONS = [...HELP.matchAll(/^## (.+)$/gm)].map(m => m[1].trim())

describe('the Life Lists tab sits where the published copy says it does', () => {
  it('DEFAULT_TAB_ORDER places it directly after Checklists', () => {
    expect(AT, 'life-lists is in DEFAULT_TAB_ORDER').toBeGreaterThan(0)
    expect(DEFAULT_TAB_ORDER[AT - 1]).toBe('checklists')
  })

  it("Help's section runs between its neighbours in DEFAULT_TAB_ORDER", () => {
    const i = HELP_SECTIONS.indexOf(LABEL)
    expect(i, `Help has a "## ${LABEL}" section`).toBeGreaterThan(0)
    expect(HELP_SECTIONS[i - 1]).toBe(TAB_LABELS[DEFAULT_TAB_ORDER[AT - 1]])
    expect(HELP_SECTIONS[i + 1]).toBe(TAB_LABELS[DEFAULT_TAB_ORDER[AT + 1]])
  })
})

describe("Help's Life Lists section", () => {
  const passage = () => helpPassage(LABEL)

  it('exists and opens by naming the tab from TAB_LABELS (non-vacuity)', () => {
    const text = passage()
    expect(text.length).toBeGreaterThan(800)
    expect(text).toContain(`\nThe ${LABEL} tab lists every species on your life list, newest first`)
  })

  it('names the media buttons exactly as the tab renders them, in MEDIA_FORMATS order', () => {
    const buttons = MEDIA_FORMATS.map(f => FORMAT_COPY[f].label)
    expect(buttons.length, 'the tab renders at least two media buttons').toBeGreaterThanOrEqual(2)
    // The control sentence, built from the rendered labels.
    expect(passage()).toContain(`${serialList(buttons.map(b => `**${b}**`), 'and')} turn the list into a `)
    // The list it turns into, and the life lists the ML export adds, from the same manifest.
    const lower = MEDIA_FORMATS.map(f => f.toLowerCase())
    expect(passage()).toContain(` turn the list into a ${serialList(lower, 'or')} life list:`)
    expect(passage()).toContain(`adds ${serialList(lower, 'and')} life lists.`)
  })

  it('names both switches exactly as the tab renders them', () => {
    expect(passage()).toContain(`**${SWITCH_LABELS.escapees}** and **${SWITCH_LABELS.exotics}**, both off by default,`)
  })

  it('carries no em dash', () => {
    expect(passage().includes('\u2014')).toBe(false)
  })
})

describe("the F-Droid What's new for 1.0.63, the Life Lists release", () => {
  const texts = () => FASTLANE.map(p => [p, read(p)] as const)

  it('is three identical files, one per processor-type build (non-vacuity per file)', () => {
    const all = texts()
    expect(all).toHaveLength(3)
    for (const [p, t] of all) expect(t.trim().length, `${p} is not empty`).toBeGreaterThan(100)
    expect(new Set(all.map(([, t]) => t)).size).toBe(1)
  })

  it("names the tab from TAB_LABELS, its place after the tab before it, and the formats from MEDIA_FORMATS", () => {
    const before = TAB_LABELS[DEFAULT_TAB_ORDER[AT - 1]]
    const lower = MEDIA_FORMATS.map(f => f.toLowerCase())
    for (const [p, t] of texts()) {
      expect(t, p).toMatch(new RegExp(`^A new ${LABEL} tab, after ${before}, lists every species `))
      expect(t, p).toContain(`turns into a ${serialList(lower, 'or')} life list, or any combination of them.`)
      expect(t.includes('\u2014'), `${p} carries no em dash`).toBe(false)
    }
  })
})
