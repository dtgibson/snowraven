// Every sentence and label the Family Tree tab renders (family-rollups-and-
// tree design-spec section 17; NFR-13). Every count-bearing string is built
// here, with count-of-one agreement and locale grouping, so the copy sweep in
// `familyTreeCopy.test.ts` reaches it by calling the shipped builders over a
// generated corpus; a count-bearing string built inline in a component is
// invisible to that sweep, which is why none is. No em dash, American
// spelling, the serial comma; tab names from TAB_LABELS.

import { fmtSharePct } from './statsFormat'

export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

/** One noun with count-of-one agreement. */
function noun(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

// -- The house header and the phases --------------------------------------------

export const TAB_TITLE = 'Family Tree'
export const TAB_DESCRIPTION = 'Your life list arranged by order, family, and genus, as a table and as a tree you can zoom.'
export const SETUP_TITLE = 'eBird Backup Required'
export const SETUP_BODY = "The Family Tree tab loads automatically from your stored eBird backup. You haven't saved one yet."
export const LOADING_LABEL = 'Loading your family tree'
/** FR-14: the one constant message for a failed family asset. */
export const FAMILY_DATA_ERROR = "SnowRaven couldn't load its bird family data."

// -- The filter strip ------------------------------------------------------------

export const YEAR_LABEL = 'Year'
export const ALL_YEARS = 'All years'
export const MEDIA_LABEL = 'Media'
export const ML_NONE_SENTENCE = 'Photo, audio, and video figures need your Macaulay Library export, saved in Settings under Default Files.'
export const ML_UNREADABLE_SENTENCE = "SnowRaven couldn't read your Macaulay Library export, so photo, audio, and video figures are unavailable; re-upload it in Settings under Default Files."

export type KindKey = 'photo' | 'audio' | 'video'
export const KIND_KEYS: readonly KindKey[] = ['photo', 'audio', 'video']

interface KindCopy {
  /** The pill at rest and the kind's name in its title. */
  readonly label: string
  readonly has: string
  readonly lacks: string
  /** The table's column, and the readout's row term. */
  readonly column: string
  /** "{n} species {verb}", the stacked row's words. */
  readonly verb: string
  readonly itemOne: string
  readonly itemMany: string
}

export const KIND_COPY: Readonly<Record<KindKey, KindCopy>> = {
  photo: { label: 'Photo', has: 'Has photo', lacks: 'No photo', column: 'Photographed', verb: 'photographed', itemOne: 'photo', itemMany: 'photos' },
  audio: { label: 'Audio', has: 'Has audio', lacks: 'No audio', column: 'Recorded', verb: 'recorded', itemOne: 'recording', itemMany: 'recordings' },
  video: { label: 'Video', has: 'Has video', lacks: 'No video', column: 'Filmed', verb: 'filmed', itemOne: 'video', itemMany: 'videos' },
}

/** The pill's title: "{Kind}. Press to cycle: any, has, lacks". */
export function pillTitle(k: KindKey): string {
  return `${KIND_COPY[k].label}. Press to cycle: any, has, lacks`
}

/** "{items} {photos | recordings | videos}". */
export function itemsLabel(k: KindKey, n: number): string {
  return `${formatCount(n)} ${noun(n, KIND_COPY[k].itemOne, KIND_COPY[k].itemMany)}`
}


// -- The headline and the standing notes ----------------------------------------

export const HEADLINE_LABELS = { species: 'Species', families: 'Families', orders: 'Orders' } as const

/** "of {world} in the world". */
export function ofWorld(world: number): string {
  return `of ${formatCount(world)} in the world`
}

export function share(seen: number, world: number): string {
  return fmtSharePct(seen, world)
}

/** A seen-of-world bar's fill as a CSS length, from the two integers (the bar
 *  is `aria-hidden`; the two numbers are always text beside it). */
export function barWidth(seen: number, world: number): string {
  const pct = world > 0 ? Math.min(100, (seen / world) * 100) : 0
  return `${pct.toFixed(2)}%`
}

/** The polite live region's sentence after a press. */
export function headlineSentence(species: number, families: number, orders: number): string {
  return `${formatCount(species)} species in ${formatCount(families)} ${noun(families, 'family', 'families')} and ${formatCount(orders)} ${noun(orders, 'order', 'orders')}.`
}

export const FILTER_NOTE = 'Family totals are world species and do not change with the filters.'
export const ESCAPEE_STATUS = 'Escapee status comes from the escapee check on Statistics, which has not finished for this export, so species it has not settled are counted.'

/** The media scoping note's parts, so the tab sets the region and year in weight. */
export function mediaScopeParts(region: string | null, year: string | null): { before: string; region: string | null; middle: string; year: string | null; after: string } | null {
  if (region === null && year === null) return null
  if (region !== null && year !== null) return { before: 'Photo, audio, and video figures count only media from ', region, middle: ' dated ', year, after: '.' }
  if (region !== null) return { before: 'Photo, audio, and video figures count only media from ', region, middle: '', year: null, after: '.' }
  return { before: 'Photo, audio, and video figures count only media dated ', region: null, middle: '', year, after: '.' }
}

// -- The view bar ----------------------------------------------------------------

export const VIEW_GROUP_LABEL = 'View'
export const VIEW_LABELS = { rollup: 'Table', diagram: 'Tree' } as const
export const NAMES_GROUP_LABEL = 'Names shown'
export const NAMES_LABELS = { common: 'Common', scientific: 'Scientific', both: 'Both' } as const

// -- The toolbar -----------------------------------------------------------------

export const SORT_LABEL = 'Sort'
export const SORT_LABELS = {
  taxonomic: 'Taxonomic order', name: 'Family name', seen: 'Species seen', share: 'Share of world species',
  photo: 'Species photographed', audio: 'Species recorded', video: 'Species filmed',
} as const
export const TOOLS_LABEL = 'View tools'
export const EXPAND_ALL = 'Expand all'
export const COLLAPSE_ALL = 'Collapse all'

// -- The table -------------------------------------------------------------------

export const COLUMN_FAMILY = 'Family'
export const COLUMN_SEEN = 'Seen of world species'

/** An order heading's figures: "{seen} of {world} species, a middle dot, {f} of {fw} families". */
export function orderFigures(seen: number, world: number, familiesSeen: number, familiesWorld: number): { seen: string; rest1: string; families: string; rest2: string } {
  return {
    seen: formatCount(seen),
    rest1: ` of ${formatCount(world)} species \u00b7 `,
    families: formatCount(familiesSeen),
    rest2: ` of ${formatCount(familiesWorld)} ${noun(familiesWorld, 'family', 'families')}`,
  }
}

/** "{seen} of {world}", in two parts so the seen figure sets in its weight. */
export function seenOfWorld(seen: number, world: number): { seen: string; rest: string } {
  return { seen: formatCount(seen), rest: ` of ${formatCount(world)}` }
}

/** A genus line's figure. */
export function genusSpecies(n: number): string {
  return `${formatCount(n)} species`
}

/** The separator between a second name and an order's name on a family row. */
export const DOT_SEPARATOR = ' \u00b7 '

/**
 * The accessible name of a family row: the names it shows, then every figure
 * it shows, each with its words, so a screen reader hears what the columns say
 * by position (NFR-07). The visible figures are all inside it (WCAG 2.5.3).
 */
export function familyRowLabel(
  names: string, seen: number, world: number,
  withKind: readonly [number, number, number] | null = null, items: readonly [number, number, number] | null = null,
): string {
  let out = `${names}, ${formatCount(seen)} of ${formatCount(world)} species, ${fmtSharePct(seen, world)}`
  if (withKind !== null && items !== null) {
    KIND_KEYS.forEach((k, i) => {
      out += `, ${formatCount(withKind[i])} species ${KIND_COPY[k].verb}`
      if (items[i] > 0) out += `, ${itemsLabel(k, items[i])}`
    })
  }
  return out
}

export const NOT_PLACED_HEADING = 'Not placed'
export const NOT_PLACED_ROW = 'Species with no family here'
/** "{N} species, counted in the species total above". */
export function notPlacedSub(n: number): string {
  return `${formatCount(n)} species, counted in the species total above`
}
/** FR-25's reason, agreeing with the count. */
export function notPlacedReason(n: number): string {
  return n === 1
    ? "eBird's taxonomy in this version of SnowRaven does not list this name, so it has no family here."
    : "eBird's taxonomy in this version of SnowRaven does not list these names, so they have no family here."
}
export function notPlacedRowLabel(n: number): string {
  return `${NOT_PLACED_ROW}, ${notPlacedSub(n)}`
}

// -- The footer lines ------------------------------------------------------------

/** "{N} species {is | are} not placed on the tree." */
export function notPlacedLine(n: number): string {
  return `${formatCount(n)} species ${noun(n, 'is', 'are')} not placed on the tree.`
}
/** "Show {it | them} in the table". */
export function showInTable(n: number): string {
  return `Show ${noun(n, 'it', 'them')} in the table`
}
/** FR-26. */
export function notSingleSpeciesLine(n: number): string {
  return `${formatCount(n)} other ${noun(n, 'entry', 'entries')} in your backup ${noun(n, 'is', 'are')} not a single species, so ${noun(n, 'it has', 'they have')} no place on the tree.`
}

// -- Empty states ------------------------------------------------------------------

export const EMPTY_UNFILTERED = 'No countable species in your eBird backup yet.'
export const EMPTY_FILTERED = 'No species match these filters.'
