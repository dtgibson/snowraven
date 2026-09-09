// Count-bearing copy for Species Detail. Keep these builders outside the
// component so the generated corpus can exercise every reachable number-
// agreement boundary; an inline ternary would be invisible to that sweep.

/** The active county/date filter strip's checklist-basis summary. */
export function checklistFilterSummary(showing: number, total: number): string {
  return `Showing ${showing} of ${total} ${total === 1 ? 'checklist' : 'checklists'}`
}
