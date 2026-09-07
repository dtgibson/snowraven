// The published claims about the Named Birds sighting timelines, pinned.
//
// WHY THIS FILE EXISTS, and it is worth saying plainly: FR-50 rested on a guard
// that did not exist. It stated that "the `EXCLUSIONS` docstring in
// `lib/tabOrderCoverage.test.ts` checks that published prose against the
// roster", and that file never reads `ACCESSIBILITY.md` at all — every mention
// of it there is a comment. Mutating `aria-activedescendant` to
// `roving tabindex` in the published statement left that suite 13/13 green and
// the whole 5,116-test suite green with it. The prose was right and the guard
// was imaginary, which is the worse of the two ways to be wrong: nothing would
// have gone red when it drifted.
//
// WHY THE WORDING IS LOAD-BEARING RATHER THAN STYLISTIC. The app ships BOTH
// keyboard patterns and `tabOrderCoverage.test.ts`'s own docstring distinguishes
// them, having recorded an earlier summary that conflated the two as "false
// twice over":
//
//   roving tabindex        the container holds ONE stop and `tabIndex` moves
//                          between members; FOCUS itself moves
//                          (TabNav's vertical tablist, Settings' RadioGroups)
//   aria-activedescendant  ONE focusable owns a long, data-scaled option list;
//                          an INDEX moves and focus does not
//                          (SpeciesCombobox, and now both timeline strips)
//
// A sentence calling these strips roving would be false, and it would be false
// in the direction that matters: it would describe up to 20,000 marks as each
// holding a `tabIndex`, which is the arrangement the design rejected.
//
// WHY PASSAGES ARE EXTRACTED RATHER THAN WHOLE FILES. `ACCESSIBILITY.md`
// legitimately describes roving tabindex elsewhere, for the groups that really
// do use it. A whole-document guard would either fail on those true sentences or
// be loosened until it asserted nothing. Each file's own Named Birds passage is
// its own population.
//
// EVERY ROW ASSERTS THE PASSAGE EXISTS BEFORE CHECKING WHAT IT SAYS. Deleting
// the sentence is the move an author under time pressure actually reaches for,
// and it is the one a naive "must contain" guard rewards.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { endpoints, masterHead, perBirdHead } from './namedBirdTimelineCopy'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

/** `ACCESSIBILITY.md`'s Named Birds timelines paragraph. */
function accessibilityPassage(): string {
  const src = read('ACCESSIBILITY.md')
  const start = src.indexOf('**Named Birds sighting timelines.**')
  expect(start, 'ACCESSIBILITY.md describes the Named Birds sighting timelines').toBeGreaterThan(-1)
  const rest = src.slice(start)
  const end = rest.indexOf('\n\n')
  return end === -1 ? rest : rest.slice(0, end)
}

/** `ACCESSIBILITY.md`'s Keyboard Navigation section, heading to the next `##`. */
function keyboardSection(): string {
  const src = read('ACCESSIBILITY.md')
  const start = src.indexOf('\n## Keyboard Navigation\n')
  expect(start, 'ACCESSIBILITY.md has a Keyboard Navigation section').toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const end = rest.indexOf('\n## ', 1)
  return end === -1 ? rest : rest.slice(0, end)
}

/** `docs/HELP.md`'s `## Named Birds` section. */
function helpSection(): string {
  const src = read('docs/HELP.md')
  const start = src.indexOf('\n## Named Birds\n')
  expect(start, 'docs/HELP.md has a `## Named Birds` section').toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const end = rest.indexOf('\n## ', 1)
  return end === -1 ? rest : rest.slice(0, end)
}

/** `README.md`'s Named Birds bullet. */
function readmeBullet(): string {
  const line = read('README.md').split('\n').find(l => l.startsWith('- **Named Birds**'))
  expect(line, 'README.md has a Named Birds feature bullet').toBeTruthy()
  return line as string
}

/** The website's Named Birds feature row, tags stripped so the prose reads as prose. */
function sitePassage(): string {
  const src = read('website/index.html')
  const h = src.indexOf('<h3>Named Birds</h3>')
  expect(h, 'website/index.html has a Named Birds feature row').toBeGreaterThan(-1)
  const rest = src.slice(h)
  const end = rest.indexOf('</article>')
  return rest.slice(0, end === -1 ? undefined : end).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
}

describe('ACCESSIBILITY.md names the right keyboard pattern (FR-50 / QA-89)', () => {
  it('says the two new listboxes use aria-activedescendant', () => {
    const p = accessibilityPassage()
    expect(p).toContain('aria-activedescendant')
  })

  it('says they are NOT roving tabindex, which is the clause that can go false', () => {
    // THE MUTATION THIS GUARD EXISTS FOR: replacing `aria-activedescendant` with
    // `roving tabindex` in that sentence. Matched as the negation rather than as
    // a ban on the phrase, because the same passage legitimately names roving in
    // order to distinguish itself from it.
    const p = accessibilityPassage()
    expect(p).toMatch(/aria-activedescendant`?,? not roving tabindex/i)
    // ...and it must never assert the opposite.
    expect(p).not.toMatch(/(these|the two|both)[^.]{0,60}(use|are)[^.]{0,20}roving tabindex/i)
  })

  it('describes BOTH strips, beside the roving groups the section already publishes', () => {
    const p = accessibilityPassage()
    expect(p.toLowerCase()).toContain('card')
    expect(p.toLowerCase()).toContain('shared axis')
    // Non-vacuity for "beside": the roving groups really are published in the
    // same section, so the distinction the passage draws has something to draw
    // itself against.
    const section = keyboardSection()
    expect(section).toContain('arrow-key radio groups')
    expect(section.toLowerCase()).toContain('vertical list')
  })

  it('states the tab-stop count and its invariance, which is what made the design acceptable', () => {
    const p = accessibilityPassage()
    expect(p).toMatch(/exactly two tab stops/i)
    expect(p).toMatch(/does not grow with the number of birds/i)
  })

  it('states the keyboard map it publishes, and does not claim Enter or Space do something', () => {
    const p = accessibilityPassage()
    expect(p).toMatch(/Home and End/)
    expect(p).toMatch(/Escape/)
    expect(p).toMatch(/Enter and Space are deliberately bound to nothing/i)
  })
})

describe('the three restatements carry the same formulation (QA-66 / QA-67)', () => {
  // Compared against EACH OTHER, not only each against the code: one file having
  // a claim right does not make the others right, and a sweep failure looks
  // exactly like a wording difference until they are diffed.
  const passages = (): Array<[string, string]> => [
    ['docs/HELP.md', helpSection()],
    ['README.md', readmeBullet()],
    ['website/index.html', sitePassage()],
  ]

  it('each file has a Named Birds passage at all (non-vacuity, per file)', () => {
    for (const [file, text] of passages()) {
      expect(text.length, `${file} passage is empty`).toBeGreaterThan(80)
    }
  })

  it('each names the timelines', () => {
    for (const [file, text] of passages()) {
      expect(text.toLowerCase(), `${file} must name the timelines`).toMatch(/timeline|over time/)
    }
  })

  it('each says the figure names which two dates it measures', () => {
    for (const [file, text] of passages()) {
      expect(text.toLowerCase(), `${file} must state the figure's endpoints`)
        .toMatch(/which two dates|first to last sighting|first sighting to/)
    }
  })

  it('each says the marks are selectable and the arrow keys step through them', () => {
    for (const [file, text] of passages()) {
      expect(text.toLowerCase(), `${file} must say the marks can be read`).toMatch(/arrow keys/)
      expect(text.toLowerCase(), `${file} must say a line names the sighting`)
        .toMatch(/names? (that|its|the) sighting|line beneath|line underneath|read any one of them/)
    }
  })

  it('README and the website share one formulation for the switch', () => {
    // The two short restatements are the pair most likely to drift, and the
    // v1.0.20 sweep failure was exactly this shape: the right words existed in
    // the same diff, in a different file.
    expect(readmeBullet()).toContain("last sighting to today")
    expect(sitePassage()).toContain("last sighting to today")
  })

  it('docs/HELP.md uses the settled house phrasing for a session-only setting', () => {
    expect(helpSection()).toContain('per-session, resetting on relaunch')
  })

  it('the visible headings in the prose are the ones the app actually renders', () => {
    // Built FROM the copy module rather than re-spelled, so a relabel moves the
    // guard with the screen instead of leaving a third copy behind it.
    expect(helpSection()).toContain(perBirdHead)
    expect(helpSection().toLowerCase()).toContain(masterHead.toLowerCase())
    for (const [file, text] of passages()) {
      expect(text.toLowerCase(), `${file} must use the shipped endpoint wording`)
        .toContain(endpoints('today').split(' to ')[1])
    }
  })

  it('no prose names this surface from a component or a file name', () => {
    // `TAB_LABELS` cannot arbitrate an internal name, so the check is mechanical:
    // grep the prose for every identifier appearing in the feature's own
    // filenames. "master timeline" is the one that nearly reached the screen.
    const BANNED = [/NamedBird[A-Z]/, /\btick ?list\b/i, /\bmaster timeline\b/i, /\bRangeControl\b/]
    for (const [file, text] of [...passages(), ['ACCESSIBILITY.md', accessibilityPassage()] as [string, string]]) {
      for (const re of BANNED) {
        expect(re.test(text), `${file} names the surface from a component or file name: ${re}`).toBe(false)
      }
    }
  })

  it('no em dash reaches any of the four published surfaces', () => {
    for (const file of ['docs/HELP.md', 'README.md', 'website/index.html', 'ACCESSIBILITY.md']) {
      expect(read(file).includes('—'), `${file} carries an em dash`).toBe(false)
    }
  })
})

describe('PRIVACY_POLICY.md needs no change, and the decision is recorded rather than silent', () => {
  it('the feature adds no provider, no request and nothing written to disk, so the policy is untouched', () => {
    // Recorded as an assertion rather than left as a sentence in a hand-back: the
    // range and the selection are session-only React state, no module in this
    // feature reaches `transport` or a Tauri service (the import-graph walk in
    // `entryChunk.test.ts` proves that half), and nothing here writes a file. If
    // a later change makes any of that false, the policy needs updating in the
    // SAME change, and this row is where that is written down.
    const policy = read('PRIVACY_POLICY.md')
    expect(policy).not.toMatch(/named.bird.*timeline/i)
    expect(policy.length).toBeGreaterThan(500)
  })
})
