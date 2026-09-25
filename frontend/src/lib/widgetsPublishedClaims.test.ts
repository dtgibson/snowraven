/// <reference types="node" />
// PUBLISHED CLAIMS ABOUT THE iOS WIDGETS, HELD TO THE CODE (ios-lifer-widgets
// FR-42, FR-43; QA-40, QA-42, QA-43). The house pattern
// (palettePublishedClaims.test.ts, .claude/rules/docs-and-website.md): each
// file's OWN passage is extracted, each row first asserts the claim EXISTS
// (deleting the sentence is the move that must go red), and every number is
// matched from the constant or source that implements it, never re-spelled.
// README.md and website/ carry no widget sentence yet (their copy is under the
// user's approval gate); rows for them belong to the change that adds one.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { WIDGET_RADIUS_MI } from './links/deepLink'
import { FAMILY_ROWS } from './widgets/widgetRows'

const repo = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
const swift = (f: string) => repo(`src-tauri/gen/apple/snowraven_widgets/Sources/${f}`)

/** A Markdown section from its heading line to the next heading of the same or higher level. */
function section(md: string, heading: string): string {
  const lines = md.split('\n')
  const start = lines.findIndex(l => l.trim() === heading)
  if (start < 0) return ''
  const level = heading.match(/^#+/)![0].length
  const out: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i]!.match(/^(#+)\s/)
    if (m && m[1]!.length <= level) break
    out.push(lines[i]!)
  }
  return out.join('\n')
}

const WORDS: Record<number, string> = { 1: 'one', 3: 'three', 8: 'eight' }
const cadenceMin = Number(/static let cadenceSeconds: TimeInterval = (\d+) \* 60/.exec(swift('Logic/RefreshEngine.swift'))![1])
const freshMin = Number(/static let freshSeconds: TimeInterval = (\d+) \* 60/.exec(swift('Logic/WidgetCache.swift'))![1])
const iosTarget = /snowraven_widgets:[\s\S]*?deploymentTarget: "(\d+)\.0"/.exec(repo('src-tauri/gen/apple/project.yml'))![1]

describe('docs/HELP.md: the Widgets section under Map Explorer', () => {
  const help = section(repo('docs/HELP.md'), '### Widgets')

  it('exists, under Map Explorer', () => {
    expect(help.length).toBeGreaterThan(500)
    const md = repo('docs/HELP.md')
    expect(md.indexOf('### Widgets')).toBeGreaterThan(md.indexOf('## Map Explorer'))
    expect(md.indexOf('### Widgets')).toBeLessThan(md.indexOf('## Multimedia'))
  })

  it('names both kinds, the iOS version the extension targets, and the three sizes with their row counts', () => {
    expect(help).toContain('**Nearby Lifers**')
    expect(help).toContain('**Media Targets**')
    expect(help).toContain(`Widgets need iOS ${iosTarget} or later`)
    expect(help).toContain(`the nearest ${WORDS[FAMILY_ROWS.medium]}`)
    expect(help).toContain(`the nearest ${WORDS[FAMILY_ROWS.large]}`)
    expect(FAMILY_ROWS.small).toBe(1)
  })

  it('states the settings exactly as the Edit Widget sheet offers them', () => {
    const intents = swift('Widget/Intents.swift')
    for (const w of ['Day', 'Week', '30 days']) expect(intents).toContain(`: "${w}"`)
    expect(help).toContain('**Time range** is Day, Week or 30 days')
    expect(intents).toContain('@Parameter(title: "Time range", default: .week)')
    expect(help).toContain('a new widget starts on Week')
    expect(help).toContain('**Media**: Photo, Audio, Video, or Any')
    expect(intents).toContain('@Parameter(title: "Media", default: .any)')
  })

  it('states the radius, the cadence and the shared-result window from the code', () => {
    expect(help).toContain(`always ${WIDGET_RADIUS_MI} miles`)
    expect(help).toContain(`about every ${cadenceMin} minutes`)
    expect(help).toContain(`for ${freshMin} minutes`)
  })

  it('names how to stop it, and never claims Always access', () => {
    expect(help).toMatch(/remove the widget from your Home Screen/)
    expect(help).toMatch(/never asks for Always access/)
    expect(swift('Widget/WidgetLocation.swift')).not.toMatch(/request(WhenInUse|Always)Authorization/)
  })

  it('the Settings eBird key paragraph and the Default Location paragraph mention the widgets', () => {
    const settings = section(repo('docs/HELP.md'), '## Settings')
    expect(section(settings, '### API Keys')).toMatch(/home-screen widgets use the same eBird key/)
    expect(section(settings, '### Default Location')).toMatch(/home-screen widgets measure from them/)
  })
})

describe('PRIVACY_POLICY.md: Your Location and iOS App', () => {
  const md = repo('PRIVACY_POLICY.md')
  const loc = section(md, '## Your Location')
  const ios = section(md, '## iOS App')

  it('no longer says location is used only while the app is in use, never in the background', () => {
    expect(md).not.toMatch(/never in the background/)
    expect(loc).toMatch(/including while SnowRaven is not open/)
  })

  it('describes the widget\'s scheduled read, the eBird request, and how to stop it', () => {
    expect(loc).toContain(`about every ${cadenceMin} minutes`)
    expect(loc).toMatch(/sends those coordinates to eBird with your own eBird key/)
    expect(loc).toMatch(/never asks for Always access/)
    expect(loc).toMatch(/remove the widget from your Home Screen, or deny SnowRaven location/)
  })

  it('quotes the usage string the app actually ships', () => {
    const plist = repo('src-tauri/Info.ios.plist')
    const usage = /<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)![1]!
    expect(loc).toContain(`("${usage.replace(/\.$/, '')}")`)
  })

  it('describes the shared container: what it holds, backups, deletion, never synced', () => {
    expect(ios).toMatch(/only SnowRaven and its widgets can read/)
    expect(ios).toMatch(/your eBird key, the species names in your eBird backup/)
    expect(ios).toMatch(/It holds none of your sightings, checklist details or media/)
    expect(ios).toMatch(/neither is ever synced through iCloud Sync/)
  })

  // Security review M1: a removal is never left in the hand-over. The sentence
  // is pinned to the mechanism that makes it true, on both sides of the IPC.
  it('says a failed rewrite after a removal empties the document, and the code does', () => {
    expect(ios).toMatch(/If a rewrite cannot finish after you remove or replace your key or remove a file, the app empties the document instead of leaving what you removed in it, and keeps trying until it can/)
    expect(ios).toMatch(/In the rare case that SnowRaven closes before it has done that and cannot rebuild the document the next time it opens, the earlier document stays until the app can rebuild it/)
    const controller = repo('frontend/src/lib/widgets/widgetHandoverController.ts')
    expect(controller).toContain('buildRevocation(deps.now(), appVersion)')
    expect(controller).toContain('await deps.remove()')
    // "keeps trying": a revocation that could not be done stays pending.
    expect(controller).toContain('if (pendingRevocation) return true')
    expect(controller).toContain('pendingRevocation = true\n    return { kind: \'revoke-failed\', failed }')
    // "the rare case": the residual is stated where the rule is made.
    expect(controller).toContain('The stated residuals')
    expect(repo('frontend/src/lib/widgets/widgetNative.ts')).toContain("invoke<void>('widgets_remove_handover')")
    expect(repo('src-tauri/src/widgets.rs')).toContain('pub fn widgets_remove_handover(')
  })

  // Security review L1: what the widget cache keeps, pinned to its shape.
  it('names what the widget cache keeps: the reports, the area to about a kilometer, a key fingerprint', () => {
    expect(ios).toMatch(/the nearby eBird reports it found, the area it searched, rounded to about a kilometer, and a short fingerprint of your eBird key \(not the key itself\)/)
    const cache = swift('Logic/WidgetCache.swift')
    expect(cache).toContain('func round2(_ x: Double) -> Double { (x * 100).rounded(.toNearestOrAwayFromZero) / 100 }')
    expect(cache).toContain('.joined().prefix(16))')
    const fields = /struct WidgetCache[^{]*\{([\s\S]*?)\n {4}static /.exec(cache)![1]!
    expect(fields).toContain('let keyFingerprint: String')
    expect(fields).not.toMatch(/ebirdKey|let key\b/)
  })

  it('scopes "no copy" to the developer, not to the saved results on the device', () => {
    const para = md.split('\n\n').find(p => p.startsWith('What you send to these services')) ?? ''
    expect(para).toMatch(/neither the request nor its answer ever reaches the developer/)
    expect(para).not.toMatch(/does not keep a copy/)
    expect(para).toMatch(/Anything the app saves from an answer stays on your device/)
  })
})

describe('ACCESSIBILITY.md: the widget VoiceOver sentence', () => {
  const md = repo('ACCESSIBILITY.md')
  const para = md.split('\n\n').find(p => p.includes('home-screen widget reads to VoiceOver as one element')) ?? ''

  it('exists', () => {
    expect(para.length).toBeGreaterThan(100)
  })

  it('matches the label the widget composes: one element, miles in full, the place even on small', () => {
    const root = swift('Widget/Views/WidgetRootView.swift')
    expect(root).toContain('.accessibilityElement(children: .ignore)')
    expect(swift('Logic/WidgetRows.swift')).toContain(') miles, \\(recency), \\(locName).')
    expect(para).toMatch(/"miles" spoken in full/)
    expect(para).toMatch(/read even on the small size, where it is not drawn/)
    expect(para).toMatch(/showing fewer birds at larger sizes rather than cutting one off/)
  })
})
