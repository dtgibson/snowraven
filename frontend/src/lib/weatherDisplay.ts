// The Weather chart's display vocabulary: the condition labels, the sky display
// order, and the reordering helper.
//
// EXTRACTED FROM `WeatherStatsSection.tsx` VERBATIM (species-detail-weather),
// not rewritten. Two surfaces now render sky rows -- the Statistics section and
// the Species Detail card -- and FR-20 requires them in the SAME display order,
// addressed by the payload's explicit `index`. Leaving the order in the section
// file would mean either a second copy of it or a component importing a
// component; one copy in a module both import is the whole point.
//
// A `.ts` RATHER THAN THE `.tsx` IT CAME FROM, deliberately: these are data and
// a pure helper, and a non-component export from a `.tsx` trips
// `react-refresh/only-export-components`, which is build-blocking in this repo
// (the shipped `WeatherSectionIcon` comment records exactly that).
//
// Entry-safe: its only import is a TYPE import, erased at build and invisible to
// `entryChunk.test.ts`'s walker.

import type { WeatherDistRow } from './weatherStats'

/**
 * A label per CONDITION_EMOJI index. `🌡️` is `conditionEmoji()`'s fallback for
 * an OpenWeather sky code outside its documented ranges, so a checklist can
 * genuinely land there: it is a real value the formatter wrote into a real
 * block, NOT a parse failure and NOT a missing field (missing is null and is
 * excluded from the axis denominator entirely). Its label is therefore "Other",
 * and "Unknown", "Unknown weather", "Unrecognised", "Error" and "Could not
 * read" are all wrong for it.
 */
export const CONDITION_LABEL = [
  'Thunderstorm', 'Drizzle', 'Rain', 'Snow', 'Fog', 'Clear',
  'Few clouds', 'Scattered clouds', 'Broken clouds', 'Overcast', 'Other',
]

/**
 * Display order: sky clarity, clearest first, foulest last, with `🌡️` pinned
 * last as the residual.
 *
 * That is how a birder describes a day, and it makes the chart a gradient
 * instead of an arbitrary list. The residual pin follows the shipped
 * Share-breakdown rule: the "none of the above" row sits last so it reads as a
 * different kind of row without relying on colour alone.
 *
 * THE WIRE ORDER IS DIFFERENT AND IS NOT THIS. `CONDITION_EMOJI` is pinned in
 * `conditionEmoji()`'s own branch order and `species.byCondition[i][j]`
 * addresses it, so rows are read by `row.index` and never by array position --
 * which is what makes reordering here free.
 */
export const CONDITION_DISPLAY_ORDER = [5, 6, 7, 8, 9, 4, 1, 2, 3, 0, 10]

export const inDisplayOrder = <T extends WeatherDistRow>(rows: T[]): T[] => {
  const byIndex = new Map<number, T>()
  for (const r of rows) byIndex.set(r.index, r)
  const out: T[] = []
  for (const i of CONDITION_DISPLAY_ORDER) {
    const r = byIndex.get(i)
    if (r !== undefined) out.push(r)
  }
  return out
}
