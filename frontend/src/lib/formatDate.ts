const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * Format an ISO-ish date ("YYYY-MM-DD", optionally with a trailing " HH:MM" time)
 * as month-first, e.g. "Jan 5, 2024". Returns "" for empty input and the original
 * string when it can't be parsed.
 *
 * Consolidates the byte-identical formatter that the Statistics, Multimedia, and
 * Breeding Codes tabs each defined separately. (The day-first map popups keep their
 * own formatters — they use a different, intentional format.)
 */
export function formatDateMonthFirst(value: string): string {
  if (!value) return ''
  const [y, m, d] = value.split(' ')[0].split('-').map(Number)
  if (!y || !m || !d) return value
  return `${MONTHS_ABBR[m - 1]} ${d}, ${y}`
}
