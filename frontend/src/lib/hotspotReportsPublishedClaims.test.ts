// The published claims about the Hotspot Reports tab in `docs/HELP.md`
// (hotspot-reports FR-59, QA-57), held to the code.
//
// WHY THIS FILE EXISTS. The docs rule asks that a feature adding sentences to
// `docs/HELP.md` arrive with a guard of the `*PublishedClaims` shape. This build
// added Help's `## Hotspot Reports` section, named the tab in Help's two lists
// of tabs, and re-scoped two Map Explorer sentences that a plain map with no
// corner controls (FR-40) would otherwise have made false.
//
// WHAT IT DOES NOT COVER. The README, website and App Store sentences are held
// for the user's yes, and their rows live in
// `hotspotReportsSurfacesPublishedClaims.test.ts`, the file the held patch owns.
//
// THE SHAPE IS `lifeListsPublishedClaims.test.ts`'s. It scopes to Help's own
// passage (the `## Hotspot Reports` heading to the next `## `, never a named
// heading), asserts each claim EXISTS before checking it is right, and builds
// every name and number it checks FROM the code: the tab label and its place
// from `TAB_LABELS` and `DEFAULT_TAB_ORDER`, the on-screen words from the tab's
// copy module, the weather floor from `WEATHER_SPECIES_MIN_CHECKLISTS`, the
// page size from `PAGE_SIZE`. Where Help states a behaviour rather than a word
// (the species rule against the two older figures, media following the linked
// checklist, a kind never personal for want of an answer, the plain map), a
// row drives the real functions over rows built the way the parser builds them.
//
// CONTENT AND DELIVERY. A row that imports a constant proves the prose and the
// screen use the same word; it does not prove the word is right. The rows that
// say what the tab DOES are the behaviour rows, written with literals.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { sep } from 'node:path'
import { DEFAULT_TAB_ORDER, TAB_LABELS } from './tabLayout'
import { WEATHER_SPECIES_MIN_CHECKLISTS } from './weatherStats'
import { PICKER_OPTION_CAP } from './hotspotReportsPicker'
import { RANKED_LIST_SIZE, buildLocationIndex, deriveMediaCounts, speciesTotals } from './hotspotReports'
import { DURATION_MAX_MIN, PROTOCOL_ROWS_MAX } from './hotspotReportsLocation'
import { kindOf } from './hotspotReportsKind'
import type { HotspotResolution, RegionResolution } from './hotspotSet'
import {
  BLANK_PROTOCOL, COMPLETE_HEAD, FACT_TERMS, KIND_WORDS, MEDIA_HEAD, MONTHS_TITLE, OTHER_PROTOCOLS,
  OVERVIEW_LABEL, PICKER_LABEL, RANK_HEADINGS, REPORT_SECTIONS, RULE_SENTENCE, SECTION_TITLES,
  SHOW_NEXT_LABEL, TOTAL_LABELS, UNNAMED_LOCATION, YEARS_TITLE, showAllLabel,
} from './hotspotReportsCopy'
import { PAGE_SIZE } from './pageList'
import { COUNT_FORMS_TOGGLE_LABEL } from './countabilityCopy'
import { computeChecklists, computeGeo, filterObservations } from './birdingStats'
import { buildHotspotPersonalStats } from './hotspotColorModes'
import { checklist, mlRow } from '../test/hotspotReportsRows'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const HELP = read('docs/HELP.md')
const TAB = 'hotspot-reports' as const
const LABEL = TAB_LABELS[TAB]
const AT = DEFAULT_TAB_ORDER.indexOf(TAB)
const BEFORE = TAB_LABELS[DEFAULT_TAB_ORDER[AT - 1]]
const AFTER = TAB_LABELS[DEFAULT_TAB_ORDER[AT + 1]]

/** "a, b, and c", the serial-comma list Help's prose uses. */
function serialList(items: readonly string[]): string {
  if (items.length < 2) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** "a, b and c", the form Help's two lists of tabs use (no serial comma). */
function plainList(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

/** Help's passage for a heading: `## Label` to the next `## `, never a named heading. */
function helpPassage(label: string): string {
  const head = `\n## ${label}\n`
  const i = HELP.indexOf(head)
  expect(i, `docs/HELP.md has a "## ${label}" section`).toBeGreaterThan(-1)
  expect(HELP.indexOf(head, i + 1), `docs/HELP.md has exactly one "## ${label}" section`).toBe(-1)
  const end = HELP.indexOf('\n## ', i + head.length)
  return HELP.slice(i + 1, end === -1 ? undefined : end)
}

/** One bold-led paragraph of a passage: from `**Lead.**` to the next blank line. */
function paragraph(text: string, lead: string): string {
  const i = text.indexOf(`\n**${lead}.**`)
  expect(i, `the passage has a "**${lead}.**" paragraph`).toBeGreaterThan(-1)
  const end = text.indexOf('\n\n', i + 1)
  return text.slice(i + 1, end === -1 ? undefined : end)
}

/** Source text with comments removed, strings kept, so a commented-out line
 *  cannot satisfy a presence row and a word in a comment cannot fail an
 *  absence row (testing.md, v1.0.14). */
function stripComments(code: string): string {
  let out = ''
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && code[i + 1] === '*') {
      i += 2
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      out += c
      i += 1
      while (i < code.length && code[i] !== c) {
        if (code[i] === '\\') { out += code[i]; i += 1 }
        if (i < code.length) { out += code[i]; i += 1 }
      }
      if (i < code.length) { out += code[i]; i += 1 }
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** True when the text holds a character outside ASCII (no control-character regex). */
function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0x7f) return true
  return false
}

const HELP_SECTIONS = [...HELP.matchAll(/^## (.+)$/gm)].map(m => m[1].trim())
const passage = () => helpPassage(LABEL)

describe('the Hotspot Reports tab sits where Help says it does', () => {
  it('DEFAULT_TAB_ORDER places it between Breeding Codes and Checklists (FR-02)', () => {
    expect(AT, 'hotspot-reports is in DEFAULT_TAB_ORDER').toBeGreaterThan(0)
    expect(DEFAULT_TAB_ORDER[AT - 1]).toBe('breeding-codes')
    expect(DEFAULT_TAB_ORDER[AT + 1]).toBe('checklists')
  })

  it("Help's section and its TOC entry run between their neighbours in DEFAULT_TAB_ORDER (FR-59, QA-57)", () => {
    const i = HELP_SECTIONS.indexOf(LABEL)
    expect(i, `Help has a "## ${LABEL}" section`).toBeGreaterThan(0)
    expect(HELP_SECTIONS[i - 1]).toBe(BEFORE)
    expect(HELP_SECTIONS[i + 1]).toBe(AFTER)
    const toc = read('frontend/src/components/HelpDocs.tsx')
    const entry = toc.indexOf(`label: '${LABEL}'`)
    expect(entry, 'HelpDocs.tsx has a TOC entry for the tab').toBeGreaterThan(-1)
    expect(toc.indexOf(`label: '${BEFORE}'`)).toBeLessThan(entry)
    expect(toc.indexOf(`label: '${AFTER}'`)).toBeGreaterThan(entry)
  })

  it("Help's two lists of the tabs the eBird backup powers name every tab after Weather, in DEFAULT_TAB_ORDER (FR-59)", () => {
    // Both sentences claim to list every tab the backup powers, so each is
    // checked as the WHOLE list, in order, not only for this tab's name.
    const list = plainList(DEFAULT_TAB_ORDER.filter(t => t !== 'weather').map(t => TAB_LABELS[t]))
    expect(list).toContain(`${BEFORE}, ${LABEL}, ${AFTER}`)
    expect(HELP).toContain(`This powers the ${list} tabs, and the Weather tab's list of checklists with no weather blocks.`)
    expect(HELP).toContain(`The eBird backup is used by every tab: ${list}, and on the Weather tab,`)
  })

  it("Help's ML export lists name the tab's photo, audio and video counts", () => {
    expect(HELP).toContain(`Targets, Life Lists and ${LABEL}, the Calendar's Media overlay`)
    expect(HELP).toContain(`the ${LABEL} tab's photo, audio and video counts for a place,`)
  })
})

describe("Help's Hotspot Reports section", () => {
  it('exists, opens by naming the tab from TAB_LABELS, and carries no em dash and no non-ASCII character (non-vacuity)', () => {
    const text = passage()
    expect(text.length).toBeGreaterThan(5000)
    expect(text).toContain(`\nThe ${LABEL} tab reports on any one place in your eBird backup, a public eBird hotspot or one of your personal locations:`)
    expect(text.includes('\u2014')).toBe(false)
    expect(hasNonAscii(text), 'the section is plain ASCII').toBe(false)
  })

  it('names the tab only by its TAB_LABELS label, anywhere in Help, and never by a component or file name', () => {
    const mentions = [...HELP.matchAll(/hotspot[\s-]*reports?\b/gi)].map(m => m[0])
    expect(mentions.length, 'Help names the tab (non-vacuity)').toBeGreaterThanOrEqual(6)
    for (const m of mentions) expect(m).toBe(LABEL)
    for (const id of ['HotspotReport', 'hotspotReports', 'hotspot-reports', 'sr-hsr']) {
      expect(HELP.includes(id), `Help does not name "${id}"`).toBe(false)
    }
  })

  it('says what a location is and that only places in the backup are offered (FR-10, FR-14)', () => {
    const p = paragraph(passage(), 'What a location is')
    expect(p).toContain('A location is one Location ID in your backup')
    expect(p).toContain('Only places in your backup are offered: a hotspot you have never birded is not listed, and nothing is added from eBird.')
    expect(p).toContain('Two places with the same name are two locations, each with its own report, and no figure is ever combined across them.')
  })

  it('names the picker and its Overview row as the tab renders them, and states the option cap as a property, never as its number (FR-18 to FR-22)', () => {
    const p = paragraph(passage(), 'Choosing a place')
    expect(p).toContain(`The **${PICKER_LABEL}** picker at the top of the tab lists every location in your backup`)
    expect(p).toContain(`a place with no name is listed as "${UNNAMED_LOCATION}", after the named ones.`)
    expect(p).toContain(`The first row, **${OVERVIEW_LABEL}**, takes you back to the overview.`)
    expect(p).toContain("what you type is matched anywhere in a place's name, its county, or its state or province")
    expect(p).toContain('a Location ID is not matched.')
    expect(p).toContain('The list draws a fixed number of places at a time; when more match, a line at its foot says how many and asks you to keep typing.')
    // The cap is a constant Help deliberately does not print (docs rule: publish
    // the property, never the count).
    expect(PICKER_OPTION_CAP).toBeGreaterThan(0)
    expect(passage().includes(String(PICKER_OPTION_CAP))).toBe(false)
  })

  it('says namesakes are told apart by place and then by Location ID (FR-21)', () => {
    expect(paragraph(passage(), 'Choosing a place')).toContain(
      'Where two places share both a name and a county and state, each of those rows also shows its Location ID, so namesakes are told apart first by place and then by ID.')
  })

  it('names the kinds as the tab renders them, and says why a kind can be missing (FR-15, FR-16)', () => {
    const p = paragraph(passage(), 'Hotspot or personal location')
    expect(p).toContain(`Each place carries one of three kinds: **${KIND_WORDS.hotspot}** (a public eBird hotspot), **${KIND_WORDS.personal}**, or no mark at all, which means not yet known.`)
    expect(p).toContain('so a place is never called personal for want of an answer.')
    for (const reason of [
      'because eBird has not been asked about that region yet or has not answered',
      'because no eBird key is saved',
      'because you are offline and the region has not been answered before',
      'because your backup gives the place no state or province code',
    ]) expect(p).toContain(reason)
    // The lookup it points at is described under Geographic Stats.
    expect(p).toContain('the same lookup as the hotspot share on Statistics (see Geographic Stats)')
    expect(HELP).toContain('\n### Geographic Stats\n')
  })

  it('names the two ranked lists as the tab renders them, with their size from RANKED_LIST_SIZE (FR-28 to FR-30)', () => {
    const p = paragraph(passage(), 'The overview')
    expect(p).toContain(`Below are two lists of up to ${RANKED_LIST_SIZE} places: **${RANK_HEADINGS.checklists}**`)
    expect(p).toContain(`**${RANK_HEADINGS.species}**, the places with the highest species total under this tab's rule (below), where a place with no countable species is never listed.`)
    expect(p).toContain("Press a row to open that place's report; keyboard focus moves to the report's heading.")
    expect(p).toContain('with no zero printed for either kind.')
  })

  it("names the report's totals and its sections as the tab renders them, in REPORT_SECTIONS order (FR-31, FR-50)", () => {
    const text = passage()
    expect(text).toContain(`two totals, **${TOTAL_LABELS.species}** and **${TOTAL_LABELS.checklists(2)}**, with one line under them stating the counting rule.`)
    const titles = REPORT_SECTIONS.map(s => SECTION_TITLES[s])
    expect(text).toContain(`${NUMBER_WORDS[titles.length]} sections follow: ${serialList(titles)}.`)
    // And each section has its own bold-led paragraph, under the same title.
    for (const t of titles) expect(text, t).toContain(`\n**${t}.**`)
  })

  it("states the life list's paging from PAGE_SIZE and the pager's own labels, and its in-place dating (FR-34, FR-37)", () => {
    const p = paragraph(passage(), SECTION_TITLES.list)
    expect(SHOW_NEXT_LABEL).toContain(String(PAGE_SIZE))
    const showAll = showAllLabel(0).replace(/ \(.*\)$/, '')
    expect(p).toContain(`The list shows ${PAGE_SIZE} species at a time, with **${SHOW_NEXT_LABEL}** and **${showAll}**.`)
    expect(p).toContain('A species first seen somewhere else shows the date you first recorded it here, never your first sighting anywhere.')
    expect(p).toContain("how many of your checklists here include it, out of the place's checklist total.")
  })

  it('names the protocol buckets as the tab renders them, and states the row cap as a property (FR-42 to FR-44)', () => {
    const p = paragraph(passage(), SECTION_TITLES.protocols)
    expect(p).toContain(`any beyond them are added together under **${OTHER_PROTOCOLS}**`)
    expect(p).toContain(`counted under **${BLANK_PROTOCOL}** rather than dropped, so the rows always add up to the place's checklist total.`)
    expect(p).toContain(`**${COMPLETE_HEAD}** gives the share that are complete`)
    expect(PROTOCOL_ROWS_MAX).toBeGreaterThan(0)
    expect(p.includes(String(PROTOCOL_ROWS_MAX))).toBe(false)
  })

  it("builds the weather floor from WEATHER_SPECIES_MIN_CHECKLISTS, and every number in the weather paragraph is that floor (FR-45 to FR-49)", () => {
    const F = WEATHER_SPECIES_MIN_CHECKLISTS
    const p = paragraph(passage(), SECTION_TITLES.weather)
    expect(p).toContain('Built only from the weather blocks that SnowRaven or RainCrow wrote into your own checklist comments at this place.')
    expect(p).toContain('Nothing is looked up, and a checklist with no block is never filled in.')
    expect(p).toContain(`Below ${F} readable blocks it summarizes nothing and says that is too few.`)
    expect(p).toContain(`From ${F} on it shows three distributions`)
    expect(p).toContain(`A distribution resting on fewer than ${F} checklists shows its counts and names no most common band.`)
    const numbers = p.match(/\d+/g) ?? []
    expect(numbers.length, 'the paragraph states the floor (non-vacuity)').toBeGreaterThanOrEqual(3)
    for (const n of numbers) expect(Number(n)).toBe(F)
  })

  it('names the facts as the tab renders them and the duration bound from DURATION_MAX_MIN (FR-51 to FR-54)', () => {
    const p = paragraph(passage(), SECTION_TITLES.visits)
    for (const term of [FACT_TERMS.first, FACT_TERMS.latest, FACT_TERMS.only, FACT_TERMS.time, FACT_TERMS.biggest, MONTHS_TITLE, YEARS_TITLE, MEDIA_HEAD]) {
      expect(p, term).toContain(`**${term}**`)
    }
    expect(DURATION_MAX_MIN % 60).toBe(0)
    expect(p).toContain(`(not blank, not negative, and at most ${DURATION_MAX_MIN / 60} hours)`)
  })

  it('says media counts follow the linked checklist, never the place in the ML export (FR-55)', () => {
    expect(paragraph(passage(), SECTION_TITLES.visits)).toContain(
      'each item follows the checklist it is linked to, never the place recorded in the ML export itself.')
  })

  it("states the species rule in the in-app rule sentence's own words for the escapee check, and names the Life Lists tab from TAB_LABELS (FR-36, FR-39)", () => {
    const p = paragraph(passage(), 'One species rule, and why other tabs can show a different number')
    const check = `the exotic status check on ${TAB_LABELS['birding-stats']}`
    expect(RULE_SENTENCE).toContain(check)
    expect(p).toContain(`so are the species ${check} (the escapee check described there) found to be escapees, while naturalized and provisional exotics are listed.`)
    expect(p).toContain(`the one the ${TAB_LABELS['life-lists']} tab follows at its defaults`)
    expect(p).toContain("This tab only reads that check's result and never runs it, so a species the check has not settled is listed.")
    expect(p).toContain('A species counts at a place only from a record there that has a valid date and a checklist.')
  })

  it('explains the two older figures for a place in their own terms (Out of Scope, "Figures left as they are")', () => {
    const text = passage()
    const i = text.indexOf('\nTwo other tabs count species at a place by rules of their own')
    expect(i, 'the explanation exists (non-vacuity)').toBeGreaterThan(-1)
    const p = text.slice(i + 1, text.indexOf('\n\n', i + 1))
    expect(p).toContain(`${TAB_LABELS['birding-stats']}' Geographic Stats ranks your top locations by species`)
    expect(p).toContain(`so with ${COUNT_FORMS_TOGGLE_LABEL} on it includes spuhs, slashes and hybrids; it never leaves out escapees; and it needs no valid date.`)
    expect(p).toContain(`With ${COUNT_FORMS_TOGGLE_LABEL} off, its checklist count for a place also leaves out a checklist made up only of forms that do not count, which this tab counts.`)
    expect(p).toContain(`The ${TAB_LABELS['map-explorer']}'s My species, shown for the hotspots in a Hotspots search, leaves out spuhs, slashes and hybrids but not escapees, and needs no valid date;`)
    expect(p).toContain('explained under Hotspots.')
    expect(HELP).toContain('\n### Hotspots\n')
    expect(p).toContain(`So, with ${COUNT_FORMS_TOGGLE_LABEL} off on ${TAB_LABELS['birding-stats']}, this tab's species total for a place is lower than both of those figures when the place holds a species the check found to be an escapee, or a species recorded there only on records with no valid date or no checklist, and equal to them otherwise.`)
  })

  it('says the choice is per-session in the house phrasing, and that the tab saves nothing of its own (FR-57, FR-58)', () => {
    const p = paragraph(passage(), 'What is remembered')
    expect(p).toContain('The place you choose is per-session, resetting on relaunch: this tab saves nothing of its own, so it opens on the overview each time SnowRaven starts')
    expect(p).toContain('if the place you were looking at is not in the new backup, the tab goes back to the overview.')
    expect(passage()).not.toContain('remembered on this device')
    expect(passage()).not.toContain('SnowRaven remembers')
  })
})

describe('the behaviour the section describes', () => {
  // Rows built the way the parser delivers them (`test/hotspotReportsRows.ts`).
  // L1 holds a dated countable species, a dated spuh, a species recorded only on
  // an undated checklist, and a species the escapee check found to be an
  // escapee; L2 holds only dated countable species; L3 holds one checklist made
  // up only of a spuh beside a dated countable one.
  const OBS = [
    ...checklist({ submissionId: 'S1', locationId: 'L1', location: 'Pond', date: '2024-05-01', species: ['Song Sparrow', 'American Robin', 'gull sp.'] }),
    ...checklist({ submissionId: 'S2', locationId: 'L1', location: 'Pond', date: '', species: ['Northern Cardinal'] }),
    ...checklist({ submissionId: 'S3', locationId: 'L2', location: 'Meadow', date: '2024-06-01', species: ['Song Sparrow', 'Blue Jay'] }),
    ...checklist({ submissionId: 'S4', locationId: 'L3', location: 'Marsh', date: '2024-07-01', species: ['Mallard'] }),
    ...checklist({ submissionId: 'S5', locationId: 'L3', location: 'Marsh', date: '2024-07-02', species: ['gull sp.'] }),
  ]
  const ESCAPEES: ReadonlySet<string> = new Set(['American Robin'])
  const index = buildLocationIndex(OBS)
  const ord = (id: string) => {
    const o = index.ordById.get(id)
    expect(o, `${id} is a location`).not.toBeUndefined()
    return o!
  }
  const totals = speciesTotals(index, ESCAPEES)

  /** Statistics' top locations by species and by checklists, as statsBundle feeds computeGeo. */
  function statistics(countAllForms: boolean) {
    const filtered = filterObservations(OBS, countAllForms)
    const geo = computeGeo(computeChecklists(filtered), filtered)
    const by = (id: string) => geo.topLocationsBySpecies.find(l => l.locationId === id)
    return { species: (id: string) => by(id)?.species, checklists: (id: string) => by(id)?.checklists }
  }
  const mySpecies = buildHotspotPersonalStats(OBS)

  it("this tab's total is lower than both older figures when the place holds an escapee or a species recorded only undated", () => {
    const stats = statistics(false)
    expect(totals[ord('L1')]).toBe(1)               // Song Sparrow only
    expect(stats.species('L1')).toBe(3)             // + American Robin, Northern Cardinal
    expect(mySpecies.get('L1')?.species).toBe(3)
    // Escapee alone, and undated alone, each make the difference.
    expect(speciesTotals(index, new Set())[ord('L1')]).toBe(2)
  })

  it('and equal to both otherwise, with Count all forms off; with it on, Statistics also counts the spuh', () => {
    expect(totals[ord('L2')]).toBe(2)
    expect(statistics(false).species('L2')).toBe(2)
    expect(mySpecies.get('L2')?.species).toBe(2)
    expect(statistics(true).species('L1')).toBe(4) // the spuh too
  })

  it("Statistics' checklist count, with Count all forms off, leaves out a checklist made up only of forms that do not count; this tab counts it", () => {
    expect(index.checklistCount[ord('L3')]).toBe(2)
    expect(statistics(false).checklists('L3')).toBe(1)
    expect(statistics(true).checklists('L3')).toBe(2)
  })

  it('media follow the checklist each item is linked to, never the place written in the ML export', () => {
    const counts = deriveMediaCounts([
      mlRow({ catalogId: '1', checklistId: 'S1', location: 'Somewhere else', latitude: 0, longitude: 0 }),
      mlRow({ catalogId: '2', checklistId: '', location: 'Pond' }),
      mlRow({ catalogId: '3', checklistId: 'S999', location: 'Pond' }),
    ], index)
    expect(counts[ord('L1') * 3]).toBe(1)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('a kind is never personal for want of an answer, and a place with no state or province code has none', () => {
    const res = (state: RegionResolution | null, ids: readonly string[] = []): HotspotResolution => {
      const byRegion = new Map<string, RegionResolution>(state === null ? [] : [['US-NY', state]])
      return {
        regions: state === null ? [] : ['US-NY'], byRegion, set: new Set(ids),
        pending: state === 'pending' ? 1 : 0, answered: state === 'answered' ? 1 : 0, unanswered: state === 'unanswered' ? 1 : 0,
      }
    }
    const place = { locationId: 'L1', stateProvince: 'US-NY' }
    expect(kindOf(place, res(null))).toBeNull()
    expect(kindOf(place, res('pending'))).toBeNull()
    expect(kindOf(place, res('unanswered'))).toBeNull()
    expect(kindOf(place, res('answered'))).toBe('personal')
    expect(kindOf(place, res('answered', ['L1']))).toBe('hotspot')
    expect(kindOf({ locationId: 'L1', stateProvince: null }, res('answered', ['L1']))).toBeNull()
  })
})

describe('the map sentences, kept true with a plain map in the app (FR-40, FR-59)', () => {
  const COMPONENTS = 'frontend/src/components/'
  const src = (f: string) => stripComments(read(`${COMPONENTS}${f}`))
  /** Every shipped component file that renders a map, found by walking the
   *  tree rather than named, so a new map is in the set the day it lands. */
  const MAP_FILES = readdirSync(new URL('../components/', import.meta.url), { recursive: true, encoding: 'utf8' })
    .map(f => f.split(sep).join('/'))
    .filter(f => f.endsWith('.tsx') && !f.includes('.test.'))
    .filter(f => src(f).includes('<SnowMap'))
    .sort()
  const SHARE = /<(MapCornerControls|SharePin)\b/

  it("the report's map is plain: one marker, and no base switcher, share, fullscreen or location control, and no popup", () => {
    const code = src('hotspotReports/HotspotReportMap.tsx')
    expect(code).toContain('<SnowMap')
    expect(code).toContain('<Marker')
    for (const absent of ['switcher', 'SharePin', 'MapCornerControls', 'useMapFullscreen', '<Popup', 'Locate']) {
      expect(code.includes(absent), `HotspotReportMap.tsx has no ${absent}`).toBe(false)
    }
    expect(paragraph(passage(), SECTION_TITLES.map)).toContain(
      'It is a plain map: its zoom buttons and the map credits, and no base map switcher, share button, fullscreen button, location button or popup.')
  })

  it('the maps without a share control are exactly the two Help names as having no corner row', () => {
    // Non-vacuity: the walk finds the maps Help names, share-bearing and plain.
    for (const f of ['MapExplorer.tsx', 'SightingsMap.tsx', 'BirdingStats.tsx', 'SpeciesDetail.tsx', 'PredictMap.tsx', 'hotspotReports/HotspotReportMap.tsx']) {
      expect(MAP_FILES, f).toContain(f)
    }
    const plain = MAP_FILES.filter(f => !SHARE.test(src(f))).sort()
    expect(plain, 'a new map without a share control: re-check Help\'s "Where it works" and corner-row sentences')
      .toEqual(['PredictMap.tsx', 'hotspotReports/HotspotReportMap.tsx'])
    expect(HELP).toContain(`The small location-picker map in the Weather tab's Plan form and the map in a ${LABEL} report have no row at all.`)
  })

  it('"Copying a location works on every map in the app" is gone, re-scoped at paragraph scope to the maps with a share button', () => {
    expect(HELP.includes('works on every map in the app')).toBe(false)
    expect(HELP).toContain(`**Where it works.** Copying a location works on every map that has a share button in its bottom-right corner (see "The buttons in the map's bottom-right corner" above). A map with no row of buttons there, such as the Weather tab's Plan location picker or the map in a ${LABEL} report, has no share pin.`)
    // The cross-reference resolves to a real lead-in in the Map Explorer section.
    expect(HELP).toContain("**The buttons in the map's bottom-right corner.**")
  })

  it('every "every map" in Help is qualified, so no sentence claims something of all the maps a plain map lacks', () => {
    // "Every Map Explorer view" names a tab, not the maps, so it is not one.
    const found = [...HELP.matchAll(/every map\b(?! Explorer)(.{0,40})/gi)].map(m => m[1])
    expect(found.length, 'Help says "every map" somewhere (non-vacuity)').toBeGreaterThanOrEqual(3)
    for (const rest of found) {
      expect(
        rest.startsWith(' that has a share button') || rest.startsWith(' with a share pin') || rest.startsWith(' **opens offline**'),
        `an unqualified "every map${rest}"`,
      ).toBe(true)
    }
    expect(/\b(all|each) (of the )?maps?\b/i.test(HELP), 'Help says "all maps" or "each map" nowhere').toBe(false)
  })
})
