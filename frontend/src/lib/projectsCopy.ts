// User-facing copy for the Projects section (design-spec.md, the eleven display
// states) — county-shading-and-project-stats.
//
// It lives in `lib/` rather than beside the component because a non-component
// export from a `.tsx` trips `react-refresh/only-export-components` — the same
// constraint that put `lib/exoticCopy.ts` and `lib/helpLinks.ts` here.
//
// THE ELEVEN STATES ARE NOT ELEVEN HAND-WRITTEN STRINGS. There is ONE pure tally
// clause plus one clause per state, so the denominator is carried by the
// FUNCTION rather than by discipline: a tally without its context is not
// expressible, and a twelfth state is one row of copy.
//
// Voice: informative, never promotional. Plain sentences that state a fact and
// stop. NO EM DASHES in any string in this file (the standing sweep), straight
// apostrophes throughout, and every state says what the NUMBER is doing rather
// than only what the network is doing. En dashes appear only in numeric ranges.

import { ACTIVITY_START_SPACING_DEFAULT_MS } from './rateLimit'
import type { ProjectsStatus } from './useChecklistProjects'

const fmt = (n: number) => n.toLocaleString()
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

// ── AGREEMENT (QA-52, QA-54) ─────────────────────────────────────────────────
//
// Every count in this file governs a word next to it, and a hardcoded plural is
// only ever right for one value of the count. Three shapes recur, so each gets
// ONE function rather than a hand-written pair per site: an enumeration of bad
// strings is only as good as the list, and the list already missed "1 requests"
// and "The other 1 have" once.

/**
 * A COUNT STANDING IN FOR A NOUN ALREADY NAMED — "the other 2,840", "of the 412
 * checked". English will not take a bare numeral in that position at one ("the
 * other 1"), so one is spelled out and everything else is the figure.
 */
export const countRef = (n: number) => (n === 1 ? 'one' : fmt(n))

/** The same back-reference where it needs its own determiner. */
export const thoseClause = (n: number) => (n === 1 ? 'that one' : `those ${fmt(n)}`)

/**
 * "412 of 3,300 checklists" — the ONE fraction, composed by the four states
 * that show one plus `checkedClause`. The noun is governed by the TOTAL, not by
 * the numerator: "0 of 1 checklist checked", never "0 of 1 checklists checked".
 */
export const fraction = (checked: number, total: number) =>
  `${fmt(checked)} of ${fmt(total)} ${plural(total, 'checklist', 'checklists')}`

/**
 * The duration estimate, in MINUTES, derived from the checklist count and the
 * shipped request spacing rather than hardcoded (FR-49).
 *
 * Note which `formatDuration` this deliberately does NOT use: `statsFormat.ts`
 * takes minutes and spells "1 hr, 5 min"; `checklistMeta.ts` takes HOURS and
 * spells "1h 20m". Neither is the right vocabulary for "about 8 minutes", and
 * an import resolving to the wrong one would be silently wrong by a factor of
 * sixty, so this computes its own number and the caller words it.
 */
export function estimateMinutes(checklistCount: number): number {
  return Math.max(1, Math.round(checklistCount * ACTIVITY_START_SPACING_DEFAULT_MS / 60000))
}

/**
 * THE ONE PLACE THE ESTIMATE IS WORDED. Four states quote a duration, and each
 * of them previously interpolated `about ${estimateMinutes(n)} minutes` with a
 * HARDCODED plural, so every backup under 600 checklists — and, far worse, the
 * tail of EVERY sweep, where the remaining count falls under 600 — shipped
 * "about 1 minutes". The unit belongs to the number, so the number and its unit
 * are produced together here and the four call sites can no longer disagree.
 */
export function estimateClause(checklistCount: number): string {
  const m = estimateMinutes(checklistCount)
  return `about ${fmt(m)} ${plural(m, 'minute', 'minutes')}`
}

/** The ONE denominator clause. Every state that can show a tally composes it. */
export function checkedClause(checked: number, total: number): string {
  if (checked === total) {
    // "all 1 of your checklists" is wrong twice over, so the sole-checklist
    // backup drops the "all N of" frame rather than pluralising a noun after a
    // one. It KEEPS THE FIGURE deliberately: FR-50 makes the denominator part
    // of the tally, and "your only checklist" would have stated it in words and
    // left the clause without a number for the first time.
    return total === 1 ? 'your 1 checklist' : `all ${fmt(total)} of your checklists`
  }
  return `${fraction(checked, total)} checked`
}

/**
 * The ONE tally clause. Empty at `checked === 0`, because a never-run section
 * shows NO COUNT OF ANY KIND, not even a zero: zero is a claim the app has not
 * earned (FR-49).
 */
export function tally(found: number, checked: number, total: number): string {
  if (checked === 0) return ''
  if (found === 0) return `No projects found across ${checkedClause(checked, total)}.`
  return `${fmt(found)} ${plural(found, 'project', 'projects')} across ${checkedClause(checked, total)}.`
}

/**
 * The denominator, stated on its own, for the two states that are REACHABLE
 * WITH NOTHING CHECKED — a first pass that fails every request, or one that
 * meets a full store on its first press.
 *
 * `tally()` is deliberately empty at `checked === 0` (FR-49: no count of any
 * kind there, not even a zero), and composing an empty tally with a bare
 * failure figure left the export total absent from the WHOLE card — the one
 * thing FR-50 exists to prevent. This states the denominator without claiming a
 * project count, so both halves of the rule hold at once.
 */
export function noneCheckedClause(total: number): string {
  return `None of your ${fmt(total)} ${plural(total, 'checklist', 'checklists')} has been checked yet.`
}

/** The control identifiers each state offers. The component maps them to
 *  handlers; keeping them here is what makes "the controls are exactly what that
 *  state can perform" a property of the copy table. */
export type ProjectsActionId = 'start' | 'stop' | 'resume' | 'again' | 'retry'

export type ProjectsIconKind =
  | 'dash' | 'loader' | 'check' | 'alert' | 'key' | 'wifi' | 'clock'
export type ProjectsTone = 'accent' | 'warning' | 'error' | 'muted'

export interface ProjectsAction {
  id: ProjectsActionId
  label: string
  /** The single accent-filled control on the card: the only press that costs
   *  the user eight minutes. */
  primary?: boolean
}

export interface ProjectsCopy {
  icon: ProjectsIconKind
  tone: ProjectsTone
  msg: string
  /** The supporting line in the rule slot. */
  note: string
  actions: ProjectsAction[]
  /** The no-key state's inline navigation to Settings. */
  link?: string
  /** Render the progress bar and the N / M readout. */
  progress?: boolean
}

/**
 * Status sentence, supporting note and controls for every state. PURE AND
 * TOTAL: `found` is the number of distinct projects the tally currently covers.
 *
 * The cooldown state's SECONDS figure is rounded in the ticker, never here and
 * never in a render body, so no clock read can reach the render path.
 */
export function projectsCopy(status: ProjectsStatus, found: number): ProjectsCopy {
  switch (status.kind) {
    case 'never-run':
      return {
        icon: 'dash', tone: 'muted',
        msg: 'Projects have not been checked yet.',
        note: `Your eBird backup does not record them, so each checklist has to be asked about on its own: ${fmt(status.total)} ${plural(status.total, 'request', 'requests')}, ${estimateClause(status.total)} at the fastest pace the app allows. That is a floor, and it takes longer if eBird asks the app to slow down. Nothing is sent until you press Check projects.`,
        actions: [{ id: 'start', label: 'Check projects', primary: true }],
      }
    case 'running':
      return {
        icon: 'loader', tone: 'accent',
        msg: `Checking projects: ${fraction(status.checked, status.total)}.`
          + (found > 0 ? ` ${fmt(found)} ${plural(found, 'project', 'projects')} so far.` : ''),
        note: 'Counts below cover only the checklists checked so far, so they can only go up.',
        actions: [{ id: 'stop', label: 'Stop' }],
        progress: true,
      }
    case 'cooldown':
      return {
        icon: 'clock', tone: 'warning',
        msg: `eBird asked the app to slow down, so the check is waiting about ${fmt(status.seconds)} ${plural(status.seconds, 'second', 'seconds')}. ${fraction(status.checked, status.total)} checked, and it carries on by itself.`,
        note: 'Counts below cover only the checklists checked so far, so they can only go up.',
        actions: [{ id: 'stop', label: 'Stop' }],
        progress: true,
      }
    case 'stopped':
      return {
        icon: 'alert', tone: 'warning',
        msg: `Stopped at ${fraction(status.checked, status.total)} checked. Every answer so far is kept.`,
        note: `Resuming asks only about the other ${countRef(status.total - status.checked)}, ${estimateClause(status.total - status.checked)}.`,
        actions: [{ id: 'resume', label: 'Resume' }],
      }
    case 'partial':
      // After a relaunch the app genuinely cannot tell a deliberate stop from a
      // quit, and nothing about a stop is persisted, so this sentence states
      // COUNTS ONLY and claims no knowledge of why the pass ended.
      return {
        icon: 'alert', tone: 'warning',
        msg: `${fraction(status.checked, status.total)} checked. The other ${countRef(status.remaining)} ${plural(status.remaining, 'has', 'have')} not been asked about yet.`,
        note: `Counts below cover only ${thoseClause(status.checked)}. Checking the rest takes ${estimateClause(status.remaining)}.`,
        actions: [{ id: 'resume', label: 'Check the rest' }],
      }
    case 'complete':
      return {
        icon: 'check', tone: 'accent',
        msg: `${tally(found, status.checked, status.total)} Nothing is left to ask about.`,
        note: `Every checklist in this backup has been checked, so these counts are complete for it. Checking again asks eBird about ${status.total === 1 ? 'it' : `all ${fmt(status.total)}`} a second time, ${estimateClause(status.total)}. A checklist keeps the project it was submitted to, so that is only worth doing if you think an answer is wrong.`,
        actions: [{ id: 'again', label: 'Check again' }],
      }
    case 'unanswered':
      return {
        icon: 'alert', tone: 'warning',
        msg: `${status.checked === 0 ? noneCheckedClause(status.total) : tally(found, status.checked, status.total)} ${fmt(status.failed)} ${plural(status.failed, 'checklist', 'checklists')} could not be answered and ${plural(status.failed, 'is', 'are')} not counted.`,
        note: `Try again asks only about ${thoseClause(status.failed)}.`,
        actions: [{ id: 'retry', label: 'Try again' }],
      }
    case 'at-capacity':
      return {
        icon: 'alert', tone: 'warning',
        msg: `${status.checked === 0 ? noneCheckedClause(status.total) : tally(found, status.checked, status.total)} Stored answers are full at ${fmt(status.capacity)} ${plural(status.capacity, 'checklist', 'checklists')}, so the rest cannot be added.`,
        // The "counts above" sentence is only true when there ARE counts above.
        // At `checked === 0` it rendered "for the 0 checklists behind them",
        // which is both a bare zero and a claim about nothing.
        note: status.checked === 0
          ? 'Nothing already answered is discarded to make room, so no new answer can be stored until room is freed.'
          : `Nothing already answered is discarded to make room. The counts above stay true for the ${countRef(status.checked)} ${plural(status.checked, 'checklist', 'checklists')} behind them.`,
        actions: [],
      }
    case 'no-key':
      return {
        icon: 'key', tone: 'muted',
        msg: 'Projects cannot be checked without an eBird API key.',
        link: 'Add a key in Settings',
        note: 'The key stays on this device. It is the same key the Map Explorer and the weather lookups already use.',
        actions: [],
      }
    case 'offline':
      return {
        icon: 'wifi', tone: 'muted',
        msg: status.checked > 0
          ? `Offline, so the rest cannot be checked. ${tally(found, status.checked, status.total)} Those answers are already on this device.`
          : 'Offline, so projects cannot be checked yet. Nothing has been asked about.',
        note: status.checked > 0
          ? `Counts below cover only ${thoseClause(status.checked)}. They will pick up where they left off when you are back online.`
          : 'Nothing is stored yet, so there is nothing to show. County shading on the maps above still works offline.',
        actions: [],
      }
    case 'error':
      return {
        icon: 'alert', tone: 'error',
        msg: status.checked > 0
          ? `eBird could not be reached. ${tally(found, status.checked, status.total)} Nothing further was asked.`
          : 'eBird could not be reached, so no checklist has been asked about yet.',
        note: status.checked > 0
          ? `Counts below cover only ${thoseClause(status.checked)}.`
          : 'Nothing has been stored, so no count is shown.',
        actions: [{ id: 'retry', label: 'Try again' }],
      }
  }
}

/** The skipped-ids line, appended only when nonzero (FR-47). */
export function skippedNote(skipped: number, total: number): string {
  return `${fmt(skipped)} ${plural(skipped, 'row', 'rows')} in this backup ${plural(skipped, 'carries', 'carry')} no usable checklist id, so ${plural(skipped, 'it is', 'they are')} outside the ${countRef(total)}.`
}

/** A project or portal row's meta line: its share of the checklists checked,
 *  and (projects only) the span of dates contributed over. `share` is already
 *  routed through `fmtSharePct` by the caller, so a nonzero share never renders
 *  a bare rounded "0%". */
export function shareClause(share: string, checked: number): string {
  return `${share} of the ${countRef(checked)} checked`
}

/** The line beneath an unnamed project's raw identifier. Nothing is invented,
 *  and the reader is told why. */
export const UNNAMED_PROJECT_NOTE =
  'No public eBird endpoint gives this project a name, so its identifier is shown exactly as eBird reports it.'

export const PROJECTS_SUBLABEL = 'Projects you have contributed to'
export const PORTALS_SUBLABEL = 'How you submitted'

/** Micro-caption above the decorative participation chart. Constant, no
 *  counts — it labels a decoration whose accessible equivalent is the rows, and
 *  it lives here so the copy-corpus sweep sees every user-visible string. */
export const PROJECTS_CHART_CAPTION = 'Checklists per project'
/** The chart-ownership fallback (no projects block rendered, so the chart
 *  charts portals). A portal is NEVER called a project anywhere in this
 *  section — the portals note says so in as many words — so the fallback
 *  caption must not either. */
export const PORTALS_CHART_CAPTION = 'Checklists per portal'
export const PORTALS_NOTE =
  'The app or portal a checklist came in through, not a project. A project with its own portal appears in both places.'
