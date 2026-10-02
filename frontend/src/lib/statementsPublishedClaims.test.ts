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
    expect(panel).toContain("if (!presetError && !coordRef.current) {\n      try { const c = await getCurrentLocation(); setCoord(c); setPlace('Your location') } catch")
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

// ── ACCESSIBILITY.md ────────────────────────────────────────────────────────

describe('H-A1: the opening names every platform the statement goes on to describe', () => {
  it('names the browser, the Mac and Windows apps, and the iPhone and iPad app', () => {
    const opening = A11Y.split('\n\n')[1] ?? ''
    expect(opening).toContain('It runs in the browser, as a desktop app on Mac and Windows, and as an app on iPhone and iPad')
    // The capabilities the app ships with are the platform list.
    expect(read('src-tauri/capabilities/desktop.json')).toMatch(/"platforms": \[[^\]]*"macOS"[^\]]*"windows"/)
    expect(read('src-tauri/capabilities/mobile.json')).toContain('"platforms": ["iOS"]')
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
