// The published statements icloud-bar-chart-sync changed (copy items 37 to 39
// and 44), held to the code (.claude/rules/docs-and-website.md, the house
// published-claims shape; testing.md v1.0.21: a claim that rests on a guard
// needs a guard that actually reads the published file), and the one sentence
// the user decided NOT to change (items 41 to 43).
//
// Items 34 to 36 and 40 are held in targetsPublishedClaims.test.ts beside the
// rows they replaced; this file carries the rest:
//   37  the iCloud Sync opening paragraph names the data files it keeps the same
//   38  "What is stored in iCloud" names the bar-chart files and states the one
//       cache that is written, as what is in it and whose it is
//   39  "Remove synced files from iCloud" reaches the bar-chart files and the
//       day lists
//   41  README, 42 the website, 43 the App Store listing's privacy paragraph:
//       DECLINED by the user on 2026-09-29. The one privacy sentence the three
//       share stays as it was and does not name the bar-chart files (the
//       user's reason is quoted at that block below).
//   44  the App Store review notes' iCloud Sync bullet, with the user's
//       correction of its last clause ("nothing from the user's files")
//
// House shape: each file's OWN passage is extracted, each row asserts the claim
// EXISTS before checking it, the claims are held to the code that makes them
// true, and the files that state one thing are compared against EACH OTHER.
//
// WHAT THIS CANNOT SEE: whether a sentence reads well, and any claim made in
// words that name no code. Those stay with review.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SLOTS } from './icloud/icloudRecord'
import { ITEM_SUBDIRS } from './icloud/icloudNative'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8')
const POLICY = read('PRIVACY_POLICY.md')
const PAGE = read('website/privacy.html')
const README = read('README.md')
const INDEX = read('website/index.html')
const LISTING = read('appstore/LISTING.md')
const RUST = read('src-tauri/src/icloud.rs')
const src = (rel: string) => read(`frontend/src/${rel}`)
/** Source with comments stripped (testing.md v1.0.14): a mention is not a call. */
const code = (rel: string) => src(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const plain = (s: string) => s.replace(/\s+/g, ' ').trim()
/** What a reader of the rendered page sees: tags gone, bold as its words, links as their text. */
const htmlText = (s: string) => plain(s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')).replace(/\s+([.,;:)])/g, '$1')
const mdText = (s: string) => plain(s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/^\s*- /gm, ''))

/** The iCloud Sync section of each policy file, as rendered text. */
function mdSection(): string {
  const m = /^## iCloud Sync\n/m.exec(POLICY)
  if (!m) return ''
  const rest = POLICY.slice(m.index + m[0].length)
  const b = rest.search(/^## /m)
  return mdText(b > 0 ? rest.slice(0, b) : rest)
}
function htmlSection(): string {
  const m = /<h2 id="icloud-sync">[^<]*<\/h2>/.exec(PAGE)
  if (!m) return ''
  const rest = PAGE.slice(m.index + m[0].length)
  const b = rest.search(/<h2 /)
  return htmlText(b > 0 ? rest.slice(0, b) : rest)
}

/** The sentence containing `needle` (a full stop followed by a space or the end ends one). */
function sentenceWith(text: string, needle: string): string {
  const at = text.indexOf(needle)
  if (at === -1) return ''
  const before = text.slice(0, at)
  const starts = [...before.matchAll(/\.\s/g)]
  const start = starts.length ? starts[starts.length - 1].index! + 2 : 0
  const m = /\.(?:\s|$)/.exec(text.slice(at))
  return text.slice(start, m ? at + m.index + 1 : undefined).trim()
}

const MD = mdSection()
const HTML = htmlSection()

describe.each([
  ['PRIVACY_POLICY.md', MD],
  ['website/privacy.html', HTML],
])('%s: the iCloud Sync section (items 37 to 39)', (_file, section) => {
  it('the section is found and is the one being read (non-vacuity)', () => {
    expect(section.startsWith('On the Mac, iPhone and iPad apps, SnowRaven can keep'), section.slice(0, 60)).toBe(true)
    expect(section.length).toBeGreaterThan(2000)
    expect(section).toContain('Whose account.')
  })

  it('37: the opening paragraph names the data files it keeps the same, the bar-chart files included', () => {
    expect(section).toContain('SnowRaven can keep your data files (your eBird backup, your Macaulay Library export and any eBird bar-chart files you have added on the Targets tab) the same across your own devices through iCloud.')
    expect(section).not.toContain('your two data files')
  })

  it('38: what is written names each county\'s bar-chart file', () => {
    expect(section).toContain("SnowRaven writes your eBird backup, your Macaulay Library export and each county's eBird bar-chart file into an iCloud container that belongs to your Apple ID")
  })

  it('38: "never synced" survives, with the one exception stated as what is in it and whose it is', () => {
    const s = sentenceWith(section, 'Your app settings, map preferences and cached lookups stay on each device')
    expect(s, 'the never-synced sentence is present').not.toBe('')
    expect(s).toContain('are never synced, with one exception: the day-by-day lists of species that eBird reported in a county, which the Targets tab fetches with your key, are written into the same container as one copy per device')
    expect(s).toContain("each holding the day lists that device has, whether it fetched them from eBird or took them from your other devices' copies (the county, the day, when the list was asked for and whether the day was over by then, the list's size, and each species eBird listed with the time and place of that report as eBird gives them), along with the same small record each file has")
    expect(s).toContain('so your other devices do not repeat those requests.')
    expect(section).toContain('They hold nothing from your own files.')
  })

  it('39: Remove synced files from iCloud reaches the bar-chart files and the day lists', () => {
    expect(section).toContain('Remove synced files from iCloud in the same section deletes the file copies in your iCloud account, the bar-chart files and the day-by-day lists included, without touching any device')
  })

  // help-docs-refresh H-P3: the one route by which details about the user's
  // synced files can reach the developer, and only by the user's own paste.
  it('Copy iCloud details: what the report holds, what it never holds, and that it leaves only by your own paste', () => {
    expect(section).toContain('Copy iCloud details. If sync is not working, Copy iCloud details at the foot of the iCloud Sync section in Settings puts a plain-text report on your clipboard')
    expect(section).toContain("your devices' names and the random identifier the app made up for each, whether iCloud is available, county codes, file sizes and dates, sync states, and Apple's error codes and messages")
    expect(section).toContain('It holds no file contents, no file names you chose and no API keys.')
    expect(section).toContain('SnowRaven never sends it anywhere itself: it reaches the developer only if you paste it into a message.')
  })
})

describe('the two policy files state items 37 to 39 identically', () => {
  it('the iCloud Sync section reads the same in both (as rendered text)', () => {
    for (const needle of [
      'SnowRaven can keep your data files',
      'SnowRaven writes your eBird backup',
      'Your app settings, map preferences and cached lookups',
      'Remove synced files from iCloud in the same section',
      // help-docs-refresh H-P3
      'If sync is not working, Copy iCloud details',
      'It lists what iCloud reports for each synced file',
      'It holds no file contents',
      'SnowRaven never sends it anywhere itself',
    ]) {
      expect(sentenceWith(HTML, needle), needle).toBe(sentenceWith(MD, needle))
      expect(sentenceWith(MD, needle), needle).not.toBe('')
    }
  })
})

describe('the Copy iCloud details sentences are true of the shipped code (help-docs-refresh H-P3)', () => {
  it('the button is named as published, and the report goes only to the clipboard', () => {
    expect(src('lib/icloud/icloudCopy.ts')).toContain("copyDetails: 'Copy iCloud details',")
    // Settings hands the report to the clipboard seam and nothing else.
    const settings = code('components/Settings.tsx')
    expect(settings).toContain('const report = await icloudActions.detailsReport()')
    expect(settings).toContain('if (report === null || !(await copyText(report))) return')
    // The builder is pure: no network, no storage, no native call of its own.
    const builder = code('lib/icloud/icloudDiagnostics.ts')
    expect(builder).toContain('export function buildICloudReport(input: DetailsInput): string {')
    expect(builder).not.toMatch(/\btransport\b|\bfetch\(|\binvoke\(|\bstorage\./)
  })

  it('"no file contents, no file names you chose and no API keys": the builder reads only its allowed fields', () => {
    // The module's own contract, stated where the fields are read.
    const header = src('lib/icloud/icloudDiagnostics.ts')
    expect(header).toContain('ALLOWED FIELDS ONLY.')
    expect(header).toContain('never carries: a byte of any file, a filename the user chose, a digest, an\n// API key.')
    // The input type carries no key and no file text at all.
    const input = /export interface DetailsInput \{([\s\S]*?)\n\}/.exec(header)![1]!
    expect(input).not.toMatch(/apiKey|ebirdKey|openweather|csv|fileText|contents/i)
  })
})

describe('items 37 to 39 are true of the shipped code', () => {
  it('"your data files (... any eBird bar-chart files ...)": the two slots, plus one item per county under barcharts/', () => {
    expect([...SLOTS]).toEqual(['ebird', 'ml'])
    expect(ITEM_SUBDIRS.barchart).toBe('barcharts')
    expect(RUST).toContain('const BARCHARTS_SUBDIR: &str = "barcharts";')
    expect(RUST).toContain('ItemKind::Barchart => BARCHARTS_SUBDIR')
    expect(RUST).toContain('SyncItem::County(c) => format!("{}.txt", c.as_str())')
  })

  it('"one copy per device, each holding the day lists that device has, whether it fetched them from eBird or took them from your other devices\' copies": a merged peer entry joins this device\'s own document, which goes up after the merge (security L3)', () => {
    // The merge puts a taken peer entry into this device's own live store,
    // carrying no mark of where it came from (the entry's fields are pinned in
    // the next row), and schedules the same flush a fetched day does.
    const cache = code('lib/countyDayObsCache.ts')
    const merge = cache.slice(cache.indexOf('export async function mergeSharedSnapshot('))
    const mergeBody = merge.slice(0, merge.indexOf('\n}\n'))
    expect(mergeBody).toContain('const store = await ensureLoaded()')
    expect(mergeBody).toContain('insertEntry(store, key, peer)')
    expect(mergeBody).toContain('scheduleWrite(store)')
    // That flush writes the WHOLE mirror, peers' entries with this device's own, to the one local document.
    const flush = cache.slice(cache.indexOf('function flushStore('))
    const flushBody = flush.slice(0, flush.indexOf('\n}\n'))
    expect(flushBody).toContain('Object.assign(Object.create(null) as Record<string, DayObsEntry>, store.entries)')
    expect(flushBody).toContain('storage.setCountyDayObsStore(snapshot)')
    // Merge, then drain the writer, then push this device's own copy under its own id, in that order.
    const pass = code('lib/icloud/dayObsSync.ts')
    const run = pass.slice(pass.indexOf('export async function runDayObsPass('))
    const merged = run.indexOf('await ctx.mergeSnapshot(text, gen)')
    const drained = run.indexOf('await ctx.awaitWrites()')
    const pushed = run.indexOf('ctx.native.pushItem(snapshotItem(ctx.deviceId), DAY_OBS_FILENAME')
    expect(merged, 'the pull half merges').toBeGreaterThan(-1)
    expect(drained, 'the writer drains after the merge').toBeGreaterThan(merged)
    expect(pushed, 'the push follows the drain').toBeGreaterThan(drained)
    // The pushed copy is that same local document, read natively, one per device.
    expect(pass).toContain("export const DAY_OBS_FILENAME = 'county-day-obs.json'")
    expect(RUST).toContain('const LOCAL_DAY_OBS_FILE: &str = "county-day-obs.json";')
    expect(RUST).toContain('SyncItem::DayObs(_) => data_dir.join(LOCAL_DAY_OBS_FILE)')
    expect(RUST).toContain('SyncItem::DayObs(d) => format!("{}.json", d.as_str())')
    expect(ITEM_SUBDIRS['day-obs']).toBe('day-obs')
  })

  it('"the county, the day, when the list was asked for and whether the day was over by then, the list\'s size, and each species eBird listed with the time and place": the snapshot entry carries exactly those fields', () => {
    const reduce = src('lib/countyDayObsReduce.ts')
    const decl = reduce.slice(reduce.indexOf('export interface DayRecord {'))
    const fields = [...decl.slice(0, decl.indexOf('\n}')).matchAll(/^\s+(\w+):/gm)].map(m => m[1])
    expect(fields).toEqual(['speciesCode', 'obsDt', 'locId', 'locName', 'lat', 'lng'])
    // Per day: when the list was asked for, whether the day was over by then, the list's size, the species (security L2).
    const cache = src('lib/countyDayObsCache.ts')
    const entry = cache.slice(cache.indexOf('export interface DayObsEntry {'))
    expect([...entry.slice(0, entry.indexOf('\n}')).matchAll(/^\s+(\w+):/gm)].map(m => m[1])).toEqual(['fetchedAt', 'complete', 'bytes', 'species'])
    // Keyed by county and day.
    expect(cache).toMatch(/export function dayObsKey\(regionCode: string, date: string\): string/)
  })

  it('"which the Targets tab fetches with your key ... nothing from your own files": the store is filled from eBird and from peers only', () => {
    const cache = code('lib/countyDayObsCache.ts')
    // The one network entry is an injected loader; the only other way in is the merge.
    expect(cache).not.toMatch(/\btransport\b|\bfetch\(/)
    expect(cache).toContain('export async function mergeSharedSnapshot(')
    // Nothing that reads the user's own export feeds it.
    expect(cache).not.toMatch(/observationsCache|parseCSV|ebird-backup/)
  })

  it('"deletes ... the bar-chart files and the day-by-day lists included": the native Remove clears both kinds', () => {
    const all = RUST.slice(RUST.indexOf('pub async fn icloud_remove_all('))
    const body = all.slice(0, all.indexOf('\n}\n'))
    expect(body).toContain('remove_items_in(&docs, ItemKind::Barchart)?')
    expect(body).toContain('remove_items_in(&docs, ItemKind::DayObs)?')
  })
})

// ---- Items 41 to 43: DECLINED, the one sentence stays as it was ---------------
//
// The held patch added "eBird bar-chart files" to the privacy sentence README,
// the website and the App Store listing share. The user declined all three on
// 2026-09-29 (pipeline/icloud-bar-chart-sync/decisions.md, entry 16): "bar-chart
// files are eBird data the app can't fetch directly, not the user's personal
// data", and the sentence lists personal data. So this block asserts the
// APPROVED state: the sentence is unchanged, identical in all three, and does
// not name the bar-chart files. A future synced kind does NOT oblige an edit
// here unless it is the user's personal data, and any edit to these three files
// still needs the user's approval first (CLAUDE.md, published copy).

const POSTURE = 'Your eBird backup, Macaulay Library export and API keys are stored only on your device unless you turn on iCloud syncing between your devices, and anything you sync goes to your own iCloud account and nowhere else.'

describe.each([
  ['README.md', plain(README)],
  ['website/index.html', htmlText(INDEX)],
  ['appstore/LISTING.md', plain(LISTING.slice(LISTING.indexOf('\nPRIVACY\n'), LISTING.indexOf("\nWHAT YOU'LL NEED\n")))],
])('%s: the privacy sentence (items 41 to 43, declined)', (_file, text) => {
  it('carries the unchanged sentence, which does not name the bar-chart files', () => {
    const s = sentenceWith(text, 'Your eBird backup, Macaulay Library export')
    expect(s, 'the privacy sentence is present').not.toBe('')
    expect(s).toBe(POSTURE)
    expect(s).not.toMatch(/bar-chart/i)
  })
})

describe('items 41 to 43: the three files agree with each other', () => {
  it('the three files state the sentence identically', () => {
    const got = [plain(README), htmlText(INDEX), plain(LISTING)].map(t => sentenceWith(t, 'Your eBird backup, Macaulay Library export'))
    expect(new Set(got).size).toBe(1)
    expect(got[0]).toBe(POSTURE)
  })
})

describe('item 36 is true of the shipped code: the bar-chart files leave the device only through iCloud Sync', () => {
  it('"with iCloud Sync on it is copied to your own iCloud account": the only non-local writer of a bar-chart file is the county pass', () => {
    expect(src('lib/icloud/countySync.ts')).toContain('pushItem(')
    expect(src('lib/icloud/icloudNative.ts')).toContain("callItem<NativeItemPushResult>('icloud_push_item'")
  })
})

// ---- Item 44: the App Store review notes -------------------------------------

describe('appstore/LISTING.md: the iCloud Sync review-notes bullet (item 44)', () => {
  const at = LISTING.indexOf('- **iCloud Sync (v1.0.11')
  const bullet = plain(LISTING.slice(at, LISTING.indexOf('\n- **', at + 1)))

  it('the bullet is found and is the one being read (non-vacuity)', () => {
    expect(at).toBeGreaterThan(-1)
    expect(bullet.length).toBeGreaterThan(600)
    expect(bullet).toMatch(/"Data Not Collected" holds/)
  })

  it('dates the bar-chart and day-list sync, names the data files, and states the one cache', () => {
    expect(bullet).toContain('**iCloud Sync (v1.0.11; bar-chart files and the Targets day lists from v1.0.40):**')
    expect(bullet).toContain("copies the user's data files (the eBird backup, the Macaulay Library export and any eBird bar-chart files added on the Targets tab, each with a small record naming the file, its upload time, and a random per-device id with the device's name)")
    // The last clause is the user's correction at the approval (2026-09-29):
    // "nothing from the user's files", the same provenance claim as item 38.
    expect(bullet).toContain('Settings are never written to it. The one cache that is: the Targets tab\'s per-day lists of species eBird reported in a county, one copy per device, so the user\'s other devices do not repeat those eBird requests; they hold nothing from the user\'s files.')
    expect(bullet).not.toContain('they hold no user sightings')
    expect(bullet).not.toContain('Settings and caches are never written to it.')
    expect(bullet).not.toContain("the user's two data files")
  })

  it('agrees with the policy about the one cache', () => {
    expect(MD).toContain('one copy per device')
    expect(bullet).toContain('one copy per device')
    expect(MD).toContain('They hold nothing from your own files.')
    expect(bullet).toContain("they hold nothing from the user's files.")
  })
})

describe('house copy rules over the changed passages', () => {
  it('no em dash in any of them', () => {
    for (const t of [MD, HTML, plain(README), htmlText(INDEX), plain(LISTING)]) expect(t).not.toContain('\u2014')
  })
})
