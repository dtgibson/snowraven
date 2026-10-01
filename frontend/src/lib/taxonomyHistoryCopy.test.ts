// Copy guard for the splits-and-lumps control and section (taxonomic-splits-lumps;
// QA-17, QA-20, QA-33). Rules over a GENERATED corpus (ui.md v1.0.5), never a ban
// list of known-bad strings: the corpus is built by calling every exported
// builder across the states the section can render (coverage empty, one year,
// a range; each kind, predates or not, zero to three shown slashes; counts
// 0 to 3 under every marker), so a new string joins the sweep by being added to
// the module. What this cannot see: a count-bearing string built inline in a
// component, which is why the components render only what this module returns.

import { describe, it, expect } from 'vitest'
import * as copy from './taxonomyHistoryCopy'
import type { TaxonomyHistory } from './taxonomyHistory'

const COVERAGES: TaxonomyHistory['coverage'][] = [
  null,
  { earliest: { year: 2025, published: '2025-10-31' }, latest: { year: 2025, published: '2025-10-31' } },
  { earliest: { year: 2023, published: '2023-10-24' }, latest: { year: 2025, published: '2025-10-31' } },
]
const DAYS = Array.from({ length: 12 }, (_, m) => `2025-${String(m + 1).padStart(2, '0')}-0${(m % 9) + 1}`)
const SLASHES = ['Eastern/Western Warbling Vireo', 'Hudsonian/Eurasian Whimbrel', "Cory's/Scopoli's Shearwater"]

function corpus(): string[] {
  const out: string[] = [
    copy.CONTROL_LABEL, copy.SECTION_TITLE, copy.KIND_WORD.split, copy.KIND_WORD.lump,
    copy.MARK_YOUR_SPECIES, copy.MARK_NO_REPORTS, copy.MARK_SLASH,
    copy.PART_REASSIGNED, copy.PART_RECORDED_SINCE, copy.PART_PREDATES,
    copy.NOT_AFFECTED, copy.FILTER_LINE, copy.NO_COVERAGE,
  ]
  for (const c of COVERAGES) out.push(copy.coverageLine(c), copy.panelHead(c), copy.zeroAffected(c))
  for (const d of DAYS) {
    out.push(copy.updateLabel(d), copy.publishedDayLabel(d))
    const n = copy.predatesNote(d)
    out.push(n.lead + n.rest)
    for (const kind of ['split', 'lump'] as const) {
      out.push(copy.altKindLine(kind, d))
      for (const predates of [false, true]) {
        for (let k = 0; k <= SLASHES.length; k += 1) {
          out.push(copy.eventSentenceText(copy.eventSentence(kind, d, { predates, lumpName: 'Redpoll', slashNames: SLASHES.slice(0, k) })))
        }
      }
    }
  }
  for (let n = 0; n <= 3; n += 1) {
    out.push(copy.reportCountLabel(n), copy.speciesCountLabel(n))
    for (let b = 0; b <= n; b += 1) {
      for (const yours of [false, true]) for (const slash of [false, true]) for (const predates of [false, true]) {
        out.push(copy.altEntryTail({ count: n, onOrBefore: b, after: n - b }, { yours, slash, predates }))
        // The partition line as the node renders it: "<b> reassigned by eBird".
        out.push(`${b} ${copy.PART_REASSIGNED}`, `${n - b} ${copy.PART_RECORDED_SINCE}`)
      }
    }
  }
  return out
}

describe('the copy corpus', () => {
  const all = corpus()

  it('is non-vacuous', () => {
    expect(all.length).toBeGreaterThan(300)
  })

  it('carries no em dash', () => {
    for (const s of all) expect(s, s).not.toContain('\u2014')
  })

  it('no count of one takes a plural noun', () => {
    for (const s of all) expect(s, s).not.toMatch(/\b1 (?!species\b)[a-z]+s\b/)
  })

  it('never proposes, ranks or corrects which daughter a report belongs to (FR-17)', () => {
    const proposing = /\b(should|probably|likely|belongs?|correct(ed|ion)?|fix|suggest|recommend|re-?identify|was really|actually)\b/i
    for (const s of all) expect(s, s).not.toMatch(proposing)
  })

  it('names eBird as the one who reassigned, in the partition label and every non-predates sentence', () => {
    expect(copy.PART_REASSIGNED).toMatch(/\beBird\b/)
    for (const s of all.filter(x => x.startsWith('eBird reassigned'))) expect(s).toMatch(/^eBird reassigned every report dated on or before /)
  })
})

describe('the formatters', () => {
  it('names an update by month and year and a day in full, from a fixed English month table', () => {
    expect(copy.updateLabel('2025-10-31')).toBe('October 2025')
    expect(copy.publishedDayLabel('2025-10-31')).toBe('31 October 2025')
    expect(copy.publishedDayLabel('2024-01-05')).toBe('5 January 2024')
    expect(DAYS.map(copy.updateLabel).map(s => s.split(' ')[0])).toEqual([
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ])
  })

  it('states the coverage in every shape, with the empty form (FR-20)', () => {
    expect(copy.coverageLine(COVERAGES[0])).toBe('No eBird taxonomy updates are covered in this build.')
    expect(copy.coverageLine(COVERAGES[1])).toBe("Covers eBird's 2025 taxonomy update. A change made before 2025 is not recorded here.")
    expect(copy.coverageLine(COVERAGES[2])).toBe("Covers eBird's 2023 to 2025 taxonomy updates. A change made before 2023 is not recorded here.")
    expect(copy.zeroAffected(COVERAGES[2])).toBe("None of the species in your loaded data was split or lumped in eBird's 2023 to 2025 taxonomy updates. A change made before 2023 is not recorded here.")
    expect(copy.panelHead(COVERAGES[2])).toBe('Every species in your loaded data that eBird split or lumped in its 2023 to 2025 taxonomy updates. Pick one to see what changed, when, and where your reports went.')
  })

  it('writes the three approved sentence forms exactly', () => {
    const t = (k: 'split' | 'lump', predates: boolean, slashNames: string[] = []) =>
      copy.eventSentenceText(copy.eventSentence(k, '2025-10-31', { predates, lumpName: 'Redpoll', slashNames }))
    expect(t('split', false, ['Eastern/Western Warbling Vireo'])).toBe('eBird reassigned every report dated on or before 31 October 2025 to one of the new names when it made this split. Reports dated after it were recorded under the current names. Reports it could not place went to Eastern/Western Warbling Vireo.')
    expect(t('lump', false)).toBe('eBird reassigned every report dated on or before 31 October 2025 to Redpoll when it made this lump. Your backup no longer carries the earlier names.')
    expect(t('split', true)).toBe('eBird reassigned every report dated on or before 31 October 2025 when it made this split. Your backup was exported before that, so the reassignment is not in it yet.')
    expect(t('split', false, SLASHES)).toContain("went to Eastern/Western Warbling Vireo, Hudsonian/Eurasian Whimbrel, and Cory's/Scopoli's Shearwater.")
    expect(t('split', false, SLASHES.slice(0, 2))).toContain('went to Eastern/Western Warbling Vireo and Hudsonian/Eurasian Whimbrel.')
  })

  it('reads an entry for the text equivalent in the approved shapes (FR-22)', () => {
    expect(copy.altEntryTail({ count: 0, onOrBefore: 0, after: 0 }, { yours: false, slash: false, predates: false })).toBe(': no reports under this name.')
    expect(copy.altEntryTail({ count: 312, onOrBefore: 289, after: 23 }, { yours: true, slash: false, predates: false })).toBe(', your species: 312 reports, 289 reassigned by eBird, 23 recorded since.')
    expect(copy.altEntryTail({ count: 1, onOrBefore: 1, after: 0 }, { yours: true, slash: false, predates: true })).toBe(', your species: 1 report, all dated before the update.')
    expect(copy.altEntryTail({ count: 4, onOrBefore: 4, after: 0 }, { yours: false, slash: true, predates: false })).toBe(', the slash entry for reports eBird could not assign: 4 reports, 4 reassigned by eBird, 0 recorded since.')
  })

  it('the predates note and the stale day are built from the published date', () => {
    expect(copy.predatesNote('2025-10-31')).toEqual({
      lead: 'Your backup predates the October 2025 update',
      rest: ', so your reports still carry the earlier name. A fresh backup from eBird shows where they went.',
    })
  })
})
