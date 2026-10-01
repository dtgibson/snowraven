// The widget deep-link grammar (ios-lifer-widgets, schema.md section 4.1).
// Dependency-free apart from the one-line `lib/speciesCode.ts`, and NOT on the
// entry graph: the link store App.tsx imports statically (`linkRequest.ts`)
// takes only this module's TYPE, which is erased, so the code is reached
// through the lazily loaded link controller and Map Explorer. entryChunk.test.ts
// asserts that its closure is those two files with no external imports, so it
// would stay entry-safe if it were ever reached statically.
//
// A URL here arrives from native, and ultimately from whatever process opened
// the `snowraven://` scheme -- any app on the device can. So the parser is an
// ALLOWLIST, not a query-string reader. The widget extension is the only author
// of these URLs (`DeepLink.swift` builds them, and the shared fixture pins both
// builders to one table). A link is a VIEW LINK, one of exactly fifteen strings,
// optionally followed by a BIRD SUFFIX `&sp=<speciesCode>&loc=<locId>` (Stage 8:
// a bird tap carries which bird):
//
//   1. `typeof raw === 'string'` and `raw.length <= LINK_MAX_LENGTH`, checked
//      BEFORE anything else, so every later step runs over at most 128 code
//      units (the linearity argument, .claude/rules/security.md).
//   1a. THE ALERT FORM (ios-alerts, schema.md section 5): one anchored pattern,
//      `ALERT_LINK_RE`, tried first. A match carries the check's point and
//      radius as two bounded decimals and one bounded integer, each then range
//      checked with `Number()`; a range failure REJECTS the whole link (its head
//      is not a view link, so there is no correct partial landing). No match
//      falls through to step 2 unchanged, so every widget link keeps its verdict.
//   2. Cut at the FIRST `&sp=` (a `&sp=` anywhere in a malformed string only
//      moves the cut earlier, and the head then fails step 3).
//   3. The head is byte-equal to one of the fifteen view links, looked up with
//      `Object.hasOwn` on a null-prototype table (security.md v0.5.81), so
//      `constructor`, `__proto__` and friends are misses. Anything else is
//      ignored WHOLE: nothing is set, nothing is rendered, nothing is logged.
//   4. An empty tail is the view link. Otherwise the tail must match
//      `BIRD_SUFFIX_RE` (anchored at both ends, two fixed classes with bounded
//      quantifiers, no alternation, no nesting: linear, no backtracking blowup).
//      A tail that does not match DEGRADES to the view link: the bird is
//      dropped and the view still opens. The view-only landing is the shipped
//      behavior and always correct, and it is what a widget and an app of
//      different versions must produce in either direction.
//
// No `URL` constructor, no query parsing, no case folding, no trailing-slash
// tolerance, no percent-decoding, no parameter reordering. Nothing from the URL
// is ever reflected into the UI: the view values come from the table, and the
// two bird ids are used only as `===` keys against records the app fetched from
// eBird itself (MapExplorer's `linkFocus`); the name it shows is the record's.
//
// Two unrelated words share a spelling here and must not be confused: the
// window token `all` is the Time range value "30 days" (the in-app TimeWindow),
// and the media value `any` is the widget's "missing any of photo, audio or
// video", which lands on the in-app chip row labelled All.

import { SPECIES_CODE_RE } from '../speciesCode'

export const LINK_SCHEME = 'snowraven'
/** The longest widget link is 88 characters (a 47-character view link and a
 *  41-character bird suffix). The longest ALERT link is 117 (ios-alerts,
 *  schema.md 5.1: 33 + `&lat=-12.34567` 14 + `&lng=-123.45678` 15 + `&r=25` 5 +
 *  `&sp=` and 16, 20 + `&loc=` and 16, 21 + `&show=all` 9). 128 leaves nothing
 *  useful for a payload. Pinned to `DeepLink.maxLength` in Swift. */
export const LINK_MAX_LENGTH = 128

/** The widget's fixed search radius, in miles (FR-18, FR-36): the widget
 *  fetches within it and the tap-through applies it as the session radius. */
export const WIDGET_RADIUS_MI = 25

/** An eBird location id: `L` and 1 to 15 digits, written with an explicit
 *  `[0-9]` (security.md v0.5.54, the ChecklistLink class for an `L` id). */
export const LOC_ID_RE = /^L[0-9]{1,15}$/

/** The bird suffix, built from the two id patterns so there is one definition
 *  of each: `^&sp=(<species code>)&loc=(<location id>)$`. */
export const BIRD_SUFFIX_RE = new RegExp(
  `^&sp=(${SPECIES_CODE_RE.source.slice(1, -1)})&loc=(${LOC_ID_RE.source.slice(1, -1)})$`,
)

export type LinkWindow = 'day' | 'week' | 'all'
export type LinkMedia = 'photo' | 'audio' | 'video' | 'any'

export type ViewLink =
  | { view: 'lifers'; window: LinkWindow }
  | { view: 'targets'; window: LinkWindow; media: LinkMedia }

/** Which bird a bird tap carried: two ids, never a name. */
export interface BirdRef { speciesCode: string; locId: string }

/** An alert link's show mode (ios-alerts, FR-31 / FR-37): `all` centers on the
 *  sighting with every lifer shown (the notification tap); `one` shows that
 *  species alone beside Show all (an inbox row tap). */
export type AlertShow = 'all' | 'one'

/** The alert link's extra parts: the check's point and radius, and the mode. */
export interface AlertLinkParts {
  point?: { lat: number; lng: number }
  radiusMi?: number
  show?: AlertShow
}

export type WidgetLink = ViewLink & { bird?: BirdRef } & AlertLinkParts

export const LINK_WINDOWS: readonly LinkWindow[] = ['day', 'week', 'all']
export const LINK_MEDIA: readonly LinkMedia[] = ['photo', 'audio', 'video', 'any']

function viewString(link: ViewLink): string {
  const base = `${LINK_SCHEME}://map/${link.view}?window=${link.window}`
  return link.view === 'targets' ? `${base}&media=${link.media}` : base
}

/**
 * THE ALERT FORM, one anchored pattern (ios-alerts, schema.md 5.1): fixed
 * classes, bounded quantifiers, no nesting, and no alternation but the
 * two-word `show`. Linear in its input, which the length gate bounds at 128.
 * The SOURCE TEXT is pinned to `AlertLink.pattern` in the app target's Swift
 * (`widgetPaths.parity.test.ts` compares the two literals character for
 * character), and the species-code and location-id classes are the two
 * patterns above spelled out, which the same guard checks.
 */
export const ALERT_LINK_PATTERN =
  '^snowraven://map/lifers\\?window=day&lat=(-?[0-9]{1,2}(?:\\.[0-9]{1,5})?)&lng=(-?[0-9]{1,3}(?:\\.[0-9]{1,5})?)&r=([0-9]{1,2})&sp=([a-z0-9-]{2,16})&loc=(L[0-9]{1,15})&show=(all|one)$'
export const ALERT_LINK_RE = new RegExp(ALERT_LINK_PATTERN)

/** The radius an alert link may carry, in whole miles (FR-11). */
export const ALERT_LINK_RADIUS_MIN = 1
export const ALERT_LINK_RADIUS_MAX = 25

/** A coordinate as the builders print it and the parser returns it: five
 *  decimals (`toFixed(5)`, the app's own form; `JSNumber.toFixed` in Swift),
 *  with a negative zero read as zero so the two sides agree on the value. */
export function alertCoord(x: number): number {
  const v = Number(x.toFixed(5))
  return v === 0 ? 0 : v
}

function inRange(lat: number, lng: number, r: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    && Number.isInteger(r) && r >= ALERT_LINK_RADIUS_MIN && r <= ALERT_LINK_RADIUS_MAX
}

/** Whether a link is the alert form (all three parts present). */
export function isAlertLink(link: WidgetLink): link is WidgetLink & Required<AlertLinkParts> & { bird: BirdRef } {
  return link.point !== undefined && link.radiusMi !== undefined && link.show !== undefined && link.bird !== undefined
}

/** Whether both ids are ones a link may carry. */
export function isLinkableBird(bird: BirdRef): boolean {
  return SPECIES_CODE_RE.test(bird.speciesCode) && LOC_ID_RE.test(bird.locId)
}

/**
 * The inverse of the parser, in the fixed parameter order: window, then media,
 * then the bird. REFUSES (throws) a bird whose ids fail the two patterns, so
 * this side can never build an out-of-pattern link (the Swift builder returns
 * the view link for the same pair, which the fixture pins).
 */
export function buildWidgetLink(link: WidgetLink): string {
  const view = viewString(link)
  const alertParts = link.point !== undefined || link.radiusMi !== undefined || link.show !== undefined
  if (alertParts) {
    // The alert form: every part present, lifers and Day only, each number in
    // range and the two ids in pattern; anything else is refused, never
    // degraded, because a builder that emits a link the parser would reject
    // is the one defect the fixture cannot see from the parser side.
    if (!isAlertLink(link) || link.view !== 'lifers' || link.window !== 'day') {
      throw new Error('buildWidgetLink: an incomplete alert link')
    }
    if (!inRange(link.point.lat, link.point.lng, link.radiusMi)) throw new Error('buildWidgetLink: an alert link out of range')
    if (!isLinkableBird(link.bird)) throw new Error('buildWidgetLink: a bird id outside its pattern')
    return `${view}&lat=${link.point.lat.toFixed(5)}&lng=${link.point.lng.toFixed(5)}&r=${link.radiusMi}`
      + `&sp=${link.bird.speciesCode}&loc=${link.bird.locId}&show=${link.show}`
  }
  if (!link.bird) return view
  if (!isLinkableBird(link.bird)) throw new Error('buildWidgetLink: a bird id outside its pattern')
  return `${view}&sp=${link.bird.speciesCode}&loc=${link.bird.locId}`
}

/** Every valid view link, in a fixed order: the three lifers links, then the
 *  twelve targets links (window-major). */
export const WIDGET_LINKS: readonly ViewLink[] = [
  ...LINK_WINDOWS.map((window): ViewLink => ({ view: 'lifers', window })),
  ...LINK_WINDOWS.flatMap(window => LINK_MEDIA.map((media): ViewLink => ({ view: 'targets', window, media }))),
]

const TABLE: Record<string, ViewLink> = Object.create(null)
for (const link of WIDGET_LINKS) TABLE[viewString(link)] = Object.freeze({ ...link })

/** The link a widget built, or null for anything whose view part is not one of
 *  the fifteen (rejected whole). A malformed bird suffix degrades to the view. */
export function parseWidgetLink(raw: unknown): WidgetLink | null {
  if (typeof raw !== 'string' || raw.length > LINK_MAX_LENGTH) return null
  const alert = ALERT_LINK_RE.exec(raw)
  if (alert) {
    const lat = Number(alert[1]!)
    const lng = Number(alert[2]!)
    const radiusMi = Number(alert[3]!)
    if (!inRange(lat, lng, radiusMi)) return null
    return {
      view: 'lifers', window: 'day',
      point: { lat: lat === 0 ? 0 : lat, lng: lng === 0 ? 0 : lng },
      radiusMi,
      bird: { speciesCode: alert[4]!, locId: alert[5]! },
      show: alert[6] as AlertShow,
    }
  }
  const cut = raw.indexOf('&sp=')
  const head = cut < 0 ? raw : raw.slice(0, cut)
  if (!Object.hasOwn(TABLE, head)) return null
  const view: WidgetLink = { ...TABLE[head] }
  if (cut < 0) return view
  const m = BIRD_SUFFIX_RE.exec(raw.slice(cut))
  if (m) view.bird = { speciesCode: m[1]!, locId: m[2]! }
  return view
}
