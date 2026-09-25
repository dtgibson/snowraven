// The widget deep-link grammar (ios-lifer-widgets, schema.md section 4.1).
// Dependency-free, and NOT on the entry graph: the link store App.tsx imports
// statically (`linkRequest.ts`) takes only this module's TYPE, which is erased,
// so the code is reached through the lazily loaded link controller and Map
// Explorer. entryChunk.test.ts asserts that its closure is this one file with
// no external imports, so it would stay entry-safe if it were ever reached
// statically.
//
// A URL here arrives from native, and ultimately from whatever process opened
// the `snowraven://` scheme -- any app on the device can. So the parser is a
// TABLE, not a grammar. The widget extension is the only author of these URLs
// (`DeepLink.swift` builds exactly these fifteen strings, and the shared fixture
// pins both builders to them), which makes exact match the smallest parser that
// can be correct rather than a limitation:
//
//   1. `typeof raw === 'string'` and `raw.length <= LINK_MAX_LENGTH`, checked
//      BEFORE anything else, so every later step runs over at most 64 code
//      units (the linearity argument, .claude/rules/security.md).
//   2. `raw` is byte-equal to one of the fifteen strings below, looked up with
//      `Object.hasOwn` on a null-prototype table (security.md v0.5.81), so
//      `constructor`, `__proto__` and friends are misses.
//
// No `URL` constructor, no query parsing, no case folding, no trailing-slash
// tolerance, no percent-decoding, no parameter reordering. A URL the widget
// did not build is ignored WHOLE: nothing is set, nothing is rendered, nothing
// is logged. Nothing from the URL is ever reflected into the UI -- a match
// yields only enum values taken from the table itself.
//
// Two unrelated words share a spelling here and must not be confused: the
// window token `all` is the Time range value "30 days" (the in-app TimeWindow),
// and the media value `any` is the widget's "missing any of photo, audio or
// video", which lands on the in-app chip row labelled All.

export const LINK_SCHEME = 'snowraven'
/** The longest valid URL is 47 characters; 64 leaves nothing useful for a payload. */
export const LINK_MAX_LENGTH = 64

/** The widget's fixed search radius, in miles (FR-18, FR-36): the widget
 *  fetches within it and the tap-through applies it as the session radius. */
export const WIDGET_RADIUS_MI = 25

export type LinkWindow = 'day' | 'week' | 'all'
export type LinkMedia = 'photo' | 'audio' | 'video' | 'any'

export type WidgetLink =
  | { view: 'lifers'; window: LinkWindow }
  | { view: 'targets'; window: LinkWindow; media: LinkMedia }

export const LINK_WINDOWS: readonly LinkWindow[] = ['day', 'week', 'all']
export const LINK_MEDIA: readonly LinkMedia[] = ['photo', 'audio', 'video', 'any']

/** The inverse of the parser, in the fixed parameter order: window, then media. */
export function buildWidgetLink(link: WidgetLink): string {
  const base = `${LINK_SCHEME}://map/${link.view}?window=${link.window}`
  return link.view === 'targets' ? `${base}&media=${link.media}` : base
}

/** Every valid link, in a fixed order: the three lifers links, then the twelve
 *  targets links (window-major). */
export const WIDGET_LINKS: readonly WidgetLink[] = [
  ...LINK_WINDOWS.map((window): WidgetLink => ({ view: 'lifers', window })),
  ...LINK_WINDOWS.flatMap(window => LINK_MEDIA.map((media): WidgetLink => ({ view: 'targets', window, media }))),
]

const TABLE: Record<string, WidgetLink> = Object.create(null)
for (const link of WIDGET_LINKS) TABLE[buildWidgetLink(link)] = Object.freeze({ ...link })

/** The link a widget built, or null for anything else (rejected whole). */
export function parseWidgetLink(raw: unknown): WidgetLink | null {
  if (typeof raw !== 'string' || raw.length > LINK_MAX_LENGTH) return null
  if (!Object.hasOwn(TABLE, raw)) return null
  return { ...TABLE[raw] }
}
