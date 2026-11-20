// Copy guard for the splits-and-lumps control and section (taxonomic-splits-lumps;
// QA-17, QA-20, QA-33). Rules over a GENERATED corpus (ui.md v1.0.5), never a ban
// list of known-bad strings: the corpus is built by calling every exported
// builder across the states the section can render (coverage empty, one year,
// a range; each kind, predates or not, zero to three shown slashes; counts
// 0 to 3 under every marker), so a new string joins the sweep by being added to
// the module. What this cannot see: a count-bearing string built inline in a
// component, which is why the components render only what this module returns.
//
// recorded-names-in-splits-and-lumps widens the corpus to every new builder per
// render state (each kind, each earlierState, predates or not, traced or not,
// counts 0 to 3 under every earlier-name state, the residual 1 to 3) and adds
// the rules its PRD states: no `them` or `they` after a count of one (NFR-06),
// nothing that claims what the user typed or the name on a sighting's day
// (FR-26, QA-28), and no rename string that dates the change to the update's
// day or makes the update its author (FR-04, FR-24, QA-26).

import { describe, it, expect } from 'vitest'
import * as copy from './taxonomyHistoryCopy'
import type { EarlierFigure, HistoryKind, TaxonomyHistory } from './taxonomyHistory'

const COVERAGES: TaxonomyHistory['coverage'][] = [
  null,
  { earliest: { year: 2025, published: '2025-10-31' }, latest: { year: 2025, published: '2025-10-31' } },
  { earliest: { year: 2023, published: '2023-10-24' }, latest: { year: 2025, published: '2025-10-31' } },
]
const DAYS = Array.from({ length: 12 }, (_, m) => `2025-${String(m + 1).padStart(2, '0')}-0${(m % 9) + 1}`)
const SLASHES = ['Eastern/Western Warbling Vireo', 'Hudsonian/Eurasian Whimbrel', "Cory's/Scopoli's Shearwater"]

const KINDS: HistoryKind[] = ['split', 'lump', 'rename']
const STATES = ['pre-update', 'later-changed', 'counted'] as const
const FORMS = ['', 'Western Flycatcher (Pacific-slope)']

/** The sentences and paragraphs each kind can render, per state. */
function sentences(kind: HistoryKind, d: string): string[] {
  const out: string[] = []
  for (const earlierState of STATES) for (const predates of [false, true]) for (const anyTraced of [false, true]) {
    // predates is a subset of pre-update (the shipped FR-19 flag).
    if (predates && earlierState !== 'pre-update') continue
    for (let k = 0; k <= (kind === 'split' ? SLASHES.length : 0); k += 1) {
      out.push(copy.partsText(copy.eventSentence(kind, d, {
        earlierState, predates, anyTraced, lumpName: 'Redpoll', slashNames: SLASHES.slice(0, k),
        earlierName: "McCown's Longspur", currentName: 'Thick-billed Longspur',
      })))
    }
  }
  for (let residual = 0; residual <= 3; residual += 1) {
    out.push(copy.partsText(copy.explanatoryParagraph(kind, { earlierName: 'Whimbrel', residual })))
  }
  return out
}

/** Every earlier-name state's box and text-equivalent reading, counts 0 to 3. */
function earlierNames(kind: HistoryKind): string[] {
  const out: string[] = []
  const figures: EarlierFigure[] = [
    ...[0, 1, 2, 3].map(n => ({ state: 'count' as const, n })),
    { state: 'untraceable', reason: 'survivor' }, { state: 'untraceable', reason: 'no-form' },
  ]
  for (const form of FORMS) {
    for (const earlier of figures) {
      for (const st of ['later-changed', 'counted'] as const) {
        out.push(copy.altEarlierTail(kind, st, { earlier, form }, { currentName: 'Thick-billed Longspur', lumpedName: 'Western Flycatcher' }))
      }
      if (earlier.state === 'count') {
        out.push(copy.reportCountLabel(earlier.n), copy.basisLine(earlier.n, kind))
        out.push(copy.partsText(copy.zeroLine(kind, { form: form || 'Redpoll (Common)', currentName: 'Thick-billed Longspur' })))
      } else if (earlier.state === 'untraceable') {
        out.push(copy.partsText(copy.untraceableLine(earlier.reason, 'Western Flycatcher')))
      }
    }
    if (form) out.push(copy.partsText(copy.formLine(form)))
  }
  return out
}

function corpus(): string[] {
  const out: string[] = [
    copy.CONTROL_LABEL, copy.SECTION_TITLE, copy.KIND_WORD.split, copy.KIND_WORD.lump, copy.KIND_WORD.rename,
    copy.MARK_YOUR_SPECIES, copy.MARK_NO_REPORTS, copy.MARK_SLASH,
    copy.MARK_RESIDUAL, copy.MARK_UNTRACEABLE, copy.MARK_ZERO, copy.MARK_LATER, copy.LATER_LINE,
    copy.PART_REASSIGNED, copy.PART_RENAMED, copy.PART_RECORDED_SINCE, copy.PART_PREDATES,
    copy.NOT_AFFECTED, copy.FILTER_LINE, copy.NO_COVERAGE,
  ]
  for (const c of COVERAGES) out.push(copy.coverageLine(c), copy.panelHead(c), copy.zeroAffected(c))
  for (const d of DAYS) {
    out.push(copy.updateLabel(d), copy.publishedDayLabel(d))
    for (const kind of KINDS) {
      const n = copy.predatesNote(d, kind)
      out.push(n.lead + n.rest)
      out.push(copy.altKindLine(kind, d), copy.badgeDate(kind, d))
      out.push(...sentences(kind, d))
    }
  }
  for (const kind of KINDS) out.push(...earlierNames(kind))
  for (let n = 1; n <= 3; n += 1) out.push(copy.residualLine(n), copy.altResidual(n))
  for (let n = 0; n <= 3; n += 1) {
    out.push(copy.reportCountLabel(n), copy.speciesCountLabel(n))
    for (let b = 0; b <= n; b += 1) {
      for (const kind of KINDS) for (const yours of [false, true]) for (const slash of [false, true]) for (const predates of [false, true]) {
        out.push(copy.altEntryTail({ count: n, onOrBefore: b, after: n - b }, { yours, slash, predates, kind }))
        // The partition line as the node renders it: "<b> reassigned by eBird".
        out.push(`${b} ${copy.onOrBeforeLabel(kind)}`, `${n - b} ${copy.PART_RECORDED_SINCE}`)
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

  it('no count of one is followed by "them" or "they" in its sentence (NFR-06)', () => {
    for (const s of all) {
      for (const sentence of s.split(/(?<=\.)\s+/)) {
        if (/\b1 report\b/.test(sentence)) expect(sentence, s).not.toMatch(/\b(them|they)\b/)
      }
    }
    // Non-vacuity: the singular forms are in the corpus.
    expect(all.some(s => /\b1 report\b.*\bit\b/.test(s))).toBe(true)
  })

  it('never claims what the user typed or the name a report had on its day (FR-26, QA-28)', () => {
    for (const s of all) {
      // "typed" appears only in the denial "not from what you typed".
      expect(s.replace(/not from what you typed/g, ''), s).not.toMatch(/\btyp(ed|e)\b/)
      expect(s, s).not.toMatch(/\b(on the day|when you saw|at the time (of|you)|you (entered|recorded) (it|them) as)\b/i)
    }
    expect(all.some(s => s.includes('not from what you typed'))).toBe(true)
  })

  it('no rename string dates the change to the update\'s day or makes the update its author (FR-04, FR-24, QA-26)', () => {
    const renameStrings = all.filter(s => s.startsWith('eBird renamed') || s.startsWith('Rename,') || /at the latest|eBird may have changed/.test(s))
    expect(renameStrings.length).toBeGreaterThan(10)
    for (const s of renameStrings) {
      // No day is the day of the change: a date is only ever "the update of" one.
      expect(s, s).not.toMatch(/\b(on|at) \d{1,2} [A-Z][a-z]+ \d{4}\b/)
      // The update carries the name; it is never the one that made the change.
      expect(s, s).not.toMatch(/\b(the|that|this) update (renamed|changed|made)\b/)
      expect(s, s).not.toMatch(/\b(renamed|changed|made) (it |the name )?(on|by|at) (\d|the update|that update|this update)/)
    }
    for (const s of all.filter(x => x.startsWith('eBird renamed'))) expect(s).toContain('was in place by the update of')
  })

  it('no lump sentence says the backup no longer carries the earlier names (FR-24)', () => {
    for (const s of all) expect(s, s).not.toContain('no longer carries the earlier names')
  })

  it('never proposes, ranks or corrects which daughter a report belongs to (FR-17)', () => {
    const proposing = /\b(should|probably|likely|belongs?|correct(ed|ion)?|fix|suggest|recommend|re-?identify|was really|actually)\b/i
    for (const s of all) expect(s, s).not.toMatch(proposing)
  })

  it('names eBird as the one who reassigned or renamed, in the partition labels and every sentence', () => {
    expect(copy.PART_REASSIGNED).toMatch(/\beBird\b/)
    expect(copy.PART_RENAMED).toMatch(/\beBird\b/)
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
    expect(copy.zeroAffected(COVERAGES[2])).toBe("No split, lump, or rename is recorded for any species in your loaded data in eBird's 2023 to 2025 taxonomy updates. A change made before 2023 is not recorded here.")
    expect(copy.panelHead(COVERAGES[2])).toBe("Every species in your loaded data with a split, lump, or rename recorded in eBird's 2023 to 2025 taxonomy updates. Pick one to see what changed and when, with your reports under each name.")
  })

  it('names the section and the control with the user\'s exact string, and the third kind (FR-28, FR-29)', () => {
    expect(copy.SECTION_TITLE).toBe('Splits/Lumps/Renames')
    expect(copy.CONTROL_LABEL).toBe('Splits/Lumps/Renames')
    expect(copy.KIND_WORD).toEqual({ split: 'Split', lump: 'Lump', rename: 'Rename' })
    expect(copy.NOT_AFFECTED).toBe('No split, lump, or rename is recorded for this species in the covered updates.')
    expect(copy.MARK_RESIDUAL).toBe('Earlier name not recorded')
    expect(copy.MARK_UNTRACEABLE).toBe('Not traceable in your backup')
  })

  it('writes every sentence form of design-spec 3.6 exactly', () => {
    const t = (k: HistoryKind, opts: Partial<copy.SentenceOpts> = {}) => copy.partsText(copy.eventSentence(k, '2025-10-31', {
      earlierState: 'counted', predates: false, anyTraced: false, lumpName: 'Redpoll', slashNames: [],
      earlierName: 'Rufous Night-Heron', currentName: 'Nankeen Night Heron', ...opts,
    }))
    expect(t('split', { slashNames: ['Eastern/Western Warbling Vireo'] })).toBe('eBird reassigned every report dated on or before 31 October 2025 to one of the new names when it made this split. Reports dated after it were recorded under the current names. Reports it could not place went to Eastern/Western Warbling Vireo.')
    expect(t('split', { earlierState: 'pre-update', predates: true })).toBe('eBird reassigned every report dated on or before 31 October 2025 when it made this split. Your backup was exported before that, so the reassignment is not in it yet.')
    expect(t('split', { slashNames: SLASHES })).toContain("went to Eastern/Western Warbling Vireo, Hudsonian/Eurasian Whimbrel, and Cory's/Scopoli's Shearwater.")
    expect(t('split', { slashNames: SLASHES.slice(0, 2) })).toContain('went to Eastern/Western Warbling Vireo and Hudsonian/Eurasian Whimbrel.')
    const base = 'eBird reassigned every report dated on or before 31 October 2025 to Redpoll when it made this lump.'
    expect(t('lump', { anyTraced: true })).toBe(`${base} Where eBird kept an earlier name as a form, reports that carry the form are counted under that name.`)
    expect(t('lump')).toBe(`${base} Your backup cannot show which earlier name a report had.`)
    expect(t('lump', { earlierState: 'later-changed', anyTraced: true })).toBe(base)
    expect(t('lump', { earlierState: 'pre-update' })).toBe(base)
    expect(t('lump', { earlierState: 'pre-update', predates: true })).toBe('eBird reassigned every report dated on or before 31 October 2025 when it made this lump. Your backup was exported before that, so the reassignment is not in it yet.')
    const renamed = 'eBird renamed Rufous Night-Heron to Nankeen Night Heron. The new name was in place by the update of 31 October 2025, the first whose record carries it.'
    expect(t('rename')).toBe(renamed)
    expect(t('rename', { earlierState: 'later-changed' })).toBe(renamed)
    expect(t('rename', { earlierState: 'pre-update', predates: true })).toBe(`${renamed} Your backup was exported before that update, so the new name is not in it yet.`)
  })

  it('writes the earlier-name lines, the residual, and the text-equivalent tails of design-spec 3.3 to 3.11 exactly', () => {
    expect(copy.basisLine(1, 'split')).toBe("eBird's name for it until the update")
    expect(copy.basisLine(2, 'lump')).toBe("eBird's name for them until the update")
    expect(copy.basisLine(9, 'rename')).toBe("eBird's name for them until the update, at the latest")
    expect(copy.residualLine(1)).toBe('Dated on or before the update, with no form to show the name it had.')
    expect(copy.altResidual(5)).toBe('Earlier name not recorded: 5 reports, dated on or before the update, with no form to show the name they had.')
    expect(copy.altKindLine('rename', '2021-09-08')).toBe('Rename, in place by September 2021.')
    expect(copy.badgeDate('rename', '2021-09-08')).toBe('by September 2021')
    expect(copy.altEarlierTail('lump', 'counted', { earlier: { state: 'count', n: 44 }, form: 'Western Flycatcher (Pacific-slope)' }, { currentName: '', lumpedName: 'Western Flycatcher' }))
      .toBe(": 44 reports, eBird's name for them until the update, now the form Western Flycatcher (Pacific-slope).")
    expect(copy.altEarlierTail('rename', 'counted', { earlier: { state: 'count', n: 0 }, form: '' }, { currentName: 'Thick-billed Longspur', lumpedName: '' }))
      .toBe(': no reports until the update. None under Thick-billed Longspur is dated on or before it.')
    expect(copy.altEarlierTail('lump', 'counted', { earlier: { state: 'untraceable', reason: 'survivor' }, form: '' }, { currentName: '', lumpedName: 'American Crow' }))
      .toBe(': not traceable in your backup. This name carried on as the lumped species, so its earlier reports read the same as any report with no form.')
    expect(copy.altEarlierTail('split', 'later-changed', { earlier: { state: 'none' }, form: '' }, { currentName: '', lumpedName: '' }))
      .toBe(': not counted on this line. A later update changed one of the names it became.')
    expect(copy.altEntryTail({ count: 12, onOrBefore: 9, after: 3 }, { yours: true, slash: false, predates: false, kind: 'rename' }))
      .toBe(', your species: 12 reports, 9 renamed by eBird, 3 recorded since.')
  })

  it('shows the paragraph only where some earlier-name figure is above zero, or a residual box is drawn (FR-25)', () => {
    const ev = (earlierState: string, residual: number, ns: number[]) => ({ earlierState, residual, before: ns.map(n => ({ earlier: { state: 'count' as const, n } })) })
    expect(copy.showsParagraph(ev('counted', 0, [0, 0]))).toBe(false)
    expect(copy.showsParagraph(ev('counted', 0, [0, 1]))).toBe(true)
    expect(copy.showsParagraph(ev('counted', 2, [0]))).toBe(true)
    expect(copy.showsParagraph(ev('pre-update', 2, [3]))).toBe(false)
    expect(copy.showsParagraph(ev('later-changed', 0, [3]))).toBe(false)
  })

  it('reads an entry for the text equivalent in the approved shapes (FR-22)', () => {
    expect(copy.altEntryTail({ count: 0, onOrBefore: 0, after: 0 }, { yours: false, slash: false, predates: false })).toBe(': no reports under this name.')
    expect(copy.altEntryTail({ count: 312, onOrBefore: 289, after: 23 }, { yours: true, slash: false, predates: false })).toBe(', your species: 312 reports, 289 reassigned by eBird, 23 recorded since.')
    expect(copy.altEntryTail({ count: 1, onOrBefore: 1, after: 0 }, { yours: true, slash: false, predates: true })).toBe(', your species: 1 report, all dated before the update.')
    expect(copy.altEntryTail({ count: 4, onOrBefore: 4, after: 0 }, { yours: false, slash: true, predates: false })).toBe(', the slash entry for reports eBird could not assign: 4 reports, 4 reassigned by eBird, 0 recorded since.')
  })

  it('the predates note and the stale day are built from the published date, with a rename\'s own form', () => {
    expect(copy.predatesNote('2025-10-31')).toEqual({
      lead: 'Your backup predates the October 2025 update',
      rest: ', so your reports still carry the earlier name. A fresh backup from eBird shows where they went.',
    })
    expect(copy.predatesNote('2025-10-31', 'rename').rest).toBe(', so your reports still carry the earlier name. A fresh backup from eBird carries the new one.')
  })
})
