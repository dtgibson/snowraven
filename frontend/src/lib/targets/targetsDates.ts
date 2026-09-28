// The Targets tab's calendar-day helpers (targets-tab, schema.md section 14,
// verify-item 6): ONE definition of "the device's local date" shared by the
// sweep that builds the 30-day list, the day cache that decides whether an
// entry is `complete`, and the window rule that asks whether every day in a
// window has been checked. If those three disagreed on the date string at a
// midnight or a DST boundary, a day could be fetched under one key and looked
// up under another, and a checked day would read as unchecked forever.
//
// Pure: every `ms` is a parameter (the render-purity rule); nothing here reads
// the clock. Dependency-free.

/** "YYYY-MM-DD" for the device-local calendar date containing `ms`. */
export function localDateString(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${String(y).padStart(4, '0')}-${m}-${day}`
}

/** The number of calendar days the live sweep covers (FR-41). */
export const SWEEP_DAYS = 30

/**
 * The `n` device-local calendar dates ending on the date containing `nowMs`,
 * NEWEST FIRST: index 0 is today, index n-1 is n-1 days ago.
 *
 * Built by calendar arithmetic on the local date's components (the Date
 * constructor normalizes a day-of-month below 1 into the previous month and
 * year), anchored at local NOON so no DST transition, which always happens in
 * the small hours, can move a constructed instant onto a neighbouring date.
 * Never `nowMs - i * 86_400_000`: across a spring-forward or fall-back night
 * that subtraction lands an hour off midnight and can repeat or skip a date.
 */
export function lastNDates(nowMs: number, n: number = SWEEP_DAYS): string[] {
  const now = new Date(nowMs)
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    out.push(localDateString(new Date(y, m, d - i, 12).getTime()))
  }
  return out
}
