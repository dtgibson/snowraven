// Copy for the Splits and lumps control and the Splits and Lumps section
// (taxonomic-splits-lumps, schema.md 7.4, design-spec.md). Every string that
// carries a count, a year or a date lives here so `taxonomyHistoryCopy.test.ts`
// can sweep a generated corpus over it (ui.md v1.0.5: a count-bearing string
// built outside the copy module is invisible to the sweep).
//
// Rules this module keeps, and the test enforces:
//   * no U+2014 anywhere;
//   * no count of one takes a plural noun;
//   * nothing names, ranks or proposes which daughter an old report belongs to
//     (FR-17): the copy reports what eBird did and when, never a correction;
//   * dates are formatted from `YYYY-MM-DD` with a fixed English month table,
//     never `toLocaleDateString`, so every runtime prints the same string.

import type { HistoryUpdate, TaxonomyHistory } from './taxonomyHistory'
import { reportCountLabel, speciesCountLabel } from './subspeciesExplorer'

// The two count labels the Subspecies Explorer already ships, single-sourced so
// the two taxonomy tools say "N species" and "N reports" identically.
export { reportCountLabel, speciesCountLabel }

export const CONTROL_LABEL = 'Splits and lumps'
export const SECTION_TITLE = 'Splits and Lumps'

export const KIND_WORD: Readonly<Record<'split' | 'lump', string>> = { split: 'Split', lump: 'Lump' }

export const MARK_YOUR_SPECIES = 'Your species'
export const MARK_NO_REPORTS = 'No reports under this name'
export const MARK_SLASH = 'Reports eBird could not assign'

export const PART_REASSIGNED = 'reassigned by eBird'
export const PART_RECORDED_SINCE = 'recorded since'
export const PART_PREDATES = 'all dated before the update'

export const NOT_AFFECTED = 'No split or lump is recorded for this species in the covered updates.'
export const FILTER_LINE = 'The figures cover every checklist in your export, not the current county or date filter.'
export const NO_COVERAGE = 'No eBird taxonomy updates are covered in this build.'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function parts(published: string): { y: string; m: string; d: number } {
  const [y, m, d] = published.split('-')
  const mi = Number(m) - 1
  return { y, m: MONTHS[mi] ?? '', d: Number(d) }
}

/** An update named by month and year: "October 2025". */
export function updateLabel(published: string): string {
  const { y, m } = parts(published)
  return `${m} ${y}`
}

/** The published day: "31 October 2025". */
export function publishedDayLabel(published: string): string {
  const { y, m, d } = parts(published)
  return `${d} ${m} ${y}`
}

type Coverage = TaxonomyHistory['coverage']

/** "2023 to 2025 taxonomy updates" or, for one covered year, "2025 taxonomy update". */
function rangePhrase(earliest: HistoryUpdate, latest: HistoryUpdate): string {
  return earliest.year === latest.year
    ? `${latest.year} taxonomy update`
    : `${earliest.year} to ${latest.year} taxonomy updates`
}

/** The coverage statement shown in every state of the section (FR-20). */
export function coverageLine(coverage: Coverage): string {
  if (coverage === null) return NO_COVERAGE
  const { earliest, latest } = coverage
  return `Covers eBird's ${rangePhrase(earliest, latest)}. A change made before ${earliest.year} is not recorded here.`
}

/** The list panel's head, when at least one species is affected. */
export function panelHead(coverage: Coverage): string {
  if (coverage === null) return NO_COVERAGE
  const { earliest, latest } = coverage
  return `Every species in your loaded data that eBird split or lumped in its ${rangePhrase(earliest, latest)}. Pick one to see what changed, when, and where your reports went.`
}

/** The list panel's head when no species is affected (FR-13). */
export function zeroAffected(coverage: Coverage): string {
  if (coverage === null) return NO_COVERAGE
  const { earliest, latest } = coverage
  return `None of the species in your loaded data was split or lumped in eBird's ${rangePhrase(earliest, latest)}. A change made before ${earliest.year} is not recorded here.`
}

/** The stale-export note (FR-19), split so the lead can render at weight 600. */
export function predatesNote(published: string): { lead: string; rest: string } {
  return {
    lead: `Your backup predates the ${updateLabel(published)} update`,
    rest: ', so your reports still carry the earlier name. A fresh backup from eBird shows where they went.',
  }
}

/**
 * The once-per-event sentence (FR-17), in pieces: the text before the date, the
 * date (rendered at weight 600), the text after it, the bird names it quotes
 * (a lump's surviving name, or the slash taxa a split created that the user
 * holds reports under), and the closing text. The component renders each name
 * through BirdName with `nameSeparator` between them.
 */
export interface EventSentence {
  lead: string
  date: string
  mid: string
  names: readonly string[]
  tail: string
}

export function eventSentence(
  kind: 'split' | 'lump',
  published: string,
  opts: { predates: boolean; lumpName: string; slashNames: readonly string[] },
): EventSentence {
  const lead = 'eBird reassigned every report dated on or before '
  const date = publishedDayLabel(published)
  if (opts.predates) {
    return {
      lead, date,
      mid: ` when it made this ${kind}. Your backup was exported before that, so the reassignment is not in it yet.`,
      names: [], tail: '',
    }
  }
  if (kind === 'lump') {
    return {
      lead, date,
      mid: ' to ',
      names: [opts.lumpName],
      tail: ' when it made this lump. Your backup no longer carries the earlier names.',
    }
  }
  const base = ' to one of the new names when it made this split. Reports dated after it were recorded under the current names.'
  if (opts.slashNames.length === 0) return { lead, date, mid: base, names: [], tail: '' }
  return { lead, date, mid: `${base} Reports it could not place went to `, names: opts.slashNames, tail: '.' }
}

/** The joiner before the i-th of n quoted names: "", then ", " / " and " / ", and ". */
export function nameSeparator(i: number, n: number): string {
  if (i === 0) return ''
  if (i === n - 1) return n === 2 ? ' and ' : ', and '
  return ', '
}

/** The sentence as one plain string (the text equivalent's last paragraph). */
export function eventSentenceText(s: EventSentence): string {
  const names = s.names.map((n, i) => `${nameSeparator(i, s.names.length)}${n}`).join('')
  return `${s.lead}${s.date}${s.mid}${names}${s.tail}`
}

/** The text equivalent's first paragraph: "Split, October 2025." */
export function altKindLine(kind: 'split' | 'lump', published: string): string {
  return `${KIND_WORD[kind]}, ${updateLabel(published)}.`
}

/**
 * The text equivalent's reading of one entry, AFTER its name (FR-22): the
 * marker, then either the no-reports marker or the count with its partition.
 */
export function altEntryTail(
  entry: { count: number; onOrBefore: number; after: number },
  opts: { yours: boolean; slash: boolean; predates: boolean },
): string {
  let s = ''
  if (opts.yours) s += ', your species'
  if (opts.slash) s += ', the slash entry for reports eBird could not assign'
  if (entry.count === 0) return `${s}: no reports under this name.`
  const reports = reportCountLabel(entry.count)
  if (opts.predates) return `${s}: ${reports}, all dated before the update.`
  return `${s}: ${reports}, ${entry.onOrBefore} ${PART_REASSIGNED}, ${entry.after} ${PART_RECORDED_SINCE}.`
}
