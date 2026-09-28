// The published Targets help passage, held to the code (targets-tab, schema.md
// 9.2; the v1.0.21 rule that a requirement resting on a guard needs a guard that
// actually reads the published file).
//
// docs/HELP.md is the in-app help and a published statement. Every figure and
// every control name the `## Targets` passage states is DERIVED here from the
// constant or the function that renders it, never retyped, so a renamed button
// or a moved slider stop turns this file red rather than leaving the help
// describing a control that no longer exists.
//
// DELIVERY vs CONTENT (testing.md v1.0.14): the rows that import a constant prove
// the help and the UI say the same thing. The behaviour rows (F and H count as
// codes; a form's media counts for its species; the file is not synced) prove
// the help's claim is TRUE of the shipped logic, which a shared constant cannot.
//
// WHAT THIS CANNOT SEE: whether a sentence is well written, and any claim made
// in words that name no constant. Those stay with review.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as copy from './targets/targetsCopy'
import { MEDIA_TYPES, buildTargetsRecord } from './targets/targetsRecord'
import { classifyPool } from './targets/targetsClassify'
import { isBreedingTarget, isMediaTarget } from './targets/targetsFilter'
import { SORT_ORDER } from './targets/targetsSort'
import { SWEEP_DAYS } from './targets/targetsDates'
import { parseBarChartFilename } from './uploadGuard'
import { SLOTS } from './icloud/icloudRecord'
import { registeredTeardowns } from './clearDerived'
import { DEFAULT_TAB_ORDER, TAB_LABELS } from './tabLayout'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'

const HELP = readFileSync(fileURLToPath(new URL('../../../docs/HELP.md', import.meta.url)), 'utf8')

function section(heading: string): string {
  const start = HELP.indexOf(`\n${heading}\n`)
  if (start === -1) return ''
  const rest = HELP.slice(start + heading.length + 2)
  const next = rest.search(/\n## /)
  return next === -1 ? rest : rest.slice(0, next)
}

const TARGETS = section('## Targets')
const bold = (s: string) => `**${s}**`

describe('the passage exists and is the one being read (non-vacuity)', () => {
  it('has the Targets section with its subsections', () => {
    expect(TARGETS.length).toBeGreaterThan(2000)
    for (const h of [
      '### Choosing a county', '### The three kinds of target', '### Probability and live: two different numbers',
      "### Adding a county's eBird bar-chart file", '### Live counts', '### Sorting and filtering',
    ]) expect(TARGETS, h).toContain(h)
  })
})

describe('control names match the controls', () => {
  it('the picker, the three types, the chips and the threshold', () => {
    expect(TARGETS).toContain(bold(copy.COUNTY_LABEL))
    for (const t of [copy.TYPE_LIFER, copy.TYPE_MEDIA, copy.TYPE_BREEDING]) expect(TARGETS, t).toContain(`- ${bold(t)}:`)
    for (const m of MEDIA_TYPES) expect(TARGETS, m).toContain(bold(m))
    expect(TARGETS).toContain(bold(copy.THRESHOLD_CONFIRMED))
  })

  it('the bar-chart section and its actions', () => {
    for (const s of [copy.FILE_SECTION_LABEL, copy.ADD_FILE, copy.REPLACE_FILE, copy.REMOVE_FILE, copy.SHOW_UNMATCHED, copy.ADD_FILE_DETAIL_ACTION]) {
      expect(TARGETS, s).toContain(bold(s))
    }
  })

  it('the window and distance controls', () => {
    expect(TARGETS).toContain(bold(copy.WINDOW_LABEL))
    expect(TARGETS).toContain(bold(copy.DISTANCE_LABEL))
    // The measuring-point chooser's options (FR-51a), named as the dialog names them.
    for (const s of [copy.CHOOSER_MY_LOCATION, copy.CHOOSER_DEFAULT, copy.CHOOSER_LIST_SECTION]) expect(TARGETS, s).toContain(bold(s))
    // The search's disclosure: OpenStreetMap, on a press of Search, in the help
    // and in the hint the dialog shows beside the field.
    expect(TARGETS).toContain('looked up on OpenStreetMap only when you press **Search**')
    expect(copy.CHOOSER_SEARCH_HINT).toContain('looked up on OpenStreetMap when you press Search')
    const any = copy.WINDOW_OPTIONS.find(o => o.key === 'any')!
    expect(TARGETS).toContain(bold(any.label))
    // "the last day, week, or 30 days": every other window option, in order.
    const rest = copy.WINDOW_OPTIONS.filter(o => o.key !== 'any').map(o => o.label.toLowerCase())
    expect(TARGETS).toContain(`in the last ${rest.slice(0, -1).join(', ')}, or ${rest[rest.length - 1]}`)
  })
})

describe('figures match the code that renders them', () => {
  it('the distance stops', () => {
    const miles = copy.DISTANCE_STOPS.filter((s): s is number => s !== null)
    expect(miles.length).toBeGreaterThan(1)
    expect(TARGETS).toContain(`within ${miles.slice(0, -1).join(', ')} or ${miles[miles.length - 1]} miles`)
  })

  it('the live window, and the live figure quoted in the help is the one the cell renders', () => {
    expect(TARGETS).toContain(`last ${SWEEP_DAYS} days`)
    expect(TARGETS).toContain(`"${copy.reportedFull(12).text}"`)
    expect(copy.reportedFull(12).text).not.toContain('%')
  })

  it('the probability label quoted in the help is the one the header renders', () => {
    expect(TARGETS).toContain(`"${copy.probabilityLabel('Alameda, CA', [1900, 2026], copy.YEAR_ROUND)}"`)
  })

  it('the example file name is one the import accepts, for the county it names', () => {
    const m = TARGETS.match(/`(ebird_[^`]+_barchart\.txt)`/)
    expect(m).not.toBeNull()
    expect(parseBarChartFilename(m![1])).toEqual({ regionCode: 'US-CA-001', years: [1900, 2026], months: [1, 12], malformedCode: false })
  })

  it('the six sorts the help lists are the six the control offers', () => {
    expect(SORT_ORDER).toEqual(['freq-month', 'freq-year', 'live-days', 'distance', 'alpha', 'taxonomic'])
    for (const phrase of ['eBird frequency this month', 'eBird frequency year-round', 'days reported in the last 30', 'distance to the last report', 'alphabetically', "eBird's taxonomic order"]) {
      expect(TARGETS, phrase).toContain(phrase)
    }
  })
})

// ---- behaviour behind the help's claims (CONTENT rows) ----------------------

function obs(commonName: string, breedingCode: string | null = null): ObservationEntry {
  return {
    submissionId: 'S1', commonName, scientificName: `${commonName} sci`, date: '2026-05-01',
    location: 'X', locationId: 'L1', latitude: 1, longitude: 1, county: 'Alameda', count: 1,
    breedingCode, speciesComments: '', catalogIds: [], stateProvince: 'US-CA',
  }
}
function ml(commonName: string, format: 'Photo' | 'Audio' | 'Video'): MLExportRow {
  return { catalogId: '1', commonName, scientificName: '', format } as unknown as MLExportRow
}

describe('what the help says is true of the shipped logic', () => {
  it('"F and H count as codes": a species with only F or H is not a Breeding target', () => {
    expect(TARGETS).toContain('F and H count as codes')
    const pool = [{ speciesCode: 'amerob', commonName: 'American Robin' }, { speciesCode: 'sonspa', commonName: 'Song Sparrow' }]
    const record = buildTargetsRecord([obs('American Robin', 'F'), obs('Song Sparrow', 'H')], null, null)
    for (const c of classifyPool(pool, record)) expect(isBreedingTarget(c, 'any'), c.commonName).toBe(false)
  })

  it('"a photo of Dark-eyed Junco (Oregon) counts as a photo of Dark-eyed Junco"', () => {
    expect(TARGETS).toContain('a photo of "Dark-eyed Junco (Oregon)" counts as a photo of Dark-eyed Junco')
    const record = buildTargetsRecord([obs('Dark-eyed Junco')], [ml('Dark-eyed Junco (Oregon)', 'Photo')], null)
    const [junco] = classifyPool([{ speciesCode: 'daejun', commonName: 'Dark-eyed Junco' }], record)
    expect(junco.missingMedia).not.toContain('Photo')
    // Selecting the Photo chip does not list it: the form's photo counts.
    expect(isMediaTarget(junco, new Set(['Photo'] as const))).toBe(false)
  })

  it('"not part of iCloud Sync": the synced slots are the two data files and nothing else', () => {
    expect(TARGETS).toContain('is not part of iCloud Sync')
    expect([...SLOTS]).toEqual(['ebird', 'ml'])
  })

  it('"a lifer is never a Media or Breeding target"', () => {
    expect(TARGETS).toContain('A lifer is never a Media or Breeding target')
    const record = buildTargetsRecord([obs('Song Sparrow')], [], null)
    const [lifer] = classifyPool([{ speciesCode: 'amerob', commonName: 'American Robin' }], record)
    expect(lifer.lifer).toBe(true)
    expect(isBreedingTarget(lifer, 'any')).toBe(false)
    expect(isMediaTarget(lifer, new Set())).toBe(false)
  })
})

// ---- PRIVACY_POLICY.md and its published mirror (FR-61) --------------------
//
// The approved text (pipeline/targets-tab/copy-proposals.md, section 1, with the
// optional third edit) landed at the 1.0.39 ship. Its three claims are held here
// in the house published-claims shape (.claude/rules/docs-and-website.md):
// each file's OWN passage is extracted (the eBird bullet with its sub-bullets,
// and the clearing-the-backup bullet), each row asserts the claim EXISTS before
// checking it is right, the one number is built from the constant, the claims
// are held to the code that makes them true, and the two published files are
// compared against EACH OTHER, because website/privacy.html is a copy of the
// policy ("same set, same order, same text") and is the one a visitor reads.

const POLICY = readFileSync(fileURLToPath(new URL('../../../PRIVACY_POLICY.md', import.meta.url)), 'utf8')
const PRIVACY_PAGE = readFileSync(fileURLToPath(new URL('../../../website/privacy.html', import.meta.url)), 'utf8')

const plain = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Markdown: from the line that opens the bullet up to the next top-level bullet or blank line. */
function mdBullet(doc: string, opener: string): string {
  const lines = doc.split('\n')
  const i = lines.findIndex(l => l.startsWith(opener))
  if (i === -1) return ''
  const out = [lines[i]]
  for (const l of lines.slice(i + 1)) {
    if (l.trim() === '' || l.startsWith('- ')) break
    out.push(l)
  }
  // Links read as their text, bold as its words, list markers as nothing:
  // what a reader of the rendered policy sees.
  return plain(out.join('\n')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^\s*- /gm, ''))
}

/** HTML: the `<li>` whose text opens with `opener`, nested lists included, tags stripped. */
function htmlBullet(doc: string, opener: string): string {
  const start = doc.indexOf(`<li>${opener}`)
  if (start === -1) return ''
  // Walk <li> depth so a nested list inside the item stays inside it.
  const re = /<\/?li\b[^>]*>/g
  re.lastIndex = start
  let depth = 0
  let end = -1
  for (let m = re.exec(doc); m; m = re.exec(doc)) {
    depth += m[0].startsWith('</') ? -1 : 1
    if (depth === 0) { end = m.index; break }
  }
  if (end === -1) return ''
  return plain(doc.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+([.,;:)])/g, '$1'))
}

const EBIRD_MD = mdBullet(POLICY, '- **eBird**:')
const CLEAR_MD = mdBullet(POLICY, '- You can delete your stored files')
const EBIRD_HTML = htmlBullet(PRIVACY_PAGE, '<strong>eBird</strong>:')
const CLEAR_HTML = htmlBullet(PRIVACY_PAGE, 'You can delete your stored files')

/** The run of a passage from `needle` to the end of its sentence (a full stop
 *  followed by a space or the end: "ebird.org" is not a sentence end). */
function clauseWith(passage: string, needle: string): string {
  const at = passage.indexOf(needle)
  if (at === -1) return ''
  const m = /\.(?: |$)/.exec(passage.slice(at))
  return passage.slice(at, m ? at + m.index + 1 : undefined)
}

const SRC_ROOT = new URL('../', import.meta.url)
function sourceFiles(dir: URL): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) out.push(...sourceFiles(child))
    else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      // Comments stripped (testing.md v1.0.14): several of these files explain
      // the route in prose, and a mention is not a request.
      const text = readFileSync(child, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
      out.push({ name: child.pathname.slice(SRC_ROOT.pathname.length), text })
    }
  }
  return out
}

describe.each([
  ['PRIVACY_POLICY.md', EBIRD_MD, CLEAR_MD],
  ['website/privacy.html', EBIRD_HTML, CLEAR_HTML],
])('%s: the Targets tab claims (FR-61)', (_file, ebird, clearing) => {
  it('the passages are found and are the ones being read (non-vacuity)', () => {
    expect(ebird.startsWith('eBird:'), 'the eBird bullet').toBe(true)
    expect(ebird.length).toBeGreaterThan(1000)
    expect(clearing.startsWith('You can delete your stored files'), 'the clearing bullet').toBe(true)
  })

  it('names the per-day county query, over the window the sweep actually covers', () => {
    const clause = clauseWith(ebird, 'a per-day list of the species reported in a county')
    expect(clause, 'the per-day query is named').not.toBe('')
    expect(clause).toContain(`over the last ${SWEEP_DAYS} days`)
    expect(clause).toContain('when you open the Targets tab')
    expect(clause).toContain('asks again only about days whose answer was not yet final')
  })

  it('says the county species list is read by the Targets tab as well as the map', () => {
    expect(ebird).toContain("used by the map's county Completeness shading and by the Targets tab")
  })

  it('says the bar-chart file stays on the device and is not synced', () => {
    const clause = clauseWith(ebird, 'An eBird bar-chart file you add on the Targets tab')
    expect(clause, 'the bar-chart sub-bullet is present').not.toBe('')
    expect(clause).toContain('is stored only on your device')
    expect(clause).toContain('is not part of iCloud Sync')
  })

  it('lists the day-by-day reports among what clearing the eBird backup removes', () => {
    expect(clearing).toContain("the day-by-day eBird reports behind the Targets tab's live counts")
  })
})

describe('the privacy claims are true of the shipped code', () => {
  const sources = sourceFiles(SRC_ROOT)

  it('"when you open the Targets tab": the per-day request is issued only by the sweep, which only the Targets tab mounts', () => {
    // Every call site that REQUESTS the route, through any transport method.
    const requesters = sources
      .filter(f => /transport\.\w+(?:<[^>]*>)?\(\s*'\/map\/county-day-obs'/.test(f.text))
      .map(f => f.name)
    expect(requesters).toEqual(['lib/targets/useCountyDaySweep.ts'])
    // Every VALUE import of the hook (a type-only import mounts nothing).
    const mounters = sources
      .filter(f => /import\s*\{[^}]*\buseCountyDaySweep\b[^}]*\}\s*from/.test(f.text))
      .map(f => f.name)
    expect(mounters).toEqual(['components/targets/Targets.tsx'])
  })

  it('"not part of iCloud Sync": the synced slots are the two data files and nothing else', () => {
    expect([...SLOTS]).toEqual(['ebird', 'ml'])
  })

  it('"clearing your eBird backup also removes ... the day-by-day eBird reports": the day cache is registered with the clear', () => {
    expect(registeredTeardowns('ebird')).toContain('county-day-obs.json')
  })
})

// ---- The second approved round (2026-09-27, "yes to all four"): D, E, F, G --
//
// D: the uploaded-files bullet lists the bar-chart files. G: the same bullet's
// iCloud clause names its two data files. E: the Your Location paragraph lists
// the Targets tab's "My location" and says what the coordinates are used for
// there. F: the effective date moved with the policy. Same house shape as the
// rows above: each file's own passage, the claim exists, held to the code, and
// the two published files compared against each other.

/** HTML: the `<p>` whose text opens with `opener`, tags stripped. */
function htmlPara(doc: string, opener: string): string {
  const start = doc.indexOf(`<p>${opener}`)
  if (start === -1) return ''
  const end = doc.indexOf('</p>', start)
  if (end === -1) return ''
  return plain(doc.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+([.,;:)])/g, '$1'))
}

const FILES_MD = mdBullet(POLICY, '- Your API keys, app settings, and the files you upload')
const FILES_HTML = htmlBullet(PRIVACY_PAGE, 'Your API keys, app settings, and the files you upload')
const LOCATION_MD = mdBullet(POLICY, 'When you use a location control')
const LOCATION_HTML = htmlPara(PRIVACY_PAGE, 'When you use a location control')
const EFFECTIVE_MD = /^\*\*Effective date:\*\* (.+)$/m.exec(POLICY)?.[1]?.trim() ?? ''
const EFFECTIVE_HTML = /<p class="pp-date"><strong>Effective date:<\/strong>\s*([^<]+)<\/p>/.exec(PRIVACY_PAGE)?.[1]?.trim() ?? ''

describe.each([
  ['PRIVACY_POLICY.md', FILES_MD, LOCATION_MD],
  ['website/privacy.html', FILES_HTML, LOCATION_HTML],
])('%s: the uploaded files and the location controls (D, E, G)', (_file, files, location) => {
  it('the passages are found and are the ones being read (non-vacuity)', () => {
    expect(files.startsWith('Your API keys, app settings, and the files you upload')).toBe(true)
    expect(location.startsWith('When you use a location control')).toBe(true)
    expect(files.length).toBeGreaterThan(300)
    expect(location.length).toBeGreaterThan(300)
  })

  it('D: the files you upload include the bar-chart files you add on the Targets tab', () => {
    expect(files).toContain('the files you upload (your eBird backup and Macaulay Library export, and any eBird bar-chart files you add on the Targets tab)')
  })

  it('G: the iCloud clause names the two data files it copies, and only those', () => {
    expect(files).toContain('which copies the two data files (your eBird backup and Macaulay Library export)')
  })

  it('E: the Targets tab\'s location control is listed by its on-screen name, with what the coordinates are used for', () => {
    expect(location).toContain(`"${copy.CHOOSER_MY_LOCATION}" when choosing where the Targets tab measures distances from`)
    expect(location).toContain("they set the map's center, measure distances on the Targets tab, and can be saved as your default location locally")
    // The next sentence's "only sent outward if..." is still there to be true.
    expect(location).toContain('They are only sent outward if you then run a search')
  })
})

describe('D, E and G are true of the shipped code', () => {
  const sources = sourceFiles(SRC_ROOT)

  it('G: "the two data files (your eBird backup and Macaulay Library export)" are exactly the synced slots', () => {
    expect([...SLOTS]).toEqual(['ebird', 'ml'])
  })

  it('E: the Targets distance anchor reads the location on the device and sends nothing', () => {
    const anchor = sources.find(f => f.name === 'lib/targets/useDistanceAnchor.ts')
    expect(anchor, 'the anchor hook is where the published claim says it is').toBeDefined()
    // It asks the shared location seam, and it has no network or storage-write path.
    expect(anchor!.text).toMatch(/\bgetCurrentLocation\(/)
    expect(anchor!.text).not.toMatch(/\btransport\b|\bfetch\(|\bsetSetting\(|\bsetApiKey\(/)
  })

  it('D: "bar-chart files you add on the Targets tab": the add and remove paths are imported only by the Targets tab', () => {
    // Every VALUE import of the two write paths (a type-only import writes nothing).
    const importers = (name: string) => sources
      .filter(f => new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`).test(f.text))
      .map(f => f.name)
    expect(importers('importBarChartFile')).toEqual(['components/targets/TargetsBarChartFile.tsx'])
    expect(importers('removeBarChartFile')).toEqual(['components/targets/TargetsBarChartFile.tsx'])
  })
})

describe('the policy and its published page agree on D, E, F and G', () => {
  it('the uploaded-files bullet reads identically in both', () => {
    expect(FILES_HTML).toBe(FILES_MD)
  })

  it('the location-controls paragraph reads identically in both', () => {
    expect(LOCATION_HTML).toBe(LOCATION_MD)
  })

  it('F: both carry the same effective date, in the policy\'s own format', () => {
    expect(EFFECTIVE_MD).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/)
    expect(EFFECTIVE_HTML).toBe(EFFECTIVE_MD)
  })
})

// ---- README.md: the approved one-section summary (wording B) ----------------
//
// The README carries one short section per tab in DEFAULT_TAB_ORDER, named from
// TAB_LABELS (.claude/rules/docs-and-website.md, the register rule). The Targets
// section's two sentences make three checkable claims: where it sits, which
// three kinds of target it names, and which rankings it offers.

const README = readFileSync(fileURLToPath(new URL('../../../README.md', import.meta.url)), 'utf8')

function readmeSection(label: string): string {
  const start = README.indexOf(`\n### ${label}\n`)
  if (start === -1) return ''
  const rest = README.slice(start + label.length + 6)
  const next = rest.search(/\n##/)
  return plain(next === -1 ? rest : rest.slice(0, next))
}

describe('README.md: the Targets section', () => {
  const label = TAB_LABELS.targets
  const section = readmeSection(label)

  it('exists, under the tab label, between the tabs DEFAULT_TAB_ORDER puts either side of it', () => {
    expect(section.length, 'the section is present').toBeGreaterThan(100)
    const at = DEFAULT_TAB_ORDER.indexOf('targets')
    const before = TAB_LABELS[DEFAULT_TAB_ORDER[at - 1]]
    const after = TAB_LABELS[DEFAULT_TAB_ORDER[at + 1]]
    const headings = README.split('\n').filter(l => l.startsWith('### ')).map(l => l.slice(4))
    const i = headings.indexOf(label)
    expect(headings.slice(i - 1, i + 2)).toEqual([before, label, after])
  })

  it('names the three kinds of target, one media verb per media type', () => {
    expect(section).toContain('the lifers there')
    // photograph / record / film: one verb for each of Photo, Audio, Video.
    expect([...MEDIA_TYPES]).toEqual(['Photo', 'Audio', 'Video'])
    expect(section).toContain('yet to photograph, record or film')
    expect(section).toContain('never given a breeding code')
  })

  it('offers the rankings the sort control offers', () => {
    expect(section).toContain("Rank them by eBird's frequencies or by what has been reported lately")
    for (const key of ['freq-month', 'freq-year', 'live-days'] as const) expect(SORT_ORDER).toContain(key)
  })

  it('keeps the register: two sentences, no offline mention, no em dash', () => {
    expect(section.split(/\.(?: |$)/).filter(Boolean)).toHaveLength(2)
    expect(section.toLowerCase()).not.toContain('offline')
    expect(section).not.toContain('—')
  })
})

describe('the policy and its published page say the same thing', () => {
  it('the eBird bullet, sub-bullets included, reads identically in both', () => {
    expect(EBIRD_HTML).toBe(EBIRD_MD)
  })

  it('the clearing bullet reads identically in both', () => {
    expect(CLEAR_HTML).toBe(CLEAR_MD)
  })
})

describe('house copy rules over the passage', () => {
  const OFFLINE = HELP.split('\n').find(l => l.startsWith('- **Targets live counts**')) ?? ''

  it('the offline bullet exists and names what needs a connection and a key', () => {
    expect(OFFLINE).toContain('need a connection and your eBird API key')
    expect(OFFLINE).toContain('never need a connection')
  })

  it('no em dash anywhere in either', () => {
    expect(TARGETS).not.toContain('—')
    expect(OFFLINE).not.toContain('—')
  })
})
