// Every user-facing string the Named Birds timelines add, in one module.
//
// WHY ONE MODULE, including the count-bearing strings: a count-bearing string
// built inline in a component is invisible to the generated-corpus copy sweep
// however correct it is today (the v1.0.5 rule). So `birdCount`, `readLine2` and
// `places` live here beside the fixed labels, and the sweep in
// `namedBirdTimelineCopy.test.ts` generates its corpus from these functions over
// every count the tab can reach rather than from a hand-written sample.
//
// No em dashes (U+2014) anywhere in this file: it is user-facing copy and rides
// the repo-wide sweep in `.claude/rules/docs-and-website.md`.
//
// The surface these strings belong to is **Named Birds** (`TAB_LABELS` in
// `lib/tabLayout.ts` is authoritative). "Master timeline" is an internal name
// that never reaches the screen; the visible heading is `All named birds over
// time`.
//
// It imports `formatDate` and nothing else, so it is entry-chunk safe:
// `NamedBirds` is a STATIC import in App.tsx, unlike every other heavy tab.

import { formatDate } from './formatDate'
import type { SpanRange, TimelineAxis } from './namedBirdTimeline'

/** The range control's own label, beside its two pills. */
export const rangeLabel = 'Measure to'
export const optLastSighting = 'Last sighting'
export const optToday = 'Today'

/**
 * Accessible names for the three range-control instances. They are required
 * props rather than a default, so two groups on one page can never share a name.
 */
export const rangeGroupTab = 'Measure every span to'
export const rangeGroupCard = 'Measure every span to, repeated in the open card'
export const rangeGroupMaster = 'Measure every span to, repeated below the list'

/**
 * The one instance that reads as card-local carries the scope note, because the
 * explanation belongs where the ambiguity is.
 */
export const scopeNote = 'Applies to every named bird on this tab.'

/** Section micro-labels. */
export const perBirdHead = 'Sightings over time'
export const masterHead = 'All named birds over time'

/** Resting line of a readout, before anything is selected. */
export const restPerBird = 'Select a sighting to see its date and place.'
export const restMaster = 'Select a sighting to see its bird, date and place.'

/** The master strip's own listbox name. */
export const lbMaster = 'Sightings of every named bird over time'

/**
 * Which two dates the figure measures, named in words on every card so a reader
 * who never touches the control can tell (FR-08).
 */
export function endpoints(range: SpanRange): string {
  return range === 'today' ? 'first sighting to today' : 'first to last sighting'
}

/** A per-bird listbox name. */
export function lbPerBird(name: string): string {
  return `Sightings of ${name} over time`
}

/** A master lane's group name. Species omitted where the tab omits it. */
export function laneGroup(name: string, species: string): string {
  return species ? `${name}, ${species}` : name
}

/**
 * A bird with two or more sightings all on ONE date has no axis, so it gets a
 * sentence rather than a strip. Reuses the shipped `Every sighting at {place}.`
 * one-item idiom from `NamedBirdLocations`.
 */
export function oneDate(date: string): string {
  return `Every sighting on ${formatDate(date)}.`
}

/** `1 named bird` / `N named birds`. The one count word the tab repeats. */
export function birdCount(n: number): string {
  return `${n} named ${n === 1 ? 'bird' : 'birds'}`
}

/**
 * The FR-38 sentence: it sits OUTSIDE the master listbox and carries the bird
 * count and both axis endpoint dates to the accessibility tree, which is what
 * makes the strip's meaning reachable without a live region.
 */
export function masterSentence(n: number, axis: TimelineAxis, range: SpanRange): string {
  const start = formatDate(axis.start)
  const end = formatDate(axis.end)
  return range === 'today'
    ? `${birdCount(n)}, from ${start} to today, ${end}.`
    : `${birdCount(n)}, from ${start} to ${end}.`
}

/**
 * The visible caption INSIDE the listbox. It is `aria-hidden`, because
 * `masterSentence` above already carries the same facts to the accessibility
 * tree and announcing both would say them twice.
 */
export function masterCaption(n: number, range: SpanRange): string {
  return `${birdCount(n)} · ${endpoints(range)}`
}

/**
 * The places a sighting date covers, in words.
 *
 * The PROPERTY over the whole input domain, not two sample values: for a list of
 * length n it renders the first element alone at n = 1, both joined by "and" at
 * n = 2, and the first element plus "and {n - 1} more places" at every n >= 3 —
 * so the count word is always plural where it appears (n - 1 >= 2), and the
 * empty list renders the empty string, which every caller drops rather than
 * printing a dangling separator.
 */
export function places(list: readonly string[]): string {
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list[0]} and ${list.length - 1} more places`
}

/**
 * The readout's line 1: the identity of the sighting the reader has landed on.
 * `bird` is empty on a card (the card already names it) and the bird's name on
 * the master. Each segment is omitted when absent, so there is never a dangling
 * middot.
 */
export function readLine1(bird: string, date: string, placeList: readonly string[]): string {
  const p = places(placeList)
  return `${bird ? `${bird} · ` : ''}${formatDate(date)}${p ? ` · ${p}` : ''}`
}

/**
 * The readout's line 2: the muted position.
 *
 * "dates", NOT "sightings", is load-bearing: two checklists on one date are ONE
 * mark, so this is the line that explains how a card reading `8 sightings` shows
 * 7 marks.
 */
export function readLine2(i: number, n: number): string {
  return `${i} of ${n} ${n === 1 ? 'date' : 'dates'}`
}

/**
 * An option's accessible NAME — the whole payload, so a screen-reader user never
 * needs the visible readout.
 *
 * Comma-punctuated rather than middot-separated because it is SPOKEN. It carries
 * NO position words: "2 of 7" is `aria-posinset`/`aria-setsize`'s job, and
 * putting it in the name as well makes the screen reader say it twice.
 */
export function optionName(bird: string, date: string, placeList: readonly string[]): string {
  const p = places(placeList)
  return `${bird ? `${bird}, ` : ''}${formatDate(date)}${p ? `, ${p}` : ''}`
}
