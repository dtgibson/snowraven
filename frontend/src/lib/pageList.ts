// The long-list paging pattern (the Weather backlog's, made generic for the
// Life Lists tab, life-lists-tab schema 6.2): the first 100 rows, then
// "Show next 100" and "Show all" while more remain. Pure; `weatherBacklog.ts`
// delegates to it, and its own tests are the proof the extraction changed
// nothing.

export const PAGE_SIZE = 100

export interface Paged<T> {
  visible: T[]
  total: number
  /** total > shown: offer "Show next 100" / "Show all". */
  hasMore: boolean
  /** How many would be shown after "Show next 100", capped at total. */
  nextCount: number
}

/** `shown` is the count currently revealed, clamped to [0, total]. */
export function pageList<T>(all: readonly T[], shown: number): Paged<T> {
  const total = all.length
  const clampedShown = Math.max(0, Math.min(shown, total))
  return {
    visible: all.slice(0, clampedShown),
    total,
    hasMore: total > clampedShown,
    nextCount: Math.min(clampedShown + PAGE_SIZE, total),
  }
}
