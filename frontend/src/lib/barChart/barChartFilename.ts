// What eBird's bar-chart download NAME says about the file (targets-tab,
// schema.md section 2.2), plus the month-range helpers the status line and the
// year-round gate read.
//
// The parser itself is DEFINED in `lib/uploadGuard.ts` and only re-exported
// here, deliberately: the refusal registry owns every filename rule (section
// 2.3), and `uploadGuard.ts` is on App.tsx's static graph, so it cannot import
// anything under `lib/barChart/` (the parser must stay off the entry chunk).
// Consumers inside the Targets chunk import it from this module so the tab's
// graph reads as one family.

export { parseBarChartFilename } from '../uploadGuard'
export type { BarChartFilenameInfo } from '../uploadGuard'

export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * The twelve months a download's `bmo`..`emo` range covers, as twelve booleans
 * (index 0 is January). eBird's range WRAPS when the begin month is after the
 * end month: `11..2` is November through February.
 */
export function monthsInRange(b: number, e: number): boolean[] {
  const out = new Array<boolean>(12).fill(false)
  if (!Number.isInteger(b) || !Number.isInteger(e) || b < 1 || b > 12 || e < 1 || e > 12) return out
  let m = b - 1
  for (let guard = 0; guard < 12; guard++) {
    out[m] = true
    if (m === e - 1) break
    m = (m + 1) % 12
  }
  return out
}

/**
 * A month set as the status line prints it: "Jan-Dec" for all twelve, "Mar-May"
 * for a run, "Mar" for one month, "Nov-Feb" for a run across the year end, and
 * several runs joined with ", " in calendar order of their first month. ASCII
 * hyphens only (the copy rule: no em or en dash). Empty set: "".
 */
export function monthRangeLabel(months: readonly boolean[]): string {
  const on = (i: number) => months[((i % 12) + 12) % 12] === true
  let all = true
  let any = false
  for (let i = 0; i < 12; i++) { if (on(i)) any = true; else all = false }
  if (all) return 'Jan-Dec'
  if (!any) return ''
  const runs: string[] = []
  for (let start = 0; start < 12; start++) {
    // A run starts where a month is present and the month before it is not.
    if (!on(start) || on(start - 1)) continue
    let end = start
    while (on(end + 1)) end++
    const first = MONTH_ABBR[start]
    const last = MONTH_ABBR[end % 12]
    runs.push(end === start ? first : `${first}-${last}`)
  }
  return runs.join(', ')
}
