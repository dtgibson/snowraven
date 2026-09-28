// The Targets copy guard (targets-tab, schema.md 9.2): RULES over a GENERATED
// corpus, never a ban list (ui.md v1.0.5, testing.md v1.0.22). The corpus is
// built by calling every exported builder over the counts a screen can
// actually show (0, 1, 2, 12, 30, 1,183) and by collecting every exported
// string constant, so a new string joins the sweep by being added to the module
// and nowhere else.
//
// WHAT THIS CANNOT SEE: a string built inline in a component. That is why the
// components only call this module, and why Targets.test.tsx renders the real
// tab and reads the copy back out of the DOM.
import { describe, it, expect } from 'vitest'
import * as copy from './targetsCopy'

const COUNTS = [0, 1, 2, 12, 30, 1183]
const COUNTY = 'Alameda, CA'
const TYPES_ON = [
  { lifer: true, media: true, breeding: true },
  { lifer: true, media: false, breeding: false },
  { lifer: false, media: true, breeding: true },
]

function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(strings)
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings)
  return []
}

/** Probability strings: every one must carry "%" or name the eBird file source. */
function probabilityCorpus(): string[] {
  const out: string[] = [copy.SORT_NAME_MONTH, copy.SORT_NAME_YEAR, copy.PCT_UNIT]
  for (const v of [0, 0.004, 3.29, 27.96, 100]) out.push(copy.percentText(v))
  return out
}

/** Live strings: none may ever carry "%". */
function liveCorpus(): string[] {
  const out: string[] = [
    copy.SORT_NAME_LIVE, copy.LIVE_SOURCE, copy.LIVE_SOURCE_NO_KEY, copy.COL_REPORTED, copy.COL_LAST_REPORT,
    copy.NOT_REPORTED, copy.NO_REPORT_30, copy.NONE_IN_CHECKED, copy.NEEDS_KEY_CELL, copy.SWEEP_OFFLINE_EMPTY,
    copy.liveSourceCached('Sep 25'), copy.WINDOW_NEEDS_LIVE,
  ]
  for (const n of COUNTS) {
    for (const k of COUNTS) {
      out.push(copy.reportedFull(n).text, copy.reportedPartial(n, k).text)
      out.push(...strings(copy.sweepRunning(n, 30)), ...strings(copy.sweepCooldown(k, n, 30)))
      out.push(copy.sweepUnanswered(n, 30, k), copy.sweepPaused(n, 30))
    }
    out.push(copy.sweepComplete('7:41 AM', n))
  }
  out.push(...strings(copy.sweepNoKey(COUNTY)), ...strings(copy.sweepOffline('Sep 25, 2026')))
  return out
}

function corpus(): string[] {
  const out: string[] = []
  // Every exported string constant (and string arrays / records of strings).
  for (const v of Object.values(copy)) if (typeof v !== 'function') out.push(...strings(v))
  // Every builder, over the counts a screen can show.
  for (const n of COUNTS) {
    out.push(copy.checklistCount(n), copy.poolReady(n, COUNTY), copy.joinDetail(n, n, n))
    for (const on of TYPES_ON) {
      out.push(...strings(copy.summaryVisible(n, { lifer: n, media: n, breeding: n }, on)))
      out.push(copy.summaryAnnounced(n, { lifer: n, media: n, breeding: n }, on))
      out.push(copy.noTargets(on, COUNTY, n))
      for (const w of ['day', 'week', '30'] as const) {
        out.push(copy.filteredEmpty(on, COUNTY, w, null))
        for (const miles of [1, 5, 50]) out.push(copy.filteredEmpty(on, COUNTY, w, { miles, anchorName: copy.ANCHOR_DEFAULT_NAME }))
      }
      for (const miles of [1, 5]) out.push(copy.filteredEmpty(on, COUNTY, 'any', { miles, anchorName: copy.ANCHOR_DEVICE_NAME }))
      for (const miles of [1, 25]) out.push(copy.filteredEmpty(on, COUNTY, 'week', { miles, anchorName: 'Arrowhead Marsh' }))
    }
  }
  // Where distances are measured from (FR-51a): every kind, with and without a name.
  for (const kind of ['default', 'device', 'search', 'place', null] as const) {
    for (const place of ['Arrowhead Marsh', null]) {
      out.push(...strings(copy.anchorStatus(kind, place)), copy.anchorStatusText(kind, place), copy.anchorTriggerLabel(kind, place))
      out.push(copy.distanceAriaLabel(copy.anchorName(kind, place)))
    }
  }
  for (const m of copy.DISTANCE_STOPS) out.push(copy.distancePhrase(m), copy.distanceStopLabel(m, m === 50))
  out.push(
    copy.poolLoading(COUNTY), copy.poolLoadingEmpty(COUNTY), copy.poolFailed(copy.POOL_OFFLINE),
    copy.addFileTitle(COUNTY), copy.openBarChartLink(COUNTY), copy.fileTitle(COUNTY, [1900, 2026], 'Jan-Dec'),
    copy.fileTitle(COUNTY, null, 'Mar-May'), copy.unmatchedIntro(COUNTY), copy.probabilitySource(COUNTY, [1900, 2026]),
    copy.probabilityNoFileSource(COUNTY), copy.probabilityLabel(COUNTY, [2015, 2026], 'September'),
    copy.needsFullYear('Mar-May'), copy.noFileCell(COUNTY), copy.sortNeedsFile(COUNTY), copy.sortNeedsFullYear('Mar-May'),
    copy.mediaNeedsTail(['Photo', 'Video']), copy.breedingHasTail(['S', 'H']),
  )
  return [...out, ...probabilityCorpus(), ...liveCorpus()]
}

describe('the Targets copy corpus', () => {
  const all = corpus()

  it('is a real corpus (non-vacuity)', () => {
    expect(all.length).toBeGreaterThan(500)
  })

  it('carries no em dash (U+2014) and no en dash (ranges are ASCII "1900-2026")', () => {
    expect(all.filter(s => s.includes('—'))).toEqual([])
    expect(all.filter(s => s.includes('–'))).toEqual([])
  })

  it('never puts a plural noun after a count of one (species and media are invariant)', () => {
    const offenders = all.filter(s => /(?:^|[^0-9,.])1 (?!species\b|media\b)[a-z]+s\b/.test(s))
    expect(offenders).toEqual([])
  })

  it('never puts a singular noun after a count other than one', () => {
    const offenders = all.filter(s => /\b(?:0|2|12|30|1,183) (?:target|lifer|checklist|day|mile|form)\b(?!s)/.test(s))
    expect(offenders).toEqual([])
  })

  it('every probability string carries "%" (FR-36, FR-58)', () => {
    for (const s of probabilityCorpus()) expect(s, s).toContain('%')
  })

  it('no live string ever carries "%" (FR-42, FR-58)', () => {
    const live = liveCorpus()
    expect(live.length).toBeGreaterThan(100)
    expect(live.filter(s => s.includes('%'))).toEqual([])
  })

  it('the probability source label names eBird, the county, the range and the month (FR-36, QA-38)', () => {
    expect(copy.probabilityLabel(COUNTY, [1900, 2026], 'September')).toBe('eBird, Alameda, CA, 1900-2026, September')
    expect(copy.probabilityLabel(COUNTY, [1900, 2026], copy.YEAR_ROUND)).toBe('eBird, Alameda, CA, 1900-2026, year-round')
    expect(copy.fileTitle(COUNTY, [1900, 2026], 'Jan-Dec')).toBe('eBird bar chart, Alameda, CA, 1900-2026, Jan-Dec')
  })

  it('the live figure is the exact FR-42 sentence', () => {
    expect(copy.reportedFull(12).text).toBe('Reported 12 of the last 30 days')
    expect(copy.reportedPartial(5, 9).text).toBe('Reported 5 of 9 days checked so far')
    expect(copy.reportedPartial(1, 1).text).toBe('Reported 1 of 1 day checked so far')
  })

  it('the status line names the anchor and its kind, as design-spec 2a writes it (FR-51a)', () => {
    expect(copy.anchorStatusText('default', null)).toBe('Distances from your Default Location.')
    expect(copy.anchorStatusText('device', null)).toBe('Distances from your location, found just now.')
    expect(copy.anchorStatusText('search', 'Livermore')).toBe('Distances from Livermore, a place you searched.')
    expect(copy.anchorStatusText('place', 'Arrowhead Marsh')).toBe('Distances from Arrowhead Marsh, a place in this list.')
    expect(copy.anchorStatusText(null, null)).toBe('No location set. Choose where to measure from (a place, your location, or a Default Location set in Settings).')
    expect(copy.anchorTriggerLabel('place', 'Arrowhead Marsh')).toBe('Distances are measured from Arrowhead Marsh. Change')
    expect(copy.anchorTriggerLabel('default', null)).toBe('Distances are measured from your Default Location. Change')
    expect(copy.anchorTriggerLabel(null, null)).toBe('Choose where to measure from')
    expect(copy.distanceAriaLabel('Arrowhead Marsh')).toBe('Distance from Arrowhead Marsh to the last report')
    expect(copy.distanceAriaLabel(null)).toBe('Distance from the measuring point to the last report')
    expect(copy.filteredEmpty({ lifer: true, media: false, breeding: false }, COUNTY, 'any', { miles: 5, anchorName: 'Arrowhead Marsh' }))
      .toBe('No lifer target in Alameda, CA was reported by eBird within 5 miles of Arrowhead Marsh. Any distance shows them all.')
    // The trigger text is exactly the visible anchor name inside the sentence,
    // and the trigger's accessible name contains it (WCAG 2.5.3 Label in Name).
    for (const kind of ['default', 'device', 'search', 'place', null] as const) {
      const s = copy.anchorStatus(kind, 'Livermore')
      expect(copy.anchorStatusText(kind, 'Livermore')).toBe(`${s.strong ?? ''}${s.lead}${s.trigger}${s.tail}`)
      expect(copy.anchorTriggerLabel(kind, 'Livermore').toLowerCase(), String(kind)).toContain(s.trigger.toLowerCase())
    }
  })

  it('the summary reads as the design writes it (FR-25)', () => {
    const on = { lifer: true, media: true, breeding: true }
    expect(copy.summaryAnnounced(27, { lifer: 14, media: 9, breeding: 8 }, on)).toBe('27 targets: 14 lifers, 9 media, 8 breeding')
    expect(copy.summaryAnnounced(1, { lifer: 1, media: 0, breeding: 0 }, on)).toBe('1 target: 1 lifer, 0 media, 0 breeding')
  })
})
