// Every sentence and label the Life Lists tab renders (life-lists-tab schema 6.4).
//
// The count sentence multiplies with the media selection (eight states), so it is
// GENERATED from one ordered manifest plus pure builders, never a hand-written
// table (ui.md v0.5.81). Each noun is its OWN column, never a label lowercased.
// `lifeListsCopy.test.ts` sweeps every builder over every reachable state.

import { MEDIA_FORMATS, type MediaFormat, type MediaPresence } from './lifeLists'

export interface FormatCopy {
  /** The button's visible label. */
  readonly label: string
  /** "N species with {withNoun}". */
  readonly withNoun: string
  /** "newest first by the date of {firstNoun}". */
  readonly firstNoun: string
  /** The media cell's accessible name ("Media: photo, audio"). */
  readonly presenceNoun: string
}

export const FORMAT_COPY: Readonly<Record<MediaFormat, FormatCopy>> = {
  Photo: { label: 'Photo', withNoun: 'a photo', firstNoun: 'your first photo', presenceNoun: 'photo' },
  Audio: { label: 'Audio', withNoun: 'audio', firstNoun: 'your first audio recording', presenceNoun: 'audio' },
  Video: { label: 'Video', withNoun: 'video', firstNoun: 'your first video', presenceNoun: 'video' },
}

/** The selected formats in the fixed manifest order, whatever order they were pressed in. */
function selectedInOrder(formats: ReadonlySet<MediaFormat>, order: readonly MediaFormat[]): MediaFormat[] {
  const out: MediaFormat[] = []
  for (const f of order) if (formats.has(f)) out.push(f)
  return out
}

/** "a, b, and c" with the serial comma; "a and b" for two. */
function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** N with locale grouping ("1,204"). "1 species" is correct English. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * FR-33, split so the tab can set N in its own weight: `count + rest` is the
 * sentence. `order` is a defaulted parameter so the suite can prove the builder
 * by adding a hypothetical fourth format.
 */
export function countSentenceParts(
  n: number,
  formats: ReadonlySet<MediaFormat>,
  order: readonly MediaFormat[] = MEDIA_FORMATS,
  copy: Readonly<Record<string, FormatCopy>> = FORMAT_COPY,
): { count: string; rest: string } {
  const count = formatCount(n)
  const on = selectedInOrder(formats, order)
  if (on.length === 0) return { count, rest: ' species, newest first by the date of your first sighting.' }
  if (on.length === 1) return { count, rest: ` species with ${copy[on[0]].withNoun}, newest first by the date of ${copy[on[0]].firstNoun}.` }
  const tail = on.length === 2 ? 'each had both' : on.length === 3 ? 'each had all three' : `each had all ${on.length}`
  return { count, rest: ` species with ${joinList(on.map(f => copy[f].withNoun))}, newest first by the date ${tail}.` }
}

export function countSentence(n: number, formats: ReadonlySet<MediaFormat>): string {
  const { count, rest } = countSentenceParts(n, formats)
  return count + rest
}

/** FR-34. */
export function emptySentence(formats: ReadonlySet<MediaFormat>): string {
  return formats.size === 0 ? 'No countable species in your eBird backup yet.' : 'No species matches this selection yet.'
}

/** FR-20, verbatim. */
export const STATUS_UNRESOLVED = 'Escapee and exotic status comes from the exotic status check on Statistics, which has not finished for this export, so species it has not settled are listed.'
export const STATUS_RESOLVED = 'Escapee and exotic status comes from the exotic status check on Statistics, so with both switches off this list can be shorter than the Statistics species figure.'

/** FR-27, verbatim. */
export const ML_NONE_SENTENCE = 'Photo, audio, and video life lists need your Macaulay Library export, saved in Settings under Default Files.'
export const ML_UNREADABLE_SENTENCE = "SnowRaven couldn't read your Macaulay Library export, so photo, audio, and video life lists are unavailable; re-upload it in Settings under Default Files."

/** FR-05 and the house header. */
export const TAB_TITLE = 'Life Lists'
export const TAB_DESCRIPTION = "Every species you've recorded, newest first, with the checklist and place of your first sighting, or of your first photo, audio, or video."
export const SETUP_TITLE = 'eBird Backup Required'
export const SETUP_BODY = "The Life Lists tab loads automatically from your stored eBird backup. You haven't saved one yet."
export const LOADING_LABEL = 'Loading your life list'

/** FR-35. */
export const SWITCH_LABELS = { escapees: 'Include Escapees', exotics: 'Include Exotics' } as const

/** The media group's visible label. */
export const MEDIA_GROUP_LABEL = 'Media'

/** FR-37, the Weather backlog's labels. */
export const SHOW_NEXT_LABEL = 'Show next 100'
export function showAllLabel(total: number): string { return `Show all (${formatCount(total)})` }
export function showingLabel(visible: number): string { return `Showing 1\u2013${formatCount(visible)}` }

/** FR-42: the screen-reader position prefix inside the name cell. */
export function positionPrefix(position: number, total: number): string {
  return `${formatCount(position)} of ${formatCount(total)}.`
}

/** FR-31: the accessible stand-in for a row with no linkable checklist. */
export const NO_CHECKLIST_LABEL = 'No checklist'

/** FR-44: the media cell's accessible name, the present formats in the fixed order. */
export function mediaLabel(
  media: MediaPresence,
  order: readonly MediaFormat[] = MEDIA_FORMATS,
): string {
  const present: string[] = []
  for (const f of order) {
    const has = f === 'Photo' ? media.photo : f === 'Audio' ? media.audio : media.video
    if (has) present.push(FORMAT_COPY[f].presenceNoun)
  }
  return present.length === 0 ? 'No media' : `Media: ${present.join(', ')}`
}
