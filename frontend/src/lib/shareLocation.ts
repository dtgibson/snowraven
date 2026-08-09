// Pin Share — the whole clipboard payload AND every string that describes it, as
// pure functions of a coordinate and a selection. No map import, no DOM, no
// clipboard, NO NETWORK (FR-24 / NFR-02): the links are string concatenation over
// numbers already on the device, which is what keeps PRIVACY_POLICY.md unchanged
// and the feature usable offline.
//
// One table (SHARE_PARTS) is the single source for all four: the payload lines,
// the switch labels and their accessible names, the popup button, and the
// manifest sentence. Adding a destination is ONE ROW and no new copy, which is
// asserted rather than hoped for in shareLocation.test.ts.
//
// This module MUST stay map-free. Settings.tsx is statically imported by App.tsx
// and imports lib/shareCopyPreference.ts, which re-exports the selection type from
// here — so a map import (even an `import type` a later refactor promotes to a
// value import) would drag the ~1 MB maplibre vendor chunk onto first paint.
// lib/entryChunk.test.ts is the guard.

/** Decimal places for a shared coordinate (FR-19). Five is about one metre and
 *  matches what eBird displays; both Google Maps and Apple Maps accept it pasted
 *  straight into their search boxes, which is what makes a coordinates-only
 *  selection genuinely useful rather than a degraded fallback. */
const PLACES = 5

/** Google Maps coordinate URL (FR-23, ratified in D-04 — do not revisit).
 *  Verified live during the build: this form 302s to
 *  https://maps.google.com/maps?q=<lat>,<lng>, the canonical coordinate query. */
const GOOGLE_MAPS_BASE = 'https://maps.google.com/?q='

/** Apple Maps coordinate URL (FR-23 / OQ-01, ratified in D-04 — do not revisit).
 *  Verified live during the build (macOS and iOS user agents both): this form
 *  301s to /place?coordinate=<lat>%2C<lng>, i.e. Apple's own server recognises
 *  the value as a COORDINATE and routes it to a pinned place. A control request
 *  with a non-coordinate q (`?q=Putah+Creek`) 301s to /search?query=… instead,
 *  which is what proves the coordinate branch is real rather than a coincidence.
 *  The PRD's `?ll=<lat>,<lng>&q=<lat>,<lng>` fallback produces the IDENTICAL
 *  redirect, so it buys nothing and costs 20 characters. Shipping the short form. */
const APPLE_MAPS_BASE = 'https://maps.apple.com/?q='

/**
 * Wrap a longitude into [-180, 180] (FR-20). MapLibre reports UNWRAPPED
 * longitudes after repeated antimeridian panning (e.g. 190, -400), and an
 * unwrapped value produces a maps link that resolves to the wrong place.
 *
 * Note the accepted edge, asserted in the tests so it is a decision on the
 * record rather than a surprise: exactly `180` maps to `-180`. Both name the
 * antimeridian and both resolve correctly in Google Maps and Apple Maps.
 */
export function normalizeLongitude(lng: number): number {
  if (!Number.isFinite(lng)) return lng
  return ((lng + 180) % 360 + 360) % 360 - 180
}

/** `(-0.000001).toFixed(5)` is `"-0.00000"` — a minus sign on a value that reads
 *  as zero, which FR-19 ("no decoration a reader would not expect") rules out.
 *  Plain `(-0).toFixed(5)` is already `"0.00000"`; it is the ROUNDS-to-zero case
 *  that leaks the sign. */
function stripNegativeZero(s: string): string {
  return /^-0(?:\.0+)?$/.test(s) ? s.slice(1) : s
}

/**
 * The single rounding site. `formatCoordinate` and BOTH url builders derive from
 * this, so the coordinate line and the links can never disagree about where the
 * pin is (FR-23). If the formatter normalised longitude and a url builder did
 * not, the copied coordinate and the copied link would point at different
 * places, and no test that checked them separately would catch it.
 */
function fixed5(lat: number, lng: number): { lat: string; lng: string } {
  return {
    lat: stripNegativeZero(lat.toFixed(PLACES)),
    lng: stripNegativeZero(normalizeLongitude(lng).toFixed(PLACES)),
  }
}

/** The FR-19 display/copy form: `38.54321, -121.98765`. Latitude first, five
 *  decimals each, comma plus ONE space. No degree symbol, no hemisphere letter,
 *  no leading plus, no thousands separator. */
export function formatCoordinate(lat: number, lng: number): string {
  const f = fixed5(lat, lng)
  return `${f.lat}, ${f.lng}`
}

/** The pair as it rides INSIDE a url: comma, no space (FR-23). */
function urlPair(lat: number, lng: number): string {
  const f = fixed5(lat, lng)
  return `${f.lat},${f.lng}`
}

export function googleMapsUrl(lat: number, lng: number): string {
  return GOOGLE_MAPS_BASE + urlPair(lat, lng)
}

export function appleMapsUrl(lat: number, lng: number): string {
  return APPLE_MAPS_BASE + urlPair(lat, lng)
}

// ── The parts manifest ───────────────────────────────────────────────────────

/**
 * One share-able part: one payload line, one switch, one noun in the manifest.
 *
 * `label` and `noun` are SEPARATE COLUMNS on purpose. The tempting version is one
 * string plus `.toLowerCase()`; it reads correctly on today's three and silently
 * produces "Bing maps link" on the fourth, because "lowercase unless it is a
 * proper noun" is not derivable from a string. This was caught during the design
 * pass by running the rule against a hypothetical fourth destination, not by
 * inspection, and shareLocation.test.ts keeps that fourth destination around so
 * the trap stays closed.
 */
export interface SharePart {
  /** Stable, label-agnostic key. It is the persisted field name, so renaming the
   *  visible label never touches stored data. */
  readonly key: string
  /** The visible switch text. Starts its own row, so sentence case. */
  readonly label: string
  /** The manifest form. Sits mid sentence after a colon, so lowercase unless it
   *  is a proper noun. */
  readonly noun: string
  /** Exists only so the button can say "map links" rather than naming every
   *  provider. `null` for a part that belongs to no family. */
  readonly qualifier: string | null
  /** The class this part belongs to, singular ('link'). `null` stands alone. */
  readonly family: string | null
  /** The accessible-name fragment, already carrying its own article. */
  readonly aside: string
  /** This part's payload line, built from the same rounding site as every other. */
  readonly line: (lat: number, lng: number) => string
}

/** The single source, in PAYLOAD ORDER. The order here is the order of the lines
 *  on the clipboard, of the switches in Settings, and of the nouns in the
 *  manifest sentence, so the three can never disagree. */
export const SHARE_PARTS = [
  {
    key: 'coords', label: 'Coordinates', noun: 'coordinates',
    qualifier: null, family: null, aside: 'the coordinate pair',
    line: (lat: number, lng: number) => formatCoordinate(lat, lng),
  },
  {
    key: 'google', label: 'Google Maps link', noun: 'Google Maps link',
    qualifier: 'Google Maps', family: 'link', aside: 'a Google Maps link',
    line: (lat: number, lng: number) => `Google Maps: ${googleMapsUrl(lat, lng)}`,
  },
  {
    key: 'apple', label: 'Apple Maps link', noun: 'Apple Maps link',
    qualifier: 'Apple Maps', family: 'link', aside: 'an Apple Maps link',
    line: (lat: number, lng: number) => `Apple Maps: ${appleMapsUrl(lat, lng)}`,
  },
] as const satisfies readonly SharePart[]

/** Derived from the table, so a new row widens the type with no second edit. */
export type SharePartKey = (typeof SHARE_PARTS)[number]['key']

/** What gets copied: each part independently on or off. All eight combinations
 *  are reachable, INCLUDING all three off (see SHARE_EMPTY_POPUP). */
export type ShareCopySelection = Record<SharePartKey, boolean>

/** A selection read positionally, so the generic functions below can be exercised
 *  against a table that is not SHARE_PARTS. */
type AnySelection = Readonly<Record<string, boolean>>

/** The on-parts, in payload order. The one place a selection becomes a list. */
export function selectedParts(
  selection: AnySelection,
  parts: readonly SharePart[] = SHARE_PARTS,
): readonly SharePart[] {
  return parts.filter(p => selection[p.key] === true)
}

// ── The generating rule ──────────────────────────────────────────────────────
//
// Eight hand-written button labels and eight hand-written mode lines would be
// correct on the day they were typed and would drift thereafter. Two pure
// functions over the table produce all of them, and produce the ninth, tenth and
// sixteenth for free when a destination is added.

/** Runs past today's three on purpose: a fourth destination would otherwise mix a
 *  digit into a sentence of word forms ("4 lines: ..."). Beyond the ladder it
 *  degrades to the digit, which is correct if inelegant. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']

function countWord(n: number): string {
  const w = COUNT_WORDS[n] ?? String(n)
  return w.charAt(0).toUpperCase() + w.slice(1)
}

/** The ordinary English serial list: `a` / `a and b` / `a, b, and c`. */
function listPhrase(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/**
 * Groups the on-parts by family, preserving payload order. A family with every
 * member on collapses to its CLASS NOUN ("map links"), which is the only reason
 * the all-on button label stays at 37 characters instead of the 54 an
 * enumerated serial list would need — 54 wraps to three lines inside the 224px
 * compact popup, which is why "Copy coordinates, Google Maps link, and Apple
 * Maps link" was rejected.
 *
 * The collapse is safe precisely because `modeLine` sits directly below and
 * always spells out which links they are.
 */
function phrase(on: readonly SharePart[], all: readonly SharePart[]): string {
  const groups: string[] = []
  const seen = new Set<string>()
  for (const p of on) {
    if (!p.family) { groups.push(p.noun); continue }
    if (seen.has(p.family)) continue
    seen.add(p.family)
    const members = all.filter(q => q.family === p.family)
    const onMembers = on.filter(q => q.family === p.family)
    if (onMembers.length === members.length) {
      groups.push(`map ${p.family}s`)
    } else {
      const quals = onMembers.map(q => q.qualifier ?? q.noun)
      groups.push(`${listPhrase(quals)} ${p.family}${onMembers.length > 1 ? 's' : ''}`)
    }
  }
  // A serial list of two where one member is itself a compound reads as three
  // things joined by "and"; the Oxford comma disambiguates it.
  const compound = groups.some(g => g.includes(' and '))
  if (groups.length === 2 && compound) return `${groups[0]}, and ${groups[1]}`
  return listPhrase(groups)
}

/**
 * The popup button. Says what the PRESS PRODUCES, and is allowed to collapse a
 * complete family because it is a button and length is a real constraint.
 *
 * Never called with an empty selection: n === 0 is a STRUCTURAL change (the
 * button is replaced by SHARE_EMPTY_POPUP), not a ninth string. There is
 * deliberately no `'Copy '` degenerate case to fall into.
 */
export function shareCopyLabel(
  on: readonly SharePart[],
  all: readonly SharePart[] = SHARE_PARTS,
): string {
  return `Copy ${phrase(on, all)}`
}

/**
 * The popup mode line, and the Settings manifest caption. Says what the RESULT
 * LOOKS LIKE when pasted, naming every part in full.
 *
 * Not redundant with `shareCopyLabel`: it is the one thing a short button cannot
 * carry, and it is exactly what makes the collapsed "map links" safe. Had the
 * button enumerated precisely, this would have become a restatement and should
 * have been deleted.
 */
export function shareModeLine(on: readonly SharePart[]): string {
  const n = on.length
  return `${countWord(n)}${n === 1 ? ' line: ' : ' lines: '}${on.map(p => p.noun).join(', ')}.`
}

/** A switch's accessible name. Leads with the visible string (WCAG 2.5.3 Label in
 *  Name) and then says what the switch actually does, because "Coordinates" heard
 *  alone is ambiguous. Matches the `label + '. ' + sub` formula the radio group
 *  this replaced already used. */
export function sharePartName(p: SharePart): string {
  return `${p.label}. Include ${p.aside} when copying a location.`
}

/** Settings, in place of the example. States the outcome, then hands back the
 *  thing that still works. No imperative, no warning color, no alert icon: this
 *  is a configuration the person deliberately chose. */
export const SHARE_EMPTY_SETTINGS =
  'Nothing to copy. The share pin will still show the coordinates on the map.'

/** The popup, in place of the copy control. The second sentence is an imperative
 *  because it is wayfinding, which is the one place an imperative is a service
 *  rather than a scolding. */
export const SHARE_EMPTY_POPUP =
  'Nothing is selected to copy. Choose what to copy in Settings under Sharing.'

/**
 * The clipboard payload (FR-21 / FR-22). The selected lines in FIXED payload
 * order, single newline separators, NO trailing newline — built as a
 * present-lines array and joined, so an elided middle element leaves no blank
 * line and every label stays attached to its own line ("Apple Maps: https://…"
 * alone is self-describing).
 *
 * Returns the EMPTY STRING when nothing is selected. Both callers treat that
 * structurally (no copy control at all), so no control that looks pressable can
 * ever put an empty string on the clipboard.
 *
 * Every character comes from `toFixed(5)` output over numeric input, so no
 * user-supplied or external text can reach a url string (NFR-08).
 */
export function buildSharePayload(
  lat: number,
  lng: number,
  selection: AnySelection,
  parts: readonly SharePart[] = SHARE_PARTS,
): string {
  return selectedParts(selection, parts).map(p => p.line(lat, lng)).join('\n')
}
