// The Weather/tide Planner's "Days in view" choice (design-spec.md, Days in
// view; decisions D4-14 / D4-15): a device-local UI preference persisted
// through the storage seam as the setting `planDaysInView`, validated on read
// (anything unrecognised reads as 'all'), never synced, the `chartTipDismissed`
// precedent. Entry-safe: no imports.

export type PlanDaysInView = '1' | '3' | '7' | 'all'

export const PLAN_DAYS_IN_VIEW_SETTING = 'planDaysInView'

export const PLAN_DAYS_IN_VIEW_DEFAULT: PlanDaysInView = 'all'

const VALUES: ReadonlySet<string> = new Set(['1', '3', '7', 'all'])

/** The stored value, or the default for anything that is not one of the four. */
export function asPlanDaysInView(raw: unknown): PlanDaysInView {
  return typeof raw === 'string' && VALUES.has(raw) ? (raw as PlanDaysInView) : PLAN_DAYS_IN_VIEW_DEFAULT
}

/** The options a plan of `dayCount` days offers: 1 / 3 / 7 where the count is
 *  BELOW the plan's day count, then All. A five-day plan offers 1, 3 and All. */
export function planDaysInViewOptions(dayCount: number): PlanDaysInView[] {
  const out: PlanDaysInView[] = []
  for (const v of ['1', '3', '7'] as const) if (Number(v) < dayCount) out.push(v)
  out.push('all')
  return out
}

/** The hours the chosen span covers, for the pixels-per-hour computation. */
export function planHoursInView(axisStartTs: number, endTs: number, view: PlanDaysInView): number {
  return view === 'all' ? (endTs + 1 - axisStartTs) / 3600 : Number(view) * 24
}
