// Pure classification for the Hotspots view's opt-in color modes
// (color-coded-hotspots): mode/window types, the per-locId personal stats
// (modes 1/2), the 5-class ramp, the per-pin reading every surface renders
// from (pin fill, popup, in-view list, legend — one source, so the legend
// cannot drift from the map, NFR-10), and the mode copy builders.
//
// No React, no map, no clock, no I/O — and NO transport / lib/tauri/*Service
// import, ever: modes 1/2 are offline computations (FR-07/QA-06) and this
// module sits on their passive graph. Every `nowMs`/time is a parameter.

import type { ObservationEntry } from '../types'
import type { HotspotPin } from './mapExplorerTypes'
import { computeCountyTiers, type CountyTiers } from './countyShading'
import { isNonCountableForm, normalizeSpeciesName } from './speciesUtils'
import type { HotspotModeSpriteKey } from './mapPins'

/** Label-agnostic semantic values (the repo's toggle-state rule — a relabel
 *  touches only the option copy, never these). */
export type HotspotColorMode = 'default' | 'mySpecies' | 'myChecklists' | 'activity'

/** Window in days — numbers, so no label can leak into state. */
export type ActivityWindow = 7 | 30

/** OQ-2 default, kept: teardrop pins are far smaller than county polygons, so
 *  5 farther-apart classes beat the county overlay's 10. */
export const HOTSPOT_CLASS_COUNT = 5

/** FR-19 / OQ-3 default, kept. Lives here (not in the controller hook) so the
 *  cap sentence's copy builder stays transport-free; the hook re-exports it. */
export const ACTIVITY_FETCH_CAP = 200

/** NFR-05: the county pool-of-4 precedent. */
export const ACTIVITY_FETCH_CONCURRENCY = 4

/** The four selector options (FR-01). Meanings fixed by the PRD; labels are
 *  the Designer's approved copy. */
export const HOTSPOT_MODE_OPTIONS: { value: HotspotColorMode; label: string }[] = [
  { value: 'default', label: 'Visited status' },
  { value: 'mySpecies', label: 'My species' },
  { value: 'myChecklists', label: 'My checklists' },
  { value: 'activity', label: 'Recent activity' },
]

/** The two windows (FR-10) — the shared Time Range vocabulary; no "Day" rung. */
export const ACTIVITY_WINDOW_OPTIONS: { value: ActivityWindow; label: string }[] = [
  { value: 7, label: 'Week' },
  { value: 30, label: '30 days' },
]

/** The window word as it appears inside sentences (lowercase, per the copy). */
export function activityWindowWord(window: ActivityWindow): string {
  return window === 7 ? 'week' : '30 days'
}

// ── Personal per-locId stats (FR-05 / FR-06) ──────────────────────────────────

export interface HotspotPersonalStats {
  /** Distinct COUNTABLE species (isNonCountableForm on the RAW name, then
   *  normalizeSpeciesName folds subspecies to species — the county Species
   *  metric's rule). Escapee provenance deliberately NOT applied (FR-05 /
   *  OQ-5: this surface does not headline a life-list count, and this module
   *  must stay passive-graph clean). */
  species: number
  /** Distinct checklists (submission ids) — all checklist types (FR-06). */
  checklists: number
}

/**
 * One O(n) pass over the parsed observations building BOTH values per
 * locationId. Deliberately NOT the shipped `obsLocationsByLocId.species` set —
 * that one is raw-name with no countable rule (spuhs and forms inflate it),
 * which is right for the shipped popup line it feeds but fails FR-05/QA-04.
 * The two numbers legitimately differ on the same popup; both render, labeled.
 */
export function buildHotspotPersonalStats(
  observations: ObservationEntry[],
): Map<string, HotspotPersonalStats> {
  interface Work { species: Set<string>; checklists: Set<string> }
  const work = new Map<string, Work>()
  for (const o of observations) {
    let w = work.get(o.locationId)
    if (!w) { w = { species: new Set(), checklists: new Set() }; work.set(o.locationId, w) }
    w.checklists.add(o.submissionId)
    if (!isNonCountableForm(o.commonName)) w.species.add(normalizeSpeciesName(o.commonName))
  }
  const out = new Map<string, HotspotPersonalStats>()
  for (const [locId, w] of work) {
    out.set(locId, { species: w.species.size, checklists: w.checklists.size })
  }
  return out
}

// ── The ramp (FR-20) ──────────────────────────────────────────────────────────

/** Quantile tiers over the CURRENT result set's nonzero active-mode values —
 *  computeCountyTiers with maxClasses 5 (the Calendar precedent). Fewer
 *  distinct values → fewer classes; zero values → empty legend, tierFor 0. */
export function computeHotspotTiers(nonZeroValues: number[]): CountyTiers {
  return computeCountyTiers(nonZeroValues, HOTSPOT_CLASS_COUNT)
}

// ── The per-pin reading (FR-08 / FR-12 / FR-13 / FR-21) ───────────────────────

export interface ActivityAnswer {
  count7: number
  count30: number
  fetchedAt: number
  fromCache: boolean
}

/** The answer every surface renders from. The type makes the honest-non-value
 *  distinctions unrepresentable rather than remembered: `zero`/`noData` are
 *  different variants (FR-08), `quiet` requires an ANSWER while `unanswered`
 *  is the absence of one (FR-13), and none of them can carry a ramp tier. */
export type HotspotReading =
  | { state: 'ramp'; tier: number; value: number; window?: ActivityWindow; fromCache?: boolean; fetchedAt?: number }
  | { state: 'zero'; value: 0 }
  | { state: 'noData' }
  | { state: 'quiet'; window: ActivityWindow; fromCache?: boolean; fetchedAt?: number }
  | { state: 'unanswered' }
  | { state: 'personal' }
  | { state: 'default' }

export function hotspotReading(
  pin: HotspotPin,
  mode: HotspotColorMode,
  window: ActivityWindow,
  tiers: CountyTiers,
  personal: Map<string, HotspotPersonalStats> | null,
  activityFor: (locId: string) => ActivityAnswer | null,
): HotspotReading {
  // Personal pins never join a ramp, never enter tier computation, and are
  // never fetched (FR-21) — resolved before the mode is even consulted.
  if (pin.kind === 'personal') return { state: 'personal' }
  if (mode === 'default') return { state: 'default' }

  if (mode === 'mySpecies' || mode === 'myChecklists') {
    const stats = personal?.get(pin.locId) ?? null
    if (!stats) return { state: 'noData' }
    const value = mode === 'mySpecies' ? stats.species : stats.checklists
    if (value === 0) return { state: 'zero', value: 0 }
    return { state: 'ramp', tier: tiers.tierFor(value), value }
  }

  // mode === 'activity'
  const answer = activityFor(pin.locId)
  if (!answer) return { state: 'unanswered' }
  const value = window === 7 ? answer.count7 : answer.count30
  const provenance = { window, fromCache: answer.fromCache, fetchedAt: answer.fetchedAt }
  if (value === 0) return { state: 'quiet', ...provenance }
  return { state: 'ramp', tier: tiers.tierFor(value), value, ...provenance }
}

/** The sprite key a reading paints as (the layer's `cls` property). The kind
 *  carries FR-22's non-color channel; nodata/zero need no kind suffix (each is
 *  a single kind by construction). */
export function readingSpriteKey(
  reading: HotspotReading,
  kind: HotspotPin['kind'],
): HotspotModeSpriteKey | 'personal' {
  if (reading.state === 'personal' || kind === 'personal') return 'personal'
  const k = kind === 'visited' ? 'visited' : 'unvisited'
  switch (reading.state) {
    case 'ramp': {
      const tier = Math.min(Math.max(reading.tier, 1), HOTSPOT_CLASS_COUNT)
      return `t${tier}-${k}` as HotspotModeSpriteKey
    }
    case 'zero': return 'zero'
    case 'noData': return 'nodata'
    case 'quiet': return `quiet-${k}` as HotspotModeSpriteKey
    case 'unanswered': return `unanswered-${k}` as HotspotModeSpriteKey
    // 'default' never reaches a cls map (the layer takes its shipped path);
    // neutral fallback so a defect renders as "not checked", never a value.
    default: return `unanswered-${k}` as HotspotModeSpriteKey
  }
}

// ── The legend model (FR-24, NFR-10) ──────────────────────────────────────────

export const HOTSPOT_STATE_LABELS = {
  noData: 'Not birded by you',
  zero: 'Visited, 0 countable species',
  quiet: 'Quiet, no reports in this window',
  unanswered: 'Not checked yet',
} as const

export type HotspotLegendStateKey = keyof typeof HOTSPOT_STATE_LABELS

export interface HotspotLegendModel {
  /** The bolded mode name. */
  title: string
  /** The middle-dot suffix. */
  subtitle: string
  /** One row per RENDERED ramp class — THE SAME tiers.legend object the layer
   *  paints from (one source, not a test-time reconciliation). */
  classes: { tier: number; min: number; max: number }[]
  /** Only the off-ramp states in effect, each with its meaning in words. */
  states: { key: HotspotLegendStateKey; label: string }[]
}

export function hotspotLegendModel(
  mode: Exclude<HotspotColorMode, 'default'>,
  window: ActivityWindow,
  tiers: CountyTiers,
  statesInEffect: { noData: boolean; zero: boolean; quiet: boolean; unanswered: boolean },
): HotspotLegendModel {
  const title = mode === 'mySpecies' ? 'My species'
    : mode === 'myChecklists' ? 'My checklists'
    : 'Recent activity'
  const subtitle = mode === 'mySpecies' ? 'your countable species per hotspot, this search'
    : mode === 'myChecklists' ? 'your checklists per hotspot, this search'
    : `species in the last ${activityWindowWord(window)}`
  const states: HotspotLegendModel['states'] = []
  if (mode === 'mySpecies' || mode === 'myChecklists') {
    // nodata is always in effect for the personal modes (design-spec).
    states.push({ key: 'noData', label: HOTSPOT_STATE_LABELS.noData })
    if (statesInEffect.zero) states.push({ key: 'zero', label: HOTSPOT_STATE_LABELS.zero })
  } else {
    if (statesInEffect.quiet) states.push({ key: 'quiet', label: HOTSPOT_STATE_LABELS.quiet })
    if (statesInEffect.unanswered) states.push({ key: 'unanswered', label: HOTSPOT_STATE_LABELS.unanswered })
  }
  return { title, subtitle, classes: tiers.legend, states }
}

// ── The popup mode line (FR-25) ───────────────────────────────────────────────

/** FR-22 / QA-23: the visited-state sentence for an UNVISITED pin's popup
 *  while a color mode is active. Modes 1/2's noData reading already states it
 *  in its primary ("You have not birded this hotspot"); every other reading
 *  an unvisited pin can carry (mode 3's ramp / quiet / unanswered) needs this
 *  line, because the shipped visited-only popup lines ("{n} species recorded /
 *  Last visit") are absent exactly there. The matrix test pins the whole
 *  mode × reading grid so the gap cannot reopen on one branch. */
export const HOTSPOT_UNVISITED_POPUP_LINE = 'You have not visited this hotspot'

export interface HotspotPopupModeLine {
  /** What the 10px swatch shows: the class fill on ramp; the pale hollow
   *  center for zero AND quiet (what the eye matches); nodata / unanswered
   *  their own fills. */
  swatch: 'ramp' | 'pale' | 'nodata' | 'unanswered'
  tier?: number
  primary: string
  secondary?: string
  cachedLine?: string
  /** The visited/unvisited distinction IN WORDS (FR-22 / QA-23), set for
   *  unvisited pins whenever `primary` does not already state it (noData's
   *  does). Rendered muted, as the mode block's closing line. */
  visitedLine?: string
}

export function hotspotPopupModeLine(
  reading: HotspotReading,
  mode: HotspotColorMode,
  formatTime: (ms: number) => string,
  kind: HotspotPin['kind'],
): HotspotPopupModeLine | null {
  if (reading.state === 'personal' || reading.state === 'default') return null
  const r = reading
  const line = ((): HotspotPopupModeLine => {
    switch (r.state) {
      case 'ramp': {
        const primary = mode === 'mySpecies' ? `My species: ${r.value}`
          : mode === 'myChecklists' ? `My checklists: ${r.value}`
          : `${r.value} species reported in the last ${activityWindowWord(r.window ?? 7)}`
        return {
          swatch: 'ramp',
          tier: r.tier,
          primary,
          ...(r.fromCache && r.fetchedAt !== undefined
            ? { cachedLine: `From cache, fetched ${formatTime(r.fetchedAt)}.` }
            : {}),
        }
      }
      case 'zero':
        return {
          swatch: 'pale',
          primary: mode === 'myChecklists' ? 'My checklists: 0' : 'My species: 0',
          secondary: 'Only spuh and slash entries so far.',
        }
      case 'noData':
        return { swatch: 'nodata', primary: 'You have not birded this hotspot' }
      case 'quiet':
        return {
          swatch: 'pale',
          primary: `No species reported in the last ${activityWindowWord(r.window)}`,
          secondary: 'Quiet right now. An answer, not a gap.',
          ...(r.fromCache && r.fetchedAt !== undefined
            ? { cachedLine: `From cache, fetched ${formatTime(r.fetchedAt)}.` }
            : {}),
        }
      case 'unanswered':
        return { swatch: 'unanswered', primary: 'Activity not checked yet' }
    }
  })()
  // FR-22 / QA-23: every popup states its visited state while a mode is
  // active. A visited pin gets it from the retained shipped lines (FR-25); an
  // unvisited pin's mode line carries it here, in one place, except noData
  // whose primary already says it. (The approved mock omits this line; it is
  // the Tester's QA-23 addition.)
  if (kind === 'unvisited' && r.state !== 'noData') {
    return { ...line, visitedLine: HOTSPOT_UNVISITED_POPUP_LINE }
  }
  return line
}

// ── The in-view list value column (FR-26) ─────────────────────────────────────

export function hotspotListValue(reading: HotspotReading): { text: string; muted: boolean } | null {
  switch (reading.state) {
    case 'ramp': return { text: String(reading.value), muted: false }
    case 'zero':
    case 'quiet': return { text: '0', muted: true }
    case 'noData': return { text: 'not birded', muted: true }
    case 'unanswered': return { text: '…', muted: true }
    default: return null
  }
}

// ── Mode-3 status copy (FR-12 / FR-14 / FR-19 — design-spec Content Notes) ────

export interface ActivityStatusFields {
  phase: 'idle' | 'running' | 'done'
  /** In-pass locIds with an answer. */
  answered: number
  /** Public pins this pass will answer (cache hits + capped fetch queue). */
  target: number
  /** Public pins left unanswered by the FR-19 cap (0 = not capped). */
  cappedCount: number
  /** Answers served without running the loader this pass. */
  cacheServed: number
  /** Answers that ran a live eBird call this pass. */
  liveFetched: number
  /** Enqueued locIds whose fetch failed this pass. */
  failedCount: number
  /** Newest fetchedAt among cache-served answers (the "fetched {time}" cue). */
  latestCachedAt: number | null
  /** Newest fetchedAt among ALL answers this pass. */
  latestAnswerAt: number | null
  /** True while the pass is inside an eBird-requested cooldown (a 429 was
   *  received and request starts are paused until the backoff elapses; cleared
   *  by the first answer that arrives after the cooldown ends). The running
   *  sentence appends the slowdown line while set, so the pause is visible and
   *  never a silent stall. */
  rateLimited: boolean
  error: { kind: 'offline' | 'no-key' | 'error'; message: string } | null
}

/** The honest slowdown sentence (pre-deploy pacing revision): appended to the
 *  running line while an eBird 429 cooldown is in effect. Plain words, no
 *  jargon, consistent with the distinct-states voice. */
export const ACTIVITY_SLOWDOWN_SENTENCE =
  'eBird asked us to slow down, so this is taking a little longer.'

/** The one status sentence (the always-rendered live region reads the same
 *  string the visible line shows — one source of truth; the hook throttles the
 *  EMISSION, so this stays a pure derivation). */
export function activityStatusSentence(
  s: ActivityStatusFields,
  windowFlipped: boolean,
  formatTime: (ms: number) => string,
): string {
  if (s.phase === 'running') {
    const base = `Checking activity: ${s.answered} of ${s.target} hotspots`
    return s.rateLimited ? `${base}. ${ACTIVITY_SLOWDOWN_SENTENCE}` : base
  }
  if (s.phase !== 'done' || s.error) return ''
  if (windowFlipped && s.liveFetched > 0) {
    return 'Window switched. Zero new requests, one cached call answers both.'
  }
  if (s.liveFetched === 0 && s.cacheServed > 0 && s.latestCachedAt !== null) {
    const base = `Activity from cache, fetched ${formatTime(s.latestCachedAt)}.`
    return windowFlipped ? `${base} Window switches never refetch.` : base
  }
  if (s.target > 0) return `All ${s.target} hotspots checked just now.`
  return ''
}

/** The FR-19 cap sentences, in words, when the cap bit. */
export function activityCapLines(s: ActivityStatusFields): string[] {
  if (s.cappedCount === 0) return []
  return [
    `Checked ${ACTIVITY_FETCH_CAP} hotspots: on your screen first, then nearest your search center.`,
    `${s.cappedCount} more stay in the not-checked gray. Search a smaller area to cover them. Cached hotspots never count against the ${ACTIVITY_FETCH_CAP}.`,
  ]
}

/** The supporting lines under a classified failure (FR-14). The warn box
 *  itself carries the shared classified message; these add the honest
 *  coverage/next-step reading. */
export function activityErrorLines(
  s: ActivityStatusFields,
  formatTime: (ms: number) => string,
): string[] {
  if (!s.error) return []
  const unanswered = Math.max(0, s.target - s.answered)
  if (s.error.kind === 'offline') {
    const lines: string[] = []
    if (s.answered > 0 && s.latestAnswerAt !== null) {
      lines.push(`Showing cached activity for ${s.answered} hotspots, fetched ${formatTime(s.latestAnswerAt)}. ${unanswered} more stay in the not-checked gray until you're back online.`)
    }
    lines.push('My species and My checklists still work fully offline.')
    return lines
  }
  if (s.error.kind === 'no-key') {
    return ['Recent activity needs your own eBird key. Pins stay in the not-checked gray until one is added.']
  }
  return [`${s.answered} hotspots kept the answers that already arrived. Retry re-asks only the ${unanswered} that failed.`]
}
