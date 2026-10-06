/// <reference types="node" />
// THE PRIVACY POLICY AND THE ACCESSIBILITY STATEMENT, HELD TO THE CODE
// (help-docs-refresh, audit section H). The house pattern
// (palettePublishedClaims.test.ts, .claude/rules/docs-and-website.md): each row
// reads the file's OWN paragraph, first asserts the claim EXISTS (deleting the
// sentence must go red), then holds it to the source that makes it true, and a
// privacy sentence is compared word for word with its mirror on
// website/privacy.html.
//
// The other rows over these two files stay where they are (widgetsPublishedClaims
// for the "What you send" paragraph's developer scope, targetsPublishedClaims for
// the location paragraph's Targets clause and its page parity,
// icloudBarChartPublishedClaims for the iCloud Sync section, weatherStatsPublishedClaims
// for the GRAPHIC and ROWS OF TEXT chart rule); this file carries only the
// sentences this change wrote.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { metricNoun } from './calendar'
import { mediaFormatPhrases } from './calendarOverlays'
import { BREEDING_CATEGORY_LABELS } from './breedingCodes'
import { PLAN_COPY } from './planCopy'
import { TAB_LABELS } from './tabLayout'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
/** Source with comments stripped (testing.md v1.0.14): a mention is not a call. */
const code = (rel: string) => read(`frontend/src/${rel}`)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const POLICY = read('PRIVACY_POLICY.md')
const PAGE = read('website/privacy.html')
const A11Y = read('ACCESSIBILITY.md')

const plain = (s: string) => s.replace(/\s+/g, ' ').trim()
/** A Markdown paragraph (blank-line delimited) that opens with `opener`, as rendered text. */
function mdPara(doc: string, opener: string): string {
  const p = doc.split('\n\n').find(b => b.trimStart().startsWith(opener)) ?? ''
  return plain(p.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, ''))
}
/** The page's `<p>` that opens with `opener`, tags stripped. */
function htmlPara(doc: string, opener: string): string {
  const start = doc.indexOf(`<p>${opener}`)
  if (start === -1) return ''
  const end = doc.indexOf('</p>', start)
  return plain(doc.slice(start, end).replace(/<[^>]+>/g, ' ')).replace(/\s+([.,;:)])/g, '$1')
}
/** The sentence of `text` that contains `needle`. */
function sentenceWith(text: string, needle: string): string {
  const at = text.indexOf(needle)
  if (at === -1) return ''
  const starts = [...text.slice(0, at).matchAll(/\.\s/g)]
  const start = starts.length ? starts[starts.length - 1].index! + 2 : 0
  const m = /\.(?:\s|$)/.exec(text.slice(at))
  return text.slice(start, m ? at + m.index + 1 : undefined).trim()
}

// ── PRIVACY_POLICY.md ───────────────────────────────────────────────────────

describe('H-P1: "Anything the app saves from an answer stays on your device" names its iCloud exception', () => {
  const OPENER = 'What you send to these services'
  const md = mdPara(POLICY, OPENER)
  const html = htmlPara(PAGE, OPENER)

  it('the paragraph is found in both files and is the one being read', () => {
    expect(md.length).toBeGreaterThan(300)
    expect(html.length).toBeGreaterThan(300)
  })

  it('states the exception in the same sentence as the rule, and points at the iCloud Sync section', () => {
    const s = sentenceWith(md, 'Anything the app saves from an answer stays on your device')
    expect(s).toContain("with iCloud Sync on, the Targets tab's day-by-day eBird answers are also copied to your own iCloud account, one copy per device")
    expect(s).toContain('(see the iCloud Sync section below)')
    // The iCloud Sync section it points at says the same thing (no contradiction left).
    expect(POLICY).toMatch(/written into the same container as one copy per device/)
  })

  it('reads word for word the same on website/privacy.html', () => {
    expect(html).toBe(md)
  })

  it('is true of the code: the day lists are a synced item kind beside the bar-chart files', () => {
    expect(code('lib/icloud/icloudNativeTypes.ts')).toMatch(/export type ItemKind = 'barchart' \| 'day-obs'/)
  })
})

describe('H-P2: the location paragraph lists the Weather tab\'s Plan form', () => {
  const OPENER = 'When you use a location control'
  const md = mdPara(POLICY, OPENER)
  const html = htmlPara(PAGE, OPENER)

  it('the paragraph is found in both files and names the form by its on-screen label', () => {
    expect(md.length).toBeGreaterThan(300)
    expect(md).toContain(`Pressing the Weather tab's "${PLAN_COPY.entryLabel}" button with no place chosen yet asks the same way, to fill in "Your location" in the form it opens; nothing is sent until you press one of that form's two buttons.`)
    expect(md).toContain(`or press either of the "${PLAN_COPY.entryLabel}" form's two buttons, which sends them to the same two services for the forecast there`)
    expect(html).toBe(md)
  })

  it('is true of the code: pressing Plan with no place reads the location, labels it "Your location", and sends nothing', () => {
    const panel = code('components/WeatherForecastPanel.tsx')
    // android-release FR-56: the read is skipped where showLocationControls()
    // is false (Android under location branch B, which has no location control
    // for this paragraph to describe); it is true on every platform the
    // paragraph names (platformGates.test.ts).
    expect(panel).toContain("if (!presetError && !coordRef.current && showLocationControls()) {\n      try { const c = await getCurrentLocation(); setCoord(c); setPlace('Your location') } catch")
    // The read runs only from the Plan button, and the opening itself fetches nothing.
    expect(panel).toContain('onClick={() => void openPredict()}')
    const open = panel.slice(panel.indexOf('const openPredict = useCallback('), panel.indexOf('}, [setCoord])', panel.indexOf('const openPredict = useCallback(')))
    expect(open.length).toBeGreaterThan(100)
    expect(open).not.toMatch(/\btransport\b|\bfetch\(|runLookup|runPlan/)
    // The form's two buttons are the two actions.
    expect(panel).toContain('{PLAN_COPY.forecastAction}')
    expect(panel).toContain('{PLAN_COPY.actionLabel}')
    // Both actions are the replayable weather and tide reads, the same two services.
    expect(panel).toContain("transport.getReplayable<WeatherAtResponse>('/weather/at', wParams)")
    expect(panel).toContain("transport.getReplayable<TideAtResponse>('/tide/at', tParams)")
    expect(panel).toContain("transport.getReplayable<WeatherPlan>('/weather/plan', params)")
    expect(panel).toContain("transport.getReplayable<TidePlanResponse>('/tide/plan', params)")
  })
})

describe('H-P2 (Auditor I6): the iOS location prompt can first come from Current or Plan', () => {
  const OPENER = 'On iPhone and iPad, the first time SnowRaven asks for your location'
  const md = mdPara(POLICY, OPENER)
  // The page writes the arrows and ampersand as entities; compare the sentence that changed.
  const html = htmlPara(PAGE, OPENER).replace(/&rarr;/g, '→').replace(/&amp;/g, '&')

  it('names the first request as the trigger, with its examples, in both files', () => {
    const s = sentenceWith(md, OPENER)
    expect(s).toContain(`(for example when you tap "Use my location", use the "Current" lookup, or press "${PLAN_COPY.entryLabel}" with no place chosen) iOS shows the system location permission prompt`)
    expect(md).not.toContain('the first time you tap "Use my location"')
    expect(sentenceWith(html, OPENER)).toBe(s)
    expect(html).toBe(md)
  })

  it('is true of the code: Current and Plan both read the location through the shared seam', () => {
    const panel = code('components/WeatherForecastPanel.tsx')
    expect(panel).toContain('try { c = await getCurrentLocation() }')
    expect(panel).toContain("try { const c = await getCurrentLocation(); setCoord(c); setPlace('Your location') } catch")
  })
})

// ── The optional extras the user chose (1, 2, 3, 4, 5 and 8) ─────────────────

/** The policy's list item that opens with `opener`, as rendered text (bold markers dropped). */
function mdItem(doc: string, opener: string): string {
  const line = doc.split('\n').find(l => l.startsWith(`- ${opener}`)) ?? ''
  return plain(line.replace(/^- /, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, ''))
}
/** The page's `<li>` whose text opens with `opener`, up to its first nested list or its end, tags stripped. */
function htmlItem(doc: string, opener: string): string {
  const start = doc.indexOf(`<li>${opener}`)
  if (start === -1) return ''
  const ends = [doc.indexOf('</li>', start), doc.indexOf('<ul>', start)].filter(i => i > -1)
  return plain(doc.slice(start, Math.min(...ends)).replace(/<[^>]+>/g, ' ')).replace(/\s+([.,;:)])/g, '$1')
}

describe('extras 1 and 4: the "You can delete your stored files" point', () => {
  const OPENER = 'You can delete your stored files'
  const md = mdItem(POLICY, OPENER)
  const html = htmlItem(PAGE, OPENER)

  it('the point is found in both files and reads the same', () => {
    expect(md.length).toBeGreaterThan(500)
    expect(html).toBe(md)
  })

  it('extra 4: says what a clear with sync on does on your other devices, switch by switch', () => {
    const s = sentenceWith(md, 'With iCloud Sync on, clearing a data file')
    expect(s).toBe('With iCloud Sync on, clearing a data file or removing a bar-chart file also removes it from iCloud, and with Sync API keys on, clearing a key does the same; each of your other devices then removes its copy at its next check if it has the same switch on, and a device with it off keeps its own.')
  })

  it('extra 4 is true of the code: the clears with sync on go through iCloud, and only an enabled device applies them', () => {
    const state = code('lib/icloud/icloudState.ts')
    expect(state).toContain('clearWithSync(slot: Slot): Promise<readonly string[]>')
    expect(state).toContain('barChartsCleared(regionCodes: readonly string[], clearedAt: string): Promise<void>')
    expect(state).toContain('clearKeyWithSync(slot: KeySlot): Promise<void>')
    // Both places that remove bar-chart files hand the removal to iCloud.
    expect(code('components/targets/TargetsBarChartFile.tsx')).toContain('void icloudActions.barChartsCleared([regionCode], clearedAt)')
    expect(code('components/Settings.tsx')).toContain('if (withSync && r.removed.length > 0) void icloudActions.barChartsCleared(r.removed, new Date().toISOString())')
    // This device writes the cleared marker only with sync on; another device applies it in its own sync pass.
    const sync = code('lib/icloud/icloudSync.ts')
    const fn = sync.slice(sync.indexOf('async function barChartsCleared('))
    expect(fn.slice(0, 200)).toContain('if (!pref.enabled) return')
    expect(code('lib/icloud/countySync.ts')).toContain('await ctx.storage.applySyncedBarChartClear(code, meta.uploadedAt)')
  })

  it('extra 1: the Alerts position is in the list, as the iOS App section already says', () => {
    expect(sentenceWith(md, 'Clearing your eBird backup also removes')).toContain('and the Alerts inbox together with any alert waiting for the end of your quiet hours and the position the app read for Alerts.')
    expect(POLICY).toContain('clearing your eBird backup removes the inbox, any alert waiting for the end of your quiet hours, and the position the app read')
    const engine = read('src-tauri/gen/apple/Sources/snowraven/AlertsLogic/AlertsEngine.swift')
    const purge = engine.slice(engine.indexOf('func purgeInbox()'), engine.indexOf('func purgeInbox()') + 600)
    expect(purge).toContain('st.position = nil')
  })
})

describe('extras 3 and 5: the eBird point', () => {
  const OPENER = '<strong>eBird</strong>:'
  const md = mdItem(POLICY, '**eBird**:')
  const html = htmlItem(PAGE, OPENER)

  it('extra 3: names every time the Targets tab asks for the 30 days, in both files', () => {
    const needle = 'a per-day list of the species reported in a county over the last 30 days'
    const s = sentenceWith(md, needle)
    expect(s).toContain('when you open the Targets tab and whenever you choose another county there, and again when your connection or key comes back or you press Retry (the answers are kept on your device, so each of these asks again only about days whose answer was not yet final:')
    expect(sentenceWith(html, needle)).toBe(s)
  })

  it('extra 3 is true of the code: the sweep re-runs on the county, the key, the connection and Retry', () => {
    const sweep = code('lib/targets/useCountyDaySweep.ts')
    expect(sweep).toContain('}, [regionCode, hasEbirdKey, online, nonce])')
    expect(sweep).toContain('const retry = useCallback(() => setNonce(n => n + 1), [])')
  })

  it('extra 5: the escapee sub-point states the covering set as a property, with no count', () => {
    const sub = (doc: string) => sentenceWith(plain(doc.replace(/<[^>]+>/g, ' ')), 'It sends only your own checklist IDs, and only a small covering subset of them')
    const s = sub(POLICY)
    expect(s).toBe('It sends only your own checklist IDs, and only a small covering subset of them (a set of checklists that between them carry every species you have recorded, worked out on your device before anything is sent), not your whole history.')
    expect(sub(PAGE)).toBe(s)
    expect(POLICY).not.toMatch(/\d[\d,]* on a [\d,]+-observation export/)
    expect(PAGE).not.toMatch(/\d[\d,]* on a [\d,]+-observation export/)
  })

  it('extra 5 is true of the code: the set is a greedy cover over your species, built on the device', () => {
    expect(read('frontend/src/lib/exoticProvenance.ts')).toContain('export function greedyCover(')
    expect(code('lib/useExoticProvenance.ts')).toContain('greedyCover(')
  })
})

describe('extra 2: the OpenWeather point covers the Planner\'s forecast window', () => {
  const md = mdItem(POLICY, '**OpenWeather**:')
  const html = htmlItem(PAGE, '<strong>OpenWeather</strong>:')

  it('names the three kinds of request, in both files', () => {
    expect(md).toContain('to fetch weather: the historical weather for a checklist, the current or forecast weather for a location and time you choose, or the forecast across the days ahead for a place you choose.')
    expect(html).toBe(md)
  })

  it('is true of the code: the plan\'s weather is one OpenWeather One Call request', () => {
    expect(read('backend/routers/weather.py')).toContain('@router.get("/weather/plan")')
    expect(read('backend/routers/weather.py')).toContain('Exactly one OpenWeather request and zero NOAA requests on')
    expect(code('lib/tauri/weatherService.ts')).toContain('const onecall = await fetchForecast(lat, lng, owmKey);')
  })
})

describe('extra 8: the privacy page\'s summary band', () => {
  it('the "Keys & data stay local" tile names the device, a self-hosted server and the opt-in iCloud copy', () => {
    const tile = /<li><strong>Keys &amp; data stay local<\/strong><span>([^<]*)<\/span><\/li>/.exec(PAGE)
    expect(tile).not.toBeNull()
    expect(tile![1]).toBe('Device or server, plus iCloud if you sync')
    // The policy it summarizes says the same three things.
    expect(POLICY).toContain('or on your own machine when you self-host the web/Pi version, unless you turn on the optional iCloud Sync')
  })
})

// ── ACCESSIBILITY.md ────────────────────────────────────────────────────────

describe('H-A1: the opening names every platform the statement goes on to describe', () => {
  it('names the browser, the Mac and Windows apps, and the iPhone, iPad, and Android app', () => {
    const opening = A11Y.split('\n\n')[1] ?? ''
    expect(opening).toContain('It runs in the browser, as a desktop app on Mac and Windows, and as an app on iPhone, iPad, and Android')
    // The capabilities the app ships with are the platform list (android-release
    // added Android to the mobile capability, so the statement names it).
    expect(read('src-tauri/capabilities/desktop.json')).toMatch(/"platforms": \[[^\]]*"macOS"[^\]]*"windows"/)
    expect(read('src-tauri/capabilities/mobile.json')).toContain('"platforms": ["iOS", "android"]')
  })
})

describe('H-A2: the Calendar day name quoted is the one the cell builds', () => {
  const para = A11Y.split('\n\n').find(p => p.startsWith('**The Calendar:**')) ?? ''

  it('the paragraph is found', () => {
    expect(para.length).toBeGreaterThan(500)
  })

  it('quotes the plain day name as the builder makes it, the unit included', () => {
    expect(para).toContain(`("Mar 14, 2025: 3 ${metricNoun('species', false)}. Open day details")`)
    expect(code('components/Calendar.tsx')).toContain('return `${dateLabel}: ${desc.count} ${metricNoun(metric, withForms)}${suffix}. Open day details`')
  })

  it('quotes the overlay clauses as the builder makes them', () => {
    const media = mediaFormatPhrases({ total: 4, photo: 3, audio: 1, video: 0, unknown: 0 }).join(', ')
    const breeding = `NY 1 (${BREEDING_CATEGORY_LABELS.confirmed})`
    expect(para).toContain(`("Mar 14, 2025: 3 ${metricNoun('species', false)}, media: ${media}, breeding: ${breeding}. Open day details")`)
    const overlays = code('lib/calendarOverlays.ts')
    expect(overlays).toContain('? `, media: ${mediaFormatPhrases(counts).join(\', \')}`')
    expect(overlays).toContain("out += `, breeding: ${parts.join(', ')}`")
  })
})

describe('H-A3: the load-failure regions are stated as a property, not a count of tabs', () => {
  const para = A11Y.split('\n\n').find(p => p.startsWith('SnowRaven uses semantic structure')) ?? ''
  const known = A11Y.split('\n\n').find(p => p.startsWith('The cross-cutting items previously tracked here')) ?? ''

  it('names the rule that decides membership, with examples given as examples', () => {
    expect(para).toContain(`on each tab that loads one of those files as it opens (${TAB_LABELS['birding-stats']}, ${TAB_LABELS.targets} and the ${TAB_LABELS['map-explorer']} among them)`)
    expect(known).toContain('on those tabs and on the weather backlog, are one shared component')
  })

  it('carries no count of tabs in either place', () => {
    const counted = /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+) tabs\b/i
    expect(para).not.toMatch(counted)
    expect(known).not.toMatch(counted)
  })

  it('each named example, and the weather backlog, mounts the one shared region', () => {
    for (const file of ['components/BirdingStats.tsx', 'components/targets/Targets.tsx', 'components/MapExplorer.tsx', 'components/WeatherBacklog.tsx']) {
      expect(code(file), file).toMatch(/import \{ TabLoadErrorAlert \} from '\.{1,2}\/ui\/TabLoadErrorAlert'/)
      expect(code(file), file).toContain('<TabLoadErrorAlert')
    }
  })
})

describe('H-A4: a chart that is a control is described by its controls', () => {
  const para = A11Y.split('\n\n').find(p => p.startsWith('SnowRaven uses semantic structure')) ?? ''

  it('states the third case beside the GRAPHIC and ROWS OF TEXT rules, with its two instances', () => {
    expect(para).toContain('A chart drawn as a GRAPHIC')
    expect(para).toContain('A chart that is itself a CONTROL, or holds controls, is described by those controls instead of by an image role')
    expect(para).toContain("The Weather tab's plan timeline is one such chart")
    expect(para).toContain('the Splits and Lumps chart on Species Detail is another: its species names are buttons')
  })

  it('is true of the code: the plan timeline is one slider over a hidden canvas', () => {
    const chart = code('components/PlanChart.tsx')
    expect(chart).toContain('role="slider"')
    expect(chart).toContain('<div className="sr-plan-canvas" aria-hidden="true" inert')
    expect(chart).not.toContain('role="img"')
  })

  it('is true of the code: the Splits and Lumps chart keeps its name buttons exposed and carries a text equivalent', () => {
    const src = read('frontend/src/components/speciesDetail/SplitsLumps.tsx')
    expect(src).toContain("a recorded, non-selected entry's name is a real button")
    expect(src).toContain('the visually hidden text equivalent after it')
    expect(code('components/speciesDetail/SplitsLumps.tsx')).not.toContain('role="img"')
  })
})

describe('H-A5 and the policy: American spelling and no em dash in the published statements', () => {
  // The house list (widgets/widgetCopy.test.ts) plus the two the audit found here.
  const BRITISH = /\b(colour|behaviour|favourite|centre|metre|kilometre|organise|recognise|licence|grey|catalogue|analyse|neighbour|honour|travelled|modelled|labelled)\w*/i

  it.each([
    ['ACCESSIBILITY.md', A11Y],
    ['PRIVACY_POLICY.md', POLICY],
    ['website/privacy.html', PAGE],
  ])('%s', (_name, text) => {
    expect(text.length).toBeGreaterThan(2000)
    expect(BRITISH.exec(text)?.[0] ?? null).toBeNull()
    expect(text.includes('\u2014')).toBe(false)
  })

  it('the scan is not vacuous', () => {
    expect(BRITISH.test('not a coloured tile')).toBe(true)
    expect(BRITISH.test('a screen-reader-labelled list')).toBe(true)
    expect(BRITISH.test('not a colored tile')).toBe(false)
  })
})
