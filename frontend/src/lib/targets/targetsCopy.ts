// Every string the Targets tab renders, in one module (targets-tab, schema.md
// section 6.3; design-spec Content Notes), so the copy guard
// (`targetsCopy.test.ts`) can sweep RULES over a generated corpus rather than
// a ban list: no em dash anywhere, "%" in every probability string and in no
// live string, and no count of one taking a plural noun. A count-bearing
// string built inline in a component would be invisible to that sweep however
// correct it is today, which is why the builders live here and the components
// only call them (ui.md, v1.0.5 / v1.0.22).
//
// THE TWO KINDS NEVER BORROW EACH OTHER'S NOUN. Probability copy always names
// eBird, the county and the file's range and always carries "%"; live copy
// always names its window and its count and never carries "%" (FR-36, FR-42,
// FR-58). The same words are what the accessible names read.
//
// `{County}` is always "Name, ST" ("Alameda, CA"): TIGER's county name carries
// no suffix and eBird's own region naming has none (schema.md 5.1).
//
// Dependency-free, so the guard can import it without a DOM.

// ── Counts ───────────────────────────────────────────────────────────────────

/** "1,183" — the app's grouping, locale-independent for the guard. */
export function fmtCount(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** A count with its noun, singular at exactly one. `noun` is the singular form;
 *  `plural` defaults to noun + "s". Invariant nouns pass the same word twice. */
export function counted(n: number, noun: string, plural: string = `${noun}s`): string {
  return `${fmtCount(n)} ${n === 1 ? noun : plural}`
}

// ── Header ───────────────────────────────────────────────────────────────────

export const TAB_TITLE = 'Targets'
export const TAB_DESCRIPTION =
  "One county's species as your target list: lifers, media you still lack, and species you have never recorded breeding. "
  + "Ranked by eBird's historical probability from the county's bar chart, or by what eBird is reporting right now."

// ── Setup / load ─────────────────────────────────────────────────────────────

export const SETUP_TITLE = 'eBird Backup Required'
export const SETUP_BODY =
  "The Targets tab builds your target list from your stored eBird backup. You haven't saved one yet."
export const RETRY = 'Retry'
export const NO_US_COUNTIES =
  'Your eBird backup has no checklists in a US county, so there is no county to build a target list for.'

// ── County picker ────────────────────────────────────────────────────────────

export const COUNTY_LABEL = 'County'
export const COUNTY_PLACEHOLDER = 'Type a county or state'
export const COUNTY_LIST_LABEL = 'Counties in your backup'
export const COUNTY_CHEVRON_LABEL = 'Show counties'
export const COUNTY_NO_MATCH = 'No county matches this search.'
export const COUNTY_UNAVAILABLE = 'SnowRaven cannot map this county to an eBird region'
export const COUNTY_GEOMETRY_FAILED = "Couldn't load the county map data SnowRaven uses to find eBird regions."

export function checklistCount(n: number): string {
  return counted(n, 'checklist')
}

// ── Pool status (FR-12 to FR-15) ─────────────────────────────────────────────

export function poolReady(speciesCount: number, county: string): string {
  return `${counted(speciesCount, 'species', 'species')} all time in ${county}, from eBird`
}
export function poolLoading(county: string): string {
  return `Loading ${county}'s species list from eBird`
}
export const POOL_NO_KEY = "Add an eBird API key in Settings to load this county's species list"
export const POOL_OFFLINE = "Offline; this county's list has not been loaded before"
export function poolFailed(cause: string): string {
  return `Couldn't load this county's species list from eBird. ${cause}`
}
export function poolLoadingEmpty(county: string): string {
  return `Loading ${county}'s species list from eBird. The county picker and toggles keep working while it loads.`
}

// ── Target types (FR-16 to FR-25) ────────────────────────────────────────────

export const SHOW_LABEL = 'Show'
export const TYPES_GROUP_LABEL = 'Target types'
export const TYPE_LIFER = 'Lifer'
export const TYPE_MEDIA = 'Media'
export const TYPE_BREEDING = 'Breeding'
export const CHIPS_GROUP_LABEL = 'Missing media types (a species must lack every selected type)'
export const THRESHOLD_GROUP_LABEL = 'Breeding threshold'
export const THRESHOLD_ANY = 'Any code'
export const THRESHOLD_CONFIRMED = 'Confirmed'
export const MEDIA_NEEDS_EXPORT = 'Add your ML export in Settings to see media targets'
export const MEDIA_UNREADABLE = "Couldn't read your ML export"
export const TURN_ON_ONE = 'Turn on at least one target type'

export type TargetType = 'lifer' | 'media' | 'breeding'
export interface TypeCounts { lifer: number; media: number; breeding: number }

function typeParts(counts: TypeCounts, on: Readonly<Record<TargetType, boolean>>): string[] {
  const parts: string[] = []
  if (on.lifer) parts.push(counted(counts.lifer, 'lifer'))
  if (on.media) parts.push(`${fmtCount(counts.media)} media`)
  if (on.breeding) parts.push(`${fmtCount(counts.breeding)} breeding`)
  return parts
}

/** The visible summary's two halves: "27 targets" and "14 lifers · 9 media · 8 breeding". */
export function summaryVisible(total: number, counts: TypeCounts, on: Readonly<Record<TargetType, boolean>>): { head: string; parts: string } {
  return { head: counted(total, 'target'), parts: typeParts(counts, on).join(' · ') }
}

/** The announced summary: "27 targets: 14 lifers, 9 media, 8 breeding". */
export function summaryAnnounced(total: number, counts: TypeCounts, on: Readonly<Record<TargetType, boolean>>): string {
  const parts = typeParts(counts, on)
  return `${counted(total, 'target')}${parts.length ? `: ${parts.join(', ')}` : ''}`
}

function typesPhrase(on: Readonly<Record<TargetType, boolean>>): string {
  const t: string[] = []
  if (on.lifer) t.push('lifer')
  if (on.media) t.push('media')
  if (on.breeding) t.push('breeding')
  return t.join(', ')
}

/** FR-24: a pool with no targets at all for the chosen types. */
export function noTargets(on: Readonly<Record<TargetType, boolean>>, county: string, poolSize: number): string {
  return `No ${typesPhrase(on)} targets for you in ${county}, across its ${counted(poolSize, 'species', 'species')}.`
}

export type WindowKey = 'any' | 'day' | 'week' | '30'

const WINDOW_PHRASE: Record<WindowKey, string> = {
  any: '',
  day: 'in the last day',
  week: 'in the last week',
  '30': 'in the last 30 days',
}

/** The filters hid every row: names each filter that is set, and how to widen it. */
export function filteredEmpty(
  on: Readonly<Record<TargetType, boolean>>,
  county: string,
  window: WindowKey,
  distance: { miles: number; anchorName: string } | null,
): string {
  const clauses: string[] = []
  if (window !== 'any') clauses.push(WINDOW_PHRASE[window])
  if (distance) clauses.push(`within ${counted(distance.miles, 'mile')} of ${distance.anchorName}`)
  const resets: string[] = []
  if (window !== 'any') resets.push('Any time')
  if (distance) resets.push('Any distance')
  return `No ${typesPhrase(on)} target in ${county} was reported by eBird ${clauses.join(' ')}. `
    + `${resets.join(' and ')} ${resets.length === 1 ? 'shows' : 'show'} them all.`
}

// ── Controls row 3 ───────────────────────────────────────────────────────────

export const SORT_LABEL = 'Sort'
export const SORT_ARIA_LABEL = 'Sort targets'
export const WINDOW_LABEL = 'Last report'
export const WINDOW_OPTIONS: ReadonlyArray<{ key: WindowKey; label: string }> = [
  { key: 'any', label: 'Any time' },
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: '30', label: '30 days' },
]
export const DISTANCE_LABEL = 'Distance'
/** The slider's accessible name names the measuring point (design-spec 2a). */
export function distanceAriaLabel(anchorName: string | null): string {
  return `Distance from ${anchorName ?? ANCHOR_NONE_NAME} to the last report`
}
/** The six slider stops; null is "Any distance". */
export const DISTANCE_STOPS: ReadonlyArray<number | null> = [null, 1, 5, 10, 25, 50]

/** The slider's value phrase and its aria-valuetext. */
export function distancePhrase(miles: number | null): string {
  return miles === null ? 'Any distance' : `Within ${counted(miles, 'mile')}`
}

/** The unit the LAST stop label carries ("50 mi"). The slider renders it in a
 *  span of its own, so the label can drop it where the track is too narrow to
 *  hold it beside "25" (globals.css, `.sr-tg-range-unit`). */
export const DISTANCE_STOP_UNIT = 'mi'

/** The short label under each stop; the last carries the unit. */
export function distanceStopLabel(miles: number | null, last: boolean): string {
  if (miles === null) return 'Any'
  return last ? `${miles} ${DISTANCE_STOP_UNIT}` : String(miles)
}

// ── Where distances are measured from (FR-51a, design-spec 2a) ───────────────

/** What the distances are measured from: the saved Default Location, the
 *  device, a place the user searched for, or a place from the live data. */
export type AnchorKind = 'default' | 'device' | 'search' | 'place'

export const ANCHOR_DEFAULT_NAME = 'your Default Location'
export const ANCHOR_DEVICE_NAME = 'your location'
/** What the slider's name says when nothing is set. */
export const ANCHOR_NONE_NAME = 'the measuring point'

/** The anchor's name as the copy uses it: "your Default Location", "your
 *  location", or the place's own name. Null when nothing is set. */
export function anchorName(kind: AnchorKind | null, place: string | null): string | null {
  if (kind === 'default') return ANCHOR_DEFAULT_NAME
  if (kind === 'device') return ANCHOR_DEVICE_NAME
  if (kind === 'search' || kind === 'place') return place
  return null
}

/**
 * The status line around its trigger: `strong` (bold, the no-anchor lead),
 * `lead`, the `trigger` text (the Button), and `tail`. Read left to right they
 * are the whole sentence, which `anchorStatusText` returns for the slider's
 * description. The Default Location carries coordinates and no place name, so
 * its line cannot say which town it is (a deliberate difference from the
 * mockup's "(Oakland)", recorded in decisions.md).
 */
export function anchorStatus(kind: AnchorKind | null, place: string | null): { strong: string | null; lead: string; trigger: string; tail: string } {
  switch (kind) {
    case 'default': return { strong: null, lead: 'Distances from your ', trigger: 'Default Location', tail: '.' }
    case 'device': return { strong: null, lead: 'Distances from ', trigger: ANCHOR_DEVICE_NAME, tail: ', found just now.' }
    case 'search': return { strong: null, lead: 'Distances from ', trigger: place ?? '', tail: ', a place you searched.' }
    case 'place': return { strong: null, lead: 'Distances from ', trigger: place ?? '', tail: ', a place in this list.' }
    default: return {
      strong: 'No location set.',
      lead: ' ',
      trigger: 'Choose where to measure from',
      tail: ' (a place, your location, or a Default Location set in Settings).',
    }
  }
}
export function anchorStatusText(kind: AnchorKind | null, place: string | null): string {
  const s = anchorStatus(kind, place)
  return `${s.strong ?? ''}${s.lead}${s.trigger}${s.tail}`
}
/**
 * The trigger's accessible name. It always CONTAINS the visible trigger text
 * (WCAG 2.5.3 Label in Name, so a voice-control user can say what is on
 * screen): with an anchor the name wraps the visible name; with none it IS the
 * visible call to action. design-spec 2a named that one "Choose where distances
 * are measured from", which does not contain the visible "Choose where to
 * measure from" (recorded in decisions.md).
 */
export function anchorTriggerLabel(kind: AnchorKind | null, place: string | null): string {
  const name = anchorName(kind, place)
  return name === null ? anchorStatus(null, null).trigger : `Distances are measured from ${name}. Change`
}

// The chooser dialog.
export const CHOOSER_TITLE = 'Measure distances from'
export const CHOOSER_MY_LOCATION = 'My location'
export const CHOOSER_MY_LOCATION_SUB = 'Finds where you are now'
export const LOCATING = 'Finding your location'
export const CHOOSER_DEFAULT = 'Default Location'
export const CHOOSER_DEFAULT_SUB = 'Set in Settings'
export const CHOOSER_DEFAULT_NONE = 'Not set in Settings'
export const CHOOSER_PLACE_SECTION = 'A place'
export const CHOOSER_SEARCH_HINT = 'A town, park or address, looked up on OpenStreetMap when you press Search.'
export const CHOOSER_SEARCH_FAILED = 'Location search failed. Try again.'
export const CHOOSER_LIST_SECTION = 'Places in this list'
export const CHOOSER_LIST_EMPTY = 'No reports in the last 30 days yet'

export const STATUS_NEEDS_LIVE_KEY = 'Last report and distance need live eBird data. Add an eBird API key in Settings.'
export const STATUS_NEEDS_LIVE_OFFLINE = 'Last report and distance need live eBird data, which has not been loaded on this device yet.'
export const WINDOW_NEEDS_LIVE = 'Needs live eBird data'

// ── Sorts (FR-48 to FR-52) ───────────────────────────────────────────────────

export const SORT_NAME_MONTH = 'eBird frequency, this month (%)'
export const SORT_NAME_YEAR = 'eBird frequency, year-round (%)'
export const SORT_NAME_LIVE = 'Live: days reported, last 30'
export const SORT_NAME_DISTANCE = 'Distance to last report'
export const SORT_NAME_ALPHA = 'Alphabetical'
export const SORT_NAME_TAXONOMIC = 'Taxonomic'

export function sortNeedsFile(county: string): string {
  return `needs ${county}'s bar-chart file`
}
export const SORT_NEEDS_KEY = 'needs an eBird API key'
export const SORT_NO_LIVE_DATA = 'no live data yet'
export const SORT_NEEDS_LOCATION = 'choose where to measure from'
export const SORT_MONTH_NOT_IN_RANGE = "this month is outside the file's range"
export function sortNeedsFullYear(months: string): string {
  return `needs a full-year file (this one covers ${months})`
}

// ── Probability: the eBird bar-chart file (FR-26 to FR-40) ───────────────────

export const FILE_SECTION_LABEL = 'eBird bar chart'
export const ADD_FILE = 'Add file'
export const REPLACE_FILE = 'Replace'
export const REMOVE_FILE = 'Remove'
export const FILE_STATUS_UNKNOWN = "Couldn't check for a bar-chart file"
export const FILE_UNREADABLE = "Couldn't read this county's bar-chart file. Replace it, or remove it and add it again."
export const POOL_NOT_LOADED = 'Species list not loaded yet'
export const SHOW_UNMATCHED = 'Show unmatched'
export const HIDE_UNMATCHED = 'Hide unmatched'
export const REMOVE_FAILED = "Couldn't remove the file. Please try again."
export const OPENS_NEW_TAB = ' (opens in a new tab)'

export function addFileTitle(county: string): string {
  return `Add ${county}'s eBird bar-chart file to sort by eBird frequency`
}
export const ADD_FILE_DETAIL_LEAD = "On ebird.org, open the county's bar chart while signed in and choose "
export const ADD_FILE_DETAIL_ACTION = 'Download Histogram Data'
// icloud-bar-chart-sync (item 8): the retired "stays on this device and is
// not synced" sentence was false on a Mac, iPhone or iPad with sync on, so the
// tail is now the sentence's own full stop, and ADD_FILE_SYNC_NOTE (item 9)
// says the one thing that changed, only where it is true.
export const ADD_FILE_DETAIL_TAIL = '.'
/** Shown after the add instruction only while the section has a sync view (item 9). */
export const ADD_FILE_SYNC_NOTE = 'With iCloud Sync on, a file you add here reaches your other synced devices too.'
/** The section's title when the county's file is in iCloud but not on this device (item 10). */
export function inICloudTitle(county: string): string {
  return `A bar-chart file for ${county} is in iCloud`
}
export function openBarChartLink(county: string): string {
  return `Open ${county}'s bar chart on ebird.org`
}

/** "1900-2026" or null. ASCII hyphen, never an en or em dash. */
export function yearsLabel(years: readonly [number, number] | null): string | null {
  return years ? `${years[0]}-${years[1]}` : null
}

/** FR-30: "eBird bar chart, Alameda, CA, 1900-2026, Jan-Dec". */
export function fileTitle(county: string, years: readonly [number, number] | null, months: string): string {
  const y = yearsLabel(years)
  return `eBird bar chart, ${county}${y ? `, ${y}` : ''}, ${months}`
}

/** FR-35: "389 species matched, 41 forms skipped, 3 unmatched". */
export function joinDetail(matched: number, skipped: number, unmatched: number): string {
  return `${counted(matched, 'species', 'species')} matched, ${counted(skipped, 'form')} skipped, ${fmtCount(unmatched)} unmatched`
}

export function unmatchedIntro(county: string): string {
  return `Species-shaped rows in the file that matched nothing in ${county}'s eBird species list, usually a name eBird has since changed:`
}

/** The PROBABILITY group source line: "eBird bar chart, Alameda, CA, 1900-2026". */
export function probabilitySource(county: string, years: readonly [number, number] | null): string {
  const y = yearsLabel(years)
  return `eBird bar chart, ${county}${y ? `, ${y}` : ''}`
}
/** The phone tier's per-row kind tag: "eBird bar chart, 1900-2026". */
export function probabilityTagSource(years: readonly [number, number] | null): string {
  const y = yearsLabel(years)
  return `eBird bar chart${y ? `, ${y}` : ''}`
}
export const PROB_TAG_NO_FILE = 'no bar-chart file'
export function probabilityNoFileSource(county: string): string {
  return `No bar-chart file for ${county}`
}

/** FR-36: the source a probability figure names, "eBird, Alameda, CA, 1900-2026, September". */
export function probabilityLabel(county: string, years: readonly [number, number] | null, which: string): string {
  const y = yearsLabel(years)
  return `eBird, ${county}${y ? `, ${y}` : ''}, ${which}`
}

export const MONTH_NAMES: readonly string[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const YEAR_ROUND = 'year-round'

export const PROBABILITY_KIND = 'Probability'
export const COL_THIS_MONTH = 'This month'
export const COL_YEAR_ROUND = 'Year-round'
export const COL_FREQUENCY = 'eBird frequency'
export const PCT_UNIT = '(%)'
export const NO_EBIRD_FIGURE = 'No eBird figure'
export const NOT_IN_FILE_RANGE = 'Not in file range'
export function needsFullYear(months: string): string {
  return `Needs a full-year file (this one covers ${months})`
}
export function noFileCell(county: string): string {
  return `No file for ${county}`
}
export const SORT_UNAVAILABLE_NO_FILE = 'Sort unavailable without a file'
/**
 * "2.14%": two decimals and the sign, always (FR-31, FR-32). A NONZERO figure
 * that would round to "0.00%" reads "<0.01%" instead, so a species eBird has
 * recorded is never shown as though it had never been (ui.md, the v0.5.79
 * nonzero-share rule, at this figure's precision).
 */
export function percentText(v: number): string {
  const p = percentParts(v)
  return `${p.num}${p.sign}`
}
/** The figure and its sign apart, so the sign can be drawn muted (design-spec 4). */
export function percentParts(v: number): { num: string; sign: string } {
  return { num: v > 0 && v < 0.005 ? '<0.01' : v.toFixed(2), sign: '%' }
}
export const LIVE_NO_DATA_CELL = 'No live data yet'
export const FILE_UNREADABLE_CELL = "Couldn't read the bar-chart file"
export const LAST_TODAY = 'Today'
export const LAST_YESTERDAY = 'Yesterday'

// ── Live: the eBird API 30-day sweep (FR-41 to FR-47) ────────────────────────

export const LIVE_KIND = 'Live'
export const LIVE_SOURCE = 'eBird API, last 30 days'
export const LIVE_SOURCE_NO_KEY = 'eBird API, needs a key'
export function liveSourceCached(date: string): string {
  return `eBird API, cached ${date}`
}
export const COL_REPORTED = 'Reported, last 30 days'
export const COL_LAST_REPORT = 'Last report'
export const COL_DISTANCE = 'Distance'
export const COL_SPECIES = 'Species'
export const SORT_BUTTON_ALPHA = 'A to Z'
export const SORT_BUTTON_TAXONOMIC = 'Taxonomic'

export const NEEDS_KEY_CELL = 'Needs an eBird API key'
export const NOT_REPORTED = 'Not reported in the last 30 days'
export const NO_REPORT_30 = 'No report in the last 30 days'
export const NONE_IN_CHECKED = 'None in the days checked'
export const NO_DISTANCE = 'No distance'
export const NO_LOCATION = 'No location set'
export const REPORTED_LEAD = 'Reported'

/** FR-42: the live figure, a count with its window. Never a percent. */
export function reportedFull(n: number): { lead: string; count: string; tail: string; text: string } {
  const tail = ' of the last 30 days'
  return { lead: `${REPORTED_LEAD} `, count: fmtCount(n), tail, text: `${REPORTED_LEAD} ${fmtCount(n)}${tail}` }
}

/** FR-42 during a sweep: "Reported 5 of 9 days checked so far". */
export function reportedPartial(n: number, checked: number): { lead: string; count: string; tail: string; text: string } {
  const tail = ` of ${counted(checked, 'day')} checked so far`
  return { lead: `${REPORTED_LEAD} `, count: fmtCount(n), tail, text: `${REPORTED_LEAD} ${fmtCount(n)}${tail}` }
}

/** "5.6 mi". */
export function milesText(d: number): { value: string; unit: string } {
  return { value: d.toFixed(1), unit: 'mi' }
}

export const SWEEP_TOTAL_DAYS = 30

export function sweepComplete(time: string, total: number): string {
  // Tomorrow's cost, stated exactly: the new day, and today again, because an
  // answer taken while its day is still running is stored as not final
  // (`complete` in countyDayObsCache.ts; useCountyDaySweep.test.ts measures 2).
  // Security review L3: this line used to say "tomorrow costs one call".
  return `Checked today at ${time}, ${fmtCount(total)} of ${counted(total, 'day')}. Tomorrow asks eBird about two days: the new one and today again.`
}
export function sweepRunning(checked: number, total: number): { lead: string; strong: string; tail: string } {
  return { lead: 'Checking eBird: ', strong: `${fmtCount(checked)} of ${counted(total, 'day')}`, tail: '. Rows fill in as each day lands.' }
}
export function sweepCooldown(seconds: number, checked: number, total: number): { warn: string; rest: string; strong: string; tail: string } {
  return {
    warn: 'eBird asked us to slow down;',
    rest: ` resuming in ${seconds} s. `,
    strong: `${fmtCount(checked)} of ${counted(total, 'day')}`,
    tail: ' checked.',
  }
}
export function sweepNoKey(county: string): { strong: string; tail: string } {
  return {
    strong: 'Needs an eBird API key.',
    tail: ` Add one in Settings to see how many of the last 30 days each species was reported in ${county}.`,
  }
}
export function sweepOffline(date: string): { strong: string; tail: string } {
  return { strong: 'Offline;', tail: ` live counts from ${date}. Nothing has been asked of eBird this visit.` }
}
export const SWEEP_OFFLINE_EMPTY = 'Offline; no live data yet'
export function sweepUnanswered(checked: number, total: number, failed: number): string {
  return `${fmtCount(checked)} of ${counted(total, 'day')} checked; ${counted(failed, 'day')} could not be checked`
}
export function sweepPaused(checked: number, total: number): string {
  return `eBird kept asking us to slow down, so checking stopped for now. ${fmtCount(checked)} of ${counted(total, 'day')} checked.`
}
export const SWEEP_RESUME = 'Resume'
export const SWEEP_IDLE = 'Waiting to check eBird.'

// ── Rows ─────────────────────────────────────────────────────────────────────

export const BADGE_LIFER = 'Lifer'
export const BADGE_MEDIA = 'Media'
export const BADGE_BREEDING = 'Breeding'

/** The sr-only tail on a Media badge: ", needs photo, video". */
export function mediaNeedsTail(missing: readonly string[]): string {
  return `, needs ${missing.map(t => t.toLowerCase()).join(', ')}`
}
/** The sr-only tail on a Breeding badge under the Confirmed threshold. */
export function breedingHasTail(codes: readonly string[]): string {
  return `, has ${codes.join(' ')} but nothing confirmed`
}

export const TABLE_LABEL = 'Target list'
export const CONTROLS_LABEL = 'Targets controls'
