// Copy for the Splits/Lumps/Renames control and section (taxonomic-splits-lumps,
// extended by recorded-names-in-splits-and-lumps; design-spec.md section 3).
// Every string that carries a count, a year, a date or a name lives here so
// `taxonomyHistoryCopy.test.ts` can sweep a generated corpus over it (ui.md
// v1.0.5: a count-bearing string built outside the copy module is invisible to
// the sweep).
//
// Rules this module keeps, and the test enforces:
//   * no U+2014 anywhere;
//   * no count of one takes a plural noun, and no `them`/`they` follows a count
//     of one;
//   * nothing names, ranks or proposes which daughter an old report belongs to
//     (FR-17, FR-26): the copy reports what eBird did and when, never a
//     correction;
//   * nothing claims what the user typed, or the name a report carried on the
//     day of the sighting: the basis is "eBird's name for them until the
//     update" (FR-26), and a rename is "in place by" an update, never made on
//     its day (FR-04, FR-24);
//   * dates are formatted from `YYYY-MM-DD` with a fixed English month table,
//     never `toLocaleDateString`, so every runtime prints the same string.

import type { EarlierFigure, HistoryKind, HistoryUpdate, TaxonomyHistory } from './taxonomyHistory'
import { reportCountLabel, speciesCountLabel } from './subspeciesExplorer'

// The two count labels the Subspecies Explorer already ships, single-sourced so
// the two taxonomy tools say "N species" and "N reports" identically.
export { reportCountLabel, speciesCountLabel }

/** The control's label and the section's title: the user's exact string
 *  (decisions.md D-05). The component adds a line-break opportunity after each
 *  "/" when it renders them; the text stays exactly this. */
export const CONTROL_LABEL = 'Splits/Lumps/Renames'
export const SECTION_TITLE = 'Splits/Lumps/Renames'

export const KIND_WORD: Readonly<Record<HistoryKind, string>> = { split: 'Split', lump: 'Lump', rename: 'Rename' }

export const MARK_YOUR_SPECIES = 'Your species'
export const MARK_NO_REPORTS = 'No reports under this name'
export const MARK_SLASH = 'Reports eBird could not assign'
/** FR-17's box, FR-18's state, FR-19's zero state and FR-21's marker. */
export const MARK_RESIDUAL = 'Earlier name not recorded'
export const MARK_UNTRACEABLE = 'Not traceable in your backup'
export const MARK_ZERO = 'No reports until the update'
export const MARK_LATER = 'Not counted on this line'
export const LATER_LINE = 'A later update changed one of the names it became.'

export const PART_REASSIGNED = 'reassigned by eBird'
/** A rename's on-or-before label: eBird reassigned nothing to another species
 *  (FR-23). */
export const PART_RENAMED = 'renamed by eBird'
export const PART_RECORDED_SINCE = 'recorded since'
export const PART_PREDATES = 'all dated before the update'

export const NOT_AFFECTED = 'No split, lump, or rename is recorded for this species in the covered updates.'
export const FILTER_LINE = 'The figures cover every checklist in your export, not the current county or date filter.'
export const NO_COVERAGE = 'No eBird taxonomy updates are covered in this build.'

/** A piece of a sentence or line: plain text, a bird name (the component renders
 *  it through BirdName), or a run at weight 600. */
export type CopyPart = string | { readonly name: string } | { readonly bold: string }

/** The parts as one plain string (the text equivalent, and the sweep). */
export function partsText(parts: readonly CopyPart[]): string {
  let out = ''
  for (const p of parts) out += typeof p === 'string' ? p : 'name' in p ? p.name : p.bold
  return out
}

/** The first letter lowercased: a marker read inside a sentence (3.11). */
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

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

/** The list panel's head, when at least one species is affected (FR-29). It
 *  says what is recorded, never that a species was not renamed (FR-10). */
export function panelHead(coverage: Coverage): string {
  if (coverage === null) return NO_COVERAGE
  const { earliest, latest } = coverage
  return `Every species in your loaded data with a split, lump, or rename recorded in eBird's ${rangePhrase(earliest, latest)}. Pick one to see what changed and when, with your reports under each name.`
}

/** The list panel's head when no species is affected (FR-29). */
export function zeroAffected(coverage: Coverage): string {
  if (coverage === null) return NO_COVERAGE
  const { earliest, latest } = coverage
  return `No split, lump, or rename is recorded for any species in your loaded data in eBird's ${rangePhrase(earliest, latest)}. A change made before ${earliest.year} is not recorded here.`
}

/** The badge's date: "October 2025", or "by September 2021" on a rename,
 *  which the record dates only to the update that first carries the name. */
export function badgeDate(kind: HistoryKind, published: string): string {
  return kind === 'rename' ? `by ${updateLabel(published)}` : updateLabel(published)
}

/** The on-or-before label on a current-side name (FR-23). */
export function onOrBeforeLabel(kind: HistoryKind): string {
  return kind === 'rename' ? PART_RENAMED : PART_REASSIGNED
}

/** The older-backup note (FR-20, TSL FR-19), split so the lead can render at
 *  weight 600. The rename form says the new name, not where reports went. */
export function predatesNote(published: string, kind: HistoryKind = 'split'): { lead: string; rest: string } {
  return {
    lead: `Your backup predates the ${updateLabel(published)} update`,
    rest: kind === 'rename'
      ? ', so your reports still carry the earlier name. A fresh backup from eBird carries the new one.'
      : ', so your reports still carry the earlier name. A fresh backup from eBird shows where they went.',
  }
}

// ── An earlier name's box (design-spec 3.3 to 3.5) ──────────────────────────

/** The fixed basis under an earlier-name count (FR-22), singular for one. On a
 *  rename the change may predate the update, so it says "at the latest". */
export function basisLine(n: number, kind: HistoryKind): string {
  const s = n === 1 ? "eBird's name for it until the update" : "eBird's name for them until the update"
  return kind === 'rename' ? `${s}, at the latest` : s
}

/** A traced lump name's kept form (FR-22). */
export function formLine(form: string): CopyPart[] {
  return ['now the form ', { name: form }]
}

/** The "Earlier name not recorded" box's line, singular for one (FR-17). */
export function residualLine(n: number): string {
  return `Dated on or before the update, with no form to show the name ${n === 1 ? 'it' : 'they'} had.`
}

/** The zero state's line (FR-19). Worded so it is also true for the second of
 *  two renames on a backup older than the first (schema flag 11). */
export function zeroLine(kind: HistoryKind, opts: { form: string; currentName: string }): CopyPart[] {
  if (kind === 'lump') return ['None dated on or before it carries the form ', { name: opts.form }, '.']
  if (kind === 'rename') return ['None under ', { name: opts.currentName }, ' is dated on or before it.']
  return ['None under the names it became is dated on or before it.']
}

/** FR-18's sentence, true for the reason that applies. */
export function untraceableLine(reason: 'survivor' | 'no-form', lumpedName: string): CopyPart[] {
  if (reason === 'survivor') {
    return ['This name carried on as the lumped species, so its earlier reports read the same as any report with no form.']
  }
  return ['eBird kept no form for this name, so its reports now read as plain ', { name: lumpedName }, '.']
}

// ── The event sentence (FR-24) and the explanatory paragraph (FR-25) ────────

export interface SentenceOpts {
  earlierState: 'pre-update' | 'later-changed' | 'counted'
  /** The shipped FR-19 flag: the backup carries only the earlier names. */
  predates: boolean
  /** A lump's surviving name (its one after entry). */
  lumpName: string
  /** The slash entries the user holds reports under (a split only). */
  slashNames: readonly string[]
  /** A lump has at least one earlier name eBird kept as a form. */
  anyTraced: boolean
  /** A rename's two names, as displayed (design-spec section 5, item 3). */
  earlierName: string
  currentName: string
}

/** The joiner before the i-th of n quoted names: "", then ", " / " and " / ", and ". */
export function nameSeparator(i: number, n: number): string {
  if (i === 0) return ''
  if (i === n - 1) return n === 2 ? ' and ' : ', and '
  return ', '
}

/** The once-per-event sentence: what eBird did, and when (design-spec 3.6). */
export function eventSentence(kind: HistoryKind, published: string, opts: SentenceOpts): CopyPart[] {
  const day = { bold: publishedDayLabel(published) }
  if (kind === 'rename') {
    const out: CopyPart[] = [
      'eBird renamed ', { name: opts.earlierName }, ' to ', { name: opts.currentName },
      '. The new name was in place by the update of ', day, ', the first whose record carries it.',
    ]
    if (opts.predates) out.push(' Your backup was exported before that update, so the new name is not in it yet.')
    return out
  }
  const lead = 'eBird reassigned every report dated on or before '
  if (opts.predates) {
    return [lead, day, ` when it made this ${kind}. Your backup was exported before that, so the reassignment is not in it yet.`]
  }
  if (kind === 'lump') {
    const out: CopyPart[] = [lead, day, ' to ', { name: opts.lumpName }, ' when it made this lump.']
    if (opts.earlierState === 'counted') {
      out.push(opts.anyTraced
        ? ' Where eBird kept an earlier name as a form, reports that carry the form are counted under that name.'
        : ' Your backup cannot show which earlier name a report had.')
    }
    return out
  }
  const out: CopyPart[] = [lead, day, ' to one of the new names when it made this split. Reports dated after it were recorded under the current names.']
  if (opts.slashNames.length > 0) {
    out.push(' Reports it could not place went to ')
    opts.slashNames.forEach((n, i) => {
      const sep = nameSeparator(i, opts.slashNames.length)
      if (sep) out.push(sep)
      out.push({ name: n })
    })
    out.push('.')
  }
  return out
}

/** Whether an event shows the explanatory paragraph (FR-25, design-spec S9). */
export function showsParagraph(ev: { earlierState: string; residual: number; before: readonly { earlier: EarlierFigure }[] }): boolean {
  if (ev.earlierState !== 'counted') return false
  if (ev.residual > 0) return true
  return ev.before.some(b => b.earlier.state === 'count' && b.earlier.n > 0)
}

/** How the count is worked out (FR-25, design-spec 3.8). */
export function explanatoryParagraph(kind: HistoryKind, opts: { earlierName: string; residual: number }): CopyPart[] {
  const keeps = "Your backup keeps only each report's current name, so "
  if (kind === 'lump') {
    const out: CopyPart[] = [
      { bold: 'How the counts are worked out.' },
      ` From the form each report carries and its date, not from what you typed. ${keeps}a report dated on or before the update counts under an earlier name when it carries the form eBird kept for that name, including one entered later for an earlier date.`,
    ]
    if (opts.residual > 0) out.push(' Reports with no form have no earlier name in your backup.')
    return out
  }
  const out: CopyPart[] = [
    { bold: 'How the count is worked out.' },
    ` From each report's date, not from what you typed. ${keeps}every report dated on or before the update is counted under `,
    { name: opts.earlierName },
    ', including one entered later for an earlier date.',
  ]
  if (kind === 'rename') {
    out.push(' eBird may have changed the name before that update; if so, reports dated between the change and the update are counted under the earlier name too.')
  }
  return out
}

// ── The text equivalent (FR-32, design-spec 3.11) ───────────────────────────

/** The text equivalent's first paragraph: "Split, October 2025." or "Rename,
 *  in place by September 2021." */
export function altKindLine(kind: HistoryKind, published: string): string {
  return kind === 'rename'
    ? `Rename, in place by ${updateLabel(published)}.`
    : `${KIND_WORD[kind]}, ${updateLabel(published)}.`
}

/**
 * The text equivalent's reading of an earlier name, AFTER its name, in every
 * state but the older backup's (which reads `altEntryTail`). Built from the
 * same functions as the chart, so the two carry the same words (QA-33).
 */
export function altEarlierTail(
  kind: HistoryKind,
  earlierState: 'later-changed' | 'counted',
  entry: { earlier: EarlierFigure; form: string },
  opts: { currentName: string; lumpedName: string },
): string {
  if (earlierState === 'later-changed') return `: ${lowerFirst(MARK_LATER)}. ${LATER_LINE}`
  const e = entry.earlier
  if (e.state === 'untraceable') return `: ${lowerFirst(MARK_UNTRACEABLE)}. ${partsText(untraceableLine(e.reason, opts.lumpedName))}`
  if (e.state === 'count' && e.n === 0) {
    return `: ${lowerFirst(MARK_ZERO)}. ${partsText(zeroLine(kind, { form: entry.form, currentName: opts.currentName }))}`
  }
  if (e.state === 'count') {
    const form = entry.form !== '' ? `, ${partsText(formLine(entry.form))}` : ''
    return `: ${reportCountLabel(e.n)}, ${basisLine(e.n, kind)}${form}.`
  }
  return '.'
}

/** The "Earlier name not recorded" box, read in the text equivalent. */
export function altResidual(n: number): string {
  return `${MARK_RESIDUAL}: ${reportCountLabel(n)}, ${lowerFirst(residualLine(n))}`
}

/**
 * The text equivalent's reading of one current-side entry, or of any entry of
 * an older backup, AFTER its name (TSL FR-22): the marker, then either the
 * no-reports marker or the count with its partition.
 */
export function altEntryTail(
  entry: { count: number; onOrBefore: number; after: number },
  opts: { yours: boolean; slash: boolean; predates: boolean; kind?: HistoryKind },
): string {
  let s = ''
  if (opts.yours) s += ', your species'
  if (opts.slash) s += ', the slash entry for reports eBird could not assign'
  if (entry.count === 0) return `${s}: no reports under this name.`
  const reports = reportCountLabel(entry.count)
  if (opts.predates) return `${s}: ${reports}, all dated before the update.`
  return `${s}: ${reports}, ${entry.onOrBefore} ${onOrBeforeLabel(opts.kind ?? 'split')}, ${entry.after} ${PART_RECORDED_SINCE}.`
}
